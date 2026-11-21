// Lectura sola del banco al entrar, con tope (orden del dueño, 16/11/2026).
// Se ejecuta la lógica REAL de 08-motor-bank (`bankAuto*`) y el `cloud.bankSync` real de 00-core
// con un doble del SDK: horas, tope diario, pausa tras cupo o permiso, reloj y día de Madrid.
// La CI corre en UTC: el día que cuenta es el de Madrid, no el del proceso.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const motor = read("src/modules/08-motor-bank.js"), core = read("src/modules/00-core.js");
const cut = (s, from, to) => { const a = s.indexOf(from), b = s.indexOf(to, a); assert.ok(a >= 0 && b > a, from); return s.slice(a, b); };
const madrid = cut(motor, "var _mcMadridYmdFmt=null;", "function closedMonthWindow(");
const auto = cut(motor, "const BANK_AUTO_GAP_MS=", "/* UN BANCO POR PETICION");
const limited = core.match(/function bankRateLimited\(e\)\{[^\n]+\}/)[0];
const bankSyncSrc = cut(core, "    async bankSync(body){", "    // IMPORTAR HISTÓRICO");
const histSrc = cut(core, "    async bankSyncHistory(dateFrom, aspsps){", "    // Quita un banco enlazado");

function sandbox() {
  const store = {};
  const localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  const ctx = { localStorage, Intl, Date, JSON, Math, Number, String, isFinite, Error, Object, Array, console };
  vm.createContext(ctx);
  vm.runInContext(madrid + auto + limited + ";this.api={BANK_AUTO_GAP_MS,BANK_AUTO_MAX_DIA,bankAutoDia,bankAutoToca,bankAutoAnota,bankAutoPara,bankAutoFrena,bankAutoLee,bankAutoCuenta,bankAutoPausa};", ctx);
  return { ctx, store, api: ctx.api };
}

let count = 0;
function test(name, fn) { fn(); count++; console.log("  ✓ " + name); }
async function testAsync(name, fn) { await fn(); count++; console.log("  ✓ " + name); }

const H = 3600 * 1000;
// 16/11/2026 10:00 en Madrid (UTC+1) = 09:00Z.
const T0 = Date.UTC(2026, 10, 16, 9, 0);

test("N = 6 h y tope de 3 al día: con una a mano detrás no pasa de 4", () => {
  const { api } = sandbox();
  assert.equal(api.BANK_AUTO_GAP_MS, 6 * H);
  assert.equal(api.BANK_AUTO_MAX_DIA, 3);
});

test("sin lectura previa no sale sola (el banco recién conectado ya sincroniza al volver)", () => {
  const { api } = sandbox();
  assert.equal(api.bankAutoToca({}, 0, T0), false);
  assert.equal(api.bankAutoToca(null, undefined, T0), false);
});

test("hace 6 h o más sí; hace menos no", () => {
  const { api } = sandbox();
  assert.equal(api.bankAutoToca({}, T0 - 6 * H, T0), true);
  assert.equal(api.bankAutoToca({}, T0 - 6 * H + 1, T0), false);
  assert.equal(api.bankAutoToca({}, T0 - 30 * 60 * 1000, T0), false);
});

test("cuenta la última lectura de este móvil aunque no fuera buena (un fallo no se reintenta al entrar)", () => {
  const { api } = sandbox();
  const reg = api.bankAutoAnota({}, T0 - H);
  assert.equal(api.bankAutoToca(reg, T0 - 20 * H, T0), false, "intentó hace 1 h: espera");
  assert.equal(api.bankAutoToca(reg, T0 - 20 * H, T0 + 5 * H), true);
});

test("tope diario: tres lecturas hoy (manuales incluidas) cierran la sola hasta mañana", () => {
  const { api } = sandbox();
  let reg = {};
  for (let i = 0; i < 3; i++) reg = api.bankAutoAnota(reg, T0 - 9 * H + i * 60 * 1000); // 3 a mano esta madrugada (01:00 Madrid)
  assert.equal(reg.n, 3);
  assert.equal(api.bankAutoToca(reg, T0 - 9 * H, T0), false, "pasaron 9 h pero ya van 3 hoy");
  // Mañana a las 00:30 de Madrid (23:30Z de hoy) se abre otra vez.
  const manana = Date.UTC(2026, 10, 16, 23, 30);
  assert.equal(api.bankAutoDia(manana), "2026-11-17");
  assert.equal(api.bankAutoToca(reg, T0 - 9 * H, manana), true);
  assert.equal(api.bankAutoAnota(reg, manana).n, 1, "el contador del día nuevo empieza en 1");
});

