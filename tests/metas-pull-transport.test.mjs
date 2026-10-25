import {commitCloudFixture} from './helpers/cloud-commit-fixture.mjs';
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { codeMask } from "../scripts/beta-source-code.mjs";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const app=fs.readFileSync(process.env.FIN04_METAS_TRANSPORT_SOURCE||path.join(root,"src/modules/11-app-main.js"),"utf8");
const motor=fs.readFileSync(path.join(root,"src/modules/08-motor-bank.js"),"utf8");
const NOV=Date.parse("2026-11-02T12:00:00Z");
let failures=0;

function bloque(source,token){
  const mask=codeMask(source),start=mask.indexOf(token);
  assert.ok(start>=0,"falta el transporte real: "+token);
  const open=mask.indexOf("{",start); let depth=1,end=open+1;
  for(;depth&&end<mask.length;end++){ if(mask[end]==="{") depth++; else if(mask[end]==="}") depth--; }
  assert.equal(depth,0,"transporte incompleto: "+token);
  return source.slice(start,end)+";";
}
function diferida(){
  let resolve,reject;
  const promise=new Promise((a,b)=>{ resolve=a; reject=b; });
  return {promise,resolve,reject};
}
async function ticks(){ for(let i=0;i<20;i++) await Promise.resolve(); }
function banco({deferred=false}={}){
  const ctx=loadPureLogicFromFile(),monthly=ctx.applyReservaMensual;
  const storage=new Map();ctx.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};ctx.window.localStorage=ctx.localStorage;
  vm.createContext(ctx);
  const core=fs.readFileSync(path.join(root,"src/modules/00-core.js"),"utf8");
  for(const name of [...core.matchAll(/^function (goalSync\w+|mergeGoalsThreeWay)\(/gm)].map(m=>m[1])){
    vm.runInContext(bloque(core,"function "+name+"("),ctx);
  }
  // Se cargan de la fuente vigente: el guardián también funciona contra el transporte anterior,
  // que no tenía puerta y acreditaba una copia local tras rescatar una nube inválida.
  for(const name of ["reservaMensualNubeLeida","reservaMensualPuerta"]){
    const token="function "+name+"(";
    if(codeMask(motor).includes(token)) vm.runInContext(bloque(motor,token),ctx);
  }
  let state={budget:1000,accounts:[],investments:[],debts:[],fixed:[],expenses:[],
    goals:[{id:"g",name:"Sintetica",target:5000,saved:100}],
    settings:{reservaRules:[{id:"r",goalId:"g",kind:"fixed",value:100,mensual:true}]},
    reservaLog:[{id:"mensual|r|2026-10",incomeKey:"mensual|r|2026-10",ruleId:"r",goalId:"g",amount:100,mensual:"2026-10",date:"2026-10-31T12:00:00Z"}]};
  const pulls=[],expenses=[],updates=[],writes=[],identity=x=>x;
  const deps={cloudMergeKey:{current:Symbol("merge")},cloudReadRef:{current:null},cloudPullRef:{current:null},obAbsorbedWriteBlocked:{current:false},
    cloud:{pullState:function(){ const d=diferida(); pulls.push(d); return d.promise; },pushState:(u,s,revision)=>{writes.push({u,s,revision});return Promise.resolve({updated_at:"2026-11-02"});}},
    set:function(updater){ if(deferred)updates.push(updater);else {state=updater(state);commitCloudFixture(app,ctx,deps,state);} },stateRef:{current:state},cloudUpdatedAtRef:{current:null},pullOkRef:{current:null},
    setStateRaw:function(updater){ state=updater(state); },
    // El transporte real consulta la sesión antes de unir el historial de Inicio;
    // omitirla en el banco cortaba el pull antes de pedir gastos y ocultaba el motivo.
    sessionRef:{current:{user:{id:"synthetic"}}},mergeAccountBalanceHistory:ctx.mergeAccountBalanceHistory,
    // Si se vuelve al ref compartido, la intercalación tiene que fallar; su existencia en el
    // banco no obliga al código correcto a usarlo ni presupone cómo guarda su resultado local.
    reservaMensualLeido:{current:false},
    syncCloudExpenses:function(){ const d=diferida(); expenses.push(d); return d.promise; },
    showToast:()=>{},mcBootReady:()=>{},slimForCloud:identity,
    // El orden de conciliación no decide la validez del pull: se aísla para medir SOLO el
    // transporte. La aportación y su identidad sí las calcula el motor financiero real.
    seedFlows:identity,fixMovInvasion:identity,fixRevoDupes:identity,fixInvAuto:identity,fixInvSold:identity,reconcileTR:identity,reconcileEarlyIncomeAnchors:identity,
    applyReservaMensual:s=>monthly(s,NOV)
  };
  const names=Object.keys(deps);
  const factory=vm.runInContext("(function("+names.join(",")+"){"+
    bloque(app,"const reservaMensualAlDia=function(")+bloque(app,"const pushAppState=function(")+bloque(app,"const syncFromCloud=function(")+"return {sync:syncFromCloud,send:pushAppState};})",ctx);
  const {sync,send}=factory(...names.map(k=>deps[k]));
  return {pulls,expenses,writes,deps,send,dispose(){const cleanup=app.match(/return\s*\(\)\s*=>\{\s*alive=false;[\s\S]*?off\(\);\s*\};/);assert(cleanup);new Function('cloudPullRef','cloudReadRef','cloudUpdatedAtRef','sessionRef','let alive=true;const tmr=0,clearTimeout=()=>{},off=()=>{};'+cleanup[0])(deps.cloudPullRef,deps.cloudReadRef,deps.cloudUpdatedAtRef,deps.sessionRef)();},edit(){state=ctx.planSyncEditState({...state,budget:state.budget+1},state._savedAt);deps.stateRef.current=state;},flush(){for(const f of updates.splice(0)){state=f(state);commitCloudFixture(app,ctx,deps,state);}},state:()=>state,valid:()=>({data:JSON.parse(JSON.stringify(state)),updated_at:"synthetic-revision"}),
    start:function(){ sync({user:{id:"synthetic"}}); return deps.pullOkRef.current; }};
}
function resultado(b,saved,months){
  assert.equal(b.state().goals[0].saved,saved);
  assert.deepEqual(Array.from(b.state().reservaLog,x=>x.mensual),months);
}
async function caso(name,fn){
  if(process.env.PR297_TRANSPORT_CASE&&!name.includes(process.env.PR297_TRANSPORT_CASE))return;
  try{ await fn(); console.log("  ✓ "+name); }
  catch(e){ failures++; console.error("  ✗ "+name+"\n    "+e.message); }
}

