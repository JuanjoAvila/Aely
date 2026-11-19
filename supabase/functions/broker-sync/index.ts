// ============================================================
// Edge Function: broker-sync  (verify_jwt = true)
// IBKR (Flex) y Kraken: lee el bróker con la credencial guardada y DEVUELVE las posiciones (no las escribe).
// La lógica vive en _shared/brokers/handlers.ts, donde la prueban los tests Deno sin red.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";
import { withCors } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/ratelimit.ts";
import { claveCifradoLista, decryptSecret, encryptSecret } from "../_shared/crypto.ts";
import { brokerSyncHandler } from "../_shared/brokers/handlers.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

Deno.serve(withCors(brokerSyncHandler({
  userOf: async (req: Request) => {
    const supa = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: { user } } = await supa.auth.getUser();
    return user ? { id: user.id } : null;
  },
  admin: createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!),
  fetch: (url: string, init?: RequestInit) => fetch(url, init),
  sleep: (ms: number) => new Promise((r) => setTimeout(r, ms)),
  encrypt: encryptSecret,
  decrypt: decryptSecret,
  keyReady: claveCifradoLista,
  rateLimit,
  now: () => Date.now(),
  uuid: () => crypto.randomUUID(),
  // Solo códigos cerrados: nunca la credencial, el cuerpo del bróker ni el id del usuario.
  log: (line: string) => console.error(line),
})));
