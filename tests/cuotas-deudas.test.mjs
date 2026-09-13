#!/usr/bin/env node
/**
 * LAS CUOTAS DE TUS DEUDAS, EN «DEUDAS», SIN CONTAR DOS VECES (4.21.0).
 *
 * Idea suya del 12/9: «añadir categorías automáticamente por las deudas y que se clasificaran en
 * la zona de gastos en cuanto llegaran, y así se pudieran filtrar». Decisión suya: categoría
 * «Deudas» + filtro por cada deuda, que NO cuente en el gastado del mes, histórico en otra tanda.
 *
 * Medido con sus datos ANTES de picar: ninguna cuota casa por nombre. El banco llama a la hipoteca
 * «PRESTAMOS ADEUDO CUOTA N.…» (y la cobra el 31, no el 1), el préstamo del piso sale con el nombre
 * de quien lo cobra, y las de Trade Republic llegan por la noti como «Amazon» / «Openbank Pay» y,
 * además, por Open Banking como «Movimiento». Los escenarios de abajo son ESOS (sin datos suyos).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const srvSrc = fs.readFileSync(path.join(root, "supabase/functions/_shared/presupuesto.ts"), "utf8");
const srvJs = transformSync(srvSrc, { loader: "ts", format: "esm" }).code;
const srv = await import("data:text/javascript;base64," + Buffer.from(srvJs).toString("base64"));
const cli = loadPureLogicFromFile();

function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}`); throw e; }
}

console.log("cuotas-deudas");

/* Fechas relativas al mes EN CURSO, para que el test valga cualquier día del año. */
const hoy = new Date();
const Y = hoy.getFullYear(), M = hoy.getMonth();
const iso = (y, m, d) => new Date(y, m, d, 12).toISOString();
const ultimoDelMesPasado = () => new Date(Y, M, 0).getDate();

/** Sabadell = recibos (hipoteca día 1, préstamo día 3), TR = gasto diario (financiación día 1). */
function estado(expenses = [], extra = {}) {
  return Object.assign({
    budget: 800,
    accounts: [
      { id: "a1", ent: "sabadell", role: "fijos", value: 3000 },
      { id: "a2", ent: "trade_republic", role: "diario", value: 900 },
    ],
    settings: { expenseBanks: ["trade_republic"] },
    fixed: [], oneoffs: [], flows: [],
    debts: [
      { id: "hipo", name: "Hipoteca", value: 90000, monthly: 660.85, account: "sabadell", day: 1 },
      { id: "piso", name: "Préstamo entrada", value: 9000, monthly: 197, account: "sabadell", day: 3 },
      { id: "robot", name: "Financiación robot", value: 900, monthly: 149.75, account: "trade_republic", day: 1 },
    ],
    expenses,
  }, extra);
}
let n = 0;
const g = (date, amount, merchant, source, ent, extra = {}) =>
  Object.assign({ id: "e" + (++n), date, amount, merchant, category: "otros", source, ent }, extra);

const marcar = (s) => { const r = cli.marcarCuotasDeDeuda(s); return r ? r.state : s; };
const deuda = (s, id) => s.expenses.find((e) => e.id === id);

t("★ sus cuotas reales, que NO casan por nombre, caen en su deuda", () => {
  const exps = [
    g(iso(Y, M - 1, ultimoDelMesPasado()), 660.85, "PRESTAMOS ADEUDO CUOTA N.0000", "ob", "sabadell"),  // la del 1, cobrada el 31
    g(iso(Y, M, 3), 197, "Nombre De Persona", "ob", "sabadell"),
    g(iso(Y, M, 1), 149.75, "Amazon", "macrodroid", undefined, { category: "compras" }),
  ];
  const s = marcar(estado(exps));
  assert.deepEqual(s.expenses.map((e) => e.debtId), ["hipo", "piso", "robot"]);
  assert.ok(s.expenses.every((e) => e.category === "deudas"));
});

t("★ DOS bancos y dos deudas del MISMO importe: cada cuota con la suya", () => {
  const base = estado();
  base.debts = [
    { id: "d1", name: "Uno", value: 900, monthly: 100, account: "sabadell", day: 5 },
    { id: "d2", name: "Dos", value: 900, monthly: 100, account: "trade_republic", day: 5 },
  ];
  base.expenses = [g(iso(Y, M, 5), 100, "Cargo", "ob", "trade_republic"), g(iso(Y, M, 5), 100, "Cargo", "ob", "sabadell")];
  const s = marcar(base);
  assert.deepEqual(Object.fromEntries(s.expenses.map((e) => [e.ent, e.debtId])), { trade_republic: "d2", sabadell: "d1" });
});

