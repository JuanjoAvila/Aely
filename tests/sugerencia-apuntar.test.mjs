#!/usr/bin/env node
/**
 * SUGERIR CATEGORÍA MIENTRAS ESCRIBES EL CONCEPTO (13/9, opción A suya).
 * Su petición: «que te salga lo de sugerir categoría con IA en cuanto añadas el concepto, que no
 * tengas que ir a otros… guardar… abrir el gasto… porque es un coñazo». Aquí se vigilan las tres
 * reglas de la decisión; la pantalla (Apuntar) solo las obedece.
 */
import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx = loadPureLogicFromFile();
let fallos = 0;
const t = (n, fn) => { try { fn(); console.log("  ✓ " + n); } catch (e) { fallos++; console.error("  ✗ " + n + "\n      " + (e && e.message)); } };
const s = (o) => ctx.sugerenciaApuntar(Object.assign({ iaOn: true, nube: true }, o));
console.log("sugerencia-apuntar");

t("menos de 3 letras: nada", () => {
  const r = s({ concepto: "Me" }); assert.equal(r.kwCat, null); assert.equal(r.pedirIA, false); assert.equal(r.chipIA, null);
});

t("palabra clave conocida: se aplica sola y NO se gasta una llamada a la IA", () => {
  const r = s({ concepto: "Mercadona" });
  assert.equal(r.kwCat, "super");
  assert.equal(r.pedirIA, false);
  assert.equal(r.chipIA, null);
});

t("si ya tocaste un chip a mano, la palabra clave no lo mueve", () => {
  const r = s({ concepto: "Mercadona", tocadaAMano: true });
  assert.equal(r.kwCat, null);
  assert.equal(r.pedirIA, false);
});

t("desconocido: se pide a la IA una vez por texto", () => {
  assert.equal(s({ concepto: "Xyzzy Studio" }).pedirIA, true);
  assert.equal(s({ concepto: "Xyzzy Studio", iaPara: "Xyzzy Studio", iaCat: "ocio" }).pedirIA, false, "ya se preguntó por este texto");
});

t("la respuesta de la IA se OFRECE como chip, no se aplica", () => {
  const r = s({ concepto: "Xyzzy Studio", iaPara: "Xyzzy Studio", iaCat: "ocio" });
  assert.equal(r.chipIA, "ocio");
  assert.equal(r.kwCat, null, "la IA nunca se aplica sola (opción A)");
});

t("una respuesta VIEJA (para otro texto) se tira", () => {
  const r = s({ concepto: "Xyzzy Studios Madrid", iaPara: "Xyzzy Studio", iaCat: "ocio" });
  assert.equal(r.chipIA, null);
  assert.equal(r.pedirIA, true, "el texto ha cambiado: se vuelve a preguntar");
});

t("IA apagada o sin nube: ni se pide ni se ofrece", () => {
  assert.equal(s({ concepto: "Xyzzy Studio", iaOn: false }).pedirIA, false);
  assert.equal(s({ concepto: "Xyzzy Studio", nube: false }).pedirIA, false);
});

t("la IA diciendo «otros» o una categoría que no existe no ofrece nada", () => {
  assert.equal(s({ concepto: "Xyzzy", iaPara: "Xyzzy", iaCat: "otros" }).chipIA, null);
  assert.equal(s({ concepto: "Xyzzy", iaPara: "Xyzzy", iaCat: "inventada" }).chipIA, null);
});

if (fallos) { console.error(`sugerencia-apuntar: ${fallos} fallo(s)`); process.exit(1); }
console.log("sugerencia-apuntar: OK");
