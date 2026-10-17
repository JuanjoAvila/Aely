#!/usr/bin/env node
// UX-2909-04: el nombre del banco no acredita identidad con el ingreso tecleado.
import assert from "node:assert/strict";
import fs from "node:fs";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {loadPureLogic} from "../scripts/load-pure-logic.mjs";
if(!process.argv.includes("--zone-child")){
  for(const zone of ["UTC","Europe/Madrid"]){const r=spawnSync(process.execPath,[fileURLToPath(import.meta.url),"--zone-child",...process.argv.slice(2)],{env:{...process.env,TZ:zone},stdio:"inherit"});if(r.status!==0)process.exit(r.status||1);}
  process.exit(0);
}
const mutants={
  off:['if(incomeBook)incomeReviews.set(c,matches);','/* sin revisión */'],
  ambiguous:['incomeReview.length===1&&incomeUses.get(incomeReview[0].id)===1','incomeReview.length>0'],
  book:['const incomeBook=String(tx.status||"").trim().toUpperCase()==="BOOK";','const incomeBook=true;'],
  window:['&&Math.abs(dateMs(m.date)-dateMs(e.date))<=DUP_MS',''],
  bank:['(manualesPorImporte.get(k)||[]).map(function(x){return x.e;})','Array.from(manualesPorImporte.values()).flat().map(function(x){return x.e;}).filter(function(m){return Math.round(m.amount*100)===Math.round(e.amount*100);})'],
  cents:['(manualesPorImporte.get(k)||[]).map(function(x){return x.e;})','Array.from(manualesPorImporte.values()).flat().map(function(x){return x.e;}).filter(function(m){return expenseBankOf(m)===expenseBankOf(e);})'],
  counted:['if(incomeReview){\n      e.possibleDup=true;','if(incomeReview){\n      e.possibleDup=false;'],
  automatic:['&&!(e.amount<0&&e.possibleDup&&!e.possibleDupOf)',''],
};
let html=fs.readFileSync(new URL("../public/index.html",import.meta.url),"utf8");
const mutation=process.argv.find(x=>x.startsWith("--mutation="))?.split("=")[1];
if(mutation){const pair=mutants[mutation];assert.ok(pair,"mutante conocido");assert.equal(html.split(pair[0]).length,2,"mutación única");html=html.replace(pair[0],pair[1]);}
const ctx=loadPureLogic(html),now=Date.parse("2026-10-17T12:00:00Z");
ctx.Date=class extends Date{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}};
const manual=(patch={})=>Object.assign({id:"manual",source:"manual",ent:"sabadell",date:"2026-10-16T12:00:00Z",amount:-1800,merchant:"Nomina manual",category:"ingreso"},patch);
const book=(patch={})=>Object.assign({id:"salary",ent:"sabadell",date:"2026-10-16",amount:-1800,merchant:"NOMINA EMPRESA SINTETICA",status:"BOOK"},patch);
const state=(expenses)=>({accounts:[{id:"sb",ent:"sabadell",role:"diario",spendFrom:true,value:500}],expenses,fixed:[],flows:[],debts:[],oneoffs:[],goals:[],budget:500,settings:{expenseBanks:["sabadell","caixa"],gTotalMode:"net"}});
const merge=(s,txs)=>({...s,expenses:(ctx.importObExpenses(s,txs)||[]).concat(s.expenses)});
let passed=0,failed=0;
function t(name,fn){try{fn();passed++;console.log("PASS "+name);}catch(e){failed++;console.error("FAIL "+name+": "+e.message);}}
t("BOOK con nombre conserva ambos y cuenta un ingreso hasta decidir",()=>{const s=state([manual()]),after=merge(s,[book()]),b=after.expenses[0];assert.equal(after.expenses.length,2);assert.equal(b.possibleDup,true);assert.equal(b.possibleDupOf,"manual");assert.equal(b.autoGemelo,undefined);assert.equal(ctx.monthBudgetStats(after).income,1800);assert.equal(ctx.importObExpenses(after,[book()]),null);assert.equal(s.expenses[0].extId,undefined);});
t("son distintos cuenta ambos; es el mismo solo tras decisión conserva referencia",()=>{const s=merge(state([manual()]),[book()]),id=s.expenses[0].id;const split=ctx.resolvePossibleDup(s,id,false);assert.equal(ctx.monthBudgetStats(split).income,3600);assert.equal(split.expenses.length,2);const same=ctx.resolvePossibleDup(s,id,true);assert.equal(same.expenses.length,1);assert.equal(same.expenses[0].extId,"salary");assert.equal(ctx.importObExpenses(same,[book()]),null);});
t("varios manuales no escogen el primero y #dup sobrevive a la nube",()=>{const s=state([manual(),manual({id:"other"})]),after=merge(s,[book()]),b=after.expenses[0];assert.equal(b.possibleDup,true);assert.equal(b.possibleDupOf,undefined);assert.equal(ctx.monthBudgetStats(after).income,3600);const row={id:b.id,fecha:b.date,importe:b.amount,comercio:b.merchant,cat:b.category,source:ctx.expenseSourceForCloud(b)};const restored=ctx.expenseFromRow(row);assert.equal(restored.possibleDup,true);assert.equal(ctx.expenseCountsBudget(restored,after),false);});
t("dos referencias contra un manual quedan ambas pendientes sin vincular",()=>{for(const refs of [["one","two"],["two","one"]]){const a=merge(state([manual()]),refs.map(id=>book({id})));assert.equal(a.expenses.length,3);for(const b of a.expenses.slice(0,2)){assert.equal(b.possibleDup,true);assert.equal(b.possibleDupOf,undefined);}assert.equal(ctx.monthBudgetStats(a).income,1800);}});
t("una referencia repetida en la respuesta no crea ambigüedad",()=>{const a=merge(state([manual()]),[book(),book()]);assert.equal(a.expenses.length,2);assert.equal(a.expenses[0].possibleDupOf,"manual");});
t("banco y céntimo distintos no se emparejan",()=>{for(const patch of [{ent:"caixa"},{amount:-1800.01}]){const a=merge(state([manual()]),[book(patch)]);assert.equal(a.expenses.length,2);assert.equal(a.expenses[0].possibleDup,undefined);}});
t("ventana conserva tres días y no admite cuatro",()=>{const m=manual({date:"2026-10-13T12:00:00Z"}),a=merge(state([m]),[book()]);assert.equal(a.expenses[0].possibleDup,true);const b=merge(state([manual({date:"2026-10-12T12:00:00Z"})]),[book()]);assert.equal(b.expenses[0].possibleDup,undefined);});
t("sin BOOK no se amplía el parecido por nombre",()=>{const a=merge(state([manual()]),[book({status:""})]);assert.equal(a.expenses[0].possibleDup,undefined);for(const status of ["PDNG","HOLD","UNKNOWN"])assert.equal(ctx.importObExpenses(state([manual()]),[book({status})]),null);});
t("un aviso con nombre y un gasto con nombre conservan conducta",()=>{const a=merge(state([manual({source:"wallet"})]),[book()]);assert.equal(a.expenses[0].possibleDup,undefined);const b=merge(state([manual({amount:18,category:"super"})]),[book({amount:18,merchant:"TIENDA SINTETICA",card:true})]);assert.equal(b.expenses[0].possibleDup,undefined);});
t("un traspaso manual no se trata como ingreso manual",()=>{const a=merge(state([manual({category:"traspaso"})]),[book()]);assert.equal(a.expenses[0].possibleDup,undefined);});
t("nombre y fecha exactos conservan fila bancaria y terna distinta",()=>{for(const id of ["salary",null]){const m=manual({merchant:"NOMINA EMPRESA SINTETICA",date:new Date("2026-10-16T12:00:00").toISOString()}),a=merge(state([m]),[book({id})]);assert.equal(a.expenses.length,2);assert.equal(a.expenses[0].possibleDup,true);assert.notEqual(a.expenses[0].date,m.date);assert.equal(ctx.importObExpenses(a,[book({id})]),null);}});
t("genérico ambiguo no se empareja automáticamente con un aviso",()=>{const s=state([manual(),manual({id:"other"}),manual({id:"notice",source:"wallet"})]),a=merge(s,[book({id:null,merchant:"Movimiento"})]);assert.equal(a.expenses[0].possibleDup,true);assert.equal(a.expenses[0].possibleDupOf,undefined);assert.equal(a.expenses[0].autoGemelo,undefined);const again=ctx.reconcileGemelosAutomaticos(a);assert.equal(again.expenses[0].possibleDup,true);assert.equal(again.expenses[0].possibleDupOf,undefined);});
t("un manual ya reclamado no se vuelve a gastar",()=>{const first=merge(state([manual()]),[book()]);const claimed={...first,gemelos:ctx.gemelosDeImportacion(first.expenses.slice(0,1),first.expenses)};const second=merge(claimed,[book({id:"different"})]);assert.equal(second.expenses[0].possibleDup,undefined);});
t("un banco previo compatible impide vínculo unilateral nuevo",()=>{const old=manual({id:"old-bank",source:"ob",extId:"old",merchant:"SALARIO ANTERIOR"}),a=merge(state([manual(),old]),[book()]);assert.equal(a.expenses[0].possibleDup,true);assert.equal(a.expenses[0].possibleDupOf,undefined);});
t("un genérico legado sin estado también compite por el manual",()=>{for(const txs of [[book(),book({id:"legacy",merchant:"Movimiento",status:""})],[book({id:"legacy",merchant:"Movimiento",status:""}),book()]]){const a=merge(state([manual()]),txs),b=a.expenses.find(e=>e.extId==="salary");assert.equal(b.possibleDup,true);assert.equal(b.possibleDupOf,undefined);assert.equal(a.expenses.filter(e=>e.possibleDupOf==="manual").length,1);}});
console.log(JSON.stringify({zone:process.env.TZ,mutation:mutation||null,passed,failed}));if(failed)process.exitCode=1;
