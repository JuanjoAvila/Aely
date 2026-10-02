import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx=loadPureLogicFromFile(), NativeDate=ctx.Date;
const epoch=Date.parse("2026-10-02T12:00:00Z");
ctx.Date=class extends NativeDate {
  constructor(...args){ super(...(args.length?args:[epoch])); }
  static now(){ return epoch; }
};
const expense=(id,date,amount,category,ent="sabadell")=>({id,date:date+"T12:00:00Z",amount,category,ent,merchant:id});
const state={budget:1000,settings:{budgetCycle:true,expenseBanks:["sabadell"]},
  accounts:[{ent:"sabadell",role:"diario",spendFrom:true},{ent:"revolut",role:"ahorro"}],
  expenses:[expense("viejo","2026-08-10",23,"salud"),expense("límite","2026-08-20",11,"transporte"),
    expense("compras","2026-09-05",70,"compras"),expense("Nómina","2026-09-26",-2000,"ingreso"),
    expense("café","2026-09-27",40,"bares"),expense("compra","2026-10-01",25,"super"),
    expense("devolución","2026-10-01",-5,"ingreso","revolut"),
    expense("neutro","2026-08-15",100,"inversion"),expense("otro banco","2026-08-15",200,"salud","revolut"),
    {...expense("posible","2026-08-15",300,"salud"),possibleDup:true}],
  categoryBudgets:{super:200},reservaLog:[{date:"2026-08-15T12:00:00Z",amount:10}]};
const before=JSON.stringify(state);
const payday=ctx.budgetPaydayOf(state);
for(const [preset,range,spent,ids] of [
  ["month",{},25,["super"]], ["cycle",{},65,["bares","super"]],
  ["last",{},110,["compras","bares","super"]],
  ["custom",{from:"2026-08-10",to:"2026-08-20"},34,["salud","transporte","super"]],
  ["all",{},169,["compras","bares","super","salud","transporte"]],
]){
  const bounds=ctx.presetBoundsMs(preset,range,payday.start),period=ctx.gastosPeriodOf(preset,bounds,payday);
  const stats=ctx.monthBudgetStats(state,null,null,null,period);
  const cats=ctx.categorySpentByMonth(state,null,null,period);
  assert.equal(stats.spent,spent,preset);
  assert.equal(cats.reduce((sum,r)=>sum+r.spent,0),stats.spent,preset+" suma categorías");
  assert.deepEqual(Array.from(cats,r=>r.id),ids,preset+" categorías");
  if(preset==="cycle"){
    assert.equal(stats.income,5,"Bizum en otro banco suma en el ciclo y no duplica la nómina");
    assert.equal(stats.against,60);
    assert.equal(stats.remaining,940);
    assert.deepEqual(stats,ctx.monthBudgetStats(state),"sin ventana explícita mantiene Mi ciclo");
  }
  console.log("✓ periodo "+preset+" comparte categorías y cifra");
}
const from=ctx.presetBoundsMs("custom",{from:"2026-08-10",to:"2026-08-20"});
assert.equal(new ctx.Date(from.from).getHours(),0,"desde medianoche local");
assert.equal(new ctx.Date(from.to).getHours(),23,"hasta fin del día local");
assert.equal(ctx.inBounds(new ctx.Date(2026,7,10,0,0).getTime(),from),true);
assert.equal(ctx.inBounds(new ctx.Date(2026,7,20,23,59,59,999).getTime(),from),true);
const future={...state,expenses:state.expenses.concat(expense("futuro","2026-10-03",900,"super"))};
const cycle=ctx.gastosPeriodOf("cycle",ctx.presetBoundsMs("cycle",{},payday.start),payday);
assert.equal(ctx.monthBudgetStats(future,null,null,null,cycle).spent,65,"el futuro no consume el ciclo actual");
assert.equal(JSON.stringify(state),before,"leer periodos no modifica histórico ni ajustes");
console.log("✓ fronteras locales, futuro y ausencia de mutaciones");
