import { accounts, encryptLegacy, fixture, hits, positionAccounts, refreshed, response, run, seedHits } from "./myinvestor-counter.fixture.ts";
const assert = { equal(actual: unknown, expected: unknown) {
  if (actual !== expected) throw new Error("esperado " + JSON.stringify(expected) + ", recibido " + JSON.stringify(actual));
} };
function assertPositions(data: any) {
  assert.equal(data.ok, true);
  assert.equal(data.positions?.length, 1);
  assert.equal(data.positions[0].isin, "SYNTHETIC-FUND");
  assert.equal(data.positions[0].shares, 3);
  assert.equal(Math.round(data.positions[0].value * 100), 3702);
  assert.equal(Math.round(data.positions[0].cost * 100), 3000);
}

Deno.test("reconectar por login deja el contador a cero: antes 2, después 0", async () => {
  const f = fixture(); seedHits(f, 2);
  assert.equal(hits(f), 2);
  const r = await run("connect", f, { body: { customerId: "synthetic", password: "synthetic", deviceId: "device" } });
  assert.equal(r.data.connected, true);
  assert.equal(hits(f), 0);
});
Deno.test("reconectar con tokens del móvil deja el contador a cero: antes 2, después 0", async () => {
  const f = fixture(); seedHits(f, 2);
  const r = await run("connect", f, { body: { storeTokens: true, deviceId: "device", accessToken: "mobile-access", refreshToken: "mobile-refresh" } });
  assert.equal(r.data.connected, true);
  assert.equal(hits(f), 0);
});
Deno.test("lectura buena deja el contador a cero: antes 2, después 0", async () => {
  const f = fixture(); seedHits(f, 2);
  const r = await run("sync", f, { access: accounts });
  assert.equal(r.data.ok, true);
  assert.equal(hits(f), 0);
});
Deno.test("keepalive no suma: antes 2, después 2", async () => {
  const f = fixture(); seedHits(f, 2);
  await run("keepalive", f, { refresh: refreshed });
  assert.equal(hits(f), 2);
  assert.equal(f.rates.length, 0);
});
Deno.test("apertura automática y cliente antiguo sin body no suman: antes 2, después 2", async () => {
  for (const body of [undefined, { userInitiated: false }, { userInitiated: "true" }]) {
    const f = fixture(); seedHits(f, 2);
    const r = await run("sync", f, { body, access: () => response(401) });
    assert.equal(r.data.softFail, true);
    assert.equal(r.data.authExpired, undefined);
    assert.equal(hits(f), 2);
  }
});
Deno.test("fallo del usuario sí suma y el tercero ofrece reconectar", async () => {
  const f = fixture();
  for (let n = 1; n <= 3; n++) {
    const r = await run("sync", f, { body: { userInitiated: true }, access: () => response(401) });
    assert.equal(hits(f), n);
    assert.equal(r.data.authExpired === true, n === 3);
  }
});

Deno.test("lectura buena tras refrescar pone a cero y el siguiente fallo vuelve a uno", async () => {
  const f = fixture(); seedHits(f, 2);
  const r = await run("sync", f, { access: (n) => n === 0 ? response(401) : accounts() });
  assert.equal(r.data.ok, true);
  assert.equal(hits(f), 0);
  await run("sync", f, { body: { userInitiated: true }, access: () => response(401) });
  assert.equal(hits(f), 1);
});

