import assert from "node:assert/strict";
import { type BrokerDeps, brokerConnectHandler, brokerDisconnectHandler, brokerSyncHandler } from "./handlers.ts";

/* broker-connect / -sync / -disconnect con el código REAL de los handlers y las fronteras dobladas
   (Auth, BD, cifrado, bróker). Credenciales SINTÉTICAS: lo que se comprueba es que nunca salgan
   donde no deben (BD en claro, consola, respuesta) y que lo que puede mover dinero no se guarde. */

const TOKEN = "123456789012345678901234", QID = "987654";
const KEY = "SINTETICAPUBLICKEY0000000000000000000000000000000000000", SECRET = btoa("x".repeat(64));
const XML = `<FlexQueryResponse queryName="q" type="AF"><FlexStatements count="1"><FlexStatement accountId="U0000000" toDate="2026-11-18"><OpenPositions><OpenPosition accountId="U0000000" symbol="VWCE" isin="IE00BK5BQT80" position="10" markPrice="100" positionValue="1000" currency="EUR" assetCategory="STK"/></OpenPositions></FlexStatement></FlexStatements></FlexQueryResponse>`;
const okSend = `<FlexStatementResponse><Status>Success</Status><ReferenceCode>555</ReferenceCode></FlexStatementResponse>`;
const fail = (c: string) => `<FlexStatementResponse><Status>Fail</Status><ErrorCode>${c}</ErrorCode></FlexStatementResponse>`;

type Row = Record<string, unknown>;
function montar(opts: { keyReady?: boolean; perms?: string[]; ibkr?: string[]; row?: Row | null; user?: boolean; rate?: boolean } = {}) {
  const writes: { op: string; table: string; payload?: Row; filters: unknown[] }[] = [];
  const logs: string[] = [];
  const fetched: string[] = [];
  const ibkr = (opts.ibkr || [okSend, XML]).slice();
  let nonceDb = 0;
  const admin = {
    rpc: async (name: string) => {
      if (name !== "broker_next_nonce") throw new Error("rpc inesperada " + name);
      nonceDb += 1; return { data: String(1_700_000_000_000_000 + nonceDb), error: null };
    },
    from(table: string) {
      const filters: unknown[] = [];
      let op = "select", payload: Row | undefined;
      const q: Record<string, unknown> = {
        select: () => q, eq: (k: string, v: unknown) => { filters.push([k, v]); return q; },
        upsert: (p: Row) => { op = "upsert"; payload = p; return q; },
        update: (p: Row) => { op = "update"; payload = p; return q; },
        delete: () => { op = "delete"; return q; },
        maybeSingle: async () => ({ data: opts.row === undefined ? null : opts.row, error: null }),
        then: (ok: (v: unknown) => unknown) => { writes.push({ op, table, payload, filters }); return Promise.resolve({ error: null }).then(ok); },
      };
      return q;
    },
  };
  const deps: BrokerDeps = {
    userOf: async () => opts.user === false ? null : { id: "u-sintetico" },
    admin,
    fetch: async (url: string) => {
      fetched.push(url);
      if (url.includes("interactivebrokers.com")) return new Response(ibkr.shift() ?? fail("1001"));
      if (url.endsWith("/GetApiKeyInfo")) return Response.json({ error: [], result: { permissions: opts.perms || ["query-funds"], ip_allowlist: [], valid_until: "0" } });
      if (url.endsWith("/BalanceEx")) return Response.json({ error: [], result: { XXBT: { balance: "0.2" }, ZEUR: { balance: "3" } } });
      if (url.includes("/AssetPairs")) return Response.json({ error: [], result: { XXBTZEUR: { base: "XXBT", quote: "ZEUR" } } });
      if (url.includes("/Ticker")) return Response.json({ error: [], result: { XXBTZEUR: { c: ["50000", "1"] } } });
      throw new Error("red inesperada " + url);
    },
    sleep: async () => {},
    encrypt: async (s: string) => opts.keyReady === false ? s : "enc:v1:" + btoa(s.split("").reverse().join("")),
    decrypt: async (s: string | null) => s && s.startsWith("enc:v1:") ? atob(s.slice(7)).split("").reverse().join("") : s,
    keyReady: async () => opts.keyReady !== false,
    rateLimit: async () => ({ ok: opts.rate !== false }),
    now: () => Date.UTC(2026, 10, 19, 10, 0, 0),
    uuid: () => "v-nueva",
    log: (l: string) => logs.push(l),
  };
  const req = (body: unknown) => new Request("https://edge.invalid/", { method: "POST", body: JSON.stringify(body) });
  return { deps, writes, logs, fetched, req, connect: brokerConnectHandler(deps), sync: brokerSyncHandler(deps), disconnect: brokerDisconnectHandler(deps) };
}
const nada = (s: string, ...secretos: string[]) => secretos.forEach((x) => assert.ok(!s.includes(x), "fuga de credencial: " + s.slice(0, 120)));

