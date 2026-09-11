#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  RELEASE_NOTES_MAX_ESPERADO,
  contarReleaseNotesEnJs,
  leerReleaseNotesMax,
  truncarReleaseNotesEnJs,
} from "../scripts/release-notes-max.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = fs.readFileSync(path.join(root, "src/modules/10-app-components.js"), "utf8");
const bundle = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
const max = leerReleaseNotesMax(source);

assert.equal(max, RELEASE_NOTES_MAX_ESPERADO, "el tope no se sube por holgura");
assert.ok(contarReleaseNotesEnJs(source) >= max, "la fuente conserva al menos el histórico visible");
assert.equal(contarReleaseNotesEnJs(bundle), max, "el bundle debe llevar exactamente N notas tras build");
assert.equal(contarReleaseNotesEnJs(truncarReleaseNotesEnJs(source, max)), max, "el recorte conserva N entradas");
console.log("release-notes-max: OK");