test("el día es el de Madrid, también en verano y con la CI en UTC", () => {
  const { api } = sandbox();
  assert.equal(api.bankAutoDia(Date.UTC(2026, 10, 16, 23, 30)), "2026-11-17"); // invierno, UTC+1
  assert.equal(api.bankAutoDia(Date.UTC(2026, 6, 15, 22, 30)), "2026-07-16");  // verano, UTC+2
  assert.equal(api.bankAutoDia(Date.UTC(2026, 6, 15, 21, 30)), "2026-07-15");
});

test("simulación de un día entero entrando cada 10 min: nunca más de 3 solas ni dos a menos de 6 h", () => {
  const { api } = sandbox();
  let reg = {}, last = T0 - 24 * H, autos = [];
  const inicio = Date.UTC(2026, 10, 15, 23, 0); // 00:00 Madrid
  for (let t = inicio; t < inicio + 24 * H; t += 10 * 60 * 1000) {
    if (api.bankAutoToca(reg, last, t)) { reg = api.bankAutoAnota(reg, t); last = t; autos.push(t); }
  }
  assert.equal(autos.length, 3, "00:00, 06:00 y 12:00; la de las 18:00 la para el tope");
  for (let i = 1; i < autos.length; i++) assert.ok(autos[i] - autos[i - 1] >= 6 * H);
});

test("pausa por cupo o permiso: nada más hoy, mañana vuelve", () => {
  const { api } = sandbox();
  const reg = api.bankAutoPara({}, T0);
  assert.equal(api.bankAutoToca(reg, T0 - 20 * H, T0 + 8 * H), false);
  assert.equal(api.bankAutoToca(reg, T0 - 20 * H, Date.UTC(2026, 10, 17, 9, 0)), true);
});

test("reloj que retrocede: marca a menos de 6 h en el futuro espera; una marca rota no bloquea para siempre", () => {
  const { api } = sandbox();
  assert.equal(api.bankAutoToca({}, T0 + 2 * H, T0), false);
  assert.equal(api.bankAutoToca({}, T0 + 400 * 24 * H, T0), true);
  // …y aun así el tope del día manda.
  let reg = {}; for (let i = 0; i < 3; i++) reg = api.bankAutoAnota(reg, T0);
  assert.equal(api.bankAutoToca(reg, T0 + 400 * 24 * H, T0), false);
});

test("registro corrupto en localStorage se lee como vacío", () => {
  const { api, store } = sandbox();
  store._bankAutoSync = "{no es json";
  assert.deepEqual(JSON.parse(JSON.stringify(api.bankAutoLee())), { dia: "", n: 0, at: 0, pausa: "" });
  store._bankAutoSync = JSON.stringify({ dia: 5, n: "x", at: -3, pausa: null });
  assert.deepEqual(JSON.parse(JSON.stringify(api.bankAutoLee())), { dia: "", n: 0, at: 0, pausa: "" });
});

test("bankAutoFrena: 429, 401, 403 y sesión terminada frenan; caducado previo, timeout o éxito no", () => {
  const { api } = sandbox();
  const acc = (x) => [{ aspsp: "B", ok: false, accounts: [x] }];
  for (const c of ["eb_429", "eb_401", "eb_403", "429", "ASPSP_RATE_LIMIT_EXCEEDED", "EXPIRED_SESSION"])
    assert.equal(api.bankAutoFrena(acc({ ok: false, error: c })), true, c);
  assert.equal(api.bankAutoFrena([{ aspsp: "B", ok: false, failureCode: "eb_429", accounts: [] }]), true);
  assert.equal(api.bankAutoFrena(acc({ ok: false, transactionError: "timeout" })), false);
  assert.equal(api.bankAutoFrena([{ aspsp: "B", ok: false, expired: true, accounts: [] }]), false, "ya estaba caducado: la Edge no lo consulta");
  assert.equal(api.bankAutoFrena([{ aspsp: "B", ok: true, accounts: [{ ok: true }] }]), false);
  assert.equal(api.bankAutoFrena(null), false);
});

