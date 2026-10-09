#!/usr/bin/env node
/** Ejecuta las cuatro fuentes ACTUALES de categorize; los transportes son sintéticos. */
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { transformSync } from "esbuild";

const paths = {
  handler: "supabase/functions/categorize/index.ts",
  logic: "supabase/functions/_shared/ingest_logic.ts",
  cors: "supabase/functions/_shared/cors.ts",
  rate: "supabase/functions/_shared/ratelimit.ts",
};
const sources = Object.fromEntries(Object.entries(paths).map(([key, p]) =>
  [key, fs.readFileSync(new URL("../" + p, import.meta.url), "utf8")]));
const imports = [
  'import { createClient } from "https://esm.sh/@supabase/supabase-js@2";',
  'import { categorizar } from "../_shared/ingest_logic.ts";',
  'import { withCors } from "../_shared/cors.ts";',
  'import { rateLimit } from "../_shared/ratelimit.ts";',
];

function compile(input) {
  const found = input.handler.match(/^import .*;$/gm)?.map((s) => s.trim()) || [];
  assert.deepEqual(found, imports, "un import nuevo exige un doble explícito, nunca red");
  return Object.fromEntries(Object.entries(input).map(([key, source]) => {
    const stripped = key === "handler" ? source.replace(/^import .*;\r?\n/gm, "") : source;
    // El parser mantiene toda la lógica; no extraemos ni reescribimos el handler real.
    assert.ok(!/^\s*import\b/m.test(stripped), "helper con import no simulado: " + key);
    assert.ok(!/\bimport\s*\(/.test(stripped), "import dinámico no simulado: " + key);
    return [key, transformSync(stripped, { loader: "ts", format: "cjs" }).code];
  }));
}
const code = compile(sources);
let count = 0;
async function t(name, fn) { await fn(); count++; console.log("  ✓ " + name); }
const plain = (value) => JSON.parse(JSON.stringify(value));

function makeHandler(options = {}, compiled = code) {
  let handler;
  const calls = { serve: 0, clients: [], auth: 0, rpc: [], llm: [], tables: [], logs: [], violations: [] };
  const userId = options.userId || "fixture-user";
  const env = {
    APP_URL: "https://app.example.invalid/Aely/", SUPABASE_URL: "https://db.example.invalid",
    SUPABASE_ANON_KEY: "fixture-anon", SUPABASE_SERVICE_ROLE_KEY: "fixture-service",
    OPENAI_API_KEY: options.key ? "fixture-llm" : "", OPENAI_MODEL: options.model || "",
  };
  const Deno = {
    serve: (f) => { calls.serve++; handler = f; },
    env: { get: (key) => {
      if (!Object.hasOwn(env, key)) {
        calls.violations.push("env no simulada: " + key);
        throw new Error("env no simulada");
      }
      return env[key];
    } },
  };
  function createClient(url, key, config) {
    calls.clients.push({ url, key, config: config && plain(config) });
    return {
      auth: { getUser: async () => {
        calls.auth++;
        return { data: { user: options.noUser ? null : { id: userId } }, error: options.authError || null };
      } },
      rpc: async (name, args) => {
        calls.rpc.push({ name, args: plain(args) });
        if (options.rpcThrow) throw options.rpcThrow;
        return { data: Object.hasOwn(options, "rateData") ? options.rateData : true, error: options.rpcError || null };
      },
      // Un acceso a tablas atrapado por un catch sigue quedando registrado como regresión.
      from: (name) => { calls.tables.push(name); throw new Error("categorize no usa tablas"); },
    };
  }
  async function fetch(url, init) {
    calls.llm.push({ url, method: init?.method, headers: plain(init?.headers || {}),
      body: JSON.parse(init?.body || "null") });
    if (options.fetchError) throw new Error("fallo sintético de transporte");
    if (options.httpError) return new Response("fixture", { status: options.httpError });
    if (Object.hasOwn(options, "responseBody")) return new Response(options.responseBody);
    return new Response(JSON.stringify({ choices: [{ message: { content:
      options.raw ?? JSON.stringify({ category: options.category || "otros" }),
    } }] }));
  }
  // Ni process, require, SDK remoto ni fetch del host entran en el contexto del runtime.
  const context = vm.createContext({ Deno, createClient, fetch, Request, Response, Headers, URL,
    console: Object.fromEntries(["error", "warn", "log"].map((level) =>
      [level, (...args) => calls.logs.push({ level, args })])),
  }, { codeGeneration: { strings: false, wasm: false } });
  function module(key) {
    context.module = { exports: {} };
    vm.runInContext("(function(module,exports){\n" + compiled[key] + "\n})(module,module.exports);", context,
      { filename: paths[key], timeout: 1000 });
    return context.module.exports;
  }
  const logic = module("logic"), cors = module("cors"), rate = module("rate");
  Object.assign(context, { categorizar: logic.categorizar, withCors: cors.withCors, rateLimit: rate.rateLimit });
  vm.runInContext(compiled.handler, context, { filename: paths.handler, timeout: 1000 });
  assert.equal(calls.serve, 1, "el handler viene de Deno.serve real");

  async function request(merchant = "Comercio ficticio sin pistas", extra = {}) {
    const method = extra.method || "POST";
    const headers = { "Content-Type": "application/json" };
    if (extra.origin !== null) headers.Origin = extra.origin || "https://localhost";
    if (extra.auth !== null) headers.Authorization = extra.auth ?? "Bearer fixture-token";
    const body = Object.hasOwn(extra, "rawBody") ? extra.rawBody : JSON.stringify(extra.body ?? { merchant });
    const res = await handler(new Request("https://request.example.invalid/categorize", {
      method, headers, body: ["GET", "HEAD", "OPTIONS"].includes(method) ? undefined : body,
    }));
    const data = method === "OPTIONS" ? await res.text() : await res.json();
    assert.deepEqual(calls.tables, [], "esta ruta solo sugiere; no lee ni escribe tablas");
    assert.deepEqual(calls.violations, [], "todo transporte debe estar simulado");
    for (const [i, client] of calls.clients.entries()) {
      assert.equal(client.url, env.SUPABASE_URL);
      assert.equal(client.key, i === 0 ? env.SUPABASE_ANON_KEY : env.SUPABASE_SERVICE_ROLE_KEY);
      assert.deepEqual(client.config, i === 0 ? { global: { headers: { Authorization: headers.Authorization } } } : undefined);
    }
    for (const rpc of calls.rpc) assert.deepEqual(rpc, { name: "check_rate_limit",
      args: { p_bucket: "categorize-ai:" + userId, p_limit: 40, p_window_secs: 600 } });
    for (const llm of calls.llm) {
      assert.equal(llm.url, "https://api.openai.com/v1/chat/completions");
      assert.equal(llm.method, "POST");
      assert.deepEqual(llm.headers, { Authorization: "Bearer fixture-llm", "Content-Type": "application/json" });
    }
    return { status: res.status, data, headers: res.headers };
  }
  return { request, calls, rate };
}
const result = (category, source = "kw", extra = {}) => ({ ok: true, category, source, ...extra });
async function expectResult(h, merchant, expected, extra) {
  const response = await h.request(merchant, extra);
  assert.equal(response.status, 200);
  assert.deepEqual(response.data, expected);
}

// Oráculos literales: copiar la salida de categorizar/ALLOWED al esperado ocultaría regresiones.
const keywords = [
  ["Mercadona", "super"], ["ATM WITHDRAWAL", "traspaso"], ["Bizum Mercadona", "super"],
  ["Multa DGT", "multas"], ["Multa zona azul", "multas"], ["Sanción de tráfico", "multas"],
  ["Sanció de trànsit", "multas"], ["Traffic fine", "multas"], ["Parking fine", "multas"],
  ["Zona azul", "zona_azul"], ["Telpark zona azul", "zona_azul"], ["Zona blava", "zona_azul"],
  ["Estacionamiento regulado", "zona_azul"], ["Aparcament regulat", "zona_azul"],
  ["Peaje AP7", "peajes"], ["Peatge C32", "peajes"], ["Toll road payment", "peajes"],
  ["Telpark", "parking"], ["SABA Aparcamientos", "parking"], ["Zona verde", "parking"],
  ["Hacienda impuestos", "tasas"], ["Ayuntamiento tasa", "tasas"], ["Sanción administrativa", "tasas"],
  ["Autopistas", "transporte"], ["Multalia", "tasas"], ["Zona Azulada", "parking"],
  ["Restaurante Peaje", "bares"], ["UBER *EATS", "bares"], ["UberEats", "bares"],
  ["Repsol Luz", "luz"], ["Repsol gas natural", "gas"], ["Repsol recarga eléctrica", "transporte"],
  ["Metro TMB", "transporte"], ["Repsol", "transporte"], ["Repsol carburante", "gasolina"],
  ["Taxi Barcelona", "taxi"],
];
const allowed = ["super", "pan", "bares", "cine", "padel", "heladeria", "ia", "ocio", "gaming", "viajes",
  "transporte", "gasolina", "taxi", "parking", "multas", "zona_azul", "peajes", "agua", "luz", "gas",
  "tasas", "recibos", "compras", "educacion", "salud", "pelu", "mascotas", "hogar", "regalos", "joyeria", "otros"];

async function keywordOracle(compiled = code) {
  for (const [merchant, category] of keywords) {
    const h = makeHandler({ key: true }, compiled);
    await expectResult(h, merchant, result(category));
    assert.equal(h.calls.auth, 1);
    assert.equal(h.calls.clients.length, 1);
    assert.equal(h.calls.rpc.length + h.calls.llm.length, 0, merchant + ": KW gratis");
  }
}
await t("KW actuales, movilidad y ambigüedades sin RPC ni IA", () => keywordOracle());
await t("Bizum sin finalidad y pasarelas no inventan categoría sin clave", async () => {
  for (const merchant of ["Bizum a persona", "Mangopay", "Stripe", "Fine dining", "Toll logistics"]) {
    const h = makeHandler();
    await expectResult(h, merchant, result("otros", "kw", { ai: false }));
    assert.equal(h.calls.rpc.length + h.calls.llm.length, 0);
    assert.equal(h.calls.clients.length, 1);
  }
});
async function aiOracle(category, compiled = code) {
  const h = makeHandler({ key: true, category }, compiled);
  await expectResult(h, "Comercio ficticio sin pistas", result(category, category === "otros" ? "kw" : "ai"));
  assert.equal(h.calls.rpc.length, 1);
  assert.equal(h.calls.llm.length, 1);
  assert.equal(h.calls.clients.length, 2);
  return h;
}
await t("el modelo acepta cada finalidad actual, incluidas las cinco de movilidad", async () => {
  for (const category of allowed) await aiOracle(category);
});
await t("prompt real tiene catálogo exacto y pistas actuales sin finalidad Bizum", async () => {
  const h = await aiOracle("salud");
  const prompt = h.calls.llm[0].body.messages[1].content;
  assert.deepEqual(prompt.split("Ids: ")[1].split(". Significado:")[0].split(", "), allowed);
  for (const hint of ["gasolina=carburante", "taxi=taxi", "multas=multas explícitas", "zona_azul=zona azul", "peajes=cobro explícito de peaje",
    "Una administración sola no prueba multa", "una app de parking sola no prueba zona azul", "una autopista sola no prueba peaje",
    "Una marca como Repsol sola no prueba carburante", "pasarela de pago"]) assert.ok(prompt.includes(hint), hint);
  assert.equal(prompt.includes("bizum="), false);
});
async function rejectedCategoryOracle(compiled = code) {
  for (const category of ["bizum", "BIZUM", "traspaso", "ingreso", "inventada", "", "SALUD "]) {
    const h = makeHandler({ key: true, category, raw: JSON.stringify({ category }) }, compiled);
    await expectResult(h, "Bizum a persona", result("otros"));
    assert.equal(h.calls.llm.length, 1);
  }
}
await t("Bizum, IDs fuera de catálogo y espacios no entran como finalidad IA", () => rejectedCategoryOracle());
await t("JSON extraído, mayúsculas y respuestas malformadas mantienen el contrato", async () => {
  for (const [raw, category] of [
    ['{"category":"SALUD"}', "salud"], ['```json\n{"category":"taxi"}\n```', "taxi"],
    ["sin json", "otros"], ['{"category":', "otros"], ['{"category":null}', "otros"],
    ['{"otra":"salud"}', "otros"], ['{"category":["taxi","salud"]}', "otros"],
    ['{"category":"taxi"} {"category":"salud"}', "otros"],
  ]) {
    const h = makeHandler({ key: true, raw });
    await expectResult(h, undefined, result(category, category === "otros" ? "kw" : "ai"));
  }
});
async function limitOracle(compiled = code) {
  const h = makeHandler({ key: true, rateData: false }, compiled);
  await expectResult(h, "Bizum a persona", result("otros", "kw", { ai: "limit" }));
  assert.equal(h.calls.rpc.length, 1);
  assert.equal(h.calls.llm.length, 0);
}
await t("RPC false frena antes del modelo con respuesta 200, sin 429", () => limitOracle());
await t("solo false deniega; null, cero o dato ausente dejan pasar", async () => {
  for (const rateData of [true, null, 0, undefined]) {
    const h = makeHandler({ key: true, rateData, category: "salud" });
    await expectResult(h, undefined, result("salud", "ai"));
    assert.equal(h.calls.rpc.length, 1);
    assert.equal(h.calls.llm.length, 1);
    const verdict = await h.rate.rateLimit({ rpc: async () => ({ data: rateData, error: null }) }, "fixture-bucket", 40, 600);
    assert.deepEqual(plain(verdict), { ok: true, checked: true });
  }
});
const sqlCodes = ["23505", "42501", "42703", "42P01", "PGRST204"];
async function sqlOracle(compiled = code) {
  for (const mode of ["rpcError", "rpcThrow"]) for (const code of [...sqlCodes, "XX000", "", undefined]) {
    const marker = "SYNTHETIC_PRIVATE_MESSAGE_BUCKET_DETAIL";
    const fields = { code, message: marker, details: marker, hint: marker, bucket: marker };
    const error = mode === "rpcThrow" ? Object.assign(new Error(marker), fields) : fields;
    const h = makeHandler({ key: true, category: "salud", [mode]: error }, compiled);
    await expectResult(h, undefined, result("salud", "ai"));
    const prefix = mode === "rpcError" ? "rate-limit no disponible (se deja pasar):" : "rate-limit excepción (se deja pasar):";
    const expectedCode = sqlCodes.includes(code) ? code : "unavailable";
    assert.deepEqual(h.calls.logs, [{ level: "error", args: [prefix, expectedCode] }]);
    assert.equal(h.calls.llm.length, 1, "fallo del limitador deja pasar");
    assert.equal(JSON.stringify(h.calls.logs).includes(marker), false);
    const rpc = async () => { if (mode === "rpcThrow") throw error; return { error }; };
    const verdict = await h.rate.rateLimit({ rpc }, marker, 40, 600);
    assert.deepEqual(plain(verdict), { ok: true, checked: false });
    assert.deepEqual(h.calls.logs[1], { level: "error", args: [prefix, expectedCode] });
  }
}
await t("SQLSTATE permitidos, desconocidos y excepciones no filtran datos", () => sqlOracle());
await t("el helper real conserva checked:true al denegar", async () => {
  const h = makeHandler();
  const verdict = await h.rate.rateLimit({ rpc: async () => ({ data: false, error: null }) }, "fixture-bucket", 40, 600);
  assert.deepEqual(plain(verdict), { ok: false, checked: true });
  assert.deepEqual(h.calls.logs, []);
});
await t("errores HTTP, transporte y JSON externo vuelven a otros", async () => {
  for (const failure of [{ fetchError: true }, { httpError: 429 }, { httpError: 503 }, { responseBody: "no-json" }]) {
    const h = makeHandler({ key: true, ...failure });
    await expectResult(h, undefined, result("otros", "kw", { ai: "error" }));
    assert.equal(h.calls.rpc.length, 1);
    assert.equal(h.calls.llm.length, 1);
  }
  for (const responseBody of ['{}', '{"choices":[]}', '{"choices":[{"message":{}}]}']) {
    const h = makeHandler({ key: true, responseBody });
    await expectResult(h, undefined, result("otros"));
  }
});
async function authOracle(compiled = code) {
  for (const auth of [null, "Basic fixture", "bearer fixture-token", "Bearerfixture-token"]) {
    const h = makeHandler({ key: true }, compiled);
    const res = await h.request("Mercadona", { auth });
    assert.equal(res.status, 401);
    assert.deepEqual(res.data, { ok: false, error: "auth" });
    assert.equal(h.calls.clients.length + h.calls.auth + h.calls.rpc.length + h.calls.llm.length, 0);
  }
  for (const opts of [{ noUser: true }, { authError: { message: "fixture-auth-error" } }]) {
    const h = makeHandler({ key: true, ...opts }, compiled);
    const res = await h.request("Mercadona");
    assert.equal(res.status, 401);
    assert.deepEqual(res.data, { ok: false, error: "auth" });
    assert.equal(h.calls.auth, 1);
    assert.equal(h.calls.rpc.length + h.calls.llm.length, 0);
  }
}
await t("JWT ausente/rechazado impide KW, RPC y modelo", () => authOracle());
await t("métodos y preflight mantienen contrato sin autenticación ni IA", async () => {
  for (const method of ["GET", "PUT", "DELETE", "HEAD"]) {
    const h = makeHandler({ key: true });
    const res = await h.request("Mercadona", { method, auth: null });
    assert.equal(res.status, 405);
    assert.deepEqual(res.data, { ok: false, error: "method" });
    assert.equal(h.calls.clients.length + h.calls.auth + h.calls.rpc.length + h.calls.llm.length, 0);
  }
  const h = makeHandler({ key: true });
  const pre = await h.request("", { method: "OPTIONS", auth: null });
  assert.equal(pre.status, 200);
  assert.equal(pre.data, "ok");
  assert.equal(pre.headers.get("Access-Control-Allow-Methods"), "POST, GET, OPTIONS");
  assert.equal(pre.headers.get("Access-Control-Max-Age"), "86400");
  assert.equal(h.calls.clients.length + h.calls.auth + h.calls.rpc.length + h.calls.llm.length, 0);
});
await t("body inválido o merchant vacío no llegan al limitador", async () => {
  for (const rawBody of ["no-json", "null", "{}", '{"merchant":"  "}', '{"merchant":0}', '{"merchant":false}']) {
    const h = makeHandler({ key: true });
    const res = await h.request("", { rawBody });
    assert.equal(res.status, 400);
    assert.deepEqual(res.data, { ok: false, error: "merchant" });
    assert.equal(h.calls.auth, 1);
    assert.equal(h.calls.rpc.length + h.calls.llm.length, 0);
  }
});
await t("merchant se recorta a 120 caracteres y la sugerencia no envía otros campos", async () => {
  const merchant = "  " + "x".repeat(125) + "  ";
  const h = makeHandler({ key: true, category: "salud", model: "fixture-model", userId: "fixture-other-user" });
  await expectResult(h, merchant, result("salud", "ai"), { body: {
    merchant, amount: 123.45, account: "SYNTHETIC_ACCOUNT_ONLY", note: "SYNTHETIC_NOTE_ONLY",
  } });
  const body = h.calls.llm[0].body;
  assert.deepEqual(Object.keys(body).sort(), ["max_tokens", "messages", "model", "temperature"]);
  assert.equal(body.model, "fixture-model");
  assert.equal(body.temperature, 0);
  assert.equal(body.max_tokens, 40);
  assert.deepEqual(body.messages[0], { role: "system", content: "Responde solo JSON válido." });
  assert.equal(body.messages.length, 2);
  assert.equal(body.messages[1].role, "user");
  assert.equal(body.messages[1].content.split("Comercio: ")[1], JSON.stringify("x".repeat(120)));
  for (const marker of ["123.45", "SYNTHETIC_ACCOUNT_ONLY", "SYNTHETIC_NOTE_ONLY"])
    assert.equal(JSON.stringify(h.calls.llm).includes(marker), false);
  assert.deepEqual(h.calls.logs, []);
  const normal = await aiOracle("salud");
  assert.equal(normal.calls.llm[0].body.model, "gpt-4o-mini");
});
await t("CORS real aplica la lista blanca a éxitos, errores y OPTIONS", async () => {
  for (const [origin, expected] of [
    ["https://localhost", "https://localhost"], ["capacitor://localhost", "capacitor://localhost"],
    ["ionic://localhost", "ionic://localhost"], ["http://localhost:4173", "http://localhost:4173"],
    ["http://127.0.0.1:4173", "http://127.0.0.1:4173"],
    ["https://app.example.invalid", "https://app.example.invalid"],
    ["https://untrusted.example.invalid", null], ["https://localhost.untrusted.example.invalid", null], [null, null],
  ]) for (const extra of [{}, { auth: null }, { method: "GET" }, { method: "OPTIONS", auth: null }]) {
    const h = makeHandler();
    const res = await h.request("Mercadona", { ...extra, origin });
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), expected);
    assert.equal(res.headers.get("Vary"), "Origin");
    assert.equal(res.headers.get("Access-Control-Allow-Headers"), "authorization, x-client-info, apikey, content-type, x-ingest-token");
    assert.equal(res.status, extra.method === "GET" ? 405 : extra.auth === null && !extra.method ? 401 : 200);
  }
});

