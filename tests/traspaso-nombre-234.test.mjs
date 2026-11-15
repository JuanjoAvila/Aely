// UN GASTO DE VERDAD NO SE VUELVE TRASPASO POR UN NOMBRE (revisión externa del 15/11/2026, ALTA).
// La salida de un traspaso propio (`salidasTraspasoPropio`, 230) pasaba a «traspaso» —y se subía a la
// nube— con el nombre del titular en CUALQUIER texto del movimiento y un importe a un 2 % del previsto:
//  R1. el alquiler al casero, con el titular como ORDENANTE en el concepto;
//  R2. una transferencia a un hermano (mismos apellidos), con el titular en la nota;
//  R3. un pago con su nombre en la nota que él escribió;
//  R4. un hermano con nombre compuesto que cumplía «nombre de pila + dos apellidos»;
//  R5. a su nombre, pero un 2 % por debajo del traspaso previsto.
// Ahora: beneficiario = titular entero y al céntimo de un traspaso previsto, o la otra pata. Lo que él
// ya marcó (o desmarcó) a mano no se toca. Nombres y cifras inventados: nunca los de la cartera real.
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPureLogic } from "../scripts/load-pure-logic.mjs";
import { contarTraspasosPorNombre } from "../scripts/contar-traspasos-nombre.mjs";

const source=file=>fs.readFileSync(new URL("../"+file,import.meta.url),"utf8").replaceAll("\r\n","\n");
const order=JSON.parse(source("src/build-order.json"));
const shell=source("src/shell.html");
const reloj={ms:Date.parse("2026-11-12T12:00:00Z")};
const cargar=(cambiar)=>{
  const c=loadPureLogic(shell.replace("<!--MC_APP_SCRIPT-->",()=>order.map(f=>{
    const s=source("src/modules/"+f); return f==="08-motor-bank.js"&&cambiar?cambiar(s):s; }).join("\n")));
  c.Date=class extends Date{ constructor(...a){ super(...(a.length?a:[reloj.ms])); } static now(){ return reloj.ms; } };
  return c;
};
const copia=x=>JSON.parse(JSON.stringify(x));
const A_MI={id:"ami",kind:"transfer",name:"A MyInvestor",amount:400,from:"sabadell",to:"myinvestor",day:1};
const A_TR={id:"atr",kind:"transfer",name:"A Trade Republic",amount:1200,from:"sabadell",to:"trade_republic",day:1};
const fila=(id,date,amount,merchant,extra)=>Object.assign({id,ent:"sabadell",date,amount,merchant,source:"ob",status:"BOOK",category:"otros"},extra||{});
const estado=(cambios,nombre)=>copia(Object.assign({
  accounts:[{id:"sab",ent:"sabadell",role:"fijos",value:1000},{id:"tr",ent:"trade_republic",role:"gasto",value:300}],
  fixed:[],debts:[],oneoffs:[],flows:[A_MI],expenses:[],bankTx:[],deleted:[],investments:[],assets:[],aportaciones:[],obAccounts:[],
  settings:{profile:{fullName:nombre||"Leo Sastre Ruano"}},trasAbonoDesde:20261101
},cambios||{}));

