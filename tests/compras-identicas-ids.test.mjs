import assert from "node:assert/strict";
import fs from "node:fs";
import {test} from "node:test";
import {execFileSync} from "node:child_process";
import vm from "node:vm";
import {loadPureLogic} from "../scripts/load-pure-logic.mjs";
import * as bank from "./helpers/bank-download-fixture.mjs";
import {day,E} from "./helpers/banco-sintetico.mjs";
import {fakeDb,post,budget as server} from "./helpers/ingest-handler-fixture.mjs";

const html=fs.readFileSync(new URL("../public/index.html",import.meta.url),"utf8");
const c=loadPureLogic(html),clone=x=>JSON.parse(JSON.stringify(x));
const date=day(-1), links=transactions=>[{aspsp:"CaixaBank",syncFrom:"2026-01-01",transactions:transactions.map(E.mapTransaction)}];
const state=(expenses=[])=>({accounts:[{id:"cx",ent:"caixabank",role:"diario",spendFrom:true,value:1000}],settings:{expenseBanks:["caixabank"]},expenses,gemelos:[],deleted:[],fixed:[],debts:[],oneoffs:[],flows:[],investments:[],goals:[],assets:[],budget:1000,bankTx:[]});
const tx=id=>({entry_reference:id,booking_date:date,value_date:date,status:"BOOK",transaction_amount:{amount:"9.99",currency:"EUR"},credit_debit_indicator:"DBIT",creditor:{name:"Panaderia sintetica"}});
const expense=(ref,id=ref)=>({id,extId:ref,ent:"caixabank",source:"ob",date:date+"T12:00:00.000Z",amount:9.99,merchant:"Panaderia sintetica",obName:"Panaderia sintetica",category:"otros"});
const cents=(s,ctx=c)=>s.expenses.filter(e=>ctx.expenseCountsBudget(e,s)).reduce((n,e)=>n+Math.round(e.amount*100),0);
const sync=(s,ts,ctx=c)=>{const feed=links(ts),flat=ctx.flattenBankTx(feed,s.bankTx),add=ctx.importObExpenses(s,flat,feed)||[];return {...s,bankTx:flat,expenses:add.concat(s.expenses),gemelos:ctx.pushGemelos(s.gemelos,ctx.gemelosDeImportacion(add,s.expenses))};};
const wire=e=>({id:e.id,user_id:"user",fecha:e.date,importe:e.amount,comercio:e.merchant,cat:e.category,source:c.expenseSourceForCloud(e),ob_name:e.obName});

test("ROJO: estado sembrado y merge conservan dos IDs bancarios distintos",()=>{
 const two=[expense("a"),expense("b")];
 assert.equal(c.mergeExpenses(two,[]).list.length,2);
 assert.equal(c.mergeExpenses([two[0]],[two[1]]).list.length,2);
 assert.equal(c.mergeExpensesFromCloud(two,[]).list.length,2);
 assert.equal(c.mergeExpensesFromCloud([two[0]],[two[1]]).list.length,2);
});

test("ROJO: handler bank-sync REAL y updater REAL conservan ambos cargos",async()=>{
 const response=await bank.sync(()=>({transactions:[tx("a"),tx("b")]}));
 const feed=response.data.links;
 assert.ok(Array.isArray(feed),JSON.stringify(response.data));
 assert.equal(feed[0].transactions.length,2,"el backend entrega las dos referencias");
 const result=bank.updater(html,feed,state(),c).state;
 assert.equal(result.expenses.length,2,"la capa cliente no debe fundirlas");
 assert.equal(cents(result),1998);
});

test("ROJO: relecturas, orden invertido e ID repetido son idempotentes",()=>{
 let s=sync(state(),[tx("a"),tx("b"),tx("a")]);
 assert.equal(s.expenses.length,2);
 assert.equal(cents(s),1998);
 s=sync(s,[tx("b"),tx("a")]);
 assert.equal(s.expenses.length,2);
 s=sync(state(),[tx("a")]);s=sync(s,[tx("b")]);
 assert.equal(s.expenses.length,2,"también en respuestas parciales distintas");
});

