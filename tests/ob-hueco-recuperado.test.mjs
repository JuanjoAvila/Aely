import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

// B2, B3, R5 y R6 sobre el tramo anterior a la ventana de siempre.
// La fecha del proceso es la del reloj del test: día −40 cae fuera del margen de 8 días.
const ctx = loadPureLogicFromFile();
const day = (delta) => new Date(Date.now() + delta * 86400000).toISOString().slice(0, 10);
const floors = { caixabank: day(-60) };

function base(extra) {
  return Object.assign({
    accounts: [{ id: "cx", ent: "caixabank", role: "diario", value: 400, monthlyInvest: 150, rewardInv: "fondo" }],
    settings: { expenseBanks: ["caixabank"] },
    investments: [{ id: "fondo", value: 1000, cost: 1000, shares: 10, cur: "EUR" }],
    fixed: [], debts: [], oneoffs: [], flows: [], deleted: [], expenses: [], bankTx: [],
  }, extra || {});
}
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
  const add = ctx.importObExpenses(s, [tx(day(-40), 150, "Aporte mensual", "cx-aporte")], { syncFromByEnt: floors }) || [];
  const row = add.find((e) => e.extId === "cx-aporte");
  assert.ok(row, "el movimiento se registra");
  assert.notEqual(row.category, "inversion");
  assert.equal(bought(s, add), 1000);
});

t("B2 el aporte de la ventana de siempre sigue comprando", () => {
  const s = base();
  const add = ctx.importObExpenses(s, [tx(day(-2), 150, "Aporte mensual", "cx-hoy")]) || [];
  assert.equal(add.length, 1);
  assert.equal(add[0].category, "inversion");
  assert.equal(bought(s, add), 1150);
});

t("B3 un fijo ya modelado del tramo antiguo no entra como gasto", () => {
  const s = base({
    accounts: [
      { id: "cx", ent: "caixabank", role: "ambos", value: 400, monthlyInvest: 0 },
    ],
    fixed: [{ id: "alq", name: "Alquiler piso", amount: 800, account: "caixabank", freq: "mes", day: 18 }],
  });
  const viejo = ctx.importObExpenses(s, [tx(day(-40), 800, "Alquiler piso", "cx-alq-viejo")], { syncFromByEnt: floors }) || [];
  assert.equal(viejo.find((e) => e.extId === "cx-alq-viejo"), undefined);
  const hoy = ctx.importObExpenses(s, [tx(day(-2), 800, "Alquiler piso", "cx-alq-hoy")], { syncFromByEnt: floors }) || [];
  assert.equal(hoy.find((e) => e.extId === "cx-alq-hoy"), undefined);
});

t("B3 el cargo del día 18 del mes pasado no confirma el recibo de este mes", () => {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth() + 1;
  const prev = new Date(y, m - 2, 18);
  const ymd = prev.getFullYear() + "-" + String(prev.getMonth() + 1).padStart(2, "0") + "-18";
  const s = base({
    accounts: [{ id: "cx", ent: "caixabank", role: "ambos", value: 400 }],
    fixed: [{ id: "alq", name: "Alquiler piso", amount: 800, account: "caixabank", freq: "mes", day: 18 }],
    bankTx: [{ ent: "caixabank", id: "cx-prev", date: ymd, amount: 800, merchant: "Alquiler piso", status: "BOOK" }],
  });
  const res = ctx.reconcileBank(s, y, m, 10);
  assert.equal(res.confirmed.some((c) => c.name === "Alquiler piso"), false, ymd);
});

t("R6 colgar el suelo en el estado no importa el tramo", () => {
  const s = base();
  s._obSyncFrom = floors;
  const add = ctx.importObExpenses(s, [tx(day(-40), 8, "Librería", "cx-lib")]);
  assert.equal(add, null);
  assert.deepEqual(s._obSyncFrom, floors);
});

t("R5 el suelo que dejó el sync entra sin tocar el estado", () => {
  assert.equal(typeof ctx.obGapRemember, "function");
  const s = base();
  ctx.obGapRemember(floors);
  const add = ctx.importObExpenses(s, [tx(day(-40), 8, "Librería", "cx-lib")]) || [];
  assert.equal(add.length, 1);
  assert.equal(add[0].date.slice(0, 10), day(-40));
  assert.equal(s._obSyncFrom, undefined);
  assert.equal(ctx.importObExpenses(s, [tx(day(-40), 9, "Otra", "cx-otra")]), null);
});

t("R2 el aviso de 90 días no vive dentro de runBankSync", () => {
  const main = fs.readFileSync(new URL("../src/modules/11-app-main.js", import.meta.url), "utf8");
  const from = main.indexOf("const runBankSync=function");
  const to = main.indexOf("const BROKER_SYNC_THROTTLE");
  assert.ok(from > 0 && to > from);
  const body = main.slice(from, to);
  assert.doesNotMatch(body, /askConfirm/);
  assert.doesNotMatch(body, /_obSyncFrom/);
});

t("el cliente nuevo pide recoverGaps y no dateFrom", () => {
  const core = fs.readFileSync(new URL("../src/modules/00-core.js", import.meta.url), "utf8");
  const main = fs.readFileSync(new URL("../src/modules/11-app-main.js", import.meta.url), "utf8");
  assert.match(core, /\{recoverGaps:true\}/);
  assert.doesNotMatch(main, /bankSync\(\{[^)]*dateFrom/);
  assert.doesNotMatch(core, /invoke\('bank-sync',\{body:\{[^}]*dateFrom/);
});

if (failures) process.exitCode = 1;
