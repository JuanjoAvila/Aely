import { test } from "node:test";
import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

/* El orden de Cartera es el del array `accounts`. Si esto falla, el long-press «parece» mover
   y al soltar no ha cambiado nada (o ha tocado otra lista). */

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
