import assert from "node:assert/strict";
import fs from "node:fs";
import {loadPureLogic} from "../scripts/load-pure-logic.mjs";
const read=f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8");
const js=JSON.parse(read("src/build-order.json")).map(f=>read("src/modules/"+f)).join("\n");
const c=loadPureLogic(read("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>js));

/* DIN-15 — amortizar casi todo lo que debe una deuda con el plazo VENCIDO. Debiendo 100 € de un plazo
   ya agotado, amortizar 99,95 dejaba la deuda en 0,00: `value` bajaba a 1.200,05 y `debtUltimaAjuste`
   tomaba esos 0,05 por redondeo de la última cuota (last ≤ cuota + n céntimos) y daba el saldo por
   cero. Eran 0,05 de dinero de verdad que desaparecían sin que nadie los pagara. */
const [y,m]=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Madrid"}).format(new Date()).split("-").map(Number);
const ahora=y*12+m-1;
const cts=x=>Math.round(x*100);
let total=0,fallos=0;
function test(name,fn){ try{ fn();total++;console.log("✓ "+name); }catch(e){ fallos++;console.log("✗ "+name+"\n  "+String(e.message).split("\n")[0]); } }
const amortiza=(d,x)=>c.deudaAmortizada(d,c.debtBalance(d),x);
// Plazo de 12 cuotas de 100 anclado hace 14 meses: vencido, y con 100 € todavía pendientes.
const vencida=(o)=>Object.assign({id:"d",name:"Deuda sintética",day:1,account:"sabadell",asOf:ahora-14,value:1300,original:1300,monthly:100,months:12},o);

test("la deuda vencida debe 100 antes de amortizar",()=>{
  assert.equal(cts(c.debtBalance(vencida())),10000);
});

test("amortizar 99,95 de 100 en un plazo vencido deja 0,05, no 0",()=>{
  const o=amortiza(vencida(),99.95);
  assert.equal(cts(c.debtBalance(o)),5,"quedan 0,05 de verdad");
  assert.equal(o.settledAt,undefined,"no está liquidada");
});

test("y esos 0,05 se pueden amortizar después hasta liquidar",()=>{
  const o=amortiza(vencida(),99.95), z=amortiza(o,0.05);
  assert.equal(c.debtBalance(z),0);
  assert.ok(z.settledAt,"liquidada");
});

test("amortizar los 100 justos sigue liquidando",()=>{
  const o=amortiza(vencida(),100);
  assert.equal(c.debtBalance(o),0);
  assert.ok(o.settledAt);
});

test("un plazo en curso no cambia: la última cuota se sigue llevando el redondeo",()=>{
  const d=vencida({asOf:ahora-1,value:1200.03,original:1200.03,monthly:100,amort:100});
  assert.equal(cts(c.debtBalanceAfter(d,12)),0,"el sobrante de redondeo de la última cuota no se debe");
});

if(fallos){ console.log(`amortizar-resto-vencida: ${fallos} fallan`); process.exit(1); }
console.log(`amortizar-resto-vencida: ${total} pruebas OK`);
