// INVARIANTE DEL CARGO DE RECIBO (criterio de aceptación, 12/10/2026).
// Hasta la 4.26.119 el cargo del banco que se parecía a un recibo del Plan se TIRABA. Ahora
// entra en Gastos para que se vea. Eso es un cambio de lo que se ve, no de lo que se cuenta:
// para cualquier extracto, las cifras tienen que ser las mismas que cuando la fila se tiraba.
//
// Este test no confía en ninguna regla escrita dos veces: carga el código de la 4.26.119
// (`788432f4`, el mismo mecanismo de commit inmutable que usa `beta-sources`) y el de ahora, les
// pasa los mismos extractos sintéticos por la cadena real del sync y compara al céntimo el
// gastado y el presupuesto, el saldo pintado tras anclar, el saldo previsto y el cierre de mes.
// Dos rondas afinaron la marca «para que fuera más correcta» y las dos movieron cifras
// (+62,40 € de gastado con «Luz Endesa» frente a «ENDESA ENERGIA XXI»): por eso manda esto.
//
// UNA SOLA EXCEPCIÓN, aceptada el 12/10/2026 tras medir 1.500 extractos: la marca se queda. La
// 4.26.119 volvía a juzgar el cargo en cada sync, y el que tiraba en su mes (el seguro anual
// cobrado el 27, un puntual de fin de mes, el recibo al que luego se le sube el importe) lo
// metía como una compra al sincronizar más tarde. Ahora ese cargo ya está en la lista con su
// marca y sigue siendo el de su recibo. Se fija abajo con exactitud: tras esa sincronización
// el saldo es idéntico, y el presupuesto es el de la 119 SIN esas compras reimportadas, ni un
// céntimo más ni uno menos.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {execFileSync} from "node:child_process";
import { test } from "node:test";
import { loadPureLogic } from "../scripts/load-pure-logic.mjs";

