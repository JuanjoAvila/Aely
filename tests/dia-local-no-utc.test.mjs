#!/usr/bin/env node
/**
 * EL MISMO DÍA NO PUEDE SALIR DOS VECES COMO CABECERA.
 *
 * Lo vi en una captura suya del 11/9 sin que él lo reportara: en Gastos salía «DOMINGO, 6 SEPT» y
 * justo debajo, otra vez, «DOMINGO, 6 SEPT».
 *
 * Causa: `dayKey` agrupaba en **UTC** (`toISOString().slice(0,10)`) mientras la etiqueta de la
 * cabecera sale de `toLocaleDateString`, o sea la hora del móvil. En España (UTC+2 en verano)
 * cualquier gasto entre las 00:00 y las 02:00 cae en el día UTC ANTERIOR: se abre un grupo con la
 * clave del día 5 pero etiquetado «6 sept», y otro con la clave del 6 etiquetado igual.
 *
 * Medido en Europe/Madrid ANTES de tocar nada:
 *   06/09 01:00 local → clave 2026-09-05 · etiqueta «domingo, 6 sept»   ← el que parte el día
 *   06/09 12:00 local → clave 2026-09-06 · etiqueta «domingo, 6 sept»
 *   07/09 00:30 local → clave 2026-09-06 · etiqueta «lunes, 7 sept»     ← y este se cuela en el 6
 *
 * Y no era solo cosmético: «Hoy» y «Ayer» salen de comparar esa misma clave, así que entre
 * medianoche y las dos de la mañana lo de hoy se etiquetaba como AYER.
 *
 * Es el mismo fallo que ya se arregló para el mes (`inicioDeMesMs`, B09-B, 7/9): la app vive en la
 * hora del móvil, no en UTC. Este test fija el huso a propósito — sin `TZ`, en una máquina en UTC
 * el bug es invisible y el test se queda verde mintiendo.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/* Se relanza a sí mismo con TZ=Europe/Madrid, que es donde vive la familia. Node solo lee TZ al
   arrancar, así que no vale con ponerlo aquí dentro. */
if (process.env.MC_TZ_OK !== "1") {
  const out = execFileSync(process.execPath, [fileURLToPath(import.meta.url)], {
    env: { ...process.env, TZ: "Europe/Madrid", MC_TZ_OK: "1" },
    encoding: "utf8",
  });
  process.stdout.write(out);
  process.exit(0);
}

const { loadPureLogicFromFile } = await import("../scripts/load-pure-logic.mjs");
const cli = loadPureLogicFromFile();

let fallos = 0;
const t = (nombre, fn) => {
  try { fn(); console.log(`  ✓ ${nombre}`); }
  catch (e) { fallos++; console.error(`  ✗ ${nombre}\n      ${e.message}`); }
};

console.log("el día se agrupa en hora local, no en UTC  (TZ=" + Intl.DateTimeFormat().resolvedOptions().timeZone + ")");

/* LA CLAVE REAL DE LA APP, SACADA DEL MÓDULO. Nada de reescribirla aquí.
   ⚠ La primera versión de este test hacía justo eso —una copia local «por si no está expuesta»— y
   al volver a meter el fallo a mano **los cuatro casos de conducta siguieron en verde**: estaban
   probando mi copia, no la app. Solo cantó el guardián de fuente. Un test que no puede fallar no
   vale, y este lo demostró en la misma sesión en que se escribió.
   `dayKey` no está en el sandbox de `load-pure-logic` (es un `const` de módulo, no una función
   exportada), así que se lee su línea del fichero y se evalúa. Si alguien la cambia, cambia lo que
   este test mide — que es justo lo que se quiere. */
const fuente = readFileSync(new URL("../src/modules/01-i18n.js", import.meta.url), "utf8");
const lineaDayKey = (() => {
  const i = fuente.indexOf("const dayKey=");
  if (i === -1) throw new Error("no encuentro `const dayKey=` en 01-i18n.js");
  return fuente.slice(i, fuente.indexOf("\n", i));
})();
// eslint-disable-next-line no-new-func
const dayKey = new Function(lineaDayKey + " return dayKey;")();

const etiqueta = (d) => d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" });

t("★ dos gastos del mismo día local comparten clave, aunque uno sea de madrugada", () => {
  const madrugada = new Date("2026-09-06T01:00:00+02:00");
  const mediodia = new Date("2026-09-06T12:00:00+02:00");
  const noche = new Date("2026-09-06T23:30:00+02:00");
  assert.equal(dayKey(madrugada), dayKey(mediodia),
    "el de la 1 de la mañana abría un grupo aparte con la misma etiqueta: el día salía DOS veces");
  assert.equal(dayKey(noche), dayKey(mediodia));
});

t("y uno de la madrugada siguiente NO se cuela en el día anterior", () => {
  const finDelSeis = new Date("2026-09-06T23:30:00+02:00");
  const inicioDelSiete = new Date("2026-09-07T00:30:00+02:00");
  assert.notEqual(dayKey(finDelSeis), dayKey(inicioDelSiete),
    "el de las 00:30 del día 7 caía dentro del grupo del día 6");
});

t("★ la clave y la etiqueta hablan del MISMO día (que es de lo que iba el bug)", () => {
  /* Recorre las 24 horas de un día: para cada una, la clave tiene que corresponder al día que
     enseña la etiqueta. Así no depende de qué horas se me hayan ocurrido. */
  const malos = [];
  for (let h = 0; h < 24; h++) {
    const d = new Date(2026, 8, 6, h, 30, 0);      // 6 de septiembre, hora local
    if (dayKey(d) !== "2026-09-06") malos.push(`${h}:30 → clave ${dayKey(d)} · etiqueta «${etiqueta(d)}»`);
  }
  assert.deepEqual(malos, []);
});

t("«Hoy» sigue siendo hoy a las 00:30 (y no ayer)", () => {
  /* El otro lado del mismo fallo: `relDay` decide «Hoy»/«Ayer» comparando esta clave. De 00:00 a
     02:00 en España, lo de hoy tenía la clave de ayer. */
  const ahora = new Date();
  const medianocheHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 0, 30, 0);
  assert.equal(dayKey(medianocheHoy), dayKey(ahora),
    "a las 00:30 de hoy, la clave tiene que ser la de hoy");
});

t("el módulo sigue calculando la clave en local (no ha vuelto a toISOString)", () => {
  const txt = readFileSync(new URL("../src/modules/01-i18n.js", import.meta.url), "utf8");
  const i = txt.indexOf("const dayKey=");
  assert.notEqual(i, -1, "no encuentro dayKey en 01-i18n.js");
  const linea = txt.slice(i, txt.indexOf("\n", i));
  assert.ok(!/toISOString/.test(linea),
    "dayKey ha vuelto a UTC: el mismo día volverá a salir dos veces como cabecera");
});

if (fallos) { console.error(`\ndia-local-no-utc: ${fallos} fallo(s)`); process.exit(1); }
console.log("\ndia-local-no-utc: OK");
