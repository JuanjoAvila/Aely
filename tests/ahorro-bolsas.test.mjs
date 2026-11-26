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
assert.equal(rep.find(x=>x.bolsa==="emergencia").ent,"","el fondo de emergencia no es una aportación a un bróker");
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
console.log("ahorro-bolsas OK");
