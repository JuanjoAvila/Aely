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
//   · «No es este recibo» quita la marca sin mover el saldo; el veto no se pierde al renombrar ni
//     al llegar el estado de otro móvil, y volver a confirmar el pago con ese cargo lo deshace
//     en los dos móviles. Confirmar el pago con un cargo cualquiera NO marca: el gastado se
//     queda como en la 4.26.119, que es lo que promete su diálogo;
//   · un recibo borrado no deja filas fuera de las cuentas ni mueve el saldo;
//   · el cargo de un recibo no se puede reconocer como retirada de efectivo.
// Datos sintéticos; el reloj es fijo y se mueve a mano para cruzar de mes.
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
const enlaces=(txs,saldos)=>Object.keys(saldos).map(ent=>({aspsp:ASPSP[ent]||ent,ok:true,
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
    const contando=Object.assign({},d,{reciboNo:d.expenses.filter(e=>e.reciboId).map(e=>e.reciboId+"|#"+e.id+"|x")});
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

test("la etiqueta recordada sobrevive a un alta de otro mes y se vuelve a calcular con una del suyo", ()=>{
  const r=sincroniza(todo(),[TX_COM,TX_MOV],{sabadell:1848});
  // Sin extracto ni prueba guardada: el recibo se acredita por la propia fila, que es lo que un alta puede cambiar.
  const s=Object.assign({},r.state,{bankTx:[],fixed:r.state.fixed.map(f=>{ const x=Object.assign({},f); delete x.paymentProofs; return x; })});
  const fila=s.expenses.find(e=>e.reciboId==="com");
  const motor=c.fixedPaymentState; let consultas=0;
  c.fixedPaymentState=function(){ consultas++; return motor.apply(this,arguments); };
  try{
    assert.equal(c.reciboEtiqueta(s,fila),"Recibo: Comunidad");
    assert.ok(consultas>0);
    consultas=0;
    assert.equal(c.reciboEtiqueta(s,fila),"Recibo: Comunidad");
    const cafe={id:"cafe",date:"2026-09-30T08:00:00.000Z",merchant:"Café",amount:1.5,category:"bares",source:"manual"};
    const otroMes=Object.assign({},s,{expenses:[cafe].concat(s.expenses)});
    assert.equal(c.reciboEtiqueta(otroMes,fila),"Recibo: Comunidad");
    assert.equal(consultas,0,"un apunte de septiembre no obliga a preguntar otra vez al motor por octubre");
    // Un segundo cargo idéntico en su mes sí cambia la respuesta: el motor ya no sabe cuál es.
    const gemelo=Object.assign({},fila,{id:"gemelo",extId:"t9"});
    const mismoMes=Object.assign({},otroMes,{expenses:[gemelo].concat(otroMes.expenses)});
    assert.equal(c.reciboEtiqueta(mismoMes,fila),"¿Recibo: Comunidad?");
    assert.ok(consultas>0);
    // Y cambiar el Plan lo invalida todo, también lo de otros meses.
    consultas=0;
    assert.equal(c.reciboEtiqueta(Object.assign({},otroMes,{fixed:otroMes.fixed.slice()}),fila),"Recibo: Comunidad");
    assert.ok(consultas>0);
  } finally { c.fixedPaymentState=motor; }
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
  // Un recibo sin id (sembrado antes de tenerlos) no tiene a qué enlazar la fila: sigue sin
  // entrar, y con su motivo propio, que la pantalla rotula «ya está en tu Plan».
  const sinId=estado({fixed:[{name:"Comunidad",amount:50,freq:"mes",day:12,account:"sabadell"}]});
  assert.equal(j([...c.histClassifyCandidates(candidatos([TX_COM]),sinId).rows].map(r=>[r.status,r.reason,r.reciboId||null])),j([["dup","modeled",null]]));
  // Un recibo que no toca ese mes no casa, y una compra con tarjeta tampoco: así era.
  const anual={id:"sg",name:"Seguro hogar",amount:312.4,freq:"año",months:[3],account:"sabadell",day:10};
  const fuera=candidatos([T("s9","sabadell","2026-09-08",312.4,"SEGURO HOGAR"),T("s3","sabadell","2026-03-10",312.4,"SEGURO HOGAR"),T("s4","sabadell","2026-03-11",312.4,"SEGURO HOGAR",{card:true})]);
  assert.equal(j([...c.histClassifyCandidates(fuera,estado({fixed:[anual]})).rows].map(r=>r.reciboId||null)),j([null,"sg",null]));
});

test("lo que él importó a mano el 12/10 no se duplica ni se toca; confirmar el pago a mano no cambia el gastado ni el saldo", ()=>{
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
    // Lo que hace la ficha al confirmar: sin un «no es este recibo» previo no hay nada que
    // reponer y el vínculo es el de siempre. La 4.26.119 dejaba el gastado donde estaba.
    assert.equal(c.reponerCargoDeRecibo(r.state,"h0","com",2026,10,12),null,"sin veto no hay marca · "+rol);
    assert.equal(marcas(vinculado.expenses),marcas(r.state.expenses),"el cargo sigue sin marca · "+rol);
    assert.equal(gastado(vinculado),gastado(r.state),"el gastado se conserva · "+rol);
    assert.equal(j(mostrado(vinculado)),j(mostrado(r.state)),"y el saldo pintado · "+rol);
    assert.equal(j(vinculado.accounts),j(r.state.accounts),"y la base · "+rol);
  }
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
    assert.equal(c.canRecognizeWithdrawal(q.e,q.state),true,"ya sin marca, es un cargo del banco como cualquier otro");
    assert.equal(c.canRecognizeWithdrawal(fila,r.state),false,"con la marca no se puede dar por retirada de efectivo");
    ahora=OCT12+60000;
    try{
      for(const [caso,s] of [["sin extracto",sinExtracto],["con el extracto delante",q.state]]){
        const rp=c.reponerCargoDeRecibo(s,fila.id,"com",2026,10,12);
        assert.equal(rp.state.reciboNo.length,0,caso);
        assert.equal(pagados(rp.state),"com,mov",caso);
        assert.equal(j([rp.e.reciboId,c.expenseSourceForCloud(rp.e)]),j(["com","ob:sabadell~recibo.com"]),"el cargo recupera su marca y así sube · "+caso);
        assert.equal(gastado(rp.state),gastado(r.state),"y todo vuelve a como estaba antes de vetarlo · "+caso);
        assert.equal(j(mostrado(rp.state)),j(mostrado(q.state)),"sin mover el saldo · "+caso);
        assert.equal(c.reponerCargoDeRecibo(rp.state,fila.id,"com",2026,10,12),null,"sin veto no hay nada que reponer");
      }
      // El veto es de ESE cargo con ESE recibo: con otro recibo no hay nada que deshacer, y si
      // el cargo cambió mientras el diálogo estaba abierto el veto se queda.
      assert.equal(c.reponerCargoDeRecibo(sinExtracto,fila.id,"mov",2026,10,12),null);
      const otroNombre=Object.assign({},sinExtracto,{fixed:sinExtracto.fixed.map(f=>f.id==="com"?Object.assign({},f,{name:"Cuota vecinos"}):f)});
      assert.equal(c.reponerCargoDeRecibo(otroNombre,fila.id,"com",2026,10,12,{identity:"la de antes de editarlo"}),null,"si no llega a pagar el recibo, no se levanta");
      assert.equal(pagados(c.reponerCargoDeRecibo(otroNombre,fila.id,"com",2026,10,12).state),"com,mov","y con el cargo intacto sí, aunque el nombre no case");
      // LOS DOS MÓVILES. B aún tiene la fila marcada y el veto que le llegó; A lo levanta después.
      const A=c.reponerCargoDeRecibo(sinExtracto,fila.id,"com",2026,10,12).state;
      const B=Object.assign({},r.state,{bankTx:[],reciboNo:q.state.reciboNo,reciboNoAt:q.state.reciboNoAt,fixed:q.state.fixed});
      const Bbaja=Object.assign({},B,{fixed:A.fixed},c.reciboNoUnion(B,A));
      assert.equal(Bbaja.reciboNo.length,0,"levantar el veto en A llega a B");
      assert.equal(gastado(Bbaja),gastado(A),"y los dos móviles cuentan lo mismo");
      // B sube su estado viejo (con el veto) antes de enterarse: A no lo recupera.
      assert.equal(c.reciboNoUnion(A,B).reciboNo.length,0,"el veto viejo de B no vuelve a A");
      // Y al revés: un veto puesto después de levantarlo sí gana.
      ahora=OCT12+120000;
      const otraVez=c.quitarCargoDeRecibo(A,fila.id).state;
      assert.equal(c.reciboNoUnion(Bbaja,otraVez).reciboNo.length,2);
      assert.equal(c.reciboNoUnion(otraVez,Bbaja).reciboNo.length,2);
      // MISMA FILA, OTRO ID LOCAL (cuarta revisión). En B la fila la bajó de la nube con otro id:
      // al levantar el veto encuentra por identidad la clave de fila que puso A, y A queda libre.
      ahora=OCT12+60000;
      const enB=Object.assign({},sinExtracto,{expenses:sinExtracto.expenses.map(e=>e.id===fila.id?Object.assign({},e,{id:"id-en-b"}):e)});
      const rb=c.reponerCargoDeRecibo(enB,"id-en-b","com",2026,10,12);
      assert.equal(rb.state.reciboNo.length,0,"B levanta las dos claves, también la que lleva el id de A");
      const Abaja=Object.assign({},sinExtracto,{fixed:rb.state.fixed,expenses:c.mergeExpensesFromCloud(sinExtracto.expenses,[c.expenseFromRow({id:"99999999-9999-4999-8999-999999999999",fecha:fila.date,importe:fila.amount,comercio:fila.merchant,cat:fila.category,source:c.expenseSourceForCloud(rb.e),ob_name:fila.obName})],ahora).list},c.reciboNoUnion(sinExtracto,rb.state));
      assert.equal(gastado(Abaja),gastado(r.state),"y A vuelve a no contarlo");
      assert.equal(pagados(Abaja),"com,mov");
      // RELOJ ATRASADO: B levanta con una hora ANTERIOR a la del veto de A y aun así gana, porque
      // conoce ese veto y lo que dice es posterior.
      ahora=OCT12-3600000;
      const tarde=c.reponerCargoDeRecibo(sinExtracto,fila.id,"com",2026,10,12).state;
      assert.equal(c.reciboNoUnion(sinExtracto,tarde).reciboNo.length,0);
      assert.ok(Object.values(tarde.reciboNoAt).every(t=>t===OCT12+1));
      // EL RECIBO CAMBIÓ DE BANCO tras el veto: la marca no puede volver (el cargo no es de ese
      // banco). Se guarda el vínculo, como en uno cualquiera, y el diálogo no promete otra cosa.
      ahora=OCT12+60000;
      const mudado=Object.assign({},sinExtracto,{fixed:sinExtracto.fixed.map(f=>f.id==="com"?Object.assign({},f,{account:"caixabank"}):f)});
      const cargo=mudado.expenses.find(e=>e.id===fila.id);
      assert.equal(c.admiteMarcaDe(cargo,mudado.fixed.find(f=>f.id==="com")),false);
      assert.equal(c.admiteMarcaDe(cargo,sinExtracto.fixed.find(f=>f.id==="com")),true);
      const rm=c.reponerCargoDeRecibo(mudado,fila.id,"com",2026,10,12);
      assert.equal(rm.e,null,"no se marca un cargo de otro banco");
      assert.equal(rm.state.expenses.some(e=>e.reciboId==="com"),false);
      assert.equal(pagados(rm.state),"com,mov","el vínculo sí se guarda");
      assert.equal(gastado(rm.state),gastado(mudado),"y el gastado se conserva, como dice su diálogo");
    } finally { ahora=OCT12; }
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

test("vetos entre móviles: sin hora se suman, con hora gana lo último que se dijo, y la lista tiene tope", ()=>{
  const u=(a,b)=>c.reciboNoUnion(a,b);
  // Listas de la versión anterior, sin hora: se suman como antes.
  assert.equal(j(u({reciboNo:["a|1"]},{reciboNo:["b|2","a|1"]}).reciboNo),j(["a|1","b|2"]));
  const local=["a|1"];
  assert.equal(u({reciboNo:local},{reciboNo:[]}).reciboNo,local,"una lista vacía de la nube, sin hora, no borra lo local");
  assert.equal(u({reciboNo:local},{reciboNo:["a|1"]}).reciboNo,local,"sin novedades devuelve la misma lista: no reescribe el estado");
  // Con hora: quien lo levantó después gana a quien aún lo tiene, y al revés.
  assert.equal(j(u({reciboNo:["a|1"],reciboNoAt:{"a|1":10}},{reciboNo:[],reciboNoAt:{"a|1":20}})),j({reciboNo:[],reciboNoAt:{"a|1":20}}));
  assert.equal(j(u({reciboNo:[],reciboNoAt:{"a|1":20}},{reciboNo:["a|1"],reciboNoAt:{"a|1":10}})),j({reciboNo:[],reciboNoAt:{"a|1":20}}));
  assert.equal(j(u({reciboNo:[],reciboNoAt:{"a|1":20}},{reciboNo:["a|1"],reciboNoAt:{"a|1":30}}).reciboNo),j(["a|1"]));
  assert.equal(j(u({reciboNo:[],reciboNoAt:{"a|1":20}},{reciboNo:["a|1"]}).reciboNo),j([]),"una lista vieja sin hora no resucita un veto levantado");
  const muchos=Array.from({length:500},(_,i)=>"r|"+i);
  const unidos=u({reciboNo:["x|0"]},{reciboNo:muchos}).reciboNo;
  assert.equal(unidos.length,400);
  assert.equal(unidos[unidos.length-1],"r|499","se conservan los más recientes");
  const horas={}; muchos.forEach((k,i)=>{ horas[k]=1000+i; });
  const conHora=u({reciboNo:[]},{reciboNo:muchos,reciboNoAt:horas});
  assert.equal(Object.keys(conHora.reciboNoAt).length,400);
  assert.equal(conHora.reciboNoAt["r|99"],undefined,"las horas más viejas se sueltan");
  assert.equal(conHora.reciboNoAt["r|499"],1499);
  // Y `quitarCargoDeRecibo` pasa por el mismo tope: tampoco crece sin fin.
  const r=sincroniza(estado({reciboNo:muchos.slice(0,400)}),[TX_COM,TX_MOV]);
  const q=c.quitarCargoDeRecibo(r.state,r.state.expenses.find(e=>e.reciboId==="com").id).state;
  assert.equal(q.reciboNo.length,400);
  assert.equal(j(Object.values(q.reciboNoAt)),j([OCT12,OCT12]),"cada veto apunta cuándo se puso");
});

test("recibo borrado después: la fila cuenta como un gasto normal y no enseña etiqueta", ()=>{
  const r=sincroniza(todo(),[TX_COM,TX_MOV],{sabadell:1848});
  const sin=Object.assign({},r.state,{fixed:r.state.fixed.filter(f=>f.id!=="com")});
  const fila=sin.expenses.find(e=>e.reciboId==="com");
  assert.equal(c.cargoDeRecibo(fila,sin),null);
  assert.equal(c.reciboEtiqueta(sin,fila),"");
  assert.equal(c.expenseBucket(fila,sin),"cuenta");
  assert.equal(gastado(sin)-gastado(r.state),50);
});

for(const [rol,accounts,settings] of ROLES){
  test("borrar un recibo o un puntual con su cargo en Gastos no mueve el saldo con el banco quieto · Sabadell "+rol, ()=>{
    const puntual={id:"o1",name:"ITV coche",amount:45,account:"sabadell",month:10,year:2026,day:9};
    const r=sincroniza(estado({accounts:clon(accounts),settings:clon(settings),oneoffs:[puntual]}),[TX_COM,TX_MOV,T("t3","sabadell","2026-10-09",45,"ITV COCHE MADRID")],{sabadell:1803});
    assert.equal(mostrado(r.state)[0],1803);
    for(const [lista,id,importe] of [["fixed","com",50],["oneoffs","o1",45]]){
      const borrado=c.sinCargoDelPlan(r.state,lista,id), sin=borrado.state;
      assert.equal(sin[lista].some(x=>x.id===id),false);
      // Sus filas pierden la marca, y son las que hay que reescribir en la nube.
      assert.equal(sin.expenses.some(e=>e.reciboId===id),false);
      assert.equal(j(borrado.subir.map(e=>[e.amount,e.reciboId||null,c.expenseSourceForCloud(e)])),j([[importe,null,"ob:sabadell"]]));
      assert.equal(j(mostrado(sin)),j(mostrado(r.state)),lista+": el saldo pintado sigue siendo el del banco");
      assert.equal(+(gastado(sin)-gastado(r.state)).toFixed(2),rol==="solo recibos"?0:importe,lista+": el cargo pasa a contar como un gasto");
      // Lo que entra por la puerta de la pantalla es esto mismo.
      let porPantalla=r.state; (lista==="fixed"?c.removeFixedById:c.removeOneoffById)(f=>{ porPantalla=f(porPantalla); },id);
      assert.equal(j(porPantalla),j(sin));
    }
    // Sin ningún cargo suyo en Gastos, borrar hace exactamente lo de siempre.
    const sinFilas=Object.assign({},r.state,{expenses:r.state.expenses.filter(e=>e.reciboId!=="com")});
    const nada=c.sinCargoDelPlan(sinFilas,"fixed","com");
    assert.equal(j(nada.state),j(Object.assign({},sinFilas,{fixed:sinFilas.fixed.filter(f=>f.id!=="com")})));
    assert.equal(nada.state.expenses,sinFilas.expenses,"y no reescribe el histórico");
    assert.equal(nada.subir.length,0);
    if(rol==="gasto diario"){
      // El control: sin sujetar, la cuenta de gasto diario bajaba el importe del cargo.
      const crudo=Object.assign({},r.state,{fixed:r.state.fixed.filter(f=>f.id!=="com")});
      assert.equal(+(mostrado(r.state)[0]-mostrado(crudo)[0]).toFixed(2),50);
    }
  });
}

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

test("el lector de `source` no se rompe con un sufijo `#n<k>` detrás de la marca", ()=>{
  // Orden acordado con la rama de apuntes iguales: ob:<ent>[~deuda.<id> | ~recibo.<id>][#dup][#n<k>].
  const fila=fuente=>({id:"11111111-1111-4111-8111-111111111111",fecha:"2026-10-05T10:00:00.000Z",comercio:"Pepe Mobile, S.L.U.",importe:102,cat:"otros",source:fuente});
  for(const [fuente,origen,dup] of [["ob:sabadell~recibo.mov#n2","ob",undefined],["ob:sabadell~recibo.mov#dup#n2","ob",true],["ob-hist:sabadell~recibo.mov#n3","ob-hist",undefined]]){
    const v=c.expenseFromRow(fila(fuente));
    assert.equal(j([v.source,v.ent,v.reciboId,v.possibleDup,c.expenseBankOf({source:fuente})]),j([origen,"sabadell","mov",dup,"sabadell"]),fuente);
  }
});

// ───── La nube: el cliente REAL de la app (`cloud.addExpense`, `cloud.setExpenseRecibo`) contra una
// tabla falsa en memoria con el índice único (user_id, fecha, importe, comercio) y el alta que
// ignora duplicados, como la de verdad. Sin red.
function nubeFalsa(previas){
  const tabla=previas.map((p,i)=>Object.assign({id:"old"+i,user_id:"u1"},p)), log=[];
  const clave=r=>[r.user_id,Date.parse(r.fecha),Number(r.importe),r.comercio].join("|");
  const from=()=>({
    upsert(fila){
      const nuevas=[]; if(!tabla.some(r=>clave(r)===clave(fila))){ const f=Object.assign({},fila); tabla.push(f); nuevas.push({id:f.id}); }
      log.push("alta");
      const res={data:null,error:null};
      return {then:(ok,ko)=>Promise.resolve(res).then(ok,ko),select:()=>Promise.resolve({data:nuevas,error:null})};
    },
    select(){ return consulta(hit=>{ log.push("lee "+hit.length); return hit.map(r=>({id:r.id,source:r.source})); }); },
    update(patch){ return consulta(hit=>{ log.push("cambia "+hit.length); hit.forEach(r=>Object.assign(r,patch)); return null; }); },
  });
  const consulta=hace=>{ const conds=[]; const q={ eq(col,val){ conds.push([col,val]); return q; },
    then(ok,ko){ const hit=tabla.filter(r=>conds.every(([col,v])=>col==="fecha"?Date.parse(r[col])===Date.parse(v):col==="importe"?Number(r[col])===Number(v):r[col]===v));
      return Promise.resolve({data:hace(hit),error:null}).then(ok,ko); } }; return q; };
  return {tabla,log,client:{auth:{getSession:async()=>({data:{session:{user:{id:"u1"},expires_at:9e9}},error:null}),onAuthStateChange(){ return {data:{subscription:{unsubscribe(){}}}}; }},from}};
}
function appConNube(n){
  const sb=createLogicSandbox(); sb.window.supabase={createClient:()=>n.client};
  vm.runInNewContext(extractPureLogicSource(source("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>js)),sb);
  assert.equal(vm.runInContext("cloud.enabled()",sb),true,"la nube falsa está enganchada");
  return sb;
}
const MARCADA={id:"11111111-1111-4111-8111-111111111111",date:"2026-10-05T10:00:00.000Z",merchant:"Pepe Mobile, S.L.U.",amount:102,category:"otros",source:"ob",ent:"sabadell",obName:"Pepe Mobile, S.L.U.",reciboId:"mov",extId:"t2"};
const YA={fecha:MARCADA.date,importe:102,comercio:MARCADA.merchant,cat:"otros"};
for(const [caso,previa,queda,peticiones] of [
  ["nube vacía: entra ya marcada y no hace falta nada más",null,"ob:sabadell~recibo.mov",["alta"]],
  ["la fila ya estaba sin marca, del sync diario de otro móvil","ob:sabadell","ob:sabadell~recibo.mov",["alta","lee 1","cambia 1"]],
  ["la fila ya estaba sin marca, de Importar histórico: conserva su origen","ob-hist:sabadell","ob-hist:sabadell~recibo.mov",["alta","lee 1","cambia 1"]],
  ["ya estaba, con el ordinal de un apunte igual del mismo día: lo conserva detrás","ob:sabadell#n2","ob:sabadell~recibo.mov#n2",["alta","lee 1","cambia 1"]],
  ["ya llevaba la marca: no se escribe nada","ob:sabadell~recibo.mov","ob:sabadell~recibo.mov",["alta","lee 1"]],
  ["era un posible repetido pendiente de su decisión: no se toca","ob:sabadell#dup","ob:sabadell#dup",["alta","lee 1"]],
  ["estaba marcada a mano como cuota de una deuda: no se toca","ob:sabadell~deuda.hipoteca","ob:sabadell~deuda.hipoteca",["alta","lee 1"]],
  ["es un aviso del móvil con la misma fecha, importe y comercio: no se toca","macrodroid","macrodroid",["alta","lee 1"]],
  ["es un gasto a mano: no se toca","manual:sabadell","manual:sabadell",["alta","lee 1"]],
  ["es de Trade Republic pendiente de decisión: no se toca","ob:trade_republic#dup","ob:trade_republic#dup",["alta","lee 1"]],
  ["es de otro banco: no se toca","ob:caixabank","ob:caixabank",["alta","lee 1"]],
]){
  test("subir el cargo de un recibo · "+caso, async ()=>{
    const n=nubeFalsa(previa?[Object.assign({},YA,{source:previa})]:[]), app=appConNube(n);
    await app.subirGasto(MARCADA,"test");
    assert.equal(j(n.log),j(peticiones));
    assert.equal(n.tabla.length,1);
    assert.equal(n.tabla[0].source,queda);
  });
}
test("subir una fila normal sigue siendo una sola escritura, y el modo pruebas no escribe nada", async ()=>{
  const n=nubeFalsa([]), app=appConNube(n);
  await app.subirGasto(Object.assign({},MARCADA,{reciboId:undefined}),"test");
  assert.equal(j(n.log),j(["alta"]));
  assert.equal(n.tabla[0].source,"ob:sabadell");
  const m=nubeFalsa([Object.assign({},YA,{source:"ob:sabadell"})]), pruebas=appConNube(m);
  pruebas.mcSandbox=()=>true;
  vm.runInContext("mcSandbox=function(){ return true; }",pruebas);
  await pruebas.subirGasto(MARCADA,"test");
  assert.equal(j([m.log,m.tabla[0].source]),j([[],"ob:sabadell"]));
});

test("quitar la marca en la nube encuentra la fila aunque su id aquí sea otro, y conserva `#dup` y `#n<k>`", async ()=>{
  const sinMarca=Object.assign({},MARCADA,{reciboId:undefined});
  for(const [antes,despues] of [["ob:sabadell~recibo.mov","ob:sabadell"],["ob-hist:sabadell~recibo.mov#n2","ob-hist:sabadell#n2"],["ob:sabadell~recibo.mov#dup#n3","ob:sabadell#dup#n3"],["ob:sabadell~deuda.d1","ob:sabadell~deuda.d1"],["macrodroid","macrodroid"]]){
    // El id de la fila en la nube («old0») no es el del móvil: un UPDATE por id no tocaría nada.
    const n=nubeFalsa([Object.assign({},YA,{source:antes})]), app=appConNube(n);
    await vm.runInContext("cloud",app).setExpenseRecibo(sinMarca);
    assert.equal(n.tabla[0].source,despues,antes);
  }
});

// ───── Widget y app tras borrar el recibo: el servidor (`presupuesto.ts`, el fichero real) deja
// fuera todo `~recibo.` sin saber si el recibo existe. Con la marca en la nube, la app contaba el
// cargo y el widget no. Se borra por la puerta de la pantalla y se comparan las dos cuentas.
const { statsDelMes }=await import("data:text/javascript;base64,"+Buffer.from(transformSync(source("supabase/functions/_shared/presupuesto.ts"),{loader:"ts",format:"esm"}).code).toString("base64"));
for(const [lista,id] of [["fixed","com"],["oneoffs","o1"]]){
  test("borrar un "+(lista==="fixed"?"recibo":"puntual")+" con su cargo marcado: el widget y la app siguen diciendo lo mismo", async ()=>{
    const puntual={id:"o1",name:"ITV coche",amount:45,account:"sabadell",month:10,year:2026,day:9};
    const r=sincroniza(todo({oneoffs:[puntual]}),[TX_COM,TX_MOV,T("t3","sabadell","2026-10-09",45,"ITV COCHE MADRID"),T("p1","sabadell","2026-10-07",3.4,"Panadería Sol",{card:true})],{sabadell:1799.6});
    const n=nubeFalsa([]), app=appConNube(n);
    app.Date=c.Date;
    for(const e of r.state.expenses) await app.subirGasto(e,"test");
    const octubre=new Date("2026-10-01T00:00:00+02:00").getTime();
    const servidor=s=>+statsDelMes(n.tabla,s,octubre).spent.toFixed(2);
    assert.equal(servidor(r.state),+gastado(r.state).toFixed(2),"antes de borrar ya cuadran");
    let s=r.state;
    (lista==="fixed"?app.removeFixedById:app.removeOneoffById)(f=>{ s=f(s); },id);
    await new Promise(setImmediate);
    const importe=lista==="fixed"?50:45;
    assert.equal(+(gastado(s)-gastado(r.state)).toFixed(2),importe,"la app pasa a contar el cargo");
    assert.equal(servidor(s),+gastado(s).toFixed(2),"y el widget también");
    assert.equal(n.tabla.find(f=>Number(f.importe)===importe).source,"ob:sabadell");
    assert.equal(n.tabla.filter(f=>/~recibo\./.test(f.source)).length,2,"las marcas de los otros dos no se tocan");
  });
}

test("el aviso del móvil gana al cargo de recibo de su mismo día, importe y comercio, baje antes o después", ()=>{
  const s0=()=>todo({accounts:[{id:"tr",ent:"trade_republic",role:"ambos",spendFrom:true,value:500}],fixed:[F("spo","Spotify",10.99,5,"trade_republic")]});
  const txs=[T("x1","trade_republic","2026-10-05",10.99,"Spotify",{card:true})];
  const aviso=c.expenseFromRow({id:"11111111-1111-4111-8111-111111111111",fecha:"2026-10-05T10:00:00.000Z",importe:10.99,comercio:"Spotify",cat:"ocio",source:"macrodroid",ingest_event_id:"ev1"});
  const marcadaNube=c.expenseFromRow({id:"22222222-2222-4222-8222-222222222222",fecha:"2026-10-05T10:00:00.000Z",importe:10.99,comercio:"Spotify",cat:"ocio",source:"ob:trade_republic~recibo.spo",ob_name:"Spotify"});
  const foto=s=>j([+gastado(s).toFixed(2),s.expenses.map(e=>e.source+(e.reciboId?"+recibo":""))]);
  // El orden de siempre: el aviso ya está cuando llega el banco. Así era también en la 4.26.119.
  const habitual=sincroniza(Object.assign(s0(),{expenses:[aviso]}),txs,{trade_republic:489.01}).state;
  assert.equal(foto(habitual),j([10.99,["macrodroid"]]));
  // El otro: el banco primero, y el aviso baja de la nube después.
  const banco=sincroniza(s0(),txs,{trade_republic:489.01}).state;
  assert.equal(foto(banco),j([0,["ob+recibo"]]));
  const baja=lista=>Object.assign({},banco,{expenses:c.mergeExpensesFromCloud(banco.expenses,lista,ahora).list});
  assert.equal(foto(baja([aviso])),foto(habitual));
  // Y si la nube trae las dos filas, da igual cuál venga delante; el siguiente pull no lo deshace.
  assert.equal(foto(baja([aviso,marcadaNube])),foto(habitual));
  assert.equal(foto(baja([marcadaNube,aviso])),foto(habitual));
  const otra=Object.assign({},banco,{expenses:c.mergeExpensesFromCloud(baja([aviso]).expenses,[marcadaNube,aviso],ahora).list});
  assert.equal(foto(otra),foto(habitual));
  // Ni un pull que solo trae la fila marcada del banco le pega la marca al aviso.
  assert.equal(foto(Object.assign({},otra,{expenses:c.mergeExpensesFromCloud(otra.expenses,[marcadaNube],ahora).list})),foto(habitual));
  assert.equal(sincroniza(otra,txs,{trade_republic:489.01}).add.length,0,"y el banco no la vuelve a meter");
});

test("un «No es este recibo» sobre un PUNTUAL tiene vuelta atrás", ()=>{
  const o={id:"o1",name:"ITV coche",amount:45,account:"sabadell",month:10,year:2026,day:9};
  const r=sincroniza(todo({fixed:[],oneoffs:[o]}),[T("a1","sabadell","2026-10-09",45,"ITV COCHE MADRID")],{sabadell:1955});
  const fila=r.state.expenses[0], q=c.quitarCargoDeRecibo(r.state,fila.id);
  assert.equal(gastado(q.state),45);
  assert.equal(c.reciboNoDe(q.state,"o1",c.fixedPaymentIdentity("sabadell",q.e),q.e.id).length,2,"es lo que la ficha mira para ofrecerlo");
  ahora=OCT12+60000;
  try{
    const rp=c.reponerCargoDeRecibo(q.state,fila.id,"o1",2026,10,12,{identity:c.fixedPaymentIdentity("sabadell",q.e)});
    assert.equal(j([rp.e.reciboId,rp.state.reciboNo.length,gastado(rp.state)]),j(["o1",0,0]));
    assert.equal(j(mostrado(rp.state)),j(mostrado(q.state)),"sin mover el saldo");
    assert.equal(c.reciboEtiqueta(rp.state,rp.e),"Recibo: ITV coche");
    // Con el puntual movido a otro banco no hay marca que devolver: no se toca nada.
    const mudado=Object.assign({},q.state,{oneoffs:[Object.assign({},o,{account:"caixabank"})]});
    assert.equal(c.reponerCargoDeRecibo(mudado,fila.id,"o1",2026,10,12),null);
  } finally { ahora=OCT12; }
});

// ───── Confirmación de la unión (13/10/2026) ─────
const delMes=(lista,ym)=>lista.filter(e=>String(e.date||e.fecha).slice(0,7)===ym);
const gastadoMes=(s,ym)=>+delMes(s.expenses,ym).filter(e=>c.expenseCountsBudget(e,s)&&e.amount>0).reduce((n,e)=>n+e.amount,0).toFixed(2);
const inicioMes=ym=>new Date(ym+"-01T00:00:00+02:00").getTime();

test("borrar un recibo solo suelta sus cargos del periodo en curso: los meses cerrados no se mueven, ni en el widget", async ()=>{
  const viejo=(ym,imp,rec)=>({id:"v-"+ym+"-"+imp,date:ym+"-12T10:00:00.000Z",merchant:rec?"COMUNIDAD DE PROPIETARIOS":"Compra de "+ym,obName:rec?"COMUNIDAD DE PROPIETARIOS":"Compra de "+ym,amount:imp,category:rec?"recibos":"super",source:"ob",ent:"sabadell",extId:"x-"+ym+"-"+imp,reciboId:rec?"com":undefined});
  const antes=sincroniza(todo({expenses:[viejo("2026-08",62.4,true),viejo("2026-08",30,false),viejo("2026-09",62.4,true),viejo("2026-09",35,false)]}),[TX_COM,TX_MOV,T("p1","sabadell","2026-10-07",3.4,"Panadería Sol",{card:true})],{sabadell:1844.6}).state;
  assert.equal(j(["2026-08","2026-09","2026-10"].map(m=>gastadoMes(antes,m))),j([30,35,3.4]));
  const n=nubeFalsa([]), app=appConNube(n);
  app.Date=c.Date;
  for(const e of antes.expenses) await app.subirGasto(e,"test");
  let s=antes;
  app.removeFixedById(f=>{ s=f(s); },"com");
  await new Promise(setImmediate);
  // Agosto y septiembre, como estaban; octubre pasa a contar su cargo. En la app y en el servidor.
  assert.equal(j(["2026-08","2026-09","2026-10"].map(m=>gastadoMes(s,m))),j([30,35,53.4]));
  for(const m of ["2026-08","2026-09","2026-10"]) assert.equal(+statsDelMes(delMes(n.tabla,m),s,inicioMes(m)).spent.toFixed(2),gastadoMes(s,m),"widget "+m);
  assert.equal(j(n.tabla.filter(f=>f.comercio==="COMUNIDAD DE PROPIETARIOS").map(f=>[String(f.fecha).slice(0,7),f.source]).sort()),
    j([["2026-08","ob:sabadell~recibo.com"],["2026-09","ob:sabadell~recibo.com"],["2026-10","ob:sabadell"]]));
  assert.equal(j(mostrado(s)),j(mostrado(antes)),"el saldo pintado no se mueve");
  // La fila de un mes cerrado sigue diciendo de qué recibo era, sin nombre roto, y se puede corregir.
  const agosto=s.expenses.find(e=>e.id==="v-2026-08-62.4");
  assert.equal(j([agosto.reciboId,c.expenseBucket(agosto,s),c.reciboEtiqueta(s,agosto),c.cargoDeRecibo(agosto,s).name]),j(["com","recibo","Recibo: Comunidad","Comunidad"]));
  assert.equal(gastadoMes(c.quitarCargoDeRecibo(s,agosto.id).state,"2026-08"),92.4,"«No es este recibo» sigue funcionando sobre ella");
  // El otro móvil aún tiene marcada la de octubre: con el estado que le llega cuenta lo mismo.
  const otroMovil=Object.assign({},antes,{fixed:s.fixed,reciboBorrado:s.reciboBorrado});
  assert.equal(j(["2026-08","2026-09","2026-10"].map(m=>gastadoMes(otroMovil,m))),j([30,35,53.4]));
  // Cierre y ancla: las filas de meses cerrados que conservan la marca pesan lo mismo que si no estuvieran.
  const sinViejas=Object.assign({},s,{expenses:s.expenses.filter(e=>e.reciboId!=="com")});
  ahora=new Date("2026-11-02T10:00:00+01:00").getTime();
  try{
    const cierra=x=>{ const r=c.reconcileTR(clon(x)); return j([r.accounts.map(a=>a.value),r.trAnchor]); };
    assert.equal(cierra(s),cierra(sinViejas));
  } finally { ahora=OCT12; }
  // Un recibo que desaparece sin constar el borrado (estado viejo) sigue siendo un gasto normal.
  const sinRastro=Object.assign({},antes,{fixed:antes.fixed.filter(f=>f.id!=="com")});
  assert.equal(c.cargoDeRecibo(sinRastro.expenses.find(e=>e.id==="v-2026-08-62.4"),sinRastro),null);
});

test("con «Mi ciclo», el periodo en curso es el ciclo: lo anterior a la nómina conserva la marca", ()=>{
  const nomina={id:"nom",date:"2026-10-08T10:00:00.000Z",merchant:"NOMINA ACME",obName:"NOMINA ACME",amount:-1800,category:"ingreso",source:"ob",ent:"sabadell",extId:"nom"};
  const r=sincroniza(todo({settings:{budgetCycle:true},expenses:[nomina]}),[TX_COM,TX_MOV],{sabadell:1848}).state;
  const b=c.sinCargoDelPlan(c.sinCargoDelPlan(r,"fixed","com").state,"fixed","mov");
  // Comunidad se cobró el 12 (dentro del ciclo): se suelta. El móvil, el 5 (antes de la nómina): no.
  assert.equal(j(b.state.expenses.filter(e=>e.amount>0).map(e=>[e.merchant,e.reciboId||null])),j([["COMUNIDAD DE PROPIETARIOS",null],["Pepe Mobile, S.L.U.","mov"]]));
  assert.equal(b.subir.length,0);
  assert.equal(c.cargoDeRecibo(b.state.expenses.find(e=>e.reciboId==="mov"),b.state).borrado,true);
});

test("«No es este recibo» sobre UNO de varios cargos iguales suelta solo ese, en la app y en la nube", async ()=>{
  const o={id:"itv",name:"Spotify",amount:10.99,account:"trade_republic",month:10,year:2026,day:5};
  const igual=T(null,"trade_republic","2026-10-05",10.99,"Spotify",{card:true});
  const r=sincroniza(todo({accounts:[{id:"tr",ent:"trade_republic",role:"ambos",spendFrom:true,value:500}],fixed:[],oneoffs:[o]}),[igual,Object.assign({},igual)],{trade_republic:478.02}).state;
  const filas=r.expenses.slice().sort((a,b)=>(a.obOrd||1)-(b.obOrd||1));
  assert.equal(j(filas.map(e=>[e.reciboId,e.obOrd||1,c.expenseSourceForCloud(e)])),j([["itv",1,"ob:trade_republic~recibo.itv"],["itv",2,"ob:trade_republic~recibo.itv#n2"]]));
  // El segundo viaja con su fecha un milisegundo después: si no, chocaría con el primero en la nube.
  assert.equal(Date.parse(filas[1].date)-Date.parse(filas[0].date),1);
  for(const tocada of filas){
    const n=nubeFalsa([]), app=appConNube(n);
    for(const e of filas) await app.subirGasto(e,"test");
    assert.equal(n.tabla.length,2,"las dos filas iguales caben en la nube");
    const q=c.quitarCargoDeRecibo(r,tocada.id);
    assert.equal(gastado(q.state),10.99,"cuenta el tocado, no los dos (ordinal "+(tocada.obOrd||1)+")");
    assert.equal(q.state.expenses.filter(e=>c.cargoDeRecibo(e,q.state)).length,1);
    await vm.runInContext("cloud",app).setExpenseRecibo(q.e);
    assert.equal(j(n.tabla.map(f=>f.source).sort()),j(["ob:trade_republic"+(tocada.obOrd>1?"~recibo.itv":""),"ob:trade_republic"+(tocada.obOrd>1?"":"~recibo.itv")+"#n2"].sort()));
    assert.equal(+statsDelMes(n.tabla,q.state,inicioMes("2026-10")).spent.toFixed(2),10.99,"y el widget dice lo mismo");
    // DOS MÓVILES con id local distinto para las mismas filas: B lo deshace y A converge.
    ahora=OCT12+60000;
    try{
      const enB=Object.assign({},q.state,{expenses:q.state.expenses.map(e=>Object.assign({},e,{id:"b-"+(e.obOrd||1)}))});
      assert.equal(c.reponerCargoDeRecibo(enB,"b-"+(tocada.obOrd>1?1:2),"itv",2026,10,12),null,"el otro cargo igual no tiene nada que deshacer");
      const rb=c.reponerCargoDeRecibo(enB,"b-"+(tocada.obOrd||1),"itv",2026,10,12);
      assert.equal(j([rb.state.reciboNo.length,gastado(rb.state)]),j([0,0]));
      const A=Object.assign({},q.state,c.reciboNoUnion(q.state,rb.state),{expenses:q.state.expenses.map(e=>e.id===tocada.id?Object.assign({},e,{reciboId:"itv"}):e)});
      assert.equal(j([A.reciboNo.length,gastado(A)]),j([0,0]),"A acaba igual que B");
    } finally { ahora=OCT12; }
  }
  // El histórico con marca también sube su ordinal, con y sin «posible repetido».
  assert.equal(c.expenseSourceForCloud({source:"ob-hist",ent:"sabadell",reciboId:"mov",obOrd:2}),"ob-hist:sabadell~recibo.mov#n2");
  assert.equal(c.expenseSourceForCloud({source:"ob-hist",ent:"sabadell",reciboId:"mov",obOrd:3,possibleDup:true}),"ob-hist:sabadell~recibo.mov#dup#n3");
});

test("cuando el aviso gana al cargo marcado, la fila conserva lo que él puso a mano y la nube deja de depender del orden", async ()=>{
  const {filasComoLaApp}=await import("data:text/javascript;base64,"+Buffer.from(transformSync(source("supabase/functions/_shared/presupuesto.ts"),{loader:"ts",format:"esm"}).code).toString("base64"));
  const s0=todo({accounts:[{id:"tr",ent:"trade_republic",role:"ambos",spendFrom:true,value:500}],fixed:[F("spo","Spotify",10.99,5,"trade_republic")]});
  const banco=sincroniza(s0,[T("x1","trade_republic","2026-10-05",10.99,"Spotify",{card:true})],{trade_republic:489.01}).state;
  // Lo que él tocó en esa fila antes de que bajara el aviso.
  const suya=Object.assign({},banco.expenses[0],{category:"ocio",note:"la cuenta familiar",noteEdited:true,noCard:true});
  const local=Object.assign({},banco,{expenses:[suya]});
  const filaAviso={id:"11111111-1111-4111-8111-111111111111",user_id:"u1",fecha:"2026-10-05T09:31:00.000Z",importe:10.99,comercio:"Spotify",cat:"otros",source:"macrodroid",ingest_event_id:"ev1"};
  const n=nubeFalsa([]), app=appConNube(n);
  await app.subirGasto(suya,"test");
  n.tabla.push(filaAviso);
  const servidor=orden=>+statsDelMes(filasComoLaApp(orden,[]),local,inicioMes("2026-10")).spent.toFixed(2);
  assert.equal(j([servidor(n.tabla),servidor(n.tabla.slice().reverse())].sort()),j([0,10.99]),"el control: con la marca en la nube, el servidor depende de cuál lea primero");
  const m=c.mergeExpensesFromCloud(local.expenses,n.tabla.map(c.expenseFromRow),ahora);
  const queda=m.list[0];
  assert.equal(m.list.length,1);
  assert.equal(j([queda.id,queda.source,queda.reciboId||null,queda.category,queda.note,queda.noteEdited,queda.noCard]),j([suya.id,"macrodroid",null,"ocio","la cuenta familiar",true,true]));
  assert.equal(gastado(Object.assign({},local,{expenses:m.list})),10.99);
  // Lo que App sube después del pull: la fila del banco, ya sin la marca.
  assert.equal(j(m.sinMarca.map(e=>[e.source,e.ent,e.reciboId||null,e.date])),j([["ob","trade_republic",null,suya.date]]));
  for(const e of m.sinMarca) await vm.runInContext("cloud",app).setExpenseRecibo(e);
  assert.equal(j(n.tabla.map(f=>f.source).sort()),j(["macrodroid","ob:trade_republic"]));
  assert.equal(j([servidor(n.tabla),servidor(n.tabla.slice().reverse())]),j([10.99,10.99]),"ahora da 10,99 lea en el orden que lea");
  // Si aquella escritura no llegó, el siguiente pull la vuelve a pedir; y con la nube ya limpia, nada.
  const marcadaNube=c.expenseFromRow({id:suya.id,fecha:suya.date,importe:10.99,comercio:"Spotify",cat:"ocio",source:"ob:trade_republic~recibo.spo",ob_name:"Spotify"});
  assert.equal(c.mergeExpensesFromCloud(m.list,[marcadaNube],ahora).sinMarca.length,1);
  const limpio=c.mergeExpensesFromCloud(m.list,n.tabla.map(c.expenseFromRow),ahora);
  assert.equal(j([limpio.sinMarca.length,limpio.list.length,limpio.list[0].id,limpio.list[0].note]),j([0,1,suya.id,"la cuenta familiar"]));
});

// ───── Bloques REALES de la pantalla, sacados del bundle servido (`public/index.html`), que es lo
// que ejecuta el móvil: una mutación sobre el bundle también los alcanza.
const bundle=source("public/index.html");
test("al bajar el estado de la nube, App une los vetos con `reciboNoUnion` (el bloque REAL de syncFromCloud)", ()=>{
  const m=/const baseObj = localNewer[\s\S]*?if\(freshLogin && \(cloudState\.accounts/.exec(bundle)||/const baseObj\s*=\s*localNewer[\s\S]*?if\(freshLogin\s*&&\s*\(cloudState\.accounts/.exec(bundle);
  assert.ok(m,"no se encuentra el bloque de último-que-escribe en syncFromCloud");
  // Desde la unión con Inicio v4.2 (4.26.122) el mismo bloque une además el historial de cuentas
  // para el titular de la sesión: se le da la sesión de ese titular y la unión real.
  const bloque=new Function("prev","cloudState","freshLogin","localNewer","merged","opts","reciboNoUnion","fusionarGemelos","sessionRef","u","mergeAccountBalanceHistory",m[0].replace(/if\(freshLogin\s*&&\s*\(cloudState\.accounts$/,"")+"\nreturn baseObj;");
  const adopta=(...a)=>bloque(...a,{current:{user:{id:"titular"}}},"titular",c.mergeAccountBalanceHistory);
  const prev={_savedAt:1,expenses:[],reciboNo:["com|x"],reciboNoAt:{"com|x":10}}, nube={_savedAt:2,reciboNo:[],reciboNoAt:{"com|x":20}};
  const fus=(a,b)=>a||b;
  // La nube lo levantó después: aquí deja de estar. Y un veto local más reciente sobrevive a una nube que no lo trae.
  assert.equal(j(adopta(prev,nube,false,false,{list:[]},null,c.reciboNoUnion,fus).reciboNo),j([]));
  const local={_savedAt:1,expenses:[],reciboNo:["com|x"],reciboNoAt:{"com|x":30}};
  assert.equal(j(adopta(local,nube,false,false,{list:[]},null,c.reciboNoUnion,fus).reciboNo),j(["com|x"]),"sin la unión, la lista de la nube lo borraría");
});

test("tras el pull, App reescribe en la nube las filas que `sinMarca` le deja (el bloque REAL de syncCloudExpenses)", ()=>{
  const m=/if\(merged\.sinMarca\.length\)[^\n]*\n/.exec(bundle);
  assert.ok(m,"no se encuentra la subida de `sinMarca` tras mergeExpensesFromCloud");
  const subidas=[], fila={source:"ob",ent:"trade_republic"};
  new Function("merged","cloud","setTimeout",m[0])({sinMarca:[fila]},{setExpenseRecibo:e=>{ subidas.push(e); return Promise.resolve(); }},f=>f());
  assert.equal(subidas[0],fila);
});

test("el aviso de presupuesto al apuntar no cuenta el cargo de un recibo (el bloque REAL de Gastos)", ()=>{
  const m=/const before=\(state\.expenses\|\|\[\]\)\.filter\([^;]*;/.exec(bundle);
  assert.ok(m,"no se encuentra la suma del mes en el aviso de presupuesto");
  const r=sincroniza(todo(),[TX_COM,TX_MOV,T("p1","sabadell","2026-10-07",3.4,"Panadería Sol",{card:true})],{sabadell:1844.6});
  const antes=new Function("state","monthStartMs","dateMs","cargoDeRecibo",m[0]+"\nreturn before;");
  assert.equal(antes(r.state,new Date("2026-10-01T00:00:00+02:00").getTime(),c.dateMs,c.cargoDeRecibo),3.4,"152 € de recibos no adelantan el aviso del 80 %");
});
