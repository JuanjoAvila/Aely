import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadPureLogic } from "../scripts/load-pure-logic.mjs";
import { codeMask } from "../scripts/beta-source-code.mjs";

// Fuente real sin build ni pull: un bundle anterior ocultaría el hueco entre enlace y sync.
const source=file=>fs.readFileSync(new URL("../"+file,import.meta.url),"utf8");
const order=JSON.parse(source("src/build-order.json"));
const c=loadPureLogic(source("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>order.map(f=>source("src/modules/"+f)).join("\n")));
c.Date=class extends Date { constructor(...args){super(...(args.length?args:["2026-10-18T12:00:00+02:00"]));} };
const y=2026,m=10,today=18,ym=y*12+m,cents=n=>Math.round(n*100)||0,copy=x=>JSON.parse(JSON.stringify(x));
const paid=(s,month=m,year=y)=>vm.runInNewContext("isPaidIn",c)(s.fixed[0],month,today,year,s);
const fixture=(origin="ob-hist")=>({
  accounts:[{id:"bank",ent:"sabadell",role:"fijos",value:842.60}],
  fixed:[{id:"receipt",name:"Recibo sintético",amount:42.37,freq:"mes",day:28,account:"sabadell",wait:ym}],
  expenses:[{id:"charge",merchant:"Cargo de otro nombre",date:"2026-10-12",amount:42.37,ent:"sabadell",category:"recibos",source:origin}],
  bankTx:[],debts:[],oneoffs:[],flows:[],deleted:[],investments:[],assets:[],aportaciones:[],obAccounts:[],settings:{}
});
const link=s=>c.linkFixedPayment(s,"charge","receipt",y,m,today);
const selected=process.argv.find(a=>a.startsWith("--case="))?.slice(7);
let count=0;
function check(name,fn){if(selected&&!name.includes(selected))return;fn();count++;console.log("PASS "+name);}
function money(s){
  const net=c.monthNetForAccount(s,"sabadell",y,m,today);
  const events=c.bankPendingEvents(s,"sabadell",y,m,today);
  const shown=c.saldoCuentaMostrada(s.accounts[0],{paidNetByBank:{sabadell:net}});
  return {net:cents(net),pending:cents(-events.reduce((n,e)=>n+e.amt,0)),shown:cents(shown),end:cents(c.minWalk(shown,events).end)};
}
check("causal: deshacer y rehacer sin pull ni planSyncDerived",()=>{
  const base=fixture(),initial=link(base);
  // Estado guardado por un pull anterior: la marca derivada se retira con su prueba.
  initial.fixed[0]={...initial.fixed[0],paidYm:ym,paidDay:12};
  const undone=c.linkFixedPayment(initial,"charge",null,y,m,today);
  assert.equal(undone.fixed[0].paidYm,undefined);
  const redone=link(undone),before=JSON.stringify(redone);
  assert.ok(c.fixedPaymentProof(redone,redone.fixed[0],y,m,today));
  assert.equal(redone.fixed[0].paidYm,undefined,"el vínculo no escribe calendario");
  assert.equal(paid(redone),true,"el vínculo bancario vigente debe contar antes del siguiente pull");
  assert.deepEqual(money(redone),{net:-4237,pending:0,shown:80023,end:80023});
  assert.deepEqual(money(undone),{net:0,pending:4237,shown:84260,end:80023});
  assert.equal(redone.accounts,base.accounts);assert.equal(redone.expenses,base.expenses);
  assert.equal(JSON.stringify(redone),before,"leer pago/saldo no persiste marcas");
});
for(const origin of ["ob","ob-hist"])check("bancario vigente "+origin,()=>{
  const s=link(fixture(origin));assert(paid(s));assert.deepEqual(money(s),{net:-4237,pending:0,shown:80023,end:80023});
  const twice=link(s);assert.equal(twice,s,"no duplica el cargo");
  assert.equal(cents(c.monthNetForAccount(s,"sabadell",y,m,null)),-4237,"mes completo descuenta una sola vez");
});
for(const origin of ["wallet","macrodroid","tr","manual:sabadell"])check("prueba visual sin calendario "+origin,()=>{
  const s=link(fixture(origin));assert(c.fixedPaymentProof(s,s.fixed[0],y,m,today));assert.equal(paid(s),false);
  assert.deepEqual(money(s),{net:0,pending:4237,shown:84260,end:80023});
});
check("expense viajada sin fila local conserva frontera financiera",()=>{
  const s=c.slimForCloud(link(fixture()));assert(c.fixedPaymentProof(s,s.fixed[0],y,m,today));assert.equal(paid(s),false);
});
for(const [name,change] of [
  ["veto",s=>{s.reciboNo=["receipt|"+s.fixed[0].paymentProofs[ym].identity];}],
  ["lápida",s=>{s.deleted=[c.keyOfExpense(s.expenses[0])];}],
  ["retirada",s=>{s.expenses[0].category="traspaso";}],
  ["PDNG",s=>{s.expenses[0].status="PDNG";}],
  ["duplicado",s=>{s.expenses[0].possibleDup=true;}],
  ["otro importe",s=>{s.fixed[0].amount=43.37;}],
  ["otra cuenta",s=>{s.fixed[0].account="revolut";}],
  ["otra identidad",s=>{s.fixed[0].paymentProofs[ym].receiptId="other";}],
  ["id repetido",s=>{s.fixed.push({...s.fixed[0]});}],
  ["cargo cambiado",s=>{s.expenses[0].merchant="Cargo sustituido";}],
  ["prueba futura",s=>{s.fixed[0].paymentProofs[ym].date="2026-10-20";}],
  ["otro mes",s=>{const p=s.fixed[0].paymentProofs[ym];s.fixed[0].paymentProofs={[ym-1]:p};}]
])check("prueba inválida: "+name,()=>{
  const s=copy(link(fixture()));change(s);const before=JSON.stringify(s);assert.equal(paid(s),false);assert.equal(JSON.stringify(s),before);
});
check("mes y año no heredan el pago",()=>{
  const s=link(fixture());assert.equal(paid(s,9),false);assert.equal(paid(s,m,2025),false);
});
check("marca manual independiente y calendario sin prueba",()=>{
  const s=fixture();s.fixed[0].paidYm=ym;s.fixed[0].paidDay=9;assert(paid(s));
  const linked=link(s),undone=c.linkFixedPayment(linked,"charge",null,y,m,today);
  assert.equal(undone.fixed[0].paidYm,ym);assert.equal(undone.fixed[0].paidDay,9);assert(paid(undone));
  assert.equal(vm.runInNewContext("isPaidIn",c)(s.fixed[0],m,today,y),true,"compatibilidad sin estado");
  const calendar=fixture();delete calendar.fixed[0].wait;calendar.fixed[0].day=10;assert(paid(calendar));
  calendar.fixed[0].wait=ym;assert.equal(paid(calendar),false);
});
check("BOOK conserva calendario y marca persistida anteriores",()=>{
  const s=fixture(),f=s.fixed[0],p={kind:"book",key:"sabadell|book",identity:c.fixedPaymentIdentity("sabadell",{date:"2026-10-12",amount:42.37,merchant:f.name}),date:"2026-10-12",bank:"sabadell",merchant:f.name,amount:42.37};
  f.paymentProofs={[ym]:c.fixedPaymentBind(p,f,m)};s.expenses=[];assert(c.fixedPaymentProof(s,f,y,m,today));assert.equal(paid(s),false);
  assert.deepEqual(money(s),{net:0,pending:4237,shown:84260,end:80023});
  f.paidYm=ym;f.paidDay=12;assert(paid(s));assert.deepEqual(money(s),{net:-4237,pending:0,shown:80023,end:80023});
});
check("regresión: alquiler BOOK de750 sin día el2 de noviembre",()=>{
  const clock=c.Date;c.Date=class extends Date { constructor(...a){super(...(a.length?a:["2026-11-02T12:00:00+01:00"]));} };
  try{
    const s=fixture(),f={id:"rent",name:"Alquiler piso",amount:750,freq:"mes",day:null,account:"ing"};
    const tx={id:"rent-book",ent:"ing",date:"2026-11-02",amount:750,merchant:"TRANSF ALQUILER PISO",status:"BOOK"};
    s.fixed=[f];s.accounts=[{id:"ing",ent:"ing",role:"fijos",value:2023.63}];s.expenses=[];s.bankTx=[tx];
    f.paymentProofs={[2026*12+11]:c.fixedPaymentBind({kind:"book",key:"ing|rent-book",identity:c.fixedPaymentIdentity("ing",tx),date:tx.date,bank:"ing",merchant:tx.merchant,amount:750},f,11)};
    assert(c.fixedPaymentProof(s,f,2026,11,2));assert.equal(vm.runInNewContext("isPaidIn",c)(f,11,2,2026,s),false);
    assert.equal(c.monthNetForAccount(s,"ing",2026,11,2),0);assert.equal(cents(s.accounts[0].value),202363);
    const events=c.bankPendingEvents(s,"ing",2026,11,2);assert.equal(events.length,1);assert.equal(cents(events[0].amt),-75000);
    assert.equal(cents(c.minWalk(s.accounts[0].value,events).end),127363);
  }finally{c.Date=clock;}
});
const main=source("src/modules/11-app-main.js").replaceAll("\r\n","\n"),totalsStart=main.indexOf("const totals=useMemo(()=>{"),totalsEnd=main.indexOf("\n\n  const budgetMonth=",totalsStart);
assert(totalsStart>=0&&totalsEnd>totalsStart,"callback real de totals");
const totals=vm.runInNewContext("(function(state,calendarDay){"+main.slice(totalsStart,totalsEnd)+";return totals;})",c);
check("totals real: saldo, pendientes y mínimo sin doble descuento",()=>{
  const s=link(fixture()),before=JSON.stringify(s),p=totals(s,"2026-10-18");
  assert.deepEqual([p.liquid,p.mainBal,p.mainProjected,p.mainMin].map(cents),[80023,80023,80023,80023]);
  assert.equal(cents(p.pendingThisMonth),0);assert.equal(cents(p.mainPending),0);assert.equal(cents(p.paidThisMonth),4237);
  assert.equal(JSON.stringify(s),before);
});
const reminderStart=main.indexOf("useEffect(function(){",main.indexOf("// Recordatorio de recibos:")),mask=codeMask(main);
let open=mask.indexOf("{",reminderStart),end=open+1,depth=1;
for(;depth&&end<mask.length;end++){if(mask[end]==="{")depth++;else if(mask[end]==="}")depth--;}
assert.equal(depth,0);assert(reminderStart>=0);
const reminders=vm.runInNewContext("(function(state,locked,showAuth,totals,alertCalendarOf,natPlugin,localStorage){return "+main.slice(reminderStart+"useEffect(".length,end)+";})",c);
check("recordatorio real observa prueba y veto actuales",()=>{
  for(const veto of [false,true]){
    const s=link(fixture());s.fixed[0].day=19;
    if(veto)s.reciboNo=["receipt|"+s.fixed[0].paymentProofs[ym].identity];
    const sent=[];
    reminders(s,false,false,{today,curMonth:m,curYear:y,fijosMensual:42.37},()=>({ym,charges:[]}),()=>({showNotification:n=>{sent.push(n);return Promise.resolve();}}),{getItem:()=>null,setItem:()=>{}})();
    assert.equal(sent.length,veto?1:0,"el veto vuelve a habilitar la víspera");
  }
});
assert(count>0,"selección vacía");console.log("fixed-ispaidin: "+count+" comprobaciones");
