// Seis defectos de sincronización entre móviles y de recibos, hallados en la última revisión de la
// 4.26.122 (13/10/2026). Cada caso reproduce el defecto con datos sintéticos y falla sin su arreglo:
//   1. el estado más antiguo de otro móvil deshacía el borrado de un recibo (gastado 40 en uno y
//      102,40 en el otro y en el widget);
//   2. deshacer un «no es este recibo» sobre uno de dos cargos iguales de un recibo fijo no hacía nada;
//   3. un apunte con id del banco y otro idéntico sin él entraban con la MISMA clave (son un cargo);
//   4. el segundo pull devolvía la categoría y la tarjeta del aviso a una fila que él había cambiado;
//   5. las lápidas viajaban por «último que escribe», y unirlas a secas haría irreversible «Deshacer»;
//   6. editar un gasto lanzaba el borrado y el alta a la vez: `23505` y la nube sin el gasto.
// Y los de la revisión de aquel arreglo: «Deshacer» el borrado de un recibo, versiones mezcladas,
// editar 10 → 12 → 10 (el gasto desaparecía) y editar sin conexión.
// Los bloques de pantalla se ejecutan sacados del bundle servido (`public/index.html`).
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import { transformSync } from "esbuild";
import { loadPureLogic, extractPureLogicSource, createLogicSandbox } from "../scripts/load-pure-logic.mjs";

