#!/usr/bin/env node
/** Helper único de cargos del Plan: recibos ≠ traspasos/nómina (audit Claude 17/9 + NO-GO). */
import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const c = loadPureLogicFromFile();

function base(overrides) {
  return Object.assign({
    fixed: [
      { id: "luz", name: "Luz", amount: 40, freq: "mes", day: 28, account: "sabadell" },
    ],
    debts: [
      { id: "coche", name: "Coche", monthly: 200, value: 5000, account: "sabadell", day: 28 },
    ],
    oneoffs: [
      { id: "itv", name: "ITV", amount: 50, year: 2026, month: 9, day: 20, account: "sabadell" },
    ],
    flows: [
      { id: "nom", kind: "income", name: "Nómina", amount: 2000, to: "sabadell", day: 1 },
      { id: "tr", kind: "transfer", name: "A TR", amount: 100, from: "sabadell", to: "trade_republic", day: 25 },
    ],
    accounts: [{ id: "sb", ent: "sabadell", role: "fijos", value: 1000 }],
  }, overrides || {});
}

console.log("plan-charges");

{
  const p = c.planChargesMonth(base(), 9, 2026, 10);
  assert.equal(p.pendingBillsCount, 3, "luz+coche+itv pendientes el día 10");
  assert.equal(p.pendingBillsTotal, 290);
  assert.equal(p.transfersPending.length, 1);
  assert.equal(p.incomePending.length, 0, "nómina día 1 ya pagada");
  assert.ok(p.pendingBills.every((x) => x.kind !== "transfer" && x.kind !== "income"));
  const s = c.pendingBillsSummary(base(), 9, 2026, 10);
  assert.equal(s.count, p.pendingBillsCount);
  assert.equal(s.total, p.pendingBillsTotal);
}

{
  const p = c.planChargesMonth(base(), 9, 2026, 30);
  assert.equal(p.pendingBillsCount, 0);
  assert.equal(p.paidBillsCount, 3);
  assert.equal(p.transfersPending.length, 0);
}

{
  // Deuda SIN day: pendiente, day null (no fallback día 1)
  const p = c.planChargesMonth(base({
    fixed: [], oneoffs: [], flows: [],
    debts: [{ id: "x", name: "Sin día", monthly: 80, value: 800, account: "sabadell" }],
  }), 9, 2026, 15);
  assert.equal(p.pendingBillsCount, 1);
  assert.equal(p.pendingBills[0].day, null);
  assert.equal(p.pendingBills[0].paid, false);
}

{
  const st = c.planCoverState({ minByBank: { sabadell: -10 }, minDayByBank: { sabadell: 12 } }, "sabadell", 200);
  assert.equal(st.tone, "bad");
  const warn = c.planCoverState({ minByBank: { sabadell: 50 }, minDayByBank: { sabadell: 12 } }, "sabadell", 200);
  assert.equal(warn.tone, "warn");
  const ok = c.planCoverState({ minByBank: { sabadell: 500 }, minDayByBank: { sabadell: 12 } }, "sabadell", 200);
  assert.equal(ok.tone, "ok");
}

{
  // Multi-banco: el peor (bad) gana
  const pick = c.planCoverPickBank(
    { minByBank: { sabadell: 500, revolut: -20 }, minDayByBank: { sabadell: 5, revolut: 8 } },
    { sabadell: 40, revolut: 15 },
    [
      { bank: "sabadell", amount: 40 },
      { bank: "revolut", amount: 15 },
    ]
  );
  assert.equal(pick.bank, "revolut");
  assert.equal(pick.cover.tone, "bad");
}

{
  // Todo pagado: sin pendientes, el banco sale del mayor recibo pagado
  const pick = c.planCoverPickBank(
    { minByBank: { sabadell: 800 }, minDayByBank: { sabadell: 0 }, mainBank: "sabadell" },
    {},
    [],
    [{ bank: "sabadell", amount: 40, name: "Luz" }]
  );
  assert.equal(pick.bank, "sabadell");
  assert.equal(pick.pending, 0);
}

{
  // Deuda sin día: la portada descuenta la cuota del mínimo (sin tocar 11)
  const st = c.planCoverState(
    { minByBank: { sabadell: 500 }, minDayByBank: { sabadell: 12 } },
    "sabadell",
    80,
    [{ bank: "sabadell", amount: 80, day: null, kind: "debt", name: "Sin día" }]
  );
  assert.equal(st.min, 420);
  assert.equal(st.minDay, null);
  // 420 >= 80 → ok; con saldo más justo sería warn/bad
  assert.equal(st.tone, "ok");
  const tight = c.planCoverState(
    { minByBank: { sabadell: 100 }, minDayByBank: { sabadell: 12 } },
    "sabadell",
    80,
    [{ bank: "sabadell", amount: 80, day: null, kind: "debt" }]
  );
  assert.equal(tight.min, 20);
  assert.equal(tight.tone, "warn");
}

{
  // El fijo sin día ya llevó 500 → 400 en minByBank; solo falta descontar la deuda de 50.
  // Restar ambos otra vez daría 250 y anunciaría un descubierto ficticio.
  const st = c.planCoverState(
    { minByBank: { sabadell: 400 }, minDayByBank: { sabadell: 0 } },
    "sabadell",
    100,
    [
      { bank: "sabadell", amount: 100, day: null, kind: "fixed", name: "Luz" },
      { bank: "sabadell", amount: 50, day: null, kind: "debt", name: "Préstamo" },
    ]
  );
  assert.equal(st.min, 350);
  assert.equal(st.minDay, null);
}

console.log("  ok");
