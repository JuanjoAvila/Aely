#!/usr/bin/env node
/** Plan › Recibos v6, tanda 6: resumen del mes cerrado (SPEC §2.1).
 *  La cifra tiene que ser la que Plan enseñaba el último día de ese mes, aunque después se den de
 *  alta o de baja recibos o el extracto ya no traiga el mes (revisión NO-GO del 31/10/2026, B1/B2).
 *  Se comprueba en céntimos por dos vías independientes: (A) la cuenta a mano del escenario y
 *  (B) lo que pintaba Plan › Recibos con el reloj en el último día: «Ya pagados» (`planRecibosVista`
 *  de 14) más lo que cobró distinto en «Para revisar». Lo que no se puede acreditar es «—» (null). */
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const c = loadPureLogicFromFile();
// La vista de Plan vive en 14 (fuera del corte de la lógica pura): se carga aparte para la vía B.
vm.runInNewContext(fs.readFileSync(new URL("../src/modules/14-v4-screens.js", import.meta.url), "utf8"), c);
let reloj;
const pon = (iso) => { reloj = new Date(iso); };
pon("2026-11-03T12:00:00+01:00");
c.Date = class extends Date {
  constructor(...args){ super(...(args.length?args:[reloj.getTime()])); }
  static now(){ return reloj.getTime(); }
};
const cent = (n) => Math.round(Number(n) * 100);
// El motor vive en otro contexto de vm: sus objetos no comparten prototipo con los de aquí.
const same = (a, b, msg) => assert.equal(JSON.stringify(a), JSON.stringify(b), msg);
const gasto = (id, merchant, date, amount, extra) => Object.assign({ id, merchant, date, amount, ent: "sabadell", category: "otros", source: "ob", status: "BOOK" }, extra || {});

/* Escenario inventado. Lo previsto (tu parte) y lo que cobró el banco:
   | recibo                 | previsto | sep cobro | oct cobro |
   | Luz (cambia cada mes)  | 50,00    | 45,10     | 58,30     |
   | Netflix                | 12,99    | 12,99     | 13,99     |
   | Gimnasio               | 40,00    | 40,00     | —  (no llegó)
   | Agua (compartido 30)   | 20,00    | 30,00     | 30,00     |
   | Coche (cuota)          | 100,00   | 100,00    | 100,00    |
   | Dentista (puntual oct) | 90,00    |           | sin cargo |
   Un movimiento del banco el 30 de cada mes (supermercado) dice que el extracto cubre el mes. */
