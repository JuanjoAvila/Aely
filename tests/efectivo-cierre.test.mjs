#!/usr/bin/env node
/**
 * FIN-01 — EL CIERRE DE MES REPARTE EL GASTO POR BANCO.
 *
 * Fallo que cubre (auditoría 2026-09-09, contrastado en código): `reconcileTR` sumaba TODOS los
 * gastos del mes cerrado y se los restaba a la cuenta de gasto diario, sin mirar `e.ent`. Una
 * compra pagada del sobre de efectivo bajaba Trade Republic y dejaba el sobre intacto — y el
 * sobre no arrastraba nada, porque `monthNetForAccount` recorre fijos/deudas/puntuales/flujos y
 * NO mira `s.expenses`.
 *
 * Lo malo es que el patrimonio TOTAL seguía cuadrando: los dos saldos por separado mentían y
 * nadie lo notaba. Durante el mes `saldoCuentaMostrada` sí reparte bien, así que el saldo del
 * sobre bajaba durante el mes y REBOTABA hacia arriba el día 1.
 *
 * La regla de reparto es la misma de `gastoDelMesPorBanco` (00-core), a propósito: si el cierre
 * usa un criterio y el saldo mostrado otro, vuelve el bug de «la app y el widget no dicen lo
 * mismo» por otra puerta.
 */
import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx = loadPureLogicFromFile();

let failed = 0;
function t(name, fn) {
  try { fn(); console.log("  ✓ " + name); }
  catch (e) { failed++; console.error("  ✗ " + name + "\n      " + e.message); }
}

// Mes anterior al reloj real, sin depender de en qué día se ejecute la suite.
function mesAtras(n) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  // `mk`/`mkOf` no salen del cargador de lógica pura; misma fórmula que 01-i18n.js:2288.
  const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  return { key: key, y: d.getFullYear(), m: d.getMonth() + 1 };
}
function diaDe(mes, dia) {
  return new Date(mes.y + "-" + String(mes.m).padStart(2, "0") + "-" + String(dia).padStart(2, "0") + "T12:00:00").toISOString();
}

function estado(o) {
  o = o || {};
  return {
    accounts: [
      { id: "tr1", ent: "trade_republic", name: "Trade Republic", value: o.tr != null ? o.tr : 1000, role: "diario", spendFrom: true, inject: 0 },
      { id: "ef1", ent: "efectivo", name: "Efectivo", value: o.cash != null ? o.cash : 100, role: "fijos" },
    ],
    expenses: o.expenses || [],
    fixed: [], debts: [], oneoffs: [], flows: [], investments: [],
    settings: { expenseBanks: ["efectivo"] },
    trAnchor: o.anchor,
  };
}
const cuenta = (s, ent) => s.accounts.find((a) => a.ent === ent);

console.log("efectivo-cierre");

const prev = mesAtras(1);

t("★ una compra en efectivo del mes cerrado baja el SOBRE, no Trade Republic", () => {
  const s = estado({
    anchor: prev.key,
    expenses: [{ id: "e1", amount: 20, ent: "efectivo", source: "manual", category: "bares", date: diaDe(prev, 12) }],
  });
  const ns = ctx.reconcileTR(s);
  assert.equal(cuenta(ns, "trade_republic").value, 1000, "TR no debe moverse: esa compra no salió de TR");
  assert.equal(cuenta(ns, "efectivo").value, 80, "el sobre tiene que arrastrar sus propias compras");
});

t("el patrimonio total no cambia con el arreglo (lo que cambia es de quién sale)", () => {
  const s = estado({
    anchor: prev.key,
    expenses: [{ id: "e1", amount: 20, ent: "efectivo", source: "manual", category: "bares", date: diaDe(prev, 12) }],
  });
  const ns = ctx.reconcileTR(s);
  const total = ns.accounts.reduce((a, x) => a + x.value, 0);
  assert.equal(total, 1080, "1100 − 20; el fallo antiguo también daba 1080 con los dos saldos torcidos");
});

