/* LA SERIE DE PATRIMONIO Y EL PRESUPUESTO DE INICIO SOLO SE RECALCULAN CUANDO CAMBIA LO QUE LEEN
 * (tirones de «Tus cuentas», beta 4.26.150, 20/10/2026).
 *
 * Tocar cualquier cosa en Ajustes hacía que Inicio, montado detrás, recorriera otra vez todo el
 * histórico (dependía de `state.settings` entero), y el cierre de hoy que guarda «Tus cuentas»
 * provocaba un segundo recálculo seguido tras cada gasto nuevo. Este guardián fija:
 *   · P1: los ajustes que leen `netWorthSeries` y `dashboardBudgetStats`, ellas y TODO lo que
 *     llaman, están en `NET_WORTH_SETTINGS` / `BUDGET_SETTINGS`. Se comprueba de dos formas: leyendo
 *     el código del cierre de llamadas y ejecutándolas con los ajustes espiados. Y cada campo
 *     declarado, mutado, obliga a recalcular; uno que no leen (el contraste) no.
 *   · P2: `netWorthHistoryKey` es exacta: dos históricos con la misma clave dan la misma serie,
 *     byte a byte (también `coverage` y `fresh`), en un barrido de casos alrededor de hoy.
 *   · P3: las cuatro pestañas no dependen de `drawerOpen` (ninguna lo lee).
 *   · P4: la cifra animada de Cartera vive en su componente, no en CarteraTab.
 * Todo con datos ficticios. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";
import { logicFunctions, logicCalls } from "../scripts/beta-source-code.mjs";

const read = (f) => fs.readFileSync(new URL("../" + f, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const modules = JSON.parse(read("src/build-order.json")).map((f) => "src/modules/" + f);
const c = loadPureLogicFromFile();
const NET = [...vm.runInContext("NET_WORTH_SETTINGS", c)], BUD = [...vm.runInContext("BUDGET_SETTINGS", c)];
const plain = (x) => JSON.stringify(x, (k, v) => v, 0) + "|" + JSON.stringify({ coverage: x && x.coverage, fresh: x && x.fresh });

const today = "2026-09-04";
const account = (id, ent, role = "fijos") => ({ id, ent, value: 300, role, bankIban: "synthetic-" + id });
const entry = (id, date, amount, ent = "sabadell", category = "super", extra = {}) => ({ id, date: date + "T12:00:00Z", amount, ent, category, ...extra });
const SETTINGS = {
  accountListOrder: ["acc:b", "acc:a"], accountShare: { "iban:SYNTHETIC-B": 50 },
  accountShareLegacy: { revolut: { key: "iban:SYNTHETIC-B", day: "2026-09-02" } }, expenseBanks: ["revolut"],
  profile: { fullName: "Ana Pérez Gómez" }, budgetCycle: true, gTotalMode: "split", hiContrast: true, lang: "es", fontScale: 1.1,
};
function estado(extra) {
  return Object.assign({
    accounts: [account("a", "sabadell", "diario"), account("b", "revolut"), { id: "cash", ent: "efectivo", value: 50, role: "fijos" }],
    investments: [{ id: "i", ent: "myinvestor", value: 100 }], aportaciones: [{ ent: "myinvestor", amount: 500 }], assets: [], debts: [],
    expenses: [entry("e1", "2026-08-01", 10), entry("e2", "2026-09-02", 500, "sabadell", "traspaso", { merchant: "Transferencia Ana Pérez" }),
      entry("e3", "2026-09-03", -2000, "sabadell", "ingreso", { merchant: "Nómina" }), entry("e4", "2026-09-02", 20, "revolut"),
      entry("e5", "2026-08-31", -1800, "sabadell", "ingreso", { merchant: "Nómina agosto" })],
    accountBalanceHistory: { "acc:cash": [{ day: "2026-09-01", value: 40 }, { day: today, value: 50 }] },
    invHistory: [{ d: "2026-09-01", v: 90 }], flows: [], fixed: [], deleted: [], budget: 1000, settings: SETTINGS,
  }, extra || {});
}
const OPTS = { today, liquid: 650, invested: 100, debtTotal: 0 };
const serie = (s, opts = OPTS) => c.netWorthSeries(s, opts);
const fresca = (s, opts = OPTS) => { c.netWorthSeries.cache = []; return c.netWorthSeries(s, opts); };

/* ── P1, por el código: todo lo que el cierre de llamadas lee de `settings` ─────────────────── */
function cierre(raiz) {
  const fns = logicFunctions(read, modules), seen = new Set(), q = [raiz];
  while (q.length) { const n = q.shift(); if (seen.has(n) || !fns.has(n)) continue; seen.add(n); for (const x of logicCalls(fns.get(n).text, fns)) q.push(x); }
  return [...seen].map((n) => fns.get(n));
}
function camposLeidos(raiz) {
  const campos = new Set(), sueltos = [];
  // `settingsDeps` es la que reparte los campos declarados: leer `settings` entero es su trabajo.
  for (const fn of cierre(raiz).filter((f) => f.name !== "settingsDeps")) {
    const texto = fn.text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    const re = /\bsettings\b/g; let m;
    while ((m = re.exec(texto))) {
      const resto = texto.slice(m.index + 8);
      const acceso = /^\s*(?:\|\|\s*\{\}\s*)?\)?\s*\.\s*([A-Za-z_$][\w$]*)/.exec(resto) || /^\s*&&\s*[\w$.]+\.settings\s*\.\s*([A-Za-z_$][\w$]*)/.exec(resto);
      if (acceso) { campos.add(acceso[1]); continue; }
      // La única lectura entera permitida es la que reparte los campos declarados.
      if (/^\s*,\s*(?:NET_WORTH_SETTINGS|BUDGET_SETTINGS)\s*\)/.test(resto) && /settingsDeps\(\s*[\w$.]*$/.test(texto.slice(0, m.index))) continue;
      sueltos.push(fn.name + ": …" + texto.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\s+/g, " ") + "…");
    }
  }
  return { campos: [...campos].sort(), sueltos };
}
test("P1 · por el código: la serie y el presupuesto solo leen ajustes declarados, y los leen campo a campo", () => {
  for (const [raiz, declarados] of [["netWorthSeries", NET], ["dashboardBudgetStats", BUD]]) {
    const { campos, sueltos } = camposLeidos(raiz);
    assert.deepEqual(sueltos, [], raiz + ": lectura de `settings` entero (no se puede vigilar campo a campo)");
    assert.ok(campos.length > 0, raiz + ": el lector no encontró ninguna lectura (¿cambió la forma del código?)");
    for (const k of campos) assert.ok(declarados.includes(k), raiz + " lee settings." + k + " y no está declarado");
  }
});

