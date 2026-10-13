import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync("src/modules/06-sync-brokers.js","utf8");
const csv=fs.readFileSync("src/modules/05-dialogs-inv.js","utf8");
const now=Date.parse("2026-10-13T12:00:00Z"), yesterday=now-864e5;
class Clock extends Date { constructor(...args){ super(...(args.length?args:[now])); } static now(){ return now; } }
const ctx=vm.createContext({Date:Clock,MC_TZ:"Europe/Madrid",t:k=>k,tf:(k,v)=>k+JSON.stringify(v),loc:()=>"es-ES"});
vm.runInContext(source.slice(source.indexOf("function investmentStampMs("),source.indexOf("function Investments(")),ctx);
let count=0;
function check(name,fn){ fn(); count++; console.log("  ✓ "+name); }
check("ausente, inválido, futuro y tipos extraños no se convierten en hoy",()=>{
  for(const v of [undefined,null,"",0,-1,"ayer","2026-10-13",true,{},now+1]) assert.equal(ctx.investmentStampMs(v),0);
  assert.equal(ctx.investmentStampMs(yesterday),yesterday);
  assert.equal(ctx.investmentStampMs(new Clock(yesterday).toISOString()),yesterday);
  assert.equal(ctx.investmentDateText(null),"iv_date_missing");
  assert.equal(ctx.investmentDateText(yesterday),"12 oct 2026, 14:00");
});
check("el día y la hora son de Madrid incluso en fronteras y cambios de hora",()=>{
  for(const [stamp,label] of [
    ["2026-03-28T23:30:00Z","29 mar 2026, 0:30"],
    ["2026-03-29T01:30:00Z","29 mar 2026, 3:30"],
    ["2025-10-26T00:30:00Z","26 oct 2025, 2:30"],
    ["2025-10-26T01:30:00Z","26 oct 2025, 2:30"],
    ["2026-10-12T22:30:00Z","13 oct 2026, 0:30"],
  ]) assert.equal(ctx.investmentDateText(stamp),label.replace(/, (\d):/,", 0$1:"));
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
function applyCard(kind, initial){
  const file=kind==="csv"?csv:source;
  const component=file.indexOf("function "+({mi:"MyInvestorSync",tr:"TRSync",csv:"BrokerImport"}[kind])+"(");
  const from=file.indexOf("  const apply=function(){",component);
  const until=file.indexOf(kind==="csv"?'  if(open===false)':'  const disconnect=',from);
  assert.ok(component>=0&&from>component&&until>from);
  const positions=[{isin:"SYNTHETIC",ticker:"TEST",name:"Posición sintética",shares:2,value:200,cost:null}];
  let state=structuredClone(initial);
  const env={positions,parsed:{positions},map:{SYNTHETIC:"i",TEST:"i"},cash:null,totals:null,
    state,dataReadAt:{current:yesterday},mappedN:1,keyOf:p=>p.isin,costOf:p=>p.cost,
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
console.log("investment-data-date: "+count+" PASS / 0 FAIL");
