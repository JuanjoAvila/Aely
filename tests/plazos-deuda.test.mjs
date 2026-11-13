import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {loadPureLogic,loadPureLogicFromFile} from "../scripts/load-pure-logic.mjs";

/* «¿Y si gasto…?» › «A plazos» › «Crear la deuda» (revisión de dinero 229, P1-1): la deuda nace sin
   ninguna cuota pagada, debiendo todo lo financiado, sin nada en Recibos este mes y con su última cuota
   el mes que dice la hoja (hoy + n). Antes nacía con la 1.ª cuota «pagada» hoy: 1.100 de 1.200 el día
   de la compra y 100 € en «Ya pagados» sin cobro. Y las deudas de siempre no cambian por el guardo del
   ancla futura en `debtPaidCount`/`debtActive`. */
const ref=process.argv[process.argv.indexOf("--source-ref")+1];
const c=process.argv.includes("--source-ref")?loadPureLogic(execFileSync("git",["show",ref+":public/index.html"],{encoding:"utf8",maxBuffer:8e6})):loadPureLogicFromFile();
const [y,m,dia]=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Madrid"}).format(new Date()).split("-").map(Number);
const ahora=y*12+m-1;
let total=0;
function test(name,fn){ fn();total++;console.log("✓ "+name); }
const estado=(debts)=>({debts,expenses:[],fixed:[],flows:[],oneoffs:[],accounts:[{id:"sb",ent:"sabadell",value:2000,role:"fijos"}],bankTx:[],deleted:[]});
const deSuDeuda=(lista,id)=>lista.filter(x=>x.id==="debt_"+id||x.debtId===id||x.id===id);

for(const [importe,entrada,meses] of [[1200,0,12],[1000,200,24],[599,0,3]]){
  test(`a plazos ${importe} € (entrada ${entrada}) en ${meses}: nada pagado, todo debido, nada este mes y fin en hoy + ${meses}`,()=>{
    const d=c.deudaAPlazos(importe,entrada,meses,"sabadell",dia,"Compra sintética");
    const financiado=+(importe-entrada).toFixed(2);
    assert.equal(c.debtPaidCount(d),0,"ninguna cuota pagada al nacer");
    assert.equal(c.debtBalance(d),financiado,"debe todo lo financiado");
    assert.equal(c.debtLeft(d),meses,"quedan todas las cuotas");
    assert.equal(c.debtActive(d),false,"este mes no se cobra cuota");
    const p=c.planChargesMonth(estado([d]),m,y,dia);
    assert.equal(deSuDeuda(p.paidBills,d.id).length,0,"nada en «Ya pagados»");
    assert.equal(deSuDeuda(p.pendingBills,d.id).length,0,"nada pendiente este mes");
    assert.equal(p.paidBillsTotal+p.pendingBillsTotal,0,"este mes Recibos no suma nada de ella");
    assert.equal(c.pendingWalkEvents(estado([d]),y,m,dia).filter(e=>e.id===d.id||e.id==="debt_"+d.id).length,0,"no resta del recorrido de «¿Te llega?»");
    // La última cuota es la del mes ancla + n − 1 = hoy + n, el «hasta» de la hoja.
    assert.equal(d.asOf+d.months-1,ahora+meses,"última cuota en hoy + n meses");
    assert.equal(d.startMonth,d.asOf);assert.equal(d.monthly,+(financiado/meses).toFixed(2));
    if(entrada>0)assert.equal(d.downPayment,entrada);
  });
}

test("el mes que viene la 1.ª cuota sí sale: pendiente en Recibos y en «Se te van cada mes» de ese mes",()=>{
  const d=c.deudaAPlazos(1200,0,12,"sabadell",dia,"Compra sintética"),s=estado([d]);
  const sm=m===12?1:m+1,sy=m===12?y+1:y;
  // Como la vista «mes que viene» de Recibos e Inicio: hoy = 0, de ese mes aún no ha llegado nada.
  const sig=c.planChargesMonth(s,sm,sy,0),fila=sig.pendingBills.filter(x=>x.id==="debt_"+d.id);
  assert.equal(fila.length,1,"la cuota del mes que viene está pendiente");
  assert.equal(fila[0].amount,100);assert.equal(fila[0].paid,false);
  assert.equal(deSuDeuda(sig.paidBills,d.id).length,0,"y no está pagada");
  assert.equal(c.billsHeroTotal(s,null,sm,sy),100,"«Se te van cada mes» de ese mes la cuenta");
  assert.equal(c.billsHeroTotal(s,null,m,y),0,"este mes, no");
  // Pasado el plazo (mes ancla + 12) ya no sale.
  const fin=d.asOf+12,fm=fin%12+1,fy=Math.floor(fin/12);
  assert.equal(c.planChargesMonth(s,fm,fy,0).pendingBills.filter(x=>x.id==="debt_"+d.id).length,0,"tras la última, nada");
});

test("con el ancla en este mes o antes, mirar otro mes no cambia nada (`debtActiveIn` = `debtActive`)",()=>{
  for(const d of [{id:"a",value:1200,monthly:100,months:12,asOf:ahora,day:1},{id:"b",value:1200,monthly:100,months:12,asOf:ahora-11,day:28},
    {id:"e",value:900,monthly:100,months:9,asOf:ahora-9,day:1},{id:"h",value:120000,monthly:660,asOf:ahora-3,day:2},{id:"z",value:0,monthly:50,months:6,asOf:ahora-2,day:3}])
    for(const k of [-1,0,1,2,13]){const ym=ahora+k;assert.equal(c.debtActiveIn(d,Math.floor(ym/12),ym%12+1),c.debtActive(d),d.id+" mes "+k);}
});

test("plazo no válido (0, 1 o más de 120) o nada que financiar: no hay deuda",()=>{
  for(const meses of [0,1,121,null,NaN])assert.equal(c.deudaAPlazos(1200,0,meses,"sabadell",dia,"x"),null,String(meses));
  assert.equal(c.deudaAPlazos(500,500,12,"sabadell",dia,"x"),null,"la entrada lo paga todo");
});

test("las deudas de siempre (ancla en este mes o antes) cuentan igual que antes",()=>{
  // Oráculo de la regla de siempre: meses desde el ancla, más la de este mes si su día ya pasó.
  const viejo=d=>Math.max(0,ahora-d.asOf)+(d.months!=null&&(d.day||1)<=dia?1:0);
  for(const d of [
    {id:"a",value:1200,monthly:100,months:12,asOf:ahora,day:1},
    {id:"b",value:1200,monthly:100,months:12,asOf:ahora,day:28},
    {id:"c",value:3000,monthly:100,months:30,asOf:ahora-5,day:dia},
    {id:"e",value:900,monthly:100,months:9,asOf:ahora-9,day:1},
    {id:"h",value:120000,monthly:660,asOf:ahora-3,day:2},
  ]){
    assert.equal(c.debtPaidCount(d),d.months!=null?viejo(d):Math.max(0,ahora-d.asOf),d.id);
    const activa=d.months!=null?(ahora-d.asOf)<d.months&&c.debtBalance(d)>0.005:c.debtBalance(d)>0.005;
    assert.equal(c.debtActive(d),activa,d.id+": activa");
  }
});

console.log(`plazos-deuda: OK (${total})`);
