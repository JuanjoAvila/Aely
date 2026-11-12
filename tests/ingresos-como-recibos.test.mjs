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
  // La vista sigue al dinero (revisión del 12/11/2026): pasado su día el saldo ya la cuenta, así que
  // está en «Ya ha entrado», «sin movimiento», y no en «aún entrará».
  caso("sin movimiento y pasado su día: «Ya ha entrado» sin movimiento, porque el saldo ya la cuenta",()=>{
    const s=estado(), p=pack(s,dia(30));
    assert.equal(p.incomePending.length,0); assert.equal(p.flowsDone.length,1);
    assert.equal(p.flowsDone[0].sinMov,true); assert.equal(p.flowsDone[0].expenseId,null);
    assert.equal(c.monthNetForAccount(s,"sabadell",Y,M,30),2000);
    assert.equal(entrada(s,30),0);
    assert.equal(c.flowDesenlazar(s,"nom",Y,M,30,1),s,"«No es este» no tiene nada que apartar");
  });
  caso("traspaso propio confirmado: el traspaso se enlaza con lo que llega, y una nómina no se lo queda",()=>{
    const tras={id:"tr",kind:"transfer",name:"A Revolut",amount:200,from:"sabadell",to:"revolut",day:15};
    const ing={id:"otro",kind:"income",name:"Bizum",amount:200,to:"revolut",day:15};
    const s=estado({flows:[tras,ing],expenses:[fila("o","sabadell","2026-11-15",200,"TRASPASO",{category:"traspaso"}),fila("i","revolut","2026-11-15",-200,"TRASPASO",{category:"traspaso"})]});
    const p=pack(s,dia(16)), hecho=p.flowsDone.find(x=>x.id==="flow_tr");
    assert.ok(hecho); assert.equal(hecho.expenseId,"i"); assert.equal(hecho.paidBank,"revolut");
    const otro=p.flowsDone.find(x=>x.id==="flow_otro");
    assert.ok(otro&&otro.sinMov&&otro.expenseId==null,"un traspaso entre tus cuentas no es un ingreso");
    assert.equal(c.flowEnlazar(s,"otro","i",Y,M,16,1),s,"ni a mano");
    const solo=Object.assign({},s,{flows:[tras]});
    assert.equal(c.monthNetForAccount(solo,"revolut",Y,M,16),200,"el destino lo suma una vez");
    assert.equal(c.monthNetForAccount(solo,"sabadell",Y,M,16),-200,"y el origen lo resta una vez");
  });
  caso("dos nóminas iguales: ninguna se queda el abono sola; a mano, una, y la otra no puede repetirlo",()=>{
    const a={id:"a",kind:"income",name:"Nómina",amount:1000,to:"sabadell",day:28}, b=Object.assign({},a,{id:"b"});
    const s=estado({flows:[a,b],expenses:[fila("e1","sabadell","2026-11-27",-1000,"EMPRESA")]});
    assert.equal(pack(s,dia(27)).incomePending.length,2);
    assert.ok(pack(s,27).incomePending.every(x=>x.expenseId==null),"ninguna se apunta el abono");
    const n=c.flowEnlazar(s,"a","e1",Y,M,27,1), p=pack(n,27);
    assert.equal(p.flowsDone.map(x=>x.id).join(),"flow_a"); assert.equal(p.incomePending.map(x=>x.id).join(),"flow_b");
    assert.equal(c.flowEnlazar(n,"b","e1",Y,M,27,1),n);
  });
  caso("«No es este»: vuelve a esperar, el motor no lo vuelve a elegir y elegirlo luego lo deshace",()=>{
    const s=estado({expenses:[fila("e1","sabadell","2026-11-25",-2000,"EMPRESA")]});
    dia(26);
    const no=c.flowDesenlazar(s,"nom",Y,M,26,1), vetos=(no.reciboNo||[]).filter(k=>k.indexOf("flow:nom|")===0);
    assert.equal(pack(no,26).incomePending.length,1);
    assert.equal(pack(no,26).incomePending[0].expenseId,null,"y no lo vuelve a coger solo");
    assert.ok(vetos.length>0); assert.equal(new Set(vetos).size,vetos.length,"sin claves repetidas");
    const si=c.flowEnlazar(no,"nom","e1",Y,M,26,2);
    assert.equal(pack(si,26).flowsDone.length,1);
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
  // La vista sigue al dinero también aquí: marcada antes de su día, el saldo aún la espera, así que
  // sigue en «Lo que aún entrará» con la marca a la vista; pasa a «Ya ha entrado» cuando el saldo la cuenta.
  caso("«Lo recibí de otra forma» antes de su día: marcada pero aún por entrar, y el dinero igual",()=>{
    const s=estado(), n=c.flowMarcarAMano(s,"nom",Y,M,dia(20));
    const p=pack(n,20);
    assert.equal(p.flowsDone.length,0); assert.equal(p.incomePending.length,1); assert.equal(p.incomePending[0].aMano,true);
    assert.equal(mostrado(n,"sabadell"),mostrado(s,"sabadell"));
    assert.equal(entrada(n,20),2000); assert.equal(c.monthNetForAccount(n,"sabadell",Y,M,20),0);
    const d28=pack(n,dia(28));
    assert.equal(d28.flowsDone.length,1); assert.equal(d28.flowsDone[0].aMano,true);
    assert.equal(pack(c.flowMarcarAMano(n,"nom",Y,M,null),28).flowsDone[0].sinMov,true);
  });
  caso("otro banco o un movimiento ya de un recibo no acreditan la nómina",()=>{
    const s=estado({expenses:[fila("r","revolut","2026-11-27",-2000,"EMPRESA"),fila("x","sabadell","2026-11-27",-2000,"EMPRESA",{reciboId:"luz"})]});
    assert.equal(pack(s,dia(27)).incomePending.length,1);
  });
  caso("Deshacer tras enlazar repone lo de antes y NO veta: el extracto vuelve a anclar solo",()=>{
    const tx={id:"t1",ent:"sabadell",date:"2026-11-25",amount:-2000,merchant:"EMPRESA",status:"BOOK"};
    const s=estado({expenses:[fila("e1","sabadell","2026-11-25",-2000,"EMPRESA")]});
    dia(26);
    const foto=c.flowFoto(s,"nom",Y,M), n=c.flowEnlazar(s,"nom","e1",Y,M,26,1), antes=mostrado(n,"sabadell"), tras=c.flowFoto(n,"nom",Y,M);
    const d=c.flowDeshacer(n,"nom",Y,M,foto,tras,2);
    assert.equal(d.flows[0].llegadas,undefined); assert.equal(d.flows[0].paidYm,undefined);
    assert.ok(!(d.reciboNo||[]).some(k=>k.indexOf("flow:nom|")===0),"deshacer no es «No es este»");
    assert.equal(mostrado(d,"sabadell"),antes);
    const r=c.reconcileEarlyIncomeAnchors(Object.assign({},d,{bankTx:[tx]}),Y,M,26);
    assert.equal(r.flows[0].paidDay,25,"con el extracto delante se ancla igual que si no se hubiera tocado");
    // Y si antes había un veto (rechazó y eligió otro), deshacer lo devuelve tal cual.
    const no=c.flowDesenlazar(s,"nom",Y,M,26,3), f2=c.flowFoto(no,"nom",Y,M);
    const en=c.flowEnlazar(no,"nom","e1",Y,M,26,4);
    const otra=c.flowDeshacer(en,"nom",Y,M,f2,c.flowFoto(en,"nom",Y,M),5);
    assert.equal(JSON.stringify((otra.reciboNo||[]).slice().sort()),JSON.stringify((no.reciboNo||[]).slice().sort()));
  });
  caso("Deshacer no pisa el ancla que trajo una sincronización ni los vetos de otros meses",()=>{
    const s=estado({expenses:[fila("e1","sabadell","2026-11-25",-2000,"EMPRESA")]});
    dia(26);
    const foto=c.flowFoto(s,"nom",Y,M), n=c.flowEnlazar(s,"nom","e1",Y,M,26,1), tras=c.flowFoto(n,"nom",Y,M);
    // Entretanto, otro móvil ancla otro día y aparta un movimiento de octubre.
    const oct='flow:nom|'+JSON.stringify(["sabadell","2026-10-25",-2000,"EMPRESA"]);
    const sync=Object.assign({},n,{flows:[Object.assign({},n.flows[0],{paidDay:24})]},c.reciboNoPon(n,[oct],true,5));
    const d=c.flowDeshacer(sync,"nom",Y,M,foto,tras,6);
    assert.equal(d.flows[0].paidDay,24,"el ancla de la sincronización se queda");
    assert.ok(d.reciboNo.indexOf(oct)>=0,"el veto de octubre se queda");
    assert.equal(d.flows[0].llegadas,undefined,"y el enlace de noviembre sí se deshace");
  });
  caso("un movimiento de otra cifra o de hace más de 7 días se enlaza pero NO ancla el saldo",()=>{
    dia(21);
    const corto=estado({expenses:[fila("a1","sabadell","2026-11-20",-150,"ADELANTO NOMINA")]});
    const n=c.flowEnlazar(corto,"nom","a1",Y,M,21,1);
    assert.equal(n.flows[0].llegadas[Y*12+M].expenseId,"a1"); assert.equal(n.flows[0].paidYm,undefined);
    // Mientras el saldo la espera, sigue en «aún entrará» con lo que llegó a la vista (re-revisión 12/11).
    const p=pack(n,21);
    assert.equal(p.flowsDone.length,0); assert.equal(p.incomePending[0].expenseId,"a1"); assert.equal(p.incomePending[0].paidAmount,150);
    assert.equal(pack(n,dia(28)).flowsDone[0].expenseId,"a1","el día que el saldo la cuenta, entra con su movimiento");
    dia(21);
    assert.equal(n.accounts[0].value,1000,"la cuenta no se toca"); assert.equal(entrada(n,21),2000,"el 28 se siguen esperando los 2.000");
    const dos=estado({expenses:[fila("b1","sabadell","2026-11-25",-1500,"EMPRESA"),fila("b2","sabadell","2026-11-25",-500,"EMPRESA")]});
    dia(26);
    assert.equal(c.flowEnlazar(dos,"nom","b1",Y,M,26,1).flows[0].paidYm,undefined,"media nómina no ancla la entera");
    const pronto=estado({expenses:[fila("p1","sabadell","2026-11-15",-2000,"EMPRESA")]});
    dia(16);
    assert.equal(c.flowEnlazar(pronto,"nom","p1",Y,M,16,1).flows[0].paidYm,undefined,"13 días antes no es el adelanto del extracto");
  });
  // Marta debe 6 y la entrada es de 5: NO son el mismo hecho (ver `flowGemelaDe`, 230). Con el mismo
  // importe serían gemelas y el movimiento las deja hechas a las dos (tests/traspasos-tedeben-230).
  caso("un movimiento no paga a la vez «Te deben» y una entrada",()=>{
    const yt={id:"yt",name:"YouTube",amount:10,bankAmount:16,freq:"mes",day:5,account:"sabadell",reparto:[{id:"p1",n:"Marta",via:"bizum",amt:6}]};
    const biz={id:"biz",kind:"income",name:"Bizum Marta",amount:5,to:"sabadell",day:20};
    const s=estado({fixed:[yt],flows:[biz],expenses:[fila("i1","sabadell","2026-11-18",-5,"TRANSFERENCIA MARTA LOPEZ")]});
    dia(19);
    const deb=c.teDebenMes(s,Y,M,19);
    assert.equal(deb[0].recibido,5,"es (parte de) lo de Marta");
    assert.equal(pack(s,19).incomePending.length,1);
    assert.equal(pack(s,19).incomePending[0].expenseId,null,"el motor no se la da también a la entrada");
    const n=c.flowEnlazar(s,"biz","i1",Y,M,19,1);
    assert.equal(pack(n,19).flowsDone[0].expenseId,"i1","a mano manda él");
    assert.equal(c.teDebenMes(n,Y,M,19)[0].recibido,0,"y entonces no paga a Marta");
  });
  return fallos;
}

const reales=suite(cargar());
assert.deepEqual(reales,[],"el motor de verdad pasa todos los casos");
console.log("ingresos-como-recibos: 14 casos OK");

// Mutantes: cada uno rompe una regla de dinero o de enlace del motor.
const MUTANTES=[
  ["una nómina acepta un traspaso propio",'&&x.category!=="traspaso";',';'],
  ["sin mirar si otra entrada lo reclama",'flowFilaCasa(s,o,x,y,m);\n  })?null:x;','flowFilaCasa(s,o,x,y,m);\n  })?x:x;'],
  ["enlazar un adelanto no ancla",'Object.assign(n,{paidYm:ym,paidDay:d,','Object.assign({},{paidYm:ym,paidDay:d,'],
  ["enlazar ancla también lo que llega tarde",'bank===entra&&planned!=null&&d<planned','bank===entra&&planned!=null'],
  ["el veto no aparta el movimiento",'||flowFilaVetada(s,f,x)) return false;',') return false;'],
  ["un enlace que no ancla da la entrada por llegada",'llego:cuenta,day:cuenta?recDay(x.date):planned','llego:true,day:recDay(x.date)'],
  ["la marca a mano da la entrada por llegada antes de que la cuente el saldo",'llego:cuenta,day:cuenta?mano:planned','llego:true,day:mano'],
  ["deshacer pisa el ancla de una sincronización",'if(!tras||ks.every(','if(true||ks.every('],
  ["deshacer toca vetos de otros meses",'k.indexOf(pre)===0&&(k.indexOf(mes)>=0||antes.some(function(a){ return k.indexOf(a)>=0; }))','k.indexOf(pre)===0'],
  ["la vista no sigue al dinero pasado su día",'  if(cuenta) return {llego:true,day:planned,sinMov:true};',''],
  ["deshacer veta como «No es este»",'function flowDeshacer(s,flowId,y,m,foto,tras,ahora){','function flowDeshacer(s,flowId,y,m,foto,tras,ahora){ return flowDesenlazar(s,flowId,y,m,31,ahora);'],
  ["deshacer no repone los vetos de antes",'  if(poner.length) base=',' if(false) base='],
  ["enlazar ancla un importe que no se parece",'\n    &&recAmtClose(Number(f.amount),Math.abs(Number(x.amount)))',''],
  ["enlazar ancla un adelanto de más de 7 días",'d<planned&&planned-d<=7','d<planned'],
  ["el motor da a una entrada el pago de una persona",'&&!flowNombraPersona(s,x,gem&&gem.id)&&','&&'],
  ["«Te deben» cuenta lo enlazado a una entrada",'||deEntrada.has(String(e.id))) return;',') return;'],
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
