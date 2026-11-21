#!/usr/bin/env node
/* La firma del OTA en CI (`scripts/ota-manifiesto.mjs`, SEG-01, ronda C2).
   La clave de estas pruebas se genera aquí y se tira: la de verdad solo existe como secreto de
   Actions, y el repo es público. Lo que se comprueba es lo que haría el móvil: abrir la firma con
   la pública y encontrar dentro el SHA-256 del zip (Capgo 6.50.1, `CryptoCipher.decryptChecksum`). */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { manifiesto } from "../scripts/ota-manifiesto.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const script = path.join(root, "scripts", "ota-manifiesto.mjs");
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}`); throw e; }
}
console.log("ota-firma");

const par = () => crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "pkcs1", format: "pem" },
  privateKeyEncoding: { type: "pkcs1", format: "pem" },
});
const clave = par(), otra = par();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ota-firma-"));
const zip = path.join(dir, "bundle.zip");
fs.writeFileSync(zip, crypto.randomBytes(4096));
const suma = crypto.createHash("sha256").update(fs.readFileSync(zip)).digest("hex");
const base = { zip, version: "4.27.0", url: "https://ejemplo.invalid/bundle.zip" };

try {
  t("sin clave: checksum de siempre, sin firma", () => {
    const { m, firmado } = manifiesto(base);
    assert.equal(firmado, false);
    assert.deepEqual(m, { version: "4.27.0", url: base.url, checksum: suma });
  });

  t("con clave: la firma se abre con la pública y dentro está el SHA-256 del zip", () => {
    const { m, firmado } = manifiesto({ ...base, privada: clave.privateKey, publicaApp: clave.publicKey });
    assert.equal(firmado, true);
    assert.equal(m.checksum, suma, "el checksum en claro se queda: es lo que leen las APK sin clave");
    assert.match(m.signature, /^[0-9a-f]{512}$/, "256 bytes en hexadecimal, lo que exige el actualizador");
    const dentro = crypto.publicDecrypt({ key: clave.publicKey, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(m.signature, "hex"));
    assert.equal(dentro.toString("hex"), suma);
    // El identificador es el que calcula el actualizador: 20 primeros caracteres de la pública.
    assert.equal(m.keyId, clave.publicKey.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "").slice(0, 20));
    // Otro zip, otra firma: una firma no vale para un bundle distinto.
    const zip2 = path.join(dir, "otro.zip"); fs.writeFileSync(zip2, "otro");
    assert.notEqual(manifiesto({ ...base, zip: zip2, privada: clave.privateKey }).m.signature, m.signature);
  });

  t("el secreto pegado con CRLF o con los saltos como \\n firma igual", () => {
    const a = manifiesto({ ...base, privada: clave.privateKey }).m.signature;
    assert.equal(manifiesto({ ...base, privada: clave.privateKey.replace(/\n/g, "\r\n") }).m.signature, a);
    assert.equal(manifiesto({ ...base, privada: clave.privateKey.trim().replace(/\n/g, "\\n") }).m.signature, a);
  });

  t("una clave que no es la pareja de la APK corta el build en vez de firmar para nadie", () => {
    assert.throws(() => manifiesto({ ...base, privada: otra.privateKey, publicaApp: clave.publicKey }), /no es la pareja/);
    assert.throws(() => manifiesto({ ...base, privada: "esto no es una clave" }));
    const corta = crypto.generateKeyPairSync("rsa", { modulusLength: 1024, privateKeyEncoding: { type: "pkcs1", format: "pem" }, publicKeyEncoding: { type: "pkcs1", format: "pem" } });
    assert.throws(() => manifiesto({ ...base, privada: corta.privateKey }), /RSA-2048/);
  });

  t("beta: `src` sigue donde lo lee beta.yml para saber si la app ha cambiado", () => {
    const { m } = manifiesto({ ...base, src: "ff873bd18a0ee6fe", channel: "beta", privada: clave.privateKey });
    const linea = JSON.stringify(m);
    assert.equal((linea.match(/.*"src":"([^"]*)".*/) || [])[1], "ff873bd18a0ee6fe");
    assert.equal(m.channel, "beta");
    const yml = fs.readFileSync(path.join(root, ".github", "workflows", "beta.yml"), "utf8");
    assert.ok(yml.includes(`sed -n 's/.*"src":"\\([^"]*\\)".*/\\1/p'`), "beta.yml lee `src` con ese sed");
  });

  t("por línea de órdenes: sin secreto NO rompe, lo dice en el log y no firma", () => {
    const out = path.join(dir, "v1.json");
    const env = { ...process.env }; delete env.OTA_SIGNING_KEY;
    const r = spawnSync(process.execPath, [script, "--zip", zip, "--out", out, "--version", "4.27.0", "--url", base.url], { env, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /SIN FIRMA: no hay secreto OTA_SIGNING_KEY/);
    assert.deepEqual(JSON.parse(fs.readFileSync(out, "utf8")), { version: "4.27.0", url: base.url, checksum: suma });
    // Secreto vacío (así llega a un workflow cuando no existe): igual que sin él.
    const r2 = spawnSync(process.execPath, [script, "--zip", zip, "--out", out, "--version", "4.27.0", "--url", base.url], { env: { ...env, OTA_SIGNING_KEY: "" }, encoding: "utf8" });
    assert.equal(r2.status, 0); assert.equal("signature" in JSON.parse(fs.readFileSync(out, "utf8")), false);
  });

  t("por línea de órdenes: con secreto firma y la clave no sale en el log", () => {
    const out = path.join(dir, "v2.json");
    // Hoy capacitor.config.json puede llevar ya la pública de la APK 65: con una clave de prueba
    // el cotejo cortaría (bien hecho), así que aquí solo se exige firma si no hay pública aún.
    const cfg = JSON.parse(fs.readFileSync(path.join(root, "capacitor.config.json"), "utf8"));
    const conPublica = !!(cfg.plugins && cfg.plugins.CapacitorUpdater && cfg.plugins.CapacitorUpdater.publicKey);
    const r = spawnSync(process.execPath, [script, "--zip", zip, "--out", out, "--version", "4.27.0.2", "--url", base.url, "--src", "abc", "--channel", "beta"],
      { env: { ...process.env, OTA_SIGNING_KEY: clave.privateKey }, encoding: "utf8" });
    const cuerpo = clave.privateKey.split("\n")[1];
    assert.equal((r.stdout + r.stderr).includes(cuerpo), false, "la clave no se imprime nunca");
    if (conPublica) { assert.equal(r.status, 1); assert.match(r.stderr, /no es la pareja/); return; }
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /FIRMADO con la clave /);
    const m = JSON.parse(fs.readFileSync(out, "utf8"));
    assert.equal(m.checksum, suma); assert.match(m.signature, /^[0-9a-f]{512}$/);
    // Una clave mala con el secreto puesto SÍ corta: publicar sin firma creyendo que la lleva es peor.
    const mala = spawnSync(process.execPath, [script, "--zip", zip, "--out", out, "--version", "1", "--url", base.url], { env: { ...process.env, OTA_SIGNING_KEY: "no-es-una-clave" }, encoding: "utf8" });
    assert.equal(mala.status, 1);
  });
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
