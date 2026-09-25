#!/usr/bin/env node
/** Filtro por banco: source en nube (ob:ent / macrodroid) ↔ ent local. */
import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx = loadPureLogicFromFile();

function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}`); throw e; }
}

console.log("expense-bank");

t("expenseSourceForCloud: embebe ent en ob", () => {
  assert.equal(ctx.expenseSourceForCloud({ source: "ob", ent: "caixabank" }), "ob:caixabank");
  assert.equal(ctx.expenseSourceForCloud({ source: "ob-hist", ent: "sabadell" }), "ob-hist:sabadell");
  assert.equal(ctx.expenseSourceForCloud({ source: "ob-hist", ent: "caixabank", possibleDup:true }), "ob-hist:caixabank#dup");
  assert.equal(ctx.expenseSourceForCloud({ source: "macrodroid" }), "macrodroid");
  assert.equal(ctx.expenseSourceForCloud({ source: "manual" }), "manual");
});

t("possibleDup del histórico vuelve marcado desde la nube", () => {
  const e=ctx.expenseFromRow({id:"x",fecha:"2026-08-01",importe:12,comercio:"Compra",cat:"otros",source:"ob-hist:caixabank#dup"});
  assert.equal(e.ent,"caixabank");
  assert.equal(e.source,"ob-hist");
  assert.equal(e.possibleDup,true);
});

t("expenseBankOf: lee ent o source", () => {
  assert.equal(ctx.expenseBankOf({ ent: "bbva", source: "ob" }), "bbva");
  assert.equal(ctx.expenseBankOf({ source: "ob:caixabank" }), "caixabank");
  assert.equal(ctx.expenseBankOf({ source: "macrodroid" }), "trade_republic");
  assert.equal(ctx.expenseBankOf({ source: "manual" }), null);
});

t("expenseBankEnts: sin settings, usa el banco de la cuenta diaria", () => {
  const s = { accounts: [{ id: "a1", ent: "sabadell", role: "diario" }], settings: {} };
  const out = ctx.expenseBankEnts(s);
  assert.equal(out.length, 1);
  assert.equal(out[0], "sabadell");
});

t("expenseBankEnts: la cuenta diaria SIEMPRE entra, aunque expenseBanks tenga otro banco guardado de antes (2026-07-31)", () => {
  // Repro del bug real: expenseBanks se quedó apuntando a "caixabank" de una configuración
  // vieja, y el usuario cambió su cuenta de gasto diario a "revolut" (Patrimonio → rol «Gasto
  // diario»). Antes del fix, expenseBankEnts devolvía SOLO ["caixabank"] para siempre: las
  // compras de Revolut, el banco de gasto diario de VERDAD, nunca entraban en Gastos.
  const s = {
    accounts: [{ id: "a1", ent: "revolut", role: "diario" }],
    settings: { expenseBanks: ["caixabank"] },
  };
  const out = ctx.expenseBankEnts(s);
  assert.ok(out.indexOf("revolut") >= 0, "la cuenta diaria tiene que estar SIEMPRE");
  assert.ok(out.indexOf("caixabank") >= 0, "no se pierde el banco extra ya guardado");
  assert.equal(out.length, 2);
});

t("expenseBankEnts: sin duplicar si el banco diario ya está en expenseBanks", () => {
  const s = {
    accounts: [{ id: "a1", ent: "sabadell", role: "diario" }],
    settings: { expenseBanks: ["sabadell", "caixabank"] },
  };
  const out = ctx.expenseBankEnts(s);
  assert.equal(out.length, 2);
  assert.equal(out[0], "sabadell");
  assert.equal(out[1], "caixabank");
});

t("expenseBankEnts: Revolut + TR marcados salen los dos (el filtro de Gastos arranca con esta lista)", () => {
  const s = {
    accounts: [
      { id: "tr", ent: "trade_republic", role: "diario", spendFrom: true },
      { id: "rv", ent: "revolut", role: "fijos" },
    ],
    settings: { expenseBanks: ["trade_republic", "revolut"] },
  };
  const out = ctx.expenseBankEnts(s);
  assert.ok(out.indexOf("trade_republic") >= 0);
  assert.ok(out.indexOf("revolut") >= 0);
});

t("expenseFromRow: recupera banco tras pull", () => {
  const tr = ctx.expenseFromRow({ id: "1", fecha: "2026-07-01T12:00:00.000Z", importe: 12, comercio: "X", cat: "otros", source: "macrodroid" });
  assert.equal(tr.ent, "trade_republic");
  assert.equal(tr.source, "macrodroid");
  const ob = ctx.expenseFromRow({ id: "2", fecha: "2026-07-01T12:00:00.000Z", importe: 5, comercio: "Y", cat: "super", source: "ob:sabadell" });
  assert.equal(ob.ent, "sabadell");
  assert.equal(ob.source, "ob");
});

console.log("\nexpense-bank: OK");
