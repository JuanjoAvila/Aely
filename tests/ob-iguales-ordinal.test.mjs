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
  // Mismo nombre («Movimiento») y conceptos distintos: la descripción bancaria va a la nota, no al
  // título. Con `remittance_information` el título cambiaba y los dos NO formaban grupo (revisión
  // 12/10): el test pasaba sin probar nada.
  const a = estado(), b = estado();
  const x = ob(-3, 7.5, { bank_transaction_code: { description: "uno" } }), y = ob(-3, 7.5, { bank_transaction_code: { description: "dos" } });
  const ra = sync(a, [x, y]), rb = sync(b, [y, x]);
  same(ra.map((e) => c.obOrdinalOf(e)).sort(), [1, 2], "forman grupo: ranuras 1 y 2");
  const firma = (s) => s.expenses.map((e) => c.keyOfExpense(e) + "→" + (e.note || "")).sort().join(";");
  assert.equal(firma(a), firma(b));
  assert.ok(/→uno/.test(firma(a)) && /→dos/.test(firma(a)), "cada fila conserva su propio concepto");
  assert.equal(c.obOrdinalOf(ra.find((e) => e.note === "uno")), c.obOrdinalOf(rb.find((e) => e.note === "uno")), "la ranura se asigna por contenido, no por posición");
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
  // Un apunte a mano sigue con su clave de siempre (id, sin sufijo): sus lápidas tienen que casar.
  const manual = { id: c.mcExpenseId(), date: ymd(-1) + "T10:00:00.000Z", merchant: "Bizum", amount: 14.9, category: "otros", source: "manual" };
  assert.equal(SRV.claveComoLaApp(filaNube(manual)), c.keyOfExpense(manual));
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

/* ── 12. «Importar histórico» tras tres meses de uso (revisión de la entrega 1, punto 1) ──────
   Lo contestado «es el mismo» —antes de actualizar (lápida sin vínculo) y después (lápida +
   vínculo en `gemelos`)— NO puede volver como nuevo: entraba con lápida, invisible en la lista
   pero restando del saldo de la cuenta diaria y resubido en cada pull. */
