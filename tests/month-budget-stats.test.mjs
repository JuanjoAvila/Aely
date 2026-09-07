#!/usr/bin/env node
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

console.log("month-budget-stats");

const nowMs = Date.now();
const ym = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Madrid", year: "numeric", month: "2-digit",
}).format(new Date(nowMs));
const d = (day) => ym + "-" + String(day).padStart(2, "0") + "T12:00:00.000Z";

t("excluye inversión y traspaso del gastado", () => {
  const s = {
    budget: 500,
    expenses: [
      { date: d(2), amount: 40, category: "super" },
      { date: d(3), amount: 100, category: "inversion" },
      { date: d(4), amount: 50, category: "traspaso" },
      { date: d(5), amount: -200, category: "ingreso" },
    ],
  };
  const bs = ctx.monthBudgetStats(s, nowMs);
  assert.equal(bs.spent, 40);
  assert.equal(bs.income, 200);
  assert.equal(bs.against, 40); // gTotalMode split por defecto
  assert.equal(bs.budget, 500);
  assert.equal(bs.remaining, 460);
});

t("resta reservas del presupuesto (no del gastado)", () => {
  const s = {
    budget: 500,
    expenses: [{ date: d(2), amount: 100, category: "super" }],
    reservaLog: [{ date: d(1), amount: 80 }],
  };
  const bs = ctx.monthBudgetStats(s, nowMs);
  assert.equal(bs.reserved, 80);
  assert.equal(bs.budget, 420);
  assert.equal(bs.spent, 100);
  assert.equal(bs.remaining, 320);
});

t("modo net: against = gasto − ingreso", () => {
  const s = {
    budget: 500,
    settings: { gTotalMode: "net" },
    expenses: [
      { date: d(2), amount: 100, category: "super" },
      { date: d(3), amount: -30, category: "ingreso" },
    ],
  };
  const bs = ctx.monthBudgetStats(s, nowMs);
  assert.equal(bs.against, 70);
  assert.equal(bs.shown, 70); // |balance|
  assert.equal(bs.remaining, 430);
});

t("gamifOf usa la misma cifra (no thisMonthSpent con neutras)", () => {
  const s = {
    budget: 500,
    goals: [],
    expenses: [
      { date: d(2), amount: 50, category: "super" },
      { date: d(3), amount: 200, category: "inversion" },
    ],
  };
  const g = ctx.gamifOf(s, { thisMonthSpent: 250, roundupThisMonth: 0, savebackThisMonth: 0 });
  assert.equal(g.budgetReto.spent, 50, "el reto no debe contar la inversión");
  assert.equal(g.budgetReto.budget, 500);
});

console.log("\nmonth-budget-stats: OK");
