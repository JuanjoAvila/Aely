#!/usr/bin/env node
/**
 * UN VEREDICTO SIGUE A LA TANDA, NO A SU NÚMERO DE VERSIÓN.
 *
 * Bug suyo, 30/9: aprobó las cinco tandas del widget/TR el 28/9, el 29/9 a las 15:38 y otra vez a
 * las 20:51. Cada promoción web movía esas tandas de versión (4.26.60 → 66 → 67 → 68) con el MISMO
 * texto, el parte se guardaba como «versión/id» y dejaba de casar: el panel y `npm run listo` las
 * volvían a dar por «sin probar».
 *
 * Contrato que clava este test (lo usan igual el panel y `listo`, vía `betaVerdictFor`):
 *   · trasladar sin cambiar contenido conserva el veredicto (huella, o alias `desde` auditado);
 *   · una revisión nueva (texto o `rev`) exige veredicto propio;
 *   · el veredicto más reciente manda: un rechazo posterior veta la aprobación anterior;
 *   · solo sale de revisión lo ENTREGADO: una tanda con `apk` sigue hasta que la APK estable la
 *     lleve, aunque la web de producción ya la haya adelantado;
 *   · las demás tandas, pendientes o rechazadas, no se tocan.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { betaRevision, betaNotes } from "../scripts/beta-revisions.mjs";
import { loadPureLogic, loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const mutation = process.argv.find(x => x.startsWith("--mutation="))?.split("=")[1];
const mutations = {
  "legacy-id": ['var ids=(g.codigo||g.rev>1?[]:[g.id]).concat(g.desde||[]);','var ids=[g.id].concat(g.desde||[]);'],
  "drop-code": ['+(codigo?":"+codigo:"")',''],
  "discard-rejection": ['if(sent[g.id]==="approved" &&','if(sent[g.id]!=="approved" ||'],
  "local-override": ['return sent;','return Object.assign(sent,store.get("_betaReview_"+pack.v+".1_v")||{});'],
  "ignore-receipts": ['if(g.codigo){','if(false){'],
};
let cli;
if(mutation) {
  const pair=mutations[mutation];
  assert.ok(pair,"mutación desconocida");
  const html=fs.readFileSync(new URL("../public/index.html",import.meta.url),"utf8");
  assert.equal(html.split(pair[0]).length,2,"la mutación debe tocar un único contrato");
  cli=loadPureLogic(html.replace(pair[0],pair[1]));
  cli.RELEASE_NOTES=betaNotes(JSON.parse(fs.readFileSync(new URL("../src/data/release-notes.json",import.meta.url),"utf8")));
} else cli=loadPureLogicFromFile();
let failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.error(`  ✗ ${name}\n      ${e.message}`); }
}
function conNotas(notas, fn) {
  const prev = cli.RELEASE_NOTES;
  try { cli.RELEASE_NOTES = notas; return fn(); } finally { cli.RELEASE_NOTES = prev; }
}
const tanda = (id, extra = {}) => Object.assign({ id, t: { es: "Tanda " + id }, items: { es: ["1. Probar " + id] } }, extra);
const ids = (pack) => Array.from(pack.tandas, (g) => String(g.id));

function conStore(values, fn) {
  const actualStore = vm.runInNewContext("store", cli);
  const oldGet = actualStore.get, oldLocal = cli.localStorage;
  const keys = Object.keys(values);
  actualStore.get = (k) => values[k] || null;
  cli.localStorage = { length: keys.length, key: (i) => keys[i] };
  try { return fn(); } finally { actualStore.get = oldGet; cli.localStorage = oldLocal; }
}

console.log("beta-veredictos");
const changedIds=["fin05-widget-reentrada","fin05-pago-cerrada","widget-banco","widget-app-cerrada"];
const readSource=f => fs.readFileSync(new URL("../"+f,import.meta.url),"utf8");
const registered=JSON.parse(readSource("scripts/beta-sources.json"));
const approvedIds=["fin05-widget-reentrada", "fin05-pago-cerrada", "tr-descripcion-clasificacion", "widget-banco", "widget-app-cerrada", "inc-2709-01-arranque-red", "inc-2809-02-ayuda-ciclo"];

t("un parte antiguo por id exacto no aprueba una revisión nueva", () => {
  const g = Object.assign({}, cli.betaTandas({ tandas: [tanda("w", { rev: 2 })] })[0], { id: "9.9.3/w" });
  assert.equal(cli.betaVerdictFor(g, [{ tanda: g.id, verdict: "approved" }]), null);
});

t("el digest automático cambia con el código aunque rev y guion no cambien", () => {
  const a = betaRevision("widget-app-cerrada", readSource);
  const b = betaRevision("widget-app-cerrada", f => readSource(f)+(f.endsWith("TrExpenseListener.java") ? "\n// corregido" : ""));
  assert.notEqual(a.codigo, b.codigo);
  const old = cli.betaTandas({ tandas: [tanda("w", a)] })[0];
  const nueva = cli.betaTandas({ tandas: [tanda("w", b)] })[0];
  assert.notEqual(old.huella, nueva.huella);
  assert.equal(cli.betaVerdictFor(nueva, [{ huella: old.huella, verdict: "approved" }]), null);
});

t("versión superior y APK superior no prueban la entrega de esa revisión", () => {
  const g = Object.assign({ id: "9.9.3/w", apk: 51 }, betaRevision("widget-app-cerrada", readSource));
  cli.window._mcProdEntregas = { web: { w: g.web } };
  cli.window._mcProdApkRevisiones = { w: "otra-revision" };
  assert.equal(cli.betaSinEntregar(g, 9999), true);
  cli.window._mcProdApkRevisiones = { w: g.native };
  assert.equal(cli.betaSinEntregar(g, 51), true, "falta acreditar Edge");
  cli.window._mcProdEntregas.edge = { w: g.edge };
  assert.equal(cli.betaSinEntregar(g, 51), false);
  cli.window._mcProdEntregas.web.w = "otra-revision";
  assert.equal(cli.betaSinEntregar(g, 51), true);
  cli.window._mcProdEntregas = null;
  cli.window._mcProdApkRevisiones = null;
});

t("una traducción ajena no cambia el widget; un helper financiero sí", () => {
  const g=betaRevision("widget-app-cerrada",readSource);
  const label=betaRevision("widget-app-cerrada",f => readSource(f).replace('beta_revoked:"↺ Veredicto retirado"','beta_revoked:"Otro texto"'));
  const money=betaRevision("widget-app-cerrada",f => readSource(f).replace('function expenseCountsBudget(e, s){','function expenseCountsBudget(e, s){ /* nueva regla */'));
  assert.equal(g.codigo,label.codigo);
  assert.notEqual(g.codigo,money.codigo);
  assert.throws(() => betaRevision("widget-app-cerrada",f => f.endsWith("01-i18n.js") ? "bloque ausente" : readSource(f)),/Bloque beta/);
});

