#!/usr/bin/env node
/**
 * ¿QUÉ HA APROBADO Y QUÉ PUEDE SUBIR A PRODUCCIÓN? — `npm run listo`
 *
 * Petición suya, 2026-09-08: «quiero que vaya el flujo yo probando todo el rato y si apruebo,
 * para producción». Hasta ahora sus veredictos vivían en `app_events` y había que leerlos a
 * ojo, cruzarlos a mano con las tandas de la versión y adivinar qué se podía promocionar. Eso
 * es justo donde se cuelan los errores: se sube algo que él rechazó, o se le deja meses en beta
 * algo que aprobó el primer día.
 *
 * Esto NO promociona nada: solo LEE y dice la verdad. La promoción sigue siendo un clic suyo en
 * Actions → «Promocionar beta a producción», que es donde tiene que estar (ver AGENTS §9: no
 * metemos un token de escritura de GitHub en la app para ahorrar un clic).
 *
 * CÓMO SE SUBE UNA TANDA SUELTA, que es lo que él quiere:
 *   El workflow ya sabe hacerlo, pero SOLO si esa tanda vive en su propia rama `tanda/<id>`.
 *   Si la ronda se commiteó mezclada en `beta` no se puede trocear, y el propio workflow lo dice
 *   y se niega en vez de subir algo a medias. Por eso este script comprueba la rama y no se
 *   limita a mirar el veredicto: un «aprobada» sin rama es un «aprobada que NO se puede subir
 *   sola», y más vale saberlo antes que descubrirlo con producción a medio promocionar.
 *
 * Uso:
 *   npm run listo
 *   node scripts/listo-para-produccion.mjs --json
 *   node scripts/listo-para-produccion.mjs --limit=200
 *
 * Solo lectura, igual que `errores.mjs`: ni un insert, ni un update, ni un push.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadPureLogicFromFile } from "./load-pure-logic.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PROJECT_REF = "sfyfjagbnhbplrljpbvh";
const BASE = `https://${PROJECT_REF}.supabase.co`;

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const val = (n, d) => {
  const a = args.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : d;
};

/* ---- Clave: misma fuente que errores.mjs (.env.local, gitignored) ---- */
function loadEnvLocal() {
  const f = path.join(root, ".env.local");
  if (!fs.existsSync(f)) return {};
  const out = {};
  for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}
const env = Object.assign({}, process.env, loadEnvLocal());
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY || "";
if (!KEY) {
  console.error("Falta SUPABASE_SERVICE_ROLE_KEY en .env.local — sin eso no se pueden leer sus veredictos.");
  process.exit(1);
}

/* La service_role ve eventos de todos: la huella no acredita quién dio el OK (1/10).
   Dev usa profiles.is_admin. Sin un único titular verificable no elegimos entre cuentas. */
async function reviewerAutorizado() {
  const q = new URLSearchParams({ select:"user_id,is_admin", is_admin:"eq.true", limit:"2" });
  const r = await fetch(`${BASE}/rest/v1/profiles?${q}`, {
    headers: { apikey:KEY, Authorization:`Bearer ${KEY}`, Prefer:"count=exact" },
  });
  if (!r.ok) throw new Error("no se pudo consultar el rol Dev");
  const profiles = await r.json();
  // El total evita escoger la primera fila si el servidor recorta la respuesta.
  if (!Array.isArray(profiles) || profiles.length !== 1 || r.headers.get("content-range") !== "0-0/1")
    throw new Error("se necesita exactamente un perfil administrador acreditado");
  const p = profiles[0];
  if (!p || p.is_admin !== true || typeof p.user_id !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(p.user_id))
    throw new Error("el perfil administrador no contiene una identidad válida");
  return p.user_id.toLowerCase();
}
let reviewer;
try { reviewer = await reviewerAutorizado(); }
catch {
  const motivo = "Identidad autorizada indeterminada: no se acredita un único perfil Dev válido. No se evalúan veredictos.";
  if (flag("json")) console.log(JSON.stringify({ veredictos:"indeterminado", motivo, tandas:[] }, null, 2));
  console.error(motivo);
  process.exit(2);
}

const git = (a) => {
  try { return execFileSync("git", a, { cwd: root, encoding: "utf8" }).trim(); }
  catch { return null; }
};

/* ---- Las tandas que su móvil tiene delante ahora mismo ---- */
/* La versión que TIENE SU MÓVIL, no la del working tree. El fichero `VERSION` es lo que estamos
   preparando aquí; si se usa esa, el panel enseña tandas que él todavía no ha recibido y la
   cuenta de «te falta probar N» sale inflada — me pasó al integrar la 4.19.10 (2026-09-08).
   Misma regla que `npm run salud`: lo que responde el canal manda sobre lo que dice el repo. */
