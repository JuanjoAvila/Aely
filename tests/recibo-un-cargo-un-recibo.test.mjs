// FIN-23 (revisión de youtube-r4, 19/10/2026): UN cargo no puede pagar DOS recibos. Con la prueba
// BOOK de YouTube contabilizada días después del cargo de tarjeta (2/10 → 5/10, misma ref), la
// identidad de la prueba lleva la fecha y el texto del BOOK y no casaba con el cargo: la ficha
// ofrecía Spotify (mismo banco y céntimos) y al enlazarlo Plan daba los dos por pagados.
// FIN-24: la «fila única» de r4 se cuenta en todo el mes, no solo dentro de la ventana.
// Estados sintéticos, sin datos personales.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadPureLogic} from '../scripts/load-pure-logic.mjs';
const root=new URL('../',import.meta.url);
const source=f=>fs.readFileSync(new URL(f,root),'utf8');
const order=JSON.parse(source('src/build-order.json'));
let js=order.map(f=>source('src/modules/'+f)).join('\n');
if(process.env.CARGO_MUTANT){const patch=JSON.parse(fs.readFileSync(process.env.CARGO_MUTANT,'utf8'));assert(js.includes(patch.from),'anclaje real del mutante');js=js.replace(patch.from,patch.to);}
const c=loadPureLogic(source('src/shell.html').replace('<!--MC_APP_SCRIPT-->',()=>js));
c.Date=class extends Date {constructor(...a){super(...(a.length?a:['2026-10-18T12:00:00+02:00']));}static now(){return Date.parse('2026-10-18T12:00:00+02:00');}};
let checks=0;
function check(name,fn){fn();checks++;console.log('PASS '+name);}
const REF='20261002213646522190S1',IBAN='ES0000000000000000008405',BOOK='COMPRA TARJ. 5402XXXXXXXX6013 GOOGLE*YOUTUBE-DUBLIN';
const paid=(s,m=10,t=18)=>{const p=c.planChargesMonth(s,m,2026,t);return Object.fromEntries(p.pendingBills.concat(p.paidBills).filter(r=>r.id.startsWith('fixed_')).sort((a,b)=>a.id<b.id?1:-1).map(r=>[r.id.slice(6),r.paid]));};
const moneyOf=s=>JSON.stringify({plan:c.planChargesMonth(s,10,2026,18),inicio:c.dashboardBudgetStats(s),widget:c.monthBudgetStats(s,c.Date.now()),balance:c.monthNetForAccount(s,'sabadell',2026,10,18)});
const relation=(s,x=s.expenses[0])=>c.expensePaymentRelationUI(s,x);
const bookProof=(f,date,ref=REF,amount=29.99)=>c.fixedPaymentBind({kind:'book',key:'sabadell|'+ref,identity:JSON.stringify(['sabadell',date,amount,BOOK]),date,bank:'sabadell',merchant:BOOK,amount,model:c.fixedPaymentModel(f,Number(date.slice(5,7)))},f,Number(date.slice(5,7)));
// El caso real: YouTube acreditado por su BOOK del 5/10; Spotify, mismo banco y céntimos, sin prueba.
function state({bookDate='2026-10-05',chargeDate='2026-10-02',feed=true,proof=true}={}){
  const yt={id:'yt',name:'YouTube Premium',amount:29.99,account:'sabadell',freq:'mes',day:2};
  const sp={id:'sp',name:'Spotify',amount:29.99,account:'sabadell',freq:'mes',day:3};
  const x={id:'cargo',extId:REF,obAcc:IBAN,date:chargeDate,merchant:'YouTube Premium',obName:BOOK,amount:29.99,ent:'sabadell',category:'recibos',source:'ob',status:'BOOK'};
  const s={accounts:[{id:'a1',ent:'sabadell',role:'ambos',spendFrom:true,value:800,bankIban:IBAN}],fixed:[yt,sp],expenses:[x],
    bankTx:feed?[{id:REF,ent:'sabadell',date:bookDate,amount:29.99,merchant:BOOK,status:'BOOK',acc:IBAN}]:[],debts:[],oneoffs:[],deleted:[],flows:[]};
  const ym=Number(bookDate.slice(0,4))*12+Number(bookDate.slice(5,7));
  if(proof) yt.paymentProofs={[ym]:bookProof(yt,bookDate)};
  return s;
}
const ymOf=d=>2026*12+Number(d.slice(5,7));
// Lo que ya guardó una versión anterior: el enlace a mano de Spotify con el mismo cargo.
function storedDouble(opts){
  const s=state(opts),x=s.expenses[0],m=Number(x.date.slice(5,7));
  const p=c.fixedPaymentBind({kind:'expense',key:c.fixedExpenseKey(x),identity:c.fixedPaymentIdentity('sabadell',x),expenseId:x.id,expenseKey:c.keyOfExpense(x),expenseLegacyKey:c.keyOfExpenseLegacy(x),date:x.date,bank:'sabadell',amount:29.99,model:c.fixedPaymentModel(s.fixed[1],m)},s.fixed[1],m);
  s.fixed[1].paymentProofs={[ymOf(x.date)]:p};
  return s;
}

