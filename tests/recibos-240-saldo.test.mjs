// Ronda 240: los cuatro restos de dinero de la revisión de la 237 en Plan › Recibos.
// H3) Cobrado ANTES de su día y leído por Open Banking: el día del recibo `paidNet` lo restaba otra
//     vez del saldo que ya lo llevaba (970 con 1.000 en el banco).
// H4) Recibo en espera al leer y cobrado después: «¿Te llega?» lo daba por dentro de lo leído y lo
//     restaba otra vez (mínimo 940 cuando lo justo es 970).
// R1) `yaRestado` (+X el día −1) solo con el día del recibo ya llegado.
// totals.pendingByBank con la regla del saldo (`fixedRestaDelSaldo`), no con `isPaidIn` a secas.
// Se siembran DOS bancos de recibos: Sabadell leído por Open Banking y CaixaBank a mano.
// Datos inventados; reloj de noviembre de 2026. Corre también con TZ=UTC.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import { loadPureLogic } from "../scripts/load-pure-logic.mjs";

const read=f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8");
const order=JSON.parse(read("src/build-order.json"));
const c=loadPureLogic(read("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>order.map(f=>read("src/modules/"+f)).join("\n")));
vm.runInNewContext(read("src/modules/14-v4-screens.js"),c);
let AHORA=0;
const reloj=dia=>{ AHORA=new Date(2026,10,dia,12).getTime(); };
c.Date=class extends Date { constructor(...a){ super(...(a.length?a:[AHORA])); } static now(){ return AHORA; } };
const Y=2026,M=11,YM=Y*12+M;
const main=read("src/modules/11-app-main.js").replaceAll("\r\n","\n"),ini=main.indexOf("const totals=useMemo(()=>{"),fin=main.indexOf("\n\n  const budgetMonth=",ini);
assert(ini>=0&&fin>ini,"callback real de totals");
const totalsDe=vm.runInNewContext("(function(state,calendarDay){"+main.slice(ini,fin)+";return totals;})",c);
const cents=n=>Math.round(n*100);
const json=x=>JSON.parse(JSON.stringify(x));

const tel={id:"tel",name:"Teléfono",amount:30,day:8,account:"sabadell",freq:"mes"};
const seg={id:"seg",name:"Seguro",amount:64.9,day:28,account:"caixabank",freq:"mes"};
const cuentas=()=>[
  {id:"sb",ent:"sabadell",name:"Cuenta Sintética",role:"fijos",value:1000,bankIban:"ES00SINTETICA0001"},
  {id:"cx",ent:"caixabank",name:"Cuenta Nómina",role:"fijos",value:500}];
const estado=p=>Object.assign({accounts:cuentas(),fixed:[tel,seg],debts:[],bankTx:[],expenses:[],oneoffs:[],flows:[],goals:[],deleted:[],
  investments:[],assets:[],aportaciones:[],obAccounts:[],settings:{},_dynBalAnchored:true,_netoUnaCuenta:true},p);
const cargoTel=fecha=>({id:"t-tel-"+fecha,ent:"sabadell",date:fecha,amount:30,merchant:"TELEFONO",concept:"RECIBO TELEFONO",status:"BOOK"});
const lectura=saldo=>[{aspsp:"Banco Sabadell",ok:true,accounts:[{uid:"u1",iban:"ES00SINTETICA0001",balances:[{type:"CLBD",amount:String(saldo),currency:"EUR"}]}]}];
const leidoEl=dia=>({"Banco Sabadell":new Date(2026,10,dia,9).toISOString()});
const pintado=s=>{ const i=c.insumosSaldoGasto(s),o={}; s.accounts.forEach(a=>{ o[a.id]=cents(c.saldoCuentaMostrada(a,i)); }); return o; };
const hoja=(s,dia)=>{
  const T=totalsDe(s,"2026-11-"+String(dia).padStart(2,"0")),pack=c.planChargesMonth(s,M,Y,dia),out={};
  c.planRecibosBancos(T,pack,null).forEach(b=>{ out[b.bank]={bal:cents(b.bal),sinRestar:cents(b.sinRestar),yaRestado:cents(b.yaRestado),min:cents(b.min)}; });
  return {out,T};
};

// ---------- H3 ----------

test("H3 · cobrado el 3 y leído el 4: el día 8 el saldo no lo resta otra vez (1.000, no 970)",()=>{
  reloj(4);
  const s=estado({bankTx:[cargoTel("2026-11-03")]});
  assert.equal(c.fixedPaymentState(s,tel,Y,M,4).paid,true,"el cargo del 3 paga el Teléfono");
  // La sincronización real: la lectura llega con el cargo dentro.
  const r=c.applyBankBalances(s,lectura(1000)),leido=Object.assign({},r.state,{obBalAt:leidoEl(4)});
  assert.equal(leido.accounts[0].cobrosEnSaldo,YM,"la cuenta se ancla con la regla nueva");
  assert.equal(pintado(leido).sb,100000,"justo tras leer, lo que dice el banco");
  for(const dia of [6,8,10,30]){
    reloj(dia);
    assert.equal(pintado(leido).sb,100000,"día "+dia);
    const T=totalsDe(leido,"2026-11-"+String(dia).padStart(2,"0"));
    assert.equal(cents(T.bankBal.sabadell),100000);assert.equal(cents(T.minByBank.sabadell),100000,"nada más que restar este mes");
    assert.equal(cents(T.pendingByBank.sabadell||0),0,"ni pendiente en el previsto");
  }
  // Sin un cobro así, la lectura ancla igual que antes y la cuenta no cambia de forma.
  reloj(4);
  const sinCobro=c.applyBankBalances(estado(),lectura(1000)).state;
  assert.equal(sinCobro.accounts[0].cobrosEnSaldo,undefined);assert.equal(sinCobro.accounts[0].value,1000);
  reloj(30);
  // El cierre del mes arrastra el neto entero: diciembre empieza con lo que había en el banco.
  assert.equal(cents(leido.accounts[0].value+c.monthNetForAccount(leido,"sabadell",Y,M,null)),100000);
  // El otro banco, a mano, ni se entera: su Seguro del 28 resta por calendario, como siempre.
  assert.equal(pintado(leido).cx,50000-6490);
  reloj(10);assert.equal(pintado(leido).cx,50000);
});

test("H3 · un saldo anclado antes de esta versión no se mueve al actualizar (sin sello, regla de antes)",()=>{
  reloj(6);
  const s=estado({bankTx:[cargoTel("2026-11-03")],obBalAt:leidoEl(4)});
  assert.equal(s.accounts[0].cobrosEnSaldo,undefined);
  assert.equal(pintado(s).sb,100000,"antes de su día, como ayer");
  // Sello de otro mes: tampoco (el `value` de noviembre no se ancló con él).
  const viejo=estado({bankTx:[cargoTel("2026-11-03")],accounts:[Object.assign(cuentas()[0],{cobrosEnSaldo:YM-1}),cuentas()[1]]});
  assert.equal(pintado(viejo).sb,100000);
});

test("H3 · en la cuenta a mano un cargo BOOK no adelanta el calendario (el extracto no es su saldo)",()=>{
  reloj(10);
  const cxTel=Object.assign({},tel,{id:"tel-cx",account:"caixabank",day:20});
  const s=estado({fixed:[cxTel,seg],bankTx:[Object.assign(cargoTel("2026-11-09"),{ent:"caixabank"})],
    accounts:[cuentas()[0],Object.assign(cuentas()[1],{cobrosEnSaldo:YM})]});
  assert.equal(c.fixedPaymentState(s,cxTel,Y,M,10).paid,true);
  assert.equal(c.fixedCobroDelBanco(s,cxTel,Y,M,10),9,"con el sello, sí cuenta");
  const sinSello=estado({fixed:[cxTel,seg],bankTx:s.bankTx});
  assert.equal(c.fixedCobroDelBanco(sinSello,cxTel,Y,M,10),null);
  assert.equal(pintado(sinSello).cx,50000,"sin sello (a mano nunca lo lleva), el saldo no lo resta");
});

// ---------- H4 ----------

test("H4 · en espera al leer el 9 y cobrado el 10: «¿Te llega?» no lo resta otra vez (970, no 940)",()=>{
  reloj(10);
  const s=estado({fixed:[Object.assign({},tel,{wait:YM}),seg],bankTx:[cargoTel("2026-11-10")],obBalAt:leidoEl(9)});
  assert.equal(pintado(s).sb,97000,"la lectura del 9 no lo llevaba: el saldo lo resta");
  const {out,T}=hoja(s,10);
  assert.equal(cents(T.minByBank.sabadell),97000);
  assert.equal(cents(T.pendingByBank.sabadell||0),0,"ni pendiente en el previsto");
  assert.deepEqual(json(c.bankPendingEvents(s,"sabadell",Y,M,10)),[],"ni «Pagado, aún sin restar»");
  // CaixaBank sigue con su Seguro del 28.
  assert.deepEqual(out.caixabank,{bal:50000,sinRestar:0,yaRestado:0,min:50000-6490});
});

// ---------- R1 ----------

test("R1 · sin `yaRestado` para un recibo cuyo día aún no ha llegado (el mínimo no sube)",()=>{
  reloj(10);
  // Dos cuentas de recibos en CaixaBank: el extracto (`bp`) casa el Gimnasio del 20 con el cargo del 3,
  // pero `fixedPaymentState` no (exige una sola cuenta). Hace falta un recibo en espera para que haya `bp`.
  const gim={id:"gim",name:"Gimnasio",amount:40,day:20,account:"caixabank",freq:"mes"};
  const agua={id:"agua",name:"Agua",amount:25,day:9,account:"caixabank",freq:"mes",wait:YM};
  const s=estado({fixed:[tel,seg,gim,agua],
    accounts:[cuentas()[0],cuentas()[1],{id:"cx2",ent:"caixabank",name:"Ahorro",role:"fijos",value:0}],
    bankTx:[{id:"t-gim",ent:"caixabank",date:"2026-11-03",amount:40,merchant:"GIMNASIO",status:"BOOK"},
      {id:"t-otro",ent:"caixabank",date:"2026-11-02",amount:5,merchant:"COMISION",status:"BOOK"}],
    oneoffs:[{id:"o1",name:"Dentista",amount:100,day:15,year:Y,month:M,account:"caixabank"}]});
  assert.equal(c.fixedPaymentState(s,gim,Y,M,10).paid,false);
  assert.ok(c.fixedSaldoBp(s,Y,M,10).gim,"el extracto sí lo da por cobrado");
  assert.equal(c.fixedEnSaldoMostrado(s,gim,Y,M,10,0),true,"y el saldo mostrado ya lo resta");
  const evs=json(c.bankPendingEvents(s,"caixabank",Y,M,10));
  assert.ok(!evs.some(e=>e.yaRestado),JSON.stringify(evs));
  // Lo que se recorre desde lo que se ve hoy (500 − 40 del Gimnasio): el Agua vencida hoy (B1),
  // −100 el 15, −40 el 20 y −64,90 el 28. Con el +40 del día −1, el mínimo salía 40 € más alto.
  const hoy=pintado(s).cx;
  assert.equal(hoy,46000);
  const T=totalsDe(s,"2026-11-10");
  assert.equal(cents(T.minByBank.caixabank),hoy-2500-10000-4000-6490);
  assert.equal(hoja(s,10).out.caixabank.min,cents(T.minByBank.caixabank),"la hoja dice lo mismo");
  // Con el día ya llegado, el `yaRestado` sigue (H2 de la 237): el Agua a mano sin cobro.
  const vencida=estado({fixed:[tel,seg]});
  assert.ok(json(c.bankPendingEvents(vencida,"sabadell",Y,M,10)).some(e=>e.yaRestado&&e.amt===30));
});

// ---------- totals.pendingByBank ----------

test("pendingByBank · misma regla que el saldo: lo que el saldo ya resta no queda pendiente",()=>{
  reloj(10);
  // H4 en la cuenta a mano de CaixaBank: el extracto lo cobró el 10 y el recibo seguía en espera.
  const cxTel=Object.assign({},tel,{id:"tel-cx",account:"caixabank",wait:YM});
  const s=estado({fixed:[tel,cxTel,seg],bankTx:[Object.assign(cargoTel("2026-11-10"),{ent:"caixabank",id:"t-cx"})]});
  assert.equal(c.fixedRestaDelSaldo(s,cxTel,Y,M,10),true);
  const T=totalsDe(s,"2026-11-10");
  assert.equal(cents(T.pendingByBank.caixabank),6490,"solo el Seguro (antes también el Teléfono)");
  assert.equal(cents(T.projectedByBank.caixabank),cents(T.bankBal.caixabank)-6490);
  // Y el de Sabadell, por calendario, como siempre.
  assert.equal(cents(T.pendingByBank.sabadell||0),0);
  assert.equal(cents(T.paidThisMonth),6000);
});
