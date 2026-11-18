// Ronda 240: los cuatro restos de dinero de la revisión de la 237 en Plan › Recibos.
// H3) Cobrado ANTES de su día y leído por Open Banking: el día del recibo `paidNet` lo restaba otra
//     vez del saldo que ya lo llevaba (970 con 1.000 en el banco). La corrección se suma al pintar y
//     al cerrar el mes, sin cambiar lo que significa `value`: un cliente con la versión anterior (la
//     beta 4.26.239, `eb75d2908`, cargada de Git) y uno nuevo comparten la cuenta sin descuadrarla
//     (revisión de la 240, P2-2).
// H4) Recibo en espera al leer y cobrado después: «¿Te llega?» lo daba por dentro de lo leído y lo
//     restaba otra vez (mínimo 940 cuando lo justo es 970).
// R1) `yaRestado` (+X el día −1) solo con el día del recibo ya llegado, o sin día (P3-1).
// totals.pendingByBank con la regla del saldo (`fixedRestaDelSaldo`), no con `isPaidIn` a secas.
// Se siembran DOS bancos de recibos: Sabadell leído por Open Banking y CaixaBank a mano.
// Datos inventados; reloj de noviembre de 2026. Corre también con TZ=UTC.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { loadPureLogic } from "../scripts/load-pure-logic.mjs";

