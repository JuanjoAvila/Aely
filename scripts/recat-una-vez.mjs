#!/usr/bin/env node
/**
 * LAS FILAS QUE LLEVAN ESCRITA UNA CATEGORÍA QUE PUSO UN BUG NUESTRO.
 *
 * 12/9/2026. Rechazó `barcelona-no-es-un-viaje` diciendo que «Aigües de Barcelona» le seguía
 * saliendo como Viajes. El arreglo funcionaba: lo que veía era una fila SELLADA de antes. La
 * categoría se escribe cuando el movimiento entra y luego no se toca, a propósito, para no mover
 * totales de meses que él ya dio por cerrados.
 *
 * Esto NO es una recategorización. No corre en la app, no pasa por `migrate`, y no mira lo que le
 * "parece" mejor a nadie. Solo toca una fila cuando se cumplen LAS DOS condiciones:
 *
 *   1. su `cat` guardada es EXACTAMENTE la que daba la regla VIEJA para ese comercio, y
 *   2. la regla NUEVA dice otra cosa.
 *
 * O sea: solo deshace lo que escribió el bug. Si él le cambió la categoría a mano, la condición 1
 * no se cumple y la fila no se toca.
 *
 * Las dos reglas salen del MISMO fichero de la app en dos momentos distintos (`public/index.html`
 * de un commit contra el de ahora), cargadas con `load-pure-logic`. No hay ninguna copia de la
 * lógica escrita aquí: eso es justo lo que nos ha mordido ya dos veces.
 *
 * Uso:
 *   node scripts/recat-una-vez.mjs <commit-anterior-al-arreglo>            (ENSAYO: no escribe)
 *   node scripts/recat-una-vez.mjs <commit-anterior-al-arreglo> --aplica   (escribe)
 *
 *   p.ej.  node scripts/recat-una-vez.mjs 183dabef^
 *
 * ⚠ LA SALIDA LLEVA DATOS SUYOS (comercios e importes). Para mirarla y ya: no pegarla en el repo,
 * ni en un commit, ni en un issue. El repo es PÚBLICO.
 * ⚠ Necesita SUPABASE_SERVICE_ROLE_KEY en `.env.local`, que NUNCA se commitea.
 * ⚠ Escribe en la nube de PRODUCCIÓN, que es la de su familia. El ensayo es el modo por defecto
 *   justamente por eso: mira la lista ANTES de poner `--aplica`.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadPureLogic, loadPureLogicFromFile } from "./load-pure-logic.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PROJECT_REF = "sfyfjagbnhbplrljpbvh";
const BASE = `https://${PROJECT_REF}.supabase.co`;

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
const KEY = { ...loadEnvLocal(), ...process.env }.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error("Falta SUPABASE_SERVICE_ROLE_KEY en .env.local"); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

const ref = process.argv[2];
const APLICA = process.argv.includes("--aplica");
if (!ref || ref.startsWith("--")) {
  console.error("Uso: node scripts/recat-una-vez.mjs <commit-anterior-al-arreglo> [--aplica]");
  process.exit(1);
}

/* La app de ANTES del arreglo, sacada de git y cargada igual que la de ahora. */
let htmlViejo;
try {
  htmlViejo = execFileSync("git", ["show", `${ref}:public/index.html`], { cwd: root, maxBuffer: 64 * 1024 * 1024 }).toString("utf8");
} catch (e) {
  console.error(`No puedo leer public/index.html en «${ref}»: ${e.message}`);
  process.exit(1);
}
const viejo = loadPureLogic(htmlViejo);
const nuevo = loadPureLogicFromFile();

/* Aviso si las dos reglas son la misma: querría decir que el build no está al día. */
if (viejo.autoCategory("AIGUES DE BARCELONA") === nuevo.autoCategory("AIGUES DE BARCELONA") &&
    viejo.autoCategory("Transporte publico") === nuevo.autoCategory("Transporte publico")) {
  console.error(`⚠ La regla de «${ref}» y la de ahora dan lo mismo en los casos conocidos.`);
  console.error("   ¿Has hecho `npm run build` después de tocar los módulos? Aborto para no dar un falso «0 a corregir».");
  process.exit(1);
}

const res = await fetch(`${BASE}/rest/v1/expenses?select=id,fecha,comercio,ob_name,cat,importe,user_id&limit=50000`, { headers: H });
if (!res.ok) { console.error(`HTTP ${res.status}: ${await res.text()}`); process.exit(1); }
const rows = await res.json();

const plan = [];
for (const x of rows) {
  const m = x.comercio || x.ob_name || "";
  if (!m) continue;
  const antes = viejo.autoCategory(m);
  const ahora = nuevo.autoCategory(m);
  if (antes === ahora) continue;              // la regla no cambia para este comercio
  if ((x.cat || "") !== antes) continue;      // no lleva guardada la que puso el bug → no es nuestra
  plan.push({ id: x.id, fecha: String(x.fecha).slice(0, 10), m, de: antes, a: ahora, imp: x.importe, user: x.user_id });
}

console.log(`\n${rows.length} filas leídas · regla de «${ref}» contra la de ahora`);
console.log(`${plan.length} fila(s) llevan guardada la categoría que puso el bug\n`);
for (const p of plan) {
  console.log(`  ${p.fecha}  ${p.de.padEnd(10)} → ${p.a.padEnd(10)}  ${p.m}   (${p.imp})`);
}
if (!plan.length) { console.log("\nNada que hacer."); process.exit(0); }

if (!APLICA) {
  console.log("\n(ENSAYO — no se ha escrito nada. Añade `--aplica` para escribir.)");
  process.exit(0);
}

/* El antes/después a fichero, para poder deshacerlo sin depender de esta pantalla. */
const backup = path.join(os.tmpdir(), `recat-una-vez-${Date.now()}.json`);
fs.writeFileSync(backup, JSON.stringify(plan, null, 2));
console.log(`\nCopia del antes/después en:\n  ${backup}`);
console.log("\nESCRIBIENDO…");
let ok = 0, mal = 0;
for (const p of plan) {
  const r = await fetch(`${BASE}/rest/v1/expenses?id=eq.${encodeURIComponent(p.id)}`, {
    method: "PATCH", headers: { ...H, Prefer: "return=representation" }, body: JSON.stringify({ cat: p.a }),
  });
  const txt = await r.text();
  if (r.ok) { ok++; console.log(`  ✓ ${p.de} → ${p.a}   ${p.m}`); }
  else { mal++; console.log(`  ✗ HTTP ${r.status}  ${p.m}\n      ${txt}`); }
}
console.log(`\n${ok} escrita(s)${mal ? ` · ${mal} fallida(s)` : ""}`);
if (mal) process.exit(1);
