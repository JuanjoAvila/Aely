// ============================================================
// Edge Function: categorize
// Sugiere categoría de gasto VARIABLE a partir del comercio.
// 1) Keywords locales (mismas que ingest) — gratis, offline-ish.
// 2) Si cae en "otros" y hay OPENAI_API_KEY → un shot LLM acotado
//    a la lista de categorías (sin inventar ids).
// Auth: JWT de usuario (verify_jwt en deploy). No envía importes.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { categorizar } from "../_shared/ingest_logic.ts";
import { withCors } from "../_shared/cors.ts";

// Misma lista que CATEGORIES en src/modules/00-core.js (más "otros").
// Si añades una categoría y no está aquí, la IA no puede devolverla — el test
// `categories` aborta si falta alguna.
const ALLOWED = [
  "super", "pan", "bares", "cine", "padel", "heladeria", "ia", "ocio", "gaming", "viajes",
  "transporte", "parking", "energia", "tasas", "recibos", "compras", "educacion",
  "salud", "pelu", "mascotas", "hogar", "regalos", "joyeria", "bizum", "otros",
] as const;

const HINTS =
  "super=supermercado; pan=panadería; bares=restaurantes y comida a domicilio; " +
  "cine=cines y entradas; padel=pádel; heladeria=helados; " +
  "ia=herramientas de inteligencia artificial (ChatGPT, Claude, Cursor); ocio=streaming, gym, ocio (Netflix, Movistar Plus, Spotify); gaming=videojuegos (Steam); " +
  "viajes=hoteles, vuelos, cruceros; transporte=metro, taxi, gasolina; parking=aparcamiento; " +
  "energia=luz, gas y agua; tasas=impuestos y multas; " +
  "recibos=facturas periódicas: teléfono, internet, seguro NO médico, alquiler, comunidad, alarma; " +
  "compras=ropa y tiendas; educacion=cursos y colegios; salud=farmacia, médico, seguro médico; " +
  "pelu=peluquería y estética; mascotas=veterinario y pienso; hogar=IKEA, bricolaje; " +
  "regalos=flores y regalos; joyeria=joyas; bizum=Bizum enviado a personas; otros=solo si no encaja ninguna.";

// El origen permitido lo pone `withCors` en la respuesta (lista blanca, ../_shared/cors.ts).
const cors = { "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(withCors(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);

  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ ok: false, error: "auth" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: { user }, error: uerr } = await supabase.auth.getUser();
  if (uerr || !user) return json({ ok: false, error: "auth" }, 401);

  let merchant = "";
  try {
    const b = await req.json();
    merchant = String((b && b.merchant) || "").trim().slice(0, 120);
  } catch (_) { /* */ }
  if (!merchant) return json({ ok: false, error: "merchant" }, 400);

  const kw = categorizar(merchant);
  if (kw !== "otros") {
    return json({ ok: true, category: kw, source: "kw" });
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY") || "";
  if (!apiKey) {
    return json({ ok: true, category: "otros", source: "kw", ai: false });
  }

  try {
    const prompt =
      "Clasifica este comercio de un gasto personal en España. " +
      "Devuelve SOLO un JSON {\"category\":\"id\"}. Ids: " +
      ALLOWED.join(", ") +
      ". Significado: " + HINTS +
      " Prefiere una categoría real a otros. Comercio: " + JSON.stringify(merchant);

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini",
        temperature: 0,
        max_tokens: 40,
        messages: [
          { role: "system", content: "Responde solo JSON válido." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) {
      return json({ ok: true, category: "otros", source: "kw", ai: "error" });
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || "";
    const m = String(text).match(/\{[\s\S]*\}/);
    let cat = "otros";
    if (m) {
      try {
        const parsed = JSON.parse(m[0]);
        const id = String(parsed.category || "").toLowerCase();
        if ((ALLOWED as readonly string[]).indexOf(id) >= 0) cat = id;
      } catch (_) { /* */ }
    }
    return json({ ok: true, category: cat, source: cat === "otros" ? "kw" : "ai" });
  } catch (_) {
    return json({ ok: true, category: "otros", source: "kw", ai: "error" });
  }
}));
