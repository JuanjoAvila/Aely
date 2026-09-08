#!/usr/bin/env node
/**
 * Presupuesto por categoría — desglose = cabecera al céntimo (brief criterio 1).
 * Rojo-antes: exige categorySpentByMonth; no toca monthBudgetStats ni el presupuesto general.
 */
import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx = loadPureLogicFromFile();

function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}`); throw e; }
}

console.log("presupuesto-categoria");

const nowMs = Date.parse("2026-09-15T12:00:00+02:00");
const ym = "2026-09";
const d = (day) => ym + "-" + String(day).padStart(2, "0") + "T12:00:00.000Z";

const accounts = [
  { id: "tr", ent: "trade_republic", name: "TR", role: "diario", spendFrom: true },
  { id: "rv", ent: "revolut", name: "Revolut", role: "fijos" },
];
const settings = { expenseBanks: ["trade_republic"], gTotalMode: "split" };

t("★ criterio 1: suma del desglose = cabecera al céntimo", () => {
  const s = {
    budget: 500,
    accounts, settings,
    expenses: [
      { date: d(2), amount: 40.1, category: "super", ent: "trade_republic" },
      { date: d(3), amount: 19.9, category: "bares", ent: "trade_republic" },
      { date: d(4), amount: 100, category: "inversion", ent: "trade_republic" },
      { date: d(5), amount: -50, category: "ingreso", ent: "trade_republic" },
    ],
  };
  const bs = ctx.monthBudgetStats(s, nowMs);
  const rows = ctx.categorySpentByMonth(s, nowMs);
  const sum = rows.reduce((a, r) => a + r.spent, 0);
  assert.equal(+sum.toFixed(2), bs.spent);
  assert.equal(bs.spent, 60);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, "super");
  assert.equal(rows[0].spent, 40.1);
});

t("inversión y traspaso no salen", () => {
  const s = {
    budget: 500, accounts, settings,
    expenses: [
      { date: d(2), amount: 10, category: "super", ent: "trade_republic" },
      { date: d(3), amount: 80, category: "inversion", ent: "trade_republic" },
      { date: d(4), amount: 40, category: "traspaso", ent: "trade_republic" },
    ],
  };
  const ids = ctx.categorySpentByMonth(s, nowMs).map((r) => r.id);
  assert.deepEqual(ids, ["super"]);
});

t("banco fuera de gasto diario no llena barra de categoría", () => {
  const s = {
    budget: 500, accounts, settings,
    categoryBudgets: { ocio: 200 },
    expenses: [
      { date: d(2), amount: 30, category: "super", ent: "trade_republic" },
      { date: d(3), amount: 70, category: "ocio", ent: "revolut" },
    ],
  };
  const rows = ctx.categorySpentByMonth(s, nowMs);
  const ocio = rows.find((r) => r.id === "ocio");
  assert.equal(ocio.spent, 0, "Revolut no cuenta → barra de ocio a 0");
  assert.equal(ocio.limit, 200);
  assert.equal(ctx.monthBudgetStats(s, nowMs).spent, 30);
});

t("límite puesto sin gastos del mes: fila a 0", () => {
  const s = {
    budget: 500, accounts, settings,
    categoryBudgets: { super: 200 },
    expenses: [],
  };
  const rows = ctx.categorySpentByMonth(s, nowMs);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "super");
  assert.equal(rows[0].spent, 0);
  assert.equal(rows[0].limit, 200);
});

t("límite huérfano no suma ni rompe", () => {
  const s = {
    budget: 500, accounts, settings,
    categoryBudgets: { fantasma_viejo: 999, super: 100 },
    expenses: [{ date: d(2), amount: 10, category: "super", ent: "trade_republic" }],
  };
  const rows = ctx.categorySpentByMonth(s, nowMs);
  assert.ok(!rows.some((r) => r.id === "fantasma_viejo"));
  assert.equal(rows.find((r) => r.id === "super").limit, 100);
});

t("hastaMs: desglose del mes cerrado no cuela el mes nuevo", () => {
  const augMs = Date.parse("2026-08-15T12:00:00+02:00");
  const sepStart = ctx.inicioDeMesMs(Date.parse("2026-09-05T12:00:00+02:00"));
  const s = {
    budget: 500, accounts, settings,
    expenses: [
      { date: "2026-08-10T12:00:00.000Z", amount: 40, category: "super", ent: "trade_republic" },
      { date: "2026-08-12T12:00:00.000Z", amount: 20, category: "bares", ent: "trade_republic" },
      { date: "2026-09-02T12:00:00.000Z", amount: 99, category: "super", ent: "trade_republic" },
    ],
  };
  const rows = ctx.categorySpentByMonth(s, augMs, sepStart);
  const sum = rows.reduce((a, r) => a + r.spent, 0);
  assert.equal(sum, 60);
  assert.equal(ctx.monthBudgetStats(s, augMs, sepStart).spent, 60);
  assert.ok(!rows.some((r) => r.spent === 99));
});

t("poner límite de categoría NO mueve monthBudgetStats", () => {
  const base = {
    budget: 500, accounts, settings,
    expenses: [{ date: d(2), amount: 40, category: "super", ent: "trade_republic" }],
  };
  const withLim = Object.assign({}, base, { categoryBudgets: { super: 200 } });
  assert.deepEqual(ctx.monthBudgetStats(base, nowMs), ctx.monthBudgetStats(withLim, nowMs));
});

console.log("\npresupuesto-categoria: OK");
