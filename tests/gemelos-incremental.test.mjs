// El recálculo de cada importación no se ve en el DOM: con 20.000 filas el resultado
// monetario del cálculo completo y el del índice son el mismo, y un e2e solo vería
// la pantalla igual de bien. 08-motor-bank.js y 11-app-main.js ya están en CORE
// (scripts/relevant-tests.mjs): un spec nuevo no fallaría si el reparto volviera a
// recorrer el histórico. Lo que sí falla es este proceso, porque cuenta los bancos
// que entran en gemeloAsignar al ejecutar el bloque REAL de runBankSync.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import { test } from "node:test";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const N = 20000;
const ctx = loadPureLogicFromFile();
const NOW = Date.parse("2026-06-15T12:00:00.000Z");
ctx.Date = class extends Date {
  constructor(...a){ super(...(a.length ? a : [NOW])); }
  static now(){ return NOW; }
};
const origAsignar = ctx.gemeloAsignar;
const stat = { calls: 0, banks: 0, notices: 0 };
ctx.gemeloAsignar = function(bancos, avisos, ventana){
  stat.calls++;
  stat.banks += bancos.length;
  stat.notices += avisos.length;
  return origAsignar(bancos, avisos, ventana);
};
function reset(){ stat.calls = 0; stat.banks = 0; stat.notices = 0; }
function shot(){ const s = { calls: stat.calls, banks: stat.banks, notices: stat.notices }; reset(); return s; }

function dia(i){
  return new Date(Date.UTC(2018, 0, 1) + i * 86400000).toISOString().slice(0, 10);
}
function aviso(id, i, amount){
  return { id: id, date: dia(i) + "T08:00:00.000Z", amount: amount, merchant: "Café " + id, category: "otros", source: "macrodroid", ent: "trade_republic" };
}
function banco(id, i, amount, extra){
  return Object.assign({ id: id, date: dia(i) + "T12:00:00.000Z", amount: amount, merchant: "Movimiento", category: "otros", source: "ob", ent: "trade_republic" }, extra);
}
function historia(){
  const rows = [];
  for(let i = 0; i < 6000; i++){
    const amount = (i + 1) / 100;
    rows.push(aviso("a" + i, i, amount));
    rows.push(banco("b" + i, i, amount));
  }
  for(let i = 0; i < 4000; i++){
    rows.push(banco("m" + i, 7000 + i, 40 + (i % 50), { merchant: "Mercadona " + (i % 17), extId: "ext-" + i, obName: "Mercadona " + (i % 17) }));
  }
  for(let i = 0; i < 3912; i++){
    rows.push(banco("u" + i, 12000 + i, 80 + i / 100));
  }
  // Un grupo apretado: mismo banco e importe, muchos días. Sigue siendo UN grupo.
  for(let i = 0; i < 40; i++){
    rows.push(aviso("c" + i, 16000 + i, 3.33));
    rows.push(banco("cb" + i, 16000 + i, 3.33));
  }
  for(let i = 0; i < 8; i++) rows.push(aviso("libre" + i, 17000 + i, 500 + i));
  assert.equal(rows.length, N);
  return rows;
}
function estado(expenses, extra){
  return Object.assign({
    accounts: [{ id: "tr", ent: "trade_republic", role: "diario", spendFrom: true, value: 1000 }],
    settings: { expenseBanks: ["trade_republic"] },
    expenses: expenses, gemelos: [], fixed: [], debts: [], oneoffs: [], flows: [], deleted: [],
    budget: 1000, investments: []
  }, extra);
}
// Orden de claves fijo: dos resultados con los mismos campos y el mismo orden de filas
// dan los mismos bytes. No se redondea ni se descarta un campo: si el reparto escribe
// otra marca, el JSON cambia.
function canon(s){
  const filas = (s.expenses || []).map(function(e){
    const o = {};
    Object.keys(e).sort().forEach(function(k){ o[k] = e[k]; });
    return o;
  });
  const gems = (s.gemelos || []).map(function(g){
    const o = {};
    Object.keys(g).sort().forEach(function(k){ o[k] = g[k]; });
    return o;
  });
  return JSON.stringify({ expenses: filas, gemelos: gems, deleted: s.deleted || [] });
}
// El cálculo completo es la MISMA llamada con el array anterior fuera de la caché
// (una copia de la lista, las mismas filas). No es una llamada sin `prev`: sin `prev`
// todos los avisos cuentan como históricos y el resultado cambia si el alta trae avisos.
function completo(state, prev){
  const previo = Object.assign({}, prev, { expenses: prev.expenses.slice() });
  const ahora = Object.assign({}, state, { expenses: state.expenses.slice() });
  return ctx.reconcileGemelosAutomaticos(ahora, previo);
}
function sinPrev(state){
  return ctx.reconcileGemelosAutomaticos(Object.assign({}, state, { expenses: state.expenses.slice() }));
}
function igual(a, b, msg){
  const x = canon(a), y = canon(b);
  assert.equal(x, y, msg || "el reparto incremental no coincide byte a byte con el cálculo completo");
}

