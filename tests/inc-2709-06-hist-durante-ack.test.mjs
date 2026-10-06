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
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { loadPureLogicFromFile, createLogicSandbox, extractPureLogicSource } from "../scripts/load-pure-logic.mjs";

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
function tfN(k, o) {
  return k + "=" + (o && o.n != null ? o.n : "");
}
function confirmar(prev, next, toasts) {
  return ctx.obHistNoticeCommit(prev, next, function(m){ toasts.push(String(m)); }, function(k){ return k; }, tfN);
}
function comoApp(prev, updater) {
  const next = updater(prev);
  if (!next || next === prev) return prev;
  return Object.assign({}, next, { _savedAt: 1 });
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
  assert.equal(s.expenses, previa, "el cálculo escribió el estado de partida");
  await settle();
  assert.equal(toasts.length, 0, "avisó sin commit: " + toasts.join(" | "));
  const committed = Object.assign({}, next, { _savedAt: 1 });
  assert.equal(confirmar(s, committed, toasts), true);
  assert.ok(!toasts.some(function(m){ return /=0(?:\D|$)/.test(m) || m.indexOf("=0") >= 0; }), "tras el commit avisos=" + toasts.join(" | "));
  assert.ok(toasts.some(function(m){ return m.indexOf("=1") >= 0; }), "no avisó el alta real: " + toasts.join(" | "));
  const n = toasts.length;
  assert.equal(confirmar(s, committed, toasts), false);
  assert.equal(confirmar(committed, committed, toasts), false);
  assert.equal(toasts.length, n, "la repetición volvió a avisar");
});

await t("un cálculo descartado no avisa, y el replay con el canónico tampoco", async function(){
  const cloud = nube();
  const row = fila("uuid-spec", "cargo-Z", { date: d2, merchant: "Inventado" });
  let updater;
  const toasts = [];
  cloud.delayNext();
  ctx.persistHistImport({
    cloud: cloud, expAdds: [row], fixAdds: [], batchId: "hist-spec",
    set: function(fn){ updater = fn; },
    showToast: function(m){ toasts.push(String(m)); },
    onClose: function(){}, setImporting: function(){},
    t: function(k){ return k; }, tf: tfN,
  });
  cloud.release();
  await settle();
  const vacio = base();
  const speculative = updater(vacio);
  await settle();
  assert.equal(vacio.expenses.length, 0, "el cálculo descartado escribió filas");
  assert.equal(speculative.expenses.length, 1);
  assert.equal(toasts.length, 0, "avisos del cálculo descartado: " + toasts.join(" | "));
  const canon = fila("uuid-canonical", "cargo-Z", { date: d2, merchant: "Inventado", category: "bares", note: "editada", source: "ob", importBatchId: null });
  const actual = base([canon]);
  const actualNext = updater(actual);
  await settle();
  assert.equal(actualNext.expenses, actual.expenses, "reescribió el histórico sin altas");
  assert.equal(actualNext.lastHistImport, actual.lastHistImport, "deshacer apunta a un lote sin altas");
  assert.equal(actualNext.expenses.length, 1);
  assert.equal(actualNext.expenses[0].id, "uuid-canonical");
  assert.equal(actualNext.expenses[0].category, "bares");
  assert.equal(actualNext.expenses[0].note, "editada");
  confirmar(actual, actualNext, toasts);
  assert.equal(toasts.length, 0, "persistió el aviso 1 con 0 altas: " + toasts.join(" | "));
  const undo = ctx.histUndoBatch(actualNext, actualNext.lastHistImport || { batchId: "hist-spec", localIds: [], cloudIds: [] });
  assert.ok((undo.nextState.expenses || []).some(function(e){ return e.id === "uuid-canonical"; }));
});

