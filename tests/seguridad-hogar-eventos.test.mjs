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

if (fallos) { console.error(`seguridad-hogar-eventos: ${fallos} fallo(s)`); process.exit(1); }
console.log("seguridad-hogar-eventos: OK");
