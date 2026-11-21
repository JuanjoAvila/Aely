import assert from "node:assert/strict";
import fs from "node:fs";
import {loadPureLogic} from "../scripts/load-pure-logic.mjs";
const read=f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8");
const js=JSON.parse(read("src/build-order.json")).map(f=>read("src/modules/"+f)).join("\n");
const c=loadPureLogic(read("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>js));

/* METAS: «AHORRO MENSUAL» ES LO QUE SUS REGLAS APARTAN (dueño, 18/11/2026). Antes la previsión de
   cada meta usaba la suma de `state.aportaciones` —lo que se aporta al bróker, que no va a ninguna
   meta—, así que una meta sin un euro apartado decía «llegas en …». Ahora manda el aporte de la
   propia meta y, si no, sus reglas. Importes inventados. */
let total=0,fallos=0;
function test(name,fn){ try{ fn();total++;console.log("✓ "+name); }catch(e){ fallos++;console.log("✗ "+name+"\n  "+String(e.message).split("\n")[0]); } }
const meta={id:"g1",name:"Viaje sintético",target:1000,saved:250};
const otra={id:"g2",name:"Colchón sintético",target:3000,saved:0};
const regla=(o)=>Object.assign({id:"r"+Math.random().toString(36).slice(2,7),name:"",kind:"fixed",value:100,goalId:"g1",mensual:true},o);
const estado=(rules,extra)=>Object.assign({budget:1000,goals:[meta,otra],aportaciones:[{id:"ap",ent:"myinvestor",name:"Fondo",amount:200}],settings:{reservaRules:rules}},extra||{});
const ritmo=(s,g)=>c.metaRitmoMensual(s,g||meta);

test("sin reglas ni aporte propio, lo del bróker no cuenta y no hay previsión",()=>{
  const s=estado([]);
  assert.equal(ritmo(s),0);
  assert.equal(c.goalEta(meta,ritmo(s)).text,"");
});
test("una regla mensual de importe fijo es su ritmo",()=>{
  const s=estado([regla({value:100})]);
  assert.equal(ritmo(s),100);
  assert.notEqual(c.goalEta(meta,ritmo(s)).text,"");
});
test("dos reglas de la misma meta se suman; las de otra meta, no",()=>{
  const s=estado([regla({value:100}),regla({value:25.5}),regla({value:900,goalId:"g2"})]);
  assert.equal(ritmo(s),125.5);
  assert.equal(ritmo(s,otra),900);
});
test("% del presupuesto, con el presupuesto de hoy; sin presupuesto, nada",()=>{
  assert.equal(ritmo(estado([regla({kind:"pct",value:10})])),100);
  assert.equal(ritmo(estado([regla({kind:"pct",value:10})],{budget:0})),0);
});
test("el aporte elegido en la meta manda sobre sus reglas",()=>{
  const g=Object.assign({},meta,{monthly:150});
  assert.equal(c.metaRitmoMensual(estado([regla({value:100})]),g),150);
});
test("reglas antiguas por ingreso: el importe fijo cuenta, el % no",()=>{
  assert.equal(ritmo(estado([regla({mensual:undefined,value:80})])),80);
  assert.equal(ritmo(estado([regla({mensual:undefined,kind:"pct",value:20})])),0);
});
test("una regla a una meta ya cumplida no da ritmo",()=>{
  const hecha=Object.assign({},meta,{done:true});
  assert.equal(c.metaRitmoMensual(Object.assign(estado([regla({value:100})]),{goals:[hecha,otra]}),hecha),0);
});
// Las dos pantallas que enseñan la previsión piden el ritmo de CADA meta, no el total del bróker.
test("Metas e Inicio llaman a goalEta con metaRitmoMensual",()=>{
  for(const f of ["src/modules/18-plan-deudas-metas.js","src/modules/03-tab-dash.js"]){
    const llamadas=read(f).match(/goalEta\([^;]*?\)/g)||[];
    assert.ok(llamadas.length>0,f);
    for(const x of llamadas) assert.match(x,/metaRitmoMensual\(state,/,f+": "+x);
  }
});
// «Aportación mensual» (state.aportaciones) se edita en Cartera › Inversiones, ya no en Metas.
test("la tarjeta de aportaciones vive en Inversiones y no en Metas",()=>{
  const v09=read("src/modules/09-tab-debts-goals.js"), v14=read("src/modules/14-v4-screens.js");
  const goals=v09.slice(v09.indexOf("function Goals("),v09.indexOf("function ContributeGoalSheet("));
  assert.doesNotMatch(goals,/SavingsPlanCard/);
  const push=v14.slice(v14.indexOf("function InvestmentsPush("),v14.indexOf("function mcTecladoAlto("));
  assert.match(push,/React\.createElement\(SavingsPlanCard,/);
});
console.log("\n"+total+" OK, "+fallos+" fallos");
if(fallos) process.exit(1);
