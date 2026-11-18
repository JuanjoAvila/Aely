// Ronda 240 (P3 de las revisiones de dinero 237 y 238): cuatro sitios donde una cifra de saldo no
// pasaba por la misma regla que la que se pinta.
//   1. Justo tras sincronizar, una cuenta «ambos» pintaba el banco MÁS lo marcado como posible
//      repetido: el ancla lo contaba y el pintado no (1.321,69 con el banco en 1.273,69, 48 €).
//   2. Lo mismo con su redondeo de TR, que el ancla estimaba sobre esa misma lista.
//      (Y el cierre de mes, que también lo restaba: el día 1 el saldo bajaba de golpe.)
//   3. «¿Te llega?» decidía si un recibo ya estaba restado con la lectura MÁS VIEJA del banco, no
//      con la de la cuenta que carga sus recibos.
//   4. La foto de Hogar ponía en cada cuenta el total de su banco: con dos, el banco salía doble.
// Siempre dos bancos sembrados. Datos inventados. Corre también con TZ=UTC.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import { loadPureLogic } from "../scripts/load-pure-logic.mjs";

const read=f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8");
const order=JSON.parse(read("src/build-order.json"));
const c=loadPureLogic(read("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>order.map(f=>read("src/modules/"+f)).join("\n")));
vm.runInNewContext(read("src/modules/14-v4-screens.js"),c);
// La foto de Hogar no entra en la lógica pura: su función, sola, como `fin04-plan-three-way`.
{ const h=read("src/modules/13-hogar.js"),i=h.indexOf("function buildHouseholdSnapshot("),f=h.indexOf("\nfunction mergeHouseholdSnapshots",i);
  assert(i>=0&&f>i,"función real de la foto"); vm.runInContext(h.slice(i,f),c); }
const reloj={t:0};
c.Date=class extends Date { constructor(...a){ super(...(a.length?a:[reloj.t])); } static now(){ return reloj.t; } };
const main=read("src/modules/11-app-main.js").replaceAll("\r\n","\n"),ini=main.indexOf("const totals=useMemo(()=>{"),fin=main.indexOf("\n\n  const budgetMonth=",ini);
assert(ini>=0&&fin>ini,"callback real de totals");
const totalsDe=vm.runInNewContext("(function(state,calendarDay){"+main.slice(ini,fin)+";return totals;})",c);
const cents=n=>Math.round(n*100);
const json=x=>JSON.parse(JSON.stringify(x));
const pintado=s=>{ const i=c.insumosSaldoGasto(s),o={}; s.accounts.forEach(a=>{ o[a.id]=cents(c.saldoCuentaMostrada(a,i)); }); return o; };
const vacio={debts:[],bankTx:[],oneoffs:[],flows:[],goals:[],deleted:[],investments:[],assets:[],aportaciones:[],obAccounts:[],_dynBalAnchored:true,_netoUnaCuenta:true};
const enlace=(aspsp,uid,amount)=>({aspsp,ok:true,accounts:[{uid,ok:true,balances:[{type:"ITAV",amount,currency:"EUR"}],transactions:[]}]});

// ---------- 1 y 2: el ancla y el cierre con la misma puerta que el pintado ----------
// La forma del caso de la revisión 237: día 31, recibos en BBVA (una «ambos»), un trimestral de
// 48 € cobrado el 15 con su aviso del móvil, y el cargo del banco sin nombre que casa con ese aviso
// marcado como posible repetido. Además una compra con tarjeta también marcada (su redondeo, ×1).
// Otro banco (ING) con una cuenta de recibos.
const OCT31=new Date(2026,9,31,18).getTime();
const casoAmbos=()=>Object.assign({},json(vacio),{
  accounts:[{id:"a",ent:"bbva",role:"ambos",spendFrom:true,value:3000,roundup:1},{id:"b",ent:"ing",role:"fijos",value:900}],
  settings:{expenseBanks:[]},trAnchor:"2026-10",budget:800,
  fixed:[{id:"bas",name:"Basuras",amount:48,day:15,account:"bbva",freq:"trimestral"},{id:"gim",name:"Gimnasio",amount:34.9,day:15,account:"bbva",freq:"mes"},
    {id:"tel",name:"Teléfono",amount:25,day:1,account:"ing",freq:"mes"}],
  expenses:[
    {id:"w1",date:"2026-10-15T07:30:00.000Z",merchant:"Basuras",amount:48,category:"otros",source:"manual",ent:"bbva"},
    {id:"o1",date:"2026-10-15T10:00:00.000Z",merchant:"",amount:48,category:"otros",source:"ob",ent:"bbva",possibleDup:true},
    {id:"o2",date:"2026-10-22T10:00:00.000Z",merchant:"CARREFOUR",amount:12.3,category:"super",source:"ob",ent:"bbva"},
    {id:"o3",date:"2026-10-22T10:00:00.000Z",merchant:"",amount:12.3,category:"super",source:"ob",ent:"bbva",possibleDup:true}]});

test("tras sincronizar, cada cuenta pinta lo que dice su banco aunque haya posibles repetidos",()=>{
  reloj.t=OCT31;
  const s0=casoAmbos();
  const s=c.applyBankBalances(s0,[enlace("BBVA","bbva",1273.69),enlace("ING","ing",880)]).state;
  // Antes: 1.321,69 + el redondeo de la compra repetida (0,70).
  assert.deepEqual(pintado(s),{a:127369,b:88000});
  // El total del banco que leen «Tienes hoy», «¿Te llega?» y el widget, igual.
  const T=totalsDe(s,"2026-10-31");
  assert.deepEqual([cents(T.bankBal.bbva),cents(T.bankBal.ing)],[127369,88000]);
  // Y si él dice «son distintos», ese cargo pasa a restar como cualquier otro, con su redondeo
  // (48 → 1,00), hasta el siguiente sync.
  const distintos=json(s); distintos.expenses.find(e=>e.id==="o1").possibleDup=false;
  assert.equal(pintado(distintos).a,127369-4800-100);
});

test("el redondeo que ancla es el que se pinta: la compra marcada como posible repetido no redondea",()=>{
  reloj.t=OCT31;
  const s=c.applyBankBalances(casoAmbos(),[enlace("BBVA","bbva",1273.69),enlace("ING","ing",880)]).state;
  const i=c.insumosSaldoGasto(s);
  // Solo lo que cuenta: la compra de 12,30 (0,70) y el aviso de 48 (1,00). Antes 2,70: también
  // los dos posibles repetidos.
  assert.equal(cents(i.roundup),170);
  // La tarjeta de Cartera enseña el mismo redondeo que resta el saldo.
  assert.equal(cents(c.recompensasDelMes(s,s.accounts[0],+new Date(2026,9,1)).ru),170);
  // Lo que el ancla despeja es justo lo que el pintado vuelve a sumar.
  assert.equal(cents(c.valueDesdeSaldo({shown:1273.69,injTR:i.injTR,spentOwn:i.spentByBank.bbva,roundup:i.roundup,monthlyInvest:i.monthlyInvest,ambos:true,paidNet:c.paidNetDeCuenta(s.accounts[0],i.paidNetByBank)})),cents(s.accounts[0].value));
});

test("cierre de mes: el día 1 se pinta lo mismo que el 31, también con posibles repetidos",()=>{
  // Sin recibos para que el neto del mes no se mezcle, y sin redondeo: con movimientos del banco el
  // cierre no lo resta (`obFed`) y eso es otra cosa (ver la nota de la ronda 240).
  const s0=Object.assign(casoAmbos(),{fixed:[]}); s0.accounts[0].roundup=0;
  reloj.t=OCT31;
  const s=c.applyBankBalances(s0,[enlace("BBVA","bbva",1273.69),enlace("ING","ing",880)]).state;
  const el31=pintado(s);
  reloj.t=new Date(2026,10,1,9).getTime();
  const cerrado=c.reconcileTR(json(s));
  assert.equal(cerrado.trAnchor,"2026-11");
  // Antes bajaba 60,30 € el día 1: el cierre restaba los posibles repetidos que el pintado no.
  assert.deepEqual(pintado(cerrado),el31);
});

// ---------- 3: «¿Te llega?» con la lectura de la cuenta que lleva los recibos ----------
// Dos cuentas de Sabadell (la primera carga el neto del banco) y CaixaBank con una sola. Teléfono
// de 30 € el día 8, vencido y sin cobro en el extracto; hoy es 16/11.
const NOV16=new Date(2026,10,16,12).getTime();
const casoLecturas=(leidaRecibos,leidaAhorro)=>Object.assign({},json(vacio),{
  accounts:[{id:"sb1",ent:"sabadell",name:"Corriente",role:"fijos",value:1000,saldoLeidoAt:leidaRecibos},
    {id:"sb2",ent:"sabadell",name:"Ahorro",role:"fijos",value:500,saldoLeidoAt:leidaAhorro},
    {id:"cx",ent:"caixabank",name:"Nómina",role:"fijos",value:800,saldoLeidoAt:"2026-11-16T08:00:00.000Z"},
    {id:"rv",ent:"revolut",name:"Diaria",role:"diario",value:300,spendFrom:true}],
  settings:{expenseBanks:["revolut"]},trAnchor:"2026-11",expenses:[],
  fixed:[{id:"tel",name:"Teléfono",amount:30,day:8,account:"sabadell",freq:"mes"},{id:"luz",name:"Luz",amount:40,day:10,account:"caixabank",freq:"mes"}]});
const yaRestado=(s,b)=>c.bankPendingEvents(s,b,2026,11,16).filter(ev=>ev.yaRestado).reduce((a,ev)=>a+cents(ev.amt),0);

test("la cuenta de recibos leída hoy y la de ahorro el día 1: el Teléfono sin cobrar se resta una vez",()=>{
  reloj.t=NOV16;
  // Leída hoy, el ancla ya absorbió el calendario: el saldo mostrado no lo resta y el recorrido sí.
  const s=casoLecturas("2026-11-16T08:00:00.000Z","2026-11-01T08:00:00.000Z");
  assert.equal(c.saldoLeidoDelBanco(s,"sabadell",c.cuentaDelNetoDeBanco(s.accounts,"sabadell")),Date.parse("2026-11-16T08:00:00.000Z"));
  assert.equal(c.saldoLeidoDelBanco(s,"sabadell"),Date.parse("2026-11-01T08:00:00.000Z"),"la frescura del total sigue siendo la más vieja");
  assert.equal(yaRestado(s,"sabadell"),0,"antes devolvía +30: el Teléfono no se restaba ninguna vez");
  const T=totalsDe(s,"2026-11-16");
  assert.equal(cents(T.minByBank.sabadell),cents(T.bankBal.sabadell)-3000);
});

test("al revés (la de recibos leída el día 1, la de ahorro hoy): sigue restándose una sola vez",()=>{
  reloj.t=NOV16;
  // Leída antes del día 8, el saldo mostrado ya restó el Teléfono por calendario: el recorrido lo
  // devuelve. Con «la más reciente» se restaba dos veces.
  const s=casoLecturas("2026-11-01T08:00:00.000Z","2026-11-16T08:00:00.000Z");
  assert.equal(yaRestado(s,"sabadell"),3000);
  const T=totalsDe(s,"2026-11-16");
  assert.equal(cents(T.minByBank.sabadell),cents(T.bankBal.sabadell));
  // El banco con una sola cuenta no cambia: leída hoy, la Luz del 10 se resta en el recorrido.
  assert.equal(yaRestado(s,"caixabank"),0);
  assert.equal(cents(T.minByBank.caixabank),cents(T.bankBal.caixabank)-4000);
});

// ---------- 4: la foto de Hogar, una vez por banco ----------
test("foto de Hogar: cada cuenta con su saldo y el banco una sola vez",()=>{
  reloj.t=NOV16;
  const s=casoLecturas("2026-11-16T08:00:00.000Z","2026-11-01T08:00:00.000Z");
  const T=totalsDe(s,"2026-11-16"), foto=c.buildHouseholdSnapshot(s,T,"a@b.c"), p=pintado(s);
  const porId={}; foto.accounts.forEach((a,k)=>{ porId[s.accounts[k].id]=cents(a.value); });
  assert.deepEqual(porId,p,"lo mismo que Cartera");
  const porBanco={}; foto.accounts.forEach(a=>{ porBanco[a.ent]=(porBanco[a.ent]||0)+cents(a.value); });
  // Antes Sabadell salía 2 × 1.470 = 2.940.
  Object.keys(T.bankBal).forEach(b=>assert.equal(porBanco[b],cents(T.bankBal[b]),b));
  // Sin `totals`, `value` a pelo, como antes.
  assert.deepEqual(Array.from(c.buildHouseholdSnapshot(s,{},"a@b.c").accounts,a=>a.value),[1000,500,800,300]);
});