// cloud.bankSync / bankSyncHistory reales con un doble del SDK.
function cloudWith(invoke) {
  const s = sandbox();
  s.ctx.sb = { functions: { invoke } };
  vm.runInContext("this.cloudObj={" + bankSyncSrc + histSrc + "};", s.ctx);
  return s;
}
const realNow = Date.now;
await testAsync("cada lectura (también la del botón y el histórico) suma una al tope", async () => {
  const s = cloudWith(async () => ({ data: { ok: true, links: [{ aspsp: "B", ok: true, accounts: [] }] }, error: null }));
  await s.ctx.cloudObj.bankSync({ recoverGaps: true });
  await s.ctx.cloudObj.bankSync({ recoverGaps: true });
  await s.ctx.cloudObj.bankSyncHistory("2026-10-01", ["B"]);
  const reg = JSON.parse(s.store._bankAutoSync);
  assert.equal(reg.n, 3); assert.equal(reg.pausa, "");
  assert.equal(s.api.bankAutoToca(reg, realNow() - 7 * H, realNow()), false, "3 hoy: la sola ya no sale");
});
await testAsync("un 429 del servidor pausa hasta mañana y el error sigue llegando a quien llamó", async () => {
  const err = Object.assign(new Error("x"), { context: { status: 429 } });
  const s = cloudWith(async () => ({ data: null, error: err }));
  await assert.rejects(s.ctx.cloudObj.bankSync({}), (e) => e === err);
  assert.equal(JSON.parse(s.store._bankAutoSync).pausa, s.api.bankAutoDia(realNow()));
  const s2 = cloudWith(async () => ({ data: null, error: err }));
  await assert.rejects(s2.ctx.cloudObj.bankSyncHistory("2026-10-01", ["B"]));
  assert.equal(JSON.parse(s2.store._bankAutoSync).pausa, s2.api.bankAutoDia(realNow()));
});
await testAsync("un banco que contesta 429 dentro de una respuesta buena también pausa", async () => {
  const s = cloudWith(async () => ({ data: { ok: true, links: [{ aspsp: "B", ok: false, accounts: [{ ok: false, error: "eb_429" }] }] }, error: null }));
  const r = await s.ctx.cloudObj.bankSync({});
  assert.equal(r.ok, true);
  assert.equal(JSON.parse(s.store._bankAutoSync).pausa, s.api.bankAutoDia(realNow()));
});
await testAsync("un fallo de red NO pausa (cuenta el intento, se reintenta en 6 h)", async () => {
  const s = cloudWith(async () => { throw new Error("red"); });
  await assert.rejects(s.ctx.cloudObj.bankSync({}));
  const reg = JSON.parse(s.store._bankAutoSync);
  assert.equal(reg.n, 1); assert.equal(reg.pausa, "");
});

// El efecto que la lanza: existe, va con tope y respeta el modo pruebas.
const main = read("src/modules/11-app-main.js");
test("App lanza la sola con opts.auto, tras el pull, en idle y fuera del modo pruebas", () => {
  const eff = cut(main, "  /* LOS BANCOS AL DÍA SIN TOCAR NADA", "  /* ── Auto-refresh de brókers");
  assert.match(eff, /runBankSync\(\{auto:true\}\)/);
  assert.match(eff, /bankAutoToca\(bankAutoLee\(\), s\.lastBankSync, Date\.now\(\)\)/);
  assert.match(eff, /mcSandbox\(\)/);
  assert.match(eff, /pullOkRef\.current/);
  assert.match(eff, /mcScheduleIdle/);
  assert.match(eff, /removeEventListener\("visibilitychange", onVis\)/);
});
test("la sola calla sus fallos: el banner de bancos ya los enseña", () => {
  const sync = cut(main, "  const runBankSync=function(opts){", "  /* EL ACUSE SE GUARDA");
  assert.match(sync, /if\(!opts\.auto\) avisaSync\(opts\.manual\?opts:null, "⚠ "\+msg\)/);
  assert.match(sync, /if\(opts\.manual\) avisaSync\(opts,[\s\S]*else if\(!opts\.auto\) mcSiRedViva\(/);
});

console.log(`bank-autosync: ${count} pruebas OK`);
