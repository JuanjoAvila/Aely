// Ronda 238 (revisión de dinero 237, R2): dos cuentas de recibos del MISMO banco multiplicaban lo ya
// cobrado del mes. `insumosSaldoGasto` sumaba `monthNetForAccount(ent)` una vez por cuenta y cada
// cuenta pintaba `value + paidNetByBank[ent]`: un Teléfono de 30 € bajaba 120 € el «Tienes hoy» del
// banco (1.500 → 1.380). Ahora el neto del banco lo carga UNA cuenta (`cuentaDelNetoDeBanco`) y
// pintar, re-anclar, cambiar de rol, reordenar, borrar y cerrar el mes eligen la misma.
// Se siembran dos cuentas de Sabadell, otro banco de recibos (CaixaBank) y uno de gasto diario.
// Datos inventados; reloj del 16/11/2026. Corre también con TZ=UTC.
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

const cuentas=()=>[
  {id:"sb1",ent:"sabadell",name:"Corriente",role:"fijos",value:1000},
  {id:"sb2",ent:"sabadell",name:"Ahorro",role:"fijos",value:500},
  {id:"cx",ent:"caixabank",name:"Nómina",role:"fijos",value:800},
  {id:"rv",ent:"revolut",name:"Diaria",role:"diario",value:300,spendFrom:true}];
// Teléfono del 8 sin cobro en el extracto: a mano, el calendario ya lo da por restado.
const tel={id:"tel",name:"Teléfono",amount:30,day:8,account:"sabadell",freq:"mes"};
const seg={id:"seg",name:"Seguro",amount:150,day:20,account:"sabadell",freq:"mes"};
const alq={id:"alq",name:"Alquiler",amount:650,day:1,account:"caixabank",freq:"mes"};
const luz={id:"luz",name:"Luz",amount:40,day:25,account:"caixabank",freq:"mes"};
const estado=p=>Object.assign({accounts:cuentas(),fixed:[tel,seg,alq,luz],debts:[],bankTx:[],expenses:[],oneoffs:[],flows:[],
  goals:[],deleted:[],investments:[],assets:[],aportaciones:[],obAccounts:[],settings:{expenseBanks:["revolut"]},_dynBalAnchored:true},p);
const pintado=s=>{ const i=c.insumosSaldoGasto(s),o={}; s.accounts.forEach(a=>{ o[a.id]=cents(c.saldoCuentaMostrada(a,i)); }); return o; };
const plan=s=>{
  const T=totalsDe(s,"2026-11-16"),pack=c.planChargesMonth(s,M,Y,HOY),bancos={};
  c.planRecibosBancos(T,pack,null).forEach(b=>{ bancos[b.bank]={bal:cents(b.bal),min:cents(b.min)}; });
  return {T,bancos,llega:json(c.planRecibosLlega(T,pack))};
};

test("Cartera: el Teléfono de 30 € se resta UNA vez, en la cuenta que carga el banco",()=>{
  const s=estado();
  assert.deepEqual(pintado(s),{sb1:97000,sb2:50000,cx:15000,rv:30000});
  const i=c.insumosSaldoGasto(s);
  assert.deepEqual(json(i.paidNetByBank),{sabadell:-30,caixabank:-650},"un término por banco, no por cuenta");
  // Segunda vía: lo guardado menos lo cobrado del mes, contado una vez por banco.
  assert.equal(cents(1000+500-30),pintado(s).sb1+pintado(s).sb2);
});

test("«Tienes hoy», «¿Te llega?», la píldora y el widget dicen lo mismo que Cartera",()=>{
  const s=estado(),{T,bancos,llega}=plan(s),p=pintado(s);
  assert.equal(cents(T.bankBal.sabadell),p.sb1+p.sb2,"Tienes hoy = suma de las cuentas de Cartera");
  assert.equal(cents(T.bankBal.caixabank),p.cx);
  assert.deepEqual(bancos.sabadell,{bal:147000,min:132000},"1.470 − Seguro 150");
  assert.deepEqual(bancos.caixabank,{bal:15000,min:11000},"150 − Luz 40");
  assert.equal(cents(T.minByBank.sabadell),132000,"el mínimo que leen la píldora y el widget");
  assert.equal(cents(T.minByBank.caixabank),11000);
  assert.equal(llega.ok,true);
});

