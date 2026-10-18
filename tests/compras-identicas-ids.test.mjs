import assert from "node:assert/strict";
import fs from "node:fs";
import {test} from "node:test";
import {execFileSync} from "node:child_process";
import vm from "node:vm";
import {loadPureLogic} from "../scripts/load-pure-logic.mjs";
import * as bank from "./helpers/bank-download-fixture.mjs";
import {day,E,ts} from "./helpers/banco-sintetico.mjs";
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

// Métodos de transporte reales sobre la BD sintética del handler; solo se sustituye el SDK.
function cloudOn(env,ctx=c,source=html){
 const a=source.indexOf('const cloud = (function(){'),b=source.indexOf('\n})();',a),start=source.indexOf('  return {',a);
 assert.ok(a>=0&&b>start&&start>a);
 const db={...env.db,auth:{getSession:async()=>({data:{session:{user:{id:"user"}}}})}};
 return vm.runInContext('(function(sb){const statePushCache=new Map();'+source.slice(start,b)+'})',ctx)(db);
}
const committed=(s,feed,ctx=c,source=html)=>bank.updater(source,feed,s,ctx,true).state;
const serverCents=(env,s)=>server.filasComoLaApp(env.rows,s.deleted,s.obAbsorbedPending,s._historyOwner).filter(row=>server.cuentaParaPresupuesto(row,server.bancosDeGastoDiario(s))).reduce((n,row)=>n+Math.round(Number(row.importe)*100),0);

test("nube: truncada y completa dejan app y servidor en 320 c tras pull, repetir sync y otro móvil",async()=>{
 const env=fakeDb(),cloud=cloudOn(env);
 const pending=await bank.sync(()=>({transactions:[coffee("p1","PDNG")]}));
 let s=committed(state(),pending.data.links);
 assert.equal(cents(s),320,"el handler inicial entrega el PDNG");assert.equal(s.expenses[0].obPending,true);
 for(const e of s.expenses)await cloud.addExpense(e);
 const partial=await bank.sync((url,n)=>({transactions:n===1?[coffee("b1")]:[],continuation_key:"same-cursor"}));
 assert.ok(partial.data.links[0].accounts.some(a=>a.truncated),"el corte viene del handler real");
 s=committed(s,partial.data.links);assert.equal(cents(s),640);
 for(const e of s.expenses)await cloud.addExpense(e);
 assert.equal(env.rows.length,2);assert.equal(serverCents(env,s),640);
 const complete=await bank.sync(()=>({transactions:[coffee("b1")]}));
 const before=clone(s);s=committed(s,complete.data.links);assert.equal(cents(s),320);assert.equal(s.expenses.length,1);
 // La referencia adoptada también puede llegar por su escritor de source vigente. Aun
 // con esa metadata actualizada, la otra fila seguía contando en el servidor para siempre.
 await cloud.setExpenseBank(s.expenses[0],"caixabank");
 await cloud.pushState("user",c.slimForCloud(s));
 let remote=(await cloud.pullState()).data;
 console.log(JSON.stringify({truncatedThenComplete:{appCents:cents(s),serverCents:serverCents(env,remote),sources:env.rows.map(r=>r.source)}}));
 assert.equal(serverCents(env,remote),320,"el BOOK absorbido debe quedar fuera también en la nube");
 const absorbed=before.expenses.find(e=>!s.expenses.some(keep=>keep.id===e.id));
 assert.ok(remote.deleted.includes(c.obAbsorptionKey(absorbed)));assert.ok(!remote.deleted.includes(c.obAbsorptionKey(s.expenses[0])));
 const lap=c.expenseDeletedSet(remote);
 for(const independent of [{...absorbed,extId:"other-book"},{...absorbed,ent:"sabadell"}]){
  assert.equal(c.expenseIsTombstoned(independent,lap),false,"la lápida no alcanza otra referencia o banco en la misma ranura");
  assert.equal(server.filasComoLaApp([wire(independent)],remote.deleted).length,1);
 }
 assert.equal(c.expenseIsTombstoned({...absorbed,id:"different-cloud-uuid"},lap),true,"también alcanza la misma fila con otro UUID");
 assert.equal(server.filasComoLaApp([{...wire(absorbed),id:"different-cloud-uuid"}],remote.deleted).length,0);
 assert.equal(c.expenseIsTombstoned({...absorbed,merchant:"Nombre posterior",amount:3.21},lap),true,"la identidad no cambia al corregir metadatos");
 assert.equal(server.filasComoLaApp([{...wire(absorbed),comercio:"Nombre posterior",importe:3.21}],remote.deleted).length,0);
 const pull=async(local)=>{const pack=await cloud.pullState(),del=c.lapidasUnion(local,pack.data),incoming=(await cloud.pullExpenses()).map(c.expenseFromRow).filter(e=>!c.expenseIsTombstoned(e,c.expenseDeletedSet(del)));return {...local,...del,expenses:c.mergeExpensesFromCloud(local.expenses,incoming).list};};
 s=await pull(s);assert.equal(cents(s),320);assert.equal(serverCents(env,remote),320);
 s=committed(s,complete.data.links);await cloud.pushState("user",c.slimForCloud(s));assert.equal(cents(await pull(s)),320);
 let other=await pull(state());assert.equal(cents(other),320);other=committed(other,complete.data.links);assert.equal(cents(other),320);
 const stats=c.dashboardBudgetStats(s);s.widgetPeriod={v:2,kind:"mes",start:stats.periodStart,anchor:"",scope:c.widgetScopeOf(s,stats,"","caixabank")};
 await cloud.pushState("user",c.slimForCloud(s));
 // Aviso de otro banco, fuera del gasto diario: dispara month/widget reales sin añadir
 // gasto de Caixa y acredita que ambos lectores respetan la lápida del BOOK absorbido.
 const result=await post(env,{fuente:"tr",titulo:"Trade Republic",texto:"Has gastado 0,01 € en Otra cuenta sintetica",fecha:String(Date.now()),evento:"absorbed-cloud-contract"});
 assert.equal(result.status,200);assert.equal(Math.round(result.data.month.spent*100),320);assert.ok(result.data.widget);assert.equal(Math.round(result.data.widget.spent*100),320);
 console.log(JSON.stringify({convergence:{afterPullCents:cents(s),otherMobileCents:cents(other),ingestCents:Math.round(result.data.month.spent*100),widgetCents:Math.round(result.data.widget.spent*100)}}));
});

