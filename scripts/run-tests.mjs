#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const suiteStarted = performance.now();
const timings = [];
function recordTime(name, started) {
  timings.push({ name, ms: Math.round(performance.now() - started) });
}

function loadPlan() {
  const i = process.argv.indexOf("--plan");
  if (i < 0) {
    return { build: true, deno: true, playwright: true, e2e: "all", steps: "all", reason: "suite entera" };
  }
  const p = process.argv[i + 1];
  if (!p) { console.error("uso: node scripts/run-tests.mjs --plan relevant-plan.json"); process.exit(2); }
  return JSON.parse(fs.readFileSync(path.resolve(root, p), "utf8"));
}
const plan = loadPlan();
if (plan.reason) console.log("── plan: " + plan.reason + " ──");

if (plan.build !== false) {
  console.log("── build-app ──");
  const started = performance.now();
  const build = spawnSync("node", ["scripts/build-app.mjs"], { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
  recordTime("build-app", started);
  if (build.status !== 0) process.exit(1);
} else {
  console.log("── build-app ── (omitido)");
}

const steps = [
  ["help-assistant", ["node", "tests/help-assistant.test.mjs"]],
  ["guard-privacy", ["node", "scripts/guard-privacy.mjs"]],
  ["check-syntax", ["node", "scripts/check-syntax.mjs"]],
  ["i18n-keys", ["node", "tests/i18n-keys.test.mjs"]],
  ["i18n-bundle", ["node", "tests/i18n-bundle.test.mjs"]],
  ["novedades-vinnetas", ["node", "tests/novedades-vinnetas.test.mjs"]],
  ["aely-logo-unico", ["node", "tests/aely-logo-unico.test.mjs"]],
  ["release-notes-max", ["node", "tests/release-notes-max.test.mjs"]],
  ["beta-tandas-vacias", ["node", "tests/beta-tandas-vacias.test.mjs"]],
  ["novedades-idiomas", ["node", "tests/novedades-idiomas.test.mjs"]],
  ["categorias-dual", ["node", "tests/categorias-dual.test.mjs"]],
  ["suministros-legacy", ["node", "tests/suministros-legacy.test.mjs"]],
  ["docs-frescura", ["node", "tests/docs-frescura.test.mjs"]],
  ["relevant-tests", ["node", "tests/relevant-tests.test.mjs"]],
  // El espejo de la memoria en docs/memoria/ tiene que ir al día: es lo único que ve una sesión
  // que no corra en este PC (móvil, Cursor, otra IA). En una máquina sin memoria local —el CI—
  // el script sale en verde sin hacer nada, así que esto solo pincha aquí, que es donde se arregla.
  ["memoria-espejo", ["node", "scripts/sync-memoria.mjs", "--check"]],
  // Los logos de banco salen del PNG oficial: si alguien los edita a mano, esto lo caza.
  ["logos-bancos", ["node", "scripts/logos-bancos.mjs", "--check"]],
  // Los de las empresas salen de simple-icons y la regla de «qué marca es» vive en la app.
  ["logos-inversiones", ["node", "scripts/logos-inversiones.mjs", "--check"]],
  // Y QUIÉN lleva cada logo: fila de banco → logo del banco, fila de empresa → LogoInv. Se
  // rompió en las dos direcciones el 11/9 y ningún test lo vio.
  ["logo-banco-o-empresa", ["node", "tests/logo-banco-o-empresa.test.mjs"]],
  // Quitar un banco tiene que limpiar SU cuenta de Cartera, y un enlace a medio autorizar tiene
  // que avisar. Los tres sustos de CaixaBank del 11/9.
  ["quitar-banco-y-pendiente", ["node", "tests/quitar-banco-y-pendiente.test.mjs"]],
  // El día se agrupa en hora local, no en UTC: si no, el mismo día sale DOS veces de cabecera.
  // Se relanza solo con TZ=Europe/Madrid — en una máquina en UTC el fallo es invisible.
  ["dia-local-no-utc", ["node", "tests/dia-local-no-utc.test.mjs"]],
  ["move-account", ["node", "tests/move-account.test.mjs"]],
  ["merge-expenses-cloud", ["node", "tests/merge-expenses-cloud.test.mjs"]],
  ["security", ["node", "tests/security.test.mjs"]],
  ["no-lock-icons", ["node", "tests/no-lock-icons.test.mjs"]],
  ["webdebug-guard", ["node", "tests/webdebug-guard.test.mjs"]],
  ["gastos-active-bus", ["node", "tests/gastos-active-bus.test.mjs"]],
  ["budget-notis-deps", ["node", "tests/budget-notis-deps.test.mjs"]],
  ["track-asentar-raf", ["node", "tests/track-asentar-raf.test.mjs"]],
  ["season-detalle", ["node", "tests/season-detalle.test.mjs"]],
  ["edge-sintaxis", ["node", "tests/edge-sintaxis.test.mjs"]],
  ["presupuesto-rendimiento", ["node", "tests/presupuesto-rendimiento.test.mjs"]],
  ["finance-core", ["node", "tests/finance-core.test.mjs"]],
  ["ob-ingresos", ["node", "tests/ob-ingresos.test.mjs"]],
  ["bank-sync-paging", ["node", "tests/bank-sync-paging.test.mjs"]],
  ["reserva-dinero", ["node", "tests/reserva-dinero.test.mjs"]],
  ["month-budget-stats", ["node", "tests/month-budget-stats.test.mjs"]],
  ["informe-mes", ["node", "tests/informe-mes.test.mjs"]],
  ["presupuesto-categoria", ["node", "tests/presupuesto-categoria.test.mjs"]],
  ["month-window", ["node", "tests/month-window.test.mjs"]],
  ["presupuesto-servidor", ["node", "tests/presupuesto-servidor.test.mjs"]],
  ["cuotas-deudas", ["node", "tests/cuotas-deudas.test.mjs"]],
  ["widget-coherente", ["node", "tests/widget-coherente.test.mjs"]],
  ["ob-renombrar", ["node", "tests/ob-renombrar.test.mjs"]],
  ["divisa-original", ["node", "tests/divisa-original.test.mjs"]],
  ["wallet-notis", ["node", "tests/wallet-notis.test.mjs"]],
  ["invest-category", ["node", "tests/invest-category.test.mjs"]],
  ["fx-multi", ["node", "tests/fx-multi.test.mjs"]],
  ["categories", ["node", "tests/categories.test.mjs"]],
  ["revo-parse", ["node", "tests/revo-parse.test.mjs"]],
  ["revo-num", ["node", "tests/revo-num.test.mjs"]],
  ["debts", ["node", "tests/debts.test.mjs"]],
  ["ingest-classify", ["node", "tests/ingest-classify.test.mjs"]],
  ["revo-golden", ["node", "tests/revo-golden.test.mjs"]],
  ["import-hoja", ["node", "tests/import-hoja.test.mjs"]],
  ["import-docx-pdf", ["node", "tests/import-docx-pdf.test.mjs"]],
  ["hist-import-dup", ["node", "tests/hist-import-dup.test.mjs"]],
  ["hist-pagos-mensuales", ["node", "tests/hist-pagos-mensuales.test.mjs"]],
  ["revo-metales-coste", ["node", "tests/revo-metales-coste.test.mjs"]],
  ["parsers-revolut", ["node", "tests/parsers/revolut.test.mjs"]],
  ["motor-debt", ["node", "tests/motor-debt.test.mjs"]],
  ["reconcile-bank", ["node", "tests/reconcile-bank.test.mjs"]],
  ["onboarding", ["node", "tests/onboarding.test.mjs"]],
  ["expense-bank", ["node", "tests/expense-bank.test.mjs"]],
  ["saldo-por-banco", ["node", "tests/saldo-por-banco.test.mjs"]],
  ["rol-cuenta-sin-salto", ["node", "tests/rol-cuenta-sin-salto.test.mjs"]],
  ["ota-bases-espejo", ["node", "tests/ota-bases-espejo.test.mjs"]],
  ["hist-dia-local", ["node", "tests/hist-dia-local.test.mjs"]],
  ["hist-fecha-que-baila", ["node", "tests/hist-fecha-que-baila.test.mjs"]],
  ["hist-uniq-por-banco", ["node", "tests/hist-uniq-por-banco.test.mjs"]],
  ["sync-manual-un-aviso", ["node", "tests/sync-manual-un-aviso.test.mjs"]],
  ["cartel-reconectar", ["node", "tests/cartel-reconectar.test.mjs"]],
  ["bank-callback-msg", ["node", "tests/bank-callback-msg.test.mjs"]],
  ["categorize-limitador", ["node", "tests/categorize-limitador.test.mjs"]],
  ["seguridad-hogar-eventos", ["node", "tests/seguridad-hogar-eventos.test.mjs"]],
  ["grants-migraciones", ["node", "tests/grants-migraciones.test.mjs"]],
  ["entrada-edge", ["node", "tests/entrada-edge.test.mjs"]],
  ["bucket-igual-que-balance", ["node", "tests/bucket-igual-que-balance.test.mjs"]],
  ["apk-sin-token-ingest", ["node", "tests/apk-sin-token-ingest.test.mjs"]],
  ["sugerencia-apuntar", ["node", "tests/sugerencia-apuntar.test.mjs"]],
  ["hist-cashback-par", ["node", "tests/hist-cashback-par.test.mjs"]],
  ["notas-sin-duplicados", ["node", "tests/notas-sin-duplicados.test.mjs"]],
  ["v4-cta-halo", ["node", "tests/v4-cta-halo.test.mjs"]],
  ["efectivo", ["node", "tests/efectivo.test.mjs"]],
  ["efectivo-cierre", ["node", "tests/efectivo-cierre.test.mjs"]],
  ["atm-dual", ["node", "tests/atm-dual.test.mjs"]],
  ["tr-open-banking", ["node", "tests/tr-open-banking.test.mjs"]],
  ["huella-bundle", ["node", "tests/huella-bundle.test.mjs"]],
  ["expense-note", ["node", "tests/expense-note.test.mjs"]],
  ["expense-id-cloud", ["node", "tests/expense-id-cloud.test.mjs"]],
  ["pull-historico-entero", ["node", "tests/pull-historico-entero.test.mjs"]],
  ["bank-connect-once", ["node", "tests/bank-connect-once.test.mjs"]],
  ["inv-dashboard", ["node", "tests/inv-dashboard.test.mjs"]],
  ["financing", ["node", "tests/financing.test.mjs"]],
  ["updates", ["node", "tests/updates.test.mjs"]],
];

/* UN TEST QUE NO ESTÁ EN ESTA LISTA NO EXISTE (2026-08-17).
   La lista se mantiene a mano, así que escribir un `tests/loquesea.test.mjs` y olvidarse de
   añadirlo aquí deja un fichero que se ve en el repo, se puede lanzar a mano y pasa… y que ni
   `npm test` ni el CI ejecutan jamás. Pasó con `widget-coherente` y `ob-renombrar`: dos guardianes
   de bugs de dinero (el widget que se contradecía y el gasto duplicado al renombrar) publicados en
   beta sin que nadie los corriera. Un guardián dormido es peor que ninguno, porque el verde de
   Actions te dice que están vigilando.
   Esto se comprueba ANTES de correr nada: si falta uno, no hay informe que valga. */
// Recursivo, y no «tests/ + tests/parsers/ a mano»: con la lista fija, un `tests/loquesea/x.test.mjs`
// en una carpeta nueva se colaba igual — el mismo agujero, una capa más abajo (aviso de Cursor).
const buscaTests = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true })
  .flatMap((d) => d.isDirectory() ? buscaTests(dir + "/" + d.name)
    : (d.name.endsWith(".test.mjs") ? [dir + "/" + d.name] : []));
