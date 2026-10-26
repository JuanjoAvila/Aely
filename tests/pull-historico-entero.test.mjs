import { test } from "node:test";
import { authFragments } from "./helpers/auth-disposal-fixture.mjs";
import {withOwnerStorage} from "./helpers/owner-storage-fixture.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";
import { codeMask } from "../scripts/beta-source-code.mjs";
import { commitCloudFixture } from "./helpers/cloud-commit-fixture.mjs";

const core=fs.readFileSync(new URL("../src/modules/00-core.js",import.meta.url),"utf8");
const uuid=n=>"00000000-0000-4000-8000-"+n.toString(16).padStart(12,"0");
function rows(n){ return Array.from({length:n},(_,i)=>({id:uuid(i+1),fecha:"2020-01-01T12:00:00Z",importe:i+1,
  comercio:"Movimiento "+i,cat:"otros",source:i%3===0?"ob-hist:sabadell#dup":"manual:sabadell",
  nota:"Concepto "+i,nota_edit:i%2===0,no_card:true,importe_orig:i+1,divisa:"USD",ob_name:"Banco "+i})); }

// Ejecuta cloud.pullExpenses real; el doble interpreta la consulta, sin copiar el paginador.
function client(table,{cap=1000,before=()=>{},response,session=()=>({user:{id:"synthetic-user"}})}={}){
  const queries=[];
  const sb={auth:{async getSession(){ return {data:{session:session()},error:null}; }},from(name){
    assert.equal(name,"expenses");
    const q={orders:[],limit:Infinity,lt:null,or:null};
    const chain={select(){return chain;},order(k,o){q.orders.push([k,o]);return chain;},
      limit(n){q.limit=n;return chain;},lt(k,v){q.lt=[k,v];return chain;},or(v){q.or=v;return chain;},
      then(resolve,reject){
        try{
          queries.push(q); before(table,queries.length,q);
          if(response){const r=response(queries.length,q);if(r){resolve(r);return;}}
          let data=table.slice();
          for(const [k,o] of q.orders.slice().reverse()) data.sort((a,b)=>(a[k]<b[k]?-1:a[k]>b[k]?1:0)*(o.ascending?1:-1));
          if(q.lt) data=data.filter(r=>r[q.lt[0]]<q.lt[1]);
          if(q.or){const m=q.or.match(/^fecha\.lt\.(.+),and\(fecha\.eq\.(.+),id\.lt\.(.+)\)$/);assert.ok(m);data=data.filter(r=>r.fecha<m[1]||(r.fecha===m[2]&&r.id<m[3]));}
          resolve({data:data.slice(0,Math.min(cap,q.limit)),error:null});
        }catch(e){reject(e);}
      }};
    return chain;
  }};
  const ini=core.indexOf("async function mcPullExpensesPaged(");
  const end=core.indexOf("\n})();",ini)+7;
  const ctx=vm.createContext({window:{supabase:{createClient:()=>sb}},CONFIG:{SUPABASE_URL:"test",SUPABASE_ANON_KEY:"test"},t:key=>key});
  vm.runInContext(core.slice(ini,end)+"\nglobalThis.client=cloud;",ctx);
  return {pull:proof=>ctx.client.pullExpenses(proof),queries};
}
const plain=x=>JSON.parse(JSON.stringify(x));

