/* UN RECIBO PAUSADO EN «SE TE VAN» DE TUS RECIBOS (P2-9 de la 218 y su revisión: P2-a, P2-b, P2-c).
 *
 * Al mes, un pausado no suma (decisión del dueño, 10/11/2026). Al año suma lo que de verdad se paga
 * en los doce meses que empiezan en este: solo faltan los cobros que caen dentro de la pausa. Antes
 * un alquiler pausado un mes quitaba doce, y un anual pausado hasta enero no contaba aunque se cobra
 * en marzo. La regla de «está pausado» es `fixedPausedIn` (este mes o el que viene), no otra: solo
 * mirar `pausedUntil` dejaba fuera una pausa programada para dentro de varios meses.
 *
 * Oráculo: el calendario de la app (`chargeMonths` + `occAmountIn`) recorrido mes a mes, saltando los
 * meses de la pausa, contado aquí a mano y no con `billsAnualDe`. */
import assert from "node:assert/strict";
import fs from "node:fs";
import {test} from "node:test";
import {loadPureLogic} from "../scripts/load-pure-logic.mjs";
const read=f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8");
const js=JSON.parse(read("src/build-order.json")).map(f=>read("src/modules/"+f)).join("\n");
const c=loadPureLogic(read("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>js));
const cent=x=>Math.round(x*100);
// Octubre de 2026, como el e2e de Tus recibos.
const M=10, Y=2026, YM=Y*12+M;
const oraculo=e=>{
  let a=0;
  for(let i=0;i<12;i++){
    const m=(M-1+i)%12+1, y=Y+Math.floor((M-1+i)/12), ym=y*12+m;
    const pausa=Number(e.pausedUntil)>0&&ym>=(Number(e.pausedFrom)||0)&&ym<Number(e.pausedUntil);
    // Sin calendario (anual sin mes, sin frecuencia) se paga su parte cada mes: el anual, la doceava.
    if(!c.chargeMonths(e).length){ if(!pausa) a+=e.freq==="año"||e.freq==="anual"?e.amount/12:e.amount; }
    else if(!pausa&&c.chargeMonths(e).indexOf(m)>=0) a+=c.occAmountIn(e,m);
  }
  return a;
};

test("pausa caducada o que acaba este mes: vuelve a sumar",()=>{
  for(const u of [YM-3,YM-1,YM]){
    const e={amount:39.9,freq:"mes",pausedFrom:YM-4,pausedUntil:u};
    assert.equal(c.billsPausado(e,M,Y),false,"pausedUntil="+(u-YM));
    assert.equal(c.fixedPausedIn(e,Y,M),false);
    assert.equal(cent(c.billsAnualDe(e,M,Y)),cent(39.9*12));
    const s={fixed:[e],debts:[]};
    assert.equal(cent(c.billsHeroTotal(s,null,M,Y)),3990);
  }
});

test("pausa de este mes, o pagado este mes y pausado desde el que viene: no suma al mes",()=>{
  assert.equal(c.billsPausado({pausedFrom:YM,pausedUntil:YM+1},M,Y),true);
  assert.equal(c.billsPausado({pausedFrom:YM+1,pausedUntil:YM+3},M,Y),true);
  // Sin `pausedFrom` (datos de antes): pausa desde siempre hasta la vuelta.
  assert.equal(c.billsPausado({pausedUntil:YM+2},M,Y),true);
  // Diciembre → enero del año siguiente.
  assert.equal(c.billsPausado({pausedFrom:2027*12+1,pausedUntil:2027*12+2},12,2026),true);
});

test("P2-c: una pausa programada para dentro de varios meses todavía suma",()=>{
  const e={amount:850,freq:"mes",pausedFrom:YM+3,pausedUntil:YM+5};
  assert.equal(c.billsPausado(e,M,Y),false);
  assert.equal(cent(c.billsHeroTotal({fixed:[e],debts:[]},null,M,Y)),85000);
  // Al año faltan sus dos meses.
  assert.equal(cent(c.billsAnualDe(e,M,Y)),cent(850*10));
});

const casos=[
  {name:"mensual pausado solo este mes: falta uno, no doce",e:{amount:850,freq:"mes",pausedFrom:YM,pausedUntil:YM+1},anual:850*11},
  {name:"trimestral (ene/abr/jul/oct) pausado oct-nov: falta el de octubre",e:{amount:30,freq:"trimestral",pausedFrom:YM,pausedUntil:YM+2},anual:90},
  {name:"trimestral pausado nov-dic: no cae ningún cobro, el año entero",e:{amount:30,freq:"trimestral",pausedFrom:YM+1,pausedUntil:YM+3},anual:120},
  {name:"anual de marzo pausado hasta enero: el de marzo se paga",e:{amount:600,freq:"año",months:[3],pausedFrom:YM,pausedUntil:2027*12+1},anual:600},
  {name:"anual de marzo pausado hasta abril: no se paga",e:{amount:600,freq:"anual",months:[3],pausedFrom:YM,pausedUntil:2027*12+4},anual:0},
  {name:"anual repartido en dos meses, pausado uno",e:{amount:600,freq:"año",months:[3,11],pausedFrom:YM+1,pausedUntil:YM+2},anual:300},
  {name:"con calendario propio, pausado el mes de un cobro",e:{amount:172.05,freq:"semestral",schedule:[{m:3,amt:172.05},{m:11,amt:166.94}],pausedFrom:YM+1,pausedUntil:YM+2},anual:172.05},
  {name:"anual sin mes asignado pausado seis meses: quita la mitad, no nada",e:{amount:600,freq:"año",pausedFrom:YM,pausedUntil:YM+6},anual:300},
  {name:"sin frecuencia (cuenta como mensual) pausado dos meses",e:{amount:50,pausedFrom:YM,pausedUntil:YM+2},anual:500},
  {name:"sin pausa: la media ×12",e:{amount:93.33,freq:"trimestral"},anual:93.33*4},
];
for(const k of casos) test(`P2-b ${k.name}`,()=>{
  assert.equal(cent(c.billsAnualDe(k.e,M,Y)),cent(k.anual));
  assert.equal(cent(c.billsAnualDe(k.e,M,Y)),cent(oraculo(k.e)),"cuadra con el calendario");
});

test("P2-b semanal: cada mes pausado quita su media",()=>{
  const e={amount:12.5,freq:"semana",pausedFrom:YM,pausedUntil:YM+2};
  assert.equal(cent(c.billsAnualDe(e,M,Y)),cent(c.fixedMonthlyOf(e)*10));
});

test("las filas llevan su año y la sección lo suma: mes, año y secciones cuadran",()=>{
  const s={fixed:casos.map((k,i)=>Object.assign({id:"f"+i,name:"r"+i},k.e)),
    debts:[{id:"d",name:"Coche",monthly:200,value:3000,asOf:YM-1}]};
  const serv=c.billsGroupRows(s,"serv",M,Y), debt=c.billsGroupRows(s,"debt",M,Y);
  assert.equal(cent(serv.reduce((a,r)=>a+r.anual,0)),cent(casos.reduce((a,k)=>a+k.anual,0)));
  const mes=serv.reduce((a,r)=>a+(r.paused?0:r.monthly),0)+debt.reduce((a,r)=>a+r.monthly,0);
  assert.equal(cent(c.billsHeroTotal(s,null,M,Y)),cent(mes));
});

test("P2-a: la rama con `totals` (la del simulador) da la misma cifra que la cabecera",()=>{
  const s={fixed:[{id:"a",amount:850,freq:"mes"},{id:"g",amount:39.9,freq:"mes",pausedFrom:YM+1,pausedUntil:YM+3},
    {id:"q",amount:30,freq:"trimestral",pausedFrom:YM,pausedUntil:YM+2}],
    debts:[{id:"h",name:"Hipoteca",monthly:660.85,value:120000,asOf:YM-1}]};
  // Lo que pone `totals.fijosMensual` en 11-app-main: todos los recibos (pausados incluidos) más cuotas.
  const fijosMensual=s.fixed.reduce((a,e)=>a+c.fixedMonthlyOf(e),0)+660.85;
  const sinTotals=c.billsHeroTotal(s,null,M,Y), conTotals=c.billsHeroTotal(s,{fijosMensual},M,Y);
  assert.equal(cent(conTotals),cent(sinTotals));
  assert.equal(cent(sinTotals),cent(850+660.85));
});

test("P2-a: el simulador parte de `billsHeroTotal`, no de `totals.fijosMensual`",()=>{
  const src=read("src/modules/08-motor-bank.js");
  const sim=src.slice(src.indexOf("function AffordSim("),src.indexOf("\nfunction ",src.indexOf("function AffordSim(")+1));
  assert.match(sim,/billsHeroTotal\(state,totals,totals\.curMonth,totals\.curYear\)/);
  assert.doesNotMatch(sim,/\(totals\.fijosMensual\|\|0\)/,"ni en el margen ni en «tus fijos pasarían de»");
});

/* Cuotas y «Lo descuento» (revisión 219). Las deudas se miran contra el reloj de verdad (`debtActive`
   y el saldo leen hoy), así que estos casos usan el mes actual y no octubre de 2026. */
const hoy=new Date(), HM=hoy.getMonth()+1, HY=hoy.getFullYear(), HYM=HY*12+HM, H0=HYM-1;
// Oráculo de una deuda: mes a mes, la cuota mientras se cobra y, encima, lo que se le descuenta
// de cada recibo que ese mes no está en pausa.
const oraculoDeuda=(s,d,cuotas)=>{
  let a=0;
  for(let i=0;i<cuotas;i++){
    const m=(HM-1+i)%12+1, y=HY+Math.floor((HM-1+i)/12), ym=y*12+m;
    a+=d.monthly;
    for(const e of s.fixed){
      const pausa=Number(e.pausedUntil)>0&&ym>=(Number(e.pausedFrom)||0)&&ym<Number(e.pausedUntil);
      if(!pausa) for(const x of e.reparto||[]) if(x.via==="debt"&&x.debtId===d.id) a+=x.amt;
    }
  }
  return a;
};

test("P2-1: al año una financiación cuenta solo las cuotas que le quedan",()=>{
  const d={id:"m",name:"Móvil",monthly:200,value:600,months:3,asOf:H0};
  const s={fixed:[],debts:[d]};
  assert.equal(c.billsCuotasEnAno(d,HM,HY),3);
  const fila=c.billsGroupRows(s,"debt",HM,HY)[0];
  assert.equal(cent(fila.monthly),20000);
  assert.equal(cent(fila.anual),cent(oraculoDeuda(s,d,3)));
  assert.equal(cent(fila.anual),60000);
  // Una que acaba de empezar con 24 cuotas: las doce.
  assert.equal(cent(c.billsCuotaAnualDe({fixed:[]},{id:"x",monthly:100,value:2400,months:24,asOf:H0},HM,HY)),120000);
});

test("P2-1: una deuda sin plazo acaba cuando su saldo llega a cero",()=>{
  const d={id:"p",name:"Préstamo",monthly:200,value:500,asOf:H0};
  assert.equal(c.billsCuotasEnAno(d,HM,HY),3,"500 € a 200 € al mes: tres cuotas");
  assert.equal(cent(c.billsCuotaAnualDe({fixed:[]},d,HM,HY)),60000);
  assert.equal(c.billsCuotasEnAno({id:"h",monthly:660.85,value:120000,asOf:H0},HM,HY),12);
});

test("P2-5: lo que se descuenta a una deuda desde un recibo pausado no suma, al mes ni en los meses de la pausa",()=>{
  const mama={id:"mama",name:"Mamá",monthly:197,amort:250,value:5000,asOf:H0};
  const pepe={id:"pepe",name:"Pepephone",amount:22,freq:"mes",bankAmount:85,reparto:[
    {id:"pf",n:"Familia",via:"debt",debtId:"mama",amt:53},{id:"pp",n:"Pareja",via:"bizum",amt:10}],pausedFrom:HYM,pausedUntil:HYM+2};
  const s={fixed:[pepe],debts:[mama]};
  const fila=c.billsGroupRows(s,"debt",HM,HY)[0];
  // Sin la pausa serían 197 + 53; con el recibo pausado este mes, solo la cuota.
  assert.equal(cent(fila.monthly),19700);
  assert.equal(cent(fila.descuento),0);
  assert.equal(cent(c.billsHeroTotal(s,null,HM,HY)),19700);
  const fijosMensual=c.fixedMonthlyOf(pepe)+197;
  assert.equal(cent(c.billsHeroTotal(s,{fijosMensual},HM,HY)),19700,"la rama del simulador igual");
  // Al año: doce cuotas y diez meses de descuento (los dos de la pausa, fuera).
  assert.equal(cent(fila.anual),cent(oraculoDeuda(s,mama,12)));
  assert.equal(cent(fila.anual),cent(197*12+53*10));
  // Sin pausa, el descuento vuelve dentro de la cuota.
  const libre=Object.assign({},pepe,{pausedFrom:undefined,pausedUntil:undefined});
  assert.equal(cent(c.billsGroupRows({fixed:[libre],debts:[mama]},"debt",HM,HY)[0].monthly),25000);
  // Y mes, año y secciones cuadran: cabecera = recibos + cuotas, al mes y al año.
  const serv=c.billsGroupRows(s,"serv",HM,HY);
  assert.equal(cent(serv.reduce((a,r)=>a+(r.paused?0:r.monthly),0)+fila.monthly),cent(c.billsHeroTotal(s,null,HM,HY)));
  assert.equal(cent(serv[0].anual),cent(22*10));
});
