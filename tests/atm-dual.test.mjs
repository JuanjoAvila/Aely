#!/usr/bin/env node
/**
 * isAtmWithdrawal vive en cliente (00-core.js) e ingest_logic.ts.
 * Las dos tienen que responder IGUAL: si solo pruebas una, el otro lado se pudre
 * (mismo patrón que presupuesto-servidor / los 965 €).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = fs.readFileSync(path.join(root, "supabase/functions/_shared/ingest_logic.ts"), "utf8");
const js = transformSync(src, { loader: "ts", format: "esm" }).code;
const srv = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const cli = loadPureLogicFromFile();

function t(name, fn) {
  try { fn(); console.log("  ✓ " + name); }
  catch (e) { console.error("  ✗ " + name); throw e; }
}

const cases = [
  ["RETIRADA CAJERO AUTOMATICO", true],
  ["RETIRADA CAJERO 4B", true],
  ["ATM WITHDRAWAL", true],
  ["Cash Withdrawal Sabadell", true],
  ["Reintegro efectivo", true],
  ["Mercadona", false],
  ["Batman Comics", false],
  ["Cafe Central", false],
  ["", false],
];

console.log("atm-dual");

t("cliente e ingest_logic acuerdan en la lista compartida", () => {
  cases.forEach(function(row) {
    const merchant = row[0];
    const want = row[1];
    const a = !!cli.isAtmWithdrawal(merchant);
    const b = !!srv.isAtmWithdrawal(merchant);
    assert.equal(a, want, "cliente: " + JSON.stringify(merchant));
    assert.equal(b, want, "servidor: " + JSON.stringify(merchant));
    assert.equal(a, b, "desacuerdo en " + JSON.stringify(merchant));
  });
});

t("alta nueva: categoryOfNewMerchant da traspaso; autoCategory no", () => {
  assert.equal(cli.categoryOfNewMerchant("RETIRADA CAJERO"), "traspaso");
  assert.equal(cli.autoCategory("RETIRADA CAJERO"), "otros");
  assert.equal(srv.categorizar("RETIRADA CAJERO"), "traspaso");
});

console.log("atm-dual: OK");
