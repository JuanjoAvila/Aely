// ============================================================
// Edge Function: delete-account  (verify_jwt = true)
// Borrado RGPD: elimina al usuario de Auth y sus datos (CASCADE en tablas public.*).
// La contraseña NO se guarda en ningún sitio; solo se valida en este paso.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";
import { jsonResp } from "../_shared/myinvestor.ts";
import { withCors } from "../_shared/cors.ts";
import { readInput } from "../_shared/request_body.ts";
import { rateLimit } from "../_shared/ratelimit.ts";

Deno.serve(withCors(async (req: Request) => {
  try {
    const input = await readInput(req, "delete-account");
    if (!input.ok) return jsonResp({ ok: false, error: input.error }, input.status);
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization") || "";
    const supa = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supa.auth.getUser();
    if (!user || !user.email) return jsonResp({ ok: false, error: "sin sesión" }, 401);

    const body = input.body;
    const password = String(body?.password || "").trim();
    if (!password) return jsonResp({ ok: false, error: "confirma con tu contraseña" }, 400);

    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    // P3-06 (auditoría 14/11): con una sesión robada, esto era un probador de contraseñas sin
    // más freno que el de Auth por IP. Cinco intentos cada diez minutos sobran para equivocarse.
    const gate = await rateLimit(admin, "delete-account:" + user.id, 5, 600);
    if (!gate.ok) return jsonResp({ ok: false, error: "rate_limit" }, 429);

    // Re-autenticación: evita borrado accidental con sesión robada.
    const probe = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { error: signErr } = await probe.auth.signInWithPassword({ email: user.email, password });
    if (signErr) return jsonResp({ ok: false, error: "contraseña incorrecta" }, 403);

    // Best-effort: desconectar integraciones antes del CASCADE.
    await admin.from("myinvestor_links").delete().eq("user_id", user.id);
    await admin.from("bank_links").delete().eq("user_id", user.id);
    await admin.from("ingest_tokens").delete().eq("user_id", user.id);

    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    // P3-09: el texto de Auth/PostgREST se queda en el servidor; al cliente, un código cerrado.
    if (delErr) return jsonResp({ ok: false, error: "error" }, 500);

    return jsonResp({ ok: true, deleted: true });
  } catch (_) {
    return jsonResp({ ok: false, error: "error" }, 500);
  }
}));
