#!/usr/bin/env node
/**
 * SI LA FILA ES UN BANCO, EL LOGO DEL BANCO; SI ES UNA EMPRESA, `LogoInv`.
 *
 * Esta regla se rompió DOS veces el mismo día (11/9/2026), una en cada dirección:
 *
 *   1. Al estrenar los logos de banco se los puse a todas las filas. Las posiciones de un bróker
 *      son EMPRESAS, así que las diez de Revolut salieron con el mismo icono de Revolut. Su
 *      aviso: «te cargaste los iconos de las inversiones de las empresas».
 *   2. Al arreglarlo me pasé de frenada: puse `logo:false` en los CINCO sitios, incluidos los
 *      tres que agrupan POR BRÓKER, que sí son bancos. Su aviso: «no puede ser que salgan bien
 *      los logos de las cuentas bancarias, que salgan los de las empresas en inversiones, pero
 *      no los bancos donde están las inversiones».
 *
 * Ningún test cazó ninguna de las dos: es una regla de PRESENTACIÓN repartida por varios sitios,
 * justo el patrón de [[misma-regla-en-dos-sitios]]. Así que se ata aquí, leyendo el código:
 * cada fila declarada abajo tiene que pintar el componente que le toca.
 *
 * Si mueves una de estas filas y el test se queja, NO le quites el ancla: cambia el ancla y
 * comprueba a mano que la fila sigue enseñando lo que debe.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const lee = (p) => readFileSync(join(root, p), "utf8");

let fallos = 0;
const t = (nombre, fn) => {
  try { fn(); console.log(`  ✓ ${nombre}`); }
  catch (e) { fallos++; console.error(`  ✗ ${nombre}\n      ${e.message}`); }
};

console.log("logo de banco o de empresa");

/* Las filas que son un BANCO. `ancla` es un trozo de la línea que la identifica sin depender del
   número de línea; `donde` es para que el mensaje de error diga qué pantalla se rompe. */
const FILAS_DE_BANCO = [
  { f: "src/modules/06-sync-brokers.js", ancla: 'React.createElement(Mono,{ent:g[0],size:44',
    donde: "Inversiones · tarjeta de cada bróker en «Tus inversiones»" },
  { f: "src/modules/06-sync-brokers.js", ancla: 'React.createElement(Mono,{ent:g[0],size:34',
    donde: "Inversiones · desglose por bróker (inv_cvg)" },
  { f: "src/modules/07-tab-patri-fijos.js", ancla: 'React.createElement(Mono,{ent:g,size:38',
    donde: "Cartera · Inversiones por bróker" },
];

for (const fila of FILAS_DE_BANCO) {
  t(`${fila.donde}: fila de banco, logo de banco`, () => {
    const src = lee(fila.f);
    const i = src.indexOf(fila.ancla);
    assert.notEqual(i, -1, `no encuentro la fila en ${fila.f} (ancla: ${fila.ancla})`);
    /* La llamada acaba en el primer `}` tras el ancla: ahí viven sus props. */
    const props = src.slice(i, src.indexOf("}", i + fila.ancla.length) + 1);
    assert.ok(!/logo\s*:\s*false/.test(props),
      `esta fila es un BANCO y lleva logo:false, así que sale su monograma de letras en vez del logo\n      ${props}`);
  });
}

/* Las filas que son una EMPRESA (una posición: NVDA, el oro, un fondo…). Estas NO pueden pintar
   `Mono`, que es la insignia del custodio: tienen que ir por `LogoInv`, que cae a las iniciales
   del ACTIVO cuando no hay logo. */
const FILAS_DE_EMPRESA = [
  { f: "src/modules/06-sync-brokers.js", ancla: "React.createElement(LogoInv,{nombre:it.name",
    donde: "Inversiones · cada posición dentro de un bróker (InvRows)" },
  { f: "src/modules/06-sync-brokers.js", ancla: "React.createElement(LogoInv,{nombre:p.name",
    donde: "Inversiones · rendimiento por posición" },
];

for (const fila of FILAS_DE_EMPRESA) {
  t(`${fila.donde}: fila de empresa, logo de empresa`, () => {
    const src = lee(fila.f);
    const i = src.indexOf(fila.ancla);
    assert.notEqual(i, -1, `no encuentro la fila en ${fila.f} (ancla: ${fila.ancla})`);
    const props = src.slice(i, src.indexOf("}", i + fila.ancla.length) + 1);
    /* `kind` distingue el oro y los fondos de una acción: sin él, las categorías pierden su
       dibujo y vuelven a caer a las iniciales. */
    assert.ok(/kind\s*:/.test(props),
      `a esta fila le falta \`kind\`, así que el oro y los fondos pierden su icono de categoría\n      ${props}`);
  });
}

t("los tres brókers tienen logo de banco guardado", () => {
  const src = lee("src/modules/02-ui-shared.js");
  const i = src.indexOf("BANCOS_CON_LOGO=");
  assert.notEqual(i, -1, "no encuentro BANCOS_CON_LOGO en 02-ui-shared.js");
  const lista = src.slice(i, src.indexOf("}", i) + 1);
  for (const ent of ["revolut", "trade_republic", "myinvestor"]) {
    assert.ok(lista.includes(ent),
      `${ent} no está en BANCOS_CON_LOGO: sus filas de bróker saldrían con letras igualmente`);
  }
});

t("y el PNG de cada uno existe de verdad", () => {
  for (const ent of ["revolut", "trade_republic", "myinvestor"]) {
    const p = join(root, "public", "logos", ent + ".png");
    let bytes = 0;
    try { bytes = readFileSync(p).length; } catch { bytes = 0; }
    assert.ok(bytes > 0, `falta public/logos/${ent}.png — la fila caería al monograma sin avisar`);
  }
});

if (fallos) { console.error(`\nlogo-banco-o-empresa: ${fallos} fallo(s)`); process.exit(1); }
console.log("\nlogo-banco-o-empresa: OK");
