#!/usr/bin/env node
/**
 * RESERVAR DINERO (2026-08-03): repartir la nómina entre metas al cobrar.
 *
 * Petición del usuario: usa Trade Republic a la vez como fondo de emergencia, destino de
 * round-up/cashback, inversión en un ETF y cuenta de gasto diario. Podía crearse una "meta" de
 * ahorro, pero aportar a una meta nunca tocaba el presupuesto — así que ahorrar y controlar el
 * gasto variable con la MISMA cuenta no se veía claro. Estos tests fijan por escrito las dos
 * garantías que hacen que "reservar" se sienta real:
 *   1) El reparto nunca se pasa del propio ingreso ni dejar reglas huérfanas o de metas cumplidas.
 *   2) Aplicar el reparto es IDEMPOTENTE (una nómina, un reparto) y queda registrado para poder
 *      restarlo del presupuesto (ver `reservedSince`, que usa `monthSummary` en 04-tab-gastos.js).
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { loadPureLogic, loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const sourceRef = process.argv[process.argv.indexOf("--source-ref") + 1];
const baseline = process.argv.includes("--source-ref");
const ctx = baseline ? loadPureLogic(execFileSync("git", ["show", sourceRef + ":public/index.html"], {encoding:"utf8",maxBuffer:10*1024*1024})) : loadPureLogicFromFile();

function t(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
}

console.log("reserva-dinero");

const goalA = { id: "gA", name: "Fondo emergencia", target: 5000, saved: 1000 };
const goalB = { id: "gB", name: "Parking recibos", target: 1000, saved: 200 };
const goalDone = { id: "gC", name: "Ya cumplida", target: 100, saved: 100, done: true };

const estado = () => ({
  goals: [goalA, goalB, goalDone],
  settings: {
    reservaRules: [
      { id: "r1", name: "", kind: "fixed", value: 70, goalId: "gB" },
      { id: "r2", name: "", kind: "fixed", value: 500, goalId: "gA" },
      { id: "r3", name: "", kind: "fixed", value: 999999, goalId: "gDoesNotExist" },
      { id: "r4", name: "", kind: "fixed", value: 50, goalId: "gC" }, // meta ya cumplida
    ],
  },
  reservaLog: [],
});

// Ejecuta el botón del componente real, también sobre fuente Git anterior: la reproducción
// debe fallar por el descuento residual, no por la ausencia del helper nuevo.
async function borrarPorComponente(s, confirm){
  ctx.React.createElement=(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)});
  ctx.askConfirm=()=>Promise.resolve(confirm);
  const tree=ctx.ReservaRules({state:s,set:update=>{s=update(s);}});
  const buttons=[];
  const walk=n=>{if(!n||typeof n!=="object")return; if(n.type==="button"&&n.children.includes("✕"))buttons.push(n); (n.children||[]).forEach(walk);};
  walk(tree); buttons[0].props.onClick();
  await new Promise(resolve=>setImmediate(resolve));
  return s;
}

{
  const income={date:"2026-08-03",amount:-1620,merchant:"NOMINA"}, s=estado();
  const applied=ctx.applyReserva(s,income,ctx.reservaPlanFor(s,1620).plan);
  const removed=await borrarPorComponente(applied,true);
  t("el botón real de borrar libera el descuento de su regla",()=>assert.equal(ctx.reservedSince(removed,Date.parse("2026-08-01")),500));
  if(baseline) process.exit(0);
  const canceled=await borrarPorComponente(applied,false);
  t("cancelar el diálogo real no modifica ninguna asignación",()=>assert.strictEqual(canceled,applied));
}

t("reparto fijo: suma exacta de las reglas válidas, ignora meta borrada y meta cumplida", () => {
  const plan = ctx.reservaPlanFor(estado(), 1620);
  assert.equal(plan.plan.length, 2);
  const byGoal = Object.fromEntries(plan.plan.map((p) => [p.goalId, p.amount]));
  assert.equal(byGoal.gB, 70);
  assert.equal(byGoal.gA, 500);
  assert.equal(plan.total, 570);
  assert.equal(plan.remainder, 1620 - 570);
});

t("reparto porcentual: se calcula sobre el importe bruto del ingreso", () => {
  const s = estado();
  s.settings.reservaRules = [{ id: "rp", name: "", kind: "pct", value: 10, goalId: "gA" }];
  const plan = ctx.reservaPlanFor(s, 2000);
  assert.equal(plan.plan.length, 1);
  assert.equal(plan.plan[0].amount, 200);
});

t("el reparto NUNCA se pasa del propio ingreso, aunque las reglas sumen más", () => {
  const s = estado();
  s.settings.reservaRules = [
    { id: "ra", name: "", kind: "fixed", value: 800, goalId: "gA" },
    { id: "rb", name: "", kind: "fixed", value: 800, goalId: "gB" },
  ];
  const plan = ctx.reservaPlanFor(s, 1000);
  assert.equal(plan.total, 1000, "el total repartido no puede superar el ingreso");
  assert.equal(plan.remainder, 0);
  const gAamt = plan.plan.find((p) => p.goalId === "gA").amount;
  const gBamt = plan.plan.find((p) => p.goalId === "gB").amount;
  assert.equal(gAamt, 800);
  assert.equal(gBamt, 200, "la segunda regla se recorta a lo que queda, no se descarta entera");
});

t("applyReserva suma a cada meta y deja el registro en reservaLog", () => {
  const s = estado();
  const income = { date: "2026-08-03", amount: -1620, merchant: "NOMINA" };
  const plan = ctx.reservaPlanFor(s, 1620).plan;
  const ns = ctx.applyReserva(s, income, plan, "trade_republic");
  const gA = ns.goals.find((g) => g.id === "gA");
  const gB = ns.goals.find((g) => g.id === "gB");
  assert.equal(gA.saved, 1500); // 1000 + 500
  assert.equal(gB.saved, 270); // 200 + 70
  assert.equal(ns.reservaLog.length, 2);
  assert.equal(ns.reservaLog[0].incomeKey, ctx.reservaKeyOf(income));
});

t("applyReserva es idempotente: la MISMA nómina no se reparte dos veces", () => {
  const s = estado();
  const income = { date: "2026-08-03", amount: -1620, merchant: "NOMINA" };
  const plan = ctx.reservaPlanFor(s, 1620).plan;
  const s1 = ctx.applyReserva(s, income, plan, "trade_republic");
  assert.ok(ctx.reservaAlreadyApplied(s1, income));
  const s2 = ctx.applyReserva(s1, income, plan, "trade_republic");
  assert.strictEqual(s2, s1, "un ingreso ya repartido no cambia el estado");
  assert.equal(s2.reservaLog.length, 2, "sin duplicar entradas en el registro");
});

t("una meta que se marca done() deja de recibir más reservas en repartos futuros", () => {
  const s = estado();
  s.goals = [{ id: "gA", name: "Emergencia", target: 100, saved: 90 }];
  s.settings.reservaRules = [{ id: "r1", name: "", kind: "fixed", value: 50, goalId: "gA" }];
  const plan1 = ctx.reservaPlanFor(s, 1000).plan;
  const s1 = ctx.applyReserva(s, { date: "2026-08-01", amount: -1000, merchant: "N1" }, plan1, "b");
  assert.ok(s1.goals[0].done, "la meta se marca cumplida al llegar a su objetivo");
  const plan2 = ctx.reservaPlanFor(s1, 1000);
  assert.equal(plan2.plan.length, 0, "una meta ya cumplida no recibe más reservas");
});

t("reservedSince suma solo lo aplicado desde la fecha dada (para restar del presupuesto del período)", () => {
  const s = estado();
  s.reservaLog = [
    { id: "a", ruleId: "r1", goalId: "gB", name: "x", amount: 70, date: "2026-07-15", incomeKey: "k1" },
    { id: "b", ruleId: "r2", goalId: "gA", name: "y", amount: 500, date: "2026-08-03", incomeKey: "k2" },
  ];
  const fromMs = new Date(2026, 7, 1).getTime(); // 1 ago 2026
  assert.equal(ctx.reservedSince(s, fromMs), 500, "solo cuenta lo reservado DESDE el inicio del período");
});

t("borrar una regla libera solo su reserva sin borrar aportaciones ni repetir nómina", () => {
  const s = estado();
  s.expenses = [{ id: "salary", date: "2026-08-03", amount: -1620, merchant: "NOMINA", status: "BOOK" }];
  s.aportaciones = [{ id: "manual", amount: 25 }];
  s.accounts = [{ id: "bank", value: 2000 }];
  const income = s.expenses[0], start = Date.parse("2026-08-01");
  const applied = ctx.applyReserva(s, income, ctx.reservaPlanFor(s, 1620).plan, "trade_republic");
  const removed = ctx.removeReservaRule(applied, "r2");
  assert.equal(ctx.reservedSince(removed, start), 70);
  assert.equal(removed.settings.reservaRules.some(r => r.id === "r2"), false);
  assert.strictEqual(removed.goals, applied.goals, "el ahorro aportado sigue siendo histórico");
  assert.strictEqual(removed.expenses, applied.expenses);
  assert.strictEqual(removed.accounts, applied.accounts);
  assert.strictEqual(removed.aportaciones, applied.aportaciones);
  assert.deepEqual(removed.reservaLog.slice(0, 2), applied.reservaLog);
  assert.strictEqual(ctx.removeReservaRule(removed, "r2"), removed, "doble confirmación inocua");
  assert.strictEqual(ctx.applyReserva(removed, income, ctx.reservaPlanFor(removed, 1620).plan), removed);
  const next = ctx.removeReservaRule(removed, "r1");
  assert.equal(ctx.reservedSince(next, start), 0);
  assert.equal(ctx.reservaAlreadyApplied(next, income), true);
});

t("regla sin ejecución y desconocida no modifican el registro", () => {
  const s = estado(), removed = ctx.removeReservaRule(s, "r3");
  assert.strictEqual(removed.reservaLog, s.reservaLog);
  assert.strictEqual(removed.goals, s.goals);
  assert.strictEqual(ctx.removeReservaRule(s, "no-existe"), s);
});

t("una configuración reaparecida no vuelve a liberar el mismo asiento", () => {
  const s=estado();
  s.reservaLog=[{id:"assignment-a",ruleId:"r1",amount:70,date:"2026-08-03",incomeKey:"salary-a"}];
  const once=ctx.removeReservaRule(s,"r1");
  const revived={...once,settings:{...once.settings,reservaRules:s.settings.reservaRules}};
  const twice=ctx.removeReservaRule(revived,"r1");
  assert.equal(ctx.reservedSince(twice,Date.parse("2026-08-01")),0);
  assert.equal(twice.reservaLog.filter(x=>x.releaseOf==="assignment-a").length,1);
});

t("una liberación parcial conserva el pendiente sin otra compensación", () => {
  const s=estado(), original={id:"assignment-a",ruleId:"r1",amount:70,date:"2026-08-03",incomeKey:"salary-a"};
  s.reservaLog=[original,{...original,id:"partial",amount:-20,releaseOf:original.id}];
  const removed=ctx.removeReservaRule(s,"r1");
  assert.strictEqual(removed.reservaLog,s.reservaLog);
  assert.equal(ctx.reservedSince(removed,Date.parse("2026-08-01")),50);
});

t("identidades duplicadas o desconocidas no fabrican liberaciones", () => {
  const original={id:"assignment-a",ruleId:"r1",amount:70,date:"2026-08-03",incomeKey:"salary-a"};
  for(const log of [
    [original,{...original}],
    [{...original,id:undefined}],
    [{...original,incomeKey:undefined}],
    [{...original,date:"desconocida"}],
    [{...original,date:null}],
    [original,{...original,id:"other",amount:-20,releaseOf:undefined}],
    [original,{...original,id:"other",amount:-20,releaseOf:"no-existe"}],
    [original,{...original,id:"other",amount:"70"}]
  ]){
    const s=estado();s.reservaLog=log;
    const removed=ctx.removeReservaRule(s,"r1");
    assert.strictEqual(removed.reservaLog,s.reservaLog);
    assert.strictEqual(removed.goals,s.goals);
  }
});

t("liberar conserva fechas, céntimos, otras reglas y reservas manuales tras serializar", () => {
  const s = estado();
  s.reservaLog = [
    { id: "old", ruleId: "r1", amount: 10.01, date: "2026-07-15", incomeKey: "july" },
    { id: "new", ruleId: "r1", amount: 20.02, date: "2026-08-03", incomeKey: "aug" },
    { id: "other", ruleId: "r2", amount: 30.03, date: "2026-08-03" },
    { id: "manual", amount: 5.05, date: "2026-08-03" },
  ];
  const removed = JSON.parse(JSON.stringify(ctx.removeReservaRule(s, "r1")));
  assert.equal(ctx.reservedSince(removed, Date.parse("2026-07-01"), Date.parse("2026-08-01")), 0);
  assert.equal(+ctx.reservedSince(removed, Date.parse("2026-08-01")).toFixed(2), 35.08);
  assert.deepEqual(removed.reservaLog.slice(0, 4), s.reservaLog);
});

/* ALTA DE REGLAS (INC-0410, rechazo de la 4.26.87). El importe se leía con
   `parseFloat(texto.replace(',','.'))`: «1.200» se guardaba como 1,2 y una regla de mil doscientos
   apartaba un euro. Los esperados de abajo son literales escritos a mano, no salen del parser. */
