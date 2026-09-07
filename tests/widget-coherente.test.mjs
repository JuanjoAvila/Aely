#!/usr/bin/env node
/**
 * EL WIDGET NO PUEDE CONTRADECIRSE A SÍ MISMO.
 *
 * Bug real 2026-08-17 (lo vio en el crucero): el widget enseñaba «891 € de 1.000 · te quedan 109»
 * y justo debajo «✅ Puedes gastar 324 €». Al abrir la app se ponía bien y al rato volvía a mentir.
 *
 * La causa NO era un cálculo malo: eran DOS ESCRITORES que no escribían lo mismo en las prefs del
 * widget. La app (`updateWidget`, app abierta) escribía las cinco cifras a la vez; el lector de
 * notis (`saveMonth`, app cerrada) escribía solo `spent` y `budget` y dejaba `afford`/`cash` del
 * push anterior. `build()` los pintaba juntos como si fueran del mismo momento.
 *
 * Estos tests vigilan las dos mitades del arreglo:
 *   1. Que el `budgetLeft` que manda el servidor sea el MISMO número que la app — cargando las dos
 *      implementaciones, no comparando constantes (misma filosofía que presupuesto-servidor).
 *   2. Que ningún escritor vuelva a dejarse una pieza: se lee el Java de verdad y se exige que
 *      todo lo que `build()` pinta lo mantengan LOS DOS caminos. Es el guardián que habría cazado
 *      este bug antes de llegar a su móvil.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

const srcTs = read("supabase/functions/_shared/presupuesto.ts");
const js = transformSync(srcTs, { loader: "ts", format: "esm" }).code;
const { statsDelMes, inicioDeMesMs } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const cli = loadPureLogicFromFile();

function t(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
}

console.log("widget-coherente");

const nowMs = Date.now();
const desdeMs = inicioDeMesMs(nowMs);
const ym = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Madrid", year: "numeric", month: "2-digit",
}).format(new Date(nowMs));
const d = (day) => ym + "-" + String(day).padStart(2, "0") + "T10:00:00.000Z";
const c = (n) => +Number(n).toFixed(2);

/** Su caso: TR es la cuenta de gasto diario, Sabadell los recibos, 1.000 € de presupuesto. */
function escenario(movs, extra = {}) {
  const base = {
    budget: 1000,
    accounts: [
      { ent: "trade_republic", role: "diario" },
      { ent: "sabadell", role: "fijos" },
    ],
    settings: { expenseBanks: ["trade_republic"], gTotalMode: "net" },
    reservaLog: [],
  };
  return Object.assign({}, base, extra, {
    settings: Object.assign({}, base.settings, extra.settings || {}),
    expenses: movs.map((m) => ({ date: d(m.day), amount: m.importe, category: m.cat, source: m.source })),
  });
}
const paraServidor = (m) => ({ importe: m.importe, cat: m.cat, source: m.source });

/* ── 1. La cifra que manda el servidor es la que enseña la app ─────────────────────────── */

const MOVS = [
  { day: 2, importe: 300, cat: "super", source: "macrodroid" },
  { day: 4, importe: 448.39, cat: "hogar", source: "ob:sabadell" },   // recibo → no cuenta
  { day: 5, importe: 281.89, cat: "inversion", source: "macrodroid" }, // neutra → no cuenta
  { day: 6, importe: 200, cat: "bares", source: "macrodroid" },
];

t("«te quedan» del servidor = «te quedan» de la app", () => {
  const data = escenario(MOVS);
  const srv = statsDelMes(MOVS.map(paraServidor), data, desdeMs);
  const app = cli.monthBudgetStats(data, nowMs);
  // lo que el widget guarda como budgetLeft, en cada lado
  const srvLeft = srv.budget > 0 ? c(Math.max(0, srv.budget - srv.against)) : -1;
  const appLeft = c(Math.max(0, app.remaining));
  assert.equal(srvLeft, appLeft);
  assert.equal(srvLeft, 500);   // 1.000 − (300 + 200); el recibo y la inversión no cuentan
});

t("sin presupuesto puesto el servidor manda −1, no un 0 que parezca real", () => {
  const data = escenario(MOVS, { budget: 0 });
  const srv = statsDelMes(MOVS.map(paraServidor), data, desdeMs);
  const srvLeft = srv.budget > 0 ? c(Math.max(0, srv.budget - srv.against)) : -1;
  assert.equal(srvLeft, -1);
});

t("gastar de más no deja «puedes gastar» en negativo", () => {
  const movs = MOVS.concat([{ day: 7, importe: 900, cat: "ocio", source: "macrodroid" }]);
  const data = escenario(movs);
  const srv = statsDelMes(movs.map(paraServidor), data, desdeMs);
  const srvLeft = Math.max(0, srv.budget - srv.against);
  assert.equal(srvLeft, 0);
  assert.ok(srv.against > srv.budget, "y el escenario sí se pasa de presupuesto");
});

/* ── 2. Guardián: los dos escritores mantienen todo lo que se pinta ─────────────────────── */

