#!/usr/bin/env node
/**
 * Ronda E2 · núcleo de seguridad del cliente (auditoría del 14/11).
 *  · SEG-16: `micartera://bank?ok=1` y `?bank=ok` solo valen si este móvil salió a conectar.
 *  · SEG-02: la app pide confirmar, canjea el token de la vuelta y no manda al servidor uno ajeno.
 *  · SEG-08: el token de ingest deja de guardarse en `settings`.
 * Corre las funciones REALES de `00-core.js`, sacadas del fuente por nombre.
 */
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (f) => fs.readFileSync(new URL("../" + f, import.meta.url), "utf8");
const core = read("src/modules/00-core.js"), main = read("src/modules/11-app-main.js");
const comps = read("src/modules/10-app-components.js"), back = read("public/back.html");
let fallos = 0;
const ta = async (n, fn) => { try { await fn(); console.log("  ✓ " + n); } catch (e) { fallos++; console.error("  ✗ " + n + "\n      " + (e && e.message)); } };
const t =(n, fn) => { try { fn(); console.log("  ✓ " + n); } catch (e) { fallos++; console.error("  ✗ " + n + "\n      " + (e && e.message)); } };
console.log("ronda-e2-nucleo");

const desde = core.indexOf('const BANK_VUELTA_KEY="mc_bk_pend"'), hasta = core.indexOf("function bankConnectOnce(");
assert.ok(desde > 0 && hasta > desde, "no se encontró el bloque de la vuelta del banco");
function vuelta() {
  const mem = {};
  const localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
  const api = new Function("localStorage", core.slice(desde, hasta) + "\nreturn {bankVueltaAbre,bankVueltaCierra,bankVueltaAdmite,bankConfirmToken,BANK_VUELTA_MS};")(localStorage);
  return { ...api, mem };
}
const T0 = 1_800_000_000_000, MIN = 60_000, TOKEN = "A".repeat(20) + "-_" + "b".repeat(21);

t("sin haber salido a conectar, ni `ok` ni `confirm` valen", () => {
  const v = vuelta();
  assert.equal(v.bankVueltaAdmite("ok", "u1", T0), false);
  assert.equal(v.bankVueltaAdmite("confirm", "u1", T0), false);
});

t("tras conectar, `ok` vale UNA vez y la confirmación sigue pudiendo llegar", () => {
  const v = vuelta();
  v.bankVueltaAbre("u1", T0);
  assert.equal(v.bankVueltaAdmite("ok", "u1", T0 + MIN), true);
  assert.equal(v.bankVueltaAdmite("ok", "u1", T0 + 2 * MIN), false, "un segundo ok no repite la lectura");
  assert.equal(v.bankVueltaAdmite("confirm", "u1", T0 + 3 * MIN), true);
  // Un canje que falla no gasta la marca: el token bueno puede llegar después.
  assert.equal(v.bankVueltaAdmite("confirm", "u1", T0 + 4 * MIN), true);
  v.bankVueltaCierra();
  assert.equal(v.bankVueltaAdmite("confirm", "u1", T0 + 5 * MIN), false);
});

t("la marca caduca a la hora, como la ventana del servidor, y no vale la de otra cuenta", () => {
  const v = vuelta();
  assert.equal(v.BANK_VUELTA_MS, 60 * MIN);
  v.bankVueltaAbre("u1", T0);
  assert.equal(v.bankVueltaAdmite("ok", "u2", T0 + MIN), false, "otra cuenta en el mismo móvil");
  assert.equal(v.bankVueltaAdmite("ok", "", T0 + MIN), true, "en frío aún no hay sesión: decide el servidor");
  v.bankVueltaAbre("u1", T0);
  assert.equal(v.bankVueltaAdmite("confirm", "u1", T0 + 61 * MIN), false);
  assert.equal(Object.keys(v.mem).length, 0, "la marca caducada se borra");
  v.bankVueltaAbre("u1", T0);
  assert.equal(v.bankVueltaAdmite("ok", "u1", T0 - MIN), false, "reloj hacia atrás");
});

