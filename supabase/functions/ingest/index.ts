// ============================================================
// Edge Function: ingest
// Recibe las notificaciones de Trade Republic (lector nativo de la app Android,
// antes MacroDroid), las CLASIFICA, parsea, categoriza e inserta en `expenses`.
//
// Clasificación (bug Bizum 2026-07-05: un bizum RECIBIDO entraba como gasto):
//   - gasto         → compra con tarjeta (comportamiento clásico)
//   - ingreso       → bizum RECIBIDO: importe NEGATIVO + cat "ingreso" (resta del mes)
//   - gasto_nocard  → bizum ENVIADO: gasto con no_card=true (sale del saldo,
//                     pero NO alimenta el round-up: TR solo redondea tarjeta)
//   - ignorado      → ruido de TR: intereses, dividendos, órdenes, planes de
//                     inversión, round-up/saveback, depósitos propios (ya modelados
//                     con `inject`), transferencias no-bizum, avisos de seguridad…
//
// Además devuelve `alert` (presupuesto superado / 80% / gasto tocho) calculada
// server-side, para que el lector nativo pueda enseñar una notificación real
// aunque la app esté cerrada.
//
// Sin sesión de usuario (verify_jwt = false): el lector nativo no tiene login de Supabase.
// MULTIUSUARIO vía token propio (migración 0008_ingest_tokens):
//   · INGEST_TOKEN + INGEST_USER_ID → token legacy del creador (sigue igual).
//   · Cualquier otro token → lookup en ingest_tokens → user_id del titular.
// La app genera el token por usuario en Ajustes → notificaciones TR y el plugin Android
// lo manda en ?token=… (setIngestUrl). Escritura con service role (RLS no aplica al insert).
//
// Secretos necesarios en el proyecto:
//   INGEST_TOKEN     — token compartido que el lector envía (?token=… o cabecera x-ingest-token)
//   INGEST_USER_ID   — uuid de tu usuario (auth.users) dueño de los gastos
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — los inyecta Supabase automáticamente
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  categorizar, clasificarConMotivo, extraerComercio, extraerConcepto, extraerImporte, extraerPersona,
  limpiarTexto, type Fuente, type Tipo,
} from "../_shared/ingest_logic.ts";
import { aEuros, parseWallet } from "../_shared/wallet.ts";
import { claveEvento, esGemeloIngest, tieneGemeloAnterior } from "../_shared/ingest_identity.ts";
import { bucketKey, callerIp, rateLimit } from "../_shared/ratelimit.ts";
import { bancosDeGastoDiario, cuentaParaPresupuesto, filasComoLaApp, inicioDeMesMs, statsDelMes } from "../_shared/presupuesto.ts";
// Comparación del token en tiempo constante (2026-07-24) y topes de entrada (SEC-01, 14/9): en _shared.
import {
  INGEST_MAX_BODY, INGEST_MAX_COMERCIO, INGEST_MAX_NOTA, INGEST_MAX_TEXTO, recortar, timingSafeEqual,
} from "../_shared/entrada.ts";