const rows0 = historia();
const boot = ctx.reconcileGemelosAutomaticos(estado(rows0));
const bootWork = shot();
assert.ok(bootWork.banks > 1000, "el arranque del histórico de " + N + " tiene que repartir de verdad, no un fixture vacío (" + bootWork.banks + ")");

function bloqueReal(){
  const src = fs.readFileSync(new URL("../src/modules/11-app-main.js", import.meta.url), "utf8");
  const a = src.indexOf("const vinculos=gemelosDeImportacion(add, invState.expenses);");
  const b = src.indexOf("const pairedById", a);
  assert.ok(a > 0 && b > a, "no está el bloque de la sincronización");
  return new Function("add", "invState", "gemelosDeImportacion", "pushGemelos", "reconcileGemelosAutomaticos",
    src.slice(a, b) + "\nreturn {paired:paired,invState:invState};");
}
const correr = bloqueReal();
function alta(step, n, extra){
  const out = [];
  for(let i = 0; i < n; i++){
    out.push(banco("imp" + step + "-" + i, 18000 + step * 10 + i, 500 + step * n + i, extra));
  }
  return out;
}

test("el array del arranque sí queda en el índice; repetirlo no reparte", () => {
  reset();
  const otra = ctx.reconcileGemelosAutomaticos(boot);
  const w = shot();
  assert.equal(otra, boot);
  assert.equal(w.calls, 0);
});

test("la sincronización real solo reparte los grupos del alta, y el dinero coincide con el cálculo completo", () => {
  let inv = boot;
  for(let step = 0; step < 3; step++){
    const add = alta(step, 4);
    if(step === 2){
      // Vínculo de importación: el bloque anota gemelos ANTES de repartir. El estado
      // que se pasa tiene que ser ese, ya actualizado; si no, la referencia no casa
      // y se vuelve a tirar el índice.
      add[0] = Object.assign({}, add[0], { possibleDup: true, possibleDupOf: "libre0" });
    }
    const previo = inv;
    reset();
    const out = correr(add, previo, ctx.gemelosDeImportacion, ctx.pushGemelos, ctx.reconcileGemelosAutomaticos);
    const trabajo = shot();
    // El bloque parte de `invState` ya con los vínculos nuevos. El cálculo completo
    // usa ese mismo estado y el array anterior (el que tiene el índice).
    const estadoLlamada = Object.assign({}, out.invState, { expenses: add.concat(previo.expenses) });
    const full2 = completo(estadoLlamada, out.invState);
    const frio = sinPrev(estadoLlamada);
    igual(out.paired, full2, "paso " + step + " distinto del cálculo completo");
    igual(out.paired, frio, "paso " + step + " distinto del reparto sin estado anterior (el que hoy guarda la sync)");
    assert.ok(trabajo.banks * 10 < bootWork.banks, "paso " + step + ": la sync reparte " + trabajo.banks + " bancos; el histórico entero reparte " + bootWork.banks + ". Sin el estado anterior se recorre todo.");
    if(step === 2){
      // El `set` de después compara con el estado de ANTES de los vínculos. Si las
      // notas rehacen el array, las referencias ya no coinciden: hay que seguir
      // usando el índice, no repartir otra vez los 20.000.
      const notas = out.paired.expenses.map(function(e, i){ return i < 80 ? Object.assign({}, e, { note: "n" + i, obAcc: "ES12" }) : e; });
      const envueltoEstado = Object.assign({}, out.paired, { expenses: notas });
      reset();
      const envuelto = ctx.reconcileGemelosAutomaticos(envueltoEstado, previo);
      const w2 = shot();
      igual(envuelto, completo(envueltoEstado, previo), "el set posterior a la sync");
      assert.ok(w2.banks * 10 < bootWork.banks, "el set posterior reparte " + w2.banks);
    }
    inv = out.paired;
    assert.equal(out.invState.expenses, out.paired.expenses);
  }
});

