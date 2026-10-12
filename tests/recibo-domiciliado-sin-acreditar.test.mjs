// Reporte del dueño (12/10/2026, beta 4.26.118.1): dos adeudos domiciliados de Sabadell que el
// banco YA había cobrado no estaban en Gastos ni marcaban pagado su recibo de Plan, e «Importar
// histórico» los enseñaba como repetidos sin marcar. Su decisión: «yo solo quiero que salga todo
// en gastos… si sale en recibos pero no en gastos la gente se rallará».
//
// Lo que se fija aquí:
//   · el cargo que casa con un recibo ENTRA en Gastos (sync diario e histórico) con `reciboId`;
//   · esa fila no mueve NINGUNA cifra, con el banco de recibos, «para todo» o de gasto diario:
//     el recibo ya resta por calendario y contarla sería restarlo dos veces;
//   · el recibo queda pagado por los caminos que ya había (cargo contabilizado o gasto del banco);
//   · lo que él ya importó a mano no se duplica, y la marca viaja de forma que una app vieja o el
//     servidor del widget la dejen fuera sin conocerla.
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
const unaCuenta=[{id:"sb",ent:"sabadell",role:"fijos",value:2000},{id:"tr",ent:"trade_republic",role:"diario",spendFrom:true,value:500}];
const estado=o=>Object.assign({accounts:unaCuenta,fixed:fijos,bankTx:[],debts:[],oneoffs:[],expenses:[],flows:[],settings:{}},o);
const pagados=s=>s.fixed.filter(f=>c.fixedPaymentState(s,f,2026,10,12).paid).map(f=>f.id).join(",");
const candidatos=txs=>txs.map(t=>({kind:"out",ent:t.ent,date:t.date,amount:t.amount,merchant:t.merchant,card:false,id:t.id}));
// Lo mismo que hace `runBankSync` con la respuesta del banco, sin red ni saldos.
function sincroniza(s,txs){
  const add=c.importObExpenses(s,txs,[])||[];
  const conExtracto=Object.assign({},s,{expenses:add.concat(s.expenses||[]),bankTx:txs});
  return {add:add,state:c.reconcileFixedPaymentProofs(conExtracto,2026,10,12)};
}

test("sync diario: el adeudo entra en Gastos enlazado a su recibo y el recibo queda pagado", ()=>{
  const r=sincroniza(estado(),extracto);
  assert.deepEqual([...r.add].map(e=>[e.merchant,e.amount,e.reciboId,e.source,e.extId]),[
    ["COMUNIDAD DE PROPIETARIOS",50,"com","ob","t1"],["Pepe Mobile, S.L.U.",102,"mov","ob","t2"]]);
  assert.equal(pagados(r.state),"com,mov");
  assert.equal(pagados(Object.assign({},r.state,{bankTx:[]})),"com,mov","sigue pagado en un móvil sin extracto");
  assert.deepEqual([...r.add].map(e=>c.expenseBucket(e,r.state)),["recibo","recibo"]);
  assert.equal(c.reciboNombre(r.state,r.add[0]),"Comunidad");
  assert.equal(sincroniza(r.state,extracto).add.length,0,"volver a sincronizar no repite la fila");
});

test("con dos cuentas de recibos en el banco el cargo ya no se pierde: entra y acredita por la fila", ()=>{
  const r=sincroniza(estado({accounts:unaCuenta.concat([{id:"sb2",ent:"sabadell",name:"Otra cuenta",value:100}])}),extracto);
  assert.equal(r.add.length,2);
  assert.equal(pagados(r.state),"com,mov");
});

test("Importar histórico: fila nueva y marcada, con su recibo; ya no «repetido» sin marcar", ()=>{
  const s=estado(),cands=candidatos(extracto);
  const rows=c.histClassifyCandidates(cands,s).rows;
  assert.deepEqual([...rows].map(r=>[r.status,r.reason,r.defDest,r.reciboId,r.match.name,r.suggestRecibo]),[
    ["new","recibo","gasto","com","Comunidad",false],["new","recibo","gasto","mov","Pepe Mobile, S.L.U.",false]]);
  const adds=c.histBuildCommit(cands,rows,s,{batchId:"hist-x"}).expAdds;
  assert.deepEqual([...adds].map(e=>[e.source,e.reciboId,e.extId]),[["ob-hist","com","t1"],["ob-hist","mov","t2"]]);
  const tras=estado({expenses:adds});
  assert.equal(pagados(tras),"com,mov","sin extracto local, la fila importada acredita el recibo");
  assert.ok(c.histClassifyCandidates(cands,tras).rows.every(r=>r.status==="dup"&&r.reason==="existing"),"y la segunda vez ya consta como apuntada");
});

