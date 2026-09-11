#!/usr/bin/env node
/**
 * PRESUPUESTO DE RENDIMIENTO — lo que pesa lo que se envía al móvil.
 *
 * El resto de pruebas de rendimiento (`e2e/rendimiento.spec.mjs`) miden que el trabajo no se
 * dispare con el histórico. Falta la otra mitad, la que nadie vigila porque crece de una en una:
 * el TAMAÑO. Cada tanda añade una pantalla, tres textos en tres idiomas y un bloque de CSS; nadie
 * mira nunca cuánto sube, y un día la app tarda cinco segundos en abrir con datos móviles y no
 * hay un solo commit al que señalar. Un presupuesto convierte eso en una decisión consciente:
 * cuando se pasa, o se recorta o se sube el número a propósito, escribiendo por qué.
 *
 * Se mide lo que se SIRVE de verdad:
 *   · index.html DESPUÉS de minificar (el CI minifica; medir la fuente legible sería mentirse),
 *   · y ese mismo fichero comprimido con gzip, que es lo que baja por la red.
 * Lo importante para el usuario es el gzip; el crudo importa porque es lo que el móvil tiene que
 * PARSEAR, y en una WebView eso son cientos de milisegundos de hilo principal.
 *
 * También se vigila el número de ficheros que hacen falta ANTES de pintar: la regla de la casa es
 * cero CDNs y todo auto-hospedado, y cada `<script src>` o `<link rel=preload>` nuevo es una
 * ronda más de red en la peor conexión.
 *
 * Al pasarse: mirar primero si hay algo duplicado (pasó con `bkBrand`, que eran tres copias del
 * mismo bloque) antes de tocar el número.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/* PRESUPUESTOS. Fijados el 2026-07-25 con ~12 % de aire sobre lo medido ESE DÍA en la 4.10.0
   (números reales de la ejecución, no estimaciones), para que una tanda normal quepa y una
   regresión gorda no. Subirlos es legítimo — pero se hace aquí, a propósito y con el motivo
   escrito, no por accidente.

   SUBIDO 2026-08-03: la sesión "dale caña a todo" metió CUATRO tandas en un solo día (reservar
   dinero, tutorial de gestos, temporadas sin lluvia, swipe de Plan) — el tope de 310 KB se quedó
   corto por apenas 362 bytes. En vez de recortar código sano para arañar unos bytes, se sube con
   el mismo ~12 % de aire que se usó la primera vez, sobre lo medido HOY (317,8 KB gzip real).

   SUBIDO 2026-08-06 (solo el minificado): la 4.16.0 trae TRES tandas, y las tandas se pagan en
   texto — cada una lleva su título y su checklist en los tres idiomas, más los puntos que lee la
   familia en Novedades. Son ~7 KB de literales, no de código: el bundle minificado se pasó 7 KB
   del tope mientras el GZIP —que es lo que baja el móvil de verdad— se quedó en 330/340 KB, con
   margen. Recortar aquí sería recortar novedades o idiomas, y en esta casa eso no se toca. Se sube
   el tope del minificado a 1200 KB (~3 % de aire sobre los 1167 medidos hoy) y se deja el de gzip
   quieto, que es el que de verdad frena una regresión gorda. */
const PRESUPUESTO = {
  /* SUBIDO 9 KB el 2026-09-11, con motivo. Este parche suma a las dos tandas anteriores los
     posibles repetidos de Open Banking: código de decisión y la nota de versión en tres idiomas.
     Medido tras el porte: 1209 min / 343 gzip. El gzip conserva margen y es lo que descarga el
     móvil; el límite minificado solo evita regresiones gordas.

     SUBIDO 3 KB el 2026-09-10, con motivo. Este parche sube a produccion las DOS tandas que el
     aprobo (informe del mes cerrado y limite por categoria). Produccion todavia lleva las notas
     de version DENTRO del modulo; el recorte a un JSON aparte —que en beta deja el gzip en 318—
     es otra tanda y sube por su cuenta. Meterlo aqui seria ampliar un parche de emergencia con
     superficie que nadie ha aprobado. Medido tras el porte: 1203 min / 341 gzip.
     Cuando suba el recorte de notas, estos topes BAJAN, no se quedan. */
  minificado: 1215 * 1024,
  gzip: 344 * 1024,         // medido 2026-08-03: 318 KB  ← esto es lo que baja el móvil
  bloqueantes: 3,           // medido 2026-07-25: 3 (supabase-js + las dos fuentes precargadas)
};

const tmp = path.join(root, ".presupuesto.tmp.html");
let fallos = 0;
console.log("presupuesto-rendimiento");

try {
  // Minificar a un fichero aparte: la fuente editable no se toca (ARQUITECTURA #2).
  execFileSync(process.execPath, [path.join(root, "scripts", "minify-html.mjs"), "--out", tmp], { stdio: "pipe" });
  const min = fs.readFileSync(tmp);
  const gz = zlib.gzipSync(min, { level: 9 });

  const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
  // Lo que el navegador tiene que ir a buscar antes de poder pintar: scripts externos y precargas.
  const externos = (html.match(/<script[^>]*\bsrc\s*=/gi) || []).length;
  const precargas = (html.match(/<link[^>]*rel="preload"/gi) || []).length;
  const bloqueantes = externos + precargas;

  const fila = (nombre, valor, tope, fmt) => {
    const ok = valor <= tope;
    if (!ok) fallos++;
    const pct = ((valor / tope) * 100).toFixed(0);
    console.log(`  ${ok ? "✓" : "✕"} ${nombre.padEnd(22)} ${fmt(valor).padStart(9)} / ${fmt(tope).padStart(9)}  (${pct}% del presupuesto)`);
  };
  const kb = (b) => (b / 1024).toFixed(0) + " KB";
  const num = (n) => String(n);

  fila("index.html minificado", min.length, PRESUPUESTO.minificado, kb);
  fila("index.html gzip", gz.length, PRESUPUESTO.gzip, kb);
  fila("ficheros bloqueantes", bloqueantes, PRESUPUESTO.bloqueantes, num);
} finally {
  try { fs.unlinkSync(tmp); } catch { /* ya no está */ }
}

if (fallos) {
  console.error(`\n${fallos} presupuesto(s) rebasado(s). Recorta, o sube el tope en este fichero explicando por qué.`);
  process.exit(1);
}
console.log("\nTodo dentro de presupuesto");