const testsEnDisco = buscaTests("tests");
const enLaLista = new Set(steps.flatMap(([, cmd]) => cmd.slice(1)));
const huerfanos = testsEnDisco.filter((p) => !enLaLista.has(p));
if (huerfanos.length) {
  console.error("\n✕ tests que existen pero NADIE ejecuta:\n" +
    huerfanos.map((p) => "    · " + p).join("\n") +
    "\n  Añádelos a `steps` en scripts/run-tests.mjs (o bórralos si ya no sirven).");
  process.exit(1);
}

const denoEnLista = [
  "supabase/functions/ingest/ingest.test.ts",
  "supabase/functions/_shared/crypto.test.ts",
  "supabase/functions/_shared/enablebanking.test.ts",
  "supabase/functions/delete-account/delete-account.test.ts",
];
const buscaDeno = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true })
  .flatMap((d) => d.isDirectory() ? buscaDeno(dir + "/" + d.name)
    : (d.name.endsWith(".test.ts") ? [dir + "/" + d.name] : []));
const denoHuerfanos = buscaDeno("supabase").filter((p) => !denoEnLista.includes(p));
if (denoHuerfanos.length) {
  console.error("\n✕ tests Deno que existen pero NADIE ejecuta:\n" +
    denoHuerfanos.map((p) => "    · " + p).join("\n") +
    "\n  Añádelos a `denoTests` en scripts/run-tests.mjs.");
  process.exit(1);
}

