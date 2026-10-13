import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync("src/modules/06-sync-brokers.js","utf8");
const csv=fs.readFileSync("src/modules/05-dialogs-inv.js","utf8");
const now=Date.parse("2026-10-13T12:00:00Z"), yesterday=now-864e5;
let clockNow=now, lang="es";
class Clock extends Date { constructor(...args){ super(...(args.length?args:[clockNow])); } static now(){ return clockNow; } }
const words={es:{},en:{},ca:{}};
const translations=fs.readFileSync("src/modules/01-i18n.js","utf8");
for(const match of translations.matchAll(/Object.assign\(LANG\.(es|en|ca),\{([\s\S]*?)\}\);/g)){
  if(match[2].includes("iv_date_today:")) vm.runInNewContext(match[0],{LANG:words});
}
const ctx=vm.createContext({Date:Clock,MC_TZ:"Europe/Madrid",t:k=>words[lang][k],
  tf:(k,v)=>words[lang][k].replace(/\{(\w+)\}/g,(_,name)=>v[name]),loc:()=>({es:"es-ES",en:"en-GB",ca:"ca-ES"}[lang])});
vm.runInContext(source.slice(source.indexOf("function investmentStampMs("),source.indexOf("function Investments(")),ctx);
let count=0;
function check(name,fn){ fn(); count++; console.log("  ✓ "+name); }
check("ausente, inválido, futuro y tipos extraños no se convierten en hoy",()=>{
  for(const v of [undefined,null,"",0,-1,"ayer","2026-10-13",true,{},now+1]) assert.equal(ctx.investmentStampMs(v),0);
  assert.equal(ctx.investmentStampMs(yesterday),yesterday);
  assert.equal(ctx.investmentStampMs(new Clock(yesterday).toISOString()),yesterday);
  assert.equal(ctx.investmentDateText(null),"Fecha no disponible");
  assert.equal(ctx.investmentDateText(yesterday),"ayer a las 14:00");
});
check("días de Madrid: medianoche, mes, año, bisiesto y días de 23/25 horas",()=>{
  const cases=[
    ["2026-10-13T12:00:00Z","2026-10-12T22:30:00Z","hoy a las 00:30"],
    ["2026-10-12T22:01:00Z","2026-10-12T21:59:00Z","ayer a las 23:59"],
    ["2026-10-31T23:01:00Z","2026-10-31T22:59:00Z","ayer a las 23:59"],
    ["2026-12-31T23:01:00Z","2026-12-31T22:59:00Z","ayer a las 23:59"],
    ["2024-02-29T23:01:00Z","2024-02-29T22:59:00Z","ayer a las 23:59"],
    ["2026-03-29T22:01:00Z","2026-03-28T23:30:00Z","ayer a las 00:30"],
    ["2026-10-25T23:01:00Z","2026-10-24T22:30:00Z","ayer a las 00:30"],
    ["2026-10-25T02:30:00Z","2026-10-25T00:30:00Z","hoy a las 02:30"],
    ["2026-10-25T02:30:00Z","2026-10-25T01:30:00Z","hoy a las 02:30"],
    ["2026-10-13T12:00:00Z","2026-10-11T21:59:00Z","hace 2 días"],
    ["2026-10-13T12:00:00Z","2026-10-07T12:00:00Z","hace 6 días"],
    ["2026-10-13T12:00:00Z","2026-10-06T12:00:00Z","6 oct"],
    ["2026-01-02T12:00:00Z","2025-12-31T12:00:00Z","hace 2 días"],
    ["2026-01-07T12:00:00Z","2025-12-31T12:00:00Z","31 dic 2025"],
  ];
  try{
    for(const [today,stamp,label] of cases){ clockNow=Date.parse(today); assert.equal(ctx.investmentDateText(stamp),label,today+" / "+stamp); }
  }finally{ clockNow=now; }
});
check("las fechas relativas usan las traducciones reales de los tres idiomas",()=>{
  try{
    for(const [code,today,prev,days] of [["es","hoy a las 14:00","ayer a las 14:00","hace 3 días"],
      ["en","today at 14:00","yesterday at 14:00","3 days ago"],["ca","avui a les 14:00","ahir a les 14:00","fa 3 dies"]]){
      lang=code;assert.equal(ctx.investmentDateText(now),today);assert.equal(ctx.investmentDateText(yesterday),prev);assert.equal(ctx.investmentDateText(now-3*864e5),days);
    }
  }finally{ lang="es"; }
});
check("dos orígenes y uno sin fecha; el precio y el guardado global no son lecturas",()=>{
  const s={lastTrSync:yesterday,lastMiSync:now-3*864e5,lastPriceSync:now,_savedAt:now,investments:[]};
  assert.equal(ctx.investmentDataDate(s,"trade_republic").ms,yesterday);
  assert.equal(ctx.investmentDataDate(s,"myinvestor").ms,now-3*864e5);
  assert.equal(ctx.investmentDataDate(s,"revolut").ms,0);
  assert.equal(ctx.investmentDataDate(s,"degiro").ms,0);
});
check("CSV y cambio manual conservan procedencia y no rejuvenecen otros brókers",()=>{
  const s={lastRevolutImport:yesterday,lastMiSync:now-3*864e5,investments:[{ent:"myinvestor",manualUpdatedAt:new Clock(now).toISOString()}]};
  assert.equal(ctx.investmentDataDate(s,"revolut").kind,"iv_data_import");
  assert.equal(ctx.investmentDataDate(s,"revolut").ms,yesterday);
  assert.equal(ctx.investmentDataDate(s,"myinvestor").kind,"iv_data_manual");
  assert.equal(ctx.investmentDataDate(s,"myinvestor").ms,now);
  assert.equal(ctx.investmentDataDate(s,"trade_republic").ms,0);
  s.lastMiSync=now; s.investments[0].manualUpdatedAt=new Clock(yesterday).toISOString();
  assert.equal(ctx.investmentDataDate(s,"myinvestor").kind,"iv_data_sync");
});

