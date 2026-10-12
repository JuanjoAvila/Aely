import assert from "node:assert/strict";
import fs from "node:fs";
import { transformSync } from "esbuild";

// Convergencia del tramo antiguo contra el handler REAL (INC-2709-06, tercera ronda).
// El banco simulado es configurable porque las dos rondas anteriores solo aguantaban un
// banco que pagina de antiguo a nuevo y no falla: orden, tamaño de página, densidad por día
// y error por petición. La base de datos simulada persiste last_sync entre pulsaciones.
const root = new URL("../", import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), "utf8");
const shared = transformSync(read("supabase/functions/_shared/enablebanking.ts"), { loader: "ts", format: "esm" }).code;
const E = await import("data:text/javascript;base64," + Buffer.from(shared).toString("base64"));
const demandSrc = transformSync(read("supabase/functions/bank-sync/demand-window.ts"), { loader: "ts", format: "esm" }).code;
const demand = await import("data:text/javascript;base64," + Buffer.from(demandSrc).toString("base64"));
const src = demandSrc.replace(/^export /gm, "") + "\n" + transformSync(read("supabase/functions/bank-sync/index.ts").replace(/^import .*?;\r?\n/gm, ""), { loader: "ts" }).code;

const CAP = 12;
const MS = Date.parse("2026-10-10T12:00:00Z");
const NOW = new Date(MS).toISOString();
const WINDOW = "2026-09-23";   // día 1 del mes menos 8 días
const FLOOR = "2026-07-12";    // hoy menos 90 días

