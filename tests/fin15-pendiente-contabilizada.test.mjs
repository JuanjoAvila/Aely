import assert from "node:assert/strict";
import fs from "node:fs";
import {test} from "node:test";
import {transformSync} from "esbuild";
import {execFileSync} from "node:child_process";
import {loadPureLogic} from "../scripts/load-pure-logic.mjs";
import * as bank from "./helpers/bank-download-fixture.mjs";
import {E,FakeDate,reloj} from "./helpers/banco-sintetico.mjs";
import {budget,widgetBudget,fakeDb,post,read} from "./helpers/ingest-handler-fixture.mjs";

const html=fs.readFileSync(new URL("../public/index.html",import.meta.url),"utf8");
const c=loadPureLogic(html);c.Date=FakeDate;
const now=Date.parse("2026-10-16T10:00:00Z"),pday="2026-10-14",bday="2026-10-15";
const state=()=>({accounts:[{id:"cx",ent:"caixabank",role:"diario",spendFrom:true,value:1000}],settings:{expenseBanks:["caixabank"]},expenses:[],gemelos:[],deleted:[],fixed:[],debts:[],oneoffs:[],flows:[],investments:[],goals:[],assets:[],budget:1000,bankTx:[]});
const tx=(id,status,date)=>({entry_reference:id,booking_date:date,value_date:date,status,transaction_amount:{amount:"3.20",currency:"EUR"},credit_debit_indicator:"DBIT",creditor:{name:"Compra sintetica FIN15"}});
const sync=(s,transactions,extra={})=>bank.updater(html,[{aspsp:"CaixaBank",syncFrom:"2026-10-01",transactions:transactions.map(E.mapTransaction),...extra}],s,c,true).state;
const cents=s=>s.expenses.filter(e=>c.expenseCountsBudget(e,s)).reduce((n,e)=>n+Math.round(e.amount*100),0);
const row=(id,status,date,ref="stable-ref",bank="caixabank")=>({id,user_id:"user",fecha:date,importe:3.2,comercio:"Compra sintetica FIN15",cat:"otros",source:"ob:"+bank+"#ref"+encodeURIComponent(ref)+(status==="PDNG"?"#pdng":"")});
const pending=row("pending","PDNG","2026-10-14T21:59:00Z"),booked=row("booked","BOOK","2026-10-15T10:00:00Z");
const orders=rows=>[rows,[...rows].reverse()];
const sum=rows=>rows.reduce((n,e)=>n+Math.round(Number(e.importe)*100),0);
function serverModule(source){const module={exports:{}};new Function("module","exports",transformSync(source,{loader:"ts",format:"cjs"}).code)(module,module.exports);return module.exports;}

test("FIN15 cliente: import real PDNG/BOOK con referencia estable y dias distintos en ambos ordenes",()=>{
 const old=reloj.ms;reloj.ms=now;
 try{for(const list of orders([tx("stable-ref","PDNG",pday),tx("stable-ref","BOOK",bday)])){
   let s=state();for(const item of list)s=sync(s,[item]);
   assert.equal(cents(s),320);assert.equal(s.expenses.length,1);
   s=sync(s,[list[1]],{truncated:true});assert.equal(cents(s),320);
 }}finally{reloj.ms=old;}
});

for(const [i,rows] of orders([pending,booked]).entries())test("FIN15 ROJO servidor y cliente: medianoche Madrid, orden "+i,()=>{
 const madrid=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Madrid",year:"numeric",month:"2-digit",day:"2-digit"});
 assert.equal(madrid.format(Date.parse(pending.fecha)),pday);assert.equal(madrid.format(Date.parse(booked.fecha)),bday);
 const client=c.mergeExpensesFromCloud([],rows.map(c.expenseFromRow)).list;
 assert.equal(cents({...state(),expenses:client}),320);
 const server=budget.filasComoLaApp(rows,[]);
 console.log(JSON.stringify({order:i,clientCents:cents({...state(),expenses:client}),serverCents:sum(server)}));
 assert.equal(sum(server),320,"la referencia estable no es dos compras por cruzar medianoche");
});

for(const [i,rows] of orders([pending,booked]).entries())test("FIN15 ROJO widget real: orden "+i,()=>{
 const s=state(),start=budget.inicioDeMesMs(now);
 s.widgetPeriod={v:2,kind:"mes",start,anchor:"",scope:JSON.stringify([2,start,"mes","gasto","",1000,["caixabank"],"caixabank"])};
 const trigger=row("trigger","BOOK","2026-10-16T09:00:00Z","other","trade_republic");
 const snapshot=widgetBudget.widgetSnapshot(s,[...rows,trigger],now,{id:trigger.id,event:"fin15",key:"synthetic"});
 assert.ok(snapshot);assert.equal(Math.round(snapshot.spent*100),320);
});

for(const [i,rows] of orders([pending,booked]).entries())test("FIN15 handler ingest real: month y widget tras PDNG/BOOK, orden "+i,async()=>{
 const s=state(),start=budget.inicioDeMesMs(Date.now());
 s.widgetPeriod={v:2,kind:"mes",start,anchor:"",scope:JSON.stringify([2,start,"mes","gasto","",1000,["caixabank"],"caixabank"])};
 // El handler usa el reloj actual. Se conserva la distancia entre días dentro de su mes.
 const day1=new Date(start+36*3600000).toISOString().slice(0,10),day2=new Date(start+60*3600000).toISOString().slice(0,10);
 const env=fakeDb({state:s,rows:rows.map(r=>({...r,fecha:(r.id==="pending"?day1:day2)+"T10:00:00Z"}))});
 const result=await post(env,{fuente:"tr",titulo:"Trade Republic",texto:"Has gastado 0,01 € en Otra cuenta sintetica",fecha:String(Date.now()),evento:"fin15-"+i});
 assert.equal(result.status,200);assert.equal(Math.round(result.data.month.spent*100),320);
 assert.ok(result.data.widget);assert.equal(Math.round(result.data.widget.spent*100),320);
});

