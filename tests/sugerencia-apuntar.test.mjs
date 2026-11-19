#!/usr/bin/env node
/**
 * SUGERIR CATEGORÍA MIENTRAS ESCRIBES EL CONCEPTO (13/9, opción A suya).
 * Su petición: «que te salga lo de sugerir categoría con IA en cuanto añadas el concepto, que no
 * tengas que ir a otros… guardar… abrir el gasto… porque es un coñazo». Aquí se vigilan las reglas
 * de la decisión; la pantalla (Apuntar) solo las obedece. Desde el 19/11 sin IA de pago: la Edge
 * nunca tuvo clave, así que lo que sugiere es lo aprendido de sus correcciones y las palabras clave.
 */
import assert from "node:assert/strict";
import vm from "node:vm";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx = loadPureLogicFromFile();
let fallos = 0;
const t = (n, fn) => { try { fn(); console.log("  ✓ " + n); } catch (e) { fallos++; console.error("  ✗ " + n + "\n      " + (e && e.message)); } };
const s = (o) => ctx.sugerenciaApuntar(o);
console.log("sugerencia-apuntar");

t("menos de 3 letras: nada", () => {
  assert.deepEqual(Object.keys(s({ concepto: "Me" })), ["kwCat"]);
  assert.equal(s({ concepto: "Me" }).kwCat, null);
});

t("palabra clave conocida: se aplica sola", () => {
  assert.equal(s({ concepto: "Mercadona" }).kwCat, "super");
});

t("si ya tocaste un chip a mano, la palabra clave no lo mueve", () => {
  assert.equal(s({ concepto: "Mercadona", tocadaAMano: true }).kwCat, null);
});

t("desconocido: no se inventa nada ni se ofrece chip de IA", () => {
  const r = s({ concepto: "Xyzzy Studio", iaOn: true, nube: true });
  assert.equal(r.kwCat, null);
  assert.equal(r.chipIA, undefined);
  assert.equal(r.pedirIA, undefined);
});

t("lo que él corrigió antes manda sobre la palabra clave, también escrito distinto", () => {
  vm.runInNewContext("USER_OVERRIDES={'mercadona 1234':'bares'}", ctx);
  try {
    assert.equal(s({ concepto: "Mercadona 1234" }).kwCat, "bares");
    assert.equal(s({ concepto: "MERCADONA" }).kwCat, "bares");
  } finally { vm.runInNewContext("USER_OVERRIDES={}", ctx); }
});

if (fallos) { console.error(`sugerencia-apuntar: ${fallos} fallo(s)`); process.exit(1); }
console.log("sugerencia-apuntar: OK");
