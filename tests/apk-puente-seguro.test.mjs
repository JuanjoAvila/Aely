#!/usr/bin/env node
/* Ronda B (19/11/2026): lo que blinda el puente nativo y no se ve en ningún e2e, porque solo existe
   dentro de la APK. Se compilan con javac los métodos REALES (copiados tal cual del .java) y se
   prueban contra URLs buenas y malas; lo demás se coteja contra la fuente:
   - SEG-03: `installApk` solo baja de los releases del dueño y `setIngestUrl` solo acepta el ingest
     del proyecto. Una OTA con JS colado no puede hacer instalar otra app ni llevarse los pagos.
   - SEG-05: la WebView de TR solo navega dentro de TR y solo se inyecta en app.traderepublic.com.
   - SEG-17: el FileProvider no publica el almacenamiento compartido entero.
   - SEG-22: R8 encendido sin renombrar nuestras clases (WorkManager guarda sus nombres).
   - SEG-01: la clave pública del OTA es una RSA-2048 PKCS#1 que el updater sabe leer.
   - UX-03: los colores del splash son el fondo de cada tema de la web, y no falta ningún tema. */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const javaDir = path.join(root, "android/app/src/main/java/com/micartera/app");
const rd = rel => fs.readFileSync(path.join(root, rel), "utf8").replaceAll("\r\n", "\n");
const jdk = process.env.JAVA_HOME && path.join(process.env.JAVA_HOME, "bin");
const androidJdk = "C:/Program Files/Android/Android Studio/jbr/bin";
const javac = fs.existsSync(path.join(jdk || "", process.platform === "win32" ? "javac.exe" : "javac"))
  ? path.join(jdk, "javac") : fs.existsSync(path.join(androidJdk, "javac.exe"))
    ? path.join(androidJdk, "javac.exe") : "javac";
const java = javac.endsWith("javac.exe") ? javac.replace(/javac\.exe$/, "java.exe")
  : javac.endsWith("javac") && javac !== "javac" ? javac.replace(/javac$/, "java") : "java";

let n = 0;
const t = (name, fn) => { fn(); n++; console.log("  ✓ " + name); };

