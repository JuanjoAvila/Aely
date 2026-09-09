#!/usr/bin/env node
/**
 * La documentación no puede quedarse atrás. Este test existe porque pasó de verdad:
 *
 *  · 2026-07-23 (4.7.1): el bump se hizo solo en `package.json` y `VERSION` se quedó en 4.7.0,
 *    así que el popup de Novedades no disparaba y el bundle OTA salía con la versión que el móvil
 *    ya tenía. Nadie se enteró hasta que el usuario preguntó por qué no cambiaba la versión.
 *  · 2026-07-25: el usuario entra a GitHub y lo primero que ve en el README es
 *    «Estado actual: v4.1.0» — íbamos por la 4.8.0. Siete versiones de desfase en el escaparate
 *    del proyecto. AGENTS.md §6 ya obligaba a actualizar la doc; una regla que solo vive en un
 *    .md se salta sin que salte nada. Por eso la regla ahora FALLA EL BUILD.
 *
 * Qué NO comprueba (a propósito): que el texto de la doc sea bueno. Eso no se automatiza. Esto
 * solo cierra el agujero de los NÚMEROS, que es el que se descuadra solo y en silencio.
 *
 * El APK va a su ritmo (OTA web ≠ APK): no se exige que iguale a VERSION, pero sí que `apk.json`
 * y `build.gradle` digan LO MISMO — apuntar a un release que no existe es el fallo caro.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// Se quita el BOM: en Windows, `Set-Content -Encoding utf8` (PowerShell 5.1) lo mete SIEMPRE, y
// un BOM al principio de package.json revienta JSON.parse con un error que no dice nada útil
// («Unexpected token '﻿'»). Pasó al bumpear la 4.9.0 desde la consola. El fichero se arregla
// aparte, pero el test no debe volverse ilegible por un byte invisible.
const read = (p) => fs.readFileSync(path.join(root, p), "utf8").replace(/^﻿/, "");

let failed = 0;
const ok = (name) => console.log(`  ✓ ${name}`);
const bad = (name, detail) => { failed++; console.log(`  ✗ ${name}`); if (detail) console.log("      " + detail); };
// Compara y explica el arreglo: un test que solo dice «no coinciden» obliga a ir a buscar dónde.
const eq = (name, got, want, fix) => {
  if (got === want) ok(name);
  else bad(name, `dice «${got}» y VERSION es «${want}» → ${fix}`);
};

console.log("docs-frescura");

const VERSION = read("VERSION").trim();
if (!/^\d+\.\d+\.\d+$/.test(VERSION)) {
  bad("VERSION tiene formato X.Y.Z", `leído: «${VERSION}»`);
  process.exit(1);
}
ok(`VERSION = ${VERSION}`);

/* ---- 1. Los ficheros de versión del paquete ---- */
{
  const pkg = JSON.parse(read("package.json"));
  eq("package.json .version", pkg.version, VERSION, "npm version / editar a mano");

  const lock = JSON.parse(read("package-lock.json"));
  eq("package-lock.json .version", lock.version, VERSION, "editar `version` (x2: raíz y packages[''])");
  eq('package-lock.json packages[""].version', lock.packages?.[""]?.version, VERSION, 'editar packages[""].version');
}