const source=file=>fs.readFileSync(new URL("../"+file,import.meta.url),"utf8");
const order=JSON.parse(source("src/build-order.json"));
const js=order.map(file=>source("src/modules/"+file)).join("\n");
const c=loadPureLogic(source("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>js));
vm.runInNewContext(source("src/modules/14-v4-screens.js"),c);
const bundle=source("public/index.html");
const { statsDelMes }=await import("data:text/javascript;base64,"+Buffer.from(transformSync(source("supabase/functions/_shared/presupuesto.ts"),{loader:"ts",format:"esm"}).code).toString("base64"));
const OCT12=new Date("2026-10-12T18:00:00+02:00").getTime();
let ahora=OCT12;
c.Date=class extends Date { constructor(...a){ super(...(a.length?a:[ahora])); } static now(){ return ahora; } };
const clon=x=>JSON.parse(JSON.stringify(x));
const j=x=>JSON.stringify(x);

const F=(id,name,amount,day,account)=>({id,name,amount,freq:"mes",day,account});
const T=(id,ent,date,amount,merchant,extra)=>Object.assign({ext_id:id,ent,date,amount,merchant,status:"BOOK",card:false},extra||{});
const ASPSP={sabadell:"Banco de Sabadell",trade_republic:"Trade Republic",bbva:"BBVA"};
const enlaces=(txs,saldos)=>Object.keys(saldos).map(ent=>({aspsp:ASPSP[ent]||ent,ok:true,
  accounts:[{uid:ent,ok:true,balances:[{type:"ITAV",amount:saldos[ent],currency:"EUR"}],transactions:txs.filter(t=>t.ent===ent)}]}));
const estado=o=>Object.assign({accounts:[{id:"a",ent:"bbva",role:"ambos",spendFrom:true,value:900}],investments:[],fixed:[],bankTx:[],debts:[],oneoffs:[],expenses:[],flows:[],settings:{},deleted:[],budget:800,assets:[],aportaciones:[]},o);
// Lo mismo que hace `runBankSync` con la respuesta: importar, guardar extracto y pruebas, anclar.
function sincroniza(s,txs,saldos){
  const links=enlaces(txs,saldos),flat=c.flattenBankTx(links);
  const add=c.importObExpenses(s,flat,links)||[];
  const conTx=Object.assign({},s,{expenses:add.concat(s.expenses||[]),bankTx:flat});
  const hoy=new Date(ahora);
  const probado=c.reconcileFixedPaymentProofs(conTx,hoy.getFullYear(),hoy.getMonth()+1,hoy.getDate());
  return {add:[...add],state:c.applyBankBalances(probado,links).state};
}
const gastado=s=>+c.monthBudgetStats(s).spent.toFixed(2);
const gastadoMes=(s,ym)=>+s.expenses.filter(e=>String(e.date).slice(0,7)===ym&&c.expenseCountsBudget(e,s)&&e.amount>0).reduce((n,e)=>n+e.amount,0).toFixed(2);
const mostrado=s=>{ const i=c.insumosSaldoGasto(s);
  return s.accounts.map(a=>+c.saldoCuentaMostrada(a,{injTR:i.injTR,spentByBank:i.spentByBank,paidNetByBank:i.paidNetByBank,roundup:i.roundup,monthlyInvest:i.monthlyInvest}).toFixed(2)); };
// La fila tal como sube a la tabla `expenses`, y el estado tal como sube a `app_state`.
const fila=e=>({id:e.id,user_id:"u1",fecha:e.date,importe:e.amount,comercio:e.merchant,cat:e.category,source:c.expenseSourceForCloud(e),ob_name:e.obName,no_card:!!e.noCard,nota:e.note||null,nota_edit:!!e.noteEdited});
const sube=(s,savedAt)=>{ const x=clon(c.slimForCloud(s)); if(savedAt!=null) x._savedAt=savedAt; return x; };

// El bloque REAL con el que App aplica el estado que baja de la nube (`syncFromCloud`).
const mBaja=/const merged=mergeExpenses\(prev\.expenses,\s*cloudState\.expenses\|\|\[\]\);[\s\S]*?if\(freshLogin\s*&&\s*\(cloudState\.accounts/.exec(bundle);
assert.ok(mBaja,"no se encuentra el bloque de último-que-escribe en syncFromCloud");
const bloqueBaja=vm.runInContext("(function(prev,cloudState,freshLogin,opts,sessionRef,u){"+mBaja[0].replace(/if\(freshLogin\s*&&\s*\(cloudState\.accounts$/,"")+"\nreturn baseObj;})",c);
const baja=(prev,nube,freshLogin)=>bloqueBaja(prev,nube,!!freshLogin,null,{current:{user:{id:"u1"}}},"u1");

const viejo=(ym,imp,rec)=>({id:"v-"+ym+"-"+imp,date:ym+"-05T10:00:00.000Z",merchant:rec?"ENDESA ENERGIA XXI":"CARREFOUR",obName:rec?"ENDESA ENERGIA XXI":"CARREFOUR",amount:imp,category:rec?"recibos":"super",source:"ob",ent:"bbva",extId:"x-"+ym+"-"+imp,reciboId:rec?"luz":undefined});
const TXS_LUZ=[T("o1","bbva","2026-10-05",62.4,"ENDESA ENERGIA XXI"),T("o2","bbva","2026-10-07",40,"CARREFOUR",{card:true})];
// Luz y gimnasio en el Plan, septiembre ya cerrado y octubre con el cargo de la luz y una compra.
const conLuz=rol=>Object.assign(sincroniza(estado({accounts:[{id:"a",ent:"bbva",role:rol,spendFrom:true,value:900}],fixed:[F("luz","Luz Endesa",62.4,5,"bbva"),F("gim","Gimnasio",30,20,"bbva")],expenses:[viejo("2026-09",62.4,true),viejo("2026-09",35,false)]}),TXS_LUZ,{bbva:797.6}).state,{_savedAt:OCT12-5*86400000});

for(const rol of ["ambos","diario"]) test("1 · el borrado de un recibo sobrevive al estado más antiguo de otro móvil: los dos móviles y el widget dicen lo mismo · banco "+rol, ()=>{
  const comun=conLuz(rol);
  const foto=s=>j([gastadoMes(s,"2026-09"),gastadoMes(s,"2026-10"),s.fixed.map(f=>f.id),Object.keys(s.reciboBorrado||{})]);
  assert.equal(foto(comun),j([35,40,["luz","gim"],[]]));
  // A borra el recibo: su cargo de octubre pasa a contar y pierde la marca en la tabla.
  const A=Object.assign({},c.sinCargoDelPlan(comun,"fixed","luz").state,{_savedAt:OCT12});
  assert.equal(foto(A),j([35,102.4,["gim"],["luz"]]));
  const tabla=A.expenses.map(fila);
  const widget=s=>+statsDelMes(tabla.filter(f=>String(f.fecha).slice(0,7)==="2026-10"),s,new Date("2026-10-01T00:00:00+02:00").getTime()).spent.toFixed(2);
  assert.equal(widget(A),102.4);
  // B lleva días sin abrirse, pero su primer guardado al arrancar lo sella como «más nuevo».
  const B0=Object.assign(clon(comun),{_savedAt:OCT12+1000});
  const conTabla=s=>Object.assign({},s,{expenses:c.mergeExpensesFromCloud(s.expenses,tabla.map(c.expenseFromRow),ahora).list});
  const B=conTabla(baja(B0,sube(A)));
  assert.equal(foto(B),foto(A),"sin la unión B se quedaba en 40 con el recibo de vuelta en el Plan");
  assert.equal(gastado(B),widget(B),"y el widget dice lo mismo que B");
  assert.equal(j(mostrado(B)),j(mostrado(B0)),"el saldo pintado de B no se mueve con el banco quieto");
  // B sube su estado, que es el que gana, y A lo baja: el recibo no vuelve tampoco allí.
  const A2=baja(A,sube(B,OCT12+2000));
  assert.equal(foto(A2),foto(A));
  // Una nube que ya no trae la marca (la pisó un móvil con la versión anterior) no la borra de aquí.
  const sinMarca=sube(comun,OCT12+3000);
  assert.equal(foto(conTabla(baja(A,sinMarca))),foto(A));
  // Volver a crear el recibo le da otro id: ese no se toca. Ni lo demás del Plan.
  const recreado=Object.assign({},B,{fixed:B.fixed.concat([F("luz2","Luz Endesa",62.4,5,"bbva")]),_savedAt:OCT12+4000});
  assert.equal(j(baja(recreado,sube(A)).fixed.map(f=>f.id)),j(["gim","luz2"]));
  // Sin nada que unir, el estado sale con sus mismas listas.
  const quieto=baja(Object.assign({},A,{_savedAt:OCT12+5000}),sube(A));
  assert.equal(quieto.fixed,A.fixed);
  assert.equal(quieto.reciboBorrado,A.reciboBorrado);
  assert.equal(c.recibosBorradosUnion(A,A,sube(A)),A,"ni se crea un estado nuevo");
});

for(const rol of ["ambos","diario"]) test("1 · «Deshacer» el borrado de un recibo lo deja como estaba, y el siguiente arranque no lo vuelve a quitar · banco "+rol, ()=>{
  const antes=conLuz(rol);
  const foto=s=>j([gastadoMes(s,"2026-09"),gastadoMes(s,"2026-10"),s.fixed.map(f=>f.id).sort(),s.expenses.filter(e=>e.reciboId).length,Object.keys(s.reciboBorrado||{})]);
  assert.equal(foto(antes),j([35,40,["gim","luz"],2,[]]));
  // Las puertas de Plan: `removeWithUndo` guarda el recibo y lo borra; `undoLastBill` lo devuelve con su MISMO id.
  let s=antes; const set=f=>{ s=f(s); };
  const guardado=Object.assign({},antes.fixed.find(f=>f.id==="luz"));
  c.removeFixedById(set,"luz");
  const borrado=s;
  assert.equal(foto(borrado),j([35,102.4,["gim"],1,["luz"]]));
  ahora=OCT12+3000;
  try{
    c.addFixedItem(set,guardado);
    assert.equal(foto(s),foto(antes),"el cargo de octubre vuelve a ser el de su recibo: antes se quedaba contando (102,40)");
    assert.equal(j(mostrado(s)),j(mostrado(antes)),"y el saldo pintado es el de antes de borrar");
    assert.equal(s.reciboBorradoAt.luz,OCT12+3000);
    // Un solo móvil: baja su propio estado en el siguiente arranque, en frío o no. El recibo sigue.
    const mio=Object.assign({},s,{_savedAt:OCT12+3000,_historyOwner:"u1"});
    assert.equal(foto(baja(Object.assign({},mio,{_savedAt:OCT12+9000}),sube(mio))),foto(antes));
    assert.equal(foto(baja(mio,sube(mio),true)),foto(antes));
    // Y una nube que aún trae el borrado (se subió antes del «Deshacer») no lo vuelve a quitar…
    assert.equal(foto(baja(Object.assign({},mio,{_savedAt:OCT12+9000}),sube(borrado,OCT12+1))),foto(antes));
    // …ni al revés: quien tenía el borrado y baja el «Deshacer» deja de darlo por borrado.
    assert.equal(j(Object.keys(baja(Object.assign({},borrado,{_savedAt:OCT12+9000}),sube(mio)).reciboBorrado)),j([]));
  } finally { ahora=OCT12; }
  // Con el reloj de este móvil atrasado, el «Deshacer» sigue siendo posterior al borrado.
  const tarde=c.conReciboEnPlan(borrado,"fixed",guardado,OCT12-86400000);
  assert.equal(tarde.state.reciboBorradoAt.luz,borrado.reciboBorradoAt.luz+1);
  // Lo que sube a la nube al deshacer: la fila de octubre, otra vez con su marca.
  assert.equal(j(tarde.subir.map(e=>[String(e.date).slice(0,7),c.expenseSourceForCloud(e)])),j([["2026-10","ob:bbva~recibo.luz"]]));
  // Un alta cualquiera (id nuevo) es solo añadir: ni marcas ni horas.
  const alta=c.conReciboEnPlan(borrado,"fixed",F("nuevo","Luz Endesa",62.4,5,"bbva"));
  assert.equal(j([alta.subir.length,alta.state.fixed.map(f=>f.id),alta.state.reciboBorradoAt===borrado.reciboBorradoAt,alta.state.expenses===borrado.expenses]),j([0,["gim","nuevo"],true,true]));
});

test("1 · todo borrado deja constancia: sin cargos marcados, un puntual, y lo que no vale", ()=>{
  const itv={id:"itv",name:"ITV coche",amount:45,account:"bbva",month:10,year:2026,day:9};
  const comun=Object.assign(estado({fixed:[F("gim","Gimnasio",30,20,"bbva"),F("net","Netflix",12.99,28,"bbva")],oneoffs:[itv]}),{_savedAt:OCT12-5*86400000});
  // Netflix no tenía ningún cargo en Gastos: antes no dejaba rastro y volvía desde el móvil atrasado.
  let A=Object.assign({},c.sinCargoDelPlan(comun,"fixed","net").state,{_savedAt:OCT12});
  A=Object.assign({},c.sinCargoDelPlan(A,"oneoffs","itv").state,{_savedAt:OCT12});
  assert.equal(j([Object.keys(A.reciboBorrado).sort(),A.reciboBorrado.net.n,typeof A.reciboBorradoAt.net]),j([["itv","net"],"Netflix","number"]));
  const B=baja(Object.assign(clon(comun),{_savedAt:OCT12+1000}),sube(A));
  assert.equal(j([B.fixed.map(f=>f.id),B.oneoffs.length]),j([["gim"],0]),"ni el recibo ni el puntual vuelven");
  // Una entrada sin fecha (estado dañado o de otra forma) no borra nada.
  const rara=baja(Object.assign(clon(comun),{_savedAt:OCT12+1000}),Object.assign(sube(comun,OCT12),{reciboBorrado:{gim:{n:"Gimnasio"}}}));
  assert.equal(j(rara.fixed.map(f=>f.id)),j(["gim","net"]));
  // Borrar algo que ya no está no toca el estado.
  assert.equal(c.sinCargoDelPlan(A,"fixed","net").state,A);
});

test("2 · deshacer «no es este recibo» sobre uno de dos cargos iguales de un recibo FIJO cumple lo que dice su diálogo", ()=>{
  const s0=estado({accounts:[{id:"tr",ent:"trade_republic",role:"ambos",spendFrom:true,value:500}],fixed:[F("spo","Spotify",10.99,5,"trade_republic")]});
  const igual=T(null,"trade_republic","2026-10-05",10.99,"Spotify",{card:true});
  const r=sincroniza(s0,[igual,Object.assign({},igual)],{trade_republic:478.02}).state;
  assert.equal(j([r.expenses.map(e=>[e.reciboId,e.obOrd||1]).sort(),gastado(r)]),j([[["spo",1],["spo",2]],0]));
  const f=r.fixed[0];
  for(const tocada of r.expenses){
    const q=c.quitarCargoDeRecibo(r,tocada.id,OCT12);
    assert.equal(gastado(q.state),10.99);
    const x=q.state.expenses.find(e=>e.id===tocada.id);
    // Lo que mira la ficha para ofrecer «Confirmar pago» con el texto «…aquí no suma otra vez».
    assert.equal(c.reciboNoDe(q.state,"spo",c.reciboNoIdentidad(x),x.id).length>0&&c.admiteMarcaDe(x,f),true);
    const esperado={identity:c.fixedPaymentIdentity(c.expenseBankOf(x),x),model:c.fixedPaymentModel(f,10)};
    const rp=c.reponerCargoDeRecibo(q.state,x.id,"spo",2026,10,12,esperado,OCT12+60000);
    assert.ok(rp,"no hacía nada: el motor no elige entre dos iguales y el vínculo no se guarda (ordinal "+(tocada.obOrd||1)+")");
    assert.equal(j([gastado(rp.state),rp.state.reciboNo.length,rp.e.reciboId,c.expenseSourceForCloud(rp.e)]),j([0,0,"spo",c.expenseSourceForCloud(tocada)]));
    assert.equal(j(mostrado(rp.state)),j(mostrado(q.state)),"sin mover el saldo");
    assert.equal(j(rp.state.expenses.map(e=>e.reciboId)),j(r.expenses.map(e=>e.reciboId)),"queda como antes del veto");
    // El otro cargo igual no tenía veto: sobre él no hay nada que deshacer.
    const otra=q.state.expenses.find(e=>e.id!==tocada.id);
    assert.equal(c.reponerCargoDeRecibo(q.state,otra.id,"spo",2026,10,12,null,OCT12+60000),null);
    // Si la fila cambió mientras el diálogo estaba abierto, no se toca.
    assert.equal(c.reponerCargoDeRecibo(q.state,x.id,"spo",2026,10,12,{identity:"otra",model:esperado.model},OCT12+60000),null);
  }
  // Y con el recibo movido a otro banco la marca no puede volver: el veto se queda.
  const q=c.quitarCargoDeRecibo(r,r.expenses[0].id,OCT12);
  const mudado=Object.assign({},q.state,{fixed:[Object.assign({},f,{account:"sabadell"})]});
  assert.equal(c.reponerCargoDeRecibo(mudado,r.expenses[0].id,"spo",2026,10,12,null,OCT12+60000),null);
});

test("2 · la ficha ofrece el recibo fijo vetado para ese cargo aunque no admita vínculo a mano (el bloque REAL de la ficha)", ()=>{
  const m=/const vetadoAqui=function\(r\)\{[\s\S]*?const receiptOptions=\(state\.fixed\|\|\[\]\)\.filter\(function\(f\)\{[\s\S]*?\}\);/.exec(bundle);
  assert.ok(m,"no se encuentran las opciones de «Paga un recibo» en la ficha");
  const opciones=vm.runInContext("(function(state,exp,receiptYear,receiptMonth,receiptToday,receiptLinked){"+m[0]+"\nreturn receiptOptions.map(function(f){ return f.id; });})",c);
  const s0=estado({accounts:[{id:"tr",ent:"trade_republic",role:"ambos",spendFrom:true,value:500}],fixed:[F("spo","Spotify",10.99,5,"trade_republic"),F("gim","Gimnasio",30,20,"trade_republic")]});
  const igual=T(null,"trade_republic","2026-10-05",10.99,"Spotify",{card:true});
  const r=sincroniza(s0,[igual,Object.assign({},igual)],{trade_republic:478.02}).state;
  const q=c.quitarCargoDeRecibo(r,r.expenses[0].id,OCT12).state;
  const tocada=q.expenses.find(e=>e.id===r.expenses[0].id), otra=q.expenses.find(e=>e.id!==r.expenses[0].id);
  assert.equal(c.fixedExpenseEligible(q,tocada,q.fixed[0],2026,10,12),false,"el control: con dos iguales no hay vínculo a mano posible");
  assert.equal(j(opciones(q,tocada,2026,10,12,null)),j(["spo"]));
  assert.equal(j(opciones(q,otra,2026,10,12,null)),j([]),"al cargo que no se vetó no se le ofrece");
});

test("3 · un apunte con id del banco y otro idéntico sin él son EL MISMO cargo: entra una fila, la del id, llegue como llegue", ()=>{
  const s0=o=>estado(Object.assign({accounts:[{id:"sb",ent:"sabadell",role:"ambos",spendFrom:true,value:500}]},o));
  const id=T("c1","sabadell","2026-10-06",7.5,"Panadería Sol",{card:true}), sin=T(null,"sabadell","2026-10-06",7.5,"Panadería Sol",{card:true});
  const pend=Object.assign({},sin,{status:"PDNG"});
  // [gastado, [id del banco, ordinal] de cada fila]: lo que queda tras cada serie de sincronizaciones.
  const queda=(series,o)=>{ let s=s0(o); const entran=[]; for(const txs of series){ const r=sincroniza(s,txs,{sabadell:480}); s=r.state; entran.push(r.add.length); }
    assert.equal(new Set(s.expenses.map(c.keyOfExpense)).size,s.expenses.length,"nunca dos filas con la misma clave");
    return j([gastado(s),s.expenses.map(e=>[e.extId||null,e.obOrd||1]).sort(),entran]); };
  const una=j([7.5,[["c1",1]],[1]]);
  // En una sincronización, en los dos órdenes (antes: dos filas con la misma clave, 15, o una).
  assert.equal(queda([[id,sin]]),una);
  assert.equal(queda([[sin,id]]),una);
  assert.equal(queda([[id,pend]]),una,"el mismo cargo asentándose");
  assert.equal(queda([[Object.assign({},id,{status:"PDNG"}),sin]]),una);
  // En dos: la fila que entró primero es la que se queda, y la segunda vez no entra nada.
  assert.equal(queda([[id],[id,sin]]),j([7.5,[["c1",1]],[1,0]]));
  assert.equal(queda([[sin],[id,sin]]),j([7.5,[[null,1]],[1,0]]));
  assert.equal(queda([[id,sin],[sin,id],[id,sin]]),j([7.5,[["c1",1]],[1,0,0]]));
  // Recuento mínimo coherente: dos con id y uno sin id, una (los de id ya se fundían por clave);
  // uno con id y dos sin id, dos (el de id es el primero de los iguales).
  assert.equal(queda([[id,Object.assign({},id,{ext_id:"c2"}),sin]]),una);
  assert.equal(queda([[id,sin,Object.assign({},sin)]]),j([15,[[null,2],["c1",1]],[2]]));
  assert.equal(queda([[sin,Object.assign({},sin),id]]),j([15,[[null,2],["c1",1]],[2]]));
  // Lo borrado por él no vuelve como «segundo».
  const borra=(txs1,txs2)=>{ let s=sincroniza(s0(),txs1,{sabadell:480}).state; const e=s.expenses[0];
    s=Object.assign({},s,{expenses:[]},c.lapidaPon(s,c.keyOfExpense(e))); return sincroniza(s,txs2,{sabadell:480}).add.length; };
  assert.equal(j([borra([id],[id,sin]),borra([sin],[id,sin]),borra([id,sin],[sin,id])]),j([0,0,0]));
  // Un recibo: una fila marcada, y «No es este recibo» ya no puede soltar dos.
  const rec={fixed:[F("spo","Spotify",10.99,5,"sabadell")]};
  const rid=T("x1","sabadell","2026-10-05",10.99,"Spotify"), rsin=T(null,"sabadell","2026-10-05",10.99,"Spotify");
  const r=sincroniza(s0(rec),[rid,rsin],{sabadell:480}).state;
  assert.equal(j(r.expenses.map(e=>[e.extId,e.reciboId,c.expenseSourceForCloud(e)])),j([["x1","spo","ob:sabadell~recibo.spo"]]));
  assert.equal(gastado(c.quitarCargoDeRecibo(r,r.expenses[0].id,OCT12).state),10.99);
  // Una nómina con id y su abono idéntico sin id: 1.800, no 3.600.
  const nid=T("n1","sabadell","2026-10-01",-1800,"NOMINA ACME"), nsin=T(null,"sabadell","2026-10-01",-1800,"NOMINA ACME");
  const ingresos=txs=>sincroniza(s0(),txs,{sabadell:2300}).state.expenses.map(e=>[e.extId||null,e.amount]);
  assert.equal(j(ingresos([nid,nsin])),j([["n1",-1800]]));
  assert.equal(j(ingresos([nsin,nid])),j([["n1",-1800]]));
  // …pero un abono con id todavía PENDIENTE no se apunta, así que no puede tapar al contabilizado sin id.
  assert.equal(j(ingresos([Object.assign({},nid,{status:"PDNG"}),nsin])),j([[null,-1800]]));
  // Y sin ningún apunte con id nada cambia: los iguales siguen llevando 1, 2, 3.
  assert.equal(queda([[sin,Object.assign({},sin),Object.assign({},sin)]]),j([22.5,[[null,1],[null,2],[null,3]],[3]]));
});

test("4 · lo que él eligió en la fila (categoría, «no tarjeta») no lo pisa el segundo pull, venga la nube en el orden que venga", ()=>{
  const s0=estado({accounts:[{id:"tr",ent:"trade_republic",role:"ambos",spendFrom:true,value:500}],fixed:[F("spo","Spotify",10.99,5,"trade_republic")]});
  const banco=sincroniza(s0,[T("x1","trade_republic","2026-10-05",10.99,"Spotify",{card:true})],{trade_republic:489.01}).state;
  const suya=Object.assign({},banco.expenses[0],{category:"super",note:"la de casa",noteEdited:true,noCard:true});
  const aviso={id:"11111111-1111-4111-8111-111111111111",user_id:"u1",fecha:"2026-10-05T09:31:00.000Z",importe:10.99,comercio:"Spotify",cat:"ocio",source:"macrodroid",ingest_event_id:"ev1"};
  for(const primero of ["cargo","aviso"]){
    const nube={cargo:fila(suya),aviso:clon(aviso)};
    const filas=()=>(primero==="cargo"?[nube.cargo,nube.aviso]:[nube.aviso,nube.cargo]).map(c.expenseFromRow);
    let lista=[suya];
    for(let pull=1;pull<=3;pull++){
      const m=c.mergeExpensesFromCloud(lista,filas(),ahora);
      lista=m.list;
      // App reescribe en la nube la fila del banco sin la marca (`sinMarca`).
      m.sinMarca.forEach(x=>{ nube.cargo.source=c.expenseSourceForCloud(x); });
      assert.equal(j([lista.length,lista[0].id,lista[0].source,lista[0].category,lista[0].noCard||false,lista[0].note]),
        j([1,suya.id,"macrodroid","super",true,"la de casa"]),"pull "+pull+", primero "+primero);
    }
    // Con la nube ya limpia y nada que cambiar, la lista sale tal cual: no se reescribe el histórico.
    const quieto=c.mergeExpensesFromCloud(lista,filas(),ahora);
    assert.equal(j([quieto.changed,quieto.list[0]===lista[0]]),j([false,true]));
    // Lo que otro móvil cambió en SU fila de la nube sí baja, llegue esa fila delante o detrás del aviso.
    nube.cargo.cat="viajes"; nube.cargo.no_card=false;
    const otro=c.mergeExpensesFromCloud(lista,filas(),ahora).list[0];
    assert.equal(j([otro.category,otro.noCard||false]),j(["viajes",false]),"la fila de su mismo id manda, primero "+primero);
  }
  // Sin ninguna fila con su id (la subió otro móvil), refresca la primera, como siempre.
  const ajena=Object.assign({},suya,{id:"local-1",source:"macrodroid",reciboId:undefined});
  const otra=c.mergeExpensesFromCloud([ajena],[aviso,Object.assign(fila(suya),{source:"ob:trade_republic"})].map(c.expenseFromRow),ahora);
  assert.equal(otra.list[0].category,"ocio");
});

test("5 · las lápidas se unen entre móviles, y «Deshacer» sigue teniendo vuelta atrás", ()=>{
  const base=o=>Object.assign({accounts:[],investments:[],debts:[],fixed:[],expenses:[]},o);
  // Unión, gane el estado que gane. Antes solo quedaba la lista del que llegaba el último.
  const local=base({_savedAt:10,deleted:["k-b"],gemelos:[{aviso:"av1",banco:"b1"}]}), nube=base({_savedAt:5,deleted:["k-a"],gemelos:[{aviso:"av2",banco:"b2"}]});
  for(const savedAt of [10,1]){
    const r=baja(Object.assign({},local,{_savedAt:savedAt}),nube);
    assert.equal(j([r.deleted,r.gemelos.map(g=>g.banco)]),j([["k-b","k-a"],["b1","b2"]]),"local "+(savedAt>5?"más nuevo":"más viejo"));
  }
  // Sin nada nuevo en la nube, la lista es LA MISMA: la leen los `useMemo` de Gastos y de los totales.
  const quieto=baja(local,base({_savedAt:5,deleted:["k-b"]}));
  assert.equal(quieto.deleted,local.deleted);
  // Las de OTRA cuenta que hubo en este móvil no se mezclan con las de esta.
  assert.equal(j(baja(base({_savedAt:10,_historyOwner:"otra",deleted:["k-ajena"]}),nube,true).deleted),j(["k-a"]));

  // A borra, la lápida sube, B la baja; A pulsa «Deshacer». El gasto no puede quedarse escondido.
  const e={id:"22222222-2222-4222-8222-222222222222",date:"2026-10-07T10:00:00.000Z",merchant:"CARREFOUR",amount:40,category:"super",source:"ob",ent:"bbva",obName:"CARREFOUR"};
  const key=c.keyOfExpense(e), tiene=s=>(s.deleted||[]).indexOf(key)>=0;
  const A0=base({_savedAt:1,deleted:[],expenses:[e]});
  const A1=Object.assign({},A0,{expenses:[]},c.lapidaPon(A0,key,100),{_savedAt:100});
  const B1=baja(Object.assign({},A0,{_savedAt:50}),sube(A1));
  assert.equal(j([tiene(A1),tiene(B1),A1.deletedAt[key],B1.deletedAt[key]]),j([true,true,100,100]),"la lápida nace con su hora y viaja con ella");
  const A2=Object.assign({},A1,{expenses:[e]},c.lapidaLevanta(A1,key,200),{_savedAt:200});
  assert.equal(tiene(A2),false);
  // B guarda algo (queda «más nuevo» que la nube) y baja el estado de A: la lápida se levanta también en B…
  const B2=baja(Object.assign({},B1,{_savedAt:300}),sube(A2));
  assert.equal(tiene(B2),false,"unir sin hora dejaba la lápida en B");
  // …y cuando A baja el de B, no vuelve. El gasto cuenta en los dos.
  const A3=baja(A2,sube(B2,400));
  assert.equal(j([tiene(A3),c.expenseCountsBudget(e,Object.assign({},A3,{accounts:[{id:"a",ent:"bbva",role:"ambos",spendFrom:true,value:1}]}))]),j([false,true]));
  // Volver a borrarlo después gana al «Deshacer» de antes, también en el otro móvil.
  const A4=Object.assign({},A3,{expenses:[]},c.lapidaPon(A3,key,500),{_savedAt:500});
  assert.equal(tiene(baja(Object.assign({},B2,{_savedAt:600}),sube(A4))),true);
  // Con el reloj atrasado, lo que se dice ahora sigue siendo posterior a lo que constaba.
  assert.equal(c.lapidaLevanta(A1,key,7).deletedAt[key],101,"«Deshacer»");
  assert.equal(c.lapidaPon(A2,key,7).deletedAt[key],201,"volver a borrar");
  assert.equal(tiene(baja(Object.assign({},A2,c.lapidaPon(A2,key,7),{_savedAt:700}),sube(A2))),true);

  // VERSIONES MEZCLADAS. Un móvil con la versión anterior borra ese gasto DESPUÉS del «Deshacer»:
  // su lápida no lleva hora, pero su estado se guardó más tarde. Gana el borrado…
  const viejo=base({_savedAt:900,deleted:[key]});
  assert.equal(tiene(baja(A2,viejo)),true,"antes: «una hora frente a ninguna gana la hora» y el gasto volvía");
  assert.equal(tiene(baja(Object.assign({},A2,{_savedAt:950}),viejo)),true,"también con lo local más nuevo");
  // …y si ese estado se guardó ANTES del «Deshacer», gana el «Deshacer».
  assert.equal(tiene(baja(A2,base({_savedAt:150,deleted:[key]}))),false);
  // Al revés: la lápida sin hora es de aquí (este móvil acaba de actualizarse) y el «Deshacer» viene de la nube.
  assert.equal(tiene(baja(base({_savedAt:900,deleted:[key]}),sube(A2))),true);
  assert.equal(tiene(baja(base({_savedAt:150,deleted:[key]}),sube(A2),true)),false);

  // Topes: 500 lápidas y 200 horas. La recién puesta no se cae nunca, ni lo último de este móvil.
  const viejas=n=>Array.from({length:n},(_,i)=>n+"-"+i);
  const mias=c.lapidaPon({deleted:viejas(499)},"recien",1000);
  const u300=c.lapidasUnion(mias,{deleted:Array.from({length:300},(_,i)=>"nube"+i)});
  assert.equal(j([u300.deleted.length,u300.deleted.indexOf("recien")>=0,u300.deleted.filter(k=>/^499-/.test(k)).length,u300.deleted.filter(k=>/^nube/.test(k)).length]),j([500,true,499,0]));
  const u500=c.lapidasUnion(mias,{deleted:Array.from({length:500},(_,i)=>"nube"+i)});
  assert.equal(j([u500.deleted.length,u500.deleted.indexOf("recien")>=0,u500.deleted.filter(k=>/^499-/.test(k)).length]),j([500,true,499]));
  const llena=c.lapidaPon({deleted:viejas(500)},"recien",1000);
  assert.equal(j([llena.deleted.length,llena.deleted[499]]),j([500,"recien"]));
  const at={}; for(let i=0;i<260;i++) at["h"+i]=i+1;
  const horas=c.lapidasUnion({deleted:[],deletedAt:at},{deleted:[]}).deletedAt;
  assert.equal(j([Object.keys(horas).length,"h0" in horas,"h259" in horas]),j([200,false,true]));
});

test("5 · borrar, «Deshacer», «es el mismo» y editar pasan por las lápidas con hora (los bloques REALES de Gastos)", ()=>{
  const pon=/const next=Object\.assign\(\{\},s,\{\s*expenses:\(s\.expenses\|\|\[\]\)\.filter\(function\(x\)\{ return x\.id!==e\.id; \}\)\s*\},lapidaPon\(s,key\)\);/.exec(bundle);
  assert.ok(pon,"no se encuentra la lápida del borrado en Gastos");
  const levanta=/set\(function\(s\)\{\s*const expenses=\(s\.expenses\|\|\[\]\)\.slice\(\);[\s\S]*?lapidaLevanta\(s,pending\.key\)\);\s*\}\);/.exec(bundle);
  assert.ok(levanta,"no se encuentra el «Deshacer» de Gastos");
  const e={id:"g1",date:"2026-10-07T10:00:00.000Z",merchant:"CARREFOUR",amount:40,source:"ob",ent:"bbva"}, key=c.keyOfExpense(e);
  let s={expenses:[e],deleted:[]};
  s=new Function("s","e","key","lapidaPon",pon[0]+"\nreturn next;")(s,e,key,c.lapidaPon);
  assert.equal(j([s.expenses.length,s.deleted,typeof s.deletedAt[key]]),j([0,[key],"number"]));
  const puesta=s.deletedAt[key];
  new Function("set","pending","lapidaLevanta",levanta[0])(f=>{ s=f(s); },{key:key,expense:e,index:0},c.lapidaLevanta);
  assert.equal(j([s.expenses.length,s.deleted,s.deletedAt[key]>puesta]),j([1,[],true]));
  // «Es el mismo» borra la fila del banco: su lápida también lleva hora.
  const mismo=/next=Object\.assign\(\{\},next,lapidaPon\(next, keyOfE\(e\)\)\);/.exec(bundle);
  assert.ok(mismo,"no se encuentra la lápida de «es el mismo»");
  const tras=new Function("next","e","keyOfE","lapidaPon",mismo[0]+"\nreturn next;")({deleted:[]},e,c.keyOfExpense,c.lapidaPon);
  assert.equal(j([tras.deleted,typeof tras.deletedAt[key]]),j([[key],"number"]));
  // Editar: retira la clave vieja y levanta la nueva si constaba. 10 → 12 → 10 escondía el gasto (gastado 0).
  const edita=/set\(function\(s\)\{ return rekeyFixedPaymentExpense\(Object\.assign\(\{\},s,\{\s*expenses:s\.expenses\.map\(function\(x\)\{ return x\.id===orig\.id\?upd:x; \}\)\s*\},lapidasAlEditar\(s, keyOfE\(orig\), keyOfE\(upd\)\)\),orig,upd\); \}\);/.exec(bundle);
  assert.ok(edita,"no se encuentra el guardado de `saveEdit`");
  const guarda=vm.runInContext("(function(set,orig,upd){ const keyOfE=keyOfExpense; "+edita[0]+" })",c);
  const cafe={id:"33333333-3333-4333-8333-333333333333",date:"2026-10-05T10:00:00.000Z",merchant:"Café Sol",amount:10,category:"restaurantes",source:"manual"};
  const a12=Object.assign({},cafe,{amount:12});
  let g=estado({expenses:[cafe]});
  guarda(f=>{ g=f(g); },cafe,a12);
  assert.equal(j([gastado(g),g.deleted]),j([12,[c.keyOfExpense(cafe)]]));
  guarda(f=>{ g=f(g); },a12,cafe);
  assert.equal(j([gastado(g),g.deleted,c.expenseCountsBudget(g.expenses[0],g)]),j([10,[c.keyOfExpense(a12)],true]));
  guarda(f=>{ g=f(g); },cafe,a12);
  assert.equal(j([gastado(g),g.deleted]),j([12,[c.keyOfExpense(cafe)]]),"y otra vuelta más");
});

// ───── La nube con clave primaria: la tabla falsa rechaza con `23505` un alta cuyo id ya existe
// en otra fila, como Postgres, y el borrado tarda más que el alta (es lo que abría la carrera).
// `sinRed` hace fallar el borrado, como al editar sin conexión.
function nubeConClavePrimaria(){
  const tabla=[], eventos=[], n={tabla,eventos,sinRed:false,altas:0};
  const clave=r=>[r.user_id,Date.parse(r.fecha),Number(r.importe),r.comercio].join("|");
  const vueltas=k=>new Promise(ok=>{ let i=0; const f=()=>(++i>=k?ok():setImmediate(f)); setImmediate(f); });
  const from=nombre=>nombre==="app_events" ? {insert:async f=>{ eventos.push(f); return {error:null}; }} : {
    upsert(f){
      n.altas++;
      const p=vueltas(1).then(()=>{
        if(tabla.some(r=>clave(r)===clave(f))) return {data:[],error:null};
        if(f.id&&tabla.some(r=>r.id===f.id)) return {data:null,error:{code:"23505",message:"duplicate key value violates unique constraint \"expenses_pkey\""}};
        tabla.push(Object.assign({},f)); return {data:[{id:f.id}],error:null};
      });
      return {then:(ok,ko)=>p.then(ok,ko),select:()=>p};
    },
    delete(){ const conds=[]; const q={eq(col,v){ conds.push([col,v]); return q; },
      then(ok,ko){ return vueltas(4).then(()=>{ if(n.sinRed) return {error:{message:"TypeError: Failed to fetch"}};
        for(let i=tabla.length-1;i>=0;i--) if(conds.every(([col,v])=>tabla[i][col]===v)) tabla.splice(i,1); return {error:null}; }).then(ok,ko); }}; return q; },
  };
  const sb=createLogicSandbox(); sb.window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:"u1"},expires_at:9e9}},error:null}),onAuthStateChange(){ return {data:{subscription:{unsubscribe(){}}}}; }},from})};
  vm.runInNewContext(extractPureLogicSource(source("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>js)),sb);
  assert.equal(vm.runInContext("cloud.enabled()",sb),true,"la nube falsa está enganchada");
  return Object.assign(n,{app:sb,reposo:()=>vueltas(40)});
}

test("6 · editar un gasto: el alta espera al borrado, cada guardado al anterior, y sin red no se lanza un alta condenada", async ()=>{
  const orig={id:"33333333-3333-4333-8333-333333333333",date:"2026-10-05T10:00:00.000Z",merchant:"Café Sol",amount:10,category:"restaurantes",source:"manual"};
  const upd=Object.assign({},orig,{amount:12}), upd2=Object.assign({},orig,{amount:12.5});
  // El control: lanzados a la vez, como estaba. El alta choca y la nube se queda SIN el gasto.
  const antes=nubeConClavePrimaria();
  await antes.app.subirGasto(orig,"gastos-apuntar");
  antes.app.borrarGastoNube(orig,"gastos-editar"); antes.app.subirGasto(upd,"gastos-editar");
  await antes.reposo();
  assert.equal(antes.tabla.length,0);
  assert.equal(j(antes.eventos.map(ev=>[ev.kind,ev.message,ev.detail])),j([["error","addExpense",j({code:"23505",origin:"gastos-editar"})]]),"y el evento dice desde dónde");
  // La pantalla apunta la edición en la cola y la manda subir (el bloque REAL de `saveEdit`).
  const mEdita=/if\(cloud\.enabled\(\)\)\{ editCola\.current\.pend\.push\(\{orig:orig, upd:upd\}\); subeEdicionesDeGasto\(editCola\.current\); \}/.exec(bundle);
  assert.ok(mEdita,"no se encuentra la escritura en la nube de `saveEdit`");
  const n=nubeConClavePrimaria(), cola={current:{pend:[],fin:Promise.resolve()}};
  const guarda=new Function("cloud","editCola","subeEdicionesDeGasto","orig","upd",mEdita[0]);
  const edita=(de,a)=>guarda(vm.runInContext("cloud",n.app),cola,n.app.subeEdicionesDeGasto,de,a);
  const foto=()=>j([n.tabla.map(f=>[f.id,f.importe]),n.eventos.map(ev=>ev.message+" "+ev.detail),cola.current.pend.length]);
  await n.app.subirGasto(orig,"gastos-apuntar");
  edita(orig,upd);
  await cola.current.fin;
  assert.equal(foto(),j([[[orig.id,12]],[],0]));
  // Dos guardados seguidos sin esperar entre ellos.
  edita(upd,orig); edita(orig,upd2);
  await cola.current.fin; await n.reposo();
  assert.equal(foto(),j([[[orig.id,12.5]],[],0]));
  // Sin red el borrado falla: el alta NO se lanza (sería un `23505` seguro) y la edición espera.
  n.sinRed=true; const altas=n.altas;
  edita(upd2,upd);
  await cola.current.fin; await n.reposo();
  assert.equal(j([n.tabla.map(f=>f.importe),n.altas-altas,cola.current.pend.length,n.eventos.map(ev=>ev.message+" "+ev.detail)]),
    j([[12.5],0,1,["deleteExpense "+j({code:"network",origin:"gastos-editar"})]]));
  // Vuelve la conexión: la edición pendiente sube, y la siguiente detrás de ella.
  n.sinRed=false;
  edita(upd,orig);
  await cola.current.fin; await n.reposo();
  assert.equal(j([n.tabla.map(f=>[f.id,f.importe]),cola.current.pend.length,n.eventos.length]),j([[[orig.id,10]],0,1]));
});

test("6 · el evento de error lleva el origen solo si es una puerta conocida, y todas las del código lo son", ()=>{
  const detalle=m=>c.mcLogEvent("error",m,"23505").detail;
  assert.equal(detalle("addExpense backfill: 2026-10-05|10|Café Sol"),j({code:"23505",origin:"backfill"}));
  assert.equal(detalle("deleteExpense gastos-borrar: 2026-10-05|10|Café Sol"),j({code:"23505",origin:"gastos-borrar"}));
  // Lo que no es una puerta conocida no viaja: ahí podría ir el movimiento entero (SEC-03).
  assert.equal(detalle("addExpense es12-0000-0000: 2026-10-05|10|Café Sol"),j({code:"23505"}));
  assert.equal(detalle("TOAST: gastos-editar: algo"),j({code:"23505"}));
  const conocidas=vm.runInContext("GASTO_ORIGENES",c), usadas=new Set();
  for(const m of js.matchAll(/(?:subirGasto|borrarGastoNube)\([^()]*?,\s*"([^"]+)"\)/g)) usadas.add(m[1]);
  assert.equal(usadas.size>=8,true,"se leen las puertas del código");
  for(const d of usadas) assert.equal(conocidas.indexOf(d)>=0,true,"la puerta «"+d+"» no está en GASTO_ORIGENES: su error llegaría sin origen");
});
