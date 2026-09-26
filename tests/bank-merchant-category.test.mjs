import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { transformSync } from "esbuild";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

// Ambos extremos reales del contrato, con datos ficticios: conservar un MCC en el servidor
// no sirve si al aplanar o importar se pierde, ni si cambia la identidad del histórico.
const source=fs.readFileSync(new URL("../supabase/functions/_shared/enablebanking.ts",import.meta.url),"utf8");
const E=await import("data:text/javascript;base64,"+Buffer.from(transformSync(source,{loader:"ts",format:"esm"}).code).toString("base64"));
const ctx=loadPureLogicFromFile();
const today=new Date().toISOString().slice(0,10);
const state=()=>({accounts:[{id:"tr",ent:"trade_republic",role:"diario",spendFrom:true,value:1000}],expenses:[],fixed:[],flows:[],settings:{brokersOn:["trade_republic"]}});
const raw=(extra={})=>({booking_date:today,transaction_amount:{amount:"12.50"},credit_debit_indicator:"DBIT",creditor:{name:"Movimiento"},bank_transaction_code:{description:"Card payment"},...extra});
const links=t=>[{aspsp:"Trade Republic",accounts:[{uid:"synthetic",transactions:[t]}]}];
let count=0;
function test(name,fn){fn();count++;console.log("  ✓ "+name);}

