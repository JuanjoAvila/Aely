#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx=loadPureLogicFromFile();
const plain=(x)=>JSON.parse(JSON.stringify(x));

const mid=Date.parse("2026-09-18T12:00:00.000Z");
const expenses=[
  {date:"2026-06-10T12:00:00.000Z",amount:100,category:"comida"},
  {date:"2026-07-10T12:00:00.000Z",amount:100,category:"comida"},
  {date:"2026-08-10T12:00:00.000Z",amount:900,category:"comida"},
];

assert.deepEqual(plain(ctx.underBudgetStreak({expenses},mid)),{current:0,best:0,ever:false});
assert.deepEqual(plain(ctx.underBudgetStreak({expenses,budgetByMonth:{"2026-06":200,"2026-07":200,"2026-08":200}},mid)),{current:0,best:2,ever:true});
assert.deepEqual(plain(ctx.underBudgetStreak({expenses,budgetByMonth:{"2026-06":200,"2026-07":200,"2026-08":1000}},mid)),{current:3,best:3,ever:true});
assert.deepEqual(plain(ctx.underBudgetStreak({expenses,budgetByMonth:{"2026-06":200,"2026-08":1000}},mid)),{current:1,best:1,ever:true});

// Misma verdad financiera que Inicio: los recibos de una cuenta fija no rompen la racha de la
// cuenta diaria, pero una reserva sí reduce el presupuesto disponible de su mes.
const budgets={"2026-06":700,"2026-07":700,"2026-08":700};
const multiBank=[];
for(const ym of Object.keys(budgets)){
  multiBank.push({date:ym+"-10T12:00:00.000Z",amount:300,category:"super",ent:"trade_republic"});
  multiBank.push({date:ym+"-11T12:00:00.000Z",amount:800,category:"vivienda",ent:"sabadell"});
}
const bankState={
  expenses:multiBank,budgetByMonth:budgets,
  accounts:[
    {id:"daily",ent:"trade_republic",role:"diario",spendFrom:true},
    {id:"bills",ent:"sabadell",role:"fijos",spendFrom:false},
  ],
  settings:{gTotalMode:"split"},reservaLog:[],
};
assert.deepEqual(plain(ctx.underBudgetStreak(bankState,mid)),{current:3,best:3,ever:true});
assert.deepEqual(plain(ctx.underBudgetStreak(Object.assign({},bankState,{reservaLog:[
  {date:"2026-07-05T12:00:00.000Z",amount:450},
]}),mid)),{current:1,best:1,ever:true});

const snap=ctx.ensureBudgetMonthSnap({budget:650},mid);
assert.equal(snap.budgetByMonth["2026-09"],650);
assert.equal(ctx.ensureBudgetMonthSnap({budget:650,budgetByMonth:{"2026-09":0}},mid),null,"un 0 guardado también es un dato, no ausencia");

const dash=fs.readFileSync("src/modules/03-tab-dash.js","utf8");
const share=fs.readFileSync("src/modules/02-ui-shared.js","utf8");
const i18n=fs.readFileSync("src/modules/01-i18n.js","utf8");
const goals=fs.readFileSync("src/modules/09-tab-debts-goals.js","utf8");
assert.equal(dash.includes("🔥"),false,"la racha ya no lleva llama");
assert.equal(dash.includes("tt.delta"),false,"Inicio no pinta una ganancia sin base del día 1");
assert.equal(share.includes('tf("rp_delta"'),false,"el informe compartido tampoco inventa el delta");
assert.equal(i18n.includes("function spendByMonth"),false,"la racha no relee el histórico con una segunda regla");
assert.equal(dash.includes("gamifOf(state,tt).streak"),false,"Inicio memoriza la racha y no recalcula toda la gamificación al pintar");
assert.equal(goals.slice(goals.indexOf("function Goals"),goals.indexOf("function ContributeGoalSheet")).includes("gamifOf("),false,"Metas no calcula logros que ni siquiera pinta");

console.log("dash-metricas: OK");
