import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadPureLogic, loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

// Frontera 30/9 22:01Z en UTC: el hijo fija la zona. El padre hereda la TZ del runner.
if(process.argv.includes("--utc-boundary")){
  utcBoundary(process.argv.includes("--mutation=local-end"));
  process.exit(0);
}

const ctx=loadPureLogicFromFile(), NativeDate=ctx.Date;
const epoch=Date.parse("2026-10-02T12:00:00Z");
ctx.Date=class extends NativeDate {
  constructor(...args){ super(...(args.length?args:[epoch])); }
  static now(){ return epoch; }
};
const expense=(id,date,amount,category,ent="sabadell")=>({id,date:date+"T12:00:00Z",amount,category,ent,merchant:id});
const state={budget:1000,settings:{budgetCycle:true,expenseBanks:["sabadell"]},
  accounts:[{ent:"sabadell",role:"diario",spendFrom:true},{ent:"revolut",role:"ahorro"}],
  expenses:[expense("viejo","2026-08-10",23,"salud"),expense("límite","2026-08-20",11,"transporte"),
    expense("compras","2026-09-05",70,"compras"),expense("Nómina","2026-09-26",-2000,"ingreso"),
    expense("café","2026-09-27",40,"bares"),expense("compra","2026-10-01",25,"super"),
    expense("devolución","2026-10-01",-5,"ingreso","revolut"),
    expense("neutro","2026-08-15",100,"inversion"),expense("otro banco","2026-08-15",200,"salud","revolut"),
    {...expense("posible","2026-08-15",300,"salud"),possibleDup:true}],
  categoryBudgets:{super:200},reservaLog:[{date:"2026-08-15T12:00:00Z",amount:10}]};
const before=JSON.stringify(state);
const payday=ctx.budgetPaydayOf(state);
for(const [preset,range,spent,ids] of [
  ["month",{},25,["super"]], ["cycle",{},65,["bares","super"]],
  ["last",{},110,["compras","bares","super"]],
  ["custom",{from:"2026-08-10",to:"2026-08-20"},34,["salud","transporte","super"]],
  ["all",{},169,["compras","bares","super","salud","transporte"]],
]){
  const bounds=ctx.presetBoundsMs(preset,range,payday.start),period=ctx.gastosPeriodOf(preset,bounds,payday);
  const stats=ctx.monthBudgetStats(state,null,null,null,period);
  const cats=ctx.categorySpentByMonth(state,null,null,period);
  assert.equal(stats.spent,spent,preset);
  assert.equal(cats.reduce((sum,r)=>sum+r.spent,0),stats.spent,preset+" suma categorías");
  assert.deepEqual(Array.from(cats,r=>r.id),ids,preset+" categorías");
  if(preset==="cycle"){
    assert.equal(stats.income,5,"Bizum en otro banco suma en el ciclo y no duplica la nómina");
    assert.equal(stats.against,60);
    assert.equal(stats.remaining,940);
    assert.deepEqual(stats,ctx.monthBudgetStats(state),"sin ventana explícita mantiene Mi ciclo");
  }
  console.log("✓ periodo "+preset+" comparte categorías y cifra");
}
const from=ctx.presetBoundsMs("custom",{from:"2026-08-10",to:"2026-08-20"});
assert.equal(new ctx.Date(from.from).getHours(),0,"desde medianoche local");
assert.equal(new ctx.Date(from.to).getHours(),23,"hasta fin del día local");
assert.equal(ctx.inBounds(new ctx.Date(2026,7,10,0,0).getTime(),from),true);
assert.equal(ctx.inBounds(new ctx.Date(2026,7,20,23,59,59,999).getTime(),from),true);
const future={...state,expenses:state.expenses.concat(expense("futuro","2026-10-03",900,"super"))};
const cycle=ctx.gastosPeriodOf("cycle",ctx.presetBoundsMs("cycle",{},payday.start),payday);
assert.equal(ctx.monthBudgetStats(future,null,null,null,cycle).spent,65,"el futuro no consume el ciclo actual");
assert.equal(JSON.stringify(state),before,"leer periodos no modifica histórico ni ajustes");
console.log("✓ fronteras locales, futuro y ausencia de mutaciones");

