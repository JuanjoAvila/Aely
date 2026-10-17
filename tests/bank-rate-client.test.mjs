// SEC-02: transporte de error y funciones reales que ya muestran los avisos.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { planFromFiles } from "../scripts/relevant-tests.mjs";

const root = new URL("../", import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), "utf8");
const core = read("src/modules/00-core.js"), main = read("src/modules/11-app-main.js"), components = read("src/modules/10-app-components.js");
const LANG = vm.runInNewContext(read("src/modules/01-i18n.js") + ";LANG;", { NF: new Intl.NumberFormat("es-ES"), DISP: { sym: "€", k: 1 }, SIMPLEMODE: false });
const SDK = vm.runInNewContext(read("public/vendor/supabase.min.js") + ";supabase;", { Response, Headers, URL, console: { warn() {} } });
const expected = { es: "Demasiados intentos. Prueba en un rato.", en: "Too many attempts. Try again in a little while.", ca: "Massa intents. Torna-ho a provar d'aquí a una estona." };
const extract = (s, from, to) => { const a = s.indexOf(from), b = s.indexOf(to, a); assert.ok(a >= 0 && b > a, from); return s.slice(a, b); };
const helper = core.match(/function bankRateLimited\(e\)\{[^\n]+\}/)?.[0] || "";
const limited = helper ? Function(helper + ";return bankRateLimited;")() : undefined;
const connect = extract(components, "  const connect=function(name,country){", "  // Issues de la última sync");
const reconnect = extract(main, "  const reconnectBank=function(aspsp){", "  useEffect(function(){");
const sync = extract(main, "  const runBankSync=function(opts){", "  /* EL ACUSE SE GUARDA");
const sdkError = status => new SDK.FunctionsHttpError(new Response(JSON.stringify({ ok: false, error: "rate_limit" }), { status }));
async function flow(kind, lang, error, extra = {}) {
  const messages = [], calls = [], lock = { current: false };
  const t = k => LANG[lang][k] || LANG.es[k] || k;
  const env = { cloud: { enabled: () => true, bankLinks: async () => [], bankSync: async () => { calls.push("sync"); throw error; }, logEvent() {} },
    uid: "synthetic", sessionRef: { current: {} }, bankSyncing: lock, pullOkRef: { current: Promise.resolve(true) },
    syncCloudExpenses: async () => {}, SYNC_SIN_NUBE: {}, obAckLoad: () => ({}), navigator: { onLine: true },
    window: { dispatchEvent() {} }, CustomEvent: function () {},
    showToast: x => messages.push(x), avisaSync: (opts, x) => opts?.collect ? opts.collect.push(x) : messages.push(x),
    t, bankRateLimited: limited, setBusy() {}, set() {}, location: {}, bankConnectOnce: async () => { calls.push("connect"); throw error; }, ...extra };
  const name = kind === "panel" ? "connect" : kind === "reconnect" ? "reconnectBank" : "runBankSync";
  const body = kind === "panel" ? connect : kind === "reconnect" ? reconnect : sync;
  const fn = Function(...Object.keys(env), body + ";return " + name + ";")(...Object.values(env));
  const opts = { manual: true, collect: [] };
  if (kind === "sync") await fn(opts); else { fn("Fixture Bank", "ES"); await new Promise(setImmediate); }
  return { messages: kind === "sync" ? opts.collect : messages, calls, locked: lock.current };
}
let count = 0, failed = 0;
async function test(name, run) { try { await run(); count++; console.log("  ✓ " + name); } catch (e) { failed++; console.error("  ✗ " + name + ": " + e.message); } }
for (const lang of ["es", "en", "ca"]) for (const kind of ["panel", "reconnect", "sync"]) {
  await test(kind + " 429 real del SDK en " + lang, async () => {
    const e = sdkError(429); assert.equal(e.context.status, 429);
    const r = await flow(kind, lang, e); assert.equal(r.messages.at(-1), "⚠ " + expected[lang]);
    assert.equal(r.calls.length, 1); assert.equal(r.locked, false); assert.ok(!r.messages.at(-1).includes("429"));
  });
}
await test("código cerrado del cuerpo también usa el mismo aviso", async () => {
  for (const kind of ["panel", "reconnect", "sync"]) assert.equal((await flow(kind, "es", new Error("rate_limit"))).messages.at(-1), "⚠ " + expected.es);
});
await test("red y HTTP500 conservan los errores anteriores", async () => {
  for (const e of [new Error("fixture-network"), sdkError(500)]) for (const kind of ["panel", "reconnect", "sync"]) {
    const r = await flow(kind, "es", e);
    assert.equal(r.messages.at(-1), "⚠ " + (kind === "sync" ? LANG.es.bank_syncfail : LANG.es.bank_error + ": " + e.message));
  }
});
await test("autorización en curso conserva busy antes de clasificar429", async () => {
  const e = sdkError(429); e.code = "busy";
  for (const kind of ["panel", "reconnect"]) assert.equal((await flow(kind, "es", e)).messages.at(-1), "⚠ " + LANG.es.bank_error_busy);
});
await test("la ausencia de nube impide llamar al banco y conserva su aviso", async () => {
  const r = await flow("sync", "es", sdkError(429), { pullOkRef: { current: Promise.resolve(false) }, syncCloudExpenses: async () => { throw Error("offline"); } });
  assert.equal(r.calls.length, 0); assert.equal(r.messages.at(-1), "⚠ " + LANG.es.bank_sync_sin_nube); assert.equal(r.locked, false);
});
await test("no se interpreta429 dentro de texto libre como cuota", () => {
  assert.equal(typeof limited, "function");
  for (const e of [null, {}, new Error("fixture429"), sdkError(503)]) assert.equal(limited(e), false);
});

