// Seis defectos de sincronización entre móviles y de recibos, hallados en la última revisión de la
// 4.26.122 (13/10/2026). Cada caso reproduce el defecto con datos sintéticos y falla sin su arreglo:
//   1. el estado más antiguo de otro móvil deshacía el borrado de un recibo (gastado 40 en uno y
//      102,40 en el otro y en el widget);
//   2. deshacer un «no es este recibo» sobre uno de dos cargos iguales de un recibo fijo no hacía nada;
//   3. un apunte con id del banco y otro idéntico sin él entraban con la MISMA clave;
//   4. el segundo pull devolvía la categoría y la tarjeta del aviso a una fila que él había cambiado;
//   5. las lápidas viajaban por «último que escribe», y unirlas a secas haría irreversible «Deshacer»;
//   6. editar un gasto lanzaba el borrado y el alta a la vez: `23505` y la nube sin el gasto.
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

test("1 · el borrado de un recibo sobrevive al estado más antiguo de otro móvil: los dos móviles y el widget dicen lo mismo", ()=>{
  const viejo=(ym,imp,rec)=>({id:"v-"+ym+"-"+imp,date:ym+"-05T10:00:00.000Z",merchant:rec?"ENDESA ENERGIA XXI":"CARREFOUR",obName:rec?"ENDESA ENERGIA XXI":"CARREFOUR",amount:imp,category:rec?"recibos":"super",source:"ob",ent:"bbva",extId:"x-"+ym+"-"+imp,reciboId:rec?"luz":undefined});
  const txs=[T("o1","bbva","2026-10-05",62.4,"ENDESA ENERGIA XXI"),T("o2","bbva","2026-10-07",40,"CARREFOUR",{card:true})];
  const comun=Object.assign(sincroniza(estado({fixed:[F("luz","Luz Endesa",62.4,5,"bbva"),F("gim","Gimnasio",30,20,"bbva")],expenses:[viejo("2026-09",62.4,true),viejo("2026-09",35,false)]}),txs,{bbva:797.6}).state,{_savedAt:OCT12-5*86400000});
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

test("3 · un apunte con id del banco y otro idéntico sin él son dos filas distintas, llegue como llegue", ()=>{
  const s0=()=>estado({accounts:[{id:"sb",ent:"sabadell",role:"ambos",spendFrom:true,value:500}],fixed:[F("spo","Spotify",10.99,5,"sabadell")]});
  const tx={id:T("x1","sabadell","2026-10-05",10.99,"Spotify"),sin:T(null,"sabadell","2026-10-05",10.99,"Spotify")};
  // De la fecha, solo el milisegundo: el mediodía local cae a otra hora UTC según la zona de la máquina.
  const forma=s=>j(s.expenses.map(e=>[e.extId||null,e.obOrd||1,c.keyOfExpense(e),c.expenseSourceForCloud(e),Date.parse(e.date)%1000]).sort());
  const dos=j([["x1",1,"2026-10-05|10.99|Spotify","ob:sabadell~recibo.spo",0],[null,2,"2026-10-05|10.99|Spotify|#2","ob:sabadell~recibo.spo#n2",1]].sort());
  for(const orden of [["id","sin"],["sin","id"]]){
    const r=sincroniza(s0(),orden.map(k=>tx[k]),{sabadell:478.02}).state;
    assert.equal(forma(r),dos,"en una sincronización, orden "+orden.join("+"));
    assert.equal(sincroniza(r,orden.map(k=>tx[k]),{sabadell:478.02}).add.length,0,"y la siguiente no añade nada");
    // «No es este recibo» sobre una suelta SOLO esa (las dos compartían clave: 0 → 21,98).
    for(const tocada of r.expenses){
      const q=c.quitarCargoDeRecibo(r,tocada.id,OCT12);
      assert.equal(j([gastado(q.state),q.state.expenses.filter(e=>c.cargoDeRecibo(e,q.state)).length]),j([10.99,1]));
    }
    // Caben las dos en la nube (índice único por fecha, importe y comercio) y sobreviven al pull.
    assert.equal(new Set(r.expenses.map(e=>j([Date.parse(e.date),e.amount,e.merchant]))).size,2);
    assert.equal(c.mergeExpenses(r.expenses,[]).list.length,2);
    assert.equal(c.mergeExpensesFromCloud([],r.expenses.map(fila).map(c.expenseFromRow),ahora).list.length,2);
    // En dos sincronizaciones acaba igual, entre primero la del id o la otra.
    const paso=sincroniza(s0(),[tx[orden[0]]],{sabadell:489.01}).state;
    const fin=sincroniza(paso,[tx.id,tx.sin],{sabadell:478.02}).state;
    assert.equal(j(fin.expenses.map(e=>e.obOrd||1).sort()),j([1,2]),"en dos, empezando por "+orden[0]);
  }
  // Una compra cualquiera (sin recibo): las dos cuentan, cada una con su clave.
  const compra={id:T("c1","sabadell","2026-10-06",7.5,"Panadería Sol",{card:true}),sin:T(null,"sabadell","2026-10-06",7.5,"Panadería Sol",{card:true})};
  const rc=sincroniza(s0(),[compra.id,compra.sin],{sabadell:485}).state;
  assert.equal(j([gastado(rc),new Set(rc.expenses.map(c.keyOfExpense)).size]),j([15,2]));
  // El MISMO cargo dos veces mientras se asienta (pendiente sin id + contabilizado con id) es uno.
  const asienta=sincroniza(s0(),[compra.id,Object.assign({},compra.sin,{status:"PDNG"})],{sabadell:492.5});
  assert.equal(j([asienta.add.length,gastado(asienta.state)]),j([1,7.5]));
  // Y sin ningún apunte con id nada cambia: los iguales siguen llevando 1, 2, 3.
  const tres=sincroniza(s0(),[compra.sin,Object.assign({},compra.sin),Object.assign({},compra.sin)],{sabadell:477.5});
  assert.equal(j(tres.add.map(e=>e.obOrd||1).sort()),j([1,2,3]));
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
  assert.equal("deletedAt" in quieto,false,"y no se guarda ninguna hora si nadie levantó nada");
  // Las de OTRA cuenta que hubo en este móvil no se mezclan con las de esta.
  assert.equal(j(baja(base({_savedAt:10,_historyOwner:"otra",deleted:["k-ajena"]}),nube,true).deleted),j(["k-a"]));

  // A borra, la lápida sube, B la baja; A pulsa «Deshacer». El gasto no puede quedarse escondido.
  const e={id:"22222222-2222-4222-8222-222222222222",date:"2026-10-07T10:00:00.000Z",merchant:"CARREFOUR",amount:40,category:"super",source:"ob",ent:"bbva",obName:"CARREFOUR"};
  const key=c.keyOfExpense(e), tiene=s=>(s.deleted||[]).indexOf(key)>=0;
  const A0=base({_savedAt:1,deleted:[],expenses:[e]});
  const A1=Object.assign({},A0,{expenses:[]},c.lapidaPon(A0,key,100),{_savedAt:100});
  const B1=baja(Object.assign({},A0,{_savedAt:50}),sube(A1));
  assert.equal(j([tiene(A1),tiene(B1),"deletedAt" in A1]),j([true,true,false]));
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
  assert.equal(A4.deletedAt[key]>A3.deletedAt[key],true);
  assert.equal(tiene(baja(Object.assign({},B2,{_savedAt:600}),sube(A4))),true);
  // Topes: 500 lápidas y 200 horas, quedándose con lo más reciente.
  const muchas=c.lapidasUnion({deleted:Array.from({length:400},(_,i)=>"a"+i)},{deleted:Array.from({length:400},(_,i)=>"b"+i)});
  assert.equal(j([muchas.deleted.length,muchas.deleted[499]]),j([500,"b399"]));
  const at={}; for(let i=0;i<260;i++) at["h"+i]=i+1;
  const horas=c.lapidasUnion({deleted:[],deletedAt:at},{deleted:[]}).deletedAt;
  assert.equal(j([Object.keys(horas).length,"h0" in horas,"h259" in horas]),j([200,false,true]));
});

test("5 · borrar y «Deshacer» en Gastos pasan por `lapidaPon` y `lapidaLevanta` (los bloques REALES)", ()=>{
  const pon=/const next=Object\.assign\(\{\},s,\{\s*expenses:\(s\.expenses\|\|\[\]\)\.filter\(function\(x\)\{ return x\.id!==e\.id; \}\)\s*\},lapidaPon\(s,key\)\);/.exec(bundle);
  assert.ok(pon,"no se encuentra la lápida del borrado en Gastos");
  const levanta=/set\(function\(s\)\{\s*const expenses=\(s\.expenses\|\|\[\]\)\.slice\(\);[\s\S]*?lapidaLevanta\(s,pending\.key\)\);\s*\}\);/.exec(bundle);
  assert.ok(levanta,"no se encuentra el «Deshacer» de Gastos");
  const e={id:"g1",date:"2026-10-07T10:00:00.000Z",merchant:"CARREFOUR",amount:40,source:"ob",ent:"bbva"}, key=c.keyOfExpense(e);
  let s={expenses:[e],deleted:[]};
  s=new Function("s","e","key","lapidaPon",pon[0]+"\nreturn next;")(s,e,key,c.lapidaPon);
  assert.equal(j([s.expenses.length,s.deleted]),j([0,[key]]));
  new Function("set","pending","lapidaLevanta",levanta[0])(f=>{ s=f(s); },{key:key,expense:e,index:0},c.lapidaLevanta);
  assert.equal(j([s.expenses.length,s.deleted,typeof s.deletedAt[key]]),j([1,[],"number"]));
});

// ───── La nube con clave primaria: la tabla falsa rechaza con `23505` un alta cuyo id ya existe
// en otra fila, como Postgres, y el borrado tarda más que el alta (es lo que abría la carrera).
function nubeConClavePrimaria(){
  const tabla=[], eventos=[];
  const clave=r=>[r.user_id,Date.parse(r.fecha),Number(r.importe),r.comercio].join("|");
  const vueltas=n=>new Promise(ok=>{ let i=0; const f=()=>(++i>=n?ok():setImmediate(f)); setImmediate(f); });
  const from=nombre=>nombre==="app_events" ? {insert:async f=>{ eventos.push(f); return {error:null}; }} : {
    upsert(f){
      const p=vueltas(1).then(()=>{
        if(tabla.some(r=>clave(r)===clave(f))) return {data:[],error:null};
        if(f.id&&tabla.some(r=>r.id===f.id)) return {data:null,error:{code:"23505",message:"duplicate key value violates unique constraint \"expenses_pkey\""}};
        tabla.push(Object.assign({},f)); return {data:[{id:f.id}],error:null};
      });
      return {then:(ok,ko)=>p.then(ok,ko),select:()=>p};
    },
    delete(){ const conds=[]; const q={eq(col,v){ conds.push([col,v]); return q; },
      then(ok,ko){ return vueltas(4).then(()=>{ for(let i=tabla.length-1;i>=0;i--) if(conds.every(([col,v])=>tabla[i][col]===v)) tabla.splice(i,1); return {error:null}; }).then(ok,ko); }}; return q; },
  };
  const sb=createLogicSandbox(); sb.window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:"u1"},expires_at:9e9}},error:null}),onAuthStateChange(){ return {data:{subscription:{unsubscribe(){}}}}; }},from})};
  vm.runInNewContext(extractPureLogicSource(source("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>js)),sb);
  assert.equal(vm.runInContext("cloud.enabled()",sb),true,"la nube falsa está enganchada");
  return {tabla,eventos,app:sb,reposo:()=>vueltas(40)};
}
const mEdita=/if\(cloud\.enabled\(\)\)\{\s*editCloudRef\.current=editCloudRef\.current[\s\S]*?\}\);\s*\}/.exec(bundle);

