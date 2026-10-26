import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {loadPureLogic} from "../scripts/load-pure-logic.mjs";
import {fakeDb,post,identity,budget,mod} from "./helpers/ingest-handler-fixture.mjs";

const root=new URL("../",import.meta.url),read=p=>fs.readFileSync(new URL(p,root),"utf8");
const source=JSON.parse(read("src/build-order.json")).map(p=>read("src/modules/"+p)).join("\n");
const client=()=>loadPureLogic("<script>"+source+"</script>");
const E=await mod("supabase/functions/_shared/enablebanking.ts");
const now=Date.now(),day=new Date(now).toISOString().slice(0,10);
const event=(id,offset=0)=>({fuente:"tr",titulo:"Trade Republic",texto:"Has gastado 9,95 € en COMERCIO SINT",fecha:String(now-3600000+offset),evento:id});
const state=(expenses=[])=>({accounts:[{id:"tr",ent:"trade_republic",role:"diario",spendFrom:true,value:1000}],expenses,settings:{brokersOn:["trade_republic"]},fixed:[],flows:[],debts:[],oneoffs:[],deleted:[],gemelos:[]});
const cents=(c,s)=>Math.round(c.dashboardBudgetStats(s).spent*100);
const feed=()=>{
 const tx=E.mapTransaction({booking_date:day,transaction_amount:{amount:"9.95"},credit_debit_indicator:"DBIT",creditor:{name:"Movimiento"},bank_transaction_code:{description:"Card payment"}});
 return [{aspsp:"Trade Republic",accounts:[{uid:"synthetic",transactions:[tx,{...tx}]}]}];
};
const addBank=(c,s)=>{const links=feed(),add=c.importObExpenses(s,c.flattenBankTx(links),links)||[];return c.reconcileGemelosAutomaticos({...s,expenses:s.expenses.concat(add)},s);};

// El cliente real importa OB y vuelve a reconciliar tras un pull, en ambos órdenes.
for(const bankFirst of [false,true]){
 const c=client(),env=fakeDb({nativeTwins:true,uuidIds:true});
 await post(env,event("v1_matrix_a"));await post(env,event("v1_matrix_b",600000));
 let s=state();if(bankFirst)s=addBank(c,s);
 const previous=s,incoming=env.rows.map(c.expenseFromRow);
 s=c.reconcileGemelosAutomaticos({...s,expenses:c.mergeExpensesFromCloud(s.expenses,incoming,Date.now(),{}).list},previous);
 if(!bankFirst)s=addBank(c,s);
 assert.equal(cents(c,s),1990,"new client/new server ON, both OB orders");
 assert.equal(incoming.every(e=>!c.esFilaDeBanco(e)&&c.expenseBankOf(e)==="trade_republic"),true);
 s=addBank(c,s);assert.equal(cents(c,s),1990,"repeated OB sync");

 // Transporte cloud.addExpense REAL; solo el SDK y el almacenamiento son dobles.
 const remote=fakeDb({uuidIds:true}),start=source.indexOf("const cloud = (function(){"),end=source.indexOf("\n})();",start),ret=source.indexOf("  return {",start);
 const sdk={...remote.db,auth:{getSession:async()=>({data:{session:{user:{id:"user"}}}})}};
 const cloud=vm.runInContext("(function(sb){const statePushCache=new Map();"+source.slice(ret,end)+"})",c)(sdk);
 for(const e of incoming)await cloud.addExpense(e);
 assert.equal(remote.rows.length,2,"both native UUIDs persist through actual cloud writer");
 assert.deepEqual(remote.rows.map(r=>r.id),env.rows.map(r=>r.id));
 assert.equal(remote.rows.every(r=>r.source.startsWith("native:trade_republic#e")),true);
 assert.deepEqual(remote.rows.map(r=>r.ingest_event_id),env.rows.map(r=>r.ingest_event_id));
 const replay=await post(remote,event("v1_matrix_a"));assert.equal(replay.data.ack,incoming[0].id,"native replay recovers UUID after real cloud roundtrip");
 const restored=remote.rows.map(c.expenseFromRow);
 assert.equal(c.mergeExpenses([],restored).list.length,2);
 assert.equal(cents(c,state(restored)),1990,"full fingerprint and UUID survive cloud upload");
 const sourceOnly=remote.rows.map(r=>({...r,ingest_event_id:undefined}));
 assert.equal(cents(c,state(sourceOnly.map(c.expenseFromRow))),1990,"source remains a complete independent reader identity");
 assert.equal(budget.filasComoLaApp(remote.rows,[],null,"user").reduce((n,r)=>n+Math.round(Number(r.importe)*100),0),1990);
 const changed={...remote.rows[0],cat:"taxi"},refresh=c.mergeExpensesFromCloud(restored,[c.expenseFromRow(changed)],Date.now(),{}).list;
 assert.equal(refresh.find(e=>e.id===changed.id).category,"taxi","native category refresh retains non-manual semantics");
 const bulk=fakeDb(),bulkSDK={...bulk.db,auth:sdk.auth};
 const batchCloud=vm.runInContext("(function(sb){const statePushCache=new Map();"+source.slice(ret,end)+"})",c)(bulkSDK);
 const batch=await batchCloud.addExpensesBatch(incoming);
 assert.deepEqual(Array.from(batch.cloudIds),incoming.map(e=>e.id));assert.equal(bulk.rows.length,2);
 assert.deepEqual(bulk.rows.map(r=>r.ingest_event_id),env.rows.map(r=>r.ingest_event_id));
 assert.equal((await post(bulk,event("v1_matrix_b",600000))).data.ack,incoming[1].id,"batch roundtrip retains own native ACK");
}