test("FIN07: 4501 filas, empates de fecha, UUID y todos los campos intactos",async()=>{
  const data=rows(4501), c=client(data), out=await c.pull();
  assert.deepEqual(plain(out).sort((a,b)=>a.id.localeCompare(b.id)),data);
  assert.equal(new Set(out.map(r=>r.id)).size,data.length);
  assert.equal(c.queries.length,6); // Incluye confirmación vacía; una página corta no prueba el final.
  assert.deepEqual(plain(c.queries[0].orders),[["id",{ascending:false}]]);
  assert.equal(c.queries[1].lt[0],"id");
});
test("FIN07: servidor recorta a 317 por respuesta, sigue hasta vacío",async()=>{
  const data=rows(2501),c=client(data,{cap:317});
  assert.equal((await c.pull()).length,2501);assert.equal(c.queries.length,9);
});
test("FIN07: sin techo de 50 páginas",async()=>{
  const data=rows(50001),c=client(data);assert.equal((await c.pull()).length,50001);assert.equal(c.queries.length,52);
});
test("FIN07: salida conserva fecha DESC/id DESC y el gemelo elegido por la mezcla",async()=>{
  const data=rows(2301);
  data[0]={...data[0],fecha:"2020-01-01T20:00:00Z",source:"ob-hist:sabadell#dup",comercio:"Gemelo",importe:10};
  data[2000]={...data[0],id:data[2000].id,fecha:"2020-01-01T10:00:00Z",nota:"Anterior"};
  const expected=data.slice().sort((a,b)=>Date.parse(b.fecha)-Date.parse(a.fecha)||(a.id<b.id?1:a.id>b.id?-1:0));
  const out=await client(data).pull();assert.deepEqual(plain(out),expected);
  const cli=loadPureLogicFromFile();
  assert.deepEqual(cli.mergeExpensesFromCloud([],plain(out).map(cli.expenseFromRow)),
    cli.mergeExpensesFromCloud([],expected.map(cli.expenseFromRow)));
});
test("FIN07: el orden fecha conserva microsegundos y normaliza offsets equivalentes",async()=>{
  const data=rows(4);
  data[0].fecha="2020-01-01T12:00:00.123999+00:00";
  data[1].fecha="2020-01-01T13:00:00.123001+01:00";
  data[2].fecha="2020-01-01T12:00:00.123000+00:00";
  data[3].fecha="2020-01-01T12:00:00.123+00:00";
  const out=await client(data,{cap:2}).pull();
  assert.deepEqual(plain(out).map(r=>r.id),[data[0].id,data[1].id,data[3].id,data[2].id]);
});
test("FIN07: alta concurrente y edición de fecha no saltan ninguna fila previa",async()=>{
  const data=rows(2501), initial=plain(data), added={...data[0],id:uuid(9999)};
  const c=client(data,{before(table,n){if(n===2){table.push(added);table[0].fecha="2030-01-01T00:00:00Z";}}});
  const out=await c.pull();assert.equal(out.length,initial.length);
  assert.deepEqual(new Set(out.map(r=>r.id)),new Set(initial.map(r=>r.id)));
  const again=await c.pull();assert.equal(again.length,2502);assert.equal(again.filter(r=>r.id===added.id).length,1);
});
test("FIN07: alta en tramo pendiente entra una vez, alta en tramo recorrido espera reintento",async()=>{
  const data=rows(2501).map(r=>({...r,id:uuid(parseInt(r.id.slice(-12),16)*2)}));
  const pending={...data[0],id:uuid(3)}, passed={...data[0],id:uuid(5001)};
  const c=client(data,{before(table,n){if(n===2)table.push(pending,passed);}});
  const out=await c.pull();assert.equal(out.length,2502);assert.equal(out.filter(r=>r.id===pending.id).length,1);
  assert.equal(out.filter(r=>r.id===passed.id).length,0);assert.equal((await c.pull()).length,2503);
});
test("FIN07: fallo intermedio no devuelve parcial; recuperación comienza de cero",async()=>{
  const data=rows(2301);let fail=true;
  const c=client(data,{response(n){if(n===2&&fail)return {data:null,error:new Error("offline")};}});
  await assert.rejects(c.pull(),/offline/);fail=false;assert.deepEqual(plain(await c.pull()).sort((a,b)=>a.id.localeCompare(b.id)),data);
});
test("FIN07: payload ausente, no array, repetido, desordenado o ID ausente rechazan",async()=>{
  for(const payload of [null,{},[rows(1)[0],rows(1)[0]],[...rows(2)],[{id:null}]]){
    const c=client(rows(2),{response(){return {data:payload,error:null};}});
    await assert.rejects(c.pull(),/exp_pull_invalid/);
  }
  const c=client(rows(2501),{response(n){if(n===2)return {data:[rows(2501).at(-1)],error:null};}});
  await assert.rejects(c.pull(),/exp_pull_invalid/);
});
test("FIN07: mezcla conserva adicionales, lápidas, notas editadas y possibleDupOf sin reinterpretar identidad",async()=>{
  const cli=loadPureLogicFromFile();
  const remote=await client(rows(2301)).pull();
  const incoming=remote.map(cli.expenseFromRow);
  const local={...incoming[0],note:"Editada localmente",noteEdited:true,possibleDupOf:"gemelo-local"};
  const extra={id:uuid(9999),date:"2019-01-01T12:00:00.000Z",amount:5,merchant:"Solo local",source:"manual"};
  const prev=[local,extra],merged=cli.mergeExpensesFromCloud(prev,incoming);
  assert.equal(merged.list.length,2302);assert.equal(new Set(merged.list.map(r=>r.id)).size,2302);
  assert.equal(merged.list.find(r=>r.id===local.id).note,"Editada localmente");
  assert.equal(merged.list.find(r=>r.id===local.id).possibleDupOf,"gemelo-local");
  assert.equal(merged.list.find(r=>r.id===local.id).possibleDup,local.possibleDup);
  assert.equal(merged.list.find(r=>r.id===extra.id),extra);
  const again=cli.mergeExpensesFromCloud(merged.list,incoming);assert.equal(again.changed,false);
  assert.ok(again.list.every((r,i)=>r===merged.list[i]));
  const key=cli.keyOfExpense(incoming[1]);assert.ok(cli.expenseIsTombstoned(incoming[1],{[key]:1}));
});

