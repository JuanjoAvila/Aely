import assert from "node:assert/strict";
import fs from "node:fs";
import {test} from "node:test";
import {transformSync} from "esbuild";
import {loadPureLogic} from "../scripts/load-pure-logic.mjs";
import * as bank from "./helpers/bank-download-fixture.mjs";
import {E,day} from "./helpers/banco-sintetico.mjs";

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
test("FIN10 lapida sin cuenta nunca oculta candidata con cuenta conocida",()=>{
 const noAccount=c.obAbsorptionKey({...gone,obAcc:undefined});
 for(const e of [gone,otherAccount])visibility(c,server,e,[noAccount],false);
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
  ["account",s=>s.replace('if(absorbed&&!e.obAcc){','if(absorbed){')],
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
