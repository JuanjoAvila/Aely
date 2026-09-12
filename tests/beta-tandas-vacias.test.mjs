#!/usr/bin/env node
/**
 * APROBAR UNA TANDA TIENE QUE QUITARLA DEL PANEL PARA SIEMPRE.
 *
 * Bug suyo, 2026-09-08: «todo lo que probé y marqué como aprobado me salta otra vez».
 * Por la mañana aprobó cinco tandas y por la tarde le volvieron a salir sin aprobar.
 *
 * Causa: al aprobar una tanda se QUITA del array `tandas` de su versión. Al quitar la última
 * se borró también la propiedad entera, y `betaTandas()` trataba «sin tandas» como «versión
 * antigua que nunca las declaró» → devolvía UNA tanda con todo dentro. La versión resucitaba
 * en el panel como `4.19.5/todo`, un id que no casaba con el veredicto que él ya había dado.
 *
 * O sea: `tandas:[]` y «sin `tandas`» NO son lo mismo y este test lo clava.
 *   · propiedad AUSENTE → una tanda «todo» (las ~70 versiones del histórico siguen igual).
 *   · array VACÍO       → cero tandas, no vuelve nada.
 *
 * No comprueba una constante: carga el bundle de verdad y le pregunta al panel qué pintaría.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const cli = loadPureLogicFromFile();
/* La version que corre, leida del fichero VERSION (la canonica del repo, no package.json). */
const VERSION_ACTUAL = fs.readFileSync(new URL("../VERSION", import.meta.url), "utf8").trim();
let failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.error(`  ✗ ${name}\n      ${e.message}`); }
}

console.log("beta-tandas-vacias");

t("array VACÍO → cero tandas (la aprobada no vuelve)", () => {
  const notas = { v: "9.9.9", t: { es: "X" }, tandas: [], items: { es: ["punto suelto"] } };
  assert.deepEqual(cli.betaTandas(notas), []);
});

t("propiedad AUSENTE → una tanda «todo» (las versiones antiguas siguen funcionando)", () => {
  const notas = { v: "9.9.8", t: { es: "X" }, items: { es: ["punto suelto"] } };
  const out = cli.betaTandas(notas);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "todo");
  assert.deepEqual(out[0].items, ["punto suelto"]);
});

t("con tandas declaradas, salen esas y ninguna «todo»", () => {
  const notas = {
    v: "9.9.7", t: { es: "X" },
    tandas: [{ id: "una", t: { es: "Una" }, items: { es: ["a", "b"] } }],
    items: { es: ["resumen que NO debe salir como tanda"] },
  };
  const out = cli.betaTandas(notas);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "una");
});

/* Fontanería en el tip (`tandas:[]`) no puede vaciarle el panel mientras aún pregunta prod /
   sin red — bug medido en review de 4.19.86: checklist(V,null) devolvía 0. */
t("★ tip con tandas:[] sin prodVersion → salta a la más nueva con algo que probar", () => {
  const pack = cli.betaChecklist(VERSION_ACTUAL, null);
  assert.ok(pack.tandas.length > 0,
    "sin prod, con tip fontanería, el panel no puede quedar a 0 (tiene media ronda detrás)");
  assert.equal(pack.tandas.some((g) => String(g.id).endsWith("/todo") || g.id === "todo"), false,
    "no resucitar como «todo» al saltar el tip vacío");
});

t("★ su bug: ninguna versión de la ronda resucita como «/todo»", () => {
  /* La ronda real que ve su móvil: todo lo publicado por encima de producción. Si alguna
     versión de estas vuelve como «todo» es que a alguien se le fue la propiedad al retirar
     una tanda aprobada, y él se la va a encontrar otra vez sin aprobar. */
  const pack = cli.betaChecklist(VERSION_ACTUAL, "4.18.7");
  const resucitadas = pack.tandas.filter((g) => String(g.id).endsWith("/todo")).map((g) => g.id);
  assert.equal(resucitadas.length, 0,
    "vuelven enteras al panel: " + resucitadas.join(", ") + " — ponles `tandas:[]` en vez de quitar la propiedad");
});

/* NINGUNA TANDA CON VEREDICTO SUYO PUEDE VOLVER AL PANEL.
   La lista de abajo son ids que él YA juzgó —aprobados el 8/9 y el 10/9, y rechazados—, leídos
   de sus propios veredictos con `node scripts/errores.mjs --kind=beta`. Enseñarle otra vez algo
   que ya dictaminó es exactamente lo que pidió quitar el 11/9 por la noche: «no me sirve cosas
   que ya te he dicho por aquí». Un RECHAZO tampoco vuelve tal cual: el arreglo se le devuelve
   como paso dentro de la tanda que de verdad lo arregla (tr-reactivo → quitar-banco de 4.19.28,
   avisos-presupuesto → la tanda de 4.19.55), no re-probando la versión que ya rechazó. */
t("★ nada con veredicto suyo vuelve al panel", () => {
  const pack = cli.betaChecklist(VERSION_ACTUAL, "4.18.7");
  const ids = pack.tandas.map((g) => String(g.id));
  const juzgadas = [
    /* aprobadas 8/9 */ "notas-20", "arranque-suelto", "panel-ronda", "multicuenta", "posible-repetido",
    /* aprobadas 10/9 */ "categoria-ia", "orden-gastos", "acabado-v4", "pulido-b245", "revision-plegable",
    "informe-mes", "presupuesto-categoria",
    /* rechazadas (su arreglo va dentro de otra tanda) */ "tr-reactivo", "avisos-presupuesto",
    "ventana-mes", "pulido-cierre", "modo-inicial",
  ];
  juzgadas.forEach((id) => {
    assert.equal(ids.some((x) => x.endsWith("/" + id) || x === id), false,
      `«${id}» ya tiene veredicto suyo y ha vuelto al panel`);
  });
});

t("y lo que nunca ha probado sigue ahí (no nos hemos pasado de frenada)", () => {
  const pack = cli.betaChecklist(VERSION_ACTUAL, "4.18.7");
  const ids = pack.tandas.map((g) => String(g.id));
  /* ⚠ Son ids de tandas VIVAS, y las tandas se funden entre sí cuando dos piden la misma prueba
     («quitar-banco» acabó dentro de «banco-pendiente-y-quitar» el 11/9). Si al fundir una te sale
     rojo esto, cambia el id por el que sobrevive — no quites la comprobación, que es la que evita
     pasarse de frenada al limpiar el panel. */
  ["id-fila", "banco-pendiente-y-quitar", "cats-plegable", "pulsacion-larga", "logos-inversiones"].forEach((id) => {
    assert.equal(ids.some((x) => x.endsWith("/" + id)), true, `falta «${id}», que sigue pendiente`);
  });
});

/* Y que los pasos se puedan seguir sin adivinar: él los lee en el móvil, uno a uno. */
t("cada punto del panel dice qué hacer, no solo qué debería pasar", () => {
  const pack = cli.betaChecklist(VERSION_ACTUAL, "4.18.7");
  const flojos = [];
  pack.tandas.forEach((g) => {
    (g.items || []).forEach((it) => {
      const txt = String(it || "");
      if (!/^\s*\d+\./.test(txt)) flojos.push(g.id + " → " + txt.slice(0, 60));
    });
  });
  assert.equal(flojos.length, 0,
    "estos puntos no van numerados como pasos:\n      " + flojos.join("\n      "));
});

console.log(failed ? `\n${failed} fallo(s)` : "\nbeta-tandas-vacias: OK");
process.exit(failed ? 1 : 0);
