#!/usr/bin/env node
/**
 * INC-2709-06, tercera pasada. El guardián anterior le pasaba a `obReassignSkipped`
 * toda la nube. Los callers de `11-app-main.js` y `10-app-components.js` no hacen
 * eso: el upsert solo devuelve `cloudIds` de lo insertado. Aquí se ejecuta el
 * callback real de esos dos ficheros, con un transporte que ignora la terna repetida
 * y no devuelve la fila que ya ocupaba la clave. Una lectura (`pullExpenses`) solo
 * entra si el caller la pide.
 *
 * Datos inventados. UTC y Europe/Madrid.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);

if (!process.argv.includes("--zone-child")) {
  let status = 0;
  for (const zone of ["UTC", "Europe/Madrid"]) {
    const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--zone-child"], {
      env: { ...process.env, TZ: zone },
      stdio: "inherit",
    });
    if (r.status !== 0) status = r.status || 1;
  }
  process.exit(status);
}

const ctx = loadPureLogicFromFile();
const zona = process.env.TZ || "UTC";
const ymd = new Date().toISOString().slice(0, 10);
const dailySrc = fs.readFileSync(path.join(root, "src/modules/11-app-main.js"), "utf8");
const histSrc = fs.readFileSync(path.join(root, "src/modules/10-app-components.js"), "utf8");
const srvSrc = fs.readFileSync(path.join(root, "supabase/functions/_shared/presupuesto.ts"), "utf8");
const srvJs = transformSync(srvSrc, { loader: "ts", format: "esm" }).code;
const { claveComoLaApp, filasComoLaApp, statsDelMes, inicioDeMesMs } =
  await import("data:text/javascript;base64," + Buffer.from(srvJs).toString("base64"));

function sliceCall(src, startNeedle, endNeedle) {
  const i = src.indexOf(startNeedle);
  if (i < 0) return null;
  const j = src.indexOf(endNeedle, i);
  if (j < 0) return null;
  return src.slice(i, j);
}

function braceBody(src, openIdx) {
  let depth = 0;
  let quote = "";
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === "\\") { i++; continue; }
      if (c === quote) quote = "";
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return src.slice(openIdx + 1, i);
    }
  }
  return null;
}

function extractDaily(src) {
  const marked = sliceCall(src, "/* OB-ACK-DAILY */", "/* /OB-ACK-DAILY */");
  if (marked) return marked.replace("/* OB-ACK-DAILY */", "").replace("/* /OB-ACK-DAILY */", "");
  let from = 0;
  let best = null;
  while (from < src.length) {
    const i = src.indexOf("setTimeout(function(){", from);
    if (i < 0) break;
    const open = src.indexOf("{", i);
    const body = braceBody(src, open);
    if (body && body.includes("obAdded") && body.includes("addExpensesBatch")) {
      if (!best || body.length < best.length) best = body;
    }
    from = i + 1;
  }
  if (!best) throw new Error("no está el callback de 11-app-main.js");
  return best;
}

function extractHist(src) {
  const marked = sliceCall(src, "/* OB-ACK-HIST */", "/* /OB-ACK-HIST */");
  if (marked) return marked.replace("/* OB-ACK-HIST */", "").replace("/* /OB-ACK-HIST */", "");
  const i = src.indexOf("const ocuparAck=function(rows){");
  const endNeedle = "setImporting(false); onClose();";
  const j = src.indexOf(endNeedle, i);
  if (i < 0 || j < 0) throw new Error("no está el callback de 10-app-components.js");
  const close = src.indexOf("});", j + endNeedle.length);
  if (close < 0) throw new Error("el callback de histórico no cierra");
  return src.slice(i, close + 3);
}

const dailyBody = extractDaily(dailySrc);
const histBody = extractHist(histSrc);
const runDaily = vm.runInContext(
  "(function(obAdded, cloud, set){\n" + dailyBody + "\n})",
  ctx,
);
const runHist = vm.runInContext(
  "(function(cloud, expAdds, fixAdds, batchId, set, showToast, onClose, setImporting, t, tf){\n" + histBody + "\n})",
  ctx,
);

