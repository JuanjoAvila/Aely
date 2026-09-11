#!/usr/bin/env node
/**
 * LOS LOGOS DE SUS BANCOS, RECORTADOS DEL ORIGINAL — NO DIBUJADOS.
 *
 * El 11/9/2026 se intentaron DIBUJAR a mano cuatro veces (iniciales, formas a ojo, trazos
 * medidos de una captura del launcher, y otra ronda más). Su veredicto de las cuatro:
 * «qué puta mierda es esa, no son los logos» y «parecen logos de aliexpress». Tenía razón:
 * con `<text>` de la fuente del sistema y curvas a ojo no sale el logotipo de una marca,
 * sale una imitación.
 *
 * Esto recorta el ISOTIPO del PNG OFICIAL que ya está en `docs/design/bancos/` (bajados del
 * directorio de Enable Banking, campo `logo` de `bank-aspsps` — la misma fuente por la que la
 * app conecta con sus bancos, y que la app YA enseña en el selector de bancos).
 *
 * Por qué ficheros y no SVG inline: el bundle va al 99 % del presupuesto de gzip (326/330 KB) y
 * un PNG en `public/logos/` no cuenta para ese tope, se cachea aparte y viaja igual dentro del
 * APK (`build-www.mjs` copia `public/`).
 *
 * Uso:  node scripts/logos-bancos.mjs        (regenera public/logos/*.png)
 *       node scripts/logos-bancos.mjs --check (falla si algo no cuadra; para el CI)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ORIG = path.join(root, "docs/design/bancos");
const DEST = path.join(root, "public/logos");
const LADO = 96;          // 40 px en pantalla · 2,4x para pantallas densas
const OCUPA = 0.66;       // cuánto del cuadro ocupa el símbolo. Un icono de app lleva AIRE:
                          // a 0,88 «la B gigante» y «las olas en gigante» — rechazado 11/9.

/* Franja del PNG donde vive el ISOTIPO, EN PÍXELES y medida con el detector de componentes
   (columnas con tinta separadas por columnas vacías), no a ojo ni en porcentajes.
   Un porcentaje redondo ya cortó la R de Revolut 118 px: su veredicto fue «revolut cortado».
   `comprueba` verifica que el contenido no toca los bordes del recorte: si toca, hay clipping. */
const RECORTES = {
  // la bola azul con la B + la S: es el icono que tiene en el móvil, no la B sola
  sabadell:        { x0: 3,    x1: 282  },
  /* La R entera: x 0..851, medido por las filas de ARRIBA (la R es el único glifo de altura
     completa al principio; las minúsculas no llegan). La «e» arranca en 852 sin ni una columna
     en blanco, así que aquí el aviso de corte es un falso positivo y va reconocido a mano. */
  revolut:         { x0: 0,    x1: 851, vecinoPegado: true },
  // las dos cintas en zigzag, a la derecha del nombre
  trade_republic:  { x0: 1797, x1: 1999 },
  // el aro de colores con el «my» dentro
  myinvestor:      { x0: 351,  x1: 848  },
  // la estrella de Miró con sus dos puntos
  caixabank:       { x0: 2,    x1: 259  },
};
const lee = (f) => PNG.sync.read(fs.readFileSync(f));

/** ¿Ese píxel tiene tinta? Opaco y no casi-blanco: los originales vienen sobre blanco. */
function tinta(img, x, y) {
  const i = (img.width * y + x) << 2;
  if (img.data[i + 3] < 40) return false;
  return !(img.data[i] > 240 && img.data[i + 1] > 240 && img.data[i + 2] > 240);
}

/** Caja del contenido dentro de la franja, en píxeles. Sin esto, el recorte sale descentrado. */
function caja(img, X0, X1) {
  X0 = Math.max(0, X0); X1 = Math.min(img.width, X1 + 1);
  let mnx = Infinity, mny = Infinity, mxx = -1, mxy = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = X0; x < X1; x++) {
      if (!tinta(img, x, y)) continue;
      if (x < mnx) mnx = x; if (x > mxx) mxx = x;
      if (y < mny) mny = y; if (y > mxy) mxy = y;
    }
  }
  if (mxx < 0) throw new Error("franja sin contenido");
  /* Recortar justo donde acaba el símbolo es lo CORRECTO; lo que delata un corte es que haya
     tinta en la columna de FUERA, pegada al borde. Así se habría cazado la R de Revolut, que
     seguía 118 px más allá del 13,5 % que yo había puesto a ojo. */
  const col = (x) => { if (x < 0 || x >= img.width) return false;
    for (let y = 0; y < img.height; y++) if (tinta(img, x, y)) return true; return false; };
  return { x: mnx, y: mny, w: mxx - mnx + 1, h: mxy - mny + 1,
           cortaIzq: col(X0 - 1), cortaDer: col(X1) };
}

