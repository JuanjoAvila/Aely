// Fragmentos exactos de producto; transporte y reloj controlados, sin red ni datos reales.
export function authFragments(core,app){
  const method=core.match(/^    onAuth\(cb\)\{.*\},$/m);
  const a=app.indexOf('  // Detecta sesión al cargar y escucha cambios'),b=app.indexOf('  // Empuja el estado a la nube',a);
  if(!method||a<0||b<a) throw Error('Fragmento auth no encontrado');
  return {method:method[0].trim().replace(/,$/,''),effect:app.slice(a,b)};
}
export function authWorld(parts,{enabled=true,offline=false}={}){
  const live=new Set(),retained=[],sessions=[],idles=[],timers=new Map(),trace=[];
  let seq=0,removed=0;
  const sb=enabled?{auth:{onAuthStateChange(cb){live.add(cb);retained.push(cb);return {data:{subscription:{unsubscribe(){removed++;live.delete(cb);}}}};}}}:null;
  const cloud=new Function('sb','return {'+parts.method+'};')(sb);
  cloud.enabled=()=>enabled;
  cloud.session=()=>new Promise((resolve,reject)=>sessions.push({resolve,reject}));
  const env={cloud,navigator:{onLine:!offline},sessionRef:{current:null},
    setTimeout(fn){const n=++seq;timers.set(n,fn);return n;},clearTimeout(n){timers.delete(n);},
    mcBootReady(){trace.push({type:'boot'});},setSession(s){trace.push({type:'session',uid:s?.user?.id??null});},
    mcScheduleIdle(fn){idles.push(fn);},syncFromCloud(s,opts){trace.push({type:'sync',uid:s.user.id,opts:opts||null});},
    set(fn){const result=fn({bankTx:['synthetic']});trace.push({type:'state',bankTx:result.bankTx});},
    setRecovery(v){trace.push({type:'recovery',v});},setShowAuth(v){trace.push({type:'showAuth',v});}};
  return {env,live,retained,sessions,idles,timers,trace,get removed(){return removed;},
    mount(){env.sessionRef={current:null};let cleanup;new Function(...Object.keys(env),'useEffect',parts.effect)(...Object.values(env),fn=>{cleanup=fn();});return ()=>{if(cleanup)cleanup();};},
    event(ev,s,stale=false){for(const cb of stale?retained:live)cb(ev,s);},
    idle(){for(const fn of idles.splice(0))fn();},fireTimers(){for(const fn of [...timers.values()])fn();}};
}