t("una compilación sin marcas propias no borra los puntos heredados de la misma revisión", () => {
  const g=Object.assign({},cli.betaTandas({tandas:[tanda("w",{codigo:"a".repeat(64)})]})[0],{id:"9.9.3/w"});
  const pack={v:"9.9.3",tandas:[g],items:g.items};
  conStore({_betaReviewOk:{[g.items[0]]:"ok"},_betaMarksHuella:{[g.items[0]]:g.huella}},()=>{
    const inherited=cli.betaStoredMarks(pack),own=cli.betaScopedMarks(pack,{},true);
    assert.equal(Object.assign({0:inherited[g.items[0]]},own)[0],"ok");
  });
});

t("retirada remota más reciente impide que listo reutilice el OK", () => {
  const g = cli.betaTandas({ tandas: [tanda("w")] })[0];
  const parts = [{ huella: g.huella, verdict: "revoked" }, { huella: g.huella, verdict: "approved" }];
  assert.equal(cli.betaVerdictFor(g, parts), null);
  assert.equal(cli.mcBetaLog(parts[0]).verdict, "revoked");
});

t("CLI real: revocación remota, rechazo histórico exacto y entrega desconocida", () => {
  const pack=cli.betaChecklist("4.26.75.1","4.26.67",48);
  const g=pack.tandas.find(x => x.id.endsWith("/inc-3009-01-cargos"));
  const rows=[
    {created_at:"2026-09-30T22:00:00Z",detail:{tanda:g.id,huella:g.huella,verdict:"revoked"}},
    {created_at:"2026-09-30T21:00:00Z",detail:{tanda:g.id,huella:g.huella,verdict:"approved"}},
    {created_at:"2026-09-29T20:00:00Z",detail:{tanda:"4.26.71/inc-3009-01-cargos",verdict:"rejected"}},
    ...pack.tandas.filter(x=>approvedIds.includes(x.id.split("/").pop())).map(x=>({created_at:"2026-09-29T19:00:00Z",detail:{tanda:x.historial[0],verdict:"approved"}})),
  ];
  const script=`
    process.argv=[process.execPath,'fixture','--json'];
    globalThis.fetch=async url => {
      const u=String(url);
      if(u.includes('/rest/v1/')) return Response.json(${JSON.stringify(rows)});
      if(u.endsWith('beta-delivery.json')) return new Response('',{status:404});
      if(u.endsWith('apk.json')) return Response.json({versionCode:48});
      return Response.json({version:u.includes('/beta/')?'4.26.75.1':'4.26.67'});
    };
    await import('./scripts/listo-para-produccion.mjs');`;
  const data=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',script],{
    cwd:new URL('..',import.meta.url),encoding:'utf8',env:{...process.env,SUPABASE_SERVICE_ROLE_KEY:'synthetic-test-key',SUPABASE_URL:'https://synthetic.invalid'}
  }));
  const actual=data.tandas.find(x=>x.corto==='inc-3009-01-cargos');
  assert.equal(actual.estado,'sin probar');
  assert.equal(actual.rechazoAnterior.tanda,'4.26.71/inc-3009-01-cargos');
  assert.equal(actual.entregaPendiente,true);
  assert.equal(data.tandas.filter(x=>x.estado==="approved").length,3,"solo las tres revisiones idénticas conservan el OK aunque falten recibos de entrega");
});

