#!/usr/bin/env node
/**
 * INC-2709-06, reintento del sync diario con el setter de App diferido. El primer
 * envío de cargo-B choca con cargo-A (misma terna, otra referencia) y el reintento
 * se decide en `obSettleDaily`. En App, `set` solo encola el updater: lo que el
 * updater calcule no existe hasta que React lo compromete, puede evaluarse y
 * tirarse, o evaluarse dos veces.
 *
 * Aquí corre el caller real: el callback marcado de `11-app-main.js`, el `set` de
 * App sacado de ese mismo fichero y `persistObImport -> obChaseRounds ->
 * obSettleDaily` del bundle. El setter de React es una cola que se aplica en orden
 * al comprometer; el commit llama a lo que llame el `useLayoutEffect` de App.
 *
 * Datos inventados. UTC y Europe/Madrid.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
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
const appSrc = fs.readFileSync(path.join(root, "src/modules/11-app-main.js"), "utf8");
const html = fs.readFileSync(path.join(root, "public/index.html"), "utf8");

function entre(src, a, b) {
  const i = src.indexOf(a);
  if (i < 0) throw new Error("no está «" + a + "»");
  const j = src.indexOf(b, i + a.length);
  if (j < 0) throw new Error("no cierra «" + a + "»");
  return src.slice(i + a.length, j);
}
const dailyBody = entre(appSrc, "/* OB-ACK-DAILY */", "/* /OB-ACK-DAILY */");
const setIni = "const set=useCallback(";
const setDecl = setIni + entre(appSrc, setIni, "},[]);") + "},[]);";
assert.ok(setDecl.indexOf("setStateRaw(prev=>") >= 0, "el set de App ya no pasa por setStateRaw");
const runDaily = vm.runInContext("(function(obAdded, cloud, set){\n" + dailyBody + "\n})", ctx);
const appSet = vm.runInContext(
  "(function(setStateRaw){ const useCallback=function(fn){ return fn; };\n" + setDecl + "\nreturn set; })",
  ctx,
);

/* Lo que hace React con la cola de un useState: el updater no se aplica al encolar.
   Al comprometer se aplican en orden sobre el estado comprometido y, si cambia la
   referencia, corre el layout effect de App con (prev, state). `doble` evalúa cada
   updater dos veces y se queda la segunda, como StrictMode. */
function reactHook(inicial) {
  const h = { state: inicial, queue: [], commits: 0 };
  h.setStateRaw = function(fn){ h.queue.push(fn); };
  h.set = appSet(h.setStateRaw);
  h.render = function(base){
    let s = base;
    h.queue.forEach(function(fn){ s = typeof fn === "function" ? fn(s) : fn; });
    return s;
  };
  h.commit = function(opts){
    opts = opts || {};
    if (!h.queue.length) return false;
    let next = h.render(h.state);
    if (opts.doble) next = h.render(h.state);
    h.queue = [];
    if (next === h.state) return false;
    const prev = h.state;
    h.state = next;
    h.commits++;
    h.layout(prev, next);
    return true;
  };
  // Otra actualización con más prioridad se compromete sola; la del reintento sigue en cola.
  h.commitSolo = function(fn){
    const next = fn(h.state);
    if (next === h.state) return false;
    const prev = h.state;
    h.state = Object.assign({}, next, { _savedAt: Date.now() });
    h.commits++;
    h.layout(prev, h.state);
    return true;
  };
  h.layout = function(prev, next){
    if (typeof ctx.obDailyCommit === "function") ctx.obDailyCommit(prev, next);
  };
  return h;
}

function drain() {
  return new Promise(function(res){ setImmediate(res); });
}
async function settle() {
  for (let i = 0; i < 30; i++) await drain();
}

