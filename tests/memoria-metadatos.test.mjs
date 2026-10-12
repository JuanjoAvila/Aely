import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const script = process.env.AELY_MEMORY_TEST_SCRIPT || path.join(root, "scripts", "sync-memoria.mjs");
const fuente = fs.readFileSync(script, "utf8");
const temporal = fs.mkdtempSync(path.join(os.tmpdir(), "aely-metadata-synthetic-"));
const origen = path.join(temporal, "source");
const destino = path.join(temporal, "docs", "memoria");
const tokens = ["v4.26.123", "versión 4.26.123.1", "PR 321", "PR#321", "PR321", "18:37", "08:19:23", "4 horas", "4 h", "90 minutos", "SHA abcdef0123456789", "23 tests", "23/23 pruebas", "2048 bytes", "310 KB"];
let comprobaciones = 0;
function snapshot() {
  return Object.fromEntries(fs.readdirSync(destino).sort().map(function(f) {
    return [f, [fs.readFileSync(path.join(destino, f), "utf8"), fs.statSync(path.join(destino, f)).mtimeMs]];
  }));
}
function ejecutar(ruta, texto, args = []) {
  fs.writeFileSync(path.join(origen, "a-synthetic.md"), "# synthetic\nCambio preparado que no debe salir si hay rechazo.\n");
  fs.writeFileSync(path.join(origen, "z-synthetic.md"), "# synthetic\n" + texto + "\n");
  const r = spawnSync(process.execPath, [ruta, ...args], { cwd: temporal, encoding: "utf8", env: { ...process.env, AELY_MEMORY_SOURCE: origen } });
  assert.equal(r.error, undefined);
  comprobaciones++;
  return r;
}
function conservar(ruta, texto) {
  const r = ejecutar(ruta, texto);
  assert.equal(r.status, 0, "metadatos sintéticos deben conservarse");
  const salida = fs.readFileSync(path.join(destino, "z-synthetic.md"), "utf8");
  assert.equal(salida.slice(salida.indexOf("# synthetic")), "# synthetic\n" + texto + "\n");
  const previo = snapshot();
  assert.equal(ejecutar(ruta, texto, ["--check"]).status, 0);
  assert.deepEqual(snapshot(), previo);
}
function rechazar(ruta, texto, dato, regla) {
  fs.writeFileSync(path.join(destino, "obsolete-synthetic.md"), "Conservar incluso si sobra.\n");
  const previo = snapshot();
  for (const args of [[], ["--check"]]) {
    const r = ejecutar(ruta, texto, args);
    assert.equal(r.status, 1, "dato ambiguo debe abortar");
    assert.match(r.stderr, /en z-synthetic\.md sigue habiendo/);
    assert.match(r.stderr, /NO se ha escrito nada/);
    if (regla) assert.ok(r.stderr.includes(regla));
    assert.equal((r.stdout + r.stderr).includes(dato), false, "diagnóstico sin el dato");
    assert.deepEqual(snapshot(), previo, "rechazo no escribe ni borra ni cambia mtime");
  }
}
function sanear(ruta, texto, dato) {
  const r = ejecutar(ruta, texto);
  assert.equal(r.status, 0, "patrón conocido se tacha");
  assert.equal(fs.readFileSync(path.join(destino, "z-synthetic.md"), "utf8").includes(dato), false);
  assert.equal((r.stdout + r.stderr).includes(dato), false);
}
try {
  fs.mkdirSync(origen);
  fs.mkdirSync(destino, { recursive: true });
  // Todos los nombres, importes e identidades son inventados; no se lee memoria personal.
  conservar(script, tokens.flatMap(function(token) {
    return ["Saldo: " + token + ".", "La cuota se revisó con " + token + ".", "Movimientos:\n" + token + "."];
  }).join("\n\n"));
  conservar(script, "Saldo: PR321 y v4.26.123; 18:37; 23/23 pruebas; 2048 bytes.\n\nSaldo: \u0000x\u0000 PR321.");
  for (const token of tokens) {
    for (const nombre of ["Banco Sintético Liria", "Persona Sintética Nerea"]) {
      rechazar(script, "Saldo: " + token + "; " + nombre + " conservó 143,27.", "143,27", "cifra sin sanear");
      rechazar(script, nombre + " conservó 143,27; revisión " + token + ".", "143,27", "cifra sin sanear");
    }
  }
  for (const token of ["PR321,45", "PR321.45", "v4.26.123.1.2", "24:37", "18:79", "18:37:99", "321", "143,27", "٢٣٤,٥٦"]) {
    rechazar(script, "Saldo: referencia " + token + ".", token, "cifra sin sanear");
  }
  for (const texto of ["Saldo: PR321 EUR.", "Saldo: EUR PR321.", "Saldo: v4.26.123 EUR.", "Saldo: EUR v4.26.123."]) {
    const r = ejecutar(script, texto);
    assert.ok(r.status === 1 || !fs.readFileSync(path.join(destino, "z-synthetic.md"), "utf8").includes("321"), "moneda no convierte una cantidad en metadato");
  }
  const identidades = [
    ["IBAN", "ES1234567890123456789012"],
    ["correo", "synthetic@example.invalid"],
    ["teléfono", "+34 612345678"],
    ["ruta", String.raw`Q:\synthetic\private.md`],
    ["importe", "Saldo: 143,27 EUR"],
  ];
  for (const [, texto] of identidades) sanear(script, texto, texto);
  rechazar(script, "ES12 3456 7890 1234 5678 9012", "ES12 3456 7890 1234 5678 9012", "IBAN separado");
  rechazar(script, "+34 612 345 678", "+34 612 345 678", "teléfono");

  // Si un redactor deja de funcionar, la segunda barrera debe abortar, no exportar el dato.
  const inicioFiltros = fuente.indexOf("const FILTROS = [");
  const finFiltros = fuente.indexOf("/* Red de seguridad", inicioFiltros);
  assert.ok(inicioFiltros >= 0 && finFiltros > inicioFiltros);
  const sinTachar = path.join(temporal, "unsanitized.mjs");
  fs.writeFileSync(sinTachar, (fuente.slice(0, inicioFiltros) + "const FILTROS = [];\n" + fuente.slice(finFiltros))
    .replace('[rutas, "ruta de Windows"]', '[function(txt) { return txt; }, "ruta de Windows"]')
    .replace('[importes, "importe"]', '[function(txt) { return txt; }, "importe"]'));
  for (const [, texto] of identidades) rechazar(sinTachar, texto, texto);

  // Cada mutante toca una regla y debe caer por una expectativa independiente del regex.
  const mutaciones = [
    ["version", "(?:versi[oó]n[ \\t]+v?|v)", "(?:inexistente[ \\t]+)", function(ruta) { conservar(ruta, "Saldo: v4.26.123."); }],
    ["PR", "PR[ \\t]*#?[ \\t]*\\d+", "PRINEXISTENTE[ \\t]*\\d+", function(ruta) { conservar(ruta, "Saldo: PR321."); }],
    ["hora", "(?:[01]?\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d)?", "HORA_INEXISTENTE", function(ruta) { conservar(ruta, "Saldo: 18:37."); }],
    ["SHA", "SHA[ \\t]+[a-f\\d]{7,64}", "SHA_INEXISTENTE", function(ruta) { conservar(ruta, "Saldo: SHA abcdef0123456789."); }],
    ["conteo", "\\d+(?:\\/\\d+)?[ \\t]+(?:tests?|pruebas?|comprobaciones?|ficheros?)", "CONTEO_INEXISTENTE", function(ruta) { conservar(ruta, "Saldo: 23/23 pruebas."); }],
    ["unidades", "(?:[KMGT]?i?B|bytes?|px|ms|segundos?|minutos?|horas?|h|tests?|ficheros?)", "(?:UNIDAD_INEXISTENTE)", function(ruta) { conservar(ruta, "Saldo: 2048 bytes y 310 KB; 4 horas."); }],
    ["banco-persona", "(?:capital|bancos?|personas?|titulares?)", "(?:capital)", function(ruta) { rechazar(ruta, "Banco Sintético Liria conservó 143,27; revisión PR321.", "143,27"); }],
    ["moneda", "if (new RegExp(MONEDA", "if (false && new RegExp(MONEDA", function(ruta) { rechazar(ruta, "Saldo: EUR v4.26.123.", "v4.26.123"); }],
    ["residual", "return (financiero.test(lectura) || continuacion)", "return false && (financiero.test(lectura) || continuacion)", function(ruta) { rechazar(ruta, "Saldo: PR321; Banco Sintético Liria conservó 143,27.", "143,27"); }],
    ["telefono-residual", '[/\\+34(?:[ \\t-]*\\d){9}\\b/, "un teléfono"]', '[/TELEFONO_INEXISTENTE/, "un teléfono"]', function(ruta) { rechazar(ruta, "+34 612 345 678", "+34 612 345 678"); }],
    ["saneado-ruta", '[rutas, "ruta de Windows"]', '[function(txt) { return txt; }, "mutante"]', function(ruta) { sanear(ruta, identidades[3][1], identidades[3][1]); }],
    ["saneado-importe", '[importes, "importe"]', '[function(txt) { return txt; }, "mutante"]', function(ruta) { sanear(ruta, identidades[4][1], identidades[4][1]); }],
    ...identidades.slice(0, 3).map(function([nombre, texto]) {
      const linea = fuente.split("\n").find(function(linea) { return linea.trimEnd().endsWith('"' + nombre + '"],'); });
      assert.ok(linea, "redactor vigente: " + nombre);
      return ["saneado-" + nombre, linea, "", function(ruta) { sanear(ruta, texto, texto); }];
    }),
  ];
  for (const [nombre, antes, despues, prueba] of mutaciones) {
    assert.ok(fuente.includes(antes), "mutación vigente: " + nombre);
    const ruta = path.join(temporal, "mutant.mjs");
    fs.writeFileSync(ruta, fuente.replace(antes, despues));
    const sintaxis = spawnSync(process.execPath, ["--check", ruta], { encoding: "utf8" });
    assert.equal(sintaxis.error, undefined);
    assert.equal(sintaxis.status, 0, "mutante válido, no un error de sintaxis: " + nombre);
    assert.throws(function() { prueba(ruta); }, "mutante debe morir: " + nombre);
    console.log("✓ mutación " + nombre + " rechazada");
  }
  console.log("✓ memoria-metadatos: " + comprobaciones + " ejecuciones sintéticas; " + mutaciones.length + " mutantes muertos");
} finally {
  const seguro = path.resolve(temporal);
  assert.equal(path.dirname(seguro), path.resolve(os.tmpdir()));
  assert.ok(path.basename(seguro).startsWith("aely-metadata-synthetic-"));
  fs.rmSync(seguro, { recursive: true, force: true });
}
