#!/usr/bin/env node
/** Ejecuta el handler REAL de ingest contra una BD en memoria: identidad, ACK y deduplicación. */
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { transformSync } from "esbuild";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

import {root,read,mod,logic,wallet,identity,budget,widgetBudget,entrada,handlerJs,fakeDb,makeHandler,post} from "./helpers/ingest-handler-fixture.mjs";

let failures = 0;
async function t(name, fn) {
  try { await fn(); console.log("  ✓ " + name); }
  catch (e) { failures++; console.error("  ✗ " + name + "\n      " + e.stack); }
}
console.log("ingest-handler");

const denoCases=[];
const widgetTest=read('supabase/functions/ingest/widget.test.ts').replace(/^import\s[\s\S]*?from\s+"[^"]+";\r?\n/gm,'');
// Todo lo que `widget.test.ts` importa de `presupuesto.ts` tiene que llegar aquí: con la lista a
// mano, los casos del ordinal y del cargo de recibo fallaban por un nombre sin definir (13/10).
const dePresupuesto=['bancoDeSource','claveComoLaApp','cuentaParaPresupuesto','esCargoDeRecibo','filasComoLaApp','inicioDeMesMs','ordinalDeSource'];
new Function('Deno','assertEquals','widgetSnapshot','widgetStart','readWidgetRows',...dePresupuesto,transformSync(widgetTest,{loader:'ts'}).code)(
  {test:(name,fn)=>denoCases.push([name,fn])},assert.deepEqual,widgetBudget.widgetSnapshot,widgetBudget.widgetStart,widgetBudget.readWidgetRows,...dePresupuesto.map(n=>budget[n]));
for(const [name,fn] of denoCases) await t('Node ejecuta cuerpo Deno: '+name,fn);

await t("respuesta dual: month legado intacto y widget v2 bruto para la misma compra", async () => {
  const now=Date.now(), start=budget.inicioDeMesMs(now);
  const state={budget:100,accounts:[{ent:'trade_republic',role:'diario',spendFrom:true}],settings:{gTotalMode:'net'},
    widgetPeriod:{v:2,kind:'mes',start,anchor:'',scope:JSON.stringify([2,start,'mes','gasto','',100,['trade_republic'],'trade_republic'])}};
  const env=fakeDb({state,rows:[{id:'income',user_id:'user',fecha:new Date(now-1000).toISOString(),importe:-20,cat:'ingreso',source:'macrodroid',comercio:'Abono'}]});
  const r=await post(env,{fuente:'tr',titulo:'Trade Republic',texto:'Has gastado 5,45 € en Compra sintetica',fecha:String(now),evento:'dual'});
  assert.equal(r.data.month.spent,14.55); assert.equal(r.data.month.contract,undefined);
  assert.equal(r.data.widget.spent,5.45); assert.equal(r.data.widget.shownDelta,5.45);
  assert.equal(r.data.widget.scope,state.widgetPeriod.scope); assert.equal(r.data.widget.contract,2);
});

await t("servidor v2 no repite un scope si cambiaron las reservas", async () => {
  const now=Date.now(),start=budget.inicioDeMesMs(now);
  const state={budget:100,accounts:[{ent:'trade_republic',role:'diario',spendFrom:true}],settings:{},
    reservaLog:[{date:new Date(now).toISOString(),amount:10}],
    widgetPeriod:{v:2,kind:'mes',start,anchor:'',scope:JSON.stringify([2,start,'mes','gasto','',100,['trade_republic'],'trade_republic'])}};
  const r=await post(fakeDb({state}),{fuente:'tr',titulo:'Trade Republic',texto:'Has gastado 5,45 € en Compra sintetica',fecha:String(now),evento:'changed'});
  assert.equal(r.data.widget,null); assert.ok(r.data.month);
});

