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
// SEC-02 (2026-10-04): freno por usuario con el limitador YA existente (`_shared/ratelimit.ts`
// + RPC `check_rate_limit` de 0019). Sin él, un JWT válido podía repetir la misma petición
// y gastar cuota de Finnhub/Yahoo a voluntad: cada request llega a 25 fetches externos.
// Tope de cuerpo (4 KiB) antes de parsear: con 25 tickers de 12 chars sobra, y evita basura.
// Replay de cotizaciones ≠ dedup de pagos: no se inventa caché/SQL nueva; el abuso se corta
// con el mismo bucket de rate limit. Si hace falta caché compartida entre isolates, va como
// propuesta aparte (ver informe SEC-02), sin deploy en esta tanda.
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
// Por qué 30/10 min y no un número sacado de la manga: cada petición puede disparar hasta
// 25 llamadas a Finnhub (tier gratis ~60/min). 30 refrescos humanos en 10 min cubren abrir
// Cartera, pulsar «Precios USD» y un import de bróker; un bucle del cliente o un JWT filtrado
// se corta antes de vaciar la cuota compartida. Mismo contrato que categorize/help-assistant.
export const PRICES_RATE_LIMIT = 30;
export const PRICES_RATE_WINDOW_SECS = 600;
export const SYM_RE = /^[A-Z0-9.=\-]{1,12}$/;

// El origen permitido lo pone `withCors` en la respuesta (lista blanca, ../_shared/cors.ts).
const cors = { "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

export function normalizeSymbols(raw: unknown[]): string[] {
  return [...new Set(
    raw.map((s) => String(s).trim().toUpperCase()).filter((s) => SYM_RE.test(s)),
  )].slice(0, PRICES_MAX_SYMS);
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

  // Freno ANTES de tocar Finnhub/Yahoo. Fail-open si el limitador no puede comprobar
  // (regla de ratelimit.ts): no tumbar cotizaciones por un hipo de Postgres.
  const gate = await deps.rateLimit(
    "prices:" + user.id,
    PRICES_RATE_LIMIT,
    PRICES_RATE_WINDOW_SECS,
  );
  if (!gate.ok) return json({ ok: false, error: "limited" }, 429);

  const key = deps.env.FINNHUB_KEY || "";
  const prices: Record<string, number> = {};
  const errors: Array<Record<string, unknown>> = [];

  for (const sym of syms) {
    try {
      if (YAHOO[sym]) {
        const p = await fromYahoo(deps.fetch, YAHOO[sym]);
        if (p) prices[sym] = p;
        else errors.push({ sym, via: "yahoo:" + YAHOO[sym] });
        continue;
      }
      let p = key ? await fromFinnhub(deps.fetch, sym, key) : null;
      if (p == null) p = await fromYahoo(deps.fetch, sym); // fallback: lo que Finnhub gratis no cubra
      if (p) prices[sym] = p;
      else errors.push({ sym, via: key ? "finnhub+yahoo" : "yahoo (sin FINNHUB_KEY)" });
      if (key) await deps.sleep(120); // rate limit del tier gratis
    } catch (e) {
      errors.push({ sym, status: "exception", body: String(e).slice(0, 150) });
    }
  }

  const out: Record<string, unknown> = { ok: true, prices: prices, ts: deps.now() };
  if (errors.length) out.errors = errors;
  return json(out, 200);
}
