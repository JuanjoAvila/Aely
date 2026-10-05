#!/usr/bin/env node
/**
 * INC-2709-06 · fecha inválida en el sync diario (5/10/2026).
 *
 * En 3fd4b520 una sola fila con fecha que no es un día del calendario tumbaba el lote entero:
 * las pasadas previas de `importObExpenses` (gemelos, ganador del mediodía y sello por id)
 * solo miraban `!tx.date` y `histDate` lanzaba `RangeError: Invalid time value`. Y lo que no
 * lanzaba inventaba el día: `new Date("2026-02-30T12:00:00")` es el 2 de marzo y
 * `parseDate("invalid")` es HOY.
 *
 * Contrato: la fila inválida no entra (ni con el día de hoy ni con el siguiente) y las válidas
 * del mismo lote salen idénticas a importarlas solas: día, extId, sello, dedup y totales.
 * Corre en UTC y en Europe/Madrid. Datos sintéticos.
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
// 1 de marzo de 2026: la ventana (día 1 − 8) abarca el final de febrero, así que el 29, 30 y 31
// de febrero —que 2026 no tiene— caerían dentro si se tomaran por días de marzo.
const reloj = Date.parse("2026-03-01T12:00:00Z");
ctx.Date = class extends Date {
  constructor(...args) { super(...(args.length ? args : [reloj])); }
  static now() { return reloj; }
};

let fallos = 0;
const t = (nombre, fn) => {
  try { fn(); console.log("  ✓ " + nombre); }
  catch (e) { fallos++; console.error("  ✗ " + nombre + "\n      " + (e && e.stack || e)); }
};

const estado = (expenses) => ({
  accounts: [{ id: "a", ent: "caixabank", role: "diario", spendFrom: true, value: 100 }],
  expenses: expenses || [],
  deleted: [],
  fixed: [], debts: [], oneoffs: [],
  settings: { expenseBanks: ["caixabank"] },
});
const mov = (o) => Object.assign({ ent: "caixabank", id: null, date: "2026-02-28", amount: 0,
  merchant: "", note: "", card: false, status: "BOOK", acctUid: "cx-1" }, o);

// Dos gemelos con referencia (mismo día, importe y comercio), uno sin referencia, una compra
// sin comercio que casa con una noti y un ingreso contabilizado.
const validas = [
  mov({ id: "cargo-B", date: "2026-02-28", amount: 12.5, merchant: "MERCADONA" }),
  mov({ id: "cargo-A", date: "2026-02-28", amount: 12.5, merchant: "MERCADONA" }),
  mov({ id: null, date: "2026-02-27", amount: 7.3, merchant: "PANADERIA" }),
  mov({ id: "tr-1", date: "2026-03-01", amount: 23, merchant: "" }),
  mov({ id: "nomina", date: "2026-03-01", amount: -1800, merchant: "NOMINA EMPRESA SL" }),
];
const noti = { id: "noti-1", date: "2026-03-01T09:00:00.000Z", amount: 23, merchant: "Amazon",
  source: "noti", ent: "caixabank", category: "otros" };

const malas = [];
for (const date of [undefined, null, "", "invalid", "2026-02-29", "2026-02-30", "2026-02-31",
  "2026-09-31", "2026-13-01", "2026-00-10", "2026-03-00"]) {
  for (const [i, amount] of [12.5, -1800].entries()) {
    const id = "malo-" + String(date) + "-" + i;
    malas.push(mov({ id, date, amount, merchant: amount < 0 ? "NOMINA EMPRESA SL" : "MERCADONA" }));
    malas.push(mov({ id: null, date, amount: amount + 0.01, merchant: "SIN REF" }));
  }
}

const huella = (e) => [e.date, e.extId || "", e.amount, e.merchant, e.obName, e.category,
  e.ent, e.acctUid || "", e.budgetSkip ? 1 : 0, e.possibleDup ? e.possibleDupOf : ""].join("|");
// Día LOCAL, como `dayKey` (que es `const` y no sale al contexto de pruebas).
const dia = (iso) => { const d = new Date(iso); return d.getFullYear() + "-" +
  String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };

console.log("inc-2709-06-fecha-invalida (" + zona + ")");

let soloValidas;
t("referencia: las filas válidas solas entran con su día financiero", () => {
  soloValidas = ctx.importObExpenses(estado([noti]), validas.map((x) => Object.assign({}, x)));
  assert.ok(soloValidas, "las válidas tienen que entrar");
  assert.equal(soloValidas.length, 5);
  for (const v of validas) {
    const e = soloValidas.find((x) => (v.id ? x.extId === v.id : !x.extId && x.amount === v.amount));
    assert.ok(e, "falta " + (v.id || v.merchant));
    assert.equal(dia(e.date), v.date, "día financiero de " + (v.id || v.merchant));
  }
});

t("cada fecha inválida, sola, no lanza y no entra", () => {
  for (const m of malas) {
    let r;
    assert.doesNotThrow(() => { r = ctx.importObExpenses(estado([noti]), [Object.assign({}, m)]); },
      JSON.stringify(m));
    assert.equal(r, null, "no se apunta: " + JSON.stringify(m));
  }
});

let mezcla;
t("lote mezclado: no lanza y las válidas salen idénticas a importarlas solas", () => {
  const lote = [];
  malas.forEach((m, i) => { lote.push(Object.assign({}, m)); if (validas[i]) lote.push(Object.assign({}, validas[i])); });
  assert.doesNotThrow(() => { mezcla = ctx.importObExpenses(estado([noti]), lote); });
  assert.ok(mezcla, "las válidas del lote tienen que entrar");
  assert.equal(mezcla.length, soloValidas.length, "ni una fila de más ni de menos");
  assert.deepEqual(mezcla.map(huella).sort(), soloValidas.map(huella).sort());
});

t("los gemelos con referencia conservan dos sellos distintos del mismo día", () => {
  const gem = mezcla.filter((e) => e.merchant === "MERCADONA");
  assert.equal(gem.length, 2);
  assert.notEqual(ctx.obCanonIso(gem[0].date), ctx.obCanonIso(gem[1].date));
  gem.forEach((e) => assert.equal(dia(e.date), "2026-02-28"));
});

t("la compra sin comercio sigue marcada como posible repetido de la noti", () => {
  const tr = mezcla.find((e) => e.extId === "tr-1");
  assert.equal(tr.possibleDup, true);
  assert.equal(tr.possibleDupOf, "noti-1");
});

t("ninguna fila del lote cae en un día que no traía ninguna válida", () => {
  const dias = new Set(validas.map((v) => v.date));
  mezcla.forEach((e) => assert.ok(dias.has(dia(e.date)), "día inventado: " + e.date));
});

t("totales exactos: gasto 55,30 € e ingreso 1.800 €, igual que sin las inválidas", () => {
  const cent = (rows, sig) => rows.filter((e) => Math.sign(e.amount) === sig)
    .reduce((a, e) => a + Math.round(e.amount * 100), 0);
  assert.equal(cent(mezcla, 1), 5530);
  assert.equal(cent(mezcla, -1), -180000);
  assert.equal(cent(mezcla, 1), cent(soloValidas, 1));
  assert.equal(cent(mezcla, -1), cent(soloValidas, -1));
});

t("resync del mismo lote mezclado no duplica ni lanza", () => {
  const s = estado([noti].concat(mezcla));
  const lote = malas.concat(validas).map((x) => Object.assign({}, x));
  let r;
  assert.doesNotThrow(() => { r = ctx.importObExpenses(s, lote); });
  assert.equal(r, null);
});

if (fallos) { console.error("  " + fallos + " fallo(s)"); process.exit(1); }
