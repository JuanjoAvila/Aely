// LO QUE ENCONTRÓ EN LA 230 (12/11/2026), cada punto con su caso y sus mutantes. Nombres y cifras
// inventados (titular «Leo Sastre Ruano», personas Otto/Nora): nunca los de la cartera real.
//  A. La salida de un traspaso suyo («TRANSFERENCIA A <titular>») salía como «Otros», un gasto más.
//  B. Los traspasos del día 1 hechos el 30 del mes anterior salían «sin movimiento del banco».
//  C. Una entrada «YouTube premium <persona>» y esa persona en «Te deben» son el MISMO hecho: el pago
//     tiene que dejar las dos hechas, sin contar el dinero dos veces.
//  D. «Ya ha entrado»: el total y lo que se ve en cada fila salen de la misma cifra (eso es pantalla:
//     lo vigila e2e/plan-ingresos-recibos; aquí, la cifra del motor que leen las dos).
// Cada mutante del motor (08) tiene que tumbar al menos un caso: si no, el caso no vigila nada.
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPureLogic } from "../scripts/load-pure-logic.mjs";

const source=file=>fs.readFileSync(new URL("../"+file,import.meta.url),"utf8").replaceAll("\r\n","\n");
const order=JSON.parse(source("src/build-order.json"));
const shell=source("src/shell.html");
const reloj={ms:0};
const cargar=(cambiar)=>{
  const c=loadPureLogic(shell.replace("<!--MC_APP_SCRIPT-->",()=>order.map(f=>{
    const s=source("src/modules/"+f); return f==="08-motor-bank.js"&&cambiar?cambiar(s):s; }).join("\n")));
  c.Date=class extends Date{ constructor(...a){ super(...(a.length?a:[reloj.ms])); } static now(){ return reloj.ms; } };
  return c;
};
// Mediodía: el mismo día en Madrid y en la CI (UTC).
const dia=d=>{ reloj.ms=Date.parse("2026-11-"+String(d).padStart(2,"0")+"T12:00:00Z"); return d; };
const Y=2026, M=11, copia=x=>JSON.parse(JSON.stringify(x));
const A_TR={id:"atr",kind:"transfer",name:"A Trade Republic",amount:1200,from:"sabadell",to:"trade_republic",day:1};
const A_MI={id:"ami",kind:"transfer",name:"A MyInvestor",amount:400,from:"sabadell",to:"myinvestor",day:1};
const fila=(id,ent,date,amount,merchant,extra)=>Object.assign({id,ent,date,amount,merchant,source:"ob",status:"BOOK",category:amount<0?"ingreso":"otros"},extra||{});
const estado=(cambios)=>copia(Object.assign({
  accounts:[{id:"sab",ent:"sabadell",role:"fijos",value:1000},{id:"tr",ent:"trade_republic",role:"gasto",value:300}],
  fixed:[],debts:[],oneoffs:[],flows:[],expenses:[],bankTx:[],deleted:[],investments:[],assets:[],aportaciones:[],obAccounts:[],
  settings:{profile:{fullName:"Leo Sastre Ruano"}},trasAbonoDesde:20261101
},cambios||{}));
// El 30/10: salen de Sabadell 1.200 y 400 a su nombre, y llegan 1.200 a Trade Republic (ya traspaso).
const SALE_TR=fila("s1","sabadell","2026-10-30",1200,"Leo Sastre Ruano",{concept:"TRANSFERENCIA A LEO SASTRE RUANO"});
const SALE_MI=fila("s2","sabadell","2026-10-30",400,"Leo Sastre Ruano",{concept:"TRANSFERENCIA A LEO SASTRE RUANO"});
const LLEGA_TR=fila("l1","trade_republic","2026-10-30",-1200,"Traspaso recibido",{category:"traspaso"});
// Otto debe 5 € de un recibo compartido; la entrada «YouTube premium Otto» es la misma parte.
const YT={id:"yt",name:"YouTube",amount:10,bankAmount:15,freq:"mes",day:2,account:"sabadell",reparto:[{id:"pe_otto",n:"Otto",via:"transfer",amt:5}]};
const ENT_OTTO={id:"eal",kind:"income",name:"YouTube premium Otto",amount:5,to:"sabadell",day:11};

