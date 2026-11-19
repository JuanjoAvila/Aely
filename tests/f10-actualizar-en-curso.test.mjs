// F-10: «Actualizar» con la lectura automática de los bancos aún en marcha.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

/* Antes el segundo `runBankSync` volvía sin hacer nada y sin decir nada: parecía que el botón no
   iba. Ahora avisa al momento («Ya se están leyendo tus bancos»), no lanza una segunda lectura (los
   bancos leen dos seguidas como un bot) y quien pulsó espera a la que ya estaba en marcha. Se
   ejecuta la función real de 11, con el mismo arnés que `bank-rate-client`. */
const root = new URL("../", import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), "utf8");
const main = read("src/modules/11-app-main.js");
const LANG = vm.runInNewContext(read("src/modules/01-i18n.js") + ";LANG;", { NF: new Intl.NumberFormat("es-ES"), DISP: { sym: "€", k: 1 }, SIMPLEMODE: false });
const extract = (s, from, to) => { const a = s.indexOf(from), b = s.indexOf(to, a); assert.ok(a >= 0 && b > a, from); return s.slice(a, b); };
const sync = extract(main, "  const runBankSync=function(opts){", "  /* EL ACUSE SE GUARDA");
let count = 0, failed = 0;
async function test(name, run) { try { await run(); count++; console.log("  ✓ " + name); } catch (e) { failed++; console.error("  ✗ " + name + ": " + e.message); } }

function harness(lang) {
  const toasts = [], calls = [];
  let release;
  const gate = new Promise(r => { release = r; });
  const t = k => LANG[lang][k] || LANG.es[k] || k;
  const env = { cloud: { enabled: () => true, bankLinks: async () => [], bankSync: async () => { calls.push("sync"); await gate; throw new Error("fixture-network"); }, logEvent() {} },
    sessionRef: { current: {} }, bankSyncing: { current: false }, bankSyncEnCurso: { current: null }, pullOkRef: { current: Promise.resolve(true) },
    syncCloudExpenses: async () => {}, SYNC_SIN_NUBE: {}, obAckLoad: () => ({}), navigator: { onLine: true },
    window: { dispatchEvent() {} }, CustomEvent: function () {},
    showToast: x => toasts.push(x), avisoSync: { current: null }, avisaSync: (opts, x) => opts?.collect ? opts.collect.push(x) : toasts.push(x),
    t, bankRateLimited: () => false };
  const fn = Function(...Object.keys(env), sync + ";return runBankSync;")(...Object.values(env));
  return { fn, toasts, calls, release, lock: env.bankSyncing };
}

for (const lang of ["es", "en", "ca"]) await test("pulsar con la lectura sola en marcha avisa en " + lang, async () => {
  const h = harness(lang);
  const auto = h.fn({ auto: true });
  await new Promise(setImmediate);
  assert.equal(h.calls.length, 1, "la automática ya llamó al banco");
  let manualDone = false;
  const manual = h.fn({ manual: true, collect: [] }).then(() => { manualDone = true; });
  await new Promise(setImmediate);
  assert.deepEqual(h.toasts, [LANG[lang].bank_sync_ya], "avisa al momento");
  assert.ok(LANG[lang].bank_sync_ya, "la clave existe en " + lang);
  assert.equal(h.calls.length, 1, "no lanza otra lectura encima");
  assert.equal(manualDone, false, "espera a la que ya estaba en marcha");
  h.release();
  await Promise.all([auto, manual]);
  assert.equal(manualDone, true);
  assert.equal(h.lock.current, false);
});

await test("una automática encima de otra sigue callada", async () => {
  const h = harness("es");
  const a = h.fn({ auto: true });
  await new Promise(setImmediate);
  const b = h.fn({});
  await new Promise(setImmediate);
  assert.deepEqual(h.toasts, []);
  assert.equal(h.calls.length, 1);
  h.release(); await Promise.all([a, b]);
});

console.log(`\n${count} OK, ${failed} fallos`);
if (failed) process.exit(1);
