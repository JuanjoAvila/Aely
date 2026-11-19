#!/usr/bin/env node
/**
 * Brókers por CONEXIÓN en el cliente (IBKR Flex, Kraken solo lectura — 19/11/2026).
 *
 * El servidor devuelve lo que hay en el bróker; el dinero se decide aquí, con el motor de la 243.
 * Lo que tiene que cumplirse (decisiones del dueño del 19/11):
 *   1. La PRIMERA lectura no toca la cartera sin pasar por la vista previa.
 *   2. Las siguientes re-anclan solas lo que ya casa y marcan lo vendido, pero una posición NUEVA
 *      se PROPONE, no se crea.
 *   3. Una lectura parcial (sin `snapshot`) o un número raro no marcan ni crean nada.
 *   4. Kraken no da coste: «—», nunca 0.
 * Datos SINTÉTICOS (AGENTS §9).
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
console.log("broker-api");

const XML = fs.readFileSync(path.join(root, "tests", "fixtures", "brokers", "ibkr-flex.xml"), "utf8");
const kraken = (positions, extra = {}) => Object.assign({ ok: true, broker: "kraken", snapshot: true, asOf: "2026-11-19", positions, present: [], cash: [{ cur: "EUR", amt: 3 }], warnings: [] }, extra);
const btc = (shares, value) => ({ key: "BTC", sym: "BTC", name: "BTC", shares, cur: "EUR", valueHint: value, price: value / shares, cost: null, costEur: null });

/* 1. Respuesta del servidor → lo mismo que sale de un fichero. */
{
  const p = ctx.brkApiSnapshot({ ok: true, broker: "ibkr", snapshot: true, flexXml: XML });
  assert.equal(p.positions.length, 3, "IBKR pasa por ibkrParseFlexXml: el derivado no entra");
  assert.equal(p.to, "2024-11-15");
  const k = ctx.brkApiSnapshot(kraken([btc(0.5, 30000), { key: "DOGE", sym: "DOGE", shares: 0, valueHint: 1 }, { key: "X", sym: "X", shares: 2, valueHint: "NaN" }]));
  assert.deepEqual(J(k.positions.map((x) => [x.key, x.shares, x.valueHint, x.cost, x.costWhy])), [["BTC", 0.5, 30000, null, "api_nocost"]]);
  assert.deepEqual(J(k.present), ["DOGE", "X"], "lo que no entra sigue presente: no se marca como vendido");
  for (const bad of [null, { ok: false }, { ok: true, broker: "kraken", positions: [] }, { ok: true, snapshot: true, broker: "binance", positions: [] }]) {
    assert.equal(ctx.brkApiSnapshot(bad), null, JSON.stringify(bad));
  }
  ok("IBKR por el parser de la 243; Kraken saneado; sin snapshot completo, nada");
}