// Dos proyecciones iguales no fusionan huellas completas distintas.
{
 const c=client(),at=new Date(now-3600000).toISOString();
 const rows=["full_fingerprint_a","full_fingerprint_b"].map((id,i)=>({id:"11111111-1111-4111-8111-"+String(i+1).padStart(12,"0"),fecha:at,importe:9.95,comercio:"COMERCIO SINT",source:"native:trade_republic#e"+encodeURIComponent("tr:trade_republic:"+id)+"#t"+Date.parse(at)+"#n7",cat:"otros"}));
 assert.equal(c.mergeExpenses([],rows.map(c.expenseFromRow)).list.length,2);
 assert.equal(cents(c,state(rows.map(c.expenseFromRow))),1990);
}

// Colisión REAL de la proyección: buscar tres IDs sintéticos, sin sustituir SHA256.
{
 const groups=new Map();let ids;
 for(let i=0;i<6000;i++){
  const id="v1_collision_"+i,key=identity.claveEvento(id,"tr",""),slot=await identity.ordinalEvento(key),g=groups.get(slot)||[];
  g.push(id);groups.set(slot,g);if(g.length===3){ids=g;break;}
 }
 assert.ok(ids,"bounded deterministic collision fixture");
 const env=fakeDb({nativeTwins:true,uuidIds:true});
 const responses=await Promise.all(ids.map(id=>post(env,event(id))));
 assert.deepEqual(responses.map(r=>r.status),[200,200,200]);assert.equal(env.rows.length,3);
 assert.equal(new Set(env.rows.map(r=>r.fecha)).size,3,"four-column UNIQUE forces probes");
 for(let i=0;i<ids.length;i++)assert.equal((await post(env,event(ids[i]))).data.ack,responses[i].data.ack,"fresh handler/replay owns exact ACK");
 const c=client(),rows=env.rows.map(c.expenseFromRow);
 assert.equal(cents(c,state(c.mergeExpenses([],rows).list)),2985);
 assert.equal(rows.every(e=>e.ingestEventId&&e.nativeTwin),true);
 assert.equal(env.rows.every(r=>Math.abs(Date.parse(r.fecha)-Number(event("").fecha))<=1007),true);
}

// El modo por defecto no emite marcas ni crea una segunda ranura por contenido idéntico.
{
 const env=fakeDb(),a=await post(env,event("v1_off_a")),b=await post(env,event("v1_off_b"));
 assert.equal(a.status,200);assert.equal(b.data.dup,true);assert.equal(env.rows.length,1);
 assert.equal(env.rows[0].source,"macrodroid");assert.equal(env.rows[0].fecha,new Date(Number(event("").fecha)).toISOString());
 const c=client();assert.equal(cents(c,state(env.rows.map(c.expenseFromRow))),995);
}

// El lector nuevo no reinterpreta filas legacy del servidor controlado anterior.
{
 const c=client(),at=new Date(now-3600000).toISOString();
 const rows=[1,2].map(n=>({id:"11111111-1111-4111-8111-"+String(n).padStart(12,"0"),fecha:new Date(Date.parse(at)+n*1000).toISOString(),importe:9.95,comercio:"COMERCIO SINT",source:"macrodroid",ingest_event_id:"tr:trade_republic:v1_old_"+n,cat:"otros"}));
 assert.equal(c.mergeExpenses([],rows.map(c.expenseFromRow)).list.length,1,"old server legacy content identity stays unchanged");
 assert.equal(cents(c,state(c.mergeExpenses([],rows.map(c.expenseFromRow)).list)),995);
 const source="native:trade_republic#etr%3Atrade_republic%3Av1_wire#t"+Date.parse(at)+"#n1",wire={...rows[0],fecha:at,source,ingest_event_id:undefined};
 const e=c.expenseFromRow(wire),oldKey=c.keyOfExpenseLegacy(e);
 assert.equal(c.expenseIsTombstoned(e,{[oldKey]:1}),true);
 assert.equal(budget.filasComoLaApp([wire],[oldKey],null,"user").length,0,"source-only full fingerprint keeps legacy tombstone parity");
 assert.doesNotThrow(()=>c.expenseFromRow({...wire,source:"native:trade_republic#e%broken#n1"}));
 assert.doesNotThrow(()=>budget.claveComoLaApp({...wire,source:"native:trade_republic#e%broken#n1"}));
}
console.log("PASS phase1: ON1990 both OB orders, actual cloud UUID roundtrip, category refresh, full fingerprints, collision/replay2985, default OFF baseline995; SDK/storage doubles only");
