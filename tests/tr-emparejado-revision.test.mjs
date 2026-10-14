import assert from "node:assert/strict";
import {test} from "node:test";
import {execFileSync} from "node:child_process";
import {performance} from "node:perf_hooks";
import {loadPureLogic,loadPureLogicFromFile} from "../scripts/load-pure-logic.mjs";
const c=loadPureLogicFromFile(), NOW=Date.parse("2026-10-13T12:00:00Z");
c.Date=class extends Date{constructor(...a){super(...(a.length?a:[NOW]));}static now(){return NOW;}};
const state=(expenses=[])=>({accounts:[{id:"tr",ent:"trade_republic",role:"diario",spendFrom:true,value:1000}],settings:{expenseBanks:["trade_republic"]},expenses,gemelos:[],fixed:[],debts:[],oneoffs:[],flows:[],deleted:[],budget:1000,investments:[]});
const notice=(id,day=8,amount=10,extra={})=>({id,date:"2026-10-"+String(day).padStart(2,"0")+"T10:00:00Z",amount,merchant:"Kiosco "+id,source:"macrodroid",ent:"trade_republic",category:"otros",...extra});
const tx=(day=8,amount=10)=>({date:"2026-10-"+String(day).padStart(2,"0"),amount,merchant:"Movimiento",ent:"trade_republic",status:"BOOK"});
function sync(s,ts,ctx=c){const add=ctx.importObExpenses(s,ts,[{aspsp:"Trade Republic",syncFrom:"2026-01-01"}])||[];const next={...s,expenses:add.concat(s.expenses),gemelos:ctx.pushGemelos(s.gemelos,ctx.gemelosDeImportacion(add,s.expenses))};return ctx.reconcileGemelosAutomaticos?ctx.reconcileGemelosAutomaticos(next,s):next;}
const cents=s=>s.expenses.filter(e=>c.expenseCountsBudget(e,s)).reduce((n,e)=>n+Math.round(e.amount*100),0);
test("un apunte con comercio real sin id conserva su importe y no se empareja por casualidad",()=>{
 const a=notice("alquiler",11,750.50,{merchant:"Alquiler piso",ent:"ing"});
 const t={...tx(11,750.50),merchant:"INMOBILIARIA GARCIA SL",ent:"ing"};
 const seed={...state([a]),accounts:[{id:"ing",ent:"ing",role:"diario",spendFrom:true,value:3000}],settings:{expenseBanks:["ing"]}};
 const s=sync(seed,[t]),b=s.expenses.find(e=>e.source==="ob");
 assert.equal(cents(s),150100);assert.ok(!b.possibleDup&&!b.autoGemelo);
 assert.equal(cents(sync(s,[t])),150100);
 const boot=c.reconcileGemelosAutomaticos({...s,expenses:s.expenses.map(e=>({...e}))});
 assert.equal(cents(boot),150100);assert.ok(!c.gemeloBancoAutomatico(b));
});

test("NO-GO: dos cafes de dias distintos no comparten aviso ni pregunta",()=>{
 const s=sync(state([notice("cafe",8,1.5)]),[tx(9,1.5),tx(8,1.5)]);
 assert.equal(cents(s),300);assert.equal(s.expenses.filter(e=>e.possibleDupOf==="cafe").length,1);
 assert.equal(s.expenses.filter(e=>e.possibleDup&&!e.autoGemelo).length,0);
});
test("NO-GO: medianoche y segundo pago tras primer sync conservan veinte euros",()=>{
 let s=sync(state([notice("noche",8,10,{date:"2026-10-08T21:50:00Z"})]),[tx(9)]);
 s=c.reconcileGemelosAutomaticos({...s,expenses:s.expenses.concat([notice("dia",9)])},s);
 s=sync(s,[tx(9),tx(9)]);assert.equal(cents(s),2000);
 assert.equal(s.expenses.filter(e=>e.autoGemelo).length,2);assert.equal(c.reconcileGemelosAutomaticos(s),s);
});
test("NO-GO: lapida sin vinculo reserva el aviso del primer ordinal",()=>{
 const a=notice("viejo"),b={...tx(),id:"b",source:"ob",obName:"Movimiento"};
 const s=sync({...state([a]),deleted:[c.keyOfExpense(b)]},[tx(),tx()]);
 assert.equal(cents(s),2000);assert.equal(s.expenses.filter(e=>e.autoGemelo).length,0);
 assert.equal(cents(sync(s,[tx(),tx()])),2000);
});
test("migrar son distintos historico no cambia dinero ni recrea pregunta",()=>{
 const s=state([notice("a"),{...tx(),id:"b",source:"ob",obName:"Movimiento"}]);
 const n=c.reconcileGemelosAutomaticos(s);assert.equal(cents(n),2000);assert.equal(n.expenses,s.expenses);
});
test("mas de 500 pares conservan referencias en segunda reconciliacion",()=>{
 const ns=Array.from({length:620},(_,i)=>notice("a"+i,8,10+i/100));
 const s=sync(state(ns),ns.map(e=>tx(8,e.amount)));
 assert.equal(s.expenses.filter(e=>e.autoGemelo).length,620);
 const n=c.reconcileGemelosAutomaticos(s);assert.ok(n===s,"estado idempotente");assert.equal(n.gemelos,s.gemelos);
});
test("aviso pendiente, recibo o deuda no participa ni en pregunta",()=>{
 for(const extra of [{possibleDup:true},{pending:true},{reciboId:"r"},{debtId:"d"}]){
 const s=sync(state([notice("a",8,10,extra)]),[tx()]);const b=s.expenses.find(e=>e.source==="ob");
 assert.ok(!b.possibleDup&&!b.autoGemelo,JSON.stringify(extra));
 }
});
test("son distintos desde version antigua prevalece al recibir la fila",()=>{
 const s=sync(state([notice("a")]),[tx()]),b=s.expenses.find(e=>e.source==="ob");
 const old={...b,possibleDup:false};delete old.autoGemelo;delete old.possibleDupOf;
 const received=c.mergeExpensesFromCloud(s.expenses,[old]).list;
 const n=c.reconcileGemelosAutomaticos({...s,expenses:received},s);
 assert.equal(cents(n),2000);assert.ok(!n.expenses.find(e=>e.id===b.id).autoGemelo);
});

