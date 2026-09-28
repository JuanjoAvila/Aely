#!/usr/bin/env node
import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx = loadPureLogicFromFile();

function t(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
}

console.log("month-budget-stats");

const nowMs = Date.now();
const ym = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Madrid", year: "numeric", month: "2-digit",
}).format(new Date(nowMs));
const d = (day) => ym + "-" + String(day).padStart(2, "0") + "T12:00:00.000Z";

t("excluye inversión y traspaso del gastado", () => {
  const s = {
    budget: 500,
    expenses: [
      { date: d(2), amount: 40, category: "super" },
      { date: d(3), amount: 100, category: "inversion" },
      { date: d(4), amount: 50, category: "traspaso" },
      { date: d(5), amount: -200, category: "ingreso" },
    ],
  };
  const bs = ctx.monthBudgetStats(s, nowMs);
  assert.equal(bs.spent, 40);
  assert.equal(bs.income, 200);
  assert.equal(bs.against, 40); // gTotalMode split por defecto
  assert.equal(bs.budget, 500);
  assert.equal(bs.remaining, 460);
});

t("resta reservas del presupuesto (no del gastado)", () => {
  const s = {
    budget: 500,
    expenses: [{ date: d(2), amount: 100, category: "super" }],
    reservaLog: [{ date: d(1), amount: 80 }],
  };
  const bs = ctx.monthBudgetStats(s, nowMs);
  assert.equal(bs.reserved, 80);
  assert.equal(bs.budget, 420);
  assert.equal(bs.spent, 100);
  assert.equal(bs.remaining, 320);
});

t("modo net: against = gasto − ingreso", () => {
  const s = {
    budget: 500,
    settings: { gTotalMode: "net" },
    expenses: [
      { date: d(2), amount: 100, category: "super" },
      { date: d(3), amount: -30, category: "ingreso" },
    ],
  };
  const bs = ctx.monthBudgetStats(s, nowMs);
  assert.equal(bs.against, 70);
  assert.equal(bs.shown, 70); // |balance|
  assert.equal(bs.remaining, 430);
});

t("gamifOf usa la misma cifra (no thisMonthSpent con neutras)", () => {
  const s = {
    budget: 500,
    goals: [],
    expenses: [
      { date: d(2), amount: 50, category: "super" },
      { date: d(3), amount: 200, category: "inversion" },
    ],
  };
  const g = ctx.gamifOf(s, { thisMonthSpent: 250, roundupThisMonth: 0, savebackThisMonth: 0 });
  assert.equal(g.budgetReto.spent, 50, "el reto no debe contar la inversión");
  assert.equal(g.budgetReto.budget, 500);
});

t("el ciclo activado reinicia el presupuesto con el cobro real, no el día 1", () => {
  const RealDate=ctx.Date;
  const s={
    budget:1000, settings:{budgetCycle:true,gTotalMode:"net"},
    expenses:[
      {id:"agosto",date:"2026-08-26T12:00:00Z",amount:-2000,merchant:"Nómina",category:"ingreso"},
      {id:"previos",date:"2026-09-20T12:00:00Z",amount:600,category:"super"},
    ],
  };
  try{
    ctx.Date=class extends RealDate { static now(){ return Date.parse("2026-09-25T12:00:00Z"); } };
    const antes=ctx.monthBudgetStats(s);
    assert.equal(antes.spent,600);
    assert.equal(antes.remaining,400);
    s.expenses.push({id:"septiembre",date:"2026-09-26T12:00:00Z",amount:-2000,merchant:"Nómina",category:"ingreso"});
    ctx.Date=class extends RealDate { static now(){ return Date.parse("2026-09-26T18:00:00Z"); } };
    const despues=ctx.monthBudgetStats(s);
    assert.equal(despues.spent,0);
    assert.equal(despues.income,0,"la nómina no amplía el presupuesto en modo balance");
    assert.equal(despues.remaining,1000);
    s.expenses.push({id:"nuevo",date:"2026-09-28T12:00:00Z",amount:50,category:"super"});
    ctx.Date=class extends RealDate { static now(){ return Date.parse("2026-10-01T12:00:00Z"); } };
    const octubre=ctx.monthBudgetStats(s);
    assert.equal(octubre.spent,50,"el día 1 no reinicia el ciclo abierto el 26");
    assert.equal(octubre.remaining,950);
    assert.equal(ctx.monthBudgetStats(s,Date.parse("2026-10-01T12:00:00Z")).spent,0,
      "un informe mensual con fecha explícita sigue usando el mes natural");
  }finally{ ctx.Date=RealDate; }
});

