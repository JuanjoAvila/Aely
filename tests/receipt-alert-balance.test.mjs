import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {createLogicSandbox} from "../scripts/load-pure-logic.mjs";

const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
let app=read("src/modules/11-app-main.js");
// Mutaciones deliberadas del código en memoria: los mismos casos deben rechazarlas.
const mutations=[
  ["floor","Math.round(n*100)","Math.floor(n*100)"],
  ["final","minWalk(start,due).min","minWalk(start,due).end"],
  ["charges-first","a.day-b.day||a.amt-b.amt","a.day-b.day"],
  ["receipt-bank","totals,e.account,d,e","totals,e.account||\"sabadell\",d,e"],
  ["debt-bank","totals,d.account,dayOf(d)","totals,d.account||\"sabadell\",dayOf(d)"],
  ["tomorrow-body",'receiptAlertBody(tf("rc_body_tmrw",{name:e.name||"?",x:eur(amt)}),state,totals,e.account,d,e)','tf("rc_body_tmrw",{name:e.name||"?",x:eur(amt)})'],
  ["debt-body",'receiptAlertBody(tf("rc_body_tmrw",{name:d.name||"?",x:eur(d.monthly)}),state,totals,d.account,dayOf(d))','tf("rc_body_tmrw",{name:d.name||"?",x:eur(d.monthly)})'],
  ["tomorrow-day","totals,e.account,d,e","totals,e.account,d+1,e"],
  ["flows-dep","state.deleted,state.flows,state.oneoffs,totals.bankBal","state.deleted,state.oneoffs,totals.bankBal"],
  ["oneoffs-dep","state.deleted,state.flows,state.oneoffs,totals.bankBal","state.deleted,state.flows,totals.bankBal"],
  ["balance-dep","state.deleted,state.flows,state.oneoffs,totals.bankBal","state.deleted,state.flows,state.oneoffs"],
  ["consensus","fixedPaymentState(state,e,y,m,today).paid!==isPaidIn(e,m,today,y)","false"],
  ["sandbox-reminder","mcSandbox()||state.onboarded","state.onboarded"],
  ["sandbox-calendar","if(mcSandbox()) return;","if(false) return;"],
];
const mutant=process.argv.indexOf("--mutant");
if(mutant>=0){
  const change=mutations.find(x=>x[0]===process.argv[mutant+1]);
  assert.ok(change&&app.includes(change[1]),"mutación aplicable");
  app=app.replace(change[1],change[2]);
}
const c=createLogicSandbox();
// Fuente actual, sin generar public ni depender del bundle de una tanda anterior.
const files=fs.readdirSync(new URL("../src/modules/",import.meta.url)).filter(f=>/^0\d-/.test(f)).sort();
vm.runInNewContext(files.map(f=>read("src/modules/"+f)).join("\n"),c);
vm.runInContext(app.slice(0,app.indexOf("function App(){")),c);
c.Date=class extends Date {
  constructor(...args){super(...(args.length?args:[Date.parse("2026-09-26T12:00:00Z")]));}
  static now(){return Date.parse("2026-09-26T12:00:00Z");}
};
const bill={id:"target",name:"Recibo sintético",amount:89.54,account:"sabadell",day:28,freq:"mes"};
const state=(patch={})=>Object.assign({accounts:[{id:"sb",ent:"sabadell",value:100,role:"fijos"},{id:"rv",ent:"revolut",value:9000,role:"fijos"}],fixed:[bill],debts:[],oneoffs:[],flows:[],expenses:[],bankTx:[],deleted:[],settings:{}},patch);
const totals=(patch={})=>Object.assign({curYear:2026,curMonth:9,today:26,bankBal:{sabadell:100,revolut:9000}},patch);
let count=0;
function test(name,fn){fn();count++;console.log("✓ "+name);}
function balance(s=state(),t=totals(),bank="sabadell",day=28){return c.receiptAlertBalance(s,t,bank,day);}

