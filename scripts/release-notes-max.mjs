/**
 * Tope de RELEASE_NOTES en el bundle: la fuente y CHANGELOG guardan el histórico completo.
 */
export const RELEASE_NOTES_MAX_ESPERADO = 20;

export function leerReleaseNotesMax(js) {
  const m = js.match(/var\s+RELEASE_NOTES_MAX\s*=\s*(\d+)\s*;/);
  if (!m) throw new Error("falta var RELEASE_NOTES_MAX=N en el JS");
  return Number(m[1]);
}

export function extraerLiteralReleaseNotes(js) {
  const needle = "var RELEASE_NOTES=";
  const from = js.indexOf(needle);
  if (from < 0) throw new Error("no se encontró var RELEASE_NOTES=");
  const start = js.indexOf("[", from);
  let depth = 0, end = -1, quote = null, escaped = false;
  for (let i = start; i < js.length; i++) {
    const c = js[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "[") depth++;
    else if (c === "]" && --depth === 0) { end = i; break; }
  }
  if (start < 0 || end < 0) throw new Error("RELEASE_NOTES no cierra el array");
  return { from, to: end + 1, innerFrom: start + 1, innerTo: end };
}

export function partirObjetosTop(inner) {
  const out = [];
  let depth = 0, quote = null, escaped = false, start = 0;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") depth--;
    else if (c === "," && depth === 0) {
      const part = inner.slice(start, i).trim();
      if (part) out.push(part);
      start = i + 1;
    }
  }
  const last = inner.slice(start).trim();
  if (last) out.push(last);
  return out;
}

export function contarReleaseNotesEnJs(js) {
  const lit = extraerLiteralReleaseNotes(js);
  return partirObjetosTop(js.slice(lit.innerFrom, lit.innerTo)).length;
}

export function truncarReleaseNotesEnJs(js, max) {
  if (!(max > 0)) throw new Error("max inválido");
  const lit = extraerLiteralReleaseNotes(js);
  const entries = partirObjetosTop(js.slice(lit.innerFrom, lit.innerTo));
  if (entries.length <= max) return js;
  return js.slice(0, lit.from) + "var RELEASE_NOTES=[\n" + entries.slice(0, max).join(",\n") + "\n]" + js.slice(lit.to);
}