await t("una evaluación descartada con el canónico no tapa el alta que sí se confirma", async function(){
  const cloud = nube();
  const row = fila("uuid-final", "cargo-Q", { date: d2, merchant: "OTRO2" });
  let updater;
  const toasts = [];
  ctx.persistHistImport({
    cloud: cloud, expAdds: [row], fixAdds: [], batchId: "hist-inv",
    set: function(fn){ updater = fn; },
    showToast: function(m){ toasts.push(String(m)); },
    onClose: function(){}, setImporting: function(){},
    t: function(k){ return k; }, tf: tfN,
  });
  await settle();
  const canon = fila("uuid-canonical-q", "cargo-Q", { date: d2, merchant: "OTRO2", category: "bares", note: "editada", importBatchId: null });
  const conCanon = base([canon]);
  const descartado = updater(conCanon);
  await settle();
  assert.equal(toasts.length, 0, "la evaluación sin alta avisó: " + toasts.join(" | "));
  const vacio = base();
  const committed = comoApp(vacio, updater);
  await settle();
  assert.equal(toasts.length, 0, "avisó antes de confirmar: " + toasts.join(" | "));
  assert.equal(committed.expenses.length, 1);
  assert.equal(committed.expenses[0].id, "uuid-final");
  assert.equal(confirmar(vacio, committed, toasts), true);
  assert.equal(toasts.filter(function(m){ return m.indexOf("=1") >= 0; }).length, 1, "avisos=" + toasts.join(" | "));
  assert.equal(confirmar(vacio, committed, toasts), false);
  assert.equal(descartado.expenses, conCanon.expenses, "la evaluación sin alta sustituyó el canónico");
});

await t("repetir el commit del mismo batch avisa una sola vez", async function(){
  const cloud = nube();
  const row = fila("uuid-rep", "cargo-R", { date: d2, merchant: "REP" });
  let updater;
  const toasts = [];
  ctx.persistHistImport({
    cloud: cloud, expAdds: [row], fixAdds: [], batchId: "hist-rep",
    set: function(fn){ updater = fn; },
    showToast: function(m){ toasts.push(String(m)); },
    onClose: function(){}, setImporting: function(){},
    t: function(k){ return k; }, tf: tfN,
  });
  await settle();
  const vacio = base();
  const a = comoApp(vacio, updater);
  const b = comoApp(vacio, updater);
  await settle();
  assert.equal(toasts.length, 0);
  assert.equal(confirmar(vacio, a, toasts), true);
  assert.equal(confirmar(vacio, b, toasts), false);
  assert.equal(toasts.length, 1, "avisos=" + toasts.join(" | "));
  assert.ok(toasts[0].indexOf("=1") >= 0, toasts.join(" | "));
});

await t("el recibo no sale del updater y no viaja al guardar ni a la nube", async function(){
  const cuerpo = ctx.persistHistImport.toString();
  assert.equal(cuerpo.indexOf("obHistAnnounce"), -1, "el updater sigue avisando");
  assert.equal(cuerpo.indexOf("avisado"), -1);
  assert.equal(cuerpo.indexOf("Promise.resolve().then"), -1);
  const html = fs.readFileSync(fileURLToPath(new URL("../public/index.html", import.meta.url)), "utf8");
  const marca = "obHistNoticeCommit(prev, state, showToastRef.current, t, tf)";
  const enBundle = html.indexOf(marca);
  assert.ok(enBundle >= 0, "el commit de App no consume el recibo");
  assert.ok(html.slice(Math.max(0, enBundle - 600), enBundle).indexOf("mcPersistCommit") >= 0, "el aviso no está en el mismo commit que el volcado");
  const con = { budget: 3, histImportNotice: { id: "z", added: [] }, expenses: [{ id: "e", amount: 1 }] };
  const nubeState = ctx.slimForCloud(con);
  assert.equal(nubeState.histImportNotice, undefined);
  assert.equal(nubeState.budget, 3);
  ctx.mcSaveRaw("k-notice-sintetico", con);
  const disco = ctx.mcLoadRaw("k-notice-sintetico");
  assert.equal(disco.histImportNotice, undefined);
  assert.equal(disco.budget, 3);
  assert.equal(disco.expenses.length, 1);
});

