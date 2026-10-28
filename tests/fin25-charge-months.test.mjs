import assert from "node:assert/strict";
import fs from "node:fs";
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