t("el rechazo local sobrevive al traslado y veta el OK más antiguo", () => {
  const g = Object.assign({}, cli.betaTandas({ tandas: [tanda("w")] })[0], { id: "9.9.4/w", desde: ["9.9.3/w"] });
  const result = conStore({
    "_betaReview_9.9.2.1_v": { _h: 1, ["h:" + g.huella]: "approved" },
    "_betaReview_9.9.3.1_v": { _h: 1, ["h:" + g.huella]: "rejected" },
  }, () => cli.betaSavedVerdicts({ v: "9.9.4", tandas: [g] }, "_betaReview_9.9.4.1"));
  assert.equal(result[g.id], "rejected");
});

t("el store de esta compilación tampoco puede pisar una huella nueva", () => {
  const g = Object.assign({}, cli.betaTandas({ tandas: [tanda("w", { rev: 2 })] })[0], { id: "9.9.3/w" });
  const result = conStore({
    "_betaReview_9.9.3.1_v": { _h: 1, [g.id]: "approved", "h:deadbeef": "approved" },
    _betaReviewOk: { [g.items[0]]: "ok" },
  }, () => cli.betaSavedVerdicts({ v: "9.9.3", tandas: [g] }, "_betaReview_9.9.3.1"));
  assert.equal(result[g.id], undefined);
});

t("los ✓ de otra revisión no rellenan la revisión nueva", () => {
  const g = cli.betaTandas({ tandas: [tanda("w", { codigo: "a".repeat(64) })] })[0];
  const pack = { tandas:[g], items:g.items };
  const count = conStore({ _betaReviewOk:{[g.items[0]]:"ok"}, _betaMarksHuella:{[g.items[0]]:"old"} }, () => cli.betaMarksCount(pack));
  assert.equal(count.n,0);
});

