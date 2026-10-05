#!/usr/bin/env node
/**
 * INC-2709-06, unidad acotada. Mientras el histórico espera el ACK, un pull mete
 * el cargo canónico de la misma referencia. Al soltar el ACK no puede aparecer
 * un segundo UUID ni un deshacer de una fila que este batch no insertó.
 *
 * Datos inventados. UTC y Europe/Madrid. El cálculo pasa por `persistHistImport`
 * del bundle, no por un filtro pegado en memoria.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

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
const ahora = Date.parse(ymd + "T22:00:00Z");
const d1 = ymd + "T08:15:00.000Z";
const d2 = ymd + "T18:40:00.000Z";

function drain() {
  return new Promise(function(res){ setImmediate(res); });
}
async function settle() {
  for (let i = 0; i < 40; i++) await drain();
}

function base(expenses, deleted) {
  return {
    accounts: [
      { id: "a", ent: "caixabank", role: "diario", spendFrom: true, value: 100 },
      { id: "b", ent: "sabadell", role: "diario", spendFrom: true, value: 50 },
    ],
    expenses: expenses || [],
    deleted: deleted || [],
    fixed: [], debts: [], oneoffs: [],
    settings: { expenseBanks: ["caixabank", "sabadell"], gTotalMode: "split" },
    budget: 1000,
  };
}
function fila(id, extId, extra) {
  return Object.assign({
    id: id, date: d1, amount: 12.5, merchant: "COMERCIO", category: "super",
    source: "ob-hist", ent: "caixabank", extId: extId, importBatchId: "hist-synthetic",
  }, extra || {});
}
function nube() {
  const rows = [];
  const api = {
    rows: rows,
    _delay: false,
    _gate: null,
    delayNext: function(){ this._delay = true; },
    release: function(){ const g = this._gate; this._gate = null; if (g) g(); },
    addExpensesBatch: function(list){
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
function caja(inicial) {
  const s = inicial || base();
  const toasts = [];
  return {
    s: s,
    toasts: toasts,
    set: function(fn){
      const n = fn(s);
      if (n && n !== s) {
        s.expenses = n.expenses || [];
        s.deleted = n.deleted || s.deleted || [];
        s.fixed = n.fixed || [];
        if (n.lastHistImport) s.lastHistImport = n.lastHistImport;
        else if (n.lastHistImport === null) s.lastHistImport = null;
      }
      return s;
    },
    run: function(cloud, expAdds){
      ctx.persistHistImport({
        cloud: cloud, expAdds: expAdds, fixAdds: [], batchId: "hist-synthetic",
        set: this.set,
        showToast: function(m){ toasts.push(String(m)); },
        onClose: function(){}, setImporting: function(){},
        t: function(k){ return k; },
        tf: function(k, o){ return k + "=" + (o && o.n != null ? o.n : ""); },
      });
    },
  };
}
function cifra(s) {
  return ctx.monthBudgetStats(s, ahora).shown;
}

const fallos = [];
async function t(nombre, fn) {
  try { await fn(); console.log("  ✓ " + nombre); }
  catch (e) { fallos.push(nombre); console.error("  ✗ " + nombre + "\n      " + (e && e.message)); }
}

console.log("inc-2709-06-hist-durante-ack (" + zona + ")");

await t("el canónico que llega durante el ACK se queda solo, a 12,50, con su uuid", async function(){
  const cloud = nube();
  const a2 = fila("uuid-local-A2", "cargo-A");
  const canon = fila("uuid-canonical", "cargo-A", { category: "bares", note: "editada", source: "ob", importBatchId: undefined });
  cloud.rows.push({
    id: canon.id, fecha: canon.date, importe: canon.amount, comercio: canon.merchant,
    cat: canon.category, source: ctx.expenseSourceForCloud(canon),
  });
  const b = caja(base());
  cloud.delayNext();
  b.run(cloud, [a2]);
  const vivos = [canon];
  b.s.expenses = vivos;
  cloud.release();
  await settle();
  assert.equal(b.s.expenses.length, 1, "filas=" + b.s.expenses.length);
  assert.equal(b.s.expenses[0].id, "uuid-canonical");
  assert.equal(b.s.expenses[0].category, "bares");
  assert.equal(b.s.expenses[0].note, "editada");
  assert.equal(cifra(b.s), 12.5, "cifra=" + cifra(b.s));
  assert.equal(b.s.expenses, vivos, "concatenó otro array encima del canónico");
  assert.equal(b.s.expenses[0], canon, "sustituyó el objeto canónico");
  const last = b.s.lastHistImport;
  const idsLocal = (last && last.localIds) || [];
  const idsNube = (last && last.cloudIds) || [];
  assert.ok(idsLocal.indexOf("uuid-canonical") < 0, "deshacer lista el canónico");
  assert.ok(idsNube.indexOf("uuid-canonical") < 0 && idsNube.indexOf("uuid-local-A2") < 0, "cloudIds=" + idsNube.join(","));
  if (last) {
    const u = ctx.histUndoBatch(b.s, last);
    assert.ok((u.nextState.expenses || []).some(function(e){ return e.id === "uuid-canonical"; }), "deshacer se llevó el canónico");
  }
});

await t("borrar durante el ACK no revive la fila", async function(){
  const cloud = nube();
  const a2 = fila("uuid-local-A2", "cargo-A");
  const b = caja(base([a2]));
  cloud.delayNext();
  b.run(cloud, [a2]);
  const keys = ctx.expenseTombKeys(a2);
  b.set(function(s){
    return { expenses: [], deleted: (s.deleted || []).concat(keys), fixed: s.fixed || [] };
  });
  cloud.release();
  await settle();
  assert.equal(b.s.expenses.length, 0, "volvió " + b.s.expenses.map(function(e){ return e.id; }).join(","));
});

await t("A y B distintos, mismo importe y comercio, conservan las dos", async function(){
  const cloud = nube();
  const a2 = fila("uuid-local-A2", "cargo-A");
  const bRow = fila("uuid-local-B", "cargo-B", { date: d2 });
  const canon = fila("uuid-canonical", "cargo-A", { category: "bares", note: "editada", source: "ob", importBatchId: null });
  cloud.rows.push({
    id: canon.id, fecha: canon.date, importe: canon.amount, comercio: canon.merchant,
    source: ctx.expenseSourceForCloud(canon),
  });
  const b = caja(base());
  cloud.delayNext();
  b.run(cloud, [a2, bRow]);
  b.s.expenses = [canon];
  cloud.release();
  await settle();
  const ids = Array.from(b.s.expenses, function(e){ return e.id; }).slice().sort();
  assert.equal(ids.join(","), "uuid-canonical,uuid-local-B", "ids=" + ids.join(","));
  assert.equal(b.s.expenses.filter(function(e){ return e.extId === "cargo-A"; })[0].category, "bares");
  assert.equal(cifra(b.s), 25);
  const last = b.s.lastHistImport || { localIds: [], cloudIds: [] };
  assert.ok((last.localIds || []).indexOf("uuid-canonical") < 0);
  assert.ok((last.cloudIds || []).indexOf("uuid-canonical") < 0);
  const u = ctx.histUndoBatch(b.s, last.batchId ? last : { batchId: "hist-synthetic", localIds: last.localIds, cloudIds: last.cloudIds });
  assert.ok((u.nextState.expenses || []).some(function(e){ return e.id === "uuid-canonical"; }));
  assert.ok(!(u.nextState.expenses || []).some(function(e){ return e.id === "uuid-local-B"; }), "B nuevo tenía que salir al deshacer");
});

await t("el mismo extId en bancos distintos conserva las dos", async function(){
  const cloud = nube();
  const caixa = fila("uuid-caixa", "cargo-A", { source: "ob", category: "bares", note: "caixa" });
  const sab = fila("uuid-sab", "cargo-A", { ent: "sabadell", date: d2, category: "super" });
  cloud.rows.push({
    id: caixa.id, fecha: caixa.date, importe: caixa.amount, comercio: caixa.merchant,
    source: ctx.expenseSourceForCloud(caixa),
  });
  const b = caja(base([caixa]));
  b.run(cloud, [sab]);
  await settle();
  const ents = Array.from(b.s.expenses, function(e){ return e.ent + ":" + e.id; }).slice().sort();
  assert.equal(ents.join(","), "caixabank:uuid-caixa,sabadell:uuid-sab", "ents=" + ents.join(","));
  const viva = Array.from(b.s.expenses).find(function(e){ return e.id === "uuid-caixa"; });
  assert.equal(viva && viva.note, "caixa");
  assert.equal(cifra(b.s), 25, "cifra=" + cifra(b.s));
});

await t("dos filas sin extId y la misma terna no se funden", async function(){
  const cloud = nube();
  const u1 = fila("uuid-u1", "", { extId: "", date: d1, merchant: "SUELTO" });
  const u2 = fila("uuid-u2", "", { extId: "", date: d2, merchant: "SUELTO" });
  delete u1.extId; delete u2.extId;
  const b = caja(base([u1]));
  b.run(cloud, [u2]);
  await settle();
  assert.equal(b.s.expenses.length, 2, "se fundieron por importe/comercio/día");
});

await t("un setter diferido no fabrica el contador 0 ni escribe fuera del commit", async function(){
  const cloud = nube();
  const row = fila("uuid-nuevo", "cargo-Z", { date: d2, merchant: "OTRO" });
  const s = base();
  const previa = s.expenses;
  const queued = [];
  const toasts = [];
  cloud.delayNext();
  ctx.persistHistImport({
    cloud: cloud, expAdds: [row], fixAdds: [], batchId: "hist-synthetic",
    set: function(fn){ queued.push(fn); },
    showToast: function(m){ toasts.push(String(m)); },
    onClose: function(){}, setImporting: function(){},
    t: function(k){ return k; },
    tf: function(k, o){ return k + "=" + (o && o.n != null ? o.n : ""); },
  });
  cloud.release();
  await settle();
  assert.equal(s.expenses, previa, "escribió antes del commit");
  assert.equal(queued.length, 1, "no encoló el commit");
  assert.ok(!toasts.some(function(m){ return /=0(?:\D|$)/.test(m) || m.indexOf("=0") >= 0; }), "avisos=" + toasts.join(" | "));
  const next = queued[0](s);
  assert.equal(next.expenses.length, 1);
  assert.equal(next.expenses[0].id, "uuid-nuevo");
  await settle();
  assert.ok(!toasts.some(function(m){ return /=0(?:\D|$)/.test(m) || m.indexOf("=0") >= 0; }), "tras el commit avisos=" + toasts.join(" | "));
  assert.ok(toasts.some(function(m){ return m.indexOf("=1") >= 0; }), "no avisó el alta real: " + toasts.join(" | "));
});

console.log(fallos.length ? "inc-2709-06-hist-durante-ack: " + fallos.length + " fallo(s) (" + zona + ")" : "inc-2709-06-hist-durante-ack: OK (" + zona + ")");
process.exit(fallos.length ? 1 : 0);