/* 2. Primera lectura: lo que el usuario decide, y nada más. Sin ella, `brkApiAuto` no toca nada. */
{
  const s0 = { investments: [{ id: "man", ent: "kraken", name: "Bitcoin a mano", value: 100, cost: 80, cur: "EUR" }] };
  const parsed = ctx.brkApiSnapshot(kraken([btc(0.5, 30000), { key: "ETH", sym: "ETH", name: "ETH", shares: 2, cur: "EUR", valueHint: 6000 }]));
  assert.equal(ctx.brkApiAuto(s0, "kraken", parsed), null, "sin revisión no se toca la cartera");
  const s1 = J(ctx.brkApiReview(s0, "kraken", parsed, { BTC: "man", ETH: "" }, {}));
  const man = s1.investments.find((i) => i.id === "man");
  assert.deepEqual([man.shares, man.value, man.cost, man.src, man.fileSym], [0.5, 30000, 80, "api:kraken", "BTC"], "re-anclado sin pisar el coste que había");
  assert.equal(s1.investments.length, 1, "ETH en «no tocar» no se crea");
  assert.deepEqual(s1.brokerApi.kraken.known, ["BTC", "ETH"]);
  assert.deepEqual(s1.brokerApi.kraken.pend, []);
  ok("primera lectura: solo lo mapeado; lo descartado queda conocido");

  /* 3. Siguiente lectura: re-ancla, PROPONE lo nuevo y no re-pregunta lo descartado. */
  const parsed2 = ctx.brkApiSnapshot(kraken([btc(0.6, 36000), { key: "ETH", sym: "ETH", shares: 2, valueHint: 6000 }, { key: "SOL", sym: "SOL", shares: 10, valueHint: 1500 }]));
  const r = ctx.brkApiAuto(s1, "kraken", parsed2);
  const s2 = J(r.s);
  assert.deepEqual([r.n, r.pend, r.gone], [1, 1, 0]);
  assert.equal(s2.investments.length, 1, "SOL no se crea sola");
  assert.equal(s2.investments[0].shares, 0.6);
  assert.deepEqual(s2.brokerApi.kraken.pend.map((p) => p.key), ["SOL"]);
  // Revisar la propuesta: crearla. Ya no queda pendiente.
  const s3 = J(ctx.brkApiReview(s2, "kraken", { positions: s2.brokerApi.kraken.pend, present: [], snapshot: false, to: "2026-11-19" }, { SOL: "__new" }, {}));
  const sol = s3.investments.find((i) => i.fileSym === "SOL");
  assert.deepEqual([sol.ent, sol.src, sol.value, sol.cost], ["kraken", "api:kraken", 1500, null], "coste «—», no 0");
  assert.deepEqual(s3.brokerApi.kraken.pend, []);
  ok("siguientes lecturas: re-ancla lo que casa, propone lo nuevo, crear solo al revisarlo");

  /* 4. Vendido: se marca lo que puso esta conexión; lo de a mano de otro origen, no. */
  const s4 = Object.assign({}, s3, { investments: s3.investments.concat([{ id: "otro", ent: "kraken", name: "Ledger", value: 50, cur: "EUR" }]) });
  const r4 = ctx.brkApiAuto(s4, "kraken", ctx.brkApiSnapshot(kraken([{ key: "SOL", sym: "SOL", shares: 10, valueHint: 1500 }])));
  const s5 = J(r4.s);
  assert.equal(r4.gone, 1);
  assert.ok(s5.investments.find((i) => i.id === "man").fileGone, "BTC ya no está: marcado, no borrado");
  assert.ok(!s5.investments.find((i) => i.id === "otro").fileGone, "lo que no viene de la conexión no se marca solo");
  // Y una segunda pasada no vuelve a cambiar la fecha de la marca.
  assert.equal(ctx.brkApiAuto(s5, "kraken", ctx.brkApiSnapshot(kraken([{ key: "SOL", sym: "SOL", shares: 10, valueHint: 1500 }]))).gone, 0);
  ok("lo vendido se marca (sale del total) sin borrarse; solo lo de la conexión");
}

/* 5. Lo que re-ancla una conexión no se ofrece al importar otro bróker (contaría doble). */
{
  assert.equal(ctx.brkTargetOk({ ent: "kraken", src: "api:kraken" }, "degiro"), false);
  assert.equal(ctx.brkTargetOk({ ent: "kraken", src: "api:kraken" }, "kraken"), true);
  assert.equal(ctx.brkTargetOk({ ent: "sabadell" }, "degiro"), true);
  assert.equal(ctx.brkTargetOk({ ent: "myinvestor" }, "degiro"), false);
  assert.deepEqual(J(ctx.brkGoneOf([{ id: "a", ent: "ibkr", src: "api:ibkr", fileSym: "ZZZ" }], "ibkr", [], {}, [])).map((i) => i.id), ["a"]);
  ok("posiciones `api:` fuera de otros importadores; brkGoneOf las reconoce");
}

/* 6. Cada código cerrado del servidor tiene su texto (o el genérico): nunca se pinta el del bróker. */
{
  const srv = ["supabase/functions/_shared/brokers/ibkr.ts", "supabase/functions/_shared/brokers/kraken.ts", "supabase/functions/_shared/brokers/handlers.ts"]
    .map((f) => fs.readFileSync(path.join(root, f), "utf8")).join("\n");
  const codes = new Set();
  for (const m of srv.matchAll(/"((?:flex|kraken)_[a-z0-9_]+)"/g)) codes.add(m[1]);
  for (const m of srv.matchAll(/code: "([a-z_]+)"/g)) if (m[1] !== "error" && m[1] !== "store") codes.add(m[1]);
  const faltan = [...codes].filter((c) => ctx.BRK_API_CODES.indexOf(c) < 0);
  assert.deepEqual(faltan, [], "códigos del servidor sin texto en la app");
  assert.ok(codes.has("flex_1012") && codes.has("kraken_perm") && codes.has("no_key"), "el recorrido vio los códigos");
  assert.equal(ctx.brkApiErr("algo raro del bróker <b>"), "bx_e_error");
  ok("todos los códigos del servidor tienen texto; lo desconocido va al genérico");
}

