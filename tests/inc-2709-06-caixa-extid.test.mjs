#!/usr/bin/env node
/**
 * INC-2709-06 — cargos CaixaBank con referencias distintas no se tiran por día|importe|comercio.
 *
 * Contraejemplo sintético (brief 29/9, revalidado en main 8bb0398f): dos cuentas Caixa, dos
 * ext_id distintos, mismo día/importe/comercio → flatten 2, import 1. Dentro de una cuenta,
 * histFlatten tiraba el segundo (skippedUniq=1). No prueba el caso humano real sin lectura del
 * perfil afectado; sí el defecto de identidad de origen en cliente.
 */
import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx = loadPureLogicFromFile();

let fallos = 0;
const t = (nombre, fn) => {
  try { fn(); console.log("  ✓ " + nombre); }
  catch (e) { fallos++; console.error("  ✗ " + nombre + "\n      " + (e && e.message)); }
};

const ymd = (() => {
  const d = new Date(); d.setDate(d.getDate() - 1);
  const p = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")];
  return p.join("-");
})();

console.log("inc-2709-06-caixa-extid");

t("flatten conserva uid opaco de cuenta y las dos referencias", () => {
  const links = [{ aspsp: "CaixaBank", accounts: [
    { uid: "cx-a", transactions: [{ ext_id: "cargo-A", date: ymd, amount: 12.5, merchant: "MERCADONA", status: "BOOK" }] },
    { uid: "cx-b", transactions: [{ ext_id: "cargo-B", date: ymd, amount: 12.5, merchant: "MERCADONA", status: "BOOK" }] },
  ] }];
  const flat = ctx.flattenBankTx(links);
  assert.equal(flat.length, 2);
  assert.equal(flat.map((x) => x.id).slice().sort().join("|"), "cargo-A|cargo-B");
  assert.equal(flat.map((x) => x.acctUid).slice().sort().join("|"), "cx-a|cx-b");
});

t("sync diario: dos extId Caixa mismo día/importe/comercio → entran LOS DOS", () => {
  const links = [{ aspsp: "CaixaBank", accounts: [
    { uid: "cx-a", transactions: [{ ext_id: "cargo-A", date: ymd, amount: 12.5, merchant: "MERCADONA", status: "BOOK" }] },
    { uid: "cx-b", transactions: [{ ext_id: "cargo-B", date: ymd, amount: 12.5, merchant: "MERCADONA", status: "BOOK" }] },
  ] }];
  const flat = ctx.flattenBankTx(links);
  const s = { accounts: [{ id: "a", ent: "caixabank", role: "diario" }], expenses: [], fixed: [], debts: [], oneoffs: [], deleted: [] };
  const add = ctx.importObExpenses(s, flat) || [];
  assert.equal(add.length, 2, "antes: 1; con identidad por origen: 2");
  assert.equal(add.map((e) => e.extId).slice().sort().join("|"), "cargo-A|cargo-B");
  assert.equal(new Set(add.map((e) => ctx.keyOfExpense(e))).size, 2, "claves de merge distintas (fecha salada)");
  assert.equal(add.filter((e) => String(e.date).slice(11, 19) === "12:00:00").length, 1, "una conserva el mediodía canónico");
  assert.equal(add.filter((e) => String(e.date).slice(11, 19) !== "12:00:00").length, 1, "la otra usa histDate");
});

t("sin extId (TR) la terna débil sigue tapando el reintento", () => {
  const s = { accounts: [{ id: "a", ent: "trade_republic", role: "diario" }], expenses: [], fixed: [], debts: [], oneoffs: [], deleted: [] };
  const tx = { ent: "trade_republic", id: null, date: ymd, amount: 12.5, merchant: "Movimiento", status: "BOOK" };
  const first = ctx.importObExpenses(s, [tx]) || [];
  assert.equal(first.length, 1);
  const second = ctx.importObExpenses({ ...s, expenses: first }, [tx]);
  assert.equal(second, null);
});

t("histórico: dos BOOK con extId distintos en la misma cuenta → dos candidatos", () => {
  const res = { links: [{ aspsp: "CaixaBank", accounts: [{ uid: "cx-unica", transactions: [
    { ext_id: "cargo-A", date: "2026-09-10", amount: 12.5, merchant: "MERCADONA", status: "BOOK" },
    { ext_id: "cargo-B", date: "2026-09-10", amount: 12.5, merchant: "MERCADONA", status: "BOOK" },
  ] }] }] };
  const r = ctx.histFlattenHistoryLinks(res, [], {});
  assert.equal(r.out.length, 2);
  assert.equal(r.stats.skippedUniq, 0);
  assert.equal(r.out.map((x) => x.id).slice().sort().join("|"), "cargo-A|cargo-B");
});

t("histórico: PDNG sin id + BOOK con id sigue siendo un solo cargo", () => {
  const res = { links: [{ aspsp: "CaixaBank", accounts: [{ uid: "cx-unica", transactions: [
    { date: "2026-09-10", amount: 12.5, merchant: "MERCADONA", status: "PDNG" },
    { ext_id: "cargo-book", date: "2026-09-10", amount: 12.5, merchant: "MERCADONA", status: "BOOK" },
  ] }] }] };
  const r = ctx.histFlattenHistoryLinks(res, [], {});
  assert.equal(r.out.length, 1);
  assert.equal(r.out[0].id, "cargo-book");
  assert.equal(r.stats.skippedUniq, 1);
});

t("merge no funde dos OB locales con extId distintos", () => {
  const a = { id: "1", date: ymd + "T12:00:00.000Z", amount: 12.5, merchant: "MERCADONA", category: "super", source: "ob", ent: "caixabank", extId: "cargo-A" };
  const b = { id: "2", date: ctx.histDate(ymd, "ob-ext|caixabank|cargo-B"), amount: 12.5, merchant: "MERCADONA", category: "super", source: "ob", ent: "caixabank", extId: "cargo-B" };
  const m = ctx.mergeExpensesFromCloud([a], [b]);
  assert.equal(m.list.length, 2);
  assert.equal(m.nuevos, 1);
});

console.log(fallos ? `inc-2709-06-caixa-extid: ${fallos} fallo(s)` : "inc-2709-06-caixa-extid: OK");
process.exit(fallos ? 1 : 0);
