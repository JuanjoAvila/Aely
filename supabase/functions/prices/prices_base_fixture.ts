// ============================================================
// Fixture de comparación SEC-02 — handler de prices en origin/main@8bb0398f.
// NO es el entrypoint de deploy. Solo para rojo/verde base vs candidato.
// Fuente: `git show 8bb0398f:supabase/functions/prices/index.ts` (lógica del serve).
// ============================================================

const DEFAULT_SYMS = ["NVDA", "GOOG", "TSM", "AVGO", "MU", "AMD", "VWCE", "GOLD"];
const YAHOO: Record<string, string> = {
  VWCE: "VWCE.DE", GOLD: "GC=F", XAU: "GC=F", XAG: "SI=F", XPT: "PL=F", XPD: "PA=F",
};
const cors = { "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

export type BasePricesDeps = {
  fetch: typeof fetch;
  env: { FINNHUB_KEY?: string | null };
  sleep: (ms: number) => Promise<void>;
  now: () => number;
};

/**
 * Comportamiento de `8bb0398f`: sin getUser, sin tope de cuerpo, sin rateLimit.
 * Sleep solo tras Finnhub OK (si fetch lanza, no duerme).
 */
export async function handlePricesBase(
  req: Request,
  deps: BasePricesDeps,
): Promise<Response> {
  let syms: string[] = [];
  try {
    if (req.method === "POST") {
      const b = await req.json();
      if (b && Array.isArray(b.symbols)) syms = b.symbols;
    }
  } catch (_e) { /* sin body o no-JSON → defaults */ }
  if (!syms.length) {
    const q = new URL(req.url).searchParams.get("symbols");
    if (q) syms = q.split(",");
  }
  syms = [...new Set(
    syms.map((s) => String(s).trim().toUpperCase()).filter((s) => /^[A-Z0-9.=\-]{1,12}$/.test(s)),
  )].slice(0, 25);
  if (!syms.length) syms = DEFAULT_SYMS.slice();

  const key = deps.env.FINNHUB_KEY || "";
  const prices: Record<string, number> = {};
  const errors: Array<Record<string, unknown>> = [];

  for (const sym of syms) {
    try {
      if (YAHOO[sym]) {
        const res = await deps.fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(YAHOO[sym])}?interval=1d&range=1d`,
          { headers: { "User-Agent": "Mozilla/5.0" } },
        );
        const data = JSON.parse(await res.text());
        const p = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (typeof p === "number" && p > 0) prices[sym] = p;
        else errors.push({ sym, via: "yahoo:" + YAHOO[sym] });
        continue;
      }
      let p: number | null = null;
      if (key) {
        const res = await deps.fetch(
          `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${key}`,
        );
        const data = JSON.parse(await res.text());
        p = (typeof data.c === "number" && data.c > 0) ? data.c : null;
      }
      if (p == null) {
        const res = await deps.fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`,
          { headers: { "User-Agent": "Mozilla/5.0" } },
        );
        const data = JSON.parse(await res.text());
        const yp = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
        p = (typeof yp === "number" && yp > 0) ? yp : null;
      }
      if (p) prices[sym] = p;
      else errors.push({ sym, via: key ? "finnhub+yahoo" : "yahoo (sin FINNHUB_KEY)" });
      if (key) await deps.sleep(120);
    } catch (e) {
      errors.push({ sym, status: "exception", body: String(e).slice(0, 150) });
    }
  }

  const out: Record<string, unknown> = { ok: true, prices, ts: deps.now() };
  if (errors.length) out.errors = errors;
  return json(out, 200);
}

export const BASE_HANDLER_SHA = "8bb0398f9d16a848b984c989a6515e87937c815c";
