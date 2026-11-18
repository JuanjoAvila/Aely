#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function newerVer(a, b) {
  a = String(a).split(".");
  b = String(b).split(".");
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = parseInt(a[i] || 0, 10);
    const y = parseInt(b[i] || 0, 10);
    if (x !== y) return x > y;
  }
  return false;
}

function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}`); throw e; }
}

async function ta(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}`); throw e; }
}

console.log("updates");

t("newerVer: patch mayor", () => {
  assert.equal(newerVer("3.107.0", "3.106.0"), true);
  assert.equal(newerVer("3.106.0", "3.107.0"), false);
});

t("newerVer: igual", () => {
  assert.equal(newerVer("3.106.0", "3.106.0"), false);
});

t("newerVer: segmentos distintos", () => {
  assert.equal(newerVer("3.10.0", "3.9.99"), true);
});

/* ---------- Canal de actualizaciones: el trozo REAL del monolito ----------
   Estos casos existen por un fallo que costó semanas: el canal beta llevaba roto desde que
   GitHub cambió el dominio al que redirigen los assets de las releases, y NO SE VEÍA porque
   `mcFetchManifest` se tragaba cualquier error y leía el manifiesto de producción — el móvil
   contestaba «✓ estás a la última» con la beta publicada delante. Un test que copie la lógica
   aquí no sirve de nada: hay que ejecutar el código que se despliega. */
const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const desde = html.indexOf("var _mcOtaBASE=");
const hasta = html.indexOf("window._mcNewerVer=");
assert.ok(desde > 0 && hasta > desde, "no se encontró el bloque de canal/manifiestos en public/index.html");
const fuenteCanal = html.slice(desde, hasta);

