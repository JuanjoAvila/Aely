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
  // `\r?`: con core.autocrlf=true el fixture sale de git con CRLF (revisión de dinero 18/11).
  const sinPG = XML.replace(/<OpenPosition [^>]*symbol="PG"[^>]*\/>\r?\n/, "");
  assert.notEqual(sinPG, XML, "la fila de PG se ha quitado de verdad");
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

/* 7. P1 de la revisión de dinero (18/11): un Flex con DOS cuentas (individual + conjunta) trae una
      SUMMARY por cuenta. Antes se quedaba la última: VWCE 20+5 salía 5 y el patrimonio bajaba
      2.402 € sin aviso. Ahora se suma por cuenta, y se dice que es la suma de dos. */
{
  const otra = '<OpenPosition accountId="U0000001" currency="EUR" fxRateToBase="1" assetCategory="STK" symbol="VWCE" description="VANGUARD FTSE ALL-WORLD" conid="1000001" isin="IE00BK5BQT80" listingExchange="IBIS2" multiplier="1" reportDate="20241115" position="5" markPrice="120.1" positionValue="600.5" costBasisMoney="550" levelOfDetail="SUMMARY" side="Long" />\n';
  const dos = XML.replace("</OpenPositions>", otra + "</OpenPositions>");
  const r = ctx.brokerAnalyze("ibkr", [dos], {});
  const vwce = r.acc.positions.find((p) => p.isin === "IE00BK5BQT80");
  assert.equal(vwce.shares, 25, "20 + 5, no 5");
  assert.equal(vwce.valueHint, 3002.5); assert.equal(vwce.cost, 2550); assert.equal(vwce.costEur, 2550);
  assert.equal(r.acc.positions.find((p) => p.isin === "US0378331005").shares, 10, "AAPL: SUMMARY de su cuenta, no sumada con sus lotes");
  assert.ok(J(r.acc.warnings).some((w) => w.k === "accounts" && w.n === 2), "avisa de que suma dos cuentas");
  // Dos vías: Σ valor de VWCE = Σ positionValue de sus dos filas SUMMARY (2.402 + 600,5).
  assert.equal(vwce.valueHint, 2402 + 600.5);
  // El mismo valor en dos monedas no se suma: no entra y se avisa.
  const mix = XML.replace("</OpenPositions>", otra.replace('currency="EUR"', 'currency="USD"') + "</OpenPositions>");
  const rm = ctx.brokerAnalyze("ibkr", [mix], {});
  assert.equal(rm.acc.positions.find((p) => p.isin === "IE00BK5BQT80"), undefined);
  assert.ok(J(rm.acc.warnings).some((w) => w.k === "mixcur"));
  // La misma cuenta en el CSV (ClientAccountID) sigue dando lo de siempre.
  assert.equal(ctx.brokerAnalyze("ibkr", [CSV], {}).acc.warnings.some((w) => w.k === "accounts"), false);
  ok("varias cuentas: se suman por cuenta y se avisa; dos monedas no se mezclan");
}

/* 7b. Segunda revisión de dinero (18/11): un ISIN que llega en DOS monedas (VWCE en Xetra en € y la
       misma ISIN en Londres en $) no se importa, pero SIGUE en el fichero: no puede salir como «ya no
       está», que la marcaba por defecto y bajaba el patrimonio 2.402 € sin motivo. Lo mismo con una
       cantidad ilegible. (Una posición CORTA no: ver 7c.) */
{
  const s = { investments: [
    { id: "vwce", ent: "ibkr", src: "csv:ibkr", name: "VANGUARD FTSE ALL-WORLD", isin: "IE00BK5BQT80", fileSym: "VWCE", shares: 20, value: 2402, cost: 2000, costEur: 2000, cur: "EUR" },
    { id: "pg", ent: "ibkr", src: "csv:ibkr", name: "PROCTER & GAMBLE CO", isin: "US7427181091", fileSym: "PG", shares: 30, value: 1365, cost: 1200, cur: "GBP" },
  ], fxRates: { GBP: 1.2 } };
  const londres = '<OpenPosition accountId="U0000001" currency="USD" fxRateToBase="0.94" assetCategory="STK" symbol="VWRD" description="VANGUARD FTSE ALL-WORLD" isin="IE00BK5BQT80" listingExchange="LSE" position="5" markPrice="130" positionValue="650" costBasisMoney="600" levelOfDetail="SUMMARY" />\n';
  const ilegible = XML.replace(/(symbol="PG"[^>]*?)position="30"/, '$1position="n/d"');
  const r = ctx.brokerAnalyze("ibkr", [ilegible.replace("</OpenPositions>", londres + "</OpenPositions>")], {});
  assert.equal(r.acc.positions.find((p) => p.isin === "IE00BK5BQT80"), undefined, "en dos monedas no se importa");
  assert.equal(r.acc.positions.find((p) => p.isin === "US7427181091"), undefined, "cantidad ilegible no se importa");
  assert.ok(J(r.acc.warnings).some((w) => w.k === "mixcur"));
  const map = {};
  for (const po of r.acc.positions) map[po.key] = ctx.brkSuggest(po, s.investments, "ibkr") || "";
  assert.deepEqual(J(ctx.brkGoneOf(s.investments, "ibkr", r.acc.positions, map, r.acc.present)), [], "ninguna sale como «ya no está»");
  // Por la otra vía: aplicar con lo que el motor marca deja el patrimonio igual.
  const total = (st) => st.investments.reduce((a, i) => a + ctx.invValueEur(i, st), 0);
  const marks = Object.fromEntries(ctx.brkGoneOf(s.investments, "ibkr", r.acc.positions, map, r.acc.present).map((i) => [i.id, 1]));
  assert.equal(total(ctx.brkApplyFile(s, "ibkr", r.acc.positions, map, marks, "2024-11-15")), total(s), "el patrimonio no baja");
  ok("lo que el fichero trae pero no se importa sigue presente: no se marca ni sale del total");
}

