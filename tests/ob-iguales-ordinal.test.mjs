#!/usr/bin/env node
/**
 * APUNTES IGUALES DEL MISMO DÍA SIN ID DEL BANCO (12/10/2026: «5 bizums iguales se apuntaban como uno»).
 *
 * Trade Republic por Open Banking no manda id ni comercio: cinco bizums de 12 € el mismo día eran
 * UNA clave día|importe|«Movimiento» y entraba uno (faltaban 48 €). Y el mismo aviso del móvil
 * podía ser reclamado por DOS apuntes del banco en sincronizaciones distintas: contestando siempre
 * «es el mismo», un mes sintético de 122 cargos quedaba 29,90 € por debajo.
 *
 * Lo que vigila este fichero, con cifras al céntimo y por DOS vías (la suma del cliente con
 * `expenseCountsBudget` y la del servidor con `filasComoLaApp` + `statsDelMes`):
 *   · el k-ésimo apunte igual del día lleva ordinal y ENTRA; el primero conserva su clave de siempre;
 *   · un aviso empareja UNA sola vez, también entre sincronizaciones y desde otro móvil;
 *   · las k filas suben, bajan y vuelven a casar en un servidor con el índice único real
 *     (usuario+fecha+importe+comercio) sin duplicarse ni perderse;
 *   · lo guardado y las lápidas de la versión anterior siguen casando (migración implícita);
 *   · el móvil con la versión anterior (788432f4) ni duplica ni pierde más que hoy;
 *   · los bancos que SÍ traen id no cambian.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { transformSync } from "esbuild";
import { loadPureLogic, loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";
import * as H from "./helpers/banco-sintetico.mjs";

const ctx = loadPureLogicFromFile();
const srvJs = transformSync(H.read("supabase/functions/_shared/presupuesto.ts"), { loader: "ts", format: "esm" }).code;
const SRV = await import("data:text/javascript;base64," + Buffer.from(srvJs).toString("base64"));

function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}`); throw e; }
}
console.log("ob-iguales-ordinal");
// Los arrays nacen en el `vm` (otro Array.prototype): se comparan por texto, no por referencia.
const same = (a, b, m) => assert.equal(Array.from(a).join(","), Array.from(b).join(","), m);

/* ── Mundo sintético ───────────────────────────────────────────────────────────────────── */
const DAY = 86400000, HOY = new Date(); HOY.setHours(12, 0, 0, 0);
const ymd = (n) => { const d = new Date(HOY.getTime() + n * DAY); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const LINKS = [{ aspsp: "Trade Republic", syncFrom: "2026-01-01" }];
const estado = (c = ctx) => ({ accounts: [{ id: "tr1", ent: "trade_republic", role: "diario", spendFrom: true, value: 1000 }], settings: { brokersOn: ["trade_republic"], expenseBanks: ["trade_republic"] },
  fixed: [], debts: [], oneoffs: [], flows: [], deleted: [], gemelos: [], expenses: [], investments: [], bankTx: [], budget: 1000, reservaLog: [] });
// Aviso del móvil (noti de TR): hora real, comercio real.
const aviso = (dia, hora, importe, nombre, c = ctx) => ({ id: c.mcExpenseId(), date: new Date(HOY.getTime() + dia * DAY + (hora - 12) * 3600000).toISOString(), merchant: nombre, amount: importe,
  category: importe < 0 ? "ingreso" : "otros", source: "macrodroid", ent: "trade_republic" });
// Lo que entrega Enable Banking de TR: importe, signo, fecha y estado. Nada más.
const ob = (dia, importe, extra = {}) => H.E.mapTransaction(Object.assign({ booking_date: ymd(dia), value_date: ymd(dia), status: "BOOK",
  transaction_amount: { amount: Math.abs(importe).toFixed(2) }, credit_debit_indicator: importe < 0 ? "CRDT" : "DBIT" }, extra));
const flat = (txs, c = ctx, aspsp = "Trade Republic") => c.flattenBankTx([{ aspsp, transactions: txs }]);

// Una sincronización tal como la aplica `runBankSync` (11-app-main): filas + vínculos al estado.
function sync(s, txs, c = ctx) {
  const add = c.importObExpenses(s, flat(txs, c), LINKS) || [];
  // Motor viejo (788432f4): no hay vínculos que guardar.
  const vinculos = c.gemelosDeImportacion ? c.gemelosDeImportacion(add, s.expenses) : [];
  s.expenses = add.concat(s.expenses);
  if (vinculos.length) s.gemelos = c.pushGemelos(s.gemelos, vinculos);
  return add;
}
// «Es el mismo» / «son distintos», tal como lo hace `resolveDup` de 04-tab-gastos.
function resuelve(s, e, same, c = ctx) {
  let next = c.resolvePossibleDup(s, e.id, same);
  if (same) next = Object.assign({}, next, { deleted: c.pushDeleted(next.deleted, c.keyOfExpense(e)) });
  Object.assign(s, next);
}
const c2 = (n) => +Number(n).toFixed(2);
// VÍA 1: lo que pinta la app. VÍA 2: lo que suma el servidor del widget sobre las filas de la nube.
function cifras(s, c = ctx) {
  let gasto = 0, ingreso = 0;
  s.expenses.forEach((e) => { if (!c.expenseCountsBudget(e, s)) return; if (e.amount > 0) gasto += e.amount; else ingreso += -e.amount; });
  const filas = SRV.filasComoLaApp(s.expenses.map((e) => filaNube(e, c)), s.deleted);
  const st = SRV.statsDelMes(filas, s, 0);
  return { gasto: c2(gasto), ingreso: c2(ingreso), srvGasto: st.spent, srvIngreso: st.income, filas: s.expenses.length, pendientes: s.expenses.filter((e) => e.possibleDup).length };
}
// `srvGasto`: lo que suma el servidor cuando difiere de la app. Hoy solo pasa con DOS AVISOS
// idénticos (mismo día, importe y comercio): la nube y el pull los funden en uno (clave sin id) —
// límite anterior a esta entrega, que aquí no se toca y queda apuntado.
function esperado(s, { gasto, ingreso = 0, srvGasto = gasto }, nombre, c = ctx) {
  const x = cifras(s, c);
  assert.equal(x.gasto, c2(gasto), nombre + ": gasto (app)");
  assert.equal(x.srvGasto, c2(srvGasto), nombre + ": gasto (servidor)");
  assert.equal(x.ingreso, c2(ingreso), nombre + ": ingreso (app)");
  assert.equal(x.srvIngreso, c2(ingreso), nombre + ": ingreso (servidor)");
  return x;
}

/* ── Servidor falso con el índice único REAL de `expenses` ─────────────────────────────── */
const filaNube = (e, c = ctx) => ({ id: e.id, fecha: e.date, importe: e.amount, comercio: e.merchant, cat: e.category, source: c.expenseSourceForCloud(e), ob_name: e.obName == null ? null : e.obName, nota: e.note || null });
function servidorFalso() {
  const rows = [];
  let n = 0;
  return {
    rows,
    // upsert … onConflict user_id,fecha,importe,comercio, ignoreDuplicates: la fila que choca NO entra.
    upsert(fila) {
      const choca = rows.find((r) => r.fecha === fila.fecha && r.importe === fila.importe && r.comercio === fila.comercio);
      if (choca) return { inserted: false, id: choca.id };
      const r = Object.assign({}, fila, { id: c.isExpenseUuid(fila.id) ? fila.id : "srv-" + (++n) });
      rows.push(r);
      return { inserted: true, id: r.id };
    },
    sube(expenses, c2) { return expenses.map((e) => this.upsert(filaNube(e, c2 || ctx))); },
    // Lo que baja: `expenseFromRow` + mezcla aditiva, igual que `syncCloudExpenses`.
    baja(s, c2) {
      const cc = c2 || ctx;
      const delSet = {}; (s.deleted || []).forEach((k) => { delSet[k] = 1; });
      const incoming = rows.map(cc.expenseFromRow).filter((e) => e.amount !== 0 && !cc.expenseIsTombstoned(e, delSet));
      const m = cc.mergeExpensesFromCloud(s.expenses, incoming);
      s.expenses = m.list;
      return m;
    },
  };
}
const c = ctx;

/* ── 1. Cinco bizums iguales, sin avisos ───────────────────────────────────────────────── */
t("5 bizums de 12 € el mismo día sin avisos: entran los 5 (antes 1) y la segunda sincronización no añade nada", () => {
  const s = estado();
  const add = sync(s, [ob(-2, -12), ob(-2, -12), ob(-2, -12), ob(-2, -12), ob(-2, -12)]);
  assert.equal(add.length, 5);
  same(add.map((e) => c.obOrdinalOf(e)).sort(), [1, 2, 3, 4, 5]);
  assert.equal(add.filter((e) => e.obOrd == null).length, 1, "el primero no lleva ordinal: su clave es la de siempre");
  assert.equal(new Set(add.map((e) => c.keyOfExpense(e))).size, 5, "cinco claves distintas");
  assert.equal(new Set(add.map((e) => e.date)).size, 5, "cinco fechas distintas (mediodía + ordinal−1 ms) para el índice único");
  add.forEach((e) => assert.equal(String(e.date).slice(0, 10), ymd(-2), "mismo día"));
  esperado(s, { gasto: 0, ingreso: 60 }, "5 bizums");
  assert.equal(sync(s, [ob(-2, -12), ob(-2, -12), ob(-2, -12), ob(-2, -12), ob(-2, -12)]).length, 0, "segunda sincronización: 0 nuevas");
  // El banco trae MENOS de los que tengo: no se borra nada.
  assert.equal(sync(s, [ob(-2, -12), ob(-2, -12)]).length, 0);
  assert.equal(s.expenses.length, 5);
  // Y si mañana trae uno más (k=6, tengo 5): entra exactamente uno.
  const mas = sync(s, [ob(-2, -12), ob(-2, -12), ob(-2, -12), ob(-2, -12), ob(-2, -12), ob(-2, -12)]);
  assert.equal(mas.length, 1); assert.equal(mas[0].obOrd, 6);
});

t("el ordinal no depende del orden en que el banco devuelva los iguales", () => {
  const a = estado(), b = estado();
  const x = ob(-3, 7.5, { remittance_information: "uno" }), y = ob(-3, 7.5, { remittance_information: "dos" });
  sync(a, [x, y]); sync(b, [y, x]);
  const firma = (s) => s.expenses.map((e) => c.keyOfExpense(e) + "→" + (e.note || "")).sort().join(";");
  assert.equal(firma(a), firma(b));
});

/* ── 2. Cinco bizums con sus cinco avisos ──────────────────────────────────────────────── */
t("5 bizums + 5 avisos: 5 preguntas; «es el mismo» deja 60 € exactos y la segunda sincronización no pregunta", () => {
  const s = estado();
  for (let i = 0; i < 5; i++) s.expenses.unshift(aviso(-2, 21 + i * 0.1, -12, "Bizum de Amigo " + i));
  const add = sync(s, Array.from({ length: 5 }, () => ob(-2, -12)));
  assert.equal(add.length, 5);
  assert.equal(add.filter((e) => e.possibleDup).length, 5, "antes era 1 pregunta (los otros 4 se fundían)");
  assert.equal(new Set(add.map((e) => e.possibleDupOf)).size, 5, "cinco avisos distintos reclamados");
  assert.equal(s.gemelos.length, 5, "el vínculo queda en el estado");
  esperado(s, { gasto: 0, ingreso: 60 }, "pendientes no cuentan");
  add.forEach((e) => resuelve(s, e, true));
  esperado(s, { gasto: 0, ingreso: 60 }, "es el mismo ×5");
  assert.equal(s.expenses.length, 5);
  const otra = sync(s, Array.from({ length: 5 }, () => ob(-2, -12)));
  assert.equal(otra.length, 0, "las cinco lápidas (ordinal 1 sin sufijo, 2..5 con él) paran al banco");
});

/* ── 3. Dos cafés de 1,50 € ────────────────────────────────────────────────────────────── */
const cafes = (avisos, bancos) => {
  const s = estado();
  avisos.forEach((h) => s.expenses.unshift(aviso(-2, h, 1.5, "Café")));
  const add = sync(s, bancos.map(() => ob(-2, 1.5)));
  return { s, add };
};
t("dos cafés 2+2: dos preguntas, cada una con su aviso; «es el mismo» → 3,00 €", () => {
  const { s, add } = cafes([8, 17], [1, 1]);
  assert.equal(add.length, 2); assert.equal(add.filter((e) => e.possibleDup).length, 2);
  assert.notEqual(add[0].possibleDupOf, add[1].possibleDupOf);
  add.forEach((e) => resuelve(s, e, true));
  esperado(s, { gasto: 3, srvGasto: 1.5 }, "2+2");
  assert.equal(sync(s, [ob(-2, 1.5), ob(-2, 1.5)]).length, 0);
});
t("dos cafés 2+1: una pregunta; «es el mismo» → 3,00 €; cuando llegue el segundo del banco, reclama el OTRO aviso", () => {
  const { s, add } = cafes([8, 17], [1]);
  assert.equal(add.length, 1); assert.ok(add[0].possibleDup);
  resuelve(s, add[0], true);
  esperado(s, { gasto: 3, srvGasto: 1.5 }, "2+1");
  const luego = sync(s, [ob(-2, 1.5), ob(-2, 1.5)]);
  assert.equal(luego.length, 1); assert.equal(luego[0].obOrd, 2); assert.ok(luego[0].possibleDup);
  assert.notEqual(luego[0].possibleDupOf, add[0].possibleDupOf, "el aviso ya reclamado no se vuelve a ofrecer");
  resuelve(s, luego[0], true);
  esperado(s, { gasto: 3, srvGasto: 1.5 }, "2+1 completado");
});
t("dos cafés 1+2: UNA pregunta y el otro apunte entra y cuenta; «es el mismo» → 3,00 € (antes 1,50)", () => {
  const { s, add } = cafes([8], [1, 1]);
  assert.equal(add.length, 2);
  assert.equal(add.filter((e) => e.possibleDup).length, 1);
  assert.equal(add.filter((e) => !e.possibleDup).length, 1);
  add.filter((e) => e.possibleDup).forEach((e) => resuelve(s, e, true));
  esperado(s, { gasto: 3 }, "1+2");
});

/* ── 4. Compra y devolución ────────────────────────────────────────────────────────────── */
t("compra de 20 € y su devolución el mismo día: dos apuntes (el signo va en la clave), neto 0", () => {
  const s = estado();
  s.expenses.unshift(aviso(-2, 10, 20, "Tienda"));
  const add = sync(s, [ob(-2, 20), ob(-2, -20)]);
  assert.equal(add.length, 2);
  assert.equal(add.filter((e) => e.obOrd).length, 0, "no son iguales: ningún ordinal");
  add.filter((e) => e.possibleDup).forEach((e) => resuelve(s, e, true));
  esperado(s, { gasto: 20, ingreso: 20 }, "compra+devolución");
});

/* ── 5. El aviso reclamado no se reutiliza, tampoco desde otro móvil ──────────────────── */
t("un aviso ya resuelto «es el mismo» no es gemelo de otro apunte igual dos días después: ese entra nuevo y cuenta", () => {
  const s = estado();
  s.expenses.unshift(aviso(-3, 10, 29.9, "Decathlon"));
  const a = sync(s, [ob(-2, 29.9)]);
  assert.ok(a[0].possibleDup); resuelve(s, a[0], true);
  esperado(s, { gasto: 29.9 }, "primero");
  const b = sync(s, [ob(-2, 29.9), ob(0, 29.9)]);
  assert.equal(b.length, 1, "el de hace dos días ya tiene lápida; el de hoy es nuevo");
  assert.equal(!!b[0].possibleDup, false, "y no pregunta: su único candidato ya está reclamado");
  esperado(s, { gasto: 59.8 }, "segundo (antes: pregunta, «es el mismo» y −29,90 €)");
});
t("desde OTRO móvil: con el vínculo en el estado (sin possibleDupOf local), el aviso sigue reclamado", () => {
  const s = estado();
  const av = aviso(-3, 10, 29.9, "Decathlon");
  s.expenses.unshift(av);
  const a = sync(s, [ob(-2, 29.9)]);
  // El otro móvil solo tiene la fila OB tal como baja de la nube (sin `possibleDupOf`) y el estado.
  const otro = estado();
  otro.gemelos = s.gemelos.slice();
  otro.expenses = [Object.assign({}, av), c.expenseFromRow(filaNube(a[0]))];
  assert.equal(otro.expenses[1].possibleDupOf, undefined);
  const b = sync(otro, [ob(-2, 29.9), ob(-1, 29.9)]);
  assert.equal(b.length, 1); assert.equal(!!b[0].possibleDup, false, "el aviso ya está reclamado por el pendiente del otro móvil");
});
t("«son distintos» suelta el aviso: un apunte posterior puede volver a reclamarlo", () => {
  const s = estado();
  s.expenses.unshift(aviso(-3, 10, 29.9, "Decathlon"));
  const a = sync(s, [ob(-2, 29.9)]);
  resuelve(s, a[0], false);
  assert.equal(s.gemelos.length, 0);
  esperado(s, { gasto: 59.8 }, "son distintos");
  const b = sync(s, [ob(-2, 29.9), ob(-1, 29.9)]);
  assert.equal(b.length, 1); assert.ok(b[0].possibleDup, "el aviso vuelve a estar libre");
});

/* ── 6. El mes sintético de 122 cargos (el de la sonda), contestando siempre «es el mismo» ── */
function mesSintetico() {
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const pagos = []; let n = 0;
  for (let d = -25; d <= 0; d++) for (let i = 0; i < 4; i++) { n++; pagos.push({ dia: d, hora: 9 + i * 3, amount: Number((3 + n * 0.37).toFixed(2)), m: "Tienda " + n, lag: d === 0 ? 0 : Math.min(-d, Math.floor(rnd() * 3)), aviso: 1, banco: 1 }); }
  pagos.push({ dia: -6, hora: 8, amount: 1.5, m: "Café", lag: 0, aviso: 1, banco: 1 }, { dia: -6, hora: 17, amount: 1.5, m: "Café", lag: 0, aviso: 1, banco: 1 },
    { dia: -9, hora: 10, amount: 29.9, m: "Decathlon", lag: 1, aviso: 1, banco: 1 }, { dia: -7, hora: 0, amount: 29.9, m: "", lag: 0, aviso: 0, banco: 1 },
    { dia: -12, hora: 10, amount: 50, m: "Gasolinera", lag: 0, aviso: 1, banco: 0 }, { dia: -11, hora: 0, amount: 50, m: "", lag: 0, aviso: 0, banco: 1 });
  for (let d = -25; d <= 0; d += 2) pagos.push({ dia: d, hora: 0, amount: Number((0.11 + (-d) * 0.03).toFixed(2)), m: "", lag: 0, aviso: 0, banco: 1 });
  return pagos;
}
function corre(pagos, cc = ctx, respuestas = () => true) {
  const s = estado(cc); let preguntas = 0, nuevas = 0;
  for (let d = -25; d <= 0; d++) {
    pagos.filter((p) => p.dia === d && p.aviso).forEach((p) => s.expenses.unshift(aviso(p.dia, p.hora, p.amount, p.m, cc)));
    const add = sync(s, pagos.filter((p) => p.banco && p.dia + p.lag <= d).map((p) => ob(p.dia + p.lag, p.amount)), cc);
    nuevas += add.length;
    add.filter((e) => e.possibleDup).forEach((e) => { preguntas++; resuelve(s, e, respuestas(e, preguntas), cc); });
  }
  return { s, preguntas, nuevas };
}
t("mes sintético (122 cargos del banco): «es el mismo» siempre → suma EXACTA (antes −29,90 €)", () => {
  const pagos = mesSintetico();
  const real = c2(pagos.filter((p) => p.banco).reduce((x, p) => x + p.amount, 0));
  assert.equal(pagos.filter((p) => p.banco).length, 122);
  const r = corre(pagos);
  // El aviso de la preautorización de 50 € (que el banco nunca apunta) lo reclama el cargo de 50 del
  // día siguiente, igual que hoy: «es el mismo» deja el aviso en pie en lugar del cargo y la suma
  // sigue siendo la del banco. Aquí solo cambian las cifras, no cuándo ni cómo se pregunta.
  // El servidor funde los DOS avisos idénticos del café (límite anterior, ver `esperado`): −1,50.
  esperado(r.s, { gasto: real, srvGasto: real - 1.5 }, "mes de 122 cargos, siempre «es el mismo»");
  assert.ok(r.preguntas >= 105, "sigue preguntando como hoy: " + r.preguntas);
  console.log(`    mes sintético: ${r.preguntas} preguntas, suma ${cifras(r.s).gasto} = banco ${real}`);
});
t("segunda sincronización seguida, con respuestas mezcladas por el camino: 0 filas nuevas, 0 preguntas nuevas", () => {
  const pagos = mesSintetico();
  const r = corre(pagos, ctx, (e, i) => i % 2 === 0);
  const txs = pagos.filter((p) => p.banco).map((p) => ob(p.dia + p.lag, p.amount));
  const otra = sync(r.s, txs);
  assert.equal(otra.length, 0);
  assert.equal(otra.filter((e) => e.possibleDup).length, 0);
});

/* ── 7. Banco que SÍ trae id: nada cambia ──────────────────────────────────────────────── */
t("Sabadell (con entry_reference): dos cargos iguales con ids distintos se tratan como hoy (sin ordinal, misma fecha)", () => {
  const s = estado();
  s.accounts.push({ id: "sb", ent: "sabadell", role: "fijos", value: 100 });
  const tx = (ref) => H.E.mapTransaction({ entry_reference: ref, booking_date: ymd(-2), value_date: ymd(-2), status: "BOOK", transaction_amount: { amount: "9.99" }, credit_debit_indicator: "DBIT", creditor: { name: "Netflix" } });
  const add = c.importObExpenses(s, flat([tx("a"), tx("b")], ctx, "Banco Sabadell"), [{ aspsp: "Banco Sabadell", syncFrom: "2026-01-01" }]) || [];
  assert.equal(add.filter((e) => e.obOrd).length, 0, "con id no hay ordinal");
  assert.equal(add.length, 1, "misma fusión por clave que hoy (lo cambiará, si acaso, otra entrega)");
  assert.equal(add[0].extId, "a");
  s.expenses = add.concat(s.expenses);
  assert.equal(c.importObExpenses(s, flat([tx("a")], ctx, "Banco Sabadell"), [{ aspsp: "Banco Sabadell", syncFrom: "2026-01-01" }]), null, "por id");
});

/* ── 8. Servidor falso con índice único: suben, bajan y vuelven a casar ────────────────── */
t("las k filas iguales suben al servidor con índice único, bajan a otro móvil y vuelven a casar sin duplicarse ni perderse", () => {
  const nube = servidorFalso();
  const a = estado();
  for (let i = 0; i < 5; i++) a.expenses.unshift(aviso(-2, 21 + i * 0.1, -12, "Bizum de Amigo " + i));
  nube.sube(a.expenses);
  const add = sync(a, Array.from({ length: 5 }, () => ob(-2, -12)));
  const subida = nube.sube(add);
  assert.equal(subida.filter((x) => x.inserted).length, 5, "las 5 pasan el índice único (fecha distinta por ordinal)");
  assert.equal(nube.rows.filter((r) => r.source.indexOf("ob:") === 0).length, 5);
  same(nube.rows.filter((r) => r.source.indexOf("ob:") === 0).map((r) => r.source).sort(),
    ["ob:trade_republic#dup", "ob:trade_republic#dup#n2", "ob:trade_republic#dup#n3", "ob:trade_republic#dup#n4", "ob:trade_republic#dup#n5"]);
  // Subir otra vez (el mismo móvil u otro) no crea filas: upsert idempotente.
  assert.equal(nube.sube(add).filter((x) => x.inserted).length, 0);
  // Baja al mismo móvil: nada nuevo, nada perdido.
  const m1 = nube.baja(a);
  assert.equal(m1.nuevos, 0); assert.equal(a.expenses.length, 10);
  // Baja a un móvil recién instalado: 10 filas, 5 pendientes con su ordinal.
  const b = estado(); b.gemelos = a.gemelos.slice();
  const m2 = nube.baja(b);
  assert.equal(m2.nuevos, 10);
  same(b.expenses.filter((e) => e.source === "ob").map((e) => c.obOrdinalOf(e)).sort(), [1, 2, 3, 4, 5]);
  assert.equal(b.expenses.filter((e) => e.possibleDup).length, 5);
  esperado(b, { gasto: 0, ingreso: 60 }, "móvil B");
  // Y en B el banco vuelve a traer los 5: no entra ninguno (las claves con ordinal casan).
  assert.equal(sync(b, Array.from({ length: 5 }, () => ob(-2, -12))).length, 0);
  // B contesta «es el mismo» a los cinco; A recibe las lápidas con el estado y no resucita nada.
  b.expenses.filter((e) => e.possibleDup).forEach((e) => resuelve(b, e, true));
  esperado(b, { gasto: 0, ingreso: 60 }, "B tras contestar");
  a.deleted = b.deleted.slice(); a.gemelos = b.gemelos.slice();
  nube.baja(a);
  assert.equal(sync(a, Array.from({ length: 5 }, () => ob(-2, -12))).length, 0, "A con las lápidas de B: nada nuevo");
});

/* ── 9. Compatibilidad con lo ya guardado y con el móvil viejo (788432f4) ─────────────── */
const htmlViejo = execFileSync("git", ["show", "788432f4:public/index.html"], { cwd: new URL("..", import.meta.url), encoding: "utf8", maxBuffer: 64e6 });
const viejo = loadPureLogic(htmlViejo);

t("lo guardado por la versión anterior conserva su clave: ni se repregunta ni se duplica al actualizar", () => {
  // El móvil viejo ya importó un bizum (el único que podía) y contestó «es el mismo» a otro.
  const sv = estado(viejo);
  sv.expenses.unshift(aviso(-2, 21, -12, "Bizum A", viejo));
  const addV = sync(sv, [ob(-2, -12), ob(-2, -12)], viejo);
  assert.equal(addV.length, 1, "la versión anterior fundía los dos");
  resuelve(sv, addV[0], true, viejo);
  // Actualiza: mismo estado, motor nuevo.
  const s = Object.assign(estado(), { expenses: sv.expenses.map((e) => Object.assign({}, e)), deleted: sv.deleted.slice(), gemelos: [] });
  assert.equal(c.keyOfExpense(s.expenses[0]), viejo.keyOfExpense(sv.expenses[0]), "misma clave para la fila de siempre");
  const add = sync(s, [ob(-2, -12), ob(-2, -12)]);
  assert.equal(add.length, 1, "entra SOLO el segundo (ordinal 2); el primero sigue tapado por la lápida vieja");
  assert.equal(add[0].obOrd, 2);
  assert.equal(!!add[0].possibleDup, false, "su único aviso ya lo representa la lápida… y hoy no se puede saber: entra nuevo y cuenta");
  esperado(s, { gasto: 0, ingreso: 24 }, "tras actualizar");
});

t("móvil con la versión anterior compartiendo nube: ve 1 de los 5 (como hoy), no duplica, y su sincronización no añade nada", () => {
  const nube = servidorFalso();
  const a = estado();
  const add = sync(a, Array.from({ length: 5 }, () => ob(-2, -12)));
  nube.sube(add);
  const sv = estado(viejo);
  const m = nube.baja(sv, viejo);
  assert.equal(m.nuevos, 1, "su clave funde las cinco: una fila, la de siempre (hoy ve lo mismo)");
  assert.equal(sv.expenses[0].ent, "trade_republic", "el banco se lee limpio aunque la fila llegue con «#n3»");
  assert.equal(viejo.expenseBankOf(sv.expenses[0]), "trade_republic");
  const x = cifras(sv, viejo);
  assert.equal(x.ingreso, 12); assert.equal(x.filas, 1);
  assert.equal(sync(sv, Array.from({ length: 5 }, () => ob(-2, -12)), viejo).length, 0, "y su importador no mete ninguno más");
  // Lo que el móvil viejo pueda subir no estropea nada: choca con lo que ya está.
  assert.equal(nube.sube(sv.expenses, viejo).filter((r) => r.inserted).length, 0);
  // Y el servidor viejo (sin `ordinalDeSource`) leería el banco y la marca igual que siempre.
  nube.rows.forEach((r) => { assert.equal(SRV.bancoDeSource(r.source), "trade_republic"); assert.equal(SRV.esPosibleRepetido(r.source), false); });
});

t("una fila de la nube con «#dup#n2» vuelve marcada, con su banco y su ordinal, y sin ordinal cuando no lo lleva", () => {
  const e = c.expenseFromRow({ id: "x", fecha: ymd(-1) + "T10:00:00.001Z", importe: 12, comercio: "Movimiento", cat: "otros", source: "ob:trade_republic#dup#n2" });
  assert.equal(e.ent, "trade_republic"); assert.equal(e.possibleDup, true); assert.equal(e.obOrd, 2); assert.equal(e.source, "ob");
  assert.equal(c.expenseSourceForCloud(e), "ob:trade_republic#dup#n2", "ida y vuelta sin perder nada");
  const d = c.expenseFromRow({ id: "y", fecha: ymd(-1) + "T10:00:00.000Z", importe: 12, comercio: "Movimiento", cat: "deudas", source: "ob:sabadell~deuda.d1#n3" });
  assert.equal(d.debtId, "d1"); assert.equal(d.ent, "sabadell"); assert.equal(d.obOrd, 3);
  assert.equal(c.expenseSourceForCloud(d), "ob:sabadell~deuda.d1#n3");
  const h = c.expenseFromRow({ id: "z", fecha: ymd(-1) + "T10:00:00.000Z", importe: 5, comercio: "Movimiento", cat: "otros", source: "ob-hist:trade_republic#n2" });
  assert.equal(h.source, "ob-hist"); assert.equal(h.obOrd, 2);
  assert.equal(c.expenseFromRow({ id: "w", fecha: ymd(-1) + "T10:00:00.000Z", importe: 5, comercio: "M", cat: "otros", source: "ob:trade_republic" }).obOrd, undefined);
});

/* ── 10. La misma regla en el servidor ─────────────────────────────────────────────────── */
t("el servidor del widget separa las k filas iguales igual que la app (misma clave, mismas cifras)", () => {
  const s = estado();
  const add = sync(s, Array.from({ length: 3 }, () => ob(-2, 4.2)));
  const filas = add.map((e) => filaNube(e));
  assert.equal(SRV.filasComoLaApp(filas, []).length, 3, "antes fundía las tres en una");
  add.forEach((e, i) => assert.equal(SRV.claveComoLaApp(filas[i]), c.keyOfExpense(e), "misma clave que keyOfExpense"));
  esperado(s, { gasto: 12.6 }, "3 × 4,20");
});

/* ── 11. Rendimiento: no se recorre el histórico por cada apunte ───────────────────────── */
t("importObExpenses con 20.000 gastos guardados: el coste no se dispara frente a la versión anterior", () => {
  const monta = (cc) => {
    const s = estado(cc);
    for (let i = 0; i < 20000; i++) {
      const d = -(i % 400) - 3;
      s.expenses.push(i % 3 === 0
        ? { id: "a" + i, date: new Date(HOY.getTime() + d * DAY).toISOString(), merchant: "Tienda " + (i % 97), amount: c2(1 + (i % 50)), category: "otros", source: "macrodroid", ent: "trade_republic" }
        : { id: "o" + i, date: new Date(HOY.getTime() + d * DAY).toISOString(), merchant: "Movimiento", obName: "Movimiento", amount: c2(1 + (i % 53)), category: "otros", source: "ob", ent: "trade_republic" });
    }
    return s;
  };
  // Apuntes DISTINTOS entre sí: los dos motores importan las mismas filas y el tiempo es comparable.
  // (Con k iguales por día el nuevo importa k veces más filas —es la función— y cuesta lo que esas filas.)
  const txs = []; for (let i = 0; i < 150; i++) txs.push(ob(-(i % 5), c2(1 + i * 0.01)));
  const mide = (cc) => { const s = monta(cc); const t0 = process.hrtime.bigint(); let n = 0; for (let k = 0; k < 5; k++) n += (cc.importObExpenses(s, flat(txs, cc), LINKS) || []).length; return { ms: Number(process.hrtime.bigint() - t0) / 5e6, n: n / 5 }; };
  mide(viejo); mide(ctx);   // calentar
  const tv = mide(viejo), tn = mide(ctx);
  assert.equal(tn.n, tv.n, "mismas filas importadas");
  console.log(`    importObExpenses con 20.000 gastos y 150 apuntes (${tn.n} entran): antes ${tv.ms.toFixed(1)} ms · ahora ${tn.ms.toFixed(1)} ms`);
  assert.ok(tn.ms < Math.max(tv.ms * 1.5, tv.ms + 15), "se dispara: algo recorre el histórico por apunte");
});
