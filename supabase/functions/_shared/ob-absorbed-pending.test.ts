import { filasComoLaApp, inicioDeMesMs } from "./presupuesto.ts";
import { widgetSnapshot } from "../ingest/widget.ts";
const owner = "synthetic-owner";
const row = { id: "book", fecha: "2026-10-16T12:00:00.001Z", importe: 3.2, comercio: "Compra sintetica", cat: "otros", source: "ob:caixabank#refb#accaccount-a#n2" };
const key = "ob-absorbed2|caixabank|b|2|account-a|2026-10-16";
const pending = [{ owner, key }];
const eq = (a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw Error(JSON.stringify({ actual: a, expected: b })); };
Deno.test("FIN11 pendiente conserva protección sin lápida normal", () => {
  eq(filasComoLaApp([row], [], pending, owner), []);
  eq(filasComoLaApp([row], [], [], owner), [row]);
});
Deno.test("FIN11 otro titular no presta protección", () => {
  eq(filasComoLaApp([row], [], pending, "another-owner"), [row]);
  eq(filasComoLaApp([row], [], pending), [row]);
});
Deno.test("FIN11 conserva cuenta/día/ranura distintos y el comodín ratificado FIN10", () => {
  for (const change of [{ source: row.source.replace("account-a", "account-b") }, { fecha: "2026-10-15T12:00:00.001Z" }, { source: row.source.replace("#n2", "") }]) {
    const other = { ...row, ...change };
    eq(filasComoLaApp([other], [], pending, owner), [other]);
  }
  eq(filasComoLaApp([{ ...row, source: row.source.replace("#accaccount-a", "") }], [], pending, owner), []);
  eq(filasComoLaApp([{ ...row, source: row.source.replace("account-a", "account-b") }], [], [{ owner, key: key.replace("|account-a|", "||") }], owner), []);
});
Deno.test("FIN11 500 lápidas ajenas no podan la intención y UUID distinto sigue protegido", () => {
  const deleted = Array.from({ length: 500 }, (_, i) => "other-" + i);
  eq(filasComoLaApp([{ ...row, id: "remote-alias" }], deleted, pending, owner), []);
  eq(deleted.length, 500);
});
Deno.test("FIN11 widget real usa el titular autenticado y conserva 320 céntimos", () => {
  const now = Date.parse("2026-10-17T12:00:00Z"), start = inicioDeMesMs(now);
  const data = { _historyOwner: "stale-other-owner", budget: 1000, accounts: [{ ent: "caixabank", role: "diario", spendFrom: true }],
    settings: { expenseBanks: ["caixabank"] }, deleted: [], obAbsorbedPending: pending,
    widgetPeriod: { v: 2, kind: "mes", start, scope: JSON.stringify([2, start, "mes", "gasto", "", 1000, ["caixabank"], "caixabank"]) } };
  const kept = { ...row, id: "kept", source: "ob:caixabank#refp#accaccount-a", fecha: "2026-10-16T12:00:00.000Z" };
  const snapshot = widgetSnapshot(data, [kept, row], now, { id: "kept", event: "synthetic", key }, owner);
  eq(snapshot?.spent, 3.2);
  eq(widgetSnapshot(data, [kept, row], now, { id: "book", event: "synthetic", key }, owner), null);
});
Deno.test("FIN11/FIN15 pendiente con comodín no consume la referencia superviviente de otro día", () => {
  const later = { ...row, id: "survivor", fecha: "2026-10-17T12:00:00.001Z" };
  const own = [{ owner, key: key.replace("|account-a|", "||") }];
  for (const rows of [[row, later], [later, row]]) {
    eq(filasComoLaApp(rows, [], own, owner), [later]);
    eq(filasComoLaApp(rows, [], own, owner).reduce((n, r) => n + Math.round(r.importe * 100), 0), 320);
  }
});
