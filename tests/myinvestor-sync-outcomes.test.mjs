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
  + "\n" + ts(read("supabase/functions/_shared/myinvestor-refresh-save.ts")).replace(/^export /gm, "")
  + "\n" + ts(read("supabase/functions/myinvestor-sync/index.ts").replace(/^import .*?;\r?\n/gm, ""));

const REFRESH = "/login/api/v1/auth/token/refresh", BASIC = "/cperf-server/api/v2/securities-accounts/self-basic";
const json = (status, body) => new Response(body === undefined ? "" : JSON.stringify(body), { status });
const tokens = (extra) => json(201, { payload: { data: Object.assign({ accessToken: "acceso-nuevo", refreshToken: "refresco-nuevo", refreshExpiresIn: 3600 }, extra) } });
const cuentas = () => json(200, { payload: { data: [] } });

// `acceso(n, token)` responde a la lista de cuentas; `refresco()` al endpoint de renovación;
// `detalle()` al detalle de cada cuenta. `guardar(n)` devuelve el error de la escritura n-ésima
// (supabase-js no lanza: lo entrega). `entretanto(fila)` es lo que otro proceso hace con la fila
// antes de que el handler la vuelva a leer. `veces` es el contador del limitador, que vive en
// la BD y por eso se comparte entre pulsaciones.
async function sync({ acceso, refresco, detalle, link = {}, guardar = () => null, entretanto = null, veces = { hits: 0 }, body = { userInitiated: true } }) {
  const fila = link.user_id ? link : Object.assign({ user_id: "synthetic", status: "active", access_token: "acceso-viejo", refresh_token: "refresco-viejo", device_id: "dev", refresh_expires_at: null }, link);
  if (!fila.access_counter_version) fila.access_counter_version = "11111111-1111-4111-8111-111111111111";
  if (!fila.connection_version) fila.connection_version = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const writes = [], calls = [], rate = [];
  let handler, lecturas = 0, selects = 0, intentos = 0;
  const db = { auth: { getUser: async () => ({ data: { user: { id: "synthetic" } } }) }, from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => { if (selects++ > 0 && entretanto) entretanto(fila); return { data: { ...fila } }; } }) }),
    update: (x) => {
      const filtros = [];
      const perform = async () => {
          const error = guardar(intentos++); if (error) return { error, data: null };
          if (!filtros.every(([c, v]) => fila[c] === v)) return { data: null, error: null };
          writes.push(x); Object.assign(fila, x); return { data: { user_id: fila.user_id }, error: null };
        };
      const q = { eq: (c, v) => { filtros.push([c, v]); return q; }, is: (c, v) => { filtros.push([c, v]); return q; }, select: () => q,
        maybeSingle: perform,
        then: (ok, ko) => perform().then(r => ({ ...r, data: r.data ? [r.data] : [] })).then(ok, ko),
      }; return q;
    },
  }) };
  const fetchFn = async (url, init = {}) => {
    const path = String(url).replace("https://api.myinvestor.es", "");
    calls.push(path);
    if (path === REFRESH) return refresco();
    if (path === BASIC) return acceso(lecturas++, init.headers.Authorization);
    if (detalle && path.startsWith("/cperf-server/api/v2/securities-accounts/")) return detalle(path);
    throw new Error("ruta sintética no prevista: " + path);
  };
  const limitador = async (_db, bucket, limit, windowSecs) => {
    rate.push({ bucket, limit, windowSecs });
    if (veces.caido) return { ok: true, checked: false };
    return { ok: ++veces.hits <= limit, checked: true };
  };
  const names = ["Deno", "createClient", "withCors", "miTokensFromRow", "miTokensToRow", "rateLimit", "fetch"];
  new Function(...names, src)(
    { serve: (f) => { handler = f; }, env: { get: (key) => key === "TOKEN_ENCRYPTION_KEY" ? undefined : "synthetic" } }, () => db, (f) => f,
    async (l) => ({ access: l.access_token, refresh: l.refresh_token, deviceId: l.device_id }),
    async (access, refresh) => ({ access_token: access, refresh_token: refresh }), limitador, fetchFn
  );
  const res = await handler(new Request("https://app.invalid", { method: "POST", body: JSON.stringify(body) }));
  return { status: res.status, data: await res.json(), writes, calls, fila, rate };
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

await t("401 que persiste tras un refresco aceptado: dos avisos suaves y a la tercera se ofrece reconectar", async () => {
  // Revisión del 13/10: sin salida, cada pulsación gastaba un refresco y decía «prueba más tarde» para siempre.
  const veces = { hits: 0 };
  const fila = { user_id: "synthetic", status: "active", access_token: "acceso-viejo", refresh_token: "refresco-viejo", device_id: "dev", refresh_expires_at: null };
  for (let pulsacion = 1; pulsacion <= 2; pulsacion++) {
    const r = await sync({ acceso: caducado, refresco: () => tokens(), link: fila, veces });
    assert.equal(r.data.softFail, true, "pulsación " + pulsacion);
    assert.equal(r.data.authExpired, undefined);
    assert.equal(r.data.code, "access_401_after_refresh");
    assert.doesNotMatch(r.data.error, /sigue guardada|no hace falta/i, "este aviso no puede decir que todo está bien");
    assert.match(r.data.error, /volver a conectar/);
    assert.equal(fila.status, "active");
    assert.equal(fila.access_token, "acceso-nuevo");
    assert.deepEqual(r.rate, [{ bucket: "mi-401-tras-refresco:synthetic:" + fila.access_counter_version, limit: 2, windowSecs: 21600 }]);
  }
  const r3 = await sync({ acceso: caducado, refresco: () => tokens(), link: fila, veces });
  assert.equal(r3.data.authExpired, true);
  assert.equal(r3.data.softFail, undefined);
  assert.equal(fila.status, "expired");
});

