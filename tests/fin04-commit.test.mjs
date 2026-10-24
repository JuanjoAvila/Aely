import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {codeMask} from '../scripts/beta-source-code.mjs';import {loadPureLogicFromFile} from '../scripts/load-pure-logic.mjs';
import {withOwnerStorage} from './helpers/owner-storage-fixture.mjs';
const app=fs.readFileSync(process.env.FIN04_COMMIT_SOURCE||new URL('../src/modules/11-app-main.js',import.meta.url),'utf8').replaceAll('\r\n','\n');
function block(token){const mask=codeMask(app),start=mask.indexOf(token);assert.ok(start>=0,token);let end=mask.indexOf('{',start)+1,depth=1;for(;depth;end++){if(mask[end]==='{')depth++;if(mask[end]==='}')depth--;}return app.slice(start,end)+';';}
const ticks=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
// El transporte retiene una foto por GET: una solicitud posterior debe esperar otra
// foto, también si falla la primera. Se ejecuta el bloque real con la mezcla pura.
function expenseBank(){
 const c=withOwnerStorage(loadPureLogicFromFile()),jobs=[],session={user:{id:'synthetic'}},initial={expenses:[],deleted:[],gemelos:[]};
 Object.assign(c,{wS:{current:0},wR:{current:false},wP:{current:null},wC:{current:[]},wRead:{current:null},wOwner:{current:null},sessionRef:{current:session},stateRef:{current:initial},
 cloud:{pullExpenses:proof=>{const owner=c.sessionRef.current.user.id;return new Promise((resolve,reject)=>jobs.push({resolve:rows=>{proof.valid=true;proof.userId=owner;resolve(rows);},reject}));},setExpenseCat:()=>Promise.resolve()},
 retryObAbsorbedCloud:()=>Promise.resolve(),mcSandbox:()=>false,natPlugin:()=>null,subirGasto:()=>{},fixMovInvasion:s=>s,reconcileObDupes:s=>({state:s,recat:[]}),
 set:fn=>{c.stateRef.current=fn(c.stateRef.current);},setTimeout,clearTimeout});
 vm.createContext(c);const names=['wS','wR','wP','wC','wRead','wOwner','sessionRef','stateRef','cloud','retryObAbsorbedCloud','mcSandbox','natPlugin','subirGasto','fixMovInvasion','reconcileObDupes','set','setTimeout','clearTimeout'];
 c.sync=vm.runInContext('(function('+names.join(',')+'){'+block('const syncCloudExpenses=function(')+'return syncCloudExpenses;})',c)(...names.map(k=>c[k]));
 const rows=amounts=>amounts.map((amount,i)=>({id:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),fecha:'2026-10-24T12:00:00.000Z',importe:amount,comercio:'Remoto '+i,cat:'otros',source:'manual:sabadell'}));
 return {c,jobs,rows,sync:()=>c.sync(),cents:()=>c.stateRef.current.expenses.reduce((n,e)=>n+Math.round(e.amount*100),0)};
}

test('R5: una ráfaga comparte promesa y espera la relectura con 80 frente a 70 sin perder edición local',async()=>{
 const b=expenseBank(),first=b.sync();await ticks();assert.equal(b.jobs.length,1);
 const same=b.sync(),again=b.sync();assert.equal(same,first);assert.equal(again,first);assert.equal(b.jobs.length,1);
 const human={id:'local-human',date:'2026-10-24T12:00:00.000Z',amount:0.01,merchant:'Edición humana',source:'manual',note:'Conservar'};
 b.c.stateRef.current={...b.c.stateRef.current,expenses:[human]};let settled=false;first.then(()=>{settled=true;});
 b.jobs[0].resolve(b.rows([40,30]));await ticks();assert.equal(b.jobs.length,2);assert.equal(settled,false);
 b.jobs[1].resolve(b.rows([40,30,10]));await Promise.all([first,same,again]);
 assert.equal(b.jobs.length,2);assert.equal(b.cents(),8001);assert.equal(b.c.stateRef.current.expenses.find(e=>e.id==='local-human'),human);
 assert.equal(b.c.wP.current,null);assert.equal(b.c.wOwner.current,null);
});

