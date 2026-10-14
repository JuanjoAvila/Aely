import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {execFileSync} from "node:child_process";
import {test} from "node:test";
import {loadPureLogic} from "../scripts/load-pure-logic.mjs";
const html=fs.readFileSync(new URL("../public/index.html",import.meta.url),"utf8");
const NOW=Date.parse("2026-10-14T12:00:00Z"),clone=x=>JSON.parse(JSON.stringify(x));
function context(source=html){const c=loadPureLogic(source);c.Date=class extends Date{constructor(...a){super(...(a.length?a:[NOW]));}static now(){return NOW;}};return c;}
const state=(expenses=[])=>({accounts:[{id:"tr",ent:"trade_republic",role:"diario",spendFrom:true,value:1000}],settings:{expenseBanks:["trade_republic"]},expenses,gemelos:[],deleted:[],fixed:[],debts:[],oneoffs:[],flows:[],investments:[],budget:1000});
const notice=(id="a",day="2026-10-08",amount=10)=>({id,date:day+"T10:00:00Z",amount,merchant:"Compra "+id,category:"otros",source:"macrodroid",ent:"trade_republic"});
const tx=(day="2026-10-08",amount=10)=>({date:day,amount,merchant:"Movimiento",ent:"trade_republic",status:"BOOK"});
const cents=(c,s)=>s.expenses.filter(e=>c.expenseCountsBudget(e,s)).reduce((n,e)=>n+Math.round(e.amount*100),0);
function sync(c,s,ts){const add=c.importObExpenses(s,ts,[{aspsp:"Trade Republic",syncFrom:"2026-01-01"}])||[];return c.reconcileGemelosAutomaticos({...s,expenses:add.concat(s.expenses),gemelos:c.pushGemelos(s.gemelos,c.gemelosDeImportacion(add,s.expenses))},s);}
const wire=(c,e)=>({id:e.id,fecha:e.date,importe:e.amount,comercio:e.merchant,cat:e.category,source:c.expenseSourceForCloud(e),ob_name:e.obName});
function updater(c,source=html){const m=/setStateRaw\(prev=>\{([\s\S]*?)\}\); \},\[\]\);/.exec(source);assert.ok(m);return vm.runInContext("(function(prev,updater){"+m[1]+"})",c);}
function deleteAPI(c,s,set,source=html){const start=source.indexOf("  const delExpense=function(e){"),end=source.indexOf("  /* Posible repetido OB",start);assert.ok(start>0&&end>start);return vm.runInContext("(function(state,set,cloud){const keyOfE=keyOfExpense,undoTimerRef={current:null},undoDeleteRef={current:null};const setUndoDelete=function(){},setTimeout=function(){return 1;},clearTimeout=function(){};"+source.slice(start,end)+"return {del:delExpense,undo:undoLastDelete};})",c)(s,set,{enabled:()=>false});}
async function cloudSync(c,initial,remote,opts={},source=html){
 const start=source.indexOf("  const syncCloudExpenses=function(){"),end=source.indexOf("  // Al iniciar sesión:",start);assert.ok(start>0&&end>start);
 let live=initial;const trace=[],writes=[],timers=[],ref={current:live},session={current:{user:{id:"synthetic-owner"}}},update=updater(c,source);
 const cloud={pullState:async()=>{trace.push("state");if(opts.stateError)throw Error("synthetic state read failed");if(opts.changeOwner)session.current={user:{id:"other-synthetic-owner"}};return {data:clone(c.slimForCloud(remote))};},pullExpenses:async proof=>{trace.push("expenses");proof.valid=true;proof.userId="synthetic-owner";return (opts.expenseState||remote).expenses.map(e=>wire(c,e));},setExpenseDup:async(e,dup)=>{writes.push({id:e.id,dup});},setExpenseRecibo:async()=>{},setExpenseCat:async()=>0};
 const set=fn=>{live=update(live,fn);ref.current=live;};
 const factory=vm.runInContext("(function(stateRef,set,cloud,sessionRef,subirGasto,setTimeout,clearTimeout,natPlugin,mcSandbox){const wS={current:0},wR={current:false},wRead={current:null},wP={current:null},wC={current:[]};"+source.slice(start,end)+"return syncCloudExpenses;})",c);
 const run=factory(ref,set,cloud,session,()=>Promise.resolve(),fn=>{timers.push(fn);return timers.length;},()=>{},()=>null,()=>false);
 await run();timers.forEach(fn=>fn());return {state:live,trace,writes};
}
function deletion(c,source=html){
 let s=sync(c,state([notice()]),[tx()]);const update=updater(c,source),original=clone(s);
 const api=deleteAPI(c,s,fn=>{s=update(s,fn);},source);api.del(s.expenses.find(e=>e.id==="a"));assert.equal(cents(c,s),0);
 s=update(s,p=>({...p,expenses:p.expenses.concat([notice("b")])}));s=sync(c,s,[tx(),tx()]);
 assert.equal(cents(c,s),1000,"borrar una pareja no reclama el aviso del siguiente cargo real");
 assert.equal(s.expenses.filter(e=>e.autoGemelo).length,1);assert.equal(cents(c,sync(c,s,[tx(),tx()])),1000);
 for(const e of original.expenses)assert.ok(s.deleted.includes(c.keyOfExpense(e)));
}
test("NO-GO 1: lápida de la pareja borrada no roba el aviso del segundo pago",()=>deletion(context()));
test("NO-GO 2: una fila de nube sin #dup no inventa separación humana",()=>{
 const c=context(),s=sync(c,state([notice()]),[tx()]),b=s.expenses.find(e=>e.source==="ob");
 const incoming=c.expenseFromRow({...wire(c,b),source:"ob:trade_republic"});
 const refreshed=c.refreshExpenseFromCloud(b,incoming),n=c.reconcileGemelosAutomaticos({...s,expenses:s.expenses.map(e=>e.id===b.id?refreshed:e)},s);
 assert.equal(cents(c,n),1000);assert.equal(n.expenses.find(e=>e.id===b.id).gemeloSeparado,undefined);assert.equal(c.gemelosCambiosNube(n,[incoming])[0]?.dup,true);
});
test("NO-GO 3: sync REAL antes de pullState conserva volver a unir del otro móvil",async()=>{
 const c=context(),initial=sync(c,state([notice()]),[tx()]),split=c.separarGemeloAutomatico(initial,"a",1000),joined=c.unirGemeloAutomatico(split,"a",2000);
 const r=await cloudSync(c,split,joined);assert.equal(cents(c,r.state),1000);assert.deepEqual(r.trace,["state","expenses"]);assert.equal(r.writes.filter(w=>w.dup===false).length,0);
});
test("sync de pareja no mezcla ni repara si falla la decisión o cambia el titular",async()=>{
 const c=context(),s=sync(c,state([notice()]),[tx()]);
 await assert.rejects(cloudSync(c,s,s,{stateError:true}),/synthetic state read failed/);
 const r=await cloudSync(c,s,s,{changeOwner:true});assert.equal(r.state,s);assert.deepEqual(r.trace,["state"]);assert.equal(r.writes.length,0);
});
test("separar con fecha más reciente gana al volver a unir atrasado",async()=>{
 const c=context(),s=sync(c,state([notice()]),[tx()]),split=c.separarGemeloAutomatico(s,"a",1000),joined=c.unirGemeloAutomatico(split,"a",2000),newer=c.separarGemeloAutomatico(joined,"a",3000);
 const r=await cloudSync(c,newer,joined);assert.equal(cents(c,r.state),2000);assert.ok(r.state.gemelos.some(g=>g.separado&&g.at===3000));assert.equal(r.writes.filter(w=>w.dup===true).length,0);
});
test("volver a unir explícito gana aunque la tabla aún traiga la separación anterior",async()=>{
 const c=context(),s=sync(c,state([notice()]),[tx()]),split=c.separarGemeloAutomatico(s,"a",1000),joined=c.unirGemeloAutomatico(split,"a",2000);
 const r=await cloudSync(c,split,joined,{expenseState:split});assert.equal(cents(c,r.state),1000);assert.equal(r.writes.filter(w=>w.dup===false).length,0);assert.equal(r.writes.filter(w=>w.dup===true).length,1);
});
test("editar la fecha un día dentro de la ventana mantiene la pareja y los céntimos",()=>{
 const c=context(),s=sync(c,state([notice()]),[tx()]);
 const n=updater(c)(s,p=>({...p,expenses:p.expenses.map(e=>e.id==="a"?{...e,date:"2026-10-09T10:00:00Z"}:e)}));
 assert.equal(cents(c,n),1000);assert.ok(c.gemeloAutomaticoDe(n,n.expenses.find(e=>e.id==="a")));assert.equal(n.gemelos.filter(g=>g.separado).length,0);
});
function updaterCheck(c,source){const before=state(),b={id:"bank",date:"2026-10-08T12:00:00Z",amount:10,merchant:"Movimiento",source:"ob",ent:"trade_republic",possibleDup:true,possibleDupOf:"a"};const next=updater(c,source)(before,p=>({...p,expenses:[notice(),b]}));assert.equal(next.expenses.filter(e=>e.autoGemelo).length,1);assert.equal(cents(c,next),1000);}
function windowCheck(c){for(const offset of [2,3]){const day="2026-10-"+String(8+offset).padStart(2,"0"),b={...tx(day),date:day+"T12:00:00Z",id:"bank",source:"ob",possibleDup:true,gemeloNuevo:true},s=c.reconcileGemelosAutomaticos(state([notice(),b]));assert.equal(s.expenses.filter(e=>e.autoGemelo).length,0);assert.equal(s.expenses.filter(e=>e.possibleDup).length,1);assert.equal(cents(c,s),1000,"pregunta pendiente conserva provisionalmente el aviso");}}
test("las dos mutaciones supervivientes mueren en contratos funcionales",()=>{
 const mutations=[
  ["quitar reconcile del updater","if(next.expenses!==prev.expenses||next.gemelos!==prev.gemelos||next.deleted!==prev.deleted) next=reconcileGemelosAutomaticos(next,prev);","",updaterCheck],
  ["volver automáticas las parejas de dos o tres días","gemeloCompatible(pair[0],pair[1],1)","gemeloCompatible(pair[0],pair[1],3)",windowCheck]
 ];
 updaterCheck(context(),html);windowCheck(context());
 for(const [name,from,to,check] of mutations){assert.ok(html.includes(from),"preimagen "+name);const mutated=html.replace(from,to);assert.throws(()=>check(context(mutated),mutated),assert.AssertionError,"sobrevive "+name);}
 console.log("tr-nogo2: 2/2 mutaciones supervivientes muertas");
});