check('one charge proven by a later BOOK cannot be linked to a second receipt',()=>{for(const [label,opts] of [['stored proof',{}],['stored proof without feed',{feed:false}],['feed only',{proof:false}]]){
  const s=state(opts),before=JSON.stringify(s),money=moneyOf(s);
  assert.deepEqual(paid(s),{yt:true,sp:false},label+': YouTube pagado por su BOOK');
  assert.equal(c.fixedExpenseEligible(s,s.expenses[0],s.fixed[1],2026,10,18),false,label+': la ficha no ofrece Spotify');
  assert.equal(c.linkFixedPayment(s,'cargo','sp',2026,10,18),s,label+': el enlace a Spotify no se escribe');
  assert.equal(c.fixedExpenseEligible(s,s.expenses[0],s.fixed[0],2026,10,18),true,label+': su propio recibo sigue siendo elegible');
  assert.equal(JSON.stringify(s),before);assert.equal(moneyOf(s),money);}});
check('a stored double link is not counted twice, keeps its data and can be undone',()=>{
  const s=storedDouble(),before=JSON.stringify(s);
  assert.deepEqual(paid(s),{yt:true,sp:false},'Plan cuenta un solo recibo: el del BOOK');
  assert.equal(c.fixedPaymentState(s,s.fixed[1],2026,10,18).proof,null);
  assert.equal(relation(s)&&relation(s).id,'yt','la ficha nombra el recibo del BOOK');
  assert.equal(c.withdrawalReceiptLink(s,s.expenses[0]).id,'sp','el enlace guardado sigue ahí y se ve para deshacerlo');
  assert.equal(JSON.stringify(s),before,'leer no borra nada');
  assert.equal(JSON.stringify(c.reconcileFixedPaymentProofs(s,2026,10,18).fixed),JSON.stringify(s.fixed),'sincronizar tampoco');
  assert(c.slimForCloud(s).fixed.find(f=>f.id==='sp').paymentProofs,'la prueba viaja igual a la nube');
  const undone=c.linkFixedPayment(s,'cargo',null,2026,10,18);
  assert.equal(undone.fixed[1].paymentProofs[24322],undefined,'deshacer quita el enlace de Spotify');
  assert.deepEqual(paid(undone),{yt:true,sp:false});});
check('a manual link written before the BOOK arrives yields to it',()=>{
  const s=storedDouble({proof:false});
  assert.deepEqual(paid(s),{yt:true,sp:false});
  const r=c.reconcileFixedPaymentProofs(s,2026,10,18);assert.equal(r.fixed[0].paymentProofs[24322].kind,'book');assert.deepEqual(paid(r),{yt:true,sp:false});});
check('a booking that crosses the month still owns its charge',()=>{
  const s=state({chargeDate:'2026-09-30',bookDate:'2026-10-02'});
  assert.deepEqual(paid(s),{yt:true,sp:false});
  assert.equal(c.fixedExpenseEligible(s,s.expenses[0],s.fixed[1],2026,9,30),false);
  assert.equal(c.linkFixedPayment(s,'cargo','sp',2026,9,30),s);
  const d=storedDouble({chargeDate:'2026-09-30',bookDate:'2026-10-02'});
  assert.deepEqual(paid(d,9,30),{yt:false,sp:false},'septiembre: el cargo ya es de octubre');
  assert.deepEqual(paid(d),{yt:true,sp:false});});
