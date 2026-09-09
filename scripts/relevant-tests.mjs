#!/usr/bin/env node
/**
 * QUÉ TESTS CORREN SEGÚN LO TOCADO — el «Run Relevant Tests» de esta casa.
 *
 * En Salesforce eso va por grafo de clases. Aquí no hay grafo: hay un monolito. Un detector
 * automático «este test cubre este fichero» mentiría, y ya nos quemó un guardián dormido
 * (widget-coherente / ob-renombrar, 2026-08-17). Por eso el recorte es POR CARPETAS, el mapa
 * de e2e se mantiene a mano, y si se toca el NÚCLEO (dinero, shell, i18n, el runner) se corre
 * TODO. Promote y `main` no usan esto: ahí la suite entera, siempre.
 *
 * AGUJERO QUE QUEDA (a propósito, 2026-08-17): el guardián caza un spec HUÉRFANO, no uno
 * MAL COLGADO. Si `gastos-cajones.spec.mjs` se pone bajo `13-hogar.js`, el disco está
 * contento y `beta` sale verde sin haber abierto Gastos. El mapa es a mano porque un
 * detector automático mentiría (un spec cubre a veces varios módulos). Un verde en
 * `beta` ya no pesa lo mismo que un verde en `main`: al promocionar corre la suite entera.
 *
 * Uso:
 *   node scripts/relevant-tests.mjs --files a.md b.md
 *   node scripts/relevant-tests.mjs --git          (diff HEAD~1, local)
 *   node scripts/relevant-tests.mjs --ci           (push de Actions; escribe GITHUB_OUTPUT + plan.json)
 *   node scripts/run-tests.mjs --plan relevant-plan.json
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** Tocar uno de estos = suite e2e entera. Son el suelo compartido: un cambio aquí no se puede
 *  acotar a una pantalla sin mentir. */
export const CORE = [
  "src/modules/00-core.js",
  "src/modules/01-i18n.js",
  "src/modules/02-ui-shared.js",
  "src/modules/08-motor-bank.js",
  "src/modules/11-app-main.js",
  "src/shell.html",
  "playwright.config.mjs",
  "scripts/run-tests.mjs",
];

/**
 * Módulo de UI → specs que lo pintan. Si añades un e2e nuevo, o un módulo nuevo, una línea aquí
 * (o en CROSSCUTTING si no es de una pantalla). El test `relevant-tests` recorre el disco y
 * aborta si un spec se queda fuera: es el mismo agujero que un unitario huérfano.
 * Si un módulo no está ni en CORE ni aquí, el planificador se asusta y corre la suite entera
 * (mejor un minuto de más que un verde ciego).
 */
