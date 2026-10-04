import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const yaml = fs.readFileSync(path.join(root, ".github/workflows/supabase.yml"), "utf8").replace(/\r\n/g, "\n");
// Guardián del contrato concreto, sin parser YAML nuevo ni credenciales: el Bash es el del workflow.
const events = yaml.split("\non:\n")[1]?.split("\njobs:\n")[0];
assert.ok(events);
assert.deepEqual([...events.matchAll(/^  ([\w]+):/gm)].map(m => m[1]), ["workflow_dispatch"]);
assert.match(events, /funcion:\n        description:.*\n        required: true\n        type: string\n        default: ""/);
assert.match(events, /migraciones:[\s\S]*default: "no"[\s\S]*type: choice[\s\S]*options: \["no", "si"\]/);
const steps = [...yaml.matchAll(/^      - name: (.+)\n([\s\S]*?)(?=^      - name:|$(?![\s\S]))/gm)]
  .map(m => ({ name: m[1], text: m[2] }));
function step(name) { const s = steps.find(s => s.name === name); assert.ok(s, name); return s.text; }
function script(name) {
  const body = step(name).split("        run: |\n")[1];
  assert.ok(body, name);
  const code = body.split("\n").filter(l => l.startsWith("          ")).map(l => l.slice(10)).join("\n");
  // Solo REF es una variable configurada; ningún input del usuario se inserta como código.
  assert.doesNotMatch(code, /\$\{\{[^}]*inputs[.]/);
  return code.replaceAll('\u0024{{ vars.SUPABASE_PROJECT_REF }}', 'proyecto-ficticio');
}
assert.ok(steps.findIndex(s => s.name === "Validar función") < steps.findIndex(s => s.name === "Comprobar configuración"));
assert.ok(steps.findIndex(s => s.name === "Validar función") < steps.findIndex(s => s.name === "Aplicar migraciones"));
assert.doesNotMatch(step("Validar función"), /^        (?:if|continue-on-error):/m);
for (const name of ["Validar función", "Desplegar Edge Functions"]) {
  assert.match(step(name), /FN: \$\{\{ inputs.funcion \}\}/);
  assert.match(step(name), /shell: bash/);
}
assert.match(step("Comprobar configuración"), /MIGRACIONES: \$\{\{ inputs.migraciones \}\}/);
assert.match(step("Aplicar migraciones"), /if: steps.gate.outputs.skip != 'true' && steps.gate.outputs.migrate == 'true'/);
assert.match(step("Desplegar Edge Functions"), /if: steps.gate.outputs.skip != 'true'/);
assert.equal((yaml.match(/supabase functions deploy/g) || []).length, 1);
assert.match(script("Desplegar Edge Functions"), /supabase functions deploy "\$FN" --project-ref/);
const validate = script("Validar función"), gate = script("Comprobar configuración");
const deploy = script("Desplegar Edge Functions"), migrate = script("Aplicar migraciones");
assert.doesNotMatch([validate, gate, deploy, migrate].join("\n"), /\$\{\{/);
let bash = process.env.BASH_PATH || "bash";
if (process.platform === "win32" && !process.env.BASH_PATH) {
  const where = spawnSync("where.exe", ["git"], { encoding: "utf8" });
  const git = where.stdout?.trim().split(/\r?\n/)[0];
  const bundled = git && path.resolve(path.dirname(git), "..", "bin", "bash.exe");
  if (bundled && fs.existsSync(bundled)) bash = bundled;
}
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "aely-supabase-workflow-"));
try {
  const output = path.join(temp, "gate.txt");
  function run(code, overrides = {}) {
    fs.writeFileSync(output, "");
    const result = spawnSync(bash, ["--noprofile", "--norc", "-e", "-c", code], {
      cwd: root, encoding: "utf8", env: { ...process.env, FN: "ingest", TOKEN: "ficticio",
        REF: "proyecto-ficticio", DB_PASSWORD: "ficticia", MIGRACIONES: "no",
        GITHUB_OUTPUT: output.replaceAll("\\", "/"), ...overrides },
    });
    assert.ifError(result.error);
    return { ...result, outputs: fs.readFileSync(output, "utf8") };
  }
  const functions = fs.readdirSync(path.join(root, "supabase/functions"))
    .filter(f => fs.existsSync(path.join(root, "supabase/functions", f, "index.ts")));
  for (const FN of functions) assert.equal(run(validate, { FN }).status, 0, FN);
  const invalid = ["", " ", "no-existe", "../ingest", "ingest/index.ts", "_shared", "INGEST", "--all",
    "ingest; echo INYECTADO", 'ingest"; echo INYECTADO; #', "$(echo INYECTADO)", "\u0060echo INYECTADO\u0060",
    "ingest\necho INYECTADO", "ingest*", "ingest\\index.ts"];
  // Si la validación cae, ni siquiera se alcanza el mock de SQL/despliegue.
  const mock = 'supabase(){ printf "MOCK"; printf " <%s>" "$@"; printf "\\n"; }\n';
  for (const FN of invalid) {
    const r = run(mock + validate + "\n" + migrate + "\n" + deploy, { FN });
    assert.notEqual(r.status, 0, JSON.stringify(FN));
    assert.doesNotMatch(r.stdout, /MOCK|INYECTADO/);
  }
  for (const MIGRACIONES of ["", "no", "si", "SI", "si; echo INYECTADO"]) {
    for (const DB_PASSWORD of ["", "ficticia"]) {
      for (const configured of [true, false]) {
        const r = run(gate, { MIGRACIONES, DB_PASSWORD, TOKEN: configured ? "ficticio" : "" });
        assert.equal(r.status, 0);
        assert.match(r.outputs, new RegExp("skip=" + !configured));
        assert.match(r.outputs, new RegExp("migrate=" + (MIGRACIONES === "si" && !!DB_PASSWORD)));
        assert.doesNotMatch(r.stdout, /INYECTADO/);
      }
    }
  }
  assert.match(run(gate, { REF: "" }).outputs, /skip=true/);
  for (const FN of ["ingest", "bank-sync"]) {
    const r = run(mock + validate + "\n" + deploy, { FN });
    assert.equal(r.status, 0);
    assert.match(r.stdout, new RegExp("MOCK <functions> <deploy> <" + FN + "> <--project-ref> <proyecto-ficticio>"));
    assert.doesNotMatch(r.stdout, /<db>|<link>/);
  }
  // La ruta opt-in se observa con un mock, nunca con la CLI real.
  const r = run(mock + validate + "\n" + migrate);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /MOCK <link>/);
  assert.match(r.stdout, /MOCK <db> <push> <--include-all>/);
  console.log("✅ supabase-workflow: evento manual, " + functions.length + " funciones válidas, " + invalid.length + " entradas rechazadas, gate y argumentos con CLI simulado");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
