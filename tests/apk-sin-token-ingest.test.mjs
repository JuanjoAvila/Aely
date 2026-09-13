#!/usr/bin/env node
/**
 * LA APK PÚBLICA NO LLEVA EL TOKEN DE INGEST DEL DUEÑO (14/9/2026, OPS-06).
 *
 * `INGEST_URL` (con `?token=`) se metía en `defaultConfig`, o sea también en release, y
 * `release:apk` publica esa APK en un repo público. Cualquiera podía extraerla y apuntar gastos en
 * su cuenta; y un móvil de la familia sin token propio le mandaba SUS gastos de TR a él por el
 * fallback de `TrExpenseListener`. Se vigila la forma de los tres sitios que lo impiden.
 */
import assert from "node:assert/strict";
import fs from "node:fs";

let fallos = 0;
const t = (n, fn) => { try { fn(); console.log("  ✓ " + n); } catch (e) { fallos++; console.error("  ✗ " + n + "\n      " + (e && e.message)); } };
const rd = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
console.log("apk-sin-token-ingest");

const gradle = rd("android/app/build.gradle");
t("defaultConfig (y por tanto release) lleva INGEST_URL vacía", () => {
  const dc = gradle.slice(gradle.indexOf("defaultConfig {"), gradle.indexOf("signingConfigs {"));
  assert.ok(/buildConfigField "String", "INGEST_URL", "\\"\\""/.test(dc), "defaultConfig tiene que dejarla vacía");
  assert.equal(/INGEST_URL", "\\"\$\{ingestUrl\}\\""/.test(dc), false, "la URL real NO puede ir en defaultConfig");
});

t("solo el tipo debug pone la URL real, y release no la toca", () => {
  const bt = gradle.slice(gradle.indexOf("buildTypes {"));
  const rel = bt.slice(bt.indexOf("release {"), bt.indexOf("debug {"));
  const dbg = bt.slice(bt.indexOf("debug {"));
  assert.equal(/INGEST_URL/.test(rel), false, "release no puede definir INGEST_URL");
  assert.ok(/INGEST_URL", "\\"\$\{ingestUrl\}\\""/.test(dbg), "debug sí la lleva (APK de pruebas, nunca publicada)");
});

t("TrExpenseListener solo cae a BuildConfig.INGEST_URL en la APK de depuración", () => {
  const j = rd("android/app/src/main/java/com/micartera/app/TrExpenseListener.java");
  assert.ok(/&& BuildConfig\.DEBUG\) ingestUrl = BuildConfig\.INGEST_URL/.test(j));
  assert.equal(/isEmpty\(\)\) ingestUrl = BuildConfig\.INGEST_URL;/.test(j), false, "el fallback sin DEBUG ha vuelto");
});

t("release:apk se niega a publicar si BuildConfig.INGEST_URL no está vacía", () => {
  const s = rd("scripts/release-apk.mjs");
  assert.ok(/INGEST_URL\\s\*=\\s\*""/.test(s) && /No se publica/.test(s));
});

/* Y la copia de Android no se lleva la cartera ni las sesiones (APK 46). En Android 12+
   `allowBackup="false"` NO apaga el traspaso de móvil a móvil: hacen falta las reglas. */
t("sin copia de Android: allowBackup false + reglas que excluyen todo (nube y traspaso)", () => {
  const m = rd("android/app/src/main/AndroidManifest.xml");
  assert.ok(/android:allowBackup="false"/.test(m), "allowBackup tiene que ser false");
  assert.ok(/android:dataExtractionRules="@xml\/data_extraction_rules"/.test(m), "faltan las reglas de Android 12+");
  const x = rd("android/app/src/main/res/xml/data_extraction_rules.xml");
  for (const bloque of ["cloud-backup", "device-transfer"]) {
    const b = x.slice(x.indexOf("<" + bloque + ">"), x.indexOf("</" + bloque + ">"));
    assert.ok(b.length > 0, "falta <" + bloque + ">");
    for (const d of ["root", "file", "database", "sharedpref"]) {
      assert.ok(new RegExp(`<exclude domain="${d}" path="\\."`).test(b), `${bloque} no excluye ${d}`);
    }
  }
});

if (fallos) { console.error(`apk-sin-token-ingest: ${fallos} fallo(s)`); process.exit(1); }
console.log("apk-sin-token-ingest: OK");