test('R5: el error inicial drena la solicitud pendiente y su promesa espera el segundo resultado',async()=>{
 const b=expenseBank(),first=b.sync();await ticks();const same=b.sync();b.jobs[0].reject(Error('primer GET offline'));await ticks();
 assert.equal(b.jobs.length,2);b.jobs[1].resolve(b.rows([40,30,10]));await Promise.all([first,same]);
 assert.equal(b.cents(),8000);assert.equal(b.c.wP.current,null);assert.equal(b.c.wOwner.current,null);
});

test('R5: un error sin pendiente y el fallo de la relectura rechazan y liberan el vuelo',async()=>{
 const b=expenseBank(),first=b.sync();await ticks();b.jobs[0].reject(Error('sin solicitud'));await assert.rejects(first,/sin solicitud/);
 assert.equal(b.jobs.length,1);assert.equal(b.c.wP.current,null);assert.equal(b.c.wOwner.current,null);
 const next=b.sync();await ticks();const same=b.sync();b.jobs[1].resolve(b.rows([40,30]));await ticks();
 assert.equal(b.jobs.length,3);b.jobs[2].reject(Error('relectura offline'));await assert.rejects(next,/relectura offline/);await assert.rejects(same,/relectura offline/);
 assert.equal(b.c.wP.current,null);assert.equal(b.c.wOwner.current,null);assert.equal(b.jobs.length,3);
});

for(const owner of ['synthetic','another-synthetic'])test('R5: cambiar sesión a '+owner+' cancela la pendiente anterior sin borrar el vuelo nuevo',async()=>{
 const b=expenseBank(),old=b.sync();await ticks();const oldSame=b.sync();
 b.c.sessionRef.current={user:{id:owner}};const fresh=b.sync();await ticks();assert.equal(b.jobs.length,2);const active=b.c.wP.current,token=b.c.wOwner.current;
 b.jobs[0].resolve(b.rows([40,30]));await Promise.all([old,oldSame]);assert.equal(b.jobs.length,2);assert.equal(b.c.wP.current,active);assert.equal(b.c.wOwner.current,token);assert.equal(b.cents(),0);
 b.jobs[1].resolve(b.rows([40,30,10]));await fresh;assert.equal(b.jobs.length,2);assert.equal(b.cents(),8000);assert.equal(b.c.wP.current,null);assert.equal(b.c.wOwner.current,null);
});

