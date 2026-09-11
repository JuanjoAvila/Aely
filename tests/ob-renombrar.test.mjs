#!/usr/bin/env node
/**
 * RENOMBRAR UN MOVIMIENTO DEL BANCO NO PUEDE DUPLICAR EL GASTO.
 *
 * Petición suya del 2026-08-17: poder cambiar el «Movimiento» que deja Trade Republic, que «queda
 * feo». Renombrar ya se podía; lo que no se podía era hacerlo sin que el siguiente sync de Open
 * Banking metiera el gasto OTRA VEZ.
 *
 * El dedup de `importObExpenses` tiene tres capas y renombrar las rompía las tres a la vez:
 *   1. `ext_id`                   → TR no manda ninguno (todo null salvo importe, signo y fecha).
 *   2. `día | importe | comercio` → deja de casar en cuanto cambias el comercio.
 *   3. «sin nombre, ±3 días»      → solo mira gastos de OTRA fuente; el renombrado sigue en `ob`.
 *
 * El arreglo: la fila recuerda cómo la llamaba el BANCO (`obName`) y el dedup usa ese nombre.
 * Estos tests fijan las dos mitades — que el renombrado no duplique, y que eso no debilite el
 * dedup normal (dos cargos iguales de verdad tienen que seguir entrando los dos).
 */
import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx = loadPureLogicFromFile();