const NULO = null;
t("importe de regla, decimal coma (es/ca): miles, céntimos y lo que no es un importe", () => {
  const casos = [
    ["1200", 1200], ["1.200", 1200], ["1.200,50", 1200.5], ["1,200.50", 1200.5], ["1.200.000", 1200000],
    ["12,5", 12.5], ["12,50", 12.5], ["1.5", 1.5], ["0", 0], ["007", 7], ["  250  ", 250],
    ["", NULO], [" ", NULO], ["abc", NULO], ["abc10", NULO], ["10abc", NULO], ["-10", NULO], ["+10", NULO],
    ["1e3", NULO], ["Infinity", NULO], ["NaN", NULO], ["1.2.3", NULO], ["1,2,3", NULO], ["1..2", NULO],
    [".5", NULO], ["5.", NULO], ["10 €", NULO], ["1 200", NULO], ["1.2345", NULO], ["1.200,505", NULO],
    ["1.200.50", NULO], ["1,200", NULO], // ¿mil doscientos o 1,2? Con decimal coma no se adivina.
  ];
  for (const [texto, esperado] of casos) assert.strictEqual(ctx.reservaImporteDe(texto, ","), esperado, JSON.stringify(texto));
  assert.strictEqual(ctx.reservaImporteDe(null, ","), NULO);
  assert.strictEqual(ctx.reservaImporteDe(undefined, ","), NULO);
});

