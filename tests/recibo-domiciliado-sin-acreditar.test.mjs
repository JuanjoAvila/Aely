// Reporte del dueño (12/10/2026, beta 4.26.118.1): dos adeudos domiciliados de Sabadell que el
// banco YA había cobrado no estaban en Gastos ni marcaban pagado su recibo de Plan, e «Importar
// histórico» los enseñaba como repetidos sin marcar. Su decisión: «yo solo quiero que salga todo
// en gastos… si sale en recibos pero no en gastos la gente se rallará».
//
// Lo que se fija aquí (segunda vuelta, tras el NO-GO de la revisión del mismo día):
//   · todo cargo entra en Gastos; SOLO el que el motor da por pago del recibo lleva `reciboId`;
//   · esa fila no mueve ninguna cifra en ningún rol de banco, tampoco al anclar el saldo tras
//     sincronizar (`applyBankBalances`) ni al cerrar el mes (`reconcileTR`);
//   · lo que solo se parece a un recibo cuenta como un gasto normal;
//   · «No es este recibo» deja el cargo contando y el recibo pendiente, y viaja;
//   · un recibo borrado no deja filas fuera de las cuentas.
// Datos sintéticos; el reloj es fijo y se mueve a mano para cruzar de mes.
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
vm.runInNewContext(source("src/modules/13-hogar.js"),c);   // la foto del hogar vive tras el corte de la lógica pura
const OCT12=new Date("2026-10-12T18:00:00+02:00").getTime();
let ahora=OCT12;
c.Date=class extends Date { constructor(...a){ super(...(a.length?a:[ahora])); } static now(){ return ahora; } };
const clon=x=>JSON.parse(JSON.stringify(x));
const j=x=>JSON.stringify(x);

const F=(id,name,amount,day,account,extra)=>Object.assign({id,name,amount,freq:"mes",day,account:account||"sabadell"},extra||{});
const fijos=[F("com","Comunidad",50,12),F("mov","Pepe Mobile, S.L.U.",102,5)];
const T=(id,ent,date,amount,merchant,extra)=>Object.assign({ext_id:id,ent,date,amount,merchant,status:"BOOK",card:false},extra||{});
const TX_COM=T("t1","sabadell","2026-10-12",50,"COMUNIDAD DE PROPIETARIOS");
const TX_MOV=T("t2","sabadell","2026-10-05",102,"Pepe Mobile, S.L.U.");
const ASPSP={sabadell:"Banco de Sabadell",caixabank:"CaixaBank"};
// Respuesta de `bank-sync`: un enlace por banco, con su saldo real y sus movimientos.
const enlaces=(txs,saldos)=>Object.keys(saldos).map(ent=>({aspsp:ASPSP[ent],ok:true,
  accounts:[{uid:ent,ok:true,balances:[{type:"ITAV",amount:saldos[ent],currency:"EUR"}],transactions:txs.filter(t=>t.ent===ent)}]}));
const unaCuenta=[{id:"sb",ent:"sabadell",role:"fijos",value:2000},{id:"tr",ent:"trade_republic",role:"diario",spendFrom:true,value:500}];
const estado=o=>Object.assign({accounts:clon(unaCuenta),fixed:clon(fijos),bankTx:[],debts:[],oneoffs:[],expenses:[],flows:[],settings:{},deleted:[]},o);
// Lo mismo que hace `runBankSync` con la respuesta: importar, guardar extracto y pruebas, anclar.
function sincroniza(s,txs,saldos){
  const links=enlaces(txs,saldos||{sabadell:1848}),flat=c.flattenBankTx(links);
  const add=c.importObExpenses(s,flat,links)||[];
  const conTx=Object.assign({},s,{expenses:add.concat(s.expenses||[]),bankTx:flat});
  const hoy=new Date(ahora);
  const probado=c.reconcileFixedPaymentProofs(conTx,hoy.getFullYear(),hoy.getMonth()+1,hoy.getDate());
  return {add:[...add],state:c.applyBankBalances(probado,links).state};
}
const pagados=s=>s.fixed.filter(f=>c.fixedPaymentState(s,f,2026,10,12).paid).map(f=>f.id).join(",");
const gastado=s=>c.monthBudgetStats(s).spent;
// Segunda vía del gastado: sumar a mano lo que la lista pinta en el cajón «cuenta».
const gastadoLista=s=>+s.expenses.filter(e=>c.expenseBucket(e,s)==="cuenta"&&String(e.date).slice(0,7)==="2026-10").reduce((n,e)=>n+e.amount,0).toFixed(2);
const mostrado=s=>{ const i=c.insumosSaldoGasto(s);
  return s.accounts.map(a=>+c.saldoCuentaMostrada(a,{injTR:i.injTR,spentByBank:i.spentByBank,paidNetByBank:i.paidNetByBank,roundup:i.roundup,monthlyInvest:i.monthlyInvest}).toFixed(2)); };
