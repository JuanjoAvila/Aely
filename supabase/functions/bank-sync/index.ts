// ============================================================
// Edge Function: bank-sync  (verify_jwt = true)
// La llama la app (usuario logueado). Trae SALDO + MOVIMIENTOS de los bancos
// enlazados del usuario.
//
// El sync actualiza el estado del enlace; el histórico es de solo lectura.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ebApi, ebConfig, ebFailure, ebSessionVerdict, jsonResp, makeJWT, mapTransaction, fetchBankTransactions } from "../_shared/enablebanking.ts";
import { decryptSessionId } from "../_shared/token_store.ts";
import { withCors } from "../_shared/cors.ts";
import { readInput } from "../_shared/request_body.ts";
import { rateLimit } from "../_shared/ratelimit.ts";
import { OB_DEMAND_MAX_PAGES, ackCursor, ackLinkKey, ackToken, chunkCursor, demandFloor, demandPlan, demandReadComplete, nextChunkDays, ymdAddDays, ymdSpan } from "./demand-window.ts";

/* Los movimientos crudos no salen a `app_events`. El diagnóstico temporal del signo de TR
   guardaba hasta ocho payloads completos y seguía activo el 23/9, cuando apareció en telemetría
   durante una sincronización normal. Ese caso ya tiene una regresión con los datos mínimos que
   demostraron su forma (`hist-cashback-par`); soporte conserva debajo solo clases y recuentos
   cerrados, nunca importes, comercios, fechas, referencias ni titulares. */

/* El cliente recibe un código estable, pero soporte necesita distinguir un 401 de un 503 sin
   guardar el texto crudo del proveedor: ese mensaje puede traer referencias o datos bancarios.
   Solo se conserva una clase cerrada y el banco; nunca uid de cuenta, URL ni payload. */
// El nombre del enlace es un campo libre de BD: no basta recortarlo para hacerlo público.
function obLogBank(raw: unknown): string {
  const names = ["CaixaBank", "Banco de Sabadell", "Revolut", "BBVA", "Santander", "Bankinter", "ING", "MyInvestor"];
  return names.find((name) => name.toLowerCase() === String(raw || "").toLowerCase()) || "banco";
}

function obReadFailureCode(err: unknown) {
  const msg = String((err as Error)?.message || err || "");
  const status = msg.match(/\bEB\s+(\d{3})\b/i);
  if (status) return `eb_${status[1]}`;
  if (/abort|timeout/i.test(msg)) return "timeout";
  if (/transactions_budget/i.test(msg)) return "page_limit";
  if (/transactions_invalid/i.test(msg)) return "invalid_response";
  return "unavailable";
}

// El mismo vocabulario sirve al histórico y al diario: jamás copiar el texto del ASPSP al log.
// deno-lint-ignore no-explicit-any
function obReadLogDetails(accounts: any[]) {
  const reasons: string[] = [], failureCodes: string[] = [];
  for (const a of accounts || []) {
    const code = a.failureCode || (a.error ? obReadFailureCode(a.error) : null);
    const reason = ["page_limit", "row_limit", "time_limit", "repeated_cursor", "invalid_response", "provider_error"].includes(a.readReason)
      ? a.readReason : code === "timeout" || a.transactionError === "timeout" ? "time_limit" : code === "invalid_response" ? "invalid_response" : code === "page_limit" ? "page_limit" : a.transactionError || a.ok === false ? "provider_error" : a.truncated ? "incomplete" : null;
    if (reason && !reasons.includes(reason)) reasons.push(reason);
    if (["timeout", "page_limit", "invalid_response", "unavailable", "eb_400", "eb_401", "eb_403", "eb_404", "eb_408", "eb_422", "eb_429", "eb_500", "eb_502", "eb_503", "eb_504"].includes(code) && !failureCodes.includes(code)) failureCodes.push(code);
  }
  if (!accounts || !accounts.length) reasons.push("no_accounts");
  return { reasons, failureCodes };
}

// deno-lint-ignore no-explicit-any
async function logObReadFailure(admin: any, userId: string, aspsp: string, err: unknown) {
  try {
    await admin.from("app_events").insert({
      user_id: userId, email: null, kind: "error",
      message: `OB histórico (${obLogBank(aspsp)}): lectura no disponible`,
      detail: JSON.stringify({ code: obReadFailureCode(err) }),
      app_version: "edge", platform: "server",
    });
  } catch (_) { /* diagnóstico best-effort: nunca cambia el resultado bancario */ }
}

/* Un 401 que NO cierra la sesión (ver `ebFailure` y `ebSessionVerdict`) deja el enlace como
   estaba, pero tiene que quedar apuntado: es un fallo de la aplicación frente al proveedor
   (clave, cabecera, IP) y, sin rastro, desde fuera solo se vería «el banco no actualiza».
   `error` sale de la lista cerrada de `ebFailure` y `session` de la de `ebSessionVerdict`
   (o `NO_CONSULTADA` si otra cuenta del mismo banco sí respondió). */
