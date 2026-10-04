/**
 * SEC-02 · prices — límites por LLAMADA AL PROVEEDOR (fetch/tiempo simulados).
 * Cero red a Finnhub/Yahoo. El mock de rateLimit reproduce la semántica atómica de
 * `check_rate_limit` (0019): un hit por invocación, buckets independientes.
 */
import { assertEquals, assert } from "jsr:@std/assert@1";
import {
  DEFAULT_SYMS,
  handlePrices,
  normalizeSymbols,
  PRICES_FINNHUB_PACE_MS,
  PRICES_MAX_BODY,
  PRICES_MAX_SYMS,
  PRICES_PROVIDER_BUCKET,
  PRICES_PROVIDER_LIMIT,
  PRICES_PROVIDER_WINDOW_SECS,
  PRICES_USER_PROVIDER_LIMIT,
  providerUserBucket,
  takeProviderSlot,
  type PricesDeps,
} from "./prices_core.ts";

type Hit = { url: string };

/** Semántica 0019 en memoria: hits atómicos por bucket dentro de la ventana. */
function simCheckRateLimit() {
  const buckets = new Map<string, { hits: number; start: number }>();
  let now = 1_000_000;
  return {
    tick(ms: number) { now += ms; },
    async rateLimit(bucket: string, limit: number, windowSecs: number) {
      const cur = buckets.get(bucket);
      if (!cur || cur.start < now - windowSecs * 1000) {
        buckets.set(bucket, { hits: 1, start: now });
        return { ok: true, checked: true as const };
      }
      cur.hits += 1;
      return { ok: cur.hits <= limit, checked: true as const };
    },
    hits(bucket: string) { return buckets.get(bucket)?.hits ?? 0; },
  };
}

function mockFetch(hits: Hit[], price = 12.34): typeof fetch {
  return (async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);
    hits.push({ url });
    if (url.includes("finnhub.io")) {
      return new Response(JSON.stringify({ c: price }), { status: 200 });
    }
    return new Response(JSON.stringify({
      chart: { result: [{ meta: { regularMarketPrice: price } }] },
    }), { status: 200 });
  }) as typeof fetch;
}

function baseDeps(hits: Hit[], overrides: Partial<PricesDeps> = {}): PricesDeps {
  let clock = 1_700_000_000_000;
  return {
    fetch: mockFetch(hits),
    getUser: async () => ({ id: "user-a" }),
    rateLimit: async () => ({ ok: true, checked: true }),
    env: { FINNHUB_KEY: "test-key" },
    sleep: async () => {},
    now: () => clock++,
    ...overrides,
  };
}

function post(symbols: unknown, headers: Record<string, string> = {}) {
  return new Request("https://example.test/prices", {
    method: "POST",
    headers: {
      "Authorization": "Bearer fake",
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ symbols }),
  });
}

Deno.test("normalizeSymbols: filtra, mayúsculas, dedupe y tope 25", () => {
  const raw = [
    " nvda ", "NVDA", "bad space", "GOLD", "x".repeat(13), "VWCE.DE",
    ...Array.from({ length: 30 }, (_, i) => "T" + String(i).padStart(2, "0")),
  ];
  const out = normalizeSymbols(raw);
  assertEquals(out[0], "NVDA");
  assert(out.includes("GOLD"));
  assert(out.includes("VWCE.DE"));
  assertEquals(out.includes("BAD SPACE"), false);
  assertEquals(out.length, PRICES_MAX_SYMS);
});

Deno.test("auth ausente → 401 y cero fetches externos", async () => {
  const hits: Hit[] = [];
  const req = new Request("https://example.test/prices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbols: ["NVDA"] }),
  });
  const res = await handlePrices(req, baseDeps(hits));
  assertEquals(res.status, 401);
  assertEquals(hits.length, 0);
});

Deno.test("getUser nulo → 401 y cero fetches", async () => {
  const hits: Hit[] = [];
  const res = await handlePrices(
    post(["NVDA"]),
    baseDeps(hits, { getUser: async () => null }),
  );
  assertEquals(res.status, 401);
  assertEquals(hits.length, 0);
});

Deno.test("content-length anunciado > tope → 413 sin fetch", async () => {
  const hits: Hit[] = [];
  const res = await handlePrices(
    post(["NVDA"], { "content-length": String(PRICES_MAX_BODY + 1) }),
    baseDeps(hits),
  );
  assertEquals(res.status, 413);
  assertEquals(hits.length, 0);
});

