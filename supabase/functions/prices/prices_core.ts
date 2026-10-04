// ============================================================
// Edge Function: prices — núcleo testeable.
// Cotizaciones server-side (key oculta). Finnhub + Yahoo.
//
// SEC-02 (2026-10-04, NO-GO Codex sobre d6c2940e / 6bac1827):
// - ACTIVO en esta PR (sin inventar cuota Finnhub): tope de cuerpo, getUser,
//   sleep del tier en `finally`, tope 25 símbolos (ya existía).
// - PROPUESTA explícita 30/600 (misma cifra del primer draft): NO se activa por
//   defecto. La RPC `check_rate_limit` (0019) no fija una cuota «prices»; 30
//   peticiones × 25 símbolos ≈ 750 fetches antes del 429 — NO acredita proteger
//   el presupuesto ~60/min de Finnhub. Autorización y deploy = entrega futura.
//   Ver docs/briefs/sec02-prices-limites.md.
// ============================================================

import { type RateVerdict } from "../_shared/ratelimit.ts";

export const DEFAULT_SYMS = ["NVDA", "GOOG", "TSM", "AVGO", "MU", "AMD", "VWCE", "GOLD"];
export const YAHOO: Record<string, string> = {
  VWCE: "VWCE.DE", GOLD: "GC=F", XAU: "GC=F", XAG: "SI=F", XPT: "PL=F", XPD: "PA=F",
};

export const PRICES_MAX_BODY = 4 * 1024;
export const PRICES_MAX_SYMS = 25;
export const PRICES_FINNHUB_PACE_MS = 120;
export const SYM_RE = /^[A-Z0-9.=\-]{1,12}$/;

/**
 * PROPUESTA (no contrato activo). Misma terna del draft #127 inicial.
 * Unidad = petición HTTP a la función, NO fetch al proveedor.
 * status: pendiente de autorización humana/Codex + deploy aparte.
 */
export const PRICES_RATE_PROPOSAL = {
  status: "proposal-pending-authorization" as const,
  bucketPrefix: "prices:",
  limit: 30,
  windowSecs: 600,
  unit: "http-request-to-prices-function" as const,
  // Evidencia de por qué NO se activa como «protección de presupuesto»:
  maxProviderFetchesPerRequest: PRICES_MAX_SYMS,
  worstCaseFetchesBeforeHttp429: 30 * PRICES_MAX_SYMS, // 750
  note:
    "30/600 no es categorize(40/600) ni help(15/600): esos contratos ya están " +
    "autorizados y miden otro coste. Activar esto sin más NO protege Finnhub ~60/min.",
};

export function pricesProposalBucket(userId: string): string {
  return PRICES_RATE_PROPOSAL.bucketPrefix + userId;
}

const cors = { "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

export function normalizeSymbols(raw: unknown[]): string[] {
  return [...new Set(
    raw.map((s) => String(s).trim().toUpperCase()).filter((s) => SYM_RE.test(s)),
  )].slice(0, PRICES_MAX_SYMS);
}

export type PricesDeps = {
  fetch: typeof fetch;
  getUser: (authHeader: string) => Promise<{ id: string } | null>;
  /** Adaptador sobre `_shared/ratelimit.rateLimit` + cliente con service role. */
  rateLimit: (bucket: string, limit: number, windowSecs: number) => Promise<RateVerdict>;
  /**
   * false por defecto (live): no inventar contrato de cuota.
   * true solo en pruebas del gate o si un deploy futuro autoriza la propuesta
   * con `PRICES_RATE_LIMIT=1` (sigue siendo 30/600 HTTP, no presupuesto proveedor).
   */
  applyRateProposal: boolean;
  env: { FINNHUB_KEY?: string | null };
  sleep: (ms: number) => Promise<void>;
  now: () => number;
};

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

/**
 * Aplica la PROPUESTA 30/600 vía `rateLimit` real (quien llame debe pasar el
 * wrapper de `_shared/ratelimit.ts`). Usa bucket/limit/window de la propuesta:
 * un mock que ignore esos args rompe los guardianes de prices.test.ts.
 */
export async function applyPricesRateProposalGate(
  rateLimitFn: PricesDeps["rateLimit"],
  userId: string,
): Promise<RateVerdict> {
  return await rateLimitFn(
    pricesProposalBucket(userId),
    PRICES_RATE_PROPOSAL.limit,
    PRICES_RATE_PROPOSAL.windowSecs,
  );
}

/** Núcleo testeable: fetch/tiempo/auth inyectados (cero Finnhub/Yahoo reales). */
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

  // Gate de la PROPUESTA: apagado en live. Solo si un deploy futuro lo autoriza.
  if (deps.applyRateProposal) {
    const gate = await applyPricesRateProposalGate(deps.rateLimit, user.id);
    if (!gate.ok) return json({ ok: false, error: "limited" }, 429);
  }

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
      let p: number | null = null;
      if (key) {
        try {
          p = await fromFinnhub(deps.fetch, sym, key);
        } finally {
          // Pace intra-isolate; NO es freno global de concurrencia ni cuota compartida.
          await deps.sleep(PRICES_FINNHUB_PACE_MS);
        }
      }
      if (p == null) p = await fromYahoo(deps.fetch, sym);
      if (p) prices[sym] = p;
      else errors.push({ sym, via: key ? "finnhub+yahoo" : "yahoo (sin FINNHUB_KEY)" });
    } catch (e) {
      errors.push({ sym, status: "exception", body: String(e).slice(0, 150) });
    }
  }

  const out: Record<string, unknown> = { ok: true, prices: prices, ts: deps.now() };
  if (errors.length) out.errors = errors;
  return json(out, 200);
}
