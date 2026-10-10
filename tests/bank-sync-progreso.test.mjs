import assert from "node:assert/strict";
import fs from "node:fs";
import { transformSync } from "esbuild";

// Sonda del revisor (B1/R4) contra el handler real. Roja en e2e0512c: un banco que
// pagina de antiguo a nuevo se come las 12 páginas en el tramo viejo, deja fuera
// los días recientes y no mueve last_sync, así que la siguiente pulsación repite.
const root = new URL("../", import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), "utf8");
const shared = transformSync(read("supabase/functions/_shared/enablebanking.ts"), { loader: "ts", format: "esm" }).code;
const E = await import("data:text/javascript;base64," + Buffer.from(shared).toString("base64"));
const demandSrc = transformSync(read("supabase/functions/bank-sync/demand-window.ts"), { loader: "ts", format: "esm" }).code;
const demand = await import("data:text/javascript;base64," + Buffer.from(demandSrc).toString("base64"));
const src = demandSrc.replace(/^export /gm, "") + "\n" + transformSync(read("supabase/functions/bank-sync/index.ts").replace(/^import .*?;\r?\n/gm, ""), { loader: "ts" }).code;

const CAP = 12;

function addDay(ymd) {
  const p = ymd.split("-").map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2] + 1)).toISOString().slice(0, 10);
}
function span(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDay(d)) out.push(d);
  return out;
}

// 4 movimientos por día, páginas de 20, de antiguo a nuevo. El cursor es un índice
// dentro del filtro de ESA petición: cada fase (ventana / tramo) pagina sola.
function pagedBank() {
  const all = [];
  for (const d of span("2026-08-08", "2026-10-10")) {
    for (let i = 0; i < 4; i++) {
      all.push({
        entry_reference: d + "-" + i,
        booking_date: d,
        transaction_amount: { amount: "1.00" },
        credit_debit_indicator: "DBIT",
        creditor: { name: "Compra sintética" },
      });
    }
  }
  const cursors = new Map();
  let seq = 0;
  return (url) => {
    const from = url.searchParams.get("date_from");
    const to = url.searchParams.get("date_to");
    const cont = url.searchParams.get("continuation_key");
    const start = cont ? cursors.get(cont) : 0;
    const filtered = all.filter((t) => (!from || t.booking_date >= from) && (!to || t.booking_date <= to));
    const slice = filtered.slice(start, start + 20);
    let continuation_key = null;
    if (start + 20 < filtered.length) {
      continuation_key = "p" + (++seq);
      cursors.set(continuation_key, start + 20);
    }
    return { transactions: slice, continuation_key };
  };
}

function txUrls(calls) {
  return calls.filter((p) => p.includes("/transactions?")).map((p) => new URL(p, "https://bank.invalid"));
}

async function sync(links, reply, body, clock) {
  const calls = [], writes = [];
  let handler;
  const api = async (jwt, p) => {
    calls.push(p);
    if (p.endsWith("/balances")) return { balances: [{ balance_type: "ITAV", balance_amount: { amount: "100", currency: "EUR" } }] };
    return reply(new URL(p, "https://bank.invalid"));
  };
  const db = { auth: { getUser: async () => ({ data: { user: { id: "synthetic" } } }) }, from: () => ({
    select: () => ({ eq: () => ({ in: async () => ({ data: links }) }) }),
    update: (x) => ({ eq: async () => { writes.push(x); return {}; } }),
    insert: async () => ({}),
  }) };
  const names = ["Deno", "createClient", "ebApi", "ebConfig", "jsonResp", "makeJWT", "mapTransaction", "withCors", "fetchBankTransactions", "Date"];
  new Function(...names, src)(
    { serve: (f) => { handler = f; }, env: { get: () => "synthetic" } }, () => db, api, () => ({}),
    (x, status = 200) => new Response(JSON.stringify(x), { status }), async () => "jwt", E.mapTransaction, (f) => f,
    (jwt, uid, from, apiFn, timeout, preferLongest, maxPages, dateTo) => {
      return E.fetchBankTransactions(jwt, uid, from, apiFn, timeout, preferLongest, maxPages, dateTo);
    }, clock
  );
  const res = await handler(new Request("https://app.invalid", { method: "POST", body: JSON.stringify(body || {}) }));
  assert.equal(res.status, 200);
  return { data: await res.json(), calls, writes };
}

function clockAt(ms) {
  return class FakeDate extends Date {
    constructor(...args) { super(...(args.length ? args : [ms])); }
    static now() { return ms; }
  };
}

const MS = Date.parse("2026-10-10T12:00:00Z");
let failures = 0;
async function t(name, fn) {
  try { await fn(); console.log("  ✓ " + name); }
  catch (e) { failures++; console.error("  ✗ " + name + ": " + e.message); }
}

await t("el tope de llamadas por cuenta y pulsación está declarado", async () => {
  assert.equal(demand.OB_DEMAND_MAX_PAGES, CAP);
});

