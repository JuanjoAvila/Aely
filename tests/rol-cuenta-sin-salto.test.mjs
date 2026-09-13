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
/* ⚠ SIN DOBLES: los insumos salen de `insumosSaldoGasto`, la MISMA función que usa `totals` en
   11-app-main. Este test tuvo dos veces un doble más simple que la app justo donde fallaba:
   primero `spentByBank: {}` (4.19.84, se escaparon 300 €) y luego `roundupThisMonth: 0` (4.19.97,
   se escaparon 43 € — el redondeo de TR, que se calcula con la diaria que haya). */
function totalsDe(s) {
  const ins = ctx.insumosSaldoGasto(s);
  return {
    paidNetByBank: ins.paidNetByBank, spentByBank: ins.spentByBank, injTR: ins.injTR,
    roundupThisMonth: ins.roundup, monthlyInvestThisMonth: ins.monthlyInvest,
    curYear: ins.curYear, curMonth: ins.curMonth, today: ins.today,
  };
}
/* El saldo que se PINTA en Cartera → Tus cuentas. */
function pintado(s, id) {
  const tt = totalsDe(s);
  const a = (s.accounts || []).find((x) => x.id === id);
  return +ctx.saldoCuentaMostrada(a, {
    injTR: tt.injTR, spentByBank: tt.spentByBank, paidNetByBank: tt.paidNetByBank,
    roundup: tt.roundupThisMonth, monthlyInvest: tt.monthlyInvestThisMonth,
  }).toFixed(2);
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

/* ⚠ SU SEGUNDO RECHAZO, del mismo día por la noche, con la secuencia que él escribió:
   «le doy a trade republic le cambio de Todo a solo recibos… compruebo que está a 0 lo de gastos
    dado que no cuenta y perfecto se pone bien. Luego vuelvo a trade republic elijo gastos diarios
    y PAM, 300 pavos menos».

   El arreglo de la tarde curó `paidNet` y dejó suelta la OTRA variable que baila con el rol:
   `gastoDelMesPorBanco(gastos, dailyEnt)` manda los gastos SIN banco a la cuenta de gasto diario,
   así que en cuanto una cuenta pasa a serlo hereda de golpe los huérfanos del mes — y la fórmula
   de la diaria los RESTA. Re-anclar con el `spentOwn` de antes se dejaba justo esa cantidad.

   Se siembran los gastos SIN `ent` a propósito: con `ent` puesto no se reparten y el fallo no
   aparece. Eso es lo que hizo que el primer arreglo pareciera completo. */
const gastoSuelto = (importe) => ({
  id: "g" + importe, date: new Date(new Date().getFullYear(), new Date().getMonth(), Math.min(new Date().getDate(), 28), 12).toISOString(),
  amount: importe, merchant: "Suelto", category: "otros", source: "manual",
});
function estadoConHuerfanos(rolTR) {
  const e = estado(rolTR);
  e.expenses = [gastoSuelto(200), gastoSuelto(100)];
  return e;
}

t("su secuencia: Todo → Recibos → Gasto diario, sin que el saldo se mueva ni una vez", () => {
  let s = estadoConHuerfanos("ambos");
  const inicio = pintado(s, "tr");
  s = cambiaRol(s, "tr", "fijos");
  assert.equal(pintado(s, "tr"), inicio, "el paso a Recibos ya iba bien");
  s = cambiaRol(s, "tr", "diario");
  assert.equal(pintado(s, "tr"), inicio, "y la vuelta a Gasto diario es la que le quitaba 300 €");
});

t("los gastos huérfanos del mes se los queda la diaria NUEVA, no la vieja", () => {
  // Sabadell pasa a diaria: TR deja de heredar los sueltos y Sabadell los hereda. Ninguno salta.
  const s0 = estadoConHuerfanos("diario");
  const tr0 = pintado(s0, "tr"), sab0 = pintado(s0, "sab");
  const s1 = cambiaRol(s0, "sab", "diario");
  assert.equal(pintado(s1, "tr"), tr0);
  assert.equal(pintado(s1, "sab"), sab0);
});

/* ⚠ SU TERCER RECHAZO (13/9, en la 4.19.99.1): «ya no son 300 pavos… 6724 pasamos a 6681, ha
   mejorado pero sigue reduciéndose». Los 43 € eran el REDONDEO de Trade Republic: `totals` lo
   calcula con `roundupOf(gastos del mes, diaria.roundup)`, y `applyAccountRole` re-anclaba con el
   de la diaria VIEJA (0 si TR venía de recibos). Céntimos a propósito: con importes redondos el
   redondeo es 0 y el fallo no aparece. Y un posible repetido, que `totals` no cuenta
   (`expenseCountsCash`) y el re-anclaje sí contaba. */
function estadoTR(rolTR) {
  const e = estado(rolTR);
  e.accounts[0] = Object.assign({}, e.accounts[0], { roundup: 2, monthlyInvest: 50, inject: 1500 });
  e.expenses = [gastoSuelto(3.4), gastoSuelto(7.15), gastoSuelto(12.99),
    Object.assign(gastoSuelto(4.3), { id: "dup", possibleDup: true })];
  return e;
}

t("su tercer rechazo: con redondeo de TR, Todo → Recibos → Gasto diario no se mueve", () => {
  let s = estadoTR("ambos");
  assert.ok(totalsDe(s).roundupThisMonth > 0, "premisa: el redondeo del mes no es 0");
  const inicio = pintado(s, "tr");
  s = cambiaRol(s, "tr", "fijos");
  assert.equal(pintado(s, "tr"), inicio, "a Recibos");
  s = cambiaRol(s, "tr", "diario");
  assert.equal(pintado(s, "tr"), inicio, "y de vuelta a Gasto diario (los 43 €)");
});

t("con redondeo: pasar la diaria a Sabadell no mueve ninguno de los dos", () => {
  const s0 = estadoTR("diario");
  const tr0 = pintado(s0, "tr"), sab0 = pintado(s0, "sab");
  const s1 = cambiaRol(s0, "sab", "diario");
  assert.equal(pintado(s1, "tr"), tr0);
  assert.equal(pintado(s1, "sab"), sab0);
  const s2 = cambiaRol(s1, "tr", "diario");
  assert.equal(pintado(s2, "tr"), tr0);
  assert.equal(pintado(s2, "sab"), sab0);
});

console.log("rol-cuenta-sin-salto: OK");
