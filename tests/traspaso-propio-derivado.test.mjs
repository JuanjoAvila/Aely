// EL TRASPASO ENTRE TUS CUENTAS NO ES NI GASTO NI INGRESO (caso real del 21/11/2026).
// Salida en un banco y llegada sin nombre en otro: la llegada contaba como ingreso y la cabecera
// enseñaba ese neto como un gasto. La pareja se reconoce AL LEER, sin escribir nada. Lo que de verdad
// protege este test son los contraejemplos: un cobro real por el mismo importe jamás puede desaparecer.
// Nombres, bancos de ejemplo e importes inventados: nunca los de una cartera real.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { transformSync } from "esbuild";
import { loadPureLogic } from "../scripts/load-pure-logic.mjs";

const source=file=>fs.readFileSync(new URL("../"+file,import.meta.url),"utf8").replaceAll("\r\n","\n");
const order=JSON.parse(source("src/build-order.json"));
const shell=source("src/shell.html");
const AHORA=Date.parse("2026-11-20T12:00:00Z");
const cargar=(cambiar)=>{
  const c=loadPureLogic(shell.replace("<!--MC_APP_SCRIPT-->",()=>order.map(f=>{
    const s=source("src/modules/"+f); return cambiar?cambiar(f,s):s; }).join("\n")));
  c.Date=class extends Date{ constructor(...a){ super(...(a.length?a:[AHORA])); } static now(){ return AHORA; } };
  // 13-hogar queda fuera del corte de la lógica pura (va tras ErrorBoundary): se carga a mano su foto.
  const h0=source("src/modules/13-hogar.js"), h=cambiar?cambiar("13-hogar.js",h0):h0, hs=h.indexOf("function buildHouseholdSnapshot("), he=h.indexOf("\nfunction mergeHouseholdSnapshots",hs);
  vm.runInContext(h.slice(hs,he),c);
  return c;
};
const edge=(file,imports={})=>{
  const mod={exports:{}}, raw=source(file).replace(/^import\s[\s\S]*?from\s+"[^"]+";\n/gm,"");
  new Function("module","exports",...Object.keys(imports),transformSync(raw,{loader:"ts",format:"cjs"}).code)(mod,mod.exports,...Object.values(imports));
  return mod.exports;
};
const copia=x=>JSON.parse(JSON.stringify(x));
const TITULAR="Nadia Prueba Ejemplo", IMPORTE=873.45;
const fila=(id,ent,date,amount,merchant,category,extra)=>Object.assign({id,ent,date:date+"T12:00:00.000Z",amount,merchant,obName:merchant,category,source:"ob",status:"BOOK"},extra||{});
const NOMINA=fila("nom","caixabank","2026-11-18",-912.30,"NOMINA ACME SL","ingreso");
const SALE=fila("sale","caixabank","2026-11-18",IMPORTE,"TRANSFERENCIA A "+TITULAR.toUpperCase(),"traspaso");
const ENTRA=fila("entra","trade_republic","2026-11-18",-IMPORTE,"Movimiento","ingreso");
const CAFE=fila("cafe","trade_republic","2026-11-19",3.2,"Panaderia Ejemplo","super");
const estado=(expenses,cambios)=>copia(Object.assign({
  accounts:[{id:"cx",ent:"caixabank",role:"ambos",value:1000},{id:"tr",ent:"trade_republic",role:"diario",spendFrom:true,value:900}],
  fixed:[],debts:[],oneoffs:[],flows:[],expenses,bankTx:[],deleted:[],investments:[],assets:[],aportaciones:[],obAccounts:[],budget:500,
  settings:{expenseBanks:["caixabank","trade_republic"],gTotalMode:"split",profile:{fullName:TITULAR}}
},cambios||{}));