test("mutación de revisión: retirar la guarda de lectura truncada debe morir",()=>{
 const check=(ctx,source)=>{const first={...realSync(state(),[coffee("p","PDNG")],{},ctx,source),bankTx:[]};assert.equal(cents(realSync(first,[coffee("b")],{truncated:true},ctx,source),ctx),640);};
 check(c,html);const changed=html.replace('&&!l.truncated&&!l.readReason','&&!l.readReason');assert.notEqual(changed,html);assert.throws(()=>check(loadPureLogic(changed),changed));
});

async function retentionScenario(source=html,{sandbox=false}={}){
 const ctx=loadPureLogic(source),env=fakeDb(),transport=cloudOn(env,ctx,source);
 const durable=new Map();ctx.localStorage={getItem:k=>durable.get(k)||null,setItem:(k,v)=>durable.set(k,v)};ctx.AbortController=AbortController;
 ctx.__transport=transport;vm.runInContext('Object.assign(cloud,__transport)',ctx);delete ctx.__transport;
 const guardStart=source.indexOf('(function(){',source.indexOf('const CLOUD_WRITES=[')),guardEnd=source.indexOf('\n})();',guardStart)+6;
 assert.ok(guardStart>=0&&guardEnd>guardStart);vm.runInContext(source.slice(guardStart,guardEnd),ctx);
 const pending=await bank.sync(()=>({transactions:[coffee("p-retention","PDNG")]}));
 let s=committed({...state(),_historyOwner:"user"},pending.data.links,ctx,source);
 for(const e of s.expenses)await transport.addExpense(e);
 const partial=await bank.sync((url,n)=>({transactions:n===1?[coffee("b-retention")]:[],continuation_key:"same-cursor"}));
 s=committed(s,partial.data.links,ctx,source);assert.equal(cents(s,ctx),640);
 for(const e of s.expenses)await transport.addExpense(e);
 const before=clone(s),complete=await bank.sync(()=>({transactions:[coffee("b-retention")]}));
 if(sandbox)ctx.mcSandbox=()=>true;
 s=committed(s,complete.data.links,ctx,source);
 await ctx.obAbsorbedRetry(()=>s,()=>"user",fn=>{s=fn(s);});
 await new Promise(resolve=>setImmediate(resolve));
 const gone=before.expenses.find(e=>!s.expenses.some(keep=>keep.id===e.id)),key=ctx.obAbsorptionKey(gone);
 assert.ok(s.deleted.includes(key));
 const at=s.deletedAt[key];
 for(let i=0;i<501;i++)s={...s,...ctx.lapidaPon(s,"synthetic-newer-deletion-"+i,at+i+1)};
 assert.equal(s.deleted.includes(key),false,"la poda real 500/200 retira el marcador antiguo");
 await transport.pushState("user",ctx.slimForCloud(s));
 const pull=async local=>{const remote=(await transport.pullState()).data,del={...ctx.lapidasUnion(local,remote),_historyOwner:"user",obAbsorbedPending:ctx.obAbsorbedJoin(local.obAbsorbedPending,remote.obAbsorbedPending,"user")},incoming=(await transport.pullExpenses()).map(ctx.expenseFromRow).filter(e=>!ctx.expenseIsTombstoned(e,ctx.expenseDeletedSet(del)));return {...local,...del,expenses:ctx.mergeExpensesFromCloud(local.expenses,incoming).list};};
 s=await pull(s);
 const app=cents(await pull(state()),ctx),serverValue=serverCents(env,s);
 console.log(JSON.stringify({retentionExpired:{appCents:app,existingMobileCents:cents(s,ctx),serverCents:serverValue,cloudRows:env.rows.length}}));
 if(sandbox){assert.equal(env.rows.length,2,"modo pruebas no borra la tabla real");return;}
 assert.deepEqual({app,server:serverValue},{app:320,server:320},"la fila debe estar borrada, no solo tapada");
 assert.equal(env.rows.length,1);assert.equal(env.rows[0].id,s.expenses[0].id,"sobrevive el UUID de la pendiente adoptada");
 s=committed(s,complete.data.links,ctx,source);assert.equal(cents(await pull(s),ctx),320);
 let other=await pull(state());assert.equal(cents(other,ctx),320);other=committed(other,complete.data.links,ctx,source);assert.equal(cents(other,ctx),320);
 assert.equal(serverCents(env,other),320);
}
test("nube: caducar la lápida no resucita el BOOK absorbido en app ni servidor",async()=>{
 await retentionScenario();
});
test("absorción: quitar el reintento deja fila cloud viva aunque la protección aún funcione",async()=>{
 const changed=html.replace('if(!await cloud.settleObAbsorbed(p,getOwner)||getOwner()!==owner)continue;','if(true)continue;');assert.notEqual(changed===html,true,"reintento retirado");
 await assert.rejects(()=>retentionScenario(changed),error=>error.code==="ERR_ASSERTION"&&error.actual===2&&error.expected===1);
});
test("absorción: CLOUD_WRITES impide el borrado en modo pruebas",async()=>{
 await retentionScenario(html,{sandbox:true});
 const changed=html.replace(',"settleObAbsorbed"','').replaceAll('||mcSandbox()','||false').replaceAll('&&!mcSandbox()','&&true');assert.notEqual(changed===html,true,"guardas de la ruta nueva retiradas");
 await assert.rejects(()=>retentionScenario(changed,{sandbox:true}),error=>error.code==="ERR_ASSERTION"&&error.actual===1&&error.expected===2);
});

