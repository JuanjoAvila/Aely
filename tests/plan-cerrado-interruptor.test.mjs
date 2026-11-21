// «Restar del presupuesto» NO toca los meses ya cerrados: octubre 2026 (reloj en 21/11/2026) queda igual
// con el interruptor encendido o apagado (límite 900, margen +200); el mes en curso sí baja a 640.
// Cifras inventadas. Se corre con TZ=Europe/Madrid y TZ=UTC.
import assert from "node:assert/strict";
import {cargarMotor,base,NOV,mov,dia} from "./helpers/plan-reparto-fixture.mjs";

const c=cargarMotor();
const oct=(d,a,x)=>Object.assign({id:"o"+d+"_"+a,date:dia(d,10),amount:a,category:a<0?"ingreso":"otros",merchant:"Oct "+d,ent:"sabadell",source:"manual"},x||{});
const deuda=on=>({id:"d1",name:"Préstamo sintético",value:12000,monthly:260,months:40,day:5,asOf:NOV-6,account:"sabadell",restarPres:on});
const estado=on=>base({budgetByMonth:{"2026-10":900},expenses:[oct(3,-3000,{merchant:"Nómina Empresa SL"}),oct(10,700)],debts:[deuda(on)]});
const startOct=new Date(2026,9,1).getTime(), endOct=new Date(2026,10,1).getTime();

for(const on of [false,true]){
  const s=c.closedMonthBudgetStats(estado(on),startOct,endOct);
  assert.equal(s.budget,900,"octubre cerrado: límite 900 con interruptor "+on);
  assert.equal(s.reserved,0,"sin reserva en un mes cerrado ("+on+")");
  assert.equal(+s.remaining.toFixed(2),200,"margen +200 ("+on+")");
  const m=c.monthBudgetStats(estado(on),startOct+12*864e5);
  assert.equal(m.budget,900,"imagen de mes cerrado (sin hastaMs) igual ("+on+")");
  assert.equal(+m.remaining.toFixed(2),200);
}
// El mes en curso sí cambia: 900 − 260 = 640.
const cur=on=>base({debts:[deuda(on)]});
assert.equal(c.monthBudgetStats(cur(false),Date.now()).budget,900);
assert.equal(c.monthBudgetStats(cur(true),Date.now()).budget,640,"el mes en curso sí baja el límite");
console.log("plan-cerrado-interruptor: ok");