function bank({pending=false}={}){
 const c=loadPureLogicFromFile(),updates=[],writes=[],backups=[],timers=[];let resolvePull,rejectPull,acks=0;
 const storage=new Map(),diskWrites=[];c.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>{diskWrites.push(k);storage.set(k,v);},removeItem:k=>storage.delete(k)};c.window.localStorage=c.localStorage;
 const initial={budget:100,accounts:[],investments:[],debts:[{id:'d',value:1200.23,monthly:100.11}],fixed:[{id:'f',amount:42.37,day:28}],expenses:[],goals:[],settings:{},_savedAt:100,_historyOwner:'synthetic'};
 if(pending){const row={id:'00000000-0000-4000-8000-000000000002',source:'ob',ent:'caixabank',extId:'booked',date:'2026-10-16T12:00:00.000Z',amount:3.2,merchant:'Synthetic',obAcc:'synthetic-account'},keep={...row,id:'00000000-0000-4000-8000-000000000001',extId:'pending'};initial.obAbsorbedPending=[{owner:'synthetic',id:row.id,key:c.obAbsorptionKey(row),keepId:keep.id,keepKey:c.obAbsorptionKey(keep),amount:3.2,merchant:'Synthetic'}];assert.equal(c.obAbsorbedValid(initial.obAbsorbedPending[0],'synthetic'),true);}
 Object.assign(c,{state:initial,stateRef:{current:initial},cloudReadRef:{current:null},cloudPullRef:{current:null},cloudUpdatedAtRef:{current:null},cloudMergeKey:{current:Symbol('merge')},pullOkRef:{current:null},sessionRef:{current:{user:{id:'synthetic'}}},obAbsorbedWriteBlocked:{current:false},uid:'synthetic',
 cloud:{pullState:()=>new Promise((r,j)=>{resolvePull=r;rejectPull=j;}),pushState:async(u,s,revision)=>{writes.push({u,s,revision});return {updated_at:'r2'};},backupState:async(u,s)=>{backups.push({u,s});}},
 set:(f,edited=true)=>updates.push(s=>{const next=f(s);return next===s?next:edited?Object.assign({},next,{_savedAt:Date.now()}):next;}),setStateRaw:f=>updates.push(f),syncCloudExpenses:()=>Promise.resolve(),reservaMensualAlDia:()=>{},showToast:()=>{},mcBootReady:()=>{},goalSyncAck:s=>{acks++;return s;},setTimeout:f=>{timers.push(f);return timers.length;},clearTimeout:()=>{},useEffect:f=>f(),navigator:{onLine:true}});
 vm.createContext(c);const names=['state','stateRef','cloudReadRef','cloudPullRef','cloudUpdatedAtRef','cloudMergeKey','pullOkRef','sessionRef','obAbsorbedWriteBlocked','uid','cloud','set','setStateRaw','syncCloudExpenses','reservaMensualAlDia','showToast','mcBootReady','goalSyncAck','setTimeout','clearTimeout','useEffect','navigator'];
 const factory=code=>vm.runInContext('(function('+names.join(',')+'){'+code+'})',c)(...names.map(n=>c[n]));
 const commit=app.includes('const commitCloudRead=function(')?block('const commitCloudRead=function('):'const commitCloudRead=function(){};';
 const effect=app.indexOf('// Empuja el estado a la nube (debounced)'),a=app.indexOf('tmr=setTimeout(function(){',effect)+'tmr=setTimeout(function(){'.length,b=app.indexOf('}, 1200);',a);assert.ok(a>effect&&b>a);
 Object.assign(c,factory('let tmr;const uploadState=state;'+block('const pushAppState=function(')+block('const syncFromCloud=function(')+commit+'return {send:pushAppState,sync:syncFromCloud,debounce:function(){'+app.slice(a,b)+'},commit:function(next){state=next;commitCloudRead();}};'));
 const pack={data:{...initial,budget:200,fixed:[{...initial.fixed[0],day:29}],_savedAt:200},updated_at:'r1'};
 return {c,writes,backups,updates,timers,diskWrites,acks:()=>acks,start:()=>c.sync(c.sessionRef.current),reply:(value=pack)=>resolvePull(value),reject:()=>rejectPull(Error('synthetic offline')),evaluate:()=>updates.map(f=>f(c.state)),flush(){for(const f of updates.splice(0))c.state=f(c.state);c.stateRef.current=c.state;c.commit(c.state);},backup(){const start=app.indexOf('  // Copia de seguridad diaria'),end=app.indexOf('\n  /* Activar el canal beta',start);factory(app.slice(start,end));},pack};
}
test('H3: respuesta válida y updater retenido no permiten subir el snapshot anterior ni ACK',async()=>{
 const b=bank(),done=b.start();b.reply();await ticks();
 assert.equal(await b.c.send('synthetic',b.c.state),null);assert.equal(b.writes.length,0);assert.equal(b.acks(),0);
 // Evaluar y descartar un render tampoco acredita: solo el commit puede abrir la puerta.
 b.evaluate();b.evaluate();assert.equal(b.c.cloudReadRef.current,null);assert.equal(b.c.cloudUpdatedAtRef.current,null);
 b.flush();await done;assert.equal(b.c.cloudReadRef.current.ready,true);assert.equal(b.c.state.fixed[0].day,29);
 await b.c.send('synthetic',b.c.state);b.flush();assert.equal(b.writes.length,1);assert.equal(b.writes[0].s.fixed[0].day,29);assert.equal(b.acks(),1);
 assert.equal(Math.round(b.writes[0].s.fixed[0].amount*100),4237);assert.equal(Math.round(b.writes[0].s.debts[0].value*100),120023);
});
test('backup: pendiente no escribe; tras commit válido usa estado mezclado sin renovar savedAt',async()=>{
 const b=bank(),done=b.start();b.backup();for(const f of b.timers.splice(0))f();await ticks();assert.equal(b.backups.length,0);
 b.reply();await ticks();b.flush();await done;b.backup();for(const f of b.timers.splice(0))f();await ticks();
 assert.equal(b.backups.length,1);assert.equal(b.backups[0].s.fixed[0].day,29);const stamp=b.c.state._savedAt;await new Promise(r=>setTimeout(r,5));b.flush();assert.equal(b.c.state._savedAt,stamp);assert.equal(b.c.state.lastBackup,new Date().toISOString().slice(0,10));
});
test('H3: un debounce anterior al pull toma la copia comprometida al dispararse',async()=>{
 const b=bank(),done=b.start();b.reply();await ticks();b.flush();await done;
 b.c.debounce();await ticks();assert.equal(b.writes.length,1);assert.equal(b.writes[0].s.fixed[0].day,29);assert.equal(b.writes[0].revision,'r1');
});
test('H3: repetir y descartar el updater no persiste colas ni concede lectura',async()=>{
 const b=bank({pending:true}),done=b.start();b.reply();await ticks();const before=b.diskWrites.length;b.evaluate();b.evaluate();assert.equal(b.diskWrites.length,before);assert.equal(b.c.cloudReadRef.current,null);b.flush();await done;assert.equal(b.c.state.obAbsorbedPending.length,1);assert.equal(b.c.cloudReadRef.current.ready,true);
});
test('backup: un error de lectura nunca acredita ausencia ni permite la copia',async()=>{
 const b=bank(),done=b.start();b.reject();await assert.rejects(done,/synthetic offline/);b.backup();for(const f of b.timers.splice(0))f();await ticks();assert.equal(b.backups.length,0);assert.equal(b.c.cloudReadRef.current,null);
});
test('backup: rescatar una fila corrupta con CAS no acredita una lectura válida',async()=>{
 const b=bank(),done=b.start();b.reply({data:{fixed:'invalid'},updated_at:'r1'});await done;b.flush();b.backup();for(const f of b.timers.splice(0))f();await ticks();assert.equal(b.writes.length,1);assert.equal(b.backups.length,0);
});
test('H3: cancelar el commit por nueva sesión no acredita ni aplica la respuesta anterior',async()=>{
 const b=bank(),done=b.start();b.reply();await ticks();const read=b.c.cloudPullRef.current;read.commit(false);b.c.cloudPullRef.current=null;b.c.cloudReadRef.current=null;b.c.sessionRef.current={user:{id:'synthetic'}};
 b.flush();await done;assert.equal(b.c.cloudReadRef.current,null);assert.equal(b.c.state.fixed[0].day,28);assert.equal(b.writes.length,0);assert.equal(await b.c.pullOkRef.current,false);
});

