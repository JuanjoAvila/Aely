// LO QUE ENTRA Y LO QUE MUEVES CON EL CICLO DE UN RECIBO (petición del dueño, 12/11/2026: «que también
// se enlacen con Gastos como el resto de recibos… sale en "Lo que aún entrará" y luego se pierde»).
// Se comprueba lo que se ve (pendiente / «Ya ha entrado» y con qué movimiento) y, sobre todo, que el
// dinero NO se cuenta dos veces: el saldo, el recorrido de «¿Te llega?» y el previsto siguen con su
// regla de siempre y el único anclaje es el mismo que ya hacía el extracto. Cifras hechas a mano.
// Cada mutante del motor (08) tiene que tumbar al menos un caso: si no, el caso no vigila nada.
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPureLogic } from "../scripts/load-pure-logic.mjs";

const source=file=>fs.readFileSync(new URL("../"+file,import.meta.url),"utf8").replaceAll("\r\n","\n");
const order=JSON.parse(source("src/build-order.json"));
const shell=source("src/shell.html");
const cargar=(cambiar)=>{
  const c=loadPureLogic(shell.replace("<!--MC_APP_SCRIPT-->",()=>order.map(f=>{
    const s=source("src/modules/"+f); return f==="08-motor-bank.js"&&cambiar?cambiar(s):s; }).join("\n")));
  c.Date=class extends Date{ constructor(...a){ super(...(a.length?a:[reloj.ms])); } static now(){ return reloj.ms; } };
  return c;
};
// Mediodía: el mismo día en Madrid y en la CI (UTC).
const reloj={ms:0};
const dia=d=>{ reloj.ms=Date.parse("2026-11-"+String(d).padStart(2,"0")+"T12:00:00Z"); return d; };
const Y=2026, M=11, copia=x=>JSON.parse(JSON.stringify(x));
const NOM={id:"nom",kind:"income",name:"Nómina",amount:2000,to:"sabadell",day:28};
const fila=(id,ent,date,amount,merchant,extra)=>Object.assign({id,ent,date,amount,merchant,source:"ob",status:"BOOK",category:amount<0?"ingreso":"otros"},extra||{});
const estado=(cambios)=>copia(Object.assign({
  accounts:[{id:"sab",ent:"sabadell",role:"fijos",value:1000},{id:"rev",ent:"revolut",role:"fijos",value:300}],
  fixed:[],debts:[],oneoffs:[],flows:[NOM],expenses:[],bankTx:[],deleted:[],investments:[],assets:[],aportaciones:[],obAccounts:[],settings:{},
  trasAbonoDesde:20261101
},cambios||{}));

