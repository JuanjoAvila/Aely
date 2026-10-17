// ============================================================
// Edge Function: myinvestor-sync  (verify_jwt = true)
// Con la sesión guardada (access/refresh en myinvestor_links), lee las POSICIONES de fondos
// indexados / fondos / bróker del usuario en MyInvestor y las devuelve como JSON.
//
//   GET /cperf-server/api/v2/securities-accounts/self-basic   → lista de cuentas de valores
//   GET /cperf-server/api/v2/securities-accounts/{id}         → detalle con securitiesAccountInvestments
//
// Si el access token está caducado (401), renueva con el refresh (201, misma forma). Si el
// refresh es RECHAZADO (400/401) → marca el enlace 'expired' y pide reconectar; si solo falla
// de paso (403/429/5xx/red) el enlace se queda como está. NO escribe posiciones
// en la nube: las devuelve para que la app re-ancle con previsualización (como Trade Republic).
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResp, MI_BASE, miHeaders, miPositionsFrom, miReadWithRefresh, miRefreshOutcome, type MiRefreshOutcome } from "../_shared/myinvestor.ts";
import { miTokensFromRow, miTokensToRow, isEncrypted } from "../_shared/token_store.ts";
import { miSaveRefresh } from "../_shared/myinvestor-refresh-save.ts";
import { withCors } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/ratelimit.ts";