const marcas=filas=>j(filas.map(e=>[e.merchant,e.reciboId||null]));

test("sync diario: el adeudo entra en Gastos enlazado a su recibo y el recibo queda pagado", ()=>{
  const r=sincroniza(estado(),[TX_COM,TX_MOV]);
  assert.equal(j(r.add.map(e=>[e.merchant,e.amount,e.reciboId,e.source,e.extId])),
    j([["COMUNIDAD DE PROPIETARIOS",50,"com","ob","t1"],["Pepe Mobile, S.L.U.",102,"mov","ob","t2"]]));
  assert.equal(pagados(r.state),"com,mov");
  assert.equal(pagados(Object.assign({},r.state,{bankTx:[]})),"com,mov","sigue pagado en un móvil sin extracto");
  assert.equal(j(r.add.map(e=>c.expenseBucket(e,r.state))),j(["recibo","recibo"]));
  assert.equal(c.reciboNombre(r.state,r.add[0]),"Comunidad");
  assert.equal(sincroniza(r.state,[TX_COM,TX_MOV]).add.length,0,"volver a sincronizar no repite la fila");
  assert.equal(c.marcarCargosDeRecibo(r.state),null,"y la pasada de marcar no tiene nada que hacer");
});

test("con dos cuentas de recibos en el banco el cargo ya no se pierde: entra y acredita por la fila", ()=>{
  const r=sincroniza(estado({accounts:clon(unaCuenta).concat([{id:"sb2",ent:"sabadell",name:"Otra cuenta",value:100}])}),[TX_COM,TX_MOV]);
  assert.equal(marcas(r.add),j([["COMUNIDAD DE PROPIETARIOS","com"],["Pepe Mobile, S.L.U.","mov"]]));
  assert.equal(pagados(r.state),"com,mov");
});