/* 7c. Tercera revisión de dinero (18/11): una posición que pasa de larga a CORTA no se importa (se
       avisa), y la larga de antes ya no está: si contara como presente seguiría sumando su valor. */
{
  const s = { investments: [
    { id: "pg", ent: "ibkr", src: "csv:ibkr", name: "PROCTER & GAMBLE CO", isin: "US7427181091", fileSym: "PG", shares: 30, value: 1365, cost: 1200, cur: "GBP" },
  ], fxRates: { GBP: 1.2, USD: 0.92 } };
  const corta = XML.replace(/(symbol="PG"[^>]*?)position="30"/, '$1position="-10"');
  const r = ctx.brokerAnalyze("ibkr", [corta], {});
  assert.ok(J(r.acc.warnings).some((w) => w.k === "short" && w.n === 1), "avisa de la corta");
  const map = {};
  for (const po of r.acc.positions) map[po.key] = ctx.brkSuggest(po, s.investments, "ibkr") || "";
  const gone = ctx.brkGoneOf(s.investments, "ibkr", r.acc.positions, map, r.acc.present);
  assert.deepEqual(gone.map((i) => i.id), ["pg"], "la larga de antes sale como «ya no está»");
  const out = ctx.brkApplyFile(s, "ibkr", r.acc.positions, map, { pg: 1 }, "2024-11-15");
  assert.equal(ctx.invValueEur(out.investments[0], out), 0, "y ya no suma");
  ok("de larga a corta: avisa, la larga sale como «ya no está» y no suma");
}

/* 8. P3: un costEur anclado no se tira si el fichero trae lo mismo sin ancla; y una posición de un
      bróker con sincronización propia (Trade Republic) no se toca aunque se mapee a ella. */
{
  const r = ctx.brokerAnalyze("ibkr", [XML], {});
  const s = { investments: [
    { id: "a", ent: "ibkr", name: "APPLE INC", isin: "US0378331005", shares: 10, value: 2282.2, cost: 1500, costEur: 1380, cur: "USD" },
    { id: "t", ent: "trade_republic", name: "Apple TR", isin: "US7427181091", ticker: "PG", shares: 3, value: 100, cost: 90, cur: "EUR" },
  ] };
  const out = ctx.brkApplyFile(s, "ibkr", r.acc.positions, { US0378331005: "a", US7427181091: "t" }, {}, "2024-11-15");
  assert.equal(out.investments.find((i) => i.id === "a").costEur, 1380, "mismas participaciones y coste: el ancla se queda");
  assert.deepEqual(J(out.investments.find((i) => i.id === "t")), s.investments[1], "Trade Republic intacta");
  // Si cambian las participaciones, el ancla vieja ya no vale y se quita.
  const s2 = { investments: [Object.assign({}, s.investments[0], { shares: 8, cost: 1200 })] };
  assert.equal(ctx.brkApplyFile(s2, "ibkr", r.acc.positions, { US0378331005: "a" }, {}, "x").investments[0].costEur, undefined);
  assert.equal(ctx.brkTargetOk({ ent: "myinvestor" }, "ibkr"), false);
  assert.equal(ctx.brkTargetOk({ ent: "revolut" }, "ibkr"), true);
  ok("costEur anclado se conserva si nada cambia; TR/MyInvestor fuera del mapeo");
}

console.log("\nbroker-ibkr: OK");