await t("un error del widget opcional conserva el aviso y month para APK anteriores", async () => {
  const now=Date.now(),start=budget.inicioDeMesMs(now),state={budget:100,
    accounts:[{ent:'trade_republic',role:'diario',spendFrom:true}],settings:{},
    widgetPeriod:{v:2,kind:'mes',start,anchor:'',scope:JSON.stringify([2,start,'mes','gasto','',100,['trade_republic'],'trade_republic'])}};
  const r=await post(fakeDb({state,widgetThrows:true,rows:[{id:'before',user_id:'user',fecha:new Date(now-1000).toISOString(),
    importe:90,cat:'super',source:'macrodroid',comercio:'Compra anterior'}]}),
    {fuente:'tr',titulo:'Trade Republic',texto:'Has gastado 20,00 € en Compra sintética',fecha:String(now),evento:'widget-error'});
  assert.equal(r.status,200);assert.equal(r.data.widget,null);
  assert.equal(r.data.month.spent,110);assert.equal(r.data.alert.kind,'over');
  assert.equal(r.data.alert.monthSpent,110);assert.equal(r.data.alert.budget,100);
});

await t("v2 pagina más de mil filas; una lectura parcial o sin conteo no confirma cero", async () => {
  const now=Date.now(),start=budget.inicioDeMesMs(now),state={budget:3000,
    accounts:[{ent:'trade_republic',role:'diario',spendFrom:true}],settings:{},
    widgetPeriod:{v:2,kind:'mes',start,anchor:'',scope:JSON.stringify([2,start,'mes','gasto','',3000,['trade_republic'],'trade_republic'])}};
  const rows=Array.from({length:1005},(_,i)=>({id:'synthetic-'+i,user_id:'user',fecha:new Date(now-1000).toISOString(),
    importe:1,cat:'super',source:'macrodroid',comercio:'Compra '+i}));
  const body={fuente:'tr',titulo:'Trade Republic',texto:'Has gastado 5,45 € en Compra actual',fecha:String(now),evento:'pagination'};
  const all=await post(fakeDb({state,rows,rowLimit:1000}),body);
  assert.equal(all.data.widget.spent,1010.45); assert.equal(all.data.widget.shownDelta,5.45);
  for(const opts of [{widgetTruncated:true},{widgetCountMissing:true},{widgetReadError:true}]) {
    const partial=await post(fakeDb({state,rows,...opts}),body);
    assert.equal(partial.data.widget,null); assert.ok(partial.data.month,'month legacy sigue su camino propio');
  }
});

await t("ciclo que cruza el mes relee el ancla anterior sin cambiar month legado", async () => {
  const now=Date.now(), start=budget.inicioDeMesMs(now)-3*86400000;
  const payday={id:'salary',user_id:'user',fecha:new Date(start+10*3600000).toISOString(),importe:-1000,cat:'ingreso',source:'ob:sabadell',comercio:'NOMINA'};
  const anchor=budget.claveComoLaApp(payday);
  const state={budget:100,accounts:[{ent:'trade_republic',role:'diario',spendFrom:true},{ent:'sabadell',role:'fijos'}],settings:{budgetCycle:true},
    widgetPeriod:{v:2,kind:'ciclo',start,anchor,scope:JSON.stringify([2,start,'ciclo','neto',anchor,100,['trade_republic'],'trade_republic'])}};
  const env=fakeDb({state,rows:[payday,{id:'return',user_id:'user',fecha:new Date(now-1000).toISOString(),importe:-20,cat:'ingreso',source:'ob:sabadell',comercio:'Abono'}]});
  const r=await post(env,{fuente:'tr',titulo:'Trade Republic',texto:'Has gastado 5,45 € en Compra sintetica',fecha:String(now),evento:'cycle-dual'});
  assert.equal(r.data.month.spent,5.45); assert.equal(r.data.widget.spent,-14.55);
  assert.equal(r.data.widget.periodStart,start); assert.equal(r.data.widget.shownDelta,5.45);
});