function suite(c){
  const fallos=[];
  const caso=(nombre,fn)=>{ try{ fn(); }catch(e){ fallos.push(nombre+": "+e.message); } };
  const pack=(s,d,m)=>c.planChargesMonth(s,m||M,Y,d);
  const hecho=(p,id)=>p.flowsDone.find(x=>x.id==="flow_"+id);
  const mostrado=(s,ent)=>{ const a=s.accounts.find(x=>x.ent===ent), i=c.insumosSaldoGasto(s);
    return Math.round(c.saldoCuentaMostrada(a,{injTR:i.injTR,spentByBank:i.spentByBank,paidNetByBank:i.paidNetByBank,roundup:i.roundup,monthlyInvest:i.monthlyInvest})*100)/100; };
  const otto=(s,d)=>c.teDebenMes(s,Y,M,d).find(x=>x.id==="pe_otto");

  /* ---------- B. El adelanto que cruza de mes ---------- */
  caso("B1 · los traspasos del día 1 hechos el 30 del mes anterior se enlazan solos, con SU fecha",()=>{
    const s=estado({flows:[A_TR,A_MI],expenses:[SALE_TR,SALE_MI,LLEGA_TR]}), p=pack(s,dia(12));
    const tr=hecho(p,"atr"), mi=hecho(p,"ami");
    assert.equal(tr.expenseId,"l1","en un traspaso manda la pata que llega"); assert.equal(tr.sinMov,false);
    assert.equal(tr.day,30); assert.equal(tr.dayMes,10,"se pinta «30 oct», no «30 nov»");
    assert.equal(mi.expenseId,"s2","a MyInvestor no llega fila: vale la que sale de Sabadell");
  });
  caso("B2 · octubre no reclama el movimiento del 30: está a 2 días del 1 de noviembre y a 29 del suyo",()=>{
    const s=estado({flows:[A_TR],expenses:[LLEGA_TR]});
    const oct=c.flowEstadoMes(s,A_TR,Y,10,31);
    assert.equal(oct.expense,undefined); assert.equal(oct.sinMov,true);
    assert.equal(c.flowEstadoMes(s,A_TR,Y,M,dia(12)).expense.id,"l1");
  });
  caso("B3 · fuera de los 7 días de adelanto no vale, ni para elegir a mano",()=>{
    const lejos=fila("l9","trade_republic","2026-10-20",-1200,"Traspaso recibido",{category:"traspaso"});
    const s=estado({flows:[A_TR],expenses:[lejos]});
    assert.equal(c.flowEstadoMes(s,A_TR,Y,M,dia(12)).sinMov,true);
    assert.equal(c.flowFilasElegibles(s,A_TR,Y,M,12).length,0);
  });
  caso("B4 · si él ya lo enlazó a la entrada de octubre, noviembre no lo ofrece",()=>{
    const s=estado({flows:[A_TR],expenses:[LLEGA_TR]});
    const n=c.flowEnlazar(s,"atr","l1",Y,10,31,1);
    assert.equal(n.flows[0].llegadas[Y*12+10].expenseId,"l1");
    assert.equal(c.flowFilasElegibles(n,n.flows[0],Y,M,dia(12)).length,0);
    assert.equal(c.flowEstadoMes(n,n.flows[0],Y,M,12).sinMov,true);
  });
  caso("B5 · el adelanto de una nómina del día 1 se ve, pero no ancla: el saldo y «¿Te llega?» no cambian",()=>{
    const NOM={id:"nom",kind:"income",name:"Nómina",amount:2000,to:"sabadell",day:1};
    const sin=estado({flows:[NOM]}), con=estado({flows:[NOM],expenses:[fila("n1","sabadell","2026-10-30",-2000,"EMPRESA EJEMPLO SL")],
      bankTx:[{ent:"sabadell",date:"2026-10-30",amount:-2000,merchant:"EMPRESA EJEMPLO S.L.",status:"BOOK"}]});
    dia(12);
    assert.equal(c.flowEstadoMes(con,con.flows[0],Y,M,12).expense.id,"n1");
    const n=c.flowEnlazar(con,"nom","n1",Y,M,12,1);
    assert.equal(n.flows[0].llegadas[Y*12+M].expenseId,"n1"); assert.equal(n.flows[0].paidYm,undefined,"el día 30 no es un día de noviembre");
    assert.equal(c.monthNetForAccount(n,"sabadell",Y,M,12),c.monthNetForAccount(sin,"sabadell",Y,M,12));
    assert.equal(mostrado(n,"sabadell"),mostrado(sin,"sabadell"));
    // «No es este» lo aparta también del extracto del mes del movimiento, no del de la entrada.
    const no=c.flowDesenlazar(n,"nom",Y,M,12,2);
    assert.equal(no.flows[0].llegadas,undefined); assert.ok(Array.from(no.reciboNo||[]).some(k=>k.indexOf("EMPRESA EJEMPLO S.L.")>=0),"y su línea del extracto");
  });

  /* ---------- C. Entrada y «Te deben»: el mismo hecho ---------- */
  caso("C1 · su transferencia deja hechas las dos: «Te deben» pagado y la entrada con ESE movimiento",()=>{
    const s=estado({fixed:[YT],flows:[ENT_OTTO],expenses:[fila("a1","sabadell","2026-11-11",-5,"TRANSFERENCIA OTTO DEL PINO")]});
    dia(12);
    assert.equal(otto(s,12).pagado,true); assert.deepEqual([...otto(s,12).ingresos],["a1"]);
    assert.equal(hecho(pack(s,12),"eal").expenseId,"a1");
  });
  // Con tu nombre también en el concepto, lo que la gemela coge SOLA no paga a «Te deben» (puede ser dinero
  // tuyo: el filtro del titular, re-revisión de la 231); si él lo enlaza a mano, sí (lo dijo él).
  caso("C2 · con tu nombre en el concepto, solo paga a «Te deben» si él lo enlaza",()=>{
    const s=estado({fixed:[YT],flows:[ENT_OTTO],expenses:[fila("a1","sabadell","2026-11-11",-5,"TRANSFERENCIA OTTO DEL PINO",{concept:"A FAVOR DE LEO SASTRE RUANO"})]});
    dia(12);
    assert.equal(hecho(pack(s,12),"eal").expenseId,"a1");
    assert.equal(otto(s,12).pagado,false,"sola, no");
    const n=c.flowEnlazar(s,"eal","a1",Y,M,12,1);
    assert.equal(otto(n,12).pagado,true,"enlazado a mano, sí");
  });
  caso("C2b · y si el banco lo llama «abono» (en Sabadell, cualquier transferencia recibida), igual",()=>{
    const s=estado({fixed:[YT],flows:[ENT_OTTO],expenses:[fila("a1","sabadell","2026-11-11",-5,"TRANSFERENCIA OTTO DEL PINO",{note:"ABONO TRANSFERENCIA"})]});
    dia(12);
    assert.equal(hecho(pack(s,12),"eal").expenseId,"a1");
    assert.equal(otto(s,12).pagado,true);
  });
  // Desde la 231 «abono» ya no aparta el pago de «Te deben», así que C2b lo coge «Te deben»: lo que
  // vigila que la gemela pueda quedarse un ingreso que nombra a SU persona es un pago que «Te deben»
  // tiene vetado (él deshizo su casado): la entrada sigue con él (decisión abierta de la 230).
  caso("C2c · la gemela coge el ingreso que nombra a su persona aunque «Te deben» lo tenga vetado",()=>{
    const yt=Object.assign({},YT,{repartoCobrado:{[Y*12+M]:["!pe_otto:a1"]}});
    const s=estado({fixed:[yt],flows:[ENT_OTTO],expenses:[fila("a1","sabadell","2026-11-11",-5,"TRANSFERENCIA OTTO DEL PINO")]});
    dia(12);
    assert.equal(otto(s,12).pagado,false);
    assert.equal(hecho(pack(s,12),"eal").expenseId,"a1");
  });
  caso("C3 · un pago a medias: «Te deben» dice lo que falta y la entrada enseña ese movimiento y su cifra",()=>{
    const s=estado({fixed:[YT],flows:[ENT_OTTO],expenses:[fila("a1","sabadell","2026-11-10",-3.8,"TRANSFERENCIA OTTO DEL PINO")]});
    dia(12);
    const a=otto(s,12); assert.equal(a.recibido,3.8); assert.equal(a.falta,1.2);
    const e=hecho(pack(s,12),"eal"); assert.equal(e.expenseId,"a1"); assert.equal(e.paidAmount,3.8);
  });
  caso("C4 · enlazado a mano a la gemela, también paga a la persona",()=>{
    const s=estado({fixed:[YT],flows:[ENT_OTTO],expenses:[fila("a1","sabadell","2026-11-11",-5,"BIZUM RECIBIDO")]});
    dia(12);
    assert.equal(otto(s,12).pagado,false,"sin su nombre, «Te deben» no lo sabe");
    const n=c.flowEnlazar(s,"eal","a1",Y,M,12,1);
    assert.equal(hecho(pack(n,12),"eal").expenseId,"a1"); assert.equal(otto(n,12).pagado,true);
  });
  caso("C5 · lo que la gemela coge sola SIN nombrar a la persona no paga a la persona",()=>{
    const s=estado({fixed:[YT],flows:[ENT_OTTO],expenses:[fila("a1","sabadell","2026-11-11",-5,"BIZUM DE OTRA GENTE")]});
    dia(12);
    assert.equal(hecho(pack(s,12),"eal").expenseId,"a1","5 € al céntimo: la entrada lo coge");
    assert.equal(otto(s,12).pagado,false,"pero no se sabe que sea de Otto");
  });
  caso("C6 · con otro importe no son el mismo hecho",()=>{
    const s=estado({fixed:[YT],flows:[Object.assign({},ENT_OTTO,{amount:7})]});
    assert.equal(c.flowGemelaDe(s,s.flows[0],Y,M,dia(12)),null);
    assert.equal(c.flowGemelaDe(estado({fixed:[YT],flows:[ENT_OTTO]}),ENT_OTTO,Y,M,12).id,"pe_otto");
  });
  caso("C7 · dinero: que «Te deben» quede pagado no mueve el saldo; la entrada suma una vez, por su día",()=>{
    const sin=estado({fixed:[YT],flows:[ENT_OTTO]}), con=estado({fixed:[YT],flows:[ENT_OTTO],expenses:[fila("a1","sabadell","2026-11-11",-5,"TRANSFERENCIA OTTO DEL PINO")]});
    dia(12);
    assert.equal(c.monthNetForAccount(con,"sabadell",Y,M,12),c.monthNetForAccount(sin,"sabadell",Y,M,12));
    assert.equal(mostrado(con,"sabadell"),mostrado(sin,"sabadell"));
    const n=c.flowEnlazar(con,"eal","a1",Y,M,12,1);
    assert.equal(mostrado(n,"sabadell"),mostrado(sin,"sabadell"),"enlazar tampoco");
  });

  /* ---------- C (re-revisión). Un pago, un mes; dos gemelas, un pago ---------- */
  caso("C8 · el adelanto del 30 de la persona gemela cuenta en «Te deben» de octubre, no también en noviembre",()=>{
    const YT2=Object.assign({},ENT_OTTO,{day:2});
    const s=estado({fixed:[YT],flows:[YT2],expenses:[fila("a1","sabadell","2026-10-30",-5,"TRANSFERENCIA OTTO DEL PINO")]});
    dia(12);
    assert.equal(c.teDebenMes(s,Y,10,31).find(x=>x.id==="pe_otto").pagado,true,"es el pago de octubre");
    assert.equal(otto(s,12).pagado,false,"noviembre no lo vuelve a contar");
    assert.equal(hecho(pack(s,12),"eal").expenseId,null,"y la gemela de noviembre no se lo queda");
    // Ni enlazado a mano.
    const n=c.flowEnlazar(s,"eal","a1",Y,M,12,1);
    assert.equal(hecho(pack(n,12),"eal").expenseId,"a1","a mano manda él en la entrada");
    assert.equal(otto(n,12).pagado,false,"pero «Te deben» no lo cuenta en dos meses");
  });
  caso("C9 · dos gemelas de la misma persona no comparten un pago",()=>{
    const MUS={id:"mus",name:"Música",amount:10,bankAmount:15,freq:"mes",day:2,account:"sabadell",reparto:[{id:"pe_otto",n:"Otto",via:"transfer",amt:5}]};
    const ENT_MUS={id:"emu",kind:"income",name:"Música Otto",amount:5,to:"sabadell",day:11};
    const s=estado({fixed:[YT,MUS],flows:[ENT_OTTO,ENT_MUS],expenses:[fila("a1","sabadell","2026-11-11",-5,"TRANSFERENCIA OTTO DEL PINO")]});
    dia(12);
    const p=pack(s,12), ids=[hecho(p,"eal").expenseId,hecho(p,"emu").expenseId];
    assert.deepEqual(ids.filter(x=>x==="a1").length,1,"un movimiento de 5 €, una entrada");
  });

  /* ---------- A. La salida de un traspaso tuyo ---------- */
  const salen=s=>Array.from(c.salidasTraspasoPropio(s),x=>x.id).sort();
  caso("A1 · las dos salidas del 30/10 a su nombre pasan a traspaso (traspaso previsto, y pareja con su traspaso)",()=>{
    dia(12);
    const s=estado({flows:[A_TR,A_MI],expenses:[SALE_TR,SALE_MI,LLEGA_TR]});
    assert.deepEqual(salen(s),["s1","s2"]);
    const r=c.reconcileObDupes(s);
    assert.deepEqual(Array.from(r.recat,x=>x.expense.id+":"+x.cat).sort(),["s1:traspaso","s2:traspaso"]);
    assert.equal(c.expenseBucket(r.state.expenses.find(e=>e.id==="s1"),r.state),"neutra","«Traspasos · no cuentan»");
    // Sin su nombre basta la pareja si hay un traspaso previsto entre ESOS dos bancos.
    const emitida=fila("s1","sabadell","2026-10-30",1200,"Transferencia emitida");
    assert.deepEqual(salen(estado({flows:[A_TR],expenses:[emitida,LLEGA_TR]})),["s1"]);
  });
  caso("A2 · dinero: si sale de un banco de gasto diario, deja de contar en el gastado",()=>{
    dia(12);
    const s=estado({flows:[A_MI],expenses:[SALE_MI],settings:{profile:{fullName:"Leo Sastre Ruano"},expenseBanks:["sabadell"]}});
    assert.equal(c.expenseCountsBudget(s.expenses[0],s),true);
    const r=c.reconcileObDupes(s);
    assert.equal(c.expenseCountsBudget(r.state.expenses[0],r.state),false);
    assert.equal(c.expenseCountsCash(r.state.expenses[0],r.state),true,"el saldo la sigue restando: el dinero salió de esa cuenta");
  });
  caso("A3 · sin falsos positivos: al casero, sin traspaso previsto, lejos de su día, o dos parejas",()=>{
    dia(12);
    const casero=fila("k1","sabadell","2026-10-30",400,"Casero Ejemplo SL",{concept:"TRANSFERENCIA A CASERO EJEMPLO SL"});
    assert.deepEqual(salen(estado({flows:[A_MI],expenses:[casero]})),[],"mismo importe y día, pero no va a su nombre");
    assert.deepEqual(salen(estado({expenses:[SALE_MI]})),[],"a su nombre pero sin traspaso previsto ni llegada");
    assert.deepEqual(salen(estado({flows:[Object.assign({},A_MI,{day:20})],expenses:[Object.assign({},SALE_MI,{date:"2026-11-03"})]})),[],"a 17 días de su día");
    const otra=fila("s3","bbva","2026-10-30",1200,"Transferencia emitida");
    assert.deepEqual(salen(estado({flows:[A_TR],expenses:[fila("s1","sabadell","2026-10-30",1200,"Transferencia emitida"),otra,LLEGA_TR]})),[],"dos salidas para una llegada: no se sabe cuál");
  });
  caso("A5 · el nombre ENTERO: ni un hermano con los dos apellidos ni un tocayo",()=>{
    dia(12);
    const perfil={profile:{fullName:"Leo Marc Sastre Ruano"}};
    const a=(id,quien)=>fila(id,"sabadell","2026-10-30",400,quien,{concept:"TRANSFERENCIA A "+quien.toUpperCase()});
    assert.deepEqual(salen(estado({settings:perfil,flows:[A_MI],expenses:[a("h1","Pedro Sastre Ruano")]})),[],"hermano");
    assert.deepEqual(salen(estado({settings:perfil,flows:[A_MI],expenses:[a("t1","Leo Marc Garcia")]})),[],"tocayo");
    assert.deepEqual(salen(estado({settings:perfil,flows:[A_MI],expenses:[a("y1","Leo Sastre Ruano")]})),["y1"],"nombre de pila y los dos apellidos");
  });
  caso("A6 · la pata de llegada sola no basta: el alquiler al casero con 700 € entrando en otro banco",()=>{
    dia(12);
    const alquiler=fila("q1","sabadell","2026-11-05",700,"Transferencia alquiler",{concept:"TRANSFERENCIA ALQUILER"});
    const llega=fila("q2","trade_republic","2026-11-06",-700,"Traspaso recibido",{category:"traspaso"});
    assert.deepEqual(salen(estado({expenses:[alquiler,llega]})),[]);
    assert.deepEqual(salen(estado({flows:[A_TR],expenses:[alquiler,llega]})),[],"el traspaso previsto entre esos bancos es de otro importe");
  });
  caso("A4 · lo que él decidió manda: «Otros» elegido, «no es un traspaso mío», otra categoría, o un mes cerrado",()=>{
    dia(12);
    const base={flows:[A_MI]};
    assert.deepEqual(salen(estado(Object.assign({},base,{expenses:[SALE_MI],catOverrides:{"leo sastre ruano":"otros"}}))),[]);
    assert.deepEqual(salen(estado(Object.assign({},base,{expenses:[Object.assign({},SALE_MI,{ownTransferRejected:true})]}))),[]);
    assert.deepEqual(salen(estado(Object.assign({},base,{expenses:[Object.assign({},SALE_MI,{category:"hogar"})]}))),[]);
    // Sacarla él de traspaso (sin comercio no se aprende regla) se guarda y viaja.
    const s=estado(Object.assign({},base,{expenses:[SALE_MI]}));
    assert.deepEqual(salen(Object.assign({},s,c.traspasoPropioNoPon(s,SALE_MI,1))),[],"la devolvió a «Otros»");
    // Octubre ya cerrado: solo su adelanto (los últimos 7 días) cuenta para noviembre.
    assert.deepEqual(salen(estado({flows:[Object.assign({},A_MI,{day:20})],expenses:[Object.assign({},SALE_MI,{date:"2026-10-20"})]})),[],"el 20 de octubre ya no se toca");
    reloj.ms=Date.parse("2027-01-15T12:00:00Z");
    assert.deepEqual(salen(estado(Object.assign({},base,{expenses:[SALE_MI]}))),[],"en enero, octubre ya no se toca");
    dia(12);
  });
  caso("A7 · si la nube no la acepta, no se reescribe en cada vuelta a primer plano",()=>{
    dia(12);
    const r=fila("i9","sabadell","2026-10-31",400,"Leo Sastre Ruano",{concept:"TRANSFERENCIA A LEO SASTRE RUANO"});
    const s=estado({flows:[A_MI],expenses:[r]});
    assert.deepEqual(salen(s),["i9"]);
    c.marcarIntentoTraspaso(r);
    assert.deepEqual(salen(s),[],"intentada hace nada");
    reloj.ms+=7*36e5;
    assert.deepEqual(salen(s),["i9"],"horas después, otro intento");
    dia(12);
  });
  return fallos;
}

