#!/usr/bin/env node
/**
 * IMPORTAR DEL BANCO: compras E INGRESOS.
 *
 * Origen (2026-07-26): una sugerencia escrita desde la app el 16 de julio que estuvo DIEZ DÍAS sin
 * que la leyera nadie — «no me ha leído un ingreso de la caixa…».
 *
 * Convención de signos: POSITIVO = gasto, NEGATIVO = ingreso.
 *
 * ★ 2026-08-05: entra TODO de cualquier banco (estilo extracto). Solo `expenseBankEnts`
 *   (diario + extras marcados) resta del presupuesto/saldo; el resto se apunta con
 *   `budgetSkip` y se ve como «no afecta». Los Fijos modelados no se duplican en ningún banco.
 *
 * ★ 2026-08-03 (histórico): en la cuenta diaria cualquier cargo; ingresos de cualquier banco.
 */
import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx = loadPureLogicFromFile();

function t(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
}

console.log("ob-ingresos");

const hoy = new Date().toISOString().slice(0, 10);
const estado = {
  accounts: [{ id: "a1", ent: "caixa", name: "Cuenta", value: 1000, spendFrom: true, role: "diario" }],
  expenses: [],
  fixed: [],
  debts: [],
  oneoffs: [],
  settings: { expenseBanks: ["caixa", "sabadell"] },
};
const tx = (o) => Object.assign({ ent: "caixa", id: null, date: hoy, amount: 0, merchant: "", note: "", card: false, status: "" }, o);

t("un INGRESO del banco se apunta (el fallo del 16 de julio)", () => {
  const add = ctx.importObExpenses(estado, [tx({ amount: -1250, merchant: "NOMINA JULIO", id: "x1" })]);
  assert.ok(add && add.length === 1, "el ingreso tiene que entrar");
  assert.equal(add[0].amount, -1250);
  assert.equal(add[0].category, "ingreso");
  assert.equal(add[0].ent, "caixa");
});

t("una compra con tarjeta se sigue apuntando como gasto", () => {
  const add = ctx.importObExpenses(estado, [tx({ amount: 23.4, merchant: "Mercadona", card: true, id: "x2" })]);
  assert.ok(add && add.length === 1);
  assert.equal(add[0].amount, 23.4);
  assert.notEqual(add[0].category, "ingreso");
});

t("en la cuenta de GASTO DIARIO, un cargo SIN tarjeta también cuenta ahora (2026-08-03)", () => {
  const add = ctx.importObExpenses(estado, [tx({ amount: 230, merchant: "SEGURO COCHE", card: false, id: "x3" })]);
  assert.ok(add && add.length === 1, "sin Fijo modelado, el cargo de la cuenta diaria entra igual");
  assert.equal(add[0].amount, 230);
});

t("...salvo que YA sea un Fijo modelado este mes en esa cuenta: no se duplica", () => {
  const conFijo = Object.assign({}, estado, {
    fixed: [{ id: "f1", name: "Seguro coche", amount: 230, freq: "mes", account: "caixa" }],
  });
  const add = ctx.importObExpenses(conFijo, [tx({ amount: 230, merchant: "SEGURO COCHE", card: false, id: "x3b" })]);
  assert.equal(add, null, "ya está contado por el motor mensual — importarlo también sería doble conteo");
});

t("en un banco EXTRA de gasto diario, un cargo SIN tarjeta también entra (2026-08-05: todo el extracto)", () => {
  const add = ctx.importObExpenses(estado, [tx({ ent: "sabadell", amount: 55, merchant: "SEGURO HOGAR", card: false, id: "x3c" })]);
  assert.ok(add && add.length === 1);
  assert.equal(add[0].budgetSkip, undefined);
  assert.equal(ctx.expenseCountsBudget(add[0], estado), true);
});

t("...pero si YA es un Fijo modelado en ese banco extra, no se duplica", () => {
  const conFijo = Object.assign({}, estado, {
    fixed: [{ id: "f2", name: "Seguro hogar", amount: 55, freq: "mes", account: "sabadell" }],
  });
  const add = ctx.importObExpenses(conFijo, [tx({ ent: "sabadell", amount: 55, merchant: "SEGURO HOGAR", card: false, id: "x3c2" })]);
  assert.equal(add, null);
});

