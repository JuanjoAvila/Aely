import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {codeMask} from "../scripts/beta-source-code.mjs";
import {loadPureLogicFromFile} from "../scripts/load-pure-logic.mjs";
const root=new URL("../",import.meta.url);
let core=fs.readFileSync(new URL("src/modules/00-core.js",root),"utf8");
const app=fs.readFileSync(new URL("src/modules/11-app-main.js",root),"utf8");
const mutant=process.env.INC0410_MUTANT;
const mutations={
 "quitar-base":["mergeGoalsThreeWay(kept?kept.base:null,","mergeGoalsThreeWay(null,"],
 "sumar":["let source=right;","let source=right; if(k===\"saved\" && old && left[k]!==old[k] && right[k]!==old[k]) source={saved:left[k]+right[k]-old[k]};"],
 "resucitar":["if(!right){ if(!old || !goalSyncEqual(left,old))","if(!right){ if(true)"]
 ,"quitar-proteccion-reservas":["const reject=!dropLocal && (","const reject=false && !dropLocal && ("]
};
if(mutant){const [from,to]=mutations[mutant]||[];assert.ok(from&&core.includes(from),"mutante aplicable");core=core.replace(from,to);}
function block(source,token){
 const mask=codeMask(source),start=mask.indexOf(token);assert.ok(start>=0,token);
 const open=mask.indexOf("{",start);let end=open+1,depth=1;
 for(;depth&&end<mask.length;end++){if(mask[end]==="{")depth++;else if(mask[end]==="}")depth--;}
 assert.equal(depth,0);return source.slice(start,end);
}
function logic(){
 const c=loadPureLogicFromFile();vm.createContext(c);
 for(const name of ["goalSyncEqual","goalSyncCopy","goalSyncReserves","mergeGoalsThreeWay","goalSyncPull","goalSyncAck","goalSyncMetadataOnly","slimForCloud","mcLogEvent"]){vm.runInContext(block(core,"function "+name+"("),c);}
 return c;
}
const clone=x=>JSON.parse(JSON.stringify(x)),owner="synthetic-owner";
const goals=()=>[{id:"a",name:"Sintetica A",target:1000,saved:100,extra:{keep:true}},{id:"b",name:"Sintetica B",target:2000,saved:200}];
const clean=x=>clone(x);
test("metas y campos disjuntos conservan ambas ediciones, incluidos campos desconocidos y ausentes",()=>{
 const c=logic(),base=goals(),l=clone(base),r=clone(base);l[0].saved=100.01;r[1].saved=200.02;
 assert.deepEqual(clean(c.mergeGoalsThreeWay(base,l,r).goals).map(g=>g.saved),[100.01,200.02]);
 r[0].name="Cambio remoto";delete l[0].extra;
 const m=c.mergeGoalsThreeWay(base,l,r);assert.equal(m.goals[0].name,"Cambio remoto");assert.equal(m.goals[0].saved,100.01);assert.equal("extra" in m.goals[0],false);assert.equal(m.conflicts.length,0);
});
test("mismo campo: nube gana sin sumar; borrador local privado conserva el valor exacto",()=>{
 const c=logic(),base=goals(),l=clone(base),r=clone(base);l[0].saved=100.01;r[0].saved=100.02;
 const m=c.mergeGoalsThreeWay(base,l,r);assert.equal(m.goals[0].saved,100.02);assert.equal(m.conflicts[0].local.saved,100.01);assert.deepEqual(clean(m.conflicts[0].fields),["saved"]);
 const prev={goals:l,_goalSync:{owner,base,revision:"r0",conflicts:[]}};
 const once=c.goalSyncPull(prev,{goals:r},owner,"r1",false);const again=c.goalSyncPull({...once,goals:l},{goals:r},owner,"r1",false);
 assert.equal(once._goalSync.conflicts.length,1);assert.equal(again._goalSync.conflicts.length,1);
 const payload=c.slimForCloud({...once,expenses:[],bankTx:[]});assert.equal(payload._goalSync,undefined);assert.equal(payload.goals[0].saved,100.02);
 assert.deepEqual(clean(c.mcLogEvent("error","GOALS_SYNC_CONFLICT","dato privado 123")),{message:"goals_sync_conflict",detail:'{"code":"goals_sync_conflict"}'});
});
test("borrado contra base borra en ambos órdenes; una edición de esa meta gana al borrado",()=>{
 const c=logic(),base=goals(),gone=[clone(base[1])];
 assert.deepEqual(clean(c.mergeGoalsThreeWay(base,base,gone).goals).map(g=>g.id),["b"]);
 assert.deepEqual(clean(c.mergeGoalsThreeWay(base,gone,base).goals).map(g=>g.id),["b"]);
 const edited=clone(base);edited[0].name="Editada";
 for(const [l,r] of [[edited,gone],[gone,edited]])assert.equal(c.mergeGoalsThreeWay(base,l,r).goals.find(g=>g.id==="a").name,"Editada");
});
test("sin base no se inventa un merge; cambio de titular no hereda borradores",()=>{
 const c=logic(),base=goals(),local=clone(base);local[0].saved=101;
 const m=c.mergeGoalsThreeWay(null,local,base);assert.equal(m.goals[0].saved,100);assert.equal(m.conflicts[0].local[0].saved,101);
 const dropped=c.goalSyncPull({goals:local,_goalSync:{owner:"another",base,conflicts:[{private:true}]}},{goals:base},owner,"r1",true);
 assert.equal(dropped._goalSync.conflicts.length,0);assert.equal(dropped._goalSync.owner,owner);
});
test("ACK conserva la foto enviada y no absorbe ediciones posteriores ni ACK de otra base",()=>{
 const c=logic(),base=goals(),sent={goals:clone(base)},local=clone(base);local[0].saved=101;
 const prev={goals:local,_savedAt:1,_goalSync:{owner,base,revision:"r0",conflicts:[]}};
 const ack=c.goalSyncAck(prev,owner,sent,"r0","r1");assert.equal(ack.goals[0].saved,101);assert.equal(ack._goalSync.base[0].saved,100);assert.equal(c.goalSyncMetadataOnly(prev,ack),true);
 assert.equal(c.goalSyncAck(ack,owner,sent,"r0","r2"),ack);
 assert.equal(c.goalSyncAck(ack,"another",sent,"r1","r2"),ack);
 assert.equal(c.goalSyncMetadataOnly(prev,{...ack,goals:clone(local)}),false);
});
function transport(){
 let clock=Date.parse("2026-11-02T12:00:00Z");
 class Clock extends Date{constructor(...a){super(...(a.length?a:[clock]));}static now(){return clock;}}
 const seed={budget:1000,accounts:[],investments:[],debts:[],fixed:[],expenses:[],goals:goals(),settings:{reservaRules:[]},reservaLog:[],_savedAt:clock-10000,_historyOwner:owner};
 let row={user_id:owner,data:clone(seed),updated_at:"r0"};let conflicts=0;
 const sb={from(){let body,mode="read",filters=[];const q={update(v){body=v;mode="update";return q;},upsert(v){body=v;mode="upsert";return q;},eq(k,v){filters.push([k,v]);return q;},select(){if(mode==="read")return q;const match=mode==="upsert"||filters.every(([k,v])=>row[k]===v);if(match)row=clone(body);else conflicts++;return Promise.resolve({data:match?[{updated_at:row.updated_at}]:[],error:null});},maybeSingle:async()=>({data:clone(row),error:null})};return q;}};
 function device(){
  const c=logic();c.Date=Clock;let state=clone(seed);Object.assign(state,c.goalSyncPull(state,seed,owner,"r0",false));
  const stateRef={current:state},cloudUpdatedAtRef={current:"r0"},pullOkRef={current:null},sessionRef={current:{user:{id:owner}}};
  const cloud=vm.runInContext("(function(sb){return {"+["async pullState(","async pushState("].map(t=>block(core,t)).join(",")+"};})",c)(sb);
  const deps={cloud,stateRef,cloudUpdatedAtRef,pullOkRef,sessionRef,uid:owner,useCallback:f=>f,setStateRaw:f=>{state=f(state);stateRef.current=state;},
   reconcileGemelosAutomaticos:x=>x,syncCloudExpenses:()=>Promise.resolve(),showToast:()=>{},mcBootReady:()=>{},t:x=>x,navigator:{onLine:true},
   seedFlows:x=>x,fixMovInvasion:x=>x,fixRevoDupes:x=>x,fixInvAuto:x=>x,fixInvSold:x=>x,reconcileTR:x=>x,reconcileEarlyIncomeAnchors:x=>x,reservaMensualAlDia:()=>Promise.resolve()};
  const start=app.indexOf("const set=useCallback((updater)=>"),end=app.indexOf("},[]);",start)+"},[]);".length;
  const ef=app.indexOf("// Empuja el estado a la nube (debounced)"),a=app.indexOf("const tmr=setTimeout(function(){",ef)+"const tmr=setTimeout(function(){".length,b=app.indexOf("}, 1200);",a);
  const send=app.slice(a,b).replace("pushAppState(uid,","return pushAppState(uid,");
  const names=Object.keys(deps),factory=vm.runInContext("(function("+names.join(",")+"){"+app.slice(start,end)+block(app,"const pushAppState=function(")+";"+block(app,"const syncFromCloud=function(")+";return {set,send:function(state){const uploadState=state;"+send+"}};})",c);
  const api=factory(...names.map(k=>deps[k]));
  return {state:()=>clone(state),edit:f=>{clock+=1000;api.set(f);},send:async()=>{clock+=1000;await api.send(state);await pullOkRef.current;},monthly:(s,id)=>c.applyReservaMensual(s,clock,id)};
 }
 return {device,row:()=>clone(row),conflicts:()=>conflicts};
}
test("transporte real: conflicto CAS conserva metas disjuntas y ACK no produce un nuevo payload privado",async()=>{
 const b=transport(),a=b.device(),z=b.device();
 a.edit(s=>({...s,goals:s.goals.map(g=>g.id==="a"?{...g,saved:100.01}:g)}));z.edit(s=>({...s,goals:s.goals.map(g=>g.id==="b"?{...g,saved:200.02}:g)}));
 await a.send();await z.send();assert.equal(b.conflicts(),1);await z.send();assert.deepEqual(b.row().data.goals.map(g=>g.saved),[100.01,200.02]);assert.equal(b.row().data._goalSync,undefined);
});
test("transporte real: mismo campo gana nube y el borrador local sobrevive al ACK",async()=>{
 const b=transport(),a=b.device(),z=b.device();
 a.edit(s=>({...s,goals:s.goals.map(g=>g.id==="a"?{...g,saved:100.01}:g)}));z.edit(s=>({...s,goals:s.goals.map(g=>g.id==="a"?{...g,saved:100.02}:g)}));
 await a.send();await z.send();await z.send();assert.equal(b.row().data.goals[0].saved,100.01);assert.equal(z.state()._goalSync.conflicts[0].local.saved,100.02);
});
test("acople: rA/rB conserva la nube entera y guarda el estado local entero como conflicto privado",async()=>{
 const b=transport(),a=b.device(),z=b.device();
 function reserve(d,id,goalId,value){d.edit(s=>d.monthly({...s,settings:{...s.settings,reservaRules:[{id,goalId,kind:"fixed",value,mensual:true}]}},id));}
 reserve(a,"rA","a",1);reserve(z,"rB","b",2);
 z.edit(s=>({...s,unknownLocal:{keep:"local-entero"},budget:777}));const local=z.state();
 await a.send();const cloud=b.row().data;await z.send();await z.send();
 const state=b.row().data;assert.deepEqual(state.goals.map(g=>g.saved),[101,200]);
 assert.deepEqual(state.reservaLog.map(x=>x.ruleId),["rA"]);assert.deepEqual(state.settings.reservaRules.map(x=>x.id),["rA"]);
 assert.equal(state.budget,cloud.budget);assert.equal(state.unknownLocal,undefined);assert.equal(state._goalSync,undefined);
 const record=z.state()._goalSync.conflicts.find(x=>x.code==="goals_reserve_conflict");
 const saved=clone(local);delete saved._goalSync;assert.deepEqual(record.local,saved);
 assert.deepEqual(record.local.reservaLog.map(x=>x.ruleId),["rB"]);assert.equal(record.local.goals[1].saved,202);
 assert.equal(record.local.unknownLocal.keep,"local-entero");
});
test("acople: divergencia solo en reglas O solo en log, en cualquiera de las ramas, impide fusionar metas",()=>{
 const c=logic(),base=goals(),reserves={rules:[],log:[]};
 for(const branch of ["local","remote"])for(const field of ["rules","log"]){
  const prev={goals:clone(base),settings:{reservaRules:[]},reservaLog:[],_goalSync:{owner,base,reserves,revision:"r0",conflicts:[]}};
  const remote={goals:clone(base),settings:{reservaRules:[]},reservaLog:[]};prev.goals[0].saved=101;remote.goals[1].saved=202;
  const changed=branch==="local"?prev:remote;if(field==="rules")changed.settings.reservaRules=[{id:"r-synthetic"}];else changed.reservaLog=[{id:"log-synthetic",amount:1}];
  const m=c.goalSyncPull(prev,remote,owner,"r1",false);assert.equal(m._goalSync.cloudOnly,true,branch+field);assert.deepEqual(clean(m.goals),remote.goals);assert.equal(m._goalSync.conflicts[0].code,"goals_reserve_conflict");
 }
});
test("acople: ACK retiene reglas y log enviados; sin divergencia las metas disjuntas sí se fusionan",()=>{
 const c=logic(),base=goals(),snapshot={goals:base,settings:{reservaRules:[{id:"r"}]},reservaLog:[{id:"log"}]};
 const ack=c.goalSyncAck(snapshot,owner,snapshot,null,"r0");assert.deepEqual(clean(ack._goalSync.reserves),{rules:snapshot.settings.reservaRules,log:snapshot.reservaLog});
 const local=clone(ack),remote=clone(snapshot);local.goals[0].saved=101;remote.goals[1].saved=202;
 const m=c.goalSyncPull(local,remote,owner,"r1",false);assert.equal(m._goalSync.cloudOnly,false);assert.deepEqual(clean(m.goals).map(g=>g.saved),[101,202]);
 const dropped=c.goalSyncPull(local,remote,"another","r1",true);assert.equal(dropped._goalSync.conflicts.length,0);assert.equal(dropped._goalSync.cloudOnly,false);
});
test("registro privado: backupState real tampoco sube base ni estado local en conflicto",async()=>{
 const c=logic(),sent=[];
 const sb={from:()=>({upsert:async v=>{sent.push(v);return {error:null};},delete:()=>({eq:()=>({lt:async()=>({})})})})};
 const backup=vm.runInContext("(function(sb){return {"+block(core,"async backupState(")+"};})",c)(sb);
 const state={goals:goals(),expenses:[],_goalSync:{owner,base:goals(),conflicts:[{code:"goals_reserve_conflict",local:{unknown:"solo-local"}}]}};
 await backup.backupState(owner,state);assert.equal(sent.length,1);assert.equal(sent[0].data._goalSync,undefined);
 assert.deepEqual(clean(sent[0].data.goals),state.goals);assert.equal(state._goalSync.conflicts[0].local.unknown,"solo-local");
});
test("ACK de metadata conserva el timer de una edición posterior al envío",()=>{
 const c=logic(),refs=[],timers=new Map();let hook=0,effect=null,next=0,sent=null;
 const start=app.indexOf("const cloudEffectState=useRef("),end=app.indexOf("// Al volver, los gastos",start);
 assert.ok(start>=0&&end>start);const source=app.slice(start,end);
 const run=vm.runInContext("(function(state,uid,useRef,useEffect,setTimeout,clearTimeout,pushAppState,t,showToast,syncFromCloud,sessionRef){"+source+"})",c);
 const render=state=>{hook=0;run(state,owner,v=>refs[hook++]||(refs[hook-1]={current:v}),(fn,deps)=>{
  if(!effect||deps.some((v,i)=>v!==effect.deps[i])){if(effect&&effect.cleanup)effect.cleanup();effect={deps,cleanup:fn()};}
 },fn=>{timers.set(++next,fn);return next;},id=>timers.delete(id),(u,s)=>{sent=s;return Promise.resolve(null);},x=>x,()=>{},()=>{},{current:{user:{id:owner}}});};
 const base={goals:goals(),_goalSync:{owner,base:goals(),revision:"r0",conflicts:[]}};
 render(base);const later={...base,goals:clone(base.goals)};later.goals[0].saved=101;render(later);
 const ack=c.goalSyncAck(later,owner,base,"r0","r1");render(ack);
 assert.equal(timers.size,1,"ACK privado no debe cancelar el debounce que aún tiene una edición por subir");
 Array.from(timers.values())[0]();assert.equal(sent.goals[0].saved,101);
});
