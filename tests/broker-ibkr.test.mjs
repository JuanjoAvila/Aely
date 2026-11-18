#!/usr/bin/env node
/**
 * Perfil Interactive Brokers del motor de importación por fichero (plan de brókers, fase 1 — 18/11/2026).
 *
 * NO HAY FICHEROS REALES (AGENTS §9). Los fixtures de tests/fixtures/brokers/ibkr-* son
 * SINTÉTICOS, con cifras inventadas y la forma pública de la documentación de IBKR:
 *   · Flex Query en XML: <FlexQueryResponse> → <FlexStatement> → <OpenPosition …/> y
 *     <CashReportCurrency …/>, todo en atributos (levelOfDetail SUMMARY y LOT);
 *   · Flex Query en CSV: los mismos campos en columnas (CurrencyPrimary, AssetClass, Quantity…),
 *     una cabecera por sección;
 *   · Activity Statement en CSV: multisección, «Sección,Header|Data|Total,…», con el ISIN en
 *     «Financial Instrument Information» y los miles con coma («2,282.2»).
 * El mismo parser XML servirá para la fase 3 (la API Flex devuelve ese XML).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fx = (n) => fs.readFileSync(path.join(root, "tests", "fixtures", "brokers", n), "utf8");
const ctx = loadPureLogicFromFile();
const J = (x) => JSON.parse(JSON.stringify(x));   // objetos del sandbox vm → de este reino
const ok = (name) => console.log(`  ✓ ${name}`);
console.log("broker-ibkr");

const XML = fx("ibkr-flex.xml"), CSV = fx("ibkr-flex.csv"), ACT = fx("ibkr-activity.csv");
const pick = (r) => r.acc.positions.map((p) => ({ key: p.key, isin: p.isin, shares: p.shares, cur: p.cur, v: p.valueHint, cost: p.cost, costEur: p.costEur, why: p.costWhy }))
  .sort((a, b) => (a.key < b.key ? -1 : 1));

/* 1. Flex XML y Flex CSV dan las mismas posiciones. SUMMARY manda sobre los lotes; el derivado no entra. */
{
  const rx = ctx.brokerAnalyze("ibkr", [XML], {});
  const rc = ctx.brokerAnalyze("ibkr", [CSV], {});
  assert.ok(rx.acc && rc.acc);
  assert.deepEqual(pick(rx), pick(rc));
  assert.equal(rx.acc.positions.length, 3, "AAPL, VWCE y PG; la opción no es una posición de la cartera");
  const aapl = rx.acc.positions.find((p) => p.isin === "US0378331005");
  assert.equal(aapl.shares, 10, "el SUMMARY (10), no la suma con los lotes (20)");
  assert.equal(rx.acc.positions.find((p) => p.isin === "US7427181091").name, "PROCTER & GAMBLE CO", "&amp; desescapado");
  assert.equal(rx.acc.to, "2024-11-15");
  assert.deepEqual(J(rx.acc.warnings), [{ k: "deriv", n: 1 }]);
  assert.deepEqual(J(rx.acc.cash), [{ cur: "EUR", amt: 1000 }, { cur: "USD", amt: 531.5 }], "el BASE_SUMMARY no es una divisa");
  assert.deepEqual(J(rc.acc.cash), J(rx.acc.cash));
  ok("Flex XML = Flex CSV; SUMMARY sobre lotes; derivados fuera y avisados; efectivo por divisa");
}

/* 2. Activity Statement multisección = las mismas posiciones; el ISIN sale de otra sección. */
{
  const ra = ctx.brokerAnalyze("ibkr", [ACT], {});
  assert.deepEqual(pick(ra), pick(ctx.brokerAnalyze("ibkr", [CSV], {})));
  assert.equal(ra.acc.to, "2024-11-15");
  // Dos vías: la fila «Total» de cada divisa contra la suma de lo leído; si no cuadrase, avisaría.
  assert.deepEqual(J(ra.acc.warnings), []);
  const roto = ACT.replace("Open Positions,Total,,Stocks,GBP,,,,,1200,,1365", "Open Positions,Total,,Stocks,GBP,,,,,1200,,1400");
  assert.deepEqual(J(ctx.brokerAnalyze("ibkr", [roto], {}).acc.warnings), [{ k: "total", name: "GBP" }]);
  ok("Activity Statement: posiciones de «Open Positions», ISIN de «Financial Instrument Information», cuadre con «Total»");
}

