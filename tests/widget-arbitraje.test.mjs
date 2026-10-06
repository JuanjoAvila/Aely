#!/usr/bin/env node
/* FIN-05: ejecuta el árbitro Java real y compara las mismas filas con app e ingest. */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const javaDir = path.join(root, "android/app/src/main/java/com/micartera/app");
const jdk = process.env.JAVA_HOME && path.join(process.env.JAVA_HOME, "bin");
const androidJdk = "C:/Program Files/Android/Android Studio/jbr/bin";
const javac = fs.existsSync(path.join(jdk || "", process.platform === "win32" ? "javac.exe" : "javac"))
  ? path.join(jdk, "javac") : fs.existsSync(path.join(androidJdk, "javac.exe"))
    ? path.join(androidJdk, "javac.exe") : "javac";
const java = javac.endsWith("javac.exe") ? javac.replace(/javac\.exe$/, "java.exe")
  : javac.endsWith("javac") && javac !== "javac" ? javac.replace(/javac$/, "java") : "java";
// Las cifras que recibe Java proceden de ambas implementaciones, con lápidas conservadas.
const finApp = loadPureLogicFromFile();
const finTs = fs.readFileSync(path.join(root, "supabase/functions/_shared/presupuesto.ts"), "utf8");
const finServer = await import("data:text/javascript;base64," + Buffer.from(transformSync(finTs, { loader: "ts", format: "esm" }).code).toString("base64"));
const finNow = Date.parse("2026-09-27T12:00:00Z"), finPeriod = finServer.inicioDeMesMs(finNow);
const finRows = [
  { id: "live", fecha: "2026-09-02T10:00:00Z", importe: 181, cat: "super", source: "macrodroid", comercio: "Compra ficticia" },
  { id: "gone-out", fecha: "2026-09-03T10:00:00Z", importe: 3, cat: "bares", source: "ob:trade_republic", comercio: "Borrado ficticio" },
  { id: "gone-in", fecha: "2026-09-04T10:00:00Z", importe: -15, cat: "ingreso", source: "ob:trade_republic", comercio: "Ingreso borrado" },
];
const finState = { budget: 1000, accounts: [{ ent: "trade_republic", role: "diario" }],
  settings: { gTotalMode: "net" }, reservaLog: [], expenses: finRows.map(finApp.expenseFromRow) };
finState.deleted = finState.expenses.slice(1).map(finApp.keyOfExpense);
const finBefore = finApp.monthBudgetStats(finState, finNow);
// Se ejecuta el bloque real de cobertura del pull: una foto del 2/10 debe acreditar el pago
// del 29/9 si el ciclo sigue abierto, sin convertir una fila futura en un ACK (NO-GO Claude).
const ackNow=Date.parse("2026-10-02T12:00:00Z"), ackStart=Date.parse("2026-09-26T00:00:00+02:00");
const ackRows=[{id:"row29",fecha:"2026-09-29T10:00:00Z",source:"macrodroid",ingest_event_id:"tr:ev29"},
  {id:"future",fecha:"2026-10-03T10:00:00Z",source:"macrodroid",ingest_event_id:"future"}];
const mainSource=fs.readFileSync(path.join(root,"src/modules/11-app-main.js"),"utf8");
const ackBlock=mainSource.match(/if\(ps!==wS.current\) return wP.current;([\s\S]*?)\/\/ FIN-07/)[1];
const ackRef={current:""};
new Function("rows","wC","inicioDeMesMs","Date",ackBlock)(ackRows,ackRef,finApp.inicioDeMesMs,{now:()=>ackNow,parse:Date.parse});
const cycleAck=Array.isArray(ackRef.current)?finApp.widgetCoveredEvents(ackRef.current,ackStart,ackNow,true):ackRef.current;
assert.ok(!cycleAck.includes("future"),"una fila futura no acredita recepción efectiva del pago");
const finPay = { id: "pay", fecha: "2026-09-27T10:00:00Z", importe: 5.45, cat: "super", source: "macrodroid", comercio: "Pago ficticio" };
const finAfterApp = finApp.monthBudgetStats({ ...finState, expenses: finState.expenses.concat(finApp.expenseFromRow(finPay)) }, finNow);
const finAfterServer = finServer.statsDelMes(finServer.filasComoLaApp(finRows.concat(finPay), finState.deleted), finState, finPeriod);
/* INC-2709-06 · identidad temporal del widget (2026-10-05).
   `expenseFromRow` guarda `new Date(fecha).toISOString()` (canónico, con milisegundos).
   `keyOfExpense` firma la lápida con esa fecha. `claveComoLaApp` compara el texto crudo
   de la fila: `2026-09-03T10:00:00Z` no es la misma cadena que `…T10:00:00.000Z`, ni que
   el mismo instante escrito con offset. La lápida no casa y el servidor conserva el
   borrado. El guard de abajo sigue en rojo a propósito: reescribir estas `fecha` a
   `.000Z` taparía el fallo sin arreglar `presupuesto.ts`. El contrato deseado vive aquí,
   no en el producto. `--iso-contrato` solo ejecuta esta caracterización; el runner
   registrado no lleva argumentos y tiene que seguir saliendo en rojo. */
