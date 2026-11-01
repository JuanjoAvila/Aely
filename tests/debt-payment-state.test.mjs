import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {loadPureLogic,loadPureLogicFromFile} from "../scripts/load-pure-logic.mjs";

const ref=process.argv[process.argv.indexOf("--source-ref")+1];
const c=process.argv.includes("--source-ref")?loadPureLogic(execFileSync("git",["show",ref+":public/index.html"],{encoding:"utf8",maxBuffer:8e6})):loadPureLogicFromFile();
const now=new Date(),y=now.getFullYear(),m=now.getMonth()+1;
const date=(day,mo=m,yr=y)=>yr+"-"+String(mo).padStart(2,"0")+"-"+String(day).padStart(2,"0");
const debt={id:"loan-a",name:"Préstamo sintético A",monthly:60,value:12000,account:"sabadell",day:3,asOf:y*12+m-1};
const expense={id:"charge-a",merchant:"Prestamista sintético",obName:"Prestamista sintético",amount:60,date:date(2),ent:"sabadell",category:"deudas",source:"ob",debtId:"loan-a"};
const state=(x={})=>Object.assign({debts:[debt],expenses:[expense],fixed:[],flows:[],oneoffs:[],accounts:[{id:"sb",ent:"sabadell",value:800,role:"fijos"}],bankTx:[],deleted:[]},x);
let total=0;
function test(name,fn){ fn();total++;console.log("✓ "+name); }
function pending(s,d=debt,mo=m,yr=y,t=2){ return c.planChargesMonth(s,mo,yr,t).pendingBills.filter(x=>x.id==="debt_"+d.id); }
test("cuota vinculada del día anterior ya pagada, pendiente cero",()=>{
  const s=state(),p=c.planChargesMonth(s,m,y,2);
  assert.equal(p.pendingBillsTotal,0);assert.equal(p.paidBillsTotal,60);assert.equal(p.paidBills.length,1);
  assert.equal(c.pendingBillsSummary(s,m,y,2).total,0);
  assert.equal(c.bankPendingEvents(s,"sabadell",y,m,2).length,0);
  assert.equal(c.isDebtPaidThisMonth(debt,2,s,y,m),true);
});
test("no descuenta de nuevo del saldo actual ni modifica datos",()=>{
  const s=state(),before=JSON.stringify(s);
  assert.equal(c.monthNetForAccount(s,"sabadell",y,m,2),0);
  c.planChargesMonth(s,m,y,2);c.bankPendingEvents(s,"sabadell",y,m,2);
  assert.equal(JSON.stringify(s),before);
});
test("solo retira la deuda vinculada aunque otra tenga mismo importe y fecha",()=>{
  const other={...debt,id:"loan-b",name:"Préstamo sintético B"},s=state({debts:[debt,other]});
  const p=c.planChargesMonth(s,m,y,2);
  assert.equal(p.pendingBillsTotal,60);assert.equal(p.paidBillsTotal,60);
  assert.equal(p.pendingBills[0].id,"debt_loan-b");
  assert.equal(c.minWalk(800,c.bankPendingEvents(s,"sabadell",y,m,2)).end,740);
});
for(const [label,patch] of [["sin vínculo",{debtId:undefined}],["otra deuda",{debtId:"loan-b"}],["duplicado posible",{possibleDup:true}],["pendiente bancario",{status:"PDNG"}],["importe incompatible",{amount:15}],["categoría corregida",{category:"otros"}],["cargo futuro",{date:date(4)}],["año distinto",{date:date(2,m,y-1)}]]){
  test(label+" no acredita cuota",()=>assert.equal(pending(state({expenses:[{...expense,...patch}]})).length,1));
}
test("dos cargos compatibles vinculados no eligen por orden",()=>assert.equal(pending(state({expenses:[expense,{...expense,id:"charge-b",date:date(1)}]})).length,1));
test("misma identidad duplicada, también en otra deuda, no acredita",()=>assert.equal(pending(state({expenses:[expense,{...expense,id:"duplicate",debtId:"loan-b"}]})).length,1));
test("feed PDNG o duplicado contradice el vínculo",()=>{
  for(const rows of [[{...expense,status:"PDNG"}],[{...expense,status:"BOOK"},{...expense,status:"BOOK"}]]) assert.equal(pending(state({bankTx:rows})).length,1);
});
test("feed BOOK confirma sin contabilizar dos veces",()=>assert.equal(pending(state({bankTx:[{...expense,status:"BOOK"}]})).length,0));
test("lápida del cargo no acredita",()=>assert.equal(pending(state({deleted:[c.keyOfExpense(expense)]})).length,1));
test("cambio de mes: cuota día1 pagada último día anterior pertenece al vencimiento",()=>{
  const prev=new Date(y,m-1,0),d={...debt,day:1},x={...expense,date:date(prev.getDate(),prev.getMonth()+1,prev.getFullYear())};
  assert.equal(pending(state({debts:[d],expenses:[x]}),d,m,y,1).length,0);
  const proof=c.debtPaymentState(state({debts:[d],expenses:[x]}),d,y,m,1);
  assert.equal(proof.expense.id,expense.id);
  assert.equal(proof.day,1,"Plan conserva el día del vencimiento en su mes");
});
test("un cargo del mes pasado no paga la nueva cuota",()=>{
  const prev=new Date(y,m-2,2);
  assert.equal(pending(state({expenses:[{...expense,date:date(2,prev.getMonth()+1,prev.getFullYear())}]})).length,1);
});
test("fecha imposible no acredita",()=>assert.equal(pending(state({expenses:[{...expense,date:"2026-02-31"}]}),debt,2,2026,2).length,1));
test("mes ISO imposible no acredita aunque el parser lo normalice",()=>{
  for(const ds of ["2026-00-02","2025-13-02"]) assert.equal(c.debtPaymentState(state({expenses:[{...expense,date:ds}]}),debt,2026,1,2).expense,null);
});
test("sin fecha prevista no infiere el mes de una cuota",()=>{
  const d={...debt,day:undefined};
  assert.equal(pending(state({debts:[d]}),d).length,1);
});
test("identidad de deuda duplicada no atribuye el cargo",()=>assert.equal(pending(state({debts:[debt,{...debt}]})).length,2));
test("original USD es solo rastro, amount EUR acredita la cuota sin reconvertir",()=>assert.equal(pending(state({expenses:[{...expense,origAmount:75,origCur:"USD"}]})).length,0));
test("igual número USD no acredita importe EUR distinto",()=>assert.equal(pending(state({expenses:[{...expense,amount:48,origAmount:60,origCur:"USD"}]})).length,1));
test("59 EUR no acredita una cuota prevista de60 EUR",()=>assert.equal(pending(state({expenses:[{...expense,amount:59}]})).length,1));
/* Decisión del dueño (beta 4.26.200): la fila que ÉL marcó a mano como cuota de esta deuda
   (`debtManual`, «Es la cuota de…») la paga ese mes con lo que cobró el banco. La que enlazó el
   motor sigue la regla de arriba: céntimo exacto. */