const plugin = rd("android/app/src/main/java/com/micartera/app/MiCarteraPlugin.java");
const tr = rd("android/app/src/main/java/com/micartera/app/TradeRepublicPlugin.java");
// Un método estático entero, desde su firma hasta la llave que lo cierra (4 espacios).
const metodo = (src, firma) => {
  const m = src.match(new RegExp("^    static boolean " + firma + "\\([^]*?^    }", "m"));
  assert.ok(m, "no encuentro " + firma);
  return m[0];
};
const constante = (src, nombre) => {
  const m = src.match(new RegExp("^    (?:private )?static final (?:String|long) " + nombre + " [^\\n]*;", "m"));
  assert.ok(m, "no encuentro " + nombre);
  return m[0];
};

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aely-apk-puente-"));
try {
  fs.mkdirSync(path.join(dir, "android/net"), { recursive: true });
  // El Uri de Android, lo justo para estos métodos y con la semántica de getHost/getScheme.
  fs.writeFileSync(path.join(dir, "android/net/Uri.java"), `package android.net;
public class Uri { private final java.net.URI u; private Uri(java.net.URI u){this.u=u;}
  public static Uri parse(String s){ try { return new Uri(new java.net.URI(s)); } catch(Exception e){ return new Uri(java.net.URI.create("about:blank")); } }
  public String getHost(){return u.getHost();} public String getScheme(){return u.getScheme();} }
`);
  fs.writeFileSync(path.join(dir, "Guards.java"), `import java.net.URL;
public class Guards {
${constante(plugin, "APK_OWNER_PATH")}
${constante(plugin, "INGEST_HOST")}
${metodo(plugin, "apkUrlPermitida")}
${metodo(plugin, "ingestUrlPermitida")}
${metodo(tr, "origenTR")}
${metodo(tr, "paginaTR")}
  static int fallos = 0;
  static void ok(boolean c, String m){ if(!c){ fallos++; System.out.println("FALLO " + m); } }
  public static void main(String[] a){
    String rel = "https://github.com/JuanjoAvila/Aely/releases/download/beta/Aely-4.26.206-beta-64.apk";
    ok(apkUrlPermitida(rel, true), "release del dueño");
    ok(apkUrlPermitida("https://github.com/JuanjoAvila/Mi-Cartera/releases/download/v1/x.apk", true), "repo renombrado del mismo dueño");
    ok(!apkUrlPermitida("http://github.com/JuanjoAvila/Aely/releases/download/beta/x.apk", true), "sin https");
    ok(!apkUrlPermitida("https://github.com/otro/Aely/releases/download/beta/x.apk", true), "otro dueño");
    ok(!apkUrlPermitida("https://github.com/JuanjoAvila/Aely/raw/main/x.apk", true), "fuera de releases");
    ok(!apkUrlPermitida("https://github.com.evil.example/JuanjoAvila/Aely/releases/download/x.apk", true), "dominio parecido");
    ok(!apkUrlPermitida("https://user@github.com/JuanjoAvila/Aely/releases/download/b/x.apk", true), "con usuario");
    ok(!apkUrlPermitida("https://github.com:8443/JuanjoAvila/Aely/releases/download/b/x.apk", true), "otro puerto");
    ok(!apkUrlPermitida("https://objects.githubusercontent.com/x.apk", true), "el CDN no puede ser el primer salto");
    ok(apkUrlPermitida("https://objects.githubusercontent.com/x.apk", false), "el CDN tras la redirección");
    ok(apkUrlPermitida("https://release-assets.githubusercontent.com/x.apk", false), "el CDN nuevo tras la redirección");
    ok(!apkUrlPermitida("https://evil.example/x.apk", false), "redirección a otro sitio");
    ok(!apkUrlPermitida("https://githubusercontent.com.evil.example/x.apk", false), "CDN falso");
    ok(!apkUrlPermitida("file:///sdcard/x.apk", true), "fichero local");
    ok(!apkUrlPermitida("no es una url", true), "basura");
    String ing = "https://" + INGEST_HOST + "/functions/v1/ingest?token=abc%2Bdef";
    ok(ingestUrlPermitida(ing), "ingest del proyecto");
    ok(!ingestUrlPermitida("http://" + INGEST_HOST + "/functions/v1/ingest?token=x"), "ingest sin https");
    ok(!ingestUrlPermitida("https://otro.supabase.co/functions/v1/ingest?token=x"), "otro proyecto");
    ok(!ingestUrlPermitida("https://" + INGEST_HOST + "/functions/v1/otra?token=x"), "otra función");
    ok(!ingestUrlPermitida("https://" + INGEST_HOST + ".evil.example/functions/v1/ingest"), "dominio parecido");
    ok(!ingestUrlPermitida("https://x@" + INGEST_HOST + "/functions/v1/ingest"), "con usuario");
    ok(origenTR("https://app.traderepublic.com/login"), "SPA de TR");
    ok(origenTR("https://api.traderepublic.com/api/v1/auth"), "API de TR");
    ok(!origenTR("http://app.traderepublic.com/"), "TR sin https");
    ok(!origenTR("https://traderepublic.com.evil.example/"), "dominio parecido a TR");
    ok(!origenTR("https://evil.example/?u=app.traderepublic.com"), "TR en la query");
    ok(paginaTR("https://app.traderepublic.com/"), "inyección en la SPA");
    ok(!paginaTR("https://api.traderepublic.com/"), "no se inyecta en la API");
    ok(!paginaTR("about:blank"), "no se inyecta en la página aparcada");
    ok(!paginaTR(null), "sin página");
    if (fallos > 0) System.exit(1);
    System.out.println("guardas OK");
  }
}
`);
  for (const [cmd, args] of [
    [javac, ["-encoding", "UTF-8", "-d", dir, path.join(dir, "android/net/Uri.java"), path.join(dir, "Guards.java")]],
    [java, ["-cp", dir, "Guards"]],
  ]) {
    const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8" });
    if (r.status !== 0) throw new Error(`${cmd}: ${r.error || r.stderr || r.stdout}`);
  }
  console.log("  ✓ SEG-03/SEG-05: guardas de URL compiladas y probadas con javac");
} finally { fs.rmSync(dir, { recursive: true, force: true }); }

t("SEG-03: installApk comprueba origen, huella, paquete y firma antes del instalador", () => {
  const body = plugin.slice(plugin.indexOf("public void installApk("), plugin.indexOf("static boolean apkUrlPermitida("));
  const i = s => { const k = body.indexOf(s); assert.ok(k >= 0, "falta " + s); return k; };
  assert.ok(i("apkUrlPermitida(url, true)") < i("new Thread("), "el origen se mira antes de bajar nada");
  assert.ok(i("descargarApk(url, apk)") < i("verificarApk(ctx, apk)"));
  assert.ok(i("sha256.equalsIgnoreCase(bajada)") < i("verificarApk(ctx, apk)"));
  assert.ok(i("verificarApk(ctx, apk)") < i("ctx.startActivity(install)"), "nada llega al instalador sin verificar");
  assert.match(plugin, /setInstanceFollowRedirects\(false\)/, "las redirecciones se siguen a mano, salto a salto");
  assert.doesNotMatch(plugin, /setInstanceFollowRedirects\(true\)/);
  assert.match(plugin, /getPackageName\(\)\.equals\(nueva\.packageName\)/, "otro paquete no se instala nunca");
});

t("SEG-03: setIngestUrl rechaza un destino que no sea el ingest del proyecto", () => {
  const body = plugin.slice(plugin.indexOf("public void setIngestUrl("), plugin.indexOf("static final String INGEST_HOST"));
  assert.ok(body.indexOf("ingestUrlPermitida(url)") >= 0 && body.indexOf("ingestUrlPermitida(url)") < body.indexOf(".putString(\"url\""));
  const web = rd("src/modules/00-core.js").match(/SUPABASE_URL:\s*"https:\/\/([^"/]+)"/);
  assert.ok(web, "no encuentro CONFIG.SUPABASE_URL");
  assert.match(plugin, new RegExp('INGEST_HOST = "' + web[1].replaceAll(".", "\\.") + '"'), "el host fijo de la APK es el de la web");
});

