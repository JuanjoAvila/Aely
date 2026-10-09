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
  // Un promote cubre sus ancestros con el número nuevo, también cuando HEAD ya es otro commit.
  // La cadena de primeros padres evita tomar un bump lateral como si hubiese versionado main.
  // No se confía en nombres de merges, SHA concretos ni en el delta de una PR (5/10/2026).
  const semver = (value) => /^\d+\.\d+\.\d+$/.test(value || "") ? value.split(".").map(BigInt) : null;
  const greater = (left, right) => {
    const a = semver(left), b = semver(right);
    if (!a || !b) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i];
    return false;
  };
  const limitation = (detail) => console.log(`  ⊘ historia de git ${detail}: no se comprueba el bump`);
  // En historia completa, un dato antiguo ilegible o una auditoría fallida no acredita
  // frescura. Se bloquea sin inventar si hay código sin versionar (revisión 5/10/2026).
  const indeterminate = (detail) => bad("auditoría histórica de VERSION indeterminada",
    detail + " → revisa la historia antes de acreditar el versionado");
  if (rama === "beta") {
    console.log("  ⊘ rama beta: cada push publica VERSION.RUN_NUMBER, no hace falta bump");
  } else if (git(["rev-parse", "--is-shallow-repository"]) !== "false") {
    // Una frontera superficial puede esconder padres y deuda lateral: no autoriza un verde.
    limitation("ausente o superficial");
  } else {
    const candidates = git(["log", "--first-parent", "--full-history", "--format=%H", "HEAD", "--", "VERSION"]);
    let anchor = null, anchorVersion = null, incomplete = candidates === null;
    const refs = (candidates || "").split("\n").filter(Boolean);
    const versions = refs.map(ref => git(["show", `${ref}:VERSION`]));
    const invalid = versions.findIndex(value => !semver(value));
    if (invalid >= 0) incomplete = true;
    for (const [index, ref] of refs.entries()) {
      if (incomplete) break;
      const value = versions[index];
      // Bajar y volver a poner el mismo número no es una publicación nueva: el móvil ya
      // lo ha visto. El ancla debe superar también los números de sus ancestros en main.
      if (versions.slice(index + 1).some(older => !greater(value, older))) continue;
      const parents = git(["rev-list", "--parents", "-n", "1", ref]);
      if (parents === null || !semver(value)) { incomplete = true; break; }
      const firstParent = parents.split(/\s+/)[1];
      // La creación inicial de VERSION sirve de límite del repo completo, no de subida.
      if (!firstParent) { anchor = ref; anchorVersion = value; break; }
      const previous = git(["show", `${firstParent}:VERSION`]);
      if (previous === null || !semver(previous)) { incomplete = true; break; }
      if (greater(value, previous)) { anchor = ref; anchorVersion = value; break; }
    }
    if (incomplete || !anchor || git(["merge-base", "--is-ancestor", anchor, "HEAD"]) === null) {
      indeterminate(invalid >= 0 ? `VERSION histórica ilegible o no numérica en ${refs[invalid].slice(0, 7)}`
        : "sin ancla y ascendencia verificables");
    } else {
      // Un refresh documental puede traer MAIN versionado como segundo padre antes de la
      // fusión de la PR. Compararlo sólo con el padre viejo contaría producto ya cubierto.
      // Los commits no merge se auditan todos, incluidos reverts y deuda lateral; cada
      // resolución se compara con un padre descendiente del ancla, si existe, o el primero.
      const zonas = ["src/", "supabase/functions/", "android/app/src/", "public/vendor/", "public/sw.js"];
      const rango = `${anchor}..HEAD`;
      const simples = git(["log", "--full-history", "--no-merges", rango, "--name-only", "--format=", "--"].concat(zonas));
      const fusiones = git(["log", "--full-history", "--min-parents=2", "--format=%H %P", rango]);
      const posteriores = git(["rev-list", "--ancestry-path", rango]);
      let sueltos = simples;
      if (fusiones === null || posteriores === null) sueltos = null;
      else if (sueltos !== null) {
        const descendientes = new Set([anchor].concat(posteriores.split("\n").filter(Boolean)));
        for (const fila of fusiones.split("\n").filter(Boolean)) {
          const [ref, ...padres] = fila.split(/\s+/);
          if (padres.length < 2 || [ref, ...padres].some(valor => !/^[a-f0-9]{40}$/.test(valor))) {
            sueltos = null; break;
          }
          const padre = padres.find(valor => descendientes.has(valor)) || padres[0];
          const cambios = git(["diff-tree", "--no-commit-id", "--name-only", "-r", padre, ref, "--"].concat(zonas));
          if (cambios === null) { sueltos = null; break; }
          if (cambios) sueltos += "\n" + cambios;
        }
      }
      if (sueltos === null) {
        indeterminate("no se pudieron auditar los commits posteriores al ancla");
      } else if (sueltos || greater(anchorVersion, VERSION)) {
        const ficheros = [...new Set((sueltos || "").split("\n").filter(Boolean))];
        bad("no hay código publicable sin subir VERSION",
          `${ficheros.length} fichero(s) cambiados después del ancla versionada (${anchor.slice(0, 7)}): ` +
          ficheros.slice(0, 4).join(", ") + (ficheros.length > 4 ? "…" : "") +
          (greater(anchorVersion, VERSION) ? `; VERSION baja de ${anchorVersion} a ${VERSION}` : "") +
          "\n      → sube VERSION y añade RELEASE_NOTES + CHANGELOG (AGENTS §6), o el móvil NO se enterará");
      } else {
        ok("no queda código publicable sin subir de versión");
      }
    }
  }
}

console.log(failed ? `\n${failed} comprobación(es) de frescura de doc FALLARON` : "\ndocumentación al día");
process.exit(failed ? 1 : 0);