// Ejecuta el runner real en una carpeta desechable con una sonda en el entry:
// no vuelve a correr los doce mutantes cuyo código de backend no ha cambiado.
function runnerProbe({ missingFile = false, missingStep = false } = {}) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "aely-sec02-runner-"));
  const checked = fs.realpathSync(temp), parent = fs.realpathSync(os.tmpdir());
  assert.ok(checked.startsWith(parent + path.sep));
  try {
    for (const dir of ["scripts", "tests", "supabase"]) fs.mkdirSync(path.join(temp, dir));
    let runner = read("scripts/run-tests.mjs");
    if (missingStep) runner = runner.replace(/^.*\["bank-rate-contracts",.*\r?\n/m, "");
    fs.writeFileSync(path.join(temp, "scripts/run-tests.mjs"), runner);
    if (!missingFile) fs.writeFileSync(path.join(temp, "tests/bank-rate-contracts.test.mjs"), 'console.log("SEC02_ENTRY_EXECUTED");\n');
    fs.writeFileSync(path.join(temp, "plan.json"), JSON.stringify({ build: false, deno: false, playwright: false, e2e: "none", steps: ["bank-rate-contracts"] }));
    const r = spawnSync(process.execPath, ["scripts/run-tests.mjs", "--plan", "plan.json"], { cwd: temp, encoding: "utf8" });
    return { exit: r.status, text: r.stdout + r.stderr };
  } finally { fs.rmSync(checked, { recursive: true }); }
}
await test("entry independiente invocado por su propio steps", () => { const r = runnerProbe(); assert.equal(r.exit, 0, r.text); assert.ok(r.text.includes("SEC02_ENTRY_EXECUTED")); });
await test("borrar el test hace fallar el runner", () => { const r = runnerProbe({ missingFile: true }); assert.equal(r.exit, 1); assert.ok(r.text.includes("FAILED: bank-rate-contracts")); });
await test("quitar steps dejando el test hace saltar huérfanos", () => { const r = runnerProbe({ missingStep: true }); assert.equal(r.exit, 1); assert.ok(r.text.includes("NADIE ejecuta")); });
await test("recorte servidor conserva ambos contratos y paginado no los importa", () => {
  for (const file of ["supabase/functions/bank-connect/index.ts", "supabase/functions/bank-sync/index.ts", "supabase/functions/bank-callback/index.ts"]) {
    const p = planFromFiles([file]); assert.ok(p.steps.includes("bank-rate-contracts")); assert.ok(p.steps.includes("bank-rate-client"));
  }
  assert.ok(!read("tests/bank-sync-paging.test.mjs").includes("bank-rate-contracts"));
});
console.log("bank-rate-client: " + count + " PASS / " + failed + " FAIL; sin banco/red ni mutantes backend repetidos");
if (failed) process.exitCode = 1;
