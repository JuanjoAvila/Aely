import assert from "node:assert/strict";
import fs from "node:fs";
import { transformSync } from "esbuild";

// El handler REAL de myinvestor-keepalive contra un MyInvestor y una BD sintéticos. Es el
// cron que mantiene viva la sesión entre usos: si caduca de más, pide la contraseña sin
// motivo; si no caduca nunca o no guarda lo que renueva, el enlace muere sin avisar. Ningún
// test lo ejecutaba (revisión del 13/10): tres mutaciones de esas sobrevivían.
const root = new URL("../", import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), "utf8");
const ts = (s) => transformSync(s, { loader: "ts" }).code;
const src = '"use strict";\n' + ts(read("supabase/functions/_shared/myinvestor.ts")).replace(/^export /gm, "")
  + "\n" + ts(read("supabase/functions/myinvestor-keepalive/index.ts").replace(/^import .*?;\r?\n/gm, ""));

const json = (status, body) => new Response(body === undefined ? "" : JSON.stringify(body), { status });
const nuevos = (extra) => json(201, { payload: { data: Object.assign({ accessToken: "acceso-nuevo", refreshToken: "refresco-nuevo", refreshExpiresIn: 3600 }, extra) } });
const enlace = (id, extra) => Object.assign({ user_id: id, status: "active", access_token: "acceso-" + id, refresh_token: "refresco-" + id, device_id: "dev-" + id, refresh_expires_at: null }, extra);

// `refresco(token, fila)` responde al refresco hecho con ese token. Recibe la fila VIVA para
// poder simular lo que otra función escribe mientras la petición está en vuelo. La BD filtra
// de verdad: una escritura condicionada que no casa no toca nada.
async function tick(rows, refresco, key = "clave") {
  const writes = [], calls = [];
  let handler;
  const casa = (row, filtros) => filtros.every(([c, v]) => row[c] === v);
  const db = { from: (tabla) => ({
    select: () => {
      const filtros = [];
      const q = {
        eq: (c, v) => { filtros.push([c, v]); return q; },
        maybeSingle: async () => ({ data: tabla === "cron_secrets" ? { secret: "clave" } : null }),
        // Copias: lo que el handler leyó no cambia aunque la fila cambie después.
        then: (ok, ko) => Promise.resolve({ data: rows.filter((r) => casa(r, filtros)).map((r) => ({ ...r })) }).then(ok, ko),
      };
      return q;
    },
    update: (x) => {
      const filtros = [];
      const q = {
        eq: (c, v) => { filtros.push([c, v]); return q; },
        then: (ok, ko) => {
          const tocadas = rows.filter((r) => casa(r, filtros));
          tocadas.forEach((r) => Object.assign(r, x));
          writes.push({ ...x, _filas: tocadas.length });
          return Promise.resolve({}).then(ok, ko);
        },
      };
      return q;
    },
  }) };
  const fetchFn = async (url, init) => {
    const token = JSON.parse(init.body).refreshToken;
    calls.push(token);
    return refresco(token, rows.find((r) => r.refresh_token === token));
  };
  const names = ["Deno", "createClient", "miTokensFromRow", "miTokensToRow", "timingSafeEqual", "fetch"];
  new Function(...names, src)(
    { serve: (f) => { handler = f; }, env: { get: () => "synthetic" } }, () => db,
    async (l) => ({ access: l.access_token, refresh: l.refresh_token, deviceId: l.device_id }),
    async (access, refresh) => ({ access_token: access, refresh_token: refresh }), (a, b) => a === b, fetchFn
  );
  const res = await handler(new Request("https://edge.invalid", { method: "POST", headers: { "x-cron-key": key } }));
  return { status: res.status, data: await res.json(), writes, calls };
}

let failures = 0;
async function t(name, fn) { try { await fn(); console.log("  ✓ " + name); } catch (e) { failures++; console.error("  ✗ " + name + ": " + e.message); } }

console.log("myinvestor-keepalive");