// ───── Cifras: dos bancos, tres roles, y pasando por el anclaje del saldo y el cierre de mes ─────
const LUZ=F("luz","Luz hogar",61.4,3,"caixabank");
const TX_LUZ=T("c1","caixabank","2026-10-03",61.4,"LUZ HOGAR SL");
const control=ent=>({id:"ctl-"+ent,date:"2026-10-06T10:00:00.000Z",merchant:"Compra de control",obName:"Compra de control",amount:20,category:"otros",source:"ob",ent:ent,extId:"ctl-"+ent});
const TX_CTL=["sabadell","caixabank"].map(ent=>T("ctl-"+ent,ent,"2026-10-06",20,"Compra de control",{card:true}));
const ROLES=[
  ["solo recibos",[{id:"sb",ent:"sabadell",role:"fijos",value:2000},{id:"cx",ent:"caixabank",role:"fijos",value:900},{id:"tr",ent:"trade_republic",role:"diario",spendFrom:true,value:500}],{}],
  ["para todo",[{id:"sb",ent:"sabadell",role:"ambos",spendFrom:true,value:2000},{id:"cx",ent:"caixabank",role:"fijos",value:900}],{expenseBanks:["caixabank"]}],
  ["gasto diario",[{id:"sb",ent:"sabadell",role:"diario",spendFrom:true,value:2000},{id:"cx",ent:"caixabank",role:"fijos",value:900}],{}],
];
const BANCO={sabadell:1848,caixabank:838.6};
for(const [rol,accounts,settings] of ROLES){
  const inicio=()=>estado({accounts:clon(accounts),settings:clon(settings),fixed:clon(fijos.concat([LUZ])),expenses:[control("sabadell"),control("caixabank")],trAnchor:"2026-10"});
  // `antes`: lo que había hasta hoy, el banco no manda los adeudos (se tiraban). `despues`: con ellos.
  const antes=()=>sincroniza(inicio(),TX_CTL,BANCO).state;
  const despues=()=>sincroniza(inicio(),[TX_COM,TX_MOV,TX_LUZ].concat(TX_CTL),BANCO);

  test("ninguna cifra cuenta el recibo dos veces · Sabadell "+rol, ()=>{
    const a=antes(),r=despues(),d=r.state;
    assert.equal(marcas(r.add),j([["COMUNIDAD DE PROPIETARIOS","com"],["Pepe Mobile, S.L.U.","mov"],["LUZ HOGAR SL","luz"]]),"los tres adeudos entran marcados");
    assert.equal(gastado(d),gastado(a));
    assert.equal(gastadoLista(d),gastadoLista(a));
    assert.equal(+gastado(d).toFixed(2),gastadoLista(d),"las dos vías del gastado dicen lo mismo");
    // El saldo que se pinta justo después de sincronizar es el del banco, con o sin las filas.
    assert.equal(j(mostrado(d)),j(mostrado(a)));
    assert.equal(mostrado(d)[0],BANCO.sabadell,"Sabadell enseña lo que dice el banco");
    assert.equal(mostrado(d)[1],BANCO.caixabank,"y Caixa también");
    // Segunda vía del saldo: la base guardada tras anclar y lo que restan los recibos por calendario.
    assert.equal(j(d.accounts.map(x=>x.value)),j(a.accounts.map(x=>x.value)),"el anclaje deja la misma base");
    assert.equal(j(["sabadell","caixabank"].map(ent=>c.monthNetForAccount(d,ent,2026,10,12))),j([-152,-61.4]),"el recibo resta una vez");
    assert.equal(c.planChargesMonth(d,10,2026,12).pendingBillsTotal,0,"los tres salen pagados en Plan");
    // La medida no está ciega: si la fila contara, el anclaje del mismo sync daría otra base.
    const contando=Object.assign({},d,{reciboNo:d.expenses.filter(e=>e.reciboId).map(e=>e.reciboId+"|"+c.fixedPaymentIdentity(c.expenseBankOf(e),e))});
    const cuentaSb=rol!=="solo recibos",cuentaCx=rol==="para todo";
    assert.equal(+(gastado(contando)-gastado(d)).toFixed(2),(cuentaSb?152:0)+(cuentaCx?61.4:0));
  });

  test("al cruzar de mes el cierre no vuelve a restar el recibo · Sabadell "+rol, ()=>{
    const a=antes(),d=despues().state;
    // Y el camino sin sync: las filas entraron por Importar histórico y nadie ancló después.
    const cands=[TX_COM,TX_MOV,TX_LUZ].map(t=>({kind:"out",ent:t.ent,date:t.date,amount:t.amount,merchant:t.merchant,card:false,id:t.ext_id}));
    const h=c.histBuildCommit(cands,c.histClassifyCandidates(cands,a).rows,a,{batchId:"hist-x"}).expAdds;
    assert.equal(marcas([...h]),j([["COMUNIDAD DE PROPIETARIOS","com"],["Pepe Mobile, S.L.U.","mov"],["LUZ HOGAR SL","luz"]]));
    const soloHist=Object.assign({},a,{expenses:[...h].concat(a.expenses)});
    ahora=new Date("2026-11-02T10:00:00+01:00").getTime();
    try{
      const cierra=s=>j(c.reconcileTR(clon(s)).accounts.map(x=>[x.ent,x.value]));
      assert.equal(cierra(d),cierra(a),"tras sincronizar");
      assert.equal(cierra(soloHist),cierra(a),"solo con Importar histórico");
      if(rol!=="solo recibos"){
        const sinMarca=Object.assign({},d,{expenses:d.expenses.map(e=>{ const x=Object.assign({},e); delete x.reciboId; return x; })});
        assert.notEqual(cierra(sinMarca),cierra(a),"control: sin la marca el cierre sí lo restaría otra vez");
      }
    } finally { ahora=OCT12; }
  });
}

