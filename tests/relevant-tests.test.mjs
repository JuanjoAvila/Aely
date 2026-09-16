#!/usr/bin/env node
/**
 * El recorte de tests de la rama beta no puede callarse: un spec HUÉRFANO (sin línea en
 * el mapa) es el mismo agujero que un test que nadie ejecuta. Un spec MAL COLGADO (en el
 * módulo equivocado) NO lo caza este fichero — el mapa es a mano. Un verde en `beta` no
 * pesa lo mismo que un verde en `main`.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planFromFiles, CORE, E2E_MAP, CROSSCUTTING } from "../scripts/relevant-tests.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function t(name, fn) {
  try { fn(); console.log("  ✓ " + name); }
  catch (e) { console.error("  ✗ " + name); throw e; }
}

console.log("relevant-tests");

t("solo un .md no instala Chromium", () => {
  const p = planFromFiles(["docs/TESTING.md", "CHANGELOG.md"]);
  assert.equal(p.playwright, false);
  assert.equal(p.deno, false);
  assert.equal(p.build, false);
  assert.equal(p.e2e, "none");
  assert.ok(p.steps.includes("docs-frescura"));
});

t("solo ingest: Deno sí, Playwright no", () => {
  const p = planFromFiles(["supabase/functions/ingest/index.ts", "supabase/functions/_shared/presupuesto.ts"]);
  assert.equal(p.deno, true);
  assert.equal(p.playwright, false);
  assert.equal(p.e2e, "none");
  assert.ok(p.steps.includes("presupuesto-servidor"));
});

t("solo bank-sync conserva los guardianes de paginado sin arrancar Chromium", () => {
  const p = planFromFiles(["supabase/functions/bank-sync/index.ts"]);
  assert.equal(p.playwright, false);
  assert.ok(p.steps.includes("bank-sync-paging"));
  assert.ok(p.steps.includes("tr-open-banking"));
});

t("solo Android: widget, sin e2e", () => {
  const p = planFromFiles(["android/app/src/main/java/com/micartera/app/MiCarteraWidget.java"]);
  assert.equal(p.playwright, false);
  assert.ok(p.steps.includes("widget-coherente"));
  assert.ok(p.steps.includes("webdebug-guard"));
});

t("Gastos acota a sus e2e, no a los 139", () => {
  const p = planFromFiles(["src/modules/04-tab-gastos.js", "VERSION", "package.json"]);
  assert.equal(p.playwright, true);
  assert.equal(p.steps, "all");
  assert.ok(Array.isArray(p.e2e));
  assert.ok(p.e2e.includes("e2e/gastos-cajones.spec.mjs"));
  assert.ok(p.e2e.includes("e2e/gastos-diario-filtro.spec.mjs"));
  assert.ok(p.e2e.includes("e2e/persistencia.spec.mjs"), "transversal va con cualquier src");
  assert.ok(!p.e2e.includes("e2e/splash.spec.mjs"), "splash no es de Gastos");
  assert.equal(p.e2e.includes("all"), false);
});

t("el núcleo (motor de dinero) NO se recorta", () => {
  const p = planFromFiles(["src/modules/08-motor-bank.js"]);
  assert.equal(p.e2e, "all");
  assert.equal(p.playwright, true);
  assert.equal(p.deno, true);
});

t("un workflow de Actions tampoco se recorta", () => {
  const p = planFromFiles([".github/workflows/beta.yml"]);
  assert.equal(p.e2e, "all");
});

t("lista vacía o desconocida → suite entera, no un verde ciego", () => {
  assert.equal(planFromFiles([]).e2e, "all");
  assert.equal(planFromFiles(["random/foo.bin"]).e2e, "all");
});

t("todo módulo de src está en CORE o en el mapa (si no, el siguiente se cuela)", () => {
  const mapped = new Set(E2E_MAP.map((m) => m.file).concat(CORE.filter((c) => c.startsWith("src/"))));
  const mods = fs.readdirSync(path.join(root, "src/modules"))
    .filter((n) => n.endsWith(".js"))
    .map((n) => "src/modules/" + n)
    .concat(["src/shell.html"]);
  const faltan = mods.filter((m) => !mapped.has(m) && !CORE.includes(m));
  assert.deepEqual(faltan, [], "añádelos a CORE o a E2E_MAP: " + faltan.join(", "));
});

t("public/index.html generado no dispara la suite él solo", () => {
  const p = planFromFiles(["public/index.html", "docs/TESTING.md"]);
  assert.equal(p.playwright, false, "el HTML generado se ignora; queda el .md");
});

t(".gitignore cuenta como meta, no como desconocido", () => {
  const p = planFromFiles([".gitignore", "docs/TESTING.md"]);
  assert.equal(p.playwright, false);
  assert.equal(p.e2e, "none");
});

t("todo e2e está en el mapa o en transversales (si no, el siguiente se duerme)", () => {
  const classified = new Set(E2E_MAP.flatMap((m) => m.specs).concat(CROSSCUTTING));
  const specs = fs.readdirSync(path.join(root, "e2e"))
    .filter((n) => n.endsWith(".spec.mjs"))
    .map((n) => "e2e/" + n);
  const faltan = specs.filter((s) => !classified.has(s));
  assert.deepEqual(faltan, [], "añádelos a E2E_MAP o a CROSSCUTTING: " + faltan.join(", "));
  const fantasma = [...classified].filter((s) => !fs.existsSync(path.join(root, s)));
  assert.deepEqual(fantasma, [], "ruta de spec que no existe: " + fantasma.join(", "));
});

console.log("  ok");
