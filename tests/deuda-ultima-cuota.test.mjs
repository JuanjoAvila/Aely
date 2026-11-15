import assert from "node:assert/strict";
import fs from "node:fs";
import {loadPureLogic} from "../scripts/load-pure-logic.mjs";
const read=f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8");
const js=JSON.parse(read("src/build-order.json")).map(f=>read("src/modules/"+f)).join("\n");
const c=loadPureLogic(read("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>js));

/* LA ÚLTIMA CUOTA SE LLEVA EL REDONDEO (revisión externa 15/11/2026, hallazgo A). Una deuda a plazos
   guarda la cuota redondeada al céntimo y la cobraba igual los n meses: 600,03 en 12 sumaba 600,00 y
   dejaba 0,03 debidos para siempre; 1.199,99 en 7 cobraba 1.200,01; y `debtPaidCount` seguía contando
   cuotas pasado el plazo, así que el saldo bajaba sin ningún cobro. Ahora, en céntimos, la última es
   lo financiado − (n − 1) × cuota, el saldo queda a 0 al acabar y las pagadas nunca pasan de n.
   Importes inventados. */
const [y,m,dia]=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Madrid"}).format(new Date()).split("-").map(Number);
const ahora=y*12+m-1;
const ym=k=>({y:Math.floor(k/12),m:k%12+1});
const cts=x=>Math.round(x*100);
let total=0,fallos=0;
// Cada prueba sigue aunque caiga otra: con el código viejo se ve cuáles caen, no solo la primera.
function test(name,fn){ try{ fn();total++;console.log("✓ "+name); }catch(e){ fallos++;console.log("✗ "+name+"\n  "+String(e.message).split("\n")[0]); } }
const estado=(debts)=>({debts,expenses:[],fixed:[],flows:[],oneoffs:[],accounts:[{id:"sb",ent:"sabadell",value:2000,role:"fijos"}],bankTx:[],deleted:[]});
const filaDe=(lista,d)=>lista.filter(x=>x.id==="debt_"+d.id);
// Lo que Recibos cobra de la deuda en el mes k (pendiente o pagado).
const cobroMes=(s,d,k,hoy)=>{ const {y:yy,m:mm}=ym(k),p=c.planChargesMonth(s,mm,yy,hoy);
  return filaDe(p.pendingBills,d).concat(filaDe(p.paidBills,d)).reduce((a,r)=>a+cts(r.amount),0); };

const CASOS=[[600.03,12],[100,3],[1199.99,7],[1200,12],[599,3],[0.05,2],[1000,24]];

for(const [importe,n] of CASOS){
  test(`${importe} € en ${n}: lo que cobra Recibos mes a mes suma lo financiado al céntimo`,()=>{
    const d=c.deudaAPlazos(importe,0,n,"sabadell",1,"Compra sintética"),s=estado([d]);
    let suma=0;
    for(let k=d.asOf;k<d.asOf+n;k++) suma+=cobroMes(s,d,k,0);
    assert.equal(suma,cts(importe),"suma de cuotas");
    assert.equal(cobroMes(s,d,d.asOf+n,0),0,"tras la última, nada");
    // La última es lo que falta, y nunca más de una cuota más los céntimos del redondeo.
    const ultima=cobroMes(s,d,d.asOf+n-1,0);
    assert.equal(ultima,cts(importe)-(n-1)*cts(d.monthly),"última = total − (n − 1) × cuota");
  });

  test(`${importe} € en ${n}: con el plazo ya en marcha, el saldo baja hasta 0 justo con la última`,()=>{
    const d0=c.deudaAPlazos(importe,0,n,"sabadell",1,"Compra sintética");
    // Día 1: la cuota de este mes ya ha pasado siempre, así las pagadas son ahora − ancla + 1.
    const conPagadas=p=>Object.assign({},d0,{asOf:ahora-p+1,startMonth:ahora-p+1});
    assert.equal(cts(c.debtBalance(conPagadas(n-1))),cts(importe)-(n-1)*cts(d0.monthly),"antes de la última se debe la última");
    assert.equal(c.debtBalance(conPagadas(n)),0,"pagada la última, 0");
    assert.equal(c.debtLeft(conPagadas(n)),0);
    // Este mes es el de la última cuota y aún no ha llegado su día: Recibos la espera con su importe,
    // no con la cuota redondeada. (Pagada la última, el saldo es 0 y la deuda deja de salir, como siempre.)
    if(dia<31){
      const ult=Object.assign({},d0,{asOf:ahora-(n-1),startMonth:ahora-(n-1),day:dia+1}),s=estado([ult]);
      assert.equal(c.debtPaidCount(ult),n-1);
      assert.equal(cobroMes(s,ult,ahora,dia),cts(importe)-(n-1)*cts(d0.monthly),"la de este mes es la última");
      assert.equal(cts(c.billsHeroTotal(s,null,m,y)),cts(importe)-(n-1)*cts(d0.monthly),"«Se te van cada mes» de este mes");
      // Y el saldo por banco del mes cerrado resta lo mismo que Recibos.
      assert.equal(cts(-c.monthNetForAccount(s,"sabadell",y,m,null)),cts(importe)-(n-1)*cts(d0.monthly),"neto del banco");
      assert.equal(cts(-c.pendingWalkEvents(s,y,m,dia).filter(e=>e.amt<0).reduce((a,e)=>a+e.amt,0)),cts(importe)-(n-1)*cts(d0.monthly),"recorrido de «¿Te llega?»");
    }
    for(const extra of [1,5,40]){
      const pasada=conPagadas(n+extra);
      assert.equal(c.debtPaidCount(pasada),n,"pagadas con tope = n ("+extra+" meses después)");
      assert.equal(c.debtBalance(pasada),0);
    }
  });
}

test("la cuota que no es la que amortiza (préstamo familiar, intereses) no se toca: solo cambia lo que baja",()=>{
  // Paga 197, baja 250: lo que salga del banco el último mes no lo sabemos y no se inventa.
  const d={id:"f",name:"Préstamo sintético",value:1000.03,original:1000.03,monthly:197,amort:250,months:4,day:1,account:"sabadell"};
  const pag=p=>Object.assign({},d,{asOf:ahora-p+1});
  assert.equal(cts(c.debtBalance(pag(3))),cts(1000.03)-3*25000,"antes de la última");
  assert.equal(c.debtBalance(pag(4)),0,"el redondeo del principal se absorbe igual");
  if(dia<31){ const ult=Object.assign({},d,{asOf:ahora-3,day:dia+1});
    assert.equal(cobroMes(estado([ult]),ult,ahora,dia),19700,"la cuota en efectivo del último mes sigue siendo 197"); }
});

test("un saldo que el plazo no cubre (dato heredado) NO se da por pagado: solo se absorbe el redondeo",()=>{
  // 1.000 en 4 cuotas de 100: faltan 600, no céntimos. Se queda debiendo y nadie cobra 700 de golpe.
  const d={id:"h",name:"Heredada sintética",value:1000,original:1000,monthly:100,months:4,day:Math.min(31,dia+1),account:"sabadell",asOf:ahora-3};
  if(dia<31) assert.equal(c.debtBalance(d),700);
  const s=estado([d]);
  assert.equal(cobroMes(s,d,ahora,dia),10000,"cobra la cuota de siempre");
  const pasada=Object.assign({},d,{asOf:ahora-10,day:1});
  assert.equal(c.debtPaidCount(pasada),4,"tope n");
  assert.equal(c.debtBalance(pasada),600,"y el saldo no baja solo pasado el plazo");
});

test("amortizar acorta a una última cuota parcial: se cobra lo que queda, no la cuota entera",()=>{
  // 350 pendientes con cuota 100 → 4 cuotas: 100, 100, 100 y 50.
  if(dia>=31) return;
  const d={id:"p",name:"Parcial sintética",value:350,original:350,monthly:100,months:4,day:dia+1,account:"sabadell",asOf:ahora-3};
  const s=estado([d]);
  assert.equal(cts(c.debtBalance(d)),5000);
  assert.equal(cobroMes(s,d,ahora,dia),5000);
});

test("con pago final (balloon) la última cuota cuadra el principal y el pago final va aparte",()=>{
  // 1.000,01 con 400 de pago final en 3: 200,00 + 200,00 + 200,01, y 400 el último mes.
  if(dia>=31) return;
  const d={id:"b",name:"Coche sintético",value:1000.01,original:1000.01,monthly:200,amort:200,months:3,balloon:400,day:dia+1,account:"sabadell",asOf:ahora-2};
  const s=estado([d]),p=c.planChargesMonth(s,m,y,dia);
  const filas=p.paidBills.concat(p.pendingBills).filter(x=>x.id==="debt_b"||x.id==="balloon_b");
  assert.deepEqual(JSON.parse(JSON.stringify(filas.map(x=>[x.id,cts(x.amount)]).sort())),[["balloon_b",40000],["debt_b",20001]]);
  assert.equal(cts(c.debtBalance(d)),60001,"antes del último cargo: la última cuota y el pago final");
  assert.equal(c.debtBalance(Object.assign({},d,{day:1})),0,"pagado todo, 0");
});

test("sin plazo (hipoteca) nada cambia",()=>{
  const d={id:"hip",name:"Hipoteca sintética",value:50000,original:50000,monthly:500,day:1,account:"sabadell",asOf:ahora-3};
  assert.equal(c.debtPaidCount(d),3);
  assert.equal(c.debtBalance(d),48500);
  assert.equal(c.debtCuotaIn?c.debtCuotaIn(d,y,m):d.monthly,500);
});

test("la gráfica de patrimonio: la deuda acaba en 0 y no baja más pasado el plazo",()=>{
  const d=Object.assign({},c.deudaAPlazos(600.03,0,12,"sabadell",1,"Compra sintética"));
  d.asOf=ahora-14; d.startMonth=d.asOf; delete d.startDay;
  const hoy=`${y}-${String(m).padStart(2,"0")}-${String(dia).padStart(2,"0")}`;
  const pol=c.netWorthDebtPolicy(estado([d]),hoy,c.debtBalance(d));
  const k=d.asOf+11,{y:uy,m:um}=ym(k),dUlt=`${uy}-${String(um).padStart(2,"0")}-02`;
  assert.equal(pol.at(dUlt),0,"tras la última, 0 (antes 0,03)");
  assert.equal(pol.at(hoy),0);
  const {y:py,m:pm}=ym(d.asOf+10),dPen=`${py}-${String(pm).padStart(2,"0")}-02`;
  assert.equal(cts(pol.at(dPen)),5003,"antes de la última se debe la última");
});

/* H-A1 (revisión de dinero 234): con el tope, una deuda vencida heredada enseña su pendiente y se puede
   amortizar; amortizar no puede hacer desaparecer el resto. */
const amortiza=(d,x)=>c.deudaAmortizada?c.deudaAmortizada(d,c.debtBalance(d),x):null;
for(const hace of [23,12]){
  test(`amortizar 50 de una vencida heredada (1.300 en 12×100, hace ${hace} meses) deja 50 pendientes`,()=>{
    const d={id:"v",name:"Heredada sintética",value:1300,original:1300,monthly:100,months:12,day:1,account:"sabadell",asOf:ahora-hace};
    assert.equal(cts(c.debtBalance(d)),10000);
    const o=amortiza(d,50);
    assert.ok(o,"deudaAmortizada existe");
    assert.equal(cts(c.debtBalance(o)),5000,"quedan 50, no 0");
    assert.equal(o.settledAt,undefined,"no se da por liquidada");
    const t=amortiza(d,100);
    assert.equal(c.debtBalance(t),0);assert.ok(t.settledAt,"amortizarlo todo sí la liquida");
  });
}
test("vencida con pago final ya contado: amortizar parte deja el resto y liquidarla la deja a 0",()=>{
  const d={id:"vb",name:"Coche heredado sintético",value:1500,original:1500,monthly:100,months:12,balloon:100,day:1,account:"sabadell",asOf:ahora-15};
  assert.equal(cts(c.debtBalance(d)),20000);
  assert.equal(cts(c.debtBalance(amortiza(d,50))),15000);
  const t=amortiza(d,200);assert.equal(c.debtBalance(t),0);assert.ok(t.settledAt);
});
test("amortizar una en curso sigue como antes: baja el saldo y acorta el plazo",()=>{
  const d={id:"cur",name:"En curso sintética",value:1000,original:1000,monthly:100,months:10,day:1,account:"sabadell",asOf:ahora-2};
  const o=amortiza(d,250);
  assert.ok(o,"deudaAmortizada existe");
  assert.equal(cts(c.debtBalance(o)),cts(c.debtBalance(d))-25000);
  assert.equal(o.months,3+5,"3 pagadas y 450 en 5 cuotas (la última de 50)");
  assert.equal(o.asOf,d.asOf,"el ancla no se mueve");
});
test("cambiar lo que baja una vencida con TAE (sin plazo recalculable) no infla el saldo",()=>{
  let s=estado([{id:"tae",name:"TAE sintética",value:1300,original:1300,monthly:100,months:12,apr:5,day:1,account:"sabadell",asOf:ahora-23}]);
  assert.equal(cts(c.debtBalance(s.debts[0])),10000);
  c.patchDebtFields(f=>{ s=f(s); },"tae",{amort:80});
  assert.equal(cts(c.debtBalance(s.debts[0])),10000,"sigue debiendo 100");
});

if(fallos){ console.log(`deuda-ultima-cuota: ${fallos} fallan`); process.exit(1); }
console.log(`deuda-ultima-cuota: ${total} pruebas OK`);
