import assert from "node:assert/strict";
import fs from "node:fs";
import { transformSync } from "esbuild";

// El handler REAL de myinvestor-sync contra un MyInvestor y una BD sintéticos. Los tests de
// Deno fijan la regla (`miReadWithRefresh`); aquí se mira lo que de verdad le costaba la
// contraseña al usuario: qué se ESCRIBE en `myinvestor_links` y qué recibe el cliente.
// Queja del 12/10: «tengo que volver a identificarme casi cada día».
const root = new URL("../", import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), "utf8");
const ts = (s) => transformSync(s, { loader: "ts" }).code;
const src = '"use strict";\n' + ts(read("supabase/functions/_shared/myinvestor.ts")).replace(/^export /gm, "")
  + "\n" + ts(read("supabase/functions/myinvestor-sync/index.ts").replace(/^import .*?;\r?\n/gm, ""));

const REFRESH = "/login/api/v1/auth/token/refresh", BASIC = "/cperf-server/api/v2/securities-accounts/self-basic";
const json = (status, body) => new Response(body === undefined ? "" : JSON.stringify(body), { status });
const tokens = (extra) => json(201, { payload: { data: Object.assign({ accessToken: "acceso-nuevo", refreshToken: "refresco-nuevo", refreshExpiresIn: 3600 }, extra) } });
const cuentas = () => json(200, { payload: { data: [] } });

// `acceso(n, token)` responde a la lista de cuentas; `refresco()` al endpoint de renovación.
async function sync({ acceso, refresco, link = {} }) {
  const fila = Object.assign({ user_id: "synthetic", status: "active", access_token: "acceso-viejo", refresh_token: "refresco-viejo", device_id: "dev", refresh_expires_at: null }, link);
  const writes = [], calls = [];
  let handler, lecturas = 0;
  const db = { auth: { getUser: async () => ({ data: { user: { id: "synthetic" } } }) }, from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: fila }) }) }),
    update: (x) => ({ eq: async () => { writes.push(x); Object.assign(fila, x); return {}; } }),
  }) };
  const fetchFn = async (url, init = {}) => {
    const path = String(url).replace("https://api.myinvestor.es", "");
    calls.push(path);
    if (path === REFRESH) return refresco();
    if (path === BASIC) return acceso(lecturas++, init.headers.Authorization);
    throw new Error("ruta sintética no prevista: " + path);
  };
  const names = ["Deno", "createClient", "withCors", "miTokensFromRow", "miTokensToRow", "ensureMiLinkEncrypted", "fetch"];
  new Function(...names, src)(
    { serve: (f) => { handler = f; }, env: { get: () => "synthetic" } }, () => db, (f) => f,
    async (l) => ({ access: l.access_token, refresh: l.refresh_token, deviceId: l.device_id }),
    async (access, refresh) => ({ access_token: access, refresh_token: refresh }), async () => {}, fetchFn
  );
  const res = await handler(new Request("https://app.invalid", { method: "POST" }));
  return { status: res.status, data: await res.json(), writes, calls, fila };
}

let failures = 0;
async function t(name, fn) { try { await fn(); console.log("  ✓ " + name); } catch (e) { failures++; console.error("  ✗ " + name + ": " + e.message); } }
const caducado = () => json(401, {});

console.log("myinvestor-sync-outcomes");

await t("acceso caducado + refresco aceptado: sincroniza con el token nuevo y sigue activo", async () => {
  const vistos = [];
  const r = await sync({ acceso: (n, auth) => { vistos.push(auth); return n === 0 ? caducado() : cuentas(); }, refresco: () => tokens() });
  assert.deepEqual(r.data, { ok: true, positions: [] });
  assert.deepEqual(vistos, ["Bearer acceso-viejo", "Bearer acceso-nuevo"]);
  assert.equal(r.fila.status, "active");
  assert.equal(r.fila.refresh_token, "refresco-nuevo");
});

for (const status of [400, 401]) await t("refresco rechazado con " + status + ": caducidad real, pide identificarse", async () => {
  const r = await sync({ acceso: caducado, refresco: () => json(status, { status: { code: "sintetico" } }) });
  assert.equal(r.data.ok, false);
  assert.equal(r.data.authExpired, true);
  assert.equal(r.data.softFail, undefined);
  assert.equal(r.fila.status, "expired");
});

await t("sin token de refresco guardado: caducidad real", async () => {
  const r = await sync({ acceso: caducado, refresco: () => { throw new Error("no debe llamar"); }, link: { refresh_token: null } });
  assert.equal(r.data.authExpired, true);
  assert.equal(r.fila.status, "expired");
});

const pasajeros = [
  ["403 anti-bot", () => json(403, {}), "refresh_403"],
  ["429", () => json(429, {}), "refresh_429"],
  ["500", () => json(500, {}), "refresh_500"],
  ["503 con HTML", () => new Response("<html>mantenimiento</html>", { status: 503 }), "refresh_503"],
  ["200 sin token", () => json(200, { payload: { data: {} } }), "refresh_200"],
  ["red caída", () => { throw new TypeError("sintético: sin red"); }, "refresh_network"],
];
for (const [nombre, refresco, code] of pasajeros) await t("refresco con fallo pasajero (" + nombre + "): no caduca ni toca el enlace", async () => {
  const r = await sync({ acceso: caducado, refresco });
  assert.equal(r.status, 200, "el cliente tiene que poder leer el desenlace");
  assert.equal(r.data.ok, false);
  assert.equal(r.data.softFail, true, "contrato que el cliente ya trata como «reintenta»");
  assert.equal(r.data.authExpired, undefined, "no se pide contraseña");
  assert.equal(r.data.code, code);
  assert.deepEqual(r.writes, [], "ni estado, ni tokens, ni last_sync");
  assert.equal(r.fila.status, "active", "el keepalive sigue renovando este enlace");
  assert.equal(r.calls.filter((p) => p === REFRESH).length, 1, "un solo refresco: insistir es lo que dispara el anti-bot");
});

await t("un enlace ya caducado no se reactiva por un fallo pasajero", async () => {
  const r = await sync({ acceso: caducado, refresco: () => json(503, {}), link: { status: "expired" } });
  assert.equal(r.data.softFail, true);
  assert.deepEqual(r.writes, []);
  assert.equal(r.fila.status, "expired");
});

await t("401 que persiste tras un refresco aceptado: tokens nuevos guardados y sin pedir contraseña", async () => {
  const r = await sync({ acceso: caducado, refresco: () => tokens() });
  assert.equal(r.data.softFail, true);
  assert.equal(r.data.authExpired, undefined);
  assert.equal(r.data.code, "access_401_after_refresh");
  assert.equal(r.fila.status, "active");
  assert.equal(r.fila.access_token, "acceso-nuevo");
});

await t("el 403 del acceso sigue siendo un aviso suave, como antes", async () => {
  const r = await sync({ acceso: () => json(403, {}), refresco: () => { throw new Error("no debe llamar"); } });
  assert.equal(r.data.softFail, true);
  assert.deepEqual(r.writes, []);
});

if (failures) { console.error("\n" + failures + " fallo(s)"); process.exit(1); }