await t("mismas filas: servidor v2 y Inicio comparten Mes bruto / Mi ciclo neto", () => {
  const cli=loadPureLogicFromFile(),now=Date.parse('2026-10-10T12:00:00Z');
  const RealDate=cli.Date; cli.Date=class extends RealDate {static now(){return now;}};
  try {
    const rows=[{id:'before',fecha:'2026-10-02T10:00:00Z',importe:30,cat:'super',source:'macrodroid',comercio:'Compra'},
      {id:'salary',fecha:'2026-10-05T10:00:00Z',importe:-1000,cat:'ingreso',source:'ob:sabadell',comercio:'NOMINA'},
      {id:'pay',fecha:'2026-10-10T10:00:00Z',importe:5.45,cat:'super',source:'macrodroid',comercio:'Compra actual'},
      {id:'return',fecha:'2026-10-09T10:00:00Z',importe:-20,cat:'ingreso',source:'ob:sabadell',comercio:'Abono'}];
    for(const cycle of [false,true]) {
      const state={budget:100,accounts:[{ent:'trade_republic',role:'diario',spendFrom:true},{ent:'sabadell',role:'fijos'}],settings:{budgetCycle:cycle},expenses:rows.map(cli.expenseFromRow)};
      const stats=cli.dashboardBudgetStats(state),anchor=cycle?cli.keyOfExpense(cli.budgetPaydayOf(state,now).inc):'';
      state.widgetPeriod={v:2,kind:cycle?'ciclo':'mes',start:stats.periodStart,anchor,scope:cli.widgetScopeOf(state,stats,anchor,'trade_republic')};
      const server=widgetBudget.widgetSnapshot(state,rows,now,{id:'pay',event:'synthetic',key:'key'});
      assert.ok(server); assert.equal(server.spent,+(cycle?stats.against:stats.shown).toFixed(2));
      assert.equal(server.budget,stats.budget); assert.equal(server.budgetLeft,+Math.max(0,stats.remaining).toFixed(2));
    }
  } finally {cli.Date=RealDate;}
});

await t("retry del mismo evento 35 min después: una fila y segundo ACK silencioso", async () => {
  const env = fakeDb();
  const body = { fuente: "tr", titulo: "Trade Republic", texto: "Has gastado 9,95 € en Pans & Company",
    fecha: String(Date.parse("2026-09-17T14:24:00+02:00")), evento: "v1_same" };
  const a = await post(env, body), b = await post(env, body);
  assert.equal(a.data.skipped, undefined); assert.ok(a.data.ack);
  assert.ok(a.data.month?.periodStart > 0 && a.data.month?.readAt > 0,
    "la respuesta lleva período y fecha de lectura para arbitrar el widget");
  assert.equal(a.data.month?.cashCounts, 1, "un gasto confirmado mueve el efectivo de TR");
  assert.equal(a.data.month?.eventKey, "tr:trade_republic:v1_same");
  assert.equal(a.data.month?.shownDelta, 9.95);
  assert.equal(a.data.month?.againstDelta, 9.95);
  assert.equal(a.data.month?.expenseKey, "2026-09-17%7C9.95%7CPans%20%26%20Company");
  assert.equal(b.data.skipped, true); assert.equal(b.data.ack, a.data.ack);
  assert.equal(env.rows.length, 1);
});

await t("si falla la lectura mensual, conserva el gasto y no fabrica un total cero", async () => {
  const env = fakeDb({ monthReadError: true });
  const r = await post(env, { fuente: "tr", titulo: "Trade Republic", texto: "Has gastado 9,95 € en Pans & Company",
    fecha: String(Date.parse("2026-09-17T14:24:00+02:00")), evento: "v1_read_fail" });
  assert.equal(r.status, 200); assert.equal(env.rows.length, 1); assert.equal(r.data.month, null);
});

await t("carrera SELECT/UNIQUE 23505 recupera el ACK y no confirma otra fila", async () => {
  const key = "tr:trade_republic:v1_race";
  const env = fakeDb({ race23505: true, raceKey: key, raceDate: "2026-09-17T12:24:00.000Z" });
  const r = await post(env, { fuente: "tr", titulo: "Trade Republic",
    texto: "Has gastado 9,95 € en Pans & Company", fecha: String(Date.parse("2026-09-17T14:24:00+02:00")), evento: "v1_race" });
  assert.equal(r.data.skipped, true); assert.equal(r.data.ack, "race-ack"); assert.equal(env.rows.length, 1);
});

