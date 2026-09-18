#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const i18n=fs.readFileSync("src/modules/01-i18n.js","utf8");
const chunk=`
const mk=(y,m)=>y+"-"+String(m+1).padStart(2,"0");
const mkOf=(d)=>mk(d.getFullYear(),d.getMonth());
function madridYmdParts(ms){const d=new Date(ms);return {ym:mk(d.getFullYear(),d.getMonth())};}
const CAT_NEUTRAS={};
function parseDate(d){return new Date(d);}
function spendByMonth(expenses){const m={};(expenses||[]).forEach(function(e){if(e.amount>0&&!CAT_NEUTRAS[e.category]){const k=mkOf(parseDate(e.date));m[k]=(m[k]||0)+e.amount;}});return m;}
`+i18n.slice(i18n.indexOf("function budgetYmKey"),i18n.indexOf("// Estado completo de gamificación"));
const ctx=vm.createContext({Date});
vm.runInContext(chunk,ctx);
const plain=(x)=>JSON.parse(JSON.stringify(x));

const mid=new Date(2026,8,18,12).getTime();
const expenses=[
  {date:"2026-06-10",amount:100,category:"comida"},
  {date:"2026-07-10",amount:100,category:"comida"},
  {date:"2026-08-10",amount:900,category:"comida"},
];

assert.deepEqual(plain(ctx.underBudgetStreak(expenses,{},mid)),{current:0,best:0,ever:false});
assert.deepEqual(plain(ctx.underBudgetStreak(expenses,{"2026-06":200,"2026-07":200,"2026-08":200},mid)),{current:0,best:2,ever:true});
assert.deepEqual(plain(ctx.underBudgetStreak(expenses,{"2026-06":200,"2026-07":200,"2026-08":1000},mid)),{current:3,best:3,ever:true});
assert.deepEqual(plain(ctx.underBudgetStreak(expenses,{"2026-06":200,"2026-08":1000},mid)),{current:1,best:1,ever:true});

const snap=ctx.ensureBudgetMonthSnap({budget:650},mid);
assert.equal(snap.budgetByMonth["2026-09"],650);
assert.equal(ctx.ensureBudgetMonthSnap({budget:650,budgetByMonth:{"2026-09":0}},mid),null,"un 0 guardado también es un dato, no ausencia");

const dash=fs.readFileSync("src/modules/03-tab-dash.js","utf8");
const share=fs.readFileSync("src/modules/02-ui-shared.js","utf8");
assert.equal(dash.includes("🔥"),false,"la racha ya no lleva llama");
assert.equal(dash.includes("tt.delta"),false,"Inicio no pinta una ganancia sin base del día 1");
assert.equal(share.includes('tf("rp_delta"'),false,"el informe compartido tampoco inventa el delta");

console.log("dash-metricas: OK");
