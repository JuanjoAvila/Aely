import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {authFragments,authWorld} from './helpers/auth-disposal-fixture.mjs';
import {scopeDependencies,scopeDataDependencies,mutateLogic,mutateData} from '../scripts/beta-source-code.mjs';
import {betaRevision} from '../scripts/beta-revisions.mjs';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8').replace(/\r\n/g,'\n');
// La conservación de106 se prueba en su fuente exacta; las unidades posteriores tienen guardas propias.
const historyCache=new Map(),history106=f=>{if(!historyCache.has(f))historyCache.set(f,execFileSync('git',['show','8dcc5ed39b6e212ba1e34a90b550685794ce0bd5:'+f],{encoding:'utf8',maxBuffer:8e6}));return historyCache.get(f);};
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
const notes=JSON.parse(history106('src/data/release-notes.json')),oldNotes=JSON.parse(old('src/data/release-notes.json'));
// La unidad106 añade una sola nota y alcance; el histórico102 conserva todos sus datos.
assert.equal(notes[0].v,'4.26.106');assert.deepEqual(notes[0].tandas.map(g=>g.id),['inc-0810-dashboard-recents-memo']);
assert.deepEqual(notes.slice(1),oldNotes);
const reg=JSON.parse(history106('scripts/beta-sources.json')),oldReg=JSON.parse(old('scripts/beta-sources.json'));
const expectedReg=structuredClone(oldReg);
expectedReg['inc-0810-dashboard-recents-memo']=reg['inc-0810-dashboard-recents-memo'];
assert.deepEqual(reg,expectedReg,'solo alcance nuevo de106; todos los alcances y auditorías anteriores intactos');
assert.equal(reg['inc-0810-dashboard-recents-memo'].web.length,19);
assert.equal(reg['inc-0810-dashboard-recents-memo'].unidades,true);
for(const key of ['historial','auditoria','codigosCompatibles','compatibilidadGit'])assert.equal(reg['inc-0810-dashboard-recents-memo'][key],undefined,'sin heredar '+key);
assert.notEqual(betaRevision('inc-0710-auth-disposal',reader).codigo,betaRevision('inc-0710-auth-disposal',old).codigo);
console.log('✓ fit102: retornos/receiver/excepciones diferidas, boot real sin throw, trazas equivalentes;7funciones/9datos e histórico de notas/registro intacto salvo unidad106 declarada; identidad102 nueva');
