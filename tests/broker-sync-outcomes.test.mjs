import assert from "node:assert/strict";
import fs from "node:fs";

// Ejecutar la función de App evita que un resumen puro esconda fallos del transporte real.
const source=fs.readFileSync("src/modules/11-app-main.js","utf8");
const from=source.indexOf("  const runBrokerSync=function(opts){"),to=source.indexOf("  /* La pantalla de Inversiones",from);
assert.ok(from>=0&&to>from);
const make=Function("brokerSyncing","stateRef","trBridge","trPhoneSaved","signalTrAlive","signalTrDead","applyBrokerPositions","cloud","sessionRef","BROKER_SYNC_THROTTLE","avisaSync","tf","t","tabOrderOf","setTab",source.slice(from,to)+"return runBrokerSync;");
async function run(tr,mi,opts={manual:true,inv:true},busy=false){
  const applied=[],messages=[],calls=[],signals=[];
  const bridge=tr==="none"?null:{status:async function(){ calls.push("tr-status"); if(tr==="status-error") throw new Error("fixture"); return {connected:true}; },sync:async function(){ calls.push("tr-sync"); if(tr==="sync-error") throw new Error("fixture"); return tr==="ok"?{ok:true,positions:[],cash:0}:tr==="expired"?{authExpired:true}:{softFail:true}; }};
  const cloud={enabled:function(){return true;},myinvestorStatus:async function(){calls.push("mi-status");if(mi==="status-error")throw new Error("fixture");return {status:mi==="none"?"none":mi==="expired"?"expired":"active"};},myinvestorSync:async function(){calls.push("mi-sync");if(mi==="sync-error")throw new Error("fixture");return mi==="ok"?{ok:true,positions:[]}:mi==="auth-expired"?{authExpired:true}:{ok:false};}};
  const lock={current:busy};
  const fn=make(lock,{current:{lastMiSync:Date.now()}},function(){return bridge;},function(){return true;},function(){signals.push("alive");},function(){signals.push("dead");},function(p,key){applied.push(key);},cloud,{current:{}},60000,function(o,m){messages.push(m);},function(k,v){return k+":"+JSON.stringify(v);},function(k){return k;},function(){return ["inicio","gastos","plan","cartera"];},function(){});
  const result=await fn(opts);
  return {applied,messages,calls,signals,result,locked:lock.current};
}
let failed=0,count=0;
async function check(name,fn){count++;try{await fn();console.log("  ✓ "+name);}catch(e){failed++;console.error("  ✗ "+name+"\n    "+e.message);}}
const ok=bank=>'v4_sync_broker_ok:'+JSON.stringify({b:bank});
const expired=bank=>'v4_sync_broker_exp:'+JSON.stringify({b:bank});
const soft=bank=>'⚠ bank_syncsoft:'+JSON.stringify({bank});
for(const [tr,mi,bank]of [["ok","none","Trade Republic"],["none","ok","MyInvestor"]])await check("éxito solo de "+bank,async()=>{const r=await run(tr,mi);assert.deepEqual(r.messages,[ok(bank)]);assert.equal(r.result.n,1);assert.equal(r.locked,false);});
await check("ambos éxitos tienen sus dos filas",async()=>{const r=await run("ok","ok");assert.deepEqual(r.messages,[ok("Trade Republic"),ok("MyInvestor")]);assert.equal(r.applied.length,2);assert.equal(r.result.n,2);});
await check("TR caducado conserva el éxito de MyInvestor",async()=>{const r=await run("expired","ok");assert.deepEqual(r.messages,[expired("Trade Republic"),ok("MyInvestor")]);assert.ok(r.signals.includes("dead"));});
await check("MyInvestor caducado conserva el éxito de TR",async()=>{const r=await run("ok","expired");assert.deepEqual(r.messages,[expired("MyInvestor"),ok("Trade Republic")]);});
await check("ambas caducidades se muestran",async()=>{const r=await run("expired","expired");assert.equal(r.messages.length,2);assert.ok(r.messages.includes(expired("Trade Republic")));assert.ok(r.messages.includes(expired("MyInvestor")));});
for(const failure of ["soft","status-error","sync-error"])await check("TR "+failure+" conserva éxito parcial y aviso",async()=>{const r=await run(failure,"ok");assert.ok(r.messages.includes(ok("MyInvestor")));assert.ok(r.messages.includes(soft("Trade Republic")));assert.ok(!r.signals.includes("dead"));assert.equal(r.locked,false);});
for(const failure of ["soft","status-error","sync-error"])await check("MyInvestor "+failure+" en Actualizar también avisa",async()=>{const r=await run("ok",failure,{manual:true});assert.ok(r.messages.includes(ok("Trade Republic")));assert.ok(r.messages.includes(soft("MyInvestor")));});
await check("sin proveedor activo no inventa un éxito",async()=>{const r=await run("none","none");assert.deepEqual(r.messages,[]);assert.equal(r.result.n,0);});
await check("automático no sincroniza TR ni rompe el throttle de MyInvestor",async()=>{const r=await run("ok","ok",{});assert.deepEqual(r.calls,["tr-status"]);assert.deepEqual(r.messages,[]);assert.deepEqual(r.applied,[]);});
await check("ocupado conserva contrato compacto y no consulta",async()=>{const r=await run("ok","ok",{manual:true},true);assert.deepEqual(r.result,{b:1,n:0});assert.deepEqual(r.calls,[]);});
console.log("broker-sync-outcomes: "+(count-failed)+" PASS / "+failed+" FAIL");
if(failed)process.exit(1);
