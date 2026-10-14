import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ebApi, ebFailure, ebSessionVerdict, mapTransaction } from "./enablebanking.ts";

/* Convención del cliente: amount POSITIVO = gasto, NEGATIVO = ingreso.
   Fija por escrito en tests/ob-ingresos.test.mjs — aquí se fija el otro extremo: cómo se
   construye ese signo a partir de lo que manda el ASPSP (2026-07-31, incidente TR real). */

Deno.test("mapTransaction: ASPSP conforme (magnitud sin signo) — cargo queda positivo", () => {
  const tx = mapTransaction({
    transaction_amount: { amount: "45.30" },
    credit_debit_indicator: "DBIT",
    booking_date: "2026-07-30",
  });
  assertEquals(tx.amount, 45.3);
});

Deno.test("mapTransaction: ASPSP conforme — abono queda negativo", () => {
  const tx = mapTransaction({
    transaction_amount: { amount: "1250" },
    credit_debit_indicator: "CRDT",
    booking_date: "2026-07-30",
  });
  assertEquals(tx.amount, -1250);
});

Deno.test("mapTransaction: ASPSP que manda el importe YA firmado — el cargo NO se dobla a ingreso", () => {
  // El fallo real: un ASPSP nuevo (conectado 2026-07-31) mandaba el importe con signo propio
  // (negativo en un cargo) en vez de la magnitud sin signo que pide la spec. Sin abs(), aplicar
  // el signo del indicador sobre un amt ya negativo doblaba el signo: el gasto salía negativo y,
  // por convención, se contaba como ingreso. Todos los gastos del mes se apuntaron como ingresos.
  const tx = mapTransaction({
    transaction_amount: { amount: "-45.30" },
    credit_debit_indicator: "DBIT",
    booking_date: "2026-07-31",
  });
  assertEquals(tx.amount, 45.3, "un cargo tiene que quedar positivo pase lo que pase con el signo de origen");
});

Deno.test("mapTransaction: ASPSP no conforme — abono con importe ya firmado sigue negativo", () => {
  const tx = mapTransaction({
    transaction_amount: { amount: "-900" },
    credit_debit_indicator: "CRDT",
    booking_date: "2026-07-31",
  });
  assertEquals(tx.amount, -900);
});

Deno.test("ebApi: el error conserva estado/código pero no el payload del proveedor", async () => {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = () => Promise.resolve(new Response(JSON.stringify({
    code: 422,
    error: "WRONG_TRANSACTIONS_PERIOD",
    message: "No se permite este periodo",
    detail: { reason: "dato privado que no debe salir" },
    session: { id: "secreto-sesion", accounts: [{ iban: "ES0000000000000000000000" }] },
  }), { status: 422 }));
  try {
    const err = await assertRejects(() => ebApi("jwt", "/transactions"), Error);
    assertEquals(err.message, "EB 422 WRONG_TRANSACTIONS_PERIOD");
  } finally {
    globalThis.fetch = oldFetch;
  }
});

Deno.test("ebApi: una respuesta de texto no sale en la excepción", async () => {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = () => Promise.resolve(new Response("token=secreto&iban=ES000", { status: 503 }));
  try {
    const err = await assertRejects(() => ebApi("jwt", "/sessions"), Error);
    assertEquals(err.message, "EB 503");
  } finally {
    globalThis.fetch = oldFetch;
  }
});

/* Queja del 12/10: reautorizar el banco casi a diario. bank-sync caducaba el enlace con
   cualquier 401, y Enable Banking responde 401 también a errores de la aplicación. Cada caso
   pasa por `ebApi` con el cuerpo que documenta su referencia (`code` numérico + `error`), para
   que el clasificador se pruebe contra el mensaje que de verdad recibe. */
async function fallo(status: number, body: unknown) {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = () => Promise.resolve(new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));
  try {
    return ebFailure(await assertRejects(() => ebApi("jwt", "/accounts/x/balances"), Error));
  } finally {
    globalThis.fetch = oldFetch;
  }
}

Deno.test("ebFailure: solo los códigos de sesión terminada piden autorizar otra vez", async () => {
  for (const code of ["EXPIRED_SESSION", "CLOSED_SESSION", "REVOKED_SESSION"]) {
    assertEquals(await fallo(401, { code: 401, error: code, message: "x" }), { status: 401, code, sessionEnded: true });
  }
});

Deno.test("ebFailure: un 401 de la aplicación no es la sesión del usuario", async () => {
  for (const code of ["AUTHORIZATION_NOT_PROVIDED", "UNAUTHORIZED_ACCESS"]) {
    assertEquals(await fallo(401, { code: 401, error: code, message: "x" }), { status: 401, code, sessionEnded: false });
  }
  // Sin código no se puede afirmar que la sesión terminó.
  assertEquals(await fallo(401, { code: 401, message: "Unauthorized" }), { status: 401, code: "", sessionEnded: false });
  assertEquals(await fallo(401, "Unauthorized"), { status: 401, code: "", sessionEnded: false });
});

