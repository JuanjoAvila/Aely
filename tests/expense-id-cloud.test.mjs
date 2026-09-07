#!/usr/bin/env node
/**
 * Identidad de fila de gasto (2026-09-07): uuid en altas nuevas; escrituras por id cuando
 * es uuid; fallback eterno por fecha|importe|comercio si el id es corto (legado del móvil).
 * Sin ese fallback el borrado queda mudo — peor que impreciso.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const core = readFileSync(join(root, "src/modules/00-core.js"), "utf8");
const ctx = loadPureLogicFromFile();

function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}`); throw e; }
}

console.log("expense-id-cloud");

t("isExpenseUuid: acepta uuid RFC y rechaza id corto de uid()", () => {
  assert.equal(ctx.isExpenseUuid("a1b2c3d4-e5f6-4789-a012-3456789abcde"), true);
  assert.equal(ctx.isExpenseUuid("550e8400-e29b-41d4-a716-446655440000"), true);
  assert.equal(ctx.isExpenseUuid("k7x9m2ab"), false); // uid() legado
  assert.equal(ctx.isExpenseUuid(""), false);
  assert.equal(ctx.isExpenseUuid(null), false);
});

t("mcExpenseId: genera uuid válido (y distinto en dos llamadas)", () => {
  const a = ctx.mcExpenseId();
  const b = ctx.mcExpenseId();
  assert.equal(ctx.isExpenseUuid(a), true);
  assert.equal(ctx.isExpenseUuid(b), true);
  assert.notEqual(a, b);
});

t("expenseCloudKeys: uuid → by id; id corto → by atributos (legado)", () => {
  const uuid = "550e8400-e29b-41d4-a716-446655440000";
  const u = ctx.expenseCloudKeys({ id: uuid, date: "2026-09-01T12:00:00.000Z", amount: 12.5, merchant: "X" });
  assert.equal(u.by, "id");
  assert.equal(u.id, uuid);

  const legacy = ctx.expenseCloudKeys({
    id: "k7x9m2ab",
    date: "2026-09-01T12:00:00.000Z",
    amount: 40,
    merchant: "Bizum a Pedro",
  });
  assert.equal(legacy.by, "attrs");
  assert.equal(legacy.fecha, "2026-09-01T12:00:00.000Z");
  assert.equal(legacy.importe, 40);
  assert.equal(legacy.comercio, "Bizum a Pedro");
});

t("expenseCloudKeys: comercio vacío si falta (mismo contrato que el .eq viejo)", () => {
  const k = ctx.expenseCloudKeys({ id: "shortid1", date: "2026-01-01T12:00:00.000Z", amount: 1 });
  assert.equal(k.by, "attrs");
  assert.equal(k.comercio, "");
});

t("expenseCloudKeys: sin fecha o importe → abort (nunca solo user_id)", () => {
  assert.equal(ctx.expenseCloudKeys({ id: "k7x9m2ab", amount: 40 }).by, "abort");
  assert.equal(ctx.expenseCloudKeys({ id: "k7x9m2ab", date: "2026-09-01T12:00:00.000Z" }).by, "abort");
  assert.equal(ctx.expenseCloudKeys({ id: "k7x9m2ab", date: "", amount: 40 }).by, "abort");
  // importe 0 es válido (no «falta»)
  assert.equal(ctx.expenseCloudKeys({ id: "k7x9m2ab", date: "2026-09-01T12:00:00.000Z", amount: 0 }).by, "attrs");
});

t("expenseCloudEq: abort no emite ninguna query", () => {
  let eqs = 0;
  const q = {
    eq() { eqs++; return this; },
    delete() { eqs++; return this; },
    update() { eqs++; return this; },
  };
  const out = ctx.expenseCloudEq(q, "user-1", { id: "corto", amount: 12.5 });
  assert.equal(eqs, 0, "sin fecha no debe llamar a .eq");
  assert.equal(out.error, null);
});

t("fuente: las cinco escrituras van por expenseCloudEq (rama id/attrs)", () => {
  const names = ["setExpenseBank", "setExpenseNoCard", "setExpenseNote", "setExpenseCat", "deleteExpense"];
  for (const n of names) {
    const i = core.indexOf("async " + n + "(");
    assert.ok(i >= 0, "falta " + n);
    const chunk = core.slice(i, i + 700);
    assert.match(chunk, /expenseCloudEq\(/, n + " debe filtrar con expenseCloudEq");
    assert.doesNotMatch(
      chunk,
      /\.eq\(['"]fecha['"]/,
      n + " no debe volver al .eq fecha/importe/comercio a pelo"
    );
  }
});

t("fuente: addExpense manda id cuando es uuid", () => {
  const i = core.indexOf("async addExpense(");
  assert.ok(i >= 0);
  const chunk = core.slice(i, i + 1200);
  assert.match(chunk, /isExpenseUuid\(e&&e\.id\)/);
  assert.match(chunk, /base\.id\s*=\s*e\.id/);
});

t("altas de gasto usan mcExpenseId; uid() global intacto", () => {
  const files = [
    "src/modules/08-motor-bank.js",
    "src/modules/04-tab-gastos.js",
    "src/modules/10-app-components.js",
    "src/modules/14-v4-screens.js",
    "src/modules/15-import-hoja.js",
  ];
  for (const f of files) {
    const src = readFileSync(join(root, f), "utf8");
    // Al menos una alta de gasto con mcExpenseId en cada módulo de creación
    assert.match(src, /mcExpenseId\(\)/, f + " debe crear gastos con mcExpenseId");
  }
  const i18n = readFileSync(join(root, "src/modules/01-i18n.js"), "utf8");
  assert.match(i18n, /const uid=\(\)=>\s*Math\.random\(\)\.toString\(36\)\.slice\(2,10\)/);
});

console.log("\nexpense-id-cloud: OK");