for(const [label,patch] of [["59 EUR",{amount:59}],["641,27 EUR",{amount:641.27}],["48 EUR con rastro de 60 USD",{amount:48,origAmount:60,origCur:"USD"}]]){
  test("marcado a mano con "+label+" acredita la cuota de 60 EUR con su importe real",()=>{
    const s=state({expenses:[{...expense,...patch,debtManual:true}]}),p=c.planChargesMonth(s,m,y,2);
    assert.equal(pending(s).length,0);
    const row=p.paidBills.find(x=>x.id==="debt_"+debt.id);
    assert.equal(row.paidAmount,patch.amount);assert.equal(row.plannedBankAmount,60);
    assert.equal(c.bankPendingEvents(s,"sabadell",y,m,2).length,0,"no se resta dos veces del saldo");
    assert.equal(c.isDebtPaidThisMonth(debt,2,s,y,m),true);
  });
}
test("a mano también pasa los demás filtros: sin BOOK, otra deuda o futuro no acreditan",()=>{
  for(const patch of [{status:"PDNG"},{debtId:"loan-b"},{date:date(4)},{source:"manual"}]) assert.equal(pending(state({expenses:[{...expense,amount:59,debtManual:true,...patch}]})).length,1,JSON.stringify(patch));
});
test("la exacta manda: otra marcada a mano con otro importe no deshace el pago",()=>{
  const s=state({expenses:[expense,{...expense,id:"charge-b",merchant:"Otro",obName:"Otro",amount:15,debtManual:true}]});
  assert.equal(pending(s).length,0);assert.equal(c.debtPaymentState(s,debt,y,m,2).expense.id,expense.id);
});
test("dos marcadas a mano sin la exacta no eligen por orden",()=>assert.equal(pending(state({expenses:[{...expense,amount:59,debtManual:true},{...expense,id:"charge-b",merchant:"Otro",obName:"Otro",amount:15,debtManual:true}]})).length,1));
/* El enlace automático por NOMBRE (`cuotaCasa`, rama porNombre) o por el comercio aprendido
   (`cuotaAlias`) pasa por la pasada real del motor: el `debtId` no lo pone el test. */