test("control: mismo ID e idéntico sin ID siguen siendo un cargo",()=>{
 for(const ts of [[tx("a"),tx("a")],[tx("a"),tx(null)],[tx(null),tx("a")]]){
   const s=sync(state(),ts);assert.equal(s.expenses.length,1);assert.equal(cents(s),999);
 }
});

test("referencias distintas con BOOK y PDNG acreditan dos cargos; mismo ID cuenta uno",()=>{
 const settled={...tx("a"),transaction_amount:{amount:"750.00"}};
 const pending={...settled,entry_reference:"b",status:"PDNG"};
 assert.equal(cents(sync(state(),[settled,pending])),150000);
 assert.equal(cents(sync(state(),[settled,{...pending,entry_reference:"a"}])),75000);
});

test("dos IDs y alias sin ID cuentan dos; mismo ID con datos distintos cuenta uno",()=>{
 const a=tx("a"),b=tx("b"),no=tx(null);
 for(const ts of [[a,b,no],[no,b,a],[b,a,no,no]])assert.equal(cents(sync(state(),ts)),1998);
 const changed={...expense("a","new-local-id"),merchant:"Nombre cambiado",amount:10.01};
 assert.equal(c.mergeExpenses([expense("a")],[changed]).list.length,1);
 assert.equal(c.mergeExpensesFromCloud([expense("a")],[changed]).list.length,1);
 const manual=id=>({...expense("copied-ref",id),source:"manual"});
 assert.equal(c.mergeExpenses([manual("m1")],[manual("m2")]).list.length,2,"la referencia copiada no funde manuales");
});

test("viaje nube: índice único real, otro móvil y lectura parcial conservan referencia y céntimos",async()=>{
 const s=sync(state(),[tx("a"),tx("b")]),env=fakeDb();
 for(const e of s.expenses)await env.db.from("expenses").upsert(wire(e)).select("id");
 assert.equal(env.rows.length,2,"no chocan por usuario/fecha/importe/comercio");
 const decoded=env.rows.map(c.expenseFromRow);
 assert.deepEqual(decoded.map(e=>e.extId).sort(),["a","b"]);
 const b={...state(),expenses:c.mergeExpensesFromCloud([],decoded).list};
 assert.equal(cents(b),1998);
 assert.equal(cents(sync(b,[tx("b")])),1998,"el ID que ya bajó no reaparece");
 assert.equal(cents(sync(b,[tx("c")])),2997,"una referencia nueva sí entra aunque el extracto sea parcial");
 assert.equal(server.filasComoLaApp(env.rows,[]).length,2,"lector servidor vigente conserva ambas ranuras");
});

test("aviso REAL de ingest sin ID reclama sólo uno de los dos cargos bancarios",async()=>{
 const env=fakeDb(),r=await post(env,{fuente:"tr",titulo:"Trade Republic",texto:"Has gastado 9,99 € en Panaderia sintetica",fecha:String(Date.parse(date+"T10:00:00Z")),evento:"synthetic-purchase"});
 assert.equal(r.status,200);assert.equal(env.rows.length,1);
 const notice=c.expenseFromRow(env.rows[0]);assert.equal(notice.extId,undefined);
 const seed={...state([notice]),accounts:[{id:"tr",ent:"trade_republic",role:"diario",spendFrom:true,value:1000}],settings:{expenseBanks:["trade_republic"]}};
 const feed=[{aspsp:"Trade Republic",syncFrom:"2026-01-01",transactions:[tx("a"),tx("b")].map(t=>E.mapTransaction({...t,creditor:undefined}))}];
 const add=c.importObExpenses(seed,c.flattenBankTx(feed),feed)||[];
 const result={...seed,expenses:add.concat(seed.expenses),gemelos:c.pushGemelos(seed.gemelos,c.gemelosDeImportacion(add,seed.expenses))};
 assert.equal(add.length,2);assert.equal(add.filter(e=>e.possibleDup).length,1);
 assert.equal(cents(result),1998,"aviso + el otro cargo, sin perder gasto ni contar tres");
 const again=c.importObExpenses(result,c.flattenBankTx(feed),feed)||[];assert.equal(again.length,0);
});