test("absorción: las seis guardas de revisión matan sus mutaciones",()=>{
 const first=committed(state(),links([coffee("p-guard","PDNG")]));
 const partial=committed(first,[{...links([coffee("b-guard")])[0],truncated:true}]);
 const adopted=committed(partial,links([coffee("b-guard")])),keep=adopted.expenses[0],gone=partial.expenses.find(e=>e.id!==keep.id);
 const seed=()=>({prev:clone(partial),next:{...clone(adopted),deleted:[],deletedAt:{},lastBankSync:123456789}});
 const apply=(ctx,p)=>ctx.obPendingAbsorbedState(p.next,p.prev);
 const clean=(ctx,p)=>assert.equal(apply(ctx,p).deleted.length,0);
 const checks={
  group:ctx=>{for(const changes of [{date:day(-2)},{amount:3.21},{merchant:"Otra compra",obName:"Otra compra"}])for(const where of ["old","removed"]){const p=seed(),id=where==="old"?keep.id:gone.id;p.prev.expenses=p.prev.expenses.map(e=>e.id===id?{...e,...changes}:e);clean(ctx,p);}},
  account:ctx=>{const p=seed();p.next.expenses[0].obAcc="account-a";p.prev.expenses.find(e=>e.id===gone.id).obAcc="account-b";clean(ctx,p);},
  pending:ctx=>{const p=seed();p.prev.bankTx=[];delete p.prev.expenses.find(e=>e.id===keep.id).obPending;clean(ctx,p);},
  reference:ctx=>{const p=seed();p.prev.expenses.find(e=>e.id===keep.id).extId=keep.extId;p.next.expenses[0].obPendingRef=keep.extId;clean(ctx,p);},
  book:ctx=>{const p=seed();p.prev.expenses.find(e=>e.id===gone.id).obPending=true;clean(ctx,p);},
  time:ctx=>{const p=seed(),out=apply(ctx,p);assert.equal(out.deletedAt[ctx.obAbsorptionKey(gone)],p.next.lastBankSync);}
 };
 const mutations=[
  ["group",s=>s.replace('||obPendingGroup(old)!==obPendingGroup(e)','').replace('obPendingGroup(e)!==obPendingGroup(keep)||','')],
  ["account",s=>s.replace('||e.obAcc&&keep.obAcc&&e.obAcc!==keep.obAcc','')],
  ["pending",s=>s.replace('if(pending)adopted.set','if(true)adopted.set')],
  ["reference",s=>s.replace('||old.extId===e.extId','')],
  ["book",s=>s.replace('if(ids.has(e.id)||!esFilaDeBanco(e)||!e.extId||e.obPending)return;','if(ids.has(e.id)||!esFilaDeBanco(e)||!e.extId)return;')],
  ["time",s=>s.replace('lapidaPon(out,key,s.lastBankSync||Date.now())','lapidaPon(out,key,Date.now())')]
 ];
 for(const [name,mutate] of mutations){checks[name](c);const changed=mutate(html);assert.notEqual(changed,html,name+": aplicada");assert.throws(()=>checks[name](loadPureLogic(changed)),undefined,name+": muerta");}
 console.log("compras5: seis guardas defendidas, 6/6 mutantes muertos");
});