const histTR = (s, txs, cc = ctx) => {
  const flat = cc.histFlattenHistoryLinks({ links: [{ aspsp: "Trade Republic", accounts: [{ uid: "tr", transactions: txs }] }] }, s.expenses, { trade_republic: 1 });
  const cl = cc.histClassifyCandidates(flat.out, s);
  return { cands: flat.out, rows: cl.rows, commit: cc.histBuildCommit(flat.out, cl.rows, s) };
};
const cashTR = (s, cc = ctx) => c2(s.expenses.filter((e) => cc.expenseBankOf(e) === "trade_republic" && cc.expenseCountsCash(e, s)).reduce((a, e) => a + e.amount, 0));
t("histórico tras 3 meses: lo contestado «es el mismo» con la versión anterior Y con esta sale como «ya lo tienes», no como nuevo", () => {
  // Verdad del banco: dos cargos distintos al día con su aviso, más un día con 3 iguales y 3 avisos.
  const pagos = []; let n = 0;
  for (let d = -90; d <= 0; d++) for (let i = 0; i < 2; i++) { n++; pagos.push({ dia: d, hora: 9 + i * 5, amount: c2(30 + n * 0.37), m: "Tienda " + n }); }
  for (let i = 0; i < 3; i++) pagos.push({ dia: -5, hora: 8 + i * 2, amount: 7, m: "Bar " + i });
  const banco = (hasta, desde) => pagos.filter((p) => p.dia <= hasta && p.dia >= desde).map((p) => ob(p.dia, p.amount));
  // Tres meses con la versión anterior, contestando siempre «es el mismo».
  const sv = estado(viejo); let viejas = 0;
  for (let d = -90; d <= -2; d++) {
    pagos.filter((p) => p.dia === d).forEach((p) => sv.expenses.unshift(aviso(p.dia, p.hora, p.amount, p.m, viejo)));
    sync(sv, banco(d, d - 9), viejo).filter((e) => e.possibleDup).forEach((e) => { viejas++; resuelve(sv, e, true, viejo); });
  }
  assert.ok(viejas > 170, "la versión anterior contestó " + viejas);
  // Actualiza: mismo estado, motor nuevo; llegan los dos últimos días y los 2 bizums que aquélla fundía.
  const s = Object.assign(estado(), { expenses: sv.expenses.map((e) => Object.assign({}, e)), deleted: sv.deleted.slice(), gemelos: [] });
  pagos.filter((p) => p.dia > -2).forEach((p) => s.expenses.unshift(aviso(p.dia, p.hora, p.amount, p.m)));
  const add = sync(s, banco(0, -19));
  assert.equal(add.length, 6, "2 cargos × 2 días + las ranuras 2 y 3 del día de los 3 iguales");
  add.forEach((e) => { assert.ok(e.possibleDup, "cada uno con su aviso"); resuelve(s, e, true); });
  assert.equal(s.gemelos.length, 6);
  const antes = cashTR(s);
  const h = histTR(s, banco(0, -90));
  const cnt = {}; h.rows.forEach((r) => { const k = r.status + (r.reason ? ":" + r.reason : ""); cnt[k] = (cnt[k] || 0) + 1; });
  assert.equal(h.cands.length, pagos.length - 2, "el histórico funde los 3 iguales de una cuenta en un candidato");
  assert.equal(cnt["new"] || 0, 0, "ninguno nuevo: " + JSON.stringify(cnt));
  assert.equal(cnt["dup:existing"], h.cands.length, "todos «ya lo tienes apuntado»");
  assert.equal(h.commit.expAdds.length, 0, "no entra ninguna fila con lápida");
  assert.equal(cashTR(s), antes, "el saldo de la cuenta diaria no se mueve");
});
t("el candidato con lápida no se lleva un aviso libre como «cercano»: ese aviso queda para el candidato que sí está sin apuntar", () => {
  const s = estado();
  s.expenses.unshift(aviso(-1, 10, 29.9, "Decathlon"), aviso(-2, 18, 29.9, "Decathlon bis"));
  const a = sync(s, [ob(-1, 29.9)]);
  resuelve(s, a[0], true);                                   // lápida del día −1 + vínculo con el primer aviso
  const h = histTR(s, [ob(-1, 29.9), ob(-2, 29.9)]);       // el histórico ordena por fecha descendente: el de la lápida va primero
  assert.equal(h.rows[0].status, "dup"); assert.equal(h.rows[0].reason, "existing"); assert.equal(h.rows[0].match, null);
  assert.equal(h.rows[1].status, "maybe", "el aviso libre es del candidato sin apuntar, no del que ya tiene lápida");
  assert.equal(h.rows[1].match.merchant, "Decathlon bis");
});
t("un vínculo en `gemelos` sin su lápida (la lápida va por último-que-escribe; el vínculo, por unión) también es «ya lo tienes»", () => {
  const s = estado();
  const x = sync(s, [ob(-2, 29.9)])[0];
  s.expenses = []; s.deleted = [];                           // la fila y su lápida se quedaron en el otro móvil…
  s.gemelos = c.pushGemelos([], [{ avisoId: "a1", aviso: "k", banco: c.keyOfExpense(x) }]);   // …el vínculo llegó por la unión
  const h = histTR(s, [ob(-2, 29.9)]);
  assert.equal(h.rows[0].status, "dup"); assert.equal(h.rows[0].reason, "existing");
});
t("la pantalla del histórico (el bloque REAL de BankHistoryImport) guarda los vínculos de los «puede que ya lo tengas» marcados", () => {
  const compSrc = H.read("src/modules/10-app-components.js");
  const m = compSrc.match(/const vinculos=gemelosDeImportacion\(keepLocal, s\.expenses\);\s*if\(vinculos\.length\) next\.gemelos=pushGemelos\(s\.gemelos, vinculos\);/);
  assert.ok(m, "no se encuentra el bloque de vínculos en BankHistoryImport");
  const guarda = new Function("keepLocal", "s", "next", "gemelosDeImportacion", "pushGemelos", m[0] + "\nreturn next;");
  const s = estado();
  const av = aviso(-2, 10, 29.9, "Decathlon"); s.expenses.unshift(av);
  const keep = [{ id: c.mcExpenseId(), date: ymd(-1) + "T10:00:00.000Z", merchant: "Movimiento", amount: 29.9, category: "otros", source: "ob-hist", ent: "trade_republic", possibleDup: true, possibleDupOf: av.id }];
  const next = guarda(keep, s, {}, c.gemelosDeImportacion, c.pushGemelos);
  assert.equal(next.gemelos.length, 1); assert.equal(next.gemelos[0].avisoId, av.id);
});
t("«saltar» (lápida de una versión anterior) se salta el primer aviso LIBRE que casa, no uno ya reclamado", () => {
  const s = estado();
  const A = aviso(-2, 9, 7, "Bar A"), B = aviso(-2, 10, 7, "Bar B"), C = aviso(-2, 11, 7, "Bar C");
  s.expenses.unshift(A, B, C);                               // A es el primero que casa, y está reclamado
  const base = sync(s, [ob(-2, 7)])[0];
  s.deleted = c.pushDeleted([], c.keyOfExpense(base)); s.expenses = s.expenses.filter((e) => e.id !== base.id);
  // A quedó reclamado por otro apunte (vínculo); la lápida de la ranura 1 es de una versión sin vínculos.
  s.gemelos = c.pushGemelos([], [{ avisoId: A.id, aviso: c.keyOfExpense(A), banco: "otro-apunte" }]);
  const add = sync(s, [ob(-2, 7), ob(-2, 7), ob(-2, 7)]);
  same(add.map((e) => e.obOrd).sort(), [2, 3]);
  const preguntas = add.filter((e) => e.possibleDup);
  assert.equal(preguntas.length, 1, "B fue el «es el mismo» de entonces; A ya tiene dueño: solo queda C");
  assert.equal(preguntas[0].possibleDupOf, C.id);
});

