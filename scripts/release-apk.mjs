#!/usr/bin/env node
/**
 * `npm run release:apk` — un solo camino para sacar la APK de producción.
 *
 * Nació el 2026-08-06 tras un promote que fue un calvario: WEBDEBUG colado, apk.json a
 * releases fantasma, firmas/versiones a mano, Actions caído… Este script hace el circuito
 * completo o ABORTA con el porqué, sin dejar a medias el manifiesto.
 *
 * Uso:
 *   npm run release:apk
 *   npm run release:apk -- --dry-run          # prepara y verifica, no sube ni escribe apk.json
 *   npm run release:apk -- --skip-upload      # compila+verifica, escribe apk.json sin gh
 *   npm run release:apk -- --notes "texto"    # notas del manifiesto (castellano, familia)
 *
 * Requisitos: JAVA_HOME (o JBR de Android Studio), keystore en local.properties, `gh` auth.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const skipUpload = args.includes("--skip-upload") || dryRun;
const notesArg = (() => {
  const i = args.indexOf("--notes");
  return i >= 0 ? String(args[i + 1] || "").trim() : "";
})();

const die = (msg) => { console.error("✕ " + msg); process.exit(1); };
const ok = (msg) => console.log("✓ " + msg);
const step = (msg) => console.log("\n── " + msg + " ──");

function run(cmd, cmdArgs, opts = {}) {
  const r = spawnSync(cmd, cmdArgs, {
    cwd: opts.cwd || root,
    env: opts.env || process.env,
    encoding: "utf8",
    shell: opts.shell === true,
    stdio: opts.stdio || "inherit",
  });
  if (r.status !== 0) die(opts.fail || (`falló: ${cmd} ${cmdArgs.join(" ")} (exit ${r.status})`));
  return r;
}

function runCapture(cmd, cmdArgs, opts = {}) {
  const r = spawnSync(cmd, cmdArgs, {
    cwd: opts.cwd || root,
    env: opts.env || process.env,
    encoding: "utf8",
    shell: opts.shell === true,
  });
  if (r.status !== 0) {
    die((opts.fail || `falló: ${cmd}`) + "\n" + (r.stderr || r.stdout || ""));
  }
  return (r.stdout || "") + (r.stderr || "");
}

function readProps(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    let v = t.slice(i + 1).trim();
    // local.properties escapa : y =
    v = v.replace(/\\:/g, ":").replace(/\\=/g, "=").replace(/\\\\/g, "\\");
    out[t.slice(0, i).trim()] = v;
  }
  return out;
}

function findJavaHome(props) {
  if (process.env.JAVA_HOME && fs.existsSync(path.join(process.env.JAVA_HOME, "bin", process.platform === "win32" ? "java.exe" : "java"))) {
    return process.env.JAVA_HOME;
  }
  const candidates = [
    "C:\\Program Files\\Android\\Android Studio\\jbr",
    "/c/Program Files/Android/Android Studio/jbr",
    "/Applications/Android Studio.app/Contents/jbr/Contents/Home",
  ];
  for (const c of candidates) {
    const java = path.join(c, "bin", process.platform === "win32" ? "java.exe" : "java");
    if (fs.existsSync(java)) return c;
  }
  die("JAVA_HOME no está puesto y no encuentro el JBR de Android Studio.\n" +
    "  → export JAVA_HOME=\"/c/Program Files/Android/Android Studio/jbr\"");
}

function findTool(sdk, names) {
  const bt = path.join(sdk, "build-tools");
  if (!fs.existsSync(bt)) return null;
  const vers = fs.readdirSync(bt).sort().reverse();
  for (const v of vers) {
    for (const name of names) {
      const p = path.join(bt, v, name);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

// ── 1. Versión y props ──
step("Versión y local.properties");
const VERSION = fs.readFileSync(path.join(root, "VERSION"), "utf8").trim();
if (!/^\d+\.\d+\.\d+$/.test(VERSION)) die(`VERSION inválida: «${VERSION}»`);

const props = readProps(path.join(root, "android", "local.properties"));
if (props.MICARTERA_WEBDEBUG === "1") {
  die("MICARTERA_WEBDEBUG=1 — release:apk se niega a publicar una APK de depuración.\n" +
    "  Pon WEBDEBUG=0 (o borra la clave). Para CDP usa ALLOW_WEBDEBUG_RELEASE=1 + assembleRelease a mano, sin este script.");
}
if (!props.MICARTERA_KS_FILE) die("Falta MICARTERA_KS_FILE en android/local.properties (keystore fuera del repo).");
if (!fs.existsSync(props.MICARTERA_KS_FILE)) die(`Keystore no existe: ${props.MICARTERA_KS_FILE}`);

const sdkDir = props["sdk.dir"];
if (!sdkDir || !fs.existsSync(sdkDir)) die("sdk.dir ausente o inválido en android/local.properties");

const gradle = fs.readFileSync(path.join(root, "android", "app", "build.gradle"), "utf8");
const gName = (gradle.match(/versionName\s+"([^"]+)"/) || [])[1];
const gCode = Number((gradle.match(/versionCode\s+(\d+)/) || [])[1]);
if (gName !== VERSION) {
  die(`build.gradle versionName «${gName}» ≠ VERSION «${VERSION}».\n` +
    "  Alinea versionName = VERSION y sube versionCode +1 antes de release:apk.");
}
if (!gCode) die("No leo versionCode en build.gradle");
ok(`VERSION ${VERSION} · versionCode ${gCode}`);

// Guardián node (además del de Gradle)
run(process.execPath, [path.join(root, "scripts", "guard-webdebug.mjs")], {
  fail: "WEBDEBUG activo — abortado",
});

const javaHome = findJavaHome(props);
const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  PATH: path.join(javaHome, "bin") + path.delimiter + (process.env.PATH || ""),
};
// Git Bash en Windows mangla rutas adb; el checklist lo avisa
ok(`JAVA_HOME=${javaHome}`);

// ── 2. Prep + assemble ──
step("apk:prep (build + www sellado + cap sync)");
run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "apk:prep"], {
  env,
  shell: true,
  fail: "apk:prep falló — no copies public/ a www/ a mano; arregla el prep",
});

step("assembleRelease");
/* RUTA ABSOLUTA A PROPÓSITO (2026-08-17). Con `shell:true` en Windows esto lo lanza `cmd.exe`, y
   Git Bash deja puesta `NoDefaultCurrentDirectoryInExePath=1` en el entorno — con esa variable,
   cmd NO busca el ejecutable en el directorio actual, así que un `gradlew.bat` a secas peta con
   «no se reconoce como un comando interno o externo» aunque el fichero esté ahí y el `cwd` sea
   correcto. Pasaba tanto desde Git Bash como desde PowerShell (heredan la variable). Se cita la
   ruta porque «Mi cartera» lleva espacio. */