test("mutaciones de absorción: commit, lápida específica, UUID y lector local",()=>{
 const check=(ctx,source)=>{
  const first=committed(state(),links([coffee("p","PDNG")]),ctx,source);
  const partial=committed(first,[{...links([coffee("b")])[0],truncated:true}],ctx,source),old=clone(partial);
  const after=committed(partial,links([coffee("b")]),ctx,source),keep=after.expenses[0],gone=partial.expenses.find(e=>e.id!==keep.id);
  assert.deepEqual(clone(partial),old,"commit no muta el estado anterior");assert.equal(cents(after,ctx),320);
  const rows=partial.expenses.map(e=>({...wire(e.id===keep.id?keep:e),source:ctx.expenseSourceForCloud(e.id===keep.id?keep:e)}));
  assert.equal(server.filasComoLaApp(rows,after.deleted).reduce((n,r)=>n+Math.round(r.importe*100),0),320);
  const del=ctx.expenseDeletedSet(after);
  assert.equal(ctx.expenseIsTombstoned({...gone,id:"other-uuid"},del),true);
  assert.equal(ctx.expenseIsTombstoned({...gone,extId:"other-ref"},del),false);
  assert.equal(ctx.expenseIsTombstoned({...gone,ent:"sabadell"},del),false);
  assert.equal(committed(after,links([coffee("b")]),ctx,source).deleted,after.deleted,"repetir sync no añade otra lápida");
 };
 check(c,html);
 const cases=[
  ["el commit omite la absorción",s=>s.replace('  s=obPendingAbsorbedState(s,prev);','')],
  ["la lápida apunta a la superviviente",s=>s.replace('const key=obAbsorptionKey(e);if(!key','const key=obAbsorptionKey(keep);if(!key')],
  ["lápida genérica alcanza otra referencia",s=>s.replace('function obAbsorptionKey(e,legacy){','function obAbsorptionKey(e,legacy){return keyOfExpense(e);')],
  ["lápida depende del UUID local",s=>s.replace('encodeURIComponent(String(e.extId))+"|"+obOrdinalOf(e)','encodeURIComponent(String(e.id))+"|"+obOrdinalOf(e)')],
  ["pull ignora la lápida específica",s=>s.replace('const absorbed=obAbsorptionKey(e);if(absorbed&&delSet[absorbed])return true;','')],
 ];
 for(const [name,mutate] of cases){const changed=mutate(html);assert.notEqual(changed,html,name);assert.throws(()=>check(loadPureLogic(changed),changed),undefined,name+": muerta");}
 console.log("compras4: 5/5 mutaciones de absorción muertas; 20 anteriores y truncado conservadas");
});

