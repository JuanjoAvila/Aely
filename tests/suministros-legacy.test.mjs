#!/usr/bin/env node
/**
 * «ENERGIA» SE PARTIÓ EN AGUA / LUZ / GAS: QUE NADIE SE QUEDE SIN CATEGORÍA.
 *
 * 12/9/2026, petición suya: *«sale un símbolo de rayito en Aigües de Barcelona que no encaja para
 * nada… Agua por un lado con su símbolo, luz por otro y gas por otro»*. Tenía razón: el recibo del
 * agua con un ⚡ al lado, porque las tres compartían la categoría «Luz, gas y agua».
 *
 * Al retirar el id `energia`, una fila que lo tuviera guardado se quedaría **sin entrada en `CAT`**
 * y se pintaría en blanco. `migrate` lo traduce una vez: se le pregunta al comercio, y si no lo
 * reconoce va a `luz` (la ambigua por defecto, acordada con Cursor).
 *
 * Esto NO es adivinar una categoría que él haya decidido: es traducir un id que hemos retirado
 * nosotros, así que se remapea también lo manual. Y no mueve totales — agua, luz y gas cuentan
 * exactamente igual que contaba energia.
 *
 * Se comprobó EN ROJO quitando el remapeo: las cuatro filas se quedan en `energia`.
 */
import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const cli = loadPureLogicFromFile();

let failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.error(`  ✗ ${name}\n      ${e.message}`); }
}

console.log("suministros-legacy");

const gasto = (over) => Object.assign({
  id: "x", date: "2026-09-10T10:00:00.000Z", amount: 50, merchant: "X", category: "energia", source: "ob",
}, over);

/* ⚠ VA EN `seedFlows`, NO EN `migrate`, y no es un descuido: al cargar, el estado pasa por
   `(saved._dataVer>=6) ? saved : migrate(saved)` (`01-i18n.js:3133`), o sea que **`migrate` NO
   corre para los estados actuales** — solo para los legacy. `seedFlows` corre SIEMPRE. Si alguien
   mueve el remapeo a `migrate` "por orden", deja de aplicarse en su móvil y este test se pone
   rojo, que es justo para lo que está.
   Se le da el estado mínimo que la función pide y se mira solo lo que toca. */
function migrar(expenses) {
  const s = cli.seedFlows({ expenses: expenses, settings: {}, accounts: [], flows: [], goals: [], debts: [], fixed: [], investments: [] });
  return s.expenses;
}

t("una fila vieja de agua acaba en AGUA, no en luz", () => {
  const [e] = migrar([gasto({ merchant: "AIGUES DE BARCELONA", amount: 81.29 })]);
  assert.equal(e.category, "agua");
});

t("una fila vieja de electricidad acaba en LUZ", () => {
  const [e] = migrar([gasto({ merchant: "GC RE OCTOPUS ENERGY", amount: 89.98 })]);
  assert.equal(e.category, "luz");
});

t("una fila vieja de gas acaba en GAS", () => {
  const [e] = migrar([gasto({ merchant: "NEDGIA CATALUNYA" })]);
  assert.equal(e.category, "gas");
});

t("si el comercio no se reconoce, cae en LUZ y NUNCA se queda en «energia»", () => {
  const [e] = migrar([gasto({ merchant: "RECIBO SUMINISTRO 4471" })]);
  assert.notEqual(e.category, "energia", "se ha quedado con un id que ya no existe");
  assert.equal(e.category, "luz");
});

/* Lo manual TAMBIÉN se traduce: aquí no se adivina nada suyo, se retira un id nuestro. */
t("también traduce un apunte MANUAL que tuviera energia", () => {
  const [e] = migrar([gasto({ merchant: "AIGUES DE BARCELONA", source: "manual" })]);
  assert.equal(e.category, "agua");
});

/* Y lo que NO puede pasar: que toque una fila que no era de energia. */
t("no toca las demás categorías", () => {
  const out = migrar([gasto({ merchant: "MERCADONA", category: "super" }), gasto({ merchant: "X", category: "bares" })]);
  assert.equal(out[0].category, "super");
  assert.equal(out[1].category, "bares");
});

if (failed) { console.error(`\n${failed} fallo(s)`); process.exit(1); }
console.log("\nsuministros-legacy: OK");
