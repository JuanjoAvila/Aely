import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { miReadWithRefresh, miRefreshOutcome, type MiRefreshOutcome } from "./myinvestor.ts";

/* Queja del 12/10: «tengo que volver a identificarme casi cada día». Tras un 401 del acceso,
   el sync daba por caducada la sesión con CUALQUIER refresco fallido, también con un bloqueo
   pasajero. Aquí se fija qué desenlace obliga a meter la contraseña y cuáles no.
   Los cuerpos son sintéticos: no consta en el repo ninguna respuesta real de rechazo. */

type Resp = { status: number; json: unknown };
const cuentas: Resp = { status: 200, json: { payload: { data: [] } } };
const caducado: Resp = { status: 401, json: null };

// Acceso caducado y, tras refrescar, lo que diga `despues`. Cuenta las llamadas a cada lado.
function escenario(refresco: { outcome: MiRefreshOutcome; status: number }, despues = cuentas) {
  const n = { get: 0, refresh: 0 };
  const run = miReadWithRefresh(
    () => Promise.resolve(n.get++ === 0 ? caducado : despues),
    () => { n.refresh++; return Promise.resolve(refresco); },
  );
  return { n, run };
}

Deno.test("refresco: solo 400/401 es rechazo; lo demás es pasajero", () => {
  assertEquals(miRefreshOutcome(200, { accessToken: "a" }), "ok");
  assertEquals(miRefreshOutcome(201, { accessToken: "a" }), "ok");
  assertEquals(miRefreshOutcome(400, {}), "rejected");
  assertEquals(miRefreshOutcome(401, {}), "rejected");
  for (const status of [403, 408, 429, 500, 502, 503]) assertEquals(miRefreshOutcome(status, {}), "temporary", "HTTP " + status);
  // Respuesta incompleta: 200 sin token no renueva nada, pero tampoco dice que la sesión muriera.
  assertEquals(miRefreshOutcome(200, {}), "temporary");
  assertEquals(miRefreshOutcome(201, null), "temporary");
});

Deno.test("acceso vivo: no se refresca", async () => {
  let refrescos = 0;
  const r = await miReadWithRefresh(() => Promise.resolve(cuentas), () => { refrescos++; return Promise.resolve({ outcome: "ok" as const, status: 201 }); });
  assertEquals(r, { kind: "ok", res: cuentas });
  assertEquals(refrescos, 0);
});

Deno.test("acceso caducado y refresco aceptado: se reintenta la lectura con el token nuevo", async () => {
  const { n, run } = escenario({ outcome: "ok", status: 201 });
  assertEquals(await run, { kind: "ok", res: cuentas });
  assertEquals(n, { get: 2, refresh: 1 });
});

Deno.test("acceso caducado y refresco RECHAZADO: caducidad real", async () => {
  for (const status of [400, 401]) {
    const { n, run } = escenario({ outcome: miRefreshOutcome(status, {}), status });
    assertEquals(await run, { kind: "expired" }, "HTTP " + status);
    assertEquals(n, { get: 1, refresh: 1 }, "no se insiste contra MyInvestor");
  }
});

Deno.test("sin token de refresco no hay con qué renovar: caducidad real", async () => {
  const { run } = escenario({ outcome: "rejected", status: 0 });
  assertEquals(await run, { kind: "expired" });
});

Deno.test("acceso caducado y refresco con fallo pasajero: NO caduca y no se insiste", async () => {
  for (const status of [403, 429, 500, 503]) {
    const { n, run } = escenario({ outcome: miRefreshOutcome(status, {}), status });
    assertEquals(await run, { kind: "temporary", code: "refresh_" + status }, "HTTP " + status);
    assertEquals(n, { get: 1, refresh: 1 });
  }
  const sinToken = escenario({ outcome: miRefreshOutcome(200, {}), status: 200 });
  assertEquals(await sinToken.run, { kind: "temporary", code: "refresh_200" });
  const red = escenario({ outcome: "temporary", status: 0 });
  assertEquals(await red.run, { kind: "temporary", code: "refresh_network" });
});

Deno.test("401 que persiste tras un refresco aceptado: la sesión está viva, no se pide contraseña", async () => {
  const { n, run } = escenario({ outcome: "ok", status: 201 }, caducado);
  assertEquals(await run, { kind: "temporary", code: "access_401_after_refresh" });
  assertEquals(n, { get: 2, refresh: 1 }, "un solo refresco por sincronización");
});

Deno.test("la red caída al leer no es una caducidad", async () => {
  const r = await miReadWithRefresh<{ status: number }>(() => Promise.reject(new Error("red")), () => Promise.resolve({ outcome: "rejected" as const, status: 401 }));
  assertEquals(r, { kind: "temporary", code: "access_network" });
});

Deno.test("otros estados del acceso se devuelven tal cual a quien llama", async () => {
  for (const status of [403, 429, 503]) {
    const r = await miReadWithRefresh(() => Promise.resolve({ status, json: null }), () => Promise.resolve({ outcome: "rejected" as const, status: 401 }));
    assertEquals(r, { kind: "http", status });
  }
});
