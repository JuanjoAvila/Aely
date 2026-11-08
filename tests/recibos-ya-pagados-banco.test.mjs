// «Ya pagados» se enlaza con lo que cobra el banco aunque el cargo no lleve el nombre del recibo
// (queja del 8/11/2026). Sabadell manda el acreedor SEPA o el concepto del adeudo como comercio:
// el recibo «Luz» se cobra como «ENERGIA SINTETICA SA» y el motor, que solo casaba por nombre, lo
// dejaba pendiente con el cargo ya en el banco. Datos inventados.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import { loadPureLogic } from "../scripts/load-pure-logic.mjs";

const read=f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8");
const order=JSON.parse(read("src/build-order.json"));
const c=loadPureLogic(read("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>order.map(f=>read("src/modules/"+f)).join("\n")));
vm.runInNewContext(read("src/modules/14-v4-screens.js"),c);
c.Date=class extends Date { constructor(...a){ super(...(a.length?a:[new Date("2026-09-30T12:00:00+02:00").getTime()])); } };

const Y=2026,M=9,HOY=30;
const luz={id:"luz",name:"Luz",amount:54.30,freq:"mes",day:5,account:"sabadell"};
const cargo=(p)=>Object.assign({id:"ref-"+Math.random().toString(36).slice(2),ent:"sabadell",date:"2026-09-06",amount:54.30,merchant:"ENERGIA SINTETICA SA",status:"BOOK"},p);
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

test("importe que varía un poco: dentro de la tolerancia de siempre sí, más allá no",()=>{
  const poco=estado({bankTx:[cargo({amount:54.60})]});
  assert.equal(st(poco).paid,true);assert.equal(st(poco).paidAmount,54.60,"Ya pagados enseña lo cobrado");
  assert.equal(st(estado({bankTx:[cargo({amount:58.10})]})).paid,false,"una factura distinta no se adivina");
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