test("importaciones seguidas por la función, con avisos nuevos, coinciden con el cálculo completo y no con una llamada fría", () => {
  let prev = boot;
  for(let step = 0; step < 3; step++){
    const add = [aviso("nuevo" + step, 19000 + step, 700 + step), banco("nb" + step, 19000 + step, 700 + step)];
    const state = Object.assign({}, prev, { expenses: add.concat(prev.expenses) });
    reset();
    const inc = ctx.reconcileGemelosAutomaticos(state, prev);
    const trabajo = shot();
    const full = completo(state, prev);
    const frio = sinPrev(state);
    igual(inc, full, "aviso nuevo " + step);
    assert.notEqual(canon(inc), canon(frio), "sin prev los avisos nuevos son históricos: no es el oráculo del alta");
    assert.ok(trabajo.banks * 10 < bootWork.banks, "aviso nuevo " + step + " reparte " + trabajo.banks);
    prev = inc;
  }
});

test("invalidaciones: categoría, importe, borrado, grupo apretado, lápida, vínculos y array sin índice", () => {
  // Categoría: no entra en la firma del par. Cero reparto.
  {
    const rows = boot.expenses.slice();
    rows[3] = Object.assign({}, rows[3], { category: "comida" });
    const state = Object.assign({}, boot, { expenses: rows });
    reset();
    const inc = ctx.reconcileGemelosAutomaticos(state, boot);
    const w = shot();
    igual(inc, completo(state, boot));
    assert.equal(w.calls, 0, "cambiar la categoría no reparte");
  }
  // Nota en filas viejas: tampoco. El alta nueva sí reparte su grupo.
  {
    const rows = boot.expenses.map(function(e, i){ return i < 100 ? Object.assign({}, e, { note: "concepto " + i }) : e; });
    const add = alta(9, 2);
    const state = Object.assign({}, boot, { expenses: add.concat(rows) });
    reset();
    const inc = ctx.reconcileGemelosAutomaticos(state, boot);
    const w = shot();
    igual(inc, completo(state, boot));
    igual(inc, sinPrev(state));
    assert.ok(w.banks * 10 < bootWork.banks, "notas + alta: " + w.banks);
  }
  // Mover el importe cambia de grupo (el viejo y el nuevo).
  {
    const rows = boot.expenses.slice();
    const moved = Object.assign({}, rows.find(function(e){ return e.id === "b10"; }), { amount: 4242.42 });
    rows[rows.findIndex(function(e){ return e.id === "b10"; })] = moved;
    const state = Object.assign({}, boot, { expenses: rows });
    reset();
    const inc = ctx.reconcileGemelosAutomaticos(state, boot);
    const w = shot();
    igual(inc, completo(state, boot));
    assert.ok(w.banks > 0 && w.banks * 10 < bootWork.banks, "mover importe: " + w.banks);
  }
  // Quitar una fila.
  {
    const rows = boot.expenses.filter(function(e){ return e.id !== "b20" && e.id !== "a20"; });
    const state = Object.assign({}, boot, { expenses: rows });
    reset();
    const inc = ctx.reconcileGemelosAutomaticos(state, boot);
    const w = shot();
    igual(inc, completo(state, boot));
    assert.ok(w.banks * 10 < bootWork.banks, "borrar par: " + w.banks);
  }
  // Tres bancos más en el grupo apretado de 3,33.
  {
    const add = [];
    for(let i = 0; i < 3; i++) add.push(banco("crowd" + i, 16100 + i, 3.33));
    const state = Object.assign({}, boot, { expenses: add.concat(boot.expenses) });
    reset();
    const inc = ctx.reconcileGemelosAutomaticos(state, boot);
    const w = shot();
    igual(inc, completo(state, boot));
    igual(inc, sinPrev(state));
    assert.ok(w.banks < 200 && w.banks * 10 < bootWork.banks, "grupo apretado: " + w.banks);
  }
  // Lápida nueva: la referencia de deleted cambia. Solo su grupo.
  {
    const fila = boot.expenses.find(function(e){ return e.id === "b30"; });
    const key = ctx.keyOfExpense(fila);
    const state = Object.assign({}, boot, { deleted: [key], expenses: boot.expenses.slice() });
    reset();
    const inc = ctx.reconcileGemelosAutomaticos(state, boot);
    const w = shot();
    igual(inc, completo(state, boot));
    assert.ok(w.banks * 10 < bootWork.banks, "lápida: " + w.banks + " bancos");
  }
  // Misma lista de lápidas, otra referencia, y una nota. No hay nada que repartir.
  {
    const deleted = boot.deleted.slice();
    const rows = boot.expenses.slice();
    rows[1] = Object.assign({}, rows[1], { note: "solo nota" });
    const state = Object.assign({}, boot, { deleted: deleted, expenses: rows });
    reset();
    const inc = ctx.reconcileGemelosAutomaticos(state, boot);
    const w = shot();
    igual(inc, completo(state, boot));
    assert.equal(w.calls, 0, "lápidas iguales y una nota: " + w.banks);
  }
  // Vínculo nuevo sobre filas que ya están. Cambia la referencia de gemelos.
  {
    const avisoFila = boot.expenses.find(function(e){ return e.id === "libre1"; });
    const bancoFila = boot.expenses.find(function(e){ return e.id === "b40"; });
    const decision = Object.assign(ctx.gemeloDe(avisoFila, bancoFila), { auto: true, ent: "trade_republic", at: 2 });
    const gemelos = ctx.pushGemelos(boot.gemelos, [decision]);
    const rows = boot.expenses.slice();
    rows[0] = Object.assign({}, rows[0], { obAcc: "ES00" });
    const state = Object.assign({}, boot, { gemelos: gemelos, expenses: rows });
    reset();
    const inc = ctx.reconcileGemelosAutomaticos(state, boot);
    const w = shot();
    igual(inc, completo(state, boot));
    assert.ok(w.banks * 10 < bootWork.banks, "vínculo nuevo: " + w.banks + " bancos");
  }
  // Decisión que no está en ninguna fila: se reparte todo, y el dinero sigue igual.
  {
    const gemelos = [{ aviso: "no-esta", avisoId: "fantasma", banco: "tampoco" }];
    const state = Object.assign({}, boot, { gemelos: gemelos, expenses: boot.expenses.slice() });
    const inc = ctx.reconcileGemelosAutomaticos(state, boot);
    igual(inc, completo(state, boot), "decisión ilocalizable");
  }
  // Hipótesis del array nunca indexado: un JSON nuevo no está en la caché y el
  // primer reparto es completo. El segundo, sobre el resultado, ya no.
  {
    const parsed = JSON.parse(JSON.stringify(boot.expenses));
    const prev = Object.assign({}, boot, { expenses: parsed });
    const add = alta(11, 2);
    const state = Object.assign({}, prev, { expenses: add.concat(parsed) });
    reset();
    const primero = ctx.reconcileGemelosAutomaticos(state, prev);
    const w1 = shot();
    igual(primero, completo(state, prev));
    assert.ok(w1.banks * 2 > bootWork.banks, "sin índice previo el primer reparto recorre el histórico (" + w1.banks + ")");
    const add2 = alta(12, 2);
    const state2 = Object.assign({}, primero, { expenses: add2.concat(primero.expenses) });
    reset();
    const segundo = ctx.reconcileGemelosAutomaticos(state2, primero);
    const w2 = shot();
    igual(segundo, completo(state2, primero));
    igual(segundo, sinPrev(state2));
    assert.ok(w2.banks * 10 < bootWork.banks, "el segundo alta ya reutiliza el índice (" + w2.banks + ")");
  }
});

