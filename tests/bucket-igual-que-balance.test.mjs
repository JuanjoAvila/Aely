/**
 * LA FILA Y EL BALANCE CUENTAN LO MISMO (14/9/2026, su «el balance no me cuadra»).
 *
 * Con sus capturas del 14/9: Gastos 813,84 € y Ingresos 329,12 € en la tarjeta, pero sumando la
 * lista le salían 378,86 € de ingresos. La diferencia, 49,74 €, eran los 6 ingresos de Sabadell:
 * el balance (`monthBudgetStats`) no los cuenta —Sabadell no es de gasto diario— y la fila
 * (`expenseBucket`) los pintaba como «ingreso» normal. Lo mismo con un «+291,25 Traspaso».
 * Propiedad, con DOS bancos (memoria «misma regla en dos sitios»): una fila del mes está en
 * «cuenta»/«ingreso» si y solo si el balance la suma.
 */
import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const cli = loadPureLogicFromFile();

function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}`); throw e; }
}

console.log("bucket-igual-que-balance");

const hoy = new Date();
const Y = hoy.getFullYear(), M = hoy.getMonth();
const dia = (d) => new Date(Y, M, d, 12).toISOString();
const ahora = new Date(Y, M, 20, 12).getTime();
let n = 0;
const fila = (d, amount, merchant, ent, category, extra = {}) =>
  Object.assign({ id: "x" + (++n), date: dia(d), amount, merchant, ent, category, source: "ob" }, extra);

/* Su mes de septiembre, con sus importes. TR = gasto diario; Sabadell y Revolut, no. */
const gastosTR = [10.73, 2.40, 3.01, 17.90, 8.50, 17.85, 6.49, 21.37, 6.40, 2.40, 22.00, 5.83, 10.73, 2.40,
  23.00, 7.50, 12.50, 156.70, 21.82, 103.60, 0.85, 80.67, 1.50, 10.73, 2.40, 149.00, 92.43, 10.73, 2.40];
// 72,10 + 42,30 + 81,80 + 13,72 y ocho bizums de 14,90 = 329,12
const ingresosTR = [72.10, 42.30, 81.80, 13.72, 14.90, 14.90, 14.90, 14.90, 14.90, 14.90, 14.90, 14.90];
const ingresosSabadell = [14.33, 18.09, 4.33, 4.33, 4.33, 4.33];

function suEstado() {
  const exps = [];
  gastosTR.forEach((a, i) => exps.push(fila(1 + (i % 14), a, "Comercio " + i, "trade_republic", "bares")));
  ingresosTR.forEach((a, i) => exps.push(fila(1 + (i % 7), -a, "Bizum recibido", "trade_republic", "ingreso")));
  ingresosSabadell.forEach((a, i) => exps.push(fila(2 + (i % 5), -a, "TRANSFERENCIA " + i, "sabadell", "ingreso")));
  exps.push(fila(2, -291.25, "Movimiento", "trade_republic", "traspaso"));             // traspaso entrante
  exps.push(fila(2, 25.99, "GOOGLE YOUTUBE", "sabadell", "otros"));                   // gasto de otro banco
  exps.push(fila(2, 50, "Movimiento", "trade_republic", "inversion"));               // inversión
  exps.push(fila(3, 197, "Préstamo", "sabadell", "deudas", { debtId: "piso" }));      // cuota de deuda
  exps.push(fila(4, 18.09, "Transferencia a banco Sabadell", "trade_republic", "traspaso"));
  return {
    budget: 1000,
    accounts: [
      { id: "a1", ent: "trade_republic", role: "diario", value: 900 },
      { id: "a2", ent: "sabadell", role: "fijos", value: 3000 },
      { id: "a3", ent: "revolut", role: "ahorro", value: 500 },
    ],
    settings: { expenseBanks: ["trade_republic"] },
    fixed: [], oneoffs: [], flows: [], debts: [{ id: "piso", name: "Préstamo", monthly: 197, account: "sabadell", day: 3 }],
    expenses: exps,
  };
}

const r2 = (x) => Math.round(x * 100) / 100;

t("★ SU CASO: gastos 813,84 y ingresos 329,12, como la tarjeta", () => {
  const st = cli.monthBudgetStats(suEstado(), ahora);
  assert.equal(r2(st.spent), 813.84);
  assert.equal(r2(st.income), 329.12);
});

t("★ PROPIEDAD: cada fila está en «cuenta»/«ingreso» si y solo si el balance la suma", () => {
  const s = suEstado();
  let spent = 0, income = 0;
  for (const e of s.expenses) {
    const b = cli.expenseBucket(e, s);
    const sumada = cli.expenseCountsBudget(e, s);
    assert.equal(b === "cuenta" || b === "ingreso", sumada, `${e.merchant} ${e.amount} ${e.ent}/${e.category} → ${b}`);
    if (b === "cuenta") spent += e.amount;
    if (b === "ingreso") income += -e.amount;
  }
  const st = cli.monthBudgetStats(s, ahora);
  assert.equal(r2(spent), r2(st.spent));
  assert.equal(r2(income), r2(st.income));
});

t("un ingreso de Sabadell dice «no es del día a día»; uno de TR sigue siendo ingreso", () => {
  const s = suEstado();
  const sab = s.expenses.find((e) => e.ent === "sabadell" && e.amount < 0);
  const tr = s.expenses.find((e) => e.ent === "trade_republic" && e.category === "ingreso");
  assert.equal(cli.expenseBucket(sab, s), "otrobanco");
  assert.equal(cli.expenseBucket(tr, s), "ingreso");
});

t("un traspaso ENTRANTE es «neutra» (no es un gasto), no un ingreso", () => {
  const s = suEstado();
  const trasp = s.expenses.find((e) => e.amount === -291.25);
  assert.equal(cli.expenseBucket(trasp, s), "neutra");
});

console.log("  ok");
