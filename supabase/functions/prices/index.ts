// ============================================================
// Edge Function: prices — entrypoint.
// Lógica en prices_core.ts. Cuota 30/600 por usuario + global por hora, encendida por defecto.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";
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
      return { id: user.id, createdAt: user.created_at ?? null };
    },
    async rateLimit(bucket, limit, windowSecs) {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      return await rateLimit(admin, bucket, limit, windowSecs);
    },
    // ENCENDIDO por defecto desde P2-06 (auditoría 14/11): con el registro abierto, apagado
    // dejaba la cuota de Finnhub a merced de cualquiera con cuentas. `PRICES_RATE_LIMIT=0` es el
    // interruptor para apagarlo sin redesplegar si algo lo hiciera saltar en uso normal.
    applyRateProposal: Deno.env.get("PRICES_RATE_LIMIT") !== "0",
    env: { FINNHUB_KEY: Deno.env.get("FINNHUB_KEY") },
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    now: () => Date.now(),
  };
}

Deno.serve(withCors((req) => handlePrices(req, liveDeps())));