t("las compras de la cuenta diaria se le siguen restando a ella", () => {
  const s = estado({
    anchor: prev.key,
    expenses: [{ id: "e1", amount: 30, ent: "trade_republic", source: "macrodroid", category: "super", date: diaDe(prev, 5) }],
  });
  const ns = ctx.reconcileTR(s);
  assert.equal(cuenta(ns, "trade_republic").value, 970);
  assert.equal(cuenta(ns, "efectivo").value, 100);
});

t("un gasto SIN banco sigue cayendo en la cuenta de gasto diario (no cambia el comportamiento)", () => {
  const s = estado({
    anchor: prev.key,
    expenses: [{ id: "e1", amount: 15, source: "manual", category: "otros", date: diaDe(prev, 8) }],
  });
  const ns = ctx.reconcileTR(s);
  assert.equal(cuenta(ns, "trade_republic").value, 985);
  assert.equal(cuenta(ns, "efectivo").value, 100);
});

t("gasto de un banco que NO es de gasto diario no toca ni TR ni el sobre", () => {
  const s = estado({
    anchor: prev.key,
    expenses: [{ id: "e1", amount: 40, ent: "sabadell", source: "ob:sabadell", category: "recibos", date: diaDe(prev, 9) }],
  });
  const ns = ctx.reconcileTR(s);
  assert.equal(cuenta(ns, "trade_republic").value, 1000, "un recibo de Sabadell no sale del efectivo de TR");
  assert.equal(cuenta(ns, "efectivo").value, 100);
});

t("entra dinero en el sobre (importe negativo): el sobre SUBE al cerrar", () => {
  const s = estado({
    anchor: prev.key,
    expenses: [{ id: "e1", amount: -25, ent: "efectivo", source: "manual", category: "ingreso", date: diaDe(prev, 3) }],
  });
  const ns = ctx.reconcileTR(s);
  assert.equal(cuenta(ns, "efectivo").value, 125);
  assert.equal(cuenta(ns, "trade_republic").value, 1000);
});

t("saque de cajero: neutro para el patrimonio, no descuadra ninguna de las dos", () => {
  // `applySaqueCajero` ya movió el dinero (TR −50 / sobre +50) y dejó un traspaso con ent del BANCO.
  // Al cerrar el mes ese apunte NO puede volver a restarse del sobre.
  const s = estado({
    tr: 950, cash: 150, anchor: prev.key,
    expenses: [{ id: "e1", amount: 50, ent: "trade_republic", source: "manual", category: "traspaso", noCard: true, merchant: "Cajero", date: diaDe(prev, 4) }],
  });
  const ns = ctx.reconcileTR(s);
  assert.equal(cuenta(ns, "efectivo").value, 150, "el sobre ya recibió el dinero: no se le resta nada");
  assert.equal(cuenta(ns, "trade_republic").value, 900, "TR arrastra su propio apunte de cajero");
});

t("dos meses sin abrir la app: cada mes va a su banco", () => {
  const p1 = mesAtras(1), p2 = mesAtras(2);
  const s = estado({
    anchor: p2.key,
    expenses: [
      { id: "e1", amount: 10, ent: "efectivo", source: "manual", category: "bares", date: diaDe(p2, 10) },
      { id: "e2", amount: 30, ent: "efectivo", source: "manual", category: "bares", date: diaDe(p1, 10) },
      { id: "e3", amount: 5, ent: "trade_republic", source: "macrodroid", category: "super", date: diaDe(p1, 11) },
    ],
  });
  const ns = ctx.reconcileTR(s);
  assert.equal(cuenta(ns, "efectivo").value, 60, "100 − 10 − 30");
  assert.equal(cuenta(ns, "trade_republic").value, 995, "1000 − 5");
});

