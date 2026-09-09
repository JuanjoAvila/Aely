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
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx = loadPureLogicFromFile();

let failed = 0;
function t(name, fn) {
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

if (failed) { console.error("\nhist-pagos-mensuales: " + failed + " fallo(s)"); process.exit(1); }
console.log("hist-pagos-mensuales: OK");