// deno-lint-ignore no-explicit-any
async function logObAuthFailure(admin: any, userId: string, aspsp: string, err: unknown, session: string) {
  try {
    await admin.from("app_events").insert({
      user_id: userId, email: null, kind: "error",
      message: `OB sync (${obLogBank(aspsp)}): 401 sin cierre de sesión`,
      detail: JSON.stringify({ code: obReadFailureCode(err), error: ebFailure(err).code, session }),
      app_version: "edge", platform: "server",
    });
  } catch (_) { /* diagnóstico best-effort: nunca cambia el resultado bancario */ }
}

// Diagnóstico cerrado del resultado, sin uid/IBAN/movimientos/importes. Hace falta distinguir
// «Caixa respondió vacío» de «no llegó a leer» sin pedir capturas privadas a la familia.
// deno-lint-ignore no-explicit-any
async function logObHistoryResult(admin: any, userId: string, aspsp: string, dateFrom: string, accounts: any[], elapsedMs: number) {
  try {
    const count = (accounts || []).reduce((n, a) => n + (typeof a?.count === "number" ? a.count : (a?.transactions || []).length), 0);
    const failed = (accounts || []).filter((a) => a?.ok === false).length;
    const partial = !(accounts || []).length || failed > 0 || (accounts || []).some((a) => !!(a?.truncated || a?.transactionError));
    const status = partial ? (count ? "partial" : "error") : (count ? "ok" : "empty");
    await admin.from("app_events").insert({
      user_id: userId, email: null, kind: "performance",
      message: `OB histórico (${obLogBank(aspsp)}): ${status}`,
      detail: JSON.stringify({ status, accounts: (accounts || []).length, count, partial, elapsedMs: Math.max(0, Math.round(elapsedMs)), dateFrom, ...obReadLogDetails(accounts) }),
      app_version: "edge", platform: "server",
    });
  } catch (_) { /* diagnóstico best-effort: nunca cambia el resultado bancario */ }
}

// Sync a demanda: mismos conteos que el histórico, sin uid, IBAN, importes ni comercios.
// La fecha mínima es la pedida al banco, no la de un movimiento. `pending` dice si quedó
// tramo antiguo por leer: sin él no se distingue «al día» de «a medias» desde soporte.
// deno-lint-ignore no-explicit-any
async function logObDemandResult(admin: any, userId: string, aspsp: string, dateFrom: string, status: string, accounts: number, count: number, pages: number, truncated: boolean, capped: boolean, pending: boolean, reasons: string[], failureCodes: string[]) {
  try {
    await admin.from("app_events").insert({
      user_id: userId, email: null, kind: "performance",
      message: `OB sync (${obLogBank(aspsp)}): ${status}`,
      detail: JSON.stringify({ status, accounts, count, pages, truncated, dateFrom, capped, pending, reasons, failureCodes }),
      app_version: "edge", platform: "server",
    });
  } catch (_) { /* diagnóstico best-effort: nunca cambia el resultado bancario */ }
}

// Todo avance usa la misma autorización que se leyó. El callback o connect pueden cambiarla
// mientras esperamos al banco; el predicado SQL compara el valor cifrado en reposo y su emisión.
// deno-lint-ignore no-explicit-any
function sameLinkVersion(query: any, link: any) {
  query = link.session_id == null ? query.is("session_id", null) : query.eq("session_id", link.session_id);
  return link.state_issued_at == null ? query.is("state_issued_at", null) : query.eq("state_issued_at", link.state_issued_at);
}

