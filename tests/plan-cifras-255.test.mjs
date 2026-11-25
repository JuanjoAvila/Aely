// CIFRAS DEL PLAN vs GASTOS (beta 4.26.255, capturas del dueño del 24/11/2026): tres fallos de dinero.
//  1) «Queda por pagar» de la hoja ≠ tarjeta de Recibos (1.173,40 vs 247,81): solo recibos y cuotas sin pagar.
//  2) El Plan gastaba el BRUTO (881,08) y Gastos el NETO (881,08 − otros ingresos 140,35 = 740,73).
//  3) «Restar del presupuesto»: Gastos no bajaba el límite igual que el Plan (259 en vez de 84,79 «por debajo»).
// Motor real, reloj 21/11/2026; sus cifras, con nombres inventados. TZ=Europe/Madrid y TZ=UTC.
import assert from "node:assert/strict";
import {cargarMotor,base,NOV,mov} from "./helpers/plan-reparto-fixture.mjs";

const c=cargarMotor();
const rec=(id,name,amount,day)=>({id,name,amount,day,freq:"mes",account:"sabadell"});
const gym=extra=>Object.assign({id:"gym",name:"Financiación gym en casa",value:174.48,original:1040,monthly:174.48,months:1,day:29,asOf:NOV,account:"sabadell"},extra||{});
const previa=extra=>Object.assign({id:"otra",name:"Otras cuotas",value:20000,monthly:910.85,months:30,day:2,asOf:NOV-4,account:"sabadell"},extra||{});
function escenario(o){
  o=o||{};
  return base({budget:1000,
    expenses:[mov("n1",3,-3333,{merchant:"Nómina Empresa SL"}),
      mov("i1",18,-90.35,{merchant:"Comida love"}),mov("i2",19,-50,{merchant:"Comida ivan"}),
      mov("g1",5,400,{category:"super"}),mov("g2",9,300,{category:"ocio"}),mov("g3",14,181.08,{category:"super"}),mov("p1",2,272.7,{merchant:"Alquiler trastero",source:"ob",category:"otros",reciboId:"r1"})].concat(o.extra||[]),
    fixed:[rec("r1","Alquiler trastero",272.7,2),rec("r2","GC RE OCTOPUS ENERGY",67.58,25),rec("r3","Gas (Pepe Energy)",5.75,25)],
    debts:[previa(),gym({restarPres:!!o.restar})],aportaciones:[{id:"a1",name:"Fondo",amount:1050}]});
}
const SUITE=[
["Fallo 1: «Queda por pagar» = lo pendiente de recibos y cuotas (247,81), y Te quedaría sale de ahí",()=>{
  const s=escenario();
  const r=c.planReparto(s,{saldo:6656.94});
  assert.equal(r.qRec,7333,"67,58 + 5,75");assert.equal(r.qDeu,17448,"la cuota del gimnasio");
  assert.equal(r.quedaPagar,24781,"247,81, la cifra de la tarjeta de Recibos");
  const pack=c.planChargesMonth(s,11,2026,21);
  assert.equal(Math.round(pack.pendingBillsTotal*100),r.quedaPagar,"misma cifra que la tarjeta del Plan");
  assert.equal(r.rec+r.deu,34603+108533,"cascada: recibos 346,03 y deudas 1.085,33 (7 recibos... 3 cuotas del reparto)");
  assert.ok(r.queda>r.quedaPagar,"el total con ahorro y metas existe aparte y NO se llama «por pagar»");
}],
["Fallo 2: el Plan gasta el NETO de Gastos (881,08 − 140,35 = 740,73), sin contar los otros ingresos como sueldo",()=>{
  const s=escenario(),r=c.planReparto(s,{});
  assert.equal(r.gastado,74073);
  assert.equal(r.neteo,14035);
  assert.equal(r.neteoEntra,0,"con el gasto por debajo del límite la fila Gastos no baja por el neteo");
  assert.equal(r.entra,333300+14035,"entran la nómina Y los Bizums de las comidas (25/11): dinero real; no se restan dos veces porque la fila vale el límite");
  const mb=c.monthBudgetStats(s,null,null,"mes");
  assert.equal(mb.spent,881.08);assert.equal(mb.against,740.73,"Gastos: el mismo neto");
  assert.equal(Math.round(mb.against*100),r.gastado,"UNA cifra en las dos pantallas");
  assert.equal(r.libre,r.entra-r.total,"y la cuenta sigue cuadrando al céntimo");
}],
["Fallo 2b: lo neteado no pasa de lo gastado; el resto queda en lo que entra",()=>{
  const s=escenario({extra:[mov("i3",20,-900,{merchant:"Venta de un mueble"})]});
  const r=c.planReparto(s,{});
  assert.equal(r.gastado,0);assert.equal(r.neteo,88108,"solo hasta lo gastado");
  assert.equal(r.entra,333300+14035+90000,"con el límite por encima de lo gastado el neteo no baja la fila: todo el ingreso cuenta");
}],
["Ingresos del mes: por encima del límite el neteo ya bajó la fila y no vuelve a contar en lo que entra (sin doble conteo)",()=>{
  const s=Object.assign(escenario(),{budget:500});
  const r=c.planReparto(s,{});
  assert.equal(r.gastado,74073,"neto, como Gastos");
  // fila Gastos = max(límite 500, 740,73) = 740,73; con el bruto sería 881,08 (140,35 más): esos 140,35 ya están en la fila.
  assert.equal(r.gas,74073);assert.equal(r.neteoEntra,14035);
  assert.equal(r.entra,333300,"sueldo + ingresos − lo que el neteo ya ahorró en Gastos");
  // la cuenta con el bruto da lo mismo: entra 3.473,35 − 881,08 en Gastos
  assert.equal(r.entra-r.gas,333300+14035-88108);
}],
["Fallo 3: con «Restar del presupuesto» Plan y Gastos bajan el límite igual (84,79 por debajo)",()=>{
  const s=escenario({restar:true}),r=c.planReparto(s,{});
  assert.equal(r.reservaDeudas,17448);
  assert.equal(r.presupuesto,100000-17448,"825,52");
  const mb=c.monthBudgetStats(s,null,null,"mes");
  assert.equal(mb.budget,825.52);assert.equal(mb.reserved,174.48);
  assert.equal(+mb.remaining.toFixed(2),84.79,"Gastos: 825,52 − 740,73");
  assert.equal(Math.round(mb.remaining*100),r.presupuesto-r.gastado,"y el Plan dice lo mismo");
  const ds=c.dashboardBudgetStats(s);assert.equal(+ds.remaining.toFixed(2),84.79,"Inicio también");
}],
["Un ingreso en un banco que no es del día a día no netea (mes natural); en Mi ciclo sí, como Gastos",()=>{
  const otro=mov("o1",20,-500,{merchant:"Venta de un mueble",ent:"bbva"});
  const b=base({expenses:base().expenses.concat([otro]),accounts:base().accounts.concat([{ent:"bbva",role:"ahorro",value:10}])});
  const r=c.planReparto(b,{});
  assert.equal(r.neteo,0);assert.equal(r.gastado,18050);assert.equal(r.entra,300000+50000);
  const cy=Object.assign({},b,{settings:{expenseBanks:["sabadell"],budgetCycle:true},expenses:[mov("n1",14,-3000,{merchant:"Nómina Empresa SL"}),mov("gh",16,400,{category:"super"}),mov("o1",18,-500,{merchant:"Venta",ent:"bbva"})]});
  const rc=c.planReparto(cy,{}),mb=c.monthBudgetStats(cy);
  assert.equal(rc.neteo,40000,"neteo hasta lo gastado");assert.equal(rc.gastado,0);
  assert.ok(mb.against<=0,"Gastos ciclo: el ingreso de otro banco también devuelve margen");
}],
["Una devolución mayor que lo gastado no deja gastado negativo",()=>{
  const r=c.planReparto(base({expenses:base().expenses.concat([mov("v1",9,-900,{merchant:"Devolución pedido"})])}),{});
  assert.equal(r.gastado,0);
}],
];
let fallos=0;
for(const [n,f] of SUITE){ try{ f(); console.log("✓ "+n); }catch(e){ fallos++; console.log("✗ "+n+"\n   "+e.message); } }
if(fallos){ console.log("FALLOS: "+fallos); process.exit(1); }
console.log("plan-cifras-255: "+SUITE.length+" casos");