/* ── P1, ejecutando: con los ajustes espiados ─────────────────────────────────────────────────── */
function espia(obj, leidos) { return new Proxy(obj, { get(t, k) { if (typeof k === "string") leidos.add(k); return t[k]; } }); }
test("P1 · ejecutando: lo que leen de verdad está declarado", () => {
  const variantes = [SETTINGS, { ...SETTINGS, budgetCycle: false }, { ...SETTINGS, accountShare: {}, accountShareLegacy: {} }, {}];
  for (const v of variantes) {
    for (const opts of [OPTS, { today }]) {
      const leidos = new Set();
      fresca(estado({ settings: espia({ ...v }, leidos) }), opts);
      for (const k of leidos) assert.ok(NET.includes(k), "netWorthSeries leyó settings." + k);
    }
    const leidos = new Set();
    c.dashboardBudgetStats(estado({ settings: espia({ ...v }, leidos) }));
    for (const k of leidos) assert.ok(BUD.includes(k), "dashboardBudgetStats leyó settings." + k);
  }
});

test("P1 · cada ajuste declarado, mutado, obliga a recalcular; uno ajeno no", () => {
  // Mismas porciones del estado y solo los ajustes cambiados: es lo que hace un toque en Ajustes.
  const s0 = estado(), con = (settings) => Object.assign({}, s0, { settings });
  const s1 = fresca(s0);
  assert.equal(serie(con({ ...SETTINGS })), s1, "ajustes con el mismo contenido: la caché acierta");
  // Ajenos: contraste, idioma, tamaño de letra. Antes cualquiera de estos recalculaba.
  for (const k of ["hiContrast", "lang", "fontScale", "simpleMode"]) {
    assert.equal(serie(con({ ...SETTINGS, [k]: "otro" })), s1, "settings." + k + " no debe recalcular la serie");
  }
  for (const k of NET) {
    const mutado = { ...SETTINGS, [k]: Array.isArray(SETTINGS[k]) ? SETTINGS[k].slice().reverse() : SETTINGS[k] && typeof SETTINGS[k] === "object" ? { ...SETTINGS[k] } : "otro" };
    assert.notEqual(serie(con(mutado)), s1, "settings." + k + " mutado tiene que recalcular la serie");
    fresca(s0);
  }
  // El presupuesto: cada campo declarado mueve sus dependencias; uno ajeno no.
  const deps = (s) => vm.runInContext("settingsDeps", c)(s, BUD);
  for (const k of BUD) assert.notDeepEqual(deps({ ...SETTINGS, [k]: "otro" }), deps(SETTINGS), "settings." + k);
  assert.deepEqual(deps({ ...SETTINGS, hiContrast: false }), deps(SETTINGS));
});

