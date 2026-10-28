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
 const remote=[{id:uuid(1),user_id:owner,fecha:f.date||'2026-10-19T10:00:00.001Z',importe:f.amount,comercio:f.merchant,
  ob_name:f.merchant,cat:f.category,nota:'Nota sintética',source:'ob:sabadell#refincome-a#accaccount-a#n2'}];
 const env=environment(html,remote),queues=[],toasts=[],edits=[];
 const factory=vm.runInContext('(function(api,mode,editExp){const keyOfE=keyOfExpense,state=api.stateRef.current,set=api.set,cloud=Object.assign({},api.cloud,{enabled:()=>mode!=="offline"}),mcSandbox=()=>mode==="sandbox",mcSandboxTransition=()=>mode==="transition",editCola={current:{pend:[]}},renameSequence={current:0},retryRenames=()=>{throw Error("unexpected rename retry");},separarGemelo=()=>{throw Error("unexpected twin split");},setEditExp=e=>api.edits.push(e),showToast=t=>api.toasts.push(t),subeEdicionesDeGasto=q=>api.queues.push(q.pend);'+callback+'return saveEdit;})',env.c);
 const save=(merchant,extra)=>{
  const orig=env.stateRef.current.expenses.find(e=>e.id===uuid(1));assert.ok(orig);
  // Same initial form as the actual ficha: negative bank amount always sets income:true.
  const editExp={id:orig.id,merchant:orig.merchant,amount:String(Math.abs(orig.amount)),income:orig.amount<0,date:String(orig.date).slice(0,10)};
  assert.equal(editExp.income,true);
  factory({...env,queues,toasts,edits},mode,editExp)(orig,{merchant,...extra});
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
  const expected={...original,merchant:s.merchant,category:'ingreso',noCard:true,
   expenseEditPending:f.category==='ingreso'?{noCard:true}:{category:'ingreso',noCard:true}},label=s.phase+' '+s.merchant;
  assert.equal(s.storedCents,f.signedCents,label+' stored signed cents');
  assert.equal(s.visibleCents,f.signedCents,label+' visible signed cents');
  assert.deepEqual(s.rows,[expected],label+' complete stored row');
  assert.deepEqual(s.visible,[expected],label+' complete visible row');
  for(const m of ['split','net'])assert.deepEqual(s[m],expectedStats(-f.signedCents,m),label+' actual '+m+' totals');
 }
 // FIN29/30 sustituyó la lápida global por el alias de esta cuenta/referencia/ordinal.
 const alias=env.c.expenseRenameKey(original);assert.ok(alias);
 assert.deepEqual(r.stages[0].deleted,[alias]);
 assert.deepEqual(r.stages[0].deletedAt,{[alias]:now});
 assert.ok(!r.stages[0].deleted.includes(env.c.keyOfExpense(original)));
 assert.ok(!r.stages[0].deleted.includes(env.c.expenseDeletionKey(original)));
 assert.equal(env.deletes,0);assert.equal(env.writes.length,0);
});

