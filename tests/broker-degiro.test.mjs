#!/usr/bin/env node
/**
 * Perfil DEGIRO del motor de importación por fichero (plan de brókers, fase 1 — 18/11/2026).
 *
 * NO HAY FICHEROS REALES: el amigo que usa DEGIRO todavía no ha pasado ninguno, y los de un
 * usuario no se commitean nunca (AGENTS §9, repo público). Los fixtures son SINTÉTICOS, con
 * cifras inventadas, y reproducen la forma pública de los exports de DEGIRO (web → Cartera →
 * Exportar; Bandeja de entrada → Transacciones → Exportar) tal como la describen la ayuda de
 * DEGIRO y los conversores de código abierto que los leen:
 *   · la cabecera cambia con el IDIOMA de la cuenta (es/en/nl/de);
 *   · el importe va con su divisa en una columna SIN NOMBRE pegada (delante en Cartera, detrás
 *     en Transacciones);
 *   · decimal en coma en es/nl/de y en punto en en; fechas dd-mm-aaaa.
 * Si el primer fichero real no cuadra con esto, se corrige aquí con el fichero delante.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fx = (n) => fs.readFileSync(path.join(root, "tests", "fixtures", "brokers", n), "utf8");
const ctx = loadPureLogicFromFile();
const ok = (name) => console.log(`  ✓ ${name}`);
console.log("broker-degiro");

const CARTERA_ES = fx("degiro-cartera-es.csv");
const TX_ES = fx("degiro-transacciones-es.csv");
// La misma cartera con las cabeceras de las otras tres lenguas. En inglés, decimal en punto.
const CARTERA_EN = `Product,Symbol/ISIN,Quantity,Closing,Local value,,Value in EUR
CASH & CASH FUND & FTX CASH (EUR),,,,EUR,125.40,125.40
APPLE INC. - COMMON STOCK,US0378331005,10,228.22,USD,2282.20,2100.50
VANGUARD FTSE ALL-WORLD UCITS ETF,IE00BK5BQT80,12.5,120.10,EUR,1501.25,1501.25
ASML HOLDING,NL0010273215,2,650.00,EUR,1300.00,1300.00
`;
const cuerpoComa = CARTERA_ES.split("\n").slice(1).join("\n");
const CARTERA_NL = "Product,Symbool/ISIN,Aantal,Slotkoers,Lokale waarde,,Waarde in EUR\n" + cuerpoComa;
const CARTERA_DE = "Produkt,Symbol/ISIN,Anzahl,Schlusskurs,Wert in Lokalwährung,,Wert in EUR\n" + cuerpoComa;
const TX_EN = `Date,Time,Product,ISIN,Reference exchange,Venue,Quantity,Price,,Local value,,Value,,Exchange rate,Transaction and/or third,,Total,,Order ID
10-09-2024,16:02,APPLE INC. - COMMON STOCK,US0378331005,NDQ,XNAS,-2,220.00,USD,440.00,USD,400.00,EUR,1.1000,-1.00,EUR,399.00,EUR,bbbb-2222
15-03-2024,15:31,APPLE INC. - COMMON STOCK,US0378331005,NDQ,XNAS,12,170.00,USD,-2040.00,USD,-1870.00,EUR,1.0909,-1.00,EUR,-1871.00,EUR,aaaa-1111
02-01-2024,09:05,VANGUARD FTSE ALL-WORLD UCITS ETF,IE00BK5BQT80,XET,XETA,12.5,100.00,EUR,-1250.00,EUR,-1250.00,EUR,,-2.00,EUR,-1252.00,EUR,cccc-3333
`;

const J = (x) => JSON.parse(JSON.stringify(x));   // objetos del sandbox vm → de este reino
const pick = (r) => r.acc.positions.map((p) => ({ key: p.key, shares: p.shares, cur: p.cur, v: p.valueHint, e: p.valueEurHint, cost: p.cost, costEur: p.costEur, why: p.costWhy }));

/* 1. Cartera sola, en las cuatro lenguas: las mismas posiciones, y el coste en «—» con su porqué. */
{
  const base = pick(ctx.brokerAnalyze("degiro", [CARTERA_ES], {}));
  assert.equal(base.length, 3, "tres posiciones; la fila del efectivo no es una posición");
  for (const [n, txt] of [["en", CARTERA_EN], ["nl", CARTERA_NL], ["de", CARTERA_DE]]) {
    assert.deepEqual(pick(ctx.brokerAnalyze("degiro", [txt], {})), base, "cartera " + n + " = es");
  }
  const vwce = base.find((p) => p.key === "IE00BK5BQT80");
  assert.equal(vwce.shares, 12.5, "«12,5» participaciones (decimal en coma) no es 125");
  const aapl = base.find((p) => p.key === "US0378331005");
  assert.equal(aapl.cur, "USD"); assert.equal(aapl.v, 2282.2); assert.equal(aapl.e, 2100.5);
  assert.ok(base.every((p) => p.cost == null && p.costEur == null && p.why === "need_tx"), "sin Transacciones no se inventa coste");
  ok("Cartera es/en/nl/de dan lo mismo; divisa en la columna sin nombre; coste «—» sin Transacciones");
}

