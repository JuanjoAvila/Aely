// Diagnóstico sintético: SDK vendorizado REAL (public/vendor/supabase.min.js) + efecto de montaje
// y onAuth EXACTOS de la fuente. Sin cuentas, sin red (fetch inyectado), sin almacenamiento real.
// Uso: node handoff/diagnostics/session-order-relay20.mjs [salida.json]
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const rd=f=>fs.readFileSync(path.join(root,f),'utf8');
const sha256=s=>createHash('sha256').update(s).digest('hex');
const sdkSrc=rd('public/vendor/supabase.min.js'), core=rd('src/modules/00-core.js'), app=rd('src/modules/11-app-main.js');
const onAuthLine=core.match(/^    onAuth\(cb\)\{.*\},$/m)[0].trim().replace(/,$/,'');
const sessionLine=core.match(/^    async session\(\)\{.*\},$/m)[0].trim().replace(/,$/,'');
const marker='  // Detecta sesión al cargar y escucha cambios (incluida la vuelta del magic link).';
const effect=app.slice(app.indexOf(marker)+marker.length,app.indexOf('  // Empuja el estado a la nube'));
const idleSrc=core.slice(core.indexOf('function mcScheduleIdle('),core.indexOf('/* Gastos necesita'));
assert(/onAuthStateChange/.test(onAuthLine)&&/getSession/.test(sessionLine)&&/cloud\.onAuth/.test(effect));
const tick=()=>new Promise(r=>setImmediate(r));
const settle=async(n=40)=>{for(let i=0;i<n;i++) await tick();};
const jwt=(sub)=>'e30.'+Buffer.from(JSON.stringify({sub,exp:4102444800,aud:'authenticated',role:'authenticated'})).toString('base64url')+'.sig';
const sessJson=(uid,{expired=false,rt}={})=>({access_token:jwt(uid),refresh_token:rt||('rt-'+uid),token_type:'bearer',expires_in:3600,
  expires_at:expired?Math.floor(Date.now()/1000)-100:Math.floor(Date.now()/1000)+3600,user:{id:uid,aud:'authenticated',role:'authenticated',email:uid+'@example.invalid',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}});
// navigator.locks sintético: exclusivo y FIFO como el real de WebView.
function fakeLocks(){ const q=new Map(); return {request(name,opts,fn){ if(typeof opts==='function'){fn=opts;} const prev=q.get(name)||Promise.resolve();
  const run=prev.then(()=>fn({name})); q.set(name,run.catch(()=>{})); return run; }}; }
