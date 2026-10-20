/* LA MENSUALIDAD Y LA VISTA PREVIA DEL ALTA CUADRAN CON LO QUE SE COBRA (FIN-20 y FIN-21).
 *
 * FIN-20: un trimestral con 3 meses marcados a mano se cobra 3 veces al año, pero la mensualidad
 * salía de `amount×FREQ_M` (como si fueran 4): 30 € al mes en vez de 22,50. Bimestral con 4 meses,
 * semestral con 1… igual. El calendario (`occursIn`/`occAmountIn`) siempre estuvo bien.
 * FIN-21: la vista previa del alta de un anual con dos meses decía «total = importe × 2», pero el
 * calendario reparte el importe entre los dos meses: el texto prometía el doble de lo que se cobra.
 *
 * Oráculo: lo que de verdad se cobra en 12 meses según el calendario de la app, dividido entre 12.
 * Lo que no tiene meses a mano tiene que salir idéntico bit a bit a `amount×FREQ_M`. */
import assert from "node:assert/strict";
import fs from "node:fs";
import {test} from "node:test";
import {loadPureLogic} from "../scripts/load-pure-logic.mjs";
const read=f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8");
const js=JSON.parse(read("src/build-order.json")).map(f=>read("src/modules/"+f)).join("\n");
const c=loadPureLogic(read("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>js));
const FREQ_M={mes:1,mensual:1,bimestral:1/2,trimestral:1/3,semestral:1/6,"año":1/12,anual:1/12,semana:4.345};
// `occursIn` es const y no sale del sandbox: es «el mes está en chargeMonths», tal cual.
const cobrado=e=>{let a=0;const ms=c.chargeMonths(e);for(let m=1;m<=12;m++) if(ms.indexOf(m)>=0) a+=c.occAmountIn(e,m);return a;};
const cent=x=>Math.round(x*100);

const aMano=[
  {name:"trimestral con 3 meses",e:{amount:90,freq:"trimestral",months:[2,5,8]},mes:22.5},
  {name:"bimestral con 4 meses",e:{amount:60,freq:"bimestral",months:[1,4,7,10]},mes:20},
  {name:"semestral con 1 mes",e:{amount:100,freq:"semestral",months:[6]},mes:100/12},
  {name:"semestral con 3 meses",e:{amount:50,freq:"semestral",months:[1,5,9]},mes:12.5},
  {name:"mensual con 6 meses (datos viejos)",e:{amount:40,freq:"mes",months:[1,2,3,4,5,6]},mes:20},
  {name:"trimestral con un mes repetido",e:{amount:90,freq:"trimestral",months:[2,2,8]},mes:15},
];
for(const k of aMano) test(`FIN-20 ${k.name}: mensualidad = lo cobrado en 12 meses / 12`,()=>{
  assert.equal(cent(c.fixedMonthlyOf(k.e)),cent(cobrado(k.e)/12));
  assert.equal(cent(c.fixedMonthlyOf(k.e)),cent(k.mes));
});

const sinTocar=[
  {amount:49.99,freq:"mes"},{amount:61.7,freq:"bimestral"},{amount:93.33,freq:"trimestral"},
  {amount:172.05,freq:"semestral"},{amount:666.36,freq:"año"},{amount:666.36,freq:"año",months:[10]},
  {amount:600,freq:"anual",months:[3,9]},{amount:120,freq:"año",months:[1,4,7]},{amount:12.5,freq:"semana"},
  // meses a mano, pero tantos como los de por defecto: mismo número de cobros, misma cifra
  {amount:93.33,freq:"trimestral",months:[2,5,8,11]},{amount:61.7,freq:"bimestral",months:[2,4,6,8,10,12]},
  {amount:172.05,freq:"semestral",months:[3,9]},{amount:30,freq:"mes",months:[1,2,3,4,5,6,7,8,9,10,11,12]},
];
for(const e of sinTocar) test(`sin cambio: ${e.freq} ${e.amount}${e.months?" "+e.months.length+" meses":""}`,()=>{
  assert.ok(Object.is(c.fixedMonthlyOf(e),e.amount*FREQ_M[e.freq]));
});

test("con calendario propio (`schedule`) sigue saliendo de sus importes",()=>{
  const e={amount:172.05,freq:"semestral",schedule:[{m:3,amt:172.05},{m:9,amt:166.94}]};
  assert.equal(cent(c.fixedMonthlyOf(e)),cent((172.05+166.94)/12));
});

test("la cabecera de «Tus recibos» suma la misma mensualidad",()=>{
  const s={fixed:aMano.map(k=>k.e),debts:[]};
  assert.equal(cent(c.billsHeroTotal(s,null)),cent(aMano.reduce((a,k)=>a+cobrado(k.e)/12,0)));
});

// `eur`, `tf` y `monthShort` son const y no salen del sandbox: las cifras se escriben a mano (es).
const prev=it=>c.fixedAddPreview(it);
test("FIN-21 anual 600 € en marzo y septiembre: 300 € cada vez, 600 € al año, 50 € al mes",()=>{
  assert.equal(prev({amount:600,freq:"año",months:[3,9]}),"Se cobrarán 300,00 € en Mar, Sep (600,00 € al año): 50,00 € al mes repartidos.");
});
test("FIN-20 en el alta: trimestral 90 € con 3 meses son 270 € al año y 22,50 € al mes",()=>{
  assert.equal(prev({amount:90,freq:"trimestral",months:[8,2,5]}),"Se cobrarán 90,00 € en Feb, May, Ago (270,00 € al año): 22,50 € al mes repartidos.");
});
test("sin meses marcados, los de por defecto de la frecuencia",()=>{
  assert.equal(prev({amount:60,freq:"trimestral"}),"Se cobrarán 60,00 € en Ene, Abr, Jul, Oct (240,00 € al año): 20,00 € al mes repartidos.");
  assert.equal(prev({amount:61.7,freq:"bimestral"}),"Se cobrarán 61,70 € en Ene, Mar, May, Jul, Sep, Nov (370,20 € al año): 30,85 € al mes repartidos.");
});
test("un anual con un solo mes: el importe entero ese mes",()=>{
  assert.equal(prev({amount:666.36,freq:"año",months:[10]}),"Se cobrarán 666,36 € en Oct (666,36 € al año): 55,53 € al mes repartidos.");
});
test("un anual sin mes no inventa cuándo se cobra",()=>{
  assert.equal(prev({amount:120,freq:"año"}),"Serán 10,00 € al mes repartidos (120,00 € al año). Falta elegir en qué mes se cobra.");
});
test("mensual: lo de siempre",()=>{
  assert.equal(prev({amount:35,freq:"mes"}),"Serán 35,00 € cada mes.");
});
