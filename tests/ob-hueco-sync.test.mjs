import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx = loadPureLogicFromFile();
const day = (delta) => new Date(Date.now() + delta * 86400000).toISOString().slice(0, 10);
const floors = { caixabank: day(-60), sabadell: day(-60) };

function cartera(expenses) {
  return {
    accounts: [
      { id: "cx", ent: "caixabank", role: "diario", value: 400 },
      { id: "sb", ent: "sabadell", role: "extra", value: 200 },
    ],
    settings: { expenseBanks: ["caixabank", "sabadell"] },
    fixed: [{ id: "f1", name: "Farmacia Norte", amount: 14.2, account: "caixabank", freq: "mes", day: 3 }],
    debts: [], oneoffs: [], flows: [], deleted: [],
    expenses: expenses || [],
  };
}
function tx(ent, date, amount, merchant, id) {
  return { ent, id: id || null, date, amount, merchant, note: "", card: true, status: "BOOK" };
}

let failures = 0;
function t(name, fn) {
  try { fn(); console.log("  ✓ " + name); }
  catch (e) { failures++; console.error("  ✗ " + name + ": " + e.message); }
}

console.log("ob-hueco-sync");

t("dos bancos: el hueco entra con su fecha y no duplica noti, mano ni histórico", () => {
  const viejo = day(-40);
  const seeded = [
    { id: "noti", date: viejo + "T12:00:00.000Z", amount: 22.15, merchant: "Mercadona", category: "super", source: "wallet", ent: "caixabank" },
    { id: "hist", date: viejo + "T12:00:00.000Z", amount: 9.9, merchant: "Seguro ya", category: "otros", source: "ob-hist", ent: "caixabank", extId: "cx-hist" },
    { id: "mano", date: viejo + "T12:00:00.000Z", amount: 6.5, merchant: "Bar Paco", category: "bares", source: "manual", ent: "sabadell" },
  ];
  const lote = [
    tx("caixabank", viejo, 14.2, "Farmacia Norte", "cx-nueva"),
    tx("caixabank", viejo, 22.15, "Mercadona", "cx-noti"),
    tx("caixabank", viejo, 9.9, "Seguro ya", "cx-hist"),
    tx("caixabank", day(-80), 5, "Demasiado viejo", "cx-fuera"),
    tx("sabadell", viejo, 6.5, "Bar Paco", "sb-mano"),
    tx("sabadell", viejo, 3.4, "Panadería Sol", "sb-nueva"),
    tx("sabadell", viejo, 22.15, "Mercadona", "sb-mismo-importe"),
  ];
  const add = ctx.importObExpenses(cartera(seeded), lote, { syncFromByEnt: floors }) || [];
  const names = add.map((e) => e.ent + "|" + e.merchant).sort();
  // Farmacia Norte ya está modelada como fijo: el tramo antiguo no la duplica como gasto.
  assert.equal(JSON.stringify(names), JSON.stringify(["sabadell|Mercadona", "sabadell|Panadería Sol"]));
  assert.equal(add.find((e) => e.merchant === "Farmacia Norte"), undefined);
  const pan = add.find((e) => e.merchant === "Panadería Sol");
  assert.equal(pan.date.slice(0, 10), viejo);
  assert.equal(pan.source, "ob");
  assert.equal(pan.extId, "sb-nueva");
  const otra = ctx.importObExpenses(cartera(seeded.concat(add)), lote, { syncFromByEnt: floors });
  assert.equal(otra, null);
});

t("el suelo colgado en el estado no entra: hace falta pasarlo", () => {
  const s = cartera([]);
  s._obSyncFrom = floors;
  const add = ctx.importObExpenses(s, [tx("caixabank", day(-40), 8, "Librería", "cx-lib")]);
  assert.equal(add, null);
  assert.deepEqual(s._obSyncFrom, floors);
});

t("cliente nuevo con función vieja: sin syncFrom no entra lo anterior al margen ni se duplica lo de dentro", () => {
  const dentro = day(-2), fuera = day(-45);
  const primero = ctx.importObExpenses(cartera([]), [
    tx("caixabank", dentro, 11, "Dentro", "cx-in"),
    tx("caixabank", fuera, 12, "Fuera", "cx-out"),
    tx("sabadell", dentro, 11, "Dentro", "sb-in"),
  ]) || [];
  assert.equal(JSON.stringify(primero.map((e) => e.ent + "|" + e.merchant).sort()), JSON.stringify(["caixabank|Dentro", "sabadell|Dentro"]));
  assert.equal(ctx.importObExpenses(cartera(primero), [
    tx("caixabank", dentro, 11, "Dentro", "cx-in"),
    tx("sabadell", dentro, 11, "Dentro", "sb-in"),
  ]), null);
});

t("función nueva con cliente viejo: el suelo no se aplica si nadie lo pasó", () => {
  const s = cartera([]);
  const add = ctx.importObExpenses(s, [tx("caixabank", day(-45), 4, "Viejo", "cx-old")]);
  assert.equal(s._obSyncFrom, undefined);
  assert.equal(add, null);
});

t("el llamador pide recoverGaps y no dateFrom", () => {
  const main = fs.readFileSync(new URL("../src/modules/11-app-main.js", import.meta.url), "utf8");
  const core = fs.readFileSync(new URL("../src/modules/00-core.js", import.meta.url), "utf8");
  assert.match(core, /\{recoverGaps:true\}/);
  assert.match(main, /cloud\.bankSync\(\)/);
  assert.doesNotMatch(main, /bankSync\(\{[^)]*dateFrom/);
  assert.doesNotMatch(core, /invoke\('bank-sync',\{body:\{[^}]*dateFrom/);
});

t("un hueco por encima de 90 días nombra el banco y solo ese", () => {
  const parts = ctx.obGapParts([
    { aspsp: "CaixaBank", gapBeyondCap: true, syncFrom: "2026-07-12" },
    { aspsp: "Banco de Sabadell", gapBeyondCap: false, syncFrom: "2026-09-01" },
    { aspsp: "CaixaBank", gapBeyondCap: true },
  ]);
  assert.equal(JSON.stringify(parts.names), JSON.stringify(["CaixaBank"]));
  assert.equal(ctx.obGapParts([
    { aspsp: "CaixaBank", syncFrom: "2026-07-12" },
    { aspsp: "Banco de Sabadell", syncFrom: "2026-09-01" },
  ]).floors.sabadell, "2026-09-01");
});

if (failures) process.exitCode = 1;
