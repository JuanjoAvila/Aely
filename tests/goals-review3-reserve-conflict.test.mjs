import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {codeMask} from "../scripts/beta-source-code.mjs";
import {loadPureLogicFromFile} from "../scripts/load-pure-logic.mjs";
const root=new URL("../",import.meta.url),app=fs.readFileSync(new URL("src/modules/11-app-main.js",root),"utf8");
let core=fs.readFileSync(new URL("src/modules/00-core.js",root),"utf8");
if(process.env.INC0410_R3_MUTANT){const from=" || reserveGoalConflict";assert.ok(core.includes(from),"mutante R3 aplicable");core=core.replace(from,"");}
const copy=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)),owner="synthetic-owner",NOV=Date.parse("2026-11-02T12:00:00Z"),cents=v=>Math.round(v*100);
function block(s,t){const m=codeMask(s),a=m.indexOf(t);assert.ok(a>=0,t);let b=m.indexOf("{",a)+1,n=1;for(;n&&b<m.length;b++){if(m[b]==="{")n++;if(m[b]==="}")n--;}assert.equal(n,0);return s.slice(a,b);}
const seed=()=>({accounts:[],debts:[],investments:[],fixed:[],expenses:[],bankTx:[{id:"local-feed"}],budget:1000,
 goals:[{id:"g",name:"Sintetica",target:1000,saved:100,done:false,doneAt:null},{id:"other",name:"Otra",target:1000,saved:0,done:false,doneAt:null}],
 settings:{reservaRules:[{id:"r",goalId:"g",kind:"fixed",value:50,mensual:true}]},reservaLog:[],_savedAt:NOV-10000,_historyOwner:owner});
