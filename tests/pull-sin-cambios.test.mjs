/* VOLVER A PRIMER PLANO CON LA NUBE IGUAL NO REHACE NADA (diagnóstico de lag, 19/10/2026).
 *
 * Cada vuelta a primer plano baja el histórico entero (`syncCloudExpenses`). Con 3.500 gastos eso
 * congelaba la pantalla 400 ms a CPU×6: se volvía a adivinar la categoría de todas las filas, se
 * convertía cada fila en un gasto NUEVO y el estado se rehacía entero aunque nada hubiera cambiado.
 *
 * Lo que se fija aquí, contra el bloque REAL de 11-app-main.js:
 *   · un segundo pull idéntico no barre ni una palabra clave, no convierte ni una fila, no llama a
 *     `set()` con un estado nuevo y el array de gastos conserva la referencia;
 *   · una fila cambiada (importe, categoría, borrada a mano) SÍ se refleja, y las demás siguen
 *     siendo los mismos objetos;
 *   · lo aprendido a mano (USER_OVERRIDES) cambia la categoría aunque la fila no cambie;
 *   · un gasto tocado en sitio después de la lectura no se reutiliza;
 *   · el resultado es el MISMO, en JSON, que el de la versión sin atajos (filas siempre por
 *     `expenseFromRow`, estado siempre nuevo), en varios estados. Solo difieren las dos marcas de
 *     reloj (`lastSync`, `_savedAt`), que en la versión anterior tampoco eran deterministas.
 * Todo con datos ficticios. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createLogicSandbox } from "../scripts/load-pure-logic.mjs";

const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const order = JSON.parse(read("src/build-order.json"));
const logic = order.slice(0, order.indexOf("10-app-components.js")).map((f) => read("src/modules/" + f)).join("\n");
const main = read("src/modules/11-app-main.js");
const a = main.indexOf("  const syncCloudExpenses=function(){"), z = main.indexOf("\n  // Al iniciar sesión:", a);
assert.ok(a >= 0 && z > a, "no se encontró syncCloudExpenses");
const real = main.slice(a, z);

/* La versión sin atajos, sacada del MISMO texto: si alguien cambia la mezcla, la referencia cambia
   con ella y la comparación sigue midiendo solo los atajos. Cada sustitución tiene que aplicarse. */
function sinAtajos(src) {
  const swaps = [
    ["expensesFromRows(rows)", "rows.map(expenseFromRow)"],
    ["if(mismo) return prev;", "if(false) return prev;"],
    ["if(pending===prev.obAbsorbedPending&&", "if(false&&pending===prev.obAbsorbedPending&&"],
  ];
  for (const [x, y] of swaps) { assert.equal(src.split(x).length, 2, "atajo no encontrado: " + x); src = src.replace(x, y); }
  return src;
}
const referencia = sinAtajos(real);

const OWNER = "synthetic-owner";
const uuid = (n) => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
function memoria() { const d = new Map(); return { getItem: (k) => d.has(k) ? d.get(k) : null, setItem: (k, v) => d.set(k, String(v)), removeItem: (k) => d.delete(k) }; }