/* ---- 2. CHANGELOG: la versión que corre tiene que estar escrita, y la primera ---- */
{
  const ch = read("CHANGELOG.md");
  const first = ch.match(/^## \[(\d+\.\d+\.\d+)\]/m);
  if (!first) bad("CHANGELOG.md tiene entradas `## [X.Y.Z]`");
  else eq("CHANGELOG.md primera entrada", first[1], VERSION, "añade la entrada de esta versión ARRIBA del todo");
}

/* ---- 3. RELEASE_NOTES: el popup de Novedades del usuario (regla explícita, 3.95.1) ----
   Se olvidó en la 3.95.1 y el usuario lo pidió expresamente: TODA versión publicada —incluidas
   las .1 de arreglo— lleva su entrada. Si no está, el popup enseña las notas de otra versión.
   NOTAS-BUNDLE (2026-09-09): viven en src/data/release-notes.json, no en el módulo. */
{
  const p = path.join(root, "src/data/release-notes.json");
  if (!fs.existsSync(p)) bad("src/data/release-notes.json existe", "falta el histórico de Novedades");
  else {
    let first = null;
    try {
      const arr = JSON.parse(fs.readFileSync(p, "utf8"));
      first = arr && arr[0] && arr[0].v;
    } catch (e) { bad("release-notes.json parseable", e.message); }
    if (first) eq("RELEASE_NOTES primera nota", first, VERSION, "añade la nota de esta versión al PRINCIPIO de src/data/release-notes.json (es/en/ca)");
    else bad("RELEASE_NOTES primera nota", "JSON vacío o sin v");
  }
}

/* ---- 4. El escaparate: README y ROADMAP ----
   El README es lo primero que se ve al abrir el repo. Que ponga una versión de hace siete
   releases es el motivo por el que existe este fichero. */
{
  const readme = read("README.md");
  const m = readme.match(/Estado actual:\s*\*\*v(\d+\.\d+\.\d+)\*\*/);
  if (!m) bad("README.md tiene «Estado actual: **vX.Y.Z**»", "no se encontró la línea en la sección Roadmap");
  else eq("README.md «Estado actual»", m[1], VERSION, "actualiza la línea de Roadmap del README");

  const road = read("docs/ROADMAP.md");
  const cab = road.match(/^>\s*Estado a\s*\S+\s*·\s*\*\*v(\d+\.\d+\.\d+)\*\*/m);
  if (!cab) bad("docs/ROADMAP.md tiene cabecera «> Estado a FECHA · **vX.Y.Z**»");
  else eq("docs/ROADMAP.md cabecera", cab[1], VERSION, "actualiza el estado (y baja el anterior a la línea «Anterior:»)");

  const tabla = road.match(/\|\s*Web \/ OTA \(`VERSION`\)\s*\|\s*\*\*(\d+\.\d+\.\d+)\*\*/);
  if (!tabla) bad("docs/ROADMAP.md tiene la tabla «Versión actual (alineación)»");
  else eq("docs/ROADMAP.md tabla Web/OTA", tabla[1], VERSION, "actualiza la fila de la tabla de alineación");
}

/* ---- 5. APK: puede ir por detrás de la web (OTA), pero NUNCA descuadrado consigo mismo ----
   `apk.json` es lo que el móvil consulta para ofrecer «hay APK nueva». Si apunta a un release o a
   un versionCode que no es el que se compiló, el móvil se descarga otra cosa o no se descarga nada. */
{
  const apk = JSON.parse(read("public/apk.json"));
  const gradle = read("android/app/build.gradle");
  const gCode = Number((gradle.match(/versionCode\s+(\d+)/) || [])[1]);
  const gName = (gradle.match(/versionName\s+"([^"]+)"/) || [])[1];

  if (!gCode || !gName) bad("build.gradle expone versionCode/versionName");
  else {
    if (apk.versionCode === gCode) ok("apk.json versionCode = build.gradle");
    else bad("apk.json versionCode = build.gradle", `apk.json ${apk.versionCode} vs gradle ${gCode}`);

    if (apk.versionName === gName) ok("apk.json versionName = build.gradle");
    else bad("apk.json versionName = build.gradle", `apk.json «${apk.versionName}» vs gradle «${gName}»`);

    // La URL del asset tiene que nombrar la versión que dice servir: el fallo real fue apuntar a
    // un release inexistente y que el botón de actualizar se muriera en un 404.
    if (String(apk.url || "").includes(gName)) ok("apk.json url nombra esa versión");
    else bad("apk.json url nombra esa versión", `url «${apk.url}» no contiene «${gName}»`);
  }
}

/* ---- 5 bis. Texto corrompido (mojibake) ----
   Incidente 2026-07-25: reescribir un fichero con `(Get-Content -Raw) | Set-Content -Encoding utf8`
   en PowerShell 5.1 lo LEE como Windows-1252 y lo reescribe como UTF-8 → cada acento y cada «✓» se
   convierten en «Ã©», «âœ“»… 95 líneas de `06-sync-brokers.js` y la descripción de `package.json`
   salieron así, y el usuario lo vio en su móvil: «✓» pintado como `âœ"` en la tarjeta de Trade
   Republic. Es invisible en un diff si no lo buscas, y el resto de tests pasan tan contentos.
   Regla práctica: en este repo los ficheros se editan con herramientas UTF-8, nunca con un
   round-trip de PowerShell. Esto lo caza si alguien lo intenta igual. */
{
  const sospechosos = /Ã[©³¡­º±‰]|â€"|â€œ|âœ|Â«|Â»/;
  const mirar = ["package.json", "README.md", "AGENTS.md", "CHANGELOG.md", "docs/ROADMAP.md", "docs/TESTING.md"];
  for (const f of fs.readdirSync(path.join(root, "src/modules"))) mirar.push("src/modules/" + f);
  const sucios = mirar.filter((f) => {
    try { return sospechosos.test(read(f)); } catch { return false; }
  });
  if (sucios.length) bad("sin texto corrompido (mojibake)", sucios.join(", ") + " — ¿editado con PowerShell?");
  else ok("sin texto corrompido (mojibake)");
}

/* ---- 6. ¿Código nuevo SIN subir la versión? ----
   Fallo real 2026-07-25: se arreglaron TR, el oro, el gesto del perfil y los bancos, todo
   commiteado y desplegado en Pages... con `VERSION` intacta. El OTA compara NÚMEROS de versión,
   así que el móvil veía «4.8.0 = 4.8.0 → nada nuevo» y el usuario se pasó la mañana esperando
   una actualización que nunca podía llegar. No fue un bug: fue saltarse la checklist de §6.
   AGENTS §6 ya decía «solo se pushea trabajo TERMINADO»; esto lo hace cumplir.
   Si no hay historia de git (checkout superficial del CI, tarball), se salta en vez de fallar:
   un test que no puede comprobar algo no debe inventarse un veredicto. */
{
  const git = (args) => {
    const r = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    return r.status === 0 ? r.stdout.trim() : null;
  };
  /* Preferir la rama REALMENTE chequeada sobre `GITHUB_REF_NAME`. El promote corre el workflow
     desde `main` (`workflow_dispatch`) pero hace `checkout -B beta` para testear el árbol que
     se va a subir: si manda el env, cree que estamos en main, exige bump de VERSION y BLOQUEA
     la promoción de toda una ronda beta (4.13.0) que a propósito no bumpea en cada arreglo.
     `git branch --show-current` y no `rev-parse --abbrev-ref HEAD`: existe también un tag/release
     `beta` y el nombre es ambiguo. */
  const rama = (git(["branch", "--show-current"]) || process.env.GITHUB_REF_NAME || git(["rev-parse", "--abbrev-ref", "HEAD"]) || "")
    .replace(/^heads\//, "");
  const lastBump = rama === "beta" ? null : git(["log", "-1", "--format=%H", "--", "VERSION"]);
  /* EL PROMOTE DE UNA RONDA BETA NO ES CÓDIGO SIN VERSIONAR (falso positivo, 2026-08-06).
     Una ronda beta bumpea VERSION UNA vez y después sigue arreglando cosas DENTRO de la misma
     ronda: los 5 fixes de glow22 entraron tras el bump a 4.15.0 y se publicaron como 4.15.0. Al
     promocionar, `git log -1 -- VERSION` (con simplificación de historia) encuentra el bump al
     principio de la ronda y esta comprobación cantaba «5 ficheros cambiados después del último
     bump» sobre commits YA publicados. Se repetía en CADA promote, y un test que falla siempre por
     lo mismo es un test que se acaba ignorando — justo el que tiene que gritar el día que de
     verdad se suba código sin versión.
     La pregunta correcta en un merge no es «¿el bump es lo último?» sino «¿esta fusión sube la
     versión respecto a lo que ya había?». Si la sube, toda la ronda viaja con número nuevo. Si no
     la sube, sigue siendo el fallo de siempre y se canta igual. */
  const padres = (git(["rev-list", "--parents", "-n", "1", "HEAD"]) || "").split(/\s+/).filter(Boolean);
  const verDe = (ref) => git(["show", `${ref}:VERSION`]);
  const versionSubeEnElMerge = padres.length > 2 && verDe("HEAD") && verDe("HEAD") !== verDe("HEAD^1");
  if (rama === "beta") {
    console.log("  ⊘ rama beta: cada push publica VERSION.RUN_NUMBER, no hace falta bump");
  } else if (versionSubeEnElMerge) {
    console.log(`  ⊘ promote de una ronda beta: VERSION sube en la fusión (${verDe("HEAD^1")} → ${verDe("HEAD")})`);
  } else if (!lastBump) {
    console.log("  ⊘ sin historia de git: no se comprueba el bump");
  } else {
    // Lo que el usuario NOTA y viaja por OTA. La doc, los tests y el tooling no cuentan: cambiar
    // un comentario o añadir un test no obliga a publicar una versión.
    const zonas = ["src/", "supabase/functions/", "android/app/src/", "public/vendor/", "public/sw.js"];
    const sueltos = git(["log", `${lastBump}..HEAD`, "--name-only", "--format=", "--"].concat(zonas));
    if (sueltos) {
      const ficheros = [...new Set(sueltos.split("\n").filter(Boolean))];
      bad("no hay código publicable sin subir VERSION",
        `${ficheros.length} fichero(s) cambiados después del último bump (${lastBump.slice(0, 7)}): ` +
        ficheros.slice(0, 4).join(", ") + (ficheros.length > 4 ? "…" : "") +
        "\n      → sube VERSION y añade RELEASE_NOTES + CHANGELOG (AGENTS §6), o el móvil NO se enterará");
    } else {
      ok("no queda código publicable sin subir de versión");
    }
  }
}

console.log(failed ? `\n${failed} comprobación(es) de frescura de doc FALLARON` : "\ndocumentación al día");
process.exit(failed ? 1 : 0);
