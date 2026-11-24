// EL REPARTO DEL PERIODO (Plan › «A dónde va tu sueldo») y el interruptor «Restar del presupuesto».
// Motor real con el reloj clavado en el 21/11/2026; cifras inventadas (el repo es público).
// Se corre con TZ=Europe/Madrid y TZ=UTC. Al final, MUTANTES: cada uno rompe una regla del motor y la
// suite tiene que caer; si un mutante sobrevive, la suite no vigilaba esa regla.
import assert from "node:assert/strict";
import fs from "node:fs";
import {cargarMotor,base,NOV,mov,dia,escenariosApagado} from "./helpers/plan-reparto-fixture.mjs";

// Lo que dieron monthBudgetStats/dashboardBudgetStats/reservedSince en la rama de antes (d2e500fd6), sin interruptor.
const ORACULO_APAGADO=[{"mes":{"spent":180.5,"income":3000,"balance":2819.5,"budget":900,"reserved":0,"remaining":719.5,"against":180.5,"shown":180.5,"cycle":false,"nomina":3000},"dash":{"spent":180.5,"income":3000,"balance":2819.5,"budget":900,"reserved":0,"remaining":719.5,"against":180.5,"shown":180.5,"cycle":false,"nomina":3000},"res":0,"modo":{"spent":180.5,"income":3000,"balance":2819.5,"budget":900,"reserved":0,"remaining":3719.5,"against":-2819.5,"shown":2819.5,"cycle":false,"nomina":3000}},{"mes":{"spent":180.5,"income":3000,"balance":2819.5,"budget":900,"reserved":0,"remaining":719.5,"against":180.5,"shown":180.5,"cycle":false,"nomina":3000},"dash":{"spent":180.5,"income":3000,"balance":2819.5,"budget":900,"reserved":0,"remaining":719.5,"against":180.5,"shown":180.5,"cycle":false,"nomina":3000},"res":0,"modo":{"spent":180.5,"income":3000,"balance":2819.5,"budget":900,"reserved":0,"remaining":3719.5,"against":-2819.5,"shown":2819.5,"cycle":false,"nomina":3000}},{"mes":{"spent":180.5,"income":3000,"balance":2819.5,"budget":900,"reserved":0,"remaining":719.5,"against":180.5,"shown":180.5,"cycle":false,"nomina":3000},"dash":{"spent":180.5,"income":3000,"balance":2819.5,"budget":900,"reserved":0,"remaining":719.5,"against":180.5,"shown":180.5,"cycle":false,"nomina":3000},"res":0,"modo":{"spent":180.5,"income":3000,"balance":2819.5,"budget":900,"reserved":0,"remaining":3719.5,"against":-2819.5,"shown":2819.5,"cycle":false,"nomina":3000}},{"mes":{"spent":180.5,"income":3000,"balance":2819.5,"budget":900,"reserved":0,"remaining":719.5,"against":180.5,"shown":180.5,"cycle":false,"nomina":3000},"dash":{"spent":180.5,"income":3000,"balance":2819.5,"budget":900,"reserved":0,"remaining":719.5,"against":180.5,"shown":180.5,"cycle":false,"nomina":3000},"res":0,"modo":{"spent":180.5,"income":3000,"balance":2819.5,"budget":900,"reserved":0,"remaining":3719.5,"against":-2819.5,"shown":2819.5,"cycle":false,"nomina":3000}},{"mes":{"spent":440.5,"income":3000,"balance":2559.5,"budget":900,"reserved":0,"remaining":459.5,"against":440.5,"shown":440.5,"cycle":false,"nomina":3000},"dash":{"spent":440.5,"income":3000,"balance":2559.5,"budget":900,"reserved":0,"remaining":459.5,"against":440.5,"shown":440.5,"cycle":false,"nomina":3000},"res":0,"modo":{"spent":440.5,"income":3000,"balance":2559.5,"budget":900,"reserved":0,"remaining":3459.5,"against":-2559.5,"shown":2559.5,"cycle":false,"nomina":3000}},{"mes":{"spent":440.5,"income":3000,"balance":2559.5,"budget":750,"reserved":150,"remaining":309.5,"against":440.5,"shown":440.5,"cycle":false,"nomina":3000},"dash":{"spent":440.5,"income":3000,"balance":2559.5,"budget":750,"reserved":150,"remaining":309.5,"against":440.5,"shown":440.5,"cycle":false,"nomina":3000},"res":150,"modo":{"spent":440.5,"income":3000,"balance":2559.5,"budget":750,"reserved":150,"remaining":3309.5,"against":-2559.5,"shown":2559.5,"cycle":false,"nomina":3000}},{"mes":{"spent":440.5,"income":0,"balance":-440.5,"budget":900,"reserved":0,"remaining":459.5,"against":440.5,"shown":440.5,"cycle":true,"nomina":0},"dash":{"spent":440.5,"income":0,"balance":-440.5,"budget":900,"reserved":0,"remaining":459.5,"against":440.5,"shown":440.5,"cycle":true,"nomina":0},"res":0,"modo":{"spent":440.5,"income":0,"balance":-440.5,"budget":900,"reserved":0,"remaining":459.5,"against":440.5,"shown":440.5,"cycle":true,"nomina":0}}];