Deno.serve(withCors(async (req: Request) => {
  // El límite por cuenta no basta: muchas cuentas lentas podrían agotar la Edge y perder
  // también las respuestas buenas. Se reserva margen para devolverlas y cerrar la petición.
  const deadline = Date.now() + 60000;
  try {
    const input = await readInput(req, "bank-sync");
    if (!input.ok) return jsonResp({ ok: false, error: input.error }, input.status);
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const supa = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return jsonResp({ ok: false, error: "sin sesión" }, 401);

    // IMPORTAR HISTÓRICO (opcional): la app manda { dateFrom:"YYYY-MM-DD" } para traer los
    // movimientos desde esa fecha (tope PSD2 ~90 días). Modo LECTURA PURA: NO toca saldos ni el
    // estado de los enlaces (a diferencia del sync normal). Solo devuelve las transacciones para
    // que la app enseñe un selector "elige qué gastos importar".
    const body = input.body;
    const dateFrom = (typeof body?.dateFrom === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.dateFrom))
      ? body.dateFrom : null;
    // Campo distinto de dateFrom a propósito: dateFrom abre el histórico de solo lectura
    // (no toca saldos). Un cliente nuevo contra una función vieja manda esto y la vieja lo
    // ignora; una función nueva contra un cliente viejo no lo ve y no ensancha.
    const recoverGaps = body?.recoverGaps === true;
    /* `acks` (aunque venga vacío) lo manda solo el cliente que devuelve acuse. Con él esta
       función NO mueve last_sync por lo que acaba de leer: se lo entrega en `ack` y lo
       escribe cuando vuelva, en la pulsación siguiente (un enlace sin cursor recibe además su
       punto de partida, que no depende de lo leído). El cliente que no lo manda no puede
       acusar nada, así que con él el cursor se sigue escribiendo aquí, como hasta ahora. */
    const acks: Record<string, unknown> | null = recoverGaps && body?.acks && typeof body.acks === "object" && !Array.isArray(body.acks)
      ? body.acks as Record<string, unknown> : null;
    const phaseClient = body?.accountPhases === 1 && !!acks;
    const hasAspspFilter = Array.isArray(body?.aspsps);
    const wantedAspsps = hasAspspFilter
      ? (body.aspsps as unknown[]).map((x: unknown) => String(x || "").trim().toLowerCase()).filter(Boolean).slice(0, 12)
      : [];

    // OJO (bug CaixaBank 2026-07-11): también se devuelven los enlaces caducados/rotos, marcados
    // ok:false. Antes solo venían los 'active' → un banco caducado desaparecía del sync, la app
    // reconstruía obAccounts sin él y sus cuentas se ESFUMABAN del patrimonio sin ningún aviso.
    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // Diario, histórico y acuses comparten cupo: variar el cuerpo no debe permitir
    // repetir lecturas PSD2 ni adelantar un cursor cuando la petición está limitada.
    const gate = await rateLimit(admin, "bank-sync:" + user.id, 30, 600);
    if (!gate.ok) return jsonResp({ ok: false, error: "rate_limit" }, 429);
    const { data: allLinks, error: linksError } = await admin
      .from("bank_links").select("*")
      // Y también los 'pending' (11/9/2026): un banco que se quedó a medio autorizar no entraba
      // aquí, así que no salía en la respuesta y la app no tenía NADA que avisar. Su CaixaBank
      // estuvo semanas en pendiente sin que ni el sync ni ninguna pantalla lo dijeran: «al
      // sincronizar no sale ni un aviso ni nada, he tenido que venir aquí para ver qué pasaba».
      .eq("user_id", user.id).in("status", ["active", "expired", "error", "pending"]);
    if (linksError) return jsonResp({ ok: false, error: "bank_links_unavailable" }, 503);
    const selectedLinks = hasAspspFilter
      ? (allLinks || []).filter((l) => wantedAspsps.includes(String(l.aspsp_name || "").trim().toLowerCase()))
      : (allLinks || []);
    const links = selectedLinks.filter((l) => l.status === "active");
    const deadLinks = selectedLinks.filter((l) => l.status !== "active");

    const { appId, pem } = ebConfig();
    const jwt = await makeJWT(appId, pem);

    if (dateFrom) {
      /* El cliente actual manda UN enlace por invocación para que cada banco estrene estos 60 s,
         sin abrir sesiones PSD2 simultáneas. La cola de abajo se conserva por compatibilidad con
         clientes anteriores, pero en ellos los enlaces posteriores a uno lento pueden agotar el
         reloj común y quedan declarados como timeout, nunca como cero movimientos. */
      const readHistoryLink = async (link: any) => {
        const startedAt = Date.now();
        /* Dentro del banco, los 15 s de la primera versión se dividían además entre sus cuentas:
           una Caixa con dos recibía apenas 7,5 s por cuenta y caía antes de terminar la primera
           página. Se reservan 5 s para diagnóstico, serialización y respuesta. */
        const linkDeadline = deadline - 5000;
        // deno-lint-ignore no-explicit-any
        const acctList: any[] = (Array.isArray(link.accounts) && link.accounts.length)
          ? link.accounts
          : (link.account_uid ? [{ uid: link.account_uid, iban: link.iban, name: null }] : []);
        // deno-lint-ignore no-explicit-any
        const accts: any[] = [];
        for (let accountIndex = 0; accountIndex < acctList.length; accountIndex++) {
          const ac = acctList[accountIndex];
          const uid = ac?.uid;
          if (!uid || typeof uid !== "string") continue;
          const remainingAccounts = acctList.length - accountIndex;
          const remainingMs = linkDeadline - Date.now();
          if (remainingMs <= 0) {
            accts.push({ uid, ok: false, truncated: true, transactionError: "timeout", readReason: "time_limit", transactions: [] });
            continue;
          }
          try {
            /* Reparto dentro del banco: una cuenta no puede comerse el margen de las demás. */
            const accountMs = Math.max(1000, Math.floor(remainingMs / remainingAccounts));
            const tx = await fetchBankTransactions(jwt, uid, dateFrom, ebApi, accountMs, true);
            const all = tx.transactions.map(mapTransaction);
            accts.push({ uid, iban: ac.iban || null, name: ac.name || null, ok: true, count: all.length,
              transactions: all, truncated: tx.truncated, transactionError: tx.transactionError, readReason: tx.readReason, failureCode: tx.failureCode });
          } catch (err) {
            logObReadFailure(admin, user.id, link.aspsp_name, err);
            /* Código cerrado y seguro: explica si fue espera, límite o permiso sin devolver el
               texto del proveedor, que puede contener referencias bancarias. */
            const code = obReadFailureCode(err);
            accts.push({ uid, iban: ac.iban || null, ok: false, error: code, failureCode: code, readReason: code === "timeout" ? "time_limit" : code === "page_limit" ? "page_limit" : code === "invalid_response" ? "invalid_response" : "provider_error", transactions: [] });
          }
        }
        await logObHistoryResult(admin, user.id, link.aspsp_name, dateFrom, accts, Date.now() - startedAt);
        return { aspsp: link.aspsp_name, iban: link.iban, ok: accts.some(a => a.ok), accounts: accts };
      };
      /* Cola ESTRICTA: dos bancos a la vez dispararon el propio 429 en Caixa y Sabadell. Una
         búsqueda puede seleccionar varios, pero nunca abre dos sesiones PSD2 simultáneas. */
      const activeLinks = links || [];
      const hist: unknown[] = [];
      for (const link of activeLinks) hist.push(await readHistoryLink(link));
      for (const link of deadLinks) {
        hist.push({ aspsp: link.aspsp_name, ok: false, pending: link.status === "pending",
          expired: link.status === "expired", noacct: link.status === "error", accounts: [] });
      }
      return jsonResp({ ok: true, history: true, dateFrom, links: hist });
    }

    // RESILIENCIA (bug Sabadell): cada banco se sincroniza por separado dentro de su try/catch.
    // Si UNO falla (sesión caducada, banco caído, rate-limit PSD2…) NO tumba a los demás: la app
    // sigue recibiendo los que sí funcionaron y un aviso del que falló. Antes, un solo fallo
    // lanzaba 500 y obligaba a "resincronizar" todo.
    const out: unknown[] = [];
    // deno-lint-ignore no-explicit-any
    const reads: any[] = [];
    for (const link of links || []) {
      // MULTI-CUENTA: recorre TODAS las cuentas del banco (columna `accounts`); si no la hay
      // (enlaces antiguos), cae a la única `account_uid`. Cada cuenta va en su try/catch para
      // que el fallo de una (o el banco caído) no tumbe a las demás.
      // deno-lint-ignore no-explicit-any
      const acctList: any[] = (Array.isArray(link.accounts) && link.accounts.length)
        ? link.accounts
        : (link.account_uid ? [{ uid: link.account_uid, iban: link.iban, name: null, currency: null }] : []);
      if (!acctList.length) {
        await sameLinkVersion(admin.from("bank_links")
          .update({ status: "expired", updated_at: new Date().toISOString() })
          .eq("id", link.id), link);
        out.push({ aspsp: link.aspsp_name, iban: link.iban, ok: false, expired: true, error: "cuenta sin uid · reconecta", balances: [], count: 0, transactions: [], accounts: [] });
        continue;
      }
      // Aquí solo se hace la lectura de siempre: saldo y ventana reciente, igual que antes de
      // existir el tramo antiguo. El tramo va más abajo, cuando TODOS los bancos tienen ya la
      // suya, y nada de lo que le pase puede cambiar este resultado.
      /* El acuse va ANTES del plan: lo que el cliente confirma tener es desde donde se sigue.
         La clave es el nombre del banco, único por usuario (`bank_links_user_aspsp_idx`),
         y dentro va la clave del enlace: un acuse de otro enlace o de antes de reconectar
         no vale (`ackLinkKey`).
         El filtro por `id` es lo único que separa esta escritura de los enlaces de los
         demás: `admin` salta RLS.
         Solo se da por aplicado si la escritura no devolvió error (supabase-js no lanza: lo
         entrega en `error`). Si falla, el plan sigue desde el cursor que hay de verdad en
         la BD y el cliente repite el acuse en la siguiente pulsación: es un instante
         absoluto y repetirlo no hace daño. */
      const linkKey = ackLinkKey(link.id, link.state_issued_at);
      const acked = acks ? ackCursor(acks[link.aspsp_name], linkKey, link.last_sync, new Date()) : null;
      if (acked) {
        let written = false;
        try {
          const q = sameLinkVersion(admin.from("bank_links").update({ last_sync: acked, updated_at: new Date().toISOString() }).eq("id", link.id), link);
          // `lt` no casa con null: un enlace recién conectado necesita su propio filtro.
          const { data, error } = await (link.last_sync ? q.lt("last_sync", acked) : q.is("last_sync", null)).select("id");
          written = !error && Array.isArray(data) && data.length > 0;
        } catch (_) { /* corte de red: igual que un error devuelto */ }
        if (written) link.last_sync = acked;
      }
      const plan = demandPlan(new Date(), link.last_sync, recoverGaps);
      /* Llamadas a /transactions por cuenta, contadas al PEDIR: una que falla también le
         cuesta cupo al banco. El tramo antiguo (`hard`) no puede pasar del tope; la ventana
         se deja como estaba. */
      const used: Record<string, number> = {};
      const counted = (uid: string, hard: boolean) => async (jwtArg: string, path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}) => {
        if (hard && (used[uid] || 0) >= OB_DEMAND_MAX_PAGES) throw new Error("transactions_budget");
        used[uid] = (used[uid] || 0) + 1;
        return await ebApi(jwtArg, path, init);
      };
      // deno-lint-ignore no-explicit-any
      const acctOut: any[] = [];
      let anyAcctOk = false, anyBalanceOk = false, anyExpired = false, lastErr = "";
      let auth401: unknown = null, authSession = "NO_CONSULTADA";
      for (const ac of acctList) {
        const uid = ac?.uid;
        if (!uid || typeof uid !== "string") continue;
        const accountDeadline = Math.min(deadline, Date.now() + 15000);
        if (Date.now() >= accountDeadline) {
          lastErr = "timeout";
          acctOut.push({ uid, iban: ac.iban || null, ok: false, truncated: true, transactionError: "timeout", readReason: "time_limit", balances: [], count: 0, transactions: [] });
          continue;
        }
        // H2: el saldo no puede consumir los 15 s y dejar sin intento al extracto.
        // 5 s es una reserva conservadora, no un óptimo medido. Las llamadas siguen en serie.
        const row: any = { uid, iban: ac.iban || null, name: ac.name || null, currency: ac.currency || null,
          ok: false, balanceOk: false, balances: [], count: 0, transactions: [] };
        const failed = (err: unknown) => {
          const fail = ebFailure(err);
          if (fail.sessionEnded) anyExpired = true;
          else if (fail.status === 401 && !auth401) auth401 = err;
          lastErr = obReadFailureCode(err);
          return fail;
        };
        const balController = new AbortController();
        const balTimer = setTimeout(() => balController.abort(), Math.min(5000, accountDeadline - Date.now()));
        let balanceFailure: ReturnType<typeof ebFailure> | null = null;
        try {
          const bal = await ebApi(jwt, `/accounts/${uid}/balances`, { signal: balController.signal });
          // Ausente, vacío y mal formado nunca se convierten en un cero bancario válido.
          if (!Array.isArray(bal?.balances) || !bal.balances.length || bal.balances.some((b: any) =>
            !["string", "number"].includes(typeof b?.balance_amount?.amount) || String(b.balance_amount.amount).trim() === "" || !Number.isFinite(Number(b.balance_amount.amount)))) throw new Error("transactions_invalid");
          row.balances = bal.balances.map((b: any) => ({ type: b.balance_type || b.name || "",
            amount: Number(b.balance_amount.amount), currency: b.balance_amount.currency || "" }));
          row.balanceOk = true;
          row.balanceAt = new Date().toISOString();
          anyBalanceOk = true;
        } catch (err) {
          balanceFailure = failed(err);
          row.balanceError = balController.signal.aborted ? "timeout" : obReadFailureCode(err);
        } finally { clearTimeout(balTimer); }
        // Una autorización cerrada/401 no se usa para otra llamada. Los fallos transitorios
        // del saldo sí dejan consultar movimientos con el tiempo restante de ESTA cuenta.
        if (balanceFailure && (balanceFailure.sessionEnded || balanceFailure.status === 401)) {
          row.transactionError = row.balanceError;
        } else try {
          const tx = await fetchBankTransactions(jwt, uid, plan.windowStart, counted(uid, false), accountDeadline - Date.now());
          row.transactions = (tx.transactions || []).map(mapTransaction);
          row.count = row.transactions.length;
          row.ok = true;
          row.truncated = tx.truncated;
          row.transactionError = tx.transactionError;
          row.readReason = tx.readReason;
          row.failureCode = tx.failureCode;
          anyAcctOk = true;
        } catch (err) {
          failed(err);
          row.transactionError = obReadFailureCode(err);
        }
        if (!row.ok) row.error = row.transactionError;
        acctOut.push(row);
      }
      /* 401 SIN CÓDIGO DE CIERRE Y NINGUNA CUENTA LEÍDA (revisión del 13/10). Puede ser un
         fallo de la aplicación o una sesión muerta que el proveedor nombra de otra forma;
         dejarlo en «error técnico» mantenía el banco activo para siempre, sin ofrecer
         reconectar. Se pregunta por la sesión UNA vez por enlace, no por cuenta. Si alguna
         cuenta respondió, la sesión vive y no hay nada que preguntar. Sin respuesta clara
         no se caduca: ver `ebSessionVerdict`. */
      if (auth401 && !anyAcctOk && !anyExpired) {
        let sessionId: string | null = null;
        try { sessionId = await decryptSessionId(link.session_id || null); } catch (_) { /* sin clave: como sin id */ }
        const verdict = await ebSessionVerdict(jwt, sessionId, ebApi, Math.min(8000, deadline - 5000 - Date.now()));
        authSession = verdict.state;
        if (verdict.ended) { anyExpired = true; auth401 = null; }
      }
      // Solo una sesión terminada caduca el permiso; el resto conserva el enlace activo.
      // Fuera del catch de autenticación: un fallo antes de la primera página también tiene causa.
      acctOut.forEach((a) => {
        if (a.ok === false && !a.readReason) {
          const code = obReadFailureCode(a.error || a.transactionError);
          a.failureCode = code;
          a.readReason = code === "timeout" ? "time_limit" : code === "page_limit" ? "page_limit" : code === "invalid_response" ? "invalid_response" : "provider_error";
        }
      });
      /* last_sync es del ENLACE y dice hasta dónde está leído en TODAS sus cuentas. Sin tramo
         pendiente sube a «ahora» en cuanto todas respondieron. Con una cuenta caída o un
         error a media paginación no sube (ese trozo quedaría fuera de la próxima petición),
         y con tramo pendiente lo mueve solo el propio tramo, más abajo: ni el cliente que
         no lo pide ni una lectura reciente a medias pueden quemarlo.
         La excepción es la ventana que NO CABE en los topes del lector (12 llamadas o
         2000 filas): ahí no hay sitio para el tramo ni lo habrá en la pulsación
         siguiente, así que esperar dejaría el cursor quieto para siempre. Sube a
         «ahora», haya hueco o no, que es lo que hacía antes de existir el tramo. Un
         corte por otra causa (el banco repite el cursor de página) no es desbordar.
         Con cliente de acuse ese «ahora» no se escribe: viaja en `ack`. Si esta respuesta no
         llega, la siguiente pulsación parte del cursor de antes y vuelve a pedirlo todo. */
      const allBalances = acctOut.length === acctList.length && acctOut.every((a) => a.balanceOk);
      // El móvil antiguo pierde saldos si solo actualiza la hermana sana. Retiene el banco
      // entero y repite la ventana; sin capacidad H2 no se acusa una vista conservadora.
      const legacyHold = !phaseClient && !allBalances;
      const allRead = !legacyHold && acctOut.length === acctList.length && acctOut.length > 0 && acctOut.every((a) => a.ok && !a.transactionError);
      const overflow = allRead && acctOut.some((a) => a.truncated && ((used[a.uid] || 0) >= OB_DEMAND_MAX_PAGES || a.count >= 2000));
      const wantOld = recoverGaps && plan.gap && !overflow;
      const nowIso = new Date().toISOString();
      const toNow = allRead && (!plan.gap || overflow);
      /* ENLACE SIN CURSOR Y CLIENTE DE ACUSE (revisión del 12/10). Esperar al acuse dejaba el
         cursor en null, y un null no es «desde aquí»: es «solo la ventana de hoy». El punto de
         partida vivía entonces únicamente en el acuse del móvil que pulsó; si la siguiente
         pulsación llegaba desde OTRO dispositivo (o el mismo tras reinstalar) con la ventana
         ya corrida, lo de en medio no se pedía nunca. Medido: primera lectura hace 60 días en
         un móvil, siguiente hoy en otro → 206 de 370 movimientos sin pedir.
         No se escribe «ahora», que es lo que hacía la versión sin acuse: eso daría por
         entregada una respuesta que puede no llegar. Se escribe la VÍSPERA de la ventana,
         sellada: no afirma que nadie tenga ninguna fila, solo desde qué día hay que seguir
         leyendo. Si la respuesta llega, el acuse lo adelanta a «ahora» como siempre; si no
         llega, el tramo entero sigue pendiente para cualquier dispositivo.
         `is null`: si otro móvil lo escribió entretanto, manda el suyo.
         LA ESCRITURA PUEDE FALLAR Y HAY QUE MIRARLO (revisión final del 12/10): supabase-js no
         lanza, entrega `error`. Ignorarlo dejaba el enlace en null con el acuse ya entregado,
         que es justo el caso de arriba: el punto de partida solo en un móvil. Se reintenta una
         vez. Si tampoco entra, el `ack` SE ENTREGA IGUAL, a propósito: medido con el banco
         sintético (primera pulsación hace 60 días con la escritura caída, siguiente hoy),
         callarlo pierde los 206 de 370 pulse quien pulse hoy; entregarlo los pierde solo si
         hoy pulsa antes OTRO dispositivo, porque el móvil que lo guarda lo devuelve y el
         enlace, que sigue en null, lo acepta. Con la BD caída dos veces seguidas no hay
         donde apuntar el punto de partida: ese acuse es lo único que queda de él. */
      if (acks && !link.last_sync && acctOut.some((a) => a.ok)) {
        for (let i = 0, written = false; i < 2 && !written; i++) {
          try {
            const { error } = await sameLinkVersion(admin.from("bank_links").update({ last_sync: chunkCursor(ymdAddDays(plan.windowStart, -1)) })
              .eq("id", link.id).is("last_sync", null), link);
            written = !error;
          } catch (_) { /* corte de red: como un error devuelto */ }
        }
      }
      const statusUpdate = admin.from("bank_links")
        .update(anyAcctOk
          ? { ...(toNow && !acks ? { last_sync: nowIso } : {}), status: "active", updated_at: nowIso }
          : { status: anyExpired ? "expired" : link.status, updated_at: nowIso })
        .eq("id", link.id);
      await sameLinkVersion(statusUpdate, link);
      // top-level (balances/transactions/count) = primera cuenta OK: retrocompat con la Capa 2/3 antigua.
      const primary = acctOut.find((a) => a.ok) || acctOut[0] || { balances: [], transactions: [], count: 0 };
      // deno-lint-ignore no-explicit-any
      const entry: any = {
        aspsp: link.aspsp_name, iban: link.iban, ok: anyAcctOk || anyBalanceOk, expired: !anyAcctOk && anyExpired,
        error: anyAcctOk || anyBalanceOk ? undefined : lastErr,
        balances: primary.balances, count: primary.count, transactions: primary.transactions,
        /* `syncFrom` es el día más antiguo que esta respuesta puede traer: el cliente nuevo
           acepta desde ahí. Va unos días por debajo del primer día pedido (`demandFloor`).
           `balanceAt` es cuándo se leyó el saldo, que ya no coincide con last_sync mientras
           el tramo va a medias. `ack` es el cursor que el cliente devolverá. */
        syncFrom: demandFloor(plan.windowStart), gapBeyondCap: plan.gapBeyondCap, gapPending: wantOld,
        accountPhases: phaseClient ? 1 : undefined,
        balanceAt: allBalances ? nowIso : undefined,
        ack: acks && toNow ? ackToken(nowIso, linkKey) : undefined,
        accounts: acctOut,
      };
      out.push(entry);
      reads.push({ link, linkKey, plan, used, counted, entry, primary, accounts: acctOut, asked: plan.windowStart,
        auth401: anyExpired ? null : auth401, authSession, legacyHold,
        // El tramo solo se empieza con lo reciente ENTERO en todas las cuentas: gastar
        // llamadas en una mientras otra no avanza no movería el cursor.
        ready: !legacyHold && acctOut.length === acctList.length && wantOld && demandReadComplete(acctOut) });
    }

    /* TRAMO ANTIGUO (INC-2709-06). Va aparte y al final, en su propio try: un 429, un 400 o
       un 401 aquí solo significan que el cursor no avanza. Se recorre por TROZOS DE FECHAS
       (date_from y date_to), del más antiguo al más nuevo, y un trozo solo cuenta si TODAS
       las cuentas lo paginaron hasta el final: así da igual en qué orden pagine el banco y
       un día nunca queda partido. El primer trozo es un solo día, con todas las llamadas
       libres: si ese día cabe, la pulsación avanza seguro. */
    const gapDeadline = deadline - 5000;
    // deno-lint-ignore no-explicit-any
    const readChunk = async (r: any, from: string, to: string): Promise<any[][] | null> => {
      // deno-lint-ignore no-explicit-any
      const rows: any[][] = [];
      for (const a of r.accounts) {
        const free = OB_DEMAND_MAX_PAGES - (r.used[a.uid] || 0);
        const ms = Math.min(15000, gapDeadline - Date.now());
        if (free < 1 || ms <= 0) { r.entry.readReason = free < 1 ? "page_limit" : "time_limit"; return null; }
        const tx = await fetchBankTransactions(jwt, a.uid, from, r.counted(a.uid, true), ms, false, free, to);
        if (tx.truncated || tx.transactionError) { r.entry.readReason = tx.readReason || "provider_error"; r.entry.failureCode = tx.failureCode; return null; }
        rows.push(tx.transactions || []);
      }
      return rows;
    };
    for (const r of reads) {
      if (!r.ready) continue;
      const p = r.plan;
      // deno-lint-ignore no-explicit-any
      const old: any[][] = r.accounts.map(() => []);
      // deno-lint-ignore no-explicit-any
      const keep = (rows: any[][]) => rows.forEach((x, i) => old[i].push(...x));
      const spent = () => Math.max(...r.accounts.map((a: { uid: string }) => r.used[a.uid] || 0));
      let sealed: string | null = null, day = p.from;
      try {
        let size = 1, pages = 0, days = 0;
        while (day <= p.to) {
          const end = ymdAddDays(day, size - 1);
          const to = end < p.to ? end : p.to;
          const before = spent();
          const rows = await readChunk(r, day, to);
          if (!rows) break;
          keep(rows);
          sealed = to;
          pages += Math.max(1, spent() - before);
          days += ymdSpan(day, to);
          // Cortesía tras el primer día: lo que el banco contabilizó tarde justo antes del
          // último sync real. Si no cabe se pierde solo eso, nunca el avance.
          if (day === p.from && p.overlapFrom) {
            r.asked = p.overlapFrom;
            const late = await readChunk(r, p.overlapFrom, ymdAddDays(p.from, -1));
            if (late) keep(late);
          }
          day = ymdAddDays(to, 1);
          size = nextChunkDays(size, pages, days, OB_DEMAND_MAX_PAGES - spent());
        }
      } catch (err) {
        // Se conserva solo lo sellado; el motivo del corte no puede desaparecer del aviso/log.
        r.entry.failureCode = obReadFailureCode(err);
        r.entry.readReason = r.entry.failureCode === "timeout" ? "time_limit" : r.entry.failureCode === "page_limit" ? "page_limit" : r.entry.failureCode === "invalid_response" ? "invalid_response" : "provider_error";
      }
      // deno-lint-ignore no-explicit-any
      r.accounts.forEach((a: any, i: number) => {
        if (!old[i].length) return;
        a.transactions = old[i].map(mapTransaction).concat(a.transactions);
        a.count = a.transactions.length;
      });
      r.entry.transactions = r.primary.transactions;
      r.entry.count = r.primary.count;
      if (sealed && r.asked > p.from) r.asked = p.from;
      r.entry.syncFrom = demandFloor(r.asked);
      try {
        const stamp = new Date().toISOString();
        if (day > p.to) {
          if (acks) r.entry.ack = ackToken(stamp, r.linkKey);
          else await sameLinkVersion(admin.from("bank_links").update({ last_sync: stamp, updated_at: stamp }).eq("id", r.link.id), r.link);
          r.entry.gapPending = false;
        } else if (sealed) {
          if (acks) r.entry.ack = ackToken(chunkCursor(sealed), r.linkKey);
          // `lt`: otro móvil pudo terminar mientras tanto. El cursor nunca retrocede.
          else await sameLinkVersion(admin.from("bank_links").update({ last_sync: chunkCursor(sealed), updated_at: stamp })
            .eq("id", r.link.id).lt("last_sync", chunkCursor(sealed)), r.link);
        }
      } catch (_) { /* sin cursor nuevo la próxima pulsación repite el trozo: no se pierde nada */ }
    }
    for (const r of reads) {
      // deno-lint-ignore no-explicit-any
      const accts: any[] = r.accounts;
      const readCount = accts.reduce((n, a) => n + (typeof a?.count === "number" ? a.count : (a?.transactions || []).length), 0);
      const readTruncated = !!r.entry.readReason || accts.some((a) => !!(a && (a.truncated || a.transactionError)));
      const readFailed = accts.filter((a) => a && a.ok === false).length;
      const readPartial = !accts.length || readFailed > 0 || readTruncated;
      const readStatus = readPartial ? (readCount ? "partial" : "error") : (readCount ? "ok" : "empty");
      const pages = Object.values(r.used as Record<string, number>).reduce((n, x) => n + x, 0);
      const { reasons, failureCodes } = obReadLogDetails([r.entry, ...accts]);
      await logObDemandResult(admin, user.id, r.link.aspsp_name, r.asked, readStatus, accts.length, readCount, pages, readTruncated, r.plan.gapBeyondCap, !!r.entry.gapPending, reasons, failureCodes);
      // Aquí, con todos los bancos ya leídos: apuntarlo en el bucle de cuentas retrasaba las siguientes.
      if (r.auth401) await logObAuthFailure(admin, user.id, r.link.aspsp_name, r.auth401, r.authSession);
      if (!phaseClient) {
        if (r.legacyHold) { r.entry.ok = false; r.entry.error = "balance_unavailable"; delete r.entry.ack; }
        // El legado usa ok tanto para saldos como para movimientos; un saldo válido sigue
        // aplicándose cuando falla la primera página, que conserva transactionError.
        r.accounts.forEach((a: any) => { a.ok = a.balanceOk === true; });
      }
    }

    // Enlaces caducados/rotos: van en la respuesta SIN llamar a Enable Banking (fallaría igual).
    // La app así conserva sus saldos en el patrimonio (marcados rancios) y puede avisar «reconecta».
    for (const link of deadLinks) {
      out.push({
        aspsp: link.aspsp_name, iban: link.iban, ok: false, skipped: true,
        expired: link.status === "expired", noacct: link.status === "error",
        pending: link.status === "pending",
        error: "enlace " + link.status + " · reconecta",
        balances: [], count: 0, transactions: [], accounts: [],
      });
    }

    const anyOk = out.some((l) => (l as { ok?: boolean }).ok);
    return jsonResp({ ok: true, dryRun: true, anyOk, links: out });
  } catch (e) {
    return jsonResp({ ok: false, error: String((e as Error)?.message || e) }, 500);
  }
}));
