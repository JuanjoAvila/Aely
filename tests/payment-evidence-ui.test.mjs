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
check('withdrawal needs the existing confirmation timestamp',()=>{const e=paymentFixture('debt').expenses[0];assert.equal(c.withdrawalConfirmedUI(e),false);assert.equal(c.withdrawalConfirmedUI({...e,category:'traspaso'}),false);assert(c.withdrawalConfirmedUI({...e,category:'traspaso',withdrawalConfirmedAt:1}));assert.equal(c.withdrawalConfirmedUI({...e,withdrawalConfirmedAt:1}),false);});
check('reads preserve all persisted bytes and exact cent oracles',()=>{for(const kind of ['debt','receipt','linked-debt']){const s=paymentFixture(kind),before=JSON.stringify(s);const money=()=>JSON.stringify({plan:c.planChargesMonth(s,10,2026,18),inicio:c.dashboardBudgetStats(s),widget:c.monthBudgetStats(s,c.Date.now()),balance:c.monthNetForAccount(s,'sabadell',2026,10,18),cloud:c.slimForCloud(s)});const expected=money();for(let i=0;i<3;i++){read(s);relation(s);}assert.equal(money(),expected);assert.equal(JSON.stringify(s),before);assert.equal(Math.round(s.expenses[0].amount*100),kind==='receipt'?2999:19700);assert.equal(Math.round(s.accounts[0].value*100),80000);}});
console.log(checks+' payment UI checks passed');
