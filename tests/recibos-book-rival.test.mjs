import assert from "node:assert/strict";
import fs from "node:fs";
import {test} from "node:test";
import {loadPureLogic} from "../scripts/load-pure-logic.mjs";
const read=f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8");
let motor=read("src/modules/08-motor-bank.js");
if(process.env.AELY_BOOK_RIVAL_MUTANT){
  const mutants={
    both:[['var p=fixedPaymentProof(s,f,y,m,today)||fixedPaymentBookRival(s,f,y,m,fixedPaymentIdentity(tx.ent,tx));','var p=fixedPaymentProof(s,f,y,m,today);'],['if(rival) f=Object.assign({},f,{name:rival.receiptName});','']],
    name:[['if(rival) f=Object.assign({},f,{name:rival.receiptName});','']],
    identity:[['p.identity===identity&&','true&&']],
    month:[['var p=e.paymentProofs&&e.paymentProofs[y*12+m];','var p=e.paymentProofs&&Object.values(e.paymentProofs)[0];']],
    kind:[['p.kind==="book"&&p.modelVersion===2&&','p.modelVersion===2&&']],
    veto:[['&&!reciboVetado(s,e.id,identity)', '']]
  };
  for(const [from,to] of mutants[process.env.AELY_BOOK_RIVAL_MUTANT]||[]){assert.ok(motor.includes(from),"anclaje real del mutante");motor=motor.replace(from,to);}
}
const js=JSON.parse(read("src/build-order.json")).map(f=>f==="08-motor-bank.js"?motor:read("src/modules/"+f)).join("\n");
const c=loadPureLogic(read("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>js));
c.Date=class extends Date{constructor(...args){super(...(args.length?args:["2026-10-18T12:00:00+02:00"]));}};
const copy=x=>JSON.parse(JSON.stringify(x)),ym=24322;
function rivalState(){
  const bill={id:"r1",name:"Tributo municipal",amount:123.45,account:"sabadell",freq:"mes",day:10};
  const tx={id:"book-ref-1",ent:"sabadell",date:"2026-10-10",amount:123.45,merchant:"TRIBUTO MUNICIPAL",status:"BOOK",obAcc:"synthetic-account"};
  let s={accounts:[{id:"synthetic-account",ent:"sabadell",role:"fijos",value:800}],fixed:[bill],bankTx:[tx],expenses:[],debts:[],oneoffs:[],deleted:[]};
  s=c.reconcileFixedPaymentProofs(s,2026,10,18);
  assert.equal(s.fixed[0].paymentProofs[ym].modelVersion,2);
  c.patchFixedById(fn=>s=fn(s),"r1",{name:"IBI"});
  assert.equal(c.fixedPaymentState(s,s.fixed[0],2026,10,18).paid,true,"antes del rival sigue pagado");
  return copy({...s,fixed:s.fixed.concat([{...bill,id:"r2"}])});
}
const paid=s=>s.fixed.map(f=>c.fixedPaymentState(s,f,2026,10,18).paid);
const owner=(s,identity=s.fixed[0].paymentProofs[ym]?.identity)=>c.fixedPaymentAutoOwner(s,s.fixed.find(f=>f.id==="r2"),2026,10,"sabadell","TRIBUTO MUNICIPAL",123.45,null,true,identity);
test("BOOK renombrado y recibo recreado: ambos pendientes, misma cuenta y céntimos",()=>{
  const s=rivalState(),before=JSON.stringify(s);assert.deepEqual(paid(s),[false,false]);assert.equal(JSON.stringify(s),before);
  assert.equal(Math.round(s.bankTx[0].amount*100),12345);assert.equal(s.bankTx[0].id,"book-ref-1");assert.equal(s.bankTx[0].obAcc,"synthetic-account");
});
test("reconciliar no transfiere al recreado la prueba del recibo original",()=>{
  const s=rivalState(),before=JSON.stringify(s),n=c.reconcileFixedPaymentProofs(s,2026,10,18);
  console.log("BOOK rival observado",JSON.stringify({paid:paid(s),afterPaid:paid(n),r2Proof:!!n.fixed[1].paymentProofs}));
  assert.equal(n,s);assert.equal(JSON.stringify(n),before);assert.equal(n.fixed[1].paymentProofs,undefined);
});
test("el dueño automático cuenta el nombre guardado del rival para esa identidad",()=>{
  assert.equal(owner(rivalState()),false);
});
test("invertir el orden de los recibos no cambia la ambigüedad",()=>{
  const s=rivalState();s.fixed.reverse();assert.deepEqual(paid(s),[false,false]);assert.equal(c.reconcileFixedPaymentProofs(s,2026,10,18),s);
});
test("prueba de otra identidad no reserva este BOOK por el nombre antiguo",()=>{
  const s=rivalState(),p=s.fixed[0].paymentProofs[ym];p.date="2026-10-09";p.identity=c.fixedPaymentIdentity(p.bank,p);
  const identity=c.fixedPaymentIdentity("sabadell",s.bankTx[0]);assert.equal(owner(s,identity),true);assert.equal(paid(s)[1],true);
});
test("prueba de otro mes no reserva el cargo del mes actual",()=>{
  const s=rivalState(),p=s.fixed[0].paymentProofs[ym];s.fixed[0].paymentProofs={[ym-1]:p};
  assert.equal(owner(s,p.identity),true);assert.equal(paid(s)[1],true);
});
test("solo BOOK v2 aporta el nombre histórico al dueño automático",()=>{
  for(const patch of [{kind:"expense"},{modelVersion:1},{modelVersion:undefined},{receiptId:"otro"},{model:"contrato inválido"}]){
    const s=rivalState();Object.assign(s.fixed[0].paymentProofs[ym],patch);assert.equal(owner(s),true,JSON.stringify(patch));
  }
});
test("el veto del original libera su candidatura sin reescribir la prueba",()=>{
  const s=rivalState();s.reciboNo=["r1|"+s.fixed[0].paymentProofs[ym].identity];const before=JSON.stringify(s);
  assert.equal(owner(s),true);assert.equal(paid(s)[1],true);assert.equal(JSON.stringify(s),before);
});
test("rival de otro banco o de otro contrato no disputa este pago",()=>{
  for(const patch of [{account:"revolut"},{amount:123.46}]){
    const s=rivalState();Object.assign(s.fixed[0],patch);assert.equal(owner(s),true);assert.equal(paid(s)[1],true);
  }
});
test("BOOK pendiente y dos referencias compatibles no producen transferencia",()=>{
  for(const mutate of [s=>s.bankTx[0].status="PDNG",s=>s.bankTx.push({...s.bankTx[0],id:"book-ref-2"})]){
    const s=rivalState();mutate(s);const before=JSON.stringify(s);assert.deepEqual(paid(s),[false,false]);assert.equal(c.reconcileFixedPaymentProofs(s,2026,10,18),s);assert.equal(JSON.stringify(s),before);
  }
});
test("un recibo que ya no ocurre en este mes no reserva el BOOK",()=>{
  const s=rivalState();Object.assign(s.fixed[0],{freq:"año",months:[11]});
  assert.equal(owner(s),true);assert.equal(paid(s)[1],true);
});
