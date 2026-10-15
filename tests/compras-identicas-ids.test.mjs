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

test("BOOK cubre un PDNG de otra referencia; mismo ID cuenta uno",()=>{
 const settled={...tx("a"),transaction_amount:{amount:"750.00"}};
 const pending={...settled,entry_reference:"b",status:"PDNG"};
 assert.equal(cents(sync(state(),[settled,pending])),75000);
 assert.equal(cents(sync(state(),[settled,{...pending,entry_reference:"a"}])),75000);
});

const coffee=(id,status="BOOK",extra={})=>({...tx(id),status,transaction_amount:{amount:"3.20",currency:"EUR"},...extra});
const realSync=(s,ts,extra={},ctx=c,source=html)=>bank.updater(source,[{...links(ts)[0],...extra}],s,ctx).state;

test("estado: BOOK y PDNG con distinta referencia en una respuesta son 320 c",()=>{
 for(const ts of [[coffee("p","PDNG"),coffee("b")],[coffee("b"),coffee("p","PDNG")]]){
  const s=realSync(state(),ts);assert.equal(cents(s),320);assert.equal(s.expenses.length,1);assert.equal(s.expenses[0].extId,"b");
 }
});

test("estado: la fila pendiente adopta la referencia BOOK en la siguiente sync sin mutar el estado previo",()=>{
 const first=realSync(state(),[coffee("p","PDNG")]),saved=clone(first),id=first.expenses[0].id;
 const next=realSync(first,[coffee("b")]);
 assert.equal(cents(next),320);assert.equal(next.expenses.length,1);assert.equal(next.expenses[0].id,id);assert.equal(next.expenses[0].extId,"b");
 assert.equal(next.expenses[0].obPending,undefined);assert.deepEqual(clone(first),saved);
 assert.equal(cents(realSync(next,[coffee("b")])),320);
});

test("estado: dos pendientes y luego dos BOOK de otras referencias son 640 c",()=>{
 const first=realSync(state(),[coffee("p1","PDNG"),coffee("p2","PDNG")]);
 assert.equal(cents(first),640);
 const next=realSync(first,[coffee("b2"),coffee("b1")]);
 assert.equal(cents(next),640);assert.equal(next.expenses.length,2);
 assert.deepEqual(next.expenses.map(e=>e.id).sort(),first.expenses.map(e=>e.id).sort());
 assert.deepEqual(clone(next.expenses.map(e=>e.extId).sort()),["b1","b2"]);
});

test("estado: solo los pendientes sobrantes son cargos aparte y las referencias repetidas no consumen cobertura",()=>{
 for(const ts of [[coffee("p1","PDNG"),coffee("p2","PDNG"),coffee("b")],[coffee("p1","PDNG"),coffee("p2","PDNG"),coffee("b"),coffee("b")]]){
  assert.equal(cents(realSync(state(),ts)),640);
 }
 assert.equal(cents(realSync(state(),[coffee("p1","PDNG"),coffee("p2","PDNG"),coffee("p3","PDNG"),coffee("b1"),coffee("b2")])),960);
});

test("estado: una referencia que sigue presente, una lectura parcial o sin cobertura no autorizan adopción",()=>{
 const first=realSync(state(),[coffee("p","PDNG")]);
 for(const extra of [{ok:false},{truncated:true},{readReason:"page_limit"},{syncFrom:day(0)},{syncFrom:undefined}]){
  const next=realSync(first,[coffee("b")],extra);assert.equal(cents(next),640);assert.equal(first.expenses[0].extId,"p");
 }
 assert.equal(cents(realSync(first,[coffee("p","PDNG"),coffee("b")])),320,"en la misma respuesta el BOOK sí cubre al pendiente presente");
});

test("estado: marca pendiente sobrevive al reinicio y la nube; un BOOK del mismo ID la retira",()=>{
 const first=realSync(state(),[coffee("p","PDNG")]);assert.equal(first.expenses[0].obPending,true);
 const fromCloud=c.expenseFromRow(wire(first.expenses[0]));assert.equal(fromCloud.obPending,true);
 const fresh=realSync(state([fromCloud]),[coffee("b")]);assert.equal(cents(fresh),320);assert.equal(fresh.expenses[0].extId,"b");
 const same=realSync(clone(first),[coffee("p")]);assert.equal(same.expenses[0].obPending,undefined);assert.equal(cents(same),320);
 const oldPull=c.mergeExpensesFromCloud(fresh.expenses,[fromCloud]);
 assert.equal(cents({...fresh,expenses:oldPull.list}),320);assert.equal(oldPull.list[0].extId,"b");assert.equal(oldPull.list[0].obPending,undefined);
});