function logic(){const c=loadPureLogicFromFile(),storage=new Map();vm.createContext(c);c.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};c.window.localStorage=c.localStorage;for(const name of [...core.matchAll(/^function (goalSync\w+|mergeGoalsThreeWay)\(/gm)].map(m=>m[1]))vm.runInContext(block(core,"function "+name+"("),c);return c;}
function bank(){
 let now=NOV,row={user_id:owner,data:seed(),updated_at:"r0"},casMisses=0;
 const sb={auth:{getSession:async()=>({data:{session:{user:{id:owner}}},error:null})},from(){let value,mode="read",where=[];const q={update(v){value=v;mode="update";return q;},upsert(v){value=v;mode="upsert";return q;},eq(k,v){where.push([k,v]);return q;},select(){if(mode==="read")return q;const match=mode==="upsert"||where.every(([k,v])=>row[k]===v);if(match)row=copy(value);else casMisses++;return Promise.resolve({data:match?[{updated_at:row.updated_at}]:[],error:null});},maybeSingle:async()=>({data:copy(row),error:null})};return q;}};
 function device(){
  const c=logic();class Clock extends Date{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}}c.Date=Clock;
  let state=seed();Object.assign(state,c.goalSyncPull(state,copy(state),owner,"r0",false));const beforeMonthly=[];
  const deps={obAbsorbedWriteBlocked:{current:false},stateRef:{current:state},sessionRef:{current:{user:{id:owner}}},cloudUpdatedAtRef:{current:"r0"},pullOkRef:{current:null},uid:owner,useCallback:f=>f,
   setStateRaw:f=>{state=f(state);deps.stateRef.current=state;},syncCloudExpenses:async()=>{beforeMonthly.push(copy(state));},showToast:()=>{},mcBootReady:()=>{},t:x=>x,navigator:{onLine:true},reconcileGemelosAutomaticos:x=>x,
   seedFlows:x=>x,fixMovInvasion:x=>x,fixRevoDupes:x=>x,fixInvAuto:x=>x,fixInvSold:x=>x,reconcileTR:x=>x,reconcileEarlyIncomeAnchors:x=>x};
  deps.cloud=vm.runInContext("(function(sb){const statePushCache=new Map();return {"+["async session(","async pullState(","async pushState("].map(t=>block(core,t)).join(",")+"};})",c)(sb);
  const a=app.indexOf("const set=useCallback((updater)=>"),b=app.indexOf("},[]);",a)+"},[]);".length,names=Object.keys(deps);
  const api=vm.runInContext("(function("+names.join(",")+"){"+app.slice(a,b)+block(app,"const reservaMensualAlDia=function(")+";"+block(app,"const pushAppState=function(")+";"+block(app,"const syncFromCloud=function(")+";return {set,push:pushAppState,sync:syncFromCloud};})",c)(...names.map(k=>deps[k]));
  return {c,state:()=>copy(state),beforeMonthly,edit:fn=>{now+=1000;api.set(fn);},settle:()=>{now+=1000;api.set(s=>c.applyReservaMensual(s,now));},send:async()=>{now+=1000;const r=await api.push(owner,state);if(r?.conflict){api.sync(deps.sessionRef.current);await deps.pullOkRef.current;await Promise.resolve();}return r;}};
 }
 return {device,row:()=>copy(row),casMisses:()=>casMisses};
}
for(const editFirst of ["Z-asiento","A-aporte"]){
 test("R3-1: Z50 offline/A20 nube, orden de edición "+editFirst+", reaplica hasta17000c",async()=>{
  const b=bank(),z=b.device(),a=b.device(),add=()=>a.edit(s=>({...s,goals:s.goals.map(g=>g.id==="g"?{...g,saved:g.saved+20}:g)}));
  if(editFirst==="Z-asiento"){z.settle();add();}else{add();z.settle();}
  const local=z.state();assert.equal(cents(local.goals[0].saved),15000);assert.equal(local.reservaLog.length,1);
  await a.send();assert.equal(cents(b.row().data.goals[0].saved),12000);assert.equal(b.row().data.reservaLog.length,0);await z.send();assert.equal(b.casMisses(),1);
  assert.equal(cents(z.state().goals[0].saved),17000,"asiento50 tras nube120 debe producir17000c, no quedar marcado sobre12000c");
  // syncFromCloud recoge la foto antes de que reservaMensualAlDia real reciba el pull válido.
  const rejected=z.beforeMonthly[0];assert.equal(cents(rejected.goals[0].saved),12000);assert.equal(rejected.reservaLog.length,0,"el asiento descartado no puede bloquear su reaplicación");
  assert.equal(rejected._goalSync.cloudOnly,true);assert.equal(rejected._goalSync.keepLocalReserves,false);
  const conflict=rejected._goalSync.conflicts.find(r=>r.code==="goals_reserve_conflict");assert.ok(conflict);const expected=copy(local);for(const k of ["expenses","bankTx","_goalSync"])delete expected[k];assert.deepEqual(conflict.local,expected);
  assert.equal(cents(z.state().goals[0].saved),17000,"motor mensual real reaplica50 a la nube120");assert.equal(z.state().reservaLog.length,1);assert.equal(cents(z.state().reservaLog[0].amount),5000);
  await z.send();assert.equal(cents(b.row().data.goals[0].saved),17000);assert.equal(b.row().data.reservaLog.length,1);assert.equal(b.row().data._goalSync,undefined);
  const before=z.state();z.settle();assert.equal(cents(z.state().goals[0].saved),17000);assert.deepEqual(z.state().reservaLog,before.reservaLog);
 });
}
test("R3-1 inverso de entrega: asiento remoto no se repite; aporte manual conservado permite recuperar17000c",async()=>{
 const b=bank(),z=b.device(),a=b.device();z.settle();a.edit(s=>({...s,goals:s.goals.map(g=>g.id==="g"?{...g,saved:g.saved+20}:g)}));
 await z.send();await a.send();const after=a.state();assert.equal(cents(after.goals[0].saved),15000);assert.equal(after.reservaLog.length,1);
 const conflict=after._goalSync.conflicts.find(r=>r.code==="goals_field_conflict"&&r.goalId==="g");assert.ok(conflict);assert.equal(cents(conflict.local.saved),12000);assert.equal(cents(after._goalSync.base[0].saved),15000);
 // El contrato por campos conserva el aporte manual en conflicto; no autoriza sumar saldos absolutos.
 // Reaplicación explícita del aporte manual sobre la foto remota, usando el set real de App.
 a.edit(s=>({...s,goals:s.goals.map(g=>g.id==="g"?{...g,saved:g.saved+20}:g)}));await a.send();assert.equal(cents(b.row().data.goals[0].saved),17000);assert.equal(b.row().data.reservaLog.length,1);
});
test("R3-1: nueva regla que toca meta con conflicto de nombre rechaza también la foto completa",()=>{
 const c=logic(),base=seed(),local=seed(),remote=seed();local._goalSync={owner,base:copy(base.goals),reserves:c.goalSyncReserves(base),revision:"r0",conflicts:[]};
 local.settings.reservaRules.push({id:"new",goalId:"g",kind:"fixed",value:10,mensual:true});local.goals[0].name="Local";remote.goals[0].name="Nube";
 const result=c.goalSyncPull(local,remote,owner,"r1",false,true);assert.equal(result._goalSync.cloudOnly,true);assert.equal(result._goalSync.keepLocalReserves,false);assert.ok(result._goalSync.conflicts.find(r=>r.code==="goals_reserve_conflict"));
});
test("R3 control: conflicto en una meta ajena al asiento nuevo conserva las reservas locales",()=>{
 const c=logic(),base=seed(),local=copy(c.applyReservaMensual(seed(),NOV)),remote=seed();local._goalSync={owner,base:copy(base.goals),reserves:c.goalSyncReserves(base),revision:"r0",conflicts:[]};
 local.goals[1].name="Local";remote.goals[1].name="Nube";const result=c.goalSyncPull(local,remote,owner,"r1",false,true);
 assert.equal(result._goalSync.cloudOnly,false);assert.equal(result._goalSync.keepLocalReserves,true);assert.equal(cents(result.goals[0].saved),15000);assert.equal(result.goals[1].name,"Nube");assert.equal(result._goalSync.conflicts[0].goalId,"other");
});
test("R3 control: una regla base sin editar no convierte un conflicto ajeno al cambio de reservas en rechazo",()=>{
 const c=logic(),base=seed(),local=seed(),remote=seed();local._goalSync={owner,base:copy(base.goals),reserves:c.goalSyncReserves(base),revision:"r0",conflicts:[]};
 local.reservaLog=[{id:"new-other",goalId:"other",ruleId:"other-rule",amount:20}];local.goals[1].saved=20;local.goals[0].saved=120;remote.goals[0].saved=130;
 const result=c.goalSyncPull(local,remote,owner,"r1",false,true);assert.equal(result._goalSync.cloudOnly,false);assert.equal(result._goalSync.keepLocalReserves,true);assert.deepEqual(copy(result.goals).map(g=>cents(g.saved)),[13000,2000]);
});
