#!/usr/bin/env node
/**
 * LOS TRES SUSTOS DE CAIXABANK (11/9/2026), contados por él de una tirada:
 *
 *   1. «la caixa no conecta… total que eso al sincronizar no sale ni un aviso ni nada, he tenido
 *      que venir aquí para ver qué pasaba».
 *   2. «decidí quitar la caixa… correcto, lo mismo, estado pendiente y no se quitó».
 *   3. «se me ocurre ir a cartera para ver si ya no estaba el banco quitado y adivina, estaba».
 *
 * Los tres salen del mismo sitio: un enlace `pending` es invisible para todo el circuito, y
 * quitar un banco solo limpiaba la mitad del estado.
 *
 * · El aviso: `bank-sync` solo consultaba los enlaces `active`/`expired`/`error`, así que un
 *   banco a medio autorizar no llegaba ni a la respuesta. `bankIssuesOf` ahora acepta también las
 *   filas crudas de `bank_links` y saca de ahí los `pending`. Se arregla en el CLIENTE a
 *   propósito: el servidor va sin desplegar y así le llega por OTA.
 * · La cuenta que se quedaba: quitar un banco purgaba `obAccounts`, pero una cuenta PROMOCIONADA
 *   (la que tiene rol) vive en `state.accounts` con su `bankIban`, y ahí seguía con la chapita
 *   «del banco» y el saldo congelado.
 *
 * Aquí se prueba la LÓGICA, que es donde estaba el fallo. El `set` de la pantalla se replica con
 * el mismo criterio que `10-app-components.js`, y el test exige que la cuenta SOBREVIVA: un banco
 * que quitas no es un historial que quieras perder ([[tr-duplicados-saga]]).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const cli = loadPureLogicFromFile();

let fallos = 0;
const t = (nombre, fn) => {
  try { fn(); console.log(`  ✓ ${nombre}`); }
  catch (e) { fallos++; console.error(`  ✗ ${nombre}\n      ${e.message}`); }
};

console.log("quitar un banco, y el que se quedó a medias");

/* ---------- 1. El aviso del banco a medio conectar ---------- */

t("un enlace «pending» sale como aviso, aunque el sync no lo mencione", () => {
  const issues = cli.bankIssuesOf([], [{ aspsp_name: "CaixaBank", status: "pending" }]);
  assert.equal(issues.length, 1, "el banco a medio conectar tiene que avisar");
  assert.equal(issues[0].kind, "pending");
  assert.equal(issues[0].ent, "caixabank");
});

t("un enlace «active» no avisa de nada", () => {
  assert.deepEqual(cli.bankIssuesOf([], [{ aspsp_name: "CaixaBank", status: "active" }]), []);
});

t("el caducado de siempre sigue avisando igual (no se ha roto nada)", () => {
  const issues = cli.bankIssuesOf([{ aspsp: "Sabadell", ok: false, expired: true }], []);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].kind, "expired");
});

t("un banco no sale DOS veces por estar en las dos listas", () => {
  const issues = cli.bankIssuesOf(
    [{ aspsp: "CaixaBank", ok: false, expired: true }],
    [{ aspsp_name: "CaixaBank", status: "pending" }]
  );
  assert.equal(issues.length, 1, "se avisa una vez, no dos");
});

t("y el servidor, cuando se despliegue, también lo manda", () => {
  const issues = cli.bankIssuesOf([{ aspsp: "CaixaBank", ok: false, pending: true }], []);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].kind, "pending");
});

/* ---------- 2 y 3. Quitar el banco y qué pasa con su cuenta ---------- */

/* El mismo criterio que aplica la pantalla al desconectar. Se escribe aquí para poder probarlo;
   si cambia allí y no aquí, este test miente — por eso el guardián de abajo lee el módulo. */
const alQuitarBanco = (s, ent, aspsp) => {
  const ob = (s.obAccounts || []).filter((o) => String(o.aspsp || "").toLowerCase() !== String(aspsp || "").toLowerCase());
  let next = ob.length !== (s.obAccounts || []).length ? Object.assign({}, s, { obAccounts: ob }) : s;
  if (ent) {
    let tocadas = 0;
    const nuevas = (next.accounts || []).map((a) => {
      if (a && a.ent === ent && a.bankIban) { tocadas++; const c = Object.assign({}, a); delete c.bankIban; return c; }
      return a;
    });
    if (tocadas) next = Object.assign({}, next, { accounts: nuevas });
  }
  return next;
};

const estado = () => ({
  accounts: [
    { id: "a1", ent: "caixabank", name: "CaixaBank", value: 1.28, role: "fijos", bankIban: "ES00" },
    { id: "a2", ent: "sabadell", name: "Nómina", value: 200, role: "ambos", bankIban: "ES11" },
  ],
  obAccounts: [{ key: "k1", aspsp: "CaixaBank", ent: "caixabank", value: 40 }],
  expenses: [{ id: "e1", ent: "caixabank", amount: 12, date: "2026-09-02" }],
});

t("la cuenta del banco quitado deja de decir «del banco»", () => {
  const out = alQuitarBanco(estado(), "caixabank", "CaixaBank");
  const a = out.accounts.find((x) => x.id === "a1");
  assert.ok(a, "la cuenta NO se borra: un banco que quitas no es un historial que quieras perder");
  assert.equal(a.bankIban, undefined, "sin bankIban ya no sale como sincronizada ni la re-ancla el sync");
  assert.equal(a.value, 1.28, "su saldo se queda como estaba");
});

t("y sus cuentas extra de Open Banking sí se van", () => {
  const out = alQuitarBanco(estado(), "caixabank", "CaixaBank");
  assert.equal((out.obAccounts || []).length, 0);
});

t("los gastos de ese banco NO se tocan", () => {
  const out = alQuitarBanco(estado(), "caixabank", "CaixaBank");
  assert.equal(out.expenses.length, 1, "nunca se borran movimientos al quitar un banco");
});

t("los otros bancos se quedan intactos (dos bancos sembrados a propósito)", () => {
  const out = alQuitarBanco(estado(), "caixabank", "CaixaBank");
  const sab = out.accounts.find((x) => x.id === "a2");
  assert.equal(sab.bankIban, "ES11", "Sabadell sigue siendo del banco");
});

/* ---------- El guardián: que la pantalla siga haciendo esto ---------- */

t("la pantalla de Mis bancos limpia de verdad el bankIban al desconectar", () => {
  /* La lógica de arriba es una RÉPLICA del `set` de la pantalla. Sin este guardián, alguien podría
     cambiar la pantalla, dejar el bug igual que estaba, y este fichero seguiría en verde probando
     mi copia en vez de la app. */
  const src = readFileSync(new URL("../src/modules/10-app-components.js", import.meta.url), "utf8");
  const i = src.indexOf("cloud.bankDisconnect(");
  assert.notEqual(i, -1, "no encuentro la desconexión en 10-app-components.js");
  const bloque = src.slice(i, i + 2600);
  assert.ok(/delete\s+c\.bankIban/.test(bloque),
    "el `set` de bankDisconnect ya no limpia `bankIban`: la cuenta se quedaría en Cartera diciendo «del banco»");
  assert.ok(!/accounts:\s*\(?s\.accounts[^)]*\)\.filter/.test(bloque),
    "aquí NO se borran cuentas: quitar un banco no puede llevarse por delante su histórico");
});

if (fallos) { console.error(`\nquitar-banco-y-pendiente: ${fallos} fallo(s)`); process.exit(1); }
console.log("\nquitar-banco-y-pendiente: OK");