const boundaryArgs=[fileURLToPath(import.meta.url),"--utc-boundary"];
const boundary=spawnSync(process.execPath,boundaryArgs,{env:{...process.env,TZ:"UTC"},stdio:"inherit"});
if(boundary.status!==0) process.exit(boundary.status||1);
const mutant=spawnSync(process.execPath,boundaryArgs.concat("--mutation=local-end"),{env:{...process.env,TZ:"UTC"},stdio:"inherit"});
assert.equal(mutant.status,2,"volver al cierre local tiene que dejar otra vez la nómina fuera");

function utcBoundary(mutate){
  const gastos=fs.readFileSync(new URL("../src/modules/04-tab-gastos.js",import.meta.url),"utf8");
  assert.match(gastos,/const periodKey=todayKey\+"\|"\+madridHoy\.ym/);
  assert.match(gastos,/\[preset,range,cycle,periodKey\]/);
  const reloj=Date.parse("2026-09-30T22:01:00Z");
  let ctx;
  if(mutate){
    const html=fs.readFileSync(new URL("../public/index.html",import.meta.url),"utf8");
    const from="const monthEnd=inicioDeMesMs(Date.UTC(madrid.y, madrid.m, 15, 12))-1;";
    const local="const monthEnd=new Date(now.getFullYear(),now.getMonth()+1,1).getTime()-1;";
    assert.equal(html.split(from).length,2,"el cierre Madrid está una sola vez en el bundle");
    ctx=loadPureLogic(html.replace(from,local));
  } else ctx=loadPureLogicFromFile();
  vm.runInContext(`
    const NativeDate=Date;
    Date=class extends NativeDate {
      constructor(...args){ super(...(args.length?args:[${reloj}])); }
      static now(){ return ${reloj}; }
      static parse(v){ return NativeDate.parse(v); }
      static UTC(...a){ return NativeDate.UTC(...a); }
    };
  `, ctx);
  const state={budget:500,settings:{budgetCycle:true,gTotalMode:"net",expenseBanks:["sabadell"]},
    accounts:[{ent:"sabadell",role:"diario",spendFrom:true,value:400}],
    expenses:[],fixed:[],debts:[],oneoffs:[],flows:[]};
  const tx={ent:"sabadell",id:"salary",date:"2026-10-01",amount:-1800,merchant:"NOMINA EMPRESA SL",status:"BOOK"};
  const add=ctx.importObExpenses(state,[tx]);
  assert.ok(add&&add.length===1,"a las 22:01Z Madrid ya admite el BOOK del 1/10");
  assert.equal(add[0].amount,-1800);
  assert.ok(String(add[0].date).startsWith("2026-10-01"),add[0].date);
  const booked=Object.assign({},state,{expenses:add});
  assert.equal(ctx.budgetPaydayOf(booked,reloj),null,"en UTC el 30/9 local el ciclo no abre");
  const bounds=ctx.presetBoundsMs("cycle",{},null);
  const inside=ctx.inBounds(ctx.dateMs(add[0].date),bounds);
  const period=ctx.gastosPeriodOf("cycle",bounds,null);
  const stats=ctx.monthBudgetStats(booked,null,null,null,period);
  if(mutate){
    try{
      assert.equal(inside,true);
      assert.equal(stats.remaining,2300);
    }catch(e){
      console.log("✓ mutante local-end muerto: "+String(e.message).split("\n")[0]);
      process.exit(2);
    }
    console.error("mutante local-end no murió");
    process.exit(0);
  }
  assert.equal(inside,true,"el mes de la lista es el de Madrid, no el cierre local de septiembre");
  assert.equal(stats.cycle,false);
  assert.equal(stats.income,1800);
  assert.equal(stats.spent,0);
  assert.equal(stats.remaining,2300);
  assert.equal(ctx.importObExpenses(state,[Object.assign({},tx,{date:"2026-10-02"})]),null,"el día 2 sigue siendo futuro");
  console.log("✓ frontera UTC: nómina del 1/10 dentro del mes Madrid y fuera del ciclo local");
}