function suite(c){
  const fallos=[];
  const caso=(nombre,fn)=>{ try{ fn(); }catch(e){ fallos.push(nombre+": "+e.message); } };
  const salen=s=>Array.from(c.salidasTraspasoPropio(s),x=>x.id).sort();
  const recat=s=>Array.from(c.reconcileObDupes(s).recat,x=>x.expense.id+":"+x.cat).sort();

  caso("R1 · el alquiler con el titular de ordenante sigue siendo un gasto",()=>{
    const e=fila("r1","2026-11-05",400,"Casero Ejemplo SL",{concept:"TRANSFERENCIA DE LEO SASTRE RUANO"});
    assert.deepEqual(salen(estado({expenses:[e]})),[]);
    assert.deepEqual(recat(estado({expenses:[e]})),[],"y no se sube nada a la nube");
  });
  caso("R2 · al hermano, con el titular en la nota",()=>{
    const e=fila("r2","2026-10-30",400,"Pedro Sastre Ruano",{concept:"TRANSFERENCIA A PEDRO SASTRE RUANO",note:"ORDENANTE LEO SASTRE RUANO"});
    assert.deepEqual(salen(estado({expenses:[e]})),[]);
  });
  caso("R3 · su nombre en la nota que él escribió no lo hace suyo",()=>{
    const e=fila("r3","2026-11-02",400,"Transferencia emitida",{note:"cena Leo Sastre Ruano"});
    assert.deepEqual(salen(estado({expenses:[e]})),[]);
  });
  caso("R4 · un hermano de nombre compuesto no es el nombre entero",()=>{
    const e=fila("r4","2026-10-30",400,"Leo Pau Sastre Ruano",{concept:"TRANSFERENCIA A LEO PAU SASTRE RUANO"});
    assert.deepEqual(salen(estado({expenses:[e]},"Leo Marc Sastre Ruano")),[]);
    const corto=fila("r4b","2026-10-30",400,"Leo Sastre Ruano",{concept:"TRANSFERENCIA A LEO SASTRE RUANO"});
    assert.deepEqual(salen(estado({expenses:[corto]},"Leo Marc Sastre Ruano")),[],"ni sin el segundo nombre");
  });
  caso("R5 · a su nombre, pero un 2 % por debajo del previsto: no, sin la otra pata",()=>{
    const e=fila("r5","2026-10-30",392,"Leo Sastre Ruano",{concept:"TRANSFERENCIA A LEO SASTRE RUANO"});
    assert.deepEqual(salen(estado({expenses:[e]})),[]);
  });
  caso("P1 · beneficiario el titular y al céntimo: traspaso (lo que vio él el 30/10)",()=>{
    const e=fila("p1","2026-10-30",400,"Leo Sastre Ruano",{concept:"TRANSFERENCIA A LEO SASTRE RUANO"});
    assert.deepEqual(recat(estado({expenses:[e]})),["p1:traspaso"]);
    // Sin acreedor el banco pone el concepto de título: «TRANSFERENCIA A <titular>», en otro orden.
    const t=fila("p1b","2026-10-30",400,"TRANSFERENCIA A RUANO SASTRE LEO");
    assert.deepEqual(salen(estado({expenses:[t]})),["p1b"]);
    // Renombrado por él: manda el nombre del banco (`obName`).
    const r=fila("p1c","2026-10-30",400,"Mi colchón",{obName:"LEO SASTRE RUANO",concept:"TRANSFERENCIA"});
    assert.deepEqual(salen(estado({expenses:[r]})),["p1c"]);
    // «Transferencia DE <titular>» es el ordenante, no el beneficiario.
    const de=fila("p1d","2026-10-30",400,"TRANSFERENCIA DE LEO SASTRE RUANO");
    assert.deepEqual(salen(estado({expenses:[de]})),[]);
  });
  caso("P2 · con la otra pata al céntimo entre esos dos bancos sigue bastando, aunque varíe del previsto",()=>{
    const sale=fila("p2","2026-10-30",1180,"Transferencia emitida");
    const llega={id:"p2l",ent:"trade_republic",date:"2026-10-30",amount:-1180,merchant:"Traspaso recibido",source:"ob",status:"BOOK",category:"traspaso"};
    assert.deepEqual(salen(estado({flows:[A_TR],expenses:[sale,llega]})),["p2"]);
  });
  caso("M · lo que él decidió no se toca: su traspaso a mano no se revierte y su «no es mío» no se marca",()=>{
    const suyo=fila("m1","2026-11-05",400,"Casero Ejemplo SL",{category:"traspaso",concept:"TRANSFERENCIA DE LEO SASTRE RUANO"});
    const s=estado({expenses:[suyo]}), r=c.reconcileObDupes(s);
    assert.equal(r.recat.length,0); assert.equal(r.state.expenses[0].category,"traspaso");
    const no=fila("m2","2026-10-30",400,"Leo Sastre Ruano",{ownTransferRejected:true});
    assert.deepEqual(salen(estado({expenses:[no]})),[]);
  });
  caso("L · la cuenta de la limpieza: solo cuenta, distingue lo que tiene prueba fuerte y no escribe",()=>{
    const marcadas=[
      fila("l1","2026-11-05",400,"Casero Ejemplo SL",{category:"traspaso",concept:"TRANSFERENCIA DE LEO SASTRE RUANO"}),
      fila("l2","2026-10-30",400,"Leo Sastre Ruano",{category:"traspaso",concept:"TRANSFERENCIA A LEO SASTRE RUANO"}),
      fila("l3","2026-11-03",50,"Bar Ejemplo",{category:"traspaso",note:"TRANSFERENCIA cena"}),
      fila("l4","2026-09-30",400,"Casero Ejemplo SL",{category:"traspaso",concept:"TRANSFERENCIA DE LEO SASTRE RUANO"}),
    ];
    const s=estado({expenses:marcadas}), antes=JSON.stringify(s);
    const r=contarTraspasosPorNombre(c,viejo,s,{desde:"2026-10-24",reloj});
    assert.equal(JSON.stringify(s),antes,"no toca el estado");
    assert.deepEqual(r.sospechosas.map(x=>x.id),["l1"],"el alquiler: nombre fuera del beneficiario, sin prueba fuerte");
    assert.deepEqual(r.conPrueba.map(x=>x.id),["l2"],"el traspaso de verdad se queda");
    assert.equal(r.revisadas,3,"septiembre no lo pudo marcar esta regla");
  });
  return fallos;
}