function lote(cloud, expAdds, batchId) {
  const h = { queued: [], calls: [], toasts: [] };
  ctx.persistHistImport({
    cloud: cloud, expAdds: expAdds, fixAdds: [], batchId: batchId,
    set: function(fn){ h.queued.push(fn); },
    showToast: function(m){ h.toasts.push(String(m)); },
    onClose: function(){ h.calls.push("close"); },
    setImporting: function(v){ h.calls.push("importing:" + v); },
    t: function(k){ return k; }, tf: tfN,
  });
  return h;
}

await t("el lote se cierra desde el commit confirmado, no al encolar el updater", async function(){
  const cloud = nube();
  const row = fila("uuid-fin", "cargo-F", { date: d2, merchant: "FIN" });
  const h = lote(cloud, [row], "hist-fin");
  await settle();
  assert.equal(h.queued.length, 1, "no encoló el commit");
  assert.deepEqual(h.calls, [], "terminó sin commit: " + h.calls.join(","));
  const vacio = base();
  h.queued[0](vacio);
  await settle();
  assert.equal(vacio.expenses.length, 0);
  assert.deepEqual(h.calls, [], "la evaluación descartada terminó el lote: " + h.calls.join(","));
  assert.equal(h.toasts.length, 0);
  const committed = comoApp(vacio, h.queued[0]);
  confirmar(vacio, committed, h.toasts);
  assert.equal(committed.expenses.length, 1);
  assert.deepEqual(h.calls, ["importing:false", "close"], "calls=" + h.calls.join(","));
  assert.equal(h.toasts.filter(function(m){ return m.indexOf("=1") >= 0; }).length, 1, "avisos=" + h.toasts.join(" | "));
  confirmar(vacio, committed, h.toasts);
  confirmar(vacio, comoApp(vacio, h.queued[0]), h.toasts);
  const rec = committed.histImportNotice;
  const otroRecibo = Object.assign({}, committed, { histImportNotice: Object.assign({}, rec, { id: rec.id + "|otro" }) });
  confirmar(committed, otroRecibo, h.toasts);
  assert.deepEqual(h.calls, ["importing:false", "close"], "terminó dos veces: " + h.calls.join(","));
});

await t("sin altas nuevas también se cierra desde el commit, una vez y sin tocar los gastos", async function(){
  const cloud = nube();
  const row = fila("uuid-cero", "cargo-C", { date: d2, merchant: "CERO" });
  const canon = fila("uuid-canonical-c", "cargo-C", { date: d2, merchant: "CERO", category: "bares", note: "editada", source: "ob", importBatchId: null });
  const h = lote(cloud, [row], "hist-cero");
  await settle();
  assert.deepEqual(h.calls, [], "terminó sin commit: " + h.calls.join(","));
  const actual = base([canon]);
  actual.lastHistImport = { batchId: "previo", localIds: ["x"], cloudIds: [] };
  const committed = comoApp(actual, h.queued[0]);
  assert.notEqual(committed, actual, "sin commit no hay de dónde cerrar el lote");
  assert.equal(committed.expenses, actual.expenses, "reescribió el histórico sin altas");
  assert.equal(committed.lastHistImport, actual.lastHistImport, "deshacer apunta a un lote vacío");
  assert.deepEqual(h.calls, []);
  confirmar(actual, committed, h.toasts);
  assert.deepEqual(h.calls, ["importing:false", "close"], "calls=" + h.calls.join(","));
  assert.equal(h.toasts.length, 0, "avisó con 0 altas: " + h.toasts.join(" | "));
  confirmar(actual, committed, h.toasts);
  assert.deepEqual(h.calls, ["importing:false", "close"]);
});

