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
function mutationResult(source,name,change,contract=identityContract){
 const changed=change(source);
 // Un ancla ausente o un error de compilación son fallos del arnés, nunca evidencia
 // de que el oráculo financiero detectó la regresión. Solo ese oráculo cuenta muertes.
 if(changed===source)throw Object.assign(new Error(name+": texto de mutación no encontrado"),{code:"MUTATION_NOT_APPLIED"});
 const mutant=serverModule(changed);
 try{contract(mutant);}catch(error){
  if(!(error instanceof assert.AssertionError))throw error;
  return {name,status:"killed",code:error.code};
 }
 throw Object.assign(new Error(name+": mutante superviviente"),{code:"MUTANT_SURVIVED"});
}

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
 // FIN10 v2 filtra antes de que FIN15 consuma la identidad banco/referencia.
 // La misma ranura/ref del día contable siguiente sobrevive a la lápida anterior.
 const retired={...pending,importe:99,source:pending.source+"#accsynthetic-account-a#n2"};
 const survivor={...booked,source:booked.source+"#accsynthetic-account-a#n2"};
 const marker="ob-absorbed2|caixabank|stable-ref|2|synthetic-account-a|2026-10-14";
 for(const rows of orders([retired,survivor]))assert.deepEqual(server.filasComoLaApp(rows,[marker]),[survivor]);
 // Un borrado por clave vieja tampoco consume la referencia de la superviviente.
 assert.deepEqual(server.filasComoLaApp([pending,booked],[server.claveComoLaApp(pending)]),[booked]);
 const legacy={...pending,source:"ob:caixabank"};
 for(const rows of orders([legacy,pending]))assert.equal(sum(server.filasComoLaApp(rows,[])),320);
 const escaped={...booked,source:"ob:caixabank#refstable%2Dref"};
 assert.equal(sum(server.filasComoLaApp([pending,escaped],[])),320);
 assert.doesNotThrow(()=>server.filasComoLaApp([{...pending,source:"ob:caixabank#ref%invalid"}],[]));
 // Una referencia vacía no acredita identidad entre días. Ni un marcador #ref
 // en otra fuente ni un OB sin banco autorizan a fusionar filas independientes.
 for(const source of ["ob:caixabank#ref","ob:#refstable","manual:caixabank#refstable","wallet#refstable"]){
  for(const rows of orders([{...pending,source},{...booked,source}])){
   assert.equal(sum(server.filasComoLaApp(rows,[])),640,"identidad no bancaria o vacía: "+source);
  }
 }
}
test("FIN15 identidad: sin fusionar referencias distintas ni perder legacy o lapidas",()=>identityContract(budget));

test("FIN15 y FIN10 v2: fila retirada no consume referencia y no alcanza otro dia",()=>{
 const retired={...pending,importe:99,source:pending.source+"#accsynthetic-account-a#n2"};
 const survivor={...booked,source:booked.source+"#accsynthetic-account-a#n2"};
 const deleted=["ob-absorbed2|caixabank|stable-ref|2|synthetic-account-a|2026-10-14"];
 for(const rows of orders([retired,survivor])){
  const incoming=rows.map(c.expenseFromRow).filter(e=>!c.expenseIsTombstoned(e,c.expenseDeletedSet({deleted})));
  assert.equal(cents({...state(),expenses:c.mergeExpensesFromCloud([],incoming).list}),320);
  assert.deepEqual(budget.filasComoLaApp(rows,deleted),[survivor]);
 }
});

function accountlessWildcardSurvivor(server){
 const hidden={...pending,source:pending.source+"#accsynthetic-account-a#n2"};
 const survivor={...booked,source:booked.source+"#accsynthetic-account-a#n2"};
 // La fila tiene cuenta conocida: la lápida vacía solo la alcanza por el comodín,
 // no por igualdad de clave. La BOOK del otro día conserva la misma referencia.
 const deleted=["ob-absorbed2|caixabank|stable-ref|2||2026-10-14"];
 assert.deepEqual(server.filasComoLaApp([hidden],deleted),[]);
 assert.deepEqual(server.filasComoLaApp([survivor],deleted),[survivor]);
 for(const [order,rows] of orders([hidden,survivor]).entries()){
  const filtered=server.filasComoLaApp(rows,deleted),serverCents=sum(filtered);
  console.log(JSON.stringify({accountlessWildcardSurvivor:{order,serverCents,expectedCents:320}}));
  assert.equal(serverCents,320,"la oculta por comodin no puede consumir la referencia y dejar cero");
  assert.deepEqual(filtered,[survivor]);
 }
}
test("FIN15 comodin sin cuenta: fila oculta no consume referencia superviviente",()=>{
 accountlessWildcardSurvivor(budget);
 const source=read("supabase/functions/_shared/presupuesto.ts");
 const result=mutationResult(source,"comodin consume referencia antes de retirar fila",s=>s.replace(
  'if (cuentaAusente.has(base) || (!cuentaDeSource(f.source) && sinCuenta.has(base))) continue;',
  'if (cuentaAusente.has(base) || (!cuentaDeSource(f.source) && sinCuenta.has(base))) { const hiddenRef = referenciaOb(f); if (hiddenRef) referencias.add(hiddenRef); continue; }'
 ),accountlessWildcardSurvivor);
 assert.equal(result.status,"killed");
});

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
  ["ignora lapida de absorcion",s=>s.replace('if (legacy && lap.has(legacy)) continue;','')],
  ["ignora lapida v2 antes de identidad FIN15",s=>s.replace('if (absorbed && lap.has(absorbed)) continue;','')],
  ["ignora lapida legacy",s=>s.replace('if (lap.has(k)) continue;','')],
  ["rompe fallback sin referencia",s=>s.replace('if (anteriores && (!ref || anteriores.has(""))) continue;','if (false) continue;')],
  ["no decodifica referencia",s=>s.replace('JSON.stringify([bank, decodeURIComponent(ref[1])])','JSON.stringify([bank, ref[1]])')],
  ["acepta #ref vacio como identidad",s=>s.replace('/#ref([^#]+)/','/#ref([^#]*)/')],
  ["quita guarda banco y prefijo OB",s=>s.replace('if (!bank || (!source.startsWith("ob:") && !source.startsWith("ob-hist:"))) return "";','')],
 ];
 identityContract(budget);
 const results=mutations.map(([name,change])=>mutationResult(source,name,change));
 assert.equal(results.filter(r=>r.status==="killed").length,mutations.length);
 console.log("FIN15: "+results.length+"/"+mutations.length+" mutaciones semanticas muertas");
});

