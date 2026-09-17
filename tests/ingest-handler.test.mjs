#!/usr/bin/env node
/** Ejecuta el handler REAL de ingest contra una BD en memoria: identidad, ACK y ambigüedad. */
import assert from "node:assert/strict";
import fs from "node:fs";
import { transformSync } from "esbuild";

const root = new URL("../", import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), "utf8");
async function mod(p) {
  const js = transformSync(read(p), { loader: "ts", format: "esm" }).code;
  return import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
}
const logic = await mod("supabase/functions/_shared/ingest_logic.ts");
const wallet = await mod("supabase/functions/_shared/wallet.ts");
const identity = await mod("supabase/functions/_shared/ingest_identity.ts");
const budget = await mod("supabase/functions/_shared/presupuesto.ts");
const entrada = await mod("supabase/functions/_shared/entrada.ts");
const stripped = read("supabase/functions/ingest/index.ts")
  .replace(/^import\s[\s\S]*?from\s+"[^"]+";\r?\n/gm, "");
const handlerJs = transformSync(stripped, { loader: "ts" }).code;

function fakeDb(opts = {}) {
  const rows = (opts.rows || []).map((x) => ({ ...x }));
  const events = [];
  let seq = rows.length;
  let ackReads = 0;

  function table(name) {
    const q = { name, op: "select", cols: "*", filters: [], row: null, returning: false };
    const api = {
      select(cols = "*") { q.cols = cols; if (q.op === "upsert") q.returning = true; else q.op = "select"; return api; },
      eq(k, v) { q.filters.push(["eq", k, v]); return api; },
      gte(k, v) { q.filters.push(["gte", k, v]); return api; },
      lte(k, v) { q.filters.push(["lte", k, v]); return api; },
      limit() { return api; },
      upsert(row) { q.op = "upsert"; q.row = { ...row }; return api; },
      insert(row) { q.op = "insert"; q.row = row; return api; },
      maybeSingle: async () => {
        if (name === "app_state") return { data: { data: { accounts: [{ ent: "trade_republic", role: "diario" }], settings: {} } } };
        return { data: null };
      },
      then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
    };
    function filtered() {
      return rows.filter((r) => q.filters.every(([op, k, v]) => {
        if (op === "eq") return String(r[k]) === String(v);
        const a = k === "importe" ? Number(r[k]) : String(r[k]);
        const b = k === "importe" ? Number(v) : String(v);
        return op === "gte" ? a >= b : a <= b;
      }));
    }
    function run() {
      if (name === "app_events" && q.op === "insert") { events.push(q.row); return { data: null, error: null }; }
      if (name === "app_state") return { data: [], error: null };
      if (name !== "expenses") return { data: [], error: null };
      if (q.op === "select") {
        const usesEvent = q.cols.includes("ingest_event_id") || q.filters.some(([, k]) => k === "ingest_event_id");
        if (usesEvent) {
          if (opts.columnMissing) return { data: null, error: { message: "column ingest_event_id does not exist" } };
          if (q.cols === "id" && q.filters.some(([, k]) => k === "ingest_event_id")) ackReads++;
          if (opts.race23505 && q.cols === "id" && ackReads > 1 && !rows.some((r) => r.ingest_event_id === opts.raceKey)) {
            rows.push({ id: "race-ack", user_id: "user", fecha: opts.raceDate, importe: 9.95,
              comercio: "Pans & Company", source: "macrodroid", cat: "restaurantes", ingest_event_id: opts.raceKey });
          }
        }
        return { data: filtered(), error: null };
      }
      if (q.op === "upsert") {
        if (opts.race23505) return { data: null, error: { code: "23505", message: "duplicate key" } };
        if (opts.emptyInsert) return { data: [], error: null };
        const exact = rows.find((r) => r.user_id === q.row.user_id && r.fecha === q.row.fecha &&
          Number(r.importe) === Number(q.row.importe) && r.comercio === q.row.comercio);
        if (exact) return { data: [], error: null };
        const row = { id: "row-" + (++seq), ...q.row };
        rows.push(row);
        return { data: q.returning ? [{ id: row.id }] : null, error: null };
      }
      return { data: null, error: null };
    }
    return api;
  }
  return { db: { from: table }, rows, events };
}

function makeHandler(db) {
  let handler;
  const Deno = { serve: (f) => { handler = f; }, env: { get: (k) => ({
    SUPABASE_URL: "https://db.invalid", SUPABASE_SERVICE_ROLE_KEY: "role",
    INGEST_TOKEN: "token", INGEST_USER_ID: "user",
  })[k] || "" } };
  const names = [
    "Deno", "createClient", "categorizar", "clasificarConMotivo", "extraerComercio",
    "extraerConcepto", "extraerImporte", "extraerPersona", "limpiarTexto", "aEuros", "parseWallet",
    "claveEvento", "esPosibleGemeloIngest", "bucketKey", "callerIp", "rateLimit",
    "bancosDeGastoDiario", "cuentaParaPresupuesto", "filasComoLaApp", "inicioDeMesMs", "statsDelMes",
    "INGEST_MAX_BODY", "INGEST_MAX_COMERCIO", "INGEST_MAX_NOTA", "INGEST_MAX_TEXTO", "recortar", "timingSafeEqual",
  ];
  new Function(...names, handlerJs)(
    Deno, () => db, logic.categorizar, logic.clasificarConMotivo, logic.extraerComercio,
    logic.extraerConcepto, logic.extraerImporte, logic.extraerPersona, logic.limpiarTexto,
    wallet.aEuros, wallet.parseWallet, identity.claveEvento, identity.esPosibleGemeloIngest,
    async () => "bucket", () => "127.0.0.1", async () => ({ ok: true }),
    budget.bancosDeGastoDiario, budget.cuentaParaPresupuesto, budget.filasComoLaApp,
    budget.inicioDeMesMs, budget.statsDelMes,
    entrada.INGEST_MAX_BODY, entrada.INGEST_MAX_COMERCIO, entrada.INGEST_MAX_NOTA,
    entrada.INGEST_MAX_TEXTO, entrada.recortar, entrada.timingSafeEqual,
  );
  return handler;
}