t("una marca rota o un tipo desconocido no abren nada", () => {
  const v = vuelta();
  v.mem.mc_bk_pend = "{no es json";
  assert.equal(v.bankVueltaAdmite("ok", "u1", T0), false);
  v.mem.mc_bk_pend = JSON.stringify({ u: "u1" });
  assert.equal(v.bankVueltaAdmite("ok", "u1", T0), false);
  v.bankVueltaAbre("u1", T0);
  assert.equal(v.bankVueltaAdmite("error", "u1", T0), false);
});

t("el token de confirmación: 43 caracteres base64url o nada", () => {
  const v = vuelta();
  assert.equal(v.bankConfirmToken(TOKEN), TOKEN);
  for (const malo of ["", null, TOKEN.slice(1), TOKEN + "A", TOKEN.slice(0, 42) + "/", TOKEN.slice(0, 42) + " ", "confirm:" + TOKEN]) {
    assert.equal(v.bankConfirmToken(malo), "", String(malo));
  }
  // El mismo formato que valida el servidor (`_shared/request_body.ts`).
  assert.ok(read("supabase/functions/_shared/request_body.ts").includes("/^[A-Za-z0-9_-]{43}$/.test(b.token)"));
});

t("la app pide confirmar, deja la marca al salir y `bankConfirm` no escribe en modo pruebas", () => {
  const con = core.slice(core.indexOf("async bankConnect("), core.indexOf("async bankAspsps("));
  assert.match(con, /const confirm=native \? await bankPuenteConfirma\(\) : true;/);
  assert.match(con, /invoke\('bank-connect',\{ body:\{[^}]*confirm:confirm \} \}\)/);
  assert.ok(con.indexOf("bankVueltaAbre(") > con.indexOf("if(!data || !data.ok) throw"), "la marca solo con el enlace del banco en la mano");
  assert.match(con, /invoke\('bank-confirm',\{ body:\{ token:token \} \}\)/);
  const writes = core.match(/const CLOUD_WRITES=\[([\s\S]*?)\];/)[1];
  assert.ok(writes.includes('"bankConfirm"'));
});

await ta("en la APK solo se pide confirmar si el `back.html` publicado ya reenvía el token", async () => {
  const cuerpo = core.slice(desde, hasta) + "\nreturn bankPuenteConfirma();";
  const puente = (fetch) => new Function("fetch", "_mcOtaBASE", "setTimeout", cuerpo)(fetch, "https://pages.invalid/", () => 0);
  const pedidas = [];
  assert.equal(await puente(async (u, o) => { pedidas.push([u, o]); return { ok: true, text: async () => back }; }), true, "el back.html de este commit lo reenvía");
  assert.match(pedidas[0][0], /^https:\/\/pages\.invalid\/back\.html\?ts=\d+$/);
  assert.deepEqual(pedidas[0][1], { cache: "no-store" });
  const viejo = back.replace(/"confirm:"/g, '"x:"');
  assert.equal(await puente(async () => ({ ok: true, text: async () => viejo })), false, "un back.html de antes: como hasta ahora");
  assert.equal(await puente(async () => ({ ok: false, text: async () => back })), false);
  assert.equal(await puente(async () => { throw new TypeError("Failed to fetch"); }), false);
  // Sin respuesta no se queda colgado el botón de conectar: a los 4 s, como hasta ahora.
  let plazo = null;
  const colgado = new Function("fetch", "_mcOtaBASE", "setTimeout", cuerpo)(() => new Promise(() => {}), "https://pages.invalid/", (f, ms) => { plazo = ms; f(); });
  assert.equal(await colgado, false);
  assert.equal(plazo, 4000);
});

