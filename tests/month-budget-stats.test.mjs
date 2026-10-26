#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx = loadPureLogicFromFile();
const helpCtx=vm.createContext({React:ctx.React,dashboardBudgetStats:s=>ctx.dashboardBudgetStats(s)});
vm.runInContext(fs.readFileSync("src/modules/16-help-assistant.js","utf8"),helpCtx);

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

// Oráculo cambiado el 26/10/2026 (decisión del dueño): el mes natural ya no compara el bruto
// (600) sino el gasto menos los ingresos sin la nómina: 600 − 80 del Bizum = 520. La nómina de
// 2.000 sigue sin «pagar» el mes, que es lo que protegía INC-2909-02.
t("Inicio mensual: gasto menos ingresos sin la nómina, sin alterar Balance ni filas al desactivar Mi ciclo",()=>{
  const RealDate=ctx.Date;
  const s={budget:1000,settings:{budgetCycle:true,gTotalMode:"net",expenseBanks:["sabadell"]},
    accounts:[{ent:"sabadell",role:"diario",spendFrom:true},{ent:"revolut",role:"ahorro"}],
    expenses:[
      {date:"2026-09-20T12:00:00Z",amount:500,category:"super",ent:"sabadell"},
      {date:"2026-09-26T12:00:00Z",amount:-2000,merchant:"Nómina",category:"ingreso",ent:"sabadell"},
      {date:"2026-09-27T12:00:00Z",amount:100,category:"super",ent:"sabadell"},
      {date:"2026-09-27T14:00:00Z",amount:-80,merchant:"Bizum",category:"ingreso",ent:"sabadell"},
      {date:"2026-09-27T15:00:00Z",amount:900,category:"super",ent:"revolut"},
      {date:"2026-09-27T16:00:00Z",amount:300,category:"traspaso",ent:"sabadell"},
      {date:"2026-09-27T17:00:00Z",amount:250,category:"super",ent:"sabadell",possibleDup:true},
    ],reservaLog:[{date:"2026-09-21T12:00:00Z",amount:100}]};
  try{
    ctx.Date=class extends RealDate { static now(){ return Date.parse("2026-09-28T12:00:00Z"); } };
    const cycle=ctx.dashboardBudgetStats(s);
    assert.equal(cycle.against,20); assert.equal(cycle.remaining,980);
    assert.equal(helpCtx.helpSnap(s,{}).remaining,980);
    assert.equal(ctx.gamifOf(s,{}).budgetReto.margin,980);
    s.settings.budgetCycle=false;
    const before=JSON.stringify(s), dash=ctx.dashboardBudgetStats(s), month=ctx.monthBudgetStats(s);
    assert.equal(dash.against,520); assert.equal(dash.budget,900); assert.equal(dash.remaining,380);
    assert.equal(dash.mode,"mes"); assert.equal(dash.nomina,2000); assert.equal(month.balance,1480); assert.equal(month.against,-1480);
    const snap=helpCtx.helpSnap(s,{}), reto=ctx.gamifOf(s,{}).budgetReto;
    assert.equal(snap.remaining,380,"Pregúntame conserva el margen mensual visible en Inicio");
    assert.equal(snap.spent,520); assert.equal(snap.budget,900);
    assert.equal(reto.margin,380); assert.equal(reto.spent,520); assert.equal(reto.budget,900);
    assert.equal(JSON.stringify(s),before,"pintar Inicio no escribe ni modifica ajustes o filas");
    for(const budget of [0,500,600]){
      const b=ctx.dashboardBudgetStats({...s,budget,reservaLog:[]});
      assert.equal(b.budget,budget||null); assert.equal(b.remaining,budget?budget-520:null);
    }
    const reserved=ctx.dashboardBudgetStats({...s,reservaLog:[{date:"2026-09-21T12:00:00Z",amount:1000}]});
    assert.equal(reserved.budget,0); assert.equal(reserved.remaining,-520);
    const over={...s,budget:500,reservaLog:[]};
    assert.equal(helpCtx.helpSnap(over,{}).remaining,-20);
    assert.equal(ctx.gamifOf(over,{}).budgetReto.done,false,"la nómina no da por cumplido un reto mensual excedido");
    s.settings.budgetCycle=true;
    s.expenses.push({date:"2026-09-27T18:00:00Z",amount:-200,category:"ingreso",ent:"sabadell"});
    const credit=ctx.dashboardBudgetStats(s);
    assert.equal(credit.against,-180); assert.equal(credit.remaining,1180,"un neto legítimo sigue ampliando margen en ciclo");
  }finally{ctx.Date=RealDate;}
});

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

