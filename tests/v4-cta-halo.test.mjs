#!/usr/bin/env node
/** El halo de `.v4-cta` no puede quedar recortado ni brillar bajo un askConfirm (12/9).
 *  4.19.104: la columna flex+overflow:hidden SOLO aplica a hojas con `.v4-sheet-body`
 *  (Apuntar / ficha); el resto scrollea la hoja entera. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shell = fs.readFileSync(path.join(root, "src/shell.html"), "utf8");
const ask = fs.readFileSync(path.join(root, "src/modules/05-dialogs-inv.js"), "utf8");
const css = shell.replace(/\/\*[\s\S]*?\*\//g, "");

function t(name, fn) {
  try { fn(); console.log("  ✓ " + name); }
  catch (e) { console.error("  ✗ " + name); throw e; }
}

console.log("v4-cta-halo");

t("hojas SIN body scrollean enteras (filtro / Más…)", () => {
  assert.match(
    css,
    /\.v4-sheet\{[^}]*overflow:\s*auto/,
    ".v4-sheet por defecto overflow:auto"
  );
  assert.match(
    css,
    /\.v4-sheet\{[^}]*padding:[^;]*calc\(36px \+ var\(--safe-bottom\)\)/,
    "padding-bottom base 36 px en hojas sin body"
  );
});

t("hojas CON body: columna + CTA fijo + pad del halo", () => {
  assert.match(
    css,
    /\.v4-sheet:has\(>\.v4-sheet-body\)\{[^}]*display:\s*flex[^}]*flex-direction:\s*column[^}]*overflow:\s*hidden/,
    ".v4-sheet:has(>.v4-sheet-body) en columna con overflow:hidden"
  );
  assert.match(css, /\.v4-sheet-body\{[^}]*overflow:\s*auto/, "falta .v4-sheet-body con scroll");
  assert.match(
    css,
    /\.v4-sheet:has\(>\.v4-sheet-body\)\{[^}]*padding-bottom:\s*calc\(52px \+ var\(--safe-bottom\)\)/,
    "padding-bottom ≥ offset+blur del halo (~42 px → 52) solo con body"
  );
});

t("con ask abierto se apaga el halo ANTES del paint (no se «sobrepone» Guardar al borrar)", () => {
  assert.match(
    css,
    /html\.ask-open\s+\.v4-cta\{box-shadow:\s*none;?\}/,
    "falta html.ask-open .v4-cta{box-shadow:none}"
  );
  assert.match(ask, /useLayoutEffect\s*\(/, "AskHost marca ask-open en useLayoutEffect (antes del paint)");
  assert.match(ask, /classList\.add\(["']ask-open["']\)/, "AskHost tiene que marcar html.ask-open");
});

console.log("v4-cta-halo: OK");