// Ejecuta el call site de App: no basta con que el paginador rechace si el sync confirma un parcial.
function syncHarness(pull,native=null,options={}){
  const main=fs.readFileSync(process.env.FIN04_EXPENSE_PULL_SOURCE||new URL("../src/modules/11-app-main.js",import.meta.url),"utf8");
  const ini=main.indexOf("const syncCloudExpenses=function(){"),end=main.indexOf("\n  };",ini)+5;
  const cli=withOwnerStorage(loadPureLogicFromFile()),local={id:uuid(9999),date:"2019-01-01T12:00:00.000Z",amount:5,merchant:"Solo local",source:"manual"};
  const h={wS:{current:0},wR:{current:true},wP:{current:null},wC:{current:"|anterior|"},wRead:{current:null},wOwner:{current:null},sessionRef:{current:{user:{id:"synthetic-user"}}},stateRef:{current:{expenses:[local],deleted:["lapida"]}},sets:0,uploads:0};
  const env={...cli,...h,cloud:{pullExpenses:async proof=>{const r=await pull(proof);if(options.prove!==false){proof.valid=true;proof.userId="synthetic-user";}return r;},setExpenseCat:()=>Promise.resolve()},inicioDeMesMs:()=>0,
    retryObAbsorbedCloud:()=>cli.obAbsorbedRetry(()=>h.stateRef.current,()=>h.sessionRef.current&&h.sessionRef.current.user.id,fn=>env.set(fn)),
    mcSandbox:()=>!!options.sandbox,setTimeout:options.setTimeout||setTimeout,clearTimeout:options.clearTimeout||clearTimeout,
    natPlugin:()=>native,subirGasto:()=>h.uploads++,fixMovInvasion:s=>s,reconcileObDupes:s=>({state:s,recat:[]}),
    set:fn=>{const next=fn(h.stateRef.current);if(next!==h.stateRef.current){h.sets++;h.stateRef.current=next;}}};
  const sync=new Function(...Object.keys(env),main.slice(ini,end)+";return syncCloudExpenses;")(...Object.values(env));
  return Object.assign(h,{sync});
}
test("FIN07: fallo intermedio no mezcla, no backfill, no ACK de FIN05 ni lápidas nuevas",async()=>{
  const c=client(rows(2501),{response(n){if(n===3)return {error:new Error("offline"),data:null};}});
  const h=syncHarness(()=>c.pull()),before=h.stateRef.current;
  await assert.rejects(h.sync(),/offline/);
  assert.equal(h.stateRef.current,before);assert.equal(h.sets,0);assert.equal(h.uploads,0);
  assert.equal(h.wC.current,"|anterior|");assert.equal(h.wR.current,false);
});

test("widget: corte nativo colgado vence en cuatro segundos y marca tardía no acredita el pull",async()=>{
  let timeout,late,pulls=0,cleared=0,plazos=0;
  const h=syncHarness(()=>{pulls++;return Promise.resolve(rows(1));},{beginWidgetRead:()=>new Promise(resolve=>{late=resolve;})},
    {setTimeout:(fn,ms)=>{if(ms===25000){plazos++;return 8;}assert.equal(ms,4000);timeout=fn;return 7;},clearTimeout:id=>{if(id===8)return;assert.equal(id,7);cleared++;}});
  const p=h.sync();await new Promise(resolve=>setImmediate(resolve));assert.equal(pulls,0);
  timeout();await p;assert.equal(pulls,1);assert.equal(h.wRead.current,null);assert.equal(h.wR.current,true);
  late({readGeneration:"late",nativeCut:"9"});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.wRead.current,null);assert.equal(cleared,1);
  // El plazo del GET colgado (fix-170) es otro temporizador, uno por vuelo.
  assert.equal(plazos,1);
});

test("widget: lectura vacía auténtica acredita sesión; sesión ausente, caída o cambiada no acredita",async()=>{
  const mark={readGeneration:"valid",nativeCut:"1"},native={beginWidgetRead:()=>Promise.resolve(mark)};
  const valid=client([]),good=syncHarness(proof=>valid.pull(proof),native,{prove:false});
  await good.sync();assert.deepEqual(good.wRead.current,mark);
  for(const mode of ["absent","lost","changed","expired"]){
    let calls=0;const c=client(rows(1),{session:()=>{calls++;return mode==="absent"||mode==="lost"&&calls===2?null:
      {user:{id:mode==="changed"&&calls===2?"another-user":"synthetic-user"},...(mode==="expired"?{expires_at:1}:{})};}});
    const h=syncHarness(proof=>c.pull(proof),native,{prove:false});
    await assert.rejects(h.sync(),/exp_pull_session/);assert.equal(h.wRead.current,null);assert.equal(h.wR.current,false);
    assert.equal(h.sets,0,"sesión inválida no confirma ni mezcla una foto");
  }
});

test("widget: lectura sin prueba explícita, otro usuario y ambos modos de pruebas no mandan marca",async()=>{
  const mark={readGeneration:"not-authorized",nativeCut:"1"};let begun=0;
  const native={beginWidgetRead:()=>{begun++;return Promise.resolve(mark);}};
  for(const sandbox of [false,true]){
    const h=syncHarness(()=>Promise.resolve([]),native,{prove:false,sandbox});await h.sync();assert.equal(h.wRead.current,null);
  }
  const normalTest=syncHarness(()=>Promise.resolve(rows(1)),native,{sandbox:true});await normalTest.sync();assert.equal(normalTest.wRead.current,null);
  assert.equal(begun,1,"ni el banco de pruebas normal ni el inicial solicitan corte nativo");
  const changed=syncHarness(proof=>{proof.valid=true;proof.userId="another-user";return Promise.resolve([]);},native,{prove:false});
  await changed.sync();assert.equal(changed.wRead.current,null);
});
test("FIN07: sync nuevo termina antes, el viejo no pisa ni ACK ni histórico",async()=>{
  const pending=[];const h=syncHarness(()=>new Promise(resolve=>pending.push(resolve)));
  const old=h.sync();await new Promise(resolve=>setImmediate(resolve));
  // La misma sesión comparte vuelo; una sesión nueva del mismo UID sí invalida el anterior.
  h.sessionRef.current={user:{id:"synthetic-user"}};
  const latest=h.sync();await new Promise(resolve=>setImmediate(resolve));
  pending[1]([{...rows(1)[0],source:"macrodroid",ingest_event_id:"nuevo"}]);
  await latest;const before=h.stateRef.current,ack=h.wC.current;
  pending[0]([{...rows(2)[1],source:"macrodroid",ingest_event_id:"viejo"}]);await old;
  assert.equal(h.stateRef.current,before);assert.equal(h.wC.current,ack);
  // La cobertura se calcula ahora al enviar (mes/ciclo); una lectura tardía tampoco puede
  // cambiar las filas acreditadas ni sembrar el ACK viejo (NO-GO widget al cruzar el día 1).
  const covered=loadPureLogicFromFile().widgetCoveredEvents(ack,0,Date.now(),true);
  assert.ok(covered.includes("nuevo"));assert.ok(!covered.includes("viejo"));
  assert.equal(h.wR.current,true);assert.equal(h.sets,1);
});