await t("sin migración conserva la segunda compra legacy fuera de cifras, nunca la borra", async () => {
  const env = fakeDb({ columnMissing: true });
  const base = { fuente: "tr", titulo: "Trade Republic", texto: "Has gastado 9,95 € en Pans & Company" };
  const a = await post(env, { ...base, fecha: String(Date.parse("2026-09-17T14:24:00+02:00")), evento: "v1_a" });
  const b = await post(env, { ...base, fecha: String(Date.parse("2026-09-17T14:29:00+02:00")), evento: "v1_b" });
  assert.equal(a.status, 200); assert.equal(b.data.skipped, true); assert.equal(env.rows.length, 2);
  assert.equal(b.data.possibleDup, true);
  assert.equal(env.rows.filter((r) => r.source === "macrodroid").length, 1);
  assert.equal(env.rows.filter((r) => String(r.source).endsWith("#dup")).length, 1);
});

await t("caso real Consum Wallet + CONSUM CHARTER TR: una sola compra cuenta y un solo aviso confirma", async () => {
  const env = fakeDb();
  const wallet = await post(env, { fuente: "wallet", titulo: "Consum",
    texto: "15,02 € con Trade Republic Visa Card ••9116",
    fecha: String(Date.parse("2026-09-23T15:21:06.996+02:00")), evento: "v1_consum_wallet" });
  const tr = await post(env, { fuente: "tr", titulo: "Trade Republic",
    texto: "Has gastado 15,02 € en CONSUM CHARTER",
    fecha: String(Date.parse("2026-09-23T15:21:16.886+02:00")), evento: "v1_consum_tr" });
  assert.equal(wallet.data.skipped, undefined);
  assert.equal(tr.data.skipped, true, "el APK anterior no debe enseñar otro Gasto apuntado");
  assert.equal(tr.data.possibleDup, undefined, "un pago notificado no pide revisión manual");
  assert.equal(env.rows.length, 1, "TR y Wallet describen el mismo pago, no dos gastos");
  assert.equal(env.rows[0].source, "macrodroid");
});

await t("la comprobación posterior al INSERT cierra la carrera aunque el SELECT previo no viera Consum", async () => {
  const env = fakeDb({
    hideEventPrecheckOnce: true,
    insertCreatedAt: "2026-09-23T13:21:18.119320Z",
    rows: [{ id: "consum-wallet", user_id: "user", fecha: "2026-09-23T13:21:06.996Z",
      importe: 15.02, comercio: "Consum", source: "macrodroid", cat: "super", no_card: false,
      created_at: "2026-09-23T13:21:18.085911Z",
      ingest_event_id: "wallet:trade_republic:v1_consum_wallet" }],
  });
  const tr = await post(env, { fuente: "tr", titulo: "Trade Republic",
    texto: "Has gastado 15,02 € en CONSUM CHARTER",
    fecha: String(Date.parse("2026-09-23T15:21:16.886+02:00")), evento: "v1_consum_tr" });
  assert.equal(tr.data.skipped, true);
  assert.equal(tr.data.possibleDup, undefined);
  assert.equal(env.rows.find((r) => r.comercio === "Consum").source, "macrodroid");
  assert.equal(env.rows.some((r) => r.comercio === "CONSUM CHARTER"), false,
    "la fila posterior se retira al cerrar la carrera");
});

await t("un movimiento Open Banking parecido no bloquea una compra de notificación", async () => {
  const env = fakeDb({ rows: [{ id: "ob", user_id: "user", fecha: "2026-09-23T13:21:06.996Z",
    importe: 15.02, comercio: "Movimiento", source: "ob:trade_republic", cat: "super", no_card: false,
    created_at: "2026-09-23T13:21:10.000Z" }] });
  const r = await post(env, { fuente: "tr", titulo: "Trade Republic",
    texto: "Has gastado 15,02 € en CONSUM CHARTER",
    fecha: String(Date.parse("2026-09-23T15:21:16.886+02:00")) });
  assert.equal(r.data.skipped, undefined);
  assert.equal(r.data.possibleDup, undefined);
  assert.equal(env.rows.find((x) => x.comercio === "CONSUM CHARTER").source, "macrodroid");
});

