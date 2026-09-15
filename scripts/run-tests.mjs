#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

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
  const build = spawnSync("node", ["scripts/build-app.mjs"], { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
  if (build.status !== 0) process.exit(1);
} else {
  console.log("── build-app ── (omitido)");
}

const steps = [
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
  const r = spawnSync(cmd[0], cmd.slice(1), { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) {
    failed = true;
    console.error(`\nFAILED: ${name}`);
  }
}

if (plan.deno !== false) {
  console.log("\n── ingest-deno ──");
  const denoTests = denoEnLista;
  for (const testFile of denoTests) {
    const denoArgs = testFile.includes("crypto.test")
      ? ["test", "--allow-env", testFile]
      : ["test", testFile];
    const deno = spawnSync("deno", denoArgs, {
      cwd: root, stdio: "pipe", shell: process.platform === "win32",
    });
    const denoOut = (deno.stderr?.toString() || "") + (deno.stdout?.toString() || "");
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
  const specs = plan.e2e === "all" || !plan.e2e ? [] : plan.e2e;
  /* `npx playwright` depende de los wrappers de node_modules/.bin, y en este repo faltan en
     varias maquinas (Windows incluido): el runner respondia «"playwright" no se reconoce como un
     comando» y marcaba FAILED sin haber ejecutado un solo e2e. Eso es peor que un rojo: parece
     que la suite ha corrido y ha fallado. Si esta el CLI del paquete, se llama directo. */
  const pwCli = path.join(root, "node_modules", "playwright", "cli.js");
  const pw = fs.existsSync(pwCli)
    ? spawnSync(process.execPath, [pwCli, "test", "--config=playwright.config.mjs"].concat(specs), {
        cwd: root, stdio: "inherit",
      })
    : spawnSync("npx", ["playwright", "test", "--config=playwright.config.mjs"].concat(specs), {
        cwd: root, stdio: "inherit", shell: process.platform === "win32",
      });
  if (pw.status !== 0) {
    failed = true;
    console.error("\nFAILED: playwright-e2e");
  }
} else if (plan.e2e === "none" || plan.playwright === false) {
  console.log("\n── playwright-e2e ── (omitido)");
}

process.exit(failed ? 1 : 0);
