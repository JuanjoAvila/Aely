import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {authFragments,authWorld} from './helpers/auth-disposal-fixture.mjs';
import {scopeDependencies,scopeDataDependencies,mutateLogic,mutateData} from '../scripts/beta-source-code.mjs';
import {betaRevision} from '../scripts/beta-revisions.mjs';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const old=f=>execFileSync('git',['show','9881214ebe93864e2d7570f62094ec785be81163:'+f],{encoding:'utf8',maxBuffer:8e6});
const core=read('src/modules/00-core.js'),app=read('src/modules/11-app-main.js');
const parts=authFragments(core,app),before=authFragments(old('src/modules/00-core.js'),old('src/modules/11-app-main.js'));
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
const session=id=>({user:{id}});
// Ningún callback convertido usa this/arguments/new.target ni devuelve el retorno del consumidor.
for(const p of [before,parts]){
 let callback,removed=0;
 const sub={unsubscribe(){assert.equal(this,sub);removed++;}};
 const client={auth:{onAuthStateChange(cb){callback=cb;return {data:{subscription:sub}};}}};
 const c=new Function('sb','return {'+p.method+'};')(client),calls=[];
 const off=c.onAuth((s,ev)=>{calls.push([s,ev]);return Promise.resolve('ignored');});
 assert.equal(callback.call({syntheticReceiver:true},'INITIAL_SESSION',session('A')),undefined);
 assert.deepEqual(calls,[[session('A'),'INITIAL_SESSION']]);assert.equal(off(),undefined);assert.equal(removed,1);
 const failure=Error('registration');client.auth.onAuthStateChange=()=>{throw failure;};assert.throws(()=>c.onAuth(()=>{}),e=>e===failure);
 const bad={get data(){throw failure;}},lazy=new Function('sb','return {'+p.method+'};')({auth:{onAuthStateChange(){return bad;}}});
 const cleanup=lazy.onAuth(()=>{});assert.throws(()=>cleanup(),e=>e===failure); // lectura de data sigue diferida
}
// mcBootReady REAL es void y contiene todas sus operaciones dentro de try/catch.
const a=core.indexOf('function mcBootReady(){'),b=core.indexOf('/* EJE DE UN GESTO:',a),bootSource=core.slice(a,b);
const bootFor=window=>new Function('window','Event',bootSource+'; return mcBootReady;')(window,Event);
const failure=Error('synthetic boot');
const getter={get __mcBootReady(){throw failure;}},setter={get __mcBootReady(){return false;},set __mcBootReady(v){throw failure;}};
for(const w of [getter,setter,{dispatchEvent(){throw failure;}},{__mcBootReady:true}])assert.equal(bootFor(w)(),undefined);
let emitted=0;const window={dispatchEvent(e){assert.equal(e.type,'mc-boot-ready');emitted++;}},ready=bootFor(window);assert.equal(ready(),undefined);ready();assert.equal(emitted,1);
// Compara trazas y referencias de la representación anterior y la compacta, con sesiones planas SDK.
async function run(p,{offline=false,navThrows=false,disposed=false,result='A',reject=false}={}){
 const w=authWorld(p,{offline});if(navThrows)Object.defineProperty(w.env.navigator,'onLine',{get(){throw failure;}});
 const off=w.mount();if(disposed)off();w.sessions[0][reject?'reject':'resolve'](reject?failure:result===null?null:session(result));await flush();w.idle();w.fireTimers();
 for(const [ev,s]of [['INITIAL_SESSION',session('A')],['TOKEN_REFRESHED',session('A')],['SIGNED_IN',session('B')],['SIGNED_OUT',null],['PASSWORD_RECOVERY',session('B')]])w.event(ev,s,true);
 off();return {trace:w.trace,ref:w.env.sessionRef.current,removed:w.removed,timers:w.timers.size,live:w.live.size};
}
for(const cfg of [{},{offline:true},{navThrows:true},{disposed:true},{disposed:true,reject:true},{reject:true},{result:null}])assert.deepEqual(await run(parts,cfg),await run(before,cfg),JSON.stringify(cfg));
const reader=f=>read(f),scope=JSON.parse(read('scripts/beta-sources.json'))['inc-0710-auth-disposal'],revision=betaRevision('inc-0710-auth-disposal',reader).web;
let fns=0,data=0;for(const f of scopeDependencies(scope,reader)){assert.notEqual(betaRevision('inc-0710-auth-disposal',x=>x===f.file?mutateLogic(read(x),f):read(x)).web,revision,f.name);fns++;}
for(const d of scopeDataDependencies(scope,reader)){assert.notEqual(betaRevision('inc-0710-auth-disposal',x=>x===d.file?mutateData(read(x),d):read(x)).web,revision,d.name);data++;}
assert.equal(fns,7);assert.equal(data,9);
const notes=JSON.parse(execFileSync('git',['show','8dcc5ed39b6e212ba1e34a90b550685794ce0bd5:src/data/release-notes.json'],{encoding:'utf8',maxBuffer:8e6})),oldNotes=JSON.parse(old('src/data/release-notes.json'));
// La unidad106 añade una sola nota y alcance; el histórico102 conserva todos sus datos.
assert.equal(notes[0].v,'4.26.106');assert.deepEqual(notes[0].tandas.map(g=>g.id),['inc-0810-dashboard-recents-memo']);
assert.deepEqual(notes.slice(1),oldNotes);
const reg=JSON.parse(read('scripts/beta-sources.json')),oldReg=JSON.parse(execFileSync('git',['show','56c7e328ce801f0e2e2fe5ec1ebd36169f0ac89b:scripts/beta-sources.json'],{encoding:'utf8',maxBuffer:8e6}));
const expectedReg=structuredClone(oldReg);
for(const id of ['inc-0210-03-gastos-periodo','feature-0310-01-movilidad','inc-0310-gastos-sin-limite'])expectedReg[id].web.push({file:'src/modules/08-motor-bank.js',function:'madridYmdParts'},{file:'src/modules/08-motor-bank.js',data:'_mcMadridYmdFmt'});
// El registro anterior y los tres alcances nuevos se anclan a commits fijos; nunca copiamos expectativas del registro bajo prueba.
const mainReg=JSON.parse(execFileSync('git',['show','798226ce2ddcc506c3f0768a5daf9619eff97e15:scripts/beta-sources.json'],{encoding:'utf8',maxBuffer:8e6}));
for(const id of ['inc-0710-gastos-mes-madrid','inc-0710-appstate-listener-cleanup','inc-0710-banknotif-cleanup','inc-0710-auth-disposal','inc-0810-dashboard-recents-memo'])expectedReg[id]=mainReg[id];
for(const key of ['inc-0310-01-meta-regla','inc-0310-broker-resultados']){
 const expected=expectedReg[key];
 if(key==='inc-0310-01-meta-regla')expected.web.push(...['reservaRuleSame','editReservaRule'].map(name=>({file:'src/modules/08-motor-bank.js',function:name})));
 if(key==='inc-0310-broker-resultados'){
  const at=expected.web.findIndex(s=>s.file==='src/modules/02-ui-shared.js'&&s.data==='_mcBackStack');assert.ok(at>=0,'ancla histórica del controlador');
  expected.web.splice(at,0,
   ...['_mcBackSlot','_mcBackSame','_mcBackSchedule','_mcBackAdd','_mcBackDrop','_mcBackArm','_mcBackConsume','_mcBackFlush'].map(name=>({file:'src/modules/02-ui-shared.js',function:name})),
   ...['_mcBackHistory','_mcBackPending','_mcBackAt','_mcBackScheduled','_mcBackTurn','_mcBackNext','_mcBackOwner'].map(name=>({file:'src/modules/02-ui-shared.js',data:name})));
 }
}
const selected=f=>execFileSync('git',['show','c7593e86f6665d69fa20bd3f5f8f20c4710a5d9c:'+f],{encoding:'utf8',maxBuffer:8e6}),selectedReg=JSON.parse(selected('scripts/beta-sources.json'));
for(const [id,codigo,web]of [
 ['inc-0810-nav-indicator','8b644a448f776abfcc21e55bd8acf8847aad84a9f75a5bdb83b4a25d4cd933d5','dedbc947435fa355ba649412debdd8db9088a0a3ecaa2882fb4b99c6b39b373d'],
 ['inc-0810-metas-editar-regla','d2b3e32be047450e3467da377120e721a8db89d09230d17ea15d54afc32dbe1d','84c832707f16ecbe5099f9dc889bae4ae81bccc7269d1cb49685add3bb16e975'],
 ['inc-0810-backclose-handover','a14e101c0e2ce2e8a778e26df1e342bff2e417e5037c6def254a41696e441aed','05048c3b8ea28237cefc7a17baa5d5c33e2d033e04b2b87efbb429e9d347c089'],
]){
 expectedReg[id]=selectedReg[id];
 assert.deepEqual(betaRevision(id,reader),{web,codigo},id+': identidad web aprobada exacta, sin native/edge');
 assert.deepEqual(betaRevision(id,selected,undefined,selectedReg[id]),{web,codigo},id+': ancla beta fija aprobada');
 for(const key of ['historial','auditoria','codigosCompatibles','compatibilidadGit'])assert.equal(reg[id][key],undefined,id+': sin aprobación heredada '+key);
}
// Promoción selectiva 113 (10/10): entran Bienes completo y la gráfica de Inicio, y Recientes106 se reancla porque
// Inicio retira su delimitador. Se fijan por huella del descriptor de beta 684a839d, que no es ancestro de main y
// por eso no se puede leer con git show en la CI; cualquier otro alcance nuevo sigue rompiendo el deepEqual.
for(const [id,sha]of [
 ['inc-0810-dashboard-recents-memo','a5e117f636ed55239be6e67746db29c93b83abd6121fd97d441d23d716c872a4'],
 ['bienes-completo','e2d7b262bd967d217c05b733b323b6e3b8a35834307835ee5b4f2500494fa487'],
 ['inicio-grafica-vuelve','1ada700abc839b674a069d681a2324c5688c623e9e802964863fee166c1f2e9a'],
]){assert.equal(createHash('sha256').update(JSON.stringify(reg[id])).digest('hex'),sha,id+': descriptor exacto de beta113');expectedReg[id]=reg[id];}
assert.deepEqual(reg,expectedReg,'sólo los alcances nuevos 107/108/110 y los dos de la 113; cierres históricos explícitos y resto del registro intacto');
// Los tres cambios históricos son dependencias de lo aprobado, no tandas adicionales ni reutilización del OK antiguo.
for(const [id,codigo,web]of [
 ['inc-0310-01-meta-regla','9d7b6a271c9bd35c5db3639f5b679f6eb7f904c94429aa279a2793e0d89a8981','74a3f1fadd6c79f870bc3fbe27008065f6950e1dab0644be8dfa14475f8300aa'],
 ['inc-0310-broker-resultados','027baca86c47ba94e97a63ef8efe6a28eb7245f5f23dacad8423821cece278a8','8149f3d99d8be6aad6de5811f3aa0f737cd847cd5cc1b5353ecad394ee5c48ce'],
 ['inc-2709-13-fab-contorno','7d83273ce4d3cedc0980a5b89452594bba8d91c0e48211f853ede13e80c0f45b','78fbc4dc2e857c7a7a513ecb9f302feeaaf6f56ed47fb3030f26f3fdfbcd128c'],
]){
 const current=betaRevision(id,reader),previous=betaRevision(id,f=>execFileSync('git',['show','798226ce2ddcc506c3f0768a5daf9619eff97e15:'+f],{encoding:'utf8',maxBuffer:8e6}),undefined,mainReg[id]);
 assert.deepEqual(current,{web,codigo},id+': cierre compartido revisado exacto');assert.notEqual(current.codigo,previous.codigo,id+': no heredar identidad anterior');
}
assert.equal(reg['inc-0810-dashboard-recents-memo'].web.length,19);
assert.equal(reg['inc-0810-dashboard-recents-memo'].unidades,true);
for(const key of ['historial','auditoria','codigosCompatibles','compatibilidadGit'])assert.equal(reg['inc-0810-dashboard-recents-memo'][key],undefined,'sin heredar '+key);
assert.notEqual(betaRevision('inc-0710-auth-disposal',reader).codigo,betaRevision('inc-0710-auth-disposal',old).codigo);
console.log('✓ fit102: retornos/receiver/excepciones diferidas, boot real sin throw, trazas equivalentes;7funciones/9datos, notas históricas106 intactas y registro con cierres107/108/110 explícitos; identidad102 nueva');