function suite(c){
  const fallos=[];
  const caso=(nombre,fn)=>{ try{ fn(); }catch(e){ fallos.push(nombre+": "+e.message); } };
  const pares=s=>Array.from(c.traspasosPropiosDe(s).keys()).sort();
  const nada=(nombre,filas,cambios)=>caso(nombre,()=>assert.deepEqual(pares(estado(filas,cambios)),[],"no se empareja"));

  caso("el caso: las dos patas son neutras y solo queda el gasto real",()=>{
    const s=estado([NOMINA,SALE,ENTRA,CAFE]);
    assert.deepEqual(pares(s),["entra","sale"]);
    const b=c.monthBudgetStats(s,AHORA,null,"net");
    assert.equal(+b.spent.toFixed(2),3.2);
    assert.equal(+b.income.toFixed(2),912.3,"el único ingreso es la nómina");
    assert.equal(c.expenseBucket(s.expenses[2],s),"neutra");
    assert.equal(c.expenseCountsBudget(s.expenses[2],s),false);
  });
  caso("Mi ciclo: la nómina lo abre y la llegada tampoco suma",()=>{
    const s=estado([NOMINA,SALE,ENTRA,CAFE]); s.settings.budgetCycle=true;
    const b=c.monthBudgetStats(s);
    assert.equal(b.cycle,true);
    assert.equal(+b.income.toFixed(2),0);
    assert.equal(+b.shown.toFixed(2),3.2);
  });
  caso("el ciclo informativo no se ancla al traspaso",()=>{
    const s=estado([ENTRA,SALE,NOMINA]);
    const p=c.lastPaydayOf(s.expenses,AHORA,c.expenseDeletedSet(s),c.noEsTraspasoDerivado(s));
    assert.equal(p.inc.id,"nom");
  });
  caso("una salida en «Otros» a tu nombre tampoco cuenta en categorías",()=>{
    const s=estado([fila("o","caixabank","2026-11-18",IMPORTE,"TRANSFERENCIA A "+TITULAR.toUpperCase(),"otros"),ENTRA,CAFE]);
    assert.deepEqual(pares(s),["entra","o"]);
    assert.equal(c.categorySpentByMonth(s,AHORA).some(x=>x.id==="otros"&&x.spent>0),false);
  });
  caso("la salida que nombra el banco de destino también vale",()=>{
    assert.deepEqual(pares(estado([fila("o","caixabank","2026-11-18",IMPORTE,"TRANSFERENCIA A TRADE REPUBLIC BANK","otros"),ENTRA])),["entra","o"]);
  });
  caso("la entrada a nombre del titular también vale",()=>{
    assert.deepEqual(pares(estado([SALE,fila("t","trade_republic","2026-11-18",-IMPORTE,"Transferencia de "+TITULAR,"ingreso")])),["sale","t"]);
  });
  caso("a dos días de distancia sigue siendo la pareja",()=>{
    assert.deepEqual(pares(estado([SALE,Object.assign({},ENTRA,{date:"2026-11-20T12:00:00.000Z"})])),["entra","sale"]);
  });
  caso("no escribe nada ni cambia lo que mueve el saldo",()=>{
    const s=estado([NOMINA,SALE,ENTRA,CAFE]), antes=JSON.stringify(s);
    c.monthBudgetStats(s,AHORA); c.categorySpentByMonth(s,AHORA); c.expenseBucket(s.expenses[2],s);
    assert.equal(JSON.stringify(s),antes);
    assert.equal(c.expenseCountsCash(s.expenses[2],s),true);
    assert.equal(c.expenseCountsCash(s.expenses[1],s),true);
    assert.deepEqual(Array.from(c.reconcileObDupes(s).recat),[],"nada se sube a la nube");
  });

  nada("nómina del mismo importe",[SALE,fila("x","trade_republic","2026-11-18",-IMPORTE,"NOMINA ACME SL","ingreso")]);
  nada("nómina sin nombre pero dicha en el concepto",[SALE,Object.assign({},ENTRA,{concept:"Nomina noviembre"})]);
  nada("concepto de un tercero",[SALE,Object.assign({},ENTRA,{concept:"Pago de Marta Vidal"})]);
  nada("ingreso esperado en Plan por ese banco",[SALE,ENTRA],{flows:[{id:"f",kind:"income",name:"Cobro alquiler",amount:IMPORTE,to:"trade_republic",day:18}]});
  nada("Bizum del mismo importe",[SALE,fila("x","trade_republic","2026-11-18",-IMPORTE,"Bizum de Marta Vidal","bizum")]);
  nada("Bizum sin nombre, dicho en la nota",[SALE,Object.assign({},ENTRA,{note:"bizum"})]);
  nada("tercero con nombre",[SALE,fila("x","trade_republic","2026-11-18",-IMPORTE,"Marta Vidal","ingreso")]);
  nada("dos entradas candidatas",[SALE,ENTRA,fila("e2","revolut","2026-11-18",-IMPORTE,"Movimiento","ingreso")],{accounts:[{id:"cx",ent:"caixabank",value:1},{id:"tr",ent:"trade_republic",value:1},{id:"rv",ent:"revolut",value:1}]});
  nada("un cobro de un tercero crea la duda aunque haya otra entrada apta",[SALE,ENTRA,fila("e2","revolut","2026-11-19",-IMPORTE,"Marta Vidal","ingreso")],{accounts:[{id:"cx",ent:"caixabank",value:1},{id:"tr",ent:"trade_republic",value:1},{id:"rv",ent:"revolut",value:1}]});
  nada("dos salidas candidatas",[SALE,fila("s2","caixabank","2026-11-17",IMPORTE,"TRANSFERENCIA A "+TITULAR.toUpperCase(),"traspaso"),ENTRA]);
  nada("ventana superada",[SALE,Object.assign({},ENTRA,{date:"2026-11-21T12:00:00.000Z"})]);
  nada("mismo banco",[SALE,Object.assign({},ENTRA,{ent:"caixabank"})]);
  nada("un céntimo de diferencia",[SALE,Object.assign({},ENTRA,{amount:-873.46})]);
  nada("el alquiler a un tercero no es la otra pata",[fila("o","caixabank","2026-11-18",IMPORTE,"TRANSFERENCIA A CASERO EJEMPLO SL","otros"),ENTRA]);
  nada("un gasto con categoría real no es la otra pata",[fila("o","caixabank","2026-11-18",IMPORTE,"TRANSFERENCIA A "+TITULAR.toUpperCase(),"hogar"),ENTRA]);
  nada("una retirada de cajero no es la otra pata",[fila("o","caixabank","2026-11-18",IMPORTE,"Reintegro cajero","traspaso"),ENTRA]);
  nada("banco que no es tuyo",[SALE,ENTRA],{accounts:[{id:"cx",ent:"caixabank",value:1},{id:"rv",ent:"revolut",value:1}]});
  nada("posible repetido",[SALE,Object.assign({},ENTRA,{possibleDup:true})]);
  nada("apunte pendiente",[SALE,Object.assign({},ENTRA,{status:"PDNG"})]);
  nada("apunte a mano",[SALE,Object.assign({},ENTRA,{source:"manual"})]);
  nada("él ya dijo que era un ingreso",[SALE,Object.assign({},ENTRA,{catAckAt:123})]);
  caso("su «no es un traspaso» rompe la pareja por cualquiera de las dos patas",()=>{
    for(const i of [0,1]){
      const s=estado([SALE,ENTRA]); assert.equal(pares(s).length,2);
      const r=Object.assign({},s,c.traspasoPropioNoPon(s,s.expenses[i],AHORA));
      assert.deepEqual(pares(r),[]);
    }
  });
  caso("sentido TR→banco: la salida «Movimiento» solo vale con el nombre ENTERO del titular en la llegada",()=>{
    const sm=fila("sm","trade_republic","2026-11-18",IMPORTE,"Movimiento","otros");
    const llega=(n,extra)=>fila("ll","caixabank","2026-11-18",-IMPORTE,n,"ingreso",extra);
    assert.deepEqual(pares(estado([sm,llega("TRANSFERENCIA DE "+TITULAR.toUpperCase())])),["ll","sm"],"con nombre completo empareja");
    assert.deepEqual(pares(estado([sm,llega("TRANSFERENCIA DE MARTA VIDAL")])),[],"con un tercero no");
    assert.deepEqual(pares(estado([sm,llega("Movimiento")])),[],"con llegada anónima no");
    assert.deepEqual(pares(estado([sm,llega("TRANSFERENCIA DE NADIA PRUEBA")])),[],"con nombre a medias no");
  });
  caso("el alcance del widget lleva los traspasos, en el mes y en Mi ciclo",()=>{
    const s=estado([NOMINA,SALE,ENTRA,CAFE]);
    const mes=JSON.parse(c.widgetScopeOf(s,c.dashboardBudgetStats(s),"","trade_republic"));
    assert.equal(mes[4].length,3,"nóminas, no nóminas y traspasos");
    assert.deepEqual(mes[4][2],[c.keyOfExpense(s.expenses[2])]);
    s.settings.budgetCycle=true;
    const st=c.monthBudgetStats(s);
    const ciclo=JSON.parse(c.widgetScopeOf(s,st,"nom","trade_republic"));
    assert.equal(ciclo[4].length,2,"ancla y traspasos");
  });
  caso("firme: una fila de recibo, deuda, meta o con meta pendiente no empareja",()=>{
    for(const k of ["reciboId","debtId","goalId","metaPend"]){
      for(const i of [0,1]){
        const s=estado([SALE,ENTRA]); s.expenses[i][k]="x1";
        assert.deepEqual(pares(s),[],k+" en la pata "+i);
      }
    }
  });
  caso("Hogar: «gastado» no se ve negativo con las patas en meses distintos y no cuenta las patas del traspaso",()=>{
    const s=estado([fila("sale","caixabank","2026-10-31",300.5,"TRANSFERENCIA A "+TITULAR.toUpperCase(),"traspaso"),fila("entra","trade_republic","2026-11-02",-300.5,"Movimiento","ingreso")]);
    assert.equal(c.traspasosPropiosDe(s).size,2);
    const bruto=-300.5;
    const h=c.buildHouseholdSnapshot(s,{thisMonthSpent:bruto},"a@b.c");
    assert.equal(h.thisMonthSpent,0);
    const h2=c.buildHouseholdSnapshot(s,{thisMonthSpent:bruto+10},"a@b.c");
    assert.equal(h2.thisMonthSpent,10,"el bruto sin la llegada");
    assert.equal(c.buildHouseholdSnapshot(estado([]),{thisMonthSpent:-50},"a@b.c").thisMonthSpent,0,"nunca negativo");
    const o=estado([fila("o","caixabank","2026-11-18",IMPORTE,"TRANSFERENCIA A "+TITULAR.toUpperCase(),"otros"),ENTRA,CAFE]);
    assert.equal(c.traspasosPropiosDe(o).size,2);
    assert.deepEqual(Array.from(c.buildHouseholdSnapshot(o,{},"a@b.c").expensesByCat,x=>x.id),["super"],"el desglose no cuenta la pata «otros»");
  });
  caso("el veto «no es un traspaso» no caduca por el tope de RECIBO_NO_MAX",()=>{
    let s={reciboNo:[],reciboNoAt:{}};
    s=Object.assign(s,c.reciboNoPon(s,["traspasoNo|vieja"],true,1));
    for(let i=0;i<450;i++) s=Object.assign(s,c.reciboNoPon(s,["x|"+i],true,10+i));
    assert.ok(s.reciboNo.indexOf("traspasoNo|vieja")>=0,"sigue vetada");
    assert.ok(s.reciboNoAt["traspasoNo|vieja"]>0);
  });
  caso("un neto a favor lleva «+»: justo 0 no, y -0,01 sí",()=>{
    assert.equal(c.gxConFavor({}, 0, "f").favor,undefined);
    assert.equal(c.gxConFavor({}, 0.004, "f").favor,undefined);
    assert.equal(c.gxConFavor({}, -0.01, "f").favor,true);
    assert.equal(c.gxConFavor({}, -0.01, "f").tail,"f");
    assert.equal(c.gxConFavor({}, 5, "f").favor,undefined);
  });
  caso("un importe imposible no se enseña",()=>{
    for(const x of [NaN,Infinity,-Infinity,1e7+1,-1e12,"12",null]) assert.equal(c.gxCifraOk(x),false,String(x));
    for(const x of [0,-1448.2,1e7]) assert.equal(c.gxCifraOk(x),true,String(x));
    assert.equal(c.gxEur(NaN),"—");
  });
  return fallos;
}