t("la última decisión local manda aunque se tome desde una compilación anterior", () => {
  const g = cli.betaTandas({ tandas: [tanda("w")] })[0];
  const result = conStore({
    "_betaReview_9.9.2.1_v":{_h:1,["h:"+g.huella]:{verdict:"rejected",at:200}},
    "_betaReview_9.9.3.1_v":{_h:1,["h:"+g.huella]:{verdict:"approved",at:100}},
  }, () => cli.betaSavedVerdicts({tandas:[g],items:g.items,v:"9.9.3"},"_betaReview_9.9.3.1"));
  assert.equal(result[g.id],"rejected");
});

t("mover una tanda de versión no cambia su huella; cambiar guion o rev sí", () => {
  const a = cli.betaTandas({ tandas: [tanda("w")] })[0];
  const b = cli.betaTandas({ tandas: [tanda("w")] })[0];
  const texto = cli.betaTandas({ tandas: [tanda("w", { items: { es: ["1. Otro paso"] } })] })[0];
  const rev = cli.betaTandas({ tandas: [tanda("w", { rev: 2 })] })[0];
  const otra = cli.betaTandas({ tandas: [tanda("x", { t: { es: "Tanda w" }, items: { es: ["1. Probar w"] } })] })[0];
  assert.match(a.huella, /^[0-9a-f]{8}$/);
  assert.equal(a.huella, b.huella);
  assert.notEqual(a.huella, texto.huella, "otro guion es otra revisión");
  assert.notEqual(a.huella, rev.huella, "rev distingue un cambio de código con el mismo guion");
  assert.notEqual(a.huella, otra.huella, "el id forma parte de la identidad");
});

t("★ traslado con la misma huella conserva la aprobación (sin alias)", () => {
  const g = Object.assign({}, cli.betaTandas({ tandas: [tanda("w")] })[0], { id: "9.9.3/w" });
  const r = cli.betaVerdictFor(g, [{ tanda: "9.9.1/w", huella: g.huella, verdict: "approved" }]);
  assert.equal(r && r.verdict, "approved");
});

t("★ revisión nueva exige veredicto propio: la huella vieja no aplica aunque el id coincida", () => {
  const vieja = cli.betaTandas({ tandas: [tanda("w")] })[0];
  const nueva = Object.assign({}, cli.betaTandas({ tandas: [tanda("w", { rev: 2 })] })[0], { id: "9.9.3/w" });
  assert.equal(cli.betaVerdictFor(nueva, [{ tanda: "9.9.3/w", huella: vieja.huella, verdict: "approved" }]), null);
});

t("★ el rechazo posterior veta la aprobación anterior (y al revés)", () => {
  const g = Object.assign({}, cli.betaTandas({ tandas: [tanda("w")] })[0], { id: "9.9.3/w" });
  const rows = [{ tanda: "9.9.3/w", huella: g.huella, verdict: "rejected" },
    { tanda: "9.9.2/w", huella: g.huella, verdict: "approved" }];
  assert.equal(cli.betaVerdictFor(g, rows).verdict, "rejected");
  assert.equal(cli.betaVerdictFor(g, rows.slice().reverse()).verdict, "approved");
});

t("★ «cambiar de opinión» (parte nulo más reciente) retira la aprobación anterior", () => {
  const g = Object.assign({}, cli.betaTandas({ tandas: [tanda("w")] })[0], { id: "9.9.3/w" });
  const rows = [{ huella: g.huella, verdict: null }, { tanda: "9.9.2/w", huella: g.huella, verdict: "approved" }];
  assert.equal(cli.betaVerdictFor(g, rows), null);
});

