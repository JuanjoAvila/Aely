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

function referenceStreak(state,nowMs){
  const num=(k)=>+k.slice(0,4)*12 + +k.slice(5)-1;
  const curNum=num(ctx.budgetYmKey(nowMs));
  const keys=Object.keys(state.budgetByMonth||{}).filter((k)=>num(k)<curNum).sort((a,b)=>num(a)-num(b));
  const good={};
  for(const k of keys){
    const y=+k.slice(0,4),m=+k.slice(5)-1;
    const start=ctx.inicioDeMesMs(Date.UTC(y,m,15,12));
    const end=ctx.inicioDeMesMs(Date.UTC(y,m+1,15,12));
    const stats=ctx.monthBudgetStats(Object.assign({},state,{budget:Number(state.budgetByMonth[k])}),start+12*864e5,end);
    good[k]=stats.budget!=null&&stats.against<=stats.budget+.005;
  }
  let best=0,run=0,prev=null;
  for(const k of keys){
    const n=num(k); if(prev==null||n!==prev+1) run=0;
    if(good[k]){ run++; best=Math.max(best,run); } else run=0;
    prev=n;
  }
  let current=0,n=curNum-1;
  while(current<120){
    const k=Math.floor(n/12)+"-"+String(n%12+1).padStart(2,"0");
    if(!good[k]) break;
    current++; n--;
  }
  return {current,best,ever:best>0};
}

// Banco determinista de equivalencia: incluye bordes UTC que en Madrid ya pertenecen al mes
// siguiente, bancos fuera/dentro, neutras, ingresos, posibles repetidos, neto y reservas.
let seed=18092026;
const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
for(let sample=0;sample<40;sample++){
  const budgetByMonth={};
  for(let m=3;m<=7;m++) budgetByMonth["2026-"+String(m+1).padStart(2,"0")]=300+Math.floor(rnd()*500);
  const ex=[];
  for(let i=0;i<80;i++){
    const m=3+Math.floor(rnd()*5);
    const edge=rnd()<.2;
    const date=new Date(edge?Date.UTC(2026,m+1,0,22,30):Date.UTC(2026,m,1+Math.floor(rnd()*27),12)).toISOString();
    const ents=["trade_republic","sabadell","revolut",null];
    ex.push({date,amount:(rnd()<.16?-1:1)*(5+Math.floor(rnd()*180)),category:rnd()<.12?"inversion":"super",
      ent:ents[Math.floor(rnd()*ents.length)],possibleDup:rnd()<.08});
  }
  const reservas=[];
  for(let i=0;i<5;i++) reservas.push({date:new Date(Date.UTC(2026,3+Math.floor(rnd()*5),5,12)).toISOString(),amount:Math.floor(rnd()*90)});
  const state={expenses:ex,budgetByMonth,reservaLog:reservas,
    accounts:[{ent:"trade_republic",role:"diario",spendFrom:true},{ent:"sabadell",role:"fijos"}],
    settings:{gTotalMode:rnd()<.5?"net":"split",expenseBanks:rnd()<.5?["revolut"]:[]}};
  assert.deepEqual(plain(ctx.underBudgetStreak(state,mid)),referenceStreak(state,mid),"equivalencia muestra "+sample);
}

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
const streakSource=i18n.slice(i18n.indexOf("function underBudgetStreak"),i18n.indexOf("// Estado completo de gamificación"));
assert.equal(streakSource.includes("budgetYmKey(dateMs"),false,"la racha no ejecuta Intl por cada movimiento");
assert.match(streakSource,/function\(ms\)[\s\S]*while\(lo<=hi\)/,"los meses se localizan entre límites con búsqueda binaria");
assert.equal(dash.includes("gamifOf(state,tt).streak"),false,"Inicio memoriza la racha y no recalcula toda la gamificación al pintar");
assert.equal(goals.slice(goals.indexOf("function Goals"),goals.indexOf("function ContributeGoalSheet")).includes("gamifOf("),false,"Metas no calcula logros que ni siquiera pinta");

console.log("dash-metricas: OK");