/* 7. Revisión de dinero (19/11). D1: «no tocar» se respeta en automático aunque coincida el ISIN. */
{
  const xml = (n, v) => `<FlexQueryResponse><FlexStatements><FlexStatement accountId="U0000000" toDate="20261118"><OpenPositions><OpenPosition accountId="U0000000" currency="EUR" assetCategory="STK" symbol="VWCE" description="VANGUARD FTSE ALL-WORLD" isin="IE00BK5BQT80" listingExchange="IBIS2" position="${n}" markPrice="${v / n}" positionValue="${v}" levelOfDetail="SUMMARY"/></OpenPositions></FlexStatement></FlexStatements></FlexQueryResponse>`;
  const res = (n, v) => ({ ok: true, broker: "ibkr", snapshot: true, flexXml: xml(n, v) });
  const s0 = { investments: [
    { id: "mio", ent: "ibkr", name: "VWCE mío", isin: "IE00BK5BQT80", shares: 5, value: 600, cost: 500, cur: "EUR" },
    { id: "pareja", ent: "ibkr", name: "VWCE pareja", isin: "IE00BK5BQT80", shares: 5, value: 600, cost: 500, cur: "EUR" }] };
  const total = (s) => s.investments.reduce((a, i) => a + ctx.invValueEur(i, s), 0);
  const s1 = J(ctx.brkApiReview(s0, "ibkr", ctx.brkApiSnapshot(res(10, 1250)), { IE00BK5BQT80: "" }, {}));
  assert.equal(total(s1), 1200);
  const s2 = J(ctx.brkApiAuto(s1, "ibkr", ctx.brkApiSnapshot(res(10, 1250))).s);
  assert.equal(total(s2), 1200, "dejadas en «no tocar»: la automática no las re-ancla (antes 1.850 €)");
  assert.ok(s2.investments.every((i) => !i.src), "ni les cambia el origen");
  assert.deepEqual(s2.brokerApi.ibkr.pend, [], "y no vuelve a proponerla");
  // Mapeada a «mío», solo esa sigue al bróker.
  const m1 = J(ctx.brkApiReview(s0, "ibkr", ctx.brkApiSnapshot(res(10, 1250)), { IE00BK5BQT80: "mio" }, {}));
  const m2 = J(ctx.brkApiAuto(m1, "ibkr", ctx.brkApiSnapshot(res(12, 1500))).s);
  assert.deepEqual(m2.investments.map((i) => [i.id, i.shares, i.value]), [["mio", 12, 1500], ["pareja", 5, 600]]);
  ok("D1: «no tocar» se respeta en automático aunque el ISIN case; solo sigue al bróker lo vinculado");
}

/* D2: vinculada a una posición con ticker distinto del símbolo del bróker, NO se congela. */
{
  const s0 = { investments: [{ id: "btc", ent: "kraken", name: "Bitcoin", ticker: "BTC-EUR", shares: 0.5, value: 30000, cost: 20000, cur: "EUR" }] };
  const s1 = J(ctx.brkApiReview(s0, "kraken", ctx.brkApiSnapshot(kraken([btc(0.5, 30000)])), { BTC: "btc" }, {}));
  assert.equal(s1.brokerApi.kraken.links.BTC, "btc");
  const s2 = J(ctx.brkApiAuto(s1, "kraken", ctx.brkApiSnapshot(kraken([btc(0.9, 54000)]))).s);
  const i = s2.investments[0];
  assert.deepEqual([i.shares, i.value, i.cost], [0.9, 54000, 20000]);
  // Las creadas en la vista previa quedan vinculadas por su id.
  const c1 = J(ctx.brkApiReview({ investments: [] }, "kraken", ctx.brkApiSnapshot(kraken([btc(0.5, 30000)])), { BTC: "__new" }, {}));
  assert.equal(c1.brokerApi.kraken.links.BTC, c1.investments[0].id);
  ok("D2: el vínculo es por id: un ticker «BTC-EUR» sigue al «BTC» del bróker");
}

