#!/usr/bin/env node
/**
 * Tanda 6 — Efectivo (plan-tanda-6-efectivo.md).
 * El sobre baja al gastar; el cajero es traspaso neutro; TR no se descuenta dos veces.
 */
import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx = loadPureLogicFromFile();

function t(name, fn) {
  try { fn(); console.log("  ✓ " + name); }
  catch (e) { console.error("  ✗ " + name); throw e; }
}

function shown(a, o) {
  return ctx.saldoCuentaMostrada(a, {
    injTR: o.injTR || 0,
    spentByBank: o.spentByBank || {},
    roundup: o.roundup || 0,
    monthlyInvest: o.monthlyInvest || 0,
    paidNetByBank: o.paidNetByBank || {},
  });
}

console.log("efectivo");

t("efectivo es cuenta reconocible", () => {
  assert.equal(ctx.isEfectivoEnt({ ent: "efectivo" }), true);
  assert.equal(ctx.isEfectivoEnt({ ent: "sabadell" }), false);
  assert.equal(ctx.isEfectivoEnt({ ent: "trade_republic" }), false);
});

t("gasto en efectivo baja SOLO el sobre; TR no se mueve", () => {
  const gastos = [
    { amount: 12, ent: "efectivo", source: "manual", category: "bares" },
    { amount: 50, ent: "trade_republic", source: "macrodroid", category: "super" },
  ];
  const spentByBank = ctx.gastoDelMesPorBanco(gastos, "trade_republic");
  const cash = { id: "c1", ent: "efectivo", value: 120, role: "fijos" };
  const tr = { id: "t1", ent: "trade_republic", value: 5000, role: "diario", spendFrom: true };
  assert.equal(shown(cash, { spentByBank }), 108);
  assert.equal(shown(tr, { spentByBank }), 4950);
});

t("cuenta manual sin IBAN (no efectivo) NO descuenta gastos — decisión dueño pendiente", () => {
  const gastos = [{ amount: 80, ent: "familia", source: "manual", category: "otros" }];
  const spentByBank = ctx.gastoDelMesPorBanco(gastos, "trade_republic");
  const manual = { id: "m1", ent: "familia", value: 1000, role: "fijos" };
  assert.equal(shown(manual, { spentByBank }), 1000);
});

t("TR sin bankIban NO recibe la regla de efectivo (no doble descuento)", () => {
  const gastos = [{ amount: 100, ent: "trade_republic", source: "macrodroid", category: "super" }];
  const spentByBank = ctx.gastoDelMesPorBanco(gastos, "trade_republic");
  const tr = { id: "t1", ent: "trade_republic", value: 5000, role: "diario", spendFrom: true };
  // Si la regla fuera «sin IBAN», restaría otra vez fuera de saldoCuentaGasto → 4800.
  assert.equal(shown(tr, { spentByBank }), 4900);
});

t("saque cajero: patrimonio igual; traspaso no es gasto del mes", () => {
  const st0 = {
    accounts: [
      { id: "sb", ent: "sabadell", value: 1000, role: "fijos" },
      { id: "ef", ent: "efectivo", value: 50, role: "fijos" },
    ],
    expenses: [],
    settings: { expenseBanks: ["trade_republic", "efectivo"] },
  };
  const liquido0 = st0.accounts.reduce(function(a, acc) {
    return a + shown(acc, { spentByBank: {} });
  }, 0);
  const st1 = ctx.applySaqueCajero(st0, "sabadell", 200);
  const spent = ctx.gastoDelMesPorBanco(st1.expenses, "trade_republic");
  const liquido1 = st1.accounts.reduce(function(a, acc) {
    return a + shown(acc, { spentByBank: spent });
  }, 0);
  assert.equal(+liquido1.toFixed(2), +liquido0.toFixed(2));
  const sb = st1.accounts.find(function(a){ return a.ent === "sabadell"; });
  const ef = st1.accounts.find(function(a){ return a.ent === "efectivo"; });
  assert.equal(sb.value, 800);
  assert.equal(ef.value, 250);
  assert.ok(st1.expenses.some(function(e){ return e.category === "traspaso" && e.ent === "sabadell" && e.amount === 200; }));
  // traspaso no cuenta como gasto (expenseCountsCash)
  assert.equal(st1.expenses.filter(function(e){ return ctx.expenseCountsCash(e, st1); }).length, 0);
});

