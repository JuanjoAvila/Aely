import assert from "node:assert/strict";
import fs from "node:fs";
import { transformSync } from "esbuild";

const read = (p) => fs.readFileSync("supabase/functions/_shared/" + p, "utf8");
const moduleOf = async (source) => import("data:text/javascript;base64," + Buffer.from(transformSync(source, { loader: "ts", format: "esm" }).code).toString("base64"));
const source = read("request_body.ts");
const original = await moduleOf(source);
const { INPUT_FIXTURES, INVALID_INPUTS } = await moduleOf(read("request_fixtures.ts"));
const post = (body, headers) => new Request("https://synthetic.invalid", { method: "POST", body, headers, duplex: "half" });

async function suite(m) {
  for (const name of Object.keys(INPUT_FIXTURES)) {
    for (const body of INPUT_FIXTURES[name]) assert.deepEqual(await m.readInput(post(JSON.stringify(body)), name), { ok: true, body });
    for (const body of [null, [], 3, ...INVALID_INPUTS[name]]) assert.equal((await m.readInput(post(JSON.stringify(body)), name)).ok, false);
    assert.equal((await m.readInput(post("{broken"), name)).status, 400);
    assert.equal((await m.readInput(post(" ".repeat(original.BODY_LIMITS[name] + 1)), name)).status, 413);
  }
  assert.deepEqual(await m.readBodyLimited(post("€"), 3), { ok: true, text: "€" });
  assert.equal((await m.readBodyLimited(post("€€"), 4)).status, 413);
  let reads = 0, cancelled = false;
  const stream = new ReadableStream({ pull(c) { reads++; if (reads > 3) c.close(); else c.enqueue(new TextEncoder().encode("123")); }, cancel() { cancelled = true; } }, { highWaterMark: 0 });
  assert.equal((await m.readBodyLimited(post(stream), 4)).status, 413);
  assert.equal(reads, 2); assert.equal(cancelled, true);
  assert.equal((await m.readBodyLimited(post("1", { "content-length": "5" }), 4)).status, 413);
  assert.equal((await m.readBodyLimited(post(new Uint8Array([255])), 4)).status, 400);
  const parts = new ReadableStream({ start(c) { c.enqueue(new Uint8Array([226])); c.enqueue(new Uint8Array([130, 172])); c.close(); } });
  assert.deepEqual(await m.readBodyLimited(post(parts), 3), { ok: true, text: "€" });
  const failed = new ReadableStream({ start(c) { c.error(Error("synthetic-private")); } });
  assert.equal((await m.readBodyLimited(post(failed), 4)).status, 400);
  assert.equal((await m.readInput(post("texto=notificacion&fuente=tr"), "ingest")).ok, true);
  assert.equal((await m.readInput(post("{\"texto\":\"notificacion\"=x"), "ingest")).ok, false);
  const unicode = JSON.stringify({ texto: "€".repeat(15000) });
  assert.equal((await m.readInput(post(unicode), "ingest")).ok, true);
  assert.equal((await m.readInput(post(unicode, { "content-length": String(Buffer.byteLength(unicode)) }), "ingest")).status, 413);
  assert.equal((await m.readInput(post(JSON.stringify({ texto: "a".repeat(17000) })), "ingest")).status, 413);
  assert.equal((await m.readInput(post(JSON.stringify({ password: " " })), "delete-account")).ok, false);
}
await suite(original);

// Cada cambio se evalúa en un módulo independiente; nunca se mutan los ficheros del checkout.
// Una excepción de aserción mata el mutante. La referencia debe pasar exactamente la misma suite.
const mutations = [
  ["cabecera", 'Number(req.headers.get("content-length") || 0) > max', "false"],
  ["frontera-exacta", "bytes > max", "bytes >= max"],
  ["bytes-no-utf16", "bytes += value.byteLength", "bytes += new TextDecoder().decode(value).length"],
  ["acumular-chunks", "bytes += value.byteLength", "bytes = value.byteLength"],
  ["cancelar-stream", "void reader.cancel().catch(() => {});", "/* mutante */"],
  ["utf8-invalido", "{ fatal: true }", "{ fatal: false }"],
  ["utf8-partido", "{ stream: true }", "{ stream: false }"],
  ["error-lectura", 'status: 400, error: "cuerpo inválido"', 'status: 500, error: "cuerpo inválido"'],
  ["objeto", "if (!object(b)) return false", "if (false) return false"],
  ["texto-tipo", 'typeof v === "string" && v.trim().length > 0', 'v != null'],
  ["texto-no-vacio", "v.trim().length > 0", "v.length >= 0"],
  ["opcional-valida", "!(k in b) || rule(b[k])", "true"],
  ["pais", "/^[a-z]{2}$/i.test(v)", "true"],
  ["fecha-calendario", 'new Date(v).toISOString().slice(0, 10) === v', "true"],
  ["recuperar-booleano", 'typeof v === "boolean"', "true"],
  ["aspsps-array", "Array.isArray(v) && v.every(text)", "true"],
  ["plataforma", 'v === "app" || v === "web"', "true"],
  ["idioma", 'v === "es" || v === "en" || v === "ca"', "true"],
  ["pregunta-longitud", "b.question.length <= 600", "true"],
  ["symbols-array", 'Array.isArray(v) && v.every((s) => typeof s === "string")', "true"],
  ["tokens-modo", '!optional(b, "storeTokens", (v) => typeof v === "boolean")', "false"],
  ["tokens-device", "!text(b.deviceId)", "false"],
  ["tokens-access", "return text(b.accessToken)", "return true"],
  ["tokens-refresh", 'v === null || typeof v === "string"', "true"],
  ["tokens-segundos", "v >= 0", "true"],
  ["tokens-fecha-maxima", "Number.isFinite(new Date(Date.now() + v * 1000).getTime())", "true"],
  ["otp-completo", 'otp.every((k) => text(b[k]))', "true"],
  ["ingest-campos-tipo", '.every((k) => optional(b, k, (v) => typeof v === "string"))', ".every(() => true)"],
  ["ingest-fuente", 'v === "tr" || v === "wallet"', "true"],
  ["ingest-fecha", 'optional(b, "fecha", timestamp)', "true"],
  ["ingest-trigger", 'optional(b, "triggertime", timestamp)', "true"],
  ["sin-parametros", "Object.keys(b).length === 0", "true"],
  ["ingest-longitud-legacy", "raw.length > 16384", "false"],
  ["ingest-cabecera-legacy", 'Number(req.headers.get("content-length") || 0) > 16384', "false"],
  ["ingest-formulario", 'name !== "ingest" || !raw.includes("=")', "true"],
];
let killed = 0;
for (const [name, from, to] of mutations) {
  assert(source.includes(from), "mutación sin sitio: " + name);
  const mutant = await moduleOf(source.replace(from, to));
  let detected = false;
  try { await suite(mutant); } catch (_) { detected = true; }
  assert(detected, "mutación superviviente: " + name);
  killed++;
}
console.log(`edge-input-mutations: referencia pasa; ${killed}/${mutations.length} mutaciones detectadas`);