/* D3: IBKR sin ninguna posición (y sin Cash Report) es una lectura completa: lo vendido sale. */
{
  const vacio = { ok: true, broker: "ibkr", snapshot: true, flexXml: `<FlexQueryResponse><FlexStatements><FlexStatement accountId="U0000000" toDate="20261118"><OpenPositions /></FlexStatement></FlexStatements></FlexQueryResponse>` };
  const p = ctx.brkApiSnapshot(vacio);
  assert.deepEqual(J(p.positions), []); assert.equal(p.snapshot, true); assert.equal(p.to, "2026-11-18");
  const s = { investments: [{ id: "v", ent: "ibkr", src: "api:ibkr", isin: "IE00BK5BQT80", fileSym: "VWCE", shares: 10, value: 1250, cur: "EUR" }],
    brokerApi: { ibkr: { known: ["IE00BK5BQT80"], links: { IE00BK5BQT80: "v" }, pend: [] } } };
  const r = ctx.brkApiAuto(s, "ibkr", p);
  assert.equal(r.gone, 1);
  assert.equal(ctx.invValueEur(J(r.s).investments[0], r.s), 0, "vendido todo: deja de sumar");
  // Una posición que el parser no entiende NO es «vacía»: sigue siendo error.
  assert.equal(ctx.brkApiSnapshot({ ok: true, broker: "ibkr", snapshot: true, flexXml: vacio.flexXml.replace("<OpenPositions />", '<OpenPositions><OpenPosition symbol="X" position="abc"/></OpenPositions>') }), null);
  ok("D3: cuenta IBKR vacía = lectura completa (marca lo vendido); ilegible sigue siendo error");
}

/* Mutante vivo 6: la automática NO marca vendido lo manual ni lo de fichero, aunque sea del mismo bróker. */
{
  const s = { investments: [
      { id: "api", ent: "kraken", src: "api:kraken", fileSym: "BTC", shares: 0.5, value: 30000, cur: "EUR" },
      { id: "man", ent: "kraken", isin: "XX0000000001", name: "Manual con ISIN", shares: 1, value: 100, cur: "EUR" },
      { id: "csv", ent: "kraken", src: "csv:kraken", fileSym: "ETH", shares: 2, value: 6000, cur: "EUR" }],
    brokerApi: { kraken: { known: ["BTC"], links: { BTC: "api" }, pend: [] } } };
  const r = ctx.brkApiAuto(s, "kraken", ctx.brkApiSnapshot(kraken([])));
  const by = Object.fromEntries(J(r.s).investments.map((i) => [i.id, i]));
  assert.ok(by.api.fileGone, "lo de la conexión que ya no está, sí");
  assert.ok(!by.man.fileGone && !by.csv.fileGone, "lo manual y lo de fichero, no");
  ok("la automática solo marca vendido lo que puso la conexión");
}

/* Mutante vivo 7: un activo en $ se queda en $ (nunca se suma como €). */
{
  const usd = kraken([{ key: "FOO", sym: "FOO", name: "FOO", shares: 10, cur: "USD", valueHint: 250, price: 25 }]);
  const p = ctx.brkApiSnapshot(usd);
  assert.equal(p.positions[0].cur, "USD");
  const s1 = J(ctx.brkApiReview({ investments: [] }, "kraken", p, { FOO: "__new" }, {}));
  const i = s1.investments[0];
  assert.deepEqual([i.cur, i.value], ["USD", 250]);
  assert.equal(ctx.invValueEur(i, { fxRates: { USD: 0.92 } }), 230, "a € con el cambio");
  assert.notEqual(ctx.invValueEur(i, { fxRates: {} }), 250, "sin cambio, nunca 250 € a pelo");
  ok("un valor en $ se guarda en $ y se convierte; nunca cuenta como €");
}

/* Seguridad que no se ve en un diff: JWT exigido, borrado de cuenta, y el nonce solo para el servidor. */
{
  const cfg = fs.readFileSync(path.join(root, "supabase", "config.toml"), "utf8");
  for (const f of ["broker-connect", "broker-sync", "broker-disconnect"]) {
    assert.match(cfg, new RegExp("\\[functions\\." + f + "\\]\\s*verify_jwt\\s*=\\s*true"), f + " sin verify_jwt=true");
  }
  const del = fs.readFileSync(path.join(root, "supabase", "functions", "delete-account", "index.ts"), "utf8");
  assert.match(del, /from\("broker_links"\)\.delete\(\)\.eq\("user_id", user\.id\)/, "borrar la cuenta borra las claves de brókers");
  const sql = fs.readFileSync(path.join(root, "supabase", "migrations", "0031_broker_links.sql"), "utf8").split(/\r?\n/).filter((l) => !l.trim().startsWith("--")).join("\n");
  assert.doesNotMatch(sql, /grant\s+execute\s+on\s+function\s+public\.broker_next_nonce[^;]*to[^;]*\b(authenticated|anon|public)\b/i);
  assert.match(sql, /grant execute on function public\.broker_next_nonce\(uuid, text\) to service_role;/);
  ok("verify_jwt en las tres, delete-account borra broker_links y el nonce no lo ejecuta el cliente");
}

