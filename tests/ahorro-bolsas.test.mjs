// AHORRO POR BOLSAS: `state.aportaciones` sigue siendo la única lista; `bolsa` solo la clasifica. Ni un euro de más ni de menos.
// Cifras inventadas (el repo es público). Se corre con TZ=UTC.
import assert from "node:assert/strict";
import fs from "node:fs";
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
const {previo,...a1}=plano(rep.find(x=>x.id==="a1"));
assert.deepEqual(a1,{id:"a1",name:"Fondo",amount:20,ent:"myinvestor"},"la fila de siempre conserva id, nombre y banco");
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
const fuente=fs.readFileSync(new URL("../src/modules/06-sync-brokers.js",import.meta.url),"utf8");
const expr=/defMonthly:(\(state\.aportaciones.*:null)\r?\n/.exec(fuente)[1];
const ini=/useState\((Math\.max\(0,Math\.min\(3000,.*)\);\r?\n/.exec(fuente)[1];
const proy=aps=>{ const d=new Function("state","bolsaInvierte","return "+expr)({aportaciones:aps},c.bolsaInvierte); return new Function("defMonthly","return "+ini)(d); };
assert.equal(proy([{amount:200,bolsa:"emergencia"}]),0);
assert.equal(proy([{amount:200,bolsa:"propia"}]),0);
assert.equal(proy([{amount:200}]),200);
assert.equal(proy([]),500);
const cifras=(aps,invertido)=>{ const x=c.planReparto(base({aportaciones:aps,expenses:inv(invertido)}),{}); assert.equal(suma(x),x.aho); return [x.aho,x.qAho,x.libre]; };
const nuevo=()=>"h"+(++n);

/* H1: la fila sin banco que recibe dinero de otra con banco no lo cuenta dos veces, ni se le inventa banco para lo suyo. */
for(const banco of ["","sabadell"]){
  const h1=[{id:"o",name:"O",amount:500,ent:"myinvestor"},{id:"e",name:"E",amount:100,ent:banco,bolsa:"emergencia"}];
  const h1r=c.bolsasAplica(h1,{emergencia:400,otros:200},[],nuevo);
  assert.deepEqual(cifras(h1,500).slice(0,2),[60000,10000]);
  assert.deepEqual(cifras(h1r,500),cifras(h1,500),"repartir no cambia ahorro, pendiente ni libre");
  assert.deepEqual(cifras(h1r,600),cifras(h1,600),"los 100 que ya estaban sin invertir siguen aparte");
  assert.equal(h1r.find(x=>x.id==="e").ent,banco,"parte del dinero no era del bróker: la fila no cambia de banco");
  assert.deepEqual(plano(c.bolsasAplica(h1r,{emergencia:400,otros:200},[],nuevo)),plano(h1r),"repetir no duplica");
  assert.deepEqual(plano(c.bolsasAplica(h1r,{emergencia:100,otros:500},[],nuevo)),h1,"deshacer el reparto deja lo de antes");
}

/* H3: solo hereda lo que se movió; el dinero nuevo nace sin banco. */
const h3=[{id:"o",name:"O",amount:500,ent:"myinvestor"}];
let h3r=c.bolsasAplica(h3,{otros:499},[{name:"Coche",amount:1000}],nuevo);
assert.equal(h3r[1].ent,"","999 de los 1000 son dinero nuevo");
assert.deepEqual(cifras(h3r,1500).slice(0,2),[249900,99900]);
h3r=c.bolsasAplica(h3,{otros:499,emergencia:1000},[],nuevo);
assert.equal(h3r[1].ent,"");
assert.deepEqual(cifras(h3r,1500).slice(0,2),[249900,99900]);
// Bajar más de lo que otro sube: lo recibido es todo movido y hereda el banco.
assert.equal(c.bolsasAplica(h3,{otros:100},[{name:"Coche",amount:400}],nuevo)[1].ent,"myinvestor");

/* H4: con transferencia de una parte, repartir tampoco cambia el histórico; y sin apartados, la serie de siempre. */
const conTransfer=(aps,v)=>plano(c.netWorthSeries(base({settings:{expenseBanks:["sabadell"],profile:{fullName:"Persona Inventada"}},
  investments:[{id:"v",ent:"trade_republic",name:"Fondo",qty:1,price:1000,value:1000,cur:"EUR"}],
  invHistory:[{d:"2026-11-01",v:1000},{d:"2026-11-20",v:1200}],
  expenses:base().expenses.concat([mov("t",10,v,{merchant:"Transferencia yo mismo",category:"otros"})]),aportaciones:aps})));
assert.notDeepEqual(conTransfer(una,200),conTransfer([],200),"la entera se reconoce");
const partida=c.bolsasAplica(una,{otros:100,inversion:100},[],nuevo);
for(const v of [100,200]){
  assert.deepEqual(conTransfer(partida,v),conTransfer(una,v),"100+100 con transferencia de "+v);
  assert.deepEqual(conTransfer(c.bolsasAplica(partida,{inversion:40,emergencia:60},[],nuevo),v),conTransfer(una,v),"repartido otra vez, "+v);
}
const dos=[{id:"a",name:"A",amount:200,ent:"trade_republic"},{id:"b",name:"B",amount:50,ent:"trade_republic",bolsa:"inversion"}];
const movida=c.bolsasAplica(dos,{otros:100,inversion:150},[],nuevo);
for(const v of [50,100,150,200,250]) assert.deepEqual(conTransfer(movida,v),conTransfer(dos,v),"parte movida entre dos filas, "+v);
const sinMarcas=[{id:"a",name:"A",amount:100,ent:"trade_republic"},{id:"b",name:"B",amount:100,ent:"trade_republic"}];
assert.deepEqual(conTransfer(sinMarcas,200),conTransfer([],200),"sin apartados no se casa la suma por bróker");
assert.notDeepEqual(conTransfer(sinMarcas,100),conTransfer([],100));

/* V1: lo apuntado de un reparto vale su mes; después, lo invertido en el bróker no cubre la emergencia de otro banco. */
const v1=[{id:"o",name:"O",amount:500,ent:"trade_republic"},{id:"e",name:"E",amount:100,ent:"sabadell",bolsa:"emergencia"}];
const v1r=c.bolsasAplica(v1,{otros:100,emergencia:500},[],nuevo);
assert.deepEqual(cifras(v1r,500),cifras(v1,500),"en el mes del reparto no cambia nada");
const enDic=(aps)=>{ const x=c.planReparto(base({aportaciones:aps,expenses:[mov("n12",3,-3000,{merchant:"Nómina Empresa SL",date:"2026-12-03T10:00:00.000Z"}),
  mov("i12",6,500,{category:"inversion",date:"2026-12-06T10:00:00.000Z"})]}),{nowMs:Date.parse("2026-12-21T11:00:00Z")}); return [x.aho,x.qAho,x.libre]; };
assert.deepEqual(enDic(v1r),[100000,50000,110000]);
// Y un guardado de otro mes no lo resucita con fecha nueva.
const caducado=v1r.map(a=>a.viene?{...a,viene:a.viene.map(v=>({...v,d:"2026-10-05"}))}:a);
assert.equal(c.bolsasAplica(caducado,{emergencia:400},[{name:"V",amount:100}],nuevo).some(a=>a.viene&&a.viene.some(v=>v.id==="o")),false);

// Mi ciclo con la nómina siguiente retrasada: el reparto de hoy sigue valiendo pasado el fin nominal.
const tarde=(aps)=>{ const x=c.planReparto(base({aportaciones:aps,settings:{expenseBanks:["sabadell"],budgetCycle:true},
  expenses:[mov("nc",18,-3000,{merchant:"Nómina Empresa SL",date:"2026-10-18T10:00:00.000Z"}),
  mov("ic",19,500,{category:"inversion",date:"2026-10-19T10:00:00.000Z"})]}),{nowMs:Date.parse("2026-11-21T11:00:00Z")}); return [x.periodo.cycle,x.aho,x.qAho,x.libre]; };
const hoy21=v1r.map(a=>a.viene?{...a,viene:a.viene.map(v=>({...v,d:"2026-11-21"}))}:a);
assert.equal(tarde(v1)[0],true);
assert.deepEqual(tarde(hoy21),tarde(v1),"nómina con retraso: repartir no cambia las cifras");

/* V2: borrar o cambiar en Cartera (o desde una versión anterior, que conserva el campo) anula lo apuntado. */
const sinViene=aps=>aps.map(({viene,...a})=>a);
assert.notDeepEqual(cifras(v1r,500),cifras(sinViene(v1r),500),"el apunte pesa (si no, no se prueba nada)");
const cambia=(aps,id,x)=>aps.map(a=>a.id===id?{...a,...x}:a);
for(const [caso,aps] of [["origen borrado",v1r.filter(a=>a.id!=="o")],["origen cambiado",cambia(v1r,"o",{amount:90})],
  ["origen en otro banco",cambia(v1r,"o",{ent:"myinvestor"})],["destino a 0",cambia(v1r,"e",{amount:0})],["destino cambiado",cambia(v1r,"e",{amount:600})]])
  assert.deepEqual(cifras(aps,500),cifras(sinViene(aps),500),caso);
const guardarCartera=(aps,toca)=>{
  const src=fs.readFileSync(new URL("../src/modules/09-tab-debts-goals.js",import.meta.url),"utf8");
  const cuerpo=/const save=function\(\)\{\r?\n(    const prev=\{\}; aps\.forEach[\s\S]*?)\r?\n    set\(function/.exec(src)[1];
  const drafts=toca(aps.map(a=>({id:a.id,name:a.name,amount:String(a.amount),ent:a.ent,bolsa:c.bolsaDe(a)})));
  return new Function("aps","drafts","ahorroImporteDe","bolsaDe","bolsaCts","t",cuerpo+"\nreturn next;")(aps,drafts,Number,c.bolsaDe,c.bolsaCts,k=>k);
};
const lleva=aps=>aps.some(a=>a.viene);
assert.equal(lleva(guardarCartera(v1r,d=>d)),true,"guardar sin tocar lo conserva");
assert.equal(lleva(guardarCartera(v1r,d=>d.filter(a=>a.id!=="o"))),false,"borrar la fila origen");
for(const [id,x] of [["o",{amount:"90"}],["e",{amount:"0"}],["e",{amount:"600"}],["o",{ent:"myinvestor"}],["e",{bolsa:"otros"}]])
  assert.equal(lleva(guardarCartera(v1r,d=>cambia(d,id,x))),false,"editar "+id+" "+JSON.stringify(x));
// E a 0 y subida de nuevo no resucita los 400.
const vuelta=guardarCartera(guardarCartera(v1r,d=>cambia(d,"e",{amount:"0"})),d=>cambia(d,"e",{amount:"500"}));
assert.deepEqual(cifras(vuelta,500),cifras(sinViene(v1r),500));
assert.equal(c.bolsasAplica(v1r,{},[],nuevo).length,2);
const conP=c.bolsasAplica(v1,{},[{name:"V",amount:50}],()=>"pv");
const deP=c.bolsasAplica(c.bolsasAplica(conP,{"propia:pv":0,emergencia:150},[],nuevo),{"propia:pv":null},[],nuevo);
assert.equal(deP.some(a=>a.viene&&a.viene.some(v=>v.id==="pv")),false,"quitar el origen desde Inicio");

/* V3: la gráfica de Inicio casa los importes actuales; los de antes del reparto, solo para lo anterior a él. */
const o500=[{id:"o",name:"O",amount:500,ent:"trade_republic"}];
const subida=c.bolsasAplica(c.bolsasAplica(o500,{otros:300,emergencia:200},[],nuevo),{otros:500},[],nuevo);
assert.deepEqual(conTransfer(subida,500),conTransfer(o500,500),"O vuelve a 500: la transferencia se reconoce");
assert.notDeepEqual(conTransfer(subida,500),conTransfer([],500));
const enDia=(aps,d)=>plano(c.aportacionesEnDia(aps,d).filter(p=>p.ent==="trade_republic").map(p=>p.amount).sort((a,b)=>a-b));
assert.deepEqual(enDia(subida,"2026-11-10"),[500],"antes del reparto, lo de entonces");
assert.deepEqual(enDia(subida,"2026-11-25"),[200,500],"después, los importes actuales fila a fila, sin sumar por origen");
const sinP=c.bolsasAplica(conP.map(({viene,previo,...a})=>a),{"propia:pv":null,emergencia:150},[],nuevo);
assert.ok(c.aportacionesEnDia(sinP,"2026-11-10").some(p=>p.amount===50),"quitar una propia repartiendo no borra su pasado");

// El campo sin foco enseña el punto de millar y se relee al céntimo: «1.250» son mil doscientos cincuenta, no 1,25.
for(const [v,es] of [[1250.75,"1.250,75"],[1250,"1.250"],[1250000.5,"1.250.000,5"],[999,"999"],[30.5,"30,5"],[0,"0"]]){
  assert.equal(c.ahorroTexto(v),es);
  assert.equal(Math.round(c.ahorroImporteDe(es)*100),Math.round(v*100),es);
}
console.log("ahorro-bolsas OK");