// La regla de antes de la 234, tal cual estaba (0184ef82c): la limpieza la necesita para saber qué marcaba.
const A_LA_VIEJA=[
  [`const benef=e&&(e.obName!=null&&String(e.obName).trim()?e.obName:e.merchant);
  return w.indexOf(" ")>0&&palabras(recNorm(benef).replace(TRASPASO_A_RE,""))===w;`,
   `const txt=" "+recNorm([e.merchant,e.obName,e.concept,e.note].join(" "))+" ";
  if(DEBEN_PROPIO.test(txt)) return true;
  const v=recNorm(s.settings&&s.settings.profile&&s.settings.profile.fullName).split(" ").filter(function(x){ return x.length>=2&&!DEBEN_PALABRAS_NO[x]; });
  if(v.length<2) return false;
  const esta=function(k){ return txt.indexOf(" "+k+" ")>=0; };
  return v.every(esta)||v.length>=3&&esta(v[0])&&esta(v[v.length-2])&&esta(v[v.length-1]);`],
  ["if(tuyo&&previsto(e,null,true)) return true;","if(tuyo&&previsto(e,null,false)) return true;"],
];
const viejo=cargar(s=>A_LA_VIEJA.reduce((t,[de,a])=>{ assert.ok(t.includes(de),"la regla vieja encuentra su sitio"); return t.replace(de,a); },s));
// La regla vieja cae en los cinco casos del hallazgo: si no, el test no reproduce nada.
const delViejo=suite(viejo).filter(x=>/^R[1-5] /.test(x));
assert.equal(delViejo.length,5,"la regla vieja reproduce R1-R5: "+delViejo.join(" | "));
console.log("traspaso-nombre-234: la regla vieja cae en R1-R5 (reproducido)");

const reales=suite(cargar());
assert.deepEqual(reales,[],"el motor de verdad pasa todos los casos");
console.log("traspaso-nombre-234: casos OK");

const MUTANTES=[
  ["el nombre en el concepto o la nota vuelve a contar",'const benef=e&&(e.obName!=null&&String(e.obName).trim()?e.obName:e.merchant);','const benef=e&&[e.merchant,e.obName,e.concept,e.note].join(" ");'],
  ["sin exigir el nombre ENTERO y solo",'.replace(TRASPASO_A_RE,""))===w;','.replace(TRASPASO_A_RE,"")).indexOf(w.split(" ")[0])>=0;'],
  ["«de <titular>» pasa por beneficiario",'(?:a favor de|a|to|para) /','(?:a favor de|a|de|to|para) /'],
  ["sin el céntimo en el traspaso previsto",'if(tuyo&&previsto(e,null,true)) return true;','if(tuyo&&previsto(e,null,false)) return true;'],
  ["el céntimo también le quita la otra pata",'(exacto||!recAmtClose(want,Number(e.amount)))','(true)'],
  ["sin nombre ya basta el previsto",'if(tuyo&&previsto(e,null,true)) return true;','if(previsto(e,null,true)) return true;'],
];
let muertos=0;
for(const [nombre,de,a] of MUTANTES){
  const c=cargar(s=>{ assert.ok(s.includes(de),"el mutante «"+nombre+"» encuentra su fragmento"); return s.replace(de,a); });
  assert.ok(suite(c).length>0,"mutante vivo: "+nombre);
  muertos++;
}
console.log("traspaso-nombre-234: "+muertos+" mutantes detectados");