function suite(c){
  const fallos=[];
  const caso=(nombre,fn)=>{ try{ fn(); }catch(e){ fallos.push(nombre+": "+e.message); } };
  const mostrado=(s,ent)=>{ const a=s.accounts.find(x=>x.ent===ent), i=c.insumosSaldoGasto(s);
    return Math.round(c.saldoCuentaMostrada(a,{injTR:i.injTR,spentByBank:i.spentByBank,paidNetByBank:i.paidNetByBank,roundup:i.roundup,monthlyInvest:i.monthlyInvest})*100)/100; };
  const pack=(s,d)=>c.planChargesMonth(s,M,Y,d);
  const entrada=(s,d,b)=>c.bankPendingEvents(s,b||"sabadell",Y,M,d).filter(e=>e.id!=null&&e.amt>0).reduce((a,e)=>a+e.amt,0);

  caso("antes de llegar: en «Lo que aún entrará», sin atrasar, y el recorrido la sumará el 28",()=>{
    const s=estado(), p=pack(s,dia(20));
    assert.equal(p.incomePending.length,1); assert.equal(p.incomePending[0].overdue,false); assert.equal(p.flowsDone.length,0);
    assert.equal(entrada(s,20),2000);
    assert.equal(c.monthNetForAccount(s,"sabadell",Y,M,20),0);
  });
  caso("llega su día con su abono: «Ya ha entrado» con ESE movimiento, y el saldo lo suma una sola vez",()=>{
    const s=estado({expenses:[fila("e1","sabadell","2026-11-28",-2000,"EMPRESA SL")]}), p=pack(s,dia(28));
    assert.equal(p.incomePending.length,0); assert.equal(p.flowsDone.length,1);
    assert.equal(p.flowsDone[0].expenseId,"e1"); assert.equal(p.flowsDone[0].paidBank,"sabadell"); assert.equal(p.flowsDone[0].day,28);
    assert.equal(c.monthNetForAccount(s,"sabadell",Y,M,28),2000);
    assert.equal(entrada(s,28),0);
    // Enlazarlo a mano un movimiento del mismo día no ancla nada: el calendario ya lo había sumado.
    const n=c.flowEnlazar(s,"nom","e1",Y,M,28,1);
    assert.equal(n.flows[0].paidYm,undefined); assert.equal(mostrado(n,"sabadell"),mostrado(s,"sabadell"));
    assert.equal(c.monthNetForAccount(n,"sabadell",Y,M,28),2000);
  });
  caso("adelantada: enlazar el abono del 25 ancla como el extracto y el 28 no la suma otra vez",()=>{
    const s=estado({expenses:[fila("e1","sabadell","2026-11-25",-2000,"TRANSFERENCIA EMPRESA")]});
    dia(26);
    const antes=mostrado(s,"sabadell");
    const n=c.flowEnlazar(s,"nom","e1",Y,M,26,1);
    assert.equal(n.flows[0].paidYm,Y*12+M); assert.equal(n.flows[0].paidDay,25);
    assert.equal(n.flows[0].llegadas[Y*12+M].expenseId,"e1");
    assert.equal(mostrado(n,"sabadell"),antes,"enlazar no mueve el saldo que se ve (el banco ya la trae)");
    assert.equal(entrada(n,26),0,"«¿Te llega?» ya no espera la nómina");
    assert.equal(pack(n,26).flowsDone.length,1);
    dia(28);
    assert.equal(mostrado(n,"sabadell"),antes,"el 28 el saldo no salta 2.000 €");
    // Sin enlazar, el recorrido aún la esperaba: eso es lo que contaba doble.
    assert.equal(entrada(s,26),2000);
  });
  caso("sin llegar y pasado su día: sigue a la vista, atrasada; el dinero, como siempre",()=>{
    const s=estado(), p=pack(s,dia(30));
    assert.equal(p.incomePending.length,1); assert.equal(p.incomePending[0].overdue,true); assert.equal(p.flowsDone.length,0);
    assert.equal(c.monthNetForAccount(s,"sabadell",Y,M,30),2000);
    assert.equal(entrada(s,30),0);
  });
  caso("traspaso propio confirmado: el traspaso se enlaza con lo que llega, y una nómina no se lo queda",()=>{
    const tras={id:"tr",kind:"transfer",name:"A Revolut",amount:200,from:"sabadell",to:"revolut",day:15};
    const ing={id:"otro",kind:"income",name:"Bizum",amount:200,to:"revolut",day:15};
    const s=estado({flows:[tras,ing],expenses:[fila("o","sabadell","2026-11-15",200,"TRASPASO",{category:"traspaso"}),fila("i","revolut","2026-11-15",-200,"TRASPASO",{category:"traspaso"})]});
    const p=pack(s,dia(16)), hecho=p.flowsDone.find(x=>x.id==="flow_tr");
    assert.ok(hecho); assert.equal(hecho.expenseId,"i"); assert.equal(hecho.paidBank,"revolut");
    assert.equal(p.incomePending.length,1,"un traspaso entre tus cuentas no es un ingreso");
    assert.equal(c.flowEnlazar(s,"otro","i",Y,M,16,1),s,"ni a mano");
    const solo=Object.assign({},s,{flows:[tras]});
    assert.equal(c.monthNetForAccount(solo,"revolut",Y,M,16),200,"el destino lo suma una vez");
    assert.equal(c.monthNetForAccount(solo,"sabadell",Y,M,16),-200,"y el origen lo resta una vez");
  });
  caso("dos nóminas iguales: ninguna se queda el abono sola; a mano, una, y la otra no puede repetirlo",()=>{
    const a={id:"a",kind:"income",name:"Nómina",amount:1000,to:"sabadell",day:28}, b=Object.assign({},a,{id:"b"});
    const s=estado({flows:[a,b],expenses:[fila("e1","sabadell","2026-11-28",-1000,"EMPRESA")]});
    assert.equal(pack(s,dia(28)).incomePending.length,2);
    const n=c.flowEnlazar(s,"a","e1",Y,M,28,1), p=pack(n,28);
    assert.equal(p.flowsDone.map(x=>x.id).join(),"flow_a"); assert.equal(p.incomePending.map(x=>x.id).join(),"flow_b");
    assert.equal(c.flowEnlazar(n,"b","e1",Y,M,28,1),n);
  });
  caso("«No es este»: vuelve a esperar, el motor no lo vuelve a elegir y elegirlo luego lo deshace",()=>{
    const s=estado({expenses:[fila("e1","sabadell","2026-11-28",-2000,"EMPRESA")]});
    dia(28);
    const no=c.flowDesenlazar(s,"nom",Y,M,28,1);
    assert.equal(pack(no,28).incomePending.length,1);
    assert.ok((no.reciboNo||[]).some(k=>k.indexOf("flow:nom|")===0));
    const si=c.flowEnlazar(no,"nom","e1",Y,M,28,2);
    assert.equal(pack(si,28).flowsDone.length,1);
    assert.ok(!(si.reciboNo||[]).some(k=>k.indexOf("flow:nom|")===0));
  });
  caso("«No es este» de un adelanto anclado quita el ancla sin mover el saldo que se ve",()=>{
    const s=estado({expenses:[fila("e1","sabadell","2026-11-25",-2000,"EMPRESA")]});
    dia(26);
    const n=c.flowEnlazar(s,"nom","e1",Y,M,26,1), antes=mostrado(n,"sabadell");
    const no=c.flowDesenlazar(n,"nom",Y,M,26,2);
    assert.equal(no.flows[0].paidYm,undefined); assert.equal(no.flows[0].llegadas,undefined);
    assert.equal(mostrado(no,"sabadell"),antes);
    assert.equal(entrada(no,26),2000,"vuelve a esperarse el día 28");
  });
  caso("«Lo recibí de otra forma»: pasa a «Ya ha entrado» y el dinero sigue igual",()=>{
    const s=estado(), n=c.flowMarcarAMano(s,"nom",Y,M,dia(20));
    const p=pack(n,20);
    assert.equal(p.flowsDone.length,1); assert.equal(p.flowsDone[0].aMano,true);
    assert.equal(mostrado(n,"sabadell"),mostrado(s,"sabadell"));
    assert.equal(entrada(n,20),2000); assert.equal(c.monthNetForAccount(n,"sabadell",Y,M,20),0);
    assert.equal(pack(c.flowMarcarAMano(n,"nom",Y,M,null),20).incomePending.length,1);
  });
  caso("otro banco o un movimiento ya de un recibo no acreditan la nómina",()=>{
    const s=estado({expenses:[fila("r","revolut","2026-11-28",-2000,"EMPRESA"),fila("x","sabadell","2026-11-28",-2000,"EMPRESA",{reciboId:"luz"})]});
    assert.equal(pack(s,dia(28)).incomePending.length,1);
  });
  return fallos;
}

