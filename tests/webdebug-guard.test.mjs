#!/usr/bin/env node
/**
 * El guardián WEBDEBUG tiene que seguir en el repo: si alguien lo borra del build.gradle
 * o del package.json, volvemos al incidente del 2026-08-06 (APK real con socket abierto).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

const gradle = read("android/app/build.gradle");
assert.match(gradle, /taskGraph\.whenReady/, "build.gradle debe tener guardián taskGraph.whenReady");
assert.match(gradle, /MICARTERA_WEBDEBUG/, "build.gradle menciona MICARTERA_WEBDEBUG");
assert.match(gradle, /assembleRelease/, "guardián debe mirar assembleRelease");
assert.match(gradle, /ALLOW_WEBDEBUG_RELEASE/, "bypass explícito documentado en gradle");

const mainActivity = read("android/app/src/main/java/com/micartera/app/MainActivity.java");
assert.match(mainActivity, /getBridge\(\)\.getWebView\(\)/,
  "la barra nativa se desactiva sobre la WebView real de Capacitor");
assert.match(mainActivity, /setVerticalScrollBarEnabled\(false\)/,
  "la WebView no debe dibujar el indicador vertical de Android");
assert.match(mainActivity, /setHorizontalScrollBarEnabled\(false\)/,
  "la WebView no debe dibujar el indicador horizontal de Android");

const pkg = JSON.parse(read("package.json"));
assert.match(pkg.scripts["apk:prep"] || "", /guard-webdebug/, "apk:prep debe llamar a guard-webdebug");
assert.equal(pkg.scripts["release:apk"], "node scripts/release-apk.mjs", "falta script release:apk");

assert.ok(fs.existsSync(path.join(root, "scripts", "guard-webdebug.mjs")));
assert.ok(fs.existsSync(path.join(root, "scripts", "release-apk.mjs")));
assert.ok(fs.existsSync(path.join(root, "docs", "RELEASE.md")));

const releaseDoc = read("docs/RELEASE.md");
assert.match(releaseDoc, /release:apk/);
assert.match(releaseDoc, /WEBDEBUG/);

console.log("webdebug-guard: OK");