// Reloj fijo en los dos lados: `catAckAt`, `readStartedAt`… salen de Date.now() y no deben
// distinguir una versión de la otra por un milisegundo de diferencia entre lecturas.
const AHORA = Date.parse("2026-10-19T09:00:00.000Z");
class RelojFijo extends Date { constructor(...a) { super(...(a.length ? a : [AHORA])); } static now() { return AHORA; } }
function entorno(src) {
  const storage = memoria();
  const sandbox = createLogicSandbox({ localStorage: storage, Date: RelojFijo });
  sandbox.window.localStorage = storage;
  const c = vm.createContext(sandbox);
  vm.runInContext(logic, c);
  const env = { c, rows: [], calls: { kw: 0, row: 0, sets: 0, nuevos: 0, nube: [] } };
  vm.runInContext("USER_OVERRIDES={};USER_CAT_RULES={};", c);
  const cloud = vm.runInContext("cloud", c);
  cloud.pullExpenses = (proof) => { if (proof) { proof.valid = true; proof.userId = OWNER; } return Promise.resolve(env.rows.map((r) => ({ ...r }))); };
  cloud.pullState = () => Promise.resolve(null);
  for (const m of ["setExpenseCat", "setExpenseRecibo", "setExpenseDup"]) cloud[m] = (e, x) => { env.calls.nube.push([m, e && e.id, x]); return Promise.resolve(1); };
  c.subirGasto = (e, donde) => { env.calls.nube.push(["subir", e.id, donde]); };
  const kw = c.autoCategoryKw, row = c.expenseFromRow;
  c.autoCategoryKw = function () { env.calls.kw++; return kw.apply(this, arguments); };
  c.expenseFromRow = function () { env.calls.row++; return row.apply(this, arguments); };
  // El `set` de App (11-app-main.js): mismo atajo y mismo sello. Se cuenta cuándo hay estado nuevo.
  const factory = vm.runInContext("(function(api){const stateRef=api.stateRef,sessionRef={current:{user:{id:'" + OWNER + "'}}};" +
    "const wR={current:false},wS={current:0},wP={current:null},wC={current:[]},wRead={current:null};const retryObAbsorbedCloud=function(){return Promise.resolve();};" +
    "const set=function(u){const prev=stateRef.current;let next=typeof u==='function'?u(prev):u;if(next===prev)return;" +
    "if(next.expenses!==prev.expenses||next.gemelos!==prev.gemelos||next.deleted!==prev.deleted)next=reconcileGemelosAutomaticos(next,prev);" +
    "api.sets++;stateRef.current=Object.assign({},next,{_savedAt:Date.now()});};" + src + "return syncCloudExpenses;})", c);
  env.stateRef = { current: null };
  const api = { stateRef: env.stateRef, sets: 0 };
  const run = factory(api);
  env.pull = async () => {
    api.sets = 0; env.calls.kw = 0; env.calls.row = 0; env.calls.nube = [];
    const r = await run();
    await new Promise((res) => setTimeout(res, 5));   // los setTimeout(…,0) de la nube
    env.calls.sets = api.sets; env.calls.nuevos = r.nuevos;
    return r;
  };
  return env;
}

const sinReloj = (s) => JSON.stringify(s, (k, v) => (k === "lastSync" || k === "_savedAt" ? undefined : v));
function estado(extra) {
  return Object.assign({ _historyOwner: OWNER, expenses: [], gemelos: [], deleted: [], deletedAt: {}, fixed: [], debts: [], goals: [], accounts: [],
    settings: {}, obAbsorbedPending: [], obAbsorbedConfirmed: [], lastSync: 1 }, extra || {});
}
// Variedad de filas: todo lo que distingue `expenseFromRow`.
function filas() {
  return [
    { id: uuid(1), user_id: OWNER, fecha: "2026-10-01T10:00:00.000Z", importe: 12.5, comercio: "Mercadona", cat: "otros", source: "manual:sabadell", no_card: false, nota: null, nota_edit: false },
    { id: uuid(2), fecha: "2026-10-02T10:00:00.000Z", importe: 30, comercio: "Bar Pepe", cat: "", source: "ob:caixabank#ref" + encodeURIComponent("tx-2") + "#accacc-1" },
    { id: uuid(3), fecha: "2026-10-02T10:00:00.001Z", importe: 30, comercio: "Bar Pepe", cat: null, source: "ob:caixabank#n2#reftx-3" },
    { id: uuid(4), fecha: "2026-10-03T10:00:00.000Z", importe: 7.99, comercio: "Netflix", cat: "suscripciones", source: "ob:sabadell~recibo.r1#reftx-4" },
    { id: uuid(5), fecha: "2026-10-04T10:00:00.000Z", importe: 180, comercio: "Préstamo coche", cat: "deudas", source: "ob:sabadell~deuda.d1#reftx-5" },
    { id: uuid(6), fecha: "2026-10-05T10:00:00.000Z", importe: 4.2, comercio: "Café Sintético", cat: "otros", source: "macrodroid", ingest_event_id: "ev-6" },
    { id: uuid(7), fecha: "2026-10-05T11:00:00.000Z", importe: 4.2, comercio: "Café Sintético", cat: "otros", source: "ob:revolut#dup#reftx-7", ingest_event_id: "ev-7" },
    { id: uuid(8), fecha: "2026-10-06T10:00:00.000Z", importe: -2200, comercio: "Nómina", cat: "ingreso", source: "ob-hist:sabadell#reftx-8", no_card: true },
    { id: uuid(9), fecha: "2026-10-07T10:00:00.000Z", importe: 50, comercio: "Amazon US", cat: "compras", source: "manual", importe_orig: 55.1, divisa: "USD", nota: "Libro", nota_edit: true, ob_name: "AMZN Mktp" },
    { id: uuid(10), fecha: "2026-10-08T10:00:00.000Z", importe: 0, comercio: "Cero", cat: "otros", source: "ob:caixabank#reftx-10" },
    { id: uuid(11), fecha: "2026-10-09T10:00:00.000Z", importe: 61.3, comercio: "Gasolinera Repsol", cat: "otros", source: "ob:sabadell#pdng#reftx-11" },
    { id: uuid(12), fecha: "2026-10-09T12:00:00.000Z", importe: 15, comercio: "Bizum a Ana", cat: "traspaso", source: "supabase", no_card: true },
  ];
}
async function dosIguales(make) {
  const nuevo = entorno(real), viejo = entorno(sinAtajos(real));
  const s = make();
  nuevo.stateRef.current = structuredClone(s); viejo.stateRef.current = structuredClone(s);
  return { nuevo, viejo };
}
async function mismoPaso(par, rows, antes) {
  for (const e of [par.nuevo, par.viejo]) { e.rows = structuredClone(rows); if (antes) antes(e); }
  const rn = await par.nuevo.pull(), rv = await par.viejo.pull();
  assert.equal(JSON.stringify(rn), JSON.stringify(rv), "mismo {total, nuevos}");
  assert.equal(sinReloj(par.nuevo.stateRef.current), sinReloj(par.viejo.stateRef.current), "mismo estado, byte a byte");
  assert.equal(JSON.stringify(par.nuevo.calls.nube), JSON.stringify(par.viejo.calls.nube), "mismas escrituras a la nube");
}