/** Media de área (box filter). Al reducir 5-10x, un muestreo simple deja el trazo hecho jirones. */
function reduce(img, src, dw, dh, dest, ox, oy) {
  for (let ty = 0; ty < dh; ty++) {
    for (let tx = 0; tx < dw; tx++) {
      const sx0 = src.x + (tx * src.w) / dw, sx1 = src.x + ((tx + 1) * src.w) / dw;
      const sy0 = src.y + (ty * src.h) / dh, sy1 = src.y + ((ty + 1) * src.h) / dh;
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let y = Math.floor(sy0); y < Math.max(Math.ceil(sy1), Math.floor(sy0) + 1); y++) {
        for (let x = Math.floor(sx0); x < Math.max(Math.ceil(sx1), Math.floor(sx0) + 1); x++) {
          if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue;
          const i = (img.width * y + x) << 2;
          const al = img.data[i + 3] / 255;
          // Sobre blanco: un píxel transparente del original es blanco, no negro.
          r += img.data[i] * al + 255 * (1 - al);
          g += img.data[i + 1] * al + 255 * (1 - al);
          b += img.data[i + 2] * al + 255 * (1 - al);
          a += 255; n++;
        }
      }
      if (!n) continue;
      const i = (dest.width * (oy + ty) + (ox + tx)) << 2;
      dest.data[i] = Math.round(r / n); dest.data[i + 1] = Math.round(g / n);
      dest.data[i + 2] = Math.round(b / n); dest.data[i + 3] = Math.round(a / n);
    }
  }
}

const soloComprobar = process.argv.includes("--check");
fs.mkdirSync(DEST, { recursive: true });
const fallos = [];
let total = 0;

for (const [ent, { x0, x1, vecinoPegado }] of Object.entries(RECORTES)) {
  const origen = path.join(ORIG, ent + ".png");
  if (!fs.existsSync(origen)) { fallos.push(`falta el original ${ent}.png`); continue; }
  const img = lee(origen);
  const c = caja(img, x0, x1);
  if (c.cortaDer && !vecinoPegado) fallos.push(`${ent}: hay tinta pegada en x=${x1 + 1} — el símbolo sigue y lo estás cortando`);
  if (c.cortaIzq) fallos.push(`${ent}: hay tinta pegada en x=${x0 - 1} — el símbolo empieza antes y lo estás cortando`);
  const lado = Math.max(c.w, c.h);
  const util = Math.round(LADO * OCUPA);
  const dw = Math.max(1, Math.round((c.w / lado) * util));
  const dh = Math.max(1, Math.round((c.h / lado) * util));

  const out = new PNG({ width: LADO, height: LADO });
  out.data.fill(255);                         // fondo blanco, como el icono del launcher
  reduce(img, c, dw, dh, out, Math.round((LADO - dw) / 2), Math.round((LADO - dh) / 2));

  const buf = PNG.sync.write(out, { deflateLevel: 9 });
  const destino = path.join(DEST, ent + ".png");
  const antes = fs.existsSync(destino) ? fs.readFileSync(destino) : null;
  if (soloComprobar) {
    if (!antes) fallos.push(`falta public/logos/${ent}.png — ejecuta npm run logos`);
    else if (!antes.equals(buf)) fallos.push(`public/logos/${ent}.png no cuadra con el original`);
  } else {
    fs.writeFileSync(destino, buf);
  }
  total += buf.length;
  console.log(`  · ${ent.padEnd(16)} recorte ${c.w}x${c.h} → ${dw}x${dh} en ${LADO}px · ${(buf.length / 1024).toFixed(1)} KB`);
}

console.log(`\n${soloComprobar ? "comprobados" : "escritos"} 5 logos · ${(total / 1024).toFixed(1)} KB en total (fuera del bundle)`);
if (fallos.length) { console.error("\n✕ " + fallos.join("\n✕ ")); process.exit(1); }