test('H3: ACK en vuelo no cambia la revisión mientras otro merge espera commit',async()=>{
 const b=bank();b.c.cloudReadRef.current={owner:'synthetic',ready:true};b.c.cloudUpdatedAtRef.current='r0';let finish;
 b.c.cloud.pushState=()=>new Promise(resolve=>{finish=resolve;});
 const sent=b.c.send('synthetic',b.c.state),done=b.start();b.reply();await ticks();
 finish({updated_at:'r2'});assert.equal(await sent,null);assert.equal(b.acks(),0);assert.equal(b.c.cloudUpdatedAtRef.current,'r0');
 b.flush();await done;assert.equal(b.c.cloudUpdatedAtRef.current,'r1');assert.equal(b.c.state.fixed[0].day,29);assert.equal(b.acks(),0);
});

test('H3: ACK diferido no cambia la base al evaluar el updater de otro merge',async()=>{
 const b=bank();b.c.cloudReadRef.current={owner:'synthetic',ready:true};b.c.cloudUpdatedAtRef.current='r0';
 await b.c.send('synthetic',b.c.state);const done=b.start();b.reply();await ticks();
 b.evaluate();assert.equal(b.acks(),0);b.flush();await done;assert.equal(b.acks(),0);assert.equal(b.c.state.fixed[0].day,29);assert.equal(b.c.cloudUpdatedAtRef.current,'r1');
});

