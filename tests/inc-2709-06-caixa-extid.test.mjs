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
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

if (!process.argv.includes("--zone-child")) {
  for (const zone of ["UTC", "Europe/Madrid"]) {
    const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--zone-child"], {
      env: { ...process.env, TZ: zone },
      stdio: "inherit",
    });
    if (r.status !== 0) process.exit(r.status || 1);
  }
  process.exit(0);
}

const ctx = loadPureLogicFromFile();
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

t("sync diario: los dos BOOK entran, el id menor en el mediodía local y el otro salado", () => {
  const add = ctx.importObExpenses(estado(), par);
  assert.ok(add && add.length === 2, "tienen que entrar los dos");
  assert.equal(new Set(add.map((e) => ctx.keyOfExpense(e))).size, 2);
  const a = add.find((e) => e.extId === "cargo-A");
  const b = add.find((e) => e.extId === "cargo-B");
  assert.equal(a.date, ctx.histDate(ymd));
  assert.equal(b.date, ctx.histDate(ymd, "ob-ext|caixabank|cargo-B"));
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
  assert.equal(add[0].date, ctx.histDate(ymd));
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
  assert.equal(ctx.expenseSourceForCloud({ source: "ob-hist", ent: "caixabank", extId: "cargo-A" }), "ob-hist:caixabank");
});

t("borrar el del mediodía no esconde al hermano ni lo resucita el sync", () => {
  const add = ctx.importObExpenses(estado(), par);
  const noon = add.find((e) => e.date === ctx.histDate(ymd));
  const other = add.find((e) => e !== noon);
  const keys = ctx.expenseTombKeys(noon);
  const del = {};
  keys.forEach((k) => { del[k] = 1; });
  assert.equal(ctx.expenseIsTombstoned(noon, del), true);
  assert.equal(ctx.expenseIsTombstoned(other, del), false);
  assert.equal(ctx.importObExpenses(estado([other], keys), par), null);
  assert.equal(ctx.importObExpenses(estado([], [ctx.keyOfExpenseLegacy(noon)]), par), null);
  const legacy = ctx.keyOfExpenseLegacy(noon);
  assert.equal(ctx.expenseIsTombstoned(other, { [legacy]: 1 }), false);
  // Sin `obid` no se sabe qué referencia ocupaba el mediodía. Con el hermano vivo, esa
  // referencia puede volver salada. El borrado de ahora escribe `obid` y no vuelve (arriba).
  const back = ctx.importObExpenses(estado([other], [legacy]), par);
  assert.ok(back && back.length === 1);
  assert.equal(back[0].extId, noon.extId);
  assert.notEqual(back[0].date, ctx.histDate(ymd));
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

console.log(fallos ? "inc-2709-06-caixa-extid: " + fallos + " fallo(s) (" + zona + ")" : "inc-2709-06-caixa-extid: OK (" + zona + ")");
process.exit(fallos ? 1 : 0);
