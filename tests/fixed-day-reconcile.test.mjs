#!/usr/bin/env node
/**
 * Cambiar el día de un recibo ya confirmado por el banco no puede cobrarlo otra vez.
 * La fecha planificada cambia, pero la ocurrencia del mes sigue siendo una sola y pagada.
 */
import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const c = loadPureLogicFromFile();
let reloj = new Date("2026-09-24T12:00:00+02:00");
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
      { id: "tx-luz-sep", ent: "sabadell", date: "2026-09-24", amount: 120, merchant: "IBERDROLA LUZ" },
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
  const antes = estado(24);
  let despues;
  c.patchFixedById((updater) => { despues = updater(antes); }, "luz", { day: 27 });
  const gastosAntes = JSON.parse(JSON.stringify(antes.expenses));

  const rec = c.reconcileBank(despues, 2026, 9, 24);
  assert.equal(rec.confirmed.length, 1, "el banco sigue confirmando el mismo recibo tras mover su fecha prevista");
  assert.equal(rec.paidAt.luz, 24, "la conciliación conserva el día real del fijo confirmado");

  assert.equal(c.monthNetForAccount(antes, "sabadell", 2026, 9, 24), -120);
  assert.equal(c.monthNetForAccount(despues, "sabadell", 2026, 9, 24), -120,
    "el cargo real ya ocurrido no vuelve a pendiente al mover el día 24 → 27");
  assert.equal(c.monthNetForAccount(despues, "revolut", 2026, 9, 24), 0,
    "el otro banco no se mueve");

  const plan = c.planChargesMonth(despues, 9, 2026, 24);
  assert.equal(plan.pendingBills.concat(plan.paidBills).filter((x) => x.id === "fixed_luz").length, 1,
    "solo existe una ocurrencia del recibo");
  assert.equal(plan.pendingBills.filter((x) => x.id === "fixed_luz").length, 0,
    "la fecha nueva no crea un segundo descuento pendiente");
  assert.equal(plan.paidBills.filter((x) => x.id === "fixed_luz").length, 1);
  assert.equal(plan.paidBills.find((x) => x.id === "fixed_luz").day, 24,
    "la ocurrencia pagada muestra el día real, nunca el día futuro planificado");
  assert.equal(despues.fixed[0].day, 27, "el día nuevo queda reservado para la próxima ocurrencia");

  const persistido = despues;
  assert.equal(persistido.fixed[0].paidYm, 2026 * 12 + 9,
    "la confirmación mínima viaja con el fijo porque el histórico bancario no se sube");
  assert.equal(persistido.fixed[0].paidDay, 24,
    "también viaja la fecha real para no presentar como cobrado un día futuro");
  const enOtroDispositivo = { ...persistido, bankTx: [] };
  assert.equal(c.monthNetForAccount(enOtroDispositivo, "sabadell", 2026, 9, 24), -120,
    "la confirmación persiste aunque el otro dispositivo no tenga bankTx");
  assert.equal(c.planChargesMonth(enOtroDispositivo, 9, 2026, 24).pendingBills.length, 0);
  assert.equal(c.planChargesMonth(enOtroDispositivo, 9, 2026, 24).paidBills[0].day, 24,
    "sin bankTx local se sigue mostrando la fecha real persistida");

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
  assert.equal(bancoDistinto.fixed[0].paidDay, undefined,
    "al invalidar la confirmación tampoco queda una fecha bancaria huérfana");
  assert.equal(c.planChargesMonth(bancoDistinto, 9, 2026, 24).pendingBills.length, 1);

  assert.equal(saldoMostrado(despues, "sabadell"), saldoMostrado(antes, "sabadell"),
    "cambiar el día no mueve el saldo del banco del recibo");
  assert.equal(saldoMostrado(despues, "revolut"), saldoMostrado(antes, "revolut"),
    "cambiar el día no mueve el saldo de otro banco");
  assert.deepEqual(despues.expenses, gastosAntes, "el histórico queda byte a byte igual");
  assert.equal(despues.fixed.length, 1, "no se duplica el fijo persistido");
}

