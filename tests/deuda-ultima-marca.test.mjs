import assert from "node:assert/strict";
import fs from "node:fs";
import {loadPureLogic} from "../scripts/load-pure-logic.mjs";
const read=f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8");
const js=JSON.parse(read("src/build-order.json")).map(f=>read("src/modules/"+f)).join("\n");
const c=loadPureLogic(read("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>js));

/* EL CARGO DE LA ÚLTIMA CUOTA SIGUE SIENDO UNA CUOTA (revisión de dinero 234, H-A2). Pagada la
   última, el saldo es 0 y la deuda deja de estar «activa»; el motor de cuotas solo miraba las
   activas, así que el cargo del banco que llega ese día o pocos días después ya no pasaba a
   «Deudas» y contaba como gasto. 600,03 en 12 se salvaba por los 0,03 que dejaba el redondeo; con
   el redondeo arreglado caía también, como ya caían 1.200/12 o 1.199,99/7. Reloj fijo, datos
   inventados. */
const reloj={ms:0};
c.Date=class extends Date{ constructor(...a){ super(...(a.length?a:[reloj.ms])); } static now(){ return reloj.ms; } };
let total=0,fallos=0;
function test(name,fn){ try{ fn();total++;console.log("✓ "+name); }catch(e){ fallos++;console.log("✗ "+name+"\n  "+String(e.message).split("\n")[0]); } }
const OCT=2026*12+9;
// La última cuota cae en octubre de 2026, el día 5 (o el que se diga).
const deuda=(imp,n,dia=5)=>{ const d=Object.assign(c.deudaAPlazos(imp,0,n,"sabadell",dia,"Financiera Ejemplo"),{id:"fin",asOf:OCT-n+1,startMonth:OCT-n+1}); delete d.startDay; return d; };
const cargo=(fecha,importe)=>({id:"x1",ent:"sabadell",date:fecha+"T12:00:00.000Z",amount:importe,merchant:"FINANCIERA EJEMPLO",obName:"FINANCIERA EJEMPLO",source:"ob",status:"BOOK",category:"otros"});
const estado=(d,e)=>({debts:[d],expenses:[e],fixed:[],flows:[],oneoffs:[],accounts:[{id:"sb",ent:"sabadell",value:2000,role:"fijos"}],bankTx:[],deleted:[],settings:{}});
const marca=(hoy,d,e)=>{ reloj.ms=Date.parse(hoy+"T12:00:00Z"); return JSON.parse(JSON.stringify(c.cuotasDeDeudaPorMarcar(estado(d,e)).map(x=>x.debtId))); };

for(const [imp,n,cobra] of [[600.03,12,50.03],[600.03,12,50.00],[1200,12,100],[1199.99,7,171.41]]){
  for(const hoy of ["2026-10-05","2026-10-07","2026-10-31","2026-11-03"]){
    test(`${imp}/${n}: el cargo de ${cobra} del 5/10 es cuota también el ${hoy}`,()=>{
      assert.deepEqual(marca(hoy,deuda(imp,n),cargo("2026-10-05",cobra)),["fin"]);
    });
  }
  test(`${imp}/${n}: la del 30/10 que el banco apunta tarde (2/11) sigue siendo la cuota de octubre`,()=>{
    assert.deepEqual(marca("2026-11-04",deuda(imp,n,30),cargo("2026-11-02",cobra)),["fin"]);
  });
}
test("un cargo parecido del mes SIGUIENTE a la última no se toma por cuota",()=>{
  assert.deepEqual(marca("2026-11-07",deuda(600.03,12),cargo("2026-11-05",50.03)),[]);
});
test("pasados los días de gracia, una deuda acabada ya no reclama cargos",()=>{
  assert.deepEqual(marca("2026-11-20",deuda(600.03,12),cargo("2026-10-05",50.03)),[]);
});
test("el mes de la última, Recibos sigue acreditando el cargo del banco (contrincante del mes)",()=>{
  reloj.ms=Date.parse("2026-10-07T12:00:00Z");
  const d=deuda(600.03,12),s=estado(d,cargo("2026-10-05",50.03));
  assert.equal(c.debtActive(d),false,"premisa: pagada la última ya no está activa");
  assert.ok(JSON.parse(JSON.stringify(c.fixedPaymentContenders(s,2026,10))).some(x=>x.debt&&x.debt.id==="fin"),"la deuda compite por el cargo de octubre");
  assert.ok(!JSON.parse(JSON.stringify(c.fixedPaymentContenders(s,2026,11))).some(x=>x.debt&&x.debt.id==="fin"),"y en noviembre ya no");
});

if(fallos){ console.log(`deuda-ultima-marca: ${fallos} fallan`); process.exit(1); }
console.log(`deuda-ultima-marca: ${total} pruebas OK`);