t("saque desde OB (bankIban): no toca value del banco; sí sube efectivo", () => {
  const st0 = {
    accounts: [
      { id: "sb", ent: "sabadell", value: 1000, role: "fijos", bankIban: "ES00" },
      { id: "ef", ent: "efectivo", value: 50, role: "fijos" },
    ],
    expenses: [],
  };
  const st1 = ctx.applySaqueCajero(st0, "sabadell", 200);
  assert.equal(st1.accounts.find(function(a){ return a.ent === "sabadell"; }).value, 1000);
  assert.equal(st1.accounts.find(function(a){ return a.ent === "efectivo"; }).value, 250);
});

t("ATM keywords → traspaso SOLO en alta nueva, no en autoCategory", () => {
  assert.equal(ctx.isAtmWithdrawal("RETIRADA CAJERO AUTOMATICO"), true);
  assert.equal(ctx.isAtmWithdrawal("Mercadona"), false);
  // autoCategory NO debe convertir cajero (migrate lo usaría y tocaría el histórico)
  assert.equal(ctx.autoCategory("RETIRADA CAJERO AUTOMATICO"), "otros");
  assert.equal(ctx.categoryOfNewMerchant("RETIRADA CAJERO AUTOMATICO"), "traspaso");
  assert.equal(ctx.categoryOfNewMerchant("Mercadona"), ctx.autoCategory("Mercadona"));
});

t("migrate NO saca un cajero viejo de «otros»", () => {
  const st = {
    expenses: [{
      id: "old-atm",
      merchant: "RETIRADA CAJERO 4B",
      category: "otros",
      source: "ob",
      amount: 50,
      date: "2026-01-15T12:00:00.000Z",
      ent: "sabadell",
    }],
    accounts: [],
    settings: {},
  };
  const next = ctx.migrate(JSON.parse(JSON.stringify(st)));
  const e = (next.expenses || []).find(function(x){ return x.id === "old-atm"; });
  assert.ok(e);
  assert.equal(e.category, "otros", "el histórico en otros se queda en otros");
});

t("borrar efectivo: gastos se quedan; expenseBanks limpio; líquido sin el sobre", () => {
  const st0 = {
    accounts: [
      { id: "ef", ent: "efectivo", value: 100, role: "fijos" },
      { id: "tr", ent: "trade_republic", value: 5000, role: "diario", spendFrom: true },
    ],
    expenses: [
      { id: "g1", amount: 10, ent: "efectivo", category: "bares", date: new Date().toISOString(), source: "manual" },
    ],
    settings: { expenseBanks: ["trade_republic", "efectivo"] },
  };
  const st1 = ctx.removeEfectivoAccount(st0, "ef");
  assert.equal(st1.accounts.some(function(a){ return a.ent === "efectivo"; }), false);
  assert.equal(st1.expenses.length, 1);
  assert.equal(st1.expenses[0].ent, "efectivo");
  assert.ok(st1.settings.expenseBanks.indexOf("efectivo") < 0);
  const spent = ctx.gastoDelMesPorBanco(st1.expenses, "trade_republic");
  const liquido = st1.accounts.reduce(function(a, acc) {
    return a + shown(acc, { spentByBank: spent });
  }, 0);
  assert.equal(liquido, 5000);
});

t("ensureEfectivoAccount crea una sola y la mete en expenseBanks", () => {
  const st0 = { accounts: [], settings: { expenseBanks: ["trade_republic"] } };
  const st1 = ctx.ensureEfectivoAccount(st0, 80);
  assert.equal(st1.accounts.filter(function(a){ return a.ent === "efectivo"; }).length, 1);
  assert.equal(st1.accounts[0].value, 80);
  assert.ok(st1.settings.expenseBanks.indexOf("efectivo") >= 0);
  const st2 = ctx.ensureEfectivoAccount(st1, 999);
  assert.equal(st2.accounts.filter(function(a){ return a.ent === "efectivo"; }).length, 1);
  assert.equal(st2.accounts[0].value, 80);
});

console.log("efectivo: OK");
