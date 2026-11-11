import assert from "node:assert/strict";
import fs from "node:fs";
import {test} from "node:test";
import {loadPureLogic} from "../scripts/load-pure-logic.mjs";
const read=f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8");
const js=JSON.parse(read("src/build-order.json")).map(f=>read("src/modules/"+f)).join("\n");
const c=loadPureLogic(read("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>js));

/* «Te deben» casa los ingresos del mes con quien te debe (petición del dueño, 11/11/2026) y la
   revisión de dinero que le dio NO-GO (P1-1 … P2-7). Personas, apellidos y cifras inventados: un
   recibo de 30 € a seis (cinco personas a 5 €) y otro de 30 € donde una de ellas pone 10. */
const Y=2026, M=11, HOY=11, YM=Y*12+M;
const p=(id,n,via)=>({id,n,via:via||"transfer",amt:5});
const yt={id:"yt",name:"Vídeo",amount:5,bankAmount:30,freq:"mes",day:2,account:"sabadell",
  reparto:[p("pe_nora","Nora"),p("pe_bruno","Bruno"),p("pe_vera","Vera Prat"),p("pe_par","Pareja","bizum"),p("pe_leo","Leo")]};
const tel={id:"tel",name:"Móvil",amount:20,bankAmount:30,freq:"mes",day:2,account:"sabadell",reparto:[{id:"pe_par",n:"Pareja",via:"bizum",amt:10}]};
const ing=(id,merchant,amount,date,extra)=>Object.assign({id,merchant,amount:-amount,date,category:"ingreso",ent:"sabadell",source:"ob"},extra||{});
const gasto=(id,merchant,amount,date,extra)=>Object.assign({id,merchant,amount,date,category:"otros",ent:"bbva",source:"ob"},extra||{});
const estado=(expenses,extra)=>Object.assign({fixed:[yt,tel],debts:[],expenses,bankTx:[],accounts:[{id:"b",ent:"sabadell",value:1000}],
  settings:{profile:{fullName:"Leo Sastre Ruano"}}},extra||{});
const de=(s,id)=>c.teDebenMes(s,Y,M,HOY).find(x=>x.id===id);
const totalFalta=s=>Math.round(c.teDebenMes(s,Y,M,HOY).reduce((a,x)=>a+x.falta*100,0));
const rc=f=>JSON.parse(JSON.stringify(f.repartoCobrado||null));

test("una transferencia exacta con su nombre (sin tildes ni apellidos que tú no pones) la paga",()=>{
  const s=estado([ing("i1","TRANSFERENCIA BRUNO EJEMPLO DEL CAMPO",5,"2026-11-11T08:30:00")]);
  const a=de(s,"pe_bruno");
  assert.equal(a.pagado,true); assert.equal(a.auto,true); assert.equal(a.aMano,false);
  assert.equal(a.falta,0); assert.equal(a.dia,11); assert.equal(a.viaRec,"transfer");
  assert.deepEqual([...a.ingresos],["i1"]);
  assert.equal(de(s,"pe_nora").pagado,false);
  // Pareja 15 + Nora 5 + Vera 5 + Leo 5 = 30 € (Bruno ya no).
  assert.equal(totalFalta(s),3000);
});

test("un pago a medias enseña lo pagado y lo que falta, y el total baja solo a lo que falta",()=>{
  const s=estado([ing("i1","TRANSFERENCIA NORA EJEMPLO",3.7,"2026-11-03")]);
  const a=de(s,"pe_nora");
  assert.equal(a.pagado,false); assert.equal(a.recibido,3.7); assert.equal(a.falta,1.3);
  assert.equal(totalFalta(s),3000+130);
  // Dar por pagado lo salda; deshacerlo vuelve al parcial, no a los 5 € enteros.
  const s2=c.repartoMarcarCobrado(s,"pe_nora",Y,M,HOY,true,null);
  assert.equal(de(s2,"pe_nora").pagado,true); assert.equal(de(s2,"pe_nora").falta,0);
  const s3=c.repartoMarcarCobrado(s2,"pe_nora",Y,M,HOY,false,null);
  assert.equal(de(s3,"pe_nora").falta,1.3);
});

test("sin nombre, de otra persona, menos de la mitad, más de lo debido, de otro mes o un gasto: no casa",()=>{
  for(const e of [
    ing("x1","TRANSFERENCIA",5,"2026-11-05"),
    ing("x2","TRANSFERENCIA NORALIA SOLER",5,"2026-11-05"),
    ing("x3","TRANSFERENCIA NORA EJEMPLO",2,"2026-11-05"),
    ing("x4","TRANSFERENCIA NORA EJEMPLO",40,"2026-11-05"),
    ing("x5","TRANSFERENCIA NORA EJEMPLO",5,"2026-10-30"),
    ing("x6","TRASPASO NORA EJEMPLO",5,"2026-11-05",{category:"traspaso"}),
    ing("x7","TRANSFERENCIA NORA EJEMPLO",5,"2026-11-05",{possibleDup:true}),
    Object.assign(ing("x8","TRANSFERENCIA NORA EJEMPLO",5,"2026-11-05"),{amount:5}),
    // «Vera Prat» necesita las dos palabras.
    ing("x9","TRANSFERENCIA VERA MOLINA",5,"2026-11-05"),
  ]){
    const s=estado([e]);
    for(const x of c.teDebenMes(s,Y,M,HOY)) assert.equal(x.recibido,0,e.id+" → "+x.id);
  }
  assert.equal(de(estado([ing("ok","TRANSFERENCIA VERA PRAT SOLA",5,"2026-11-05")]),"pe_vera").pagado,true);
});

test("un ingreso que nombra a dos personas no paga a ninguna",()=>{
  const s=estado([ing("i1","TRANSFERENCIA NORA Y BRUNO",5,"2026-11-05")]);
  assert.equal(de(s,"pe_nora").recibido,0); assert.equal(de(s,"pe_bruno").recibido,0);
});

test("P1-1 tu dinero no paga a nadie: concepto a nombre del titular o traspaso desde otro banco tuyo",()=>{
  // «Leo» se llama como el titular: su transferencia de verdad casa, la tuya (con tus apellidos) no.
  assert.equal(de(estado([ing("a","TRANSFERENCIA LEO MOLINA",5,"2026-11-05")]),"pe_leo").pagado,true);
  assert.equal(de(estado([ing("b","TRANSFERENCIA DE LEO SASTRE RUANO",5,"2026-11-05")]),"pe_leo").recibido,0);
  assert.equal(de(estado([ing("c","TRANSFERENCIA BRUNO YO MISMO",5,"2026-11-05")]),"pe_bruno").recibido,0);
  // La salida del mismo importe en otro banco tuyo, dos días antes, es la otra pata del traspaso…
  const propio=estado([ing("d","TRANSFERENCIA BRUNO EJEMPLO",5,"2026-11-05"),gasto("o","TRANSFERENCIA A CUENTA SABADELL",5,"2026-11-03")]);
  assert.equal(de(propio,"pe_bruno").recibido,0);
  // …pero un café del mismo importe con tarjeta en otro banco no lo es.
  const cafe=estado([ing("d","TRANSFERENCIA BRUNO EJEMPLO",5,"2026-11-05"),gasto("o","CAFETERIA LA PLAZA",5,"2026-11-05",{card:true})]);
  assert.equal(de(cafe,"pe_bruno").pagado,true);
});

test("P1-2 devoluciones, un Bizum tuyo rechazado y lo ya atado a otra cosa no son un pago",()=>{
  for(const e of [
    ing("a","DEVOLUCION RECIBO NORA",5,"2026-11-05"),
    ing("b","ANULACION TRANSFERENCIA NORA",5,"2026-11-05"),
    ing("c","BIZUM A NORA",5,"2026-11-05"),
    ing("d","TRANSFERENCIA NORA EJEMPLO",5,"2026-11-05",{debtId:"dx"}),
    ing("e","TRANSFERENCIA NORA EJEMPLO",5,"2026-11-05",{reciboId:"rx"}),
    ing("f","TRANSFERENCIA NORA EJEMPLO",5,"2026-11-05",{goalId:"gx"}),
  ]) assert.equal(de(estado([e]),"pe_nora").recibido,0,e.id);
});

test("P2-3 quien debe dos recibos puede pagarlos por separado, y casa con la suma",()=>{
  const s=estado([ing("a","BIZUM DE PAREJA",10,"2026-11-03"),ing("b","BIZUM DE PAREJA",5,"2026-11-06")]);
  const a=de(s,"pe_par");
  assert.equal(a.amt,15); assert.equal(a.pagado,true); assert.equal(a.viaRec,"bizum"); assert.equal(a.dia,6);
  // Y el resumen de la fila del recibo dice lo mismo que la hoja.
  const pk=c.planChargesMonth(s,M,Y,HOY), fila=pk.pendingBills.concat(pk.paidBills).find(x=>x.id==="fixed_yt");
  assert.deepEqual(JSON.parse(JSON.stringify(fila.teDeben)),{n:5,pagados:1});
});

test("P2-4 un céntimo de más por redondeo casa, y lo recibido no pasa de lo debido",()=>{
  const tercio={id:"t",name:"Luz",amount:8.34,bankAmount:25,freq:"mes",day:2,account:"sabadell",
    reparto:[{id:"pe_a",n:"Iris",via:"transfer",amt:8.33},{id:"pe_b",n:"Otto",via:"transfer",amt:8.33}]};
  const s=estado([ing("a","TRANSFERENCIA IRIS EJEMPLO",8.34,"2026-11-05")],{fixed:[tercio]});
  const a=de(s,"pe_a");
  assert.equal(a.pagado,true); assert.equal(a.recibido,8.33); assert.equal(a.falta,0);
  assert.equal(de(estado([ing("a","TRANSFERENCIA IRIS EJEMPLO",8.36,"2026-11-05")],{fixed:[tercio]}),"pe_a").recibido,0);
});

test("P2-5 el aviso y la fila del banco del mismo ingreso cuentan una vez; dos pagos iguales, dos",()=>{
  const dup=estado([ing("n","TRANSFERENCIA NORA EJEMPLO",2.5,"2026-11-03",{source:"native:sabadell"}),ing("b","TRANSFERENCIA NORA EJEMPLO",2.5,"2026-11-04")]);
  assert.equal(de(dup,"pe_nora").recibido,2.5);
  const dos=estado([ing("a","TRANSFERENCIA NORA EJEMPLO",2.5,"2026-11-03"),ing("b","TRANSFERENCIA NORA EJEMPLO",2.5,"2026-11-04")]);
  assert.equal(de(dos,"pe_nora").pagado,true);
});

test("P2-6 deshacer lo automático veta ESE ingreso; otro que llegue después sí casa; deshacer a mano no veta",()=>{
  const s=estado([ing("i1","TRANSFERENCIA BRUNO EJEMPLO",5,"2026-11-04")]);
  const b=de(s,"pe_bruno");
  const v=c.repartoMarcarCobrado(s,"pe_bruno",Y,M,HOY,false,b.ingresos);
  assert.deepEqual(rc(v.fixed.find(f=>f.id==="yt")),{[YM]:["!pe_bruno:i1"]});
  assert.equal(de(v,"pe_bruno").pagado,false); assert.equal(de(v,"pe_bruno").falta,5);
  const luego=Object.assign({},v,{expenses:v.expenses.concat([ing("i2","TRANSFERENCIA BRUNO EJEMPLO",5,"2026-11-09")])});
  assert.equal(de(luego,"pe_bruno").pagado,true);
  assert.deepEqual([...de(luego,"pe_bruno").ingresos],["i2"]);
  // Marca a mano encima de un automático: deshacerla solo quita la marca.
  const mano=c.repartoMarcarCobrado(s,"pe_bruno",Y,M,HOY,true,null);
  const quita=c.repartoMarcarCobrado(mano,"pe_bruno",Y,M,HOY,false,null);
  assert.equal(rc(quita.fixed.find(f=>f.id==="yt")),null);
  assert.equal(de(quita,"pe_bruno").pagado,true);
});

test("P2-7 una fecha que no se entiende no cuenta como de este mes",()=>{
  assert.equal(de(estado([ing("i1","TRANSFERENCIA BRUNO EJEMPLO",5,"xx")]),"pe_bruno").recibido,0);
});

test("un ingreso borrado no cuenta",()=>{
  const e=ing("i1","TRANSFERENCIA BRUNO EJEMPLO",5,"2026-11-11");
  assert.equal(de(estado([e]),"pe_bruno").pagado,true);
  assert.equal(de(estado([e],{deleted:[c.expenseDeletionKey(e)]}),"pe_bruno").pagado,false);
});
