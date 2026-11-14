/* LA SERIE DE PATRIMONIO NUEVA CONTRA LA DE ANTES, PUNTO A PUNTO (14/11/2026).
 *
 * `netWorthSeries` guarda entre llamadas lo que sale solo de la fecha y del comercio de cada fila
 * (`netWorthSeries.rows`) y `netWorthDebtPolicy` la deuda de cada día pasado por lista de deudas
 * (`_nwDebtDays`). Es la gráfica y la comparación de patrimonio de Inicio: una entrada de caché
 * vieja sería una cifra de dinero mal pintada.
 *
 * El oráculo es el texto de las dos funciones tal como estaban antes del cambio
 * (`tests/helpers/net-worth-series-oraculo.txt`, sacado de 8d82bb729 = 4.26.232), cargado en su
 * propio sandbox y sin caché ninguna entre comparaciones. La nueva conserva sus cachés durante toda
 * la secuencia, que es justo lo que hay que probar: cada estado se compara después de haber visto
 * los anteriores. Igualdad exacta de cada punto (día y valor, que ya sale en céntimos enteros / 100),
 * de la cobertura que lee la «i» y de `fresh`.
 *
 * Si algún día cambia la REGLA de la serie a propósito, este test falla: se actualiza el oráculo
 * con la función nueva ya revisada (o se retira el test si las cachés desaparecen). */
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPureLogic } from "../scripts/load-pure-logic.mjs";
import { estadoHeredado } from "../e2e/fixtures.mjs";