/* ── 13. Un pull no resube las filas con lápida (el bloque REAL de `syncCloudExpenses`) ───── */
const mainSrc = H.read("src/modules/11-app-main.js");
t("backfill: una fila local con lápida no se resube en cada pull", () => {
  const m = mainSrc.match(/const delSet=\{\}; \(stateRef\.current\.deleted\|\|\[\]\)[\s\S]*?subirGasto\(e, "backfill"\); \}\);/);
  assert.ok(m, "no se encuentra el bloque del backfill en syncCloudExpenses");
  const pull = new Function("stateRef", "rows", "expenseFromRow", "expenseIsTombstoned", "keyOfExpense", "subirGasto", m[0]);
  const s = estado();
  const viva = { id: c.mcExpenseId(), date: ymd(-2) + "T10:00:00.000Z", merchant: "Movimiento", amount: 12, category: "otros", source: "ob", ent: "trade_republic" };
  const muerta = Object.assign({}, viva, { id: c.mcExpenseId(), amount: 29.9 });
  s.expenses = [viva, muerta]; s.deleted = [c.keyOfExpense(muerta)];
  const subidas = [];
  pull({ current: s }, [], c.expenseFromRow, c.expenseIsTombstoned, c.keyOfExpense, (e, why) => subidas.push(why + ":" + e.amount));
  same(subidas, ["backfill:12"], "solo la viva");
});