// ───── Qué NO es el cargo de un recibo ─────
const todo=o=>estado(Object.assign({accounts:[{id:"sb",ent:"sabadell",role:"ambos",spendFrom:true,value:2000}],settings:{}},o));
for(const [nombre,recibo,txs,esperado,sube,sinHistorico] of [
  ["«Agua» no es AGUACATES",F("ag","Agua",30,10),[T("a1","sabadell","2026-10-08",30.2,"AGUACATES DEL SUR",{card:true})],[["AGUACATES DEL SUR",null]],30.2],
  ["«Seguro coche» no es SEGURO DENTAL",F("sc","Seguro coche",40,5),[T("a1","sabadell","2026-10-06",40.3,"SEGURO DENTAL SANITAS")],[["SEGURO DENTAL SANITAS",null]],40.3],
  ["nombre igual pero importe que no es el del recibo (una derrama)",F("com","Comunidad",50,12),[T("a1","sabadell","2026-10-09",180,"COMUNIDAD DE PROPIETARIOS")],[["COMUNIDAD DE PROPIETARIOS",null]],180],
  ["dos cargos del mismo comercio: el motor no sabe cuál es y no se marca ninguno",F("nf","Netflix",12.99,5),
    [T("a1","sabadell","2026-10-05",12.99,"NETFLIX.COM"),T("a2","sabadell","2026-10-09",13,"NETFLIX SHOP MERCH",{card:true})],[["NETFLIX SHOP MERCH",null],["NETFLIX.COM",null]],25.99,"sin extracto, el histórico sí distingue el de céntimos exactos"],
  ["cobro doble idéntico en dos días: tampoco",F("com","Comunidad",50,5),
    [T("a1","sabadell","2026-10-05",50,"COMUNIDAD DE PROPIETARIOS"),T("a2","sabadell","2026-10-11",50,"COMUNIDAD DE PROPIETARIOS")],[["COMUNIDAD DE PROPIETARIOS",null],["COMUNIDAD DE PROPIETARIOS",null]],100],
  ["el cargo en otro banco que el del recibo",F("com","Comunidad",50,5,"caixabank"),[T("a1","sabadell","2026-10-05",50,"COMUNIDAD DE PROPIETARIOS")],[["COMUNIDAD DE PROPIETARIOS",null]],50],
  ["un recibo anual fuera de su mes",{id:"sg",name:"Seguro hogar",amount:312.4,freq:"año",months:[3],account:"sabadell",day:10},[T("a1","sabadell","2026-10-08",312.4,"SEGURO HOGAR")],[["SEGURO HOGAR",null]],312.4],
  ["un cargo todavía pendiente",F("com","Comunidad",50,5),[T("a1","sabadell","2026-10-05",50,"COMUNIDAD DE PROPIETARIOS",{status:"PDNG"})],[["COMUNIDAD DE PROPIETARIOS",null]],50,"el histórico no trae el estado del cargo"],
]){
  test("no se marca: "+nombre, ()=>{
    const r=sincroniza(todo({fixed:[recibo]}),txs,{sabadell:1500});
    assert.equal(marcas(r.add),j(esperado));
    assert.equal(+gastado(r.state).toFixed(2),sube,"y cuenta como cualquier gasto");
    if(sinHistorico) return;
    // En el histórico, lo mismo: nada de esto sale como cargo de recibo.
    const cands=txs.map(t=>({kind:"out",ent:t.ent,date:t.date,amount:t.amount,merchant:t.merchant,card:!!t.card,id:t.ext_id}));
    assert.ok([...c.histClassifyCandidates(cands,todo({fixed:[recibo]})).rows].every(x=>x.status==="new"&&!x.reciboId));
  });
}