Deno.test("ebFailure: bloqueos y caídas conservan su estado y nunca caducan", async () => {
  assertEquals(await fallo(429, { code: 429, error: "ASPSP_RATE_LIMIT_EXCEEDED" }), { status: 429, code: "ASPSP_RATE_LIMIT_EXCEEDED", sessionEnded: false });
  assertEquals(await fallo(503, "caído"), { status: 503, code: "", sessionEnded: false });
  assertEquals(ebFailure(new Error("transactions_timeout")), { status: 0, code: "", sessionEnded: false });
});

Deno.test("ebFailure: el código que sale al diagnóstico es de la lista cerrada del proveedor", async () => {
  // `error` es un campo libre de la respuesta: lo que no esté en su enum se apunta como OTRO.
  for (const libre of ["titular-privado", "ES0000000000000000000000", "JUAN_PEREZ_GARCIA", "SESSION_ABCDEF", "A_".repeat(40) + "B"]) {
    assertEquals(await fallo(401, { code: 401, error: libre }), { status: 401, code: "OTRO", sessionEnded: false }, libre);
  }
  assertEquals(ebFailure(new Error("EB 401: unauthorized")).code, "");
});

Deno.test("ebFailure: el código no distingue mayúsculas", async () => {
  assertEquals(await fallo(401, { code: 401, error: "expired_session" }), { status: 401, code: "EXPIRED_SESSION", sessionEnded: true });
  assertEquals(await fallo(401, { code: 401, error: "Unauthorized_Access" }), { status: 401, code: "UNAUTHORIZED_ACCESS", sessionEnded: false });
});

Deno.test("ebFailure: decide el código, no el HTTP que lo acompaña", async () => {
  for (const status of [400, 403, 404, 422]) {
    assertEquals(await fallo(status, { code: status, error: "EXPIRED_SESSION" }), { status, code: "EXPIRED_SESSION", sessionEnded: true });
  }
});

/* Revisión del 13/10: un 401 sin código de cierre dejaba el banco activo para siempre. Se le
   pregunta al proveedor por la sesión; aquí se fija qué respuesta caduca, cuál no y cuál no
   es una respuesta. Los estados son los ocho de `SessionStatus` de su referencia. */
const sesion = (r: unknown) => (_jwt: string, path: string) => {
  assertEquals(path, "/sessions/sid%2F1", "el id va escapado en la ruta");
  return r instanceof Error ? Promise.reject(r) : Promise.resolve(r);
};

Deno.test("ebSessionVerdict: solo AUTHORIZED es una sesión que sirve", async () => {
  assertEquals(await ebSessionVerdict("jwt", "sid/1", sesion({ status: "AUTHORIZED" })), { ended: false, state: "AUTHORIZED" });
  for (const status of ["CANCELLED", "CLOSED", "EXPIRED", "INVALID", "PENDING_AUTHORIZATION", "RETURNED_FROM_BANK", "REVOKED"]) {
    assertEquals(await ebSessionVerdict("jwt", "sid/1", sesion({ status })), { ended: true, state: status });
  }
  assertEquals(await ebSessionVerdict("jwt", "sid/1", sesion({ status: "expired" })), { ended: true, state: "EXPIRED" });
});

Deno.test("ebSessionVerdict: la consulta rechazada por sesión terminada o inexistente caduca", async () => {
  for (const [msg, code] of [["EB 404 SESSION_DOES_NOT_EXIST", "SESSION_DOES_NOT_EXIST"], ["EB 401 EXPIRED_SESSION", "EXPIRED_SESSION"], ["EB 401 REVOKED_SESSION", "REVOKED_SESSION"]]) {
    assertEquals(await ebSessionVerdict("jwt", "sid/1", sesion(new Error(msg))), { ended: true, state: code });
  }
});

Deno.test("ebSessionVerdict: sin respuesta clara no se afirma nada", async () => {
  assertEquals(await ebSessionVerdict("jwt", null), { ended: null, state: "SIN_ID" });
  assertEquals(await ebSessionVerdict("jwt", "", sesion({ status: "EXPIRED" })), { ended: null, state: "SIN_ID" });
  assertEquals(await ebSessionVerdict("jwt", "sid/1", sesion({ status: "EXPIRED" }), 0), { ended: null, state: "SIN_RESPUESTA" });
  assertEquals(await ebSessionVerdict("jwt", "sid/1", sesion(new Error("EB 503"))), { ended: null, state: "EB_503" });
  assertEquals(await ebSessionVerdict("jwt", "sid/1", sesion(new Error("EB 401 UNAUTHORIZED_ACCESS"))), { ended: null, state: "EB_401" });
  assertEquals(await ebSessionVerdict("jwt", "sid/1", sesion(new TypeError("sin red"))), { ended: null, state: "SIN_RESPUESTA" });
  assertEquals(await ebSessionVerdict("jwt", "sid/1", sesion({})), { ended: null, state: "SIN_ESTADO" });
  // Un estado que no consta en la referencia no caduca ni sale tal cual al diagnóstico.
  assertEquals(await ebSessionVerdict("jwt", "sid/1", sesion({ status: "ES0000000000000000000000" })), { ended: null, state: "OTRO" });
});
