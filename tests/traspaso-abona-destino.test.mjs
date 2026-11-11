// UN TRASPASO ENTRE BANCOS PROPIOS SUMA EN EL QUE LO RECIBE (auditoría de Recibos, P1-12).
// Antes restaba en el origen y no sumaba en ningún sitio: «¿Te llega?» decía que en Revolut lo más
// justo eran 173,04 € (217 − 43,96) con 200 € de camino el día 15.
// Las cifras de abajo están hechas A MANO, no con el motor. Banco a banco:
//   Sabadell 1.000 → día 15 sale el traspaso (800) → día 20 recibo de 100 (700).
//   Revolut    217 → día 15 llega el traspaso (417) → día 17 recibo de 43,96 (373,04).
//   Suma a fin de mes: 1.073,04 = 1.217 − 143,96, con traspaso o sin él.
// Se mira en los tres sitios que tienen que decir lo mismo (saldo, previsto y recorrido) antes y
// después del día 15: el primer intento sumaba solo en el recorrido y la cifra saltaba al pasar el día.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadPureLogic } from "../scripts/load-pure-logic.mjs";

const source=file=>fs.readFileSync(new URL("../"+file,import.meta.url),"utf8");
const order=JSON.parse(source("src/build-order.json"));
const c=loadPureLogic(source("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>order.map(f=>source("src/modules/"+f)).join("\n")));
// Mediodía: el mismo día de calendario en Madrid y en la CI, que corre en UTC.
const reloj={dia:10};
const ahora=()=>Date.parse("2026-11-"+String(reloj.dia).padStart(2,"0")+"T12:00:00Z");
c.Date=class extends Date{ constructor(...a){ super(...(a.length?a:[ahora()])); } static now(){ return ahora(); } };
const main=source("src/modules/11-app-main.js").replaceAll("\r\n","\n");
const ini=main.indexOf("const totals=useMemo(()=>{"), fin=main.indexOf("\n\n  const budgetMonth=",ini);
assert.ok(ini>=0&&fin>ini,"callback real de totals");
const totalsDe=vm.runInNewContext("(function(state,calendarDay){"+main.slice(ini,fin)+";return totals;})",c);

const y=2026, m=11, cent=n=>Math.round(n*100)||0, copia=x=>JSON.parse(JSON.stringify(x));
const TRAS={id:"tras",kind:"transfer",name:"A Revolut",amount:200,from:"sabadell",to:"revolut",day:15};
const estado=(cambios={})=>copia(Object.assign({
  accounts:[{id:"sab",ent:"sabadell",role:"fijos",value:1000},{id:"rev",ent:"revolut",role:"fijos",value:217}],
  fixed:[{id:"luz",name:"Luz",amount:100,freq:"mes",day:20,account:"sabadell"},
    {id:"gim",name:"Gimnasio",amount:43.96,freq:"mes",day:17,account:"revolut"}],
  flows:[TRAS], trasAbonoDesde:20261101,
  bankTx:[],expenses:[],debts:[],oneoffs:[],deleted:[],investments:[],assets:[],aportaciones:[],obAccounts:[],settings:{}
},cambios));
// Lo que se enseña de un banco: saldo de hoy, lo más justo del recorrido y el previsto a fin de mes.
function foto(s,dia){
  reloj.dia=dia;
  const t=totalsDe(s,"2026-11-"+dia), de=b=>({hoy:cent(t.bankBal[b]),justo:cent(t.minByBank[b]),fin:cent(t.projectedByBank[b])});
  // El recorrido entero acaba en el previsto: si no, «¿Te llega?» y la ficha de la cuenta se contradicen.
  ["sabadell","revolut"].forEach(b=>assert.equal(cent(c.minWalk(t.bankBal[b],c.bankPendingEvents(s,b,y,m,dia)).end),cent(t.projectedByBank[b]),b+": recorrido = previsto (día "+dia+")"));
  return {sabadell:de("sabadell"),revolut:de("revolut")};
}
let n=0;
function caso(nombre,fn){ fn(); n++; console.log("PASS "+nombre); }

caso("el día 10 el traspaso está de camino: resta en Sabadell y suma en Revolut",()=>{
  assert.deepEqual(foto(estado(),10),{sabadell:{hoy:100000,justo:70000,fin:70000},revolut:{hoy:21700,justo:21700,fin:37304}});
});
caso("el día 16 ya se ha hecho: los saldos se mueven y el previsto no cambia ni un céntimo",()=>{
  assert.deepEqual(foto(estado(),16),{sabadell:{hoy:80000,justo:70000,fin:70000},revolut:{hoy:41700,justo:37304,fin:37304}});
});
caso("el total no cambia por mover dinero entre bancos propios",()=>{
  [10,15,16].forEach(dia=>{
    const con=foto(estado(),dia), sin=foto(estado({flows:[]}),dia);
    assert.equal(con.sabadell.fin+con.revolut.fin,107304,"día "+dia);
    assert.equal(sin.sabadell.fin+sin.revolut.fin,107304,"día "+dia+", sin traspaso");
    assert.equal(con.sabadell.hoy+con.revolut.hoy,121700,"día "+dia+", hoy");
  });
});
caso("al cerrar el mes cada banco arrastra su lado",()=>{
  const s=estado();
  assert.equal(cent(c.monthNetForAccount(s,"sabadell",y,m,null)),-30000);
  assert.equal(cent(c.monthNetForAccount(s,"revolut",y,m,null)),15604);
});
caso("a un banco que no es tuyo es una salida: no suma en ningún sitio",()=>{
  const s=estado({flows:[Object.assign({},TRAS,{to:"bbva"})]});
  assert.deepEqual(foto(s,10),{sabadell:{hoy:100000,justo:70000,fin:70000},revolut:{hoy:21700,justo:17304,fin:17304}});
  assert.equal(c.bankPendingEvents(s,"bbva",y,m,10).length,0);
  assert.equal(totalsDe(s,"2026-11-10").projectedByBank.bbva,undefined);
});
caso("sin día sale al principio y llega al final: lo más justo no cuenta con él",()=>{
  const s=estado({flows:[Object.assign({},TRAS,{day:undefined})]});
  assert.deepEqual(foto(s,10),{sabadell:{hoy:100000,justo:70000,fin:70000},revolut:{hoy:21700,justo:17304,fin:37304}});
});
caso("el sello: lo de ese día o antes no abona; sin sello, nada",()=>{
  // Cartera que recibe la regla el día 15, con el traspaso de ese día ya restado en el origen.
  const mismoDia=estado({trasAbonoDesde:20261115});
  assert.deepEqual(foto(mismoDia,16).revolut,{hoy:21700,justo:17304,fin:17304});
  assert.equal(cent(c.monthNetForAccount(mismoDia,"revolut",y,m,null)),-4396);
  assert.deepEqual(foto(estado({trasAbonoDesde:20261114}),16).revolut,{hoy:41700,justo:37304,fin:37304});
  const sin=estado(); delete sin.trasAbonoDesde;
  assert.deepEqual(foto(sin,10).revolut,{hoy:21700,justo:17304,fin:17304});
  assert.deepEqual(foto(sin,16).revolut,{hoy:21700,justo:17304,fin:17304});
  // El de diciembre sí abona con cualquiera de los sellos de noviembre.
  assert.equal(cent(c.monthNetForAccount(mismoDia,"revolut",y,12,null)),15604);
});
caso("sellarAbonoTraspasos pone el día de hoy una sola vez",()=>{
  reloj.dia=10;
  const s=c.sellarAbonoTraspasos({accounts:[]});
  assert.equal(s.trasAbonoDesde,20261110);
  reloj.dia=12;
  assert.equal(c.sellarAbonoTraspasos(s),s);
});
caso("la cuenta de gasto diario no abona por aquí (ni con recarga mensual ni sin ella)",()=>{
  const diaria=estado(); diaria.accounts[1]={id:"rev",ent:"revolut",role:"diario",value:217};
  assert.equal(c.flowAbonaEn(diaria,TRAS,y,m),null);
  const recarga=estado(); recarga.accounts[1]={id:"rev",ent:"revolut",role:"ambos",spendFrom:true,inject:200,value:217};
  assert.equal(c.flowAbonaEn(recarga,TRAS,y,m),null);
  assert.equal(c.flowAbonaEn(estado(),TRAS,y,m),"revolut");
  assert.equal(c.flowAbonaEn(estado(),Object.assign({},TRAS,{to:"sabadell"}),y,m),null);
  assert.equal(c.flowAbonaEn(estado(),Object.assign({},TRAS,{kind:"income"}),y,m),null);
});
caso("llegó antes de su día y el banco que lo recibe ya lo trae: no se suma dos veces",()=>{
  // Revolut leído con los 200 € dentro (417) el día 9; el traspaso estaba previsto para el 15.
  const s=estado({bankTx:[{id:"abono",ent:"revolut",date:"2026-11-09",amount:-200,merchant:"TRANSFERENCIA RECIBIDA",status:"BOOK"}]});
  s.accounts[1].value=417;
  assert.deepEqual(foto(s,10),{sabadell:{hoy:100000,justo:70000,fin:70000},revolut:{hoy:41700,justo:37304,fin:37304}});
  // Al sincronizar se guarda el día real y el saldo pintado no se mueve, ni ese día ni al pasar el 15.
  reloj.dia=10;
  const anclado=c.reconcileEarlyIncomeAnchors(s,y,m,10);
  assert.equal(anclado.flows[0].paidDay,9);
  assert.equal(anclado.accounts[1].value,217,"la base baja lo que ya cuenta el traspaso");
  assert.equal(anclado.accounts[0].value,1000,"el origen no se toca");
  const sinExtracto=Object.assign({},anclado,{bankTx:[]});   // otro móvil: el extracto no viaja
  [anclado,sinExtracto].forEach(x=>{
    assert.deepEqual(foto(x,10),{sabadell:{hoy:100000,justo:70000,fin:70000},revolut:{hoy:41700,justo:37304,fin:37304}});
    assert.deepEqual(foto(x,16),{sabadell:{hoy:80000,justo:70000,fin:70000},revolut:{hoy:41700,justo:37304,fin:37304}});
  });
  // La pata que sale sigue pendiente hasta su día: el extracto del destino no la da por hecha.
  assert.equal(c.flowPaidIn(anclado,anclado.flows[0],y,m,10),false);
  assert.equal(c.flowPaidIn(anclado,anclado.flows[0],y,m,15),true);
});
caso("con una nómina del mismo importe en ese banco el abono es ambiguo: nadie se lo apunta",()=>{
  const s=estado({bankTx:[{id:"abono",ent:"revolut",date:"2026-11-09",amount:-200,merchant:"TRANSFERENCIA RECIBIDA",status:"BOOK"}]});
  s.flows.push({id:"nom",kind:"income",name:"Paga",amount:200,to:"revolut",day:14});
  reloj.dia=10;
  assert.equal(c.reconcileEarlyIncomeAnchors(s,y,m,10),s);
  assert.equal(c.flowLlegoIn(s,s.flows[0],y,m,10),false);
});
console.log("traspaso-abona-destino: "+n+" casos");
