#!/usr/bin/env node
/**
 * INFORME DEL MES CERRADO — tope superior de monthBudgetStats.
 *
 * Sin `hastaMs`, pasar una fecha de agosto suma agosto + septiembre + lo que venga
 * (criterio 3 del brief). El default infinito deja Inicio/Gastos/widget iguales.
 */
import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx = loadPureLogicFromFile();
/* PORTADO A PRODUCCIÓN (2026-09-10). En beta esto usaba `ctx.inicioDeMesMs`, que llegó con la
   tanda de la ventana de mes — la que él RECHAZÓ. No se porta esa tanda, así que aquí se calcula
   el inicio de mes igual que lo hace producción (`startOfMonth`, hora local). Es andamiaje del
   test para fijar una frontera, no el sujeto de la prueba: lo que se comprueba sigue siendo el
   desglose y el informe. */
const inicioMesMs = (ms) => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); };


function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}`); throw e; }
}

console.log("informe-mes");

const augMs = Date.parse("2026-08-15T12:00:00+02:00");
const sepStart = inicioMesMs(Date.parse("2026-09-05T12:00:00+02:00"));

t("★ criterio 3: un gasto del mes NUEVO no se cuela en el informe del mes cerrado", () => {
  const s = {
    budget: 500,
    expenses: [
      { date: "2026-08-10T12:00:00.000Z", amount: 40, category: "super" },
      { date: "2026-09-02T12:00:00.000Z", amount: 99, category: "super" },
    ],
  };
  // Sin tope: el bug histórico (40+99).
  assert.equal(ctx.monthBudgetStats(s, augMs).spent, 139);
  // Con hastaMs = inicio de septiembre: solo agosto.
  const cerrado = ctx.monthBudgetStats(s, augMs, sepStart);
  assert.equal(cerrado.spent, 40, "septiembre no puede entrar en el informe de agosto");
  assert.equal(cerrado.against, 40);
});

t("sin hastaMs (llamada de hoy) sigue sumando desde el día 1 en adelante", () => {
  const nowMs = Date.parse("2026-09-05T12:00:00+02:00");
  const s = {
    budget: 500,
    expenses: [
      { date: "2026-09-02T12:00:00.000Z", amount: 25, category: "super" },
      { date: "2026-08-10T12:00:00.000Z", amount: 40, category: "super" },
    ],
  };
  const bs = ctx.monthBudgetStats(s, nowMs);
  assert.equal(bs.spent, 25);
});

t("tarjeta: sale los primeros días con cifras del mes cerrado; dismiss no vuelve", () => {
  const sep2 = Date.parse("2026-09-02T12:00:00+02:00");
  const sep20 = Date.parse("2026-09-20T12:00:00+02:00");
  const s = {
    budget: 500,
    expenses: [
      { date: "2026-08-10T12:00:00.000Z", amount: 40, category: "super" },
      { date: "2026-08-12T12:00:00.000Z", amount: -100, category: "ingreso" },
      { date: "2026-09-02T12:00:00.000Z", amount: 99, category: "super" },
    ],
  };
  const card = ctx.closedMonthCardOf(s, sep2);
  assert.ok(card, "debe salir el día 2");
  assert.equal(card.ym, "2026-08");
  assert.equal(card.stats.spent, 40);
  assert.ok(card.stats.spent !== 139);
  assert.equal(ctx.closedMonthCardOf(s, sep20), null, "pasados los primeros días no sale");
  const gone = ctx.dismissClosedMonthCard(s, "2026-08");
  assert.equal(ctx.closedMonthCardOf(gone, sep2), null, "tras descartar no vuelve");
});

t("mes sin movimientos: no sale la tarjeta", () => {
  const sep2 = Date.parse("2026-09-02T12:00:00+02:00");
  const s = { budget: 500, expenses: [{ date: "2026-09-01T12:00:00.000Z", amount: 10, category: "super" }] };
  assert.equal(ctx.closedMonthCardOf(s, sep2), null);
});

console.log("\ninforme-mes: OK");
