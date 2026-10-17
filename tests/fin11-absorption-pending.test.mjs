import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
import {transformSync} from 'esbuild';
import {createLogicSandbox} from '../scripts/load-pure-logic.mjs';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const serverModule=async source=>import('data:text/javascript;base64,'+Buffer.from(transformSync(source,{loader:'ts',format:'esm'}).code).toString('base64'));
const budget=await serverModule(read('supabase/functions/_shared/presupuesto.ts'));
const modules=JSON.parse(read('src/build-order.json')).slice(0,9);
const original=modules.map(f=>read('src/modules/'+f)).join('\n');
const main=read('src/modules/11-app-main.js');
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const owner='synthetic-owner',date='2026-10-16T12:00:00.000Z';
const p={id:uuid(1),extId:'p',source:'ob',ent:'caixabank',date,amount:3.2,merchant:'Compra sintetica',obName:'Compra sintetica',obAcc:'account-a',category:'otros',obPending:true};
const b={...p,id:uuid(2),extId:'b',date:'2026-10-16T12:00:00.001Z',obOrd:2,obPending:undefined};
const kept={...p,extId:'b',obPendingRef:'p',obPending:undefined};
const seed=()=>({_historyOwner:owner,accounts:[{id:'synthetic-account',ent:'caixabank',role:'diario',spendFrom:true,value:1000}],settings:{expenseBanks:['caixabank']},expenses:[p,b],bankTx:[],gemelos:[],deleted:[],fixed:[],debts:[],oneoffs:[],flows:[],investments:[],goals:[],assets:[],budget:1000,lastBankSync:1792152000000});
const cents=rows=>rows.reduce((n,r)=>n+Math.round(Number(r.amount??r.importe)*100),0);
function memory(){const data=new Map();return {data,fail:false,getItem(k){return data.get(k)??null;},setItem(k,v){if(this.fail)throw Error('synthetic-quota');data.set(k,v);},removeItem(k){data.delete(k);}};}
function environment({source=original,storage=memory()}={}){
 const env={storage,owner,authOwner:owner,queries:[],events:[],rows:[],deleteErrors:0,zeroDeletes:0,lostAck:false,afterRead:null,beforeDelete:null};
 const db={auth:{getSession:async()=>({data:{session:env.authOwner?{user:{id:env.authOwner},expires_at:Date.now()/1000+(env.expired?-1:3600)}:null},error:null})},from(table){
  if(table==='app_events')return {insert:async event=>{env.events.push(event);return {error:null};}};
  assert.equal(table,'expenses');let op='select',limit=Infinity,order=null;const filters=[];
  const q={select(){return q;},delete(){op='delete';return q;},eq(k,v){filters.push(['eq',k,v]);return q;},gte(k,v){filters.push(['gte',k,v]);return q;},lt(k,v){filters.push(['lt',k,v]);return q;},limit(n){limit=n;return q;},order(k,opts){order=[k,opts.ascending];return q;},abortSignal(){return q;},then(resolve,reject){
   const trace={op,filters:filters.map(x=>x.slice()),limit};env.queries.push(trace);
   if(op==='delete'&&env.beforeDelete)env.beforeDelete();
   let rows=env.rows.filter(r=>filters.every(([op,k,v])=>op==='eq'?r[k]===v:op==='gte'?Date.parse(r[k])>=Date.parse(v):k==='fecha'?Date.parse(r[k])<Date.parse(v):r[k]<v));
   if(order)rows.sort((a,b)=>(a[order[0]]<b[order[0]]?-1:1)*(order[1]?1:-1));rows=rows.slice(0,limit);
   trace.ids=rows.map(r=>r.id);
   if(op==='delete'){
    if(env.deleteErrors-->0)return Promise.resolve({data:null,error:Error('synthetic-offline')}).then(resolve,reject);
    if(env.zeroDeletes-->0)return Promise.resolve({data:[],error:null}).then(resolve,reject);
    env.rows=env.rows.filter(r=>!rows.includes(r));if(env.lostAck)rows=[];
   }else if(env.afterRead)env.afterRead(trace);
   return Promise.resolve({data:rows.map(r=>({...r})),error:null}).then(resolve,reject);
  }};return q;
 }};
 const sandbox=createLogicSandbox({localStorage:storage,AbortController});
 sandbox.window.localStorage=storage;sandbox.window.supabase={createClient:()=>db};
 const c=vm.createContext(sandbox);vm.runInContext(source,c);env.c=c;
 env.wire=e=>({id:e.id,user_id:owner,fecha:e.date,importe:e.amount,comercio:e.merchant,cat:e.category,ob_name:e.obName,source:c.expenseSourceForCloud(e)});
 env.stage=()=>{env.state=c.obPendingAbsorbedState({...seed(),expenses:[{...kept}]},seed());return env.state;};
 env.drain=async(offset=0)=>c.obAbsorbedRetry(()=>env.state,()=>env.owner,fn=>{env.state=fn(env.state);},offset);
 env.cloud=vm.runInContext('cloud',c);
 env.prune=()=>{const key=c.obAbsorptionKey(b),at=env.state.deletedAt[key];for(let i=0;i<500;i++)env.state={...env.state,...c.lapidaPon(env.state,'synthetic-newer-'+i,at+i+1)};assert.ok(!env.state.deleted.includes(key));};
 env.visible=()=>env.rows.map(c.expenseFromRow).filter(e=>!c.expenseIsTombstoned(e,c.expenseDeletedSet(env.state)));
 env.server=()=>budget.filasComoLaApp(env.rows,env.state.deleted,env.state.obAbsorbedPending,env.state._historyOwner);
 env.rows=[env.wire(p),env.wire(b)];return env;
}
test('FIN11 conserva 320c con fallo, poda500, reapertura y recuperación real del DELETE',async()=>{
 const e=environment();e.c.mcSaveRaw('micartera_v3',seed());e.stage();
 assert.equal(e.state.expenses.length,1);assert.equal(e.state.obAbsorbedPending.length,1);assert.equal(e.queries.length,0,'ninguna escritura de banco dispara DELETE');
 e.deleteErrors=1;await e.drain();assert.equal(e.state.obAbsorbedPending.length,1);assert.equal(e.rows.length,2);
 e.prune();assert.equal(cents(e.visible()),320);assert.equal(cents(e.server()),320);
 const reopened=environment({storage:e.storage});reopened.rows=e.rows;reopened.state=reopened.c.mcLoadRaw('micartera_v3');
 assert.equal(reopened.state.obAbsorbedPending.length,1,'la intención ya estaba durable antes del debounce de la cartera');
 await reopened.drain();assert.equal(reopened.state.obAbsorbedPending.length,0);assert.deepEqual(reopened.rows.map(r=>r.id),[uuid(1)]);
 assert.equal(reopened.c.mcLoadRaw('micartera_v3').obAbsorbedPending.length,0,'el ACK durable gana a la copia principal antigua');
});
test('FIN11 cero-filas exige otra lectura y no confirma si la fila sigue',async()=>{
 const e=environment();e.stage();e.zeroDeletes=1;await e.drain();
 assert.equal(e.state.obAbsorbedPending.length,1);assert.equal(e.rows.length,2);
 const q=e.queries;assert.equal(q.filter(x=>x.op==='delete').length,1);assert.ok(q.slice(q.findIndex(x=>x.op==='delete')+1).some(x=>x.op==='select'));
 await e.drain();assert.equal(e.state.obAbsorbedPending.length,0);assert.equal(e.rows.length,1);
});
test('FIN11 una telemetría fallida no consume la intención ni hace fallar el refresco',async()=>{
 for(const sync of [true,false]){const e=environment();e.stage();e.deleteErrors=1;
  e.cloud.logEvent=()=>{if(sync)throw Error('synthetic-log');return Promise.reject(Error('synthetic-log'));};
  await e.drain();await new Promise(resolve=>setImmediate(resolve));assert.equal(e.state.obAbsorbedPending.length,1);
 }
});
test('FIN11 commit con acuse perdido solo confirma después de leer ausencia',async()=>{
 const e=environment();e.stage();e.lostAck=true;await e.drain();
 assert.equal(e.state.obAbsorbedPending.length,0);assert.equal(e.rows.length,1);
 assert.ok(e.queries.some(x=>x.op==='select'&&x.limit===201));
});
test('FIN11 UUID diferente se resuelve por identidad completa única y DELETE por su UUID',async()=>{
 const e=environment();e.rows[1].id=uuid(3);e.stage();await e.drain();
 assert.equal(e.state.obAbsorbedPending.length,0);assert.deepEqual(e.rows.map(r=>r.id),[uuid(1)]);
 const deletion=e.queries.find(q=>q.op==='delete');assert.ok(deletion.filters.some(x=>x[1]==='id'&&x[2]===uuid(3)));
 assert.ok(deletion.filters.some(x=>x[1]==='user_id'&&x[2]===owner));
});
test('FIN11 alias ambiguo, cuenta ausente o página incompleta conservan protección sin DELETE',async()=>{
 for(const mode of ['ambiguous','no-account','incomplete']){
  const e=environment();e.rows[1].id=uuid(3);
  if(mode==='ambiguous')e.rows.push({...e.rows[1],id:uuid(4),fecha:'2026-10-16T12:00:00.002Z'});
  if(mode==='no-account')e.rows[1].source=e.rows[1].source.replace(/#acc[^#]*/,'');
  if(mode==='incomplete')e.rows.push(...Array.from({length:201},(_,i)=>({...e.rows[1],id:uuid(i+10),comercio:'No coincide'})));
  e.stage();await e.drain();assert.equal(e.state.obAbsorbedPending.length,1,mode);assert.equal(e.queries.filter(q=>q.op==='delete').length,0,mode);
 }
});
test('FIN11 otra cuenta/día y la superviviente permanecen intactos',async()=>{
 const e=environment();e.rows.push({...e.rows[1],id:uuid(4),source:e.rows[1].source.replace('#accaccount-a','#accaccount-b')},{...e.rows[1],id:uuid(5),fecha:'2026-10-15T12:00:00.001Z'});
 e.stage();await e.drain();assert.deepEqual(e.rows.map(r=>r.id),[uuid(1),uuid(4),uuid(5)]);
});
test('FIN11 ausencia de candidato borrable no confirma alias editado, legacy o solapado con superviviente',async()=>{
 for(const mode of ['edited','legacy','keeper-overlap']){
  const e=environment();e.rows[1].id=uuid(3);e.stage();
  if(mode==='edited')e.rows[1].importe=4.2;
  if(mode==='legacy')e.rows[1].source=e.rows[1].source.replace(/#ref[^#]*/,'');
  if(mode==='keeper-overlap')e.rows[1].id=uuid(1);
  await e.drain();assert.equal(e.state.obAbsorbedPending.length,1,mode);assert.equal(e.queries.filter(q=>q.op==='delete').length,0,mode);
 }
});
test('FIN11 cambio de sesión durante lectura cancela antes del DELETE',async()=>{
 const e=environment();e.stage();e.afterRead=()=>{e.owner='another-owner';};
 await e.drain();assert.equal(e.state.obAbsorbedPending.length,1);assert.equal(e.queries.filter(q=>q.op==='delete').length,0);
});
test('FIN11 auth de otro titular y sandbox no consultan ni escriben',async()=>{
 for(const mode of ['other','sandbox','expired']){const e=environment();e.stage();if(mode==='other')e.authOwner='another-owner';else if(mode==='expired')e.expired=true;else e.c.mcSandbox=()=>true;
  await e.drain();assert.equal(e.queries.length,0);assert.equal(e.state.obAbsorbedPending.length,1);
 }
});
test('FIN11 error durable o cap200 impiden declarar segura la retirada201',()=>{
 for(const mode of ['storage','cap']){const e=environment();const s=seed();
  if(mode==='storage')e.storage.fail=true;
  else s.obAbsorbedPending=Array.from({length:200},(_,i)=>({owner,id:uuid(i+10),key:e.c.obAbsorptionKey({...b,extId:'old-'+i}),keepId:uuid(1),keepKey:e.c.obAbsorptionKey(kept),amount:3.2,merchant:b.merchant}));
  const before=s.obAbsorbedPending||[];
  const result=e.c.obPendingAbsorbedState({...s,expenses:[{...kept}]},s);
  assert.ok(result.expenses.some(x=>x.id===b.id),mode);assert.equal(result.deleted.length,0,mode);
  assert.equal(result.expenses.find(x=>x.id===p.id).extId,'p',mode+': sin intención durable tampoco se adopta su referencia');
  assert.equal(e.c.mergeExpenses(result.expenses,[]).list.length,2,mode+': no hay fusión silenciosa al recargar');
  if(mode==='cap'){assert.equal(result.obAbsorbedPending.length,200);assert.equal(result.obAbsorbedPending[0],before[0]);}
  assert.equal(e.queries.length,0);
 }
});
test('FIN11 dos listas llenas no se recortan para fingir una unión',()=>{
 const e=environment();e.stage();const p=e.state.obAbsorbedPending[0];
 const list=Array.from({length:200},(_,i)=>({...p,id:uuid(i+10),key:e.c.obAbsorptionKey({...b,extId:'old-'+i})}));
 assert.equal(e.c.obAbsorbedJoin(list,[p],owner),null);assert.equal(list.length,200);
});
test('FIN11 lector cliente cachea por cola y titular además de deleted',()=>{
 const e=environment();e.stage();e.prune();const c=e.c,s=e.state;
 const first=c.expenseDeletedSet(s);assert.equal(c.expenseIsTombstoned(b,first),true);assert.equal(c.expenseDeletedSet(s),first);
 const empty=c.expenseDeletedSet({...s,obAbsorbedPending:[]});assert.notEqual(empty,first);assert.equal(c.expenseIsTombstoned(b,empty),false);
 assert.equal(c.expenseIsTombstoned(b,c.expenseDeletedSet({...s,_historyOwner:'another-owner'})),false);
 assert.equal(budget.filasComoLaApp(e.rows,[],s.obAbsorbedPending,'another-owner').length,2);
});
test('FIN11 cambio de contenido entre lectura/DELETE no borra ni confirma una edición',async()=>{
 const e=environment();e.stage();e.beforeDelete=()=>{e.rows[1]={...e.rows[1],importe:4.2};};
 await e.drain();assert.equal(e.state.obAbsorbedPending.length,1);assert.equal(e.rows.length,2);assert.equal(e.rows[1].importe,4.2);
});
test('FIN11 un ACK cuya escritura local falla permanece pendiente y puede recuperarse',async()=>{
 const e=environment();e.stage();e.storage.fail=true;await e.drain();
 assert.equal(e.rows.length,1);assert.equal(e.state.obAbsorbedPending.length,1);
 e.storage.fail=false;await e.drain();assert.equal(e.state.obAbsorbedPending.length,0);
 assert.equal(e.queries.filter(q=>q.op==='delete').length,1,'la lectura de ausencia no inventa otro borrado');
});
test('FIN11 cada refresco acota a cuatro objetivos y serializa dos llamadas simultáneas',async()=>{
 const e=environment();e.stage();const first=e.state.obAbsorbedPending[0];
 e.state.obAbsorbedPending=Array.from({length:9},(_,i)=>({...first,id:uuid(i+10),key:e.c.obAbsorptionKey({...b,extId:'batch-'+i}),merchant:'Compra '+i}));
 e.rows=e.state.obAbsorbedPending.map((p,i)=>e.wire({...b,id:p.id,extId:'batch-'+i,merchant:p.merchant}));
 await Promise.all([e.drain(),e.drain()]);assert.equal(e.queries.filter(q=>q.op==='delete').length,4);assert.equal(e.state.obAbsorbedPending.length,5);
});
test('FIN11 prueba el hook real de pull: protección y reintento solo al refrescar nube',async()=>{
 const e=environment();e.stage();e.prune();e.deleteErrors=1;
 const a=main.indexOf('  const syncCloudExpenses=function(){'),z=main.indexOf('\n  // Al iniciar sesión:',a);assert.ok(a>=0&&z>a);
 const factory=vm.runInContext('(function(state,session,drain){const stateRef={current:state},sessionRef={current:session};const wR={current:false},wS={current:0},wP={current:null},wC={current:[]},wRead={current:null};const set=fn=>stateRef.current=fn(stateRef.current);const retryObAbsorbedCloud=()=>drain(stateRef,set);'+main.slice(a,z)+'return {run:syncCloudExpenses,state:()=>stateRef.current};})',e.c);
 const api=factory(e.state,{user:{id:owner}},async(ref,set)=>e.c.obAbsorbedRetry(()=>ref.current,()=>e.owner,set));
 const result=await api.run();assert.equal(result.total,1);assert.equal(api.state().obAbsorbedPending.length,1);assert.equal(e.rows.length,2);
 await api.run();assert.equal(api.state().obAbsorbedPending.length,0);assert.equal(e.rows.length,1);
});
test('FIN11/FIN15 pendiente con comodín filtra antes de consumir referencia entre días',async()=>{
 const e=environment();e.stage();
 const hidden=e.wire({...b,id:uuid(3),date:'2026-10-14T12:00:00.001Z'});
 const survivor=e.wire({...b,id:uuid(4),date:'2026-10-15T12:00:00.001Z'});
 const key=e.c.obAbsorptionKey({...b,date:hidden.fecha}).replace('|account-a|','||');
 const pending=[{...e.state.obAbsorbedPending[0],key}];
 const s={...seed(),deleted:[],obAbsorbedPending:pending};
 for(const rows of [[hidden,survivor],[survivor,hidden]]){
  const incoming=rows.map(e.c.expenseFromRow).filter(x=>!e.c.expenseIsTombstoned(x,e.c.expenseDeletedSet(s)));
  const client=e.c.mergeExpensesFromCloud([],incoming).list;
  assert.equal(cents(client),320);assert.deepEqual(Array.from(client,x=>x.id),[survivor.id]);
  const server=budget.filasComoLaApp(rows,[],pending,owner);
  assert.equal(cents(server),320);assert.deepEqual(server.map(x=>x.id),[survivor.id]);
 }
 const source=read('supabase/functions/_shared/presupuesto.ts');
 const anchor='if (cuentaAusente.has(base) || (!cuentaDeSource(f.source) && sinCuenta.has(base))) continue;';
 const changed=source.replace(anchor,'if (cuentaAusente.has(base) || (!cuentaDeSource(f.source) && sinCuenta.has(base))) { const ref = referenciaOb(f); if (ref) referencias.add(ref); continue; }');
 assert.notEqual(changed,source,'el mutante debe aplicarse y compilar antes de contar una muerte');
 const mutant=await serverModule(changed);
 assert.equal(cents(mutant.filasComoLaApp([hidden,survivor],[],pending,owner)),0,'mutante causal consume la referencia de la superviviente');
 console.log('FIN11/FIN15 1/1 mutante de orden pendiente/referencia muerto: 0 frente a 320c');
});

test('FIN11 mutantes de persistencia, recuperación, protección, acuse, dueño y cap mueren',async()=>{
 const checks={
  persist:async e=>{e.storage.fail=true;const s=e.stage();assert.equal(s.expenses.length,2);},
  reopen:async e=>{e.c.mcSaveRaw('micartera_v3',seed());e.stage();assert.equal(e.c.mcLoadRaw('micartera_v3').obAbsorbedPending.length,1);},
  protect:async e=>{e.stage();e.prune();assert.equal(cents(e.visible()),320);},
  ack:async e=>{e.stage();e.zeroDeletes=1;await e.drain();assert.equal(e.state.obAbsorbedPending.length,1);},
  owner:async e=>{e.stage();e.afterRead=()=>{e.owner='another-owner';};await e.cloud.settleObAbsorbed(e.state.obAbsorbedPending[0],()=>e.owner);assert.equal(e.queries.filter(q=>q.op==='delete').length,0);},
  cap:async e=>{e.stage();const p=e.state.obAbsorbedPending[0],list=Array.from({length:200},(_,i)=>({...p,id:uuid(i+10),key:e.c.obAbsorptionKey({...b,extId:'old-'+i})}));assert.equal(e.c.obAbsorbedJoin(list,[p],owner),null);},
  uuid:async e=>{e.stage();await e.drain();assert.ok(e.queries.filter(q=>q.op==='delete').every(q=>q.filters.some(f=>f[1]==='id')));},
  alias:async e=>{e.rows[1].id=uuid(3);e.rows[1].source=e.rows[1].source.replace(/#acc[^#]*/,'');e.stage();await e.drain();assert.equal(e.queries.filter(q=>q.op==='delete').length,0);},
  ambiguous:async e=>{e.rows[1].id=uuid(3);e.rows.push({...e.rows[1],id:uuid(4),fecha:'2026-10-16T12:00:00.002Z'});e.stage();await e.drain();assert.equal(e.queries.filter(q=>q.op==='delete').length,0);},
  rollback:async e=>{e.storage.fail=true;assert.equal(e.stage().expenses.find(x=>x.id===p.id).extId,'p');},
  absence:async e=>{e.rows[1].id=uuid(3);e.stage();e.rows[1].importe=4.2;await e.drain();assert.equal(e.state.obAbsorbedPending.length,1);}
 };
 const mutants=[
  ['persist',s=>s.replace('return obAbsorbedPersist(owner,list)?list:null;','return list;')],
  ['reopen',s=>s.replace('return obAbsorbedRestore(base,key);','return base;')],
  ['protect',s=>s.replace('if(obAbsorbedValid(p,owner))delSet[p.key]=1;','')],
  ['ack',s=>s.replace('rows.length===0&&!await find()&&!!await active()','rows.length===0')],
  ['owner',s=>s.replaceAll('currentOwner()!==owner','false').replaceAll('currentOwner()===owner','true')],
  ['cap',s=>s.replace('if(out.length>OB_ABSORBED_MAX){obAbsorbedWarn("merge");return null;}','if(out.length>OB_ABSORBED_MAX)return out.slice(-OB_ABSORBED_MAX);')],
  ['uuid',s=>s.replace(".eq('id',target.id)","")],
  ['alias',s=>s.replace('return !alias||!!p.key.split("|")[4]&&!!e.obAcc&&key===p.key;','return true;')],
  ['ambiguous',s=>s.replace('if(possible.length>1||possible.length===1&&!obAbsorbedCandidate(p,possible[0],true))','if(false)')],
  ['rollback',s=>s.replace('.map(function(x){return x.id===keep.id?before.get(keep.id):x;})','')],
  ['absence',s=>s.replace('return obAbsorbedPossible(p,r);','return obAbsorbedCandidate(p,r,false);')]
 ];
 for(const [name,mutate]of mutants){await checks[name](environment());const source=mutate(original);assert.notEqual(source,original,name);await assert.rejects(()=>checks[name](environment({source})),undefined,name);}
 const serverSource=read('supabase/functions/_shared/presupuesto.ts'),changed=serverSource.replace('for (const p of Array.isArray(pending) ? pending : [])','for (const p of [])');assert.notEqual(changed,serverSource);
 const mutant=await serverModule(changed);
 const e=environment();e.stage();e.prune();assert.equal(cents(e.server()),320);assert.notEqual(cents(mutant.filasComoLaApp(e.rows,e.state.deleted,e.state.obAbsorbedPending,owner)),320);
 console.log('FIN11 12/12 mutantes muertos');
});