test("un recibo ya pagado y un segundo cobro igual: el primero sigue siendo el del recibo y el segundo cuenta", ()=>{
  const s=todo({fixed:[F("com","Comunidad",50,5)]});
  const uno=sincroniza(s,[T("a1","sabadell","2026-10-05",50,"COMUNIDAD DE PROPIETARIOS")],{sabadell:1950});
  assert.equal(marcas(uno.add),j([["COMUNIDAD DE PROPIETARIOS","com"]]));
  const dos=sincroniza(uno.state,[T("a1","sabadell","2026-10-05",50,"COMUNIDAD DE PROPIETARIOS"),T("a2","sabadell","2026-10-11",50,"COMUNIDAD DE PROPIETARIOS")],{sabadell:1900});
  assert.equal(marcas(dos.add),j([["COMUNIDAD DE PROPIETARIOS",null]]));
  assert.equal(gastado(dos.state),50,"un gasto de más de verdad");
  assert.equal(mostrado(dos.state)[0],1900);
  assert.equal(c.marcarCargosDeRecibo(dos.state),null,"un recibo no marca un segundo cargo en el mismo mes");
  // Ni aunque el extracto de hoy solo traiga el segundo y el motor lo diera por bueno.
  const soloSegundo=Object.assign({},dos.state,{bankTx:dos.state.bankTx.filter(t=>t.id==="a2"),fixed:dos.state.fixed.map(f=>Object.assign({},f,{paymentProofs:{}}))});
  assert.equal(c.fixedPaymentState(soloSegundo,soloSegundo.fixed[0],2026,10,12).paid,true,"el motor acredita con el segundo");
  assert.equal(c.marcarCargosDeRecibo(soloSegundo),null);
});

test("el cargo entra pendiente y sin marca; al contabilizarse lo marca la pasada, sin repetir la fila", ()=>{
  const s=todo({fixed:[F("com","Comunidad",50,5)]});
  const pend=sincroniza(s,[T("a1","sabadell","2026-10-05",50,"COMUNIDAD DE PROPIETARIOS",{status:"PDNG"})],{sabadell:1950});
  const book=sincroniza(pend.state,[T("a1","sabadell","2026-10-05",50,"COMUNIDAD DE PROPIETARIOS")],{sabadell:1950});
  assert.equal(book.add.length,0);
  const m=c.marcarCargosDeRecibo(book.state);
  assert.equal(marcas([...m.marcadas]),j([["COMUNIDAD DE PROPIETARIOS","com"]]));
  assert.equal(gastado(m.state),0);
  assert.equal(c.marcarCargosDeRecibo(m.state),null,"y no entra en bucle");
});

test("un puntual del Plan marca su cargo por nombre completo, no por una palabra suelta", ()=>{
  const o={id:"o1",name:"ITV coche",amount:45,account:"sabadell",month:10,year:2026,day:9};
  const r=sincroniza(todo({fixed:[],oneoffs:[o]}),[T("a1","sabadell","2026-10-09",45,"ITV COCHE MADRID"),T("a2","sabadell","2026-10-10",45.2,"ESTACION ITV",{card:true})],{sabadell:1900});
  assert.equal(marcas(r.add),j([["ESTACION ITV",null],["ITV COCHE MADRID","o1"]]));
  assert.equal(gastado(r.state),45.2);
  // El nombre solo no basta: con otro importe es otro gasto.
  const caro=sincroniza(todo({fixed:[],oneoffs:[o]}),[T("a3","sabadell","2026-10-09",120,"ITV COCHE MADRID")],{sabadell:1880});
  assert.equal(marcas(caro.add),j([["ITV COCHE MADRID",null]]));
});

test("un recibo que cuesta lo mismo que el aporte mensual no compra participaciones", ()=>{
  const s=todo({accounts:[{id:"sb",ent:"sabadell",role:"ambos",spendFrom:true,value:2000,monthlyInvest:50,rewardInv:"fondo"}],
    investments:[{id:"fondo",value:1000,cost:1000,shares:10,cur:"EUR"}],fixed:[F("com","Comunidad",50,12)]});
  const r=sincroniza(s,[TX_COM,T("a2","sabadell","2026-10-02",50,"Aporte plan",{card:false})],{sabadell:1900});
  assert.equal(j(r.add.map(e=>[e.merchant,e.reciboId||null,e.category==="inversion"])),j([["COMUNIDAD DE PROPIETARIOS","com",false],["Aporte plan",null,true]]));
});