const reales=suite(cargar());
assert.deepEqual(reales,[],"el motor de verdad pasa todos los casos");
console.log("ingresos-como-recibos: 10 casos OK");

// Mutantes: cada uno rompe una regla de dinero o de enlace del motor.
const MUTANTES=[
  ["una nómina acepta un traspaso propio",'&&x.category!=="traspaso";',';'],
  ["sin mirar si otra entrada lo reclama",'flowFilaCasa(s,o,x,y,m);\n  })?null:x;','flowFilaCasa(s,o,x,y,m);\n  })?x:x;'],
  ["enlazar un adelanto no ancla",'Object.assign(n,{paidYm:ym,paidDay:d,','Object.assign({},{paidYm:ym,paidDay:d,'],
  ["enlazar ancla también lo que llega tarde",'bank===entra&&planned!=null&&d<planned','bank===entra&&planned!=null'],
  ["el veto no aparta el movimiento",'||flowFilaVetada(s,f,x)) return false;',') return false;'],
  ["Plan vuelve a dar por llegada la entrada por calendario",'paid:st.llego,','paid:flowPaidIn(s,f,y,m,today),'],
  ["un movimiento sirve para dos entradas",'!usadas.has(x.id)&&',''],
  ["enlazar mueve el saldo que se ve",'  return keepShownAcrossFlows(base,(base.flows||[]).map(function(o){ return o===f?n:o; }));\n}\n/* «No es este»','  return Object.assign({},base,{flows:(base.flows||[]).map(function(o){ return o===f?n:o; })});\n}\n/* «No es este»'],
];
let muertos=0;
for(const [nombre,de,a] of MUTANTES){
  const c=cargar(s=>{ assert.ok(s.includes(de),"el mutante «"+nombre+"» encuentra su fragmento"); return s.replace(de,a); });
  assert.ok(suite(c).length>0,"mutante vivo: "+nombre);
  muertos++;
}
console.log("ingresos-como-recibos: "+muertos+" mutantes detectados");
