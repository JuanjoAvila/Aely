// deno-lint-ignore-file no-explicit-any
import { assert, assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { fetchBankTransactions, mapTransaction } from "../_shared/enablebanking.ts";
import { currentDemandWindowStart, ymdAddDays } from "./demand-window.ts";

const movement = (id: string) => ({ entry_reference: id, booking_date: "2026-10-01",
  transaction_amount: { amount: "12.50" }, credit_debit_indicator: "DBIT", status: "BOOK" });

// El espía cuenta al entrar al transporte, también si rechaza. No usa el contador
// del lector ni inspecciona su implementación: el mismo oráculo debe fallar en la base.
function attemptSpy(reply: (url: URL, n: number, init: any) => any) {
  const calls: URL[] = [];
  return { calls, api: async (_jwt: string, path: string, init: any = {}) => {
    const url = new URL(path, "https://provider.invalid");
    calls.push(url);
    return await reply(url, calls.length, init);
  } };
}

Deno.test("F3 lector causal: el fallback inicial comparte doce intentos", async () => {
  const spy = attemptSpy((_url, n) => {
    if (n === 1) throw new Error("EB 422 WRONG_TRANSACTIONS_PERIOD");
    return { transactions: [movement("tx-" + n)], continuation_key: "page-" + n };
  });
  const result = await fetchBankTransactions("synthetic", "account-a", "2026-09-01", spy.api);
  assertEquals(spy.calls.length, 12, "el rechazo inicial también consume una llamada");
  assertEquals(result.transactions, Array.from({ length: 11 }, (_, i) => movement("tx-" + (i + 2))));
  assertEquals(result.truncated, true);
  assertEquals(result.readReason, "page_limit");
  assertEquals(spy.calls[0].searchParams.has("strategy"), false);
  assert(spy.calls.slice(1).every((u) => u.searchParams.get("strategy") === "longest"));
});

for (const cap of [1, 2, 3]) {
  Deno.test("F3 lector: fallback respeta maxPages=" + cap, async () => {
    const spy = attemptSpy((_url, n) => {
      if (n === 1) throw new Error("EB 422 WRONG_TRANSACTIONS_PERIOD");
      return { transactions: [movement("tx-" + n)], continuation_key: "page-" + n };
    });
    const result = await fetchBankTransactions("synthetic", "account-a", "2026-09-01", spy.api, 1000, false, cap);
    assertEquals(spy.calls.length, cap);
    assertEquals(result.transactions.length, cap - 1);
    assertEquals(result.truncated, true);
    assertEquals(result.readReason, "page_limit");
  });
}

Deno.test("F3 lector: doce éxitos sin fallback conservan filas y céntimos", async () => {
  const spy = attemptSpy((_url, n) => ({ transactions: [movement("tx-" + n)], continuation_key: "page-" + n }));
  const result = await fetchBankTransactions("synthetic", "account-a", null, spy.api);
  assertEquals(spy.calls.length, 12);
  assertEquals(result.transactions.map(mapTransaction).map((t) => [t.ext_id, Math.round(t.amount * 100)]),
    Array.from({ length: 12 }, (_, i) => ["tx-" + (i + 1), 1250]));
  assertEquals(result.readReason, "page_limit");
});

Deno.test("F3 lector: fallback terminado y página vacía no pierden la continuación", async () => {
  const spy = attemptSpy((_url, n) => {
    if (n === 1) throw new Error("EB 422 WRONG_TRANSACTIONS_PERIOD");
    return n === 2 ? { transactions: [], continuation_key: "next +/=" } : { transactions: [movement("last")] };
  });
  const result = await fetchBankTransactions("synthetic", "account-a", "2026-09-01", spy.api);
  assertEquals(spy.calls.length, 3);
  assertEquals(spy.calls[2].searchParams.get("continuation_key"), "next +/=");
  assertEquals(result.transactions, [movement("last")]);
  assertEquals(result.truncated, false);
});

Deno.test("F3 lector: primer error no recuperable no reintenta", async () => {
  for (const message of ["EB 401 UNAUTHORIZED_ACCESS", "EB 503", "transactions_invalid"]) {
    const spy = attemptSpy(() => { throw new Error(message); });
    await assertRejects(() => fetchBankTransactions("synthetic", "account-a", "2026-09-01", spy.api), Error, message);
    assertEquals(spy.calls.length, 1);
  }
});

Deno.test("F3 lector: error posterior conserva filas y clase de fallo", async () => {
  const spy = attemptSpy((_url, n) => {
    if (n === 1) return { transactions: [movement("kept")], continuation_key: "next" };
    throw new Error("EB 503");
  });
  const result = await fetchBankTransactions("synthetic", "account-a", null, spy.api);
  assertEquals(spy.calls.length, 2);
  assertEquals(result.transactions, [movement("kept")]);
  assertEquals(result.truncated, true);
  assertEquals(result.readReason, "provider_error");
  assertEquals(result.failureCode, "eb_503");
});

Deno.test("F3 lector: timeout y cursor repetido mantienen sus motivos", async () => {
  const slow = attemptSpy((_url, n, init) => n === 1
    ? { transactions: [movement("kept")], continuation_key: "slow" }
    : new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new Error("abort")), { once: true })));
  const timed = await fetchBankTransactions("synthetic", "account-a", null, slow.api, 15);
  assertEquals(slow.calls.length, 2);
  assertEquals(timed.transactions, [movement("kept")]);
  assertEquals(timed.transactionError, "timeout");
  assertEquals(timed.readReason, "time_limit");
  const repeated = attemptSpy(() => ({ transactions: [movement("loop")], continuation_key: "loop" }));
  const cycle = await fetchBankTransactions("synthetic", "account-a", null, repeated.api);
  assertEquals(repeated.calls.length, 2);
  assertEquals(cycle.transactionError, "continuation_repeated");
  assertEquals(cycle.readReason, "repeated_cursor");
});

