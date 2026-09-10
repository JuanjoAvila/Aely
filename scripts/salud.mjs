#!/usr/bin/env node
/**
 * `npm run salud` — el parte del estado real del proyecto, en veinte segundos.
 *
 * POR QUÉ ES UN SCRIPT Y NO UNA PANTALLA (decidido en la review del 2026-07-26): con tres
 * usuarios, una pantalla de «estado del sistema» es un producto más que mantener, con su UI, sus
 * traducciones y sus fallos. El precedente bueno es `scripts/errores.mjs`: se lanza desde la
 * consola cuando hace falta y no le cuesta nada a nadie el resto del tiempo.
 *
 * QUÉ CONTESTA, que son las preguntas que de verdad se hacen al empezar una sesión:
 *   · ¿están alineados VERSION, package.json, apk.json y el build.gradle?
 *   · ¿qué sirve producción AHORA MISMO? (no lo que dice el repo: lo que responde Pages)
 *   · ¿va la beta por delante o por detrás de producción?
 *   · ¿hay migraciones en el repo sin aplicar?
 *   · ¿cuántos errores han llegado en 24 h y en 7 días?
 *
 * Lo que necesita red lo dice y sigue: un parte a medias vale más que un script que revienta
 * porque no hay wifi. Los recuentos de `app_events` solo salen con las claves de Supabase
 * puestas (las mismas que usa `scripts/errores.mjs`); sin ellas, se saltan.
 *
 *   node scripts/salud.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const leer = (p) => fs.readFileSync(path.join(root, p), "utf8");
const PAGES = "https://juanjoavila.github.io/Mi-Cartera/";

let avisos = 0;
const ok = (t) => console.log(`  ✓ ${t}`);
const mal = (t) => { avisos++; console.log(`  ✗ ${t}`); };
const info = (t) => console.log(`  · ${t}`);

const json = async (url) => {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(url + "?ts=" + Date.now(), { signal: ctrl.signal, cache: "no-store" });
    return r.ok ? await r.json() : null;
  } catch { return null; } finally { clearTimeout(id); }
};
const git = (...args) => { try { return execFileSync("git", args, { cwd: root }).toString().trim(); } catch { return ""; } };

console.log("\n🩺  SALUD DE MI CARTERA\n");

/* ---------- 1. Los números del repo cuadran entre sí ---------- */
console.log("Versiones en el repo");
const VERSION = leer("VERSION").trim();
const pkg = JSON.parse(leer("package.json"));
const apk = JSON.parse(leer("public/apk.json"));
const gradle = leer("android/app/build.gradle");
const gName = (gradle.match(/versionName\s+"([^"]+)"/) || [])[1] || "?";
const gCode = (gradle.match(/versionCode\s+(\d+)/) || [])[1] || "?";

info(`VERSION ${VERSION} · package.json ${pkg.version} · apk.json ${apk.versionName} (${apk.versionCode}) · gradle ${gName} (${gCode})`);
pkg.version === VERSION ? ok("package.json cuadra con VERSION") : mal(`package.json dice ${pkg.version} y VERSION dice ${VERSION}`);
apk.versionName === gName ? ok("apk.json cuadra con build.gradle") : mal(`apk.json dice ${apk.versionName} y build.gradle ${gName}`);
String(apk.versionCode) === gCode ? ok("el versionCode cuadra") : mal(`versionCode: apk.json ${apk.versionCode}, gradle ${gCode}`);
// Que la APK anunciada exista de verdad. Ofrecer una descarga que da 404 se ve en el móvil como
// «no pasa nada» — mudo, que es la peor forma de fallar (pasó con la 4.11.0).
const apkSt = await (async () => {
  try { const r = await fetch(apk.url, { method: "HEAD", redirect: "follow" }); return r.status; } catch { return 0; }
})();
apkSt === 0 ? info("no he podido comprobar la URL de la APK (¿sin red?)")
  : apkSt === 404 ? mal(`apk.json apunta a una release que NO existe (404): ${apk.url}`)
  : ok(`la APK anunciada existe (HTTP ${apkSt})`);

/* ---------- 2. Qué sirve producción de verdad ---------- */
console.log("\nProducción (lo que responde Pages, no lo que dice el repo)");
const live = await json(PAGES + "version.json");
if (!live) info("no he podido preguntar a Pages (¿sin red?)");
else if (live.version === VERSION) ok(`producción sirve ${live.version} · igual que este árbol`);
else info(`producción sirve ${live.version} · aquí hay ${VERSION}`);
const liveApk = await json(PAGES + "apk.json");
if (liveApk) info(`producción anuncia la APK ${liveApk.versionName} (${liveApk.versionCode})`);

/* ---------- 3. El canal beta ---------- */
console.log("\nCanal beta");
const beta = await json("https://github.com/JuanjoAvila/Mi-Cartera/releases/download/beta/version.json");
if (!beta) info("la release `beta` no responde o no tiene version.json todavía");
else {
  const base = String(beta.version).split(".").slice(0, 3).join(".");
  info(`la beta publicada es ${beta.version}`);
  if (live && base === live.version) ok("la beta ya está en producción · no hay nada pendiente de aprobar");
  else if (live) info(`la beta (${base}) va por delante de producción (${live.version}) · pendiente de su veredicto`);
}
/* ¿SE PUEDE SUBIR ESTA RONDA POR TANDAS, O SOLO ENTERA? (2026-08-01)
   Declarar `tandas` en las notas parte la checklist de su móvil, pero NO crea ninguna rama — y el
   workflow de promoción mergea `tanda/<id>`. Si las tandas se han commiteado mezcladas en `beta`
   (le pasó en la 4.13.0), pedir `-f tandas=import` PARA en seco... después de que él haya
   aprobado, que es el peor momento para enterarse. Esto lo dice antes, y aquí, que es donde se
   mira el estado. La regla completa, en docs/TESTING.md. */