test("widget: la marca no existe hasta terminar el pull completo; fallo no la acredita",async()=>{
  const mark={readGeneration:"synthetic-read",nativeCut:"4"};let finish;
  const h=syncHarness(()=>new Promise(resolve=>{finish=resolve;}),{beginWidgetRead:()=>Promise.resolve(mark)});
  const pull=h.sync();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.wRead.current,null);assert.equal(h.wR.current,false);
  finish(rows(1));await pull;assert.deepEqual(h.wRead.current,mark);assert.equal(h.wR.current,true);
  const failed=syncHarness(()=>Promise.reject(new Error("offline")),{beginWidgetRead:()=>Promise.resolve(mark)});
  await assert.rejects(failed.sync(),/offline/);assert.equal(failed.wRead.current,null);assert.equal(failed.wR.current,false);
});
test("widget: lectura superada no publica su marca; APK anterior conserva lectura sin marca",async()=>{
  const marks=[],pending=[],h=syncHarness(()=>new Promise(resolve=>pending.push(resolve)),{
    beginWidgetRead:()=>new Promise(resolve=>marks.push(resolve))});
  const old=h.sync();await new Promise(resolve=>setImmediate(resolve));
  marks[0]({readGeneration:"old",nativeCut:"1"});await new Promise(resolve=>setImmediate(resolve));
  h.sessionRef.current={user:{id:"synthetic-user"}};
  const latest=h.sync();await new Promise(resolve=>setImmediate(resolve));
  marks[1]({readGeneration:"new",nativeCut:"2"});await new Promise(resolve=>setImmediate(resolve));
  pending[1](rows(1));await latest;pending[0](rows(2));await old;
  assert.equal(h.wRead.current.readGeneration,"new");assert.equal(h.sets,1);
  const legacy=syncHarness(()=>Promise.resolve(rows(1)),{beginWidgetRead:()=>Promise.reject(new Error("no disponible"))});
  await legacy.sync();assert.equal(legacy.wRead.current,null);assert.equal(legacy.wR.current,true);
});

test("FIN07: la misma sesión comparte vuelo y una sesión nueva del mismo UID no hereda la respuesta",async()=>{
  const pending=[],h=syncHarness(()=>new Promise(resolve=>pending.push(resolve)));
  const old=h.sync(),same=h.sync();assert.equal(same,old);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(pending.length,1);
  h.sessionRef.current={user:{id:"synthetic-user"}};
  const fresh=h.sync();assert.notEqual(fresh,old);await new Promise(resolve=>setImmediate(resolve));assert.equal(pending.length,2);
  pending[0](rows(2));await old;assert.equal(h.sets,0);assert.equal(h.wR.current,false);assert.equal(h.wRead.current,null);
  pending[1](rows(1));await fresh;assert.equal(h.sets,1);assert.equal(h.wR.current,true);
});

