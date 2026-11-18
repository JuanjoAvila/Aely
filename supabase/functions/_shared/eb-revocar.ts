// ============================================================
// Revocar una sesión de Enable Banking (DELETE /sessions/{id}), con tope de tiempo.
//
// Hay tres sitios que dejan de usar un consentimiento PSD2 y lo tienen que cerrar en el proveedor:
// quitar un banco (`bank-disconnect`), borrar la cuenta (`delete-account`, P3-06) y el callback
// tardío que pierde la carrera con una reconexión (`bank-callback`, SEC-02). Si solo se borra la
// fila, el consentimiento sigue vivo en Enable Banking hasta que caduca (hasta 90 días) y nadie lo
// ve. Hasta ahora solo `bank-disconnect` revocaba; los otros dos borraban o abandonaban la sesión.
// `bank-disconnect` conserva su copia (misma regla: 8 s, abort + carrera, clases cerradas) porque
// cuatro guardianes la ejercitan por su texto exacto; unificarla es un cambio aparte con esos tests.
//
// Siempre es «lo mejor posible»: quien llama sigue con lo suyo aunque esto falle. Lo que devuelve
// es una clase CERRADA (estado HTTP + código de la lista de `ebFailure`, o DESCIFRADO/TIEMPO/
// CONFIG): nunca el id de sesión, el JWT ni el texto del proveedor, porque acaba en logs.
// ============================================================

import { ebApi, ebConfig, ebFailure, makeJWT } from "./enablebanking.ts";
import { decryptSessionId } from "./token_store.ts";

export type Revocacion = { ok: true } | { ok: false; step: "config" | "decrypt" | "revoke"; status: number; code: string };

export const REVOCAR_TOPE_MS = 8000;

type Api = (jwt: string, path: string, init: { method?: string; signal?: AbortSignal }) => Promise<unknown>;

/** Revoca una sesión cuyo id ya está en claro. `jwt` se puede reutilizar si quien llama ya lo
 *  tiene (el callback); si no, se firma uno. El abort solo no basta si el transporte no reacciona:
 *  la carrera con el temporizador limita también esa espera. */
export async function revocarSesionEB(
  sessionId: string,
  opts: { jwt?: string | null; api?: Api; topeMs?: number } = {},
): Promise<Revocacion> {
  let jwt = opts.jwt || null;
  if (!jwt) {
    try {
      const { appId, pem } = ebConfig();
      jwt = await makeJWT(appId, pem);
    } catch (_) {
      return { ok: false, step: "config", status: 0, code: "CONFIG" };
    }
  }
  const api: Api = opts.api || ebApi;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      api(jwt, "/sessions/" + encodeURIComponent(sessionId), { method: "DELETE", signal: controller.signal }),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => { reject(new Error("revocation_timeout")); controller.abort(); }, opts.topeMs ?? REVOCAR_TOPE_MS);
      }),
    ]);
    return { ok: true };
  } catch (err) {
    if (String((err as Error)?.message) === "revocation_timeout") return { ok: false, step: "revoke", status: 0, code: "TIEMPO" };
    const f = ebFailure(err);
    return { ok: false, step: "revoke", status: f.status, code: f.code || "SIN_CODIGO" };
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

/** Varias sesiones guardadas a la vez (borrar la cuenta): un solo JWT y en paralelo, así el tope
 *  total es el de una sola revocación y no 8 s por banco. */
export async function revocarSesionesGuardadas(
  stored: (string | null | undefined)[],
  opts: { jwt?: string | null; api?: Api; topeMs?: number } = {},
): Promise<Revocacion[]> {
  let jwt = opts.jwt || null;
  if (!jwt && stored.length) {
    try {
      const { appId, pem } = ebConfig();
      jwt = await makeJWT(appId, pem);
    } catch (_) {
      return stored.map(() => ({ ok: false, step: "config", status: 0, code: "CONFIG" } as Revocacion));
    }
  }
  return Promise.all(stored.map((s) => revocarSesionGuardada(s, { ...opts, jwt })));
}

/** Igual, pero con el `session_id` tal como está en `bank_links` (cifrado o legacy en claro). */
export async function revocarSesionGuardada(
  stored: string | null | undefined,
  opts: { jwt?: string | null; api?: Api; topeMs?: number } = {},
): Promise<Revocacion> {
  let sessionId: string | null;
  try {
    sessionId = await decryptSessionId(stored ?? null);
  } catch (_) {
    return { ok: false, step: "decrypt", status: 0, code: "DESCIFRADO" };
  }
  if (!sessionId) return { ok: false, step: "decrypt", status: 0, code: "DESCIFRADO" };
  return revocarSesionEB(sessionId, opts);
}
