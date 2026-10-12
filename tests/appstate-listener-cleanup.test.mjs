import assert from "node:assert/strict";
import fs from "node:fs";
import {execFileSync} from "node:child_process";
import {betaRevision} from "../scripts/beta-revisions.mjs";

// Ejecuta el efecto real aislado: un doble de transporte permite resolver el handle después
// de cambiar de sesión y comprobar causalmente que un callback retirado no vuelve a actuar.
// Git usa CRLF en Windows; las anclas describen el efecto real con saltos LF.
const source=fs.readFileSync(new URL("../src/modules/11-app-main.js",import.meta.url),"utf8").replace(/\r\n/g,"\n");
const start='  useEffect(function(){\n    if(!uid) return;\n    const onVis=function(){';
function effect(s){const i=s.indexOf(start),j=s.indexOf('  },[uid]);',i);assert.ok(i>=0&&j>i);return s.slice(i+start.indexOf('function(){')+11,j);}
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function run(s,mode="immediate",removeMode="ok",uid="test"){
  let callback,resolveHandle,removed=0,sync=0;const live=new Set(),dom=new Set();
  const handle={remove(){removed++;live.delete(callback);if(removeMode==="throw")throw Error("remove");if(removeMode==="reject")return Promise.reject(Error("remove"));}};
  const App={addListener(ev,fn){callback=fn;if(mode==="throw")throw Error("add");if(mode==="reject")return Promise.reject(Error("add"));live.add(fn);return mode==="sync"?handle:mode==="late"?new Promise(r=>{resolveHandle=r;}):Promise.resolve(handle);}};
  const document={visibilityState:"visible",addEventListener(ev,fn){dom.add(fn);},removeEventListener(ev,fn){dom.delete(fn);}};
  const cleanup=new Function("uid","document","window","setCalendarDay","madridDay","syncCloudExpenses","natPlugin",effect(s))(uid,document,{Capacitor:{Plugins:{App}}},()=>{},()=>"2026-10-07",()=>{sync++;return Promise.resolve();},()=>null);
  return {cleanup,live,dom,handle,get removed(){return removed;},get sync(){return sync;},call(){callback({isActive:true});},resolve(){resolveHandle(handle);}};
}
const unhandled=[];const report=e=>unhandled.push(e);process.on("unhandledRejection",report);
for(const mode of ["immediate","sync","late"]){
  const r=run(source,mode);assert.equal(r.live.size,1);r.call();assert.equal(r.sync,1);r.cleanup();assert.equal(r.dom.size,0);r.call();assert.equal(r.sync,1,"callback retirado inerte "+mode);if(mode==="late")r.resolve();await flush();assert.equal(r.live.size,0);assert.equal(r.removed,1);console.log("✓ cleanup "+mode);
}
for(const mode of ["throw","reject"]){const r=run(source,mode);r.cleanup();await flush();assert.equal(r.dom.size,0);assert.equal(r.live.size,0);console.log("✓ alta "+mode);}
for(const mode of ["throw","reject"]){const r=run(source,"immediate",mode);r.cleanup();await flush();assert.equal(r.live.size,0);console.log("✓ retirada "+mode);}
const absent=run(source,"immediate","ok","");assert.equal(absent.cleanup,undefined);assert.equal(absent.dom.size,0);assert.equal(absent.live.size,0);
// Contraprueba con la fuente anterior: la Promise no tiene .remove y el callback sigue activo.
const old=execFileSync("git",["show","3aeed496442ad9e5a3a7c8c2759a50622853512b:src/modules/11-app-main.js"],{encoding:"utf8",maxBuffer:8e6});
const bad=run(old);bad.cleanup();await flush();assert.equal(bad.live.size,1);bad.call();assert.equal(bad.sync,1);console.log("✓ rojo anterior: handle vivo y callback retirado todavía activo");
const reader=f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8"),id="inc-0710-appstate-listener-cleanup",revision=betaRevision(id,reader).web;
for(const [a,b]of [["!off&&st&&st.isActive","st&&st.isActive"],["off=true;","off=false;"],["h=>h&&h.remove&&h.remove()","h=>h"]]){assert.ok(source.includes(a));assert.notEqual(betaRevision(id,f=>f==="src/modules/11-app-main.js"?source.replace(a,b):reader(f)).web,revision);}
await new Promise(r=>setImmediate(r));process.removeListener("unhandledRejection",report);assert.deepEqual(unhandled,[]);console.log("✓ errores absorbidos y scope sensible a callback/cleanup");