test("lápidas y orden de la nube conservan las dos ranuras y no resucitan el borrado",()=>{
 const s=sync(state(),[tx("a"),tx("b")]),gone=s.expenses.find(e=>e.extId==="a");
 const deleted={...s,expenses:s.expenses.filter(e=>e!==gone),deleted:[c.keyOfExpense(gone)]};
 const same=sync(deleted,[tx("b"),tx("a")]);assert.equal(cents(same),999);assert.equal(same.expenses.length,1);
 for(const order of [s.expenses,s.expenses.slice().reverse()]){
  const merged=c.mergeExpensesFromCloud(s.expenses,order.map(e=>c.expenseFromRow(wire(e))));
  assert.equal(cents({...s,expenses:merged.list}),1998);assert.equal(merged.changed,false);
 }
});

test("borrado REAL y Deshacer: una lectura parcial nueva no cae en la ranura borrada",()=>{
 let s=sync(state(),[tx("z"),tx("zz")]);
 const start=html.indexOf("  const delExpense=function(e){"),end=html.indexOf("  /* Posible repetido OB",start);
 assert.ok(start>0&&end>start);
 const factory=vm.runInContext('(function(state,set,cloud){const keyOfE=keyOfExpense,undoTimerRef={current:null},undoDeleteRef={current:null};const setUndoDelete=function(){},setTimeout=function(){return 1;},clearTimeout=function(){};'+html.slice(start,end)+'return {del:delExpense,undo:undoLastDelete};})',c);
 const api=factory(s,fn=>{s=fn(s);},{enabled:()=>false});
 api.del(s.expenses.find(e=>e.extId==="z"));
 assert.ok(s.gemelos.some(g=>g.bankRef==="z"));assert.equal(s.deleted.length,1,"una sola lápida por cargo");
 const next=sync(s,[tx("a")]);assert.equal(cents(next),1998,"la nueva referencia no es el cargo borrado");
 assert.equal(sync(next,[tx("z"),tx("a"),tx("zz")]).expenses.length,2,"el cargo borrado no resucita");
 api.undo();assert.equal(s.expenses.length,2);assert.equal(s.deleted.length,0);
 assert.equal(cents(sync(s,[tx("a"),tx("z"),tx("zz")])),2997);
 const gone=expense("cap"),key=c.keyOfExpense(gone),link=c.bankDeletionLink(gone);
 const full=c.lapidaPon({deleted:Array.from({length:499},(_,i)=>"old-"+i)},key);
 assert.equal(full.deleted.length,500);assert.ok(full.deleted.includes("old-0"));
 const received=c.fusionarGemelos([{aviso:"",banco:key}],[link]);
 assert.equal(received[0].bankRef,"cap","el vínculo antiguo se enriquece sin duplicarlo");
 assert.equal(received.length,1);
});

