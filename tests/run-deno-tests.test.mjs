import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";
import { discoverDenoTests, denoArgs, runDenoTests } from "../scripts/run-deno-tests.mjs";

const A = "supabase/functions/_shared/crypto.test.ts";
const B = "supabase/functions/_shared/myinvestor-counter.test.ts";
const C = "supabase/functions/nested/deeper/new_test.ts";
function fixture(run) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "aely deno runner "));
  try {
    for (const file of [A, B, C, "supabase/functions/not-a-test.ts"]) {
      fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
      fs.writeFileSync(path.join(cwd, file), "// synthetic, never executed\n");
    }
    return run(cwd);
  } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
}
function processDouble(reply) {
  const calls = [];
  const spawn = (command, args, options) => {
    calls.push({ command, args, options });
    return args[0] === "--version" ? { status: 0, stdout: "deno synthetic" } : reply(args.at(-1), calls.length);
  };
  return { spawn, calls };
}

test("descubrimiento recursivo incluye nuevos tests y excluye fuente corriente", () => fixture(cwd => {
  assert.deepEqual(discoverDenoTests(cwd), [A, B, C]);
  const child = processDouble(() => ({ status: 0 }));
  const report = runDenoTests({ cwd, spawn: child.spawn });
  assert.equal(report.exitCode, 0); assert.equal(report.executed, 3);
  assert.deepEqual(report.passed, [A, B, C]); assert.deepEqual(report.notRun, []);
  assert.deepEqual(child.calls.slice(1).map(c => c.args.at(-1)), [A, B, C]);
}));

test("runtime ausente es EXIT2 con todos pendientes y cero tests ejecutados", () => fixture(cwd => {
  let calls = 0;
  const report = runDenoTests({ cwd, files: [A, B], env: {}, spawn() { calls++; return { status: null, error: { code: "ENOENT" } }; } });
  assert.equal(report.exitCode, 2); assert.equal(report.status, "runtime-unavailable");
  assert.equal(report.executed, 0); assert.deepEqual(report.passed, []);
  assert.deepEqual(report.notRun, [A, B]); assert.equal(calls, 1);
}));

test("version que falla, permiso denegado o excepcion de arranque tampoco son verde", () => fixture(cwd => {
  for (const spawn of [() => ({ status: 7, stderr: "broken runtime" }),
    () => ({ status: null, error: { code: "EACCES" } }), () => { throw Object.assign(new Error("spawn"), { code: "EPERM" }); }]) {
    const report = runDenoTests({ cwd, files: [C], spawn });
    assert.equal(report.exitCode, 2); assert.equal(report.executed, 0); assert.deepEqual(report.notRun, [C]);
  }
}));

test("modulo not found es EXIT1; frena el primer fallo sin reintentar ni omitirlo", () => fixture(cwd => {
  const child = processDouble(file => file === B ? { status: 1, stderr: "Module not found synthetic" } : { status: 0 });
  const report = runDenoTests({ cwd, files: [A, B, C], spawn: child.spawn });
  assert.equal(report.exitCode, 1); assert.equal(report.status, "failed");
  assert.deepEqual(report.passed, [A]); assert.deepEqual(report.failed, [B]);
  assert.deepEqual(report.notRun, [C]); assert.equal(report.executed, 2);
  assert.equal(report.results[1].stderr, "Module not found synthetic"); assert.equal(child.calls.length, 3);
}));

test("senal y desaparicion del ejecutable tras el probe dejan fallo y pendientes", () => fixture(cwd => {
  for (const result of [{ status: null, signal: "SIGTERM" }, { status: null, error: { code: "ENOENT" } }]) {
    const child = processDouble(() => result);
    const report = runDenoTests({ cwd, files: [A, B], spawn: child.spawn });
    assert.notEqual(report.exitCode, 0); assert.deepEqual(report.failed, [A]);
    assert.deepEqual(report.notRun, [B]); assert.equal(child.calls.length, 2);
  }
}));

test("seleccion focal estable, sin shell y con permisos limitados por archivo exacto", () => fixture(cwd => {
  const child = processDouble(() => ({ status: 0 }));
  const report = runDenoTests({ cwd, files: [B, A, B, C.replaceAll("/", "\\")], spawn: child.spawn });
  assert.equal(report.exitCode, 0); assert.deepEqual(report.passed, [B, A, C]);
  const fixed = ["test", "--cached-only", "--no-lock", "--no-prompt"];
  assert.deepEqual(child.calls.map(c => c.args), [["--version"],
    [...fixed, "--allow-read=supabase/functions", B], [...fixed, "--allow-env", A], [...fixed, C]]);
  for (const call of child.calls) { assert.equal(call.command, "deno"); assert.equal(call.options.cwd, cwd); assert.equal(call.options.shell, false); }
}));

test("ruta ajena, traversal o seleccion vacia nunca arrancan procesos", () => fixture(cwd => {
  for (const files of [[], ["../outside.test.ts"], [A, "supabase/absent.test.ts"], ["supabase/functions/../functions/nested/deeper/new_test.ts"]]) {
    const report = runDenoTests({ cwd, files, spawn() { assert.fail("No debe ejecutar nada"); } });
    assert.equal(report.exitCode, 2); assert.equal(report.executed, 0); assert.equal(report.status, "invalid-selection");
  }
}));

