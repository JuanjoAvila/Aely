// Suscripciones: solo lo que de verdad se cobra igual y con periodo fijo (auditoría de diseño 237,
// P1-3). La bandeja de Gastos decía «913 € al mes · 12 por revisar» con Mercadona, Repsol, el bar y
// la cuota del coche: `detectSubscriptions` sumaba por mes, y el súper de cada semana suma parecido
// cada mes. El histórico es el mismo que siembra el e2e (`e2e/subs-historico.mjs`), datos inventados.
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { loadPureLogic } from "../scripts/load-pure-logic.mjs";
import { historicoSuscripciones, SUBS_SI, SUBS_NO } from "../e2e/subs-historico.mjs";

const read=f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8");
const order=JSON.parse(read("src/build-order.json"));
const c=loadPureLogic(read("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>order.map(f=>read("src/modules/"+f)).join("\n")));
// El reloj de las fixtures del e2e: 26/9/2026.
const AHORA=Date.parse("2026-09-26T12:00:00Z");
c.Date=class extends Date { constructor(...a){ super(...(a.length?a:[AHORA])); } static now(){ return AHORA; } };

const h=historicoSuscripciones();
const subs=c.detectSubscriptions(h.expenses);
const vistas=subs.map(s=>[s.name,s.per,s.amount]);

test("del histórico realista salen las suscripciones de verdad, con su periodo y lo de cada cobro",()=>{
  assert.deepEqual(JSON.parse(JSON.stringify(vistas)).sort(),SUBS_SI.slice().sort());
  for(const s of subs) assert.equal(s.active,true,s.name+" sigue viva");
});

test("no sale el gasto diario, la deuda, lo que ya es recibo, el traspaso ni la nómina",()=>{
  const nombres=new Set(subs.map(s=>s.name));
  for(const n of SUBS_NO) assert.equal(nombres.has(n),false,n+" no es una suscripción");
});

test("lo que pesa al mes: semanal ×52/12, anual /12; la cifra de la bandeja no se infla",()=>{
  const kiosko=subs.find(s=>s.name==="Kiosko Digital"), anti=subs.find(s=>s.per==="anio");
  assert.equal(kiosko.mensual,8.62);
  assert.equal(kiosko.yearly,103);
  assert.equal(anti.mensual,3.33);
  assert.equal(anti.yearly,40);
  const total=subs.reduce((a,s)=>a+s.mensual,0);
  // Antes eran 913 €; ahora lo que suman de verdad Netflix, Spotify, gimnasio, Apple ×2, Prime,
  // periódico, antivirus y Digi.
  assert.equal(Math.round(total*100)/100,114.89);
});

test("Netflix sube de precio: sigue siendo la misma y vale lo último; seis meses seguidos",()=>{
  const nf=subs.find(s=>s.name==="Netflix");
  assert.equal(nf.amount,13.99);
  assert.equal(nf.months,6);
  assert.equal(nf.span,6);
  assert.equal(nf.ult.length,3);
  assert.equal(nf.ult[0].e.date.slice(0,10),"2026-09-14");
});

test("un comercio con dos cobros fijos da dos suscripciones con claves distintas; la cara lleva la de siempre",()=>{
  const apple=subs.filter(s=>s.name==="APPLE.COM/BILL");
  assert.equal(apple.length,2);
  assert.equal(apple[0].key,c.catKey("APPLE.COM/BILL"));
  assert.equal(apple[1].key,c.catKey("APPLE.COM/BILL")+"#299");
  assert.ok(apple.every(s=>s.mkey===c.catKey("APPLE.COM/BILL")));
});

test("Prime se ve aunque Amazon tenga compras sueltas con el mismo nombre",()=>{
  const am=subs.filter(s=>s.name==="Amazon");
  assert.deepEqual([...am.map(s=>s.amount)],[4.99]);
});

const fila=(id,f,amount,extra={})=>Object.assign({id,date:f+"T10:00:00Z",amount,merchant:"Servicio X",category:"ocio",source:"ob",ent:"revolut"},extra);

test("negativos sueltos: importe que baila, dos al mes, deuda, recibo, gasolina regular, duplicado",()=>{
  const mes=["2026-05","2026-06","2026-07","2026-08","2026-09"];
  const casos={
    baila:mes.map((m,i)=>fila("b"+i,m+"-10",[20,31,24,40,27][i])),
    dosAlMes:mes.flatMap((m,i)=>[fila("d"+i,m+"-02",15),fila("e"+i,m+"-17",15)]),
    deuda:mes.map((m,i)=>fila("q"+i,m+"-05",197,{debtId:"coche"})),
    recibo:mes.map((m,i)=>fila("r"+i,m+"-08",41.2,{reciboId:"agua"})),
    gasolina:mes.map((m,i)=>fila("g"+i,m+"-02",50,{category:"gasolina"})),
    traspaso:mes.map((m,i)=>fila("t"+i,m+"-01",200,{category:"traspaso"})),
    duplicado:mes.slice(0,2).map((m,i)=>fila("x"+i,m+"-09",9.99)).concat(fila("x2","2026-07-09",9.99,{possibleDup:true})),
    ingreso:mes.map((m,i)=>fila("n"+i,m+"-28",-1500)),
  };
  for(const [k,ex] of Object.entries(casos)) assert.equal(c.detectSubscriptions(ex).length,0,k);
});

test("positivos sueltos: un mes saltado, el banco que apunta tarde, cada 28 días y semanal",()=>{
  const uno=ex=>{ const r=c.detectSubscriptions(ex); assert.equal(r.length,1); return r[0]; };
  // Mayo, julio y septiembre: «3 de 5 meses», no «cada mes».
  const salto=uno(["2026-05-03","2026-07-03","2026-09-03"].map((f,i)=>fila("s"+i,f,30)));
  assert.equal(salto.per,"mes"); assert.equal(salto.months,3); assert.equal(salto.span,5);
  // El 1, y el banco lo apunta el 3 o el 4 cuando cae en fin de semana.
  assert.equal(uno(["2026-05-01","2026-06-03","2026-07-01","2026-08-04","2026-09-01"].map((f,i)=>fila("t"+i,f,7.99))).per,"mes");
  // Cada 28 días es un mes, no cuatro semanas.
  assert.equal(uno(["2026-06-02","2026-06-30","2026-07-28","2026-08-25","2026-09-22"].map((f,i)=>fila("v"+i,f,5.99))).per,"mes");
  const sem=uno(["2026-08-24","2026-08-31","2026-09-07","2026-09-14","2026-09-21"].map((f,i)=>fila("w"+i,f,3)));
  assert.equal(sem.per,"semana"); assert.equal(sem.mensual,13);
});

test("deja de estar viva: el mensual sin cobro en tres meses, el semanal sin cobro en tres semanas",()=>{
  const mes=c.detectSubscriptions(["2026-04-10","2026-05-10","2026-06-10"].map((f,i)=>fila("m"+i,f,9.99)));
  assert.equal(mes.length,1); assert.equal(mes[0].active,false);
  const sem=c.detectSubscriptions(["2026-08-03","2026-08-10","2026-08-17","2026-08-24"].map((f,i)=>fila("s"+i,f,2)));
  assert.equal(sem.length,1); assert.equal(sem[0].active,false);
});
