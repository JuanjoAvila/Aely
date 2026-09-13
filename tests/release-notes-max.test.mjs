#!/usr/bin/env node
/**
 * Guardián NOTAS-BUNDLE (2026-09-09):
 * - Las notas viven en src/data/release-notes.json (histórico completo).
 * - El index NO arrastra el histórico (gzip).
 * - RELEASE_NOTES_MAX es tope de UI de Novedades, no del panel de beta.
 * - La ronda tip vs prod sigue teniendo todas las tandas en el JSON.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  RELEASE_NOTES_MAX_ESPERADO,
  leerReleaseNotesMax,
  leerReleaseNotesJson,
  contarReleaseNotesEnJs,
  packReleaseNotesForBundle,
  slimNoteForBeta,
} from "../scripts/release-notes-max.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const mod = fs.readFileSync(path.join(root, "src", "modules", "10-app-components.js"), "utf8");
const built = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const pubJson = path.join(root, "public", "release-notes.json");

console.log("release-notes-max");

const maxSrc = leerReleaseNotesMax(mod);
assert.equal(
  maxSrc,
  RELEASE_NOTES_MAX_ESPERADO,
  "RELEASE_NOTES_MAX debe ser " + RELEASE_NOTES_MAX_ESPERADO +
    " (si lo cambias, cambia también RELEASE_NOTES_MAX_ESPERADO y explica el porqué)"
);

const all = leerReleaseNotesJson();
assert.ok(all.length >= maxSrc, "JSON debe tener al menos N notas (ahora " + all.length + ")");
assert.ok(fs.existsSync(pubJson), "falta public/release-notes.json — corre npm run build");
const pub = JSON.parse(fs.readFileSync(pubJson, "utf8"));
assert.equal(pub.length, all.length, "public/release-notes.json debe ser copia del src/data");

const nBundle = contarReleaseNotesEnJs(built);
assert.ok(
  nBundle <= maxSrc,
  "el index no debe llevar más notas que MAX (tiene " + nBundle + ")"
);
/* Hoy el pack del index va vacío a propósito (gzip <320). Si un día se reinyecta slim, este
   assert sigue valiendo: nunca más el histórico entero dentro del HTML. */
assert.ok(
  nBundle < all.length,
  "el index no debe llevar el histórico entero (" + nBundle + " vs " + all.length + ")"
);

function idsRonda(notes, running, prod) {
  function newer(a, b) {
    const pa = String(a).split(".").map(Number);
    const pb = String(b).split(".").map(Number);
    for (let i = 0; i < 3; i++) {
      const x = pa[i] || 0, y = pb[i] || 0;
      if (x !== y) return x > y;
    }
    return false;
  }
  const base = String(running).split(".").slice(0, 3).join(".");
  const p = String(prod).split(".").slice(0, 3).join(".");
  const round = notes.filter((n) => n && n.v && newer(n.v, p) && !newer(n.v, base));
  const ids = [];
  round.forEach((n) => {
    const tandas = n.tandas;
    if (tandas && tandas.length) {
      tandas.forEach((g) => ids.push(n.v + "/" + g.id));
    } else if (!tandas) {
      ids.push(n.v + "/todo");
    }
  });
  return ids;
}

/* La ronda de verdad: del tip de beta hasta lo que corre producción. Se prueba con la ventana
   REAL (y no con una foto de hace tres días) porque lo que este test defiende es que bajar
   RELEASE_NOTES_MAX no se coma tandas del panel — y eso solo se ve si la ronda es más larga que
   el MAX. Antes se anclaba a «4.19.0 tiene que estar»: el 11/9 se vaciaron sus tandas, porque él
   ya las había juzgado, y el test se puso rojo acusando de regresión a una limpieza correcta. */
const tip = fs.readFileSync(path.join(root, "VERSION"), "utf8").trim();
/* Lo que corre producción. Se actualiza al promocionar (`npm run salud` lo dice); si se queda
   viejo la ronda sale un poco más larga de lo real, que no rompe nada pero miente en el log. */
const prod = "4.19.106";   // 13/9: promocionada la ronda 4.19
const fullIds = idsRonda(all, tip, prod);
/* Recién promocionado no hay ronda: nada por encima de prod. Entonces no hay nada que el MAX pueda
   comerse y las comprobaciones de abajo no aplican. En cuanto beta publique algo, vuelven. */
if (!fullIds.length) console.log("  · sin ronda de beta por encima de producción (" + prod + "): nada que comprobar del panel");
else {
/* Lo que importa: que la ronda llegue MÁS ABAJO que el tope de la UI. Si el pack del index
   volviera a ser la fuente del panel, estas de abajo desaparecerían sin que nadie se entere. */
const masViejaDeLaRonda = fullIds[fullIds.length - 1];
/* 13/9: con el panel limpio (5 tandas) la ronda ya no es más larga que el MAX, pero la más vieja
   sigue estando FUERA de las MAX notas más recientes (4.19.9 con el tip en 4.19.105). Eso prueba lo
   mismo: el panel llega a una nota que el pack del index ya no lleva. */
const verNum = (v) => String(v).split(".").map(Number);
const menor = (a, b) => { const x = verNum(a), y = verNum(b); for (let i = 0; i < 4; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0); } return false; };
const ultimaDentroDelMax = all[maxSrc - 1] && all[maxSrc - 1].v;
/* 13/9 tarde: tras el promote la ronda empieza de cero (4.19.107, una tanda). Una ronda que cabe
   entera dentro de las MAX notas más recientes no tiene nada que el tope pueda comerse, así que
   exigir que «llegue más abajo» la ponía roja sin motivo. Solo se comprueba cuando la ronda sale
   de la ventana del MAX, que es el caso que este test defiende. */
const saleDelMax = fullIds.length > maxSrc || menor(masViejaDeLaRonda.split("/")[0], ultimaDentroDelMax);
if (!saleDelMax) {
  console.log(`  · ronda corta (${fullIds.length}), dentro de las ${maxSrc} notas del bundle: nada que el tope pueda comerse`);
} else {
  console.log(`  ✓ la ronda (${fullIds.length}) sale de la ventana del MAX y se lee del JSON entero`);
}
}
/* Bajar MAX no puede comerse tandas: el pack del index ya no es la fuente del panel. */
const packed = packReleaseNotesForBundle(all, 1, 5);
void packed;
assert.deepEqual(idsRonda(all, tip, prod), fullIds, "el JSON completo conserva la ronda aunque MAX=1");

/* slim solo-castellano: el panel de beta va sin traducir. */
const sample = all.find((n) => n.tandas && n.tandas.length);
if (sample) {
  const s = slimNoteForBeta(sample);
  assert.equal(typeof s.t, "string");
  assert.ok(Array.isArray(s.tandas));
  assert.equal(typeof s.tandas[0].t, "string");
  assert.ok(Array.isArray(s.tandas[0].items));
}

console.log("  ok maxUI=" + maxSrc + " json=" + all.length + " index=" + nBundle + " ronda=" + fullIds.length);
console.log("release-notes-max: OK");