Deno.test("connect IBKR: valida contra el bróker, guarda CIFRADO y devuelve el primer informe", async () => {
  const m = montar();
  const r = await m.connect(m.req({ broker: "ibkr", a: TOKEN, b: QID }));
  const j = await r.json();
  assert.equal(r.status, 200);
  assert.equal(j.ok, true); assert.equal(j.sync.flexXml, XML); assert.equal(j.sync.asOf, "2026-11-18"); assert.equal(j.sync.snapshot, true);
  const up = m.writes.find((w) => w.op === "upsert")!;
  assert.equal(up.table, "broker_links");
  assert.match(String(up.payload!.cred_a), /^enc:v1:/); assert.match(String(up.payload!.cred_b), /^enc:v1:/);
  nada(JSON.stringify(up.payload), TOKEN);
  assert.equal(up.payload!.status, "active");
  nada(m.logs.join("\n") + JSON.stringify({ ...j, sync: { ...j.sync, flexXml: "" } }), TOKEN, QID);
});

Deno.test("connect sin clave de cifrado: ni se llama al bróker ni se guarda nada", async () => {
  const m = montar({ keyReady: false });
  const r = await m.connect(m.req({ broker: "kraken", a: KEY, b: SECRET }));
  assert.equal(r.status, 503);
  assert.equal((await r.json()).code, "no_key");
  assert.deepEqual(m.fetched, []); assert.deepEqual(m.writes, []);
});

Deno.test("connect: si el cifrado devuelve texto en claro (clave perdida a mitad), no se guarda", async () => {
  const m = montar();
  m.deps.encrypt = async (s: string) => s;
  const r = await m.connect(m.req({ broker: "ibkr", a: TOKEN, b: QID }));
  assert.equal((await r.json()).code, "no_key");
  assert.equal(m.writes.length, 0);
});

Deno.test("connect Kraken: clave que puede retirar u operar → rechazada y SIN guardar", async () => {
  for (const p of ["withdraw-funds", "modify-trades", "close-trades", "add-funds", "earn-funds", "add-withdraw-address", "update-withdraw-address"]) {
    const m = montar({ perms: ["query-funds", p] });
    const j = await (await m.connect(m.req({ broker: "kraken", a: KEY, b: SECRET }))).json();
    assert.deepEqual([j.ok, j.rejected, j.code, j.perm], [false, true, "kraken_perm", p]);
    assert.equal(m.writes.length, 0, p);
    assert.ok(!m.fetched.some((u) => u.endsWith("/BalanceEx")), "ni se leen los saldos");
  }
  const sinFondos = montar({ perms: ["query-ledger"] });
  assert.equal((await (await sinFondos.connect(sinFondos.req({ broker: "kraken", a: KEY, b: SECRET }))).json()).code, "kraken_no_funds");
  assert.equal(sinFondos.writes.length, 0);
});