Deno.test("F3 lector: tope de dos mil filas y longest inicial conservados", async () => {
  const spy = attemptSpy(() => ({ transactions: Array.from({ length: 2001 }, (_, i) => movement("row-" + i)) }));
  const result = await fetchBankTransactions("synthetic", "account-a", "2026-09-01", spy.api, 1000, true);
  assertEquals(spy.calls.length, 1);
  assertEquals(spy.calls[0].searchParams.get("strategy"), "longest");
  assertEquals(result.transactions.length, 2000);
  assertEquals(result.readReason, "row_limit");
});

type Handler = (req: Request) => Promise<Response>;
let handler: Handler;
let pem: string;

async function loadHandler() {
  if (handler) return handler;
  const sourceURL = new URL("./index.ts", import.meta.url);
  // Solo cambia la resolución de imports para sustituir el SDK. El cuerpo real del
  // handler, lector, mapeo, fechas, CORS y rateLimit se ejecutan sin reescrituras.
  const sdk = "data:application/typescript," + encodeURIComponent(
    "export const createClient = (..._args: unknown[]): any => (globalThis as any).__f3SyntheticDB;");
  const source = (await Deno.readTextFile(sourceURL)).replace(/from "([^"]+)"/g, (_all, specifier) =>
    "from " + JSON.stringify(specifier.startsWith(".") ? new URL(specifier, sourceURL).href : sdk));
  const oldServe = Deno.serve;
  try {
    Deno.serve = ((fn: Handler) => { handler = fn; return {}; }) as any;
    await import("data:application/typescript," + encodeURIComponent("// @ts-nocheck\n" + source));
  } finally { Deno.serve = oldServe; }
  assert(handler, "el handler real debe registrarse sin abrir un puerto");
  return handler;
}