async function world({stored,locks,tokenDelay=0,hash='',detectUrl=false,next0={}}){
  const trace=[]; const t0=performance.now(); const log=(k,x={})=>trace.push({seq:trace.length,k,...x});
  const store=new Map(); const KEY='sb-synthetic-auth-token';
  if(stored) store.set(KEY,JSON.stringify(stored));
  const ls={getItem:k=>{return store.has(k)?store.get(k):null;},setItem:(k,v)=>{store.set(k,v);},removeItem:k=>{store.delete(k);}};
  const requests=[]; let next=next0;
  const fetchStub=async(url,init)=>{ const u=String(url); requests.push({url:u.replace(/^https?:\/\/[^/]+/,'<host>').split('?')[0]+(u.includes('?')?'?'+u.split('?')[1].split('&')[0]:''),method:(init&&init.method)||'GET'}); log('fetch',{url:requests.at(-1).url});
    if(tokenDelay) await new Promise(r=>setTimeout(r,tokenDelay));
    const mk=(b,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{'content-type':'application/json'}});
    if(u.includes('grant_type=password')||u.includes('grant_type=refresh_token')) return mk(next.token||sessJson('synthetic-token'));
    if(u.includes('/user')&&!u.includes('/logout')) return mk(next.user||sessJson('synthetic-token').user);
    if(u.includes('/logout')) return new Response(null,{status:204});
    return mk({});};
  const navigator={onLine:true}; if(locks) navigator.locks=fakeLocks();
  const sbx={console:{log(){},warn(){},error(){},debug(){},info(){}},setTimeout,clearTimeout,setInterval,clearInterval,fetch:fetchStub,Response,Headers,Request,AbortController,URL,URLSearchParams,TextEncoder,TextDecoder,
    navigator,localStorage:ls,location:{href:'https://example.invalid/'+hash,hash,search:'',hostname:'example.invalid',origin:'https://example.invalid'},crypto:globalThis.crypto,atob,btoa,queueMicrotask,structuredClone,WebSocket:class{constructor(){throw new Error("sin red");}}};
  sbx.window=sbx; sbx.self=sbx; sbx.globalThis=sbx; sbx.document={visibilityState:'visible',addEventListener(){},removeEventListener(){}};
  const ctx=vm.createContext(sbx);
  vm.runInContext(sdkSrc,ctx,{filename:'supabase.min.js'});
  vm.runInContext(`var sb=window.supabase.createClient('https://synthetic-ref.example.invalid','synthetic-anon',{auth:{storageKey:'${KEY}',persistSession:true,autoRefreshToken:false,detectSessionInUrl:${detectUrl}}});
    var cloud={enabled(){return !!sb;}, ${sessionLine}, ${onAuthLine}};`,ctx);
  // Marcas de orden sin alterar semántica: cada evento del SDK y cada resolución de getSession se anotan
  // justo ANTES de entregarse al consumidor (el wrapper reenvía idéntico).
  const sb=ctx.sb; const origGet=sb.auth.getSession.bind(sb.auth), origOn=sb.auth.onAuthStateChange.bind(sb.auth);
  sb.auth.getSession=async function(){ const r=await origGet(); log('sdk:getSession->',{uid:r.data.session?.user?.id??null}); return r; };
  sb.auth.onAuthStateChange=function(cb){ return origOn(function(ev,s){ log('sdk:event',{ev,uid:s?.user?.id??null}); return cb(ev,s); }); };
  const sessionRef={current:null}; const idles=[];
  const env=vm.createContext({cloud:ctx.cloud,navigator:{onLine:true},sessionRef,useEffect(fn,d){assert.equal(d.length,0);fn();},
    setTimeout:(fn,ms)=>setTimeout(fn,ms),clearTimeout,requestIdleCallback(fn){idles.push(fn);return idles.length;},
    mcBootReady(){log('bootReady');},
    setSession(s){log('setSession',{uid:s?.user?.id??null,refAfterAssign:sessionRef.current?.user?.id??null});},
    set(fn){fn({bankTx:['x']});log('stateUpdater(signout bankTx:[])');},setRecovery(){log('setRecovery');},setShowAuth(){log('setShowAuth');},
    syncFromCloud(s,o){log('syncRequest',{uid:s?.user?.id??null,opts:o||null});}});
  vm.runInContext(idleSrc+'\n'+effect,env);
  // envolvemos getSession/onAuth del cliente real SOLO para marcar orden, sin alterar su semántica
  return {sb,ctx,trace,log,sessionRef,idles,requests,set next(v){next=v;},get next(){return next;},store,KEY,runIdle(){for(const f of idles.splice(0))f();},
    uid:()=>sessionRef.current?.user?.id??null};
}
const rows=[]; const row=(name,w,extra={})=>{rows.push({name,finalRefUid:w.uid(),events:w.trace.filter(e=>e.k!=='fetch').map(({seq,k,...r})=>({k,...r})),fetches:w.requests.length,...extra});return rows.at(-1);};
const seqOf=w=>w.trace.filter(e=>['setSession','syncRequest','sdk:event','sdk:getSession->'].includes(e.k)).map(e=>e.k==='setSession'?'set:'+e.uid:e.k==='syncRequest'?'sync:'+e.uid:e.k==='sdk:event'?'EV:'+e.ev+':'+e.uid:'GS:'+e.uid);
const summary={};
for(const locks of [false,true]){
  const L=locks?'locks':'nolocks';
  // 1 inicial con sesión A guardada
  { const w=await world({stored:sessJson('synthetic-A'),locks}); await settle(); w.runIdle(); await settle();
    row('initial-stored-A/'+L,w,{seq:seqOf(w)}); }
  // 2 inicial sin sesión
  { const w=await world({stored:null,locks}); await settle(); row('initial-none/'+L,w,{seq:seqOf(w)}); }
  // 3 login B lanzado SÍNCRONAMENTE tras montar (antes de que initializePromise resuelva), con A guardada
  { const w=await world({stored:sessJson('synthetic-A'),locks}); w.next={token:sessJson('synthetic-B')};
    const p=w.sb.auth.signInWithPassword({email:'b@example.invalid',password:'x'}); await p; await settle(); w.runIdle(); await settle();
    row('login-B-during-boot-with-A-stored/'+L,w,{seq:seqOf(w)}); }
  // 4 login B tras el arranque
  { const w=await world({stored:sessJson('synthetic-A'),locks}); await settle(); w.runIdle(); w.next={token:sessJson('synthetic-B')};
    await w.sb.auth.signInWithPassword({email:'b@example.invalid',password:'x'}); await settle(); w.runIdle(); await settle();
    row('switch-A-to-B-after-boot/'+L,w,{seq:seqOf(w)}); }
  // 5 signout
  { const w=await world({stored:sessJson('synthetic-A'),locks}); await settle(); w.runIdle(); await w.sb.auth.signOut(); await settle();
    row('signout/'+L,w,{seq:seqOf(w)}); }
  // 6 refresh con token caducado en storage (autoRefresh se resuelve en getSession)
  { const w=await world({stored:sessJson('synthetic-A',{expired:true}),locks}); w.next={token:sessJson('synthetic-A',{rt:'rt2'})}; await settle(60); w.runIdle(); await settle();
    row('initial-expired-A-refresh/'+L,w,{seq:seqOf(w)}); }
  // 7 login B con respuesta lenta mientras getSession ya devolvió A (A leída antes de que B termine)
  { const w=await world({stored:sessJson('synthetic-A'),locks,tokenDelay:5}); w.next={token:sessJson('synthetic-B')};
    const p=w.sb.auth.signInWithPassword({email:'b@example.invalid',password:'x'}); await settle(2); await p; await settle(); w.runIdle(); await settle();
    row('slow-login-B-overlapping-boot/'+L,w,{seq:seqOf(w)}); }
  // 8 signIn sin A guardada, solapado con arranque
  { const w=await world({stored:null,locks}); w.next={token:sessJson('synthetic-B')};
    await w.sb.auth.signInWithPassword({email:'b@example.invalid',password:'x'}); await settle(); w.runIdle(); await settle();
    row('login-B-during-boot-nothing-stored/'+L,w,{seq:seqOf(w)}); }
}
// 9 retorno de enlace mágico (B en la URL) con A guardada: el SDK procesa la URL DENTRO de initializePromise
for(const locks of [false,true]){ const L=locks?'locks':'nolocks';
  const b=sessJson('synthetic-B'); const hash='#access_token='+b.access_token+'&refresh_token=rt-B&expires_in=3600&token_type=bearer&type=magiclink';
  const w=await world({stored:sessJson('synthetic-A'),locks,hash,detectUrl:true,next0:{user:b.user}}); await settle(); w.runIdle(); await settle();
  row('magic-link-return-B-with-A-stored/'+L,w,{seq:seqOf(w)}); }