test("banco propio, céntimos y cero como saldo conocido",()=>{
  assert.equal(balance().amount,10.46);assert.equal(balance().enough,true);
  const b=balance(state(),totals({bankBal:{sabadell:0,revolut:9000}}));
  assert.equal(b.enough,false);assert.equal(b.amount,89.54);
});
test("cargo anticipado BOOK: Plan pagado conserva aviso sin frase",()=>{
  const target={...bill,name:"Iberdrola luz"};
  const s=state({fixed:[target],bankTx:[{id:"early",ent:"sabadell",date:"2026-09-25",amount:89.54,merchant:"IBERDROLA LUZ",status:"BOOK"}]});
  assert.equal(c.fixedPaymentState(s,target,2026,9,26).paid,true);
  assert.equal(balance(s,totals({bankBal:{sabadell:10.46}})),null);
  assert.equal(c.receiptAlertBody("Original",s,totals({bankBal:{sabadell:10.46}}),"sabadell",28,target),"Original");
});
test("ingreso el mismo día nunca tapa el mínimo negativo de Plan",()=>{
  const s=state({flows:[{id:"salary",kind:"income",amount:100,day:28,to:"sabadell"}]});
  const b=balance(s,totals({bankBal:{sabadell:20}}));
  assert.equal(b.enough,false);assert.equal(b.amount,69.54);
});
test("parte del saldo mostrado por la fórmula actual de cuentas",()=>{
  const s=state({expenses:[{id:"spend",date:"2026-09-26",amount:20,ent:"revolut",category:"super"}],settings:{expenseBanks:["revolut"]}});
  const ins=c.insumosSaldoGasto(s),bankBal={};
  s.accounts.forEach(a=>{bankBal[a.ent]=(bankBal[a.ent]||0)+c.saldoCuentaMostrada(a,{
    injTR:ins.injTR,spentByBank:ins.spentByBank,paidNetByBank:ins.paidNetByBank,
    roundup:ins.roundup,monthlyInvest:ins.monthlyInvest});});
  assert.equal(balance(s,totals({bankBal})).amount,10.46);
});
test("otro banco no paga el déficit ni sus cargos se descuentan",()=>{
  const s=state({fixed:[bill,{...bill,id:"other-bank",account:"revolut",amount:7000,day:27},{...bill,id:"prior",amount:20.47,day:27}]});
  const b=balance(s);assert.equal(b.enough,false);assert.equal(b.amount,10.01);
});
test("incluye cuota y puntual anteriores, excluye lo posterior",()=>{
  const s=state({debts:[{id:"loan",monthly:5.15,value:1000,account:"sabadell",day:27,asOf:2026*12+8}],oneoffs:[{id:"once",amount:8.32,account:"sabadell",day:27,month:9,year:2026},{id:"later",amount:900,account:"sabadell",day:29,month:9,year:2026}]});
  assert.equal(balance(s).amount,3.01);assert.equal(balance(s).enough,false);
});
test("ingreso anterior ayuda, nómina posterior no",()=>{
  for(const [day,want] of [[27,true],[29,false]]){
    const s=state({flows:[{id:"salary",kind:"income",amount:100,day,to:"sabadell"}]});
    assert.equal(balance(s,totals({bankBal:{sabadell:20}})).enough,want);
  }
});
test("todos los cargos del mismo día y centésimas exactas",()=>{
  const fixed=[{...bill,amount:0.1},...Array.from({length:9},(_,i)=>({...bill,id:"small"+i,amount:0.1}))];
  const s=state({fixed});assert.equal(balance(s,totals({bankBal:{sabadell:1}})).amount,0);
  assert.equal(balance(s,totals({bankBal:{sabadell:1}})).enough,true);
});
test("importe programado del mes usa el motor existente",()=>{
  const s=state({fixed:[{...bill,amount:1,freq:"anual",schedule:[{m:9,amt:120.12,day:28}]}]});
  assert.equal(balance(s).amount,20.12);
});
test("pagado y BOOK vinculados no descuentan por segunda vez",()=>{
  const debt={id:"loan",monthly:60,value:1000,account:"sabadell",day:27,asOf:2026*12+8};
  const expense={id:"book",amount:60,ent:"sabadell",date:"2026-09-26",debtId:"loan",category:"deudas",source:"ob",merchant:"Cuota sintética"};
  const s=state({fixed:[bill,{...bill,id:"paid",day:27,amount:50,paidYm:2026*12+9,paidDay:26}],debts:[debt],expenses:[expense],bankTx:[{...expense,status:"BOOK"}]});
  assert.equal(balance(s).amount,10.46);
});
test("atrasado pendiente en Plan impide frase aunque el motor lo dé por pagado",()=>{
  const late={...bill,id:"late",day:25,amount:50};
  const s=state({fixed:[bill,late]});
  assert.equal(c.fixedPaymentState(s,late,2026,9,26).paid,false);
  assert.equal(vm.runInContext("isPaidIn",c)(late,9,26,2026),true);
  assert.equal(balance(s),null);
});
test("el mínimo anterior a la nómina prevalece sobre el final recuperado",()=>{
  const s=state({fixed:[bill,{...bill,id:"prior",day:27,amount:30}],flows:[{id:"salary",kind:"income",amount:200,day:27,to:"sabadell"}]});
  const b=balance(s,totals({bankBal:{sabadell:20}}));
  assert.equal(b.enough,false);assert.equal(b.amount,10);
});
test("centésima binaria se redondea, no se trunca",()=>{
  const b=balance(state({fixed:[{...bill,amount:0.1}]}),totals({bankBal:{sabadell:0.29}}));
  assert.equal(b.amount,0.19);
});
test("transferencia sale antes del ingreso aunque el array los traiga al revés",()=>{
  const s=state({fixed:[{...bill,amount:10}],flows:[{id:"salary",kind:"income",amount:100,day:27,to:"sabadell"},{id:"transfer",kind:"transfer",amount:50,day:27,from:"sabadell",to:"revolut"}]});
  const b=balance(s,totals({bankBal:{sabadell:20}}));
  assert.equal(b.enough,false);assert.equal(b.amount,30);
});
test("datos ausentes o inválidos dejan intacto el aviso",()=>{
  for(const [s,t,bank,day] of [
    [state(),totals(),null,28],[state(),totals(),"inexistente",28],
    [state(),totals(),"sabadell",null],[state(),totals(),"sabadell",31],
    [state(),totals({bankBal:{}}),"sabadell",28],
    [state(),totals({bankBal:{sabadell:null}}),"sabadell",28],
    [state({accounts:[{ent:"sabadell",value:null}]}),totals(),"sabadell",28],
    [state({accounts:[{ent:"sabadell"}]}),totals(),"sabadell",28],
    [state({fixed:[bill,{...bill,id:"unknown-day",day:null}]}),totals(),"sabadell",28],
    [state(),totals({curMonth:null}),"sabadell",28],
    [state(),totals({curYear:999999}),"sabadell",28],
    [state(),totals({curYear:-1}),"sabadell",28],
    [state(),totals({bankBal:{sabadell:Infinity}}),"sabadell",28],
    [state(),totals({bankBal:{sabadell:Number.MAX_VALUE}}),"sabadell",28],
  ]){assert.equal(balance(s,t,bank,day),null);assert.equal(c.receiptAlertBody("Original",s,t,bank,day),"Original");}
});
test("sin mutaciones y salida en los tres idiomas y moneda elegida",()=>{
  const s=state(),before=JSON.stringify(s);
  for(const [lang,ok,short] of [["es","alcanza","faltarían"],["en","enough","short"],["ca","prou","faltarien"]]){
    vm.runInContext('CURLANG="'+lang+'"; DISP={sym:"$",k:2};',c);
    const yes=c.receiptAlertBody("Original",s,totals(),"sabadell",28);
    assert.ok(yes.includes(ok),yes);assert.ok(yes.includes("20,92 $"),yes);
    const no=c.receiptAlertBody("Original",s,totals({bankBal:{sabadell:10}}),"sabadell",28);
    assert.ok(no.includes(short),no);assert.ok(no.includes("159,08 $"),no);
    assert.doesNotMatch(no,/\{(?:bank|x)\}/);
  }
  assert.equal(JSON.stringify(s),before);
  vm.runInContext('CURLANG="es"; DISP={sym:"€",k:1};',c);
});

