import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import * as nodeModule from 'node:module';
import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {environment,section,plain,owner,uuid,cents,now} from './helpers/fin19-r4-fixture.mjs';

const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');
const order=JSON.parse(read('src/build-order.json'));
const modules=order.map(p=>read('src/modules/'+p));
const script=modules.map(s=>s.endsWith('\n')?s:s+'\n').join('');
const parts=read('src/shell.html').split('<!--MC_APP_SCRIPT-->');
if(parts.length!==2)throw Error('Marcador de shell ausente o ambiguo');
// El contenido es literal: un replacement string expandía dollar-comilla y cortaba ErrorBoundary.
// Es el orden del ensamblador en memoria; el extractor no cambia. El fixture ejecuta el writer real.
// Sucesora autorizada por ccf8861e: original fallido SHA256 31d09ebd56c48b8d3cc8ebd5274aa62808c8e3e8e939af9fff3848e475768170.
// Se conserva íntegro junto al snapshot/cierre R118; no se reinterpreta aquel fallo como pérdida remota real.
const html=parts[0]+script.trimEnd()+parts[1];
const callback=section(html,'  const saveEdit=function(orig, extra){','  const todayKey=');
const mirrorSource=read('supabase/functions/_shared/presupuesto.ts');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const evidence={schema:1,zone:Intl.DateTimeFormat().resolvedOptions().timeZone,TZ:process.env.TZ??null,node:process.version,
 htmlSHA256:sha(html),callbackSHA256:sha(callback),mirrorSHA256:sha(mirrorSource),cases:[]};
