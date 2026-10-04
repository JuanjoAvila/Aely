// ============================================================
// Edge Function: prices
// Cotizaciones server-side (key oculta, sin CORS). Reemplaza a doGetPrices del Apps Script.
// - Recibe {symbols:[...]} (POST) o ?symbols=A,B — los tickers reales de la cartera del
//   usuario. Antes estaba CLAVADA a 6 símbolos fijos: cualquier valor nuevo se quedaba sin
//   precio para siempre (feedback 2026-07-13, import de Revolut).
// - Acciones US: Finnhub (FINNHUB_KEY). Lo que Finnhub gratis no cubre (ETF Xetra, oro):
//   Yahoo Finance sin key, también como fallback genérico.
// Devuelve un mapa { TICKER_APP: precio }.
//
// SEC-02 (2026-10-04, revisión adversarial): el freno cuenta LLAMADAS AL PROVEEDOR, no
// peticiones HTTP a la función. Un gate «30 req / 10 min» dejaba pasar 30×25 fetches
// concurrentes (~750) y el comentario mentía sobre la cuota ~60/min de Finnhub.
// Ahora cada Finnhub/Yahoo pasa por `check_rate_limit` (migración 0019 ya desplegada):
// bucket compartido del proyecto (la key es una) + techo por usuario. El sleep(120) solo
// espacia dentro del isolate; la concurrencia la corta Postgres, no el sleep.
// Tope de cuerpo 4 KiB. Sin SQL/caché nueva ni deploy en esta tanda.
// ============================================================

import { type RateVerdict } from "../_shared/ratelimit.ts";

// compat: clientes viejos que llaman sin body reciben lo de siempre
export const DEFAULT_SYMS = ["NVDA", "GOOG", "TSM", "AVGO", "MU", "AMD", "VWCE", "GOLD"];
// clave usada en la app -> símbolo en Yahoo Finance (GC=F ≈ oro spot USD/onza; Revolut
// llama XAU al oro y la app histórica GOLD — las dos apuntan al mismo sitio).
// XAG/XPT/XPD entran con el import de materias primas de Revolut (2026-07-15): son los
// futuros de plata/platino/paladio, también en USD/onza, que es como Revolut los mide.
export const YAHOO: Record<string, string> = {
  VWCE: "VWCE.DE", GOLD: "GC=F", XAU: "GC=F", XAG: "SI=F", XPT: "PL=F", XPD: "PA=F",
};

export const PRICES_MAX_BODY = 4 * 1024;
export const PRICES_MAX_SYMS = 25;

// Cuota del proveedor (Finnhub free ≈ 60/min). UNA unidad = UN fetch externo.
// Bucket compartido: FINNHUB_KEY es del proyecto, no del usuario.
export const PRICES_PROVIDER_BUCKET = "prices-provider";
export const PRICES_PROVIDER_LIMIT = 60;
export const PRICES_PROVIDER_WINDOW_SECS = 60;
// Techo por JWT para que un solo cliente no se coma el minuto entero del proyecto.
export const PRICES_USER_PROVIDER_LIMIT = 45;
export const PRICES_USER_PROVIDER_WINDOW_SECS = 60;
export const PRICES_FINNHUB_PACE_MS = 120;

export const SYM_RE = /^[A-Z0-9.=\-]{1,12}$/;

