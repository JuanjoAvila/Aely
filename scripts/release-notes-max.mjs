/**
 * RELEASE_NOTES: fuente en src/data/release-notes.json.
 * El histórico NO viaja en el JS del OTA (NOTAS-BUNDLE, 2026-09-09).
 * RELEASE_NOTES_MAX = cuántas enseña Novedades de entrada (NO recorta el panel de beta).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const RELEASE_NOTES_MAX_ESPERADO = 20;
/** Cuántas versiones «hacia atrás» con tandas se consideran ronda viva al empaquetar tests. */
export const RELEASE_NOTES_BETA_DEPTH = 25;

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export function releaseNotesJsonPath() {
  return path.join(root, "src", "data", "release-notes.json");
}

export function leerReleaseNotesJson() {
  const p = releaseNotesJsonPath();
  if (!fs.existsSync(p)) throw new Error("falta src/data/release-notes.json");
  const notes = JSON.parse(fs.readFileSync(p, "utf8"));
  if (!Array.isArray(notes) || !notes.length) throw new Error("release-notes.json vacío");
  return notes;
}

/** Parsea `var RELEASE_NOTES_MAX=N` del JS ensamblado. */
export function leerReleaseNotesMax(js) {
  const m = js.match(/var\s+RELEASE_NOTES_MAX\s*=\s*(\d+)\s*;/);
  if (!m) throw new Error("falta var RELEASE_NOTES_MAX=N en el JS");
  return Number(m[1]);
}

/** Extrae el literal `var RELEASE_NOTES=[...]` (asignación + array). */
export function extraerLiteralReleaseNotes(js) {
  const needle = "var RELEASE_NOTES=";
  const i = js.indexOf(needle);
  if (i < 0) throw new Error("no se encontró var RELEASE_NOTES=");
  const start = js.indexOf("[", i);
  if (start < 0) throw new Error("RELEASE_NOTES sin '['");
  let depth = 0, end = -1, inStr = null, esc = false;
  for (let p = start; p < js.length; p++) {
    const c = js[p];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) { end = p; break; }
    }
  }
  if (end < 0) throw new Error("RELEASE_NOTES no cierra el array");
  return { from: i, to: end + 1, text: js.slice(i, end + 1), innerFrom: start + 1, innerTo: end };
}

/** Parte el interior del array en objetos de primer nivel. */
export function partirObjetosTop(inner) {
  const objs = [];
  let depth = 0, inStr = null, esc = false, start = 0;
  for (let p = 0; p < inner.length; p++) {
    const c = inner[p];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
    if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") depth--;
    else if (c === "," && depth === 0) {
      const chunk = inner.slice(start, p).trim();
      if (chunk) objs.push(chunk);
      start = p + 1;
    }
  }
  const last = inner.slice(start).trim();
  if (last) objs.push(last);
  return objs;
}

export function contarReleaseNotesEnJs(js) {
  const lit = extraerLiteralReleaseNotes(js);
  return partirObjetosTop(js.slice(lit.innerFrom, lit.innerTo)).length;
}

/**
 * Slim solo-castellano para el panel de beta (va sin traducir).
 * WhatsNew pide el JSON completo al abrir.
 */
export function slimNoteForBeta(n) {
  const tEs = typeof n.t === "string" ? n.t : (n.t && n.t.es) || "";
  const o = { v: n.v, d: n.d, t: tEs };
  if (n.tandas) {
    o.tandas = n.tandas.map(function (g) {
      return {
        id: g.id,
        t: typeof g.t === "string" ? g.t : (g.t && g.t.es) || "",
        items: Array.isArray(g.items) ? g.items : (g.items && g.items.es) || [],
      };
    });
  } else if (n.items) {
    o.items = Array.isArray(n.items) ? n.items : (n.items.es || []);
  }
  return o;
}

/**
 * Lo que VIAJA en el index: NADA del histórico.
 * Medido 2026-09-09: ni el slim de la ronda 4.19.x cabía bajo 320 KB gzip.
 * public/release-notes.json lleva las 100+ versiones; ensureReleaseNotes() lo carga.
 * max / betaDepth se conservan por si un día el presupuesto da aire y se reinyecta slim.
 */
export function packReleaseNotesForBundle(all, _max, _betaDepth) {
  void all; void _max; void _betaDepth;
  return [];
}

/** Inyecta el array empaquetado en el JS ensamblado (sustituye `var RELEASE_NOTES=…`). */
export function inyectarReleaseNotesEnJs(js, notes) {
  const lit = extraerLiteralReleaseNotes(js);
  const nuevo = "var RELEASE_NOTES=" + JSON.stringify(notes);
  return js.slice(0, lit.from) + nuevo + js.slice(lit.to);
}

/** @deprecated El histórico ya no se trunca: se empaqueta desde JSON. Se mantiene por tests viejos. */
export function truncarReleaseNotesEnJs(js, max) {
  if (!(max > 0)) throw new Error("max inválido");
  const lit = extraerLiteralReleaseNotes(js);
  const inner = js.slice(lit.innerFrom, lit.innerTo);
  const objs = partirObjetosTop(inner);
  if (objs.length <= max) return js;
  const kept = objs.slice(0, max).join(",\n");
  const nuevo = "var RELEASE_NOTES=[\n" + kept + "\n]";
  return js.slice(0, lit.from) + nuevo + js.slice(lit.to);
}
