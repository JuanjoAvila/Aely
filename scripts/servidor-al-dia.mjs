#!/usr/bin/env node
/**
 * ¿EL SERVIDOR CORRE LO QUE DICE EL REPO?
 *
 * Nace del 10 de septiembre de 2026 y de una cifra suya: el widget puso 475 € y la app 460 €.
 * Estuvimos un buen rato buscando el bug en el código, y no había bug: cargando LAS DOS
 * implementaciones —cliente y servidor— sobre el mismo escenario, daban el mismo número. Lo que
 * pasaba es que **el servidor desplegado no era ese código**. `ingest` llevaba desde el 17 de
 * agosto sin desplegar, así que le faltaban el `#dup` (posible repetido) y la ventana de mes
 * compartida, los dos de principios de septiembre.
 *
 * ⚠ Y esto NO lo podía cazar `presupuesto-servidor.test.mjs`, que es nuestro guardián de espejos:
 * ese carga el fichero DEL REPO y lo compara con el cliente DEL REPO. Compara lo que escribimos
 * con lo que escribimos. Puede estar verde para siempre mientras la familia usa código de hace un
 * mes. De ahí este script: es el único que mira hacia AFUERA.
 *
 * Qué hace: por cada función Edge, compara la fecha de su último despliegue con la fecha del
 * último commit que tocó su código (incluido `_shared/`, que lo comparten casi todas). Si el repo
 * va por delante, lo dice y con qué commits.
 *
 * Necesita `SUPABASE_ACCESS_TOKEN` en `.env.local` (basta de SOLO LECTURA). Sin él no falla: avisa
 * y se salta, igual que hacen `salud` y `errores` con las credenciales que no están.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const REF = process.env.SUPABASE_PROJECT_REF || "sfyfjagbnhbplrljpbvh";
const DIR = path.join(raiz, "supabase", "functions");
const COMPARTIDO = "supabase/functions/_shared";

function env() {
  const f = path.join(raiz, ".env.local");
  if (!fs.existsSync(f)) return {};
  const out = {};
  for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    if (!l.trim() || l.trim().startsWith("#")) continue;
    const i = l.indexOf("=");
    if (i > 0) out[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  }
  return out;
}

/** Fecha (ms) del último commit que tocó una ruta. 0 si no hay ninguno. */
function ultimoCommit(ruta) {
  try {
    const s = execFileSync("git", ["log", "-1", "--format=%ct", "--", ruta], { cwd: raiz, encoding: "utf8" }).trim();
    return s ? Number(s) * 1000 : 0;
  } catch { return 0; }
}
function commitsDesde(ruta, desdeMs) {
  try {
    const s = execFileSync("git", ["log", "--since=" + new Date(desdeMs).toISOString(), "--format=%h %s", "--", ruta],
      { cwd: raiz, encoding: "utf8" }).trim();
    return s ? s.split("\n") : [];
  } catch { return []; }
}

const fecha = (ms) => new Date(ms).toISOString().slice(0, 16).replace("T", " ");
const dias = (ms) => Math.floor((Date.now() - ms) / 86400000);

const TOK = env().SUPABASE_ACCESS_TOKEN;
if (!TOK) {
  console.log("· sin SUPABASE_ACCESS_TOKEN en .env.local · se salta (hace falta uno de solo lectura)");
  process.exit(0);
}

let fns;
try {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/functions`, { headers: { Authorization: "Bearer " + TOK } });
  if (!r.ok) {
    // Un token caducado o sin permiso NO puede tumbar la suite entera: se dice y se sigue.
    console.log(`· la API de Supabase respondió ${r.status} · se salta (¿token caducado o sin permiso de Edge Functions?)`);
    process.exit(0);
  }
  fns = await r.json();
} catch (e) {
  console.log("· no se pudo preguntar a Supabase (" + ((e && e.message) || e) + ") · se salta");
  process.exit(0);
}

const compartidoMs = ultimoCommit(COMPARTIDO);
const atrasadas = [];
console.log(`servidor-al-dia · ${fns.length} funciones en el proyecto`);

for (const f of fns.sort((a, b) => a.name.localeCompare(b.name))) {
  const desplegadaMs = Number(f.updated_at);
  const propioMs = ultimoCommit(`supabase/functions/${f.name}`);
  // Casi todas importan de `_shared`: un cambio ahí también las deja desfasadas aunque su propio
  // fichero no se haya tocado. Ese fue justo el caso del `#dup`.
  const repoMs = Math.max(propioMs, compartidoMs);
  if (repoMs > desplegadaMs) {
    atrasadas.push({ name: f.name, desplegadaMs, repoMs, propio: propioMs > desplegadaMs });
  }
}

if (!atrasadas.length) {
  console.log("✓ todas las funciones desplegadas son iguales o más nuevas que el repo");
  process.exit(0);
}

/* Los commits de `_shared` salen UNA vez arriba y no repetidos en cada función: casi todas lo
   importan, así que repetirlos trece veces convierte el aviso en una pared que nadie lee — y un
   aviso que no se lee es como no tenerlo, que es de lo que va este script. */
console.log(`\n⚠ ${atrasadas.length} de ${fns.length} función(es) con el repo POR DELANTE de lo desplegado.\n`);
const masViejo = Math.min(...atrasadas.map((a) => a.desplegadaMs));
const compartidos = commitsDesde(COMPARTIDO, masViejo);
if (compartidos.length) {
  console.log(`  Código COMPARTIDO (${COMPARTIDO}) sin desplegar — afecta a casi todas:`);
  compartidos.slice(0, 8).forEach((c) => console.log(`    · ${c}`));
  if (compartidos.length > 8) console.log(`    · … y ${compartidos.length - 8} más`);
  console.log("");
}
console.log("  función".padEnd(26) + "desplegada".padEnd(20) + "atraso");
for (const a of atrasadas) {
  console.log("  " + a.name.padEnd(24) + fecha(a.desplegadaMs).padEnd(20) + dias(a.desplegadaMs) + " días");
  // Y aquí sí, solo lo SUYO: lo que cambió en su propia carpeta y nadie subió.
  commitsDesde(`supabase/functions/${a.name}`, a.desplegadaMs).slice(0, 3)
    .forEach((c) => console.log(`      propio, sin desplegar: ${c}`));
}
console.log(`
  Esto NO es un fallo del código: es código escrito que no corre en ningún sitio. Mientras siga
  así, un test de espejos cliente/servidor puede estar verde y la familia ver otra cifra.
  Desplegar toca PRODUCCIÓN: requiere OK del dueño (docs/RELEASE.md).`);
process.exit(1);