// 10 barrido: signIn(B) lanzado tras k microtareas desde el montaje (A guardada). ¿Qué ventana produce A tardía?
const sweep=[];
for(const locks of [false,true]) for(const k of [0,1,2,3,4,6,8,12,20,40]){
  const w=await world({stored:sessJson('synthetic-A'),locks}); w.next={token:sessJson('synthetic-B')};
  for(let i=0;i<k;i++) await Promise.resolve();
  await w.sb.auth.signInWithPassword({email:'b@example.invalid',password:'x'}); await settle(); w.runIdle(); await settle();
  sweep.push({locks,microtasksBeforeSignIn:k,finalRefUid:w.uid(),seq:seqOf(w).join(' > ')}); }
// 11 control de causa: sin el efecto montado la ref no existe; con getSession ya resuelta (post-arranque) no hay A tardía (fila switch-A-to-B-after-boot).
// veredicto: ¿existe algún orden con authB y luego setSession(A) tardío, con ref final A?
const lateA=rows.filter(r=>{const s=r.seq||[];const ib=s.indexOf('set:synthetic-B'),ia=s.lastIndexOf('set:synthetic-A');return ib>=0&&ia>ib&&r.finalRefUid==='synthetic-A';}).map(r=>r.name);
const report={sourceSHA:'cacc2a0dff55baa3859ddeedcbdcf862925f2fca',node:process.version,sdk:'supabase-js 2.110.0 (public/vendor/supabase.min.js)',
  fragmentSha256:{sdk:sha256(sdkSrc),onAuth:sha256(onAuthLine),session:sha256(sessionLine),effect:sha256(effect),idle:sha256(idleSrc)},
  synthetic:true,network:false,realStorage:false,lateAAfterBScenarios:lateA,sweep,rows};
const out=JSON.stringify(report,null,2)+'\n'; if(process.argv[2]) fs.writeFileSync(process.argv[2],out);
for(const r of rows) console.log(r.name.padEnd(52),'ref='+String(r.finalRefUid).padEnd(14),(r.seq||[]).join(' > '));
for(const x of sweep) console.log('sweep',x.locks?'locks  ':'nolocks',String(x.microtasksBeforeSignIn).padStart(3),'ref='+x.finalRefUid);
console.log('late-A-after-B scenarios:',lateA.length?lateA.join(', '):'NONE');
