// ============================================================
// Edge Function: prices — entrypoint.
// La lógica testeable vive en prices_core.ts (SEC-02: límites/replay).
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
    env: { FINNHUB_KEY: Deno.env.get("FINNHUB_KEY") },
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    now: () => Date.now(),
  };
}

Deno.serve(withCors((req) => handlePrices(req, liveDeps())));