const fixed = [
  { id: "luz", name: "Luz", amount: 50, variable: true, freq: "mes", day: 5, account: "sabadell" },
  { id: "nfx", name: "Netflix", amount: 12.99, freq: "mes", day: 10, account: "sabadell" },
  { id: "gym", name: "Gimnasio", amount: 40, freq: "mes", day: 2, account: "sabadell" },
  { id: "agua", name: "Agua", amount: 20, bankAmount: 30, freq: "mes", day: 15, account: "sabadell" },
];
const debts = [{ id: "coche", name: "Coche", monthly: 100, value: 4000, original: 6000, months: 40, day: 1, account: "sabadell" }];
const oneoffs = [{ id: "den", name: "Dentista", amount: 90, year: 2026, month: 10, day: 20, account: "sabadell" }];
const expenses = [
  gasto("s-luz", "IBERDROLA CLIENTES", "2026-09-05", 45.10), gasto("s-nfx", "NETFLIX.COM", "2026-09-10", 12.99),
  gasto("s-gym", "FITNESS PARK", "2026-09-02", 40), gasto("s-agua", "CANAL DE AGUAS", "2026-09-15", 30),
  gasto("s-coche", "PRESTAMO CUOTA", "2026-09-01", 100, { category: "deudas", debtId: "coche" }),
  gasto("s-super", "SUPERMERCADO", "2026-09-30", 23.4, { category: "super" }),
  gasto("o-luz", "IBERDROLA CLIENTES", "2026-10-05", 58.30), gasto("o-nfx", "NETFLIX.COM", "2026-10-10", 13.99),
  gasto("o-agua", "CANAL DE AGUAS", "2026-10-15", 30),
  gasto("o-coche", "PRESTAMO CUOTA", "2026-10-01", 100, { category: "deudas", debtId: "coche" }),
  gasto("o-super", "SUPERMERCADO", "2026-10-30", 31.2, { category: "super" }),
];
let s = { accounts: [{ id: "sb", ent: "sabadell", role: "fijos", value: 3000 }], fixed, debts, oneoffs, flows: [], bankTx: [], expenses, settings: {} };
// Los cargos se enlazan como en «¿Cuál es el cargo?»: es la prueba que queda guardada en el recibo.
for (const [exp, rec, m, fin] of [["s-luz","luz",9,30],["s-nfx","nfx",9,30],["s-gym","gym",9,30],["s-agua","agua",9,30],
  ["o-luz","luz",10,31],["o-nfx","nfx",10,31],["o-agua","agua",10,31]]) {
  // Con nombre y céntimos exactos el motor ya lo casa solo y enlazar no cambia nada.
  s = c.linkFixedPayment(s, exp, rec, 2026, m, fin);
  const st = c.fixedPaymentState(s, s.fixed.find((f) => f.id === rec), 2026, m, fin);
  assert.ok(st.paid && st.paidAmount === s.expenses.find((x) => x.id === exp).amount, "pagado con " + exp);
}

console.log("plan-recibos-cerrado");

// Vía B: lo que Plan › Recibos pintaba el último día. También es cuando se guarda la foto.
const vistoEl = (st, iso, y, m, fin) => {
  pon(iso);
  const pack = c.planChargesMonth(st, m, y, fin), proof = c.paymentEvidenceUI(st, y, m, fin);
  const avisos = c.planRecibosAvisos(st, pack, proof, y, m, fin), v = c.planRecibosVista(pack, proof, fin, avisos, {});
  const distinto = v.review.filter((x) => x.rv === "diff" || x.rv === "up").reduce((t, x) => t + cent(Math.abs(x.amount)), 0);
  return { cent: cent(v.paidTotal) + distinto, late: v.review.filter((x) => x.rv === "late").length, foto: c.planRecibosConFoto(st, y, m, fin, pack, proof) };
};
const bSep = vistoEl(s, "2026-09-30T21:00:00+02:00", 2026, 9, 30); s = bSep.foto;
const bOct = vistoEl(s, "2026-10-31T21:00:00+01:00", 2026, 10, 31); s = bOct.foto;
pon("2026-11-03T12:00:00+01:00");
assert.ok(s.settings.pr6Fotos[2026 * 12 + 9] && s.settings.pr6Fotos[2026 * 12 + 10], "fotos de septiembre y octubre");

// Vía A: la cuenta a mano. Octubre: Luz 50 + Netflix 12,99 + Agua 20 (tu parte) + Coche 100.
const A_OCT = 5000 + 1299 + 2000 + 10000, A_SEP = A_OCT + 4000, OCT_YM = 2026 * 12 + 10;
const r = c.planRecibosMesCerrado(s, 2026, 11);
assert.ok(r, "hay resumen de octubre");
assert.equal(r.y, 2026); assert.equal(r.m, 10); assert.equal(r.ym, 2026 * 12 + 10);
assert.equal(r.cent, A_OCT, "en recibos (A)");
same(r.prev, { y: 2026, m: 9, cent: A_SEP }, "septiembre (A)");
assert.equal(bOct.cent, r.cent, "octubre (B) = resumen");
assert.equal(bSep.cent, r.prev.cent, "septiembre (B) = resumen");
// «No llegó» es solo lo pendiente con el banco al día: el Gimnasio. El puntual sin cargo no.
assert.equal(r.noLlegaron, 1, "solo el Gimnasio");
assert.equal(bOct.late, 1, "Plan lo enseñaba como «No ha llegado»");
same(r.sube, { id: "fixed_luz", name: "Luz", cent: 5830 - 4510 }, "el que más subió contra septiembre, con el cargo real");
same(r.cambia, { id: "fixed_nfx", name: "Netflix", cent: 100 }, "Netflix cobró 1,00 más de lo previsto; Luz cambia cada mes y no cuenta");
assert.equal(r.cent - r.prev.cent, -4000, "40,00 menos que septiembre: el Gimnasio no llegó");

