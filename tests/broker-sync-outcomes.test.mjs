import assert from "node:assert/strict";
import fs from "node:fs";

// Ejecutar la función de App evita que un resumen puro esconda fallos del transporte real.
const source=fs.readFileSync("src/modules/11-app-main.js","utf8");
const from=source.indexOf("  const runBrokerSync=function(opts){"),to=source.indexOf("  /* La pantalla de Inversiones",from);
assert.ok(from>=0&&to>from);
const make=Function("brokerSyncing","stateRef","trBridge","trPhoneSaved","signalTrAlive","signalTrDead","applyBrokerPositions","cloud","sessionRef","BROKER_SYNC_THROTTLE","avisaSync","tf","t","tabOrderOf","setTab","trLogFailure","trLogStartupStatus",source.slice(from,to)+"return runBrokerSync;");
const core=fs.readFileSync("src/modules/00-core.js","utf8");
const sanitize=Function("USO_OK",core.slice(core.indexOf("function mcLogCode("),core.indexOf("var _mcSentryReady"))+"return mcLogEvent;")([]);
const trSource=fs.readFileSync("src/modules/06-sync-brokers.js","utf8"),logStart=trSource.indexOf("function trLogFailure("),logEnd=trSource.indexOf("function TRSync(",logStart);
async function run(tr,mi,opts={manual:true,inv:true},busy=false,failApply=false){
  const applied=[],messages=[],calls=[],signals=[],events=[];
  const bridge=tr==="none"?null:{status:async function(){ calls.push("tr-status"); if(tr==="status-error") throw new Error("fixture"); return tr==="boot-expired"?{connected:true,authExpired:true}:{connected:tr!=="disconnected-ok"&&tr!=="boot-disconnected"}; },sync:function(){ calls.push("tr-sync"); if(tr==="sync-throw")throw new Error("fixture");if(tr==="sync-error")return Promise.reject(new Error("fixture"));return Promise.resolve(typeof tr==="object"?tr:tr==="ok"||tr==="disconnected-ok"?{ok:true,positions:[],cash:0}:tr==="expired"?{authExpired:true}:{softFail:true}); }};
  const cloud={logEvent:function(kind,message,detail){events.push(sanitize(kind,message,detail));},enabled:function(){return true;},myinvestorStatus:async function(){calls.push("mi-status");if(mi==="status-error")throw new Error("fixture");return {status:mi==="none"?"none":mi==="expired"?"expired":"active"};},myinvestorSync:async function(){calls.push("mi-sync");if(mi==="sync-error")throw new Error("fixture");return mi==="ok"?{ok:true,positions:[]}:mi==="auth-expired"?{authExpired:true}:{ok:false};}};
  const trLog=logStart>=0?Function("cloud",trSource.slice(logStart,logEnd)+"return trLogFailure;")(cloud):function(){};
  const startup=trSource.includes("function trLogStartupStatus(")?Function("cloud","trPhoneSaved",trSource.slice(logStart,logEnd)+"return trLogStartupStatus;")(cloud,()=>true):function(){};
  const lock={current:busy};
  const fn=make(lock,{current:{lastMiSync:Date.now()}},function(){return bridge;},function(){return true;},function(){signals.push("alive");},function(){signals.push("dead");},function(p,key){if(failApply&&key==="lastTrSync")throw new Error("synthetic client exception");applied.push(key);},cloud,{current:{}},60000,function(o,m){messages.push(m);},function(k,v){return k+":"+JSON.stringify(v);},function(k){return k;},function(){return ["inicio","gastos","plan","cartera"];},function(){},trLog,startup);
  const result=await fn(opts);
  return {applied,messages,calls,signals,events,result,locked:lock.current};
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
for(const [result,code,origin]of [["expired","auth_expired","broker_manual_sync"],["soft","soft_fail","broker_manual_sync"],["sync-error","sync_rejected","broker_manual_sync"],["sync-throw","sync_rejected","broker_manual_sync"],["status-error","status_rejected","status_check"],[{ok:false},"sync_invalid","broker_manual_sync"],[null,"sync_invalid","broker_manual_sync"],[{authExpired:true,wafBlocked:true},"soft_fail","broker_manual_sync"],[{authExpired:true,softFail:true},"soft_fail","broker_manual_sync"]])await check("telemetría TR general "+code+" sin precisión nativa",async()=>{
 const r=await run(result,"ok");assert.deepEqual(r.events,[{message:"tr_sync",detail:JSON.stringify({schema:1,code,origin,snapshotAge:"unknown"})}]);assert.ok(r.messages.includes(ok("MyInvestor")));assert.equal(r.locked,false);
 if(code!=="auth_expired")assert.ok(!r.signals.includes("dead"));
});
await check("status desconectado con sync bueno no inventa caída",async()=>{const r=await run("disconnected-ok","none");assert.deepEqual(r.events,[]);assert.ok(r.messages.includes(ok("Trade Republic")));assert.ok(!r.signals.includes("dead"));});
await check("automático no emite errores TR ni ejecuta sync aun con rechazo de status",async()=>{const r=await run("status-error","none",{});assert.deepEqual(r.events,[]);assert.deepEqual(r.calls,["tr-status"]);});
for(const tr of ["boot-expired","boot-disconnected"])await check("arranque general "+tr+" registra observación sin sync bancario",async()=>{
 const r=await run(tr,"none",{});assert.deepEqual(r.events,[{message:"tr_sync",detail:JSON.stringify({schema:1,code:"status_inactive",origin:"status_check",snapshotAge:"unknown"})}]);assert.deepEqual(r.calls,["tr-status"]);assert.ok(!r.signals.includes("dead"));
});
await check("applyBrokerPositions que lanza es client_error y conserva el éxito MyInvestor",async()=>{
 const r=await run("ok","ok",{manual:true},false,true);assert.deepEqual(r.events,[{message:"tr_sync",detail:JSON.stringify({schema:1,code:"client_error",origin:"broker_manual_sync",snapshotAge:"unknown"})}]);assert.ok(r.messages.includes(ok("MyInvestor")));assert.equal(r.locked,false);
});
console.log("broker-sync-outcomes: "+(count-failed)+" PASS / "+failed+" FAIL");
if(failed)process.exit(1);
