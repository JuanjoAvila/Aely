#!/usr/bin/env node
/** LAS DOS BASES DEL OTA TIENEN QUE DECIR LO MISMO (2026-09-12).

    El 12/9 se renombró el repo a Aely y se actualizó la base de `12-boot.js`. Lo que nadie vio
    es que **GitHub Pages NO redirige la ruta vieja** (git y las releases sí; Pages no), y que el
    bundle de producción y la APK instalada llevaban la ruta antigua COCIDA DENTRO:

        APK 4.19.40 (código 44)  BASE = https://juanjoavila.github.io/Mi-Cartera/   → 404 ese día

    Resultado: su padre y su pareja se quedaron sin poder ver una sola actualización, y él no podía
    volver al canal estable porque el `url` del manifiesto apuntaba a un fichero que ya no existía.
    Se tapó con un repo puente que sirve la ruta vieja; esto es para que no vuelva a pasar.

    Este guardián NO comprueba que las URLs respondan (eso es red, y vive en `npm run salud`):
    comprueba que el JS y el Java **no puedan divergir en silencio**, que es lo que pasó. Cambiar
    una base y olvidar la otra deja a la gente que ya tiene la APK hablando con un sitio muerto,
    y eso no se arregla publicando: se arregla con una APK nueva, móvil por móvil.
    Ver [[ota-no-cambia-contrato-nativo]]. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const boot = fs.readFileSync(path.join(root, "src/modules/12-boot.js"), "utf8");
const java = fs.readFileSync(path.join(root, "android/app/src/main/java/com/micartera/app/OtaCheckWorker.java"), "utf8");

function t(name, fn) {
  try { fn(); console.log("  ✓ " + name); }
  catch (e) { console.error("  ✗ " + name); throw e; }
}
function uno(txt, re, que) {
  const m = txt.match(re);
  assert.ok(m, "no se encuentra " + que + " (¿lo han renombrado? actualiza este guardián, no lo borres)");
  return m[1];
}

console.log("ota-bases-espejo");

const bootStable = uno(boot, /_mcOtaBASE\s*=\s*"([^"]+)"/, "_mcOtaBASE en 12-boot.js");
const bootBeta = uno(boot, /_mcBetaBASE\s*=\s*"([^"]+)"/, "_mcBetaBASE en 12-boot.js");
const javaStable = uno(java, /String\s+BASE\s*=\s*"([^"]+)"/, "BASE en OtaCheckWorker.java");
const javaBeta = uno(java, /String\s+BASE_BETA\s*=\s*"([^"]+)"/, "BASE_BETA en OtaCheckWorker.java");

t("la base de producción es la MISMA en el JS y en el Java", () => {
  assert.equal(javaStable, bootStable,
    `12-boot.js dice ${bootStable} y OtaCheckWorker.java dice ${javaStable}. ` +
    "Cambiar una sola deja a quien ya tiene la APK hablando con un sitio muerto, y eso no se arregla por OTA.");
});

t("la base del canal beta también", () => {
  assert.equal(javaBeta, bootBeta,
    `12-boot.js dice ${bootBeta} y OtaCheckWorker.java dice ${javaBeta}.`);
});

t("las dos acaban en barra (si no, la URL sale pegada al nombre del fichero)", () => {
  for (const [donde, url] of [["_mcOtaBASE", bootStable], ["_mcBetaBASE", bootBeta]]) {
    assert.ok(url.endsWith("/"), donde + " tiene que acabar en «/»: " + url);
  }
});

t("y ninguna apunta ya al nombre viejo del repo", () => {
  // El puente `/Mi-Cartera` existe a propósito para los clientes VIEJOS, pero el código nuevo
  // no debe volver a apuntar ahí: si lo hace, estamos construyendo sobre la tirita.
  for (const [donde, url] of [["_mcOtaBASE", bootStable], ["_mcBetaBASE", bootBeta], ["BASE", javaStable], ["BASE_BETA", javaBeta]]) {
    assert.ok(!/\/Mi-Cartera\//.test(url),
      donde + " apunta al repo viejo (" + url + "). El puente /Mi-Cartera es solo para las APK ya instaladas.");
  }
});

console.log("ota-bases-espejo: OK");
