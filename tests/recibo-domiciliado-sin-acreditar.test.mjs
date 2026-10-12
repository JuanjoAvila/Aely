// Reporte del dueño (12/10/2026, beta 4.26.118.1): dos adeudos domiciliados de Sabadell que el
// banco YA cobró («Pepe Mobile, S.L.U.» el día 5 y «COMUNIDAD DE PROPIETARIOS» el 12) no estaban
// en Gastos ni marcaban pagado su recibo de Plan; «Importar histórico» los enseñaba como
// repetidos («ya modelado como fijo/deuda/meta») y sin marcar.
//
// Este fichero NO arregla nada: deja fijado el comportamiento de hoy hasta que el dueño decida
// (opciones en el informe de la rama `claude/recibo-banco-no-acredita`). El fondo es que DOS
// reglas distintas miran el mismo cargo:
//   · quitarlo de Gastos (`importObExpenses`) y llamarlo repetido (`histMatchesModeled`) solo
//     piden banco + nombre parecido + importe parecido;
//   · acreditar el recibo (`fixedPaymentState`, camino BOOK) pide además que el cargo esté en el
//     extracto LOCAL de este móvil, contabilizado, y que el banco tenga UNA sola cuenta de recibos.
// Cuando la primera dice sí y la segunda no, el cargo no consta en ningún sitio.
// Datos sintéticos; la fecha es fija para que el mes no dependa del día en que corra.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import { loadPureLogic } from "../scripts/load-pure-logic.mjs";

const source=file=>fs.readFileSync(new URL("../"+file,import.meta.url),"utf8");
const order=JSON.parse(source("src/build-order.json"));
const js=order.map(file=>source("src/modules/"+file)).join("\n");
const c=loadPureLogic(source("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>js));
vm.runInNewContext(source("src/modules/14-v4-screens.js"),c);
const AHORA=new Date("2026-10-12T18:00:00+02:00").getTime();
c.Date=class extends Date { constructor(...a){ super(...(a.length?a:[AHORA])); } static now(){ return AHORA; } };

const fijos=[
  {id:"com",name:"Comunidad",amount:50,freq:"mes",day:12,account:"sabadell"},
  {id:"mov",name:"Pepe Mobile, S.L.U.",amount:102,freq:"mes",day:5,account:"sabadell"},
];
const extracto=[
  {id:"t1",ent:"sabadell",date:"2026-10-12",amount:50,merchant:"COMUNIDAD DE PROPIETARIOS",status:"BOOK",card:false},
  {id:"t2",ent:"sabadell",date:"2026-10-05",amount:102,merchant:"Pepe Mobile, S.L.U.",status:"BOOK",card:false},
];
const unaCuenta=[{id:"sb",ent:"sabadell",role:"fijos",value:2000},{id:"tr",ent:"traderepublic",role:"diario",spendFrom:true,value:500}];
const estado=o=>Object.assign({accounts:unaCuenta,fixed:fijos,bankTx:extracto,debts:[],oneoffs:[],expenses:[],flows:[],settings:{}},o);
const pagados=s=>s.fixed.filter(f=>c.fixedPaymentState(s,f,2026,10,12).paid).map(f=>f.id).join(",");
const candidatos=extracto.map(t=>({kind:"out",ent:t.ent,date:t.date,amount:t.amount,merchant:t.merchant,card:false,id:t.id}));
const historico=s=>c.histClassifyCandidates(candidatos,s).rows.map(r=>r.status+"/"+r.reason).join(" ");
// Lo que deja «Importar histórico» al marcar la fila repetida con destino Gasto.
const importados=extracto.map((t,i)=>({id:"h"+i,date:new Date(t.date+"T12:00:00").toISOString(),merchant:t.merchant,amount:t.amount,category:"otros",source:"ob-hist",ent:t.ent,extId:t.id}));

test("caso sano: con el cargo contabilizado en el extracto local, el recibo se acredita y no entra en Gastos", ()=>{
  const s=estado();
  assert.equal(c.importObExpenses(s,extracto,[]),null,"el sync no crea gasto: el recibo ya lo cuenta");
  assert.equal(pagados(s),"com,mov");
  const guardado=c.reconcileFixedPaymentProofs(s,2026,10,12);
  assert.equal(pagados(Object.assign({},guardado,{bankTx:[]})),"com,mov","la prueba viaja sin extracto");
});

// Las dos situaciones compatibles con lo que él vio (no pagado antes, pagado al importar).
for(const [nombre,cambio] of [
  ["el extracto local no trae esos cargos (no se pulsó Actualizar desde el cobro)",{bankTx:[]}],
  ["el banco tiene dos cuentas con rol de recibos",{accounts:unaCuenta.concat([{id:"sb2",ent:"sabadell",name:"Otra cuenta",value:100}])}],
]){
  test("hueco: "+nombre, ()=>{
    const s=estado(cambio);
    assert.equal(pagados(s),"","el recibo NO consta pagado");
    assert.equal(c.importObExpenses(s,extracto,[]),null,"y el sync tampoco lo deja en Gastos");
    assert.equal(historico(s),"dup/modeled dup/modeled","el histórico lo llama repetido");
    assert.equal(pagados(estado(Object.assign({},cambio,{expenses:importados}))),"com,mov","importarlo como gasto sí lo acredita");
  });
}

// Descartadas como causa de SU caso: con el cargo en el extracto sin contabilizar o repetido,
// importar la fila tampoco habría acreditado el recibo, y a él sí se lo acreditó.
for(const [nombre,bankTx] of [
  ["pendiente",extracto.map(t=>Object.assign({},t,{status:"PDNG"}))],
  ["sin estado",extracto.map(t=>Object.assign({},t,{status:""}))],
  ["dos filas iguales",extracto.concat(extracto.map(t=>Object.assign({},t)))],
]){
  test("descartada: extracto "+nombre, ()=>{
    assert.equal(pagados(estado({bankTx:bankTx})),"");
    assert.equal(pagados(estado({bankTx:bankTx,expenses:importados})),"");
  });
}

test("fijo + gasto importado del mismo cargo: cuenta dos veces solo si el banco es de gasto diario", ()=>{
  const cifras=(accounts,settings)=>{
    const medir=expenses=>{
      const s=estado({accounts:accounts,settings:settings||{},bankTx:[],expenses:expenses});
      const i=c.insumosSaldoGasto(s);
      return {gastado:c.monthBudgetStats(s).spent,
        saldo:c.saldoCuentaMostrada(s.accounts[0],{injTR:i.injTR,spentByBank:i.spentByBank,paidNetByBank:i.paidNetByBank,roundup:i.roundup,monthlyInvest:i.monthlyInvest})};
    };
    const antes=medir([]),despues=medir(importados);
    return {gastado:despues.gastado-antes.gastado,saldo:despues.saldo-antes.saldo};
  };
  // Su configuración: Sabadell solo para recibos. La fila queda en «De otros bancos» y no mueve nada.
  assert.deepEqual(cifras(unaCuenta),{gastado:0,saldo:0});
  // Banco «para todo»: el recibo ya restó por calendario y el gasto vuelve a restar.
  assert.deepEqual(cifras([{id:"sb",ent:"sabadell",role:"ambos",value:2000}]),{gastado:152,saldo:-152});
  // Banco de recibos añadido a los bancos de gasto: sube el gastado, el saldo no.
  assert.deepEqual(cifras(unaCuenta,{expenseBanks:["sabadell"]}),{gastado:152,saldo:0});
});