const buena=cargar();
const fallos=suite(buena);
assert.deepEqual(fallos,[],"la suite pasa sobre el código real");

// LA MISMA CIFRA CON LA APP CERRADA: ingest recibe las claves y hace neutras esas filas.
{
  const presupuesto=edge("supabase/functions/_shared/presupuesto.ts"), widget=edge("supabase/functions/ingest/widget.ts",presupuesto);
  const nube=(f)=>({id:f.id,importe:f.amount,cat:f.category,source:"ob:"+f.ent,fecha:f.date,comercio:f.merchant,ingest_event_id:null});
  const CAFE_HOY=fila("cafe","trade_republic","2026-11-19",3.2,"Panaderia Ejemplo","super");
  const s=estado([NOMINA,SALE,ENTRA,CAFE_HOY]);
  const stats=buena.dashboardBudgetStats(s);
  assert.deepEqual(Array.from(stats.traspasos),[buena.keyOfExpense(s.expenses[2])],"solo viaja la pata que aún no es neutra");
  const scope=buena.widgetScopeOf(s,stats,"","trade_republic");
  const data=copia(Object.assign({},s,{widgetPeriod:buena.widgetPeriodOf(stats,"",scope)}));
  const foto=widget.widgetSnapshot(data,s.expenses.map(nube),AHORA,{id:"cafe",event:"ev",key:"k"});
  assert.ok(foto,"ingest reconoce el alcance con traspasos");
  assert.equal(foto.spent,+stats.against.toFixed(2),"widget = Inicio");
  assert.equal(foto.against,3.2,"la llegada no devuelve margen");
  const mes=presupuesto.statsDelMes(s.expenses.map(nube),Object.assign({},data,{settings:Object.assign({},data.settings,{gTotalMode:"net"})}),Date.parse("2026-10-31T23:00:00Z"));
  assert.equal(mes.income,912.3,"el contrato antiguo tampoco la cuenta como ingreso");
  const sinTraspasos=estado([NOMINA,CAFE_HOY]), st=buena.dashboardBudgetStats(sinTraspasos);
  assert.equal(JSON.parse(buena.widgetScopeOf(sinTraspasos,st,"","trade_republic"))[4].length,2,"sin traspasos, el alcance de siempre");
}