for (const [como, cloudFallo] of [
  ["el envío falla", function(){ return Promise.reject(new Error("red")); }],
  ["el servidor no responde nada", function(){ return Promise.resolve(null); }],
]) {
  await t("si " + como + ": aviso de fallo tras el commit, sin filas, y se cierra una vez", async function(){
    const row = fila("uuid-fallo", "cargo-X", { date: d2, merchant: "FALLO" });
    const h = lote({ addExpensesBatch: cloudFallo, pullExpenses: function(){ return Promise.resolve([]); } }, [row], "hist-fallo-" + como.length);
    await settle();
    assert.deepEqual(h.calls, []);
    assert.equal(h.toasts.length, 0, "avisó antes del commit: " + h.toasts.join(" | "));
    const vacio = base();
    const committed = comoApp(vacio, h.queued[0]);
    assert.equal((committed.expenses || []).length, 0, "un fallo dejó filas");
    confirmar(vacio, committed, h.toasts);
    assert.deepEqual(h.toasts, ["⚠ bp_hist_no_ack"], "avisos=" + h.toasts.join(" | "));
    assert.deepEqual(h.calls, ["importing:false", "close"], "calls=" + h.calls.join(","));
    confirmar(vacio, committed, h.toasts);
    assert.equal(h.toasts.length, 1);
  });
}

await t("la copia diaria real no lleva el recibo y conserva la cartera entera", async function(){
  const html = fs.readFileSync(fileURLToPath(new URL("../public/index.html", import.meta.url)), "utf8");
  const tabla = [];
  const sb = {
    from: function(name){
      return {
        upsert: function(row){ tabla.push({ name: name, row: JSON.parse(JSON.stringify(row)) }); return Promise.resolve({ error: null }); },
        delete: function(){ const q = { eq: function(){ return q; }, lt: function(){ return Promise.resolve({ error: null }); } }; return q; },
      };
    },
  };
  const box = createLogicSandbox();
  box.window.supabase = { createClient: function(){ return sb; } };
  vm.runInNewContext(extractPureLogicSource(html) + "\nglobalThis.cloud = cloud;", box, { filename: "backup" });
  const gastos = [fila("uuid-g1", "cargo-1"), fila("uuid-g2", "cargo-2", { date: d2 })];
  const estado = Object.assign(base(gastos), {
    bankTx: [{ id: "tx1", amount: 3 }],
    lastHistImport: { batchId: "hist-b", localIds: ["uuid-g1"], cloudIds: [] },
    histImportNotice: { id: "hist-b|uuid-g1|0|0|0", added: [gastos[0]], spec: { expAdds: gastos } },
  });
  assert.ok(box.cloud.enabled(), "el doble de Supabase no se enganchó");
  await box.cloud.backupState("uid-sintetico", estado);
  const ups = tabla.filter(function(x){ return x.name === "state_backups"; });
  assert.equal(ups.length, 1, "no escribió la copia");
  const data = ups[0].row.data;
  assert.equal(data.histImportNotice, undefined, "el recibo viajó a la copia diaria");
  assert.equal(data.expenses.length, 2, "la copia perdió gastos");
  assert.equal(data.bankTx.length, 1, "la copia perdió movimientos");
  assert.equal(data.lastHistImport.batchId, "hist-b");
  assert.equal(data.budget, 1000);
  assert.ok(estado.histImportNotice, "quitar el recibo de la copia tocó el estado vivo");
  const app = fs.readFileSync(fileURLToPath(new URL("../src/modules/11-app-main.js", import.meta.url)), "utf8");
  const llamadas = app.match(/\bbackupState\(/g) || [];
  assert.equal(llamadas.length, 1, "otra llamada a la copia diaria: revisa que pase por el método");
});

console.log(fallos.length ? "inc-2709-06-hist-durante-ack: " + fallos.length + " fallo(s) (" + zona + ")" : "inc-2709-06-hist-durante-ack: OK (" + zona + ")");
process.exit(fallos.length ? 1 : 0);
