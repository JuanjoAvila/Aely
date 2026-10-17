// SEC-02: handlers y limitador reales; solo se doblan SDK, RPC y banco.
// Entrada propia registrada en steps y en el recorte de servidor.
import assert from "node:assert/strict";
import fs from "node:fs";
import { requestBodyPrelude } from "./helpers/request-body.mjs";
import vm from "node:vm";
import { webcrypto, createHash } from "node:crypto";
import { transformSync } from "esbuild";

const root = new URL("../", import.meta.url);
const paths = ["bank-connect/index.ts", "bank-sync/index.ts", "bank-callback/index.ts", "_shared/ratelimit.ts", "_shared/cors.ts", "_shared/entrada.ts", "bank-sync/demand-window.ts", "bank-callback/reconnect.ts"];
const source = Object.fromEntries(paths.map(p => [p, fs.readFileSync(new URL("supabase/functions/" + p, root), "utf8")]));
const compile = s => transformSync(s.replace(/^import .*;\r?\n/gm, "").replace(/^export /gm, ""), { loader: "ts", format: "cjs" }).code;
const plain = x => JSON.parse(JSON.stringify(x));
// Modelo de la sentencia UPSERT de 0019. No acredita Postgres vivo: la PK y el
// contador se simulan aquí; el test sí atraviesa rateLimit y sus argumentos reales.
function counter() {
  return { now: Date.parse("2026-10-17T12:00:00Z"), rows: new Map(), calls: [],
    async rpc(name, args) {
      this.calls.push({ name, args: plain(args) });
      assert.equal(name, "check_rate_limit");
      let row = this.rows.get(args.p_bucket);
      if (!row || row.start < this.now - args.p_window_secs * 1000) row = { start: this.now, hits: 0 };
      row.hits++; this.rows.set(args.p_bucket, row);
      return { data: row.hits <= args.p_limit, error: null };
    } };
}
function handler(name, opts = {}, sources = source) {
  const sim = opts.sim || counter(), calls = { auth: 0, reads: 0, writes: [], bank: [], logs: [], sign: 0 };
  let serve;
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [sim.now])); } static now() { return sim.now; } }
  const link = { id: "fixture-link", user_id: opts.user || "fixture-user", state: "fixture-state" + (opts.app ? ".app" : ""), state_issued_at: new Clock(sim.now - (opts.expired ? 1800001 : 1000)).toISOString(), aspsp_name: "Fixture Bank", status: "active", session_id: "fixture-session", accounts: [{ uid: "fixture-account" }], last_sync: new Clock().toISOString() };
  const original = plain(link);
  const db = {
    auth: { getUser: async () => { calls.auth++; return { data: { user: opts.noUser ? null : { id: link.user_id } } }; } },
    async rpc(name, args) {
      if (opts.rpcMode) {
        sim.calls.push({ name, args: plain(args) });
        if (opts.rpcMode === "throw") throw Error("fixture-private-error");
        if (opts.rpcMode === "error") return { error: { code: "42P01", message: "fixture-private-error" } };
        if (opts.rpcMode === "deny") return { data: false, error: null };
      }
      return sim.rpc(name, args);
    },
    from(table) {
      const q = {}, filters = []; let op = "read", patch;
      for (const method of ["select", "in", "lt", "order", "limit"]) q[method] = () => q;
      q.eq = (k, v) => { filters.push([k, v]); return q; }; q.is = q.eq;
      for (const method of ["update", "upsert", "insert", "delete"]) q[method] = value => { op = method; patch = value; return q; };
      const result = () => {
        const matches = filters.every(([k, v]) => link[k] === v);
        if (op === "read") calls.reads++;
        else { calls.writes.push({ table, op, patch: plain(patch) }); if (table === "bank_links" && op === "update" && matches) Object.assign(link, patch); }
        return { data: table === "bank_links" ? (name === "bank-callback" ? matches && !opts.unknown ? plain(link) : null : [plain(link)]) : [], error: null };
      };
      q.maybeSingle = async () => result(); q.then = (yes, no) => Promise.resolve(result()).then(yes, no); return q;
    },
  };
  const context = vm.createContext({ Deno: { serve: f => serve = f, env: { get: k => ({ SUPABASE_URL: "https://db.invalid", SUPABASE_ANON_KEY: "fixture-anon", SUPABASE_SERVICE_ROLE_KEY: "fixture-service", APP_URL: "https://app.invalid/" })[k] } },
    createClient: () => db, Request, Response, Headers, URL, TextEncoder, TextDecoder, crypto: webcrypto, Date: Clock, AbortController, setTimeout, clearTimeout,
    console: { error: (...a) => calls.logs.push(a) }, fetch() { throw Error("TRANSPORTE NO SIMULADO"); },
    jsonResp: (x, status = 200) => new Response(JSON.stringify(x), { status }),
    ebConfig: () => ({}), makeJWT: async () => { calls.sign++; return "fixture-jwt"; },
    ebApi: async (jwt, path) => { calls.bank.push(path); return path === "/auth" ? { url: "https://bank.invalid/" } : path === "/sessions" ? { session_id: "fixture-new", accounts: [{ uid: "fixture-account" }] } : { balances: [] }; },
    fetchBankTransactions: async () => { calls.bank.push("/transactions"); return { transactions: [], truncated: false }; }, mapTransaction: x => x,
    encryptSessionId: async x => x, decryptSessionId: async x => x,
    ebFailure: () => ({ status: 500, sessionEnded: false }), ebSessionVerdict: async () => ({ state: "UNKNOWN", ended: false }),
  }, { codeGeneration: { strings: false, wasm: false } });
  vm.runInContext(requestBodyPrelude, context, { filename: "request_body.ts" });
  const files = ["_shared/ratelimit.ts", "_shared/cors.ts", "_shared/entrada.ts", ...(name === "bank-sync" ? ["bank-sync/demand-window.ts"] : name === "bank-callback" ? ["bank-callback/reconnect.ts"] : []), name + "/index.ts"];
  for (const p of files) {
    assert.ok(!/\bimport\s*\(/.test(sources[p]), "sin import dinámico ni red");
    vm.runInContext(compile(sources[p]), context, { filename: p, timeout: 2000 });
  }
  return { calls, link, original, sim, async request(extra = {}) {
    const headers = { Authorization: "Bearer fixture", Origin: "https://localhost", "Content-Type": "application/json", "x-forwarded-for": extra.ip || "192.0.2.1" };
    const method = extra.method || (name === "bank-callback" ? "GET" : "POST");
    const url = name === "bank-callback" ? "https://edge.invalid/?code=fixture-code&state=" + encodeURIComponent(extra.state || original.state) : "https://edge.invalid/";
    return serve(new Request(url, { method, headers, ...(["GET", "HEAD", "OPTIONS"].includes(method) ? {} : { body: JSON.stringify(extra.body || {}) }) }));
  } };
}
function noEffects(h, before = 0) { assert.equal(h.calls.bank.length, 0); assert.equal(h.calls.writes.length, before); assert.equal(h.calls.sign, 0); assert.deepEqual(h.link, h.original); }
async function denied(name, sources = source, opts = {}) {
  const h = handler(name, { rpcMode: "deny", ...opts }, sources), r = await h.request();
  assert.equal(r.status, name === "bank-callback" ? 302 : 429);
  noEffects(h); assert.equal(h.calls.reads, 0); assert.equal(h.calls.logs.length, 0);
  if (name === "bank-callback") assert.equal(r.headers.get("location"), opts.app ? "https://app.invalid/back.html?msg=error" : "https://app.invalid/?bank=error&msg=error");
  else { assert.deepEqual(await r.json(), { ok: false, error: "rate_limit" }); assert.equal(r.headers.get("Access-Control-Allow-Origin"), "https://localhost"); }
}
let groups = 0;
async function test(name, run) { await run(); groups++; console.log("  ✓ SEC-02 " + name); }
async function connectQuota(sources = source) {
  const sim = counter(), h = handler("bank-connect", { sim }, sources);
  const statuses = await Promise.all(Array.from({ length: 20 }, async (_, i) => (await h.request({ body: { aspsp_name: "Fixture " + i } })).status));
  assert.equal(statuses.filter(x => x === 200).length, 10); assert.equal(statuses.filter(x => x === 429).length, 10); assert.equal(h.calls.bank.length, 10); assert.equal(h.calls.writes.length, 10);
  assert.ok(sim.calls.every(x => JSON.stringify(x.args) === JSON.stringify({ p_bucket: "bank-connect:fixture-user", p_limit: 10, p_window_secs: 600 })));
  assert.equal((await handler("bank-connect", { sim, user: "fixture-other" }, sources).request()).status, 200);
  sim.now += 600000; assert.equal((await h.request()).status, 429, "0019 reinicia DESPUÉS del límite estricto");
  sim.now++; assert.equal((await h.request()).status, 200);
}
async function syncQuota(sources = source) {
  const sim = counter();
  for (let i = 0; i < 30; i++) {
    const h = handler("bank-sync", { sim }, sources), r = await h.request({ body: i % 2 ? { dateFrom: "2026-10-01", aspsps: ["Fixture Bank"] } : { recoverGaps: true, acks: {} } });
    assert.equal(r.status, 200); assert.ok(h.calls.bank.length);
  }
  for (const body of [{}, { dateFrom: "2026-10-01" }, { recoverGaps: true, acks: { "Fixture Bank": "fixture-ack" } }]) {
    const h = handler("bank-sync", { sim }, sources); assert.equal((await h.request({ body })).status, 429); noEffects(h); assert.equal(h.calls.reads, 0);
  }
  assert.ok(sim.calls.every(x => JSON.stringify(x.args) === JSON.stringify({ p_bucket: "bank-sync:fixture-user", p_limit: 30, p_window_secs: 600 })));
  assert.equal((await handler("bank-sync", { sim, user: "fixture-other" }, sources).request()).status, 200);
  sim.now += 600001; assert.equal((await handler("bank-sync", { sim }, sources).request()).status, 200);
}
async function callbackQuota(sources = source) {
  const sim = counter();
  for (let i = 0; i < 10; i++) { const h = handler("bank-callback", { sim }, sources); assert.equal((await h.request()).headers.get("location"), "https://app.invalid/?bank=ok"); }
  const h = handler("bank-callback", { sim }, sources); const r = await h.request(); assert.equal(r.status, 302); assert.equal(r.headers.get("location"), "https://app.invalid/?bank=error&msg=error"); noEffects(h); assert.equal(h.calls.reads, 1); assert.equal(h.calls.logs.length, 0);
  const userCalls = sim.calls.filter(x => x.args.p_bucket === "bank-callback:fixture-user"); assert.equal(userCalls.length, 11); assert.ok(userCalls.every(x => x.args.p_limit === 10 && x.args.p_window_secs === 600));
  const other = handler("bank-callback", { sim, user: "fixture-other" }, sources); assert.equal((await other.request()).headers.get("location"), "https://app.invalid/?bank=ok");
  sim.now += 600001; const fresh = handler("bank-callback", { sim }, sources); assert.equal((await fresh.request()).headers.get("location"), "https://app.invalid/?bank=ok");
}
async function ipQuota(sources = source) {
  const sim = counter();
  for (let i = 0; i < 60; i++) await handler("bank-callback", { sim, unknown: true }, sources).request();
  const h = handler("bank-callback", { sim, app: true }, sources); const r = await h.request(); assert.equal(r.headers.get("location"), "https://app.invalid/back.html?msg=error"); noEffects(h); assert.equal(h.calls.reads, 0);
  const digest = createHash("sha256").update("192.0.2.1").digest("hex").slice(0, 32);
  assert.equal(sim.calls.length, 61); assert.ok(sim.calls.every(x => x.args.p_bucket === "bank-callback-ip:" + digest && x.args.p_limit === 60 && x.args.p_window_secs === 60));
  const different = handler("bank-callback", { sim }, sources); assert.equal((await different.request({ ip: "192.0.2.2" })).headers.get("location"), "https://app.invalid/?bank=ok");
  sim.now += 60001; assert.equal((await handler("bank-callback", { sim }, sources).request()).headers.get("location"), "https://app.invalid/?bank=ok");
}
await test("denegación antes de efectos, CORS y retorno web/APK", async () => { for (const name of ["bank-connect", "bank-sync", "bank-callback"]) await denied(name); await denied("bank-callback", source, { app: true }); });
await test("connect: concurrencia20, corte10, usuario y ventana exactos", () => connectQuota());
await test("sync:30 compartidas entre diario/histórico/acuse, sin cursor al denegar", () => syncQuota());
await test("callback: cuota de usuario conserva state y estado del enlace", () => callbackQuota());
await test("callback: IP hasheada60/60 limita antes de consultar state", () => ipQuota());
await test("sin sesión y preflight no consumen cuota ni escriben", async () => {
  for (const name of ["bank-connect", "bank-sync"]) {
    const h = handler(name, { noUser: true }); assert.equal((await h.request()).status, 401); assert.equal(h.sim.calls.length, 0); noEffects(h);
    const p = handler(name); assert.equal((await p.request({ method: "OPTIONS" })).status, 200); assert.equal(p.sim.calls.length + p.calls.auth, 0); noEffects(p);
  }
});
await test("callback: state desconocido/caducado no consume cuota de usuario", async () => {
  for (const opts of [{ unknown: true }, { expired: true }]) { const h = handler("bank-callback", opts); await h.request(); assert.equal(h.sim.calls.length, 1); assert.ok(h.sim.calls[0].args.p_bucket.startsWith("bank-callback-ip:")); assert.equal(h.calls.bank.length, 0); assert.deepEqual(h.link, h.original); }
});
await test("fallo RPC conserva fail-open y log cerrado con helper real", async () => {
  for (const name of ["bank-connect", "bank-sync", "bank-callback"]) for (const rpcMode of ["error", "throw"]) {
    const h = handler(name, { rpcMode }); const r = await h.request(); assert.equal(r.status, name === "bank-callback" ? 302 : 200); assert.ok(h.calls.bank.length); assert.ok(h.calls.logs.length); assert.ok(!JSON.stringify(h.calls.logs).includes("fixture-private-error"));
  }
});
const mutations = [
  ["connect ignora denegación", "bank-connect/index.ts", "if (!gate.ok)", "if (false)", s => denied("bank-connect", s)],
  ["sync ignora denegación", "bank-sync/index.ts", "if (!gate.ok)", "if (false)", s => denied("bank-sync", s)],
  ["callback ignora IP", "bank-callback/index.ts", "if (!ipGate.ok)", "if (false)", ipQuota],
  ["callback ignora usuario", "bank-callback/index.ts", "if (!userGate.ok)", "if (false)", callbackQuota],
  ["connect sube límite", "bank-connect/index.ts", "user.id, 10, 600", "user.id, 11, 600", connectQuota],
  ["sync sube límite", "bank-sync/index.ts", "user.id, 30, 600", "user.id, 31, 600", syncQuota],
  ["callback sube límite", "bank-callback/index.ts", "link.user_id, 10, 600", "link.user_id, 11, 600", callbackQuota],
  ["IP sube límite", "bank-callback/index.ts", "ipBucket, 60, 60", "ipBucket, 61, 60", ipQuota],
  ["connect mezcla usuarios", "bank-connect/index.ts", '"bank-connect:" + user.id', '"bank-connect:shared"', connectQuota],
  ["sync cambia ventana", "bank-sync/index.ts", "user.id, 30, 600", "user.id, 30, 60", syncQuota],
  ["callback consume state al limitar", "bank-callback/index.ts", "if (!userGate.ok) return callbackRateLimited(fromApp);", 'if (!userGate.ok) { await admin.from("bank_links").update({ state: null }).eq("id", link.id); return callbackRateLimited(fromApp); }', callbackQuota],
  ["callback devuelve429", "bank-callback/index.ts", ': Response.redirect(`${APP_URL}?bank=error&msg=${encodeURIComponent(msg)}`, 302);', ': new Response("limit", { status: 429 });', s => denied("bank-callback", s)],
];
await test("12 mutantes causales rechazados por los mismos oráculos", async () => {
  for (const [name, p, from, to, oracle] of mutations) {
    assert.equal(source[p].split(from).length, 2, "ancla única: " + name);
    await assert.rejects(() => oracle({ ...source, [p]: source[p].replace(from, to) }), { name: "AssertionError" }, name);
  }
});
console.log("bank-rate-contracts: " + groups + " grupos PASS, " + mutations.length + " mutantes muertos; SQL y proveedor simulados");
