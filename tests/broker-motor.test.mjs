#!/usr/bin/env node
/**
 * Motor común de importación por fichero (plan de brókers, fase 0 — 18/11/2026).
 *
 * La promesa de la fase 0 es que Revolut (acciones y metales) pasa a ser un perfil más SIN
 * CAMBIAR LO QUE HACE. Aquí se guarda, copiado tal cual, el `analyzeAll` de la tarjeta de Revolut
 * de antes del motor (beta 4.26.241) y se compara con `brokerAnalyze` sobre los mismos ficheros:
 * mismas posiciones, mismos costes, mismos totales y mismos errores. Si un día el motor se aparta
 * de Revolut, esto falla antes que la cartera de la familia.
 *
 * Fixtures: el golden de Revolut del repo y los metales inventados de revo-metales-coste (misma
 * forma que los CSV reales del usuario, que no se commitean — AGENTS §9).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ctx = loadPureLogicFromFile();
const J = (x) => JSON.parse(JSON.stringify(x));
const ok = (name) => console.log(`  ✓ ${name}`);
console.log("broker-motor");

// El analyzeAll de Revolut tal y como estaba (sin React: devuelve lo que antes iba a setErr/setParsed).
function viejo(txts, mcosts) {
  const acc = { positions: [], dividends: 0, fees: 0, from: null, to: null, skipped: 0 };
  let any = false, allPnl = true, fiatN = 0;
  txts.forEach((src) => {
    const c = ctx.revoMetalCostsFromFiat(src);
    if (c) { fiatN++; Object.keys(c).forEach((tk) => { Object.assign(mcosts[tk] || (mcosts[tk] = {}), c[tk]); }); }
  });
  txts.forEach((src) => {
    let res = null;
    const p = ctx.revoParse(src);
    const agg = p ? ctx.revoAggregate(p) : null;
    if (agg && agg.positions.length) res = Object.assign({}, agg, { from: p.from, to: p.to, skipped: p.skipped });
    else {
      res = ctx.revoParseCommodities(src);
      if (res) res.positions.forEach((po) => { if (po.metal && po.mov) po.cost = ctx.revoMetalCost(po.mov, mcosts[po.ticker]); });
    }
    if (!res) { if (!ctx.revoIsPnl(src)) allPnl = false; return; }
    any = true;
    res.positions.forEach((po) => {
      const j = acc.positions.findIndex((x) => x.ticker === po.ticker);
      if (j >= 0) acc.positions[j] = po; else acc.positions.push(po);
    });
    acc.dividends += res.dividends || 0; acc.fees += res.fees || 0; acc.skipped += res.skipped || 0;
    if (res.from && (!acc.from || res.from < acc.from)) acc.from = res.from;
    if (res.to && (!acc.to || res.to > acc.to)) acc.to = res.to;
  });
  if (!any) return { err: fiatN ? "fiat" : (allPnl ? "pnl" : "bad") };
  return { acc };
}
// El motor añade la clave común (`key`, que en Revolut ES el ticker) y los campos vacíos de los perfiles nuevos.
function nuevo(txts, memo) {
  const r = ctx.brokerAnalyze("revolut", txts, memo);
  if (r.err) return { err: r.err === "aux" ? "fiat" : r.err };
  const acc = J(r.acc);
  acc.positions.forEach((p) => { assert.equal(p.key, p.ticker); delete p.key; });
  assert.deepEqual(acc.cash, []); assert.deepEqual(acc.warnings, []); assert.equal(acc.snapshot, false);
  delete acc.cash; delete acc.warnings; delete acc.snapshot;
  return { acc };
}
const igual = (txts, msg) => assert.deepEqual(nuevo(txts, {}), J(viejo(txts, {})), msg);

const GOLDEN = fs.readFileSync(path.join(root, "tests", "fixtures", "revolut-golden.csv"), "utf8");
const CAB = "Tipo,Producto,Fecha de inicio,Fecha de finalización,Descripción,Importe,Comisión,Divisa,State,Saldo";
const fila = (ts, desc, imp, com, div, saldo) => `Cambio,Actual,${ts},${ts},${desc},${imp},${com},${div},COMPLETADO,${saldo}`;
const METALES = [CAB,
  fila("2025-08-28 15:56:48", "Conversión a XAU", "0.033804", "0.000338", "XAU", "0.033466"),
  fila("2025-09-29 14:49:11", "Conversión a XAU", "0.030402", "0.000304", "XAU", "0.063564"),
  fila("2026-01-30 11:10:02", "Conversión a XAG", "1.500000", "0.015000", "XAG", "1.485000"),
].join("\n");
const EUROS = [CAB,
  fila("2025-08-28 15:56:48", "Conversión a XAU", "-100.00", "0.00", "EUR", "595.93"),
  fila("2025-09-29 14:49:11", "Conversión a XAU", "-150.00", "0.00", "EUR", "286.46"),
  fila("2026-01-30 11:10:02", "Conversión a XAG", "-45.00", "0.50", "EUR", "241.46"),
].join("\n");
const PNL = "Date acquired,Date sold,Symbol,Quantity,Cost basis,Gross proceeds,Gross PnL\n2025-01-01,2025-02-01,AAPL,1,100,110,10";
const ACCIONES2 = "Date,Ticker,Type,Quantity,Price per share,Total Amount,Currency,FX Rate\n2025-10-01,NVDA,BUY - MARKET,\"0,5\",\"$100,00\",\"$50,00\",USD,1.1";

/* 1. Los mismos ficheros dan exactamente lo mismo que antes, en cualquier combinación. */
igual([GOLDEN], "acciones");
igual([METALES], "metales sin la pata en €");
igual([METALES, EUROS], "metales + euros");
igual([EUROS, METALES], "euros + metales (orden inverso)");
igual([GOLDEN, METALES, EUROS], "las tres juntas");
igual([GOLDEN, ACCIONES2], "mismo ticker en dos ficheros: manda el último");
ok("Revolut acciones y metales: idénticos al importador de antes");