/* 3. Multidivisa: coste en € anclado solo si la posición ya es en €. fxRateToBase es el cambio del
      DÍA DEL INFORME, no el de compra: anclar con él congelaría un coste que no se pagó. */
{
  const p = Object.fromEntries(pick(ctx.brokerAnalyze("ibkr", [XML], {})).map((x) => [x.isin, x]));
  assert.equal(p.IE00BK5BQT80.cost, 2000); assert.equal(p.IE00BK5BQT80.costEur, 2000); assert.equal(p.IE00BK5BQT80.why, null);
  assert.equal(p.US0378331005.cur, "USD"); assert.equal(p.US0378331005.cost, 1500);
  assert.equal(p.US0378331005.costEur, null); assert.equal(p.US0378331005.why, "fx_today");
  assert.equal(p.US7427181091.cur, "GBP"); assert.equal(p.US7427181091.v, 1365, "el valor se queda en su moneda; a € lo pasa la app si hay cambio");
  ok("coste en € solo anclado cuando el fichero lo da; el resto en su moneda y dicho");
}

/* 4. Dos vías sobre el total: Σ posiciones × markPrice = Σ positionValue, y en € con fxRateToBase
      (0,9412 USD, 1 EUR, 1,2 GBP) da el total calculado a mano: 2.282,2 × 0,9412 = 2.148,01; + 2.402 + 1.365 × 1,2 = 1.638 → 6.188,01. */
{
  const r = ctx.brokerAnalyze("ibkr", [XML], {});
  const sumV = r.acc.positions.reduce((a, p) => a + p.valueHint, 0);
  const sumQ = r.acc.positions.reduce((a, p) => a + p.shares * p.price, 0);
  assert.equal(+sumV.toFixed(2), +sumQ.toFixed(2));
  const rate = { USD: 0.9412, EUR: 1, GBP: 1.2 };
  assert.equal(+r.acc.positions.reduce((a, p) => a + p.valueHint * rate[p.cur], 0).toFixed(2), 6188.01);
  ok("dos vías: Σ valor = Σ cantidad × precio, y el total en € a mano");
}

/* 5. Re-importar con una posición vendida: NO se borra, se marca; las demás se re-anclan. */
{
  const r1 = ctx.brokerAnalyze("ibkr", [XML], {});
  const map1 = Object.fromEntries(r1.acc.positions.map((p) => [p.key, "__new"]));
  const s1 = ctx.brkApplyFile({ investments: [] }, "ibkr", r1.acc.positions, map1, {}, r1.acc.to);
  assert.equal(s1.investments.length, 3);
  assert.ok(s1.investments.every((i) => i.ent === "ibkr" && i.src === "csv:ibkr" && i.ticker === undefined && i.fileSym));
  const sinPG = XML.replace(/<OpenPosition [^>]*symbol="PG"[^>]*\/>\n/, "");
  const r2 = ctx.brokerAnalyze("ibkr", [sinPG], {});
  const map2 = {};
  for (const po of r2.acc.positions) map2[po.key] = ctx.brkSuggest(po, s1.investments, "ibkr") || "";
  assert.ok(Object.values(map2).every(Boolean), "re-importar casa todo por ISIN: nada se duplica");
  const gone = ctx.brkGoneOf(s1.investments, "ibkr", r2.acc.positions, map2);
  assert.deepEqual(gone.map((i) => i.isin), ["US7427181091"]);
  const s2 = ctx.brkApplyFile(s1, "ibkr", r2.acc.positions, map2, { [gone[0].id]: 1 }, "2024-11-20");
  assert.equal(s2.investments.length, 3, "la vendida sigue ahí");
  assert.equal(s2.investments.find((i) => i.isin === "US7427181091").fileGone, "2024-11-20");
  // Y si vuelve a aparecer en un fichero posterior, la marca se quita sola.
  const s3 = ctx.brkApplyFile(s2, "ibkr", r1.acc.positions, Object.fromEntries(r1.acc.positions.map((p) => [p.key, ctx.brkSuggest(p, s2.investments, "ibkr")])), {}, "2024-11-25");
  assert.equal(s3.investments.find((i) => i.isin === "US7427181091").fileGone, undefined);
  ok("vendida: marcada, no borrada; re-importar no duplica; si vuelve, se desmarca");
}

/* 6. Cada fixture lo reconoce su perfil y ningún otro. */
{
  assert.deepEqual(J(ctx.brokerDetect(XML)), ["ibkr-flex-xml"]);
  assert.deepEqual(J(ctx.brokerDetect(CSV)), ["ibkr-flex-csv"]);
  assert.deepEqual(J(ctx.brokerDetect(ACT)), ["ibkr-activity"]);
  assert.equal(ctx.brokerAnalyze("degiro", [XML], {}).err, "other:ibkr");
  ok("detección: solo su perfil");
}

console.log("\nbroker-ibkr: OK");
