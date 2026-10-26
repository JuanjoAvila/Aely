import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createLogicSandbox } from "../scripts/load-pure-logic.mjs";

// Se ejecutan las fuentes editables completas hasta el mismo límite del cargador puro,
// sin depender de un public/index.html que podría pertenecer a otra revisión.
const root=new URL("../",import.meta.url);
const order=JSON.parse(fs.readFileSync(new URL("src/build-order.json",root),"utf8"));
let source=order.map(file=>fs.readFileSync(new URL("src/modules/"+file,root),"utf8")).join("\n");
const mutant=process.argv.includes("--repeat-validation-mutant");
if(mutant){
  const from='const startDays=debts.map(function(d){ return d.months!=null&&netWorthPointOk(d.startDay,0,"9999-12-31")?d.startDay:null; });';
  assert.equal(source.split(from).length,2,"punto único de mutación causal");
  assert.equal(source.split('if(startDay!=null){').length,2,"guarda única de nacimiento validado");
  source=source.replace(from,'const startDays=debts.map(function(d){ return d.startDay; });')
    .replace('if(startDay!=null){','if(d.months!=null&&netWorthPointOk(startDay,0,"9999-12-31")){');
}
const cut=source.search(/\nclass ErrorBoundary\b/);
assert.ok(cut>0,"límite real de lógica pura");
const c=vm.createContext(createLogicSandbox());
vm.runInContext(source.slice(0,cut),c,{filename:"src/modules:FIN37"});
const cents=value=>Math.round(value*100);
const freeze=value=>{if(value&&typeof value==="object"){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const month=day=>Number(day.slice(0,4))*12+Number(day.slice(5,7))-1;
const today="2026-10-25";
const days=Array.from({length:420},(_,i)=>new Date(Date.parse(today+"T12:00:00Z")-(419-i)*864e5).toISOString().slice(0,10));
function validDay(day){
  if(typeof day!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(day))return false;
  const [y,m,d]=day.split("-").map(Number),leap=y%4===0&&(y%100!==0||y%400===0);
  return m>=1&&m<=12&&d>=1&&d<=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31][m-1];
}
function eventDay(m,charge){return String(Math.floor(m/12)).padStart(4,"0")+"-"+String(m%12+1).padStart(2,"0")+"-"+String(charge).padStart(2,"0");}
function events(from,to,charge){
  let count=0;for(let m=month(from)-1;m<=month(to);m++)if(eventDay(m,charge)>from&&eventDay(m,charge)<=to)count++;
  return count;
}
// Oráculo de calendario e importes enteros: enumera cargos, sin auxiliares financieros
// de la app. Para APR deshace la recurrencia como fracción exacta hasta el redondeo final.
function debtOracle(d,day,now=today){
  const term=d.months!=null,charge=d.day>0?d.day:1,anchor=typeof d.asOf==="number"?d.asOf:month(now);
  const principal=cents(d.value),amort=cents(d.amort!=null?d.amort:d.monthly||0);
  if(term&&(validDay(d.startDay)?day<d.startDay:Number.isInteger(d.startMonth)&&month(day)<d.startMonth))return 0;
  let n=0,paid=0;
  if(term){
    for(let m=anchor;m<=month(day);m++)if(eventDay(m,charge)<=day)n++;
    for(let m=anchor;m<=month(now);m++)if(eventDay(m,charge)<=now)paid++;
  }else{
    paid=month(now)-anchor;n=paid-events(day,now,charge);
    if(!(amort>0&&principal>0.5&&!d.settledAt))n=Math.max(0,n);
  }
  let value=principal-amort*n;
  const apr=Number(String(d.apr??"").replace(",","."));
  const effectiveRate=!term&&d.amort==null&&apr>0&&(principal-amort*Math.max(0,month(now)-anchor))*apr/1200<cents(d.monthly);
  if(effectiveRate&&n<paid){
    const apr100=BigInt(Math.round(apr*100)),denRate=120000n,numRate=denRate+apr100;
    let num=BigInt(principal-amort*paid),den=1n;
    for(let i=n;i<paid;i++){num=(num+BigInt(cents(d.monthly))*den)*denRate;den*=numRate;}
    value=Number(num)/Number(den);
  }
  if(d.balloon>0&&term&&n>=d.months)value-=cents(d.balloon);
  if(n<0&&d.original>0)value=Math.min(value,Math.max(cents(d.original),principal));
  return Math.max(0,value);
}
const row=(extra={})=>({id:"same",name:"Sintética",value:600.12,monthly:50.01,months:12,day:20,asOf:2026*12+8,startMonth:2026*12+8,startDay:"2026-09-10",...extra});
const fixtures=[
  row(),row({value:360.09,monthly:30.01,startDay:"2026-10-10",startMonth:2026*12+9}),
  row({id:undefined,startDay:"2026-02-30"}),row({id:undefined,startDay:undefined}),
  row({startDay:null}),row({startDay:42}),row({startDay:"2026-10-10T00:00:00Z"}),
  row({startDay:"2024-02-29",startMonth:undefined}),row({startDay:"2025-02-29"}),
  row({startDay:"2027-01-01",asOf:2027*12,startMonth:2027*12}),
  row({startDay:"9999-12-31",startMonth:undefined}),row({startDay:undefined,startMonth:undefined,asOfDate:"2026-09-10"}),
  row({startDay:"2026-09-10",months:0,balloon:100.01}),
  row({value:600.03,amort:50.01,monthly:50.01,months:2,balloon:500.01,archivedAt:"2026-10-20"}),
  row({months:undefined,startDay:"2026-10-10",startMonth:2026*12+9,value:5000.07,monthly:100.01,original:5500.11}),
  row({months:undefined,startDay:"2026-10-10",day:undefined,value:1000.07,monthly:10.01,settledAt:"2026-10-01"}),
  row({months:undefined,value:1200.07,monthly:20.01,apr:"1,05"}),
  row({months:undefined,value:5000.07,monthly:20.01,apr:105}),
  row({months:undefined,value:5000.07,monthly:20.01,amort:15.03,apr:1.05}),
  row({startDay:undefined,startMonth:undefined,asOf:undefined,monthly:0}),
];
let moneyChecks=0;
function checkPolicy(ds,now=today,current){
  const state=freeze({debts:ds}),saved=JSON.stringify(state),policy=c.netWorthDebtPolicy(state,now,current);
  for(const day of days.filter(day=>day<=now)){
    const expected=day===now&&current!=null?cents(current):Math.round(ds.reduce((n,d)=>n+debtOracle(d,day,now),0));
    assert.equal(cents(policy.at(day)),expected,"serie monetaria "+day+" "+JSON.stringify(ds));moneyChecks++;
  }
  assert.equal(cents(policy.current),current!=null?cents(current):Math.round(ds.reduce((n,d)=>n+debtOracle(d,now,now),0)));
  assert.equal(policy.timingUnknown,ds.some(d=>d.months==null&&!(d.day>0)));
  const notes=JSON.parse(JSON.stringify(policy.notes));
  assert.equal(notes.length,ds.length);
  ds.forEach((d,i)=>{
    const a=d.amort!=null?d.amort:d.monthly||0,estimated=a>0&&d.value>0.005&&!d.settledAt;
    const apr=d.apr==null||d.apr===""?null:Number(String(d.apr).replace(",","."));
    assert.deepEqual(notes[i],{kind:"debt",name:d.name,estimated,constant:!estimated,noRate:estimated&&d.months==null&&d.amort==null&&apr==null,badRate:estimated&&d.months==null&&d.amort==null&&apr>0&&(d.value-a*Math.max(0,month(now)-(d.asOf??month(now))))*apr/1200>=d.monthly});
  });
  assert.equal(JSON.stringify(state),saved,"la consulta conserva el estado");
}
for(const d of fixtures)checkPolicy([d]);
checkPolicy(fixtures);checkPolicy(fixtures,today,1900.17);checkPolicy([]);
// Política nueva, mismas identidades duplicadas y nuevo array/fecha: nada de cachés globales.
checkPolicy([row({startDay:"2026-10-15"}),row({value:900.13,startDay:"2026-10-01"})]);
checkPolicy([row({startDay:"2026-09-01"}),row({value:900.13,startDay:"2026-10-20"})]);
for(const [instant,expected] of [["2026-03-28T23:30:00Z","2026-03-29"],["2026-10-24T22:30:00Z","2026-10-25"],["2026-12-31T23:30:00Z","2027-01-01"]]){
  assert.equal(c.netWorthDay(Date.parse(instant)),expected);moneyChecks++;
}
// El día civil de nacimiento se conserva antes/en/después del cambio de año y los
// dos cambios horarios; la primera cuota se contrasta aparte del nacimiento.
for(const [birth,before,on,after] of [
  ["2027-01-01","2026-12-31T22:59:59.999Z","2026-12-31T23:00:00Z","2027-01-01T23:00:00Z"],
  ["2026-03-29","2026-03-28T22:59:59.999Z","2026-03-28T23:00:00Z","2026-03-29T22:00:00Z"],
  ["2026-10-25","2026-10-24T21:59:59.999Z","2026-10-24T22:00:00Z","2026-10-25T23:00:00Z"],
]){
  const d=row({startDay:birth,startMonth:month(birth),asOf:month(birth)+1,day:20});
  const labels=[before,on,after].map(ms=>c.netWorthDay(Date.parse(ms)));
  const now=eventDay(month(birth)+1,21),p=c.netWorthDebtPolicy(freeze({debts:[d]}),now);
  assert.equal(cents(p.at(labels[0])),0);assert.equal(cents(p.at(labels[1])),60012);assert.equal(cents(p.at(labels[2])),60012);
  assert.equal(cents(p.at(eventDay(month(birth)+1,19))),60012);assert.equal(cents(p.at(eventDay(month(birth)+1,20))),55011);moneyChecks+=5;
  const s=freeze({accounts:[{id:"cash",ent:"efectivo",value:5000.13,role:"fijos"}],expenses:[],investments:[],assets:[],debts:[d],accountBalanceHistory:{"acc:cash":[{day:labels[0],value:5000.13}]}});
  const points=c.netWorthSeries(s,{today:now,liquid:5000.13,invested:0});
  for(const point of points){assert.equal(cents(point.value),500013-Math.round(debtOracle(d,point.day,now)),"frontera civil "+birth+" "+point.day);moneyChecks++;}
}
// Serie real completa: efectivo constante conocido, sin flujos ni inversiones. El único
// cambio monetario es cada deuda del ledger sintético anterior.
const state=freeze({accounts:[{id:"cash",ent:"efectivo",value:5000.13,role:"fijos"}],expenses:[],investments:[],assets:[],debts:fixtures,
  accountBalanceHistory:{"acc:cash":[{day:days[0],value:5000.13}]}});
const series=c.netWorthSeries(state,{today,liquid:5000.13,invested:0});
assert.equal(series.length,days.length);
series.forEach((point,i)=>{assert.equal(point.day,days[i]);assert.equal(cents(point.value),500013-Math.round(fixtures.reduce((n,d)=>n+debtOracle(d,point.day),0)),"netWorthSeries "+point.day);moneyChecks++;});
console.log("FIN37_ORACLE "+JSON.stringify({fixtures:fixtures.length,moneyChecks,seriesDays:series.length,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,source:"editable modules",stateFrozen:true}));

let calls=0;
const real=c.netWorthPointOk;
c.netWorthPointOk=function(day,value,limit){if(value===0&&limit==="9999-12-31")calls++;return real(day,value,limit);};
// El formatter sigue perteneciendo al binding real que lee netWorthPointOk; no se cambia
// el resultado ni el coste por llamada, solo se observan las invocaciones efectivas.
c.netWorthPointOk.utc=real.utc;
const many=freeze(Array.from({length:300},(_,i)=>row({id:i%3?"duplicate":undefined,value:600.12+i/100,startDay:i%2?"2026-09-10":"2026-02-30"})));
const p=c.netWorthDebtPolicy({debts:many},today),constructionCalls=calls;
for(const day of days){
  assert.equal(cents(p.at(day)),Math.round(many.reduce((n,d)=>n+debtOracle(d,day),0)),"oráculo de coste "+day);moneyChecks++;
}
console.log("FIN37_COST "+JSON.stringify({debts:many.length,days:days.length,constructionCalls,totalValidationCalls:calls,expectedAtMost:many.length,moneyChecks}));
assert.ok(calls<=many.length,"FIN37 coste: validar startDay como máximo una vez por deuda/política; observado="+calls+", máximo="+many.length);
const previous=calls,changed=freeze(many.map((d,i)=>({...d,startDay:i%2?"2026-10-20":"2026-09-01"})));
const fresh=c.netWorthDebtPolicy({debts:changed},today,1900.17);
assert.equal(calls-previous,300,"una política nueva revalida cada fila aun con saldo actual suministrado");
for(const day of ["2026-09-01","2026-10-19","2026-10-20"]){assert.equal(cents(fresh.at(day)),Math.round(changed.reduce((n,d)=>n+debtOracle(d,day),0)));moneyChecks++;}
assert.equal(calls-previous,300,"consultar días no vuelve a validar");
console.log("FIN37_FRESH "+JSON.stringify({newPolicyCalls:calls-previous,totalCalls:calls,mutant}));
console.log("FIN37 PASS "+moneyChecks+" comprobaciones monetarias y coste acotado");
