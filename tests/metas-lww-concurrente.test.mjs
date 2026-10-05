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
   docs/briefs/inc-0410-metas-lww-concurrencia.md.
   Tercera parte (endurecimiento, 5/10, tras la revisión independiente NO-GO de la matriz): dobles borrados,
   reparto por ingreso desde dos clientes, empate de `_savedAt`, estado completo conmutativo y el
   `pushState` REAL contra un doble de Supabase. Cada caso lleva su clase: `perdida` (aportación que
   desaparece), `precision` (céntimos) o `guarda` (no duplicar); lo que depende de una decisión del dueño
   va como `politica` y NO se asere. El MODELO no es una solución: los casos que viola quedan marcados
   NO-GO (`modeloNoGo`) y con LWW_ESPERADO=1 son rojo. */
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const app=fs.readFileSync(path.join(root,"src/modules/11-app-main.js"),"utf8");
const motor=fs.readFileSync(path.join(root,"src/modules/08-motor-bank.js"),"utf8");
const core=fs.readFileSync(path.join(root,"src/modules/00-core.js"),"utf8");
const ESPERADO=process.env.LWW_ESPERADO==="1";
const ETQ=ESPERADO?"contrato":"caracteriza";    // sin variable se asere lo que HOY pasa; con ella, lo deseado
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

// Nube IDEAL: el sello es un contador monótono del servidor (v1, v2…). El `pushState` real NO es esto:
// el sello es `updated_at` puesto por el CLIENTE con su reloj (ver «transporte fiel» más abajo). Los
// escenarios de la matriz asumen este caso ideal; no es una garantía del backend.
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
    // Reparto por ingreso REAL (`applyReserva`): cada cliente pone su `uid()`, así que dos clientes que
    // reparten el MISMO ingreso dejan asientos con id distinto y la misma `incomeKey`.
    reserva:function(income,plan){ set(function(s){ return ctx.applyReserva(s,income,plan); }); },
    // `saveEdit` de la meta: valor ABSOLUTO de «ahorrado» (puede bajarlo).
    edita:function(goalId,saved){ set(function(s){ return Object.assign({},s,{goals:s.goals.map(function(g){ return g.id===goalId?Object.assign({},g,{saved:saved}):g; })}); }); },
    config:function(patch){ set(function(s){ return Object.assign({},s,patch); }); },
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
// Dos reglas mensuales independientes, cada una con su asiento ya aplicado (r1→g1 100, r2→g2 30).
const baseDosReglas=()=>{ let st=clone(BASE);
  st=ctx.addReservaRule(st,{id:"r1",name:"Sintetica",kind:"fixed",value:100,goalId:"g1",mensual:true},AHORA);
  st=ctx.addReservaRule(st,{id:"r2",name:"Sintetica",kind:"fixed",value:30,goalId:"g2",mensual:true},AHORA);
  return Object.assign(st,{_savedAt:1000}); };
// Reparto por ingreso (no mensual): la regla y un asiento con `incomeKey` ya aplicados.
const INGRESO1={date:"2026-10-01",amount:2000,merchant:"Nomina sintetica"}, INGRESO2={date:"2026-10-02",amount:1500,merchant:"Otro ingreso sintetico"};
const reglaIng=(id,goalId,value)=>({id,name:"Sintetica",kind:"fixed",value,goalId});
const planDe=(ruleId,goalId,amount)=>({ruleId,goalId,name:"Sintetica",amount});
const baseReservaIngreso=()=>{ const st=Object.assign(clone(BASE),{settings:{reservaRules:[reglaIng("r1","g1",100)]}});
  return Object.assign(ctx.applyReserva(st,INGRESO1,[planDe("r1","g1",100)]),{_savedAt:1000}); };
// Reserva PARCIALMENTE liberada: dos asientos de r1 (o1, o2) y solo el primero ya compensado.
const baseParcial=()=>({...clone(BASE),goals:[{id:"g1",name:"Sintetica uno",target:5000,saved:200},BASE.goals[1]],
  settings:{reservaRules:[reglaIng("r1","g1",100)]},
  reservaLog:[{id:"o1",ruleId:"r1",goalId:"g1",name:"Sintetica",amount:100,date:"2026-09-01",incomeKey:"k1"},
    {id:"o2",ruleId:"r1",goalId:"g1",name:"Sintetica",amount:100,date:"2026-10-01",incomeKey:"k2"},
    {id:"rel1",ruleId:"r1",goalId:"g1",name:"Sintetica",amount:-100,date:"2026-09-01",incomeKey:"k1",releaseOf:"o1",releasedAt:"2026-09-15T10:00:00.000Z"}]});