await t("solo ese desenlace cuenta para caducar; y con el limitador caído no se caduca", async () => {
  const otros = await sync({ acceso: caducado, refresco: () => json(503, {}), veces: { hits: 99 } });
  assert.deepEqual(otros.rate, [], "un fallo pasajero no suma");
  assert.equal(otros.data.softFail, true);
  const bien = await sync({ acceso: () => cuentas(), refresco: () => { throw new Error("no debe llamar"); }, veces: { hits: 99 } });
  assert.deepEqual(bien.rate, []);
  assert.equal(bien.data.ok, true);
  const caido = await sync({ acceso: caducado, refresco: () => tokens(), veces: { hits: 99, caido: true } });
  assert.equal(caido.data.softFail, true);
  assert.equal(caido.fila.status, "active");
});

await t("red caída en la segunda lectura, con el refresco ya aceptado: aviso suave y tokens guardados", async () => {
  const r = await sync({ acceso: (n) => { if (n === 0) return caducado(); throw new TypeError("sintético: sin red"); }, refresco: () => tokens() });
  assert.equal(r.status, 200);
  assert.equal(r.data.softFail, true);
  assert.equal(r.data.authExpired, undefined);
  assert.equal(r.data.code, "access_network");
  assert.equal(r.fila.status, "active");
  assert.equal(r.fila.refresh_token, "refresco-nuevo");
  assert.deepEqual(r.rate, []);
});

await t("si los tokens rotados no se guardan, se reintenta; y si tampoco, la lectura no se da por buena", async () => {
  const fallo = { code: "sintetico" };
  const reintento = await sync({ acceso: (n) => (n === 0 ? caducado() : cuentas()), refresco: () => tokens(), guardar: (n) => (n === 0 ? fallo : null) });
  assert.deepEqual(reintento.data, { ok: true, positions: [] }, "un fallo suelto de escritura se arregla reintentando");
  assert.equal(reintento.fila.refresh_token, "refresco-nuevo");
  const r = await sync({ acceso: (n) => (n === 0 ? caducado() : cuentas()), refresco: () => tokens(), guardar: () => fallo });
  assert.equal(r.data.ok, false, "con el refresco quemado sin guardar no hay datos al día que dar");
  assert.equal(r.data.softFail, true);
  assert.equal(r.data.code, "refresh_not_saved");
  assert.deepEqual(r.writes, [], "tampoco se sella last_sync");
  assert.equal(r.calls.filter((p) => p === BASIC).length, 1, "no se lee con un token que no quedó guardado");
});

await t("refresco rechazado porque otro proceso ya rotó el token: no es caducidad", async () => {
  // El keepalive corre cada 10 min con el mismo refresco; el que llega segundo recibe el rechazo.
  const r = await sync({ acceso: caducado, refresco: () => json(401, {}), entretanto: (fila) => { fila.refresh_token = "refresco-del-keepalive"; fila.access_token = "acceso-del-keepalive"; } });
  assert.equal(r.data.softFail, true);
  assert.equal(r.data.authExpired, undefined);
  assert.equal(r.data.code, "refresh_raced");
  assert.deepEqual(r.writes, []);
  assert.equal(r.fila.status, "active");
});

await t("un 401 en el detalle de una cuenta no entrega una cartera incompleta como buena", async () => {
  const lista = () => json(200, { payload: { data: [{ accountId: "c1" }, { accountId: "c2" }] } });
  const r = await sync({ acceso: lista, refresco: () => { throw new Error("no debe llamar"); }, detalle: () => json(401, {}) });
  assert.equal(r.data.ok, false);
  assert.equal(r.data.softFail, true);
  assert.equal(r.data.code, "detail_401");
  assert.equal(r.data.positions, undefined);
  assert.deepEqual(r.writes, [], "sin last_sync: no se leyó entera");
  const ok = await sync({ acceso: lista, refresco: () => { throw new Error("no debe llamar"); }, detalle: () => json(200, { payload: { data: {} } }) });
  assert.deepEqual(ok.data, { ok: true, positions: [] });
});

await t("el 403 del acceso sigue siendo un aviso suave, como antes", async () => {
  const r = await sync({ acceso: () => json(403, {}), refresco: () => { throw new Error("no debe llamar"); } });
  assert.equal(r.data.softFail, true);
  assert.deepEqual(r.writes, []);
});

if (failures) { console.error("\n" + failures + " fallo(s)"); process.exit(1); }