// Reloj y transportes controlados, pero mezcla, commit y puerta mensual de la fuente real.
// El plazo solo puede relevar el GET: nunca una mezcla de React ni sus gastos a medio bajar.
function statePullHarness(){
  const app=fs.readFileSync(new URL("../src/modules/11-app-main.js",import.meta.url),"utf8");
  const mask=codeMask(app),start=mask.indexOf("const syncFromCloud=function(");
  assert.ok(start>=0);let end=mask.indexOf("{",start)+1,depth=1;
  for(;depth;end++){if(mask[end]==="{")depth++;if(mask[end]==="}")depth--;}
  const c=withOwnerStorage(loadPureLogicFromFile()),monthly=c.applyReservaMensual,gate=c.reservaMensualPuerta;
  const nowStart=Date.parse("2026-11-02T12:00:00Z"),timers=new Map(),pulls=[],expenses=[],updates=[],gates=[],monthlyResults=[],notices=[],writes=[];
  let now=nowStart,timerId=0;
  class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
  const initial={budget:1000,accounts:[],investments:[],debts:[],fixed:[],expenses:[{id:"local",date:"2026-10-31T12:00:00Z",amount:0.01,merchant:"Local",source:"manual"}],
    bankTx:[{id:"local-tx"}],goals:[{id:"g",name:"Sintética",target:5000,saved:100}],
    settings:{reservaRules:[{id:"r",goalId:"g",kind:"fixed",value:100,mensual:true}]},
    reservaLog:[{id:"mensual|r|2026-10",incomeKey:"mensual|r|2026-10",ruleId:"r",goalId:"g",amount:100,mensual:"2026-10",date:"2026-10-31T12:00:00Z"}],_savedAt:100,_historyOwner:"synthetic"};
  Object.assign(c,{Date:Clock,navigator:{onLine:true},setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,at:now+ms});return id;},clearTimeout:id=>timers.delete(id),
    stateRef:{current:initial},cloudReadRef:{current:null},cloudPullRef:{current:null},cloudUpdatedAtRef:{current:null},cloudMergeKey:{current:Symbol("merge")},pullOkRef:{current:null},
    sessionRef:{current:{user:{id:"synthetic"}}},obAbsorbedWriteBlocked:{current:false},
    cloud:{pullState:()=>{const d=deferred();pulls.push(d);return d.promise;}},
    set:fn=>updates.push(fn),syncCloudExpenses:()=>{const d=deferred();expenses.push(d);return d.promise;},
    pushAppState:async(u,s,revision)=>{writes.push({u,s,revision});return {updated_at:"synthetic-write"};},
    reservaMensualPuerta:()=>{const p=gate(),record={reads:0};gates.push(record);return {lee:pack=>{record.reads++;p.lee(pack);},vale:p.vale};},
    reservaMensualAlDia:p=>p.then(ok=>{monthlyResults.push(ok);if(ok)c.set(s=>monthly(s,nowStart));}),
    showToast:m=>notices.push(m),mcBootReady:()=>{}});
  vm.createContext(c);
  const names=["stateRef","cloudReadRef","cloudPullRef","cloudUpdatedAtRef","cloudMergeKey","pullOkRef","sessionRef","obAbsorbedWriteBlocked","cloud","set","syncCloudExpenses","pushAppState","reservaMensualPuerta","reservaMensualAlDia","showToast","mcBootReady","setTimeout","clearTimeout","navigator"];
  c.sync=vm.runInContext("(function("+names.join(",")+"){"+app.slice(start,end)+";return syncFromCloud;})",c)(...names.map(k=>c[k]));
  const authSessions=[],idles=[];let authEvent,authCleanup;
  function mountAuth(){
    const parts=authFragments(core,app);
    const sb={auth:{onAuthStateChange:cb=>{authEvent=cb;return {data:{subscription:{unsubscribe(){authEvent=null;}}}};}}};
    c.cloud.onAuth=vm.runInContext("(function(sb){const statePushCache=new Map();return {"+parts.method+"};})",c)(sb).onAuth;
    Object.assign(c.cloud,{enabled:()=>true,session:()=>{const d=deferred();authSessions.push(d);return d.promise;}});
    Object.assign(c,{syncFromCloud:c.sync,setSession:()=>{},mcScheduleIdle:fn=>idles.push(fn),
      setRecovery:()=>{},setShowAuth:()=>{},useEffect:fn=>{authCleanup=fn();}});
    const env=["cloud","sessionRef","cloudPullRef","cloudReadRef","cloudUpdatedAtRef","setSession","mcScheduleIdle","syncFromCloud","setTimeout","clearTimeout","navigator","mcBootReady","useEffect","set","setRecovery","setShowAuth"];
    vm.runInContext("(function("+env.join(",")+"){"+parts.effect+"})",c)(...env.map(k=>c[k]));
  }
  return {c,pulls,expenses,updates,gates,monthlyResults,notices,writes,timers,authSessions,idles,mountAuth,
    auth:(event,session)=>authEvent(event,session),idle(){for(const fn of idles.splice(0))fn();},unmountAuth:()=>authCleanup(),
    start:opts=>c.sync(c.sessionRef.current,opts),
    refresh:()=>refresh({user:{id:"synthetic"}},"TOKEN_REFRESHED"),
    pack:(patch={})=>({data:{...JSON.parse(JSON.stringify(initial)),budget:2000,_savedAt:200,...patch},updated_at:"synthetic-revision"}),
    flush(){for(const fn of updates.splice(0)){c.stateRef.current=fn(c.stateRef.current);commitCloudFixture(app,c,c,c.stateRef.current);}},
    elapse(ms){now+=ms;for(const [id,t] of [...timers])if(t.at<=now){timers.delete(id);t.fn();}},
    dispose(){const cleanup=app.match(/return\s*\(\)\s*=>\{\s*alive=false;[\s\S]*?off\(\);\s*\};/);assert.ok(cleanup);
      new Function("cloudPullRef","cloudReadRef","cloudUpdatedAtRef","sessionRef","let alive=true,resumeTimer=null,resumePull=null;const tmr=0,clearTimeout=()=>{},off=()=>{};"+cleanup[0])(c.cloudPullRef,c.cloudReadRef,c.cloudUpdatedAtRef,c.sessionRef)();}
  };
}
const stateTicks=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
async function finishStatePull(b,index=0,pack=b.pack()){
  b.pulls[index].resolve(pack);await stateTicks();b.flush();await stateTicks();
  b.expenses.at(-1).resolve();await stateTicks();b.flush();
}

