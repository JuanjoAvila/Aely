#!/usr/bin/env node
/** Plan › Recibos v6, tanda 6: resumen del mes cerrado (SPEC §2.1).
 *  La cifra tiene que cuadrar con lo que se vio el último día de ese mes. Se comprueba por dos vías
 *  independientes, en céntimos: (A) la cuenta a mano del escenario y (B) lo que Plan pintaba con el
 *  reloj puesto el 31 de octubre (lo pagado con prueba de `planChargesMonth` + `paymentEvidenceUI`
 *  del mes en curso). El resumen se calcula con el reloj ya en noviembre. */
import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const c = loadPureLogicFromFile();
let reloj = new Date("2026-11-03T12:00:00+01:00");
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
   | Dentista (puntual oct) | 90,00    |           | sin cargo |  */
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
  gasto("o-luz", "IBERDROLA CLIENTES", "2026-10-05", 58.30), gasto("o-nfx", "NETFLIX.COM", "2026-10-10", 13.99),
  gasto("o-agua", "CANAL DE AGUAS", "2026-10-15", 30),
  gasto("o-coche", "PRESTAMO CUOTA", "2026-10-01", 100, { category: "deudas", debtId: "coche" }),
];
let s = { accounts: [{ id: "sb", ent: "sabadell", role: "fijos", value: 3000 }], fixed, debts, oneoffs, flows: [], bankTx: [], expenses };
// Los cargos se enlazan como en «¿Cuál es el cargo?»: es la prueba que queda guardada en el recibo.
for (const [exp, rec, m, fin] of [["s-luz","luz",9,30],["s-nfx","nfx",9,30],["s-gym","gym",9,30],["s-agua","agua",9,30],
  ["o-luz","luz",10,31],["o-nfx","nfx",10,31],["o-agua","agua",10,31]]) {
  // Con nombre y céntimos exactos el motor ya lo casa solo y enlazar no cambia nada.
  s = c.linkFixedPayment(s, exp, rec, 2026, m, fin);
  const st = c.fixedPaymentState(s, s.fixed.find((f) => f.id === rec), 2026, m, fin);
  assert.ok(st.paid && st.paidAmount === s.expenses.find((x) => x.id === exp).amount, "pagado con " + exp);
}

console.log("plan-recibos-cerrado");

// Vía A: la cuenta a mano. Octubre: Luz 50 + Netflix 12,99 + Agua 20 (tu parte) + Coche 100.
const A_OCT = 5000 + 1299 + 2000 + 10000, A_SEP = A_OCT + 4000;
const r = c.planRecibosMesCerrado(s, 2026, 11);
assert.ok(r, "hay resumen de octubre");
assert.equal(r.y, 2026); assert.equal(r.m, 10); assert.equal(r.ym, 2026 * 12 + 10);
assert.equal(r.cent, A_OCT, "en recibos (A)");
same(r.prev, { y: 2026, m: 9, cent: A_SEP }, "septiembre (A)");
assert.equal(r.noLlegaron, 2, "Gimnasio sin cargo y el puntual sin cargo del banco");
same(r.sube, { id: "fixed_luz", name: "Luz", cent: 5830 - 4510 }, "el que más subió contra septiembre, con el cargo real");
same(r.cambia, { id: "fixed_nfx", name: "Netflix", cent: 100 }, "Netflix cobró 1,00 más de lo previsto; Luz cambia cada mes y no cuenta");

// Vía B: lo que Plan enseñaba el 31 de octubre, con el reloj de entonces.
const vistoEl = (fecha, y, m, fin) => {
  reloj = new Date(fecha);
  const pack = c.planChargesMonth(s, m, y, fin), proof = c.paymentEvidenceUI(s, y, m, fin);
  const pagado = pack.paidBills.filter((x) => proof.confirmed[x.id] !== false);
  const sinCargo = pack.paidBills.length - pagado.length;
  return { cent: pagado.reduce((t, x) => t + cent(Math.abs(x.amount)), 0), no: pack.pendingBills.length + sinCargo,
    // La tarjeta del mes en curso es la otra cara: lo pendiente en euros, como lo pinta Plan.
    queda: cent(pack.pendingBillsTotal), sinCargo: pack.paidBills.filter((x) => proof.confirmed[x.id] === false).reduce((t, x) => t + cent(Math.abs(x.amount)), 0) };
};
const bOct = vistoEl("2026-10-31T21:00:00+01:00", 2026, 10, 31);
const bSep = vistoEl("2026-09-30T21:00:00+02:00", 2026, 9, 30);
reloj = new Date("2026-11-03T12:00:00+01:00");
assert.equal(bOct.cent, r.cent, "octubre (B) = resumen");
assert.equal(bSep.cent, r.prev.cent, "septiembre (B) = resumen");
assert.equal(bOct.no, r.noLlegaron, "no llegaron (B)");
// Y todo lo del mes queda repartido: pagado + pendiente + sin cargo = lo previsto entero.
assert.equal(bOct.cent + bOct.queda + bOct.sinCargo, A_OCT + 4000 + 9000, "nada se pierde ni se cuenta dos veces");

// Octubre fue 40,00 € menos que septiembre: el Gimnasio no llegó.
assert.equal(r.cent - r.prev.cent, -4000);

// Enero: el cerrado es diciembre del año anterior y se compara con noviembre.
{
  const a = { accounts: s.accounts, fixed: [{ id: "x", name: "Seguro", amount: 30, freq: "mes", day: 3, account: "sabadell" }], debts: [], oneoffs: [], flows: [], bankTx: [], expenses: [] };
  reloj = new Date("2027-01-02T12:00:00+01:00");
  const e = c.planRecibosMesCerrado(a, 2027, 1);
  assert.equal(e.y, 2026); assert.equal(e.m, 12);
  assert.equal(e.prev.m, 11); assert.equal(e.prev.y, 2026);
  assert.equal(e.cent, 0, "sin cargo no se suma nada");
  assert.equal(e.noLlegaron, 1);
  assert.equal(e.sube, null); assert.equal(e.cambia, null);
  reloj = new Date("2026-11-03T12:00:00+01:00");
}

// Sin ningún recibo ese mes no hay resumen; sin recibos el mes anterior no se compara.
assert.equal(c.planRecibosMesCerrado({ fixed: [], debts: [], oneoffs: [], flows: [] }, 2026, 11), null);
{
  const solo = Object.assign({}, s, { oneoffs: [], debts: [], fixed: s.fixed.map((f) => Object.assign({}, f, { months: [10], freq: "año" })) });
  const e = c.planRecibosMesCerrado(solo, 2026, 11);
  assert.ok(e && e.prev === null, "septiembre sin recibos: sin comparación inventada");
}

// Un pausado en octubre no suma ni cuenta como «no llegó» (Plan no lo enseñaba como pendiente).
{
  const p = Object.assign({}, s, { fixed: s.fixed.map((f) => f.id === "gym" ? Object.assign({}, f, { pausedFrom: 2026 * 12 + 10, pausedUntil: 2026 * 12 + 11 }) : f) });
  const e = c.planRecibosMesCerrado(p, 2026, 11);
  assert.equal(e.cent, A_OCT);
  assert.equal(e.noLlegaron, 1, "solo el puntual");
}

// Leer no cambia el estado.
const antes = JSON.stringify(s);
c.planRecibosMesCerrado(s, 2026, 11);
assert.equal(JSON.stringify(s), antes, "el resumen solo lee");

console.log("plan-recibos-cerrado: OK");
