import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

/* Gastos v5 · la cifra viva (SPEC §3). Las sumas por día que pinta la cabecera al bajar tienen que
   salir de la MISMA regla fila a fila que `monthBudgetStats` (la de Inicio y el widget): si las
   dos se separan, la cifra de arriba deja de cuadrar con la que se ve al bajar. Aquí se comprueba
   la igualdad por dos vías independientes, mes a mes y día a día. */
const ctx=loadPureLogicFromFile(), NativeDate=ctx.Date;
const epoch=Date.parse("2026-10-20T10:00:00Z");
ctx.Date=class extends NativeDate {
  constructor(...args){ super(...(args.length?args:[epoch])); }
  static now(){ return epoch; }
};
const e=(id,date,amount,category,extra={})=>({id,date:date+"T12:00:00Z",amount,category,ent:"trade_republic",merchant:id,...extra});
const state={budget:1100,settings:{expenseBanks:["trade_republic"]},
  accounts:[{ent:"trade_republic",role:"diario",spendFrom:true},{ent:"sabadell",role:"fijos"}],
  fixed:[{id:"luz",name:"Luz",amount:62,freq:"mes",account:"trade_republic",day:5}],
  debts:[{id:"coche",name:"Préstamo coche",monthly:197,day:3,value:5000,account:"trade_republic"}],
  expenses:[
    e("ago1","2026-08-02",40,"super"), e("ago2","2026-08-30",60,"bares"),
    e("sep1","2026-09-03",30,"super"), e("sep2","2026-09-12",20,"super"), e("sep3","2026-09-28",50,"compras"),
    e("bizum","2026-09-15",-25,"ingreso"),
    e("oct1","2026-10-01",10,"super"), e("oct2","2026-10-12",15,"bares"), e("oct3","2026-10-12",5,"super"),
    e("oct4","2026-10-19",24.38,"super"),
    // No cuentan: recibo del Plan, cuota de deuda, inversión, otro banco, posible repetido.
    e("recibo","2026-10-05",62,"recibos",{reciboId:"luz"}), e("cuota","2026-10-03",197,"deudas",{debtId:"coche"}),
    e("inv","2026-10-06",50,"inversion"), e("otro","2026-10-07",80,"super",{ent:"sabadell"}),
    e("dup","2026-10-08",12,"super",{possibleDup:true}),
  ]};

const cifra=ctx.gastosCifraDias(state,state.expenses,{cycle:null},-Infinity,Infinity,true);
const mes=(ym)=>{ const start=ctx.gastosYmInicioMs(ym), next=ctx.gastosYmInicioMs(ym.slice(0,5)+String(+ym.slice(5)+1).padStart(2,"0"));
  return ctx.monthBudgetStats(state,null,next,"split",{startMs:start,todayEndMs:Infinity,cycle:null}); };

for(const ym of ["2026-08","2026-09"]){
  const m=mes(ym);
  assert.equal(+cifra.months[ym].sp.toFixed(2), +m.spent.toFixed(2), ym+": suma por días = monthBudgetStats");
  assert.equal(+cifra.months[ym].inc.toFixed(2), +m.income.toFixed(2), ym+": ingresos iguales");
}
// El mes en curso con la ventana EXACTA de Inicio (desde el día 1 de Madrid, sin tope).
const inicio=ctx.dashboardBudgetStats(state);
assert.equal(+cifra.months["2026-10"].sp.toFixed(2), +inicio.spent.toFixed(2), "octubre = la tarjeta del mes de Inicio");
assert.equal(+inicio.spent.toFixed(2), 54.38, "recibo, cuota, inversión, otro banco y repetido no cuentan");
console.log("✓ la suma por días es la misma cifra que monthBudgetStats e Inicio");

// Lo acumulado hasta un día, también en días sin movimientos y sin cruzar de mes.
assert.equal(ctx.gastosCumDia(cifra,20261012,"2026-10").sp, 30, "hasta el 12: 10 + 15 + 5");
assert.equal(ctx.gastosCumDia(cifra,20261015,"2026-10").sp, 30, "un día sin gastos hereda el anterior");
assert.equal(+ctx.gastosCumDia(cifra,20261019,"2026-10").sp.toFixed(2), 54.38, "el último día acumula el mes entero");
assert.equal(ctx.gastosCumDia(cifra,20261001,"2026-10").sp, 10, "el día 1 no arrastra septiembre");
assert.equal(ctx.gastosCumDia(cifra,20260801,"2026-08").sp, 0, "antes del primer gasto del mes, cero");
// «A estas alturas»: septiembre hasta el día 20 (mismo día que hoy), sin el día 28.
assert.equal(ctx.gastosCumDia(cifra,20260920,"2026-09").sp, 50, "septiembre hasta el 20");
console.log("✓ acumulado por día sin cruzar meses");

// El histórico más antiguo: lo que decide si se puede comparar con un mes entero.
assert.equal(cifra.earliest, Date.parse("2026-08-02T12:00:00Z"));
assert.ok(cifra.earliest<ctx.gastosYmInicioMs("2026-09"), "septiembre está entero en el histórico");
assert.ok(!(cifra.earliest<ctx.gastosYmInicioMs("2026-08")), "agosto NO: empieza el día 2");
console.log("✓ el histórico dice qué meses se pueden comparar");

// En el ciclo: misma regla que monthBudgetStats con ciclo (ingresos de cualquier banco, sin la nómina).
const nomina=e("nomina","2026-09-26",-2000,"ingreso",{merchant:"Nómina"});
const st2={...state,expenses:state.expenses.concat([nomina])};
const period={startMs:Date.parse("2026-09-26T00:00:00Z"),todayEndMs:Date.parse("2026-10-21T00:00:00Z"),cycle:{inc:nomina,start:new NativeDate("2026-09-26T00:00:00Z")}};
const ciclo=ctx.gastosCifraDias(st2,st2.expenses,period,period.startMs,period.todayEndMs,false);
const bs=ctx.monthBudgetStats(st2,null,null,null,period);
const last=ctx.gastosCumDia(ciclo,20261020);
assert.equal(+last.sp.toFixed(2), +bs.spent.toFixed(2), "ciclo: gastado igual");
assert.equal(+last.inc.toFixed(2), +bs.income.toFixed(2), "ciclo: la nómina que lo abre no suma");
assert.equal(ctx.gastosValor(last,"net"), bs.against, "ciclo: neto igual que la cifra de Inicio");
console.log("✓ en Mi ciclo la cifra viva acumula el mismo neto");
