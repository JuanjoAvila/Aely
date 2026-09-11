#!/usr/bin/env node
/** Cada banco descuenta lo suyo. Un gasto de Revolut no puede bajar Trade Republic.
    Reproduce el 257,17 € medido el 2026-08-18 (brief bug-saldo-cruzado-gasto-diario). */
import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx = loadPureLogicFromFile();

function t(name, fn) {
  try { fn(); console.log("  ✓ " + name); }
  catch (e) { console.error("  ✗ " + name); throw e; }
}

function shownDaily(a, o) {
  return ctx.saldoCuentaGasto({
    value: a.value,
    injTR: o.injTR || 0,
    spentOwn: (o.spentByBank && o.spentByBank[a.ent]) || 0,
    roundup: o.roundup || 0,
    monthlyInvest: o.monthlyInvest || 0,
    ambos: (a.role === "ambos"),
    paidNet: o.paidNet || 0,
  });
}
function shownOther(a, o) {
  return (a.value || 0) + (o.paidNet || 0);
}

console.log("saldo-por-banco");

t("gastoDelMesPorBanco: a mano sin banco sale de la diaria", () => {
  const map = ctx.gastoDelMesPorBanco(
    [{ amount: 100, source: "manual" }],
    "trade_republic"
  );
  assert.equal(map.trade_republic, 100);
  assert.equal(map.revolut, undefined);
});

t("1. 100 € en Revolut: el saldo de TR no se mueve", () => {
  const gastos = [{ amount: 100, ent: "revolut", source: "ob:revolut" }];
  const spentByBank = ctx.gastoDelMesPorBanco(gastos, "trade_republic");
  const tr = { ent: "trade_republic", value: 5000, role: "diario" };
  const o = { spentByBank, injTR: 0, roundup: 0, monthlyInvest: 0 };
  assert.equal(shownDaily(tr, o), 5000);
});

t("2. 100 € en Trade Republic: su saldo baja 100", () => {
  const gastos = [{ amount: 100, ent: "trade_republic", source: "macrodroid" }];
  const spentByBank = ctx.gastoDelMesPorBanco(gastos, "trade_republic");
  const tr = { ent: "trade_republic", value: 5000, role: "diario" };
  assert.equal(shownDaily(tr, { spentByBank }), 4900);
});

t("3. gasto a mano sin banco sale de la cuenta diaria", () => {
  const gastos = [{ amount: 40, source: "manual" }];
  const spentByBank = ctx.gastoDelMesPorBanco(gastos, "trade_republic");
  const tr = { ent: "trade_republic", value: 5000, role: "diario" };
  assert.equal(shownDaily(tr, { spentByBank }), 4960);
});

t("4. editar el saldo y releerlo devuelve el mismo número (ida y vuelta)", () => {
  const o = { spentOwn: 1372.64, injTR: 1800, roundup: 12.3, monthlyInvest: 50, ambos: false, paidNet: 0 };
  const shown = ctx.saldoCuentaGasto(Object.assign({ value: 4200 }, o));
  const stored = ctx.valueDesdeSaldo(Object.assign({ shown: shown }, o));
  const shown2 = ctx.saldoCuentaGasto(Object.assign({ value: stored }, o));
  assert.equal(shown2, shown);
});

t("4b. ida y vuelta con rol ambos (lleva paidNet)", () => {
  const o = { spentOwn: 200, injTR: 0, roundup: 0, monthlyInvest: 0, ambos: true, paidNet: 80 };
  const shown = ctx.saldoCuentaGasto(Object.assign({ value: 1000 }, o));
  const stored = ctx.valueDesdeSaldo(Object.assign({ shown: shown }, o));
  const shown2 = ctx.saldoCuentaGasto(Object.assign({ value: stored }, o));
  assert.equal(shown2, shown);
});