test("lo que él importó a mano el 12/10 (sin marca) no se duplica en el siguiente sync", ()=>{
  const suyas=extracto.map((t,i)=>({id:"h"+i,date:new Date(t.date+"T12:00:00").toISOString(),merchant:t.merchant,amount:t.amount,category:"otros",source:"ob-hist",ent:t.ent,extId:t.id}));
  assert.equal(c.importObExpenses(estado({expenses:suyas}),extracto,[]),null,"mismo id del banco");
  const sinId=suyas.map(e=>{ const x=Object.assign({},e); delete x.extId; return x; });
  assert.equal(c.importObExpenses(estado({expenses:sinId}),extracto.map(t=>Object.assign({},t,{id:null})),[]),null,"sin id: día, importe y nombre");
});

// Dos bancos sembrados y tres roles. `antes` es lo que había hasta hoy (el cargo se tiraba);
// `despues`, el mismo estado con las filas dentro. Cada cifra se comprueba por dos vías.
const CAIXA={id:"luz",name:"Luz hogar",amount:61.4,freq:"mes",day:3,account:"caixabank"};
const TX_CAIXA={id:"c1",ent:"caixabank",date:"2026-10-03",amount:61.4,merchant:"LUZ HOGAR SL",status:"BOOK",card:false};
const control=ent=>({id:"ctl-"+ent,date:"2026-10-06T10:00:00.000Z",merchant:"Compra de control",amount:20,category:"otros",source:"ob",ent:ent,extId:"ctl-"+ent});
for(const [rol,accounts,settings] of [
  ["solo recibos",[{id:"sb",ent:"sabadell",role:"fijos",value:2000},{id:"cx",ent:"caixabank",role:"fijos",value:900},{id:"tr",ent:"trade_republic",role:"diario",spendFrom:true,value:500}]],
  ["para todo",[{id:"sb",ent:"sabadell",role:"ambos",value:2000},{id:"cx",ent:"caixabank",role:"fijos",value:900}],{expenseBanks:["caixabank"]}],
  ["gasto diario",[{id:"sb",ent:"sabadell",role:"diario",spendFrom:true,value:2000},{id:"cx",ent:"caixabank",role:"fijos",value:900}]],
]){
  test("ninguna cifra cuenta el recibo dos veces · Sabadell "+rol, ()=>{
    const antes=estado({accounts:accounts,settings:settings||{},fixed:fijos.concat([CAIXA]),expenses:[control("sabadell"),control("caixabank")]});
    const r=sincroniza(antes,extracto.concat([TX_CAIXA]));
    assert.equal(r.add.length,3,"los tres adeudos entran");
    const despues=r.state;
    const gastado=s=>c.monthBudgetStats(s).spent;
    // Segunda vía del gastado: sumar a mano lo que la lista pinta en el cajón «cuenta».
    const gastadoLista=s=>s.expenses.filter(e=>c.expenseBucket(e,s)==="cuenta").reduce((n,e)=>n+e.amount,0);
    const saldos=s=>{ const i=c.insumosSaldoGasto(s);
      return s.accounts.map(a=>c.saldoCuentaMostrada(a,{injTR:i.injTR,spentByBank:i.spentByBank,paidNetByBank:i.paidNetByBank,roundup:i.roundup,monthlyInvest:i.monthlyInvest})); };
    // Segunda vía del saldo: lo que los recibos restan por calendario, banco a banco.
    const netos=s=>["sabadell","caixabank"].map(ent=>c.monthNetForAccount(s,ent,2026,10,12));
    assert.equal(gastado(despues),gastado(antes));
    assert.equal(gastadoLista(despues),gastadoLista(antes));
    assert.equal(gastado(despues),gastadoLista(despues),"las dos vías del gastado dicen lo mismo");
    assert.deepEqual(saldos(despues),saldos(antes));
    assert.deepEqual(netos(despues),netos(antes));
    assert.deepEqual(netos(despues),[-152,-61.4],"y el recibo sigue restando una vez");
    assert.equal(c.planChargesMonth(despues,10,2026,12).pendingBillsTotal,0,"los tres salen pagados en Plan");
    // La medida no está ciega: quitar la marca hace que esa fila cuente donde el banco cuenta.
    const sinMarca=Object.assign({},despues,{expenses:despues.expenses.map(e=>{ const x=Object.assign({},e); delete x.reciboId; return x; })});
    const cuentaSabadell=rol!=="solo recibos",cuentaCaixa=rol==="para todo";
    assert.equal(+(gastado(sinMarca)-gastado(despues)).toFixed(2),(cuentaSabadell?152:0)+(cuentaCaixa?61.4:0));
  });
}

