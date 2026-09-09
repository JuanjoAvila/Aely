#!/usr/bin/env node
/**
 * Ensambla public/index.html desde src/shell.html + src/modules/*.js
 * Fuente editable: src/modules/ (no public/index.html directamente).
 *
 * RELEASE_NOTES (NOTAS-BUNDLE, 2026-09-09): el histórico vive en
 * src/data/release-notes.json → public/release-notes.json. El index solo lleva un
 * array vacío (o un slim de beta si cupiera); la app pide el JSON al abrir Novedades
 * y al montar el panel de beta. Así bajar RELEASE_NOTES_MAX no le vacía la checklist.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  leerReleaseNotesMax,
  leerReleaseNotesJson,
  inyectarReleaseNotesEnJs,
  packReleaseNotesForBundle,
  contarReleaseNotesEnJs,
} from "./release-notes-max.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const order = JSON.parse(fs.readFileSync(path.join(root, "src", "build-order.json"), "utf8"));
const modDir = path.join(root, "src", "modules");

let js = "";
for (const file of order) {
  const p = path.join(modDir, file);
  if (!fs.existsSync(p)) {
    console.error(`Falta módulo: ${file}`);
    process.exit(1);
  }
  js += fs.readFileSync(p, "utf8");
  if (!js.endsWith("\n")) js += "\n";
}

// DSN opcional (CI o local): SENTRY_DSN=https://…@… ingest…
const dsn = (process.env.SENTRY_DSN || "").trim();
if (dsn) {
  js = js.replace(/SENTRY_DSN:\s*""/, `SENTRY_DSN: ${JSON.stringify(dsn)}`);
}

const allNotes = leerReleaseNotesJson();
const rnMax = leerReleaseNotesMax(js);
/* El pack del index va VACÍO a propósito: con la ronda 4.19.x entera en slim el gzip
   seguía a 322 KB (>320). El histórico completo baja aparte (release-notes.json) y la
   app lo carga al montar. RELEASE_NOTES_MAX solo limita la UI de Novedades. */
const packed = packReleaseNotesForBundle(allNotes, rnMax);
js = inyectarReleaseNotesEnJs(js, packed);
console.log(`  · RELEASE_NOTES: ${allNotes.length} en JSON · ${contarReleaseNotesEnJs(js)} en index (max UI ${rnMax})`);

const pubNotes = path.join(root, "public", "release-notes.json");
fs.writeFileSync(pubNotes, JSON.stringify(allNotes));
console.log(`  · public/release-notes.json (${(fs.statSync(pubNotes).size / 1024).toFixed(0)} KB, ${allNotes.length} versiones)`);

let shell = fs.readFileSync(path.join(root, "src", "shell.html"), "utf8");
const MARK = "<!--MC_APP_SCRIPT-->";
if (!shell.includes(MARK)) {
  console.error("shell.html sin marcador <!--MC_APP_SCRIPT-->");
  process.exit(1);
}
const parts = shell.split(MARK);
if (parts.length !== 2) {
  console.error("marcador MC_APP_SCRIPT debe aparecer exactamente una vez");
  process.exit(1);
}
shell = parts[0] + js.trimEnd() + parts[1];

const out = path.join(root, "public", "index.html");
fs.writeFileSync(out, shell);
console.log(`✅ public/index.html (${(shell.length / 1024).toFixed(0)} KB, ${order.length} módulos)`);
