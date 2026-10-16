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
const sourceArg = process.argv.indexOf("--source-file");
const handlerSource = sourceArg < 0 ? read("supabase/functions/myinvestor-keepalive/index.ts") : fs.readFileSync(process.argv[sourceArg + 1], "utf8");
const src = '"use strict";\n' + ts(read("supabase/functions/_shared/myinvestor.ts")).replace(/^export /gm, "")
  + "\n" + ts(handlerSource.replace(/^import .*?;\r?\n/gm, ""));

const json = (status, body) => new Response(body === undefined ? "" : JSON.stringify(body), { status });
const nuevos = (extra) => json(201, { payload: { data: Object.assign({ accessToken: "acceso-nuevo", refreshToken: "refresco-nuevo", refreshExpiresIn: 3600 }, extra) } });
const enlace = (id, extra) => Object.assign({ user_id: id, status: "active", access_token: "acceso-" + id, refresh_token: "refresco-" + id, device_id: "dev-" + id, refresh_expires_at: null }, extra);

// `refresco(token, fila)` responde al refresco hecho con ese token. Recibe la fila VIVA para
// poder simular lo que otra función escribe mientras la petición está en vuelo. La BD filtra
// de verdad: una escritura condicionada que no casa no toca nada.
async function tick(rows, refresco, key = "clave", options = {}) {
  const writes = [], calls = [], events = [], eventReads = [];
  const history = options.history || [];
  let handler;
  const casa = (row, filtros) => filtros.every(([c, v]) => row[c] === v);
  const db = { from: (tabla) => ({
    insert: async (event) => {
      assert.equal(tabla, "app_events");
      events.push(event);
      if (options.logThrows) throw new Error("synthetic-log-error");
      if (!options.logError) history.push({ ...event, created_at: new Date().toISOString() });
      return options.logError ? { error: { message: "synthetic-log-error" } } : {};
    },
    select: () => {
      const filtros = [];
      const q = {
        eq: (c, v) => { filtros.push([c, v]); return q; },
        gte: (c, v) => { q.since = [c, v]; return q; },
        like: (c, v) => { q.pattern = [c, v.slice(1, -1)]; return q; },
        limit: () => q,
        maybeSingle: async () => ({ data: tabla === "cron_secrets" ? { secret: "clave" } : null }),
        // Copias: lo que el handler leyó no cambia aunque la fila cambie después.
        then: (ok, ko) => {
          if (tabla === "app_events") {
            eventReads.push({ filtros, since: q.since });
            if (options.readThrows) return Promise.reject(new Error("synthetic-event-read")).then(ok, ko);
            return Promise.resolve(options.readError ? { error: { message: "synthetic-event-read" } } : { data: history.filter(r => casa(r, filtros) && (!q.since || r[q.since[0]] >= q.since[1]) && (!q.pattern || r[q.pattern[0]].includes(q.pattern[1]))) }).then(ok, ko);
          }
          return Promise.resolve({ data: rows.filter((r) => casa(r, filtros)).map((r) => ({ ...r })) }).then(ok, ko);
        },
      };
      return q;
    },
    update: (x) => {
      const filtros = [];
      const q = {
        eq: (c, v) => { filtros.push([c, v]); return q; },
        select: () => q,
        then: (ok, ko) => {
          if (options.writeError) return Promise.resolve({ data: null, error: { message: "synthetic-write-error" } }).then(ok, ko);
          const tocadas = rows.filter((r) => casa(r, filtros));
          tocadas.forEach((r) => Object.assign(r, x));
          writes.push({ ...x, _filas: tocadas.length });
          return Promise.resolve({ data: tocadas.map(row => ({ user_id: row.user_id })), error: null }).then(ok, ko);
        },
      };
      return q;
    },
  }) };
  const fetchFn = async (url, init) => {
    const token = JSON.parse(init.body).refreshToken;
    calls.push(token);
    return refresco(token, rows.find((r) => (options.decodedRefresh || r.refresh_token) === token));
  };
  const names = ["Deno", "createClient", "miTokensFromRow", "miTokensToRow", "timingSafeEqual", "fetch"];
  new Function(...names, src)(
    { serve: (f) => { handler = f; }, env: { get: () => "synthetic" } }, () => db,
    async (l) => {
      if (l.decodeThrows) throw new Error("synthetic-decrypt-error");
      return { access: l.access_token, refresh: options.decodedRefresh || l.refresh_token, deviceId: l.device_id };
    },
    async (access, refresh) => {
      if (options.encodeThrows) throw new Error("synthetic-encrypt-error");
      return { access_token: access, refresh_token: refresh };
    }, (a, b) => a === b, fetchFn
  );
  const res = await handler(new Request("https://edge.invalid", { method: "POST", headers: { "x-cron-key": key } }));
  return { status: res.status, data: await res.json(), writes, calls, events, eventReads };
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
  assert.deepEqual(r.data, { ok: true, refreshed: 0, expired: 0, skipped: 1 });
  eventDetail(r.events[0], "a", { http: 401, outcome: "skipped", hasRefreshExpiresIn: false, guarded: true });
});

