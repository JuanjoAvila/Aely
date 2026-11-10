// Prueba gratis y permanencia de un recibo (decisión del dueño, 10/11/2026; SPEC §2.3 y §2.6.2):
// dos fechas opcionales que solo avisan. Sin fecha no hay aviso, la cifra del mes no se mueve, y las
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

test("solo avisan: lo que queda por pagar es igual con fechas que sin ellas",()=>{
  const sin=estado([r("a",25),r("b",26)]);
  const con=estado([r("a",25,{pruebaHasta:"2026-10-19"}),r("b",26,{permHasta:CUR+1})]);
  assert.equal(vista(con).pack.pendingBillsTotal,vista(sin).pack.pendingBillsTotal);
  assert.equal(vista(con).pack.pendingBillsTotal,20);
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