test("segundo pull idéntico: 0 barridos de palabras clave, 0 filas convertidas, sin estado nuevo", async () => {
  const e = entorno(real);
  e.stateRef.current = estado();
  e.rows = filas();
  await e.pull();
  assert.ok(e.calls.kw > 0 && e.calls.row === e.rows.length, "la primera lectura sí convierte");
  assert.equal(e.calls.sets, 1);
  const s1 = e.stateRef.current, lista = s1.expenses;
  for (let i = 0; i < 3; i++) {
    await e.pull();
    assert.equal(e.calls.kw, 0, "ningún barrido de palabras clave");
    assert.equal(e.calls.row, 0, "ninguna fila pasa otra vez por expenseFromRow");
    assert.equal(e.calls.sets, 0, "ningún set() con estado nuevo");
    assert.equal(e.stateRef.current, s1, "el estado es el mismo objeto");
    assert.equal(e.stateRef.current.expenses, lista, "el array de gastos conserva la referencia");
  }
});

test("una fila cambiada se refleja y las demás siguen siendo los mismos objetos", async () => {
  const e = entorno(real);
  e.stateRef.current = estado();
  e.rows = filas();
  await e.pull(); await e.pull();
  const antes = e.stateRef.current.expenses;
  const porId = (l, id) => l.find((x) => x.id === id);
  // Importe (fila de banco: misma referencia del banco, así que es el MISMO gasto con otro importe)
  e.rows[1] = { ...e.rows[1], importe: 31.75 };
  await e.pull();
  let l = e.stateRef.current.expenses;
  assert.equal(e.calls.row, 1, "solo se convierte la fila que cambió");
  assert.equal(porId(l, uuid(2)).amount, 31.75);
  assert.notEqual(l, antes);
  for (const x of antes) if (x.id !== uuid(2)) assert.equal(porId(l, x.id), x, "intacta: " + x.id);
  // Categoría (fila de banco: la nube manda)
  const prev2 = l;
  e.rows[3] = { ...e.rows[3], cat: "ocio" };
  await e.pull();
  l = e.stateRef.current.expenses;
  assert.equal(e.calls.row, 1);
  assert.equal(porId(l, uuid(4)).category, "ocio");
  for (const x of prev2) if (x.id !== uuid(4)) assert.equal(porId(l, x.id), x, "intacta: " + x.id);
  // Borrado a mano (lápida): sale de la lista que baja y no se resube.
  const victima = porId(l, uuid(9));
  const conLapida = vm.runInContext("(function(s,e){return Object.assign({},s,lapidaPon(s,keyOfExpense(e),Date.now()),{expenses:s.expenses.filter(function(x){return x!==e;})});})", e.c)(e.stateRef.current, victima);
  e.stateRef.current = conLapida;
  await e.pull();
  assert.equal(porId(e.stateRef.current.expenses, uuid(9)), undefined, "el borrado no vuelve");
  assert.equal(e.calls.nube.filter((x) => x[0] === "subir").length, 0, "ni se resube");
});

