#!/usr/bin/env node
/**
 * OPS-06 P1 y P2 (13/9): nadie entra en un Hogar ajeno adivinando el código, y `app_events` no se
 * puede inflar. Aquí no hay Postgres, así que se vigila la FORMA de las migraciones (lo que se
 * rompe al tocarlas) y el generador de códigos del cliente de verdad.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

let fallos = 0;
const t = (n, fn) => { try { fn(); console.log("  ✓ " + n); } catch (e) { fallos++; console.error("  ✗ " + n + "\n      " + (e && e.message)); } };
console.log("seguridad-hogar-eventos");

const rd = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const m22 = rd("supabase/migrations/0022_household_join_freno.sql");
const m23 = rd("supabase/migrations/0023_app_events_topes.sql");

t("0022: el freno va ANTES de buscar el código", () => {
  const iFreno = m22.indexOf("check_rate_limit('hh-join:'");
  const iSelect = m22.indexOf("from public.households");
  assert.ok(iFreno > 0, "falta el freno por usuario");
  assert.ok(iFreno < iSelect, "si va después del SELECT, cada intento ya ha mirado la tabla");
  assert.ok(/raise exception 'too_many_attempts'/.test(m22));
});

t("0022: sigue siendo SECURITY DEFINER y solo para usuarios con sesión", () => {
  assert.ok(/security definer/i.test(m22));
  assert.ok(/revoke all on function public\.join_household_by_code\(text\) from public;/.test(m22));
  assert.ok(/grant execute on function public\.join_household_by_code\(text\) to authenticated;/.test(m22));
  assert.equal(/to anon/.test(m22), false);
});

t("0023: topes de tamaño sin revalidar lo viejo, y freno por número que descarta sin error", () => {
  assert.ok(/char_length\(coalesce\(message, ''\)\) <= 1000/.test(m23));
  assert.ok(/char_length\(coalesce\(detail, ''\)\) <= 16000\) not valid/.test(m23));
  assert.ok(/check_rate_limit\('ev:' \|\| new\.user_id::text, 600, 600\)/.test(m23));
  assert.ok(/return null;/.test(m23), "al pasarse se descarta el evento (no un error que rompa nada)");
  assert.ok(/auth\.role\(\) = 'service_role'/.test(m23), "las Edge (service role) no pasan por el freno");
});

t("el cliente recorta los eventos por debajo de los topes de la BD", () => {
  const core = rd("src/modules/00-core.js");
  const i = core.indexOf("async logEvent(");
  assert.ok(i > 0, "no encuentro logEvent");
  const trozo = core.slice(i, i + 1500);
  const nums = (trozo.match(/slice\(0,\s*(\d+)\)/g) || []).map((x) => Number(x.match(/\d+/)[0]));
  assert.ok(nums.length > 0, "logEvent no recorta nada");
  assert.ok(nums.every((n) => n <= 16000), "algún recorte pasa del tope de la BD: " + nums.join(","));
});

/* `13-hogar.js` va después del corte del sandbox de lógica pura, así que la función se saca de su
   fuente y se evalúa sola, con el `crypto` real de Node como `window.crypto`. */
const hogarSrc = rd("src/modules/13-hogar.js");
const iGen = hogarSrc.indexOf("function mcInviteCode(");
const genSrc = hogarSrc.slice(iGen, hogarSrc.indexOf("\n}", iGen) + 2);
const mcInviteCode = new Function("window", "self", genSrc + "\nreturn mcInviteCode;")({ crypto: globalThis.crypto }, globalThis);
void loadPureLogicFromFile;
t("los códigos nuevos son de 10, del alfabeto sin confusiones, y no se repiten", () => {
  const vistos = new Set();
  for (let i = 0; i < 2000; i++) {
    const c = mcInviteCode();
    assert.match(c, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/);
    vistos.add(c);
  }
  assert.equal(vistos.size, 2000, "2.000 códigos de 10 no deberían chocar nunca");
});

t("el generador no usa Math.random, y al crear no se trunca a 8", () => {
  const hogar = rd("src/modules/13-hogar.js");
  const i = hogar.indexOf("function mcInviteCode(");
  const cuerpo = hogar.slice(i, hogar.indexOf("\n}", i));
  assert.equal(/Math\.random/.test(cuerpo), false);
  assert.ok(/getRandomValues/.test(cuerpo));
  const core = rd("src/modules/00-core.js");
  assert.ok(/replace\(\/\[\^A-Z0-9\]\/g,""\)\.slice\(0,12\)/.test(core), "con slice(0,8) el código de 10 se trunca y nadie puede unirse");
});

/* Ronda A (18/11): 0028 endurece Hogar, 0029 quita el admin por correo y 0030 purga rate_limits.
   Sin Postgres: se vigila lo que se rompe al tocarlas. Lo que solo se ve ejecutándolas está en
   docs/SETUP-SUPABASE.md (prueba con begin … rollback en el SQL Editor). */