function drain() {
  return new Promise(function(res){ setImmediate(res); });
}
async function settle() {
  for (let i = 0; i < 30; i++) await drain();
}

function estado(expenses, deleted) {
  return {
    accounts: [{ id: "a", ent: "caixabank", role: "diario", spendFrom: true, value: 100 }],
    expenses: expenses || [],
    deleted: deleted || [],
    fixed: [], debts: [], oneoffs: [],
    settings: { expenseBanks: ["caixabank"] },
    budget: 1000,
  };
}
function cargo(id) {
  return { ent: "caixabank", id: id, date: ymd, amount: 12.5, merchant: "MERCADONA", status: "BOOK", acctUid: "cx" };
}
function nube() {
  const rows = [];
  const api = {
    rows: rows,
    enabled: function(){ return true; },
    _delay: false,
    _offline: false,
    _throw: false,
    _gate: null,
    delayNext: function(){ this._delay = true; },
    release: function(){ const g = this._gate; this._gate = null; if (g) g(); },
    addExpensesBatch: function(list){
      if (api._throw) return Promise.reject(new Error("red"));
      if (api._offline) return Promise.resolve({ cloudIds: [], offline: true });
      const accepted = [];
      (list || []).forEach(function(e){
        const k = new Date(e.date).toISOString() + "|" + (Number(e.amount) || 0) + "|" + (e.merchant || "");
        if (rows.some(function(r){ return new Date(r.fecha).toISOString() + "|" + (Number(r.importe) || 0) + "|" + (r.comercio || "") === k; })) return;
        rows.push({
          id: e.id, fecha: e.date, importe: e.amount, comercio: e.merchant,
          cat: e.category, source: ctx.expenseSourceForCloud(e),
        });
        accepted.push(e);
      });
      const out = { cloudIds: accepted.map(function(e){ return e.id; }), offline: false };
      if (api._delay) {
        api._delay = false;
        return new Promise(function(res){ api._gate = function(){ res(out); }; });
      }
      return Promise.resolve(out);
    },
    pullExpenses: function(){
      return Promise.resolve(rows.map(function(r){
        return { id: r.id, fecha: r.fecha, importe: r.importe, comercio: r.comercio, cat: r.cat, source: r.source };
      }));
    },
  };
  return api;
}
function box() {
  const s = { expenses: [], deleted: [], fixed: [] };
  return { s: s, set: function(fn){ const n = fn(s); if (n && n !== s) { s.expenses = n.expenses || []; s.deleted = n.deleted || []; s.fixed = n.fixed || []; if (n.lastHistImport) s.lastHistImport = n.lastHistImport; } return s; } };
}
function extIds(cloud) {
  return cloud.rows.map(function(r){ return ctx.expenseFromRow(r).extId; }).slice().sort();
}

const fallos = [];
async function t(nombre, fn) {
  try { await fn(); console.log("  ✓ " + nombre); }
  catch (e) { fallos.push(nombre); console.error("  ✗ " + nombre + "\n      " + (e && e.message)); }
}

console.log("inc-2709-06-ack (" + zona + ")");

await t("1. dos clientes con la misma referencia no dejan A+A", async function(){
  const cloud = nube();
  const a1 = ctx.importObExpenses(estado(), [cargo("cargo-A")])[0];
  const b1 = box(); b1.s.expenses = [a1];
  runDaily([a1], cloud, b1.set);
  await settle();
  const a2 = ctx.importObExpenses(estado(), [cargo("cargo-A")])[0];
  assert.notEqual(a2.id, a1.id);
  const b2 = box(); b2.s.expenses = [a2];
  runDaily([a2], cloud, b2.set);
  await settle();
  assert.deepEqual(extIds(cloud), ["cargo-A"], "nube=" + extIds(cloud).join(",") + " uuids=" + cloud.rows.map(function(r){ return r.id; }).join(","));
  assert.equal(cloud.rows.length, 1);
  assert.equal(cloud.rows[0].id, a1.id);
});

