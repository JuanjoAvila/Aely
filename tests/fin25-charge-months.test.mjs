import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {test} from "node:test";
import {loadPureLogic} from "../scripts/load-pure-logic.mjs";
const read=f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8");
const js=JSON.parse(read("src/build-order.json")).map(f=>read("src/modules/"+f)).join("\n");
const c=loadPureLogic(read("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>js));
const months=e=>Array.from(c.chargeMonths(e));
const cents=x=>Math.round(x*100);
const calendar=e=>Array.from({length:12},(_,i)=>months(e).includes(i+1)?cents(c.occAmountIn(e,i+1)):0);

test("FIN25 anual 600 EUR con months [5,5] cobra 600 una sola vez en mayo",()=>{
  const e={amount:600,freq:"anual",months:[5,5]};
  assert.deepEqual(calendar(e),[0,0,0,0,60000,0,0,0,0,0,0,0]);
  assert.deepEqual(months(e),[5]);
});

test("solo meses numericos enteros 1-12 cuentan en el divisor anual",()=>{
  const e={amount:600,freq:"año",months:[12,0,5,5,13,-1,1.5,"5",null,undefined,NaN,Infinity,true,1]};
  assert.deepEqual(months(e),[1,5,12]);
  assert.deepEqual(calendar(e),[20000,0,0,0,20000,0,0,0,0,0,0,20000]);
});

test("schedule manda sobre months y frecuencia sin cambiar sus importes ni dias",()=>{
  const e={amount:999,freq:"anual",months:[2,4],schedule:[{m:9,amt:166.94,day:20},{m:3,amt:172.05,day:10},{m:3,amt:172.05,day:10},{m:0,amt:9},{m:13,amt:9},{m:2.5,amt:9},{m:"6",amt:9}]};
  assert.deepEqual(months(e),[3,9]);
  assert.deepEqual(calendar(e),[0,0,17205,0,0,0,0,0,16694,0,0,0]);
  assert.equal(c.dayIn(e,3),10);
  assert.equal(c.dayIn(e,9),20);
});

test("months manda sobre frecuencia; las listas invalidas no inventan un fallback",()=>{
  assert.deepEqual(months({freq:"mes",months:[12,1,12]}),[1,12]);
  assert.deepEqual(months({freq:"mes",months:[0,13,"1",1.5]}),[]);
  assert.deepEqual(months({freq:"mes",months:[5],schedule:[{m:13}]}),[]);
});

test("arrays vacios conservan la prioridad y los calendarios de frecuencia",()=>{
  assert.deepEqual(months({freq:"mes",months:[5],schedule:[]}),[5]);
  const expected={mes:[1,2,3,4,5,6,7,8,9,10,11,12],mensual:[1,2,3,4,5,6,7,8,9,10,11,12],bimestral:[1,3,5,7,9,11],trimestral:[1,4,7,10],semestral:[1,7],anual:[],"año":[],semana:[]};
  for(const [freq,value] of Object.entries(expected)) assert.deepEqual(months({freq,months:[],schedule:[]}),value,freq);
  assert.deepEqual(months(null),[]);
  assert.deepEqual(months({}),[]);
});

test("la lectura ordena una copia y no muta los arrays ni objetos guardados",()=>{
  const schedule=Object.freeze([Object.freeze({m:12,amt:10}),Object.freeze({m:1,amt:20}),Object.freeze({m:12,amt:10})]);
  const list=Object.freeze([12,1,12,0]);
  const e=Object.freeze({freq:"anual",months:list,schedule});
  const before=JSON.stringify(e),out=c.chargeMonths(e);
  assert.deepEqual(Array.from(out),[1,12]);
  out.push(5);
  assert.deepEqual(months(e),[1,12]);
  assert.deepEqual(months({months:list}),[1,12]);
  assert.equal(JSON.stringify(e),before);
});

test("FIN25 R2 la cifra mensual cuenta una vez cada mes entero valido de schedule",()=>{
  const schedule=Object.freeze([
    Object.freeze({m:9,amt:166.94,day:20}),Object.freeze({m:3,amt:172.05,day:10}),
    Object.freeze({m:3,amt:999,day:25}),Object.freeze({m:0,amt:90}),
    Object.freeze({m:13,amt:90}),Object.freeze({m:2.5,amt:90}),
    Object.freeze({m:"6",amt:90}),Object.freeze({m:null,amt:90}),
  ]);
  const e=Object.freeze({amount:999,freq:"anual",months:Object.freeze([5,5]),schedule});
  const before=JSON.stringify(e);
  assert.equal(c.fixedMonthlyOf(e),(166.94+172.05)/12);
  assert.deepEqual(calendar(e),[0,0,17205,0,0,0,0,0,16694,0,0,0]);
  assert.equal(JSON.stringify(e),before,"no normaliza ni escribe el calendario guardado");
});

test("FIN25 R2 los calendarios validos conservan exactamente su cifra mensual",()=>{
  for(const schedule of [
    [{m:9,amt:166.94,day:20},{m:3,amt:172.05,day:10}],
    [{m:12,amt:0.1},{m:2,amt:0.2},{m:7,amt:0.3}],
    [{m:1,amt:0},{m:12,amt:51.37}],
  ]){
    const e={amount:999,freq:"anual",schedule};
    assert.equal(c.fixedMonthlyOf(e),schedule.reduce((a,x)=>a+(Number(x.amt)||0),0)/12);
  }
  assert.equal(c.fixedMonthlyOf({schedule:[{m:0,amt:99},{m:13,amt:99},{m:1.5,amt:99},{m:"5",amt:99}]}),0);
});

function oldPayment(ctx,{amount=600,version=2,months=[5,5],modelAmount=300,annualAmount=600,bankAmount}={}){
  const fixed={id:"r1",name:"Seguro sintetico",amount:annualAmount,freq:"anual",months,day:20,account:"sabadell",...(bankAmount===undefined?{}:{bankAmount})};
  const expense={id:"r1-charge",date:"2026-05-05T12:00:00.000Z",merchant:"COMERCIO SINTETICO",amount,ent:"revolut",source:"wallet",category:"otros"};
  const state={fixed:[fixed],accounts:[{id:"sb",ent:"sabadell",role:"fijos",value:3000}],expenses:[expense],bankTx:[],debts:[],oneoffs:[],flows:[]};
  const linked=ctx.linkFixedPayment(state,expense.id,fixed.id,2026,5,10);
  assert.ok(linked.fixed[0].paymentProofs,"el fixture parte de un cargo confirmado explicitamente");
  const proof={...linked.fixed[0].paymentProofs[2026*12+5],model:JSON.stringify([version===2?fixed.id:fixed.name,"sabadell",modelAmount,bankAmount>0?bankAmount:null])};
  if(version!==2){delete proof.modelVersion;delete proof.receiptId;delete proof.receiptName;}
  return {...linked,fixed:[{...linked.fixed[0],paymentProofs:{[2026*12+5]:proof}}]};
}
const proofOf=s=>s.fixed[0].paymentProofs[2026*12+5];
const paid=(s,ctx=c)=>ctx.fixedPaymentState(s,s.fixed[0],2026,5,10).paid;

test("FIN25 R1 A el cobro completo conserva pagado con la huella del divisor viejo",()=>{
  for(const version of [1,2]){
    const s=oldPayment(c,{version}),before=JSON.stringify(s);
    assert.equal(paid(s),true,"pago real600 y modelo historico300, version"+version);
    const offline=JSON.parse(JSON.stringify({...s,expenses:[],bankTx:[]}));
    assert.equal(paid(offline),true,"recarga sin filas bancarias locales");
    const plan=c.planChargesMonth(s,5,2026,10);
    assert.equal(plan.pendingBills.length,0);
    assert.equal(plan.paidBills.length,1);
    assert.equal(plan.paidBills[0].amount,600);
    assert.equal(plan.paidBills[0].paidAmount,600);
    assert.equal(JSON.stringify(s),before,"leer no migra ni reescribe la prueba");
  }
});

function rejectsWrongOldModels(ctx){
  for(const version of [1,2]){
    for(const modelAmount of [0,200,299.99,300.01]) assert.equal(paid(oldPayment(ctx,{version,modelAmount}),ctx),false,"huella ajena al divisor viejo: "+modelAmount);
    for(const amount of [300,599.99,600.01]) assert.equal(paid(oldPayment(ctx,{version,amount}),ctx),false,"B/parcial o importe distinto: "+amount);
  }
}
test("FIN25 R1 B y cualquier otra huella antigua siguen pendientes",()=>{
  rejectsWrongOldModels(c);
  for(const version of [1,2]){
    const valid=oldPayment(c,{version,amount:300,months:[5,9]});
    assert.equal(paid(valid),true,"recibo valido conserva la misma prueba y el mismo cobro300");
    assert.equal(c.occAmountIn(valid.fixed[0],5),300);
    assert.equal(paid(oldPayment(c,{version,months:[5,9],modelAmount:200})),false);
    const invalidOnly=oldPayment(c,{version,months:[5,0]});
    assert.equal(paid(invalidOnly),false,"sin un mes repetido no se abre compatibilidad");
  }
});

test("FIN25 R1 la excepcion conserva identidad, version, banco y elegibilidad",()=>{
  for(const version of [1,2]){
    const s=oldPayment(c,{version}),p=proofOf(s);
    const patches=[{model:JSON.stringify([version===2?"otro":"Otro seguro","sabadell",300,null])},
      {model:JSON.stringify([version===2?"r1":"Seguro sintetico","revolut",300,null])},
      {model:JSON.stringify([version===2?"r1":"Seguro sintetico","sabadell",300,10])},
      {modelVersion:3},{kind:"desconocido"},{date:"2026-06-05"},{identity:"otra identidad"}];
    if(version===2) patches.push({receiptId:"otro"},{receiptName:null});
    for(const patch of patches){
      const bad={...s,fixed:[{...s.fixed[0],paymentProofs:{[2026*12+5]:{...p,...patch}}}]};
      assert.equal(paid(bad),false,JSON.stringify(patch));
    }
    assert.equal(paid({...s,deleted:[p.expenseKey]}),false,"una lapida sigue invalidando el pago");
    assert.equal(paid({...s,expenses:[{...s.expenses[0],possibleDup:true}]}),false);
    assert.equal(paid({...s,fixed:[s.fixed[0],{...s.fixed[0]}]}),false,"id de recibo duplicado");
  }
});

test("FIN25 R1 BOOK completo conserva su prueba sin aceptar parciales ni ampliar calendarios",()=>{
  const fixed={id:"r1",name:"Seguro sintetico",amount:600,freq:"anual",months:[5,5],day:20,account:"sabadell"};
  const tx={id:"book-r1",ent:"sabadell",date:"2026-05-05",amount:600,merchant:fixed.name,status:"BOOK"};
  const s=c.reconcileFixedPaymentProofs({fixed:[fixed],accounts:[{id:"sb",ent:"sabadell",role:"fijos",value:3000}],bankTx:[tx],expenses:[],debts:[],oneoffs:[],flows:[]},2026,5,10);
  const p={...proofOf(s),model:JSON.stringify(["r1","sabadell",300,null])};
  assert.equal(p.kind,"book");
  const old={...s,bankTx:[],fixed:[{...s.fixed[0],paymentProofs:{[2026*12+5]:p}}]};
  assert.equal(paid(old),true);
  assert.equal(paid({...old,fixed:[{...old.fixed[0],paymentProofs:{[2026*12+5]:{...p,amount:300}}}]}),false);
  for(const patch of [{freq:"mes"},{schedule:[{m:5,amt:600},{m:5,amt:600}]}]){
    const expense=oldPayment(c);
    assert.equal(paid({...expense,fixed:[{...expense.fixed[0],...patch}]}),false);
  }
});

test("FIN25 R1 el mutante que acepta cualquier huella antigua cae",()=>{
  const mutant=loadPureLogic(read("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>js));
  vm.runInNewContext("fixedPaymentModelMatches=function(){return true;}",mutant);
  assert.throws(()=>rejectsWrongOldModels(mutant),assert.AssertionError);
});

function centsPayment(ctx,version=2,amount=33.33){
  return oldPayment(ctx,{version,amount,annualAmount:100,months:[5,5,6,9],modelAmount:25});
}
function sharedPayment(ctx,version=2,amount=900){
  return oldPayment(ctx,{version,amount,bankAmount:900});
}
function keepsConfirmedPayment(ctx,make,version,charge,part){
  const s=make(ctx,version),before=JSON.stringify(s);
  assert.equal(paid(s,ctx),true,"la prueba completa conserva pagado");
  const offline=JSON.parse(JSON.stringify({...s,expenses:[],bankTx:[]}));
  assert.equal(paid(offline,ctx),true,"la misma prueba viaja sin extracto local");
  const plan=ctx.planChargesMonth(s,5,2026,10);
  assert.equal(plan.pendingBills.length,0);
  assert.equal(plan.paidBills.length,1);
  assert.equal(cents(plan.paidBills[0].amount),part);
  assert.equal(cents(plan.paidBills[0].paidAmount),charge);
  assert.equal(cents(plan.paidBills[0].plannedBankAmount),charge);
  assert.equal(JSON.stringify(s),before,"leer no migra ni reescribe la prueba");
}

test("FIN25 R3 centimos conserva 33.33 confirmado para 100 entre [5,5,6,9]",()=>{
  for(const version of [1,2]) keepsConfirmedPayment(c,centsPayment,version,3333,3333);
});

test("FIN25 R3 bankAmount conserva el cargo compartido completo y la parte propia",()=>{
  for(const version of [1,2]) keepsConfirmedPayment(c,sharedPayment,version,90000,60000);
});

function rejectsWrongCentsAndBank(ctx){
  for(const version of [1,2]){
    for(const amount of [25,33.32,33.34]) assert.equal(paid(centsPayment(ctx,version,amount),ctx),false,"centimos distintos: "+amount);
    for(const amount of [300,600,899.99,900.01]) assert.equal(paid(sharedPayment(ctx,version,amount),ctx),false,"banco exige el bruto completo: "+amount);
    for(const make of [centsPayment,sharedPayment]){
      const s=make(ctx,version),p=proofOf(s),model=JSON.parse(p.model);
      for(const [index,value] of [[0,"otro"],[1,"otro banco"],[2,model[2]+0.01],[3,model[3]===null?900:null]]){
        const wrong=model.slice();wrong[index]=value;
        const bad={...s,fixed:[{...s.fixed[0],paymentProofs:{[2026*12+5]:{...p,model:JSON.stringify(wrong)}}}]};
        assert.equal(paid(bad,ctx),false,"sigue exigiendo la huella completa: "+JSON.stringify(wrong));
      }
      const stringAmount={...s,fixed:[{...s.fixed[0],paymentProofs:{[2026*12+5]:{...p,amount:String(p.amount)}}}]};
      assert.equal(paid(stringAmount,ctx),false,"los centimos no amplian el contrato a importes de texto");
      assert.equal(paid({...s,deleted:[p.expenseKey]},ctx),false);
      assert.equal(paid({...s,expenses:[{...s.expenses[0],possibleDup:true}]},ctx),false);
      assert.equal(paid({...s,fixed:[s.fixed[0],{...s.fixed[0]}]},ctx),false);
    }
  }
}

test("FIN25 R3 centimos y banco no admiten parciales ni otras huellas o identidades",()=>{
  rejectsWrongCentsAndBank(c);
});

test("FIN25 R3 mutantes float, importe propio y compatibilidad abierta son rechazados",()=>{
  const original=c.fixedPaymentModelMatches.toString();
  const variants=[
    ["float",original.replace("Math.round(p.amount*100)!==Math.round(amount*100)","p.amount!==amount"),ctx=>keepsConfirmedPayment(ctx,centsPayment,2,3333,3333)],
    ["importe propio",original.replace("amount=e.bankAmount>0?e.bankAmount:occAmountIn(e,m)","amount=occAmountIn(e,m)"),ctx=>keepsConfirmedPayment(ctx,sharedPayment,2,90000,60000)],
    ["huella abierta","function fixedPaymentModelMatches(){return true;}",rejectsWrongCentsAndBank],
  ];
  for(const [name,source,check] of variants){
    assert.notEqual(source,original,"el mutante cambia la logica: "+name);
    const mutant=loadPureLogic(read("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>js));
    vm.runInNewContext("fixedPaymentModelMatches="+source,mutant);
    assert.throws(()=>check(mutant),assert.AssertionError,name);
  }
});
