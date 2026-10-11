import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

// Reglas de dinero sobre el tramo anterior a la ventana de siempre.
// La fecha del proceso es la del reloj del test: día −40 cae fuera del margen de 8 días.
const ctx = loadPureLogicFromFile();
const day = (delta) => new Date(Date.now() + delta * 86400000).toISOString().slice(0, 10);
const links = [{ aspsp: "CaixaBank", syncFrom: day(-80) }];
const now = new Date();
const mes = now.getMonth() + 1;
// Un mes que no es este ni el del día −40: para un fijo anual o un puntual que «no toca».
const otroMes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].find((m) => m !== mes && m !== Number(day(-40).slice(5, 7)));

function base(extra) {
  return Object.assign({
    accounts: [{ id: "cx", ent: "caixabank", role: "diario", value: 400, monthlyInvest: 150, rewardInv: "fondo" }],
    settings: { expenseBanks: ["caixabank"] },
    investments: [{ id: "fondo", value: 1000, cost: 1000, shares: 10, cur: "EUR" }],
    fixed: [], debts: [], oneoffs: [], flows: [], deleted: [], expenses: [], bankTx: [],
  }, extra || {});
}
const sinAporte = { accounts: [{ id: "cx", ent: "caixabank", role: "ambos", value: 400, monthlyInvest: 0 }] };
function tx(date, amount, merchant, id) {
  return { ent: "caixabank", id: id || "tx-" + merchant, date, amount, merchant, note: "", card: true, status: "BOOK" };
}
function bought(state, add) {
  let st = state;
  (add || []).forEach((e) => {
    if (e.category !== "inversion") return;
    const ib = ctx.applyInvestBuy(st, e.ent, e.amount);
    if (ib) st = ib.state;
  });
  return st.investments[0].value;
}

let failures = 0;
function t(name, fn) {
  try { fn(); console.log("  ✓ " + name); }
  catch (e) { failures++; console.error("  ✗ " + name + ": " + e.message); }
}

console.log("ob-hueco-recuperado");

t("B2 un aporte del tramo antiguo no compra participaciones", () => {
  const s = base();
  const add = ctx.importObExpenses(s, [tx(day(-40), 150, "Aporte mensual", "cx-aporte")], links) || [];
  const row = add.find((e) => e.extId === "cx-aporte");
  assert.ok(row, "el movimiento se registra");
  assert.notEqual(row.category, "inversion");
  assert.equal(bought(s, add), 1000);
});

t("B2 el aporte de la ventana de siempre sigue comprando", () => {
  const s = base();
  const add = ctx.importObExpenses(s, [tx(day(-2), 150, "Aporte mensual", "cx-hoy")], links) || [];
  assert.equal(add.length, 1);
  assert.equal(add[0].category, "inversion");
  assert.equal(bought(s, add), 1150);
});

t("B3 un fijo ya modelado del tramo antiguo no entra como gasto", () => {
  const s = base(Object.assign({}, sinAporte, {
    fixed: [{ id: "alq", name: "Alquiler piso", amount: 800, account: "caixabank", freq: "mes", day: 18 }],
  }));
  const viejo = ctx.importObExpenses(s, [tx(day(-40), 800, "Alquiler piso", "cx-alq-viejo")], links) || [];
  assert.equal(viejo.find((e) => e.extId === "cx-alq-viejo"), undefined);
  const hoy = ctx.importObExpenses(s, [tx(day(-2), 800, "Alquiler piso", "cx-alq-hoy")], links) || [];
  assert.equal(hoy.find((e) => e.extId === "cx-alq-hoy"), undefined);
});

