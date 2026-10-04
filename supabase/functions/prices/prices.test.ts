/**
 * SEC-02 · prices — límites / replay con fetch y tiempo SIMULADOS.
 * Cero llamadas a Finnhub/Yahoo: el fetch inyectado cuenta y responde en memoria.
 */
import { assertEquals, assert } from "jsr:@std/assert@1";
import {
  DEFAULT_SYMS,
  handlePrices,
  normalizeSymbols,
  PRICES_MAX_BODY,
  PRICES_MAX_SYMS,
  PRICES_RATE_LIMIT,
  PRICES_RATE_WINDOW_SECS,
  type PricesDeps,
} from "./prices_core.ts";

type Hit = { url: string };

function mockFetch(hits: Hit[], price = 12.34): typeof fetch {
  return (async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);
    hits.push({ url });
    if (url.includes("finnhub.io")) {
      return new Response(JSON.stringify({ c: price }), { status: 200 });
    }
    // Yahoo chart shape mínima
    return new Response(JSON.stringify({
      chart: { result: [{ meta: { regularMarketPrice: price } }] },
    }), { status: 200 });
  }) as typeof fetch;
}

function baseDeps(hits: Hit[], overrides: Partial<PricesDeps> = {}): PricesDeps {
  let clock = 1_700_000_000_000;
  const sleeps: number[] = [];
  return {
    fetch: mockFetch(hits),
    getUser: async () => ({ id: "user-a" }),
    rateLimit: async () => ({ ok: true, checked: true }),
    env: { FINNHUB_KEY: "test-key" },
    sleep: async (ms) => { sleeps.push(ms); },
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
  assertEquals(out.length <= PRICES_MAX_SYMS, true);
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

Deno.test("rateLimit ok:false → 429 y cero fetches (replay abusivo)", async () => {
  const hits: Hit[] = [];
  const res = await handlePrices(
    post(["NVDA", "GOOG"]),
    baseDeps(hits, { rateLimit: async () => ({ ok: false, checked: true }) }),
  );
  assertEquals(res.status, 429);
  const body = await res.json();
  assertEquals(body.ok, false);
  assertEquals(body.error, "limited");
  assertEquals(hits.length, 0);
});

Deno.test("rateLimit fail-open (checked:false) SÍ deja pasar (regla de la casa)", async () => {
  const hits: Hit[] = [];
  const res = await handlePrices(
    post(["NVDA"]),
    baseDeps(hits, { rateLimit: async () => ({ ok: true, checked: false }) }),
  );
  assertEquals(res.status, 200);
  assertEquals(hits.length >= 1, true);
});

Deno.test("camino feliz: Finnhub + Yahoo mapeado; sleep 120 entre Finnhub", async () => {
  const hits: Hit[] = [];
  const sleeps: number[] = [];
  const res = await handlePrices(
    post(["NVDA", "GOLD"]),
    baseDeps(hits, {
      sleep: async (ms) => { sleeps.push(ms); },
    }),
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.ok, true);
  assertEquals(body.prices.NVDA, 12.34);
  assertEquals(body.prices.GOLD, 12.34);
  assert(hits.some((h) => h.url.includes("finnhub.io") && h.url.includes("NVDA")));
  assert(hits.some((h) => h.url.includes("yahoo.com") && h.url.includes("GC%3DF")));
  assertEquals(sleeps.includes(120), true);
});

Deno.test("tope 25: 40 símbolos → como máximo 25 fetches de proveedor", async () => {
  const hits: Hit[] = [];
  const many = Array.from({ length: 40 }, (_, i) => "S" + String(i).padStart(2, "0"));
  const res = await handlePrices(post(many), baseDeps(hits));
  assertEquals(res.status, 200);
  // Cada símbolo US va a Finnhub (y solo a Yahoo si falla). Con mock OK: 1 fetch/símbolo.
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

Deno.test("replay: tras PRICES_RATE_LIMIT aciertos, el siguiente no gasta fetch", async () => {
  const hits: Hit[] = [];
  let n = 0;
  const deps = baseDeps(hits, {
    rateLimit: async () => {
      n += 1;
      if (n > PRICES_RATE_LIMIT) return { ok: false, checked: true };
      return { ok: true, checked: true };
    },
  });
  for (let i = 0; i < PRICES_RATE_LIMIT; i++) {
    const res = await handlePrices(post(["NVDA"]), deps);
    assertEquals(res.status, 200);
  }
  const before = hits.length;
  const blocked = await handlePrices(post(["NVDA"]), deps);
  assertEquals(blocked.status, 429);
  assertEquals(hits.length, before); // ni un fetch más
  assertEquals(PRICES_RATE_WINDOW_SECS, 600);
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