await t("2. Az/BY/C8: el tercer choque no borra C8", async function(){
  const cloud = nube();
  for (const id of ["Az", "BY", "C8"]) {
    const row = ctx.importObExpenses(estado(), [cargo(id)])[0];
    const b = box(); b.s.expenses = [row];
    runDaily([row], cloud, b.set);
    await settle();
    assert.ok(b.s.expenses.some(function(e){ return e.extId === id; }), id + " desapareció en local");
  }
  assert.deepEqual(extIds(cloud), ["Az", "BY", "C8"], "nube=" + extIds(cloud).join(","));
  assert.equal(new Set(cloud.rows.map(function(r){ return r.fecha; })).size, 3);
});

await t("3. borrar durante el ACK no revive la fila ni la inserta", async function(){
  const cloud = nube();
  const row = ctx.importObExpenses(estado(), [cargo("cargo-B")])[0];
  cloud.rows.push({
    id: "bloqueo", fecha: row.date, importe: row.amount, comercio: row.merchant,
    source: ctx.expenseSourceForCloud({ source: "ob", ent: "caixabank", extId: "otro" }),
  });
  const b = box(); b.s.expenses = [row];
  cloud.delayNext();
  runDaily([row], cloud, b.set);
  b.set(function(s){
    const keys = ctx.expenseTombKeys(row);
    return { expenses: [], deleted: (s.deleted || []).concat(keys), fixed: s.fixed || [] };
  });
  cloud.release();
  await settle();
  assert.equal(b.s.expenses.length, 0, "volvió en local");
  assert.ok(!cloud.rows.some(function(r){ return r.id === row.id; }), "se insertó pese a la lápida");
});

await t("4. editar durante el ACK no lo pisa el reintento", async function(){
  const cloud = nube();
  const row = ctx.importObExpenses(estado(), [cargo("cargo-B")])[0];
  row.category = "super";
  row.note = "";
  cloud.rows.push({
    id: "bloqueo", fecha: row.date, importe: row.amount, comercio: row.merchant,
    source: ctx.expenseSourceForCloud({ source: "ob", ent: "caixabank", extId: "otro" }),
  });
  const b = box(); b.s.expenses = [Object.assign({}, row)];
  cloud.delayNext();
  runDaily([row], cloud, b.set);
  b.s.expenses[0].category = "bares";
  b.s.expenses[0].note = "editada";
  b.s.expenses[0].merchant = "OTRO";
  cloud.release();
  await settle();
  assert.equal(b.s.expenses.length, 1);
  const cur = b.s.expenses[0];
  assert.equal(cur.id, row.id);
  assert.equal(cur.category, "bares");
  assert.equal(cur.note, "editada");
  assert.equal(cur.merchant, "OTRO");
  const subida = cloud.rows.find(function(r){ return r.id === row.id; });
  if (subida) assert.equal(subida.comercio, "OTRO");
});

await t("offline y excepción no acreditan guardado ni borran el local", async function(){
  const row = ctx.importObExpenses(estado(), [cargo("cargo-A")])[0];
  const off = nube(); off._offline = true;
  const bo = box(); bo.s.expenses = [row];
  runDaily([row], off, bo.set);
  await settle();
  assert.equal(bo.s.expenses.length, 1);
  assert.equal(off.rows.length, 0);
  const bad = nube(); bad._throw = true;
  const be = box(); be.s.expenses = [Object.assign({}, row)];
  runDaily([row], bad, be.set);
  await settle();
  assert.equal(be.s.expenses.length, 1);
  assert.equal(bad.rows.length, 0);
});

