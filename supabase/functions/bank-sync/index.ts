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

// Diagnóstico del «Movimiento» sin comercio ni concepto que salía como ingreso siendo un gasto
// (feedback 2026-08-01, Trade Republic por Open Banking). `mapTransaction` solo tiene el
// `credit_debit_indicator` del banco para decidir el signo — si un ASPSP lo manda mal para
// ciertos movimientos, no hay forma de arreglarlo sin ver el payload real. Mejor registrar el
// caso (ambiguo, o TODO Trade Republic mientras se cierra el signo) que adivinar y arriesgarse a
// invertir un ingreso de verdad para otro banco que sí cumple la spec.
// ⚠ 2026-08-03: el usuario sigue viendo gastos de TR contados como ingresos tras el fix de abs()
// (commit anterior) — ese fix protege de un doble-signo, pero si el ASPSP manda el
// `credit_debit_indicator` YA MAL para ciertos movimientos (p.ej. los ligados a la tarjeta/cash
// de un bróker), abs() no lo arregla. En vez de adivinar OTRA VEZ sin datos (mismo error que costó
// 7 alphas en la saga TR-en-frío, ver memoria `tr-frio-saga`), esto registra el payload CRUDO de
// CUALQUIER movimiento de Trade Republic —tenga o no comercio/concepto— para diagnosticarlo con
// certeza en cuanto el usuario sincronice una vez más. Quitar el `siempreTR` cuando se cierre.
// deno-lint-ignore no-explicit-any
async function logObAmbiguous(admin: any, userId: string, aspsp: string, raw: any[]) {
  try {
    const siempreTR = /trade republic|traderepublic/i.test(String(aspsp || ""));
    // deno-lint-ignore no-explicit-any
    const sospechosos = (raw || []).filter((t: any) => {
      if (siempreTR) return true;
      const remit = Array.isArray(t?.remittance_information) ? t.remittance_information.join(" ") : (t?.remittance_information || "");
      const nombre = t?.debtor?.name || t?.creditor?.name || "";
      return !remit && !nombre;
    }).slice(0, 8);
    if (!sospechosos.length) return;
    // ⚠ 2026-08-03 (ronda 2): el diagnóstico anterior solo guardaba 6 campos curados y para TR
    // TODOS salían null salvo importe/signo/fecha — no bastaba para saber si `entry_reference`
    // existe (dedup), qué distingue un roundup/cashback de un gasto real, ni si un "ingreso" y un
    // "gasto" del mismo importe en días distintos son dos apuntes reales de TR (round-up/cashback
    // que entra en el saldo + ese mismo dinero auto-invertido) o un fallo nuestro. Para TR se manda
    // el objeto CRUDO tal cual lo da Enable Banking, sin filtrar ningún campo — una sola vez, hasta
    // cerrar esto con certeza (quitar cuando se cierre, igual que el `siempreTR` de arriba).
    const detail = siempreTR
      ? JSON.stringify(sospechosos)
      : JSON.stringify(sospechosos.map((t: any) => ({
          amt: t?.transaction_amount?.amount, ind: t?.credit_debit_indicator,
          code: t?.bank_transaction_code?.description || t?.bank_transaction_code || null, status: t?.status,
          remit: Array.isArray(t?.remittance_information) ? t.remittance_information.join(" ") : (t?.remittance_information || null),
          creditor: t?.creditor?.name || null, debtor: t?.debtor?.name || null,
          date: t?.booking_date || t?.value_date || null,
        })));
    await admin.from("app_events").insert({
      user_id: userId, email: null, kind: "error",
      message: `OB (${aspsp}): ${sospechosos.length} movimiento(s) — payload ${siempreTR ? "CRUDO completo" : "para revisar el signo"}`,
      detail: detail.slice(0, 8000),
      app_version: "edge", platform: "server",
    });
  } catch (_) { /* best-effort: nunca rompe el sync */ }
}

