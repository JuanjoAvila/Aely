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
import { CORS, jsonResp, MI_BASE, miHeaders } from "../_shared/myinvestor.ts";
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
      const tokens = await miTokensFromRow(link);
      if (!tokens.refresh || !tokens.deviceId) { skipped++; continue; }
      try {
        const r = await fetch(MI_BASE + "/login/api/v1/auth/token/refresh", {
          method: "POST",
          headers: miHeaders(tokens.deviceId),
          body: JSON.stringify({ refreshToken: tokens.refresh }),
        });
        const t = await r.text();
        // deno-lint-ignore no-explicit-any
        let j: any = null; try { j = JSON.parse(t); } catch { /* deja null */ }
        const d = (j && j.payload && j.payload.data) || {};
        if ((r.status === 200 || r.status === 201) && d.accessToken) {
          const refreshSecs = Number(d.refreshExpiresIn || 0);
          const enc = await miTokensToRow(d.accessToken, d.refreshToken || tokens.refresh);
          await admin.from("myinvestor_links").update({
            access_token: enc.access_token,
            refresh_token: enc.refresh_token,
            refresh_expires_at: refreshSecs > 0 ? new Date(Date.now() + refreshSecs * 1000).toISOString() : link.refresh_expires_at,
            status: "active", updated_at: new Date().toISOString(),
          }).eq("user_id", link.user_id);
          refreshed++;
        } else if (r.status === 400 || r.status === 401) {
          // Solo 400/401 = refresh muerto de verdad. Un 403 (bot/rate-limit) NO caduca el enlace:
          // antes pedía captcha/OTP al abrir la app (feedback 2026-07-17).
          await admin.from("myinvestor_links").update({ status: "expired", updated_at: new Date().toISOString() }).eq("user_id", link.user_id);
          expired++;
        } else {
          skipped++;   // 403/5xx/raro: no tocamos nada y se reintenta al próximo tick
        }
      } catch { skipped++; /* red caída: reintenta al próximo tick */ }
    }
    return jsonResp({ ok: true, refreshed, expired, skipped });
  } catch (e) {
    return jsonResp({ ok: false, error: String((e as Error)?.message || e) }, 500);
  }
});
