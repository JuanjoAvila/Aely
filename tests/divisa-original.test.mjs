#!/usr/bin/env node
/**
 * LA DIVISA DE VERDAD DEL APUNTE (2026-08-06, con el crucero saliendo al día siguiente).
 *
 * Desde la 4.14.0 se puede apuntar en liras y la app convierte a euros. Pero `origAmount`/`origCur`
 * vivían SOLO en el objeto en memoria: se escribían al apuntar y no había columna donde guardarlos.
 * Apuntabas 1.520 ₺, se guardaban 41,80 €, y en el primer pull de la nube el rastro desaparecía —
 * un viaje entero en el histórico como euros pelados.
 *
 * Lo que se prueba aquí es el VIAJE DE IDA Y VUELTA, que es donde se perdía: que la fila que baja
 * de la nube recupere lo que subió. Y la regla que evita la mentira: si luego se edita el importe
 * en euros a mano, el rastro en liras deja de corresponder y se borra.
 */
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

console.log("divisa-original");

const fila = (extra) => Object.assign({
  id: 1, fecha: "2026-08-08T12:00:00.000Z", importe: 41.8,
  comercio: "Gran Bazar", cat: "compras", source: "manual",
}, extra);

t("la fila con divisa vuelve con su importe original", () => {
  const e = ctx.expenseFromRow(fila({ importe_orig: 1520, divisa: "TRY" }));
  assert.equal(e.amount, 41.8);          // la app sigue contando en euros
  assert.equal(e.origAmount, 1520);
  assert.equal(e.origCur, "TRY");
});

t("un gasto en euros no se inventa divisa", () => {
  const e = ctx.expenseFromRow(fila({}));
  assert.equal(e.origAmount, undefined);
  assert.equal(e.origCur, undefined);
});

t("importe_orig llega como texto desde PostgREST y sigue siendo número", () => {
  // numeric de Postgres viaja como string en JSON: sin Number() el símbolo se pintaba pegado
  // a una cadena y las comparaciones (> 0) fallaban en silencio.
  const e = ctx.expenseFromRow(fila({ importe_orig: "1520.00", divisa: "TRY" }));
  assert.equal(typeof e.origAmount, "number");
  assert.equal(e.origAmount, 1520);
});

t("media pareja no cuela: sin divisa no hay importe original", () => {
  const soloImporte = ctx.expenseFromRow(fila({ importe_orig: 1520, divisa: null }));
  assert.equal(soloImporte.origCur, undefined);
  const soloDivisa = ctx.expenseFromRow(fila({ importe_orig: null, divisa: "TRY" }));
  assert.equal(soloDivisa.origAmount, undefined);
});

t("sin tipo la cifra original no pasa por euros", () => {
  assert.equal(ctx.toEurAmt(1520, "TRY", { fxRates: {} }), null);
  assert.equal(ctx.toEurAmt(1520, "TRY", { fxRates: { TRY: 0.018261 } }), 27.76);
});

console.log("  ok");
