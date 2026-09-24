#!/usr/bin/env node
/**
 * `categorize` FRENA EL CAMINO DEL LLM, NO LAS PALABRAS CLAVE (13/9, SEC-02).
 *
 * Aquí no hay Deno (el runner lo salta), así que se vigila la FORMA del código, que es lo que se
 * rompe al tocarlo: que el freno exista, que vaya DESPUÉS de las palabras clave (gratis) y ANTES
 * de llamar a OpenAI (de pago), y que al pasarse no devuelva un 429 que la app pintaría como error.
 */
import assert from "node:assert/strict";
import fs from "node:fs";

let fallos = 0;
const t = (n, fn) => { try { fn(); console.log("  ✓ " + n); } catch (e) { fallos++; console.error("  ✗ " + n + "\n      " + (e && e.message)); } };
console.log("categorize-limitador");

const src = fs.readFileSync(new URL("../supabase/functions/categorize/index.ts", import.meta.url), "utf8");
const iKw = src.indexOf("const kw = categorizar(merchant)");
const iGate = src.indexOf('rateLimit(admin, "categorize-ai:" + user.id');
const iLlm = src.indexOf("https://api.openai.com/");

t("usa el limitador compartido", () => {
  assert.ok(/import \{ rateLimit \} from "\.\.\/_shared\/ratelimit\.ts"/.test(src));
  assert.ok(iGate > 0, "falta la llamada a rateLimit con el bucket por usuario");
});

t("el freno va DESPUÉS de las palabras clave y ANTES del LLM", () => {
  assert.ok(iKw > 0 && iLlm > 0);
  assert.ok(iKw < iGate, "las palabras clave son gratis: no se frenan");
  assert.ok(iGate < iLlm, "si el freno va después, la llamada de pago ya se ha hecho");
});

t("al pasarse contesta «otros» con ai:\"limit\", no un 429", () => {
  const trozo = src.slice(iGate, iLlm);
  assert.ok(/ai: "limit"/.test(trozo));
  assert.equal(/429/.test(trozo), false, "un 429 lo enseñaría la app como error");
});

t("el LLM no puede devolver Bizum como categoría de gasto", () => {
  const allowed = src.match(/const ALLOWED = \[([\s\S]*?)\]/)?.[1] || "";
  assert.equal(/\"bizum\"/.test(allowed), false);
  assert.equal(/bizum=/.test(src), false);
});

if (fallos) { console.error(`categorize-limitador: ${fallos} fallo(s)`); process.exit(1); }
console.log("categorize-limitador: OK");
