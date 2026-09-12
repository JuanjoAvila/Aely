#!/usr/bin/env node
/**
 * DOS BANCOS NO SE COMEN EL UNO AL OTRO AL APLANAR EL HISTÓRICO.
 *
 * Medido con la sonda de SU móvil (12/9, 19:23 y 19:25, dos búsquedas con dos minutos de
 * diferencia):
 *
 *     19:23   bankReported    92   ·  llegan  40  ·  skippedUniq     0
 *     19:25   bankReported  1230   ·  llegan 106  ·  skippedUniq  1104
 *
 * Mil ciento cuatro filas de mil doscientas treinta tiradas en silencio. Su relato encaja al
 * milímetro: «la primera vez me salieron cosas del Sabadell y nada de Trade Republic; le doy otra
 * vez y sale TR y Revolut y todo genial, PEROOOOO desapareció el Sabadell, me marca 0».
 *
 * Causa: la clave anti-duplicados del aplanado era `ext_id|signo|fecha|importe|comercio` y **no
 * llevaba el banco**. Como Trade Republic no manda ni `ext_id` ni comercio, un cargo suyo y uno de
 * Sabadell del mismo día e importe eran «el mismo», y el segundo se descartaba.
 *
 * Es la TERCERA clave de identidad sin banco que aparece hoy, después de `histCandExisting` y del
 * susto del sync («un Revolut de 23 € se comía un TR»).
 */
import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx = loadPureLogicFromFile();

let fallos = 0;
const t = (nombre, fn) => {
  try { fn(); console.log("  ✓ " + nombre); }
  catch (e) { fallos++; console.error("  ✗ " + nombre + "\n      " + (e && e.message)); }
};

/* Lo que manda el Edge: un link por banco, con sus cuentas y sus transacciones. */
const link = (aspsp, txs) => ({ aspsp, accounts: [{ uid: aspsp + "-1", transactions: txs }] });
/* TR no manda ni ext_id ni comercio: así es como llega de verdad. */
const tx = (date, amount, extra) => Object.assign({ date, amount }, extra || {});

console.log("hist-uniq-por-banco");

t("su caso: mismo día e importe en dos bancos → entran LOS DOS", () => {
  const res = { links: [
    link("Sabadell", [tx("2026-09-01", 10.34)]),
    link("Trade Republic", [tx("2026-09-01", 10.34)]),
  ] };
  const r = ctx.histFlattenHistoryLinks(res, [], {}, {});
  assert.equal(r.out.length, 2, "una fila por banco");
  assert.equal(r.stats.skippedUniq, 0, "no se tira ninguna");
  const bancos = r.out.map((x) => x.ent).sort();
  assert.equal(new Set(bancos).size, 2, "y son de bancos distintos");
});

t("dentro del MISMO banco, la repetida se sigue tirando (para eso está la clave)", () => {
  const res = { links: [link("Sabadell", [tx("2026-09-01", 10.34), tx("2026-09-01", 10.34)])] };
  const r = ctx.histFlattenHistoryLinks(res, [], {}, {});
  assert.equal(r.out.length, 1);
  assert.equal(r.stats.skippedUniq, 1);
});

t("tres bancos con el mismo cargo: tres filas, cero descartes", () => {
  const res = { links: [
    link("Sabadell", [tx("2026-08-31", 50)]),
    link("Trade Republic", [tx("2026-08-31", 50)]),
    link("Revolut", [tx("2026-08-31", 50)]),
  ] };
  const r = ctx.histFlattenHistoryLinks(res, [], {}, {});
  assert.equal(r.out.length, 3);
  assert.equal(r.stats.skippedUniq, 0);
});

t("y el signo no los mezcla: un ingreso y un gasto del mismo importe son dos cosas", () => {
  const res = { links: [link("Sabadell", [tx("2026-09-01", 13.72), tx("2026-09-01", -13.72)])] };
  const r = ctx.histFlattenHistoryLinks(res, [], {}, {});
  assert.equal(r.out.length, 2);
});

console.log(fallos ? `hist-uniq-por-banco: ${fallos} fallo(s)` : "hist-uniq-por-banco: OK");
process.exit(fallos ? 1 : 0);
