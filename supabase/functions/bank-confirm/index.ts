// ============================================================
// Edge Function: bank-confirm  (verify_jwt = true)
// Segunda mitad de la vinculación en modo confirmación (P2-01, auditoría del 14/11).
// `bank-callback` dejó el enlace en `pending` con la huella de un token de un solo uso y mandó
// el token a quien volvió del banco. Esta función, con la sesión de la app, lo activa SOLO si el
// enlace es del usuario que llama. Así, una URL de banco lanzada por otra cuenta y autorizada
// por la víctima nunca llega a leer sus movimientos: la víctima recibe el token, pero el enlace
// no es suyo; el dueño del enlace es el que nunca recibe el token.
// No llama al banco ni toca expenses: solo cambia `status` y gasta la huella.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";
import { jsonResp } from "../_shared/enablebanking.ts";
import { withCors } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/ratelimit.ts";
import { readInput } from "../_shared/request_body.ts";
import { confirmacionCaducada, huellaConfirmacion } from "../_shared/entrada.ts";

Deno.serve(withCors(async (req: Request) => {
  // deno-lint-ignore no-explicit-any
  let admin: any = null;
  let userId: string | null = null;
  // Solo códigos cerrados hacia la app y hacia app_events: ni el token ni la huella salen.
  const falla = async (code: string, status: number, publico = code) => {
    if (admin && userId) {
      try {
        await admin.from("app_events").insert({
          user_id: userId, email: null, kind: "error", message: "BANK-CONFIRM: " + code,
          detail: JSON.stringify({ code }), app_version: "edge", platform: "server",
        });
      } catch (_) { /* diagnóstico opcional */ }
    }
    return jsonResp({ ok: false, error: publico }, status);
  };
  try {
    const input = await readInput(req, "bank-confirm");
    if (!input.ok) return jsonResp({ ok: false, error: input.error }, input.status);
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const supa = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return jsonResp({ ok: false, error: "sin sesión" }, 401);

    admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // Un token de 256 bits no se adivina, pero probar sin freno tampoco tiene por qué salir gratis.
    const gate = await rateLimit(admin, "bank-confirm:" + user.id, 20, 600);
    if (!gate.ok) return jsonResp({ ok: false, error: "rate_limit" }, 429);
    userId = user.id;

    const huella = await huellaConfirmacion(String(input.body.token));
    const { data: link, error } = await admin.from("bank_links")
      .select("id,user_id,aspsp_name,state,state_issued_at,status").eq("state", huella).maybeSingle();
    if (error) return await falla("error", 500);
    // Enlace de otra cuenta: la misma respuesta que «no existe», para no confirmar nada a nadie.
    // El evento queda en la cuenta de quien llama, que es la posible víctima.
    if (!link) return await falla("state", 400);
    if (link.user_id !== user.id) return await falla("ajeno", 400, "state");
    if (confirmacionCaducada(link.state_issued_at, Date.now())) return await falla("caducado", 400);

    // Mismo patrón que el callback: solo activa la generación que se leyó. Si entretanto se
    // reconectó (bank-connect renueva state y emisión), cero filas y no se activa nada.
    const done = await admin.from("bank_links")
      .update({ status: "active", state: null, updated_at: new Date().toISOString() })
      .eq("id", link.id).eq("user_id", user.id).eq("state", huella)
      .eq("state_issued_at", link.state_issued_at).select("id");
    if (done?.error || !Array.isArray(done?.data) || done.data.length !== 1 || done.data[0]?.id !== link.id) {
      return await falla("error", 409);
    }
    return jsonResp({ ok: true, aspsp_name: link.aspsp_name });
  } catch (_) {
    return await falla("error", 500);
  }
}));
