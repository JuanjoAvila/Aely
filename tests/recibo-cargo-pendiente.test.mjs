#!/usr/bin/env node
/** Plan › Recibos › «¿Cuál es el cargo?» con el cargo aún sin confirmar por el banco (beta 4.26.210).
 *  Caso real (datos inventados aquí): recibo compartido 29,99 € entre 6 (tu parte 4,99) que se cobra
 *  el día 2; compra con tarjeta en domingo 1/11 que el banco apunta el lunes 2/11 y, de momento,
 *  como pendiente. El selector decía «Sin cargos de Sabadell este mes» con el cargo ya en Gastos.
 *  Lo que NO cambia: un pendiente o un cargo de mañana no se puede elegir ni acredita el pago
 *  (NO-GO 3/10). Lo que sí: se lista aparte para que se vea que ha llegado, y al confirmarse pasa a
 *  ser elegible por la vía normal. Corre igual con TZ=Europe/Madrid y TZ=UTC. */
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const c = loadPureLogicFromFile();
vm.runInNewContext(fs.readFileSync(new URL("../src/modules/14-v4-screens.js", import.meta.url), "utf8"), c);
let reloj;
c.Date = class extends Date {
  constructor(...args){ super(...(args.length?args:[reloj.getTime()])); }
  static now(){ return reloj.getTime(); }
};
const ids = (rows) => rows.map((x) => x.id).join(",");
const recibo = { id: "vid", name: "Video Premium", amount: 4.99, bankAmount: 29.99, freq: "mes", day: 2, account: "sabadell" };
const cargo = (extra) => Object.assign({ id: "g1", merchant: "COMPRA TARJ. 0000XXXXXXXX0000 GOOGLE", date: "2026-11-02",
  amount: 29.99, ent: "sabadell", category: "recibos", source: "ob", status: "PDNG", obPending: true }, extra || {});
const estado = (expenses, fixed) => ({ accounts: [{ id: "sb", ent: "sabadell", role: "fijos", value: 3000 }],
  fixed: fixed || [recibo], debts: [], oneoffs: [], flows: [], bankTx: [], expenses, settings: {} });
const ver = (s, f, today) => {
  const pool = c.reciboCargosElegibles(s, f, 2026, 11, today);
  return { pool, pend: c.reciboCargosPorConfirmar(s, f, 2026, 11, today, pool) };
};

// 1) Domingo 21:04, cargo pendiente con fecha del lunes: no se puede elegir, pero se ve.
reloj = new Date("2026-11-01T21:04:00+01:00");
{
  const s = estado([cargo()]);
  const v = ver(s, recibo, 1);
  assert.equal(ids(v.pool), "", "un pendiente no se puede elegir (la regla de dinero no cambia)");
  assert.equal(ids(v.pend), "g1", "pero se lista aparte: no hay que decir «Sin cargos»");
  assert.equal(c.fixedPaymentState(s, recibo, 2026, 11, 1).paid, false, "y no acredita el pago");
}
// 1b) Ya contabilizado pero con fecha de mañana: igual, aparte y sin acreditar.
{
  const s = estado([cargo({ status: "BOOK", obPending: undefined })]);
  const v = ver(s, recibo, 1);
  assert.equal(ids(v.pool), "");
  assert.equal(ids(v.pend), "g1", "fecha posterior a hoy → pendiente de confirmar");
}
// 1c) Pendiente con fecha de hoy: también aparte.
{
  const v = ver(estado([cargo({ date: "2026-11-01" })]), recibo, 1);
  assert.equal(ids(v.pool), "");
  assert.equal(ids(v.pend), "g1");
}
// 1d) Lo que no es de ese recibo no se cuela: otro banco, efectivo, otro recibo, ingreso, posible repetido.
{
  const s = estado([
    cargo({ id: "rv", ent: "revolut" }),
    cargo({ id: "ef", ent: "efectivo", source: "manual:efectivo" }),
    cargo({ id: "otro", reciboId: "luz" }),
    cargo({ id: "in", amount: -29.99 }),
    cargo({ id: "dup", possibleDup: true }),
    cargo({ id: "oct", date: "2026-10-31" }),
  ]);
  assert.equal(ids(ver(s, recibo, 1).pend), "", "solo cargos del banco del recibo, del mes y libres");
}

// 2) El lunes el banco lo confirma (BOOK, día 2): pasa a la lista normal y deja de estar aparte.
reloj = new Date("2026-11-02T09:00:00+01:00");
{
  const s = estado([cargo({ status: "BOOK", obPending: undefined })]);
  const v = ver(s, recibo, 2);
  assert.equal(ids(v.pool), "g1", "confirmado → se puede elegir");
  assert.equal(ids(v.pend), "", "y ya no sale como pendiente");
  // El nombre del banco (GOOGLE) no se parece al del recibo: nada se casa solo por nombre.
  assert.equal(c.fixedPaymentState(s, recibo, 2026, 11, 2).paid, false, "sin parecido de nombre no se casa solo");
  // Elegirlo a mano lo marca pagado con el importe ENTERO del banco.
  const n = c.linkFixedPayment(s, "g1", "vid", 2026, 11, 2);
  const st = c.fixedPaymentState(n, n.fixed[0], 2026, 11, 2);
  assert.equal(st.paid, true, "elegido a mano → pagado");
  assert.equal(Math.round(st.paidAmount * 100), 2999, "con los 29,99 del banco, no con la parte de 4,99");
}
// 2b) Si el nombre del recibo SÍ está en el cargo, el casado normal lo marca pagado sin hacer nada…
{
  const g = Object.assign({}, recibo, { id: "goo", name: "Google" });
  const pend = estado([cargo()], [g]);
  reloj = new Date("2026-11-01T21:04:00+01:00");
  assert.equal(c.fixedPaymentState(pend, g, 2026, 11, 1).paid, false, "…pero no mientras está pendiente");
  reloj = new Date("2026-11-02T09:00:00+01:00");
  const book = estado([cargo({ status: "BOOK", obPending: undefined })], [g]);
  const st = c.fixedPaymentState(book, g, 2026, 11, 2);
  assert.equal(st.paid, true, "confirmado y con su nombre → pagado solo");
  assert.equal(Math.round(st.paidAmount * 100), 2999);
}
console.log("recibo-cargo-pendiente OK");
