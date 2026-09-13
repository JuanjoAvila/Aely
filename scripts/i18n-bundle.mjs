/**
 * A/B de idiomas (4.19.103): LANG.en / LANG.ca salen del bundle a public/i18n/*.json.
 * La fuente (01-i18n.js) sigue con los tres idiomas para editar y para i18n-keys;
 * el build los vacía del JS inyectado y escribe los JSON. es se queda en el bundle
 * (idioma por defecto + fallback de t()).
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** Índice del `}` que cierra el `{` en `openIdx`, respetando strings. */
export function skipBalanced(src, openIdx) {
  if (src[openIdx] !== "{") throw new Error("skipBalanced: se esperaba { en " + openIdx);
  let depth = 0;
  let inStr = null;
  let esc = false;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error("skipBalanced: llaves sin cerrar desde " + openIdx);
}

/** Carga LANG ejecutando 01-i18n.js en sandbox (mismo truco que i18n-keys). */
export function loadLangFromSource(i18nSrc) {
  const sandbox = {
    console, Intl, Math, Date, JSON, Object, Array, String, Number, RegExp,
    NF: new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    DISP: { sym: "€", k: 1 },
    SIMPLEMODE: false,
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(i18nSrc + "\n;globalThis.LANG=LANG;", sandbox, { filename: "01-i18n.js" });
  if (!sandbox.LANG || !sandbox.LANG.es || !sandbox.LANG.en || !sandbox.LANG.ca) {
    throw new Error("i18n-bundle: el sandbox no expuso LANG.es/en/ca");
  }
  return sandbox.LANG;
}

/**
 * Dentro de `const LANG = { … }`, sustituye la propiedad `en`/`ca` por `{}`.
 * No toca LANG_SIMPLE ni MON_I18N (diccionarios pequeños que se quedan en el bundle).
 */
export function vaciarPropLang(js, lang) {
  const decl = js.indexOf("const LANG = {");
  if (decl < 0) throw new Error("i18n-bundle: no encuentro const LANG = {");
  const open = js.indexOf("{", decl);
  const close = skipBalanced(js, open);
  const inner = js.slice(open + 1, close);
  const re = new RegExp("(?:^|\\n)(  " + lang + ":)\\{");
  const m = re.exec(inner);
  if (!m) throw new Error("i18n-bundle: no encuentro propiedad " + lang + " en LANG");
  const propOpenInInner = m.index + m[0].lastIndexOf("{");
  const propOpen = open + 1 + propOpenInInner;
  const propClose = skipBalanced(js, propOpen);
  // Conserva la coma que sigue si la hay (ca es la última y suele llevar coma antes del cierre).
  return js.slice(0, propOpen) + "{}" + js.slice(propClose + 1);
}

/** Quita todos los `Object.assign(LANG.en|ca, {…});` del JS ensamblado. */
export function quitarAssignsLang(js, lang) {
  const needle = "Object.assign(LANG." + lang + ",";
  let out = "";
  let i = 0;
  while (true) {
    const at = js.indexOf(needle, i);
    if (at < 0) { out += js.slice(i); break; }
    out += js.slice(i, at);
    let j = at + needle.length;
    while (j < js.length && /\s/.test(js[j])) j++;
    if (js[j] !== "{") throw new Error("i18n-bundle: Object.assign(LANG." + lang + ") sin {");
    j = skipBalanced(js, j) + 1;
    while (j < js.length && /\s/.test(js[j])) j++;
    if (js[j] === ")") j++;
    while (j < js.length && /\s/.test(js[j])) j++;
    if (js[j] === ";") j++;
    // Si tras borrar queda una línea en blanco de más, no importa.
    i = j;
  }
  return out;
}

/** Extrae en/ca a disco y devuelve el JS sin esos diccionarios. */
export function extraerIdiomasDelBundle(js, opts) {
  const i18nPath = path.join(root, "src", "modules", "01-i18n.js");
  const i18nSrc = fs.readFileSync(i18nPath, "utf8");
  const LANG = loadLangFromSource(i18nSrc);
  const outDir = (opts && opts.outDir) || path.join(root, "public", "i18n");
  fs.mkdirSync(outDir, { recursive: true });
  for (const lang of ["en", "ca"]) {
    const file = path.join(outDir, lang + ".json");
    fs.writeFileSync(file, JSON.stringify(LANG[lang]));
  }
  let next = js;
  for (const lang of ["en", "ca"]) {
    next = vaciarPropLang(next, lang);
    next = quitarAssignsLang(next, lang);
  }
  return {
    js: next,
    counts: {
      en: Object.keys(LANG.en).length,
      ca: Object.keys(LANG.ca).length,
      es: Object.keys(LANG.es).length,
    },
    outDir,
  };
}