Deno.test("cuerpo real > tope → 413 sin fetch", async () => {
  const hits: Hit[] = [];
  const fat = "A".repeat(PRICES_MAX_BODY + 50);
  const req = new Request("https://example.test/prices", {
    method: "POST",
    headers: {
      "Authorization": "Bearer fake",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ symbols: [fat] }),
  });
  const res = await handlePrices(req, baseDeps(hits));
  assertEquals(res.status, 413);
  assertEquals(hits.length, 0);
});

Deno.test("fail-open (checked:false) SÍ deja pasar fetch (regla de la casa)", async () => {
  const hits: Hit[] = [];
  const res = await handlePrices(
    post(["NVDA"]),
    baseDeps(hits, { rateLimit: async () => ({ ok: true, checked: false }) }),
  );
  assertEquals(res.status, 200);
  assertEquals(hits.length >= 1, true);
});

Deno.test("errors no filtran la FINNHUB_KEY", async () => {
  const hits: Hit[] = [];
  const secret = "sk-finnhub-SECRET-do-not-leak";
  const res = await handlePrices(
    post(["ZZZZNOPE"]),
    baseDeps(hits, {
      env: { FINNHUB_KEY: secret },
      fetch: (async () => {
        hits.push({ url: "x" });
        return new Response(JSON.stringify({ c: 0 }), { status: 200 });
      }) as typeof fetch,
    }),
  );
  const text = await res.text();
  assertEquals(text.includes(secret), false);
  assertEquals(text.includes("finnhub+yahoo") || text.includes("yahoo"), true);
});

Deno.test("camino feliz: Finnhub + Yahoo mapeado; pace tras Finnhub", async () => {
  const hits: Hit[] = [];
  const sleeps: number[] = [];
  const res = await handlePrices(
    post(["NVDA", "GOLD"]),
    baseDeps(hits, { sleep: async (ms) => { sleeps.push(ms); } }),
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.prices.NVDA, 12.34);
  assertEquals(body.prices.GOLD, 12.34);
  assert(hits.some((h) => h.url.includes("finnhub.io") && h.url.includes("NVDA")));
  assert(hits.some((h) => h.url.includes("yahoo.com") && h.url.includes("GC%3DF")));
  assertEquals(sleeps.includes(PRICES_FINNHUB_PACE_MS), true);
});

Deno.test("si Finnhub lanza, el sleep del tier IGUAL corre", async () => {
  const sleeps: number[] = [];
  const hits: Hit[] = [];
  const res = await handlePrices(
    post(["NVDA"]),
    baseDeps(hits, {
      sleep: async (ms) => { sleeps.push(ms); },
      fetch: (async (input) => {
        hits.push({ url: String(input) });
        if (String(input).includes("finnhub.io")) throw new Error("boom-finnhub");
        return new Response(JSON.stringify({
          chart: { result: [{ meta: { regularMarketPrice: 1 } }] },
        }), { status: 200 });
      }) as typeof fetch,
    }),
  );
  assertEquals(res.status, 200);
  assertEquals(sleeps.filter((ms) => ms === PRICES_FINNHUB_PACE_MS).length >= 1, true);
  const body = await res.json();
  assert(Array.isArray(body.errors));
  assert(body.errors.some((e: { status?: string }) => e.status === "exception"));
});

Deno.test("tope 25: 40 símbolos → como máximo 25 fetches de proveedor", async () => {
  const hits: Hit[] = [];
  const many = Array.from({ length: 40 }, (_, i) => "S" + String(i).padStart(2, "0"));
  const res = await handlePrices(post(many), baseDeps(hits));
  assertEquals(res.status, 200);
  assertEquals(hits.length, PRICES_MAX_SYMS);
});