t("sobre creado a mitad de camino: solo arrastra los gastos del mes que se cierra", () => {
  const p1 = mesAtras(1), p2 = mesAtras(2);
  const s = estado({
    anchor: p1.key,   // el ancla empieza en el mes pasado: el de hace dos NO se recorre
    expenses: [
      { id: "e1", amount: 40, ent: "efectivo", source: "manual", category: "bares", date: diaDe(p2, 10) },
      { id: "e2", amount: 15, ent: "efectivo", source: "manual", category: "bares", date: diaDe(p1, 10) },
    ],
  });
  const ns = ctx.reconcileTR(s);
  assert.equal(cuenta(ns, "efectivo").value, 85, "100 − 15; el mes anterior al ancla no se toca");
});

t("el mes EN CURSO no se cierra (lo pinta saldoCuentaMostrada, no reconcileTR)", () => {
  const hoy = mesAtras(0);
  const s = estado({
    anchor: hoy.key,
    expenses: [{ id: "e1", amount: 20, ent: "efectivo", source: "manual", category: "bares", date: diaDe(hoy, 1) }],
  });
  const ns = ctx.reconcileTR(s);
  assert.equal(cuenta(ns, "efectivo").value, 100, "restarlo aquí Y en el saldo mostrado sería contarlo dos veces");
  assert.equal(cuenta(ns, "trade_republic").value, 1000);
});

t("cierre y saldo mostrado coinciden: el sobre no rebota el día 1", () => {
  // Durante el mes el sobre se pinta con `saldoCuentaMostrada`; al cerrarlo, `reconcileTR` deja
  // ese mismo número en `value`. Si los dos no coinciden, el saldo pega un salto el día 1.
  const gastos = [{ id: "e1", amount: 20, ent: "efectivo", source: "manual", category: "bares", date: diaDe(prev, 12) }];
  const spentByBank = ctx.gastoDelMesPorBanco(gastos, "trade_republic");
  const durante = ctx.saldoCuentaMostrada({ id: "ef1", ent: "efectivo", value: 100, role: "fijos" }, { spentByBank: spentByBank, paidNetByBank: {} });
  const ns = ctx.reconcileTR(estado({ anchor: prev.key, expenses: gastos }));
  assert.equal(durante, 80);
  assert.equal(cuenta(ns, "efectivo").value, durante, "el cierre tiene que dejar el saldo que ya se estaba pintando");
});

t("el round-up del cierre mira los mismos gastos que el de la pantalla", () => {
  // Durante el mes, `11-app-main.js:1483` estima el round-up sobre gastos ya filtrados por
  // `expenseCountsCash`. Al cerrar se calculaba sobre el mes ENTERO: una compra con tarjeta de un
  // banco que NO es de gasto diario inflaba el round-up y el saldo de TR pegaba un salto el día 1.
  const s = estado({
    anchor: prev.key,
    expenses: [{ id: "e1", amount: 10.5, ent: "sabadell", source: "ob:sabadell", category: "super", date: diaDe(prev, 7) }],
  });
  s.accounts[0].roundup = 1;   // multiplicador x1
  const ns = ctx.reconcileTR(s);
  assert.equal(cuenta(ns, "trade_republic").value, 1000, "ni el gasto ni su calderilla salen de TR");
});

t("y sí cuenta la calderilla de las compras que la pantalla sí suma", () => {
  const s = estado({
    anchor: prev.key,
    expenses: [{ id: "e1", amount: 10.5, ent: "trade_republic", source: "macrodroid", category: "super", date: diaDe(prev, 7) }],
  });
  s.accounts[0].roundup = 1;
  const ns = ctx.reconcileTR(s);
  // 1000 − 10,50 de la compra − 0,50 de round-up
  assert.equal(cuenta(ns, "trade_republic").value, 989, "la compra de TR sí redondea");
});

if (failed) { console.error("\nefectivo-cierre: " + failed + " fallo(s)"); process.exit(1); }
console.log("efectivo-cierre: OK");
