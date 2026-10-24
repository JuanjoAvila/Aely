import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {codeMask} from "../scripts/beta-source-code.mjs";
import {loadPureLogicFromFile} from "../scripts/load-pure-logic.mjs";
const root=new URL("../",import.meta.url);
let core=fs.readFileSync(new URL("src/modules/00-core.js",root),"utf8"),app=fs.readFileSync(new URL("src/modules/11-app-main.js",root),"utf8");
const changes={
 "one-sided-lww":["} else if(reject){","} else if(localChanged && !remoteChanged){merged={goals:goalSyncCopy(newer?prev.goals:remote.goals),conflicts:[]};} else if(reject){"],
 "remote-reserves":["const reserveSource=goalState._goalSync.keepLocalReserves?prev:cloudState;","const reserveSource=cloudState;"],
 "narrow-record":["return prune(s);","const v=prune(s);delete v.accounts;delete v.debts;return v;"],
 "no-reset-conflicts":["store.del(STATE_KEY_TEST+\"_goal_conflicts\");",""],
 "equal-is-conflict":[" && !goalSyncEqual(localReserves,reserves)",""]
};
const mutant=process.env.INC0410_R2_MUTANT;
if(mutant){const [from,to]=changes[mutant]||[];assert.ok(from);if(core.includes(from))core=core.replace(from,to);else {assert.ok(app.includes(from));app=app.replace(from,to);}}
const copy=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)),owner="synthetic-owner";
function block(s,t){const m=codeMask(s),a=m.indexOf(t);assert.ok(a>=0,t);let b=m.indexOf("{",a)+1,n=1;for(;n&&b<m.length;b++){if(m[b]==="{")n++;if(m[b]==="}")n--;}assert.equal(n,0);return s.slice(a,b);}
function logic(){
 const c=loadPureLogicFromFile(),data=new Map(),reads=[];vm.createContext(c);
 c.localStorage={getItem:k=>{reads.push(k);return data.get(k)??null;},setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};c.window.localStorage=c.localStorage;
 for(const name of [...core.matchAll(/^function (goalSync\w+|mergeGoalsThreeWay|mcSaveRaw|mcLoadRaw|mcResetSandbox)\(/gm)].map(m=>m[1]))vm.runInContext(block(core,"function "+name+"("),c);
 return {c,data,reads};
}
const seed=()=>({accounts:[{id:"account",value:400}],debts:[{id:"debt",value:100}],investments:[],fixed:[],expenses:[],bankTx:[{id:"local-feed"}],
 goals:[{id:"a",target:1000,saved:0,done:false,doneAt:null},{id:"b",target:1000,saved:200,done:false,doneAt:null}],budget:1000,settings:{reservaRules:[{id:"r",goalId:"a",value:1}],theme:"keep"},reservaLog:[],_savedAt:1,_historyOwner:owner});
function bank(){
 let now=1000,row={user_id:owner,data:seed(),updated_at:"r0"},conflicts=0;
 const sb={auth:{getSession:async()=>({data:{session:{user:{id:owner}}},error:null})},from(){let value,mode="read",where=[];const q={update(v){value=v;mode="update";return q;},upsert(v){value=v;mode="upsert";return q;},eq(k,v){where.push([k,v]);return q;},select(){if(mode==="read")return q;const match=mode==="upsert"||where.every(([k,v])=>row[k]===v);if(match)row=copy(value);else conflicts++;return Promise.resolve({data:match?[{updated_at:row.updated_at}]:[],error:null});},maybeSingle:async()=>({data:copy(row),error:null})};return q;}};
 function device(){
  const x=logic(),c=x.c;class Clock extends Date{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}}c.Date=Clock;
  let state=seed();Object.assign(state,c.goalSyncPull(state,copy(state),owner,"r0",false));
  const deps={cloudReadRef:{current:{owner,ready:true}},obAbsorbedWriteBlocked:{current:false},stateRef:{current:state},sessionRef:{current:{user:{id:owner}}},cloudUpdatedAtRef:{current:"r0"},pullOkRef:{current:null},uid:owner,useCallback:f=>f,
   setStateRaw:f=>{state=f(state);deps.stateRef.current=state;},syncCloudExpenses:async()=>{},reservaMensualAlDia:()=>{},showToast:()=>{},mcBootReady:()=>{},t:x=>x,navigator:{onLine:true},reconcileGemelosAutomaticos:x=>x,
   seedFlows:x=>x,fixMovInvasion:x=>x,fixRevoDupes:x=>x,fixInvAuto:x=>x,fixInvSold:x=>x,reconcileTR:x=>x,reconcileEarlyIncomeAnchors:x=>x};
  deps.cloud=vm.runInContext("(function(sb){const statePushCache=new Map();return {"+["async session(","async pullState(","async pushState("].map(t=>block(core,t)).join(",")+"};})",c)(sb);
  const a=app.indexOf("const set=useCallback((updater)=>"),b=app.indexOf("},[]);",a)+"},[]);".length;
  const names=Object.keys(deps),api=vm.runInContext("(function("+names.join(",")+"){"+app.slice(a,b)+block(app,"const pushAppState=function(")+";"+block(app,"const syncFromCloud=function(")+";return {set,push:pushAppState,sync:syncFromCloud};})",c)(...names.map(k=>deps[k]));
  return {...x,state:()=>copy(state),edit:fn=>{now+=1000;api.set(fn);},send:async()=>{now+=1000;const r=await api.push(owner,state);if(r?.conflict){api.sync(deps.sessionRef.current);await deps.pullOkRef.current;}return r;}};
 }
 return {device,row:()=>copy(row),conflicts:()=>conflicts};
}
for(const first of ["contribution","rule"]){
 test("R2-1: aportación y regla de lados distintos sobreviven; primero "+first,async()=>{
  const b=bank(),a=b.device(),z=b.device();
  a.edit(s=>({...s,goals:s.goals.map(g=>g.id==="b"?{...g,saved:260.01}:g)}));
  z.edit(s=>({...s,settings:{...s.settings,reservaRules:[{...s.settings.reservaRules[0],value:5}]}}));
  const [one,two]=first==="contribution"?[a,z]:[z,a];await one.send();await two.send();assert.equal(b.conflicts(),1);await two.send();
  const final=b.row().data;assert.equal(Math.round(final.goals[1].saved*100),26001);assert.equal(final.settings.reservaRules[0].value,5);assert.equal(two.state()._goalSync.conflicts.length,0);
 });
}
test("R2-1: reservas cambiadas igual en ambos lados permiten fusionar metas",()=>{
 const {c}=logic(),base=seed(),local=seed(),remote=seed();local._goalSync={owner,base:copy(base.goals),reserves:c.goalSyncReserves(base),revision:"r0",conflicts:[]};
 local.settings.reservaRules[0].value=5;remote.settings.reservaRules[0].value=5;local.goals[1].saved=260.01;remote.goals[0].saved=10.02;
 const m=c.goalSyncPull(local,remote,owner,"r1",false,true);assert.equal(m._goalSync.cloudOnly,false);assert.deepEqual(copy(m.goals).map(g=>Math.round(g.saved*100)),[1002,26001]);assert.equal(m._goalSync.conflicts.length,0);
});
test("R2-2: conflicto de reservas distintas conserva cuenta,deuda y demás estado local saneado",async()=>{
 const b=bank(),a=b.device(),z=b.device();
 a.edit(s=>({...s,settings:{...s.settings,reservaRules:[{id:"rA"}]}}));
 z.edit(s=>({...s,accounts:[{id:"account",value:456.78}],debts:[{id:"debt",value:99.23}],unknown:{keep:true},
   expenses:[{secret:"drop-expenses"}],bankTx:[{secret:"drop-bank"}],accountBalanceHistory:{secret:"drop-history"},assetValueHistory:{secret:"drop-asset"},profile:{secret:"drop-profile"},
   settings:{...s.settings,reservaRules:[{id:"rB"}],profile:{secret:"drop-settings-profile"}}}));
 const local=z.state();await a.send();await z.send();await z.send();
 const meta=z.state()._goalSync,record=meta.conflicts.find(r=>r.code==="goals_reserve_conflict");assert.ok(record);
 const expected=copy(local);for(const k of ["expenses","bankTx","accountBalanceHistory","assetValueHistory","profile","_goalSync"])delete expected[k];delete expected.settings.profile;assert.deepEqual(record.local,expected);
 assert.deepEqual(record.local.accounts,local.accounts);assert.deepEqual(record.local.debts,local.debts);assert.deepEqual(record.local.unknown,{keep:true});assert.equal(record.local.settings.theme,"keep");
 for(const k of ["expenses","bankTx","accountBalanceHistory","assetValueHistory","profile","_goalSync"])assert.equal(record.local[k],undefined,k);assert.equal(record.local.settings.profile,undefined);
 assert.equal(b.row().data._goalSync,undefined);z.c.mcSaveRaw("local-device",z.state());const raw=z.data.get("local-device_goal_conflicts");assert.ok(!raw.includes('drop-profile'));assert.ok(!JSON.parse(z.data.get("local-device"))._goalSync.conflicts);assert.equal(z.c.mcLoadRaw("local-device")._goalSync.conflicts.length,1);
});
test("R2 menor: resetSandbox elimina partición de conflictos y conserva el modo real",()=>{
 const {c,data}=logic(),meta={owner,conflicts:[{code:"goals_reserve_conflict",local:seed()}]};
 c.mcSaveRaw("micartera_sandbox",{...seed(),_goalSync:meta});c.mcSaveRaw("micartera_v3",{...seed(),_goalSync:meta});
 assert.ok(data.has("micartera_sandbox_goal_conflicts"));c.mcResetSandbox();assert.equal(data.has("micartera_sandbox_goal_conflicts"),false);assert.ok(data.has("micartera_v3_goal_conflicts"));
});
test("R2 menor: guardados ordinarios con los mismos registros no releen la partición",()=>{
 const {c,reads}=logic(),s={...seed(),_goalSync:{owner,conflicts:[]}};c.mcSaveRaw("normal",s);reads.length=0;
 c.mcSaveRaw("normal",{...s,budget:999},{expenses:false});c.mcSaveRaw("normal",{...s,budget:998},{expenses:false});
 assert.equal(reads.filter(k=>k==="normal_goal_conflicts").length,0);
});
