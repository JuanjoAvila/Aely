#!/usr/bin/env node
/** Helper único de cargos del Plan: recibos ≠ traspasos/nómina (audit Claude 17/9 + NO-GO). */
import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const c = loadPureLogicFromFile();
let reloj=new Date("2026-09-10T12:00:00+02:00");
c.Date=class extends Date {
  constructor(...args){ super(...(args.length?args:[reloj.getTime()])); }
  static now(){ return reloj.getTime(); }
};

function base(overrides) {
  return Object.assign({
    fixed: [
      { id: "luz", name: "Luz", amount: 40, freq: "mes", day: 28, account: "sabadell" },
    ],
    debts: [
      { id: "coche", name: "Coche", monthly: 200, value: 5000, account: "sabadell", day: 28 },
    ],
    oneoffs: [
      { id: "itv", name: "ITV", amount: 50, year: 2026, month: 9, day: 20, account: "sabadell" },
    ],
    flows: [
      { id: "nom", kind: "income", name: "Nómina", amount: 2000, to: "sabadell", day: 1 },
      { id: "tr", kind: "transfer", name: "A TR", amount: 100, from: "sabadell", to: "trade_republic", day: 25 },
    ],
    accounts: [{ id: "sb", ent: "sabadell", role: "fijos", value: 1000 }],
  }, overrides || {});
}

console.log("plan-charges");

{
  const antiguo=base({fixed:[],debts:[],oneoffs:[],
    accounts:[{id:"sb",ent:"sabadell",role:"fijos",value:3000},{id:"rv",ent:"revolut",role:"fijos",value:700}],
    flows:[{id:"nom",kind:"income",name:"Nómina",amount:2000,to:"sabadell",day:15}],
    bankTx:[{id:"salary",ent:"sabadell",date:"2026-09-08",amount:-2000,merchant:"Empresa",status:"BOOK"}],
    expenses:[]});
  const mostrado=function(s,ent){ const a=s.accounts.find(function(x){ return x.ent===ent; });
    const i=c.insumosSaldoGasto(s); return c.saldoCuentaMostrada(a,{
      injTR:i.injTR,spentByBank:i.spentByBank,paidNetByBank:i.paidNetByBank,
      roundup:i.roundup,monthlyInvest:i.monthlyInvest}); };
  assert.equal(c.monthNetForAccount(antiguo,"sabadell",2026,9,10),0);
  assert.equal(c.monthNetForAccount(antiguo,"sabadell",2026,9,15),2000);
  const nuevo=c.reconcileEarlyIncomeAnchors(antiguo,2026,9,10);
  assert.equal(nuevo.flows[0].paidDay,8,"solo se persiste el día confirmado");
  assert.equal(nuevo.accounts[0].value,1000,"la base se ajusta al adelantar la ocurrencia");
  assert.equal(mostrado(nuevo,"sabadell"),mostrado(antiguo,"sabadell"),"instalar no mueve el saldo mostrado");
  assert.equal(mostrado(nuevo,"revolut"),700,"otro banco no cambia");
  assert.equal(c.monthNetForAccount(nuevo,"sabadell",2026,9,10),2000);
  assert.equal(c.monthNetForAccount(nuevo,"sabadell",2026,9,15),2000,"el día previsto no suma otra nómina");
  assert.equal(c.reconcileEarlyIncomeAnchors(nuevo,2026,9,10),nuevo,"repetir la conciliación no reancla dos veces");
  const dosCuentas=Object.assign({},antiguo,{accounts:[
    {id:"sb-1",ent:"sabadell",role:"fijos",value:3000},
    {id:"sb-2",ent:"sabadell",role:"fijos",value:700}]});
  assert.equal(c.reconcileEarlyIncomeAnchors(dosCuentas,2026,9,10),dosCuentas,
    "un extracto sin cuenta de destino no mueve dos saldos del mismo banco");
  const duplicado=Object.assign({},nuevo,{bankTx:antiguo.bankTx.concat([Object.assign({},antiguo.bankTx[0],{id:"salary-2"})])});
  const ambiguo=c.reconcileEarlyIncomeAnchors(duplicado,2026,9,10);
  assert.equal(ambiguo.flows[0].paidYm,undefined,"otro abono compatible retira la atribución anterior");
  assert.equal(mostrado(ambiguo,"sabadell"),3000,"la ambigüedad posterior tampoco mueve el saldo");
  let editado;
  c.patchFlowById(function(updater){ editado=updater(nuevo); },"nom",{amount:2500});
  assert.equal(editado.flows[0].paidYm,undefined,"cambiar el importe invalida la atribución bancaria");
  assert.equal(mostrado(editado,"sabadell"),3000,"editar el ingreso no mueve el saldo actual");
  assert.equal(c.monthNetForAccount(editado,"sabadell",2026,9,10),0);
  const segundo=Object.assign({},nuevo,{bankTx:[]});
  assert.equal(c.monthNetForAccount(segundo,"sabadell",2026,9,15),2000,"el segundo móvil conserva el día sin extracto");
  assert.equal(c.planChargesMonth(segundo,9,2026,10).incomePending.length,0,"sin banco local no revive la previsión");
  reloj=new Date("2026-09-15T12:00:00+02:00");
  assert.equal(mostrado(segundo,"sabadell"),3000,"el saldo no salta al llegar el día planificado");
  const tarde=base({fixed:[],debts:[],oneoffs:[],accounts:[{id:"sb",ent:"sabadell",role:"fijos",value:1000}],
    flows:antiguo.flows,bankTx:antiguo.bankTx,expenses:[]});
  const alActualizarTarde=c.reconcileEarlyIncomeAnchors(tarde,2026,9,15);
  assert.equal(alActualizarTarde.accounts[0].value,1000,"una base ya anclada tras el día 15 no se reajusta");
  assert.equal(mostrado(alActualizarTarde,"sabadell"),mostrado(tarde,"sabadell"));
  const sinFeed=Object.assign({},antiguo,{bankTx:[]});
  assert.equal(c.reconcileEarlyIncomeAnchors(sinFeed,2026,9,10),sinFeed,"un sync fallido sin prueba no inventa el abono");
  reloj=new Date("2026-09-10T12:00:00+02:00");
  const dudoso=Object.assign({},antiguo,{bankTx:antiguo.bankTx.concat([Object.assign({},antiguo.bankTx[0],{id:"otro"})])});
  assert.equal(c.reconcileEarlyIncomeAnchors(dudoso,2026,9,10),dudoso,"dos abonos compatibles no alteran el saldo");
}

