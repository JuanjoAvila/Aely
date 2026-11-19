/**
 * GRANTS DE LAS MIGRACIONES CONTRA LO QUE PIDE EL CLIENTE (14/9/2026, OPS-06, 0024).
 *
 * En la BD viva faltaba el grant de `device_id` de la 0012 («las dos 0012»): el cliente lo pedía,
 * la BD daba 42501, `myinvestorStatus` se lo tragaba y la sync de MyInvestor no corría nunca.
 * Ningún test lo veía porque nadie cruzaba el SELECT del cliente con los grants por columna.
 *  1. Dos migraciones con el mismo número no pueden volver a convivir.
 *  2. Cada columna que el cliente lee de `myinvestor_links` está en algún `grant select (…)`.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const migDir = path.join(root, "supabase", "migrations");

function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}`); throw e; }
}

console.log("grants-migraciones");

const files = fs.readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort();

t("no hay dos migraciones con el mismo número", () => {
  const por = {};
  for (const f of files) { const n = f.split("_")[0]; (por[n] = por[n] || []).push(f); }
  const dup = Object.entries(por).filter(([, v]) => v.length > 1);
  assert.deepEqual(dup, [], "números repetidos: " + JSON.stringify(dup));
});

t("las columnas que lee myinvestorStatus tienen grant para authenticated", () => {
  const core = fs.readFileSync(path.join(root, "src", "modules", "00-core.js"), "utf8");
  const m = /from\('myinvestor_links'\)\.select\('([^']+)'\)/.exec(core);
  assert.ok(m, "no encuentro el select de myinvestor_links en 00-core.js");
  const pide = m[1].split(",").map((s) => s.trim());
  const concedidas = new Set();
  const re = /grant\s+select\s*\(([^)]+)\)\s*on\s+table\s+public\.myinvestor_links\s+to\s+authenticated/gi;
  for (const f of files) {
    const sql = fs.readFileSync(path.join(migDir, f), "utf8");
    let g; while ((g = re.exec(sql))) g[1].split(",").forEach((c) => concedidas.add(c.trim()));
  }
  const faltan = pide.filter((c) => !concedidas.has(c));
  assert.deepEqual(faltan, [], "el cliente pide columnas sin grant: " + faltan.join(","));
});

t("la 0024 reparte el grant de device_id (la BD viva no lo tenía)", () => {
  const sql = fs.readFileSync(path.join(migDir, "0024_grants_reparar.sql"), "utf8");
  assert.match(sql, /grant select \([^)]*device_id[^)]*\)\s*on table public\.myinvestor_links to authenticated/);
  assert.match(sql, /revoke references, trigger, truncate on all tables in schema public from anon, authenticated/);
  assert.match(sql, /revoke execute on function public\.handle_new_user\(\) from public, anon, authenticated/);
});

t("la 0027 quita a anon las funciones SECURITY DEFINER de Hogar", () => {
  const sql = fs.readFileSync(path.join(migDir, "0027_hogar_funciones_sin_anon.sql"), "utf8");
  assert.match(sql, /revoke execute on function public\.join_household_by_code\(text\) from anon;/);
  assert.match(sql, /revoke execute on function public\.is_household_member\(uuid\) from anon;/);
  // Quitar también a authenticated rompería Hogar entero: las políticas llaman a is_household_member.
  const sentencias = sql.split(/\r?\n/).filter((l) => !l.startsWith("--")).join("\n");
  assert.doesNotMatch(sentencias, /authenticated/);
});

/* 0031 (brókers por API): el cliente lee su estado y NADA de la credencial. Si un día se añade
   `cred_a` al select, o un grant la expone, un XSS con la sesión leería la clave de Kraken. */
t("broker_links: el cliente lee solo columnas concedidas y nunca cred_* ni el nonce", () => {
  const core = fs.readFileSync(path.join(root, "src", "modules", "00-core.js"), "utf8");
  const m = /from\('broker_links'\)\.select\('([^']+)'\)/.exec(core);
  assert.ok(m, "no encuentro el select de broker_links en 00-core.js");
  const pide = m[1].split(",").map((s) => s.trim());
  const sql = fs.readFileSync(path.join(migDir, "0031_broker_links.sql"), "utf8");
  const g = /grant select \(([^)]+)\)\s*on table public\.broker_links to authenticated/.exec(sql);
  assert.ok(g, "falta el grant por columnas");
  const concedidas = g[1].split(",").map((c) => c.trim());
  assert.deepEqual(pide.filter((c) => !concedidas.includes(c)), []);
  for (const prohibida of ["cred_a", "cred_b", "nonce", "connection_version"]) {
    assert.ok(!concedidas.includes(prohibida) && !pide.includes(prohibida), prohibida);
  }
  assert.match(sql, /revoke all on table public\.broker_links from anon, authenticated;/);
  assert.match(sql, /revoke execute on function public\.broker_next_nonce\(uuid, text\) from public, anon, authenticated;/);
  assert.match(sql, /enable row level security/);
});

console.log("  ok");