const androidDir = path.join(root, "android");
const gradlew = process.platform === "win32"
  ? `"${path.join(androidDir, "gradlew.bat")}"`
  : "./gradlew";
run(gradlew, ["assembleRelease", "--no-daemon"], {
  cwd: androidDir,
  env,
  shell: true,
  fail: "assembleRelease falló (¿guardián WEBDEBUG? ¿keystore?)",
});

const apkSrc = path.join(root, "android", "app", "build", "outputs", "apk", "release", "app-release.apk");
if (!fs.existsSync(apkSrc)) die(`No está la APK: ${apkSrc}`);

// ── 3. Verificaciones ──
step("Verificar BuildConfig + badging + firma");
const bc = path.join(root, "android", "app", "build", "generated", "source", "buildConfig", "release", "com", "micartera", "app", "BuildConfig.java");
if (fs.existsSync(bc)) {
  const bcText = fs.readFileSync(bc, "utf8");
  if (!/WEB_DEBUG\s*=\s*false/.test(bcText)) die("BuildConfig.WEB_DEBUG no es false — no se publica");
  if (!new RegExp(`VERSION_NAME\\s*=\\s*"${VERSION.replace(/\./g, "\\.")}"`).test(bcText)) {
    die(`BuildConfig.VERSION_NAME no es ${VERSION}`);
  }
  if (!new RegExp(`VERSION_CODE\\s*=\\s*${gCode}\\b`).test(bcText)) {
    die(`BuildConfig.VERSION_CODE no es ${gCode}`);
  }
  ok("BuildConfig: WEB_DEBUG=false, versión cuadrada");
} else {
  console.warn("· BuildConfig.java no encontrado (ruta generada distinta); sigo con aapt");
}

