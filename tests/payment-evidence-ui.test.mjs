import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadPureLogic} from '../scripts/load-pure-logic.mjs';
import {paymentFixture} from './fixtures/payment-ui.mjs';
const root=new URL('../',import.meta.url);
const source=f=>fs.readFileSync(new URL(f,root),'utf8');
const order=JSON.parse(source('src/build-order.json'));
let js=order.map(f=>source('src/modules/'+f)).join('\n');
if(process.env.PAYMENT_MUTANT){const patch=JSON.parse(fs.readFileSync(process.env.PAYMENT_MUTANT,'utf8'));assert(js.includes(patch.from));js=js.replace(patch.from,patch.to);}
const c=loadPureLogic(source('src/shell.html').replace('<!--MC_APP_SCRIPT-->',()=>js));
c.Date=class extends Date {constructor(...a){super(...(a.length?a:['2026-10-18T12:00:00+02:00']));}static now(){return Date.parse('2026-10-18T12:00:00+02:00');}};
let checks=0;
function check(name,fn){fn();checks++;console.log('PASS '+name);}
const read=s=>c.paymentEvidenceUI(s,2026,10,18);
const relation=s=>c.expensePaymentRelationUI(s,s.expenses[0]);
check('calendar paid remains financial only',()=>{const s=paymentFixture('debt');assert(c.debtPaymentState(s,s.debts[0],2026,10,18).paid);assert.equal(read(s).confirmed['debt_debt-synthetic'],false);assert.equal(relation(s),null);});
check('BOOKv2 exact expense including missing feed and rename',()=>{for(const mode of ['feed','missing','rename']){const s=paymentFixture();if(mode==='missing')s.bankTx=[];if(mode==='rename')s.fixed[0].name='Nuevo nombre';assert(read(s).confirmed['fixed_receipt-synthetic']);assert.equal(relation(s).id,s.fixed[0].id);assert.equal(relation(s).name,s.fixed[0].name);}});
check('missing feed never discards the proof reference',()=>{const s=paymentFixture();s.bankTx=[];s.expenses[0].extId='another-ref';assert.equal(relation(s),null);});
check('missing feed preserves known bank account identity',()=>{const s=paymentFixture();s.bankTx=[];s.accounts[0].bankUid='account-synthetic';assert.equal(relation(s).id,s.fixed[0].id);s.expenses[0].obAcc='different-account';assert.equal(relation(s),null);});
check('signed reference stays signed',()=>{const s=paymentFixture();s.expenses[0].extId='-signed-ref';s.bankTx[0].id='-signed-ref';s.fixed[0].paymentProofs[24322].key='sabadell|-signed-ref';assert.equal(relation(s).id,s.fixed[0].id);s.expenses[0].extId='signed-ref';assert.equal(relation(s),null);});
check('debt reference and account conflicts cannot accredit the exact expense',()=>{for(const field of ['id','acc']){const s=paymentFixture('linked-debt'),x=s.expenses[0];s.bankTx=[{...x,id:x.extId,acc:x.obAcc}];s.bankTx[0][field]='different';assert.equal(relation(s),null);assert.equal(read(s).confirmed['debt_debt-synthetic'],false);}});
check('paidYm alone creates no relation or paid badge',()=>{const s=paymentFixture();s.bankTx=[];s.expenses=[];delete s.fixed[0].paymentProofs;Object.assign(s.fixed[0],{paidYm:24322,paidDay:10});assert(c.fixedPaymentState(s,s.fixed[0],2026,10,18).paid);assert.equal(read(s).confirmed['fixed_receipt-synthetic'],false);});
check('validated linked debt names exact debt',()=>{const s=paymentFixture('linked-debt');assert.equal(relation(s).name,s.debts[0].name);assert(read(s).confirmed['debt_debt-synthetic']);});
check('explicit receipt mark with BOOK keeps same relation',()=>{const s=paymentFixture();s.expenses[0].reciboId=s.fixed[0].id;assert.equal(relation(s).id,s.fixed[0].id);});
check('stale detail reference cannot borrow current relation',()=>{const s=paymentFixture();assert.equal(c.expensePaymentRelationUI(s,{...s.expenses[0],extId:'different'}),null);});
check('oneoff explicit BOOK mark is read, calendar alone is not proof',()=>{const s=paymentFixture(),f=s.fixed[0];s.fixed=[];s.oneoffs=[{id:f.id,name:f.name,amount:f.amount,account:f.account,month:10,year:2026,day:10}];assert.equal(read(s).confirmed['oneoff_'+f.id],false);s.expenses[0].reciboId=f.id;assert.equal(relation(s).id,f.id);assert(read(s).confirmed['oneoff_'+f.id]);});
check('manual expense proof is read without persisting any link',()=>{let s=paymentFixture();s.bankTx=[];delete s.fixed[0].paymentProofs;Object.assign(s.expenses[0],{source:'manual',merchant:'Otro comercio',obName:'Otro comercio'});s=c.linkFixedPayment(s,s.expenses[0].id,s.fixed[0].id,2026,10,18);assert.equal(s.fixed[0].paymentProofs[24322].kind,'expense');assert.equal(relation(s).id,s.fixed[0].id);});
for(const [label,mutate] of [
  ['reference',s=>s.expenses[0].extId='OTHER-REF'],
  ['account',s=>s.expenses[0].obAcc='OTHER-ACCOUNT'],
  ['duplicate content distinct references',s=>s.expenses.push({...s.expenses[0],id:'second',extId:'second-ref'})],
  ['duplicate content distinct accounts',s=>s.expenses.push({...s.expenses[0],id:'second',obAcc:'second-account'})],
  ['ordinal duplicate',s=>s.expenses.push({...s.expenses[0],id:'second',obOrd:2})],
  ['duplicate id other month',s=>s.expenses.push({...s.expenses[0],date:'2026-09-10'})],
  ['veto',s=>s.reciboNo=c.reciboNoClaves(s.fixed[0].id,c.reciboNoIdentidad(s.expenses[0]),s.expenses[0].id)],
  ['tombstone',s=>s.deleted=[c.keyOfExpense(s.expenses[0])]],
  ['pending',s=>s.expenses[0].status='PDNG'],
  ['possible duplicate',s=>s.expenses[0].possibleDup=true],
  ['conflicting explicit receipt',s=>s.expenses[0].reciboId='different'],
  ['ambiguous receipt',s=>s.fixed.push({...s.fixed[0],id:'other'})],
])check(label+' cannot create relation',()=>{const s=paymentFixture();mutate(s);assert.equal(relation(s),null);});
check('manual eligibility is no evidence',()=>{const s=paymentFixture();s.bankTx=[];delete s.fixed[0].paymentProofs;Object.assign(s.expenses[0],{source:'manual',merchant:'Otro',obName:'Otro',reciboId:s.fixed[0].id});assert(c.fixedExpenseEligible(s,s.expenses[0],s.fixed[0],2026,10,18));assert.equal(relation(s),null);});
// INC-1810-04 (YouTube Premium): un cargo marcado que Plan no adopta y un recibo «pagado» solo por
// calendario tenían el enlace a mano bloqueado. Ninguno de los dos enlaza solo: solo al pulsar.
const markedUnadopted=()=>{const s=paymentFixture();s.bankTx=[];delete s.fixed[0].paymentProofs;Object.assign(s.expenses[0],{reciboId:s.fixed[0].id,amount:30.49});return s;};
const calendarOnly=()=>{const s=paymentFixture();s.bankTx=[];delete s.fixed[0].paymentProofs;Object.assign(s.fixed[0],{paidYm:24322,paidDay:10});s.expenses[0].amount=30.49;return s;};
const moneyOf=s=>JSON.stringify({plan:c.planChargesMonth(s,10,2026,18),inicio:c.dashboardBudgetStats(s),widget:c.monthBudgetStats(s,c.Date.now()),balance:c.monthNetForAccount(s,'sabadell',2026,10,18),cloud:c.slimForCloud(s)});
check('marked charge not adopted by Plan can be confirmed by the user',()=>{const s=markedUnadopted(),before=JSON.stringify(s),money=moneyOf(s);
  assert.equal(relation(s),null);assert.equal(c.fixedPaymentState(s,s.fixed[0],2026,10,18).paid,false);
  assert.equal(c.reciboConfirmableUI(s,s.expenses[0]).id,s.fixed[0].id);assert.equal(moneyOf(s),money);assert.equal(JSON.stringify(s),before);
  const linked=c.linkFixedPayment(s,s.expenses[0].id,s.fixed[0].id,2026,10,18);
  assert.equal(linked.fixed[0].paymentProofs[24322].kind,'expense');assert.equal(relation(linked).id,s.fixed[0].id);
  assert(c.planChargesMonth(linked,10,2026,18).paidBills.some(x=>x.id==='fixed_receipt-synthetic'));assert.equal(c.reciboConfirmableUI(linked,linked.expenses[0]),null);});