t("importe de regla, decimal punto (en): la coma agrupa y «1.200» no se adivina", () => {
  const casos = [["1200", 1200], ["1,200", 1200], ["1,200.50", 1200.5], ["1.200,50", 1200.5], ["12.5", 12.5],
    ["1,200,000", 1200000], ["1.200", NULO], ["1,2", 1.2], ["-1,200", NULO]];
  for (const [texto, esperado] of casos) assert.strictEqual(ctx.reservaImporteDe(texto, "."), esperado, JSON.stringify(texto));
});

/* El botón REAL de «Guardar regla». El React de pruebas reparte los `useState` en orden
   (abierto, formulario, error) para poder escribir en el formulario sin navegador. */
const { createLogicSandbox, extractPureLogicSource } = await import("../scripts/load-pure-logic.mjs");
const vm = (await import("node:vm")).default;
const fsUI = (await import("node:fs")).default;
const cola = { estados: [], errores: [] };
const ui = createLogicSandbox();
ui.React.createElement = (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) });
ui.React.useState = (init) => {
  const i = cola.estados.length ? cola.estados.shift() : undefined;
  if (i && i.error) return ["", (v) => cola.errores.push(v)];
  return [i ? i.valor : (typeof init === "function" ? init() : init), () => {}];
};
vm.runInNewContext(extractPureLogicSource(fsUI.readFileSync(new URL("../public/index.html", import.meta.url), "utf8")), ui, { filename: "public/index.html:pure-logic" });

const textoDe = (n, out = []) => {
  if (n == null || n === false || n === true) return out;
  if (typeof n === "string" || typeof n === "number") { out.push(String(n)); return out; }
  (n.children || []).forEach((c) => textoDe(c, out));
  return out;
};
function alta(s, form) {
  cola.estados = [{ valor: true }, { valor: Object.assign({ name: "", kind: "fixed", value: "", goalId: "gA" }, form) }, { error: true }];
  cola.errores = [];
  let next = s;
  const tree = ui.ReservaRules({ state: s, set: (u) => { next = u(next); } });
  const botones = [];
  const walk = (n) => { if (!n || typeof n !== "object") return; if (n.type === "button" && n.props.className === "btn btn-primary btn-block") botones.push(n); (n.children || []).forEach(walk); };
  walk(tree);
  assert.equal(botones.length, 1, "no se encontró el botón de guardar regla");
  botones[0].props.onClick();
  return { reglas: next.settings.reservaRules, error: cola.errores.filter(Boolean).pop() || "", mismoEstado: next === s };
}
const vacio = () => ({ goals: [goalA, goalB], settings: { reservaRules: [] }, reservaLog: [], expenses: [] });

t("el botón real guarda «1.200» como mil doscientos y «1.200,50» con sus céntimos", () => {
  assert.deepEqual(alta(vacio(), { value: "1.200" }).reglas.map((r) => [r.kind, r.value, r.goalId]), [["fixed", 1200, "gA"]]);
  assert.deepEqual(alta(vacio(), { value: "1.200,50" }).reglas.map((r) => r.value), [1200.5]);
  assert.deepEqual(alta(vacio(), { value: "12,5", kind: "pct" }).reglas.map((r) => [r.kind, r.value]), [["pct", 12.5]]);
  assert.deepEqual(alta(vacio(), { value: "100", kind: "pct" }).reglas.map((r) => r.value), [100]);
});

t("un alta que no vale no guarda nada y lo dice", () => {
  for (const value of ["0", "", "abc", "-10", "1e3", "1.2.3", "abc10"]) {
    const r = alta(vacio(), { value });
    assert.equal(r.mismoEstado, true, JSON.stringify(value) + " no debe escribir estado");
    assert.equal(r.error, "amount", JSON.stringify(value));
  }
  for (const value of ["150", "100,01"]) {
    const r = alta(vacio(), { value, kind: "pct" });
    assert.equal(r.mismoEstado, true, value + " % no debe escribir estado");
    assert.equal(r.error, "pct", value);
  }
  // El tope es para lo que se escribe ahora: una regla antigua de más del 100 % sigue ahí.
  const antiguo = vacio(); antiguo.settings.reservaRules = [{ id: "old", name: "", kind: "pct", value: 150, goalId: "gA" }];
  assert.deepEqual(alta(antiguo, { value: "10" }).reglas.map((r) => r.value), [150, 10]);
});

t("los céntimos de una regla llegan iguales a la fila, al reparto y al registro", () => {
  assert.match(ctx.reservaEur(100), /^100\s€$/, "un importe redondo se queda sin decimales");
  assert.match(ctx.reservaEur(1200.5), /^1\.?200,50\s€$/, "con céntimos, se enseñan");
  assert.match(ctx.reservaEur(1200.004), /^1\.?200\s€$/, "un resto por debajo del céntimo no inventa decimales");
  const s = vacio(); s.settings.reservaRules = [{ id: "c", name: "", kind: "fixed", value: 1200.5, goalId: "gA" }];
  const income = { date: "2026-08-03", amount: -2000.75, merchant: "INGRESO" };
  const plan = ctx.reservaPlanFor(s, income.amount);
  assert.deepEqual([plan.plan[0].amount, plan.total, plan.remainder], [1200.5, 1200.5, 800.25]);
  const aplicado = ctx.applyReserva(s, income, plan.plan);
  assert.equal(aplicado.reservaLog[0].amount, 1200.5);
  assert.equal(ctx.reservedSince(aplicado, Date.parse("2026-08-01")), 1200.5);
  assert.equal(aplicado.goals.find((g) => g.id === "gA").saved, 2200.5);
});

/* EL ESTADO DEL REPARTO, el mismo para el aviso y para el editor. */
const haceDias = (n) => { const d = new Date(Date.now() - n * 86400000); d.setHours(12, 0, 0, 0); return d.toISOString(); };
const cobro = { id: "inc", date: haceDias(3), amount: -1500, merchant: "INGRESO SINTETICO", category: "ingreso" };
const conRegla = (extra) => Object.assign({ goals: [goalA, goalB, goalDone], settings: { reservaRules: [{ id: "r1", name: "", kind: "fixed", value: 100, goalId: "gA" }] }, reservaLog: [], expenses: [cobro] }, extra || {});
const estadoDe = (s) => ctx.reservaEstadoDe(s, ctx.lastPaydayOf(s.expenses, null, ctx.expenseDeletedSet(s)));

