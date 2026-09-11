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
 * ⚠ DOS FUENTES: llegué a decir que «TSMC y Micron no tienen logo disponible» cuando lo cierto
 * era que no estaban en `simple-icons`. `@iconify-json/logos` (CC0) los tiene.
 *
 * Uso:  node scripts/logos-inversiones.mjs          (regenera public/logos/inv/*.svg)
 *       node scripts/logos-inversiones.mjs --check  (falla si no cuadran; para la suite)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as si from "simple-icons";
import iconify from "@iconify-json/logos/icons.json" with { type: "json" };
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

/* ⚠ SEGUNDA FUENTE, y la lección del día: dije «TSMC y Micron no tienen logo oficial disponible»
   cuando lo cierto era «no están en el paquete que estoy usando». Me lo cazó enseñando su propia
   pantalla de Revolut, donde los dos salen con su logo. No es lo mismo «no existe» que «no lo he
   buscado»: `@iconify-json/logos` (CC0, colección SVG Logos de Gil Barbara) tiene 2.174 marcas,
   y ahí están los dos. Antes de volver a decir que algo no se puede, buscarlo en otro sitio. */
const ICONIFY_DE = {
  tsmc:   "tsmc",
  micron: "micron-icon",   // el símbolo, no el lockup con el nombre al lado
};

/* Nombres REALES tal y como llegan del bróker (de sus capturas de Revolut y Trade Republic).
   El guardián exige que cada uno dé su marca, y que los de abajo NO den ninguna. */
const DEBEN_DAR = [
  // --- empresas por NOMBRE (Trade Republic, MyInvestor) ---
  ["NVIDIA", "nvidia"], ["Advanced Micro Devices", "amd"], ["AMD", "amd"],
  ["Meta Platforms (A)", "meta"], ["Alphabet (Class C)", "alphabet"], ["Broadcom", "broadcom"],
  // --- empresas por TICKER (Revolut). Así llegan de verdad los suyos: en su captura del 11/9
  //     solo salían AMD y Meta porque los otros cinco venían como NVDA / GOOG / AVGO / TSM / MU.
  ["NVDA", "nvidia"], ["GOOG", "alphabet"], ["GOOGL", "alphabet"], ["AVGO", "broadcom"],
  ["TSM", "tsmc"], ["MU", "micron"],
  ["Taiwan Semiconductor", "tsmc"], ["Micron Technology", "micron"],
  // --- categorías (lo que le seguía pareciendo cutre) ---
  ["Oro (XAU)", "oro"], ["Gold", "oro"],
  ["FTSE All-World USD (Acc)", "etf-mundo"], ["Vanguard FTSE All-World UCITS ETF", "etf-mundo"],
  ["iShares Metaverse UCITS", "etf-mundo"], ["Metaverse ETF", "etf-mundo"],
  ["Fidelity MSCI World", "fondo-indice"], ["AMD Ryzen Fondo Tecnologico", "fondo-indice"],
  ["Alphabetical Growth Fund", "fondo-indice"], ["AVGO Bond Fund", "fondo-indice"],
];
/* ⚠ Lo que NO debe llevarse NINGÚN icono: acciones reales sin logotipo disponible, y nombres que
   llevan un ticker DENTRO pero no SON ese ticker. Ojo con los de arriba: un fondo con el nombre
   de una empresa tiene que caer en CATEGORÍA, nunca en la marca — «Metaverse ETF» lleva globo,
   no la cara de Meta, y «AMD Ryzen Fondo» lleva barras, no la de AMD. */
const NO_DEBEN_CASAR = [
  "Meta Materials", "Cartera GOOG y otros", "NVDA 2x Leveraged",
  "Accion sin marca conocida",
];
/* Y que los fondos con nombre de empresa NO se lleven la marca (aunque sí una categoría). */
const NUNCA_ESTA_MARCA = [
  ["Metaverse ETF", "meta"], ["iShares Metaverse UCITS", "meta"],
  ["AMD Ryzen Fondo Tecnologico", "amd"], ["Alphabetical Growth Fund", "alphabet"],
  ["AVGO Bond Fund", "broadcom"],
];

/* Quita los retornos de carro para comparar CONTENIDO y no bytes. Escrito con `split/join` y
   `String.fromCharCode` a propósito: cada vez que este fichero pasa por el shell se le comen las
   barras invertidas, así que aquí no hay ninguna. Ya me ha mordido cuatro veces hoy. */
function sinRetornos(txt) {
  return String(txt == null ? "" : txt).split(String.fromCharCode(13)).join("");
}

function svgDe(icono) {
  const ic = si[icono];
  if (!ic) throw new Error(`simple-icons no tiene ${icono} (¿le cambiaron el nombre?)`);
  // viewBox 24 y el color OFICIAL de la marca. Sin width/height: el tamaño lo pone el CSS.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img" aria-label="${ic.title}">`
    + `<title>${ic.title}</title>`
    + `<path fill="#${ic.hex}" d="${ic.path}"/>`
    + `</svg>\n`;
}

function svgDeIconify(nombre) {
  const ic = iconify.icons[nombre];
  if (!ic) throw new Error(`@iconify-json/logos no tiene ${nombre}`);
  const w = ic.width || iconify.width || 24, h = ic.height || iconify.height || 24;
  // Se respeta su viewBox: el `object-fit: contain` del <img> lo encaja en el cuadro.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-hidden="true">`
    + ic.body + `</svg>` + String.fromCharCode(10);
}

/* CATEGORÍAS — aquí SÍ se dibuja, y es legítimo: no hay logotipo de marca que copiar, es
   iconografía. Petición suya: «para el oro métele un lingote, y para el FTSE All-World y el MSCI
   World algo distintivo, al final uno es un ETF y otro un fondo indexado. Sorpréndeme sin ser
   algo cutre». Geometría simple y plana, que a 38 px es lo único que se lee. */
const CATEGORIAS = {
  /* Lingote. La primera versión salía como una cajita: el cuerpo se estrechaba hacia abajo y era
     casi cuadrado. Un lingote real es ANCHO, y su cara frontal es un trapecio **más ancho abajo**
     (la base es lo que apoya). La cara de arriba va detrás, en perspectiva y más estrecha. */
  oro: `<defs><linearGradient id="o" x1="0" y1="0" x2="0.35" y2="1">`
    + `<stop offset="0%" stop-color="#F6CE63"/><stop offset="55%" stop-color="#DCA22F"/>`
    + `<stop offset="100%" stop-color="#A06E15"/></linearGradient></defs>`
    + `<path fill="#FBE7A6" d="M7.6 8.1h8.8l2.6 3.6H5z"/>`
    + `<path fill="url(#o)" d="M5 11.7h14l1.6 5.6H3.4z"/>`
    + `<path fill="#FFFFFF" opacity=".28" d="M5.9 12.6h12.2l.3 1.1H5.6z"/>`,
  // Globo: la Tierra con meridiano y dos paralelos. Un ETF mundial ES el mundo.
  "etf-mundo": `<g fill="none" stroke="#2F80ED" stroke-width="1.8" stroke-linecap="round">`
    + `<circle cx="12" cy="12" r="8.4"/><ellipse cx="12" cy="12" rx="3.7" ry="8.4"/>`
    + `<path d="M4.2 9.3h15.6M4.2 14.7h15.6"/></g>`,
  // Barras que suben: un fondo indexado es una cesta que se acumula. Distinto de un vistazo.
  "fondo-indice": `<g fill="#7C6BE8">`
    + `<rect x="3.8" y="13.2" width="4.3" height="6.9" rx="1.5"/>`
    + `<rect x="9.9" y="9.4" width="4.3" height="10.7" rx="1.5"/>`
    + `<rect x="16" y="4.9" width="4.3" height="15.2" rx="1.5" fill="#5A48C9"/></g>`,
};

const soloComprobar = process.argv.includes("--check");
const fallos = [];

// 1) La regla: cada nombre real da su marca, y ninguno de los tramposos da nada.
for (const [nombre, esperado] of DEBEN_DAR) {
  const visto = marcaDeInversion(nombre);
  if (visto !== esperado) fallos.push(`«${nombre}» debería dar ${esperado} y da ${visto || "nada"}`);
}
for (const mala of NO_DEBEN_CASAR) {
  const s = marcaDeInversion(mala);
  if (s) fallos.push(`«${mala}» se lleva el icono de ${s} y NO debería llevar ninguno`);
}
// Un fondo con nombre de empresa lleva CATEGORÍA, nunca la cara de esa empresa.
for (const [nombre, marcaProhibida] of NUNCA_ESTA_MARCA) {
  const s = marcaDeInversion(nombre);
  if (s === marcaProhibida) fallos.push(`«${nombre}» se lleva la marca ${marcaProhibida} y es un fondo, no la empresa`);
}

// 2) Todo lo que la app puede devolver TIENE que tener fichero. Si alguien añade una marca en
//    `MARCAS_INVERSION` y se olvida del icono, aquí salta en vez de salir un hueco en su pantalla.
// Solo las MARCAS necesitan icono de simple-icons; las categorías se dibujan aquí.
const slugsDeLaApp = new Set(DEBEN_DAR.map(([, s]) => s)
  .filter((s) => !CATEGORIAS[s] && !ICONIFY_DE[s]));
for (const slug of slugsDeLaApp) {
  if (!ICONO_DE[slug]) fallos.push(`la app puede devolver «${slug}» y no hay icono para él en ICONO_DE`);
}

fs.mkdirSync(DEST, { recursive: true });

// Las de la segunda fuente (TSMC, Micron): las que NO están en simple-icons.
for (const [slug, nombre] of Object.entries(ICONIFY_DE)) {
  const svg = svgDeIconify(nombre);
  const destino = path.join(DEST, slug + ".svg");
  const antes = fs.existsSync(destino) ? fs.readFileSync(destino, "utf8") : null;
  if (soloComprobar) {
    if (antes == null) fallos.push(`falta public/logos/inv/${slug}.svg — ejecuta npm run logos:inv`);
    else if (sinRetornos(antes) !== sinRetornos(svg)) fallos.push(`public/logos/inv/${slug}.svg no cuadra`);
  } else {
    fs.writeFileSync(destino, svg, "utf8");
  }
  console.log(`  · ${slug.padEnd(14)} (SVG Logos, CC0)      ${svg.length} bytes`);
}

// Las categorías dibujadas: mismo viewBox y mismo trato que los oficiales.
for (const [slug, cuerpo] of Object.entries(CATEGORIAS)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img" aria-hidden="true">${cuerpo}</svg>` + String.fromCharCode(10);
  const destino = path.join(DEST, slug + ".svg");
  const antes = fs.existsSync(destino) ? fs.readFileSync(destino, "utf8") : null;
  if (soloComprobar) {
    if (antes == null) fallos.push(`falta public/logos/inv/${slug}.svg — ejecuta npm run logos:inv`);
    else if (sinRetornos(antes) !== sinRetornos(svg)) fallos.push(`public/logos/inv/${slug}.svg no cuadra`);
  } else {
    fs.writeFileSync(destino, svg, "utf8");
  }
  console.log(`  · ${slug.padEnd(14)} (categoría dibujada)  ${svg.length} bytes`);
}
let total = 0, n = 0;
for (const [slug, icono] of Object.entries(ICONO_DE)) {
  const svg = svgDe(icono);
  const destino = path.join(DEST, slug + ".svg");
  const antes = fs.existsSync(destino) ? fs.readFileSync(destino, "utf8") : null;
  if (soloComprobar) {
    if (antes == null) fallos.push(`falta public/logos/inv/${slug}.svg — ejecuta npm run logos:inv`);
    // Se compara el CONTENIDO, no los bytes: git normaliza los finales de línea al commitear
    // (LF en el índice, CRLF en el disco de Windows) y un guardián byte a byte se pone rojo
    // por eso, sin que nadie haya tocado un logo. Pasó justo al integrar la 4.19.59.
    else if (sinRetornos(antes) !== sinRetornos(svg)) {
      fallos.push(`public/logos/inv/${slug}.svg no cuadra con simple-icons`);
    }
  } else {
    fs.writeFileSync(destino, svg, "utf8");
  }
  total += Buffer.byteLength(svg); n++;
  console.log(`  · ${slug.padEnd(10)} ${si[icono].title.padEnd(10)} #${si[icono].hex}  ${svg.length} bytes`);
}

// Lo que se queda sin logo, dicho en voz alta: que no parezca un olvido.
console.log("");
console.log("  sin logo: solo lo que de verdad no tiene marca — cae a las iniciales del activo");
console.log(`${soloComprobar ? "comprobados" : "escritos"} ${n} logos · ${(total / 1024).toFixed(1)} KB (fuera del bundle)`);
if (fallos.length) {
  console.error("");
  for (const f of fallos) console.error("✕ " + f);
  process.exit(1);
}