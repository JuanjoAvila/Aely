#!/usr/bin/env node
/** Trade Republic conectado A LA VEZ por su puente nativo y por Open Banking (2026-08-01).
 *
 *  POR QUÉ EXISTE. El 31/7, tras el susto de «todos los gastos del mes contados como ingresos»,
 *  se BLOQUEÓ la conexión de TR por Open Banking. Bloquear no era arreglar: la causa real era un
 *  `Math.abs()` que faltaba en `mapTransaction`, y el bloqueo le quitaba de paso algo que quería
 *  —las compras con la tarjeta de TR entrando solas en Gastos—. Sus palabras: «en vez de mirar qué
 *  hacer, porque quizás pueden convivir ambas integraciones... no me dio opción».
 *
 *  CONVIVEN CON UN REPARTO, y esto es lo que lo blinda:
 *    · el SALDO y las posiciones son del puente nativo (`06-sync-brokers.js`);
 *    · Open Banking aporta los MOVIMIENTOS.
 *  Si alguien vuelve a dejar que Open Banking re-ancle la cuenta de TR, las dos fuentes escriben
 *  el mismo `value` con fórmulas distintas y el saldo baila según cuál sincronice la última —que
 *  es exactamente el fallo que este fichero existe para que no vuelva.
 */
import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx = loadPureLogicFromFile();

function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}`); throw e; }
}

console.log("tr-open-banking");

// Estado mínimo: cuenta TR de gasto diario, con el puente nativo encendido y su saldo ya puesto.
const estadoTR = (extra = {}) => ({
  accounts: [{ id: "tr1", ent: "trade_republic", role: "diario", spendFrom: true, value: 1000 }],
  investments: [{ id: "i1", ent: "trade_republic", name: "VWCE", shares: 10, value: 1000, cost: 900, cur: "EUR" }],
  expenses: [], fixed: [], flows: [], obAccounts: [],
  settings: { brokersOn: ["trade_republic"] },
  ...extra,
});
// Lo que devolvería Enable Banking para TR: una cuenta con saldo distinto al del puente.
const linkTR = [{ aspsp: "Trade Republic", ok: true, accounts: [
  { uid: "tr-ob-1", iban: "DE00", balances: [{ type: "ITAV", amount: 4321.99 }] },
] }];

t("el puente nativo manda: Open Banking NO re-ancla el saldo de la cuenta TR", () => {
  const s = estadoTR();
  const r = ctx.applyBankBalances(s, linkTR);
  const tr = r.state.accounts.find((a) => a.ent === "trade_republic");
  assert.equal(tr.value, 1000, "el saldo lo pone el puente (availableCash), no Open Banking");
  assert.equal(r.changed, false, "y por tanto no hay nada que guardar");
});

t("tampoco se cuela como cuenta EXTRA (sería doble conteo en Patrimonio)", () => {
  const s = estadoTR();
  const r = ctx.applyBankBalances(s, linkTR);
  // `.length` y no `deepEqual`: la lógica corre en un `vm`, así que sus arrays llevan otro
  // Array.prototype y `deepStrictEqual` los da por distintos aunque estén los dos vacíos.
  assert.equal(r.obAccounts.length, 0, "TR ya suma por su cuenta manual: repetirla infla el patrimonio");
  assert.equal(r.synced.some((x) => x.ent === "trade_republic"), false);
});

t("con el puente APAGADO, TR por Open Banking se comporta como un banco normal", () => {
  // Quien no use el bróker nativo (nadie hoy, pero el reparto no puede dejarle sin saldo).
  const s = estadoTR({ settings: { brokersOn: [] }, investments: [] });
  const r = ctx.applyBankBalances(s, linkTR);
  const tr = r.state.accounts.find((a) => a.ent === "trade_republic");
  assert.equal(tr.value !== 1000, true, "sin puente, el saldo del banco sí re-ancla");
});

t("sin `brokersOn` guardado, tener posiciones de TR ya cuenta como puente encendido", () => {
  const s = estadoTR({ settings: {} });   // misma regla que la pantalla de bancos
  const r = ctx.applyBankBalances(s, linkTR);
  const tr = r.state.accounts.find((a) => a.ent === "trade_republic");
  assert.equal(tr.value, 1000);
});

t("los OTROS bancos siguen re-anclando igual (el reparto es SOLO de TR)", () => {
  const s = {
    accounts: [{ id: "s1", ent: "sabadell", role: "fijos", value: 100 }],
    investments: [], expenses: [], fixed: [], flows: [], obAccounts: [], settings: { brokersOn: ["trade_republic"] },
  };
  const r = ctx.applyBankBalances(s, [{ aspsp: "Sabadell", ok: true, accounts: [
    { uid: "sa1", iban: "ES00", balances: [{ type: "ITAV", amount: 2500 }] },
  ] }]);
  const sa = r.state.accounts.find((a) => a.ent === "sabadell");
  assert.equal(sa.value !== 100, true, "Sabadell sí re-ancla con su saldo real");
});

t("y los MOVIMIENTOS de TR sí entran en Gastos (que es lo que se gana con esto)", () => {
  const s = estadoTR();
  const hoy = new Date().toISOString().slice(0, 10);
  const add = ctx.importObExpenses(s, [
    { id: "x1", ent: "trade_republic", date: hoy, amount: 12.5, card: true, merchant: "Mercadona" },
  ]);
  assert.equal(Array.isArray(add) && add.length, 1, "una compra con la tarjeta de TR se apunta sola");
  assert.equal(add[0].ent, "trade_republic");
  assert.equal(add[0].amount, 12.5, "positivo = gasto (si sale negativo, ha vuelto el fallo del signo)");
});

t("y no se duplican: el mismo ext_id no entra dos veces", () => {
  const hoy = new Date().toISOString().slice(0, 10);
  const s = estadoTR({ expenses: [{ id: "e1", extId: "x1", date: hoy + "T12:00:00.000Z", amount: 12.5, merchant: "Mercadona", ent: "trade_republic", source: "ob" }] });
  const add = ctx.importObExpenses(s, [
    { id: "x1", ent: "trade_republic", date: hoy, amount: 12.5, card: true, merchant: "Mercadona" },
  ]);
  assert.equal(add, null, "ya estaba importado por su ext_id");
});

t("flattenBankTx incluye todas las cuentas, no solo la primaria", () => {
  const links = [{ aspsp: "Revolut", transactions: [{ ext_id: "top", date: "2026-09-07", amount: 1, merchant: "primaria" }], accounts: [
    { transactions: [{ ext_id: "a", date: "2026-09-07", amount: 1, merchant: "primaria" }] },
    { transactions: [{ ext_id: "b", date: "2026-09-07", amount: 23, merchant: "ChatGPT" }] },
  ] }];
  const txs = ctx.flattenBankTx(links);
  assert.equal(txs.some((x) => x.id === "b"), true, "el movimiento nuevo de la segunda cuenta llega a Gastos");
  assert.equal(txs.some((x) => x.id === "top"), false, "el top-level es copia retrocompatible de la primera cuenta");
});

console.log("tr-open-banking: OK");
