import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx = loadPureLogicFromFile();
const day = (delta) => new Date(Date.now() + delta * 86400000).toISOString().slice(0, 10);
// El suelo llega como en la respuesta del sync: un `syncFrom` por enlace.
const links = [{ aspsp: "CaixaBank", syncFrom: day(-60) }, { aspsp: "Banco de Sabadell", syncFrom: day(-60) }];
const main = fs.readFileSync(new URL("../src/modules/11-app-main.js", import.meta.url), "utf8");
const core = fs.readFileSync(new URL("../src/modules/00-core.js", import.meta.url), "utf8");

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
  const add = ctx.importObExpenses(cartera(seeded), lote, links) || [];
  const names = add.map((e) => e.ent + "|" + e.merchant).sort();
  // Farmacia Norte ya está modelada como fijo: el tramo antiguo no la duplica como gasto.
  assert.equal(JSON.stringify(names), JSON.stringify(["sabadell|Mercadona", "sabadell|Panadería Sol"]));
  assert.equal(add.find((e) => e.merchant === "Farmacia Norte"), undefined);
  const pan = add.find((e) => e.merchant === "Panadería Sol");
  assert.equal(pan.date.slice(0, 10), viejo);
  assert.equal(pan.source, "ob");
  assert.equal(pan.extId, "sb-nueva");
  const otra = ctx.importObExpenses(cartera(seeded.concat(add)), lote, links);
  assert.equal(otra, null);
});

t("el suelo es por banco: el de uno no abre el tramo de otro y con dos enlaces gana el más antiguo", () => {
  const viejo = day(-40);
  const lote = [tx("caixabank", viejo, 8, "Librería", "cx-lib"), tx("sabadell", viejo, 9, "Quiosco", "sb-q")];
  const soloCaixa = ctx.importObExpenses(cartera([]), lote, [{ aspsp: "CaixaBank", syncFrom: day(-60) }, { aspsp: "Banco de Sabadell" }]) || [];
  assert.equal(JSON.stringify(soloCaixa.map((e) => e.merchant)), JSON.stringify(["Librería"]));
  const corto = ctx.importObExpenses(cartera([]), lote, [{ aspsp: "CaixaBank", syncFrom: day(-20) }]);
  assert.equal(corto, null, "lo anterior al suelo no entra");
  const dos = ctx.importObExpenses(cartera([]), lote, [{ aspsp: "CaixaBank", syncFrom: day(-20) }, { aspsp: "CaixaBank", syncFrom: day(-60) }]) || [];
  assert.equal(dos.length, 1);
});

t("el suelo colgado en el estado no entra: hace falta pasarlo", () => {
  const s = cartera([]);
  s._obSyncFrom = { caixabank: day(-60) };
  const add = ctx.importObExpenses(s, [tx("caixabank", day(-40), 8, "Librería", "cx-lib")]);
  assert.equal(add, null);
});

t("llamado dos veces con lo mismo devuelve lo mismo: no hay suelo que se gaste", () => {
  const lote = [tx("caixabank", day(-40), 8, "Librería", "cx-lib")];
  const una = ctx.importObExpenses(cartera([]), lote, links) || [];
  const otra = ctx.importObExpenses(cartera([]), lote, links) || [];
  assert.equal(una.length, 1);
  assert.equal(otra.length, 1);
  assert.equal(otra[0].extId, "cx-lib");
});

t("cliente nuevo con función vieja: sin syncFrom no entra lo anterior al margen ni se duplica lo de dentro", () => {
  const dentro = day(-2), fuera = day(-45);
  const viejos = [{ aspsp: "CaixaBank" }, { aspsp: "Banco de Sabadell" }];
  const primero = ctx.importObExpenses(cartera([]), [
    tx("caixabank", dentro, 11, "Dentro", "cx-in"),
    tx("caixabank", fuera, 12, "Fuera", "cx-out"),
    tx("sabadell", dentro, 11, "Dentro", "sb-in"),
  ], viejos) || [];
  assert.equal(JSON.stringify(primero.map((e) => e.ent + "|" + e.merchant).sort()), JSON.stringify(["caixabank|Dentro", "sabadell|Dentro"]));
  assert.equal(ctx.importObExpenses(cartera(primero), [
    tx("caixabank", dentro, 11, "Dentro", "cx-in"),
    tx("sabadell", dentro, 11, "Dentro", "sb-in"),
  ], viejos), null);
});

// El llamador de verdad: se ejecutan las dos sentencias de runBankSync tal como están
// escritas. Si deja de pasar la respuesta al importador, el tramo se tira y esto lo ve.
t("runBankSync pasa el suelo de la respuesta al importador", () => {
  const m = main.match(/const txs=flattenBankTx\(links\);[\s\S]*?const add=importObExpenses\([^;]*\);/);
  assert.ok(m, "no se encuentra la llamada en runBankSync");
  const run = new Function("flattenBankTx", "importObExpenses", "prev", "links", m[0] + " return add;");
  const viejo = day(-40);
  const respuesta = [{
    aspsp: "CaixaBank", ok: true, syncFrom: day(-60),
    accounts: [{ uid: "cx", ok: true, transactions: [{ ext_id: "cx-lib", date: viejo, amount: 8, merchant: "Librería", status: "BOOK", card: true }] }],
  }];
  const add = run(ctx.flattenBankTx, ctx.importObExpenses, cartera([]), respuesta) || [];
  assert.equal(add.length, 1);
  assert.equal(add[0].date.slice(0, 10), viejo);
});

t("el cliente pide recoverGaps por el cliente de siempre, sin dateFrom y sin adivinar quién pulsó", () => {
  assert.match(core, /async bankSync\(body\)\{[\s\S]{0,120}invoke\('bank-sync',\{ body \}\)/);
  assert.match(main, /cloud\.bankSync\(\{recoverGaps:true\}\)/);
  assert.doesNotMatch(main, /bankSync\(\{[^)]*dateFrom/);
  assert.equal((core.match(/createClient\(/g) || []).length, 1, "un solo cliente de Supabase");
  assert.doesNotMatch(core, /addEventListener\("click"[\s\S]{0,400}sincronizar bancos/);
  for (const src of [core, main, fs.readFileSync(new URL("../src/modules/08-motor-bank.js", import.meta.url), "utf8")]) {
    assert.doesNotMatch(src, /obGap(Manual|Floors|Summary|Client)|importObCore|reconcileBankCore|listaAvisosCore/);
  }
});

if (failures) process.exitCode = 1;
