// «Nuevo precio» desde Para revisar con un «Lo descuento» que no cuadra (DIN-10, ronda F 19/11/2026):
// lo que se pregunta y lo que se guarda salen de la MISMA transformación. Datos sintéticos.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createLogicSandbox, extractPureLogicSource } from "../scripts/load-pure-logic.mjs";

const source = extractPureLogicSource(fs.readFileSync("public/index.html", "utf8"));
const screens = fs.readFileSync("src/modules/14-v4-screens.js", "utf8");
const time = Date.parse("2026-10-18T10:00:00Z");
class Clock extends Date { constructor(...a) { super(...(a.length ? a : [time])); } static now() { return time; } }
const c = createLogicSandbox({ Date: Clock }); vm.runInNewContext(source, c); vm.runInNewContext(screens, c);
const plain = (x) => JSON.parse(JSON.stringify(x));
// Recibo de 80 a medias con «Lo descuento» a partes iguales; sube a 100.
const recibo = { id: "b", name: "Recibo sintético", amount: 40, bankAmount: 80, freq: "mes", day: 20, account: "banco",
  reparto: [{ id: "p", n: "Persona sintética", via: "debt", debtId: "d", amt: 40, auto: true }] };
const estado = (deuda) => ({ debts: [deuda], fixed: [recibo], oneoffs: [], flows: [], accounts: [], expenses: [], settings: {} });
const precio = (s) => {
  const rr = c.repartoResolver(c.repartoVigente(recibo), 100);
  assert.equal(rr.ok, true);
  return c.reciboPrecioCambio("b", { bankAmount: 100, amount: rr.mia, reparto: rr.partes });
};

test("deuda que no cuadra: el precio nuevo pregunta, con lo que sale del banco y lo que baja", () => {
  const d = { id: "d", name: "Deuda sintética", monthly: 210, amort: 270, months: 30, value: 6000, asOf: 2026 * 12 + 9, day: 20, account: "banco" };
  const s = estado(d), cambio = precio(s), tras = cambio(s);
  assert.equal(tras.fixed[0].bankAmount, 100);
  assert.equal(tras.fixed[0].amount, 50);
  // Antes se guardaba esto mismo sin preguntar: la cuota se quedaba en 210 con 50 descontados.
  assert.deepEqual(plain(c.descuentoDescuadre(s, tras)), [{ id: "d", name: "Deuda sintética", paga: 200, baja: 250, descuento: 50 }]);
  // Con su respuesta, la deuda queda cuadrada: lo que pasa + lo descontado = lo que baja.
  const fijado = c.conDescuentoFijado([{ id: "d", paga: 200, baja: 250 }], tras).debts[0];
  assert.deepEqual([fijado.monthly, fijado.amort], [200, 250]);
});

test("deuda que ya cuadraba: la cuota baja sola y no se pregunta nada", () => {
  const d = { id: "d", name: "Deuda sintética", monthly: 210, amort: 250, months: 30, value: 6000, asOf: 2026 * 12 + 9, day: 20, account: "banco" };
  const s = estado(d), tras = precio(s)(s);
  assert.equal(tras.debts[0].monthly, 200);
  assert.deepEqual(plain(c.descuentoDescuadre(s, tras)), []);
});
