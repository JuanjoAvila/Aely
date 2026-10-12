// ============================================================
// Edge Function: bank-connect  (verify_jwt = true)
// La llama la app (usuario logueado). Genera el enlace de login del banco
// vía Enable Banking y guarda un enlace 'pending' con el `state` para casar
// luego el callback. NO escribe nada en expenses ni en app_state.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ebApi, ebConfig, jsonResp, makeJWT } from "../_shared/enablebanking.ts";
import { withCors } from "../_shared/cors.ts";

Deno.serve(withCors(async (req: Request) => {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    // Usuario a partir del JWT de la petición.
    const supa = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return jsonResp({ ok: false, error: "sin sesión" }, 401);

    const body = await req.json().catch(() => ({}));
    const aspsp_name = body.aspsp_name || "Banco de Sabadell";
    const aspsp_country = String(body.country || "ES").toUpperCase();

    const { appId, pem } = ebConfig();
    const jwt = await makeJWT(appId, pem);
    // Si la petición viene de la APP Android (body.platform), el state lleva el sufijo ".app":
    // bank-callback lo detecta y en vez de volver a la web devuelve la página puente que salta
    // a micartera://bank (deep-link de vuelta a la app). Sin tocar el esquema de bank_links.
    const state = crypto.randomUUID() + (body.platform === "app" ? ".app" : "");
    const redirect = Deno.env.get("EB_REDIRECT_URL") || `${SUPABASE_URL}/functions/v1/bank-callback`;
    const validUntil = new Date(Date.now() + 89 * 24 * 3600 * 1000).toISOString();

    const auth = await ebApi(jwt, "/auth", {
      method: "POST",
      body: {
        access: { valid_until: validUntil },
        aspsp: { name: aspsp_name, country: aspsp_country },
        state,
        redirect_url: redirect,
        psu_type: "personal",
      },
    });

    // Guarda/actualiza el enlace 'pending' (service role salta RLS).
    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error } = await admin.from("bank_links").upsert({
      user_id: user.id,
      aspsp_name,
      aspsp_country,
      state,
      // Marca de emisión: bank-callback rechaza los `state` viejos. El `state` viaja en la URL
      // de vuelta del banco, así que acaba en el historial del navegador y en logs por el
      // camino; sin caducidad seguiría valiendo meses después (migración 0019).
      // Es también lo que distingue una autorización de la anterior en el acuse de bank-sync
      // (`ackLinkKey`): al renovarse aquí, los acuses de antes de reconectar dejan de valer.
      state_issued_at: new Date().toISOString(),
      status: "pending",
      valid_until: validUntil,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,aspsp_name" });
    if (error) return jsonResp({ ok: false, error: error.message }, 500);

    return jsonResp({ ok: true, url: auth.url || auth.redirect_url });
  } catch (e) {
    return jsonResp({ ok: false, error: String((e as Error)?.message || e) }, 500);
  }
}));
