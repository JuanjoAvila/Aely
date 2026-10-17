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
  + "\n" + ts(read("supabase/functions/_shared/myinvestor-refresh-save.ts")).replace(/^export /gm, "")
  + "\n" + ts(handlerSource.replace(/^import .*?;\r?\n/gm, ""));

const json = (status, body) => new Response(body === undefined ? "" : JSON.stringify(body), { status });
const nuevos = (extra) => json(201, { payload: { data: Object.assign({ accessToken: "acceso-nuevo", refreshToken: "refresco-nuevo", refreshExpiresIn: 3600 }, extra) } });
const enlace = (id, extra) => Object.assign({ user_id: id, connection_version: "conexion-" + id, status: "active", access_token: "acceso-" + id, refresh_token: "refresco-" + id, device_id: "dev-" + id, refresh_expires_at: null }, extra);

// `refresco(token, fila)` responde al refresco hecho con ese token. Recibe la fila VIVA para
// poder simular lo que otra función escribe mientras la petición está en vuelo. La BD filtra
// de verdad: una escritura condicionada que no casa no toca nada.
async function tick(rows, refresco, key = "clave", options = {}) {
  const writes = [], calls = [], events = [], eventReads = [], attempts = [], timers = [];
  const history = options.history || [];
  let handler;
  const casa = (row, filtros) => filtros.every(([c, v]) => row[c] === v);
  const db = { from: (tabla) => ({
    insert: async (event) => {
      assert.equal(tabla, "app_events");
      events.push(event);
      if (options.logThrows) throw new Error("synthetic-log-error");
      if (!options.logError) history.push({ ...event, id: history.length + 1, created_at: new Date().toISOString() });
      return options.logError ? { error: { message: "synthetic-log-error" } } : {};
    },
    select: () => {
      const filtros = [];
      const q = {
        eq: (c, v) => { filtros.push([c, v]); return q; },
        gte: (c, v) => { q.since = [c, v]; return q; },
        like: (c, v) => { q.pattern = [c, v.slice(1, -1)]; return q; },
        order: (column, { ascending }) => { (q.orders ||= []).push([column, ascending]); return q; },
        limit: n => { q.count = n; return q; },
        maybeSingle: async () => ({ data: tabla === "cron_secrets" ? { secret: "clave" } : rows.filter(r => casa(r, filtros)).map(r => ({ ...r }))[0] || null }),
        // Copias: lo que el handler leyó no cambia aunque la fila cambie después.
        then: (ok, ko) => {
          if (tabla === "app_events") {
            eventReads.push({ filtros, since: q.since });
            if (options.readThrows) return Promise.reject(new Error("synthetic-event-read")).then(ok, ko);
            const selected = history.filter(r => casa(r, filtros) && (!q.since || r[q.since[0]] >= q.since[1]) && (!q.pattern || r[q.pattern[0]].includes(q.pattern[1])));
            selected.sort((a, b) => {
              for (const [column, ascending] of q.orders || []) {
                if (a[column] !== b[column]) return (a[column] < b[column] ? -1 : 1) * (ascending ? 1 : -1);
              }
              return 0;
            });
            return Promise.resolve(options.readError ? { error: { message: "synthetic-event-read" } } : { data: selected.slice(0, q.count ?? selected.length) }).then(ok, ko);
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
          attempts.push({ patch: { ...x }, filters: filtros.map(f => [...f]) });
          if (options.beforeWrite) options.beforeWrite(attempts.length, rows);
          if (options.writeThrows && attempts.length <= options.writeThrows) return Promise.reject(new Error("synthetic-write-throw")).then(ok, ko);
          if (options.writeError || attempts.length <= (options.writeFailures || 0)) return Promise.resolve({ data: null, error: { message: "synthetic-write-error" } }).then(ok, ko);
          const tocadas = rows.filter((r) => casa(r, filtros));
          tocadas.forEach((r) => Object.assign(r, x));
          writes.push({ ...x, _filas: tocadas.length });
          if (options.appliedError && attempts.length === 1) return Promise.resolve({ data: null, error: { message: "synthetic-lost-ack" } }).then(ok, ko);
          return Promise.resolve({ data: tocadas.map(row => ({ user_id: row.user_id })), error: null }).then(ok, ko);
        },
      };
      return q;
    },
  }) };
  const fetchFn = async (url, init) => {
    const token = JSON.parse(init.body).refreshToken;
    calls.push(token);
    return refresco(token, rows.find((r) => (options.decodedRefresh || r.refresh_token) === token), init);
  };
  const names = ["Deno", "createClient", "miTokensFromRow", "miTokensToRow", "timingSafeEqual", "fetch", "setTimeout", "clearTimeout"];
  new Function(...names, src)(
    { serve: (f) => { handler = f; }, env: { get: () => "synthetic" } }, () => db,
    async (l) => {
      if (l.decodeThrows) throw new Error("synthetic-decrypt-error");
      return { access: l.access_token, refresh: options.decodedRefresh || l.refresh_token, deviceId: l.device_id };
    },
    async (access, refresh) => {
      if (options.encodeThrows) throw new Error("synthetic-encrypt-error");
      return { access_token: access, refresh_token: refresh };
    }, (a, b) => a === b, fetchFn,
    (fn, delay) => { const timer = { delay, cleared: false, id: setTimeout(fn, options.fastClock ? 5 : delay) }; timers.push(timer); return timer; },
    timer => { timer.cleared = true; clearTimeout(timer.id); }
  );
  const res = await handler(new Request("https://edge.invalid", { method: "POST", headers: { "x-cron-key": key } }));
  assert.ok(timers.every(t => t.cleared), "cada petición terminada limpia su reloj");
  return { status: res.status, data: await res.json(), writes, calls, events, eventReads, attempts, timers };
}

let failures = 0;
const filterIndex = process.argv.indexOf("--filter");
async function t(name, fn) { if (filterIndex >= 0 && !name.includes(process.argv[filterIndex + 1])) return; try { await fn(); console.log("  ✓ " + name); } catch (e) { failures++; console.error("  ✗ " + name + ": " + e.message); } }

console.log("myinvestor-keepalive");

await t("Remates: falta connection_version es connection_unavailable sin guardar", async () => {
  const r = await tick([enlace("a", { connection_version: undefined })], () => { throw new Error("no debe llamar al banco"); });
  assert.deepEqual(r.data, { ok: true, refreshed: 0, expired: 0, skipped: 1 });
  assert.equal(r.calls.length, 0);
  assert.equal(r.attempts.length, 0);
  assert.equal(r.writes.length, 0);
  assert.equal(r.events.length, 1);
  eventDetail(r.events[0], "a", { outcome: "skipped", code: "connection_unavailable", http: null, hasRefreshExpiresIn: false, hasRefreshToken: false, guarded: false });
});

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
  eventDetail(r.events[0], "a", { http: 401, outcome: "skipped", code: "raced", hasRefreshExpiresIn: false, hasRefreshToken: false, guarded: true });
});

