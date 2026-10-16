import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { loadPureLogicFromFile, loadPureLogic } from "../scripts/load-pure-logic.mjs";

const c=loadPureLogicFromFile(), cents=v=>Math.round(v*100);
const debts=[
  {id:"roomba",name:"Roomba sintética",value:600.03,monthly:50.01,months:12,day:16,asOf:2026*12+9},
  {id:"gym",name:"Gimnasio sintético",value:360.09,monthly:30.01,months:12,day:20,asOf:2026*12+10},
  {id:"floor",name:"Suelo sintético",value:1200.07,monthly:100.01,months:12,day:25,asOf:2026*12+11},
];
const fixture=ds=>({accounts:[{id:"cash",ent:"efectivo",value:5000.13,role:"fijos"}],expenses:[],investments:[],assets:[],debts:ds,
  accountBalanceHistory:{"acc:cash":[{day:"2026-09-30",value:5000.13}]}});

for(const [i,d] of debts.entries()) test(d.name+": antes, inicio, cuota y después",()=>{
  const m=10+i,begin=`2026-${m}-01`,before=i?`2026-${m-1}-${m===11?31:30}`:"2026-09-30";
  const policy=c.netWorthDebtPolicy({debts:[d]},`2026-${m}-28`);
  assert.equal(cents(policy.at(before)),0,"antes del mes de inicio aún no existe");
  assert.equal(cents(policy.at(begin)),cents(d.value),"desde el inicio, antes de la cuota, debe el principal");
  assert.equal(cents(policy.at(`2026-${m}-${d.day-1}`)),cents(d.value));
  assert.equal(cents(policy.at(`2026-${m}-${d.day}`)),cents(d.value-d.monthly));
  assert.equal(cents(policy.at(`2026-${m}-${d.day+1}`)),cents(d.value-d.monthly));
  assert.equal(cents(policy.current),cents(d.value-d.monthly));
});

test("serie completa: altas sucesivas sin cambiar céntimos actuales ni estado",()=>{
  const state=fixture(debts),saved=JSON.stringify(state);
  // A 26/12: tres cuotas Roomba, dos gimnasio y una suelo.
  const current=1850.13,series=c.netWorthSeries(state,{today:"2026-12-26",liquid:5000.13,invested:0,debtTotal:current});
  const at=day=>cents(series.find(p=>p.day===day).value);
  assert.equal(at("2026-09-30"),500013);
  assert.equal(at("2026-10-01"),440010);
  assert.equal(at("2026-10-16"),445011);
  assert.equal(at("2026-11-01"),409002);
  assert.equal(at("2026-12-01"),296997);
  assert.equal(at("2026-12-26"),315000);
  assert.equal(cents(c.netWorthDebtPolicy(state,"2026-12-26").current),185013);
  assert.equal(JSON.stringify(state),saved,"mirar la gráfica no cambia deuda ni anclas");
});

test("medianoche Madrid al entrar al mes, invierno y verano",()=>{
  for(const [before,on,month] of [["2026-09-30T21:59:59.999Z","2026-09-30T22:00:00.000Z",9],["2026-11-30T22:59:59.999Z","2026-11-30T23:00:00.000Z",11]]){
    const d={...debts[0],asOf:2026*12+month};
    assert.equal(cents(c.netWorthDebtPolicy({debts:[d]},c.netWorthDay(Date.parse(before))).current),0);
    assert.equal(cents(c.netWorthDebtPolicy({debts:[d]},c.netWorthDay(Date.parse(on))).current),60003);
  }
});