git("fetch", "origin", "+refs/heads/beta:refs/remotes/origin/beta", "main", "+refs/heads/tanda/*:refs/remotes/origin/tanda/*");
try {
  const idx = fs.readFileSync("src/modules/10-app-components.js", "utf8");
  const bloque = idx.slice(idx.indexOf("var RELEASE_NOTES=["));
  const decl = [...bloque.slice(0, bloque.indexOf("items:{")).matchAll(/\{id:"([a-z0-9_-]+)"/g)].map((m) => m[1]);
  if (decl.length > 1) {
    const ramas = (git("branch", "-r", "--list", "origin/tanda/*") || "").split("\n").filter(Boolean)
      .map((l) => l.trim().replace("origin/tanda/", ""));
    const faltan = decl.filter((d) => !ramas.includes(d));
    if (!faltan.length) ok(`las ${decl.length} tandas tienen su rama · se pueden subir por separado`);
    else {
      info(`esta ronda declara ${decl.length} tandas (${decl.join(", ")}) y NO todas tienen rama \`tanda/<id>\``);
      info(`   sin rama: ${faltan.join(", ")} → esta ronda solo se puede subir ENTERA (\`tandas\` vacío)`);
      info(`   para trocear la SIGUIENTE: \`git switch -c tanda/<id> main\` antes del primer commit`);
    }
  }
} catch (e) { /* si las notas cambian de forma, esto informa de menos, nunca rompe la salud */ }
const pend = git("log", "refs/remotes/origin/main..refs/remotes/origin/beta", "--oneline");
if (pend) {
  info(`commits en \`beta\` que \`main\` no tiene:`);
  pend.split("\n").forEach((l) => console.log(`      ${l}`));
  /* PARA COPIAR DIRECTO AL WORKFLOW (2026-08-01): «Promocionar beta a producción» acepta un
     parche por commits sueltos (`commits`, cherry-pick) cuando una ronda no se puede trocear por
     tandas. La lista de arriba ya tiene los hashes; esto solo recuerda el orden (del más VIEJO al
     más nuevo, que es como hay que pegarlos) y dónde se pega. */
  const hashes = pend.split("\n").map((l) => l.split(" ")[0]).reverse().join(",");
  info(`   para un parche urgente con solo alguno de estos: Actions → «Promocionar beta a producción»`);
  info(`   → \`commits\`: ${hashes}  (quita los que no quieras, del más viejo al más nuevo)`);
} else info("`beta` y `main` están al día");

/* ---------- 4. Migraciones ---------- */
console.log("\nBase de datos");
const migDir = path.join(root, "supabase", "migrations");
const migs = fs.existsSync(migDir) ? fs.readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort() : [];
info(`${migs.length} migraciones en el repo · la última es ${migs[migs.length - 1] || "—"}`);
// No se puede saber desde aquí cuáles están APLICADAS sin credenciales de la BD; decirlo es más
// honesto que inventarse un ✓ (AGENTS: si un dato no lo sabes, no te lo inventes).
info("cuáles están aplicadas solo lo sabe Supabase · míralo en su panel → Database → Migrations");

/* ---------- 4-bis. ¿El servidor corre lo que dice el repo? ----------
   Puesto aquí el 10/9/2026, después de perder una mañana buscando en el código un descuadre del
   widget que no estaba en el código: `ingest` llevaba 24 días sin desplegar. Hasta hoy, `salud`
   contaba lo que hay en el repo y lo que sirve Pages, pero de las Edge Functions no decía nada —
   y ahí es donde vive la mitad de las cuentas de su dinero. */
console.log("\nServidor (Edge Functions)");
try {
  const r = spawnSync(process.execPath, [path.join(root, "scripts", "servidor-al-dia.mjs")], { encoding: "utf8" });
  const salida = String(r.stdout || "").trim();
  if (salida) salida.split("\n").forEach((l) => console.log("  " + l));
  if (r.status === 1) avisos++;
} catch (e) {
  info("no se pudo comprobar (" + ((e && e.message) || e) + ")");
}

/* ---------- 5. Errores recientes ---------- */
console.log("\nErrores de los móviles (app_events)");
const URL_SB = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
if (!URL_SB || !KEY) info("sin SUPABASE_URL/SUPABASE_SERVICE_KEY puestas · se salta (igual que scripts/errores.mjs)");
else {
  for (const [etiqueta, horas] of [["24 h", 24], ["7 días", 168]]) {
    const desde = new Date(Date.now() - horas * 3600e3).toISOString();
    const r = await (async () => {
      try {
        const res = await fetch(`${URL_SB}/rest/v1/app_events?select=kind&created_at=gte.${desde}`,
          { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
        return res.ok ? await res.json() : null;
      } catch { return null; }
    })();
    if (!r) { info(`no he podido leer los eventos de ${etiqueta}`); continue; }
    const n = (k) => r.filter((e) => e.kind === k).length;
    const err = n("error");
    const linea = `${etiqueta}: ${r.length} eventos · ${err} error(es) · ${n("feedback")} sugerencia(s) · ${n("use")} de uso`;
    err > 0 ? mal(linea) : ok(linea);
  }
}

console.log(avisos ? `\n⚠  ${avisos} cosa(s) que mirar.\n` : "\n✅ Todo en orden.\n");
process.exit(0);   // informa, no bloquea: esto no es un test, es un parte