t("★ partes antiguos sin huella: solo casan por id exacto o por `desde` con la huella fijada", () => {
  const base = tanda("w");
  const h = cli.betaTandas({ tandas: [base] })[0].huella;
  const conAlias = Object.assign({}, cli.betaTandas({ tandas: [Object.assign({}, base, { desde: ["9.9.1/w"], huella: h })] })[0], { id: "9.9.3/w" });
  const partes = [{ tanda: "9.9.1/w", verdict: "approved" }];
  assert.equal(cli.betaVerdictFor(conAlias, partes).verdict, "approved");
  // Si el guion cambia después de escribir el alias, la huella fijada ya no cuadra y el alias muere.
  const cambiado = Object.assign({}, base, { items: { es: ["1. Paso corregido"] }, desde: ["9.9.1/w"], huella: h });
  const g2 = Object.assign({}, cli.betaTandas({ tandas: [cambiado] })[0], { id: "9.9.3/w" });
  assert.deepEqual(Array.from(g2.desde), []);
  assert.equal(cli.betaVerdictFor(g2, partes), null);
  // Sin alias, un parte de otra versión no casa por sufijo.
  const sinAlias = Object.assign({}, cli.betaTandas({ tandas: [base] })[0], { id: "9.9.3/w" });
  assert.equal(cli.betaVerdictFor(sinAlias, partes), null);
});

const ronda = [
  { v: "9.9.4", t: { es: "Web nueva" }, tandas: [tanda("web-nueva")] },
  { v: "9.9.3", t: { es: "Mezcla" }, tandas: [tanda("web-vieja"), tanda("nativa", { apk: 51 })] },
];

t("★ producción web no limpia la nativa pendiente de APK; sí la tanda web que ya entregó", () => {
  const pack = conNotas(ronda, () => cli.betaChecklist("9.9.4.1", "9.9.3", 48));
  assert.deepEqual(ids(pack).sort(), ["9.9.3/nativa", "9.9.4/web-nueva"]);
});

t("★ sin dato de la APK estable, la nativa sigue pendiente (en la duda, se pregunta)", () => {
  const pack = conNotas(ronda, () => cli.betaChecklist("9.9.4.1", "9.9.3", null));
  assert.ok(ids(pack).includes("9.9.3/nativa"));
});

t("★ entrega acreditada (web y APK estable) limpia la nativa; las ajenas sobreviven", () => {
  const pack = conNotas(ronda, () => cli.betaChecklist("9.9.4.1", "9.9.3", 51));
  assert.deepEqual(ids(pack), ["9.9.4/web-nueva"]);
  const todo = conNotas(ronda, () => cli.betaChecklist("9.9.4.1", "9.9.4", 51));
  assert.deepEqual(ids(todo), []);
});

t("★ el veredicto no saca nada del panel: aprobar no es publicar", () => {
  const pack = conNotas(ronda, () => cli.betaChecklist("9.9.4.1", "9.9.2", 48));
  assert.deepEqual(ids(pack).sort(), ["9.9.3/nativa", "9.9.3/web-vieja", "9.9.4/web-nueva"]);
});

t("★ tres fuentes idénticas conservan OK; cuatro cambios web conservan historia y exigen nueva revisión", () => {
  const pack=cli.betaChecklist("4.26.75.1","4.26.67",48);
  for(const id of approvedIds) {
    const g=pack.tandas.find(x=>String(x.id).split("/").pop()===id);
    assert.ok(g,id+" sigue pendiente de entrega");
    assert.ok(g.historial.length,id+" conserva historia");
    const part=cli.betaVerdictFor(g,[{tanda:g.historial[0],verdict:"approved"}]);
    if(changedIds.includes(id)) {
      assert.equal(part,null,id+" no reutiliza la aprobación anterior");
      assert.deepEqual(Array.from(g.cambio),["web"]);
      assert.equal(g.desde.length,0);
      assert.notEqual(g.codigo,JSON.parse(readSource("src/data/release-notes.json")).flatMap(n=>n.tandas||[]).find(x=>x.id===id&&x.codigoDesde).codigoDesde);
      for(const surface of ["native","edge"]) if(g[surface]) assert.equal(g[surface],registered[id].auditoria.revisiones[surface]);
    } else {
      assert.equal(part.verdict,"approved",id);
      assert.equal(g.cambio.length,0);
      assert.equal(g.codigo,registered[id].auditoria.ampliada.codigo);
    }
    assert.ok(registered[id].auditoria.sha,"la auditoría histórica sigue fijada");
  }
});