test("FIN15 revision1: arnes distingue texto ausente de fallo semantico",()=>{
 const source=read("supabase/functions/_shared/presupuesto.ts"), killed=[];
 const execute=(name,change,contract)=>killed.push(mutationResult(source,name,change,contract));
 assert.throws(()=>execute("ancla ausente",s=>s.replace("FIN15_ANCLA_INEXISTENTE","")),error=>error.code==="MUTATION_NOT_APPLIED");
 assert.throws(()=>execute("sintaxis rota",s=>s+"\nconst = ;"),error=>!(error instanceof assert.AssertionError));
 assert.throws(()=>execute("cambio inocuo",s=>s+"\n// Sin efecto financiero"),error=>error.code==="MUTANT_SURVIVED");
 assert.throws(()=>execute("oraculo roto",s=>s+"\n// Sin efecto",()=>{throw new TypeError("fixture rota");}),TypeError);
 assert.equal(killed.length,0);
 execute("fallo financiero",s=>s.replace('if (ref && referencias.has(ref)) continue;',''));
 assert.deepEqual(killed.map(r=>r.status),["killed"]);
});

test("FIN15 revision1: guarda banco/prefijo tiene oraculo propio",()=>{
 const source=read("supabase/functions/_shared/presupuesto.ts");
 const result=mutationResult(source,"guarda banco/prefijo",s=>s.replace('if (!bank || (!source.startsWith("ob:") && !source.startsWith("ob-hist:"))) return "";',''));
 assert.equal(result.status,"killed");
});

for(const [i,rows] of orders([{...pending,importe:30},{...booked,importe:33}]).entries())test("FIN15 revision1: PDNG30 BOOK33 fija month/widget dependientes del orden "+i,async()=>{
 const expected=i===0?3000:3300,s=state(),start=budget.inicioDeMesMs(Date.now());
 s.widgetPeriod={v:2,kind:"mes",start,anchor:"",scope:JSON.stringify([2,start,"mes","gasto","",1000,["caixabank"],"caixabank"])};
 const day1=new Date(start+36*3600000).toISOString().slice(0,10),day2=new Date(start+60*3600000).toISOString().slice(0,10);
 const current=rows.map(r=>({...r,fecha:(r.id==="pending"?day1:day2)+"T10:00:00Z"}));
 assert.equal(cents({...s,expenses:c.mergeExpensesFromCloud([],current.map(c.expenseFromRow)).list}),expected);
 assert.equal(Math.round(budget.statsDelMes(budget.filasComoLaApp(current,[]),s,start).spent*100),expected);
 const trigger={...row("trigger","BOOK",new Date().toISOString(),"other","trade_republic")};
 const direct=widgetBudget.widgetSnapshot(s,[...current,trigger],Date.now(),{id:trigger.id,event:"revision1",key:"synthetic"});
 assert.ok(direct);assert.equal(Math.round(direct.spent*100),expected);
 const env=fakeDb({state:s,rows:current});
 const result=await post(env,{fuente:"tr",titulo:"Trade Republic",texto:"Has gastado 0,01 € en Otra cuenta sintetica",fecha:String(Date.now()),evento:"fin15-revision1-"+i});
 assert.equal(result.status,200);assert.equal(Math.round(result.data.month.spent*100),expected);
 // El handler lee month sin ordenar y widget por UUID ascendente: con estos IDs,
 // booked precede a pending. No hay preferencia semántica por BOOK ni por su importe.
 assert.ok(result.data.widget);assert.equal(Math.round(result.data.widget.spent*100),3300);
 const swapped=fakeDb({state:s,rows:current.map(r=>({...r,id:r.id==="pending"?"a-pending":"z-booked"}))});
 const opposite=await post(swapped,{fuente:"tr",titulo:"Trade Republic",texto:"Has gastado 0,01 € en Otra cuenta sintetica",fecha:String(Date.now()),evento:"fin15-revision1-opposite-"+i});
 assert.equal(opposite.status,200);assert.equal(Math.round(opposite.data.month.spent*100),expected);
 assert.ok(opposite.data.widget);assert.equal(Math.round(opposite.data.widget.spent*100),3000);
 console.log(JSON.stringify({revision1Order:i,pending:30,booked:33,monthCents:Math.round(result.data.month.spent*100),widgetDirectCents:Math.round(direct.spent*100),widgetBookedFirstIdCents:Math.round(result.data.widget.spent*100),widgetPendingFirstIdCents:Math.round(opposite.data.widget.spent*100)}));
});
