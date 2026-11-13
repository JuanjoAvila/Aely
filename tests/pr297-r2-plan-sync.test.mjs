import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {loadPureLogicFromFile} from '../scripts/load-pure-logic.mjs';
import {codeMask} from '../scripts/beta-source-code.mjs';
const owner='synthetic-owner',copy=x=>JSON.parse(JSON.stringify(x));
const fixed=()=>[{id:'f',name:'Recibo',amount:42.37,bankAmount:null,account:'sabadell',freq:'mes',day:25}];
const debt=()=>({id:'d',name:'Deuda',value:1200.23,monthly:100.11,account:'sabadell',day:28,debtLinkRevision:1});
function logic(){
 const c=loadPureLogicFromFile();vm.createContext(c);
 for(const file of ['00-core','08-motor-bank']){
  let source=fs.readFileSync(new URL('../src/modules/'+file+'.js',import.meta.url),'utf8');
  if(process.env.PR297_MUTANT==='protect'&&file==='00-core'){
   const anchor=source.includes('if(!linkedIds.has(d.id)')?'if(!linkedIds.has(d.id)':'if(!linked.some(function(e)';assert(source.includes(anchor));source=source.replace(anchor,anchor.replace('if(','if(true||'));
  }
  const mutations=file==='00-core'?{
   initial:['source=localNewer||legacyMark?left:right;','source=right;'],
   confirmed:['const confirmed=obConfirmedJoin(local.obAbsorbedConfirmed,remote.obAbsorbedConfirmed,owner);','const confirmed=(local.obAbsorbedConfirmed||[]).concat(remote.obAbsorbedConfirmed||[]);'],
   marker:[' && (!commitKey || prev[commitKey]===next[commitKey])',''],
   revision:['merged.debtLinkRevision=Math.max.apply(null,values)','merged.debtLinkRevision=values[values.length-1]'],
   proofs:['if(kind==="fixed"&&group[0]==="paymentProofs"&&','if(false&&kind==="fixed"&&group[0]==="paymentProofs"&&'],
   version:['new TextEncoder().encode(planSyncDebtCanonical(row))','new TextEncoder().encode(JSON.stringify({id:row.id,debtLinkRevision:row.debtLinkRevision}))']
  }:{};
  const mutation=mutations[process.env.PR297_MUTANT];if(mutation){assert(source.includes(mutation[0]),'mutant anchor');source=source.replace(...mutation);}
  if(process.env.PR297_MUTANT==='derived'&&file==='08-motor-bank')source=source.replace('if(s.fixed===prev.fixed)return s;','').replaceAll('if(prior.get(e.id)===e)return e;','');
  // El token y el estado comparten los símbolos y dependencias reales del núcleo actual.
  // Aislar el bloque evita redeclararlos cuando el bundle ya los contiene.
  if(file==='00-core'){
   const anchor='const PLAN_EDIT_INTENT=Symbol(',tail='function goalSyncMetadataOnly(',start=source.indexOf(anchor),end=source.indexOf(tail,start);
   assert(start>=0&&end>start&&source.lastIndexOf(anchor)===start&&source.lastIndexOf(tail)===end,'bloque real único de intención y lectura manual');
   Object.assign(c,vm.runInContext('(function(){'+source.slice(start,end)+';return {planSyncEditToken,planSyncEditState};})()',c));
  }
  const mask=codeMask(source);
  for(const match of source.matchAll(/^function (planSync\w+|mergePlanThreeWay|fixedPaymentDerivedDay|goalSyncMetadataOnly)\(/gm)){
   if(file==='00-core'&&['planSyncEditToken','planSyncEditState'].includes(match[1]))continue;
   const start=match.index,open=mask.indexOf('{',start);let end=open+1,n=1;
   for(;n;end++){if(mask[end]==='{')n++;else if(mask[end]==='}')n--;}
   vm.runInContext(source.slice(start,end),c);
  }
 }
 return c;
}
for(const newer of [false,true])test('B1 no base respects localNewer='+newer+' without false conflict',()=>{
 const c=logic(),local={fixed:fixed(),debts:[debt()],_savedAt:newer?30:10},remote=copy(local);remote._savedAt=20;remote.debts[0].day=29;local.debts[0].day=30;
 const m=c.planSyncPull(local,remote,owner,'r1',false,newer);
 assert.equal(m.debts[0].day,newer?30:29);assert.equal(m._planSync.conflicts.length,0);assert.equal(Math.round(m.debts[0].value*100),120023);
});
test('B1 known base keeps disjoint edits independent of initial LWW preference',()=>{
 const c=logic(),base={fixed:fixed(),debts:[debt()]},local=copy(base);Object.assign(local,c.planSyncPull(local,copy(base),owner,'r0',false));local.debts[0]={...local.debts[0],name:'Local'};
 const remote=copy(base);remote.debts[0].day=29;const m=c.planSyncPull(local,remote,owner,'r1',false,false);
 assert.equal(m.debts[0].name,'Local');assert.equal(m.debts[0].day,29);assert.equal(m._planSync.conflicts.length,0);
});
test('B2 packed confirmed absorption is a tombstone; survivor veto and owner remain exact',()=>{
 const c=logic(),row=debt(),expense={id:'11111111-1111-4111-8111-111111111111',source:'ob',date:'2026-10-24',amount:100.11,merchant:'Cuota',ent:'sabadell',extId:'gone',debtId:'d'};
 const keep={...expense,id:'22222222-2222-4222-8222-222222222222',extId:'keep'};
 const ack={owner,id:expense.id,key:c.obAbsorptionKey(expense),keepId:keep.id,keepKey:c.obAbsorptionKey(keep),ackAt:Date.now()};assert(c.obConfirmedValid(ack,owner));
 const remote={fixed:[],debts:[row],expenses:[expense],obAbsorbedConfirmed:c.obConfirmedPack([ack],owner)};
 const local={fixed:[],debts:[],debtDeleted:[row],_historyOwner:owner};
 assert.equal(c.planSyncPull(local,remote,owner,'r1',false).debts.length,0,'absorbed expense cannot protect deleted debt');
 remote.expenses.push(keep);assert.equal(c.planSyncPull(local,remote,owner,'r2',false).debts.length,1,'canonical live survivor protects debt');
 remote.obAbsorbedConfirmed=c.obConfirmedPack([ack],'foreign');assert.equal(c.planSyncPull(local,remote,owner,'r3',false),null,'foreign packet cannot be silently accepted');
 remote.obAbsorbedConfirmed={v:1,o:owner,d:[],r:{bad:[[99,0,0,0,1]]}};assert.equal(c.planSyncPull(local,remote,owner,'r4',false),null);
});
test('B2 local compact empty confirmation is normalized without .concat failure',()=>{
 const c=logic(),local={fixed:fixed(),debts:[debt()],_historyOwner:owner,obAbsorbedConfirmed:c.obConfirmedPack([],owner)},remote={fixed:fixed(),debts:[debt()]};
 assert(c.planSyncPull(local,remote,owner,'r1',false));
});
test('M1 same debt revision deleted before linked expense arrives is protected and converges',()=>{
 const c=logic(),row=debt(),expense={id:'payment',date:'2026-10-24',amount:100.11,debtId:'d'};
 const a={fixed:[],debts:[],debtDeleted:[copy(row)],expenses:[],_historyOwner:owner};
 const b={fixed:[],debts:[copy(row)],expenses:[expense],_historyOwner:owner};
 Object.assign(b,c.planSyncPull(b,copy(b),owner,'r0',false));
 const wireA=c.slimForCloud(a);assert(!Object.hasOwn(wireA,'expenses'));
 const m=c.planSyncPull(b,wireA,owner,'r1',false);assert.equal(m.debts.length,1);assert.equal(m.debts[0].debtLinkRevision,2);
 assert.equal(Math.round(m.debts[0].value*100),120023);assert.equal(Math.round(m.debts[0].monthly*100),10011);assert.equal(Math.round(expense.amount*100),10011);
 const sent=c.slimForCloud({...b,...m});assert(!Object.hasOwn(sent,'expenses'));
 const back=c.planSyncPull(a,sent,owner,'r2',false);assert.equal(back.debts.length,1);assert.equal(back.debts[0].debtLinkRevision,2);
 const applied={...a,...back},acked=c.planSyncAck(applied,owner,c.slimForCloud(applied),'r2','r3'),reloaded=copy(acked);
 const beforeExpenses=c.planSyncPull(reloaded,sent,owner,'r4',false);assert.equal(beforeExpenses.debts[0].debtLinkRevision,2);
 const arrived={...reloaded,...beforeExpenses,expenses:[expense]},again=c.planSyncPull(arrived,sent,owner,'r5',false);assert.equal(again.debts.length,1);assert.equal(again.debts[0].debtLinkRevision,2);assert.equal(arrived.expenses[0].debtId,again.debts[0].id);
});
for(const inverse of [false,true])test('M2 proof and debt revision are independent metadata, inverse='+inverse,()=>{
 const c=logic(),base=fixed(),l=copy(base),r=copy(base);l[0].amount=45.67;r[0].paymentProofs={synthetic:{amount:42.37}};
 const m=c.mergePlanThreeWay(base,inverse?r:l,inverse?l:r,'fixed');assert.equal(Math.round(m.rows[0].amount*100),4567);assert.equal(m.conflicts.length,0);
 const db=[debt()],dl=copy(db),dr=copy(db);dl[0].value=1199.22;dr[0].debtLinkRevision=2;
 const dm=c.mergePlanThreeWay(db,inverse?dr:dl,inverse?dl:dr,'debts');assert.equal(Math.round(dm.rows[0].value*100),119922);assert.equal(dm.rows[0].debtLinkRevision,2);assert.equal(dm.conflicts.length,0);
});
test('derived only visits changed receipts and preserves unchanged arrays and rows',()=>{
 const c=logic(),rows=fixed(),prev={fixed:rows,debts:[debt()],expenses:[]};let visits=0;const original=c.fixedPaymentState;c.fixedPaymentState=(...args)=>{visits++;return original(...args);};
 const next=c.planSyncDerived({...prev,other:1},prev);assert.equal(visits,0);assert.equal(next.fixed,prev.fixed);assert.equal(next.fixed[0],prev.fixed[0]);assert.equal(next.debts,prev.debts);
});
test('M2 valid old payment proof cannot bind a changed amount after merge and ACK',()=>{
 const c=logic(),now=new Date(),y=now.getFullYear(),m=now.getMonth()+1,base=fixed(),l=copy(base),r=copy(base),key=y*12+m;
 const proof={kind:'expense',identity:'synthetic-payment',key:'synthetic-key',expenseKey:'synthetic-expense',amount:42.37,bank:'sabadell',date:y+'-'+String(m).padStart(2,'0')+'-01',model:c.fixedPaymentModel(base[0],m)};
 r[0].paymentProofs={[key]:proof};assert.equal(c.fixedPaymentProof({fixed:r},r[0],y,m,now.getDate()),proof,'fixture proof must validate before amount edit');
 l[0].amount=45.67;const merged=c.mergePlanThreeWay(base,l,r,'fixed');assert.equal(Math.round(merged.rows[0].amount*100),4567);assert.equal(merged.conflicts.length,0);
 assert.deepEqual(copy(merged.rows[0].paymentProofs),copy(r[0].paymentProofs));
 const inverse=c.mergePlanThreeWay(base,r,l,'fixed');assert.equal(Math.round(inverse.rows[0].amount*100),4567);assert.equal(inverse.conflicts.length,0);assert.deepEqual(copy(inverse.rows[0].paymentProofs),copy(r[0].paymentProofs));
 assert.equal(c.fixedPaymentProof({fixed:merged.rows},merged.rows[0],y,m,now.getDate()),null,'old proof does not pay the new amount');
 const state={fixed:merged.rows,debts:[],_planSync:{owner,revision:'r1',base:{fixed:r,debts:[]},conflicts:[]}},sent=c.slimForCloud(state),acked=c.planSyncAck(state,owner,sent,'r1','r2');
 assert.equal(acked._planSync.revision,'r2');assert.equal(Math.round(acked._planSync.base.fixed[0].amount*100),4567);assert.equal(c.fixedPaymentProof(copy(acked),copy(acked.fixed[0]),y,m,now.getDate()),null);
 assert.deepEqual(copy(acked.fixed[0].paymentProofs),copy(r[0].paymentProofs));
});
test('M2 debt principal and bank revision merge without financial conflict',()=>{
 const c=logic(),base=[{...debt(),debtLinkRevision:0}],l=copy(base),r=copy(base);l[0].value=1199.22;r[0].debtLinkRevision=1;
 for(const [left,right] of [[l,r],[r,l]]){const merged=c.mergePlanThreeWay(base,left,right,'debts');assert.equal(Math.round(merged.rows[0].value*100),119922);assert.equal(merged.rows[0].debtLinkRevision,1);assert.equal(merged.conflicts.length,0);}
});
test('B3 private commit marker alone is metadata, but a real edit still queues upload',()=>{
 const c=logic(),key=Symbol('cloud-merge'),prev={fixed:fixed(),debts:[debt()],_savedAt:1},next={...prev,[key]:{planInvalid:true}};
 assert.equal(c.goalSyncMetadataOnly(prev,next,key),true);assert.equal(c.goalSyncMetadataOnly(prev,{...next,fixed:fixed()},key),false);
});
test('M2 concurrent bank revisions are monotonic and do not create a user conflict',()=>{
 const c=logic(),base=[{...debt(),debtLinkRevision:0}],l=copy(base),r=copy(base);l[0].debtLinkRevision=1;r[0].debtLinkRevision=2;
 for(const [left,right] of [[l,r],[r,l]]){const merged=c.mergePlanThreeWay(base,left,right,'debts');assert.equal(merged.rows[0].debtLinkRevision,2);assert.equal(merged.conflicts.length,0);}
});
test('M2 disjoint payment proof months survive without a false user conflict',()=>{
 const c=logic(),base=fixed(),l=copy(base),r=copy(base),proof=m=>({kind:'expense',identity:'synthetic-'+m,key:'key-'+m,expenseKey:'expense-'+m,amount:42.37,bank:'sabadell',date:'2026-'+m+'-01',model:c.fixedPaymentModel(base[0],Number(m))});
 l[0].paymentProofs={[2026*12+9]:proof('09')};r[0].paymentProofs={[2026*12+10]:proof('10')};
 for(const [left,right] of [[l,r],[r,l]]){const merged=c.mergePlanThreeWay(base,left,right,'fixed');assert.deepEqual(copy(merged.rows[0].paymentProofs),{...l[0].paymentProofs,...r[0].paymentProofs});assert.equal(merged.conflicts.length,0);assert.equal(Math.round(merged.rows[0].amount*100),4237);}
});
test('compact tombstones preserve 1000 exact versions, deduplicate and do linear work',()=>{
 const c=logic(),rows=Array.from({length:1000},(_,i)=>({...debt(),id:'gone-'+i,unknown:{unicode:'Deuda ñ 🪙',keep:null,n:i}}));
 let calls=0;const equal=c.goalSyncEqual;c.goalSyncEqual=(...args)=>{calls++;return equal(...args);};
 const started=performance.now(),deleted=c.planSyncDebtDeleted(rows,copy(rows)),elapsed=performance.now()-started;
 assert.equal(deleted.length,1000);assert.deepEqual(Object.keys(deleted[0]).sort(),['id','version']);assert.match(deleted[0].version,/^sha256:[a-f0-9]{64}$/);assert(calls<20000,'dedupe must not compare every snapshot pair');
 const live={...debt(),id:'live'},prev={fixed:fixed(),debts:[live],debtDeleted:deleted,_historyOwner:owner};
 const pulled=c.planSyncPull(prev,copy(prev),owner,'r1',false);assert.equal(pulled.debts.length,1);assert.equal(Math.round(pulled.debts[0].value*100),120023);assert.equal(Math.round(pulled.debts[0].monthly*100),10011);
 const again=c.planSyncDebtDeleted(deleted,copy(deleted));assert.equal(again,deleted);assert.equal(JSON.stringify(deleted).length<JSON.stringify(rows).length,true);
 console.log(JSON.stringify({compact1000:{elapsedMs:elapsed,equalityCalls:calls,bytes:JSON.stringify(deleted).length,legacyBytes:JSON.stringify(rows).length}}));
});
test('compact version uses full canonical SHA256, preserves legacy snapshots and edited/restored rows',()=>{
 const c=logic(),row={...debt(),unknown:{z:[null,'ñ 🪙'],a:0},owner};
 const canonical=v=>v&&typeof v==='object'?(Array.isArray(v)?v.map(canonical):Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]))):v;
 const expected='sha256:'+createHash('sha256').update(JSON.stringify(canonical(row))).digest('hex');assert.equal(c.planSyncDebtVersion(row),expected);
 const compact=c.planSyncDebtDeleted([row],[]);assert.equal(compact[0].version,expected);assert.equal(c.planSyncDebtDeleted([row],compact).length,1);
 assert.equal(c.mergePlanThreeWay([row],[],[copy(row)],'debts',compact).rows.length,0);
 for(const patch of [{name:'Edited'},{value:1200.24},{monthly:100.12},{day:29},{restoredAt:'2026-10-25T01:00:00Z'},{debtLinkRevision:2},{owner:'other'},{unknown:{z:['ñ 🪙',null],a:0}}]){
  const edited={...row,...patch};assert.notEqual(c.planSyncDebtVersion(edited),expected);assert.equal(c.mergePlanThreeWay([row],[],[edited],'debts',compact).rows.length,1);
 }
 const reordered=Object.fromEntries(Object.entries(row).reverse());assert.equal(c.planSyncDebtVersion(reordered),expected);
 assert.notEqual(c.planSyncDebtVersion({...row,optional:null}),expected);
 const state={fixed:[],debts:[],debtDeleted:[row],_historyOwner:owner},pulled=c.planSyncPull(state,{fixed:[],debts:[copy(row)],debtDeleted:compact},owner,'r1',false),acked=c.planSyncAck({...state,...pulled},owner,c.slimForCloud({...state,...pulled}),'r1','r2'),loaded=copy(acked);
 assert.equal(c.planSyncPull(loaded,{fixed:[],debts:[copy(row)]},owner,'r3',false).debts.length,0);assert.equal(loaded.debtDeleted.length,1);
});
test('B3 two edits in the same millisecond have distinct private intentions',()=>{
 const c=logic(),first=c.planSyncEditState({fixed:fixed(),debts:[debt()]},1),second=c.planSyncEditState({...first,debts:[{...first.debts[0],day:30}]},1);
 assert.equal(first._savedAt,second._savedAt);assert.notEqual(c.planSyncEditToken(first),c.planSyncEditToken(second));assert.equal(c.planSyncEditToken(JSON.parse(JSON.stringify(second))),undefined);
 assert.equal(c.planSyncEditToken({...second,_savedAt:1}),c.planSyncEditToken(second));
});
test('M2 malformed bank revisions abort and missing or zero remain valid after reload',()=>{
 const c=logic(),base=[{...debt(),debtLinkRevision:0}];
 for(const bad of [-1,1.5,'2',null,NaN,Infinity]){const remote=[{...base[0],debtLinkRevision:bad}];assert.equal(c.mergePlanThreeWay(base,base,remote,'debts').invalid,true);assert.equal(c.mergePlanThreeWay([],[],remote,'debts').invalid,true);}
 const noRevision=debt();delete noRevision.debtLinkRevision;const merged=c.mergePlanThreeWay([noRevision],[noRevision],base,'debts');assert.equal(merged.rows[0].debtLinkRevision,0);assert.equal(merged.conflicts.length,0);
 const prev={fixed:[],debts:merged.rows,_planSync:{owner,revision:'r1',base:{fixed:[],debts:base},conflicts:[]}},acked=copy(c.planSyncAck(prev,owner,c.slimForCloud(prev),'r1','r2'));assert.equal(acked.debts[0].debtLinkRevision,0);
});
test('M2 incompatible valid proofs in the same month preserve the real conflict',()=>{
 const c=logic(),base=fixed(),l=copy(base),r=copy(base),d=new Date(),y=d.getFullYear(),m=d.getMonth()+1,key=y*12+m;
 const proof=id=>({kind:'expense',identity:'synthetic-'+id,key:'key-'+id,expenseKey:'expense-'+id,amount:42.37,bank:'sabadell',date:y+'-'+String(m).padStart(2,'0')+'-01',model:c.fixedPaymentModel(base[0],m)});
 l[0].paymentProofs={[key]:proof('a')};r[0].paymentProofs={[key]:proof('b')};assert(c.fixedPaymentProof({fixed:l},l[0],y,m,d.getDate()));assert(c.fixedPaymentProof({fixed:r},r[0],y,m,d.getDate()));
 const merged=c.mergePlanThreeWay(base,l,r,'fixed');assert.deepEqual(copy(merged.rows[0].paymentProofs),copy(r[0].paymentProofs));assert.deepEqual(copy(merged.conflicts[0].fields),['paymentProofs']);assert.deepEqual(copy(merged.conflicts[0].local.paymentProofs),copy(l[0].paymentProofs));assert.equal(Math.round(merged.rows[0].amount*100),4237);
});
test('M2 preserves an explicit empty proof map when the other side has none',()=>{
 const c=logic(),base=fixed(),remote=copy(base);remote[0].paymentProofs={};for(const [left,right]of[[base,remote],[remote,base]]){const rows=c.mergePlanThreeWay(base,left,right,'fixed').rows,result=rows[0];assert.notEqual(result.paymentProofs,undefined);assert.deepEqual(copy(result.paymentProofs),{});const state={fixed:rows,debts:[],_planSync:{owner,revision:'r1',base:{fixed:base,debts:[]},conflicts:[]}},acked=copy(c.planSyncAck(state,owner,c.slimForCloud(state),'r1','r2'));assert(Object.hasOwn(acked.fixed[0],'paymentProofs'));assert.deepEqual(acked.fixed[0].paymentProofs,{});}
});
test('compact SHA256 agrees with independent padding oracles and keeps typed ids distinct',()=>{
 const c=logic();for(let n=0;n<130;n++){const row={id:'padding',text:'x'.repeat(n)},body=JSON.stringify(row);assert.equal(c.planSyncDebtVersion(row),'sha256:'+createHash('sha256').update(body).digest('hex'));}
 const deleted=c.planSyncDebtDeleted([{id:1,value:1},{id:'1',value:1}],[]);assert.equal(deleted.length,2);assert.notEqual(deleted[0].version,deleted[1].version);
});
test('compact full version distinguishes own special JSON keys and nested array order',()=>{
 const c=logic(),a=JSON.parse('{"id":"special","value":1200.23,"__proto__":{"keep":1}}'),b=JSON.parse('{"id":"special","value":1200.23,"__proto__":{"keep":2}}');
 assert.notEqual(c.planSyncDebtVersion(a),c.planSyncDebtVersion(b));assert.notEqual(c.planSyncDebtVersion(a),c.planSyncDebtVersion({id:'special',value:1200.23}));
 const nested=JSON.parse('{"id":"special","unknown":{"__proto__":[1,2],"constructor":null,"toString":"keep"}}'),changed=copy(nested);changed.unknown.__proto__=[2,1];assert.notEqual(c.planSyncDebtVersion(nested),c.planSyncDebtVersion(changed));
 const deleted=c.planSyncDebtDeleted([a],[]);assert.equal(c.mergePlanThreeWay([a],[],[b],'debts',deleted).rows.length,1);
});
test('M2 real pull rejects malformed revision before linked-expense protection can coerce it',()=>{
 const c=logic();for(const bad of ['2',null,-1]){const row={...debt(),debtLinkRevision:bad},prev={fixed:[],debts:[row],expenses:[{id:'linked',debtId:'d',amount:100.11}],_historyOwner:owner},remote={fixed:[],debts:[],debtDeleted:[copy(row)]};assert.equal(c.planSyncPull(prev,remote,owner,'r1',false),null);}
});
test('derived keeps unchanged receipt references while visiting just the changed receipt',()=>{
 const c=logic(),a=fixed()[0],b={...a,id:'other'},prev={fixed:[a,b],debts:[debt()],expenses:[]};let visits=0;const original=c.fixedPaymentState;c.fixedPaymentState=(...args)=>{visits++;return original(...args);};const next=c.planSyncDerived({...prev,fixed:[a,{...b,day:29}]},prev);assert.equal(visits,1);assert.equal(next.fixed[0],a);assert.equal(next.debts,prev.debts);
});