t("★ la misma cuota por la noti y por el banco: solo UNA es la cuota", () => {
  const a = g(iso(Y, M, 1), 149.75, "Amazon", "macrodroid");
  const b = g(iso(Y, M, 2), 149.75, "Movimiento", "ob", "trade_republic");
  const s = marcar(estado([b, a]));   // la del banco va primero a propósito: manda la cercanía, no el orden
  assert.equal(s.expenses.filter((e) => e.debtId).length, 1, "no marcar de más");
  assert.equal(deuda(s, a.id).debtId, "robot", "la más cercana al día y con nombre de verdad");
});

t("★ amortización extra el mismo mes: se queda como gasto normal", () => {
  const cuota = g(iso(Y, M, 3), 197, "X", "ob", "sabadell");
  const extra = g(iso(Y, M, 4), 197, "X", "ob", "sabadell");
  const s1 = marcar(estado([cuota]));
  const s2 = marcar(estado(s1.expenses.concat([extra])));
  assert.equal(deuda(s2, extra.id).debtId, undefined);
  assert.equal(deuda(s2, extra.id).category, "otros");
});

t("NO marca: otro banco, otro importe, lejos del día, a mano, traspasos, fuera de ventana", () => {
  const exps = [
    g(iso(Y, M, 3), 197, "X", "ob", "trade_republic"),                 // otro banco
    g(iso(Y, M, 3), 197.5, "X", "ob", "sabadell"),                     // otro importe (sin nombre)
    g(iso(Y, M, 20), 197, "X", "ob", "sabadell"),                      // lejos del día 3
    g(iso(Y, M, 1), 660.85, "Hipoteca", "manual:sabadell", "sabadell"),// apuntado a mano
    g(iso(Y, M, 1), 660.85, "Y", "ob", "sabadell", { category: "traspaso" }),
    g(iso(Y, M - 13, 1), 660.85, "Z", "ob", "sabadell"),               // más allá de CUOTA_MESES
  ];
  assert.equal(cli.marcarCuotasDeDeuda(estado(exps)), null);
});

t("por nombre + importe parecido también (la red de siempre)", () => {
  const s = marcar(estado([g(iso(Y, M, 15), 661, "CUOTA HIPOTECA", "ob", "sabadell")]));
  assert.equal(s.expenses[0].debtId, "hipo");
});

t("★ lo que él saca a mano de «Deudas» no se vuelve a marcar", () => {
  const e = g(iso(Y, M, 3), 197, "X", "ob", "sabadell");
  const s = estado([e], { cuotaNo: [cli.keyOfExpense(e)] });
  assert.equal(cli.marcarCuotasDeDeuda(s), null);
});

t("★ sin nada nuevo devuelve null (el efecto no entra en bucle)", () => {
  const s = marcar(estado([g(iso(Y, M, 3), 197, "X", "ob", "sabadell")]));
  assert.equal(cli.marcarCuotasDeDeuda(s), null);
});

t("★ sale del GASTADO, pero el saldo de gasto NO se mueve", () => {
  const cuota = g(iso(Y, M, 1), 149.75, "Amazon", "macrodroid");
  const antes = estado([cuota, g(iso(Y, M, 1), 30, "Mercadona", "macrodroid")]);
  const despues = marcar(antes);
  assert.equal(+cli.monthBudgetStats(antes).spent.toFixed(2), 179.75);
  assert.equal(+cli.monthBudgetStats(despues).spent.toFixed(2), 30);
  // el saldo ancla con estos gastos: sacar la cuota lo haría saltar (rol-sin-salto)
  assert.deepEqual(cli.insumosSaldoGasto(despues).spentByBank, cli.insumosSaldoGasto(antes).spentByBank);
  assert.equal(cli.expenseBucket(deuda(despues, cuota.id), despues), "deuda");
});

t("importObExpenses ya no TIRA la deuda casada por nombre (los Fijos sí)", () => {
  const tx = (merchant, amount) => ({ ent: "sabadell", id: null, date: iso(Y, M, 1).slice(0, 10), amount, merchant, note: "", card: false, status: "" });
  const s = estado([], { fixed: [{ id: "f1", name: "Endesa", amount: 60, account: "sabadell", freq: "mes", day: 1 }] });
  const add = cli.importObExpenses(s, [tx("RECIBO HIPOTECA", 660.85), tx("ENDESA ENERGIA", 60)]);
  assert.equal(add.length, 1);
  assert.equal(add[0].merchant, "RECIBO HIPOTECA");
});