check('confirm action is not offered when the mark is already accredited, vetoed or from a oneoff',()=>{
  const ok=paymentFixture();ok.expenses[0].reciboId=ok.fixed[0].id;assert.equal(c.reciboConfirmableUI(ok,ok.expenses[0]),null);
  const veto=markedUnadopted();veto.reciboNo=c.reciboNoClaves(veto.fixed[0].id,c.reciboNoIdentidad(veto.expenses[0]),veto.expenses[0].id);assert.equal(c.reciboConfirmableUI(veto,veto.expenses[0]),null);
  const one=markedUnadopted(),f=one.fixed[0];one.fixed=[];one.oneoffs=[{id:f.id,name:f.name,amount:f.amount,account:f.account,month:10,year:2026,day:10}];assert.equal(c.reciboConfirmableUI(one,one.expenses[0]),null);});
check('paidYm without proof does not block the manual link',()=>{const s=calendarOnly(),before=JSON.stringify(s),money=moneyOf(s);
  const st=c.fixedPaymentState(s,s.fixed[0],2026,10,18);assert(st.paid);assert.equal(c.fixedPaymentEvidence(st),false);
  assert(c.fixedExpenseEligible(s,s.expenses[0],s.fixed[0],2026,10,18));assert.equal(moneyOf(s),money);assert.equal(JSON.stringify(s),before);
  const linked=c.linkFixedPayment(s,s.expenses[0].id,s.fixed[0].id,2026,10,18);
  assert.equal(linked.fixed[0].paymentProofs[24322].kind,'expense');assert.equal(linked.fixed[0].paidYm,24322);assert.equal(relation(linked).id,s.fixed[0].id);});