test("FIN04 plazo: nueva petición a los 25 s releva el GET colgado y todas esperan al sucesor",async()=>{
  const b=statePullHarness(),old=b.start(),oldOk=b.c.pullOkRef.current,before=b.c.stateRef.current;
  b.elapse(25000);assert.equal(b.pulls.length,1,"sin solicitante no se corta una red lenta");
  const fresh=b.start(),freshOk=b.c.pullOkRef.current;
  assert.equal(b.pulls.length,2,"una petición tras el plazo debe lanzar otro pullState");
  const active=b.c.cloudPullRef.current;let finished=0;old.then(()=>finished++);fresh.then(()=>finished++);
  b.pulls[0].resolve(b.pack({budget:9999}));await stateTicks();b.flush();
  assert.equal(finished,0,"una respuesta relevada no termina las promesas mientras el sucesor espera");
  assert.equal(b.c.cloudPullRef.current,active);assert.equal(b.c.stateRef.current,before);
  assert.equal(b.gates[0].reads,0);assert.equal(b.c.cloudReadRef.current,null);assert.equal(b.c.cloudUpdatedAtRef.current,null);
  assert.equal(b.expenses.length,0);assert.equal(b.monthlyResults.length,0);
  await finishStatePull(b,1);await Promise.all([old,fresh]);await stateTicks();b.flush();
  assert.equal(await oldOk,false);assert.equal(await freshOk,true);assert.equal(b.c.pullOkRef.current,freshOk);
  assert.equal(b.c.cloudReadRef.current,active);assert.equal(active.ready,true);assert.equal(active.valid,true);
  assert.equal(b.c.cloudUpdatedAtRef.current,"synthetic-revision");assert.equal(b.c.cloudPullRef.current,null);
  assert.equal(b.c.stateRef.current.budget,2000);assert.equal(b.c.stateRef.current.expenses[0].id,"local");
  assert.equal(Math.round(b.c.stateRef.current.expenses[0].amount*100),1);
  assert.equal(b.c.stateRef.current.goals[0].saved,200);assert.equal(b.c.stateRef.current.reservaLog.length,2);
  assert.equal(b.monthlyResults.filter(Boolean).length,1);assert.equal(b.pulls.length,2);
});

test("FIN04 plazo: ráfaga temprana comparte promesa y el temporizador drena un solo relevo aunque el viejo rechace",async()=>{
  const b=statePullHarness(),old=b.start(),same=b.start(),again=b.start();
  assert.equal(same,old);assert.equal(again,old);b.elapse(24999);assert.equal(b.pulls.length,1);
  b.elapse(1);assert.equal(b.pulls.length,2);const active=b.c.cloudPullRef.current,newOk=b.c.pullOkRef.current;
  let finished=false;old.then(()=>{finished=true;});b.pulls[0].reject(Error("GET relevado offline"));await stateTicks();
  assert.equal(finished,false);assert.equal(b.c.cloudPullRef.current,active);assert.equal(b.c.pullOkRef.current,newOk);assert.equal(b.notices.length,0);
  await finishStatePull(b,1);await Promise.all([old,same,again]);await stateTicks();b.flush();
  assert.equal(b.pulls.length,2);assert.equal(b.monthlyResults.filter(Boolean).length,1);assert.equal(b.c.stateRef.current.goals[0].saved,200);
});

test("FIN04 plazo: red lenta sin nueva solicitud termina viva y limpia su temporizador",async()=>{
  const b=statePullHarness(),pull=b.start();b.elapse(60000);assert.equal(b.pulls.length,1);
  await finishStatePull(b);await pull;await stateTicks();b.flush();
  assert.equal(await b.c.pullOkRef.current,true);assert.equal(b.c.stateRef.current.goals[0].saved,200);assert.equal(b.timers.size,0);
});

test("FIN04 plazo: una mezcla retenida y sus gastos no se relevan a mitad; la intención espera al vuelo completo",async()=>{
  const b=statePullHarness(),old=b.start(),same=b.start();b.pulls[0].resolve(b.pack());await stateTicks();
  const read=b.c.cloudPullRef.current;assert.equal(read.merging,true);b.elapse(30000);
  assert.equal(b.start(),old);assert.equal(b.pulls.length,1);assert.equal(b.c.cloudReadRef.current,null);assert.equal(b.expenses.length,0);
  b.flush();await stateTicks();assert.equal(b.expenses.length,1);assert.equal(b.c.cloudReadRef.current,read);
  b.elapse(30000);assert.equal(b.start(),old);assert.equal(b.pulls.length,1);assert.equal(b.c.cloudPullRef.current,read);
  b.expenses[0].resolve();await stateTicks();assert.equal(b.pulls.length,2,"la relectura espera también a gastos");
  await finishStatePull(b,1);await Promise.all([old,same]);await stateTicks();b.flush();
  assert.equal(b.c.stateRef.current.goals[0].saved,200);assert.equal(b.monthlyResults.filter(Boolean).length,1);
});

test("FIN04 plazo: relevo conserva freshLogin/dropTx y una ausencia vieja no acredita el mes",async()=>{
  const b=statePullHarness();b.c.stateRef.current={...b.c.stateRef.current,_savedAt:9999};
  const old=b.start({freshLogin:true,dropTx:true});b.elapse(25000);const fresh=b.start();
  assert.equal(b.pulls.length,2);await finishStatePull(b,1,b.pack({accounts:[{id:"remote-account"}]}));await fresh;await stateTicks();b.flush();
  const state=b.c.stateRef.current,revision=b.c.cloudUpdatedAtRef.current,read=b.c.cloudReadRef.current,results=b.monthlyResults.length;
  b.pulls[0].resolve(null);await old;await stateTicks();b.flush();
  assert.equal(b.c.stateRef.current,state);assert.equal(b.c.cloudUpdatedAtRef.current,revision);assert.equal(b.c.cloudReadRef.current,read);
  assert.equal(state.budget,2000);assert.deepEqual(Array.from(state.bankTx),[]);assert.equal(state.onboarded,true);assert.equal(state.setupHint,false);
  assert.equal(b.gates[0].reads,0);assert.equal(b.monthlyResults.filter(Boolean).length,1);assert.equal(b.monthlyResults.length,results);assert.equal(b.writes.length,0);
});