const aapt = findTool(sdkDir, ["aapt.exe", "aapt"]);
if (!aapt) die("No encuentro aapt en build-tools del SDK");
const badging = runCapture(aapt, ["dump", "badging", apkSrc], { fail: "aapt dump badging falló" });
const pkg = badging.match(/package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'/);
if (!pkg) die("aapt no devolvió package/version");
if (pkg[1] !== "com.micartera.app") die(`applicationId «${pkg[1]}» — ¿es la debug (.debug)? NO publicar`);
if (Number(pkg[2]) !== gCode) die(`aapt versionCode ${pkg[2]} ≠ ${gCode}`);
if (pkg[3] !== VERSION) die(`aapt versionName «${pkg[3]}» ≠ ${VERSION}`);
ok(`aapt: ${pkg[1]} ${pkg[3]} (${pkg[2]})`);

const apksigner = findTool(sdkDir, ["apksigner.bat", "apksigner"]);
if (apksigner) {
  /* `apksigner` es un .bat en Windows, así que Node lo lanza por `cmd` sí o sí — y por el camino
     se pierden las comillas: la ruta «E:\Mi cartera\…» llegaba partida por el espacio y apksigner
     respondía «Unexpected parameter(s) after APK» sobre una APK perfectamente firmada
     (2026-08-17). Se citan tool y ruta a mano. `aapt` es .exe y no le pasa. */
  const esBat = /\.bat$/i.test(apksigner);
  const certs = runCapture(esBat ? `"${apksigner}"` : apksigner,
    ["verify", "--print-certs", esBat ? `"${apkSrc}"` : apkSrc], {
    env,
    shell: process.platform === "win32",
    fail: "apksigner verify falló — APK sin firmar o firma rara",
  });
  if (!/CN=Mi Cartera/i.test(certs)) {
    die("La firma no dice CN=Mi Cartera.\n" + certs.slice(0, 400));
  }
  ok("Firma CN=Mi Cartera");
} else {
  console.warn("· apksigner no encontrado — salta verificación de CN (instala build-tools)");
}

const apkName = `Aely-${VERSION}.apk`;
const apkOut = path.join(root, "android", "app", "build", "outputs", "apk", "release", apkName);
fs.copyFileSync(apkSrc, apkOut);
ok(`APK lista: ${apkOut}`);

const tag = `v${VERSION}`;
const url = `https://github.com/JuanjoAvila/Aely/releases/download/${tag}/${apkName}`;
const notes = notesArg ||
  `APK ${VERSION} (${gCode}): se instala encima sin desinstalar ni perder datos.`;

const apkJson = {
  versionCode: gCode,
  versionName: VERSION,
  url,
  notes,
};

if (dryRun) {
  step("dry-run: no subo ni escribo apk.json");
  console.log(JSON.stringify(apkJson, null, 2));
} else {
  if (!skipUpload) {
    step(`GitHub Release ${tag}`);
    const ghCheck = spawnSync("gh", ["auth", "status"], { encoding: "utf8" });
    if (ghCheck.status !== 0) die("gh no autenticado. `gh auth login` y reintenta.");

    const view = spawnSync("gh", ["release", "view", tag], { cwd: root, encoding: "utf8" });
    if (view.status !== 0) {
      run("gh", [
        "release", "create", tag,
        "--target", "main",
        "--title", tag,
        "--notes", `APK de producción **${VERSION}** (versionCode ${gCode}).\n\nGenerada con \`npm run release:apk\`.`,
        apkOut,
      ], { fail: "gh release create falló (¿Actions/API caído? ¿tag en uso?)" });
      ok(`Release ${tag} creada con ${apkName}`);
    } else {
      run("gh", ["release", "upload", tag, apkOut, "--clobber"], {
        fail: "gh release upload --clobber falló",
      });
      ok(`Asset ${apkName} subido a ${tag} (--clobber)`);
    }

    // Confirmar que el asset responde
    const head = spawnSync("gh", ["release", "view", tag, "--json", "assets"], { cwd: root, encoding: "utf8" });
    if (head.status === 0) {
      const assets = JSON.parse(head.stdout || "{}").assets || [];
      const hit = assets.find((a) => a.name === apkName);
      if (!hit) die(`Tras subir, ${apkName} no aparece en la release ${tag}`);
      ok(`Asset en release (${hit.size || "?"} bytes)`);
    }
  } else {
    console.log("· --skip-upload: no toco GitHub Releases");
  }

  step("public/apk.json → asset real");
  fs.writeFileSync(path.join(root, "public", "apk.json"), JSON.stringify(apkJson, null, 2) + "\n", "utf8");
  ok("apk.json escrito (commitea y deja que Pages lo publique)");
}

// ── 4. Checklist adb ──
step("Instalar en el móvil (cuando diga él)");
const adb = path.join(sdkDir, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb");
console.log(`
  ADB: ${adb}
  APK: ${apkOut}

  # En Git Bash: export MSYS_NO_PATHCONV=1
  "${adb}" get-state
  "${adb}" push "${apkOut}" /data/local/tmp/mc.apk
  "${adb}" shell pm install -r /data/local/tmp/mc.apk
  "${adb}" shell dumpsys package com.micartera.app | findstr /i version

  NUNCA instales app-debug.apk sobre la real (es com.micartera.app.debug, app aparte).
  Tras Pages: version.json y apk.json live deben decir ${VERSION} / ${gCode}.
`);

ok(dryRun ? "dry-run OK" : `release:apk OK → ${tag} · code ${gCode}`);