function parseFecha(t: string): string {
  const n = parseInt(t);
  const d = !isNaN(n) && n > 0 ? new Date(n) : new Date(t);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  // Cliente service role (salta RLS): lo usamos para resolver el token → usuario y para escribir.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1) Autenticación + MULTIUSUARIO (migración 0008): el lector nativo manda un token propio.
  //    · Token del CREADOR (secreto INGEST_TOKEN → INGEST_USER_ID): sigue igual, cero disrupción.
  //    · Cualquier otro token: se busca en `ingest_tokens` y se apunta el gasto en SU cuenta.
  //    Así una pareja/amigo apunta sus gastos de TR en su propia cuenta, no en la del creador.
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || req.headers.get("x-ingest-token") || "";
  if (!token) return json({ ok: false, error: "sin token" }, 403);

  /* FRENO ANTES DE MIRAR EL TOKEN (2026-07-25). Esta función no pide sesión: su única
     credencial es este token, y sin freno se puede probar uno detrás de otro a la velocidad de
     la red. Se cuenta por IP —no por token— justo por eso: contar por token no frena a quien
     va probando tokens distintos, que es el ataque que importa.
     60 por minuto es holgadísimo para lo que hace de verdad (una notificación de Trade Republic
     cada vez que compras algo) y ridículo para fuerza bruta. Ver 0019_rate_limit.sql. */
  const ipBucket = await bucketKey("ingest-ip", callerIp(req));
  const gate = await rateLimit(supabase, ipBucket, 60, 60);
  if (!gate.ok) return json({ ok: false, error: "demasiadas peticiones" }, 429);

  let userId: string | null = null;
  const legacyToken = Deno.env.get("INGEST_TOKEN");
  if (legacyToken && timingSafeEqual(token, legacyToken)) {
    userId = Deno.env.get("INGEST_USER_ID") || null;
    if (!userId) return json({ ok: false, error: "INGEST_USER_ID no configurado" }, 500);
  } else {
    const { data: tok } = await supabase
      .from("ingest_tokens").select("user_id").eq("token", token).maybeSingle();
    userId = tok?.user_id || null;
  }
  if (!userId) {
    // NO se apunta ni un trozo del token: es una credencial, y una tabla de diagnóstico no es
    // sitio para guardar credenciales ni a medias. Con la longitud basta para distinguir «token
    // viejo/truncado» de «token de otro proyecto» (2026-07-24).
    await logIngestError(supabase, null, "token inválido (lector nativo con token no registrado)", { tokenLength: token.length });
    return json({ ok: false, error: "token inválido" }, 403);
  }

  // 2) Parseo del cuerpo (JSON o form-urlencoded, compat MacroDroid)
  //    TOPE (SEC-01, 14/9): una notificación son unos cientos de caracteres. Sin tope, quien tenga un
  //    token podía mandar megas; se corta ANTES de leer el cuerpo si lo anuncia, y después si no.
  const anunciado = Number(req.headers.get("content-length") || 0);
  if (anunciado > INGEST_MAX_BODY) return json({ ok: false, error: "cuerpo demasiado grande" }, 413);
  const raw = await req.text();
  if (raw.length > INGEST_MAX_BODY) return json({ ok: false, error: "cuerpo demasiado grande" }, 413);
  let data: Record<string, string> = {};
  try { data = JSON.parse(raw); }
  catch { data = Object.fromEntries(new URLSearchParams(raw)); }
  if (!data || typeof data !== "object") data = {};

  const texto = recortar(data.texto || data.notiText || "", INGEST_MAX_TEXTO);
  const titulo = recortar(data.titulo || data.notiTitle || "", INGEST_MAX_TEXTO);
  const triggertime = recortar(data.fecha || data.triggertime || "", 40);

  /* DE QUÉ APP VENÍA (2026-08-06). El lector nativo lo manda desde la 4.16.0; sin el campo se
     asume Trade Republic, que es lo único que había antes — así una APK vieja sigue funcionando
     exactamente igual y no hay que actualizar para que nada se rompa. */
  const fuente: Fuente = data.fuente === "wallet" ? "wallet" : "tr";

  /* RASTRO DE LO QUE SE DESCARTA (14/9). Conserva el motivo y la forma, no la notificación: texto,
     comercio e importe ya son datos financieros aunque el panel sea solo-admin. */
  const skip = (motivo: string, extra: Record<string, unknown> = {}) =>
    logIngestSkip(supabase, userId, motivo, fuente, texto.length, titulo.length).then(() => json({ ok: true, skipped: true, ...extra }));

  /* ACK EXACTO (17/9). Un timeout puede ocurrir DESPUÉS del INSERT y antes de que el móvil reciba
     la respuesta. Reintentar entonces no es otro gasto: es el mismo evento esperando acuse. La
     huella no contiene texto ni dinero, y el índice único cierra también la carrera entre dos POST.
     Una APK anterior no manda `evento`: conserva temporalmente la red legacy de abajo. */
  let eventKey = claveEvento(data.evento, fuente, texto);
  if (eventKey) {
    const { data: ack, error: ackError } = await supabase.from("expenses")
      .select("id").eq("user_id", userId).eq("ingest_event_id", eventKey).limit(1);
    if (!ackError && ack && ack.length) return skip("dup: mismo evento nativo", { dup: true, ack: ack[0].id });
    // Despliegue compatible: si la migración aún no ha llegado, sigue con el camino antiguo.
    if (ackError && /ingest_event_id|column/i.test(String(ackError.message || ""))) eventKey = null;
  }

  const { tipo, motivo } = clasificarConMotivo(texto, titulo, fuente);
  if (tipo === "ignorado") return skip(motivo || "ignorado", { tipo });

  const fecha = parseFecha(triggertime);
  let importe = 0;
  let comercio: string;
  let cat: string;
  let noCard = false;
  let importeOrig: number | null = null;      // lo que marcaba el precio, si no fue en euros
  let divisaOrig: string | null = null;

  if (fuente === "wallet") {
    /* WALLET VA AL REVÉS QUE TR: el comercio en el TÍTULO y el importe en el TEXTO. Y puede venir
       en otra moneda, que es justo el caso del crucero pagando con Revolut. */
    const pago = parseWallet(titulo, texto, limpiarTexto);
    if (!pago) return skip("wallet: sin importe reconocible", { tipo: "ignorado", error: "wallet: sin importe reconocible" });
    let eur: number | null = pago.divisa === "EUR" ? +pago.importe.toFixed(2) : null;
    if (pago.divisa !== "EUR") {
      const { data: stFx } = await supabase.from("app_state").select("data").eq("user_id", userId).maybeSingle();
      eur = aEuros(pago.importe, pago.divisa, stFx?.data);
      if (eur === null) {
        /* SIN TIPO NO SE GUARDA — misma regla que el botón de apuntar. Convertir «a lo que sea»
           metería 1.520 € por 1.520 ₺ y no lo cazaría ningún test: se descubre semanas después
           mirando un histórico que ya no se puede reconstruir. Pero callarse tampoco vale, que es
           como se perdió el gasto de Splau: queda el rastro en el panel para poder apuntarlo a
           mano. */
        await logIngestError(supabase, userId,
          "sin tipo de cambio para " + pago.divisa + ": el gasto NO se ha apuntado",
          { currency: pago.divisa });
        return json({ ok: true, tipo: "ignorado", skipped: true, error: "sin tipo para " + pago.divisa });
      }
      importeOrig = pago.importe;
      divisaOrig = pago.divisa;
    }
    importe = eur;
    comercio = pago.comercio;
    cat = categorizar(comercio);
  } else {
    // Camino de Trade Republic, el de siempre: la frase lo lleva todo y el importe sale del texto.
    const bruto = extraerImporte(texto);
    if (!(bruto > 0)) return skip("sin importe", { tipo: "ignorado", error: "sin importe" });
    importe = bruto;
    if (tipo === "ingreso") {
      importe = -bruto;                                   // resta del gasto del mes
      const quien = extraerPersona(texto, "de");
      comercio = quien ? "Bizum de " + quien : "Bizum recibido";
      cat = "ingreso";
      noCard = true;
    } else if (tipo === "gasto_nocard") {
      const quien = extraerPersona(texto, "a");
      comercio = quien ? "Bizum a " + quien : "Bizum enviado";
      cat = "otros";
      noCard = true;                                      // no alimenta el round-up
    } else {
      comercio = extraerComercio(texto, titulo);
      cat = categorizar(comercio);
    }
  }

  // CONCEPTO (2026-07-24): el mensaje del bizum / la descripción que venía en la noti. Se guarda
  // aparte del título para que el histórico se explique solo y no haya que abrir la app del banco.
  const nota = recortar(extraerConcepto(texto, titulo), INGEST_MAX_NOTA);
  // Antes de la ventana anti-duplicado: el dedup por comercio compara con lo que se guarda.
  comercio = recortar(comercio, INGEST_MAX_COMERCIO);

  // 3) Inserción (service role → salta RLS).
  // Dos compras reales iguales notificadas por la MISMA puerta se conservan. Si TR y Wallet
  // describen el mismo pago de la tarjeta TR, la segunda notificación se descarta en silencio:
  // no es una duda financiera ni debe crear una segunda fila para que el usuario la resuelva.
  const t0 = new Date(fecha).getTime();
  const fuentesIngest = ["macrodroid", "wallet", "ob:trade_republic#dup", "ob:wallet#dup"];
  let possibleDup = false;
  if (eventKey) {
    const { data: cercanos } = await supabase.from("expenses")
      .select("id,fecha,importe,ingest_event_id")
      .eq("user_id", userId)
      .in("source", fuentesIngest)
      .gte("importe", importe - 0.02).lte("importe", importe + 0.02)
      .gte("fecha", new Date(t0 - 2 * 60 * 60 * 1000).toISOString())
      .lte("fecha", new Date(t0 + 2 * 60 * 60 * 1000).toISOString());
    const gemelo = (cercanos || []).find((r) => esGemeloIngest(
      { fecha, importe, ingest_event_id: eventKey }, r,
    ));
    if (gemelo) return skip("dup: mismo pago avisado por TR y Wallet", { tipo, dup: true, ack: gemelo.id });
  } else {
    /* Una APK antigua no aporta identidad suficiente para borrar por parecido. Conservamos la
       segunda señal fuera de las cifras y respondemos skipped para que no confirme dos veces;
       el usuario puede revisarla después sin haber perdido una compra real. */
    const { data: dupRows } = await supabase.from("expenses").select("fecha")
      .eq("user_id", userId)
      .in("source", fuentesIngest)
      .gte("importe", importe - 0.02).lte("importe", importe + 0.02)
      .gte("fecha", new Date(t0 - 10 * 60 * 1000).toISOString())
      .lte("fecha", new Date(t0 + 10 * 60 * 1000).toISOString()).limit(1);
    possibleDup = !!(dupRows && dupRows.length);
    const dia = String(fecha).slice(0, 10);
    const { data: dupDia } = await supabase.from("expenses").select("fecha")
      .eq("user_id", userId).eq("comercio", comercio)
      .in("source", fuentesIngest)
      .gte("importe", importe - 0.02).lte("importe", importe + 0.02)
      .gte("fecha", dia + "T00:00:00.000Z").lte("fecha", dia + "T23:59:59.999Z").limit(1);
    possibleDup = possibleDup || !!(dupDia && dupDia.length);
  }

  /* La compra entra PENDIENTE y se libera después del INSERT. Es lo que cierra la carrera real
     Consum/Wallet + TR del 23/9: las dos peticiones consultaron antes de que la otra fila existiese.
     Si se descubre el gemelo después, se borra solo la fila recién creada; el primer gasto queda. */
  const necesitaPuertaCarrera = tipo === "gasto";
  const fila: Record<string, unknown> = {
    user_id: userId, fecha, importe, comercio, cat,
    /* `#dup` es aquí una puerta TRANSITORIA: incluso un cliente anterior deja la fila fuera de
       las cifras mientras cerramos la carrera posterior al INSERT. En el camino normal se libera
       a `macrodroid` o se retira antes de responder; no se convierte en una decisión del usuario. */
    source: necesitaPuertaCarrera || possibleDup ? "ob:trade_republic#dup" : "macrodroid",
    no_card: noCard, nota: nota || null,
  };
  if (eventKey) fila.ingest_event_id = eventKey;
  // Solo cuando hubo divisa de verdad: así una noti normal en euros escribe EXACTAMENTE las mismas
  // columnas que antes y no depende de que la migración 0020 esté aplicada.
  if (divisaOrig) { fila.importe_orig = importeOrig; fila.divisa = divisaOrig; }
  const guardar = () => supabase
    .from("expenses")
    .upsert(fila, { onConflict: "user_id,fecha,importe,comercio", ignoreDuplicates: true })
    .select("id");
  let { data: inserted, error } = await guardar();
  // Si la migración 0020 va por detrás de la función, se reintenta SIN el rastro de la divisa:
  // mejor el gasto sin «eran liras» que ningún gasto. El aviso queda en el panel.
  if (error && divisaOrig && /importe_orig|divisa/i.test(String(error.message || ""))) {
    await logIngestError(supabase, userId, "faltan las columnas de divisa (migración 0020): apuntado solo en euros",
      { currency: divisaOrig });
    delete fila.importe_orig; delete fila.divisa;
    ({ data: inserted, error } = await guardar());
  }
  // Respuesta perdida + reintento simultáneo: el índice exacto puede ganar entre SELECT e INSERT.
  if (error && eventKey && String(error.code || "") === "23505") {
    const { data: ack } = await supabase.from("expenses").select("id")
      .eq("user_id", userId).eq("ingest_event_id", eventKey).limit(1);
    if (ack && ack.length) return skip("dup: carrera del mismo evento nativo", { tipo, dup: true, ack: ack[0].id });
  }
  if (error) {
    await logIngestError(supabase, userId, "no se pudo guardar el gasto",
      { code: String(error.code || "unknown"), source: fuente });
    return json({ ok: false, error: error.message }, 500);
  }
  // `ignoreDuplicates` no es un INSERT: antes se respondía éxito y Android confirmaba otro gasto.
  if (!inserted || !inserted.length) return skip("dup: conflicto exacto sin nueva fila", { tipo, dup: true });
  const ackId = inserted[0].id;

  if (necesitaPuertaCarrera) {
    const ventana = eventKey ? 2 * 60 * 60 * 1000 : 10 * 60 * 1000;
    const columnas = eventKey
      ? "id,fecha,importe,ingest_event_id,created_at,source"
      : "id,fecha,importe,created_at,source";
    const { data: trasInsert, error: raceError } = await supabase.from("expenses")
      .select(columnas).eq("user_id", userId)
      .in("source", fuentesIngest)
      .gte("importe", importe - 0.02).lte("importe", importe + 0.02)
      .gte("fecha", new Date(t0 - ventana).toISOString())
      .lte("fecha", new Date(t0 + ventana).toISOString());
    const actual = (trasInsert || []).find((r) => String(r.id) === String(ackId));
    if (raceError || !actual) {
      await logIngestError(supabase, userId,
        "no se pudo cerrar la comprobación anti-duplicado: queda pendiente y fuera de las cifras",
        { code: "race_check", source: fuente });
      return skip("anti-dup: comprobación pendiente", { tipo, deferred: true, ack: ackId });
    }
    const gemeloAnterior=tieneGemeloAnterior(actual, trasInsert || []);
    if (!eventKey && (possibleDup || gemeloAnterior)) {
      /* Sin identidad nativa no hay prueba bastante para borrar. El APK antiguo recibe skipped
         y no duplica la confirmación; la fila queda fuera del total y se puede resolver. */
      return skip("dup legacy: candidato conservado para revisar",
        { tipo, dup: true, possibleDup: true, ack: ackId });
    }
    if (gemeloAnterior) {
      const { error: borrarError } = await supabase.from("expenses")
        .delete().eq("user_id", userId).eq("id", ackId);
      if (borrarError) {
        await logIngestError(supabase, userId,
          "se detectó el aviso duplicado pero no se pudo retirar: queda fuera de las cifras",
          { code: "dup_delete", source: fuente });
        return skip("dup: retirada pendiente", { tipo, dup: true, deferred: true, ack: ackId });
      }
      return skip("dup: mismo pago avisado por TR y Wallet", { tipo, dup: true, ack: ackId });
    }
    const { error: liberarError } = await supabase.from("expenses")
      .update({ source: "macrodroid" }).eq("user_id", userId).eq("id", ackId);
    if (liberarError) {
      await logIngestError(supabase, userId,
        "no se pudo confirmar el gasto: queda pendiente y fuera de las cifras",
        { code: "release", source: fuente });
      return skip("anti-dup: confirmación pendiente", { tipo, deferred: true, ack: ackId });
    }
    fila.source = "macrodroid";
  }

  // 4) Total del mes + alerta de presupuesto server-side (best-effort): el lector
  //    nativo lo usa para refrescar el WIDGET y lanzar la notificación aunque la
  //    app esté cerrada. Mismas reglas que la app (al_over > al_80 > al_big).
  let alert: Record<string, unknown> | null = null;
  let month: Record<string, number | string> | null = null;
  try {
    const { data: st } = await supabase.from("app_state").select("data").eq("user_id", userId).maybeSingle();
    const now = new Date(fecha);
    // Misma ventana que la app (Europe/Madrid), no Date.UTC — B09-B 2026-09-07.
    const desdeMs = inicioDeMesMs(now);
    const desde = new Date(desdeMs).toISOString();
    // `cat` y `source` hacen falta para contar como cuenta la app: sin ellos esto sumaba TODO
    // —los recibos del banco de fijos y las inversiones— y el aviso salía por las nubes.
    // El orden corresponde al INICIO de la lectura: una consulta lenta puede acabar después
    // de otra más nueva aunque su snapshot sea anterior.
    const readAt = Date.now();
    const { data: rows, error: rowsError } = await supabase
      .from("expenses").select("id,importe,cat,source,fecha,comercio")
      .eq("user_id", userId).gte("fecha", desde);
    if (rowsError) throw rowsError;
    // La lectura absoluta puede responder después de otra más nueva. El nativo compara este
    // instante de lectura, no la llegada de la respuesta ni la fecha del movimiento.
    // Igual que la app al pintar Gastos: lápidas + una fila por día|importe|comercio.
    // Sin esto el widget suma gastos que él ya borró y notis gemelas (bug 907 vs 709, 2026-08-17).
    const visibles = filasComoLaApp(rows || [], st?.data?.deleted);
    const stats = statsDelMes(visibles, st?.data, desdeMs);
    // Si la app envía un snapshot mientras esta respuesta sigue en vuelo, el nativo necesita
    // la contribución de ESTA fila, no un absoluto que quizá preceda a ese snapshot.
    const sinEsta = statsDelMes(visibles.filter((r) => String(r.id) !== String(ackId)), st?.data, desdeMs);
    const budget = stats.budget;
    const after = stats.against;
    // Y si el gasto recién apuntado NO cuenta para el presupuesto —banco de recibos, inversión,
    // traspaso— la cifra no se ha movido: avisar sería avisar por algo que él no ve subir.
    const mueveElPresupuesto = cuentaParaPresupuesto(
      { importe, cat, source: String(fila.source) }, bancosDeGastoDiario(st?.data),
    );
    // `spent` va con la cifra que PINTA la app (shown), no con el bruto: el widget y la cabecera
    // de Gastos tienen que decir lo mismo («misma cifra en todos sitios», 2026-08-05).
    //
    // `budgetLeft` y `counts` son para el WIDGET con la app cerrada (bug 2026-08-17: el widget
    // decía «891 gastado · quedan 109» y a la vez «✅ Puedes gastar 324 €»). El widget necesita
    // DOS topes: lo que deja el presupuesto (esto) y la liquidez segura de la cuenta de gasto
    // (`safeLiq`), que solo sabe la app porque sale de simular el mes día a día con fijos, deudas
    // y traspasos. Aquí se manda el que el servidor SÍ puede calcular exacto; el nativo baja el
    // otro por su cuenta con `counts` y se queda con el mínimo de los dos. Deliberadamente NO se
    // reimplementa `safeLiq` en el servidor: sería la tercera copia de la misma regla, y de esa
    // duplicación ya salieron los dos últimos bugs de presupuesto.
    month = {
      periodStart: desdeMs,
      readAt,
      eventKey: eventKey || "",
      expenseKey: encodeURIComponent(fecha.slice(0, 10) + "|" + importe + "|" + comercio),
      spent: stats.shown,
      shownDelta: +(stats.shown - sinEsta.shown).toFixed(2),
      budget,
      against: after,
      // −1 = «no hay dato», y así el nativo distingue esto de un `budgetLeft` de 0 € de verdad.
      // Importa porque la APK puede llegar antes que el despliegue de esta función: sin sentinela,
      // un widget nuevo contra un ingest viejo leería 0 y pintaría «Puedes gastar 0 €».
      budgetLeft: budget > 0 ? +Math.max(0, budget - after).toFixed(2) : -1,
      againstDelta: +(stats.against - sinEsta.against).toFixed(2),
      counts: mueveElPresupuesto ? 1 : 0,
      // Una inversión/traspaso no gasta presupuesto, pero sí sale del efectivo de TR.
      cashCounts: 1,
    };
    if (tipo === "gasto" && budget > 0 && mueveElPresupuesto) {
      const before = after - importe;
      // Umbrales 50/95 añadidos 2026-07-18 (petición: avisos aunque la app esté cerrada —
      // esta respuesta la renderiza el lector nativo, así que funciona en frío).
      if (before <= budget && after > budget)       alert = { kind: "over", monthSpent: after, budget };
      else if (before < budget * 0.95 && after >= budget * 0.95 && after <= budget)
                                                    alert = { kind: "p95", monthSpent: after, budget };
      else if (before < budget * 0.8 && after >= budget * 0.8 && after < budget * 0.95)
                                                    alert = { kind: "p80", monthSpent: after, budget };
      else if (before < budget * 0.5 && after >= budget * 0.5 && after < budget * 0.8)
                                                    alert = { kind: "p50", monthSpent: after, budget };
      else if (importe >= budget * 0.15 && importe >= 50)
                                                    alert = { kind: "big", monthSpent: after, budget };
    }
  } catch (_) { /* opcional; el movimiento ya está guardado */ }

  return json({ ok: true, tipo, fecha, importe, comercio, cat, nota: nota || null,
    ack: ackId, alert, month });
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Telemetría solo-admin: los fallos del ingest eran INVISIBLES (pasaban en el servidor, lejos
// de la app → app_events no se enteraba y el gasto "desaparecía" sin rastro — bug 2026-07-11).
// Best-effort: nunca rompe el ingest. Sin user resuelto se apunta al del creador (es su panel).
// deno-lint-ignore no-explicit-any
async function logIngestError(supabase: any, userId: string | null, message: string,
  detail: Record<string, string | number | boolean | null> = {}) {
  try {
    const uid = userId || Deno.env.get("INGEST_USER_ID");
    if (!uid) return;
    await supabase.from("app_events").insert({
      user_id: uid, email: null, kind: "error",
      message: ("INGEST: " + message).slice(0, 500),
      detail: Object.keys(detail).length ? JSON.stringify(detail).slice(0, 1000) : null,
      app_version: "edge", platform: "android",
    });
  } catch (_) { /* opcional */ }
}

/* Rastro de un descarte (14/9). Solo del usuario del token y sin contenido de la notificación:
   motivo, fuente y longitudes bastan para distinguir vacío/formato/duplicado sin retener dinero. */
// deno-lint-ignore no-explicit-any
async function logIngestSkip(supabase: any, userId: string | null, motivo: string, fuente: string,
  textLength: number, titleLength: number) {
  try {
    if (!userId) return;
    await supabase.from("app_events").insert({
      user_id: userId, email: null, kind: "ingest_skip",
      message: ("INGEST skip: " + motivo).slice(0, 200),
      detail: JSON.stringify({ source: fuente, textLength, titleLength }),
      app_version: "edge", platform: "android",
    });
  } catch (_) { /* opcional */ }
}
