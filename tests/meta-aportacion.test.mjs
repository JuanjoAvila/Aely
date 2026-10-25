#!/usr/bin/env node
/**
 * «ES APORTACIÓN A LA META X» EN LA FICHA DE UN GASTO (decisión del dueño, 24/10/2026).
 *
 * Un cargo del banco que en realidad es dinero que va a una meta (la transferencia a la hucha del
 * viaje) se marca desde su ficha: sale en Gastos en la fila gris «Metas · no cuentan», deja de
 * comerse el gasto del mes y el presupuesto, y suma al progreso de la meta. Toca dinero, así que
 * el oráculo de este test NO usa la app: las cifras esperadas están escritas a mano en CÉNTIMOS a
 * partir de la tabla de abajo, y se comprueba la app (Inicio/Gastos/categorías/cifra del día) y el
 * servidor del widget (`statsDelMes`) contra ese mismo número.
 *
 * Reglas que vigila:
 *   1. Una marca por gasto: una cuota de deuda, un cargo de recibo, un posible repetido, un apunte a
 *      mano o un ingreso no se pueden marcar.
 *   2. El progreso = lo ahorrado de la meta + lo marcado, calculado al vuelo: `saved` no se toca.
 *   3. Quitar la marca devuelve el gasto, las cifras y la meta a como estaban.
 *   4. App y servidor dan la misma cifra con la marca puesta y sin ella.
 *   5. La marca viaja en `source` (`ob:<ent>~meta.<id>`) y vuelve de la nube; mientras la escritura
 *      no se confirma, un pull viejo no la deshace, y una retirada hecha en el otro móvil sí llega.
 */
import assert from "node:assert/strict";
import { mock } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";
import vm from "node:vm";
import { loadPureLogicFromFile, extractPureLogicSource, createLogicSandbox } from "../scripts/load-pure-logic.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const srvSrc = fs.readFileSync(path.join(root, "supabase/functions/_shared/presupuesto.ts"), "utf8");
const srvJs = transformSync(srvSrc, { loader: "ts", format: "esm" }).code;
const srv = await import("data:text/javascript;base64," + Buffer.from(srvJs).toString("base64"));
// Mediados de mes a mediodía de Madrid: ningún apunte cae en la frontera de mes, ni en CI (UTC).
mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-15T10:00:00Z") });
const cli = loadPureLogicFromFile();

