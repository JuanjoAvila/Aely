// ============================================================
// Edge Function: bank-aspsps  (verify_jwt = true)
// La llama la app (usuario logueado). Lista los bancos (ASPSPs) soportados por
// Enable Banking para un país, para el SELECTOR de "conectar banco".
// Solo lectura: no escribe nada en la BD.
// ============================================================

import { ebApi, ebConfig, jsonResp, makeJWT } from "../_shared/enablebanking.ts";
import { withCors } from "../_shared/cors.ts";
import { readInput, validInput } from "../_shared/request_body.ts";

Deno.serve(withCors(async (req: Request) => {
  try {
    // país desde el body (POST, como invoca supabase-js) o desde la query (?country=)
    const input = await readInput(req, "bank-aspsps");
    if (!input.ok) return jsonResp({ ok: false, error: input.error }, input.status);
    const body = input.body;
    const url = new URL(req.url);
    if (!body.country && url.searchParams.has("country") && !validInput("bank-aspsps", { country: url.searchParams.get("country") }))
      return jsonResp({ ok: false, error: "cuerpo inválido" }, 400);
    const country = String(body.country || url.searchParams.get("country") || "ES").toUpperCase();

    const { appId, pem } = ebConfig();
    const jwt = await makeJWT(appId, pem);
    const data = await ebApi(jwt, `/aspsps?country=${encodeURIComponent(country)}`);

    // deno-lint-ignore no-explicit-any
    const aspsps = (data.aspsps || []).map((a: any) => ({
      name: a.name,
      country: a.country || country,
      logo: a.logo || null,
      psu_types: a.psu_types || [],
      beta: !!a.beta,
    }))
      // un banco puede venir varias veces (personal/business); el cliente elige psu_type=personal
      .filter((a: { name: string }) => !!a.name);

    return jsonResp({ ok: true, country, count: aspsps.length, aspsps });
  } catch (e) {
    return jsonResp({ ok: false, error: String((e as Error)?.message || e) }, 500);
  }
}));
