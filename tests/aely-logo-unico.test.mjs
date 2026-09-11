#!/usr/bin/env node
/**
 * UN SOLO LOGO DE AELY, Y QUE QUEPA EN EL ICONO.
 *
 * El 11/9 él vio DOS logos distintos en su móvil: «al cargar… se ve este icono es raro, se ve
 * alargado y no es el mismo». Tenía razón. El badge vive escrito a mano en TRES sitios —el splash
 * de `shell.html`, `I.logo` de `02-ui-shared.js` y `BADGE` de `scripts/iconos-aely.mjs`— porque el
 * splash se pinta antes de que cargue una sola línea de JS y no puede leer una constante. El
 * splash se había quedado con un dibujo viejo hecho a ojo: su «A» iba de 18 a 46 (28 de ancho)
 * contra los 7,7→55,9 (48) del de verdad, y encima era un trazo abierto sin relleno. De ahí lo de
 * «alargado».
 *
 * Y en la misma tanda: el icono de Android salía CORTADO por los bordes en las notificaciones.
 * Eso no es un dibujo distinto, es geometría: la máscara es un CÍRCULO y el badge se salía.
 *
 * Este guardián ata las dos cosas. Es el patrón de [[misma-regla-en-dos-sitios]]: si una regla
 * está escrita en varios sitios, el test carga TODOS y exige que digan lo mismo.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const lee = (p) => readFileSync(join(root, p), "utf8");

let fallos = 0;
const t = (nombre, fn) => {
  try { fn(); console.log(`  \u2713 ${nombre}`); }
  catch (e) { fallos++; console.error(`  \u2717 ${nombre}\n      ${e.message}`); }
};
console.log("aely-logo-unico");

/** Saca los tres números que definen el badge, vengan como vengan escritos (JSX, HTML o plantilla).
 *  ⚠ Se ACOTA primero a la ventana del badge. Buscar `rx` en todo `shell.html` casaba con un
 *  `border-radius` de CSS que no tiene nada que ver, y el test salía rojo por su propio despiste
 *  en vez de por el logo. Un guardián que se equivoca así deja de creerse. */
function geometria(txt, donde) {
  const ancla = txt.indexOf("62.4");   // el ancho del marco: solo está en el badge
  assert.ok(ancla > 0, `no encuentro el marco del badge en ${donde}`);
  const ventana = txt.slice(Math.max(0, ancla - 400), ancla + 1600);
  const num = (re, qué) => {
    const m = ventana.match(re);
    assert.ok(m, `no encuentro ${qué} en ${donde}`);
    return m[1];
  };
  return {
    rectRx: num(/rx[:=]"?\s*([\d.]+)/, "el radio del marco"),
    aPath: num(/d[:=]"(M31\.8[^"]*)"/, "el trazo de la A"),
    puntoR: num(/circle[^>)]*?r[:=]"?\s*([\d.]+)/s, "el radio del punto"),
  };
}

const fuentes = {
  "src/modules/02-ui-shared.js (I.logo)": lee("src/modules/02-ui-shared.js"),
  "src/shell.html (el splash)": lee("src/shell.html"),
  "scripts/iconos-aely.mjs (BADGE)": lee("scripts/iconos-aely.mjs"),
};

t("\u2605 el badge dice LO MISMO en los tres sitios donde está escrito", () => {
  const vistas = Object.entries(fuentes).map(([donde, txt]) => [donde, geometria(txt, donde)]);
  const [refDonde, ref] = vistas[0];
  for (const [donde, g] of vistas.slice(1)) {
    assert.equal(g.aPath, ref.aPath,
      `la A de ${donde} no es la misma que la de ${refDonde}. Es el fallo que él vio: «se ve ` +
      `alargado y no es el mismo». Las tres copias se mueven JUNTAS.`);
    assert.equal(g.rectRx, ref.rectRx, `el radio del marco no cuadra en ${donde}`);
    assert.equal(g.puntoR, ref.puntoR, `el punto de la A no cuadra en ${donde}`);
  }
});

t("la A es la MEDIDA sobre el original, no una dibujada a ojo", () => {
  // 7,7 y 55,9 son los extremos reales del original; 18/46 eran los del dibujo viejo.
  for (const [donde, txt] of Object.entries(fuentes)) {
    assert.ok(/M31\.8 11\.5 L55\.9 54\.1/.test(txt),
      `${donde} no lleva la A medida sobre \`logo Aely.png\`. Dibujarla a ojo ya salió mal dos ` +
      `veces («esto es un mierdón», «no se parece nada»).`);
  }
});

t("\u2605 el icono de Android CABE en la máscara redonda (no se corta por los bordes)", () => {
  const src = lee("scripts/iconos-aely.mjs");
  const m = src.match(/pagina\(fg,\s*([\d.]+),\s*null\)/);
  assert.ok(m, "no encuentro la escala del foreground del icono adaptativo");
  const escala = Number(m[1]);

  /* El badge es un cuadrado redondeado: su punto más lejano del centro es la esquina.
     En el lienzo de 64: centro del arco en (15,15) → 24,04 del centro (32,32); más el radio del
     arco (14,2) y medio trazo (0,8) = 39,04. Sobre un lado de 64, eso es 0,61 del lado. */
  /* MEDIDO sobre el PNG generado (432 px, escala 0,50 → radio 134,4), no calculado: la cuenta
     geométrica daba 0,61 y se dejaba fuera el RESPLANDOR del dibujo, que sobresale del trazo.
     Fiarse de la cuenta dejaba el icono cortándose igual. */
  const FRACCION_RADIO = 134.4 / 432 / 0.50;
  const radio = FRACCION_RADIO * 108 * escala;
  const GARANTIZADO = 33;   // 66 dp de diámetro: lo único seguro con CUALQUIER máscara

  assert.ok(radio <= GARANTIZADO,
    `con escala ${escala} el badge llega a ${radio.toFixed(1)} dp de radio y el sistema solo ` +
    `garantiza ${GARANTIZADO}. Se le cortarán los bordes, que es justo lo que él reportó el 11/9 ` +
    `(«el icono cuando sale algo sale cortado los bordes»). Baja la escala a ${(GARANTIZADO / (FRACCION_RADIO * 108)).toFixed(3)} o menos.`);
});

t("el icono clásico (sin máscara) sí puede ocupar casi todo", () => {
  const src = lee("scripts/iconos-aely.mjs");
  const m = src.match(/pagina\(leg,\s*([\d.]+),\s*FONDO\)/);
  assert.ok(m, "no encuentro la escala del icono clásico");
  assert.ok(Number(m[1]) >= 0.8,
    "el icono clásico no lo recorta nadie: encogerlo aquí solo lo hace pequeño sin motivo");
});

if (fallos) { console.error(`aely-logo-unico: ${fallos} FALLO(S)`); process.exit(1); }
console.log("aely-logo-unico: OK");
