// UNA sola fecha de fin por deuda: `debtUltimoMes` (17) alimenta la ficha («acabas en») y la escalera.
// El oráculo es la fórmula de `endsLabel` de la beta 4.26.249, copiada tal cual (mes absoluto): si
// alguien vuelve a separar las dos cuentas, este test cae. Reloj clavado en el 21/11/2026 (Madrid).
import assert from "node:assert/strict";
import {cargarMotor,base,NOV} from "./helpers/plan-reparto-fixture.mjs";

const c=cargarMotor();
const oraculo249=d=>{
  const li=c.debtLeftInfo(d);
  if(!li) return null;
  const p=c.madridYmdParts(Date.now());
  const futura=d.months!=null&&li.n>0&&typeof d.asOf==="number"&&d.asOf>(p.y*12+p.m-1);
  const pendiente=d.months!=null&&li.n>0&&!futura&&c.debtChargeDay(d,p.y,p.m)>p.d;
  return futura?d.asOf+li.n-1:p.y*12+p.m-1+li.n-(pendiente?1:0);
};
const mk=x=>Object.assign({id:"d1",name:"Deuda sintética",value:1200,monthly:100,day:5,account:"sabadell"},x);
const CASOS={
  "con plazo, cuota ya cobrada este mes":mk({months:12,asOf:NOV-6,day:5}),
  "con plazo, cuota pendiente este mes":mk({months:12,asOf:NOV-6,day:28}),
  "ancla futura":mk({months:6,asOf:NOV+2}),
  "con plazo que cruza de año":mk({months:30,asOf:NOV-3,day:1}),
  "sin plazo (saldo estimado)":mk({value:72.45,monthly:10.35,months:undefined,day:1,asOf:NOV}),
  "sin plazo, día aún por llegar":mk({value:500,monthly:50,months:undefined,day:28,asOf:NOV-2}),
  "sin plazo que cruza de año":mk({value:900,monthly:60,months:undefined,day:3,asOf:NOV-1}),
};
let n=0;
for(const [nombre,d] of Object.entries(CASOS)){
  const esp=oraculo249(d), real=c.debtUltimoMes(d);
  assert.equal(real,esp,nombre+": debtUltimoMes se separó de endsLabel (249)");
  const pasos=c.deudasEscalera(base({debts:[d],accounts:base().accounts})).pasos;
  if(pasos.length) assert.equal(pasos[0].ultimo,esp,nombre+": la escalera se separó de endsLabel");
  n++;
}
// El caso que se rompió: sin plazo, 72,45 con cuota 10,35 el día 1 acaba en junio de 2027 (la spec de e2e).
const sp=CASOS["sin plazo (saldo estimado)"], m=c.debtUltimoMes(sp);
assert.equal(m,2027*12+5,"72,45 con cuota de 10,35 acaba en junio de 2027");
console.log("plan-fin-deuda: "+n+" casos iguales que endsLabel de la 249");
