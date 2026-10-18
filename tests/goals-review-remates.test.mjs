import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {codeMask} from "../scripts/beta-source-code.mjs";
import {loadPureLogicFromFile} from "../scripts/load-pure-logic.mjs";
const root=new URL("../",import.meta.url),core=fs.readFileSync(new URL("src/modules/00-core.js",root),"utf8");
let app=fs.readFileSync(new URL("src/modules/11-app-main.js",root),"utf8");
const mutant=process.env.INC0410_REVIEW_MUTANT;
if(mutant){const [a,b]=mutant==="M9"?["if(!goalSyncMetadataOnly(cloudEffectState.current,state))","if(true)"]:["goalSyncAck(prev,u,sent,expected,r.updated_at)","goalSyncAck(prev,u,stateRef.current,expected,r.updated_at)"];assert.ok(app.includes(a));app=app.replace(a,b);}
function block(s,t){const mask=codeMask(s),start=mask.indexOf(t);assert.ok(start>=0,t);let i=mask.indexOf("{",start)+1,n=1;for(;n&&i<mask.length;i++){if(mask[i]==="{")n++;if(mask[i]==="}")n--;}assert.equal(n,0);return s.slice(start,i);}
const copy=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)),owner="synthetic-owner",key="test-goals";
function logic(){
 const c=loadPureLogicFromFile(),data=new Map(),writes=[];vm.createContext(c);
 c.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,v);writes.push({key:k,bytes:Buffer.byteLength(v)});},removeItem:k=>data.delete(k)};c.window.localStorage=c.localStorage;
 for(const name of [...core.matchAll(/^function (goalSync\w+|mergeGoalsThreeWay|mcSaveRaw|mcLoadRaw)\(/gm)].map(m=>m[1]))vm.runInContext(block(core,"function "+name+"("),c);
 return {c,data,writes};
}
function seed(){return {accounts:[],investments:[],debts:[],fixed:[],expenses:[],bankTx:[{id:"local-feed"}],goals:[{id:"g",target:500,saved:0,done:false,doneAt:null}],budget:1000,settings:{reservaRules:[{id:"r",value:1}]},reservaLog:[],_savedAt:10,_historyOwner:owner};}
function based(s){return {...copy(s),_goalSync:{owner,base:copy(s.goals),reserves:{rules:copy(s.settings.reservaRules),log:copy(s.reservaLog)},revision:"r0",conflicts:[]}};}
function machine(initial,pack){
 const x=logic(),c=x.c;let state=copy(initial),clock=100,resolvePush;const calls=[];
 class Clock extends Date{constructor(...a){super(...(a.length?a:[clock]));}static now(){return clock;}}c.Date=Clock;
 const deps={stateRef:{current:state},sessionRef:{current:{user:{id:owner}}},cloudUpdatedAtRef:{current:"r0"},pullOkRef:{current:null},uid:owner,useCallback:f=>f,
 setStateRaw:f=>{state=typeof f==="function"?f(state):f;deps.stateRef.current=state;},setSession:()=>{},
 cloud:{pullState:async()=>copy(pack),pushState:(u,s,r)=>{calls.push({u,s:copy(s),r});return new Promise(resolve=>{resolvePush=resolve;});}},
 syncCloudExpenses:async()=>{},reservaMensualAlDia:()=>{},showToast:()=>{},mcBootReady:()=>{},reconcileGemelosAutomaticos:x=>x,
 seedFlows:x=>x,fixMovInvasion:x=>x,fixRevoDupes:x=>x,fixInvAuto:x=>x,fixInvSold:x=>x,reconcileTR:x=>x,reconcileEarlyIncomeAnchors:x=>x,t:x=>x,navigator:{onLine:true}};
 const a=app.indexOf("const set=useCallback((updater)=>"),b=app.indexOf("},[]);",a)+"},[]);".length;
 const names=Object.keys(deps),f=vm.runInContext("(function("+names.join(",")+"){"+app.slice(a,b)+block(app,"const pushAppState=function(")+";"+block(app,"const syncFromCloud=function(")+";return {set,push:pushAppState,sync:syncFromCloud};})",c)(...names.map(k=>deps[k]));
 return {...x,deps,calls,state:()=>state,edit:fn=>{clock++;f.set(fn);},push:()=>f.push(owner,state),ack:()=>resolvePush({updated_at:"r1"}),sync:async()=>{f.sync(deps.sessionRef.current);await deps.pullOkRef.current;},effectSource:app.slice(app.indexOf("const cloudEffectState=useRef("),app.indexOf("// Al volver, los gastos",app.indexOf("const cloudEffectState=useRef("))),pushFunction:f.push};
}
test("a: OTA sin base con reservas idénticas siembra nube sin conflicto falso",()=>{
 const {c}=logic(),s=seed(),m=c.goalSyncPull(s,copy(s),owner,"r0",false);
 assert.equal(m._goalSync.cloudOnly,false);assert.equal(m._goalSync.conflicts.length,0);assert.deepEqual(copy(m._goalSync.base),s.goals);
});
test("b: registros cap3 en clave propia; 2000gastos no hinchan principal y migran sin perfil",()=>{
 const {c,data,writes}=logic(),s=based(seed());s.expenses=Array.from({length:2000},(_,i)=>({id:i,note:"synthetic expense "+"x".repeat(70)}));
 s._goalSync.conflicts=Array.from({length:5},(_,i)=>({code:"goals_reserve_conflict",local:{...copy(s),budget:i,profile:{private:true}}}));
 c.mcSaveRaw(key,s);c.mcSaveRaw(key,{...s,budget:900},{expenses:false});
 assert.ok(writes.filter(w=>w.key===key).every(w=>w.bytes<5000),JSON.stringify(writes));
 const main=JSON.parse(data.get(key));assert.equal(main._goalSync.conflicts,undefined);
 const loaded=c.mcLoadRaw(key);assert.equal(loaded._goalSync.conflicts.length,3);
 for(const r of loaded._goalSync.conflicts)for(const k of ["expenses","bankTx","accountBalanceHistory","assetValueHistory","profile"])assert.equal(r.local[k],undefined,k);
 assert.ok(data.has(key+"_goal_conflicts"));
 const legacy=copy(s);legacy.expenses=[];c.localStorage.setItem("legacy",JSON.stringify(legacy));c.mcLoadRaw("legacy");assert.ok(Buffer.byteLength(data.get("legacy"))<5000);
 console.log("PERSIST_BYTES "+JSON.stringify({expenses:s.expenses.length,mainWrites:writes.filter(w=>w.key===key).map(w=>w.bytes),separateRecords:loaded._goalSync.conflicts.length,conflictPartitionBytes:Buffer.byteLength(data.get(key+"_goal_conflicts"))}));
});
test("c: rechazo preserva bankTx y campos solo locales usando syncFromCloud real",async()=>{
 const local=based(seed()),remote=seed();local.goals[0].saved=20;local._savedAt=30;local.onlyLocal="keep";remote.settings.reservaRules=[{id:"remote"}];remote._savedAt=40;delete remote.bankTx;
 const b=machine(local,{data:remote,updated_at:"r1"});await b.sync();assert.deepEqual(copy(b.state().bankTx),local.bankTx);assert.equal(b.state().onlyLocal,"keep");assert.deepEqual(copy(b.state().settings.reservaRules),remote.settings.reservaRules);
});
test("d: un móvil conserva regla,presupuesto y meta tras push fallido si nube no cambió reservas",async()=>{
 const remote=seed(),local=based(remote);local.settings.reservaRules[0].value=5;local.budget=900;local.goals[0].saved=5;local._savedAt=30;
 const b=machine(local,{data:remote,updated_at:"r0"});await b.sync();assert.equal(b.state().budget,900);assert.equal(b.state().settings.reservaRules[0].value,5);assert.equal(b.state().goals[0].saved,5);assert.equal(b.state()._goalSync.conflicts.length,0);
});
test("e: ACK real por pushAppState no re-sella _savedAt",async()=>{
 const b=machine(based(seed()),null),before=b.state()._savedAt,p=b.push();b.ack();await p;assert.equal(b.state()._savedAt,before);
});
test("f: saved,target,done,doneAt se deciden como grupo financiero coherente",()=>{
 const {c}=logic(),base=seed().goals,l=copy(base),r=copy(base);l[0]={...l[0],saved:1000,done:true,doneAt:"synthetic-time"};r[0].target=5000;
 const m=c.mergeGoalsThreeWay(base,l,r).goals[0];assert.equal(m.done,false);assert.equal(m.saved,0);assert.equal(m.target,5000);assert.equal(m.doneAt,null);
});
test("g-M12: ACK real conserva foto enviada mientras se edita durante la petición",async()=>{
 const b=machine(based(seed()),null),sent=copy(b.state()),p=b.push();b.edit(s=>({...s,goals:[{...s.goals[0],saved:25}]}));b.ack();await p;
 assert.equal(b.calls[0].s.goals[0].saved,sent.goals[0].saved);assert.equal(b.state()._goalSync.base[0].saved,sent.goals[0].saved);assert.equal(b.state().goals[0].saved,25);
});
test("g-M9: contar pushes del efecto real mata el bucle de ACK",async()=>{
 const b=machine(based(seed()),null),c=b.c,refs=[],timers=new Map();let hook=0,effect,next=0;
 const render=vm.runInContext("(function(state,uid,useRef,useEffect,setTimeout,clearTimeout,pushAppState,t,showToast,syncFromCloud,sessionRef){"+b.effectSource+"})",c);
 function frame(){hook=0;render(b.state(),owner,v=>refs[hook++]||(refs[hook-1]={current:v}),(fn,deps)=>{if(!effect||deps.some((v,i)=>v!==effect.deps[i])){if(effect?.clean)effect.clean();effect={deps,clean:fn()};}},fn=>{timers.set(++next,fn);return next;},id=>timers.delete(id),b.pushFunction,x=>x,()=>{},()=>{},b.deps.sessionRef);}
 frame();for(let i=0;i<4;i++){if(!timers.size)break;const [id,fn]=timers.entries().next().value;timers.delete(id);fn();b.ack();for(let j=0;j<12;j++)await Promise.resolve();frame();}
 assert.equal(b.calls.length,1);assert.equal(timers.size,0);
});
test("bajos: telemetría una vez por registro tras dos arranques",()=>{
 const x=logic(),c=x.c,s=based(seed());s._goalSync.conflicts=[{code:"goals_reserve_conflict",local:{goals:s.goals,budget:900}}];c.mcSaveRaw("micartera_v3",s);
 let current=s,logs=0;const deps={state:current,uid:owner,cloud:{logEvent:()=>{logs++;}},useRef:v=>({current:v}),useEffect:f=>f()};
 const start=app.indexOf("const notifyGoalConflicts=function("),end=app.indexOf("const bankSyncing=useRef(",start),names=Object.keys(deps);
 assert.ok(start>=0&&end>start);
 const mount=vm.runInContext("(function("+names.join(",")+"){"+app.slice(start,end)+"})",c);mount(...names.map(k=>deps[k]));mount(...names.map(k=>deps[k]));assert.equal(logs,1);
 const reboot=logic();for(const [k,v] of x.data)reboot.data.set(k,v);
 const again={...deps,state:reboot.c.mcLoadRaw("micartera_v3")};
 vm.runInContext("(function("+names.join(",")+"){"+app.slice(start,end)+"})",reboot.c)(...names.map(k=>again[k]));assert.equal(logs,1);
});
test("bajos: SIGNED_OUT borra registros del titular y no los recupera el siguiente guardado",()=>{
 const x=logic(),c=x.c;let current=based(seed());current._goalSync.conflicts=[{code:"goals_reserve_conflict",local:{goals:current.goals}}];c.mcSaveRaw("micartera_v3",current);
 const a=app.indexOf("const prev=sessionRef.current;",app.indexOf("const off=cloud.onAuth")),z=app.indexOf("// Vuelta del email",a);
 const auth=vm.runInContext("(function(s,ev,sessionRef,setSession,set){"+app.slice(a,z)+"})",c);
 auth(null,"SIGNED_OUT",{current:{user:{id:owner}}},()=>{},f=>{current=f(current);});c.mcSaveRaw("micartera_v3",current,{expenses:false});
 assert.ok(!current._goalSync || !(current._goalSync.conflicts||[]).length);const restored=c.mcLoadRaw("micartera_v3");assert.ok(!restored._goalSync || !(restored._goalSync.conflicts||[]).length);
 c.mcSaveRaw("micartera_v3",{...current,_goalSync:{owner,conflicts:[{code:"goals_reserve_conflict",local:{goals:current.goals}}]}},{expenses:false});
 assert.ok(!c.mcLoadRaw("micartera_v3")._goalSync.conflicts.length,"un volcado pendiente no resucita los registros al salir");
 c.goalSyncActivate("other-mode",owner);c.mcSaveRaw("other-mode",{...seed(),_goalSync:{owner:"other",conflicts:[{code:"goals_reserve_conflict",local:{goals:seed().goals}}]}});
 c.goalSyncClear("other-mode",owner);assert.equal(c.mcLoadRaw("other-mode")._goalSync.conflicts.length,1,"salir de uno no borra registros de otro titular");
});