await t("refresco aceptado: guarda los dos tokens nuevos y el enlace sigue activo", async () => {
  const rows = [enlace("a")];
  const r = await tick(rows, () => nuevos());
  assert.deepEqual(r.data, { ok: true, refreshed: 1, expired: 0, skipped: 0 });
  assert.equal(rows[0].access_token, "acceso-nuevo");
  assert.equal(rows[0].refresh_token, "refresco-nuevo");
  assert.equal(rows[0].status, "active");
  assert.ok(rows[0].refresh_expires_at, "apunta hasta cuándo vale el refresco");
});

await t("si MyInvestor no rota el refresco, se conserva el que había", async () => {
  const rows = [enlace("a")];
  await tick(rows, () => nuevos({ refreshToken: undefined }));
  assert.equal(rows[0].access_token, "acceso-nuevo");
  assert.equal(rows[0].refresh_token, "refresco-a");
});

for (const status of [400, 401]) await t("refresco rechazado con " + status + ": el enlace caduca", async () => {
  const rows = [enlace("a")];
  const r = await tick(rows, () => json(status, {}));
  assert.deepEqual(r.data, { ok: true, refreshed: 0, expired: 1, skipped: 0 });
  assert.equal(rows[0].status, "expired");
  assert.equal(rows[0].refresh_token, "refresco-a", "los tokens no se tocan");
});

const pasajeros = [
  ["403 anti-bot", () => json(403, {})], ["429", () => json(429, {})], ["500", () => json(500, {})],
  ["503 con HTML", () => new Response("<html>mantenimiento</html>", { status: 503 })],
  ["200 sin token", () => json(200, { payload: { data: {} } })],
  ["red caída", () => { throw new TypeError("sintético: sin red"); }],
];
for (const [nombre, refresco] of pasajeros) await t("fallo pasajero (" + nombre + "): no se escribe nada y se reintenta al próximo tick", async () => {
  const rows = [enlace("a")];
  const r = await tick(rows, refresco);
  assert.deepEqual(r.data, { ok: true, refreshed: 0, expired: 0, skipped: 1 });
  assert.deepEqual(r.writes, []);
  assert.equal(rows[0].status, "active");
});

await t("rechazo de un refresco que una sincronización acaba de rotar: el enlace NO caduca", async () => {
  // Carrera real: sync y keepalive usan el mismo refresco; el que llega segundo recibe el
  // rechazo del token viejo. Sin la condición, este `expired` pisaba los tokens recién guardados.
  const rows = [enlace("a")];
  const r = await tick(rows, (_token, fila) => { fila.refresh_token = "refresco-del-sync"; fila.access_token = "acceso-del-sync"; return json(401, {}); });
  assert.equal(rows[0].status, "active");
  assert.equal(rows[0].refresh_token, "refresco-del-sync");
  assert.equal(r.writes.at(-1)._filas, 0, "la escritura va condicionada al refresco que se usó");
});

await t("cada enlace por separado; los que no están activos o no tienen refresco no se tocan", async () => {
  const rows = [enlace("vivo"), enlace("muerto"), enlace("caducado", { status: "expired" }), enlace("sin", { refresh_token: null })];
  const r = await tick(rows, (token) => (token === "refresco-vivo" ? nuevos() : json(401, {})));
  assert.deepEqual(r.calls, ["refresco-vivo", "refresco-muerto"]);
  assert.deepEqual(r.data, { ok: true, refreshed: 1, expired: 1, skipped: 1 });
  assert.deepEqual(rows.map((x) => x.status), ["active", "expired", "expired", "active"]);
  assert.equal(rows[1].access_token, "acceso-muerto", "los tokens de un enlace no acaban en otro");
});

await t("sin la clave del cron no se llama a MyInvestor", async () => {
  const rows = [enlace("a")];
  const r = await tick(rows, () => { throw new Error("no debe llamar"); }, "otra");
  assert.equal(r.status, 401);
  assert.deepEqual(r.calls, []);
});

if (failures) { console.error("\n" + failures + " fallo(s)"); process.exit(1); }
