import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {createLogicSandbox} from "../scripts/load-pure-logic.mjs";

const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const app=read("src/modules/11-app-main.js");
const c=createLogicSandbox();
// Fuente actual, sin generar public ni depender del bundle de una tanda anterior.
const files=fs.readdirSync(new URL("../src/modules/",import.meta.url)).filter(f=>/^0\d-/.test(f)).sort();
vm.runInNewContext(files.map(f=>read("src/modules/"+f)).join("\n"),c);
vm.runInContext(app.slice(0,app.indexOf("function App(){")),c);
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
  const s=state({fixed:[bill,{...bill,id:"paid",day:27,amount:50,paidYm:2026*12+9}],debts:[debt],expenses:[expense],bankTx:[{...expense,status:"BOOK"}]});
  assert.equal(balance(s).amount,10.46);
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