t("estado del reparto: sin reglas, sin ingreso, pendiente, repartido, descartado y sin nada que apartar", () => {
  assert.equal(estadoDe(conRegla({ settings: { reservaRules: [] } })).estado, "sinReglas");
  assert.equal(estadoDe(conRegla({ expenses: [] })).estado, "sinCobro");
  const pendiente = estadoDe(conRegla());
  assert.deepEqual([pendiente.estado, pendiente.income.id, pendiente.plan.total], ["pendiente", "inc", 100]);
  const aplicado = ctx.applyReserva(conRegla(), cobro, ctx.reservaPlanFor(conRegla(), cobro.amount).plan);
  assert.equal(estadoDe(aplicado).estado, "repartido");
  assert.equal(estadoDe(conRegla({ reservaDismissed: [ctx.reservaKeyOf(cobro)] })).estado, "descartado");
  // Hay ingreso, pero la única regla apunta a una meta ya cumplida: no es «pendiente».
  assert.equal(estadoDe(conRegla({ settings: { reservaRules: [{ id: "r4", name: "", kind: "fixed", value: 50, goalId: "gC" }] } })).estado, "sinPlan");
});

t("con el ingreso ya repartido, otra regla no se aplica a ese ingreso, y el editor lo dice", () => {
  const base = conRegla();
  const aplicado = ctx.applyReserva(base, cobro, ctx.reservaPlanFor(base, cobro.amount).plan);
  const s = Object.assign({}, aplicado, { settings: { reservaRules: aplicado.settings.reservaRules.concat([{ id: "r2", name: "", kind: "fixed", value: 50, goalId: "gB" }]) } });
  assert.equal(estadoDe(s).estado, "repartido");
  assert.strictEqual(ctx.applyReserva(s, cobro, ctx.reservaPlanFor(s, cobro.amount).plan), s, "la misma nómina no se reparte dos veces");
  assert.equal(ctx.reservedSince(s, 0), 100);
  cola.estados = []; cola.errores = [];
  const linea = [];
  const walk = (n) => { if (!n || typeof n !== "object") return; if (n.props && n.props["data-reserva-estado"]) linea.push(n); (n.children || []).forEach(walk); };
  walk(ui.ReservaRules({ state: s, set: () => {} }));
  assert.equal(linea.length, 1);
  assert.equal(linea[0].props["data-reserva-estado"], "repartido");
  const frase = textoDe(linea[0]).join("");
  assert.ok(frase.length > 20 && !frase.includes("{d}") && !frase.includes("rr_st_"), "frase sin resolver: " + frase);
  assert.equal(ui.ReservaDetect({ state: s, set: () => {} }), null, "con el ingreso repartido no hay aviso");
  // Y con un ingreso NUEVO sin repartir, el aviso recoge la regla recién añadida.
  const nuevo = { id: "inc2", date: haceDias(1), amount: -1600, merchant: "INGRESO SINTETICO", category: "ingreso" };
  const s2 = Object.assign({}, s, { expenses: s.expenses.concat([nuevo]) });
  const p2 = estadoDe(s2);
  // Por JSON: el plan nace en el sandbox y `deepEqual` estricto distingue arrays de otro contexto.
  assert.equal(JSON.stringify([p2.estado, p2.income.id, p2.plan.plan.map((p) => [p.ruleId, p.amount])]), JSON.stringify(["pendiente", "inc2", [["r1", 100], ["r2", 50]]]));
});

/* Revisión de Codex del 4/10 sobre la primera versión local: tres huecos, los tres con su prueba. */
t("la meta se comprueba al guardar: vacía, borrada o ya cumplida no escribe y lo dice", () => {
  const s = () => ({ goals: [goalA, goalB, goalDone], settings: { reservaRules: [] }, reservaLog: [], expenses: [] });
  for (const goalId of ["", "gDoesNotExist", "gC"]) {
    const r = alta(s(), { value: "1200", goalId });
    assert.equal(r.mismoEstado, true, JSON.stringify(goalId) + " no debe escribir estado");
    assert.equal(r.error, "goal", JSON.stringify(goalId));
  }
  // Y si la meta deja de valer entre el clic y la escritura, el alta tampoco entra.
  const regla = { id: "n", name: "", kind: "fixed", value: 10, goalId: "gA" };
  const cumplida = { goals: [Object.assign({}, goalA, { done: true })], settings: { reservaRules: [{ id: "v", kind: "fixed", value: 5, goalId: "gA" }] } };
  assert.strictEqual(ctx.addReservaRule(cumplida, regla), cumplida);
  const sinMetas = { goals: [], settings: { reservaRules: [] } };
  assert.strictEqual(ctx.addReservaRule(sinMetas, regla), sinMetas);
  const viva = { goals: [goalA], settings: { reservaRules: [{ id: "v", kind: "fixed", value: 5, goalId: "gA" }], otra: 1 } };
  const con = ctx.addReservaRule(viva, regla);
  assert.equal(JSON.stringify(con.settings), JSON.stringify({ reservaRules: [{ id: "v", kind: "fixed", value: 5, goalId: "gA" }, regla], otra: 1 }));
  assert.equal(viva.settings.reservaRules.length, 1, "no muta el estado de entrada");
});

t("una regla antigua a 0 con su meta activa no reparte, y el editor no afirma por qué", () => {
  const s = conRegla({ settings: { reservaRules: [{ id: "z", name: "", kind: "fixed", value: 0, goalId: "gA" }] } });
  assert.equal(estadoDe(s).estado, "sinPlan");
  cola.estados = []; cola.errores = [];
  const linea = [];
  const walk = (n) => { if (!n || typeof n !== "object") return; if (n.props && n.props["data-reserva-estado"]) linea.push(n); (n.children || []).forEach(walk); };
  walk(ui.ReservaRules({ state: s, set: () => {} }));
  assert.equal(textoDe(linea[0]).join(""), "Con estas reglas no hay ningún importe que repartir. Revisa las reglas y sus metas.");
  assert.equal(JSON.stringify(s.settings.reservaRules), JSON.stringify([{ id: "z", name: "", kind: "fixed", value: 0, goalId: "gA" }]), "la regla antigua no se toca");
});

t("un importe cuyos céntimos no caben exactos se rechaza, sin tope inventado", () => {
  assert.strictEqual(ctx.reservaImporteDe("90071992547409,93", ","), NULO);       // se guardaba como …409,94
  assert.strictEqual(ctx.reservaImporteDe("90071992547409.93", "."), NULO);
  assert.strictEqual(ctx.reservaImporteDe("99999999999999999999", ","), NULO);
  assert.strictEqual(ctx.reservaImporteDe("9999999999,99", ","), 9999999999.99);  // grande, pero exacto
  assert.strictEqual(ctx.reservaImporteDe("0,01", ","), 0.01);
  assert.strictEqual(ctx.reservaImporteDe("0,29", ","), 0.29);                    // 0.29*100 = 28.999… en coma flotante
  const r = alta(vacio(), { value: "90071992547409,93" });
  assert.equal(r.mismoEstado, true);
  assert.equal(r.error, "amount");
});

