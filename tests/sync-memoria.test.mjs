import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const script = process.env.AELY_MEMORY_TEST_SCRIPT || path.join(root, "scripts", "sync-memoria.mjs");
const temporal = fs.mkdtempSync(path.join(os.tmpdir(), "aely-memory-synthetic-"));
const origen = path.join(temporal, "synthetic-source");
const destino = path.join(temporal, "docs", "memoria");
function ejecutar(...args) {
  const resultado = spawnSync(process.execPath, [script, ...args], {
    cwd: temporal, encoding: "utf8", env: { ...process.env, AELY_MEMORY_SOURCE: origen },
  });
  assert.equal(resultado.error, undefined);
  return resultado;
}
function guardar(nombre, texto) { fs.writeFileSync(path.join(origen, nombre), texto); }
function snapshot() {
  return Object.fromEntries(fs.readdirSync(destino).sort().map(function(nombre) {
    const fichero = path.join(destino, nombre);
    return [nombre, { texto: fs.readFileSync(fichero, "utf8"), mtime: fs.statSync(fichero).mtimeMs }];
  }));
}
try {
  fs.mkdirSync(origen);
  // Todo el contenido es inventado: ninguna prueba consulta la memoria del usuario.
  guardar("a-synthetic.md", String.raw`---
originSessionId: 00000000-0000-4000-8000-000000000001
---
# synthetic
Rutas:
E:\Synthetic Vault\private.md
Z:/synthetic/private.md
c:/Users/SyntheticPerson/private.md
\\synthetic-host\synthetic-share\private.md
[guía](<Q:\synthetic repo\docs\ROADMAP.md>)
[pruebas](R:/synthetic/docs/TESTING.md#synthetic)
[prefijo](../../../../../T:/synthetic/docs/TESTING.md)
[privado](<S:/synthetic vault/private.md>)
[relativo](../TESTING.md)
Gastado 37→42, variación ±5.
saldo: 19,25 EUR
Saldo: 1 234,50.
Comisión = -2,75 €
USD 8.50; £4; 9 euros; 1 234,50 EUR.
presupuesto 310 KB
Un movimiento repite +23,17.
Con nómina adelantada la variación es ±700.
Version v4.26.95.1, SHA abcdef0123456789, bundle 277 KB, latencia 32 ms.
`);
  guardar("b-synthetic.md", "# synthetic\nGastado 53 -> 61; ajuste +8.\nSaldo 27 a 31.\nsynthetic@example.invalid\nES1234567890123456789012\n+34 612345678\n");
  const antes = fs.readFileSync(path.join(origen, "a-synthetic.md"), "utf8");
  let r = ejecutar("--check");
  assert.equal(r.status, 1, "check detecta deriva sin crear destino");
  assert.equal(fs.existsSync(destino), false);
  r = ejecutar();
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(fs.readdirSync(destino).sort(), ["a-synthetic.md", "b-synthetic.md"]);
  const a = fs.readFileSync(path.join(destino, "a-synthetic.md"), "utf8");
  const b = fs.readFileSync(path.join(destino, "b-synthetic.md"), "utf8");
  for (const dato of ["originSessionId", "00000000-0000-4000-8000-000000000001", "Synthetic Vault", "synthetic/private", "SyntheticPerson", "synthetic-host", "37", "42", "±5", "19,25", "-2,75", "8.50", "£4", "9 euros", "1 234,50", "+23,17", "±700"]) {
    assert.equal(a.includes(dato), false, "no exportar " + dato);
  }
  assert.match(a, /\[guía\]\(\.\.\/ROADMAP\.md\)/);
  assert.match(a, /\[pruebas\]\(\.\.\/TESTING\.md#synthetic\)/);
  assert.match(a, /\[prefijo\]\(\.\.\/TESTING\.md\)/);
  assert.match(a, /\[relativo\]\(\.\.\/TESTING\.md\)/);
  assert.match(a, /Saldo: <importe>\./, "tacha también las cifras agrupadas sin moneda");
  assert.match(a, /<importe>;\s*<importe>;\s*<importe>;\s*<importe>\./, "no deja el primer dígito de una cifra agrupada con moneda");
  for (const tecnico of ["v4.26.95.1", "abcdef0123456789", "310 KB", "277 KB", "32 ms"]) assert.ok(a.includes(tecnico), tecnico);
  for (const dato of ["53", "61", "+8", "27 a 31", "synthetic@example.invalid", "ES1234567890123456789012", "612345678"]) assert.equal(b.includes(dato), false, dato);
  assert.equal(fs.readFileSync(path.join(origen, "a-synthetic.md"), "utf8"), antes, "no modifica la fuente");
  const primera = snapshot();
  r = ejecutar();
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(snapshot(), primera, "segunda exportación sin escritura ni reintroducción");
  assert.equal(ejecutar("--check").status, 0);

  fs.writeFileSync(path.join(destino, "obsolete-synthetic.md"), "# synthetic\nNo borrar ante un fallo posterior.\n");
  const previoFallo = snapshot();
  guardar("a-synthetic.md", "# synthetic\nCambio preparado antes del documento inválido.\n");
  guardar("z-synthetic.md", "# synthetic\nES12 3456 7890 1234 5678 9012\n");
  r = ejecutar();
  assert.equal(r.status, 1, "la red de seguridad rechaza el último documento");
  assert.match(r.stderr, /NO se ha escrito nada/);
  assert.deepEqual(snapshot(), previoFallo, "fallo final no escribe ni borra ningún destino");
  assert.equal(ejecutar("--check").status, 1);
  assert.deepEqual(snapshot(), previoFallo, "check tampoco escribe ni borra");
  fs.unlinkSync(path.join(origen, "z-synthetic.md"));
  r = ejecutar();
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.existsSync(path.join(destino, "obsolete-synthetic.md")), false, "borra sobrante solo tras validar todo");
  assert.match(fs.readFileSync(path.join(destino, "a-synthetic.md"), "utf8"), /Cambio preparado/);
  assert.equal(ejecutar("--check").status, 0);
  console.log("✓ sync-memoria: dos documentos sintéticos, filtros, enlaces, idempotencia y rechazo sin escrituras/borrados");
} finally {
  const seguro = path.resolve(temporal);
  assert.equal(path.dirname(seguro), path.resolve(os.tmpdir()));
  assert.ok(path.basename(seguro).startsWith("aely-memory-synthetic-"));
  fs.rmSync(seguro, { recursive: true, force: true });
  assert.equal(fs.existsSync(seguro), false);
}
