#!/usr/bin/env node
// Historia Git real: un mock de `git log` no detectaría la simplificación de los merges.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const guardIndex = process.argv.indexOf("--guard");
// Permite acreditar el rojo contra el guardián anterior con los mismos repositorios y aserciones.
const guard = fs.readFileSync(guardIndex < 0 ? path.join(root, "tests/docs-frescura.test.mjs")
  : path.resolve(process.argv[guardIndex + 1]), "utf8");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "aely-docs-history-"));
// Git for Windows no admite la ruta especial os.devNull; un fichero vacío conserva
// el aislamiento de configuración sin cambiar ninguna historia ni aserción del guardián.
const gitConfig = path.join(scratch, "empty.gitconfig");
fs.writeFileSync(gitConfig, "");
const env = { ...process.env, GITHUB_REF_NAME: "", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: gitConfig };
for (const key of Object.keys(env)) if (/^GIT_(DIR|WORK_TREE|INDEX_FILE|SHALLOW_FILE|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES)$/.test(key)) delete env[key];
let checks = 0, failed = 0;

function git(repo, ...args) {
  const result = spawnSync("git", args, { cwd: repo, env, encoding: "utf8" });
  assert.equal(result.status, 0, `git ${args.join(" ")}: ${result.stderr}`);
  return result.stdout.trim();
}
function write(repo, file, value) {
  fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
  fs.writeFileSync(path.join(repo, file), value);
}
function align(repo, version) {
  write(repo, "VERSION", version + "\n");
  write(repo, "package.json", JSON.stringify({ version }));
  write(repo, "package-lock.json", JSON.stringify({ version, packages: { "": { version } } }));
  write(repo, "CHANGELOG.md", `## [${version}]\n`);
  write(repo, "README.md", `Estado actual: **v${version}**\n`);
  write(repo, "docs/ROADMAP.md", `> Estado a 2026-10-05 · **v${version}**\n| Web / OTA (\`VERSION\`) | **${version}** |\n`);
  write(repo, "src/data/release-notes.json", JSON.stringify([{ v: version }]));
}
function commit(repo, message) {
  git(repo, "add", ".");
  git(repo, "commit", "-qm", message);
  return git(repo, "rev-parse", "HEAD");
}
function create(name) {
  const repo = path.join(scratch, name);
  fs.mkdirSync(repo);
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.email", "fixture@example.invalid");
  git(repo, "config", "user.name", "Fixture local");
  git(repo, "config", "commit.gpgsign", "false");
  write(repo, "tests/docs-frescura.test.mjs", guard);
  write(repo, "AGENTS.md", "Fixture sin datos reales\n");
  write(repo, "docs/TESTING.md", "Fixture\n");
  write(repo, "src/modules/app.js", "const fixture = 0;\n");
  write(repo, "public/apk.json", JSON.stringify({ versionName: "1.0.0", versionCode: 1, url: "fixture-1.0.0.apk" }));
  write(repo, "android/app/build.gradle", 'versionCode 1\nversionName "1.0.0"\n');
  align(repo, "1.0.0");
  commit(repo, "inicio");
  align(repo, "1.0.1");
  commit(repo, "subida inicial");
  return repo;
}
function promote(repo) {
  git(repo, "checkout", "-qb", "ronda");
  align(repo, "1.0.2");
  commit(repo, "versión de ronda");
  write(repo, "src/modules/app.js", "const fixture = 2;\n");
  commit(repo, "arreglo posterior al bump de ronda");
  git(repo, "checkout", "-q", "main");
  git(repo, "merge", "--no-ff", "-qm", "fusión con número nuevo", "ronda");
}
function docs(repo) {
  write(repo, "docs/brief.md", "Documentación posterior\n");
  commit(repo, "solo documentación");
}
function code(repo, file = "src/modules/later.js") {
  write(repo, file, "// cambio publicable sin datos reales\n");
  commit(repo, "código posterior");
}
function run(repo, extraEnv = {}) {
  const result = spawnSync(process.execPath, ["tests/docs-frescura.test.mjs"], { cwd: repo, env: { ...env, ...extraEnv }, encoding: "utf8" });
  assert.equal(result.signal, null, result.stderr);
  assert.ok(result.status === 0 || result.status === 1, result.stderr);
  return { status: result.status, output: result.stdout + result.stderr };
}
function verdict(repo, status, pattern, extraEnv) {
  const result = run(repo, extraEnv);
  assert.equal(result.status, status, result.output);
  assert.match(result.output, pattern);
  return result;
}
function test(name, body) {
  checks++;
  try { body(create(name)); console.log(`  ✓ ${name}`); }
  catch (error) { failed++; console.error(`  ✗ ${name}\n${error.message}`); }
}
const pass = /no queda código publicable sin subir de versión/;
const fail = /no hay código publicable sin subir VERSION/;
const limited = /⊘ .*historia.*no se comprueba el bump/;

