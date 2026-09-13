#!/usr/bin/env node
/**
 * A/B idiomas (4.19.103): el bundle NO debe arrastrar LANG.en / LANG.ca; viven en
 * public/i18n/*.json con las mismas claves que la fuente. i18n-keys sigue mirando
 * src/modules/01-i18n.js (los tres idiomas); este test mira el PRODUCTO del build.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { loadLangFromSource } from "../scripts/i18n-bundle.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let fallos = 0;
const t = (nombre, fn) => {
  try { fn(); console.log("  ✓ " + nombre); }
  catch (e) { fallos++; console.error("  ✗ " + nombre + "\n      " + (e && e.message)); }
};

console.log("i18n-bundle");

execFileSync(process.execPath, [path.join(root, "scripts", "build-app.mjs")], {
  cwd: root,
  stdio: "pipe",
});

const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const en = JSON.parse(fs.readFileSync(path.join(root, "public", "i18n", "en.json"), "utf8"));
const ca = JSON.parse(fs.readFileSync(path.join(root, "public", "i18n", "ca.json"), "utf8"));
const srcLang = loadLangFromSource(fs.readFileSync(path.join(root, "src", "modules", "01-i18n.js"), "utf8"));

t("el index no arrastra Object.assign(LANG.en|ca)", () => {
  assert.equal(/Object\.assign\(LANG\.en,/.test(html), false);
  assert.equal(/Object\.assign\(LANG\.ca,/.test(html), false);
});

t("el index no arrastra el diccionario grande en inglés (v4_gastos_title)", () => {
  // LANG_SIMPLE.en sí puede quedar (pocas claves). «Your spending» es del LANG.en gordo.
  assert.equal(html.includes(srcLang.en.v4_gastos_title), false);
});

t("public/i18n/en.json y ca.json tienen las mismas claves que la fuente", () => {
  const srcEn = Object.keys(srcLang.en).sort();
  const srcCa = Object.keys(srcLang.ca).sort();
  assert.deepEqual(Object.keys(en).sort(), srcEn);
  assert.deepEqual(Object.keys(ca).sort(), srcCa);
  assert.ok(srcEn.length > 1000, "diccionario demasiado corto: " + srcEn.length);
});

t("ensureLangPack y peekSavedLang viven en el bundle", () => {
  assert.match(html, /function ensureLangPack\(/);
  assert.match(html, /function peekSavedLang\(/);
});

t("sw.js precachea los JSON de idioma", () => {
  const sw = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
  assert.match(sw, /i18n\/en\.json/);
  assert.match(sw, /i18n\/ca\.json/);
});

if (fallos) { console.error("i18n-bundle: " + fallos + " fallo(s)"); process.exit(1); }
console.log("i18n-bundle: OK");
