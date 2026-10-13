// ============================================================
// Edge Function: bank-disconnect  (verify_jwt = true)
// La llama la app (usuario logueado). QUITA un banco enlazado del usuario:
//   1. revoca (best-effort) el consentimiento en Enable Banking (DELETE /sessions/{id}),
//   2. borra la fila de bank_links.
// Reversible: el usuario puede volver a conectar el banco cuando quiera.
// Aislada: NO toca expenses ni accounts (el saldo cacheado se queda; deja de
// auto-actualizarse porque el banco ya no aparece en el próximo bank-sync).
// El borrado va por service role (RLS solo deja LEER a 'authenticated'), pero
// SIEMPRE filtrado por user_id: un usuario nunca puede quitar el banco de otro.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ebApi, ebConfig, ebFailure, jsonResp, makeJWT } from "../_shared/enablebanking.ts";
import { decryptSessionId } from "../_shared/token_store.ts";
import { withCors } from "../_shared/cors.ts";

Deno.serve(withCors(async (req: Request) => {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const supa = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return jsonResp({ ok: false, error: "sin sesión" }, 401);

    const body = await req.json().catch(() => ({}));
    const aspsp_name = body.aspsp_name;
    if (!aspsp_name) return jsonResp({ ok: false, error: "falta aspsp_name" }, 400);

    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // Localiza SOLO el enlace de ESTE usuario (filtro por user_id = aislamiento).
    const { data: link } = await admin.from("bank_links").select("*")
      .eq("user_id", user.id).eq("aspsp_name", aspsp_name).maybeSingle();

    // Best-effort: revoca la sesión en Enable Banking. Si ya caducó / falla, da igual:
    // borramos la fila igualmente para que el usuario deje de verlo en "Mis bancos".
    if (link && link.session_id) {
      let step = "decrypt";
      try {
        // En reposo está cifrado; mandarlo tal cual dejaba vivo el consentimiento aunque
        // la fila local desapareciese. El helper conserva también los ids legacy.
        const sessionId = await decryptSessionId(link.session_id);
        if (!sessionId) throw new Error("session_id vacío");
        step = "revoke";
        const { appId, pem } = ebConfig();
        const jwt = await makeJWT(appId, pem);
        await ebApi(jwt, `/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
      } catch (err) {
        // Desconectar localmente sigue siendo posible, pero soporte necesita saber si no
        // se revocó. Solo clases cerradas: nunca id, ciphertext, JWT ni texto del proveedor.
        const failure = step === "decrypt" ? { status: 0, code: "DESCIFRADO" } : ebFailure(err);
        try {
          await admin.from("app_events").insert({
            user_id: user.id, email: null, kind: "error", message: "OB desconexión: revocación no completada",
            detail: JSON.stringify({ step, status: failure.status, code: failure.code || "SIN_CODIGO" }),
            app_version: "edge", platform: "server",
          });
        } catch (_) { /* el diagnóstico no debe impedir el borrado local */ }
      }
    }

    const { error } = await admin.from("bank_links").delete()
      .eq("user_id", user.id).eq("aspsp_name", aspsp_name);
    if (error) return jsonResp({ ok: false, error: error.message }, 500);

    return jsonResp({ ok: true });
  } catch (e) {
    return jsonResp({ ok: false, error: String((e as Error)?.message || e) }, 500);
  }
}));
