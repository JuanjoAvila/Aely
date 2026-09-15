#!/usr/bin/env node
/**
 * Invariantes de seguridad que NO se ven leyendo un diff, y que si se rompen lo hacen en silencio.
 *
 * Cada comprobación está aquí porque su fallo tendría consecuencias reales:
 *   1. Un método de `cloud` que escriba y no esté en CLOUD_WRITES → el modo pruebas dejaría de ser
 *      un modo pruebas y ensuciaría la cartera de verdad (y la del padre y la pareja).
 *   2. Un token de credencial generado con Math.random() → adivinable; quien lo saque puede meter
 *      gastos falsos en la cuenta de cualquiera.
 *   3. Una CSP sin las directivas que de verdad cortan una exfiltración.
 *   4. La anon key de Supabase es pública por diseño; la service_role NO puede aparecer JAMÁS.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

let failed = 0;
const ok = (name) => console.log(`  ✓ ${name}`);
const bad = (name, detail) => { failed++; console.log(`  ✗ ${name}`); if (detail) console.log("      " + detail); };

console.log("security");

/* ---- 1. El blindaje del banco de pruebas cubre TODAS las escrituras ---- */
{
  const core = read("src/modules/00-core.js");
  const cloudStart = core.indexOf("const cloud = (function(){");
  const cloudEnd = core.indexOf("\n})();", cloudStart);
  const cloudBody = core.slice(cloudStart, cloudEnd);
  const methods = [...cloudBody.matchAll(/^ {4}(?:async\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\(/gm)].map((m) => m[1]);

  const listMatch = core.match(/const CLOUD_WRITES=\[([\s\S]*?)\];/);
  if (!listMatch) {
    bad("CLOUD_WRITES existe", "no se encontró la lista en 00-core.js");
  } else {
    const guarded = new Set([...listMatch[1].matchAll(/"([A-Za-z0-9_]+)"/g)].map((m) => m[1]));

    // Heurística: un método ESCRIBE si su cuerpo hace insert/update/upsert/delete, o si invoca una
    // Edge Function que no sea de solo lectura.
    const READ_ONLY_FNS = new Set(["help-assistant", "prices", "categorize", "bank-sync", "bank-aspsps", "myinvestor-sync", "myinvestor-status"]);
    const writers = [];
    for (const name of methods) {
      if (name === "if" || name === "enabled") continue;
      const re = new RegExp(`^ {4}(?:async\\s+)?${name}\\s*\\([\\s\\S]*?\\n {4}\\},`, "m");
      const m = cloudBody.match(re);
      if (!m) continue;
      const body = m[0];
      const mutates = /\.(insert|update|upsert|delete)\(/.test(body);
      const fnCall = body.match(/functions\.invoke\(\s*['"]([a-z-]+)['"]/);
      const invokesWriter = fnCall && !READ_ONLY_FNS.has(fnCall[1]);
      if (mutates || invokesWriter) writers.push(name);
    }

    const unguarded = writers.filter((w) => !guarded.has(w));
    if (unguarded.length) {
      bad(
        "toda escritura de cloud está blindada en modo pruebas",
        `sin blindar: ${unguarded.join(", ")} — añádelos a CLOUD_WRITES en 00-core.js o el modo pruebas escribirá en producción`,
      );
    } else {
      ok(`las ${writers.length} escrituras de cloud pasan por el blindaje del modo pruebas`);
    }

    // Y al revés: una entrada que ya no exista es un despiste que deja un hueco silencioso.
    const stale = [...guarded].filter((g) => !methods.includes(g));
    if (stale.length) bad("CLOUD_WRITES sin entradas fantasma", `ya no existen en cloud: ${stale.join(", ")}`);
    else ok("CLOUD_WRITES no tiene entradas fantasma");
  }
}

/* ---- 2. Nada de Math.random() para generar credenciales ---- */
{
  let hits = [];
  for (const f of fs.readdirSync(path.join(root, "src", "modules"))) {
    if (!f.endsWith(".js")) continue;
    // Se vacían los comentarios ANTES de mirar (conservando los saltos de línea para no perder la
    // numeración). Este repo documenta el porqué de cada decisión en prosa larga, así que un
    // comentario que explique justo esta regla se delataría a sí mismo.
    const src = read(path.join("src", "modules", f))
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
      .replace(/(^|[^:'"])\/\/.*$/gm, "$1");
    src.split("\n").forEach((line, i) => {
      const code = line.trim();
      if (!/Math\.random\(\)/.test(code)) return;
      if (/token|secret|clave|key|password|nonce/i.test(code)) hits.push(`${f}:${i + 1}  ${code.slice(0, 100)}`);
    });
  }
  if (hits.length) bad("ninguna credencial sale de Math.random()", hits.join("\n      "));
  else ok("ninguna credencial sale de Math.random()");

  const core = read("src/modules/00-core.js");
  if (/function mcRandomToken\(\)[\s\S]{0,400}getRandomValues/.test(core)) ok("mcRandomToken usa getRandomValues");
  else bad("mcRandomToken usa getRandomValues");
}

/* ---- 3. La CSP mantiene las directivas que importan ---- */
{
  const shell = read("src/shell.html");
  const m = shell.match(/http-equiv="Content-Security-Policy"\s+content="([\s\S]*?)"/);
  if (!m) {
    bad("shell.html lleva CSP");
  } else {
    const csp = m[1].replace(/\s+/g, " ");
    const must = ["object-src 'none'", "base-uri 'none'", "form-action 'self'", "default-src 'self'"];
    const missing = must.filter((d) => !csp.includes(d));
    if (missing.length) bad("la CSP conserva las directivas clave", "faltan: " + missing.join(" · "));
    else ok("la CSP conserva las directivas clave");

    const connect = csp.match(/connect-src ([^;]*)/);
    if (!connect) bad("la CSP declara connect-src");
    else if (/\*/.test(connect[1])) bad("connect-src sin comodines", "un comodín deja salir los datos a cualquier sitio");
    else ok("connect-src es una lista cerrada");

    /* Y que la lista cerrada deje pasar lo que la app SÍ tiene que descargar. Una CSP demasiado
       estrecha no da error visible: `fetch` rechaza y el `catch` de turno se lo traga.
       Caso real 2026-07-25: los assets de las releases de GitHub redirigen a
       `release-assets.githubusercontent.com` (antes `objects.githubusercontent.com`) y ese
       dominio no estaba en la lista. La descarga del canal beta moría, caía al manifiesto de
       producción por su fallback, y el móvil contestaba «✓ estás a la última». El canal beta
       llevaba roto en silencio desde que GitHub cambió de dominio. */
    if (connect) {
      const hosts = connect[1];
      const necesarios = [
        ["https://sfyfjagbnhbplrljpbvh.supabase.co", "la nube: estado, gastos y Edge Functions"],
        ["https://api.frankfurter.dev", "tipos de cambio (canónico; .app redirige aquí)"],
        ["https://github.com", "manifiestos y assets de las releases (canal beta, APK)"],
        ["https://release-assets.githubusercontent.com", "a donde REDIRIGE github.com al bajar un asset"],
      ];
      const faltan = necesarios.filter(([h]) => !hosts.includes(h));
      if (faltan.length) {
        bad("connect-src deja pasar lo que la app descarga",
          faltan.map(([h, p]) => `${h} (${p})`).join(" · ") + " — sin esto el fetch muere y el catch se lo traga");
      } else ok("connect-src deja pasar lo que la app descarga");
    }
  }
}

/* ---- 4. Ni rastro de la service_role en lo que se publica ---- */
{
  const targets = ["src/shell.html", "public/index.html"];
  let leak = false;
  for (const f of targets) {
    if (!fs.existsSync(path.join(root, f))) continue;
    const src = read(f);
    // El JWT de Supabase lleva el rol en el payload: se detecta decodificando, no por el nombre.
    for (const tok of src.match(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g) || []) {
      try {
        const payload = JSON.parse(Buffer.from(tok.split(".")[1], "base64").toString("utf8"));
        if (payload.role && payload.role !== "anon") { bad("sin service_role en el cliente", `${f}: rol «${payload.role}» en un JWT`); leak = true; }
      } catch { /* no era un JWT */ }
    }
    if (/SERVICE_ROLE_KEY\s*[:=]\s*["'][^"']+["']/.test(src)) { bad("sin service_role en el cliente", `${f}: literal de service role`); leak = true; }
  }
  if (!leak) ok("no se publica ninguna clave de servicio (solo la anon, que es pública por diseño)");
}

/* ---- 5. El ingest compara el token en tiempo constante ---- */
{
  const ingest = read("supabase/functions/ingest/index.ts");
  if (/timingSafeEqual\(token, legacyToken\)/.test(ingest)) ok("el ingest compara el token en tiempo constante");
  else bad("el ingest compara el token en tiempo constante", "`token === legacyToken` filtra por tiempo cuántos bytes has acertado");
  if (/token\.slice\(0,\s*\d+\)/.test(ingest)) bad("el ingest no apunta trozos del token en la telemetría");
  else ok("el ingest no apunta trozos del token en la telemetría");
}

console.log(failed ? "\nsecurity: FALLA" : "\nsecurity: OK");
process.exit(failed ? 1 : 0);
