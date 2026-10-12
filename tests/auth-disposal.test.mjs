import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {authFragments,authWorld} from './helpers/auth-disposal-fixture.mjs';
import {betaRevision} from '../scripts/beta-revisions.mjs';
import {scopeText} from '../scripts/beta-source-code.mjs';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8').replace(/\r\n/g,'\n');
// El contrato histórico106 no puede exigir que su nota y todos los lectores sigan siendo los últimos.
const historyCache=new Map(),history106=f=>{if(!historyCache.has(f))historyCache.set(f,execFileSync('git',['show','8dcc5ed39b6e212ba1e34a90b550685794ce0bd5:'+f],{encoding:'utf8',maxBuffer:8e6}));return historyCache.get(f);};
const core=read('src/modules/00-core.js'),app=read('src/modules/11-app-main.js'),parts=authFragments(core,app);
const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
const s=id=>({user:{id}});
const count=(w,t)=>w.trace.filter(x=>x.type===t).length;
// Cada disposal cancela el transporte. Un callback retenido por el transporte queda inerte.
const repeated=authWorld(parts);
for(let i=0;i<6;i++){const off=repeated.mount();off();}
const activeOff=repeated.mount();assert.equal(repeated.live.size,1);assert.equal(repeated.removed,6);
repeated.event('SIGNED_IN',s('active'),true);assert.equal(count(repeated,'session'),1);assert.equal(count(repeated,'sync'),1);
activeOff();const n=repeated.trace.length;repeated.event('PASSWORD_RECOVERY',s('late'),true);repeated.event('SIGNED_OUT',null,true);assert.equal(repeated.trace.length,n);assert.equal(repeated.timers.size,0);
for(const outcome of ['resolve','reject']){const w=authWorld(parts),off=w.mount(),timer=[...w.timers.values()][0];off();w.sessions[0][outcome](outcome==='resolve'?s('late'):Error('synthetic'));await flush();timer();w.idle();assert.equal(w.trace.length,0);}
{const w=authWorld(parts),off=w.mount();w.sessions[0].resolve(s('A'));await flush();assert.equal(count(w,'session'),1);assert.equal(w.idles.length,1);off();w.idle();assert.equal(count(w,'sync'),0);}
// Controles activos: preservan identidad y las opciones de cambio de titular.
{const w=authWorld(parts),off=w.mount();w.sessions[0].resolve(s('A'));await flush();w.idle();assert.equal(count(w,'sync'),1);
w.event('TOKEN_REFRESHED',s('A'));w.event('INITIAL_SESSION',s('A'));assert.equal(count(w,'sync'),1);
w.event('SIGNED_IN',s('B'));assert.deepEqual(w.trace.at(-1),{type:'sync',uid:'B',opts:{freshLogin:true,dropTx:true}});
w.event('SIGNED_OUT',null);assert.deepEqual(w.trace.at(-1),{type:'state',bankTx:[]});
w.event('PASSWORD_RECOVERY',s('B'));assert.equal(count(w,'recovery'),1);assert.equal(count(w,'showAuth'),1);assert.equal(w.env.sessionRef.current.user.id,'B');off();}
{const w=authWorld(parts);w.mount();w.sessions[0].resolve(null);await flush();assert.equal(count(w,'boot'),1);w.event('SIGNED_IN',s('A'));assert.deepEqual(w.trace.at(-1).opts,{freshLogin:true,dropTx:false});}
{const w=authWorld(parts,{offline:true});w.mount();assert.equal(count(w,'boot'),1);w.fireTimers();assert.equal(count(w,'boot'),2);}
{const w=authWorld(parts,{enabled:false});w.mount()();assert.equal(count(w,'boot'),1);assert.equal(w.live.size,0);assert.equal(w.sessions.length,0);assert.doesNotThrow(()=>w.env.cloud.onAuth(()=>{})());}
// Rojo sobre la fuente exacta anterior: siete suscripciones y continuación tras desmontar.
const old=f=>execFileSync('git',['show','77b7d5e4d6188ec08c7aea0a598c741bb3025d13:'+f],{encoding:'utf8',maxBuffer:8e6});
const red=authWorld(authFragments(old('src/modules/00-core.js'),old('src/modules/11-app-main.js')));
for(let i=0;i<6;i++)red.mount()();red.mount();assert.equal(red.live.size,7);red.event('SIGNED_IN',s('red'));assert.equal(count(red,'sync'),7);red.sessions[0].resolve(s('late'));await flush();red.idle();assert.equal(count(red,'sync'),8);
// El alcance nuevo identifica las dos partes y sus guards; las revisiones anteriores no se repinan.
const id='inc-0710-auth-disposal',rev=betaRevision(id,read).codigo;
for(const [file,a,b]of [
['src/modules/00-core.js','sub.data.subscription.unsubscribe();','void 0;'],
['src/modules/11-app-main.js','alive=false;','alive=true;'],
['src/modules/11-app-main.js','alive=false; clearTimeout(tmr); off();','alive=false; off();'],
['src/modules/11-app-main.js','tmr=setTimeout(boot, 2500)','tmr=setTimeout(mcBootReady, 2500)'],
['src/modules/11-app-main.js','clearTimeout(tmr);\n      if(!alive) return;','clearTimeout(tmr);'],
['src/modules/11-app-main.js','()=>{ clearTimeout(tmr); boot(); });','()=>{ clearTimeout(tmr); mcBootReady(); });'],
['src/modules/11-app-main.js','if(alive) syncFromCloud(s);','syncFromCloud(s);'],
['src/modules/11-app-main.js','const off=cloud.onAuth((s,ev)=>{\n      if(!alive) return;','const off=cloud.onAuth((s,ev)=>{']]){
 assert.ok(read(file).includes(a),'mutante toca fragmento exacto '+a);
 assert.notEqual(betaRevision(id,f=>f===file?read(f).replace(a,b):read(f)).codigo,rev,a);
 const mutant=authFragments(file==='src/modules/00-core.js'?core.replace(a,b):core,file==='src/modules/11-app-main.js'?app.replace(a,b):app);
 const w=authWorld(mutant),off=w.mount(),timer=[...w.timers.values()][0];
 if(a.includes('alive=false; clearTimeout')){off();assert.equal(w.timers.size,1,'mutante cleanup conserva timer');}
 else if(a==='sub.data.subscription.unsubscribe();'){off();assert.equal(w.live.size,1,'mutante transporte no se libera');}
 else if(a.includes('if(alive) syncFromCloud')){w.sessions[0].resolve(s('late'));await flush();off();const n=w.trace.length;w.idle();assert.ok(w.trace.length>n,'mutante idle actúa tras cleanup');}
 else if(a.includes('2500')){off();timer();assert.equal(count(w,'boot'),1,'mutante timer actúa tras cleanup');}
 else if(a.includes('const off')){off();w.event('PASSWORD_RECOVERY',s('late'),true);assert.ok(count(w,'session')>0,'mutante callback actúa tras cleanup');}
 else if(a.includes('clearTimeout(tmr); boot(); });')){off();w.sessions[0].reject(Error('synthetic'));await flush();assert.equal(count(w,'boot'),1,'mutante rechazo actúa tras cleanup');}
 else {off();w.sessions[0].resolve(s('late'));await flush();w.idle();assert.ok(w.trace.length>0,'mutante continuación actúa tras cleanup');}

}
const oldReg=JSON.parse(old('scripts/beta-sources.json')),historicalReg=JSON.parse(history106('scripts/beta-sources.json')),currentReg=JSON.parse(read('scripts/beta-sources.json'));
// La candidata106 conserva todos los alcances, auditorías y códigos anteriores.
for(const [key,scope]of Object.entries(oldReg)){
 assert.deepEqual(historicalReg[key],scope,key+': alcance y auditoría históricos intactos');
 assert.deepEqual(betaRevision(key,history106,undefined,scope),betaRevision(key,old,undefined,scope),key);
}
assert.deepEqual(currentReg[id],{...historicalReg[id],web:historicalReg[id].web.concat({file:'src/modules/00-core.js',function:'mergeAccountBalanceHistory'})},'contrato106 completo más la dependencia nueva del escritor de historial');
// Partir el historial cambia los lectores/escritores compartidos, aunque no cambie auth.
// No se hereda el OK106: se acredita por separado el contrato auth y el cambio de identidad.
assert.deepEqual(parts,authFragments(history106('src/modules/00-core.js'),history106('src/modules/11-app-main.js')));
const storage=['mcLoadRaw','mcSaveRaw','mcResetSandbox'],file='src/modules/00-core.js';
let previousStorage=core;
for(const name of storage)previousStorage=previousStorage.replace(scopeText({file,function:name},read),scopeText({file,function:name},history106));
assert.deepEqual(betaRevision(id,f=>f===file?previousStorage:read(f),undefined,historicalReg[id]),betaRevision(id,history106,undefined,historicalReg[id]),'sólo la persistencia cambia la identidad auth; resto del contrato106 intacto');
assert.notEqual(betaRevision(id,read).codigo,betaRevision(id,history106,undefined,historicalReg[id]).codigo,'persistencia y su unión nueva exigen revisión, nunca aprobación106');
console.log('✓ auth disposal: remount, callbacks/promesas/timer/idle tardíos, controles activos, rojo anterior; '+Object.keys(oldReg).length+' revisiones anteriores intactas');