test("lector servidor: la lápida de absorción es necesaria y preserva filas legacy",()=>{
 const gone={...expense("b/:%","uuid-local"),obOrd:2,obAcc:"synthetic-account"},key=c.obAbsorptionKey(gone),row=wire(gone);
 assert.equal(server.filasComoLaApp([row],[key]).length,0);
 const legacy={...row,source:"ob:caixabank#n2"};assert.equal(server.filasComoLaApp([legacy],[key]).length,1);
 assert.equal(server.filasComoLaApp([{...row,source:"ob:caixabank#ref%broken#n2"}],[key]).length,1);
 const src=fs.readFileSync(new URL('../supabase/functions/_shared/presupuesto.ts',import.meta.url),'utf8');
 const changed=src.replace('if (absorbed && lap.has(absorbed)) continue;','');assert.notEqual(changed,src);
 const js=ts(changed).replace(/export\s*\{[\s\S]*?\};?\s*$/,'');
 const mutant=new Function(js+';return filasComoLaApp;')();
 assert.throws(()=>assert.equal(mutant([row],[key]).length,0),undefined,"lector sin lápida específica: mutación muerta");
});

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

test("la prueba de migración no retiene la cadena de arrays de extractos anteriores",()=>{
 const old=[{ent:"caixabank",id:"p",date,amount:3.2,merchant:"Panaderia sintetica",status:"PDNG"},{ent:"caixabank",id:"b",date,amount:3.2,status:"BOOK"}];
 c.__oldBankTx=old;c.__newBankTx=c.flattenBankTx(links([coffee("b")]),old);
 try{
  assert.equal(vm.runInContext("obPendingResponses.get(__newBankTx).previous===__oldBankTx",c),false,"el array viejo es la clave de otro contexto: conservarlo encadena todas las sync");
  assert.equal(vm.runInContext("obPendingResponses.get(__newBankTx).previous.length",c),1,"solo hace falta la prueba pendiente");
 }finally{delete c.__oldBankTx;delete c.__newBankTx;}
});

test("un BOOK añadido durante una lectura parcial se reconcilia al llegar la cobertura completa",()=>{
 const first=realSync(state(),[coffee("p","PDNG")]),id=first.expenses[0].id;
 const partial=realSync(first,[coffee("b")],{truncated:true});assert.equal(cents(partial),640,"sin cobertura aún no se demuestra identidad");
 const full=realSync(partial,[coffee("b")]);assert.equal(cents(full),320);assert.equal(full.expenses.length,1);assert.equal(full.expenses[0].id,id);assert.equal(full.expenses[0].extId,"b");
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
  ["BOOK de una lectura parcial no converge",s=>s.replace('if(removed.size)out=out.filter(function(e){return !removed.has(e);});',''),(ctx,source)=>{const first=realSync(state(),[coffee("p","PDNG")],{},ctx,source),partial=realSync(first,[coffee("b")],{truncated:true},ctx,source);assert.equal(cents(realSync(partial,[coffee("b")],{},ctx,source),ctx),320);} ],
  ["el enriquecido gasta dos veces el BOOK de esta respuesta",s=>s.replace('&&(!response.expenseIds||response.expenseIds.has(e.id))',''),(ctx,source)=>assert.equal(cents(realSync(state(),[coffee("p1","PDNG"),coffee("p2","PDNG"),coffee("b")],{},ctx,source),ctx),640)],
  ["el contexto retiene todos los extractos previos",s=>s.replace('previous:previous.filter(function(tx){return tx&&obIsPending(tx);})','previous:previous'),ctx=>{const old=[{ent:"caixabank",id:"p",date,amount:3.2,status:"PDNG"}];ctx.__oldBankTx=old;ctx.__newBankTx=ctx.flattenBankTx(links([coffee("b")]),old);try{assert.equal(vm.runInContext('obPendingResponses.get(__newBankTx).previous===__oldBankTx',ctx),false);}finally{delete ctx.__oldBankTx;delete ctx.__newBankTx;}}],
 ];
 for(const [name,mutate,check] of cases){check(c,html);const changed=mutate(html);assert.notEqual(changed,html,name+": aplicada");const mutant=loadPureLogic(changed);assert.throws(()=>check(mutant,changed),undefined,name+": muerta por el contrato");}
 console.log("compras-identicas-ids: 13/13 nuevas mutaciones de estado muertas; 7 anteriores conservadas");
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
