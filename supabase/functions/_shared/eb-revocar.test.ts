import assert from "node:assert/strict";
import { revocarSesionEB, revocarSesionesGuardadas, revocarSesionGuardada } from "./eb-revocar.ts";

// Sin red ni secretos: el proveedor es un doble que apunta lo que le piden. El entorno se sustituye
// por una tabla (como en bank-disconnect/lifecycle.test.ts) para no pedir permisos de env.
const SECRETO = "ses/ión?#secreta";
type Llamada = { jwt: string; path: string; method?: string };

function conEntorno<T>(tabla: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const original = Deno.env.get;
  Deno.env.get = (k: string) => tabla[k];
  return fn().finally(() => { Deno.env.get = original; });
}

Deno.test("revoca con DELETE y el id codificado, reutilizando el JWT", async () => {
  const llamadas: Llamada[] = [];
  const r = await revocarSesionEB(SECRETO, { jwt: "jwt-sintetico", api: async (jwt, path, init) => { llamadas.push({ jwt, path, method: init.method }); return {}; } });
  assert.deepEqual(r, { ok: true });
  assert.deepEqual(llamadas, [{ jwt: "jwt-sintetico", path: "/sessions/" + encodeURIComponent(SECRETO), method: "DELETE" }]);
});

Deno.test("proveedor colgado: corta al tope y no espera su respuesta", async () => {
  const t0 = Date.now();
  const r = await revocarSesionEB("s", { jwt: "j", topeMs: 30, api: () => new Promise(() => {}) });
  assert.deepEqual(r, { ok: false, step: "revoke", status: 0, code: "TIEMPO" });
  assert.ok(Date.now() - t0 < 2000);
});

Deno.test("fallo del proveedor: solo estado y código de la lista cerrada, nunca su texto ni el id", async () => {
  const conocido = await revocarSesionEB(SECRETO, { jwt: "j", api: async () => { throw new Error("EB 503 ASPSP_ERROR"); } });
  assert.deepEqual(conocido, { ok: false, step: "revoke", status: 503, code: "ASPSP_ERROR" });
  const raro = await revocarSesionEB(SECRETO, { jwt: "j", api: async () => { throw new Error("EB 400 ALGO_" + SECRETO); } });
  assert.deepEqual(raro, { ok: false, step: "revoke", status: 400, code: "OTRO" });
  const red = await revocarSesionEB(SECRETO, { jwt: "j", api: async () => { throw new Error("connection reset " + SECRETO); } });
  assert.deepEqual(red, { ok: false, step: "revoke", status: 0, code: "SIN_CODIGO" });
  assert.ok(!JSON.stringify([conocido, raro, red]).includes("secreta"));
});

Deno.test("sin secretos de Enable Banking: CONFIG y ninguna llamada", async () => {
  let llamadas = 0;
  const r = await conEntorno({}, () => revocarSesionEB("s", { api: async () => { llamadas++; return {}; } }));
  assert.deepEqual(r, { ok: false, step: "config", status: 0, code: "CONFIG" });
  const varias = await conEntorno({}, () => revocarSesionesGuardadas(["a", "b"], { api: async () => { llamadas++; return {}; } }));
  assert.deepEqual(varias.map((x) => x.ok ? "ok" : x.code), ["CONFIG", "CONFIG"]);
  assert.equal(llamadas, 0);
});

Deno.test("guardada: descifra legacy en claro; cifrada sin clave es DESCIFRADO, sin llamar al proveedor", async () => {
  const paths: string[] = [];
  const api = async (_j: string, path: string) => { paths.push(path); return {}; };
  assert.deepEqual(await conEntorno({}, () => revocarSesionGuardada("legacy-id", { jwt: "j", api })), { ok: true });
  assert.deepEqual(await conEntorno({}, () => revocarSesionGuardada("enc:v1:AAAA", { jwt: "j", api })),
    { ok: false, step: "decrypt", status: 0, code: "DESCIFRADO" });
  assert.deepEqual(await revocarSesionGuardada(null, { jwt: "j", api }), { ok: false, step: "decrypt", status: 0, code: "DESCIFRADO" });
  assert.deepEqual(paths, ["/sessions/legacy-id"]);
});

Deno.test("varias: en paralelo (el tope total es el de una) y un fallo no para a las demás", async () => {
  const t0 = Date.now();
  const r = await conEntorno({}, () => revocarSesionesGuardadas(["a", "colgada", "b"], {
    jwt: "j", topeMs: 200,
    api: (_j, path) => path.endsWith("colgada") ? new Promise(() => {}) : new Promise((ok) => setTimeout(() => ok({}), 100)),
  }));
  assert.deepEqual(r.map((x) => x.ok ? "ok" : x.code), ["ok", "TIEMPO", "ok"]);
  assert.ok(Date.now() - t0 < 1000, "secuencial habría tardado más del tope de una");
});