async function sync(reply: (url: URL, ordinal: number) => any, options: { gap?: boolean; accounts?: string[]; body?: any } = {}) {
  if (!pem) {
    const key = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
    const raw = new Uint8Array(await crypto.subtle.exportKey("pkcs8", key.privateKey));
    pem = btoa(String.fromCharCode(...raw));
  }
  const calls: URL[] = [], counts: Record<string, number> = {}, writes: any[] = [], events: any[] = [];
  const link: any = { id: "synthetic-link", user_id: "synthetic-user", aspsp_name: "CaixaBank", status: "active",
    session_id: "synthetic-session", state_issued_at: "2026-09-01T00:00:00.000Z",
    last_sync: options.gap ? ymdAddDays(currentDemandWindowStart(new Date()), -5) + "T23:59:59.999Z" : new Date().toISOString(),
    accounts: (options.accounts || ["account-a"]).map((uid) => ({ uid })) };
  const originalCursor = link.last_sync;
  const db = { auth: { getUser: async () => ({ data: { user: { id: "synthetic-user" } } }) },
    rpc: async (name: string) => { assertEquals(name, "check_rate_limit"); return { data: true, error: null }; },
    from: (table: string) => {
      let patch: any, inserted: any;
      const filters: any[] = [];
      const q: any = {
        select: () => q, in: (k: string, v: any) => { filters.push(["in", k, v]); return q; },
        eq: (k: string, v: any) => { filters.push(["eq", k, v]); return q; },
        is: (k: string, v: any) => { filters.push(["is", k, v]); return q; },
        lt: (k: string, v: any) => { filters.push(["lt", k, v]); return q; },
        update: (value: any) => { patch = value; return q; },
        insert: (value: any) => { inserted = value; return q; },
        then: (ok: any, fail: any) => Promise.resolve().then(() => {
          if (table === "app_events") { events.push(inserted); return { data: null, error: null }; }
          assertEquals(table, "bank_links");
          if (!patch) {
            assert(filters.some((f) => f[0] === "eq" && f[1] === "user_id" && f[2] === link.user_id));
            return { data: [structuredClone(link)], error: null };
          }
          assert(filters.some((f) => f[1] === "id" && f[2] === link.id), "ninguna escritura sin enlace propio");
          assert(filters.some((f) => f[1] === "session_id" && f[2] === link.session_id));
          assert(filters.some((f) => f[1] === "state_issued_at" && f[2] === link.state_issued_at));
          writes.push({ patch, filters });
          const matches = filters.every(([op, k, v]) => op === "lt" ? link[k] < v : op === "is" ? (link[k] ?? null) === v : link[k] === v);
          if (matches) Object.assign(link, patch);
          return { data: matches ? [{ id: link.id }] : [], error: null };
        }).then(ok, fail),
      };
      return q;
    } };
  const env: Record<string, string> = { EB_APP_ID: "synthetic", EB_PRIVATE_KEY: pem,
    SUPABASE_URL: "https://db.invalid", SUPABASE_ANON_KEY: "synthetic", SUPABASE_SERVICE_ROLE_KEY: "synthetic" };
  const oldGet = Deno.env.get, oldFetch = globalThis.fetch;
  (globalThis as any).__f3SyntheticDB = db;
  try {
    Deno.env.get = (key: string) => env[key];
    globalThis.fetch = async (input: any) => {
      const url = new URL(String(input));
      assertEquals(url.origin, "https://api.enablebanking.com", "ninguna red/URL ajena al doble");
      if (url.pathname.endsWith("/balances")) return Response.json({ balances: [{ balance_amount: { amount: "100.00", currency: "EUR" } }] });
      assert(url.pathname.endsWith("/transactions"));
      const uid = decodeURIComponent(url.pathname.split("/")[2]);
      calls.push(url); counts[uid] = (counts[uid] || 0) + 1;
      const result = await reply(url, counts[uid]);
      if (result instanceof Response) return result;
      return Response.json(result);
    };
    const run = await loadHandler();
    const response = await run(new Request("https://app.invalid/bank-sync", { method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "synthetic" },
      body: JSON.stringify(options.body || { recoverGaps: true, acks: {}, accountPhases: 1 }) }));
    assertEquals(response.status, 200);
    const data = await response.json();
    assertEquals(data.ok, true);
    return { data, calls, counts, writes, events, originalCursor, link };
  } finally {
    Deno.env.get = oldGet; globalThis.fetch = oldFetch;
    delete (globalThis as any).__f3SyntheticDB;
  }
}