const reales=suite(cargar());
assert.deepEqual(reales,[],"el motor de verdad pasa todos los casos");
console.log("traspasos-tedeben-230: casos OK");

const MUTANTES=[
  ["B · sin el adelanto del mes anterior",'if(planned!=null&&planned-FLOW_ADELANTO<1) flowFilasDelMes','if(false) flowFilasDelMes'],
  ["B · el mes vecino reclama el mismo movimiento",'&&flowEsSuMes(f,x,y,m)&&','&&'],
  ["B · el adelanto sin ventana",'if(rel!=null&&rel>=planned-FLOW_ADELANTO&&!usadas','if(rel!=null&&!usadas'],
  ["B · lo enlazado en el mes de al lado se ofrece otra vez",'    [antes,despues].forEach(function(v){ const l=flowLlegadaFila(o,v[0],v[1]); if(l) usadas.add(l.expenseId); });\n',''],
  ["B · «No es este» veta en el extracto del mes de la entrada",'!==(fecha?fecha.slice(0,7):flowYm(y,m))) return;','!==flowYm(y,m)) return;'],
  ["C · la gemela no puede coger el pago de su persona",'p.id!==salvo&&',''],
  ["C · lo enlazado a la gemela no paga a la persona",'if(x){ if(delMes(x)) forz[String(x.id)]={pid:p.id,mano:true,row:x}; return; }','if(x){ return; }'],
  ["C · lo que la gemela coge sola paga aunque no la nombre",'debenNombra(s,p,a,personas)&&delMes(a)','delMes(a)'],
  ["C · lo que la gemela coge sola paga aunque lleve tu nombre",'if(a&&!suyo&&','if(a&&'],
  ["C · la entrada no enseña el pago que casó «Te deben»",'  if(pago) return fila(pago,true);\n',''],
  ["C · gemela con cualquier importe",'(quien[0].c===c||quien[0].partes.indexOf(c)>=0)','true'],
  ["C · lo enlazado de otro mes paga también este",'if(x){ if(delMes(x)) forz','if(x){ if(true) forz'],
  ["C · la gemela se queda el adelanto del mes anterior",'&&(!gem||String(x.date).slice(0,7)===ym)',''],
  ["C · dos gemelas comparten un pago",'&&!usados.has(String(x.id))&&','&&'],
  ["A · pareja sin mirar que sea la única",'return salidas.length===1&&salidas[0]===e&&','return salidas.length>=1&&'],
  ["A · basta un traspaso previsto, aunque no vaya a su nombre",'if(tuyo&&previsto(e,null)) return true;','if(previsto(e,null)) return true;'],
  ["A · la pata de llegada sola basta",'&&(tuyo||previsto(e,expenseBankOf(l)))',''],
  ["A · dos palabras del titular bastan",'w.every(esta)||w.length>=3&&esta(w[0])&&esta(w[w.length-2])&&esta(w[w.length-1])','w.filter(esta).length>=2'],
  ["A · traspaso previsto de cualquier día",'Math.abs(r-pl)<=FLOW_ADELANTO;','true;'],
  ["A · no respeta su «Otros»",'ov==="otros"||reciboVetado','reciboVetado'],
  ["A · no respeta que la devolviera a «Otros»",'||reciboVetado(s,TRASPASO_NO,k)) return false;',') return false;'],
  ["A · también los meses cerrados",'r!=null&&r>=1-FLOW_ADELANTO&&','r!=null&&'],
  ["A · reintenta en cada pull",'if(Date.now()-(traspasoIntentos.get(k)||-Infinity)<TRASPASO_REINTENTO_MS) return false;',''],
  ["A · reconcile no lo escribe",'salidasTraspasoPropio(state).forEach(','[].forEach('],
];
let muertos=0;
for(const [nombre,de,a] of MUTANTES){
  const c=cargar(s=>{ assert.ok(s.includes(de),"el mutante «"+nombre+"» encuentra su fragmento"); return s.replace(de,a); });
  assert.ok(suite(c).length>0,"mutante vivo: "+nombre);
  muertos++;
}
console.log("traspasos-tedeben-230: "+muertos+" mutantes detectados");
