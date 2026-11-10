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
  // «vieja» acabó el 1: ese día tocaba su primer cobro (prototipo, `r.day = r.trial.day`) y el banco no
  // trae nada, así que ya no es aviso de prueba sino «No ha llegado» (auditoría de la 222, P1-1).
  assert.deepEqual(ids(v.review),["fixed_hoy:trial","fixed_manana:trial","fixed_vieja:late","fixed_perm0:perm","fixed_perm1:perm","fixed_otraVista:perm"]);
  assert.equal(c.pr6Motivo(v.review[0]),"Hoy empieza a cobrar");
  assert.equal(c.pr6Motivo(v.review[1]),"Mañana empieza a cobrar");
  assert.equal(c.pr6Motivo(v.review[4]),"Fin de permanencia: nov 2026");
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

/* Revisión de la 221, P1-1: el mes en que acaba la prueba, con el recibo el día 5 y la prueba hasta el 20,
   no puede salir «No ha llegado» el 18 ni restarse antes en «¿Te llega?»: cobra el 20 (como el prototipo). */
test("el mes en que acaba la prueba, el primer cobro es el día en que acaba",()=>{
  const e=r("t",5,{pruebaHasta:"2026-10-20"});
  const s=estado([e]);
  assert.equal(c.dayIn(e,10,2026),20);
  assert.equal(c.dayIn(e,11,2026),5,"el mes siguiente, su día de siempre");
  assert.equal(c.dayIn(e,10),5,"sin año (calendario), sin cambio");
  assert.equal(c.dayIn(r("t",25,{pruebaHasta:"2026-10-20"}),10,2026),20,"un día posterior también: cobra el día en que acaba");
  const {pack,v}=vista(s);
  assert.deepEqual(ids(v.review),[]);
  assert.deepEqual([...v.due.map(x=>[x.id,x.day])],[["fixed_t",20]]);
  assert.equal(pack.pendingBills[0].overdue,false);
  assert.deepEqual([...c.pendingWalkEvents(s,Y,M,HOY)].filter(x=>x.amt<0).map(x=>[x.day,x.amt]),[[20,-10]]);
  // El 19 avisa «Mañana empieza a cobrar» como siempre.
  const p19=c.planChargesMonth(s,M,Y,19),pr19=c.paymentEvidenceUI(s,Y,M,19);
  assert.deepEqual(ids(c.planRecibosVista(p19,pr19,19,c.planRecibosAvisos(s,p19,pr19,Y,M,19),{}).review),["fixed_t:trial"]);
});

/* Auditoría de la 222, P1-1: el aviso decía «Cobra mañana» y la ficha «Se cobra el 25» del mismo recibo,
   porque el día solo se movía si la prueba acababa DESPUÉS de su día de siempre. Oráculo a mano: recibo
   del 25 con la prueba hasta el 19, mirado el 18 → el aviso, la ficha, «¿Te llega?», Inicio y la
   víspera dicen todos el 19; el 22 (19 + 2 días de margen + 1) ya es «No ha llegado». */
