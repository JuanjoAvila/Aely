// Prueba gratis y permanencia de un recibo (decisión del dueño, 10/11/2026; SPEC §2.3 y §2.6.2):
// dos fechas opcionales. Sin fecha no hay aviso; los meses de prueba salen de lo que queda por pagar; y las
// dos sobreviven a la mezcla entre móviles sin pisar lo que el otro cambió. Datos inventados.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import { loadPureLogic } from "../scripts/load-pure-logic.mjs";

const read=f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8");
const order=JSON.parse(read("src/build-order.json"));
const c=loadPureLogic(read("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>order.map(f=>read("src/modules/"+f)).join("\n")));
vm.runInNewContext(read("src/modules/14-v4-screens.js"),c);
const AHORA=new Date("2026-10-18T12:00:00+02:00").getTime();
c.Date=class extends Date { constructor(...a){ super(...(a.length?a:[AHORA])); } static now(){ return AHORA; } };

const Y=2026,M=10,HOY=18,CUR=Y*12+M;
const r=(id,day,extra)=>Object.assign({id,name:"Recibo "+id,amount:10,freq:"mes",day,account:"sabadell"},extra);
const estado=(fixed)=>({accounts:[{id:"sb",ent:"sabadell",role:"fijos",value:900}],fixed,bankTx:[],expenses:[],debts:[],oneoffs:[],flows:[],goals:[]});
const vista=(s)=>{
  const pack=c.planChargesMonth(s,M,Y,HOY),proof=c.paymentEvidenceUI(s,Y,M,HOY);
  return {pack,v:c.planRecibosVista(pack,proof,HOY,c.planRecibosAvisos(s,pack,proof,Y,M,HOY),{})};
};
const ids=l=>JSON.parse(JSON.stringify(l.map(x=>x.id+(x.rv?":"+x.rv:""))));

test("la prueba avisa solo hoy o mañana; la permanencia, este mes o el que viene",()=>{
  const s=estado([
    r("hoy",25,{pruebaHasta:"2026-10-18"}), r("manana",25,{pruebaHasta:"2026-10-19"}),
    r("pasado",25,{pruebaHasta:"2026-10-20"}), r("vieja",25,{pruebaHasta:"2026-10-01"}), r("rota",25,{pruebaHasta:"19/10/2026"}),
    r("perm0",26,{permHasta:CUR}), r("perm1",27,{permHasta:CUR+1}), r("perm2",27,{permHasta:CUR+2}), r("permPasada",27,{permHasta:CUR-1}),
    r("vista",27,{permHasta:CUR+1,revisado:{perm:CUR+1}}), r("otraVista",27,{permHasta:CUR+1,revisado:{perm:CUR}}),
    r("nada",28)]);
  const {v}=vista(s);
  assert.deepEqual(ids(v.review),["fixed_hoy:trial","fixed_manana:trial","fixed_perm0:perm","fixed_perm1:perm","fixed_otraVista:perm"]);
  assert.equal(c.pr6Motivo(v.review[0]),"Hoy empieza a cobrar");
  assert.equal(c.pr6Motivo(v.review[1]),"Mañana empieza a cobrar");
  assert.equal(c.pr6Motivo(v.review[3]),"Fin de permanencia: nov 2026");
});

test("la permanencia solo avisa, y la prueba que acaba este mes cobra este mes: lo que queda por pagar no cambia",()=>{
  const sin=estado([r("a",25),r("b",26)]);
  const con=estado([r("a",25,{pruebaHasta:"2026-10-19"}),r("b",26,{permHasta:CUR+1})]);
  assert.equal(vista(con).pack.pendingBillsTotal,vista(sin).pack.pendingBillsTotal);
  assert.equal(vista(con).pack.pendingBillsTotal,20);
});

/* Decisión del dueño (10/11/2026): la prueba gratis «como el diseño». El prototipo saca del mes el
   recibo cuya prueba acaba en un mes posterior (`fromNext`) y lo sigue contando en «Se te van cada
   mes». Oráculo contado a mano: 10 € al mes, prueba hasta el 5 de enero → oct, nov y dic gratis. */
test("prueba que acaba en otro mes: fuera de lo que queda por pagar y del año en sus meses, dentro de «Se te van cada mes»",()=>{
  const trial=r("t",25,{pruebaHasta:"2027-01-05"});
  const s=estado([r("a",25),trial]);
  assert.equal(vista(s).pack.pendingBillsTotal,10,"octubre: solo el otro recibo");
  assert.equal(vista(s).pack.pendingBills.some(x=>x.id==="fixed_t"),false);
  // «Nov ›»: tampoco; enero (el mes en que empieza a cobrar), sí.
  assert.equal(c.planChargesMonth(s,11,Y,1).pendingBills.some(x=>x.id==="fixed_t"),false);
  assert.equal(c.planChargesMonth(s,1,2027,1).pendingBills.some(x=>x.id==="fixed_t"),true);
  // El recorrido de «¿Te llega?» no lo descuenta este mes.
  const cargos=(st,y,m,d)=>[...c.pendingWalkEvents(st,y,m,d)].filter(x=>x.amt<0).map(x=>x.amt);
  assert.deepEqual(cargos(estado([trial]),Y,M,HOY),[]);
  assert.deepEqual(cargos(estado([trial]),2027,1,1),[-10]);
  // Al mes cuenta entero (no es una pausa) y al año faltan sus tres meses de prueba.
  assert.equal(c.billsPausado(trial,M,Y),false);
  assert.equal(c.billsHeroTotal(s,null,M,Y),20);
  assert.equal(Math.round(c.billsAnualDe(trial,M,Y)*100),9000);
  const fila=c.billsGroupRows(s,"serv",M,Y).find(x=>x.id==="t");
  assert.deepEqual([fila.monthly,fila.anual,fila.paused],[10,90,false]);
});

test("prueba gratis: el mes en que acaba cuenta; una fecha pasada o rota no quita nada",()=>{
  for(const p of ["2026-10-30","2026-10-01","2026-09-12","19/10/2026",""]){
    const e=r("t",25,{pruebaHasta:p});
    assert.equal(c.fixedSinCobroIn(e,Y,M),false,p);
    assert.equal(vista(estado([e])).pack.pendingBillsTotal,10,p);
    assert.equal(Math.round(c.billsAnualDe(e,M,Y)*100),12000,p);
  }
  // Diciembre → enero: la prueba hasta el 3 de enero deja fuera diciembre.
  assert.equal(c.fixedSinCobroIn(r("t",25,{pruebaHasta:"2027-01-03"}),2026,12),true);
  assert.equal(c.fixedSinCobroIn(r("t",25,{pruebaHasta:"2027-01-03"}),2027,1),false);
  // Un trimestral (ene/abr/jul/oct) con prueba hasta febrero: el año pierde el cobro de enero y el de octubre.
  const tri=Object.assign(r("q",25,{pruebaHasta:"2027-02-01"}),{freq:"trimestral",amount:30});
  assert.equal(Math.round(c.billsAnualDe(tri,M,Y)*100),6000);
});

test("pagado igual en un mes de prueba: es un pago de verdad y se queda en Ya pagados, como con la pausa",()=>{
  const e=r("t",5,{pruebaHasta:"2026-12-05",paidYm:CUR,paidDay:5});
  const s=estado([e]);
  const pack=c.planChargesMonth(s,M,Y,HOY);
  assert.deepEqual([...pack.paidBills.map(x=>x.id)],["fixed_t"]);
  assert.equal(pack.pendingBillsTotal,0);
  assert.equal(c.fixedEnPausa(s,e,Y,M,HOY),false);
  assert.equal(c.fixedEnPausa(s,r("t",5,{pruebaHasta:"2026-12-05"}),Y,M,HOY),true);
});

test("por prioridad: la prueba delante de lo que no ha llegado, y la permanencia detrás",()=>{
  const s=estado([r("late",3),r("perm",22,{permHasta:CUR+1}),r("trial",25,{pruebaHasta:"2026-10-19"})]);
  assert.deepEqual(ids(vista(s).v.review),["fixed_trial:trial","fixed_late:late","fixed_perm:perm"]);
  // Pospuesta, la permanencia vuelve a «Por pagar» hasta mañana.
  const pack=c.planChargesMonth(s,M,Y,HOY),proof=c.paymentEvidenceUI(s,Y,M,HOY);
  const v=c.planRecibosVista(pack,proof,HOY,c.planRecibosAvisos(s,pack,proof,Y,M,HOY),{fixed_perm:"x"});
  assert.deepEqual(ids(v.review),["fixed_trial:trial","fixed_late:late"]);
  assert.ok(v.due.some(x=>x.id==="fixed_perm"));
});

test("se mezclan entre móviles: cada fecha va por su cuenta y no arrastra el importe",()=>{
  const base=[r("a",25)];
  const local=[r("a",25,{pruebaHasta:"2026-11-02"})];
  const remote=[r("a",25,{permHasta:CUR+12,amount:12})];
  const m=c.mergePlanThreeWay(base,local,remote,"fixed");
  assert.equal(m.conflicts.length,0);
  assert.equal(m.rows[0].pruebaHasta,"2026-11-02");
  assert.equal(m.rows[0].permHasta,CUR+12);
  assert.equal(m.rows[0].amount,12);
  // Quitarla en un móvil la quita si el otro no la tocó.
  const quitada=c.mergePlanThreeWay(local,[r("a",25)],JSON.parse(JSON.stringify(local)),"fixed");
  assert.equal(quitada.conflicts.length,0);
  assert.ok(!("pruebaHasta" in quitada.rows[0]));
});