t("sin ninguna meta activa, el formulario abierto conserva el borrador y su aviso", () => {
  const legacy = { id: "old", name: "", kind: "fixed", value: 5, goalId: "gC" };
  const buscar = (tree, f) => { const out = []; const walk = (n) => { if (!n || typeof n !== "object") return; if (f(n)) out.push(n); (n.children || []).forEach(walk); }; walk(tree); return out; };
  for (const [goals, rules] of [[[], []], [[goalDone], []], [[goalDone], [legacy]], [[], [legacy]]]) {
    const s = { goals, settings: { reservaRules: rules }, reservaLog: [], expenses: [] };
    cola.estados = [{ valor: true }, { valor: { name: "Borrador", kind: "fixed", value: "100", goalId: "gA" } }, { valor: "goal" }];
    const tree = ui.ReservaRules({ state: s, set: () => { throw new Error("no debe escribir"); } });
    const caso = JSON.stringify([goals.length, rules.length]);
    assert.ok(tree, "la tarjeta desaparece con el formulario abierto " + caso);
    assert.equal(buscar(tree, (n) => n.props && n.props.role === "alert").length, 1, "falta el aviso " + caso);
    assert.equal(buscar(tree, (n) => n.type === "input" && n.props.value === "Borrador").length, 1, "se pierde el borrador " + caso);
    assert.equal(buscar(tree, (n) => n.props && n.props["data-reserva-rule"]).length, rules.length, "las reglas previas siguen " + caso);
  }
  // Con el formulario cerrado, sin metas activas ni reglas no hay tarjeta: como antes.
  cola.estados = [];
  assert.equal(ui.ReservaRules({ state: { goals: [goalDone], settings: { reservaRules: [] }, reservaLog: [], expenses: [] }, set: () => {} }), null);
});

/* El plan de ahorro tiene OTRO lector (`amountOf`, review 23/9), permisivo a propósito: limpia lo
   que sobra. El de las reglas nuevas es estricto. Comparten cómo agrupan miles, y eso se fija
   aquí pulsando el Guardar real del plan de ahorro; las diferencias también son deliberadas. */
function ahorroGuarda(texto) {
  cola.estados = [{ valor: [{ id: "d", name: "x", amount: texto, ent: "myinvestor" }] }];
  let next = { aportaciones: [{ id: "d", name: "x", amount: 7, ent: "myinvestor" }] };
  const guardar = [];
  const walk = (n) => { if (!n || typeof n !== "object") return; if (n.props && n.props["data-savings-save"]) guardar.push(n); (n.children || []).forEach(walk); };
  walk(ui.SavingsPlanCard({ state: next, set: (u) => { next = u(next); } }));
  assert.equal(guardar.length, 1, "no se encontró el Guardar del plan de ahorro");
  guardar[0].props.onClick();
  return next.aportaciones[0].amount;
}
t("mismo criterio de miles que el plan de ahorro donde ambos aceptan, y divergencias deliberadas", () => {
  for (const [texto, esperado] of [["1200", 1200], ["1.200", 1200], ["1.200,50", 1200.5], ["1,200.50", 1200.5], ["12,5", 12.5], ["1.5", 1.5], ["1.200.000", 1200000]]) {
    assert.strictEqual(ahorroGuarda(texto), esperado, "plan de ahorro " + texto);
    assert.strictEqual(ctx.reservaImporteDe(texto), esperado, "regla nueva " + texto);
  }
  // El plan de ahorro limpia y adivina; una regla nueva no.
  for (const [texto, ahorro] of [["1,200", 1.2], ["abc10", 10], ["-10", 10], ["1.2.3", 123]]) {
    assert.strictEqual(ahorroGuarda(texto), ahorro, "plan de ahorro " + texto);
    assert.strictEqual(ctx.reservaImporteDe(texto), NULO, "regla nueva " + texto);
  }
});

/* REGLA MENSUAL (decisión del dueño, 4/10): guardar la regla descuenta del presupuesto del mes y
   aporta a la meta en la MISMA escritura, sin ingreso ni confirmación aparte. Sintético. */
// Instantes absolutos (UTC), no fechas locales: la prueba vale igual en Madrid y en la CI en UTC.
const OCT = Date.UTC(2026, 9, 10, 10, 0, 0);
const NOV = Date.UTC(2026, 10, 3, 8, 0, 0);
const mensualBase = (extra) => Object.assign({ budget: 1000, goals: [{ id: "gA", name: "Fondo", target: 5000, saved: 1000 }, { id: "gB", name: "Parking", target: 1000, saved: 200 }, goalDone],
  settings: { reservaRules: [] }, reservaLog: [], expenses: [] }, extra || {});
const reglaM = (o) => Object.assign({ id: "m1", name: "", kind: "fixed", value: 100, goalId: "gA", mensual: true }, o || {});
const disponible = (s, now) => ctx.monthBudgetStats(s, now).budget;
const ahorrado = (s, id) => s.goals.find((g) => g.id === id).saved;

