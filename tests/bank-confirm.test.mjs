// P2-01 (auditoría 14/11): la vinculación de Open Banking la confirma quien la inició.
// Handlers REALES de bank-connect, bank-callback y bank-confirm sobre la misma tabla sintética
// (`baseDatos` aplica los filtros de verdad); Enable Banking y la BD son dobles, sin red.
import assert from "node:assert/strict";
import { E, Entrada, CONNECT, CALLBACK, baseDatos, handlerSrc, read, FakeDate, reloj } from "./helpers/banco-sintetico.mjs";

const CONFIRM = handlerSrc(read("supabase/functions/bank-confirm/index.ts"));
const BASE_ENV = { SUPABASE_URL: "https://sb.invalid", APP_URL: "https://app.invalid/" };
const SESION = { session_id: "S-victima", accounts: [{ uid: "acc-victima", account_id: { iban: "ES0000000000000000000000" }, currency: "EUR" }] };
let pass = 0;
async function t(name, fn) { await fn(); pass++; console.log("  ✓ " + name); }
const deno = (env, onServe) => ({ serve: onServe, env: { get: (k) => ({ ...BASE_ENV, ...env })[k] } });
// La BD de un usuario concreto sobre la tabla compartida, con los eventos a la vista.
function db(rows, user, eventos = [], opts = {}) {
  const base = baseDatos(rows, { user, ...opts });
  return { ...base, from: (n) => n === "app_events" ? { insert: async (x) => { eventos.push(x); return {}; } } : base.from(n) };
}

async function conecta(rows, user, body, env = {}) {
  let handler;
  new Function("Deno", "createClient", "ebApi", "ebConfig", "jsonResp", "makeJWT", "withCors", "Date", CONNECT)(
    deno(env, (f) => { handler = f; }), () => db(rows, user), async () => ({ url: "https://bank.invalid/login" }), () => ({}),
    E.jsonResp, async () => "jwt", (f) => f, FakeDate);
  const res = await handler(new Request("https://sb.invalid/functions/v1/bank-connect", { method: "POST", body: JSON.stringify({ aspsp_name: "CaixaBank", ...body }) }));
  assert.equal(res.status, 200);
  return rows.find((r) => r.user_id === user && r.aspsp_name === "CaixaBank").state;
}

async function vuelve(rows, state, env = {}) {
  let handler; const llamadas = [];
  new Function("Deno", "createClient", "ebApi", "ebConfig", "makeJWT", "encryptSessionId", "CallbackFallo", "codigoCallback", "codigoNolink", "Date", "console", "setTimeout",
    "CONFIRM_PREFIX", "huellaConfirmacion", "nuevoTokenConfirmacion", "stateConConfirmacion", CALLBACK)(
    deno(env, (f) => { handler = f; }), () => db(rows, "nadie"), async (_j, p, init) => { llamadas.push([p, init?.method]); return SESION; }, () => ({}), async () => "jwt",
    async (id) => (id ? "enc:v1:" + id : null), Entrada.CallbackFallo, Entrada.codigoCallback, Entrada.codigoNolink, FakeDate, { error() {} }, (f) => setTimeout(f, 0),
    Entrada.CONFIRM_PREFIX, Entrada.huellaConfirmacion, Entrada.nuevoTokenConfirmacion, Entrada.stateConConfirmacion);
  const res = await handler(new Request("https://sb.invalid/functions/v1/bank-callback?code=synthetic&state=" + encodeURIComponent(state)));
  assert.equal(res.status, 302);
  return { location: new URL(res.headers.get("location")), llamadas };
}

async function confirma(rows, user, token, eventos = [], opts = {}) {
  let handler;
  new Function("Deno", "createClient", "jsonResp", "withCors", "confirmacionCaducada", "huellaConfirmacion", "Date", "console", CONFIRM)(
    deno({}, (f) => { handler = f; }), () => db(rows, user, eventos, opts), E.jsonResp, (f) => f,
    Entrada.confirmacionCaducada, Entrada.huellaConfirmacion, FakeDate, { error() {} });
  const res = await handler(new Request("https://sb.invalid/functions/v1/bank-confirm", { method: "POST", headers: { Authorization: "Bearer synthetic" }, body: JSON.stringify({ token }) }));
  return { status: res.status, body: await res.json() };
}
const tokenDe = (loc) => loc.searchParams.get("t") || loc.searchParams.get("confirm");

await t("compatibilidad: sin pedir confirmación todo sigue como hoy (web y APK)", async () => {
  for (const app of [false, true]) {
    const rows = [];
    const state = await conecta(rows, "familia", app ? { platform: "app" } : {});
    assert.ok(!/\.c(\.app)?$/.test(state));
    const { location } = await vuelve(rows, state);
    assert.equal(location.href, app ? "https://app.invalid/back.html?ok=1" : "https://app.invalid/?bank=ok");
    assert.equal(rows[0].status, "active"); assert.equal(rows[0].state, null);
  }
});

