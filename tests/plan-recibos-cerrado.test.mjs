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
const A_OCT = 5000 + 1299 + 2000 + 10000, A_SEP = A_OCT + 4000;
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
  assert.equal(e.prev.cent, null, "septiembre sin foto: «—»");
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
// Leer no cambia el estado.
const antes = JSON.stringify(s);
c.planRecibosMesCerrado(s, 2026, 11);
assert.equal(JSON.stringify(s), antes, "el resumen solo lee");

console.log("plan-recibos-cerrado: OK");