Deno.serve(withCors(async (req: Request) => {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const supa = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return jsonResp({ ok: false, error: "sin sesión" }, 401);

    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let { data: link } = await admin.from("myinvestor_links").select("*").eq("user_id", user.id).maybeSingle();
    // El recifrado legacy también escribe tokens. Guardarlo con el mismo CAS y
    // releer evita comparar el plaintext anterior con el ciphertext recién creado.
    if (link?.connection_version && link.access_token && Deno.env.get("TOKEN_ENCRYPTION_KEY")
      && (!isEncrypted(link.access_token) || (link.refresh_token && !isEncrypted(link.refresh_token)))) {
      const plain = await miTokensFromRow(link);
      const enc = await miTokensToRow(plain.access!, plain.refresh);
      const saved = await miSaveRefresh(admin, link, enc, true);
      if (saved !== "saved") return jsonResp({ ok: false, softFail: true, code: saved === "raced" ? "refresh_raced" : "refresh_not_saved", error: "MyInvestor no responde bien ahora. Prueba más tarde — tu sesión sigue guardada." });
      const { data: now, error } = await admin.from("myinvestor_links").select("*").eq("user_id", user.id).maybeSingle();
      if (error || !now) return jsonResp({ ok: false, softFail: true, code: "refresh_not_saved", error: "MyInvestor no responde bien ahora. Prueba más tarde — tu sesión sigue guardada." });
      if (now.connection_version !== link.connection_version) return jsonResp({ ok: false, softFail: true, code: "refresh_raced", error: "MyInvestor no responde bien ahora. Prueba más tarde — tu sesión sigue guardada." });
      link = now;
    }
    const tokens = link ? await miTokensFromRow(link) : null;
    if (!link || !tokens?.access || !tokens.deviceId) return jsonResp({ ok: false, error: "no conectado" });

    const body = await req.json().catch(() => ({}));
    // Sin señal expresa (también clientes antiguos) la apertura no es un intento manual.
    const userInitiated = body?.userInitiated === true;
    const counterVersion = link.access_counter_version;
    const connectionVersion = link.connection_version;
    if (!counterVersion || !connectionVersion) return jsonResp({ ok: false, softFail: true, code: "counter_not_available", error: "MyInvestor no responde bien ahora. Prueba más tarde — tu sesión sigue guardada." });

    const deviceId = tokens.deviceId;
    let token = tokens.access;
    let refreshPlain = tokens.refresh;

    // Petición autenticada con reintento tras refrescar el token (401).
    const apiGet = async (path: string): Promise<{ status: number; json: unknown }> => {
      const r = await fetch(MI_BASE + path, { headers: miHeaders(deviceId, token) });
      const t = await r.text();
      let j: unknown = null; try { j = JSON.parse(t); } catch { /* deja null */ }
      return { status: r.status, json: j };
    };
    const refresh = async (): Promise<{ outcome: MiRefreshOutcome; status: number; code?: string }> => {
      // Sin token de refresco no hay con qué renovar: solo queda identificarse otra vez.
      if (!refreshPlain) return { outcome: "rejected", status: 0 };
      let r: Response, t: string;
      try {
        r = await fetch(MI_BASE + "/login/api/v1/auth/token/refresh", {
          method: "POST", headers: miHeaders(deviceId),
          body: JSON.stringify({ refreshToken: refreshPlain }),
        });
        t = await r.text();
      } catch { return { outcome: "temporary", status: 0 }; }
      // deno-lint-ignore no-explicit-any
      let j: any = null; try { j = JSON.parse(t); } catch { /* */ }
      const d = (j && j.payload && j.payload.data) || {};
      const outcome = miRefreshOutcome(r.status, d);
      if (outcome === "ok") {
        token = d.accessToken;
        refreshPlain = d.refreshToken || refreshPlain;
        const refreshSecs = Number(d.refreshExpiresIn || 0);
        const enc = await miTokensToRow(d.accessToken, refreshPlain);
        /* LA ESCRITURA PUEDE FALLAR Y HAY QUE MIRARLO (revisión del 13/10): supabase-js no
           lanza, entrega `error`. Si MyInvestor rota el refresco, el que queda en la fila ya
           está gastado; responder `ok` dejaba el enlace muerto para la sincronización
           siguiente sin que nadie lo supiera. Se reintenta una vez y, si tampoco entra, la
           lectura no se da por buena: el usuario ve «prueba más tarde», no datos al día. */
        const saved = await miSaveRefresh(admin, link, {
          access_token: enc.access_token,
          refresh_token: enc.refresh_token,
          refresh_expires_at: refreshSecs > 0 ? new Date(Date.now() + refreshSecs * 1000).toISOString() : link.refresh_expires_at,
          status: "active", updated_at: new Date().toISOString(),
        }, !d.refreshToken || d.refreshToken === tokens.refresh);
        if (saved !== "saved") return { outcome: "temporary", status: r.status, code: saved === "raced" ? "refresh_raced" : "refresh_not_saved" };
        // La caducidad de un acceso todavía rechazado debe comparar nuestra rotación,
        // no el refresco ya consumido con el que empezó esta petición.
        link = { ...link, ...enc };
      }
      return { outcome, status: r.status };
    };

    // 1) lista de cuentas de valores (con auto-refresh si 401). Solo el refresco RECHAZADO
    // marca `expired`; un fallo pasajero no toca el enlace (ver `miReadWithRefresh`).
    const read = await miReadWithRefresh(() => apiGet("/cperf-server/api/v2/securities-accounts/self-basic"), refresh);
    /* REFRESCO ACEPTADO Y EL ACCESO SIGUE EN 401 (revisión del 13/10). Una vez es un hipo;
       si se repite no tiene salida sola: cada pulsación gasta un refresco y la respuesta era
       siempre «prueba más tarde». A la TERCERA vez en seis horas se da el enlace por caducado
       para que la app ofrezca reconectar. El contador es el limitador que ya usa
       `myinvestor-connect` (tabla `rate_limits`, migración 0019). La versión del bucket cambia
       al reconectar y al leer bien: el contador activo queda a cero sin borrar el de otra
       petición. Un fallo viejo sólo suma a su bucket viejo; no puede caducar una reconexión.
       Si el limitador no responde deja pasar, o sea que NO caduca. */
    const stuck = userInitiated && read.kind === "temporary" && read.code === "access_401_after_refresh"
      && !(await rateLimit(admin, "mi-401-tras-refresco:" + user.id + ":" + counterVersion, 2, 6 * 3600)).ok;
    /* El refresco rechazado solo es caducidad si la fila sigue teniendo el token que se usó.
       El keepalive corre cada 10 minutos con ese mismo token: si lo rotó mientras tanto, el
       rechazo es del token viejo y el enlace está vivo. Se descifra la fila actual para
       comparar la credencial, no ciphertexts que podrían tener IV distintos. El UPDATE
       posterior conserva además la guarda atómica de conexión, contador y snapshot. */
    if (read.kind === "expired") {
      const { data: now } = await admin.from("myinvestor_links").select("*").eq("user_id", user.id).maybeSingle();
      const current = now ? await miTokensFromRow(now) : null;
      if (current && current.refresh !== tokens.refresh) {
        return jsonResp({ ok: false, softFail: true, code: "refresh_raced", error: "MyInvestor no responde bien ahora. Prueba más tarde — tu sesión sigue guardada." });
      }
    }
    if (read.kind === "expired" || stuck) {
      const expiry = admin.from("myinvestor_links").update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("user_id", user.id).eq("connection_version", connectionVersion).eq("access_counter_version", counterVersion);
      if (link.refresh_token == null) expiry.is("refresh_token", null);
      else expiry.eq("refresh_token", link.refresh_token);
      const { data, error } = await expiry.select("user_id").maybeSingle();
      if (error || !data) return jsonResp({ ok: false, softFail: true, code: error ? "expiry_not_saved" : "refresh_raced", error: "MyInvestor no responde bien ahora. Prueba más tarde — tu sesión sigue guardada." });
      return jsonResp({ ok: false, authExpired: true, error: "Tu sesión de MyInvestor caducó. Vuelve a conectar." });
    }
    // `softFail` es el contrato que el cliente ya entiende como «reintenta, no pidas contraseña».
    // `code` es una clase cerrada para soporte; nunca el cuerpo de MyInvestor.
    if (read.kind === "temporary" && read.code === "access_401_after_refresh") {
      return jsonResp({ ok: false, softFail: true, code: read.code, error: "MyInvestor ha renovado la sesión pero no deja leer tus posiciones. Prueba más tarde; si se repite, la app te pedirá volver a conectar." });
    }
    if (read.kind === "temporary") {
      return jsonResp({ ok: false, softFail: true, code: read.code, error: "MyInvestor no responde bien ahora. Prueba más tarde — tu sesión sigue guardada." });
    }
    // 403 = a menudo anti-bot/rate-limit, NO sesión muerta → no marcamos expired (captcha loop).
    if (read.kind === "http" && read.status === 403) {
      return jsonResp({ ok: false, softFail: true, error: "MyInvestor no deja pasar ahora (anti-bot). Prueba más tarde — tu sesión sigue guardada." });
    }
    if (read.kind === "http") return jsonResp({ ok: false, error: "MyInvestor HTTP " + read.status });
    const acc = read.res;

    // deno-lint-ignore no-explicit-any
    const list: any[] = ((acc.json as any)?.payload?.data) || [];
    const positions: unknown[] = [];
    for (const sa of list) {
      const accountId = sa?.accountId;
      if (!accountId) continue;
      const det = await apiGet("/cperf-server/api/v2/securities-accounts/" + encodeURIComponent(String(accountId)));
      // Un 401 aquí es el acceso caducando a media lectura, no una cuenta sin posiciones:
      // devolver lo leído hasta ahora como si fuera todo sería una cartera incompleta dada
      // por buena. La pulsación siguiente refresca en el primer paso.
      if (det.status === 401) {
        return jsonResp({ ok: false, softFail: true, code: "detail_401", error: "MyInvestor no responde bien ahora. Prueba más tarde — tu sesión sigue guardada." });
      }
      if (det.status !== 200) continue;
      // deno-lint-ignore no-explicit-any
      const data = (det.json as any)?.payload?.data;
      for (const p of miPositionsFrom(data)) positions.push(p);
    }

    // El reset exige ambas versiones para no borrar fallos posteriores de otra lectura.
    // Si sólo perdió el contador, aún podemos sellar la lectura del MISMO enlace: cero
    // filas con la guarda de conexión sí indica reconexión, sin un SELECT previo vulnerable.
    let saved: { user_id: string } | null = null, saveError = false;
    try {
      const result = await admin.from("myinvestor_links").update({
        last_sync: new Date().toISOString(), status: "active", updated_at: new Date().toISOString(),
        access_counter_version: crypto.randomUUID(),
      }).eq("user_id", user.id).eq("connection_version", connectionVersion).eq("access_counter_version", counterVersion).select("user_id").maybeSingle();
      saved = result.data; saveError = !!result.error;
      if (!saveError && !saved) {
        const stamp = await admin.from("myinvestor_links").update({
          last_sync: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq("user_id", user.id).eq("connection_version", connectionVersion).select("user_id").maybeSingle();
        saved = stamp.data; saveError = !!stamp.error;
        if (!saveError && !saved) return jsonResp({ ok: false, softFail: true, code: "refresh_raced", error: "MyInvestor no responde bien ahora. Prueba más tarde — tu sesión sigue guardada." });
      }
    } catch (_) { saveError = true; }
    // El sello es metadato: un fallo de BD/red no debe tirar posiciones ya leídas bien.
    // Tampoco afirmamos haber reiniciado el contador cuando falta ese acuse.
    return jsonResp({ ok: true, positions, ...(saveError ? { code: "counter_not_saved" } : {}) });
  } catch (e) {
    return jsonResp({ ok: false, error: String((e as Error)?.message || e) }, 500);
  }
}));