function centimos(n){ return Math.round(Number(n)*100); }
function fechaCanonica(fecha){
  const ms=Date.parse(String(fecha??""));
  return Number.isFinite(ms)?new Date(ms).toISOString():String(fecha??"");
}
function esManualIso(source){
  const s=String(source||"");
  return !s||s==="manual"||s.indexOf("manual:")===0||s==="supabase";
}
function claveDeseada(f){
  const fecha=fechaCanonica(f.fecha);
  const base=fecha.slice(0,10)+"|"+(Number(f.importe)||0)+"|"+(f.comercio||"");
  if(esManualIso(f.source)) return base+"|"+String(f.id||"");
  const s=String(f.source||"");
  const ob=s==="ob"||s.indexOf("ob:")===0||s==="ob-hist"||s.indexOf("ob-hist:")===0;
  if(ob&&fecha.length>=10){
    const noon=new Date(fecha.slice(0,10)+"T12:00:00").toISOString();
    if(fecha!==noon) return base+"|"+fecha;
  }
  return base;
}
function legacyDeseada(f){
  const fecha=fechaCanonica(f.fecha);
  return fecha.slice(0,10)+"|"+(Number(f.importe)||0)+"|"+(f.comercio||"");
}
function filasDeseadas(filas, deleted){
  const lap=new Set(deleted||[]), seen=new Set(), out=[];
  for(const f of filas||[]){
    const k=claveDeseada(f);
    if(lap.has(k)) continue;
    if(esManualIso(f.source)&&lap.has(legacyDeseada(f))) continue;
    if(seen.has(k)) continue;
    seen.add(k); out.push(f);
  }
  return out;
}
function mutanteSufijoZ(fecha){
  const s=String(fecha||"");
  return /Z$/.test(s)&&!/\.\d+Z$/.test(s)?s.replace(/Z$/,".000Z"):s;
}
function claveMutanteSufijoZ(f){
  return finServer.claveComoLaApp(Object.assign({},f,{fecha:mutanteSufijoZ(f.fecha)}));
}
function claveMutanteDia(f){
  const fecha=fechaCanonica(f.fecha);
  return fecha.slice(0,10)+"|"+(Number(f.importe)||0)+"|"+(f.comercio||"");
}
const mediodiaLocal=(day)=>new Date(day+"T12:00:00").toISOString();
const isoMadrid=mediodiaLocal("2026-07-15")==="2026-07-15T10:00:00.000Z";
const isoUtc=mediodiaLocal("2026-07-15")==="2026-07-15T12:00:00.000Z";
assert.ok(isoMadrid!==isoUtc&&(isoMadrid||isoUtc),"el contrato se ejecuta en UTC o en Europe/Madrid");
if(isoMadrid){
  assert.equal(mediodiaLocal("2026-01-15"),"2026-01-15T11:00:00.000Z");
  assert.equal(mediodiaLocal("2026-03-29"),"2026-03-29T10:00:00.000Z");
  assert.equal(mediodiaLocal("2026-07-15"),"2026-07-15T10:00:00.000Z");
  assert.equal(mediodiaLocal("2026-10-25"),"2026-10-25T11:00:00.000Z");
}else{
  assert.equal(mediodiaLocal("2026-01-15"),"2026-01-15T12:00:00.000Z");
  assert.equal(mediodiaLocal("2026-03-29"),"2026-03-29T12:00:00.000Z");
  assert.equal(mediodiaLocal("2026-07-15"),"2026-07-15T12:00:00.000Z");
  assert.equal(mediodiaLocal("2026-10-25"),"2026-10-25T12:00:00.000Z");
}
assert.equal(finRows[1].fecha,"2026-09-03T10:00:00Z");
assert.equal(finRows[2].fecha,"2026-09-04T10:00:00Z");
assert.equal(finPay.fecha,"2026-09-27T10:00:00Z");
assert.equal(finRows[1].fecha.includes("."),false);
const claveAppGone=finApp.keyOfExpense(finApp.expenseFromRow(finRows[1]));
const claveSrvGone=finServer.claveComoLaApp(finRows[1]);
assert.notEqual(claveAppGone,claveSrvGone);
if(isoMadrid){
  assert.equal(claveAppGone,"2026-09-03|3|Borrado ficticio");
  assert.equal(claveSrvGone,"2026-09-03|3|Borrado ficticio|2026-09-03T10:00:00Z");
}else{
  assert.equal(claveAppGone,"2026-09-03|3|Borrado ficticio|2026-09-03T10:00:00.000Z");
  assert.equal(claveSrvGone,"2026-09-03|3|Borrado ficticio|2026-09-03T10:00:00Z");
}
assert.notEqual(finApp.keyOfExpense(finApp.expenseFromRow(finRows[2])),finServer.claveComoLaApp(finRows[2]));
assert.deepEqual(finServer.filasComoLaApp(finRows.concat(finPay),finState.deleted).map(r=>r.id),["live","gone-out","gone-in","pay"]);
assert.equal(centimos(finBefore.shown),18100);
assert.equal(centimos(finAfterApp.shown),18645);
assert.equal(centimos(finAfterServer.shown),17445);
assert.equal(centimos(finAfterApp.shown)-centimos(finAfterServer.shown),1200);
assert.equal(centimos(181)+centimos(5.45),18645);
assert.equal(centimos(181)+centimos(5.45)+centimos(3)-centimos(15),17445);
assert.equal(centimos(finAfterApp.remaining),81355);
for(const row of finRows.concat(finPay)){
  assert.equal(claveDeseada(row),finApp.keyOfExpense(finApp.expenseFromRow(row)),row.id);
}
assert.deepEqual(filasDeseadas(finRows.concat(finPay),finState.deleted).map(r=>r.id),["live","pay"]);
assert.equal(centimos(finServer.statsDelMes(filasDeseadas(finRows.concat(finPay),finState.deleted),finState,finPeriod).shown),18645);
const mismoOffset={id:"gone-out",fecha:"2026-09-03T12:00:00+02:00",importe:3,cat:"bares",source:"ob:trade_republic",comercio:"Borrado ficticio"};
const otroInstante={id:"otro",fecha:"2026-09-03T10:00:01Z",importe:3,cat:"bares",source:"ob:trade_republic",comercio:"Borrado ficticio"};
assert.equal(fechaCanonica(finRows[1].fecha),fechaCanonica(mismoOffset.fecha));
assert.equal(fechaCanonica(finRows[1].fecha),"2026-09-03T10:00:00.000Z");
assert.notEqual(fechaCanonica(finRows[1].fecha),fechaCanonica(otroInstante.fecha));
assert.equal(claveDeseada(finRows[1]),claveDeseada(mismoOffset));
assert.equal(claveDeseada(mismoOffset),finApp.keyOfExpense(finApp.expenseFromRow(mismoOffset)));
assert.notEqual(claveDeseada(finRows[1]),claveDeseada(otroInstante));
assert.equal(claveMutanteSufijoZ(finRows[1]),claveAppGone,"el sufijo .000Z tapa el guard default");
assert.notEqual(claveMutanteSufijoZ(mismoOffset),finApp.keyOfExpense(finApp.expenseFromRow(mismoOffset)),"el mutante no une el offset");
assert.equal(claveMutanteDia(finRows[1]),claveMutanteDia(otroInstante));
assert.notEqual(claveDeseada(finRows[1]),claveDeseada(otroInstante));
const antesDst={id:"dst-a",fecha:"2026-10-25T01:30:00+02:00",importe:12.5,comercio:"COMPRA SINTETICA",cat:"super",source:"ob:caixabank"};
const despuesDst={id:"dst-b",fecha:"2026-10-25T02:30:00+01:00",importe:12.5,comercio:"COMPRA SINTETICA",cat:"super",source:"ob:caixabank"};
const preDst={id:"dst-c",fecha:"2026-03-29T01:30:00+01:00",importe:12.5,comercio:"COMPRA SINTETICA",cat:"super",source:"ob:caixabank"};
const postDst={id:"dst-d",fecha:"2026-03-29T03:30:00+02:00",importe:12.5,comercio:"COMPRA SINTETICA",cat:"super",source:"ob:caixabank"};
assert.equal(fechaCanonica(antesDst.fecha),"2026-10-24T23:30:00.000Z");
assert.equal(fechaCanonica(despuesDst.fecha),"2026-10-25T01:30:00.000Z");
assert.notEqual(claveDeseada(antesDst),claveDeseada(despuesDst));
assert.notEqual(claveDeseada(preDst),claveDeseada(postDst));
assert.equal(claveDeseada(antesDst),finApp.keyOfExpense(finApp.expenseFromRow(antesDst)));
assert.notEqual(finServer.claveComoLaApp(antesDst),finApp.keyOfExpense(finApp.expenseFromRow(antesDst)));
function claveMutanteDiaCrudo(f){
  return String(f.fecha||"").slice(0,10)+"|"+(Number(f.importe)||0)+"|"+(f.comercio||"");
}
assert.equal(claveMutanteDiaCrudo(antesDst),claveMutanteDiaCrudo(despuesDst),"el prefijo crudo funde los dos instantes del cambio de hora");
assert.notEqual(claveDeseada(antesDst),claveDeseada(despuesDst));
const zForma={id:"cargo",fecha:"2026-09-08T08:15:00Z",importe:12.5,comercio:"COMPRA SINTETICA",cat:"super",source:"ob:caixabank"};
const msForma={id:"cargo-ms",fecha:"2026-09-08T08:15:00.000Z",importe:12.5,comercio:"COMPRA SINTETICA",cat:"super",source:"ob:caixabank"};
const offForma={id:"cargo-off",fecha:"2026-09-08T10:15:00+02:00",importe:12.5,comercio:"COMPRA SINTETICA",cat:"super",source:"ob:caixabank"};
const otroCargo={id:"cargo-otro",fecha:"2026-09-08T09:15:00Z",importe:12.5,comercio:"COMPRA SINTETICA",cat:"super",source:"ob:caixabank"};
assert.equal(claveDeseada(zForma),claveDeseada(msForma));
assert.equal(claveDeseada(zForma),claveDeseada(offForma));
assert.notEqual(claveDeseada(zForma),claveDeseada(otroCargo));
assert.equal(claveMutanteDia(zForma),claveMutanteDia(otroCargo));
const lapCargo=[finApp.keyOfExpense(finApp.expenseFromRow(zForma))];
const caja={budget:100,accounts:[{ent:"caixabank",role:"diario"}],settings:{gTotalMode:"net"},reservaLog:[]};
const periodo=finServer.inicioDeMesMs(finNow);
const crudas=[zForma,msForma,offForma,otroCargo];
assert.deepEqual(finServer.filasComoLaApp(crudas,lapCargo).map(r=>r.id),["cargo","cargo-off","cargo-otro"]);
assert.deepEqual(filasDeseadas(crudas,lapCargo).map(r=>r.id),["cargo-otro"]);
assert.equal(centimos(finServer.statsDelMes(finServer.filasComoLaApp(crudas,lapCargo),caja,periodo).shown),3750);
assert.equal(centimos(finServer.statsDelMes(filasDeseadas(crudas,lapCargo),caja,periodo).shown),1250);
const dup={id:"dup",fecha:"2026-09-08T08:15:00Z",importe:9.99,comercio:"CANDIDATO",cat:"otros",source:"ob:caixabank#dup"};
const deuda={id:"cuota",fecha:"2026-09-08T08:15:00Z",importe:40,comercio:"CUOTA",cat:"deudas",source:"ob:caixabank~deuda.sintetica"};
assert.equal(finApp.expenseFromRow(dup).possibleDup,true);
assert.equal(finServer.esPosibleRepetido(dup.source),true);
assert.equal(finApp.expenseFromRow(deuda).debtId,"sintetica");
assert.equal(finServer.esCuotaDeDeuda(deuda.source),true);
assert.notEqual(finApp.keyOfExpense(finApp.expenseFromRow(dup)),finServer.claveComoLaApp(dup));
const conMarcas=crudas.concat(dup,deuda);
assert.equal(centimos(finServer.statsDelMes(finServer.filasComoLaApp(conMarcas,lapCargo),caja,periodo).shown),3750);
assert.equal(centimos(finServer.statsDelMes(filasDeseadas(conMarcas,lapCargo),caja,periodo).shown),1250);
const ext={id:"ext",fecha:"2026-09-08T08:15:00Z",importe:12.5,comercio:"COMPRA SINTETICA",cat:"super",source:"ob:caixabank#x.cargo-A"};
const extOff={id:"ext-off",fecha:"2026-09-08T10:15:00+02:00",importe:12.5,comercio:"COMPRA SINTETICA",cat:"super",source:"ob:caixabank#x.cargo-A"};
const extOtro={id:"ext-b",fecha:"2026-09-08T09:15:00Z",importe:12.5,comercio:"COMPRA SINTETICA",cat:"super",source:"ob:caixabank#x.cargo-B"};
const extRow=finApp.expenseFromRow(ext);
assert.equal(extRow.extId,"cargo-A");
assert.equal(extRow.ent,"caixabank");
assert.equal(extRow.source,"ob");
assert.equal(claveDeseada(ext),claveDeseada(extOff));
assert.notEqual(claveDeseada(ext),claveDeseada(extOtro));
assert.equal(claveDeseada(ext).includes("cargo-A"),false);
assert.deepEqual(finServer.filasComoLaApp([ext],["obid|caixabank|cargo-A"]).map(r=>r.id),["ext"]);
assert.deepEqual(filasDeseadas([ext],["obid|caixabank|cargo-A"]).map(r=>r.id),["ext"]);
assert.equal(centimos(finServer.statsDelMes(finServer.filasComoLaApp([ext],["obid|caixabank|cargo-A"]),caja,periodo).shown),1250);
const n1={id:"n1",fecha:"2026-09-02T09:00:00Z",importe:4.2,comercio:"APOLLON SINTETICO",cat:"super",source:"macrodroid"};
const n2={id:"n2",fecha:"2026-09-02T18:00:00.000Z",importe:4.2,comercio:"APOLLON SINTETICO",cat:"super",source:"macrodroid"};
const nOff={id:"n3",fecha:"2026-09-03T01:30:00+02:00",importe:4.2,comercio:"APOLLON SINTETICO",cat:"super",source:"macrodroid"};
const tr={budget:100,accounts:[{ent:"trade_republic",role:"diario"}],settings:{gTotalMode:"net"},reservaLog:[]};
assert.equal(finServer.claveComoLaApp(n1),finServer.claveComoLaApp(n2));
assert.equal(claveDeseada(n1),claveDeseada(n2));
assert.equal(claveDeseada(n1),finApp.keyOfExpense(finApp.expenseFromRow(n1)));
assert.equal(centimos(finServer.statsDelMes(finServer.filasComoLaApp([n1,n2],[]),tr,periodo).shown),420);
assert.equal(claveDeseada(nOff),claveDeseada({id:"n4",fecha:"2026-09-02T23:30:00Z",importe:4.2,comercio:"APOLLON SINTETICO",cat:"super",source:"macrodroid"}));
assert.notEqual(finServer.claveComoLaApp(nOff),finApp.keyOfExpense(finApp.expenseFromRow(nOff)));
const manA={id:"manual-a",fecha:"2026-09-05T10:00:00Z",importe:1.1,comercio:"MANUAL SINTETICO",cat:"otros",source:"manual"};
const manOff={id:"manual-a",fecha:"2026-09-05T12:00:00+02:00",importe:1.1,comercio:"MANUAL SINTETICO",cat:"otros",source:"manual"};
const manB={id:"manual-b",fecha:"2026-09-05T10:00:00.000Z",importe:1.1,comercio:"MANUAL SINTETICO",cat:"otros",source:"manual"};
const manBank={id:"manual-b",fecha:"2026-09-05T10:00:00.000Z",importe:1.1,comercio:"MANUAL SINTETICO",cat:"otros",source:"manual:caixabank"};
const manSup={id:"manual-a",fecha:"2026-09-05T10:00:00.000Z",importe:1.1,comercio:"MANUAL SINTETICO",cat:"otros",source:"supabase"};
const manNoche={id:"manual-noche",fecha:"2026-10-25T01:30:00+02:00",importe:2,comercio:"MANUAL SINTETICO",cat:"otros",source:"manual"};
assert.equal(finApp.expenseFromRow(manSup).source,"manual");
assert.equal(claveDeseada(manA),claveDeseada(manOff));
assert.equal(claveDeseada(manA),claveDeseada(manSup));
assert.equal(claveDeseada(manA),finApp.keyOfExpense(finApp.expenseFromRow(manA)));
assert.notEqual(claveDeseada(manA),claveDeseada(manB));
assert.equal(claveDeseada(manBank),finApp.keyOfExpense(finApp.expenseFromRow(manBank)));
assert.ok(claveDeseada(manBank).endsWith("|manual-b"));
assert.equal(finServer.claveComoLaApp(manA),finServer.claveComoLaApp(manSup));
const legado=finApp.keyOfExpenseLegacy(finApp.expenseFromRow(manA));
assert.equal(legacyDeseada(manA),legado);
const mano={budget:100,accounts:[],settings:{gTotalMode:"net"},reservaLog:[]};
assert.equal(centimos(finServer.statsDelMes(filasDeseadas([manA,manOff,manB],[claveDeseada(manA)]),mano,periodo).shown),110);
assert.equal(centimos(finServer.statsDelMes(filasDeseadas([manA,manB],[legado]),mano,periodo).shown),0);
assert.equal(claveDeseada(manNoche),finApp.keyOfExpense(finApp.expenseFromRow(manNoche)));
assert.notEqual(finServer.claveComoLaApp(manNoche),finApp.keyOfExpense(finApp.expenseFromRow(manNoche)));
const oct=finServer.inicioDeMesMs(Date.parse("2026-10-27T12:00:00Z"));
const lapNoche=[finApp.keyOfExpense(finApp.expenseFromRow(manNoche))];
assert.equal(centimos(finServer.statsDelMes(finServer.filasComoLaApp([manNoche],lapNoche),mano,oct).shown),200);
assert.equal(centimos(finServer.statsDelMes(filasDeseadas([manNoche],lapNoche),mano,oct).shown),0);
console.log("  ✓ caracterización ISO: lápida canónica frente a timestamp crudo ("+(isoMadrid?"Europe/Madrid":"UTC")+"); el widget conserva 1200 céntimos");
console.log("  ✓ contrato deseado: Z/.000Z/offset del mismo instante, sin fundir otro instante; 18645 céntimos");
console.log("  ✓ mutante: el sufijo Z tapa el guard y el offset sigue vivo; un día único fundiría los 12,50");
if(process.argv.includes("--iso-mutante")){
  assert.equal(claveMutanteSufijoZ(mismoOffset),finApp.keyOfExpense(finApp.expenseFromRow(mismoOffset)));
}
if(process.argv.includes("--iso-contrato")) process.exit(0);
assert.equal(finBefore.shown, 181);
assert.equal(finAfterApp.shown, finAfterServer.shown);
assert.equal(finAfterApp.remaining, 813.55);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aely-widget-arbitraje-"));
try {
  const src = path.join(dir, "WidgetSnapshotArbiterTest.java");
  fs.writeFileSync(src, `package com.micartera.app;
public class WidgetSnapshotArbiterTest {
  static void eq(double a, double b) { if (Math.abs(a-b)>0.001) throw new AssertionError(a+" != "+b); }
  static void ok(boolean x) { if (!x) throw new AssertionError("condición falsa"); }
  static WidgetSnapshotArbiter.State base(long period, String bank) {
    WidgetSnapshotArbiter.State s = new WidgetSnapshotArbiter.State();
    WidgetSnapshotArbiter.app(s,period,40,100,60.0,150.0,200.0,bank,"Cuenta","","");
    return s;
  }
  static boolean ing(WidgetSnapshotArbiter.State s,long ticket,long current,long period,long read,
      String event,double spent,double budget,double left,double amount,boolean counts,boolean cashCounts) {
    return WidgetSnapshotArbiter.ingest(s,ticket,current,period,read,event,event+"Key",spent,budget,left,
        counts?amount:0,counts?amount:0,amount,counts,cashCounts);
  }
  public static void main(String[] args) {
    long sep=1788213600000L, oct=1790805600000L;
    WidgetSnapshotArbiter.State s=base(sep,"trade_republic");
    long a=WidgetSnapshotArbiter.begin(s), b=WidgetSnapshotArbiter.begin(s);
    ok(ing(s,b,sep,sep,200,"B",70,100,30,20,true,true));
    ok(ing(s,a,sep,sep,100,"A",50,100,50,10,true,true));
    eq(s.spent,70); eq(s.budgetLeft,30); eq(s.safeLiq(),120); eq(s.cash(),170); eq(s.afford(),30);
    ok(!ing(s,a,sep,sep,100,"A",50,100,50,10,true,true));
    eq(s.cash(),170);
    WidgetSnapshotArbiter.State reverse=base(sep,"trade_republic");
    a=WidgetSnapshotArbiter.begin(reverse); b=WidgetSnapshotArbiter.begin(reverse);
    ing(reverse,a,sep,sep,100,"A",50,100,50,10,true,true);
    ing(reverse,b,sep,sep,200,"B",70,100,30,20,true,true);
    eq(reverse.spent,s.spent); eq(reverse.safeLiq(),s.safeLiq()); eq(reverse.cash(),s.cash());
    // Un día nuevo dentro del mismo mes no reinicia el acumulado.
    long sameMonth=WidgetSnapshotArbiter.begin(s);
    ok(ing(s,sameMonth,sep,sep,300,"C",75,100,25,5,true,true));
    eq(s.spent,75); eq(s.cash(),165); eq(s.afford(),25);
    // Reentrada tras el pull: la app ya contiene los tres eventos.
    ok(WidgetSnapshotArbiter.app(s,sep,75,100,25.0,115.0,165.0,"trade_republic","Cuenta","|A|B|C|",""));
    long pending=WidgetSnapshotArbiter.begin(s);
    ok(WidgetSnapshotArbiter.app(s,sep,75,100,25.0,115.0,165.0,"trade_republic","Cuenta","|A|B|C|",""));
    ok(!ing(s,pending,sep,sep,300,"A",50,100,50,10,true,true));
    eq(s.spent,75); eq(s.cash(),165); eq(s.safeLiq(),115);
    long flight=WidgetSnapshotArbiter.begin(s);
    ok(WidgetSnapshotArbiter.app(s,sep,75,100,25.0,115.0,165.0,"trade_republic","Cuenta","|A|B|C|",""));
    ok(ing(s,flight,sep,sep,350,"D",80,100,20,5,true,true));
    eq(s.spent,80); eq(s.budgetLeft,20); eq(s.cash(),160); eq(s.safeLiq(),110);
    ok(WidgetSnapshotArbiter.app(s,sep,75,100,25.0,115.0,165.0,"trade_republic","Cuenta","|A|B|C|",""));
    eq(s.spent,80); eq(s.cash(),160); eq(s.safeLiq(),110);
    ok(WidgetSnapshotArbiter.app(s,sep,80,100,20.0,110.0,160.0,"trade_republic","Cuenta","|A|B|C|D|",""));
    eq(s.spent,80); eq(s.cash(),160); // al cubrir D, el overlay desaparece sin duplicarse
    long deleted=WidgetSnapshotArbiter.begin(s);
    ing(s,deleted,sep,sep,370,"E",85,100,15,5,true,true);
    ok(WidgetSnapshotArbiter.app(s,sep,80,100,20.0,110.0,160.0,"trade_republic","Cuenta","|A|B|C|D|","|EKey|"));
    eq(s.spent,80); eq(s.cash(),160); // lápida: el gasto retirado no vuelve por el journal
    WidgetSnapshotArbiter.State saturated=base(sep,"trade_republic");
    long satTicket=WidgetSnapshotArbiter.begin(saturated);
    WidgetSnapshotArbiter.app(saturated,sep,80,100,20.0,150.0,200.0,"trade_republic","Cuenta","","");
    ok(ing(saturated,satTicket,sep,sep,360,"late",90,80,0,10,true,true));
    eq(saturated.budgetLeft,10); // el servidor estaba en 0, pero la app tenía 20 antes del gasto
    long next=WidgetSnapshotArbiter.begin(s);
    ok(!ing(s,next,oct,sep,400,"viejo",80,100,20,10,true,true));
    ok(WidgetSnapshotArbiter.app(s,oct,0,100,100.0,130.0,180.0,"trade_republic","Cuenta","",""));
    long first=WidgetSnapshotArbiter.begin(s);
    ok(ing(s,first,oct,oct,500,"nuevo",5,100,95,5,true,true));
    eq(s.spent,5); eq(s.cash(),175); eq(s.safeLiq(),125);
    WidgetSnapshotArbiter.State other=base(sep,"sabadell");
    long tr=WidgetSnapshotArbiter.begin(other);
    ing(other,tr,sep,sep,100,"tr",50,100,50,10,true,true);
    eq(other.spent,50); eq(other.cash(),200); eq(other.safeLiq(),150);
    // Cambiar de banco con una notificación sin cubrir rehace solo sus deltas de saldo.
    ok(WidgetSnapshotArbiter.app(other,sep,40,100,60.0,150.0,200.0,"trade_republic","TR","",""));
    eq(other.cash(),190); eq(other.safeLiq(),140); eq(other.budgetLeft,50);
    ok(WidgetSnapshotArbiter.app(other,sep,40,100,60.0,150.0,200.0,"sabadell","Sabadell","",""));
    eq(other.cash(),200); eq(other.safeLiq(),150); eq(other.budgetLeft,50);
    WidgetSnapshotArbiter.State neutral=base(sep,"trade_republic");
    long inv=WidgetSnapshotArbiter.begin(neutral);
    ing(neutral,inv,sep,sep,100,"inversion",40,100,60,20,false,true);
    eq(neutral.spent,40); eq(neutral.cash(),180); eq(neutral.safeLiq(),150);
    WidgetSnapshotArbiter.State near=base(sep,"trade_republic"); near.baseCash=155;
    long nearTicket=WidgetSnapshotArbiter.begin(near);
    ing(near,nearTicket,sep,sep,100,"inversion",40,100,60,20,false,true);
    eq(near.cash(),135); eq(near.safeLiq(),135);
    WidgetSnapshotArbiter.State oldEdge=base(sep,"trade_republic");
    long oldTicket=WidgetSnapshotArbiter.begin(oldEdge);
    WidgetSnapshotArbiter.app(oldEdge,sep,40,100,60.0,150.0,200.0,"trade_republic","Cuenta","","");
    WidgetSnapshotArbiter.ingest(oldEdge,oldTicket,sep,sep,100,"ROWID","legacyKey",50,100,50,
        Double.NaN,Double.NaN,10,true,true);
    ok(oldEdge.unknownPending); // contrato viejo: el delta no se inventa tras un push cruzado
    WidgetSnapshotArbiter.app(oldEdge,sep,50,100,50.0,140.0,190.0,"trade_republic","Cuenta",
        "|tr:trade_republic:EVT|ROWID|","");
    ok(!oldEdge.unknownPending); eq(oldEdge.spent,50); eq(oldEdge.cash(),190);
    WidgetSnapshotArbiter.State dup=base(sep,"trade_republic");
    long uncertain=WidgetSnapshotArbiter.begin(dup);
    ing(dup,uncertain,sep,sep,100,"possibleDup",40,100,60,10,false,false);
    eq(dup.cash(),200); eq(dup.spent,40);
    WidgetSnapshotArbiter.State fin=new WidgetSnapshotArbiter.State();
    WidgetSnapshotArbiter.app(fin,${finPeriod}L,${finBefore.shown},1000,${finBefore.remaining.toFixed(2)},900.0,2000.0,"trade_republic","Cuenta","","");
    long purchase=WidgetSnapshotArbiter.begin(fin);
    ing(fin,purchase,${finPeriod}L,${finPeriod}L,700,"pay",${finAfterServer.shown},1000,${1000-finAfterServer.against},5.45,true,true);
    eq(fin.spent,${finAfterApp.shown}); eq(fin.budgetLeft,${finAfterApp.remaining});
    eq(fin.cash(),1994.55); eq(fin.safeLiq(),894.55); eq(fin.afford(),813.55);
    // Reentrada antes y después del ACK: conserva el pago una sola vez.
    WidgetSnapshotArbiter.app(fin,${finPeriod}L,${finBefore.shown},1000,${finBefore.remaining.toFixed(2)},900.0,2000.0,"trade_republic","Cuenta","","");
    eq(fin.spent,${finAfterApp.shown}); eq(fin.cash(),1994.55);
    WidgetSnapshotArbiter.app(fin,${finPeriod}L,${finAfterApp.shown},1000,${finAfterApp.remaining},894.55,1994.55,"trade_republic","Cuenta","|pay|","");
    eq(fin.spent,${finAfterApp.shown}); eq(fin.cash(),1994.55); eq(fin.safeLiq(),894.55);
    // Al releer XML Android puede añadir indentación tras el salto final del journal.
    WidgetSnapshotArbiter.State persisted=base(sep,"trade_republic");
    persisted.journal="evt\\t10\\t10\\t10\\t1\\t1\\tkey\\n    ";
    persisted.journalFull=true;
    ok(WidgetSnapshotArbiter.app(persisted,sep,40,100,60.0,150.0,200.0,"trade_republic","Cuenta","",""));
    ok(!persisted.journalFull); eq(persisted.spent,50); eq(persisted.cash(),190);
    ok(!persisted.journal.endsWith("\\n"));
    persisted.journal="    "+persisted.journal;
    ok(WidgetSnapshotArbiter.app(persisted,sep,50,100,50.0,140.0,190.0,"trade_republic","Cuenta","|evt|",""));
    ok(persisted.journal.isEmpty()); eq(persisted.spent,50); eq(persisted.cash(),190);
    WidgetSnapshotArbiter.State corrupt=base(sep,"trade_republic");
    corrupt.journal="no-es-un-evento"; corrupt.journalFull=true;
    ok(!WidgetSnapshotArbiter.app(corrupt,sep,50,100,50.0,140.0,190.0,"trade_republic","Cuenta","|evt|",""));
    ok(corrupt.journalFull); ok(corrupt.journal.equals("no-es-un-evento")); eq(corrupt.spent,40);
    WidgetSnapshotArbiter.State unknown=base(sep,"trade_republic");
    unknown.journal="old\\tNaN\\tNaN\\t10\\t1\\t1\\tkey\\n    ";
    ok(WidgetSnapshotArbiter.app(unknown,sep,40,100,60.0,150.0,200.0,"trade_republic","Cuenta","",""));
    ok(unknown.unknownPending); ok(!unknown.journalFull); eq(unknown.cash(),190);
    ok(WidgetSnapshotArbiter.app(unknown,sep,50,100,50.0,140.0,190.0,"trade_republic","Cuenta","|old|",""));
    ok(!unknown.unknownPending); eq(unknown.cash(),190);
    WidgetSnapshotArbiter.State stored=base(sep,"trade_republic");
    ing(stored,WidgetSnapshotArbiter.begin(stored),sep,sep,800,"new",50,100,50,10,true,true);
    ok(!stored.journal.endsWith("\\n"));
    WidgetSnapshotArbiter.State crossed=base(sep,"trade_republic");
    ing(crossed,WidgetSnapshotArbiter.begin(crossed),sep,sep,900,"first",50,100,50,10,true,true);
    crossed.journal += "\\n    ";
    ing(crossed,WidgetSnapshotArbiter.begin(crossed),sep,sep,901,"second",55,100,45,5,true,true);
    ok(WidgetSnapshotArbiter.app(crossed,sep,50,100,50.0,140.0,190.0,"trade_republic","Cuenta","|first|",""));
    eq(crossed.spent,55); eq(crossed.cash(),185); ok(!crossed.journalFull);
    ok(crossed.journal.startsWith("second\\t"));
    WidgetSnapshotArbiter.State oversized=base(sep,"trade_republic");
    String largeEvent=new String(new char[262145]).replace('\\0','x');
    oversized.journal=largeEvent+"\\t10\\t10\\t10\\t1\\t1\\tkey";
    oversized.journalFull=true;
    ok(!WidgetSnapshotArbiter.app(oversized,sep,40,100,60.0,150.0,200.0,"trade_republic","Cuenta","",""));
    ok(oversized.journalFull); eq(oversized.spent,40);
    ok(WidgetSnapshotArbiter.app(oversized,sep,50,100,50.0,140.0,190.0,"trade_republic","Cuenta","|"+largeEvent+"|",""));
    ok(!oversized.journalFull); ok(oversized.journal.isEmpty()); eq(oversized.cash(),190);
    // INC-2909-01 E2: la ventana del widget (mes natural o ciclo desde el cobro).
    long day=86400000L, cobro=sep+25*day, oct3=oct+2*day;
    ok(!WidgetPeriod.clientV2(0)); ok(!WidgetPeriod.clientV2(1)); ok(WidgetPeriod.clientV2(2));
    WidgetSnapshotArbiter.State crossing=base(cobro,"trade_republic");
    ok(WidgetSnapshotArbiter.app(crossing,cobro,100,1000,900.0,900.0,1000.0,"trade_republic","Cuenta","",""));
    ok(ing(crossing,WidgetSnapshotArbiter.begin(crossing),cobro,cobro,100,"tr:ev29",130,1000,870,30,true,true));
    ok(WidgetSnapshotArbiter.app(crossing,cobro,130,1000,870.0,870.0,970.0,"trade_republic","Cuenta",${JSON.stringify(cycleAck)},""));
    eq(crossing.spent,130); eq(crossing.cash(),970); ok(crossing.journal.isEmpty());
    WidgetSnapshotArbiter.State absent=base(cobro,"trade_republic");
    ok(WidgetSnapshotArbiter.pendingUnknown(absent,"tr:ev29","row29"));
    ok(WidgetSnapshotArbiter.app(absent,cobro,100,1000,900.0,900.0,1000.0,"trade_republic","Cuenta","",""));
    ok(absent.unknownPending); // sin ACK el mismo ciclo sigue incierto al cruzar el día 1
    ok(WidgetSnapshotArbiter.app(absent,cobro,130,1000,870.0,870.0,970.0,"trade_republic","Cuenta",${JSON.stringify(cycleAck)},""));
    ok(!absent.unknownPending); eq(absent.spent,130);
    // Un evento anterior sigue afectando al saldo: se retira por recepción real, no por fecha.
    WidgetSnapshotArbiter.State previous=base(sep,"trade_republic");
    ok(WidgetSnapshotArbiter.pendingUnknown(previous,"tr:ev29","row29"));
    ok(WidgetSnapshotArbiter.app(previous,oct,0,1000,1000.0,870.0,970.0,"trade_republic","Cuenta",${JSON.stringify(cycleAck)},""));
    ok(!previous.unknownPending); eq(previous.spent,0); eq(previous.cash(),970);
    ok(WidgetPeriod.monthStart(sep+10*day)==sep); ok(WidgetPeriod.monthStart(oct3)==oct);
    ok(WidgetPeriod.acceptApp(0,"",sep,sep+10*day));
    ok(!WidgetPeriod.acceptApp(0,"ciclo",cobro,oct3));     // APK/web antigua: nunca un ciclo
    ok(WidgetPeriod.acceptApp(2,"ciclo",cobro,oct3));      // el ciclo cruza el día 1
    ok(!WidgetPeriod.acceptApp(2,"ciclo",oct3+day,oct3));  // un cobro futuro no vale
    ok(!WidgetPeriod.acceptApp(2,"ciclo",cobro,cobro+46*day));
    ok(WidgetPeriod.current(2,"ciclo",cobro,oct3)==cobro);
    ok(WidgetPeriod.current(2,"ciclo",cobro,cobro+46*day)==WidgetPeriod.monthStart(cobro+46*day));
    ok(!WidgetPeriod.stale(2,"ciclo",cobro,oct3));         // cambiar de mes no caduca el ciclo
    ok(WidgetPeriod.stale(0,"",sep,oct3));                 // el mes natural sí
    ok(WidgetPeriod.stale(2,"ciclo",cobro,cobro+46*day));
    // Un servidor de otra regla o ventana no pisa un widget v2.
    ok(WidgetPeriod.acceptServer(0,"",sep,0,"",sep,sep+10*day));
    ok(!WidgetPeriod.acceptServer(2,"ciclo",cobro,0,"",oct,oct3));
    ok(!WidgetPeriod.acceptServer(2,"ciclo",cobro,2,"mes",oct,oct3));
    ok(WidgetPeriod.acceptServer(2,"ciclo",cobro,2,"ciclo",cobro,oct3));
    ok(!WidgetPeriod.acceptServer(2,"mes",oct,0,"",oct,oct3));   // ingest viejo: regla de Gastos
    ok(WidgetPeriod.acceptServer(2,"mes",oct,2,"mes",oct,oct3));
    ok(!WidgetPeriod.sameScope("foto-A", "")); // ingest activo o PR87 sin alcance: no demuestra misma regla
    ok(!WidgetPeriod.sameScope("foto-A", "foto-B"));
    ok(!WidgetPeriod.sameScope("", ""));
    ok(WidgetPeriod.sameScope("foto-A", "foto-A"));
    ok(WidgetPeriod.labels(2,"es","ciclo","neto")[WidgetPeriod.TITULO].equals("AELY · MI CICLO · GASTO NETO"));
    ok(WidgetPeriod.labels(2,"en","ciclo","neto")[WidgetPeriod.TITULO].equals("AELY · MY CYCLE · NET SPENDING"));
    ok(WidgetPeriod.labels(2,"ca","mes","gasto")[WidgetPeriod.TITULO].equals("AELY · AQUEST MES · DESPESA"));
    ok(WidgetPeriod.labels(2,"en","mes","gasto")[WidgetPeriod.QUEDAN].equals("of {b} this month · {l} left"));
    ok(WidgetPeriod.labels(2,"es","ciclo","neto")[WidgetPeriod.SIN_PRESUPUESTO].equals("neto este ciclo"));
    ok(WidgetPeriod.labels(0,"en","ciclo","neto")[WidgetPeriod.TITULO].equals("AELY · ESTE MES")); // APK/web antigua
    WidgetSnapshotArbiter.State v2=base(cobro,"trade_republic");
    ok(WidgetSnapshotArbiter.pendingUnknown(v2,"pago","k"));
    ok(v2.unknownPending); // una respuesta rechazada conserva la identidad hasta ACK, no solo un booleano
    ok(WidgetSnapshotArbiter.app(v2,cobro,40,100,60.0,150.0,200.0,"trade_republic","Cuenta","",""));
    ok(v2.unknownPending); eq(v2.spent,40); // reabrir sin cobertura no demuestra que el pago esté incluido
    ok(WidgetSnapshotArbiter.app(v2,cobro,50,100,50.0,140.0,190.0,"trade_republic","Cuenta","|pago|",""));
    ok(!v2.unknownPending); eq(v2.spent,50);
    v2.coveredEvents="|pago|"; ok(!WidgetSnapshotArbiter.pendingUnknown(v2,"pago","k"));
    v2.coveredEvents=""; v2.deletedKeys="|k|"; ok(!WidgetSnapshotArbiter.pendingUnknown(v2,"pago","k"));
    WidgetSnapshotArbiter.State changed=base(sep,"trade_republic");
    ing(changed,WidgetSnapshotArbiter.begin(changed),sep,sep,100,"pending-bank",50,100,50,10,true,true);
    ok(WidgetSnapshotArbiter.invalidateScope(changed));
    ok(WidgetSnapshotArbiter.app(changed,sep,40,100,60.0,150.0,200.0,"sabadell","Cuenta","",""));
    ok(changed.unknownPending); eq(changed.spent,40); eq(changed.cash(),200);
    ok(WidgetSnapshotArbiter.app(changed,sep,50,100,50.0,140.0,190.0,"sabadell","Cuenta","|pending-bank|",""));
    ok(!changed.unknownPending); eq(changed.spent,50);
    WidgetSnapshotArbiter.State monthUnknown=base(sep,"trade_republic");
    ok(WidgetSnapshotArbiter.pendingUnknown(monthUnknown,"old-event","old-key"));
    ok(WidgetSnapshotArbiter.app(monthUnknown,oct,0,100,100.0,200.0,200.0,"trade_republic","Cuenta","",""));
    ok(monthUnknown.unknownPending); // cambiar de periodo tampoco demuestra cobertura del saldo
    ok(WidgetSnapshotArbiter.app(monthUnknown,oct,0,100,100.0,200.0,200.0,"trade_republic","Cuenta","","|old-key|"));
    ok(!monthUnknown.unknownPending);
    System.out.println("  ✓ E2: ciclo que cruza el mes, caducidad a 45 días, servidor viejo sin pisar y textos es/en/ca");
    System.out.println("  ✓ persistencia con espacios, recuperación segura, entrada dañada y delta desconocido conservados");
    System.out.println("  ✓ orden inverso, reentrada, día/mes, banco, possibleDup y pago con lápidas");
  }
}`);
  for (const [cmd, args] of [
    [javac, ["-encoding", "UTF-8", "-d", dir, path.join(javaDir, "WidgetSnapshotArbiter.java"), path.join(javaDir, "WidgetPeriod.java"), src]],
    [java, ["-cp", dir, "com.micartera.app.WidgetSnapshotArbiterTest"]],
  ]) {
    const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8" });
    if (r.status !== 0) throw new Error(`${cmd}: ${r.error || r.stderr || r.stdout}`);
    if (r.stdout) process.stdout.write(r.stdout);
  }
} finally { fs.rmSync(dir, { recursive: true, force: true }); }