t("una compra CON tarjeta en banco extra de gasto diario sí cuenta", () => {
  const add = ctx.importObExpenses(estado, [tx({ ent: "sabadell", amount: 12, merchant: "Bar Paco", card: true, id: "x3d" })]);
  assert.ok(add && add.length === 1);
});

t("un ingreso ya importado no entra dos veces (dedup por ext_id)", () => {
  const previo = Object.assign({}, estado, {
    expenses: [{ id: "e1", extId: "x9", date: hoy + "T12:00:00.000Z", amount: -900, merchant: "NOMINA", category: "ingreso" }],
  });
  const add = ctx.importObExpenses(previo, [tx({ amount: -900, merchant: "NOMINA", id: "x9" })]);
  assert.equal(add, null);
});

t("un INGRESO entra de CUALQUIER banco enlazado (Mi ciclo), aunque no sea de gasto diario", () => {
  const add = ctx.importObExpenses(estado, [tx({ ent: "bbva", amount: -500, merchant: "TRANSFERENCIA", id: "x4" })]);
  assert.ok(add && add.length === 1);
  assert.equal(add[0].category, "ingreso");
  assert.equal(add[0].ent, "bbva");
  assert.equal(add[0].budgetSkip, true);
  assert.equal(ctx.expenseCountsBudget(add[0], estado), false);
});

t("un GASTO de un banco que NO es de gasto diario también entra, pero NO resta del presupuesto (2026-08-05)", () => {
  const add = ctx.importObExpenses(estado, [tx({ ent: "bbva", amount: 40, merchant: "Bar", card: true, id: "x4b" })]);
  assert.ok(add && add.length === 1);
  assert.equal(add[0].budgetSkip, true);
  assert.equal(ctx.expenseCountsCash(add[0], estado), false);
  assert.equal(ctx.expenseCountsBudget(add[0], estado), false);
});

t("sin comercio, un ingreso se titula «Ingreso» y no «Compra»", () => {
  const add = ctx.importObExpenses(estado, [tx({ amount: -60, merchant: "", id: "x5" })]);
  assert.equal(add[0].merchant, "Ingreso");
});

// 30/9: una nómina de Sabadell se vio como movimiento normal antes de cobrarla y arrancó
// «Mi ciclo». El banco la mandaba como PDNG; solo el BOOK acredita que el dinero está.
t("un ingreso PENDIENTE (PDNG) no se apunta ni ancla «Mi ciclo»", () => {
  const conFlujo = Object.assign({}, estado, {
    flows: [{ id: "n1", kind: "income", name: "Nomina", amount: 1800, to: "sabadell", day: 28 }],
  });
  ["PDNG", "pdng", "HOLD", "SCHD", "CNCL", "RJCT", "INFO"].forEach(function (st) {
    const add = ctx.importObExpenses(conFlujo, [tx({ ent: "sabadell", amount: -1800, merchant: "NOMINA EMPRESA SL", id: "p-" + st, status: st })]);
    assert.equal(add, null, st + " no es dinero cobrado");
  });
  assert.equal(ctx.budgetPaydayOf(conFlujo, Date.now(), []), null, "sin cobro real el ciclo no arranca");
});

t("...y el mismo abono ya contabilizado (BOOK) sí entra y ancla el ciclo", () => {
  const conFlujo = Object.assign({}, estado, {
    flows: [{ id: "n1", kind: "income", name: "Nomina", amount: 1800, to: "sabadell", day: 28 }],
  });
  const add = ctx.importObExpenses(conFlujo, [tx({ ent: "sabadell", amount: -1800, merchant: "NOMINA EMPRESA SL", id: "b1", status: "BOOK" })]);
  assert.ok(add && add.length === 1);
  const ancla = ctx.budgetPaydayOf(conFlujo, Date.now(), add);
  assert.ok(ancla && ancla.inc === add[0], "el cobro contabilizado abre el ciclo");
});

t("un banco que no informa el estado sigue apuntando el ingreso (sin regresión)", () => {
  const add = ctx.importObExpenses(estado, [tx({ ent: "sabadell", amount: -700, merchant: "TRANSFERENCIA", id: "s0", status: "" })]);
  assert.ok(add && add.length === 1);
});

console.log("\nob-ingresos: OK");