t("5. cuenta OB (Revolut) no descuenta sus gastos otra vez", () => {
  const gastos = [
    { amount: 257.17, ent: "revolut", source: "ob:revolut" },
    { amount: 1372.64, ent: "trade_republic", source: "macrodroid" },
  ];
  const spentByBank = ctx.gastoDelMesPorBanco(gastos, "trade_republic");
  const rv = { ent: "revolut", value: 2200, role: "fijos", bankIban: "XX4659" };
  assert.equal(shownOther(rv, { paidNet: 0 }), 2200);
  assert.equal(spentByBank.revolut, 257.17);
});

t("6. el arreglo recupera los euros en TR, no los resta de Revolut (caso 257,17)", () => {
  const gastos = [
    { amount: 1372.64, ent: "trade_republic", source: "macrodroid" },
    { amount: 257.17, ent: "revolut", source: "ob:revolut" },
  ];
  const spentByBank = ctx.gastoDelMesPorBanco(gastos, "trade_republic");
  const thisMonthSpent = 1372.64 + 257.17;
  const tr = { ent: "trade_republic", value: 8000, role: "diario" };
  const rv = { ent: "revolut", value: 2200, role: "fijos" };
  const trNuevo = shownDaily(tr, { spentByBank });
  const trViejo = 8000 - thisMonthSpent;
  const rvShown = shownOther(rv, { paidNet: 0 });
  assert.equal(+trNuevo.toFixed(2), +(8000 - 1372.64).toFixed(2));
  assert.equal(+(trNuevo - trViejo).toFixed(2), 257.17);
  assert.equal(rvShown, 2200);
  const liquidoNuevo = trNuevo + rvShown;
  const liquidoViejo = trViejo + rvShown;
  assert.equal(+(liquidoNuevo - liquidoViejo).toFixed(2), 257.17);
});

t("7. re-anclar Revolut con DOS bancos: el pintado cuadra con el banco (padre 26,46)", () => {
  // Reproduce 2026-09-11: spentM global devolvía gastos de Caixa/TR a la base de Revolut.
  const now = new Date();
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  const d = (day) => new Date(Date.UTC(y, m, day, 12, 0, 0)).toISOString();
  const s = {
    accounts: [
      { id: "rv", ent: "revolut", name: "Revolut", value: 500, role: "ambos", bankIban: "ES99" },
      { id: "cx", ent: "caixabank", name: "Caixa", value: 2000, role: "fijos" },
    ],
    expenses: [
      { id: "e1", date: d(3), amount: 400, merchant: "Mercadona", source: "ob:caixabank", ent: "caixabank" },
      { id: "e2", date: d(4), amount: 29, merchant: "Cafe", source: "ob:revolut", ent: "revolut" },
    ],
    fixed: [], debts: [], oneoffs: [], flows: [], obAccounts: [],
  };
  const bal = 26.46;
  const r = ctx.applyBankBalances(s, [{
    ok: true,
    aspsp: "Revolut",
    accounts: [{ uid: "u1", iban: "ES99", ok: true, balances: [{ type: "ITAV", amount: bal, currency: "EUR" }] }],
  }]);
  assert.ok(r.changed);
  const acc = r.state.accounts.find((a) => a.ent === "revolut");
  const monthExp = (r.state.expenses || s.expenses).filter((e) => {
    const ms = ctx.dateMs(e.date);
    const start = Date.UTC(now.getFullYear(), now.getMonth(), 1);
    return ms >= start;
  });
  const spentByBank = ctx.gastoDelMesPorBanco(monthExp, "revolut");
  const paidNet = ctx.monthNetForAccount(r.state, "revolut", now.getFullYear(), now.getMonth() + 1, now.getDate());
  const shown = ctx.saldoCuentaMostrada(acc, {
    injTR: 0, spentByBank: spentByBank, paidNetByBank: { revolut: paidNet },
    roundup: 0, monthlyInvest: 0,
  });
  assert.equal(+shown.toFixed(2), bal);
  // Con el bug viejo (spentM = 429), el pintado quedaba ~bal+400.
  assert.ok(Math.abs(shown - (bal + 400)) > 1, "no debe inflarse con el gasto de Caixa");
});

console.log("\nsaldo-por-banco: OK");
