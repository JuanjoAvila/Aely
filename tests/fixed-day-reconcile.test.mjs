#!/usr/bin/env node
/**
 * Cambiar el día de un recibo ya confirmado por el banco no puede cobrarlo otra vez.
 * La fecha planificada cambia, pero la ocurrencia del mes sigue siendo una sola y pagada.
 */
import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const c = loadPureLogicFromFile();
const reloj = new Date("2026-09-24T12:00:00+02:00");
c.Date = class extends Date {
  constructor(...args) { super(...(args.length ? args : [reloj.getTime()])); }
  static now() { return reloj.getTime(); }
};

function estado(day) {
  return {
    accounts: [
      { id: "sab", ent: "sabadell", name: "Recibos", value: 1500, role: "fijos" },
      { id: "rev", ent: "revolut", name: "Diario", value: 700, role: "fijos" },
    ],
    fixed: [
      { id: "luz", name: "Iberdrola luz", amount: 120, freq: "mes", day, account: "sabadell" },
    ],
    debts: [], oneoffs: [], flows: [], investments: [], assets: [],
    bankTx: [
      { id: "tx-luz-sep", ent: "sabadell", date: "2026-09-20", amount: 120, merchant: "IBERDROLA LUZ" },
    ],
    expenses: [
      { id: "hist-ago", ent: "sabadell", date: "2026-08-20T12:00:00.000Z", amount: 120, merchant: "Iberdrola agosto" },
      { id: "compra-sep", ent: "revolut", date: "2026-09-10T12:00:00.000Z", amount: 30, merchant: "Compra" },
    ],
    settings: { expenseBanks: ["revolut"] },
  };
}

function saldoMostrado(s, ent) {
  const ins = c.insumosSaldoGasto(s);
  const a = s.accounts.find((x) => x.ent === ent);
  return c.saldoCuentaMostrada(a, {
    injTR: ins.injTR,
    spentByBank: ins.spentByBank,
    paidNetByBank: ins.paidNetByBank,
    roundup: ins.roundup,
    monthlyInvest: ins.monthlyInvest,
  });
}

console.log("fixed-day-reconcile");

{
  const antes = estado(20);
  let despues;
  c.patchFixedById((updater) => { despues = updater(antes); }, "luz", { day: 28 });
  const gastosAntes = JSON.parse(JSON.stringify(antes.expenses));

  const rec = c.reconcileBank(despues, 2026, 9, 24);
  assert.equal(rec.confirmed.length, 1, "el banco sigue confirmando el mismo recibo tras mover su fecha prevista");
  assert.equal(rec.fixedPaid.luz, 1, "la conciliación conserva la identidad del fijo confirmado");

  assert.equal(c.monthNetForAccount(antes, "sabadell", 2026, 9, 24), -120);
  assert.equal(c.monthNetForAccount(despues, "sabadell", 2026, 9, 24), -120,
    "el cargo real ya ocurrido no vuelve a pendiente al mover el día 20 → 28");
  assert.equal(c.monthNetForAccount(despues, "revolut", 2026, 9, 24), 0,
    "el otro banco no se mueve");

  const plan = c.planChargesMonth(despues, 9, 2026, 24);
  assert.equal(plan.rows.filter((x) => x.id === "fixed_luz").length, 1,
    "solo existe una ocurrencia del recibo");
  assert.equal(plan.pendingBills.filter((x) => x.id === "fixed_luz").length, 0,
    "la fecha nueva no crea un segundo descuento pendiente");
  assert.equal(plan.paidBills.filter((x) => x.id === "fixed_luz").length, 1);
  assert.equal(plan.paidBills.find((x) => x.id === "fixed_luz").day, 28,
    "la única ocurrencia conserva la fecha prevista nueva");

  const persistido = despues;
  assert.equal(persistido.fixed[0].paidYm, 2026 * 12 + 9,
    "la confirmación mínima viaja con el fijo porque el histórico bancario no se sube");
  const enOtroDispositivo = { ...persistido, bankTx: [] };
  assert.equal(c.monthNetForAccount(enOtroDispositivo, "sabadell", 2026, 9, 24), -120,
    "la confirmación persiste aunque el otro dispositivo no tenga bankTx");
  assert.equal(c.planChargesMonth(enOtroDispositivo, 9, 2026, 24).pendingBills.length, 0);

  let importeCorregido;
  c.patchFixedById((updater) => { importeCorregido = updater(despues); }, "luz", { amount: 121.5 });
  assert.equal(importeCorregido.fixed[0].paidYm, 2026 * 12 + 9,
    "guardar después un importe que todavía concilia no reabre el recibo");
  assert.equal(c.planChargesMonth(importeCorregido, 9, 2026, 24).pendingBills.length, 0);
  assert.equal(c.monthNetForAccount(importeCorregido, "sabadell", 2026, 9, 24), -121.5);

  let bancoDistinto;
  c.patchFixedById((updater) => { bancoDistinto = updater(despues); }, "luz", { account: "revolut" });
  assert.equal(bancoDistinto.fixed[0].paidYm, undefined,
    "mover el recibo a un banco sin ese cargo invalida la confirmación");
  assert.equal(c.planChargesMonth(bancoDistinto, 9, 2026, 24).pendingBills.length, 1);

  assert.equal(saldoMostrado(despues, "sabadell"), saldoMostrado(antes, "sabadell"),
    "cambiar el día no mueve el saldo del banco del recibo");
  assert.equal(saldoMostrado(despues, "revolut"), saldoMostrado(antes, "revolut"),
    "cambiar el día no mueve el saldo de otro banco");
  assert.deepEqual(despues.expenses, gastosAntes, "el histórico queda byte a byte igual");
  assert.equal(despues.fixed.length, 1, "no se duplica el fijo persistido");
}

{
  const sinCobro = estado(28);
  sinCobro.bankTx = [];
  assert.equal(c.monthNetForAccount(sinCobro, "sabadell", 2026, 9, 24), 0,
    "sin movimiento bancario, un recibo del día 28 sigue pendiente");
  assert.equal(c.planChargesMonth(sinCobro, 9, 2026, 24).pendingBills.length, 1);
}

console.log("\nfixed-day-reconcile: OK");
