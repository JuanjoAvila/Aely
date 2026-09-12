#!/usr/bin/env node
/** CAMBIAR EL ROL DE UNA CUENTA NO PUEDE MOVER SU SALDO (2026-09-12, reportado por él desde la
    app): «Al probar de quitar una cuenta de gasto diario y ponerla como recibos… en la zona de
    cuentas, se me descontó el gasto… Pasó de 6700 y algo a 6400 de golpe… se arregla
    sincronizando otra vez pero no debería pasar esto.»

    Causa: `paidNetByBank` SOLO se rellena para cuentas `accFixed`, así que una cuenta de gasto
    diario tiene `pn = 0` y al pasar a recibos su `pn` vale los fijos ya cobrados del mes.
    `applyAccountRole` re-anclaba `value` con el `pn` VIEJO y se pintaba con el NUEVO.

    ⚠ Se siembran DOS bancos a propósito: Trade Republic con un fijo domiciliado (el que salta)
    y Sabadell sin ninguno (el que no puede moverse ni de casualidad). Con un solo banco, una
    implementación que restara a todo el mundo pasaría igual de bien. */
import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx = loadPureLogicFromFile();

function t(name, fn) {
  try { fn(); console.log("  ✓ " + name); }
  catch (e) { console.error("  ✗ " + name); throw e; }
}

const hoy = new Date();
const Y = hoy.getFullYear(), M = hoy.getMonth() + 1, D = hoy.getDate();

/* Mismo cálculo que `totals` en 11-app-main: un término por cuenta `accFixed` de cada banco. */
function totalsDe(s) {
  const paidNetByBank = {};
  (s.accounts || []).forEach((a) => {
    if (ctx.accFixed(a)) paidNetByBank[a.ent] = (paidNetByBank[a.ent] || 0) + ctx.monthNetForAccount(s, a.ent, Y, M, D);
  });
  return {
    paidNetByBank, spentByBank: {}, injTR: 0,
    roundupThisMonth: 0, monthlyInvestThisMonth: 0,
    curYear: Y, curMonth: M, today: D,
  };
}
/* El saldo que se PINTA en Cartera → Tus cuentas. */
function pintado(s, id) {
  const tt = totalsDe(s);
  const a = (s.accounts || []).find((x) => x.id === id);
  return ctx.saldoCuentaMostrada(a, {
    injTR: tt.injTR, spentByBank: tt.spentByBank, paidNetByBank: tt.paidNetByBank,
    roundup: 0, monthlyInvest: 0,
  });
}
function estado(rolTR) {
  return {
    accounts: [
      { id: "tr", ent: "trade_republic", name: "TR", value: 6700, role: rolTR, spendFrom: rolTR !== "fijos" },
      { id: "sab", ent: "sabadell", name: "Sabadell", value: 1000, role: "fijos" },
    ],
    // 300 € de alquiler domiciliados en TR, con el día 1 ya pasado: es lo que hace saltar el pn.
    fixed: [{ id: "f1", name: "Alquiler", amount: 300, day: 1, freq: "mes", account: "trade_republic" }],
    flows: [], oneoffs: [], expenses: [], debts: [], goals: [],
    settings: { expenseBanks: ["trade_republic"] },
  };
}
function cambiaRol(s, id, r) {
  return ctx.applyAccountRole(s, totalsDe(s), id, r);
}

console.log("rol-cuenta-sin-salto");

t("su caso: de gasto diario a recibos, el saldo NO se mueve (6700 → 6700, no 6400)", () => {
  const antes = estado("diario");
  const saldo = pintado(antes, "tr");
  assert.equal(saldo, 6700);
  const despues = cambiaRol(antes, "tr", "fijos");
  assert.equal(pintado(despues, "tr"), saldo);
});

t("y el que re-ancla es `value`, no la pantalla: la base sube los 300 € del recibo", () => {
  const despues = cambiaRol(estado("diario"), "tr", "fijos");
  assert.equal(despues.accounts.find((a) => a.id === "tr").value, 7000);
});

t("de gasto diario a «todo» tampoco se mueve", () => {
  const antes = estado("diario");
  const saldo = pintado(antes, "tr");
  const despues = cambiaRol(antes, "tr", "ambos");
  assert.equal(pintado(despues, "tr"), saldo);
});

t("el camino de vuelta (recibos → gasto diario) sigue sin moverse", () => {
  const antes = estado("fijos");
  const saldo = pintado(antes, "tr");
  const despues = cambiaRol(antes, "tr", "diario");
  assert.equal(pintado(despues, "tr"), saldo);
});

t("el OTRO banco, que no tiene recibos, no se toca ni le cambia la base", () => {
  const antes = estado("diario");
  const saldoSab = pintado(antes, "sab");
  const despues = cambiaRol(antes, "tr", "fijos");
  assert.equal(pintado(despues, "sab"), saldoSab);
  assert.equal(despues.accounts.find((a) => a.id === "sab").value, 1000);
});

t("y el banco de al lado tampoco se mueve cuando el que cambia es ÉL", () => {
  // Sabadell pasa de recibos a gasto diario: TR (que sigue siendo el diario) se degrada a
  // recibos en la misma pasada, y ese re-anclaje también tiene que respetar su saldo.
  const antes = estado("diario");
  const saldoTR = pintado(antes, "tr");
  const despues = cambiaRol(antes, "sab", "diario");
  assert.equal(ctx.accRole(despues.accounts.find((a) => a.id === "tr")), "fijos");
  assert.equal(pintado(despues, "tr"), saldoTR);
});

console.log("rol-cuenta-sin-salto: OK");