const m28 = rd("supabase/migrations/0028_hogar_endurecer.sql");
const m29 = rd("supabase/migrations/0029_admin_sin_email.sql");
const m30 = rd("supabase/migrations/0030_rate_limits_purga.sql");
const cuerpo = (src, fn) => {
  const i = src.indexOf("create or replace function public." + fn + "(");
  assert.ok(i >= 0, "falta " + fn);
  return src.slice(i, src.indexOf("$$;", src.indexOf("$$", i) + 2));
};

t("0028: la función nueva NO lanza, para que el fallo quede contado", () => {
  const f = cuerpo(m28, "join_household");
  assert.equal(/raise exception/.test(f), false, "una excepción deshace el contador: es justo el fallo de la 0022");
  assert.ok(/returns jsonb/.test(f));
  const iMiss = f.indexOf("check_rate_limit('hh-join-miss-global', 200, 3600)");
  const iInsert = f.indexOf("insert into public.household_members");
  assert.ok(iMiss > 0 && iMiss < iInsert, "el fallo global se cuenta en la rama del código inválido");
  assert.ok(f.indexOf("hogar_fallos_globales_agotados()") < f.indexOf("from public.households h"), "el tope global se mira antes de buscar");
  assert.ok(f.indexOf("check_rate_limit('hh-join:'") < f.indexOf("from public.households h"), "y el freno por usuario también");
});

t("0028: la vieja conserva el contrato que espera la app instalada", () => {
  const f = cuerpo(m28, "join_household_by_code");
  for (const e of ["not_authenticated", "too_many_attempts", "invalid_code"]) assert.ok(f.includes("raise exception '" + e + "'"), e);
  assert.ok(/returns uuid/.test(f));
  assert.ok(/caduca is not null and caduca < now\(\)/.test(f), "caducado = inexistente");
});

t("0028: nada nuevo ejecutable sin sesión, y todo SECURITY DEFINER con search_path", () => {
  for (const fn of ["join_household(text)", "join_household_by_code(text)", "is_household_owner(uuid)"]) {
    assert.ok(m28.includes("revoke execute on function public." + fn + " from anon;"), fn);
    assert.ok(m28.includes("grant execute on function public." + fn + " to authenticated;"), fn);
  }
  assert.ok(m28.includes("revoke execute on function public.hogar_fallos_globales_agotados() from anon, authenticated;"));
  assert.equal((m28.match(/security definer/g) || []).length, (m28.match(/security definer\s*\n(?:\s*stable\s*\n)?\s*set search_path = public/g) || []).length);
  assert.equal(/grant [^;]* to anon/.test(m28), false);
});

t("0028: expulsar solo a OTROS, solo el dueño, y la foto del que sale se borra", () => {
  assert.ok(/for delete to authenticated\s+using \(user_id <> auth\.uid\(\) and public\.is_household_owner\(household_id\)\)/.test(m28));
  assert.ok(/after delete on public\.household_members/.test(m28));
  assert.ok(/delete from public\.household_snapshots\s+where household_id = old\.household_id and user_id = old\.user_id/.test(m28));
});

t("0028: longitud solo al crear o CAMBIAR el código, y nada que revalide lo viejo", () => {
  assert.ok(/before insert or update of invite_code on public\.households/.test(m28));
  assert.ok(/< 10 then/.test(m28));
  assert.equal(/alter table public\.households add constraint/.test(m28), false, "un CHECK revalida en cada UPDATE (renombrar un hogar viejo fallaría)");
  assert.ok(/add column if not exists invite_expires_at timestamptz;/.test(m28), "nullable: NULL = no caduca, como hoy");
});

t("0029: ninguna cuenta nace admin y no queda ningún correo", () => {
  assert.ok(/values \(new\.id, false\)/.test(m29));
  assert.equal(/@[a-z0-9-]+\.[a-z]/i.test(m29.replace(/^--.*$/gm, "")), false, "ni un correo en el SQL");
  assert.equal(/update public\.profiles|delete from public\.profiles/i.test(m29), false, "no toca el admin de hoy");
});

t("0030: purga diaria idempotente que solo llama a la función de la 0019", () => {
  assert.ok(/perform cron\.unschedule\('aely-rate-limits-purga'\);\s*exception when others then\s*null;/.test(m30));
  assert.ok(/cron\.schedule\(\s*'aely-rate-limits-purga',\s*'17 4 \* \* \*',\s*\$job\$ select public\.prune_rate_limits\(\); \$job\$/.test(m30));
  const m19 = rd("supabase/migrations/0019_rate_limit.sql");
  assert.ok(/window_start < now\(\) - interval '2 days'/.test(m19), "si cambia el margen de la purga, revisar las ventanas de los frenos");
});

if (fallos) { console.error(`seguridad-hogar-eventos: ${fallos} fallo(s)`); process.exit(1); }
console.log("seguridad-hogar-eventos: OK");