t("★ cada alias `desde` del repo lleva la huella del contenido y apunta a la MISMA tanda", () => {
  const notas = betaNotes(JSON.parse(fs.readFileSync(new URL("../src/data/release-notes.json", import.meta.url), "utf8")));
  for (const nota of notas) for (const g of nota.tandas || []) {
    if (!g.desde) continue;
    const calc = cli.betaHuella(g.id, cli.rnT(g.t,"es"), cli.rnItems(g,"es"), g.rev);
    assert.equal(g.huella, calc, `${nota.v}/${g.id}: el guion cambió tras fijar el alias; quita \`desde\` y pide veredicto nuevo`);
    assert.equal(g.codigoDesde, g.codigo, `${nota.v}/${g.id}: el código cambió; retira el alias y exige veredicto nuevo`);
    assert.match(registered[g.id].auditoria.sha,/^[0-9a-f]{40}$/);
    for (const a of g.desde) assert.match(a, new RegExp("^\\d+\\.\\d+\\.\\d+/" + g.id + "$"), `${nota.v}/${g.id}: alias ajeno ${a}`);
  }
});

t("cambiar web, Android o Edge invalida el alias y señala solo la superficie afectada",()=>{
  const historical=JSON.parse(readSource("src/data/release-notes.json")).flatMap(n=>n.tandas||[]).find(g=>g.id==="widget-app-cerrada");
  // Referencia sintética vigente para aislar cada mutación; el repo conserva la aprobación antigua.
  const current=betaRevision(historical.id,readSource);
  const source=Object.assign({},historical,{desde:["9.9.1/"+historical.id],codigoDesde:current.codigo,revisionesDesde:Object.fromEntries(Object.entries(current).filter(([key])=>["web","native","edge"].includes(key)))});
  const edits={web:['src/modules/01-i18n.js','function expenseCountsBudget(e, s){','function expenseCountsBudget(e, s){ /* cambio */'],native:['android/app/src/main/java/com/micartera/app/TrExpenseListener.java',null,null],edge:['supabase/functions/_shared/wallet.ts',null,null]};
  for(const surface of Object.keys(edits)) {
    const [file,from,to]=edits[surface];
    const revision=betaRevision(source.id,f=>f!==file?readSource(f):from?readSource(f).replace(from,to):readSource(f)+'\n// cambio');
    const g=cli.betaTandas({tandas:[Object.assign({},source,revision)]})[0];
    assert.deepEqual(Array.from(g.cambio),[surface]);
    assert.equal(g.desde.length,0);
    assert.equal(cli.betaVerdictFor(g,[{tanda:source.desde[0],verdict:"approved"}]),null);
  }
});

t("los helpers de Inicio y el vínculo/representación de Recibos forman parte del digest",()=>{
  const cases=[
    ["inc-3009-01-cargos","src/modules/00-core.js","const CAT_NEUTRAS ="],
    ["inc-2909-02-inicio-natural","src/modules/08-motor-bank.js","function dashboardBudgetStats("],
    ["inc-3009-01-cargos","src/modules/08-motor-bank.js","function fixedPaymentIdentity("],
    ["inc-3009-01-cargos","src/modules/04-tab-gastos.js","  const setReceipt=function("],
    ["inc-3009-01-cargos","src/modules/14-v4-screens.js","  const changedPaid=function("]
  ];
  for(const [id,file,marker] of cases) {
    assert.equal(readSource(file).split(marker).length,2,"mutación única: "+marker);
    const before=betaRevision(id,readSource);
    const after=betaRevision(id,f=>f===file?readSource(f).replace(marker,marker+" /* mutación */"):readSource(f));
    assert.notEqual(before.web,after.web,id+" cambia por "+marker);
  }
});

t("el parte al servidor conserva la huella y descarta basura", () => {
  assert.equal(cli.mcBetaLog({ verdict: "approved", huella: "0a1b2c3d" }).huella, "0a1b2c3d");
  assert.equal(cli.mcBetaLog({ verdict: "approved", huella: "<script>" }).huella, undefined);
});

if (failed) { console.error(`\nbeta-veredictos: ${failed} fallo(s)`); process.exit(1); }
console.log("\nbeta-veredictos: OK");
