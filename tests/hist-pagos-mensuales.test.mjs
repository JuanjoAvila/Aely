#!/usr/bin/env node
/**
 * FIN-02 — EL HISTÓRICO NO PUEDE COMERSE PAGOS DE MESES DISTINTOS.
 *
 * `dedupeHistRecibos` compara comercio + importe + banco, SIN FECHA. Nació para proteger la
 * creación de Fijos: aceptar tres meses de extracto creaba tres Fijos idénticos, y un Fijo se
 * cobra TODOS los meses para siempre en `monthNetForAccount`. Esa protección sigue valiendo.
 *
 * Lo que ya no vale es aplicarla en la CLASIFICACIÓN. Desde el híbrido C el destino por defecto
 * es un gasto puntual (`defDest:"gasto"`), y `histBuildCommit` ni siquiera crea Fijos todavía
 * (`fixAdds:[]`). Así que hoy el guardo no evita ningún Fijo duplicado y sí descarta pagos
 * mensuales reales: tres recibos de luz de junio, julio y agosto entraban como UNO.
 *
 * El extracto del banco manda: si el banco lista tres cargos, hubo tres cargos.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPureLogicFromFile, loadPureLogic } from "../scripts/load-pure-logic.mjs";

let ctx = loadPureLogicFromFile();
const guards=[];

let failed = 0;
function t(name, fn) {
  if(name.startsWith("FIN02")) guards.push({name,fn});
  try { fn(); console.log("  ✓ " + name); }
  catch (e) { failed++; console.error("  ✗ " + name + "\n      " + e.message); }
}

const cand = (o) => Object.assign({ kind: "out", card: false, ent: "sabadell" }, o);
const estadoVacio = () => ({ expenses: [], fixed: [], debts: [], oneoffs: [], accounts: [], settings: {} });

console.log("hist-pagos-mensuales");

t("★ tres pagos del mismo recibo en tres meses entran los TRES", () => {
  const cands = [
    cand({ id: "c3", merchant: "IBERDROLA", amount: 12, date: "2026-08-12" }),
    cand({ id: "c2", merchant: "IBERDROLA", amount: 12, date: "2026-07-12" }),
    cand({ id: "c1", merchant: "IBERDROLA", amount: 12, date: "2026-06-12" }),
  ];
  const { rows } = ctx.histClassifyCandidates(cands, estadoVacio());
  const nuevos = rows.filter((r) => r.status === "new").length;
  const lote = rows.filter((r) => r.reason === "recibo-lote").length;
  assert.equal(lote, 0, "ninguno puede quedar descartado como repetido del lote");
  assert.equal(nuevos, 3, "son tres pagos reales de tres meses distintos");
  rows.forEach((r) => assert.equal(r.defDest, "gasto"));
});

t("y el extracto manda también dentro del mismo día", () => {
  // Dos cargos idénticos el mismo día: si el banco los lista dos veces, hubo dos.
  const cands = [
    cand({ id: "a", merchant: "MERCADONA", amount: 9.5, date: "2026-08-12" }),
    cand({ id: "b", merchant: "MERCADONA", amount: 9.5, date: "2026-08-12" }),
  ];
  const { rows } = ctx.histClassifyCandidates(cands, estadoVacio());
  assert.equal(rows.filter((r) => r.status === "new").length, 2);
});

t("lo YA GUARDADO sigue detectándose, y 1:1", () => {
  const estado = Object.assign(estadoVacio(), {
    expenses: [{ id: "e1", date: "2026-08-12T12:00:00.000Z", amount: 12, merchant: "IBERDROLA", ent: "sabadell" }],
  });
  const cands = [
    cand({ id: "c1", merchant: "IBERDROLA", amount: 12, date: "2026-08-12" }),
    cand({ id: "c2", merchant: "IBERDROLA", amount: 12, date: "2026-08-12" }),
  ];
  const { rows } = ctx.histClassifyCandidates(cands, estado);
  assert.equal(rows.filter((r) => r.reason === "existing").length, 1, "un guardado marca UN candidato, no los dos");
  assert.equal(rows.filter((r) => r.status === "new").length, 1);
});

t("un cargo que ya está modelado como Fijo sigue saliendo como duplicado", () => {
  const estado = Object.assign(estadoVacio(), {
    fixed: [{ id: "f1", name: "Iberdrola", amount: 12, account: "sabadell", freq: "mes" }],
  });
  const { rows } = ctx.histClassifyCandidates([cand({ id: "c1", merchant: "IBERDROLA", amount: 12, date: "2026-08-12" })], estado);
  assert.equal(rows[0].status, "dup");
  assert.equal(rows[0].reason, "modeled");
});

t("reimportar el mismo extracto no crea nada nuevo la segunda vez", () => {
  const cands = [
    cand({ id: "c1", merchant: "IBERDROLA", amount: 12, date: "2026-06-12" }),
    cand({ id: "c2", merchant: "IBERDROLA", amount: 12, date: "2026-07-12" }),
  ];
  const primera = ctx.histClassifyCandidates(cands, estadoVacio());
  const commit = ctx.histBuildCommit(cands, primera.rows, estadoVacio(), { batchId: "b1" });
  assert.equal(commit.expAdds.length, 2);
  const segunda = ctx.histClassifyCandidates(cands, Object.assign(estadoVacio(), { expenses: commit.expAdds }));
  assert.equal(segunda.rows.filter((r) => r.reason === "existing").length, 2, "la segunda pasada los reconoce ya guardados");
  assert.equal(segunda.rows.filter((r) => r.status === "new").length, 0);
});

t("★ marcar tres «Recibo» equivalentes crea UN Fijo, no tres", () => {
  // Esta es la protección que NO se puede perder: un Fijo se cobra todos los meses para siempre
  // en `monthNetForAccount`, así que tres Fijos iguales restan su importe tres veces cada mes.
  // Ojo: hoy la pantalla NO usa `histBuildCommit` — `runImport` crea un Fijo por fila marcada,
  // sin agrupar. Lo único que lo evitaba era que `dedupeHistRecibos` dejase esas filas fuera de
  // la selección por defecto… y el usuario podía marcarlas igualmente. O sea que la garantía
  // nunca existió de verdad; hay que ponerla aquí.
  const cands = [
    cand({ id: "c3", merchant: "IBERDROLA", amount: 12, date: "2026-08-12" }),
    cand({ id: "c2", merchant: "IBERDROLA", amount: 12, date: "2026-07-12" }),
    cand({ id: "c1", merchant: "IBERDROLA", amount: 12, date: "2026-06-12" }),
    cand({ id: "c4", merchant: "NETFLIX", amount: 13, date: "2026-08-03" }),
  ];
  const fijos = ctx.histFijosFromSelection(cands, [0, 1, 2, 3]);
  assert.equal(fijos.length, 2, "un Fijo por recibo distinto: Iberdrola y Netflix");
  const iber = fijos.find((f) => /iberdrola/i.test(f.name));
  assert.equal(iber.amount, 12);
  assert.equal(iber.account, "sabadell");
});

t("el ayudante de agrupar sigue viendo que los tres son el mismo recibo", () => {
  const cands = [
    cand({ id: "c3", merchant: "IBERDROLA", amount: 12, date: "2026-08-12" }),
    cand({ id: "c2", merchant: "IBERDROLA", amount: 12, date: "2026-07-12" }),
    cand({ id: "c1", merchant: "IBERDROLA", amount: 12, date: "2026-06-12" }),
  ];
  const dup = ctx.dedupeHistRecibos(cands);
  assert.equal(Object.keys(dup).length, 2);
  assert.equal(dup[0], undefined, "conserva el más reciente");
});

t("los ingresos y las compras con tarjeta no cambian de comportamiento", () => {
  const cands = [
    cand({ id: "i1", kind: "in", merchant: "NOMINA", amount: 1500, date: "2026-08-01" }),
    cand({ id: "t1", card: true, merchant: "AMAZON", amount: 30, date: "2026-08-02" }),
    cand({ id: "t2", card: true, merchant: "AMAZON", amount: 30, date: "2026-07-02" }),
  ];
  const { rows } = ctx.histClassifyCandidates(cands, estadoVacio());
  assert.equal(rows[0].defDest, "ingreso");
  assert.equal(rows[1].defDest, "gasto");
  assert.equal(rows[2].defDest, "gasto", "dos compras con tarjeta iguales en meses distintos son dos compras");
  assert.equal(rows[1].suggestRecibo, false, "tarjeta nunca se sugiere como recibo");
});

for(const ent of ["sabadell","revolut"]) t("FIN02 tres meses, dos vías y undo exacto en "+ent,()=> {
  const before=estadoVacio();
  before.expenses=[{id:"previous",date:"2026-01-01",amount:7,merchant:"Previo ficticio",ent}];
  before.fixed=[{id:"previous-fixed",name:"Previo fijo",amount:9,account:ent}];
  before.deleted=["previous-tombstone"];
  const cands=[6,7,8].map((m,i)=>cand({id:"monthly-"+ent+i,ent,merchant:"Luz ficticia",amount:12,date:"2026-0"+m+"-12"}));
  const rows=ctx.histClassifyCandidates(cands,before).rows;
  assert.equal(rows.filter(r=>r.status==="new").length,3);
  const batch=ctx.histBuildCommit(cands,rows,before,{batchId:"monthly-batch"});
  assert.equal(batch.expAdds.length,3);
  assert.deepEqual(Array.from(batch.expAdds,e=>e.date.slice(0,7)).sort(),["2026-06","2026-07","2026-08"]);
  assert.equal(batch.expAdds.reduce((a,e)=>a+Math.round(e.amount*100),0),3600,"libro: 1200 + 1200 + 1200 céntimos");
  const after=Object.assign({},before,{expenses:batch.expAdds.concat(before.expenses)});
  assert.equal(ctx.histClassifyCandidates(cands,after).rows.filter(r=>r.status==="new").length,0);
  const last={batchId:batch.batchId,localIds:batch.expAdds.map(e=>e.id),cloudIds:[]};
  const undo=ctx.histUndoBatch(after,last);
  assert.equal(JSON.stringify(undo.nextState),JSON.stringify(before),"restauración exacta, incluidas lápidas y fijo anterior");
  assert.equal(JSON.stringify(ctx.histUndoBatch(undo.nextState,last).nextState),JSON.stringify(before),"segunda pasada idempotente");
});
t("FIN02 undo incluye el único fijo del lote y nunca un fijo anterior con id coincidente",()=> {
  const before=estadoVacio();
  before.fixed=[{id:"shared-id",name:"Anterior",amount:99,account:"revolut"}];
  before.deleted=["keep"];
  const cands=[6,7,8].map((m,i)=>cand({id:"fixed"+i,merchant:"Luz ficticia",amount:12,date:"2026-0"+m+"-12"}));
  const fixed=ctx.histFijosFromSelection(cands,[0,1,2],{mkId:()=>"shared-id",batchId:"fixed-batch"});
  assert.equal(fixed.length,1,"tres pagos, un fijo");
  const last={batchId:"fixed-batch",localIds:[],cloudIds:[],fixedIds:fixed.map(f=>f.id)};
  const after=Object.assign({},before,{fixed:before.fixed.concat(fixed),lastHistImport:last});
  assert.equal(ctx.histCanUndo(after),true,"un lote de sólo recibos también se puede deshacer");
  const undone=ctx.histUndoBatch(after,last).nextState;
  delete undone.lastHistImport;
  assert.equal(JSON.stringify(undone),JSON.stringify(before),"se quita sólo el fijo nacido en este lote");
  assert.equal(JSON.stringify(ctx.histUndoBatch(after,last).cloudDeleteById),"[]","nunca mandar ids de recibos a borrar gastos");
});
for(const ent of ["sabadell","revolut"]) t("FIN02 conserva deuda, ahorro y ambigüedad en "+ent,()=> {
  const d=new Date(),date=d.toISOString().slice(0,10),s=estadoVacio();
  s.accounts=[{id:"daily",ent,role:"diario",spendFrom:true,monthlyInvest:50}];
  s.expenses=[{id:"near",date,amount:17,merchant:"Compra reconocible ficticia",ent}];
  s.debts=[{id:"debt",name:"Deuda ficticia",account:ent,monthly:30,value:1000,months:12,day:2,asOf:d.getFullYear()*12+d.getMonth()}];
  const before=JSON.stringify(s);
  const xs=[cand({id:"debt-tx",ent,merchant:"Deuda ficticia",amount:30,date}),cand({id:"investment",ent,merchant:"Fondo ficticio",amount:50,date}),cand({id:"ambiguous",ent,merchant:"",amount:17,date})];
  const rows=ctx.histClassifyCandidates(xs,s).rows;
  assert.equal(rows[0].debtId,"debt");assert.equal(rows[0].category,"deudas");assert.equal(rows[0].suggestRecibo,false);
  assert.equal(rows[1].category,"inversion");
  assert.equal(rows[2].status,"maybe");assert.equal(rows[2].match.id,"near");assert.equal(rows[2].defDest,null);
  const uncertain=ctx.histKeepAmbiguity({id:"uncertain",amount:17,ent},rows[2]);
  assert.equal(uncertain.possibleDup,true);assert.equal(ctx.expenseCountsBudget(uncertain,s),false);
  assert.equal(JSON.stringify(s),before,"clasificar nunca modifica saldos ni posiciones");
});
const built=fs.readFileSync(new URL("../public/index.html",import.meta.url),"utf8");
for(const [name,from,to] of [
  ["fijos sin identidad del lote", "if(opts.batchId) it.importBatchId=opts.batchId;", ""],
  ["undo conserva fijos del lote", "expenses:nextEx,fixed:nextFixed", "expenses:nextEx"],
  ["borra fijo previo por sólo id", "f&&f.importBatchId===batchId&&fixedIds.has(f.id)", "f&&fixedIds.has(f.id)"],
  ["tres recibos sin agrupar", "if(vistos[k]) return;", ""],
]) t("mutación causal: "+name,()=> {
  assert.equal(built.split(from).length,2,"mutación única y anclada al código real");
  const original=ctx;
  ctx=loadPureLogic(built.replace(from,to));
  try { assert.throws(()=>guards.find(g=>g.name.startsWith("FIN02 undo incluye")).fn(),assert.AssertionError,"el guardián debe tumbar este defecto"); }
  finally { ctx=original; }
});

if (failed) { console.error("\nhist-pagos-mensuales: " + failed + " fallo(s)"); process.exit(1); }
console.log("hist-pagos-mensuales: OK");
