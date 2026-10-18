import assert from "node:assert/strict";
import fs from "node:fs";
import {test} from "node:test";
import {loadPureLogic} from "../scripts/load-pure-logic.mjs";
const read=f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8");
let motor=read("src/modules/08-motor-bank.js");
if(process.env.AELY_RENAME_MUTANT){
  const mutants={
    name:["[e.id,accOf(e),occAmountIn(e,m)","[e.name,accOf(e),occAmountIn(e,m)"],
    id:["p.receiptId===e.id&&","true&&"],
    amount:["p.model===fixedPaymentContract(e,m)","true"],
    legacy:["p.model===fixedPaymentModel(e,m)","true"],
    noUpgrade:["if(p.name!==e.name&&", "if(false&&p.name!==e.name&&"],
    bookName:["owner=Object.assign({},e,{name:p.receiptName});","owner=e;"],
    syncUpgrade:["if(e.paymentProofs&&Object.prototype.hasOwnProperty.call(e.paymentProofs,ym)) return e;", ""],
    tombstone:["if((s.deleted||[]).indexOf(p.expenseKey)>=0||(p.expenseLegacyKey&&(s.deleted||[]).indexOf(p.expenseLegacyKey)>=0)) return null;",""]
  };
  const [from,to]=mutants[process.env.AELY_RENAME_MUTANT]||[];
  assert.ok(from&&motor.includes(from),"mutante debe alcanzar código real");motor=motor.replace(from,to);
}
const js=JSON.parse(read("src/build-order.json")).map(f=>f==="08-motor-bank.js"?motor:read("src/modules/"+f)).join("\n");
const c=loadPureLogic(read("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>js));
c.Date=class extends Date{constructor(...args){super(...(args.length?args:["2026-10-18T12:00:00+02:00"]));}};
const copy=s=>JSON.parse(JSON.stringify(s)),ym=24322;
const bill={id:"r1",name:"Ibi",amount:123.45,account:"sabadell",freq:"mes",day:10};
const charge={id:"e1",extId:"ref-book-1",obAcc:"account-1",date:"2026-10-10",merchant:"TRIBUTO MUNICIPAL",obName:"TRIBUTO MUNICIPAL",amount:123.45,ent:"sabadell",source:"ob",status:"BOOK",category:"otros"};
const raw=()=>({accounts:[{id:"account-1",ent:"sabadell",role:"fijos",value:800}],fixed:[copy(bill)],expenses:[copy(charge)],bankTx:[],debts:[],oneoffs:[],deleted:[]});
const status=(s,i=0)=>c.fixedPaymentState(s,s.fixed[i],2026,10,18);
const edit=(s,p)=>{let out;c.patchFixedById(fn=>out=fn(s),s.fixed[0].id,p);return copy(out);};
function linked(kind="expense",legacy=false){
  let s=raw();
  if(kind==="book"){
    s.fixed[0].name="Tributo municipal";
    s.bankTx=[{id:"book-ref-1",ent:"sabadell",date:charge.date,amount:123.45,merchant:"TRIBUTO MUNICIPAL",status:"BOOK"}];
    s=c.reconcileFixedPaymentProofs(s,2026,10,18);
  }else s=c.linkFixedPayment(s,"e1","r1",2026,10,18);
  assert.equal(status(s).paid,true,"precondición: pago acreditado por código real");
  if(legacy){
    s=copy(s);const p=s.fixed[0].paymentProofs[ym];p.model=c.fixedPaymentModel(s.fixed[0],10);
    delete p.modelVersion;delete p.receiptId;delete p.receiptName;
  }
  return copy(s);
}
for(const kind of ["expense","book"])for(const legacy of [false,true])for(const name of ["IBI","Impuesto de vivienda"]){
 test(`${kind} ${legacy?"legacy":"nuevo"}: renombrar a ${name} conserva pago y céntimos`,()=>{
  const s=linked(kind,legacy),before=copy(s),n=edit(s,{name});
  assert.equal(status(n).paid,true);assert.equal(Math.round(status(n).paidAmount*100),12345);
  assert.equal(n.fixed[0].id,"r1");assert.equal(n.fixed[0].paymentProofs[ym].identity,before.fixed[0].paymentProofs[ym].identity);
  for(const key of ["accounts","expenses","bankTx","deleted"])assert.deepEqual(n[key],before[key],key);
  assert.equal(n.fixed[0].paidYm,before.fixed[0].paidYm);
  const cloud=copy(c.slimForCloud(n));assert.equal(status(cloud).paid,true);assert.equal(Math.round(status(cloud).paidAmount*100),12345);
  const twice=edit(n,{name:"Recibo municipal"});assert.equal(status(twice).paid,true);
 });
}
test("nombre igual no reescribe pruebas heredadas; lectura tampoco",()=>{
 const s=linked("expense",true),before=JSON.stringify(s);status(s);
 assert.equal(JSON.stringify(s),before);assert.deepEqual(edit(s,{name:"Ibi"}).fixed[0].paymentProofs,s.fixed[0].paymentProofs);
});
test("prueba heredada ya inválida no se recupera por renombrar",()=>{
 const s=linked("expense",true);s.fixed[0].name="Ya modificado";
 assert.equal(status(s).paid,false);const n=edit(s,{name:"Nuevo nombre"});
 assert.equal(status(n).paid,false);assert.deepEqual(n.fixed[0].paymentProofs,s.fixed[0].paymentProofs);
});
test("importe y banco distintos siguen invalidando la prueba estable",()=>{
 for(const p of [{amount:123.46},{account:"revolut"},{bankAmount:123.46}]){
  const n=edit(edit(linked(),{name:"IBI"}),p);assert.equal(status(n).paid,false,JSON.stringify(p));
 }
});
test("id cambiado, duplicado y prueba copiada no acreditan otro recibo",()=>{
 const s=edit(linked(),{name:"IBI"});
 for(const change of [n=>n.fixed[0].id="otro",n=>n.fixed.push(copy(n.fixed[0])),n=>n.fixed[0].paymentProofs[ym].receiptId="otro"]){
  const n=copy(s);change(n);assert.equal(status(n).paid,false);
 }
});
test("mismo nombre no roba pago ni acredita otro cargo pendiente",()=>{
 const s=edit(linked(),{name:"IBI"});s.fixed.push({...bill,id:"r2",name:"IBI"});
 s.expenses.push({...charge,id:"e2",extId:"ref-pending-2",date:"2026-10-11",merchant:"IBI",obName:"IBI",status:"PDNG"});
 assert.equal(status(s).paid,true);assert.equal(status(s,1).paid,false);
 assert.equal(c.linkFixedPayment(s,"e1","r2",2026,10,18),s);
});
test("referencias distintas idénticas siguen ambiguas, no se absorben por renombrar",()=>{
 const s=linked();s.expenses.push({...charge,id:"e2",extId:"ref-book-2"});
 const n=edit(s,{name:"IBI"});assert.equal(status(n).paid,false);assert.deepEqual(n.expenses,s.expenses);
 assert.deepEqual(n.fixed[0].paymentProofs,s.fixed[0].paymentProofs);
});
test("PDNG, gasto borrado y veto explícito siguen anulando pago tras renombrar",()=>{
 for(const change of [n=>n.expenses[0].status="PDNG",n=>n.deleted.push(c.keyOfExpense(n.expenses[0])),n=>n.reciboNo=["r1|"+n.fixed[0].paymentProofs[ym].identity]]){
  const n=edit(linked(),{name:"IBI"});change(n);assert.equal(status(n).paid,false);
 }
});
test("el cargo se verifica todavía por banco, fecha, céntimos e identidad",()=>{
 for(const p of [{ent:"revolut"},{date:"2026-10-11"},{amount:123.46},{obName:"OTRO CARGO"}]){
  const s=edit(linked(),{name:"IBI"});Object.assign(s.expenses[0],p);assert.equal(status(s).paid,false,JSON.stringify(p));
 }
});
test("BOOK renombrado conserva negativas de estado y ambigüedad",()=>{
 const s=edit(linked("book"),{name:"IBI"});
 const pending=copy(s);pending.bankTx[0].status="PDNG";assert.equal(status(pending).paid,false);
 const twice=copy(s);twice.bankTx.push({...twice.bankTx[0],id:"book-ref-2"});assert.equal(status(twice).paid,false);
});
test("la lápida invalida también una prueba viajada sin fila local",()=>{
 const s=edit(linked(),{name:"IBI"}),n=copy(c.slimForCloud(s));
 n.deleted=[s.fixed[0].paymentProofs[ym].expenseKey];assert.equal(status(n).paid,false);
});
test("nombre e importe simultáneos no convierten el contrato antiguo",()=>{
 const s=linked("expense",true),n=edit(s,{name:"IBI",amount:123.46});
 assert.equal(status(n).paid,false);assert.deepEqual(n.fixed[0].paymentProofs,s.fixed[0].paymentProofs);
});
test("una prueba nula o de versión desconocida no se rescata ni rompe el editor",()=>{
 for(const proof of [null,{modelVersion:99}]){
  const s=raw();s.fixed[0].paymentProofs={[ym]:proof};
  const n=edit(s,{name:"IBI"});assert.equal(status(n).paid,false);assert.deepEqual(n.fixed[0].paymentProofs,s.fixed[0].paymentProofs);
 }
});
test("sincronizar no convierte una prueba heredada rota aunque el BOOK vuelva a casar",()=>{
 const s=linked("book",true);s.fixed[0].name=s.fixed[0].name.toUpperCase();
 assert.equal(c.fixedPaymentProof(s,s.fixed[0],2026,10,18),null);
 assert.equal(c.reconcileFixedPaymentProofs(s,2026,10,18),s);
 assert.equal(s.fixed[0].paymentProofs[ym].modelVersion,undefined);
});