await t("éxito tardío tras reconectar: conserva íntegra la sesión nueva", async () => {
  const rows = [enlace("a")];
  const fresh = enlace("a", { access_token: "acceso-reconexion", refresh_token: "refresco-reconexion", refresh_expires_at: "2030-01-01T00:00:00Z", updated_at: "2026-10-16T00:00:00Z" });
  const r = await tick(rows, (_token, fila) => { Object.assign(fila, fresh); return nuevos(); });
  assert.deepEqual(rows[0], fresh);
  assert.equal(r.writes.at(-1)._filas, 0);
  assert.deepEqual(r.data, { ok: true, refreshed: 0, expired: 0, skipped: 1 });
  eventDetail(r.events[0], "a", { http: 201, outcome: "skipped", code: "raced", hasRefreshExpiresIn: true, hasRefreshToken: true, guarded: true });
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
  const code = outcome === "ok" ? "ok" : outcome === "rejected" ? "rejected" : http === 403 ? "http_403" : http === 200 ? "no_access_token" : http === null || http === 502 ? "network" : "http_other";
  eventDetail(r.events[0], "a", { http, outcome, code, hasRefreshExpiresIn, hasRefreshToken: outcome === "ok", guarded: false });
});

await t("el evento nunca copia tokens, dispositivo, email, payload ni excepciones", async () => {
  const marker = "SYNTHETIC_PRIVATE_CANARY";
  const rows = [enlace("a", { email: marker, device_id: marker, access_token: marker, refresh_token: marker })];
  const r = await tick(rows, () => nuevos({ accessToken: marker, refreshToken: marker, refreshExpiresIn: marker, email: marker, message: marker }));
  assert.equal(r.events.length, 1);
  eventDetail(r.events[0], "a", { http: 201, outcome: "ok", code: "ok", hasRefreshExpiresIn: true, hasRefreshToken: true, guarded: false });
  assert.ok(!JSON.stringify(r.events).includes(marker));
});

