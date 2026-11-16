#!/usr/bin/env node
/**
 * ROUND UP Y SAVEBACK QUE AVISA TRADE REPUBLIC (16/11/2026, petición del dueño).
 *
 * `ingest` apunta «Round up» y «Saveback» en Inversión. Aquí se fija lo que hace la app con ese
 * dinero, que es lo que de verdad importa:
 *   · se suma UNA vez a la posición elegida (aportación y coste), y nunca hacia atrás;
 *   · el Round up sale del efectivo; el Saveback no (lo pone TR);
 *   · ni gasto ni ingreso del mes;
 *   · cuando el banco trae después sus apuntes sin nombre, no se cuentan otra vez ni en el
 *     saldo ni en la posición;
 *   · la estimación del redondeo deja paso a lo real y solo mira compras del propio banco
 *     (no el efectivo ni otros bancos: el pendiente «roundup/saveback contando cash y otros bancos»).
 * Siembra DOS bancos (TR diario + Sabadell) y efectivo: así se ve que nada de fuera se cuela.
 * Nombres y cifras inventados. Correr también con TZ=UTC (la CI de beta va en UTC).
 */
import assert from "node:assert/strict";
import { mock } from "node:test";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

mock.timers.enable({ apis: ["Date"], now: new Date("2026-09-15T12:00:00Z") });
const ctx = loadPureLogicFromFile();

let failed = 0;
function t(name, fn) {
  try { fn(); console.log("  ✓ " + name); }
  catch (e) { failed++; console.error("  ✗ " + name + "\n" + e.stack); }
}
console.log("recompensas-tr");

const NOW = Date.now();
const ymd = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const dia = (off) => { const n = new Date(); return ymd(new Date(n.getFullYear(), n.getMonth(), n.getDate() + off)); };
const iso = (off, h) => new Date(dia(off) + "T" + (h || "10:30") + ":00").toISOString();
const uuid = (n) => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");

function base(extra) {
  return Object.assign({
    settings: { expenseBanks: ["trade_republic"] },
    accounts: [
      { id: "tr", ent: "trade_republic", role: "diario", spendFrom: true, value: 1000, inject: 0, roundup: 2, saveback: true, rewardInv: "ftse", savebackInv: "acwi" },
      { id: "sb", ent: "sabadell", role: "fijos", value: 500 },
      { id: "ef", ent: "efectivo", value: 40 },
    ],
    investments: [
      { id: "ftse", ent: "trade_republic", name: "Fondo Mundo Uno", shares: 10, value: 1000, cost: 900, cur: "EUR" },
      { id: "acwi", ent: "trade_republic", name: "Fondo Mundo Dos", shares: 5, value: 500, cost: 450, cur: "EUR" },
    ],
    expenses: [
      // Compras con tarjeta del mes: TR (noti), Sabadell (banco) y efectivo a mano.
      { id: uuid(1), date: iso(-3), amount: 9.04, merchant: "Super Ejemplo", category: "super", source: "macrodroid", ent: "trade_republic" },
      { id: uuid(2), date: iso(-2), amount: 20.5, merchant: "Gasolinera Prueba", category: "gasolina", source: "ob", ent: "sabadell" },
      { id: uuid(3), date: iso(-1), amount: 3.3, merchant: "Kiosco", category: "otros", source: "manual:efectivo", ent: "efectivo" },
    ],
    fixed: [], debts: [], oneoffs: [], flows: [], assets: [], goals: [],
  }, extra || {});
}
const RU = { id: uuid(10), date: iso(0, "09:00"), amount: 12.96, merchant: "Round up", obName: "Round up", category: "inversion", source: "macrodroid", ent: "trade_republic", noCard: true };
const SB = { id: uuid(11), date: iso(0, "09:05"), amount: 1.23, merchant: "Saveback", obName: "Saveback", category: "inversion", source: "macrodroid", ent: "trade_republic", noCard: true };
const conAvisos = (s) => Object.assign({}, s, { expenses: s.expenses.concat([RU, SB]) });
const inv = (s, id) => s.investments.find((i) => i.id === id);
const tr = (s) => s.accounts.find((a) => a.id === "tr");

// Lo mismo que pinta la app (11-app-main `totals`): efectivo de las cuentas + inversiones + lo estimado.
function patrimonio(s) {
  const ins = ctx.insumosSaldoGasto(s);
  const liquid = s.accounts.reduce((a, acc) => a + ctx.saldoCuentaMostrada(acc, ins), 0);
  const invested = s.investments.reduce((a, i) => a + i.value, 0) + ins.roundup + ins.saveback;
  return { liquid: +liquid.toFixed(2), invested: +invested.toFixed(2), neto: +(liquid + invested).toFixed(2), ins };
}
const gastado = (s) => +s.expenses.filter((e) => ctx.expenseCountsBudget(e, s) && e.amount > 0).reduce((a, e) => a + e.amount, 0).toFixed(2);
const ingresos = (s) => +s.expenses.filter((e) => ctx.expenseCountsBudget(e, s) && e.amount < 0).reduce((a, e) => a - e.amount, 0).toFixed(2);

