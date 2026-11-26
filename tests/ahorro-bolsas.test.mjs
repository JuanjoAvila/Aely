// AHORRO POR BOLSAS: `state.aportaciones` sigue siendo la única lista; `bolsa` solo la clasifica. Ni un euro de más ni de menos.
// Cifras inventadas (el repo es público). Se corre con TZ=UTC.
import assert from "node:assert/strict";
import {cargarMotor,base,mov} from "./helpers/plan-reparto-fixture.mjs";

const c=cargarMotor();
const plano=v=>JSON.parse(JSON.stringify(v));
const total=a=>a.reduce((n,x)=>n+Math.round(x.amount*100),0);
const viejo=[{id:"a1",name:"Fondo",amount:200,ent:"myinvestor"},{id:"a2",name:"Plan",amount:50.5,ent:"trade_republic"}];

// Lo de antes entra en «otros», sin reescribir nada.
let b=c.bolsasDeAhorro(viejo);
assert.deepEqual(plano(b.map(x=>[x.key,x.c])),[["emergencia",0],["inversion",0],["otros",25050]]);
assert.deepEqual(plano(c.bolsasAplica(viejo,{},[],()=>"n")),viejo);
// Con varias filas en una bolsa, el total no se toca.
assert.deepEqual(plano(c.bolsasAplica(viejo,{otros:10},[],()=>"n")),viejo);

// Repartir el ahorro único: bajar «Otros» y subir las otras dos.
const uno=[viejo[0]];
let n=0;
const rep=c.bolsasAplica(uno,{otros:20,emergencia:80,inversion:100},[],()=>"n"+(++n));
assert.equal(total(rep),20000);
assert.deepEqual(plano(rep.find(x=>x.id==="a1")),{id:"a1",name:"Fondo",amount:20,ent:"myinvestor"},"la fila de siempre conserva id, nombre y banco");
assert.equal(rep.find(x=>x.bolsa==="emergencia").ent,"myinvestor","repartido desde una fila: es el mismo dinero y hereda su banco");
assert.equal(c.bolsasAplica(uno,{emergencia:80},[],()=>"x").find(x=>x.bolsa==="emergencia").ent,"","dinero nuevo para emergencia: sin banco");
const tr=c.bolsasAplica([{id:"t",name:"T",amount:200,ent:"trade_republic"}],{otros:100,inversion:100},[],()=>"i");
assert.deepEqual(plano(tr.map(x=>x.ent)),["trade_republic","trade_republic"]);
assert.equal(rep.find(x=>x.bolsa==="inversion").amount,100);
// Repetir la escritura no duplica.
assert.deepEqual(plano(c.bolsasAplica(rep,{otros:20,emergencia:80,inversion:100},[],()=>"x")),plano(rep));
// Bolsa propia: nace, cambia y no se crea vacía.
const con=c.bolsasAplica(rep,{},[{name:"Vacaciones",amount:30},{name:"Vacía",amount:0}],()=>"p1");
assert.equal(con.length,rep.length+1);
assert.equal(c.bolsasDeAhorro(con).find(x=>x.key==="propia:p1").c,3000);
assert.equal(c.bolsasAplica(con,{"propia:p1":0},[],()=>"x").find(x=>x.id==="p1").amount,0);

// La cascada: sin bolsas marcadas la cuenta es la de siempre; las líneas suman la fila al céntimo.
const inv=v=>base().expenses.concat([mov("inv",6,v,{category:"inversion"})]);
const suma=r=>r.bolsas.reduce((a,x)=>a+x.c,0)+r.ahoExtra;
let r=c.planReparto(base({aportaciones:viejo,expenses:inv(400)}),{});
assert.equal(r.aho,40000);assert.equal(r.qAho,0);assert.equal(suma(r),r.aho);
const mix=[{id:"e",name:"E",amount:100,ent:"",bolsa:"emergencia"},{id:"i",name:"I",amount:200,ent:"myinvestor",bolsa:"inversion"},{id:"p",name:"V",amount:30.25,ent:"",bolsa:"propia"}];
r=c.planReparto(base({aportaciones:mix}),{});
assert.equal(r.aho,33025);assert.equal(r.qAho,33025);assert.equal(r.ahoExtra,0);assert.equal(suma(r),r.aho);
// Invertir cubre «Inversión», nunca el fondo de emergencia ni las propias.
r=c.planReparto(base({aportaciones:mix,expenses:inv(350)}),{});
assert.equal(r.aho,13025+35000);assert.equal(r.qAho,13025);assert.equal(r.ahoExtra,15000);assert.equal(suma(r),r.aho);
assert.equal(c.bolsasAplica(con,{"propia:p1":null},[],()=>"x").some(x=>x.id==="p1"),false,"quitar una propia");
assert.deepEqual(plano(c.bolsasDeAhorro(con).map(x=>x.kind)),["emergencia","inversion","propia","otros"],"«Otros» al final");

