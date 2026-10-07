import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {authFragments,authWorld} from './helpers/auth-disposal-fixture.mjs';
import {betaRevision} from '../scripts/beta-revisions.mjs';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
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
['src/modules/00-core.js','r.data.subscription.unsubscribe();','void 0;'],
['src/modules/11-app-main.js','alive=false;','alive=true;'],
['src/modules/11-app-main.js','alive=false; clearTimeout(sesTope); stopAuth();','alive=false; stopAuth();'],
['src/modules/11-app-main.js','if(alive) mcBootReady(); }, 2500)','mcBootReady(); }, 2500)'],
['src/modules/11-app-main.js','clearTimeout(sesTope);\n      if(!alive) return;','clearTimeout(sesTope);'],
['src/modules/11-app-main.js','if(alive) mcBootReady(); });','mcBootReady(); });'],
['src/modules/11-app-main.js','if(alive) syncFromCloud(s);','syncFromCloud(s);'],
['src/modules/11-app-main.js','const stopAuth=cloud.onAuth(function(s, ev){\n      if(!alive) return;','const stopAuth=cloud.onAuth(function(s, ev){']]){
 assert.ok(read(file).includes(a),'mutante toca fragmento exacto '+a);
 assert.notEqual(betaRevision(id,f=>f===file?read(f).replace(a,b):read(f)).codigo,rev,a);
 const mutant=authFragments(file==='src/modules/00-core.js'?core.replace(a,b):core,file==='src/modules/11-app-main.js'?app.replace(a,b):app);
 const w=authWorld(mutant),off=w.mount(),timer=[...w.timers.values()][0];
 if(a.includes('alive=false; clearTimeout')){off();assert.equal(w.timers.size,1,'mutante cleanup conserva timer');}
 else if(a==='r.data.subscription.unsubscribe();'){off();assert.equal(w.live.size,1,'mutante transporte no se libera');}
 else if(a.includes('if(alive) syncFromCloud')){w.sessions[0].resolve(s('late'));await flush();off();const n=w.trace.length;w.idle();assert.ok(w.trace.length>n,'mutante idle actúa tras cleanup');}
 else if(a.includes('2500')){off();timer();assert.equal(count(w,'boot'),1,'mutante timer actúa tras cleanup');}
 else if(a.includes('const stopAuth')){off();w.event('PASSWORD_RECOVERY',s('late'),true);assert.ok(count(w,'session')>0,'mutante callback actúa tras cleanup');}
 else if(a.includes('mcBootReady(); });')){off();w.sessions[0].reject(Error('synthetic'));await flush();assert.equal(count(w,'boot'),1,'mutante rechazo actúa tras cleanup');}
 else {off();w.sessions[0].resolve(s('late'));await flush();w.idle();assert.ok(w.trace.length>0,'mutante continuación actúa tras cleanup');}

}
const oldReg=JSON.parse(old('scripts/beta-sources.json'));for(const [key,scope]of Object.entries(oldReg))assert.deepEqual(betaRevision(key,read,undefined,scope),betaRevision(key,old,undefined,scope),key);
console.log('✓ auth disposal: remount, callbacks/promesas/timer/idle tardíos, controles activos, rojo anterior y '+Object.keys(oldReg).length+' revisiones intactas');