t("un fijo que no toca este mes (anual, con importes a medida, o un puntual de otro mes) tampoco entra en el tramo", () => {
  const s = base(Object.assign({}, sinAporte, {
    fixed: [
      { id: "seg", name: "Seguro hogar", amount: 312.4, account: "caixabank", freq: "año", months: [otroMes] },
      { id: "ibi", name: "Impuesto vivienda", amount: 0, account: "caixabank", freq: "año", schedule: [{ m: otroMes, amt: 210.5, day: 5 }] },
    ],
    oneoffs: [{ id: "o1", name: "Reparación caldera", amount: 95, account: "caixabank", y: now.getFullYear() - 1, m: otroMes, day: 9 }],
  }));
  const lote = [
    tx(day(-40), 312.4, "Seguro hogar", "cx-seg"),
    tx(day(-41), 210.5, "Impuesto vivienda", "cx-ibi"),
    tx(day(-42), 95, "Reparación caldera", "cx-cal"),
    tx(day(-43), 31, "Seguro hogar", "cx-otro-importe"),
  ];
  const add = ctx.importObExpenses(s, lote, links) || [];
  assert.equal(JSON.stringify(add.map((e) => e.extId)), JSON.stringify(["cx-otro-importe"]), "solo entra el que no casa en importe");
  // Dentro de la ventana manda el mes en curso, como siempre: ese anual hoy no es un recibo esperado.
  const hoy = ctx.importObExpenses(s, [tx(day(-2), 312.4, "Seguro hogar", "cx-seg-hoy")], links) || [];
  assert.equal(hoy.length, 1);
});

t("el posible repetido del tramo se busca con la fecha REAL del movimiento", () => {
  const cerca = { id: "w-cerca", date: day(-61) + "T12:00:00.000Z", amount: 12.34, merchant: "Cafetería", category: "bares", source: "wallet", ent: "caixabank" };
  // Mismo importe, pero en el primer día de la ventana de siempre: a tres semanas o más del
  // movimiento real. Si el repetido se buscara con la fecha recortada al margen, casaría con este.
  const som = new Date(now.getFullYear(), now.getMonth(), 1 - 8, 12).toISOString();
  const lejos = { id: "w-lejos", date: som, amount: 12.34, merchant: "Cafetería", category: "bares", source: "wallet", ent: "caixabank" };
  const con = ctx.importObExpenses(base({ expenses: [lejos, cerca] }), [tx(day(-60), 12.34, "Movimiento", "cx-mov")], links) || [];
  assert.equal(con.length, 1);
  assert.equal(con[0].possibleDup, true);
  assert.equal(con[0].possibleDupOf, "w-cerca");
  const sin = ctx.importObExpenses(base({ expenses: [lejos] }), [tx(day(-60), 12.34, "Movimiento", "cx-mov")], links) || [];
  assert.equal(sin.length, 1);
  assert.equal(sin[0].possibleDup, undefined, "un apunte de un mes después no es su gemelo");
});

t("un ingreso del tramo entra con su fecha y sin repetirse", () => {
  const s = base();
  const lote = [{ ent: "caixabank", id: "cx-nom", date: day(-40), amount: -1500, merchant: "Nómina sintética", note: "", status: "BOOK" }];
  const add = ctx.importObExpenses(s, lote, links) || [];
  assert.equal(add.length, 1);
  assert.equal(add[0].amount, -1500);
  assert.equal(add[0].date.slice(0, 10), day(-40));
  assert.equal(ctx.importObExpenses(base({ expenses: add }), lote, links), null);
  assert.equal(ctx.importObExpenses(s, lote), null, "sin suelo, lo anterior al margen no entra");
});

t("B3 el cargo del día 18 del mes pasado no confirma el recibo de este mes", () => {
  const y = now.getFullYear();
  const prev = new Date(y, mes - 2, 18);
  const ymd = prev.getFullYear() + "-" + String(prev.getMonth() + 1).padStart(2, "0") + "-18";
  const s = base(Object.assign({}, sinAporte, {
    fixed: [{ id: "alq", name: "Alquiler piso", amount: 800, account: "caixabank", freq: "mes", day: 18 }],
    bankTx: [{ ent: "caixabank", id: "cx-prev", date: ymd, amount: 800, merchant: "Alquiler piso", status: "BOOK" }],
  }));
  const res = ctx.reconcileBank(s, y, mes, 10);
  assert.equal(res.confirmed.some((c) => c.name === "Alquiler piso"), false, ymd);
});