test("6 · editar un gasto: el alta espera al borrado y cada guardado al anterior (el bloque REAL de Gastos)", async ()=>{
  assert.ok(mEdita,"no se encuentra la escritura en la nube de `saveEdit`");
  const orig={id:"33333333-3333-4333-8333-333333333333",date:"2026-10-05T10:00:00.000Z",merchant:"Café Sol",amount:10,category:"restaurantes",source:"manual"};
  const upd=Object.assign({},orig,{amount:12}), upd2=Object.assign({},orig,{amount:12.5});
  // El control: lanzados a la vez, como estaba. El alta choca y la nube se queda SIN el gasto.
  const antes=nubeConClavePrimaria();
  await antes.app.subirGasto(orig,"gastos-apuntar");
  antes.app.borrarGastoNube(orig,"gastos-editar"); antes.app.subirGasto(upd,"gastos-editar");
  await antes.reposo();
  assert.equal(antes.tabla.length,0);
  assert.equal(j(antes.eventos.map(ev=>[ev.kind,ev.message,ev.detail])),j([["error","addExpense",j({code:"23505",origin:"gastos-editar"})]]),"y el evento dice desde dónde");
  // El bloque de la pantalla: una edición, y dos guardados seguidos sin esperar entre ellos.
  const n=nubeConClavePrimaria(), cola={current:Promise.resolve()};
  const guarda=new Function("cloud","editCloudRef","borrarGastoNube","subirGasto","orig","upd",mEdita[0]);
  const edita=(de,a)=>guarda(vm.runInContext("cloud",n.app),cola,n.app.borrarGastoNube,n.app.subirGasto,de,a);
  await n.app.subirGasto(orig,"gastos-apuntar");
  edita(orig,upd);
  await cola.current;
  assert.equal(j([n.tabla.map(f=>[f.id,f.importe]),n.eventos.length]),j([[[orig.id,12]],0]));
  edita(upd,orig); edita(orig,upd2);
  await cola.current; await n.reposo();
  assert.equal(j([n.tabla.map(f=>[f.id,f.importe]),n.eventos.length]),j([[[orig.id,12.5]],0]));
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
