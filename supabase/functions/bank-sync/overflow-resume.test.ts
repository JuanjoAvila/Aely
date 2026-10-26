// deno-lint-ignore-file no-explicit-any
import { assert, assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { fetchBankTransactions, mapTransaction } from "../_shared/enablebanking.ts";
import { currentDemandWindowStart, ymdAddDays, chunkCursor, ackLinkKey, ackToken } from "./demand-window.ts";

// El cliente se carga desde SU fuente; no se reproduce su regla de sustitución/deduplicado.
async function realFlatten() {
  const bank = await Deno.readTextFile(new URL("../../../src/modules/08-motor-bank.js", import.meta.url));
  const core = await Deno.readTextFile(new URL("../../../src/modules/00-core.js", import.meta.url));
  const between = (s: string, a: string, b: string) => s.slice(s.indexOf(a), s.indexOf(b, s.indexOf(a)));
  return new Function('const ENT={caixabank:{label:"CaixaBank"}}; let _mcMadridYmdFmt;\n' +
    between(bank, "function entFromAspsp(", "/* Un ingreso previsto") +
    between(bank, "const obPendingResponses=", "/* Un único reparto") +
    between(bank, "function madridYmdParts(", "function closedMonthWindow(") +
    core.match(/^function obPolarity\(.*$/m)![0] + '\n' +
    core.match(/^function obReferenceKey\(.*$/m)![0] + '\n' +
    bank.match(/^function obIsPending\(.*$/m)![0] + '\nreturn flattenBankTx;')();
}

const today = () => new Date().toISOString().slice(0, 10);
const move = (uid: string, day: string, n = 0, noId = false) => ({
  ...(noId ? {} : { entry_reference: uid + ":" + day + ":" + n }), booking_date: day,
  transaction_amount: { amount: n ? "0.29" : "12.51" }, credit_debit_indicator: "DBIT",
  remittance_information: [noId ? "synthetic twins" : "synthetic " + uid + n], status: "BOOK",
});
function fixture(days = 14, accounts = ["account-a", "account-b"], twins = false) {
  const start = ymdAddDays(today(), 1 - days), rows: Record<string, any[]> = {};
  for (const uid of accounts) {
    rows[uid] = Array.from({ length: days }, (_, i) => move(uid, ymdAddDays(start, i)));
    if (twins) rows[uid].push(move(uid, start, 1, true), move(uid, start, 1, true));
  }
  const link: any = { id: "synthetic-link", user_id: "synthetic-user", aspsp_name: "CaixaBank", status: "active",
    session_id: "synthetic-session", state_issued_at: "2026-09-01T00:00:00.000Z",
    last_sync: chunkCursor(ymdAddDays(start, -1)), accounts: accounts.map((uid) => ({ uid })) };
  return { rows, start, link };
}
// Cada página tiene una fila, pero su orden alterna extremos: la fecha máxima de una
// página NO acredita cobertura. El espía del handler cuenta también los rechazos.
function provider(rows: Record<string, any[]>, fallback = false) {
  return (url: URL) => {
    if (fallback && url.searchParams.get("strategy") !== "longest")
      return Response.json({ error: "WRONG_TRANSACTIONS_PERIOD" }, { status: 422 });
    const uid = decodeURIComponent(url.pathname.split("/")[2]);
    const from = url.searchParams.get("date_from") || "0000", to = url.searchParams.get("date_to") || "9999";
    const filtered = rows[uid].filter((t) => t.booking_date >= from && t.booking_date <= to);
    const shuffled = filtered.filter((_, i) => i % 2 === 0).reverse().concat(filtered.filter((_, i) => i % 2));
    const page = Number(url.searchParams.get("continuation_key") || 0);
    return { transactions: shuffled.slice(page, page + 1),
      ...(page + 1 < shuffled.length ? { continuation_key: String(page + 1) } : {}) };
  };
}
const signature = (rows: any[]) => rows.map((t) => JSON.stringify([t.ent, t.acc, t.id, t.date,
  Math.round(t.amount * 100), t.merchant, t.note, t.status])).sort();

// El rechazo inicial no es una página leída. Doce páginas que terminan la ventana
// deben entregarse enteras también si costó un intento encontrar el periodo.
for (const rejection of [false, true]) Deno.test("PR315 contrato ventana entera " + (rejection ? "con rechazo" : "sin rechazo"), async () => {
  const result = await sync((url, attempt) => {
    if (rejection && attempt === 1) return Response.json({ error: "WRONG_TRANSACTIONS_PERIOD" }, { status: 422 });
    const page = attempt - (rejection ? 1 : 0), uid = decodeURIComponent(url.pathname.split("/")[2]);
    return { transactions: [move(uid, today(), page)], ...(page < 12 ? { continuation_key: "page-" + page } : {}) };
  }, { accounts: ["account-a", "account-b"] });
  assertEquals(result.counts, { "account-a": rejection ? 13 : 12, "account-b": rejection ? 13 : 12 });
  for (const account of result.data.links[0].accounts) {
    assertEquals(account.truncated, false, "ventana de doce páginas COMPLETA");
    assertEquals(account.transactions.map((t: any) => [t.ext_id, Math.round(t.amount * 100)]),
      Array.from({ length: 12 }, (_, i) => [account.uid + ":" + today() + ":" + (i + 1), 29]));
    assertEquals(account.transactions.reduce((n: number, t: any) => n + Math.round(t.amount * 100), 0), 348);
  }
  assertEquals(result.data.links[0].readReason, undefined);
});

for (const rejection of [false, true]) Deno.test("PR315 contrato techo real " + (rejection ? "con rechazo" : "sin rechazo"), async () => {
  let attempts = 0;
  const result = await fetchBankTransactions("synthetic", "account-a", today(), async () => {
    attempts++;
    if (rejection && attempts === 1) throw new Error("EB 422 WRONG_TRANSACTIONS_PERIOD");
    return { transactions: [move("account-a", today(), attempts)], continuation_key: "next-" + attempts };
  });
  assertEquals(attempts, rejection ? 13 : 12);
  assertEquals(result.transactions.length, 12);
  assertEquals(result.truncated, true);
  assertEquals(result.readReason, "page_limit");
});

Deno.test("PR315 contrato solo un rechazo inicial permite intento extra", async () => {
  for (const error of ["EB 422 WRONG_TRANSACTIONS_PERIOD", "EB 503", "EB 401 UNAUTHORIZED_ACCESS"]) {
    let calls = 0;
    await assertRejects(() => fetchBankTransactions("synthetic", "account-a", today(), async () => {
      calls++; throw new Error(error);
    }), Error, error);
    assertEquals(calls, error.includes("WRONG_TRANSACTIONS_PERIOD") ? 2 : 1);
  }
});

for (const correction of ["cents", "sign", "merchant", "pending", "removed"]) {
  Deno.test("R2 compatibilidad sustitución cliente real " + correction, async () => {
    const f = fixture(1, ["account-a"]), flatten = await realFlatten();
    const old = structuredClone(f.rows["account-a"][0]);
    if (correction === "pending") old.status = "PDNG";
    const before = flatten([{ aspsp: "CaixaBank", ok: true, accounts: [{ uid: "account-a", ok: true,
      transactions: [mapTransaction(old)] }] }], []);
    const current = f.rows["account-a"][0];
    if (correction === "cents") current.transaction_amount.amount = "12.52";
    if (correction === "sign") current.credit_debit_indicator = "CRDT";
    if (correction === "merchant") current.remittance_information = ["corrected synthetic merchant"];
    if (correction === "removed") f.rows["account-a"] = [];
    const result = await sync(provider(f.rows), { link: f.link });
    const actual = flatten(result.data.links, before);
    const expected = flatten([{ aspsp: "CaixaBank", ok: true, accounts: [{ uid: "account-a", ok: true,
      transactions: f.rows["account-a"].map(mapTransaction) }] }], []);
    assertEquals(signature(actual), signature(expected), "una respuesta completa debe reconciliar la vista anterior");
  });
}

type Handler = (req: Request) => Promise<Response>;
let handler: Handler;
let pem: string;

async function loadHandler() {
  if (handler) return handler;
  const sourceURL = new URL("./index.ts", import.meta.url);
  // Solo cambia la resolución de imports para sustituir el SDK. El cuerpo real del
  // handler, lector, mapeo, fechas, CORS y rateLimit se ejecutan sin reescrituras.
  const sdk = "data:application/typescript," + encodeURIComponent(
    "export const createClient = (..._args: unknown[]): any => (globalThis as any).__r2SyntheticDB;");
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

async function sync(reply: (url: URL, ordinal: number) => any, options: { gap?: boolean; accounts?: string[]; body?: any; link?: any; writeError?: boolean; authorized?: boolean; rateAllowed?: boolean } = {}) {
  if (!pem) {
    const key = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
    const raw = new Uint8Array(await crypto.subtle.exportKey("pkcs8", key.privateKey));
    pem = btoa(String.fromCharCode(...raw));
  }
  const calls: URL[] = [], counts: Record<string, number> = {}, writes: any[] = [], events: any[] = [];
  const link: any = options.link || { id: "synthetic-link", user_id: "synthetic-user", aspsp_name: "CaixaBank", status: "active",
    session_id: "synthetic-session", state_issued_at: "2026-09-01T00:00:00.000Z",
    last_sync: options.gap ? ymdAddDays(currentDemandWindowStart(new Date()), -5) + "T23:59:59.999Z" : new Date().toISOString(),
    accounts: (options.accounts || ["account-a"]).map((uid) => ({ uid })) };
  const originalCursor = link.last_sync;
  const generation = { session: link.session_id, issued: link.state_issued_at };
  const db = { auth: { getUser: async () => ({ data: { user: options.authorized === false ? null : { id: "synthetic-user" } } }) },
    rpc: async (name: string) => { assertEquals(name, "check_rate_limit"); return { data: options.rateAllowed !== false, error: null }; },
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
          assert(filters.some((f) => f[1] === "session_id" && f[2] === generation.session));
          assert(filters.some((f) => f[1] === "state_issued_at" && f[2] === generation.issued));
          writes.push({ patch, filters });
          const matches = filters.every(([op, k, v]) => op === "lt" ? link[k] < v : op === "is" ? (link[k] ?? null) === v : link[k] === v);
          if (options.writeError && patch.last_sync) return { data: null, error: { message: "synthetic-write-error" } };
          if (matches) Object.assign(link, patch);
          return { data: matches ? [{ id: link.id }] : [], error: null };
        }).then(ok, fail),
      };
      return q;
    } };
  const env: Record<string, string> = { EB_APP_ID: "synthetic", EB_PRIVATE_KEY: pem,
    SUPABASE_URL: "https://db.invalid", SUPABASE_ANON_KEY: "synthetic", SUPABASE_SERVICE_ROLE_KEY: "synthetic" };
  const oldGet = Deno.env.get, oldFetch = globalThis.fetch;
  (globalThis as any).__r2SyntheticDB = db;
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
    if (options.authorized === false || options.rateAllowed === false) return { data: await response.json(), status: response.status, calls, counts, writes, events, originalCursor, link };
    assertEquals(response.status, 200);
    const data = await response.json();
    assertEquals(data.ok, true);
    return { data, calls, counts, writes, events, originalCursor, link };
  } finally {
    Deno.env.get = oldGet; globalThis.fetch = oldFetch;
    delete (globalThis as any).__r2SyntheticDB;
  }
}