await t("si falla liberar una compra, no se cuenta a ciegas ni se pide resolver un duplicado", async () => {
  const env = fakeDb({ updateError: true });
  const r = await post(env, { fuente: "wallet", titulo: "Consum",
    texto: "15,02 € con Trade Republic Visa Card ••9116",
    fecha: String(Date.parse("2026-09-23T15:21:06.996+02:00")) });
  assert.equal(r.data.skipped, true);
  assert.equal(r.data.possibleDup, undefined);
  assert.equal(r.data.deferred, true);
  assert.equal(env.rows[0].source, "ob:trade_republic#dup");
  assert.ok(env.events.some((e) => String(e.message).includes("queda pendiente")));
});

await t("Pans TR + alias Wallet 35m: un gasto; el 3,00 real entra aparte", async () => {
  const env = fakeDb();
  await post(env, { fuente: "tr", titulo: "Trade Republic", texto: "Has gastado 9,95 € en Pans & Company",
    fecha: String(Date.parse("2026-09-17T14:24:00+02:00")), evento: "v1_pans" });
  const alias = await post(env, { fuente: "wallet", titulo: "271 - PC RSC SANT CUGAT",
    texto: "9,95 € con Trade Republic Visa Card ••9116",
    fecha: String(Date.parse("2026-09-17T14:59:00+02:00")), evento: "v1_alias" });
  const real = await post(env, { fuente: "tr", titulo: "Trade Republic", texto: "Has gastado 3,00 € en Otro comercio",
    fecha: String(Date.parse("2026-09-17T14:59:00+02:00")), evento: "v1_three" });
  assert.equal(alias.data.skipped, true); assert.equal(alias.data.possibleDup, undefined);
  assert.equal(real.data.skipped, undefined); assert.equal(real.data.possibleDup, undefined);
  assert.equal(env.rows.length, 2);
  assert.equal(env.rows.some((r) => r.comercio.includes("271 - PC")), false);
  assert.equal(env.rows.find((r) => Number(r.importe) === 3).source, "macrodroid");
});

await t("si falla retirar el gemelo actual, queda fuera de cifras y sin pedir una decisión", async () => {
  const env = fakeDb({ deleteError: true, hideEventPrecheckOnce: true,
    insertCreatedAt: "2026-09-23T13:21:18.119320Z",
    rows: [{ id: "consum-wallet", user_id: "user", fecha: "2026-09-23T13:21:06.996Z",
      importe: 15.02, comercio: "Consum", source: "macrodroid", cat: "super", no_card: false,
      created_at: "2026-09-23T13:21:18.085911Z",
      ingest_event_id: "wallet:trade_republic:v1_consum_wallet" }] });
  const tr = await post(env, { fuente: "tr", titulo: "Trade Republic",
    texto: "Has gastado 15,02 € en CONSUM CHARTER",
    fecha: String(Date.parse("2026-09-23T15:21:16.886+02:00")), evento: "v1_consum_tr" });
  assert.equal(tr.data.skipped, true); assert.equal(tr.data.deferred, true);
  assert.equal(tr.data.possibleDup, undefined);
  assert.equal(env.rows.filter((r) => r.source === "macrodroid").length, 1);
  assert.equal(env.rows.filter((r) => String(r.source).endsWith("#dup")).length, 1);
});

await t("dos compras legítimas idénticas por TR se conservan como dos filas limpias", async () => {
  const env = fakeDb();
  const base = { fuente: "tr", titulo: "Trade Republic", texto: "Has gastado 9,95 € en Pans & Company" };
  await post(env, { ...base, fecha: String(Date.parse("2026-09-17T14:24:00+02:00")), evento: "v1_buy_a" });
  const b = await post(env, { ...base, fecha: String(Date.parse("2026-09-17T14:29:00+02:00")), evento: "v1_buy_b" });
  assert.equal(b.data.skipped, undefined); assert.equal(b.data.possibleDup, undefined);
  assert.equal(env.rows.length, 2); assert.ok(env.rows.every((r) => r.source === "macrodroid"));
});

