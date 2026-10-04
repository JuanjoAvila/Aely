/**
 * SEC-02 · prices — auth/cuerpo activos; gate 30/600 solo como propuesta testeable.
 * Cero Finnhub/Yahoo reales. El gate usa `rateLimit` REAL + RPC `check_rate_limit` simulada
 * que respeta p_bucket / p_limit / p_window_secs (semántica 0019).
 */
import { assertEquals, assert } from "jsr:@std/assert@1";
import { rateLimit } from "../_shared/ratelimit.ts";
import {
  applyPricesRateProposalGate,
  handlePrices,
  normalizeSymbols,
  PRICES_FINNHUB_PACE_MS,
  PRICES_MAX_BODY,
  PRICES_MAX_SYMS,
  PRICES_RATE_PROPOSAL,
  pricesProposalBucket,
  type PricesDeps,
} from "./prices_core.ts";
import { BASE_HANDLER_SHA, handlePricesBase } from "./prices_base_fixture.ts";

type Hit = { url: string };

/** RPC simulada 0019: usa bucket, limit y window; un mock que los ignore rompe los tests. */
function createSimCheckRateLimitRpc(clock: { nowMs: number }) {
  const buckets = new Map<string, { hits: number; startMs: number }>();
  const calls: Array<{ bucket: string; limit: number; windowSecs: number }> = [];
  return {
    calls,
    // deno-lint-ignore no-explicit-any
    async rpc(fn: string, args: Record<string, any>) {
      assertEquals(fn, "check_rate_limit");
      const bucket = String(args.p_bucket);
      const limit = Number(args.p_limit);
      const windowSecs = Number(args.p_window_secs);
      assert(Number.isFinite(limit) && limit > 0, "p_limit debe usarse");
      assert(Number.isFinite(windowSecs) && windowSecs > 0, "p_window_secs debe usarse");
      calls.push({ bucket, limit, windowSecs });
      const cur = buckets.get(bucket);
      if (!cur || cur.startMs < clock.nowMs - windowSecs * 1000) {
        buckets.set(bucket, { hits: 1, startMs: clock.nowMs });
        return { data: true, error: null };
      }
      cur.hits += 1;
      return { data: cur.hits <= limit, error: null };
    },
  };
}

function rateLimitViaSim(clock: { nowMs: number }) {
  const sim = createSimCheckRateLimitRpc(clock);
  return {
    sim,
    // Enlace REAL a _shared/ratelimit.ts (no un mock que decida el bloqueo a mano).
    rateLimit: (bucket: string, limit: number, windowSecs: number) =>
      rateLimit({ rpc: sim.rpc.bind(sim) }, bucket, limit, windowSecs),
  };
}