const widget = read("android/app/src/main/java/com/micartera/app/MiCarteraWidget.java");
const plugin = read("android/app/src/main/java/com/micartera/app/MiCarteraPlugin.java");
const listener = read("android/app/src/main/java/com/micartera/app/TrExpenseListener.java");

/** Recorta un método por su firma hasta la llave que lo cierra. */
function cuerpoDe(src, firma) {
  const i = src.indexOf(firma);
  assert.notEqual(i, -1, "no se encuentra el método: " + firma);
  let nivel = 0, empezado = false;
  for (let j = src.indexOf("{", i); j < src.length; j++) {
    if (src[j] === "{") { nivel++; empezado = true; }
    else if (src[j] === "}") { nivel--; if (empezado && nivel === 0) return src.slice(i, j + 1); }
  }
  throw new Error("método sin cerrar: " + firma);
}

const build = cuerpoDe(widget, "private static RemoteViews build(");
const saveMonth = cuerpoDe(widget, "static void saveMonth(");
const updateWidget = cuerpoDe(plugin, "public void updateWidget(");

/** Las cifras que `build()` pinta y que un gasto nuevo mueve. `cashLabel` no: es texto fijo. */
const CIFRAS_VIVAS = ["spent", "budget", "budgetLeft", "safeLiq", "cash"];

t("build() lee las primitivas, no un «afford» ya cocinado", () => {
  assert.ok(!/getFloat\("afford"/.test(build), "build() no debe leer un afford precalculado");
  assert.match(build, /Math\.min\(budgetLeft, safeLiq\)/,
    "la fórmula de «puedes gastar» tiene que vivir en build()");
  for (const k of ["budgetLeft", "safeLiq"]) {
    assert.match(build, new RegExp(`contains\\("${k}"\\)`), `build() debe mirar si hay ${k}`);
  }
});

t("la app empuja TODAS las cifras vivas", () => {
  for (const k of CIFRAS_VIVAS) {
    assert.match(updateWidget, new RegExp(`putFloat\\("${k}"`), `updateWidget no escribe ${k}`);
  }
});

t("y la noti, con la app cerrada, mantiene TODAS las cifras vivas (el bug de agosto)", () => {
  for (const k of CIFRAS_VIVAS) {
    assert.match(saveMonth, new RegExp(`putFloat\\("${k}"`),
      `saveMonth no mantiene ${k}: el widget volverá a contradecirse con la app cerrada`);
  }
});

t("no queda basura del «afford» viejo en las prefs", () => {
  assert.match(updateWidget, /remove\("afford"\)/, "hay que limpiar el afford de la versión anterior");
});

t("saveMonth distingue «el servidor no manda budgetLeft» de «te quedan 0 €»", () => {
  assert.match(saveMonth, /budgetLeft >= 0/,
    "sin sentinela, una APK nueva contra un ingest viejo pintaría «Puedes gastar 0 €»");
  assert.match(listener, /optDouble\("budgetLeft", -1\)/, "el lector debe pedir la sentinela −1");
});

t("un ingreso no baja el saldo del widget", () => {
  // `ingest` manda los ingresos en negativo, así que restar el importe los SUMA. Lo que no puede
  // pasar es que se filtre por «> 0» y un ingreso deje el saldo por debajo de lo real.
  assert.match(saveMonth, /importe != 0/, "saveMonth debe mover el saldo también con ingresos");
  assert.ok(!/importe > 0/.test(saveMonth), "filtrar por > 0 se come los ingresos");
});

t("el servidor manda las dos piezas nuevas", () => {
  const ingest = read("supabase/functions/ingest/index.ts");
  assert.match(ingest, /budgetLeft:/, "ingest debe mandar budgetLeft");
  assert.match(ingest, /counts:/, "ingest debe decir si el gasto cuenta para el presupuesto");
});

/* ── 3. La contradicción de su captura, reproducida ─────────────────────────────────────── */

t("reproducción: 891 gastado y «puedes gastar 324» ya no pueden convivir", () => {
  /* Modelo de las prefs tal como quedan ahora. `spent` y `budgetLeft` los escribe el MISMO
     mensaje del servidor, así que no pueden venir de dos momentos distintos — que es justo lo
     que pasaba antes con `spent` (noti) y `afford` (push viejo de la app). */
  const budget = 1000;
  const prefs = { spent: 676, budget, budgetLeft: 324, safeLiq: 6308, cash: 6308 };
  const afford = () => Math.min(prefs.budgetLeft, prefs.safeLiq);
  assert.equal(budget - prefs.spent, afford(), "de partida ya cuadra");

  // llega una noti de 215 € con la app cerrada: el servidor recalcula, el nativo baja el saldo
  const importe = 215;
  prefs.spent = 891;
  prefs.budgetLeft = Math.max(0, budget - 891);
  prefs.safeLiq = Math.max(0, prefs.safeLiq - importe);
  prefs.cash -= importe;

  assert.equal(prefs.budgetLeft, 109);
  assert.equal(afford(), 109, "«puedes gastar» tiene que seguir a «te quedan», no quedarse en 324");
  assert.equal(budget - prefs.spent, afford(), "las dos líneas del widget siguen cuadrando");
});

console.log("  ok");