/* 2. Dos vías (AGENTS §7) sobre la Cartera:
      · por fila, cantidad × cierre = valor local (si no, el parser avisa: aquí no puede avisar);
      · la suma de «Valor en EUR» de posiciones + efectivo = 5.027,15 €, sumado a mano del fixture. */
{
  const r = ctx.brokerAnalyze("degiro", [CARTERA_ES], {});
  assert.equal(r.acc.warnings.length, 0, "cantidad × cierre cuadra con el valor local en todas las filas");
  const posEur = r.acc.positions.reduce((a, p) => a + p.valueEurHint, 0);
  const cash = r.acc.cash.reduce((a, c) => a + c.amt, 0);
  assert.equal(+(posEur + cash).toFixed(2), 5027.15);
  assert.deepEqual(J(r.acc.cash), [{ cur: "EUR", amt: 125.4 }]);
  ok("dos vías: cantidad × cierre = valor local, y Σ valor en EUR + efectivo = total a mano");
}

/* 3. Transacciones → coste medio con venta parcial, en moneda local y anclado en € de la operación.
      AAPL: compra 12 por 2.040 $ (1.870 € + 1 € de comisión) y vende 2 → quedan 10/12 del coste.
        nativo: (2.040 + 1 € × 2.040/1.870) × 10/12 = 1.700,91 $
        en €:   1.871 × 10/12 = 1.559,17 €   (la otra vía: Σ «Total» de compras × fracción)
      VWCE: en euros, coste = Total = 1.252 €. ASML no sale en Transacciones → «—» y se dice. */
{
  const r = ctx.brokerAnalyze("degiro", [CARTERA_ES, TX_ES], {});
  const p = Object.fromEntries(pick(r).map((x) => [x.key, x]));
  assert.equal(p.US0378331005.cost, 1700.91);
  assert.equal(p.US0378331005.costEur, 1559.17);
  assert.equal(p.US0378331005.why, null);
  assert.equal(p.IE00BK5BQT80.cost, 1252); assert.equal(p.IE00BK5BQT80.costEur, 1252);
  assert.equal(p.NL0010273215.cost, null); assert.equal(p.NL0010273215.why, "tx_missing");
  ok("Transacciones: coste medio con venta parcial, nativo y en € anclado");
}

/* 4. En cualquier orden, en la misma tanda o en dos (la memoria de la tarjeta), y en inglés. */
{
  const a = pick(ctx.brokerAnalyze("degiro", [CARTERA_ES, TX_ES], {}));
  assert.deepEqual(pick(ctx.brokerAnalyze("degiro", [TX_ES, CARTERA_ES], {})), a, "orden inverso");
  const memo = {};
  assert.deepEqual(J(ctx.brokerAnalyze("degiro", [TX_ES], memo)), { err: "aux" }, "Transacciones solas: leídas, falta Cartera");
  assert.deepEqual(pick(ctx.brokerAnalyze("degiro", [CARTERA_ES], memo)), a, "en dos tandas");
  // El mismo fichero dos veces no duplica compras.
  assert.deepEqual(pick(ctx.brokerAnalyze("degiro", [CARTERA_ES], (ctx.brokerAnalyze("degiro", [TX_ES, TX_ES], memo), memo))), a);
  assert.deepEqual(pick(ctx.brokerAnalyze("degiro", [CARTERA_EN, TX_EN], {})), a, "en inglés con decimal en punto");
  ok("los dos ficheros en cualquier orden dan lo mismo, también en dos tandas y repetidos");
}