const FECHA = "2026-10-05T06:01:23.456Z";
function cargoB(extra) {
  return Object.assign({
    id: "uuid-fixture", date: FECHA, amount: 12.5, merchant: "MERCADONA", category: "super",
    source: "ob", ent: "caixabank", extId: "cargo-B", obName: "MERCADONA",
  }, extra || {});
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
/* El índice de la nube ignora la terna repetida y solo devuelve lo insertado. cargo-A
   ya ocupa el sello de cargo-B, con otra referencia. */
function nube() {
  const rows = [{
    id: "uuid-cargo-A", fecha: FECHA, importe: 12.5, comercio: "MERCADONA",
    cat: "super", source: "ob:caixabank#x.cargo-A",
  }];
  const api = {
    rows: rows,
    envios: [],
    acks: [],
    _gate: null,
    _delay: false,
    enabled: function(){ return true; },
    delayNext: function(){ this._delay = true; },
    release: function(){ const g = this._gate; this._gate = null; if (g) g(); },
    addExpensesBatch: function(list){
      api.envios.push((list || []).map(function(e){ return Object.assign({}, e); }));
      const accepted = [];
      (list || []).forEach(function(e){
        const k = new Date(e.date).toISOString() + "|" + (Number(e.amount) || 0) + "|" + (e.merchant || "");
        if (rows.some(function(r){ return new Date(r.fecha).toISOString() + "|" + (Number(r.importe) || 0) + "|" + (r.comercio || "") === k; })) return;
        rows.push({ id: e.id, fecha: e.date, importe: e.amount, comercio: e.merchant, cat: e.category, source: ctx.expenseSourceForCloud(e) });
        accepted.push(e.id);
      });
      api.acks.push(accepted.slice());
      const out = { cloudIds: accepted, offline: false };
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
function local(h, id) {
  return (h.state.expenses || []).filter(function(e){ return e && e.id === id; });
}

const fallos = [];
async function t(nombre, fn) {
  try { await fn(); console.log("  ✓ " + nombre); }
  catch (e) { fallos.push(nombre); console.error("  ✗ " + nombre + "\n      " + (e && e.message)); }
}

console.log("inc-2709-06-diario-diferido (" + zona + ")");

await t("con el setter diferido, el reintento sale tras el commit y con la fecha comprometida", async function(){
  const cloud = nube();
  const b = cargoB();
  const h = reactHook(estado([b]));
  runDaily([b], cloud, h.set);
  await settle();
  assert.equal(cloud.envios.length, 1, "envíos antes del commit=" + cloud.envios.length);
  assert.deepEqual(cloud.acks[0], [], "el primer envío tenía que chocar");
  assert.equal(h.queue.length, 1, "updaters en cola=" + h.queue.length);
  assert.equal(local(h, "uuid-fixture")[0].date, FECHA, "cambió el estado sin commit");
  h.commit();
  await settle();
  const fila = local(h, "uuid-fixture");
  assert.equal(fila.length, 1);
  assert.notEqual(fila[0].date, FECHA, "el commit no movió la fecha local");
  assert.equal(fila[0].date.slice(0, 10), FECHA.slice(0, 10), "el sello cambió de día");
  assert.equal(cloud.envios.length, 2, "esperado 2 envíos, obtenido " + cloud.envios.length);
  assert.equal(cloud.envios[1].length, 1);
  assert.equal(cloud.envios[1][0].id, "uuid-fixture", "el reintento no lleva el uuid de cargo-B");
  assert.equal(cloud.envios[1][0].extId, "cargo-B");
  assert.equal(cloud.envios[1][0].date, fila[0].date, "la nube y el local quedan con fechas distintas");
  assert.deepEqual(cloud.acks[1], ["uuid-fixture"], "ACK del segundo=" + cloud.acks[1]);
  const ids = cloud.rows.map(function(r){ return ctx.expenseFromRow(r).extId; }).sort();
  assert.deepEqual(ids, ["cargo-A", "cargo-B"], "nube=" + ids.join(","));
  await settle();
  assert.equal(cloud.envios.length, 2, "subió otra vez");
});

await t("una evaluación descartada no envía nada; sale el estado que se compromete", async function(){
  const cloud = nube();
  const b = cargoB();
  const h = reactHook(estado([b]));
  runDaily([b], cloud, h.set);
  await settle();
  assert.equal(h.queue.length, 1);
  const otra = h.render(estado([cargoB({ category: "descartada", note: "no-comprometida" })]));
  await settle();
  assert.ok(otra && otra.expenses, "el updater no devolvió estado");
  assert.equal(cloud.envios.length, 1, "la evaluación descartada envió: " + cloud.envios.length);
  h.render(estado([]));
  await settle();
  assert.equal(cloud.envios.length, 1, "la evaluación sin la fila envió");
  h.commit();
  await settle();
  assert.equal(cloud.envios.length, 2, "esperado 2 envíos, obtenido " + cloud.envios.length);
  const sub = cloud.envios[1][0];
  assert.equal(sub.category, "super", "subió la categoría de una evaluación descartada");
  assert.equal(sub.note, undefined);
  assert.equal(sub.date, local(h, "uuid-fixture")[0].date);
});

await t("el replay del updater y un layout repetido no suben dos veces", async function(){
  const cloud = nube();
  const b = cargoB();
  const h = reactHook(estado([b]));
  runDaily([b], cloud, h.set);
  await settle();
  h.render(h.state);
  h.commit({ doble: true });
  await settle();
  const prev = h.state;
  h.layout(estado([b]), prev);
  h.layout(prev, Object.assign({}, prev, { _savedAt: 2 }));
  await settle();
  assert.equal(cloud.envios.length, 2, "envíos=" + cloud.envios.length);
  assert.equal(cloud.rows.filter(function(r){ return r.id === "uuid-fixture"; }).length, 1);
  assert.equal(h.commits, 1, "commits=" + h.commits);
});

await t("un commit que aún no lleva el refechado no sube la fecha que choca", async function(){
  const cloud = nube();
  const b = cargoB();
  const h = reactHook(estado([b]));
  runDaily([b], cloud, h.set);
  await settle();
  assert.equal(h.queue.length, 1);
  h.commitSolo(function(s){ return Object.assign({}, s, { budget: 999 }); });
  await settle();
  assert.equal(cloud.envios.length, 1, "subió con la fecha de antes del commit: " + JSON.stringify(cloud.envios[1] && cloud.envios[1].map(function(e){ return e.date; })));
  h.commit();
  await settle();
  assert.equal(cloud.envios.length, 2, "esperado 2 envíos, obtenido " + cloud.envios.length);
  assert.equal(cloud.envios[1][0].date, local(h, "uuid-fixture")[0].date);
  assert.deepEqual(cloud.acks[1], ["uuid-fixture"]);
});

await t("borrar durante el ACK: ni vuelve en local ni sube", async function(){
  const cloud = nube();
  const b = cargoB();
  const h = reactHook(estado([b]));
  cloud.delayNext();
  runDaily([b], cloud, h.set);
  h.set(function(s){
    return Object.assign({}, s, { expenses: [], deleted: (s.deleted || []).concat(ctx.expenseTombKeys(b)) });
  });
  h.commit();
  cloud.release();
  await settle();
  h.commit();
  await settle();
  assert.equal(local(h, "uuid-fixture").length, 0, "volvió en local");
  assert.equal(cloud.envios.length, 1, "subió una fila borrada");
  assert.ok(!cloud.rows.some(function(r){ return r.id === "uuid-fixture"; }));
});

await t("borrar entre el encolado y el commit: el commit manda", async function(){
  const cloud = nube();
  const b = cargoB();
  const h = reactHook(estado([b]));
  runDaily([b], cloud, h.set);
  await settle();
  assert.equal(h.queue.length, 1);
  h.set(function(s){
    return Object.assign({}, s, { expenses: [], deleted: (s.deleted || []).concat(ctx.expenseTombKeys(b)) });
  });
  h.commit();
  await settle();
  assert.equal(local(h, "uuid-fixture").length, 0, "volvió en local");
  assert.equal(cloud.envios.length, 1, "subió una fila borrada en el mismo commit");
});

await t("editar categoría durante el ACK: el reintento lleva la edición, el mismo uuid", async function(){
  const cloud = nube();
  const b = cargoB();
  const h = reactHook(estado([b]));
  cloud.delayNext();
  runDaily([b], cloud, h.set);
  h.set(function(s){
    return Object.assign({}, s, { expenses: s.expenses.map(function(e){ return e.id === "uuid-fixture" ? Object.assign({}, e, { category: "bares", note: "editada" }) : e; }) });
  });
  h.commit();
  cloud.release();
  await settle();
  h.commit();
  await settle();
  const fila = local(h, "uuid-fixture");
  assert.equal(fila.length, 1);
  assert.equal(fila[0].category, "bares");
  assert.equal(fila[0].note, "editada");
  assert.equal(cloud.envios.length, 2, "esperado 2 envíos, obtenido " + cloud.envios.length);
  const sub = cloud.envios[1][0];
  assert.equal(sub.id, "uuid-fixture");
  assert.equal(sub.category, "bares");
  assert.equal(sub.note, "editada");
  assert.equal(sub.date, fila[0].date);
  assert.deepEqual(cloud.acks[1], ["uuid-fixture"]);
});

await t("editar el comercio durante el ACK: no se refecha, sube lo editado con el mismo uuid", async function(){
  const cloud = nube();
  const b = cargoB();
  const h = reactHook(estado([b]));
  cloud.delayNext();
  runDaily([b], cloud, h.set);
  h.set(function(s){
    return Object.assign({}, s, { expenses: s.expenses.map(function(e){ return e.id === "uuid-fixture" ? Object.assign({}, e, { merchant: "OTRO" }) : e; }) });
  });
  h.commit();
  cloud.release();
  await settle();
  h.commit();
  await settle();
  const fila = local(h, "uuid-fixture");
  assert.equal(fila.length, 1);
  assert.equal(fila[0].merchant, "OTRO");
  assert.equal(fila[0].date, FECHA, "refechó una fila editada");
  assert.equal(cloud.envios.length, 2, "esperado 2 envíos, obtenido " + cloud.envios.length);
  assert.equal(cloud.envios[1][0].id, "uuid-fixture");
  assert.equal(cloud.envios[1][0].merchant, "OTRO");
  assert.equal(cloud.envios[1][0].date, FECHA);
});

await t("el commit de App consume el reintento en el mismo layout que el volcado", async function(){
  const marca = "obDailyCommit(prev, state);";
  const i = html.indexOf(marca);
  assert.equal(html.indexOf(marca, i + 1), -1, "más de un consumidor del reintento");
  assert.ok(i >= 0, "el layout effect de App no llama a " + marca);
  const antes = html.slice(Math.max(0, i - 800), i);
  assert.ok(antes.indexOf("mcPersistCommit") >= 0, "no está en el mismo commit que el volcado");
  assert.ok(antes.indexOf("useLayoutEffect") >= 0, "no es el layout effect");
});

console.log(fallos.length ? "inc-2709-06-diario-diferido: " + fallos.length + " fallo(s) (" + zona + ")" : "inc-2709-06-diario-diferido: OK (" + zona + ")");
process.exit(fallos.length ? 1 : 0);