const VERSION_REPO = fs.readFileSync(path.join(root, "VERSION"), "utf8").trim();
async function versionDelCanalBeta() {
  try {
    const r = await fetch("https://github.com/JuanjoAvila/Aely/releases/download/beta/version.json", { redirect: "follow" });
    if (r.ok) { const j = await r.json(); if (j && j.version) return String(j.version); }
  } catch { /* sin red */ }
  return null;
}
const VERSION_CANAL = await versionDelCanalBeta();
const VERSION = VERSION_CANAL || VERSION_REPO;
const prodVersion = (function () {
  // Lo que responde Pages, no lo que dice el repo. Si no hay red, se avisa y se sigue.
  return val("prod", null);
})();

const cli = loadPureLogicFromFile();
async function versionDeProduccion() {
  if (prodVersion) return prodVersion;
  try {
    const r = await fetch("https://juanjoavila.github.io/Aely/version.json", { redirect: "follow" });
    if (r.ok) { const j = await r.json(); if (j && j.version) return String(j.version); }
  } catch { /* sin red: se sigue sin ronda */ }
  return null;
}
const prod = await versionDeProduccion();
// La APK estable decide si una tanda nativa ya se entregó (misma regla que el panel).
async function apkDeProduccion() {
  try {
    const r = await fetch("https://juanjoavila.github.io/Aely/apk.json", { redirect: "follow" });
    if (r.ok) { const j = await r.json(); cli.window._mcProdApkRevisiones=j&&j.revisiones||null; if (j && j.versionCode > 0) return Number(j.versionCode); }
  } catch { /* sin red: las tandas nativas siguen pendientes */ }
  return null;
}
const prodApk = await apkDeProduccion();
try {
  const r = await fetch("https://juanjoavila.github.io/Aely/beta-delivery.json", { redirect: "follow" });
  cli.window._mcProdEntregas = r.ok ? await r.json() : null;
} catch { cli.window._mcProdEntregas = null; }
if(cli.window._mcProdEntregas&&!cli.window._mcProdEntregas.pruebas){
  try{
    const r=await fetch("https://juanjoavila.github.io/Aely/release-notes.json",{redirect:"follow"});
    if(r.ok) cli.window._mcProdEntregas=cli.betaPruebasEntrega(cli.window._mcProdEntregas,await r.json(),prod);
  }catch{ /* sin guion comprobado se conserva la entrega desconocida */ }
}
const pack = cli.betaChecklist(VERSION, prod || "", prodApk);
const tandas = pack.tandas || [];

/* ---- Sus veredictos: el ÚLTIMO de cada tanda manda ---- */
const qs = new URLSearchParams();
qs.set("select", "user_id,created_at,kind,app_version,message,detail");
qs.set("kind", "eq.beta");
qs.set("user_id", "eq." + reviewer);
qs.set("order", "created_at.desc");
qs.set("limit", val("limit", "200"));
const res = await fetch(`${BASE}/rest/v1/app_events?${qs}`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
});
if (!res.ok) {
  console.error(`Supabase respondió ${res.status} ${res.statusText}`);
  process.exit(1);
}
const rows = await res.json();

// `detail` puede venir como objeto o como texto. La lista va de nuevo a viejo y `betaVerdictFor`
// se queda con el primero que aplica a la revisión actual (huella, id o alias `desde`).
const partes = [];
for (const r of rows) {
  // Defensa local además del filtro remoto; no aceptar un parte ajeno ni sin autor.
  if (!r || typeof r.user_id !== "string" || r.user_id.toLowerCase() !== reviewer) continue;
  let d = r.detail;
  if (typeof d === "string") { try { d = JSON.parse(d); } catch { d = null; } }
  // Un null explícito retira el OK anterior; no equivale a un parte sin decisión válida.
  if (!d || !d.tanda || !Object.hasOwn(d,"verdict")) continue;
  if (d.verdict !== null && !["approved","rejected","revoked"].includes(d.verdict)) continue;
  partes.push({
    tanda: d.tanda,
    huella: d.huella || null,
    verdict: d.verdict,
    version: d.version || r.app_version || "",
    cuando: r.created_at,
    fallos: Number(d.fallos) || 0,
  });
}

/* ---- ¿Se puede subir esa tanda SOLA? Solo si tiene su rama ---- */
const ramas = new Set(
  (git(["branch", "-r", "--list", "origin/tanda/*", "--format=%(refname:lstrip=4)"]) || "")
    .split("\n").map((s) => s.trim()).filter(Boolean)
);
// El id del panel lleva la versión delante (`4.19.0/tr-reactivo`); la rama va sin ella.
const idCorto = (id) => String(id).indexOf("/") >= 0 ? String(id).split("/").slice(1).join("/") : String(id);