t("mensual: 1000 de presupuesto y una regla de 100 dejan 900 y la meta con 100 más, en una escritura", () => {
  const s0 = mensualBase();
  assert.equal(disponible(s0, OCT), 1000);
  const s1 = ctx.addReservaRule(s0, reglaM(), OCT);
  assert.equal(s1.settings.reservaRules.length, 1);
  assert.equal(disponible(s1, OCT), 900);
  assert.equal(ahorrado(s1, "gA"), 1100);
  assert.equal(s1.reservaLog.length, 1);
  assert.equal(s1.reservaLog[0].amount, 100);
  assert.strictEqual(s1.expenses, s0.expenses, "no se toca la referencia de expenses");
  assert.equal(ahorrado(s0, "gA"), 1000, "el estado de entrada no se muta");
});
t("mensual: repetir el alta o la aplicación no descuenta ni aporta otra vez", () => {
  const s1 = ctx.addReservaRule(mensualBase(), reglaM(), OCT);
  assert.strictEqual(ctx.addReservaRule(s1, reglaM(), OCT), s1, "la misma alta dos veces");
  assert.strictEqual(ctx.applyReservaMensual(s1, OCT), s1, "misma referencia si no hay nada que aplicar");
  assert.strictEqual(ctx.applyReservaMensual(s1, OCT + 5 * 86400000), s1, "otro día del mismo mes");
  // Otro móvil con el mismo estado de partida produce el MISMO asiento, no uno distinto.
  const otro = ctx.addReservaRule(mensualBase(), reglaM(), OCT + 3600000);
  assert.equal(otro.reservaLog[0].id, s1.reservaLog[0].id);
});
t("mensual: el porcentaje es sobre el presupuesto bruto, no sobre lo que dejó otra regla", () => {
  let s = ctx.addReservaRule(mensualBase(), reglaM({ id: "p1", kind: "pct", value: 10 }), OCT);
  s = ctx.addReservaRule(s, reglaM({ id: "p2", kind: "pct", value: 20, goalId: "gB" }), OCT);
  assert.deepEqual(Array.from(s.reservaLog, (x) => x.amount), [100, 200]);
  assert.equal(disponible(s, OCT), 700);
  assert.equal(ahorrado(s, "gA"), 1100); assert.equal(ahorrado(s, "gB"), 400);
  const c = ctx.addReservaRule(mensualBase({ budget: 999.99 }), reglaM({ kind: "pct", value: 12.5 }), OCT);
  assert.equal(c.reservaLog[0].amount, 125, "céntimos redondeados una sola vez");
  const f = ctx.addReservaRule(mensualBase(), reglaM({ value: 33.33 }), OCT);
  assert.equal(disponible(f, OCT), 966.67); assert.equal(ahorrado(f, "gA"), 1033.33);
});
t("mensual: un porcentaje sin presupuesto conocido guarda la regla y no inventa la aportación", () => {
  for (const budget of [undefined, 0, null, NaN, "1000"]) {
    const s = ctx.addReservaRule(mensualBase({ budget }), reglaM({ kind: "pct", value: 10 }), OCT);
    assert.equal(s.settings.reservaRules.length, 1, "la regla se guarda " + budget);
    assert.equal(s.reservaLog.length, 0, "sin base no hay asiento " + budget);
    assert.equal(ahorrado(s, "gA"), 1000);
    assert.equal(ctx.reservaMensualImporte(s, s.settings.reservaRules[0]).motivo, "base");
  }
});
t("mensual: el mes siguiente aporta una vez más; el anterior no cambia", () => {
  const s1 = ctx.addReservaRule(mensualBase(), reglaM(), OCT);
  const s2 = ctx.applyReservaMensual(s1, NOV);
  assert.equal(s2.reservaLog.length, 2);
  assert.notEqual(s2.reservaLog[1].id, s2.reservaLog[0].id);
  assert.equal(ahorrado(s2, "gA"), 1200);
  assert.equal(disponible(s2, NOV), 900);
  assert.strictEqual(ctx.applyReservaMensual(s2, NOV + 86400000), s2);
  assert.strictEqual(s2.expenses, s1.expenses);
});
t("mensual: la identidad es el mes de Madrid, igual en cualquier zona del móvil", () => {
  // 1/11/2026 00:30 en Madrid (CET) es 31/10 23:30 UTC: un móvil en UTC diría «octubre».
  const yaNoviembre = Date.UTC(2026, 9, 31, 23, 30, 0), aunOctubre = Date.UTC(2026, 9, 31, 22, 30, 0);
  assert.equal(ctx.addReservaRule(mensualBase(), reglaM(), yaNoviembre).reservaLog[0].id, "mensual|m1|2026-11");
  assert.equal(ctx.addReservaRule(mensualBase(), reglaM(), aunOctubre).reservaLog[0].id, "mensual|m1|2026-10");
  assert.equal(ctx.addReservaRule(mensualBase(), reglaM(), OCT).reservaLog[0].mensual, "2026-10");
  // Verano (CEST, +2): 1/7 00:30 Madrid es 30/6 22:30 UTC.
  assert.equal(ctx.addReservaRule(mensualBase(), reglaM(), Date.UTC(2026, 5, 30, 22, 30, 0)).reservaLog[0].id, "mensual|m1|2026-07");
});
t("mensual: cambiar la vista del presupuesto o el cobro que abre el ciclo no aporta otra vez", () => {
  const cobro = (id, dia) => ({ id, date: "2026-10-" + dia + "T10:00:00Z", amount: -2000, merchant: "INGRESO SINTETICO", category: "ingreso", ent: "sabadell" });
  const s1 = ctx.addReservaRule(mensualBase({ expenses: [cobro("c1", "05")] }), reglaM(), OCT);
  assert.equal(s1.reservaLog.length, 1);
  const ciclo = Object.assign({}, s1, { settings: Object.assign({}, s1.settings, { budgetCycle: true }) });
  assert.strictEqual(ctx.applyReservaMensual(ciclo, OCT), ciclo, "pasar a «mi ciclo»");
  const otroCobro = Object.assign({}, ciclo, { expenses: [cobro("c1", "05"), cobro("c2", "09")] });
  assert.strictEqual(ctx.applyReservaMensual(otroCobro, OCT), otroCobro, "otro cobro abre el ciclo");
  const vuelta = Object.assign({}, otroCobro, { settings: Object.assign({}, otroCobro.settings, { budgetCycle: false }) });
  assert.strictEqual(ctx.applyReservaMensual(vuelta, OCT), vuelta, "volver a «mes»");
  assert.equal(ahorrado(vuelta, "gA"), 1100);
});
t("mensual: borrar la regla conserva lo aportado y libera el descuento una sola vez", () => {
  const s1 = ctx.addReservaRule(mensualBase(), reglaM(), OCT);
  const s2 = ctx.removeReservaRule(s1, "m1");
  assert.equal(s2.settings.reservaRules.length, 0);
  assert.equal(ahorrado(s2, "gA"), 1100, "la aportación no se borra");
  assert.equal(disponible(s2, OCT), 1000, "el descuento vuelve");
  assert.equal(s2.reservaLog.length, 2);
  assert.strictEqual(ctx.removeReservaRule(s2, "m1"), s2, "borrar otra vez no hace nada");
  assert.strictEqual(ctx.applyReservaMensual(s2, OCT), s2, "sin regla no se vuelve a aportar");
  // La misma configuración reaparece (otro móvil): su periodo ya tiene asiento, liberado.
  const vuelve = Object.assign({}, s2, { settings: { reservaRules: [reglaM()] } });
  assert.strictEqual(ctx.applyReservaMensual(vuelve, OCT), vuelve, "no se aporta dos veces el mismo periodo");
  const s3 = ctx.removeReservaRule(vuelve, "m1");
  assert.equal(disponible(s3, OCT), 1000, "ni se libera dos veces");
  assert.equal(s3.reservaLog.length, 2);
});
t("mensual: meta cumplida o borrada no recibe nada, y una meta que se cumple se marca", () => {
  const hecha = Object.assign(mensualBase(), { settings: { reservaRules: [reglaM({ goalId: "gC" }), reglaM({ id: "m2", goalId: "nope" })] } });
  assert.strictEqual(ctx.applyReservaMensual(hecha, OCT), hecha);
  assert.equal(ctx.reservaMensualImporte(hecha, hecha.settings.reservaRules[0]).motivo, "meta");
  const justa = ctx.addReservaRule(mensualBase(), reglaM({ value: 800, goalId: "gB" }), OCT);
  assert.equal(ahorrado(justa, "gB"), 1000);
  assert.equal(justa.goals.find((g) => g.id === "gB").done, true);
  assert.strictEqual(ctx.applyReservaMensual(justa, NOV), justa, "cumplida: el mes siguiente no aporta");
});
t("mensual: «mi ciclo» refleja TODOS los asientos reales que contiene, sin tope por regla", () => {
  // Ciclo abierto el 28/10; alta el 29/10 y noviembre asentado el 1/11: son 200 de ahorro real.
  const alta = Date.UTC(2026, 9, 29, 10, 0, 0), nov = Date.UTC(2026, 10, 1, 9, 0, 0);
  const s = ctx.applyReservaMensual(ctx.addReservaRule(mensualBase(), reglaM(), alta), nov);
  assert.equal(ahorrado(s, "gA"), 1200);
  assert.deepEqual(Array.from(s.reservaLog, (x) => [x.mensual, x.amount]), [["2026-10", 100], ["2026-11", 100]]);
  assert.equal(ctx.monthBudgetStats(s, alta, ctx.inicioDeMesMs(nov)).reserved, 100, "octubre natural");
  assert.equal(ctx.monthBudgetStats(s, nov).reserved, 100, "noviembre natural");
  const ciclo = { startMs: Date.UTC(2026, 9, 27, 23, 0, 0), cycle: null, todayEndMs: Infinity };
  assert.equal(ctx.monthBudgetStats(s, nov, undefined, undefined, ciclo).reserved, 200, "el ciclo contiene las dos");
  assert.equal(ctx.monthBudgetStats(s, nov, undefined, undefined, ciclo).budget, 800);
});
t("mensual: importe fijo sin presupuesto aporta lo indicado y el disponible sigue sin cifra", () => {
  for (const budget of [undefined, 0, null]) {
    const s = ctx.addReservaRule(mensualBase({ budget }), reglaM(), OCT);
    assert.equal(ahorrado(s, "gA"), 1100, "aporta " + budget);
    assert.equal(s.reservaLog.length, 1);
    assert.strictEqual(disponible(s, OCT), null, "no se fabrica un presupuesto " + budget);
  }
});
t("mensual: una aportación que rebasa el objetivo no se recorta, cumple la meta y no repite", () => {
  const s = ctx.addReservaRule(mensualBase(), reglaM({ value: 900, goalId: "gB" }), OCT);
  assert.equal(ahorrado(s, "gB"), 1100, "200 + 900, por encima de 1000");
  assert.equal(s.goals.find((g) => g.id === "gB").done, true);
  assert.equal(disponible(s, OCT), 100);
  assert.strictEqual(ctx.applyReservaMensual(s, NOV), s);
});
t("mensual: «pendiente» solo es cierto cuando este mes falta un asiento que se pueda hacer", () => {
  const s1 = ctx.addReservaRule(mensualBase(), reglaM(), OCT);
  assert.equal(ctx.reservaMensualPendiente(mensualBase(), OCT), false, "sin reglas");
  assert.equal(ctx.reservaMensualPendiente(s1, OCT), false, "al día");
  assert.equal(ctx.reservaMensualPendiente(s1, NOV), true, "mes nuevo");
  assert.equal(ctx.reservaMensualPendiente(ctx.applyReservaMensual(s1, NOV), NOV), false, "ya asentado");
  const sinBase = ctx.addReservaRule(mensualBase({ budget: 0 }), reglaM({ kind: "pct", value: 10 }), OCT);
  assert.equal(ctx.reservaMensualPendiente(sinBase, NOV), false, "sin base no hay nada que pedir a la nube");
});
t("mensual: la nube solo cuenta como leída con un estado válido, o si aún no hay ninguno", () => {
  assert.equal(ctx.reservaMensualNubeLeida(null), true, "primera cuenta: no hay fila remota");
  assert.equal(ctx.reservaMensualNubeLeida(undefined), true);
  assert.equal(ctx.reservaMensualNubeLeida({ data: null }), true, "fila sin estado todavía");
  // Nada de esto es un estado ni prueba que no lo haya.
  for (const data of [false, 0, "", "x", [], { incomplete: true }, { accounts: [] }])
    assert.equal(ctx.reservaMensualNubeLeida({ data }), false, "dato no válido: " + JSON.stringify(data));
  assert.equal(ctx.reservaMensualNubeLeida({ data: undefined }), false, "dato sin definir");
  assert.equal(ctx.reservaMensualNubeLeida({}), false, "fila sin la propiedad data");
  const valido = { accounts: [], investments: [], debts: [], fixed: [] };
  assert.equal(ctx.reservaMensualNubeLeida({ data: valido }), ctx.validCloudState(valido), "mismo criterio que el pull");
  assert.equal(ctx.validCloudState(valido), true, "el estado mínimo de la prueba tiene que ser válido");
});
t("mensual: dos pulls solapados no se prestan la validez", () => {
  const valido = { data: { accounts: [], investments: [], debts: [], fixed: [] } }, roto = { data: { incomplete: true } };
  // A lee una nube inválida y espera; B lee una válida pero luego falla; A termina «bien».
  const a = ctx.reservaMensualPuerta(), b = ctx.reservaMensualPuerta();
  a.lee(roto); b.lee(valido);
  assert.equal(b.vale(false), false, "B leyó bien pero su pull falló");
  assert.equal(a.vale(true), false, "A terminó bien sin haber leído nada válido");
  assert.equal(b.vale(true), true, "B, si termina bien, sí vale");
  // Al revés, y sin lectura: una puerta recién creada no vale aunque el pull acabe bien.
  const c = ctx.reservaMensualPuerta(), d = ctx.reservaMensualPuerta();
  c.lee(valido); d.lee(roto);
  assert.deepEqual([c.vale(true), d.vale(true), ctx.reservaMensualPuerta().vale(true)], [true, false, false]);
  // Una nube con dato falso no acredita la lectura, y por tanto no hay aporte.
  for (const data of [false, 0, ""]) { const p = ctx.reservaMensualPuerta(); p.lee({ data }); assert.equal(p.vale(true), false, JSON.stringify(data)); }
});
t("mensual: las reglas por ingreso conservan su contrato y las mensuales no entran en el reparto", () => {
  const antigua = { id: "old", name: "", kind: "fixed", value: 50, goalId: "gA" };
  const s0 = mensualBase({ settings: { reservaRules: [antigua] } });
  assert.strictEqual(ctx.applyReservaMensual(s0, OCT), s0, "una regla antigua no se aplica sola");
  const s1 = ctx.addReservaRule(s0, reglaM(), OCT);
  assert.equal(s1.reservaLog.length, 1);
  const plan = ctx.reservaPlanFor(s1, 2000);
  assert.deepEqual(Array.from(plan.plan, (p) => p.ruleId), ["old"], "el ingreso solo reparte las antiguas");
  assert.equal(ctx.reservaEstadoDe(ctx.addReservaRule(mensualBase(), reglaM(), OCT), null).estado, "sinReglas");
});

