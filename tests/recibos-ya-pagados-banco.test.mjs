// «Ya pagados» se enlaza con lo que cobra el banco aunque el cargo no lleve el nombre del recibo
// (queja del 8/11/2026). Sabadell manda el acreedor SEPA o el concepto del adeudo como comercio:
// el recibo «Luz» se cobra como «ENERGIA SINTETICA SA» y el motor, que solo casaba por nombre, lo
// dejaba pendiente con el cargo ya en el banco. Datos inventados. Los casos R1-R7 son los repros de
// la revisión independiente del 8/11 (NO-GO de f851ee814).
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import { loadPureLogic } from "../scripts/load-pure-logic.mjs";

const read=f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8");
const order=JSON.parse(read("src/build-order.json"));
const c=loadPureLogic(read("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>order.map(f=>read("src/modules/"+f)).join("\n")));
vm.runInNewContext(read("src/modules/14-v4-screens.js"),c);
c.Date=class extends Date { constructor(...a){ super(...(a.length?a:[new Date("2026-09-30T12:00:00+02:00").getTime()])); } static now(){ return new Date("2026-09-30T12:00:00+02:00").getTime(); } };

const Y=2026,M=9,HOY=30;
const luz={id:"luz",name:"Luz",amount:54.30,freq:"mes",day:5,account:"sabadell"};
const cargo=(p)=>Object.assign({id:"ref-"+Math.random().toString(36).slice(2),ent:"sabadell",date:"2026-09-06",amount:54.30,merchant:"ENERGIA SINTETICA SA",concept:"ADEUDO RECIBO SEPA 0000",status:"BOOK"},p);
const estado=(p)=>Object.assign({accounts:[{id:"sb",ent:"sabadell",role:"fijos",value:900},{id:"rv",ent:"revolut",role:"diario",value:300}],
  fixed:[luz],bankTx:[cargo()],debts:[],oneoffs:[],flows:[],goals:[],expenses:[]},p);
const st=(s,f)=>c.fixedPaymentState(s,f||s.fixed[0],Y,M,HOY);
const pagados=s=>JSON.parse(JSON.stringify(c.planChargesMonth(s,M,Y,HOY).paidBills.map(x=>x.id).sort()));

test("cargo exacto del banco del recibo: pasa a «Ya pagados» con fecha e importe reales",()=>{
  const s=estado(),r=st(s);
  assert.equal(r.paid,true);assert.equal(r.day,6,"día del cargo, no el previsto");
  assert.equal(r.paidAmount,54.30);assert.equal(r.paidBank,"sabadell");
  assert.deepEqual(pagados(s),["fixed_luz"]);
  assert.equal(c.paymentEvidenceUI(s,Y,M,HOY).confirmed.fixed_luz,true,"con cargo detrás: no va a «Para revisar»");
  const pack=c.planChargesMonth(s,M,Y,HOY),v=c.planRecibosVista(pack,c.paymentEvidenceUI(s,Y,M,HOY),HOY,{},{});
  assert.deepEqual(JSON.parse(JSON.stringify(v.paid.map(x=>x.id))),["fixed_luz"]);assert.equal(v.review.length,0);
});

test("importe: sin el nombre, al céntimo (como cuotaCasa); con el nombre, la tolerancia de siempre",()=>{
  assert.equal(st(estado({bankTx:[cargo({amount:54.31})]})).paid,false,"un céntimo distinto sin nombre no es su cargo");
  const comunidad=Object.assign({},luz,{id:"com",name:"Comunidad"});
  const r=st(estado({fixed:[comunidad],bankTx:[cargo({merchant:"COMUNIDAD SINTETICA",amount:54.60})]}));
  assert.equal(r.paid,true);assert.equal(r.paidAmount,54.60,"Ya pagados enseña lo cobrado");
});

test("día desplazado: hasta cuatro días, en el mismo mes",()=>{
  assert.equal(st(estado({bankTx:[cargo({date:"2026-09-01"})]})).paid,true);
  assert.equal(st(estado({bankTx:[cargo({date:"2026-09-09"})]})).paid,true);
  assert.equal(st(estado({bankTx:[cargo({date:"2026-09-10"})]})).paid,false,"cinco días lejos no es su cargo");
  assert.equal(st(estado({bankTx:[cargo({date:"2026-08-31"})]})).paid,false,"otro mes no paga este");
  assert.equal(st(estado({fixed:[Object.assign({},luz,{day:null})]})).paid,false,"sin día no hay ventana");
});

test("dos recibos con el mismo importe: empate, ninguno; con días distintos, cada uno el suyo",()=>{
  const gym={id:"gym",name:"Gimnasio",amount:54.30,freq:"mes",day:7,account:"sabadell"};
  const empate=estado({fixed:[luz,gym]});
  assert.equal(st(empate,luz).paid,false);assert.equal(st(empate,gym).paid,false);
  assert.deepEqual(pagados(empate),[],"un cargo no paga dos recibos ni elige uno a ciegas");
  const lejos=Object.assign({},gym,{day:20});
  const dos=estado({fixed:[luz,lejos],bankTx:[cargo(),cargo({date:"2026-09-21",merchant:"CLUB SINTETICO"})]});
  assert.deepEqual(pagados(dos),["fixed_gym","fixed_luz"]);
  assert.equal(st(dos,lejos).day,21);
  const dosCargos=estado({bankTx:[cargo(),cargo({date:"2026-09-07"})]});
  assert.equal(st(dosCargos).paid,false,"dos cargos que encajan: para revisar");
  const deuda=estado({debts:[{id:"d1",name:"Préstamo",monthly:54.30,day:6,account:"sabadell",value:5000,asOf:2026*12+8}]});
  assert.equal(st(deuda).paid,false,"una cuota del mismo importe también lo reclama");
});

test("solo un adeudo: sin «recibo/adeudo/domiciliación/SEPA», o con transferencia o traspaso, no",()=>{
  assert.equal(st(estado({bankTx:[cargo({concept:""})]})).paid,false,"sin decir que es un adeudo");
  assert.equal(st(estado({bankTx:[cargo({concept:"",note:"Domiciliación SEPA"})]})).paid,true,"el código bancario también vale");
  assert.equal(st(estado({bankTx:[cargo({concept:"TRANSFERENCIA RECIBO ALQUILER"})]})).paid,false,"una transferencia no es un adeudo");
  assert.equal(st(estado({bankTx:[cargo({merchant:"TRASPASO CUENTA",concept:"RECIBO"})]})).paid,false,"un traspaso tampoco");
});

test("cargo de otro banco, con tarjeta, retirada o bizum: no",()=>{
  assert.equal(st(estado({bankTx:[cargo({ent:"revolut"})]})).paid,false,"otro banco");
  assert.equal(st(estado({bankTx:[cargo({card:true,merchant:"SUPER SINTETICO"})]})).paid,false,"compra con tarjeta");
  assert.equal(st(estado({bankTx:[cargo({merchant:"DISPOSICION OFICINA"})]})).paid,false,"retirada");
  assert.equal(st(estado({bankTx:[cargo({merchant:"BIZUM A PERSONA SINTETICA"})]})).paid,false,"bizum");
  assert.equal(st(estado({bankTx:[cargo({status:"PDNG"})]})).paid,false,"pendiente en el banco");
});

test("devolución: el recibo devuelto no está pagado",()=>{
  assert.equal(st(estado({bankTx:[cargo(),cargo({amount:-54.30,date:"2026-09-12",merchant:"DEVOLUCION RECIBO"})]})).paid,false);
  assert.equal(st(estado({bankTx:[cargo({amount:-54.30})]})).paid,false,"un abono solo no paga nada");
  const medianoche=estado({expenses:[{id:"dev0",date:"2026-09-05T22:00:00.000Z",merchant:"DEVOLUCION",amount:-54.30,source:"ob",ent:"sabadell",category:"ingreso"}]});
  assert.equal(st(Object.assign(medianoche,{bankTx:[cargo({date:"2026-09-06"})]})).paid,false,"devuelta el mismo día a medianoche de Madrid (22:00 UTC del día antes)");
  const enGastos=estado({expenses:[{id:"dev",date:"2026-09-12T12:00:00.000Z",merchant:"DEVOLUCION",amount:-54.30,source:"ob",ent:"sabadell",category:"ingreso"}]});
  assert.equal(st(enGastos).paid,false,"la devolución que solo está en Gastos también cuenta");
  assert.equal(st(estado({bankTx:[cargo(),cargo({amount:-54.30,date:"2026-09-02"})]})).paid,true,"un abono ANTERIOR no devuelve este cargo");
});

test("el nombre manda: un cargo con el nombre de otro recibo no se lo queda este por importe",()=>{
  const agua={id:"agua",name:"Agua Canal",amount:54.30,freq:"mes",day:5,account:"sabadell"};
  const s=estado({fixed:[luz,agua],bankTx:[cargo({merchant:"CANAL SINTETICO"})]});
  assert.equal(st(s,agua).paid,true,"lo que ya casaba por nombre sigue igual");
  assert.equal(st(s,luz).paid,false);
  const comunidad=Object.assign({},luz,{id:"com",name:"Comunidad"});
  const subida=estado({fixed:[comunidad],bankTx:[cargo({merchant:"COMUNIDAD SINTETICA",amount:80}),cargo({merchant:"OTRA COSA"})]});
  assert.equal(st(subida).paid,false,"con su nombre e importe distinto, ese es su cargo: no se coge otro por casualidad");
});

test("no duplica: se persiste una vez, viaja sin extracto y no mueve saldo ni gastado",()=>{
  const s=estado(),antes=JSON.stringify(s);
  const r=c.reconcileFixedPaymentProofs(s,Y,M,HOY);
  assert.equal(JSON.stringify(s),antes,"puro");
  const p=r.fixed[0].paymentProofs[Y*12+M];
  assert.equal(p.kind,"book");assert.equal(p.amount,54.30);
  assert.equal(c.reconcileFixedPaymentProofs(r,Y,M,HOY),r,"segunda pasada: nada que escribir");
  const otroMovil=c.slimForCloud(r);
  assert.equal(st(otroMovil,otroMovil.fixed[0]).paid,true,"el otro móvil lo ve pagado sin extracto");
  assert.equal(r.accounts,s.accounts,"no toca saldos");assert.equal(r.expenses,s.expenses,"ni gastos");
  assert.equal(c.monthBudgetStats(r).spent,c.monthBudgetStats(s).spent);
  // Y un segundo recibo igual que llega después no se lleva el mismo cargo.
  const gym={id:"gym",name:"Gimnasio",amount:54.30,freq:"mes",day:6,account:"sabadell"};
  const despues=Object.assign({},r,{fixed:r.fixed.concat([gym])});
  assert.equal(st(despues,gym).paid,false);
  assert.equal([st(despues,despues.fixed[0]).paid,st(despues,gym).paid].filter(Boolean).length<=1,true,"nunca los dos");
});

// Repros de la revisión (8/11). Cada uno afirma lo correcto.
let n=0;
const ref=(p)=>cargo(Object.assign({id:"rv-"+(++n)},p));
const fila=(tx,p)=>Object.assign({id:"x-"+tx.id,extId:tx.id,ent:tx.ent,date:tx.date+"T12:00:00.000Z",amount:tx.amount,merchant:tx.merchant,obName:tx.merchant,source:"ob",status:"BOOK",category:"otros"},p);

test("R1 transferencia a otra persona del mismo importe: no paga el recibo",()=>{
  assert.equal(st(estado({bankTx:[ref({merchant:"TRANSFERENCIA A FAVOR DE PERSONA SINTETICA",concept:"cena"})]})).paid,false);
});
test("R2 cargo que en Gastos es un traspaso: no paga el recibo (también si el banco lo llama recibo)",()=>{
  const tx=ref({merchant:"TRASPASO CUENTA AHORRO",concept:""});
  assert.equal(st(estado({bankTx:[tx],expenses:[fila(tx,{category:"traspaso"})]})).paid,false);
  const tx2=ref({merchant:"PROVEEDOR SINTETICO"});
  for(const category of ["traspaso","inversion","ingreso"]) assert.equal(st(estado({bankTx:[tx2],expenses:[fila(tx2,{category})]})).paid,false,category);
  assert.equal(st(estado({bankTx:[tx2],expenses:[fila(tx2,{possibleDup:true})]})).paid,false,"posible repetido");
  assert.equal(st(estado({bankTx:[tx2],expenses:[fila(tx2)]})).paid,true,"la misma fila sin dueño sí");
});
test("R3 cargo ya marcado como cuota de deuda: no cuenta además como recibo",()=>{
  const tx=ref({merchant:"COFIDIS SINTETICO"});
  const deuda={id:"d1",name:"Financiación gym",monthly:54.30,day:20,account:"sabadell",value:500,asOf:2026*12+8};
  assert.equal(st(estado({bankTx:[tx],debts:[deuda],expenses:[fila(tx,{category:"deudas",debtId:"d1",debtManual:true})]})).paid,false,"con la marca");
  const otra={id:"d2",name:"Préstamo",monthly:54.30,account:"sabadell",value:5000,asOf:2026*12+8};
  assert.equal(st(estado({bankTx:[ref()],debts:[Object.assign({},otra,{day:25})]})).paid,true,"una cuota de un día lejano no empata");
  assert.equal(st(estado({bankTx:[ref()],debts:[Object.assign({},otra,{day:9})]})).paid,false,"sin marca, una cuota que cuotaCasa casaría empata");
  assert.equal(st(estado({bankTx:[ref({date:"2026-09-02"})],debts:[Object.assign({},otra,{day:31})]})).paid,false,"también cruzando de mes (la del 31 de agosto)");
  const alias=estado({bankTx:[ref({merchant:"COFIDIS SINTETICO"})],debts:[Object.assign({},otra,{day:18})]});
  alias.cuotaAlias={[c.cuotaAliasKey({merchant:"COFIDIS SINTETICO",ent:"sabadell"})]:"d2"};
  assert.equal(st(alias).paid,false,"ni el comercio que él ya le enseñó a la deuda");
});
test("R4 cargo marcado como aportación a meta: no paga el recibo",()=>{
  const tx=ref({merchant:"AHORRO SINTETICO"});
  assert.equal(st(estado({bankTx:[tx],goals:[{id:"g1",name:"Viaje",target:1000}],expenses:[fila(tx,{goalId:"g1"})]})).paid,false);
});
test("R5 un falso positivo se deshace con «No es este recibo» y no vuelve, tampoco en el otro móvil",()=>{
  const tx=ref({merchant:"PROVEEDOR EQUIVOCADO"});
  const x=fila(tx);
  const s=c.reconcileFixedPaymentProofs(estado({bankTx:[tx],expenses:[x]}),Y,M,HOY);
  assert.equal(st(s).paid,true,"precondición: el motor lo da por pagado");
  const r=c.reciboDesenlazar(s,s.fixed[0],x,Y,M,HOY);
  assert.ok(r,"debe haber forma de deshacerlo");
  assert.equal(st(r.state).paid,false);
  assert.equal(c.reconcileFixedPaymentProofs(r.state,Y,M,HOY).fixed[0].paymentProofs[Y*12+M],undefined,"la sincronización no lo vuelve a poner");
  const otro=c.slimForCloud(s),bajado=Object.assign({},otro,c.reciboNoUnion(otro,r.state));
  assert.equal(st(bajado,bajado.fixed[0]).paid,false,"el veto viaja: el otro móvil deja de aceptar la prueba");
  const bueno=Object.assign({},r.state,{expenses:r.state.expenses.concat([{id:"bueno",date:"2026-09-07T12:00:00.000Z",merchant:"OTRO CARGO",amount:54.30,ent:"revolut",source:"wallet",category:"otros"}])});
  const enlazado=c.linkFixedPayment(bueno,"bueno","luz",Y,M,HOY);
  assert.equal(st(enlazado,enlazado.fixed[0]).paid,true,"«Paga un recibo» con el cargo bueno ya no está bloqueado");
});
test("R6 sin nombre, 650 € no se paga con 662,90 €",()=>{
  const alq={id:"alq",name:"Alquiler",amount:650,freq:"mes",day:1,account:"sabadell"};
  assert.equal(st(estado({fixed:[alq],bankTx:[ref({date:"2026-09-02",amount:662.9,merchant:"PERSONA SINTETICA"})]}),alq).paid,false);
});
test("R7 antes del día del recibo, un cargo parecido no lo paga ni adelanta el saldo previsto",()=>{
  const seg={id:"seg",name:"Seguro",amount:54.30,freq:"mes",day:12,account:"sabadell"};
  const s=estado({fixed:[seg],bankTx:[ref({date:"2026-09-08",merchant:"ASEGURADORA SINTETICA"})]});
  assert.equal(c.fixedPaymentState(s,seg,Y,M,9).paid,false,"el 9 no paga el recibo del 12");
  const r=c.reconcileFixedPaymentProofs(s,Y,M,9);
  assert.equal(r,s,"no se guarda prueba antes de tiempo");
  assert.equal(c.fixedPaymentState(s,seg,Y,M,12).paid,true,"llegado su día, sí");
  // Una prueba guardada el día 12 no vale leída antes (otro móvil con la fecha atrasada).
  const p=c.reconcileFixedPaymentProofs(s,Y,M,12);
  assert.equal(c.fixedPaymentProof(c.slimForCloud(p),p.fixed[0],Y,M,9),null);
});