await t("con confirmación: el callback deja pending con la huella y manda el token solo en la vuelta", async () => {
  for (const app of [false, true]) {
    const rows = [];
    const state = await conecta(rows, "familia", { confirm: true, ...(app ? { platform: "app" } : {}) });
    assert.match(state, app ? /^[^.]+\.c\.app$/ : /^[^.]+\.c$/);
    const { location, llamadas } = await vuelve(rows, state);
    assert.equal(llamadas.length, 1, "el code se canjea una vez, como siempre");
    const token = tokenDe(location);
    assert.match(token, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(location.origin + location.pathname, app ? "https://app.invalid/back.html" : "https://app.invalid/");
    if (!app) assert.equal(location.searchParams.get("bank"), "confirm");
    const fila = rows[0];
    assert.equal(fila.status, "pending", "bank-sync solo lee enlaces active");
    assert.equal(fila.session_id, "enc:v1:S-victima");
    assert.equal(fila.state, await Entrada.huellaConfirmacion(token));
    assert.ok(!JSON.stringify(fila).includes(token), "la fila nunca guarda el token");
    const ok = await confirma(rows, "familia", token);
    assert.deepEqual(ok, { status: 200, body: { ok: true, aspsp_name: "CaixaBank" } });
    assert.equal(fila.status, "active"); assert.equal(fila.state, null);
    const otra = await confirma(rows, "familia", token);
    assert.equal(otra.body.error, "state", "el token es de un solo uso");
  }
});

await t("ataque: la víctima autoriza un enlace ajeno y no se activa ni con su sesión ni sin token", async () => {
  const rows = [];
  const state = await conecta(rows, "atacante", { confirm: true });
  const { location } = await vuelve(rows, state);   // el navegador que vuelve es el de la víctima
  const token = tokenDe(location);
  const eventos = [];
  const r = await confirma(rows, "victima", token, eventos);
  assert.equal(r.status, 400); assert.equal(r.body.error, "state", "misma respuesta que un token inexistente");
  assert.equal(rows[0].status, "pending"); assert.notEqual(rows[0].state, null);
  assert.deepEqual(eventos.map((e) => [e.user_id, e.message]), [["victima", "BANK-CONFIRM: ajeno"]]);
  assert.ok(!JSON.stringify(eventos).includes(token));
  // El atacante no tiene el token; con la huella que lee por RLS tampoco le sirve.
  assert.equal((await confirma(rows, "atacante", "A".repeat(43))).body.error, "state");
  assert.equal((await confirma(rows, "atacante", rows[0].state)).status, 400, "la huella no es un token válido");
  const { location: l2, llamadas } = await vuelve(rows, rows[0].state);
  assert.equal(l2.searchParams.get("msg"), "state"); assert.equal(llamadas.length, 0, "la huella no vale como state");
  assert.equal(rows[0].status, "pending");
});

await t("fase 2: BANK_REQUIRE_CONFIRM=1 lo exige a clientes que no lo piden", async () => {
  const rows = [];
  const env = { BANK_REQUIRE_CONFIRM: "1" };
  const state = await conecta(rows, "familia", { platform: "app" }, env);
  assert.match(state, /\.c\.app$/);
  const viejo = await conecta([], "familia", {}, {});   // emitido antes de activar el interruptor
  const legacyRows = [{ ...rows[0], state: viejo, user_id: "familia" }];
  const { location } = await vuelve(legacyRows, viejo, env);
  assert.equal(location.searchParams.get("bank"), "confirm");
  assert.equal(legacyRows[0].status, "pending");
});

await t("confirmar caduca a la hora de emitir el state y no pisa una reconexión", async () => {
  const rows = [];
  const state = await conecta(rows, "familia", { confirm: true });
  const token = tokenDe((await vuelve(rows, state)).location);
  const antes = reloj.ms;
  try {
    reloj.ms += 61 * 60 * 1000;
    assert.equal((await confirma(rows, "familia", token)).body.error, "caducado");
    assert.equal(rows[0].status, "pending");
  } finally { reloj.ms = antes; }
  // Reconexión entre la lectura y la escritura: bank-connect renueva state y emisión. También
  // si solo cambiara la emisión, la confirmación vieja no puede activar la generación nueva.
  for (const cambio of ["reconexion", "solo-emision"]) {
    const rows2 = [];
    const s2 = await conecta(rows2, "familia", { confirm: true });
    const tok2 = tokenDe((await vuelve(rows2, s2)).location);
    const trasLeer = (filas) => {
      filas[0].state_issued_at = new Date(reloj.ms + 1000).toISOString();
      if (cambio === "reconexion") filas[0].state = "otro-state.c";
    };
    const r = await confirma(rows2, "familia", tok2, [], { trasLeer });
    assert.equal(r.status, 409, cambio); assert.equal(rows2[0].status, "pending", cambio);
  }
});

await t("cuerpo inválido y sin sesión no tocan la tabla", async () => {
  const rows = [{ id: "L", user_id: "familia", aspsp_name: "CaixaBank", status: "pending", state: "confirm:x" }];
  for (const token of ["corto", 5, null, "B".repeat(44)]) assert.equal((await confirma(rows, "familia", token)).status, 400);
  assert.equal(rows[0].status, "pending");
});

console.log("bank-confirm: " + pass + " PASS; handlers reales, BD y banco sintéticos, sin red");