// La segunda lectura devuelve el estado ya asentado, para no confundir una migración
// de arranque con un cambio humano o con los metadatos exclusivos de este dispositivo.
async function readBackBank(options){
 const b=bank(options),first=b.start();b.reply();await ticks();b.flush();await first;
 const remote=JSON.parse(JSON.stringify(b.c.state)),next=b.start();b.reply({data:remote,updated_at:'r-known'});await ticks();b.flush();await next;
 assert.ok(b.c.cloudReadRef.current.ready);assert.ok(b.c.cloudReadRef.current.valid);assert.equal(b.writes.length,0);
 return b;
}
function budgetEdit(b,value){b.c.set(s=>Object.assign({},s,{budget:value}));b.flush();}
function pendingWrites(b){
 const jobs=[];
 b.c.cloud.pushState=(u,s,revision)=>{b.writes.push({u,s,revision});return new Promise(resolve=>jobs.push(resolve));};
 return jobs;
}

test('R4: un GET idéntico salvo savedAt y lastSync no genera otro CAS ni un ACK ficticio',async()=>{
 const b=await readBackBank(),read=b.c.cloudReadRef.current;
 const snapshot=Object.assign({},b.c.state,{_savedAt:b.c.state._savedAt+17,lastSync:Date.now()});
 const result=await b.c.send('synthetic',snapshot);b.flush();
 assert.equal(result.unchanged,true);assert.equal(result.updated_at,'r-known');assert.equal(b.writes.length,0);assert.equal(b.acks(),0);
 assert.equal(b.c.cloudReadRef.current,read);assert.equal(b.c.cloudUpdatedAtRef.current,'r-known');
 assert.equal(Math.round(b.c.state.fixed[0].amount*100),4237);assert.equal(Math.round(b.c.state.debts[0].value*100),120023);
});

test('R4: una confirmación durable local que falta en el GET obliga a enviar y no contamina la base',async()=>{
 const b=await readBackBank({pending:true}),read=b.c.cloudReadRef.current,remoteBase=read.baseData,remoteBefore=b.c.obStateCanonical(remoteBase);
 assert.equal(b.c.obConfirmedJoin(read.baseData.obAbsorbedConfirmed,[],'synthetic').length,0);
 const confirmed=b.c.obConfirmedAck(b.c.state,b.c.state.obAbsorbedPending[0],'synthetic');
 assert.equal(confirmed.length,1);assert.equal(b.c.obConfirmedRead('synthetic').length,1);
 const jobs=pendingWrites(b),sent=b.c.send('synthetic',b.c.state);
 assert.equal(b.writes.length,1);assert.equal(b.writes[0].revision,'r-known');
 assert.equal(b.c.obStateCanonical(remoteBase),remoteBefore);assert.equal(b.c.obConfirmedRead('synthetic').length,1);
 jobs[0]({updated_at:'r-confirmed'});await sent;b.flush();assert.equal(b.c.cloudUpdatedAtRef.current,'r-confirmed');assert.equal(b.acks(),1);
});

