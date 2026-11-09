// «Cobró distinto» de un recibo aún sin pagar (auditoría 9/11/2026, P1-11): la luz de 54,26 € llega
// como «IBERDROLA… / RECIBO LUZ» por 54,71 € el mismo día. Sin nombre y sin el céntimo exacto no se
// da por pagada sola: sale en «Para revisar» para que él diga «Sí, es este» o «No es este recibo».
// Cero falsos positivos: con dos candidatos, o con un cargo que ya es de otro, no se pregunta nada.
// Datos inventados.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import { loadPureLogic } from "../scripts/load-pure-logic.mjs";

const read=f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8");
const order=JSON.parse(read("src/build-order.json"));
const c=loadPureLogic(read("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>order.map(f=>read("src/modules/"+f)).join("\n")));
vm.runInNewContext(read("src/modules/14-v4-screens.js"),c);
const AHORA=new Date("2026-09-09T12:00:00+02:00").getTime();
c.Date=class extends Date { constructor(...a){ super(...(a.length?a:[AHORA])); } static now(){ return AHORA; } };

const Y=2026,M=9,HOY=9;
const luz={id:"luz",name:"Luz",amount:54.26,freq:"mes",day:8,account:"sabadell",category:"luz"};
const tx=(p)=>Object.assign({id:"b-luz",ent:"sabadell",date:"2026-09-08",amount:54.71,merchant:"IBERDROLA CLIENTES SAU",concept:"RECIBO LUZ",status:"BOOK"},p);
const fila=(p)=>{ const t=tx(p); return Object.assign({id:"e-"+t.id,extId:t.id,ent:t.ent,date:t.date+"T12:00:00.000Z",amount:t.amount,merchant:t.merchant,obName:t.merchant,source:"ob",status:"BOOK",category:"otros"},p&&p.fila); };
const estado=(p)=>Object.assign({accounts:[{id:"sb",ent:"sabadell",role:"fijos",value:900},{id:"rv",ent:"revolut",role:"fijos",value:300}],
  fixed:[luz],bankTx:[tx()],expenses:[fila()],debts:[],oneoffs:[],flows:[],goals:[]},p);
const cand=(s,f)=>c.fixedPaymentCobroDistinto(s,f||s.fixed.find(x=>x.id==="luz"),Y,M,HOY);
const vista=(s)=>{
  const pack=c.planChargesMonth(s,M,Y,HOY),proof=c.paymentEvidenceUI(s,Y,M,HOY);
  return {pack,v:c.planRecibosVista(pack,proof,HOY,c.planRecibosAvisos(s,pack,proof,Y,M,HOY),{})};
};
const ids=l=>JSON.parse(JSON.stringify(l.map(x=>x.id+(x.rv?":"+x.rv:""))));

test("la luz con otro nombre y 0,45 € de diferencia: no se paga, se pregunta en «Para revisar»",()=>{
  const s=estado();
  assert.equal(c.fixedPaymentState(s,luz,Y,M,HOY).paid,false,"sin su palabra no está pagada");
  assert.equal(cand(s).id,"e-b-luz");
  const {pack,v}=vista(s);
  assert.deepEqual(ids(v.review),["fixed_luz:cand"]);
  const r=v.review[0];
  assert.equal(r.cobrado,54.71);assert.equal(r.previsto,54.26);
  assert.equal(c.pr6Motivo(r),"Esperabas 54,26 €");
  assert.ok(pack.pendingBills.some(x=>x.id==="fixed_luz"),"sigue sumando en lo que queda por pagar hasta que lo confirme");
  assert.equal(v.paid.length,0);
});

test("«Sí, es este» lo pasa a Ya pagados con lo que cobró el banco; Deshacer lo devuelve",()=>{
  const s=estado(),x=cand(s);
  const n=c.linkFixedPayment(s,x.id,"luz",Y,M,HOY,{identity:c.fixedPaymentIdentity("sabadell",x),model:c.fixedPaymentModel(luz,M),paidYm:null,paidDay:null});
  assert.notEqual(n,s);
  const f=n.fixed[0],st=c.fixedPaymentState(n,f,Y,M,HOY);
  assert.equal(st.paid,true);assert.equal(st.paidAmount,54.71);
  const {v}=vista(n);
  assert.deepEqual(ids(v.paid),["fixed_luz"]);assert.equal(v.review.length,0,"confirmado por él: no se vuelve a preguntar");
  assert.equal(cand(n,f),null);
  const u=c.linkFixedPayment(n,x.id,null,Y,M,HOY);
  assert.equal(c.fixedPaymentState(u,u.fixed[0],Y,M,HOY).paid,false);
  assert.deepEqual(ids(vista(u).v.review),["fixed_luz:cand"]);
});

test("«No es este recibo» lo veta (también en el otro móvil) y Deshacer lo levanta",()=>{
  const s=estado(),x=cand(s),claves=c.reciboNoClaves("luz",c.reciboNoIdentidad(x),x.id);
  const n=Object.assign({},s,c.reciboNoPon(s,claves,true,AHORA));
  assert.equal(cand(n),null);
  const {v}=vista(n);
  assert.equal(v.review.length,0);assert.deepEqual(ids(v.due),["fixed_luz"],"vuelve a Pendiente: tocaba ayer");
  const otro=Object.assign({},estado({bankTx:[]}),{reciboNo:n.reciboNo,reciboNoAt:n.reciboNoAt});
  assert.equal(cand(otro),null,"el otro móvil, sin extracto, tampoco lo pregunta");
  const u=Object.assign({},n,c.reciboNoPon(n,claves,false,AHORA+1));
  assert.equal(cand(u).id,"e-b-luz");
});

test("al céntimo lo sigue pagando el motor solo, sin preguntar",()=>{
  const s=estado({bankTx:[tx({amount:54.26})],expenses:[fila({amount:54.26})]});
  assert.equal(c.fixedPaymentState(s,luz,Y,M,HOY).paid,true);
  assert.equal(cand(s),null);
});

test("ambigüedad: dos candidatos, o otro recibo, cuota o puntual que lo puede reclamar → nada",()=>{
  const dos=estado({bankTx:[tx(),tx({id:"b-2",date:"2026-09-07",amount:54.70})],expenses:[fila(),fila({id:"b-2",date:"2026-09-07",amount:54.70})]});
  assert.equal(cand(dos),null,"dos cargos que encajan");
  const gas={id:"gas",name:"Gas",amount:54.60,freq:"mes",day:9,account:"sabadell"};
  assert.equal(cand(estado({fixed:[luz,gas]})),null,"otro recibo del mismo banco y parecido importe");
  assert.equal(cand(estado({debts:[{id:"d1",name:"Préstamo",monthly:54.71,day:8,account:"sabadell",value:5000,asOf:2026*12+8}]})),null,"una cuota");
  assert.equal(cand(estado({oneoffs:[{id:"o1",name:"Revisión caldera",amount:54.5,day:8,month:9,year:2026,account:"sabadell"}]})),null,"un puntual");
});

test("un cargo que ya es otra cosa en Gastos no se pregunta",()=>{
  assert.equal(cand(estado({expenses:[fila({fila:{category:"traspaso"}})]})),null,"traspaso");
  assert.equal(cand(estado({expenses:[fila({fila:{debtId:"d1",category:"deudas"}})]})),null,"cuota de deuda");
  assert.equal(cand(estado({expenses:[fila({fila:{reciboId:"otro"}})]})),null,"marcado como otro recibo");
  assert.equal(cand(estado({expenses:[fila({fila:{possibleDup:true}})]})),null,"posible repetido");
  assert.equal(cand(estado({expenses:[fila({fila:{obPending:true}})]})),null,"pendiente en el banco");
  const gas={id:"gas",name:"Gas",amount:54.71,freq:"mes",day:20,account:"sabadell",paymentProofs:{}};
  const usado=estado({fixed:[luz,gas]}),x=cand(estado());
  const n=c.linkFixedPayment(usado,x.id,"gas",Y,M,HOY);
  assert.notEqual(n,usado);assert.equal(cand(n),null,"ya paga otro recibo");
});

test("solo un adeudo del banco del recibo, cerca de su día y con importe parecido",()=>{
  assert.equal(cand(estado({bankTx:[tx({concept:""})]})),null,"ni la fila ni el extracto dicen que es un recibo");
  assert.equal(cand(estado({bankTx:[tx({concept:"TRANSFERENCIA RECIBO"})],expenses:[fila()]})),null,"transferencia");
  assert.equal(cand(estado({bankTx:[tx({card:true})],expenses:[fila({fila:{card:true}})]})),null,"tarjeta");
  assert.equal(cand(estado({bankTx:[tx({ent:"revolut"})],expenses:[fila({ent:"revolut"})]})),null,"otro banco");
  assert.equal(cand(estado({bankTx:[tx({date:"2026-09-03"})],expenses:[fila({date:"2026-09-03"})]})),null,"cinco días lejos");
  assert.equal(cand(estado({bankTx:[tx({amount:56})],expenses:[fila({amount:56})]})),null,"1,74 € de diferencia en 54 € no es parecido");
  assert.equal(cand(estado({fixed:[Object.assign({},luz,{day:10})]}),Object.assign({},luz,{day:10})),null,"antes de su día no");
});

test("el suyo con nombre, devuelto, pausado o marcado a mano: no se pregunta",()=>{
  const elec=Object.assign({},luz,{name:"Electricidad"});
  assert.equal(cand(estado({fixed:[elec]}),elec).id,"e-b-luz");
  const conNombre=estado({fixed:[elec],bankTx:[tx(),tx({id:"b-n",merchant:"ELECTRICIDAD SINTETICA",amount:70})],expenses:[fila(),fila({id:"b-n",merchant:"ELECTRICIDAD SINTETICA",amount:70})]});
  assert.equal(cand(conNombre,elec),null,"un cargo con su nombre es el suyo, aunque cobre otra cifra");
  assert.equal(cand(estado({bankTx:[tx(),tx({id:"b-dev",date:"2026-09-09",amount:-54.71,merchant:"DEVOLUCION RECIBO"})]})),null,"recibo devuelto");
  const pausa=Object.assign({},luz,{pausedFrom:Y*12+M,pausedUntil:Y*12+M+1});
  assert.equal(cand(estado({fixed:[pausa]}),pausa),null,"pausado");
  const aMano=Object.assign({},luz,{pagadoAMano:{[Y*12+M]:8}});
  assert.equal(cand(estado({fixed:[aMano]}),aMano),null,"marcado a mano");
});

test("revisión del 9/11: rival al céntimo con su día a +5, compra con tarjeta que dice «RECIBO» y umbral del 1 %",()=>{
  const seguro={id:"seg",name:"Seguro",amount:54.71,freq:"mes",day:13,account:"sabadell"};
  assert.equal(cand(estado({fixed:[luz,seguro]})),null,"el cargo puede ser el adelantado de otro recibo al céntimo");
  assert.equal(cand(estado({bankTx:[tx({card:true,merchant:"RECIBO TIENDA SINTETICA",concept:""})],expenses:[fila({merchant:"RECIBO TIENDA SINTETICA"})]})),null,"tarjeta solo en el extracto");
  const alq={id:"alq",name:"Alquiler",amount:850,freq:"mes",day:8,account:"sabadell"};
  const conAlq=(amount)=>estado({fixed:[alq],bankTx:[tx({amount,merchant:"INMOBILIARIA SINTETICA",concept:"RECIBO"})],expenses:[fila({amount,merchant:"INMOBILIARIA SINTETICA"})]});
  assert.equal(cand(conAlq(849.6),alq).id,"e-b-luz","40 céntimos en 850: se pregunta");
  assert.equal(cand(conAlq(860),alq),null,"10 € en 850 ya no se parece (antes ±17 €)");
});
