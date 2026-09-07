/**
 * Guardián B09-A2 (2026-09-07): el useEffect de umbrales 50/80/95/100 (`_bn`) debe listar
 * `state.accounts` y `state.settings` en sus deps — monthBudgetStats → expenseBankEnts.
 * Sin eso, cambiar bancos de gasto diario no reevaluaba el % (espejo de B09-A en la cabecera).
 *
 * Guardián de FUENTE a propósito: el e2e del umbral sigue pendiente porque `page.clock`
 * deja el botnav/Editar inaccesibles. Borrar este test el día que exista e2e de verdad.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const main = readFileSync(join(root, "src/modules/11-app-main.js"), "utf8");

const marker = main.indexOf('"_bn"+th');
assert.ok(marker >= 0, "no se encuentra el useEffect de umbrales (_bn)");

const after = main.slice(marker, marker + 800);
const depsMatch = after.match(/\},\[([^\]]+)\]\)/);
assert.ok(depsMatch, "no se encuentra el array de deps del useEffect _bn");
const deps = depsMatch[1];

assert.match(deps, /\bstate\.accounts\b/, "deps del useEffect _bn deben incluir state.accounts");
assert.match(deps, /\bstate\.settings\b/, "deps del useEffect _bn deben incluir state.settings");
assert.doesNotMatch(
  deps,
  /state\.settings\s*&&\s*state\.settings\.gTotalMode/,
  "no volver al dep estrecho gTotalMode (regresión B09-A2)"
);

console.log("ok: useEffect _bn depende de accounts + settings");
