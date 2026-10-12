// Reporte del dueño (12/10/2026, beta 4.26.118.1): dos adeudos domiciliados de Sabadell que el
// banco YA había cobrado no estaban en Gastos ni marcaban pagado su recibo de Plan, e «Importar
// histórico» los enseñaba como repetidos sin marcar. Su decisión: «yo solo quiero que salga todo
// en gastos… si sale en recibos pero no en gastos la gente se rallará».
//
// La regla, tras dos revisiones el mismo día:
//   · lleva `reciboId` EXACTAMENTE lo que antes se tiraba (mismo predicado), y esa fila no mueve
//     ninguna cifra: las cuentas quedan como estaban. Eso lo fija `tests/recibo-invariante`
//     contra el código de la 4.26.119; aquí se prueba lo demás;
//   · lo dudoso se distingue en la ETIQUETA: firme si es el cargo con el que el motor da por
//     pagado el recibo, tentativa («¿Recibo: X?») si solo se parece;
//   · «No es este recibo» y «Confirmar pago» ponen y quitan la marca sin mover el saldo, y el
//     veto no se pierde al renombrar ni al llegar el estado de otro móvil;
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
// [comercio, recibo, etiqueta]: lo que la lista escribe junto a cada fila.
const etiquetas=(filas,s)=>j(filas.map(e=>[e.merchant,e.reciboId||null,c.reciboEtiqueta(s,e)]));
const candidatos=txs=>txs.map(t=>({kind:"out",ent:t.ent,date:t.date,amount:t.amount,merchant:t.merchant,card:!!t.card,id:t.ext_id}));
// Lo que hace la pantalla de Importar histórico con las filas marcadas y destino Gasto.
const importaHistorico=(cands,s)=>{ const rows=[...c.histClassifyCandidates(cands,s).rows];
  return {rows,filas:cands.map((x,i)=>rows[i].status==="new"?c.histFilaGasto(x,rows[i],rows[i].category||"otros","hist-x"):null).filter(Boolean)}; };