/* 5. Si las operaciones no explican lo que tienes (un traspaso de entrada), el coste no es el tuyo. */
{
  const corta = TX_ES.split("\n").filter((l) => !l.startsWith("10-09-2024")).join("\n");   // sin la venta: 12 ≠ 10
  const r = ctx.brokerAnalyze("degiro", [CARTERA_ES, corta], {});
  const aapl = r.acc.positions.find((p) => p.isin === "US0378331005");
  assert.equal(aapl.cost, null); assert.equal(aapl.costEur, null); assert.equal(aapl.costWhy, "tx_mismatch");
  ok("operaciones que no cuadran con la cartera → coste «—» y el porqué");
}

/* 6. Aplicar: solo lo mapeado, sin pisar, y lo vendido se marca (no se borra). */
{
  const s = { investments: [
    { id: "a", ent: "degiro", name: "Apple", isin: "US0378331005", shares: 8, value: 1500, cost: 1200, cur: "USD" },
    { id: "z", ent: "degiro", name: "Zalando", isin: "DE000ZAL1111", shares: 5, value: 100, cost: 90, cur: "EUR" },
    { id: "t", ent: "trade_republic", name: "Apple TR", isin: "US0378331005", ticker: "AAPL", shares: 3, value: 600, cost: 500, cur: "USD" },
  ] };
  const r = ctx.brokerAnalyze("degiro", [CARTERA_ES, TX_ES], {});
  const map = {};
  for (const po of r.acc.positions) map[po.key] = ctx.brkSuggest(po, s.investments, "degiro") || "";
  assert.equal(map.US0378331005, "a", "por ISIN, y dentro de DEGIRO (no la de Trade Republic)");
  assert.equal(map.IE00BK5BQT80, "", "sin pareja: «no tocar» por defecto");
  const gone = ctx.brkGoneOf(s.investments, "degiro", r.acc.positions, map);
  assert.deepEqual(gone.map((i) => i.id), ["z"]);
  const out = ctx.brkApplyFile(s, "degiro", r.acc.positions, map, { z: 1 }, "2024-11-15");
  const a = out.investments.find((i) => i.id === "a");
  assert.equal(a.shares, 10); assert.equal(a.value, 2282.2); assert.equal(a.cost, 1700.91); assert.equal(a.costEur, 1559.17);
  assert.equal(a.fileAt, "2024-11-15"); assert.equal(a.ticker, undefined, "no se engancha el precio en vivo");
  assert.equal(out.investments.length, 3, "nada creado sin pedirlo");
  assert.equal(out.investments.find((i) => i.id === "z").fileGone, "2024-11-15", "Zalando se marca");
  assert.deepEqual(J(out.investments.find((i) => i.id === "t")), s.investments[2], "Trade Republic intacto");
  // Crear la que falta: con su ISIN, su valor del fichero y su coste.
  map.IE00BK5BQT80 = "__new";
  const out2 = ctx.brkApplyFile(s, "degiro", r.acc.positions, map, {}, "2024-11-15");
  const nueva = out2.investments.find((i) => i.isin === "IE00BK5BQT80");
  assert.equal(nueva.ent, "degiro"); assert.equal(nueva.value, 1501.25); assert.equal(nueva.cost, 1252); assert.equal(nueva.src, "csv:degiro");
  // Sin coste en el fichero, el que había se respeta.
  const solo = ctx.brokerAnalyze("degiro", [CARTERA_ES], {});
  const out3 = ctx.brkApplyFile(s, "degiro", solo.acc.positions, { US0378331005: "a" }, {}, "2024-11-15");
  assert.equal(out3.investments.find((i) => i.id === "a").cost, 1200);
  ok("aplicar: solo lo mapeado, por ISIN y en su bróker, coste que no viene se respeta, vendida marcada");
}

/* 7. Cada fixture lo reconoce su perfil y ningún otro. */
{
  assert.deepEqual(J(ctx.brokerDetect(CARTERA_ES)), ["degiro-cartera"]);
  assert.deepEqual(J(ctx.brokerDetect(CARTERA_DE)), ["degiro-cartera"]);
  assert.deepEqual(J(ctx.brokerDetect(TX_ES)), ["degiro-tx"]);
  assert.deepEqual(J(ctx.brokerDetect(TX_EN)), ["degiro-tx"]);
  assert.equal(ctx.brokerAnalyze("revolut", [CARTERA_ES], {}).err, "other:degiro", "en la tarjeta de Revolut dice de quién es");
  ok("detección: solo su perfil");
}

