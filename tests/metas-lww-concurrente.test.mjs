import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { codeMask } from "../scripts/beta-source-code.mjs";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

/* Diagnóstico INC-0410 «escrituras simultáneas LWW» (5/10). Dos clientes sintéticos parten del
   MISMO estado de nube, cada uno aporta a una meta distinta antes de ver al otro, y se ejecuta el
   `syncFromCloud` real y la regla de subida (sello `updated_at`) tal como están en 11-app-main /
   00-core. La nube es un doble con la misma semántica que `pushState`.
   Esto es una CARACTERIZACIÓN: aserta la pérdida que hoy ocurre. Con LWW_ESPERADO=1 aserta el
   contrato deseado (ninguna aportación se pierde) y por tanto sale en rojo. Quien arregle el
   merge de metas/reservaLog debe invertir este fichero, no borrarlo. */
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const app=fs.readFileSync(path.join(root,"src/modules/11-app-main.js"),"utf8");
const motor=fs.readFileSync(path.join(root,"src/modules/08-motor-bank.js"),"utf8");
const ESPERADO=process.env.LWW_ESPERADO==="1";
let failures=0;

function bloque(source,token){
  const mask=codeMask(source),start=mask.indexOf(token);
  assert.ok(start>=0,"falta el transporte real: "+token);
  const open=mask.indexOf("{",start); let depth=1,end=open+1;
  for(;depth&&end<mask.length;end++){ if(mask[end]==="{") depth++; else if(mask[end]==="}") depth--; }
  assert.equal(depth,0,"transporte incompleto: "+token);
  return source.slice(start,end)+";";
}
async function ticks(){ for(let i=0;i<30;i++) await Promise.resolve(); }

const ctx=loadPureLogicFromFile();
vm.createContext(ctx);
for(const name of ["reservaMensualNubeLeida","reservaMensualPuerta"]) vm.runInContext(bloque(motor,"function "+name+"("),ctx);

const clone=x=>JSON.parse(JSON.stringify(x));
const identity=x=>x;
const BASE={budget:1000,accounts:[],investments:[],debts:[],fixed:[],expenses:[],_savedAt:1000,
  goals:[{id:"g1",name:"Sintetica uno",target:5000,saved:0},{id:"g2",name:"Sintetica dos",target:5000,saved:0}],
  settings:{reservaRules:[]},reservaLog:[]};

// Nube con la semántica de `pushState`: con sello conocido solo escribe si coincide.
function nube(){
  let n=0; const row={data:clone(BASE),updated_at:"v0"};
  return {row,
    pullState:async()=>({data:clone(row.data),updated_at:row.updated_at}),
    pushState:async function(uid,data,known){
      if(known && known!==row.updated_at) return {conflict:true};
      row.data=clone(data); row.updated_at="v"+(++n); return {updated_at:row.updated_at};
    }};
}
function cliente(cloud,clock){
  let state=clone(BASE); const ref={current:null}, stamp={current:"v0"};
  const set=function(updater){ const next=typeof updater==="function"?updater(state):updater;
    if(next!==state) state=Object.assign({},next,{_savedAt:clock.now}); ref.current=state; };
  ref.current=state;
  const deps={cloud,set,stateRef:ref,cloudUpdatedAtRef:stamp,pullOkRef:{current:null},
    validCloudState:ctx.validCloudState,mergeExpenses:ctx.mergeExpenses,
    syncCloudExpenses:()=>Promise.resolve(),showToast:()=>{},mcBootReady:()=>{},slimForCloud:identity,
    seedFlows:identity,fixMovInvasion:identity,fixRevoDupes:identity,fixInvAuto:identity,fixInvSold:identity,reconcileTR:identity,reconcileEarlyIncomeAnchors:identity,
    applyReservaMensual:identity,reservaMensualPuerta:ctx.reservaMensualPuerta};
  const names=Object.keys(deps);
  const sync=vm.runInContext("(function("+names.join(",")+"){"+bloque(app,"const reservaMensualAlDia=function(")+bloque(app,"const syncFromCloud=function(")+"return syncFromCloud;})",ctx)(...names.map(k=>deps[k]));
  return {state:()=>state,
    aporta:function(goalId,amount){ set(function(s){ return Object.assign({},s,{
      goals:s.goals.map(g=>g.id===goalId?Object.assign({},g,{saved:g.saved+amount}):g),
      reservaLog:s.reservaLog.concat([{id:"man|"+goalId,goalId,amount,date:"2026-10-05T10:00:00Z"}])}); }); },
    // Es el efecto de subida de 11-app-main (debounce de 1,2 s, conflicto → toast + syncFromCloud).
    push:async function(){ const r=await cloud.pushState("u",clone(state),stamp.current);
      if(r.conflict){ sync({user:{id:"u"}}); await ticks(); return "conflicto"; }
      stamp.current=r.updated_at; return "ok"; },
    pull:async function(){ sync({user:{id:"u"}}); await ticks(); },
    stamp:()=>stamp.current};
}
const total=(s,id)=>s.goals.find(g=>g.id===id).saved;

