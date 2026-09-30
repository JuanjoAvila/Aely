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
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const cli = loadPureLogicFromFile();
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

console.log("beta-veredictos");

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

t("★ datos reales: las cinco nativas de 4.26.68 heredan su aprobación de 4.26.67", () => {
  const nativas = ["fin05-widget-reentrada", "fin05-pago-cerrada", "tr-descripcion-clasificacion", "widget-banco", "widget-app-cerrada"];
  const pack = cli.betaChecklist("4.26.68.1", "4.26.67", 48);
  for (const id of nativas) {
    const g = pack.tandas.find((x) => String(x.id) === "4.26.68/" + id);
    assert.ok(g, id + " sigue en la ronda con la APK estable 48");
    assert.equal(g.apk, 51);
    const r = cli.betaVerdictFor(g, [{ tanda: "4.26.67/" + id, verdict: "approved" }]);
    assert.equal(r && r.verdict, "approved", id + " no pide otra prueba");
  }
});

t("★ cada alias `desde` del repo lleva la huella del contenido y apunta a la MISMA tanda", () => {
  const notas = JSON.parse(fs.readFileSync(new URL("../src/data/release-notes.json", import.meta.url), "utf8"));
  let n = 0;
  for (const nota of notas) for (const g of nota.tandas || []) {
    if (!g.desde) continue;
    n++;
    const calc = cli.betaTandas({ tandas: [g] })[0].huella;
    assert.equal(g.huella, calc, `${nota.v}/${g.id}: el guion cambió tras fijar el alias; quita \`desde\` y pide veredicto nuevo`);
    for (const a of g.desde) assert.match(a, new RegExp("^\\d+\\.\\d+\\.\\d+/" + g.id + "$"), `${nota.v}/${g.id}: alias ajeno ${a}`);
  }
  assert.ok(n >= 5, "los alias de las cinco nativas siguen declarados");
});

t("el parte al servidor conserva la huella y descarta basura", () => {
  assert.equal(cli.mcBetaLog({ verdict: "approved", huella: "0a1b2c3d" }).huella, "0a1b2c3d");
  assert.equal(cli.mcBetaLog({ verdict: "approved", huella: "<script>" }).huella, undefined);
});

if (failed) { console.error(`\nbeta-veredictos: ${failed} fallo(s)`); process.exit(1); }
console.log("\nbeta-veredictos: OK");