await t("ON CONFLICT sin fila devuelta se responde skipped, nunca 'gasto apuntado'", async () => {
  const env = fakeDb({ emptyInsert: true });
  const r = await post(env, { fuente: "tr", titulo: "Trade Republic", texto: "Has gastado 4,00 € en Cafe",
    fecha: String(Date.parse("2026-09-17T15:10:00+02:00")), evento: "v1_empty" });
  assert.equal(r.data.skipped, true); assert.equal(r.data.ack, undefined); assert.equal(env.rows.length, 0);
});


// El clasificador del candidato base representa el contrato anterior; no afirma qué hash vive en Supabase.
const priorClassifierSrc=execFileSync("git",["show","3467bbd4fddcd213f862bedddac971c827099f3d:supabase/functions/_shared/ingest_logic.ts"],{encoding:"utf8"});
const priorClassifier=await import("data:text/javascript;base64,"+Buffer.from(transformSync(priorClassifierSrc,{loader:"ts",format:"esm"}).code).toString("base64"));
await t("ingest con clasificador anterior respeta gasolina/taxi manual en retry y conflicto",async()=>{
 for(const cat of ["gasolina","taxi"]){
  const fecha="2026-09-17T12:24:00.000Z",comercio=cat==="gasolina"?"Repsol":"Taxi Barcelona",body={fuente:"tr",titulo:"Trade Republic",texto:"Has gastado 10,00 € en "+comercio,fecha:String(Date.parse(fecha)),evento:"v1_manual_"+cat};
  assert.equal(priorClassifier.categorizar(comercio),"transporte");
  const env=fakeDb({rows:[{id:"manual-"+cat,user_id:"user",fecha,importe:10,comercio,cat,source:"macrodroid",ingest_event_id:identity.claveEvento(body.evento,"tr",body.texto)}]});
  const retry=await post(env,body,priorClassifier);assert.equal(retry.data.ack,"manual-"+cat);assert.equal(env.rows.length,1);assert.equal(env.rows[0].cat,cat);
  const manual=fakeDb({rows:[{id:"alta-"+cat,user_id:"user",fecha,importe:10,comercio,cat,source:"manual:trade_republic"}]});
  const conflict=await post(manual,body,priorClassifier);assert.equal(conflict.data.skipped,true);assert.equal(manual.rows.length,1);assert.equal(manual.rows[0].cat,cat);
 }
});
await t("ingest del baseline conserva multas/zona azul/peajes elegidos en retry y conflicto",async()=>{
 for(const [cat,comercio,oldCat] of [["multas","Multa DGT","tasas"],["zona_azul","Zona azul","parking"],["peajes","Peaje AP7","transporte"]]){
  const fecha="2026-09-17T12:24:00.000Z",body={fuente:"tr",titulo:"Trade Republic",texto:"Has gastado 10,00 € en "+comercio,fecha:String(Date.parse(fecha)),evento:"v1_manual_"+cat};
  assert.equal(priorClassifier.categorizar(comercio),oldCat);
  const env=fakeDb({rows:[{id:"manual-"+cat,user_id:"user",fecha,importe:10,comercio,cat,source:"macrodroid",ingest_event_id:identity.claveEvento(body.evento,"tr",body.texto)}]});
  const retry=await post(env,body,priorClassifier);assert.equal(retry.data.ack,"manual-"+cat);assert.equal(env.rows.length,1);assert.equal(env.rows[0].cat,cat);
  const manual=fakeDb({rows:[{id:"alta-"+cat,user_id:"user",fecha,importe:10,comercio,cat,source:"manual:trade_republic"}]});
  const conflict=await post(manual,body,priorClassifier);assert.equal(conflict.data.skipped,true);assert.equal(manual.rows.length,1);assert.equal(manual.rows[0].cat,cat);
 }
});
if (failures) process.exitCode = 1;
else console.log("  ok");
