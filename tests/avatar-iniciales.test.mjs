// Inicio y Ajustes pintan las iniciales con la MISMA función: antes la misma persona salía «EE»
// en Inicio y «E2» en Ajustes, y «MC» (el nombre viejo de la app) sin correo (auditoría 15/11/2026).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync(new URL("../src/modules/02-ui-shared.js", import.meta.url), "utf8");
const m = src.match(/function avatarIniciales\(nombre, email\)\{[\s\S]*?\r?\n\}\r?\n/);
assert.ok(m, "no encuentro avatarIniciales en 02-ui-shared.js");
const avatarIniciales = new Function(m[0] + "return avatarIniciales;")();

test("dos palabras: la inicial de las dos primeras", () => {
  assert.equal(avatarIniciales("Juanjo Avila", ""), "JA");
  assert.equal(avatarIniciales("ana maría lópez", ""), "AM");
});
test("una palabra: UNA sola inicial", () => {
  assert.equal(avatarIniciales("Juanjo", ""), "J");
});
test("sin nombre: el correo, con la misma regla que el nombre", () => {
  assert.equal(avatarIniciales("", "e2e@test.local"), "E");
  assert.equal(avatarIniciales(null, "juan.avila@test.local"), "JA");
});
test("sin nada: «A» de Aely, nunca «MC»", () => {
  assert.equal(avatarIniciales("", ""), "A");
  assert.equal(avatarIniciales(null, null), "A");
});
test("Inicio, Perfil y Ajustes usan la función, no reglas propias", () => {
  const leer = (f) => fs.readFileSync(new URL("../src/modules/" + f, import.meta.url), "utf8");
  const dash = leer("03-tab-dash.js"), ajustes = leer("10-app-components.js"), perfil = leer("14-v4-screens.js");
  assert.match(dash, /initials=avatarIniciales\(/);
  assert.match(perfil, /initials=avatarIniciales\(/);
  assert.match(ajustes, /"v4-set-av"\}, avatarIniciales\(/);
  for (const src of [dash, ajustes, perfil]) assert.doesNotMatch(src, /"MC"/);
});
