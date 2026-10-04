import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { codeMask } from "../scripts/beta-source-code.mjs";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const app=fs.readFileSync(path.join(root,"src/modules/11-app-main.js"),"utf8");
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
function banco(){
  const ctx=loadPureLogicFromFile(),monthly=ctx.applyReservaMensual;
  vm.createContext(ctx);
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
  const pulls=[],expenses=[],identity=x=>x;
  const deps={
    cloud:{pullState:function(){ const d=diferida(); pulls.push(d); return d.promise; },pushState:()=>Promise.resolve({updated_at:"2026-11-02"})},
    set:function(updater){ state=updater(state); },stateRef:{current:state},cloudUpdatedAtRef:{current:null},pullOkRef:{current:null},
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
    bloque(app,"const reservaMensualAlDia=function(")+bloque(app,"const syncFromCloud=function(")+"return syncFromCloud;})",ctx);
  const sync=factory(...names.map(k=>deps[k]));
  return {pulls,expenses,state:()=>state,valid:()=>({data:JSON.parse(JSON.stringify(state))}),
    start:function(){ sync({user:{id:"synthetic"}}); return deps.pullOkRef.current; }};
}
function resultado(b,saved,months){
  assert.equal(b.state().goals[0].saved,saved);
  assert.deepEqual(Array.from(b.state().reservaLog,x=>x.mensual),months);
}
async function caso(name,fn){
  try{ await fn(); console.log("  ✓ "+name); }
  catch(e){ failures++; console.error("  ✗ "+name+"\n    "+e.message); }
}

await caso("A inválido espera; B válido falla gastos; A no toma la validez de B",async()=>{
  const b=banco(),a=b.start(); b.pulls[0].resolve({data:{incomplete:true}}); await ticks();
  assert.equal(b.expenses.length,1,"A debe estar esperando sus gastos");
  const other=b.start(); b.pulls[1].resolve(b.valid()); await ticks();
  assert.equal(b.expenses.length,2,"B debe tener otra promesa de gastos");
  b.expenses[1].reject(new Error("fallo sintetico B")); await other; await ticks();
  b.expenses[0].resolve(); await a; await ticks();
  resultado(b,100,["2026-10"]);
});
await caso("A válido espera; B inválido falla; A conserva su lectura y aporta una vez",async()=>{
  const b=banco(),a=b.start(); b.pulls[0].resolve(b.valid()); await ticks();
  const other=b.start(); b.pulls[1].resolve({data:{incomplete:true}}); await ticks();
  b.expenses[1].reject(new Error("fallo sintetico B")); await other; await ticks();
  b.expenses[0].resolve(); await a; await ticks();
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
if(failures) process.exitCode=1;