test("lo aprendido a mano cambia la categoría aunque la fila sea la misma", async () => {
  const e = entorno(real);
  e.stateRef.current = estado();
  e.rows = filas();
  await e.pull(); await e.pull();
  const viejo = e.stateRef.current.expenses.find((x) => x.id === uuid(11));
  vm.runInContext("USER_OVERRIDES['gasolinera repsol']='ocio';", e.c);
  await e.pull();
  const nuevo = e.stateRef.current.expenses.find((x) => x.id === uuid(11));
  assert.equal(nuevo.category, "ocio");
  assert.notEqual(nuevo, viejo);
  assert.equal(e.calls.row, 1, "solo esa fila se reconstruye");
});

test("un gasto tocado en sitio tras la lectura no se reutiliza", async () => {
  const e = entorno(real);
  e.stateRef.current = estado();
  e.rows = filas();
  await e.pull();
  const tocado = e.stateRef.current.expenses.find((x) => x.id === uuid(4));
  tocado.merchant = "Mutado en sitio";   // nadie debería hacerlo; si pasa, la memoria no lo propaga
  const memo = vm.runInContext("_expRowMemo", e.c);
  const out = vm.runInContext("expensesFromRows", e.c)(e.rows.map((r) => ({ ...r })));
  assert.equal(out.find((x) => x.id === uuid(4)).merchant, "Netflix");
  assert.notEqual(out.find((x) => x.id === uuid(4)), tocado);
  assert.ok(memo.size > 0);
});

test("EXPENSE_ROW_COLS son exactamente las columnas que lee expenseFromRow", () => {
  const core = read("src/modules/00-core.js");
  const i = core.indexOf("function expenseFromRow(r){"), j = core.indexOf("\n}\n", i);
  const leidas = [...new Set(core.slice(i, j).match(/\br\.([a-z_]+)/g).map((x) => x.slice(2)))].sort();
  const e = entorno(real);
  assert.deepEqual([...vm.runInContext("EXPENSE_ROW_COLS", e.c)].sort(), leidas);
});

test("byte a byte igual que sin atajos: primera lectura, repetida, cambios, overrides y reglas", async () => {
  const p = await dosIguales(() => estado());
  const base = filas();
  await mismoPaso(p, base);
  await mismoPaso(p, base);
  const r2 = structuredClone(base); r2[0].importe = 99; r2[3].cat = "ocio"; r2.splice(5, 1);
  await mismoPaso(p, r2);
  await mismoPaso(p, r2, (e) => vm.runInContext("USER_OVERRIDES['bar pepe']='super';USER_OVERRIDES['mercadona']='inversion';", e.c));
  const r3 = structuredClone(r2); r3.push({ id: uuid(20), fecha: "2026-10-12T10:00:00.000Z", importe: 3, comercio: "Bar Pepe", cat: "otros", source: "ob:caixabank#reftx-20" });
  await mismoPaso(p, r3);
  await mismoPaso(p, r3, (e) => vm.runInContext("USER_CAT_RULES['bar pepe|caixabank|1']={cat:'ocio',at:Date.parse('2026-10-11T00:00:00Z')};", e.c));
  await mismoPaso(p, r3);
});

test("byte a byte igual que sin atajos partiendo de una cartera local con categoría elegida a mano", async () => {
  const p = await dosIguales(() => estado());
  const base = filas();
  await mismoPaso(p, base);
  // Él corrige a mano la categoría de una fila de banco (sin confirmar en la nube) en los dos.
  for (const e of [p.nuevo, p.viejo]) {
    const s = e.stateRef.current;
    e.stateRef.current = Object.assign({}, s, { expenses: s.expenses.map((x) => x.id === uuid(2) ? Object.assign({}, x, { category: "ocio", catStale: [x.category] }) : x) });
  }
  await mismoPaso(p, base);
  await mismoPaso(p, base);
  const r2 = structuredClone(base); r2[1].cat = "ocio";
  await mismoPaso(p, r2);
  await mismoPaso(p, r2);
});
