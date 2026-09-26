import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const core=fs.readFileSync(new URL("../src/modules/00-core.js",import.meta.url),"utf8");
const uuid=n=>"00000000-0000-4000-8000-"+n.toString(16).padStart(12,"0");
function rows(n){ return Array.from({length:n},(_,i)=>({id:uuid(i+1),fecha:"2020-01-01T12:00:00Z",importe:i+1,
  comercio:"Movimiento "+i,cat:"otros",source:i%3===0?"ob-hist:sabadell#dup":"manual:sabadell",
  nota:"Concepto "+i,nota_edit:i%2===0,no_card:true,importe_orig:i+1,divisa:"USD",ob_name:"Banco "+i})); }

// Ejecuta cloud.pullExpenses real; el doble interpreta la consulta, sin copiar el paginador.
function client(table,{cap=1000,before=()=>{},response}={}){
  const queries=[];
  const sb={from(name){
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
  const ctx=vm.createContext({window:{supabase:{createClient:()=>sb}},CONFIG:{SUPABASE_URL:"test",SUPABASE_ANON_KEY:"test"}});
  vm.runInContext(core.slice(ini,end)+"\nglobalThis.client=cloud;",ctx);
  return {pull:()=>ctx.client.pullExpenses(),queries};
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
    await assert.rejects(c.pull());
  }
  const c=client(rows(2501),{response(n){if(n===2)return {data:[rows(2501).at(-1)],error:null};}});
  await assert.rejects(c.pull());
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
function syncHarness(pull){
  const main=fs.readFileSync(new URL("../src/modules/11-app-main.js",import.meta.url),"utf8");
  const ini=main.indexOf("const syncCloudExpenses=function(){"),end=main.indexOf("\n  };",ini)+5;
  const cli=loadPureLogicFromFile(),local={id:uuid(9999),date:"2019-01-01T12:00:00.000Z",amount:5,merchant:"Solo local",source:"manual"};
  const h={wS:{current:0},wR:{current:true},wP:{current:null},wC:{current:"|anterior|"},stateRef:{current:{expenses:[local],deleted:["lapida"]}},sets:0,uploads:0};
  const env={...cli,...h,cloud:{pullExpenses:pull,setExpenseCat:()=>Promise.resolve()},inicioDeMesMs:()=>0,
    subirGasto:()=>h.uploads++,fixMovInvasion:s=>s,reconcileObDupes:s=>({state:s,recat:[]}),
    set:fn=>{h.sets++;h.stateRef.current=fn(h.stateRef.current);}};
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
test("FIN07: sync nuevo termina antes, el viejo no pisa ni ACK ni histórico",async()=>{
  const pending=[];const h=syncHarness(()=>new Promise(resolve=>pending.push(resolve)));
  const old=h.sync(),latest=h.sync();pending[1]([{...rows(1)[0],source:"macrodroid",ingest_event_id:"nuevo"}]);
  await latest;const before=h.stateRef.current,ack=h.wC.current;
  pending[0]([{...rows(2)[1],source:"macrodroid",ingest_event_id:"viejo"}]);await old;
  assert.equal(h.stateRef.current,before);assert.equal(h.wC.current,ack);assert.ok(ack.includes("nuevo"));
  assert.ok(!ack.includes("viejo"));assert.equal(h.wR.current,true);assert.equal(h.sets,1);
});
