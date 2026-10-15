import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { transformSync } from "esbuild";
import { loadPureLogic, loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";
const html=fs.readFileSync(new URL("../public/index.html",import.meta.url),"utf8");
const c=loadPureLogicFromFile(), clone=x=>JSON.parse(JSON.stringify(x));
const NOW=Date.parse("2026-10-13T12:00:00Z"), DAY=86400000;
const clock=ctx=>{ctx.Date=class extends Date{constructor(...a){super(...(a.length?a:[NOW]));}static now(){return NOW;}};return ctx;};clock(c);
const state=(expenses=[])=>({accounts:[{id:"tr",ent:"trade_republic",role:"diario",spendFrom:true,value:1000}],settings:{expenseBanks:["trade_republic"]},expenses,gemelos:[],fixed:[],debts:[],oneoffs:[],flows:[],deleted:[],budget:1000,investments:[]});
const aviso=(id="a",day="2026-10-10",amount=12,extra={})=>Object.assign({id,date:day+"T08:00:00Z",amount,merchant:"Aviso "+id,category:"otros",source:"macrodroid",ent:"trade_republic"},extra);
const tx=(day="2026-10-10",amount=12,extra={})=>Object.assign({date:day,amount,merchant:"Movimiento",ent:"trade_republic",status:"BOOK"},extra);
function sync(ctx,s,txs,automatic=true){
  const add=ctx.importObExpenses(s,txs,[{aspsp:"Trade Republic",syncFrom:"2026-01-01"}])||[];
  const gemelos=ctx.pushGemelos(s.gemelos,ctx.gemelosDeImportacion(add,s.expenses));
  const next=Object.assign({},s,{expenses:add.concat(s.expenses),gemelos});
  return automatic?ctx.reconcileGemelosAutomaticos(next):next;
}
const visible=s=>s.expenses.filter(e=>!e.autoGemelo);
const cents=(ctx,s,ym)=>s.expenses.filter(e=>(!ym||e.date.slice(0,7)===ym)&&ctx.expenseCountsBudget(e,s)).reduce((n,e)=>n+Math.round(e.amount*100),0);
const wire=(ctx,e)=>({id:e.id,fecha:e.date,importe:e.amount,comercio:e.merchant,source:ctx.expenseSourceForCloud(e),cat:e.category,ob_name:e.obName});
const fresh=(ctx,s)=>ctx.reconcileGemelosAutomaticos(Object.assign({},clone(ctx.slimForCloud(s)),{expenses:s.expenses.map(e=>ctx.expenseFromRow(wire(ctx,e)))}));
function cardinal(ctx){
  for(let n=0;n<=6;n++)for(let m=0;m<=6;m++){
    const s=sync(ctx,state(Array.from({length:m},(_,i)=>aviso("a"+i))),Array.from({length:n},()=>tx()));
    assert.equal(visible(s).length,Math.max(n,m),n+" bancos/"+m+" avisos");
    assert.equal(s.expenses.filter(e=>e.autoGemelo).length,Math.min(n,m));
    assert.equal(cents(ctx,s),Math.max(n,m)*1200);
    assert.equal(ctx.reconcileGemelosAutomaticos(s),s,"sin cambio conserva estado y array");
  }
}
test("cuenta min(N,M), conserva filas internas y solo muestra exceso (49 casos)",()=>cardinal(c));
function manual(ctx){
  const s=sync(ctx,state([aviso("manual",undefined,12,{source:"manual"})]),[tx()]);
  assert.equal(visible(s).length,2);assert.equal(s.expenses.filter(e=>e.autoGemelo).length,0);assert.equal(s.expenses.filter(e=>e.possibleDup).length,1);
}
test("los manuales siguen preguntando",()=>manual(c));
function boundaries(ctx){
  for(const patch of [{ent:"bbva"},{date:"2026-10-06T08:00:00Z"},{amount:12.01},{amount:-12}]){
    const s=sync(ctx,state([aviso("a",undefined,12,patch)]),[tx()]);
    assert.equal(s.expenses.filter(e=>e.autoGemelo).length,0,JSON.stringify(patch));
  }
  const s=sync(ctx,state([aviso()]),[tx(undefined,12,{id:"bank-id"})]);
  assert.equal(s.expenses.filter(e=>e.autoGemelo).length,0,"con id no aplica cuenta");
}
test("banco, ventana de Madrid, céntimo, signo e id delimitan el par",()=>boundaries(c));
test("pendiente y contabilizado ocupan una ranura; dos bizums reales dos",()=>{
  const s=sync(c,state([aviso()]),[tx(undefined,12,{status:"PDNG"}),tx()]);
  assert.equal(visible(s).length,1);assert.equal(cents(c,s),1200);
  const dos=sync(c,state(),[tx(undefined,-12),tx(undefined,-12)]);
  assert.equal(visible(dos).length,2);assert.equal(cents(c,dos),-2400);
});
test("repetir respuesta no añade filas; el crecimiento añade el exceso",()=>{
  let s=sync(c,state([aviso()]),[tx(),tx()]);const snapshot=clone(s);
  for(let i=0;i<3;i++)s=sync(c,s,[tx(),tx()]);
  assert.deepEqual(clone(s),snapshot);s=sync(c,s,[tx(),tx(),tx()]);
  assert.equal(visible(s).length,3);assert.equal(cents(c,s),3600);
});
test("aviso tardío conserva dos cargos y su gastado",()=>{
  const s=sync(c,state(),[tx(),tx()]);
  const late=c.reconcileGemelosAutomaticos({...s,expenses:s.expenses.concat([aviso()])},s);
  assert.equal(visible(late).length,2);assert.equal(cents(c,late),cents(c,s));
  const repairs=c.gemelosCambiosNube(late,s.expenses);assert.equal(repairs.length,1);assert.equal(repairs[0].dup,true);
});
function separated(ctx){
  const old=sync(ctx,state([aviso()]),[tx()]), separate=ctx.separarGemeloAutomatico(old,"a",1234);
  assert.equal(visible(separate).length,2);assert.equal(cents(ctx,separate),2400);assert.equal(separate.gemelos[0].at,1234);assert.equal(ctx.fusionarGemelos([],separate.gemelos)[0].separado,true,"la decisión viaja a un móvil sin registro previo");
  for(const [a,b] of [[separate,old],[old,separate]]){
    const merged=ctx.reconcileGemelosAutomaticos({...a,gemelos:ctx.fusionarGemelos(a.gemelos,b.gemelos)});
    assert.equal(visible(merged).length,2);assert.equal(cents(ctx,merged),2400);assert.equal(visible(fresh(ctx,merged)).length,2);
  }
  const repairs=ctx.gemelosCambiosNube(separate,old.expenses);assert.equal(repairs.length,1);assert.equal(repairs[0].dup,false);
  assert.equal(visible(sync(ctx,separate,[tx()])).length,2);
}
test("separar viaja, gana a nube vieja y repara solo #dup",()=>separated(c));
test("reloj atrasado y empate favorecen separar",()=>{
  const old=sync(c,state([aviso()]),[tx()]), future={...old,gemelos:[{...c.gemeloAutomaticoDe(old,old.expenses.find(e=>e.id==="a")),at:9000}]};
  const split=c.separarGemeloAutomatico(future,"a",1000);assert.equal(split.gemelos[0].at,9001);
  const stale=split.gemelos.map(g=>({...g,separado:false}));
  assert.equal(c.fusionarGemelos(split.gemelos,stale)[0].separado,true);assert.equal(c.fusionarGemelos(stale,split.gemelos)[0].separado,true);
});
test("borrados, recibos y cuotas no consumen avisos",()=>{
  const a=aviso();let s=sync(c,{...state([a]),deleted:[c.keyOfExpense(a)]},[tx()]);
  assert.equal(s.expenses.filter(e=>e.autoGemelo).length,0);
  for(const field of ["reciboId","debtId"]){
    const b={id:"b",...tx(),date:"2026-10-10T12:00:00Z",source:"ob",[field]:"modelo"};
    s=c.reconcileGemelosAutomaticos(state([a,b]));assert.equal(s.expenses.filter(e=>e.autoGemelo).length,0);
  }
});
function concurrentReservation(ctx){
  const plain=sync(ctx,state(),[tx(),tx()]),a=aviso(),gs=plain.expenses.map(b=>({...ctx.gemeloDe(a,b),auto:true,at:1}));
  for(const gemelos of [gs,gs.slice().reverse()]){
    const s=ctx.reconcileGemelosAutomaticos({...plain,expenses:plain.expenses.map(e=>({...e,possibleDup:true})).concat([a]),gemelos});
    assert.equal(s.expenses.filter(e=>e.autoGemelo).length,1);assert.equal(cents(ctx,s),2400);
  }
}
test("dos reservas concurrentes no ocultan dos bancos con un aviso",()=>concurrentReservation(c));

test("nube sin possibleDupOf ni autoGemelo reconstruye el par",()=>{
  const s=sync(c,state([aviso()]),[tx()]),b=fresh(c,s);
  assert.equal(visible(b).length,1);assert.equal(cents(c,b),1200);assert.ok(c.gemeloAutomaticoDe(b,b.expenses.find(e=>e.id==="a")));
});
test("90 días generados por beta123: 180 preguntas menos y gastado mensual idéntico",async()=>{
  const old=clock(loadPureLogic(execFileSync("git",["show","3625fa7ed5134cfbc5e364adc4f588bfdaf670c0:public/index.html"],{encoding:"utf8",maxBuffer:16*1024*1024})));
  let s=state(),expected=0;
  for(let d=89;d>=0;d--){
    const day=new Date(NOW-d*DAY).toISOString().slice(0,10),amount=(1000+d)/100;
    s={...s,expenses:s.expenses.concat([aviso("d"+d+"a",day,amount),aviso("d"+d+"b",day,amount)])};
    s=sync(old,s,[tx(day,amount),tx(day,amount),tx(day,amount)],false);expected+=3*(1000+d);
  }
  const migrated=c.reconcileGemelosAutomaticos(clone(s));
  assert.equal(s.expenses.length,450);assert.equal(migrated.expenses.length,450);
  assert.equal(s.expenses.filter(e=>e.possibleDup).length,180);assert.equal(visible(migrated).filter(e=>e.possibleDup).length,0);
  assert.equal(visible(migrated).length,270);assert.equal(cents(old,s),expected);
  for(const ym of ["2026-07","2026-08","2026-09","2026-10"])assert.equal(cents(c,migrated,ym),cents(old,s,ym),ym);
  const ts=fs.readFileSync(new URL("../supabase/functions/_shared/presupuesto.ts",import.meta.url),"utf8");
  const srv=await import("data:text/javascript;base64,"+Buffer.from(transformSync(ts,{loader:"ts",format:"esm"}).code).toString("base64"));
  const stats=srv.statsDelMes(srv.filasComoLaApp(migrated.expenses.map(e=>wire(c,e)),migrated.deleted),migrated,0);
  assert.equal(Math.round(stats.spent*100),expected,"vía independiente: servidor");
  console.log(JSON.stringify({migration90:{storedRowsBefore:450,storedRowsAfter:450,visibleRowsBefore:450,visibleRowsAfter:270,pendingBefore:180,pendingAfter:0,totalCents:expected,deltaSpentCents:0}}));
});
test("mutaciones causales de cuenta, límites y decisión persistida",()=>{
  const mutants=[
    ["reutilizar aviso","occupied.has(b.id)||used.has(a.id)","occupied.has(b.id)"],
    ["perder manual","!isManualExpenseSource(e.source)&&",""],
    ["cruzar banco",'grupo:ent+"|"','grupo:""+"|"'],
    ["cruzar ventana","Math.abs(x.dia-y.dia)<=ventana","true"],
    ["cruzar importe","Math.round(amount*100),dia:","1200,dia:"],
    ["perder separación","if(g.separado||b.gemeloSeparado&&!(g.auto&&g.at>1))","if(false)"],
    ["perder hora","at<(old.at||0)","false"],
    ["perder metadato nube","if(g.auto){ it.auto=true; it.at=at; if(g.ent) it.ent=g.ent; if(g.separado) it.separado=true; }",""]
  ];
  const verify=ctx=>{assert.equal(ctx.gemeloAvisoAutomatico(aviso("manual",undefined,12,{source:"manual"})),false);const g={aviso:"a",banco:"b",auto:true,at:9000};assert.equal(ctx.pushGemelos([g],[{...g,at:1000,separado:true}])[0].at,9000);cardinal(ctx);manual(ctx);boundaries(ctx);separated(ctx);concurrentSeparation(ctx);concurrentReservation(ctx);assert.equal(ctx.gemeloCompatible(aviso(),aviso("far","2026-10-02"),3),false);};
  verify(c);
  let killed=0;
  for(const [name,from,to] of mutants){
    assert.ok(html.includes(from),"preimagen "+name);const ctx=clock(loadPureLogic(html.replace(from,to)));
    assert.throws(()=>verify(ctx),assert.AssertionError,"sobrevive "+name);killed++;
  }
  console.log("tr-emparejado-automatico: "+killed+"/"+mutants.length+" mutantes muertos");
});

test("calendario de Madrid: UTC nocturno y cambios de hora conservan el día del banco",()=>{
  for(const [stamp,day] of [["2026-10-10T22:30:00Z","2026-10-11"],["2026-03-28T23:30:00Z","2026-03-29"],["2026-10-24T22:30:00Z","2026-10-25"]]){
    const a=aviso("m",day,12,{date:stamp}),b={id:"b",...tx(day),source:"ob",possibleDup:true};
    const s=c.reconcileGemelosAutomaticos(state([a,b]));
    assert.equal(s.expenses.filter(e=>e.autoGemelo).length,1,stamp);
  }
});
test("la separación con hora sobrevive a 500 vínculos sin decisión",()=>{
  const s=c.separarGemeloAutomatico(sync(c,state([aviso()]),[tx()]),"a",12345);
  const extra=Array.from({length:500},(_,i)=>({aviso:"otro-"+i,avisoId:"otro-"+i,banco:"b-"+i}));
  const merged=c.fusionarGemelos(s.gemelos,extra);
  assert.equal(merged.length,500);assert.ok(merged.some(g=>g.separado&&g.at===12345));
});
test("el updater REAL de App migra antes de pintar y conserva arrays en cambios ajenos",()=>{
  const match=/setStateRaw\(prev=>\{([\s\S]*?)\}\); \},\[\]\);/.exec(html);
  assert.ok(match);
  const update=vm.runInContext("(function(prev,updater){"+match[1]+"})",c);
  const a=state([aviso()]),b=sync(c,a,[tx()],false),next=update(a,b);
  assert.equal(visible(next).length,1);
  const onlyTheme=update(next,s=>({...s,settings:{...s.settings,theme:"blue"}}));
  assert.equal(onlyTheme.expenses,next.expenses);
});
test("el pull REAL no trae decisiones de la cuenta anterior",()=>{
  const block=/const merged=mergeExpenses\(prev\.expenses,\s*cloudState\.expenses\|\|\[\]\);([\s\S]*?)if\(freshLogin && \(cloudState\.accounts/.exec(html);
  assert.ok(block);
  const source=block[0].slice(0,block[0].lastIndexOf("if(freshLogin"));
  const pull=vm.runInContext("(function(prev,cloudState,freshLogin,opts,sessionRef,u){"+source+"return baseObj;})",c);
  const s=c.separarGemeloAutomatico(sync(c,state([aviso()]),[tx()]),"a",1234);
  const next=pull({...s,_historyOwner:"before"},state(),true,{dropTx:true},{current:{user:{id:"after"}}},"after");
  assert.equal(next.gemelos.length,0);
});

test("borrar el movimiento emparejado y Deshacer operan ambas filas por el código real de Gastos",()=>{
  const start=html.indexOf("  const delExpense=function(e){"),end=html.indexOf("  /* Posible repetido OB",start);
  assert.ok(start>0&&end>start);
  const code=html.slice(start,end);
  const factory=vm.runInContext("(function(state,set){const keyOfE=keyOfExpense,undoTimerRef={current:null},undoDeleteRef={current:null};const setUndoDelete=function(){},setTimeout=function(){return 1;},clearTimeout=function(){};"+code+"return {del:delExpense,undo:undoLastDelete};})",c);
  let live=sync(c,state([aviso()]),[tx()]);
  const original=clone(live),api=factory(live,fn=>{live=c.reconcileGemelosAutomaticos(fn(live));});
  api.del(live.expenses.find(e=>e.id==="a"));
  assert.equal(live.expenses.length,0);assert.equal(cents(c,live),0);
  for(const e of original.expenses)assert.ok(live.deleted.includes(c.keyOfExpense(e)),"lapida de cada fila, también la oculta");
  api.undo();
  assert.equal(live.expenses.length,2);assert.equal(visible(live).length,1);
  assert.equal(cents(c,live),cents(c,original));
});

test("dos bancos con misma clave local reservan cada uno su propio aviso",()=>{
  const a=aviso("tr"),z=aviso("bb",undefined,12,{ent:"bbva"});
  const b={id:"bt",...tx(),date:"2026-10-10T12:00:00Z",source:"ob"},b2={...b,id:"bank-bb",ent:"bbva"};
  const s=c.reconcileGemelosAutomaticos(state([a,z,b,b2]),state([b,b2]));
  assert.equal(visible(s).length,2);
  assert.equal(s.expenses.find(e=>e.id==="bt").autoGemelo,"tr");assert.equal(s.expenses.find(e=>e.id==="bank-bb").autoGemelo,"bb");
  assert.equal(c.gemelosCambiosNube(s,[b,b2]).length,2);
});

test("el arranque REAL migra y guarda sin tocar la semilla original",()=>{
  const seed=sync(c,state([aviso()]),[tx()],false),saved=[];
  seed.expenses=seed.expenses.map(e=>{const n={...e};delete n.autoGemelo;return n;});
  const ctx=clock(loadPureLogic(html));
  ctx.mcLoadRaw=()=>seed;ctx.mcStateKey=()=>"synthetic";ctx.mcSaveRaw=(key,s)=>saved.push(s);
  for(const fn of ["seedFlows","fixMovInvasion","fixRevoDupes","fixInvAuto","fixInvSold","reconcileTR","migrate","reconcileEarlyIncomeAnchors"])ctx[fn]=s=>s;
  ctx.applyTheme=ctx.applyA11y=()=>{};
  const next=ctx.loadState();assert.equal(visible(next).length,1);assert.equal(saved.at(-1),next);
  assert.equal(visible(seed).length,2);assert.equal(next.expenses.length,2);
});

function concurrentSeparation(ctx){
  const a=aviso("a"),z=aviso("z"),plain=sync(ctx,state(),[tx()]),b=plain.expenses[0];
  const records=[{...ctx.gemeloDe(a,b),auto:true,at:1,ent:"trade_republic"},{...ctx.gemeloDe(z,b),auto:true,at:10,ent:"trade_republic",separado:true}];
  for(const gemelos of [records,records.slice().reverse()]){
    const s=ctx.reconcileGemelosAutomaticos({...plain,expenses:[a,z,b],gemelos});
    assert.equal(visible(s).length,3,"la separación domina otra reserva del mismo banco");
    assert.equal(cents(ctx,s),3600);assert.equal(visible(fresh(ctx,s)).length,3);
  }
}
test("separar gana a una reserva concurrente para otro aviso",()=>concurrentSeparation(c));

if(!process.env.TR_PAIR_TZ_CHILD)test("misma cuenta en UTC, Madrid y Canarias (incluye ambos cambios de hora)",()=>{
  for(const TZ of ["UTC","Europe/Madrid","Atlantic/Canary"]){
    const out=execFileSync(process.execPath,[fileURLToPath(import.meta.url)],{encoding:"utf8",env:Object.fromEntries(Object.entries({...process.env,TZ,TR_PAIR_TZ_CHILD:"1"}).filter(([k])=>k!=="NODE_TEST_CONTEXT")),maxBuffer:4*1024*1024});
    assert.match(out,/tests 21/);assert.match(out,/fail 0/);console.log(TZ+": 21 PASS, 8/8 mutantes");
  }
});
