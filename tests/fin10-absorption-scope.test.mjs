import assert from "node:assert/strict";
import fs from "node:fs";
import {test} from "node:test";
import {transformSync} from "esbuild";
import {loadPureLogic} from "../scripts/load-pure-logic.mjs";
import * as bank from "./helpers/bank-download-fixture.mjs";
import {E,day} from "./helpers/banco-sintetico.mjs";
import {widgetBudget} from "./helpers/ingest-handler-fixture.mjs";

const html=fs.readFileSync(new URL("../public/index.html",import.meta.url),"utf8"),c=loadPureLogic(html);
const source=fs.readFileSync(new URL("../supabase/functions/_shared/presupuesto.ts",import.meta.url),"utf8");
const serverModule=src=>{const module={exports:{}};new Function("module","exports",transformSync(src,{loader:"ts",format:"cjs"}).code)(module,module.exports);return module.exports;};
const server=serverModule(source),clone=x=>JSON.parse(JSON.stringify(x));
const expense=(id,ref,extra={})=>({id,extId:ref,ent:"caixabank",source:"ob",obAcc:"synthetic-account-a",date:day(-2)+"T12:00:00.000Z",amount:3.20,merchant:"Compra sintetica",obName:"Compra sintetica",category:"otros",...extra});
const pending=expense("pending-local","pending-ref",{obPending:true});
const gone=expense("book-local","reused-ref",{obOrd:2,date:day(-2)+"T12:00:00.001Z"});
const key="ob-absorbed2|caixabank|reused-ref|2|synthetic-account-a|"+day(-2);
function absorbed(ctx=c){
 const prev={expenses:clone([pending,gone]),bankTx:[],deleted:[],deletedAt:{}};
 const tx={id:gone.extId,ent:gone.ent,acc:gone.obAcc,date:day(-2),amount:3.20,merchant:gone.merchant,status:"BOOK"};
 const links=[{aspsp:"CaixaBank",syncFrom:"2026-01-01",transactions:[{ext_id:tx.id}]}];
 const next=ctx.obReconcilePending(prev.expenses,[tx],links),before=clone(prev);
 const out=ctx.obPendingAbsorbedState({...prev,expenses:next.expenses,lastBankSync:123456789},prev);
 assert.deepEqual(clone(prev),before);return out;
}
const wire=(e,ctx=c)=>({id:e.id,fecha:e.date,importe:e.amount,comercio:e.merchant,cat:e.category,ob_name:e.obName,source:ctx.expenseSourceForCloud(e)});
function visibility(ctx,srv,e,deleted,hidden){
 assert.equal(ctx.expenseIsTombstoned(e,ctx.expenseDeletedSet({deleted})),hidden,"cliente: "+e.id);
 const rows=srv.filasComoLaApp([wire(e,ctx)],deleted);
 assert.equal(rows.reduce((n,r)=>n+Math.round(Number(r.importe)*100),0),hidden?0:Math.round(e.amount*100),"servidor: "+e.id);
}
const otherAccount={...gone,id:"other-account",obAcc:"synthetic-account-b"},otherDay={...gone,id:"other-day",date:day(-1)+"T12:00:00.001Z"};

