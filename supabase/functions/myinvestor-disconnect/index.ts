// ============================================================
// Edge Function: myinvestor-disconnect  (verify_jwt = true)
// Borra el enlace de sesión de MyInvestor del usuario (tokens incluidos).
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResp } from "../_shared/myinvestor.ts";
import { withCors } from "../_shared/cors.ts";
import { readInput } from "../_shared/request_body.ts";

Deno.serve(withCors(async (req: Request) => {
  try {
    const input = await readInput(req, "myinvestor-disconnect");
    if (!input.ok) return jsonResp({ ok: false, error: input.error }, input.status);
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const supa = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return jsonResp({ ok: false, error: "sin sesión" }, 401);
    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await admin.from("myinvestor_links").delete().eq("user_id", user.id);
    return jsonResp({ ok: true });
  } catch (e) {
    return jsonResp({ ok: false, error: String((e as Error)?.message || e) }, 500);
  }
}));
