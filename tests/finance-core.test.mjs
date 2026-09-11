#!/usr/bin/env node
/**
 * Tests de lógica financiera crítica (round-up, saveback, dedup, metas…).
 * Carga funciones desde el monolito sin partirlo.
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

console.log("finance-core");

t("spareOf: redondeo al euro superior", () => {
  assert.equal(ctx.spareOf(2.0), 1);
  assert.equal(ctx.spareOf(5.95), 0.05);
  assert.equal(ctx.spareOf(0.01), 0.99);
});

t("isCardSpend: excluye bizum y negativos", () => {
  assert.equal(ctx.isCardSpend({ amount: 10 }), true);
  assert.equal(ctx.isCardSpend({ amount: 10, noCard: true }), false);
  assert.equal(ctx.isCardSpend({ amount: -5 }), false);
});

t("roundupOf: solo tarjeta × multiplicador", () => {
  const ex = [
    { amount: 2.0 },
    { amount: 5.95 },
    { amount: 10, noCard: true },
  ];
  assert.equal(ctx.roundupOf(ex, 1), 1.05);
  assert.equal(ctx.roundupOf(ex, 2), 2.1);
  assert.equal(ctx.roundupOf(ex, 0), 0);
});

t("savebackOf: 1% tope 15€", () => {
  assert.equal(ctx.savebackOf([{ amount: 100 }]), 1);
  assert.equal(ctx.savebackOf([{ amount: 2000 }]), 15);
  assert.equal(ctx.savebackOf([{ amount: 50, noCard: true }]), 0);
});

t("mergeExpenses: dedup por fecha|importe|comercio", () => {
  const prev = [{ date: "2026-01-01", amount: 5, merchant: "Mercadona" }];
  const incoming = [
    { date: "2026-01-01", amount: 5, merchant: "Mercadona" },
    { date: "2026-01-02", amount: 3, merchant: "Bar" },
  ];
  const { list, nuevos } = ctx.mergeExpenses(prev, incoming);
  assert.equal(list.length, 2);
  assert.equal(nuevos, 1);
});

t("goalPct / goalRemaining", () => {
  assert.equal(ctx.goalPct({ target: 1000, saved: 500 }), 50);
  assert.equal(ctx.goalRemaining({ target: 1000, saved: 750 }), 250);
});

/* ⚠ EL RASTRO DEL SALDO (11/9). Su padre: «Revolut no tiene ese dinero y le cambia el valor
   constantemente sin tocar la cuenta». No es el −204,54 € de agosto (aquello ya está arreglado):
   aquí la cifra BAILA entre sincronizaciones, y no se podía ni empezar a mirar porque no se
   guardaba QUÉ saldo de los que manda el banco habíamos usado.
   Esto no arregla el baile —no sé aún por qué pasa— pero sin el rastro no hay forma de saberlo:
   si el tipo cambia entre sincronizaciones, ahí está la causa; si no cambia, el problema lo tiene
   el banco y hay que ir por otro lado. Un test que solo mire el NÚMERO deja el rastro sin vigilar,
   y entonces cualquiera lo quita sin enterarse. */
t("★ el saldo deja dicho CUÁL se eligió y cuáles ofrecía el banco", () => {
  const inf = ctx.pickBankBalanceInfo([
    { type: "CLBD", amount: 100 },
    { type: "ITAV", amount: 42.5 },
  ]);
  assert.equal(inf.valor, 42.5);
  assert.equal(inf.tipo, "ITAV", "hay que poder saber que se usó el disponible y no el contable");
  assert.deepEqual(inf.tipos, ["CLBD", "ITAV"], "y qué había para elegir");
});

t("el rastro también cuenta cuando el negativo se descarta", () => {
  // El caso del padre en agosto: ITAV negativo, CLBD positivo al lado.
  const inf = ctx.pickBankBalanceInfo([
    { type: "ITAV", amount: -204.54 },
    { type: "CLBD", amount: 22.06 },
  ]);
  assert.equal(inf.valor, 22.06);
  assert.ok(/CLBD/.test(inf.tipo), "el rastro tiene que decir que se acabó usando el contable");
  assert.deepEqual(inf.tipos, ["ITAV", "CLBD"]);
});

t("sin saldos utilizables, el rastro no inventa un tipo", () => {
  const inf = ctx.pickBankBalanceInfo([{ type: "ITAV", amount: -5 }]);
  assert.equal(inf.valor, null, "solo basura negativa → se conserva el saldo de antes");
  assert.equal(inf.tipo, null);
});


t("pickBankBalance: prefiere ITAV sobre CLBD", () => {
  const bal = ctx.pickBankBalance([
    { type: "CLBD", amount: 100 },
    { type: "ITAV", amount: 87.5 },
  ]);
  assert.equal(bal, 87.5);
});

t("pickBankBalance: ITAV negativo no pisa un CLBD positivo (Revolut −204 del padre)", () => {
  assert.equal(ctx.pickBankBalance([
    { type: "ITAV", amount: -204.54 },
    { type: "CLBD", amount: 22.06 },
  ]), 22.06);
});

t("pickBankBalance: tipo desconocido en [0] no inventa un negativo", () => {
  assert.equal(ctx.pickBankBalance([
    { type: "FOO", amount: -204.54 },
    { type: "CLBD", amount: 22.06 },
  ]), 22.06);
});

t("pickBankBalance: solo basura negativa → null (se queda el saldo de antes)", () => {
  assert.equal(ctx.pickBankBalance([{ type: "ITAV", amount: -204.54 }]), null);
  assert.equal(ctx.pickBankBalance([{ type: "ZZZ", amount: -1 }]), null);
});

t("entFromAspsp: mapea Sabadell", () => {
  assert.equal(ctx.entFromAspsp("Banco de Sabadell"), "sabadell");
});

console.log("\nfinance-core: OK");