t("recompensaDe reconoce el aviso por su nombre fijo, también renombrado; nunca un apunte a mano", () => {
  assert.equal(ctx.recompensaDe(RU), "roundup");
  assert.equal(ctx.recompensaDe(SB), "saveback");
  assert.equal(ctx.recompensaDe(Object.assign({}, RU, { merchant: "Calderilla" })), "roundup");
  assert.equal(ctx.recompensaDe(Object.assign({}, RU, { source: "manual:trade_republic" })), null);
  assert.equal(ctx.recompensaDe(Object.assign({}, RU, { category: "otros" })), null);
  assert.equal(ctx.recompensaDe(Object.assign({}, RU, { ent: "sabadell", source: "ob" })), null);
});

t("el aviso entra en Inversión: ni gasto ni ingreso del mes", () => {
  const s = conAvisos(base());
  assert.equal(gastado(s), gastado(base()));
  assert.equal(ingresos(s), 0);
  assert.equal(ctx.expenseCountsCash(RU, s), true, "el Round up sale de tu efectivo");
  assert.equal(ctx.expenseCountsCash(SB, s), false, "el Saveback no: lo pone TR");
});

t("suma a la posición elegida (aportación y coste), una sola vez", () => {
  const s0 = conAvisos(base());
  const s1 = ctx.aplicarRecompensasTR(s0, NOW);
  assert.notEqual(s1, s0);
  assert.deepEqual([inv(s1, "ftse").value, inv(s1, "ftse").cost, inv(s1, "ftse").shares], [1012.96, 912.96, 10.1296]);
  assert.deepEqual([inv(s1, "acwi").value, inv(s1, "acwi").cost], [501.23, 451.23]);
  assert.equal(s1.trRewardsTotal, 14.19);
  assert.equal(s1.trRecompensas[RU.id].inv, "ftse");
  assert.equal(s1.trRecompensas[SB.id].inv, "acwi");
  // Otra pasada (otro pull, reabrir la app): el mismo estado, sin tocar nada.
  assert.equal(ctx.aplicarRecompensasTR(s1, NOW + 60000), s1);
});

t("sin destino: se apunta igual y no toca ninguna posición; elegirlo luego no la sube hacia atrás", () => {
  const s0 = conAvisos(base());
  s0.accounts = s0.accounts.map((a) => a.id === "tr" ? Object.assign({}, a, { rewardInv: "", savebackInv: "" }) : a);
  const s1 = ctx.aplicarRecompensasTR(s0, NOW);
  assert.equal(inv(s1, "ftse").value, 1000);
  assert.equal(inv(s1, "acwi").value, 500);
  assert.equal(s1.trRecompensas[RU.id].inv, null);
  const pista = ctx.inversionEtiqueta(s1, RU);
  assert.ok(pista && !/Fondo/.test(pista), "la pista para elegirla, sin inventar destino: " + pista);
  const s2 = Object.assign({}, s1, { accounts: s1.accounts.map((a) => a.id === "tr" ? Object.assign({}, a, { rewardInv: "ftse" }) : a) });
  assert.equal(ctx.aplicarRecompensasTR(s2, NOW), s2);
});

t("el Saveback sin destino propio va al de siempre (`rewardInv`); \"\" es ninguno a propósito", () => {
  const s = base();
  s.accounts = s.accounts.map((a) => a.id === "tr" ? Object.assign({}, a, { savebackInv: undefined }) : a);
  assert.equal(ctx.destinoRecompensa(s, "saveback").id, "ftse");
  s.accounts = s.accounts.map((a) => a.id === "tr" ? Object.assign({}, a, { savebackInv: "" }) : a);
  assert.equal(ctx.destinoRecompensa(s, "saveback"), null);
});

t("si el puente de TR leyó la posición después del aviso, su cifra ya lo incluye", () => {
  const s0 = conAvisos(base());
  s0.investments = s0.investments.map((i) => i.id === "ftse" ? Object.assign({}, i, { brokerAt: Date.parse(RU.date) + 1000 }) : i);
  const s1 = ctx.aplicarRecompensasTR(s0, NOW);
  assert.equal(inv(s1, "ftse").value, 1000);
  assert.equal(s1.trRecompensas[RU.id].puente, true);
});

t("un posible repetido espera a que se resuelva", () => {
  const s0 = Object.assign({}, base(), { expenses: base().expenses.concat([Object.assign({}, RU, { possibleDup: true })]) });
  assert.equal(ctx.aplicarRecompensasTR(s0, NOW), s0);
});

t("patrimonio: el Round up no lo cambia (efectivo −X, fondo +X); el Saveback lo sube X, una vez", () => {
  const antes = patrimonio(base());
  const s1 = ctx.aplicarRecompensasTR(conAvisos(base()), NOW);
  const despues = patrimonio(s1);
  // Con avisos reales la estimación deja paso a lo real: no se suma también lo estimado.
  assert.equal(despues.ins.roundup, 0);
  assert.equal(despues.ins.saveback, 0);
  assert.equal(+(despues.liquid - antes.liquid - antes.ins.roundup).toFixed(2), -12.96);
  assert.equal(+(despues.invested - antes.invested + antes.ins.roundup + antes.ins.saveback).toFixed(2), 14.19);
  assert.equal(+(despues.neto - antes.neto + antes.ins.saveback).toFixed(2), 1.23);
});