async function post(env, body) {
  const res = await makeHandler(env.db)(new Request("https://app.invalid/ingest", {
    method: "POST", headers: { "x-ingest-token": "token", "content-type": "application/json" },
    body: JSON.stringify(body),
  }));
  return { status: res.status, data: await res.json() };
}

let failures = 0;
async function t(name, fn) {
  try { await fn(); console.log("  ✓ " + name); }
  catch (e) { failures++; console.error("  ✗ " + name + "\n      " + e.stack); }
}
console.log("ingest-handler");

await t("retry del mismo evento 35 min después: una fila y segundo ACK silencioso", async () => {
  const env = fakeDb();
  const body = { fuente: "tr", titulo: "Trade Republic", texto: "Has gastado 9,95 € en Pans & Company",
    fecha: String(Date.parse("2026-09-17T14:24:00+02:00")), evento: "v1_same" };
  const a = await post(env, body), b = await post(env, body);
  assert.equal(a.data.skipped, undefined); assert.ok(a.data.ack);
  assert.equal(b.data.skipped, true); assert.equal(b.data.ack, a.data.ack);
  assert.equal(env.rows.length, 1);
});

await t("carrera SELECT/UNIQUE 23505 recupera el ACK y no confirma otra fila", async () => {
  const key = "tr:trade_republic:v1_race";
  const env = fakeDb({ race23505: true, raceKey: key, raceDate: "2026-09-17T12:24:00.000Z" });
  const r = await post(env, { fuente: "tr", titulo: "Trade Republic",
    texto: "Has gastado 9,95 € en Pans & Company", fecha: String(Date.parse("2026-09-17T14:24:00+02:00")), evento: "v1_race" });
  assert.equal(r.data.skipped, true); assert.equal(r.data.ack, "race-ack"); assert.equal(env.rows.length, 1);
});

await t("sin migración cae a la barrera legacy sin romper el ingest", async () => {
  const env = fakeDb({ columnMissing: true });
  const base = { fuente: "tr", titulo: "Trade Republic", texto: "Has gastado 9,95 € en Pans & Company" };
  const a = await post(env, { ...base, fecha: String(Date.parse("2026-09-17T14:24:00+02:00")), evento: "v1_a" });
  const b = await post(env, { ...base, fecha: String(Date.parse("2026-09-17T14:29:00+02:00")), evento: "v1_b" });
  assert.equal(a.status, 200); assert.equal(b.data.skipped, true); assert.equal(env.rows.length, 1);
});

await t("Pans TR + alias Wallet 35m: evidencia conservada #dup; el 3,00 real entra limpio", async () => {
  const env = fakeDb();
  await post(env, { fuente: "tr", titulo: "Trade Republic", texto: "Has gastado 9,95 € en Pans & Company",
    fecha: String(Date.parse("2026-09-17T14:24:00+02:00")), evento: "v1_pans" });
  const alias = await post(env, { fuente: "wallet", titulo: "271 - PC RSC SANT CUGAT",
    texto: "9,95 € con Trade Republic Visa Card ••9116",
    fecha: String(Date.parse("2026-09-17T14:59:00+02:00")), evento: "v1_alias" });
  const real = await post(env, { fuente: "tr", titulo: "Trade Republic", texto: "Has gastado 3,00 € en Otro comercio",
    fecha: String(Date.parse("2026-09-17T14:59:00+02:00")), evento: "v1_three" });
  assert.equal(alias.data.possibleDup, true); assert.equal(real.data.possibleDup, false);
  assert.equal(env.rows.length, 3);
  assert.equal(env.rows.find((r) => r.comercio.includes("271 - PC")).source, "ob:trade_republic#dup");
  assert.equal(env.rows.find((r) => Number(r.importe) === 3).source, "macrodroid");
});

await t("dos compras legítimas idénticas por TR se conservan como dos filas limpias", async () => {
  const env = fakeDb();
  const base = { fuente: "tr", titulo: "Trade Republic", texto: "Has gastado 9,95 € en Pans & Company" };
  await post(env, { ...base, fecha: String(Date.parse("2026-09-17T14:24:00+02:00")), evento: "v1_buy_a" });
  const b = await post(env, { ...base, fecha: String(Date.parse("2026-09-17T14:29:00+02:00")), evento: "v1_buy_b" });
  assert.equal(b.data.skipped, undefined); assert.equal(b.data.possibleDup, false);
  assert.equal(env.rows.length, 2); assert.ok(env.rows.every((r) => r.source === "macrodroid"));
});

await t("ON CONFLICT sin fila devuelta se responde skipped, nunca 'gasto apuntado'", async () => {
  const env = fakeDb({ emptyInsert: true });
  const r = await post(env, { fuente: "tr", titulo: "Trade Republic", texto: "Has gastado 4,00 € en Cafe",
    fecha: String(Date.parse("2026-09-17T15:10:00+02:00")), evento: "v1_empty" });
  assert.equal(r.data.skipped, true); assert.equal(r.data.ack, undefined); assert.equal(env.rows.length, 0);
});

if (failures) process.exitCode = 1;
else console.log("  ok");
