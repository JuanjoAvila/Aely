import assert from "node:assert/strict";
import fs from "node:fs";
import {test} from "node:test";
import {loadPureLogic} from "../scripts/load-pure-logic.mjs";
const read=f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8");
const js=JSON.parse(read("src/build-order.json")).map(f=>read("src/modules/"+f)).join("\n");
const c=loadPureLogic(read("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>js));

/* «Te deben» casa los ingresos del mes con quien te debe (petición del dueño, 11/11/2026). Nombres
   y cifras inventados: un recibo de 30 € a seis, cinco personas a 5 €, y otro de 10 € de una de ellas. */
const Y=2026, M=11, HOY=11, YM=Y*12+M;
const p=(id,n,via)=>({id,n,via:via||"transfer",amt:5});
const yt={id:"yt",name:"Vídeo",amount:5,bankAmount:30,freq:"mes",day:2,account:"sabadell",
  reparto:[p("pe_pol","Pol"),p("pe_alex","Álex"),p("pe_eva","Eva Ruiz"),p("pe_par","Pareja","bizum"),p("pe_ana","Ana")]};
const tel={id:"tel",name:"Móvil",amount:20,bankAmount:30,freq:"mes",day:2,account:"sabadell",reparto:[{id:"pe_par",n:"Pareja",via:"bizum",amt:10}]};
const ing=(id,merchant,amount,date,extra)=>Object.assign({id,merchant,amount:-amount,date,category:"ingreso",ent:"sabadell",source:"ob:sabadell"},extra||{});
const estado=(expenses,extra)=>Object.assign({fixed:[yt,tel],debts:[],expenses,bankTx:[],accounts:[{id:"b",ent:"sabadell",value:1000}]},extra||{});
const de=(s,id)=>c.teDebenMes(s,Y,M,HOY).find(x=>x.id===id);
const totalFalta=s=>Math.round(c.teDebenMes(s,Y,M,HOY).reduce((a,x)=>a+x.falta*100,0));

test("una transferencia exacta con nombre completo y tildes distintas paga a esa persona",()=>{
  const s=estado([ing("i1","TRANSFERENCIA ALEX DEL PINO GARCIA",5,"2026-11-11T08:30:00")]);
  const a=de(s,"pe_alex");
  assert.equal(a.pagado,true); assert.equal(a.auto,true); assert.equal(a.aMano,false);
  assert.equal(a.falta,0); assert.equal(a.dia,11); assert.equal(a.viaRec,"transfer");
  assert.equal(de(s,"pe_pol").pagado,false);
  // Total: Pareja 15 + Pol 5 + Eva 5 + Ana 5 = 30 € (Álex ya no).
  assert.equal(totalFalta(s),3000);
});

test("un pago a medias enseña lo pagado y lo que falta, y el total baja solo a lo que falta",()=>{
  const s=estado([ing("i1","TRANSFERENCIA POL SERRA VIDAL",4.33,"2026-11-03")]);
  const a=de(s,"pe_pol");
  assert.equal(a.pagado,false); assert.equal(a.recibido,4.33); assert.equal(a.falta,0.67);
  assert.equal(totalFalta(s),3000+67);
  // Dar por pagado lo salda; deshacerlo vuelve al parcial, no a los 5 € enteros.
  const s2=c.repartoMarcarCobrado(s,"pe_pol",Y,M,HOY,true,false);
  assert.equal(de(s2,"pe_pol").pagado,true); assert.equal(de(s2,"pe_pol").falta,0);
  const s3=c.repartoMarcarCobrado(s2,"pe_pol",Y,M,HOY,false,false);
  assert.equal(de(s3,"pe_pol").falta,0.67);
});

test("sin nombre, de otra persona, menos de la mitad, más de lo debido o de otro mes: no casa",()=>{
  for(const e of [
    ing("x1","TRANSFERENCIA",5,"2026-11-05"),
    ing("x2","TRANSFERENCIA POLINA SOLER",5,"2026-11-05"),
    ing("x3","TRANSFERENCIA POL SERRA",2,"2026-11-05"),
    ing("x4","TRANSFERENCIA POL SERRA",40,"2026-11-05"),
    ing("x5","TRANSFERENCIA POL SERRA",5,"2026-10-30"),
    ing("x6","TRASPASO POL SERRA",5,"2026-11-05",{category:"traspaso"}),
    ing("x7","TRANSFERENCIA POL SERRA",5,"2026-11-05",{possibleDup:true}),
    // Un gasto (sale dinero) a su nombre no es que te pague.
    Object.assign(ing("x8","TRANSFERENCIA POL SERRA",5,"2026-11-05"),{amount:5}),
    // Eva Ruiz necesita las dos palabras.
    ing("x9","TRANSFERENCIA EVA MARTIN",5,"2026-11-05"),
  ]){
    const s=estado([e]);
    for(const x of c.teDebenMes(s,Y,M,HOY)) assert.equal(x.recibido,0,e.id+" → "+x.id);
  }
  assert.equal(de(estado([ing("ok","TRANSFERENCIA EVA RUIZ SOLA",5,"2026-11-05")]),"pe_eva").pagado,true);
});

test("un ingreso que nombra a dos personas no paga a ninguna, y uno no paga a dos",()=>{
  const s=estado([ing("i1","TRANSFERENCIA POL Y ANA",5,"2026-11-05")]);
  assert.equal(de(s,"pe_pol").recibido,0); assert.equal(de(s,"pe_ana").recibido,0);
});

test("el aviso y el extracto del mismo ingreso cuentan una vez; dos pagos distintos suman",()=>{
  const dup=estado([ing("n","TRANSFERENCIA POL SERRA",2.5,"2026-11-03",{source:"native:sabadell"}),ing("b","TRANSFERENCIA POL SERRA",2.5,"2026-11-04")]);
  assert.equal(de(dup,"pe_pol").recibido,2.5);
  const dos=estado([ing("a","TRANSFERENCIA POL SERRA",3,"2026-11-03"),ing("b","TRANSFERENCIA POL SERRA",2,"2026-11-09")]);
  // 2 € suelto es menos de la mitad: solo casa el de 3.
  assert.equal(de(dos,"pe_pol").recibido,3);
  const dos2=estado([ing("a","BIZUM DE POL",2.5,"2026-11-03"),ing("b","TRANSFERENCIA POL",2.5,"2026-11-09")]);
  assert.equal(de(dos2,"pe_pol").pagado,true); assert.equal(de(dos2,"pe_pol").viaRec,"transfer");
});

test("quien debe dos recibos casa con la suma; deshacer lo automático lo veta ese mes",()=>{
  const s=estado([ing("i1","BIZUM DE PAREJA",15,"2026-11-06")]);
  const a=de(s,"pe_par");
  assert.equal(a.amt,15); assert.equal(a.pagado,true); assert.equal(a.viaRec,"bizum"); assert.equal(a.dia,6);
  const v=c.repartoMarcarCobrado(s,"pe_par",Y,M,HOY,false,true);
  const rc=f=>JSON.parse(JSON.stringify(f.repartoCobrado));
  assert.deepEqual(rc(v.fixed.find(f=>f.id==="yt")),{[YM]:["!pe_par"]});
  assert.equal(de(v,"pe_par").pagado,false); assert.equal(de(v,"pe_par").falta,15);
  const otra=c.repartoMarcarCobrado(v,"pe_par",Y,M,HOY,true,false);
  assert.deepEqual(rc(otra.fixed.find(f=>f.id==="tel")),{[YM]:["pe_par"]});
  // Y el resumen de la fila del recibo dice lo mismo que la hoja.
  const pk=c.planChargesMonth(s,M,Y,HOY), fila=pk.pendingBills.concat(pk.paidBills).find(x=>x.id==="fixed_yt");
  assert.deepEqual(JSON.parse(JSON.stringify(fila.teDeben)),{n:5,pagados:1});
  const pk2=c.planChargesMonth(v,M,Y,HOY), fila2=pk2.pendingBills.concat(pk2.paidBills).find(x=>x.id==="fixed_yt");
  assert.equal(fila2.teDeben.pagados,0);
});

test("un ingreso borrado no cuenta",()=>{
  const e=ing("i1","TRANSFERENCIA ALEX DEL PINO",5,"2026-11-11");
  const s=estado([e]);
  assert.equal(de(s,"pe_alex").pagado,true);
  const borrado=estado([e],{deleted:[c.expenseDeletionKey(e)]});
  assert.equal(de(borrado,"pe_alex").pagado,false);
});