export const E2E_MAP = [
  { file: "src/modules/03-tab-dash.js", specs: [
    "e2e/pulido-vacios.spec.mjs","e2e/indicador-arco.spec.mjs", "e2e/smoke.spec.mjs", "e2e/informe-mes.spec.mjs"] },
  { file: "src/modules/04-tab-gastos.js", specs: [
    "e2e/gastos-cajones.spec.mjs", "e2e/gastos-concepto.spec.mjs", "e2e/apuntar-sheet.spec.mjs",
    "e2e/gastos-diario-filtro.spec.mjs", "e2e/gastos-cabecera-bancos.spec.mjs", "e2e/gastos-orden.spec.mjs",
    "e2e/gastos-categorias-presupuesto.spec.mjs",
  ] },
  { file: "src/modules/05-dialogs-inv.js", specs: [
    "e2e/cartera-inversiones.spec.mjs", "e2e/brokers-selector.spec.mjs",
  ] },
  { file: "src/modules/06-sync-brokers.js", specs: [
    "e2e/cartera-inversiones.spec.mjs", "e2e/brokers-selector.spec.mjs", "e2e/revolut-csv-import.spec.mjs",
    "e2e/tr-aviso.spec.mjs",
  ] },
  { file: "src/modules/08-motor-bank.js", specs: [
    "e2e/hist-pagos-mensuales.spec.mjs", "e2e/bancos-historico-filtro.spec.mjs",
  ] },
  { file: "src/modules/07-tab-patri-fijos.js", specs: [
    "e2e/listas-render.spec.mjs", "e2e/bancos-acordeon.spec.mjs", "e2e/bancos-reconnect.spec.mjs",
    "e2e/bancos-historico-filtro.spec.mjs",
  ] },
  { file: "src/modules/09-tab-debts-goals.js", specs: [
    "e2e/listas-render.spec.mjs", "e2e/plan-swipe-segmento.spec.mjs", "e2e/pulido-numpad.spec.mjs",
  ] },
  { file: "src/modules/10-app-components.js", specs: [
    "e2e/profile-anim.spec.mjs", "e2e/perfil-simetria.spec.mjs", "e2e/delete-account.spec.mjs",
    "e2e/revisar-beta.spec.mjs", "e2e/ajustes-versiones.spec.mjs", "e2e/ajustes-importaciones.spec.mjs",
    "e2e/tour-tutorial.spec.mjs", "e2e/modo-pruebas.spec.mjs", "e2e/tr-aviso.spec.mjs",
    "e2e/presupuesto-bancos.spec.mjs",
    "e2e/hist-pagos-mensuales.spec.mjs",
  ] },
  { file: "src/modules/12-boot.js", specs: ["e2e/splash.spec.mjs", "e2e/smoke.spec.mjs", "e2e/csp.spec.mjs"] },
  { file: "src/modules/13-hogar.js", specs: ["e2e/cartera-orden-hogar.spec.mjs"] },
  { file: "src/modules/14-v4-screens.js", specs: [
    "e2e/apuntar-sheet.spec.mjs", "e2e/pulido-numpad.spec.mjs", "e2e/listas-render.spec.mjs",
    "e2e/plan-swipe-segmento.spec.mjs",
    "e2e/cartera-inversiones.spec.mjs", "e2e/cartera-orden-hogar.spec.mjs",
  ] },
  { file: "src/modules/15-import-hoja.js", specs: ["e2e/import-hoja.spec.mjs", "e2e/import-docx-pdf.spec.mjs"] },
];

/** Specs que no son de una pantalla: persistencia, swipes, frames. Si se toca CUALQUIER
 *  módulo de src (no el núcleo: ese ya dispara todo), van con el recorte. */
export const CROSSCUTTING = [
  "e2e/persistencia.spec.mjs",
  "e2e/swipe-pestanas.spec.mjs",
  "e2e/rebote-barra-inferior.spec.mjs",
  "e2e/rendimiento.spec.mjs",
  "e2e/rendimiento-tabs.spec.mjs",
];

const STEPS_DOCS = ["guard-privacy", "docs-frescura", "memoria-espejo"];
const STEPS_ANDROID = ["guard-privacy", "webdebug-guard", "widget-coherente"];
const STEPS_SUPABASE = [
  "guard-privacy", "edge-sintaxis", "presupuesto-servidor", "widget-coherente",
  "month-window", "wallet-notis", "ingest-classify", "divisa-original", "presupuesto-rendimiento",
];

