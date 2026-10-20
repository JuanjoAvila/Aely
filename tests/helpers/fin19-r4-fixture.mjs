import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createLogicSandbox,extractPureLogicSource} from '../../scripts/load-pure-logic.mjs';
export const plain=x=>JSON.parse(JSON.stringify(x)),now=Date.parse('2026-10-20T12:00:00Z'),owner='synthetic-owner';
export const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
export const cents=rows=>rows.reduce((n,e)=>n+Math.round(Number(e.amount??e.importe)*100),0);
export function section(html,start,end){const a=html.indexOf(start),b=html.indexOf(end,a);assert.ok(a>=0&&b>a,'real callback anchors');return html.slice(a,b);}
export function wireRows(n=3500){return Array.from({length:n},(_,i)=>({id:uuid(i+1),user_id:owner,fecha:'2026-10-19T10:00:00.000Z',importe:(i+1)/100,comercio:'Compra '+i,cat:'otros',source:'ob:'+(i%2?'sabadell':'trade_republic')+'#refref-'+i+'#accaccount-'+(i%2),ob_name:'Compra '+i}));}
export function state(rows){return {_historyOwner:owner,expenses:rows,accounts:[],settings:{expenseBanks:['trade_republic','sabadell','caixabank']},fixed:[],debts:[],oneoffs:[],flows:[],goals:[],investments:[],assets:[],bankTx:[],gemelos:[],deleted:[],deletedAt:{},obAbsorbedPending:[],obAbsorbedConfirmed:[],lastSync:1,budget:1000};}
export function environment(html,remote,{deleteFails=false}={}){
 const env={remote:plain(remote),writes:[],uploads:[],deletes:0,sets:0,timers:[],disk:new Map(),deleteFails};
 const storage={getItem:k=>env.disk.get(k)??null,setItem:(k,v)=>env.disk.set(k,String(v)),removeItem:k=>env.disk.delete(k)};
 const sb={auth:{getSession:async()=>({data:{session:{user:{id:owner},expires_at:9e9}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from(table){
  const filters=[];let patch=null,selected=false;
  const q={select(){selected=true;return q;},update(p){patch=p;return q;},eq(k,v){filters.push([k,v]);return q;},then(ok,no){return Promise.resolve().then(()=>{
   assert.equal(table,'expenses');const hit=env.remote.filter(r=>filters.every(([k,v])=>r[k]===v));
   if(patch){env.writes.push({filters:plain(filters),patch:plain(patch)});hit.forEach(r=>Object.assign(r,patch));}
   return {data:selected?plain(hit):null,error:null};
  }).then(ok,no);}};return q;
 }};
 const RealDate=Date;
 const c=createLogicSandbox({localStorage:storage,Date:class extends RealDate{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}}});
 c.window.localStorage=storage;c.window.supabase={createClient:()=>sb};vm.createContext(c);vm.runInContext(extractPureLogicSource(html),c);
 env.c=c;const cloud=vm.runInContext('cloud',c);env.cloud=cloud;
 vm.runInContext('USER_OVERRIDES={};USER_CAT_RULES={};',c);
 env.stateRef={current:state(Array.from(c.expensesFromRows(env.remote,owner)))};
 cloud.pullExpenses=proof=>{if(proof){proof.valid=true;proof.userId=owner;}return Promise.resolve(env.remote);};
 cloud.pullState=()=>Promise.resolve(null);
 for(const m of ['setExpenseCat','setExpenseRecibo','setExpenseDup'])cloud[m]=async(...args)=>{env.writes.push({method:m,args:plain(args)});return 1;};
 cloud.logEvent=()=>Promise.resolve();
 cloud.addExpense=async e=>{env.uploads.push(plain(e));const r={id:e.id,user_id:owner,fecha:e.date,importe:e.amount,comercio:e.merchant,ob_name:e.obName,cat:e.category,source:c.expenseSourceForCloud(e)},i=env.remote.findIndex(x=>x.id===r.id);if(i<0)env.remote.push(r);else env.remote[i]=r;return true;};
 cloud.deleteExpense=async e=>{env.deletes++;if(env.deleteFails)throw Error('synthetic failed DELETE');env.remote=env.remote.filter(r=>r.id!==e.id);};
 env.set=u=>{const prev=env.stateRef.current;let next=typeof u==='function'?u(prev):u;if(next===prev)return;
  if(next.expenses!==prev.expenses||next.gemelos!==prev.gemelos||next.deleted!==prev.deleted)next=c.reconcileGemelosAutomaticos(next,prev);
  env.sets++;env.stateRef.current=Object.assign({},next,{_savedAt:now});
 };
 const full=section(html,'  const syncCloudExpenses=function(){','  // Al iniciar sesión:');
 const factory=vm.runInContext('(function(api){const stateRef=api.stateRef,sessionRef={current:{user:{id:"'+owner+'"}}},set=api.set;const wR={current:false},wS={current:0},wP={current:null},wC={current:[]},wRead={current:null};const retryObAbsorbedCloud=function(){return Promise.resolve();};'+full+'return syncCloudExpenses;})',c);
 env.pull=factory(env);
 const counter=section(html,'      // "nuevo" =','      set(function(prev){');
 env.count=vm.runInContext('(function(stateRef,incoming){'+counter+'return count;})',c);
 const timer=(fn,ms)=>{env.timers.push({fn,ms});return env.timers.length;};
 const del=vm.runInContext('(function(state,set,cloud,setTimeout){const keyOfE=keyOfExpense,undoTimerRef={current:null},undoDeleteRef={current:null},clearTimeout=function(){},setUndoDelete=function(){};'+section(html,'  const delExpense=function(e){','  /* Posible repetido OB')+'return {del:delExpense,undo:undoLastDelete};})',c);
 env.controls=()=>del(env.stateRef.current,env.set,cloud,timer);
 env.flush=async()=>{for(let i=0;i<6;i++){for(const t of env.timers.filter(t=>t.ms===0&&!t.ran)){t.ran=true;t.fn();}await Promise.resolve();}await new Promise(resolve=>setImmediate(resolve));};
 env.persist=()=>{c.mcSaveRaw('synthetic-r4',env.stateRef.current);env.stateRef.current=c.mcLoadRaw('synthetic-r4');};
 env.rename=async(id,merchant)=>{
  const orig=env.stateRef.current.expenses.find(e=>e.id===id),intent={merchant,at:now};
  env.set(s=>c.expenseRenameDraft(s,orig,merchant,now));
  const ack=await cloud.renameExpense(orig,merchant);
  env.set(s=>c.expenseRenameAck(s,orig,intent,ack));return ack;
 };
 return env;
}