t("B3 un mes ya cerrado conserva su cola del día 15 en adelante", () => {
  // Hace dos meses y su mes anterior: ninguno es el mes en curso.
  const cerrado = new Date(now.getFullYear(), mes - 3, 1), cola = new Date(now.getFullYear(), mes - 4, 18);
  const ymd = cola.getFullYear() + "-" + String(cola.getMonth() + 1).padStart(2, "0") + "-18";
  const s = base(Object.assign({}, sinAporte, {
    fixed: [{ id: "alq", name: "Alquiler piso", amount: 800, account: "caixabank", freq: "mes", day: 1 }],
    bankTx: [{ ent: "caixabank", id: "cx-cola", date: ymd, amount: 800, merchant: "Alquiler piso", status: "BOOK" }],
  }));
  const res = ctx.reconcileBank(s, cerrado.getFullYear(), cerrado.getMonth() + 1, 28);
  assert.equal(res.confirmed.some((c) => c.name === "Alquiler piso"), true, ymd);
});

t("B3 la cola de los últimos 8 días del mes pasado sigue confirmando el recibo de este mes", () => {
  const y = now.getFullYear();
  const ultimo = new Date(y, mes - 1, 0);
  const ymd = ultimo.getFullYear() + "-" + String(ultimo.getMonth() + 1).padStart(2, "0") + "-" + String(ultimo.getDate()).padStart(2, "0");
  const s = base(Object.assign({}, sinAporte, {
    fixed: [{ id: "hip", name: "Hipoteca sintética", amount: 640, account: "caixabank", freq: "mes", day: 1 }],
    bankTx: [{ ent: "caixabank", id: "cx-hip", date: ymd, amount: 640, merchant: "Hipoteca sintética", status: "BOOK" }],
  }));
  const res = ctx.reconcileBank(s, y, mes, 10);
  assert.equal(res.confirmed.some((c) => c.name === "Hipoteca sintética"), true, ymd);
});

t("R2 el aviso del tramo no espera respuesta dentro de runBankSync", () => {
  const main = fs.readFileSync(new URL("../src/modules/11-app-main.js", import.meta.url), "utf8");
  const from = main.indexOf("const runBankSync=function");
  const to = main.indexOf("const BROKER_SYNC_THROTTLE");
  assert.ok(from > 0 && to > from);
  const body = main.slice(from, to);
  assert.doesNotMatch(body, /askConfirm|askText/, "un diálogo ahí dejaba bankSyncing atascado y pisaba al que hubiera abierto");
  assert.match(body, /if\(opts\.manual\) links\.forEach\(function\(l\)\{\s*if\(l&&l\.gapBeyondCap\) avisaSync\(opts,/, "solo en sync manual");
});

t("los textos del tramo no prometen lo que el banco no entrega", () => {
  const i18n = fs.readFileSync(new URL("../src/modules/01-i18n.js", import.meta.url), "utf8");
  const caps = [...i18n.matchAll(/bank_gap_cap:"([^"]+)"/g)], mores = [...i18n.matchAll(/bank_gap_more:"([^"]+)"/g)];
  assert.equal(caps.length, 3, "es, en y ca");
  assert.equal(mores.length, 3, "es, en y ca");
  for (let i = 0; i < 3; i++) {
    const cap = caps[i][1], more = mores[i][1];
    assert.match(cap, /\{bank\}/);
    assert.match(more, /\{bank\}/);
    assert.match(cap, /90/);
    assert.doesNotMatch(cap + more, /hist[oò]ric|history/i);
  }
});

if (failures) process.exitCode = 1;