/* 8. P3 de la revisión de dinero (18/11): un fichero donde TODAS las celdas tienen tres decimales
      no decide el separador por sí solo. Antes se adivinaba celda a celda (×1.000: 125 títulos y
      12.516 de valor); ahora decide el idioma de la cabecera, el mismo de los números. */
{
  const es = "Producto,Símbolo/ISIN,Cantidad,Precio de cierre,Valor local,,Valor en EUR\nFONDO X,IE0000000001,\"0,125\",\"100,125\",EUR,\"12,516\",\"12,516\"\n";
  const en = "Product,Symbol/ISIN,Quantity,Closing,Local value,,Value in EUR\nFUND X,IE0000000001,0.125,100.125,EUR,12.516,12.516\n";
  for (const [n, txt] of [["es", es], ["en", en]]) {
    const p = ctx.brokerAnalyze("degiro", [txt], {}).acc.positions[0];
    assert.equal(p.shares, 0.125, n + ": 0,125 títulos, no 125");
    assert.equal(p.valueHint, 12.516, n + ": 12,516 de valor, no 12.516");
  }
  ok("decimales ambiguos en todo el fichero: decide el idioma, nunca ×1.000");
}

/* 8b. Lo mismo en neerlandés: «Product» también es la cabecera NL, así que no puede decidir que el
       fichero va en inglés (segunda revisión de dinero 18/11: «0,125» volvía a salir 125). */
{
  const nl = "Product,Symbool/ISIN,Aantal,Slotkoers,Lokale waarde,,Waarde in EUR\nFONDS X,IE0000000001,\"0,125\",\"100,125\",EUR,\"12,516\",\"12,516\"\n";
  const p = ctx.brokerAnalyze("degiro", [nl], {}).acc.positions[0];
  assert.equal(p.shares, 0.125); assert.equal(p.valueHint, 12.516);
  // Y una fila con ISIN pero sin cantidad legible no se importa, pero no es «ya no está».
  const raro = CARTERA_ES + "FONDO RARO,IE0000000002,n/d,\"10,00\",EUR,\"40,00\",\"40,00\"\n";
  const r = ctx.brokerAnalyze("degiro", [raro], {});
  const inv = [{ id: "r", ent: "degiro", name: "Fondo raro", isin: "IE0000000002", src: "csv:degiro", shares: 4, value: 40, cur: "EUR" }];
  assert.deepEqual(J(ctx.brkGoneOf(inv, "degiro", r.acc.positions, {}, r.acc.present)), []);
  ok("neerlandés con decimales ambiguos; fila ilegible presente, no «ya no está»");
}

/* 8c. Tercera revisión de dinero (18/11): una fila con cantidad 0 es una posición CERRADA, no una
       ilegible. Contarla como presente dejaba a Tesla sumando 600 € después de venderla. */
{
  const conCero = CARTERA_ES + "TESLA INC,US88160R1014,0,\"200,00\",USD,\"0,00\",\"0,00\"\n";
  const st = { fxRates: { USD: 0.92 }, investments: [
    { id: "tsla", ent: "degiro", src: "csv:degiro", name: "Tesla", isin: "US88160R1014", shares: 3, value: 600, cost: 500, cur: "EUR" },
  ] };
  const r = ctx.brokerAnalyze("degiro", [conCero], {});
  assert.equal(r.acc.positions.find((p) => p.isin === "US88160R1014"), undefined, "a 0 no se importa");
  const gone = ctx.brkGoneOf(st.investments, "degiro", r.acc.positions, {}, r.acc.present);
  assert.deepEqual(gone.map((i) => i.id), ["tsla"], "sale como «ya no está»");
  const out = ctx.brkApplyFile(st, "degiro", r.acc.positions, {}, { tsla: 1 }, "2024-11-15");
  assert.equal(out.investments.reduce((a, i) => a + ctx.invValueEur(i, out), 0), 0, "y no suma");
  ok("cantidad 0 = cerrada: «ya no está» y fuera del total; solo lo ilegible cuenta como presente");
}

