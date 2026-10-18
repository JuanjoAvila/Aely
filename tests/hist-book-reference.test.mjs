import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

// Datos sintéticos. Se ejercitan selección y alta REALES de la pantalla, con transporte local.
const c=loadPureLogicFromFile(), root=new URL("../",import.meta.url);
const ui=fs.readFileSync(new URL("src/modules/10-app-components.js",root),"utf8");
const core=fs.readFileSync(new URL("src/modules/00-core.js",root),"utf8");
const tx=(id,extra={})=>({ext_id:id,status:"BOOK",date:"2026-10-17",amount:12.5,merchant:"Tienda sintética H",...extra});
const payload=(rows,other=[])=>({links:[{aspsp:"CaixaBank",accounts:[{uid:"h-account-1",transactions:rows},...other]}]});
const state=(expenses=[])=>({expenses,accounts:[{id:"cx",ent:"caixabank",role:"diario"}],fixed:[],debts:[],oneoffs:[],flows:[],settings:{},deleted:[],gemelos:[]});
const flat=(p,s=state())=>c.histFlattenHistoryLinks(p,s.expenses,{caixabank:1}).out;
const cents=rows=>rows.reduce((n,r)=>n+Math.round(r.amount*100),0);
const refs=rows=>Array.from(rows,r=>r.extId||r.id).sort();
const slice=(text,start,end)=>{const i=text.indexOf(start),j=text.indexOf(end,i);assert.ok(i>=0&&j>i);return text.slice(i,j);};
const selection=slice(ui,"      const s0={}, d0={};","      // Sonda (c)");
const importSource=slice(ui,"  const runImport=function(){","  const doUndoLast=function(){")+"\nrunImport();";
const batchSource="({"+slice(core,"    async addExpensesBatch(expenses){","    /* Borrado SOLO por id")+"}).addExpensesBatch";