test("migración 132: el extracto previo PDNG prueba la marca que aquella versión no guardaba",()=>{
 const legacy=clone(realSync(state(),[coffee("p","PDNG")]));delete legacy.expenses[0].obPending;
 const next=realSync(legacy,[coffee("b")]);assert.equal(cents(next),320);assert.equal(next.expenses[0].extId,"b");
});

test("otro móvil: un pull pendiente con UUID distinto tampoco restaura la referencia adoptada",()=>{
 const first=realSync(state(),[coffee("p","PDNG")]),next=realSync(first,[coffee("b")]);
 const old=c.expenseFromRow({...wire(first.expenses[0]),id:"otro-uuid"});
 const pulled=c.mergeExpensesFromCloud(next.expenses,[old]);assert.equal(cents({...next,expenses:pulled.list}),320);assert.equal(pulled.list[0].extId,"b");
 const encoded=c.expenseFromRow(wire(next.expenses[0]));
 const afterReload=c.mergeExpensesFromCloud([encoded],[old]);assert.equal(cents({...next,expenses:afterReload.list}),320);
});

test("control: dos cafés firmes distintos siguen siendo 640 c y el estado desconocido no inventa adopción",()=>{
 assert.equal(cents(realSync(state(),[coffee("a"),coffee("b")])),640);
 const first=realSync(state(),[coffee("a","")]);assert.equal(cents(realSync(first,[coffee("b")])),640);
 const nextDay=realSync(realSync(state(),[coffee("p","PDNG")]),[coffee("b","BOOK",{booking_date:day(0),value_date:day(0)})]);
 assert.equal(cents(nextDay),640,"días distintos no prueban que sea el mismo cargo; limitación declarada");
 console.log(JSON.stringify({nextDayKnownLimitation:{actualCents:cents(nextDay),desiredIfSamePurchaseCents:320,automaticAdoptionSafe:false}}));
});