function reconnect(f: ReturnType<typeof fixture>) {
  Object.assign(f.row, { access_counter_version: "22222222-2222-4222-8222-222222222222", connection_version: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", access_token: "reconnected-access", refresh_token: "reconnected-refresh", status: "active" });
  f.counters.set("mi-401-tras-refresco:synthetic:" + f.row.access_counter_version, 2);
}
Deno.test("reconexión durante lectura buena: el reset antiguo no borra los dos fallos nuevos", async () => {
  const f = fixture(); seedHits(f, 2); f.beforeWrite = () => reconnect(f);
  const r = await run("sync", f);
  assert.equal(r.data.ok, false);
  assert.equal(r.data.code, "refresh_raced");
  assert.equal(hits(f), 2);
  assert.equal(f.row.access_token, "reconnected-access");
  assert.equal(f.row.last_sync, undefined);
});
Deno.test("reconexión durante refresco: ni tokens ni contador ni estado se pisan", async () => {
  const f = fixture(); f.beforeWrite = () => reconnect(f);
  const r = await run("sync", f, { body: { userInitiated: true }, access: () => response(401) });
  assert.equal(r.data.code, "refresh_raced");
  assert.equal(f.row.access_token, "reconnected-access");
  assert.equal(f.row.refresh_token, "reconnected-refresh");
  assert.equal(hits(f), 2);
  assert.equal(f.rates.length, 0);
});
Deno.test("reconexión antes de sumar: el fallo antiguo sólo afecta a su bucket antiguo", async () => {
  const f = fixture(); seedHits(f, 2); f.beforeRate = () => reconnect(f);
  const old = f.row.access_counter_version;
  const r = await run("sync", f, { body: { userInitiated: true }, access: () => response(401) });
  assert.equal(f.counters.get("mi-401-tras-refresco:synthetic:" + old), 3);
  assert.equal(hits(f), 2);
  assert.equal(r.data.authExpired, undefined);
  assert.equal(r.data.code, "refresh_raced");
  assert.equal(f.row.status, "active");
});
Deno.test("reconexión entre sumar y caducar: cero filas no es un acuse", async () => {
  const f = fixture(); seedHits(f, 2);
  f.beforeRate = () => { f.beforeWrite = () => reconnect(f); };
  const r = await run("sync", f, { body: { userInitiated: true }, access: () => response(401) });
  assert.equal(r.data.code, "refresh_raced");
  assert.equal(r.data.authExpired, undefined);
  assert.equal(f.row.status, "active");
  assert.equal(hits(f), 2);
});
Deno.test("sello que falla conserva las posiciones; reconexión que falla tampoco dice conectado", async () => {
  const f = fixture(); seedHits(f, 2); f.saveError = true;
  const r = await run("sync", f, { access: positionAccounts });
  assertPositions(r.data);
  assert.equal(r.data.code, "counter_not_saved");
  assert.equal(hits(f), 2);
  for (const body of [
    { customerId: "synthetic", password: "synthetic", deviceId: "device" },
    { storeTokens: true, deviceId: "device", accessToken: "synthetic" },
  ]) {
    const connect = await run("connect", f, { body });
    assert.equal(connect.status, 503);
    assert.equal(connect.data.connected, undefined);
    assert.equal(hits(f), 2);
  }
});
Deno.test("fallo pasajero no cuenta; limitador caído tampoco caduca", async () => {
  const f = fixture(); seedHits(f, 2);
  const r = await run("sync", f, { body: { userInitiated: true }, access: () => response(401), refresh: () => response(503) });
  assert.equal(r.data.softFail, true);
  assert.equal(hits(f), 2);
  assert.equal(f.rates.length, 0);
  f.rateError = true;
  const unavailable = await run("sync", f, { body: { userInitiated: true }, access: () => response(401) });
  assert.equal(unavailable.data.authExpired, undefined);
  assert.equal(f.row.status, "active");
});
Deno.test("sin migración disponible se avisa sin llamar al banco ni sumar", async () => {
  const f = fixture(); delete f.row.access_counter_version;
  const r = await run("sync", f, { access: () => { throw new Error("no debe llamar"); } });
  assert.equal(r.data.code, "counter_not_available");
  assert.equal(f.rates.length, 0);
});

Deno.test("lectura buena concurrente: el fallo viejo tampoco caduca el contador recién reiniciado", async () => {
  const f = fixture(); seedHits(f, 2);
  f.beforeRate = () => {
    f.row.access_counter_version = "33333333-3333-4333-8333-333333333333";
    // Mismo enlace: sólo cambió el contador por una lectura buena más reciente.
    f.counters.set("mi-401-tras-refresco:synthetic:" + f.row.access_counter_version, 1);
  };
  const r = await run("sync", f, { body: { userInitiated: true }, access: () => response(401) });
  assert.equal(r.data.authExpired, undefined);
  assert.equal(hits(f), 1);
  assert.equal(f.row.status, "active");
});

Deno.test("reset viejo tras otro éxito: conserva posiciones y sello sin borrar los nuevos fallos del mismo enlace", async () => {
  const f = fixture(); seedHits(f, 2);
  f.beforeWrite = () => {
    f.row.access_counter_version = "33333333-3333-4333-8333-333333333333";
    f.counters.set("mi-401-tras-refresco:synthetic:" + f.row.access_counter_version, 1);
  };
  const r = await run("sync", f, { access: positionAccounts });
  assertPositions(r.data);
  assert.equal(r.data.code, undefined);
  assert.equal(hits(f), 1);
  assert.equal(f.row.access_counter_version, "33333333-3333-4333-8333-333333333333");
  assert.equal(typeof f.row.last_sync, "string");
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].access_counter_version, undefined);
});
Deno.test("reconexión entre reset perdido y sello: las posiciones antiguas no se aceptan", async () => {
  const f = fixture();
  f.beforeWrite = () => {
    f.row.access_counter_version = "33333333-3333-4333-8333-333333333333";
    f.beforeWrite = () => reconnect(f);
  };
  const r = await run("sync", f, { access: positionAccounts });
  assert.equal(r.data.ok, false);
  assert.equal(r.data.code, "refresh_raced");
  assert.equal(r.data.positions, undefined);
  assert.equal(f.row.last_sync, undefined);
  assert.equal(f.row.access_token, "reconnected-access");
  assert.equal(hits(f), 2);
});
Deno.test("sello tras carrera devuelve error: conserva posiciones y el contador ganador", async () => {
  const f = fixture();
  f.beforeWrite = () => {
    f.row.access_counter_version = "33333333-3333-4333-8333-333333333333";
    f.counters.set("mi-401-tras-refresco:synthetic:" + f.row.access_counter_version, 1);
    f.beforeWrite = () => { f.saveError = true; };
  };
  const r = await run("sync", f, { access: positionAccounts });
  assertPositions(r.data);
  assert.equal(r.data.code, "counter_not_saved");
  assert.equal(hits(f), 1);
  assert.equal(f.row.last_sync, undefined);
});
Deno.test("sello lanza por red: conserva igualmente todas las posiciones leídas", async () => {
  const f = fixture(); seedHits(f, 2); f.saveThrows = true;
  const r = await run("sync", f, { access: positionAccounts });
  assertPositions(r.data);
  assert.equal(r.data.code, "counter_not_saved");
  assert.equal(hits(f), 2);
  assert.equal(f.row.last_sync, undefined);
});
Deno.test("el recifrado legacy tampoco pisa los tokens de una reconexión", async () => {
  const f = fixture();
  await encryptLegacy(f, () => reconnect(f));
  assert.equal(f.row.access_token, "reconnected-access");
  assert.equal(f.row.refresh_token, "reconnected-refresh");
});
