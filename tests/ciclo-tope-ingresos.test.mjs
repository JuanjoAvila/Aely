// MI CICLO NO DA MÁS MARGEN QUE EL LÍMITE (caso real de producción del 28/11/2026, en catalán).
// Límite de 650 €, la nómina del ciclo ya cobrada y la siguiente aún por llegar. Una entrada grande
// que no es la nómina ni reembolsa nada (la nómina pasada a otro banco, sin la pata de salida a la
// vista) dejaba el gasto neto en −567 €: Inicio a «0 %» con 1.217 € libres y el widget «Pots gastar
// 1.217 €» cuando en realidad se había pasado. Importes y nombres inventados.
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPureLogic } from "../scripts/load-pure-logic.mjs";

const source=file=>fs.readFileSync(new URL("../"+file,import.meta.url),"utf8").replaceAll("\r\n","\n");
const order=JSON.parse(source("src/build-order.json"));
const AHORA=Date.parse("2026-11-28T12:00:00Z");
const c=loadPureLogic(source("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>order.map(f=>source("src/modules/"+f)).join("\n")));
c.Date=class extends Date{ constructor(...a){ super(...(a.length?a:[AHORA])); } static now(){ return AHORA; } };

const fila=(id,ent,date,amount,merchant,category,extra)=>Object.assign({id,ent,date:date+"T12:00:00.000Z",amount,merchant,obName:merchant,category,source:"ob",status:"BOOK"},extra||{});
const NOMINA=fila("nom","bancoa","2026-10-30",-1400,"NOMINA EJEMPLO SL","ingreso");
const COMPRAS=[fila("g1","bancob","2026-11-05",400,"Super Ejemplo","super"),fila("g2","bancob","2026-11-15",300,"Ropa Ejemplo","ropa"),fila("g3","bancob","2026-11-25",133,"Cena Ejemplo","restaurantes")];
// La nómina pasada de un banco a otro: llega sin nombre y su salida no está a la vista.
const LLEGA=fila("llega","bancob","2026-11-02",-1400,"Movimiento","ingreso");
const estado=(expenses)=>JSON.parse(JSON.stringify({
  accounts:[{id:"a",ent:"bancoa",role:"fijos",value:100},{id:"b",ent:"bancob",role:"diario",spendFrom:true,value:900}],
  fixed:[],debts:[],oneoffs:[],flows:[],expenses,bankTx:[],deleted:[],investments:[],assets:[],aportaciones:[],obAccounts:[],budget:650,
  settings:{budgetCycle:true,expenseBanks:["bancob"],gTotalMode:"split",lang:"ca"}
}));
let n=0;
const caso=(nombre,fn)=>{ fn(); n++; console.log("  ✓ "+nombre); };

caso("el caso real: 833 € de compras y una entrada de 1.400 € que no es la nómina → se ha pasado",()=>{
  const s=estado([NOMINA,...COMPRAS,LLEGA]);
  const b=c.dashboardBudgetStats(s);
  assert.equal(b.cycle,true);
  assert.equal(+b.spent.toFixed(2),833);
  assert.equal(b.against,833,"la entrada genérica no devuelve margen (antes: −567)");
  assert.equal(+b.remaining.toFixed(2),-183,"se ha pasado 183 € (antes: 1.217 € libres)");
  assert.ok(b.remaining<=b.budget,"libre nunca supera el límite");
  assert.deepEqual(Array.from(b.grandes),[c.keyOfExpense(s.expenses[4])],"el widget sabe qué fila no devuelve margen");
});
caso("los Bizums que le devuelven sí devuelven margen, pero nunca más que el límite",()=>{
  const biz=(id,d,x)=>fila(id,"bancob",d,-x,"Bizum recibido","bizum",{source:"macrodroid"});
  const s=estado([NOMINA,...COMPRAS,biz("z1","2026-11-26",100),biz("z2","2026-11-27",33)]);
  assert.equal(c.dashboardBudgetStats(s).against,700);
  const mucho=estado([NOMINA,fila("g","bancob","2026-11-05",50,"Cena","restaurantes"),biz("z","2026-11-06",180),fila("t","bancob","2026-11-07",-150,"Transferencia de un amigo","ingreso")]);
  const m=c.dashboardBudgetStats(mucho);
  assert.equal(m.against,0,"reembolsos mayores que el gasto dejan lo usado a 0");
  assert.equal(m.remaining,650,"y libre se queda en el límite, no en 930");
});
caso("una devolución grande en la categoría del gasto sí devuelve margen",()=>{
  const s=estado([NOMINA,...COMPRAS,fila("dev","bancob","2026-11-26",-250,"Devolucion Ropa Ejemplo","ropa")]);
  assert.equal(c.dashboardBudgetStats(s).against,583);
});
caso("el alcance del widget cambia de forma con la regla y la ventana lleva las claves",()=>{
  const s=estado([NOMINA,...COMPRAS,LLEGA]);
  const st=c.dashboardBudgetStats(s);
  const sc=JSON.parse(c.widgetScopeOf(s,st,"nom","bancob"));
  assert.equal(sc[4].length,3,"ancla, traspasos y grandes");
  assert.deepEqual(sc[4][2],[c.keyOfExpense(s.expenses[4])]);
  assert.deepEqual(Array.from(c.widgetPeriodOf(st,"nom","x").grandes),[c.keyOfExpense(s.expenses[4])]);
  const sin=estado([NOMINA,...COMPRAS]);
  assert.equal(JSON.parse(c.widgetScopeOf(sin,c.dashboardBudgetStats(sin),"nom","bancob"))[4],"nom","sin grandes, el alcance de siempre");
});
caso("el Balance de un mes natural conserva su neto (la regla es solo del ciclo)",()=>{
  const b=c.budgetStatsFromAmounts(100,300,650,0,"net",0);
  assert.equal(b.against,-200);
});
console.log(`ciclo-tope-ingresos: ${n} casos OK`);
