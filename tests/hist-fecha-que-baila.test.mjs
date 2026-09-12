#!/usr/bin/env node
/**
 * LA FECHA DEL BANCO BAILA, Y SIN COMERCIO NO HAY MÁS PISTAS.
 *
 * Sus tres capturas del 12/9 puestas una al lado de otra —lo que tiene en Gastos, lo que dice la
 * app de Trade Republic, y lo que le ofrece «Importar histórico»— dan esto:
 *
 *   Consum 6,49 €            Gastos y TR: 11 sept   ·  histórico: 2026-09-12   (+1)  ❌ «nuevo»
 *   La Tagliatella 21,37 €   Gastos y TR: 10 sept   ·  histórico: 2026-09-11   (+1)  ❌ «nuevo»
 *   MAPFRE 2,40 €            Gastos y TR: 10 sept   ·  histórico: 2026-09-11   (+1)  ❌ «nuevo»
 *   Bizum a Ionan 6,40 €     Gastos y TR: 10 sept   ·  histórico: 2026-09-10   (0)   ✅ detectado
 *
 * El histórico devuelve la fecha CONTABLE (las compras con tarjeta se apuntan al día siguiente) y
 * el sync diario la de la operación. Como TR por Open Banking **no manda comercio** —todo llega
 * como «Movimiento»—, la fecha era prácticamente lo único que quedaba para reconocerlo. Por eso le
 * salían 92 «nuevos» estando todos apuntados.
 *
 * El sync diario YA daba ±3 días para eso (`gemeloOtraVia`); el histórico comparaba al día exacto.
 * Ahora comparten `DUP_DIAS_MS` y `sinComercioReal`.
 *
 * ⚠ Y la red NO marca «repetido», marca «puede que». Los dos últimos casos son el freno: con un
 * comercio de verdad la fecha deja de ser lo único, y dos cargos iguales en días seguidos existen.
 */
import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx = loadPureLogicFromFile();

let fallos = 0;
const t = (nombre, fn) => {
  try { fn(); console.log("  ✓ " + nombre); }
  catch (e) { fallos++; console.error("  ✗ " + nombre + "\n      " + (e && e.message)); }
};

/* Lo que tiene apuntado, tal cual se lo trajo el sync diario: sin comercio, TR. */
const guardado = (date, amount) => ({
  date, amount, merchant: "Movimiento", obName: "Movimiento", source: "ob", ent: "trade_republic",
});
/* Lo que ofrece el histórico: mismo cargo, fecha contable. */
const cand = (date, amount, merchant) => ({
  date, amount, merchant: merchant || "Movimiento", kind: "out", ent: "trade_republic",
});
const clasifica = (cands, expenses) =>
  ctx.histClassifyCandidates(cands, { expenses, accounts: [] }).rows.map((r) => r && r.status);

console.log("hist-fecha-que-baila");

t("sus tres de tarjeta, con un día de más, salen como «puede que ya lo tengas»", () => {
  const expenses = [
    guardado("2026-09-11T12:00:00.000Z", 6.49),   // Consum
    guardado("2026-09-10T12:00:00.000Z", 21.37),  // La Tagliatella
    guardado("2026-09-10T12:00:00.000Z", 2.40),   // MAPFRE
  ];
  const cands = [cand("2026-09-12", 6.49), cand("2026-09-11", 21.37), cand("2026-09-11", 2.40)];
  assert.deepEqual(clasifica(cands, expenses), ["maybe", "maybe", "maybe"]);
});

t("y el Bizum, que llega con la fecha buena, sigue saliendo como repetido exacto", () => {
  const expenses = [guardado("2026-09-10T12:00:00.000Z", 6.40)];
  assert.deepEqual(clasifica([cand("2026-09-10", 6.40)], expenses), ["dup"]);
});

t("1:1 — dos candidatos parecidos contra UN guardado solo marcan uno", () => {
  const expenses = [guardado("2026-09-10T12:00:00.000Z", 9.9)];
  assert.deepEqual(clasifica([cand("2026-09-11", 9.9), cand("2026-09-11", 9.9)], expenses), ["maybe", "new"]);
});

t("⚠ FRENO 1: con un comercio de verdad, la fecha cercana NO basta", () => {
  const expenses = [{ date: "2026-09-10T12:00:00.000Z", amount: 12, merchant: "MERCADONA", source: "ob", ent: "trade_republic" }];
  assert.deepEqual(clasifica([cand("2026-09-11", 12, "CONSUM")], expenses), ["new"],
    "dos comercios distintos del mismo importe son dos gastos, no uno");
});

t("⚠ FRENO 2: fuera de la ventana de 3 días vuelve a ser nuevo", () => {
  const expenses = [guardado("2026-09-05T12:00:00.000Z", 30)];
  assert.deepEqual(clasifica([cand("2026-09-11", 30)], expenses), ["new"]);
});

t("⚠ FRENO 3: otro banco no cuenta, aunque cuadren importe y fecha", () => {
  const expenses = [{ date: "2026-09-11T12:00:00.000Z", amount: 7.5, merchant: "Movimiento", source: "ob", ent: "revolut" }];
  assert.deepEqual(clasifica([cand("2026-09-11", 7.5)], expenses), ["new"]);
});

console.log(fallos ? `hist-fecha-que-baila: ${fallos} fallo(s)` : "hist-fecha-que-baila: OK");
process.exit(fallos ? 1 : 0);
