// Ronda 237, dos fallos de dinero de Plan › Recibos. Datos inventados; reloj del 16/11/2026.
// 1) «Luz · No ha llegado» con el cargo ya en el banco: Sabadell manda «IBERDROLA CLIENTES SAU»
//    sin «recibo» ni «SEPA», y por importe sin nombre se exigía esa palabra. Ahora el comercio de la
//    categoría del recibo vale como la palabra; el resto de vallas (céntimo, día ±4, banco, ni
//    tarjeta ni transferencia ni devolución, empates) siguen.
// 2) Recibo pagado restado dos veces en «¿Te llega?» en una cuenta de recibos a mano: el saldo
//    mostrado ya lo restaba por calendario (`paidNet`) y el recorrido lo volvía a restar en
//    «Pagado, aún sin restar del saldo». Una sola regla: `fixedRestaDelSaldo`.
// Se siembran DOS bancos de recibos (uno leído por Open Banking y otro a mano) y uno de gasto diario.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import { loadPureLogic } from "../scripts/load-pure-logic.mjs";

const read=f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8");
const order=JSON.parse(read("src/build-order.json"));
const c=loadPureLogic(read("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>order.map(f=>read("src/modules/"+f)).join("\n")));
vm.runInNewContext(read("src/modules/14-v4-screens.js"),c);
const AHORA=new Date("2026-11-16T12:00:00+01:00").getTime();
c.Date=class extends Date { constructor(...a){ super(...(a.length?a:[AHORA])); } static now(){ return AHORA; } };
const Y=2026,M=11,HOY=16;
const main=read("src/modules/11-app-main.js").replaceAll("\r\n","\n"),ini=main.indexOf("const totals=useMemo(()=>{"),fin=main.indexOf("\n\n  const budgetMonth=",ini);
assert(ini>=0&&fin>ini,"callback real de totals");
const totalsDe=vm.runInNewContext("(function(state,calendarDay){"+main.slice(ini,fin)+";return totals;})",c);
const cents=n=>Math.round(n*100);
const json=x=>JSON.parse(JSON.stringify(x));

// Sabadell: cuenta de recibos re-anclada por Open Banking (lectura del 2/11, antes de la luz).
// CaixaBank: cuenta de recibos a mano, sin lectura. Revolut: gasto diario.
const cuentas=()=>[
  {id:"sb",ent:"sabadell",name:"Cuenta Sintética",role:"fijos",value:900,bankUid:"sab-1"},
  {id:"cxa",ent:"caixabank",name:"Cuenta Nómina",role:"fijos",value:1520},
  {id:"rv",ent:"revolut",name:"Diaria",role:"diario",value:300,spendFrom:true}];
const luz={id:"luz",name:"Luz",amount:54.26,day:8,account:"sabadell",category:"luz",freq:"mes"};
const agua={id:"agua",name:"Agua",amount:30,day:25,account:"sabadell",freq:"mes"};
const alquiler={id:"alq",name:"Alquiler",amount:650,day:1,account:"caixabank",freq:"mes"};
const seguro={id:"seg",name:"Seguro hogar",amount:64.90,day:28,account:"caixabank",freq:"mes"};
const prestamo={id:"d1",name:"Préstamo coche",monthly:189,day:5,account:"caixabank",value:5000,asOf:2026*12+10};
const cargo=p=>Object.assign({id:"t-luz",ent:"sabadell",date:"2026-11-08",amount:54.26,merchant:"IBERDROLA CLIENTES SAU",concept:"IBERDROLA CLIENTES SAU",status:"BOOK"},p);
const filaAlquiler={id:"g-alq",ent:"caixabank",date:"2026-11-01",amount:650,merchant:"ALQUILER PISO",category:"vivienda",source:"ob",status:"BOOK"};
const estado=p=>Object.assign({accounts:cuentas(),fixed:[luz,agua,alquiler,seguro],debts:[prestamo],bankTx:[cargo()],expenses:[filaAlquiler],
  oneoffs:[],flows:[],goals:[],deleted:[],investments:[],assets:[],aportaciones:[],obAccounts:[],settings:{},obBalAt:{"Banco Sabadell":"2026-11-02T08:00:00Z"}},p);
const pagado=(s,f)=>c.fixedPaymentState(s,f||luz,Y,M,HOY);
const bancos=s=>{
  const T=totalsDe(s,"2026-11-16"),pack=c.planChargesMonth(s,M,Y,HOY);
  const out={};c.planRecibosBancos(T,pack,null).forEach(b=>{ out[b.bank]={bal:cents(b.bal),pend:cents(b.pend),sinRestar:cents(b.sinRestar),min:cents(b.min)}; });
  return {out,T,llega:json(c.planRecibosLlega(T,pack))};
};

// ---------- 1. La luz sin «RECIBO» ----------

test("1 · cargo de Iberdrola sin «recibo», al céntimo y el mismo día: la luz está pagada",()=>{
  const r=pagado(estado());
  assert.equal(r.paid,true);assert.equal(r.day,8);assert.equal(r.paidAmount,54.26);assert.equal(r.paidBank,"sabadell");
  const pack=c.planChargesMonth(estado(),M,Y,HOY);
  assert.ok(pack.paidBills.some(x=>x.id==="fixed_luz"),"en «Ya pagados»");
  assert.ok(!pack.pendingBills.some(x=>x.id==="fixed_luz"),"no en Pendiente");
  const v=c.planRecibosVista(pack,c.paymentEvidenceUI(estado(),Y,M,HOY),HOY,c.planRecibosAvisos(estado(),pack,c.paymentEvidenceUI(estado(),Y,M,HOY),Y,M,HOY),{});
  assert.ok(!v.review.some(x=>x.id==="fixed_luz"),"ni «No ha llegado» en «Para revisar»");
});

test("1 · «¿Te llega?» ya no cuenta la luz dos veces (el mínimo ya no sale 54,26 € más bajo)",()=>{
  const {out}=bancos(estado());
  // 900 − 54,26 de la luz (el saldo mostrado la resta por calendario); queda el agua de 30.
  assert.deepEqual(out.sabadell,{bal:84574,pend:3000,sinRestar:0,min:81574});
  const evs=c.bankPendingEvents(estado(),"sabadell",Y,M,HOY);
  assert.deepEqual(json(evs),[{bank:"sabadell",day:25,amt:-30}]);
});

test("1 · ventana del día: hasta cuatro días, y no más; ni el mes de al lado",()=>{
  assert.equal(pagado(estado({bankTx:[cargo({date:"2026-11-12"})]})).paid,true);
  assert.equal(pagado(estado({bankTx:[cargo({date:"2026-11-04"})]})).paid,true);
  assert.equal(pagado(estado({bankTx:[cargo({date:"2026-11-13"})]})).paid,false,"cinco días después");
  assert.equal(pagado(estado({bankTx:[cargo({date:"2026-10-08"})]})).paid,false,"el del mes pasado");
});

test("1 · sin el nombre se exige el céntimo: 54,71 no la paga, se pregunta en «Para revisar»",()=>{
  const s=estado({bankTx:[cargo({amount:54.71})],expenses:[filaAlquiler,{id:"g-luz",extId:"t-luz",ent:"sabadell",date:"2026-11-08T12:00:00.000Z",amount:54.71,merchant:"IBERDROLA CLIENTES SAU",obName:"IBERDROLA CLIENTES SAU",source:"ob",status:"BOOK",category:"luz"}]});
  assert.equal(pagado(s).paid,false);
  assert.equal(c.fixedPaymentCobroDistinto(s,luz,Y,M,HOY).id,"g-luz","se pregunta, no «No ha llegado»");
});

test("1 · no casa de más: dos recibos del mismo comercio e importe → ninguno; con importes distintos, cada uno el suyo",()=>{
  const luz2=Object.assign({},luz,{id:"luz2",name:"Luz garaje",day:10});
  const empate=estado({fixed:[luz,luz2,agua]});
  assert.equal(pagado(empate,luz).paid,false);assert.equal(pagado(empate,luz2).paid,false);
  const garaje=Object.assign({},luz2,{amount:20.10});
  const dos=estado({fixed:[luz,garaje,agua],bankTx:[cargo(),cargo({id:"t-gar",date:"2026-11-10",amount:20.10})]});
  assert.equal(pagado(dos,luz).paid,true);assert.equal(pagado(dos,garaje).paid,true);
  assert.equal(pagado(dos,garaje).paidAmount,20.10);
});

test("1 · no casa de más: otro concepto del mismo comercio, otra categoría u otro banco",()=>{
  assert.equal(pagado(estado({bankTx:[cargo({amount:120})]})).paid,false,"otro cargo de Iberdrola (otro importe)");
  const gas=Object.assign({},luz,{id:"gas",name:"Gas",category:"gas"});
  assert.equal(pagado(estado({fixed:[gas,agua]}),gas).paid,false,"un comercio de luz no paga el gas");
  const sinCat=Object.assign({},luz,{category:undefined});
  assert.equal(pagado(estado({fixed:[sinCat,agua]}),sinCat).paid,false,"sin categoría en el recibo no hay comercio que comparar");
  assert.equal(pagado(estado({bankTx:[cargo({ent:"revolut"})]})).paid,false,"otro banco");
  assert.equal(pagado(estado({bankTx:[cargo({ent:"caixabank"})]})).paid,false,"otro banco de recibos");
});

test("1 · no casa de más: devolución, tarjeta, transferencia, bizum o pendiente",()=>{
  assert.equal(pagado(estado({bankTx:[cargo(),cargo({id:"t-dev",date:"2026-11-12",amount:-54.26})]})).paid,false,"recibo devuelto");
  assert.equal(pagado(estado({bankTx:[cargo({card:true})]})).paid,false,"compra con tarjeta");
  assert.equal(pagado(estado({bankTx:[cargo({concept:"TRANSFERENCIA IBERDROLA"})]})).paid,false,"transferencia");
  assert.equal(pagado(estado({bankTx:[cargo({concept:"BIZUM IBERDROLA"})]})).paid,false,"bizum");
  assert.equal(pagado(estado({bankTx:[cargo({status:"PDNG"})]})).paid,false,"pendiente en el banco");
  // Y una cuota del mismo importe en el mismo banco lo reclama: empate, de nadie.
  assert.equal(pagado(estado({debts:[prestamo,{id:"d2",name:"Préstamo sintético",monthly:54.26,day:9,account:"sabadell",value:900,asOf:2026*12+10}]})).paid,false);
});

// ---------- 2. Pagado restado dos veces en una cuenta a mano ----------

test("2 · CaixaBank a mano sin lectura: alquiler pagado ya restado → lo más justo 616,10 €, sin «aún sin restar»",()=>{
  const s=estado(),{out,llega}=bancos(s);
  assert.equal(pagado(s,alquiler).paid,true);
  // 1.520 − 650 (alquiler) − 189 (préstamo) = 681; queda el seguro de 64,90.
  assert.deepEqual(out.caixabank,{bal:68100,pend:6490,sinRestar:0,min:61610});
  assert.deepEqual(llega,{ok:true});
  assert.deepEqual(json(c.bankPendingEvents(s,"caixabank",Y,M,HOY)),[{bank:"caixabank",day:28,amt:-64.9}]);
});

test("2 · la misma regla en el saldo, en lo pendiente de totals y en el recorrido",()=>{
  const s=estado(),T=totalsDe(s,"2026-11-16");
  for(const e of s.fixed){
    const b=e.account,solo=Object.assign({},s,{fixed:[e],debts:[]});
    const restaSaldo=cents(c.monthNetForAccount(solo,b,Y,M,HOY))===-cents(e.amount);
    assert.equal(c.fixedRestaDelSaldo(s,e,Y,M,HOY),restaSaldo,e.id+": saldo");
    // Un recibo que el saldo ya resta no está pendiente en totals ni se resta otra vez en el recorrido.
    const enRecorrido=c.pendingWalkEvents(s,Y,M,HOY).some(ev=>ev.bank===b&&cents(ev.amt)===-cents(e.amount));
    if(restaSaldo&&pagado(s,e).paid) assert.equal(enRecorrido,false,e.id+": recorrido");
  }
  assert.equal(cents(T.pendingByBank.caixabank),6490);assert.equal(cents(T.pendingByBank.sabadell),3000);
  assert.equal(cents(T.minByBank.caixabank),61610);
});

test("2 · sigue restando lo que el saldo mostrado aún no lleva: cobrado ANTES de su día",()=>{
  // El alquiler del día 20 cobrado el 1: el calendario aún no lo resta del saldo, el banco sí.
  const s=estado({fixed:[luz,agua,Object.assign({},alquiler,{day:20}),seguro]});
  const {out}=bancos(s);
  assert.equal(out.caixabank.bal,152000-18900,"el saldo mostrado aún no resta el alquiler");
  assert.equal(out.caixabank.sinRestar,65000,"y el recorrido lo resta en su fila");
  assert.equal(out.caixabank.min,152000-18900-65000-6490);
});

test("2 · con lectura del banco: lo cobrado hoy tras la lectura de esta mañana sigue en su fila (R5-1)",()=>{
  // Sabadell leído hoy a las 7:00 y la luz cobrada hoy por la tarde (recibo del 16).
  const luzHoy=Object.assign({},luz,{day:16});
  const s=estado({fixed:[luzHoy,agua,alquiler,seguro],bankTx:[cargo({date:"2026-11-16"})],obBalAt:{"Banco Sabadell":"2026-11-16T06:00:00Z"}});
  assert.equal(pagado(s,luzHoy).paid,true);
  const evs=c.bankPendingEvents(s,"sabadell",Y,M,HOY);
  assert.ok(evs.some(ev=>ev.sinRestar&&cents(ev.amt)===-5426),"la lectura de la mañana no lleva el cargo de la tarde");
});

test("2 · con lectura anterior al día del recibo: el saldo mostrado ya lo resta, no se resta otra vez",()=>{
  // Sabadell leído el 2/11; la luz del 8 cruzó su día después: `paidNet` la resta del saldo mostrado.
  const {out}=bancos(estado());
  assert.equal(out.sabadell.sinRestar,0);
  // Leído el 9, después del cargo del 8: también dentro.
  const leido9=bancos(estado({obBalAt:{"Banco Sabadell":"2026-11-09T08:00:00Z"}})).out.sabadell;
  assert.equal(leido9.sinRestar,0);
});

test("2 · cuenta de gasto diario: no resta el calendario sino el cargo de Gastos; ese ya no se resta otra vez",()=>{
  const netflix={id:"nf",name:"Plataforma",amount:12.99,day:3,account:"revolut",freq:"mes"};
  const otro={id:"gym",name:"Gimnasio",amount:40,day:27,account:"revolut",freq:"mes"};
  // En una cuenta de gasto diario el extracto no paga recibos (`fixedPaymentState` pide una cuenta de
  // recibos); el cargo de Gastos con su nombre, sí, y ese cargo ya resta del saldo como gasto del mes.
  const fila={id:"g-nf",ent:"revolut",date:"2026-11-03T12:00:00.000Z",amount:12.99,merchant:"PLATAFORMA SINTETICA",source:"ob",status:"BOOK",category:"suscripciones"};
  const s=estado({fixed:[luz,agua,alquiler,seguro,netflix,otro],expenses:[filaAlquiler,fila]});
  assert.equal(pagado(s,netflix).paid,true);
  const {out,T}=bancos(s);
  assert.equal(cents(T.spentByBank.revolut),1299,"el cargo cuenta en el gastado…");
  assert.deepEqual(out.revolut,{bal:30000-1299,pend:4000,sinRestar:0,min:30000-1299-4000},"…así que no sale otra vez en «aún sin restar»");
  // Si el cargo no cuenta en el saldo (posible repetido), el recorrido sí lo resta.
  const dup=estado({fixed:[luz,agua,alquiler,seguro,netflix,otro],expenses:[filaAlquiler,Object.assign({},fila,{possibleDup:true})]});
  assert.equal(bancos(dup).out.revolut.bal,30000);
  // (Un posible repetido no paga el recibo: sigue pendiente y se resta como cargo de hoy.)
  assert.ok(c.bankPendingEvents(dup,"revolut",Y,M,HOY).some(ev=>cents(ev.amt)===-1299));
  // Y con el calendario solo, sin cargo, en una cuenta de gasto diario el recibo tampoco «está en el saldo».
  assert.equal(c.reciboEnElSaldo(estado({fixed:[netflix],expenses:[]}),netflix,Y,M,HOY,0,3,null,{paid:true,expense:null}),false);
});

test("2 · vencido SIN cobro: sigue siendo cargo de hoy (decisión del dueño, revisión t3 B1)",()=>{
  const s=estado({expenses:[]});
  assert.equal(pagado(s,alquiler).paid,false);
  assert.ok(c.bankPendingEvents(s,"caixabank",Y,M,HOY).some(ev=>!ev.sinRestar&&ev.day===HOY&&cents(ev.amt)===-65000));
});