test("tres estados sin colisión conservan el total mensual al céntimo contra 132",()=>{
 const old=loadPureLogic(execFileSync("git",["show","7865111be8e2e1f8994bccba4b515bf4c6193074:public/index.html"],{encoding:"utf8",maxBuffer:8e6}));
 const cases=[
   {name:"compras",seed:state(),feed:[tx("a"),{...tx("b"),transaction_amount:{amount:"14.57"}}]},
   {name:"ingreso y devolución",seed:state(),feed:[{...tx("income"),transaction_amount:{amount:"1800.03"},credit_debit_indicator:"CRDT"},{...tx("refund"),transaction_amount:{amount:"7.17"},credit_debit_indicator:"CRDT"},tx("a")]},
   {name:"manual y recibo modelado",seed:{...state([{...expense(undefined,"manual"),source:"manual",amount:23.45,merchant:"Apunte manual"}]),fixed:[{id:"receipt",name:"Panaderia sintetica",amount:9.99,freq:"mes",day:1,account:"caixabank"}]},feed:[tx("a")]},
 ];
 const evidence=cases.map(x=>{const before=sync(clone(x.seed),x.feed,old),after=sync(clone(x.seed),x.feed);return {name:x.name,beforeCents:cents(before,old),afterCents:cents(after)};});
 for(const row of evidence)assert.equal(row.afterCents,row.beforeCents,row.name);
 console.log(JSON.stringify({threeSyntheticStates:evidence}));
});

test("mutaciones: identidad, referencia en nube, ID repetido y aviso de un solo uso",()=>{
 const mutants=[
  ["ranuras antiguas",s=>s.replace('const groups=new Map(); let out=list;','return list; const groups=new Map(); let out=list;'),m=>{const feed=links([tx("a"),tx("b")]);assert.equal((m.importObExpenses(state(),m.flattenBankTx(feed),feed)||[]).length,2);} ],
  ["sin referencia al subir",s=>s.replace('"#ref"+encodeURIComponent(String(e.extId))','""'),m=>assert.equal(m.expenseFromRow({...wire(expense("a")),source:m.expenseSourceForCloud(expense("a"))}).extId,"a")],
  ["sin guardia de ID dentro de la tanda",s=>s.replace('if(seen[(tx.ent||"")+"|"+tx.id]||seenLegacy[tx.id])return;',''),m=>{const feed=links([tx("a"),{...tx("a"),creditor:{name:"Otro nombre"}}]);assert.equal((m.importObExpenses(state(),m.flattenBankTx(feed),feed)||[]).length,1);} ],
  ["aviso reutilizable",s=>s.replace('usadoDup[hit.i]=1;return hit.e;','return hit.e;'),m=>{const notice={...expense(undefined,"notice"),ent:"caixabank",source:"macrodroid"};const feed=links([tx("a"),tx("b")].map(t=>({...t,creditor:undefined})));const add=m.importObExpenses(state([notice]),m.flattenBankTx(feed),feed)||[];assert.equal(add.filter(e=>e.possibleDup).length,1);} ],
  ["alias sin id suma otro cargo",s=>s.replace('g.conId=Math.max(g.conId||0,obOrdinalOf(c.e));','g.conId=0;'),m=>{const feed=links([tx("a"),tx(null)]);assert.equal((m.importObExpenses(state(),m.flattenBankTx(feed),feed)||[]).length,1);} ],
  ["sin identidad de lápida",s=>s.replace('if(tx.id&&deletedRefs[(tx.ent||"")+"|"+tx.id])return null;',''),m=>{const gone=expense("a"),seed={...state(),deleted:[m.keyOfExpense(gone)],gemelos:[m.bankDeletionLink(gone)]};const feed=links([tx("a")]);assert.equal((m.importObExpenses(seed,m.flattenBankTx(feed),feed)||[]).length,0);} ],
  ["misma referencia con metadatos distintos",s=>s.replaceAll('const ref=esFilaDeBanco(e)&&e.extId&&','const ref=false&&'),m=>assert.equal(m.mergeExpenses([expense("a")],[{...expense("a","second"),merchant:"Nombre posterior"}]).list.length,1)],
 ];
 for(const [name,mutate,check] of mutants){const changed=mutate(html);assert.notEqual(changed,html,name+": mutante aplicado");assert.throws(()=>check(loadPureLogic(changed)),undefined,name+": debe morir");}
 console.log("compras-identicas-ids: 7/7 mutaciones muertas");
});
