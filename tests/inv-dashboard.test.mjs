#!/usr/bin/env node
import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx = loadPureLogicFromFile();

function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}`); throw e; }
}

console.log("inv-dashboard");

t("recordInvSnapshot: un punto por día, actualiza valor/coste", () => {
  let h = ctx.recordInvSnapshot([], "2026-07-14", 1000, 900);
  assert.equal(h.length, 1);
  assert.equal(h[0].v, 1000);
  assert.equal(h[0].c, 900);
  h = ctx.recordInvSnapshot(h, "2026-07-14", 1050, 900);
  assert.equal(h.length, 1);
  assert.equal(h[0].v, 1050);
  h = ctx.recordInvSnapshot(h, "2026-07-15", 1100, 920);
  assert.equal(h.length, 2);
  assert.equal(h[1].d, "2026-07-15");
});

console.log("\ninv-dashboard: OK");