await t("éxito tardío tras reconectar: conserva íntegra la sesión nueva", async () => {
  const rows = [enlace("a")];
  const fresh = enlace("a", { access_token: "acceso-reconexion", refresh_token: "refresco-reconexion", refresh_expires_at: "2030-01-01T00:00:00Z", updated_at: "2026-10-16T00:00:00Z" });
  const r = await tick(rows, (_token, fila) => { Object.assign(fila, fresh); return nuevos(); });
  assert.deepEqual(rows[0], fresh);
  assert.equal(r.writes.at(-1)._filas, 0);
  assert.deepEqual(r.data, { ok: true, refreshed: 0, expired: 0, skipped: 1 });
  eventDetail(r.events[0], "a", { http: 201, outcome: "skipped", hasRefreshExpiresIn: true, guarded: true });
});

await t("la guarda compara el refresco almacenado, no el descifrado", async () => {
  const rows = [enlace("a", { refresh_token: "cifrado-original" })];
  const r = await tick(rows, () => nuevos(), "clave", { decodedRefresh: "refresco-descifrado" });
  assert.equal(rows[0].access_token, "acceso-nuevo");
  assert.equal(r.writes[0]._filas, 1);
  assert.deepEqual(r.calls, ["refresco-descifrado"]);
});

await t("rotación concurrente y respuesta tardía sin refreshToken tampoco pisan la sesión nueva", async () => {
  const rows = [enlace("a", { refresh_token: "cifrado-original" })];
  const fresh = enlace("a", { refresh_token: "cifrado-reconexion", access_token: "nuevo-externo", status: "expired" });
  const r = await tick(rows, (_token, fila) => { Object.assign(fila, fresh); return nuevos({ refreshToken: undefined }); }, "clave", { decodedRefresh: "refresco-descifrado" });
  assert.deepEqual(rows[0], fresh);
  assert.equal(r.writes[0]._filas, 0);
});

await t("dos enlaces con el mismo refresco siguen aislados por usuario", async () => {
  const rows = [enlace("a"), enlace("b", { refresh_token: "refresco-a", device_id: null })];
  const second = { ...rows[1] };
  await tick(rows, () => nuevos());
  assert.deepEqual(rows[1], second);
});

// El único vínculo de identidad permitido por el esquema es user_id estructural;
// el contenido diagnóstico tiene una lista exacta de campos y nunca copia el proveedor.
function eventDetail(event, userId, expected) {
  assert.deepEqual(Object.keys(event).sort(), ["app_version", "detail", "email", "kind", "message", "platform", "user_id"]);
  assert.equal(event.user_id, userId);
  assert.equal(event.email, null);
  assert.equal(event.kind, "mi_keepalive");
  assert.equal(event.message, "MyInvestor keepalive");
  assert.equal(event.app_version, "edge");
  assert.equal(event.platform, "server");
  assert.deepEqual(JSON.parse(event.detail), expected);
}

const diagnostics = [
  ["ok con duración", () => nuevos(), 201, "ok", true],
  ["ok sin duración", () => nuevos({ refreshExpiresIn: undefined }), 201, "ok", false],
  ["duración cero presente", () => nuevos({ refreshExpiresIn: 0 }), 201, "ok", true],
  ["duración null presente", () => nuevos({ refreshExpiresIn: null }), 201, "ok", true],
  ["400", () => json(400, {}), 400, "rejected", false],
  ["401", () => json(401, {}), 401, "rejected", false],
  ["403", () => json(403, {}), 403, "skipped", false],
  ["429", () => json(429, {}), 429, "skipped", false],
  ["503 HTML", () => new Response("<html>synthetic-private</html>", { status: 503 }), 503, "skipped", false],
  ["200 sin token", () => json(200, {}), 200, "skipped", false],
  ["red caída", () => { throw new Error("synthetic-private-network"); }, null, "skipped", false],
  ["lectura de cuerpo falla", () => ({ status: 502, text: async () => { throw new Error("synthetic-private-body"); } }), 502, "skipped", false],
];
for (const [name, response, http, outcome, hasRefreshExpiresIn] of diagnostics) await t("evento cerrado por enlace: " + name, async () => {
  const r = await tick([enlace("a")], response);
  assert.equal(r.events.length, 1);
  eventDetail(r.events[0], "a", { http, outcome, hasRefreshExpiresIn, guarded: false });
});

