#!/usr/bin/env node
/**
 * INFORME DEL MES CERRADO — tope superior de monthBudgetStats.
 *
 * El mes de Madrid acota también la llamada sin `hastaMs`; una ventana explícita
 * sin límite conserva la demostración histórica de agosto + septiembre.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import vm from "node:vm";
import { loadPureLogic } from "../scripts/load-pure-logic.mjs";

// No se prueba public/index.html: puede pertenecer a una compilación anterior al cambio.
const root=process.env.AELY_SOURCE_ROOT||path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
function source(file){
  if(!process.env.AELY_SOURCE_REF)return fs.readFileSync(path.join(root,file),"utf8");
  const r=spawnSync("git",["-C",root,"show",process.env.AELY_SOURCE_REF+":"+file],{encoding:"utf8",maxBuffer:16*1024*1024});
  assert.equal(r.status,0,"lectura de fuente inmutable: "+file);return r.stdout;
}
const order=JSON.parse(source("src/build-order.json"));
const js=order.map(file=>source("src/modules/"+file).replace(/\n?$/,"\n")).join("");
const parts=source("src/shell.html").split("<!--MC_APP_SCRIPT-->");
assert.equal(parts.length,2,"marcador único de la fuente real");
const html=parts[0]+js.trimEnd()+parts[1];
console.log("informe-mes sourceHTML SHA256="+createHash("sha256").update(html).digest("hex"));
const ctx = loadPureLogic(html);

function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}`); throw e; }
}

console.log("informe-mes");

const augMs = Date.parse("2026-08-15T12:00:00+02:00");
const sepStart = ctx.inicioDeMesMs(Date.parse("2026-09-05T12:00:00+02:00"));

t("★ criterio 3: un gasto del mes NUEVO no se cuela en el informe del mes cerrado", () => {
  const s = {
    budget: 500,
    expenses: [
      { date: "2026-08-10T12:00:00.000Z", amount: 40, category: "super" },
      { date: "2026-09-02T12:00:00.000Z", amount: 99, category: "super" },
    ],
  };
  // El default mensual cuenta sólo agosto; el escenario histórico sin tope es explícito.
  assert.equal(ctx.monthBudgetStats(s, augMs).spent, 40);
  assert.equal(ctx.monthBudgetStats(s, augMs, null, null,
    {startMs:ctx.inicioDeMesMs(augMs),todayEndMs:Infinity,cycle:null}).spent, 139);
  // Con hastaMs = inicio de septiembre: solo agosto.
  const cerrado = ctx.monthBudgetStats(s, augMs, sepStart);
  assert.equal(cerrado.spent, 40, "septiembre no puede entrar en el informe de agosto");
  assert.equal(cerrado.against, 40);
});

t("sin hastaMs (llamada de hoy) sigue sumando desde el día 1 en adelante", () => {
  const nowMs = Date.parse("2026-09-05T12:00:00+02:00");
  const s = {
    budget: 500,
    expenses: [
      { date: "2026-09-02T12:00:00.000Z", amount: 25, category: "super" },
      { date: "2026-08-10T12:00:00.000Z", amount: 40, category: "super" },
    ],
  };
  const bs = ctx.monthBudgetStats(s, nowMs);
  assert.equal(bs.spent, 25);
});

t("tarjeta: sale los primeros días con cifras del mes cerrado; dismiss no vuelve", () => {
  const sep2 = Date.parse("2026-09-02T12:00:00+02:00");
  const sep20 = Date.parse("2026-09-20T12:00:00+02:00");
  const s = {
    budget: 500,
    expenses: [
      { date: "2026-08-10T12:00:00.000Z", amount: 40, category: "super" },
      { date: "2026-08-12T12:00:00.000Z", amount: -100, category: "ingreso" },
      { date: "2026-09-02T12:00:00.000Z", amount: 99, category: "super" },
    ],
  };
  const card = ctx.closedMonthCardOf(s, sep2);
  assert.ok(card, "debe salir el día 2");
  assert.equal(card.ym, "2026-08");
  assert.equal(card.stats.spent, 40);
  assert.ok(card.stats.spent !== 139);
  assert.equal(ctx.closedMonthCardOf(s, sep20), null, "pasados los primeros días no sale");
  const gone = ctx.dismissClosedMonthCard(s, "2026-08");
  assert.equal(ctx.closedMonthCardOf(gone, sep2), null, "tras descartar no vuelve");
});

t("mes sin movimientos: no sale la tarjeta", () => {
  const sep2 = Date.parse("2026-09-02T12:00:00+02:00");
  const s = { budget: 500, expenses: [{ date: "2026-09-01T12:00:00.000Z", amount: 10, category: "super" }] };
  assert.equal(ctx.closedMonthCardOf(s, sep2), null);
});

const cents=x=>x==null?null:Math.round(x*100);
const now=Date.parse("2026-11-02T10:00:00Z");
function fixture(){
  return {budget:900,budgetByMonth:{"2026-10":500.25},
    settings:{gTotalMode:"split",expenseBanks:["sabadell"]},
    accounts:[{ent:"sabadell",role:"diario",spendFrom:true},{ent:"revolut",role:"fijos"}],
    expenses:[
      {id:"g",date:"2026-10-10T12:00:00Z",amount:420.10,category:"super",ent:"sabadell"},
      {id:"b",date:"2026-10-12T12:00:00Z",amount:-60.05,merchant:"Bizum recibido",category:"bizum",ent:"sabadell"},
      {id:"n",date:"2026-10-28T12:00:00Z",amount:-2100,merchant:"Nómina sintética",category:"ingreso",ent:"sabadell"},
      {id:"otro",date:"2026-10-12T12:00:00Z",amount:999,category:"super",ent:"revolut"},
      {id:"nuevo",date:"2026-11-01T12:00:00Z",amount:99,category:"super",ent:"sabadell"}],
    reservaLog:[{date:"2026-10-20T12:00:00Z",amount:20.02},{date:"2026-11-01T12:00:00Z",amount:99}]};
}
function clock(ms,fn){
  const RealDate=ctx.Date;
  ctx.Date=class extends RealDate { constructor(...a){super(...(a.length?a:[ms]));} static now(){return ms;} };
  try{return fn();}finally{ctx.Date=RealDate;}
}
function canvasTexts(s,opt){
  const document=ctx.document,lines=[],errors=[];
  const g=new Proxy({createLinearGradient:()=>({addColorStop(){}}),fillText:text=>lines.push(String(text))},
    {get:(target,k)=>k in target?target[k]:()=>{}});
  ctx.document={...document,createElement:tag=>{assert.equal(tag,"canvas");return {getContext:()=>g,toBlob(){}};}};
  try{ctx.shareMonthReport(s,{netWorth:0},msg=>errors.push(msg),opt);}finally{ctx.document=document;}
  assert.deepEqual(errors,[],"la imagen no oculta una excepción en un toast");
  return lines;
}
function report(s,ms=now){const card=ctx.closedMonthCardOf(s,ms);assert.ok(card);return card;}
function rendered(s,ms=now){const c=report(s,ms);return clock(ms,()=>canvasTexts(s,{startMs:c.startMs,endMs:c.endMs,ym:c.ym}));}

t("límite histórico: 500,25 − 20,02; ingreso sin nómina y céntimos, aunque hoy cambie",()=>{
  for(const budget of [900,1200,0]){
    const s={...fixture(),budget},before=JSON.stringify(s),c=report(s),b=c.stats;
    assert.equal(c.ym,"2026-10");
    assert.equal(cents(b.spent),42010); assert.equal(cents(b.income),216005);
    assert.equal(cents(b.nomina),210000); assert.equal(cents(b.reserved),2002);
    assert.equal(cents(b.budget),48023); assert.equal(cents(b.against),36005);
    assert.equal(cents(b.remaining),12018); assert.equal(cents(c.saved),173995);
    assert.equal(b.budgetReason,""); assert.equal(cents(b.shown),42010);
    assert.equal(c.topCat.id,"super"); assert.equal(cents(c.topCat.amount),42010);
    const text=rendered(s).join(" ").replace(/\s/g," ");
    assert.match(text,/480 €.*75%/); assert.doesNotMatch(text,/900 €|1\.200 €/);
    assert.equal(JSON.stringify(s),before,"sin escribir ni rellenar fotos");
  }
});

t("ausencia, cero e inválido conservan sus motivos sin fallback; decimales heredados",()=>{
  const cases=[
    [undefined,"mr_budget_missing"],[null,"mr_budget_missing"],[0,"mr_budget_none"],["0.00","mr_budget_none"],
    [-1,"mr_budget_invalid"],["no","mr_budget_invalid"],["","mr_budget_invalid"],["  ","mr_budget_invalid"],
    ["0x10","mr_budget_invalid"],["1e2","mr_budget_invalid"],[" 500.25 ","mr_budget_invalid"],
    [NaN,"mr_budget_invalid"],[Infinity,"mr_budget_invalid"],[true,"mr_budget_invalid"],[[],"mr_budget_invalid"],[{},"mr_budget_invalid"]];
  for(const [value,reason] of cases){
    const s=fixture(); if(value===undefined)delete s.budgetByMonth;else s.budgetByMonth["2026-10"]=value;
    const before=JSON.stringify(s),b=report(s).stats;
    assert.equal(b.budget,null,String(value));assert.equal(b.remaining,null);assert.equal(b.budgetReason,reason);
    assert.equal(cents(b.against),36005);assert.equal(cents(b.income),216005);
    const texts=rendered(s); assert.ok(texts.includes(({mr_budget_missing:"Límite de este mes no guardado",mr_budget_none:"Este mes no tenía límite configurado",mr_budget_invalid:"Límite de este mes no disponible"})[reason]));
    assert.doesNotMatch(texts.join(" "),/\d+%|NaN|Infinity/);assert.equal(JSON.stringify(s),before);
  }
  for(const value of [500.25,"500.25","500.250","0500.25"]){
    const s=fixture();s.budgetByMonth["2026-10"]=value;assert.equal(cents(report(s).stats.budget),48023);
  }
  const s=fixture();s.budgetByMonth={"2025-10":500.25};assert.equal(report(s).stats.budgetReason,"mr_budget_missing");
});

t("una foto positiva agotada por reserva es budget0 legítimo, distinta de la foto0",()=>{
  for(const reserve of [20.02,30.03]){
    const s=fixture();s.budgetByMonth["2026-10"]=20.02;s.reservaLog=[{date:"2026-10-20T12:00:00Z",amount:reserve}];
    const b=report(s).stats;assert.equal(b.budget,0);assert.equal(cents(b.remaining),-36005);assert.equal(b.budgetReason,"");
    assert.doesNotMatch(rendered(s).join(" "),/\d+%|NaN|Infinity|no guardado|no disponible|sin límite/);
  }
});

t("Madrid selecciona año y mes reales al cruzar enero y horario de verano",()=>{
  for(const iso of ["2026-12-31T23:30:00Z","2027-01-02T10:00:00Z"]){
    const s=fixture();s.budgetByMonth={"2025-12":100,"2026-12":500.25,"2027-01":900};
    s.expenses=s.expenses.map(e=>({...e,date:e.date.replace("2026-10","2026-12").replace("2026-11","2027-01")}));
    s.reservaLog=s.reservaLog.map(e=>({...e,date:e.date.replace("2026-10","2026-12").replace("2026-11","2027-01")}));
    const c=report(s,Date.parse(iso));assert.equal(c.ym,"2026-12");assert.equal(c.year,2026);assert.equal(c.month,11);
    assert.equal(cents(c.stats.budget),48023);assert.equal(cents(c.stats.against),36005);
    assert.match(rendered(s,Date.parse(iso)).join(" "),/Diciembre 2026/);
  }
  const c=report(fixture(),Date.parse("2026-11-01T00:30:00Z"));assert.equal(c.ym,"2026-10");assert.equal(cents(c.stats.budget),48023);
});

t("nóminas, devoluciones y modos conservan importe mostrado y ahorro, sin inflar margen",()=>{
  const s=fixture();s.settings.gTotalMode="net";
  let b=report(s).stats;assert.equal(cents(b.shown),173995);assert.equal(cents(b.against),36005);
  s.expenses=s.expenses.filter(e=>e.id!=="n");b=report(s).stats;
  assert.equal(b.nomina,0);assert.equal(cents(b.against),36005);assert.equal(cents(b.remaining),12018);
  s.expenses.push({id:"n2",date:"2026-10-01T12:00:00Z",amount:-700,merchant:"SALARIO",category:"ingreso",ent:"sabadell"},
    {id:"n3",date:"2026-10-28T12:00:00Z",amount:-2100,merchant:"Nómina",category:"ingreso",ent:"sabadell"});
  b=report(s).stats;assert.equal(cents(b.nomina),280000);assert.equal(cents(b.against),36005);
  s.expenses.push({id:"refund",date:"2026-10-20T12:00:00Z",amount:-500.01,merchant:"Devolución",category:"ingreso",ent:"sabadell"});
  b=report(s).stats;assert.equal(b.against,0);assert.equal(cents(b.remaining),48023);
});

t("el reporte de Ajustes conserva el límite actual y el mismo canvas sin opt",()=>{
  clock(now,()=>{
    const s=fixture(),original=canvasTexts(s),withoutHistory=canvasTexts({...s,budgetByMonth:undefined});
    assert.deepEqual(original,withoutHistory);
    assert.match(original.join(" ").replace(/\s/g," "),/801 €/); // 900 menos reserva99 de noviembre
  });
});

t("los tres motivos existen y se traducen en es/en/ca",()=>{
  const expected={
    es:["Límite de este mes no guardado","Este mes no tenía límite configurado","Límite de este mes no disponible"],
    en:["This month's limit was not saved","No limit was set for this month","This month's limit is unavailable"],
    ca:["Límit d'aquest mes no desat","Aquest mes no tenia cap límit configurat","Límit d'aquest mes no disponible"]};
  const previous=vm.runInContext("CURLANG",ctx);
  try{for(const lang of Object.keys(expected)){
    const actual=vm.runInContext("CURLANG="+JSON.stringify(lang)+"; ['mr_budget_missing','mr_budget_none','mr_budget_invalid'].map(k=>t(k))",ctx);
    assert.deepEqual(Array.from(actual),expected[lang]);
  }}finally{vm.runInContext("CURLANG="+JSON.stringify(previous),ctx);}
});

console.log("\ninforme-mes: OK");