const deuda=extra=>Object.assign({id:"d1",name:"Préstamo sintético",value:12000,monthly:260,months:40,day:5,asOf:NOV-6,account:"sabadell"},extra||{});
const reciboAna={id:"r2",name:"Fibra sintética",amount:50,bankAmount:90,day:12,freq:"mes",account:"sabadell",
  reparto:[{id:"p1",n:"Ana",via:"debt",debtId:"d1",amt:40}]};
const meta=extra=>Object.assign({id:"g1",name:"Viaje",target:3000,saved:100,monthly:300},extra||{});
const rr=s=>Object.assign({},s,{settings:Object.assign({},s.settings,{reservaRules:(s.goals||[]).filter(g=>g.monthly>0).map(g=>({id:"rr"+g.id,name:"",kind:"fixed",value:g.monthly,goalId:g.id,mensual:true}))})});
const suma=r=>r.trozos.reduce((a,x)=>a+x.c,0);
const cargoCuota=mov("c1",5,260,{category:"otros",source:"ob:sabadell",merchant:"Cargo cuota"});

const SUITE=[
["Entra y Libre: nómina + ingreso real, sin traspasos, duplicados ni devoluciones",c=>{
  const e=base().expenses.concat([
    mov("i2",6,-50,{merchant:"Venta sintética"}),
    mov("t1",7,-400,{category:"traspaso"}),
    mov("d1",8,-70,{possibleDup:true}),
    mov("v1",9,-30,{merchant:"Devolución pedido"}),
    mov("b1",10,-25,{category:"bizum"})]);
  const r=c.planReparto(base({expenses:e}),{});
  assert.equal(r.entra,300000,"nómina 3000: la venta de 50 del banco del día a día devuelve margen a Gastos (neto, 24/11), no cuenta además como ingreso");
  assert.equal(r.devolucion,5500,"devolución y Bizum no son ingreso");
  assert.equal(r.neteo,5000);
  assert.equal(r.gastado,18050-5500-5000,"y devuelven margen a lo gastado, como en Gastos");
  assert.equal(r.libre,r.entra-r.total);
}],
["Sin nómina todavía: sin porcentajes ni Libre",c=>{
  const e=[mov("g1",5,120.5,{category:"super"}),mov("i2",6,-500,{merchant:"Venta sintética"})];
  const s=base({expenses:e,flows:[{id:"f1",kind:"income",name:"Nómina",amount:3000,day:3,to:"sabadell"}]});
  const r=c.planReparto(s,{});
  assert.equal(r.entra,null);assert.equal(r.libre,null);assert.equal(r.st,"wait");
  assert.ok(!r.trozos.some(x=>x.k==="lib"),"sin Libre");assert.ok(r.trozos.every(x=>x.p==null),"sin %");
  // Una nómina de otro mes anterior (sin flujo dado de alta) también la hace esperada.
  const previa=base({expenses:[mov("g1",5,120.5,{category:"super"}),{id:"np",date:dia(25,10),amount:-2800,category:"ingreso",merchant:"Nómina Empresa SL",ent:"sabadell"}]});
  assert.equal(c.planReparto(previa,{}).st,"wait");
  // Quien no cobra nómina nunca no se queda en «—»: entra lo que entra.
  const libre=base({expenses:[mov("g1",5,120.5,{category:"super"}),mov("i2",6,-500,{merchant:"Factura cliente"})]});
  assert.equal(c.planReparto(libre,{}).entra,50000-12050,"entra lo que entra, menos lo que ya devolvió margen a lo gastado (120,50)");
}],
["Recibos: tu parte, sin deudas",c=>{
  const s=base({fixed:[{id:"r1",name:"Comunidad",amount:95,day:1,freq:"mes",account:"sabadell"},
    {id:"r3",name:"Internet",amount:30,bankAmount:60,day:28,freq:"mes",account:"sabadell",reparto:[{id:"p9",n:"Ana",via:"bizum",amt:30}]}],
    debts:[deuda()]});
  const r=c.planReparto(s,{});
  assert.equal(r.rec,12500,"95 + tu parte (30) de un recibo de 60");
  assert.equal(r.nRec,2);
  assert.equal(r.deu,26000);
}],
["Deudas: cuota del banco + lo que descuentas de un recibo, y cada euro en un solo trozo",c=>{
  const s=base({debts:[deuda()],fixed:[reciboAna]});
  const r=c.planReparto(s,{});
  assert.equal(r.rec,5000,"del recibo de 90 solo tus 50");
  assert.equal(r.deu,30000,"260 del banco + 40 descontados: la fila de Recibos dice 300");
  // Contraejemplo de la fórmula «cuota − descuento»: del banco salen 90 + 260 = 350 = 50 + 300.
  assert.equal(r.rec+r.deu,9000+26000);
  const hoy=21,pack=c.planChargesMonth(s,11,2026,hoy),fila=pack.pendingBills.concat(pack.paidBills).find(x=>x.kind==="debt");
  assert.equal(Math.round(fila.amount*100),r.deu,"lo mismo que cuenta Recibos para esa deuda");
}],
["Deuda con descuento (decisión de dinero): recibo de 100 con 53 a la deuda de 197 → Recibos 47, Deudas 250, suma 297",c=>{
  const rec={id:"r5",name:"Suministro sintético",amount:47,bankAmount:100,day:12,freq:"mes",account:"sabadell",
    reparto:[{id:"p5",n:"Ana",via:"debt",debtId:"d1",amt:53}]};
  const s=base({debts:[deuda({monthly:197,value:7880,months:40})],fixed:[rec]});
  const r=c.planReparto(s,{});
  assert.equal(r.rec,4700,"del recibo de 100 solo tus 47: los 53 no cuentan también en Recibos");
  assert.equal(r.deu,25000,"197 del banco + 53 descontados");
  assert.equal(r.rec+r.deu,29700,"lo que realmente sale del banco: 100 del recibo + 197 de la cuota");
}],
["Deuda con pago final: el pago final sale del banco y cuenta en Deudas ese mes",c=>{
  const d=deuda({months:7,asOf:NOV-6,value:2000,balloon:500,monthly:214.29,amort:214.29,day:25});
  const r=c.planReparto(base({debts:[d]}),{});
  assert.equal(r.deu,Math.round(c.debtCuotaIn(d,2026,11)*100)+50000);
}],
["Metas: el mayor entre el ritmo y lo ya movido; lo manual sin fecha no entra",c=>{
  const g=meta();
  let r=c.planReparto(rr(base({goals:[g]})),{});
  assert.equal(r.met,30000);assert.equal(r.qMet,30000);
  // Mover 120 con una reserva de este mes: sigue siendo 300 en el trozo, quedan 180.
  const conReserva=rr(base({goals:[g],reservaLog:[{id:"x",goalId:"g1",amount:120,date:dia(4)}]}));
  r=c.planReparto(conReserva,{});assert.equal(r.met,30000);assert.equal(r.qMet,18000);
  assert.equal(r.presupuesto,90000-12000,"lo reservado sale del presupuesto de gastos (como en Inicio)");assert.equal(r.gas,78000);assert.equal(r.reservasC,12000);
  // Más de lo previsto: manda lo movido (reserva 120 + gasto con meta 250).
  const mas=rr(base({goals:[g],reservaLog:[{id:"x",goalId:"g1",amount:120,date:dia(4)}],expenses:base().expenses.concat([mov("m1",9,250,{goalId:"g1"})])}));
  r=c.planReparto(mas,{});assert.equal(r.met,37000);assert.equal(r.qMet,0);
  assert.equal(r.gastado,18050,"el gasto con meta no es gasto");
  // Una reserva de OTRO mes no cuenta; una aportación manual (saved sube) tampoco inventa un mes.
  const otro=rr(base({goals:[meta({saved:2500})],reservaLog:[{id:"y",goalId:"g1",amount:700,date:dia(20,10)}]}));
  assert.equal(c.planReparto(otro,{}).met,30000);
}],
["Ahorro: aportaciones o inversión, sin lo que va a una meta",c=>{
  const apo=[{id:"a1",amount:200,ent:"myinvestor"}];
  let r=c.planReparto(base({aportaciones:apo}),{});
  assert.equal(r.aho,20000);assert.equal(r.qAho,20000);
  const inv=mov("v1",10,350,{category:"inversion",ent:"myinvestor"});
  r=c.planReparto(base({aportaciones:apo,expenses:base().expenses.concat([inv])}),{});
  assert.equal(r.aho,35000);assert.equal(r.qAho,0);assert.equal(r.gastado,18050,"invertir no es gastar");
  const conMeta=mov("v2",11,300,{category:"inversion",ent:"myinvestor",goalId:"g1"});
  r=c.planReparto(base({goals:[meta({monthly:null})],aportaciones:apo,expenses:base().expenses.concat([conMeta])}),{});
  assert.equal(r.aho,20000,"lo que ya va a la meta no es Ahorro");assert.equal(r.met,30000);
}],
["Gastos: max(presupuesto, gastado); sin presupuesto, lo gastado y «Libre hasta hoy»",c=>{
  let r=c.planReparto(base({budget:100}),{});
  assert.equal(r.gas,18050,"gastado pasa del presupuesto");assert.equal(r.siGastasTodo,false);
  r=c.planReparto(base(),{});assert.equal(r.gas,90000);assert.equal(r.siGastasTodo,true);
  r=c.planReparto(base({budget:0}),{});
  assert.equal(r.gas,18050);assert.equal(r.sinPresupuesto,true);assert.equal(r.st,"nobud");assert.equal(r.qGas,0);
  const otroBanco=mov("o1",9,40,{ent:"revolut",category:"ocio"});
  r=c.planReparto(base({expenses:base().expenses.concat([otroBanco]),accounts:base().accounts.concat([{ent:"revolut",role:"ahorro",value:10}])}),{});
  assert.equal(r.gastado,18050,"otro banco NO es gasto del Plan: ya va en Recibos/Deudas y Gastos no lo cuenta");
}],
["Te faltan: sin signo, «si gastas todo» y saldo frente a lo que QUEDA",c=>{
  const e=[mov("n1",3,-1000,{merchant:"Nómina Empresa SL"}),mov("g1",5,120.5,{category:"super"})];
  const s=base({expenses:e});
  let r=c.planReparto(s,{saldo:719.5});
  assert.equal(r.libre,100000-90000);// presupuesto 900 entero: aún sobran 100
  const s2=base({expenses:e,budget:1200});
  r=c.planReparto(s2,{saldo:1079.5});
  assert.equal(r.falta,20000);assert.ok(r.falta>0&&r.libre<0);assert.equal(r.siGastasTodo,true);
  assert.equal(r.queda,120000-12050,"lo que queda: presupuesto − gastado");
  assert.equal(r.st,"cubre","saldo = lo que queda: lo cubre");
  r=c.planReparto(s2,{saldo:1079.49});assert.equal(r.st,"nollega");assert.equal(r.hueco,1);
  r=c.planReparto(s2,{});assert.equal(r.st,"faltan","sin saldo no se dice nada del saldo");
  // Gastado ya por encima del presupuesto: no es «si gastas todo».
  const s3=base({expenses:[mov("n1",3,-1000,{merchant:"Nómina Empresa SL"}),mov("g9",5,1500,{category:"super"})],budget:1200});
  r=c.planReparto(s3,{saldo:10});assert.equal(r.siGastasTodo,false);assert.equal(r.falta,50000);
}],
["Todo asignado: Libre exactamente 0",c=>{
  const e=[mov("n1",3,-1000,{merchant:"Nómina Empresa SL"}),mov("g1",5,120.5,{category:"super"})];
  const r=c.planReparto(base({expenses:e,budget:1000}),{});
  assert.equal(r.libre,0);assert.equal(r.st,"todo");assert.ok(!r.trozos.some(x=>x.k==="lib"));
  assert.equal(r.trozos.reduce((a,x)=>a+x.p,0),100);
}],
["Invariante: trozos + Libre = entra, al céntimo, en 400 estados",c=>{
  let semilla=12345;const rnd=()=>(semilla=(semilla*1103515245+12345)&0x7fffffff)/0x7fffffff;
  const cts=n=>Math.round(rnd()*n)/100;
  let comprobados=0;
  for(let i=0;i<400;i++){
    const e=[];
    if(rnd()<.85) e.push(mov("n"+i,3,-(200+Math.floor(rnd()*400000)/100),{merchant:"Nómina Empresa SL"}));
    if(rnd()<.5) e.push(mov("i"+i,6,-cts(50000),{merchant:"Venta sintética"}));
    if(rnd()<.4) e.push(mov("b"+i,7,-cts(20000),{category:"bizum"}));
    for(let k=0;k<Math.floor(rnd()*6);k++) e.push(mov("g"+i+"_"+k,2+k,cts(80000)+.01,{category:"super"}));
    if(rnd()<.3) e.push(mov("v"+i,9,cts(60000),{category:"inversion",ent:"myinvestor"}));
    if(rnd()<.3) e.push(mov("m"+i,10,cts(40000),{goalId:"g1"}));
    if(rnd()<.2) e.push(mov("k"+i,5,260,{source:"ob:sabadell"}));
    const s=base({expenses:e,budget:rnd()<.2?0:Math.round(rnd()*200000)/100,
      fixed:rnd()<.6?[{id:"r1",name:"Comunidad",amount:cts(30000),day:1+Math.floor(rnd()*28),freq:"mes",account:"sabadell"}].concat(rnd()<.4?[reciboAna]:[]):[],
      debts:rnd()<.6?[deuda({restarPres:rnd()<.5,monthly:Math.round(100+rnd()*30000)/100,day:rnd()<.2?null:1+Math.floor(rnd()*28)})]:[],
      goals:rnd()<.6?[meta({monthly:rnd()<.5?cts(80000):null})]:[],
      aportaciones:rnd()<.5?[{id:"a",amount:cts(40000),ent:"myinvestor"}]:[],
      reservaLog:rnd()<.3?[{id:"x",goalId:"g1",amount:cts(30000),date:dia(4)}]:[],
      settings:{expenseBanks:["sabadell"],budgetCycle:rnd()<.3}});
    const r=c.planReparto(s,{saldo:rnd()<.5?cts(500000):null});
    assert.ok(r.trozos.every(x=>Number.isInteger(x.c)&&x.c>=0),"céntimos enteros y sin trozos negativos");
    if(r.entra==null){ assert.equal(r.libre,null);assert.ok(r.trozos.every(x=>x.k!=="lib")); continue; }
    assert.equal(suma(r)+(r.libre<0?r.libre:0)-(r.libre>0?0:0),r.libre>0?r.entra:suma(r)+r.libre,"suma de trozos");
    assert.equal(r.libre,r.entra-r.total,"Libre = entra − trozos");
    assert.equal(r.trozos.reduce((a,x)=>a+x.c,0)+(r.libre>0?0:r.libre),r.entra,"trozos + Libre = entra ("+JSON.stringify(r.trozos)+")");
    const p=r.trozos.reduce((a,x)=>a+x.p,0);
    assert.equal(p,100,"porcentajes: siempre 100, también con Te faltan");
    if(r.falta>0){ assert.equal(r.faltaP,Math.min(100,Math.max(1,Math.round(r.falta*100/r.total))),"Te faltan sobre el total"); assert.ok(r.faltaP>=1&&r.faltaP<=100); }
    else assert.equal(r.faltaP,0);
    comprobados++;
  }
  assert.ok(comprobados>250,"el banco de estados ejerce el caso con nómina ("+comprobados+")");
}],
["Mi ciclo: del cobro al mismo día del mes siguiente; cada recibo una sola vez",c=>{
  const A={id:"ra",name:"Uno",amount:95,day:1,freq:"mes",account:"sabadell"};   // 1 dic dentro, 1 nov fuera
  const B={id:"rb",name:"Veinte",amount:40,day:20,freq:"mes",account:"sabadell"};// 20 nov dentro, 20 dic fuera
  const C={id:"rc",name:"Catorce",amount:12,day:14,freq:"mes",account:"sabadell"};// 14 nov (inicio) dentro, 14 dic (fin) fuera
  const N={id:"rn",name:"Sin día",amount:7,freq:"mes",account:"sabadell"};        // sin día: el periodo que contiene el día 1
  const e=[mov("n1",14,-3000,{merchant:"Nómina Empresa SL"}),mov("gv",10,999,{category:"super"}),mov("gh",16,30,{category:"super"})];
  const s=base({expenses:e,fixed:[A,B,C,N],settings:{expenseBanks:["sabadell"],budgetCycle:true}});
  const r=c.planReparto(s,{});
  assert.equal(r.periodo.cycle,true);
  assert.equal(r.rec,Math.round((95+40+12+7)*100),"1 dic + 20 nov + 14 nov + sin día (1 dic)");
  assert.equal(r.gastado,3000,"lo anterior al cobro no es de este ciclo");
  assert.equal(r.entra,300000);
  // Mes natural con los mismos datos: lo de noviembre entero.
  const n=c.planReparto(Object.assign({},s,{settings:{expenseBanks:["sabadell"]}}),{});
  assert.equal(n.periodo.cycle,false);assert.equal(n.rec,Math.round((95+40+12+7)*100));assert.equal(n.gastado,102900);
}],
["Traspaso propio: se enseña aparte y no suma a lo que entra",c=>{
  const r=c.planReparto(base({expenses:base().expenses.concat([mov("t1",7,-500,{category:"traspaso"})])}),{});
  assert.equal(r.traspaso,50000);assert.equal(r.entra,300000);
}],
["Escalera: tu cuota hoy y cuánto baja al acabar cada deuda, en orden de fin",c=>{
  const largo=deuda({id:"dl",monthly:300,months:40,asOf:NOV-6,day:5});
  const corto=deuda({id:"dc",monthly:50,months:10,asOf:NOV-6,day:25,value:500,name:"Corta"});
  const medio=deuda({id:"dm",monthly:100,months:12,asOf:NOV-6,day:10,value:1200,name:"Media"});
  const e=c.deudasEscalera(base({debts:[largo,corto,medio]}));
  assert.equal(e.hoy,45000);
  assert.deepEqual(Array.from(e.pasos.map(x=>x.id)),["dc","dm","dl"],"orden de fin");
  assert.deepEqual(Array.from(e.pasos.map(x=>x.v)),[40000,30000,0]);
  // dc: 10 cuotas con 6 pagadas y la del día 25 aún sin pagar: quedan 4 (nov, dic, ene, feb) y baja desde marzo.
  assert.equal(e.pasos[0].ultimo,2026*12+10+3);
  assert.equal(e.pasos[0].desde,e.pasos[0].ultimo+1);
  // Una deuda con descuento escala con tu parte entera (banco + descontado).
  assert.equal(c.deudasEscalera(base({debts:[deuda()],fixed:[reciboAna]})).hoy,30000);
  // Sin deudas vivas no hay escalera.
  assert.deepEqual(JSON.parse(JSON.stringify(c.deudasEscalera(base({debts:[deuda({months:6,asOf:NOV-12})]})))),{hoy:0,pasos:[]});
}],
["Metas arriba: ritmo, hueco para llegar a tiempo y fechas pasadas con la previsión de siempre",c=>{
  const gs=[meta({id:"a",target:1200,saved:0,monthly:50,deadline:"2027-11"}),
    meta({id:"b",target:600,saved:0,monthly:200,deadline:"2027-05"}),
    meta({id:"c",target:500,saved:100,monthly:null,deadline:"2026-09"}),
    meta({id:"d",target:100,saved:100,monthly:null,done:true})];
  const r=c.metasResumen(rr(base({goals:gs})));
  assert.equal(r.ritmo,25000);assert.equal(r.vencidas,1);
  assert.equal(r.hueco,Math.ceil(120000/12)-5000,"solo la que va tarde, lo que le falta al mes");
  assert.equal(r.ahorrado,20000);assert.equal(r.objetivo,240000);
  assert.equal(r.conFecha,3,"las abiertas con fecha (la hecha no cuenta)");
  // Sin ninguna fecha no hay «A tiempo · Todas» que decir.
  assert.equal(c.metasResumen(rr(base({goals:[meta({id:"s",target:500,saved:0,monthly:50}),meta({id:"t",target:900,saved:0,monthly:null})]}))).conFecha,0);
}],
["Te faltan: los porcentajes suman 100 sobre lo que hay que pagar y lo que falta es una parte de eso",c=>{
  // Entran 1.500 y el plan pide mucho más: 1.500 de base daría 236 %, que no dice nada.
  const e=base().expenses.map(x=>x.amount<0?Object.assign({},x,{amount:-1500}):x);
  const r=c.planReparto(rr(base({expenses:e,budget:900,goals:[meta({id:"a",monthly:800})]})),{});
  assert.ok(r.falta>0&&r.entra===150000,"el caso es de Te faltan");
  assert.equal(r.trozos.reduce((a,x)=>a+x.p,0),100,"suman 100");
  assert.ok(r.trozos.every(x=>x.p>=0&&x.p<=100),"ninguno pasa de 100");
  assert.equal(r.faltaP,Math.round(r.falta*100/r.total),"lo que falta, sobre el mismo total");
  assert.ok(r.faltaP<=100);
  const rec=r.trozos.find(x=>x.k==="rec");
  assert.equal(rec.p,Math.round(rec.c*100/r.total),"cada trozo, su parte del total (entre redondeos)");
}],
["Icono de deuda: «casa» en el nombre no fuerza la casa",c=>{
  const k=n=>c.debtIcoKind(n);
  assert.equal(k("Financiación del gimnasio en casa con cinta"),"card");
  assert.equal(k("Hipoteca del piso"),"home");assert.equal(k("Préstamo del coche"),"car");
  assert.equal(k("Reforma de la casa"),"card","«casa» a secas no es la hipoteca");
  assert.equal(k("Móvil nuevo"),"phone");assert.equal(k("Préstamo a mamá"),"person");
  assert.equal(k("Máster de la universidad"),"study");assert.equal(k("Unidad de cocina"),"card","«uni» dentro de otra palabra no es estudios");
}],
["Interruptor: la reserva se calcula, mueve el dinero de Gastos a Libre y no escribe nada",c=>{
  const off=base({debts:[deuda()],fixed:[reciboAna]}),on=base({debts:[deuda({restarPres:true})],fixed:[reciboAna]});
  const antes=JSON.stringify(on),a=c.planReparto(off,{}),b=c.planReparto(on,{});
  assert.equal(JSON.stringify(on),antes,"el estado no se toca");assert.deepEqual(on.reservaLog,[],"y no hay reserva escrita");
  assert.equal(b.reservaDeudas,30000,"tu parte de la cuota: 260 + 40");
  assert.equal(b.presupuesto,90000-30000);assert.equal(b.gas,60000);
  assert.equal(b.movido,30000);assert.equal(b.libre-a.libre,30000,"Libre sube lo mismo que baja Gastos");
  assert.equal(b.entra,a.entra,"no entra dinero");assert.equal(b.deu,a.deu,"la cuota sigue en Deudas");
  // Se pasa del presupuesto que queda: «Te pasas».
  const pasa=base({debts:[deuda({restarPres:true})],expenses:base().expenses.concat([mov("g8",9,500,{category:"super"})])});
  const p=c.planReparto(pasa,{});
  assert.equal(p.pasa,true);assert.equal(p.pasaC,Math.round((680.5-(900-260))*100));assert.equal(p.gas,68050);
  // Deuda acabada o sin cuota este mes: no resta.
  assert.equal(c.planReparto(base({debts:[deuda({restarPres:true,months:6,asOf:NOV-12})]}),{}).reservaDeudas,0);
}],
["Interruptor: un cargo de cuota sin enlazar no resta dos veces",c=>{
  const s=base({debts:[deuda({restarPres:true})],expenses:base().expenses.concat([cargoCuota])});
  const r=c.planReparto(s,{});
  assert.equal(r.gastado,18050,"el cargo de la cuota no es además gasto");
  assert.equal(r.presupuesto,90000-26000);
  const mb=c.monthBudgetStats(s);
  assert.equal(mb.spent,180.5,"Inicio tampoco lo cuenta dos veces");assert.equal(mb.budget,640);assert.equal(mb.reserved,260);
  // Con el interruptor apagado Inicio sigue contándolo como siempre (cifra de antes).
  const off=c.monthBudgetStats(base({debts:[deuda()],expenses:base().expenses.concat([cargoCuota])}));
  assert.equal(off.spent,440.5);assert.equal(off.budget,900);
  // Enlazado (debtId) o no: una sola resta.
  const enlazado=base({debts:[deuda({restarPres:true})],expenses:base().expenses.concat([Object.assign({},cargoCuota,{debtId:"d1",category:"deudas"})])});
  assert.equal(c.monthBudgetStats(enlazado).spent,180.5);assert.equal(c.monthBudgetStats(enlazado).budget,640);
  // Otro importe el mismo mes (una amortización extra) sí es gasto normal.
  const extra=base({debts:[deuda({restarPres:true})],expenses:base().expenses.concat([Object.assign({},cargoCuota,{id:"c2",amount:1000})])});
  assert.equal(c.monthBudgetStats(extra).spent,1180.5);
}],
["Interruptor puesto: Inicio y Gastos bajan el límite lo que cuesta la cuota (también en Mi ciclo)",c=>{
  const on=base({debts:[deuda({restarPres:true})],fixed:[reciboAna]});
  const mb=c.monthBudgetStats(on);assert.equal(mb.reserved,300);assert.equal(mb.budget,600);assert.equal(mb.remaining,419.5);
  const ciclo=Object.assign({},on,{settings:{expenseBanks:["sabadell"],budgetCycle:true},expenses:[mov("n1",14,-3000,{merchant:"Nómina Empresa SL"}),mov("gh",16,30,{category:"super"})]});
  const mc=c.monthBudgetStats(ciclo);
  assert.equal(mc.cycle,true);assert.equal(mc.reserved,260+40,"la cuota del 5 de diciembre cae en el ciclo del 14/11 al 14/12; su descuento, de su recibo del 12");
  assert.equal(c.monthBudgetStats(Object.assign({},ciclo,{debts:[deuda()]})).reserved,0,"apagado, nada");
}],
["Con todo apagado, ninguna cifra actual cambia (oráculo de la rama anterior)",c=>{
  const pick=b=>({spent:b.spent,income:b.income,balance:b.balance,budget:b.budget,reserved:b.reserved,remaining:b.remaining,against:b.against,shown:b.shown,cycle:b.cycle,nomina:b.nomina});
  const real=escenariosApagado().map(s=>({mes:pick(c.monthBudgetStats(s)),dash:pick(c.dashboardBudgetStats(s)),res:c.reservedSince(s,0),modo:pick(c.monthBudgetStats(s,null,null,"net"))}));
  assert.deepEqual(JSON.parse(JSON.stringify(real)),ORACULO_APAGADO);
}],
["Gastos del Plan == gastado de Gastos (mismo state y periodo), con otro banco, cuota, recibo, devolución y traspaso",c=>{
  for(const ciclo of [false,true]){
    const s=base({settings:{expenseBanks:["sabadell"],budgetCycle:ciclo},
      accounts:base().accounts.concat([{ent:"bbva",role:"ahorro",value:10}]),
      debts:[deuda()],fixed:[{id:"r1",name:"Comunidad",amount:95,day:1,freq:"mes",account:"sabadell"}],
      expenses:base().expenses.concat([
        mov("o1",9,300,{ent:"bbva",category:"ocio"}),mov("o2",10,412.7,{ent:"bbva",category:"hogar"}),
        mov("c1",5,260,{category:"deudas",source:"ob:sabadell",debtId:"d1"}),
        mov("rc",6,95,{category:"otros",reciboId:"r1"}),
        mov("dv",8,-30,{merchant:"Devolución pedido"}),
        mov("tr",7,500,{category:"traspaso"}),mov("tr2",7,-500,{category:"traspaso"})])});
    const bs=c.monthBudgetStats(s), r=c.planReparto(s,{});
    assert.equal(r.gastado,Math.round(bs.spent*100)-r.devolucion,"ciclo="+ciclo+": Plan = Gastos menos devoluciones (que Gastos cuenta como ingreso)");
    assert.equal(r.gastado,18050-3000,"solo super+ocio, sin otro banco, cuota, recibo ni traspaso");
  }
}],
["Metas: un «importe mensual» suelto en la meta (sin regla) NO es «Apartas» ni resta de Libre; una regla sí",c=>{
  const g=[{id:"g1",name:"Disney",target:1743,saved:395,monthly:290},{id:"g2",name:"Mueble",target:500,saved:0}];
  const sin=c.planReparto(base({goals:g}),{});
  assert.equal(sin.met,0,"sin regla ni movimientos, nada asignado");
  assert.equal(sin.nMet,0);
  assert.equal(c.metasResumen(base({goals:g})).ritmo,0,"la cabecera de Metas tampoco dice «apartas 290»");
  assert.equal(sin.libre,sin.entra-sin.total);
  const con=base({goals:g,settings:{expenseBanks:["sabadell"],reservaRules:[{id:"r1",name:"",kind:"fixed",value:150,goalId:"g1",mensual:true}]}});
  assert.equal(c.planReparto(con,{}).met,15000,"con regla, su importe");
  assert.equal(c.planReparto(con,{}).libre,sin.libre-15000);
  const mov1=base({goals:g,reservaLog:[{id:"x",goalId:"g1",amount:40,date:dia(4)}]});
  assert.equal(c.planReparto(mov1,{}).met,4000,"un movimiento real del periodo sí cuenta");
  assert.equal(c.goalEta(g[0],c.metaRitmoMensual(base({goals:g}),g[0])).text!=="",true,"la previsión sigue usando el importe de la meta");
}],
];

