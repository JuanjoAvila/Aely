// ============================================================
// Edge Function: bank-callback  (verify_jwt = false)
// Aquí ATERRIZA el navegador tras autorizar en el banco (con ?code=&state=).
// No hay sesión: localizamos al usuario por el `state` guardado en bank-connect,
// canjeamos el code por una sesión de Enable Banking, guardamos la cuenta
// autorizada y devolvemos al usuario a la app. NO escribe en expenses.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ebApi, ebConfig, makeJWT } from "../_shared/enablebanking.ts";
import { encryptSessionId } from "../_shared/token_store.ts";
import { CallbackFallo, codigoCallback, codigoNolink } from "../_shared/entrada.ts";
import { keepsCursor, type LinkedAccount } from "./reconnect.ts";

const APP_URL = Deno.env.get("APP_URL") || "https://juanjoavila.github.io/Aely/";

// Vuelta a la app o a la web según de dónde salió el usuario (bank-connect marca el state
// con ".app" cuando la petición vino de la APK). En la web basta un 302 a Pages; en la app
// el navegador del sistema no puede "volver" solo → 302 a la página PUENTE public/back.html
// (en Pages), que navega a micartera://bank (deep-link que reabre Aely).
// ANTES servíamos el HTML puente desde aquí, pero el gateway de Supabase ahora machaca el
// Content-Type a text/plain + CSP sandbox (anti-phishing) y el navegador enseñaba el código
// fuente en crudo (visto 2026-07-10) → el HTML tiene que vivir en nuestro dominio.
function backToApp(ok: boolean, msg?: string): Response {
  const qs = ok ? "?ok=1" : `?msg=${encodeURIComponent(msg || "error")}`;
  return Response.redirect(`${APP_URL}back.html${qs}`, 302);
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const fromApp = !!state && state.endsWith(".app");
  const ebError = url.searchParams.get("error");
  const hasErrorDescription = url.searchParams.has("error_description");
  /* SEC-01 (14/9): a la URL de vuelta SOLO sale un código de `_shared/entrada.ts`. Antes salía el
     texto del error con la query dentro, y quien fabricara el enlace ponía su mensaje en Aely. El
     diagnóstico se limita también aquí a códigos cerrados y presencia de code/state. */
  // deno-lint-ignore no-explicit-any
  let admin: any = null;
  let userId: string | null = null;
  try {
    if (ebError || hasErrorDescription) throw new CallbackFallo("eb_error");
    if (!code || !state) throw new CallbackFallo("sin_code");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: link } = await admin.from("bank_links").select("*").eq("state", state).maybeSingle();
    if (!link) throw new CallbackFallo("state", "state desconocido");
    userId = link.user_id || null;

    /* EL `state` CADUCA Y SE GASTA (2026-07-25).
       Este `state` es lo ÚNICO que ata la vuelta del banco con un usuario, y viaja en la URL:
       queda en el historial del navegador, en el Referer y en los logs de quien haya por el
       camino. Antes valía para siempre y se podía reutilizar. Con eso, quien lo consiguiera
       podía volver aquí con SU código de autorización y dejar SU cuenta bancaria colgando del
       usuario del `state` — o al revés, según el banco. Es rebuscado, pero el arreglo son diez
       líneas: caduca a los 30 minutos (una autorización PSD2 se hace de una sentada) y se borra
       al usarlo, así que solo sirve una vez. Los enlaces de antes de la migración 0019 no tienen
       marca de emisión: se les da por buenos para no romper una reconexión a medias. */
    const issued = link.state_issued_at ? Date.parse(link.state_issued_at) : NaN;
    if (!isNaN(issued) && Date.now() - issued > 30 * 60 * 1000) {
      throw new CallbackFallo("caducado", "state emitido hace más de 30 min");
    }
    // Se gasta ANTES de canjear el code: si el canje falla a mitad, el state ya no vale igual.
    await admin.from("bank_links").update({ state: null }).eq("id", link.id);

    const { appId, pem } = ebConfig();
    const jwt = await makeJWT(appId, pem);
    const session = await ebApi(jwt, "/sessions", { method: "POST", body: { code } });
    const sessionId = session.session_id || session.id || null;

    // --- Extracción robusta de la cuenta autorizada ---
    // Enable Banking devuelve las cuentas en formas DISTINTAS según banco/endpoint:
    //   · POST /sessions      → `accounts`: objetos {uid, account_id:{iban}}   (Sabadell: OK)
    //   · otros bancos        → `accounts` vacío y los uids en `accounts_data` [{uid, identification_hash}]
    //   · GET /sessions/{id}  → `accounts`: uids (strings) + `accounts_data`: objetos
    // (MyInvestor/Revolut/Caixa daban `recibidas: 0` porque solo mirábamos `accounts` como objetos).
    // Leemos las DOS listas y, si el POST viene vacío, preguntamos con GET /sessions/{id}.
    // deno-lint-ignore no-explicit-any
    const uidOf = (a: any): string | null =>
      (typeof a === "string" ? a : (a?.uid || a?.account_id?.uid || a?.id || null)) || null;
    // deno-lint-ignore no-explicit-any
    const ibanOf = (a: any): string | null =>
      (typeof a === "string" ? null : (a?.account_id?.iban || a?.iban || null)) || null;
    // deno-lint-ignore no-explicit-any
    const nameOf = (a: any): string | null =>
      (typeof a === "string" ? null : (a?.name || a?.product || a?.details || a?.cash_account_type || null)) || null;
    // deno-lint-ignore no-explicit-any
    const currOf = (a: any): string | null =>
      (typeof a === "string" ? null : (a?.currency || a?.account_id?.currency || null)) || null;
    // deno-lint-ignore no-explicit-any
    const collect = (o: any): any[] => {
      const a = Array.isArray(o?.accounts) ? o.accounts : [];
      const d = Array.isArray(o?.accounts_data) ? o.accounts_data : [];
      return a.concat(d);
    };
    // El hash identifica la cuenta entre autorizaciones (el `uid` cambia en cada sesión): es
    // con lo que `keepsCursor` reconoce, al reconectar, un banco que no entrega IBAN.
    // deno-lint-ignore no-explicit-any
    const hashOf = (a: any): string | null =>
      (typeof a === "string" ? null : (typeof a?.identification_hash === "string" ? a.identification_hash : null)) || null;
    // MULTI-CUENTA: junta TODAS las cuentas con uid (no solo la primera), deduplicadas por uid.
    // La misma cuenta puede venir dos veces, en `accounts` con el IBAN y en `accounts_data`
    // con el hash: la segunda aparición solo rellena lo que a la primera le faltaba.
    // deno-lint-ignore no-explicit-any
    const buildAccts = (list: any[]): LinkedAccount[] => {
      const seen: Record<string, LinkedAccount> = {};
      const out: LinkedAccount[] = [];
      for (const a of list) {
        const u = uidOf(a);
        if (!u) continue;
        const got = { uid: u, iban: ibanOf(a), name: nameOf(a), currency: currOf(a), hash: hashOf(a) };
        const first = seen[u];
        if (!first) { seen[u] = got; out.push(got); continue; }
        first.iban = first.iban || got.iban;
        first.name = first.name || got.name;
        first.currency = first.currency || got.currency;
        first.hash = first.hash || got.hash;
      }
      return out;
    };

    let accts = buildAccts(collect(session));
    // Fallback: el POST no trajo cuentas usables pero sí hay session_id → pídelas con GET.
    // Algunos bancos (p.ej. Revolut) rellenan las cuentas con un pequeño retardo tras autorizar,
    // así que reintentamos el GET un par de veces con espera.
    let getFailed = false;
    if (!accts.length && sessionId) {
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      for (let attempt = 0; attempt < 3 && !accts.length; attempt++) {
        if (attempt > 0) await sleep(1200);
        try {
          const full = await ebApi(jwt, `/sessions/${sessionId}`);
          accts = buildAccts(collect(full));
        } catch (_) {
          getFailed = true;
          break;   // un error (404/permiso) no se va a arreglar reintentando
        }
      }
    }
    /* «SIN CUENTAS» SOLO VALE CONFIRMADO (revisión del 12/10). Si el GET no llegó a responder
       (red, 5xx, 404 pasajero) no se sabe qué cuentas autorizó: escribir el enlace con cero
       cuentas y sin cursor destruía lo que había por un fallo que se arregla reintentando, y
       la reconexión siguiente ya no tenía con qué comparar para conservar el cursor.
       Se sale ANTES de tocar la fila: el enlace se queda como lo dejó `bank-connect`
       (pendiente, con sus cuentas y su `last_sync`) y la app recibe el código genérico. Es lo
       que pasaba hasta ahora, pero por accidente: el `catch` de arriba asignaba a una
       variable sin declarar y en Deno, que es modo estricto, eso lanzaba. */
    if (!accts.length && getFailed) throw new CallbackFallo("error", "GET /sessions sin respuesta");
    const uid = accts.length ? accts[0].uid : null;   // primera cuenta = "primaria" (retrocompat)
    const iban = accts.length ? accts[0].iban : null;

    /* RECONECTAR CONSERVA EL CURSOR (11/10). Antes `last_sync` volvía siempre a null y el
       enlace arrancaba como nuevo: lo que el banco apuntó entre la última sincronización y la
       reconexión, si caía antes de la ventana de siempre, no se pedía nunca. Con las MISMAS
       cuentas no se toca: la lectura siguiente ve el hueco y lo recupera por trozos como
       cualquier otro. Si las cuentas cambian, o es la primera vez, null como siempre (el
       cursor es del enlace y una cuenta nueva no puede heredarlo: ver `reconnect.ts`).
       Los acuses que tuviera un móvil de antes de reconectar dejan de valer solos: van
       ligados a `state_issued_at`, que `bank-connect` renovó al empezar (`ackLinkKey`). */
    const keep = !!uid && keepsCursor(link, accts);
    await admin.from("bank_links").update({
      session_id: await encryptSessionId(sessionId),
      account_uid: uid,
      iban,
      accounts: accts,
      status: uid ? "active" : "error",
      ...(keep ? {} : { last_sync: null }),
      updated_at: new Date().toISOString(),
    }).eq("id", link.id);

    // Si autorizó pero no obtuvimos una cuenta legible, no mentimos con "bank=ok".
    if (!uid) {
      // CAUSA REAL (confirmada por la FAQ de Enable Banking): en MODO RESTRINGIDO la API compara las
      // cuentas autorizadas contra las que tienes ENLAZADAS (whitelisted) en el panel y descarta el resto.
      // Una sesión autorizada que vuelve con 0 cuentas ⇒ esta cuenta NO está dada de alta en la app.
      // No es un bug de código: hay que enlazarla en el control panel. Devolvemos un código corto
      // (`nolink:<banco>`) que la app traduce a un mensaje accionable en el idioma del usuario.
      if (sessionId) {
        const nolink = codigoNolink(link.aspsp_name || "");
        if (fromApp) return backToApp(false, nolink);
        return Response.redirect(`${APP_URL}?bank=error&msg=${encodeURIComponent(nolink)}`, 302);
      }
      throw new CallbackFallo("sin_cuenta");
    }

    if (fromApp) return backToApp(true);
    return Response.redirect(`${APP_URL}?bank=ok`, 302);
  } catch (e) {
    const msg = codigoCallback(e);
    // Ni la query OAuth ni el mensaje de BD/proveedor son necesarios para distinguir la ruta.
    const detalle = JSON.stringify({ code: msg, codePresent: !!code, statePresent: !!state, bankError: !!(ebError || hasErrorDescription) });
    console.error("bank-callback " + msg + ": " + detalle);
    if (admin && userId) {
      try {
        await admin.from("app_events").insert({
          user_id: userId, email: null, kind: "error",
          message: "BANK-CALLBACK: " + msg,
          detail: detalle,
          app_version: "edge", platform: fromApp ? "android" : "web",
        });
      } catch (_) { /* diagnóstico opcional */ }
    }
    if (fromApp) return backToApp(false, msg);
    return Response.redirect(`${APP_URL}?bank=error&msg=${encodeURIComponent(msg)}`, 302);
  }
});
