#!/usr/bin/env node
/** Ejecuta el handler REAL de ingest contra una BD en memoria: identidad, ACK y deduplicación. */
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { transformSync } from "esbuild";
import { loadPureLogicFromFile } from "../../scripts/load-pure-logic.mjs";

const root = new URL("../../", import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), "utf8");
async function mod(p) {
  const js = transformSync(read(p), { loader: "ts", format: "esm" }).code;
  return import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
}
const logic = await mod("supabase/functions/_shared/ingest_logic.ts");
const wallet = await mod("supabase/functions/_shared/wallet.ts");
const identity = await mod("supabase/functions/_shared/ingest_identity.ts");
const budget = await mod("supabase/functions/_shared/presupuesto.ts");
const widgetSource=read("supabase/functions/ingest/widget.ts").replace(/^import\s[\s\S]*?from\s+"[^"]+";\r?\n/gm, "");
const widgetJs=transformSync(widgetSource,{loader:"ts",format:"cjs"}).code;
// esbuild asigna module.exports; se conserva ese objeto al evaluar los imports reales.
const widgetModule={exports:{}};
new Function('module','exports',...Object.keys(budget),widgetJs)(widgetModule,widgetModule.exports,...Object.values(budget));
const widgetBudget=widgetModule.exports;
const entrada = await mod("supabase/functions/_shared/entrada.ts");
const stripped = read("supabase/functions/ingest/index.ts")
  .replace(/^import\s[\s\S]*?from\s+"[^"]+";\r?\n/gm, "");
const handlerJs = transformSync(stripped, { loader: "ts" }).code;

function fakeDb(opts = {}) {
  const rows = (opts.rows || []).map((x) => ({ ...x }));
  let appState=opts.state || { accounts: [{ ent: "trade_republic", role: "diario" }], settings: {} };
  const events = [];
  let seq = rows.length;
  let ackReads = 0;

  function table(name) {
    const q = { name, op: "select", cols: "*", filters: [], row: null, returning: false };
    const api = {
      select(cols = "*", options) { q.cols = cols; q.count = options?.count; if (q.op === "upsert") q.returning = true; else q.op = "select"; return api; },
      eq(k, v) { q.filters.push(["eq", k, v]); return api; },
      in(k, values) { q.filters.push(["in", k, values]); return api; },
      gte(k, v) { q.filters.push(["gte", k, v]); return api; },
      lte(k, v) { q.filters.push(["lte", k, v]); return api; },
      lt(k, v) { q.filters.push(["lt", k, v]); return api; },
      limit() { return api; },
      order(k, {ascending=true}={}) { q.order = k; q.ascending=ascending; return api; },
      range(from, to) { q.range = [from, to]; return api; },
      upsert(row) { q.op = "upsert"; q.row = { ...row }; return api; },
      update(row) { q.op = "update"; q.row = { ...row }; return api; },
      delete() { q.op = "delete"; return api; },
      insert(row) { q.op = "insert"; q.row = row; return api; },
      maybeSingle: async () => {
        if (name === "app_state") return { data: { data: appState } };
        return { data: null };
      },
      then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
    };
    function filtered() {
      return rows.filter((r) => q.filters.every(([op, k, v]) => {
        if (op === "eq") return String(r[k]) === String(v);
        if (op === "in") return v.map(String).includes(String(r[k]));
        const a = k === "importe" ? Number(r[k]) : String(r[k]);
        const b = k === "importe" ? Number(v) : String(v);
        return op === "gte" ? a >= b : op === "lt" ? a < b : a <= b;
      }));
    }
    function run() {
      if (name === "app_events" && q.op === "insert") { events.push(q.row); return { data: null, error: null }; }
      if (name === "app_state") {
        if(q.op === "upsert" || q.op === "update") { appState=q.row.data; return {data:[{updated_at:q.row.updated_at}],error:null}; }
        return { data: [], error: null };
      }
      if (name !== "expenses") return { data: [], error: null };
      if (q.op === "select") {
        if (q.count && opts.widgetThrows) throw new Error("fallo sintético del widget opcional");
        if (opts.monthReadError && q.cols === "id,importe,cat,source,fecha,comercio")
          return { data: null, error: { message: "lectura mensual fallida" } };
        const usesEvent = q.cols.includes("ingest_event_id") || q.filters.some(([, k]) => k === "ingest_event_id");
        if (usesEvent) {
          if (opts.columnMissing) return { data: null, error: { message: "column ingest_event_id does not exist" } };
          if (q.cols === "id" && q.filters.some(([, k]) => k === "ingest_event_id")) ackReads++;
          if (opts.race23505 && q.cols === "id" && ackReads > 1 && !rows.some((r) => r.ingest_event_id === opts.raceKey)) {
            rows.push({ id: "race-ack", user_id: "user", fecha: opts.raceDate, importe: 9.95,
              comercio: "Pans & Company", source: "macrodroid", cat: "restaurantes", ingest_event_id: opts.raceKey });
          }
        }
        if (opts.hideLegacyPrecheckOnce && q.cols === "fecha") {
          opts.hideLegacyPrecheckOnce = false;
          return { data: [], error: null };
        }
        if (opts.hideEventPrecheckOnce && q.cols === "id,fecha,importe,ingest_event_id") {
          opts.hideEventPrecheckOnce = false;
          return { data: [], error: null };
        }
        const all = filtered();
        if (q.order) all.sort((a,b) => (q.ascending?1:-1)*String(a[q.order]).localeCompare(String(b[q.order])));
        if (q.count && opts.widgetReadError) return { data: null, count: null, error: { message: "lectura v2 fallida" } };
        const data = q.range ? all.slice(q.range[0], q.range[1] + 1) : all.slice(0, opts.rowLimit || all.length);
        return { data: opts.widgetTruncated && q.count ? data.slice(0,1) : data, error: null,
          ...(q.count ? { count: opts.widgetCountMissing ? null : all.length } : {}) };
      }
      if (q.op === "upsert") {
        if (opts.race23505) return { data: null, error: { code: "23505", message: "duplicate key" } };
        if (opts.emptyInsert) return { data: [], error: null };
        const exact = rows.find((r) => r.user_id === q.row.user_id && r.fecha === q.row.fecha &&
          Number(r.importe) === Number(q.row.importe) && r.comercio === q.row.comercio);
        if (exact) return { data: [], error: null };
        const row = { id: "row-" + (++seq), created_at: opts.insertCreatedAt || q.row.fecha, ...q.row };
        rows.push(row);
        return { data: q.returning ? [{ id: row.id }] : null, error: null };
      }
      if (q.op === "update") {
        if (opts.updateError) return { data: null, error: { message: "update failed" } };
        for (const row of filtered()) Object.assign(row, q.row);
        return { data: null, error: null };
      }
      if (q.op === "delete") {
        if (opts.deleteError) return { data: null, error: { message: "delete failed" } };
        const borrar = new Set(filtered());
        for (let i = rows.length - 1; i >= 0; i--) if (borrar.has(rows[i])) rows.splice(i, 1);
        return { data: null, error: null };
      }
      return { data: null, error: null };
    }
    return api;
  }
  return { db: { from: table }, rows, events };
}