{
  const p = c.planChargesMonth(base(), 9, 2026, 10);
  assert.equal(p.pendingBills.length, 3, "luz+coche+itv pendientes el día 10");
  assert.equal(p.pendingBillsTotal, 290);
  assert.equal(p.transfersPending.length, 1);
  assert.equal(p.incomePending.length, 0, "nómina día 1 ya pagada");
  assert.ok(p.pendingBills.every((x) => x.kind !== "transfer" && x.kind !== "income"));
  const s = c.pendingBillsSummary(base(), 9, 2026, 10);
  assert.equal(s.count, p.pendingBills.length);
  assert.equal(s.total, p.pendingBillsTotal);
}

{
  const state=base({
    fixed:[], debts:[], oneoffs:[],
    flows:[{id:"nom",kind:"income",name:"Nómina",amount:2000,to:"sabadell",day:25}],
    bankTx:[{id:"bank-income",ent:"sabadell",date:"2026-09-20",amount:-2000,merchant:"Empresa",status:"BOOK"}],
  });
  assert.equal(c.planChargesMonth(state,9,2026,21).incomePending.length,0,
    "un abono bancario inequívoco anterior al día previsto no vuelve a figurar como nómina futura");
  assert.equal(c.bankPendingEvents(state,"sabadell",2026,9,21).length,0,
    "el simulador tampoco suma de nuevo el abono ya incluido en el saldo");
  assert.equal(c.planChargesMonth(Object.assign({},state,{bankTx:[
    {id:"other-bank",ent:"revolut",date:"2026-09-20",amount:-2000,merchant:"Empresa",status:"BOOK"},
  ]}),9,2026,21).incomePending.length,1,"otro banco no confirma esta nómina");
  assert.equal(c.planChargesMonth(Object.assign({},state,{bankTx:[
    {id:"other-amount",ent:"sabadell",date:"2026-09-20",amount:-1200,merchant:"Empresa",status:"BOOK"},
  ]}),9,2026,21).incomePending.length,1,"otro importe no confirma esta nómina");
  assert.equal(c.planChargesMonth(Object.assign({},state,{bankTx:[
    {id:"old-month",ent:"sabadell",date:"2026-08-20",amount:-2000,merchant:"Empresa",status:"BOOK"},
  ]}),9,2026,21).incomePending.length,1,"un abono del mes anterior no confirma la nómina actual");
  assert.equal(c.planChargesMonth(Object.assign({},state,{bankTx:[
    {id:"future",ent:"sabadell",date:"2026-09-22",amount:-2000,merchant:"Empresa",status:"BOOK"},
  ]}),9,2026,21).incomePending.length,1,"un abono posterior a hoy aún no está cobrado");
  assert.equal(c.planChargesMonth(Object.assign({},state,{bankTx:state.bankTx.concat([
    {id:"second",ent:"sabadell",date:"2026-09-20",amount:-2000,merchant:"Empresa",status:"BOOK"},
  ])}),9,2026,21).incomePending.length,1,"dos abonos bancarios compatibles no se atribuyen a uno solo");
  assert.equal(c.planChargesMonth(Object.assign({},state,{bankTx:[
    {id:"pending",ent:"sabadell",date:"2026-09-20",amount:-2000,merchant:"Empresa",status:"PDNG"},
  ]}),9,2026,21).incomePending.length,1,"un movimiento bancario pendiente no confirma el cobro");
  assert.equal(c.planChargesMonth(Object.assign({},state,{bankTx:[
    {id:"unknown",ent:"sabadell",date:"2026-09-20",amount:-2000,merchant:"Empresa"},
  ]}),9,2026,21).incomePending.length,1,"sin estado contabilizado no se confirma el cobro");
  assert.equal(c.planChargesMonth(Object.assign({},state,{flows:[
    {id:"nom",kind:"income",name:"Nómina",amount:2000,to:"sabadell"},
  ]}),9,2026,21).incomePending.length,1,"sin día previsto no se atribuye un abono por parecido");
  assert.equal(c.planChargesMonth(Object.assign({},state,{flows:state.flows.concat([
    {id:"other-flow",kind:"income",name:"Otra entrada",amount:2000,to:"sabadell",day:26},
  ])}),9,2026,21).incomePending.length,2,"dos ingresos modelados compatibles quedan sin atribuir");
}