Deno.test("connect Kraken de solo lectura: guarda cifrado, nonce creciente y saldos con precio", async () => {
  const m = montar();
  const j = await (await m.connect(m.req({ broker: "kraken", a: KEY, b: SECRET }))).json();
  assert.equal(j.ok, true);
  assert.equal(j.sync.positions[0].key, "BTC"); assert.equal(j.sync.positions[0].valueHint, 10000);
  assert.equal(j.sync.positions[0].cost, null);
  const up = m.writes.find((w) => w.op === "upsert")!;
  assert.match(String(up.payload!.cred_b), /^enc:v1:/);
  nada(JSON.stringify(up.payload) + m.logs.join("\n") + JSON.stringify(j), SECRET, KEY);
  assert.equal(up.payload!.nonce, Date.UTC(2026, 10, 19, 10, 0, 0) * 1000 + 1, "el último nonce usado queda en la fila");
});

Deno.test("connect: errores con nombre de IBKR, sin guardar", async () => {
  for (const c of ["1012", "1015", "1014", "1018"]) {
    const m = montar({ ibkr: [fail(c)] });
    assert.equal((await (await m.connect(m.req({ broker: "ibkr", a: TOKEN, b: QID }))).json()).code, "flex_" + c);
    assert.equal(m.writes.length, 0);
  }
  const sinSeccion = montar({ ibkr: [okSend, XML.replace(/<OpenPositions>.*<\/OpenPositions>/, "")] });
  assert.equal((await (await sinSeccion.connect(sinSeccion.req({ broker: "ibkr", a: TOKEN, b: QID }))).json()).code, "flex_no_positions");
});

Deno.test("entrada inválida, sin sesión o con el freno agotado: ningún efecto", async () => {
  for (const body of [{ broker: "binance", a: KEY, b: SECRET }, { broker: "ibkr", a: TOKEN, b: "no-numero" }, { broker: "kraken", a: KEY }, { broker: "kraken", a: KEY, b: SECRET, extra: 1 }, { broker: "kraken", a: "<script>", b: SECRET }]) {
    const m = montar();
    assert.equal((await m.connect(m.req(body))).status, 400, JSON.stringify(body));
    assert.deepEqual(m.fetched, []); assert.deepEqual(m.writes, []);
  }
  const anon = montar({ user: false });
  assert.equal((await anon.connect(anon.req({ broker: "ibkr", a: TOKEN, b: QID }))).status, 401);
  assert.equal((await anon.sync(anon.req({ broker: "ibkr" }))).status, 401);
  const frenado = montar({ rate: false });
  assert.equal((await frenado.connect(frenado.req({ broker: "ibkr", a: TOKEN, b: QID }))).status, 429);
  assert.deepEqual(frenado.fetched, []);
});

const fila = (broker: string, a: string, b: string): Row => ({
  broker, cred_a: "enc:v1:" + btoa(a.split("").reverse().join("")), cred_b: "enc:v1:" + btoa(b.split("").reverse().join("")),
  status: "active", connection_version: "v-vieja", meta: {},
});

Deno.test("sync IBKR: devuelve el XML sin escribir posiciones; 1012 caduca SOLO la misma conexión", async () => {
  const m = montar({ row: fila("ibkr", TOKEN, QID) });
  const j = await (await m.sync(m.req({ broker: "ibkr", userInitiated: true }))).json();
  assert.equal(j.ok, true); assert.equal(j.flexXml, XML);
  assert.ok(m.writes.every((w) => w.table === "broker_links" && w.op === "update"), "solo el estado de la fila");
  const caducado = montar({ row: fila("ibkr", TOKEN, QID), ibkr: [fail("1012")] });
  const k = await (await caducado.sync(caducado.req({ broker: "ibkr" }))).json();
  assert.deepEqual([k.ok, k.authExpired, k.code], [false, true, "flex_1012"]);
  const up = caducado.writes.find((w) => w.op === "update")!;
  assert.equal(up.payload!.status, "expired");
  assert.ok(up.filters.some((f) => JSON.stringify(f) === JSON.stringify(["connection_version", "v-vieja"])), "CAS por versión de conexión");
  // 1018 (demasiadas) no es caducidad: el enlace sigue activo.
  const lento = montar({ row: fila("ibkr", TOKEN, QID), ibkr: [fail("1018")] });
  const l = await (await lento.sync(lento.req({ broker: "ibkr" }))).json();
  assert.equal(l.authExpired, undefined);
  assert.equal(lento.writes[0].payload!.status, undefined);
});

