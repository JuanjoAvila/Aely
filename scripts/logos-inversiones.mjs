#!/usr/bin/env node
/**
 * LOS LOGOS DE LAS EMPRESAS EN LAS QUE INVIERTE — trazo OFICIAL, no dibujado.
 *
 * Petición suya del 11/9, con capturas de Revolut y Trade Republic al lado: quería ver NVIDIA,
 * Alphabet, Broadcom, TSMC, AMD, Micron, Meta y el FTSE con su logo, como los ve en el bróker.
 * Eligió la **opción C**: los que se puedan, guardados en la app; el resto, con su letra y el
 * color de la marca. Y autorizó usar los logotipos oficiales.
 *
 * De dónde salen: `simple-icons` (MIT), que trae el trazo OFICIAL de cada marca en vector. Mejor
 * que bajar un PNG de la web de cada empresa: no hay que rasterizar, pesa ~1 KB y el paquete
 * existe justo para esto. **Nada se descarga en caliente**: la app no llama a ningún tercero
 * (norma «cero CDNs») y, de paso, no se le cuenta a nadie de fuera qué empresas tiene en cartera.
 *
 * Por qué ficheros y no SVG inline: el gzip del index está al 99 % del tope (326/330 KB). Un
 * `<img>` se cachea aparte y viaja igual en el APK (`build-www` copia `public/`) y en el bundle
 * OTA (`zip -qr`).
 *
 * ⚠ TSMC, Micron y el FTSE All-World se quedan SIN logo a propósito: no están en `simple-icons`
 * y **un monograma correcto es mejor que un logo equivocado**.
 *
 * Uso:  node scripts/logos-inversiones.mjs          (regenera public/logos/inv/*.svg)
 *       node scripts/logos-inversiones.mjs --check  (falla si no cuadran; para la suite)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as si from "simple-icons";
import { loadPureLogicFromFile } from "./load-pure-logic.mjs";

const { marcaDeInversion } = loadPureLogicFromFile();

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEST = path.join(root, "public/logos/inv");

/* La regla de «qué marca es esta inversión» NO vive aquí: vive en `src/modules/00-core.js`
   (`marcaDeInversion`) y se carga con `load-pure-logic.mjs`, que es el mecanismo que ya usa el
   repo para compartir lógica pura entre la app y Node. Si estuviera en los dos sitios sería la
   séptima copia de la misma regla, y eso nos ha mordido tres veces el 11/9
   (`misma-regla-en-dos-sitios`). Aquí SOLO vive de qué icono sale cada marca, que es cosa del
   build y la app no necesita saber. */
const ICONO_DE = {
  nvidia:   "siNvidia",
  amd:      "siAmd",
  meta:     "siMeta",
  alphabet: "siGoogle",    // Alphabet usa la G de Google
  broadcom: "siBroadcom",
};

/* Nombres REALES tal y como llegan del bróker (de sus capturas de Revolut y Trade Republic).
   El guardián exige que cada uno dé su marca, y que los de abajo NO den ninguna. */
const DEBEN_DAR = [
  ["NVIDIA", "nvidia"], ["Advanced Micro Devices", "amd"], ["AMD", "amd"],
  ["Meta Platforms (A)", "meta"], ["Alphabet (Class C)", "alphabet"], ["Broadcom", "broadcom"],
];
const NO_DEBEN_CASAR = [
  "Metaverse ETF", "iShares Metaverse UCITS", "Meta Materials",
  "AMD Ryzen Fondo Tecnologico", "Alphabetical Growth Fund",
  "FTSE All-World USD (Acc)", "Vanguard FTSE All-World UCITS ETF",
  "Taiwan Semiconductor", "Micron Technology",
];

function svgDe(icono) {
  const ic = si[icono];
  if (!ic) throw new Error(`simple-icons no tiene ${icono} (¿le cambiaron el nombre?)`);
  // viewBox 24 y el color OFICIAL de la marca. Sin width/height: el tamaño lo pone el CSS.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img" aria-label="${ic.title}">`
    + `<title>${ic.title}</title>`
    + `<path fill="#${ic.hex}" d="${ic.path}"/>`
    + `</svg>\n`;
}

const soloComprobar = process.argv.includes("--check");
const fallos = [];

// 1) La regla: cada nombre real da su marca, y ninguno de los tramposos da nada.
for (const [nombre, esperado] of DEBEN_DAR) {
  const visto = marcaDeInversion(nombre);
  if (visto !== esperado) fallos.push(`«${nombre}» debería dar ${esperado} y da ${visto || "nada"}`);
}
for (const mala of NO_DEBEN_CASAR) {
  const s = marcaDeInversion(mala);
  if (s) fallos.push(`«${mala}» se lleva el logo de ${s} y NO debería`);
}

// 2) Todo lo que la app puede devolver TIENE que tener fichero. Si alguien añade una marca en
//    `MARCAS_INVERSION` y se olvida del icono, aquí salta en vez de salir un hueco en su pantalla.
const slugsDeLaApp = new Set(DEBEN_DAR.map(([, s]) => s));
for (const slug of slugsDeLaApp) {
  if (!ICONO_DE[slug]) fallos.push(`la app puede devolver «${slug}» y no hay icono para él en ICONO_DE`);
}

fs.mkdirSync(DEST, { recursive: true });
let total = 0, n = 0;
for (const [slug, icono] of Object.entries(ICONO_DE)) {
  const svg = svgDe(icono);
  const destino = path.join(DEST, slug + ".svg");
  const antes = fs.existsSync(destino) ? fs.readFileSync(destino, "utf8") : null;
  if (soloComprobar) {
    if (antes == null) fallos.push(`falta public/logos/inv/${slug}.svg — ejecuta npm run logos:inv`);
    else if (antes !== svg) fallos.push(`public/logos/inv/${slug}.svg no cuadra con simple-icons`);
  } else {
    fs.writeFileSync(destino, svg, "utf8");
  }
  total += Buffer.byteLength(svg); n++;
  console.log(`  · ${slug.padEnd(10)} ${si[icono].title.padEnd(10)} #${si[icono].hex}  ${svg.length} bytes`);
}

// Lo que se queda sin logo, dicho en voz alta: que no parezca un olvido.
console.log("");
console.log("  sin logo a propósito (no están en simple-icons): TSMC · Micron · FTSE All-World");
console.log(`${soloComprobar ? "comprobados" : "escritos"} ${n} logos · ${(total / 1024).toFixed(1)} KB (fuera del bundle)`);
if (fallos.length) {
  console.error("");
  for (const f of fallos) console.error("✕ " + f);
  process.exit(1);
}