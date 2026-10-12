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
const ASPSP={sabadell:"Banco de Sabadell",caixabank:"CaixaBank"};

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
  const hoy=new c.Date();
  const conTx=Object.assign({},s,{expenses:[...add].concat(s.expenses||[]),bankTx:flat});
  return c.applyBankBalances(c.reconcileFixedPaymentProofs(conTx,hoy.getFullYear(),hoy.getMonth()+1,hoy.getDate()),links).state;
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

test("el generador ha recorrido los extractos previstos", ()=>{
  assert.equal(extractos,ROLES.length*2*2*3*SEMILLAS+ROLES.length*SEMILLAS);
});