const memoReg=currentReg['inc-0810-dashboard-recents-memo'];for(const key of ['historial','auditoria','codigosCompatibles','compatibilidadGit'])assert.equal(memoReg[key],undefined,'memo nueva sin heredar '+key);
const memoNote=JSON.parse(history106('src/data/release-notes.json'))[0].tandas.find(g=>g.id==='inc-0810-dashboard-recents-memo');
for(const key of ['codigoDesde','revisionesDesde','codigosCompatibles','compatibilidadGit','verdict'])assert.equal(memoNote[key],undefined,'memo nueva sin heredar '+key);

// La promoción conserva también los controles107/108/110/113 de main en su fuente exacta,
// y fija el registro actual aprobado117 completo: ningún alcance nuevo entra por copia de HEAD.
{
const mainCache=new Map(),mainRead=f=>{if(!mainCache.has(f))mainCache.set(f,execFileSync('git',['show','b2dfd2c01d7ec6a9a30b74ae71d473054932c42f:'+f],{encoding:'utf8',maxBuffer:8e6}));return mainCache.get(f);};
const reg=JSON.parse(mainRead('scripts/beta-sources.json'));
const oldReg=JSON.parse(execFileSync('git',['show','56c7e328ce801f0e2e2fe5ec1ebd36169f0ac89b:scripts/beta-sources.json'],{encoding:'utf8',maxBuffer:8e6})),currentReg=JSON.parse(mainRead('scripts/beta-sources.json'));
// 107/108/110 cambian dependencias compartidas: sólo añadimos los cierres revisados, sin repinar auditorías ni heredar aprobaciones.
for(const [key,scope]of Object.entries(oldReg)){
 const expected=structuredClone(scope);
 if(['inc-0210-03-gastos-periodo','feature-0310-01-movilidad','inc-0310-gastos-sin-limite'].includes(key))expected.web.push({file:'src/modules/08-motor-bank.js',function:'madridYmdParts'},{file:'src/modules/08-motor-bank.js',data:'_mcMadridYmdFmt'});
 if(key==='inc-0310-01-meta-regla')expected.web.push(...['reservaRuleSame','editReservaRule'].map(name=>({file:'src/modules/08-motor-bank.js',function:name})));
 if(key==='inc-0310-broker-resultados'){
  const at=expected.web.findIndex(s=>s.file==='src/modules/02-ui-shared.js'&&s.data==='_mcBackStack');assert.ok(at>=0,'ancla histórica del controlador');
  expected.web.splice(at,0,
   ...['_mcBackSlot','_mcBackSame','_mcBackSchedule','_mcBackAdd','_mcBackDrop','_mcBackArm','_mcBackConsume','_mcBackFlush'].map(name=>({file:'src/modules/02-ui-shared.js',function:name})),
   ...['_mcBackHistory','_mcBackPending','_mcBackAt','_mcBackScheduled','_mcBackTurn','_mcBackNext','_mcBackOwner'].map(name=>({file:'src/modules/02-ui-shared.js',data:name})));
 }
 assert.deepEqual(currentReg[key],expected,key+': alcance histórico conservado salvo cierres Madrid99/108/110 explícitos');
}
const approved=f=>execFileSync('git',['show','8dcc5ed39b6e212ba1e34a90b550685794ce0bd5:'+f],{encoding:'utf8',maxBuffer:8e6});
assert.deepEqual(betaRevision('inc-0710-auth-disposal',mainRead,undefined,reg['inc-0710-auth-disposal']),betaRevision('inc-0710-auth-disposal',approved,undefined,JSON.parse(approved('scripts/beta-sources.json'))['inc-0710-auth-disposal']),'identidad auth exacta aprobada en106');
console.log('✓ auth disposal: remount, callbacks/promesas/timer/idle tardíos, controles activos, rojo anterior; '+Object.keys(oldReg).length+' descriptores históricos conservados salvo cierres Madrid99/108/110 explícitos');

const memoReg=currentReg['inc-0810-dashboard-recents-memo'];for(const key of ['historial','auditoria','codigosCompatibles','compatibilidadGit'])assert.equal(memoReg[key],undefined,'memo nueva sin heredar '+key);
const memoNote=JSON.parse(execFileSync('git',['show','8dcc5ed39b6e212ba1e34a90b550685794ce0bd5:src/data/release-notes.json'],{encoding:'utf8',maxBuffer:8e6}))[0].tandas.find(g=>g.id==='inc-0810-dashboard-recents-memo');
for(const key of ['codigoDesde','revisionesDesde','codigosCompatibles','compatibilidadGit','verdict'])assert.equal(memoNote[key],undefined,'memo nueva sin heredar '+key);

}
assert.equal(createHash('sha256').update(JSON.stringify(JSON.parse(execFileSync('git',['show','788432f4682c199edd785f6973d9353330c0064a:scripts/beta-sources.json'],{encoding:'utf8',maxBuffer:8e6})))).digest('hex'),'aa9cb034a46f2a3dd04b9e3585d7474fac8cbe8c7aa933e7bb57bcebe0cd296d','registro119 íntegro: el de la beta118 (2d4f62d4) más el acuse local de bancos en dos alcances y la tanda bancos-acuse-reconexion; Catálogo119 de beta-sources lo fija unidad a unidad');
