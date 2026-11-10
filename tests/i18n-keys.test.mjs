#!/usr/bin/env node
/**
 * AGENTS.md §4 dice «cada clave nueva va en los TRES idiomas» — pero nada lo comprobaba, así que
 * la regla se rompía en silencio: t() cae al español y en inglés/catalán salía el texto castellano
 * (o la clave pelada si tampoco estaba en es). Este test lo hace cumplir de verdad.
 *
 * Cómo: ejecuta el módulo de i18n en un sandbox (es un script que va haciendo Object.assign sobre
 * LANG, así que leerlo con regex no vale) y compara sus claves con las que se usan de verdad en
 * los módulos: t("x") y tf("x",…).
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const modulesDir = path.join(root, "src", "modules");

// RELEASE_NOTES es la excepción documentada: notas de versión solo en castellano.
const ONLY_ES = new Set([]);

function loadLang() {
  const src = fs.readFileSync(path.join(modulesDir, "01-i18n.js"), "utf8");
  const sandbox = {
    console,
    Intl,
    Math,
    Date,
    JSON,
    Object,
    Array,
    String,
    Number,
    RegExp,
    // El módulo usa estos helpers de 00-core en tiempo de definición.
    NF: new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    DISP: { sym: "€", k: 1 },
    SIMPLEMODE: false,
  };
  sandbox.globalThis = sandbox;
  // `const LANG = {…}` vive en el scope léxico del script, no en el objeto global del sandbox:
  // sin esta línea de salida, sandbox.LANG sale undefined.
  vm.runInNewContext(src + "\n;globalThis.LANG=LANG;", sandbox, { filename: "src/modules/01-i18n.js" });
  if (!sandbox.LANG || !sandbox.LANG.es) throw new Error("el sandbox no expuso LANG");
  return sandbox.LANG;
}

/** Claves realmente usadas: t("x") y tf("x",{…}) en todos los módulos menos el propio i18n. */
function usedKeys() {
  const used = new Map(); // clave → fichero donde se vio primero
  for (const f of fs.readdirSync(modulesDir)) {
    if (!f.endsWith(".js") || f === "01-i18n.js") continue;
    const src = fs.readFileSync(path.join(modulesDir, f), "utf8");
    // El `(?=[,)])` deja fuera las claves DINÁMICAS (`tf("bn_"+th,…)`, `t("gm_b_"+id)`): ahí el
    // literal es solo un prefijo y comprobarlo daría un falso positivo eterno.
    for (const m of src.matchAll(/\bt\(\s*"([A-Za-z0-9_]+)"\s*(?=\))/g)) if (!used.has(m[1])) used.set(m[1], f);
    for (const m of src.matchAll(/\btf\(\s*"([A-Za-z0-9_]+)"\s*(?=[,)])/g)) if (!used.has(m[1])) used.set(m[1], f);
    for (const k of branchKeys(src)) if (!used.has(k)) used.set(k, f);
  }
  return used;
}

/** Claves que van como RAMA ENTERA de una expresión: `t(c?"a":"b")`, `tf(x||"a",…)`. El regex de
 *  arriba solo ve el literal pelado, y así se coló «fj_income_tag» en Tus recibos (borrada en una
 *  limpieza, usada dentro de un ternario): la clave cruda en pantalla sin que saltara nada
 *  (auditoría 4.26.218). Se aísla el PRIMER argumento con paréntesis equilibrados y se toma cada
 *  literal que no esté pegado a un `+` (sería un prefijo dinámico) ni sea operando de una
 *  comparación (`k==="income"`). */
function branchKeys(src) {
  const out = [];
  for (const m of src.matchAll(/\btf?\(/g)) {
    let i = m.index + m[0].length, depth = 0, arg = "";
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '"' || c === "'" || c === "`") {
        let j = i + 1;
        while (j < src.length && src[j] !== c) j += src[j] === "\\" ? 2 : 1;
        arg += src.slice(i, j + 1); i = j; continue;
      }
      if (c === "(" || c === "[" || c === "{") depth++;
      else if (c === ")" || c === "]" || c === "}") { if (!depth) break; depth--; }
      else if (c === "," && !depth) break;
      arg += c;
    }
    if (!/[?|]/.test(arg)) continue; // literal pelado o variable: ya lo cubre (o no aplica) lo de arriba
    for (const lm of arg.matchAll(/"([a-z][A-Za-z0-9_]*)"/g)) {
      const before = arg.slice(0, lm.index).trimEnd().slice(-1);
      const after = arg.slice(lm.index + lm[0].length).trimStart()[0] || "";
      if (before && !"?:(|".includes(before)) continue;
      if ("+=!.[".includes(after) && after) continue;
      if (!lm[1].includes("_")) continue; // las claves llevan prefijo_; «income», «es»… son valores
      out.push(lm[1]);
    }
  }
  return out;
}

let failed = 0;
const LANG = loadLang();
const used = usedKeys();
console.log("i18n-keys");

// 1) Toda clave usada existe al menos en castellano (si no, la UI pinta la clave pelada).
const missingEs = [...used].filter(([k]) => LANG.es[k] === undefined);
if (missingEs.length) {
  failed++;
  console.log(`  ✗ ${missingEs.length} clave(s) usadas que NO existen en LANG.es (saldría la clave cruda en pantalla):`);
  for (const [k, f] of missingEs.slice(0, 25)) console.log(`      ${k}  ← ${f}`);
} else {
  console.log(`  ✓ las ${used.size} claves usadas existen en castellano`);
}

// 2) Y existe en los otros dos idiomas (AGENTS.md §4).
for (const lang of ["en", "ca"]) {
  const missing = [...used]
    .filter(([k]) => LANG.es[k] !== undefined && !ONLY_ES.has(k))
    .filter(([k]) => LANG[lang][k] === undefined);
  if (missing.length) {
    failed++;
    console.log(`  ✗ ${missing.length} clave(s) sin traducir en «${lang}» (AGENTS.md §4):`);
    for (const [k, f] of missing.slice(0, 40)) console.log(`      ${k}  ← ${f}`);
  } else {
    console.log(`  ✓ sin huecos en «${lang}»`);
  }
}

// 3) Los placeholders de tf() deben coincidir entre idiomas: si el castellano dice {n} y el
//    inglés {count}, en inglés sale el literal «{count}» sin sustituir.
const phOf = (s) => (String(s).match(/\{[a-zA-Z0-9_]+\}/g) || []).slice().sort().join(",");
const phMismatch = [];
for (const k of Object.keys(LANG.es)) {
  if (typeof LANG.es[k] !== "string") continue;
  const ref = phOf(LANG.es[k]);
  for (const lang of ["en", "ca"]) {
    const v = LANG[lang][k];
    if (typeof v !== "string") continue;
    if (phOf(v) !== ref) phMismatch.push(`${k} [${lang}] es:${ref || "—"} ≠ ${lang}:${phOf(v) || "—"}`);
  }
}
if (phMismatch.length) {
  failed++;
  console.log(`  ✗ ${phMismatch.length} traducción(es) con placeholders distintos que el castellano:`);
  for (const m of phMismatch.slice(0, 30)) console.log("      " + m);
} else {
  console.log("  ✓ los placeholders {x} cuadran en los tres idiomas");
}

console.log(failed ? "\ni18n-keys: FALLA" : "\ni18n-keys: OK");
process.exit(failed ? 1 : 0);