function addDays(ymd, n) {
  const p = ymd.split("-").map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10);
}
function span(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
const dayOf = (iso) => String(iso).slice(0, 10);

// 4 movimientos por día y un día con 130 (siete páginas): sin ese pico ningún trozo se
// corta por el tope y «un trozo a medias no cuenta» quedaría sin ejercitar.
const normal = (d) => (d === "2026-08-20" ? 130 : 4);

function banco({ order = "asc", page = 20, perDay = normal, uids = ["cx"] } = {}) {
  const rows = {};
  for (const uid of uids) {
    rows[uid] = [];
    for (const d of span("2026-06-01", "2026-10-10")) {
      for (let i = 0; i < perDay(d, uid); i++) {
        rows[uid].push({
          entry_reference: uid + "|" + d + "|" + i,
          booking_date: d,
          transaction_amount: { amount: "1.00" },
          credit_debit_indicator: "DBIT",
          creditor: { name: "Compra sintética" },
        });
      }
    }
  }
  const cursors = new Map();
  let seq = 0;
  const reply = (uid, q) => {
    const cont = q.get("continuation_key");
    let list, start = 0;
    if (cont) ({ list, start } = cursors.get(cont));
    else {
      const f = q.get("date_from"), t = q.get("date_to");
      list = rows[uid].filter((r) => (!f || r.booking_date >= f) && (!t || r.booking_date <= t));
      if (order === "desc") list = list.slice().reverse();
    }
    const out = { transactions: list.slice(start, start + page) };
    if (start + page < list.length) {
      const key = "k" + (++seq);
      cursors.set(key, { list, start: start + page });
      out.continuation_key = key;
    }
    return out;
  };
  return { rows, reply };
}

// bank_links con memoria: lo que escribe una pulsación lo lee la siguiente. `lt` es el
// filtro con el que el servidor impide que un cursor parcial pise uno más nuevo.
function baseDatos(links) {
  const events = [];
  const from = (name) => ({
    select: () => ({ eq: () => ({ in: async () => ({ data: links.map((l) => Object.assign({}, l)) }) }) }),
    update: (patch) => {
      const filters = [];
      const q = {
        eq(col, v) { filters.push((r) => r[col] === v); return q; },
        lt(col, v) { filters.push((r) => r[col] != null && Date.parse(r[col]) < Date.parse(v)); return q; },
        then(ok, ko) {
          links.forEach((l) => { if (filters.every((f) => f(l))) Object.assign(l, patch); });
          return Promise.resolve({}).then(ok, ko);
        },
      };
      return q;
    },
    insert: async (row) => { if (name === "app_events") events.push(row); return {}; },
  });
  return { links, events, client: { auth: { getUser: async () => ({ data: { user: { id: "synthetic" } } }) }, from } };
}

function reloj(ms) {
  const state = { ms };
  class FakeDate extends Date {
    constructor(...args) { super(...(args.length ? args : [state.ms])); }
    static now() { return state.ms; }
  }
  return { state, FakeDate };
}

// `fail(call)` devuelve un estado HTTP para esa petición, o nada. `after(call)` corre
// tras responderla: sirve para mover el reloj o simular otro móvil escribiendo a la vez.
async function pulsa(db, bank, { body = { recoverGaps: true }, fail = null, after = null, clock = reloj(MS) } = {}) {
  const calls = [];
  let handler;
  const api = async (jwt, p) => {
    const u = new URL(p, "https://bank.invalid");
    const uid = decodeURIComponent(u.pathname.split("/")[2]);
    if (u.pathname.endsWith("/balances")) {
      const st = fail && fail({ uid, balances: true });
      if (st) throw new Error("EB " + st);
      return { balances: [{ balance_type: "ITAV", balance_amount: { amount: "100", currency: "EUR" } }] };
    }
    const call = { uid, from: u.searchParams.get("date_from"), to: u.searchParams.get("date_to"), cont: u.searchParams.get("continuation_key"), longest: u.searchParams.get("strategy") === "longest", n: calls.length };
    calls.push(call);
    const st = fail && fail(call);
    if (st) throw new Error("EB " + st);
    const page = bank.reply(uid, u.searchParams);
    if (after) after(call, page);
    return page;
  };
  const names = ["Deno", "createClient", "ebApi", "ebConfig", "jsonResp", "makeJWT", "mapTransaction", "withCors", "fetchBankTransactions", "Date"];
  new Function(...names, src)(
    { serve: (f) => { handler = f; }, env: { get: () => "synthetic" } }, () => db.client, api, () => ({}),
    (x, status = 200) => new Response(JSON.stringify(x), { status }), async () => "jwt", E.mapTransaction, (f) => f,
    E.fetchBankTransactions, clock.FakeDate
  );
  const res = await handler(new Request("https://app.invalid", { method: "POST", body: JSON.stringify(body) }));
  assert.equal(res.status, 200);
  const perUid = {};
  calls.forEach((c) => { perUid[c.uid] = (perUid[c.uid] || 0) + 1; });
  return { data: await res.json(), calls, maxCalls: Math.max(0, ...Object.values(perUid)) };
}

function enlace(lastSync, uids = ["cx"]) {
  return { id: "L1", aspsp_name: "CaixaBank", status: "active", last_sync: lastSync, accounts: uids.map((uid) => ({ uid })) };
}
const haceDias = (n) => new Date(MS - n * 86400000).toISOString();

// Pulsa hasta que last_sync llega a «ahora» y devuelve qué faltó y qué se repitió.
async function converge({ gap, order = "asc", uids = ["cx"], perDay = normal, fail = null, maxPress = 60 }) {
  const bank = banco({ order, uids, perDay });
  const link = enlace(haceDias(gap), uids);
  const db = baseDatos([link]);
  const desde = dayOf(link.last_sync) < FLOOR ? FLOOR : dayOf(link.last_sync);
  const got = new Set(), oldSeen = new Map();
  let presses = 0, maxCalls = 0;
  while (presses < maxPress && link.last_sync !== NOW) {
    presses++;
    const before = Date.parse(link.last_sync);
    const r = await pulsa(db, bank, { fail: fail ? (c) => fail(c, presses) : null });
    maxCalls = Math.max(maxCalls, r.maxCalls);
    assert.ok(r.maxCalls <= CAP, "pulsación " + presses + ": " + r.maxCalls + " llamadas en una cuenta");
    assert.ok(Date.parse(link.last_sync) >= before, "pulsación " + presses + ": last_sync retrocede a " + link.last_sync);
    for (const acc of r.data.links[0].accounts) {
      const ids = (acc.transactions || []).map((x) => x.ext_id);
      assert.equal(new Set(ids).size, ids.length, "pulsación " + presses + ": fila repetida en la misma respuesta");
      for (const x of acc.transactions || []) {
        got.add(x.ext_id);
        if (x.date < WINDOW) oldSeen.set(x.ext_id, (oldSeen.get(x.ext_id) || 0) + 1);
      }
    }
  }
  assert.equal(link.last_sync, NOW, "sin converger tras " + presses + " pulsaciones (last_sync " + link.last_sync + ")");
  let missing = 0;
  for (const uid of uids) for (const row of bank.rows[uid]) if (row.booking_date >= desde && !got.has(row.entry_reference)) missing++;
  const dup = [...oldSeen.values()].filter((c) => c > 1).length;
  return { presses, maxCalls, missing, dup };
}

let failures = 0;
async function t(name, fn) {
  try { const extra = await fn(); console.log("  ✓ " + name + (extra ? " · " + extra : "")); }
  catch (e) { failures++; console.error("  ✗ " + name + ": " + e.message); }
}

console.log("bank-sync-progreso");

await t("el tope de llamadas por cuenta y pulsación está declarado", async () => {
  assert.equal(demand.OB_DEMAND_MAX_PAGES, CAP);
});

// (a) La lectura de siempre queda aislada del tramo antiguo.
for (const status of [429, 400, 401]) {
  await t("(a) un " + status + " solo en el tramo antiguo no toca saldo, movimientos ni enlace", async () => {
    const bank = banco();
    const link = enlace(haceDias(60));
    const db = baseDatos([link]);
    const sinTramo = (await pulsa(baseDatos([enlace(haceDias(60))]), bank, { body: {} })).data.links[0];
    for (let press = 1; press <= 3; press++) {
      const r = await pulsa(db, bank, { fail: (c) => (c.to ? status : 0) });
      const l = r.data.links[0], acc = l.accounts[0];
      assert.equal(l.ok, true);
      assert.equal(!!l.expired, false);
      assert.equal(acc.ok, true);
      assert.deepEqual(acc.balances, sinTramo.accounts[0].balances);
      assert.equal(acc.count, 72);
      assert.deepEqual(acc.transactions, sinTramo.accounts[0].transactions);
      assert.equal(!!acc.truncated, false);
      assert.equal(acc.transactionError, undefined);
      assert.equal(link.status, "active");
      assert.equal(link.last_sync, haceDias(60), "el cursor no avanza si el tramo falla");
      assert.equal(l.gapPending, true);
    }
  });
}

await t("(a) si lo reciente agota el plazo de la cuenta, el tramo no la tumba", async () => {
  const bank = banco();
  const link = enlace(haceDias(60));
  const db = baseDatos([link]);
  const clock = reloj(MS);
  // 16 s después de la última página reciente: el plazo de 15 s de la cuenta ya pasó.
  const r = await pulsa(db, bank, { clock, after: (c, page) => { if (!c.to && !page.continuation_key) clock.state.ms += 16000; } });
  const acc = r.data.links[0].accounts[0];
  assert.equal(acc.ok, true);
  assert.equal(acc.balances.length, 1);
  assert.equal(acc.transactions.filter((x) => x.date >= WINDOW).length, 72);
  assert.equal(link.status, "active");
});

// (b) y (d) Convergencia: el orden del banco no decide qué se pierde.
// Una pulsación sí y otra no, el banco rechaza UNA petición, cada vez en un sitio distinto
// (ventana o tramo). Con un fallo en todas las pulsaciones ni beta llegaría a «ahora».
const alterno = (c, press) => (press % 2 === 1 && c.n === (press * 3) % 11 ? 429 : 0);
for (const order of ["asc", "desc"]) {
  for (const gap of [15, 45, 60, 89, 120]) {
    for (const uids of [["cx"], ["cx", "cx2"]]) {
      for (const fail of [null, alterno]) {
        const name = "(d) " + order + " · hueco " + gap + " d · " + uids.length + " cuenta(s) · " + (fail ? "429 intermitente" : "sin errores");
        await t(name, async () => {
          const r = await converge({ gap, order, uids, fail });
          assert.equal(r.missing, 0, r.missing + " movimientos perdidos");
          assert.equal(r.dup, 0, r.dup + " movimientos antiguos entregados dos veces");
          return r.presses + " pulsaciones, máx " + r.maxCalls + " llamadas/cuenta";
        });
      }
    }
  }
}

// (c) El cursor es del enlace: espera a la cuenta más lenta.
await t("(c) dos cuentas, la segunda con 429 en la primera pulsación: no pierde su tramo", async () => {
  const r = await converge({ gap: 60, uids: ["cx", "cx2"], fail: (c, press) => (press === 1 && c.uid === "cx2" ? 429 : 0) });
  assert.equal(r.missing, 0, r.missing + " movimientos perdidos");
  assert.equal(r.dup, 0);
  return r.presses + " pulsaciones";
});

await t("(c) con una cuenta sin leer el cursor no se mueve y la otra no gasta llamadas en el tramo", async () => {
  const bank = banco({ uids: ["cx", "cx2"] });
  const link = enlace(haceDias(60), ["cx", "cx2"]);
  const db = baseDatos([link]);
  const r = await pulsa(db, bank, { fail: (c) => (c.uid === "cx2" ? 429 : 0) });
  assert.equal(link.last_sync, haceDias(60));
  assert.equal(r.calls.filter((c) => c.to).length, 0);
  assert.equal(r.data.links[0].accounts[0].ok, true);
  assert.equal(r.data.links[0].accounts[0].count, 72);
});

// Mucho volumen: 11 páginas de ventana dejan una sola llamada para el tramo.
const denso = (d) => (d >= WINDOW ? 12 : 4);
for (const order of ["asc", "desc"]) {
  await t("volumen " + order + ": con una llamada libre avanza un día por pulsación y termina", async () => {
    const bank = banco({ order, perDay: denso });
    const link = enlace(haceDias(40));
    const db = baseDatos([link]);
    const first = await pulsa(db, bank);
    assert.equal(first.calls.filter((c) => !c.to).length, 11);
    assert.equal(first.calls.filter((c) => c.to).length, 1);
    assert.equal(first.calls.find((c) => c.to).from, first.calls.find((c) => c.to).to, "un solo día");
    assert.ok(Date.parse(link.last_sync) > Date.parse(haceDias(40)), "la primera pulsación ya adelanta el cursor");
    const r = await converge({ gap: 40, order, perDay: denso });
    assert.equal(r.missing, 0);
    assert.equal(r.dup, 0);
    return r.presses + " pulsaciones, máx " + r.maxCalls + " llamadas/cuenta";
  });
}

await t("el reintento de periodo del tramo también cuenta: con una llamada libre no hay decimotercera", async () => {
  // El banco rechaza el periodo y el lector reintenta con `longest` sin contar página: sin
  // el tope al PEDIR, esa segunda petición sería la número 13 de la cuenta.
  const bank = banco({ perDay: denso });
  const link = enlace(haceDias(40));
  const r = await pulsa(baseDatos([link]), bank, { fail: (c) => (c.to && !c.longest ? "400 WRONG_TRANSACTIONS_PERIOD" : 0) });
  assert.equal(r.calls.filter((c) => !c.to).length, 11);
  assert.equal(r.maxCalls, CAP);
  assert.equal(link.last_sync, haceDias(40));
  assert.equal(r.data.links[0].accounts[0].ok, true);
  assert.equal(r.data.links[0].accounts[0].transactions.length, 216);
});

await t("un día que no cabe en las llamadas libres no se parte ni se da por leído", async () => {
  // Ventana de 10 páginas: quedan 2 llamadas. El día del último éxito tiene 50 movimientos (3 páginas).
  const perDay = (d) => (d >= WINDOW ? 11 : d === "2026-08-31" ? 50 : 4);
  const bank = banco({ perDay });
  const link = enlace(haceDias(40));
  const db = baseDatos([link]);
  for (let press = 1; press <= 2; press++) {
    const r = await pulsa(db, bank);
    assert.ok(r.maxCalls <= CAP);
    assert.equal(link.last_sync, haceDias(40), "un día a medias no adelanta el cursor");
    assert.equal(r.data.links[0].gapPending, true);
    assert.equal(r.data.links[0].accounts[0].transactions.some((x) => x.date < WINDOW), false, "un trozo a medias no se entrega");
    assert.equal(!!r.data.links[0].accounts[0].truncated, false, "la lectura reciente sigue completa");
  }
});

// Lo reciente no cabe en 12 llamadas: igual que beta, que sí adelanta last_sync.
const desbordado = (d) => (d >= WINDOW ? 15 : 4);
for (const last of [null, haceDias(15)]) {
  await t("ventana de 14 páginas " + (last ? "con último éxito dentro" : "sin último éxito") + ": parcial declarado y last_sync a ahora, como beta", async () => {
    const bank = banco({ perDay: desbordado });
    const link = enlace(last);
    const db = baseDatos([link]);
    for (const body of [{}, { recoverGaps: true }]) {
      link.last_sync = last;
      const r = await pulsa(db, bank, { body });
      const acc = r.data.links[0].accounts[0];
      assert.equal(r.calls.length, CAP);
      assert.equal(acc.ok, true);
      assert.equal(acc.truncated, true);
      assert.equal(acc.count, 240);
      assert.equal(link.last_sync, NOW);
      assert.equal(!!r.data.links[0].gapPending, false);
    }
  });
}

// Con hueco y la ventana desbordada no hay llamadas para el tramo, ni hoy ni en la siguiente
// pulsación: esperar sería quedarse atascado para siempre. Igual que beta, cliente viejo o nuevo.
for (const gap of [60, 120]) {
  await t("ventana desbordada con hueco de " + gap + " días: no se lee el tramo y last_sync sube a ahora, como beta", async () => {
    const bank = banco({ perDay: desbordado });
    for (const body of [{}, { recoverGaps: true }]) {
      const link = enlace(haceDias(gap));
      const r = await pulsa(baseDatos([link]), bank, { body });
      assert.equal(r.calls.length, CAP);
      assert.equal(r.calls.filter((c) => c.to).length, 0, "ni una llamada al tramo");
      assert.equal(link.last_sync, NOW);
      assert.equal(r.data.links[0].accounts[0].truncated, true, "el corte se declara");
      assert.equal(r.data.links[0].accounts[0].count, 240);
      assert.equal(!!r.data.links[0].gapPending, false);
    }
  });
}

await t("ventana que choca con el tope de 2000 filas antes que con el de llamadas: también es desbordar", async () => {
  const bank = banco({ page: 500, perDay: (d) => (d >= WINDOW ? 150 : 4) });
  const link = enlace(haceDias(60));
  const r = await pulsa(baseDatos([link]), bank);
  assert.equal(r.calls.length, 4);
  assert.equal(r.data.links[0].accounts[0].truncated, true);
  assert.equal(r.data.links[0].accounts[0].count, 2000);
  assert.equal(link.last_sync, NOW);
});

await t("el banco repite el cursor de página: eso no es desbordar y el cursor del tramo espera", async () => {
  const bank = banco();
  const link = enlace(haceDias(60));
  const ciclo = { reply: (uid, q) => (q.get("date_to") ? bank.reply(uid, q) : { transactions: bank.reply(uid, q).transactions, continuation_key: "igual" }) };
  const r = await pulsa(baseDatos([link]), ciclo);
  assert.equal(r.data.links[0].accounts[0].truncated, true);
  assert.equal(r.calls.filter((c) => c.to).length, 0);
  assert.equal(link.last_sync, haceDias(60));
  assert.equal(r.data.links[0].gapPending, true);
});

await t("dos cuentas y solo una desbordada: tampoco hay tramo posible y last_sync sube, como beta", async () => {
  const bank = banco({ uids: ["cx", "cx2"], perDay: (d, uid) => (uid === "cx2" ? desbordado(d) : 4) });
  const link = enlace(haceDias(60), ["cx", "cx2"]);
  const r = await pulsa(baseDatos([link]), bank);
  assert.ok(r.maxCalls <= CAP);
  assert.equal(r.calls.filter((c) => c.to).length, 0);
  assert.equal(link.last_sync, NOW);
  assert.equal(r.data.links[0].accounts[0].count, 72, "la cuenta ligera se lee entera");
});

await t("lo reciente cortado por un error a media paginación: sin tramo y sin cursor", async () => {
  const bank = banco();
  const link = enlace(haceDias(60));
  const db = baseDatos([link]);
  // Falla la tercera página de la ventana: quedan llamadas libres, pero lo reciente no está entero.
  const r = await pulsa(db, bank, { fail: (c) => (!c.to && c.n === 2 ? 503 : 0) });
  const acc = r.data.links[0].accounts[0];
  assert.equal(acc.ok, true);
  assert.equal(acc.truncated, true);
  assert.equal(acc.transactionError, "transactions_unavailable");
  assert.equal(r.calls.filter((c) => c.to).length, 0, "con lo reciente a medias no se gasta nada en el tramo");
  assert.equal(link.last_sync, haceDias(60));
});

await t("otro móvil termina mientras este va por el tramo: el cursor no retrocede", async () => {
  const bank = banco();
  const link = enlace(haceDias(89));
  const db = baseDatos([link]);
  // Tras la primera petición del tramo, otra sesión deja last_sync en «ahora».
  let done = false;
  await pulsa(db, bank, { after: (c) => { if (c.to && !done) { done = true; link.last_sync = NOW; } } });
  assert.equal(link.last_sync, NOW);
});

await t("más de 90 días: se pide desde el tope y se señala; con 89 no", async () => {
  const bank = banco();
  const lejos = enlace(haceDias(120));
  const r = await pulsa(baseDatos([lejos]), bank);
  assert.equal(r.data.links[0].gapBeyondCap, true);
  // El suelo del cliente va 3 días por debajo de lo pedido (N5); al banco se le pide desde el tope.
  assert.equal(r.data.links[0].syncFrom, addDays(FLOOR, -3));
  assert.equal(r.calls.filter((c) => c.to).every((c) => c.from >= FLOOR), true);
  const justo = enlace(haceDias(89));
  const r89 = await pulsa(baseDatos([justo]), bank);
  assert.equal(r89.data.links[0].gapBeyondCap, false);
  const r90 = await pulsa(baseDatos([enlace(haceDias(90))]), bank);
  assert.equal(r90.data.links[0].gapBeyondCap, false, "90 días justos caben en lo que entrega el banco");
  const r91 = await pulsa(baseDatos([enlace(haceDias(91))]), bank);
  assert.equal(r91.data.links[0].gapBeyondCap, true);
});

await t("el tramo se pide por trozos de fechas cerrados, del más antiguo al más nuevo y sin solaparse", async () => {
  const bank = banco({ order: "desc" });
  const link = enlace(haceDias(60));
  const r = await pulsa(baseDatos([link]), bank);
  const chunks = [];
  r.calls.filter((c) => c.to).forEach((c) => { if (!c.cont) chunks.push([c.from, c.to]); });
  assert.ok(chunks.length >= 2);
  assert.equal(chunks[0][0], "2026-08-11", "empieza en el día del último éxito");
  assert.equal(chunks[0][1], "2026-08-11", "y ese día va solo: es el que garantiza avanzar");
  const avance = chunks.filter((c) => c[0] >= "2026-08-11");
  for (let i = 1; i < avance.length; i++) assert.equal(avance[i][0], addDays(avance[i - 1][1], 1));
  assert.ok(chunks.every((c) => c[1] < WINDOW), "ningún trozo entra en la ventana de siempre");
  // Cortesía: los tres días anteriores, por si el banco contabilizó tarde. No mueven el cursor.
  assert.deepEqual(chunks.find((c) => c[0] < "2026-08-11"), ["2026-08-08", "2026-08-10"]);
  assert.equal(r.data.links[0].syncFrom, "2026-08-05", "3 días por debajo del primer día pedido");
});

await t("la hora del saldo viaja en la respuesta aunque el cursor vaya por detrás", async () => {
  const bank = banco();
  const link = enlace(haceDias(89));
  const db = baseDatos([link]);
  const r = await pulsa(db, bank);
  assert.notEqual(link.last_sync, NOW, "el hueco de 89 días no cabe en una pulsación");
  assert.equal(r.data.links[0].balanceAt, NOW);
  const caido = await pulsa(baseDatos([enlace(haceDias(2))]), bank, { fail: (c) => (c.balances ? 503 : 0) });
  assert.equal(caido.data.links[0].balanceAt, undefined, "sin saldo leído no hay hora que enseñar");
});

await t("la traza del sync lleva solo conteos, fechas y el nombre del banco", async () => {
  const bank = banco();
  const db = baseDatos([enlace(haceDias(60))]);
  await pulsa(db, bank);
  const ev = db.events.filter((e) => String(e.message || "").startsWith("OB sync"));
  assert.equal(ev.length, 1);
  assert.equal(ev[0].message, "OB sync (CaixaBank): ok");
  const detail = JSON.parse(ev[0].detail);
  assert.deepEqual(Object.keys(detail).sort(), ["accounts", "capped", "count", "dateFrom", "pages", "pending", "status", "truncated"]);
  for (const [k, v] of Object.entries(detail)) {
    if (k === "status") assert.match(v, /^(ok|empty|partial|error)$/);
    else if (k === "dateFrom") assert.match(v, /^\d{4}-\d{2}-\d{2}$/);
    else assert.ok(typeof v === "number" || typeof v === "boolean", k);
  }
  assert.equal(JSON.stringify(ev[0]).includes("cx|"), false);
});

// Matriz de versiones: el cliente viejo no manda recoverGaps.
await t("cliente viejo con hueco: no se lee el tramo y no se quema el cursor", async () => {
  const bank = banco();
  const link = enlace(haceDias(60));
  const r = await pulsa(baseDatos([link]), bank, { body: {} });
  assert.equal(r.calls.every((c) => c.from === WINDOW && !c.to), true);
  assert.equal(link.last_sync, haceDias(60));
  assert.equal(r.data.links[0].syncFrom, addDays(WINDOW, -3));
  assert.equal(!!r.data.links[0].gapPending, false, "al cliente viejo no se le anuncia nada que no vaya a pedir");
});

await t("cliente viejo o nuevo sin hueco: una lectura y last_sync a ahora", async () => {
  for (const body of [{}, { recoverGaps: true }]) {
    const bank = banco();
    const link = enlace(haceDias(15));
    const r = await pulsa(baseDatos([link]), bank, { body });
    assert.equal(r.calls.length, 4);
    assert.equal(r.calls.every((c) => c.from === WINDOW && !c.to), true);
    assert.equal(link.last_sync, NOW);
    assert.equal(r.data.links[0].gapBeyondCap, false);
  }
});

if (failures) process.exitCode = 1;
