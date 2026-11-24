/**
 * DIN-01: el IBAN de la CONTRAPARTE llega al estado local (`bankTx.cpIban`) desde `bank-sync`
 * (`mapTransaction` → `cp_iban`). Es un dato de un TERCERO y el repo es público: solo IBAN de ejemplo
 * inválidos (ES00 + ceros), nunca reales. Vigila forma, normalización, que no viaje por donde no debe
 * (copia diaria, logs) y que sin el campo nada cambia.
 * Los tests Deno del servidor (supabase/functions/_shared/enablebanking.test.ts) NO se ejecutan en este PC.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import { loadPureLogic, createLogicSandbox, extractPureLogicSource } from "../scripts/load-pure-logic.mjs";
import { E } from "./helpers/banco-sintetico.mjs";

const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8"), c = loadPureLogic(html);
const IBAN = "ES0000000000000000000000", IBAN2 = "ES0000000000000000000001";
const eb = { transaction_amount: { amount: "12.00" }, booking_date: "2026-11-02", entry_reference: "r1", status: "BOOK" };

test("servidor: cargo → IBAN del acreedor; abono → IBAN del ordenante", () => {
  assert.equal(E.mapTransaction({ ...eb, credit_debit_indicator: "DBIT", creditor_account: { iban: IBAN }, debtor_account: { iban: IBAN2 } }).cp_iban, IBAN);
  assert.equal(E.mapTransaction({ ...eb, credit_debit_indicator: "CRDT", creditor_account: { iban: IBAN }, debtor_account: { iban: IBAN2 } }).cp_iban, IBAN2);
});
test("servidor: se normaliza (espacios, minúsculas) y se rechaza lo que no tiene forma de IBAN", () => {
  const f = iban => E.mapTransaction({ ...eb, credit_debit_indicator: "DBIT", creditor_account: { iban } });
  assert.equal(f("es00 0000 0000 0000 0000 0000").cp_iban, IBAN);
  for (const mal of ["", "no es un iban", "ES00", "1234567890123456", "ES00<script>0000000000", 5, null, {}]) assert.equal("cp_iban" in f(mal), false, String(mal));
});
test("servidor: sin cuenta de la contraparte, o la del lado equivocado, no hay campo (la salida no cambia)", () => {
  const sin = E.mapTransaction({ ...eb, credit_debit_indicator: "DBIT" });
  assert.equal("cp_iban" in sin, false);
  assert.equal("cp_iban" in E.mapTransaction({ ...eb, credit_debit_indicator: "DBIT", debtor_account: { iban: IBAN } }), false, "en un cargo el ordenante soy yo");
  assert.deepEqual(Object.keys(sin).sort(), ["amount", "card", "concept", "date", "ext_id", "merchant", "note", "status"]);
});
test("cliente: flattenBankTx lleva cp_iban a bankTx.cpIban, normalizado; sin campo, sin clave", () => {
  const tx = (id, extra) => ({ ext_id: id, date: "2026-11-02", amount: 12, merchant: "X", note: "", card: false, status: "BOOK", ...extra });
  const rows = c.flattenBankTx([{ aspsp: "CaixaBank", ok: true, accounts: [{ ok: true, iban: "ES1100000000000000000000", transactions: [tx("a", { cp_iban: IBAN }), tx("b", { cp_iban: " es00 0000 0000 0000 0000 0001 " }), tx("c", {}), tx("d", { cp_iban: "texto libre del banco" })] }] }], []);
  const por = Object.fromEntries(rows.map(r => [r.id, r]));
  assert.equal(por.a.cpIban, IBAN);
  assert.equal(por.b.cpIban, IBAN2);
  assert.equal("cpIban" in por.c, false);
  assert.equal("cpIban" in por.d, false);
});
test("copia diaria: el IBAN de la contraparte no sale del móvil hacia state_backups", async () => {
  const calls = [], db = { from: t => ({ upsert: async row => { calls.push([t, row]); return {}; }, delete: () => ({ eq: () => ({ lt: async () => ({}) }) }) }), auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } };
  const sb = createLogicSandbox(); sb.window.supabase = { createClient: () => db };
  vm.createContext(sb); vm.runInContext(extractPureLogicSource(html) + ";globalThis.cloud=cloud;", sb);
  const estado = { bankTx: [{ id: "a", merchant: "X", cpIban: IBAN }, { id: "b" }] };
  await sb.cloud.backupState("u1", estado);
  assert.equal(JSON.stringify(calls).includes(IBAN), false, "el IBAN no está en la copia");
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0][1].data.bankTx)), [{ id: "a", merchant: "X" }, { id: "b" }]);
  assert.equal(estado.bankTx[0].cpIban, IBAN, "el estado vivo no se toca");
});
test("el estado que sube a la nube (slimForCloud) no lleva bankTx, así que tampoco el IBAN", () => {
  const out = c.slimForCloud({ bankTx: [{ id: "a", cpIban: IBAN }], settings: {} });
  assert.equal(JSON.stringify(out).includes(IBAN), false);
});
test("ningún log del servidor escribe el IBAN de la contraparte", () => {
  for (const f of ["supabase/functions/bank-sync/index.ts", "supabase/functions/_shared/enablebanking.ts"]) {
    const src = fs.readFileSync(new URL("../" + f, import.meta.url), "utf8");
    for (const l of src.split("\n").filter(l => /console\.|logEvent|logFin|captureException/.test(l))) assert.doesNotMatch(l, /cp_iban|cpIban|creditor_account|debtor_account|\.iban/i, f + ": " + l.trim());
  }
});