function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}`); throw e; }
}
const cents = (x) => Math.round(Number(x) * 100);

console.log("meta-aportacion");

/* LA TABLA (octubre de 2026, TR = gasto diario, Sabadell = recibos):
     e-compra   TR       12,34 €  súper            cuenta
     e-hucha    TR      250,00 €  otros            la que se marca como aportación a «Viaje»
     e-mano     a mano    7,66 €  ocio             cuenta
     e-sab      Sabadell 40,00 €  otros            no es del día a día: no cuenta nunca
     e-cuota    TR       99,00 €  deudas + deuda   cuota: no cuenta y no admite marca
   Presupuesto 800 €. Meta «Viaje»: 100 € ahorrados a mano, objetivo 1.000 €.
   Sin marca:  gastado 12,34 + 250,00 + 7,66 = 270,00 € → quedan 530,00 €; meta 100 € (10 %).
   Con marca:  gastado 12,34 + 7,66        =  20,00 € → quedan 780,00 €; meta 350 € (35 %). */
const GASTADO_SIN = 27000, GASTADO_CON = 2000, PRESUPUESTO = 80000;
const META_SIN = 10000, META_CON = 35000;

function estado(extra = {}) {
  return Object.assign({
    budget: 800,
    accounts: [
      { id: "a1", ent: "sabadell", role: "fijos", value: 3000 },
      { id: "a2", ent: "trade_republic", role: "diario", value: 900 },
    ],
    settings: { expenseBanks: ["trade_republic"], gTotalMode: "split" },
    fixed: [], oneoffs: [], flows: [], reservaLog: [],
    debts: [{ id: "robot", name: "Robot", value: 900, monthly: 99, account: "trade_republic", day: 3 }],
    goals: [
      { id: "viaje", name: "Viaje", emoji: "✈️", target: 1000, saved: 100, done: false },
      { id: "coche", name: "Coche", emoji: "🚗", target: 500, saved: 500, done: true },
    ],
    expenses: [
      { id: "e-compra", date: "2026-10-03T10:00:00.000Z", merchant: "Mercadona", amount: 12.34, category: "super", source: "ob", ent: "trade_republic", extId: "r1" },
      { id: "e-hucha", date: "2026-10-05T10:00:00.000Z", merchant: "Traspaso hucha", amount: 250, category: "otros", source: "ob", ent: "trade_republic", extId: "r2" },
      { id: "e-mano", date: "2026-10-06T10:00:00.000Z", merchant: "Cine", amount: 7.66, category: "ocio", source: "manual" },
      { id: "e-sab", date: "2026-10-07T10:00:00.000Z", merchant: "Sabadell", amount: 40, category: "otros", source: "ob", ent: "sabadell", extId: "r3" },
      { id: "e-cuota", date: "2026-10-03T11:00:00.000Z", merchant: "Robot", amount: 99, category: "deudas", debtId: "robot", source: "ob", ent: "trade_republic", extId: "r4" },
    ],
  }, extra);
}
const gasto = (s, id) => s.expenses.find((e) => e.id === id);
const meta = (s, id) => s.goals.find((g) => g.id === id);

/* Lo que diría el servidor del widget leyendo la tabla tal cual la dejó la app. */
function servidor(s) {
  const filas = s.expenses.map((e) => ({ fecha: e.date, importe: e.amount, comercio: e.merchant, cat: e.category, source: cli.expenseSourceForCloud(e) }));
  const desde = cli.monthBudgetStats(s).periodStart;
  return srv.statsDelMes(filas, s, desde);
}
/* Todas las caras de la cifra del mes: Inicio, Gastos (cabecera, por categoría, por día) y el widget. */
function cifras(s) {
  const bs = cli.monthBudgetStats(s);
  const ini = cli.dashboardBudgetStats(s);
  const cats = cli.categorySpentByMonth(s).reduce((a, r) => a + cents(r.spent), 0);
  const per = cli.budgetPeriodOf(s);
  const dias = cli.gastosCifraDias(s, s.expenses, per, per.startMs, Infinity, false);
  let porDia = 0; for (const k of Object.keys(dias.days)) porDia += cents(dias.days[k].sp);
  const w = servidor(s);
  return { gastos: cents(bs.spent), quedan: cents(bs.remaining), inicio: cents(ini.spent), cats, porDia, widget: cents(w.spent), widgetBudget: cents(w.budget) };
}

t("sin marca: todas las caras dicen 270,00 € gastados y quedan 530,00 €", () => {
  const c = cifras(estado());
  assert.deepEqual(c, { gastos: GASTADO_SIN, quedan: PRESUPUESTO - GASTADO_SIN, inicio: GASTADO_SIN, cats: GASTADO_SIN, porDia: GASTADO_SIN, widget: GASTADO_SIN, widgetBudget: PRESUPUESTO });
});

let marcado;
t("marcar «Traspaso hucha» como aportación a «Viaje»: la fila cambia solo en la marca", () => {
  const s0 = estado();
  const r = cli.marcarAportacionMeta(s0, "e-hucha", "viaje");
  assert.ok(r && r.state && r.e, "debe devolver {state, e}");
  const antes = gasto(s0, "e-hucha"), despues = gasto(r.state, "e-hucha");
  assert.equal(despues.goalId, "viaje");
  assert.equal(despues.category, antes.category, "no cambia la categoría");
  assert.equal(despues.amount, antes.amount);
  assert.equal(r.e, despues, "lo que se sube es la fila nueva");
  assert.equal(gasto(s0, "e-hucha").goalId, undefined, "puro: no muta el estado de entrada");
  assert.equal(meta(r.state, "viaje").saved, 100, "lo ahorrado a mano NO se reescribe");
  assert.equal(r.state.goals, s0.goals, "las metas ni se tocan");
  marcado = r.state;
});

t("con marca: todas las caras dicen 20,00 € gastados y quedan 780,00 €", () => {
  const c = cifras(marcado);
  assert.deepEqual(c, { gastos: GASTADO_CON, quedan: PRESUPUESTO - GASTADO_CON, inicio: GASTADO_CON, cats: GASTADO_CON, porDia: GASTADO_CON, widget: GASTADO_CON, widgetBudget: PRESUPUESTO });
});

t("con marca: el cargo sigue restando del saldo (no se saca del efectivo) y va al cajón «meta»", () => {
  const e = gasto(marcado, "e-hucha");
  assert.equal(cli.expenseCountsCash(e, marcado), true);
  assert.equal(cli.expenseCountsBudget(e, marcado), false);
  assert.equal(cli.expenseBucket(e, marcado), "meta");
  assert.equal(cli.expenseBucket(gasto(estado(), "e-hucha"), estado()), "cuenta");
});

t("el progreso de «Viaje» pasa de 100 € a 350 € (10 % → 35 %), calculado al vuelo", () => {
  const s0 = estado();
  assert.equal(cents(cli.metaAhorrado(meta(s0, "viaje"), s0)), META_SIN);
  assert.equal(cents(cli.metaAhorrado(meta(marcado, "viaje"), marcado)), META_CON);
  const v = cli.metaConAportes(meta(marcado, "viaje"), marcado);
  assert.equal(cents(v.saved), META_CON);
  assert.equal(cents(v.aportado), 25000);
  assert.equal(Math.round(cli.goalPct(v)), 35);
  assert.equal(cents(cli.goalRemaining(v)), 100000 - META_CON);
  assert.equal(meta(marcado, "viaje").saved, 100, "la vista derivada no escribe en la meta");
  // Otra meta no se lleva nada.
  assert.equal(cents(cli.metaAhorrado(meta(marcado, "coche"), marcado)), 50000);
});

t("lo marcado no se cuenta dos veces: un repetido pendiente o una fila borrada no suman", () => {
  const dup = Object.assign({}, gasto(marcado, "e-hucha"), { id: "e-hucha-2", possibleDup: true });
  const s = Object.assign({}, marcado, { expenses: marcado.expenses.concat([dup]) });
  assert.equal(cents(cli.metaAhorrado(meta(s, "viaje"), s)), META_CON);
  const borrado = Object.assign({}, marcado, { deleted: [cli.keyOfExpense(gasto(marcado, "e-hucha"))] });
  assert.equal(cents(cli.metaAhorrado(meta(borrado, "viaje"), borrado)), META_SIN);
});

t("quitar la marca devuelve gasto, cifras y meta a como estaban", () => {
  const r = cli.marcarAportacionMeta(marcado, "e-hucha", null);
  assert.ok(r && r.state);
  const s = r.state;
  assert.deepEqual(cifras(s), cifras(estado()));
  assert.equal(cents(cli.metaAhorrado(meta(s, "viaje"), s)), META_SIN);
  // Tras el acuse de la nube la fila es la de antes, campo a campo.
  const ack = cli.ackMetaWrite(s.expenses, r.e, null);
  const fila = ack.find((e) => e.id === "e-hucha");
  assert.deepEqual(JSON.parse(JSON.stringify(fila)), gasto(estado(), "e-hucha"));
});

t("una marca por gasto: cuota, recibo, repetido, a mano, ingreso o meta cumplida no se marcan", () => {
  const s = estado();
  assert.equal(cli.marcarAportacionMeta(s, "e-cuota", "viaje"), null, "cuota de deuda");
  const conRecibo = Object.assign({}, s, { fixed: [{ id: "luz", name: "Luz", amount: 250, account: "trade_republic", day: 5 }],
    expenses: s.expenses.map((e) => e.id === "e-hucha" ? Object.assign({}, e, { reciboId: "luz" }) : e) });
  assert.equal(cli.marcarAportacionMeta(conRecibo, "e-hucha", "viaje"), null, "cargo de recibo");
  const conDup = Object.assign({}, s, { expenses: s.expenses.map((e) => e.id === "e-hucha" ? Object.assign({}, e, { possibleDup: true }) : e) });
  assert.equal(cli.marcarAportacionMeta(conDup, "e-hucha", "viaje"), null, "posible repetido");
  assert.equal(cli.marcarAportacionMeta(s, "e-mano", "viaje"), null, "apunte a mano");
  const conIngreso = Object.assign({}, s, { expenses: s.expenses.map((e) => e.id === "e-hucha" ? Object.assign({}, e, { amount: -250 }) : e) });
  assert.equal(cli.marcarAportacionMeta(conIngreso, "e-hucha", "viaje"), null, "ingreso");
  assert.equal(cli.marcarAportacionMeta(s, "e-hucha", "coche"), null, "meta cumplida");
  assert.equal(cli.marcarAportacionMeta(s, "e-hucha", "no-existe"), null, "meta que no existe");
  assert.equal(cli.metaAdmiteMarca(gasto(s, "e-hucha")), true);
  assert.equal(cli.metaAdmiteMarca(gasto(s, "e-cuota")), false);
  // Y al revés: una fila marcada como aportación no la reclama el motor como cuota ni como recibo.
  const e = gasto(marcado, "e-hucha");
  assert.equal(cli.admiteMarcaDe(e, { id: "luz", account: "trade_republic" }), false);
});

t("la marca viaja en `source` y vuelve de la nube igual (ob y ob-hist)", () => {
  const e = gasto(marcado, "e-hucha");
  const src = cli.expenseSourceForCloud(e);
  assert.match(src, /^ob:trade_republic~meta\.viaje#ref/);
  const back = cli.expenseFromRow({ id: "x", fecha: e.date, comercio: e.merchant, importe: e.amount, cat: e.category, source: src });
  assert.equal(back.goalId, "viaje");
  assert.equal(back.ent, "trade_republic");
  assert.equal(back.debtId, undefined);
  assert.equal(back.reciboId, undefined);
  assert.equal(cli.expenseBankOf(back), "trade_republic");
  const hist = Object.assign({}, e, { source: "ob-hist" });
  const back2 = cli.expenseFromRow({ id: "y", fecha: e.date, comercio: e.merchant, importe: e.amount, cat: e.category, source: cli.expenseSourceForCloud(hist) });
  assert.equal(back2.goalId, "viaje");
  assert.equal(back2.source, "ob-hist");
  // Si una fila llegara con dos marcas, gana la deuda y luego el recibo: la meta no se lee.
  const dos = cli.expenseFromRow({ id: "z", fecha: e.date, comercio: e.merchant, importe: 1, cat: "otros", source: "ob:trade_republic~meta.viaje~recibo.luz" });
  assert.equal(dos.reciboId, "luz");
  assert.equal(dos.goalId, undefined);
  // El servidor la deja fuera; sin marca, la cuenta.
  assert.equal(srv.cuentaParaPresupuesto({ fecha: e.date, importe: 250, cat: "otros", source: src }, ["trade_republic"]), false);
  assert.equal(srv.cuentaParaPresupuesto({ fecha: e.date, importe: 250, cat: "otros", source: "ob:trade_republic" }, ["trade_republic"]), true);
  assert.equal(srv.esAportacionAMeta(src), true);
  assert.equal(srv.esAportacionAMeta("ob:trade_republic~recibo.luz"), false);
  assert.equal(srv.bancoDeSource(src), "trade_republic");
});

t("pull: mientras la escritura no se confirma, la nube vieja no deshace la marca; el acuse la suelta", () => {
  const local = gasto(marcado, "e-hucha");
  assert.equal(local.metaPend, true, "recién marcada queda pendiente de acuse");
  const sinMarca = Object.assign({}, gasto(estado(), "e-hucha"));
  assert.equal(cli.refreshExpenseFromCloud(local, sinMarca).goalId, "viaje");
  const conMarca = Object.assign({}, sinMarca, { goalId: "viaje" });
  const conf = cli.refreshExpenseFromCloud(local, conMarca);
  assert.equal(conf.goalId, "viaje");
  assert.equal(conf.metaPend, undefined, "la nube ya la tiene: deja de protegerse");
  const ack = cli.ackMetaWrite(marcado.expenses, local, "viaje").find((e) => e.id === "e-hucha");
  assert.equal(ack.metaPend, undefined);
  assert.equal(ack.goalId, "viaje");
});

t("pull: la marca puesta o quitada en el otro móvil llega a este", () => {
  const limpia = gasto(estado(), "e-hucha");
  const llega = cli.refreshExpenseFromCloud(limpia, Object.assign({}, limpia, { goalId: "viaje" }));
  assert.equal(llega.goalId, "viaje");
  const confirmada = Object.assign({}, limpia, { goalId: "viaje" });
  const quitada = cli.refreshExpenseFromCloud(confirmada, Object.assign({}, limpia));
  assert.equal(quitada.goalId, undefined);
  // Y si nada cambia, la misma fila (sin re-render ni reescritura del histórico).
  assert.equal(cli.refreshExpenseFromCloud(confirmada, Object.assign({}, confirmada)), confirmada);
});

t("pull entero (`mergeExpensesFromCloud`): pendiente se queda; confirmada y quitada en la nube, se quita", () => {
  const fila = (s) => ({ id: "nube-1", fecha: "2026-10-05T10:00:00.000Z", comercio: "Traspaso hucha", importe: 250, cat: "otros", source: s });
  const lee = (lista, s) => cli.mergeExpensesFromCloud(lista, [cli.expenseFromRow(fila(s))], Date.now()).list.filter((e) => e.merchant === "Traspaso hucha");
  // Recién marcada aquí y la nube aún sin enterarse: sigue marcada, y es UNA fila.
  const pend = lee(marcado.expenses, "ob:trade_republic#refr2");
  assert.equal(pend.length, 1);
  assert.equal(pend[0].goalId, "viaje");
  // Confirmada (sin `metaPend`) y el otro móvil la quitó: llega quitada, y la cifra vuelve a 270.
  const confirmada = cli.ackMetaWrite(marcado.expenses, gasto(marcado, "e-hucha"), "viaje");
  const tras = cli.mergeExpensesFromCloud(confirmada, [cli.expenseFromRow(fila("ob:trade_republic#refr2"))], Date.now()).list;
  assert.equal(tras.filter((e) => e.merchant === "Traspaso hucha").length, 1);
  assert.equal(tras.find((e) => e.merchant === "Traspaso hucha").goalId, undefined);
  assert.equal(cents(cli.monthBudgetStats(Object.assign({}, marcado, { expenses: tras })).spent), GASTADO_SIN);
});

t("una meta con gastos marcados no se borra a ciegas", () => {
  assert.equal(cli.metaTieneAportes(marcado, "viaje"), true);
  assert.equal(cli.metaTieneAportes(estado(), "viaje"), false);
});

/* LA NUBE: el cliente REAL de la app (`cloud.setExpenseMeta`) contra una tabla en memoria. El id
   de la fila en la nube no es el del móvil (lo subió otro): se busca por fecha, importe y comercio,
   como la marca del recibo. Devuelve cuántas filas quedan como dice el gasto: sin eso no hay acuse. */
async function tt(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}`); throw e; }
}
const src = (f) => fs.readFileSync(path.join(root, f), "utf8");
const appJs = JSON.parse(src("src/build-order.json")).map((f) => src("src/modules/" + f)).join(String.fromCharCode(10));
function nubeFalsa(filas) {
  const tabla = filas.map((f, i) => Object.assign({ id: "nube" + i, user_id: "u1" }, f)), log = [];
  const consulta = (hace) => { const conds = []; const q = {
    eq(col, val) { conds.push([col, val]); return q; },
    select() { return q; },
    then(ok, ko) {
      const hit = tabla.filter((r) => conds.every(([col, v]) => col === "fecha" ? Date.parse(r[col]) === Date.parse(v) : col === "importe" ? Number(r[col]) === Number(v) : r[col] === v));
      return Promise.resolve({ data: hace(hit), error: null }).then(ok, ko);
    } }; return q; };
  const from = () => ({
    select(cols) { return consulta((hit) => { log.push("lee " + hit.length); return hit.map((r) => Object.fromEntries(cols.split(",").map((k) => [k, r[k]]))); }); },
    update(patch) { return consulta((hit) => { log.push("cambia " + hit.length); hit.forEach((r) => Object.assign(r, patch)); return hit.map((r) => ({ id: r.id })); }); },
  });
  return { tabla, log, client: { auth: { getSession: async () => ({ data: { session: { user: { id: "u1" }, expires_at: 9e9 } }, error: null }), onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; } }, from } };
}
function appConNube(n) {
  const sb = createLogicSandbox(); sb.window.supabase = { createClient: () => n.client };
  vm.runInNewContext(extractPureLogicSource(src("src/shell.html").replace("<!--MC_APP_SCRIPT-->", () => appJs)), sb);
  assert.equal(vm.runInContext("cloud.enabled()", sb), true, "la nube falsa está enganchada");
  return sb;
}
const HUCHA = gasto(marcado, "e-hucha");
const FILA = { fecha: HUCHA.date, importe: 250, comercio: HUCHA.merchant, cat: "otros" };
for (const [caso, antes, despues, n, peticiones] of [
  ["sin marca en la nube: la pone y conserva lo de detrás", "ob:trade_republic#refr2#n2", "ob:trade_republic~meta.viaje#refr2#n2", 1, ["lee 1", "cambia 1"]],
  ["de Importar histórico: conserva su origen", "ob-hist:trade_republic", "ob-hist:trade_republic~meta.viaje", 1, ["lee 1", "cambia 1"]],
  ["ya la tenía: no escribe y lo da por confirmado", "ob:trade_republic~meta.viaje#refr2", "ob:trade_republic~meta.viaje#refr2", 1, ["lee 1"]],
  ["en la nube es cuota de una deuda: no se toca (una marca por gasto)", "ob:trade_republic~deuda.robot", "ob:trade_republic~deuda.robot", 0, ["lee 1"]],
  ["en la nube es cargo de un recibo: no se toca", "ob:trade_republic~recibo.luz", "ob:trade_republic~recibo.luz", 0, ["lee 1"]],
  ["es un aviso del móvil con los mismos datos: no se toca", "macrodroid", "macrodroid", 0, ["lee 1"]],
  ["es un gasto a mano con los mismos datos: no se toca", "manual:trade_republic", "manual:trade_republic", 0, ["lee 1"]],
  ["es de otro banco: no se toca", "ob:sabadell", "ob:sabadell", 0, ["lee 1"]],
]) {
  await tt("nube · " + caso, async () => {
    const nube = nubeFalsa([Object.assign({}, FILA, { source: antes })]), app = appConNube(nube);
    const r = await vm.runInContext("cloud", app).setExpenseMeta(HUCHA);
    assert.equal(nube.tabla[0].source, despues);
    assert.equal(r, n);
    assert.deepEqual(nube.log, peticiones);
  });
}
await tt("nube · quitar la marca la quita y deja el resto como estaba", async () => {
  const nube = nubeFalsa([Object.assign({}, FILA, { source: "ob:trade_republic~meta.viaje#refr2#acctr" })]), app = appConNube(nube);
  const sin = cli.marcarAportacionMeta(marcado, "e-hucha", null).e;
  assert.equal(await vm.runInContext("cloud", app).setExpenseMeta(sin), 1);
  assert.equal(nube.tabla[0].source, "ob:trade_republic#refr2#acctr");
});
await tt("nube · en el modo pruebas no se escribe nada (CLOUD_WRITES) y no hay acuse", async () => {
  const nube = nubeFalsa([Object.assign({}, FILA, { source: "ob:trade_republic" })]), app = appConNube(nube);
  vm.runInContext("mcSandbox=function(){ return true; }", app);
  const r = await vm.runInContext("cloud", app).setExpenseMeta(HUCHA);
  assert.equal(r, null);
  assert.deepEqual(nube.log, []);
  assert.equal(nube.tabla[0].source, "ob:trade_republic");
});

console.log("meta-aportacion: OK");