test("inventario vacio o ilegible no produce pase de cero tests", () => fixture(cwd => {
  fs.rmSync(path.join(cwd, "supabase"), { recursive: true });
  const missing = runDenoTests({ cwd, spawn() { assert.fail("No debe ejecutar nada"); } });
  assert.equal(missing.exitCode, 2); assert.equal(missing.status, "inventory-error");
  fs.mkdirSync(path.join(cwd, "supabase"));
  const empty = runDenoTests({ cwd, spawn() { assert.fail("No debe ejecutar nada"); } });
  assert.equal(empty.exitCode, 2); assert.equal(empty.status, "invalid-selection");
}));

test("fallback PATH sano prevalece sobre configuracion y perfil", () => fixture(cwd => {
  const child = processDouble(() => ({ status: 0 }));
  const report = runDenoTests({ cwd, files: [C], env: { AELY_DENO: path.join(cwd, "configured deno.exe"), USERPROFILE: cwd }, spawn: child.spawn });
  assert.equal(report.exitCode, 0); assert.equal(report.runtime.executable, "deno");
  assert.equal(report.runtime.source, "PATH"); assert.equal(child.calls.length, 2);
}));

test("fallback ENOENT usa AELY_DENO absoluto literal, con espacios y sin shell", () => fixture(cwd => {
  const executable = path.join(cwd, "runtime con espacios", "deno.exe"); const calls = [];
  const report = runDenoTests({ cwd, files: [C], env: { AELY_DENO: executable, USERPROFILE: cwd }, spawn(command, args, options) {
    calls.push({ command, args, options });
    if (command === "deno") return { status: null, error: { code: "ENOENT" } };
    assert.equal(command, executable); return { status: 0, stdout: args[0] === "--version" ? "deno configured" : "synthetic passed" };
  } });
  assert.equal(report.exitCode, 0); assert.equal(report.runtime.executable, executable);
  assert.equal(report.runtime.source, "AELY_DENO"); assert.equal(calls.length, 3);
  assert(calls.every(c => c.options.shell === false));
  assert.equal(calls[2].args.at(-1), C);
}));

test("fallback perfil USERPROFILE y HOME respeta sufijo de plataforma", () => fixture(cwd => {
  for (const [platform, key] of [["win32", "USERPROFILE"], ["linux", "HOME"]]) {
    const executable = path.join(cwd, ".deno", "bin", platform === "win32" ? "deno.exe" : "deno");
    const report = runDenoTests({ cwd, files: [C], platform, env: { [key]: cwd }, spawn(command) {
      if (command === "deno") return { status: null, error: { code: "ENOENT" } };
      assert.equal(command, executable); return { status: 0, stdout: "deno profile" };
    } });
    assert.equal(report.exitCode, 0); assert.equal(report.runtime.source, key);
    assert.equal(report.runtime.executable, executable);
  }
}));

test("fallback solo tras ENOENT, nunca tapa error del runtime de PATH", () => fixture(cwd => {
  for (const result of [{ status: 7, stderr: "Module not found" }, { status: null, error: { code: "EACCES" } }, { status: null, signal: "SIGTERM" }]) {
    let calls = 0;
    const report = runDenoTests({ cwd, files: [C], env: { AELY_DENO: path.join(cwd, "deno.exe") }, spawn(command) { calls++; assert.equal(command, "deno"); return result; } });
    assert.equal(report.exitCode, 2); assert.equal(report.executed, 0); assert.equal(calls, 1);
  }
}));

test("fallback configuracion invalida o inexistente es explicita y no cambia a otro perfil", () => fixture(cwd => {
  for (const executable of ["relative/deno.exe", '"'+path.join(cwd,"deno.exe")+'"', path.join(cwd,"absent deno.exe")]) {
    const calls=[];
    const report=runDenoTests({ cwd, files:[C], env:{ AELY_DENO:executable, USERPROFILE:cwd }, spawn(command) {
      calls.push(command); return { status:null,error:{code:"ENOENT"} };
    } });
    assert.equal(report.exitCode,2); assert.equal(report.executed,0); assert.deepEqual(report.notRun,[C]);
    assert.equal(calls.length,path.isAbsolute(executable)?2:1);
    if(path.isAbsolute(executable)) assert.equal(calls[1],executable);
  }
}));

test("fallback perfiles distintos y runtime ausente conservan intentos y pendientes", () => fixture(cwd => {
  const first=path.join(cwd,"first"), second=path.join(cwd,"second"); const calls=[];
  const report=runDenoTests({ cwd,files:[A,B],env:{USERPROFILE:first,HOME:second},spawn(command) {
    calls.push(command);return {status:null,error:{code:"ENOENT"}};
  } });
  assert.equal(report.exitCode,2); assert.equal(report.executed,0); assert.deepEqual(report.notRun,[A,B]);
  assert.equal(calls.length,3);assert.equal(report.runtime.attempts.length,3);
  assert.deepEqual(report.runtime.attempts.map(a=>a.source),["PATH","USERPROFILE","HOME"]);
}));

test("fallback no se repite si los dos perfiles resuelven al mismo ejecutable", () => fixture(cwd => {
  let calls=0;
  const report=runDenoTests({cwd,files:[C],env:{USERPROFILE:cwd,HOME:cwd},spawn(){calls++;return{status:null,error:{code:"ENOENT"}};}});
  assert.equal(report.exitCode,2);assert.equal(calls,2);assert.equal(report.runtime.attempts.length,2);
}));

test("lifecycle usa solo cache global para tipos npm, sin instalar ni quitar typecheck", () => {
  assert.deepEqual(denoArgs("supabase/functions/bank-disconnect/lifecycle.test.ts"),
    ["test", "--cached-only", "--no-lock", "--no-prompt", "--node-modules-dir=none", "supabase/functions/bank-disconnect/lifecycle.test.ts"]);
});