Deno.test("F3 handler causal: fallback no hace trece llamadas por cuenta", async () => {
  const result = await sync((_url, n) => n === 1
    ? Response.json({ error: "WRONG_TRANSACTIONS_PERIOD" }, { status: 422 })
    : { transactions: [movement("tx-" + n)], continuation_key: "page-" + n }, { gap: true, accounts: ["account-a", "account-b"] });
  assertEquals(result.counts, { "account-a": 12, "account-b": 12 }, "presupuesto independiente por cuenta");
  const bank = result.data.links[0];
  for (const account of bank.accounts) {
    assertEquals(account.count, 11);
    assertEquals(account.transactions.map((t: any) => [t.ext_id, Math.round(t.amount * 100)]),
      Array.from({ length: 11 }, (_, i) => ["tx-" + (i + 2), 1250]));
    assertEquals(account.truncated, true);
    assertEquals(account.readReason, "page_limit");
  }
  // Desbordar conserva la política previa: el acuse viaja al móvil; no se adelanta BD.
  assertEquals(bank.gapPending, false);
  assert(typeof bank.ack === "string");
  assertEquals(result.link.last_sync, result.originalCursor);
  assert(result.writes.every((w) => !("last_sync" in w.patch)));
  assertEquals(JSON.parse(result.events.at(-1).detail).pages, result.calls.length);
});

Deno.test("F3 handler: ventana y gap comparten doce intentos con fallback en el gap", async () => {
  const result = await sync((url, n) => {
    if (!url.searchParams.has("date_to")) return { transactions: [movement("recent-" + n)],
      ...(n < 10 ? { continuation_key: "recent-" + n } : {}) };
    if (url.searchParams.get("strategy") !== "longest") return Response.json({ error: "WRONG_TRANSACTIONS_PERIOD" }, { status: 422 });
    return { transactions: [movement("unsealed")], continuation_key: "more-old" };
  }, { gap: true });
  assertEquals(result.counts["account-a"], 12);
  assertEquals(result.calls.filter((u) => u.searchParams.has("date_to")).length, 2);
  const bank = result.data.links[0];
  assertEquals(bank.accounts[0].count, 10, "un tramo incompleto no entrega filas sin sellar");
  assertEquals(bank.gapPending, true);
  assertEquals(bank.readReason, "page_limit");
  assertEquals(bank.ack, undefined);
  assertEquals(result.link.last_sync, result.originalCursor);
});

Deno.test("F3 handler: éxito normal conserva céntimos y aislamiento de cuentas", async () => {
  const result = await sync((_url, n) => ({ transactions: [movement("normal-" + n)],
    ...(n === 1 ? { continuation_key: "last" } : {}) }), { accounts: ["account-a", "account-b"] });
  assertEquals(result.counts, { "account-a": 2, "account-b": 2 });
  for (const account of result.data.links[0].accounts) {
    assertEquals(account.count, 2);
    assertEquals(account.transactions.map((t: any) => Math.round(t.amount * 100)), [1250, 1250]);
    assertEquals(account.truncated, false);
  }
  assert(typeof result.data.links[0].ack === "string");
  assertEquals(result.link.last_sync, result.originalCursor);
});

Deno.test("F3 handler: error no recuperable no acusa ni pierde el saldo", async () => {
  const result = await sync(() => Response.json({ error: "ASPSP_ERROR" }, { status: 503 }));
  assertEquals(result.counts["account-a"], 1);
  const bank = result.data.links[0], account = bank.accounts[0];
  assertEquals(account.balanceOk, true);
  assertEquals(account.transactionError, "eb_503");
  assertEquals(account.count, 0);
  assertEquals(bank.ack, undefined);
  assertEquals(result.link.last_sync, result.originalCursor);
});