/* D7: el sync de TR/MyInvestor no se apropia de lo que lleva otra sincronización. */
{
  const inv = [
    { id: "ib", ent: "ibkr", src: "api:ibkr", isin: "IE00BK5BQT80", fileSym: "VWCE", shares: 10, value: 1250, cur: "EUR" },
    { id: "kr", ent: "kraken", src: "api:kraken", fileSym: "BTC", ticker: "BTC", shares: 0.5, value: 30000, cur: "EUR" },
    { id: "mi", ent: "myinvestor", isin: "IE00BK5BQT80", shares: 1, value: 125, cur: "EUR" },
    { id: "tr", ent: "trade_republic", isin: "IE00BK5BQT80", shares: 4, value: 500, cur: "EUR" },
  ];
  const tr = ctx.brkSyncCandidates(inv, "trade_republic");
  assert.equal(ctx.brokerSuggest({ isin: "IE00BK5BQT80", name: "VWCE" }, tr), "tr", "TR casa con la de TR, no con la de IBKR");
  assert.deepEqual(J(tr.map((i) => i.id)), ["tr"]);
  assert.equal(ctx.brokerSuggest({ ticker: "BTC", name: "Bitcoin" }, ctx.brkSyncCandidates(inv, "revolut")), null, "Revolut no propone la de Kraken");
  // Sin la de TR, no se va a la de IBKR: mejor nada que pisar otra sincronización.
  assert.equal(ctx.brokerSuggest({ isin: "IE00BK5BQT80", name: "VWCE" }, ctx.brkSyncCandidates(inv.filter((i) => i.id !== "tr"), "trade_republic")), null);
  // Lo manual sigue siendo candidato (no se rompe lo que ya se re-anclaba); lo de fichero de otro bróker no (D8).
  assert.deepEqual(J(ctx.brkSyncCandidates([{ id: "m", ent: "revolut", isin: "X" }, { id: "c", ent: "degiro", src: "csv:degiro" }], "trade_republic").map((i) => i.id)), ["m"]);
  ok("D7: TR/MyInvestor/Revolut solo emparejan fuera de lo que lleva otra sincronización");
}

/* R1: borrar la posición vinculada suelta el vínculo y la vuelve a proponer. */
{
  const s = { investments: [], brokerApi: { kraken: { known: ["BTC"], links: { BTC: "borrada" }, pend: [] } } };
  const r = ctx.brkApiAuto(s, "kraken", ctx.brkApiSnapshot(kraken([btc(0.5, 30000)])));
  const m = J(r.s).brokerApi.kraken;
  assert.deepEqual([r.pend, m.links.BTC, m.known.indexOf("BTC")], [1, undefined, -1]);
  ok("R1: vínculo a una posición borrada → se suelta y se vuelve a proponer");
}

/* D8: la del propio bróker gana, y lo de fichero de otro bróker no es candidato (casos de bench5). */
{
  const trPos = { id: "tr", ent: "trade_republic", isin: "IE00BK5BQT80", shares: 4, value: 500, cur: "EUR" };
  const casos = [
    { id: "dg", ent: "degiro", src: "csv:degiro", isin: "IE00BK5BQT80", shares: 3, value: 375, cur: "EUR" },
    { id: "rv", ent: "revolut", isin: "IE00BK5BQT80", shares: 1, value: 125, cur: "EUR" },
    { id: "ib", ent: "ibkr", src: "csv:ibkr", isin: "IE00BK5BQT80", shares: 7, value: 875, cur: "EUR" },
  ];
  for (const otro of casos) {
    const cand = ctx.brkSyncCandidates([otro, trPos], "trade_republic");
    assert.equal(ctx.brokerSuggest({ isin: "IE00BK5BQT80", name: "VWCE" }, cand), "tr", otro.id);
  }
  // Sin la de TR: lo de fichero de otro bróker tampoco; la manual sí (lo que ya se re-anclaba).
  assert.equal(ctx.brokerSuggest({ isin: "IE00BK5BQT80", name: "x" }, ctx.brkSyncCandidates([casos[0], casos[2]], "trade_republic")), null);
  assert.equal(ctx.brokerSuggest({ isin: "IE00BK5BQT80", name: "x" }, ctx.brkSyncCandidates([casos[1]], "trade_republic")), "rv");
  ok("D8: el sync de TR se queda con la suya frente a DEGIRO csv, una manual de Revolut o csv:ibkr");
}