{
  reloj = new Date("2026-09-25T12:00:00+02:00");
  const sinCobro = estado(24);
  sinCobro.bankTx = [
    { id: "tx-seguro-sep", ent: "sabadell", date: "2026-09-10", amount: 45, merchant: "SEGURO COCHE" },
  ];
  const gastosAntes = JSON.stringify(sinCobro.expenses);
  const cuentasAntes = JSON.stringify(sinCobro.accounts);
  let despues;
  c.patchFixedById((updater) => { despues = updater(sinCobro); }, "luz", { day: 25 });

  assert.equal(despues.fixed[0].day, 25, "la nueva fecha prevista queda guardada");
  assert.equal(despues.fixed[0].wait, 2026 * 12 + 9,
    "si el banco aún no ha cobrado, llegar al día editado no inventa una confirmación");
  assert.equal(despues.fixed[0].paidYm, undefined);
  assert.equal(despues.fixed[0].paidDay, undefined);
  assert.equal(c.reconcileBank(despues, 2026, 9, 25).confirmed.length, 0);

  const pendiente = c.planChargesMonth(despues, 9, 2026, 25);
  assert.equal(pendiente.pendingBills.filter((x) => x.id === "fixed_luz").length, 1,
    "el recibo continúa pendiente el día 25 mientras no exista movimiento bancario");
  assert.equal(pendiente.paidBills.filter((x) => x.id === "fixed_luz").length, 0);
  assert.equal(c.monthNetForAccount(despues, "sabadell", 2026, 9, 25), 0,
    "un cobro ausente no se resta de Sabadell");
  assert.equal(c.monthNetForAccount(despues, "revolut", 2026, 9, 25), 0,
    "editar el recibo tampoco mueve otro banco");
  assert.equal(saldoMostrado(despues, "sabadell")-saldoMostrado(sinCobro, "sabadell"), 120,
    "al retirar el falso pago vuelve a verse el dinero que todavía no ha salido");
  assert.equal(saldoMostrado(despues, "revolut"), saldoMostrado(sinCobro, "revolut"));
  assert.equal(JSON.stringify(despues.expenses), gastosAntes, "el histórico no cambia");
  assert.equal(JSON.stringify(despues.accounts), cuentasAntes, "ningún saldo guardado se reescribe a ciegas");
  assert.equal(despues.fixed.length, 1, "la edición no duplica el fijo");

  const cobrado = Object.assign({}, despues, { bankTx: [
    { id: "tx-luz-sep-25", ent: "sabadell", date: "2026-09-25", amount: 120, merchant: "IBERDROLA LUZ" },
  ] });
  const pagado = c.planChargesMonth(cobrado, 9, 2026, 25);
  assert.equal(pagado.pendingBills.filter((x) => x.id === "fixed_luz").length, 0,
    "cuando llega el cargo real deja de estar pendiente");
  assert.equal(pagado.paidBills.filter((x) => x.id === "fixed_luz").length, 1);
  assert.equal(pagado.paidBills.find((x) => x.id === "fixed_luz").day, 25);
  assert.equal(c.monthNetForAccount(cobrado, "sabadell", 2026, 9, 25), -120,
    "el cargo real se descuenta una sola vez");

  let confirmado;
  c.patchFixedById((updater) => { confirmado = updater(cobrado); }, "luz", { day: 25 });
  assert.equal(confirmado.fixed[0].wait, undefined, "la confirmación bancaria retira la espera");
  assert.equal(confirmado.fixed[0].paidYm, 2026 * 12 + 9);
  assert.equal(confirmado.fixed[0].paidDay, 25);
}

{
  const soloCalendario = estado(24);
  soloCalendario.bankTx = [];
  let despues;
  c.patchFixedById((updater) => { despues = updater(soloCalendario); }, "luz", { day: 25 });
  assert.equal(despues.fixed[0].wait, undefined,
    "sin feed que cubra el día no se inventa que el banco aún no ha cobrado");
  assert.equal(c.planChargesMonth(despues, 9, 2026, 25).paidBills.length, 1,
    "quien usa solo calendario conserva la regla de día ya ocurrido");
  assert.equal(JSON.stringify(despues.accounts), JSON.stringify(soloCalendario.accounts));
}

{
  const primeraBeta = estado(27);
  primeraBeta.fixed[0].paidYm = 2026 * 12 + 9;
  const antes = JSON.stringify(primeraBeta);
  const fila = c.planChargesMonth(primeraBeta, 9, 2026, 24).paidBills.find((x) => x.id === "fixed_luz");
  assert.equal(fila.day, 24, "el estado de la beta rechazada recupera la fecha real del banco");
  assert.equal(primeraBeta.fixed[0].day, 27, "la previsión futura permanece separada");
  assert.equal(JSON.stringify(primeraBeta), antes, "mostrar la corrección no muta el estado ni los movimientos bancarios");
}

{
  reloj = new Date("2026-09-24T12:00:00+02:00");
  const sinCobro = estado(27);
  sinCobro.bankTx = [];
  assert.equal(c.monthNetForAccount(sinCobro, "sabadell", 2026, 9, 24), 0,
    "sin movimiento bancario, un recibo del día 27 sigue pendiente");
  assert.equal(c.planChargesMonth(sinCobro, 9, 2026, 24).pendingBills.length, 1);
}

console.log("\nfixed-day-reconcile: OK");