test("asignacion global desplaza el exacto para cubrir el aviso adyacente",()=>{
 const s=sync(state([notice("a8",8),notice("a9",9)]),[tx(10),tx(9)]);
 assert.equal(cents(s),2000);assert.equal(s.expenses.filter(e=>e.autoGemelo).length,2);
});
test("editar importe, fecha fuera de ventana o banco separa el par de forma persistente",()=>{
 for(const extra of [{amount:12},{date:"2026-10-10T10:00:00Z"},{ent:"bbva"}]){
  const s=sync(state([notice("a")]),[tx()]);
  const n=c.reconcileGemelosAutomaticos({...s,expenses:s.expenses.map(e=>e.id==="a"?{...e,...extra}:e)},s);
  const b=n.expenses.find(e=>e.source==="ob");assert.ok(!b.possibleDup&&!b.autoGemelo);assert.equal(b.gemeloSeparado,"a");assert.ok(n.gemelos.some(g=>g.separado));
  assert.ok(c.reconcileGemelosAutomaticos(n)===n);
 }
});
test("separar y volver a unir viajan por las filas incluso con estado antiguo",()=>{
 const original=sync(state([notice("a")]),[tx()]);
 const split=c.separarGemeloAutomatico(original,"a",1000);assert.equal(cents(split),2000);
 const bank=split.expenses.find(e=>e.source==="ob"),a=split.expenses.find(e=>e.id==="a");
 const wire={...bank,possibleDup:false};delete wire.autoGemelo;delete wire.possibleDupOf;delete wire.gemeloSeparado;
 for(const gemelos of [[],split.gemelos.map(({aviso,avisoId,banco})=>({aviso,avisoId,banco})),original.gemelos]){
  const fresh=c.reconcileGemelosAutomaticos({...state([a,wire]),gemelos});assert.equal(cents(fresh),2000);assert.equal(c.gemelosCambiosNube(fresh,[wire]).length,0);
 }
 const joined=c.unirGemeloAutomatico(split,"a",2000);assert.equal(cents(joined),1000);assert.ok(c.gemeloAutomaticoDe(joined,a));
 const repairs=c.gemelosCambiosNube(joined,split.expenses);assert.equal(repairs.length,1);assert.equal(repairs[0].dup,true);
});
test("edicion de categoria con 20000 filas conserva parejas y evita recalcular fechas",()=>{
 const notices=Array.from({length:5708},(_,i)=>notice("a"+i,8,(1000+i)/100));
 let s=sync(state(notices),notices.map(e=>tx(8,e.amount)));
 s=c.reconcileGemelosAutomaticos({...s,expenses:s.expenses.concat(Array.from({length:20000-s.expenses.length},(_,i)=>notice("m"+i,8,1,{source:"manual"})))},s);
 const before=c.madridYmdParts;let calls=0;c.madridYmdParts=(...args)=>{calls++;return before(...args);};
 const rows=s.expenses.map((e,i)=>i===12000?{...e,category:"viajes"}:e),start=performance.now();
 const n=c.reconcileGemelosAutomaticos({...s,expenses:rows},s),elapsed=performance.now()-start;c.madridYmdParts=before;
 assert.equal(n.expenses,rows);assert.equal(n.gemelos,s.gemelos);assert.equal(calls,0);assert.ok(c.reconcileGemelosAutomaticos(n)===n);
 console.log(JSON.stringify({nodeDiagnostic:{rows:20000,pairs:5708,categoryMs:elapsed,dateRecalculations:calls,cpuThrottle:"none; CPU6 pending remote"}}));
});
test("12 estados de 90 dias: legado sin vinculos, distintos y medianoche conservan cada mes",()=>{
 const old=loadPureLogic(execFileSync("git",["show","6342459b0eeecd65eb1817db8e01bc179787c549:public/index.html"],{encoding:"utf8",maxBuffer:16e6}));
 old.Date=c.Date;const tables=[];
 for(let seed=0;seed<12;seed++){
  let s=state(),all=[];
  for(let d=89;d>=0;d--){
   const day=new Date(NOW-d*86400000).toISOString().slice(0,10),amount=(1000+((seed*11+d*7)%37))/100;
   const night=(d+seed)%4===0,date=night?new Date(Date.parse(day+"T00:00:00Z")-3*3600000).toISOString():day+"T10:00:00Z";
   const a={...notice("s"+seed+"d"+d),date,amount};
   s={...s,expenses:s.expenses.concat([a])};
   const t={...tx(),date:day,amount};all=all.concat([t,t]);s=sync(s,[t,t],old);
   const b=s.expenses.find(e=>e.possibleDup&&e.possibleDupOf===a.id);
   if(b&&(d+seed)%3===0){s=old.resolvePossibleDup(s,b.id,true);s={...s,deleted:s.deleted.concat([old.keyOfExpense(b)]),gemelos:[]};}
   else if(b&&(d+seed)%5===0)s=old.resolvePossibleDup(s,b.id,false);
  }
  const month=(ctx,x,ym)=>x.expenses.filter(e=>e.date.slice(0,7)===ym&&ctx.expenseCountsBudget(e,x)).reduce((n,e)=>n+Math.round(e.amount*100),0);
  let migrated=c.reconcileGemelosAutomaticos(JSON.parse(JSON.stringify(s))),reference=s;
  const stages=[];
  for(let stage=0;stage<3;stage++){
   if(stage){migrated=sync(migrated,all);reference=sync(reference,all,old);}
   const monthly={};for(const ym of ["2026-07","2026-08","2026-09","2026-10"]){const beta=month(old,reference,ym),candidate=month(c,migrated,ym);assert.equal(candidate,beta,seed+":"+stage+":"+ym);monthly[ym]={beta,candidate};}
   assert.equal(migrated.expenses.filter(e=>e.possibleDup&&!e.autoGemelo).length,0,"preguntas: "+seed+":"+stage);stages.push(monthly);
  }
  tables.push({seed,open:stages[0],sync:stages[1],secondSync:stages[2]});
 }
 console.log(JSON.stringify({migration90Legacy:tables}));
});

