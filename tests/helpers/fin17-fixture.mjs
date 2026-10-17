// SDK y dos clientes aislados: ejecuta las fuentes reales, sin red ni escrituras ajenas.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

import {createRequire} from 'node:module';
import {createLogicSandbox} from '../../scripts/load-pure-logic.mjs';
const own=createRequire(new URL('../../package.json',import.meta.url));
const {transformSync}=own('esbuild');
const root=new URL('../../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8').replace(/\r\n/g,'\n');
const files=JSON.parse(read('src/build-order.json')).slice(0,9).map(f=>'src/modules/'+f);
const original=files.map(read).join('\n'),main=read('src/modules/11-app-main.js');
const serverSource=read('supabase/functions/_shared/presupuesto.ts');
const server=await import('data:text/javascript;base64,'+Buffer.from(transformSync(serverSource,{loader:'ts',format:'esm'}).code).toString('base64'));

const uid='synthetic-fin17-owner',uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const pending={id:uuid(1),extId:'pending-reference',source:'ob',ent:'caixabank',date:'2026-10-16T12:00:00.000Z',amount:3.2,merchant:'Synthetic FIN17 purchase',obName:'Synthetic FIN17 purchase',obAcc:'synthetic-account-a',category:'otros',obPending:true};
const booked={...pending,id:uuid(2),extId:'booked-reference',date:'2026-10-16T12:00:00.001Z',obOrd:2,obPending:undefined};
const kept={...pending,extId:booked.extId,obPendingRef:pending.extId,obPending:undefined};
const seed=()=>({_historyOwner:uid,accounts:[{id:'synthetic-daily',ent:'caixabank',role:'diario',spendFrom:true,value:1000}],settings:{expenseBanks:['caixabank']},expenses:[{...pending},{...booked}],bankTx:[],gemelos:[],deleted:[],fixed:[],debts:[],oneoffs:[],flows:[],investments:[],goals:[],assets:[],budget:1000,lastBankSync:1792152000000});
const copy=x=>JSON.parse(JSON.stringify(x));
const evidence=[];
function memory(){const map=new Map();return{map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};}
function database(){return{rows:[],queries:[],events:[],pendingWrites:[],failDelete:false};}
function client(db,label,state=seed(),source=original){
 const storage=memory();let now=Date.parse('2026-10-18T12:00:00.000Z');
 class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 const e={db,label,storage,state:copy(state),owner:uid,sessions:0,advanceDays:n=>{now+=n*864e5;}};
 const sdk={auth:{getSession:async()=>{if(db.onSession)db.onSession(e,++e.sessions);return {data:{session:{user:{id:e.owner},expires_at:now/1000+3600}},error:null};}},from(table){
  if(table==='app_events')return{insert:async row=>{db.events.push({client:label,row:copy(row)});return{error:null};}};
  if(table==='app_state'){const q={update(row){db.stateWrite=copy(row);return q;},upsert(row){db.stateWrite=copy(row);return q;},eq(){return q;},select(){return q;},maybeSingle:async()=>({data:db.appState||null,error:null}),then(resolve,reject){return Promise.resolve({data:[{updated_at:'synthetic-state-ack'}],error:null}).then(resolve,reject);}};return q;}
  assert.equal(table,'expenses');let op='select',limit=Infinity,order=null,payload=null,options=null,returning=false;const filters=[];
  const q={select(){returning=true;return q;},delete(){op='delete';return q;},update(row){op='update';payload=copy(row);return q;},upsert(row,opts){op='upsert';payload=copy(row);options=copy(opts);return q;},eq(k,v){filters.push(['eq',k,v]);return q;},gte(k,v){filters.push(['gte',k,v]);return q;},lt(k,v){filters.push(['lt',k,v]);return q;},limit(n){limit=n;return q;},order(k,o){order=[k,o.ascending];return q;},abortSignal(){return q;},then(resolve,reject){
   const promise=Promise.resolve().then(()=>{
    // Authenticated SDK surface is simulated; this is not live RLS verification.
    let rows=db.rows.filter(r=>r.user_id===e.owner&&filters.every(([op,k,v])=>op==='eq'?r[k]===v:op==='gte'?Date.parse(r[k])>=Date.parse(v):k==='fecha'?Date.parse(r[k])<Date.parse(v):r[k]<v));
    if(order)rows.sort((a,b)=>(a[order[0]]<b[order[0]]?-1:1)*(order[1]?1:-1));rows=rows.slice(0,limit);
    const trace={client:label,sessionOwner:e.owner,op,filters:copy(filters),limit:Number.isFinite(limit)?limit:null,matched:rows.map(r=>r.id)};db.queries.push(trace);
    if(op==='delete'){
     if(db.failDelete)return{data:null,error:{code:'SYNTHETIC_OFFLINE'}};
     db.rows=db.rows.filter(r=>!rows.includes(r));trace.deleted=rows.map(r=>r.id);
    }else if(op==='upsert'){
     assert.equal(options.onConflict,'user_id,fecha,importe,comercio');assert.equal(options.ignoreDuplicates,true);
     const columns=options.onConflict.split(',');rows=[];
     for(const row of Array.isArray(payload)?payload:[payload]){const exists=db.rows.some(r=>columns.every(k=>r[k]===row[k]));if(!exists){assert.ok(!db.rows.some(r=>r.id===row.id),'mock preserves UUID primary key');db.rows.push(copy(row));rows.push(row);}}
     trace.payload=payload;trace.options=options;trace.inserted=rows.length>0;
    }else if(op==='update')rows.forEach(r=>Object.assign(r,payload));
    return{data:op==='select'||returning?copy(rows):null,error:null};
   });if(op==='upsert')db.pendingWrites.push(promise);return promise.then(resolve,reject);
  }};return q;
 }};
 e.sdk=sdk;
 const sandbox=createLogicSandbox({localStorage:storage,AbortController,Date:Clock});sandbox.window.localStorage=storage;sandbox.window.supabase={createClient:()=>sdk};
 const c=vm.createContext(sandbox);vm.runInContext(source,c,{filename:'frozen-fbff-first-nine-modules'});e.c=c;e.cloud=vm.runInContext('cloud',c);
 e.wire=x=>({id:x.id,user_id:uid,fecha:x.date,importe:x.amount,comercio:x.merchant,cat:x.category,ob_name:x.obName,source:c.expenseSourceForCloud(x)});
 e.stage=()=>{e.state=c.obPendingAbsorbedState({...e.state,expenses:[{...kept}]},e.state);return e.state;};
 e.drain=async()=>c.obAbsorbedRetry(()=>e.state,()=>e.owner,fn=>{e.state=fn(e.state);});
 e.spent=()=>Math.round(c.dashboardBudgetStats(e.state).spent*100);
 e.serverSpent=()=>Math.round(server.statsDelMes(server.filasComoLaApp(db.rows,e.state.deleted,e.state.obAbsorbedPending,e.state._historyOwner,e.state.obAbsorbedConfirmed),e.state,Date.parse('2026-10-01T00:00:00Z')).spent*100);
 e.prune=()=>{const key=c.obAbsorptionKey(booked),at=e.state.deletedAt[key];for(let i=0;i<500;i++){const delta=c.lapidaPon(e.state,'synthetic-newer-'+i,at+i+1);e.state={...e.state,...delta};}assert.ok(!e.state.deleted.includes(key));return key;};
 e.sync=async()=>{
  const a=main.indexOf('  const syncCloudExpenses=function(){'),z=main.indexOf('\n  // Al iniciar sesión:',a);assert.ok(a>=0&&z>a);
  const factory=vm.runInContext('(function(state,session){const stateRef={current:state},sessionRef={current:session};const wR={current:false},wS={current:0},wP={current:null},wC={current:[]},wRead={current:null};const set=fn=>stateRef.current=fn(stateRef.current);const drains=[];const retryObAbsorbedCloud=()=>{const p=obAbsorbedRetry(()=>stateRef.current,()=>sessionRef.current.user.id,set);drains.push(p);return p;};'+main.slice(a,z)+'return {run:syncCloudExpenses,state:()=>stateRef.current,drains};})',c);
  const api=factory(e.state,{user:{id:e.owner}});await api.run();await Promise.all(db.pendingWrites);await Promise.all(api.drains);e.state=api.state();
 };
 return e;
}
function freshPair(){const db=database(),a=client(db,'A'),b=client(db,'B');db.rows=[a.wire(pending),a.wire(booked)];return{db,a,b};}
async function h1({prune=true,retainBook=true,deleteError=false}={}){
 const {db,a,b}=freshPair();a.stage();assert.equal(a.spent(),320);assert.equal(a.state.obAbsorbedPending.length,1);
 db.failDelete=deleteError;await a.drain();
 if(deleteError){assert.equal(a.state.obAbsorbedPending.length,1);assert.equal(db.rows.length,2);}else{assert.equal(a.state.obAbsorbedPending.length,0);assert.deepEqual(db.rows.map(r=>r.id),[pending.id]);}
 const before={aLocal:a.spent(),server:a.serverSpent(),rows:copy(db.rows),pending:a.state.obAbsorbedPending.length};
 const key=prune?a.prune():a.c.obAbsorptionKey(booked);
 // The second new-version client's retained local history is separate from shared metadata.
 b.state={...copy(a.state),expenses:retainBook?[{...pending},{...booked}]:[{...pending}]};
 const protectedBefore=b.c.expenseIsTombstoned(booked,b.c.expenseDeletedSet(b.state));
 await b.sync();
 const result={case:'H1',prune,retainBook,deleteError,before,key,protectedBefore,after:{aLocal:a.spent(),bLocal:b.spent(),server:b.serverSpent(),rows:copy(db.rows),pending:b.state.obAbsorbedPending.length},queries:copy(db.queries),confirmed:copy(a.state.obAbsorbedConfirmed||[])};
 evidence.push(result);return result;
}
function h2(kind){
 const {db,a}=freshPair();
 if(kind==='full'){
  const template={owner:uid,id:uuid(100),key:a.c.obAbsorptionKey({...booked,extId:'unresolved-0'}),keepId:kept.id,keepKey:a.c.obAbsorptionKey(kept),amount:3.2,merchant:booked.merchant};
  a.state.obAbsorbedPending=Array.from({length:200},(_,i)=>({...template,id:uuid(100+i),key:a.c.obAbsorptionKey({...booked,extId:'unresolved-'+i})}));
  assert.equal(a.c.obAbsorbedPersist(uid,a.state.obAbsorbedPending),true);
 }else{assert.equal(kind,'missing-owner');delete a.state._historyOwner;}
 a.stage();const result={case:'H2',kind,local:a.spent(),server:a.serverSpent(),pending:(a.state.obAbsorbedPending||[]).length,expenses:copy(a.state.expenses),deleted:a.state.deleted};evidence.push(result);return result;
}

export {client,database,seed,pending,booked,kept,uid,uuid,h1,h2,server,original,read,evidence};