function makeHandler(db, classifier=logic) {
  let handler;
  const Deno = { serve: (f) => { handler = f; }, env: { get: (k) => ({
    SUPABASE_URL: "https://db.invalid", SUPABASE_SERVICE_ROLE_KEY: "role",
    INGEST_TOKEN: "token", INGEST_USER_ID: "user",
  })[k] || "" } };
  const names = [
    "Deno", "createClient", "categorizar", "clasificarConMotivo", "extraerComercio",
    "extraerConcepto", "extraerImporte", "extraerPersona", "limpiarTexto", "aEuros", "parseWallet",
    "claveEvento", "esGemeloIngest", "tieneGemeloAnterior", "bucketKey", "callerIp", "rateLimit",
    "bancosDeGastoDiario", "cuentaParaPresupuesto", "filasComoLaApp", "inicioDeMesMs", "statsDelMes",
    "widgetSnapshot", "widgetStart", "readWidgetRows",
    "INGEST_MAX_BODY", "INGEST_MAX_COMERCIO", "INGEST_MAX_NOTA", "INGEST_MAX_TEXTO", "recortar", "timingSafeEqual",
  ];
  new Function(...names, handlerJs)(
    Deno, () => db, classifier.categorizar, classifier.clasificarConMotivo, logic.extraerComercio,
    logic.extraerConcepto, logic.extraerImporte, logic.extraerPersona, logic.limpiarTexto,
    wallet.aEuros, wallet.parseWallet, identity.claveEvento, identity.esGemeloIngest,
    identity.tieneGemeloAnterior,
    async () => "bucket", () => "127.0.0.1", async () => ({ ok: true }),
    budget.bancosDeGastoDiario, budget.cuentaParaPresupuesto, budget.filasComoLaApp,
    budget.inicioDeMesMs, budget.statsDelMes,
    widgetBudget.widgetSnapshot, widgetBudget.widgetStart, widgetBudget.readWidgetRows,
    entrada.INGEST_MAX_BODY, entrada.INGEST_MAX_COMERCIO, entrada.INGEST_MAX_NOTA,
    entrada.INGEST_MAX_TEXTO, entrada.recortar, entrada.timingSafeEqual,
  );
  return handler;
}

async function post(env, body, classifier=logic) {
  const res = await makeHandler(env.db, classifier)(new Request("https://app.invalid/ingest", {
    method: "POST", headers: { "x-ingest-token": "token", "content-type": "application/json" },
    body: JSON.stringify(body),
  }));
  return { status: res.status, data: await res.json() };
}


export {root,read,mod,logic,wallet,identity,budget,widgetBudget,entrada,handlerJs,fakeDb,makeHandler,post};
