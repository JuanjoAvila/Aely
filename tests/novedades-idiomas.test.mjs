#!/usr/bin/env node
/**
 * NOVEDADES TIENE QUE ESTAR EN LOS TRES IDIOMAS.
 *
 * Petición suya del 2026-07-26, escrita desde la app y sin atender hasta hoy:
 * «que el histórico de actualizaciones / mensaje sea en todos los idiomas, no solo español».
 *
 * Novedades la lee TODA LA FAMILIA, no solo él. Una versión sin `items` cae a los puntos de sus
 * tandas, que son un array plano en castellano, y entonces `rnItems(nota, "en")` devuelve el
 * mismo texto español para inglés y catalán. Pasaba con la 4.18.5 y era la única del bundle.
 *
 * No comprueba que la traducción sea BUENA —eso no lo puede saber un test— sino que exista y no
 * sea el castellano copiado. Mira las N más nuevas del JSON (RELEASE_NOTES_MAX): el resto del
 * histórico también viaja en release-notes.json y se pide al abrir Novedades.
 */
import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const cli = loadPureLogicFromFile();
let failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.error(`  ✗ ${name}\n      ${e.message}`); }
}

console.log("novedades-idiomas");

const NOTAS = cli.RELEASE_NOTES || [];
const MAX = cli.RELEASE_NOTES_MAX || 20;
const ENVIADAS = NOTAS.slice(0, MAX);

t("hay notas que revisar", () => {
  assert.ok(ENVIADAS.length > 0, "RELEASE_NOTES vacío");
});

t("★ ninguna versión del bundle le enseña castellano a un familiar en inglés o catalán", () => {
  const malas = [];
  for (const n of ENVIADAS) {
    const es = JSON.stringify(cli.rnItems(n, "es"));
    if (es === "[]") continue;                     // sin puntos: no hay nada que traducir
    for (const lg of ["en", "ca"]) {
      const otro = JSON.stringify(cli.rnItems(n, lg));
      if (otro === es) malas.push(`${n.v} (${lg})`);
    }
  }
  assert.deepEqual(malas, [],
    "estas versiones pintan el texto castellano en otro idioma; dales `items` en es/en/ca");
});

t("y ninguna se queda sin puntos en un idioma teniéndolos en otro", () => {
  const malas = [];
  for (const n of ENVIADAS) {
    const largos = ["es", "en", "ca"].map((lg) => cli.rnItems(n, lg).length);
    if (largos.some((x) => x > 0) && largos.some((x) => x === 0)) malas.push(n.v);
  }
  assert.deepEqual(malas, [], "versiones con puntos en un idioma y vacías en otro");
});

t("el título de la versión también va traducido", () => {
  const malas = [];
  for (const n of ENVIADAS) {
    if (!n.t || typeof n.t !== "object") continue;   // legacy: título plano, no es este test
    for (const lg of ["en", "ca"]) {
      if (n.t[lg] && n.t.es && n.t[lg] === n.t.es) malas.push(`${n.v} (${lg})`);
    }
  }
  assert.deepEqual(malas, [], "títulos copiados del castellano");
});

console.log(failed ? `\n${failed} fallo(s)` : "\nnovedades-idiomas: OK");
process.exit(failed ? 1 : 0);