function mundoPequeno(){
  const day = "2026-06-01T12:00:00.000Z";
  const day2 = "2026-06-04T12:00:00.000Z";
  return [
    { id: "a3", date: day, amount: 14.5, merchant: "Café a3", category: "otros", source: "macrodroid", ent: "trade_republic" },
    { id: "b14", date: day, amount: 14.5, merchant: "Movimiento", category: "otros", source: "ob", ent: "trade_republic" },
    { id: "m1", date: day, amount: 14.5, merchant: "Nómina", category: "ingreso", source: "manual" },
    { id: "b30", date: day2, amount: 30, merchant: "Movimiento", category: "otros", source: "ob", ent: "trade_republic" },
    { id: "a30", date: day2, amount: 30, merchant: "Café 30", category: "otros", source: "macrodroid", ent: "trade_republic" }
  ];
}
function presupuesto(s){
  return Math.round((s.expenses || []).reduce(function(a, e){ return a + (ctx.expenseCountsBudget(e, s) ? e.amount : 0); }, 0) * 100);
}
test("borrar un manual enlazado y un vínculo de otro grupo coinciden con el cálculo completo", () => {
  const bootP = ctx.reconcileGemelosAutomaticos(estado(mundoPequeno()));
  const enlazado = bootP.expenses.map(function(e){ return e.id === "b14" ? Object.assign({}, e, { possibleDup: true, possibleDupOf: "m1" }) : e; });
  const llamada = estado(enlazado);
  const puesto = ctx.reconcileGemelosAutomaticos(llamada, bootP);
  igual(puesto, completo(llamada, bootP), "el enlace al manual sin banco no se sustituye por el aviso del grupo");
  const previo = completo(llamada, bootP);
  const clave = ctx.expenseDeletionKey(previo.expenses.find(function(e){ return e.id === "m1"; }));
  ["lapida", "fuera", "las dos"].forEach(function(modo){
    const expenses = modo === "lapida" ? previo.expenses.slice() : previo.expenses.filter(function(e){ return e.id !== "m1"; });
    const deleted = modo === "fuera" ? previo.deleted : [clave];
    const st = Object.assign({}, previo, { expenses: expenses, deleted: deleted });
    reset();
    const inc = ctx.reconcileGemelosAutomaticos(st, previo);
    const w = shot();
    igual(inc, completo(st, previo), "borrar m1 (" + modo + "): b14 tiene que pasar al aviso de su grupo");
    assert.equal(presupuesto(inc), presupuesto(completo(st, previo)), "el presupuesto de borrar m1 (" + modo + ")");
    assert.ok(w.banks * 10 < bootWork.banks, "borrar m1 no reparte el histórico (" + w.banks + ")");
  });
  // R1: el banco de 30 € vive en otro grupo que el manual. El cálculo completo
  // conserva ese enlace y, al borrar el manual, lo pasa a su aviso. En 561b8fe5 el
  // banco se quedaba apuntando al manual.
  const suelto = ctx.reconcileGemelosAutomaticos(estado(mundoPequeno()));
  const cruce = suelto.expenses.map(function(e){ return e.id === "b30" ? Object.assign({}, e, { possibleDup: true, possibleDupOf: "m1" }) : e; });
  const conCruce = estado(cruce);
  const baseCruce = completo(conCruce, suelto);
  assert.equal(baseCruce.expenses.find(function(e){ return e.id === "b30"; }).possibleDupOf, "m1", "el enlace entre grupos tiene que quedar en el manual");
  const claveCruce = ctx.expenseDeletionKey(baseCruce.expenses.find(function(e){ return e.id === "m1"; }));
  const stCruce = Object.assign({}, baseCruce, { deleted: [claveCruce], expenses: baseCruce.expenses.slice() });
  const incCruce = ctx.reconcileGemelosAutomaticos(stCruce, baseCruce);
  igual(incCruce, completo(stCruce, baseCruce), "vínculo entre grupos");
  assert.equal(presupuesto(incCruce), presupuesto(completo(stCruce, baseCruce)));
  assert.equal(incCruce.expenses.find(function(e){ return e.id === "b30"; }).possibleDupOf, "a30");
  // R2: el bloque real de la sync parte de ese estado y tiene que heredar el arreglo.
  const add = alta(40, 1);
  reset();
  const out = correr(add, incCruce, ctx.gemelosDeImportacion, ctx.pushGemelos, ctx.reconcileGemelosAutomaticos);
  const trabajo = shot();
  const estadoLlamada = Object.assign({}, out.invState, { expenses: add.concat(incCruce.expenses) });
  igual(out.paired, completo(estadoLlamada, out.invState), "la sync real después del borrado");
  assert.ok(trabajo.banks * 10 < bootWork.banks, "la sync real reparte " + trabajo.banks);
  // R3: la absorción y el dueño cambian la lápida sin tocar `deleted`.
  const owner = "11111111-1111-4111-8111-111111111111";
  const conExt = incCruce.expenses.map(function(e){ return e.id === "b30" ? Object.assign({}, e, { extId: "ref-b30", obAcc: "ES1" }) : e; });
  const conDueno = ctx.reconcileGemelosAutomaticos(Object.assign({}, incCruce, { expenses: conExt, _historyOwner: owner, obAbsorbedPending: [], obAbsorbedConfirmed: [] }), incCruce);
  const fila = conDueno.expenses.find(function(e){ return e.id === "b30"; });
  const abs = ctx.obAbsorptionKey(fila);
  const otra = ctx.obAbsorptionKey(Object.assign({}, fila, { extId: "otra-ref" }));
  const pending = [{ owner: owner, id: "22222222-2222-4222-8222-222222222222", key: abs, keepId: "33333333-3333-4333-8333-333333333333", keepKey: otra, merchant: "Movimiento", amount: 30 }];
  assert.equal(ctx.obAbsorbedValid(pending[0], owner), true);
  const stAbs = Object.assign({}, conDueno, { expenses: conDueno.expenses.slice(), obAbsorbedPending: pending });
  igual(ctx.reconcileGemelosAutomaticos(stAbs, conDueno), completo(stAbs, conDueno), "obAbsorbedPending");
  const stDueno = Object.assign({}, conDueno, { expenses: conDueno.expenses.slice(), _historyOwner: "44444444-4444-4444-8444-444444444444" });
  igual(ctx.reconcileGemelosAutomaticos(stDueno, conDueno), completo(stDueno, conDueno), "_historyOwner");
  const stConf = Object.assign({}, conDueno, { expenses: conDueno.expenses.slice(), obAbsorbedConfirmed: [] });
  igual(ctx.reconcileGemelosAutomaticos(stConf, conDueno), completo(stConf, conDueno), "obAbsorbedConfirmed");
});

