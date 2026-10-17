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
  return ["test", ...(permissions[file] || []), file];
}

export function runDenoTests({ cwd = root, files, spawn = spawnSync } = {}) {
  let discovered;
  try { discovered = discoverDenoTests(cwd); }
  catch (error) { return { exitCode: 2, status: "inventory-error", reason: error.code || "read-failed", executed: 0 }; }
  const selected = files === undefined ? discovered : [...new Set(files.map(f => f.replaceAll("\\", "/")))];
  const report = { exitCode: 2, status: "invalid-selection", discovered, selected, executed: 0,
    passed: [], failed: [], notRun: [...selected], results: [] };
  if (!selected.length || selected.some(f => !discovered.includes(f))) return report;
  const options = { cwd, encoding: "utf8", shell: false, maxBuffer: 16 * 1024 * 1024 };
  let probe;
  try { probe = spawn("deno", ["--version"], options); }
  catch (error) { probe = { error }; }
  if (probe.error || probe.signal || probe.status !== 0) {
    report.status = "runtime-unavailable";
    report.reason = probe.error?.code || probe.signal || "version-probe-failed";
    report.runtime = { exitCode: probe.status ?? null, stdout: probe.stdout || "", stderr: probe.stderr || "" };
    return report;
  }
  report.runtime = { version: (probe.stdout || "").trim() };
  for (const file of selected) {
    let child;
    try { child = spawn("deno", denoArgs(file), options); }
    catch (error) { child = { error }; }
    if (!child.error) report.executed++;
    const passed = !child.error && !child.signal && child.status === 0;
    report.results.push({ file, status: passed ? "passed" : "failed", exitCode: child.status ?? null,
      error: child.error?.code || null, signal: child.signal || null,
      stdout: child.stdout || "", stderr: child.stderr || "" });
    report.notRun = selected.slice(report.results.length);
    if (!passed) {
      // El texto «not found» puede ser un módulo roto: nunca se usa como detector de runtime.
      report.failed.push(file);
      report.status = child.error ? "execution-error" : "failed";
      report.exitCode = child.error ? 2 : 1;
      return report;
    }
    report.passed.push(file);
  }
  report.status = "passed";
  report.exitCode = 0;
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