function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}`); throw e; }
}

console.log("ob-renombrar");

const hoy = new Date();
const dia = (delta = 0) => {
  const d = new Date(hoy.getTime() + delta * 86400000);
  return d.toISOString().slice(0, 10);
};

/** Su montaje: TR es la cuenta de gasto diario. */
function estado(expenses = []) {
  return {
    accounts: [{ id: "a1", ent: "trade_republic", role: "diario", value: 500 }],
    settings: { expenseBanks: ["trade_republic"] },
    fixed: [], debts: [], oneoffs: [], flows: [],
    expenses,
  };
}

/** Un movimiento de TR tal como llega: sin ext_id y sin nombre (lo que manda Enable Banking). */
const movTR = (fecha, importe) => ({
  ent: "trade_republic", id: null, date: fecha, amount: importe,
  merchant: "Movimiento", note: "", card: true, status: "",
});

t("el mismo movimiento no entra dos veces (dedup de siempre)", () => {
  const prim = ctx.importObExpenses(estado(), [movTR(dia(-1), 41.8)]);
  assert.equal(prim.length, 1, "la primera vez sí entra");
  const seg = ctx.importObExpenses(estado(prim), [movTR(dia(-1), 41.8)]);
  assert.equal(seg, null, "la segunda vez ya no");
});

t("★ renombrado a mano: el siguiente sync NO lo mete otra vez", () => {
  const entrada = ctx.importObExpenses(estado(), [movTR(dia(-1), 41.8)])[0];
  assert.equal(entrada.merchant, "Movimiento");
  assert.equal(entrada.obName, "Movimiento", "la fila tiene que recordar cómo lo llamó el banco");

  // Él lo renombra en la ficha del gasto.
  const renombrado = Object.assign({}, entrada, { merchant: "Mercadona" });

  const otra = ctx.importObExpenses(estado([renombrado]), [movTR(dia(-1), 41.8)]);
  assert.equal(otra, null, "renombrar no puede resucitar el gasto en el siguiente sync");
});

t("★ y también con las filas VIEJAS, selladas al renombrarlas por primera vez", () => {
  /* Lo que él ya tiene en el móvil se guardó antes de que existiera `obName`. La app lo sella al
     renombrar (04-tab-gastos.js `saveEdit`); aquí se reproduce esa fila sellada. */
  const vieja = {
    id: "x1", date: new Date(dia(-1) + "T12:00:00").toISOString(), amount: 41.8,
    merchant: "Mercadona", obName: "Movimiento", category: "super",
    source: "ob", ent: "trade_republic",
  };
  const otra = ctx.importObExpenses(estado([vieja]), [movTR(dia(-1), 41.8)]);
  assert.equal(otra, null);
});

t("una fila vieja SIN sellar sigue deduplicándose por su nombre, como siempre", () => {
  const vieja = {
    id: "x2", date: new Date(dia(-1) + "T12:00:00").toISOString(), amount: 41.8,
    merchant: "Movimiento", category: "otros", source: "ob", ent: "trade_republic",
  };
  const otra = ctx.importObExpenses(estado([vieja]), [movTR(dia(-1), 41.8)]);
  assert.equal(otra, null, "sin obName cae a merchant: no puede romper lo que ya funcionaba");
});

t("dos cargos iguales de verdad siguen entrando los dos", () => {
  // El dedup protege de contar dos veces, no de gastar dos veces lo mismo el mismo día.
  const uno = ctx.importObExpenses(estado(), [movTR(dia(-1), 12.5)]);
  assert.equal(uno.length, 1);
  const dos = ctx.importObExpenses(estado(uno), [movTR(dia(-1), 12.5), movTR(dia(-2), 12.5)]);
  assert.equal(dos && dos.length, 1, "el del otro día entra; el repetido no");
  assert.equal(String(dos[0].date).slice(0, 10), dia(-2));
});

t("★ noti TR SIN ent + OB sin nombre: entra marcada, no se pierde", () => {
  const porNoti = {
    id: "n1", date: new Date(dia(-2) + "T12:00:00").toISOString(), amount: 41.8,
    merchant: "Repsol", category: "transporte", source: "macrodroid",
  };
  assert.equal(ctx.expenseBankOf(porNoti), "trade_republic", "la notificación real no trae ent");
  const otra = ctx.importObExpenses(estado([porNoti]), [movTR(dia(-1), 41.8)]);
  assert.equal(otra && otra.length, 1, "la fila OB entra para no perder movimientos");
  assert.equal(otra[0].possibleDup, true);
  assert.equal(otra[0].possibleDupOf, "n1");
});

t("cross-banco: Revolut no marca un Movimiento igual de Trade Republic", () => {
  const revo = {
    id: "r1", date: new Date(dia(-1) + "T12:00:00").toISOString(), amount: 23,
    merchant: "ChatGPT", category: "ocio", source: "manual", ent: "revolut",
  };
  const otra = ctx.importObExpenses(estado([revo]), [movTR(dia(-1), 23)]);
  assert.equal(otra && otra.length, 1);
  assert.equal(!!otra[0].possibleDup, false);
});

t("idempotencia: una segunda pasada no duplica ni re-marca", () => {
  const porNoti = {
    id: "n2", date: new Date(dia(-2) + "T12:00:00").toISOString(), amount: 12.5,
    merchant: "Cafe", category: "ocio", source: "macrodroid",
  };
  const prim = ctx.importObExpenses(estado([porNoti]), [movTR(dia(-1), 12.5)]);
  assert.equal(prim.length, 1);
  const seg = ctx.importObExpenses(estado([porNoti].concat(prim)), [movTR(dia(-1), 12.5)]);
  assert.equal(seg, null);
});

t("«son distintos»: cuenta y no vuelve a marcarse", () => {
  const porNoti = {
    id: "n3", date: new Date(dia(-2) + "T12:00:00").toISOString(), amount: 9.9,
    merchant: "Parking", category: "transporte", source: "macrodroid",
  };
  const base = estado([porNoti]);
  const marcado = ctx.importObExpenses(base, [movTR(dia(-1), 9.9)])[0];
  assert.equal(ctx.expenseCountsCash(marcado, base), false);
  const limpio = ctx.resolvePossibleDup(Object.assign({}, base, { expenses: [porNoti, marcado] }), marcado.id, false);
  const fila = limpio.expenses.find((e) => e.id === marcado.id);
  assert.equal(!!fila.possibleDup, false);
  assert.equal(ctx.expenseCountsCash(fila, limpio), true);
  assert.equal(ctx.importObExpenses(limpio, [movTR(dia(-1), 9.9)]), null);
});

t("«es el mismo»: borra OB y la lápida impide resucitarlo", () => {
  const porNoti = {
    id: "n4", date: new Date(dia(-2) + "T12:00:00").toISOString(), amount: 7.5,
    merchant: "Pan", category: "super", source: "macrodroid",
  };
  const ob = ctx.importObExpenses(estado([porNoti]), [movTR(dia(-1), 7.5)])[0];
  let s = ctx.resolvePossibleDup(estado([porNoti, ob]), ob.id, true);
  const k = String(ob.date).slice(0, 10) + "|" + ob.amount + "|" + (ob.merchant || "");
  s = Object.assign({}, s, { deleted: ctx.pushDeleted(s.deleted, k) });
  assert.equal(s.expenses.some((e) => e.id === ob.id), false);
  assert.equal(ctx.importObExpenses(s, [movTR(dia(-1), 7.5)]), null);
});

t("#dup viaja por nube y no altera la entidad", () => {
  const pendiente = { id: "ob1", source: "ob", ent: "trade_republic", possibleDup: true };
  assert.equal(ctx.expenseSourceForCloud(pendiente), "ob:trade_republic#dup");
  assert.equal(ctx.expenseBankOf({ source: "ob:trade_republic#dup" }), "trade_republic");
  assert.equal(ctx.expenseFromRow({ id: "ob1", fecha: dia(-1), importe: 4, comercio: "Movimiento", source: "ob:trade_republic#dup" }).possibleDup, true);
});

console.log("  ok");
