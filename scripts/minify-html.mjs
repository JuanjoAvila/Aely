#!/usr/bin/env node
/**
 * minify-html.mjs — minifica los bloques <script> y <style> INLINE de public/index.html.
 *
 * Se ejecuta SOLO en CI (después de stamp-version.mjs, antes de subir el artefacto a Pages):
 * la fuente que se edita sigue siendo public/index.html legible (ARQUITECTURA.md #2);
 * esto es un paso de empaquetado, igual que el sellado de versión.
 *
 * Seguridad del minificado:
 *  - Solo minifyWhitespace + minifySyntax (NUNCA minifyIdentifiers): no se renombra
 *    ningún símbolo → cero riesgo con los globales del bundle (t, cloud, ENT, …).
 *  - Conserva UTF-8: escapar cada tilde/emoji hincha justo el bloque de traducciones que más
 *    crece. El HTML ya declara UTF-8 y el navegador recibe el mismo texto.
 *  - target es2018 (webviews Android razonables).
 *  - Tras minificar se re-escapa "</script" dentro del JS para no cerrar el tag HTML.
 *
 * Uso: node scripts/minify-html.mjs [--out <fichero>]   (sin --out escribe in-place)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { transform } from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const srcPath = join(root, "public", "index.html");

const outArg = process.argv.indexOf("--out");
const outPath = outArg > -1 ? process.argv[outArg + 1] : srcPath;

const html = readFileSync(srcPath, "utf8");
const before = Buffer.byteLength(html);

async function minifyJs(code) {
  const r = await transform(code, {
    loader: "js",
    minifyWhitespace: true,
    minifySyntax: true,
    minifyIdentifiers: false,   // NO renombrar: la app depende de nombres globales
    charset: "utf8",
    target: "es2018",
  });
  // Un "</script>" literal dentro de un string JS cerraría el tag HTML → re-escapar.
  return r.code.replace(/<\/script/gi, "<\\/script");
}
async function minifyCss(code) {
  const r = await transform(code, { loader: "css", minify: true, charset: "utf8" });
  return r.code;
}

// Procesa secuencialmente bloques y comentarios. Los comentarios HTML no llegan al móvil y,
// además, alguno contiene la palabra `<script>`: si se deja dentro del regex parece una etiqueta.
let out = "";
let i = 0;
const re = /<!--[\s\S]*?-->|<(script|style)([^>]*)>([\s\S]*?)<\/\1>/gi;
let m;
while ((m = re.exec(html)) !== null) {
  const [full, tag, attrs, body] = m;
  out += html.slice(i, m.index);
  i = m.index + full.length;
  if (full.startsWith("<!--")) continue;
  const isExternal = /\bsrc\s*=/i.test(attrs);
  if (isExternal || !body.trim()) { out += full; continue; }
  try {
    const min = tag.toLowerCase() === "style" ? await minifyCss(body) : await minifyJs(body);
    out += `<${tag}${attrs}>${min}</${tag}>`;
  } catch (err) {
    console.error(`⚠️  No se pudo minificar un bloque <${tag}> (se deja sin minificar):`, err.message);
    out += full;
  }
}
out += html.slice(i);

const after = Buffer.byteLength(out);
writeFileSync(outPath, out);
console.log(`✅ index.html minificado: ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB (−${(100 - (after / before) * 100).toFixed(0)}%)${outPath !== srcPath ? " → " + outPath : ""}`);
