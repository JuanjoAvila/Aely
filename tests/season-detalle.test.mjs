/**
 * Guardián ambientación (2026-08-05, seis pasadas medidas con ADB+CDP en su Oppo).
 *
 * Historia, para que nadie vuelva a proponer lo mismo:
 *   .9  — subir intensidad + `nav-sin-blur`: el píxel de la esquina seguía saltando +31 y la barra
 *         seguía al 88% durante el swipe. Fix real: portal FUERA de `#root` + botnav opaco siempre.
 *   .11 — velo translúcido a 38vh ENCIMA del contenido. El fallo no era el scroll vertical sino
 *         DESLIZAR ENTRE PESTAÑAS: la app entera pasa por debajo del velo y el composite se aclara.
 *         Y al empezar en y=0, teñía la barra de estado.
 *   .12 — gradiente horneado en `.page-scroll-host` + cinta opaca. Esa clase SE QUITA mientras el
 *         carrusel se mueve → con el dedo congelado a mitad de gesto el aporte del destello medía
 *         [0,0,0]: desaparecía. Y la cinta dejaba la franja de la cámara oliva [66,64,37] contra
 *         un fondo [20,38,30].
 *   .13 — COFIA: el destello se pinta OPACO y POR ENCIMA de todo → sin parpadeo pero «ralla»
 *         horizontal que tapaba texto al scrollear (rechazado 5/8 tarde).
 *   .16 — TRASFONDO: portal z-1, `#root` z-2; lavado ancho en `.season-glow`; host/app transparentes
 *         con temática; el contenido pasa por encima, nunca bloqueado.
 *   .17 — host transparente (.16) reabrió Inicio+Gastos fusionados. Fix: host OPACO con el lavado
 *         pintado encima de var(--bg); portal sigue detrás para chrome y gesto.
 *
 * Lo que vigila este fichero: destello detrás del contenido, sin hornear en host/app, sin cofia
 * encima, notch limpio, barra opaca.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const shell = readFileSync(join(root, "src/shell.html"), "utf8");
const main = readFileSync(join(root, "src/modules/11-app-main.js"), "utf8");
const i18n = readFileSync(join(root, "src/modules/01-i18n.js"), "utf8");
const comps = readFileSync(join(root, "src/modules/10-app-components.js"), "utf8");

assert.doesNotMatch(shell, /\.season-fx\s*\{/, "`.season-fx` no puede volver");
assert.doesNotMatch(main, /seasonEpoch/, "seasonEpoch no puede volver");
assert.doesNotMatch(i18n, /const\s+SEASON_FX\b/, "SEASON_FX no puede volver");

/* Portal dentro de #root z-0 (build .22): en body z-1 bajo #root z-2 no se ve en el swipe. */
assert.match(shell, /\.season-portal\{[^}]*position:\s*fixed/, "season-portal fixed");
assert.match(shell, /\.season-portal\{[^}]*z-index:\s*0/, "season-portal z-0");
assert.match(shell, /html\[data-season\]\s+#root\{[^}]*position:\s*relative/, "#root relative");
assert.doesNotMatch(shell, /html\[data-season\]\s+#root\{[^}]*z-index:\s*2/, "no #root z-2");
assert.match(shell, /\.season-glow\{[^}]*position:\s*absolute/, "season-glow absolute");
assert.match(shell, /\.season-glow\{[^}]*inset:\s*0/, "season-glow inset 0");
assert.match(shell, /\.season-amb\{[^}]*position:\s*absolute/, "season-amb absolute");
assert.doesNotMatch(shell, /html\[data-season\]::before\{/, "no html::before");
assert.doesNotMatch(shell, /html\[data-season\]\s+\.botnav::before\{/, "no botnav::before");
assert.doesNotMatch(shell, /html\[data-season\]::after\{/, "no html::after");

assert.match(main, /ReactDOM\.createPortal\(/, "createPortal");
assert.match(main, /className:"season-portal"/, "season-portal class");
assert.match(main, /getElementById\("root"\)/, "portal en root");
assert.match(main, /className:"season-glow"/, "season-glow class");
assert.doesNotMatch(main, /show\s*&&\s*seasonPool/, "no show&&seasonPool");
assert.match(main, /if\(!seasonOn\)\s*return null/, "seasonOn gate");
assert.match(main, /seasonPool\s*\?\s*React\.createElement\("div",\{className:"season-amb"/, "season-amb optional");

/* ===== Lavado de trasfondo (no cofia encima) ===== */
{
  const glowRule = shell.match(/\.season-glow\{([^}]*)\}/);
  assert.ok(glowRule, "falta la regla `.season-glow`");
  const body = glowRule[1];
  assert.match(body, /background-color:\s*var\(--bg\)/, "base sólida del mismo tono que la app");
  assert.match(body, /background-image:\s*var\(--season-glow-top\)/, "lavado en variable por temática");
  assert.doesNotMatch(body, /background-attachment:\s*fixed/, "`.season-glow` sin attachment:fixed (Oppo tapa contenido)");
  assert.doesNotMatch(body, /height:\s*var\(--season-cofia\)/, "NO cofia con alto fijo encima");
  assert.doesNotMatch(body, /opacity:\s*0?\.\d/, "nada de translucidez en la capa entera");
  assert.doesNotMatch(body, /animation:/, "sin animación de opacidad");
  assert.doesNotMatch(body, /mask-image/, "`.season-glow` sin mask (parpadeo al scrollear)");
}
assert.doesNotMatch(shell, /--season-cofia/, "sin variable cofia (.13/.15 descartada)");
assert.doesNotMatch(shell, /@keyframes\s+seasonglow/, "`seasonglow` no puede volver (pulso de opacidad)");

/* Gradientes amplios, suaves, por debajo de `--safe-top` en el centro (notch limpio). */
{
  const defs = [...shell.matchAll(/--season-glow-top:([^;]+);/g)];
  assert.ok(defs.length >= 6, "faltan temáticas con destello: " + defs.length);
  for (const d of defs) {
    assert.doesNotMatch(d[1], /at\s+\d+%\s+-\d+%/,
      "gradiente centrado por encima del borde → tiñe la barra de estado: " + d[1].slice(0, 70));
    assert.match(d[1], /calc\(var\(--safe-top\)/,
      "el destello arranca por debajo de `--safe-top`: " + d[1].slice(0, 70));
    assert.match(d[1], /ellipse\s+\d+%\s+\d+%/,
      "radiales amplios (no elipses planas tipo ralla): " + d[1].slice(0, 70));
    assert.doesNotMatch(d[1], /\d+px\s+3[0-9]px\s+at/,
      "NO elipses planas de ~36px (ralla horizontal): " + d[1].slice(0, 70));
    /* Alfas contenidas: nada de .34/.55 como en la ralla fuerte. */
    assert.doesNotMatch(d[1], /rgba\([^)]+\.(3[4-9]|4\d|5\d)\)/,
      "alfas demasiado altas (ralla fuerte): " + d[1].slice(0, 70));
  }
}

/* Partículas bajo la franja de iconos del sistema. */
assert.match(shell, /\.season-amb\{[^}]*top:calc\(var\(--safe-top\)/,
  "las partículas arrancan bajo `--safe-top`");

/* Host transparente en reposo: lavado fijo en .season-glow; hermanas aparcadas hidden
   (8016d7df — sin esto fusionan tabs; e2e acota a `.page-scroll-host`). Gesto: .page opaca. */
assert.match(shell, /\.page\.page-scroll-host\{[\s\S]*?background:\s*var\(--bg\)/, "host opaco default");
assert.match(shell, /html\[data-season\]\s+\.page\.page-scroll-host\{background:transparent!important;/, "host transparente reposo");
assert.match(shell, /\.track\.scroll-host-park\{[^}]*overflow:\s*hidden/, "scroll-host-park recorta hermanas");
assert.match(shell, /\.track\.scroll-host-park \.page:not\(\.page-scroll-host\)\{visibility:hidden/, "visibility:hidden en park (anti-fusión)");
/* ⛔ LO CONTRARIO DE LO QUE PEDÍA ESTE TEST HASTA EL 2026-08-18. Exigía `.page` OPACA durante el
   gesto («refuerzo opaco»), y esa regla ERA el parpadeo: pintaba `var(--bg)` plano encima del
   `radial-gradient` del `body`, que es lo que ilumina la esquina superior derecha. Medido en su
   OnePlus 13 a 120 fps: −16 niveles arriba-derecha, −8 a la izquierda, 12 gestos de 12, y también
   con Temática Ninguna (el degradado es del tema base). El porqué largo, en `shell.html`.
   Ahora el guardián vigila que NO vuelva: durante el arrastre las páginas no pintan fondo.
   ⚠ Sobre CÓDIGO, no sobre el texto: el comentario de `shell.html` cita la regla vieja entera
   para explicarla, así que hay que quitar los comentarios antes de buscarla (igual que hace el
   guardián de `background-attachment` un poco más abajo). */
assert.doesNotMatch(shell.replace(/\/\*[\s\S]*?\*\//g, ""), /\.track\.dragging \.page\{[^}]*background:\s*var\(--bg\)/, "el refuerzo opaco del gesto NO vuelve (era el parpadeo)");
assert.doesNotMatch(shell, /html\[data-season\]\s+\.page\.page-scroll-host::before/, "no ::before sticky");
assert.doesNotMatch(shell.replace(/\/\*[\s\S]*?\*\//g, ""), /background-attachment:\s*fixed/, "no attachment fixed en reglas");
assert.match(shell, /html\[data-season\]\s+\.page\{background:transparent!important;/, "page transparente");
assert.match(shell, /html\[data-season\]\s+\.app\{[^}]*background:transparent!important;/, "app transparente");
assert.match(shell, /\.app\{[^}]*padding-top:calc\(var\(--safe-top\) \+ 4px\)/, "app padding-top");

/* Barra: hide sin opacity (evita ver la lista a través) */
assert.match(
  shell,
  /\.botnav\.botnav-hidden\{transform:translateY\(120%\);pointer-events:none;?\}/,
  "botnav-hidden SOLO translate, sin opacity:0"
);
assert.doesNotMatch(
  shell,
  /\.botnav\.botnav-hidden\{[^}]*opacity:\s*0/,
  "botnav-hidden no puede usar opacity:0 (fuga de contenido)"
);

/* Barra: fondo OPACO por defecto */
assert.match(
  shell,
  /\.botnav\{[^}]*background:\s*var\(--bg-2\)/,
  "`.botnav` default tiene fondo sólido var(--bg-2)"
);
assert.doesNotMatch(
  shell,
  /\.botnav\{[^}]*color-mix\([^)]*88%/,
  "`.botnav` no puede usar color-mix 88% transparente (fuga en swipe)"
);

assert.match(
  shell,
  /\.app-shell\.nav-sin-blur \.botnav\{[^}]*background:\s*var\(--bg-2\)/,
  "nav-sin-blur mantiene fondo sólido"
);

assert.match(shell, /@keyframes\s+seasonDrift/, "seasonDrift");

assert.doesNotMatch(comps, /\{id:"temporada"\s*,\s*t:/, "tanda temporada fuera");
assert.match(comps, /temporada.*QUITADA|QUITADA.*temporada/i, "por qué se quitó");

console.log("ok: season glow .22 portal #root z-0; sin cofia; botnav opaco");
