/**
 * SEC-01 (14/9/2026, OPS-06): entradas de las Edge Functions que se llaman SIN sesión.
 *  - bank-callback: a la URL de vuelta solo sale un CÓDIGO, nunca el texto del error ni la query.
 *  - ingest: cuerpo con tope (413) y campos recortados antes de guardar.
 *  - ingest y myinvestor-keepalive: comparan su credencial en tiempo constante.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const lee = (p) => fs.readFileSync(path.join(root, p), "utf8");
const js = transformSync(lee("supabase/functions/_shared/entrada.ts"), { loader: "ts", format: "esm" }).code;
const E = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}`); throw e; }
}

console.log("entrada-edge");

t("timingSafeEqual: igual, distinto, y distinta longitud", () => {
  assert.equal(E.timingSafeEqual("abc123", "abc123"), true);
  assert.equal(E.timingSafeEqual("abc123", "abc124"), false);
  assert.equal(E.timingSafeEqual("abc", "abc123"), false);
  assert.equal(E.timingSafeEqual("", ""), true);
  assert.equal(E.timingSafeEqual("ñ", "n"), false);
});

t("recortar: corta, no toca lo corto y aguanta null/números", () => {
  assert.equal(E.recortar("x".repeat(500), 120).length, 120);
  assert.equal(E.recortar("Mercadona", 120), "Mercadona");
  assert.equal(E.recortar(null, 10), "");
  assert.equal(E.recortar(12345, 3), "123");
});

t("★ codigoCallback: un error cualquiera sale como «error», nunca con su texto", () => {
  const trampa = "Tu banco dice: llama al 900 000 000 para desbloquear";
  assert.equal(E.codigoCallback(new Error(trampa)), "error");
  assert.equal(E.codigoCallback(trampa), "error");
  const f = new E.CallbackFallo("eb_error", "banco devolvió error: " + trampa);
  assert.equal(E.codigoCallback(f), "eb_error");
  assert.ok(E.CALLBACK_CODIGOS.includes(E.codigoCallback(f)));
});

t("la lista de códigos es la pactada con el cliente", () => {
  assert.deepEqual([...E.CALLBACK_CODIGOS], ["eb_error", "sin_code", "state", "caducado", "sin_cuenta", "error"]);
});

t("codigoNolink: conserva el banco y quita lo que no es un nombre", () => {
  assert.equal(E.codigoNolink("Banco Sabadell"), "nolink:Banco Sabadell");
  assert.equal(E.codigoNolink("CaixaBank"), "nolink:CaixaBank");
  assert.equal(E.codigoNolink("<b>x</b>?msg=1"), "nolink:bxbmsg1");
  assert.ok(E.codigoNolink("x".repeat(500)).length <= 67);
});

t("★ bank-callback: ninguna redirección lleva el texto crudo (ni rawQuery ni ebError ni detail)", () => {
  const src = lee("supabase/functions/bank-callback/index.ts");
  const salidas = src.match(/backToApp\(false,[^)]*\)|msg=\$\{encodeURIComponent\([^)]*\)\}/g) || [];
  assert.ok(salidas.length >= 2, "no encuentro las salidas de error");
  for (const s of salidas) assert.match(s, /\b(msg|nolink)\b/, "salida sospechosa: " + s);
  assert.doesNotMatch(src, /throw new Error\(/, "un throw new Error saldría como «error», pero debe llevar su código");
  assert.match(src, /const msg = codigoCallback\(e\)/);
  assert.doesNotMatch(src, /backToApp\(false, detail\)/);
});

t("★ ingest: tope de cuerpo y recortes antes de guardar", () => {
  const src = lee("supabase/functions/ingest/index.ts");
  assert.match(src, /INGEST_MAX_BODY\) return json\(\{ ok: false, error: "cuerpo demasiado grande" \}, 413\)/);
  assert.match(src, /recortar\(data\.texto \|\| data\.notiText \|\| "", INGEST_MAX_TEXTO\)/);
  assert.match(src, /comercio = recortar\(comercio, INGEST_MAX_COMERCIO\)/);
  assert.match(src, /recortar\(extraerConcepto\(texto, titulo\), INGEST_MAX_NOTA\)/);
  // el recorte del comercio va ANTES del dedup que compara por comercio
  assert.ok(src.indexOf("comercio = recortar(comercio") < src.indexOf('.eq("comercio", comercio)'));
  assert.doesNotMatch(src, /function timingSafeEqual/, "la copia local debe vivir en _shared");
});

t("★ keepalive: la clave de cron se compara en tiempo constante", () => {
  const src = lee("supabase/functions/myinvestor-keepalive/index.ts");
  assert.match(src, /timingSafeEqual\(key, String\(sec\.secret\)\)/);
  assert.doesNotMatch(src, /key !== String\(sec\.secret\)/);
});

console.log("  ok");
