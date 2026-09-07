#!/usr/bin/env node
/**
 * B09-B (2026-09-07): la ventana del mes es LA MISMA en cliente e ingest.
 *
 * Bug: cliente usaba hora local del dispositivo; ingest `Date.UTC(y,m,1)`. Una compra el
 * día 1 a las 00:30 en España (UTC+2) caía en septiembre en la app y en agosto en el widget.
 *
 * Este test carga LAS DOS implementaciones de `inicioDeMesMs` y exige el mismo resultado
 * en los bordes — con el reloj FIJO (no depende de la TZ de la máquina CI).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = fs.readFileSync(path.join(root, "supabase/functions/_shared/presupuesto.ts"), "utf8");
const js = transformSync(src, { loader: "ts", format: "esm" }).code;
const srv = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const cli = loadPureLogicFromFile();

function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}`); throw e; }
}

console.log("month-window");

/* Reloj fijo: 1 sep 2026 00:30 Europe/Madrid = 31 ago 22:30 UTC */
const SEP1_0030 = Date.parse("2026-08-31T22:30:00.000Z");
/* 1 sep 2026 23:30 Europe/Madrid = 1 sep 21:30 UTC */
const SEP1_2330 = Date.parse("2026-09-01T21:30:00.000Z");
/* Compra en ese instante de las 00:30 */
const COMPRA_0030 = "2026-08-31T22:30:00.000Z";
/* Gasto claramente de agosto (no debe entrar en septiembre) */
const AGOSTO = "2026-08-15T12:00:00.000Z";

t("inicioDeMesMs: cliente = servidor (00:30 del día 1)", () => {
  assert.equal(cli.inicioDeMesMs(SEP1_0030), srv.inicioDeMesMs(SEP1_0030));
});

t("inicioDeMesMs: cliente = servidor (23:30 del día 1)", () => {
  assert.equal(cli.inicioDeMesMs(SEP1_2330), srv.inicioDeMesMs(SEP1_2330));
});

t("ambos bordes abren el MISMO septiembre (no el UTC de agosto)", () => {
  const a = cli.inicioDeMesMs(SEP1_0030);
  const b = cli.inicioDeMesMs(SEP1_2330);
  assert.equal(a, b, "00:30 y 23:30 del día 1 abren el mismo mes");
  // Sept 1 00:00 Madrid CEST = Aug 31 22:00 UTC
  assert.equal(a, Date.parse("2026-08-31T22:00:00.000Z"));
  // El viejo Date.UTC del mes de la fecha (agosto) abría el 1 ago — distinto
  const utcViejo = Date.UTC(2026, 7, 1);
  assert.notEqual(a, utcViejo);
});

t("borde 00:30: app y servidor cuentan la compra; el agosto no entra", () => {
  const data = {
    budget: 1000,
    accounts: [{ ent: "trade_republic", role: "diario" }],
    settings: { expenseBanks: ["trade_republic"], gTotalMode: "split" },
    reservaLog: [],
  };
  const movs = [
    { date: AGOSTO, amount: 100, category: "super", source: "macrodroid" },
    { date: COMPRA_0030, amount: 25, category: "super", source: "macrodroid" },
  ];
  const desdeMs = srv.inicioDeMesMs(SEP1_0030);
  const filas = movs
    .filter((m) => Date.parse(m.date) >= desdeMs)
    .map((m) => ({ importe: m.amount, cat: m.category, source: m.source, fecha: m.date }));
  const srvStats = srv.statsDelMes(filas, data, desdeMs);
  const appStats = cli.monthBudgetStats(Object.assign({}, data, { expenses: movs }), SEP1_0030);
  assert.equal(srvStats.spent, 25);
  assert.equal(+appStats.spent.toFixed(2), 25);
  assert.equal(srvStats.spent, +appStats.spent.toFixed(2));
});

t("borde 23:30: misma ventana y misma cifra", () => {
  const data = {
    budget: 1000,
    accounts: [{ ent: "trade_republic", role: "diario" }],
    settings: { expenseBanks: ["trade_republic"], gTotalMode: "split" },
    reservaLog: [],
  };
  const movs = [
    { date: COMPRA_0030, amount: 25, category: "super", source: "macrodroid" },
    { date: "2026-09-01T21:30:00.000Z", amount: 10, category: "super", source: "macrodroid" },
  ];
  const desdeMs = srv.inicioDeMesMs(SEP1_2330);
  const filas = movs
    .filter((m) => Date.parse(m.date) >= desdeMs)
    .map((m) => ({ importe: m.amount, cat: m.category, source: m.source, fecha: m.date }));
  const srvStats = srv.statsDelMes(filas, data, desdeMs);
  const appStats = cli.monthBudgetStats(Object.assign({}, data, { expenses: movs }), SEP1_2330);
  assert.equal(srvStats.spent, 35);
  assert.equal(+appStats.spent.toFixed(2), 35);
});

t("ingest ya no usa Date.UTC para la ventana", () => {
  const ingest = fs.readFileSync(path.join(root, "supabase/functions/ingest/index.ts"), "utf8");
  assert.match(ingest, /inicioDeMesMs\(/);
  assert.doesNotMatch(
    ingest,
    /Date\.UTC\(\s*now\.getUTCFullYear\(\)/,
    "no volver al mes UTC de la fecha"
  );
});

console.log("\nmonth-window: OK");