Deno.test("sin symbols → defaults (compat clientes viejos)", async () => {
  const hits: Hit[] = [];
  const req = new Request("https://example.test/prices", {
    method: "POST",
    headers: {
      "Authorization": "Bearer fake",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  const res = await handlePrices(req, baseDeps(hits));
  assertEquals(res.status, 200);
  const body = await res.json();
  for (const s of DEFAULT_SYMS) {
    assertEquals(typeof body.prices[s], "number");
  }
});

Deno.test("GET ?symbols= sigue vivo (compat)", async () => {
  const hits: Hit[] = [];
  const req = new Request("https://example.test/prices?symbols=AMD,GOLD", {
    method: "GET",
    headers: { "Authorization": "Bearer fake" },
  });
  const res = await handlePrices(req, baseDeps(hits));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.prices.AMD, 12.34);
  assertEquals(body.prices.GOLD, 12.34);
});

Deno.test("takeProviderSlot: compartido + usuario (dos hits 0019)", async () => {
  const sim = simCheckRateLimit();
  const v = await takeProviderSlot(sim.rateLimit, "u1");
  assertEquals(v.ok, true);
  assertEquals(sim.hits(PRICES_PROVIDER_BUCKET), 1);
  assertEquals(sim.hits(providerUserBucket("u1")), 1);
  assertEquals(PRICES_PROVIDER_LIMIT, 60);
  assertEquals(PRICES_PROVIDER_WINDOW_SECS, 60);
  assertEquals(PRICES_USER_PROVIDER_LIMIT, 45);
});

/**
 * ROJO→VERDE del hallazgo adversarial #1:
 * Varias peticiones HTTP en paralelo NO pueden superar el cupo de fetches al proveedor.
 * Con el gate viejo (1 hit / request HTTP) esto fallaría: 3×10 = 30 fetches con límite 10.
 */
Deno.test("cuota proveedor: N peticiones paralelas × M símbolos ≤ LIMIT fetches", async () => {
  const hits: Hit[] = [];
  const sim = simCheckRateLimit();
  // Cupo artificial bajo para el test (= semántica del bucket compartido).
  const LIMIT = 10;
  const deps: PricesDeps = baseDeps(hits, {
    rateLimit: async (bucket, _limit, windowSecs) => {
      // Solo el bucket compartido usa el cupo estrecho; el de usuario queda holgado.
      if (bucket === PRICES_PROVIDER_BUCKET) {
        return sim.rateLimit(bucket, LIMIT, windowSecs);
      }
      return sim.rateLimit(bucket, 10_000, windowSecs);
    },
  });
  const batch = Array.from({ length: 10 }, (_, i) => "P" + String(i).padStart(2, "0"));
  const results = await Promise.all([
    handlePrices(post(batch), deps),
    handlePrices(post(batch), deps),
    handlePrices(post(batch), deps),
  ]);
  // Antes del fix (gate por request HTTP): ~30 fetches. Después: ≤ LIMIT al proveedor.
  assert(hits.length <= LIMIT, `fetches=${hits.length} > LIMIT=${LIMIT}`);
  assertEquals(hits.length, LIMIT); // con mock sincrónico satura exactamente el cupo
  // 0019 cuenta también el hit que devuelve false (OK + rechazos posteriores).
  assert(sim.hits(PRICES_PROVIDER_BUCKET) >= LIMIT);
  assert(results.every((r) => r.status === 200 || r.status === 429));
});

Deno.test("cuota proveedor: una petición con 25 símbolos se corta al LIMIT de fetches", async () => {
  const hits: Hit[] = [];
  const sim = simCheckRateLimit();
  const LIMIT = 5;
  const many = Array.from({ length: 25 }, (_, i) => "Q" + String(i).padStart(2, "0"));
  const res = await handlePrices(
    post(many),
    baseDeps(hits, {
      rateLimit: async (bucket, _limit, windowSecs) => {
        if (bucket === PRICES_PROVIDER_BUCKET) {
          return sim.rateLimit(bucket, LIMIT, windowSecs);
        }
        return { ok: true, checked: true };
      },
    }),
  );
  assertEquals(hits.length, LIMIT);
  assertEquals(res.status, 200); // parcial: ya había precios antes del corte
  const body = await res.json();
  assertEquals(Object.keys(body.prices).length, LIMIT);
  assert(body.errors.some((e: { via?: string }) => e.via === "limited"));
});

Deno.test("primer símbolo ya limitado → 429 y cero fetches", async () => {
  const hits: Hit[] = [];
  const res = await handlePrices(
    post(["NVDA", "GOOG"]),
    baseDeps(hits, { rateLimit: async () => ({ ok: false, checked: true }) }),
  );
  assertEquals(res.status, 429);
  assertEquals(hits.length, 0);
});