const filas = tandas.map((g) => {
  const v = cli.betaVerdictFor(g, partes);
  const corto = idCorto(g.id);
  // Historia exacta declarada en notas: mostrar el rechazo previo no lo aplica a otra revisión
  // ni convierte un código corregido en aprobado. Nunca se casan partes por sufijo.
  const idsHistoricos = [g.id].concat(g.historial || [], cli.RELEASE_NOTES.flatMap(n => (n.tandas || []).filter(x => x.id === corto).map(x => n.v + "/" + x.id)));
  const rechazoAnterior = partes.find(p => p.verdict === "rejected" && idsHistoricos.includes(p.tanda));
  return {
    id: g.id,
    corto,
    titulo: g.t || "",
    estado: v ? v.verdict : "sin probar",
    cuando: v ? v.cuando : null,
    version: v ? v.version : null,
    heredado: v && v.tanda !== g.id ? v.tanda : null,
    apk: g.apk || null,
    entregaPendiente: cli.betaSinEntregar(g, prodApk),
    superficies: [g.native ? "APK" : null, g.edge ? "Edge" : null].filter(Boolean),
    rechazoAnterior: rechazoAnterior ? { tanda:rechazoAnterior.tanda, cuando:rechazoAnterior.cuando, version:rechazoAnterior.version } : null,
    rama: ramas.has(corto) ? `tanda/${corto}` : null,
  };
});

if (flag("json")) {
  console.log(JSON.stringify({ version: VERSION, produccion: prod, apkProduccion: prodApk, tandas: filas }, null, 2));
  process.exit(0);
}

const ico = { approved: "✅", rejected: "⛔", "sin probar": "⬜" };
console.log("\n📦  LISTO PARA PRODUCCIÓN\n");
console.log(`  en su móvil ${VERSION_CANAL || VERSION_REPO + " (del repo: sin red para leer el canal)"} · producción ${prod || "(sin red)"} · APK estable ${prodApk || "(sin red)"}`);
if (VERSION_CANAL && VERSION_CANAL.indexOf(VERSION_REPO) !== 0) {
  console.log(`  ⚠ aquí hay ${VERSION_REPO} sin publicar: sus tandas todavía no le han llegado.`);
}
console.log("");

if (!filas.length) {
  console.log("  No hay ninguna tanda pendiente de revisar. Nada que promocionar por tandas.\n");
  process.exit(0);
}

for (const f of filas) {
  const cuando = f.cuando ? new Date(f.cuando).toLocaleString("es-ES", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  console.log(`  ${ico[f.estado] || "·"} ${f.titulo || f.id}`);
  console.log(`      ${f.id}${cuando ? "  ·  " + cuando : ""}${f.version ? "  ·  probada en " + f.version : ""}`);
  if (f.heredado) console.log(`      ↳ veredicto de ${f.heredado}, mismo contenido`);
  if (f.estado === "sin probar" && f.rechazoAnterior) console.log(`      ⛔ rechazo histórico de ${f.rechazoAnterior.tanda}; esta revisión requiere veredicto nuevo`);
  if (f.entregaPendiente && f.estado === "approved") console.log(`      ⏳ aprobada, pendiente de entrega exacta${f.superficies.length ? ": " + f.superficies.join(" + ") : " web"}`);
  if (f.estado === "approved") {
    console.log(f.superficies.length ? `      ⚠ requiere entrega acreditada de ${f.superficies.join(" y ")}; la rama web no entrega esas superficies` : f.rama
      ? `      ↑ se puede subir sola:  rama ${f.rama}`
      : `      ⚠ aprobada pero SIN rama propia: no se puede subir sola (está mezclada en beta)`);
  }
}

const aprobadas = filas.filter((f) => f.estado === "approved");
const conRama = aprobadas.filter((f) => f.rama && !f.superficies.length);
const sinRama = aprobadas.filter((f) => !f.rama);
const pendientes = filas.filter((f) => f.estado !== "approved");

console.log("\n  ─────────────────────────────────────────");
console.log(`  ${aprobadas.length} aprobada(s) · ${filas.filter((f) => f.estado === "rejected").length} rechazada(s) · ${filas.filter((f) => f.estado === "sin probar").length} sin probar\n`);

if (conRama.length) {
  console.log("  PUEDES SUBIR YA, sin esperar al resto:");
  console.log("    Actions → «Promocionar beta a producción» → confirmar SUBIR");
  console.log(`    tandas: ${conRama.map((f) => f.corto).join(",")}\n`);
}
if (sinRama.length) {
  console.log("  APROBADAS QUE NO SE PUEDEN TROCEAR (se commitearon mezcladas en beta):");
  sinRama.forEach((f) => console.log(`    · ${f.corto}`));
  console.log("    Suben cuando suba la ronda entera, o sea cuando no quede nada pendiente.\n");
}
if (!pendientes.length && !filas.some(f => f.superficies.length)) {
  console.log("  ✔ NO QUEDA NADA PENDIENTE: la ronda entera está aprobada.");
  console.log("    Actions → «Promocionar beta a producción», deja «tandas» vacío y confirma SUBIR.\n");
} else {
  console.log(`  Falta que pruebes ${pendientes.length}: ${pendientes.map((f) => f.corto).join(", ")}\n`);
}
