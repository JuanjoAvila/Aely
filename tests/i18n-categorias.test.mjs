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
 *
 * `catOf` resuelve además cuatro categorías que NO están en el registro: el ingreso y las neutras
 * (inversión, traspaso, deudas). También pasan por `catName` y tampoco las veía nadie, salvo
 * `cat_ingreso`, que se usa como literal en otro sitio. Se leen del núcleo (INGRESO_CAT y las
 * claves de CAT_NEUTRAS), preguntando a `catOf` de verdad.
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
  // Las especiales se piden a `catOf` con su id: lo que devuelva es lo que `catName` va a traducir.
  const salida =
    ";globalThis.__CATEGORIES=CATEGORIES;globalThis.__LANG=LANG;" +
    "globalThis.__ESPECIALES=[INGRESO_CAT.id].concat(Object.keys(CAT_NEUTRAS)).map(function(id){return {pedida:id,resuelta:catOf(id).id};});";
  vm.runInNewContext(core + "\n" + i18nSrc + "\n" + salida, sandbox, {
    filename: "src/modules/00-core.js+01-i18n.js",
  });
  // Copia a objetos de ESTE contexto: un array nacido en el sandbox tiene otro prototipo y
  // `deepEqual` estricto lo da por distinto aunque el contenido sea idéntico.
  const especiales = Array.from(sandbox.__ESPECIALES, (e) => ({ pedida: e.pedida, resuelta: e.resuelta }));
  return { categorias: sandbox.__CATEGORIES, especiales, LANG: sandbox.__LANG };
}

/**
 * Especiales que `catOf` no reconoce. Si una neutra nueva no tiene su rama, `catOf` cae a «otros»
 * y el nombre saldría como «Otros» con todas las traducciones en su sitio: sin esta comprobación
 * el fallback taparía el hueco.
 */
function sinResolver(especiales) {
  return especiales.filter((e) => e.resuelta !== e.pedida).map((e) => `${e.pedida}→${e.resuelta}`);
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

const idsEspeciales = real.especiales.map((e) => ({ id: e.resuelta }));

t("ingreso y neutras se leen del núcleo real y catOf las reconoce", () => {
  assert.ok(real.especiales.length > 1, "no se leyeron INGRESO_CAT ni CAT_NEUTRAS");
  assert.deepEqual(sinResolver(real.especiales), []);
  const enRegistro = new Set(real.categorias.map((c) => c.id));
  assert.deepEqual(real.especiales.filter((e) => enRegistro.has(e.pedida)).map((e) => e.pedida), [], "una especial ya está en CATEGORIES");
});

t(`las ${real.especiales.length} especiales (${real.especiales.map((e) => e.pedida).join(", ")}) tienen nombre en es/en/ca`, () => {
  assert.deepEqual(huecos(idsEspeciales, real.LANG), []);
});

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

for (const esp of real.especiales) {
  for (const lang of IDIOMAS) {
    t(`mutante: sin cat_${esp.pedida} en «${lang}» → se detecta`, () => {
      const L = copia(real.LANG);
      delete L[lang]["cat_" + esp.pedida];
      assert.deepEqual(huecos(idsEspeciales, L), [`${lang}:cat_${esp.pedida} (falta)`]);
    });
    t(`mutante: cat_${esp.pedida} en blanco en «${lang}» → se detecta`, () => {
      const L = copia(real.LANG);
      L[lang]["cat_" + esp.pedida] = "   ";
      assert.deepEqual(huecos(idsEspeciales, L), [`${lang}:cat_${esp.pedida} (vacía)`]);
    });
  }
}

t("mutante: neutra nueva que catOf no reconoce → el fallback a «otros» no la tapa", () => {
  const ancla = "const CAT_NEUTRAS = {";
  assert.ok(coreSrc.includes(ancla), "no se encontró CAT_NEUTRAS para mutarlo");
  const mutado = cargar(coreSrc.replace(ancla, ancla + " zz_mutante:1,"));
  assert.equal(mutado.especiales.length, real.especiales.length + 1, "la mutación no entró en CAT_NEUTRAS");
  assert.deepEqual(sinResolver(mutado.especiales), ["zz_mutante→otros"]);
});

t("mutante: categoría nueva en el registro sin traducción → se detecta en los tres", () => {
  const ancla = "const CATEGORIES = [";
  assert.ok(coreSrc.includes(ancla), "no se encontró el arranque del registro para mutarlo");
  const mutado = cargar(coreSrc.replace(ancla, ancla + '\n  { id:"zz_mutante", name:"Mutante", color:"#000000", icon:"🧪" },'));
  assert.equal(mutado.categorias.length, real.categorias.length + 1, "la mutación no entró en el registro");
  assert.deepEqual(huecos(mutado.categorias, mutado.LANG), IDIOMAS.map((l) => `${l}:cat_zz_mutante (falta)`));
});

console.log(failed ? "\ni18n-categorias: FALLA" : "\ni18n-categorias: OK");
process.exit(failed ? 1 : 0);
