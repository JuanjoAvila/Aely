#!/usr/bin/env node
/**
 * DOS BANCOS NO SE COMEN EL UNO AL OTRO AL APLANAR EL HISTÓRICO.
 *
 * Medido con la sonda de SU móvil (12/9, 19:23 y 19:25, dos búsquedas con dos minutos de
 * diferencia):
 *
 *     19:23   bankReported    92   ·  llegan  40  ·  skippedUniq     0
 *     19:25   bankReported  1230   ·  llegan 106  ·  skippedUniq  1104
 *
 * Mil ciento cuatro filas de mil doscientas treinta tiradas en silencio. Su relato encaja al
 * milímetro: «la primera vez me salieron cosas del Sabadell y nada de Trade Republic; le doy otra
 * vez y sale TR y Revolut y todo genial, PEROOOOO desapareció el Sabadell, me marca 0».
 *
 * Causa: la clave anti-duplicados del aplanado era `ext_id|signo|fecha|importe|comercio` y **no
 * llevaba el banco**. Como Trade Republic no manda ni `ext_id` ni comercio, un cargo suyo y uno de
 * Sabadell del mismo día e importe eran «el mismo», y el segundo se descartaba.
 *
 * Es la TERCERA clave de identidad sin banco que aparece hoy, después de `histCandExisting` y del
 * susto del sync («un Revolut de 23 € se comía un TR»).
 */
import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx = loadPureLogicFromFile();

let fallos = 0;
const t = (nombre, fn) => {
  try { fn(); console.log("  ✓ " + nombre); }
  catch (e) { fallos++; console.error("  ✗ " + nombre + "\n      " + (e && e.message)); }
};

/* Lo que manda el Edge: un link por banco, con sus cuentas y sus transacciones. */
const link = (aspsp, txs) => ({ aspsp, accounts: [{ uid: aspsp + "-1", transactions: txs }] });
/* TR no manda ni ext_id ni comercio: así es como llega de verdad. */
const tx = (date, amount, extra) => Object.assign({ date, amount }, extra || {});

console.log("hist-uniq-por-banco");

t("su caso: mismo día e importe en dos bancos → entran LOS DOS", () => {
  const res = { links: [
    link("Sabadell", [tx("2026-09-01", 10.34)]),
    link("Trade Republic", [tx("2026-09-01", 10.34)]),
  ] };
  const r = ctx.histFlattenHistoryLinks(res, [], {}, {});
  assert.equal(r.out.length, 2, "una fila por banco");
  assert.equal(r.stats.skippedUniq, 0, "no se tira ninguna");
  const bancos = r.out.map((x) => x.ent).sort();
  assert.equal(new Set(bancos).size, 2, "y son de bancos distintos");
});

t("dentro del MISMO banco, la repetida se sigue tirando (para eso está la clave)", () => {
  const res = { links: [link("Sabadell", [tx("2026-09-01", 10.34), tx("2026-09-01", 10.34)])] };
  const r = ctx.histFlattenHistoryLinks(res, [], {}, {});
  assert.equal(r.out.length, 1);
  assert.equal(r.stats.skippedUniq, 1);
});

