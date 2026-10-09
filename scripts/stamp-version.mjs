#!/usr/bin/env node
/**
 * stamp-version.mjs
 * Sella la versión del Service Worker (public/sw.js) con un identificador único
 * para forzar la invalidación de caché en cada despliegue.
 *
 * El string de versión queda como: "<VERSION>-<fecha>-<sha-corto-o-timestamp>"
 * Resuelve el "gotcha" de tener que bumpear la versión del SW a mano.
 *
 * Uso: node scripts/stamp-version.mjs
 *      MC_STAMP_VERSION=4.11.0.8 node scripts/stamp-version.mjs   (canal beta, ver abajo)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

/* MC_STAMP_VERSION: lo usa `beta.yml`, que publica su manifiesto como `VERSION.RUN_NUMBER`
   (4.11.0.7) para que cada push salga con número nuevo. Si el bundle se sellara con la VERSION
   pelada (4.11.0), la app NUNCA alcanzaría la versión del manifiesto: `_mcNewerVer("4.11.0.7",
   "4.11.0")` da true siempre, así que ofrecía la MISMA beta una y otra vez, para siempre, y
   Ajustes marcaba «v4.11.0» sin decir qué beta llevabas. Lo cazó el usuario en cuanto le llegó la
   primera beta de verdad: «la versión marca la 4.11.0 y todo el maldito rato sale para
   actualizar» (2026-07-26). El sello y el manifiesto tienen que decir LO MISMO. */
const version = (process.env.MC_STAMP_VERSION || "").trim()
  || readFileSync(join(root, "VERSION"), "utf8").trim();

let sha = "";
try {
  sha = execSync("git rev-parse --short HEAD", { cwd: root }).toString().trim();
} catch {
  sha = String(Date.now()).slice(-6); // fallback si no hay git (ej. local sin commit)
}

const date = new Date().toISOString().slice(0, 10); // yyyy-mm-dd
const stamp = `${version}-${date}-${sha}`;

const swPath = join(root, "public", "sw.js");
let sw = readFileSync(swPath, "utf8");

// Reemplaza la línea: const VERSION = "...";
const before = sw;
sw = sw.replace(/const VERSION = ".*?";/, `const VERSION = "${stamp}";`);

// El test de idiomas reconstruye el HTML sin cambiar el SW: el mismo sello debe permitir restaurar APP_VERSION.
if (!/const VERSION = ".*?";/.test(before)) {
  console.error('⚠️  No se encontró `const VERSION = "...";` en public/sw.js');
  process.exit(1);
}

writeFileSync(swPath, sw);
console.log(`✅ Service Worker sellado: VERSION = "${stamp}"`);

// Sella también la versión visible en la app (CONFIG.APP_VERSION)
const idxPath = join(root, "public", "index.html");
let idx = readFileSync(idxPath, "utf8");
const idxBefore = idx;
idx = idx.replace(/APP_VERSION: ".*?"/, `APP_VERSION: "${version}"`);
if (idx === idxBefore) {
  console.error('⚠️  No se encontró `APP_VERSION: "..."` en public/index.html');
} else {
  writeFileSync(idxPath, idx);
  console.log(`✅ App sellada: APP_VERSION = "${version}"`);
}
