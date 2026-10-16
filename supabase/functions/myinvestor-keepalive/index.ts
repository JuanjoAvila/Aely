// ============================================================
// Edge Function: myinvestor-keepalive  (verify_jwt = false — la llama pg_cron, no un usuario)
//
// Refresca el token de sesión de TODOS los enlaces de MyInvestor activos para que la
// sesión no caduque entre usos (feedback 2026-07-13: «caduca la sesión»). Sin esto, el
// refresh solo ocurría al sincronizar y el refresh token moría solo.
//
// Protección: cabecera x-cron-key == public.cron_secrets['myinvestor-keepalive'].
// El secreto se genera en la BD (migración 0011), nunca pisa el repo (que es público);
// solo service role puede leerlo, así que solo el cron de la BD conoce la clave.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CORS, jsonResp, MI_BASE, miHeaders, miRefreshOutcome } from "../_shared/myinvestor.ts";
import { miTokensFromRow, miTokensToRow } from "../_shared/token_store.ts";
import { timingSafeEqual } from "../_shared/entrada.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const key = req.headers.get("x-cron-key") || "";
    const { data: sec } = await admin.from("cron_secrets").select("secret").eq("name", "myinvestor-keepalive").maybeSingle();
    // Tiempo constante (SEC-01, 14/9): `!==` cortaba en el primer byte distinto.
    if (!sec || !key || !timingSafeEqual(key, String(sec.secret))) return jsonResp({ ok: false, error: "clave incorrecta" }, 401);

    const { data: links } = await admin.from("myinvestor_links").select("*").eq("status", "active");
    let refreshed = 0, expired = 0, skipped = 0;
    for (const link of links || []) {
      let http: number | null = null, hasRefreshExpiresIn = false, guarded = false;
      let eventOutcome: "ok" | "rejected" | "skipped" = "skipped";
      try {
        const tokens = await miTokensFromRow(link);
        if (!tokens.refresh || !tokens.deviceId) { skipped++; continue; }
        const r = await fetch(MI_BASE + "/login/api/v1/auth/token/refresh", {
          method: "POST",
          headers: miHeaders(tokens.deviceId),
          body: JSON.stringify({ refreshToken: tokens.refresh }),
        });
        http = r.status;
        const t = await r.text();
        // deno-lint-ignore no-explicit-any
        let j: any = null; try { j = JSON.parse(t); } catch { /* deja null */ }
        const d = (j && j.payload && j.payload.data) || {};
        hasRefreshExpiresIn = Object.prototype.hasOwnProperty.call(d, "refreshExpiresIn");
        // La misma regla que usa el sync al refrescar: ver `miRefreshOutcome`.
        const outcome = miRefreshOutcome(r.status, d);
        if (outcome === "ok") {
          const refreshSecs = Number(d.refreshExpiresIn || 0);
          const enc = await miTokensToRow(d.accessToken, d.refreshToken || tokens.refresh);
          // Una reconexión puede completar mientras esperamos al banco: el éxito viejo
          // tampoco debe sobrescribir los tokens ni la expiración de la sesión nueva.
          const { data: saved, error } = await admin.from("myinvestor_links").update({
            access_token: enc.access_token,
            refresh_token: enc.refresh_token,
            refresh_expires_at: refreshSecs > 0 ? new Date(Date.now() + refreshSecs * 1000).toISOString() : link.refresh_expires_at,
            status: "active", updated_at: new Date().toISOString(),
          }).eq("user_id", link.user_id).eq("refresh_token", link.refresh_token).select("user_id");
          if (error) { skipped++; }
          else if (!saved?.length) { guarded = true; skipped++; }
          else { eventOutcome = "ok"; refreshed++; }
        } else if (outcome === "rejected") {
          // Solo 400/401 = refresh muerto de verdad. Un 403 (bot/rate-limit) NO caduca el enlace:
          // antes pedía captcha/OTP al abrir la app (feedback 2026-07-17).
          // Solo si la fila sigue teniendo el refresco que se acaba de usar: una sincronización
          // puede haberlo rotado entretanto, y entonces el rechazo es del token viejo y el
          // enlace está vivo. Sin la condición, este `expired` pisaba los tokens recién
          // guardados y pedía la contraseña por una carrera (revisión del 13/10).
          const { data: saved, error } = await admin.from("myinvestor_links").update({ status: "expired", updated_at: new Date().toISOString() })
            .eq("user_id", link.user_id).eq("refresh_token", link.refresh_token).select("user_id");
          if (error) { skipped++; }
          else if (!saved?.length) { guarded = true; skipped++; }
          else { eventOutcome = "rejected"; expired++; }
        } else {
          skipped++;   // 403/5xx/raro: no tocamos nada y se reintenta al próximo tick
        }
      } catch { skipped++; /* red/cifrado: reintenta al próximo tick */ }
      finally {
        // Solo user_id estructural (FK obligatoria). Nunca copiar tokens, dispositivo,
        // datos del enlace ni texto libre del banco, del cifrado o de PostgREST.
        try {
          const detail = JSON.stringify({ outcome: eventOutcome, http, hasRefreshExpiresIn, guarded });
          let log = true;
          if (http === 403 && eventOutcome === "skipped") {
            // El cron corre cada diez minutos: no llenar Actividad con el mismo 403.
            // Si falla esta lectura, se omite el diagnóstico; el enlace ya está resuelto.
            const { data: recent, error } = await admin.from("app_events").select("id")
              .eq("user_id", link.user_id).eq("kind", "mi_keepalive").like("detail", '%"http":403,%')
              .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString()).limit(1);
            log = !error && Array.isArray(recent) && recent.length === 0;
          }
          if (log) await admin.from("app_events").insert({
            user_id: link.user_id, email: null, kind: "mi_keepalive",
            message: "MyInvestor keepalive", detail, app_version: "edge", platform: "server",
          });
        } catch { /* telemetría best-effort: no cambia el resultado ni frena otros enlaces */ }
      }
    }
    return jsonResp({ ok: true, refreshed, expired, skipped });
  } catch (e) {
    return jsonResp({ ok: false, error: String((e as Error)?.message || e) }, 500);
  }
});