t("desactivado conserva el mes natural y un cobro futuro no adelanta el ciclo", () => {
  const RealDate=ctx.Date;
  const s={budget:1000,settings:{budgetCycle:true},expenses:[
    {id:"agosto",date:"2026-08-26T12:00:00Z",amount:-2000,merchant:"Nómina",category:"ingreso"},
    {id:"compra",date:"2026-09-20T12:00:00Z",amount:600,category:"super"},
    {id:"futuro",date:"2026-09-26T12:00:00Z",amount:-2000,merchant:"Nómina",category:"ingreso"},
  ]};
  try{
    ctx.Date=class extends RealDate { static now(){ return Date.parse("2026-09-25T12:00:00Z"); } };
    assert.equal(ctx.monthBudgetStats(s).remaining,400);
    s.settings.budgetCycle=false;
    assert.equal(ctx.monthBudgetStats(s).spent,600);
    ctx.Date=class extends RealDate { static now(){ return Date.parse("2026-10-01T12:00:00Z"); } };
    assert.equal(ctx.monthBudgetStats(s).spent,0);
  }finally{ ctx.Date=RealDate; }
});

t("un ingreso descartado no puede abrir un ciclo nuevo", () => {
  const RealDate=ctx.Date;
  const descartado={date:"2026-09-26T12:00:00Z",amount:-2000,merchant:"Nómina",source:"ob",category:"ingreso"};
  const s={budget:1000,settings:{budgetCycle:true},
    deleted:[ctx.keyOfExpense(descartado)],expenses:[
      {date:"2026-08-26T12:00:00Z",amount:-2000,merchant:"Nómina",source:"ob",category:"ingreso"},
      {date:"2026-09-20T12:00:00Z",amount:600,category:"super"},
      descartado,
    ]};
  try{
    ctx.Date=class extends RealDate { static now(){ return Date.parse("2026-09-26T18:00:00Z"); } };
    assert.equal(ctx.monthBudgetStats(s).remaining,400);
  }finally{ ctx.Date=RealDate; }
});

t("un posible ingreso duplicado no reinicia el ciclo", () => {
  const RealDate=ctx.Date;
  const s={budget:1000,settings:{budgetCycle:true},expenses:[
    {date:"2026-08-26T12:00:00Z",amount:-2000,merchant:"Nómina",category:"ingreso"},
    {date:"2026-09-20T12:00:00Z",amount:600,category:"super"},
    {date:"2026-09-26T12:00:00Z",amount:-2000,merchant:"Nómina",category:"ingreso",possibleDup:true},
  ]};
  try{
    ctx.Date=class extends RealDate { static now(){ return Date.parse("2026-09-26T18:00:00Z"); } };
    assert.equal(ctx.monthBudgetStats(s).remaining,400);
  }finally{ ctx.Date=RealDate; }
});

t("traspaso, inversión y Bizum grande no reinician el presupuesto", () => {
  const RealDate=ctx.Date;
  const s={budget:1000,settings:{budgetCycle:true},expenses:[
    {date:"2026-09-26T12:00:00Z",amount:-1500,merchant:"Nómina",category:"ingreso",ent:"sabadell"},
    {date:"2026-09-27T12:00:00Z",amount:100,merchant:"Compra",category:"super"},
  ]};
  try{
    ctx.Date=class extends RealDate { static now(){ return Date.parse("2026-09-28T10:00:00Z"); } };
    const start=ctx.monthBudgetStats(s).periodStart;
    assert.equal(ctx.monthBudgetStats(s).remaining,900);
    for(const [category,merchant,amount] of [
      ["traspaso","Movimiento",-500],
      ["inversion","Venta de inversión",-300],
      ["ingreso","Bizum recibido",-250],
    ]){
      const e={date:"2026-09-27T14:00:00Z",amount,merchant,category,ent:"sabadell"};
      s.expenses.push(e);
      const bs=ctx.monthBudgetStats(s);
      assert.equal(bs.periodStart,start,merchant);
      assert.equal(bs.spent,100,merchant);
      s.expenses.pop();
    }
  }finally{ ctx.Date=RealDate; }
});

