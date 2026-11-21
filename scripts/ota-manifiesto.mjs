#!/usr/bin/env node
/**
 * Escribe el `version.json` del OTA: versión, SHA-256 del zip y, si hay clave, su firma.
 *
 * Por qué existe (SEG-01, ronda C2, 21/11/2026): el `checksum` solo demuestra que el zip es el que
 * dice el manifiesto, y quien pudiera escribir en Pages cambiaría los dos. La APK 65 lleva la
 * clave pública y solo acepta un bundle cuyo SHA-256 venga cifrado con la PRIVADA. Esa privada
 * vive en el secreto de Actions `OTA_SIGNING_KEY`; nunca en el repo, que es público.
 *
 * Sin secreto NO se firma y NO se rompe el build: el manifiesto sale con el `checksum` de siempre,
 * que es lo único que entienden las APK hasta la 64. Con secreto se añade `signature` (y `keyId`)
 * SIN quitar `checksum`: las APK viejas siguen leyendo el suyo y no se quedan sin actualizaciones.
 *
 * La firma es la que comprueba el actualizador (Capgo 6.50.1, `CryptoCipher.decryptChecksum`):
 * RSA PKCS#1 v1.5 con la privada sobre los 32 bytes en bruto del SHA-256, en hexadecimal (512).
 *
 * Uso (deploy.yml y beta.yml):
 *   node scripts/ota-manifiesto.mjs --zip bundle.zip --out version.json --version 4.27.0 \
 *     --url https://…/bundle.zip [--src <huella>] [--channel beta]
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/* El secreto se pega a mano en GitHub: puede llegar con CRLF o con los saltos escritos como `\n`. */
function leerPrivada(texto) {
  const pem = String(texto).replace(/\\n/g, "\n").replace(/\r/g, "").trim() + "\n";
  return crypto.createPrivateKey(pem);
}

/* Cuerpo base64 de la pública en PKCS#1, sin cabeceras ni espacios: lo mismo que compara el
   actualizador para calcular su identificador (los 20 primeros caracteres). */
function cuerpoPublica(pem) {
  return String(pem).replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
}

export function firmarSuma(sumaHex, privadaTexto) {
  const privada = leerPrivada(privadaTexto);
  const suma = Buffer.from(sumaHex, "hex");
  const firma = crypto.privateEncrypt({ key: privada, padding: crypto.constants.RSA_PKCS1_PADDING }, suma);
  const publica = crypto.createPublicKey(privada);
  // RSA-2048 exacto: el actualizador tira cualquier firma que no mida 256 bytes.
  if (firma.length !== 256) throw new Error("la clave no es RSA-2048: la firma mide " + firma.length + " bytes y la app exige 256");
  // Se comprueba aquí lo mismo que hará el móvil: una firma que no se abre deja a todos sin OTA.
  const vuelta = crypto.publicDecrypt({ key: publica, padding: crypto.constants.RSA_PKCS1_PADDING }, firma);
  if (!vuelta.equals(suma)) throw new Error("la firma recién hecha no devuelve el SHA-256 del zip");
  const cuerpo = cuerpoPublica(publica.export({ type: "pkcs1", format: "pem" }));
  return { signature: firma.toString("hex"), keyId: cuerpo.slice(0, 20), publica: cuerpo };
}

export function manifiesto({ zip, version, url, src, channel, privada, publicaApp }) {
  const checksum = crypto.createHash("sha256").update(fs.readFileSync(zip)).digest("hex");
  // El orden de los campos se conserva: `src` va antes de `url` porque beta.yml lo lee con sed.
  const m = { version };
  if (src) m.src = src;
  m.url = url;
  if (channel) m.channel = channel;
  m.checksum = checksum;
  if (!privada) return { m, firmado: false };
  const f = firmarSuma(checksum, privada);
  // Firmar con una clave que no es la de la APK es peor que no firmar: el móvil la rechaza igual
  // y aquí parecería que todo va bien.
  if (publicaApp && cuerpoPublica(publicaApp) !== f.publica) {
    throw new Error("OTA_SIGNING_KEY no es la pareja de la clave pública de capacitor.config.json (" + f.keyId + ")");
  }
  m.signature = f.signature;
  m.keyId = f.keyId;
  return { m, firmado: true };
}

function publicaDeLaApp() {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(root, "capacitor.config.json"), "utf8"));
    return (cfg.plugins && cfg.plugins.CapacitorUpdater && cfg.plugins.CapacitorUpdater.publicKey) || "";
  } catch (e) { return ""; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = {};
  for (let i = 2; i < process.argv.length; i += 2) a[process.argv[i].replace(/^--/, "")] = process.argv[i + 1];
  for (const k of ["zip", "out", "version", "url"]) {
    if (!a[k]) { console.error("ota-manifiesto: falta --" + k); process.exit(2); }
  }
  const privada = (process.env.OTA_SIGNING_KEY || "").trim();
  const publicaApp = publicaDeLaApp();
  let r;
  try {
    r = manifiesto({ zip: a.zip, version: a.version, url: a.url, src: a.src, channel: a.channel, privada, publicaApp });
  } catch (e) {
    // Con el secreto puesto, un fallo al firmar SÍ corta: publicar sin firma creyendo que la lleva
    // dejaría sin actualizaciones a las APK con clave. El mensaje nunca incluye la clave.
    console.error("::error::ota-manifiesto: " + e.message);
    process.exit(1);
  }
  fs.writeFileSync(a.out, JSON.stringify(r.m) + "\n", "utf8");
  if (r.firmado) {
    console.log("OTA " + a.version + " · sha256 " + r.m.checksum + " · FIRMADO con la clave " + r.m.keyId);
  } else {
    console.log("OTA " + a.version + " · sha256 " + r.m.checksum + " · SIN FIRMA: no hay secreto OTA_SIGNING_KEY");
    console.log("::" + (publicaApp ? "warning" : "notice") + "::OTA sin firmar (falta el secreto OTA_SIGNING_KEY)."
      + (publicaApp ? " Las APK con clave pública NO instalarán esta actualización." : " Las APK actuales la instalan con el checksum."));
  }
}