await t("B1 la ventana de siempre de esa cuenta cabe en 4 llamadas", async () => {
  const FakeDate = clockAt(MS);
  const caixa = { id: "CaixaBank", aspsp_name: "CaixaBank", status: "active", accounts: [{ uid: "cx" }] };
  const r = await sync([caixa], pagedBank(), { recoverGaps: true }, FakeDate);
  const urls = txUrls(r.calls);
  assert.equal(urls.length, 4);
  assert.ok(urls.every((u) => u.searchParams.get("date_from") === "2026-09-23"));
  assert.equal(r.data.links[0].accounts[0].truncated, false);
  const days = new Set(r.data.links[0].accounts[0].transactions.map((x) => x.date));
  for (const d of ["2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10"]) assert.equal(days.has(d), true, d);
});

await t("B1 un hueco de 60 días no puede dejar fuera lo reciente ni repetirse", async () => {
  const FakeDate = clockAt(MS);
  const caixa = { id: "CaixaBank", aspsp_name: "CaixaBank", status: "active", last_sync: "2026-08-11T09:00:00Z", accounts: [{ uid: "cx" }] };
  const first = await sync([caixa], pagedBank(), { recoverGaps: true }, FakeDate);
  const urls = txUrls(first.calls);
  assert.ok(urls.length <= CAP, "llamadas " + urls.length + " > tope " + CAP);
  assert.ok(urls.length < 12 * 3, "no triplica las llamadas de la ventana");
  const days = new Set(first.data.links[0].accounts[0].transactions.map((x) => x.date));
  for (const d of ["2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10"]) assert.equal(days.has(d), true, "falta " + d);
  assert.equal(urls.filter((u) => u.searchParams.get("date_from") === "2026-09-23").length, 4, "primero la ventana de siempre, completa");
  const oldFrom = urls.map((u) => u.searchParams.get("date_from")).find((d) => d && d < "2026-09-23");
  assert.equal(oldFrom, "2026-08-08");
  assert.equal(first.data.links[0].accounts[0].truncated, true);
  const moved = first.writes.find((w) => w.last_sync);
  assert.ok(moved, "un corte del tramo antiguo tiene que adelantar el cursor");
  assert.ok(String(moved.last_sync).slice(0, 10) > "2026-08-11", moved.last_sync);
  assert.ok(String(moved.last_sync).slice(0, 10) < "2026-10-10", "un extracto a medias no se sella como hoy");
  const again = Object.assign({}, caixa, { last_sync: moved.last_sync });
  const second = await sync([again], pagedBank(), { recoverGaps: true }, FakeDate);
  const urls2 = txUrls(second.calls);
  assert.ok(urls2.length <= CAP, "segunda pulsación " + urls2.length);
  const old2 = urls2.map((u) => u.searchParams.get("date_from")).find((d) => d && d < "2026-09-23");
  assert.ok(old2 > oldFrom, "el tramo antiguo no vuelve a empezar en " + oldFrom + " (" + old2 + ")");
  const days2 = new Set(second.data.links[0].accounts[0].transactions.map((x) => x.date));
  assert.equal(days2.has("2026-10-10"), true, "el mes en curso sigue llegando");
});

await t("R4 cliente viejo dentro de la ventana adelanta last_sync", async () => {
  const FakeDate = clockAt(MS);
  const caixa = { id: "CaixaBank", aspsp_name: "CaixaBank", status: "active", last_sync: "2026-09-25T09:00:00Z", accounts: [{ uid: "cx" }] };
  const r = await sync([caixa], () => ({ transactions: [{ entry_reference: "a", booking_date: "2026-10-01", transaction_amount: { amount: "3" }, credit_debit_indicator: "DBIT", creditor: { name: "Pan" } }] }), {}, FakeDate);
  const urls = txUrls(r.calls);
  assert.equal(urls.length, 1);
  assert.equal(urls[0].searchParams.get("date_from"), "2026-09-23");
  assert.equal(r.data.links[0].gapBeyondCap, false);
  assert.equal(typeof r.writes[0].last_sync, "string");
});

await t("R4 cliente viejo con hueco real no quema last_sync", async () => {
  const FakeDate = clockAt(MS);
  const caixa = { id: "CaixaBank", aspsp_name: "CaixaBank", status: "active", last_sync: "2026-07-01T09:00:00Z", accounts: [{ uid: "cx" }] };
  const r = await sync([caixa], () => ({ transactions: [{ entry_reference: "a", booking_date: "2026-10-01", transaction_amount: { amount: "3" }, credit_debit_indicator: "DBIT", creditor: { name: "Pan" } }] }), {}, FakeDate);
  assert.equal(txUrls(r.calls)[0].searchParams.get("date_from"), "2026-09-23");
  assert.equal(r.writes[0].last_sync, undefined);
});

await t("matriz cliente nuevo sin hueco real no ensancha", async () => {
  const FakeDate = clockAt(MS);
  const caixa = { id: "CaixaBank", aspsp_name: "CaixaBank", status: "active", last_sync: "2026-09-25T09:00:00Z", accounts: [{ uid: "cx" }] };
  const r = await sync([caixa], () => ({ transactions: [{ entry_reference: "a", booking_date: "2026-10-01", transaction_amount: { amount: "3" }, credit_debit_indicator: "DBIT", creditor: { name: "Pan" } }] }), { recoverGaps: true }, FakeDate);
  const urls = txUrls(r.calls);
  assert.equal(urls.length, 1);
  assert.equal(urls[0].searchParams.get("date_from"), "2026-09-23");
  assert.equal(typeof r.writes[0].last_sync, "string");
});

if (failures) process.exitCode = 1;
