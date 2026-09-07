/**
 * NINGUNA VERSIÓN SALE MUDA EN NOVEDADES (2026-09-07).
 *
 * El popup de Novedades pinta `rnItems(version)` (10-app-components.js). Cuando una versión
 * declaraba `tandas` y se olvidaba de los `items` de primer nivel, `rnItems` devolvía `[]` y la
 * familia veía el título de la versión y NADA debajo. Le pasó a la 4.18.5 — una sola de 90, y no
 * se detectó a ojo sino evaluando la lista entera.
 *
 * Este test evalúa el RELEASE_NOTES de verdad (no lo lee con expresiones regulares: la primera
 * medida que hice así dio 68 falsos positivos porque las versiones viejas ponen `items:[` en la
 * misma línea) y exige que cada versión dé al menos un punto en los tres idiomas.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = join(dirname(dirname(fileURLToPath(import.meta.url))), "");
const src = readFileSync(join(root, "src/modules/10-app-components.js"), "utf8");

/* Recorta el literal del array y lo evalúa: es la MISMA fuente que se sirve, no una copia. */
const decl = src.search(/(?:const|var)\s+RELEASE_NOTES\s*=\s*\[/);
assert.ok(decl >= 0, "no se encuentra RELEASE_NOTES en 10-app-components.js");
const from = src.indexOf("[", decl);
let hondura = 0, fin = -1;
for (let i = from; i < src.length; i++) {
  if (src[i] === "[") hondura++;
  else if (src[i] === "]" && --hondura === 0) { fin = i + 1; break; }
}
assert.ok(fin > from, "no se encuentra el cierre del array RELEASE_NOTES");
const NOTAS = eval(src.slice(from, fin));

/* La rnItems DE VERDAD, sacada de la fuente. Reescribirla aquí sería un test que se queda verde
   aunque alguien rompa el renderizador: comprobaría mi copia, no la app. */
const iFn = src.indexOf("function rnItems(");
assert.ok(iFn >= 0, "no se encuentra la función rnItems (¿la han renombrado?)");
let llaves = 0, finFn = -1;
for (let i = src.indexOf("{", iFn); i < src.length; i++) {
  if (src[i] === "{") llaves++;
  else if (src[i] === "}" && --llaves === 0) { finFn = i + 1; break; }
}
assert.ok(finFn > iFn, "no se encuentra el cierre de rnItems");
const CURLANG = "es";
// Se evalúa CON su nombre: rnItems se llama a sí misma para aplanar tandas.
const items = eval(src.slice(iFn, finFn) + ";\nrnItems;");

console.log("novedades-vinnetas");
assert.ok(NOTAS.length > 50, `esperaba el histórico entero, hay ${NOTAS.length}`);

let fallos = 0;
for (const lg of ["es", "en", "ca"]) {
  const mudas = NOTAS.filter((r) => items(r, lg).length === 0).map((r) => r.v);
  if (mudas.length) { fallos++; console.log(`  ✕ ${lg}: sin viñetas en ${mudas.join(", ")}`); }
  else console.log(`  ✓ ${lg}: las ${NOTAS.length} versiones tienen al menos un punto`);
}
assert.equal(fallos, 0, "hay versiones que se pintarían sin una sola viñeta en Novedades");

/* El caso concreto que lo destapó, clavado para que no vuelva por otra vía. */
const v4185 = NOTAS.find((r) => r.v === "4.18.5");
assert.ok(v4185, "falta la 4.18.5 en el histórico");
assert.ok(items(v4185, "es").length >= 1, "la 4.18.5 vuelve a salir muda");

console.log("  ok");