// Regla mensual ya guardada en un estado anterior al mes: ninguno de los dos ha asentado todavía este mes.
const baseReglaPendiente=()=>Object.assign(clone(BASE),{settings:{reservaRules:[{id:"r1",name:"Sintetica",kind:"fixed",value:100,goalId:"g1",mensual:true}]}});
const baseLegacy=()=>Object.assign(clone(BASE),{goals:[{id:"g1",name:"Sintetica uno",target:5000,saved:500},BASE.goals[1]]});   // apertura sin asiento ni identidad
const baseReglaIng=()=>Object.assign(clone(BASE),{settings:{reservaRules:[reglaIng("r1","g1",100),reglaIng("r2","g1",30)]}});
const cents=x=>Math.round(x*100);
const goalDe=(d,id)=>d.goals.find(g=>g.id===id);
const idsLog=d=>d.reservaLog.map(x=>x.id).sort();
const liberaciones=d=>d.reservaLog.filter(x=>x.releaseOf);
// «Una sola vez por origen»: ningún asiento original queda compensado dos veces (clave `releaseOf`).
const unaPorOrigen=d=>{ const n={}; liberaciones(d).forEach(x=>{ n[x.releaseOf]=(n[x.releaseOf]||0)+1; }); return Object.keys(n).every(k=>n[k]===1); };
const delIngreso=(d,k)=>d.reservaLog.filter(x=>x.incomeKey===k&&!x.releaseOf).length;
const KEY1=ctx.reservaKeyOf(INGRESO1), KEY2=ctx.reservaKeyOf(INGRESO2);
/* Clases (se distinguen en la salida): `perdida` = una aportación o asiento independiente desaparece;
   `precision` = coma flotante; `guarda` = NO duplicar / NO liberar dos veces; `politica` = depende de una
   decisión del dueño, se ejecuta y se registra pero NO se asere ningún resultado (sin `ok`).
   `hoyPierde:true` → el producto incumple en algún orden. `modeloNoGo:true` → el MODELO de más abajo
   también incumple en algún orden: está documentado como NO-GO, no como solución. */