/* 9. P3: peniques (GBX). Con «Valor en EUR» la posición va en €; sin él, a libras ÷100. Nunca ×100. */
{
  const gbx = "Producto,Símbolo/ISIN,Cantidad,Precio de cierre,Valor local,,Valor en EUR\nUNILEVER,GB00B10RZP78,10,\"4550,00\",GBX,\"45500,00\",\"541,45\"\n";
  const p = ctx.brokerAnalyze("degiro", [gbx], {}).acc.positions[0];
  assert.equal(p.cur, "EUR"); assert.equal(p.valueHint, 541.45);
  const sinEur = gbx.replace(',"541,45"', ",");
  const q = ctx.brokerAnalyze("degiro", [sinEur], {}).acc.positions[0];
  assert.equal(q.cur, "GBP"); assert.equal(q.valueHint, 455); assert.equal(q.price, 45.5);
  ok("GBX: en € con el valor del fichero, o en libras ÷100");
}

/* 10. P2 de la revisión de dinero (18/11): lo marcado «ya no está» NO suma en el patrimonio.
       Antes seguía contando con su valor congelado, y si se vendió para comprar otra cosa, dos veces.
       Caso: Tesla ×3 por 600 € vendida y, con ese dinero, Apple ×10 por 2.282,20 $. */
{
  const st = { fx: 0.92, fxRates: { USD: 0.92 }, investments: [
    { id: "tsla", ent: "degiro", name: "Tesla", isin: "US88160R1014", shares: 3, value: 600, cost: 500, cur: "EUR", src: "csv:degiro" },
    { id: "z", ent: "degiro", name: "Zalando", isin: "DE000ZAL1111", shares: 5, value: 100, cost: 90, cur: "EUR", src: "csv:degiro" },
  ] };
  const r = ctx.brokerAnalyze("degiro", [CARTERA_ES, TX_ES], {});
  const map = { US0378331005: "__new" };
  const gone = ctx.brkGoneOf(st.investments, "degiro", r.acc.positions, map);
  const marks = Object.fromEntries(gone.map((i) => [i.id, 1]));
  const out = ctx.brkApplyFile(st, "degiro", r.acc.positions, map, marks, "2024-11-15");
  const total = (s) => s.investments.reduce((a, i) => a + ctx.invValueEur(i, s), 0);
  const coste = (s) => s.investments.reduce((a, i) => a + ctx.invCostEur(i, s), 0);
  // Por una vía: suma de lo que el motor da por vivo. Por la otra: solo Apple, a mano (2.282,20 × 0,92).
  assert.equal(+total(out).toFixed(2), +(2282.2 * 0.92).toFixed(2), "Tesla y Zalando ya no suman");
  assert.equal(+coste(out).toFixed(2), 1559.17, "ni su coste");
  assert.equal(out.investments.filter((i) => i.fileGone).length, 2, "siguen ahí, marcadas, para borrarlas o corregirlas");
  assert.equal(ctx.fxMissingOf(out), 0, "marcar no deja el total como «incompleto»");
  ok("patrimonio: lo vendido según el fichero no suma, ni valor ni coste");
}

/* 11. P3: una posición sin ISIN que SIGUE en el fichero (aunque se deje en «no tocar») no es «ya no está». */
{
  const conSym = CARTERA_ES + "CERTIFICADO RARO,XYZ123,4,\"10,00\",EUR,\"40,00\",\"40,00\"\n";
  const r = ctx.brokerAnalyze("degiro", [conSym], {});
  const inv = [{ id: "x1", ent: "degiro", name: "Certificado", fileSym: "XYZ123", src: "csv:degiro", shares: 4, value: 40, cur: "EUR" }];
  assert.deepEqual(J(ctx.brkGoneOf(inv, "degiro", r.acc.positions, {})), []);
  ok("sin ISIN pero en el fichero: no se marca como vendida");
}

/* Golden LOCAL, nunca commiteado: si alguien deja un export real en tests/fixtures/local/
   (ignorado por git), se valida por dos vías. Sin fichero, no hace nada. */
{
  const dir = path.join(root, "tests", "fixtures", "local");
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^degiro-.*\.csv$/i.test(f)) : [];
  for (const f of files) {
    const r = ctx.brokerAnalyze("degiro", [fs.readFileSync(path.join(dir, f), "utf8")], {});
    if (!r.acc) continue;
    assert.equal(r.acc.warnings.filter((w) => w.k === "check").length, 0, f + ": cantidad × cierre = valor local");
    ok("golden local " + f);
  }
}

console.log("\nbroker-degiro: OK");
