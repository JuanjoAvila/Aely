#!/usr/bin/env node
/** Conciliación banco ↔ cargos modelados + helpers de matching. */
import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx = loadPureLogicFromFile();

function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}`); throw e; }
}

console.log("reconcile-bank");

t("recAmtClose: tolera céntimos y 2%", () => {
  assert.equal(ctx.recAmtClose(100, 100.4), true);
  assert.equal(ctx.recAmtClose(100, 50), false);
});

t("recNameMatch: casa por palabras clave", () => {
  assert.equal(ctx.recNameMatch("Hipoteca Sabadell", "CUOTA HIPOTECA SABADELL"), true);
  assert.equal(ctx.recNameMatch("Netflix", "Spotify"), false);
});

t("reconcileBank: confirma cargo fijo que coincide", () => {
  const state = {
    accounts: [{ id: "a1", ent: "sabadell", role: "fijos", value: 1000 }],
    fixed: [{ id: "f1", name: "Alquiler", amount: 800, freq: "mes", account: "sabadell", day: 5, months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }],
    debts: [],
    oneoffs: [],
    flows: [],
    bankTx: [
      { date: "2026-07-05", merchant: "ALQUILER PISO", amount: 800, ent: "sabadell" },
    ],
  };
  const r = ctx.reconcileBank(state, 2026, 7, 15);
  assert.equal(r.confirmed.length, 1);
  assert.equal(r.confirmed[0].name, "Alquiler");
});

t("reconcileBank: deuda activa aparece en modelados y confirma", () => {
  const state = {
    accounts: [{ id: "a1", ent: "sabadell", role: "fijos", value: 5000 }],
    fixed: [],
    debts: [{ id: "d1", name: "Coche", value: 8000, monthly: 350, day: 10, account: "sabadell", asOf: 2026 * 12 + 0 }],
    oneoffs: [],
    flows: [],
    bankTx: [
      { date: "2026-07-10", merchant: "CUOTA PRESTAMO COCHE", amount: 350, ent: "sabadell" },
    ],
  };
  const r = ctx.reconcileBank(state, 2026, 7, 20);
  assert.equal(r.confirmed.length, 1);
});

t("reconcileBank: movimiento sin modelo → newCharges", () => {
  const state = {
    accounts: [{ id: "a1", ent: "sabadell", role: "fijos", value: 1000 }],
    fixed: [],
    debts: [],
    oneoffs: [],
    flows: [],
    bankTx: [
      { date: "2026-07-12", merchant: "COMPRA DESCONOCIDA", amount: 42.5, ent: "sabadell" },
    ],
  };
  const r = ctx.reconcileBank(state, 2026, 7, 15);
  assert.equal(r.newCharges.length, 1);
  assert.equal(r.newCharges[0].merchant, "COMPRA DESCONOCIDA");
});

t("applyBankBalances: re-ancla cuenta primaria con saldo real", () => {
  const now = new Date();
  const s = {
    accounts: [{ id: "x", ent: "sabadell", name: "Sabadell", value: 900, role: "fijos" }],
    fixed: [],
    debts: [],
    obAccounts: [],
  };
  const links = [{
    ok: true,
    aspsp: "Banco de Sabadell",
    accounts: [{ uid: "u1", iban: "ES001", ok: true, balances: [{ type: "ITAV", amount: 1200, currency: "EUR" }] }],
  }];
  const r = ctx.applyBankBalances(s, links);
  assert.ok(r.changed);
  const acc = r.state.accounts.find((a) => a.ent === "sabadell");
  assert.ok(acc.value > 1100 && acc.value <= 1200);
});

console.log("\nreconcile-bank: OK");

/* ── EL RASTRO DEL SALDO TIENE QUE VERSE AUNQUE EL IMPORTE NO CAMBIE ────────────────────────────
 *
 * Queja de su PADRE (11/9): «Revolut no tiene ese dinero y le cambia el valor constantemente sin
 * tocar la cuenta». Para poder diagnosticarlo se guarda QUÉ saldo de los que manda el banco hemos
 * usado (`balTipo`) y cuáles había (`balTipos`).
 *
 * Y el rastro nacía CIEGO justo a su caso: solo se escribía si cambiaba el importe o el IBAN, así
 * que un banco que pasara de mandar ITAV a mandar CLBD con el MISMO número se guardaba con la
 * etiqueta vieja. Lo cazó Cursor revisando. Un instrumento que no ve lo único que tiene que ver
 * es peor que no tenerlo, porque da falsa tranquilidad.
 */
t("★ el rastro del saldo se refresca aunque el importe sea el mismo", () => {
  const s = {
    accounts: [{ id: "x", ent: "revolut", name: "Revolut", value: 300, role: "fijos", bankIban: "ES9" }],
    fixed: [], debts: [], obAccounts: [],
  };
  const conTipo = (tipo) => [{
    ok: true, aspsp: "Revolut",
    accounts: [{ uid: "u1", iban: "ES9", ok: true, balances: [{ type: tipo, amount: 346.29, currency: "EUR" }] }],
  }];

  const r1 = ctx.applyBankBalances(s, conTipo("ITAV"));
  const a1 = r1.state.accounts[0];
  assert.equal(a1.balTipo, "ITAV", "el primer sync tiene que dejar dicho qué saldo usó");
  assert.equal(a1.balSaldo, 346.29);

  // MISMO importe, OTRO tipo: el banco ha cambiado de saldo y el número no se entera.
  const r2 = ctx.applyBankBalances(r1.state, conTipo("CLBD"));
  assert.equal(r2.state.accounts[0].balTipo, "CLBD",
    "el banco cambió de saldo con el mismo importe y el rastro se quedó con la etiqueta vieja: " +
    "ciego justo al caso de su padre");
});

t("los tipos que ofrece el banco se guardan sin repetir y con tope", () => {
  const muchos = [];
  for (let i = 0; i < 40; i++) muchos.push({ type: i % 2 ? "CLBD" : "ITAV", amount: 10 + i });
  const inf = ctx.pickBankBalanceInfo(muchos);
  assert.deepEqual(inf.tipos, ["ITAV", "CLBD"], "sin repetir");
  assert.ok(inf.tipos.length <= 16, "esto viaja dentro de app_state: no puede crecer sin tope");
});
