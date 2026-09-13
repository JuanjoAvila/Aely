#!/usr/bin/env node
/**
 * EL SAVEBACK DE TRADE REPUBLIC NO ES UN INGRESO (2026-09-13).
 *
 * Su captura del 12/9, comparando el histórico con la app de TR: el histórico le ofrecía
 * «Movimiento · 2026-09-01 · +10,34 € ingreso», y en TR es el Saveback del 2/9, 10,34 € que
 * SALEN hacia el fondo. «Cosa que no es un puto ingreso, es un gasto que se va hacia inversiones».
 *
 * Parecía un signo volteado con un día de menos. No lo era: el payload CRUDO de TR (app_events)
 * trae los DOS apuntes, `10.34 CRDT 2026-09-01` y `10.34 DBIT 2026-09-02`. TR abona el Saveback
 * al efectivo y al día siguiente lo retira para comprar. El histórico ofrecía la mitad que entra.
 *
 * Datos del test = los de su payload, sin nombre ni concepto (así llega TR de verdad). Y DOS
 * bancos: un Revolut de 10,34 € el mismo día no puede emparejarse con la salida de TR.
 */
import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx = loadPureLogicFromFile();

let fallos = 0;
const t = (nombre, fn) => {
  try { fn(); console.log("  ✓ " + nombre); }
  catch (e) { fallos++; console.error("  ✗ " + nombre + "\n      " + (e && e.message)); }
};

const cand = (o) => Object.assign({ id: null, merchant: "Movimiento", note: "", card: false, ent: "trade_republic", kind: "out" }, o);
const estado = (expenses) => ({
  accounts: [{ id: "tr", ent: "trade_republic", name: "TR", role: "diario", spendFrom: true }],
  expenses: expenses || [], fixed: [], debts: [], oneoffs: [], flows: [],
});

console.log("hist-cashback-par");

t("su caso: el abono del Saveback (1/9) NO se ofrece como ingreso; el interés sí", () => {
  const cands = [
    cand({ date: "2026-09-01", amount: 10.34, kind: "in" }),    // abono Saveback
    cand({ date: "2026-09-02", amount: 10.34, kind: "out" }),   // compra del fondo
    cand({ date: "2026-09-01", amount: 13.72, kind: "in" }),    // interés: ingreso de verdad
  ];
  const { rows } = ctx.histClassifyCandidates(cands, estado());
  assert.equal(rows[0].status, "dup", "el abono no se ofrece");
  assert.equal(rows[0].reason, "cashback-par");
  assert.equal(rows[1].status, "new", "la compra sí se ofrece");
  assert.equal(rows[1].category, "inversion", "…pero como inversión (neutra), no como gasto");
  assert.equal(rows[2].status, "new", "el interés se ofrece");
  assert.equal(rows[2].defDest, "ingreso");
});

t("la compra ya está apuntada por el sync: el abono tampoco se ofrece", () => {
  const guardado = { id: "g1", date: "2026-09-02T10:00:00.000Z", amount: 10.34, merchant: "Movimiento", source: "ob:trade_republic", category: "inversion" };
  const cands = [cand({ date: "2026-09-01", amount: 10.34, kind: "in" })];
  const { rows } = ctx.histClassifyCandidates(cands, estado([guardado]));
  assert.equal(rows[0].status, "dup");
  assert.equal(rows[0].reason, "cashback-par");
});

t("dos bancos: un ingreso de Revolut del mismo día e importe NO se empareja con la salida de TR", () => {
  const cands = [
    cand({ date: "2026-09-01", amount: 10.34, kind: "in", ent: "revolut" }),
    cand({ date: "2026-09-02", amount: 10.34, kind: "out" }),
  ];
  const { rows } = ctx.histClassifyCandidates(cands, estado());
  assert.equal(rows[0].status, "new", "el de Revolut es un ingreso");
  assert.notEqual(rows[1].category, "inversion", "y la salida de TR queda como gasto normal");
});

t("una salida empareja UNA entrada: dos abonos iguales y una compra → uno sigue ofreciéndose", () => {
  const cands = [
    cand({ date: "2026-09-01", amount: 10.34, kind: "in" }),
    cand({ date: "2026-09-01", amount: 10.34, kind: "in", note: "otro" }),
    cand({ date: "2026-09-02", amount: 10.34, kind: "out" }),
  ];
  const { rows } = ctx.histClassifyCandidates(cands, estado());
  const dups = rows.filter((r) => r.reason === "cashback-par").length;
  assert.equal(dups, 1);
});

t("con nombre es un cobro de verdad (un bizum de 10,34 €) y se ofrece", () => {
  const cands = [
    cand({ date: "2026-09-01", amount: 10.34, kind: "in", merchant: "Bizum de Ana" }),
    cand({ date: "2026-09-02", amount: 10.34, kind: "out" }),
  ];
  const { rows } = ctx.histClassifyCandidates(cands, estado());
  assert.equal(rows[0].status, "new");
});

t("la salida ANTES que la entrada, o a más de 10 días, no es el par", () => {
  const antes = ctx.histClassifyCandidates([
    cand({ date: "2026-09-03", amount: 10.34, kind: "in" }),
    cand({ date: "2026-09-02", amount: 10.34, kind: "out" }),
  ], estado()).rows;
  assert.equal(antes[0].status, "new");
  const lejos = ctx.histClassifyCandidates([
    cand({ date: "2026-08-01", amount: 10.34, kind: "in" }),
    cand({ date: "2026-08-15", amount: 10.34, kind: "out" }),
  ], estado()).rows;
  assert.equal(lejos[0].status, "new");
});

t("el sync diario sigue emparejando igual (findCashbackTwin usa la misma regla)", () => {
  const exps = [
    { id: "in", date: "2026-08-01T09:00:00.000Z", amount: -8.38, merchant: "Movimiento", ent: "trade_republic" },
    { id: "out", date: "2026-08-03T09:00:00.000Z", amount: 8.38, merchant: "Movimiento", ent: "trade_republic" },
  ];
  assert.equal(ctx.findCashbackTwin(exps, exps[1]), 0);
  assert.equal(ctx.findCashbackTwin(exps, Object.assign({}, exps[1], { ent: "revolut" })), -1);
});

if (fallos) { console.error(`hist-cashback-par: ${fallos} fallo(s)`); process.exit(1); }
console.log("hist-cashback-par: OK");