let failed = false;
const runSteps = plan.steps === "all" || !plan.steps
  ? steps
  : steps.filter(([name]) => plan.steps.includes(name));
for (const [name, cmd] of runSteps) {
  console.log(`\n── ${name} ──`);
  const started = performance.now();
  const r = spawnSync(cmd[0], cmd.slice(1), { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
  recordTime(name, started);
  if (r.status !== 0) {
    failed = true;
    console.error(`\nFAILED: ${name}`);
  }
}

if (plan.deno !== false) {
  console.log("\n── ingest-deno ──");
  const denoTests = denoEnLista;
  for (const testFile of denoTests) {
    const started = performance.now();
    const denoArgs = testFile.includes("crypto.test")
      ? ["test", "--allow-env", testFile]
      : ["test", testFile];
    const deno = spawnSync("deno", denoArgs, {
      cwd: root, stdio: "pipe", shell: process.platform === "win32",
    });
    const denoOut = (deno.stderr?.toString() || "") + (deno.stdout?.toString() || "");
    recordTime(testFile, started);
    if (deno.status === 0) {
      console.log(`  ✓ ${testFile}`);
    } else if (deno.error?.code === "ENOENT" || /not found|no se reconoce|not recognized/i.test(denoOut)) {
      console.log("  ⊘ deno no instalado, omitido");
      break;
    } else {
      if (denoOut) process.stderr.write(denoOut);
      failed = true;
      console.error(`FAILED: ${testFile}`);
    }
  }
} else {
  console.log("\n── ingest-deno ── (omitido)");
}

if (!failed && plan.playwright !== false && plan.e2e !== "none") {
  console.log("\n── playwright-e2e ──");
  const specs = plan.e2e === "all" || !plan.e2e
    ? fs.readdirSync(path.join(root, "e2e"), { recursive: true })
      .filter(p => p.endsWith(".spec.mjs")).map(p => "e2e/" + p.replaceAll("\\", "/"))
    : plan.e2e;
  /* `npx playwright` depende de los wrappers de node_modules/.bin, y en este repo faltan en
     varias maquinas (Windows incluido): el runner respondia «"playwright" no se reconoce como un
     comando» y marcaba FAILED sin haber ejecutado un solo e2e. Eso es peor que un rojo: parece
     que la suite ha corrido y ha fallado. Si esta el CLI del paquete, se llama directo. */
  const pwCli = path.join(root, "node_modules", "playwright", "cli.js");
  // Las mediciones con CPU frenada competían con otros tres navegadores: scroll→swipe
  // daba 108/109 ms en dos completas y pasaba aislado (15/9). Medir después conserva
  // el umbral real; los funcionales siguen en paralelo y ningún caso del plan se pierde.
  const isPerf = p => /(?:^|\/)rendimiento(?:-tabs)?\.spec\.mjs$/.test(p.replaceAll("\\", "/"));
  const groups = [["playwright-e2e", specs.filter(p => !isPerf(p)), []],
    ["playwright-perf", specs.filter(isPerf), ["--workers=1"]]];
  const reports = [];
  fs.rmSync(path.join(root, "test-results", "playwright.json"), { force: true });
  for (const [name, selected, extra] of groups) {
    if (!selected.length) continue;
    const reportPath = path.join(root, "test-results", name + ".json");
    fs.rmSync(reportPath, { force: true });
    const env = { ...process.env, MC_E2E_REPORT: reportPath,
      MC_E2E_OUTPUT_DIR: path.join(root, "test-results", name) };
    const args = ["test", "--config=playwright.config.mjs", ...selected, ...extra];
    const started = performance.now();
    const pw = fs.existsSync(pwCli)
      ? spawnSync(process.execPath, [pwCli, ...args], { cwd: root, stdio: "inherit", env })
      : spawnSync("npx", ["playwright", ...args], { cwd: root, stdio: "inherit", env, shell: process.platform === "win32" });
    recordTime(name, started);
    if (pw.status !== 0) { failed = true; console.error("\nFAILED: " + name); }
    try { reports.push(JSON.parse(fs.readFileSync(reportPath, "utf8"))); }
    catch (_) { failed = true; console.error("\nFAILED: falta informe de " + name); }
  }
  if (reports.length) {
    const merged = { ...reports[0], suites: reports.flatMap(r => r.suites), errors: reports.flatMap(r => r.errors || []), stats: { ...reports[0].stats } };
    for (const key of ["duration", "expected", "skipped", "unexpected", "flaky"])
      merged.stats[key] = reports.reduce((sum, r) => sum + (r.stats[key] || 0), 0);
    fs.writeFileSync(path.join(root, "test-results", "playwright.json"), JSON.stringify(merged, null, 2) + "\n");
  }
} else if (plan.e2e === "none" || plan.playwright === false) {
  console.log("\n── playwright-e2e ── (omitido)");
}

// Los tiempos van junto a los resultados, no al repo: sin ellos cada tanda volvía a adivinar
// si el coste era un test, el arranque o la carga de la máquina (feedback 15/9).
const totalMs = Math.round(performance.now() - suiteStarted);
fs.mkdirSync(path.join(root, "test-results"), { recursive: true });
fs.writeFileSync(path.join(root, "test-results", "runner-times.json"), JSON.stringify({
  timezone: process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone,
  totalMs, failed, phases: timings,
}, null, 2) + "\n");
console.log("\n── Duración total: " + (totalMs / 1000).toFixed(1) + " s · etapas más lentas ──");
timings.slice().sort((a, b) => b.ms - a.ms).slice(0, 8).forEach(t =>
  console.log("  " + (t.ms / 1000).toFixed(2) + " s · " + t.name));
process.exit(failed ? 1 : 0);