export function posixPath(p) {
  return String(p || "").replace(/\\/g, "/").replace(/^\.\//, "");
}

function isIgnored(f) {
  return f === "public/index.html" || f.startsWith("public/vendor/") ||
    f.startsWith("tools/") || f.startsWith(".cursor/");
}

function isMeta(f) {
  return f === "VERSION" || f === "package.json" || f === "package-lock.json" ||
    f === "public/apk.json" || f === ".gitignore" || f === ".gitattributes" || f === ".editorconfig";
}

function isDocs(f) {
  if (f.endsWith(".md")) return true;
  return f.startsWith("docs/") || f === "LICENSE";
}

function isAndroid(f) { return f.startsWith("android/"); }
function isSupabase(f) { return f.startsWith("supabase/"); }
function isSrc(f) {
  return f.startsWith("src/") || f === "src/shell.html";
}
function isE2e(f) { return f.startsWith("e2e/") && f.endsWith(".spec.mjs"); }
function isUnitTest(f) { return f.startsWith("tests/") && f.endsWith(".test.mjs"); }
function isWorkflow(f) { return f.startsWith(".github/"); }
function isCore(f) { return CORE.includes(f); }

function full(reason) {
  return {
    reason, build: true, deno: true, playwright: true,
    e2e: "all", steps: "all",
  };
}

/**
 * @param {string[]} files
 * @returns {{ reason: string, build: boolean, deno: boolean, playwright: boolean,
 *             e2e: "all"|"none"|string[], steps: "all"|string[] }}
 */
export function planFromFiles(files) {
  const raw = (files || []).map(posixPath).filter(Boolean);
  const list = raw.filter((f) => !isIgnored(f));
  if (!list.length) return full("sin lista de ficheros (no adivinar: suite entera)");

  if (list.some(isWorkflow) || list.some(isCore)) {
    const cual = list.find(isWorkflow) || list.find(isCore);
    return full("núcleo o CI: " + cual);
  }

  const rest = list.filter((f) => !isMeta(f));
  if (!rest.length) {
    return {
      reason: "solo VERSION/package (docs-frescura)",
      build: false, deno: false, playwright: false, e2e: "none", steps: STEPS_DOCS,
    };
  }

  const kinds = new Set();
  for (const f of rest) {
    if (isDocs(f)) kinds.add("docs");
    else if (isAndroid(f)) kinds.add("android");
    else if (isSupabase(f)) kinds.add("supabase");
    else if (isSrc(f)) kinds.add("src");
    else if (isE2e(f)) kinds.add("e2e");
    else if (isUnitTest(f)) kinds.add("unit");
    else if (f.startsWith("scripts/")) kinds.add("scripts");
    else kinds.add("other");
  }

  if (kinds.has("other")) return full("fichero sin clasificar: " + rest.find((f) => {
    return !isDocs(f) && !isAndroid(f) && !isSupabase(f) && !isSrc(f) && !isE2e(f) &&
      !isUnitTest(f) && !f.startsWith("scripts/");
  }));

  const only = (...ks) => ks.every((k) => kinds.has(k)) && kinds.size === ks.length;
  const onlySubset = (...ks) => [...kinds].every((k) => ks.includes(k));

  if (only("docs") || (kinds.size === 1 && kinds.has("docs"))) {
    return {
      reason: "solo documentación",
      build: false, deno: false, playwright: false, e2e: "none", steps: STEPS_DOCS,
    };
  }
  if (only("android")) {
    return {
      reason: "solo nativo Android",
      build: false, deno: false, playwright: false, e2e: "none", steps: STEPS_ANDROID,
    };
  }
  if (only("supabase")) {
    return {
      reason: "solo supabase (ingest / migraciones)",
      build: false, deno: true, playwright: false, e2e: "none", steps: STEPS_SUPABASE,
    };
  }

  // scripts/ o tests/ unitarios, sin src: unitarios, sin e2e ni Chromium.
  if (onlySubset("scripts", "unit", "docs")) {
    return {
      reason: "tooling / tests unitarios",
      build: true, deno: false, playwright: false, e2e: "none", steps: "all",
    };
  }

  // src y/o e2e: unitarios (el monolito) + e2e del mapa. Deno solo si también supabase.
  const srcFiles = rest.filter(isSrc);
  const e2eFiles = rest.filter(isE2e);
  const specs = new Set(e2eFiles);
  let unmapped = [];
  for (const f of srcFiles) {
    const hit = E2E_MAP.find((m) => m.file === f);
    if (hit) hit.specs.forEach((s) => specs.add(s));
    else unmapped.push(f);
  }
  if (unmapped.length) return full("módulo sin mapa e2e: " + unmapped[0] + " (añádelo a E2E_MAP o a CORE)");

  // Un cambio de pantalla también puede romper persistencia / swipe / frames.
  if (srcFiles.length) CROSSCUTTING.forEach((s) => specs.add(s));

  const e2e = specs.size ? [...specs].sort() : "none";
  return {
    reason: srcFiles.length
      ? ("src/e2e acotado: " + (srcFiles[0] || e2eFiles[0]))
      : "specs e2e tocados",
    build: true,
    deno: kinds.has("supabase"),
    playwright: e2e !== "none",
    e2e,
    steps: "all",
  };
}

export function filesFromGit(before, sha) {
  if (!before || /^0+$/.test(before)) return null;
  const args = sha ? ["diff", "--name-only", before, sha] : ["diff", "--name-only", before];
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (r.status !== 0) return null;
  return r.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

function parseArgv(argv) {
  const out = { files: [], git: false, ci: false, write: "relevant-plan.json" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--git") out.git = true;
    else if (a === "--ci") out.ci = true;
    else if (a === "--files") {
      while (argv[i + 1] && !argv[i + 1].startsWith("--")) out.files.push(argv[++i]);
    } else if (a === "--write") out.write = argv[++i];
    else if (!a.startsWith("--")) out.files.push(a);
  }
  return out;
}

function printPlan(plan) {
  const e2e = plan.e2e === "all" ? "TODOS" : plan.e2e === "none" ? "ninguno" : plan.e2e.join(", ");
  const steps = plan.steps === "all" ? "todos los unitarios" : plan.steps.join(", ");
  console.log("relevant-tests: " + plan.reason);
  console.log("  build=" + plan.build + "  deno=" + plan.deno + "  playwright=" + plan.playwright);
  console.log("  steps: " + steps);
  console.log("  e2e: " + e2e);
}

const self = fileURLToPath(import.meta.url);
const invoked = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (self.toLowerCase() === invoked.toLowerCase()) {
  const opt = parseArgv(process.argv.slice(2));
  let files = opt.files;
  if (opt.ci) {
    const event = process.env.GITHUB_EVENT_NAME || "";
    const before = process.env.GITHUB_EVENT_BEFORE || "";
    const sha = process.env.GITHUB_SHA || "";
    if (event !== "push") {
      files = null;
    } else {
      files = filesFromGit(before, sha);
    }
  } else if (opt.git && !files.length) {
    files = filesFromGit("HEAD~1");
  }
  const plan = files ? planFromFiles(files) : full(opt.ci && (process.env.GITHUB_EVENT_NAME || "") !== "push"
    ? "workflow_dispatch / no es un push: suite entera"
    : "no hay diff (rama nueva o git falló): suite entera");
  printPlan(plan);
  const outPath = path.join(root, opt.write);
  fs.writeFileSync(outPath, JSON.stringify(plan, null, 2));
  const ghOut = process.env.GITHUB_OUTPUT;
  if (ghOut) {
    fs.appendFileSync(ghOut, "playwright=" + plan.playwright + "\n");
    fs.appendFileSync(ghOut, "deno=" + plan.deno + "\n");
    fs.appendFileSync(ghOut, "reason=" + plan.reason.replace(/\r|\n/g, " ") + "\n");
  }
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) {
    fs.appendFileSync(summary, "### Tests relevantes\n\n" + plan.reason + "\n\n");
    fs.appendFileSync(summary, "- Playwright: **" + (plan.playwright ? "sí" : "no") + "**\n");
    fs.appendFileSync(summary, "- Deno: **" + (plan.deno ? "sí" : "no") + "**\n");
    fs.appendFileSync(summary, "- e2e: " + (plan.e2e === "all" ? "suite entera" :
      plan.e2e === "none" ? "ninguno" : plan.e2e.map((s) => "`" + s + "`").join(", ")) + "\n");
  }
}