for(const mode of ["misma UID","otro titular","desmontada"])test("FIN04 plazo: sesión "+mode+" no hereda ni reinicia el vuelo antiguo",async()=>{
  const b=statePullHarness(),old=b.start();b.start();const initial=b.c.stateRef.current;
  if(mode==="desmontada")b.dispose();else b.c.sessionRef.current={user:{id:mode==="misma UID"?"synthetic":"other"}};
  b.elapse(25000);assert.equal(b.pulls.length,1);b.pulls[0].resolve(b.pack());await old;await stateTicks();b.flush();
  assert.equal(b.c.stateRef.current,initial);assert.equal(b.c.cloudReadRef.current,null);assert.equal(b.c.cloudUpdatedAtRef.current,null);
  assert.equal(b.expenses.length,0);assert.equal(b.monthlyResults.filter(Boolean).length,0);assert.equal(b.writes.length,0);
  if(mode==="misma UID"){
    const fresh=b.start();await finishStatePull(b,1);await fresh;await stateTicks();b.flush();assert.equal(await b.c.pullOkRef.current,true);
  }
});

test("FIN04 plazo: error vigente libera el guardián y permite reintentar sin acreditar mes",async()=>{
  const b=statePullHarness(),failed=b.start();b.pulls[0].reject(Error("sin red"));await assert.rejects(failed,/sin red/);await stateTicks();b.flush();
  assert.equal(b.c.cloudPullRef.current,null);assert.equal(await b.c.pullOkRef.current,false);assert.equal(b.c.stateRef.current.goals[0].saved,100);assert.equal(b.timers.size,0);
  const fresh=b.start();await finishStatePull(b,1);await fresh;await stateTicks();b.flush();assert.equal(await b.c.pullOkRef.current,true);
});

test("FIN04 plazo: TOKEN_REFRESHED con updater en cola cancela su commit sin retener ni liberar el vuelo nuevo",async()=>{
  const b=statePullHarness();b.mountAuth();const old=b.start(),oldOk=b.c.pullOkRef.current,initial=b.c.stateRef.current;
  b.pulls[0].resolve(b.pack());await stateTicks();assert.equal(b.updates.length,1);assert.equal(b.c.cloudPullRef.current.merging,true);
  let finished=false;old.then(()=>{finished=true;});b.auth("TOKEN_REFRESHED",{user:{id:"synthetic"}});await stateTicks();b.elapse(0);await stateTicks();
  assert.equal(finished,true,"descartar el updater no puede dejar pendiente el commit antiguo");assert.equal(await oldOk,false);
  assert.equal(b.c.cloudReadRef.current,null);assert.equal(b.c.cloudUpdatedAtRef.current,null);assert.equal(b.c.stateRef.current,initial);
  const active=b.c.cloudPullRef.current,fresh=active.promise;b.flush();await stateTicks();
  assert.equal(b.c.stateRef.current,initial);assert.equal(b.c.cloudPullRef.current,active);assert.equal(b.expenses.length,0);assert.equal(b.monthlyResults.filter(Boolean).length,0);
  await finishStatePull(b,1,b.pack({budget:2300}));await Promise.all([old,fresh]);await stateTicks();b.flush();
  assert.equal(b.c.cloudReadRef.current,active);assert.equal(active.ready,true);assert.equal(b.c.stateRef.current.budget,2300);
  assert.equal(b.c.stateRef.current.goals[0].saved,200);assert.equal(b.monthlyResults.filter(Boolean).length,1);assert.equal(b.expenses.length,1);
});

// R2: eventos reales de cloud.onAuth y continuación real de cloud.session; sin start tras renovar.
for(const event of ["TOKEN_REFRESHED","SIGNED_IN","INITIAL_SESSION"])test("FIN04 R2 automático: "+event+" mismo UID recupera el pull sin otra petición",async()=>{
  const b=statePullHarness();b.mountAuth();const old=b.start({freshLogin:true,dropTx:true}),oldOk=b.c.pullOkRef.current;
  const next={user:{id:"synthetic"}};b.auth(event,next);await stateTicks();b.elapse(0);await stateTicks();
  assert.equal(b.pulls.length,2,"el callback debe relanzar automáticamente la lectura cancelada");
  const active=b.c.cloudPullRef.current,newOk=b.c.pullOkRef.current;
  b.pulls[0].resolve(b.pack({budget:9999}));await old;await stateTicks();b.flush();
  assert.equal(await oldOk,false);assert.equal(b.c.cloudPullRef.current,active);assert.equal(b.c.cloudUpdatedAtRef.current,null);
  await finishStatePull(b,1,b.pack({budget:2300,accounts:[{id:"remote"}]}));await active.promise;await stateTicks();b.flush();
  assert.equal(await newOk,true);assert.equal(b.c.stateRef.current.budget,2300);assert.equal(b.c.stateRef.current.onboarded,true);
  assert.deepEqual(Array.from(b.c.stateRef.current.bankTx),[]);assert.equal(b.c.stateRef.current.goals[0].saved,200);
  assert.equal(b.monthlyResults.filter(Boolean).length,1);assert.equal(b.pulls.length,2);b.unmountAuth();
});


