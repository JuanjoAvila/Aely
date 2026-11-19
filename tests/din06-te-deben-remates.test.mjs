import assert from "node:assert/strict";
import fs from "node:fs";
import {test} from "node:test";
import {loadPureLogic} from "../scripts/load-pure-logic.mjs";
const read=f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8");
const js=JSON.parse(read("src/build-order.json")).map(f=>read("src/modules/"+f)).join("\n");
const c=loadPureLogic(read("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>js));

/* REMATES DE «TE DEBEN» (DIN-06, lo que dejó abierto la revisión de la 228). Personas, apellidos y
   cifras inventados: un recibo de 20 € a cuatro (tres personas a 5 €), titular «Marta Sastre Ruano».
   1. Una hermana con los dos apellidos del titular («BIZUM DE LAURA SASTRE RUANO») se tomaba por
      dinero tuyo y no pagaba nunca. Ahora hace falta también la pila del titular.
   2. Un cargo del mismo importe con «transferencia» en el texto en otro banco ±2 días tapaba el Bizum
      aunque fuera el alquiler (enlazado a un recibo). Un cargo de recibo, deuda o meta ya no es la
      otra pata de un traspaso tuyo.
   3. Dos avisos del mismo ingreso por canales distintos (la noti del banco y Wallet) sumaban dos
      veces. Dos del mismo canal siguen siendo dos pagos. */
const Y=2026, M=11, HOY=20;
const p=(id,n)=>({id,n,via:"bizum",amt:5});
const rec={id:"luz",name:"Luz",amount:5,bankAmount:20,freq:"mes",day:2,account:"sabadell",
  reparto:[p("pe_laura","Laura"),p("pe_iker","Iker"),p("pe_ona","Ona")]};
const alquiler={id:"alq",name:"Alquiler",amount:5,freq:"mes",day:3,account:"bbva"};
const ing=(id,merchant,amount,date,extra)=>Object.assign({id,merchant,amount:-amount,date,category:"ingreso",ent:"sabadell",source:"ob"},extra||{});
const estado=(expenses)=>({fixed:[rec,alquiler],debts:[],expenses,bankTx:[],accounts:[{id:"b",ent:"sabadell",value:1000}],
  settings:{profile:{fullName:"Marta Sastre Ruano"}}});
const de=(s,id)=>c.teDebenMes(s,Y,M,HOY).find(x=>x.id===id);
const cts=x=>Math.round(x*100)+0;

test("1 · la hermana con tus dos apellidos sí paga",()=>{
  const s=estado([ing("i1","BIZUM DE LAURA SASTRE RUANO",5,"2026-11-05")]);
  assert.equal(de(s,"pe_laura").pagado,true);
  assert.deepEqual([...de(s,"pe_laura").ingresos],["i1"]);
});

test("1 · con tu pila delante sigue siendo dinero tuyo, aunque nombre a la persona",()=>{
  const s=estado([ing("i1","TRANSFERENCIA DE MARTA SASTRE RUANO CONCEPTO LAURA",5,"2026-11-05")]);
  assert.equal(de(s,"pe_laura").pagado,false);
  assert.equal(cts(de(s,"pe_laura").recibido||0),0);
});

test("2 · el alquiler por transferencia (cargo de recibo) en otro banco no tapa el Bizum",()=>{
  const s=estado([ing("i1","BIZUM DE IKER",5,"2026-11-05"),
    {id:"g1",merchant:"TRANSFERENCIA A CASERO",amount:5,date:"2026-11-06",category:"vivienda",ent:"bbva",source:"ob",reciboId:"alq"}]);
  assert.equal(de(s,"pe_iker").pagado,true);
});

// R3 (rev. de la ronda E1): la cuota de una deuda y la aportación a una meta tampoco son la otra pata.
for(const [marca,v] of [["debtId","hipo"],["goalId","viaje"]]){
  test("2 · un cargo con "+marca+" en otro banco no tapa el Bizum",()=>{
    const s=estado([ing("i1","BIZUM DE IKER",5,"2026-11-05"),
      {id:"g1",merchant:"TRANSFERENCIA A CASERO",amount:5,date:"2026-11-06",category:"vivienda",ent:"bbva",source:"ob",[marca]:v}]);
    assert.equal(de(s,"pe_iker").pagado,true);
  });
}

test("2 · un traspaso de verdad a otro banco tuyo sigue tapándolo (lado seguro)",()=>{
  const s=estado([ing("i1","BIZUM DE IKER",5,"2026-11-05"),
    {id:"g1",merchant:"TRASPASO",amount:5,date:"2026-11-06",category:"traspaso",ent:"bbva",source:"ob"}]);
  assert.equal(de(s,"pe_iker").pagado,false);
});

test("3 · el mismo Bizum avisado por el banco y por Wallet cuenta una vez",()=>{
  const s=estado([
    ing("a1","BIZUM DE ONA",2.5,"2026-11-05",{source:"macrodroid"}),
    ing("a2","BIZUM DE ONA",2.5,"2026-11-05",{source:"wallet"})]);
  const a=de(s,"pe_ona");
  assert.equal(cts(a.recibido),250,"dos avisos de un pago son un pago");
  assert.equal(cts(a.falta),250);
  // Dos sumas independientes: lo recibido más lo que falta es lo que debía.
  assert.equal(cts(a.recibido)+cts(a.falta),500);
});

test("3 · dos pagos del mismo canal siguen siendo dos",()=>{
  const s=estado([
    ing("a1","BIZUM DE ONA",2.5,"2026-11-05",{source:"macrodroid"}),
    ing("a2","BIZUM DE ONA",2.5,"2026-11-06",{source:"macrodroid"})]);
  assert.equal(de(s,"pe_ona").pagado,true);
});
