import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import {loadPureLogic,loadPureLogicFromFile} from '../scripts/load-pure-logic.mjs';

const c=loadPureLogicFromFile(),plain=x=>JSON.parse(JSON.stringify(x));
const row=(id,extra={})=>({id,date:'2026-10-19T12:00:00.000Z',amount:3.20,merchant:'Compra sintetica FIN19',category:'otros',source:'ob',ent:'caixabank',...extra});
const cents=xs=>xs.reduce((n,e)=>n+Math.round(e.amount*100),0);
const multiset=xs=>plain(xs).sort((a,b)=>a.id.localeCompare(b.id));
const merge=(kind,a,b)=>kind==='mergeExpenses'?c.mergeExpenses(a,b):c.mergeExpensesFromCloud(a,b,0);
function distinct(name,a,b){
 for(const kind of ['mergeExpenses','mergeExpensesFromCloud'])for(const rows of [[a,b],[b,a]])for(const split of [0,1,2]){
  const before=plain(rows),out=merge(kind,rows.slice(0,split),rows.slice(split));
  console.log(JSON.stringify({case:name,kind,split,input:before,expectedCount:2,actualCount:out.list.length,expectedCents:cents(rows),actualCents:cents(out.list),actual:plain(out.list)}));
  assert.equal(out.list.length,2,name+' count');assert.equal(cents(out.list),cents(rows),name+' exact cents');
  assert.deepEqual(multiset(out.list),multiset(rows),name+' complete rows');assert.deepEqual(plain(rows),before,'inputs immutable');
  const again=merge(kind,out.list,[...rows].reverse());assert.deepEqual(plain(again.list),plain(out.list),'repeated merge');assert.equal(again.nuevos,0);
  if(kind==='mergeExpensesFromCloud')assert.equal(again.changed,false,'no spurious refresh');
  const rec=c.reconcileObDupes({expenses:out.list,accounts:[]});assert.deepEqual(multiset(rec.state.expenses),multiset(rows));assert.equal(rec.borrar.length,0);
 }
}
test('FIN19: different banks retain full fields, both arrivals and repeat',()=>distinct('bank',row('a',{note:'nota elegida',noteEdited:true,category:'deudas',debtId:'debt-synthetic',noCard:true,extraLocal:{keep:1}}),row('b',{ent:'sabadell',note:'otra nota',category:'super'})));
test('FIN19: known account boundaries, with and without matching external references',()=>{
 for(const extId of [undefined,'same-ref'])distinct('accounts '+extId,row('a',{obAcc:'account-a',extId}),row('b',{obAcc:'account-b',extId}));
});
test('FIN19: different bank references and pending aliases never cross banks/accounts',()=>{
 for(const boundary of [{ent:'sabadell'},{obAcc:'account-b'}]){
  distinct('refs',row('a',{obAcc:'account-a',extId:'ref-a'}),row('b',{obAcc:'account-a',extId:'ref-b',...boundary}));
  distinct('pending',row('a',{obAcc:'account-a',extId:'old',obPending:true}),row('b',{obAcc:'account-a',extId:'book',obPendingRef:'old',...boundary}));
 }
});
test('FIN19: missing identity is not evidence for a known bank/account',()=>{
 distinct('bank missing',row('a',{ent:undefined}),row('b'));
 distinct('account missing without identity proof',row('a'),row('b',{obAcc:'account-b'}));
 // Both absent retain the established legacy content dedupe; no guessed bank.
 for(const kind of ['mergeExpenses','mergeExpensesFromCloud']){
  const out=merge(kind,[row('a',{ent:undefined})],[row('b',{ent:undefined})]);assert.equal(out.list.length,1);assert.equal(out.list[0].id,'a');assert.equal(cents(out.list),320);
 }
});
test('FIN19: supported bank encodings resolve through production expenseBankOf',()=>{
 for(const source of ['macrodroid','tr','ob:trade_republic#dup','ob-hist:trade_republic~recibo.synthetic#n2']){
  const a=row('a',{source,ent:undefined}),b=row('b',{ent:'trade_republic'});
  assert.equal(c.expenseBankOf(a),'trade_republic');
  for(const kind of ['mergeExpenses','mergeExpensesFromCloud'])for(const rows of [[a,b],[b,a]]){const out=merge(kind,[rows[0]],[rows[1]]);assert.equal(out.list.length,1);assert.equal(out.list[0].id,rows[0].id);assert.equal(cents(out.list),320);}
 }
});
test('FIN19: same bank/account notification and statement remain one in both orders',()=>{
 for(const obAcc of [undefined,'account-a'])for(const kind of ['mergeExpenses','mergeExpensesFromCloud']){
  const a=row('notice',{source:'macrodroid',ent:'trade_republic',obAcc}),b=row('statement',{ent:'trade_republic',obAcc,extId:'bank-ref'});
  for(const rows of [[a,b],[b,a]]){const out=merge(kind,[rows[0]],[rows[1]]);assert.equal(out.list.length,1);assert.equal(out.list[0].id,rows[0].id);assert.equal(cents(out.list),320);assert.deepEqual(plain(merge(kind,out.list,rows).list),plain(out.list));}
 }
});
test('FIN19: same bank/account PDNG and BOOK keep stable UUID and exact cents',()=>{
 const a=row('p',{obAcc:'account-a',extId:'same',obPending:true}),b=row('b',{obAcc:'account-a',extId:'same'});
 for(const rows of [[a,b],[b,a]])for(const kind of ['mergeExpenses','mergeExpensesFromCloud']){
  const out=merge(kind,[rows[0]],[rows[1]]);assert.equal(out.list.length,1);assert.equal(out.list[0].id,rows[0].id);assert.equal(!!out.list[0].obPending,false);assert.equal(cents(out.list),320);assert.deepEqual(plain(merge(kind,out.list,rows).list),plain(out.list));
 }
});
test('FIN19: same-bank distinct refs keep ordinal contract and repeated refs dedupe',()=>{
 const a=row('a',{extId:'ref-a',obAcc:'account-a'}),b=row('b',{extId:'ref-b',obAcc:'account-a'});
 for(const rows of [[a,b],[b,a]])for(const kind of ['mergeExpenses','mergeExpensesFromCloud']){
  const out=merge(kind,[rows[0]],[rows[1]]);assert.equal(cents(out.list),640);assert.equal(out.list.length,2);assert.deepEqual(plain(out.list.map(c.obOrdinalOf)),[1,2]);assert.equal(out.list[1].date,'2026-10-19T12:00:00.001Z');
  const expected=[rows[0],{...rows[1],obOrd:2,date:'2026-10-19T12:00:00.001Z'}];assert.deepEqual(plain(out.list),plain(expected));assert.deepEqual(plain(merge(kind,out.list,rows).list),plain(out.list));
 }
 distinct('different amounts',a,{...b,amount:3.21});
});
test('FIN19: manual IDs and persistent tombstone keys retain existing contract',()=>{
 const a=row('a',{source:'manual'}),b=row('b',{source:'manual'});distinct('manual',a,b);
 const bank=row('bank',{extId:'ref',obAcc:'account-a',obOrd:2});
 assert.equal(c.keyOfExpense(bank),'2026-10-19|3.2|Compra sintetica FIN19|#2');
 const tomb={[c.keyOfExpense(bank)]:1};assert.equal(c.expenseIsTombstoned(bank,tomb),true);
 const absorption={[c.obAbsorptionKey(bank)]:1};assert.equal(c.expenseIsTombstoned(bank,absorption),true);assert.equal(c.expenseIsTombstoned({...bank,obAcc:'account-b'},absorption),false);
});
test('FIN19: account enrichment needs unique UUID/ref; ambiguous account is never guessed',()=>{
 for(const proof of ['uuid','ref'])for(const kind of ['mergeExpenses','mergeExpensesFromCloud']){
  const a=row('a',{extId:proof==='ref'?'same':undefined}),b={...a,id:proof==='uuid'?'a':'b',obAcc:'account-a'};
  for(const rows of [[a,b],[b,a]]){const out=merge(kind,[rows[0]],[rows[1]]);assert.equal(out.list.length,1);assert.equal(cents(out.list),320);assert.equal(out.list[0].id,rows[0].id);assert.deepEqual(plain(merge(kind,out.list,rows).list),plain(out.list));}
  const other={...b,id:proof==='uuid'?'a':'c',obAcc:'account-b'};
  for(const rows of [[a,b,other],[other,b,a]]){const out=merge(kind,[],rows);assert.equal(out.list.length,3);assert.equal(cents(out.list),960);assert.deepEqual(multiset(out.list),multiset(rows));}
 }
});
test('FIN19: notice joins the unique known account, never two candidate accounts',()=>{
 const a=row('notice',{ent:'trade_republic',source:'macrodroid'}),b=row('bank',{ent:'trade_republic',obAcc:'account-a',extId:'ref'});
 for(const kind of ['mergeExpenses','mergeExpensesFromCloud'])for(const rows of [[a,b],[b,a]]){
  const out=merge(kind,[rows[0]],[rows[1]]);assert.equal(out.list.length,1);assert.equal(cents(out.list),320);assert.equal(out.list[0].id,rows[0].id);
  const ambiguous=merge(kind,[],[...rows,{...b,id:'other',obAcc:'account-b'}]);assert.equal(ambiguous.list.length,3);assert.equal(cents(ambiguous.list),960);
 }
});
test('FIN19: category preparation and acknowledgement cannot cross bank/account',()=>{
 for(const boundary of [{ent:'sabadell'},{obAcc:'account-b'}]){
  const a=row('a',{obAcc:'account-a',category:'bares',catStale:['otros']}),b=row('b',{obAcc:'account-a',...boundary});
  const kept=c.keepCategoryChoices([a],[b],100);assert.deepEqual(plain(kept.prev),plain([a]));assert.deepEqual(plain(kept.incoming),plain([b]));assert.equal(kept.recat.length,0);
  const marked={...b,category:'bares',catStale:['otros']},ack=c.ackCategoryWrite([a,marked],a,'bares',100);assert.equal(ack[0].catAckAt,100);assert.deepEqual(plain(ack[1]),plain(marked));
 }
});
test('FIN19: actual pull count and source decoding retain both banks',()=>{
 const main=fs.readFileSync(new URL('../src/modules/11-app-main.js',import.meta.url),'utf8');
 const start=main.indexOf('const identityScope=expenseIdentityScopes('),end=main.indexOf('\n      set(function(prev)',start);assert.ok(start>=0&&end>start);
 const count=new Function('stateRef','incoming','expenseIdentityScopes','expenseMergeKey',main.slice(start,end)+';return count;');
 const rows=['caixabank','sabadell'].map((bank,i)=>c.expenseFromRow({id:'wire-'+i,fecha:'2026-10-19T12:00:00Z',importe:3.20,comercio:'Compra sintetica FIN19',cat:'otros',source:'ob:'+bank+'#refsame#accaccount-a'}));
 assert.equal(count({current:{expenses:[]}},rows,c.expenseIdentityScopes,c.expenseMergeKey),2);
 assert.equal(count({current:{expenses:[rows[0]]}},rows,c.expenseIdentityScopes,c.expenseMergeKey),1);
 distinct('decoded source',rows[0],rows[1]);
});
test('FIN19: removing bank/account scopes is killed through production merges',()=>{
 const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 for(const [name,needle,replacement,a,b] of [
  ['bank','return JSON.stringify([bank,acc]);','return JSON.stringify(["",acc]);',row('a'),row('b',{ent:'sabadell'})],
  ['account','return JSON.stringify([bank,acc]);','return JSON.stringify([bank,""]);',row('a',{obAcc:'a',extId:'same'}),row('b',{obAcc:'b',extId:'same'})]
 ]){
  assert.ok(html.includes(needle));const mutant=loadPureLogic(html.replace(needle,replacement));
  for(const kind of ['mergeExpenses','mergeExpensesFromCloud']){
   const out=mutant[kind]([a],[b]).list;assert.equal(out.length,1,'mutant must restore loss');assert.equal(cents(out),320);assert.throws(()=>assert.equal(cents(out),640),assert.AssertionError);console.log('KILLED '+name+' '+kind);
  }
 }
});
