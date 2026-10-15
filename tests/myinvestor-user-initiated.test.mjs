import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read=(p)=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const core=read("src/modules/00-core.js"),app=read("src/modules/11-app-main.js"),sheet=read("src/modules/06-sync-brokers.js");
const method=core.match(/async myinvestorSync\([^)]*\)\{[\s\S]*?\n    \}/)[0];
const calls=[];
const cloud=vm.runInNewContext("({"+method+"})",{sb:{functions:{invoke:async(name,options)=>{ calls.push({name,options});return {data:{ok:true}}; }}}});
for(const value of [true,false,undefined,null,"true",1,{userInitiated:true}]){
  assert.equal((await cloud.myinvestorSync(value)).ok,true);
  assert.equal(calls.at(-1).name,"myinvestor-sync");
  assert.equal(calls.at(-1).options.body.userInitiated,value===true);
}

// Ejecuta el coordinador real de brókers con TR ausente, sin tocar sus efectos o finanzas.
const from=app.indexOf("  const runBrokerSync=function(opts){"),to=app.indexOf("  /* La pantalla de Inversiones",from);
assert.ok(from>=0&&to>from);
for(const manual of [true,false,undefined]){
  const signals=[];
  const ctx={brokerSyncing:{current:false},stateRef:{current:{}},sessionRef:{current:true},BROKER_SYNC_THROTTLE:0,
    cloud:{enabled:()=>true,myinvestorStatus:async()=>({status:"active"}),myinvestorSync:async(value)=>{signals.push(value);return {ok:true,positions:[]};}},
    applyBrokerPositions:()=>{},avisaSync:()=>{},tf:()=>"",t:()=>"",tabOrderOf:()=>[]};
  const run=vm.runInNewContext("(function(){"+app.slice(from,to)+"return runBrokerSync;})()",ctx);
  await run({manual});
  assert.deepEqual(signals,[manual===true]);
}

// Ejecuta las dos llamadas de la hoja con su contexto: apertura suave y botón del usuario.
const soft=sheet.slice(sheet.indexOf('if(r&&r.status==="expired")'),sheet.indexOf('const fail=function'));
const button=sheet.slice(sheet.indexOf('const doSync=function(){'),sheet.indexOf('const keyOf=function(p)'));
for(const [source,expected] of [[soft,false],[button,true]]){
  const expression=source.match(/cloud\.myinvestorSync\([^)]*\)/)[0];
  const signals=[];
  vm.runInNewContext(expression,{cloud:{myinvestorSync:(value)=>signals.push(value)}});
  assert.deepEqual(signals,[expected]);
}
console.log("myinvestor-user-initiated: 12 casos PASS (cloud real, runBrokerSync real y llamadas de hoja)");