test("Importar histórico: fila nueva y marcada, con su recibo; ya no «repetido» sin marcar", ()=>{
  const s=estado(),cands=[TX_COM,TX_MOV].map(t=>({kind:"out",ent:t.ent,date:t.date,amount:t.amount,merchant:t.merchant,card:false,id:t.ext_id}));
  const rows=[...c.histClassifyCandidates(cands,s).rows];
  assert.equal(j(rows.map(r=>[r.status,r.reason,r.defDest,r.reciboId,r.match.name,r.suggestRecibo])),
    j([["new","recibo","gasto","com","Comunidad",false],["new","recibo","gasto","mov","Pepe Mobile, S.L.U.",false]]));
  const adds=[...c.histBuildCommit(cands,rows,s,{batchId:"hist-x"}).expAdds];
  assert.equal(j(adds.map(e=>[e.source,e.reciboId,e.extId])),j([["ob-hist","com","t1"],["ob-hist","mov","t2"]]));
  const tras=estado({expenses:adds});
  assert.equal(pagados(tras),"com,mov","sin extracto local, la fila importada acredita el recibo");
  assert.ok([...c.histClassifyCandidates(cands,tras).rows].every(r=>r.status==="dup"&&r.reason==="existing"),"y la segunda vez ya consta como apuntada");
  // Dos cargos del mismo comercio: sin extracto delante solo vale el de céntimos exactos.
  const dos=[{kind:"out",ent:"sabadell",date:"2026-10-09",amount:13,merchant:"NETFLIX SHOP MERCH",card:true,id:"n2"},{kind:"out",ent:"sabadell",date:"2026-10-05",amount:12.99,merchant:"NETFLIX.COM",card:false,id:"n1"}];
  assert.equal(j([...c.histClassifyCandidates(dos,estado({fixed:[F("nf","Netflix",12.99,5)]})).rows].map(r=>r.reciboId||null)),j([null,"nf"]));
  // Un cargo del mismo comercio en un mes en que el recibo no toca no es su cargo.
  const anual={id:"sg",name:"Seguro hogar",amount:312.4,freq:"año",months:[3],account:"sabadell",day:10};
  const fuera=[{kind:"out",ent:"sabadell",date:"2026-09-08",amount:312.4,merchant:"SEGURO HOGAR",card:false,id:"s9"},{kind:"out",ent:"sabadell",date:"2026-03-10",amount:312.4,merchant:"SEGURO HOGAR",card:false,id:"s3"}];
  assert.equal(j([...c.histClassifyCandidates(fuera,estado({fixed:[anual]})).rows].map(r=>r.reciboId||null)),j([null,"sg"]));
});

test("lo que él importó a mano el 12/10 (sin marca) no se duplica, y la pasada lo enlaza a su recibo", ()=>{
  const suyas=[TX_COM,TX_MOV].map((t,i)=>({id:"h"+i,date:new Date(t.date+"T12:00:00").toISOString(),merchant:t.merchant,amount:t.amount,category:"otros",source:"ob-hist",ent:t.ent,extId:t.ext_id}));
  const r=sincroniza(estado({expenses:suyas}),[TX_COM,TX_MOV]);
  assert.equal(r.add.length,0,"mismo id del banco");
  const sinId=suyas.map(e=>{ const x=Object.assign({},e); delete x.extId; return x; });
  assert.equal(sincroniza(estado({expenses:sinId}),[TX_COM,TX_MOV].map(t=>Object.assign({},t,{ext_id:null}))).add.length,0,"sin id: día, importe y nombre");
  assert.equal(marcas([...c.marcarCargosDeRecibo(r.state).marcadas]),j([["COMUNIDAD DE PROPIETARIOS","com"],["Pepe Mobile, S.L.U.","mov"]]));
});

test("una fila de recibo borrada no vuelve con el siguiente sync", ()=>{
  const r=sincroniza(estado(),[TX_COM,TX_MOV]);
  const borrada=r.add.find(e=>e.reciboId==="com");
  const s=Object.assign({},r.state,{expenses:r.state.expenses.filter(e=>e.id!==borrada.id),deleted:[c.keyOfExpense(borrada)]});
  assert.equal(sincroniza(s,[TX_COM,TX_MOV]).add.length,0);
});