await t("el evento nunca copia tokens, dispositivo, email, payload ni excepciones", async () => {
  const marker = "SYNTHETIC_PRIVATE_CANARY";
  const rows = [enlace("a", { email: marker, device_id: marker, access_token: marker, refresh_token: marker })];
  const r = await tick(rows, () => nuevos({ accessToken: marker, refreshToken: marker, refreshExpiresIn: marker, email: marker, message: marker }));
  assert.equal(r.events.length, 1);
  eventDetail(r.events[0], "a", { http: 201, outcome: "ok", hasRefreshExpiresIn: true, guarded: false });
  assert.ok(!JSON.stringify(r.events).includes(marker));
});

await t("falta de credenciales y fallo al descifrar se registran y no frenan el siguiente enlace", async () => {
  const rows = [enlace("sin", { refresh_token: null }), enlace("device", { device_id: null }), enlace("roto", { decodeThrows: true }), enlace("vivo")];
  const r = await tick(rows, () => nuevos());
  assert.equal(r.status, 200);
  assert.deepEqual(r.calls, ["refresco-vivo"]);
  assert.equal(r.events.length, 4);
  for (let i = 0; i < 3; i++) eventDetail(r.events[i], rows[i].user_id, { http: null, outcome: "skipped", hasRefreshExpiresIn: false, guarded: false });
  eventDetail(r.events[3], "vivo", { http: 201, outcome: "ok", hasRefreshExpiresIn: true, guarded: false });
});

await t("fallo de cifrado no se anuncia como éxito y conserva el estado HTTP", async () => {
  const r = await tick([enlace("a")], () => nuevos(), "clave", { encodeThrows: true });
  assert.equal(r.events.length, 1);
  eventDetail(r.events[0], "a", { http: 201, outcome: "skipped", hasRefreshExpiresIn: true, guarded: false });
  assert.equal(r.data.skipped, 1);
  assert.deepEqual(r.writes, []);
});

for (const options of [{ logThrows: true }, { logError: true }]) await t("fallo del registro no cambia el resultado ni frena otros enlaces: " + Object.keys(options)[0], async () => {
  const rows = [enlace("a"), enlace("b")];
  const r = await tick(rows, () => nuevos(), "clave", options);
  assert.equal(r.status, 200);
  assert.deepEqual(r.data, { ok: true, refreshed: 2, expired: 0, skipped: 0 });
  assert.equal(r.events.length, 2);
  assert.ok(rows.every(row => row.access_token === "acceso-nuevo"));
});

for (const status of [201, 401]) await t("error al guardar no cuenta como renovación ni caducidad: " + status, async () => {
  const rows = [enlace("a")], original = { ...rows[0] };
  const r = await tick(rows, () => status === 201 ? nuevos() : json(status, {}), "clave", { writeError: true });
  assert.deepEqual(rows[0], original);
  assert.deepEqual(r.data, { ok: true, refreshed: 0, expired: 0, skipped: 1 });
  eventDetail(r.events[0], "a", { http: status, outcome: "skipped", hasRefreshExpiresIn: status === 201, guarded: false });
});

await t("403 repetido: uno por hora y por usuario, sin suprimir otros outcomes", async () => {
  const history = [], rows = [enlace("a"), enlace("b")];
  await tick(rows, () => json(429, {}), "clave", { history });
  const first = await tick(rows, () => json(403, {}), "clave", { history });
  assert.equal(first.events.length, 2);
  const repeated = await tick(rows, () => json(403, {}), "clave", { history });
  assert.equal(repeated.events.length, 0);
  const changedBody = await tick(rows, () => json(403, { payload: { data: { refreshExpiresIn: 0 } } }), "clave", { history });
  assert.equal(changedBody.events.length, 0, "el mismo 403 no se duplica aunque cambie la presencia de duración");
  assert.deepEqual(repeated.data, { ok: true, refreshed: 0, expired: 0, skipped: 2 });
  const changed = await tick(rows, () => json(429, {}), "clave", { history });
  assert.equal(changed.events.length, 2);
  history.forEach(event => { event.created_at = new Date(Date.now() - 61 * 60 * 1000).toISOString(); });
  const nextHour = await tick(rows, () => json(403, {}), "clave", { history });
  assert.equal(nextHour.events.length, 2);
});

for (const options of [{ readThrows: true }, { readError: true }]) await t("si falla el control horario, omite el log de 403 y continúa: " + Object.keys(options)[0], async () => {
  const r = await tick([enlace("a"), enlace("b")], token => token === "refresco-a" ? json(403, {}) : nuevos(), "clave", options);
  assert.deepEqual(r.data, { ok: true, refreshed: 1, expired: 0, skipped: 1 });
  assert.equal(r.events.length, 1);
  eventDetail(r.events[0], "b", { http: 201, outcome: "ok", hasRefreshExpiresIn: true, guarded: false });
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
  assert.deepEqual(r.events, []);
});

if (failures) { console.error("\n" + failures + " fallo(s)"); process.exit(1); }
