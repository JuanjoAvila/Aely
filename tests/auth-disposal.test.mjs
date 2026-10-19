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
// La 135 (compras idénticas) hace que la fusión de gastos con la nube llame a `cloud.deleteExpense`/`cloud.logEvent` y a funciones nuevas: el cierre de lectores las suma al final y a los miembros de `cloud`.
const compras135=[{"file":"src/modules/08-motor-bank.js","function":"obPendingAbsorbedState"},{"file":"src/modules/00-core.js","function":"obAbsorptionKey"},{"file":"src/modules/08-motor-bank.js","function":"obPendingGroup"},{"file":"src/modules/08-motor-bank.js","function":"obIsPending"},{"file":"src/modules/00-core.js","function":"lapidaPon"},{"file":"src/modules/00-core.js","function":"borrarGastoNube"},{"file":"src/modules/00-core.js","function":"lapidasTope"},{"file":"src/modules/00-core.js","function":"pushDeleted"},{"file":"src/modules/00-core.js","function":"_errCloudMsg"},{"file":"src/modules/00-core.js","data":"DELETED_AT_MAX"},{"file":"src/modules/00-core.js","data":"DELETED_MAX"},{"file":"src/modules/00-core.js","function":"expenseCloudEq"},{"file":"src/modules/00-core.js","function":"mcLogEvent"},{"file":"src/modules/00-core.js","function":"expenseCloudKeys"},{"file":"src/modules/00-core.js","function":"isExpenseUuid"},{"file":"src/modules/00-core.js","data":"USO_OK"},{"file":"src/modules/00-core.js","data":"GASTO_ORIGENES"}];
// La 130 (emparejado automático de Trade Republic) mete `reconcileGemelosAutomaticos` en el `set` de App, que este alcance vigila: entra con su cierre de lectores.
const emparejadoAuto130=[{"file":"src/modules/08-motor-bank.js","function":"reconcileGemelosAutomaticos"},{"file":"src/modules/08-motor-bank.js","function":"gemeloMismosCampos"},{"file":"src/modules/08-motor-bank.js","function":"gemeloDatos"},{"file":"src/modules/00-core.js","function":"expenseBankOf"},{"file":"src/modules/08-motor-bank.js","function":"gemeloCompatible"},{"file":"src/modules/00-core.js","function":"gemeloDe"},{"file":"src/modules/00-core.js","function":"pushGemelos"},{"file":"src/modules/01-i18n.js","function":"expenseDeletedSet"},{"file":"src/modules/00-core.js","function":"expenseIsTombstoned"},{"file":"src/modules/00-core.js","function":"gemeloAvisoKey"},{"file":"src/modules/08-motor-bank.js","function":"gemeloBancoAutomatico"},{"file":"src/modules/00-core.js","function":"keyOfExpense"},{"file":"src/modules/00-core.js","function":"isManualExpenseSource"},{"file":"src/modules/08-motor-bank.js","function":"gemeloAvisoAutomatico"},{"file":"src/modules/08-motor-bank.js","function":"sinComercioReal"},{"file":"src/modules/01-i18n.js","function":"dateMs"},{"file":"src/modules/08-motor-bank.js","function":"gemeloAsignar"},{"file":"src/modules/08-motor-bank.js","function":"madridYmdParts"},{"file":"src/modules/00-core.js","function":"partirEntDeuda"},{"file":"src/modules/00-core.js","function":"keyOfExpenseLegacy"},{"file":"src/modules/00-core.js","function":"esFilaDeBanco"},{"file":"src/modules/00-core.js","function":"obOrdinalSufijo"},{"file":"src/modules/01-i18n.js","function":"_pdMs"},{"file":"src/modules/00-core.js","function":"obOrdinalOf"},{"file":"src/modules/08-motor-bank.js","data":"gemeloCache"},{"file":"src/modules/08-motor-bank.js","data":"DUP_DIAS_MS"},{"file":"src/modules/08-motor-bank.js","data":"gemeloDatosCache"},{"file":"src/modules/08-motor-bank.js","data":"gemeloDiasCache"},{"file":"src/modules/00-core.js","data":"GEMELOS_MAX"},{"file":"src/modules/01-i18n.js","data":"expenseDeletedSets"},{"file":"src/modules/08-motor-bank.js","data":"_mcMadridYmdFmt"},{"file":"src/modules/01-i18n.js","data":"_pdCache"}];
// La 141 (Metas a tres vías, PR 263; absorción por ranuras, PR 264) hace que el guardado y la absorción llamen a funciones nuevas: el cierre de lectores las suma al final.
const metas141=[{"file":"src/modules/00-core.js","function":"goalSyncClear"},{"file":"src/modules/00-core.js","function":"goalSyncRecords"},{"file":"src/modules/00-core.js","function":"goalSyncStore"},{"file":"src/modules/00-core.js","function":"obAbsorptionMatches"},{"file":"src/modules/00-core.js","function":"mcLoadRaw"},{"file":"src/modules/00-core.js","function":"goalSyncSnapshot"},{"file":"src/modules/00-core.js","function":"goalSyncCopy"},{"file":"src/modules/00-core.js","function":"goalSyncEqual"},{"file":"src/modules/00-core.js","function":"obAbsorptionIndex"},{"file":"src/modules/00-core.js","data":"obAbsorptionIndexes"}];
// La 143 (colas de absorción FIN-17, preferencia BOOK sobre PDNG y signo de referencia, PR 267/271/272) añade al guardado y a la fusión de gastos funciones y datos nuevos: el cierre de lectores las suma al final, en el orden en que se descubren.
const absorcion143=[{"file":"src/modules/00-core.js","function":"obConfirmedStorageKey"},{"file":"src/modules/00-core.js","function":"obConfirmedStorage"},{"file":"src/modules/00-core.js","function":"obAbsorbedClearNotice"},{"file":"src/modules/00-core.js","function":"obAbsorbedSignOut"},{"file":"src/modules/00-core.js","function":"obConfirmedPersist"},{"file":"src/modules/00-core.js","function":"obAbsorbedValid"},{"file":"src/modules/00-core.js","function":"obConfirmedMatches"},{"file":"src/modules/00-core.js","function":"obReferenceKey"},{"file":"src/modules/00-core.js","function":"obAbsorbedEnqueue"},{"file":"src/modules/00-core.js","function":"obPolarity"},{"file":"src/modules/00-core.js","function":"obConfirmedRestore"},{"file":"src/modules/00-core.js","function":"obAbsorbedRestore"},{"file":"src/modules/00-core.js","function":"obAbsorbedNoticeKey"},{"file":"src/modules/00-core.js","function":"obAbsorbedMerge"},{"file":"src/modules/00-core.js","function":"obAbsorbedIdsKey"},{"file":"src/modules/00-core.js","function":"obAbsorbedStorageKey"},{"file":"src/modules/00-core.js","function":"obAbsorbedWarn"},{"file":"src/modules/00-core.js","function":"obConfirmedValid"},{"file":"src/modules/00-core.js","function":"obConfirmedPack"},{"file":"src/modules/00-core.js","function":"obAbsorbedKeyOk"},{"file":"src/modules/00-core.js","function":"obAbsorbedJoin"},{"file":"src/modules/00-core.js","function":"obAbsorbedPersist"},{"file":"src/modules/00-core.js","function":"obConfirmedMerge"},{"file":"src/modules/00-core.js","function":"obAbsorbedDisk"},{"file":"src/modules/00-core.js","function":"obConfirmedHash"},{"file":"src/modules/00-core.js","function":"obConfirmedRead"},{"file":"src/modules/00-core.js","function":"obConfirmedJoin"},{"file":"src/modules/00-core.js","function":"obConfirmedUnpack"},{"file":"src/modules/00-core.js","data":"obConfirmedReadCache"},{"file":"src/modules/00-core.js","data":"obConfirmedBlocked"},{"file":"src/modules/00-core.js","data":"expenseConfirmedSets"},{"file":"src/modules/00-core.js","data":"obAbsorbedNotices"},{"file":"src/modules/00-core.js","data":"OB_CONFIRMED_MAX"},{"file":"src/modules/00-core.js","data":"OB_CONFIRMED_AGE"},{"file":"src/modules/00-core.js","data":"obConfirmedIndexes"},{"file":"src/modules/00-core.js","data":"OB_ABSORBED_MAX"},{"file":"src/modules/00-core.js","data":"obAbsorbedWarnings"},{"file":"src/modules/00-core.js","data":"obAbsorbedRuns"}];
// La 146 (vuelta a primer plano sin tirón) hace que el cierre de sesión olvide la memoria de filas: el cierre de lectores suma al final expenseRowMemoReset, mcSetLecturaNube y sus cuatro datos.
const vuelta146=[{"file":"src/modules/00-core.js","function":"expenseRowMemoReset"},{"file":"src/modules/00-core.js","function":"mcSetLecturaNube"},{"file":"src/modules/00-core.js","data":"_expRowMemo"},{"file":"src/modules/00-core.js","data":"_expRowCtx"},{"file":"src/modules/00-core.js","data":"_mcLecturaNube"},{"file":"src/modules/00-core.js","data":"_mcLecturaNubeCbs"}];
assert.deepEqual(currentReg[id],{...historicalReg[id],web:[{...historicalReg[id].web[0],members:historicalReg[id].web[0].members.concat('deleteExpense','logEvent')},...historicalReg[id].web.slice(1)].concat({file:'src/modules/00-core.js',function:'mergeAccountBalanceHistory'},...emparejadoAuto130,...compras135,...metas141,...absorcion143,...vuelta146)},'contrato106 completo más la dependencia nueva del escritor de historial, el cierre del emparejado automático, el de las compras idénticas (4.26.135), el de Metas a tres vías (4.26.141) y el de las colas de absorción FIN-17 con la preferencia BOOK y el signo de referencia (4.26.143)');
// Partir el historial cambia los lectores/escritores compartidos, aunque no cambie auth.
// No se hereda el OK106: se acredita por separado el contrato auth y el cambio de identidad.
// Metas141 y FIN17 amplían la limpieza al salir. Se fija el bloque exacto; FIN17S prueba además conservación de IDs, ACK y aislamiento entre titulares.
const auth106=authFragments(history106('src/modules/00-core.js'),history106('src/modules/11-app-main.js')),viejoSalida="      if(!s&&ev===\"SIGNED_OUT\") set(p=>Object.assign({},p,{bankTx:[]}));",nuevoSalida="      // Otra cuenta (o ninguna): ni gastos memorizados ni hora de lectura de la anterior.\n      if(login&&prev||!s&&ev===\"SIGNED_OUT\") expenseRowMemoReset();\n      if(!s&&ev===\"SIGNED_OUT\"){\n        // El evento ya trae sesión nula: la partición pertenece a la sesión saliente.\n        const owner=prev&&prev.user&&prev.user.id;\n        if(owner){\n          const key=obConfirmedStorageKey(owner);\n          try{obConfirmedStorage().removeItem(key);}catch(e){}\n          obConfirmedReadCache.delete(key);obConfirmedBlocked.delete(owner);\n          obAbsorbedClearNotice(owner);\n        }\n        if(prev&&prev.user)goalSyncClear(mcStateKey(),prev.user.id);\n        set(p=>{obAbsorbedSignOut(owner,p);return Object.assign({},p,{bankTx:[],_goalSync:null,obAbsorbedPending:[],obAbsorbedConfirmed:[]});});\n      }";
assert.equal(auth106.effect.split(viejoSalida).length,2,'la salida de sesión de la 106 está una sola vez');
const cacheSalida='if(ev==="SIGNED_OUT")statePushCache.clear();';
assert.equal(parts.method.split(cacheSalida).length,2,"FIN17 invalida exactamente una vez su cache al salir");
assert.deepEqual(parts,{method:auth106.method.replace(" cb(s,ev);", " "+cacheSalida+"cb(s,ev);"),effect:auth106.effect.replace(viejoSalida,nuevoSalida)});
const storage=['mcLoadRaw','mcSaveRaw','mcResetSandbox'],file='src/modules/00-core.js';
assert.equal(core.split('  const statePushCache=new Map();\n').length,2,'cache FIN17 declarada una sola vez en cloud');
let previousStorage=core.replace(parts.method,auth106.method).replace('  const statePushCache=new Map();\n','');
for(const name of storage)previousStorage=previousStorage.replace(scopeText({file,function:name},read),scopeText({file,function:name},history106));
const guardado106=historicalReg[id].web.find(u=>u.from&&u.from.includes('INC-0410 guardado')),appFile='src/modules/11-app-main.js';
// El `set` de App (dentro del bloque del guardado) gana en la 130 el emparejado automático: también es persistencia, no auth.
// Se normalizan únicamente las ampliaciones explícitas de Metas/FIN17; el contrato de cancelación y callbacks permanece íntegro.
const previousApp=read(appFile).replace(scopeText(guardado106,read),scopeText(guardado106,history106)).replace(nuevoSalida,viejoSalida);
assert.deepEqual(betaRevision(id,f=>f===file?previousStorage:f===appFile?previousApp:read(f),undefined,historicalReg[id]),betaRevision(id,history106,undefined,historicalReg[id]),'sólo la persistencia (y el emparejado del set) cambia la identidad auth; resto del contrato106 intacto');
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
assert.equal(createHash('sha256').update(JSON.stringify(JSON.parse(read('scripts/beta-sources.json')))).digest('hex'),'8613c6480fb2a08d82b1b9e1a6765741f5417919be7036b761f804869aff3615','registro131 íntegro: el de la beta 4.26.130 (67666d42) más el descriptor nuevo cuenta-parte-mia al final (la parte mía de cada cuenta, su bloque del guardado y su cierre de lectores) y el cierre de lectores que las funciones nuevas exigen a los descriptores de Inicio, de bancos, del emparejado de Trade Republic y de la nómina anticipada; nada se recorta; la 143 suma los descriptores de sus tres tandas y el cierre de lectores de FIN-17, la preferencia BOOK y el signo de referencia; la 144 suma los descriptores de sus tres tandas (vibración, Guardar en Deudas, recibo renombrado) y el cierre de lectores de las pruebas de recibo v2 y del histórico de CaixaBank; la 145 suma los descriptores de la vibración ronda 3 y de Plan por confirmar (PR 281) (rampa, tirón repetido y cursor de la gráfica, y las pruebas de pago de Plan y la ficha); la 146 suma el descriptor de la vuelta sin tirón y las unidades de la memoria de categorías y filas en los alcances que las leen y los vigías de la reserva huérfana del hotfix 142');
