#!/usr/bin/env node
/**
 * GENERA LOS ICONOS DE ANDROID DEL A-DOT BADGE DE AELY.
 *
 * Se dibuja el mismo SVG que usa la app (`I.logo`) y se rasteriza con el Chromium que ya tenemos
 * para los e2e: cero dependencias nuevas, y el icono del móvil sale del MISMO dibujo que el de la
 * pantalla, así que no pueden separarse con el tiempo.
 *
 * Qué escribe:
 *   · `mipmap-<densidad> ic_launcher_foreground.png` — solo la A y el marco, fondo TRANSPARENTE, dentro de
 *     la zona segura del icono adaptativo (el sistema recorta hasta un 33 % en los bordes).
 *   · `mipmap-<densidad> ic_launcher.png` y `_round.png` — icono clásico, con el fondo oscuro dentro.
 *   · `values ic_launcher_background.xml` — el fondo pasa al `bg` del brief.
 *
 *   node scripts/iconos-aely.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const RES = path.join(raiz, "android", "app", "src", "main", "res");
const MENTA = "#6CC688";
const FONDO = "#0B140F";

/* El mismo trazado que `I.logo` en 02-ui-shared.js, medido sobre `logo Aely.png`.
   ⚠ Si se toca allí, hay que tocarlo aquí: son dos copias del mismo dibujo y la única defensa es
   que estén juntas en el mismo commit. */
const BADGE = `
  <rect x="0.8" y="0.8" width="62.4" height="62.4" rx="14.2" stroke="${MENTA}" stroke-width="1.6" fill="none"/>
  <path d="M31.8 11.5 L55.9 54.1 L46.7 54.1 L31.8 25.3 L16.9 54.1 L7.7 54.1 Z"
        fill="${MENTA}" stroke="${MENTA}" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/>
  <circle cx="31.8" cy="43.7" r="5.1" fill="${MENTA}"/>`;

/** @param {number} px  @param {number} escala  fracción del lienzo que ocupa el badge
 *  @param {string|null} fondo  null = transparente */
const pagina = (px, escala, fondo) => `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;width:${px}px;height:${px}px;${fondo ? `background:${fondo}` : "background:transparent"}}
 .c{width:${px}px;height:${px}px;display:grid;place-items:center}
 svg{width:${Math.round(px * escala)}px;height:${Math.round(px * escala)}px;display:block;filter:drop-shadow(0 0 ${Math.max(1, px * 0.012)}px ${MENTA}66)}</style>
<div class="c"><svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">${BADGE}</svg></div>`;

const densidades = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

const navegador = await chromium.launch();
const pag = await navegador.newPage({ deviceScaleFactor: 1 });
let escritos = 0;

for (const [d, f] of Object.entries(densidades)) {
  const dir = path.join(RES, "mipmap-" + d);
  if (!fs.existsSync(dir)) continue;

  /* FOREGROUND del icono adaptativo: 108 dp de lienzo, pero solo los 72 dp centrales se ven
     seguro (el sistema recorta y anima el resto). 72/108 = 0,667, y se deja un pelo de aire. */
  const fg = Math.round(108 * f);
  await pag.setViewportSize({ width: fg, height: fg });
  await pag.setContent(pagina(fg, 0.63, null));
  fs.writeFileSync(path.join(dir, "ic_launcher_foreground.png"),
    await pag.screenshot({ omitBackground: true }));

  /* Icono CLÁSICO (Android 7 y anteriores, y algunos lanzadores): el fondo va dentro y el badge
     ocupa casi todo, porque aquí no hay recorte. */
  const leg = Math.round(48 * f);
  await pag.setViewportSize({ width: leg, height: leg });
  await pag.setContent(pagina(leg, 0.9, FONDO));
  const tiro = await pag.screenshot();
  fs.writeFileSync(path.join(dir, "ic_launcher.png"), tiro);
  fs.writeFileSync(path.join(dir, "ic_launcher_round.png"), tiro);
  escritos += 3;
  console.log(`  · ${d}: foreground ${fg}px · clásico ${leg}px`);
}

await navegador.close();

// El fondo del icono adaptativo, al token del brief.
const bgXml = path.join(RES, "values", "ic_launcher_background.xml");
if (fs.existsSync(bgXml)) {
  const antes = fs.readFileSync(bgXml, "utf8");
  const dsp = antes.replace(/(<color name="ic_launcher_background">)#[0-9A-Fa-f]{6}(<\/color>)/, `$1${FONDO}$2`);
  if (dsp !== antes) { fs.writeFileSync(bgXml, dsp); console.log(`  · fondo del icono → ${FONDO}`); }
}

console.log(`✅ ${escritos} PNG de icono generados desde el mismo dibujo que usa la app.`);