/* B1: la misma fila etiquetada emergencia o propia, con banco bróker y su dinero invertido, no cuenta dos veces. */
for(const bolsa of ["emergencia","propia"]){
  r=c.planReparto(base({aportaciones:[{id:"e",name:"E",amount:200,ent:"myinvestor",bolsa}],expenses:inv(200)}),{});
  assert.equal(r.aho,20000);assert.equal(r.qAho,0);assert.equal(r.ahoExtra,0);assert.equal(suma(r),r.aho);
}
r=c.planReparto(base({aportaciones:[{id:"e",name:"E",amount:200,ent:"myinvestor",bolsa:"emergencia"},{id:"i",name:"I",amount:100,ent:"myinvestor",bolsa:"inversion"}],expenses:inv(350)}),{});
assert.equal(r.aho,35000);assert.equal(r.qAho,0);assert.equal(r.ahoExtra,5000);assert.equal(suma(r),r.aho);
r=c.planReparto(base({aportaciones:[{id:"e",name:"E",amount:200,ent:"sabadell",bolsa:"emergencia"}],expenses:inv(200)}),{});
assert.equal(r.aho,40000,"en un banco que no es bróker, lo invertido es otro dinero");

/* I1: repartir o etiquetar no cambia el histórico de patrimonio. */
const serie=aps=>plano(c.netWorthSeries(base({settings:{expenseBanks:["sabadell"],profile:{fullName:"Persona Inventada"}},
  investments:[{id:"v",ent:"trade_republic",name:"Fondo",qty:1,price:1000,value:1000,cur:"EUR"}],
  invHistory:[{d:"2026-11-01",v:1000},{d:"2026-11-20",v:1200}],
  expenses:base().expenses.concat([mov("t",10,200,{merchant:"Transferencia yo mismo"})]),aportaciones:aps})));
const una=[{id:"a",name:"A",amount:200,ent:"trade_republic"}];
const antes=serie(una);
assert.notDeepEqual(antes,serie([]),"la aportación se reconoce (si no, el test no prueba nada)");
assert.deepEqual(serie(c.bolsasAplica(una,{otros:100,inversion:100},[],()=>"i")),antes,"repartida en dos");
assert.deepEqual(serie(c.bolsasAplica(una,{otros:0,emergencia:200},[],()=>"e")),antes,"movida entera a emergencia");
assert.deepEqual(serie(c.bolsasAplica(una,{otros:50,emergencia:100},[{name:"V",amount:50}],()=>"p"+(++n))),antes,"con una propia");
assert.deepEqual(serie([{...una[0],bolsa:"emergencia"}]),antes,"etiquetada emergencia");
assert.deepEqual(serie([{...una[0],bolsa:"propia"}]),antes,"etiquetada propia");

/* B2: sin nada en Inversión ni Otros la proyección es 0, no los 500 de muestra. */
const fuente=(await import("node:fs")).readFileSync(new URL("../src/modules/06-sync-brokers.js",import.meta.url),"utf8");
const expr=/defMonthly:(\(state\.aportaciones.*:null)\r?\n/.exec(fuente)[1];
const ini=/useState\((Math\.max\(0,Math\.min\(3000,.*)\);\r?\n/.exec(fuente)[1];
const proy=aps=>{ const d=new Function("state","bolsaInvierte","return "+expr)({aportaciones:aps},c.bolsaInvierte); return new Function("defMonthly","return "+ini)(d); };
assert.equal(proy([{amount:200,bolsa:"emergencia"}]),0);
assert.equal(proy([{amount:200,bolsa:"propia"}]),0);
assert.equal(proy([{amount:200}]),200);
assert.equal(proy([]),500);
console.log("ahorro-bolsas OK");