test("P1 · Inicio usa las dependencias estrechas (y no `state.settings` entero)", () => {
  const dash = read("src/modules/03-tab-dash.js");
  const bud = /const bud=useMemo\([\s\S]*?\n\s*\[([^\n]*)\);/.exec(dash), ser = /const series=useMemo\([\s\S]*?\n\s*\[([^\n]*)\);/.exec(dash);
  assert.ok(bud && ser, "no se encuentran los memos de Inicio");
  assert.match(bud[1], /settingsDeps\(state\.settings,BUDGET_SETTINGS\)/);
  assert.match(ser[1], /settingsDeps\(state\.settings,NET_WORTH_SETTINGS\)/);
  assert.match(ser[1], /netWorthHistoryKey\(state\.accountBalanceHistory,seriesToday\)/);
  for (const d of [bud[1], ser[1]]) {
    assert.doesNotMatch(d, /(?<!settingsDeps\()state\.settings\s*[,\]]/);
    assert.doesNotMatch(d, /(?<!netWorthHistoryKey\()state\.accountBalanceHistory\s*[,\]]/);
  }
});

/* ── P2: la clave del histórico es exacta ─────────────────────────────────────────────────────── */
test("P2 · el cierre de hoy de una cuenta con cierres anteriores no recalcula, y la serie es la misma", () => {
  const h = (v) => ({ "acc:cash": [{ day: "2026-09-01", value: 40 }, { day: today, value: v }] });
  const a = estado({ accountBalanceHistory: h(50) }), b = Object.assign({}, a, { accountBalanceHistory: h(77.31) });
  const sa = fresca(a);
  assert.equal(serie(b), sa, "solo cambia el cierre de hoy: la caché acierta");
  assert.equal(plain(fresca(b)), plain(sa), "y recalculada desde cero sale idéntica");
  // Primer cierre de la cuenta: su valor marca el «antes», así que sí cuenta.
  const solo = (v) => estado({ accountBalanceHistory: { "acc:cash": [{ day: today, value: v }] } });
  const k = vm.runInContext("netWorthHistoryKey", c);
  assert.notEqual(k(solo(50).accountBalanceHistory, today), k(solo(51).accountBalanceHistory, today));
});

test("P2 · barrido: misma clave ⇒ misma serie, byte a byte", () => {
  const k = vm.runInContext("netWorthHistoryKey", c);
  const dias = ["2026-08-30", "2026-09-01", "2026-09-03", today, "2026-09-05", "no-es-dia"];
  let seed = 11; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff), pick = (a) => a[Math.floor(rnd() * a.length)];
  const lista = () => Array.from({ length: Math.floor(rnd() * 4) }, () => ({ day: pick(dias), value: pick([10, 20.5, 50, NaN, "x", 0]) }));
  const casos = Array.from({ length: 160 }, () => ({ "acc:cash": lista(), "acc:a": rnd() < 0.3 ? lista() : undefined, otra: rnd() < 0.2 ? lista() : undefined }))
    .map((h) => JSON.parse(JSON.stringify(h)));
  // Dos carteras: una con gastos y otra recién empezada (sin gastos ni fotos), que es donde el
  // histórico decide además `fresh`.
  for (const extra of [{}, { expenses: [], invHistory: [] }]) {
    const porClave = new Map(); let iguales = 0;
    for (const h of casos) {
      const key = k(h, today), s = plain(fresca(estado(Object.assign({ accountBalanceHistory: h }, extra))));
      if (porClave.has(key)) { iguales++; assert.equal(s, porClave.get(key), "misma clave y distinta serie: " + JSON.stringify(h)); }
      else porClave.set(key, s);
    }
    assert.ok(iguales > 10, "el barrido tiene que probar claves repetidas de verdad (" + iguales + ")");
  }
});

/* ── P3 y P4 ──────────────────────────────────────────────────────────────────────────────────── */
test("P3 · las pestañas no dependen de `drawerOpen`, y ninguna lo lee", () => {
  const main = read("src/modules/11-app-main.js");
  const a = main.indexOf("  const pageFor=function(id){"), z = main.indexOf("\n  };", a);
  assert.ok(a > 0 && z > a);
  assert.doesNotMatch(main.slice(a, z), /drawerOpen/, "pageFor lee drawerOpen: entonces sí tiene que ser dependencia");
  for (const nombre of ["contenidos", "contenidoGastos"]) {
    const m = new RegExp("const " + nombre + "=useMemo\\([\\s\\S]*?\\n  \\},\\[([^\\n]*)\\]\\);").exec(main);
    assert.ok(m, nombre);
    assert.doesNotMatch(m[1], /drawerOpen/, nombre + " depende de drawerOpen");
  }
});
test("P4 · la cifra animada de Cartera se repinta sola", () => {
  const v4 = read("src/modules/14-v4-screens.js");
  const a = v4.indexOf("function CarteraTab("), z = v4.indexOf("\nfunction ", a + 10);
  assert.doesNotMatch(v4.slice(a, z), /useCountUp\(/, "CarteraTab no debe animar la cifra él mismo");
  assert.match(v4, /function CarteraHeroAmt\(\{target\}\)\{[\s\S]*?useCountUp\(target, carteraOn\)/);
});
