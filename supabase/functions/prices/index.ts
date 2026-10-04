// ============================================================
// Edge Function: prices — entrypoint.
// Lógica en prices_core.ts. Cuota 30/600 = PROPUESTA (apagada por defecto).
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withCors } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/ratelimit.ts";
import { handlePrices, type PricesDeps } from "./prices_core.ts";

function liveDeps(): PricesDeps {
  return {
    fetch,
    async getUser(authHeader) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) return null;
      return { id: user.id };
    },
    async rateLimit(bucket, limit, windowSecs) {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      return await rateLimit(admin, bucket, limit, windowSecs);
    },
    // OFF por defecto: 30/600 es propuesta, no contrato autorizado (SEC-02 / Codex NO-GO).
    // Un deploy futuro podría poner PRICES_RATE_LIMIT=1 tras autorización explícita;
    // aun así cuenta peticiones HTTP, no fetches al proveedor (ver brief).
    applyRateProposal: Deno.env.get("PRICES_RATE_LIMIT") === "1",
    env: { FINNHUB_KEY: Deno.env.get("FINNHUB_KEY") },
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    now: () => Date.now(),
  };
}

Deno.serve(withCors((req) => handlePrices(req, liveDeps())));