test("el concepto no cambia la identidad genérica, pero llega como pista",()=>{
  const mapped=E.mapTransaction(raw({remittance_information:["  Mercadona "," Madrid  "]}));
  assert.equal(mapped.merchant,"Movimiento");assert.equal(mapped.ext_id,null);
  assert.match(mapped.note,/Mercadona Madrid/);
  const add=ctx.importObExpenses(state(),ctx.flattenBankTx(links(mapped)));
  assert.equal(add[0].category,"super");assert.equal(add[0].obName,"Movimiento");
  assert.equal(add[0].merchant,"Movimiento");assert.match(add[0].note,/Mercadona/);
});
test("MCC válido clasifica Movimiento sin inventar nombre",()=>{
  for(const [mcc,cat] of [["5411","super"],["5462","pan"],["5812","bares"],["5813","bares"],["5814","bares"]]){
    const mapped=E.mapTransaction(raw({merchant_category_code:mcc}));
    assert.equal(mapped.mcc,mcc);
    const flat=ctx.flattenBankTx(links(mapped));assert.equal(flat[0].mcc,mcc);
    const add=ctx.importObExpenses(state(),flat);
    assert.equal(add[0].category,cat);assert.equal(add[0].merchant,"Movimiento");
    assert.equal(add[0].amount,12.5);
  }
});
test("sin MCC conocido ni concepto útil conserva Otros",()=>{
  for(const mcc of [undefined,"","bad","5411x","0000","9999",null]){
    const mapped=E.mapTransaction(raw({merchant_category_code:mcc}));
    assert.equal(ctx.importObExpenses(state(),ctx.flattenBankTx(links(mapped)))[0].category,"otros");
  }
});
test("un comercio reconocido gana frente a un MCC distinto",()=>{
  const mapped=E.mapTransaction(raw({creditor:{name:"Mercadona"},merchant_category_code:"5812",remittance_information:["Panadería"]}));
  assert.equal(ctx.importObExpenses(state(),ctx.flattenBankTx(links(mapped)))[0].category,"super");
});
test("la decisión personal Otros también gana",()=>{
  vm.runInNewContext('USER_OVERRIDES={movimiento:"otros"}',ctx);
  try {assert.equal(ctx.categoryOfBankTx({merchant:"Movimiento",mcc:"5411",concept:"Mercadona",card:true}),"otros");}
  finally {vm.runInNewContext('USER_OVERRIDES={}',ctx);}
});
test("cajero, aportes e ingresos conservan su tratamiento",()=>{
  assert.equal(ctx.categoryOfBankTx({merchant:"Cash withdrawal",mcc:"5411"}),"traspaso");
  const s=state();s.accounts[0].monthlyInvest=12.5;
  const mapped=E.mapTransaction(raw({merchant_category_code:"5411"}));
  assert.equal(ctx.importObExpenses(s,ctx.flattenBankTx(links(mapped)))[0].category,"inversion");
  const income=E.mapTransaction(raw({credit_debit_indicator:"CRDT",merchant_category_code:"5411"}));
  const add=ctx.importObExpenses(state(),ctx.flattenBankTx(links(income)));
  assert.equal(add[0].category,"ingreso");assert.equal(add[0].amount,-12.5);
});
test("resincronizar no duplica ni recategoriza un Movimiento guardado",()=>{
  const s=state();s.expenses=[{id:"old",date:today+"T12:00:00.000Z",amount:12.5,merchant:"Mi nombre",obName:"Movimiento",category:"compras",source:"ob",ent:"trade_republic"}];
  const before=JSON.stringify(s);
  const mapped=E.mapTransaction(raw({remittance_information:["Mercadona"],merchant_category_code:"5411"}));
  assert.equal(ctx.importObExpenses(s,ctx.flattenBankTx(links(mapped))),null);
  assert.equal(JSON.stringify(s),before);
});
test("las lápidas con nombre genérico siguen evitando reentradas",()=>{
  const s=state();s.deleted=["trade_republic|"+today+"|12.5|Movimiento"];
  const mapped=E.mapTransaction(raw({remittance_information:["Mercadona"],merchant_category_code:"5411"}));
  assert.equal(ctx.importObExpenses(s,ctx.flattenBankTx(links(mapped))),null);
});
test("histórico transmite las pistas y clasifica solo candidatos nuevos",()=>{
  const mapped=E.mapTransaction(raw({merchant_category_code:"5462"}));
  const flat=ctx.histFlattenHistoryLinks({links:links(mapped)},[],{},{});
  assert.equal(flat.out[0].mcc,"5462");
  const r=ctx.histClassifyCandidates(flat.out,state());
  assert.equal(r.rows[0].category,"pan");
  const mappedHint=E.mapTransaction(raw({remittance_information:["Mercadona"]}));
  const hinted=ctx.histFlattenHistoryLinks({links:links(mappedHint)},[],{},{});
  assert.match(hinted.out[0].note,/Mercadona/);
  assert.equal(ctx.histClassifyCandidates(hinted.out,state()).rows[0].category,"super");
});
test("conceptos de transferencias/recibos y notas sin tarjeta no adivinan compras",()=>{
  for(const note of ["Transferencia pago alquiler día 5","Pago Bizum comida","Recibo día 5","Devolución Amazon","Refund Amazon"]){
    assert.equal(ctx.categoryOfBankTx({merchant:"Movimiento",concept:note,card:true}),"otros",note);
  }
  assert.equal(ctx.categoryOfBankTx({merchant:"Movimiento",concept:"Mercadona",card:false}),"otros");
});
test("descripción bancaria Card transaction no se confunde con tienda Action",()=>{
  const mapped=E.mapTransaction(raw({bank_transaction_code:{description:"Card transaction"}}));
  assert.equal(mapped.concept,"");assert.equal(mapped.card,true);
  assert.equal(ctx.importObExpenses(state(),ctx.flattenBankTx(links(mapped)))[0].category,"otros");
  const named=E.mapTransaction(raw({bank_transaction_code:{description:"Card transaction"},remittance_information:["Mercadona"]}));
  assert.equal(named.concept,"Mercadona");
  assert.equal(ctx.importObExpenses(state(),ctx.flattenBankTx(links(named)))[0].category,"super");
  const flat=ctx.histFlattenHistoryLinks({links:links(mapped)},[],{},{});
  assert.equal(ctx.histClassifyCandidates(flat.out,state()).rows[0].category,"otros");
  const old=ctx.flattenBankTx(links({date:today,amount:12.5,merchant:"Movimiento",note:"Mercadona · Card transaction",card:true}));
  assert.equal(ctx.importObExpenses(state(),old)[0].category,"otros","backend antiguo sin concepto no adivina por nota mezclada");
});
console.log("bank-merchant-category: "+count+" casos PASS");