/* El cliente recibe un código estable, pero soporte necesita distinguir un 401 de un 503 sin
   guardar el texto crudo del proveedor: ese mensaje puede traer referencias o datos bancarios.
   Solo se conserva una clase cerrada y el banco; nunca uid de cuenta, URL ni payload. */
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
      message: `OB histórico (${String(aspsp || "banco").slice(0, 80)}): lectura no disponible`,
      detail: JSON.stringify({ code: obReadFailureCode(err) }),
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
    const links = (allLinks || []).filter((l) => l.status === "active");
    const deadLinks = (allLinks || []).filter((l) => l.status !== "active");

    const { appId, pem } = ebConfig();
    const jwt = await makeJWT(appId, pem);

    if (dateFrom) {
      /* Cada enlace tiene SU presupuesto y arranca a la vez. Antes los bancos iban en fila con
         un deadline común de 60 s: un Sabadell lento/429 podía gastarlo entero y Caixa quedaba
         marcada como timeout sin haber recibido ni una llamada. Paralelizar enlaces no añade
         sincronizaciones automáticas: sigue siendo una sola búsqueda pedida por la persona. */
      const readHistoryLink = async (link: any) => {
        /* Los bancos ya corren en paralelo, así que cada uno puede usar el presupuesto REAL de la
           petición sin volver a dejar al siguiente en cola. Los 15 s de la primera versión se
           dividían además entre las cuentas del enlace: una Caixa con dos cuentas recibía apenas
           7,5 s por cuenta y caía antes de terminar la primera página del histórico. Se reserva el
           mismo margen de 5 s para serializar y devolver todo lo que sí haya llegado. */
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
        return { aspsp: link.aspsp_name, iban: link.iban, ok: accts.some(a => a.ok), accounts: accts };
      };
      /* Dos bancos a la vez: uno lento ya no deja Caixa sin turno, pero tampoco abrimos todas
         las sesiones PSD2 de golpe. El Promise.all sin límite podía provocar el propio 429 que
         luego parecía una conexión caducada (feedback 16/9: miedo a sincronizar porque obliga a
         autorizar una y otra vez). */
      const activeLinks = links || [];
      const hist: unknown[] = new Array(activeLinks.length);
      let nextLink = 0;
      const worker = async () => {
        while (nextLink < activeLinks.length) {
          const i = nextLink++;
          hist[i] = await readHistoryLink(activeLinks[i]);
        }
      };
      await Promise.all(Array.from({ length: Math.min(2, activeLinks.length) }, () => worker()));
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
          const now = new Date();
          // Debe cubrir al menos `som` de importObExpenses (mes de Madrid menos 8 días).
          // En el borde de mes UTC puede pedir un mes adicional, pero nunca uno de menos.
          const recentFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 8 * 86400000).toISOString().slice(0, 10);
          const tx = await fetchBankTransactions(jwt, uid, recentFrom, ebApi, accountDeadline - Date.now());
          // deno-lint-ignore no-explicit-any
          const balances = (bal.balances || []).map((b: any) => ({
            type: b.balance_type || b.name || "",
            amount: Number(b?.balance_amount?.amount || 0),
            currency: b?.balance_amount?.currency || "",
          }));
          // deno-lint-ignore no-explicit-any
          const transactions = (tx.transactions || []).map((t: any) => mapTransaction(t));
          acctOut.push({ uid, iban: ac.iban || null, name: ac.name || null, currency: ac.currency || null, ok: true, balances,
            count: transactions.length, transactions, truncated: tx.truncated, transactionError: tx.transactionError });
          anyAcctOk = true;
          logObAmbiguous(admin, user.id, link.aspsp_name, tx.transactions || []);
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
      // Solo EB 401 firme caduca el permiso; 403/404/429/5xx conservan el enlace activo.
      if (anyAcctOk) {
        await admin.from("bank_links")
          .update({ last_sync: new Date().toISOString(), status: "active", updated_at: new Date().toISOString() })
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