t("el canje reintenta ante el error REAL de supabase-js (FunctionsFetchError), no solo ante TypeError", () => {
  const fin = (desde) => core.indexOf("\n}", desde) + 2;
  const i = core.indexOf("function renameFalloDeRed("), f = core.indexOf("function bankCanjeFalloDeRed("), s = core.indexOf("function mcSinRed(");
  assert.ok(i > 0 && f > 0 && s > 0);
  // 4.26.250: `renameFalloDeRed` mira primero `mcSinRed` (aviso de sin conexión que ya no falla con VPN), que lee `_redVivaAt`.
  const red = new Function("navigator", "var _redVivaAt=0;
" + core.slice(s, fin(s)) + core.slice(i, fin(i)) + core.slice(f, fin(f)) + "\nreturn bankCanjeFalloDeRed;")({ onLine: true });
  const real = Object.assign(new Error("Failed to send a request to the Edge Function"), { name: "FunctionsFetchError" });
  assert.equal(red(real), true, "forma real del error");
  assert.equal(red(Object.assign(new Error("x"), { name: "FunctionsFetchError" })), true, "por nombre");
  assert.equal(red(new Error("Failed to send a request to the Edge Function")), true, "por texto");
  assert.equal(red(new TypeError("Failed to fetch")), true);
  assert.equal(red(new Error("state")), false, "un rechazo del servidor no se reintenta");
  assert.equal(red(null), false);
  assert.match(main, /if\(!bankCanjeFalloDeRed\(e\)\) throw e;/);
});

t("los dos retornos (APK y web) pasan por la marca y por el canje", () => {
  assert.match(main, /if\(parts\[1\]==="ok"\) vueltaBancoOk\(\);/);
  assert.match(main, /else if\(resto\.indexOf\("confirm:"\)===0\) vueltaBancoConfirma\(resto\.slice\(8\)\);/);
  assert.match(main, /if\(bankParam==="ok"\) vueltaBancoOk\(\);/);
  assert.match(main, /else if\(bankParam==="confirm"\) vueltaBancoConfirma\(params\.get\("t"\)\);/);
  const ok = main.slice(main.indexOf("const vueltaBancoOk="), main.indexOf("const vueltaBancoConfirma="));
  assert.match(ok, /if\(bankVueltaAdmite\("ok", .*\)\) bancoConectado\(\);/);
  const conf = main.slice(main.indexOf("const vueltaBancoConfirma="), main.indexOf("const handleGoto="));
  assert.ok(conf.indexOf('bankVueltaAdmite("confirm"') < conf.indexOf("cloud.bankConfirm(tok)"), "sin marca no se llama al servidor");
  assert.ok(conf.indexOf("bankVueltaCierra()") > conf.indexOf("cloud.bankConfirm(tok)"), "la marca se cierra al aceptar el servidor");
  // «Banco conectado» y la lectura solo salen de `bancoConectado`.
  assert.equal(main.split('t("bank_connected")').length - 1, 1);
});

t("back.html reenvía el token dentro de `msg`, solo con el formato del servidor", () => {
  assert.ok(back.includes('/^[A-Za-z0-9_-]{43}$/.test(tok)'));
  assert.ok(back.includes('encodeURIComponent(tok?"confirm:"+tok:(msg||"error"))'));
  assert.ok(back.includes('history.replaceState(null,"",location.pathname)'), "el token no se queda en la barra");
  assert.ok(!/textContent\s*=\s*tok\b/.test(back), "el token no se pinta");
});

t("SEG-08: el token de ingest no vuelve a `settings`", () => {
  assert.ok(!/ingestToken\s*:/.test(comps), "10 ya no escribe ingestToken");
  assert.ok(!/ingestToken\s*:/.test(main), "11 ya no escribe ingestToken");
  assert.match(comps, /delete st\.ingestToken;/);
  assert.match(main, /delete st\.ingestToken;/);
  // La URL del lector se arma en un solo sitio.
  assert.equal((comps + main).split("/functions/v1/ingest").length - 1, 0);
  assert.equal(core.split("/functions/v1/ingest?token=").length - 1, 1);
  assert.match(core, /async getIngestToken\(\)\{[\s\S]{0,200}from\('ingest_tokens'\)\.select\('token'\)\.maybeSingle\(\)/);
});

t("R-06: Sentry no se baja sin un error en la cola", () => {
  const f = core.slice(core.indexOf("function mcLoadSentryDeferred()"), core.indexOf("function mcCaptureError("));
  assert.match(f, /if\(!CONFIG\.SENTRY_DSN \|\| !_mcSentryQueue\.length\) return;/);
  const c = core.slice(core.indexOf("function mcCaptureError("), core.indexOf("/* ---------- Categorías de gasto variable"));
  assert.ok(c.indexOf("_mcSentryQueue.push(") < c.indexOf("mcLoadSentryDeferred()"), "el error entra en la cola antes de cargar");
});

if (fallos) { console.error("\n" + fallos + " fallo(s)"); process.exit(1); }
console.log("\nOK");
