import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { transformSync } from "esbuild";

const root = fileURLToPath(new URL("../../", import.meta.url));
const now = Date.parse("2026-10-12T12:00:00Z");
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return now; }
}
// Ejecuta los módulos reales, con red/BD/tiempo sustituidos en la frontera. Una llamada no
// prevista no sale a internet: falla aquí. También permite ejecutar el blob base sin editarlo.
export function edgeFixture(name, { base = null, authorized = true, mutate = null } = {}) {
  const effects = [], reads = [], logs = [], cache = new Map();
  let handler;
  const json = (b) => new Response(JSON.stringify(b), { status: 200 });
  const env = {
    APP_URL: "https://synthetic.invalid/", SUPABASE_URL: "https://db.invalid",
    SUPABASE_ANON_KEY: "synthetic", SUPABASE_SERVICE_ROLE_KEY: "synthetic",
    INGEST_TOKEN: "synthetic", INGEST_USER_ID: "synthetic", OPENAI_API_KEY: "synthetic",
    AELY_HELP_AI_ENABLED: "true",
  };
  const db = {
    auth: { getUser: async () => { reads.push("auth"); return { data: { user: authorized ? { id: "synthetic", email: "synthetic@example.invalid" } : null } }; },
      signInWithPassword: async () => { effects.push(["reauth"]); return { error: null }; },
      admin: { deleteUser: async () => { effects.push(["deleteUser"]); return { error: null }; } } },
    rpc: async (n, p) => { effects.push(["rpc", n, p]); return { data: true }; },
    from(table) {
      let operation = "select", payload, columns = "*";
      const query = {
        select(c = "*") { columns = c; return query; },
        eq() { return query; }, in() { return query; }, gte() { return query; }, lte() { return query; },
        lt() { return query; }, limit() { return query; }, range() { return query; }, order() { return query; },
        insert(p) { operation = "insert"; payload = p; return query; },
        upsert(p) { operation = "upsert"; payload = p; return query; },
        update(p) { operation = "update"; payload = p; return query; },
        delete() { operation = "delete"; return query; },
        maybeSingle() { return execute(true); }, single() { return execute(true); },
        then(ok, fail) { return execute(false).then(ok, fail); },
      };
      async function execute(single) {
        if (operation !== "select") { effects.push([table, operation, payload]); return { data: operation === "upsert" ? [{ id: "ack" }] : null, error: null }; }
        reads.push(table);
        if (table === "cron_secrets") return { data: { secret: "synthetic" } };
        if (table === "bank_links" && name === "bank-callback") return { data: authorized ? { id: "link", user_id: "synthetic", state_issued_at: FixedDate.now(), aspsp_name: "Synthetic" } : null };
        if (table === "ingest_tokens") return { data: null };
        if (table === "app_state") return { data: { data: { accounts: [], settings: {} } } };
        return { data: single ? null : [], count: columns === "*" ? 0 : undefined, error: null };
      }
      return query;
    },
  };
  const fakeFetch = async (url, init) => {
    effects.push(["fetch", String(url), init?.body]);
    if (String(url).includes("openai.com")) return json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ topics: [], confidence: "low" }) }] }], choices: [{ message: { content: '{"category":"otros"}' } }] });
    if (String(url).includes("finance.yahoo.com")) return json({ chart: { result: [{ meta: { regularMarketPrice: 10 } }] } });
    if (String(url).includes("myinvestor")) return json({ payload: { data: { accessToken: "synthetic", refreshToken: "synthetic", refreshExpiresIn: 3600 } } });
    throw new Error("fetch no simulado");
  };
  function load(file) {
    file = file.replaceAll("\\", "/");
    if (cache.has(file)) return cache.get(file);
    let source = base ? execFileSync("git", ["show", base + ":" + file], { cwd: root, encoding: "utf8" }) : fs.readFileSync(path.join(root, file), "utf8");
    if (mutate) source = mutate(file, source);
    const module = { exports: {} }; cache.set(file, module.exports);
    const require = (id) => {
      if (id.startsWith("https://esm.sh/@supabase/supabase-js")) return { createClient: () => db };
      if (!id.startsWith(".")) throw Error("import no simulado: " + id);
      const next = path.posix.normalize(path.posix.join(path.posix.dirname(file), id));
      if (next.endsWith("/token_store.ts")) return {
        encryptSessionId: async () => "synthetic-encrypted",
        miTokensToRow: async () => ({ access_token: "synthetic-encrypted", refresh_token: "synthetic-encrypted" }),
        miTokensFromRow: async () => ({}), ensureMiLinkEncrypted: async () => {},
      };
      const real = load(next);
      if (next.endsWith("/enablebanking.ts")) return { ...real, ebConfig: () => ({}), makeJWT: async () => "synthetic",
        ebApi: async (_, route, options) => { effects.push(["ebApi", route, options?.body]);
          if (route === "/auth") return { url: "https://bank.invalid/synthetic" };
          if (route.startsWith("/aspsps")) return { aspsps: [{ name: "Synthetic", country: "ES" }] };
          if (route === "/sessions") return { session_id: "synthetic", accounts: [{ uid: "synthetic" }] };
          return {};
        } };
      return real;
    };
    const code = transformSync(source, { loader: "ts", format: "cjs" }).code;
    new Function("module", "exports", "require", "Deno", "fetch", "Date", "console", "setTimeout", "crypto", code)(
      module, module.exports, require, { env: { get: (k) => env[k] }, serve: (f) => { handler = f; } },
      fakeFetch, FixedDate, { error: (...v) => logs.push(v), log: (...v) => logs.push(v) }, (f) => { f(); return 0; },
      { subtle: globalThis.crypto.subtle, randomUUID: () => "00000000-0000-4000-8000-000000000000" },
    );
    cache.set(file, module.exports); return module.exports;
  }
  load("supabase/functions/" + name + "/index.ts");
  return { handler, effects, reads, logs };
}
