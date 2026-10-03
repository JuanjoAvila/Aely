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
const { statsDelMes, inicioDeMesMs, filasComoLaApp } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
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

// El primer día del mes los días2/3 del fixture serían futuros y no probarían ningún ciclo.
const nowMs = Date.parse("2026-09-27T12:00:00Z");
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

/* Sin entrega propia de ingest, cambiar el payload de APK51 haría alternar dos magnitudes
   al cerrar/reabrir. El contrato legado se conserva incluso mientras v2 tiene otra foto. */
t("APK51 conserva el contrato legado de ingest en Balance con nómina", () => {
  const movs = MOVS.concat([{ day: 3, importe: -1800, cat: "ingreso", source: "ob:trade_republic" }]);
  const data = escenario(movs);
  const srv = statsDelMes(movs.map(paraServidor), data, desdeMs);
  const app = cli.monthBudgetStats(data, nowMs);
  assert.equal(c(app.shown), 1300, "se preserva la cifra histórica hasta entrega propia del contrato");
  assert.equal(c(srv.shown), c(app.shown));
  assert.equal(c(Math.max(0, srv.budget - srv.against)), c(Math.max(0, app.remaining)));
  assert.equal(c(app.remaining), 2300);
  // La cabecera de Gastos en Balance sigue con su contrato: el widget ya no la copia.
  assert.equal(c(cli.monthBudgetStats(data, nowMs).shown), 1300);
  assert.equal(c(statsDelMes(movs.map(paraServidor), data, desdeMs).shown), 1300, "sin modo forzado, el servidor conserva la regla de Gastos");
});

t("★ el widget va por mes natural aunque Mi ciclo esté activo (sus textos dicen «ESTE MES»)", () => {
  const movs = MOVS.concat([{ day: 3, importe: -1800, cat: "ingreso", source: "ob:trade_republic" }]);
  const data = escenario(movs, { settings: { budgetCycle: true } });
  assert.equal(cli.monthBudgetStats(data, nowMs).periodStart, desdeMs);
  assert.equal(cli.monthBudgetStats(data, nowMs).cycle, false);
});

/* La foto v2 se entrega separada del servidor. Su alcance tiene que cambiar cuando cambia
   una regla financiera aunque el periodo sea el mismo, sin depender del idioma ni del reloj. */
t("v2 usa el ciclo de Inicio y vincula presupuesto, ancla y bancos al alcance", () => {
  const movs = [
    { day: 2, importe: 300, cat: "super", source: "macrodroid" },
    { day: 3, importe: -1800, cat: "ingreso", source: "ob:trade_republic", merchant: "NOMINA EMPRESA" },
    { day: 4, importe: 120, cat: "bares", source: "macrodroid" },
  ];
  const data = escenario(movs, { settings: { budgetCycle: true, gTotalMode: "split" } });
  data.expenses.forEach((e, i) => { if (movs[i].merchant) e.merchant = movs[i].merchant; });
  const RealDate = cli.Date;
  try {
    cli.Date = class extends RealDate { static now() { return nowMs; } };
    const app = cli.dashboardBudgetStats(data);
    assert.equal(app.cycle, true, "la nómina abre el ciclo");
    const anchor = cli.keyOfExpense(cli.budgetPaydayOf(data, nowMs).inc);
    const scope = cli.widgetScopeOf(data,app,anchor,"trade_republic");
    assert.equal(scope,cli.widgetScopeOf(data,app,anchor,"trade_republic"));
    assert.notEqual(scope,cli.widgetScopeOf(data,app,anchor,"sabadell"));
    assert.notEqual(scope,cli.widgetScopeOf({...data,settings:{...data.settings,expenseBanks:["sabadell"]}},app,anchor,"trade_republic"));
    assert.notEqual(scope,cli.widgetScopeOf(data,{...app,budget:900},anchor,"trade_republic"));
    assert.notEqual(scope,cli.widgetScopeOf(data,app,"otra-nomina","trade_republic"));
    assert.equal(c(app.against), 120, "la nómina abre el ciclo y no suma; la compra del día 2 es del anterior");
  } finally { cli.Date = RealDate; }
});

