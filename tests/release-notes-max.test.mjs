#!/usr/bin/env node
/**
 * Guardián del tope de RELEASE_NOTES en el bundle (2026-09-07).
 * - N queda clavado en 20: subir a 60 «por holgura» tiene que romper este test.
 * - La ronda del panel beta no puede perder tandas por el recorte (prod reciente).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  RELEASE_NOTES_MAX_ESPERADO,
  leerReleaseNotesMax,
  truncarReleaseNotesEnJs,
  contarReleaseNotesEnJs,
  extraerLiteralReleaseNotes,
  partirObjetosTop,
} from "../scripts/release-notes-max.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const mod = fs.readFileSync(path.join(root, "src", "modules", "10-app-components.js"), "utf8");
const built = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");

console.log("release-notes-max");

const maxSrc = leerReleaseNotesMax(mod);
assert.equal(
  maxSrc,
  RELEASE_NOTES_MAX_ESPERADO,
  "RELEASE_NOTES_MAX debe ser " + RELEASE_NOTES_MAX_ESPERADO +
    " (si lo subes a 60 a ojo, este test salta a propósito — cambia también RELEASE_NOTES_MAX_ESPERADO y explica por qué en presupuesto-rendimiento)"
);

const nFuente = contarReleaseNotesEnJs(mod);
assert.ok(nFuente >= maxSrc, "la fuente debe tener al menos N notas (ahora " + nFuente + ")");

const nBundle = contarReleaseNotesEnJs(built);
assert.equal(
  nBundle,
  maxSrc,
  "public/index.html debe llevar exactamente N notas tras build (tiene " + nBundle + "; corre npm run build)"
);

/* Ronda viva: tip vs prod reciente. Con el recorte a N, las tandas de esa ronda tienen que
   coincidir con las de la fuente completa — si el tope se comiera una versión de la ronda,
   el panel de beta se quedaría mudo en esa tanda. */
function idsRonda(js, running, prod) {
  const lit = extraerLiteralReleaseNotes(js);
  const objs = partirObjetosTop(js.slice(lit.innerFrom, lit.innerTo));
  // Extraer v:"x.y.z" de cada objeto; filtrar como betaChecklist (mcIsNewer simple).
  function verOf(obj) {
    const m = obj.match(/v:\s*"(\d+\.\d+\.\d+)"/);
    return m ? m[1] : null;
  }
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
  const round = objs.filter((o) => {
    const v = verOf(o);
    return v && newer(v, p) && !newer(v, base);
  });
  const ids = [];
  round.forEach((o) => {
    const v = verOf(o);
    const re = /id:\s*"([^"]+)"/g;
    let m;
    let nTanda = 0;
    while ((m = re.exec(o))) {
      ids.push(v + "/" + m[1]);
      nTanda++;
    }
    if (!nTanda) ids.push(v + "/todo");
  });
  return ids;
}

const tip = "4.19.5";
const prod = "4.18.7";
const fullIds = idsRonda(mod, tip, prod);
const keptJs = truncarReleaseNotesEnJs(mod, maxSrc);
const keptIds = idsRonda(keptJs, tip, prod);
assert.deepEqual(
  keptIds,
  fullIds,
  "con prod=" + prod + " la ronda hasta " + tip + " no puede perder tandas por el recorte a " + maxSrc
);
assert.ok(fullIds.length > 0, "la ronda de prueba tiene que tener tandas");
assert.ok(
  fullIds.some((id) => id.indexOf("4.19.0/") === 0),
  "la ronda incluye 4.19.0 (regresión del panel)"
);

console.log("  ok tope=" + maxSrc + " fuente=" + nFuente + " bundle=" + nBundle + " ronda=" + fullIds.length);
console.log("release-notes-max: OK");
