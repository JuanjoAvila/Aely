#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export function discoverDenoTests(cwd = root) {
  function visit(relative) {
    return fs.readdirSync(path.join(cwd, relative), { withFileTypes: true }).flatMap(d => {
      const name = relative + "/" + d.name;
      return d.isDirectory() ? visit(name)
        : d.isFile() && /(?:\.test|_test)\.ts$/.test(d.name) ? [name] : [];
    });
  }
  return visit("supabase").sort();
}

export function denoArgs(file) {
  // Conservar los permisos acotados existentes; un test nuevo no recibe permisos por arrastre.
  const permissions = {
    "supabase/functions/_shared/crypto.test.ts": ["--allow-env"],
    "supabase/functions/_shared/myinvestor-counter.test.ts": ["--allow-read=supabase/functions"],
  };
  // El SDK de lifecycle referencia tipos npm; usar la caché existente sin node_modules ajeno ni instalación.
  const resolver = file === "supabase/functions/bank-disconnect/lifecycle.test.ts" ? ["--node-modules-dir=none"] : [];
  return ["test", "--cached-only", "--no-lock", "--no-prompt", ...resolver, ...(permissions[file] || []), file];
}

function findDeno(spawn, options, env, platform) {
  const attempts = [];
  function probe(executable, source) {
    const started = performance.now(); let child;
    try { child = spawn(executable, ["--version"], options); }
    catch (error) { child = { error }; }
    const available = !child.error && !child.signal && child.status === 0;
    const reason = available ? null : child.error?.code || child.signal || "version-probe-failed";
    attempts.push({ source, executable, exitCode: child.status ?? null, reason,
      durationMs: Math.round(performance.now() - started), stdout: child.stdout || "", stderr: child.stderr || "" });
    return { available, source, executable, reason, version: available ? (child.stdout || "").trim() : null, attempts };
  }
  let found = probe("deno", "PATH");
  // Un runtime roto o sin permiso no es ausencia: no cambiar de ejecutable para taparlo.
  if (found.available || found.reason !== "ENOENT") return found;
  if (env.AELY_DENO) {
    if (!path.isAbsolute(env.AELY_DENO)) return { ...found, reason: "invalid-AELY_DENO-path" };
    return probe(env.AELY_DENO, "AELY_DENO");
  }
  const seen = new Set();
  for (const key of ["USERPROFILE", "HOME"]) {
    if (!env[key] || !path.isAbsolute(env[key])) continue;
    const executable = path.join(env[key], ".deno", "bin", platform === "win32" ? "deno.exe" : "deno");
    if (seen.has(executable)) continue;
    seen.add(executable);
    found = probe(executable, key);
    if (found.available || found.reason !== "ENOENT") return found;
  }
  return found;
}

export function runDenoTests({ cwd = root, files, spawn = spawnSync, env = process.env, platform = process.platform } = {}) {
  const started = performance.now();
  let discovered;
  try { discovered = discoverDenoTests(cwd); }
  catch (error) { return { exitCode: 2, status: "inventory-error", reason: error.code || "read-failed", executed: 0 }; }
  const selected = files === undefined ? discovered : [...new Set(files.map(f => f.replaceAll("\\", "/")))];
  const report = { exitCode: 2, status: "invalid-selection", discovered, selected, executed: 0,
    passed: [], failed: [], notRun: [...selected], results: [] };
  if (!selected.length || selected.some(f => !discovered.includes(f))) return report;
  const options = { cwd, env, encoding: "utf8", shell: false, windowsHide: true, maxBuffer: 16 * 1024 * 1024 };
  report.runtime = findDeno(spawn, options, env, platform);
  if (!report.runtime.available) {
    report.status = "runtime-unavailable";
    report.reason = report.runtime.reason;
    report.durationMs = Math.round(performance.now() - started);
    return report;
  }
  for (const file of selected) {
    let child; const fileStarted = performance.now();
    try { child = spawn(report.runtime.executable, denoArgs(file), options); }
    catch (error) { child = { error }; }
    if (!child.error) report.executed++;
    const passed = !child.error && !child.signal && child.status === 0;
    report.results.push({ file, status: passed ? "passed" : "failed", exitCode: child.status ?? null,
      error: child.error?.code || null, signal: child.signal || null,
      stdout: child.stdout || "", stderr: child.stderr || "", durationMs: Math.round(performance.now() - fileStarted) });
    report.notRun = selected.slice(report.results.length);
    if (!passed) {
      // El texto «not found» puede ser un módulo roto: nunca se usa como detector de runtime.
      report.failed.push(file);
      report.status = child.error ? "execution-error" : "failed";
      report.exitCode = child.error ? 2 : 1;
      report.durationMs = Math.round(performance.now() - started);
      return report;
    }
    report.passed.push(file);
  }
  report.status = "passed";
  report.exitCode = 0;
  report.durationMs = Math.round(performance.now() - started);
  return report;
}

export function main(args = process.argv.slice(2)) {
  if (args.length === 1 && args[0] === "--list") {
    try { console.log(JSON.stringify({ status: "inventory", executed: 0, files: discoverDenoTests() }, null, 2)); return 0; }
    catch (error) { console.error("No se pudo leer el inventario Deno: " + (error.code || "read-failed")); return 2; }
  }
  if (!args.length || args.some(a => a.startsWith("--")) && !(args.length === 1 && args[0] === "--all")) {
    console.error("Uso: node scripts/run-deno-tests.mjs --list | --all | supabase/...test.ts [...]");
    return 2;
  }
  const report = runDenoTests({ files: args[0] === "--all" ? undefined : args });
  console.log(JSON.stringify(report, null, 2));
  return report.exitCode;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