async function caso(name,fn){
  try{ await fn(); console.log("  ✓ "+name); }
  catch(e){ failures++; console.error("  ✗ "+name+"\n    "+e.message); }
}
function afirma(todoPresente,msg){
  // Caracterización: hoy hay pérdida. Esperado: ninguna.
  if(ESPERADO) assert.equal(todoPresente,true,msg);
  else assert.equal(todoPresente,false,"la caracterización ya no se cumple (¿se arregló el merge?): "+msg);
}

// El primer cliente en llegar (B, sello posterior) gana: A sube después, choca, baja y su aportación sí
// sobrevive solo si el estado local «más nuevo» gana. Se prueban los dos órdenes de reloj.
await caso("A aporta a g1 y B a g2 desde el mismo estado; B más reciente gana: A pierde su aportación",async()=>{
  const clock={now:1000},cloud=nube(),A=cliente(cloud,clock),B=cliente(cloud,clock);
  clock.now=2000; A.aporta("g1",100);
  clock.now=3000; B.aporta("g2",50);
  assert.equal(await B.push(),"ok");
  assert.equal(await A.push(),"conflicto","A parte del sello viejo: la subida debe chocar");
  await ticks(); await A.push();
  const fin=cloud.row.data;
  console.log("    traza: nube g1="+total(fin,"g1")+" g2="+total(fin,"g2")+" log="+fin.reservaLog.map(x=>x.id).join(","));
  afirma(total(fin,"g1")===100&&total(fin,"g2")===50&&fin.reservaLog.length===2,"nube final con las dos aportaciones");
  if(!ESPERADO){ assert.equal(total(fin,"g2"),50,"B, que ganó, conserva lo suyo"); assert.equal(total(fin,"g1"),0,"A perdió g1 y su asiento de reservaLog"); }
});
await caso("A aporta a g1 y B a g2; A más reciente gana: B pierde su aportación",async()=>{
  const clock={now:1000},cloud=nube(),A=cliente(cloud,clock),B=cliente(cloud,clock);
  clock.now=2000; B.aporta("g2",50);
  clock.now=3000; A.aporta("g1",100);
  assert.equal(await B.push(),"ok");
  assert.equal(await A.push(),"conflicto");
  await ticks(); await A.push();
  const fin=cloud.row.data;
  console.log("    traza: nube g1="+total(fin,"g1")+" g2="+total(fin,"g2")+" log="+fin.reservaLog.map(x=>x.id).join(","));
  afirma(total(fin,"g1")===100&&total(fin,"g2")===50&&fin.reservaLog.length===2,"nube final con las dos aportaciones");
  if(!ESPERADO) assert.equal(total(fin,"g2"),0,"B perdió g2 y su asiento: A, más nuevo, resube su estado entero");
});
if(failures) process.exitCode=1;
