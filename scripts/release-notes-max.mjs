/**
 * Tope de RELEASE_NOTES en el bundle (2026-09-07).
 * Fuente puede crecer; el build deja solo las N primeras (más nuevas).
 * CHANGELOG.md guarda el histórico entero.
 */
export const RELEASE_NOTES_MAX_ESPERADO = 20;

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

/**
 * Reescribe el JS dejando solo las `max` primeras entradas del array RELEASE_NOTES.
 * Así el bundle no arrastra el histórico entero (el slice en runtime NO basta: el literal sigue).
 */
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

/** Cuenta entradas {v:…} de primer nivel en el literal. */
export function contarReleaseNotesEnJs(js) {
  const lit = extraerLiteralReleaseNotes(js);
  return partirObjetosTop(js.slice(lit.innerFrom, lit.innerTo)).length;
}
