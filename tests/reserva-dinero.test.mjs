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

console.log("\nreserva-dinero: OK");