t("dos cuentas del mismo banco conservan el mismo cargo y reciben identidad de nube distinta", () => {
  const res = { links: [{ aspsp:"CaixaBank", accounts:[
    { uid:"cx-corriente", transactions:[tx("2026-09-10", 12.50, { merchant:"MERCADONA" })] },
    { uid:"cx-ahorro", transactions:[tx("2026-09-10", 12.50, { merchant:"MERCADONA" })] },
  ] }] };
  const r = ctx.histFlattenHistoryLinks(res, [], {}, {});
  assert.equal(r.out.length, 2);
  assert.equal(r.stats.skippedUniq, 0);
  assert.notEqual(r.out[0].stamp, r.out[1].stamp);
  assert.equal(r.out[0].stamp.slice(0,10), "2026-09-10");
  assert.equal(r.out[0].stamp,new Date("2026-09-10T12:00:00").toISOString(),
    "la primera cuenta conserva la misma terna que el sync diario");
  const ahorro=r.out.find(x=>x.stamp===ctx.histDate("2026-09-10", "ob-slot|caixabank|2026-09-10|12.5|MERCADONA|1"));
  assert.ok(ahorro, "la segunda cuenta recibe identidad estable al reimportar");
  assert.match(ahorro.stamp,/^2026-09-10T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

t("una sola cuenta conserva exactamente el sello de mediodía del sync diario", () => {
  const r=ctx.histFlattenHistoryLinks({links:[link("CaixaBank",[
    tx("2026-09-10",12.50,{merchant:"MERCADONA"})
  ])]},[],{},{});
  assert.equal(r.out[0].stamp,new Date("2026-09-10T12:00:00").toISOString());
  assert.equal(ctx.histDate("2026-09-10"),new Date("2026-09-10T12:00:00").toISOString());
});

t("la misma fila repetida dentro de una cuenta mantiene una sola identidad", () => {
  const row=tx("2026-09-10", 12.50, { merchant:"MERCADONA" });
  const res={links:[{aspsp:"CaixaBank",accounts:[{uid:"cx-corriente",transactions:[row,Object.assign({},row)]}]}]};
  const r=ctx.histFlattenHistoryLinks(res,[],{},{});
  assert.equal(r.out.length,1);
  assert.equal(r.stats.skippedUniq,1);
});

t("pendiente y contabilizado dentro de una cuenta conservan solo la versión final", () => {
  const res={links:[{aspsp:"CaixaBank",accounts:[{uid:"cx-corriente",transactions:[
    tx("2026-09-10",12.50,{merchant:"MERCADONA",status:"PDNG"}),
    tx("2026-09-10",12.50,{merchant:"MERCADONA",ext_id:"cargo-book",status:"BOOK"}),
  ]}]}]};
  const r=ctx.histFlattenHistoryLinks(res,[],{},{});
  assert.equal(r.out.length,1);
  assert.equal(r.out[0].id,"cargo-book");
  assert.equal(r.stats.skippedUniq,1);
});

t("el fallback de ingreso no cambia con el idioma", () => {
  const r=ctx.histFlattenHistoryLinks({links:[link("CaixaBank",[
    tx("2026-09-10",-12.50)
  ])]},[],{},{merchantIn:"Income"});
  assert.equal(r.out[0].merchant,"Ingreso");
});

t("tres bancos con el mismo cargo: tres filas, cero descartes", () => {
  const res = { links: [
    link("Sabadell", [tx("2026-08-31", 50)]),
    link("Trade Republic", [tx("2026-08-31", 50)]),
    link("Revolut", [tx("2026-08-31", 50)]),
  ] };
  const r = ctx.histFlattenHistoryLinks(res, [], {}, {});
  assert.equal(r.out.length, 3);
  assert.equal(r.stats.skippedUniq, 0);
});

t("y el signo no los mezcla: un ingreso y un gasto del mismo importe son dos cosas", () => {
  const res = { links: [link("Sabadell", [tx("2026-09-01", 13.72), tx("2026-09-01", -13.72)])] };
  const r = ctx.histFlattenHistoryLinks(res, [], {}, {});
  assert.equal(r.out.length, 2);
});

t("el mismo ext_id de Sabadell y Caixa son dos identidades", () => {
  const res = { links: [
    link("Sabadell", [tx("2026-09-01", 13.72, { ext_id:"shared" })]),
    link("CaixaBank", [tx("2026-09-02", 28.40, { ext_id:"shared" })]),
  ] };
  const r = ctx.histFlattenHistoryLinks(res, [], {}, {});
  assert.equal(r.out.length, 2);
  assert.equal(r.stats.skippedExt, 0);
});

t("un ext_id ya importado solo bloquea al mismo banco", () => {
  const res = { links: [
    link("Sabadell", [tx("2026-09-01", 13.72, { ext_id:"shared" })]),
    link("CaixaBank", [tx("2026-09-02", 28.40, { ext_id:"shared" })]),
  ] };
  const expenses = [{ id:"old", extId:"shared", ent:"sabadell", source:"ob-hist",
    date:"2026-09-01T12:00:00.000Z", amount:13.72, merchant:"Viejo" }];
  const r = ctx.histFlattenHistoryLinks(res, expenses, {}, {});
  assert.equal(r.out.length, 1);
  assert.equal(r.out[0].ent, "caixabank");
  assert.equal(r.stats.skippedExt, 1);
});

console.log(fallos ? `hist-uniq-por-banco: ${fallos} fallo(s)` : "hist-uniq-por-banco: OK");
process.exit(fallos ? 1 : 0);
