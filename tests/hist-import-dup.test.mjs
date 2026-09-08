#!/usr/bin/env node
/**
 * IMPORTAR HISTÓRICO — duplicados de RECIBO dentro del propio lote.
 *
 * Caso real (2026-07-31): 3 meses de histórico de La Caixa, "aceptar todo", y Revolut (donde
 * vive el rol de Fijos) se fue a -9k. La causa: una factura recurrente (alquiler, seguro…)
 * aparece una vez por mes en el extracto — son 3 movimientos reales, pero la MISMA factura. Sin
 * dedupe entre candidatos del propio lote, "Recibo" se marcaba las 3 veces y creaba 3 Fijos
 * idénticos, cada uno cobrándose TODOS los meses en el motor (`monthNetForAccount`): la factura
 * se restaba 3 veces cada mes, para siempre.
 */
import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx = loadPureLogicFromFile();

function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}`); throw e; }
}

console.log("hist-import-dup");

const cand = (o) => Object.assign({ id: null, date: "2026-07-01", amount: 30, merchant: "SEGURO COCHE", note: "", card: false, ent: "revolut", kind: "out" }, o);

t("la misma factura repetida 3 meses: solo la más reciente (índice 0) queda sin marcar duplicado", () => {
  const cands = [
    cand({ date: "2026-07-28", merchant: "SEGURO COCHE" }),
    cand({ date: "2026-06-28", merchant: "SEGURO COCHE" }),
    cand({ date: "2026-05-28", merchant: "Seguro Coche" }),   // mismo comercio, mayúsculas distintas
  ];
  const dup = ctx.dedupeHistRecibos(cands);
  assert.equal(dup[0], undefined, "la primera ocurrencia (más reciente, cands ya viene ordenado desc) no es duplicado");
  assert.equal(dup[1], true);
  assert.equal(dup[2], true);
});

t("importes distintos no son la misma factura (no se dedupean)", () => {
  const cands = [
    cand({ date: "2026-07-28", amount: 30 }),
    cand({ date: "2026-06-28", amount: 45 }),
  ];
  const dup = ctx.dedupeHistRecibos(cands);
  assert.equal(dup[0], undefined);
  assert.equal(dup[1], undefined);
});

t("distinto banco (ent) no se dedupea aunque coincidan nombre e importe", () => {
  const cands = [
    cand({ date: "2026-07-28", ent: "revolut" }),
    cand({ date: "2026-06-28", ent: "caixabank" }),
  ];
  const dup = ctx.dedupeHistRecibos(cands);
  assert.equal(dup[0], undefined);
  assert.equal(dup[1], undefined);
});

t("las compras con tarjeta (kind:out, card:true) no entran en el dedupe de recibo", () => {
  const cands = [
    cand({ date: "2026-07-28", card: true, merchant: "Mercadona" }),
    cand({ date: "2026-06-28", card: true, merchant: "Mercadona" }),
  ];
  const dup = ctx.dedupeHistRecibos(cands);
  assert.equal(dup[0], undefined);
  assert.equal(dup[1], undefined);
});

t("los ingresos (kind:in) no entran en el dedupe de recibo", () => {
  const cands = [
    cand({ date: "2026-07-28", kind: "in", merchant: "NOMINA" }),
    cand({ date: "2026-06-28", kind: "in", merchant: "NOMINA" }),
  ];
  const dup = ctx.dedupeHistRecibos(cands);
  assert.equal(dup[0], undefined);
  assert.equal(dup[1], undefined);
});

/**
 * IMPORTAR HISTÓRICO — duplicados contra lo que YA GUARDASTE (2026-08-03).
 *
 * Rediseño de la pantalla (petición 3/8, «me parece anticuada comparada con el import de Excel»):
 * antes, un candidato que coincidía por día+importe+comercio con un gasto/ingreso ya guardado
 * (pero SIN ext_id, así que no era el mismo apunte literal) se descartaba en silencio dentro de
 * `BankHistoryImport.search()` — desaparecía de la lista sin explicación. Ahora se queda, marcado,
 * con el MISMO criterio que usa el import de Excel (`hojaClave`): día + importe con signo + comercio
 * normalizado. `histCandExisting` es la función compartida que hace esa comparación.
 */
console.log("\nhist-import-dup (contra lo ya guardado)");

const exp = (o) => Object.assign({ id: "e1", date: "2026-07-28T12:00:00.000Z", amount: 30, merchant: "Mercadona" }, o);

t("un candidato con el mismo día, importe y comercio (normalizado) que un gasto ya guardado se marca", () => {
  const cands = [cand({ date: "2026-07-28", amount: 30, merchant: "MERCADONA", kind: "out", card: true })];
  const existentes = [exp()];
  const dup = ctx.histCandExisting(cands, existentes);
  assert.equal(dup[0], existentes[0]);
});

t("mayúsculas y acentos distintos en el comercio no impiden el match", () => {
  const existente = exp();
  const cands = [cand({ date: "2026-07-28", amount: 30, merchant: "mercadóna", kind: "out", card: true })];
  const dup = ctx.histCandExisting(cands, [existente]);
  assert.equal(dup[0], existente);
});

t("importe distinto no se marca como duplicado", () => {
  const cands = [cand({ date: "2026-07-28", amount: 31, merchant: "Mercadona", kind: "out", card: true })];
  const dup = ctx.histCandExisting(cands, [exp()]);
  assert.equal(dup[0], undefined);
});

t("día distinto no se marca como duplicado", () => {
  const cands = [cand({ date: "2026-07-27", amount: 30, merchant: "Mercadona", kind: "out", card: true })];
  const dup = ctx.histCandExisting(cands, [exp()]);
  assert.equal(dup[0], undefined);
});

t("un ingreso no se confunde con un gasto del mismo día/importe/comercio (signo distinto)", () => {
  // El candidato es un INGRESO (kind:"in"): dentro de la app un ingreso es importe NEGATIVO,
  // así que no debe casar contra un gasto (positivo) aunque coincidan día/importe/comercio.
  const cands = [cand({ date: "2026-07-28", amount: 30, merchant: "Mercadona", kind: "in" })];
  const dup = ctx.histCandExisting(cands, [exp({ amount: 30 })]);
  assert.equal(dup[0], undefined, "gasto (+30) no es lo mismo que un ingreso (-30) del mismo día/comercio");
});

t("un ingreso SÍ casa contra un ingreso ya guardado (mismo signo negativo)", () => {
  const cands = [cand({ date: "2026-07-28", amount: 30, merchant: "Nomina julio", kind: "in" })];
  const existentes = [exp({ amount: -30, merchant: "Nomina julio" })];
  const dup = ctx.histCandExisting(cands, existentes);
  assert.equal(dup[0], existentes[0]);
});

t("sin coincidencia en absoluto: no se marca nada", () => {
  const cands = [cand({ date: "2026-07-28", amount: 30, merchant: "Mercadona", kind: "out", card: true })];
  const dup = ctx.histCandExisting(cands, [exp({ merchant: "Carrefour" })]);
  assert.equal(dup[0], undefined);
});

t("H: dos candidatos contra UN guardado → solo uno se marca (1:1)", () => {
  const existentes = [exp({ id: "solo" })];
  const cands = [
    cand({ date: "2026-07-28", amount: 30, merchant: "Mercadona", kind: "out", card: true }),
    cand({ date: "2026-07-28", amount: 30, merchant: "Mercadona", kind: "out", card: true }),
  ];
  const dup = ctx.histCandExisting(cands, existentes);
  assert.equal(dup[0], existentes[0]);
  assert.equal(dup[1], undefined, "el segundo no debe reusar el mismo gasto");
});

console.log("\nhist-import-motor (A/B/C/N/I/J)");

const baseState = () => ({
  accounts: [
    { id: "a1", ent: "sabadell", name: "Sabadell", role: "diario", spendFrom: true, monthlyInvest: 200, value: 1000 },
    { id: "a2", ent: "trade_republic", name: "TR", role: "fijos", value: 500 },
  ],
  expenses: [],
  investments: [{ id: "inv1", name: "Fondo", shares: 10, value: 1000, cost: 900, cur: "EUR" }],
  fixed: [],
  debts: [],
  oneoffs: [],
  flows: [{ id: "f1", kind: "transfer", to: "trade_republic", from: "sabadell", amount: 1500 }],
  deleted: [],
});

t("N: reconcileObDupes no recategoriza ni toca filas ob-hist", () => {
  const st = baseState();
  st.accounts[0].rewardInv = "inv1";
  st.expenses = [
    { id: "h1", date: "2026-09-01T12:00:00.000Z", amount: 5, merchant: "Movimiento", source: "ob-hist", ent: "sabadell", category: "otros" },
    { id: "h0", date: "2026-08-28T12:00:00.000Z", amount: -5, merchant: "Ingreso", source: "ob-hist", ent: "sabadell", category: "ingreso" },
  ];
  const before = st.expenses.map((e) => e.category);
  const delBefore = (st.deleted || []).length;
  const r = ctx.reconcileObDupes(st);
  assert.equal(r.borrar.length, 0);
  assert.equal(r.recat.length, 0, "ob-hist fuera del barrido cashback");
  assert.deepEqual(r.state.expenses.map((e) => e.category), before);
  assert.equal((r.state.deleted || []).length, delBefore, "nunca escribe tombstones");
});

t("C: traspaso propio → category traspaso (no ingreso)", () => {
  const st = baseState();
  const cands = [cand({ kind: "in", amount: 1620, merchant: "Ingreso", ent: "trade_republic", date: "2026-09-05", card: false })];
  const { rows } = ctx.histClassifyCandidates(cands, st);
  assert.equal(rows[0].status, "new");
  assert.equal(rows[0].category, "traspaso");
});

t("C: aporte ≈ monthlyInvest → inversion; investments intacto al build", () => {
  const st = baseState();
  const invBefore = JSON.parse(JSON.stringify(st.investments));
  const cands = [cand({ kind: "out", amount: 200, merchant: "APORTE", ent: "sabadell", date: "2026-09-05", card: true })];
  const { rows } = ctx.histClassifyCandidates(cands, st);
  assert.equal(rows[0].category, "inversion");
  const built = ctx.histBuildCommit(cands, rows, st);
  assert.equal(built.expAdds[0].category, "inversion");
  assert.deepEqual(st.investments, invBefore, "nunca applyInvestBuy");
  assert.deepEqual(built.investmentsSnapshot, invBefore);
});

t("I: matchesModeled usa el mes del candidato, no solo el mes actual", () => {
  const st = baseState();
  // Fijo que SOLO ocurre en mayo (day 5); candidato en mayo debe casar.
  st.fixed = [{ id: "luz", name: "Luz Endesa", amount: 45, day: 5, months: [5], account: "sabadell", ent: "sabadell" }];
  // Helper occursIn — si months vacío/undefined ocurre todos los meses; con [5] solo mayo.
  const cMay = cand({ date: "2026-05-05", amount: 45, merchant: "RECIBO ENDESA LUZ", ent: "sabadell", kind: "out", card: false });
  const cSep = cand({ date: "2026-09-05", amount: 45, merchant: "RECIBO ENDESA LUZ", ent: "sabadell", kind: "out", card: false });
  assert.ok(ctx.histMatchesModeled(st, cMay), "mayo casa con el fijo de mayo");
  assert.equal(ctx.histMatchesModeled(st, cSep), null, "septiembre no debe casar con fijo solo-mayo");
});

t("J: signo sospechoso si >70% ingresos en un banco (≥3 movs)", () => {
  const cands = [
    cand({ ent: "caixabank", kind: "in", amount: 10, date: "2026-09-01" }),
    cand({ ent: "caixabank", kind: "in", amount: 20, date: "2026-09-02" }),
    cand({ ent: "caixabank", kind: "in", amount: 30, date: "2026-09-03" }),
    cand({ ent: "caixabank", kind: "out", amount: 5, date: "2026-09-04", card: true }),
  ];
  const flagged = ctx.histSignSuspectByBank(cands);
  assert.equal(flagged.caixabank, true);
  const { signSuspect } = ctx.histClassifyCandidates(cands, baseState());
  assert.equal(signSuspect.caixabank, true);
});

t("A: undo con terna colisionante no mete el preexistente en cloudDeleteById", () => {
  const st = baseState();
  const pre = { id: "pre-uuid-1111-1111-1111-111111111111", date: "2026-09-10T12:00:00.000Z", amount: 12, merchant: "Cafe", source: "manual", ent: "sabadell" };
  st.expenses = [pre];
  const cands = [cand({ date: "2026-09-10", amount: 12, merchant: "Cafe", kind: "out", card: true, ent: "sabadell" })];
  // Clasifica como dup existing → no entra en commit. Simulamos el caso malo: build de un "new"
  // que choca, y cloudIds SOLO tiene el insertado (el preexistente nunca ACK).
  const fakeClass = [{ status: "new", defDest: "gasto", category: "ocio", suggestRecibo: false }];
  const built = ctx.histBuildCommit(cands, fakeClass, st, { batchId: "hist-test-a" });
  assert.equal(built.expAdds.length, 1);
  const inserted = built.expAdds[0];
  st.expenses = st.expenses.concat(inserted);
  // Solo el id insertado (ACK); el preexistente NO está — cierre A.
  const last = { batchId: "hist-test-a", localIds: [inserted.id], cloudIds: [inserted.id] };
  const undo = ctx.histUndoBatch(st, last);
  assert.ok(undo.cloudDeleteById.indexOf(pre.id) < 0);
  assert.ok(undo.cloudDeleteById.indexOf(inserted.id) >= 0);
  assert.ok(undo.nextState.expenses.some((e) => e.id === pre.id), "preexistente vivo");
  assert.ok(!undo.nextState.expenses.some((e) => e.id === inserted.id));
});

t("B: undo no escribe state.deleted", () => {
  const st = baseState();
  st.deleted = ["keep-me"];
  const e = { id: "b1", date: "2026-09-10T12:00:00.000Z", amount: 9, merchant: "X", source: "ob-hist", ent: "sabadell", importBatchId: "hist-b" };
  st.expenses = [e];
  const undo = ctx.histUndoBatch(st, { batchId: "hist-b", localIds: ["b1"], cloudIds: ["b1"] });
  assert.deepEqual(undo.nextState.deleted, ["keep-me"]);
  assert.equal((undo.nextState.deleted || []).length, 1);
});

t("A/B: undo vacío / idempotente → no-op declarado", () => {
  const st = baseState();
  const empty = ctx.histUndoBatch(st, null);
  assert.equal(empty.ok, false);
  const once = ctx.histUndoBatch(st, { batchId: "hist-z", localIds: [], cloudIds: [] });
  assert.equal(once.ok, true);
  const again = ctx.histUndoBatch(once.nextState, { batchId: "hist-z", localIds: [], cloudIds: [] });
  assert.equal(again.ok, true);
  assert.deepEqual(again.nextState.expenses, once.nextState.expenses);
});

t("híbrido C: cargo no-tarjeta default gasto (nunca recibo) y build no toca fixed", () => {
  const st = baseState();
  st.fixed = [{ id: "f1", name: "Alquiler", amount: 700, day: 1, account: "sabadell" }];
  const before = st.fixed.length;
  const cands = [cand({ kind: "out", card: false, amount: 42, merchant: "NETFLIX", ent: "sabadell", date: "2026-09-05" })];
  const { rows } = ctx.histClassifyCandidates(cands, st);
  assert.equal(rows[0].status, "new");
  assert.equal(rows[0].defDest, "gasto");
  assert.equal(rows[0].suggestRecibo, true);
  const built = ctx.histBuildCommit(cands, rows, st);
  assert.equal(built.fixAdds.length, 0);
  assert.equal(st.fixed.length, before);
  assert.equal(built.expAdds[0].category !== undefined, true);
});

t("A: ACK batch — terna colisionante no entra en kept ni en cloudIds", () => {
  const pre = "pre-uuid-1111-1111-1111-111111111111";
  const neu = "new-uuid-2222-2222-2222-222222222222";
  const adds = [
    { id: pre, merchant: "Cafe" },
    { id: neu, merchant: "Pan" },
  ];
  // Servidor solo ACK del nuevo (el preexistente chocó → no RETURNING)
  const ack = ctx.histApplyBatchAck(adds, [neu], { offline: false });
  assert.equal(ack.kept.length, 1);
  assert.equal(ack.kept[0].id, neu);
  assert.equal(ack.skipped.length, 1);
  assert.equal(ack.skipped[0].id, pre);
  assert.ok(ack.cloudIds.indexOf(pre) < 0);
  assert.ok(ack.cloudIds.indexOf(neu) >= 0);
});

/* Si PostgREST devolviera alguna vez el id de una fila preexistente (no solo INSERT),
   ese id NO puede acabar en cloudDeleteById: deshacer borraría un gasto ajeno (agujero A). */
t("A: ACK — id ajeno del servidor no va a cloudIds ni a undo", () => {
  const ours = "our-uuid-3333-3333-3333-333333333333";
  const alien = "alien-uuid-4444-4444-4444-444444444444";
  const adds = [{ id: ours, merchant: "Cafe" }];
  const ack = ctx.histApplyBatchAck(adds, [ours, alien], { offline: false });
  assert.equal(ack.kept.length, 1);
  assert.equal(ack.kept[0].id, ours);
  assert.ok(ack.cloudIds.indexOf(alien) < 0, "cloudIds no debe llevar el id ajeno");
  assert.ok(ack.cloudIds.indexOf(ours) >= 0);
  const st = baseState();
  st.expenses = [{ id: ours, importBatchId: "hist-alien", amount: 1, merchant: "Cafe", date: "2026-09-01T12:00:00.000Z", source: "ob-hist" },
    { id: alien, amount: 9, merchant: "Viejo", date: "2026-01-01T12:00:00.000Z", source: "manual" }];
  const undo = ctx.histUndoBatch(st, {
    batchId: "hist-alien",
    localIds: ack.kept.map(function(e){ return e.id; }),
    cloudIds: ack.cloudIds,
  });
  assert.ok(undo.cloudDeleteById.indexOf(alien) < 0, "undo no debe borrar el id ajeno");
  assert.ok(undo.nextState.expenses.some(function(e){ return e.id === alien; }), "gasto ajeno sigue en local");
});

t("A: servidor sin ids → kept vacío (se quita local)", () => {
  const adds = [{ id: "a1" }, { id: "a2" }];
  const ack = ctx.histApplyBatchAck(adds, [], { offline: false });
  assert.equal(ack.kept.length, 0);
  assert.equal(ack.skipped.length, 2);
});

t("A: offline → se conservan locales sin cloudIds", () => {
  const adds = [{ id: "a1" }];
  const ack = ctx.histApplyBatchAck(adds, [], { offline: true });
  assert.equal(ack.kept.length, 1);
  assert.equal(ack.cloudIds.length, 0);
  assert.equal(ack.offline, true);
});

t("B+lote: undo dos veces idempotente y cero deleted", () => {
  const st = baseState();
  st.deleted = ["keep"];
  const e1 = { id: "u1", importBatchId: "hist-x", amount: 1, merchant: "A", date: "2026-09-01T12:00:00.000Z", source: "ob-hist" };
  const e2 = { id: "u2", importBatchId: "hist-x", amount: 2, merchant: "B", date: "2026-09-02T12:00:00.000Z", source: "ob-hist" };
  const other = { id: "old", amount: 3, merchant: "C", date: "2026-08-01T12:00:00.000Z", source: "manual" };
  st.expenses = [e1, e2, other];
  const last = { batchId: "hist-x", localIds: ["u1", "u2"], cloudIds: ["u1", "u2"] };
  const once = ctx.histUndoBatch(st, last);
  assert.equal(once.ok, true);
  assert.equal(once.nextState.expenses.length, 1);
  assert.equal(once.nextState.expenses[0].id, "old");
  assert.deepEqual(once.nextState.deleted, ["keep"]);
  assert.deepEqual(once.cloudDeleteById, ["u1", "u2"]);
  const twice = ctx.histUndoBatch(once.nextState, last);
  assert.equal(twice.ok, true);
  assert.equal(twice.nextState.expenses.length, 1);
  assert.deepEqual(twice.nextState.deleted, ["keep"]);
});

console.log("\nhist-import-dup: OK");