await t("histórico: la misma referencia y Az/BY/C8 pasan por el caller de la ficha", async function(){
  function adds(id) {
    const flat = ctx.histFlattenHistoryLinks({ links: [{ aspsp: "CaixaBank", accounts: [{ uid: "cx", transactions: [
      { ext_id: id, date: ymd, amount: 12.5, merchant: "MERCADONA", status: "BOOK" },
    ] }] }] }, [], {});
    const cl = ctx.histClassifyCandidates(flat.out, estado());
    return ctx.histBuildCommit(flat.out, cl.rows, estado(), { batchId: "h-" + id }).expAdds;
  }
  const cloud = nube();
  const toasts = [];
  const show = function(m){ toasts.push(m); };
  const noop = function(){};
  const t0 = function(){ return ""; };
  const tf0 = function(){ return ""; };
  const a = adds("cargo-A");
  const h1 = box();
  runHist(cloud, a, [], "h1", h1.set, show, noop, noop, t0, tf0);
  await settle();
  const b = adds("cargo-A");
  assert.notEqual(b[0].id, a[0].id);
  const h2 = box();
  runHist(cloud, b, [], "h2", h2.set, show, noop, noop, t0, tf0);
  await settle();
  assert.deepEqual(extIds(cloud), ["cargo-A"], "hist nube=" + extIds(cloud).join(","));
  const cloud3 = nube();
  for (const id of ["Az", "BY", "C8"]) {
    const rows = adds(id);
    const h = box();
    runHist(cloud3, rows, [], "h-" + id, h.set, show, noop, noop, t0, tf0);
    await settle();
    assert.ok((h.s.expenses || []).some(function(e){ return e.extId === id; }), "hist local perdió " + id);
  }
  assert.deepEqual(extIds(cloud3), ["Az", "BY", "C8"], "hist nube=" + extIds(cloud3).join(","));
});

await t("app y widget cuentan los dos cargos", async function(){
  const par = ctx.importObExpenses(estado(), [cargo("cargo-A"), cargo("cargo-B")]);
  assert.equal(par.length, 2);
  const cafe = ctx.histDate(ymd, "ob-ext|caixabank|cafe-1");
  const filas = [
    { fecha: par[0].date, importe: 12.5, comercio: "MERCADONA", cat: "super", source: ctx.expenseSourceForCloud(par[0]) },
    { fecha: par[1].date, importe: 12.5, comercio: "MERCADONA", cat: "super", source: ctx.expenseSourceForCloud(par[1]) },
    { fecha: cafe, importe: 3, comercio: "CAFE", cat: "bares", source: "ob:caixabank" },
    { fecha: ctx.histDate(ymd), importe: 9, comercio: "DUP", cat: "otros", source: "ob:caixabank#dup" },
    { fecha: ctx.histDate(ymd), importe: 40, comercio: "CUOTA", cat: "deudas", source: "ob:caixabank~deuda.cuota1" },
  ];
  assert.notEqual(claveComoLaApp(filas[0]), claveComoLaApp(filas[1]));
  const vis = filasComoLaApp(filas, []);
  assert.equal(vis.filter(function(f){ return f.comercio === "MERCADONA"; }).length, 2);
  const ahora = Date.parse(ymd + "T22:00:00Z");
  const srv = statsDelMes(vis, {
    budget: 1000,
    accounts: [{ ent: "caixabank", role: "diario" }],
    settings: { expenseBanks: ["caixabank"], gTotalMode: "split" },
  }, inicioDeMesMs(ahora));
  const app = ctx.monthBudgetStats(estado(par.concat([
    { id: "cafe", date: cafe, amount: 3, merchant: "CAFE", category: "bares", source: "ob", ent: "caixabank" },
  ])), ahora);
  assert.equal(app.spent, 28);
  assert.equal(srv.spent, 28, "widget " + srv.spent + " app " + app.spent);
});

console.log(fallos.length ? "inc-2709-06-ack: " + fallos.length + " fallo(s) (" + zona + ")" : "inc-2709-06-ack: OK (" + zona + ")");
process.exit(fallos.length ? 1 : 0);