let AHORA=0;
const reloj=(dia,mes=11)=>{ AHORA=new Date(2026,mes-1,dia,12).getTime(); };
function carga(read){
  const order=JSON.parse(read("src/build-order.json"));
  const ctx=loadPureLogic(read("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>order.map(f=>read("src/modules/"+f)).join("\n")));
  vm.runInNewContext(read("src/modules/14-v4-screens.js"),ctx);
  ctx.Date=class extends Date { constructor(...a){ super(...(a.length?a:[AHORA])); } static now(){ return AHORA; } };
  const main=read("src/modules/11-app-main.js").replaceAll("\r\n","\n"),ini=main.indexOf("const totals=useMemo(()=>{"),fin=main.indexOf("\n\n  const budgetMonth=",ini);
  assert(ini>=0&&fin>ini,"callback real de totals");
  ctx.__totals=vm.runInNewContext("(function(state,calendarDay){"+main.slice(ini,fin)+";return totals;})",ctx);
  return ctx;
}
const c=carga(f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8"));
// El cliente de antes: la beta servida sobre la que nace la ronda (lo que tiene hoy otro móvil de la casa).
const viejo=carga(f=>execFileSync("git",["show","eb75d2908415c5447555a5fb7c5b75ad6f48bfc7:"+f],{encoding:"utf8",maxBuffer:3e7,cwd:new URL("..",import.meta.url)}));
const totalsDe=c.__totals;
const Y=2026,M=11,YM=Y*12+M;
const cents=n=>Math.round(n*100);
const json=x=>JSON.parse(JSON.stringify(x));

const tel={id:"tel",name:"Teléfono",amount:30,day:8,account:"sabadell",freq:"mes"};
const luz={id:"luz",name:"Luz",amount:80,day:20,account:"sabadell",freq:"mes"};
const seg={id:"seg",name:"Seguro",amount:64.9,day:28,account:"caixabank",freq:"mes"};
const cuentas=()=>[
  {id:"sb",ent:"sabadell",name:"Cuenta Sintética",role:"fijos",value:1000,bankIban:"ES00SINTETICA0001"},
  {id:"cx",ent:"caixabank",name:"Cuenta Nómina",role:"fijos",value:500}];
const estado=p=>Object.assign({accounts:cuentas(),fixed:[tel,seg],debts:[],bankTx:[],expenses:[],oneoffs:[],flows:[],goals:[],deleted:[],
  investments:[],assets:[],aportaciones:[],obAccounts:[],settings:{},_dynBalAnchored:true,_netoUnaCuenta:true},p);
const cargoTel=fecha=>({id:"t-tel-"+fecha,ent:"sabadell",date:fecha,amount:30,merchant:"TELEFONO",concept:"RECIBO TELEFONO",status:"BOOK"});
const leidaA=dia=>new Date(2026,10,dia,9).toISOString();
const leidoEl=dia=>({"Banco Sabadell":leidaA(dia)});
/* Lo que manda `bank-sync`: cada cuenta con su `balanceAt` si leyó el saldo; el enlace, solo si las leyó
   TODAS. `falla`: otra cuenta del mismo enlace sin saldo (el P1 de la segunda vuelta). */
const lectura=(saldo,dia,falla)=>[{aspsp:"Banco Sabadell",ok:true,balanceAt:falla?undefined:leidaA(dia),accounts:[
  {uid:"u1",iban:"ES00SINTETICA0001",ok:true,balanceOk:true,balanceAt:leidaA(dia),balances:[{type:"CLBD",amount:String(saldo),currency:"EUR"}]}]
  .concat(falla?[{uid:"u2",iban:"ES00SINTETICA0002",ok:false,balanceOk:false,balances:[]}]:[])}];
// La sincronización: ancla con el cliente que sea y sella la hora del enlace si vino, como `runBankSync`.
const lee=(cli,s,dia,saldo,falla)=>{
  reloj(dia); const links=lectura(saldo,dia,falla), r=cli.applyBankBalances(s,links).state, at=Object.assign({},s.obBalAt);
  links.forEach(l=>{ if(l.balanceAt) at[l.aspsp]=l.balanceAt; });
  return Object.assign({},r,{obBalAt:at});
};
const pintado=(s,cli=c)=>{ const i=cli.insumosSaldoGasto(s),o={}; s.accounts.forEach(a=>{ o[a.id]=cents(cli.saldoCuentaMostrada(a,i)); }); return o; };
// El cierre de noviembre de verdad (`reconcileTR`), abriendo el 2 de diciembre. Necesita la cuenta diaria.
const conDiaria=s=>Object.assign({},json(s),{trAnchor:"2026-11",accounts:json(s.accounts).concat([{id:"tr",ent:"trade_republic",role:"diario",spendFrom:true,value:300,inject:0}])});
const cierre=(s,cli=c)=>{ reloj(2,12); const r=cli.reconcileTR(conDiaria(s)); return cents(r.accounts.find(a=>a.id==="sb").value); };
const hoja=(s,dia)=>{
  const T=totalsDe(s,"2026-11-"+String(dia).padStart(2,"0")),pack=c.planChargesMonth(s,M,Y,dia),out={};
  c.planRecibosBancos(T,pack,null).forEach(b=>{ out[b.bank]={bal:cents(b.bal),sinRestar:cents(b.sinRestar),yaRestado:cents(b.yaRestado),min:cents(b.min)}; });
  return {out,T};
};

// ---------- H3 ----------

test("H3 · cobrado el 3 y leído el 4: el día 8 el saldo no lo resta otra vez (1.000, no 970), ni al cerrar el mes",()=>{
  reloj(4);
  const s0=estado({bankTx:[cargoTel("2026-11-03")]});
  assert.equal(c.fixedPaymentState(s0,tel,Y,M,4).paid,true,"el cargo del 3 paga el Teléfono");
  const s=lee(c,s0,4,1000);
  assert.equal(s.accounts[0].value,1000,"el value se ancla como siempre");
  for(const dia of [4,6,8,10,30]){
    reloj(dia);
    assert.equal(pintado(s).sb,100000,"día "+dia);
    const T=totalsDe(s,"2026-11-"+String(dia).padStart(2,"0"));
    assert.equal(cents(T.bankBal.sabadell),100000);assert.equal(cents(T.minByBank.sabadell),100000,"nada más que restar este mes");
    assert.equal(cents(T.pendingByBank.sabadell||0),0,"ni pendiente en el previsto");
  }
  // Antes del arreglo, el día 8 pintaba 970; el cliente viejo sigue así (no inventa dinero: enseña de menos).
  reloj(8);assert.equal(pintado(s,viejo).sb,97000);
  assert.equal(cierre(s),100000,"diciembre empieza con lo del banco");
  assert.equal(cierre(s,viejo),97000,"(el cierre del cliente viejo arrastra H3, como siempre)");
  // El otro banco, a mano, ni se entera: su Seguro del 28 resta por calendario, como siempre.
  reloj(30);assert.equal(pintado(s).cx,50000-6490);
});

test("H3 · cliente viejo y nuevo en la misma cuenta (P2-2): ninguno enseña dinero que no hay",()=>{
  const s0=estado({fixed:[tel,luz,seg],bankTx:[cargoTel("2026-11-03")]});
  // a) Ancla el NUEVO el día 4 y abre el estado un cliente VIEJO: lo mismo que el banco hasta el día 8.
  const a=lee(c,s0,4,1000);
  for(const dia of [4,6]){ reloj(dia); assert.deepEqual([pintado(a).sb,pintado(a,viejo).sb],[100000,100000],"a) día "+dia); }
  // b) Re-ancla el VIEJO el día 5 (misma lectura) y lo abre el nuevo: 1.000 hasta la Luz del 20, 920 después y al cerrar.
  const b=lee(viejo,a,5,1000);
  for(const [dia,justo] of [[5,100000],[8,100000],[21,92000]]){ reloj(dia); assert.equal(pintado(b).sb,justo,"b) día "+dia); }
  assert.equal(cierre(b),92000,"b) cierre de noviembre");
  // c) El viejo re-ancla DESPUÉS del día 8 (su `paidNet` ya resta el Teléfono): el nuevo no lo devuelve dos veces.
  const c9=lee(viejo,a,9,1000);
  reloj(9);assert.deepEqual([pintado(c9).sb,pintado(c9,viejo).sb],[100000,100000],"c) día 9");
  assert.equal(cierre(c9),92000,"c) cierre");
  // d) Y al revés: el viejo ancla el 4 (sin marca) y el nuevo lo abre el 9: sin la hora de esa lectura no
  // devuelve nada y pinta como la base (970, de menos); en cuanto lee él, 1.000.
  const d4=lee(viejo,s0,4,1000);
  reloj(9);assert.equal(pintado(d4).sb,97000,"d) el nuevo sobre un ancla vieja, como la base");
  assert.equal(pintado(lee(c,d4,9,1000)).sb,100000);
});

test("marca de anclaje · la pone el anclaje nuevo y la invalida sola cualquier `value` que no la renueve",()=>{
  const s0=estado({fixed:[tel,luz,seg],bankTx:[cargoTel("2026-11-03")]});
  const a=lee(c,s0,4,1000);
  assert.ok(c.anclaConReglas(a.accounts[0]),"anclada por este cliente");
  assert.equal(c.anclaConReglas(a.accounts[1]),false,"la cuenta a mano no se ha anclado");
  // Un cliente viejo re-ancla con otro saldo: conserva el campo, pero ya no casa con el `value`.
  const b=lee(viejo,a,9,1100);
  assert.ok(b.accounts[0].anclaReglas,"el viejo conserva el campo que no conoce");
  assert.equal(c.anclaConReglas(b.accounts[0]),false,"y la marca deja de valer");
  // Cierre de mes: el nuevo la renueva con el `value` cerrado; el viejo la deja inválida.
  reloj(2,12);
  const cn=c.reconcileTR(conDiaria(a)), cv=viejo.reconcileTR(conDiaria(a));
  assert.ok(c.anclaConReglas(cn.accounts.find(x=>x.id==="sb")),"cierra el nuevo: sigue anclada con sus reglas");
  assert.equal(c.anclaConReglas(cv.accounts.find(x=>x.id==="sb")),false,"cierra el viejo: ya no");
  // Sin marca previa, el cierre no la inventa.
  assert.equal(c.anclaConReglas(c.reconcileTR(conDiaria(s0)).accounts.find(x=>x.id==="sb")),false);
});

test("H3 · otra cuenta del enlace falla el día 9: la hora del banco se queda en el 4, la de la marca no (1.000, no 1.030)",()=>{
  // Caso del revisor (segunda vuelta, P1): ancla bien el 4 con el Teléfono cobrado el 3; el 9 esta cuenta lee
  // 1.000 y se re-ancla (el calendario ya resta el Teléfono: value 1.030), pero otra cuenta del enlace falla y
  // `obBalAt` sigue en el 4. Con la hora del banco se devolvía el Teléfono otra vez.
  const s0=estado({fixed:[tel,luz,seg],bankTx:[cargoTel("2026-11-03")]});
  const a=lee(c,s0,4,1000), b=lee(c,a,9,1000,true);
  assert.equal(b.obBalAt["Banco Sabadell"],leidaA(4),"el enlace no trae hora: el banco sigue en el 4");
  assert.equal(b.accounts[0].anclaReglas.t,leidaA(9),"la marca lleva la lectura de esta cuenta");
  for(const [dia,justo] of [[9,100000],[10,100000],[21,92000]]){ reloj(dia); assert.equal(pintado(b).sb,justo,"día "+dia); }
  assert.equal(cierre(b),92000,"y el cierre de noviembre");
  // Sin la hora por cuenta, vale la del enlace (solo viene si leyó todas); sin ninguna, la marca va sin hora.
  const soloEnlace=lectura(1000,4); delete soloEnlace[0].accounts[0].balanceAt;
  reloj(4);assert.equal(c.applyBankBalances(s0,soloEnlace).state.accounts[0].anclaReglas.t,leidaA(4));
  const ninguna=lectura(1000,4,true); delete ninguna[0].accounts[0].balanceAt;
  assert.equal(c.applyBankBalances(s0,ninguna).state.accounts[0].anclaReglas.t,null);
  // Sin hora en la marca (un servidor que no la mande), no se devuelve nada: H3 de siempre, de menos.
  const sinHora=Object.assign({},a,{accounts:[Object.assign({},a.accounts[0],{anclaReglas:Object.assign({},a.accounts[0].anclaReglas,{t:null})}),a.accounts[1]]});
  reloj(10);assert.equal(pintado(sinHora).sb,97000);
});

test("H3 · cuenta rancia (su saldo falló en la última lectura): no devuelve nada, pinta como la base (970, de menos)",()=>{
  const a=lee(c,estado({fixed:[tel,seg],bankTx:[cargoTel("2026-11-03")]}),4,1000);
  const rancia=Object.assign({},a,{accounts:[Object.assign({},a.accounts[0],{balanceStale:true}),a.accounts[1]]});
  reloj(10);
  assert.equal(c.cobrosLeidosDelMes(rancia,"sabadell",Y,M,10),0);
  assert.equal(pintado(rancia).sb,97000);assert.equal(pintado(rancia,viejo).sb,97000,"igual que la base");
});

test("H3 · en la cuenta a mano un cargo BOOK no adelanta nada (el extracto no es su saldo)",()=>{
  reloj(21);
  const cxTel=Object.assign({},tel,{id:"tel-cx",account:"caixabank",day:20});
  const s=estado({fixed:[cxTel,seg],bankTx:[Object.assign(cargoTel("2026-11-09"),{ent:"caixabank"})],obBalAt:leidoEl(10)});
  assert.equal(c.fixedPaymentState(s,cxTel,Y,M,21).paid,true);
  assert.equal(c.lecturaDeSusRecibos(s,"caixabank"),0,"una cuenta a mano no tiene lectura de Open Banking");
  assert.equal(c.cobrosLeidosDelMes(s,"caixabank",Y,M,21),0);
  assert.equal(pintado(s).cx,pintado(s,viejo).cx,"igual que antes");
});

test("H3 · coste (P2-1): un recibo sin ningún cargo parecido en el extracto ni se casa",()=>{
  reloj(10);
  let llamadas=0;const fps=c.fixedPaymentState;
  c.fixedPaymentState=function(){ llamadas++; return fps.apply(this,arguments); };
  try{
    const muchos=Array.from({length:25},(_,i)=>({id:"r"+i,name:"Recibo "+i,amount:100+i,day:9,account:"sabadell",freq:"mes"}));
    const tx=Array.from({length:1000},(_,i)=>({id:"x"+i,ent:"sabadell",date:"2026-11-0"+(1+i%8),amount:3+i%50,merchant:"COMERCIO "+i,status:"BOOK"}));
    const marcada=cuentas(); marcada[0].anclaReglas=c.selloAncla(marcada[0].value,leidaA(5));
    const s=estado({accounts:marcada,fixed:muchos,bankTx:tx});
    assert.ok(c.lecturaDeSusRecibos(s,"sabadell")>0,"la corrección está activa");
    llamadas=0;c.cobrosLeidosDelMes(s,"sabadell",Y,M,10);
    assert.equal(llamadas,0,"ningún cargo del banco se parece a esos recibos: ni se casa");
    // Final de mes con la lectura del 5 y cada recibo cobrado en su día con su nombre (el peor caso del revisor):
    // ningún cargo es anterior a la lectura, así que tampoco se casa ninguno.
    reloj(28);
    const suyos=tx.concat(muchos.map((f,i)=>({id:"rc"+i,ent:"sabadell",date:"2026-11-09",amount:f.amount,merchant:f.name.toUpperCase(),status:"BOOK"})));
    llamadas=0;c.cobrosLeidosDelMes(Object.assign({},s,{bankTx:suyos}),"sabadell",Y,M,28);
    assert.equal(llamadas,0,"cobrados después de la lectura: ni se casan");
  }finally{ c.fixedPaymentState=fps; }
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
  // Con el día ya llegado, el `yaRestado` sigue (H2 de la 237): el Teléfono a mano sin cobro.
  const vencida=estado({fixed:[tel,seg]});
  assert.ok(json(c.bankPendingEvents(vencida,"sabadell",Y,M,10)).some(e=>e.yaRestado&&e.amt===30));
});

test("R1 · el recibo SIN día conserva su `yaRestado`: el mínimo no lo resta dos veces (435, no 395) (P3-1)",()=>{
  reloj(10);
  const sindia={id:"sd",name:"Gimnasio",amount:40,day:null,account:"caixabank",freq:"mes"};
  const agua={id:"agua",name:"Agua",amount:25,day:9,account:"caixabank",freq:"mes",wait:YM};
  const s=estado({fixed:[tel,sindia,agua],
    accounts:[cuentas()[0],cuentas()[1],{id:"cx2",ent:"caixabank",name:"Ahorro",role:"fijos",value:0}],
    bankTx:[{id:"t1",ent:"caixabank",date:"2026-11-03",amount:40,merchant:"GIMNASIO",status:"BOOK"},
      {id:"t0",ent:"caixabank",date:"2026-11-02",amount:5,merchant:"COMISION",status:"BOOK"}]});
  assert.ok(c.fixedSaldoBp(s,Y,M,10).sd,"el extracto lo da por cobrado");
  assert.equal(pintado(s).cx,46000,"«Tienes hoy» ya lo resta");
  const T=totalsDe(s,"2026-11-10");
  assert.equal(cents(T.minByBank.caixabank),43500,"solo queda el Agua vencida");
  assert.equal(cents(viejo.__totals(s,"2026-11-10").minByBank.caixabank),43500,"igual que antes de la ronda");
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

test("pendingByBank · lo cobrado antes de su día que ya trae la lectura no queda pendiente (H3 en el previsto)",()=>{
  const s=lee(c,estado({fixed:[tel,luz,seg],bankTx:[cargoTel("2026-11-03")]}),4,1000);
  reloj(6);
  const T=totalsDe(s,"2026-11-06");
  assert.equal(cents(T.pendingByBank.sabadell),8000,"solo la Luz del 20");
  assert.equal(cents(T.projectedByBank.sabadell),100000-8000);
  assert.equal(cents(T.minByBank.sabadell),100000-8000);
});
