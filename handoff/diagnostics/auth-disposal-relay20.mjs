// Diagnóstico sintético: ejecuta fragmentos exactos; no usa cuentas, red ni almacenamiento real.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
const startedAt=new Date().toISOString(), started=performance.now();
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sha='cacc2a0dff55baa3859ddeedcbdcf862925f2fca';
const source=f=>execFileSync('git',['show',sha+':'+f],{cwd:root,encoding:'utf8'});
const core=source('src/modules/00-core.js'), app=source('src/modules/11-app-main.js');
const methods=core.slice(core.indexOf('    enabled(){ return !!sb; }'),core.indexOf('    async signIn(email)'));
const idle=core.slice(core.indexOf('function mcScheduleIdle('),core.indexOf('/* Gastos necesita'));
const marker='  // Detecta sesión al cargar y escucha cambios (incluida la vuelta del magic link).';
const effect=app.slice(app.indexOf(marker)+marker.length,app.indexOf('  // Empuja el estado a la nube'));
assert.match(methods,/onAuthStateChange/); assert.match(effect,/cloud\.session\(\)/);
function deferred(){ let resolve,reject; const promise=new Promise((a,b)=>{resolve=a;reject=b;}); return {promise,resolve,reject}; }
const flush=async()=>{for(let i=0;i<6;i++) await Promise.resolve();};
const ses=id=>({user:{id}});
function transport(enabled=true){
  const callbacks=new Map(), sessions=[], returned=[];
  let next=0,unsubscribed=0;
  const sb={auth:{getSession(){const d=deferred();sessions.push(d);return d.promise;},onAuthStateChange(cb){const id=++next;callbacks.set(id,cb);const h={data:{subscription:{unsubscribe(){unsubscribed++;callbacks.delete(id);}}}};returned.push(h);return h;}}};
  const cloud=vm.runInNewContext('({'+methods+'})',{sb:enabled?sb:null});
  return {cloud,callbacks,sessions,returned,get unsubscribed(){return unsubscribed;},emit(ev,s){for(const cb of [...callbacks.values()]) cb(ev,s);}};
}
function mount(tr,{offline=false}={}){
  const m={disposed:false,events:[],timers:new Map(),idles:[],cleanup:undefined,sessionRef:{current:null}};
  let timer=0;
  const record=(kind,extra={})=>m.events.push({kind,disposed:m.disposed,...extra});
  const env={cloud:tr.cloud,navigator:{onLine:!offline},sessionRef:m.sessionRef,
    useEffect(fn,deps){assert.equal(deps.length,0);m.cleanup=fn();},
    setTimeout(fn,ms){const id=++timer;m.timers.set(id,{fn,ms});return id;},clearTimeout(id){m.timers.delete(id);},
    requestIdleCallback(fn){m.idles.push(fn);return m.idles.length;},
    mcBootReady(){record('bootReady');},setSession(s){record('setSession',{uid:s?.user.id??null});},
    set(fn){const result=fn({bankTx:['synthetic']});record('stateUpdater',{bankTx:result.bankTx});},
    setRecovery(v){record('setRecovery',{value:v});},setShowAuth(v){record('setShowAuth',{value:v});},
    syncFromCloud(s,opts){record('syncRequest',{uid:s?.user.id??null,opts:opts||null});}};
  vm.runInNewContext(idle+'\n'+effect,env,{filename:'exact-source-session-effect.js'});
  m.dispose=()=>{m.disposed=true;if(typeof m.cleanup==='function')m.cleanup();};
  m.runIdle=()=>{for(const fn of m.idles.splice(0))fn();};
  m.runTimers=()=>{for(const [id,{fn}] of [...m.timers]){m.timers.delete(id);fn();}};
  m.count=kind=>m.events.filter(e=>e.kind===kind).length;
  return m;
}
const rows=[];
function row(name,data){rows.push({name,...data});}
{
 const tr=transport();const got=tr.cloud.onAuth(()=>{});
 assert.equal(got,undefined);assert.equal(tr.callbacks.size,1);
 row('subscription-handle-discarded',{wrapperReturn:'undefined',transportHandleExists:true,subscriptions:tr.callbacks.size});
 tr.returned[0].data.subscription.unsubscribe();assert.equal(tr.callbacks.size,0);
 row('transport-unsubscribe-negative-control',{subscriptions:tr.callbacks.size,unsubscribed:tr.unsubscribed});
}
{
 const tr=transport(),m=mount(tr);m.dispose();
 assert.equal(m.cleanup,undefined);assert.equal(tr.callbacks.size,1);assert.equal(m.timers.size,1);
 tr.emit('SIGNED_IN',ses('synthetic-A'));tr.emit('PASSWORD_RECOVERY',ses('synthetic-A'));tr.emit('SIGNED_OUT',null);
 assert.equal(m.count('syncRequest'),1);assert.equal(m.count('stateUpdater'),1);assert.equal(m.count('setRecovery'),1);
 row('auth-after-disposal',{subscriptions:tr.callbacks.size,unsubscribed:tr.unsubscribed,events:m.events});
}
{
 const tr=transport(),old=mount(tr);old.dispose();const live=mount(tr);
 tr.emit('SIGNED_IN',ses('synthetic-A'));assert.equal(tr.callbacks.size,2);assert.equal(old.count('syncRequest'),1);assert.equal(live.count('syncRequest'),1);
 row('one-remount',{subscriptions:tr.callbacks.size,disposedSyncRequests:old.count('syncRequest'),activeSyncRequests:live.count('syncRequest')});
}
{
 const tr=transport(),old=[];
 for(let i=0;i<6;i++){const m=mount(tr);m.dispose();old.push(m);}
 const live=mount(tr);tr.emit('SIGNED_IN',ses('synthetic-A'));
 assert.equal(tr.callbacks.size,7);assert.equal(tr.unsubscribed,0);
 assert.equal(old.reduce((n,m)=>n+m.count('syncRequest'),0),6);assert.equal(live.count('syncRequest'),1);
 row('six-disposals-then-live-remount',{subscriptions:tr.callbacks.size,unsubscribed:tr.unsubscribed,disposedAuthCallbacks:old.reduce((n,m)=>n+m.count('setSession'),0),disposedSyncRequests:6,activeSyncRequests:1});
}
{
 const tr=transport(),m=mount(tr);m.dispose();tr.sessions[0].resolve({data:{session:ses('synthetic-A')}});await flush();
 assert.equal(m.count('setSession'),1);assert.equal(m.idles.length,1);m.runIdle();assert.equal(m.count('syncRequest'),1);
 row('session-resolves-after-disposal',{events:m.events});
}
{
 const tr=transport(),m=mount(tr);tr.sessions[0].resolve({data:{session:ses('synthetic-A')}});await flush();m.dispose();m.runIdle();
 assert.equal(m.count('syncRequest'),1);assert.equal(m.events.find(e=>e.kind==='syncRequest').disposed,true);
 row('idle-queued-before-disposal',{events:m.events});
}
{
 const tr=transport(),m=mount(tr);m.dispose();m.runTimers();assert.equal(m.count('bootReady'),1);
 tr.sessions[0].reject(new Error('synthetic rejection'));await flush();assert.equal(m.count('bootReady'),2);
 row('timer-and-session-rejection-after-disposal',{events:m.events});
}
{
 const tr=transport(),m=mount(tr);tr.sessions[0].resolve({data:{session:ses('synthetic-A')}});await flush();m.runIdle();
 tr.emit('TOKEN_REFRESHED',ses('synthetic-A'));tr.emit('INITIAL_SESSION',ses('synthetic-A'));
 assert.equal(m.count('syncRequest'),1);assert.equal(tr.callbacks.size,1);
 row('active-same-user-no-remount',{subscriptions:tr.callbacks.size,syncRequests:m.count('syncRequest'),setSessionCalls:m.count('setSession')});
}
{
 const tr=transport(),m=mount(tr);tr.emit('SIGNED_IN',ses('synthetic-A'));tr.emit('SIGNED_IN',ses('synthetic-B'));tr.emit('SIGNED_OUT',null);
 assert.equal(m.count('syncRequest'),2);assert.equal(m.count('stateUpdater'),1);
 assert.equal(m.events.filter(e=>e.kind==='syncRequest')[1].opts.dropTx,true);
 row('active-login-switch-signout-control',{events:m.events});
}
{
 const tr=transport(),m=mount(tr);tr.emit('SIGNED_IN',ses('synthetic-B'));
 tr.sessions[0].resolve({data:{session:ses('synthetic-A')}});await flush();m.runIdle();
 assert.equal(m.sessionRef.current.user.id,'synthetic-A');assert.equal(m.count('syncRequest'),2);
 row('active-pending-session-after-newer-auth-separate-race',{events:m.events,finalRefUid:m.sessionRef.current.user.id,disposed:false});
}
{
 const tr=transport(false),m=mount(tr);assert.equal(tr.callbacks.size,0);assert.equal(m.timers.size,0);assert.equal(m.count('bootReady'),1);
 row('cloud-disabled-control',{subscriptions:0,timers:0,bootReady:1});
}
const digest=s=>createHash('sha256').update(s).digest('hex');
const report={sourceSHA:sha,node:process.version,startedAt,durationMs:Math.round(performance.now()-started),exitCode:0,sourceFragments:'exact git-show methods / idle scheduler / complete session mount effect',fragmentSha256:{methods:digest(methods),idle:digest(idle),effect:digest(effect)},synthetic:true,network:false,actualPersistenceWrites:0,sync:'spy requests only; syncFromCloud body not executed',rows};
const output=JSON.stringify(report,null,2)+'\n';
if(process.argv[2]) fs.writeFileSync(process.argv[2],output);
console.log(output);