// CADA CONDICIÓN LA VIGILA UN CASO: se rompe la regla y la suite tiene que caer.
const MUTANTES=[
  ["08-motor-bank.js","const TRASPASO_VENTANA_DIAS=2;","const TRASPASO_VENTANA_DIAS=3;"],
  ["08-motor-bank.js","if(salen.length!==1) return;","if(!salen.length) return;"],
  ["08-motor-bank.js","if(entran.length!==1||entran[0]!==e||","if("],
  ["08-motor-bank.js","return lista.filter(function(o){ return expenseBankOf(o)!==b&&Math.abs(dia.get(o)-d)<=TRASPASO_VENTANA_DIAS; });","return lista.filter(function(o){ return Math.abs(dia.get(o)-d)<=TRASPASO_VENTANA_DIAS; });"],
  ["08-motor-bank.js","return m===\"movimiento\"||m===\"ingreso\"||traspasoDelTitular(titular,x); })) return false;","return true; })) return false;"],
  ["08-motor-bank.js","if(!traspasoTextoNeutro(titular,e.concept)||!traspasoTextoNeutro(titular,e.note)) return false;",""],
  ["08-motor-bank.js","return !(s.flows||[]).some(function(f){ return f&&f.kind===\"income\"&&flowBancoEntra(f)===banco&&recAmtClose(Number(f.amount),importe); });","return true;"],
  ["08-motor-bank.js","if(isAtmWithdrawal(o.merchant)||isAtmWithdrawal(o.obName)||o.withdrawalConfirmedAt) return false;",""],
  ["08-motor-bank.js","if(o.category!==\"otros\"||o.catAckAt!=null) return false;","if(o.catAckAt!=null) return false;"],
  ["08-motor-bank.js","return sinPre!==benef&&banco.length>=4&&(sinPre===banco||sinPre.indexOf(banco+\" \")===0);","return true;"],
  ["08-motor-bank.js","if(e.category===\"ingreso\"&&e.catAckAt!=null) return false;",""],
  ["08-motor-bank.js","if(!esFilaDeBanco(x)||x.obPending||","if(x.obPending||"],
  ["08-motor-bank.js","||!propios.has(expenseBankOf(x))) return false;",") return false;"],
  ["08-motor-bank.js","if(x.status&&String(x.status).toUpperCase()!==\"BOOK\") return false;\n    if((x.cur","if((x.cur"],
  ["08-motor-bank.js","return !reciboVetado(s,TRASPASO_NO,traspasoPropioClave(x));","return true;"],
  ["08-motor-bank.js","if(!x||x.possibleDup||x.autoGemelo||","if(!x||x.autoGemelo||"],
  ["08-motor-bank.js","expenseIsTombstoned(e,delSet) || traspasoPropioDerivado(e,state)) return 0;","expenseIsTombstoned(e,delSet)) return 0;"],
  ["01-i18n.js","if(!e || CAT_NEUTRAS[e.category] || traspasoPropioDerivado(e,s)) return false;","if(!e || CAT_NEUTRAS[e.category]) return false;"],
  ["01-i18n.js","if((e.amount||0)<0){\n    if(CAT_NEUTRAS[e.category]||traspasoPropioDerivado(e,s)) return \"neutra\";","if((e.amount||0)<0){\n    if(CAT_NEUTRAS[e.category]) return \"neutra\";"],
  ["08-motor-bank.js","function noEsTraspasoDerivado(s){ return function(e){ return !traspasoPropioDerivado(e,s); }; }","function noEsTraspasoDerivado(s){ return function(){ return true; }; }"],
  ["08-motor-bank.js","if(x.reciboId||x.debtId||x.goalId||x.metaPend||","if("],
  ["08-motor-bank.js","if(x.reciboId||x.debtId||x.goalId||x.metaPend||","if(x.debtId||x.goalId||x.metaPend||"],
  ["08-motor-bank.js","if(x.reciboId||x.debtId||x.goalId||x.metaPend||","if(x.reciboId||x.goalId||x.metaPend||"],
  ["08-motor-bank.js","if(x.reciboId||x.debtId||x.goalId||x.metaPend||","if(x.reciboId||x.debtId||x.metaPend||"],
  ["08-motor-bank.js","if(x.reciboId||x.debtId||x.goalId||x.metaPend||","if(x.reciboId||x.debtId||x.goalId||"],
  ["08-motor-bank.js","].concat(tras.length?[tras]:[]);","];"],
  ["08-motor-bank.js","&&[e.merchant,e.obName].some(function(x){ return x!=null&&String(x).trim()&&traspasoDelTitular(titular,x); });","&&true;"],
  ["08-motor-bank.js","k.indexOf(\"traspasoNo|\")===0; }","false; }"],
  ["13-hogar.js","if(parseDate(e.date)>=monthStart&&expenseCountsCash(e,state)&&traspasoPropioDerivado(e,state)) gastadoHogar-=Number(e.amount)||0;",""],
  ["13-hogar.js","gastadoHogar=Math.max(0,gastadoHogar);",""],
  ["13-hogar.js","if(traspasoPropioDerivado(e,state)) return;","" ],
  ["04-tab-gastos.js","Math.round(neto*100)<0","Math.round(neto*100)<=0"],
  ["04-tab-gastos.js","function gxCifraOk(x){ return typeof x===\"number\"&&isFinite(x)&&Math.abs(x)<=GX_TOPE_CIFRA; }","function gxCifraOk(x){ return typeof x===\"number\"&&isFinite(x); }"],
];
for(const [file,de,a] of MUTANTES){
  assert.ok(source("src/modules/"+file).includes(de),"mutante sin ancla: "+de.slice(0,60));
  const m=cargar((f,s)=>f===file?s.replace(de,()=>a):s);
  assert.ok(suite(m).length>0,"mutante vivo: "+de.slice(0,70));
}
console.log("traspaso-propio-derivado OK ("+MUTANTES.length+" mutantes cazados)");