t("FIN-05: las mismas lápidas y filas dan el mismo presupuesto antes y después del pago", () => {
  const rows = [
    { id: "live", fecha: d(2), importe: 181, cat: "super", source: "macrodroid", comercio: "Compra ficticia" },
    { id: "gone-out", fecha: d(3), importe: 3, cat: "bares", source: "ob:trade_republic", comercio: "Borrado ficticio" },
    { id: "gone-in", fecha: d(4), importe: -15, cat: "ingreso", source: "ob:trade_republic", comercio: "Ingreso borrado" },
    { id: "gone-neutral", fecha: d(5), importe: -250, cat: "traspaso", source: "ob:trade_republic", comercio: "Traspaso borrado" },
    { id: "pending", fecha: d(6), importe: 22, cat: "otros", source: "ob:trade_republic#dup", comercio: "Candidato ficticio" },
  ];
  const data = escenario([], { settings: { gTotalMode: "net" } });
  data.expenses = rows.map((r) => cli.expenseFromRow(r));
  data.deleted = data.expenses.slice(1, 4).map((e) => cli.keyOfExpense(e));
  const original = JSON.stringify(data), expensesRef = data.expenses, deletedRef = data.deleted;
  const before = cli.monthBudgetStats(data, nowMs);
  // El helper servidor filtra lápidas antes de stats; no se borra ninguna fila del fixture.
  const visible = filasComoLaApp(rows, data.deleted);
  const beforeServer = statsDelMes(visible, data, desdeMs);
  assert.equal(before.remaining, beforeServer.budget - beforeServer.against);
  assert.equal(before.remaining, 819);
  for (const e of data.expenses.slice(1, 4)) assert.equal(cli.expenseCountsBudget(e, data), false);
  assert.equal(cli.expenseCountsBudget(data.expenses[4], data), false);
  const pay = { id: "pay", fecha: d(7), importe: 5.45, cat: "super", source: "macrodroid", comercio: "Pago ficticio" };
  const after = cli.monthBudgetStats({ ...data, expenses: data.expenses.concat(cli.expenseFromRow(pay)) }, nowMs);
  const afterServer = statsDelMes(visible.concat(pay), data, desdeMs);
  assert.equal(c(after.remaining), 813.55);
  assert.equal(c(after.remaining), afterServer.budget - afterServer.against);
  assert.equal(c(before.remaining - after.remaining), 5.45);
  assert.equal(data.expenses, expensesRef);
  assert.equal(data.deleted, deletedRef);
  assert.equal(JSON.stringify(data), original);
});

/* ── 2. Guardián: los dos escritores mantienen todo lo que se pinta ─────────────────────── */
t("lápidas manuales respetan UUID, compatibilidad antigua y deshacer por copia", () => {
  const a = { id: "manual-a", date: d(2), amount: 10, merchant: "Manual ficticio", category: "super", source: "manual" };
  const b = { ...a, id: "manual-b" };
  const data = escenario([]);
  data.deleted = [cli.keyOfExpense(a)];
  assert.equal(cli.expenseCountsBudget(a, data), false);
  assert.equal(cli.expenseCountsBudget(b, data), true);
  assert.equal(cli.expenseCountsBudget(a, { ...data, deleted: [] }), true);
  assert.equal(cli.expenseCountsBudget(a, data), false);
  assert.equal(cli.expenseCountsBudget(b, { ...data, deleted: data.deleted.concat(cli.keyOfExpense(b)) }), false);
  assert.equal(cli.expenseCountsBudget(b, data), true);
  const legacy = { ...data, deleted: [cli.keyOfExpenseLegacy(a)] };
  assert.equal(cli.expenseCountsBudget(a, legacy), false);
  assert.equal(cli.expenseCountsBudget(b, legacy), false);
  assert.equal(cli.expenseCountsBudget(a, { ...data, deleted: null }), true);
  assert.equal(cli.expenseCountsBudget(a, { ...data, deleted: undefined }), true);
});

t("las lápidas de presupuesto no alteran los insumos ni las bases del saldo", () => {
  const data = escenario([{ day: 2, importe: 181, cat: "super", source: "macrodroid" },
    { day: 3, importe: -250, cat: "traspaso", source: "ob:trade_republic" }]);
  data.accounts[0].spendFrom = true;
  data.accounts[0].value = 2000;
  const baseline = cli.insumosSaldoGasto(data);
  const withDeleted = { ...data, deleted: data.expenses.map(cli.keyOfExpense) };
  assert.deepEqual(cli.insumosSaldoGasto(withDeleted), baseline);
  assert.equal(withDeleted.accounts, data.accounts);
  assert.equal(cli.monthBudgetStats(withDeleted, nowMs).spent, 0);
  assert.equal(cli.monthBudgetStats(data, nowMs).spent, 181);
});

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
const saveMonth = cuerpoDe(widget, "static synchronized void saveMonth(");
const saveApp = cuerpoDe(widget, "static synchronized void saveApp(");
const readPrefs = cuerpoDe(widget, "private static WidgetSnapshotArbiter.State read(");
const write = cuerpoDe(widget, "private static void write(");
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
  assert.match(updateWidget, /MiCarteraWidget\.saveApp\(/);
  assert.match(saveApp, /WidgetSnapshotArbiter\.app\(/);
  for (const k of CIFRAS_VIVAS) assert.match(write, new RegExp(`putFloat\\("${k}"`));
});