await caso("A inválido espera; B válido falla gastos; A no toma la validez de B",async()=>{
  const b=banco(),a=b.start(); b.pulls[0].resolve({data:{incomplete:true}}); await ticks();
  assert.equal(b.expenses.length,1,"A debe estar esperando sus gastos");
  assert.equal(b.deps.cloudPullRef.current.owner,"synthetic");
  // Sustitución forzada para aislar la validez por promesa; la reentrada normal comparte vuelo.
  b.deps.cloudPullRef.current=null;
  const other=b.start(); b.pulls[1].resolve(b.valid()); await ticks();
  assert.equal(b.expenses.length,2,"B debe tener otra promesa de gastos");
  b.expenses[1].reject(new Error("fallo sintetico B")); await other; await ticks();
  b.expenses[0].resolve(); await a; await ticks();
  resultado(b,100,["2026-10"]);
});
await caso("A válido espera; B inválido falla; A conserva su lectura y aporta una vez",async()=>{
  const b=banco(),a=b.start(); b.pulls[0].resolve(b.valid()); await ticks();
  assert.equal(b.expenses.length,1);assert.equal(b.deps.cloudPullRef.current.owner,"synthetic");
  // Este caso adversarial conserva la lectura buena; no simula cerrar sesión ni otro evento normal.
  b.deps.cloudPullRef.current=null;
  const other=b.start(); b.pulls[1].resolve({data:{incomplete:true}}); await ticks();
  b.expenses[1].reject(new Error("fallo sintetico B")); await other; await ticks();
  b.expenses[0].resolve(); await a; await ticks();
  resultado(b,200,["2026-10","2026-11"]);
});
await caso("reentrada normal comparte el pull completo y aporta el mes una sola vez",async()=>{
  const b=banco(),a=b.start();b.pulls[0].resolve(b.valid());await ticks();
  const same=b.start();assert.equal(same,a);assert.equal(b.pulls.length,1);assert.equal(b.expenses.length,1);
  b.expenses[0].resolve();assert.equal(await a,true);assert.equal(await same,true);await ticks();
  resultado(b,200,["2026-10","2026-11"]);
});
for(const [name,pack] of [["false",{data:false}],["cero",{data:0}],["cadena vacía",{data:""}],["dato ausente",{}],["objeto incompleto",{data:{incomplete:true}}]]){
  await caso("respuesta inválida "+name+" no acredita con la copia local",async()=>{
    const b=banco(),pull=b.start(); b.pulls[0].resolve(pack); await ticks();
    assert.equal(b.expenses.length,1); b.expenses[0].resolve(); await pull; await ticks();
    resultado(b,100,["2026-10"]);
  });
}
await caso("pull válido que falla gastos no aporta",async()=>{
  const b=banco(),pull=b.start(); b.pulls[0].resolve(b.valid()); await ticks();
  b.expenses[0].reject(new Error("fallo sintetico")); await pull; await ticks();
  resultado(b,100,["2026-10"]);
});
for(const name of ["estado válido","primera cuenta sin estado remoto"]){
  await caso(name+" acredita una vez al completar el pull",async()=>{
    const b=banco(),pull=b.start(); b.pulls[0].resolve(name==="estado válido"?b.valid():null); await ticks();
    b.expenses[0].resolve(); await pull; await ticks();
    resultado(b,200,["2026-10","2026-11"]);
    const again=b.start(); b.pulls[1].resolve(b.valid()); await ticks();
    b.expenses[1].resolve(); await again; await ticks();
    resultado(b,200,["2026-10","2026-11"]);
  });
}
await caso("React diferido: ni lectura ni mes se acreditan antes del commit de la mezcla",async()=>{
  const b=banco({deferred:true}),pull=b.start();b.pulls[0].resolve(b.valid());await ticks();
  let finished=false;pull.then(()=>{finished=true;});await ticks();assert.equal(finished,false);assert.equal(b.expenses.length,0);assert.equal(await b.send("synthetic",b.state()),null);assert.equal(b.writes.length,0);
  resultado(b,100,["2026-10"]);b.flush();await ticks();b.expenses[0].resolve();assert.equal(await pull,true);await ticks();b.flush();resultado(b,200,["2026-10","2026-11"]);
});
await caso("refresco pendiente y fallido conserva lectura y revisión buena para CAS",async()=>{
  const b=banco(),first=b.start();b.pulls[0].resolve(b.valid());await ticks();b.expenses[0].resolve();await first;
  const read=b.deps.cloudReadRef.current,refresh=b.start();
  assert.equal(b.deps.cloudReadRef.current,read);assert.equal(b.deps.cloudUpdatedAtRef.current,"synthetic-revision");
  await b.send("synthetic",b.state());assert.equal(b.writes.at(-1).revision,"synthetic-revision");
  b.pulls[1].reject(new Error("offline"));assert.equal(await refresh,false);
  assert.equal(b.deps.cloudReadRef.current,read);assert.equal(b.deps.cloudUpdatedAtRef.current,"2026-11-02");
});
await caso("respuesta antigua tras cerrar sesión no acredita la sesión nueva del mismo titular",async()=>{
  const b=banco(),old=b.start();
  b.deps.cloudReadRef.current=null;b.deps.cloudPullRef.current=null;b.deps.cloudUpdatedAtRef.current=null;
  b.deps.sessionRef.current={user:{id:"synthetic"}};const fresh=b.start();
  b.pulls[0].resolve(b.valid());await ticks();assert.equal(b.deps.cloudReadRef.current,null);
  assert.equal(b.expenses.length,0,'la lectura antigua no inicia gastos de la sesión nueva');assert.equal(await old,false);
  b.pulls[1].resolve(b.valid());await ticks();b.expenses[0].resolve();assert.equal(await fresh,true);
});
await caso("Plan invalido: edicion comprometida mientras gastos espera no necesita otro render para releer",async()=>{
 const b=banco(),first=b.start(),remote=b.valid();remote.data.fixed=[{id:'duplicate'},{id:'duplicate'}];b.pulls[0].resolve(remote);await ticks();assert.equal(b.expenses.length,1);assert.equal(b.deps.cloudReadRef.current.planInvalid,true);
 b.edit();await b.send('synthetic',b.state());assert.equal(b.pulls.length,1);b.expenses[0].resolve();await ticks();assert.equal(b.pulls.length,2,'la intención comprometida debe drenarse al terminar gastos aunque no haya render');
 b.pulls[1].resolve(b.valid());await ticks();b.expenses[1].resolve();await first;assert.equal(b.deps.cloudReadRef.current.ready,true);
});
await caso("Plan invalido: desmontar App mientras gastos espera no inicia otra lectura ni PATCH",async()=>{
 const b=banco(),first=b.start(),remote=b.valid();remote.data.fixed=[{id:'duplicate'},{id:'duplicate'}];b.pulls[0].resolve(remote);await ticks();assert.equal(b.expenses.length,1);b.edit();b.dispose();b.expenses[0].resolve();await ticks();assert.equal(b.pulls.length,1,'unmount no autoriza un GET de estado nuevo');assert.equal(b.writes.length,0);await first;
});
await caso("Plan: desmontar antes del commit no inicia gastos tardios",async()=>{
 const b=banco({deferred:true}),first=b.start();b.pulls[0].resolve(b.valid());await ticks();assert.equal(b.expenses.length,0);b.dispose();await ticks();assert.equal(b.expenses.length,0,'un commit cancelado por unmount no inicia gastos');assert.equal(b.writes.length,0);await first;
});
if(failures) process.exitCode=1;
