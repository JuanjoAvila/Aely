import assert from "node:assert/strict";
import { CallbackFallo, codigoCallback, codigoNolink } from "../_shared/entrada.ts";
import { readInput } from "../_shared/request_body.ts";
import { keepsCursor } from "./reconnect.ts";

// Se ejecuta el texto TypeScript del handler real. Solo se sustituyen sus fronteras
// de SDK, proveedor, cifrado y runtime; no hay permisos de red, entorno ni servidor.
type Row = Record<string, any>;
type Ack = "normal" | "zero" | "error" | "lost" | "ambiguous" | "wrong-id" | "null";
const gate = () => {
  let release!: () => void;
  const promise = new Promise<void>((r) => release = r);
  return { promise, release };
};
function fixture(issued: string | null = new Date(Date.now() - 1000).toISOString(), app = false) {
  return {
    row: {
      id: "link-synthetic", user_id: "owner-synthetic", state: "state-A" + (app ? ".app" : ""),
      state_issued_at: issued, session_id: "session-before", status: "pending",
      account_uid: "account-before", iban: "ES0000000000000000000000",
      accounts: [{ uid: "account-before", iban: "ES0000000000000000000000", hash: "same-account", currency: "EUR" }],
      last_sync: "2026-10-01T00:00:00.000Z", balance_cents: 84260,
    } as Row,
    trace: [] as Row[], events: [] as Row[], calls: [] as Row[],
    ack: "normal" as Ack,
    beforeConsume: null as null | (() => void),
    beforeSave: null as null | (() => void),
    consumeAck: "normal" as Ack,
    exchange: null as null | (() => Promise<void>),
  };
}
let serial = 0;
async function start(f: ReturnType<typeof fixture>) {
  let handler!: (req: Request) => Promise<Response>;
  const requestState = f.row.state;
  const db = {
    from(table: string) {
      if (table === "app_events") return { insert: async (event: Row) => { f.events.push(event); return {}; } };
      assert.equal(table, "bank_links", "solo la tabla sintética autorizada");
      let patch: Row | undefined;
      const filters: [string, string, unknown][] = [];
      const perform = async (single = false) => {
        const final = !!patch && Object.hasOwn(patch, "session_id");
        if (patch) (final ? f.beforeSave : f.beforeConsume)?.();
        const matches = filters.every(([op, k, v]) => op === "is"
          ? f.row[k] === v : v != null && f.row[k] != null && f.row[k] === v);
        if (!patch) return { data: single ? (matches ? structuredClone(f.row) : null) : [], error: null };
        const ack = final ? f.ack : f.consumeAck;
        f.trace.push({ final, patch: structuredClone(patch), filters: structuredClone(filters), matches });
        if (ack === "zero") return { data: [], error: null };
        if (ack === "error") return { data: null, error: { code: "synthetic-update-failed" } };
        if (matches) Object.assign(f.row, structuredClone(patch));
        if (ack === "lost") return { data: null, error: { code: "synthetic-response-lost" } };
        if (ack === "null") return { data: null, error: null };
        const rows = !matches ? [] : ack === "ambiguous" ? [{ id: f.row.id }, { id: f.row.id }]
          : [{ id: ack === "wrong-id" ? "different-link" : f.row.id }];
        return { data: rows, error: null };
      };
      const q: any = {
        select: () => q,
        eq: (k: string, v: unknown) => { filters.push(["eq", k, v]); return q; },
        is: (k: string, v: unknown) => { filters.push(["is", k, v]); return q; },
        update: (v: Row) => { patch = v; return q; },
        maybeSingle: () => perform(true),
        then: (ok: any, fail: any) => perform().then(ok, fail),
      };
      return q;
    },
  };
  const mock = {
    Deno: { serve: (fn: typeof handler) => handler = fn,
      env: { get: (key: string) => key === "APP_URL" ? "https://app.invalid/" : "synthetic" } },
    createClient: () => db,
    ebConfig: () => ({}), makeJWT: async () => "synthetic-jwt",
    ebApi: async (_jwt: string, path: string, init: Row) => {
      f.calls.push({ path, method: init?.method });
      assert.equal(path, "/sessions"); assert.equal(init.method, "POST");
      if (f.exchange) await f.exchange();
      return { session_id: "session-A", accounts: [{ uid: "account-A",
        account_id: { iban: "ES0000000000000000000000" }, currency: "EUR", identification_hash: "same-account" }] };
    },
    encryptSessionId: async (id: string) => "synthetic-encrypted:" + id,
    CallbackFallo, codigoCallback, codigoNolink, keepsCursor, readInput,
    bucketKey: async () => "synthetic-bucket", callerIp: () => "synthetic-ip",
    rateLimit: async () => ({ ok: true }),
    console: { error: (..._args: unknown[]) => {} },
    fetch: () => { throw new Error("transporte no autorizado"); },
  };
  const key = "__callback_generation_" + serial++;
  (globalThis as any)[key] = mock;
  // Un módulo distinto por invocación conserva snapshots separados entre callbacks.
  const source = "const {" + Object.keys(mock).join(",") + "}=(globalThis as any)[" + JSON.stringify(key) + "];\n"
    + (await Deno.readTextFile(new URL("./index.ts", import.meta.url)))
      .replace(/^import .*?;\r?\n/gm, "");
  try {
    await import("data:application/typescript," + encodeURIComponent(source));
    return { pending: handler(new Request("https://callback.invalid/?code=synthetic-code&state=" + requestState)) };
  } finally { delete (globalThis as any)[key]; }
}
function reconnect(f: ReturnType<typeof fixture>, state: string | null, issued: string | null) {
  Object.assign(f.row, { state, state_issued_at: issued, session_id: "session-B", status: "pending",
    account_uid: "account-B", accounts: [{ uid: "account-B", hash: "new-account", currency: "EUR" }],
    last_sync: "2026-10-25T00:00:00.000Z", balance_cents: 79960 });
  return structuredClone(f.row);
}
function closed(response: Response, app = false) {
  assert.equal(response.status, 302);
  const location = new URL(response.headers.get("location")!);
  assert.equal(location.origin, "https://app.invalid");
  assert.equal(location.searchParams.get(app ? "ok" : "bank"), app ? null : "error");
  assert.equal(location.searchParams.get("msg"), "error");
}