t("editar mensual asentada conserva identidad, campos desconocidos, referencias e historial", () => {
  const r=reglaM({unknown:{keep:7}}), s=ctx.addReservaRule(mensualBase(),r,OCT);
  const patch={id:"no",mensual:false,name:"Nueva",kind:"pct",value:12.5,goalId:"gB",unknown:null};
  const next=ctx.editReservaRule(s,JSON.parse(JSON.stringify(r)),patch,OCT);
  assert.equal(JSON.stringify(next.settings.reservaRules[0]),JSON.stringify({...r,name:"Nueva",kind:"pct",value:12.5,goalId:"gB"}));
  for(const key of ["goals","reservaLog","expenses"]) assert.strictEqual(next[key],s[key],key+" intacto");
  assert.strictEqual(ctx.applyReservaMensual(next,OCT),next);
  assert.strictEqual(ctx.editReservaRule(next,r,patch,OCT),next,"repetir escritura con copia anterior no vuelve a editar");
  const nov=ctx.applyReservaMensual(next,Date.UTC(2026,9,31,23,30));
  assert.equal(nov.reservaLog[1].id,"mensual|m1|2026-11");
  assert.equal(nov.reservaLog[1].goalId,"gB"); assert.equal(nov.reservaLog[1].amount,125);
  assert.equal(nov.goals.find(g=>g.id==="gA").saved,s.goals.find(g=>g.id==="gA").saved);
  assert.equal(nov.goals.find(g=>g.id==="gB").saved,s.goals.find(g=>g.id==="gB").saved+125);
  assert.equal(JSON.stringify(nov.reservaLog[0]),JSON.stringify(s.reservaLog[0]));
});