test("la marca viaja en `source` y quien no la conoce deja la fila fuera", ()=>{
  const fila=fuente=>({id:"11111111-1111-4111-8111-111111111111",fecha:"2026-10-05T10:00:00.000Z",comercio:"Pepe Mobile, S.L.U.",importe:102,cat:"otros",source:fuente});
  for(const [origen,fuente] of [["ob","ob:sabadell~recibo.mov"],["ob-hist","ob-hist:sabadell~recibo.mov"]]){
    const e={id:"x",date:"2026-10-05T10:00:00.000Z",merchant:"Pepe Mobile, S.L.U.",amount:102,category:"otros",source:origen,ent:"sabadell",reciboId:"mov"};
    assert.equal(c.expenseSourceForCloud(e),fuente);
    const vuelta=c.expenseFromRow(fila(fuente));
    assert.deepEqual([vuelta.source,vuelta.ent,vuelta.reciboId,c.expenseBankOf({source:fuente})],[origen,"sabadell","mov","sabadell"]);
    // Así lee el banco la beta 4.26.118 ya instalada y el servidor del widget
    // (`bancoDeSource`): un banco que no existe, que ninguna lista de gasto diario contiene.
    const bancoViejo=fuente.slice(fuente.indexOf(":")+1).split("#")[0].split("~deuda.")[0];
    assert.equal(bancoViejo,"sabadell~recibo.mov");
  }
  const dup=c.expenseSourceForCloud({source:"ob",ent:"sabadell",reciboId:"mov",possibleDup:true});
  assert.equal(dup,"ob:sabadell~recibo.mov#dup");
  assert.deepEqual([c.expenseFromRow(fila(dup)).reciboId,c.expenseFromRow(fila(dup)).possibleDup],["mov",true]);
  assert.equal(c.expenseFromRow(fila("ob:sabadell~deuda.d1")).debtId,"d1","la cuota de deuda no cambia");
  assert.equal(c.expenseFromRow(fila("ob:sabadell")).reciboId,undefined);
});

test("un cargo marcado como recibo no se convierte además en cuota ni en suscripción propuesta", ()=>{
  const deuda={id:"d1",name:"Pepe Mobile financiación",monthly:102,day:5,account:"sabadell",value:1000};
  const r=sincroniza(estado({debts:[deuda]}),extracto);
  assert.equal(c.cuotasDeDeudaPorMarcar(r.state).length,0,"si casa con recibo y con deuda, gana el recibo");
  const tresMeses=["08","09","10"].map((m,i)=>({id:"s"+i,date:"2026-"+m+"-05T10:00:00.000Z",merchant:"Pepe Mobile, S.L.U.",amount:102,category:"otros",source:"ob",ent:"sabadell",reciboId:"mov"}));
  assert.equal(c.detectSubscriptions(tresMeses).length,0);
  assert.equal(c.detectSubscriptions(tresMeses.map(e=>Object.assign({},e,{reciboId:undefined}))).length,1,"sin marca sí se detecta: el control");
});

test("un recibo sin id no tiene a qué enlazarse: se queda como antes para no contarlo dos veces", ()=>{
  const s=estado({fixed:fijos.map(f=>Object.assign({},f,{id:undefined}))});
  assert.equal(c.importObExpenses(s,extracto,[]),null);
  assert.ok(c.histClassifyCandidates(candidatos(extracto),s).rows.every(r=>r.status==="dup"&&r.reason==="modeled"));
});