check('a charge that is NOT the BOOK of another receipt still links',()=>{for(const [label,mutate,opts] of [
  ['other reference',s=>{s.expenses[0].extId='OTRA-REF';}],
  ['no reference',s=>{delete s.expenses[0].extId;}],
  ['BOOK 8 days later',()=>{},{bookDate:'2026-10-10'}],
  ['BOOK before the charge',s=>{s.expenses[0].date='2026-10-06';}],
  ['other cents',s=>{s.expenses[0].amount=29.98;s.fixed[1].amount=29.98;}],
  ['other account in the feed',s=>{s.bankTx[0].acc='ES0000000000000000009999';}],
  ['other bank',s=>{s.expenses[0].ent='caixabank';s.fixed[1].account='caixabank';s.accounts.push({id:'a2',ent:'caixabank',role:'ambos',spendFrom:true,value:100});}],
  ['vetoed for YouTube',s=>{s.reciboNo=c.reciboNoClaves('yt',JSON.stringify(['sabadell',s.bankTx[0].date,29.99,BOOK]),'x');}],
  ['vetoed for YouTube, no feed',s=>{s.reciboNo=c.reciboNoClaves('yt',JSON.stringify(['sabadell',s.bankTx[0].date,29.99,BOOK]),'x');s.bankTx=[];}],
]){const s=state(opts);mutate(s);
  assert.equal(c.fixedExpenseEligible(s,s.expenses[0],s.fixed[1],2026,10,18),true,label);
  const linked=c.linkFixedPayment(s,'cargo','sp',2026,10,18);
  assert.notEqual(linked,s,label+': se enlaza');assert.equal(paid(linked).sp,true,label);}});
check('same day keeps the protection it already had',()=>{
  const s=state({bookDate:'2026-10-02'});s.expenses[0].obName=BOOK;s.expenses[0].merchant=BOOK;
  s.fixed[0].paymentProofs={24322:bookProof(s.fixed[0],'2026-10-02')};
  assert.equal(c.linkFixedPayment(s,'cargo','sp',2026,10,18),s);assert.deepEqual(paid(s),{yt:true,sp:false});});
check('FIN-24: the same reference twice in the month names nobody, inside the window or not',()=>{
  for(const twin of ['2026-10-01','2026-10-04','2026-09-28']){
    const s=state({bookDate:'2026-10-09',chargeDate:'2026-10-09'});s.expenses[0].obName='COMPRA YOUTUBE';s.expenses[0].merchant='COMPRA YOUTUBE';
    s.fixed[0].paymentProofs={24322:bookProof(s.fixed[0],'2026-10-12')};s.bankTx[0].date='2026-10-12';
    assert.equal(relation(s)&&relation(s).id,'yt','sin gemelo sí la nombra');
    s.expenses=s.expenses.concat([{...s.expenses[0],id:'gemelo',date:twin}]);
    const named=relation(s);
    assert.equal(named&&named.id||null,twin.startsWith('2026-09')?'yt':null,'gemelo '+twin);}});
check('one charge pays one month: its BOOK in the next month keeps it from paying this one too',()=>{
  const s=state({chargeDate:'2026-09-30',bookDate:'2026-10-02'});s.fixed=[s.fixed[0]];
  Object.assign(s.expenses[0],{merchant:'YouTube Premium',obName:'COMPRA YOUTUBE PREMIUM'});
  assert.deepEqual(paid(s),{yt:true},'octubre por su BOOK');
  assert.deepEqual(paid(s,9,30),{yt:false},'septiembre no lo cuenta otra vez');
  delete s.fixed[0].paymentProofs;s.bankTx=[];
  assert.deepEqual(paid(s,9,30),{yt:true},'sin ese BOOK, septiembre sí lo adopta');});
check('a receipt paid by ANOTHER charge does not claim this one through the feed',()=>{
  const s=state({proof:false});const yt=s.fixed[0];
  yt.paymentProofs={24322:bookProof(yt,'2026-10-01','OTRA-REF-YOUTUBE')};
  assert(c.fixedPaymentProof(s,yt,2026,10,18),'YouTube ya está pagado por otro cargo');
  assert.equal(c.fixedExpenseEligible(s,s.expenses[0],s.fixed[1],2026,10,18),true);
  const linked=c.linkFixedPayment(s,'cargo','sp',2026,10,18);
  assert.notEqual(linked,s);assert.deepEqual(paid(linked),{yt:true,sp:true},'dos cargos, dos recibos');});
check('FIN-24: a refund with the same reference is not a second charge',()=>{
  const s=state();s.expenses=s.expenses.concat([{...s.expenses[0],id:'devolucion',date:'2026-10-08',amount:-29.99,category:'ingreso'}]);
  assert.equal(relation(s)&&relation(s).id,'yt');});
console.log(checks+' checks');