const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const viejoSrc = fs.readFileSync(new URL("./helpers/net-worth-series-oraculo.txt", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const INI = "function netWorthDebtPolicy(state, today, current){", MED_A = "\n/* LOS AJUSTES QUE DE VERDAD LEEN LA SERIE", MED_B = "function netWorthSeries(state, options){", FIN = "\n// Mismo día de hace";
const corta = (s, a0, z0, desde = 0) => { const a = s.indexOf(a0, desde), z = s.indexOf(z0, a); assert.ok(a >= 0 && z > a, "no encuentro " + a0.slice(0, 40)); return [a, z]; };
// Las dos funciones de antes sustituyen a las de ahora dentro del mismo bundle: todo lo demás que
// llaman (bancos, partes, borrados, saldos) es el código de hoy en los dos lados.
const [pa, pz] = corta(html, INI, MED_A), [sa, sz] = corta(html, MED_B, FIN);
const [va, vz] = corta(viejoSrc, INI, "\n//@@\n"), [wa] = corta(viejoSrc, MED_B, "\n", 0);
const viejaDeuda = viejoSrc.slice(va, vz), viejaSerie = viejoSrc.slice(wa);
assert.ok(!/netWorthSeries\.rows|_nwDebtDays/.test(viejoSrc), "el oráculo es el código de antes: no puede llevar las cachés nuevas");
assert.ok(/netWorthSeries\.rows/.test(html.slice(sa, sz)) && /_nwDebtDays/.test(html.slice(pa, pz)), "la serie de hoy ya no lleva las cachés: este test sobra o hay que rehacerlo");
const viejo = loadPureLogic(html.slice(0, pa) + viejaDeuda + html.slice(pz, sa) + viejaSerie + html.slice(sz));
const nuevo = loadPureLogic(html);
const plain = (x) => JSON.parse(JSON.stringify(x));

let comparadas = 0, puntos = 0;
function igual(state, opts, que) {
  viejo.netWorthSeries.cache = [];
  const antes = JSON.stringify(state);
  const v = viejo.netWorthSeries(state, opts), n = nuevo.netWorthSeries(state, opts);
  assert.equal(JSON.stringify(state), antes, que + ": la serie no escribe en el estado");
  assert.equal(n.length, v.length, que + ": número de puntos");
  for (let i = 0; i < v.length; i++) {
    assert.equal(n[i].day, v[i].day, que + ": día del punto " + i);
    assert.ok(Object.is(n[i].value, v[i].value), que + ": " + v[i].day + " vale " + v[i].value + " y sale " + n[i].value);
    assert.equal(Math.round(n[i].value * 100), Math.round(v[i].value * 100), que + ": céntimos de " + v[i].day);
  }
  assert.deepEqual(plain(n.coverage), plain(v.coverage), que + ": cobertura (la «i»)");
  assert.equal(n.fresh, v.fresh, que + ": fresh");
  comparadas++; puntos += v.length;
  return n;
}
// Y en frío: la misma llamada en un sandbox recién cargado (sin nada guardado) da lo mismo que
// con las cachés llenas por los estados anteriores.
function igualEnFrio(state, opts, que) {
  const n = igual(state, opts, que), frio = loadPureLogic(html).netWorthSeries(state, opts);
  assert.deepEqual(plain(n), plain(frio), que + ": con caché y en frío");
  assert.deepEqual(plain(n.coverage), plain(frio.coverage), que + ": cobertura con caché y en frío");
}

// ---------- Estados sintéticos (ningún dato real) ----------
const rnd = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const HOY = "2026-09-26", FIN_MS = Date.parse(HOY + "T12:00:00Z");
const COMERCIOS = ["Súper sintético", "Bar sintético", "Gasolinera sintética", "Tienda sintética", "Farmacia sintética", "CAJERO 0042", "Retirada de efectivo", "Reintegro cajero", "ATM sintético", "Transferencia a yo mismo", "Traspaso interno"];
function historico(n, seed, bancos = ["sabadell", "caixabank", "revolut"]) {
  const r = rnd(seed), out = [], span = 3 * 365 * 864e5;
  for (let i = 0; i < n; i++) {
    const ms = FIN_MS - Math.floor(span * i / n) - Math.floor(r() * 36e5), k = Math.floor(r() * COMERCIOS.length), ent = bancos[i % bancos.length];
    const e = { id: "h" + seed + "-" + i, date: new Date(ms).toISOString(), amount: +((r() * 90) + 0.01).toFixed(2), merchant: COMERCIOS[k], category: ["super", "bares", "transporte", "otros", "traspaso", "inversion"][Math.floor(r() * 6)], ent, source: i % 4 ? "manual" : "ob:" + ent + "#x" + i };
    if (i % 4 === 0) e.extId = "ext-" + seed + "-" + i;
    if (i % 37 === 0) e.amount = -e.amount;                       // entradas
    if (i % 53 === 0) e.possibleDup = true;                      // posible repetido: no cuenta
    if (i % 61 === 0) e.status = "PDNG";                         // pendiente del banco: no cuenta
    if (i % 67 === 0) e.status = "book";
    if (i % 71 === 0) e.date = e.date.slice(0, 10);                // fecha de solo día
    if (i % 83 === 0) { const d = new Date(ms); e.date = d.getUTCDate() + "/" + (d.getUTCMonth() + 1) + "/" + d.getUTCFullYear(); } // dd/mm/aaaa
    if (i % 97 === 0) e.withdrawalConfirmedAt = "2026-09-01T10:00:00Z";
    if (i % 101 === 0) e.date = "sin fecha";                     // fecha ilegible: no cuenta
    if (i % 113 === 0) e.amount = 0;
    out.push(e);
  }
  // Medianoches de Madrid y cambios de hora: el día civil no es el de UTC.
  ["2026-03-28T23:30:00Z", "2026-03-29T00:59:59Z", "2026-03-29T01:00:00Z", "2025-10-25T22:10:00Z", "2025-10-26T00:30:00Z", "2025-10-26T01:30:00Z", "2026-06-30T22:00:00Z", "2026-06-30T21:59:59Z", "2026-01-01T00:00:00+01:00", "2025-12-31T23:59:59+01:00", HOY + "T21:59:00Z", HOY + "T22:01:00Z"]
    .forEach((date, i) => out.push({ id: "borde" + seed + "-" + i, date, amount: 10 + i + 0.07, merchant: "Borde sintético", category: "super", ent: bancos[i % bancos.length], source: "manual" }));
  // Traspasos propios emparejados (dos patas opuestas en dos bancos, a tres días como mucho).
  if (bancos.length > 1) for (let j = 0; j < 8; j++) {
    const ms = FIN_MS - (20 + j * 41) * 864e5, imp = 300 + j * 25.5;
    out.push({ id: "tr-out" + seed + j, date: new Date(ms).toISOString(), amount: imp, merchant: "Traspaso sintético", category: "traspaso", ent: bancos[0], source: "manual" });
    out.push({ id: "tr-in" + seed + j, date: new Date(ms + (j % 4) * 864e5).toISOString(), amount: -imp, merchant: "Traspaso sintético", category: j % 2 ? "traspaso" : "otros", ent: bancos[1], source: "manual" });
  }
  // Nóminas y aportación periódica al bróker.
  for (let m = 0; m < 30; m++) {
    out.push({ id: "nom" + seed + m, date: new Date(FIN_MS - m * 30.4 * 864e5).toISOString(), amount: -2100.5, merchant: "Nómina sintética", category: "ingreso", ent: bancos[0], source: "manual" });
    out.push({ id: "apo" + seed + m, date: new Date(FIN_MS - (m * 30.4 + 2) * 864e5).toISOString(), amount: 250, merchant: "Transferencia a Titular Sintético Ejemplo", category: m % 2 ? "traspaso" : "otros", ent: bancos[0], source: "manual" });
  }
  return out;
}
const dias = (desde, hasta) => { const out = []; for (let ms = Date.parse(desde + "T12:00:00Z"); ms <= Date.parse(hasta + "T12:00:00Z"); ms += 864e5) out.push(new Date(ms).toISOString().slice(0, 10)); return out; };
function cartera(expenses, extra = {}) {
  return {
    settings: { expenseBanks: ["sabadell", "caixabank", "revolut"], profile: { fullName: "Titular Sintético Ejemplo" } },
    accounts: [
      { id: "sab", ent: "sabadell", name: "Cuenta sintética", value: 2500.37, role: "diario", spendFrom: true, bankIban: "ES-SYNTHETIC-SAB" },
      { id: "cash", ent: "efectivo", name: "Efectivo", value: 120, role: "fijos" },
      { id: "hucha", ent: "familia", name: "Hucha sin movimientos", value: 640.5, role: "fijos" },
      { id: "vieja", ent: "ing", name: "Cuenta manual con cierres", value: 900, role: "fijos" }],
    obAccounts: [{ id: "ob-cx", key: "ob-cx", ent: "caixabank", name: "Cuenta sintética", value: 1800.11, cur: "EUR" }, { id: "ob-rv", key: "ob-rv", ent: "revolut", name: "Revolut sintética", value: 900, cur: "EUR" }],
    accountBalanceHistory: { "acc:cash": dias("2026-09-10", HOY).map((day) => ({ day, value: 120 })), "acc:vieja": [{ day: "2025-03-01", value: 400 }, { day: "2026-01-15", value: 750.25 }, { day: HOY, value: 900 }] },
    investments: [{ id: "fund", ent: "trade_republic", name: "Fondo sintético", value: 5200 }],
    invHistory: dias("2026-07-01", HOY).filter((_, i) => i % 3 === 0).map((d, i) => ({ d, v: 4000 + i * 37.5 })),
    aportaciones: [{ ent: "trade_republic", amount: 250 }],
    assets: [{ id: "home", name: "Piso sintético", kind: "piso", value: 180000 }, { id: "car", name: "Coche sintético", kind: "coche", value: 15000 }],
    assetValueHistory: { car: [{ day: "2025-06-01", value: 19000 }, { day: "2026-02-01", value: 16500 }] },
    debts: [
      { id: "hipo", ent: "familia", name: "Hipoteca sintética", value: 176714.8, original: 180000, monthly: 660.85, apr: "1,05", day: 1, asOf: 2026 * 12 + 8, account: "sabadell" },
      { id: "car-loan", ent: "familia", name: "Préstamo sintético", value: 11212, original: 15000, monthly: 197, day: 3, asOf: 2026 * 12 + 8, account: "sabadell" },
      { id: "gym", ent: "familia", name: "Financiación sintética", value: 875.95, original: 875.95, monthly: 175.19, amort: 175.19, months: 5, day: 29, asOf: 2026 * 12 + 5, account: "sabadell" }],
    expenses, fixed: [], flows: [], oneoffs: [], goals: [], shared: [], deleted: [], onboarded: true, ...extra,
  };
}
// Como llama Inicio: con los insumos del saldo ya calculados (`balanceInputs`) y los totales.
const comoInicio = (s, today = HOY) => { const ins = nuevo.insumosSaldoGasto(s); return { today, liquid: 6700.61, invested: 5200, debtTotal: 188802.75, balanceInputs: { ...ins, roundupThisMonth: ins.roundup, monthlyInvestThisMonth: ins.monthlyInvest } }; };

// 1) La cartera heredada de las fixtures, varios «hoy» seguidos sobre el mismo estado.
{
  const s = estadoHeredado(HOY); s.obAccounts = s.obAccounts.map((o) => ({ ...o, key: o.id }));
  for (const hoy of ["2026-09-24", "2026-09-25", HOY, "2026-09-27", "2026-10-13", HOY]) igual(s, { today: hoy }, "heredada, hoy " + hoy);
  igualEnFrio(s, comoInicio(s), "heredada, como Inicio");
}

// 2) Histórico grande (6.300 y pico) con tres bancos, y lo que hace un día normal de uso encima.
{
  let s = cartera(historico(6300, 7));
  igualEnFrio(s, { today: HOY }, "histórico grande");
  igual(s, comoInicio(s), "histórico grande, como Inicio");
  const paso = (que, cambia, frio) => { s = { ...s, ...cambia(s) }; (frio ? igualEnFrio : igual)(s, { today: HOY }, que); igual(s, comoInicio(s), que + " (como Inicio)"); };
  // Apuntar gastos hoy, uno detrás de otro (el caso que motivó el cambio).
  for (let i = 0; i < 4; i++) paso("apuntar gasto de hoy " + i, (x) => ({ expenses: x.expenses.concat([{ id: "hoy" + i, date: HOY + "T10:0" + i + ":00Z", amount: 12.5 + i, merchant: "Café sintético", category: "bares", ent: "sabadell", source: "manual" }]) }));
  // Apuntar con fecha antigua, y en otro banco.
  paso("apuntar con fecha antigua", (x) => ({ expenses: x.expenses.concat([{ id: "viejo1", date: "2024-02-29T23:30:00Z", amount: 99.99, merchant: "Compra antigua", category: "compras", ent: "revolut", source: "manual" }]) }));
  // Cambiar el importe de un gasto antiguo (fila nueva, como hace la app).
  paso("cambiar importe de un gasto antiguo", (x) => ({ expenses: x.expenses.map((e, i) => i === 3000 ? { ...e, amount: 1234.56 } : e) }), true);
  // Cambiarle la fecha (a otro día y a otra hora) y el comercio (a un cajero y de vuelta).
  paso("cambiar fecha de un gasto antiguo", (x) => ({ expenses: x.expenses.map((e, i) => i === 2500 ? { ...e, date: "2025-07-14T22:30:00Z" } : e) }));
  paso("un gasto pasa a ser retirada en cajero", (x) => ({ expenses: x.expenses.map((e, i) => i === 2502 ? { ...e, merchant: "Cajero sintético", amount: Math.abs(e.amount) + 50 } : e) }));
  paso("y deja de serlo", (x) => ({ expenses: x.expenses.map((e, i) => i === 2502 ? { ...e, merchant: "Tienda sintética" } : e) }));
  // Cambiar una fila EN EL SITIO (nadie debería, pero la caché no puede fiarse): la lista es nueva
  // para que la serie se rehaga, y el objeto de la fila es el mismo que ya estaba guardado.
  paso("fila cambiada en el sitio: fecha", (x) => { const e = x.expenses[1200]; e.date = "2026-09-20T08:00:00Z"; return { expenses: x.expenses.slice() }; });
  paso("fila cambiada en el sitio: comercio a cajero", (x) => { const e = x.expenses[1201]; e.merchant = "CAJERO 7"; e.amount = Math.abs(e.amount) || 20; return { expenses: x.expenses.slice() }; });
  paso("fila cambiada en el sitio: importe", (x) => { const e = x.expenses[1202]; e.amount = 77.77; return { expenses: x.expenses.slice() }; });
  // Borrar: quitando la fila, y con lápida (la fila sigue y `deleted` la tacha).
  paso("borrar un gasto (fuera de la lista)", (x) => ({ expenses: x.expenses.filter((e) => e.id !== "hoy1") }));
  paso("borrar un gasto antiguo (fuera de la lista)", (x) => ({ expenses: x.expenses.filter((_, i) => i !== 4100) }), true);
  paso("borrar con lápida", (x) => { const e = x.expenses.find((y) => y.id === "hoy2"); return { deleted: (x.deleted || []).concat([nuevo.keyOfExpense(e)]) }; });
  // Cambian las deudas (lista nueva): la deuda por día no puede venir de la lista de antes.
  paso("amortizar una deuda", (x) => ({ debts: x.debts.map((d) => d.id === "car-loan" ? { ...d, value: 9000 } : d) }));
  paso("deuda nueva con plazo y día de alta", (x) => ({ debts: x.debts.concat([{ id: "tele", ent: "familia", name: "Tele sintética", value: 600, original: 600, monthly: 100, amort: 100, months: 6, day: 5, asOf: 2026 * 12 + 6, startDay: "2026-06-18", account: "sabadell" }]) }));
  paso("sin deudas", () => ({ debts: [] }));
  paso("vuelven las deudas", () => ({ debts: cartera([]).debts }));
  // Cambian cuentas, cierres, inversiones y la parte de una cuenta: nada de eso está en la caché.
  paso("cambia un saldo", (x) => ({ accounts: x.accounts.map((a) => a.id === "sab" ? { ...a, value: 1999.99 } : a) }));
  paso("cuenta nueva sin movimientos", (x) => ({ accounts: x.accounts.concat([{ id: "nueva", ent: "bbva", name: "Cuenta nueva", value: 50, role: "fijos" }]) }));
  paso("se quita un banco con movimientos", (x) => ({ obAccounts: x.obAccounts.filter((o) => o.ent !== "revolut") }), true);
  paso("vuelve el banco", () => ({ obAccounts: cartera([]).obAccounts }));
  paso("cierre nuevo de una cuenta manual", (x) => ({ accountBalanceHistory: { ...x.accountBalanceHistory, "acc:vieja": x.accountBalanceHistory["acc:vieja"].concat([{ day: "2026-09-25", value: 880 }]) } }));
  paso("foto nueva de inversiones", (x) => ({ invHistory: x.invHistory.concat([{ d: "2026-09-25", v: 5150 }]) }));
  paso("la cuenta de Sabadell a medias", (x) => nuevo.setAccountShare(x, x.accounts[0], "account", 50), true);
  // El mismo estado al día siguiente, y con un gasto fechado mañana (no cuenta hasta que llegue).
  s = { ...s, expenses: s.expenses.concat([{ id: "manana", date: "2026-09-27T09:00:00Z", amount: 40, merchant: "Compra de mañana", category: "compras", ent: "sabadell", source: "manual" }]) };
  for (const hoy of [HOY, "2026-09-27", "2026-09-28", HOY]) igual(s, { today: hoy }, "gasto de mañana, hoy " + hoy);
}

// 3) Un solo banco, dos bancos, y cuentas sin ningún movimiento.
{
  igualEnFrio(cartera(historico(400, 11, ["sabadell"]), { obAccounts: [] }), { today: HOY }, "un solo banco");
  igualEnFrio(cartera(historico(900, 12, ["sabadell", "caixabank"]), { obAccounts: [cartera([]).obAccounts[0]] }), { today: HOY }, "dos bancos");
  igualEnFrio(cartera([]), { today: HOY }, "sin ningún gasto");
  igualEnFrio(cartera([], { accountBalanceHistory: {}, invHistory: [], investments: [], debts: [], assets: [], assetValueHistory: {} }), { today: HOY }, "recién estrenada");
  igual(cartera(historico(300, 13), { accounts: [], obAccounts: [] }), { today: HOY }, "gastos sin ninguna cuenta");
  igual(cartera(historico(300, 14), { accounts: [{ id: "x", ent: "sabadell", name: "Saldo desconocido", value: null, role: "diario" }] }), { today: HOY }, "saldo desconocido: sin serie");
}

// 4) Secuencias al azar sobre las MISMAS filas: añadir, editar, borrar, tachar, mover deudas y de día.
for (let semilla = 1; semilla <= 12; semilla++) {
  const r = rnd(semilla * 7919), bancos = [["sabadell"], ["sabadell", "caixabank"], ["sabadell", "caixabank", "revolut"]][semilla % 3];
  let s = cartera(historico(150 + Math.floor(r() * 500), 100 + semilla, bancos), bancos.length < 3 ? { obAccounts: cartera([]).obAccounts.filter((o) => bancos.includes(o.ent)) } : {});
  let hoy = HOY;
  igual(s, { today: hoy }, "azar " + semilla + ", inicio");
  for (let paso = 0; paso < 14; paso++) {
    const que = Math.floor(r() * 8), i = Math.floor(r() * s.expenses.length), que2 = "azar " + semilla + ", paso " + paso + " (" + que + ")";
    if (que === 0) s = { ...s, expenses: s.expenses.concat([{ id: "az" + semilla + "-" + paso, date: new Date(FIN_MS - Math.floor(r() * 900) * 864e5 - Math.floor(r() * 864e5)).toISOString(), amount: +(r() * 200 - 20).toFixed(2), merchant: COMERCIOS[Math.floor(r() * COMERCIOS.length)], category: "super", ent: bancos[Math.floor(r() * bancos.length)], source: "manual" }]) };
    else if (que === 1) s = { ...s, expenses: s.expenses.map((e, j) => j === i ? { ...e, amount: +(r() * 300).toFixed(2) } : e) };
    else if (que === 2) s = { ...s, expenses: s.expenses.map((e, j) => j === i ? { ...e, date: new Date(FIN_MS - Math.floor(r() * 1000 * 864e5)).toISOString() } : e) };
    else if (que === 3) s = { ...s, expenses: s.expenses.filter((_, j) => j !== i) };
    else if (que === 4) s = { ...s, deleted: (s.deleted || []).concat([nuevo.keyOfExpense(s.expenses[i])]) };
    else if (que === 5) s = { ...s, debts: s.debts.map((d, j) => j === paso % s.debts.length ? { ...d, value: Math.max(0, d.value - 137.31) } : d) };
    else if (que === 6) { const e = s.expenses[i]; e.merchant = COMERCIOS[Math.floor(r() * COMERCIOS.length)]; e.date = new Date(FIN_MS - Math.floor(r() * 700 * 864e5)).toISOString(); s = { ...s, expenses: s.expenses.slice() }; }
    else hoy = new Date(Date.parse(hoy + "T12:00:00Z") + 864e5).toISOString().slice(0, 10);
    igual(s, { today: hoy }, que2);
    if (paso % 5 === 4) igual(s, comoInicio(s, hoy), que2 + " como Inicio");
  }
}

// 5) El oráculo distingue: una caché que no mirase la fecha de la fila daría otra serie.
{
  const sinGuardia = html.replace("if(!m||m.date!==e.date||m.merchant!==e.merchant){", "if(!m){");
  assert.notEqual(sinGuardia, html, "mutante sobre fuente real: la guardia de la caché por fila");
  const mut = loadPureLogic(sinGuardia), s0 = cartera(historico(200, 31));
  mut.netWorthSeries(s0, { today: HOY });
  const e = s0.expenses.find((x) => x.ent === "sabadell" && x.amount > 5 && !x.possibleDup && !x.status && /T/.test(x.date) && x.date < "2026-06"); e.date = "2026-09-20T08:00:00Z";
  const s1 = { ...s0, expenses: s0.expenses.slice() };
  viejo.netWorthSeries.cache = [];
  assert.notDeepEqual(plain(mut.netWorthSeries(s1, { today: HOY })), plain(viejo.netWorthSeries(s1, { today: HOY })), "sin la guardia, una fila cambiada en el sitio deja la serie vieja");
  const sinHoy = html.replace("if(!days||days.today!==today){", "if(!days){");
  assert.notEqual(sinHoy, html, "mutante sobre fuente real: la deuda por día mira qué día es hoy");
  const mut2 = loadPureLogic(sinHoy), s2 = cartera(historico(120, 32));
  mut2.netWorthSeries(s2, { today: HOY });
  viejo.netWorthSeries.cache = [];
  assert.notDeepEqual(plain(mut2.netWorthSeries(s2, { today: "2026-10-04" })), plain(viejo.netWorthSeries(s2, { today: "2026-10-04" })), "sin mirar hoy, la deuda de ayer se queda con la de la semana pasada");
}

console.log("patrimonio-serie-oraculo: " + comparadas + " series (" + puntos + " puntos) idénticas a la función de antes, al céntimo, con las cachés llenas y en frío; 2 mutantes de caché muertos OK");