t("y la noti, con la app cerrada, mantiene TODAS las cifras vivas (el bug de agosto)", () => {
  assert.match(saveMonth, /WidgetSnapshotArbiter\.ingest\(/);
  assert.match(saveMonth, /write\(ed, s\)/);
  assert.match(listener, /MiCarteraWidget\.saveMonth\(/);
});

t("el evento rechazado persiste entre procesos y requiere evidencia del mismo alcance",()=>{
  assert.match(readPrefs,/s\.unknownJournal = p\.getString\("unknownJournal", ""\)/);
  assert.match(write,/putString\("unknownJournal", s\.unknownJournal\)/);
  assert.match(saveMonth,/WidgetPeriod\.sameScope\(p\.getString\("scope", ""\), respScope\)/);
  assert.match(saveMonth,/write\(ed, s\)/);
});

t("no queda basura del «afford» viejo en las prefs", () => {
  assert.match(write, /remove\("afford"\)/, "hay que limpiar el afford de la versión anterior");
});

t("al instalar sobre la APK anterior no vuelve a restar el saldo ya neto", () => {
  assert.match(readPrefs, /getFloat\("cashDelta", 0\)/);
  assert.doesNotMatch(readPrefs, /getFloat\("cashDelta",\s*p\.getFloat\("delta"/,
    "el cash antiguo ya incluía su delta y heredarlo lo cobraría dos veces");
});

t("con la Edge anterior usa el ACK antes del evento crudo", () => {
  const ident = listener.slice(listener.indexOf('String widgetEvent = month.optString("eventKey"'),
    listener.indexOf("MiCarteraWidget.saveMonth("));
  assert.match(ident, /widgetEvent = r\.optString\("ack", ""\)/,
    "la Edge antigua entrega el ID de fila en ack");
  assert.ok(ident.indexOf('r.optString("ack", "")') < ident.indexOf("widgetEvent = event"),
    "el evento crudo no lleva el prefijo de ingest_event_id; va detrás del ACK");
});

t("saveMonth distingue «el servidor no manda budgetLeft» de «te quedan 0 €»", () => {
  const arbiter = read("android/app/src/main/java/com/micartera/app/WidgetSnapshotArbiter.java");
  assert.match(arbiter, /budgetLeft >= 0/,
    "sin sentinela, una APK nueva contra un ingest viejo pintaría «Puedes gastar 0 €»");
  assert.match(listener, /optDouble\("budgetLeft", -1\)/, "el lector debe pedir la sentinela −1");
});

t("un ingreso no baja el saldo del widget", () => {
  // `ingest` manda los ingresos en negativo, así que restar el importe los SUMA. Lo que no puede
  // pasar es que se filtre por «> 0» y un ingreso deje el saldo por debajo de lo real.
  const arbiter = read("android/app/src/main/java/com/micartera/app/WidgetSnapshotArbiter.java");
  assert.match(arbiter, /amount != 0/, "el árbitro debe mover el saldo también con ingresos");
  assert.ok(!/amount > 0/.test(arbiter), "filtrar por > 0 se come los ingresos");
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

// Ejecuta la negociación real con reloj controlado: un timeout no concede contrato antiguo.
const negotiationSource=read("src/modules/11-app-main.js").split("const [wV2,setWV2]=useState(null);")[1]
  .match(/useEffect\(function\(\)\{([\s\S]*?)\},\[\]\);/)[1];
const timers=new Map(), values=[]; let timerId=0, requests=0, waiting=0;
const cleanup=new Function("natPlugin","setWV2","setTimeout","clearTimeout",negotiationSource)(
  ()=>({widgetContract:()=>++requests===1?new Promise(()=>{}):Promise.resolve({v:2}),widgetWaiting:()=>{waiting++;return Promise.resolve();}}),
  v=>values.push(v),(fn)=>{timers.set(++timerId,fn);return timerId;},id=>timers.delete(id));
const drain=async()=>{for(let i=0;i<6;i++) await Promise.resolve();};
await drain(); const tick=()=>{const [id,fn]=timers.entries().next().value;timers.delete(id);fn();};
tick(); await drain(); assert.deepEqual(values,[]); assert.equal(waiting,1);
tick(); await drain(); assert.deepEqual(values,[true]); assert.equal(requests,2); cleanup();
assert.match(saveApp,/if \(!WidgetPeriod.clientV2\(contract\)\) \{ waiting\(ctx\); return; \}/);
assert.match(build,/p.getBoolean\("negotiating", false\)/);
assert.match(saveApp,/putBoolean\("negotiating", false\)/);
console.log("  ✓ puente colgado: aviso, retry y contrato v2 sin fallback que degrade la foto");
// INC-0210-04: el texto observado acota el diagnóstico a un bloqueo de seguridad,
// no a la caducidad de la ventana ni a la pérdida de la última foto numérica.
assert.match(build,/p\.getBoolean\("journalFull", false\) \|\| p\.getBoolean\("unknownPending", false\)/);
assert.match(build,/\|\| p\.getBoolean\("negotiating", false\)/);
assert.match(build,/mesDistinto \? t\[WidgetPeriod\.SIN_DATOS\] : t\[WidgetPeriod\.ABRE_APP\]/);
assert.match(build,/mesDistinto \|\| sinDato \? "—" : eur0\(spent\)/);
assert.match(saveMonth,/WidgetSnapshotArbiter\.pendingUnknown\(s, event, expenseKey\)/);
console.log("  ✓ guion y aviso: solo bloqueo explícito; la ventana caducada usa otro texto");
console.log("  ok");