function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
// Semillas fijas. Si una falla, el mensaje lleva la semilla y la cadena para repetirla.
const SEMILLAS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
test("fuzz reproducible: cada semilla coincide con el cálculo completo", () => {
  SEMILLAS.forEach(function(seed){
    const rnd = mulberry32(seed);
    const pick = function(list){ return list[Math.floor(rnd() * list.length)]; };
    let prev = ctx.reconcileGemelosAutomaticos(estado(mundoPequeno()));
    const chain = [];
    for(let step = 0; step < 12; step++){
      const op = Math.floor(rnd() * 7);
      let expenses = prev.expenses.slice();
      let deleted = (prev.deleted || []).slice();
      let gemelos = (prev.gemelos || []).slice();
      const live = expenses.filter(Boolean);
      let label = "";
      if(op === 0){
        const amount = [3.5, 14.5, 30, 21][Math.floor(rnd() * 4)];
        const id = "n" + seed + "-" + step;
        expenses.unshift(banco(id, 20000 + step, amount));
        label = "alta " + id + " " + amount;
      } else if(op === 1){
        const id = "v" + seed + "-" + step;
        expenses.unshift(aviso(id, 21000 + step, pick(live).amount));
        label = "aviso " + id;
      } else if(op === 2){
        const e = pick(live), otro = pick(live);
        const i = expenses.findIndex(function(x){ return x.id === e.id; });
        expenses[i] = Object.assign({}, e, { possibleDup: true, possibleDupOf: otro.id });
        label = "enlace " + e.id + "->" + otro.id;
      } else if(op === 3){
        const e = pick(live);
        deleted.push(ctx.expenseDeletionKey(e));
        label = "lápida " + e.id;
      } else if(op === 4 && live.length > 3){
        const e = pick(live);
        expenses = expenses.filter(function(x){ return x.id !== e.id; });
        deleted.push(ctx.expenseDeletionKey(e));
        label = "borrar " + e.id;
      } else if(op === 5){
        const e = pick(live);
        const i = expenses.findIndex(function(x){ return x.id === e.id; });
        const amount = [14.5, 30, 8, 40][Math.floor(rnd() * 4)];
        expenses[i] = Object.assign({}, e, { amount: amount });
        label = "importe " + e.id + " " + amount;
      } else if(live.length > 1){
        const a = pick(live), b = pick(live.filter(function(x){ return x.source === "ob"; }));
        if(b){
          gemelos = ctx.pushGemelos(gemelos, [Object.assign(ctx.gemeloDe(a, b), { at: step + 2 })]);
          label = "decisión " + a.id + " " + b.id;
        }
      }
      if(!label) continue;
      chain.push(label);
      const st = Object.assign({}, prev, { expenses: expenses, deleted: deleted, gemelos: gemelos });
      const inc = ctx.reconcileGemelosAutomaticos(st, prev);
      const full = completo(st, prev);
      const donde = "semilla " + seed + " paso " + step + " [" + chain.join(" | ") + "]";
      igual(inc, full, donde);
      assert.equal(presupuesto(inc), presupuesto(full), "presupuesto " + donde);
      prev = inc;
    }
  });
});