test("FIN04 R2 automático: SIGNED_IN seguido de cloud.session e INITIAL_SESSION conserva login sin duplicar",async()=>{
  const b=statePullHarness();b.c.sessionRef.current=null;b.c.stateRef.current={...b.c.stateRef.current,_savedAt:9999};b.mountAuth();
  b.auth("SIGNED_IN",{user:{id:"synthetic"}});const old=b.c.cloudPullRef.current.promise,oldOk=b.c.pullOkRef.current;
  b.authSessions[0].resolve({user:{id:"synthetic"}});await stateTicks();
  b.auth("INITIAL_SESSION",{user:{id:"synthetic"}});await stateTicks();assert.equal(b.pulls.length,1,"no se consulta dentro del callback");
  b.idle();b.elapse(0);await stateTicks();assert.equal(b.pulls.length,2);
  const active=b.c.cloudPullRef.current,newOk=b.c.pullOkRef.current;
  b.pulls[0].reject(Error("rechazo viejo"));await old;await stateTicks();assert.equal(await oldOk,false);assert.equal(b.notices.length,0);
  await finishStatePull(b,1,b.pack({budget:2345,accounts:[{id:"remote"}]}));await active.promise;await stateTicks();b.flush();
  assert.equal(await newOk,true);assert.equal(b.c.stateRef.current.budget,2345);assert.equal(b.c.stateRef.current.onboarded,true);
  assert.equal(b.c.stateRef.current.bankTx[0].id,"local-tx","login sin titular previo conserva dropTx=false");
  assert.equal(b.c.stateRef.current.goals[0].saved,200);assert.equal(b.monthlyResults.filter(Boolean).length,1);
  b.idle();b.elapse(60000);await stateTicks();assert.equal(b.pulls.length,2);b.unmountAuth();
});

for(const mode of ["logout","unmount"])test("FIN04 R2 automático: "+mode+" elimina relevo pendiente sin reiniciar",async()=>{
  const b=statePullHarness();b.mountAuth();const old=b.start(),initial=b.c.stateRef.current;
  b.auth("TOKEN_REFRESHED",{user:{id:"synthetic"}});
  if(mode==="logout")b.auth("SIGNED_OUT",null);else b.unmountAuth();
  b.elapse(60000);b.pulls[0].resolve(b.pack({budget:9999}));await old;await stateTicks();b.flush();
  assert.equal(b.pulls.length,1);assert.equal(b.c.stateRef.current.budget,initial.budget);assert.equal(b.c.cloudReadRef.current,null);
  assert.equal(b.c.cloudUpdatedAtRef.current,null);assert.equal(b.expenses.length,0);assert.equal(b.monthlyResults.filter(Boolean).length,0);
  if(mode==="logout")b.unmountAuth();
});

test("FIN04 R2 automático: ráfaga usa última sesión, otro UID conserva su login y descarta datos viejos",async()=>{
  const b=statePullHarness();b.mountAuth();const old=b.start({freshLogin:true,dropTx:false});
  b.auth("TOKEN_REFRESHED",{user:{id:"synthetic"}});const last={user:{id:"synthetic"}};
  b.auth("SIGNED_IN",last);b.auth("TOKEN_REFRESHED",last);b.elapse(0);await stateTicks();
  assert.equal(b.pulls.length,2);assert.equal(b.c.cloudPullRef.current.session,last);
  b.auth("TOKEN_REFRESHED",last);assert.equal(b.pulls.length,2,"mismo objeto no cancela ni duplica");
  const cancelled=b.c.cloudPullRef.current.promise;b.auth("SIGNED_IN",{user:{id:"other"}});
  const active=b.c.cloudPullRef.current;assert.equal(b.pulls.length,3);assert.equal(active.owner,"other");
  b.elapse(0);b.pulls[0].resolve(b.pack({budget:9999}));b.pulls[1].reject(Error("sesión saliente"));
  await Promise.all([old,cancelled]);await stateTicks();b.flush();assert.equal(b.c.cloudReadRef.current,null);
  await finishStatePull(b,2,b.pack({_historyOwner:"other",budget:4567,accounts:[{id:"other-account"}],expenses:[]}));
  await active.promise;await stateTicks();b.flush();assert.equal(b.c.stateRef.current._historyOwner,"other");
  assert.equal(b.c.stateRef.current.budget,4567);assert.deepEqual(Array.from(b.c.stateRef.current.bankTx),[]);
  assert.equal(b.c.stateRef.current.onboarded,true);assert.equal(b.notices.length,0);assert.equal(b.pulls.length,3);b.unmountAuth();
});


test("FIN04 R2 intención: otro disparador entre cancelación y defer conserva freshLogin/dropTx",async()=>{
  const b=statePullHarness();b.mountAuth();b.c.stateRef.current={...b.c.stateRef.current,_savedAt:9999};
  const old=b.start({freshLogin:true,dropTx:true});b.auth("TOKEN_REFRESHED",{user:{id:"synthetic"}});
  // Simula primer plano/edición antes del turno diferido; no es el oráculo del relanzamiento automático.
  const external=b.start(),active=b.c.cloudPullRef.current;b.elapse(0);await stateTicks();assert.equal(b.pulls.length,2);
  b.pulls[0].resolve(b.pack({budget:9999}));await old;await finishStatePull(b,1,b.pack({budget:2468,accounts:[{id:"remote"}]}));
  await external;await stateTicks();b.flush();assert.equal(b.c.cloudReadRef.current,active);assert.equal(await b.c.pullOkRef.current,true);
  assert.equal(b.c.stateRef.current.budget,2468,"el trigger concurrente conserva freshLogin aunque el reloj local sea mayor");
  assert.deepEqual(Array.from(b.c.stateRef.current.bankTx),[],"dropTx no se pierde entre cancelación y relevo");
  assert.equal(b.c.stateRef.current.onboarded,true);assert.equal(b.monthlyResults.filter(Boolean).length,1);assert.equal(b.pulls.length,2);b.unmountAuth();
});