await t("falta de credenciales y fallo al descifrar se registran y no frenan el siguiente enlace", async () => {
  const rows = [enlace("sin", { refresh_token: null }), enlace("device", { device_id: null }), enlace("roto", { decodeThrows: true }), enlace("vivo")];
  const r = await tick(rows, () => nuevos());
  assert.equal(r.status, 200);
  assert.deepEqual(r.calls, ["refresco-vivo"]);
  assert.equal(r.events.length, 4);
  for (let i = 0; i < 3; i++) eventDetail(r.events[i], rows[i].user_id, { http: null, outcome: "skipped", code: i === 2 ? "decrypt" : "no_creds", hasRefreshExpiresIn: false, hasRefreshToken: false, guarded: false });
  eventDetail(r.events[3], "vivo", { http: 201, outcome: "ok", code: "ok", hasRefreshExpiresIn: true, hasRefreshToken: true, guarded: false });
});

await t("fallo de cifrado no se anuncia como éxito y conserva el estado HTTP", async () => {
  const r = await tick([enlace("a")], () => nuevos(), "clave", { encodeThrows: true });
  assert.equal(r.events.length, 1);
  eventDetail(r.events[0], "a", { http: 201, outcome: "skipped", code: "encrypt", hasRefreshExpiresIn: true, hasRefreshToken: true, guarded: false });
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
  eventDetail(r.events[0], "a", { http: status, outcome: "skipped", code: "save_error", hasRefreshExpiresIn: status === 201, hasRefreshToken: status === 201, guarded: false });
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

for (const options of [{ readThrows: true }, { readError: true }]) await t("si falla el control horario, omite logs limitados y continúa: " + Object.keys(options)[0], async () => {
  const r = await tick([enlace("a"), enlace("b")], token => token === "refresco-a" ? json(403, {}) : nuevos(), "clave", options);
  assert.deepEqual(r.data, { ok: true, refreshed: 1, expired: 0, skipped: 1 });
  assert.equal(r.events.length, 0);
  assert.equal(r.writes.filter(w => w._filas === 1).length, 1);
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

await t("R1: éxito estable se limita por hora y usuario, pero sigue renovando", async () => {
  const history = [], rows = [enlace("a"), enlace("b")];
  const first = await tick(rows, () => nuevos(), "clave", { history });
  assert.equal(first.events.length, 2);
  const repeated = await tick(rows, () => nuevos(), "clave", { history });
  assert.equal(repeated.events.length, 0);
  assert.equal(repeated.data.refreshed, 2);
  const error = await tick(rows, () => json(500, {}), "clave", { history });
  assert.equal(error.events.length, 2, "el éxito anterior no tapa errores");
  history.forEach(e => { e.created_at = new Date(Date.now() - 3600001).toISOString(); });
  assert.equal((await tick(rows, () => nuevos(), "clave", { history })).events.length, 2);
});

await t("R2: código y presencia del refresco distinguen persistencia de rechazo", async () => {
  const ok = await tick([enlace("a")], () => nuevos());
  assert.equal(JSON.parse(ok.events[0].detail).code, "ok");
  assert.equal(JSON.parse(ok.events[0].detail).hasRefreshToken, true);
  const failed = await tick([enlace("a")], () => nuevos(), "clave", { writeError: true });
  assert.equal(JSON.parse(failed.events[0].detail).code, "save_error");
  assert.equal(JSON.parse(failed.events[0].detail).http, 201);
  assert.equal(JSON.parse(failed.events[0].detail).outcome, "skipped");
});

await t("R3: primer guardado falla, el único reintento conserva token original y payload", async () => {
  const rows = [enlace("a")];
  const r = await tick(rows, () => nuevos(), "clave", { writeFailures: 1 });
  assert.equal(rows[0].refresh_token, "refresco-nuevo");
  assert.equal(r.data.refreshed, 1);
  assert.equal(r.calls.length, 1, "no se vuelve a refrescar en el banco");
  assert.equal(r.attempts.length, 2);
  assert.deepEqual(r.attempts[0], r.attempts[1]);
  assert.deepEqual(r.attempts[1].filters, [["user_id", "a"], ["connection_version", "conexion-a"], ["refresh_token", "refresco-a"]]);
});

for (const bodyHang of [false, true]) await t("R5: timeout de " + (bodyHang ? "cuerpo" : "cabeceras") + " deja continuar al siguiente enlace", async () => {
  let aborted = false;
  const r = await tick([enlace("a"), enlace("b")], (token, _row, init) => {
    if (token === "refresco-b") return nuevos();
    const hang = () => new Promise((resolve, reject) => {
      const watchdog = setTimeout(() => resolve(bodyHang ? "{}" : json(503, {})), 100);
      init.signal?.addEventListener("abort", () => { aborted = true; clearTimeout(watchdog); reject(new DOMException("synthetic", "AbortError")); }, { once: true });
    });
    return bodyHang ? { status: 201, text: hang } : hang();
  }, "clave", { fastClock: true });
  assert.equal(aborted, true, "la petición debe cancelarse antes del watchdog sintético");
  assert.deepEqual(r.data, { ok: true, refreshed: 1, expired: 0, skipped: 1 });
  assert.equal(JSON.parse(r.events[0].detail).code, "network");
  assert.equal(r.timers.length, 2);
  assert.ok(r.timers.every(t => t.delay === 10000 && t.cleared));
});

await t("R1: el límite de éxito no cruza usuarios ni categorías", async () => {
  const history = [];
  await tick([enlace("a")], () => nuevos(), "clave", { history });
  const other = await tick([enlace("b")], () => nuevos(), "clave", { history });
  assert.equal(other.events.length, 1);
  const rejected = await tick([enlace("a")], () => json(401, {}), "clave", { history });
  assert.equal(JSON.parse(rejected.events[0].detail).code, "rejected");
  const failed = await tick([enlace("a")], () => nuevos(), "clave", { history, writeError: true });
  assert.equal(JSON.parse(failed.events[0].detail).code, "save_error");
  assert.equal((await tick([enlace("a")], () => json(403, {}), "clave", { history })).events.length, 1);
});

for (const refreshToken of [undefined, null, ""]) await t("R2: refresco ausente o vacío es booleano false: " + String(refreshToken), async () => {
  const rows = [enlace("a")];
  const r = await tick(rows, () => nuevos({ refreshToken }));
  assert.equal(JSON.parse(r.events[0].detail).hasRefreshToken, false);
  assert.equal(rows[0].refresh_token, "refresco-a");
});

for (const option of ["writeFailures", "writeThrows"]) {
  await t("R3: dos fallos de persistencia se detienen sin tercer intento: " + option, async () => {
    const rows = [enlace("a")], before = { ...rows[0] };
    const r = await tick(rows, () => nuevos(), "clave", { [option]: 2 });
    assert.equal(r.attempts.length, 2);
    assert.deepEqual(rows[0], before);
    assert.deepEqual(r.data, { ok: true, refreshed: 0, expired: 0, skipped: 1 });
    assert.equal(JSON.parse(r.events[0].detail).code, "save_error");
    assert.equal(r.calls.length, 1);
  });
}

await t("R3: excepción del primer UPDATE también permite guardar una vez", async () => {
  const r = await tick([enlace("a")], () => nuevos(), "clave", { writeThrows: 1 });
  assert.equal(r.attempts.length, 2);
  assert.equal(r.data.refreshed, 1);
});

await t("R3: reconexión entre intentos conserva todos los campos y corta la carrera", async () => {
  const rows = [enlace("a")];
  const fresh = enlace("a", { access_token: "otro-acceso", refresh_token: "otro-refresco", status: "expired", updated_at: "2030-01-01T00:00:00Z" });
  const r = await tick(rows, () => nuevos(), "clave", { writeFailures: 1,
    beforeWrite: n => { if (n === 2) Object.assign(rows[0], fresh); } });
  assert.equal(r.attempts.length, 2);
  assert.deepEqual(rows[0], fresh);
  assert.equal(JSON.parse(r.events[0].detail).code, "raced");
  assert.equal(JSON.parse(r.events[0].detail).guarded, true);
  assert.equal(r.data.skipped, 1);
});

await t("R3: cero filas al primer intento no se reintenta", async () => {
  const r = await tick([enlace("a")], (_token, row) => { row.refresh_token = "rotado"; return nuevos(); });
  assert.equal(r.attempts.length, 1);
  assert.equal(JSON.parse(r.events[0].detail).code, "raced");
});

await t("R3: rechazo no habilita el reintento reservado al refresco bueno", async () => {
  const r = await tick([enlace("a")], () => json(401, {}), "clave", { writeFailures: 1 });
  assert.equal(r.attempts.length, 1);
  assert.equal(JSON.parse(r.events[0].detail).code, "save_error");
  assert.equal(JSON.parse(r.events[0].detail).http, 401);
});

await t("R2: error de cuerpo con HTTP403 no queda oculto por el límite de rechazos403", async () => {
  const history = [];
  await tick([enlace("a")], () => json(403, {}), "clave", { history });
  const failed = await tick([enlace("a")], () => ({ status: 403, text: async () => { throw new Error("synthetic-body"); } }), "clave", { history });
  assert.equal(failed.events.length, 1);
  assert.equal(JSON.parse(failed.events[0].detail).code, "network");
  const onlyNetwork = history.filter(e => JSON.parse(e.detail).code === "network");
  const actual403 = await tick([enlace("a")], () => json(403, {}), "clave", { history: onlyNetwork });
  assert.equal(actual403.events.length, 1, "un fallo de lectura no cuenta como diagnóstico http_403");
});

await t("Rev2: ok-500-ok en una hora registra la recuperación y limita el siguiente idéntico", async () => {
  const rows = [enlace("a")], history = [];
  await tick(rows, () => nuevos(), "clave", { history });
  await tick(rows, () => json(500, {}), "clave", { history });
  // Empate realista de reloj: id desempata y evita elegir el éxito anterior.
  const tiedAt = new Date().toISOString();
  history.forEach(e => { e.created_at = tiedAt; });
  const recovered = await tick(rows, () => nuevos(), "clave", { history });
  assert.equal(recovered.events.length, 1, "registrar vuelta a ok aunque hubiese otro ok en la hora");
  assert.equal(JSON.parse(recovered.events[0].detail).code, "ok");
  assert.equal((await tick(rows, () => nuevos(), "clave", { history })).events.length, 0);
});

for (const missing of ["refreshExpiresIn", "refreshToken", "ambos"]) await t("Rev2: ok normal seguido de ok sin " + missing + " conserva la señal", async () => {
  const rows = [enlace("a")], history = [];
  await tick(rows, () => nuevos(), "clave", { history });
  const extra = missing === "ambos" ? { refreshExpiresIn: undefined, refreshToken: undefined } : { [missing]: undefined };
  const changed = await tick(rows, () => nuevos(extra), "clave", { history });
  assert.equal(changed.events.length, 1);
  const d = JSON.parse(changed.events[0].detail);
  assert.equal(d.hasRefreshExpiresIn, missing === "refreshToken");
  assert.equal(d.hasRefreshToken, missing === "refreshExpiresIn");
  assert.equal((await tick(rows, () => nuevos(extra), "clave", { history })).events.length, 0);
  assert.equal((await tick(rows, () => nuevos(), "clave", { history })).events.length, 1, "también registra la recuperación de campos");
});

await t("OPS08: el readback confirma el guardado propio tras perder el acuse", async () => {
  const rows = [enlace("a")];
  const r = await tick(rows, () => nuevos(), "clave", { appliedError: true });
  assert.equal(rows[0].refresh_token, "refresco-nuevo", "el primer intento se aplicó");
  assert.equal(r.attempts.length, 1);
  assert.deepEqual(r.writes.map(w => w._filas), [1]);
  assert.deepEqual(r.data, { ok: true, refreshed: 1, expired: 0, skipped: 0 });
  assert.equal(JSON.parse(r.events[0].detail).code, "ok");
  assert.equal(JSON.parse(r.events[0].detail).guarded, false);
});

if (failures) { console.error("\n" + failures + " fallo(s)"); process.exit(1); }
