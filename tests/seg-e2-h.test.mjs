#!/usr/bin/env node
/**
 * Pendientes H1, H3 y H4 de la revisión E2 del núcleo de seguridad.
 *  · H1: la marca de la vuelta del banco no vale en una carga en frío si es de otra cuenta.
 *  · H3: `sw.js` no guarda en caché una navegación con credenciales en la query.
 *  · H4: el token de ingest se quita de `settings` también sin puente nativo y al salir/cambiar de cuenta.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = (f) => fs.readFileSync(new URL("../" + f, import.meta.url), "utf8");
const core = read("src/modules/00-core.js"), main = read("src/modules/11-app-main.js"), swSrc = read("public/sw.js");
let fallos = 0;
const t = (n, fn) => { try { fn(); console.log("  ✓ " + n); } catch (e) { fallos++; console.error("  ✗ " + n + "\n      " + (e && e.message)); } };
const ta = async (n, fn) => { try { await fn(); console.log("  ✓ " + n); } catch (e) { fallos++; console.error("  ✗ " + n + "\n      " + (e && e.message)); } };
console.log("seg-e2-h");

/* ---------- H1 ---------- */
const d = core.indexOf('const BANK_VUELTA_KEY="mc_bk_pend"'), h = core.indexOf("function bankPuenteConfirma(");
function vuelta() {
  const mem = {};
  const localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
  return new Function("localStorage", core.slice(d, h) + "\nreturn {bankVueltaAbre,bankVueltaAdmite};")(localStorage);
}
t("H1: carga en frío (sin sesión conocida) no admite la marca de una cuenta", () => {
  const v = vuelta(), T0 = 1_800_000_000_000;
  v.bankVueltaAbre("u1", T0);
  assert.equal(v.bankVueltaAdmite("ok", "", T0 + 1000), false);
  assert.equal(v.bankVueltaAdmite("confirm", undefined, T0 + 1000), false);
  assert.equal(v.bankVueltaAdmite("confirm", "u2", T0 + 1000), false);
  assert.equal(v.bankVueltaAdmite("confirm", "u1", T0 + 1000), true, "la misma cuenta, ya con sesión");
});
t("H1: quien llama espera a la sesión antes de preguntar por la marca", () => {
  const f = main.slice(main.indexOf("const conTitular="), main.indexOf("const handleGoto="));
  assert.match(f, /cloud\.session\(\)/);
  assert.match(f, /conTitular\(function\(u\)\{ if\(bankVueltaAdmite\("ok", u, Date\.now\(\)\)\) bancoConectado\(\); \}\);/);
  assert.match(f, /conTitular\(function\(u\)\{\s*if\(!bankVueltaAdmite\("confirm", u, Date\.now\(\)\)\)/);
  assert.ok(!/sessionRef\.current&&sessionRef\.current\.user\.id, Date\.now/.test(f), "ya no se pregunta con la sesión que aún no cargó");
});

/* ---------- H3 ---------- */
async function sw(url, mode = "navigate") {
  const puestas = [];
  let handler = null;
  const cache = { put: async (k) => { puestas.push(typeof k === "string" ? k : k.url); } };
  const self = { addEventListener: (n, fn) => { if (n === "fetch") handler = fn; }, location: { origin: "https://app.test" }, skipWaiting() {} };
  const ctx = vm.createContext({
    self, URL, Response, console, location: self.location,
    caches: { open: async () => cache, match: async () => undefined, keys: async () => [], delete: async () => true },
    fetch: async () => new Response("<html></html>", { status: 200 }),
  });
  vm.runInContext(swSrc, ctx);
  let respuesta;
  handler({ request: { url, method: "GET", mode }, respondWith: (p) => { respuesta = p; } });
  const res = await respuesta;
  await new Promise((r) => setTimeout(r, 20));
  return { res, puestas };
}
await ta("H3: una navegación con token en la query se sirve pero no se guarda con su clave", async () => {
  for (const q of ["?code=abc123", "?token_hash=zzz&type=magiclink", "?bank=confirm&t=" + "A".repeat(43), "?access_token=x", "?apikey=k", "?provider_token=p", "?otp=123456", "?redirect_to=https%3A%2F%2Fx", "?algo_desconocido=1", "?v=3&otp=1"]) {
    const { res, puestas } = await sw("https://app.test/" + q);
    assert.equal(res.status, 200, q);
    assert.ok(!puestas.some((k) => /[?&](code|token_hash|t|access_token|apikey|provider_token|otp|redirect_to|algo_desconocido)=/.test(k)), "token en la clave de la caché: " + q + " -> " + puestas);
    assert.ok(puestas.includes("./"), "la ruta limpia sí se guarda: " + q);
  }
});
await ta("H3: una URL normal (con ?v= o sin query) se sigue guardando como antes", async () => {
  const a = await sw("https://app.test/release-notes.json?v=12", "cors");
  assert.ok(a.puestas.some((k) => k.endsWith("release-notes.json?v=12")));
  const b = await sw("https://app.test/");
  assert.ok(b.puestas.includes("https://app.test/"));
});

/* ---------- H4 ---------- */
t("H4: estadoSinIngestToken quita el token y no toca nada más", () => {
  const i = core.indexOf("function estadoSinIngestToken("), f = core.indexOf("function bankVueltaCierra(");
  assert.ok(i > 0 && f > i);
  const fn = new Function(core.slice(i, f) + "\nreturn estadoSinIngestToken;")();
  const s = { a: 1, settings: { ingestToken: "SECRETO", trIngest: true } };
  const r = fn(s);
  assert.equal(r.settings.ingestToken, undefined);
  assert.equal(r.settings.trIngest, true);
  assert.equal(s.settings.ingestToken, "SECRETO", "no muta");
  const sin = { settings: { x: 1 } };
  assert.equal(fn(sin), sin, "sin token, el mismo objeto");
  assert.equal(fn(null), null);
});
t("H4: el efecto de limpieza no depende del puente nativo y salir/cambiar de cuenta lo quitan", () => {
  const i = main.indexOf("SEG-08, también sin puente nativo");
  const ef = main.slice(i, main.indexOf("// App Android: alimenta el widget"));
  assert.ok(i > 0 && ef.length > 100);
  assert.ok(!/natPlugin\(\)/.test(ef), "sin puente nativo también limpia");
  assert.match(ef, /cloud\.getIngestToken\(\)/);
  assert.match(ef, /set\(estadoSinIngestToken\)/);
  assert.match(main, /return estadoSinIngestToken\(Object\.assign\(\{\},p,\{bankTx:\[\]/, "SIGNED_OUT");
  assert.match(main, /if\(login&&prev\) set\(estadoSinIngestToken\);/, "cambio de cuenta");
});

if (fallos) { console.error("\n" + fallos + " fallo(s)"); process.exit(1); }
console.log("\nOK");
