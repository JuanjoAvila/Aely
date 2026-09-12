import { test } from "node:test";
import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

test("refreshExpenseFromCloud actualiza cat de un OB y no toca un manual", () => {
  const cli = loadPureLogicFromFile();
  assert.equal(typeof cli.refreshExpenseFromCloud, "function");
  assert.equal(typeof cli.mergeExpensesFromCloud, "function");

  const localOb = {
    id: "loc", date: "2026-09-10T12:00:00.000Z", amount: 81.29,
    merchant: "AIGUES DE BARCELONA", category: "viajes", source: "ob", ent: "sabadell",
  };
  const cloudOb = {
    id: "cloud", date: "2026-09-10T12:00:00.000Z", amount: 81.29,
    merchant: "AIGUES DE BARCELONA", category: "energia", source: "ob", ent: "sabadell",
  };
  const out = cli.refreshExpenseFromCloud(localOb, cloudOb);
  assert.equal(out.category, "energia");
  assert.equal(out.id, "cloud");
  assert.equal(localOb.category, "viajes", "no muta el original");

  const localMan = {
    id: "m1", date: "2026-09-10T12:00:00.000Z", amount: 10,
    merchant: "Cafe", category: "bares", source: "manual",
  };
  const cloudMan = Object.assign({}, localMan, { category: "otros", id: "m1" });
  const outM = cli.refreshExpenseFromCloud(localMan, cloudMan);
  assert.equal(outM.category, "bares", "manual no se pisa");
});

test("mergeExpensesFromCloud refresca y no borra lo que solo está en local", () => {
  const cli = loadPureLogicFromFile();
  const prev = [
    { id: "a", date: "2026-09-10T12:00:00.000Z", amount: 81.29, merchant: "AIGUES", category: "viajes", source: "ob" },
    { id: "solo", date: "2026-09-09T12:00:00.000Z", amount: 5, merchant: "Local", category: "otros", source: "ob" },
  ];
  const incoming = [
    { id: "a2", date: "2026-09-10T12:00:00.000Z", amount: 81.29, merchant: "AIGUES", category: "energia", source: "ob" },
  ];
  const m = cli.mergeExpensesFromCloud(prev, incoming);
  assert.equal(m.changed, true);
  assert.equal(m.nuevos, 0);
  assert.equal(m.list.length, 2, "la fila solo-local no desaparece");
  assert.equal(m.list[0].category, "energia");
  assert.equal(m.list[1].merchant, "Local");
});