test("90 días y 12 semillas: verdad independiente y migración 126 al céntimo",()=>{
 const c=context(),old=context(execFileSync("git",["show","33d39cb80764aaf22998f69ac8bbaeffeadf4013:public/index.html"],{encoding:"utf8",maxBuffer:16e6})),table=[];
 const monthly=(ctx,s)=>{const out={};s.expenses.forEach(e=>{if(ctx.expenseCountsBudget(e,s)){const ym=e.date.slice(0,7);out[ym]=(out[ym]||0)+Math.round(e.amount*100);}});return out;};
 for(let seed=0;seed<12;seed++){
  let n=state(),legacy=state(),truth=0;const txs=[];
  for(let d=89;d>=0;d--){
   const day=new Date(NOW-d*86400000).toISOString().slice(0,10),value=1000+((seed*31+d*7)%137),amount=value/100,count=1+((seed+d)%3),ns=[];
   for(let i=0;i<count;i++){
    // El primer aviso de una cuarta parte llega antes de medianoche del día del banco.
    const a=notice("s"+seed+"d"+d+"n"+i,day,amount);if(i===0&&(seed+d)%4===0)a.date=new Date(Date.parse(day+"T00:00:00Z")-3*3600000).toISOString();ns.push(a);
   }
   const feed=Array.from({length:count},()=>tx(day,amount));txs.push(...feed);truth+=count*value;
   n=c.reconcileGemelosAutomaticos({...n,expenses:ns.concat(n.expenses)},n);n=sync(c,n,feed);assert.equal(cents(c,n),truth,seed+":"+d+":sync");
   // Otra vía independiente: cartera creada con el importador real de producción126.
   legacy={...legacy,expenses:ns.concat(legacy.expenses)};const add=old.importObExpenses(legacy,feed,[{aspsp:"Trade Republic",syncFrom:"2026-01-01"}])||[];
   legacy={...legacy,expenses:add.concat(legacy.expenses),gemelos:old.pushGemelos(legacy.gemelos,old.gemelosDeImportacion(add,legacy.expenses))};
   if(d%11===0){const remote=n.expenses.map(e=>c.expenseFromRow(wire(c,e)));n=c.reconcileGemelosAutomaticos({...n,expenses:c.mergeExpensesFromCloud(n.expenses,remote).list},n);assert.equal(cents(c,n),truth,seed+":"+d+":cloud");}
  }
  assert.equal(cents(old,legacy),truth,"126 verdad "+seed);
  const before=monthly(old,legacy);let migrated=c.reconcileGemelosAutomaticos(clone(legacy));const stages=[];
  for(let stage=0;stage<3;stage++){
   if(stage)migrated=sync(c,migrated,txs);
   assert.equal(cents(c,migrated),truth,"126 migración "+seed+":"+stage);
   assert.deepEqual(monthly(c,migrated),before,"126 cada mes "+seed+":"+stage);stages.push(monthly(c,migrated));
  }
  assert.equal(cents(c,n),truth);table.push({seed,truthCents:truth,candidateCents:cents(c,n),migration126:stages,deltaCents:0});
 }
 console.log(JSON.stringify({timezone:process.env.TZ||"host",simulation90:table}));
});