test("sync diario: el adeudo entra en Gastos enlazado a su recibo y el recibo queda pagado", ()=>{
  const r=sincroniza(estado(),[TX_COM,TX_MOV]);
  assert.equal(j(r.add.map(e=>[e.merchant,e.amount,e.reciboId,e.source,e.extId])),
    j([["COMUNIDAD DE PROPIETARIOS",50,"com","ob","t1"],["Pepe Mobile, S.L.U.",102,"mov","ob","t2"]]));
  assert.equal(pagados(r.state),"com,mov");
  assert.equal(pagados(Object.assign({},r.state,{bankTx:[]})),"com,mov","sigue pagado en un móvil sin extracto");
  assert.equal(j(r.add.map(e=>c.expenseBucket(e,r.state))),j(["recibo","recibo"]));
  assert.equal(etiquetas(r.add,r.state),j([["COMUNIDAD DE PROPIETARIOS","com","Recibo: Comunidad"],["Pepe Mobile, S.L.U.","mov","Recibo: Pepe Mobile, S.L.U."]]));
  assert.equal(sincroniza(r.state,[TX_COM,TX_MOV]).add.length,0,"volver a sincronizar no repite la fila");
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
  // `antes`: el banco no manda los adeudos (equivale a tirarlos). `despues`: con ellos.
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
    // La medida no está ciega: si la fila contara, el gastado subiría donde el banco cuenta.
    const contando=Object.assign({},d,{reciboNo:d.expenses.filter(e=>e.reciboId).map(e=>e.reciboId+"|#"+e.id)});
    const cuentaSb=rol!=="solo recibos",cuentaCx=rol==="para todo";
    assert.equal(+(gastado(contando)-gastado(d)).toFixed(2),(cuentaSb?152:0)+(cuentaCx?61.4:0));
  });

  test("al cruzar de mes el cierre no vuelve a restar el recibo · Sabadell "+rol, ()=>{
    const a=antes(),d=despues().state;
    // Y el camino sin sync: las filas entraron por Importar histórico y nadie ancló después.
    const h=importaHistorico(candidatos([TX_COM,TX_MOV,TX_LUZ]),a).filas;
    assert.equal(marcas(h),j([["COMUNIDAD DE PROPIETARIOS","com"],["Pepe Mobile, S.L.U.","mov"],["LUZ HOGAR SL","luz"]]));
    const soloHist=Object.assign({},a,{expenses:h.concat(a.expenses)});
    assert.equal(j(mostrado(soloHist)),j(mostrado(a)),"importar del histórico tampoco mueve el saldo pintado");
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

// ───── Qué se marca y con qué etiqueta: lo mismo que se tiraba; lo dudoso, con pregunta ─────
const todo=o=>estado(Object.assign({accounts:[{id:"sb",ent:"sabadell",role:"ambos",spendFrom:true,value:2000}],settings:{}},o));
for(const [nombre,recibo,txs,esperado,cuenta] of [
  ["«Agua» y una compra en AGUACATES de importe parecido: se tiraba, ahora se ve con la pregunta",F("ag","Agua",30,10),
    [T("a1","sabadell","2026-10-08",30.2,"AGUACATES DEL SUR",{card:true})],[["AGUACATES DEL SUR","ag","¿Recibo: Agua?"]],0],
  ["«Seguro coche» y SEGURO DENTAL",F("sc","Seguro coche",40,5),[T("a1","sabadell","2026-10-06",40.3,"SEGURO DENTAL SANITAS")],[["SEGURO DENTAL SANITAS","sc","¿Recibo: Seguro coche?"]],0],
  ["nombre igual pero importe que no es el del recibo (una derrama): cuenta, como contaba",F("com","Comunidad",50,12),
    [T("a1","sabadell","2026-10-09",180,"COMUNIDAD DE PROPIETARIOS")],[["COMUNIDAD DE PROPIETARIOS",null,""]],180],
  ["dos cargos del mismo comercio: se tiraban los dos; el motor no sabe cuál es y los dos preguntan",F("nf","Netflix",12.99,5),
    [T("a1","sabadell","2026-10-05",12.99,"NETFLIX.COM"),T("a2","sabadell","2026-10-09",13,"NETFLIX SHOP MERCH",{card:true})],
    [["NETFLIX SHOP MERCH","nf","¿Recibo: Netflix?"],["NETFLIX.COM","nf","¿Recibo: Netflix?"]],0],
  ["cobro doble idéntico en dos días",F("com","Comunidad",50,5),
    [T("a1","sabadell","2026-10-05",50,"COMUNIDAD DE PROPIETARIOS"),T("a2","sabadell","2026-10-11",50,"COMUNIDAD DE PROPIETARIOS")],
    [["COMUNIDAD DE PROPIETARIOS","com","¿Recibo: Comunidad?"],["COMUNIDAD DE PROPIETARIOS","com","¿Recibo: Comunidad?"]],0],
  ["el cargo en otro banco que el del recibo: no se tiraba",F("com","Comunidad",50,5,"caixabank"),[T("a1","sabadell","2026-10-05",50,"COMUNIDAD DE PROPIETARIOS")],[["COMUNIDAD DE PROPIETARIOS",null,""]],50],
  ["un recibo anual fuera de su mes: no se tiraba",{id:"sg",name:"Seguro hogar",amount:312.4,freq:"año",months:[3],account:"sabadell",day:10},
    [T("a1","sabadell","2026-10-08",312.4,"SEGURO HOGAR")],[["SEGURO HOGAR",null,""]],312.4],
  ["un cargo todavía pendiente: se tiraba; pregunta hasta que se contabilice",F("com","Comunidad",50,5),
    [T("a1","sabadell","2026-10-05",50,"COMUNIDAD DE PROPIETARIOS",{status:"PDNG"})],[["COMUNIDAD DE PROPIETARIOS","com","¿Recibo: Comunidad?"]],0],
  ["un banco que no informa del estado",F("com","Comunidad",50,5),
    [T("a1","sabadell","2026-10-05",50,"COMUNIDAD DE PROPIETARIOS",{status:""})],[["COMUNIDAD DE PROPIETARIOS","com","¿Recibo: Comunidad?"]],0],
]){
  test("marca y etiqueta: "+nombre, ()=>{
    const r=sincroniza(todo({fixed:[recibo]}),txs,{sabadell:1500});
    assert.equal(etiquetas(r.add,r.state),j(esperado));
    assert.equal(+gastado(r.state).toFixed(2),cuenta);
    assert.equal(mostrado(r.state)[0],1500,"el saldo pintado es el del banco");
  });
}

test("un cargo que casa con dos recibos se asigna al que el motor da por pagado; si no, al de nombre completo", ()=>{
  const dos=[F("sc","Seguro coche",40,5),F("sh","Seguro hogar",40.3,6)];
  const r=sincroniza(todo({fixed:dos}),[T("a1","sabadell","2026-10-06",40.3,"SEGURO HOGAR MAPFRE")],{sabadell:1900});
  assert.equal(etiquetas(r.add,r.state),j([["SEGURO HOGAR MAPFRE","sh","Recibo: Seguro hogar"]]),"dos recibos casan por «seguro»: se queda el que el motor da por pagado");
  // Con el primero ya pagado por otro cargo, el motor acredita el segundo con este.
  const pagado=todo({fixed:[Object.assign({},dos[0],{paidYm:2026*12+10,paidDay:5}),dos[1]]});
  const r2=sincroniza(pagado,[T("a1","sabadell","2026-10-06",40.3,"SEGURO HOGAR MAPFRE")],{sabadell:1900});
  assert.equal(r2.add[0].reciboId,"sh");
  // El motor manda sobre el orden: los dos llevan su nombre entero en el comercio y gana el más específico.
  const largos=[F("sg","Seguro",40,5),F("hm","Hogar Mapfre",40.3,6)];
  assert.equal(etiquetas(sincroniza(todo({fixed:largos}),[T("a1","sabadell","2026-10-06",40.3,"SEGURO HOGAR MAPFRE")],{sabadell:1900}).add,todo({fixed:largos})),j([["SEGURO HOGAR MAPFRE","hm","¿Recibo: Hogar Mapfre?"]]));
  // Sin nombre completo en ninguno, el primero que casa: el que habría ganado el descarte.
  const genericos=[F("s1","Seguro Mapfre coche",40,5),F("s2","Seguro Mapfre hogar",40.2,6)];
  assert.equal(sincroniza(todo({fixed:genericos}),[T("a1","sabadell","2026-10-06",40.1,"MAPFRE SEGUROS")],{sabadell:1900}).add[0].reciboId,"s1");
});

test("pendiente → contabilizado: la etiqueta pasa a firme y el saldo es el del banco en todo momento", ()=>{
  for(const rol of ["ambos","diario"]){
    const s=todo({accounts:[{id:"sb",ent:"sabadell",role:rol,spendFrom:true,value:2000}],fixed:[F("nf","Netflix",12.99,5)]});
    const pend=sincroniza(s,[T("n1","sabadell","2026-10-05",12.99,"NETFLIX.COM",{status:"PDNG",card:true})],{sabadell:1987.01});
    assert.equal(etiquetas(pend.add,pend.state),j([["NETFLIX.COM","nf","¿Recibo: Netflix?"]]));
    assert.equal(mostrado(pend.state)[0],1987.01,rol);
    const book=sincroniza(pend.state,[T("n1","sabadell","2026-10-05",12.99,"NETFLIX.COM",{card:true})],{sabadell:1987.01});
    assert.equal(book.add.length,0,"no se repite la fila");
    assert.equal(etiquetas(book.state.expenses,book.state),j([["NETFLIX.COM","nf","Recibo: Netflix"]]));
    assert.equal(mostrado(book.state)[0],1987.01,rol);
    assert.equal(gastado(book.state),0);
    assert.equal(pagados(book.state),"nf");
  }
});

test("un puntual del Plan marca su cargo, y la etiqueta es firme solo con nombre completo y céntimos exactos", ()=>{
  const o={id:"o1",name:"ITV coche",amount:45,account:"sabadell",month:10,year:2026,day:9};
  const r=sincroniza(todo({fixed:[],oneoffs:[o]}),[T("a1","sabadell","2026-10-09",45,"ITV COCHE MADRID"),T("a2","sabadell","2026-10-10",45.2,"ESTACION ITV",{card:true}),T("a3","sabadell","2026-10-11",45.3,"TALLER COCHE SL")],{sabadell:1900});
  assert.equal(etiquetas(r.add,r.state),j([["TALLER COCHE SL","o1","¿Recibo: ITV coche?"],["ESTACION ITV",null,""],["ITV COCHE MADRID","o1","Recibo: ITV coche"]]));
  assert.equal(gastado(r.state),45.2);
  // El nombre solo no basta: con otro importe es otro gasto.
  const caro=sincroniza(todo({fixed:[],oneoffs:[o]}),[T("a4","sabadell","2026-10-09",120,"ITV COCHE MADRID")],{sabadell:1880});
  assert.equal(marcas(caro.add),j([["ITV COCHE MADRID",null]]));
});

test("un recibo que cuesta lo mismo que el aporte mensual no compra participaciones", ()=>{
  const s=todo({accounts:[{id:"sb",ent:"sabadell",role:"ambos",spendFrom:true,value:2000,monthlyInvest:50,rewardInv:"fondo"}],
    investments:[{id:"fondo",value:1000,cost:1000,shares:10,cur:"EUR"}],fixed:[F("com","Comunidad",50,12)]});
  const r=sincroniza(s,[TX_COM,T("a2","sabadell","2026-10-02",50,"Aporte plan",{card:false})],{sabadell:1900});
  assert.equal(j(r.add.map(e=>[e.merchant,e.reciboId||null,e.category==="inversion"])),j([["COMUNIDAD DE PROPIETARIOS","com",false],["Aporte plan",null,true]]));
});

test("Importar histórico: fila nueva y marcada, con su recibo; firme o con pregunta", ()=>{
  const s=estado(),cands=candidatos([TX_COM,TX_MOV]);
  const {rows,filas}=importaHistorico(cands,s);
  assert.equal(j(rows.map(r=>[r.status,r.reason,r.defDest,r.reciboId,r.match.name,r.suggestRecibo,r.firme])),
    j([["new","recibo","gasto","com","Comunidad",false,true],["new","recibo","gasto","mov","Pepe Mobile, S.L.U.",false,true]]));
  assert.equal(j(filas.map(e=>[e.source,e.reciboId,e.extId,e.importBatchId])),j([["ob-hist","com","t1","hist-x"],["ob-hist","mov","t2","hist-x"]]));
  const tras=estado({expenses:filas});
  assert.equal(pagados(tras),"com,mov","sin extracto local, la fila importada acredita el recibo");
  assert.ok([...c.histClassifyCandidates(cands,tras).rows].every(r=>r.status==="dup"&&r.reason==="existing"),"y la segunda vez ya consta como apuntada");
  // Lo que solo se parece entra igual de marcado, pero la pantalla lo dice con «parece».
  const dudosos=candidatos([T("n2","sabadell","2026-10-09",13,"NETFLIX SHOP MERCH"),T("n1","sabadell","2026-10-05",12.99,"NETFLIX.COM")]);
  assert.equal(j([...c.histClassifyCandidates(dudosos,estado({fixed:[F("nf","Netflix",12.99,5)]})).rows].map(r=>[r.reciboId,r.firme])),j([["nf",false],["nf",true]]));
  // Un recibo que no toca ese mes no casa, y una compra con tarjeta tampoco: así era.
  const anual={id:"sg",name:"Seguro hogar",amount:312.4,freq:"año",months:[3],account:"sabadell",day:10};
  const fuera=candidatos([T("s9","sabadell","2026-09-08",312.4,"SEGURO HOGAR"),T("s3","sabadell","2026-03-10",312.4,"SEGURO HOGAR"),T("s4","sabadell","2026-03-11",312.4,"SEGURO HOGAR",{card:true})]);
  assert.equal(j([...c.histClassifyCandidates(fuera,estado({fixed:[anual]})).rows].map(r=>r.reciboId||null)),j([null,"sg",null]));
});

test("lo que él importó a mano el 12/10 no se duplica ni se toca; al confirmar el pago a mano queda marcado sin mover el saldo", ()=>{
  const suyas=[TX_COM,TX_MOV].map((t,i)=>({id:"h"+i,date:new Date(t.date+"T12:00:00").toISOString(),merchant:t.merchant,amount:t.amount,category:"otros",source:"ob-hist",ent:t.ent,extId:t.ext_id}));
  const sinId=suyas.map(e=>{ const x=Object.assign({},e); delete x.extId; return x; });
  assert.equal(sincroniza(estado({expenses:sinId}),[TX_COM,TX_MOV].map(t=>Object.assign({},t,{ext_id:null}))).add.length,0,"sin id: día, importe y nombre");
  for(const rol of ["fijos","ambos","diario"]){
    const acc=rol==="fijos"?clon(unaCuenta):[{id:"sb",ent:"sabadell",role:rol,spendFrom:true,value:2000}];
    // Recibo con otro nombre que el del banco: nada lo acredita solo y hace falta el vínculo a mano.
    const r=sincroniza(estado({accounts:acc,expenses:clon(suyas),fixed:[F("com","Cuota vecinos",50,12),F("mov","Pepe Mobile, S.L.U.",102,5)]}),[TX_COM,TX_MOV]);
    assert.equal(r.add.length,0,"mismo id del banco");
    assert.equal(marcas(r.state.expenses),j([["COMUNIDAD DE PROPIETARIOS",null],["Pepe Mobile, S.L.U.",null]]),"siguen como estaban");
    const vinculado=c.linkFixedPayment(r.state,"h0","com",2026,10,12);
    assert.equal(c.fixedPaymentState(vinculado,vinculado.fixed[0],2026,10,12).paid,true);
    const m=c.marcarCargoDeReciboVinculado(vinculado,"h0","com");
    assert.equal(m.e.reciboId,"com");
    assert.equal(c.expenseSourceForCloud(m.e),"ob-hist:sabadell~recibo.com");
    assert.equal(j(mostrado(m.state)),j(mostrado(vinculado)),"el saldo pintado no se mueve · "+rol);
    assert.equal(+(gastado(vinculado)-gastado(m.state)).toFixed(2),rol==="fijos"?0:50,"y deja de contar como compra · "+rol);
    assert.equal(c.marcarCargoDeReciboVinculado(r.state,"h0","com"),null,"sin vínculo guardado no hay marca");
    assert.equal(c.marcarCargoDeReciboVinculado(vinculado,"h1","com"),null,"ni para otro cargo");
  }
  // Un aviso del móvil no sabe llevar la marca a la nube: se queda como está.
  const aviso={id:"w1",date:"2026-10-12T09:00:00.000Z",merchant:"COMUNIDAD DE PROPIETARIOS",amount:50,category:"otros",source:"wallet",ent:"sabadell"};
  const conAviso=estado({expenses:[aviso],fixed:[F("com","Cuota vecinos",50,12)]});
  const v=c.linkFixedPayment(conAviso,"w1","com",2026,10,12);
  assert.equal(c.fixedPaymentState(v,v.fixed[0],2026,10,12).paid,true,"el vínculo sí se guarda");
  assert.equal(c.marcarCargoDeReciboVinculado(v,"w1","com"),null);
});

test("una fila de recibo borrada no vuelve con el siguiente sync", ()=>{
  const r=sincroniza(estado(),[TX_COM,TX_MOV]);
  const borrada=r.add.find(e=>e.reciboId==="com");
  const s=Object.assign({},r.state,{expenses:r.state.expenses.filter(e=>e.id!==borrada.id),deleted:[c.keyOfExpense(borrada)]});
  assert.equal(sincroniza(s,[TX_COM,TX_MOV]).add.length,0);
});

for(const [rol,accounts,settings] of ROLES){
  test("«No es este recibo»: el cargo pasa a contar, el recibo vuelve a pendiente y el saldo no se mueve · Sabadell "+rol, ()=>{
    const r=sincroniza(estado({accounts:clon(accounts),settings:clon(settings)}),[TX_COM,TX_MOV],{sabadell:1848});
    const fila=r.state.expenses.find(e=>e.reciboId==="com");
    const q=c.quitarCargoDeRecibo(r.state,fila.id);
    assert.equal(q.e.reciboId,undefined);
    assert.equal(c.expenseSourceForCloud(q.e),"ob:sabadell","la fila sube sin la marca");
    assert.equal(q.state.reciboNo.length,2,"el veto viaja en el estado, por identidad del cargo y por fila");
    assert.equal(pagados(q.state),"mov","el recibo deja de estar pagado con ese cargo, también con el extracto delante");
    assert.equal(pagados(Object.assign({},q.state,{bankTx:[]})),"mov","y sin extracto");
    assert.equal(+(gastado(q.state)-gastado(r.state)).toFixed(2),rol==="solo recibos"?0:50);
    assert.equal(j(mostrado(q.state)),j(mostrado(r.state)),"el saldo pintado sigue siendo el del banco");
    assert.equal(mostrado(q.state)[0],1848);
    const otra=sincroniza(q.state,[TX_COM,TX_MOV],{sabadell:1848});
    assert.equal(otra.add.length,0);
    assert.equal(marcas(otra.state.expenses.filter(e=>e.id===fila.id)),j([["COMUNIDAD DE PROPIETARIOS",null]]),"el siguiente sync no la vuelve a marcar");
    assert.equal(pagados(otra.state),"mov","ni paga el recibo con ella");
    assert.equal(c.quitarCargoDeRecibo(q.state,fila.id),null,"no hay nada que quitar dos veces");
    // Si se arrepiente y vuelve a confirmar el pago con ese mismo cargo, lo último que dijo manda.
    const sinExtracto=Object.assign({},q.state,{bankTx:[]});
    assert.equal(pagados(c.linkFixedPayment(sinExtracto,fila.id,"com",2026,10,12)),"mov","con el veto puesto, un vínculo guardado no paga");
    const sinVeto=c.levantarVetoDeRecibo(sinExtracto,fila.id,"com");
    assert.equal(sinVeto.reciboNo.length,0);
    assert.equal(c.levantarVetoDeRecibo(sinVeto,fila.id,"com"),sinVeto,"sin veto no reescribe el estado");
    assert.equal(pagados(sinVeto),"com,mov");
    // Renombrar el comercio de la fila no devuelve el pago: el veto también va por su id.
    const renombrada=Object.assign({},q.state,{bankTx:[],expenses:q.state.expenses.map(e=>e.id===fila.id?Object.assign({},e,{merchant:"Comunidad",obName:"Comunidad"}):e)});
    assert.equal(pagados(renombrada),"mov");
    // Otro móvil: su fila sigue marcada, pero ya le llegó el estado con el veto.
    const otroMovil=Object.assign({},r.state,{reciboNo:q.state.reciboNo,fixed:q.state.fixed});
    assert.equal(c.cargoDeRecibo(otroMovil.expenses.find(e=>e.id===fila.id),otroMovil),null);
    assert.equal(gastado(otroMovil),gastado(q.state));
    // Otro cargo distinto sí puede pagar ese recibo, también en un móvil sin extracto.
    const t9={id:"h9",date:"2026-10-10T10:00:00.000Z",merchant:"COMUNIDAD DE PROPIETARIOS",obName:"COMUNIDAD DE PROPIETARIOS",amount:50,category:"recibos",source:"ob-hist",ent:"sabadell",extId:"t9"};
    assert.equal(pagados(Object.assign({},q.state,{bankTx:[],expenses:[t9].concat(q.state.expenses)})),"com,mov");
    const nuevo=sincroniza(q.state,[TX_COM,TX_MOV,T("t9","sabadell","2026-10-10",50,"COMUNIDAD DE PROPIETARIOS")],{sabadell:1798});
    assert.equal(etiquetas(nuevo.add,nuevo.state),j([["COMUNIDAD DE PROPIETARIOS","com","Recibo: Comunidad"]]));
    assert.equal(pagados(nuevo.state),"com,mov");
  });
}

test("los vetos se suman al bajar el estado de otro móvil y la lista tiene tope", ()=>{
  assert.equal(j(c.reciboNoUnion(["a|1"],["b|2","a|1"])),j(["a|1","b|2"]));
  const local=["a|1"];
  assert.equal(c.reciboNoUnion(local,[]),local,"una lista vacía de la nube no borra lo local");
  assert.equal(c.reciboNoUnion(local,["a|1"]),local,"sin novedades devuelve la misma lista: no reescribe el estado");
  const muchos=Array.from({length:500},(_,i)=>"r|"+i);
  const unidos=c.reciboNoUnion(["x|0"],muchos);
  assert.equal(unidos.length,400);
  assert.equal(unidos[unidos.length-1],"r|499","se conservan los más recientes");
  // Y `quitarCargoDeRecibo` pasa por ahí: tampoco crece sin fin.
  const r=sincroniza(estado({reciboNo:muchos.slice(0,400)}),[TX_COM,TX_MOV]);
  assert.equal(c.quitarCargoDeRecibo(r.state,r.state.expenses.find(e=>e.reciboId==="com").id).state.reciboNo.length,400);
});

test("recibo borrado después: la fila cuenta como un gasto normal y no enseña etiqueta", ()=>{
  const r=sincroniza(todo(),[TX_COM,TX_MOV],{sabadell:1848});
  const sin=Object.assign({},r.state,{fixed:r.state.fixed.filter(f=>f.id!=="com")});
  const fila=sin.expenses.find(e=>e.reciboId==="com");
  assert.equal(c.cargoDeRecibo(fila,sin),null);
  assert.equal(c.reciboNombre(sin,fila),"");
  assert.equal(c.reciboEtiqueta(sin,fila),"");
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
    // Así lee el banco la beta ya instalada y el servidor del widget (`bancoDeSource`): un
    // banco que no existe, que ninguna lista de gasto diario contiene.
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

test("la marca que baja de la nube se adopta; la cuota de deuda manda sobre la de recibo, en local y en la nube", ()=>{
  const local={id:"x",date:"2026-10-05T10:00:00.000Z",merchant:"Pepe Mobile, S.L.U.",amount:102,category:"otros",source:"ob",ent:"sabadell"};
  assert.equal(c.refreshExpenseFromCloud(local,Object.assign({},local,{reciboId:"mov"})).reciboId,"mov");
  assert.equal(c.refreshExpenseFromCloud(Object.assign({},local,{reciboId:"mov"}),local).reciboId,"mov","una fila de la nube sin marca no borra la local");
  const deuda={id:"d1",name:"Financiación móvil",monthly:102,day:5,account:"sabadell",value:1000};
  const r=sincroniza(estado({debts:[deuda]}),[TX_COM,TX_MOV]);
  assert.equal(c.cuotasDeDeudaPorMarcar(r.state).length,0,"si casa con recibo y con deuda, gana el recibo, como ganaba el descarte");
  const fila=r.state.expenses.find(e=>e.reciboId==="mov");
  const m=c.marcarCuotaAMano(r.state,fila.id,"d1");
  assert.equal(j([m.e.debtId,m.e.reciboId]),j(["d1",undefined]));
  assert.equal(c.expenseSourceForCloud(m.e),"ob:sabadell~deuda.d1");
  // Una fila que llega con las dos marcas (de un estado viejo) es cuota: no es cargo de recibo.
  const dosMarcas=Object.assign({},fila,{debtId:"d1",category:"deudas"});
  assert.equal(c.cargoDeRecibo(dosMarcas,r.state),null);
  assert.equal(c.expenseBucket(dosMarcas,r.state),"deuda");
});

test("los lectores que suman gastos por su cuenta tampoco cuentan el cargo de un recibo", ()=>{
  const r=sincroniza(todo({accounts:[{id:"sb",ent:"sabadell",role:"ambos",spendFrom:true,value:2000,roundup:1}]}),[TX_COM,TX_MOV].concat([T("p1","sabadell","2026-10-07",3.4,"Panadería Sol",{card:true})]),{sabadell:1844.6});
  const foto=c.buildHouseholdSnapshot(r.state,{},"a@b.c");
  assert.equal(+[...foto.expensesByCat].reduce((n,x)=>n+x.spent,0).toFixed(2),3.4,"la foto del hogar ya lleva los recibos en sus fijos");
  // La tarjeta de redondeo de Cartera: solo redondea la compra, no los recibos.
  const tr=r.state.accounts[0], desde=new Date("2026-10-01T00:00:00+02:00").getTime();
  const soloCompra=Object.assign({},r.state,{expenses:r.state.expenses.filter(e=>!e.reciboId)});
  assert.equal(j(c.recompensasDelMes(r.state,tr,desde)),j(c.recompensasDelMes(soloCompra,tr,desde)));
  const sinMarca=Object.assign({},r.state,{expenses:r.state.expenses.map(e=>{ const x=Object.assign({},e); delete x.reciboId; return x; })});
  assert.notEqual(j(c.recompensasDelMes(sinMarca,tr,desde)),j(c.recompensasDelMes(r.state,tr,desde)),"control: sin la marca el redondeo sí cambia");
  assert.equal(j(c.recompensasDelMes(r.state,null,desde)),j({ru:0,sb:0}));
  const tresMeses=["08","09","10"].map((m,i)=>({id:"s"+i,date:"2026-"+m+"-05T10:00:00.000Z",merchant:"Pepe Mobile, S.L.U.",amount:102,category:"otros",source:"ob",ent:"sabadell",reciboId:"mov"}));
  assert.equal(c.detectSubscriptions(tresMeses).length,0);
  assert.equal(c.detectSubscriptions(tresMeses.map(e=>Object.assign({},e,{reciboId:undefined}))).length,1,"sin marca sí se detecta: el control");
});

test("al subir una fila de recibo se reescribe su `source` en la nube aunque la fila ya existiera sin marca", async ()=>{
  // Nube falsa: el alta ignora duplicados (como el upsert real) y la otra escritura va por clave.
  c.__nube={filas:[{fecha:"2026-10-05T10:00:00.000Z",importe:102,comercio:"Pepe Mobile, S.L.U.",source:"ob-hist:sabadell"}],llamadas:[]};
  vm.runInNewContext(`
    cloud.enabled=function(){ return true; };
    cloud.addExpense=function(e){ __nube.llamadas.push("alta");
      if(!__nube.filas.some(function(f){ return f.fecha===e.date&&f.importe===e.amount&&f.comercio===e.merchant; }))
        __nube.filas.push({fecha:e.date,importe:e.amount,comercio:e.merchant,source:expenseSourceForCloud(e)});
      return Promise.resolve(); };
    cloud.setExpenseBank=function(e,ent){ const k=expenseCloudKeys(e); __nube.llamadas.push("source por "+k.by);
      __nube.filas.forEach(function(f){ if(k.by==="attrs"&&f.fecha===k.fecha&&f.importe===k.importe&&f.comercio===k.comercio) f.source=expenseSourceForCloud(Object.assign({},e,{ent:ent})); });
      return Promise.resolve(); };
  `,c);
  const marcada={id:"11111111-1111-4111-8111-111111111111",date:"2026-10-05T10:00:00.000Z",merchant:"Pepe Mobile, S.L.U.",amount:102,category:"otros",source:"ob",ent:"sabadell",reciboId:"mov"};
  await c.subirGasto(marcada,"test");
  assert.equal(j(c.__nube.llamadas),j(["alta","source por attrs"]));
  assert.equal(c.__nube.filas[0].source,"ob:sabadell~recibo.mov","la fila que ya estaba en la nube deja de contar en el widget");
  // Una fila normal no hace la segunda escritura.
  c.__nube.llamadas=[];
  await c.subirGasto(Object.assign({},marcada,{reciboId:undefined,merchant:"Compra"}),"test");
  assert.equal(j(c.__nube.llamadas),j(["alta"]));
});
