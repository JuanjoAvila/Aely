/* Espeja la memoria del agente en `docs/memoria/`, para que TODO lo que sabe una sesión esté
 * también en el repo. Nació el 26/7/2026, después de que una sesión del móvil se gastara medio
 * presupuesto de tokens investigando sobre una rama equivocada: lo que hacía falta para no
 * hacerlo estaba escrito, sí, pero en la memoria local del Claude del PC. Desde el móvil, desde
 * Cursor o desde otra IA, eso no existe.
 *
 * ⚠ EL REPO ES PÚBLICO (GitHub Pages gratis lo exige). Así que esto NO es un copiar y pegar:
 * cada fichero pasa por un filtro que tacha lo que no puede salir de casa (IBAN, correos,
 * teléfonos, rutas con el usuario de Windows). Y si al terminar QUEDA algo que encaja con un
 * patrón sensible, el script ABORTA en vez de publicar: más vale no sincronizar que filtrar.
 *
 * Uso:  npm run memoria        (y `npm run memoria -- --check` para ver si hay deriva, sin escribir)
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ORIGEN = path.join(os.homedir(), ".claude", "projects", "E--Mi-cartera", "memory");
const DESTINO = path.join(process.cwd(), "docs", "memoria");
const CHECK = process.argv.includes("--check");

/* Lo que se tacha, y por qué. El orden importa: lo más específico primero. */
const FILTROS = [
  [/\bES\d{22}\b/g, "ES·· ···· ···· ···· ···· ····", "IBAN"],
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "···@···", "correo"],
  [/\+34\s?\d{9}\b/g, "+34 ··· ··· ···", "teléfono"],
  [new RegExp("C:/Users/" + "[A-Za-z0-9._-]+", "g"), "C:/Users/<usuario>", "ruta de Windows"],
  [new RegExp("C:\\\\Users\\\\" + "[A-Za-z0-9._-]+", "g"), "C:\\\\Users\\\\<usuario>", "ruta de Windows"],
];
/* Red de seguridad: si algo de esto sobrevive al filtro, no se publica nada. */
const PROHIBIDO = [
  [/\bES\d{22}\b/, "un IBAN"],
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/, "un correo"],
];

const CABECERA = (nombre) => `<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (${nombre}). Se regenera con \`npm run memoria\`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

`;

if (!fs.existsSync(ORIGEN)) {
  console.log("sync-memoria: no hay memoria local en " + ORIGEN + " — nada que espejar.");
  process.exit(0);
}

fs.mkdirSync(DESTINO, { recursive: true });
const ficheros = fs.readdirSync(ORIGEN).filter((f) => f.endsWith(".md"));
let tachados = 0, escritos = 0, deriva = [];

for (const f of ficheros) {
  let txt = fs.readFileSync(path.join(ORIGEN, f), "utf8");
  for (const [re, por, que] of FILTROS) {
    const antes = txt;
    txt = txt.replace(re, por);
    if (txt !== antes) { tachados++; if (!CHECK) console.log(`  · ${f}: tachado ${que}`); }
  }
  for (const [re, que] of PROHIBIDO) {
    if (re.test(txt)) {
      console.error(`\n✕ sync-memoria ABORTA: en ${f} sigue habiendo ${que} después del filtro.`);
      console.error("  Arréglalo en el filtro o en la memoria antes de sincronizar. NO se ha escrito nada.");
      process.exit(1);
    }
  }
  const salida = path.join(DESTINO, f);
  const previo = fs.existsSync(salida) ? fs.readFileSync(salida, "utf8") : null;
  const nuevo = CABECERA(f) + txt;
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
    if (!CHECK) { fs.writeFileSync(salida, nuevo); escritos++; }
  }
}
// Un fichero borrado de la memoria también se va del espejo: si no, el repo miente hacia arriba.
for (const f of fs.readdirSync(DESTINO).filter((f) => f.endsWith(".md"))) {
  if (!ficheros.includes(f)) { deriva.push(f + " (sobra)"); if (!CHECK) { fs.unlinkSync(path.join(DESTINO, f)); escritos++; } }
}

if (CHECK) {
  if (deriva.length) { console.error("✕ el espejo de la memoria está desfasado: " + deriva.join(", ") + "\n  Ejecuta `npm run memoria`."); process.exit(1); }
  console.log("✓ docs/memoria/ al día (" + ficheros.length + " ficheros)");
} else {
  console.log(`✅ docs/memoria/: ${ficheros.length} ficheros, ${escritos} actualizados, ${tachados} tachones de datos personales.`);
}
