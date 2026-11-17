import assert from "node:assert/strict";
import fs from "node:fs";
import {loadPureLogic} from "../scripts/load-pure-logic.mjs";
const read=f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8");
const js=JSON.parse(read("src/build-order.json")).map(f=>read("src/modules/"+f)).join("\n");
const c=loadPureLogic(read("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>js));

/* LA FECHA DE FIN Y LAS CUOTAS SE CUENTAN EN CÉNTIMOS (revisión 237). Tras la 236 (`cuotasQueQuedan`)
   quedaban divisiones en euros: la fecha de fin de una deuda SIN plazo (72,45 / 10,35 = 7,000…01 → 8),
   las cuotas del año en Recibos y la previsión de una meta. Y la ficha de Recibos guardaba la bajada
   sin redondear: 10,354 hacía que el saldo arrastrase milésimas. Importes inventados. */
const [y,m]=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Madrid"}).format(new Date()).split("-").map(Number);
const ahora=y*12+m-1;
const cts=x=>Math.round(x*100);
// El sandbox es otro reino: sus objetos no pasan el deepEqual estricto sin copiarlos.
const info=d=>{ const r=c.debtLeftInfo(d); return r&&{n:r.n,tot:r.tot}; };
let total=0,fallos=0;
// Cada prueba sigue aunque caiga otra: con el código viejo se ve cuáles caen, no solo la primera.
function test(name,fn){ try{ fn();total++;console.log("✓ "+name); }catch(e){ fallos++;console.log("✗ "+name+"\n  "+String(e.message).split("\n")[0]); } }
// Sin plazo y anclada este mes: no ha vencido ninguna cuota, el saldo es el valor.
const sinPlazo=(o)=>Object.assign({id:"h",name:"Préstamo sintético",day:1,account:"sabadell",asOf:ahora},o);

test("sin plazo: 72,45 con cuota de 10,35 son 7 cuotas, no 8",()=>{
  const d=sinPlazo({value:72.45,original:103.5,monthly:10.35});
  assert.equal(cts(c.debtBalance(d)),7245);
  assert.deepEqual(info(d),{n:7,tot:10});
});

test("sin plazo: un céntimo de más sí es otra cuota",()=>{
  assert.deepEqual(info(sinPlazo({value:72.46,original:72.46,monthly:10.35})),{n:8,tot:8});
});

test("sin plazo: con pago final de polvo (250,00000000000003 / 50) siguen siendo 5",()=>{
  assert.equal(c.debtLeftInfo(sinPlazo({value:260.98-10.98,monthly:50})).n,5);
});

test("sin plazo: una bajada de menos de medio céntimo no inventa una fecha de fin",()=>{
  assert.equal(c.debtLeftInfo(sinPlazo({value:500,monthly:100,amort:0.004})),null);
});

test("sin plazo: saldo por debajo de medio céntimo = nada que contar",()=>{
  assert.equal(c.debtLeftInfo(sinPlazo({value:0.004,monthly:10})),null);
});

test("con plazo manda el plazo, no la división",()=>{
  const d=sinPlazo({value:103.5,original:103.5,monthly:10.35,months:10,asOf:ahora-1});
  assert.deepEqual(info(d),{n:c.debtLeft(d),tot:10});
});

test("Recibos: cuotas del año sin plazo, también en céntimos",()=>{
  const d=sinPlazo({value:72.45,monthly:10.35});
  assert.equal(c.billsCuotasEnAno(d,m,y),7);
  assert.equal(c.billsCuotasEnAno(sinPlazo({value:72.46,monthly:10.35}),m,y),8);
  assert.equal(c.billsCuotasEnAno(sinPlazo({value:5000,monthly:10.35}),m,y),12,"el año tiene doce");
  assert.equal(c.billsCuotasEnAno(sinPlazo({value:0.004,monthly:10.35}),m,y),0);
});

test("meta: 72,45 que faltan a 10,35 al mes son 7 meses",()=>{
  const g={id:"g",name:"Meta sintética",target:100,saved:27.55,monthly:10.35};
  const txt=c.goalEta(g,0).text;
  assert.ok(txt.includes(c.monthYearIn(7))&&!txt.includes(c.monthYearIn(8)),txt);
  // Un ahorro que no llega a medio céntimo no promete fecha (antes, miles de meses).
  assert.equal(c.goalEta({id:"g",target:100,saved:0},0.004).text,c.goalEta({id:"g",target:100,saved:0},0).text);
});

test("amortizar con una bajada de menos de medio céntimo no toca el plazo",()=>{
  const d=sinPlazo({value:1000,original:1000,monthly:100,amort:0.004,months:10,asOf:ahora-1});
  const o=c.deudaAmortizada(d,c.debtBalance(d),100);
  assert.equal(o.months,10,"antes se quedaba en las ya pagadas con saldo pendiente");
  assert.equal(o.settledAt,undefined);
  assert.equal(c.amortRecorte(d,100),null,"el asesor no cuenta cuotas que no hay");
});

test("amortizar todo menos medio céntimo la da por liquidada",()=>{
  const d=sinPlazo({value:1000,original:1000,monthly:100,months:10,asOf:ahora-1});
  const o=c.deudaAmortizada(d,c.debtBalance(d),c.debtBalance(d)-0.004);
  assert.ok(o.settledAt,"queda liquidada");
  assert.equal(c.amortRecorte(d,c.debtBalance(d)-0.004).leftNew,0);
});

test("la ficha de Recibos guarda la bajada y la cuota al céntimo",()=>{
  let st={debts:[sinPlazo({value:1000,original:1000,monthly:100,months:10})]};
  const set=fn=>{ st=fn(st); };
  c.patchDebtFields(set,"h",{amort:10.354});
  assert.equal(st.debts[0].amort,10.35);
  c.patchDebtFields(set,"h",{monthly:50.006});
  assert.equal(st.debts[0].monthly,50.01);
  // Redondeada, la bajada ya no deja milésimas en el saldo de cada mes.
  for(let k=0;k<=10;k++) assert.equal(cts(c.debtBalanceAfter(st.debts[0],k))/100,+c.debtBalanceAfter(st.debts[0],k).toFixed(2));
});

console.log(`\n${total} OK, ${fallos} fallos`);
if(fallos) process.exit(1);
