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
import { miTokensFromRow, miTokensToRow, ensureMiLinkEncrypted } from "../_shared/token_store.ts";
import { withCors } from "../_shared/cors.ts";

Deno.serve(withCors(async (req: Request) => {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const supa = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return jsonResp({ ok: false, error: "sin sesión" }, 401);

    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: link } = await admin.from("myinvestor_links").select("*").eq("user_id", user.id).maybeSingle();
    if (link) await ensureMiLinkEncrypted(admin, user.id, link);
    const tokens = link ? await miTokensFromRow(link) : null;
    if (!link || !tokens?.access || !tokens.deviceId) return jsonResp({ ok: false, error: "no conectado" });

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
    const refresh = async (): Promise<{ outcome: MiRefreshOutcome; status: number }> => {
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
        await admin.from("myinvestor_links").update({
          access_token: enc.access_token,
          refresh_token: enc.refresh_token,
          refresh_expires_at: refreshSecs > 0 ? new Date(Date.now() + refreshSecs * 1000).toISOString() : link.refresh_expires_at,
          status: "active", updated_at: new Date().toISOString(),
        }).eq("user_id", user.id);
      }
      return { outcome, status: r.status };
    };

    // 1) lista de cuentas de valores (con auto-refresh si 401). Solo el refresco RECHAZADO
    // marca `expired`; un fallo pasajero no toca el enlace (ver `miReadWithRefresh`).
    const read = await miReadWithRefresh(() => apiGet("/cperf-server/api/v2/securities-accounts/self-basic"), refresh);
    if (read.kind === "expired") {
      await admin.from("myinvestor_links").update({ status: "expired", updated_at: new Date().toISOString() }).eq("user_id", user.id);
      return jsonResp({ ok: false, authExpired: true, error: "Tu sesión de MyInvestor caducó. Vuelve a conectar." });
    }
    // `softFail` es el contrato que el cliente ya entiende como «reintenta, no pidas contraseña».
    // `code` es una clase cerrada para soporte; nunca el cuerpo de MyInvestor.
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
      if (det.status !== 200) continue;
      // deno-lint-ignore no-explicit-any
      const data = (det.json as any)?.payload?.data;
      for (const p of miPositionsFrom(data)) positions.push(p);
    }

    await admin.from("myinvestor_links").update({ last_sync: new Date().toISOString(), status: "active", updated_at: new Date().toISOString() }).eq("user_id", user.id);
    return jsonResp({ ok: true, positions });
  } catch (e) {
    return jsonResp({ ok: false, error: String((e as Error)?.message || e) }, 500);
  }
}));