const ts = fs.readFileSync(path.join(root, "supabase/functions/_shared/presupuesto.ts"), "utf8");
const js = transformSync(ts, { loader: "ts", format: "esm" }).code;
const server = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const app = loadPureLogicFromFile();
const now = Date.parse("2026-09-25T12:00:00Z");
const rows = [
  { id: "a", fecha: "2026-09-25T09:00:00Z", importe: 40, comercio: "Compra", cat: "otros", source: "macrodroid" },
  { id: "b", fecha: "2026-09-25T10:00:00Z", importe: 10, comercio: "Otra", cat: "otros", source: "macrodroid" },
  { id: "c", fecha: "2026-09-25T11:00:00Z", importe: 20, comercio: "Tercera", cat: "otros", source: "macrodroid" },
  { id: "d", fecha: "2026-09-25T11:30:00Z", importe: 30, comercio: "Candidato", cat: "otros", source: "ob:trade_republic#dup" },
];
const state = { budget: 100, accounts: [{ id: "tr", ent: "trade_republic", role: "diario", spendFrom: true }],
  settings: { expenseBanks: ["trade_republic"] }, fixed: [], debts: [], oneoffs: [], reservaLog: [],
  expenses: rows.map(r => ({ id: r.id, date: r.fecha, amount: r.importe, merchant: r.comercio,
    category: r.cat, source: r.source, possibleDup: r.id === "d" })) };
const actualRows = server.filasComoLaApp(rows, []);
assert.deepEqual(actualRows.map(r => r.id), rows.map(r => r.id), "ninguna fila se pierde");
const s = server.statsDelMes(actualRows, state, server.inicioDeMesMs(now));
const c = app.monthBudgetStats(state, now);
assert.equal(s.shown, c.shown);
assert.equal(s.shown, 70);
assert.equal(s.budget - s.against, c.remaining);
console.log("  ✓ mismas cuatro filas: presupuesto app/servidor 70, candidato conservado fuera de cifras");
