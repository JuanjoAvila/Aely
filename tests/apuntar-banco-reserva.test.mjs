#!/usr/bin/env node
/** Apuntar sin cuenta de gasto diario: el banco del widget como reserva (ronda 242, decisión del
 *  dueño 18/11/2026). Siempre con DOS bancos, para que «el primero que haya» no pase por acierto. */
import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx = loadPureLogicFromFile();

function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}`); throw e; }
}

console.log("apuntar-banco-reserva");

const dos = (extra = {}) => ({
  accounts: [
    { id: "a1", ent: "sabadell", role: "fijos", value: 1000 },
    { id: "a2", ent: "caixabank", role: "fijos", value: 500 },
  ],
  settings: { widgetBank: "caixabank", expenseBanks: ["sabadell", "caixabank"] },
  ...extra,
});
const gasto = (ent) => ({ id: "g", date: "2026-11-18", amount: 12.5, category: "super", ent, source: ent ? "manual:" + ent : "manual" });

t("sin diario ni spendFrom: el banco del widget, no el primero", () => {
  const s = dos();
  assert.equal(ctx.apuntarBancoReserva(s), "caixabank");
  // El gasto apuntado con la reserva cuenta en ese banco igual que uno sin banco.
  assert.equal(ctx.expenseCountsCash(gasto("caixabank"), s), true);
  assert.equal(ctx.expenseCountsCash(gasto(null), s), true);
  assert.equal(ctx.expenseBucket(gasto("caixabank"), s), "cuenta");
});

t("con un banco diario (o ambos, o spendFrom) la reserva no actúa", () => {
  for (const marca of [{ role: "diario" }, { role: "ambos" }, { role: undefined, spendFrom: true }]) {
    const s = dos();
    s.accounts = s.accounts.map((a) => a.ent === "sabadell" ? Object.assign({}, a, marca) : a);
    assert.equal(ctx.apuntarBancoReserva(s), null, JSON.stringify(marca));
  }
});

t("banco del widget que ya no existe: nada (tampoco el otro banco)", () => {
  const s = dos({ settings: { widgetBank: "bbva", expenseBanks: ["sabadell", "caixabank"] } });
  assert.equal(ctx.apuntarBancoReserva(s), null);
  const sin = dos({ settings: { expenseBanks: ["sabadell", "caixabank"] } });
  assert.equal(ctx.apuntarBancoReserva(sin), null);
});

t("banco del widget de inversión: nada", () => {
  const s = dos();
  s.accounts = s.accounts.map((a) => a.ent === "caixabank" ? Object.assign({}, a, { role: "extra" }) : a);
  assert.equal(ctx.apuntarBancoReserva(s), null);
  // Un bróker solo en Inversiones no es una cuenta: tampoco.
  const inv = dos({ settings: { widgetBank: "myinvestor", expenseBanks: ["sabadell", "caixabank", "myinvestor"] }, investments: [{ id: "i1", ent: "myinvestor", value: 100 }] });
  assert.equal(ctx.apuntarBancoReserva(inv), null);
});

t("el efectivo no es banco del widget", () => {
  const s = dos({ settings: { widgetBank: "efectivo", expenseBanks: ["sabadell", "efectivo"] } });
  s.accounts = s.accounts.concat([{ id: "e1", ent: "efectivo", role: "fijos", value: 40 }]);
  assert.equal(ctx.apuntarBancoReserva(s), null);
});

t("si el gasto de ese banco no contaría, no se pone (sin banco sí suma)", () => {
  const s = dos({ settings: { widgetBank: "caixabank", expenseBanks: ["sabadell"] } });
  assert.equal(ctx.expenseCountsCash(gasto("caixabank"), s), false);
  assert.equal(ctx.apuntarBancoReserva(s), null);
  const vacio = dos({ settings: { widgetBank: "caixabank" } });
  assert.equal(ctx.apuntarBancoReserva(vacio), null);
});
