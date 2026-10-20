import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {environment,section,plain,owner,uuid,cents,now} from './helpers/fin19-r4-fixture.mjs';

const html=fs.readFileSync(process.env.FIN19_R8_HTML||new URL('../public/index.html',import.meta.url),'utf8');
const callback=section(html,'  const saveEdit=function(orig, extra){','  const todayKey='),evidence=[];
const fixtures=[
 {name:'salary',amount:-1500,merchant:'NOMINA SINTETICA',category:'ingreso',signedCents:-150000,beforeIncome:150000},
 {name:'incoming-transfer',amount:-200,merchant:'TRASPASO SINTETICO',category:'traspaso',signedCents:-20000,beforeIncome:0},
];
function setup(mode,f){
 const remote=[{id:uuid(1),user_id:owner,fecha:'2026-10-19T10:00:00.001Z',importe:f.amount,comercio:f.merchant,
  ob_name:f.merchant,cat:f.category,nota:'Nota sintética',source:'ob:sabadell#refincome-a#accaccount-a#n2'}];
 const env=environment(html,remote),queues=[],toasts=[],edits=[];
 const factory=vm.runInContext('(function(api,mode,editExp){const keyOfE=keyOfExpense,state=api.stateRef.current,set=api.set,cloud=Object.assign({},api.cloud,{enabled:()=>mode!=="offline"}),mcSandbox=()=>mode==="sandbox",mcSandboxTransition=()=>mode==="transition",editCola={current:{pend:[]}},renameSequence={current:0},retryRenames=()=>{throw Error("unexpected rename retry");},separarGemelo=()=>{throw Error("unexpected twin split");},setEditExp=e=>api.edits.push(e),showToast=t=>api.toasts.push(t),subeEdicionesDeGasto=q=>api.queues.push(q.pend);'+callback+'return saveEdit;})',env.c);
 const save=merchant=>{
  const orig=env.stateRef.current.expenses.find(e=>e.id===uuid(1));assert.ok(orig);
  // Same initial form as the actual ficha: negative bank amount always sets income:true.
  const editExp={id:orig.id,merchant:orig.merchant,amount:String(Math.abs(orig.amount)),income:orig.amount<0,date:String(orig.date).slice(0,10)};
  assert.equal(editExp.income,true);
  factory({...env,queues,toasts,edits},mode,editExp)(orig,{merchant});
 };
 const stats=mode=>{
  const bs=env.c.monthBudgetStats(env.stateRef.current,now,null,mode),out={};
  for(const k of ['spent','income','balance','budget','reserved','remaining','against','shown'])out[k+'Cents']=Math.round(bs[k]*100);
  return out;
 };
 const snap=()=>{
  const s=env.stateRef.current,del=env.c.expenseDeletedSet(s),visible=s.expenses.filter(e=>!env.c.expenseIsTombstoned(e,del));
  return {rows:plain(s.expenses),visible:plain(visible),storedCents:cents(s.expenses),visibleCents:cents(visible),
   split:stats('split'),net:stats('net'),deleted:plain(s.deleted),deletedAt:plain(s.deletedAt)};
 };
 return Object.assign(env,{save,snap,queues,toasts,edits});
}
function expectedStats(income,mode){
 return {spentCents:0,incomeCents:income,balanceCents:income,budgetCents:100000,reservedCents:0,
  remainingCents:mode==='net'?100000+income:100000,againstCents:mode==='net'?0-income:0,shownCents:mode==='net'?income:0};
}
after(()=>{if(process.env.FIN19_R8_EVIDENCE)fs.writeFileSync(process.env.FIN19_R8_EVIDENCE,JSON.stringify({
 zone:Intl.DateTimeFormat().resolvedOptions().timeZone,TZ:process.env.TZ??null,
 htmlSHA256:crypto.createHash('sha256').update(html).digest('hex'),callbackSHA256:crypto.createHash('sha256').update(callback).digest('hex'),
 classification:'Existing ficha income:true sets category ingreso and noCard true; incoming transfer is neutral before save and income afterwards.',
 cases:evidence},null,2)+'\n',{flag:'wx'});});
for(const mode of ['offline','sandbox','transition'])for(const f of fixtures)test('FIN19 R8 negative ficha '+f.name+' '+mode,async()=>{
 const env=setup(mode,f),original=plain(env.stateRef.current.expenses[0]),r={mode,fixture:f.name,before:env.snap(),stages:[]};evidence.push(r);
 assert.equal(Object.hasOwn(original,'noCard'),false,'bank fixture starts without noCard');
 assert.equal(original.amount,f.amount);assert.equal(original.category,f.category);
 assert.deepEqual(r.before.rows,[original]);assert.deepEqual(r.before.visible,[original]);
 assert.equal(r.before.storedCents,f.signedCents);assert.equal(r.before.visibleCents,f.signedCents);
 for(const m of ['split','net'])assert.deepEqual(r.before[m],expectedStats(f.beforeIncome,m),'before '+m);
 // Collect every real transition before assertions so RED evidence includes persisted and pulled rows.
 for(const merchant of ['Nombre elegido','Segundo nombre',f.merchant]){
  env.save(merchant);r.stages.push({phase:'save',merchant,...env.snap()});
  env.persist();r.stages.push({phase:'reload',merchant,...env.snap()});
  await env.pull();r.stages.push({phase:'complete-pull',merchant,...env.snap()});
 }
 r.queues=plain(env.queues);r.remote=plain(env.remote);r.writes=plain(env.writes);r.deletes=env.deletes;
 for(const s of r.stages){
  const expected={...original,merchant:s.merchant,category:'ingreso',noCard:true},label=s.phase+' '+s.merchant;
  assert.equal(s.storedCents,f.signedCents,label+' stored signed cents');
  assert.equal(s.visibleCents,f.signedCents,label+' visible signed cents');
  assert.deepEqual(s.rows,[expected],label+' complete stored row');
  assert.deepEqual(s.visible,[expected],label+' complete visible row');
  for(const m of ['split','net'])assert.deepEqual(s[m],expectedStats(-f.signedCents,m),label+' actual '+m+' totals');
 }
 assert.ok(r.stages[0].deleted.includes(env.c.keyOfExpense(original)));
 assert.ok(!r.stages[0].deleted.includes(env.c.expenseDeletionKey(original)));
 assert.equal(env.deletes,0);assert.equal(env.writes.length,0);
});