/* 2. Los errores, también: solo euros = «falta el otro» (no un fallo), PnL, y basura. */
igual([EUROS], "solo el extracto en €");
igual([PNL], "pérdidas y ganancias");
igual(["hola,que,tal\n1,2,3"], "basura");
igual([""], "vacío");
igual([PNL, "hola,que,tal\n1,2,3"], "PnL + basura = basura");
ok("errores idénticos: aux (antes «fiat»), pnl y bad");

/* 3. La memoria entre tandas: el extracto en € hoy y el de metales mañana. */
{
  const memoN = {}, memoV = {};
  assert.deepEqual(nuevo([EUROS], memoN), J(viejo([EUROS], memoV)));
  assert.deepEqual(nuevo([METALES], memoN), J(viejo([METALES], memoV)));
  const oro = nuevo([METALES], memoN).acc.positions.find((p) => p.ticker === "XAU");
  assert.equal(oro.cost, 250, "el coste sale de la tanda anterior");
  ok("memoria entre tandas igual que el fiatRef de antes");
}

/* 4. Detección: cada fixture la reconoce su perfil y ningún otro. */
assert.deepEqual(J(ctx.brokerDetect(GOLDEN)), ["revolut-stocks"]);
assert.deepEqual(J(ctx.brokerDetect(METALES)), ["revolut-metals"]);
assert.deepEqual(J(ctx.brokerDetect(EUROS)), ["revolut-fiat"]);
assert.deepEqual(J(ctx.brokerDetect("hola,que,tal\n1,2,3")), []);
ok("detección: solo su perfil");

/* 5. Números con el decimal decidido por fichero, no por celda. */
assert.equal(ctx.brkDecimal([["0,125", "189,95"]]), ",");
assert.equal(ctx.brkDecimal([["0.125", "189.95"]]), ".");
assert.equal(ctx.brkNum("0,125", ","), 0.125, "con coma decimal, «0,125» no son 125");
assert.equal(ctx.brkNum("1.234,50", ","), 1234.5);
assert.equal(ctx.brkNum("2,282.2", "."), 2282.2);
assert.equal(ctx.brkNum("-1.00", "."), -1);
assert.equal(ctx.brkNum("", "."), null);
ok("separador decimal por fichero");

console.log("\nbroker-motor: OK");
