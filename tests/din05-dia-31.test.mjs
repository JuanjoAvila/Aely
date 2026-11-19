import assert from "node:assert/strict";
import fs from "node:fs";
import {loadPureLogic} from "../scripts/load-pure-logic.mjs";
const read=f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8");
const js=JSON.parse(read("src/build-order.json")).map(f=>read("src/modules/"+f)).join("\n");
const c=loadPureLogic(read("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>js));

/* DÍA 31 EN UN MES DE 30 (DIN-05). `dayIn` ya recortaba los recibos al último día del mes, pero las
   cuotas de deuda (`debtChargeDay`, `debtPaymentState`) y las nóminas/traspasos (`flowDay`) no: una
   hipoteca del 31 no vencía en todo noviembre, el saldo no la restaba hasta cerrar el mes y «¿Te
   llega?» la seguía esperando. Se comprueba por dos vías: lo que resta el saldo del banco
   (`monthNetForAccount`) y lo que aún espera el recorrido (`pendingWalkEvents`) tienen que sumar la
   cuota UNA vez, ni cero ni dos. Importes inventados. */
const [hy,hm]=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Madrid"}).format(new Date()).split("-").map(Number);
const ahora=hy*12+hm-1;
let total=0,fallos=0;
function test(name,fn){ try{ fn();total++;console.log("✓ "+name); }catch(e){ fallos++;console.log("✗ "+name+"\n  "+String(e.message).split("\n")[0]); } }

// Deuda sin plazo, anclada en el mes actual (activa, cuota entera): solo importa su día.
const deuda=(o)=>Object.assign({id:"h31",name:"Hipoteca sintética",day:31,account:"sabadell",value:5000,monthly:100,asOf:ahora},o);
const estado=(o)=>Object.assign({fixed:[],debts:[deuda()],oneoffs:[],flows:[],expenses:[],accounts:[],bankTx:[]},o);
const cts=x=>Math.round(x*100)+0; // +0: un −0 no es 0 para el assert estricto

test("diaDelMes: 31 es el 30 en noviembre, el 28 en febrero y sigue 31 en diciembre",()=>{
  assert.equal(c.diaDelMes(31,2026,11),30);
  assert.equal(c.diaDelMes(31,2027,2),28);
  assert.equal(c.diaDelMes(30,2028,2),29,"bisiesto");
  assert.equal(c.diaDelMes(31,2026,12),31);
  assert.equal(c.diaDelMes(15,2026,11),15);
  assert.equal(c.diaDelMes(null,2026,11),null);
  assert.equal(c.diaDelMes(31,null,11),31,"sin año no se toca");
});

test("la cuota del 31 vence el 30 de noviembre",()=>{
  const d=deuda();
  assert.equal(c.debtChargeDay(d,2026,11),30);
  assert.equal(c.debtChargeDay(d),31,"sin mes, el guardado (la ficha lo edita tal cual)");
  assert.equal(c.isDebtPaidThisMonth(d,30,estado(),2026,11),true);
  assert.equal(c.isDebtPaidThisMonth(d,29,estado(),2026,11),false);
  assert.equal(c.debtPaymentState(estado(),d,2026,11,30).paid,true);
});

test("nómina del 31: llega el 30 de noviembre y el 28 de febrero",()=>{
  assert.equal(c.flowDay({kind:"income",day:31},2026,11),30);
  assert.equal(c.flowDay({kind:"income",day:31},2027,2),28);
  assert.equal(c.flowDay({kind:"income",day:31},2026,12),31);
});

test("dos vías: el 30 de noviembre el saldo resta la cuota y el recorrido ya no la espera",()=>{
  const s=estado(),q=c.debtCuotaIn(s.debts[0],2026,11);
  assert.ok(q>0,"la deuda cobra este mes");
  const restado=-c.monthNetForAccount(s,"sabadell",2026,11,30);
  const pendiente=c.pendingWalkEvents(s,2026,11,30).filter(ev=>ev.bank==="sabadell"&&ev.amt<0).reduce((a,ev)=>a-ev.amt,0);
  assert.equal(cts(restado),cts(q),"el saldo lleva la cuota");
  assert.equal(cts(pendiente),0,"y no se espera otra vez");
  assert.equal(cts(restado+pendiente),cts(q),"una sola vez entre las dos");
});

test("el 29 de noviembre aún no: el saldo no la resta y el recorrido sí la espera",()=>{
  const s=estado(),q=c.debtCuotaIn(s.debts[0],2026,11);
  assert.equal(cts(-c.monthNetForAccount(s,"sabadell",2026,11,29)),0);
  const pendiente=c.pendingWalkEvents(s,2026,11,29).filter(ev=>ev.bank==="sabadell"&&ev.amt<0).reduce((a,ev)=>a-ev.amt,0);
  assert.equal(cts(pendiente),cts(q));
});

test("nómina y traspaso del 31: el 30 de noviembre ya están en el saldo, el 29 no",()=>{
  const s=estado({debts:[],flows:[{id:"n",kind:"income",to:"sabadell",amount:1500,day:31},{id:"t",kind:"transfer",from:"sabadell",to:"otro",amount:200,day:31}]});
  assert.equal(cts(c.monthNetForAccount(s,"sabadell",2026,11,30)),130000);
  assert.equal(cts(c.monthNetForAccount(s,"sabadell",2026,11,29)),0);
  assert.equal(cts(c.monthNetForAccount(s,"sabadell",2026,12,30)),0,"en diciembre sigue siendo el 31");
});

console.log(`\n${total} OK, ${fallos} fallos`);
if(fallos) process.exit(1);