t("la estimación solo mira compras de TR: ni Sabadell ni el efectivo (pendiente conocido)", () => {
  const s = base();
  // 9,04 → 0,96 de calderilla ×2. Con Sabadell (20,50) y el efectivo (3,30) dentro salían 3,32.
  assert.equal(ctx.insumosSaldoGasto(s).roundup, 1.92);
  assert.equal(ctx.insumosSaldoGasto(s).saveback, 0.09);
  // Y lo que ya es inversión no se redondea a sí mismo.
  assert.equal(ctx.isCardSpend({ amount: 12.96, category: "inversion" }), false);
});

t("el banco trae después el Round up sin nombre: se empareja con el aviso y no cuenta dos veces", () => {
  let s = ctx.aplicarRecompensasTR(conAvisos(base()), NOW);
  const saldo0 = patrimonio(s).liquid, pos0 = inv(s, "ftse").value;
  const add = ctx.importObExpenses(s, [{ ent: "trade_republic", date: dia(0), amount: 12.96, merchant: "", status: "BOOK" }], []);
  assert.equal(add.length, 1);
  s = ctx.reconcileGemelosAutomaticos(Object.assign({}, s, { expenses: add.concat(s.expenses) }), s);
  s = ctx.reconcileObDupes(s).state;
  const fila = s.expenses.find((e) => e.source === "ob" && e.amount === 12.96);
  assert.equal(fila.possibleDup, true, "el apunte del banco queda como el mismo que el aviso");
  assert.equal(patrimonio(s).liquid, saldo0, "el saldo no baja otra vez");
  s = ctx.aplicarRecompensasTR(s, NOW);
  assert.equal(inv(s, "ftse").value, pos0, "la posición no sube otra vez");
  assert.equal(gastado(s), gastado(base()));
});

t("el banco trae después el abono y la retirada del Saveback: los dos neutros, saldo e ingresos igual", () => {
  let s = ctx.aplicarRecompensasTR(conAvisos(base()), NOW);
  const saldo0 = patrimonio(s).liquid, pos0 = inv(s, "acwi").value, neto0 = patrimonio(s).neto;
  const add = ctx.importObExpenses(s, [
    { ent: "trade_republic", date: dia(-1), amount: -1.23, merchant: "", status: "BOOK" },
    { ent: "trade_republic", date: dia(0), amount: 1.23, merchant: "", status: "BOOK" },
  ], []);
  assert.equal(add.length, 2);
  assert.ok(add.every((e) => !e.possibleDup), "el Saveback no esconde solo una mitad");
  s = ctx.reconcileGemelosAutomaticos(Object.assign({}, s, { expenses: add.concat(s.expenses) }), s);
  const r = ctx.reconcileObDupes(s);
  s = r.state;
  assert.equal(r.recat.length, 2);
  assert.ok(s.expenses.filter((e) => e.source === "ob" && e.ent === "trade_republic").every((e) => e.category === "inversion"));
  assert.equal(ingresos(s), 0, "el abono no es un ingreso del mes");
  assert.equal(gastado(s), gastado(base()));
  assert.equal(patrimonio(s).liquid, saldo0);
  assert.equal(patrimonio(s).neto, neto0);
  s = ctx.aplicarRecompensasTR(s, NOW);
  assert.equal(inv(s, "acwi").value, pos0);
});

t("cierre de mes: con avisos reales no se simula otra vez el redondeo ni el saveback", () => {
  const prev = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 10, 12);
  const prevKey = prev.getFullYear() + "-" + String(prev.getMonth() + 1).padStart(2, "0");
  const compra = { id: uuid(20), date: prev.toISOString(), amount: 9.04, merchant: "Super Ejemplo", category: "super", source: "macrodroid", ent: "trade_republic" };
  const ru = Object.assign({}, RU, { id: uuid(21), date: new Date(prev.getTime() + 864e5).toISOString() });
  const sb = Object.assign({}, SB, { id: uuid(22), date: new Date(prev.getTime() + 864e5).toISOString() });
  const sinAviso = ctx.reconcileTR(Object.assign(base(), { trAnchor: prevKey, expenses: [compra] }));
  const conAviso = ctx.reconcileTR(Object.assign(base(), { trAnchor: prevKey, expenses: [compra, ru, sb] }));
  // 0,96 ×2 de redondeo + 0,09 de saveback (1 % de 9,04).
  assert.equal(inv(sinAviso, "ftse").value, 1002.01, "control: sin aviso se simula como siempre");
  assert.equal(inv(conAviso, "ftse").value, 1000, "con aviso, la posición la sube el aviso, no el cierre");
  // Efectivo al cerrar: −compra −Round up (sí sale del efectivo); ni el Saveback ni lo estimado.
  assert.equal(tr(conAviso).value, +(1000 - 9.04 - 12.96).toFixed(2));
});

if (failed) { console.error(`\n${failed} fallo(s)`); process.exit(1); }
console.log("  ok");
