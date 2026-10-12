#!/usr/bin/env node
/**
 * Identidad de fila de gasto (2026-09-07): uuid en altas nuevas; escrituras por id cuando
 * es uuid; un id corto del legado no acredita identidad para escribir.
 * Sin identidad exacta el borrado queda pendiente con aviso, nunca se atribuye a un gemelo.
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

t("expenseCloudKeys: sólo un UUID permite escritura; el legado queda pendiente", () => {
  const uuid="550e8400-e29b-41d4-a716-446655440000";
  assert.equal(ctx.expenseCloudKeys({id:uuid}).id,uuid);
  for(const id of ["legacy","",null]) assert.equal(ctx.expenseCloudKeys({id,date:"2026-09-01",amount:12,merchant:"Fixture"}).by,"abort");
  let calls=0; const q={eq(){calls++;return this}};
  assert.throws(()=>ctx.expenseCloudEq(q,"owner",{id:"legacy",date:"2026-09-01",amount:12,merchant:"Fixture"}),/identity/);
  assert.equal(calls,0);
  ctx.expenseCloudEq(q,"owner",{id:uuid});assert.equal(calls,2);
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

// El transporte completo se ejecuta también con ACK parcial y sesión perdida.
const {client,database,id,other,owner}=await import('./expense-write-fixture.mjs');
let a=await client();a.db.login(null);await assert.rejects(()=>a.cloud.deleteExpensesByIds([id]));assert.equal(a.db.calls.length,0);
a=await client();await assert.rejects(()=>a.cloud.deleteExpensesByIds([id,'legacy']));assert.equal(a.db.calls.length,0);
const db=database();db.rows.push({...db.rows[0],id:other});a=await client(db);
await a.cloud.deleteExpensesByIds([id,other]);assert.equal(db.rows.length,0);assert.equal(a.cloud.expenseWrites().length,0);
for(const q of db.calls){assert(q.filters.some(([k,v])=>k==='user_id'&&v===owner));assert(q.filters.some(([k,v])=>k==='id'&&[id,other].includes(v)));}
const partial=database({before({deleted,rows,calls}){if(deleted&&calls.filter(x=>x.deleted).length===2)throw Error('partial');}});
partial.rows.push({...partial.rows[0],id:other});a=await client(partial);
await assert.rejects(()=>a.cloud.deleteExpensesByIds([id,other]),/partial/);
assert.equal(a.cloud.expenseWrites()[0].done[0],id);assert.equal(partial.rows.length,1);
delete partial.options.before;await a.cloud.retryExpenseWrite(a.cloud.expenseWrites()[0].opId);assert.equal(partial.rows.length,0);
console.log('expense-id-cloud: OK (UUID exacto, sesión perdida y lote parcial reintentable)');
