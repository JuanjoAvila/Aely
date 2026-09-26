#!/usr/bin/env node
import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

import fs from "node:fs";
import { transformSync } from "esbuild";
const ctx = loadPureLogicFromFile();
const wallet = await import("data:text/javascript;base64,"+Buffer.from(transformSync(fs.readFileSync("supabase/functions/_shared/wallet.ts","utf8"),{loader:"ts",format:"esm"}).code).toString("base64"));

function t(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
}

console.log("fx-multi");

t("toEurAmt: EUR sin conversión", () => {
  assert.equal(ctx.toEurAmt(100, "EUR", {}), 100);
});

t("toEurAmt: USD con fx legacy", () => {
  assert.equal(ctx.toEurAmt(100, "USD", { fx: 0.92 }), 92);
});

t("toEurAmt: USD con fxRates", () => {
  assert.equal(ctx.toEurAmt(100, "USD", { fxRates: { USD: 0.85 } }), 85);
});

t("toEurAmt: GBP con fxRates", () => {
  assert.ok(Math.abs(ctx.toEurAmt(50, "GBP", { fxRates: { GBP: 1.15 } }) - 57.5) < 0.001);
});

t("toEurAmt: divisa desconocida no inventa tipo", () => {
  assert.equal(ctx.toEurAmt(100, "JPY", {}), null);
});

t("fromEurAmt: USD con fx legacy", () => {
  assert.equal(ctx.fromEurAmt(92, "USD", { fx: 0.92 }), 100);
});

t("fromEurAmt: GBP con fxRates", () => {
  assert.ok(Math.abs(ctx.fromEurAmt(115, "GBP", { fxRates: { GBP: 1.15 } }) - 100) < 0.001);
});

t("invCostEur: prioriza costEur anclado", () => {
  assert.equal(ctx.invCostEur({ costEur: 50, cost: 100, cur: "USD" }, { fx: 0.92 }), 50);
});

t("invCostEur: convierte cost nativo si no hay costEur", () => {
  assert.equal(ctx.invCostEur({ cost: 100, cur: "USD" }, { fx: 0.92 }), 92);
});

t("toEurAmt: TRY con fxRates", () => {
  // 1 TRY = 0.018 EUR → 100 TRY = 1.8 EUR
  assert.ok(Math.abs(ctx.toEurAmt(100, "TRY", { fxRates: { TRY: 0.018 } }) - 1.8) < 0.001);
});

t("fromEurAmt: TRY con fxRates", () => {
  assert.ok(Math.abs(ctx.fromEurAmt(1.8, "TRY", { fxRates: { TRY: 0.018 } }) - 100) < 0.001);
});

t("conversor cruzado: TRY → USD vía EUR (sin inventar)", () => {
  const s = { fxRates: { TRY: 0.025, USD: 0.92 } }; // 1 TRY=0.025€, 1 USD=0.92€
  const eur = ctx.toEurAmt(100, "TRY", s);           // 2.5 €
  const usd = ctx.fromEurAmt(eur, "USD", s);         // 2.5/0.92
  assert.ok(Math.abs(usd - (2.5 / 0.92)) < 0.001);
});

console.log("\nfx-multi: OK");

for(const state of [{}, {fx:0.92,fxRates:{}}, {fx:0.9,fxRates:{USD:0.85,TRY:0.018261,GBP:1.15}}, {fx:0.92,fxRates:{USD:Infinity,TRY:0,JPY:-1}}]){
  for(const cur of ["EUR","USD","TRY","XYZ"," usd ","JPY"]){
    for(const amount of [0,100,1520,76.085,-76.085,null,NaN,Infinity]){
      assert.equal(ctx.toEurAmt(amount,cur,state),wallet.aEuros(amount,cur,state),JSON.stringify({amount,cur,state}));
    }
  }
}
t("no se fabrica USD y la inversa propaga lo desconocido",()=>{
  assert.equal(ctx.toEurAmt(100,"USD",{}),null);
  assert.equal(ctx.fromEurAmt(100,"XYZ",{}),null);
  assert.equal(ctx.fromEurAmt(null,"EUR",{}),null);
  assert.equal(ctx.buildEmpty().fx,null);
});
t("catálogo BCE idéntico en cliente y Wallet, 30 divisas",()=>{
  const source=fs.readFileSync("src/modules/00-core.js","utf8");
  const currencies=JSON.parse(source.match(/const CUR_LIST = (\[[^;]+\]);/)[1]);
  assert.deepEqual(currencies.sort(),wallet.DIVISAS.slice().sort());
  assert.equal(currencies.length,30);
  for(const cur of currencies){
    assert.equal(ctx.toEurAmt(123.45,cur,{fxRates:{[cur]:0.123456}}),wallet.aEuros(123.45,cur,{fxRates:{[cur]:0.123456}}));
  }
});
t("desconocidos no alteran suma ni se promocionan a un saldo en euros",()=>{
  const state={accounts:[],obAccounts:[{key:"fx",ent:"revolut",value:500,cur:"XYZ"}],investments:[{value:100,cost:80,cur:"EUR"},{value:500,cost:400,cur:"XYZ"}]};
  assert.equal(ctx.fxMissingOf(state),2);
  assert.equal(state.investments.reduce((n,i)=>n+(ctx.invValueEur(i,state)||0),0),100);
  assert.equal(ctx.invCostEur(state.investments[1],state),null);
  assert.equal(ctx.promoteObAccount(state,{},"fx","diario","new"),state);
  assert.equal(ctx.toEurAmt(1520,"TRY",{fxRates:{TRY:0.018261}}),27.76);
});
console.log("paridad FIN-06: OK (EUR, USD respaldo, TRY, desconocida y entradas inválidas)");
