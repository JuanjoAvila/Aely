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

t("★ su bug: ninguna versión de la ronda resucita como «/todo»", () => {
  /* La ronda real que ve su móvil: todo lo publicado por encima de producción. Si alguna
     versión de estas vuelve como «todo» es que a alguien se le fue la propiedad al retirar
     una tanda aprobada, y él se la va a encontrar otra vez sin aprobar. */
  const pack = cli.betaChecklist(VERSION_ACTUAL, "4.18.7");
  const resucitadas = pack.tandas.filter((g) => String(g.id).endsWith("/todo")).map((g) => g.id);
  assert.equal(resucitadas.length, 0,
    "vuelven enteras al panel: " + resucitadas.join(", ") + " — ponles `tandas:[]` en vez de quitar la propiedad");
});

t("★ las cinco que aprobó el 8/9 no vuelven a salir", () => {
  const pack = cli.betaChecklist(VERSION_ACTUAL, "4.18.7");
  const ids = pack.tandas.map((g) => String(g.id));
  ["notas-20", "arranque-suelto", "panel-ronda", "multicuenta", "posible-repetido"].forEach((id) => {
    assert.equal(ids.some((x) => x.endsWith("/" + id) || x === id), false,
      `«${id}» estaba aprobada y ha vuelto al panel`);
  });
});

t("y las que NO ha aprobado siguen ahí (no nos hemos pasado de frenada)", () => {
  const pack = cli.betaChecklist(VERSION_ACTUAL, "4.18.7");
  const ids = pack.tandas.map((g) => String(g.id));
  ["tr-reactivo", "avisos-presupuesto", "ventana-mes", "categoria-ia", "orden-gastos", "id-fila"].forEach((id) => {
    assert.equal(ids.some((x) => x.endsWith("/" + id)), true, `falta «${id}», que sigue pendiente`);
  });
});

console.log(failed ? `\n${failed} fallo(s)` : "\nbeta-tandas-vacias: OK");
process.exit(failed ? 1 : 0);