for(const [rol,accounts,settings] of ROLES){
  test("«No es este recibo»: el cargo pasa a contar y el recibo vuelve a pendiente · Sabadell "+rol, ()=>{
    const r=sincroniza(estado({accounts:clon(accounts),settings:clon(settings)}),[TX_COM,TX_MOV],{sabadell:1848});
    const fila=r.state.expenses.find(e=>e.reciboId==="com");
    const q=c.quitarCargoDeRecibo(r.state,fila.id);
    assert.equal(q.e.reciboId,undefined);
    assert.equal(c.expenseSourceForCloud(q.e),"ob:sabadell","la fila sube sin la marca");
    assert.equal(q.state.reciboNo.length,1,"y el veto viaja en el estado");
    assert.equal(pagados(q.state),"mov","el recibo deja de estar pagado con ese cargo, también con el extracto delante");
    assert.equal(pagados(Object.assign({},q.state,{bankTx:[]})),"mov","y sin extracto");
    assert.equal(+(gastado(q.state)-gastado(r.state)).toFixed(2),rol==="solo recibos"?0:50);
    assert.equal(c.marcarCargosDeRecibo(q.state),null,"la pasada no lo vuelve a marcar");
    const otra=sincroniza(q.state,[TX_COM,TX_MOV],{sabadell:1848});
    assert.equal(otra.add.length,0);
    assert.equal(pagados(otra.state),"mov","ni el siguiente sync");
    assert.equal(c.quitarCargoDeRecibo(q.state,fila.id),null,"no hay nada que quitar dos veces");
    // Otro móvil: su fila sigue marcada, pero ya le llegó el estado con el veto.
    const otroMovil=Object.assign({},r.state,{reciboNo:q.state.reciboNo,fixed:q.state.fixed});
    assert.equal(c.cargoDeRecibo(otroMovil.expenses.find(e=>e.id===fila.id),otroMovil),null);
    assert.equal(gastado(otroMovil),gastado(q.state));
    // Otro cargo distinto sí puede pagar ese recibo, también en un móvil sin extracto.
    const t9={id:"h9",date:"2026-10-10T10:00:00.000Z",merchant:"COMUNIDAD DE PROPIETARIOS",obName:"COMUNIDAD DE PROPIETARIOS",amount:50,category:"recibos",source:"ob-hist",ent:"sabadell",extId:"t9"};
    assert.equal(pagados(Object.assign({},q.state,{bankTx:[],expenses:[t9].concat(q.state.expenses)})),"com,mov");
    const nuevo=sincroniza(q.state,[TX_COM,TX_MOV,T("t9","sabadell","2026-10-10",50,"COMUNIDAD DE PROPIETARIOS")],{sabadell:1798});
    assert.equal(marcas(nuevo.add),j([["COMUNIDAD DE PROPIETARIOS","com"]]));
    assert.equal(pagados(nuevo.state),"com,mov");
  });
}

test("recibo borrado después: la fila cuenta como un gasto normal y no enseña etiqueta", ()=>{
  const r=sincroniza(todo(),[TX_COM,TX_MOV],{sabadell:1848});
  const sin=Object.assign({},r.state,{fixed:r.state.fixed.filter(f=>f.id!=="com")});
  const fila=sin.expenses.find(e=>e.reciboId==="com");
  assert.equal(c.cargoDeRecibo(fila,sin),null);
  assert.equal(c.reciboNombre(sin,fila),"");
  assert.equal(c.expenseBucket(fila,sin),"cuenta");
  assert.equal(gastado(sin)-gastado(r.state),50);
});