test("FIN15 controles: referencias distintas, otro banco, ambiguas y lapida exacta",()=>{
 const other={...booked,source:"ob:caixabank#refother-ref"};
 for(const rows of orders([pending,other]))assert.equal(sum(budget.filasComoLaApp(rows,[])),640);
 for(const rows of orders([pending,{...booked,source:"ob:sabadell#refstable-ref"}]))assert.equal(sum(budget.filasComoLaApp(rows,[])),640);
 const lap=["ob-absorbed|caixabank|stable-ref|1"];
 assert.deepEqual(budget.filasComoLaApp([pending,other],lap),[other]);
 for(const rows of orders([tx("pending-other","PDNG",pday),tx("book-other","BOOK",bday)])){
   let s=state();for(const item of rows)s=sync(s,[item]);assert.equal(cents(s),640,"sin prueba de identidad, importe/comercio no autoriza fusionar");
 }
});

function identityContract(server){
 for(const rows of orders([pending,booked]))assert.equal(sum(server.filasComoLaApp(rows,[])),320);
 // Cerca de medianoche Madrid, ambos timestamps siguen teniendo el mismo día UTC.
 const near={...booked,fecha:"2026-10-14T22:01:00Z",source:"ob:caixabank#refdifferent"};
 for(const rows of orders([pending,near]))assert.equal(sum(server.filasComoLaApp(rows,[])),640);
 const otherBank={...near,source:"ob:sabadell#refstable-ref"};
 for(const rows of orders([pending,otherBank]))assert.equal(sum(server.filasComoLaApp(rows,[])),640);
 const slot={...pending,source:pending.source+"#n2"};
 for(const rows of orders([slot,booked]))assert.deepEqual(server.filasComoLaApp(rows,["ob-absorbed|caixabank|stable-ref|2"]),[booked]);
 // Un borrado por clave vieja tampoco consume la referencia de la superviviente.
 assert.deepEqual(server.filasComoLaApp([pending,booked],[server.claveComoLaApp(pending)]),[booked]);
 const legacy={...pending,source:"ob:caixabank"};
 for(const rows of orders([legacy,pending]))assert.equal(sum(server.filasComoLaApp(rows,[])),320);
 const escaped={...booked,source:"ob:caixabank#refstable%2Dref"};
 assert.equal(sum(server.filasComoLaApp([pending,escaped],[])),320);
 assert.doesNotThrow(()=>server.filasComoLaApp([{...pending,source:"ob:caixabank#ref%invalid"}],[]));
}
test("FIN15 identidad: sin fusionar referencias distintas ni perder legacy o lapidas",()=>identityContract(budget));

test("FIN15 clientes antiguos sin #ref: igualdad exacta contra base 9370565",()=>{
 const old=serverModule(execFileSync("git",["show","9370565008aa2c4df9fb0588b2bf4f97e2cdc726:supabase/functions/_shared/presupuesto.ts"],{encoding:"utf8"}));
 const sources=[null,"","manual","manual:caixabank","supabase","wallet","macrodroid","ob:caixabank","ob:caixabank#n2","ob:caixabank#pdng","ob-hist:caixabank#n3","ob:caixabank#dup","ob:caixabank~recibo.synthetic"];
 let cases=0;
 for(const a of sources)for(const b of sources)for(const reverse of [false,true])for(const deleted of [false,true]){
   const rows=[{...pending,source:a},{...pending,id:"second",source:b},{...booked,source:b}];
   if(reverse)rows.reverse();const lap=deleted?[old.claveComoLaApp(rows[0])]:[];
   assert.deepEqual(budget.filasComoLaApp(rows,lap),old.filasComoLaApp(rows,lap));cases++;
 }
 console.log("FIN15 legacy: "+cases+" comparaciones exactas contra base, sin #ref");
});

test("FIN15 mutaciones semanticas de identidad servidor",()=>{
 const source=read("supabase/functions/_shared/presupuesto.ts");
 const mutations=[
  ["sin dedup por referencia",s=>s.replace('if (ref && referencias.has(ref)) continue;','')],
  ["referencia vuelve a depender del dia",s=>s.replace('JSON.stringify([bank, decodeURIComponent(ref[1])])','JSON.stringify([bank, decodeURIComponent(ref[1]), f.fecha])')],
  ["pierde ambito de banco",s=>s.replace('JSON.stringify([bank, decodeURIComponent(ref[1])])','JSON.stringify([decodeURIComponent(ref[1])])')],
  ["funde referencias distintas por contenido",s=>s.replace('if (anteriores && (!ref || anteriores.has(""))) continue;','if (anteriores) continue;')],
  ["ignora lapida de absorcion",s=>s.replace('if (absorbed && lap.has(absorbed)) continue;','')],
  ["ignora lapida legacy",s=>s.replace('if (lap.has(k)) continue;','')],
  ["rompe fallback sin referencia",s=>s.replace('if (anteriores && (!ref || anteriores.has(""))) continue;','if (false) continue;')],
  ["no decodifica referencia",s=>s.replace('JSON.stringify([bank, decodeURIComponent(ref[1])])','JSON.stringify([bank, ref[1]])')],
 ];
 identityContract(budget);
 for(const [name,change] of mutations){
  const changed=change(source);assert.notEqual(changed,source,name+": mutacion aplicada");
  assert.throws(()=>identityContract(serverModule(changed)),assert.AssertionError,name);
 }
 console.log("FIN15: "+mutations.length+"/"+mutations.length+" mutaciones semanticas muertas");
});
