#!/usr/bin/env node
/**
 * csp-sellar.mjs — cambia `'unsafe-inline'` de `script-src` por el SHA-256 de cada <script> inline.
 *
 * POR QUÉ (SEG-07, 18/11/2026). La CSP de `src/shell.html` permitía CUALQUIER script inline, así
 * que un HTML colado (un nombre de comercio, una nota, lo que fuera que acabara en el DOM sin
 * escapar) podía ejecutar código con la cartera delante. Con hosting estático no hay nonce por
 * petición, pero sí hay algo mejor: la app ES un único fichero que se construye aquí, así que se
 * sabe exactamente qué scripts inline lleva y se pueden listar por su huella. Uno que no esté en
 * la lista, el navegador no lo ejecuta.
 *
 * DÓNDE SE APLICA: como ÚLTIMO paso de `deploy.yml` y `beta.yml`, después de sellar la versión y
 * de minificar. Cualquier cambio posterior en un script (un byte) lo deja fuera de la lista y la
 * app no arranca, así que nada puede tocar `public/index.html` después de esto. Por eso NO va en
 * `build-app.mjs`: varios e2e reescriben el HTML al servirlo (versión, sha del catálogo…) y con la
 * CSP sellada esos cambios serían scripts desconocidos. El e2e `csp.spec` arranca la app con la
 * CSP sellada de verdad para que lo que sale a los móviles esté probado en un navegador.
 *
 * NI EN `build-www.mjs` (APK). El bundle que va DENTRO de la APK es el de emergencia: si una CSP
 * sellada rompiera algo en la WebView, el OTA se revierte solo (Capgo vuelve atrás si la app no
 * llama a `notifyAppReady` en 10 s), pero el bundle interno no se revierte nunca. Se sellará
 * cuando un bundle sellado haya pasado por el canal beta en un móvil de verdad.
 *
 * Uso:
 *   node scripts/csp-sellar.mjs [fichero]              → sella (por defecto public/index.html)
 *   node scripts/csp-sellar.mjs --comprobar [fichero]  → solo comprueba; sale con 1 si no cuadra
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const META_RE = /(<meta\s+http-equiv="Content-Security-Policy"\s+content=")([^"]*)(")/i;

/* Mismo recorrido que `minify-html.mjs`: los comentarios HTML se saltan ENTEROS, porque alguno
   habla de la etiqueta de script y un regex que no los salte la tomaría por una de verdad. */
export function scriptsInline(html) {
  const out = [];
  const re = /<!--[\s\S]*?-->|<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[0].startsWith("<!--")) continue;
    if (/\bsrc\s*=/i.test(m[1])) continue;   // externo: lo cubre 'self'
    out.push(m[2]);
  }
  return out;
}

/* El navegador convierte CRLF y CR sueltos en LF ANTES de leer el script, y la huella es la del
   texto que ve él. Sin normalizar, un checkout de Windows sellaría huellas que no casan nunca. */
export function huellaScript(cuerpo) {
  const txt = cuerpo.replace(/\r\n?/g, "\n");
  return "'sha256-" + createHash("sha256").update(txt, "utf8").digest("base64") + "'";
}

function directivas(csp) {
  return csp.split(";").map((d) => d.trim()).filter(Boolean);
}

export function sellarCsp(html) {
  const meta = html.match(META_RE);
  if (!meta) throw new Error("no hay <meta> de Content-Security-Policy");
  if (html.match(new RegExp(META_RE.source, "gi")).length !== 1) throw new Error("hay más de una <meta> de CSP");
  const huellas = [...new Set(scriptsInline(html).map(huellaScript))];
  if (!huellas.length) throw new Error("no se encontró ningún <script> inline: el recorrido está roto");
  let tocada = false;
  const nueva = directivas(meta[2]).map((d) => {
    const partes = d.split(/\s+/);
    if (partes[0] !== "script-src") return d;
    tocada = true;
    const resto = partes.slice(1).filter((p) => p !== "'unsafe-inline'" && !/^'sha256-/.test(p));
    return ["script-src", ...resto, ...huellas].join(" ");
  });
  if (!tocada) throw new Error("la CSP no tiene script-src");
  const csp = nueva.join(";") + ";";
  return { html: html.replace(META_RE, (_, a, __, c) => a + csp + c), huellas };
}

/* Devuelve la lista de problemas (vacía = bien). La usa el propio sellado tras escribir y el test. */
export function comprobarCsp(html) {
  const meta = html.match(META_RE);
  if (!meta) return ["no hay <meta> de Content-Security-Policy"];
  const src = directivas(meta[2]).find((d) => d.split(/\s+/)[0] === "script-src");
  if (!src) return ["la CSP no tiene script-src"];
  const tokens = src.split(/\s+/);
  const problemas = [];
  /* En WebViews sin DOCUMENT_START_SCRIPT, Capacitor mete su puente como script inline justo
     DESPUÉS de la primera `<head>` literal (JSInjector); si no la encuentra, antes de `</head>`.
     La <meta> de CSP solo rige lo que viene detrás, así que el puente se salva únicamente si esa
     `<head>` existe tal cual, sin atributos, es la etiqueta de verdad y va antes de la <meta>. Si
     un minificador futuro la tocara, el puente quedaría bloqueado y Capgo revertiría cada OTA a
     los 10 s (revisión de seguridad de la ronda C, P3-2). */
  const cabecera = html.match(/^\s*(?:<!DOCTYPE[^>]*>\s*)?(?:<html\b[^>]*>\s*)?<head>/i);
  const iHead = html.indexOf("<head>");
  if (!cabecera || iHead !== cabecera[0].length - "<head>".length || iHead > html.search(META_RE))
    problemas.push("el documento no empieza por una <head> literal antes de la <meta> de CSP (el puente de Capacitor quedaría bloqueado)");
  if (tokens.includes("'unsafe-inline'")) problemas.push("script-src sigue con 'unsafe-inline'");
  const puestas = new Set(tokens.filter((p) => /^'sha256-/.test(p)));
  const reales = new Set(scriptsInline(html).map(huellaScript));
  for (const h of reales) if (!puestas.has(h)) problemas.push("script inline sin su huella en la CSP: " + h);
  for (const h of puestas) if (!reales.has(h)) problemas.push("huella en la CSP de un script que ya no existe: " + h);
  return problemas;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const soloComprobar = args.includes("--comprobar");
  const fichero = args.find((a) => !a.startsWith("--")) || path.join(root, "public", "index.html");
  let html = readFileSync(fichero, "utf8");
  if (!soloComprobar) {
    const r = sellarCsp(html);
    writeFileSync(fichero, r.html);
    html = readFileSync(fichero, "utf8");
    console.log(`✅ CSP sellada: ${r.huellas.length} scripts inline con su huella, sin 'unsafe-inline' (${path.basename(fichero)})`);
  }
  const problemas = comprobarCsp(html);
  if (problemas.length) {
    for (const p of problemas) console.error("❌ " + p);
    process.exit(1);
  }
  if (soloComprobar) console.log("✅ CSP sellada y en orden");
}
