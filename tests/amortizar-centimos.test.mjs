import assert from "node:assert/strict";
import fs from "node:fs";
import {loadPureLogic} from "../scripts/load-pure-logic.mjs";
const read=f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8");
const js=JSON.parse(read("src/build-order.json")).map(f=>read("src/modules/"+f)).join("\n");
const c=loadPureLogic(read("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>js));

/* AMORTIZAR CUENTA LAS CUOTAS EN CÉNTIMOS (encargo 236). `deudaAmortizada` y `amortRecorte` hacían
   `Math.ceil(pendiente / bajada)` en euros: 72,45 / 10,35 da 7,000000000000001 y el plazo crecía una
   cuota fantasma (y el asesor recortaba una menos). Con pago final pasaba igual al restarlo:
   260,98 − 10,98 = 250,00000000000003. Importes inventados. */
const [y,m]=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Madrid"}).format(new Date()).split("-").map(Number);
const ahora=y*12+m-1;
const cts=x=>Math.round(x*100);
let total=0,fallos=0;
// Cada prueba sigue aunque caiga otra: con el código viejo se ve cuáles caen, no solo la primera.
function test(name,fn){ try{ fn();total++;console.log("✓ "+name); }catch(e){ fallos++;console.log("✗ "+name+"\n  "+String(e.message).split("\n")[0]); } }
const amortiza=(d,x)=>c.deudaAmortizada(d,c.debtBalance(d),x);
// Día 1 y ancla el mes pasado: siempre van 2 cuotas pagadas, sea el día que sea.
const deuda=(o)=>Object.assign({id:"d",name:"Deuda sintética",day:1,account:"sabadell",asOf:ahora-1},o);

test("cuotasQueQuedan: céntimos, sin polvo de coma flotante",()=>{
  assert.equal(c.cuotasQueQuedan(72.45,10.35),7);
  assert.equal(c.cuotasQueQuedan(250.00000000000003,50),5);
  assert.equal(c.cuotasQueQuedan(100,100),1);
  assert.equal(c.cuotasQueQuedan(100.01,100),2,"un céntimo de verdad sí es otra cuota (la última, de 0,01)");
  assert.equal(c.cuotasQueQuedan(0.004,100),0,"menos de medio céntimo no es nada");
  assert.equal(c.cuotasQueQuedan(-5,100),0);
});

test("72,45 pendientes con cuota de 10,35 son 7 cuotas, no 8",()=>{
  const d=deuda({value:103.5,original:103.5,monthly:10.35,months:10});
  assert.equal(c.debtPaidCount(d),2);
  assert.equal(cts(c.debtBalance(d)),8280);
  const o=amortiza(d,10.35);
  assert.equal(cts(c.debtBalance(o)),7245);
  assert.equal(o.months,2+7,"el plazo se acorta a 7 cuotas más");
  assert.equal(c.debtLeft(o),7);
  const rc=c.amortRecorte(d,10.35);
  assert.deepEqual([rc.leftNow,rc.leftNew,rc.cut],[8,7,1],"el asesor cuenta lo mismo");
});

test("con pago final, restarlo no añade una cuota (260,98 − 10,98 → 5 cuotas de 50)",()=>{
  const d=deuda({value:510.98,original:510.98,monthly:50,amort:50,months:10,balloon:10.98});
  assert.equal(cts(c.debtBalance(d)),41098);
  const o=amortiza(d,150);
  assert.equal(o.months,2+5);
  assert.equal(o.balloon,10.98,"el pago final se queda");
  const rc=c.amortRecorte(d,150);
  assert.deepEqual([rc.leftNew,rc.cut],[5,3]);
});

test("amortizar 100 o 99,95 de 800 con cuota de 100: 7 cuotas, u 8 con una última de 0,05",()=>{
  const d=deuda({value:1000,original:1000,monthly:100,months:10});
  assert.equal(cts(c.debtBalance(d)),80000);
  const cien=amortiza(d,100);
  assert.equal(cien.months,2+7);
  assert.equal(c.amortRecorte(d,100).cut,1);
  // Los 0,05 que quedan son dinero de verdad: alargan una cuota, que el banco cobrará de 0,05.
  const casi=amortiza(d,99.95);
  assert.equal(cts(c.debtBalance(casi)),70005);
  assert.equal(casi.months,2+8);
  assert.equal(c.amortRecorte(d,99.95).cut,0);
  assert.equal(c.debtUltimaAjuste(casi),5-10000,"la última cuota es de 0,05");
});

test("amortizar justo lo pendiente deja la deuda a 0, liquidada y sin cuotas por delante",()=>{
  const d=deuda({value:1000,original:1000,monthly:100,months:10});
  const o=amortiza(d,800);
  assert.equal(c.debtBalance(o),0);
  assert.ok(o.settledAt,"liquidada");
  assert.equal(o.months,2,"el plazo acaba en las ya pagadas");
  assert.equal(c.amortRecorte(d,800).leftNew,0);
  // Con pago final, amortizar justo la parte de cuotas deja solo el pago final: una «cuota» más.
  const b=deuda({value:510.98,original:510.98,monthly:50,amort:50,months:10,balloon:10.98});
  const solo=amortiza(b,400);
  assert.equal(cts(c.debtBalance(solo)),1098);
  assert.equal(solo.months,2+1,"queda el mes del pago final");
  assert.equal(c.amortRecorte(b,400).leftNew,1);
});

if(fallos){ console.log(`amortizar-centimos: ${fallos} fallan`); process.exit(1); }
console.log(`amortizar-centimos: ${total} pruebas OK`);
