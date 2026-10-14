import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPureLogicFromFile, loadPureLogic } from "../scripts/load-pure-logic.mjs";
import { estadoHeredado } from "../e2e/fixtures.mjs";

const today="2026-10-14",plain=x=>JSON.parse(JSON.stringify(x));
const at=(s,day)=>s.find(p=>p.day===day).value;
function comprobar(c){
  const base=estadoHeredado(today);
  base.accounts=base.accounts.filter(a=>a.ent!=="efectivo");
  delete base.accountBalanceHistory["acc:cash"];
  const opts={today,liquid:5200.23,invested:5200.17,debtTotal:187926.81};
  const sin=c.netWorthSeries(base,opts);
  for(const category of ["otros","traspaso","super"]){
    const state={...base,expenses:base.expenses.concat({id:"atm",date:"2026-10-01T12:00:00Z",amount:100.03,merchant:"RETIRADA CAJERO",category,ent:"sabadell"})};
    const copy=JSON.stringify(state),salida=c.netWorthSeries(state,opts);
    assert.equal(Math.round((at(salida,"2026-09-30")-at(sin,"2026-09-30"))*100),10003,"sin efectivo: el cierre anterior recupera la salida al céntimo");
    assert.equal(at(salida,today),at(sin,today),"hoy no cambia");
    assert.equal(JSON.stringify(state),copy,"la serie no modifica cuentas, gastos ni deuda");
    const caja={...state,accounts:state.accounts.concat({id:"cash",ent:"efectivo",value:100.03,role:"fijos"})};
    const antes={...caja,expenses:base.expenses};
    assert.deepEqual(plain(c.netWorthSeries(caja,{...opts,liquid:5300.26})),plain(c.netWorthSeries(antes,{...opts,liquid:5300.26})),"con bolsillo de efectivo: traslado neutro");
    const cloud={...state,obAccounts:state.obAccounts.concat({id:"cash-cloud",ent:"efectivo",value:100.03,cur:"EUR"})};
    assert.deepEqual(plain(c.netWorthSeries(cloud,{...opts,liquid:5300.26})),plain(c.netWorthSeries({...cloud,expenses:base.expenses},{...opts,liquid:5300.26})),"cuenta de efectivo reconocida por la misma regla de la app");
  }
  const pocket={accounts:[{id:"bank",ent:"sabadell",value:400,bankIban:"synthetic-bank"},{id:"cash",ent:"efectivo",value:100,role:"fijos"}],accountBalanceHistory:{"acc:cash":[{day:"2026-09-01",value:0},{day:"2026-09-02",value:100}]},expenses:[{id:"cover",date:"2026-09-01T12:00:00Z",amount:0,ent:"sabadell"},{id:"atm",date:"2026-09-02T12:00:00Z",amount:100,category:"traspaso",merchant:"RETIRADA CAJERO",ent:"sabadell"},{id:"cash-in",date:"2026-09-02T12:00:00Z",amount:-100,category:"traspaso",ent:"efectivo"}]};
  assert.deepEqual(plain(c.netWorthSeries(pocket,{today:"2026-09-04",liquid:500,invested:0,debtTotal:0})).map(p=>p.value),[500,500,500,500],"cajero a cierre manual de efectivo: compensado una vez, sin duplicar la llegada");
  const bankIncome={...base,expenses:base.expenses.concat({id:"atm-out",date:"2026-10-01T12:00:00Z",amount:100.03,category:"traspaso",merchant:"RETIRADA CAJERO",ent:"sabadell"},{id:"bank-in",date:"2026-10-04T12:00:00Z",amount:-100.03,category:"otros",ent:"caixabank"})};
  const independent=c.netWorthSeries(bankIncome,opts);
  assert.equal(Math.round(((at(independent,"2026-10-01")-at(independent,"2026-09-30"))-(at(sin,"2026-10-01")-at(sin,"2026-09-30")))*100),-10003,"sin efectivo, un ingreso en otro banco no neutraliza el cajero");
}
function traspasos(c){
  const base=estadoHeredado(today),opts={today,liquid:5320.23,invested:5200.17,debtTotal:187926.81};
  const out={id:"transfer-out",date:"2026-10-01T12:00:00Z",amount:300.07,category:"traspaso",merchant:"Pago sintético",ent:"sabadell",source:"manual"};
  const income={id:"transfer-in",date:"2026-10-04T20:00:00Z",amount:-300.07,category:"otros",merchant:"Entrada sintética",ent:"caixabank"};
  const baseline=c.netWorthSeries(base,opts);
  const series=extra=>c.netWorthSeries({...base,expenses:base.expenses.concat(out,...extra)},opts);
  for(const source of ["manual","ob","macrodroid",undefined]){
    const result=c.netWorthSeries({...base,expenses:base.expenses.concat({...out,source})},opts);
    assert.equal(Math.round((at(result,"2026-09-30")-at(baseline,"2026-09-30"))*100),30007,"la categoría sola no prueba neutralidad, sea del banco o del usuario");
    assert.equal(at(result,today),at(baseline,today));
  }
  for(const date of ["2026-09-28T00:30:00+02:00","2026-10-04T23:59:00+02:00"]){
    assert.deepEqual(plain(series([{...income,date}])),plain(baseline),"contrapartida única propia: ±3 días civiles, no 72 horas");
  }
  const drop=result=>Math.round(((at(result,"2026-10-01")-at(result,"2026-09-30"))-(at(baseline,"2026-10-01")-at(baseline,"2026-09-30")))*100);
  for(const extra of [[],[{...income,date:"2026-10-05T00:01:00+02:00"}],[{...income,amount:-300.06}],[{...income,ent:"bbva"}],[{...income,status:"PDNG"}],[{...income,possibleDup:true}],[{...income,category:"ingreso"}],[income,{...income,id:"ambiguous"}]]){
    assert.equal(drop(series(extra)),-30007,"fuera de plazo, otra cifra, cuenta ausente, pendiente, duplicado, ingreso conocido o ambigüedad no prueban un traspaso propio");
  }
  const linked=[{...out,source:"ob",transferId:"bank-pair"},{...income,transferId:"bank-pair"}];
  assert.deepEqual(plain(c.netWorthSeries({...base,expenses:base.expenses.concat(linked)},opts)),plain(baseline),"el par identificado del banco sigue neutro");
  const dst={accounts:[{id:"a",ent:"sabadell",value:400,bankIban:"synthetic-a"},{id:"b",ent:"revolut",value:400,bankIban:"synthetic-b"}],expenses:[{id:"cover",date:"2026-10-20T12:00:00Z",amount:0,ent:"sabadell"},{...out,date:"2026-10-25T00:01:00+02:00"},{...income,ent:"revolut",date:"2026-10-28T23:59:00+01:00"}]};
  assert.ok(c.netWorthSeries(dst,{today:"2026-10-30",liquid:800,invested:0,debtTotal:0}).every(p=>p.value===800),"tres fechas de Madrid al atrasar el reloj: casi 97 horas siguen dentro");
  // Rebase 131: las patas se casan con el importe entero y pesan su parte después.
  // La diferencia entre personal y conjunta aparece una sola vez, el día de salida.
  const mine={key:"own-personal",ent:"revolut",value:400,cur:"EUR"},joint={key:"own-joint",ent:"revolut",value:400,cur:"EUR"};
  const sharedBase=c.setAccountShare({accounts:[],obAccounts:[mine,joint],expenses:[{id:"share-cover",date:"2026-10-01T12:00:00Z",amount:0,ent:"revolut",obAcc:mine.key}],investments:[],assets:[],debts:[],settings:{}},joint,"ob",50);
  const sharedOut={id:"share-out",date:"2026-10-02T12:00:00Z",amount:300.08,category:"traspaso",ent:"revolut",obAcc:mine.key};
  const sharedPair=c.netWorthSeries({...sharedBase,expenses:sharedBase.expenses.concat(sharedOut,{id:"share-in",date:"2026-10-05T12:00:00Z",amount:-300.08,category:"traspaso",ent:"revolut",obAcc:joint.key})},{today});
  assert.deepEqual(["2026-10-01","2026-10-02","2026-10-04","2026-10-05",today].map(day=>at(sharedPair,day)),[750.04,600,600,600,600],"parte mía distinta: sin bache de tránsito ni neutralidad ficticia");
  const single=c.netWorthSeries({...sharedBase,expenses:sharedBase.expenses.concat({...sharedOut,obAcc:joint.key})},{today});
  assert.deepEqual([at(single,"2026-10-01"),at(single,today)],[750.04,600],"sin contraparte la salida pesa solo su parte, al céntimo");
}
comprobar(loadPureLogicFromFile());
traspasos(loadPureLogicFromFile());
const html=fs.readFileSync(new URL("../public/index.html",import.meta.url),"utf8");
const mutant=html.replace('if(!hasCash) daily[day]=(daily[day]||0)-row.cents;', 'if(false) daily[day]=(daily[day]||0)-row.cents;');
assert.notEqual(mutant,html,"la mutación retira la regla de cajero");
assert.throws(()=>comprobar(loadPureLogic(mutant)),assert.AssertionError,"sin regla, el caso se vuelve optimista y falla");
const oldTransfer=html.replace('if(transit||e.category==="inversion"||(e.category==="traspaso"&&linked)) contribs.push', 'if(!transit&&!row.ownTransfer&&e.category==="traspaso"&&!linked) return;\n    if(transit||e.category==="inversion"||(e.category==="traspaso"&&linked)) contribs.push');
assert.notEqual(oldTransfer,html);
assert.throws(()=>traspasos(loadPureLogic(oldTransfer)),assert.AssertionError,"volver a neutralizar una sola pata elimina la salida y falla");
// La misma cartera con la regla anterior y la candidata: Inicio y Gastos siguen leyendo
// sus lectores reales, con el reloj congelado, incluso cuando se dibuja toda la serie.
function snapshot(m,state){
  const Native=m.Date,epoch=Date.parse(today+"T12:00:00Z");
  m.Date=class extends Date{constructor(...a){super(...(a.length?a:[epoch]));}static now(){return epoch;}};
  try{
    const ins=m.insumosSaldoGasto(state);
    const liquid=(state.accounts||[]).reduce((n,a)=>n+m.saldoCuentaMostrada(a,ins),0)+(state.obAccounts||[]).reduce((n,a)=>n+m.toEurAmt(a.value,a.cur||"EUR",state),0);
    const invested=(state.investments||[]).reduce((n,i)=>n+(m.invValueEur(i,state)||0),0);
    const debtTotal=(state.debts||[]).reduce((n,d)=>n+m.debtBalance(d),0);
    const before={inicio:plain(m.dashboardBudgetStats(state)),gastos:plain(m.monthBudgetStats(state))};
    const series=m.netWorthSeries(state,{today,liquid,invested,debtTotal,balanceInputs:{...ins,roundupThisMonth:ins.roundup,monthlyInvestThisMonth:ins.monthlyInvest}});
    assert.deepEqual({inicio:plain(m.dashboardBudgetStats(state)),gastos:plain(m.monthBudgetStats(state))},before,"dibujar no cambia ni la tarjeta ni Gastos");
    return {...before,netNowCents:Math.round(series.at(-1).value*100)};
  }finally{m.Date=Native;}
}
const current=loadPureLogic(html),prior=loadPureLogic(oldTransfer.replace('if(!hasCash) daily[day]=(daily[day]||0)-row.cents;', 'if(false) daily[day]=(daily[day]||0)-row.cents;'));
for(const mode of ["sin-efectivo","con-efectivo","traspaso-cajero","transfer-alone","transfer-pair"]){
  const state=estadoHeredado(today);
  if(mode!=="con-efectivo") {state.accounts=state.accounts.filter(a=>a.ent!=="efectivo");delete state.accountBalanceHistory["acc:cash"];}
  const transfer=mode.startsWith("transfer-");
  state.expenses.push({id:"own-out",date:"2026-10-01T12:00:00Z",amount:transfer?300.07:100.03,merchant:transfer?"Pago sintético":"RETIRADA CAJERO",category:transfer||mode==="traspaso-cajero"?"traspaso":"otros",ent:"sabadell",source:"manual"});
  if(mode==="transfer-pair")state.expenses.push({id:"own-in",date:"2026-10-04T23:59:00+02:00",amount:-300.07,merchant:"Entrada sintética",category:"otros",ent:"caixabank"});
  const old=snapshot(prior,state),candidate=snapshot(current,state);
  assert.deepEqual(candidate,old,"estados antes/después iguales al céntimo: "+mode);
  console.log(mode+": "+JSON.stringify(candidate));
}
console.log("inicio-grafica-reservas: traspaso ±3 días civiles y pruebas de contraparte; cajero con/sin efectivo; cifras de hoy intactas y dos mutaciones causales OK");