Deno.test("sync Kraken: nonce de la BD y, si la clave ganó permisos de operar, se BORRA la credencial", async () => {
  const m = montar({ row: fila("kraken", KEY, SECRET) });
  const j = await (await m.sync(m.req({ broker: "kraken" }))).json();
  assert.equal(j.ok, true); assert.equal(j.positions[0].sym, "BTC"); assert.deepEqual(j.cash, [{ cur: "EUR", amt: 3 }]);
  const peligrosa = montar({ row: fila("kraken", KEY, SECRET), perms: ["query-funds", "withdraw-funds"] });
  const k = await (await peligrosa.sync(peligrosa.req({ broker: "kraken" }))).json();
  assert.deepEqual([k.ok, k.rejected, k.code], [false, true, "kraken_perm"]);
  const up = peligrosa.writes.find((w) => w.op === "update")!;
  assert.deepEqual([up.payload!.status, up.payload!.cred_a, up.payload!.cred_b], ["rejected", null, null]);
  assert.ok(!peligrosa.fetched.some((u) => u.endsWith("/BalanceEx")));
  nada(peligrosa.logs.join("\n") + JSON.stringify(k), SECRET, KEY);
});

Deno.test("sync sin enlace o con enlace caducado: no llama al bróker", async () => {
  const m = montar({ row: null });
  assert.equal((await (await m.sync(m.req({ broker: "kraken" }))).json()).code, "not_linked");
  const exp = montar({ row: { ...fila("ibkr", TOKEN, QID), status: "expired" } });
  assert.equal((await (await exp.sync(exp.req({ broker: "ibkr" }))).json()).authExpired, true);
  assert.deepEqual([...m.fetched, ...exp.fetched], []);
});

Deno.test("disconnect borra solo la fila de ese bróker y de ese usuario", async () => {
  const m = montar();
  assert.equal((await (await m.disconnect(m.req({ broker: "kraken" }))).json()).ok, true);
  assert.deepEqual(m.writes.map((w) => [w.op, w.table, w.filters]), [["delete", "broker_links", [["user_id", "u-sintetico"], ["broker", "kraken"]]]]);
  assert.equal((await m.disconnect(m.req({ broker: "kraken", extra: 1 }))).status, 400);
});

Deno.test("ningún console.* de las tres funciones imprime credenciales ni cuerpos", async () => {
  // El único registro es `deps.log` con códigos cerrados: el texto de cada llamada lo dice.
  for (const f of ["../../broker-connect/index.ts", "../../broker-sync/index.ts", "../../broker-disconnect/index.ts", "./handlers.ts", "./ibkr.ts", "./kraken.ts"]) {
    const src = await Deno.readTextFile(new URL(f, import.meta.url));
    const consolas = src.match(/console\.\w+\([^)]*\)/g) || [];
    for (const c of consolas) assert.match(c, /^console\.error\(line\)$/, f + ": " + c);
    // Lo que va al registro, quitados los textos fijos: solo códigos cerrados.
    for (const l of src.match(/deps\.log\([^;]*?\);/g) || []) {
      const vars = l.slice("deps.log(".length, -2).replace(/"[^"]*"/g, "").split("+").map((s) => s.trim()).filter(Boolean);
      for (const v of vars) assert.ok(/^(got|chk|info|v|snap)\.code$/.test(v), f + ": " + l);
    }
  }
});