let fallos=0;
function correr(c,etiqueta,esperaCaer){
  const caen=[];
  for(const [nombre,fn] of SUITE){
    try{ fn(c); if(!esperaCaer) console.log("✓ "+nombre); }
    catch(e){ caen.push(nombre); if(!esperaCaer){ fallos++; console.log("✗ "+nombre+"\n    "+String(e.message).split("\n")[0]); } }
  }
  return caen;
}
const c=cargarMotor();
correr(c,"real",false);
if(fallos){ console.log("FALLOS: "+fallos); process.exit(1); }

/* MUTANTES. Cada uno estropea UNA regla; la suite tiene que caer en al menos un caso. */
const MUTANTES=[
  ["Gastos ignora lo gastado por encima del presupuesto","gasC=lim==null?gastado:Math.max(lim,gastado)","gasC=lim==null?gastado:lim"],
  ["Recibos cuenta también las deudas","if(x.kind===\"debt\"||x.kind===\"balloon\"||","if(x.kind===\"balloon\"||"],
  ["Deudas resta el descuento en vez de sumarlo","propia:a+desc}","propia:Math.max(0,a-desc)}"],
  ["Una devolución cuenta como ingreso","if(repEsDevolucion(e)) devolucion+=c;","if(false) devolucion+=c;"],
  ["Sin nómina no se esconde el Libre","const esperaNomina=!nominaLlego&&nominaAntes;","const esperaNomina=false;"],
  ["Metas ignora lo ya movido","metC+=Math.max(ritmo,h);","metC+=ritmo;"],
  ["Ahorro cuenta lo que va a una meta","metaGastos[id]=(metaGastos[id]||0)+c; }","metaGastos[id]=(metaGastos[id]||0)+c; if(e.category===\"inversion\") inversion+=c; }"],
  ["El cargo de cuota sin enlazar cuenta como gasto","if(!sinEnlazar.has(e)) gastado+=c;","gastado+=c;"],
  ["El interruptor no baja el límite","limRaw=bud==null?null:bud-reservasC-resD.total","limRaw=bud==null?null:bud-reservasC"],
  ["Libre mal calculado","libre=entraC==null?null:entraC-total,","libre=entraC==null?null:entraC-total+1,"],
  ["Los traspasos entran como ingreso","if(CAT_NEUTRAS[e.category]){ if(e.category===\"traspaso\") traspaso+=repCts(-e.amount); return; }","if(false){ return; }"],
  ["Una reserva no cuenta como Meta","reservasC+=c;","reservasC+=0;"],
  ["El saldo justo no cubre","saldoC>=quedaC","saldoC>quedaC"],
  ["El ciclo no acota recibos","return v>=k(P.ini.y,P.ini.m,P.ini.d) && v<k(P.fin.y,P.fin.m,P.fin.d);","return true;"],
  ["El gasto con meta cuenta como gasto","if(b===\"cuenta\"&&expenseCountsBudget(e,state)){","if((b===\"cuenta\"&&expenseCountsBudget(e,state))||b===\"meta\"){"],
  ["El presupuesto ignora lo reservado","limRaw=bud==null?null:bud-reservasC-resD.total","limRaw=bud==null?null:bud-resD.total"],
  ["Otro banco cuenta como gasto del Plan","if(b===\"cuenta\"&&expenseCountsBudget(e,state)){","if((b===\"cuenta\"&&expenseCountsBudget(e,state))||b===\"otrobanco\"){"],
  ["El importe suelto de la meta cuenta como apartado","const ritmo=repCts(metaRitmoReglas(state,g))","const ritmo=repCts(metaRitmoMensual(state,g))"],
  ["Los porcentajes no reparten los restos",".slice(0,Math.max(0,resto))",".slice(0,0)"],
];
let sobreviven=0;
for(const [nombre,de,a] of MUTANTES){
  const fuente=fs.readFileSync(new URL("../src/modules/17-plan-reparto.js",import.meta.url),"utf8");
  assert.ok(fuente.includes(de),"el mutante «"+nombre+"» ya no encaja con el motor: actualízalo");
  const cm=cargarMotor(t=>t.replace(de,a));
  const caen=correr(cm,nombre,true);
  if(!caen.length){ sobreviven++; console.log("✗ SOBREVIVE el mutante: "+nombre); }
  else console.log("☠ mutante muerto: "+nombre+" ← "+caen[0]);
}
if(fallos||sobreviven){ console.log("\nFALLOS: "+fallos+" · mutantes vivos: "+sobreviven); process.exit(1); }
console.log("\nplan-reparto: "+SUITE.length+" casos y "+MUTANTES.length+" mutantes muertos");