// Oráculo causal: mientras A espera al proveedor, B reconecta la misma fila/owner.
// Se compara la generación B completa, no la presencia de un filtro en el código.
Deno.test("callback lento conserva reconexión B y no anuncia bank=ok", async () => {
  const f = fixture(), entered = gate(), resume = gate();
  f.exchange = async () => { entered.release(); await resume.promise; };
  const { pending } = await start(f);
  await Promise.race([entered.promise, pending.then(() => { throw Error("no llegó al canje"); })]);
  assert.equal(f.row.state, null, "A debe haber consumido su state antes del canje");
  const expected = reconnect(f, "state-B", new Date(Date.now() + 1000).toISOString());
  resume.release();
  const response = await pending;
  assert.deepEqual(f.row, expected, "A sobrescribió la generación B");
  closed(response);
  assert.equal(f.calls.length, 1); assert.equal(f.trace.filter(x => x.final).length, 1);
});

for (const legacy of [false, true]) for (const app of [false, true]) {
  Deno.test(`guardado normal conserva cursor y cuentas (${legacy ? "legacy null" : "emisión"}, ${app ? "APK" : "web"})`, async () => {
    const f = fixture(legacy ? null : undefined, app), before = structuredClone(f.row);
    const response = await (await start(f)).pending;
    assert.equal(response.status, 302);
    const location = new URL(response.headers.get("location")!);
    assert.equal(location.searchParams.get(app ? "ok" : "bank"), app ? "1" : "ok");
    assert.equal(f.row.session_id, "synthetic-encrypted:session-A");
    assert.equal(f.row.account_uid, "account-A"); assert.equal(f.row.status, "active");
    assert.equal(f.row.state, null); assert.equal(f.row.state_issued_at, before.state_issued_at);
    assert.equal(f.row.last_sync, before.last_sync); assert.equal(f.row.balance_cents, 84260);
    assert.equal(f.trace.length, 2); assert.equal(f.calls.length, 1);
  });
}
for (const kind of ["state-only", "emission-only", "legacy-new-emission", "owner-only"]) {
  Deno.test("guardado atómico respeta cambio intermedio " + kind, async () => {
    const f = fixture(kind === "legacy-new-emission" ? null : undefined);
    let expected: Row;
    f.beforeSave = () => {
      if (kind === "state-only") f.row.state = "state-B";
      else if (kind === "owner-only") f.row.user_id = "new-owner";
      else f.row.state_issued_at = new Date(Date.now() + 1000).toISOString();
      expected = structuredClone(f.row);
    };
    closed(await (await start(f)).pending);
    assert.deepEqual(f.row, expected!); assert.equal(f.calls.length, 1);
  });
}
for (const ack of ["zero", "error", "lost", "ambiguous", "wrong-id", "null"] as Ack[]) {
  Deno.test("acuse final " + ack + " cierra sin éxito ni reintento", async () => {
    const f = fixture(); f.ack = ack;
    closed(await (await start(f)).pending);
    assert.equal(f.row.state, null); assert.equal(f.calls.length, 1);
    assert.equal(f.trace.filter(x => x.final).length, 1);
  });
}
for (const ack of ["zero", "error", "lost", "ambiguous"] as Ack[]) {
  Deno.test("consumo " + ack + " mantiene guardas previas sin canje", async () => {
    const f = fixture(); f.consumeAck = ack;
    closed(await (await start(f)).pending);
    assert.equal(f.calls.length, 0); assert.equal(f.trace.filter(x => x.final).length, 0);
  });
}
Deno.test("reconexión previa al consumo queda intacta y no canjea", async () => {
  const f = fixture(); let expected: Row;
  f.beforeConsume = () => { expected = reconnect(f, "state-B", new Date(Date.now() + 1000).toISOString()); };
  closed(await (await start(f)).pending);
  assert.deepEqual(f.row, expected!); assert.equal(f.calls.length, 0);
});