test("el orden manda solo en quién lo carga: al revés, la otra cuenta lo lleva y el banco suma igual",()=>{
  const s=estado({accounts:[cuentas()[1],cuentas()[0],cuentas()[2],cuentas()[3]]});
  assert.deepEqual(pintado(s),{sb2:47000,sb1:100000,cx:15000,rv:30000});
  assert.deepEqual(plan(s).bancos.sabadell,{bal:147000,min:132000});
});

test("con lectura del banco: tras re-anclar cada cuenta enseña lo que dice su banco",()=>{
  const acc=cuentas();acc[0].bankIban="ES00SINTETICA0001";acc[1].bankIban="ES00SINTETICA0002";
  const s=estado({accounts:acc});
  const links=[{aspsp:"Banco Sabadell",ok:true,accounts:[
    {uid:"u1",iban:"ES00SINTETICA0001",balances:[{balanceType:"CLBD",balanceAmount:{amount:"970.00",currency:"EUR"}}]},
    {uid:"u2",iban:"ES00SINTETICA0002",balances:[{balanceType:"CLBD",balanceAmount:{amount:"500.00",currency:"EUR"}}]}]}];
  const next=c.applyBankBalances(s,links).state,p=pintado(next);
  assert.equal(p.sb1,97000,"la que carga el neto: base 1.000, pinta 970");
  assert.equal(p.sb2,50000,"la hermana, tal cual (antes 470)");
  assert.equal(next.accounts[0].value,1000);assert.equal(next.accounts[1].value,500);
  const {bancos,T}=plan(next);
  assert.equal(bancos.sabadell.bal,147000);
  assert.equal(cents(T.minByBank.sabadell),bancos.sabadell.min);
  assert.ok(bancos.sabadell.min<=147000-15000,"el Seguro del 20 sigue pendiente");
});

test("cambiar de rol la que carga el neto: la hermana lo hereda y ninguna salta",()=>{
  const s=estado(),antes=pintado(s),T=totalsDe(s,"2026-11-16");
  const next=c.applyAccountRole(s,T,"sb1","ambos");
  assert.deepEqual(pintado(next),antes,"ambos sigue cargándolo");
  // sb2 → diario: rv pasa a recibos (solo hay una diaria) y nadie del banco cambia de saldo.
  const n2=c.applyAccountRole(s,T,"sb2","diario");
  assert.deepEqual(pintado(n2),antes);
  // Reordenar sobre un estado ya ordenado a mano: sb1 deja de ser de recibos, sb2 lo hereda.
  const s3=estado({accounts:[cuentas()[0],cuentas()[1],cuentas()[2],Object.assign(cuentas()[3],{role:"fijos",spendFrom:false})]});
  const n3=c.applyAccountRole(s3,totalsDe(s3,"2026-11-16"),"sb1","diario");
  assert.deepEqual(pintado(n3),pintado(s3));
});

test("reordenar o borrar una de las dos no mueve el saldo de la que queda",()=>{
  const s=estado(),antes=pintado(s);
  const mov=c.moveAccountInList(s,"sb2","sb1");
  assert.deepEqual(mov.accounts.map(a=>a.id).slice(0,2),["sb2","sb1"]);
  assert.deepEqual(pintado(mov),antes);
  const sin=c.conservaNetoDeBanco(s,Object.assign({},s,{accounts:s.accounts.filter(a=>a.id!=="sb1")}));
  assert.equal(pintado(sin).sb2,antes.sb2,"la Ahorro hereda el neto sin bajar 30");
});

test("cierre de mes: el neto de octubre se arrastra una sola vez por banco",()=>{
  const s=estado({trAnchor:"2026-10"});
  const valores=a=>Object.fromEntries(a.map(x=>[x.id,cents(x.value)]));
  const out=c.reconcileTR(json(s));
  const v=valores(out.accounts);
  // Octubre entero: Teléfono 30 + Seguro 150 de Sabadell, Alquiler 650 + Luz 40 de CaixaBank.
  assert.equal(v.sb1+v.sb2,cents(1500-180),"antes 1.140: los 180 dos veces");
  assert.equal(v.sb2,50000);
  assert.equal(v.cx,cents(800-690));
});

test("una sola cuenta por banco: igual que siempre",()=>{
  const s=estado({accounts:[cuentas()[0],cuentas()[2],cuentas()[3]]});
  assert.deepEqual(pintado(s),{sb1:97000,cx:15000,rv:30000});
  assert.deepEqual(plan(s).bancos.sabadell,{bal:97000,min:82000});
});
