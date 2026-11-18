#!/usr/bin/env node
/**
 * HUELLA DEL BUNDLE — para no publicar una beta que no cambia nada.
 *
 * POR QUÉ EXISTE (2026-08-01). Cada push a `beta` publicaba una beta nueva y le subía el número,
 * así que su móvil le avisaba de una actualización aunque el commit fuera de documentación. Ese
 * día se le lanzaron OCHO, cinco en una hora, y una era un `docs(memoria)`. Sus palabras: «se
 * bugueó también lo del versionado otra vez, me pide actualizar todo el maldito rato».
 *
 * Y aquí está la trampa que hace falta entender: el aviso NO estaba roto — hacía justo lo que se
 * le pidió. El fallo es que «he hecho un commit» y «ha cambiado la app» no son lo mismo, y el
 * canal daba por hecho que sí. Filtrar por RUTAS (docs/**, tests/**…) parece la solución obvia y
 * es frágil: se olvida una carpeta y vuelve el problema, o se toca `src/` sin que el resultado
 * cambie ni un byte. Así que se compara EL RESULTADO: si el bundle compilado es idéntico al
 * publicado, no hay nada que ofrecer.
 *
 * La huella se calcula sobre TODO `public/`, con dos cosas normalizadas para que no ensucien:
 *   · `APP_VERSION: "…"` en index.html — es el sello, cambia en cada compilación por definición;
 *   · `const VERSION = "…"` en sw.js — lo mismo, lo pone `stamp-version.mjs`;
 *   · las `'sha256-…'` de la CSP sellada, que dependen del sello de arriba.
 * Sin normalizarlas, la huella cambiaría siempre y esto no serviría de nada.
 *
 * Uso:  node scripts/huella-bundle.mjs        → imprime la huella (sha256, 16 hex)
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const RAIZ = path.join(process.cwd(), "public");

/* Orden alfabético estable: el mismo árbol tiene que dar la misma huella en cualquier máquina y
   en cualquier sistema de ficheros (el orden de `readdir` no está garantizado). */
function ficheros(dir, base = "") {
  const out = [];
  for (const nombre of readdirSync(dir).sort()) {
    const abs = path.join(dir, nombre);
    const rel = base ? base + "/" + nombre : nombre;
    if (statSync(abs).isDirectory()) out.push(...ficheros(abs, rel));
    else out.push([rel, abs]);
  }
  return out;
}

function contenidoNormalizado(rel, abs) {
  const bin = readFileSync(abs);
  if (rel !== "index.html" && rel !== "sw.js") return bin;
  return Buffer.from(
    bin.toString("utf8")
      .replace(/APP_VERSION: *"[^"]*"/g, 'APP_VERSION:"<sello>"')
      .replace(/const VERSION = "[^"]*";/g, 'const VERSION = "<sello>";')
      // Las huellas de la CSP sellada (`csp-sellar.mjs`) cubren el script que lleva el sello de
      // versión, así que cambian con él. Lo que tapan ya entra en la huella por el propio script.
      .replace(/'sha256-[A-Za-z0-9+/=]+'/g, "'sha256-<sello>'"),
    "utf8",
  );
}

export function huellaBundle() {
  const h = createHash("sha256");
  for (const [rel, abs] of ficheros(RAIZ)) {
    h.update(rel);            // la RUTA entra en la huella: renombrar un fichero es un cambio
    h.update("\0");
    h.update(contenidoNormalizado(rel, abs));
    h.update("\0");
  }
  return h.digest("hex").slice(0, 16);
}

/* `pathToFileURL` y no plantillas a mano: en Windows la ruta lleva letra de unidad y ESPACIOS
   («E:\Mi cartera\…»), así que `file://` + argv[1] nunca casaba con `import.meta.url`
   —file:///E:/Mi%20cartera/…— y el script se ejecutaba SIN IMPRIMIR NADA. */
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdout.write(huellaBundle() + "\n");
}
