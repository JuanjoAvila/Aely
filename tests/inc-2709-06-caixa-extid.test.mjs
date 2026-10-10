#!/usr/bin/env node
/**
 * INC-2709-06. Dos cargos CaixaBank con entry_reference distinta, mismo día, importe y
 * comercio, se fundían en uno. Medido en la base `3048399c` (producto = main `8bb0398f`):
 * flatten 2 → import 1, e histórico 2 → 1 con skippedUniq 1.
 *
 * El PR 128 (`788fa1f`) acertó el colapso y la sal de `histDate`, y falló el resto: la clave
 * miraba el texto UTC «12:00:00» (en Madrid el mediodía local no es esa hora), el pull no
 * devolvía el extId y el resync duplicaba, y la lápida de día escondía al hermano.
 * Este fichero corre en UTC y en Europe/Madrid. No usa extractos ni cuentas reales.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadPureLogic, loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const mutarSello = process.argv.includes("--mutation=mismo-sello");

if (!process.argv.includes("--zone-child")) {
  for (const zone of ["UTC", "Europe/Madrid"]) {
    const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--zone-child"], {
      env: { ...process.env, TZ: zone },
      stdio: "inherit",
    });
    if (r.status !== 0) process.exit(r.status || 1);
  }
  // El mutante devuelve el mediodía a todos los entry_reference. Si el arreglo sigue
  // vivo, los dos cargos no se funden y este proceso no puede acabar en 0.
  const mutant = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--zone-child", "--mutation=mismo-sello"], {
    env: { ...process.env, TZ: "UTC" },
    stdio: "inherit",
  });
  if (mutant.status !== 2) {
    console.error("mutante mismo-sello no murió (status " + mutant.status + ")");
    process.exit(1);
  }
  console.log("✓ mutante mismo-sello: los dos cargos vuelven a fundirse");
  process.exit(0);
}

let ctx;
if (mutarSello) {
  const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const needle = "function obPickExtStamp(day, bank, extId, occupied){";
  assert.equal(html.split(needle).length, 2, "el sello por entry_reference está una sola vez en el bundle");
  ctx = loadPureLogic(html.replace(needle, needle + "\n  return histDate(day);"));
} else {
  ctx = loadPureLogicFromFile();
}
const zona = process.env.TZ || "UTC";
let fallos = 0;
const t = (nombre, fn) => {
  try { fn(); console.log("  ✓ " + nombre); }
  catch (e) { fallos++; console.error("  ✗ " + nombre + "\n      " + (e && e.message)); }
};

const ymd = new Date().toISOString().slice(0, 10);
const estado = (expenses, deleted) => ({
  accounts: [{ id: "a", ent: "caixabank", role: "diario", spendFrom: true, value: 100 }],
  expenses: expenses || [],
  deleted: deleted || [],
  fixed: [], debts: [], oneoffs: [],
  settings: { expenseBanks: ["caixabank"] },
});
const cargo = (id, extra) => Object.assign({
  ent: "caixabank", id, date: ymd, amount: 12.5, merchant: "MERCADONA", status: "BOOK", acctUid: "cx-unica",
}, extra || {});
const par = [
  cargo("cargo-B", { acctUid: "cx-b" }),
  cargo("cargo-A", { acctUid: "cx-a" }),
];

console.log("inc-2709-06-caixa-extid (" + zona + ")");

t("aplanar conserva las dos referencias y el uid opaco de cada cuenta", () => {
  const flat = ctx.flattenBankTx([{ aspsp: "CaixaBank", accounts: [
    { uid: "cx-b", transactions: [{ ext_id: "cargo-B", date: ymd, amount: 12.5, merchant: "MERCADONA", status: "BOOK" }] },
    { uid: "cx-a", transactions: [{ ext_id: "cargo-A", date: ymd, amount: 12.5, merchant: "MERCADONA", status: "BOOK" }] },
  ] }]);
  assert.equal(flat.length, 2);
  assert.equal(Array.from(flat.map((x) => x.id)).sort().join(","), "cargo-A,cargo-B");
  assert.equal(Array.from(flat.map((x) => x.acctUid)).sort().join(","), "cx-a,cx-b");
});

t("sync diario: los dos BOOK entran, cada uno con su sello y ninguno en el mediodía", () => {
  const add = ctx.importObExpenses(estado(), par);
  assert.ok(add && add.length === 2, "tienen que entrar los dos");
  assert.equal(new Set(add.map((e) => ctx.keyOfExpense(e))).size, 2);
  const a = add.find((e) => e.extId === "cargo-A");
  const b = add.find((e) => e.extId === "cargo-B");
  // El mediodía no se reparte: dos clientes con una sola referencia se lo quedarían los dos.
  assert.equal(a.date, ctx.histDate(ymd, "ob-ext|caixabank|cargo-A"));
  assert.equal(b.date, ctx.histDate(ymd, "ob-ext|caixabank|cargo-B"));
  assert.notEqual(a.date, ctx.histDate(ymd));
  assert.notEqual(b.date, ctx.histDate(ymd));
  assert.equal(a.date.slice(0, 10), ymd);
  assert.equal(b.date.slice(0, 10), ymd);
  assert.equal(a.acctUid, "cx-a");
  assert.notEqual(a.date, b.date);
});

t("el histórico sella igual que el sync diario, aunque el id mayor llegue antes", () => {
  const diario = ctx.importObExpenses(estado(), par);
  const hist = ctx.histFlattenHistoryLinks({ links: [{ aspsp: "CaixaBank", accounts: [{ uid: "cx-unica", transactions: [
    { ext_id: "cargo-B", date: ymd, amount: 12.5, merchant: "MERCADONA", status: "BOOK" },
    { ext_id: "cargo-A", date: ymd, amount: 12.5, merchant: "MERCADONA", status: "BOOK" },
  ] }] }] }, [], {});
  assert.equal(hist.out.length, 2);
  assert.equal(hist.stats.skippedUniq, 0);
  const ha = hist.out.find((x) => x.id === "cargo-A");
  const hb = hist.out.find((x) => x.id === "cargo-B");
  assert.equal(ha.stamp, diario.find((e) => e.extId === "cargo-A").date);
  assert.equal(hb.stamp, diario.find((e) => e.extId === "cargo-B").date);
});

t("Trade Republic sin ext_id sigue siendo un solo cargo", () => {
  const tx = { ent: "trade_republic", id: null, date: ymd, amount: 9.9, merchant: "Movimiento", status: "BOOK" };
  const add = ctx.importObExpenses(estado(), [tx, Object.assign({}, tx)]);
  assert.ok(add && add.length === 1);
});

t("la hora no entra en la clave de un macrodroid", () => {
  const a = { source: "macrodroid", date: ymd + "T08:00:00.000Z", amount: 10, merchant: "Movimiento" };
  const b = { source: "macrodroid", date: ymd + "T18:11:00.000Z", amount: 10, merchant: "Movimiento" };
  assert.equal(ctx.keyOfExpense(a), ctx.keyOfExpense(b));
});

t("pendiente sin id y contabilizado con id, misma cuenta: solo el BOOK", () => {
  const add = ctx.importObExpenses(estado(), [
    cargo(null, { id: null, status: "PDNG" }),
    cargo("cargo-book", { status: "BOOK" }),
  ]);
  assert.ok(add && add.length === 1);
  assert.equal(add[0].extId, "cargo-book");
  assert.equal(add[0].date, ctx.histDate(ymd, "ob-ext|caixabank|cargo-book"));
});

t("el pull devuelve el extId y el segundo sync no duplica", () => {
  const add = ctx.importObExpenses(estado(), par);
  const rows = add.map((e) => ({
    id: e.id, fecha: e.date, importe: e.amount, comercio: e.merchant, cat: e.category,
    source: ctx.expenseSourceForCloud(e), ob_name: e.obName,
  }));
  rows.forEach((r) => {
    assert.match(r.source, /^ob:caixabank#x\./);
    assert.equal(ctx.expenseBankOf({ source: r.source }), "caixabank");
  });
  const incoming = rows.map((r) => ctx.expenseFromRow(r));
  assert.equal(Array.from(incoming.map((e) => e.extId)).sort().join(","), "cargo-A,cargo-B");
  assert.ok(incoming.every((e) => e.ent === "caixabank" && e.source === "ob"));
  const merged = ctx.mergeExpensesFromCloud([], incoming);
  assert.equal(merged.list.length, 2);
  assert.equal(ctx.importObExpenses(estado(merged.list), par), null);
});

t("sin extId el source diario no cambia; #dup gana a #x", () => {
  assert.equal(ctx.expenseSourceForCloud({ source: "ob", ent: "caixabank" }), "ob:caixabank");
  assert.equal(ctx.expenseSourceForCloud({ source: "ob", ent: "caixabank", extId: "cargo-A", possibleDup: true }), "ob:caixabank#dup");
  assert.equal(ctx.expenseSourceForCloud({ source: "ob-hist", ent: "caixabank" }), "ob-hist:caixabank");
  // El servidor desplegado no parte `#` en `ob-hist:`. La referencia viaja en `ob:` para volver en el pull.
  assert.equal(ctx.expenseSourceForCloud({ source: "ob-hist", ent: "caixabank", extId: "cargo-A" }), "ob:caixabank#x.cargo-A");
  assert.equal(ctx.expenseSourceForCloud({ source: "ob-hist", ent: "caixabank", extId: "cargo-A", possibleDup: true }), "ob-hist:caixabank#dup");
});

t("borrar una referencia no esconde al hermano ni la resucita el sync", () => {
  const add = ctx.importObExpenses(estado(), par);
  const gone = add.find((e) => e.extId === "cargo-A");
  const other = add.find((e) => e.extId === "cargo-B");
  const keys = ctx.expenseTombKeys(gone);
  const del = {};
  keys.forEach((k) => { del[k] = 1; });
  assert.equal(ctx.expenseIsTombstoned(gone, del), true);
  assert.equal(ctx.expenseIsTombstoned(other, del), false);
  assert.equal(ctx.importObExpenses(estado([other], keys), par), null);
  const legacy = ctx.keyOfExpenseLegacy(gone);
  // La lápida vieja (día|importe|comercio) tapa al id menor —el que ocupaba el mediodía—
  // y solo a él. La hermana entra. Con la hermana ya viva, el borrado no resucita al dueño.
  const soloHermana = ctx.importObExpenses(estado([], [legacy]), par);
  assert.ok(soloHermana && soloHermana.length === 1, "entraron " + (soloHermana ? soloHermana.length : 0));
  assert.equal(soloHermana[0].extId, "cargo-B");
  assert.equal(ctx.expenseIsTombstoned(other, { [legacy]: 1 }), false);
  assert.equal(ctx.expenseIsTombstoned(soloHermana[0], { [legacy]: 1 }), false);
  assert.equal(ctx.importObExpenses(estado([other], [legacy]), par), null);
});

t("lápida vieja casa el mediodía canónico y no tapa a la hermana", () => {
  const legacy = ymd + "|12.5|MERCADONA";
  const noon = ctx.histDate(ymd).replace(".000Z", "Z");
  const duena = {
    id: "old-a", date: noon, amount: 12.5, merchant: "MERCADONA", obName: "MERCADONA",
    source: "ob", ent: "caixabank", extId: "cargo-A",
  };
  const hermana = {
    id: "old-b", date: ctx.histDate(ymd, "ob-ext|caixabank|cargo-B"), amount: 12.5,
    merchant: "MERCADONA", obName: "MERCADONA", source: "ob", ent: "caixabank", extId: "cargo-B",
  };
  assert.equal(ctx.keyOfExpense(duena), legacy);
  assert.equal(ctx.obCanonIso(noon), ctx.obCanonIso(ctx.histDate(ymd)));
  assert.equal(ctx.expenseIsTombstoned(duena, { [legacy]: 1 }), true);
  assert.equal(ctx.expenseIsTombstoned(hermana, { [legacy]: 1 }), false);
  assert.notEqual(ctx.keyOfExpense(duena), ctx.keyOfExpense(hermana));
  const otra = Object.assign({}, hermana, { id: "old-c", extId: "cargo-C" });
  assert.equal(ctx.expenseIsTombstoned(otra, { [legacy]: 1 }), false);
});

t("sync a demanda: fila guardada con el sello viejo, los dos cargos y sin duplicar", () => {
  const vieja = {
    id: "old", date: ctx.histDate(ymd), amount: 12.5, merchant: "MERCADONA", obName: "MERCADONA",
    source: "ob", ent: "caixabank", extId: "cargo-A",
  };
  const add = ctx.importObExpenses(estado([vieja]), par);
  assert.ok(add && add.length === 1, "entraron " + (add ? add.length : 0));
  assert.equal(add[0].extId, "cargo-B");
  assert.equal(add[0].date, ctx.histDate(ymd, "ob-ext|caixabank|cargo-B"));
  assert.notEqual(ctx.keyOfExpense(vieja), ctx.keyOfExpense(add[0]));
  const juntos = [vieja].concat(add);
  assert.equal(ctx.importObExpenses(estado(juntos), par), null);
  assert.equal(new Set(juntos.map((e) => e.extId)).size, 2);
  // Las dos ya estaban en el mediodía (sello de antes). El id menor se queda; la otra
  // cambia de hora en el sitio. No hay tercera fila.
  const a = Object.assign({}, vieja, { id: "old-a", date: ctx.histDate(ymd) });
  const b = Object.assign({}, vieja, { id: "old-b", extId: "cargo-B", date: ctx.histDate(ymd) });
  const guardadas = [a, b];
  assert.equal(ctx.importObExpenses(estado(guardadas), par), null);
  assert.equal(a.date, ctx.histDate(ymd));
  assert.equal(b.date, ctx.histDate(ymd, "ob-ext|caixabank|cargo-B"));
  assert.equal(guardadas.length, 2);
  const lap = ymd + "|12.5|MERCADONA";
  assert.equal(ctx.expenseIsTombstoned(a, { [lap]: 1 }), true);
  assert.equal(ctx.expenseIsTombstoned(b, { [lap]: 1 }), false);
});

t("una fila vieja sin extId ocupa el id menor y el otro entra una sola vez", () => {
  const unlabeled = {
    id: "old", date: ctx.histDate(ymd), amount: 12.5, merchant: "MERCADONA", obName: "MERCADONA",
    source: "ob", ent: "caixabank",
  };
  const add = ctx.importObExpenses(estado([unlabeled]), par);
  assert.ok(add && add.length === 1);
  assert.equal(add[0].extId, "cargo-B");
  assert.equal(add[0].date, ctx.histDate(ymd, "ob-ext|caixabank|cargo-B"));
  assert.equal(ctx.importObExpenses(estado([unlabeled].concat(add)), par), null);
});

t("00:30 Madrid del día 1 cuenta en el mes nuevo", () => {
  const reloj = Date.parse("2026-09-30T22:30:00.000Z");
  const gasto = "2026-09-30T22:30:00.000Z";
  const Native = ctx.Date;
  ctx.Date = class extends Native {
    constructor(...args) { super(...(args.length ? args : [reloj])); }
    static now() { return reloj; }
    static parse(v) { return Native.parse(v); }
    static UTC(...a) { return Native.UTC(...a); }
  };
  try {
    const bounds = ctx.presetBoundsMs("month", {});
    assert.equal(ctx.inBounds(ctx.dateMs(gasto), bounds), true, "el 1/10 00:30 Madrid es octubre");
    assert.equal(ctx.inBounds(Date.parse("2026-09-30T21:59:59.000Z"), bounds), false, "el 30/9 23:59 Madrid sigue en septiembre");
    const state = {
      budget: 100, settings: { expenseBanks: ["caixabank"] },
      accounts: [{ ent: "caixabank", role: "diario", spendFrom: true }],
      expenses: [{ id: "g", date: gasto, amount: 12.5, category: "super", ent: "caixabank", merchant: "MERCADONA", source: "manual" }],
    };
    const period = ctx.gastosPeriodOf("month", bounds, null);
    assert.equal(ctx.monthBudgetStats(state, null, null, null, period).spent, 12.5);
  } finally {
    ctx.Date = Native;
  }
});

console.log(fallos ? "inc-2709-06-caixa-extid: " + fallos + " fallo(s) (" + zona + ")" : "inc-2709-06-caixa-extid: OK (" + zona + ")");
process.exit(fallos ? (mutarSello ? 2 : 1) : 0);