t("el ciclo descuenta Bizums recibidos del balance sin sumar la nómina", () => {
  const RealDate=ctx.Date;
  const s={budget:1000,settings:{budgetCycle:true,gTotalMode:"split",expenseBanks:["sabadell"]},expenses:[
    {id:"previo",date:"2026-09-25T12:00:00Z",amount:-60,merchant:"Bizum anterior",category:"ingreso",ent:"sabadell"},
    {id:"nomina",date:"2026-09-26T12:00:00Z",amount:-2000,merchant:"Nómina",category:"ingreso",ent:"sabadell"},
    {id:"cena",date:"2026-09-27T12:00:00Z",amount:100,merchant:"Cena",category:"restaurantes",ent:"sabadell"},
    {id:"amigos",date:"2026-09-27T14:00:00Z",amount:-80,merchant:"Bizum recibido",category:"ingreso",ent:"revolut"},
    {id:"otro",date:"2026-09-27T14:30:00Z",amount:40,merchant:"Compra desde ahorros",category:"otros",ent:"revolut"},
    {id:"traspaso",date:"2026-09-27T15:00:00Z",amount:-200,merchant:"Traspaso propio",category:"traspaso",ent:"sabadell"},
    {id:"duplicado",date:"2026-09-27T16:00:00Z",amount:-20,merchant:"Bizum recibido",category:"ingreso",ent:"sabadell",possibleDup:true},
    {id:"futuro",date:"2026-09-29T12:00:00Z",amount:-50,merchant:"Devolución",category:"ingreso",ent:"sabadell"},
  ]};
  try{
    ctx.Date=class extends RealDate { static now(){ return Date.parse("2026-09-28T10:00:00Z"); } };
    const bs=ctx.monthBudgetStats(s);
    assert.equal(bs.cycle,true);
    assert.equal(bs.mode,"net","Mi ciclo muestra balance aunque el mes natural use gasto bruto");
    assert.equal(bs.spent,100);
    assert.equal(bs.income,80,"el Bizum cuenta; nómina ancla, traspaso, duplicado, anterior y futuro no");
    assert.equal(bs.balance,-20);
    assert.equal(bs.against,20);
    assert.equal(bs.shown,20);
    assert.equal(bs.remaining,980);
    const refunded={...s,expenses:s.expenses.concat({id:"compraDevuelta",date:"2026-09-27T17:00:00Z",amount:-10,merchant:"Devolución compra",category:"ingreso",ent:"sabadell"})};
    const withRefund=ctx.monthBudgetStats(refunded);
    assert.equal(withRefund.income,90,"una devolución del banco diario compensa la compra");
    assert.equal(withRefund.remaining,990);
    assert.equal(ctx.categorySpentByMonth(s).reduce((sum,x)=>sum+x.spent,0),100);
    const month=ctx.monthBudgetStats(s,ctx.Date.now());
    assert.equal(month.mode,"split","la foto mensual del widget conserva su ajuste");
    assert.equal(month.against,100);
    const over={...s,expenses:s.expenses.map(x=>x.id==="amigos"?{...x,amount:-180}:x)};
    const capped=ctx.monthBudgetStats(over);
    assert.equal(capped.income,180);
    assert.equal(capped.balance,80);
    assert.equal(capped.against,-80);
    assert.equal(capped.remaining,1080,"los ingresos netos pueden aumentar el margen por decisión del dueño");
    const extras={...s,expenses:s.expenses.concat([
      {id:"alquiler",date:"2026-09-27T15:00:00Z",amount:-700,merchant:"Alquiler cobrado",category:"ingreso",ent:"sabadell"},
      {id:"trabajoExtra",date:"2026-09-27T15:30:00Z",amount:-1500,merchant:"Trabajo extra",category:"ingreso",ent:"sabadell"},
      {id:"luz",date:"2026-09-27T16:00:00Z",amount:60,merchant:"Luz",category:"hogar",ent:"caixa"},
      {id:"luzDevuelta",date:"2026-09-27T16:30:00Z",amount:-60,merchant:"Devolución Luz",category:"ingreso",ent:"caixa"},
      {id:"dudoso",date:"2026-09-27T17:00:00Z",amount:-500,merchant:"Ingreso dudoso",category:"ingreso",ent:"sabadell",possibleDup:true},
    ])};
    const all=ctx.monthBudgetStats(extras);
    assert.equal(all.spent,100,"la cuenta de fijos no carga gasto diario");
    assert.equal(all.income,2340,"todos los ingresos reales suman, de cualquier banco");
    assert.equal(all.balance,2240);
    assert.equal(all.remaining,3240);
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

/* MES NATURAL: GASTO MENOS INGRESOS, SIN LA NÓMINA (decisión del dueño, 26/10/2026). Su mes de
   hoy: 1.922,19 € de gasto, 485,72 € recibidos (Bizums, devoluciones) y límite 1.500 €. Con el
   bruto la app decía «422 € por encima»; tiene que decir «64 € por debajo» y seguir diciéndolo
   cuando el 30/10 entre la nómina de 3.333 €. Importes con la misma forma que su mes; nada real. */
const OCT={budget:1500,settings:{budgetCycle:false,gTotalMode:"net",expenseBanks:["sabadell"]},
  accounts:[{ent:"sabadell",role:"diario",spendFrom:true}]};
const filasOct=()=>[
  {id:"g1",date:"2026-10-03T12:00:00Z",amount:1200,merchant:"Compra sintética",category:"super",ent:"sabadell"},
  {id:"g2",date:"2026-10-10T12:00:00Z",amount:722.19,merchant:"Ocio sintético",category:"ocio",ent:"sabadell"},
  {id:"i1",date:"2026-10-12T12:00:00Z",amount:-400,merchant:"Bizum cena",category:"bizum",ent:"sabadell"},
  {id:"i2",date:"2026-10-15T12:00:00Z",amount:-85.72,merchant:"Devolución tienda",category:"ingreso",ent:"sabadell"},
  {id:"t1",date:"2026-10-14T12:00:00Z",amount:300,merchant:"Traspaso sintético",category:"traspaso",ent:"sabadell"},
];
const NOMINA={id:"n1",date:"2026-10-30T08:00:00Z",amount:-3333,merchant:"Empresa sintética",note:"NÓMINA OCTUBRE",category:"ingreso",ent:"sabadell"};
const aLas=(iso,fn)=>{ const RealDate=ctx.Date;
  try{ ctx.Date=class extends RealDate { static now(){ return Date.parse(iso); } }; return fn(); } finally{ ctx.Date=RealDate; } };
// Primera vía: a mano, con las filas sembradas. Sin traspasos y sin las filas que son nómina
// (se marcan aquí por id, no con la regla de la app: si la regla se rompe, esto no la sigue).
const NOMINAS_A_MANO=new Set(["n0","n1","n2"]);
const aMano=rows=>{
  const g=rows.filter(r=>r.amount>0&&r.category!=="traspaso").reduce((x,r)=>x+r.amount,0);
  const i=rows.filter(r=>r.amount<0&&r.category!=="traspaso"&&!NOMINAS_A_MANO.has(r.id)).reduce((x,r)=>x-r.amount,0);
  return Math.max(0,Math.round((g-i)*100));
};

t("su mes de hoy: 1.922,19 − 485,72 = 1.436,47 → 63,53 € por debajo en Inicio y en Gastos", () => {
  aLas("2026-10-26T10:46:00Z",()=>{
    const s={...OCT,expenses:filasOct()};
    const inicio=ctx.dashboardBudgetStats(s), gastos=ctx.monthBudgetStats(s);
    assert.equal(aMano(s.expenses),143647);
    // Segunda vía: el motor, por las dos puertas que usan Inicio/widget y la línea de Gastos.
    assert.equal(Math.round(inicio.against*100),143647);
    assert.equal(Math.round(inicio.remaining*100),6353);
    const lim=ctx.budgetStatsFromAmounts(gastos.spent,gastos.income,s.budget,gastos.reserved,gastos.cycle?"net":"mes",gastos.nomina);
    assert.equal(Math.round(lim.remaining*100),6353,"la línea de Gastos dice lo mismo que Inicio");
    assert.equal(Math.round(gastos.shown*100),143647,"la cifra grande de Gastos sigue su modo (Balance)");
    assert.equal(Math.round(inicio.spent*100),192219,"el gasto bruto se sigue sabiendo");
    assert.equal(JSON.stringify([inicio.nominas,inicio.noNominas.length]),"[[],0]","el Bizum de 400 es Bizum; la devolución no llega a 200");
  });
});

t("el 30/10 entra la nómina de 3.333 € y no cambia nada", () => {
  aLas("2026-10-30T10:00:00Z",()=>{
    const s={...OCT,expenses:filasOct().concat([NOMINA])};
    const inicio=ctx.dashboardBudgetStats(s), gastos=ctx.monthBudgetStats(s);
    assert.equal(aMano(s.expenses),143647);
    assert.equal(Math.round(inicio.remaining*100),6353);
    assert.equal(inicio.nomina,3333); assert.equal(JSON.stringify(inicio.nominas),JSON.stringify([ctx.keyOfExpense(NOMINA)]));
    const lim=ctx.budgetStatsFromAmounts(gastos.spent,gastos.income,s.budget,gastos.reserved,"mes",gastos.nomina);
    assert.equal(Math.round(lim.remaining*100),6353);
    // El balance (Gastos en Balance) sí cambia: es otra cifra y no se compara con el límite.
    assert.equal(Math.round(gastos.balance*100),333300+48572-192219);
  });
});

t("bordes: nómina anticipada, dos nóminas, sin nómina, ingresos mayores, devolución, ciclo y meses cerrados", () => {
  // Anticipada: la de noviembre cae el 28/10 y es nómina en octubre; noviembre no tiene ninguna.
  aLas("2026-10-29T10:00:00Z",()=>{
    const s={...OCT,expenses:filasOct().concat([{...NOMINA,id:"n0",date:"2026-10-28T08:00:00Z"}])};
    assert.equal(aMano(s.expenses),143647);
    assert.equal(Math.round(ctx.dashboardBudgetStats(s).remaining*100),6353);
  });
  aLas("2026-11-03T10:00:00Z",()=>{
    const s={...OCT,expenses:filasOct().concat([{...NOMINA,id:"n0",date:"2026-10-28T08:00:00Z"},
      {id:"g3",date:"2026-11-02T12:00:00Z",amount:50,merchant:"Compra noviembre",category:"super",ent:"sabadell"}])};
    const nov=ctx.dashboardBudgetStats(s);
    assert.equal(nov.against,50); assert.equal(nov.remaining,1450); assert.equal(nov.nomina,0);
  });
  // Dos nóminas en el mismo mes (anticipada y la del mes, o dos pagadores): fuera las dos.
  aLas("2026-10-30T10:00:00Z",()=>{
    const s={...OCT,expenses:filasOct().concat([NOMINA,{...NOMINA,id:"n2",date:"2026-10-01T08:00:00Z",amount:-1200,merchant:"Otra empresa",note:"SALARIO"}])};
    const b=ctx.dashboardBudgetStats(s);
    assert.equal(aMano(s.expenses),143647);
    assert.equal(b.nomina,4533); assert.equal(Math.round(b.remaining*100),6353);
  });
  // Un ingreso periódico de Plan también identifica la nómina sin la palabra (la regla de Mi ciclo).
  aLas("2026-10-30T10:00:00Z",()=>{
    const sin={...NOMINA,note:"",merchant:"ACME SINTETICA SL"};
    const flows=[{id:"f",kind:"income",name:"ACME SINTETICA",amount:3333,to:"sabadell",day:30}];
    const conPlan=ctx.dashboardBudgetStats({...OCT,flows,expenses:filasOct().concat([sin])});
    assert.equal(Math.round(conPlan.remaining*100),6353);
    // Sin nómina detectada: el ingreso cuenta como cualquier otro y el margen no pasa del límite.
    const sinPlan=ctx.dashboardBudgetStats({...OCT,expenses:filasOct().concat([sin])});
    assert.equal(sinPlan.nomina,0); assert.equal(sinPlan.against,0); assert.equal(sinPlan.remaining,1500,
      "ingresos mayores que el gasto: lo usado es 0 y quedan 1.500, no 3.396");
    assert.equal(JSON.stringify(sinPlan.noNominas),JSON.stringify([ctx.keyOfExpense(sin)]));
  });
  // Ingresos mayores que el gasto, sin nómina: tope en el límite (el neto se sigue viendo en balance).
  aLas("2026-10-26T10:00:00Z",()=>{
    const s={...OCT,expenses:[{id:"g",date:"2026-10-03T12:00:00Z",amount:100,category:"super",ent:"sabadell"},
      {id:"b",date:"2026-10-04T12:00:00Z",amount:-150,merchant:"Bizum",category:"bizum",ent:"sabadell"}]};
    const b=ctx.dashboardBudgetStats(s);
    assert.equal(b.against,0); assert.equal(b.remaining,1500); assert.equal(b.balance,50);
  });
  // Devolución de una compra: la compra suma y su devolución resta UNA vez (filas con signo propio).
  aLas("2026-10-26T10:00:00Z",()=>{
    const compra={id:"c",date:"2026-10-05T12:00:00Z",amount:250,merchant:"Tienda sintética",category:"ropa",ent:"sabadell",source:"ob:sabadell#refR1"};
    const devol={...compra,id:"d",date:"2026-10-07T12:00:00Z",amount:-250};
    const s={...OCT,expenses:[compra,devol,{id:"g",date:"2026-10-08T12:00:00Z",amount:100,category:"super",ent:"sabadell"}]};
    const b=ctx.dashboardBudgetStats(s);
    assert.equal(b.spent,350); assert.equal(b.income,250); assert.equal(b.against,100); assert.equal(b.remaining,1400);
    assert.equal(JSON.stringify(b.noNominas),JSON.stringify([ctx.keyOfExpense(devol)]),"una devolución grande viaja como no-nómina al widget");
  });
  // Mi ciclo no cambia: neto sin tope, la nómina que lo abre fuera.
  aLas("2026-10-30T10:00:00Z",()=>{
    const s={...OCT,settings:{...OCT.settings,budgetCycle:true},expenses:filasOct().concat([NOMINA,
      {id:"g4",date:"2026-10-30T09:00:00Z",amount:20,category:"super",ent:"sabadell"},
      {id:"b4",date:"2026-10-30T09:30:00Z",amount:-50,merchant:"Bizum",category:"bizum",ent:"sabadell"}])};
    const c=ctx.dashboardBudgetStats(s);
    assert.equal(c.cycle,true); assert.equal(c.mode,"net"); assert.equal(c.against,-30); assert.equal(c.remaining,1530);
  });
  // Meses cerrados (oráculo cambiado en la R2 de la revisión, 26/10/2026): la cifra grande de la
  // tarjeta sigue la preferencia (Gastos: 1.922,19 bruto), pero lo que compara con el límite es lo
  // mismo que se vio todo el mes, 1.436,47. Antes fijaba 1.922,19 y el 1/11 diría «128 % del
  // presupuesto» de un octubre que se vio entero «64 € por debajo». Gastos no enseña margen en un
  // mes pasado (`budgetApplies`, e2e gastos-v5).
  aLas("2026-11-02T10:00:00Z",()=>{
    const s={...OCT,settings:{...OCT.settings,gTotalMode:"split"},expenses:filasOct().concat([NOMINA])};
    const card=ctx.closedMonthCardOf(s,Date.parse("2026-11-02T10:00:00Z"));
    assert.ok(card&&card.stats,"hay informe del mes cerrado");
    assert.equal(card.stats.mode,"split"); assert.equal(Math.round(card.stats.shown*100),192219);
    assert.equal(Math.round(card.stats.against*100),aMano(s.expenses));
    assert.equal(Math.round(card.stats.remaining*100),6353);
    // La racha de meses bajo el límite usa el límite de CADA mes y la misma regla: octubre cuenta.
    const racha=ctx.underBudgetStreak({...s,budgetByMonth:{"2026-10":1500}},Date.parse("2026-11-02T10:00:00Z"));
    assert.equal(JSON.stringify(racha),JSON.stringify({current:1,best:1,ever:true}));
    // Con un límite de 1.400 aquel mes no se cumplió: la regla no regala la racha.
    const sin=ctx.underBudgetStreak({...s,budgetByMonth:{"2026-10":1400}},Date.parse("2026-11-02T10:00:00Z"));
    assert.equal(sin.ever,false);
  });
});

t("los importes llevan punto de miles también con cuatro cifras", () => {
  // `eur`/`eur0` son `const` del monolito: no cuelgan del contexto, se evalúan dentro.
  const fmt=(expr)=>vm.runInContext(expr,ctx).replace(/\s/g," ");
  assert.equal(fmt("eur(1426.23)"),"1.426,23 €");
  assert.equal(fmt("eur0(1911.95)"),"1.912 €");
  assert.equal(fmt("eur(193993.44)"),"193.993,44 €");
  assert.equal(fmt("eur(999.5)"),"999,50 €");
  assert.equal(ctx.eurParts(1426.23).ent,"1.426");
});

console.log("\nmonth-budget-stats: OK");