function mediana(xs){
  const s = xs.slice().sort(function(a, b){ return a - b; });
  return s[Math.floor(s.length / 2)];
}
test("benchmark A/B de una importación", { skip: process.env.GEMELOS_BENCH !== "1" }, () => {
  // Dos sandboxes: el lado A (la llamada de la base, sin prev) no puede dejar el
  // índice caliente para el lado B. Se mide solo la importación, tras un arranque
  // igual y una vuelta de calentamiento que no entra en la mediana.
  function reloj(c){
    c.Date = class extends Date {
      constructor(...args){ super(...(args.length ? args : [NOW])); }
      static now(){ return NOW; }
    };
  }
  function espiar(c){
    const orig = c.gemeloAsignar;
    const local = { banks: 0 };
    c.gemeloAsignar = function(bancos, avisos, ventana){
      local.banks += bancos.length;
      return orig(bancos, avisos, ventana);
    };
    local.quitar = function(){ c.gemeloAsignar = orig; };
    return local;
  }
  const a = loadPureLogicFromFile();
  const b = loadPureLogicFromFile();
  reloj(a); reloj(b);
  const bootA = a.reconcileGemelosAutomaticos(estado(historia()));
  const bootB = b.reconcileGemelosAutomaticos(estado(historia()));
  const addDe = function(tag){
    return [0, 1, 2, 3].map(function(i){ return banco("bench-" + tag + "-" + i, 18100 + i, 500 + i); });
  };
  const firma = function(s){
    return (s.expenses || []).map(function(e){
      return [String(e.id).replace(/bench-[^-]+-/, "bench-X-"), e.amount, e.possibleDup ? 1 : 0, e.possibleDupOf || "", e.autoGemelo || "", e.gemeloSeparado || ""].join("|");
    }).join("\n");
  };
  const vueltas = 5;
  const tiemposA = [], tiemposB = [];
  let bancosA = 0, bancosB = 0, igualCanon = false;
  a.reconcileGemelosAutomaticos(Object.assign({}, bootA, { expenses: addDe("wa").concat(bootA.expenses) }));
  b.reconcileGemelosAutomaticos(Object.assign({}, bootB, { expenses: addDe("wb").concat(bootB.expenses) }), bootB);
  let prevA = bootA, prevB = bootB;
  for(let i = 0; i < vueltas; i++){
    const sa = Object.assign({}, prevA, { expenses: addDe("A" + i).concat(prevA.expenses) });
    const sb = Object.assign({}, prevB, { expenses: addDe("B" + i).concat(prevB.expenses) });
    const spyA = espiar(a), spyB = espiar(b);
    const t0 = performance.now();
    const ra = a.reconcileGemelosAutomaticos(sa);
    tiemposA.push(performance.now() - t0);
    bancosA = spyA.banks;
    spyA.quitar();
    const t1 = performance.now();
    const rb = b.reconcileGemelosAutomaticos(sb, prevB);
    tiemposB.push(performance.now() - t1);
    bancosB = spyB.banks;
    spyB.quitar();
    if(i === vueltas - 1) igualCanon = firma(ra) === firma(rb);
    prevA = ra;
    prevB = rb;
  }
  const informe = {
    n: N,
    vueltas: vueltas,
    medianaMsSinPrev: Math.round(mediana(tiemposA) * 100) / 100,
    medianaMsConPrev: Math.round(mediana(tiemposB) * 100) / 100,
    tiemposSinPrev: tiemposA.map(function(x){ return Math.round(x * 100) / 100; }),
    tiemposConPrev: tiemposB.map(function(x){ return Math.round(x * 100) / 100; }),
    bancosUltimaSinPrev: bancosA,
    bancosUltimaConPrev: bancosB,
    canonIgual: igualCanon,
    node: process.version,
    plataforma: process.platform + " " + os.release() + " " + os.arch(),
    cpus: os.cpus()[0] && os.cpus()[0].model,
    comando: "GEMELOS_BENCH=1 node tests/gemelos-incremental.test.mjs"
  };
  console.log("BENCH " + JSON.stringify(informe));
  // El reloj se imprime y no decide: en este proceso varía, y un umbral de
  // milisegundos se pondría verde o rojo según la máquina. Lo que falla si se
  // vuelve a recorrer el histórico es el recuento de bancos, que es fijo.
  assert.equal(igualCanon, true, "A/B de dinero");
  assert.ok(bancosB * 10 < bancosA, "el lado con prev reparte " + bancosB + " y el lado sin prev " + bancosA);
});