try {
  test("docs-after-versioned-promote", repo => { promote(repo); docs(repo); verdict(repo, 0, pass); });
  test("src-later-without-bump", repo => { promote(repo); code(repo); verdict(repo, 1, fail); });
  test("src-with-legitimate-bump", repo => { promote(repo); code(repo); align(repo, "1.1.0"); commit(repo, "subida semántica"); verdict(repo, 0, pass); });
  test("docs-after-base-unversioned-debt", repo => { promote(repo); code(repo); docs(repo); verdict(repo, 1, fail); });
  test("merge-same-version-new-src", repo => {
    promote(repo); git(repo, "checkout", "-qb", "nueva-rama"); code(repo);
    git(repo, "checkout", "-q", "main"); docs(repo); git(repo, "merge", "--no-ff", "-qm", "merge sin bump", "nueva-rama");
    verdict(repo, 1, fail);
  });
  test("docs-synthetic-merge-after-promote", repo => {
    git(repo, "checkout", "-qb", "docs"); docs(repo); git(repo, "checkout", "-q", "main");
    promote(repo); git(repo, "merge", "--no-ff", "-qm", "synthetic merge de docs", "docs"); verdict(repo, 0, pass);
  });
  test("branch-debt-before-anchor-merged-after", repo => {
    git(repo, "checkout", "-qb", "deuda"); code(repo); git(repo, "checkout", "-q", "main");
    promote(repo); git(repo, "merge", "--no-ff", "-qm", "deuda de rama antigua", "deuda"); verdict(repo, 1, fail);
  });
  test("merge-resolution-new-src", repo => {
    promote(repo); git(repo, "checkout", "-qb", "docs"); docs(repo); git(repo, "checkout", "-q", "main");
    git(repo, "merge", "--no-ff", "--no-commit", "docs"); write(repo, "src/modules/resolution.js", "// añadido por resolución\n");
    commit(repo, "merge con código en la resolución"); verdict(repo, 1, fail);
  });
  test("equal-version-is-not-increase", repo => {
    promote(repo); code(repo); write(repo, "VERSION", "1.0.2\n\n"); commit(repo, "mismo número con whitespace"); verdict(repo, 1, fail);
  });
  test("downgrade-merge-is-not-increase", repo => {
    promote(repo); git(repo, "checkout", "-qb", "bajada"); code(repo); align(repo, "1.0.1"); commit(repo, "baja el número");
    git(repo, "checkout", "-q", "main"); git(repo, "merge", "--no-ff", "-qm", "merge con downgrade", "bajada"); verdict(repo, 1, fail);
  });
  test("numeric-semantic-increase", repo => {
    align(repo, "1.0.9"); commit(repo, "versión nueve"); code(repo); align(repo, "1.0.10"); commit(repo, "versión diez"); verdict(repo, 0, pass);
  });
  test("minor-downgrade-is-not-increase", repo => {
    align(repo, "1.10.0"); commit(repo, "versión diez"); code(repo); align(repo, "1.9.99"); commit(repo, "baja menor aunque crezca patch"); verdict(repo, 1, fail);
  });
  test("reused-version-after-downgrade-is-not-new", repo => {
    promote(repo); code(repo); align(repo, "1.0.1"); commit(repo, "bajada");
    align(repo, "1.0.2"); commit(repo, "reutiliza el número anterior"); verdict(repo, 1, fail);
  });
  test("initial-root-does-not-cover-later-src", repo => {
    git(repo, "reset", "--hard", "HEAD^1"); code(repo); verdict(repo, 1, fail);
  });
  test("full-history-invalid-ancestor-blocks-audit", repo => {
    align(repo, "legacy"); commit(repo, "VERSION histórica malformada");
    align(repo, "2.0.0"); commit(repo, "versión dos");
    align(repo, "2.0.1"); commit(repo, "subida válida posterior"); code(repo);
    const result = verdict(repo, 1, /auditoría histórica de VERSION indeterminada/);
    assert.doesNotMatch(result.output, pass);
    assert.doesNotMatch(result.output, /⊘ .*no se comprueba el bump/);
  });
  test("src-and-legitimate-bump-in-same-commit", repo => {
    promote(repo); write(repo, "src/modules/atomic.js", "// código de la versión nueva\n");
    align(repo, "1.0.3"); commit(repo, "código y bump atómicos"); verdict(repo, 0, pass);
  });
  test("leading-zeros-are-compared-numerically", repo => {
    promote(repo); code(repo); align(repo, "01.00.003"); commit(repo, "incremento numérico"); verdict(repo, 0, pass);
  });
  test("tooling-and-docs-do-not-require-bump", repo => {
    promote(repo); write(repo, "scripts/tool.mjs", "// tooling sintético\n");
    write(repo, "tests/tool.fixture.mjs", "// fixture sintético\n"); commit(repo, "solo tooling"); docs(repo); verdict(repo, 0, pass);
  });
  for (const file of ["supabase/functions/fixture/index.ts", "android/app/src/fixture.java", "public/vendor/fixture.js", "public/sw.js"]) {
    test(`zona-${file.replaceAll("/", "-")}`, repo => { promote(repo); code(repo, file); docs(repo); verdict(repo, 1, fail); });
  }
  test("reverted-src-is-still-audited", repo => {
    promote(repo); code(repo); git(repo, "revert", "--no-edit", "HEAD"); docs(repo); verdict(repo, 1, fail);
  });
  test("lateral-revert-is-still-audited", repo => {
    promote(repo); git(repo, "checkout", "-qb", "lateral"); code(repo);
    git(repo, "revert", "--no-edit", "HEAD"); git(repo, "checkout", "-q", "main"); docs(repo);
    git(repo, "merge", "--no-ff", "-qm", "rama lateral con código revertido", "lateral"); verdict(repo, 1, fail);
  });
  test("beta-preserves-policy-over-env", repo => {
    promote(repo); code(repo); git(repo, "checkout", "-qb", "beta"); verdict(repo, 0, /⊘ rama beta:/, { GITHUB_REF_NAME: "main" });
  });
  test("real-main-not-env-beta", repo => { promote(repo); code(repo); verdict(repo, 1, fail, { GITHUB_REF_NAME: "beta" }); });
  test("missing-git-history-is-explicit", repo => {
    fs.rmSync(path.join(repo, ".git"), { recursive: true });
    const result = verdict(repo, 0, limited); assert.doesNotMatch(result.output, pass);
  });
  test("shallow-history-is-explicit", repo => {
    promote(repo); docs(repo);
    const shallow = path.join(scratch, "shallow-clone");
    git(scratch, "clone", "-q", "--depth=2", `file://${repo}`, shallow);
    const result = verdict(shallow, 0, limited); assert.doesNotMatch(result.output, pass);
  });
  test("non-history-checks-still-fail", repo => {
    promote(repo); docs(repo); write(repo, "package.json", JSON.stringify({ version: "0.0.0" }));
    write(repo, "public/apk.json", JSON.stringify({ versionName: "otro", versionCode: 2, url: "ausente.apk" }));
    write(repo, "src/modules/corrupt.js", "// " + String.fromCharCode(195, 169));
    const result = verdict(repo, 1, /package.json .version/);
    assert.match(result.output, /✗ apk.json versionCode/); assert.match(result.output, /✗ sin texto corrompido/);
  });
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
console.log(`docs-frescura-history: ${checks - failed}/${checks} repositorios Git correctos`);
process.exit(failed ? 1 : 0);