function writeEvidence(){
 if(!process.env.FIN29_30_EVIDENCE)return;
 const fd=fs.openSync(process.env.FIN29_30_EVIDENCE,'wx');
 try{fs.writeFileSync(fd,JSON.stringify(evidence,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}
after(writeEvidence);
async function mirrorModule(){
 // Node24 local: solo Node, sin proceso esbuild. CI Node20 conserva su dependencia ya existente.
 if(typeof nodeModule.stripTypeScriptTypes==='function'){
  const js=nodeModule.stripTypeScriptTypes(mirrorSource,{mode:'strip'});
  return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
 }
 const {transformSync}=nodeModule.createRequire(import.meta.url)('esbuild');
 const mod={exports:{}};
 new Function('module','exports',transformSync(mirrorSource,{loader:'ts',format:'cjs'}).code)(mod,mod.exports);
 return mod.exports;
}
const wire=(n,bank='sabadell',account='account-a',extra={})=>({id:uuid(n),user_id:owner,fecha:new Date(Date.parse('2026-10-19T10:00:00.000Z')+n).toISOString(),importe:3.2,
 // «otros» se reclasifica al leer BAR SL: una categoría explícita conserva el mismo dato en ambas fronteras.
 comercio:'BAR SL',ob_name:'BAR SL',cat:'bares',nota:'Nota sintética',nota_edit:true,no_card:true,importe_orig:4,divisa:'USD',source:'ob:'+bank+'#refref-'+n+'#acc'+account+'#n2',...extra});
const sorted=rows=>plain(rows).sort((a,b)=>a.id.localeCompare(b.id));
function setup(mode,rows,deleteMode='not-applied'){
 const env=environment(html,rows,{deleteFails:deleteMode==='not-applied'}),queues=[],toasts=[],edits=[];
 env.deleteResponseLost=deleteMode==='response-lost';
 const factory=vm.runInContext('(function(api,mode,editExp){const keyOfE=keyOfExpense,state=api.stateRef.current,set=api.set,cloud=Object.assign({},api.cloud,{enabled:()=>mode!=="offline"}),mcSandbox=()=>mode==="sandbox",mcSandboxTransition=()=>mode==="transition",editCola={current:{pend:[]}},renameSequence={current:0},retryRenames=()=>{throw Error("unexpected rename retry");},separarGemelo=()=>{throw Error("unexpected twin split");},setEditExp=e=>api.edits.push(e),showToast=t=>api.toasts.push(t),subeEdicionesDeGasto=q=>api.queues.push(q.pend);'+callback+'return saveEdit;})',env.c);
 env.save=(id,extra)=>{
  const orig=env.stateRef.current.expenses.find(e=>e.id===id);assert.ok(orig,'fila original antes de editar');
  factory({...env,queues,toasts,edits},mode,{id,merchant:orig.merchant,amount:String(Math.abs(orig.amount)),income:orig.amount<0,date:String(orig.date).slice(0,10)})(orig,extra);
 };
 env.queues=queues;
 return env;
}
function snapshot(env){
 const s=env.stateRef.current,deleted=env.c.expenseDeletedSet(s);
 const visible=s.expenses.filter(e=>!env.c.expenseIsTombstoned(e,deleted));
 return {rows:sorted(s.expenses),visible:sorted(visible),cents:cents(visible),budgetCents:Math.round(env.c.monthBudgetStats(s,now).spent*100),
  perBank:Object.fromEntries(['sabadell','caixabank'].map(bank=>[bank,Math.round(env.c.monthBudgetStats({...s,settings:{expenseBanks:[bank]}},now).spent*100)])),
  deleted:plain(s.deleted),deletedAt:plain(s.deletedAt)};
}
function check(env,expected,total,record,stage){
 const snap=snapshot(env);record[stage]=snap;
 assert.equal(snap.cents,total,stage+' céntimos independientes');
 assert.deepEqual(snap.rows,sorted(expected),stage+' todas las filas y todos sus campos');
 assert.deepEqual(snap.visible,sorted(expected),stage+' todas las filas visibles');
 return snap;
}
function checkBudget(env,record,stage,otherBank){
 const snap=record[stage];assert.equal(snap.budgetCents,640,stage+' presupuesto');
 assert.deepEqual(snap.perBank,otherBank==='sabadell'?{sabadell:640,caixabank:0}:{sabadell:320,caixabank:320},stage+' ámbito bancario');
}
function checkMirror(env,mirror,wireRows,expected,total,record,stage){
 const s=env.stateRef.current,rows=mirror.filasComoLaApp(wireRows,s.deleted,s.obAbsorbedPending,owner,s.obAbsorbedConfirmed);
 const result={rows:sorted(rows),cents:cents(rows),budgetCents:Math.round(mirror.statsDelMes(rows,s,Date.parse('2026-10-01')).spent*100)};
 record[stage]=result;assert.equal(result.cents,total,stage+' espejo céntimos');
 assert.equal(result.budgetCents,total,stage+' espejo presupuesto');assert.deepEqual(result.rows,sorted(expected),stage+' espejo filas completas');
}
async function reimport(env,bank='sabadell',account='account-a',ref='ref-1'){
 env.cloud.bankLinks=async()=>[];
 env.cloud.bankSync=async()=>({links:[{aspsp:bank==='sabadell'?'Banco Sabadell':'CaixaBank',ok:true,syncFrom:'2026-01-01',accounts:[{uid:account,ok:true,transactions:[{ext_id:ref,date:'2026-10-19',amount:3.2,merchant:'BAR SL',status:'BOOK'}]}]}]});
 const factory=vm.runInContext('(function(stateRef,set,cloud,setTimeout){const sessionRef={current:{user:{id:"'+owner+'"}}},bankSyncing={current:false},pullOkRef={current:Promise.resolve(true)},obAckPend={current:null},SYNC_SIN_NUBE={},showToast=function(){},avisaSync=function(){},setTab=function(){};const syncCloudExpenses=function(){throw Error("unexpected implicit pull");};'+section(html,'  const runBankSync=function(opts){','  /* EL ACUSE SE GUARDA DETRÁS')+'return runBankSync;})',env.c);
 await factory(env.stateRef,env.set,env.cloud,(fn,ms)=>{env.timers.push({fn,ms});return env.timers.length;})({manual:false});
 await env.flush();
}
async function fichaScenario(mode,otherBank,mirror){
 const wires=[wire(1),wire(2,otherBank,'account-b')],env=setup(mode,wires),before=plain(env.stateRef.current.expenses);
 const record={kind:'ficha',mode,otherBank};evidence.cases.push(record);
 const expected=[{...before[0],merchant:'Mi bar'},before[1]];
 check(env,before,640,record,'before');checkBudget(env,record,'before',otherBank);
 env.save(uuid(1),{merchant:'Mi bar'});
 check(env,expected,640,record,'saved');checkBudget(env,record,'saved',otherBank);
 env.persist();check(env,expected,640,record,'reload');
 await env.pull();check(env,expected,640,record,'pull');
 await reimport(env);check(env,expected,640,record,'reimport');checkBudget(env,record,'reimport',otherBank);
 env.persist();await env.pull();check(env,expected,640,record,'secondPull');
 // Antes de subir la cola offline, se compara el mismo estado sintético en ambos lectores.
 // Esto acredita paridad de lógica local, nunca una actualización del widget desplegado.
 const localWire=[{...wires[0],comercio:'Mi bar'},wires[1]];
 checkMirror(env,mirror,localWire,localWire,640,record,'localMirror');
 env.save(uuid(1),{merchant:'BAR SL'});check(env,before,640,record,'renameBack');
 env.persist();await env.pull();check(env,before,640,record,'renameBackPull');
 assert.equal(env.deletes,0);assert.equal(env.writes.length,0);assert.equal(env.uploads.length,0);
}
async function ackDeleteScenario(otherBank,deleteMode,mirror){
 const wires=[wire(1),wire(2,otherBank,'account-b')],env=setup('offline',wires,deleteMode),before=plain(env.stateRef.current.expenses);
 const record={kind:'confirmed-ACK-delete-undo',otherBank,deleteMode};evidence.cases.push(record);
 const expected=[{...before[0],merchant:'Mi bar',expenseEditAt:now},before[1]];
 await env.rename(uuid(1),'Mi bar');check(env,expected,640,record,'ack');checkBudget(env,record,'ack',otherBank);
 const renamedWire=[{...wires[0],comercio:'Mi bar'},wires[1]];
 assert.deepEqual(sorted(env.remote),sorted(renamedWire),'ACK remoto: solo cambia el nombre');
 checkMirror(env,mirror,env.remote,renamedWire,640,record,'ackMirror');
 env.persist();await env.pull();check(env,expected,640,record,'ackPull');
 await reimport(env);check(env,expected,640,record,'ackReimport');
 assert.equal(env.uploads.length,0,'renombrar no intenta altas');assert.equal(env.upserts.length,0,'sin upserts por alias');
 const controls=env.controls();controls.del(env.stateRef.current.expenses.find(e=>e.id===uuid(1)));await env.flush();env.persist();
 check(env,[before[1]],320,record,'deleted');checkMirror(env,mirror,env.remote,[wires[1]],320,record,'deletedMirror');
 assert.equal(record.deleted.budgetCents,320,'presupuesto tras borrar');
 assert.deepEqual(record.deleted.perBank,otherBank==='sabadell'?{sabadell:320,caixabank:0}:{sabadell:0,caixabank:320},'banco tras borrar');
 assert.deepEqual(sorted(env.remote),sorted(deleteMode==='not-applied'?renamedWire:[wires[1]]),'resultado real del DELETE simulado');
 await reimport(env);await env.pull();check(env,[before[1]],320,record,'deletedReimportPull');
 assert.equal(env.deletes,1,'un DELETE, sin reintentos implícitos');
 controls.undo();await env.flush();env.persist();await env.pull();
 check(env,expected,640,record,'undo');checkMirror(env,mirror,env.remote,renamedWire,640,record,'undoMirror');
 checkBudget(env,record,'undo',otherBank);
 assert.deepEqual(sorted(env.remote),sorted(renamedWire),'restauración conserva todos los campos remotos');
 assert.equal(env.uploads.length,1,'una restauración legítima incluso si DELETE devuelve false');
 assert.equal(env.upserts.length,1,'el writer real alcanza el transporte una vez');
 assert.equal(env.inserts.length,deleteMode==='not-applied'?0:1,'intento e inserción efectiva son distintos');
 assert.equal(env.uploadResults[0],false,'el SDK sin select no acredita fila devuelta ni suprime restauración');
 const restored=env.stateRef.current.expenses.find(e=>e.id===uuid(1));
 controls.undo();await env.cloud.addExpense(restored);await env.cloud.addExpense(restored);await env.flush();
 env.persist();await env.pull();check(env,expected,640,record,'repeatedRestore');checkBudget(env,record,'repeatedRestore',otherBank);
 checkMirror(env,mirror,env.remote,renamedWire,640,record,'repeatedRestoreMirror');
 assert.deepEqual(sorted(env.remote),sorted(renamedWire),'repetir restore no reemplaza ni duplica filas');
 assert.equal(env.uploads.length,3,'una restauración y dos reenvíos explícitos');assert.equal(env.upserts.length,3);
 assert.equal(env.inserts.length,deleteMode==='not-applied'?0:1,'idempotencia real por conflicto');
 record.transport={uploads:plain(env.uploads),results:plain(env.uploadResults),upserts:plain(env.upserts),inserts:plain(env.inserts),remote:sorted(env.remote)};
}
async function writerGuardScenarios(){
 for(const variant of ['no-session','expired-session','owner-switch','late-owner-switch','auth-error','confirmed-absorption','invalid-confirmation']){
  const wires=[wire(1),wire(2,'caixabank','account-b')],env=setup('offline',wires),target=env.stateRef.current.expenses[0];
  env.remote=plain([wires[1]]);const before=plain(env.remote),record={kind:'real-writer-guard',variant};evidence.cases.push(record);
  if(variant==='no-session')env.session=null;
  if(variant==='expired-session')env.session.expires_at=now/1000-1;
  if(variant==='owner-switch'||variant==='late-owner-switch')env.sessionProvider=n=>({data:{session:{user:{id:n>=(variant==='owner-switch'?2:3)?'synthetic-other-owner':owner},expires_at:9e9}},error:null});
  if(variant==='auth-error')env.sessionProvider=()=>({data:{session:plain(env.session)},error:{message:'synthetic auth error'}});
  if(variant==='confirmed-absorption'){
   const keep=env.stateRef.current.expenses[1],p={owner,id:target.id,key:env.c.obAbsorptionKey(target),keepId:keep.id,keepKey:env.c.obAbsorptionKey(keep),ackAt:now};
   assert.equal(env.c.obConfirmedValid(p,owner),true);assert.equal(env.c.obConfirmedPersist(owner,[p]),true);
   assert.equal(await env.c.obConfirmedCanUpload(target,owner,{auth:{getSession:async()=>({data:{session:plain(env.session)},error:null})}}),false,'veto real de fila absorbida');
  }
  if(variant==='invalid-confirmation')env.disk.set(env.c.obConfirmedStorageKey(owner),'{');
  await env.cloud.addExpense(target);
  assert.deepEqual(env.remote,before,variant+' no muta ninguna fila');assert.equal(env.upserts.length,0,variant+' no llega al transporte');
  record.sessionReads=env.sessionReads;record.uploads=plain(env.uploads);record.upserts=plain(env.upserts);record.remote=plain(env.remote);
 }
 // El conflicto aparece al renombrar: antes hay dos comercios distintos en el MISMO instante.
 const wires=[wire(1),wire(2,'caixabank','account-b',{fecha:wire(1).fecha,comercio:'Mi bar'})],env=setup('offline',wires);
 const before=plain(env.remote),localBefore=plain(env.stateRef.current.expenses),record={kind:'real-writer-guard',variant:'UPDATE23505-atomic'};
 evidence.cases.push(record);
 await assert.rejects(env.cloud.renameExpense(env.stateRef.current.expenses[0],'Mi bar'),err=>err.code==='23505');
 assert.deepEqual(env.remote,before,'UPDATE con conflicto no muta ni una fila remota');
 assert.deepEqual(plain(env.stateRef.current.expenses),localBefore,'fallo del writer no cambia filas locales');
 assert.equal(cents(env.stateRef.current.expenses),640);assert.equal(env.uploads.length,0);
 record.remote=plain(env.remote);record.rows=plain(env.stateRef.current.expenses);record.writes=plain(env.writes);
}
async function signedManualControls(){
 for(const manual of [false,true]){
  const wires=[wire(1,'sabadell','account-a',{importe:-3.2,cat:'ingreso',...(manual?{source:'manual:sabadell'}:{})}),wire(2,'caixabank','account-b')];
  const env=setup('offline',wires),before=plain(env.stateRef.current.expenses),record={kind:manual?'manual-credit':'bank-credit'};evidence.cases.push(record);
  const expected=[{...before[0],merchant:'Abono editado',category:'ingreso',noCard:true},before[1]];
  env.save(uuid(1),{merchant:'Abono editado',income:true});check(env,expected,0,record,'saved');
  env.persist();check(env,expected,0,record,'reload');
  assert.equal(env.stateRef.current.expenses[0].amount,-3.2,'renombrar no cambia signo ni importe');
 }
}
async function nativeAliasParity(mirror){
 const variants=[
  {name:'ob-native-ordinal',source:'ob:trade_republic#n2',event:'synthetic-event',visible:true},
  {name:'ob-native-dup',source:'ob:trade_republic#dup',event:'synthetic-event',visible:true},
  {name:'ordinary-ob-ordinal',source:'ob:trade_republic#n2',visible:false},
  {name:'ordinary-ob-with-event',source:'ob:trade_republic',event:'synthetic-event',visible:false},
  {name:'historical-ob-event-ordinal',source:'ob-hist:trade_republic#n2',event:'synthetic-event',visible:false},
  {name:'historical-ob-event-dup',source:'ob-hist:trade_republic#dup',event:'synthetic-event',visible:false}
 ];
 for(const variant of variants){
  const raw=wire(91,'trade_republic','',{source:variant.source,...(variant.event?{ingest_event_id:variant.event}:{})});
  const env=setup('offline',[raw]),bankRow={...raw};delete bankRow.ingest_event_id;
  const alias=env.c.expenseRenameKey(env.c.expenseFromRow(bankRow));assert.ok(alias,'alias OB previo válido por UUID');
  const s={...env.stateRef.current,deleted:[alias]},del=env.c.expenseDeletedSet(s);
  const local=s.expenses.filter(e=>!env.c.expenseIsTombstoned(e,del)),visibleWire=local.map(e=>raw).filter(Boolean);
  const remote=mirror.filasComoLaApp([raw],s.deleted,s.obAbsorbedPending,owner,s.obAbsorbedConfirmed);
  const expected=variant.visible?[raw]:[],record={kind:'native-alias-parity',variant:variant.name,alias,local:plain(local),remote:plain(remote)};
  evidence.cases.push(record);
  assert.deepEqual(sorted(visibleWire),sorted(expected),variant.name+' clasificación JS literal');
  assert.equal(cents(local),variant.visible?320:0,variant.name+' céntimos JS');
  assert.deepEqual(sorted(remote),sorted(expected),variant.name+' paridad TS filas completas');
  assert.equal(cents(remote),cents(local),variant.name+' paridad céntimos');
  const appBudget=Math.round(env.c.monthBudgetStats(s,now).spent*100),mirrorBudget=Math.round(mirror.statsDelMes(remote,s,Date.parse('2026-10-01')).spent*100);
  record.appBudgetCents=appBudget;record.mirrorBudgetCents=mirrorBudget;
  assert.equal(mirrorBudget,appBudget,variant.name+' paridad presupuesto');
 }
}
test('FIN29/30 rename conserva dos cuentas, filas completas y céntimos; delete/undo conservan su intención',async()=>{
  const mirror=await mirrorModule();
  await nativeAliasParity(mirror);
  for(const otherBank of ['caixabank','sabadell'])for(const mode of ['offline','sandbox','transition'])await fichaScenario(mode,otherBank,mirror);
  for(const otherBank of ['caixabank','sabadell'])for(const deleteMode of ['not-applied','response-lost','confirmed'])await ackDeleteScenario(otherBank,deleteMode,mirror);
  await signedManualControls();
  await writerGuardScenarios();
});
test('FIN29/30 empty merchant alias parity after real ficha callback',async()=>{
  const mirror=await mirrorModule();
  for(const variant of [{name:'empty',value:''},{name:'null',value:null},{name:'absent'},{name:'whitespace',value:'   '},{name:'ordinary',value:'BAR SL'}]){
   const raw=wire(95,'sabadell','account-a',{comercio:variant.value,ob_name:null});
   if(variant.name==='absent')delete raw.comercio;
   const env=setup('offline',[raw]),original=plain(env.stateRef.current.expenses[0]);
   env.save(original.id,{merchant:'Nombre elegido'});
   const del=env.c.expenseDeletedSet(env.stateRef.current);
   const jsRows=[raw].filter(row=>!env.c.expenseIsTombstoned(env.c.expenseFromRow(row),del));
   const tsRows=mirror.filasComoLaApp([raw],env.stateRef.current.deleted,[],owner,[]);
   evidence.cases.push({kind:'empty-merchant-alias',variant:variant.name,raw:plain(raw),saved:plain(env.stateRef.current.expenses),deleted:plain(env.stateRef.current.deleted),jsRows:plain(jsRows),tsRows:plain(tsRows)});
   assert.deepEqual(plain(jsRows),[],variant.name+' old name hidden by callback-created alias');
   assert.deepEqual(plain(tsRows),[],variant.name+' TS full rows match JS');
   assert.equal(cents(jsRows),0);assert.equal(cents(tsRows),0);
   assert.deepEqual(plain(mirror.filasComoLaApp([raw],[],[],owner,[])),[plain(raw)],variant.name+' no alias keeps full raw row');
  }
});