t("editar valida contra estado fresco: borrada, duplicada o modificada y meta no activa no escriben", () => {
  const r=reglaM(), s=ctx.addReservaRule(mensualBase(),r,OCT), patch={...r,value:150};
  const states=[ctx.removeReservaRule(s,r.id),
    {...s,settings:{reservaRules:[{...r,value:99}]}},
    {...s,settings:{reservaRules:[{...r,unknown:true}]}},
    {...s,settings:{reservaRules:[r,r]}},
    {...s,goals:s.goals.filter(g=>g.id!==r.goalId)},
    {...s,goals:s.goals.map(g=>g.id===r.goalId?{...g,done:true}:g)}];
  for(const fresh of states) assert.strictEqual(ctx.editReservaRule(fresh,r,patch,OCT),fresh);
  for(const delta of [{kind:"other"},{value:NaN},{value:Infinity},{value:0},{value:-1},{value:100.001},{value:1e20},{value:"10"},{kind:"pct",value:100.01},{goalId:"gone"}]){
    assert.strictEqual(ctx.editReservaRule(s,r,{...patch,...delta},OCT),s,JSON.stringify(delta));
  }
  const full=ctx.editReservaRule(s,r,{...patch,kind:"pct",value:100},OCT);
  assert.equal(full.settings.reservaRules[0].value,100);
  assert.strictEqual(ctx.editReservaRule(s,r,r,OCT),s,"sin cambio ni aporte pendiente devuelve el mismo estado");
  const reordered={goalId:r.goalId,value:r.value,kind:r.kind,name:r.name,mensual:r.mensual,id:r.id};
  assert.equal(ctx.reservaRuleSame(r,reordered),true,"JSONB puede reordenar claves sin cambiar el dato");
  assert.equal(ctx.editReservaRule(s,reordered,patch,OCT).settings.reservaRules[0].value,150);
});

t("editar mensual pendiente aporta una vez con los nuevos valores y no revive un asiento liberado", () => {
  const r=reglaM({kind:"pct",value:10});
  const s=ctx.addReservaRule(mensualBase({budget:0}),r,OCT);
  const next=ctx.editReservaRule(s,r,{...r,kind:"fixed",value:75.5,goalId:"gB"},OCT);
  assert.equal(next.reservaLog.length,1); assert.equal(next.reservaLog[0].amount,75.5);
  assert.equal(next.goals.find(g=>g.id==="gB").saved,275.5);
  assert.strictEqual(ctx.applyReservaMensual(next,OCT),next);
  const released=ctx.removeReservaRule(next,r.id);
  const revived={...released,settings:{reservaRules:next.settings.reservaRules}};
  const edited=ctx.editReservaRule(revived,revived.settings.reservaRules[0],{...r,kind:"fixed",value:90},OCT);
  assert.strictEqual(edited.reservaLog,revived.reservaLog); assert.strictEqual(edited.goals,revived.goals);
  const other=reglaM({id:"other",kind:"fixed",value:50,goalId:"gA"});
  const withOther={...s,settings:{reservaRules:[r,other]}};
  const own=ctx.editReservaRule(withOther,r,{...r,kind:"fixed",value:75.5},OCT);
  assert.equal(own.reservaLog.length,1,"editar solo asienta la regla editada, no otra pendiente");
  assert.equal(own.reservaLog[0].ruleId,r.id);
});

t("editar regla por ingreso conserva contrato y reparto anterior; el siguiente usa la edición", () => {
  const r={id:"old",name:"Antes",kind:"fixed",value:50,goalId:"gA",legacy:{keep:1}};
  const s0=mensualBase({settings:{reservaRules:[r]}}), income={date:"2026-10-04",amount:-2000,merchant:"NOMINA"};
  const s=ctx.applyReserva(s0,income,ctx.reservaPlanFor(s0,2000).plan);
  const next=ctx.editReservaRule(s,r,{name:"Después",kind:"pct",value:5,goalId:"gB"},OCT);
  assert.equal(Object.hasOwn(next.settings.reservaRules[0],"mensual"),false);
  assert.equal(JSON.stringify(next.settings.reservaRules[0].legacy),JSON.stringify(r.legacy));
  assert.strictEqual(next.goals,s.goals); assert.strictEqual(next.reservaLog,s.reservaLog);
  assert.strictEqual(ctx.applyReserva(next,income,ctx.reservaPlanFor(next,2000).plan),next);
  const another=ctx.applyReserva(next,{...income,date:"2026-11-04"},ctx.reservaPlanFor(next,2000).plan);
  assert.equal(another.reservaLog[1].amount,100); assert.equal(another.reservaLog[1].goalId,"gB");
  assert.strictEqual(ctx.applyReservaMensual(next,OCT),next);
});

t("botón real de edición: updater repetido conserva un solo asiento aunque cumpla la meta", () => {
  const r=reglaM({kind:"pct",value:10}), s=mensualBase({budget:0,goals:[{...goalA,target:50,saved:0}],settings:{reservaRules:[r]}});
  cola.estados=[{valor:true},{valor:{name:"Nueva",kind:"fixed",value:"75",goalId:"gA"}},{error:true},{valor:null},{valor:r}];
  cola.errores=[]; let next=s,calls=0;
  const tree=ui.ReservaRules({state:s,set:update=>{next=update(next);next=update(next);calls++;}});
  const buttons=[],walk=n=>{if(!n||typeof n!=="object")return;if(n.type==="button"&&n.props.className==="btn btn-primary btn-block")buttons.push(n);(n.children||[]).forEach(walk);};
  walk(tree); assert.equal(buttons.length,1);buttons[0].props.onClick();buttons[0].props.onClick();
  assert.equal(calls,1,"ref sincrónica evita un segundo envío");
  assert.equal(next.reservaLog.length,1);assert.equal(next.reservaLog[0].amount,75);
  assert.equal(next.goals[0].saved,75);assert.equal(next.goals[0].done,true);
  assert.equal(next.settings.reservaRules[0].id,r.id);assert.strictEqual(next.expenses,s.expenses);
});

console.log("\nreserva-dinero: OK");
