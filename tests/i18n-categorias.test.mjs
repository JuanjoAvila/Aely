#!/usr/bin/env node
/**
 * El nombre de una categoría se pinta con `catName`, que pide `t("cat_"+id)`: la clave se compone
 * en marcha y `i18n-keys` solo ve literales, así que una categoría sin traducir no la cazaba nadie.
 * Borrar `cat_agua` de cualquiera de los tres idiomas dejaba `i18n-keys` en verde (reproducido
 * por Codex el 3/10/2026 sobre beta 4a2e3c54). En pantalla sería «cat_agua» a pelo, o el texto
 * castellano en inglés y catalán.
 *
 * Los ids salen del registro CATEGORIES de verdad, evaluando 00-core.js: una lista copiada aquí
 * se quedaría atrás el primer día que se añada una categoría, que es justo el caso a vigilar.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { createLogicSandbox } from "../scripts/load-pure-logic.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const modulesDir = path.join(root, "src", "modules");
const IDIOMAS = ["es", "en", "ca"];

const coreSrc = fs.readFileSync(path.join(modulesDir, "00-core.js"), "utf8");
const i18nSrc = fs.readFileSync(path.join(modulesDir, "01-i18n.js"), "utf8");

/** Evalúa núcleo + i18n y devuelve el registro y los textos tal como los ve la app. */
function cargar(core) {
  const sandbox = createLogicSandbox();
  // `const` vive en el scope léxico del script, no en el global del sandbox: hay que sacarlos.
  vm.runInNewContext(core + "\n" + i18nSrc + "\n;globalThis.__CATEGORIES=CATEGORIES;globalThis.__LANG=LANG;", sandbox, {
    filename: "src/modules/00-core.js+01-i18n.js",
  });
  return { categorias: sandbox.__CATEGORIES, LANG: sandbox.__LANG };
}

/** Huecos como «idioma:clave (motivo)». Vacío = todas las categorías tienen nombre en todo. */
function huecos(categorias, LANG) {
  const out = [];
  for (const c of categorias) {
    const clave = "cat_" + c.id;
    for (const lang of IDIOMAS) {
      const v = LANG[lang] ? LANG[lang][clave] : undefined;
      if (v === undefined) out.push(`${lang}:${clave} (falta)`);
      else if (typeof v !== "string" || !v.trim()) out.push(`${lang}:${clave} (vacía)`);
    }
  }
  return out;
}

const copia = (LANG) => Object.fromEntries(IDIOMAS.map((l) => [l, { ...LANG[l] }]));

let failed = 0;
function t(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log("      " + String(e.message).split("\n").join("\n      "));
  }
}

console.log("i18n-categorias");

const real = cargar(coreSrc);

t("el registro CATEGORIES se lee del núcleo real", () => {
  assert.ok(Array.isArray(real.categorias) && real.categorias.length > 0, "CATEGORIES vacío o ilegible");
  for (const c of real.categorias) assert.ok(typeof c.id === "string" && c.id, "categoría sin id");
});

t(`las ${real.categorias.length} categorías tienen nombre en es/en/ca`, () => {
  assert.deepEqual(huecos(real.categorias, real.LANG), []);
});

/* Que la comprobación de arriba PUEDE fallar. Sin esto, un verde no dice nada: `i18n-keys` también
   estaba en verde con la clave borrada. Se muta en memoria o sobre el texto leído; el fuente no
   se toca. */
const victima = real.categorias[0].id;

for (const lang of IDIOMAS) {
  t(`mutante: sin cat_${victima} en «${lang}» → se detecta`, () => {
    const L = copia(real.LANG);
    delete L[lang]["cat_" + victima];
    assert.deepEqual(huecos(real.categorias, L), [`${lang}:cat_${victima} (falta)`]);
  });
  t(`mutante: cat_${victima} en blanco en «${lang}» → se detecta`, () => {
    const L = copia(real.LANG);
    L[lang]["cat_" + victima] = "   ";
    assert.deepEqual(huecos(real.categorias, L), [`${lang}:cat_${victima} (vacía)`]);
  });
}

t("mutante: categoría nueva en el registro sin traducción → se detecta en los tres", () => {
  const ancla = "const CATEGORIES = [";
  assert.ok(coreSrc.includes(ancla), "no se encontró el arranque del registro para mutarlo");
  const mutado = cargar(coreSrc.replace(ancla, ancla + '\n  { id:"zz_mutante", name:"Mutante", color:"#000000", icon:"🧪" },'));
  assert.equal(mutado.categorias.length, real.categorias.length + 1, "la mutación no entró en el registro");
  assert.deepEqual(huecos(mutado.categorias, mutado.LANG), IDIOMAS.map((l) => `${l}:cat_zz_mutante (falta)`));
});

console.log(failed ? "\ni18n-categorias: FALLA" : "\ni18n-categorias: OK");
process.exit(failed ? 1 : 0);