function mockFetch(hits: Hit[], price = 12.34): typeof fetch {
  return (async (input: RequestInfo | URL) => {
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

function candidateDeps(hits: Hit[], overrides: Partial<PricesDeps> = {}): PricesDeps {
  let clock = 1_700_000_000_000;
  const rl = rateLimitViaSim({ nowMs: clock });
  return {
    fetch: mockFetch(hits),
    getUser: async () => ({ id: "user-a" }),
    rateLimit: rl.rateLimit,
    applyRateProposal: false, // defecto live: propuesta NO activa
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

// ---- Propuesta documentada (no contrato activo) ----

Deno.test("propuesta 30/600 es explícita y no se hace pasar por otro número", () => {
  assertEquals(PRICES_RATE_PROPOSAL.limit, 30);
  assertEquals(PRICES_RATE_PROPOSAL.windowSecs, 600);
  assertEquals(PRICES_RATE_PROPOSAL.status, "proposal-pending-authorization");
  assertEquals(PRICES_RATE_PROPOSAL.worstCaseFetchesBeforeHttp429, 750);
  assertEquals(PRICES_RATE_PROPOSAL.unit, "http-request-to-prices-function");
});

// ---- Activo sin inventar cuota ----

Deno.test("normalizeSymbols: tope 25", () => {
  const many = Array.from({ length: 40 }, (_, i) => "T" + String(i).padStart(2, "0"));
  assertEquals(normalizeSymbols(many).length, PRICES_MAX_SYMS);
});

Deno.test("candidato: auth ausente → 401 y cero fetches", async () => {
  const hits: Hit[] = [];
  const req = new Request("https://example.test/prices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbols: ["NVDA"] }),
  });
  const res = await handlePrices(req, candidateDeps(hits));
  assertEquals(res.status, 401);
  assertEquals(hits.length, 0);
});

Deno.test("candidato: content-length > tope → 413 sin fetch", async () => {
  const hits: Hit[] = [];
  const res = await handlePrices(
    post(["NVDA"], { "content-length": String(PRICES_MAX_BODY + 1) }),
    candidateDeps(hits),
  );
  assertEquals(res.status, 413);
  assertEquals(hits.length, 0);
});

Deno.test("candidato: por defecto applyRateProposal=false no llama al gate", async () => {
  const hits: Hit[] = [];
  const clock = { nowMs: 1_000_000 };
  const { sim, rateLimit: rl } = rateLimitViaSim(clock);
  await handlePrices(
    post(["NVDA", "GOOG"]),
    candidateDeps(hits, { rateLimit: rl, applyRateProposal: false }),
  );
  assertEquals(sim.calls.length, 0);
  assertEquals(hits.length >= 1, true);
});

Deno.test("candidato: errors no filtran FINNHUB_KEY", async () => {
  const hits: Hit[] = [];
  const secret = "sk-finnhub-SECRET";
  const res = await handlePrices(
    post(["ZZNOPE"]),
    candidateDeps(hits, {
      env: { FINNHUB_KEY: secret },
      fetch: (async () => {
        hits.push({ url: "x" });
        return new Response(JSON.stringify({ c: 0 }), { status: 200 });
      }) as typeof fetch,
    }),
  );
  const text = await res.text();
  assertEquals(text.includes(secret), false);
});

Deno.test("candidato: si Finnhub lanza, sleep del tier igual corre (finally)", async () => {
  const sleeps: number[] = [];
  const hits: Hit[] = [];
  await handlePrices(
    post(["NVDA"]),
    candidateDeps(hits, {
      sleep: async (ms) => { sleeps.push(ms); },
      fetch: (async (input) => {
        hits.push({ url: String(input) });
        if (String(input).includes("finnhub.io")) throw new Error("boom");
        return new Response(JSON.stringify({
          chart: { result: [{ meta: { regularMarketPrice: 1 } }] },
        }), { status: 200 });
      }) as typeof fetch,
    }),
  );
  assertEquals(sleeps.includes(PRICES_FINNHUB_PACE_MS), true);
});

Deno.test("fail-open: RPC error → checked:false y deja pasar (rateLimit real)", async () => {
  const verdict = await rateLimit({
    rpc: async () => ({ data: null, error: { code: "42P01", message: "missing" } }),
  }, "prices:u", 30, 600);
  assertEquals(verdict.ok, true);
  assertEquals(verdict.checked, false);
});

// ---- Gate con rateLimit REAL + RPC simulada (mutantes de args) ----

Deno.test("gate propuesta: rateLimit real respeta limit=1 (2º golpe bloquea)", async () => {
  const clock = { nowMs: 5_000_000 };
  const { sim, rateLimit: rl } = rateLimitViaSim(clock);
  const v1 = await applyPricesRateProposalGate(rl, "u1");
  const v2 = await applyPricesRateProposalGate(rl, "u1");
  // Con la propuesta limit=30 ambos pasarían; forzamos limit mutante vía llamada directa:
  const tight1 = await rl("prices:u1-tight", 1, 600);
  const tight2 = await rl("prices:u1-tight", 1, 600);
  assertEquals(v1.ok, true);
  assertEquals(v2.ok, true);
  assertEquals(tight1.ok, true);
  assertEquals(tight2.ok, false);
  assert(sim.calls.some((c) => c.limit === 1));
  assert(sim.calls.some((c) => c.limit === PRICES_RATE_PROPOSAL.limit));
});

Deno.test("guardián mutante: limit=999999 no bloquea donde limit=1 sí", async () => {
  const clock = { nowMs: 6_000_000 };
  const { rateLimit: rl } = rateLimitViaSim(clock);
  assertEquals((await rl("mut-lim", 1, 60)).ok, true);
  assertEquals((await rl("mut-lim", 1, 60)).ok, false);
  // Mismo reloj, otro bucket con límite enorme: debe seguir OK (si el mock ignora limit, fallaría).
  assertEquals((await rl("mut-lim-hi", 999999, 60)).ok, true);
  for (let i = 0; i < 50; i++) {
    assertEquals((await rl("mut-lim-hi", 999999, 60)).ok, true);
  }
});

Deno.test("guardián mutante: window=1 caduca; window enorme no", async () => {
  const clock = { nowMs: 7_000_000 };
  const { rateLimit: rl } = rateLimitViaSim(clock);
  assertEquals((await rl("win-a", 1, 1)).ok, true);
  assertEquals((await rl("win-a", 1, 1)).ok, false);
  clock.nowMs += 1001; // caduca ventana de 1s
  assertEquals((await rl("win-a", 1, 1)).ok, true);
  // Ventana 999999s: avanzar 2s no reinicia
  assertEquals((await rl("win-b", 1, 999999)).ok, true);
  assertEquals((await rl("win-b", 1, 999999)).ok, false);
  clock.nowMs += 2000;
  assertEquals((await rl("win-b", 1, 999999)).ok, false);
});

Deno.test("aislamiento por usuario: bucket prices:u1 ≠ prices:u2", async () => {
  const clock = { nowMs: 8_000_000 };
  const { sim, rateLimit: rl } = rateLimitViaSim(clock);
  for (let i = 0; i < PRICES_RATE_PROPOSAL.limit; i++) {
    assertEquals((await applyPricesRateProposalGate(rl, "u1")).ok, true);
  }
  assertEquals((await applyPricesRateProposalGate(rl, "u1")).ok, false);
  assertEquals((await applyPricesRateProposalGate(rl, "u2")).ok, true);
  assertEquals(pricesProposalBucket("u1"), "prices:u1");
  assert(sim.calls.every((c) => c.windowSecs === PRICES_RATE_PROPOSAL.windowSecs || c.bucket.startsWith("prices:")));
});

Deno.test("concurrencia: golpes paralelos al mismo bucket respetan el limit", async () => {
  const clock = { nowMs: 9_000_000 };
  const { rateLimit: rl } = rateLimitViaSim(clock);
  const LIMIT = 5;
  const verdicts = await Promise.all(
    Array.from({ length: 20 }, () => rl("conc-bucket", LIMIT, 60)),
  );
  const oks = verdicts.filter((v) => v.ok).length;
  assertEquals(oks, LIMIT);
});

Deno.test("candidato con propuesta ON: tras 30 req, la 31ª → 429 sin fetch nuevo", async () => {
  const hits: Hit[] = [];
  const clock = { nowMs: 10_000_000 };
  const { sim, rateLimit: rl } = rateLimitViaSim(clock);
  const deps = candidateDeps(hits, { rateLimit: rl, applyRateProposal: true });
  for (let i = 0; i < 30; i++) {
    assertEquals((await handlePrices(post(["NVDA"]), deps)).status, 200);
  }
  const before = hits.length;
  const blocked = await handlePrices(post(["NVDA"]), deps);
  assertEquals(blocked.status, 429);
  assertEquals(hits.length, before);
  assert(sim.calls.every((c) =>
    c.bucket === "prices:user-a" &&
    c.limit === 30 &&
    c.windowSecs === 600
  ));
});

Deno.test("guardián: un rateLimit falso que ignora args NO basta (detecta mentira)", async () => {
  // Si el test del gate usara este mock, el mutante limit=1 no bloquearía nunca.
  const lying = async () => ({ ok: true, checked: true });
  const a = await lying();
  const b = await lying();
  assertEquals(a.ok && b.ok, true); // el mentiroso siempre pasa…
  // …pero el gate real+sim con limit=1 SÍ bloquea el 2º:
  const clock = { nowMs: 11_000_000 };
  const { rateLimit: rl } = rateLimitViaSim(clock);
  assertEquals((await rl("lie-detect", 1, 60)).ok, true);
  assertEquals((await rl("lie-detect", 1, 60)).ok, false);
});

// ---- Base (8bb) vs candidato: misma reproducción ----

Deno.test("base vs candidato: fixture ancla SHA de main", () => {
  assertEquals(BASE_HANDLER_SHA, "8bb0398f9d16a848b984c989a6515e87937c815c");
});

Deno.test("ROJO base / VERDE candidato: auth y cuerpo", async () => {
  const fat = "A".repeat(PRICES_MAX_BODY + 80);
  const noAuth = new Request("https://example.test/prices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbols: ["NVDA"] }),
  });
  const tooBig = new Request("https://example.test/prices", {
    method: "POST",
    headers: {
      "Authorization": "Bearer fake",
      "Content-Type": "application/json",
      "content-length": String(PRICES_MAX_BODY + 1),
    },
    body: JSON.stringify({ symbols: [fat] }),
  });

  const baseHits: Hit[] = [];
  const baseDeps = {
    fetch: mockFetch(baseHits),
    env: { FINNHUB_KEY: "k" },
    sleep: async () => {},
    now: () => 1,
  };

  // BASE (8bb): sin auth en handler → 200 y gasta fetch; sin tope de content-length anunciado.
  const baseNoAuth = await handlePricesBase(noAuth.clone(), baseDeps);
  assertEquals(baseNoAuth.status, 200, "ROJO esperado en base: no exige Bearer");
  assert(baseHits.length >= 1, "ROJO base: fetch sin sesión");

  const baseBigHits: Hit[] = [];
  const baseBig = await handlePricesBase(tooBig.clone(), {
    ...baseDeps,
    fetch: mockFetch(baseBigHits),
  });
  // El anunciado content-length no se mira en base; puede acabar en 200 o error de parse, no 413.
  assert(baseBig.status !== 413, "ROJO base: no hay 413 por content-length");

  // CANDIDATO
  const candHits: Hit[] = [];
  assertEquals((await handlePrices(noAuth, candidateDeps(candHits))).status, 401);
  assertEquals(candHits.length, 0);
  assertEquals((await handlePrices(tooBig, candidateDeps([]))).status, 413);
});

Deno.test("ROJO base: N paralelas × M símbolos = N×M fetches (sin freno)", async () => {
  const hits: Hit[] = [];
  const deps = {
    fetch: mockFetch(hits),
    env: { FINNHUB_KEY: "k" },
    sleep: async () => {},
    now: () => 1,
  };
  const batch = Array.from({ length: 10 }, (_, i) => "B" + String(i).padStart(2, "0"));
  await Promise.all([
    handlePricesBase(post(batch), deps),
    handlePricesBase(post(batch), deps),
    handlePricesBase(post(batch), deps),
  ]);
  // Sin gate: 30 fetches. Esto es el hueco de presupuesto (evidencia, no contrato activo).
  assertEquals(hits.length, 30);
});

Deno.test("candidato defecto (propuesta OFF): no afirma cortar esas 30 fetches", async () => {
  // Documenta el límite de ESTA entrega: sin autorización no se activa 30/600.
  const hits: Hit[] = [];
  const batch = Array.from({ length: 10 }, (_, i) => "C" + String(i).padStart(2, "0"));
  const deps = candidateDeps(hits, { applyRateProposal: false });
  await Promise.all([
    handlePrices(post(batch), deps),
    handlePrices(post(batch), deps),
    handlePrices(post(batch), deps),
  ]);
  assertEquals(hits.length, 30);
});
