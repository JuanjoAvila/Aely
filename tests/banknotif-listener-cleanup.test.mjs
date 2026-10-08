import assert from "node:assert/strict";
import fs from "node:fs";
import {execFileSync} from "node:child_process";
import {betaRevision} from "../scripts/beta-revisions.mjs";

// Resuelve el alta después de retirar la sesión: la fuente real debe recoger el handle tardío
// y no programar trabajo desde un callback ya retirado. Todo el transporte es sintético.
const source=fs.readFileSync(new URL("../src/modules/11-app-main.js",import.meta.url),"utf8");
function effect(s){const i=s.indexOf('  useEffect(function(){',s.indexOf('  // APK alpha22:')),j=s.indexOf('  },[uid]);',i);assert.ok(i>=0&&j>i);return s.slice(i+'  useEffect(function(){'.length,j);}
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function run(s,mode="immediate",removeMode="ok",uid="synthetic",linked=true,allowed=true){
  let cb,resolve,removed=0,scheduled=0;const live=new Set();
  const handle={remove(){removed++;live.delete(cb);if(removeMode==="throw")throw Error("remove");if(removeMode==="reject")return Promise.reject(Error("remove"));}};
  const nat={addListener(ev,fn){assert.equal(ev,"bankNotif");cb=fn;if(mode==="throw")throw Error("add");if(mode==="reject")return Promise.reject(Error("add"));live.add(fn);return mode==="sync"?handle:mode==="late"?new Promise(r=>resolve=r):Promise.resolve(handle);}};
  const cleanup=new Function("uid","natPlugin","stateRef","allowBankNotifSync","mcScheduleIdle","runBankSync",effect(s))(uid,()=>nat,{current:{hasBankLink:linked}},()=>allowed,()=>{scheduled++;},()=>{throw Error("bank operation forbidden");});
  return {cleanup,live,get removed(){return removed;},get scheduled(){return scheduled;},call(){cb();},resolve(){resolve(handle);}};
}
const unhandled=[],report=e=>unhandled.push(e);process.on("unhandledRejection",report);
for(const mode of ["immediate","sync","late"]){
  const r=run(source,mode);assert.equal(r.live.size,1);r.call();assert.equal(r.scheduled,1);r.cleanup();r.call();assert.equal(r.scheduled,1,"retired callback inert "+mode);if(mode==="late")r.resolve();await flush();assert.equal(r.live.size,0);assert.equal(r.removed,1);console.log("✓ cleanup "+mode);
}
const repeated=Array.from({length:6},()=>run(source,"late"));repeated.forEach(r=>r.cleanup());repeated.forEach(r=>r.resolve());await flush();assert.equal(repeated.reduce((n,r)=>n+r.live.size,0),0);assert.equal(repeated.reduce((n,r)=>n+r.removed,0),6);
for(const mode of ["throw","reject"]){const r=run(source,mode);r.cleanup();await flush();assert.equal(r.live.size,0);console.log("✓ add "+mode);}
for(const mode of ["throw","reject"]){const r=run(source,"late",mode);r.cleanup();r.resolve();await flush();assert.equal(r.live.size,0);assert.equal(r.removed,1);console.log("✓ remove "+mode);}
const absent=run(source,"late","ok","");assert.equal(absent.cleanup,undefined);assert.equal(absent.live.size,0);
for(const [linked,allowed]of [[false,true],[true,false]]){const r=run(source,"sync","ok","synthetic",linked,allowed);r.call();assert.equal(r.scheduled,0);r.cleanup();await flush();}
// La contraprueba ejecuta la base publicada exacta: conserva seis registros al resolver tarde.
const old=execFileSync("git",["show","a56ab25be46985a0e78eca45146729027757b3ab:src/modules/11-app-main.js"],{encoding:"utf8",maxBuffer:8e6});
const bad=Array.from({length:6},()=>run(old,"late"));bad.forEach(r=>r.cleanup());bad.forEach(r=>r.resolve());await flush();assert.equal(bad.reduce((n,r)=>n+r.live.size,0),6);bad[0].call();assert.equal(bad[0].scheduled,1);console.log("✓ red baseline: six late handles retained, retired callback active");
const reader=f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8"),id="inc-0710-banknotif-cleanup",revision=betaRevision(id,reader).web;
for(const [a,b]of [["if(off) return;","if(false) return;"],['sub=Promise.resolve(nat.addListener("bankNotif", onPing));',"sub=null;"],["h=>h&&h.remove&&h.remove()","h=>h"]]){assert.ok(source.includes(a));assert.notEqual(betaRevision(id,f=>f==="src/modules/11-app-main.js"?source.replace(effect(source),effect(source).replace(a,b)):reader(f)).web,revision);}
await new Promise(r=>setImmediate(r));process.removeListener("unhandledRejection",report);assert.deepEqual(unhandled,[]);console.log("✓ errors absorbed, gates preserved, scope sensitive");
