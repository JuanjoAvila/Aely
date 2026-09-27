#!/usr/bin/env node
/** Ejecuta el cierre real candidato, sin red ni datos: Bizum es transporte, no finalidad. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";
import { packageSources, writePackage, manifest, sha256 } from "../scripts/prepare-categorize-package.mjs";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const files = packageSources();
const baseline = packageSources("rollback");
const cli = loadPureLogicFromFile();
let count = 0;
async function t(name, fn) { await fn(); count++; console.log("  ✓ " + name); }

function module(src, Deno) {
  const m = { exports: {} };
  const js = transformSync(src, { loader: "ts", format: "cjs" }).code;
  new Function("module", "exports", "Deno", js)(m, m.exports, Deno);
  return m.exports;
}
const logic = module(files["_shared/ingest_logic.ts"]);
const before = module(baseline["_shared/ingest_logic.ts"]);

function makeHandler(options = {}) {
  let handler;
  const calls = { auth: 0, rpc: [], llm: [], clients: 0 };
  const Deno = { serve: (f) => { handler = f; }, env: { get: (key) => ({
    SUPABASE_URL: "https://example.invalid", SUPABASE_ANON_KEY: "fake-anon",
    SUPABASE_SERVICE_ROLE_KEY: "fake-service", OPENAI_API_KEY: options.key ? "fake-key" : "",
  })[key] } };
  const cors = module(files["_shared/cors.ts"], Deno);
  const rate = module(files["_shared/ratelimit.ts"], Deno);
  function createClient() {
    calls.clients++;
    return {
      auth: { getUser: async () => {
        calls.auth++;
        return { data: { user: options.invalidAuth ? null : { id: "fixture-user" } }, error: null };
      } },
      rpc: async (name, args) => {
        calls.rpc.push({ name, args });
        assert.equal(name, "check_rate_limit");
        return { data: !options.limited, error: null };
      },
      // Cualquier acceso a tablas sería una regresión: esta ruta solo sugiere.
      from: () => { throw new Error("categorize no debe leer/escribir tablas"); },
    };
  }
  async function fetch(url, init) {
    assert.equal(url, "https://api.openai.com/v1/chat/completions");
    calls.llm.push(JSON.parse(init.body));
    if (options.networkError) throw new Error("fixture offline");
    if (options.httpError) return new Response("", { status: 503 });
    return new Response(JSON.stringify({ choices: [{ message: { content:
      options.raw ?? JSON.stringify({ category: options.category || "otros" }),
    } }] }), { status: 200 });
  }
  const src = files["categorize/index.ts"].replace(/^import .*;\n/gm, "");
  assert.ok(!src.includes("import "), "todos los imports del cierre se inyectan, sin red");
  new Function("Deno", "createClient", "categorizar", "withCors", "rateLimit", "fetch",
    transformSync(src, { loader: "ts" }).code)(Deno, createClient, logic.categorizar, cors.withCors, rate.rateLimit, fetch);
  const request = async (merchant, extra = {}) => {
    const headers = { "Content-Type": "application/json", Origin: "https://localhost" };
    if (!extra.noAuth) headers.Authorization = "Bearer fake-user";
    const res = await handler(new Request("https://example.invalid/categorize", {
      method: extra.method || "POST", headers, body: extra.method === "GET" || extra.method === "OPTIONS" ? undefined : JSON.stringify({ merchant }),
    }));
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), "https://localhost");
    return { status: res.status, data: extra.method === "OPTIONS" ? await res.text() : await res.json() };
  };
  return { request, calls };
}

await t("el cierre tiene cuatro módulos y el rollback conserva cada hash activo", () => {
  assert.deepEqual(Object.keys(files).sort(), ["_shared/cors.ts", "_shared/ingest_logic.ts", "_shared/ratelimit.ts", "categorize/index.ts"]);
  for (const [name, src] of Object.entries(baseline)) assert.equal(sha256(src), manifest.files[name].baselineSha256);
  assert.equal(files["_shared/cors.ts"], baseline["_shared/cors.ts"]);
  assert.equal(files["_shared/ratelimit.ts"], baseline["_shared/ratelimit.ts"]);
  assert.equal(before.categorizar("Bizum a persona"), "bizum", "el baseline reproduce el desfase activo");
  assert.ok(!files["_shared/ingest_logic.ts"].includes("clasificarConMotivo"), "no viaja la lógica ajena de main");
});
await t("el delta ejecutable es exactamente las tres retiradas de la propuesta", () => {
  assert.equal(files["categorize/index.ts"], baseline["categorize/index.ts"]
    .replace('"joyeria", "bizum", "otros"', '"joyeria", "otros"')
    .replace('joyeria=joyas; bizum=Bizum enviado a personas; otros=', 'joyeria=joyas; otros='));
  assert.equal(files["_shared/ingest_logic.ts"], baseline["_shared/ingest_logic.ts"]
    .replace('  bizum:      ["bizum","bizum a ","bizum de ","envio bizum","envío bizum","pago bizum"],\n', ""));
});
await t("aplicar el parche auditado produce el mismo candidato por una vía independiente", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "categorize-patch-"));
  try {
    const out = writePackage("rollback", path.join(temp, "package"));
    const patch = new URL("../supabase/packages/ops01-categorize/change.patch", import.meta.url);
    execFileSync("git", ["-c", "core.autocrlf=false", "apply", "--check", fileURLToPath(patch)], { cwd: out });
    // fileURLToPath evita que espacios/acentos dependan de cómo se codifique la URL.
    execFileSync("git", ["-c", "core.autocrlf=false", "apply", fileURLToPath(patch)], { cwd: out });
    for (const [name, src] of Object.entries(files)) assert.equal(fs.readFileSync(path.join(out, "supabase/functions", name), "utf8"), src);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
await t("KW Bizum→otros, Mercadona→super, ATM→traspaso y otra finalidad prevalece", () => {
  for (const [merchant, cat] of [["Bizum a persona", "otros"], ["Mercadona", "super"], ["ATM WITHDRAWAL", "traspaso"], ["Bizum Mercadona", "super"]]) {
    assert.equal(logic.categorizar(merchant), cat);
    assert.equal(cli.categoryOfNewMerchant(merchant), cat);
  }
  assert.equal(cli.resolveCategory("bizum", "Bizum a persona"), "bizum", "histórico intacto");
  assert.equal(logic.clasificar("Has enviado un Bizum de 10 euros", "", "tr"), before.clasificar("Has enviado un Bizum de 10 euros", "", "tr"));
});
await t("el catálogo IA coincide con las finalidades del cliente y sin Bizum en HINTS", () => {
  const allowed = files["categorize/index.ts"].match(/const ALLOWED = \[([\s\S]*?)\] as const/)[1].match(/"([^"]+)"/g).map((x) => JSON.parse(x));
  const core = fs.readFileSync(new URL("../src/modules/00-core.js", import.meta.url), "utf8");
  const ids = [...core.match(/const CATEGORIES = \[([\s\S]*?)\n\];/)[1].matchAll(/id:"([^"]+)"/g)].map((x) => x[1]).filter((x) => x !== "bizum");
  assert.deepEqual(allowed.slice().sort(), [...new Set([...ids, "otros"])].sort());
  assert.ok(!files["categorize/index.ts"].includes("bizum="));
});
await t("KW conocidos no llaman IA ni limitador incluso con clave", async () => {
  for (const [merchant, category] of [["Mercadona", "super"], ["ATM WITHDRAWAL", "traspaso"]]) {
    const h = makeHandler({ key: true });
    assert.deepEqual(await h.request(merchant), { status: 200, data: { ok: true, category, source: "kw" } });
    assert.equal(h.calls.llm.length + h.calls.rpc.length, 0);
  }
});
await t("Bizum sin clave devuelve otros sin IA", async () => {
  const h = makeHandler();
  assert.deepEqual(await h.request("Bizum a persona"), { status: 200, data: { ok: true, category: "otros", source: "kw", ai: false } });
  assert.equal(h.calls.llm.length + h.calls.rpc.length, 0);
});
await t("sugerencia Bizum del modelo rechazada, también en mayúsculas", async () => {
  for (const category of ["bizum", "BIZUM"]) {
    const h = makeHandler({ key: true, category });
    assert.deepEqual((await h.request("Bizum a persona")).data, { ok: true, category: "otros", source: "kw" });
    assert.equal(h.calls.llm.length, 1);
    const prompt = h.calls.llm[0].messages[1].content;
    assert.ok(!prompt.split("Ids: ")[1].split(". Significado:")[0].includes("bizum"));
    assert.ok(!prompt.includes("bizum="));
    assert.deepEqual(h.calls.rpc[0], { name: "check_rate_limit", args: { p_bucket: "categorize-ai:fixture-user", p_limit: 40, p_window_secs: 600 } });
  }
});
await t("finalidad válida del modelo aceptada", async () => {
  const h = makeHandler({ key: true, category: "salud" });
  assert.deepEqual((await h.request("Comercio ficticio sin pistas")).data, { ok: true, category: "salud", source: "ai" });
});
await t("fallos de red y HTTP vuelven a otros", async () => {
  for (const failure of [{ networkError: true }, { httpError: true }]) {
    const h = makeHandler({ key: true, ...failure });
    assert.deepEqual((await h.request("Bizum a persona")).data, { ok: true, category: "otros", source: "kw", ai: "error" });
  }
});
await t("respuesta malformada o categoría desconocida no inventa finalidad", async () => {
  for (const raw of ["sin json", '{"category":"inventada"}']) {
    const h = makeHandler({ key: true, raw });
    assert.equal((await h.request("Comercio ficticio")).data.category, "otros");
  }
});
await t("limitador rechazado impide IA", async () => {
  const h = makeHandler({ key: true, limited: true });
  assert.deepEqual((await h.request("Bizum a persona")).data, { ok: true, category: "otros", source: "kw", ai: "limit" });
  assert.equal(h.calls.llm.length, 0);
});
await t("autenticación ausente o rechazada impide KW, RPC y modelo", async () => {
  for (const noAuth of [true, false]) {
    const h = makeHandler({ key: true, invalidAuth: true });
    assert.deepEqual(await h.request("Mercadona", { noAuth }), { status: 401, data: { ok: false, error: "auth" } });
    assert.equal(h.calls.rpc.length + h.calls.llm.length, 0);
    assert.equal(h.calls.auth, noAuth ? 0 : 1);
  }
});
await t("método/merchant inválidos y preflight conservan el contrato", async () => {
  const h = makeHandler({ key: true });
  assert.equal((await h.request("Mercadona", { method: "GET" })).status, 405);
  assert.equal((await h.request("")).status, 400);
  assert.deepEqual(await h.request("", { method: "OPTIONS" }), { status: 200, data: "ok" });
  assert.equal(h.calls.llm.length + h.calls.rpc.length, 0);
});
await t("paquete físico solo categorize, JWT conservado, sin SQL y sin pisar salidas", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "categorize-test-"));
  try {
    for (const mode of ["candidate", "rollback"]) {
      const out = writePackage(mode, path.join(temp, mode));
      assert.deepEqual(fs.readdirSync(path.join(out, "supabase/functions")).sort(), ["_shared", "categorize"]);
      assert.ok(!fs.existsSync(path.join(out, "supabase/migrations")));
      assert.ok(fs.readFileSync(path.join(out, "supabase/config.toml"), "utf8").includes("verify_jwt = true"));
      const map = JSON.parse(fs.readFileSync(path.join(out, "supabase/functions/categorize/import_map.json")));
      assert.equal(map.imports["https://esm.sh/@supabase/supabase-js@2"], manifest.dependency);
      assert.throws(() => writePackage(mode, out), /vacía/);
    }
    assert.throws(() => packageSources("ingest"), /Modo/);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
console.log("categorize-handler: " + count + " grupos PASS; fetch/DB simulados, sin IA remota");