check('real proof still blocks a second manual link',()=>{const s=paymentFixture();s.expenses.push({...s.expenses[0],id:'other-synthetic',extId:'other-ref',date:'2026-10-12',amount:30.49,merchant:'YOUTUBE OTRO',obName:'YOUTUBE OTRO'});
  assert(c.fixedPaymentEvidence(c.fixedPaymentState(s,s.fixed[0],2026,10,18)));assert.equal(c.linkFixedPayment(s,'other-synthetic',s.fixed[0].id,2026,10,18),s);});
// INC-1810-04 r3 (diagnóstico real, beta 4.26.154.1): la prueba BOOK guardada es de ESTE cargo
// (misma referencia del banco), pero el cargo renombrado se identifica por el texto del banco
// (`obName`) y la prueba por el nombre ya limpio: Plan lo daba por pagado y la ficha decía «No».
const youtubeR3=()=>{const s=paymentFixture(),x=s.expenses[0],ref='20261002213646522190S1',iban='ES0000000000000000008405';
  s.fixed[0]={id:'hs0ymqd4',name:'YouTube Premium ',amount:29.99,day:2,freq:'mes'};
  Object.assign(x,{date:'2026-10-02',amount:29.99,extId:ref,obAcc:iban,merchant:'YouTube Premium',obName:'COMPRA TARJ. 5402XXXXXXXX6013 GOOGLE*YOUTUBE-DUBLIN',category:'recibos'});
  s.bankTx=[];s.accounts[0].bankIban=iban;
  const identity=JSON.stringify(['sabadell','2026-10-02',29.99,'YouTube Premium']);
  s.fixed[0].paymentProofs={24322:c.fixedPaymentBind({kind:'book',key:'sabadell|'+ref,identity,date:'2026-10-02',bank:'sabadell',merchant:'YouTube Premium',amount:29.99,model:c.fixedPaymentModel(s.fixed[0],10)},s.fixed[0],10)};
  return s;};
check('BOOK proof of this same charge names the receipt even when its identity text differs',()=>{const s=youtubeR3(),before=JSON.stringify(s),money=moneyOf(s);
  assert(c.fixedPaymentState(s,s.fixed[0],2026,10,18).proof,'la prueba guardada es válida');assert(read(s).confirmed['fixed_hs0ymqd4']);
  assert.equal(relation(s)&&relation(s).id,'hs0ymqd4');assert.equal(moneyOf(s),money);assert.equal(JSON.stringify(s),before);});
check('BOOK proof of ANOTHER reference still never names this charge',()=>{for(const mutate of [s=>s.expenses[0].extId='20261002213646522190S2',s=>delete s.expenses[0].extId,s=>s.expenses[0].ent='caixabank',s=>s.expenses[0].date='2026-10-03',s=>s.expenses[0].obAcc='ES0000000000000000009999',s=>s.expenses.push({...s.expenses[0],id:'twin'}),s=>s.expenses[0].amount=29.98]){
  const s=youtubeR3();mutate(s);assert.equal(relation(s),null);}});
// INC-1810-04 r4 (diagnóstico real, beta 4.26.157.1): el cargo de tarjeta lleva la fecha de la
// operación (2/10) y la fila BOOK del extracto con su MISMA referencia, la de contabilización
// (5/10). r3 exigía el mismo día y la ficha seguía diciendo «No» con Plan ✓.
const youtubeR4=(bookDate='2026-10-05')=>{const s=youtubeR3(),ref='20261002213646522190S1',iban='ES0000000000000000008405',name='COMPRA TARJ. 5402XXXXXXXX6013 GOOGLE*YOUTUBE-DUBLIN';
  s.bankTx=[{id:ref,ent:'sabadell',date:bookDate,amount:29.99,merchant:name,status:'BOOK',acc:iban}];
  s.fixed[0].paymentProofs={24322:c.fixedPaymentBind({kind:'book',key:'sabadell|'+ref,identity:JSON.stringify(['sabadell',bookDate,29.99,name]),date:bookDate,bank:'sabadell',merchant:name,amount:29.99,model:c.fixedPaymentModel(s.fixed[0],10)},s.fixed[0],10)};
  return s;};