function sandboxCanal({ nativo = false, respuestas = {} } = {}) {
  const store = {};
  const pedidas = { fetch: [], nativo: [] };
  const responder = (url) => {
    const clave = Object.keys(respuestas).find((k) => url.indexOf(k) >= 0);
    return respuestas[clave] || { status: 200, body: '{"version":"0.0.0"}' };
  };
  const sandbox = {
    console, JSON, Date, Promise, Error, String, Number, Object, Math, parseInt, setTimeout,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    fetch: (url) => {
      pedidas.fetch.push(url);
      const r = responder(url);
      if (r.red) return Promise.reject(new TypeError("Failed to fetch"));
      return Promise.resolve({ ok: r.status >= 200 && r.status < 300, status: r.status, json: () => Promise.resolve(JSON.parse(r.body)) });
    },
    window: {
      Capacitor: nativo ? {
        isNativePlatform: () => true,
        Plugins: {
          CapacitorHttp: {
            request: ({ url }) => {
              pedidas.nativo.push(url);
              const r = responder(url);
              if (r.red) return Promise.reject(new Error("nativo: sin red"));
              return Promise.resolve({ status: r.status, data: r.body });
            },
          },
        },
      } : undefined,
    },
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(fuenteCanal, sandbox, { filename: "public/index.html:canal" });
  return { sandbox, pedidas, store };
}

await ta("beta: un fallo de red NO se disfraza de «estás a la última»", async () => {
  // El caso de 2026-07-25: los assets de release no mandan CORS, el fetch peta, y la caída a
  // estable hacía que el móvil leyera producción y dijera que no había nada nuevo.
  const { sandbox, pedidas } = sandboxCanal({ respuestas: { "releases/download": { red: true } } });
  sandbox.mcSetChannel("beta");
  await assert.rejects(() => sandbox.mcFetchManifest("version.json"), /beta\/version\.json/);
  assert.equal(pedidas.fetch.filter((u) => u.indexOf("github.io") >= 0).length, 0, "no debe leer el manifiesto estable");
});

await ta("beta: un 5xx tampoco cae a estable", async () => {
  const { sandbox } = sandboxCanal({ respuestas: { "releases/download": { status: 503, body: "" } } });
  sandbox.mcSetChannel("beta");
  await assert.rejects(() => sandbox.mcFetchManifest("version.json"), /HTTP 503/);
});

await ta("beta: un 404 SÍ cae a estable (aún no hay beta publicada)", async () => {
  const { sandbox } = sandboxCanal({
    respuestas: {
      "releases/download": { status: 404, body: "" },
      "github.io": { status: 200, body: '{"version":"4.10.1"}' },
    },
  });
  sandbox.mcSetChannel("beta");
  const r = await sandbox.mcFetchManifest("version.json");
  assert.equal((await r.json()).version, "4.10.1");
});

await ta("en el móvil el manifiesto lo pide ANDROID, no el fetch de la WebView", async () => {
  const { sandbox, pedidas } = sandboxCanal({
    nativo: true,
    respuestas: { "releases/download": { status: 200, body: '{"version":"4.11.0.6"}' } },
  });
  sandbox.mcSetChannel("beta");
  const r = await sandbox.mcFetchManifest("version.json");
  assert.equal((await r.json()).version, "4.11.0.6");
  assert.equal(pedidas.fetch.length, 0, "los assets de release no llevan CORS: el fetch de la WebView nunca vale");
  assert.equal(pedidas.nativo.length, 1);
});

t("la beta se sella con el MISMO número que anuncia su manifiesto", () => {
  /* Si el bundle lleva dentro `4.11.0` y el manifiesto anuncia `4.11.0.7`, la app no alcanza nunca
     la versión anunciada: `_mcNewerVer` da true para siempre y el móvil ofrece la MISMA beta una y
     otra vez, con Ajustes marcando un número que no es el que llevas. Pasó de verdad en cuanto la
     primera beta llegó a su móvil: «todo el maldito rato sale para actualizar» (2026-07-26). */
  const yml = fs.readFileSync(path.join(root, ".github", "workflows", "beta.yml"), "utf8");
  assert.match(yml, /MC_STAMP_VERSION:\s*\$\{\{\s*steps\.num\.outputs\.beta\s*\}\}/,
    "beta.yml tiene que sellar el bundle con el número de la beta, no con VERSION a pelo");
  assert.match(yml, /BETA="\$\{\{\s*steps\.num\.outputs\.beta\s*\}\}"/,
    "el manifiesto tiene que salir del MISMO sitio que el sello");
  const stamp = fs.readFileSync(path.join(root, "scripts", "stamp-version.mjs"), "utf8");
  assert.match(stamp, /process\.env\.MC_STAMP_VERSION/, "stamp-version.mjs debe aceptar el override");
});

await ta("estable: sigue leyendo de Pages", async () => {
  const { sandbox, pedidas } = sandboxCanal({ respuestas: { "github.io": { status: 200, body: '{"version":"4.10.1"}' } } });
  const r = await sandbox.mcFetchManifest("version.json");
  assert.equal((await r.json()).version, "4.10.1");
  assert.ok(pedidas.fetch[0].indexOf("juanjoavila.github.io") >= 0);
});

await ta("el manifiesto dice de qué canal ha salido REALMENTE", async () => {
  // Sin esta marca, caer a estable es invisible — y una caída invisible es justo lo que dejó la
  // APK encallada en la 34: el móvil en beta leía producción sin decirlo (2026-07-26).
  const beta = sandboxCanal({ respuestas: { "releases/download": { status: 200, body: '{"versionCode":35}' } } });
  beta.sandbox.mcSetChannel("beta");
  assert.equal((await beta.sandbox.mcFetchManifest("apk.json")).from, "beta");

  const caida = sandboxCanal({
    respuestas: { "releases/download": { status: 404, body: "" }, "github.io": { status: 200, body: '{"versionCode":34}' } },
  });
  caida.sandbox.mcSetChannel("beta");
  assert.equal((await caida.sandbox.mcFetchManifest("apk.json")).from, "stable");
});

/* ---------- La APK: el trozo REAL de _mcCheckApkUpdate ----------
   «apk.json anuncia la 35, estoy en la 34, y al intentarlo no pasa nada» (2026-07-26). No era el
   instalador: la release `beta` no publicaba `apk.json`, así que el manifiesto daba 404, se caía a
   producción —que decía 34— y comparar 34 con 34 devolvía `false` sin abrir la boca. */
const desdeApk = html.indexOf("window._mcApkWhy=null;");
const hastaApk = html.indexOf("if('serviceWorker' in navigator");
assert.ok(desdeApk > 0 && hastaApk > desdeApk, "no se encontró _mcCheckApkUpdate en public/index.html");
const fuenteApk = html.slice(desdeApk, hastaApk);

function sandboxApk({ canal = "stable", instalada = 34, manifiestos = {} } = {}) {
  const llamadas = { install: [], toast: [], evento: [] };
  const responder = (url) => {
    const clave = Object.keys(manifiestos).find((k) => url.indexOf(k) >= 0);
    return manifiestos[clave] || { status: 404, body: "" };
  };
  const sandbox = {
    console, JSON, Date, Promise, Error, String, Number, Object, Math, parseInt, setTimeout,
    // Los textos no se traducen aquí: interesa QUÉ clave se elige y con qué datos.
    t: (k) => k,
    tf: (k, v) => k + " " + JSON.stringify(v),
    cloud: { logEvent: () => {} },
    mcChannel: () => canal,
    mcFetchManifest: (name) => {
      const usaBeta = canal === "beta" && responder("releases/download/beta/" + name).status === 200;
      const r = usaBeta ? responder("releases/download/beta/" + name) : responder("github.io/" + name);
      if (r.status !== 200) return Promise.reject(new Error(name + ": " + r.status));
      return Promise.resolve({ ok: true, status: 200, from: usaBeta ? "beta" : "stable", json: () => JSON.parse(r.body) });
    },
    window: {
      _mcSignalApkUpdate: (info) => { llamadas.evento.push(info); },
      Capacitor: {
        isNativePlatform: () => true,
        Plugins: {
          MiCartera: {
            appInfo: () => Promise.resolve(instalada == null ? {} : { versionName: "4.12.0", versionCode: instalada }),
            installApk: ({ url }) => { llamadas.install.push(url); return Promise.resolve({ ok: true }); },
          },
        },
      },
    },
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(fuenteApk, sandbox, { filename: "public/index.html:apk" });
  const showToast = (m) => llamadas.toast.push(m);
  return { sandbox, llamadas, showToast };
}

await ta("el fallo del 26/7: en beta sin apk.json se leía producción y se callaba", async () => {
  const { sandbox, llamadas, showToast } = sandboxApk({
    canal: "beta",
    instalada: 34,
    manifiestos: { "github.io/apk.json": { status: 200, body: '{"versionCode":34,"versionName":"4.11.0","url":"x"}' } },
  });
  const hay = await sandbox.window._mcCheckApkUpdate({ manual: true, showToast });
  assert.equal(hay, false, "producción va por la 34: no hay nada que instalar");
  assert.equal(llamadas.install.length, 0);
  // Lo que ANTES no existía: el motivo, con el canal leído y los dos números.
  assert.match(sandbox.window._mcApkWhy, /apk_why_state/);
  assert.match(sandbox.window._mcApkWhy, /"ch":"apk_ch_stable"/, "tiene que confesar que ha leído el canal estable");
  assert.match(sandbox.window._mcApkWhy, /"want":"34".*"have":"34"|"have":"34".*"want":"34"/);
});

await ta("con apk.json en la beta, la 35 sí se ofrece", async () => {
  const { sandbox, llamadas, showToast } = sandboxApk({
    canal: "beta",
    instalada: 34,
    manifiestos: {
      "releases/download/beta/apk.json": { status: 200, body: '{"versionCode":35,"versionName":"4.12.0","url":"https://x/beta35.apk"}' },
      "github.io/apk.json": { status: 200, body: '{"versionCode":34,"versionName":"4.11.0","url":"y"}' },
    },
  });
  const hay = await sandbox.window._mcCheckApkUpdate({ manual: true, showToast });
  assert.equal(hay, true);
  assert.deepEqual(llamadas.install, ["https://x/beta35.apk"], "la beta instala la APK de la beta, no la de producción");
  assert.match(sandbox.window._mcApkWhy, /"ch":"apk_ch_beta"/);
});

await ta("ningún camino de la APK se queda mudo", async () => {
  // Sin app nativa
  const sinApp = sandboxApk({});
  delete sinApp.sandbox.window.Capacitor.Plugins.MiCartera.appInfo;
  assert.equal(await sinApp.sandbox.window._mcCheckApkUpdate({ manual: true, showToast: sinApp.showToast }), false);
  assert.equal(sinApp.sandbox.window._mcApkWhy, "apk_why_noapp");

  // APK tan vieja que su plugin no sabe instalar nada
  const vieja = sandboxApk({});
  delete vieja.sandbox.window.Capacitor.Plugins.MiCartera.installApk;
  assert.equal(await vieja.sandbox.window._mcCheckApkUpdate({ manual: true, showToast: vieja.showToast }), false);
  assert.equal(vieja.sandbox.window._mcApkWhy, "apk_why_oldapk");

  // Manifiesto sin los datos mínimos
  const roto = sandboxApk({ manifiestos: { "github.io/apk.json": { status: 200, body: '{"versionName":"4.12.0"}' } } });
  assert.equal(await roto.sandbox.window._mcCheckApkUpdate({ manual: true, showToast: roto.showToast }), false);
  assert.match(roto.sandbox.window._mcApkWhy, /apk_why_manifest/);

  // Y un manifiesto que no se puede ni leer deja el aviso, no el silencio
  const caido = sandboxApk({ manifiestos: {} });
  assert.equal(await caido.sandbox.window._mcCheckApkUpdate({ manual: true, showToast: caido.showToast }), false);
  assert.match(caido.sandbox.window._mcApkWhy, /^⚠ /);
  assert.equal(caido.llamadas.toast.length, 1, "y al pedirlo a mano, se dice en pantalla");
});

t("la release `beta` publica TAMBIÉN el manifiesto de la APK", () => {
  /* La causa raíz: `beta.yml` subía solo bundle.zip y version.json. Sin apk.json en la release, un
     móvil en canal beta lee el número de PRODUCCIÓN y la APK de pruebas no existe para él. */
  const yml = fs.readFileSync(path.join(root, ".github", "workflows", "beta.yml"), "utf8");
  assert.match(yml, /gh release upload beta [^\n]*\bapk\.json\b/,
    "beta.yml tiene que subir apk.json a la release `beta`");
  assert.match(yml, /cp public\/apk\.json apk\.json/,
    "el apk.json que se sube es el de la rama beta, que es quien conoce la APK de pruebas");
});

/* ---------- SEG-01: el OTA se instala con checksum (18/11/2026) ----------
   El plugin (Capgo 6.50.1) recalcula el SHA-256 del zip y tira el bundle si no casa con el
   `checksum` que le pasamos. Si el manifiesto no trae uno válido NO se pasa nada: exigirlo dejaría
   sin actualizaciones a quien lea un manifiesto viejo (o el del repo puente). */
await ta("OTA: el checksum del manifiesto llega al instalador, normalizado", async () => {
  const { sandbox } = sandboxCanal();
  const suma = "A".repeat(64);
  const o = sandbox.mcBundleOpts({ version: "4.27.0", checksum: " " + suma + " " });
  assert.equal(o.checksum, "a".repeat(64), "en minúsculas, que es como lo calcula el plugin");
  assert.equal(o.version, "4.27.0");
  assert.equal(o.url, "https://juanjoavila.github.io/Aely/bundle.zip?v=4.27.0",
    "en estable el zip lleva la versión: la caché de Pages no puede servir el viejo con el checksum nuevo");
});

await ta("OTA: sin checksum (o uno raro) se instala como antes, sin campo", async () => {
  const { sandbox } = sandboxCanal();
  for (const v of [{ version: "4.27.0" }, { version: "4.27.0", checksum: "abc" }, { version: "4.27.0", checksum: 12 },
    { version: "4.27.0", checksum: "z".repeat(64) }]) {
    const o = sandbox.mcBundleOpts(v);
    assert.equal("checksum" in o, false, JSON.stringify(v));
  }
});

await ta("OTA beta: el zip de la release va sin parámetros y con su checksum", async () => {
  const { sandbox } = sandboxCanal();
  sandbox.mcSetChannel("beta");
  const o = sandbox.mcBundleOpts({ version: "4.27.0.3", checksum: "b".repeat(64) });
  assert.equal(o.url, "https://github.com/JuanjoAvila/Aely/releases/download/beta/bundle.zip");
  assert.equal(o.checksum, "b".repeat(64));
});

await ta("OTA beta: si el manifiesto cae a estable, el zip también sale de estable", async () => {
  // Revisión de seguridad de la ronda C (P3-1): con la release `beta` sin version.json, el
  // checksum era el del zip estable y se pedía el de beta; el plugin lo tiraba en cada intento.
  const suma = "c".repeat(64);
  const caida = sandboxCanal({
    respuestas: {
      "releases/download": { status: 404, body: "" },
      "github.io": { status: 200, body: JSON.stringify({ version: "4.27.0", checksum: suma }) },
    },
  });
  caida.sandbox.mcSetChannel("beta");
  const v = await caida.sandbox.mcFetchManifest("version.json").then(caida.sandbox.mcManifestJson);
  const o = caida.sandbox.mcBundleOpts(v);
  assert.equal(o.url, "https://juanjoavila.github.io/Aely/bundle.zip?v=4.27.0");
  assert.equal(o.checksum, suma);

  // Y con la beta publicada, el zip sigue saliendo de la release.
  const beta = sandboxCanal({
    respuestas: { "releases/download": { status: 200, body: JSON.stringify({ version: "4.27.0.2", checksum: suma }) } },
  });
  beta.sandbox.mcSetChannel("beta");
  const vb = await beta.sandbox.mcFetchManifest("version.json").then(beta.sandbox.mcManifestJson);
  assert.equal(beta.sandbox.mcBundleOpts(vb).url, "https://github.com/JuanjoAvila/Aely/releases/download/beta/bundle.zip");
});

t("OTA: los dos chequeos leen el manifiesto con mcManifestJson (que guarda el canal)", () => {
  assert.equal((html.match(/\.then\(mcManifestJson\)/g) || []).length, 2);
  assert.equal(html.indexOf(".then(function(r){ return r.json(); })"), -1);
});

t("OTA: las dos descargas del bundle pasan por mcBundleOpts", () => {
  // Una tercera descarga a mano se saltaría el checksum sin que nada lo dijera.
  const descargas = html.match(/up\.download\([^\n;]*/g) || [];
  assert.ok(descargas.length >= 2, "no se encontraron las descargas del bundle");
  for (const d of descargas) assert.ok(d.startsWith("up.download(mcBundleOpts(v))"), d);
});

t("OTA: deploy.yml y beta.yml publican el checksum del MISMO zip que suben", () => {
  for (const [wf, zip] of [["deploy.yml", "public/bundle.zip"], ["beta.yml", "bundle.zip"]]) {
    const yml = fs.readFileSync(path.join(root, ".github", "workflows", wf), "utf8");
    const iZip = yml.indexOf("zip -qr ../bundle.zip .");
    const iSuma = yml.indexOf("SUMA=$(sha256sum " + zip + " | cut -d' ' -f1)");
    const iManif = yml.indexOf('"checksum":"%s"}\\n\'');
    assert.ok(iZip > 0 && iSuma > iZip && iManif > iSuma, wf + ": el checksum tiene que salir del zip ya hecho y entrar en version.json");
    // La CSP se sella ANTES de comprimir: después, el zip llevaría un index distinto al de Pages.
    const iCsp = yml.indexOf("node scripts/csp-sellar.mjs");
    const iMin = yml.indexOf("node scripts/minify-html.mjs");
    assert.ok(iMin > 0 && iCsp > iMin && iCsp < iZip, wf + ": csp-sellar va después de minificar y antes del zip");
  }
});
