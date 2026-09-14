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
    await logIngestError(supabase, null, "token inválido (lector nativo con token no registrado)", "len=" + token.length);
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

  /* RASTRO DE LO QUE SE DESCARTA (14/9). El «1331 BAR» del padre no entró y no dejó NADA: ni fila,
     ni error. Cada `skipped` apunta ahora su motivo en app_events (`kind: ingest_skip`), para que
     el siguiente se explique en minutos en vez de quedarse en «no se sabe». */
  const skip = (motivo: string, extra: Record<string, unknown> = {}) =>
    logIngestSkip(supabase, userId, motivo, texto, titulo, fuente).then(() => json({ ok: true, skipped: true, ...extra }));

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
          pago.comercio + " · " + pago.importe + " " + pago.divisa);
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

  // 3) Inserción (service role → salta RLS, cliente creado arriba). Dedup contra expenses_dedup_idx.
  // VENTANA ANTI-DUPLICADO (bug cobro doble 2026-07-10): el índice de dedup exige el MISMO
  // timestamp, pero un pago con confirmación genera dos notis con minutos de diferencia
  // (autorizar → cargo) y entraba dos veces. Mismo usuario + mismo importe a <10 min = el
  // mismo movimiento → se ignora. (Dos compras REALES idénticas en <10 min es rarísimo;
  // si pasa, se apunta a mano — mejor eso que cobros fantasma duplicados.)
  //
  // WALLET DUPLICA LAS DE TR (2026-08-06): una compra con la tarjeta de Trade Republic dispara LAS
  // DOS notis. Mientras las dos digan el mismo euro, esta ventana ya las junta. Pero si una viene
  // en divisa, el euro convertido puede bailar un céntimo contra el que anuncia TR y entrarían las
  // dos. Por eso se compara con margen de 2 céntimos en vez de exacto: dos compras REALES en menos
  // de 10 minutos que además se parezcan en dos céntimos no pasa, y un cobro fantasma duplicado
  // sí que se nota.
  const t0 = new Date(fecha).getTime();
  const { data: dupRows } = await supabase
    .from("expenses").select("fecha")
    .eq("user_id", userId)
    .gte("importe", importe - 0.02).lte("importe", importe + 0.02)
    .gte("fecha", new Date(t0 - 10 * 60 * 1000).toISOString())
    .lte("fecha", new Date(t0 + 10 * 60 * 1000).toISOString())
    .limit(1);
  if (dupRows && dupRows.length) return skip("dup: mismo importe a <10 min", { tipo, dup: true });

  // Misma compra, avisos a HORAS distintas (2026-08-17). Wallet avisó a las 11:31 y Trade Republic
  // a las 13:08: 97 min, fuera de la ventana de 10. El banco solo tenía UN cargo; la nube guardó
  // dos y el widget los sumó. La app ya los junta por día|importe|comercio — ingest tiene que
  // hacer lo mismo al INSERTAR, no solo al contar, o la tabla sigue criando gemelos.
  const dia = String(fecha).slice(0, 10);
  const { data: dupDia } = await supabase
    .from("expenses").select("fecha")
    .eq("user_id", userId)
    .eq("comercio", comercio)
    .gte("importe", importe - 0.02).lte("importe", importe + 0.02)
    .gte("fecha", dia + "T00:00:00.000Z")
    .lte("fecha", dia + "T23:59:59.999Z")
    .limit(1);
  if (dupDia && dupDia.length) return skip("dup: mismo comercio e importe ese día", { tipo, dup: true, dupDay: true });

  const fila: Record<string, unknown> = {
    user_id: userId, fecha, importe, comercio, cat, source: "macrodroid", no_card: noCard, nota: nota || null,
  };
  // Solo cuando hubo divisa de verdad: así una noti normal en euros escribe EXACTAMENTE las mismas
  // columnas que antes y no depende de que la migración 0020 esté aplicada.
  if (divisaOrig) { fila.importe_orig = importeOrig; fila.divisa = divisaOrig; }
  const guardar = () => supabase
    .from("expenses")
    .upsert(fila, { onConflict: "user_id,fecha,importe,comercio", ignoreDuplicates: true });
  let { error } = await guardar();
  // Si la migración 0020 va por detrás de la función, se reintenta SIN el rastro de la divisa:
  // mejor el gasto sin «eran liras» que ningún gasto. El aviso queda en el panel.
  if (error && divisaOrig && /importe_orig|divisa/i.test(String(error.message || ""))) {
    await logIngestError(supabase, userId, "faltan las columnas de divisa (migración 0020): apuntado solo en euros",
      comercio + " · " + importeOrig + " " + divisaOrig);
    delete fila.importe_orig; delete fila.divisa;
    ({ error } = await guardar());
  }
  if (error) {
    await logIngestError(supabase, userId, "no se pudo guardar el gasto: " + error.message, comercio + " · " + importe + "€");
    return json({ ok: false, error: error.message }, 500);
  }

  // 4) Total del mes + alerta de presupuesto server-side (best-effort): el lector
  //    nativo lo usa para refrescar el WIDGET y lanzar la notificación aunque la
  //    app esté cerrada. Mismas reglas que la app (al_over > al_80 > al_big).
  let alert: Record<string, unknown> | null = null;
  let month: Record<string, number> | null = null;
  try {
    const { data: st } = await supabase.from("app_state").select("data").eq("user_id", userId).maybeSingle();
    const now = new Date(fecha);
    // Misma ventana que la app (Europe/Madrid), no Date.UTC — B09-B 2026-09-07.
    const desdeMs = inicioDeMesMs(now);
    const desde = new Date(desdeMs).toISOString();
    // `cat` y `source` hacen falta para contar como cuenta la app: sin ellos esto sumaba TODO
    // —los recibos del banco de fijos y las inversiones— y el aviso salía por las nubes.
    const { data: rows } = await supabase
      .from("expenses").select("importe,cat,source,fecha,comercio")
      .eq("user_id", userId).gte("fecha", desde);
    // Igual que la app al pintar Gastos: lápidas + una fila por día|importe|comercio.
    // Sin esto el widget suma gastos que él ya borró y notis gemelas (bug 907 vs 709, 2026-08-17).
    const visibles = filasComoLaApp(rows || [], st?.data?.deleted);
    const stats = statsDelMes(visibles, st?.data, desdeMs);
    const budget = stats.budget;
    const after = stats.against;
    // Y si el gasto recién apuntado NO cuenta para el presupuesto —banco de recibos, inversión,
    // traspaso— la cifra no se ha movido: avisar sería avisar por algo que él no ve subir.
    const mueveElPresupuesto = cuentaParaPresupuesto(
      { importe, cat, source: "macrodroid" }, bancosDeGastoDiario(st?.data),
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
      spent: stats.shown,
      budget,
      against: after,
      // −1 = «no hay dato», y así el nativo distingue esto de un `budgetLeft` de 0 € de verdad.
      // Importa porque la APK puede llegar antes que el despliegue de esta función: sin sentinela,
      // un widget nuevo contra un ingest viejo leería 0 y pintaría «Puedes gastar 0 €».
      budgetLeft: budget > 0 ? +Math.max(0, budget - after).toFixed(2) : -1,
      counts: mueveElPresupuesto ? 1 : 0,
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

  return json({ ok: true, tipo, fecha, importe, comercio, cat, nota: nota || null, alert, month });
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
async function logIngestError(supabase: any, userId: string | null, message: string, detail?: string) {
  try {
    const uid = userId || Deno.env.get("INGEST_USER_ID");
    if (!uid) return;
    await supabase.from("app_events").insert({
      user_id: uid, email: null, kind: "error",
      message: ("INGEST: " + message).slice(0, 500),
      detail: detail ? String(detail).slice(0, 2000) : null,
      app_version: "edge", platform: "android",
    });
  } catch (_) { /* opcional */ }
}

/* Rastro de un descarte (14/9). Solo del usuario del token (nunca en el panel de otro), con el
   motivo y el texto recortado: basta para ver si fue ruido, un duplicado o una frase sin importe.
   Best-effort como el de arriba: si falla, el ingest contesta igual. */
// deno-lint-ignore no-explicit-any
async function logIngestSkip(supabase: any, userId: string | null, motivo: string, texto: string, titulo: string, fuente: string) {
  try {
    if (!userId) return;
    await supabase.from("app_events").insert({
      user_id: userId, email: null, kind: "ingest_skip",
      message: ("INGEST skip: " + motivo).slice(0, 200),
      detail: (fuente + " · " + String(titulo || "").slice(0, 40) + " · " + String(texto || "").slice(0, 200)),
      app_version: "edge", platform: "android",
    });
  } catch (_) { /* opcional */ }
}
