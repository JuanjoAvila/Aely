import assert from "node:assert/strict";
import fs from "node:fs";
import { transformSync } from "esbuild";
import { edgeFixture } from "./helpers/edge-handler-fixture.mjs";
import { input } from "./helpers/edge-input.mjs";
const code = transformSync(fs.readFileSync("supabase/functions/_shared/request_fixtures.ts", "utf8"), { loader: "ts", format: "esm" }).code;
const { INPUT_FIXTURES, INVALID_INPUTS } = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
const base = "c5f62d6603d016150afd9d0e20547b608b323045";
const names = Object.keys(INPUT_FIXTURES);
const request = (name, raw, authorized = true) => new Request("https://synthetic.invalid/?code=synthetic&state=synthetic", {
  method: "POST", body: raw, headers: { Authorization: "Bearer synthetic", "x-cron-key": "synthetic", "x-ingest-token": authorized ? "synthetic" : "incorrect" },
});
const snapshot = async (res) => ({ status: res.status, body: await res.text(), location: res.headers.get("location") });
let passed = 0;
// Ejecuta los emisores de la web real, no una copia de su serialización. El SDK se sustituye
// solo en invoke; la petición capturada recorre después el handler real del servidor.
const core = fs.readFileSync("src/modules/00-core.js", "utf8");
const calls = [
  ["prices", [["NVDA", "GOLD"]]], ["prices", []], ["askHelp", ["Cómo apuntar gastos", "es"]],
  ["suggestCategory", ["Supermercado sintético"]], ["bankConnect", ["Banco de Sabadell", "ES"]],
  ["bankAspsps", ["ES"]], ["bankSync", [{ recoverGaps: true }]],
  ["bankSyncHistory", ["2026-02-28", ["Banco de Sabadell"]]], ["bankDisconnect", ["Banco de Sabadell"]],
  ["myinvestorConnect", [INPUT_FIXTURES["myinvestor-connect"][0]]],
  ["myinvestorConnect", [INPUT_FIXTURES["myinvestor-connect"][1]]],
  ["myinvestorStore", [INPUT_FIXTURES["myinvestor-connect"][2]]],
  ["myinvestorSync", []], ["myinvestorDisconnect", []], ["deleteAccount", ["synthetic-password"]],
];
for (const [method, args] of calls) {
  const match = core.match(new RegExp("    async " + method + "\\([\\s\\S]*?^    },", "m"));
  assert(match, "emisor actual: " + method);
  let sent;
  const sb = { functions: { invoke: async (name, options) => { sent = { name, body: options?.body }; return { data: { ok: true, aspsps: [] } }; } }, auth: { signOut: async () => {} } };
  const cloud = new Function("sb", "window", "return {" + match[0] + "};")(sb, {});
  await cloud[method](...args);
  const raw = sent.body === undefined ? undefined : JSON.stringify(sent.body);
  const a = edgeFixture(sent.name, { base }), b = edgeFixture(sent.name);
  assert.deepEqual(await snapshot(await b.handler(request(sent.name, raw))), await snapshot(await a.handler(request(sent.name, raw))), "emisor real " + method);
  passed++;
}
for (const name of names) {
  for (const body of INPUT_FIXTURES[name]) {
    const old = edgeFixture(name, { base }), current = edgeFixture(name), raw = JSON.stringify(body);
    const a = await snapshot(await old.handler(request(name, raw)));
    const b = await snapshot(await current.handler(request(name, raw)));
    assert(a.status < 500, name + ": fixture base debe recorrer un contrato válido");
    assert.deepEqual(b, a, name + ": respuesta del emisor actual");
    assert.deepEqual(current.effects, old.effects, name + ": mismos efectos legítimos");
    passed++;
  }
  for (const raw of ["{", "null", "[]", ...INVALID_INPUTS[name].map(JSON.stringify), " ".repeat(input.BODY_LIMITS[name] + 1)]) {
    const current = edgeFixture(name), res = await current.handler(request(name, raw));
    assert.equal(res.status, raw.length > input.BODY_LIMITS[name] ? 413 : 400, name + ": entrada inválida");
    assert.deepEqual(current.effects.filter((x) => !(name === "ingest" && x[0] === "rpc")), [], name + ": sin efectos");
    if (name === "ingest") assert.equal(current.effects.length, 1, "cuota preauth conservada");
    assert.deepEqual(current.logs, [], name + ": sin registro de contenido");
    passed++;
  }
  // Elimina la validación DEL HANDLER: cada endpoint debe quedar protegido por prueba real.
  let killed = false;
  for (const body of INVALID_INPUTS[name]) {
    const broken = edgeFixture(name, { mutate: (file, source) => file.endsWith("request_body.ts")
      ? source.replace("if (!validInput(name, body))", "if (false)") : source });
    const r = await broken.handler(request(name, JSON.stringify(body)));
    if (r.status !== 400 || broken.effects.some((x) => x[0] !== "rpc") || broken.logs.length) { killed = true; break; }
  }
  assert(killed, name + ": mutación de validación debe ser observable");
}
for (const name of names.filter((n) => !["bank-aspsps", "bank-callback", "ingest", "myinvestor-keepalive"].includes(n))) {
  const e = edgeFixture(name, { authorized: false });
  assert.equal((await e.handler(request(name, "{malformed"))).status, 401, name + ": autentica antes de leer");
  assert.deepEqual(e.effects, []);
  passed++;
}
// El rate-limit público permanece ANTES de buscar tokens, incluso cuando no autentican.
for (const name of ["prices", "bank-sync", "myinvestor-sync", "myinvestor-disconnect"]) {
  const a = edgeFixture(name, { base }), b = edgeFixture(name);
  assert.deepEqual(await snapshot(await b.handler(request(name))), await snapshot(await a.handler(request(name))), name + ": sin body legacy");
  passed++;
}
{
  const raw = new URLSearchParams(INPUT_FIXTURES.ingest[2]).toString();
  const a = edgeFixture("ingest", { base }), b = edgeFixture("ingest");
  assert.deepEqual(await snapshot(await b.handler(request("ingest", raw))), await snapshot(await a.handler(request("ingest", raw))), "MacroDroid form-urlencoded");
  passed++;
}
for (const query of ["?code=synthetic&state=synthetic", "?error=access_denied&state=synthetic", "?state=synthetic"]) {
  const a = edgeFixture("bank-callback", { base }), b = edgeFixture("bank-callback");
  const req = () => new Request("https://synthetic.invalid/" + query);
  assert.deepEqual(await snapshot(await b.handler(req())), await snapshot(await a.handler(req())), "OAuth GET/302 conservado");
  passed++;
}
{
  const e = edgeFixture("ingest", { authorized: false });
  assert.equal((await e.handler(request("ingest", "{", false))).status, 403);
  assert.equal(e.effects[0][0], "rpc");
}
console.log(`edge-input-handlers: ${passed} contratos/rechazos; 14 mutaciones observables; base ${base}`);
