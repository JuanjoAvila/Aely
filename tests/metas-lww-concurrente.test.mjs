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
   merge de metas/reservaLog debe invertir este fichero, no borrarlo.
   Segunda parte (contrato, 5/10): la matriz de dos clientes, ambos órdenes de reloj y de subida, y un
   MODELO de referencia de la propuesta que cumple las mismas invariantes. Detalle y decisiones en
   docs/briefs/inc-0410-metas-lww-concurrencia.md. */
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
const AHORA=Date.UTC(2026,9,5,10,0,0);          // mes natural de Madrid 2026-10 para las reglas mensuales
let _uid=0; ctx.uid=()=>"u"+(++_uid);           // `removeReservaRule` lo toma del ámbito global
const identity=x=>x;
const BASE={budget:1000,accounts:[],investments:[],debts:[],fixed:[],expenses:[],_savedAt:1000,
  goals:[{id:"g1",name:"Sintetica uno",target:5000,saved:0},{id:"g2",name:"Sintetica dos",target:5000,saved:0}],
  settings:{reservaRules:[]},reservaLog:[]};

// Nube con la semántica de `pushState`: con sello conocido solo escribe si coincide.
function nube(base){
  let n=0; const row={data:clone(base||BASE),updated_at:"v0"};
  return {row,
    pullState:async()=>({data:clone(row.data),updated_at:row.updated_at}),
    pushState:async function(uid,data,known){
      if(known && known!==row.updated_at) return {conflict:true};
      row.data=clone(data); row.updated_at="v"+(++n); return {updated_at:row.updated_at};
    }};
}
function cliente(cloud,clock,base){
  let state=clone(base||BASE); const ref={current:null}, stamp={current:"v0"};
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
    // Operaciones FIELES al producto (a diferencia de `aporta`, que asienta un `man|meta` que el producto no crea):
    // «Aportar a una meta» solo toca `saved` (09-tab-debts-goals addToGoal: sin asiento, sin id, suma en coma flotante).
    manual:function(goalId,amount){ set(function(s){ return Object.assign({},s,{goals:s.goals.map(function(g){
      return g.id===goalId?Object.assign({},g,{saved:Math.max(0,(g.saved||0)+amount)}):g; })}); }); },
    regla:function(id,goalId,value){ set(function(s){ return ctx.addReservaRule(s,{id,name:"Sintetica",kind:"fixed",value,goalId,mensual:true},AHORA); }); },
    mensual:function(){ set(function(s){ return ctx.applyReservaMensual(s,AHORA); }); },
    borraRegla:function(id){ set(function(s){ return ctx.removeReservaRule(s,id); }); },
    borraMeta:function(id){ set(function(s){ return Object.assign({},s,{goals:s.goals.filter(function(g){ return g.id!==id; })}); }); },
    // Subida que el servidor APLICA pero cuyo ACK no llega: el sello local queda viejo.
    pushPerdidoAck:async function(){ await cloud.pushState("u",clone(state),stamp.current); return "ack-perdido"; },
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

/* ───────── Contrato: matriz de dos clientes ─────────
   Cada escenario se corre sobre el producto REAL (syncFromCloud + sello) y sobre un MODELO de referencia
   de la propuesta, con el mismo ejecutor: dos relojes (quién escribe más tarde) × dos órdenes de subida.
   `hoyPierde:true`  → el producto incumple la invariante en algún orden (caracterización verde; con
                       LWW_ESPERADO=1 es rojo mientras no se arregle).
   `hoyPierde:false` → guarda de NO DUPLICAR: hoy se cumple y debe seguir cumpliéndose con cualquier arreglo
                       (una suma ciega o un delta contra el ancestro la rompen), en los dos modos. */
const baseConRegla=()=>{ const st=ctx.addReservaRule(clone(BASE),{id:"r1",name:"Sintetica",kind:"fixed",value:100,goalId:"g1",mensual:true},AHORA); return Object.assign(st,{_savedAt:1000}); };
// Regla mensual ya guardada en un estado anterior al mes: ninguno de los dos ha asentado todavía este mes.
const baseReglaPendiente=()=>Object.assign(clone(BASE),{settings:{reservaRules:[{id:"r1",name:"Sintetica",kind:"fixed",value:100,goalId:"g1",mensual:true}]}});
const baseLegacy=()=>Object.assign(clone(BASE),{goals:[{id:"g1",name:"Sintetica uno",target:5000,saved:500},BASE.goals[1]]});   // apertura sin asiento ni identidad
const cents=x=>Math.round(x*100);
const goalDe=(d,id)=>d.goals.find(g=>g.id===id);
const idsLog=d=>d.reservaLog.map(x=>x.id).sort();
const ESCENARIOS=[
  {n:"dos aportes manuales a la MISMA meta (100 y 50)",hoyPierde:true,A:c=>c.manual("g1",100),B:c=>c.manual("g1",50),
    ok:d=>cents(goalDe(d,"g1").saved)===15000},
  {n:"apertura legacy (saved 500, sin asientos) + aportes 100 y 50: ni derivar del registro ni max",hoyPierde:true,base:baseLegacy,A:c=>c.manual("g1",100),B:c=>c.manual("g1",50),
    ok:d=>cents(goalDe(d,"g1").saved)===65000},
  {n:"MISMA regla mensual y mismo mes aplicada en los dos: una vez, sin duplicar",hoyPierde:false,base:baseReglaPendiente,
    A:c=>c.mensual(),B:c=>c.mensual(),ok:d=>cents(goalDe(d,"g1").saved)===10000&&d.reservaLog.length===1},
  {n:"distinta regla sobre la MISMA meta (100 y 30): se conservan reglas, asientos y saldo",hoyPierde:true,A:c=>c.regla("r1","g1",100),B:c=>c.regla("r2","g1",30),
    ok:d=>cents(goalDe(d,"g1").saved)===13000&&idsLog(d).length===2&&d.settings.reservaRules.length===2},
  {n:"regla nueva (100) en uno y aporte manual (50) en otro, misma meta",hoyPierde:true,A:c=>c.regla("r1","g1",100),B:c=>c.manual("g1",50),
    ok:d=>cents(goalDe(d,"g1").saved)===15000&&d.reservaLog.length===1&&d.settings.reservaRules.length===1},
  {n:"liberación (borrar regla) en uno y aporte manual (50) en otro: lo aportado se conserva",hoyPierde:true,base:baseConRegla,A:c=>c.borraRegla("r1"),B:c=>c.manual("g1",50),
    ok:d=>cents(goalDe(d,"g1").saved)===15000&&d.reservaLog.filter(x=>x.releaseOf).length===1&&d.settings.reservaRules.length===0},
  {n:"borrar la meta en uno y aportar a ella en otro: la meta borrada no reaparece (decisión del dueño pendiente)",hoyPierde:true,A:c=>c.borraMeta("g1"),B:c=>c.manual("g1",50),
    ok:d=>!goalDe(d,"g1")},
  {n:"replay: la subida llega pero el ACK se pierde y se reintenta: una sola aportación",hoyPierde:false,solo:async(A)=>{ await A.pushPerdidoAck(); await A.push(); await ticks(); await A.push(); },
    A:c=>c.manual("g1",100),ok:d=>cents(goalDe(d,"g1").saved)===10000},
  {n:"céntimos: 0,10 + 0,20 seguidos suman 0,30 exactos",hoyPierde:true,solo:async(A)=>{ await A.push(); },
    A:c=>{ c.manual("g1",0.1); c.manual("g1",0.2); },ok:d=>goalDe(d,"g1").saved===0.3}
];
async function ejecuta(esc,fab,primeroRelojA,primeroSubeA){
  const clock={now:1000},base=(esc.base||(()=>BASE))(),cloud=fab.nube(base),A=fab.cliente(cloud,clock,base),B=fab.cliente(cloud,clock,base);
  if(esc.solo){ clock.now=2000; esc.A(A); await esc.solo(A); }
  else {
    clock.now=2000; (primeroRelojA?esc.A:esc.B)(primeroRelojA?A:B);
    clock.now=3000; (primeroRelojA?esc.B:esc.A)(primeroRelojA?B:A);
    const [p,q]=primeroSubeA?[A,B]:[B,A];
    await p.push(); await q.push(); await ticks(); await q.push(); await p.pull(); await p.push();
  }
  return cloud.row.data;
}
const VARIANTES=[[true,true],[true,false],[false,true],[false,false]];
async function matriz(fab){
  const res=[];
  for(const esc of ESCENARIOS){
    const malas=[]; let traza="";
    for(const [relojA,subeA] of (esc.solo?[[true,true]]:VARIANTES)){
      const d=await ejecuta(esc,fab,relojA,subeA);
      if(!esc.ok(d)) malas.push((relojA?"A":"B")+" más reciente, sube "+(subeA?"A":"B")+" primero");
      traza=" g1="+(goalDe(d,"g1")?goalDe(d,"g1").saved:"∅")+" g2="+total(d,"g2")+" asientos="+d.reservaLog.length+" reglas="+d.settings.reservaRules.length;
    }
    res.push({esc,malas,traza});
  }
  return res;
}
// Producto real: en cada escenario que hoy pierde, falla al menos un orden. Con LWW_ESPERADO=1, ninguno debe fallar.
const real=await matriz({nube,cliente});
for(const {esc,malas,traza} of real){
  await caso("producto · "+esc.n,async()=>{
    console.log("    "+(malas.length?"incumple en "+malas.length+" orden(es); última traza:":"cumple en todos; traza:")+traza);
    if(ESPERADO||!esc.hoyPierde) assert.deepEqual(malas,[],"invariante incumplida en: "+malas.join(" | "));
    else assert.ok(malas.length>0,"la caracterización ya no se cumple (¿se arregló?): "+esc.n);
  });
}

/* ───────── MODELO de referencia de la propuesta (no es producto) ─────────
   Invariantes:
   I1 saved(meta) = apertura + Σ créditos con identidad (goalLog ∪ asientos reservaLog positivos de esa meta).
      Las liberaciones (importe negativo, releaseOf) NO restan: borrar una regla conserva lo aportado.
   I2 Los registros se unen por `id` (idempotente: el mismo id dos veces es uno; replay inocuo).
   I3 La apertura es un registro de último-gana; si falta (estado legacy) vale saved − Σ créditos de ese lado.
      Dos lados que parten del mismo ancestro dan la misma apertura; si difieren, alguien escribió `saved`
      sin identidad (cliente viejo) y esa escritura es irrecuperable: gana el más reciente y se marca.
   I4 Borrados con lápida (`deletedGoals`, `deletedRules`, como `deleted` en gastos): la unión no resucita.
   I5 Todo en céntimos enteros. */
const suma=(d,goalId)=>(d.goalLog||[]).concat(d.reservaLog||[]).filter(x=>x&&x.goalId===goalId&&x.amount>0&&!x.releaseOf)
  .reduce((a,x)=>a+cents(x.amount),0);
const unePorId=(a,b)=>{ const m=new Map(); (a||[]).concat(b||[]).forEach(x=>{ if(!m.has(x.id)) m.set(x.id,x); }); return [...m.values()]; };
const unionStr=(a,b)=>[...new Set((a||[]).concat(b||[]))].sort();
function fusion(l,r){
  const goalLog=unePorId(l.goalLog,r.goalLog), reservaLog=unePorId(l.reservaLog,r.reservaLog);
  const deletedGoals=unionStr(l.deletedGoals,r.deletedGoals), deletedRules=unionStr(l.deletedRules,r.deletedRules);
  const nuevoL=(l._savedAt||0)>=(r._savedAt||0);
  const m={goalLog,reservaLog};
  const aperturaDe=(d,g)=>g.open!=null?cents(g.open):cents(g.saved)-suma(d,g.id);
  const ids=unionStr((l.goals||[]).map(g=>g.id),(r.goals||[]).map(g=>g.id)).filter(id=>deletedGoals.indexOf(id)<0);
  const goals=ids.map(id=>{
    const gl=(l.goals||[]).find(g=>g.id===id), gr=(r.goals||[]).find(g=>g.id===id);
    const base=gl&&gr?(nuevoL?gl:gr):(gl||gr);                     // campos no aditivos: gana el más reciente
    const ap=gl&&gr?(nuevoL?aperturaDe(l,gl):aperturaDe(r,gr)):aperturaDe(gl?l:r,gl||gr);
    const credito=suma({goalLog,reservaLog},id);
    return Object.assign({},base,{open:ap/100,saved:(ap+credito)/100});
  });
  const reglas=unePorId((l.settings||{}).reservaRules,(r.settings||{}).reservaRules).filter(x=>deletedRules.indexOf(x.id)<0);
  return Object.assign({},nuevoL?l:r,m,{goals,deletedGoals,deletedRules,settings:Object.assign({},(nuevoL?l:r).settings,{reservaRules:reglas})});
}
function clienteModelo(cloud,clock,base){
  let st=clone(base||BASE),stamp="v0",n=0; const tag="m"+(++_uid);
  const set=f=>{ const nx=f(st); if(nx!==st) st=Object.assign({},nx,{_savedAt:clock.now}); };
  const recompone=d=>Object.assign({},d,{goals:d.goals.map(g=>g.open!=null?Object.assign({},g,{saved:(cents(g.open)+suma(d,g.id))/100}):g)});
  return {state:()=>st,
    manual:(goalId,amount)=>set(s=>{ const g=goalDe(s,goalId), ap=g.open!=null?cents(g.open):cents(g.saved)-suma(s,goalId);
      return recompone(Object.assign({},s,{goals:s.goals.map(x=>x.id===goalId?Object.assign({},x,{open:ap/100}):x),goalLog:(s.goalLog||[]).concat([{id:tag+"-"+(++n),goalId,amount}])})); }),
    regla:(id,goalId,value)=>set(s=>ctx.addReservaRule(s,{id,name:"Sintetica",kind:"fixed",value,goalId,mensual:true},AHORA)),
    mensual:()=>set(s=>ctx.applyReservaMensual(s,AHORA)),
    borraRegla:id=>set(s=>Object.assign(ctx.removeReservaRule(s,id),{deletedRules:unionStr(s.deletedRules,[id])})),
    borraMeta:id=>set(s=>Object.assign({},s,{goals:s.goals.filter(g=>g.id!==id),deletedGoals:unionStr(s.deletedGoals,[id])})),
    // CAS contra la nube igual que `pushState`: con sello viejo no escribe, fusiona y reintenta en el siguiente push.
    push:async()=>{ if(stamp!==cloud.row.updated_at){ st=Object.assign(fusion(st,cloud.row.data),{_savedAt:clock.now}); stamp=cloud.row.updated_at; return "conflicto"; }
      cloud.row.data=clone(st); cloud.row.updated_at="v"+(++cloud.n); stamp=cloud.row.updated_at; return "ok"; },
    pushPerdidoAck:async()=>{ cloud.row.data=clone(st); cloud.row.updated_at="v"+(++cloud.n); return "ack-perdido"; },
    pull:async()=>{ st=Object.assign(fusion(st,cloud.row.data),{_savedAt:st._savedAt}); stamp=cloud.row.updated_at; }};
}
const nubeModelo=base=>({n:0,row:{data:clone(base||BASE),updated_at:"v0"}});
const modelo=await matriz({nube:nubeModelo,cliente:clienteModelo});
for(const {esc,malas,traza} of modelo){
  await caso("modelo · "+esc.n,async()=>{ console.log("    traza:"+traza); assert.deepEqual(malas,[],"el modelo incumple en: "+malas.join(" | ")); });
}
await caso("modelo · fusion conmutativa e idempotente sobre los escenarios de dos clientes",async()=>{
  for(const esc of ESCENARIOS.filter(e=>!e.solo)){
    const clock={now:1000},base=(esc.base||(()=>BASE))(),cloud=nubeModelo(base),A=clienteModelo(cloud,clock,base),B=clienteModelo(cloud,clock,base);
    clock.now=2000; esc.A(A); clock.now=3000; esc.B(B);
    const canon=d=>JSON.stringify(d,(k,v)=>Array.isArray(v)?v.slice().sort((x,y)=>JSON.stringify(x)<JSON.stringify(y)?-1:1):v);
    const ab=fusion(A.state(),B.state()),ba=fusion(B.state(),A.state());
    assert.equal(canon(ab.goals)+canon(ab.reservaLog)+canon(ab.goalLog),canon(ba.goals)+canon(ba.reservaLog)+canon(ba.goalLog),"conmutativa: "+esc.n);
    assert.equal(canon(fusion(ab,A.state()).goals),canon(ab.goals),"idempotente (replay de un lado ya fusionado): "+esc.n);
  }
});

/* Contrapropuestas DESCARTADAS, con el caso que las rompe (sobre saldos de la meta g1). */
await caso("descartadas · max(saved) pierde aportes independientes; suma de deltas duplica en replay; saved=Σregistro borra la apertura",async()=>{
  assert.equal(Math.max(100,50),100,"max(saved) con 100 y 50 deja 100: faltan 50 (S1)");
  const ancestro=0, local=100, remota=100;           // el servidor ya aplicó la subida de A y el ACK se perdió
  assert.equal(remota+(local-ancestro),200,"remoto + (local − ancestro) cuenta 100 dos veces (replay)");
  const apertura=500, registro=100+50;                // g1 legacy: 500 sin asientos, +100 y +50
  assert.equal(registro,150,"saved=Σ registro deja 150: los 500 de apertura desaparecen (legacy)");
});
if(failures) process.exitCode=1;