function rematesScenario(ctx,srv,keepAccount,bookAccount,ordinal){
 const p={...pending,obAcc:keepAccount?"synthetic-account-a":undefined};
 const b={...gone,obOrd:ordinal>1?ordinal:undefined,date:day(-2)+"T12:00:00.00"+(ordinal-1)+"Z",obAcc:bookAccount?"synthetic-account-a":undefined};
 const prev={accounts:[{id:"cx",ent:"caixabank",role:"diario",spendFrom:true,value:1000}],settings:{expenseBanks:["caixabank"]},expenses:[p,b],gemelos:[],deleted:[],fixed:[],debts:[],oneoffs:[],flows:[],investments:[],goals:[],assets:[],budget:1000,bankTx:[]};
 const tx={entry_reference:b.extId,booking_date:day(-2),value_date:day(-2),status:"BOOK",transaction_amount:{amount:"3.20",currency:"EUR"},credit_debit_indicator:"DBIT",creditor:{name:b.merchant}};
 const links=[{aspsp:"CaixaBank",syncFrom:"2026-01-01",transactions:[E.mapTransaction(tx)]}];
 assert.equal(links[0].accounts,undefined,"enlace legacy real sin accounts[]");
 const before=clone(prev),after=bank.updater(html,links,prev,ctx,true).state;
 assert.deepEqual(clone(prev),before,"previo intacto");assert.equal(after.expenses.length,1);
 const survivor=after.expenses[0];
 const localCents=after.expenses.filter(e=>ctx.expenseCountsBudget(e,after)).reduce((n,e)=>n+Math.round(e.amount*100),0);
 // El segundo móvil puede haber enriquecido la cuenta que el escritor no conocía,
 // o seguir sin ella: las dos lecturas de la misma fila deben converger.
 const cloudRows=[wire(survivor,ctx),wire({...b,obAcc:bookAccount?undefined:"synthetic-account-a"},ctx)];
 const filtered=srv.filasComoLaApp(cloudRows,after.deleted);
 const serverCents=filtered.reduce((n,r)=>n+Math.round(Number(r.importe)*100),0);
 const incoming=cloudRows.map(ctx.expenseFromRow).filter(e=>!ctx.expenseIsTombstoned(e,ctx.expenseDeletedSet(after)));
 const other=ctx.mergeExpensesFromCloud([],incoming).list;
 const otherCents=other.filter(e=>ctx.expenseCountsBudget(e,{...after,expenses:other})).reduce((n,e)=>n+Math.round(e.amount*100),0);
 const start=srv.inicioDeMesMs(Date.now());
 const widgetState={...after,widgetPeriod:{v:2,kind:"mes",start,anchor:"",scope:JSON.stringify([2,start,"mes","gasto","",1000,["caixabank"],"caixabank"])}};
 const trigger={id:"outside-budget",fecha:new Date().toISOString(),importe:0.01,comercio:"Otro banco sintetico",cat:"otros",source:"ob:trade_republic#refoutside"};
 const snapshot=widgetBudget.widgetSnapshot(widgetState,cloudRows.concat(trigger),Date.now(),{id:trigger.id,event:"fin10-review",key:"synthetic"});
 const widgetCents=snapshot&&Math.round(snapshot.spent*100);
 console.log(JSON.stringify({remates:{keepAccount,bookAccount,ordinal,localCents,serverCents,otherCents,widgetCents,deleted:after.deleted}}));
 assert.equal(localCents,320,"superviviente local");assert.equal(serverCents,320,"servidor");assert.equal(otherCents,320,"otro movil");assert.equal(widgetCents,320,"widget real");
 if(ordinal===1)assert.equal(after.deleted.length,0,"no lapidar si el comodin alcanzaria a la superviviente");
 else assert.equal(after.deleted.length,1,"otra ranura si admite la proteccion precisa");
 return after;
}
function rematesCost(ctx,n=20000){
 const deleted=Array.from({length:500},(_,i)=>"ob-absorbed2|caixabank|gone-"+i+"|2|synthetic-account-a|"+day(-2));
 const set=ctx.expenseDeletedSet({deleted});assert.equal(ctx.expenseDeletedSet({deleted}),set,"indice de la misma referencia de deleted");
 let enumerations=0,descriptors=0;
 const proxied=new Proxy(set,{ownKeys(target){enumerations++;return Reflect.ownKeys(target);},getOwnPropertyDescriptor(target,k){descriptors++;return Reflect.getOwnPropertyDescriptor(target,k);}});
 const start=performance.now();
 for(let i=0;i<n;i++)assert.equal(ctx.expenseIsTombstoned({...gone,extId:"row-"+i,obAcc:undefined},proxied),false);
 const elapsedMs=performance.now()-start;
 console.log(JSON.stringify({rematesCost:{rows:n,tombstones:500,enumerations,descriptors,elapsedMs}}));
 assert.ok(enumerations<=1,"el indice enumera lapidas una sola vez, no una por fila");
 assert.ok(descriptors<=500,"trabajo de lapidas lineal500, no filas por500");
}
for(const keepAccount of [false,true])for(const bookAccount of [false,true])for(const ordinal of [1,2]){
 test("FIN10 remates ROJO legado cuentas keep="+keepAccount+" book="+bookAccount+" ordinal="+ordinal,()=>rematesScenario(c,server,keepAccount,bookAccount,ordinal));
}
test("FIN10 remates ROJO comodin simetrico entre los cuatro lados de la cuenta",()=>{
 for(const tombAccount of [undefined,"synthetic-account-a"])for(const candidateAccount of [undefined,"synthetic-account-a"]){
  visibility(c,server,{...gone,obAcc:candidateAccount},[c.obAbsorptionKey({...gone,obAcc:tombAccount})],true);
 }
});
test("FIN10 remates ROJO coste real20000filas500lapidas",()=>rematesCost(c));
test("FIN10 remates indice se renueva al recibir otro conjunto de lapidas",()=>{
 const deleted=[key],before=c.expenseDeletedSet({deleted});
 assert.equal(c.expenseIsTombstoned({...gone,obAcc:undefined},before),true);
 const changed=c.expenseDeletedSet({deleted:["ob-absorbed2|caixabank|distinct-ref|2||"+day(-2)]});
 assert.equal(c.expenseIsTombstoned({...gone,obAcc:undefined},changed),false);
 assert.equal(c.expenseIsTombstoned({...gone,extId:"distinct-ref",obAcc:"synthetic-account-b"},changed),true);
});
test("FIN10 remates mutantes propios de simetria escritor/lectores y coste mueren",()=>{
 const localCases=[
  ["M1-escritor-asimetrico",s=>s.replace('obAbsorptionMatches(keep,{[key]:1})','key===obAbsorptionKey(keep)'),ctx=>rematesScenario(ctx,server,false,true,1)],
  ["M2-lector-cliente-asimetrico",s=>s.replace('e.obAcc ? index.missing[k] : index.any[k]','e.obAcc ? false : index.any[k]'),ctx=>visibility(ctx,server,{...gone,obAcc:"synthetic-account-a"},[ctx.obAbsorptionKey({...gone,obAcc:undefined})],true)],
  ["M3-indice-recalculado-por-fila",s=>s.replace('obAbsorptionIndexes.get(delSet)','null'),ctx=>rematesCost(ctx,200)]
 ];
 for(const [name,mutate,check] of localCases){
  check(c);const changed=mutate(html);assert.notEqual(changed,html,name);
  assert.throws(()=>check(loadPureLogic(changed)),{code:"ERR_ASSERTION"},name);
 }
 const changed=source.replace('cuentaAusente.has(base) || ','');assert.notEqual(changed,source,"M4-lector-servidor-asimetrico");
 assert.throws(()=>visibility(c,serverModule(changed),{...gone,obAcc:"synthetic-account-a"},[c.obAbsorptionKey({...gone,obAcc:undefined})],true),{code:"ERR_ASSERTION"});
 console.log("FIN10 remates: M1/M2/M3/M4 muertos por centimos y coste real");
});