t("SEG-05: el PIN no se inyecta fuera de app.traderepublic.com", () => {
  const run = tr.slice(tr.indexOf("private void run(String id, String asyncBody)"), tr.indexOf("static boolean origenTR("));
  assert.ok(run.indexOf("paginaTR(web.getUrl())") >= 0 && run.indexOf("paginaTR(web.getUrl())") < run.indexOf("web.evaluateJavascript(wrapped"),
    "la página se comprueba en el mismo hilo y justo antes de inyectar");
  assert.match(tr, /shouldOverrideUrlLoading\(WebView v, WebResourceRequest req\)[^]*?isForMainFrame\(\) && !origenTR/);
  assert.match(tr, /shouldOverrideUrlLoading\(WebView v, String url\)[^]*?return !origenTR\(url\)/);
});

t("SEG-17: el FileProvider solo publica la actualización y los informes", () => {
  const xml = rd("android/app/src/main/res/xml/file_paths.xml").replace(/<!--[^]*?-->/g, "");
  assert.doesNotMatch(xml, /<external-path/, "nada del almacenamiento compartido entero");
  assert.doesNotMatch(xml, /path="\."/, "ninguna carpeta entera");
  assert.match(xml, /<cache-path name="actualizacion" path="updates\/" \/>/);
  assert.match(plugin, /new File\(ctx\.getCacheDir\(\), "updates"\)/, "installApk sigue escribiendo donde publica el proveedor");
});

t("SEG-22: R8 en release sin renombrar nuestras clases", () => {
  const gradle = rd("android/app/build.gradle");
  const rel = gradle.slice(gradle.indexOf("        release {", gradle.indexOf("buildTypes {")), gradle.indexOf("        debug {"));
  assert.match(rel, /minifyEnabled true/);
  assert.doesNotMatch(rel, /shrinkResources true/);
  const pro = rd("android/app/proguard-rules.pro");
  assert.match(pro, /^-keep class com\.micartera\.app\.\*\* \{ \*; \}$/m, "WorkManager guarda los nombres de los workers");
  assert.match(pro, /@android\.webkit\.JavascriptInterface <methods>;/);
});

t("SEG-01: la clave pública del OTA es RSA-2048 PKCS#1 y nunca hay una privada en el repo", () => {
  const cfg = JSON.parse(rd("capacitor.config.json"));
  const pem = cfg.plugins.CapacitorUpdater.publicKey;
  assert.ok(pem.startsWith("-----BEGIN RSA PUBLIC KEY-----"), "el updater exige este encabezado (decryptFile)");
  const k = crypto.createPublicKey({ key: pem, format: "pem", type: "pkcs1" });
  assert.equal(k.asymmetricKeyDetails.modulusLength, 2048, "decryptChecksum espera 256 bytes");
  const tracked = spawnSync("git", ["grep", "-l", "-I", "-e", "PRIVATE KEY-----", "--", ".", ":!tests/apk-puente-seguro.test.mjs"], { cwd: root, encoding: "utf8" });
  const hits = tracked.stdout.split("\n").filter(Boolean).filter(f => !f.startsWith("node_modules/"));
  assert.deepEqual(hits, [], "una clave privada en el repo público");
});

t("UX-03: un splash por tema, con el mismo fondo que la web", () => {
  const shell = rd("src/shell.html");
  const temas = {};
  for (const m of shell.matchAll(/html\[data-theme="(\w+)"\]\{([^}]*)\}/g)) {
    const bg = m[2].match(/--bg:(#[0-9A-Fa-f]{6})/);
    if (bg && !temas[m[1]]) temas[m[1]] = bg[1].toUpperCase();
  }
  assert.deepEqual(Object.keys(temas).sort(), ["blue", "cyber", "dark", "green", "light"]);
  const colors = rd("android/app/src/main/res/values/colors.xml");
  const styles = rd("android/app/src/main/res/values/styles.xml");
  const main = rd("android/app/src/main/java/com/micartera/app/MainActivity.java");
  for (const [tema, bg] of Object.entries(temas)) {
    const c = colors.match(new RegExp('<color name="splash_bg_' + tema + '">(#[0-9A-Fa-f]{6})</color>'));
    assert.ok(c, "falta el color del tema " + tema);
    assert.equal(c[1].toUpperCase(), bg, "el splash de " + tema + " no es el fondo de la web");
    assert.ok(main.includes('"' + tema + '"'), "MainActivity no conoce el tema " + tema);
    if (tema === "green") continue;
    const nombre = tema[0].toUpperCase() + tema.slice(1);
    assert.match(styles, new RegExp('<style name="AppTheme\\.NoActionBarLaunch\\.' + nombre + '">[^]*?windowSplashScreenBackground">@color/splash_bg_' + tema + "<"));
  }
  assert.match(styles, /windowSplashScreenBackground">@color\/splash_bg_green</, "el de siempre es el verde de la web");
});

console.log(`apk-puente-seguro: ${n + 1} bloques OK`);