// El origen permitido lo pone `withCors` en la respuesta (lista blanca, ../_shared/cors.ts).
const cors = { "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

export function normalizeSymbols(raw: unknown[]): string[] {
  return [...new Set(
    raw.map((s) => String(s).trim().toUpperCase()).filter((s) => SYM_RE.test(s)),
  )].slice(0, PRICES_MAX_SYMS);
}

export function providerUserBucket(userId: string): string {
  return "prices-provider:" + userId;
}

export type PricesDeps = {
  fetch: typeof fetch;
  getUser: (authHeader: string) => Promise<{ id: string } | null>;
  rateLimit: (bucket: string, limit: number, windowSecs: number) => Promise<RateVerdict>;
  env: { FINNHUB_KEY?: string | null };
  sleep: (ms: number) => Promise<void>;
  now: () => number;
};

async function fromFinnhub(
  fetchImpl: typeof fetch,
  sym: string,
  key: string,
): Promise<number | null> {
  const res = await fetchImpl(
    `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${key}`,
  );
  const data = JSON.parse(await res.text());
  return (typeof data.c === "number" && data.c > 0) ? data.c : null;
}

async function fromYahoo(fetchImpl: typeof fetch, ySym: string): Promise<number | null> {
  const res = await fetchImpl(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySym)}?interval=1d&range=1d`,
    { headers: { "User-Agent": "Mozilla/5.0" } },
  );
  const data = JSON.parse(await res.text());
  const p = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
  return (typeof p === "number" && p > 0) ? p : null;
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function readBodyLimited(req: Request, max: number): Promise<
  { ok: true; text: string } | { ok: false; status: number; error: string }
> {
  const announced = Number(req.headers.get("content-length") || 0);
  if (announced > max) return { ok: false, status: 413, error: "cuerpo demasiado grande" };
  if (!req.body) return { ok: true, text: "" };
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > max) {
      await reader.cancel();
      return { ok: false, status: 413, error: "cuerpo demasiado grande" };
    }
    chunks.push(value);
  }
  const all = new Uint8Array(bytes);
  let off = 0;
  for (const c of chunks) {
    all.set(c, off);
    off += c.length;
  }
  return { ok: true, text: new TextDecoder().decode(all) };
}

/**
 * Reserva 1 unidad de cuota de proveedor (semántica 0019: un hit atómico por llamada).
 * Fail-open si el limitador no pudo comprobar (regla de ratelimit.ts).
 */
export async function takeProviderSlot(
  rateLimitFn: PricesDeps["rateLimit"],
  userId: string,
): Promise<RateVerdict> {
  const shared = await rateLimitFn(
    PRICES_PROVIDER_BUCKET,
    PRICES_PROVIDER_LIMIT,
    PRICES_PROVIDER_WINDOW_SECS,
  );
  if (!shared.ok) return shared;
  return await rateLimitFn(
    providerUserBucket(userId),
    PRICES_USER_PROVIDER_LIMIT,
    PRICES_USER_PROVIDER_WINDOW_SECS,
  );
}

/** Núcleo testeable: fetch/tiempo/auth/rateLimit inyectados (sin cuota real en CI). */
export async function handlePrices(req: Request, deps: PricesDeps): Promise<Response> {
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ ok: false, error: "method" }, 405);
  }

  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ ok: false, error: "auth" }, 401);
  const user = await deps.getUser(auth);
  if (!user) return json({ ok: false, error: "auth" }, 401);

  let syms: string[] = [];
  if (req.method === "POST") {
    const body = await readBodyLimited(req, PRICES_MAX_BODY);
    if (!body.ok) return json({ ok: false, error: body.error }, body.status);
    if (body.text) {
      try {
        const b = JSON.parse(body.text);
        if (b && Array.isArray(b.symbols)) syms = normalizeSymbols(b.symbols);
      } catch (_e) { /* sin body o no-JSON → defaults */ }
    }
  }
  if (!syms.length) {
    const q = new URL(req.url).searchParams.get("symbols");
    if (q) syms = normalizeSymbols(q.split(","));
  }
  if (!syms.length) syms = DEFAULT_SYMS.slice();

  const key = deps.env.FINNHUB_KEY || "";
  const prices: Record<string, number> = {};
  const errors: Array<Record<string, unknown>> = [];
  let hitLimit = false;

  for (const sym of syms) {
    if (YAHOO[sym]) {
      const gate = await takeProviderSlot(deps.rateLimit, user.id);
      if (!gate.ok) {
        hitLimit = true;
        errors.push({ sym, via: "limited" });
        break;
      }
      try {
        const p = await fromYahoo(deps.fetch, YAHOO[sym]);
        if (p) prices[sym] = p;
        else errors.push({ sym, via: "yahoo:" + YAHOO[sym] });
      } catch (e) {
        errors.push({ sym, status: "exception", body: String(e).slice(0, 150) });
      }
      continue;
    }

    let p: number | null = null;
    if (key) {
      const gate = await takeProviderSlot(deps.rateLimit, user.id);
      if (!gate.ok) {
        hitLimit = true;
        errors.push({ sym, via: "limited" });
        break;
      }
      // sleep del tier: SIEMPRE tras intentar Finnhub (también si fetch lanza).
      // Solo espacia este isolate; la concurrencia la corta el bucket compartido.
      try {
        p = await fromFinnhub(deps.fetch, sym, key);
      } catch (e) {
        errors.push({ sym, status: "exception", body: String(e).slice(0, 150) });
      } finally {
        await deps.sleep(PRICES_FINNHUB_PACE_MS);
      }
    }

    if (p == null && !errors.some((er) => er.sym === sym && er.status === "exception")) {
      const gate = await takeProviderSlot(deps.rateLimit, user.id);
      if (!gate.ok) {
        hitLimit = true;
        errors.push({ sym, via: "limited" });
        break;
      }
      try {
        p = await fromYahoo(deps.fetch, sym);
      } catch (e) {
        errors.push({ sym, status: "exception", body: String(e).slice(0, 150) });
      }
    }

    if (p) prices[sym] = p;
    else if (!errors.some((er) => er.sym === sym)) {
      errors.push({ sym, via: key ? "finnhub+yahoo" : "yahoo (sin FINNHUB_KEY)" });
    }
  }

  if (hitLimit && Object.keys(prices).length === 0) {
    return json({ ok: false, error: "limited" }, 429);
  }

  const out: Record<string, unknown> = { ok: true, prices: prices, ts: deps.now() };
  if (errors.length) out.errors = errors;
  return json(out, 200);
}