test("FIN10 escritor real emite solo v2 y ambos lectores conservan cuenta/dia",()=>{
 const s=absorbed();assert.deepEqual(Array.from(s.deleted),[key]);assert.equal(s.deletedAt[key],123456789);
 assert.equal(s.expenses.length,1);assert.equal(s.expenses[0].id,pending.id);
 visibility(c,server,gone,s.deleted,true);visibility(c,server,otherAccount,s.deleted,false);visibility(c,server,otherDay,s.deleted,false);
 visibility(c,server,s.expenses[0],s.deleted,false);
});
test("FIN10 vieja conserva conducta anterior sin inventar reparacion historica",()=>{
 const old=["ob-absorbed|caixabank|reused-ref|2"];
 for(const e of [gone,otherAccount,otherDay])visibility(c,server,e,old,true);
});
test("FIN10 candidata sin cuenta casa solo el mismo banco/ref/ordinal/dia",()=>{
 const unknown={...gone,id:"unknown-account",obAcc:undefined};visibility(c,server,unknown,[key],true);
 visibility(c,server,{...unknown,date:otherDay.date},[key],false);
 visibility(c,server,{...unknown,ent:"sabadell"},[key],false);
 visibility(c,server,{...unknown,extId:"distinct-ref"},[key],false);
});
test("FIN10 cuenta ausente en lapida o candidata usa el mismo comodin aprobado en revision",()=>{
 const noAccount=c.obAbsorptionKey({...gone,obAcc:undefined});
 for(const e of [gone,otherAccount])visibility(c,server,e,[noAccount],true);
 visibility(c,server,{...gone,obAcc:undefined},[noAccount],true);
});
test("FIN10 UUID, nombre e importe editados no resucitan absorbida legitima",()=>{
 visibility(c,server,{...gone,id:"different-device",merchant:"Nombre corregido",amount:4.21},[key],true);
 for(const e of [{...gone,obOrd:3},{...gone,extId:"distinct-ref"},{...gone,ent:"sabadell"}])visibility(c,server,e,[key],false);
});
test("FIN14 cuenta viaja por source en OB/historico sin romper otras marcas",()=>{
 for(const source of ["ob","ob-hist"])for(const acc of ["synthetic-account-a","uid|#/%:synthetic"]){
  const e={...gone,source,obAcc:acc,possibleDup:true,obPending:true,obPendingRef:"old|#/%",reciboId:"receipt"};
  const row=wire(e),back=c.expenseFromRow(row);
  assert.equal(back.obAcc,acc);assert.equal(back.extId,e.extId);assert.equal(back.obPendingRef,e.obPendingRef);
  assert.equal(back.obOrd,2);assert.equal(back.possibleDup,true);assert.equal(back.obPending,true);assert.equal(back.reciboId,e.reciboId);
  assert.equal(server.bancoDeSource(row.source),e.ent);assert.equal(server.ordinalDeSource(row.source),2);
  visibility(c,server,back,[c.obAbsorptionKey(e)],true);
 }
});
test("FIN14 source legacy, tramo malformado y manual no inventan cuenta",()=>{
 for(const raw of ["ob:caixabank#refreused-ref#n2","ob:caixabank#refreused-ref#acc%broken#n2","manual#accsynthetic-account-a"]){
  const row={...wire(gone),source:raw},back=c.expenseFromRow(row);assert.equal(back.obAcc,undefined);
 }
 assert.ok(!c.expenseSourceForCloud({...gone,obAcc:undefined}).includes("#acc"));
});
test("FIN14 pull real enriquece cuenta y el siguiente pull legacy no la borra",()=>{
 const local={...gone,obAcc:undefined},incoming=c.expenseFromRow(wire(gone));
 const merged=c.mergeExpensesFromCloud([local],[incoming]).list;
 assert.equal(merged.length,1);assert.equal(merged[0].obAcc,gone.obAcc);
 const legacy=c.expenseFromRow({...wire(gone),source:"ob:caixabank#refreused-ref#n2"});
 assert.equal(c.mergeExpensesFromCloud(merged,[legacy]).list[0].obAcc,gone.obAcc);
});
test("FIN14 guarda UUID de retirada acepta source legacy y rechaza otra cuenta conocida",()=>{
 const row=wire(gone);assert.equal(c.withdrawalRowMatches(gone,row),true);
 assert.equal(c.withdrawalRowMatches(gone,{...row,source:row.source.replace(/#acc[^#]*/,"")}),true);
 assert.equal(c.withdrawalRowMatches(gone,{...row,source:c.expenseSourceForCloud(otherAccount)}),false);
 assert.equal(c.withdrawalRowMatches(gone,{...row,source:row.source.replace(/#acc[^#]*/,"#acc%broken")}),false);
});
test("FIN10 dia literal almacenado, sin reinterpretar zona horaria",()=>{
 const e={...gone,date:day(-2)+"T23:59:00-03:00"};
 assert.equal(c.obAbsorptionKey(e),key);visibility(c,server,e,[key],true);
});
test("FIN15 importador real no duplica referencia estable cuando reaparece otro dia",()=>{
 const state={accounts:[{id:"cx",ent:"caixabank",role:"diario",spendFrom:true,value:1000}],settings:{expenseBanks:["caixabank"]},expenses:[],gemelos:[],deleted:[],fixed:[],debts:[],oneoffs:[],flows:[],investments:[],goals:[],assets:[],budget:1000,bankTx:[]};
 const tx=(status,date)=>({entry_reference:"stable-ref",booking_date:date,value_date:date,status,transaction_amount:{amount:"3.20",currency:"EUR"},credit_debit_indicator:"DBIT",creditor:{name:"Compra sintetica FIN15"}});
 for(const order of [[tx("PDNG",day(-2)),tx("BOOK",day(-1))],[tx("BOOK",day(-1)),tx("PDNG",day(-2))]]){
  let s=clone(state);for(const t of order)s=bank.updater(html,[{aspsp:"CaixaBank",syncFrom:"2026-01-01",transactions:[E.mapTransaction(t)]}],s,c,true).state;
  assert.equal(s.expenses.length,1);assert.equal(s.expenses.reduce((n,e)=>n+Math.round(e.amount*100),0),320);
  assert.equal(server.filasComoLaApp(s.expenses.map(e=>wire(e)),s.deleted).reduce((n,r)=>n+Math.round(Number(r.importe)*100),0),320);
 }
});
test("FIN10 mutantes propios de cliente/escritor mueren por comportamiento",()=>{
 const checks={
  account:ctx=>{const s=absorbed(ctx);assert.equal(ctx.expenseIsTombstoned(otherAccount,ctx.expenseDeletedSet(s)),false);},
  day:ctx=>{const s=absorbed(ctx);assert.equal(ctx.expenseIsTombstoned(otherDay,ctx.expenseDeletedSet(s)),false);},
  writer:ctx=>{assert.deepEqual(Array.from(absorbed(ctx).deleted),[key]);},
  transport:ctx=>assert.equal(ctx.expenseFromRow(wire(gone,ctx)).obAcc,gone.obAcc)
 };
 const mutants=[
  ["account",s=>s.replace('e.obAcc ? index.missing[k] : index.any[k]','index.any[k]')],
  ["day",s=>s.replace('String(e.date||"\").slice(0,10)','""')],
  ["writer",s=>s.replace('const key=obAbsorptionKey(e);if(!key','const key=obAbsorptionKey(e,true);if(!key')],
  ["transport",s=>s.replace('obAcc: source==="ob"||source==="ob-hist" ? bankRefDeSource(raw,"acc") : undefined,','obAcc: undefined,')]
 ];
 for(const [name,mutate] of mutants){checks[name](c);const changed=mutate(html);assert.notEqual(changed,html,name);assert.throws(()=>checks[name](loadPureLogic(changed)),{code:"ERR_ASSERTION"},name);}
 console.log("FIN10 cliente/escritor: 4/4 mutantes muertos");
});
test("FIN10 mutantes del lector servidor mueren por cuenta y dia",()=>{
 for(const [name,from,to,e,index] of [
  ["account","encodeURIComponent(cuentaDeSource(source))",'""',otherAccount,4],
  ["day",'+ String(f.fecha || "").slice(0, 10)','+ ""',otherDay,5]
 ]){
  visibility(c,server,e,[key],false);
  const changed=source.replace(from,to).replace('const lap = new Set(deleted || []);','const lap = new Set((deleted || []).map(k=>{const p=k.split("|");if(p[0]==="ob-absorbed2")p['+index+']="";return p.join("|");}));');
  assert.notEqual(changed,source,name);
  assert.throws(()=>visibility(c,serverModule(changed),e,[key],false),{code:"ERR_ASSERTION"},name);
 }
 console.log("FIN10 servidor: 2/2 mutantes muertos");
});

// Matriz explícita: 2 cuentas de lápida x 3 cuentas candidatas x 2 días.
// Se prueban aisladas: deduplicar dos filas presentes por ref no amplía una lápida.
for(const markerAccount of ["synthetic-account-a",""])for(const candidateAccount of ["synthetic-account-a","synthetic-account-b",""])for(const sameDay of [true,false]){
 test("FIN10 matriz12 lapida="+(markerAccount||"ausente")+" candidata="+(candidateAccount||"ausente")+" mismoDia="+sameDay,()=>{
  const e={...gone,obAcc:candidateAccount||undefined,date:sameDay?gone.date:otherDay.date};
  const marker="ob-absorbed2|caixabank|reused-ref|2|"+markerAccount+"|"+day(-2);
  const expectedHidden=sameDay&&(!markerAccount||!candidateAccount||markerAccount===candidateAccount);
  const actualClient=c.expenseIsTombstoned(e,c.expenseDeletedSet({deleted:[marker]}));
  const actualServer=server.filasComoLaApp([wire(e)],[marker]).length===0;
  console.log(JSON.stringify({matrix12:{markerAccount,candidateAccount,sameDay,expectedHidden,actualClient,actualServer}}));
  assert.equal(actualClient,expectedHidden,"cliente");assert.equal(actualServer,expectedHidden,"servidor");
  visibility(c,server,e,["ob-absorbed|caixabank|reused-ref|2"],true);
 });
}

test("FIN10 punto3 ratificado: lapida sin cuenta oculta OTRA CUENTA solo el mismo dia",()=>{
 const marker="ob-absorbed2|caixabank|reused-ref|2||"+day(-2);
 visibility(c,server,otherAccount,[marker],true);
 visibility(c,server,{...otherAccount,date:otherDay.date},[marker],false);
});