function exactIncome(env,f,row,label){
 const s=env.snap();
 assert.deepEqual(s.rows,[row],label+' full stored row');
 assert.deepEqual(s.visible,[row],label+' full visible row');
 assert.equal(s.storedCents,f.signedCents,label+' signed stored cents');
 assert.equal(s.visibleCents,f.signedCents,label+' signed visible cents');
 for(const mode of ['split','net'])assert.deepEqual(s[mode],expectedStats(-f.signedCents,mode),label+' '+mode);
 return {phase:label,...s};
}
async function writeRealQueue(env){
 const jobs=env.queues.at(-1);assert.equal(jobs.length,1,'real save created exactly one fallback job');
 const queue={pend:jobs.slice(),fin:Promise.resolve()};
 await env.c.subeEdicionesDeGasto(queue);
 assert.equal(queue.pend.length,0,'real writer completed the fallback job');
}
for(const f of fixtures)test('FIN19 R8 real writer confirms '+f.name+' then remote authority',async()=>{
 const env=setup('sandbox',f),original=plain(env.stateRef.current.expenses[0]);
 const pending=f.category==='ingreso'?{noCard:true}:{category:'ingreso',noCard:true};
 const chosen={...original,merchant:'Nombre elegido',category:'ingreso',noCard:true,expenseEditPending:pending};
 const r={fixture:f.name,kind:'real-writer-confirmation',stages:[]};evidence.push(r);
 env.save('Nombre elegido');r.stages.push(exactIncome(env,f,chosen,'save creates pending'));
 env.persist();r.stages.push(exactIncome(env,f,chosen,'pending survives reload'));
 await writeRealQueue(env);
 // addExpense may return false without select even after a real insertion: the promise is no ACK.
 assert.equal(env.deletes,1);assert.equal(env.inserts.length,1);assert.equal(env.uploadResults.at(-1),false);
 const wire={user_id:owner,fecha:original.date,importe:f.amount,comercio:'Nombre elegido',cat:'ingreso',
  source:'ob:sabadell#refincome-a#accaccount-a#n2',no_card:true,id:uuid(1),nota:'Nota sintética',
  nota_edit:false,importe_orig:null,divisa:null,ob_name:f.merchant};
 assert.deepEqual(plain(env.remote),[wire],'exact row inserted by the unmodified writer');
 r.stages.push(exactIncome(env,f,chosen,'fulfilled writer alone keeps pending'));
 await env.pull();
 const confirmed={...original,merchant:'Nombre elegido',category:'ingreso',noCard:true};
 r.stages.push(exactIncome(env,f,confirmed,'same UUID writer row confirms fields'));
 env.persist();r.stages.push(exactIncome(env,f,confirmed,'confirmation survives reload'));
 // A later legitimate remote choice must take over once the local intent is confirmed.
 env.remote[0].cat='traspaso';env.remote[0].no_card=false;
 await env.pull();
 const remoteChoice={...original,merchant:'Nombre elegido',category:'traspaso'};
 const after=env.snap();r.stages.push({phase:'later remote choice',...after});
 assert.deepEqual(after.rows,[remoteChoice]);assert.deepEqual(after.visible,[remoteChoice]);
 assert.equal(after.storedCents,f.signedCents);assert.equal(after.visibleCents,f.signedCents);
 for(const mode of ['split','net'])assert.deepEqual(after[mode],expectedStats(0,mode));
 r.remote=plain(env.remote);r.upserts=plain(env.upserts);r.inserts=plain(env.inserts);
});
test('FIN19 R8 partial confirmation keeps unconfirmed fields and existing guards',async()=>{
 const f=fixtures[1],env=setup('sandbox',f),original=plain(env.stateRef.current.expenses[0]);
 env.save('Nombre elegido');await writeRealQueue(env);
 // The actual writer row reaches the read after a remote no-card change: category alone agrees.
 env.remote[0].no_card=false;await env.pull();
 const partial={...original,merchant:'Nombre elegido',category:'ingreso',noCard:true,expenseEditPending:{noCard:true}};
 const r={kind:'partial-confirmation',stages:[exactIncome(env,f,partial,'category confirmed only')]};evidence.push(r);
 // A preexisting duplicate-recovery marker is a separate mechanism and must survive this ACK.
 env.stateRef.current.expenses[0].uuidPreserved={debtId:'synthetic-debt'};
 env.remote[0].no_card=true;await env.pull();
 r.stages.push(exactIncome(env,f,{...original,merchant:'Nombre elegido',category:'ingreso',noCard:true,
  uuidPreserved:{debtId:'synthetic-debt'}},'remaining edit field confirmed, old guard retained'));
});
test('FIN19 R8 matching other UUID is not confirmation of the pending writer',async()=>{
 const f=fixtures[1],env=setup('sandbox',f),original=plain(env.stateRef.current.expenses[0]);
 env.save('Nombre elegido');await writeRealQueue(env);
 env.remote[0].id=uuid(2);await env.pull();
 const expected={...original,merchant:'Nombre elegido',category:'ingreso',noCard:true,
  expenseEditPending:{category:'ingreso',noCard:true}};
 const r={kind:'other-uuid-not-receipt',stages:[exactIncome(env,f,expected,'semantic fallback does not confirm')]};evidence.push(r);
 env.remote[0].cat='traspaso';env.remote[0].no_card=false;await env.pull();
 r.stages.push(exactIncome(env,f,expected,'other UUID still cannot undo pending'));
});
test('FIN19 R8 name ACK, rejected write and collision DO NOTHING do not confirm metadata',async()=>{
 const f=fixtures[1],env=setup('sandbox',f),original=plain(env.stateRef.current.expenses[0]);
 env.save('Nombre elegido');
 const pending={category:'ingreso',noCard:true};
 const chosen={...original,merchant:'Nombre elegido',category:'ingreso',noCard:true,expenseEditPending:pending};
 const r={kind:'no-false-ack',stages:[]};evidence.push(r);
 await assert.rejects(env.cloud.addExpense(env.stateRef.current.expenses[0]),'primary key conflict rejects changed tuple');
 r.stages.push(exactIncome(env,f,chosen,'rejected upload retains pending'));
 const ack=await env.cloud.renameExpense(original,'Nombre elegido');assert.ok(ack);
 await env.pull();r.stages.push(exactIncome(env,f,chosen,'name-only PATCH ACK does not confirm fields'));
 const absent={...original,id:uuid(99),date:'2026-10-18T10:00:00.001Z'};
 await assert.rejects(env.cloud.renameExpense(absent,'Absent row'),/rename identity changed/,'zero affected rows has no ACK');
 r.stages.push(exactIncome(env,f,chosen,'zero rows retains pending'));
 // Same tuple now exists from the name-only PATCH, still with the original remote metadata.
 assert.equal(await env.cloud.addExpense(env.stateRef.current.expenses[0]),false);
 assert.equal(env.inserts.length,0);assert.equal(env.remote[0].cat,'traspaso');assert.notEqual(env.remote[0].no_card,true);
 await env.pull();r.stages.push(exactIncome(env,f,chosen,'DO NOTHING and old pull retain pending'));
});
test('FIN19 R8 an older writer echo cannot clear a later real metadata decision',async()=>{
 const f=fixtures[1],env=setup('sandbox',f),original=plain(env.stateRef.current.expenses[0]);
 env.save('Nombre elegido');await writeRealQueue(env);
 // The first write has committed but its pull has not arrived; the user makes a new real choice.
 env.save('Compra elegida',{income:false});
 const chosen={...original,merchant:'Compra elegida',category:'otros',noCard:true,
  expenseEditPending:{category:'otros',noCard:true}};
 const r={kind:'new-intent-old-echo',stages:[exactIncome(env,f,chosen,'later save replaces only its pending value')]};evidence.push(r);
 // A name-only PATCH makes the old writer row visible under the current name, without new metadata.
 await env.cloud.renameExpense(env.c.expenseFromRow(env.remote[0]),'Compra elegida');
 await env.pull();
 r.stages.push(exactIncome(env,f,{...original,merchant:'Compra elegida',category:'otros',noCard:true,
  expenseEditPending:{category:'otros'}},'old category echo cannot clear newer intent'));
});
test('FIN19 R8 composition setCat rename pull cannot acknowledge a synthetic category',async()=>{
 for(const outcome of ['zero','reject','ack-after-read']){
  const f=fixtures[1],env=setup('sandbox',f),original=plain(env.stateRef.current.expenses[0]);
  assert.equal(Object.hasOwn(original,'catStale'),false);assert.equal(Object.hasOwn(original,'expenseEditPending'),false);
  const jobs=[],categoryWrites=[];
  env.c.setTimeout=(fn,ms)=>{jobs.push({fn,ms});return jobs.length;};env.c.clearTimeout=()=>{};
  env.cloud.setExpenseCat=async(e,cat)=>{categoryWrites.push({id:e.id,cat,outcome});if(outcome==='reject')throw Error('synthetic category rejection');return 0;};
  const setCatSource=section(html,'  const setCat=function(ex,newCat){','  const setCuota=');
  const choose=vm.runInContext('(function(api){const set=api.set,cloud=api.cloud,showToast=null,withdrawalPending={current:{}};'+setCatSource+'return setCat;})',env.c)(env);
  choose(env.stateRef.current.expenses[0],'bares');await Promise.resolve();
  assert.deepEqual(plain(env.stateRef.current.expenses),[{...original,category:'bares',catStale:['traspaso']}],'setCat real crea catStale sin presembrarlo');
  env.save('Nombre elegido');env.save(f.merchant);
  const chosen={...original,category:'ingreso',noCard:true,catStale:['traspaso'],
   expenseEditPending:{category:'ingreso',noCard:true}};
  const r={kind:'category-composition',outcome,stages:[exactIncome(env,f,chosen,'real category choice then real ficha rename')]};evidence.push(r);
  env.persist();r.stages.push(exactIncome(env,f,chosen,'real guards survive reload'));
  if(outcome==='ack-after-read'){
   // El ACK válido llega después de iniciarse la lectura antigua: keepCategoryChoices la sintetiza.
   env.set(s=>({...s,expenses:env.c.ackCategoryWrite(s.expenses,s.expenses[0],'ingreso',now+1)}));
  }
  await env.pull();
  for(const job of jobs.filter(j=>j.ms===0))job.fn();await env.flush();
  const expected=outcome==='ack-after-read'?{...chosen,catAckAt:now+1}:chosen;
  r.stages.push({phase:'old raw category after keepCategoryChoices',...env.snap()});
  assert.equal(env.remote[0].cat,'traspaso','el transporte sigue devolviendo la categoría antigua');
  exactIncome(env,f,expected,'synthetic incoming category is not a writer receipt');
  r.categoryWrites=plain(categoryWrites);
  // El writer real y una lectura posterior sí deben liberar ambas guardas.
  await writeRealQueue(env);env.c.Date.now=()=>now+2;await env.pull();
  const confirmed={...original,category:'ingreso',noCard:true};
  r.stages.push(exactIncome(env,f,confirmed,'actual writer echo releases category and noCard'));
  env.remote[0].cat='traspaso';env.remote[0].no_card=false;await env.pull();
  const later=env.snap();assert.deepEqual(later.rows,[original]);assert.deepEqual(later.visible,[original]);
  for(const mode of ['split','net'])assert.deepEqual(later[mode],expectedStats(0,mode));
 }
});
test('FIN19 R8 learned rule cannot acknowledge category without a raw writer echo',async()=>{
 const f={...fixtures[0],date:'2026-10-21T10:00:00.001Z'},env=setup('sandbox',f),original=plain(env.stateRef.current.expenses[0]);
 const teacherRaw={id:uuid(7),user_id:owner,fecha:'2026-10-19T10:00:00.007Z',importe:-1,comercio:'Nombre remoto',
  ob_name:'Nombre remoto',cat:'cine',source:'ob:sabadell#refteacher#accaccount-a#n2'};
 env.remote.push(teacherRaw);const teacher=plain(env.c.expenseFromRow(teacherRaw));
 env.set(s=>({...s,expenses:s.expenses.concat([env.c.expenseFromRow(teacherRaw)])}));
 env.cloud.setExpenseCat=async()=>0;
 const chooseSource=section(html,'  const setCat=function(ex,newCat){','  const setCuota=');
 const choose=vm.runInContext('(function(api){const set=api.set,cloud=api.cloud,showToast=null,withdrawalPending={current:{}};'+chooseSource+'return setCat;})',env.c)(env);
 choose(env.stateRef.current.expenses[1],'bares');await Promise.resolve();
 assert.equal(Object.keys(env.stateRef.current.catRules).length,1,'regla aprendida por callback real');
 env.save('BAR NUEVO',{income:false});
 assert.equal(Object.hasOwn(env.stateRef.current.expenses[0],'catStale'),false,'el objetivo no tiene catStale local');
 env.remote[0].comercio='Nombre remoto';env.remote[0].cat='cine';
 // Instante corregido +1ms: el contador no presta la clave del nombre local; merge conserva UUID.
 env.remote[0].fecha='2026-10-21T10:00:00.002Z';
 const rawIncoming=env.c.expensesFromRows(env.remote,owner);
 const probe=env.c.keepCategoryChoices(env.stateRef.current.expenses,rawIncoming,now);
 assert.deepEqual(plain(probe.incoming[0].catStale),['cine'],'la regla real sintetiza la categoría entrante');
 await env.pull();
 const expected=[{...original,merchant:'Nombre remoto',category:'bares',expenseEditPending:{category:'bares'}},
  {...teacher,category:'bares',catStale:['cine']}];
 const r={kind:'learned-rule-composition',raw:plain(env.remote),...env.snap()};evidence.push(r);
 assert.equal(env.remote[0].cat,'cine','la categoría raw no confirma bares');
 assert.deepEqual(r.rows,expected,'filas completas: la regla no confirma pending.category');
 assert.deepEqual(r.visible,expected);assert.equal(r.storedCents,-150100);assert.equal(r.visibleCents,-150100);
 for(const mode of ['split','net'])assert.deepEqual(r[mode],expectedStats(150100,mode));
});