// B1 · ALTA posterior: un recibo dado de alta el 2/11 no existía en octubre ni en septiembre.
{
  pon("2026-11-02T10:00:00+01:00");
  const alta = c.conMesDeAlta({ id: "com", name: "Comunidad", amount: 60, freq: "mes", day: 4, account: "sabadell" });
  pon("2026-11-03T12:00:00+01:00");
  assert.equal(alta.createdYm, 2026 * 12 + 11);
  const e = c.planRecibosMesCerrado(Object.assign({}, s, { fixed: s.fixed.concat([alta]) }), 2026, 11);
  same([e.cent, e.prev.cent, e.noLlegaron], [A_OCT, A_SEP, 1], "el alta de noviembre no toca octubre ni septiembre");
}
// B1 · BAJA en octubre de un recibo pagado en septiembre: septiembre se queda como fue.
{
  const sinGym = Object.assign({}, s, { fixed: s.fixed.filter((f) => f.id !== "gym") });
  const e = c.planRecibosMesCerrado(sinGym, 2026, 11);
  assert.equal(e.prev.cent, A_SEP, "la foto de septiembre conserva el Gimnasio pagado");
  assert.equal(e.noLlegaron, 1, "y en octubre sigue sin haber llegado");
}
// B2 · Sin foto del mes anterior: no se compara con una cifra que puede ser más baja que la real.
{
  const fotos = Object.assign({}, s.settings.pr6Fotos); delete fotos[2026 * 12 + 9];
  const e = c.planRecibosMesCerrado(Object.assign({}, s, { settings: { pr6Fotos: fotos } }), 2026, 11);
  assert.equal(e.cent, A_OCT);
  // Rechazo 206: sin foto, septiembre SÍ se acredita si todo lo que tocaba tiene su prueba guardada.
  assert.equal(e.prev.cent, A_SEP, "septiembre sin foto pero todo pagado con prueba guardada");
  // La prueba guardada vale aunque la fila de Gastos ya no esté (viaja en el recibo).
  const sinFila = Object.assign({}, s, { settings: { pr6Fotos: fotos }, expenses: s.expenses.filter((x) => x.id !== "s-gym") });
  assert.equal(c.planRecibosMesCerrado(sinFila, 2026, 11).prev.cent, A_SEP, "prueba guardada sin la fila");
  // Uno sin prueba guardada ni fila (el Gimnasio) → «sin datos», no una cifra más baja.
  const sinGymSep = Object.assign({}, sinFila, { fixed: s.fixed.map((f) => {
    if (f.id !== "gym") return f;
    const pp = Object.assign({}, f.paymentProofs); delete pp[2026 * 12 + 9];
    const n = Object.assign({}, f, { paymentProofs: pp }); delete n.paidYm; delete n.paidDay; return n; }) });
  assert.equal(c.planRecibosMesCerrado(sinGymSep, 2026, 11).prev.cent, null, "falta una prueba: sin datos");
  // Un recibo borrado desde el 1 de septiembre: su pago ya no está en ninguna lista → sin datos.
  const borrado = Object.assign({}, s, { settings: { pr6Fotos: fotos }, reciboBorrado: { viejo: { d: 0, n: "Viejo" } }, reciboBorradoAt: { viejo: new Date("2026-10-12T10:00:00+02:00").getTime() } });
  assert.equal(c.planRecibosMesCerrado(borrado, 2026, 11).prev.cent, null, "borrado después del 1/9: sin datos");
  const antiguo = Object.assign({}, borrado, { reciboBorradoAt: { viejo: new Date("2026-08-12T10:00:00+02:00").getTime() } });
  assert.equal(c.planRecibosMesCerrado(antiguo, 2026, 11).prev.cent, A_SEP, "borrado antes de septiembre: no afecta");
  // Un gasto de septiembre que apunta a un recibo que ya no existe → sin datos.
  const huerfano = Object.assign({}, s, { settings: { pr6Fotos: fotos }, expenses: s.expenses.concat([gasto("s-x", "OTRO", "2026-09-20", 9, { reciboId: "nadie" })]) });
  assert.equal(c.planRecibosMesCerrado(huerfano, 2026, 11).prev.cent, null, "cargo de un recibo que ya no está: sin datos");
}
/* Rechazo 206 · Estado realista: septiembre pagado por BOOK casado con tolerancia y guardado en el
   recibo (`paymentProofs` + `paidYm` de `planSyncDerived`), sin foto de septiembre y con el
   extracto ya caducado el 3/11. La comparación sale y cuadra al céntimo con la cuenta a mano. */
{
  const recs = [
    { id: "hip", name: "Seguro hogar", amount: 31.5, freq: "mes", day: 4, account: "sabadell" },
    { id: "tel", name: "Movistar", amount: 45.9, freq: "mes", day: 12, account: "sabadell" },
    { id: "gas", name: "Naturgy", amount: 38, freq: "mes", day: 20, account: "sabadell", variable: true },
  ];
  const sepTx = [
    { id: "b1", ent: "sabadell", date: "2026-09-04", amount: 31.5, merchant: "Seguro hogar", status: "BOOK" },
    { id: "b2", ent: "sabadell", date: "2026-09-12", amount: 45.9, merchant: "Movistar", status: "BOOK" },
    { id: "b3", ent: "sabadell", date: "2026-09-21", amount: 38.4, merchant: "Naturgy", status: "BOOK" },
  ];
  const octTx = [
    { id: "c1", ent: "sabadell", date: "2026-10-04", amount: 31.5, merchant: "Seguro hogar", status: "BOOK" },
    { id: "c2", ent: "sabadell", date: "2026-10-12", amount: 45.9, merchant: "Movistar", status: "BOOK" },
    { id: "c3", ent: "sabadell", date: "2026-10-20", amount: 37.7, merchant: "Naturgy", status: "BOOK" },
    { id: "c4", ent: "sabadell", date: "2026-10-29", amount: 12, merchant: "Panaderia", status: "BOOK" },
  ];
  let u = { accounts: [{ id: "sb", ent: "sabadell", role: "fijos", value: 2000 }], fixed: recs, debts: [], oneoffs: [], flows: [], expenses: [], settings: {}, bankTx: sepTx };
  // 30/9: el sync guarda la prueba BOOK en el recibo y Plan escribe `paidYm`.
  pon("2026-09-30T21:00:00+02:00");
  let v = c.reconcileFixedPaymentProofs(u, 2026, 9, 30);
  v = c.planSyncDerived(v, u);
  assert.ok(v.fixed.every((f) => f.paymentProofs && f.paymentProofs[2026 * 12 + 9] && f.paymentProofs[2026 * 12 + 9].kind === "book"), "prueba BOOK guardada");
  assert.ok(v.fixed.every((f) => f.paidYm === 2026 * 12 + 9), "y la marca paidYm de septiembre");
  // Octubre: otro extracto (el de septiembre ya no viene) y foto del 31.
  pon("2026-10-31T21:00:00+01:00");
  v = Object.assign({}, v, { bankTx: octTx });
  v = c.reconcileFixedPaymentProofs(v, 2026, 10, 31);
  const vo = vistoEl(v, "2026-10-31T21:00:00+01:00", 2026, 10, 31); v = vo.foto;
  assert.ok(!v.settings.pr6Fotos[2026 * 12 + 9], "septiembre no tiene foto");
  // 3/11: el extracto ya no trae nada de septiembre.
  pon("2026-11-03T12:00:00+01:00");
  v = Object.assign({}, v, { bankTx: octTx.filter((x) => x.date >= "2026-10-24") });
  const e = c.planRecibosMesCerrado(v, 2026, 11);
  const MANO = 3150 + 4590 + 3800;   // tu parte prevista, igual en los dos meses
  assert.equal(e.cent, MANO, "octubre");
  assert.equal(vo.cent, MANO, "octubre = lo que Plan enseñaba el 31/10");
  same(e.prev, { y: 2026, m: 9, cent: MANO }, "septiembre reconstruido con las pruebas guardadas");
  assert.equal(e.cent - e.prev.cent, 0, "igual que septiembre");
  // Si a uno le falta la prueba guardada (casó solo por el extracto, ya caducado) → sin datos.
  const sinPrueba = Object.assign({}, v, { fixed: v.fixed.map((f) => f.id === "tel" ? Object.assign({}, f, { paymentProofs: Object.assign({}, f.paymentProofs, { [2026 * 12 + 9]: undefined }), paidYm: undefined, paidDay: undefined }) : f) });
  sinPrueba.fixed.forEach((f) => { if (f.paymentProofs) Object.keys(f.paymentProofs).forEach((k) => { if (f.paymentProofs[k] === undefined) delete f.paymentProofs[k]; }); });
  assert.equal(c.planRecibosMesCerrado(sinPrueba, 2026, 11).prev.cent, null, "sin la prueba de Movistar: sin datos");
}
// B2 · Foto de septiembre del día 20 y el extracto ya sin el cargo del 29: «—», no una cifra baja.
{
  const tarde = s.fixed.concat([{ id: "seg", name: "Seguro", amount: 25, freq: "mes", day: 29, account: "sabadell" }]);
  let t = Object.assign({}, s, { fixed: tarde, settings: {} });
  // El 20/9 el Seguro aún no tocaba: en la foto queda como «no se sabe».
  t = vistoEl(t, "2026-09-20T12:00:00+02:00", 2026, 9, 20).foto;
  t = vistoEl(t, "2026-10-31T21:00:00+01:00", 2026, 10, 31).foto;
  pon("2026-11-03T12:00:00+01:00");
  // Su cargo del 29/9 ya no está en ningún sitio (extracto caducado, sin prueba guardada).
  const e = c.planRecibosMesCerrado(t, 2026, 11);
  assert.equal(e.prev.cent, null, "septiembre no se puede acreditar");
  const foto9 = t.settings.pr6Fotos[2026 * 12 + 9];
  assert.equal(foto9.d, 20);
  assert.equal(foto9.it.find((x) => x.id === "fixed_seg").st, "?");
}
// «No llegaron» no cuenta lo marcado a mano como pagado ni lo de un banco sin movimientos.
{
  const marcado = s.fixed.map((f) => f.id === "gym" ? Object.assign({}, f, { paidYm: 2026 * 12 + 10, paidDay: 2 }) : f);
  let t = Object.assign({}, s, { fixed: marcado });
  t = vistoEl(t, "2026-10-31T21:00:00+01:00", 2026, 10, 31).foto;
  pon("2026-11-03T12:00:00+01:00");
  const e = c.planRecibosMesCerrado(t, 2026, 11);
  assert.equal(e.noLlegaron, 0, "marcado a mano no es «no llegó»");
  assert.equal(e.cent, A_OCT, "y tampoco suma: no hay cargo del banco");
  const sinBanco = { accounts: [{ id: "m", ent: "efectivo", role: "fijos", value: 100 }], fixed: [{ id: "alq", name: "Alquiler", amount: 600, freq: "mes", day: 1, account: "caixa" }],
    debts: [], oneoffs: [], flows: [], bankTx: [], expenses: [], settings: {} };
  const t2 = vistoEl(sinBanco, "2026-10-31T21:00:00+01:00", 2026, 10, 31).foto;
  pon("2026-11-03T12:00:00+01:00");
  const e2 = c.planRecibosMesCerrado(t2, 2026, 11);
  assert.equal(e2.noLlegaron, null, "sin movimientos del banco no se sabe: «—», no «no llegó»");
  assert.equal(e2.cent, null);
}
// Enero: el cerrado es diciembre del año anterior y se compara con noviembre.
{
  pon("2027-01-02T12:00:00+01:00");
  const e = c.planRecibosMesCerrado({ fixed: [{ id: "x", name: "Seguro", amount: 30, freq: "mes", day: 3, account: "sabadell" }], debts: [], oneoffs: [], flows: [], settings: {} }, 2027, 1);
  same([e.y, e.m, e.prev.y, e.prev.m, e.cent], [2026, 12, 2026, 11, null], "sin foto: «—»");
  pon("2026-11-03T12:00:00+01:00");
}
// Sin ningún recibo ese mes no hay resumen.
assert.equal(c.planRecibosMesCerrado({ fixed: [], debts: [], oneoffs: [], flows: [], settings: {} }, 2026, 11), null);
// La foto: no se reescribe si no cambia, una de un día anterior no pisa a una posterior y solo
// quedan los últimos tres meses.
{
  pon("2026-10-31T21:00:00+01:00");
  assert.equal(c.planRecibosConFoto(s, 2026, 10, 31), s, "sin cambios no hay escritura");
  assert.equal(c.planRecibosConFoto(s, 2026, 10, 25), s, "la del 25 no pisa a la del 31");
  const viejo = Object.assign({}, s, { settings: { pr6Fotos: Object.assign({ [2026 * 12 + 5]: { d: 31, it: [] } }, s.settings.pr6Fotos) } });
  const n = c.planRecibosConFoto(Object.assign({}, viejo, { fixed: viejo.fixed.slice(0, 2) }), 2026, 10, 31);
  same(Object.keys(n.settings.pr6Fotos).map(Number).sort(), [2026 * 12 + 9, 2026 * 12 + 10], "fuera mayo");
  pon("2026-11-03T12:00:00+01:00");
}
// Un pausado en octubre no suma ni cuenta como «no llegó» (Plan no lo enseñaba como pendiente).
{
  let p = Object.assign({}, s, { fixed: s.fixed.map((f) => f.id === "gym" ? Object.assign({}, f, { pausedFrom: 2026 * 12 + 10, pausedUntil: 2026 * 12 + 11 }) : f) });
  p = vistoEl(p, "2026-10-31T21:00:00+01:00", 2026, 10, 31).foto;
  pon("2026-11-03T12:00:00+01:00");
  const e = c.planRecibosMesCerrado(p, 2026, 11);
  same([e.cent, e.noLlegaron], [A_OCT, 0]);
}
// R2-1 · Si la foto no sabía el estado de un cargo, lo de hoy solo lo sube a pagado: el extracto de
// hoy no puede convertir un «no se sabe» en «no llegó».
{
  const fotos = JSON.parse(JSON.stringify(s.settings.pr6Fotos));
  fotos[OCT_YM].it.find((x) => x.id === "fixed_gym").st = "?";
  const e = c.planRecibosMesCerrado(Object.assign({}, s, { settings: { pr6Fotos: fotos } }), 2026, 11);
  assert.equal(e.cent, null, "sigue sin saberse: «—»");
  assert.equal(e.noLlegaron, null, "y no se cuenta como «no llegó»");
  // Si hoy sí hay prueba de pago, sube.
  const pagado = Object.assign({}, s, { settings: { pr6Fotos: fotos }, bankTx: [{ id: "g10", ent: "sabadell", date: "2026-10-02", amount: 40, merchant: "Gimnasio", status: "BOOK" }] });
  const e2 = c.planRecibosMesCerrado(pagado, 2026, 11);
  assert.equal(e2.cent, A_OCT + 4000, "el Gimnasio pagado hoy acreditado sube la cifra");
}
// R2-2 · Volver a primer plano sin cambios no escribe: el mismo estado (ni local ni subida), aunque
// `pack` y `proof` sean objetos nuevos y aunque cambie el día sin movimientos nuevos del banco.
{
  pon("2026-10-31T21:00:00+01:00");
  const otraVuelta = c.planRecibosConFoto(s, 2026, 10, 31, c.planChargesMonth(s, 10, 2026, 31), c.paymentEvidenceUI(s, 2026, 10, 31));
  assert.equal(otraVuelta, s, "misma foto → mismo estado");
  // El 20/10 el extracto llega hasta el 15: el 21 no hay nada nuevo.
  let t = Object.assign({}, s, { settings: {}, expenses: s.expenses.filter((x) => x.date <= "2026-10-15") });
  pon("2026-10-20T10:00:00+02:00");
  t = c.planRecibosConFoto(t, 2026, 10, 20);
  pon("2026-10-21T10:00:00+02:00");
  assert.equal(c.planRecibosConFoto(t, 2026, 10, 21), t, "al día siguiente sin movimientos nuevos no se reescribe");
  pon("2026-11-03T12:00:00+01:00");
}
// R2-2 · Dos móviles con datos distintos (el extracto no viaja) convergen a la misma foto y, desde
// ahí, ninguno vuelve a escribir.
{
  pon("2026-10-31T21:00:00+01:00");
  const base = Object.assign({}, s, { settings: {} });
  const extracto = [{ id: "g10", ent: "sabadell", date: "2026-10-02", amount: 40, merchant: "Gimnasio", status: "BOOK" }];
  let A = c.planRecibosConFoto(Object.assign({}, base, { bankTx: extracto }), 2026, 10, 31);   // ve el Gimnasio pagado
  let B = c.planRecibosConFoto(base, 2026, 10, 31);                                          // no lo ve
  const fA = A.settings.pr6Fotos, fB = B.settings.pr6Fotos;
  const uA = c.pr6FotosUnion(fA, fB), uB = c.pr6FotosUnion(fB, fA);
  same(uA, uB, "la mezcla no depende de quién baja primero");
  assert.equal(uA, fA, "A ya sabía más: su foto no cambia (mismo objeto, sin escritura)");
  assert.equal(uA[OCT_YM].it.find((x) => x.id === "fixed_gym").st, "p");
  A = Object.assign({}, A, { settings: Object.assign({}, A.settings, { pr6Fotos: uA }) });
  B = Object.assign({}, B, { settings: Object.assign({}, B.settings, { pr6Fotos: uB }) });
  assert.equal(c.planRecibosConFoto(A, 2026, 10, 31), A, "A no reescribe");
  assert.equal(c.planRecibosConFoto(B, 2026, 10, 31), B, "B no la baja a «no llegó» ni reescribe");
  assert.equal(c.pr6FotosUnion(uA, uB), uA, "mezclar otra vez no cambia nada");
  // Un recibo sin pagar que se borra dentro del mes: queda marcado y no cuenta, en los dos.
  const sinGym = Object.assign({}, B, { fixed: B.fixed.filter((f) => f.id !== "nfx") });
  const nfxPagado = uB[OCT_YM].it.find((x) => x.id === "fixed_nfx").st === "p";
  assert.ok(nfxPagado, "Netflix estaba pagado: borrarlo no lo quita");
  assert.equal(c.planRecibosConFoto(sinGym, 2026, 10, 31), sinGym, "lo pagado se conserva sin reescribir");
  pon("2026-11-03T12:00:00+01:00");
}
// Leer no cambia el estado.
const antes = JSON.stringify(s);
c.planRecibosMesCerrado(s, 2026, 11);
assert.equal(JSON.stringify(s), antes, "el resumen solo lee");

console.log("plan-recibos-cerrado: OK");