const ESCENARIOS=[
  {n:"dos aportes manuales a la MISMA meta (100 y 50)",clase:"perdida",hoyPierde:true,A:c=>c.manual("g1",100),B:c=>c.manual("g1",50),
    ok:d=>cents(goalDe(d,"g1").saved)===15000},
  {n:"apertura legacy (saved 500, sin asientos) + aportes 100 y 50: ni derivar del registro ni max",clase:"perdida",hoyPierde:true,base:baseLegacy,A:c=>c.manual("g1",100),B:c=>c.manual("g1",50),
    ok:d=>cents(goalDe(d,"g1").saved)===65000},
  {n:"MISMA regla mensual y mismo mes aplicada en los dos: una vez, sin duplicar",clase:"guarda",hoyPierde:false,base:baseReglaPendiente,
    A:c=>c.mensual(),B:c=>c.mensual(),ok:d=>cents(goalDe(d,"g1").saved)===10000&&d.reservaLog.length===1},
  {n:"distinta regla sobre la MISMA meta (100 y 30): se conservan reglas, asientos y saldo",clase:"perdida",hoyPierde:true,A:c=>c.regla("r1","g1",100),B:c=>c.regla("r2","g1",30),
    ok:d=>cents(goalDe(d,"g1").saved)===13000&&idsLog(d).length===2&&d.settings.reservaRules.length===2},
  {n:"regla nueva (100) en uno y aporte manual (50) en otro, misma meta",clase:"perdida",hoyPierde:true,A:c=>c.regla("r1","g1",100),B:c=>c.manual("g1",50),
    ok:d=>cents(goalDe(d,"g1").saved)===15000&&d.reservaLog.length===1&&d.settings.reservaRules.length===1},
  {n:"liberación (borrar regla) en uno y aporte manual (50) en otro: lo aportado se conserva",clase:"perdida",hoyPierde:true,base:baseConRegla,A:c=>c.borraRegla("r1"),B:c=>c.manual("g1",50),
    ok:d=>cents(goalDe(d,"g1").saved)===15000&&d.reservaLog.filter(x=>x.releaseOf).length===1&&d.settings.reservaRules.length===0},
  // Decisión del dueño nº1 (brief): NO se asere ningún desenlace. Se registra qué sale en cada orden.
  {n:"POLÍTICA · borrar la meta en uno y aportar a ella en otro (borrado vs aporte)",clase:"politica",hoyPierde:false,A:c=>c.borraMeta("g1"),B:c=>c.manual("g1",50)},
  // Decisión del dueño nº2: el valor absoluto de `saveEdit` frente a un aporte concurrente.
  {n:"POLÍTICA · editar «ahorrado» a 300 en uno y aportar 50 en otro (absoluto vs aporte)",clase:"politica",hoyPierde:false,A:c=>c.edita("g1",300),B:c=>c.manual("g1",50)},
  {n:"replay: la subida llega pero el ACK se pierde y se reintenta: una sola aportación",clase:"guarda",hoyPierde:false,solo:async(A)=>{ await A.pushPerdidoAck(); await A.push(); await ticks(); await A.push(); },
    A:c=>c.manual("g1",100),ok:d=>cents(goalDe(d,"g1").saved)===10000},
  {n:"céntimos: 0,10 + 0,20 seguidos suman 0,30 exactos",clase:"precision",hoyPierde:true,solo:async(A)=>{ await A.push(); },
    A:c=>{ c.manual("g1",0.1); c.manual("g1",0.2); },ok:d=>goalDe(d,"g1").saved===0.3},
  // ── Dobles borrados: `removeReservaRule` REAL en los dos clientes, cada uno con su `uid()` en la liberación.
  {n:"doble borrado de la MISMA regla mensual en los dos: una liberación por origen",clase:"guarda",hoyPierde:false,modeloNoGo:true,base:baseConRegla,A:c=>c.borraRegla("r1"),B:c=>c.borraRegla("r1"),
    ok:d=>liberaciones(d).length===1&&unaPorOrigen(d)&&d.settings.reservaRules.length===0},
  {n:"doble borrado de la MISMA reserva por ingreso en los dos: una liberación por origen",clase:"guarda",hoyPierde:false,modeloNoGo:true,base:baseReservaIngreso,A:c=>c.borraRegla("r1"),B:c=>c.borraRegla("r1"),
    ok:d=>liberaciones(d).length===1&&unaPorOrigen(d)&&d.settings.reservaRules.length===0},
  {n:"doble borrado con reserva PARCIAL (o1 ya liberado, o2 no): solo se libera o2, una vez",clase:"guarda",hoyPierde:false,modeloNoGo:true,base:baseParcial,A:c=>c.borraRegla("r1"),B:c=>c.borraRegla("r1"),
    ok:d=>liberaciones(d).length===2&&unaPorOrigen(d)&&d.settings.reservaRules.length===0},
  {n:"control · borrar reglas INDEPENDIENTES (r1 en uno, r2 en otro): se conservan las dos liberaciones",clase:"perdida",hoyPierde:true,base:baseDosReglas,A:c=>c.borraRegla("r1"),B:c=>c.borraRegla("r2"),
    ok:d=>liberaciones(d).length===2&&unaPorOrigen(d)&&d.settings.reservaRules.length===0},
  {n:"control · borrar r1 en uno y aportar 50 a OTRA meta (g2) en otro: la liberación y el aporte conviven",clase:"perdida",hoyPierde:true,base:baseDosReglas,A:c=>c.borraRegla("r1"),B:c=>c.manual("g2",50),
    ok:d=>liberaciones(d).length===1&&cents(goalDe(d,"g2").saved)===8000&&d.settings.reservaRules.length===1},
  {n:"replay del borrado: sube, el ACK se pierde y se reintenta: una liberación, sin reparar nada retroactivo",clase:"guarda",hoyPierde:false,base:baseConRegla,solo:async(A)=>{ await A.pushPerdidoAck(); await A.push(); await ticks(); await A.push(); },
    A:c=>c.borraRegla("r1"),ok:d=>liberaciones(d).length===1&&unaPorOrigen(d)},
  // ── Reparto por ingreso (`applyReserva` REAL) desde dos clientes, ids `uid` distintos.
  {n:"MISMO ingreso, regla y meta aplicado en los dos con uid distintos: un solo asiento (identidad semántica incomeKey+regla)",clase:"guarda",hoyPierde:false,modeloNoGo:true,base:baseReglaIng,
    A:c=>c.reserva(INGRESO1,[planDe("r1","g1",100)]),B:c=>c.reserva(INGRESO1,[planDe("r1","g1",100)]),
    ok:d=>cents(goalDe(d,"g1").saved)===10000&&delIngreso(d,KEY1)===1},
  {n:"control · ingresos DISTINTOS (incomeKey distinta), misma regla y meta: las dos aportaciones se conservan",clase:"perdida",hoyPierde:true,base:baseReglaIng,
    A:c=>c.reserva(INGRESO1,[planDe("r1","g1",100)]),B:c=>c.reserva(INGRESO2,[planDe("r1","g1",100)]),
    ok:d=>cents(goalDe(d,"g1").saved)===20000&&delIngreso(d,KEY1)===1&&delIngreso(d,KEY2)===1},
  {n:"control · MISMO ingreso, reglas DISTINTAS sobre la misma meta (100 y 30): se conservan las dos",clase:"perdida",hoyPierde:true,base:baseReglaIng,
    A:c=>c.reserva(INGRESO1,[planDe("r1","g1",100)]),B:c=>c.reserva(INGRESO1,[planDe("r2","g1",30)]),
    ok:d=>cents(goalDe(d,"g1").saved)===13000&&delIngreso(d,KEY1)===2},
  {n:"control · MISMO ingreso, reglas y METAS distintas (r1→g1, r2→g2): se conservan las dos",clase:"perdida",hoyPierde:true,
    base:()=>Object.assign(clone(BASE),{settings:{reservaRules:[reglaIng("r1","g1",100),reglaIng("r2","g2",30)]}}),
    A:c=>c.reserva(INGRESO1,[planDe("r1","g1",100)]),B:c=>c.reserva(INGRESO1,[planDe("r2","g2",30)]),
    ok:d=>cents(goalDe(d,"g1").saved)===10000&&cents(goalDe(d,"g2").saved)===3000&&delIngreso(d,KEY1)===2}
];
// Relojes del cliente (`_savedAt`): quién escribió más tarde y el EMPATE (mismo milisegundo en los dos).
const RELOJES=[{n:"A más reciente",a:3000,b:2000},{n:"B más reciente",a:2000,b:3000},{n:"empate de _savedAt",a:3000,b:3000}];
const VARIANTES_DOS=RELOJES.length*2;                       // × quién sube primero
const variantesEsperadas=ESCENARIOS.reduce((a,e)=>a+(e.solo?1:VARIANTES_DOS),0);
async function ejecuta(esc,fab,reloj,subeA){
  const clock={now:1000},base=(esc.base||(()=>BASE))(),cloud=fab.nube(base),A=fab.cliente(cloud,clock,base),B=fab.cliente(cloud,clock,base);
  if(esc.solo){ clock.now=2000; esc.A(A); await esc.solo(A); }
  else {
    clock.now=reloj.a; esc.A(A);
    clock.now=reloj.b; esc.B(B);
    const [p,q]=subeA?[A,B]:[B,A];
    await p.push(); await q.push(); await ticks(); await q.push(); await p.pull(); await p.push();
  }
  return cloud.row.data;
}
async function matriz(fab){
  const res=[]; let variantes=0;
  for(const esc of ESCENARIOS){
    const malas=[], resultados=new Set(); let traza="";
    for(const reloj of (esc.solo?[RELOJES[0]]:RELOJES)) for(const subeA of (esc.solo?[true]:[true,false])){
      const d=await ejecuta(esc,fab,reloj,subeA); variantes++;
      const etiqueta=(esc.solo?"un solo cliente":reloj.n+", sube "+(subeA?"A":"B")+" primero");
      if(esc.ok&&!esc.ok(d)) malas.push(etiqueta);
      traza=" g1="+(goalDe(d,"g1")?goalDe(d,"g1").saved:"∅")+" g2="+total(d,"g2")+" asientos="+d.reservaLog.length+" liberaciones="+liberaciones(d).length+" reglas="+d.settings.reservaRules.length;
      resultados.add("g1="+(goalDe(d,"g1")?goalDe(d,"g1").saved:"∅"));
    }
    res.push({esc,malas,traza,resultados:[...resultados].sort()});
  }
  return {res,variantes};
}
// Producto real: en cada escenario que hoy pierde, falla al menos un orden. Con LWW_ESPERADO=1, ninguno debe fallar.
const MP=await matriz({nube,cliente});
const real=MP.res;
await caso("matriz del producto: variantes realmente ejecutadas = "+variantesEsperadas+" ("+ESCENARIOS.length+" escenarios; los de un solo cliente cuentan 1, el resto "+VARIANTES_DOS+")",async()=>{
  console.log("    producto: "+MP.variantes+" variantes ejecutadas");
  assert.equal(MP.variantes,variantesEsperadas,"el conteo documentado no cuadra con lo ejecutado");
});
for(const {esc,malas,traza,resultados} of real){
  await caso(ETQ+" · producto · ["+esc.clase+"] "+esc.n,async()=>{
    if(!esc.ok){ console.log("    DECISIÓN PENDIENTE (no se asere): desenlaces observados "+resultados.join(" | ")); return; }
    console.log("    "+(malas.length?"incumple en "+malas.length+" variante(s); última traza:":"cumple en todas; traza:")+traza);
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
    reserva:(income,plan)=>set(s=>ctx.applyReserva(s,income,plan)),
    edita:(goalId,saved)=>set(s=>Object.assign({},s,{goals:s.goals.map(g=>g.id===goalId?Object.assign({},g,{saved,open:(cents(saved)-suma(s,goalId))/100}):g)})),
    config:patch=>set(s=>Object.assign({},s,patch)),
    // CAS contra la nube igual que `pushState`: con sello viejo no escribe, fusiona y reintenta en el siguiente push.
    push:async()=>{ if(stamp!==cloud.row.updated_at){ st=Object.assign(fusion(st,cloud.row.data),{_savedAt:clock.now}); stamp=cloud.row.updated_at; return "conflicto"; }
      cloud.row.data=clone(st); cloud.row.updated_at="v"+(++cloud.n); stamp=cloud.row.updated_at; return "ok"; },
    pushPerdidoAck:async()=>{ cloud.row.data=clone(st); cloud.row.updated_at="v"+(++cloud.n); return "ack-perdido"; },
    pull:async()=>{ st=Object.assign(fusion(st,cloud.row.data),{_savedAt:st._savedAt}); stamp=cloud.row.updated_at; }};
}
const nubeModelo=base=>({n:0,row:{data:clone(base||BASE),updated_at:"v0"}});
const MM=await matriz({nube:nubeModelo,cliente:clienteModelo});
const modelo=MM.res;
await caso("matriz del modelo: variantes realmente ejecutadas = "+variantesEsperadas,async()=>{
  console.log("    modelo: "+MM.variantes+" variantes ejecutadas");
  assert.equal(MM.variantes,variantesEsperadas);
});
// NO-GO: el modelo NO es una solución. Los casos marcados `modeloNoGo` los viola en algún orden y se registra
// aquí; con LWW_ESPERADO=1 son rojo. Si algún día el modelo los cumple, hay que quitar la marca a propósito.
const noGo=[];
for(const {esc,malas,traza} of modelo){
  await caso(ETQ+" · modelo · ["+esc.clase+"] "+esc.n+(esc.modeloNoGo?"  [NO-GO documentado]":""),async()=>{
    if(!esc.ok){ console.log("    DECISIÓN PENDIENTE (no se asere): sin elección en el modelo"); return; }
    console.log("    traza:"+traza+(malas.length?"  · incumple en: "+malas.join(" | "):""));
    if(esc.modeloNoGo&&malas.length) noGo.push(esc.n);
    if(ESPERADO||!esc.modeloNoGo) assert.deepEqual(malas,[],"el modelo incumple en: "+malas.join(" | "));
    else assert.ok(malas.length>0,"el modelo ya cumple este caso: retira modeloNoGo a propósito: "+esc.n);
  });
}
console.log("\n  MODELO NO-GO ("+noGo.length+" caso(s)) — el modelo duplica donde debe haber UNA liberación o UN reparto; falta identidad semántica (propuesta, no decidida):\n    · "+noGo.join("\n    · "));
// Canónico con claves ordenadas: dos estados son «el mismo» solo si lo son TODOS sus campos, no solo metas/log.
const canon=v=>JSON.stringify(v,(k,x)=>Array.isArray(x)?x.slice().sort((p,q)=>JSON.stringify(canonObj(p))<JSON.stringify(canonObj(q))?-1:1).map(canonObj):canonObj(x));
function canonObj(x){ if(x&&typeof x==="object"&&!Array.isArray(x)){ const o={}; Object.keys(x).sort().forEach(k=>{ o[k]=x[k]; }); return o; } return x; }
const dosClientes=(esc,reloj)=>{ const clock={now:1000},base=(esc.base||(()=>BASE))(),cloud=nubeModelo(base),A=clienteModelo(cloud,clock,base),B=clienteModelo(cloud,clock,base);
  clock.now=reloj.a; esc.A(A); clock.now=reloj.b; esc.B(B); return {A:A.state(),B:B.state()}; };
const vista=d=>canon(d.goals)+canon(d.reservaLog)+canon(d.goalLog);
await caso(ETQ+" · modelo · fusión conmutativa e idempotente (metas y registros) con relojes DISTINTOS (control)",async()=>{
  for(const esc of ESCENARIOS.filter(e=>!e.solo&&e.ok)) for(const reloj of RELOJES.slice(0,2)){
    const {A,B}=dosClientes(esc,reloj), ab=fusion(A,B), ba=fusion(B,A);
    assert.equal(vista(ab),vista(ba),"conmutativa ("+reloj.n+"): "+esc.n);
    assert.equal(canon(fusion(ab,A).goals),canon(ab.goals),"idempotente (replay de un lado ya fusionado): "+esc.n);
  }
});
// Con EMPATE `fusion` toma los campos no aditivos (p. ej. `done` de la meta) «del de la izquierda»: ni siquiera metas
// y registros salen iguales según el orden de llamada. Es un NO-GO del modelo, no un hallazgo del producto.
await caso(ETQ+" · modelo · fusión conmutativa (metas y registros) con EMPATE de _savedAt  [NO-GO documentado]",async()=>{
  const rotos=[];
  for(const esc of ESCENARIOS.filter(e=>!e.solo&&e.ok)){ const {A,B}=dosClientes(esc,RELOJES[2]); if(vista(fusion(A,B))!==vista(fusion(B,A))) rotos.push(esc.n); }
  console.log("    no conmutativa con empate en "+rotos.length+" escenario(s):"+(rotos.length?"\n      · "+rotos.join("\n      · "):" ninguno"));
  if(ESPERADO) assert.deepEqual(rotos,[],"empate: el orden de fusión cambia metas/registros");
  else assert.ok(rotos.length>0,"el modelo ya es conmutativo con empate: retira el NO-GO a propósito");
});
// ESTADO COMPLETO, configuración incluida (presupuesto, ajustes, campos no aditivos de la meta). Con relojes
// distintos el más reciente gana en los dos órdenes; con EMPATE `fusion` elige «el de la izquierda» y el
// resultado depende del orden de llamada: la fusión no es conmutativa sobre el estado completo.
const conConfig=(reloj)=>{ const clock={now:1000},cloud=nubeModelo(),A=clienteModelo(cloud,clock),B=clienteModelo(cloud,clock);
  clock.now=reloj.a; A.manual("g1",100); A.config({budget:1200,settings:{reservaRules:[],tema:"claro"}});
  clock.now=reloj.b; B.manual("g1",50); B.config({budget:900,settings:{reservaRules:[],tema:"oscuro"}});
  return {A:A.state(),B:B.state()}; };
await caso(ETQ+" · modelo · estado completo CONMUTATIVO con relojes distintos (control)",async()=>{
  for(const reloj of RELOJES.slice(0,2)){ const {A,B}=conConfig(reloj);
    assert.equal(canon(fusion(A,B)),canon(fusion(B,A)),"estado completo distinto según el orden ("+reloj.n+")"); }
});
await caso(ETQ+" · modelo · estado completo CONMUTATIVO con EMPATE de _savedAt (configuración distinta)  [NO-GO documentado]",async()=>{
  const {A,B}=conConfig(RELOJES[2]);
  const igual=canon(fusion(A,B))===canon(fusion(B,A));
  console.log("    fusion(A,B) "+(igual?"=":"≠")+" fusion(B,A): "+(igual?"conmutativa":"el orden decide qué configuración sobrevive (budget "+fusion(A,B).budget+" vs "+fusion(B,A).budget+")"));
  if(ESPERADO) assert.equal(igual,true,"empate: el resultado depende del orden de fusión");
  else assert.equal(igual,false,"el modelo ya es conmutativo con empate: retira el NO-GO a propósito");
});
await caso(ETQ+" · producto · empate de _savedAt: al bajar se adopta la nube y el cambio local aún no subido se pierde (`localNewer` es estricto)",async()=>{
  const clock={now:1000},cloud=nube(),A=cliente(cloud,clock),B=cliente(cloud,clock);
  clock.now=2000; A.manual("g1",100); clock.now=2000; B.manual("g1",50);
  await B.push(); await A.pull();
  const r=total(cloud.row.data,"g1"), a=total(A.state(),"g1");
  console.log("    nube g1="+r+", A tras bajar g1="+a+" (su aporte de 100 ya no está en su estado)");
  if(ESPERADO) assert.equal(cents(a),15000,"empate: A debería conservar su aporte y el de B");
  else assert.equal(a,50,"empate: A adopta la nube (`localNewer` es estricto) y pierde sus 100");
});

/* ───────── Transporte FIEL: el `pushState`/`pullState` REALES de 00-core contra un doble de Supabase ─────────
   El sello (`updated_at`) lo pone el CLIENTE con su reloj (`new Date().toISOString()`) y las migraciones no
   declaran ningún trigger que lo sustituya (se comprueba abajo). Si dos escrituras caen en el mismo instante,
   o un reloj repite valor, el sello ya no distingue una escritura de otra: el compare-and-swap acepta una
   subida que parte de un estado que ya no es el de la nube. La nube IDEAL de la matriz (v1, v2…, contador
   del servidor) NO tiene este fallo: es un escenario ideal explícito, no una garantía del backend.
   Fuera de alcance, sin Supabase real: clientes antiguos y escrituras sin sello quedan como BLOQUEO documentado. */
const metodos=bloque(core,"async pushState(").replace(/;$/,"")+","+bloque(core,"async pullState(").replace(/;$/,"");
function sbFalso(row,isoAhora){
  return {from:()=>{ const q={filtros:[]};
    const run=()=>{ const v=q.vals;
      if(q.op==="update"){ if(q.filtros.every(([c,x])=>row[c==="user_id"?"user_id":c]===x||c==="user_id")){ row.data=clone(v.data); row.updated_at=v.updated_at; return {data:[{updated_at:row.updated_at}],error:null}; } return {data:[],error:null}; }
      if(q.op==="upsert"){ row.data=clone(v.data); row.updated_at=v.updated_at; return {data:[{updated_at:row.updated_at}],error:null}; }
      return {data:{data:clone(row.data),updated_at:row.updated_at},error:null}; };
    const b={update(v){ q.op="update"; q.vals=v; return b; }, upsert(v){ q.op="upsert"; q.vals=v; return b; },
      select(){ return b; }, eq(c,x){ q.filtros.push([c,x]); return b; }, maybeSingle(){ return Promise.resolve(run()); },
      then(res,rej){ return Promise.resolve(run()).then(res,rej); }};
    return b; }};
}
function transporteReal(clock){
  const row={data:clone(BASE),updated_at:"2026-10-05T09:00:00.000Z",user_id:"u"};
  function FechaFalsa(){}  FechaFalsa.prototype.toISOString=()=>new Date(clock.now).toISOString();
  const api=vm.runInContext("(function(sb,Date){ return ({"+metodos+"}); })",ctx)(sbFalso(row,()=>0),FechaFalsa);
  return {row,api};
}
function transporteIdeal(){ const n=nube(); return {row:n.row,api:n}; }
// Un cliente mínimo con sello propio: lleva su estado, sube con el último sello conocido y cuenta lo que el servidor acepta.
function clienteSello(t,log){ const st={stamp:null,data:null};
  return {pull:async()=>{ const r=await t.api.pullState(); st.stamp=r.updated_at; st.data=r.data; },
    push:async(nombre,valor)=>{ const r=await t.api.pushState("u",{valor,por:nombre},st.stamp);
      if(r&&r.conflict){ log.conflictos++; return "conflicto"; } log.aceptadas.push(nombre); st.stamp=r.updated_at; return "ok"; },
    sello:()=>st.stamp};
}
const reloj0=()=>({now:Date.UTC(2026,9,5,10,0,0)});
await caso("transporte · premisas: el sello lo pone el CLIENTE y ninguna migración lo sustituye",async()=>{
  assert.match(core,/const now=new Date\(\)\.toISOString\(\);\s*if\(lastKnownUpdatedAt\)/,"pushState ya no usa el reloj del cliente: revisa esta sección");
  assert.match(core,/updated_at:now/);
  const dir=path.join(root,"supabase/migrations"), sql=fs.readdirSync(dir).filter(f=>f.endsWith(".sql")).map(f=>fs.readFileSync(path.join(dir,f),"utf8")).join("\n");
  const conTrigger=sql.split(/;\s*\n/).filter(x=>/create\s+(or\s+replace\s+)?trigger/i.test(x)&&/app_state/i.test(x));
  assert.equal(conTrigger.length,0,"hay un trigger sobre app_state: el sello puede ser del servidor; revisa el doble");
});
// Sello repetido: A sube dos veces en el mismo instante; B bajó entre medias y sube con el sello de la primera.
async function selloRepetido(t){ const log={aceptadas:[],conflictos:0}, A=clienteSello(t,log), B=clienteSello(t,log);
  await A.pull(); await A.push("A1",1); await B.pull();       // B parte del estado de A1
  await A.push("A2",2);                                          // A2 con reloj congelado: el sello no cambia (real)
  const selloA2=A.sello(); const rB=await B.push("B",3);         // B sube con un sello que ya no corresponde a lo que A subió
  return {log,rB,selloA2,final:t.row.data}; }
await caso(ETQ+" · transporte REAL · sello repetido: B pisa A2 y el servidor acepta las dos escrituras SIN conflicto",async()=>{
  const real=await selloRepetido(transporteReal(reloj0()));
  console.log("    real: aceptadas="+real.log.aceptadas.join(",")+" conflictos="+real.log.conflictos+" final.por="+real.final.por+" (A2 desaparece)");
  if(ESPERADO){ assert.equal(real.rB,"conflicto","B debía chocar: su sello ya no era el de la nube"); return; }
  assert.equal(real.rB,"ok"); assert.equal(real.log.conflictos,0,"sin conflicto");
  assert.deepEqual(real.log.aceptadas,["A1","A2","B"],"tres escrituras aceptadas, ninguna avisada");
  assert.equal(real.final.por,"B","B sobrescribe A2: se pierde sin aviso");
});
await caso("transporte · IDEAL (contador del servidor, v++): el mismo guion SÍ choca — escenario ideal, no garantía del backend",async()=>{
  const ideal=await selloRepetido(transporteIdeal());
  console.log("    ideal: aceptadas="+ideal.log.aceptadas.join(",")+" conflictos="+ideal.log.conflictos+" final.por="+ideal.final.por);
  assert.equal(ideal.rB,"conflicto"); assert.equal(ideal.final.por,"A2");
});
// Relojes empatados entre dos clientes: B escribe en el mismo milisegundo que A; A, con ese mismo sello, sube después.
async function relojesEmpatados(t){ const log={aceptadas:[],conflictos:0}, A=clienteSello(t,log), B=clienteSello(t,log);
  await A.pull(); await A.push("A1",1); await B.pull(); await B.push("B1",2);   // B1 comparte instante con A1
  const rA=await A.push("A2",3); return {log,rA,final:t.row.data}; }
await caso(ETQ+" · transporte REAL · relojes EMPATADOS: A sube con el sello de A1 tras B1 y el servidor acepta, pisando B1",async()=>{
  const real=await relojesEmpatados(transporteReal(reloj0()));
  console.log("    real: aceptadas="+real.log.aceptadas.join(",")+" conflictos="+real.log.conflictos+" final.por="+real.final.por);
  if(ESPERADO){ assert.equal(real.rA,"conflicto","A debía chocar con B1"); return; }
  assert.equal(real.rA,"ok"); assert.equal(real.log.conflictos,0); assert.equal(real.final.por,"A2","B1 se perdió sin conflicto");
});
await caso("transporte · IDEAL: el mismo guion de relojes empatados sí choca (ideal, no garantía)",async()=>{
  const ideal=await relojesEmpatados(transporteIdeal());
  assert.equal(ideal.rA,"conflicto"); assert.equal(ideal.final.por,"B1");
});
// BLOQUEO documentado: sin sello (`upsert` a ciegas) el servidor no compara nada. Pasa en clientes antiguos y en el
// primer push de una sesión sin pull. Ninguna fusión en cliente lo arregla: exige contrato backend aparte.
await caso("BLOQUEO documentado · sin sello conocido el real hace upsert a ciegas y pisa una escritura posterior sin conflicto",async()=>{
  const t=transporteReal(reloj0()), log={aceptadas:[],conflictos:0}, nuevo=clienteSello(t,log), viejo=clienteSello(t,log);
  await nuevo.pull(); await nuevo.push("N1",1);
  const r=await viejo.push("V",9);     // `viejo` jamás hizo pull: sello null
  console.log("    sin sello: "+r+"; final.por="+t.row.data.por+" (N1 se pisa)");
  if(ESPERADO) return;                 // aquí no hay contrato deseado verificable en cliente: se documenta, no se asere un arreglo
  assert.equal(r,"ok"); assert.equal(t.row.data.por,"V");
});
// El CAS solo es suficiente si el sello cambia en TODA escritura aceptada y no se repite: precondición que el real no
// cumple (reloj de cliente) y que esta suite no puede probar contra Supabase. No se afirma suficiencia del CAS.

/* Contrapropuestas DESCARTADAS, con el caso que las rompe (sobre saldos de la meta g1). */
await caso("descartadas · max(saved) pierde aportes independientes; suma de deltas duplica en replay; saved=Σregistro borra la apertura",async()=>{
  assert.equal(Math.max(100,50),100,"max(saved) con 100 y 50 deja 100: faltan 50 (S1)");
  const ancestro=0, local=100, remota=100;           // el servidor ya aplicó la subida de A y el ACK se perdió
  assert.equal(remota+(local-ancestro),200,"remoto + (local − ancestro) cuenta 100 dos veces (replay)");
  const apertura=500, registro=100+50;                // g1 legacy: 500 sin asientos, +100 y +50
  assert.equal(registro,150,"saved=Σ registro deja 150: los 500 de apertura desaparecen (legacy)");
});
if(failures) process.exitCode=1;
