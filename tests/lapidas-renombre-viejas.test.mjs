/**
 * DIN-07 (FIN-29/30 R4): las lápidas GLOBALES que dejaban los renombres de antes de la 4.26.191
 * escondían a la otra cuenta con el mismo cargo. Se levantan una vez, con hora, solo si una fila
 * viva renombrada las explica; la migración 0032 hace lo mismo en la nube.
 * Datos sintéticos: ni nombres ni cuentas reales.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { transformSync } from "esbuild";
import { loadPureLogic } from "../scripts/load-pure-logic.mjs";

const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8"), c = loadPureLogic(html);
const sql = fs.readFileSync(new URL("../supabase/migrations/0032_lapidas_renombre_viejas.sql", import.meta.url), "utf8");
const srv = (() => { const m = { exports: {} }; new Function("module", "exports", transformSync(fs.readFileSync(new URL("../supabase/functions/_shared/presupuesto.ts", import.meta.url), "utf8"), { loader: "ts", format: "cjs" }).code)(m, m.exports); return m.exports; })();
const clone = x => JSON.parse(JSON.stringify(x));

const DAY = "2026-10-20";
// Sabadell: el banco mandó «Comercio Original» y se renombró a «Mi nombre» con la versión vieja.
const renombrada = { id: "11111111-1111-4111-8111-111111111111", ent: "sabadell", source: "ob", obAcc: "acc-sab", extId: "ref-sab",
  date: DAY + "T10:00:00.000Z", amount: 3.2, merchant: "Mi nombre", obName: "Comercio Original", category: "otros" };
// CaixaBank: otro cargo real, mismo día, importe y nombre bancario.
const otra = { id: "22222222-2222-4222-8222-222222222222", ent: "caixabank", source: "ob", obAcc: "acc-cx", extId: "ref-cx",
  date: DAY + "T10:00:00.000Z", amount: 3.2, merchant: "Comercio Original", obName: "Comercio Original", category: "otros" };
const LEGACY = DAY + "|3.2|Comercio Original"; // lo que escribía la versión vieja al renombrar

function estado(extra = {}) {
  return { expenses: [renombrada, otra], deleted: [LEGACY], deletedAt: undefined, lastSync: 1, _savedAt: 1000, ...extra };
}
const visibles = s => s.expenses.filter(e => !c.expenseIsTombstoned(e, c.expenseDeletedSet(s))).map(e => e.id);

test("antes: la lápida global vieja esconde la otra cuenta (el bug que se arregla)", () => {
  assert.deepEqual(clone(visibles(estado())), [renombrada.id], "solo se ve la renombrada: falta CaixaBank");
});

test("la migración levanta la lápida que explica el renombre y las dos cuentas se ven", () => {
  const s = c.lapidasRenombreMigra(estado(), 5000);
  assert.deepEqual(clone(s.deleted), []);
  assert.equal(s.deletedAt[LEGACY], 5000, "con hora: la copia sin hora de otro móvil no la devuelve");
  assert.equal("lapRenV" in s, false, "sin marcador de hecho: se re-evalua en cada pasada");
  assert.deepEqual(clone(visibles(s)).sort(), [renombrada.id, otra.id].sort());
});

test("sin fila viva que la explique, un borrado real NO se toca", () => {
  const s = estado({ expenses: [otra] });
  assert.deepEqual(clone(c.lapidasRenombreViejas(s)), []);
  assert.deepEqual(clone(c.lapidasRenombreMigra(s, 5000).deleted), [LEGACY]);
});

test("solo las claves globales `día|…`; las de cuenta, renombre y absorción no se tocan", () => {
  const otras = ["expense-account|x|" + LEGACY, "expense-rename|y|" + LEGACY, "ob-absorbed3|a|b|1||" + DAY + "|1"];
  const s = c.lapidasRenombreMigra(estado({ deleted: [LEGACY].concat(otras) }), 5000);
  assert.deepEqual(clone(s.deleted), otras);
});

test("P1 revision: un BORRADO real (misma clave que un renombre viejo) no se resucita", () => {
  // Gemelo borrado: la lapida global es SUYA y la fila renombrada no esconde a nadie.
  assert.deepEqual(clone(c.lapidasRenombreViejas(estado({ expenses: [renombrada] }))), []);
  // El escondido no tiene cuenta conocida: no se puede probar que sea otra cuenta.
  const sinCuenta = { ...otra, obAcc: undefined };
  assert.deepEqual(clone(c.lapidasRenombreViejas(estado({ expenses: [renombrada, sinCuenta] }))), []);
  // Misma cuenta: es el mismo cargo, no otra cuenta.
  const misma = { ...otra, ent: renombrada.ent, obAcc: renombrada.obAcc, id: "33333333-3333-4333-8333-333333333333" };
  assert.deepEqual(clone(c.lapidasRenombreViejas(estado({ expenses: [renombrada, misma] }))), []);
  // Y la renombrada sin cuenta tampoco prueba nada.
  assert.deepEqual(clone(c.lapidasRenombreViejas(estado({ expenses: [{ ...renombrada, obAcc: undefined }, otra] }))), []);
  const s = c.lapidasRenombreMigra(estado({ expenses: [renombrada] }), 5000);
  assert.deepEqual(clone(s.deleted), [LEGACY], "la lapida sigue");
});

test("manuales y filas sin renombrar no generan nada", () => {
  const manual = { ...renombrada, id: "m1", source: "manual" };
  const igual = { ...renombrada, id: "i1", merchant: renombrada.obName };
  assert.deepEqual(clone(c.lapidasRenombreViejas(estado({ expenses: [manual, igual] }))), []);
});

test("el ordinal #n del source entra en la clave, como en keyOfExpense", () => {
  const ord = { ...renombrada, obOrd: 2, date: DAY + "T10:00:00.001Z" };
  const k = LEGACY + "|#2";
  const otraOrd = { ...otra, obOrd: 2, date: DAY + "T10:00:00.001Z" };
  assert.deepEqual(clone(c.lapidasRenombreViejas(estado({ expenses: [ord, otraOrd], deleted: [k, LEGACY] }))), [k]);
});

test("idempotente: segunda pasada no cambia nada y no vuelve a escribir", () => {
  const una = c.lapidasRenombreMigra(estado(), 5000), dos = c.lapidasRenombreMigra(una, 9000);
  assert.deepEqual(clone(dos.deleted), clone(una.deleted));
  assert.deepEqual(clone(dos.deletedAt), clone(una.deletedAt));
});

test("un móvil viejo que aún trae la lápida SIN hora no la devuelve (unión por hora)", () => {
  const nube = c.lapidasRenombreMigra(estado({ _savedAt: 4000 }), 5000);
  const movilViejo = { deleted: [LEGACY], _savedAt: 3000 }; // guardado antes de la migración
  const u = c.lapidasUnion(movilViejo, nube);
  assert.deepEqual(clone(u.deleted), [], "gana el levantamiento posterior");
});

test("el servidor (filasComoLaApp) ve las dos cuentas con la lista ya limpia, y solo una con la vieja", () => {
  const wire = e => ({ id: e.id, fecha: e.date, importe: e.amount, comercio: e.merchant, ob_name: e.obName, source: c.expenseSourceForCloud(e) });
  const rows = [renombrada, otra].map(wire);
  assert.equal(srv.filasComoLaApp(clone(rows), [LEGACY]).length, 1, "antes: 320 de 640");
  assert.equal(srv.filasComoLaApp(clone(rows), c.lapidasRenombreMigra(estado(), 5000).deleted).length, 2);
});

// SQL: sin Postgres en el PC de desarrollo no se ejecuta; se vigila que sea el espejo de la lógica del cliente.
test("0032: espejo SQL de la clave y salvaguardas (no ejecutado contra Postgres)", () => {
  assert.match(sql, /to_char\(e\.fecha at time zone 'UTC', 'YYYY-MM-DD'\)/);
  assert.match(sql, /trim_scale\(e\.importe\)::text/);
  assert.match(sql, /'\|#' \|\| r\.ord/);
  assert.match(sql, /r.ob_name is distinct from r.comercio/);
  assert.match(sql, /source like 'ob:%' or e\.source like 'ob-hist:%'/);
  assert.match(sql, /where e\.user_id = p_user/);
  assert.match(sql, /\(o\.banco, o\.cuenta\) is distinct from \(r\.banco, r\.cuenta\)/);
  assert.match(sql, /security definer/);
  assert.match(sql, /greatest\(ahora, coalesce\(\(r\.data -> 'deletedAt' ->> k\)::bigint, 0\) \+ 1\)/);
  assert.match(sql, /grant execute on function public\.lapidas_renombre_viejas\(uuid\) to service_role/);
  assert.doesNotMatch(sql, /to authenticated/);
  assert.doesNotMatch(sql, /^select public\.lapidas_renombre_viejas/m, "no se ejecuta sola");
  assert.match(sql, /create index if not exists expenses_renombradas_idx/);
  assert.match(sql, /create or replace function public\.lapidas_renombre_viejas\(/);
  assert.match(sql, /revoke all on function public\.lapidas_renombre_viejas\(uuid\) from public, anon, authenticated/);
  assert.match(sql, /'\{deletedAt\}'/);
  assert.doesNotMatch(sql, /drop table|delete from public\.(expenses|app_state)|truncate/i);
});

test("el efecto de App levanta sin marcador y con la misma comprobacion que el test", () => {
  const app = fs.readFileSync(new URL("../src/modules/11-app-main.js", import.meta.url), "utf8");
  const i = app.indexOf("lapidasRenombreMigra(p,Date.now())");
  assert.ok(i > 0, "el efecto llama a la migracion");
  const bloque = app.slice(app.lastIndexOf("useEffect(", i), i + 200);
  assert.match(bloque, /!state\.lastSync/);
  assert.match(bloque, /lapidasRenombreViejas\(state\)\.length/);
  assert.match(bloque, /state\.deleted/);
  assert.doesNotMatch(bloque, /lapRenV/);
});