{
  const p = c.planChargesMonth(base(), 9, 2026, 30);
  assert.equal(p.pendingBills.length, 1,"un fijo vencido sin evidencia bancaria no se presenta como pagado");
  assert.equal(p.pendingBills[0].overdue,true);
  assert.equal(p.paidBills.length, 2,"cuotas y puntuales conservan su proyección fuera de INC-3009-01");
  assert.equal(p.transfersPending.length, 0);
}

{
  // Deuda SIN day: pendiente, day null (no fallback día 1)
  const p = c.planChargesMonth(base({
    fixed: [], oneoffs: [], flows: [],
    debts: [{ id: "x", name: "Sin día", monthly: 80, value: 800, account: "sabadell" }],
  }), 9, 2026, 15);
  assert.equal(p.pendingBills.length, 1);
  assert.equal(p.pendingBills[0].day, null);
  assert.equal(p.pendingBills[0].paid, false);
}

{
  const st = c.planCoverState({ minByBank: { sabadell: -10 }, minDayByBank: { sabadell: 12 } }, "sabadell", 200);
  assert.equal(st.tone, "bad");
  const warn = c.planCoverState({ minByBank: { sabadell: 50 }, minDayByBank: { sabadell: 12 } }, "sabadell", 200);
  assert.equal(warn.tone, "warn");
  const ok = c.planCoverState({ minByBank: { sabadell: 500 }, minDayByBank: { sabadell: 12 } }, "sabadell", 200);
  assert.equal(ok.tone, "ok");
}

{
  // Multi-banco: el peor (bad) gana
  const pick = c.planCoverPickBank(
    { minByBank: { sabadell: 500, revolut: -20 }, minDayByBank: { sabadell: 5, revolut: 8 } },
    { sabadell: 40, revolut: 15 },
    [
      { bank: "sabadell", amount: 40 },
      { bank: "revolut", amount: 15 },
    ]
  );
  assert.equal(pick.bank, "revolut");
  assert.equal(pick.cover.tone, "bad");
}

{
  // Todo pagado: sin pendientes, el banco sale del mayor recibo pagado
  const pick = c.planCoverPickBank(
    { minByBank: { sabadell: 800 }, minDayByBank: { sabadell: 0 }, mainBank: "sabadell" },
    {},
    [],
    [{ bank: "sabadell", amount: 40, name: "Luz" }]
  );
  assert.equal(pick.bank, "sabadell");
  assert.equal(pick.pending, 0);
}

{
  // Deuda sin día: la portada descuenta la cuota del mínimo (sin tocar 11)
  const st = c.planCoverState(
    { minByBank: { sabadell: 500 }, minDayByBank: { sabadell: 12 } },
    "sabadell",
    80,
    [{ bank: "sabadell", amount: 80, day: null, kind: "debt", name: "Sin día" }]
  );
  assert.equal(st.min, 420);
  assert.equal(st.minDay, null);
  // 420 >= 80 → ok; con saldo más justo sería warn/bad
  assert.equal(st.tone, "ok");
  const tight = c.planCoverState(
    { minByBank: { sabadell: 100 }, minDayByBank: { sabadell: 12 } },
    "sabadell",
    80,
    [{ bank: "sabadell", amount: 80, day: null, kind: "debt" }]
  );
  assert.equal(tight.min, 20);
  assert.equal(tight.tone, "warn");
}

{
  // El fijo sin día ya llevó 500 → 400 en minByBank; solo falta descontar la deuda de 50.
  // Restar ambos otra vez daría 250 y anunciaría un descubierto ficticio.
  const st = c.planCoverState(
    { minByBank: { sabadell: 400 }, minDayByBank: { sabadell: 0 } },
    "sabadell",
    100,
    [
      { bank: "sabadell", amount: 100, day: null, kind: "fixed", name: "Luz" },
      { bank: "sabadell", amount: 50, day: null, kind: "debt", name: "Préstamo" },
    ]
  );
  assert.equal(st.min, 350);
  assert.equal(st.minDay, null);
}

console.log("  ok");