test("la marca viaja en `source`, en cualquier orden con la de cuota, y quien no la conoce deja la fila fuera", ()=>{
  const fila=fuente=>({id:"11111111-1111-4111-8111-111111111111",fecha:"2026-10-05T10:00:00.000Z",comercio:"Pepe Mobile, S.L.U.",importe:102,cat:"otros",source:fuente});
  for(const [origen,fuente] of [["ob","ob:sabadell~recibo.mov"],["ob-hist","ob-hist:sabadell~recibo.mov"]]){
    const e={id:"x",date:"2026-10-05T10:00:00.000Z",merchant:"Pepe Mobile, S.L.U.",amount:102,category:"otros",source:origen,ent:"sabadell",reciboId:"mov"};
    assert.equal(c.expenseSourceForCloud(e),fuente);
    const vuelta=c.expenseFromRow(fila(fuente));
    assert.equal(j([vuelta.source,vuelta.ent,vuelta.reciboId,c.expenseBankOf({source:fuente})]),j([origen,"sabadell","mov","sabadell"]));
    // Así lee el banco la beta 4.26.118 ya instalada y el servidor del widget
    // (`bancoDeSource`): un banco que no existe, que ninguna lista de gasto diario contiene.
    assert.equal(fuente.slice(fuente.indexOf(":")+1).split("#")[0].split("~deuda.")[0],"sabadell~recibo.mov");
  }
  const dup=c.expenseSourceForCloud({source:"ob",ent:"sabadell",reciboId:"mov",possibleDup:true});
  assert.equal(dup,"ob:sabadell~recibo.mov#dup");
  assert.equal(j([c.expenseFromRow(fila(dup)).reciboId,c.expenseFromRow(fila(dup)).possibleDup]),j(["mov",true]));
  assert.equal(c.expenseFromRow(fila("ob:sabadell~deuda.d1")).debtId,"d1","la cuota de deuda no cambia");
  assert.equal(c.expenseFromRow(fila("ob:sabadell")).reciboId,undefined);
  // Una app anterior que la marca como cuota sube las dos marcas: gana la deuda y el banco sale limpio.
  for(const fuente of ["ob:sabadell~recibo.mov~deuda.d1","ob:sabadell~deuda.d1~recibo.mov"]){
    const v=c.expenseFromRow(fila(fuente));
    assert.equal(j([v.ent,v.debtId,v.reciboId]),j(["sabadell","d1",undefined]),fuente);
  }
  assert.equal(c.expenseSourceForCloud({source:"ob",ent:"sabadell",reciboId:"mov",debtId:"d1"}),"ob:sabadell~deuda.d1","al subir también gana la deuda");
});

test("la marca que baja de la nube se adopta, y marcar a mano como cuota la sustituye en local y en la nube", ()=>{
  const local={id:"x",date:"2026-10-05T10:00:00.000Z",merchant:"Pepe Mobile, S.L.U.",amount:102,category:"otros",source:"ob",ent:"sabadell"};
  assert.equal(c.refreshExpenseFromCloud(local,Object.assign({},local,{reciboId:"mov"})).reciboId,"mov");
  assert.equal(c.refreshExpenseFromCloud(Object.assign({},local,{reciboId:"mov"}),local).reciboId,"mov","una fila de la nube sin marca no borra la local");
  const deuda={id:"d1",name:"Financiación móvil",monthly:102,day:5,account:"sabadell",value:1000};
  const r=sincroniza(estado({debts:[deuda]}),[TX_COM,TX_MOV]);
  assert.equal(c.cuotasDeDeudaPorMarcar(r.state).length,0,"si casa con recibo y con deuda, gana el recibo");
  const fila=r.state.expenses.find(e=>e.reciboId==="mov");
  const m=c.marcarCuotaAMano(r.state,fila.id,"d1");
  assert.equal(j([m.e.debtId,m.e.reciboId]),j(["d1",undefined]));
  assert.equal(c.expenseSourceForCloud(m.e),"ob:sabadell~deuda.d1");
});

test("los lectores que suman gastos por su cuenta tampoco cuentan el cargo de un recibo", ()=>{
  const r=sincroniza(todo(),[TX_COM,TX_MOV].concat([T("p1","sabadell","2026-10-07",3.4,"Panadería Sol",{card:true})]),{sabadell:1844.6});
  const foto=c.buildHouseholdSnapshot(r.state,{},"a@b.c");
  assert.equal(+[...foto.expensesByCat].reduce((n,x)=>n+x.spent,0).toFixed(2),3.4,"la foto del hogar ya lleva los recibos en sus fijos");
  const tresMeses=["08","09","10"].map((m,i)=>({id:"s"+i,date:"2026-"+m+"-05T10:00:00.000Z",merchant:"Pepe Mobile, S.L.U.",amount:102,category:"otros",source:"ob",ent:"sabadell",reciboId:"mov"}));
  assert.equal(c.detectSubscriptions(tresMeses).length,0);
  assert.equal(c.detectSubscriptions(tresMeses.map(e=>Object.assign({},e,{reciboId:undefined}))).length,1,"sin marca sí se detecta: el control");
});
