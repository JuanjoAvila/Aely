// ============================================================
// Edge Function: bank-sync  (verify_jwt = true)
// La llama la app (usuario logueado). Trae SALDO + MOVIMIENTOS de los bancos
// enlazados del usuario.
//
// El sync actualiza el estado del enlace; el histórico es de solo lectura.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ebApi, ebConfig, jsonResp, makeJWT, mapTransaction, fetchBankTransactions } from "../_shared/enablebanking.ts";
import { withCors } from "../_shared/cors.ts";
import { OB_DEMAND_MAX_PAGES, demandReadComplete, demandSyncFrom, ymdAddDays } from "./demand-window.ts";

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
  if (/transactions_invalid/i.test(msg)) return "invalid_response";
  return "unavailable";
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
      detail: JSON.stringify({ status, accounts: (accounts || []).length, count, partial, elapsedMs: Math.max(0, Math.round(elapsedMs)), dateFrom }),
      app_version: "edge", platform: "server",
    });
  } catch (_) { /* diagnóstico best-effort: nunca cambia el resultado bancario */ }
}

// Sync a demanda: mismos conteos que el histórico, sin uid, IBAN, importes ni comercios.
// La fecha mínima es la pedida al banco, no la de un movimiento.
function newestBookingDay(rows: Array<{ booking_date?: string; value_date?: string }> | null): string | null {
  let best: string | null = null;
  for (const t of rows || []) {
    const d = String(t?.booking_date || t?.value_date || "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && (!best || d > best)) best = d;
  }
  return best;
}

// deno-lint-ignore no-explicit-any
async function logObDemandResult(admin: any, userId: string, aspsp: string, dateFrom: string, status: string, accounts: number, count: number, pages: number, truncated: boolean, capped: boolean) {
  try {
    await admin.from("app_events").insert({
      user_id: userId, email: null, kind: "performance",
      message: `OB sync (${obLogBank(aspsp)}): ${status}`,
      detail: JSON.stringify({ status, accounts, count, pages, truncated, dateFrom, capped }),
      app_version: "edge", platform: "server",
    });
  } catch (_) { /* diagnóstico best-effort: nunca cambia el resultado bancario */ }
}

Deno.serve(withCors(async (req: Request) => {
  // El límite por cuenta no basta: muchas cuentas lentas podrían agotar la Edge y perder
  // también las respuestas buenas. Se reserva margen para devolverlas y cerrar la petición.
  const deadline = Date.now() + 60000;
  try {
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
    const body = await req.json().catch(() => ({}));
    const dateFrom = (typeof body?.dateFrom === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.dateFrom))
      ? body.dateFrom : null;
    // Campo distinto de dateFrom a propósito: dateFrom abre el histórico de solo lectura
    // (no toca saldos). Un cliente nuevo contra una función vieja manda esto y la vieja lo
    // ignora; una función nueva contra un cliente viejo no lo ve y no ensancha.
    const recoverGaps = body?.recoverGaps === true;
    const hasAspspFilter = Array.isArray(body?.aspsps);
    const wantedAspsps = hasAspspFilter
      ? body.aspsps.map((x: unknown) => String(x || "").trim().toLowerCase()).filter(Boolean).slice(0, 12)
      : [];

    // OJO (bug CaixaBank 2026-07-11): también se devuelven los enlaces caducados/rotos, marcados
    // ok:false. Antes solo venían los 'active' → un banco caducado desaparecía del sync, la app
    // reconstruía obAccounts sin él y sus cuentas se ESFUMABAN del patrimonio sin ningún aviso.
    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
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
            accts.push({ uid, ok: false, truncated: true, transactionError: "timeout", transactions: [] });
            continue;
          }
          try {
            /* Reparto dentro del banco: una cuenta no puede comerse el margen de las demás. */
            const accountMs = Math.max(1000, Math.floor(remainingMs / remainingAccounts));
            const tx = await fetchBankTransactions(jwt, uid, dateFrom, ebApi, accountMs, true);
            const all = tx.transactions.map(mapTransaction);
            accts.push({ uid, iban: ac.iban || null, name: ac.name || null, ok: true, count: all.length,
              transactions: all, truncated: tx.truncated, transactionError: tx.transactionError });
          } catch (err) {
            logObReadFailure(admin, user.id, link.aspsp_name, err);
            /* Código cerrado y seguro: explica si fue espera, límite o permiso sin devolver el
               texto del proveedor, que puede contener referencias bancarias. */
            accts.push({ uid, iban: ac.iban || null, ok: false, error: obReadFailureCode(err), transactions: [] });
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
    for (const link of links || []) {
      // MULTI-CUENTA: recorre TODAS las cuentas del banco (columna `accounts`); si no la hay
      // (enlaces antiguos), cae a la única `account_uid`. Cada cuenta va en su try/catch para
      // que el fallo de una (o el banco caído) no tumbe a las demás.
      // deno-lint-ignore no-explicit-any
      const acctList: any[] = (Array.isArray(link.accounts) && link.accounts.length)
        ? link.accounts
        : (link.account_uid ? [{ uid: link.account_uid, iban: link.iban, name: null, currency: null }] : []);
      if (!acctList.length) {
        await admin.from("bank_links")
          .update({ status: "expired", updated_at: new Date().toISOString() })
          .eq("id", link.id);
        out.push({ aspsp: link.aspsp_name, iban: link.iban, ok: false, expired: true, error: "cuenta sin uid · reconecta", balances: [], count: 0, transactions: [], accounts: [] });
        continue;
      }
      // Primero la ventana de siempre, completa. El tramo antiguo va después y
      // comparte el tope de 12 llamadas: si la ventana ya lo gasta, no se empieza
      // el hueco y last_sync no avanza. Sin recoverGaps no se ensancha.
      const demanded = demandSyncFrom(new Date(), link.last_sync, recoverGaps);
      const windowStart = demanded.windowStart;
      const wantOld = recoverGaps && demanded.gap && demanded.from < windowStart;
      const recentFrom = wantOld ? demanded.from : windowStart;
      let pages = 0;
      let recentAllOk = true;
      let oldAllDone = true;
      let cursorBlocked = false;
      let partialCursor: string | null = null;
      const countingApi = async (jwtArg: string, path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}) => {
        const data = await ebApi(jwtArg, path, init);
        if (String(path).includes("/transactions")) pages++;
        return data;
      };
      // deno-lint-ignore no-explicit-any
      const acctOut: any[] = [];
      let anyAcctOk = false, anyExpired = false, lastErr = "";
      for (const ac of acctList) {
        const uid = ac?.uid;
        if (!uid || typeof uid !== "string") continue;
        const accountDeadline = Math.min(deadline, Date.now() + 15000);
        if (Date.now() >= accountDeadline) {
          lastErr = "timeout";
          acctOut.push({ uid, iban: ac.iban || null, ok: false, truncated: true, transactionError: "timeout", balances: [], count: 0, transactions: [] });
          continue;
        }
        const balController = new AbortController();
        const balTimer = setTimeout(() => balController.abort(), accountDeadline - Date.now());
        try {
          const bal = await ebApi(jwt, `/accounts/${uid}/balances`, {signal:balController.signal});
          // La ventana de siempre va primero. Lo reciente no puede quedar peor que
          // un sync de hoy aunque detrás haya un hueco de meses.
          const beforeRecent = pages;
          const recentTx = await fetchBankTransactions(jwt, uid, windowStart, countingApi, accountDeadline - Date.now(), false, OB_DEMAND_MAX_PAGES);
          const usedRecent = pages - beforeRecent;
          // deno-lint-ignore no-explicit-any
          let raw: any[] = recentTx.transactions || [];
          let truncated = !!recentTx.truncated;
          let transactionError = recentTx.transactionError;
          const recentOk = !recentTx.truncated && !recentTx.transactionError;
          if (!recentOk) recentAllOk = false;
          if (wantOld) {
            const remain = OB_DEMAND_MAX_PAGES - usedRecent;
            if (recentOk && remain > 0) {
              const oldTx = await fetchBankTransactions(jwt, uid, demanded.from, countingApi, accountDeadline - Date.now(), false, remain, ymdAddDays(windowStart, -1));
              const oldRows = oldTx.transactions || [];
              raw = oldRows.concat(raw);
              if (oldTx.truncated || oldTx.transactionError) {
                truncated = true;
                transactionError = transactionError || oldTx.transactionError;
                oldAllDone = false;
                const newest = newestBookingDay(oldRows);
                if (!newest) cursorBlocked = true;
                else if (!cursorBlocked && (!partialCursor || newest < partialCursor)) partialCursor = newest;
              }
            } else {
              truncated = true;
              oldAllDone = false;
              cursorBlocked = true;
            }
          }
          // deno-lint-ignore no-explicit-any
          const balances = (bal.balances || []).map((b: any) => ({
            type: b.balance_type || b.name || "",
            amount: Number(b?.balance_amount?.amount || 0),
            currency: b?.balance_amount?.currency || "",
          }));
          // deno-lint-ignore no-explicit-any
          const transactions = raw.map((t: any) => mapTransaction(t));
          acctOut.push({ uid, iban: ac.iban || null, name: ac.name || null, currency: ac.currency || null, ok: true, balances,
            count: transactions.length, transactions, truncated, transactionError });
          anyAcctOk = true;
        } catch (err) {
          const msg = String((err as Error)?.message || err);
          // CADUCIDAD REAL vs FALLO TRANSITORIO (feedback 2026-07-17: «se me caen cada dos por
          // tres»). Antes CUALQUIER 403/404 marcaba el enlace 'expired' → reconectar a mano una y
          // otra vez. Pero un 403 de PSD2 casi siempre es rate-limit/anti-abuso momentáneo y un 404
          // un hipo del banco, NO que el consentimiento haya muerto. Igual que el 403 anti-bot de
          // MyInvestor y el 401 momentáneo de TR: NO desconectar por un fallo pasajero.
          // Solo cuenta como caducado el código inequívoco del proveedor. Buscar palabras como
          // "unauthorized" dentro de un 429/5xx podía convertir un bloqueo temporal en una
          // reconexión manual y dejar el enlace muerto para siempre hasta hacer OAuth otra vez.
          if (/\bEB\s+401\b/i.test(msg)) {
            anyExpired = true;
          }
          lastErr = msg;
          acctOut.push({ uid, iban: ac.iban || null, name: ac.name || null, currency: ac.currency || null, ok: false, error: msg, balances: [], count: 0, transactions: [] });
        } finally {
          clearTimeout(balTimer);
        }
      }
      const readCount = acctOut.reduce((n, a) => n + (typeof a?.count === "number" ? a.count : (a?.transactions || []).length), 0);
      const readTruncated = acctOut.some((a) => !!(a && (a.truncated || a.transactionError)));
      const readFailed = acctOut.filter((a) => a && a.ok === false).length;
      const readPartial = !acctOut.length || readFailed > 0 || readTruncated;
      const readStatus = readPartial ? (readCount ? "partial" : "error") : (readCount ? "ok" : "empty");
      await logObDemandResult(admin, user.id, link.aspsp_name, recentFrom, readStatus, acctOut.length, readCount, pages, readTruncated, demanded.gapBeyondCap);
      // Solo EB 401 firme caduca el permiso; 403/404/429/5xx conservan el enlace activo.
      // last_sync solo avanza con la lectura completa. Un corte o un 429 dejarían el
      // siguiente sync empezando después del hueco. Tampoco avanza si había hueco y el
      // cliente no pidió recuperarlo: la función nueva no puede quemar el cursor de un
      // móvil que todavía descarta lo anterior al margen.
      const readComplete = demandReadComplete(acctOut);
      const covered = readComplete && anyAcctOk && (!demanded.gap || recoverGaps) && (!wantOld || oldAllDone);
      // Tramo antiguo a medias: el cursor sube al día más nuevo que sí llegó, no a
      // hoy. La próxima pulsación sigue más adelante y la ventana reciente ya vino.
      const lastDay = typeof link.last_sync === "string" ? link.last_sync.slice(0, 10) : "";
      const partialSync = !covered && recoverGaps && demanded.gap && recentAllOk && anyAcctOk && !cursorBlocked && partialCursor && (!lastDay || partialCursor > lastDay)
        ? partialCursor + "T12:00:00.000Z" : null;
      if (covered || partialSync) {
        await admin.from("bank_links")
          .update({ last_sync: partialSync || new Date().toISOString(), status: "active", updated_at: new Date().toISOString() })
          .eq("id", link.id);
      } else if (anyAcctOk) {
        await admin.from("bank_links")
          .update({ status: "active", updated_at: new Date().toISOString() })
          .eq("id", link.id);
      } else {
        await admin.from("bank_links")
          .update({ status: anyExpired ? "expired" : link.status, updated_at: new Date().toISOString() })
          .eq("id", link.id);
      }
      // top-level (balances/transactions/count) = primera cuenta OK: retrocompat con la Capa 2/3 antigua.
      const primary = acctOut.find((a) => a.ok) || acctOut[0] || { balances: [], transactions: [], count: 0 };
      out.push({
        aspsp: link.aspsp_name, iban: link.iban, ok: anyAcctOk, expired: !anyAcctOk && anyExpired,
        error: anyAcctOk ? undefined : lastErr,
        balances: primary.balances, count: primary.count, transactions: primary.transactions,
        syncFrom: recentFrom, gapBeyondCap: demanded.gapBeyondCap,
        accounts: acctOut,
      });
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
