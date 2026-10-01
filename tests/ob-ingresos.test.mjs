#!/usr/bin/env node
/**
 * IMPORTAR DEL BANCO: compras E INGRESOS.
 *
 * Origen (2026-07-26): una sugerencia escrita desde la app el 16 de julio que estuvo DIEZ DÍAS sin
 * que la leyera nadie — «no me ha leído un ingreso de la caixa…».
 *
 * Convención de signos: POSITIVO = gasto, NEGATIVO = ingreso.
 *
 * ★ 2026-08-05: entra TODO de cualquier banco (estilo extracto). Solo `expenseBankEnts`
 *   (diario + extras marcados) resta del presupuesto/saldo; el resto se apunta con
 *   `budgetSkip` y se ve como «no afecta». Los Fijos modelados no se duplican en ningún banco.
 *
 * ★ 2026-08-03 (histórico): en la cuenta diaria cualquier cargo; ingresos de cualquier banco.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadPureLogic, loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

// La frontera nocturna se prueba con ambas zonas también desde el runner de CI.
if(!process.argv.includes("--zone-child")){
  for(const zone of ["UTC","Europe/Madrid"]){
    const r=spawnSync(process.execPath,[fileURLToPath(import.meta.url),"--zone-child",...process.argv.slice(2)],{
      env:{...process.env,TZ:zone},stdio:"inherit"});
    if(r.status!==0) process.exit(r.status||1);
  }
  process.exit(0);
}
const mutation=process.argv.find(x=>x.startsWith("--mutation="))?.split("=")[1];
const mutations={
  status:['if(status && status!=="BOOK") return;',''],
  future:['if(dayKey(day)!==date || date>todayKey) return;','if(dayKey(day)!==date) return;'],
};
let ctx;
if(mutation){
  const pair=mutations[mutation]; assert.ok(pair,"mutación desconocida");
  const html=fs.readFileSync(new URL("../public/index.html",import.meta.url),"utf8");
  assert.equal(html.split(pair[0]).length,2,"una sola guardia se muta");
  ctx=loadPureLogic(html.replace(pair[0],pair[1]));
} else ctx=loadPureLogicFromFile();
let reloj = Date.parse("2026-09-30T12:00:00Z");
ctx.Date = class extends Date {
  constructor(...args){ super(...(args.length ? args : [reloj])); }
  static now(){ return reloj; }
};

function t(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
}

console.log("ob-ingresos");

const hoy = "2026-09-30";
const estado = {
  accounts: [{ id: "a1", ent: "caixa", name: "Cuenta", value: 1000, spendFrom: true, role: "diario" }],
  expenses: [],
  fixed: [],
  debts: [],
  oneoffs: [],
  settings: { expenseBanks: ["caixa", "sabadell"] },
};
const tx = (o) => Object.assign({ ent: "caixa", id: null, date: hoy, amount: 0, merchant: "", note: "", card: false, status: "" }, o);

t("un INGRESO del banco se apunta (el fallo del 16 de julio)", () => {
  const add = ctx.importObExpenses(estado, [tx({ amount: -1250, merchant: "NOMINA JULIO", id: "x1" })]);
  assert.ok(add && add.length === 1, "el ingreso tiene que entrar");
  assert.equal(add[0].amount, -1250);
  assert.equal(add[0].category, "ingreso");
  assert.equal(add[0].ent, "caixa");
});

t("una compra con tarjeta se sigue apuntando como gasto", () => {
  const add = ctx.importObExpenses(estado, [tx({ amount: 23.4, merchant: "Mercadona", card: true, id: "x2" })]);
  assert.ok(add && add.length === 1);
  assert.equal(add[0].amount, 23.4);
  assert.notEqual(add[0].category, "ingreso");
});

t("en la cuenta de GASTO DIARIO, un cargo SIN tarjeta también cuenta ahora (2026-08-03)", () => {
  const add = ctx.importObExpenses(estado, [tx({ amount: 230, merchant: "SEGURO COCHE", card: false, id: "x3" })]);
  assert.ok(add && add.length === 1, "sin Fijo modelado, el cargo de la cuenta diaria entra igual");
  assert.equal(add[0].amount, 230);
});

t("...salvo que YA sea un Fijo modelado este mes en esa cuenta: no se duplica", () => {
  const conFijo = Object.assign({}, estado, {
    fixed: [{ id: "f1", name: "Seguro coche", amount: 230, freq: "mes", account: "caixa" }],
  });
  const add = ctx.importObExpenses(conFijo, [tx({ amount: 230, merchant: "SEGURO COCHE", card: false, id: "x3b" })]);
  assert.equal(add, null, "ya está contado por el motor mensual — importarlo también sería doble conteo");
});

t("en un banco EXTRA de gasto diario, un cargo SIN tarjeta también entra (2026-08-05: todo el extracto)", () => {
  const add = ctx.importObExpenses(estado, [tx({ ent: "sabadell", amount: 55, merchant: "SEGURO HOGAR", card: false, id: "x3c" })]);
  assert.ok(add && add.length === 1);
  assert.equal(add[0].budgetSkip, undefined);
  assert.equal(ctx.expenseCountsBudget(add[0], estado), true);
});

t("...pero si YA es un Fijo modelado en ese banco extra, no se duplica", () => {
  const conFijo = Object.assign({}, estado, {
    fixed: [{ id: "f2", name: "Seguro hogar", amount: 55, freq: "mes", account: "sabadell" }],
  });
  const add = ctx.importObExpenses(conFijo, [tx({ ent: "sabadell", amount: 55, merchant: "SEGURO HOGAR", card: false, id: "x3c2" })]);
  assert.equal(add, null);
});

t("una compra CON tarjeta en banco extra de gasto diario sí cuenta", () => {
  const add = ctx.importObExpenses(estado, [tx({ ent: "sabadell", amount: 12, merchant: "Bar Paco", card: true, id: "x3d" })]);
  assert.ok(add && add.length === 1);
});

t("un ingreso ya importado no entra dos veces (dedup por ext_id)", () => {
  const previo = Object.assign({}, estado, {
    expenses: [{ id: "e1", extId: "x9", date: hoy + "T12:00:00.000Z", amount: -900, merchant: "NOMINA", category: "ingreso" }],
  });
  const add = ctx.importObExpenses(previo, [tx({ amount: -900, merchant: "NOMINA", id: "x9" })]);
  assert.equal(add, null);
});

t("un INGRESO entra de CUALQUIER banco enlazado (Mi ciclo), aunque no sea de gasto diario", () => {
  const add = ctx.importObExpenses(estado, [tx({ ent: "bbva", amount: -500, merchant: "TRANSFERENCIA", id: "x4" })]);
  assert.ok(add && add.length === 1);
  assert.equal(add[0].category, "ingreso");
  assert.equal(add[0].ent, "bbva");
  assert.equal(add[0].budgetSkip, true);
  assert.equal(ctx.expenseCountsBudget(add[0], estado), false);
});

t("un GASTO de un banco que NO es de gasto diario también entra, pero NO resta del presupuesto (2026-08-05)", () => {
  const add = ctx.importObExpenses(estado, [tx({ ent: "bbva", amount: 40, merchant: "Bar", card: true, id: "x4b" })]);
  assert.ok(add && add.length === 1);
  assert.equal(add[0].budgetSkip, true);
  assert.equal(ctx.expenseCountsCash(add[0], estado), false);
  assert.equal(ctx.expenseCountsBudget(add[0], estado), false);
});

t("sin comercio, un ingreso se titula «Ingreso» y no «Compra»", () => {
  const add = ctx.importObExpenses(estado, [tx({ amount: -60, merchant: "", id: "x5" })]);
  assert.equal(add[0].merchant, "Ingreso");
});

// 30/9: una nómina de Sabadell se vio como movimiento normal antes de cobrarla y arrancó
// «Mi ciclo». Se reproduce con PDNG sintético; no acredita qué estado mandó el banco real.
t("un ingreso PENDIENTE (PDNG) no se apunta ni ancla «Mi ciclo»", () => {
  const conFlujo = Object.assign({}, estado, {
    flows: [{ id: "n1", kind: "income", name: "Nomina", amount: 1800, to: "sabadell", day: 28 }],
  });
  ["PDNG", "pdng", "HOLD", "SCHD", "CNCL", "RJCT", "INFO"].forEach(function (st) {
    const add = ctx.importObExpenses(conFlujo, [tx({ ent: "sabadell", amount: -1800, merchant: "NOMINA EMPRESA SL", id: "p-" + st, status: st })]);
    assert.equal(add, null, st + " no es dinero cobrado");
  });
  assert.equal(ctx.budgetPaydayOf(conFlujo, reloj, []), null, "sin cobro real el ciclo no arranca");
});

t("...y el mismo abono ya contabilizado (BOOK) sí entra y ancla el ciclo", () => {
  const conFlujo = Object.assign({}, estado, {
    flows: [{ id: "n1", kind: "income", name: "Nomina", amount: 1800, to: "sabadell", day: 28 }],
  });
  const add = ctx.importObExpenses(conFlujo, [tx({ ent: "sabadell", amount: -1800, merchant: "NOMINA EMPRESA SL", id: "b1", status: "BOOK" })]);
  assert.ok(add && add.length === 1);
  const ancla = ctx.budgetPaydayOf(conFlujo, reloj, add);
  assert.ok(ancla && ancla.inc === add[0], "el cobro contabilizado abre el ciclo");
});

t("un banco que no informa el estado sigue apuntando el ingreso (sin regresión)", () => {
  const add = ctx.importObExpenses(estado, [tx({ ent: "sabadell", amount: -700, merchant: "TRANSFERENCIA", id: "s0", status: "" })]);
  assert.ok(add && add.length === 1);
});

const flujo = { id:"n1", kind:"income", name:"Nomina", amount:1800, to:"sabadell", day:7 };
function cartera(){ return Object.assign({}, estado, {budget:500,
  accounts:[{id:"sb",ent:"sabadell",role:"diario",spendFrom:true,value:400}],
  flows:[flujo], settings:{expenseBanks:["sabadell"],budgetCycle:true,gTotalMode:"net"}, expenses:[]}); }
const abono = (patch) => tx(Object.assign({ent:"sabadell",amount:-1800,merchant:"NOMINA EMPRESA SL",id:"salario",status:"BOOK"},patch));
function mostrado(s){
  const i=ctx.insumosSaldoGasto(s);
  return ctx.saldoCuentaMostrada(s.accounts[0],i);
}
t("BOOK futuro no entra ni aumenta saldo, ingresos o disponible", () => {
  reloj=Date.parse("2026-09-29T12:00:00Z");
  const s=cartera(), before=ctx.monthBudgetStats(s);
  const add=ctx.importObExpenses(s,[abono({date:"2026-09-30"})]);
  assert.equal(add,null,"BOOK no acredita un cobro fechado mañana");
  const after=Object.assign({},s,{expenses:(add||[]).concat(s.expenses)});
  assert.equal(mostrado(after),400);
  assert.equal(ctx.monthBudgetStats(after).income,before.income);
  assert.equal(ctx.monthBudgetStats(after).remaining,before.remaining);
  assert.equal(ctx.budgetPaydayOf(after,reloj),null);
  assert.equal(ctx.importObExpenses(s,[abono({date:"2026-09-30",status:""})]),null,"sin estado tampoco se anticipa");
  reloj=Date.parse("2026-09-30T12:00:00Z");
});
t("estado desconocido y fecha inexistente no acreditan el ingreso", () => {
  for(const patch of [{status:" PDNG "},{status:"UNKNOWN"},{date:"2026-09-31"},{date:"invalid"}]){
    assert.equal(ctx.importObExpenses(cartera(),[abono(patch)]),null,JSON.stringify(patch));
  }
});
t("PDNG → BOOK conserva una sola identidad y el sync posterior no duplica", () => {
  let s=cartera();
  assert.equal(ctx.importObExpenses(s,[abono({status:"PDNG"})]),null);
  const add=ctx.importObExpenses(s,[abono()]);
  assert.equal(add.length,1);
  assert.equal(add[0].extId,"salario");
  s=Object.assign({},s,{expenses:add});
  assert.equal(ctx.importObExpenses(s,[abono(),abono()]),null);
  assert.equal(ctx.budgetPaydayOf(s,reloj).inc.id,add[0].id);
  assert.equal(ctx.monthBudgetStats(s).income,0,"la nómina abre el ciclo sin ampliar el límite");
  assert.equal(ctx.monthBudgetStats(s).remaining,500);
  assert.equal(ctx.importObExpenses(cartera(),[abono({status:"PDNG"}),abono(),abono()]).length,1);
});
t("sync bancario reancla al saldo acreditado sin volver a sumar la nómina", () => {
  const links=(status,bal) => [{aspsp:"Sabadell",ok:true,accounts:[{uid:"synthetic",ok:true,
    balances:[{type:"ITAV",amount:bal,currency:"EUR"}],
    transactions:[{ext_id:"salario",date:hoy,amount:-1800,merchant:"NOMINA EMPRESA SL",status:status}]}]}];
  const sync=(s,status,bal) => {
    const feed=links(status,bal), txs=ctx.flattenBankTx(feed), add=ctx.importObExpenses(s,txs);
    const imported=Object.assign({},s,{expenses:(add||[]).concat(s.expenses),bankTx:txs});
    const anchored=ctx.reconcileEarlyIncomeAnchors(imported,2026,9,30);
    return ctx.applyBankBalances(anchored,feed).state;
  };
  const pending=sync(cartera(),"PDNG",400);
  assert.equal(pending.expenses.length,0);
  assert.equal(mostrado(pending),400);
  assert.equal(ctx.monthBudgetStats(pending).remaining,500);
  const booked=sync(pending,"BOOK",2200);
  assert.equal(booked.expenses.length,1);
  assert.equal(mostrado(booked),2200,"saldo real 400+1800, nunca 400+1800+1800");
  const repeated=sync(booked,"BOOK",2200);
  assert.equal(repeated.expenses.length,1);
  assert.equal(repeated.expenses[0].id,booked.expenses[0].id);
  assert.equal(mostrado(repeated),2200);
  assert.equal(ctx.monthBudgetStats(repeated).remaining,500);
});
t("manual coincidente sin nombre mantiene decisión pendiente y no suma dos ingresos", () => {
  const manual={id:"manual",source:"manual",ent:"sabadell",date:"2026-09-30T12:00:00Z",amount:-1800,merchant:"Nomina",category:"ingreso"};
  const s=Object.assign(cartera(),{expenses:[manual]});
  const add=ctx.importObExpenses(s,[abono({merchant:"Movimiento"})]);
  assert.equal(add.length,1);
  assert.equal(add[0].possibleDup,true);
  assert.equal(add[0].possibleDupOf,manual.id);
  const after=Object.assign({},s,{expenses:add.concat(s.expenses)});
  assert.equal(ctx.budgetPaydayOf(after,reloj).inc.id,manual.id);
  assert.equal(mostrado(after),mostrado(s));
  assert.equal(ctx.monthBudgetStats(after).remaining,ctx.monthBudgetStats(s).remaining);
});
t("banco+id distingue ingresos y sin id el nombre bancario sobrevive al renombrado", () => {
  const s=cartera(), add=ctx.importObExpenses(s,[abono(),abono({ent:"caixa"})]);
  assert.equal(add.length,2,"el mismo entry_reference no es global entre bancos");
  const sinId=ctx.importObExpenses(s,[abono({id:null})]);
  const renamed=Object.assign({},sinId[0],{merchant:"Mi empresa"});
  assert.equal(ctx.importObExpenses(Object.assign({},s,{expenses:[renamed]}),[abono({id:null})]),null);
});
t("frontera 30 septiembre → 1 octubre: la importación usa el día financiero Madrid", () => {
  for(const [instant,day] of [["2026-09-30T21:59:00Z","2026-09-30"],
    ["2026-09-30T22:01:00Z","2026-10-01"],
    ["2026-10-01T00:01:00Z","2026-10-01"]]){
    reloj=Date.parse(instant);
    const add=ctx.importObExpenses(cartera(),[abono({date:"2026-10-01"})]);
    assert.equal(!!add,day==="2026-10-01",instant+" / "+process.env.TZ);
    assert.equal(ctx.importObExpenses(cartera(),[abono({date:"2026-10-02"})]),null,"el día 2 sigue siendo futuro en ambas zonas");
    if(add && new Date(reloj).getDate()===1) assert.equal(ctx.budgetPaydayOf(cartera(),reloj,add).inc.id,add[0].id);
  }
  reloj=Date.parse("2026-09-30T12:00:00Z");
});
console.log("\nob-ingresos: OK");