const BASE="788432f4682c199edd785f6973d9353330c0064a";
const disco=file=>fs.readFileSync(new URL("../"+file,import.meta.url),"utf8");
const deGit=file=>execFileSync("git",["show",BASE+":"+file],{encoding:"utf8",maxBuffer:3e7,cwd:new URL("..",import.meta.url)});
function carga(src){
  const order=JSON.parse(src("src/build-order.json"));
  const c=loadPureLogic(src("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>order.map(f=>src("src/modules/"+f)).join("\n")));
  vm.runInNewContext(src("src/modules/14-v4-screens.js"),c);
  const reloj={t:0};
  c.Date=class extends Date { constructor(...a){ super(...(a.length?a:[reloj.t])); } static now(){ return reloj.t; } };
  return {c,reloj};
}
const base=carga(deGit), cand=carga(disco);
const OCT28=new Date("2026-10-28T18:00:00+01:00").getTime(), NOV2=new Date("2026-11-02T10:00:00+01:00").getTime();
const clon=x=>JSON.parse(JSON.stringify(x));
const ASPSP={sabadell:"Banco de Sabadell",caixabank:"CaixaBank",bbva:"BBVA",ing:"ING"};

// Los ocho recibos de una casa: nombre en el Plan, importe, día, y cómo lo llama el banco.
const RECIBOS=[
  ["luz","Luz Endesa",62.40,5,"ENDESA ENERGIA XXI","Endesa"],
  ["agua","Agua",28.50,8,"CANAL DE ISABEL II","Canal Isabel II"],
  ["gas","Gas",45,10,"NATURGY","Naturgy"],
  ["ibi","Ibi",38,15,"AYTO MADRID IBI","IBI Ayto Madrid"],
  ["com","Comunidad",60,1,"CDAD PROP CL MAYOR 12","Comunidad"],
  ["mov","Movistar",59.90,3,"TELEFONICA DE ESPANA","Telefonica"],
  ["nfx","Netflix",13.99,20,"NETFLIX.COM","Netflix"],
  ["seg","Seguro coche",41.20,22,"MAPFRE SEGURO COCHE","Mapfre"],
];
const COMPRAS=[["c1","2026-10-02",84.31,"MERCADONA"],["c2","2026-10-09",45.10,"REPSOL"],["c3","2026-10-14",23.90,"FARMACIA"],["c4","2026-10-18",96.69,"MERCADONA"],["c5","2026-10-24",50,"ZARA"]];
const azar=semilla=>()=>{ semilla|=0; semilla=semilla+0x6D2B79F5|0; let t=Math.imul(semilla^semilla>>>15,1|semilla); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };

// Un extracto: qué recibos hay, cómo se llaman, qué manda el banco y con qué estado.
function extracto({rol,bancos,nombres,importes,semilla}){
  const r=azar(semilla), uno=lista=>lista[Math.floor(r()*lista.length)];
  const principal="caixabank", segundo=bancos===2?"sabadell":null;
  const fixed=[], txs=[];
  RECIBOS.forEach(function([id,plan,importe,dia,banco,comoBanco]){
    const ent=segundo&&r()<0.4?segundo:principal;
    fixed.push({id,name:nombres==="banco"?comoBanco:plan,amount:importe,freq:"mes",day:dia,account:ent});
    if(r()<0.1) return;                                             // este mes aún no lo han cobrado
    const cobrado=importes==="exactos"?importe:importes==="variables"?+(importe+(r()<0.5?0.4:-0.3)*r()).toFixed(2):+(importe*(r()<0.5?1:1.15)).toFixed(2);
    const estado=uno(["BOOK","BOOK","BOOK","PDNG",""]);
    txs.push({ext_id:"r-"+id,ent,date:"2026-10-"+String(dia).padStart(2,"0"),amount:cobrado,merchant:banco,status:estado,card:r()<0.3});
    if(r()<0.2) txs.push({ext_id:"r2-"+id,ent,date:"2026-10-"+String(Math.min(27,dia+4)).padStart(2,"0"),amount:cobrado,merchant:banco,status:"BOOK",card:false});   // dos cargos iguales
    if(r()<0.15) txs.push({ext_id:null,ent,date:"2026-10-"+String(dia).padStart(2,"0"),amount:cobrado,merchant:banco,status:"BOOK",card:false});                      // y uno sin id del banco
  });
  // Compras que se parecen a un recibo sin serlo, y las de verdad.
  if(r()<0.5) txs.push({ext_id:"p-agua",ent:principal,date:"2026-10-08",amount:28.7,merchant:"AGUACATES DEL SUR",status:"BOOK",card:true});
  if(r()<0.5) txs.push({ext_id:"p-nfx",ent:principal,date:"2026-10-21",amount:14,merchant:"NETFLIX SHOP MERCH",status:"BOOK",card:true});
  if(r()<0.3) txs.push({ext_id:"p-seg",ent:principal,date:"2026-10-06",amount:41.5,merchant:"SEGURO DENTAL SANITAS",status:"BOOK",card:false});
  COMPRAS.forEach(function([id,fecha,importe,comercio]){ txs.push({ext_id:id,ent:r()<0.25&&segundo?segundo:principal,date:fecha,amount:importe,merchant:comercio,status:"BOOK",card:true}); });
  const accounts=rol==="recibos"?[{id:"a",ent:principal,role:"fijos",value:3000},{id:"tr",ent:"trade_republic",role:"diario",spendFrom:true,value:500}]
    :[{id:"a",ent:principal,role:rol==="todo"?"ambos":"diario",spendFrom:true,value:3000}];
  if(segundo) accounts.push({id:"b",ent:segundo,role:"fijos",value:1200});
  const settings=segundo&&r()<0.5?{expenseBanks:[segundo]}:{};
  const saldos={[principal]:+(1500+r()*1000).toFixed(2)}; if(segundo) saldos[segundo]=+(600+r()*500).toFixed(2);
  return {estado:{accounts,settings,fixed,debts:[],oneoffs:[],flows:[],expenses:[],bankTx:[],deleted:[],budget:800,investments:[],assets:[],aportaciones:[],trAnchor:"2026-10"},txs,saldos};
}
const enlaces=(txs,saldos)=>Object.keys(saldos).map(ent=>({aspsp:ASPSP[ent],ok:true,
  accounts:[{uid:ent,ok:true,balances:[{type:"ITAV",amount:saldos[ent],currency:"EUR"}],transactions:txs.filter(t=>t.ent===ent)}]}));
// Lo mismo que hace `runBankSync` con la respuesta: importar, guardar extracto y pruebas, anclar.
function sincroniza(c,s,txs,saldos){
  const links=enlaces(txs,saldos),flat=c.flattenBankTx(links),add=c.importObExpenses(s,flat,links)||[];
  // Las cuotas de deuda que entran se marcan en el mismo paso, como en la app.
  c.cuotasDeDeudaPorMarcar(Object.assign({},s,{expenses:[...add].concat(s.expenses||[])})).forEach(a=>{ if(add.indexOf(a.e)>=0){ a.e.category="deudas"; a.e.debtId=a.debtId; } });
  const hoy=new c.Date(), dia=[hoy.getFullYear(),hoy.getMonth()+1,hoy.getDate()];
  const conTx=Object.assign({},s,{expenses:c.enrichNotesFromBankTx([...add].concat(s.expenses||[]),flat),bankTx:flat});
  return c.applyBankBalances(c.reconcileEarlyIncomeAnchors(c.reconcileFixedPaymentProofs(conTx,...dia),...dia),links).state;
}
// Las cifras, cada una por su camino. `previsto` = lo pintado más lo que el Plan aún va a mover.
function cifras(c,s,y,m,d){
  const st=c.monthBudgetStats(s), i=c.insumosSaldoGasto(s);
  const pintado=s.accounts.map(a=>+c.saldoCuentaMostrada(a,{injTR:i.injTR,spentByBank:i.spentByBank,paidNetByBank:i.paidNetByBank,roundup:i.roundup,monthlyInvest:i.monthlyInvest}).toFixed(2));
  const hoy=s.accounts.map(a=>+c.monthNetForAccount(s,a.ent,y,m,d).toFixed(2)), cerrado=s.accounts.map(a=>+c.monthNetForAccount(s,a.ent,y,m,null).toFixed(2));
  const numeros={}; Object.keys(st).sort().forEach(k=>{ if(typeof st[k]==="number") numeros[k]=+st[k].toFixed(2); });
  return {presupuesto:numeros,pintado,base:s.accounts.map(a=>a.value),previsto:pintado.map((x,k)=>+(x+cerrado[k]-hoy[k]).toFixed(2))};
}
function recorre({c,reloj},ex){
  const pasos={};
  reloj.t=OCT28;
  let s=sincroniza(c,clon(ex.estado),ex.txs,ex.saldos);
  pasos.sync=cifras(c,s,2026,10,28);
  // Segunda pulsación: lo pendiente ya está contabilizado y el banco ha cobrado algo más.
  s=sincroniza(c,s,ex.txs.map(t=>t.status==="PDNG"?Object.assign({},t,{status:"BOOK"}):t),ex.saldos);
  pasos.contabilizado=cifras(c,s,2026,10,28);
  reloj.t=NOV2;
  const cerrado=c.reconcileTR(clon(s));
  pasos.cierre={base:cerrado.accounts.map(a=>a.value)};
  return {pasos,estado:s};
}

const ROLES=["recibos","todo","diario"], SEMILLAS=12;
let extractos=0;
for(const rol of ROLES) for(const bancos of [1,2]) for(const nombres of ["plan","banco"]){
  test("mismas cifras que cuando el cargo se tiraba · rol "+rol+" · "+bancos+" banco(s) · nombres de "+nombres, ()=>{
    for(const importes of ["exactos","variables","distintos"]) for(let k=0;k<SEMILLAS;k++){
      const ex=extracto({rol,bancos,nombres,importes,semilla:1000*bancos+97*k+ROLES.indexOf(rol)*7+(nombres==="banco"?3:0)+(importes.length)});
      const a=recorre(base,ex), b=recorre(cand,ex);
      assert.deepEqual(b.pasos,a.pasos,"extracto "+importes+" #"+k);
      extractos++;
      // Y no es porque no haya entrado nada: lo que la 119 tiraba ahora está en la lista.
      assert.ok(b.estado.expenses.length>=a.estado.expenses.length);
      assert.equal(b.estado.expenses.filter(e=>!e.reciboId).length,a.estado.expenses.length,"lo que no lleva marca es exactamente lo que ya entraba");
    }
  });
}

test("los ocho recibos de la revisión, banco para todo: el mismo gastado antes y ahora", ()=>{
  const fixed=RECIBOS.map(([id,plan,importe,dia])=>({id,name:plan,amount:importe,freq:"mes",day:dia,account:"caixabank"}));
  const txs=RECIBOS.map(([id,,importe,dia,banco])=>({ext_id:"r-"+id,ent:"caixabank",date:"2026-10-"+String(dia).padStart(2,"0"),amount:importe,merchant:id==="seg"?"MAPFRE":banco,status:"BOOK",card:false}))
    .concat(COMPRAS.map(([id,fecha,importe,comercio])=>({ext_id:id,ent:"caixabank",date:fecha,amount:importe,merchant:comercio,status:"BOOK",card:true})));
  const ex={estado:{accounts:[{id:"a",ent:"caixabank",role:"ambos",spendFrom:true,value:3000}],settings:{},fixed,debts:[],oneoffs:[],flows:[],expenses:[],bankTx:[],deleted:[],budget:800,trAnchor:"2026-10"},txs,saldos:{caixabank:2351.01}};
  const a=recorre(base,ex), b=recorre(cand,ex);
  assert.deepEqual(b.pasos,a.pasos);
  assert.equal(b.pasos.sync.presupuesto.spent,572.6);
  assert.equal(b.pasos.sync.pintado[0],2351.01,"y el saldo pintado es el del banco");
  // Las filas nuevas son las dos que la 119 tiraba; las demás ya entraban y siguen contando.
  assert.equal(JSON.stringify(b.estado.expenses.filter(e=>e.reciboId).map(e=>e.merchant)),JSON.stringify(["NETFLIX.COM","ENDESA ENERGIA XXI"]));
});

test("la fila de recibo no gasta el «posible repetido» que le toca a otro movimiento sin nombre", ()=>{
  // Recibo llamado como el texto genérico del banco, un aviso del móvil de 20 € y dos movimientos
  // de 20 €: el primero casa con el recibo (se tiraba); el segundo, sin nombre, es el gemelo del
  // aviso y tiene que seguir entrando como «posible repetido», sin contar.
  const ex={estado:{accounts:[{id:"a",ent:"caixabank",role:"ambos",spendFrom:true,value:3000}],settings:{},fixed:[{id:"mv",name:"Movimiento",amount:20.4,freq:"mes",day:6,account:"caixabank"}],
      debts:[],oneoffs:[],flows:[],bankTx:[],deleted:[],budget:800,trAnchor:"2026-10",
      expenses:[{id:"w1",date:"2026-10-06T09:00:00.000Z",merchant:"Bar Paco",amount:20,category:"bares",source:"wallet",ent:"caixabank"}]},
    // El del recibo va con fecha posterior: el extracto se recorre de nuevo a viejo y es el que llega antes.
    txs:[{ext_id:"m1",ent:"caixabank",date:"2026-10-07",amount:20,merchant:"Movimiento",status:"BOOK",card:false},{ext_id:"m2",ent:"caixabank",date:"2026-10-06",amount:20,merchant:"",status:"BOOK",card:true}],saldos:{caixabank:2960}};
  const a=recorre(base,ex), b=recorre(cand,ex);
  assert.deepEqual(b.pasos,a.pasos);
  assert.equal(b.pasos.sync.presupuesto.spent,20,"solo cuenta el aviso");
  assert.equal(b.estado.expenses.filter(e=>e.possibleDup).length,1);
});

test("Importar histórico: importar las filas de recibo deja las cifras como cuando no se importaban", ()=>{
  for(const rol of ROLES) for(let k=0;k<SEMILLAS;k++){
    const ex=extracto({rol,bancos:1+(k%2),nombres:k%3?"plan":"banco",importes:["exactos","variables","distintos"][k%3],semilla:5000+k*31+ROLES.indexOf(rol)});
    const cands=ex.txs.map(t=>({kind:"out",ent:t.ent,date:t.date,amount:t.amount,merchant:t.merchant,card:!!t.card,id:t.ext_id}));
    const importa=function({c,reloj},conRecibos){
      reloj.t=OCT28;
      const s=clon(ex.estado), rows=[...c.histClassifyCandidates(cands,s).rows];
      // La 119 dejaba el cargo de recibo sin marcar («repetido»): no entraba. Ahora entra marcado.
      const filas=cands.map((x,i)=>rows[i].status==="new"&&(conRecibos||!rows[i].reciboId)
        ? (c.histFilaGasto?c.histFilaGasto(x,rows[i],rows[i].category||"otros","hist-x"):{id:"b"+i,date:new c.Date(x.date+"T12:00:00").toISOString(),merchant:x.merchant,amount:x.amount,category:rows[i].category||"otros",source:"ob-hist",ent:x.ent,extId:x.id}):null).filter(Boolean);
      const con=Object.assign({},s,{expenses:filas});
      const antes=cifras(c,con,2026,10,28);
      reloj.t=NOV2;
      return {antes,cierre:c.reconcileTR(clon(con)).accounts.map(a=>a.value),n:filas.length,marcadas:filas.filter(e=>e.reciboId).length};
    };
    const a=importa(base,false), b=importa(cand,true);
    assert.deepEqual([b.antes,b.cierre],[a.antes,a.cierre],"rol "+rol+" #"+k);
    assert.equal(b.n-b.marcadas,a.n,"lo que entra sin marca es lo que ya entraba");
    extractos++;
  }
});

// ───── Segunda familia (tercera revisión): lo que el generador de arriba no tocaba. Deudas (una
// que se llama como su cargo y otra que choca con un recibo), puntuales, recibos anuales,
// trimestrales, bimestrales y con importes a medida, redondeo, «Mi ciclo» con nómina, cuentas
// sin rol, cargos de fin de septiembre y de primeros de noviembre, y el recorrido entero:
// sincronizar dos días de octubre, cerrar el mes, sincronizar en noviembre y cerrar otra vez.
const POOL=[
  ["alq","Alquiler piso",750,{freq:"mes"},["ALQUILER INMOBILIARIA GARCIA","TRANSF ALQUILER PISO","INMOBILIARIA GARCIA SL"]],
  ["gim","Gimnasio",34.9,{freq:"mes"},["GIMNASIO FITUP","FITUP CENTROS SL"]],
  ["hog","Seguro hogar",220,{freq:"año",months:[10]},["SEGUROS OCASO HOGAR","OCASO SEGURO"]],
  ["bas","Basuras",48,{freq:"trimestral"},["AYUNTAMIENTO TASA BASURAS","AYTO RECAUDACION"]],
  ["tel","Telefono movil",25,{freq:"mes"},["DIGI SPAIN TELECOM","TELEFONO MOVIL DIGI"]],
  ["agu","Agua",31,{freq:"mes"},["AGUAS DE BARCELONA","AGUA","AGUACATE BAR"]],
  ["coc","Seguro coche",0,{schedule:[{m:10,amt:172.05,day:12},{m:4,amt:166.94,day:12}]},["LINEA DIRECTA SEGURO COCHE","LINEA DIRECTA"]],
  ["luz","Luz",70,{freq:"bimestral"},["IBERDROLA CLIENTES LUZ","LUZ"]],
  ["hip","Hipoteca",600,{freq:"mes"},["HIPOTECA CUOTA","ADEUDO HIPOTECA"]],
];
const dd=n=>String(n).padStart(2,"0");
function extractoAmplio(semilla){
  const r=azar(semilla), uno=l=>l[Math.floor(r()*l.length)], p=x=>r()<x;
  const forma=semilla%5;
  const accounts=forma===0?[{id:"a",ent:"bbva",role:"ambos",spendFrom:true,value:3000}]
    :forma===1?[{id:"a",ent:"bbva",role:"diario",spendFrom:true,value:2000},{id:"b",ent:"ing",role:"fijos",value:1500}]
    :forma===2?[{id:"a",ent:"bbva",role:"fijos",value:2000},{id:"b",ent:"ing",role:"diario",spendFrom:true,value:800}]
    :forma===3?[{id:"a",ent:"bbva",role:"ambos",spendFrom:true,value:2500},{id:"b",ent:"ing",value:400}]
    :[{id:"a",ent:"bbva",value:2100},{id:"b",ent:"ing",spendFrom:true,value:650}];
  const diaria=accounts.find(a=>a.spendFrom);
  if(p(0.5)) diaria.roundup=uno([1,2]);
  const ents=accounts.map(a=>a.ent), settings={};
  if(p(0.4)) settings.expenseBanks=ents.filter(()=>p(0.5));
  if(p(0.5)) settings.budgetCycle=true;
  const fixed=[],debts=[],oneoffs=[],txs=[],expenses=[];
  let n=0;
  const tx=o=>{ txs.push(Object.assign({ext_id:p(0.85)?"x"+(++n):null,status:uno(["BOOK","BOOK","BOOK","PDNG",""]),card:p(0.3)},o)); return txs[txs.length-1]; };
  // Importes en el centro, en el borde y fuera de la tolerancia con que casa un recibo.
  const importe=b=>+uno([b,b,b,b+0.5,b-0.5,b+0.51,b*1.02,b*1.021,b*1.3]).toFixed(2);
  // La mitad de las veces el banco de gasto diario solo trae recibos: sus compras van a mano.
  const soloRecibos=p(0.5);
  POOL.forEach(function([id,name,base,extra,nombres]){
    if(!p(0.6)) return;
    const ent=uno(ents), cobro=base||172.05;
    const f=Object.assign({id,name,amount:base,day:uno([1,3,8,15,23,28,null]),account:ent},clon(extra));
    if(p(0.1)) f.bankAmount=+(cobro*uno([1,1.05])).toFixed(2);
    fixed.push(f);
    for(let i=uno([0,1,1,1,2]);i>0;i--){
      const t=tx({ent:p(0.9)?ent:uno(ents),date:"2026-10-"+dd(Math.max(1,Math.min(31,(f.day||11)+uno([0,0,-2,3,6])))),amount:importe(cobro),merchant:uno(nombres)});
      if(p(0.2)) expenses.push({id:"n"+(++n),date:new Date(t.date+"T09:30:00").toISOString(),merchant:uno([name,t.merchant]),amount:t.amount,category:"otros",source:uno(["wallet","macrodroid","manual"]),ent:t.ent});
    }
    if(p(0.3)) tx({ent,date:"2026-09-"+uno([27,29,30]),amount:importe(cobro),merchant:uno(nombres)});
    if(p(0.4)) tx({ent,date:"2026-11-"+dd(uno([1,2,3])),amount:importe(cobro),merchant:uno(nombres)});
  });
  if(p(0.5)){ const ent=uno(ents); debts.push({id:"dc",name:"Prestamo coche",monthly:189.5,account:ent,day:uno([5,18]),value:5000});
    tx({ent,date:"2026-10-"+uno(["05","18","06"]),amount:189.5,merchant:uno(["PRESTAMO COCHE FINANC","ADEUDO PRESTAMO","SANTANDER CONSUMER"])}); }
  if(p(0.3)){ const f=fixed.find(x=>x.id==="hip"), ent=f?f.account:uno(ents);
    debts.push({id:"dh",name:"Hipoteca",monthly:600,account:ent,day:1,value:90000}); tx({ent,date:"2026-10-01",amount:600,merchant:"HIPOTECA CUOTA"}); }
  if(p(0.5)){ const ent=uno(ents), d=uno([7,14,29]); oneoffs.push({id:"od",name:"Dentista",amount:120,year:2026,month:10,day:d,account:ent});
    tx({ent,date:"2026-10-"+dd(d),amount:uno([120,119.6,125]),merchant:uno(["CLINICA DENTISTA SONRISA","DENTISTA"])}); }
  if(p(0.2)){ const ent=uno(ents); oneoffs.push({id:"oi",name:"Impuesto circulacion",amount:66,year:2026,month:11,day:3,account:ent});
    tx({ent,date:uno(["2026-10-30","2026-11-02"]),amount:66,merchant:"AYTO IMPUESTO CIRCULACION"}); }
  for(let i=3+Math.floor(r()*6);i>0;i--){
    const mes=uno([10,10,10,9,11]), fecha="2026-"+mes+"-"+dd(mes===9?uno([25,30]):mes===11?uno([1,2]):1+Math.floor(r()*31));
    const compra={amount:uno([12.3,20.4,31,34.9,48,70,7.15,+(5+r()*90).toFixed(2)]),merchant:uno(["CARREFOUR","BAR MANOLO","","AGUA MINERAL SHOP","LUZ Y SONIDO SL","SEGUROS DENTAL ADESLAS"])};
    if(soloRecibos) expenses.push({id:"m"+(++n),date:fecha+"T12:00:00.000Z",merchant:compra.merchant||"Compra",amount:compra.amount,category:"super",source:"manual",ent:diaria.ent});
    else tx(Object.assign({ent:uno(ents),date:fecha},compra));
  }
  if(settings.budgetCycle||p(0.3)) tx({ent:uno(ents),date:uno(["2026-09-28","2026-10-01","2026-10-10","2026-10-27"]),amount:-1800,merchant:"NOMINA ACME SL",status:"BOOK",card:false,ext_id:"nom"});
  const d1=uno([9,16,22,28,31]), saldos=()=>{ const o={}; ents.forEach(e=>{ o[e]=+(300+r()*3000).toFixed(2); }); return o; };
  return {estado:{accounts,settings,fixed,debts,oneoffs,flows:[],expenses,bankTx:[],deleted:[],budget:uno([0,800,1200]),investments:[],assets:[],aportaciones:[],trAnchor:"2026-10"},
    txs,d1,d2:Math.min(31,d1+uno([0,1,5])),dn:uno([1,2,5]),saldos:[saldos(),saldos(),saldos()]};
}
const aLas=(mes,dia)=>new Date(2026,mes-1,dia,18).getTime();
const claveFila=e=>[String(e.date).slice(0,10),e.amount,e.obName!=null?e.obName:e.merchant,e.ent].join("|");
// Hasta el cierre de octubre; después, la sincronización de noviembre y el cierre siguiente.
function recorreAmplio({c,reloj},ex){
  const pasos={}, hasta=(mes,dia)=>ex.txs.filter(t=>t.date<="2026-"+mes+"-"+dd(dia)), contab=t=>t.status==="PDNG"?Object.assign({},t,{status:"BOOK"}):t;
  reloj.t=aLas(10,ex.d1);
  let s=sincroniza(c,c.reconcileTR(clon(ex.estado)),hasta(10,ex.d1),ex.saldos[0]);
  pasos.sync=cifras(c,s,2026,10,ex.d1);
  s=sincroniza(c,s,hasta(10,ex.d1).map(contab),ex.saldos[0]);
  pasos.contabilizado=cifras(c,s,2026,10,ex.d1);
  reloj.t=aLas(10,ex.d2);
  s=sincroniza(c,s,hasta(10,ex.d2).map(contab),ex.saldos[1]);
  pasos.otroDia=cifras(c,s,2026,10,ex.d2);
  const octubre=s;
  reloj.t=aLas(11,ex.dn);
  s=c.reconcileTR(clon(s));
  pasos.cierre=cifras(c,s,2026,11,ex.dn);
  s=sincroniza(c,s,hasta(11,ex.dn).filter(t=>t.date>="2026-10-24").map(contab),ex.saldos[2]);
  const noviembre=s, trasNoviembre=cifras(c,s,2026,11,ex.dn);
  reloj.t=aLas(12,1);
  const diciembre=c.reconcileTR(clon(s)).accounts.map(a=>a.value);
  return {pasos,octubre,noviembre,trasNoviembre,diciembre};
}
// La excepción aceptada, medida: qué compras reimporta la 119 que ahora siguen marcadas.
function compara(ex,etiqueta){
  const a=recorreAmplio(base,ex), b=recorreAmplio(cand,ex);
  assert.deepEqual(b.pasos,a.pasos,etiqueta+": hasta cerrar el mes, ni un céntimo de diferencia");
  assert.equal(JSON.stringify(b.octubre.expenses.filter(e=>!e.reciboId).map(claveFila).sort()),JSON.stringify(a.octubre.expenses.map(claveFila).sort()),etiqueta+": sin marca entra exactamente lo que ya entraba");
  const marcadas=new Set(b.noviembre.expenses.filter(e=>e.reciboId).map(claveFila)), sinMarca=new Set(b.noviembre.expenses.filter(e=>!e.reciboId).map(claveFila));
  const reimportadas=a.noviembre.expenses.filter(e=>!sinMarca.has(claveFila(e)));
  assert.ok(reimportadas.every(e=>marcadas.has(claveFila(e))),etiqueta+": lo único que la 119 tiene de más son cargos que aquí siguen marcados");
  assert.equal(b.noviembre.expenses.filter(e=>!e.reciboId).length,a.noviembre.expenses.length-reimportadas.length,etiqueta+": y aquí no entra nada que allí no");
  // El saldo, idéntico. El presupuesto, el de la 119 sin esas compras que antes eran un recibo.
  const {presupuesto:pa,...saldoA}=a.trasNoviembre, {presupuesto:pb,...saldoB}=b.trasNoviembre;
  assert.deepEqual(saldoB,saldoA,etiqueta+": saldo tras sincronizar en noviembre");
  assert.deepEqual(b.diciembre,a.diciembre,etiqueta+": cierre de noviembre");
  base.reloj.t=aLas(11,ex.dn);
  const sinEllas=Object.assign({},a.noviembre,{expenses:a.noviembre.expenses.filter(e=>reimportadas.indexOf(e)<0)});
  assert.deepEqual(pb,cifras(base.c,sinEllas,2026,11,ex.dn).presupuesto,etiqueta+": presupuesto tras sincronizar en noviembre");
  return {reimportadas:reimportadas.length,menos:+(pa.spent-pb.spent).toFixed(2),marcadas:b.octubre.expenses.filter(e=>e.reciboId).length,a,b};
}

const AMPLIOS=300;
test("segunda familia: deudas, puntuales, no mensuales, redondeo, «Mi ciclo» y sync al cruzar de mes", ()=>{
  let conMarca=0, conReimporte=0, conDeuda=0, conRedondeoSimulado=0;
  for(let k=1;k<=AMPLIOS;k++){
    const ex=extractoAmplio(7000+k*13), r=compara(ex,"amplio #"+k);
    extractos++;
    if(r.marcadas) conMarca++;
    if(r.reimportadas){ conReimporte++; assert.ok(r.menos>=0,"amplio #"+k+": nunca más gastado que en la 119"); }
    else assert.equal(r.menos,0,"amplio #"+k);
    if(r.b.octubre.expenses.some(e=>e.debtId)) conDeuda++;
    const diaria=r.b.octubre.accounts.find(x=>x.spendFrom);
    if(diaria.roundup&&r.b.octubre.expenses.some(e=>e.reciboId&&e.ent===diaria.ent&&e.source==="ob")&&!r.a.octubre.expenses.some(e=>e.source==="ob"&&e.ent===diaria.ent)) conRedondeoSimulado++;
  }
  // El generador no está ciego: cada caso que se quería cubrir ha salido de verdad.
  assert.ok(conMarca>AMPLIOS*0.8,"filas marcadas en "+conMarca);
  assert.ok(conReimporte>=3,"extractos con la excepción del cruce de mes: "+conReimporte);
  assert.ok(conDeuda>=30,"extractos con una cuota de deuda en Gastos: "+conDeuda);
  assert.ok(conRedondeoSimulado>=5,"extractos donde el cierre estima el redondeo y hay cargos de recibo: "+conRedondeoSimulado);
});

test("la excepción, con nombre y apellidos: el seguro anual cobrado a fin de mes ya no se cuenta como compra al mes siguiente", ()=>{
  for(const [caso,plan,cargo] of [
    ["recibo anual",{fixed:[{id:"hog",name:"Seguro hogar",amount:220,day:28,account:"bbva",freq:"año",months:[10]}]},{amount:220.5,merchant:"SEGUROS OCASO HOGAR",date:"2026-10-27"}],
    ["recibo trimestral",{fixed:[{id:"bas",name:"Basuras",amount:48,day:29,account:"bbva",freq:"trimestral"}]},{amount:48,merchant:"AYUNTAMIENTO TASA BASURAS",date:"2026-10-29"}],
    ["puntual",{oneoffs:[{id:"od",name:"Dentista",amount:120,year:2026,month:10,day:29,account:"bbva"}]},{amount:119.6,merchant:"DENTISTA",date:"2026-10-29"}],
  ]){
    const ex={estado:Object.assign({accounts:[{id:"a",ent:"bbva",role:"ambos",spendFrom:true,value:3000}],settings:{budgetCycle:true},fixed:[],debts:[],oneoffs:[],flows:[],expenses:[],bankTx:[],deleted:[],budget:800,investments:[],assets:[],aportaciones:[],trAnchor:"2026-10"},plan),
      txs:[Object.assign({ext_id:"x1",ent:"bbva",status:"BOOK",card:false},cargo),{ext_id:"nom",ent:"bbva",date:"2026-10-10",amount:-1800,merchant:"NOMINA ACME SL",status:"BOOK",card:false}],
      d1:31,d2:31,dn:2,saldos:[{bbva:2500},{bbva:2500},{bbva:2400}]};
    const r=compara(ex,caso);
    assert.equal(r.reimportadas,1,caso+": la 119 lo volvía a meter en noviembre");
    assert.equal(r.a.trasNoviembre.presupuesto.spent,cargo.amount,caso+": y lo contaba como una compra del ciclo");
    assert.equal(r.b.trasNoviembre.presupuesto.spent,0,caso+": ahora sigue siendo el cargo de su recibo");
    assert.equal(r.b.noviembre.expenses.filter(e=>e.reciboId).length,1,caso);
    extractos++;
  }
});

test("la excepción, segunda forma: subir el importe de un recibo y volver a sincronizar no convierte su cargo en una compra", ()=>{
  const txs=[{ext_id:"x1",ent:"bbva",date:"2026-10-05",amount:62.4,merchant:"ENDESA ENERGIA XXI",status:"BOOK",card:false},{ext_id:"x2",ent:"bbva",date:"2026-10-07",amount:40,merchant:"CARREFOUR",status:"BOOK",card:true}];
  for(const rol of ["diario","ambos"]){
    const tras=function({c,reloj}){
      reloj.t=aLas(10,12);
      const s0={accounts:[{id:"a",ent:"bbva",role:rol,spendFrom:true,value:500}],settings:{},fixed:[{id:"luz",name:"Luz Endesa",amount:62.4,freq:"mes",day:5,account:"bbva"}],debts:[],oneoffs:[],flows:[],bankTx:[],deleted:[],budget:800,investments:[],assets:[],aportaciones:[],trAnchor:"2026-10",expenses:[]};
      const primera=sincroniza(c,s0,txs,{bbva:397.6});
      const subido=Object.assign({},primera,{fixed:primera.fixed.map(f=>Object.assign({},f,{amount:80}))});
      return [cifras(c,primera,2026,10,12),cifras(c,sincroniza(c,subido,txs,{bbva:397.6}),2026,10,12)];
    };
    const [a1,a2]=tras(base), [b1,b2]=tras(cand);
    assert.deepEqual(b1,a1,rol+": la primera sincronización, idéntica");
    assert.equal(a2.presupuesto.spent,102.4,rol+": la 119 metía el cargo viejo como compra");
    assert.equal(b2.presupuesto.spent,40,rol+": ahora el gastado no cambia por editar el recibo");
    assert.deepEqual([b2.pintado,b2.previsto],[a2.pintado,a2.previsto],rol+": y el saldo es el mismo, el del banco");
    assert.equal(b2.pintado[0],397.6);
  }
});

test("un cargo que solo casa con una deuda no se marca como recibo: entra como su cuota, igual que antes", ()=>{
  const ex={estado:{accounts:[{id:"a",ent:"bbva",role:"ambos",spendFrom:true,value:3000}],settings:{},fixed:[{id:"gim","name":"Gimnasio",amount:34.9,freq:"mes",day:3,account:"bbva"}],
      debts:[{id:"dc",name:"Prestamo coche",monthly:189.5,account:"bbva",day:5,value:5000}],oneoffs:[],flows:[],expenses:[],bankTx:[],deleted:[],budget:800,investments:[],assets:[],aportaciones:[],trAnchor:"2026-10"},
    txs:[{ext_id:"x1",ent:"bbva",date:"2026-10-05",amount:189.5,merchant:"PRESTAMO COCHE FINANC",status:"BOOK",card:false},{ext_id:"x2",ent:"bbva",date:"2026-10-03",amount:34.9,merchant:"GIMNASIO FITUP",status:"BOOK",card:false}],
    d1:12,d2:12,dn:2,saldos:[{bbva:2775.6},{bbva:2775.6},{bbva:2775.6}]};
  const r=compara(ex,"deuda");
  assert.equal(JSON.stringify(r.b.octubre.expenses.map(e=>[e.merchant,e.debtId||null,e.reciboId||null])),JSON.stringify([["PRESTAMO COCHE FINANC","dc",null],["GIMNASIO FITUP",null,"gim"]]));
  extractos++;
});

test("el cierre estima el redondeo igual con el cargo de un recibo en la lista que sin él", ()=>{
  // El banco de gasto diario solo trae el recibo; las compras con tarjeta están apuntadas a mano.
  // La 119 no tenía ninguna fila del banco y al cerrar restaba el redondeo estimado.
  const ex={estado:{accounts:[{id:"a",ent:"bbva",role:"diario",spendFrom:true,value:800,roundup:1}],settings:{},fixed:[{id:"hog",name:"Seguro hogar",amount:220,day:23,account:"bbva",freq:"año",months:[10]}],
      debts:[],oneoffs:[],flows:[],bankTx:[],deleted:[],budget:1200,investments:[],assets:[],aportaciones:[],trAnchor:"2026-10",
      expenses:[{id:"m1",date:"2026-10-03T12:00:00.000Z",merchant:"Mercado",amount:18.2,category:"super",source:"manual",ent:"bbva"}]},
    txs:[{ext_id:"x5",ent:"bbva",date:"2026-10-22",amount:220,merchant:"OCASO SEGURO",status:"BOOK",card:true}],d1:28,d2:28,dn:2,saldos:[{bbva:1777.52},{bbva:1777.52},{bbva:1700}]};
  const a=recorreAmplio(base,ex), b=recorreAmplio(cand,ex);
  assert.equal(b.octubre.expenses.filter(e=>e.reciboId).length,1);
  assert.deepEqual(b.pasos.cierre,a.pasos.cierre);
  // La base anclada lleva el saldo del banco más la compra a mano y su redondeo (1777,52 + 18,20
  // + 0,80); el cierre resta esos dos y vuelve al saldo del banco. El cargo de 220 no redondea.
  assert.equal(b.pasos.contabilizado.base[0],1796.52);
  assert.equal(b.pasos.cierre.base[0],1777.52);
  extractos++;
});

test("el generador ha recorrido los extractos previstos", ()=>{
  assert.equal(extractos,ROLES.length*2*2*3*SEMILLAS+ROLES.length*SEMILLAS+AMPLIOS+3+1+1);
});