test("hipoteca y referencia de alta no se convierten en nacimiento",()=>{
  const d={id:"mortgage",value:5000.07,monthly:100.01,day:1,asOf:2026*12+9,asOfDate:"2026-10-01"};
  assert.equal(cents(c.netWorthDebtPolicy({debts:[d]},"2026-10-16").at("2026-09-30")),510008);
  assert.equal(cents(c.netWorthDebtPolicy({debts:[{...d,months:12,asOf:undefined}]},"2026-10-16").at("2026-09-30")),500007,"sin ancla no se inventa fecha");
  assert.equal(cents(c.netWorthDebtPolicy({debts:[{...debts[0],asOfDate:"2026-10-20"}]},"2026-10-28").at("2026-10-01")),60003,"asOfDate es referencia, no fecha de compra");
});

test("saldo actual suministrado conserva contrato de Inicio",()=>{
  const p=c.netWorthDebtPolicy({debts},"2026-12-26",1900.17);
  assert.equal(cents(p.current),190017);
  assert.equal(cents(p.at("2026-12-26")),190017);
});

test("pago final y financiación archivada conservan su historia desde el inicio",()=>{
  const d={...debts[0],months:2,balloon:500.01,amort:50.01,archivedAt:"2026-12-01T12:00:00Z"};
  const p=c.netWorthDebtPolicy({debts:[d]},"2026-12-26");
  assert.equal(cents(p.at("2026-09-30")),0);
  assert.equal(cents(p.at("2026-10-01")),60003);
  assert.equal(cents(p.at("2026-11-15")),55002);
  assert.equal(cents(p.at("2026-11-16")),0);
});

const guard='if(d.months!=null&&typeof d.asOf==="number"&&p[0]*12+p[1]-1<anchor) return 0;';
const html=fs.readFileSync(new URL("../public/index.html",import.meta.url),"utf8").replace(/\r\n/g,"\n");
const money=(m,d,day,today="2026-10-28")=>cents(m.netWorthDebtPolicy({debts:[d]},today).at(day));
const mutations=[
  ["sin guarda",guard,"",m=>assert.equal(money(m,debts[0],"2026-09-30"),0)],
  ["excluye mes inicial",guard,guard.replace("<anchor","<=anchor"),m=>assert.equal(money(m,debts[0],"2026-10-01"),60003)],
  ["mes desplazado",guard,guard.replace("p[1]-1","p[1]"),m=>assert.equal(money(m,debts[0],"2026-09-30"),0)],
  ["aplica a hipoteca",guard,guard.replace("d.months!=null&&",""),m=>assert.equal(money(m,{...debts[0],months:undefined},"2026-09-30"),65004)],
  ["inventa ancla legado",guard,guard.replace('typeof d.asOf==="number"&&',""),m=>assert.equal(money(m,{...debts[0],asOf:undefined},"2026-09-30"),60003)],
  ["cuota confundida con inicio",guard,guard+'\n    if(d.months!=null&&p[0]*12+p[1]-1===anchor&&p[2]<charge) return 0;',m=>assert.equal(money(m,debts[0],"2026-10-01"),60003)],
  ["referencia confundida con nacimiento",guard,guard+'\n    if(day<(d.asOfDate||"")) return 0;',m=>assert.equal(money(m,{...debts[0],asOfDate:"2026-10-20"},"2026-10-01"),60003)],
  ["hoy deja de ser saldo suministrado","const value=current!=null?current:sum(today);","const value=sum(today);",m=>assert.equal(cents(m.netWorthDebtPolicy({debts},"2026-12-26",1900.17).current),190017)],
  ["medianoche UTC","timeZone:\"Europe/Madrid\",year:\"numeric\",month:\"2-digit\",day:\"2-digit\"","timeZone:\"UTC\",year:\"numeric\",month:\"2-digit\",day:\"2-digit\"",m=>assert.equal(m.netWorthDay(Date.parse("2026-09-30T22:00:00Z")),"2026-10-01")],
];
for(const [name,from,to,check] of mutations) test("mutación semántica: "+name,()=>{
  assert.ok(html.includes(from),"existe el punto de mutación");
  check(c);
  assert.throws(()=>check(loadPureLogic(html.replaceAll(from,to))),assert.AssertionError,"el oráculo mata el mutante");
});