test("la prueba que acaba antes de su día: aviso, ficha, ¿Te llega? e Inicio dicen el mismo día",()=>{
  const e=r("n",25,{pruebaHasta:"2026-10-19"});
  const s=estado([e]);
  assert.equal(c.dayIn(e,10,2026),19);
  assert.equal(c.dayIn(e,11,2026),25,"el mes siguiente, su día de siempre");
  const {pack,v}=vista(s);
  assert.deepEqual(ids(v.review),["fixed_n:trial"]);
  assert.equal(v.review[0].dias,1);
  assert.deepEqual(JSON.parse(JSON.stringify(pack.pendingBills.map(x=>[x.id,x.day,x.overdue]))),[["fixed_n",19,false]]);
  assert.equal(c.fixedPaymentState(s,e,Y,M,HOY).day,19,"Inicio (próximos) lee este día");
  assert.deepEqual([...c.pendingWalkEvents(s,Y,M,HOY)].filter(x=>x.amt<0).map(x=>[x.day,x.amt]),[[19,-10]]);
  // El 21 aún dentro del margen; el 22, «No ha llegado».
  const en=d=>{ const p=c.planChargesMonth(s,M,Y,d),pr=c.paymentEvidenceUI(s,Y,M,d); return ids(c.planRecibosVista(p,pr,d,c.planRecibosAvisos(s,p,pr,Y,M,d),{}).review); };
  assert.deepEqual(en(21),[]);
  assert.deepEqual(en(22),["fixed_n:late"]);
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

/* Revisión de la 223, P2-1: el mes en que acaba la prueba, un adeudo SIN el nombre del recibo en su día
   de siempre no casaba (la ventana de ±4 días iba solo alrededor del fin de la prueba) y el recibo
   seguía en Pendiente: «¿Te llega?» lo restaba dos veces. Oráculo contado a mano: recibo del 25 de
   10 €, prueba hasta el 19, mirado el 27 → la ventana va del 15 (19−4) al 29 (25+4). */
const adeudo=(dia,p)=>Object.assign({id:"ref-"+dia,ent:"sabadell",date:"2026-10-"+String(dia).padStart(2,"0"),amount:10,merchant:"ACREEDOR SINTETICO SL",concept:"ADEUDO RECIBO SEPA",status:"BOOK"},p);
test("mes de fin de la prueba: el adeudo sin nombre casa en su día de siempre y en el de fin, no fuera",()=>{
  const e=r("n",25,{pruebaHasta:"2026-10-19"});
  const pagado=(dia,hoy,ex)=>c.fixedPaymentState(Object.assign(estado([e]),{bankTx:[adeudo(dia,ex)]}),e,Y,M,hoy||27).paid;
  const s=Object.assign(estado([e]),{bankTx:[adeudo(25)]});
  const st=c.fixedPaymentState(s,e,Y,M,27);
  assert.equal(st.paid,true,"cobrado el 25, su día de siempre");
  assert.equal(st.day,25,"el día del cargo");
  const pack=c.planChargesMonth(s,M,Y,27),pr=c.paymentEvidenceUI(s,Y,M,27);
  assert.deepEqual(JSON.parse(JSON.stringify(pack.paidBills.map(x=>x.id))),["fixed_n"]);
  assert.equal(pack.pendingBillsTotal,0,"ya no queda por pagar");
  assert.deepEqual(ids(c.planRecibosVista(pack,pr,27,c.planRecibosAvisos(s,pack,pr,Y,M,27),{}).review),[],"ni «No ha llegado»");
  // «¿Te llega?»: pagado, el saldo ya lo lleva; no se resta otra vez.
  assert.deepEqual([...c.pendingWalkEvents(s,Y,M,27)].filter(x=>x.amt<0&&!x.sinRestar).map(x=>[x.day,x.amt]),[],"«¿Te llega?» no lo resta otra vez");
  // Bordes de la ventana: del 15 al 29.
  assert.equal(pagado(19),true,"el día en que acaba la prueba");
  assert.equal(pagado(15),true);assert.equal(pagado(14),false,"cinco días antes del fin");
  assert.equal(pagado(29,30),true);assert.equal(pagado(30,30),false,"cinco días después de su día");
  // Sigue exigiendo el céntimo exacto y que sea un adeudo.
  assert.equal(pagado(25,27,{amount:10.01}),false);
  assert.equal(pagado(25,27,{concept:"TRANSFERENCIA"}),false);
  // El mes siguiente, la ventana de siempre: solo alrededor del 25.
  const nov=(dia)=>c.fixedPaymentState(Object.assign(estado([e]),{bankTx:[adeudo(dia,{date:"2026-11-"+String(dia).padStart(2,"0")})]}),e,Y,11,30).paid;
  assert.equal(nov(25),true);assert.equal(nov(19),false,"en noviembre el 19 queda a seis días");
});

test("al revés: la prueba acaba después de su día y el banco cobra en su día de siempre",()=>{
  const e=r("v",5,{pruebaHasta:"2026-10-20"});
  assert.equal(c.dayIn(e,10,2026),20);
  const s=Object.assign(estado([e]),{bankTx:[adeudo(5)]});
  // Mirado el 7: el cargo del 5 ya está en el banco, aunque la prueba acabe el 20.
  assert.equal(c.fixedPaymentState(s,e,Y,M,7).paid,true);
  // La ventana va del 1 (5−4) al 24 (20+4).
  assert.equal(c.fixedPaymentState(Object.assign(estado([e]),{bankTx:[adeudo(24)]}),e,Y,M,26).paid,true,"a cuatro del fin");
  assert.equal(c.fixedPaymentState(Object.assign(estado([e]),{bankTx:[adeudo(25)]}),e,Y,M,26).paid,false,"a cinco del fin");
  assert.equal(c.fixedPaymentState(Object.assign(estado([e]),{bankTx:[adeudo(5,{date:"2026-11-05"})]}),e,Y,11,7).paid,true,"en noviembre, su día de siempre");
  assert.equal(c.fixedPaymentState(Object.assign(estado([e]),{bankTx:[adeudo(20,{date:"2026-11-20"})]}),e,Y,11,22).paid,false,"en noviembre el 20 ya no es suyo");
});

test("cobró distinto el mes de fin de la prueba: también se pregunta si llega en su día de siempre",()=>{
  const e=r("d",25,{pruebaHasta:"2026-10-19"});
  const con=(dia)=>{
    const t=adeudo(dia,{id:"b"+dia,amount:10.06});
    return Object.assign(estado([e]),{bankTx:[t],expenses:[{id:"e"+dia,extId:t.id,ent:"sabadell",date:t.date+"T12:00:00.000Z",amount:10.06,merchant:t.merchant,obName:t.merchant,source:"ob",status:"BOOK",category:"otros"}]});
  };
  const x=c.fixedPaymentCobroDistinto(con(25),e,Y,M,27);
  assert.equal(x&&x.id,"e25","en su día de siempre");
  assert.equal(c.fixedPaymentCobroDistinto(con(14),e,Y,M,27),null,"cinco días antes del fin, no");
});