await t("controles negativos en memoria rechazan regresiones con los mismos oráculos", async () => {
  const mutations = [
    ["keyword de movilidad perdida", "logic", "return mobilityCategoryOfNewMerchant(comercio, cat);", "return cat;", keywordOracle],
    ["taxi fuera del catálogo IA", "handler", '"gasolina", "taxi", "parking"', '"gasolina", "parking"', (c) => aiOracle("taxi", c)],
    ["Bizum vuelve como finalidad IA", "handler", '"joyeria", "otros"', '"joyeria", "bizum", "otros"', rejectedCategoryOracle],
    ["mensaje SQL libre", "rate", "rateLogCode(error)", "error.message", sqlOracle],
    ["limitador desatendido", "handler", "if (!gate.ok)", "if (false)", limitOracle],
    ["bucket no pertenece al usuario", "handler", '"categorize-ai:" + user.id', '"categorize-ai:shared"', (c) => aiOracle("salud", c)],
    ["auth sin verificar", "handler", "if (uerr || !user)", "if (false)", authOracle],
  ];
  for (const [name, key, from, to, oracle] of mutations) {
    assert.equal(sources[key].split(from).length, 2, "ancla única del mutante: " + name);
    const changed = { ...sources, [key]: sources[key].replace(from, to) };
    const mutant = compile(changed);
    await assert.rejects(() => oracle(mutant), { name: "AssertionError" }, name);
  }
});
console.log("categorize-handler: " + count + " grupos PASS; fuentes actuales, SDK/DB/LLM simulados, sin red");