const marker=app.indexOf("// Recordatorio de recibos:");
const start=app.indexOf("  useEffect(function(){",marker);
const end=app.indexOf("\n  // Empuja el calendario",start);
const effect=app.slice(start,end).replace("useEffect(function(){","(function(){").replace(/\},\[[^\]]*\]\);\s*$/,"})();");
const calendarEnd=app.indexOf("\n  // Avisos de presupuesto",end);
const calendarEffect=app.slice(app.indexOf("  useEffect(function(){",end),calendarEnd).replace("useEffect(","testEffect(");
function runNotice(s,t=totals(),sandbox=false){
  const sent=[],flags=new Map();
  Object.assign(c,{state:s,totals:t,locked:false,showAuth:false,mcSandbox:()=>sandbox,
    alertCalendarOf:()=>({ym:"2026-09",charges:[],fired:[]}),useEffect:fn=>fn(),
    localStorage:{getItem:k=>flags.get(k),setItem:(k,v)=>flags.set(k,v)},
    natPlugin:()=>({showNotification:msg=>{sent.push(msg);return Promise.resolve();}})});
  vm.runInContext(effect,c);
  return {sent,flags};
}
test("víspera real usa su día exacto y el banco explícito",()=>{
  const tomorrow={...bill,day:27},later={...bill,id:"later",day:28,amount:50};
  const {sent}=runNotice(state({fixed:[tomorrow,later]}));
  assert.equal(sent.length,1);assert.match(sent[0].body,/quedarían 10,46 €/);
  const missing=runNotice(state({fixed:[{...tomorrow,account:undefined}]})).sent;
  assert.equal(missing.length,1);assert.equal(missing[0].body,c.tf("rc_body_tmrw",{name:bill.name,x:"89,54 €"}));
});
test("cuota real añade previsión; sin banco conserva sólo el original",()=>{
  const debt={id:"loan",name:"Cuota sintética",monthly:60.29,value:1000,account:"sabadell",day:27,asOf:2026*12+8};
  const sent=runNotice(state({fixed:[],debts:[debt]})).sent;
  assert.equal(sent.length,1);assert.match(sent[0].body,/quedarían 39,71 €/);
  const missing=runNotice(state({fixed:[],debts:[{...debt,account:undefined}]})).sent;
  assert.equal(missing.length,1);assert.equal(missing[0].body,c.tf("rc_body_tmrw",{name:debt.name,x:"60,29 €"}));
});
test("las entradas financieras nuevas invalidan el efecto React",()=>{
  const capture=()=>{let deps;c.testEffect=(fn,values)=>{deps=values;};vm.runInContext(app.slice(start,end).replace("useEffect(","testEffect("),c);return deps;};
  runNotice(state());const initial=capture(),initialState=c.state;
  for(const field of ["flows","oneoffs"]){
    c.state={...c.state,[field]:[{}]};const next=capture();
    assert.ok(next.some((x,i)=>!Object.is(x,initial[i])),field);
    c.state=initialState;
  }
  c.totals={...c.totals,bankBal:{sabadell:2}};
  assert.ok(capture().some((x,i)=>!Object.is(x,initial[i])),"bankBal");
});
test("modo pruebas no notifica ni comparte calendario ficticio",()=>{
  const {sent,flags}=runNotice(state(),totals(),true);assert.equal(sent.length,0);assert.equal(flags.size,0);
  let calendars=0;c.testEffect=fn=>fn();
  c.natPlugin=()=>({setAlertData:()=>{calendars++;return Promise.resolve({});}});
  vm.runInContext(calendarEffect,c);assert.equal(calendars,0);c.mcSandbox=()=>false;
});
test("sello consultado antes de cualquier cálculo financiero",()=>{
  const {sent}=runNotice(state());assert.equal(sent.length,1);
  const original=c.receiptAlertBalance;
  // Contar llamadas detecta el trabajo aunque el efecto oculte una excepción.
  let calculations=0;c.receiptAlertBalance=()=>{calculations++;return null;};
  vm.runInContext(effect,c);assert.equal(calculations,0);assert.equal(sent.length,1);c.receiptAlertBalance=original;
});
test("efecto real mantiene víspera, aviso grande y dedupe, incluida cuota BOOK",()=>{
  const s=state({fixed:[bill],debts:[{id:"loan",name:"Cuota",monthly:60,value:1000,account:"sabadell",day:27,asOf:2026*12+8}]});
  const expense={id:"book",amount:60,ent:"sabadell",date:"2026-09-26",debtId:"loan",category:"deudas",source:"ob",merchant:"Cuota sintética"};
  s.expenses=[expense];s.bankTx=[{...expense,status:"BOOK"}];
  const sent=[],flags=new Map();
  Object.assign(c,{state:s,totals:totals({fijosMensual:100}),locked:false,showAuth:false,
    alertCalendarOf:()=>({ym:"2026-09",charges:[],fired:[]}),useEffect:fn=>fn(),
    localStorage:{getItem:k=>flags.get(k),setItem:(k,v)=>flags.set(k,v)},
    natPlugin:()=>({showNotification:msg=>{sent.push(msg);return Promise.resolve();}})});
  vm.runInContext(effect,c);vm.runInContext(effect,c);
  assert.equal(sent.length,1);assert.ok(sent[0].body.includes("89,54 €"));assert.ok(sent[0].body.includes("10,46 €"));
  assert.ok(flags.has("_rc_target_2026-09_28"));assert.ok(!flags.has("_rc1_debt_loan_2026-09"));
  c.totals.today=27;vm.runInContext(effect,c);vm.runInContext(effect,c);
  assert.equal(sent.length,2);assert.ok(flags.has("_rc1_target_2026-09"));
  c.totals.today=24;vm.runInContext(effect,c);assert.equal(sent.length,2);
});
{
  const sent=[],flags=new Map();
  Object.assign(c,{state:state({fixed:[{...bill,day:27}]}),totals:totals(),
    localStorage:{getItem:k=>flags.get(k),setItem:(k,v)=>flags.set(k,v)},
    natPlugin:()=>({setAlertData:async()=>({fired:["target"]}),showNotification:async msg=>sent.push(msg)})});
  vm.runInContext(effect,c);
  await Promise.resolve();await Promise.resolve();
  assert.equal(sent.length,0);assert.equal(flags.get("_rc1_target_2026-09"),"1");
  count++;console.log("✓ el sello nativo se aplica antes del recordatorio web");
}
console.log("receipt-alert-balance: "+count+" PASS");
if(process.argv.includes("--mutations")){
  for(const [name] of mutations){
    assert.ok(app.includes(mutations.find(x=>x[0]===name)[1]),name+" tiene un punto de mutación real");
    const result=spawnSync(process.execPath,[fileURLToPath(import.meta.url),"--mutant",name],{encoding:"utf8"});
    assert.equal(result.status,1,name+" debe fallar por una aserción");
    assert.match(result.stderr,/AssertionError/,name+": "+result.stderr);
    console.log("✓ mutación rechazada: "+name);
  }
  console.log("receipt-alert-balance: "+mutations.length+" mutaciones rechazadas");
}