test("motor por nombre con 59 EUR: enlaza la fila pero no paga la cuota de 60",()=>{
  const r=c.marcarCuotasDeDeuda(state({expenses:[{...expense,amount:59,debtId:undefined,category:"otros"}]}));
  assert.ok(r,"el motor la enlaza por nombre");const x=r.state.expenses[0];
  assert.equal(x.debtId,debt.id);assert.notEqual(x.debtManual,true);
  assert.equal(pending(r.state).length,1);
});
test("motor por comercio aprendido con 59 EUR: enlaza pero no paga",()=>{
  const fila={...expense,amount:59,debtId:undefined,category:"otros",merchant:"FINANC XYZ",obName:"FINANC XYZ"};
  const s0=state({expenses:[fila]}),ak=c.cuotaAliasKey(fila);
  const r=c.marcarCuotasDeDeuda({...s0,cuotaAlias:{[ak]:debt.id}});
  assert.ok(r);assert.equal(r.state.expenses[0].debtId,debt.id);assert.notEqual(r.state.expenses[0].debtManual,true);
  assert.equal(pending(r.state).length,1);
});
test("«Es la cuota de…» a mano con 59 EUR: marca debtManual y paga",()=>{
  const r=c.marcarCuotaAMano(state({expenses:[{...expense,amount:59,debtId:undefined,category:"otros",merchant:"FINANC XYZ",obName:"FINANC XYZ"}]}),expense.id,debt.id);
  assert.equal(r.e.debtManual,true);assert.equal(pending(r.state).length,0);
});
test("la marca a mano viaja a la nube y vuelve; un lector sin ella lee la misma cuota",()=>{
  const e={...expense,amount:59,debtManual:true},src=c.expenseSourceForCloud(e);
  assert.equal(src.split("#")[0],"ob:sabadell~deuda.loan-a~mano");
  const back=c.expenseFromRow({id:e.id,fecha:e.date,importe:59,comercio:e.merchant,cat:"deudas",source:src});
  assert.equal(back.debtId,debt.id);assert.equal(back.debtManual,true);assert.equal(back.ent,"sabadell");
  const auto=c.expenseFromRow({id:e.id,fecha:e.date,importe:59,comercio:e.merchant,cat:"deudas",source:c.expenseSourceForCloud({...e,debtManual:undefined})});
  assert.equal(auto.debtId,debt.id);assert.equal(auto.debtManual,undefined);
  // Lo que hace un cliente sin la marca: `partirEntDeuda` viejo solo conoce deuda/recibo/meta.
  const viejo=String(src.slice(3).split("#")[0]).split("~").slice(1).filter(p=>p.indexOf("deuda.")===0).map(p=>p.slice(6));
  assert.deepEqual(viejo,[debt.id]);
});
test("sin vínculo, un cargo de 59 EUR del mismo banco y día no paga la cuota",()=>assert.equal(pending(state({expenses:[{...expense,amount:59,debtId:undefined,category:"otros"}]})).length,1));
test("decimal cuota+balloon acredita solo sus céntimos normalizados",()=>{
  const d={...debt,monthly:0.1,balloon:0.2,months:1};
  const p=c.planChargesMonth(state({debts:[d],expenses:[{...expense,amount:0.3}]}),m,y,2);
  assert.equal(p.pendingBillsTotal,0);assert.equal(Math.round(p.paidBillsTotal*100),30);
  assert.equal(p.paidBills.length,2,"cuota y balloon se desglosan sin repetir el cargo total");
});
for(const patch of [{amount:null},{amount:"desconocido"},{amount:Infinity},{cur:"USD"},{currency:"USD"}]) test("importe desconocido o moneda sin normalizar no acredita "+JSON.stringify(patch),()=>assert.equal(pending(state({expenses:[{...expense,...patch}]})).length,1));
test("vínculo explícito con otro banco conserva el banco real",()=>{
  const p=c.planChargesMonth(state({expenses:[{...expense,ent:"trade_republic"}]}),m,y,2);
  assert.equal(p.pendingBillsTotal,0);assert.equal(p.paidBills[0].paidBank,"trade_republic");
});
for(const source of ["manual","manual:sabadell","macrodroid",undefined]){
  test("sin BOOK, un cargo "+String(source)+" no acredita saldo bancario",()=>{
    const s=state({expenses:[{...expense,source}]});
    assert.equal(pending(s).length,1);assert.equal(c.bankPendingEvents(s,"sabadell",y,m,2).length,1);
    assert.equal(c.minWalk(800,c.bankPendingEvents(s,"sabadell",y,m,2)).end,740);
    assert.equal(c.monthNetForAccount(s,"sabadell",y,m,2),0);
  });
  test("BOOK único acredita un cargo "+String(source)+" sin otro débito",()=>{
    const s=state({expenses:[{...expense,source}],bankTx:[{...expense,status:"BOOK"}]});
    assert.equal(pending(s).length,0);assert.equal(c.bankPendingEvents(s,"sabadell",y,m,2).length,0);
    assert.equal(c.minWalk(800,c.bankPendingEvents(s,"sabadell",y,m,2)).end,800);
  });
}
console.log("debt-payment-state: "+total+" PASS");