function transport(){
 const rows=[],calls=[];
 const sb={auth:{getSession:async()=>({data:{session:{user:{id:"synthetic-H"}}}})},from:table=>{
  assert.equal(table,"expenses");return {upsert:(incoming,opts)=>({select:async column=>{
   assert.equal(column,"id");assert.equal(opts.onConflict,"user_id,fecha,importe,comercio");assert.equal(opts.ignoreDuplicates,true);
   calls.push(JSON.parse(JSON.stringify(incoming)));const added=[];
   for(const row of incoming){if(rows.some(r=>['user_id','fecha','importe','comercio'].every(k=>r[k]===row[k])))continue;rows.push(row);added.push({id:row.id});}
   return {data:added,error:null};
  }})};}};
 const batch=vm.runInNewContext(batchSource,{sb,withNotaFallback:fn=>fn(true,true,true),expenseSourceForCloud:c.expenseSourceForCloud,isExpenseUuid:c.isExpenseUuid});
 return {rows,calls,batch,pull:()=>rows.map(r=>c.expenseFromRow(r))};
}
async function importUI(p,s,cloud,choose){
 const out=flat(p,s),classified=c.histClassifyCandidates(out,s);let sel,dest,next=s,closed;
 vm.runInNewContext(selection,{out,classified,defDest:x=>x.kind==="in"?"ingreso":"gasto",setSel:x=>sel=x,setDest:x=>dest=x});
 if(choose)out.forEach((x,i)=>sel[i]=choose(x,i,sel[i]));
 const done=new Promise(resolve=>closed=resolve);
 const env={...c,uid:vm.runInContext("uid",c),cands:out,classRows:classified.rows,sel,dest,selCount:Object.values(sel).filter(Boolean).length,visible:out.map((x,i)=>({x,i})),
  setImporting:()=>{},defDest:x=>x.kind==="in"?"ingreso":"gasto",cloud:{addExpensesBatch:cloud.batch},set:fn=>next=fn(next),onClose:closed,showToast:()=>{},t:x=>x,tf:x=>x,recDay:()=>17};
 if(env.selCount){vm.runInNewContext(importSource,env);await done;}
 return {out,classified,sel,next};
}
const tests=[];function test(name,fn){tests.push({name,fn});}
test("selection-cloud-reread",async()=>{
 const p=payload([tx("A"),tx("B")]),db=transport(),r=await importUI(p,state(),db);
 assert.equal(r.out.length,2);assert.equal(Object.values(r.sel).filter(Boolean).length,2);
 assert.equal(r.next.expenses.length,2);assert.equal(cents(r.next.expenses),2500);assert.equal(db.rows.length,2);
 assert.equal(new Set(db.rows.map(r=>r.fecha)).size,2);assert.deepEqual(refs(db.pull()),["A","B"]);
 const merged=c.mergeExpensesFromCloud(r.next.expenses,db.pull());assert.equal(merged.list.length,2);assert.equal(cents(merged.list),2500);
 const again=await importUI(payload([tx("B"),tx("A")]),state(merged.list),db);
 assert.equal(again.out.length,0);assert.equal(db.calls.length,1);
});
test("partial-selection-remainder",async()=>{
 const p=payload([tx("A"),tx("B")]),db=transport();
 const first=await importUI(p,state(),db,x=>x.id==="A");assert.equal(cents(first.next.expenses),1250);
 const second=await importUI(p,state(db.pull()),db);assert.deepEqual(refs(second.next.expenses),["A","B"]);assert.equal(cents(second.next.expenses),2500);assert.equal(db.rows.length,2);
});
test("truncated-reread-unproven-reference",async()=>{
 const db=transport();await importUI(payload([tx("A")]),state(),db);
 const r=await importUI(payload([tx("B")]),state(db.pull()),db);
 assert.equal(r.classified.rows[0].status,"maybe");assert.equal(r.sel[0],false);assert.equal(db.rows.length,1);assert.equal(cents(r.next.expenses),1250);
});
test("same-reference-repeat-and-orders",()=>{
 for(const rows of [[tx("A"),tx("B"),tx("A")],[tx("B"),tx("A"),tx("B")]]){
  const out=flat(payload(rows));assert.deepEqual(refs(out),["A","B"]);assert.equal(cents(out),2500);
  const built=c.histBuildCommit(out,c.histClassifyCandidates(out,state()).rows,state()).expAdds;
  assert.equal(new Set(built.map(c.keyOfExpense)).size,2);assert.equal(cents(built),2500);
 }
 const dates=rows=>Object.fromEntries(flat(payload(rows)).map(x=>[x.id,x.stamp]));
 assert.deepEqual(dates([tx("A"),tx("B")]),dates([tx("B"),tx("A")]));
});
test("legacy-and-pending-compatibility",()=>{
 for(const rows of [[tx(null,{status:""}),tx(null,{status:""})],[tx("P",{status:"PDNG"}),tx("A")],[tx("A"),tx("P",{status:"PDNG"})]])assert.equal(flat(payload(rows)).length,1);
 const rows=[tx("P",{status:"PDNG"}),tx("A"),tx("B")];assert.deepEqual(refs(flat(payload(rows))),["A","B"]);
 // Sin evidencia BOOK no se cambia el agrupado histórico anterior.
 assert.equal(flat(payload([tx("L1",{status:""}),tx("L2",{status:""})])).length,1);
 for(const rows of [[tx("X",{status:"POST"}),tx("A"),tx("B")],[tx("A"),tx("X",{status:"POST"}),tx("B")]])
  assert.deepEqual(refs(flat(payload(rows))),["A","B"],"una fila ambigua previa no oculta dos referencias BOOK explícitas");
});
test("accounts-and-legacy-cloud-dates",()=>{
 const p=payload([tx("A"),tx("B")],[{uid:"h-account-2",transactions:[tx("C")]}]);
 const out=flat(p);assert.equal(out.length,3);assert.equal(cents(out),3750);assert.equal(new Set(out.map(x=>x.stamp)).size,3);
 const legacy=flat(payload([tx(null,{status:""})],[{uid:"h-account-2",transactions:[tx(null,{status:""})]}]));
 assert.equal(legacy[0].stamp,c.histDate("2026-10-17"));
 assert.equal(legacy[1].stamp,c.histDate("2026-10-17","ob-slot|caixabank|2026-10-17|12.5|Tienda sintética H|1"));
});
test("tombstone-and-legacy-decision",()=>{
 const out=flat(payload([tx("A"),tx("B")]));
 const built=c.histBuildCommit(out,c.histClassifyCandidates(out,state()).rows,state()).expAdds;
 assert.equal(built.length,2);const s=state([built[0]]);s.deleted=[c.keyOfExpense(built[1])];s.gemelos=[c.bankDeletionLink(built[1])];
 const again=flat(payload([tx("A"),tx("B")]),s),classes=c.histClassifyCandidates(again,s).rows;
 assert.equal(classes[0].status,"dup");assert.equal(c.histBuildCommit(again,classes,s).expAdds.length,0);
 const old=state();old.deleted=[c.keyOfExpenseLegacy(built[0])];
 assert.ok(c.histClassifyCandidates(out,old).rows.every(r=>r.status==="dup"));
});
test("existing-legacy-without-reference",()=>{
 const e={id:"old",date:"2026-10-17T12:00:00Z",amount:12.5,merchant:"Tienda sintética H",ent:"caixabank",source:"ob-hist"};
 const s=state([e]),out=flat(payload([tx("A"),tx("B")]),s),r=c.histClassifyCandidates(out,s).rows;
 assert.equal(r.filter(x=>x.status==="dup").length,1);assert.equal(r.filter(x=>x.status==="new").length,1);
});
test("different-unproven-ref-without-merchant",async()=>{
 const db=transport();await importUI(payload([tx("A",{merchant:"Movimiento"})]),state(),db);
 const r=await importUI(payload([tx("B",{merchant:"Movimiento"})]),state(db.pull()),db);
 assert.equal(r.classified.rows[0].status,"maybe");assert.equal(r.sel[0],false);assert.equal(cents(r.next.expenses),1250);
});
test("daily-history-convergence",async()=>{
 const p=payload([tx("A"),tx("B")]),db=transport(),r=await importUI(p,state(),db);
 const s=state(r.next.expenses),bank=c.flattenBankTx(p.links,[]);
 assert.equal(c.importObExpenses(s,bank,p.links),null);
 const daily=c.importObExpenses(state(),bank,p.links);assert.equal(daily.length,2);
 const merged=c.mergeExpensesFromCloud(daily,db.pull());assert.equal(merged.list.length,2);assert.equal(cents(merged.list),2500);
 assert.equal(flat(p,state(merged.list)).length,0);
});
test("deleted-reference-reserves-only-its-slot",async()=>{
 for(const gone of ["A","B"])for(const includeDeleted of [true,false]){
  const db=transport(),first=await importUI(payload([tx("A"),tx("B")]),state(),db);
  const deleted=first.next.expenses.find(e=>e.extId===gone),kept=first.next.expenses.filter(e=>e!==deleted);
  // La superviviente tiene prueba de liquidación; aislar aquí la reserva del borrado.
  const s=state(kept.map(e=>({...e,obPendingRef:"settled-P"})));s.deleted=[c.keyOfExpense(deleted)];s.gemelos=[c.bankDeletionLink(deleted)];
  const r=await importUI(payload(includeDeleted?[tx("C"),tx(gone)]:[tx("C")]),s,db);
  assert.equal(r.classified.rows.find((_,i)=>r.out[i].id==="C").status,"new");
  if(includeDeleted)assert.equal(r.classified.rows.find((_,i)=>r.out[i].id===gone).status,"dup");
  const added=r.next.expenses.find(e=>e.extId==="C");assert.ok(added);assert.equal(added.obOrd,3);
  assert.ok(!c.expenseIsTombstoned(added,Object.fromEntries(s.deleted.map(k=>[k,1]))));
  assert.equal(cents(r.next.expenses),2500);
 }
});
test("income-reference-cloud-roundtrip",async()=>{
 const db=transport(),r=await importUI(payload([tx("I1",{amount:-12.5}),tx("I2",{amount:-12.5})]),state(),db);
 assert.equal(r.next.expenses.length,2);assert.equal(cents(r.next.expenses),-2500);
 assert.equal(new Set(r.next.expenses.map(c.keyOfExpense)).size,2);
 assert.equal(new Set(db.pull().map(c.keyOfExpense)).size,2);
 const again=await importUI(payload([tx("I1",{amount:-12.5}),tx("I2",{amount:-12.5}),tx("I3",{amount:-12.5})]),state(db.pull()),db);
 assert.equal(cents(again.next.expenses),-3750);assert.equal(db.rows.length,3);
});
test("pending-and-absorption-guards",()=>{
 const pending={id:"p",extId:"P",source:"ob",ent:"caixabank",date:c.histDate("2026-10-17"),amount:12.5,merchant:"Movimiento",obPending:true};
 const s=state([pending]);
 assert.equal(c.histClassifyCandidates(flat(payload([tx("A",{merchant:"Movimiento"})]),s),s).rows[0].status,"maybe");
 pending.date=c.histDate("2026-10-16");
 assert.equal(c.histClassifyCandidates(flat(payload([tx("A",{merchant:"Movimiento"})]),s),s).rows[0].status,"maybe");
 const out=flat(payload([tx("A"),tx("B")])),built=c.histBuildCommit(out,c.histClassifyCandidates(out,state()).rows,state()).expAdds;
 const absorbed=state();absorbed.deleted=[c.obAbsorptionKey(built[1])];
 assert.deepEqual(Array.from(c.histClassifyCandidates(out,absorbed).rows,r=>r.status),["new","dup"]);
 const other=state();other.deleted=[c.obAbsorptionKey({...built[1],obAcc:"other-account"})];
 assert.ok(c.histClassifyCandidates(out,other).rows.every(r=>r.status==="new"));
});
// Ronda 2: una referencia antigua no acredita BOOK por la ausencia de obPending.
test("r2-legacy-daily-pending-unproven",async()=>{
 // El diario no admite ingresos PDNG; su recorrido histórico se prueba debajo con ambos signos.
 for(const amount of [12.5])for(const merchant of ["Tienda sintética H","Movimiento"]){
  const p=payload([tx("P1",{status:"PDNG",amount,merchant})]);
  const daily=c.importObExpenses(state(),c.flattenBankTx(p.links,[]),p.links);
  assert.equal(daily.length,1);delete daily[0].obPending; // versión diaria antigua
  const db=transport(),r=await importUI(payload([tx("B1",{amount,merchant})]),state(daily),db);
  assert.equal(r.classified.rows[0].status,"maybe");assert.equal(r.sel[0],false);
  assert.equal(r.out.length,1);assert.equal(r.next.expenses.length,1);assert.equal(db.calls.length,0);
  assert.equal(cents(r.next.expenses),amount*100);
 }
});
test("r2-pending-fila-constructor",()=>{
 const x=flat(payload([tx("P9",{status:"PDNG"})]))[0];
 assert.equal(c.histFilaGasto(x,{},"otros","synthetic").obPending,true);
});
test("r2-pending-build-constructor",()=>{
 for(const amount of [12.5,-12.5]){
  const out=flat(payload([tx("P9",{status:"PDNG",amount})]));
  const built=c.histBuildCommit(out,c.histClassifyCandidates(out,state()).rows,state()).expAdds;
  assert.equal(built[0].obPending,true);assert.equal(cents(built),amount*100);
 }
});
test("r2-pending-ui-cloud-book",async()=>{
 for(const amount of [12.5,-12.5]){
  const db=transport(),p=await importUI(payload([tx("P9",{status:"PDNG",amount})]),state(),db);
  assert.equal(p.next.expenses[0].obPending,true);assert.equal(db.pull()[0].obPending,true);
  const r=await importUI(payload([tx("B9",{amount})]),state(db.pull()),db);
  assert.equal(r.classified.rows[0].status,"maybe");assert.equal(r.sel[0],false);
  assert.equal(db.rows.length,1);assert.equal(cents(r.next.expenses),amount*100);
  const selected=await importUI(payload([tx("B9",{amount})]),state(db.pull()),db,()=>true);
  assert.equal(selected.next.expenses.find(e=>e.extId==="B9").possibleDup,true);
  assert.equal(selected.next.expenses.find(e=>e.extId==="B9").possibleDupOf,p.next.expenses[0].id);
 }
});
test("r2-book-proof-and-response-lifetime",async()=>{
 const db=transport();await importUI(payload([tx("A")]),state(),db);const s=state(db.pull());
 const proven=flat(payload([tx("A"),tx("B")]),s);
 assert.deepEqual(refs(proven),["B"]);assert.equal(c.histClassifyCandidates(proven,s).rows[0].status,"new");
 const unknown=flat(payload([tx("B")]),s);
 assert.equal(c.histClassifyCandidates(unknown,s).rows[0].status,"maybe","una respuesta anterior no acredita la actual");
 assert.equal(c.histClassifyCandidates(proven,s).rows[0].status,"new","la prueba pertenece a su candidato");
 const settled=state(s.expenses.map(e=>({...e,obPendingRef:"old-P"})));
 assert.equal(c.histClassifyCandidates(flat(payload([tx("B")]),settled),settled).rows[0].status,"new");
 const two=await importUI(payload([tx("B"),tx("C")]),s,db);
 assert.ok(two.classified.rows.every(r=>r.status==="maybe"));assert.ok(Object.values(two.sel).every(x=>!x));
 assert.equal(db.rows.length,1);assert.equal(flat(payload([tx("A")]),s).length,0);
 const gone=c.histFilaGasto(unknown[0],{},"otros","x");const deleted=state(s.expenses);
 deleted.deleted=[c.keyOfExpense(gone)];deleted.gemelos=[c.bankDeletionLink(gone)];
 assert.equal(c.histClassifyCandidates(flat(payload([tx("B")]),deleted),deleted).rows[0].status,"dup");
});
const IBAN="ES00SYNTH000000000000002";
const dualPayload=(extra={})=>({links:[{aspsp:"CaixaBank",accounts:[{uid:"joint-uid",iban:IBAN,transactions:[tx("ACC",extra)]}]}]});
test("r2-account-iban-cloud-absorption",async()=>{
 const p=dualPayload(),daily=c.importObExpenses(state(),c.flattenBankTx(p.links,[]),p.links)[0];
 const db=transport(),r=await importUI(p,state(),db),e=r.next.expenses[0];
 assert.equal(e.obAcc,IBAN);assert.equal(db.pull()[0].obAcc,IBAN);assert.equal(e.obAcc,daily.obAcc);
 const promoted={id:"joint",ent:"caixabank",bankIban:IBAN};
 assert.equal(c.accountOwnsMovement(promoted,"account",e.obAcc),true);
 assert.equal(c.obAbsorptionKey(e),c.obAbsorptionKey(daily));
 const s=state();s.deleted=[c.obAbsorptionKey(daily)];
 assert.equal(c.histClassifyCandidates(flat(p),s).rows[0].status,"dup");
 assert.equal(c.expenseIsTombstoned(e,{[c.obAbsorptionKey(daily)]:1}),true);
 assert.equal(c.expenseIsTombstoned({...e,obAcc:"other"},{[c.obAbsorptionKey(daily)]:1}),false);
});
test("r2-account-own-part",async()=>{
 const p=dualPayload(),db=transport(),r=await importUI(p,state(),db);
 const joint={id:"joint",ent:"caixabank",name:"Conjunta",role:"fijos",bankIban:IBAN,value:1000};
 const mine={key:"mine",ent:"caixabank",iban:"ES00SYNTH000000000000001",value:1000,name:"Personal"};
 const s={...state(),accounts:[joint],obAccounts:[mine],investments:[],assets:[],aportaciones:[],accountBalanceHistory:{},
  expenses:[{id:"start",date:"2026-10-01T12:00:00Z",amount:0,source:"ob",ent:"caixabank"},...r.next.expenses]};
 const series=c.netWorthSeries(c.setAccountShare(s,joint,"account",50),{today:"2026-10-18"});
 assert.equal(Math.round(series.find(x=>x.day==="2026-10-16").value*100),150625);
 assert.equal(Math.round(series.find(x=>x.day==="2026-10-18").value*100),150000);
 assert.equal(cents(r.next.expenses),1250,"el gasto conserva su importe entero");
});
test("r2-account-fallback-and-no-position",async()=>{
 for(const account of [{uid:"uid-only"},{}])for(const status of ["BOOK","PDNG"]){
  const p={links:[{aspsp:"CaixaBank",accounts:[{...account,transactions:[tx("ACC",{status,amount:-12.5})]}]}]};
  const db=transport(),r=await importUI(p,state(),db),x=r.out[0],e=r.next.expenses[0];
  assert.equal(x.obAcc,account.uid);assert.equal(e.obAcc,account.uid);assert.equal(db.pull()[0].obAcc,account.uid);
  if(!account.uid){assert.ok(!Object.hasOwn(x,"obAcc"));assert.ok(!Object.hasOwn(e,"obAcc"));}
 }
});
const only=process.env.HIST_CASE;let failed=0,passed=0;
for(const {name,fn} of tests){if(only&&!new RegExp(only).test(name))continue;try{await fn();passed++;console.log("PASS "+name);}catch(e){failed++;console.error("FAIL "+name+"\n"+e.stack);}}
assert.ok(passed+failed>0,"HIST_CASE debe ejecutar al menos una prueba");
console.log(JSON.stringify({passed,failed,total:passed+failed}));process.exitCode=failed?1:0;
