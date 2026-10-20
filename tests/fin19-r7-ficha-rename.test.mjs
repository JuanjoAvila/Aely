import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {environment,section,plain,owner,uuid,cents,now} from './helpers/fin19-r4-fixture.mjs';
const html=fs.readFileSync(process.env.FIN19_R7_HTML||new URL('../public/index.html',import.meta.url),'utf8');
const callback=section(html,'  const saveEdit=function(orig, extra){','  const todayKey='),evidence=[];
const wire=(n=1,extra={})=>({id:uuid(n),user_id:owner,fecha:'2026-10-19T10:00:00.001Z',importe:3.2,comercio:'BAR SL',ob_name:'BAR SL',cat:'otros',nota:'Nota sintética',source:'ob:sabadell#refref-a#accaccount-a#n2',...extra});
function setup(mode,rows=[wire()]){
 const env=environment(html,rows),queues=[],toasts=[],edits=[];
 const factory=vm.runInContext('(function(api,mode,editExp){const keyOfE=keyOfExpense,state=api.stateRef.current,set=api.set,cloud=Object.assign({},api.cloud,{enabled:()=>mode!=="offline"}),mcSandbox=()=>mode==="sandbox",mcSandboxTransition=()=>mode==="transition",editCola={current:{pend:[]}},renameSequence={current:0},retryRenames=()=>{throw Error("unexpected rename retry");},separarGemelo=()=>{throw Error("unexpected twin split");},setEditExp=e=>api.edits.push(e),showToast=t=>api.toasts.push(t),subeEdicionesDeGasto=q=>api.queues.push(q.pend);'+callback+'return saveEdit;})',env.c);
 const save=(id,extra)=>{const orig=env.stateRef.current.expenses.find(e=>e.id===id);assert.ok(orig,'row exists before ficha save');factory({...env,queues,toasts,edits},mode,{id,merchant:orig.merchant,amount:String(Math.abs(orig.amount)),income:orig.amount<0,date:String(orig.date).slice(0,10)})(orig,extra);};
 const snap=()=>{const s=env.stateRef.current,del=env.c.expenseDeletedSet(s),visible=s.expenses.filter(e=>!env.c.expenseIsTombstoned(e,del));return{rows:plain(s.expenses),visible:plain(visible),cents:cents(visible),budgetCents:Math.round(env.c.monthBudgetStats(s,now).spent*100),deleted:plain(s.deleted),deletedAt:plain(s.deletedAt)};};
 return Object.assign(env,{save,snap,queues,toasts,edits});
}
after(()=>{if(process.env.FIN19_R7_EVIDENCE)fs.writeFileSync(process.env.FIN19_R7_EVIDENCE,JSON.stringify({zone:Intl.DateTimeFormat().resolvedOptions().timeZone,TZ:process.env.TZ??null,htmlSHA256:crypto.createHash('sha256').update(html).digest('hex'),callbackSHA256:crypto.createHash('sha256').update(callback).digest('hex'),cases:evidence},null,2)+'\n',{flag:'wx'});});
for(const mode of ['offline','sandbox','transition'])for(const path of ['save-reload-pull','rename-twice']){
 test('FIN19 R7 ficha real '+mode+' '+path,async()=>{
  const env=setup(mode),original=plain(env.stateRef.current.expenses[0]),r={mode,path,before:env.snap()};evidence.push(r);
  env.save(uuid(1),{merchant:'Mi bar'});r.saved=env.snap();
  env.persist();r.reload=env.snap();
  if(path==='rename-twice'){env.save(uuid(1),{merchant:'Mi bar favorito'});r.second=env.snap();env.persist();r.secondReload=env.snap();}
  await env.pull();r.pull=env.snap();r.queues=plain(env.queues);r.remote=plain(env.remote);
  assert.equal(r.before.cents,320);assert.equal(r.saved.cents,320,'ficha rename must not hide the bank row');
  for(const key of ['saved','reload','second','secondReload','pull'].filter(k=>r[k])){
   const expected={...original,merchant:(key==='second'||key==='secondReload'||key==='pull')&&path==='rename-twice'?'Mi bar favorito':'Mi bar'};
   assert.equal(r[key].cents,320,key);assert.equal(r[key].budgetCents,320,key+' budget');assert.deepEqual(r[key].visible,[expected],key+' full fields');
  }
  if(!process.env.FIN19_R7_BASE_CONTROL){
   assert.ok(r.saved.deleted.includes(env.c.keyOfExpense(original)),'old unscoped rename key');
   assert.ok(!r.saved.deleted.includes(env.c.expenseDeletionKey(original)),'no scoped original deletion');
  }
  assert.equal(env.deletes,0);assert.equal(env.writes.length,0);
 });
}
for(const mode of ['offline','sandbox','transition']){
 test('FIN19 R8 clasificación adicional conserva nombre bancario visible '+mode,()=>{
  const env=setup(mode),orig=plain(env.stateRef.current.expenses[0]);env.save(uuid(1),{merchant:'Mi bar',income:true});
  // Positive control only; real negative salary/transfer are exercised separately in R8.
  const r=env.snap();evidence.push({mode,path:'category-noCard-edit',result:r});assert.equal(r.rows[0].amount,3.2);assert.equal(r.rows[0].category,'ingreso');assert.equal(r.rows[0].noCard,true);assert.equal(r.cents,320);assert.deepEqual(r.visible,[{...orig,merchant:'Mi bar',category:'ingreso',noCard:true}]);assert.ok(r.deleted.includes(env.c.keyOfExpense(orig)));assert.ok(!r.deleted.includes(env.c.expenseDeletionKey(orig)));
 });
 test('FIN19 R7 renombrado manual conserva fila independiente '+mode,()=>{
  const env=setup(mode,[wire(1,{source:'manual:sabadell'}),wire(2,{source:'manual:sabadell'})]),orig=plain(env.stateRef.current.expenses[0]);env.save(uuid(1),{merchant:'Mi bar'});
  const r=env.snap();assert.equal(r.cents,640);assert.equal(r.visible.length,2);assert.ok(r.deleted.includes(env.c.expenseDeletionKey(orig)));
 });
}
for(const bank of ['sabadell','caixabank'])test('FIN19 R7 limitación de base: lápida sin ámbito coincide con otra cuenta '+bank,async()=>{
 const env=setup('offline',[wire(),wire(2,{source:'ob:'+bank+'#refref-b#accaccount-b#n2'})]),before=env.snap();
 env.save(uuid(1),{merchant:'Mi bar'});const saved=env.snap();env.persist();await env.pull();const pulled=env.snap();
 evidence.push({mode:'offline',path:'distinct-account-same-content',bank,before,saved,pulled});
 // Claude 68bd61de: base158 ya oculta la segunda cuenta por esta clave sin ámbito.
 // FIN separado: el importe correcto sería640; no ampliar el escritor de R7 ni
 // confundir esta limitación con los siete contratos remotos de cuenta.
 assert.equal(before.cents,640);assert.equal(saved.cents,320);assert.equal(pulled.cents,320);
 assert.deepEqual(saved.rows,[{...before.rows[0],merchant:'Mi bar'},before.rows[1]]);
 assert.deepEqual(saved.visible,[{...before.rows[0],merchant:'Mi bar'}]);
 assert.deepEqual(pulled.rows,saved.rows);assert.deepEqual(pulled.visible,saved.visible);
});
for(const mode of ['offline','sandbox','transition'])test('FIN19 R7 segunda edición vuelve al nombre original '+mode,async()=>{
 const env=setup(mode),original=plain(env.stateRef.current.expenses[0]);env.save(uuid(1),{merchant:'Mi bar'});env.save(uuid(1),{merchant:'BAR SL'});
 const saved=env.snap();env.persist();await env.pull();const pulled=env.snap();evidence.push({mode,path:'rename-back',saved,pulled});
 assert.equal(saved.cents,320);assert.equal(pulled.cents,320);assert.deepEqual(saved.visible,[original]);assert.deepEqual(pulled.visible,[original]);
});
for(const source of ['ob','ob-hist'])test('FIN19 R7 nombre conserva campos bancarios completos '+source,async()=>{
 const env=setup('offline',[wire(1,{source:source+':sabadell#refref-a#accaccount-a#n2'})]),row=env.stateRef.current.expenses[0];
 Object.assign(row,{origAmount:4,origCur:'USD',noCard:true,debtId:'synthetic-debt',note:'Nota preservada'});
 const original=plain(row);env.save(uuid(1),{merchant:'Mi bar',amount:'999,99'});
 const saved=env.snap();env.persist();const reloaded=env.snap();evidence.push({source,path:'preserve-all-fields',saved,reloaded});
 assert.deepEqual(saved.visible,[{...original,merchant:'Mi bar'}]);assert.deepEqual(reloaded.visible,saved.visible);assert.equal(saved.cents,320);
});
for(const mode of ['offline','sandbox','transition']){
 test('FIN19 R7 ficha fecha conserva lápida con ámbito '+mode,()=>{
  const env=setup(mode),orig=plain(env.stateRef.current.expenses[0]);env.save(uuid(1),{merchant:'Mi bar',date:'2026-10-18'});
  const r=env.snap();evidence.push({mode,path:'date-edit',result:r});assert.ok(r.deleted.includes(env.c.expenseDeletionKey(orig)));
  assert.ok(!r.deleted.includes(env.c.keyOfExpense(orig)));assert.equal(r.cents,320);assert.equal(r.rows[0].date,'2026-10-18');
  for(const row of [{...orig,obAcc:'account-b'},{...orig,ent:'caixabank'}])assert.equal(env.c.expenseIsTombstoned(row,env.c.expenseDeletedSet(env.stateRef.current)),false,'scoped edit cannot hide another account/bank');
 });
 test('FIN19 R7 importe bancario bloqueado conserva valor original '+mode,()=>{
  const env=setup(mode),orig=plain(env.stateRef.current.expenses[0]);env.save(uuid(1),{amount:'99,99'});
  assert.deepEqual(env.snap().rows,[orig]);assert.deepEqual(env.snap().deleted,[]);assert.equal(env.snap().cents,320);
 });
 test('FIN19 R7 manual nombre importe y fecha conservan contrato '+mode,()=>{
  const env=setup(mode,[wire(1,{source:'manual:sabadell'})]),orig=plain(env.stateRef.current.expenses[0]);env.save(uuid(1),{merchant:'Mi bar',amount:'4,20',date:'2026-10-18'});
  const r=env.snap();evidence.push({mode,path:'manual-edit',result:r});assert.equal(r.cents,420);assert.equal(r.rows[0].amount,4.2);assert.equal(r.rows[0].date,'2026-10-18');assert.ok(r.deleted.includes(env.c.expenseDeletionKey(orig)));
 });
}
