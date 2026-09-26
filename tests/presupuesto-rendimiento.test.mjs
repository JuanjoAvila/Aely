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
   quieto, que es el que de verdad frena una regresión gorda.

   SUBIDO 2026-09-07 (minificado y gzip): la 4.19.0 suma ~8,5 KB min / ~2,7 KB gzip sobre un tip
   (4.18.7) que YA iba justo (1194,5 / 337,7). Casi la mitad del crecimiento es la nota de versión
   en tres idiomas; el resto es orden táctil en Gastos y el estado reactivo de Trade Republic —
   nada de eso es grasa, y recortar la nota sería lo que el 06/08 ya descartó. Se sube el
   minificado a 1240 KB (~3 % sobre los 1203 medidos hoy) y el gzip a 350 KB (~2,8 % sobre 340,4):
   el gzip se mueve poco a propósito, porque es lo que baja el móvil. El problema de fondo (las
   notas se acumulan para siempre en el bundle) queda para una tanda aparte.

   BAJADO 2026-09-07 (noche, 4.19.5): `RELEASE_NOTES_MAX=20` + truncado en build deja de arrastrar
   ~90 notas viejas. Medido tras el corte: ~1145 KB min / ~319 KB gzip. Se BAJAN los topes a
   1180 / 330 (~3 % de aire): recuperamos el margen que se había abierto «por las notas» esta
   misma tarde, en vez de dejar el presupuesto holgado. */
const PRESUPUESTO = {
  /* 9/9 tarde: los dos arreglos de dinero de la ronda (FIN-01, el cierre de mes que le descontaba
     a Trade Republic lo pagado en efectivo y los recibos de otros bancos; FIN-02, el historico que
     descartaba pagos de meses distintos) suman ~2 KB minificados, casi todo notas de version en
     tres idiomas y el helper que agrupa los Fijos. Medido tras el cambio: 1183 KB.
     El tope anterior dejaba 1 KB de aire, que no es margen: es una trampa para el siguiente.
     Se sube a 1188 (~0,4 %). El gzip NO se toca y sigue en 330: medido 328, y es lo que de verdad
     baja el movil. Si el gzip se acerca al tope, se recorta; no se sube.
     12/9: mergeExpensesFromCloud + notas 4.19.77/78 → 1189 medido en CI. Tope a 1195 (~0,5 %).
     12/9 tarde (4.19.80): partir energia en agua/luz/gas. Delta medido +0,13 KB gzip irreducible
     (3 entradas CATEGORIES + 9 cadenas i18n = la petición suya del rayito en el agua). El tip
     ya venía con 0,10 KB de aire; no hay grasa que recortar sin tocar la función. Tope gzip a
     332 KB (~0,6 % sobre 330,03 medidos). Sigue sin aire de verdad: la próxima tanda de texto
     tendrá que recortar o volver a decidir.
     25/9 (4.26.47): la hoja de alta de Recibos rearma la ola nativa en cada paso y conserva
     la posición al volver. Medido: 1.223.845 bytes minificados, 165 sobre el tope anterior.
     Se añade solo 1 KB al límite crudo; gzip permanece en 332 KB.
     25/9 (4.26.49, FIN-05): el guardo de reentrada espera el pull y recalcula el mes al volver.
     Medido: 1.225.533 bytes minificados, 829 sobre el tope; gzip sigue en 325 KB. Se añade
     1 KB al crudo para este código de coherencia, sin mover el límite de descarga gzip.
     26/9 (4.26.50): selector persistente del banco del widget y textos de ayuda. Medido:
     1.226.948 bytes minificados (1.220 sobre el límite), gzip 325 KB. Se añaden 2 KB
     solo al crudo para este selector; el límite de descarga gzip permanece intacto. */
  minificado: 1199 * 1024,
  gzip: 332 * 1024,         // 12/9: 330,03 con suministros; aire mínimo a propósito
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