t("★ viaja a la nube: OB con `~deuda.`, la noti sin tocar su source", () => {
  const ob = marcar(estado([g(iso(Y, M, 3), 197, "X", "ob", "sabadell")])).expenses[0];
  assert.equal(cli.expenseSourceForCloud(ob), "ob:sabadell~deuda.piso");
  const back = cli.expenseFromRow({ id: "x", fecha: ob.date, importe: 197, comercio: "X", cat: "deudas", source: "ob:sabadell~deuda.piso" });
  assert.equal(back.ent, "sabadell", "el banco no puede ser «sabadell~deuda.piso»");
  assert.equal(back.debtId, "piso");
  assert.equal(cli.expenseBankOf({ source: "ob:sabadell~deuda.piso#dup" }), "sabadell");
  assert.equal(cli.expenseSourceForCloud({ ...ob, possibleDup: true }), "ob:sabadell~deuda.piso#dup");

  const noti = marcar(estado([g(iso(Y, M, 1), 149.75, "Amazon", "macrodroid")])).expenses[0];
  assert.equal(cli.expenseSourceForCloud(noti), "macrodroid", "un «macrodroid~…» el servidor lo leería «a mano» y lo SUMARÍA");
  // tras reinstalar baja sin debtId, con cat deudas: la pasada lo vuelve a deducir
  const bajada = cli.expenseFromRow({ id: "y", fecha: noti.date, importe: 149.75, comercio: "Amazon", cat: "deudas", source: "macrodroid" });
  assert.equal(bajada.category, "deudas");
  assert.equal(marcar(estado([bajada])).expenses[0].debtId, "robot");
});

t("★ el pull no devuelve a «otros» una cuota marcada, ni le quita la marca", () => {
  const local = { id: "x", date: iso(Y, M, 1), amount: 149.75, merchant: "Amazon", category: "deudas", source: "macrodroid", ent: "trade_republic", debtId: "robot" };
  const nube = cli.expenseFromRow({ id: "x", fecha: local.date, importe: 149.75, comercio: "Amazon", cat: "compras", source: "macrodroid" });
  const m = cli.refreshExpenseFromCloud(local, nube);
  assert.equal(m.category, "deudas");
  assert.equal(m.debtId, "robot");
});

t("★ ESPEJO: el servidor cuenta lo mismo que la app (OB y noti)", () => {
  const s = marcar(estado([
    g(iso(Y, M, 1), 149.75, "Amazon", "macrodroid"),
    g(iso(Y, M, 1), 30, "Mercadona", "macrodroid"),
  ]));
  const filas = s.expenses.map((e) => ({ fecha: e.date, importe: e.amount, comercio: e.merchant, cat: e.category, source: cli.expenseSourceForCloud(e) }));
  assert.equal(srv.statsDelMes(filas, s, srv.inicioDeMesMs()).spent, +cli.monthBudgetStats(s).spent.toFixed(2));
  assert.equal(srv.esCuotaDeDeuda("ob:revolut~deuda.coche"), true);
  assert.equal(srv.esCuotaDeDeuda("ob:revolut#dup"), false);
  assert.equal(srv.bancoDeSource("ob:revolut~deuda.coche#dup"), "revolut");
  assert.equal(srv.cuentaParaPresupuesto({ importe: 9, cat: "super", source: "ob:trade_republic~deuda.x" }, ["trade_republic"]), false);
});

t("★ un servidor VIEJO (split por #) deja FUERA la de OB, no la suma", () => {
  const viejo = (source) => {
    const s = String(source || "");
    if (s.indexOf("ob:") === 0) return s.slice(3).split("#")[0] || null;
    return null;
  };
  const ents = ["revolut"];
  assert.equal(ents.indexOf(viejo("ob:revolut~deuda.coche")) >= 0, false, "banco raro → fuera");
  assert.equal(ents.indexOf(viejo("ob:revolut#deuda.coche")) >= 0, true, "con # la sumaría: por eso ~");
});

t("el id de la deuda no rompe el formato", () => {
  assert.equal(cli.deudaSufijo("a~b#c.d"), "~deuda.abcd");
  assert.equal(cli.deudaSufijo(null), "");
});

/* ─── 2ª tanda (4.22.0): el histórico con la misma regla ─── */