test("volver a unir desde otro movil vence a la separacion local anterior",()=>{
 const initial=sync(state([notice("a")]),[tx()]),split=c.separarGemeloAutomatico(initial,"a",1000),join=c.unirGemeloAutomatico(split,"a",2000);
 const wire=join.expenses.map(e=>{const n={...e};delete n.autoGemelo;delete n.possibleDupOf;delete n.gemeloSeparado;return n;});
 const merged={...split,gemelos:c.fusionarGemelos(split.gemelos,join.gemelos),expenses:c.mergeExpensesFromCloud(split.expenses,wire).list};
 const next=c.reconcileGemelosAutomaticos(merged,split);assert.equal(cents(next),1000);assert.ok(c.gemeloAutomaticoDe(next,next.expenses.find(e=>e.id==="a")));
});
test("reserva resuelta y pregunta manual no se sustituyen por avisos parecidos",()=>{
 const initial=sync(state([notice("a")]),[tx()]),b=initial.expenses.find(e=>e.source==="ob");
 const resolved=c.resolvePossibleDup(initial,b.id,true),again=sync(resolved,[tx(),tx()]);
 assert.equal(cents(again),2000);assert.equal(again.expenses.filter(e=>e.autoGemelo).length,0);
 const manual=notice("m",8,10,{source:"manual"}),bank={...tx(),id:"b",source:"ob",possibleDup:true,possibleDupOf:"m"};
 for(const gemelos of [[],[c.gemeloDe(manual,bank)]]){
  const s=c.reconcileGemelosAutomaticos({...state([manual,notice("a"),bank]),gemelos});
  const row=s.expenses.find(e=>e.id==="b");assert.equal(row.possibleDupOf,"m");assert.ok(!row.autoGemelo);
 }
 const impossible={...initial,gemelos:[{...c.gemeloAutomaticoDe(initial,initial.expenses.find(e=>e.id==="a")),separado:true}]};
 assert.equal(c.gemeloAutomaticoDe(impossible,initial.expenses.find(e=>e.id==="a")),null);
});