/* ── 14. `gemelos` entre dos móviles: unión, gane quien gane el estado ──────────────────── */
t("dos móviles: el vínculo de A sobrevive al estado de B (y al revés) con el bloque REAL de syncFromCloud", () => {
  const m = mainSrc.match(/const merged=mergeExpenses\(prev\.expenses[\s\S]*?if\(gem!==baseObj\.gemelos\) baseObj\.gemelos=gem;/);
  assert.ok(m, "no se encuentra el bloque de último-que-escribe en syncFromCloud");
  const adopta = new Function("prev", "cloudState", "freshLogin", "mergeExpenses", "fusionarGemelos", m[0] + "\nreturn baseObj;");
  const mezcla = (p) => ({ list: p });
  const A = estado(), B = estado();
  const av = aviso(-3, 10, 29.9, "Decathlon"); A.expenses.unshift(av); B.expenses.unshift(Object.assign({}, av));
  const a = sync(A, [ob(-2, 29.9)]);              // A reclama el aviso
  assert.equal(A.gemelos.length, 1);
  B.gemelos = c.pushGemelos([], [{ avisoId: "otro", aviso: "k", banco: "b" }]);   // B tiene otro vínculo suyo
  // B sube su estado más reciente: para A la nube es más nueva → adopta la nube… y conserva lo suyo.
  const enA = adopta(Object.assign({}, A, { _savedAt: 1 }), Object.assign({}, B, { _savedAt: 2 }), false, mezcla, c.fusionarGemelos);
  assert.equal(enA.gemelos.length, 2, "unión en A");
  assert.ok(enA.gemelos.some((g) => g.avisoId === av.id), "el vínculo de A sigue");
  // Y al revés: A es más reciente que la nube de B → gana local, pero el de B también entra.
  const enA2 = adopta(Object.assign({}, A, { _savedAt: 3 }), Object.assign({}, B, { _savedAt: 2 }), false, mezcla, c.fusionarGemelos);
  assert.equal(enA2.gemelos.length, 2, "unión también cuando gana lo local");
  // Con la unión, el siguiente apunte igual del banco en A no vuelve a pedir ese aviso.
  const A2 = Object.assign(estado(), { expenses: A.expenses, deleted: A.deleted, gemelos: enA.gemelos });
  const b = sync(A2, [ob(-2, 29.9), ob(-1, 29.9)]);
  assert.equal(b.length, 1); assert.equal(!!b[0].possibleDup, false, "el aviso sigue reclamado");
  // Nada que unir: misma referencia, para no reescribir el estado por nada.
  assert.equal(c.fusionarGemelos(enA.gemelos, []), enA.gemelos);
  assert.equal(c.fusionarGemelos(enA.gemelos, enA.gemelos.slice()), enA.gemelos);
  assert.equal(a.length, 1);
});

/* ── 15. Pendiente + contabilizado en la misma respuesta: UN cargo ─────────────────────── */
t("el mismo cargo entregado como PDNG y BOOK a la vez entra una sola vez; dos BOOK iguales son dos", () => {
  const s = estado();
  const a = sync(s, [ob(-1, 5, { status: "PDNG" }), ob(-1, 5, { status: "BOOK" })]);
  assert.equal(a.length, 1, "pendiente + contabilizado = un cargo");
  assert.equal(a[0].obOrd, undefined);
  assert.equal(sync(s, [ob(-1, 5, { status: "BOOK" })]).length, 0, "cuando el banco solo trae el contabilizado, nada nuevo");
  const s2 = estado();
  assert.equal(sync(s2, [ob(-1, 5), ob(-1, 5)]).length, 2, "sin señal de estado mandan los k del banco");
  const s3 = estado();
  const b = sync(s3, [ob(-1, 5, { status: "PDNG" }), ob(-1, 5, { status: "PDNG" }), ob(-1, 5, { status: "BOOK" })]);
  assert.equal(b.length, 2, "dos pendientes y un firme: la pendiente que sobra es otro cargo");
  esperado(s3, { gasto: 10 }, "2 cargos");
});

/* ── 16. Conceptos entre iguales ───────────────────────────────────────────────────────── */
t("dos iguales con conceptos distintos: a la fila guardada sin nota no se le cuelga el concepto de otra", () => {
  const s = estado();
  sync(s, [ob(-2, 6)]);                                      // la de siempre, sin concepto
  assert.equal(s.expenses[0].note, undefined);
  const txs = flat([ob(-2, 6, { bank_transaction_code: { description: "cena" } }), ob(-2, 6, { bank_transaction_code: { description: "taxi" } })]);
  const out = c.enrichNotesFromBankTx(s.expenses, txs);
  assert.equal(out, s.expenses, "ambiguo: no se toca");
  const uno = c.enrichNotesFromBankTx(s.expenses, flat([ob(-2, 6, { bank_transaction_code: { description: "cena" } }), ob(-2, 6, { bank_transaction_code: { description: "cena" } })]));
  assert.equal(uno[0].note, "cena", "unánime: se rellena");
});

/* ── 17. El banco de un `source` con marcas, en cliente y servidor ─────────────────────── */
t("«ob-hist:…#n2» y los tramos «~deuda.» / «~recibo.» se leen con el banco limpio (cliente y servidor)", () => {
  assert.equal(SRV.bancoDeSource("ob-hist:trade_republic#n2"), "trade_republic", "servidor (antes: «trade_republic#n2»)");
  assert.equal(SRV.bancoDeSource("ob-hist:trade_republic#dup#n3"), "trade_republic");
  assert.equal(SRV.bancoDeSource("ob:sabadell~recibo.r1#n2"), "sabadell");
  assert.equal(SRV.bancoDeSource("ob:sabadell~deuda.d1#dup"), "sabadell");
  assert.equal(SRV.ordinalDeSource("ob:sabadell~recibo.r1#dup#n4"), 4);
  assert.equal(c.expenseBankOf({ source: "ob-hist:trade_republic#n2" }), "trade_republic", "cliente");
  assert.equal(c.expenseBankOf({ source: "ob:sabadell~recibo.r1#n2" }), "sabadell");
  const r = c.expenseFromRow({ id: "q", fecha: ymd(-1) + "T10:00:00.001Z", importe: 40, comercio: "Luz", cat: "luz", source: "ob:sabadell~recibo.r1#dup#n2" });
  assert.equal(r.ent, "sabadell"); assert.equal(r.obOrd, 2); assert.equal(r.possibleDup, true);
  const h = c.expenseFromRow({ id: "w", fecha: ymd(-1) + "T10:00:00.000Z", importe: 40, comercio: "Luz", cat: "luz", source: "ob-hist:sabadell~recibo.r1#n2" });
  assert.equal(h.ent, "sabadell"); assert.equal(h.obOrd, 2);
  same(Object.keys(c.partirEntDeuda("sabadell~recibo.r1")).sort(), ["debtId", "ent", "reciboId"]);
  assert.equal(c.partirEntDeuda("sabadell~recibo.r1").reciboId, "r1");
  assert.equal(c.partirEntDeuda("sabadell~recibo.r1~deuda.d1").debtId, "d1");
});

/* ── 19. Lo que las mutaciones de la revisión dejaron sin vigilar ──────────────────────── */
t("histórico: un aviso ya reclamado por el sync diario no vuelve como «puede que ya lo tengas» de otro cargo", () => {
  const s = estado();
  s.expenses.unshift(aviso(-3, 10, 29.9, "Decathlon"));
  resuelve(s, sync(s, [ob(-2, 29.9)])[0], true);             // el aviso queda reclamado (vínculo en gemelos)
  const h = histTR(s, [ob(0, 29.9)]);                        // otro cargo igual, a ±3 días del aviso, sin lápida
  assert.equal(h.rows[0].status, "new", "el aviso ya tiene dueño: no es «cercano» de nadie más");
});
t("«es el mismo» sobre una fila bajada de otro móvil (sin gemelo localizable) deja rastro «sin aviso», y el importador no se lo come como lápida vieja", () => {
  const s = estado();
  const av = aviso(-2, 19, 7, "Bar");
  s.expenses.unshift(av);
  const x = sync(s, [ob(-2, 7)])[0];
  assert.equal(x.possibleDupOf, av.id);
  // La fila viene de la nube: su gemelo apunta a un id que este móvil no tiene.
  s.expenses = s.expenses.map((e) => e.id === x.id ? Object.assign({}, e, { possibleDupOf: "de-otro-movil" }) : e);
  s.gemelos = [];
  resuelve(s, s.expenses.find((e) => e.id === x.id), true);
  assert.deepEqual(s.gemelos.map((g) => g.aviso + "/" + (g.banco === c.keyOfExpense(x))), ["/true"], "rastro {aviso:'', banco}");
  // Llegan dos iguales: la ranura 1 tiene lápida CON rastro, así que el aviso sigue libre para la 2.
  const b = sync(s, [ob(-2, 7), ob(-2, 7)]);
  assert.equal(b.length, 1); assert.equal(b[0].obOrd, 2);
  assert.equal(b[0].possibleDupOf, av.id, "sin rastro, la lápida pasaría por un «es el mismo» antiguo y se saltaría el aviso");
});
t("borrar a mano un apunte del banco (el bloque REAL de Gastos) deja rastro «sin aviso»", () => {
  const gastosSrc = H.read("src/modules/04-tab-gastos.js");
  const m = gastosSrc.match(/const next=Object\.assign\(\{\},s,\{\s*expenses:\(s\.expenses\|\|\[\]\)\.filter\(function\(x\)\{ return x\.id!==e\.id; \}\),\s*deleted:pushDeleted\(s\.deleted,key\)\s*\}\);[\s\S]*?return next;/);
  assert.ok(m, "no se encuentra el bloque de borrar en 04-tab-gastos");
  const borra = new Function("s", "e", "key", "pushDeleted", "pushGemelos", m[0]);
  const s = estado();
  const x = sync(s, [ob(-2, 7)])[0];
  const next = borra(s, x, c.keyOfExpense(x), c.pushDeleted, c.pushGemelos);
  assert.equal(next.expenses.length, 0);
  same(next.deleted, [c.keyOfExpense(x)]);
  assert.equal(JSON.stringify(next.gemelos), JSON.stringify([{ aviso: "", banco: c.keyOfExpense(x) }]));
  const manual = Object.assign({}, x, { source: "manual", ent: undefined });
  assert.equal(borra(s, manual, c.keyOfExpense(manual), c.pushDeleted, c.pushGemelos).gemelos, s.gemelos, "un apunte a mano no deja rastro");
});
t("runBankSync (el bloque REAL de App) guarda los vínculos de la importación en el estado", () => {
  const m = mainSrc.match(/const vinculos=gemelosDeImportacion\(add, invState\.expenses\);\s*if\(vinculos\.length\)\{[\s\S]*?\n\s*\}/);
  assert.ok(m, "no se encuentra el bloque de vínculos en runBankSync");
  const guarda = new Function("add", "invState", "gemelosDeImportacion", "pushGemelos", m[0] + "\nreturn invState;");
  const s = estado();
  const av = aviso(-2, 10, 29.9, "Decathlon"); s.expenses.unshift(av);
  const add = c.importObExpenses(s, flat([ob(-2, 29.9)]), LINKS) || [];
  assert.equal(add[0].possibleDupOf, av.id);
  const out = guarda(add, s, c.gemelosDeImportacion, c.pushGemelos);
  assert.equal(out.gemelos.length, 1); assert.equal(out.gemelos[0].avisoId, av.id);
  assert.equal(guarda([], s, c.gemelosDeImportacion, c.pushGemelos), s, "sin vínculos, el mismo estado");
});
t("el tope de `gemelos` suelta los más antiguos, no los recientes; un ordinal de dos cifras se lee", () => {
  let g = [];
  for (let i = 0; i < 501; i++) g = c.pushGemelos(g, [{ avisoId: "a" + i, aviso: "k" + i, banco: "b" + i }]);
  assert.equal(g.length, 500);
  assert.equal(g[0].avisoId, "a1", "el más antiguo se fue"); assert.equal(g[499].avisoId, "a500", "el último se queda");
  const e = c.expenseFromRow({ id: "x", fecha: ymd(-1) + "T10:00:00.011Z", importe: 1, comercio: "Movimiento", cat: "otros", source: "ob:trade_republic#n12" });
  assert.equal(e.obOrd, 12); assert.equal(c.expenseSourceForCloud(e), "ob:trade_republic#n12");
  assert.equal(SRV.ordinalDeSource("ob-hist:trade_republic#n12"), 12, "servidor: también en el histórico");
  assert.equal(SRV.filasComoLaApp([{ fecha: ymd(-1) + "T10:00:00Z", importe: 5, comercio: "M", source: "ob-hist:trade_republic" }, { fecha: ymd(-1) + "T10:00:00.001Z", importe: 5, comercio: "M", source: "ob-hist:trade_republic#n2" }], []).length, 2);
});
t("un pendiente local con `possibleDupOf` (sin vínculo en gemelos todavía) ya tiene reclamado su aviso", () => {
  const s = estado();
  const av = aviso(-2, 10, 29.9, "Decathlon"); s.expenses.unshift(av);
  const x = sync(s, [ob(-2, 29.9)])[0];
  s.gemelos = [];                                            // el registro se perdió (estado viejo de otro móvil)
  assert.equal(x.possibleDupOf, av.id);
  const b = sync(s, [ob(-2, 29.9), ob(-1, 29.9)]);
  assert.equal(b.length, 1); assert.equal(!!b[0].possibleDup, false, "el enlace local manda aunque el registro no esté");
});

/* ── 18. Reparto a metas del segundo ingreso igual del día ─────────────────────────────── */
t("dos ingresos iguales el mismo día: el segundo (ordinal 2) también dispara su reparto a metas", () => {
  const s = estado();
  s.goals = [{ id: "g1", name: "Viaje", target: 1000, saved: 0 }];
  s.settings.reservaRules = [{ id: "r1", name: "Viaje", kind: "fixed", value: 50, goalId: "g1" }];
  const add = sync(s, [ob(-1, -300), ob(-1, -300)]);
  assert.equal(add.length, 2);
  const primero = add.find((e) => !e.obOrd), segundo = add.find((e) => e.obOrd === 2);
  let st = c.applyReserva(s, primero, c.reservaPlanFor(s, primero.amount).plan, "trade_republic");
  assert.equal(st.goals[0].saved, 50);
  assert.equal(c.reservaAlreadyApplied(st, segundo), false, "el segundo cobro no está repartido (antes: misma clave)");
  st = c.applyReserva(st, segundo, c.reservaPlanFor(st, segundo.amount).plan, "trade_republic");
  assert.equal(st.goals[0].saved, 100);
  assert.equal(c.reservaAlreadyApplied(st, segundo), true);
});
