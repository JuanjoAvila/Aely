// El widget (servidor) tiene que restar de su presupuesto lo MISMO que Inicio cuando una deuda tiene el
// interruptor «Restar del presupuesto». Se cargan las dos implementaciones (cliente real con el reloj del
// 21/11/2026 y `_shared/presupuesto.ts` pasado por esbuild) y se exige el mismo número, al céntimo.
// Cifras inventadas. TZ=Europe/Madrid y TZ=UTC.
import assert from "node:assert/strict";
import fs from "node:fs";
import { transformSync } from "esbuild";
import {cargarMotor,AHORA,base,NOV,mov,dia,escenariosApagado} from "./helpers/plan-reparto-fixture.mjs";

const src=fs.readFileSync(new URL("../supabase/functions/_shared/presupuesto.ts",import.meta.url),"utf8");
const js=transformSync(src,{loader:"ts",format:"esm"}).code;
const srv=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
// El servidor usa Date.now() por defecto: se fija al mismo reloj que el cliente (sin esto, el test dependía del día real: el 25/11 la cuota del día 25 ya estaba pagada y daba 0 frente a 600,03).
Date.now=()=>AHORA;
const c=cargarMotor();
const deuda=extra=>Object.assign({id:"d1",name:"Préstamo sintético",value:12000,monthly:260,months:40,day:5,asOf:NOV-6,account:"sabadell",restarPres:true},extra||{});
const reciboAna=(extra)=>Object.assign({id:"r2",name:"Fibra sintética",amount:50,bankAmount:90,day:12,freq:"mes",account:"sabadell",
  reparto:[{id:"p1",n:"Ana",via:"debt",debtId:"d1",amt:40}]},extra||{});
const inicioMes=srv.inicioDeMesMs(AHORA);
let n=0;
function igual(nombre,s,desde){
  const cli=c.monthBudgetStats(s,undefined),ini=desde!=null?desde:cli.periodStart;
  const sv=srv.statsDelMes([],s,ini);
  assert.equal(sv.reserved,cli.reserved,nombre+": reservado");
  assert.equal(sv.budget,cli.budget,nombre+": presupuesto");
  n++;
}
const casos={
  "una deuda sin descuento":base({debts:[deuda({monthly:260})]}),
  "con descuento de un recibo compartido":base({debts:[deuda()],fixed:[reciboAna()]}),
  "descuento que no cuadra al céntimo: no se reparte":base({debts:[deuda()],fixed:[reciboAna({amount:51})]}),
  "recibo pausado ese mes":base({debts:[deuda()],fixed:[reciboAna({pausedFrom:NOV,pausedUntil:NOV+2})]}),
  "recibo solo este mes distinto":base({debts:[deuda()],fixed:[reciboAna({soloMes:{[2026*12+11]:{amt:60,reparto:[{id:"p1",n:"Ana",via:"debt",debtId:"d1",amt:30}]}}})]}),
  "dos deudas y una apagada":base({debts:[deuda(),deuda({id:"d2",monthly:100,day:20,restarPres:false}),deuda({id:"d3",monthly:75.5,day:9})]}),
  "deuda con interés: no se descuenta":base({debts:[deuda({apr:3})],fixed:[reciboAna()]}),
  "deuda acabada":base({debts:[deuda({months:6,asOf:NOV-12})]}),
  "última cuota con ajuste":base({debts:[deuda({monthly:600.03,value:7200.36,months:12,asOf:NOV-11,day:25})]}),
  "compra a plazos que empieza el mes que viene":base({debts:[deuda({asOf:NOV+1,months:12,value:1200,monthly:100})]}),
  "con reservas de metas":base({debts:[deuda()],reservaLog:[{id:"x",goalId:"g1",amount:150,date:dia(4)}]}),
  "interruptor apagado":base({debts:[deuda({restarPres:false}),deuda({id:"d2",restarPres:undefined})],fixed:[reciboAna()]}),
};
for(const [nombre,s] of Object.entries(casos)) igual(nombre,s);
// Mi ciclo: del 14/11 al 14/12; la cuota del 5 de diciembre y su descuento caen dentro.
{
  const s=base({debts:[deuda()],fixed:[reciboAna()],settings:{expenseBanks:["sabadell"],budgetCycle:true},
    expenses:[mov("n1",14,-3000,{merchant:"Nómina Empresa SL"}),mov("gh",16,30,{category:"super"})]});
  const cli=c.monthBudgetStats(s);
  assert.equal(cli.cycle,true);assert.equal(cli.reserved,300);
  const sv=srv.statsDelMes([],s,cli.periodStart);
  assert.equal(sv.reserved,300,"ciclo: reservado");assert.equal(sv.budget,600,"ciclo: presupuesto");n++;
}
// Apagado: el servidor devuelve lo de siempre (solo reservas de metas) y el oráculo del cliente coincide.
for(const s of escenariosApagado()){
  if((s.settings||{}).budgetCycle) continue;
  const sv=srv.statsDelMes([],s,inicioMes);
  assert.equal(sv.reserved,srv.reservadoDesde(s,inicioMes),"sin interruptor, reservado = reservaLog");
  assert.equal(srv.reservadoDeudas(s,inicioMes,AHORA),0);n++;
}
assert.equal(srv.reservadoDeudas(base({debts:[deuda()]}),inicioMes,AHORA),260);
console.log("presupuesto-deudas-servidor: "+n+" escenarios iguales en cliente y servidor");
