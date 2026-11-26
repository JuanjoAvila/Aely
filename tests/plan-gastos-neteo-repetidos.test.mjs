#!/usr/bin/env node
/** H6: Plan (`planReparto`) y Gastos (`monthBudgetStats`) deben netear igual los repetidos.
 *  `viva` en Plan excluye `possibleDup` y `autoGemelo`; `budgetRowSigned` debe cuadrar.
 *  Mes natural y Mi ciclo; TZ del proceso (UTC / Europe/Madrid). Datos inventados. */
import assert from "node:assert/strict";
import { cargarMotor, base, mov, dia } from "./helpers/plan-reparto-fixture.mjs";

const TZ = process.env.TZ || "(sin TZ)";
const c = cargarMotor();

function cifras(s, budgetMode) {
  const r = c.planReparto(s, {});
  const mb = c.monthBudgetStats(s, null, null, budgetMode);
  const netoGastosCts = Math.round((mb.spent - mb.against) * 100);
  return {
    plan: { gastado: r.gastado, neteo: r.neteo, bruto: r.gastado + r.neteo },
    gastos: {
      spent: mb.spent,
      income: mb.income,
      against: mb.against,
      mode: mb.mode,
      cycle: !!mb.cycle,
      netoCts: netoGastosCts,
    },
  };
}

function exigirParidad(nombre, got, extra) {
  const { plan, gastos } = got;
  console.log(
    `  [${TZ}] ${nombre}` +
      (extra ? " · " + extra : "") +
      `\n    Plan   gastado(net)=${(plan.gastado / 100).toFixed(2)} €  neteo=${(plan.neteo / 100).toFixed(2)} €  bruto=${(plan.bruto / 100).toFixed(2)} €` +
      `\n    Gastos spent=${gastos.spent.toFixed(2)} against=${gastos.against.toFixed(2)} income=${gastos.income.toFixed(2)} (${gastos.mode}${gastos.cycle ? ", ciclo" : ""}) neto≈${(gastos.netoCts / 100).toFixed(2)} €`
  );
  assert.equal(
    Math.round(gastos.against * 100),
    plan.gastado,
    `${nombre}: gastado neto Plan vs against Gastos`
  );
  assert.equal(
    gastos.netoCts,
    plan.neteo,
    `${nombre}: neteo (gasto bruto − against) vs Plan.neteo`
  );
}

console.log("plan-gastos-neteo-repetidos · TZ=" + TZ);

/* Mes natural: ingreso possibleDup no debe netear en ninguna pantalla. */
{
  const s = base({
    settings: { expenseBanks: ["sabadell"], budgetCycle: false, gTotalMode: "net" },
    expenses: [
      mov("n1", 3, -3000, { merchant: "Nómina sintética SL" }),
      mov("g1", 10, 400, { category: "super" }),
      mov("dup", 12, -60, { merchant: "Bizum dudoso", category: "bizum", possibleDup: true }),
      mov("ok", 13, -40, { merchant: "Bizum recibido", category: "bizum" }),
    ],
  });
  exigirParidad("mes natural · possibleDup + bizum legítimo", cifras(s, "mes"));
}

/* Mes natural: fila banco con autoGemelo no cuenta en Plan; Gastos tampoco debe netearla sola
   si la pareja manual ya está. */
{
  const s = base({
    settings: { expenseBanks: ["sabadell"], budgetCycle: false, gTotalMode: "net" },
    expenses: [
      mov("n1", 3, -3000, { merchant: "Nómina sintética SL" }),
      mov("g1", 8, 250, { category: "super" }),
      mov("man", 15, -55, { merchant: "Ingreso manual", category: "ingreso", source: "manual" }),
      mov("ob", 15, -55, {
        merchant: "Ingreso manual",
        category: "ingreso",
        source: "ob:sabadell",
        autoGemelo: "man",
      }),
    ],
  });
  exigirParidad("mes natural · pareja autoGemelo", cifras(s, "mes"));
}

/* Gasto marcado possibleDup: Plan lo ignora; Gastos no debe sumarlo al gastado. */
{
  const s = base({
    settings: { expenseBanks: ["sabadell"], budgetCycle: false, gTotalMode: "net" },
    expenses: [
      mov("n1", 3, -3000, { merchant: "Nómina sintética SL" }),
      mov("g1", 9, 120, { category: "super" }),
      mov("dupg", 9, 180, { category: "super", possibleDup: true }),
      mov("i1", 11, -30, { merchant: "Devolución", category: "ingreso" }),
    ],
  });
  exigirParidad("mes natural · gasto possibleDup + ingreso", cifras(s, "mes"));
}

/* Mi ciclo: ancla nómina día 14, ingreso possibleDup y gemelo banco. */
{
  const s = base({
    settings: { expenseBanks: ["sabadell"], budgetCycle: true, gTotalMode: "net" },
    expenses: [
      mov("n1", 14, -2800, { merchant: "Nómina ciclo SL" }),
      mov("g1", 16, 150, { category: "restaurantes" }),
      mov("dup", 17, -25, { merchant: "Bizum dudoso", category: "bizum", possibleDup: true }),
      mov("leg", 17, -35, { merchant: "Bizum amigo", category: "bizum" }),
      mov("man2", 18, -45, { merchant: "Venta manual", category: "ingreso", source: "manual" }),
      mov("ob2", 18, -45, {
        merchant: "Venta manual",
        category: "ingreso",
        source: "ob:sabadell",
        autoGemelo: "man2",
      }),
    ],
  });
  exigirParidad("Mi ciclo · possibleDup y autoGemelo", cifras(s, "mes"));
}

/* Sensibilidad TZ: movimiento el día 1 a las 23:30 UTC (sigue 1 en Madrid en invierno). */
{
  const ts = "2026-11-01T23:30:00.000Z";
  const AHORA = Date.parse(ts);
  const cTz = cargarMotor();
  class Reloj extends Date {
    constructor(...a) {
      super(...(a.length ? a : [AHORA]));
    }
    static now() {
      return AHORA;
    }
  }
  cTz.Date = Reloj;
  const s = base({
    settings: { expenseBanks: ["sabadell"], budgetCycle: false, gTotalMode: "net" },
    expenses: [
      mov("n1", 3, -3000, { merchant: "Nómina sintética SL" }),
      {
        id: "edge",
        date: ts,
        amount: 90,
        category: "super",
        merchant: "Compra borde TZ",
        ent: "sabadell",
        source: "manual",
      },
      {
        id: "edup",
        date: ts,
        amount: -20,
        category: "bizum",
        merchant: "Bizum borde",
        ent: "sabadell",
        source: "manual",
        possibleDup: true,
      },
    ],
  });
  const r = cTz.planReparto(s, {});
  const mb = cTz.monthBudgetStats(s, null, null, "mes");
  const got = {
    plan: { gastado: r.gastado, neteo: r.neteo, bruto: r.gastado + r.neteo },
    gastos: {
      spent: mb.spent,
      income: mb.income,
      against: mb.against,
      mode: mb.mode,
      cycle: !!mb.cycle,
      netoCts: Math.round((mb.spent - mb.against) * 100),
    },
  };
  exigirParidad("borde 1-nov 23:30Z", got, "now=" + ts);
}

console.log("\nplan-gastos-neteo-repetidos: OK (" + TZ + ")");