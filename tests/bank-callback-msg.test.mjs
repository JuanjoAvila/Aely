#!/usr/bin/env node
/**
 * SEC-01 · el toast del bank-callback NO pinta texto crudo de la URL (14/9/2026).
 * Quien fabrique `?bank=error&msg=…` no puede meter un aviso falso «de tu banco».
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx = loadPureLogicFromFile();
let fallos = 0;
const t = (n, fn) => { try { fn(); console.log("  ✓ " + n); } catch (e) { fallos++; console.error("  ✗ " + n + "\n      " + (e && e.message)); } };
console.log("bank-callback-msg");

t("códigos cortos → clave i18n; inventado → genérico (nunca el texto)", () => {
  assert.equal(ctx.bankCallbackErrorKey("eb_error").key, "bank_err_eb");
  assert.equal(ctx.bankCallbackErrorKey("sin_code").key, "bank_err_sin_code");
  assert.equal(ctx.bankCallbackErrorKey("state").key, "bank_err_state");
  assert.equal(ctx.bankCallbackErrorKey("caducado").key, "bank_error_invalid");
  assert.equal(ctx.bankCallbackErrorKey("sin_cuenta").key, "bank_err_sin_cuenta");
  assert.equal(ctx.bankCallbackErrorKey("error").key, "bank_error");
  assert.equal(ctx.bankCallbackErrorKey("").key, "bank_error");
  assert.equal(ctx.bankCallbackErrorKey("Tu banco ha bloqueado la cuenta YA").key, "bank_error");
  assert.equal(ctx.bankCallbackErrorKey("invalid_request: expired").key, "bank_error_invalid");
});

t("nolink: se queda accionable (banco en el prefijo)", () => {
  const r = ctx.bankCallbackErrorKey("nolink:CaixaBank");
  assert.equal(r.kind, "nolink");
  assert.equal(r.bank, "CaixaBank");
});

t("nolink con banco conocido → etiqueta ENT; desconocido → 🏦 (nunca el texto)", () => {
  const ok = ctx.bankCallbackErrorToast("nolink:Banco Sabadell");
  assert.match(ok, /Sabadell/);
  assert.ok(!ok.includes("Banco Sabadell") || ok.includes("Sabadell"), ok);
  const inventado = "nolink:Tu cuenta está bloqueada, llama al 900-FAKE";
  const toast = ctx.bankCallbackErrorToast(inventado);
  assert.ok(toast.includes("🏦"), toast);
  assert.ok(!toast.includes("900-FAKE") && !toast.includes("bloqueada") && !toast.includes("cuenta está"), toast);
});

t("el toast NUNCA incluye el texto inventado", () => {
  const inventado = "URGENT: tu cuenta sera bloqueada en 5 minutos — llama al 900";
  const toast = ctx.bankCallbackErrorToast(inventado);
  assert.ok(!toast.includes("URGENT") && !toast.includes("900") && !toast.includes("bloqueada"), toast);
  assert.match(toast, /^⚠ /);
});

const main = fs.readFileSync(new URL("../src/modules/11-app-main.js", import.meta.url), "utf8");
t("los DOS retornos del banco (APK y web) usan bankCallbackErrorToast", () => {
  assert.ok(/showToast\(bankCallbackErrorToast\(parts\.slice\(2\)\.join/.test(main), "puente nativo bank|error");
  assert.ok(/showToast\(bankCallbackErrorToast\(params\.get\(\"msg\"\)/.test(main), "web ?bank=error");
  assert.ok(!/t\(\"bank_error\"\)\s*\+\s*\(m\s*\?\s*\": \"\s*\+\s*m/.test(main), "ya no se concatena el msg crudo");
});

const back = fs.readFileSync(new URL("../public/back.html", import.meta.url), "utf8");
t("back.html no pinta msg crudo y solo reenvía códigos / nolink:", () => {
  assert.ok(!/m\.textContent\s*=\s*msg\b/.test(back), "ya no pinta msg de la URL");
  assert.ok(/sanitizeMsg/.test(back) || /CODIGOS/.test(back), "sanitiza antes de reenviar");
  assert.ok(/Volviendo a Aely/.test(back), "mensaje fijo en el puente");
  assert.ok(/nolink:/.test(back) && /eb_error/.test(back), "allowlist de códigos");
});

if (fallos) { console.error(`bank-callback-msg: ${fallos} fallo(s)`); process.exit(1); }
console.log("bank-callback-msg: OK");
