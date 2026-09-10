#!/usr/bin/env node
/**
 * FIN-07 — pullExpenses paginado (keyset).
 * El tope único de 2000 hacía que syncCloudExpenses tirara gastos supabase viejos
 * del móvil aunque siguieran en la nube.
 */
import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx = loadPureLogicFromFile();

async function t(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
}

console.log("fin07-pull-expenses");

await t("mcPullExpensesPaged: 2500 filas en páginas de 1000 → 3 viajes, sin capped", async () => {
  const total = 2500;
  const pageSize = 1000;
  const all = [];
  for (let i = 0; i < total; i++) {
    all.push({ id: "id-" + String(i).padStart(4, "0"), fecha: "2026-01-" + String((i % 28) + 1).padStart(2, "0"), importe: i });
  }
  all.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || String(b.id).localeCompare(String(a.id)));
  let calls = 0;
  const fetchPage = async (cursor) => {
    calls++;
    let start = 0;
    if (cursor) {
      start = all.findIndex((r) =>
        String(r.fecha) < String(cursor.fecha) ||
        (String(r.fecha) === String(cursor.fecha) && String(r.id) < String(cursor.id))
      );
      if (start < 0) return [];
    }
    return all.slice(start, start + pageSize);
  };
  const r = await ctx.mcPullExpensesPaged(fetchPage, pageSize, 50);
  assert.equal(r.rows.length, 2500);
  assert.equal(r.capped, false);
  assert.equal(calls, 3);
  const ids = new Set(r.rows.map((x) => x.id));
  assert.equal(ids.size, 2500);
});

await t("mcPullExpensesPaged: página corta en el primero → una sola llamada", async () => {
  let calls = 0;
  const fetchPage = async () => { calls++; return [{ id: "a", fecha: "2026-09-01" }]; };
  const r = await ctx.mcPullExpensesPaged(fetchPage, 1000, 50);
  assert.equal(r.rows.length, 1);
  assert.equal(r.capped, false);
  assert.equal(calls, 1);
});

await t("mcPullExpensesPaged: agotar maxPages → capped sin inventar más filas", async () => {
  const fetchPage = async (cursor) => {
    const n = cursor ? Number(String(cursor.id).slice(1)) + 1 : 0;
    const out = [];
    for (let i = 0; i < 10; i++) out.push({ id: "i" + (n + i), fecha: "2026-01-15" });
    return out;
  };
  const r = await ctx.mcPullExpensesPaged(fetchPage, 10, 3);
  assert.equal(r.rows.length, 30);
  assert.equal(r.capped, true);
});

await t("mcPullExpensesPaged: página vacía tras una llena → corta sin capped", async () => {
  let calls = 0;
  const fetchPage = async () => {
    calls++;
    if (calls === 1) return [{ id: "a", fecha: "2026-09-02" }, { id: "b", fecha: "2026-09-01" }];
    return [];
  };
  const r = await ctx.mcPullExpensesPaged(fetchPage, 2, 50);
  assert.equal(r.rows.length, 2);
  assert.equal(r.capped, false);
  assert.equal(calls, 2);
});

console.log("\nfin07-pull-expenses: OK");
