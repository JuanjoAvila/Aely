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
import { readInput } from "../_shared/request_body.ts";

Deno.serve(withCors(async (req: Request) => {
  try {
    const input = await readInput(req, "bank-disconnect");
    if (!input.ok) return jsonResp({ ok: false, error: input.error }, input.status);
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const supa = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return jsonResp({ ok: false, error: "sin sesión" }, 401);

    const body = input.body;
    const aspsp_name = body.aspsp_name;
    if (!aspsp_name) return jsonResp({ ok: false, error: "falta aspsp_name" }, 400);

    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // Localiza SOLO el enlace de ESTE usuario (filtro por user_id = aislamiento).
    const { data: link } = await admin.from("bank_links").select("*")
      .eq("user_id", user.id).eq("aspsp_name", aspsp_name).maybeSingle();

    // Sin snapshot no se puede revocar ni borrar una conexión que aparezca después de leer.
    if (!link) return jsonResp({ ok: true });
    // Revocar la sesión leída es best-effort y acotado. El borrado local conserva la versión:
    // si se reconecta durante la espera, esa autorización nueva debe seguir viva y visible.
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
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          // Abort no basta si el transporte no reacciona: el race limita también esa espera.
          await Promise.race([
            ebApi(jwt, "/sessions/" + encodeURIComponent(sessionId), { method: "DELETE", signal: controller.signal }),
            new Promise<never>((_resolve, reject) => { timer = setTimeout(() => { reject(new Error("revocation_timeout")); controller.abort(); }, 8000); }),
          ]);
        } finally { clearTimeout(timer); controller.abort(); }
      } catch (err) {
        // Desconectar localmente sigue siendo posible, pero soporte necesita saber si no
        // se revocó. Solo clases cerradas: nunca id, ciphertext, JWT ni texto del proveedor.
        const failure = step === "decrypt" ? { status: 0, code: "DESCIFRADO" } : String((err as Error)?.message) === "revocation_timeout" ? { status: 0, code: "TIEMPO" } : ebFailure(err);
        try {
          await admin.from("app_events").insert({
            user_id: user.id, email: null, kind: "error", message: "OB desconexión: revocación no completada",
            detail: JSON.stringify({ step, status: failure.status, code: failure.code || "SIN_CODIGO" }),
            app_version: "edge", platform: "server",
          });
        } catch (_) { /* el diagnóstico no debe impedir el borrado local */ }
      }
    }

    // Se borra solo la generación revocada. Borrar la nueva dejaría su consentimiento vivo
    // pero oculto en la app; el conflicto permite repetir sobre la autorización vigente.
    let deletion = admin.from("bank_links").delete()
      .eq("user_id", user.id).eq("aspsp_name", aspsp_name).eq("id", link.id);
    deletion = link.session_id == null ? deletion.is("session_id", null) : deletion.eq("session_id", link.session_id);
    deletion = link.state_issued_at == null ? deletion.is("state_issued_at", null) : deletion.eq("state_issued_at", link.state_issued_at);
    const { data: removed, error } = await deletion.select("id");
    if (error) return jsonResp({ ok: false, error: error.message }, 500);

    if (!removed || !removed.length) return jsonResp({ ok: false, error: "enlace cambiado; vuelve a intentarlo" }, 409);
    return jsonResp({ ok: true });
  } catch (e) {
    return jsonResp({ ok: false, error: String((e as Error)?.message || e) }, 500);
  }
}));