t("★ HISTÓRICO: las filas de meses pasados que ya tiene también caen en su deuda", () => {
  const exps = [
    g(iso(Y, M - 3, 3), 197, "Nombre De Persona", "ob-hist", "sabadell"),
    g(iso(Y, M - 2, 3), 197, "Nombre De Persona", "ob-hist", "sabadell"),
    g(iso(Y, M - 1, 1), 149.75, "Amazon", "macrodroid"),
  ];
  const s = marcar(estado(exps));
  assert.deepEqual(s.expenses.map((e) => e.debtId), ["piso", "piso", "robot"]);
});

t("★ HISTÓRICO: marcar meses pasados no mueve el saldo de hoy", () => {
  const antes = estado([g(iso(Y, M - 2, 1), 149.75, "Amazon", "macrodroid"), g(iso(Y, M, 1), 30, "Mercadona", "macrodroid")]);
  const despues = marcar(antes);
  assert.equal(deuda(despues, despues.expenses[0].id).debtId, "robot");
  assert.deepEqual(cli.insumosSaldoGasto(despues).spentByBank, cli.insumosSaldoGasto(antes).spentByBank);
  assert.equal(+cli.monthBudgetStats(despues).spent.toFixed(2), 30);
});

const hc = (o) => Object.assign({ kind: "out", card: false, ent: "sabadell" }, o);
const ymdDe = (y, m, d) => { const t = new Date(y, m, d); return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0"); };

t("★ IMPORTADOR: la cuota del extracto entra en «Deudas», no como gasto ni como dup", () => {
  const cands = [
    hc({ id: "c1", merchant: "PRESTAMOS ADEUDO CUOTA", amount: 660.85, date: ymdDe(Y, M - 2, 1) }),
    hc({ id: "c2", merchant: "CUOTA HIPOTECA", amount: 660.85, date: ymdDe(Y, M - 3, 1) }),   // antes: dup «modeled»
    hc({ id: "c3", merchant: "MERCADONA", amount: 42, date: ymdDe(Y, M - 2, 2) }),
  ];
  const s = estado();
  const { rows } = cli.histClassifyCandidates(cands, s);
  assert.deepEqual(rows.map((r) => [r.status, r.category, r.debtId]), [
    ["new", "deudas", "hipo"], ["new", "deudas", "hipo"], ["new", rows[2].category, undefined],
  ]);
  assert.notEqual(rows[2].category, "deudas");
  const built = cli.histBuildCommit(cands, rows, s);
  assert.deepEqual(Array.from(built.expAdds, (e) => e.debtId), ["hipo", "hipo", undefined]);
});

t("★ IMPORTADOR: una por deuda y mes, contando lo que YA está marcado", () => {
  const ya = marcar(estado([g(iso(Y, M - 2, 3), 197, "X", "ob", "sabadell")]));
  assert.equal(ya.expenses[0].debtId, "piso");
  const cands = [hc({ id: "c1", merchant: "OTRA COSA", amount: 197, date: ymdDe(Y, M - 2, 4) })];
  const { rows } = cli.histClassifyCandidates(cands, ya);
  assert.notEqual(rows[0].category, "deudas", "el mes ya tiene su cuota");
});

t("IMPORTADOR: si él la pasa a otra categoría en la vista previa, entra sin marca", () => {
  const cands = [hc({ id: "c1", merchant: "X", amount: 197, date: ymdDe(Y, M - 2, 3) })];
  const s = estado();
  const { rows } = cli.histClassifyCandidates(cands, s);
  rows[0] = { ...rows[0], category: "hogar" };
  assert.equal(cli.histBuildCommit(cands, rows, s).expAdds[0].debtId, undefined);
});

t("IMPORTADOR: un Fijo casado sigue siendo dup «modeled»", () => {
  const s = estado([], { fixed: [{ id: "f1", name: "Iberdrola", amount: 12, account: "sabadell", freq: "mes" }] });
  const { rows } = cli.histClassifyCandidates([hc({ id: "c1", merchant: "IBERDROLA", amount: 12, date: ymdDe(Y, M - 1, 12) })], s);
  assert.equal(rows[0].reason, "modeled");
});

/* ─── 4.22.2: su rechazo — «Cofidis 24,99 es la cuota, no la puedo cambiar manualmente?» ─── */

const conSuelo = (exps, extra = {}) => {
  const s = estado(exps, extra);
  // Financiación ya ACABADA (months 3 desde hace 6 meses): inactiva, 25,02 en el Plan.
  s.debts = s.debts.concat([{ id: "suelo", name: "Financiación suelo", value: 75.06, monthly: 25.02, account: "trade_republic", day: 6, months: 3, asOf: (Y * 12 + M) - 6 }]);
  return s;
};

t("★ SU CASO: Cofidis 24,99 no casa solo (deuda acabada, 24,99≠25,02, otro nombre)", () => {
  const s = conSuelo([g(iso(Y, M, 8), 24.99, "Cofidis", "macrodroid")]);
  assert.equal(cli.debtActive(s.debts[3]), false, "el escenario es el suyo: deuda inactiva");
  assert.equal(cli.marcarCuotasDeDeuda(s), null);
});

t("★ marcarla a mano: va a «Deudas» con esa deuda, aunque sea manual o traspaso", () => {
  for (const [source, cat] of [["macrodroid", "recibos"], ["manual:trade_republic", "compras"], ["ob", "traspaso"]]) {
    const e = g(iso(Y, M, 8), 24.99, "Cofidis", source, "trade_republic", { category: cat });
    const r = cli.marcarCuotaAMano(conSuelo([e]), e.id, "suelo");
    assert.equal(r.e.category, "deudas", source);
    assert.equal(r.e.debtId, "suelo", source);
    assert.equal(deuda(r.state, e.id).debtId, "suelo");
  }
});

t("★ y APRENDE: el Cofidis del mes que viene entra solo, con 24,99 contra 25,02", () => {
  const este = g(iso(Y, M - 1, 8), 24.99, "Cofidis", "macrodroid");
  const r = cli.marcarCuotaAMano(conSuelo([este]), este.id, "suelo");
  assert.equal(r.state.cuotaAlias["trade_republic|cofidis"], "suelo");
  const sig = g(iso(Y, M, 7), 24.99, "COFIDIS", "macrodroid");
  const s = marcar(Object.assign({}, r.state, { expenses: r.state.expenses.concat([sig]) }));
  assert.equal(deuda(s, sig.id).debtId, "suelo");
});

t("el alias NO cruza de banco, NO casa un importe disparatado, y sigue siendo una por mes", () => {
  const base = conSuelo([], { cuotaAlias: { "trade_republic|cofidis": "suelo" } });
  const otroBanco = g(iso(Y, M, 7), 24.99, "Cofidis", "ob", "sabadell");
  const caro = g(iso(Y, M, 7), 300, "Cofidis", "macrodroid");
  assert.equal(cli.marcarCuotasDeDeuda(Object.assign({}, base, { expenses: [otroBanco, caro] })), null);
  const dos = [g(iso(Y, M, 6), 24.99, "Cofidis", "macrodroid"), g(iso(Y, M, 9), 24.99, "Cofidis", "macrodroid")];
  const s = marcar(Object.assign({}, base, { expenses: dos }));
  assert.equal(s.expenses.filter((e) => e.debtId).length, 1);
});

t("un «Movimiento» sin nombre se marca a mano pero NO se aprende", () => {
  const e = g(iso(Y, M, 10), 24.99, "Movimiento", "ob", "trade_republic", { category: "traspaso" });
  const r = cli.marcarCuotaAMano(conSuelo([e]), e.id, "suelo");
  assert.equal(r.e.debtId, "suelo");
  assert.equal(r.state.cuotaAlias, undefined);
});

t("un apunte A MANO ya en «Deudas» recupera su deuda tras reinstalar (sin marca en la nube)", () => {
  const s = conSuelo([g(iso(Y, M, 7), 25.02, "Cofidis", "manual:trade_republic", "trade_republic", { category: "deudas" })],
    { cuotaAlias: { "trade_republic|cofidis": "suelo" } });
  assert.equal(marcar(s).expenses[0].debtId, "suelo");
  // …pero un apunte a mano cualquiera sigue fuera de la pasada
  const otro = conSuelo([g(iso(Y, M, 7), 25.02, "Cofidis", "manual:trade_republic", "trade_republic", { category: "compras" })],
    { cuotaAlias: { "trade_republic|cofidis": "suelo" } });
  assert.equal(cli.marcarCuotasDeDeuda(otro), null);
});

t("marcar a mano le quita la lápida si la tenía", () => {
  const e = g(iso(Y, M, 8), 24.99, "Cofidis", "macrodroid");
  const r = cli.marcarCuotaAMano(conSuelo([e], { cuotaNo: [cli.keyOfExpense(e), "otra"] }), e.id, "suelo");
  assert.deepEqual(Array.from(r.state.cuotaNo), ["otra"]);
});

console.log("  ok");
