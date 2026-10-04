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

/* LAS TANDAS TAMBIÉN, Y MIRADAS POR DENTRO.
 *
 * Los tests de arriba preguntan a `rnItems`, y `rnItems` cae al castellano cuando falta un idioma
 * (`it[lg]||it.es`): es lo correcto en pantalla, pero convierte un idioma olvidado en un texto que
 * «existe». En las tandas eso no lo cazaba nadie: solo se miran las 20 notas más nuevas y por sus
 * puntos aplanados. Aquí se lee la estructura cruda de TODAS las tandas declaradas, sin pasar por
 * el fallback.
 *
 * Límites, a propósito: no compara los textos entre idiomas (hay títulos legítimamente iguales),
 * no juzga la traducción y no toca lo que `betaChecklist`/`betaTandas` leen en castellano para la
 * huella. Una nota sin `tandas` o con `tandas: []` es histórico válido y se salta.
 */
const IDIOMAS = ["es", "en", "ca"];
const esTexto = (x) => typeof x === "string" && x.trim() !== "";

function huecosTandas(notas) {
  const out = [];
  for (const n of notas) {
    if (!Array.isArray(n.tandas)) continue;
    n.tandas.forEach((g, i) => {
      const donde = `${n.v}/${g && typeof g === "object" && g.id ? g.id : "#" + i}`;
      if (!g || typeof g !== "object" || Array.isArray(g)) { out.push(`${donde}: la tanda no es un objeto`); return; }
      if (!g.t || typeof g.t !== "object") out.push(`${donde}: t no va por idiomas`);
      else for (const lg of IDIOMAS) if (!esTexto(g.t[lg])) out.push(`${donde}: t.${lg} falta o está vacío`);
      if (!g.items || typeof g.items !== "object" || Array.isArray(g.items)) { out.push(`${donde}: items no va por idiomas`); return; }
      const largos = [];
      for (const lg of IDIOMAS) {
        const it = g.items[lg];
        if (!Array.isArray(it) || !it.length) { out.push(`${donde}: items.${lg} falta o está vacío`); continue; }
        largos.push(it.length);
        it.forEach((p, j) => { if (!esTexto(p)) out.push(`${donde}: items.${lg}[${j}] no es un texto`); });
      }
      if (largos.length === IDIOMAS.length && new Set(largos).size > 1) out.push(`${donde}: distinto número de puntos (${largos.join("/")})`);
    });
  }
  return out;
}

const conTandas = NOTAS.filter((n) => Array.isArray(n.tandas) && n.tandas.length);
const totalTandas = conTandas.reduce((s, n) => s + n.tandas.length, 0);

t("hay tandas que revisar", () => {
  assert.ok(totalTandas > 0, "ninguna nota declara tandas: el test no estaría mirando nada");
});

t(`★ las ${totalTandas} tandas llevan título y puntos en es/en/ca, con los mismos puntos`, () => {
  assert.deepEqual(huecosTandas(NOTAS), []);
});

/* Que la comprobación PUEDE fallar. Cada mutante estropea una copia en memoria de la primera
   tanda del histórico (la que haya: no se nombra ninguna) y exige el diagnóstico exacto. */
function mutante(nombre, estropear, esperado) {
  t(`mutante: ${nombre} → se detecta`, () => {
    const copia = JSON.parse(JSON.stringify(conTandas[0]));
    const g = copia.tandas[0];
    const donde = `${copia.v}/${g.id}`;
    estropear(g, copia);
    assert.deepEqual(huecosTandas([copia]), esperado(donde, g));
  });
}

if (conTandas.length) {
  mutante("título sin catalán", (g) => { delete g.t.ca; }, (d) => [`${d}: t.ca falta o está vacío`]);
  mutante("título en blanco en inglés", (g) => { g.t.en = "   "; }, (d) => [`${d}: t.en falta o está vacío`]);
  mutante("título que no es texto", (g) => { g.t.es = 7; }, (d) => [`${d}: t.es falta o está vacío`]);
  mutante("título plano, sin idiomas", (g) => { g.t = g.t.es; }, (d) => [`${d}: t no va por idiomas`]);
  mutante("punto en blanco", (g) => { g.items.en[0] = " "; }, (d) => [`${d}: items.en[0] no es un texto`]);
  mutante("punto que no es texto", (g) => { g.items.ca[0] = { x: 1 }; }, (d) => [`${d}: items.ca[0] no es un texto`]);
  mutante("idioma ausente en los puntos", (g) => { delete g.items.ca; }, (d) => [`${d}: items.ca falta o está vacío`]);
  mutante("lista de puntos vacía", (g) => { g.items.en = []; }, (d) => [`${d}: items.en falta o está vacío`]);
  mutante("puntos planos, sin idiomas", (g) => { g.items = g.items.es; }, (d) => [`${d}: items no va por idiomas`]);
  mutante("un punto más en un idioma", (g) => { g.items.es.push("Punto de más"); },
    (d, g) => [`${d}: distinto número de puntos (${g.items.es.length}/${g.items.en.length}/${g.items.ca.length})`]);

  t("mutante: el fallback de rnItems tapa el idioma que falta, y aun así se detecta", () => {
    const copia = JSON.parse(JSON.stringify(conTandas[0]));
    const g = copia.tandas[0];
    delete g.items.en;
    assert.deepEqual(JSON.stringify(cli.rnItems(g, "en")), JSON.stringify(g.items.es), "rnItems ya no cae al castellano: revisa este mutante");
    assert.deepEqual(huecosTandas([copia]), [`${copia.v}/${g.id}: items.en falta o está vacío`]);
  });

  t("una nota sin tandas o con tandas vacías sigue siendo válida", () => {
    assert.deepEqual(huecosTandas([{ v: "0.0.0" }, { v: "0.0.1", tandas: [] }]), []);
  });
}

console.log(failed ? `\n${failed} fallo(s)` : "\nnovedades-idiomas: OK");
process.exit(failed ? 1 : 0);
