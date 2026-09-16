import { test } from "node:test";
import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

/* El orden de Cartera mezcla cuentas con rol y cuentas recién llegadas del banco. Si esto falla,
   CaixaBank se ve como las demás pero el long-press no puede moverla (rechazo 2026-09-16). */

test("moveAccountInList reordena el array y no toca el resto del estado", () => {
  const cli = loadPureLogicFromFile();
  assert.equal(typeof cli.moveAccountInList, "function");
  const st = {
    accounts: [
      { id: "a", ent: "sabadell", value: 1 },
      { id: "b", ent: "revolut", value: 2 },
      { id: "c", ent: "efectivo", value: 3 },
    ],
    budget: 100,
  };
  const out = cli.moveAccountInList(st, "a", "b");
  assert.deepEqual(out.accounts.map((x) => x.id), ["b", "a", "c"]);
  assert.equal(out.budget, 100);
  assert.deepEqual(st.accounts.map((x) => x.id), ["a", "b", "c"], "no muta el original");
  assert.equal(cli.moveAccountInList(st, "a", "a"), st);
  assert.equal(cli.moveAccountInList(st, "x", "a"), st);
});

test("una cuenta OB se ordena con las demás sin promocionarla ni tocar dinero", () => {
  const cli = loadPureLogicFromFile();
  assert.equal(typeof cli.accountRowsInOrder, "function");
  const st = {
    accounts: [
      { id: "a", ent: "sabadell", value: 500, role: "fijos" },
      { id: "b", ent: "revolut", value: 80, role: "diario", spendFrom: true },
    ],
    obAccounts: [
      { key: "caixa-1", ent: "caixabank", iban: "ES001", value: 321.45, cur: "EUR" },
    ],
    settings: { expenseBanks: ["revolut"] },
    budget: 100,
  };

  assert.deepEqual(Array.from(cli.accountRowsInOrder(st), (r) => r.key), ["acc:a", "acc:b", "ob:caixa-1"]);
  const out = cli.moveAccountInList(st, "ob:caixa-1", "acc:a");
  assert.deepEqual(Array.from(cli.accountRowsInOrder(out), (r) => r.key), ["ob:caixa-1", "acc:a", "acc:b"]);
  assert.deepEqual(out.accounts, st.accounts, "ordenar no promociona ni reancla cuentas");
  assert.deepEqual(out.obAccounts, st.obAccounts, "ordenar no altera el saldo puro del banco");
  assert.deepEqual(out.settings.expenseBanks, ["revolut"], "ordenar no cambia qué cuenta para el presupuesto");
  assert.equal(out.budget, 100);
});

test("al desaparecer las OB, el orden visual y accounts siguen alineados y sin claves huérfanas", () => {
  const cli = loadPureLogicFromFile();
  const st = {
    accounts: [
      { id: "a", ent: "sabadell", value: 500 },
      { id: "b", ent: "revolut", value: 80 },
    ],
    obAccounts: [],
    settings: { accountListOrder: ["ob:ya-desconectada", "acc:a", "acc:b"] },
  };

  const out = cli.moveAccountInList(st, "acc:b", "acc:a");
  assert.deepEqual(Array.from(out.accounts, (x) => x.id), ["b", "a"]);
  assert.deepEqual(Array.from(out.settings.accountListOrder), ["acc:b", "acc:a"]);
  assert.deepEqual(Array.from(cli.accountRowsInOrder(out), (r) => r.key), ["acc:b", "acc:a"]);
});

test("elegir rol conserva la posición que tenía la cuenta OB", () => {
  const cli = loadPureLogicFromFile();
  assert.equal(typeof cli.promoteObAccount, "function");
  const st = {
    accounts: [{ id: "a", ent: "sabadell", value: 500, role: "diario", spendFrom: true }],
    obAccounts: [{ key: "caixa-1", ent: "caixabank", iban: "ES001", value: 321.45, cur: "EUR" }],
    obLabels: { "caixa-1": "Caixa familiar" },
    expenses: [], fixed: [], debts: [],
    settings: { accountListOrder: ["ob:caixa-1", "acc:a"] },
  };

  const out = cli.promoteObAccount(st, {}, "caixa-1", "fijos", "caixa-promovida");
  assert.equal(out.obAccounts.length, 0);
  assert.equal(out.accounts.find((a) => a.id === "caixa-promovida").role, "fijos");
  assert.deepEqual(Array.from(out.accounts, (a) => a.id), ["caixa-promovida", "a"]);
  assert.deepEqual(Array.from(cli.accountRowsInOrder(out), (r) => r.key), ["ob:caixa-1", "acc:a"]);
});
