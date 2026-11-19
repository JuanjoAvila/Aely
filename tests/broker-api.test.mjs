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
