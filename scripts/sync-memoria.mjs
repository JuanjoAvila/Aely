/* Espeja la memoria del agente en `docs/memoria/`, para que TODO lo que sabe una sesión esté
 * también en el repo. Nació el 26/7/2026, después de que una sesión del móvil se gastara medio
 * presupuesto de tokens investigando sobre una rama equivocada: lo que hacía falta para no
 * hacerlo estaba escrito, sí, pero en la memoria local del Claude del PC. Desde el móvil, desde
 * Cursor o desde otra IA, eso no existe.
 *
 * ⚠ EL REPO ES PÚBLICO (GitHub Pages gratis lo exige). Así que esto NO es un copiar y pegar:
 * cada fichero pasa por un filtro que tacha lo que no puede salir de casa (IBAN, correos,
 * teléfonos, rutas de Windows e importes reconocibles). Y si al terminar QUEDA algo que encaja con un
 * patrón sensible, el script ABORTA en vez de publicar: más vale no sincronizar que filtrar.
 *
 * Uso:  npm run memoria        (y `npm run memoria -- --check` para ver si hay deriva, sin escribir)
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ORIGEN = process.env.AELY_MEMORY_SOURCE || path.join(os.homedir(), ".claude", "projects", "E--Mi-cartera", "memory");
const DESTINO = path.join(process.cwd(), "docs", "memoria");
const CHECK = process.argv.includes("--check");

// Las cifras sin contexto pueden ser versiones, tamaños o tiempos: no son importes por sí solas.
const NUMERO = "[+−±-]?\\s*\\d+(?:[.,'’]\\d+|[ \\u00a0]\\d{3})*(?!\\d|[.,]\\d)";
const MONEDA = "(?:€|\\$|£|EUR\\b|USD\\b|GBP\\b|CHF\\b|JPY\\b|CAD\\b|AUD\\b|euros?\\b|dólares?\\b|libras?\\b)";
const DINERO = new RegExp("(?:" + MONEDA + "\\s*" + NUMERO + "|" + NUMERO + "\\s*" + MONEDA + ")", "gi");
const ETIQUETA = "(?:gastado|gastos?|saldo|presupuesto|importe|comisi[oó]n|ingresos?|ahorro|cuota|deuda|patrimonio|beneficio|p[eé]rdidas?|inversi[oó]n|pagado|cobrado|coste|precio|restante|disponible|n[oó]minas?|movimientos?|cargos?|retiradas?)";
const TECNICO = "(?:[KMGT]?i?B|bytes?|px|ms|segundos?|tests?|ficheros?)\\b";
const CIFRA = NUMERO + "(?!\\s*" + TECNICO + ")";
const CONTEXTO = new RegExp("(\\b" + ETIQUETA + "\\b[ \\t:*_=]*)" + CIFRA + "(?:\\s*(?:→|->|⇒|a)\\s*" + CIFRA + ")*", "gi");
function importes(txt) {
  return txt.split("\n").map(function(linea) {
    const financiero = new RegExp("\\b" + ETIQUETA + "\\b", "i").test(linea) || new RegExp(MONEDA, "i").test(linea);
    linea = linea.replace(DINERO, "<importe>").replace(CONTEXTO, "$1<importe>");
    // Un delta con signo en la misma frase permite reconstruir el importe tachado.
    if (financiero) linea = linea.replace(new RegExp("(?<![\\w.,])(?:[+−±-]\\s*)" + CIFRA, "g"), "<importe>");
    return linea;
  }).join("\n");
}
function rutas(txt) {
  // Desde docs/memoria el enlace público sigue siendo útil, sin revelar el checkout del PC.
  txt = txt.replace(/(\[[^\]\n]*\]\()\s*<?(?:\.\.[\\/])*(?:file:\/\/\/)?([a-z]:[\\/][^)\n>]+)>?(\))/gi, function(_, abre, local, cierra) {
    const normal = local.replace(/\\/g, "/").trim();
    const docs = normal.match(/\/docs\/([^?#]+)([?#].*)?$/i);
    const relativo = docs && !docs[1].split("/").includes("..") ? "../" + docs[1] + (docs[2] || "") : "<ruta-local>";
    return abre + (relativo.includes(" ") ? "<" + relativo + ">" : relativo) + cierra;
  });
  return txt.replace(/(?:file:\/\/\/)?\b[a-z]:[\\/][^\r\n`"'<>()[\]]*/gi, "<ruta-local>")
    .replace(/\\\\[^\s\\]+\\[^\r\n`"'<>()[\]]*/g, "<ruta-local>");
}
/* Lo que se tacha, y por qué. El orden importa: lo más específico primero. */
const FILTROS = [
  [/^[ \t]*originSessionId\s*:[^\r\n]*(?:\r?\n|$)/gmi, "", "sesión local"],
  [/\bES\d{22}\b/g, "ES·· ···· ···· ···· ···· ····", "IBAN"],
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "···@···", "correo"],
  [/\+34\s?\d{9}\b/g, "+34 ··· ··· ···", "teléfono"],
];
/* Red de seguridad: si algo de esto sobrevive al filtro, no se publica nada. */
const PROHIBIDO = [
  [/^[ \t]*originSessionId\s*:/mi, "metadatos de sesión local"],
  [/\bES\d{22}\b/, "un IBAN"],
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/, "un correo"],
  [/\bES(?:[ -]*\d){22}\b/, "un IBAN separado"],
  [/\b[a-z]:[\\/]|\\\\[^\s\\]+\\/i, "una ruta absoluta de Windows"],
  [new RegExp("(?:" + MONEDA + "\\s*" + NUMERO + "|" + NUMERO + "\\s*" + MONEDA + ")", "i"), "un importe con moneda"],
  [new RegExp("\\b" + ETIQUETA + "\\b[ \\t:*_=]*" + CIFRA, "i"), "un importe con contexto financiero"],
  [new RegExp("\\b" + ETIQUETA + "\\b[^\\r\\n]*(?<![\\w.,])[+−±-]\\s*" + CIFRA, "i"), "una variación con contexto financiero"],
];

const CABECERA = (nombre) => `<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (${nombre}). Se regenera con \`npm run memoria\`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

`;

if (!fs.existsSync(ORIGEN)) {
  console.log("sync-memoria: no hay memoria local en " + ORIGEN + " — nada que espejar.");
  process.exit(0);
}

const ficheros = fs.readdirSync(ORIGEN).filter((f) => f.endsWith(".md")).sort();
let tachados = 0, escritos = 0, deriva = [];
const preparados = [];

for (const f of ficheros) {
  let txt = fs.readFileSync(path.join(ORIGEN, f), "utf8");
  for (const [re, por, que] of FILTROS) {
    const antes = txt;
    txt = txt.replace(re, por);
    if (txt !== antes) { tachados++; if (!CHECK) console.log(`  · ${f}: tachado ${que}`); }
  }
  for (const [filtro, que] of [[rutas, "ruta de Windows"], [importes, "importe"]]) {
    const antes = txt;
    txt = filtro(txt);
    if (txt !== antes) { tachados++; if (!CHECK) console.log(`  · ${f}: tachado ${que}`); }
  }
  const nuevo = CABECERA(f) + txt;
  for (const [re, que] of PROHIBIDO) {
    if (re.test(nuevo)) {
      console.error(`\n✕ sync-memoria ABORTA: en ${f} sigue habiendo ${que} después del filtro.`);
      console.error("  Arréglalo en el filtro o en la memoria antes de sincronizar. NO se ha escrito nada.");
      process.exit(1);
    }
  }
  const salida = path.join(DESTINO, f);
  const previo = fs.existsSync(salida) ? fs.readFileSync(salida, "utf8") : null;
  /* Comparar SIN los \r (2026-09-10). El espejo se escribe con LF, pero Git en Windows lo saca
     con CRLF al hacer checkout, así que en un worktree recién creado los 46 ficheros salían
     «desfasados» y `memoria-espejo` era ROJO sin que nadie hubiera tocado la memoria: el mismo
     commit daba verde en el checkout principal (escrito por este script) y rojo en el worktree.
     Un guardián que se pone rojo solo por dónde estás trabajando enseña a ignorar los rojos, que
     es peor que no tenerlo. Se compara el contenido; el salto de línea no es contenido.
     Escribir se sigue escribiendo con LF, sin tocar. */
  const mismo = (a, b) => a !== null && a.replace(/\r\n/g, "\n") === b.replace(/\r\n/g, "\n");
  if (!mismo(previo, nuevo)) {
    deriva.push(f);
    preparados.push({ salida, nuevo });
  }
}
// Ninguna escritura ni borrado precede a la validación del último documento (PR134).
const sobrantes = fs.existsSync(DESTINO) ? fs.readdirSync(DESTINO).filter((f) => f.endsWith(".md") && !ficheros.includes(f)) : [];
// Un fichero borrado de la memoria también se va del espejo: si no, el repo miente hacia arriba.
for (const f of sobrantes) deriva.push(f + " (sobra)");

if (CHECK) {
  if (deriva.length) { console.error("✕ el espejo de la memoria está desfasado: " + deriva.join(", ") + "\n  Ejecuta `npm run memoria`."); process.exit(1); }
  console.log("✓ docs/memoria/ al día (" + ficheros.length + " ficheros)");
} else {
  fs.mkdirSync(DESTINO, { recursive: true });
  for (const { salida, nuevo } of preparados) { fs.writeFileSync(salida, nuevo); escritos++; }
  for (const f of sobrantes) { fs.unlinkSync(path.join(DESTINO, f)); escritos++; }
  console.log(`✅ docs/memoria/: ${ficheros.length} ficheros, ${escritos} actualizados, ${tachados} tachones de datos personales.`);
}
