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

  // Los esperados son literales independientes del filtro: su regex y el detector compartían huecos.
  const fallos = [];
  function caso(nombre, fn) {
    try { fn(); }
    catch (error) { fallos.push(nombre + ": " + error.message); }
  }
  caso("backticks y rango con en-dash", function() {
    guardar("c-synthetic.md", "# synthetic\nSaldo: `643,21`.\nPresupuesto: 741–852.\nSaldo `963`–`1 074,50`.\nCapital invertido: `285,82`.\nPresupuesto: 310 KB, 32 ms, 7 tests y 2 ficheros.\n");
    r = ejecutar();
    assert.equal(r.status, 0, r.stderr);
    const salida = fs.readFileSync(path.join(destino, "c-synthetic.md"), "utf8");
    assert.equal(salida.slice(salida.indexOf("# synthetic")), "# synthetic\nSaldo: <importe>.\nPresupuesto: <importe>.\nSaldo <importe>.\nCapital invertido: <importe>.\nPresupuesto: 310 KB, 32 ms, 7 tests y 2 ficheros.\n");
    const previo = snapshot();
    assert.equal(ejecutar().status, 0);
    assert.deepEqual(snapshot(), previo, "regenerar no reintroduce cantidades ni escribe");
    assert.equal(ejecutar("--check").status, 0);
  });
  const rechazosBase = [
    "Mi saldo quedó en 563,21 tras el ajuste.",
    "Mi saldo quedó en 2.074,71.",
    "Se registraron gastos por `674,32` durante el mes.",
    "Un intervalo de 785–896 EUR quedó pendiente.",
    "Presupuesto **974**–**1 085**.",
    "Saldo: 1.196/1.307.",
    "EUR 1.418–1.529.",
    "Saldo `1 630–1 741`.",
    "Saldo: 1\u202f852,50.",
    "El saldo quedó en 1.963,60; el bundle ocupa 310 KB.",
    "Saldo: １２３,４５.",
    "Saldo: ١٢٣,٤٥.",
    "Saldo: 𝟙𝟚𝟛,𝟜𝟝.",
    "Capital invertido: ２３４,５６.",
    "Capital aportado quedó en\n345,67.",
    "[Capital](#nota) social quedó en 345,67.",
    "[Capital](#nota) **invertido** quedó en 123,45.",
    "[Capital](#nota) [aportado](#otra) quedó en ٢٣٤,٥٦.",
    "[`Capital`](#nota) social quedó en 345,67.",
    '[Capital](#nota "nota (") social quedó en 345,67.',
    '[Capital](#nota "nota )") social quedó en 345,67.',
    "[Capital](#nota 'nota (') social quedó en 345,67.",
    "[Capital](#nota 'nota )') social quedó en 345,67.",
    '[Capital](<#nota> "nota (") social quedó en 345,67.',
    '[Capital](<#nota> "nota )") social quedó en 345,67.',
    "~~Capital~~ ~~social~~ quedó en 345,67.",
    "Capi~~tal~~ social quedó en 876,54.",
    "Ca~~pi~~tal social quedó en 876,54.",
    "_Ca~~pi~~tal_ social quedó en ٨٧٦,٥٤.",
    "~~Capi~~tal social quedó en\n876,54.",
    "Capital quedó en 123,45.",
    "_Capital_ quedó en ٢٣٤,٥٦.",
    "[Capital](#nota) quedó en 345,67.",
    "Capital\u00a0123,45.",
    "Capital\\\n123,45.",
    "[Capital](./nota_(2026)) social describe un formato de 310 KB; Version v4.26.95.1, SHA abcdef0123456789.",
    "Capital\ninvertido quedó en 123,45.",
    "Capital\r\naportado quedó en ٢٣٤,٥٦.",
    "Capital **social** quedó en 345,67.",
    "Capital `invertido` quedó en 456,78.",
    "**Capital**\n`social` quedó en 789,01.",
    "- Capital\n  **aportado** quedó en ٥٦٧,٨٩.",
    "> Capital\n> **social** quedó en 678,90.",
    "El saldo quedó en\n123,45.",
    "El saldo quedó en\r\n456,78.",
    "- El saldo quedó en\n  567,89.",
    "> El importe quedó en\n> `234,56`.",
    "| Patrimonio | Valor |\n| --- | --- |\n| sintético | ３４５,６７ |",
  ];
  // Producto finito de vocabulario ya reconocido y presentación Markdown; no deriva del detector.
  const continuidades = [" ", "\n", "\r\n", "\u00a0", "\\\n", "\\\r\n"];
  const formatos = [
    ["Capital", "", ""], ["Capital", "*", "*"], ["Capital", "**", "**"],
    ["Capital", "_", "_"], ["Capital", "__", "__"], ["Capital", "`", "`"],
    ["Capital", "**_", "_**"], ["Capital", "*`", "`*"],
    ["_Capital_", "_", "_"], ["**Capital**", "*`", "`*"],
    ["Capital", "[", "](#nota)"], ["Capital", "[**", "**](#nota)"],
    ["[Capital](#nota)", "", ""], ["[**Capital**](#nota)", "**", "**"],
    ["[`Capital`](#nota)", "", ""], ["[Capital](#nota)", "[", "](#otra)"],
    ["[Capital](./nota_(synthetic))", "[**", "**](./otra_(synthetic))"],
    ["[Capital][capital-ref]", "", ""], ["[Capital][capital-ref]", "[", "][label-ref]"],
    ["[_Capital_][capital-ref]", "[**", "**][label-ref]"],
    ["[Capital][]", "[", "][]"], ["[Capital]", "[", "]"],
    ["[Capital](<./nota_(synthetic)>)", "[", "](<./otra_(synthetic)>)"],
  ];
  const matriz = [];
  for (const [etiqueta, cifra] of [["invertido", "123,45"], ["aportado", "٢٣٤,٥٦"], ["social", "345,67"]]) {
    for (const [capital, abre, cierra] of formatos) {
      for (const continuidad of continuidades) matriz.push(capital + continuidad + abre + etiqueta + cierra + " quedó en " + cifra + ".");
    }
  }
  const rechazos = [...new Set([...rechazosBase, ...matriz])];
  assert.equal(new Set(matriz).size, 414, "matriz completa de 3 etiquetas × 23 formatos × 6 continuidades");
  const referencias = "\n\n[capital-ref]: ./nota_(synthetic)\n[label-ref]: ./otra_(synthetic)\n[Capital]: ./capital_(synthetic)\n[invertido]: ./invertido_(synthetic)\n[aportado]: ./aportado_(synthetic)\n[social]: ./social_(synthetic)\n";
  for (const texto of ["Capi~~tal~~ social quedó en 876,54.", "Ca~~pi~~tal social quedó en 876,54."]) caso("strike intrapalabra export/check: " + texto, function() {
    guardar("a-synthetic.md", "# synthetic\nCambio que no debe escribirse.\n");
    guardar("z-synthetic.md", "# synthetic\n" + texto + referencias);
    fs.writeFileSync(path.join(destino, "obsolete-synthetic.md"), "# synthetic\nDebe conservarse.\n");
    const previo = snapshot();
    const exportacion = ejecutar();
    const comprobacion = ejecutar("--check");
    assert.deepEqual([exportacion.status, comprobacion.status], [1, 1], "ambos modos deben rechazar, incluso tras intentar exportar");
    assert.match(exportacion.stderr, /NO se ha escrito nada/);
    assert.match(comprobacion.stderr, /NO se ha escrito nada/);
    assert.deepEqual(snapshot(), previo, "no escribe, borra ni altera mtime");
    fs.unlinkSync(path.join(origen, "z-synthetic.md"));
  });
  for (const texto of rechazos) caso("rechazo conservador: " + texto, function() {
    guardar("a-synthetic.md", "# synthetic\nCambio que no debe escribirse.\n");
    guardar("z-synthetic.md", "# synthetic\n" + texto + referencias);
    fs.writeFileSync(path.join(destino, "obsolete-synthetic.md"), "# synthetic\nDebe conservarse.\n");
    const previo = snapshot();
    for (const args of [[], ["--check"]]) {
      r = ejecutar(...args);
      assert.equal(r.status, 1, "la cifra financiera no reconocida debe rechazarse");
      assert.match(r.stderr, /NO se ha escrito nada/);
      assert.match(r.stderr, /en z-synthetic\.md sigue/, "rechaza el cuerpo inválido, no una cabecera anterior");
      assert.deepEqual(snapshot(), previo, "no escribe ni borra ante una cifra ambigua");
    }
    fs.unlinkSync(path.join(origen, "z-synthetic.md"));
  });
  caso("contexto de párrafo sin confundir cabecera ni referencias técnicas", function() {
    fs.rmSync(path.join(origen, "z-synthetic.md"), { force: true });
    guardar("saldo-2026.md", "# synthetic\nVersion v4.26.95.1, SHA abcdef0123456789.\n");
    guardar("capital-social-2026.md", "# synthetic\nVersion v4.26.95.1, SHA abcdef0123456789.\n");
    guardar("c-synthetic.md", "# synthetic\nEl presupuesto técnico ocupa\n310 KB, latencia 32 ms, 7 tests y 2 ficheros.\nVersion v4.26.95.1, SHA abcdef0123456789.\n\nCapital\n**social** describe un formato de 310 KB.\n\nFecha de fixture: 2026-10-05.\n");
    r = ejecutar();
    assert.equal(r.status, 0, r.stderr);
    const esperado = "# synthetic\nEl presupuesto técnico ocupa\n310 KB, latencia 32 ms, 7 tests y 2 ficheros.\nVersion v4.26.95.1, SHA abcdef0123456789.\n\nCapital\n**social** describe un formato de 310 KB.\n\nFecha de fixture: 2026-10-05.\n";
    const salida = fs.readFileSync(path.join(destino, "c-synthetic.md"), "utf8");
    assert.equal(salida.slice(salida.indexOf("# synthetic")), esperado, "no tacha bytes, versiones, SHA ni fechas ajenas al contexto financiero");
    const previo = snapshot();
    assert.equal(ejecutar().status, 0);
    assert.deepEqual(snapshot(), previo);
    assert.equal(ejecutar("--check").status, 0);
  });
  caso("matriz Markdown conserva referencias técnicas y payload", function() {
    const nuevosTecnicos = [
      "Capital describe un formato de 310 KB; Version v4.26.95.1, SHA abcdef0123456789.",
      "_Capital_ describe un formato de 310 KB; Version v4.26.95.1, SHA abcdef0123456789.",
      "Capi~~tal~~ social describe un formato de 310 KB; Version v4.26.95.1, SHA abcdef0123456789.",
      "Ca~~pi~~tal social describe un formato de 310 KB; Version v4.26.95.1, SHA abcdef0123456789.",
      '~~Capital~~ ~~social~~ describe un formato de 310 KB; Version v4.26.95.1, SHA abcdef0123456789.',
      '[Capital](#nota "nota (") social describe un formato de 310 KB; Version v4.26.95.1, SHA abcdef0123456789.',
      '[Capital](#nota "nota )") social describe un formato de 310 KB; Version v4.26.95.1, SHA abcdef0123456789.',
    ];
    const tecnicos = "# synthetic\n\n" + matriz.map(function(texto) {
      return texto.slice(0, texto.indexOf(" quedó en ")) + " describe un formato de 310 KB; Version v4.26.95.1, SHA abcdef0123456789.";
    }).concat(nuevosTecnicos).join("\n\n") + referencias;
    guardar("d-synthetic-technical.md", tecnicos);
    r = ejecutar();
    assert.equal(r.status, 0, r.stderr);
    const salida = fs.readFileSync(path.join(destino, "d-synthetic-technical.md"), "utf8");
    assert.equal(salida.slice(salida.indexOf("# synthetic")), tecnicos, "conserva literalmente los 414 párrafos técnicos con su marcado");
    const previo = snapshot();
    assert.equal(ejecutar().status, 0);
    assert.deepEqual(snapshot(), previo);
    assert.equal(ejecutar("--check").status, 0);
  });
  // El aviso editorial anterior no procede de la fuente: la plantilla debe volver a generarlo.
  caso("vigencia Cloud tras regenerar", function() {
    fs.rmSync(path.join(origen, "z-synthetic.md"), { force: true });
    const aviso = "> **Memoria histórica.** Prevalece el protocolo Cloud vigente; consulta BACKLOG, ROADMAP y el brief actual. Los procedimientos locales antiguos no autorizan buzones ni vigías. La fuente editable está en `src/`.";
    guardar("a-synthetic.md", "# synthetic\nProcedimiento histórico: abrir un buzón local y activar el vigía.\n");
    fs.writeFileSync(path.join(destino, "a-synthetic.md"), aviso + "\n\nCabecera editorial anterior.\n");
    r = ejecutar();
    assert.equal(r.status, 0, r.stderr);
    for (const nombre of fs.readdirSync(destino)) {
      assert.ok(fs.readFileSync(path.join(destino, nombre), "utf8").includes(aviso), "aviso visible generado en " + nombre);
    }
    assert.ok(fs.readFileSync(path.join(destino, "a-synthetic.md"), "utf8").endsWith("# synthetic\nProcedimiento histórico: abrir un buzón local y activar el vigía.\n"), "conserva el histórico bajo el aviso");
    const previo = snapshot();
    assert.equal(ejecutar().status, 0);
    assert.deepEqual(snapshot(), previo, "aviso e histórico estables al regenerar");
    assert.equal(ejecutar("--check").status, 0);
  });
  caso("rechazo sin crear destino", function() {
    const sinDestino = path.join(temporal, "synthetic-empty-output");
    fs.mkdirSync(sinDestino);
    for (const texto of rechazos) {
      guardar("z-synthetic.md", "# synthetic\n" + texto + referencias);
      for (const args of [[], ["--check"]]) {
        r = spawnSync(process.execPath, [script, ...args], {
          cwd: sinDestino, encoding: "utf8", env: { ...process.env, AELY_MEMORY_SOURCE: origen },
        });
        assert.equal(r.error, undefined);
        assert.equal(r.status, 1);
        assert.match(r.stderr, /NO se ha escrito nada/);
        assert.match(r.stderr, /en z-synthetic\.md sigue/);
        assert.deepEqual(fs.readdirSync(sinDestino), [], "no crea docs ni archivos al rechazar");
      }
    }
  });
  assert.deepEqual(fallos, [], "regresiones del exportador");
  console.log("✓ sync-memoria: fixtures sintéticos, matriz Markdown de 414 variantes, filtros, referencias técnicas, vigencia Cloud, idempotencia y rechazo sin escrituras/borrados");
} finally {
  const seguro = path.resolve(temporal);
  assert.equal(path.dirname(seguro), path.resolve(os.tmpdir()));
  assert.ok(path.basename(seguro).startsWith("aely-memory-synthetic-"));
  fs.rmSync(seguro, { recursive: true, force: true });
  assert.equal(fs.existsSync(seguro), false);
}