test("mutaciones de estado: cobertura, persistencia, adopción y pull antiguo",()=>{
 const cases=[
  ["sin cobertura BOOK-PDNG",s=>s.replaceAll('covered.add(key+"|"+id);n--;','n--;'),(ctx,source)=>assert.equal(cents(realSync(state(),[coffee("p","PDNG"),coffee("b")],{},ctx,source),ctx),320)],
  ["se pierden los pendientes sobrantes",s=>s.replace('let n=g.book.size;','let n=g.pending.size;'),(ctx,source)=>assert.equal(cents(realSync(state(),[coffee("p1","PDNG"),coffee("p2","PDNG"),coffee("b")],{},ctx,source),ctx),640)],
  ["sin marca al importar",s=>s.replace('if(tx.id&&obIsPending(tx))e.obPending=true;',''),ctx=>{const feed=links([coffee("p","PDNG")]);const add=ctx.importObExpenses(state(),ctx.flattenBankTx(feed),feed);assert.equal(add[0].obPending,true,"la fila que sube a nube ya lleva la marca");}],
  ["adopción sin cobertura de día",s=>s.replace('(!same&&covered(e))','!same'),(ctx,source)=>{const first=realSync(state(),[coffee("p","PDNG")],{},ctx,source);assert.equal(cents(realSync(first,[coffee("b")],{syncFrom:day(0)},ctx,source),ctx),640);} ],
  ["adopción cruza de día",s=>s.replace('String(e.date).slice(0,10)+"|"+Math.round(Number(e.amount)*100)','Math.round(Number(e.amount)*100)'),(ctx,source)=>{const first=realSync(state(),[coffee("p","PDNG")],{},ctx,source);assert.equal(cents(realSync(first,[coffee("b","BOOK",{booking_date:day(0),value_date:day(0)})],{},ctx,source),ctx),640);} ],
  ["adopción muta el estado previo",s=>s.replace('next=Object.assign({},e,{extId:tx.id});','e.extId=tx.id;next=e;'),(ctx,source)=>{const first=realSync(state(),[coffee("p","PDNG")],{},ctx,source),before=clone(first);realSync(first,[coffee("b")],{},ctx,source);assert.deepEqual(clone(first),before);} ],
  ["pull antiguo restaura referencia pendiente",s=>s.replace('if(v&&!v.obPending){','if(false&&v&&!v.obPending){'),(ctx,source)=>{const first=realSync(state(),[coffee("p","PDNG")],{},ctx,source),old=ctx.expenseFromRow({...wire(first.expenses[0]),source:ctx.expenseSourceForCloud(first.expenses[0])}),next=realSync(first,[coffee("b")],{},ctx,source);const merged=ctx.mergeExpensesFromCloud(next.expenses,[old]);assert.equal(cents({...next,expenses:merged.list},ctx),320);assert.equal(merged.list[0].extId,"b");} ],
  ["marca pendiente no viaja",s=>s.replace('+(e.obPending?"#pdng":"")',''),(ctx,source)=>{const first=realSync(state(),[coffee("p","PDNG")],{},ctx,source),e=first.expenses[0];assert.equal(ctx.expenseFromRow({...wire(e),source:ctx.expenseSourceForCloud(e)}).obPending,true);} ],
  ["migración pierde el PDNG del extracto anterior",s=>s.replace('wasPending=!!e.obPending||!!(previous&&obPendingGroup(previous)===obPendingGroup(e))','wasPending=!!e.obPending'),(ctx,source)=>{const seed=clone(realSync(state(),[coffee("p","PDNG")],{},ctx,source));delete seed.expenses[0].obPending;assert.equal(cents(realSync(seed,[coffee("b")],{},ctx,source),ctx),320);} ],
  ["se pierde el alias adoptado frente a otro UUID",s=>s.replace('next.obPendingRef=e.extId;',''),(ctx,source)=>{const first=realSync(state(),[coffee("p","PDNG")],{},ctx,source),next=realSync(first,[coffee("b")],{},ctx,source),old=ctx.expenseFromRow({...wire(first.expenses[0]),source:ctx.expenseSourceForCloud(first.expenses[0]),id:"otro-uuid"});assert.equal(cents({...next,expenses:ctx.mergeExpensesFromCloud(next.expenses,[old]).list},ctx),320);} ],
 ];
 for(const [name,mutate,check] of cases){check(c,html);const changed=mutate(html);assert.notEqual(changed,html,name+": aplicada");const mutant=loadPureLogic(changed);assert.throws(()=>check(mutant,changed),undefined,name+": muerta por el contrato");}
 console.log("compras-identicas-ids: 10/10 nuevas mutaciones de estado muertas; 7 anteriores conservadas");
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
 const observation=(ctx,s)=>{
  const now=new Date(),y=now.getFullYear(),m=now.getMonth()+1,d=now.getDate(),i=ctx.insumosSaldoGasto(s);
  const money=n=>Math.round(n*100),budget=ctx.monthBudgetStats(s);
  const shown=s.accounts.map(a=>ctx.saldoCuentaMostrada(a,{injTR:i.injTR,spentByBank:i.spentByBank,paidNetByBank:i.paidNetByBank,roundup:i.roundup,monthlyInvest:i.monthlyInvest}));
  const forecast=shown.map((n,k)=>money(n+ctx.monthNetForAccount(s,s.accounts[k].ent,y,m,null)-ctx.monthNetForAccount(s,s.accounts[k].ent,y,m,d)));
  const savedDate=ctx.Date,closeDate=new Date(y,m,2,12).getTime();
  let closed;
  try{ctx.Date=class extends Date{constructor(...a){super(...(a.length?a:[closeDate]));}static now(){return closeDate;}};closed=ctx.reconcileTR({...clone(s),trAnchor:y+"-"+String(m).padStart(2,"0")});}finally{ctx.Date=savedDate;}
  return{spent:money(budget.spent),shown:shown.map(money),base:s.accounts.map(a=>money(a.value)),forecast,closing:closed.accounts.map(a=>money(a.value))};
 };
 for(const row of cases)assert.deepEqual(clone(observation(c,sync(clone(row.seed),row.feed))),clone(observation(old,sync(clone(row.seed),row.feed,old))),row.name+": gastado, pintado, base, previsto y cierre idénticos a 132");
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