test('R4: X a Y a X conserva el CAS de la reversión mientras el envío anterior está pendiente',async()=>{
 const b=await readBackBank(),x=b.c.state.budget,jobs=pendingWrites(b);
 budgetEdit(b,x+1);const first=b.c.send('synthetic',b.c.state);
 budgetEdit(b,x);const second=b.c.send('synthetic',b.c.state);
 assert.equal(b.writes.length,2);assert.deepEqual(b.writes.map(w=>w.s.budget),[x+1,x]);assert.deepEqual(b.writes.map(w=>w.revision),['r-known','r-known']);
 jobs[0]({updated_at:'r-y'});await first;jobs[1]({conflict:true});assert.equal((await second).conflict,true);b.flush();
 assert.equal(b.c.state.budget,x);assert.equal(b.c.cloudUpdatedAtRef.current,'r-y');assert.equal(b.acks(),1);
});

test('R4: un envío de una lectura reemplazada sigue impidiendo omitir la reversión humana',async()=>{
 const b=await readBackBank(),x=b.c.state.budget,remote=JSON.parse(JSON.stringify(b.c.state)),oldRead=b.c.cloudReadRef.current,jobs=pendingWrites(b);
 budgetEdit(b,x+1);const first=b.c.send('synthetic',b.c.state),refresh=b.start();
 b.reply({data:remote,updated_at:'r-refreshed'});await ticks();b.flush();await refresh;
 assert.notEqual(b.c.cloudReadRef.current,oldRead);budgetEdit(b,x);const second=b.c.send('synthetic',b.c.state);
 assert.equal(b.writes.length,2);assert.equal(b.writes[1].s.budget,x);assert.equal(b.writes[1].revision,'r-refreshed');
 jobs[0]({updated_at:'r-old-write'});assert.equal(await first,null);assert.equal(b.c.cloudUpdatedAtRef.current,'r-refreshed');assert.equal(b.acks(),0);
 jobs[1]({conflict:true});assert.equal((await second).conflict,true);b.flush();assert.equal(b.c.state.budget,x);assert.equal(b.acks(),0);
});

test('R4: dinero y contenido desconocido cambiados mantienen el CAS y el aviso de conflicto',async()=>{
 for(const kind of ['money','unknown']){
  const b=await readBackBank(),notices=[],refreshes=[];
  b.c.set(s=>kind==='money'?Object.assign({},s,{fixed:[Object.assign({},s.fixed[0],{amount:42.38})]}):Object.assign({},s,{unknown:{keep:['nuevo',17],nested:{amountCents:4237}}}));b.flush();
  b.c.cloud.pushState=async(u,s,revision)=>{b.writes.push({u,s,revision});return {conflict:true};};
  Object.assign(b.c,{pushAppState:b.c.send,showToast:m=>notices.push(m),t:k=>k,syncFromCloud:s=>{refreshes.push(s);return Promise.resolve();}});
  // Ejecuta el callback real del debounce: el conflicto debe llegar al aviso y a la relectura.
  const effect=app.indexOf('// Empuja el estado a la nube (debounced)'),a=app.indexOf('tmr=setTimeout(function(){',effect)+'tmr=setTimeout(function(){'.length,z=app.indexOf('}, 1200);',a);
  const names=['uid','stateRef','sessionRef','obAbsorbedWriteBlocked','pushAppState','showToast','t','syncFromCloud'];
  vm.runInContext('(function('+names.join(',')+'){let tmr;'+app.slice(a,z)+'})',b.c)(...names.map(k=>b.c[k]));await ticks();
  assert.equal(b.writes.length,1,kind);assert.equal(b.writes[0].revision,'r-known');assert.deepEqual(notices,['st_sync_conflict']);assert.equal(refreshes.length,1);
  assert.equal(Math.round(b.writes[0].s.fixed[0].amount*100),kind==='money'?4238:4237);assert.equal(Math.round(b.writes[0].s.debts[0].value*100),120023);
  if(kind==='unknown')assert.equal(JSON.stringify(b.writes[0].s.unknown),JSON.stringify({keep:['nuevo',17],nested:{amountCents:4237}}));
 }
});