check('BOOK booked days after the card charge with the same reference names the receipt',()=>{for(const mode of ['feed','missing']){const s=youtubeR4();if(mode==='missing')s.bankTx=[];
  const before=JSON.stringify(s),money=moneyOf(s),conf=JSON.stringify(read(s).confirmed);
  assert(c.fixedPaymentState(s,s.fixed[0],2026,10,18).proof,'la prueba guardada es válida');assert(read(s).confirmed['fixed_hs0ymqd4']);
  assert.equal(relation(s)&&relation(s).id,'hs0ymqd4',mode);assert.equal(moneyOf(s),money);assert.equal(JSON.stringify(read(s).confirmed),conf);assert.equal(JSON.stringify(s),before);}});
check('BOOK with a different date only inside the short forward booking window',()=>{for(const [label,mutate,bookDate] of [
  ['other reference',s=>s.expenses[0].extId='20261002213646522190S2'],
  ['no reference',s=>delete s.expenses[0].extId],
  ['other bank',s=>s.expenses[0].ent='caixabank'],
  ['other account',s=>s.expenses[0].obAcc='ES0000000000000000009999'],
  ['other account in the feed row',s=>s.bankTx[0].acc='ES0000000000000000009999'],
  ['other cents',s=>s.expenses[0].amount=29.98],
  ['two candidate rows',s=>s.expenses.push({...s.expenses[0],id:'twin'})],
  ['BOOK 8 days later',()=>{},'2026-10-10'],
  ['BOOK before the charge',s=>s.expenses[0].date='2026-10-06'],
]){const s=youtubeR4(bookDate);mutate(s);
  if(bookDate)assert(c.fixedPaymentState(s,s.fixed[0],2026,10,18).proof,'la prueba sigue siendo válida: lo que falla es el margen');
  assert.equal(relation(s),null,label);}
  // Frontera exacta del margen: 7 días sí.
  const s=youtubeR4('2026-10-09');assert(c.fixedPaymentState(s,s.fixed[0],2026,10,18).proof);assert.equal(relation(s)&&relation(s).id,'hs0ymqd4','7 días');});
check('diagnostics hide reference and text of proofs from other charges',()=>{const s=youtubeR3(),other='99887766554433221100X';
  const n={id:'netflix',name:'Netflix',amount:12.99,day:5,freq:'mes'};s.fixed.push(n);
  n.paymentProofs={24322:c.fixedPaymentBind({kind:'book',key:'sabadell|'+other,identity:JSON.stringify(['sabadell','2026-10-05',12.99,'OTRO COMERCIO NETFLIX.COM']),date:'2026-10-05',bank:'sabadell',merchant:'OTRO COMERCIO NETFLIX.COM',amount:12.99},n,10)};
  assert(c.fixedPaymentProof(s,n,2026,10,18),'la prueba del otro recibo es válida y llega al diagnóstico');
  const text=c.reciboDiagText(s,s.expenses[0]);assert(text.includes('sabadell|20261002213646522190S1'),'la prueba de este cargo sí sale');
  assert(!text.includes(other));assert(!text.includes('NETFLIX.COM'));});
check('withdrawal needs the existing confirmation timestamp',()=>{const e=paymentFixture('debt').expenses[0];assert.equal(c.withdrawalConfirmedUI(e),false);assert.equal(c.withdrawalConfirmedUI({...e,category:'traspaso'}),false);assert(c.withdrawalConfirmedUI({...e,category:'traspaso',withdrawalConfirmedAt:1}));assert.equal(c.withdrawalConfirmedUI({...e,withdrawalConfirmedAt:1}),false);});
check('reads preserve all persisted bytes and exact cent oracles',()=>{for(const kind of ['debt','receipt','linked-debt']){const s=paymentFixture(kind),before=JSON.stringify(s);const money=()=>JSON.stringify({plan:c.planChargesMonth(s,10,2026,18),inicio:c.dashboardBudgetStats(s),widget:c.monthBudgetStats(s,c.Date.now()),balance:c.monthNetForAccount(s,'sabadell',2026,10,18),cloud:c.slimForCloud(s)});const expected=money();for(let i=0;i<3;i++){read(s);relation(s);}assert.equal(money(),expected);assert.equal(JSON.stringify(s),before);assert.equal(Math.round(s.expenses[0].amount*100),kind==='receipt'?2999:19700);assert.equal(Math.round(s.accounts[0].value*100),80000);}});
console.log(checks+' payment UI checks passed');