t("un ingreso periódico modelado permite reconocer un concepto bancario sin Nómina", () => {
  const RealDate=ctx.Date;
  const s={budget:1000,settings:{budgetCycle:true},flows:[
    {kind:"income",name:"Empresa",amount:1500,to:"sabadell",day:30},
  ],expenses:[
    {date:"2026-09-20T12:00:00Z",amount:600,category:"super"},
    {date:"2026-09-26T12:00:00Z",amount:-1500,merchant:"Abono Empresa",category:"ingreso",ent:"sabadell"},
  ]};
  try{
    ctx.Date=class extends RealDate { static now(){ return Date.parse("2026-09-28T10:00:00Z"); } };
    assert.equal(ctx.monthBudgetStats(s).remaining,1000);
  }finally{ ctx.Date=RealDate; }
});

t("Nómina en el concepto del banco ancla aunque el comercio sea la empresa", () => {
  const RealDate=ctx.Date;
  const s={budget:1000,settings:{budgetCycle:true},expenses:[
    {date:"2026-09-20T12:00:00Z",amount:600,category:"super"},
    {date:"2026-09-26T12:00:00Z",amount:-1500,merchant:"EMPRESA SL",note:"NOMINA SEPTIEMBRE",category:"ingreso",ent:"sabadell"},
  ]};
  try{
    ctx.Date=class extends RealDate { static now(){ return Date.parse("2026-09-28T10:00:00Z"); } };
    assert.equal(ctx.monthBudgetStats(s).remaining,1000);
  }finally{ ctx.Date=RealDate; }
});

t("un flow de nómina no convierte cualquier transferencia del banco en otro cobro", () => {
  const RealDate=ctx.Date;
  const s={budget:1000,settings:{budgetCycle:true},flows:[
    {kind:"income",name:"Nómina",amount:1500,to:"sabadell",day:26},
  ],expenses:[
    {date:"2026-09-26T12:00:00Z",amount:-1500,merchant:"Nómina",category:"ingreso",ent:"sabadell"},
    {date:"2026-09-26T14:00:00Z",amount:100,merchant:"Compra",category:"super"},
    {date:"2026-09-27T12:00:00Z",amount:-400,merchant:"TRANSFERENCIA DE JUAN",category:"ingreso",ent:"sabadell"},
  ]};
  try{
    ctx.Date=class extends RealDate { static now(){ return Date.parse("2026-09-28T10:00:00Z"); } };
    const bs=ctx.monthBudgetStats(s);
    assert.equal(new Date(bs.periodStart).getDate(),26);
    assert.equal(bs.spent,100);
  }finally{ ctx.Date=RealDate; }
});

t("un traspaso llamado Nómina sigue siendo neutro y no mueve el ancla", () => {
  const RealDate=ctx.Date;
  const s={budget:1000,settings:{budgetCycle:true},expenses:[
    {date:"2026-09-26T12:00:00Z",amount:-1500,merchant:"Nómina",category:"ingreso",ent:"sabadell"},
    {date:"2026-09-26T14:00:00Z",amount:100,merchant:"Compra",category:"super"},
    {date:"2026-09-27T12:00:00Z",amount:-1500,merchant:"Traspaso nómina",category:"traspaso",ent:"trade_republic"},
  ]};
  try{
    ctx.Date=class extends RealDate { static now(){ return Date.parse("2026-09-28T10:00:00Z"); } };
    const bs=ctx.monthBudgetStats(s);
    assert.equal(new Date(bs.periodStart).getDate(),26);
    assert.equal(bs.spent,100);
  }finally{ ctx.Date=RealDate; }
});

t("el mes natural conserva la misma cifra que el widget con apuntes fechados mañana", () => {
  const RealDate=ctx.Date;
  const s={budget:1000,settings:{budgetCycle:false},expenses:[
    {date:"2026-09-20T12:00:00Z",amount:700,category:"super"},
    {date:"2026-09-29T12:00:00Z",amount:200,category:"super"},
  ]};
  try{
    ctx.Date=class extends RealDate { static now(){ return Date.parse("2026-09-28T10:00:00Z"); } };
    assert.equal(ctx.monthBudgetStats(s).spent,900);
    assert.equal(ctx.monthBudgetStats(s).spent,ctx.monthBudgetStats(s,ctx.Date.now()).spent);
    assert.equal(ctx.categorySpentByMonth(s).reduce((sum,x)=>sum+x.spent,0),900);
  }finally{ ctx.Date=RealDate; }
});

console.log("\nmonth-budget-stats: OK");