// Ejecutamos los apply reales: un sello correcto en un helper no prueba que la tarjeta lo guarde.
function applyCard(kind, initial, readAt, noPositions=false){
  if(arguments.length<3) readAt=yesterday;
  const file=kind==="csv"?csv:source;
  const component=file.indexOf("function "+({mi:"MyInvestorSync",tr:"TRSync",csv:"BrokerImport"}[kind])+"(");
  const from=file.indexOf("  const apply=function(){",component);
  const until=file.indexOf(kind==="csv"?'  if(open===false)':'  const disconnect=',from);
  assert.ok(component>=0&&from>component&&until>from);
  const positions=noPositions?null:[{isin:"SYNTHETIC",ticker:"TEST",name:"Posición sintética",shares:2,value:200,cost:null}];
  let state=structuredClone(initial);
  const env={positions,parsed:{positions},map:{SYNTHETIC:"i",TEST:"i"},cash:null,totals:null,
    state,dataReadAt:{current:readAt},investmentStampMs:ctx.investmentStampMs,mappedN:1,keyOf:p=>p.isin,costOf:p=>p.cost,
    fromEurAmt:v=>v,uid:()=>"created",Date:Clock,fetchPrices:null,
    set:fn=>{state=fn(state);},setDoneN:()=>{},setPositions:()=>{},setStep:()=>{},setParsed:()=>{},setText:()=>{}};
  Function(...Object.keys(env),file.slice(from,until)+"apply();")(...Object.values(env));
  return state;
}
for(const [kind,key] of [["mi","lastMiSync"],["tr","lastTrSync"],["csv","lastRevolutImport"]]){
  check("apply "+kind+": solo su fecha, sin tocar costes ausentes ni importes ajenos",()=>{
    const initial={lastPriceSync:now-1000,lastTrSync:10,lastMiSync:20,lastRevolutImport:30,
      investments:[{id:"i",ent:kind==="mi"?"myinvestor":kind==="tr"?"trade_republic":"revolut",isin:"SYNTHETIC",shares:1,value:100,cost:80,cur:"EUR"},
        {id:"other",ent:"other",value:300,cost:250}],accounts:[{value:400}],expenses:[{amount:5}]};
    const next=applyCard(kind,initial);
    assert.equal(next[key],kind==="csv"?now:yesterday);
    for(const other of ["lastTrSync","lastMiSync","lastRevolutImport","lastPriceSync"].filter(k=>k!==key)) assert.equal(next[other],initial[other]);
    assert.deepEqual(next.investments[0],{...initial.investments[0],shares:2,value:200});
    assert.deepEqual(next.investments[1],initial.investments[1]);
    assert.deepEqual(next.accounts,initial.accounts);
    assert.deepEqual(next.expenses,initial.expenses);
  });
}
for(const kind of ["mi","tr"])check("apply "+kind+": sin lectura válida no borra el sello ni toca la cartera",()=>{
  const initial={lastMiSync:20,lastTrSync:10,investments:[{id:"i",value:100,cost:80}],accounts:[],expenses:[]};
  for(const stamp of [null,undefined,0,"inválida",now+1]) assert.deepEqual(applyCard(kind,initial,stamp),initial);
  assert.deepEqual(applyCard(kind,initial,yesterday,true),initial);
});
console.log("investment-data-date: "+count+" PASS / 0 FAIL");
