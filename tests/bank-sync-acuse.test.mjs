import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import vm from "node:vm";
import { transformSync } from "esbuild";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

// Acuse del cursor (N2) y banco que filtra por fecha valor (N5), de punta a punta: el handler
// REAL de bank-sync contra el importador REAL del cliente. `bank-sync-progreso` mira qué
// entrega el servidor; aquí se mira qué acaba GUARDADO en el móvil, que es donde se perdía:
// una respuesta que no llega, o un movimiento que llega y el cliente tira por su fecha.
// Todo es sintético y relativo al reloj del test, porque el importador usa el reloj de verdad.
const root = new URL("../", import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), "utf8");
const ts = (code) => transformSync(code, { loader: "ts", format: "esm" }).code;
const E = await import("data:text/javascript;base64," + Buffer.from(ts(read("supabase/functions/_shared/enablebanking.ts"))).toString("base64"));
const handlerSrc = (index, demand) => ts(demand).replace(/^export /gm, "") + "\n" + transformSync(index.replace(/^import .*?;\r?\n/gm, ""), { loader: "ts" }).code;
const NUEVA = handlerSrc(read("supabase/functions/bank-sync/index.ts"), read("supabase/functions/bank-sync/demand-window.ts"));
// La función que hay desplegada mientras el cliente nuevo llega a los móviles: no conoce
// `acks` ni devuelve `ack`. Se lee del commit del que salió, no de una copia.
const DESPLEGADA = "9a728812";
const gitShow = (p) => execFileSync("git", ["show", DESPLEGADA + ":" + p], { encoding: "utf8", maxBuffer: 5e6 });
const VIEJA = handlerSrc(gitShow("supabase/functions/bank-sync/index.ts"), gitShow("supabase/functions/bank-sync/demand-window.ts"));

const ctx = loadPureLogicFromFile();
const main = read("src/modules/11-app-main.js");

const CAP = 12;
const MS = Date.now();
const NOW = new Date(MS).toISOString();
const DAY = 86400000;
const day = (n) => new Date(MS + n * DAY).toISOString().slice(0, 10);
const addDays = (ymd, n) => new Date(Date.parse(ymd) + n * DAY).toISOString().slice(0, 10);
const hoy = new Date(MS);
const WINDOW = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1) - 8 * DAY).toISOString().slice(0, 10);
const FLOOR = day(-90);
const haceDias = (n) => new Date(MS - n * DAY).toISOString();

// Banco sintético. `skew` son los días que la fecha valor va por DETRÁS de la contable, y
// `filter` la fecha por la que el banco aplica date_from/date_to. La app pinta la contable.
// Cada fila lleva un importe distinto: el importador también deduplica por día+importe+nombre.
function banco({ skew = 0, filter = "booking_date", uids = ["cx"], page = 20 } = {}) {
  const rows = {};
  let n = 0;
  for (const uid of uids) {
    rows[uid] = [];
    for (let d = -125; d <= 0; d++) {
      // Un día de tres páginas: hace que algún trozo se corte por el tope de llamadas. No más,
      // porque un día que no cabe en las llamadas libres deja el cursor quieto para siempre
      // (`bank-sync-progreso` lo fija) y la ventana, según el día del mes, se lleva hasta 9.
      const count = d === -51 ? 50 : 4;
      for (let i = 0; i < count; i++) {
        n++;
        rows[uid].push({
          entry_reference: uid + "|" + day(d) + "|" + i,
          booking_date: day(d), value_date: day(d + skew), status: "BOOK",
          transaction_amount: { amount: (1 + n / 100).toFixed(2) },
          credit_debit_indicator: "DBIT",
          creditor: { name: "Compra sintética " + n },
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
      list = rows[uid].filter((r) => (!f || r[filter] >= f) && (!t || r[filter] <= t));
    }
    const out = { transactions: list.slice(start, start + page) };
    if (start + page < list.length) {
      const key = "k" + (++seq);
      cursors.set(key, { list, start: start + page });
      out.continuation_key = key;
    }
    return out;
  };
  return { rows, reply, filter, all: uids.flatMap((u) => rows[u]) };
}

// bank_links con memoria. `lt` y `is` son los dos filtros con los que el servidor escribe
// el cursor: `lt` no casa con null, como en Postgres.
function baseDatos(link) {
  const from = () => ({
    select: () => ({ eq: () => ({ in: async () => ({ data: [Object.assign({}, link)] }) }) }),
    update: (patch) => {
      const filters = [];
      const q = {
        eq(col, v) { filters.push((r) => r[col] === v); return q; },
        lt(col, v) { filters.push((r) => r[col] != null && Date.parse(r[col]) < Date.parse(v)); return q; },
        is(col, v) { filters.push((r) => (r[col] == null ? null : r[col]) === v); return q; },
        then(ok, ko) {
          if (filters.every((f) => f(link))) Object.assign(link, patch);
          return Promise.resolve({}).then(ok, ko);
        },
      };
      return q;
    },
    insert: async () => ({}),
  });
  return { auth: { getUser: async () => ({ data: { user: { id: "synthetic" } } }) }, from };
}

class FakeDate extends Date {
  constructor(...args) { super(...(args.length ? args : [MS])); }
  static now() { return MS; }
}

async function llama(src, link, bank, body, fail) {
  const calls = [];
  let handler;
  const api = async (jwt, p) => {
    const u = new URL(p, "https://bank.invalid");
    const uid = decodeURIComponent(u.pathname.split("/")[2]);
    if (u.pathname.endsWith("/balances")) return { balances: [{ balance_type: "ITAV", balance_amount: { amount: "100", currency: "EUR" } }] };
    const call = { uid, from: u.searchParams.get("date_from"), to: u.searchParams.get("date_to"), n: calls.length };
    calls.push(call);
    if (fail && fail(call)) throw new Error("EB 429");
    return bank.reply(uid, u.searchParams);
  };
  const names = ["Deno", "createClient", "ebApi", "ebConfig", "jsonResp", "makeJWT", "mapTransaction", "withCors", "fetchBankTransactions", "Date"];
  new Function(...names, src)(
    { serve: (f) => { handler = f; }, env: { get: () => "synthetic" } }, () => baseDatos(link), api, () => ({}),
    (x, status = 200) => new Response(JSON.stringify(x), { status }), async () => "jwt", E.mapTransaction, (f) => f,
    E.fetchBankTransactions, FakeDate
  );
  const res = await handler(new Request("https://app.invalid", { method: "POST", body: JSON.stringify(body) }));
  assert.equal(res.status, 200);
  const perUid = {};
  calls.forEach((c) => { perUid[c.uid] = (perUid[c.uid] || 0) + 1; });
  assert.ok(Math.max(0, ...Object.values(perUid)) <= CAP, "más de " + CAP + " llamadas en una cuenta");
  return { data: JSON.parse(JSON.stringify(await res.json())), calls };
}

function enlace(lastSync, uids = ["cx"]) {
  return { id: "L1", aspsp_name: "CaixaBank", status: "active", last_sync: lastSync, accounts: uids.map((uid) => ({ uid })) };
}

// EL CLIENTE. Las tres piezas se sacan de `runBankSync` tal como están escritas: el cuerpo
// de la petición, la importación y el guardado del acuse. Si alguna deja de mandar o de
// guardar el acuse, estos tests lo ven; no hay una copia aquí que pueda quedarse atrás.
const mBody = main.match(/cloud\.bankSync\((\{recoverGaps:true[^;]*?\})\), pDb\]/);
const mImport = main.match(/const txs=flattenBankTx\(links\);[\s\S]*?const add=importObExpenses\([^;]*\);/);
const mAck = main.match(/const ack=Object\.assign\(\{\},prev\.obAck\);\s*links\.forEach\(function\(l\)\{[^}]*\}\);/);
assert.ok(mBody && mImport && mAck, "no se encuentran las piezas del cliente en runBankSync");
const cuerpoNuevo = new Function("stateRef", "return " + mBody[1] + ";");
const importa = new Function("flattenBankTx", "importObExpenses", "prev", "links", mImport[0] + " return add;");
const guardaAcuse = new Function("prev", "links", mAck[0] + " return ack;");

function movil() {
  return {
    accounts: [{ id: "cx", ent: "caixabank", role: "diario", value: 400 }],
    settings: { expenseBanks: ["caixabank"] },
    fixed: [], debts: [], oneoffs: [], flows: [], deleted: [], expenses: [], investments: [], bankTx: [],
  };
}
// `nuevo`: manda y guarda acuse. `beta116`: pide el tramo pero no acusa. `prod`: ni lo pide.
const CLIENTES = {
  nuevo: (state) => cuerpoNuevo({ current: state }),
  beta116: () => ({ recoverGaps: true }),
  prod: () => ({}),
};
function recibe(state, links, tipo) {
  // El cliente de producción no pasa la respuesta al importador: no conoce el suelo.
  const add = (tipo === "prod" ? ctx.importObExpenses(state, ctx.flattenBankTx(links)) : importa(ctx.flattenBankTx, ctx.importObExpenses, state, links)) || [];
  state.expenses = add.concat(state.expenses);
  if (tipo === "nuevo") state.obAck = guardaAcuse(state, links);
}

// Pulsa hasta que el servidor dice que no queda tramo y el cursor llega a «ahora». `pierde`
// son las pulsaciones cuya respuesta no llega al móvil: el servidor trabaja igual.
async function converge({ src = NUEVA, tipo = "nuevo", gap = 89, skew = 0, filter = "booking_date", uids = ["cx"], pierde = [], fail = null, maxPress = 80, page = 20 }) {
  const bank = banco({ skew, filter, uids, page });
  const link = enlace(haceDias(gap), uids);
  const state = movil();
  const desde = link.last_sync.slice(0, 10) < FLOOR ? FLOOR : link.last_sync.slice(0, 10);
  let presses = 0, retrocede = false;
  while (presses < maxPress && link.last_sync !== NOW) {
    presses++;
    const before = Date.parse(link.last_sync);
    const r = await llama(src, link, bank, CLIENTES[tipo](state), fail ? (c) => fail(c, presses) : null);
    if (Date.parse(link.last_sync) < before) retrocede = true;
    if (!pierde.includes(presses)) recibe(state, r.data.links, tipo);
  }
  assert.equal(retrocede, false, "last_sync retrocedió");
  assert.equal(link.last_sync, NOW, "sin converger tras " + presses + " pulsaciones (last_sync " + link.last_sync + ")");
  const ids = state.expenses.map((e) => e.extId);
  const got = new Set(ids);
  const debe = bank.all.filter((r) => r[bank.filter] >= desde);
  const reales = new Set(bank.all.map((r) => r.entry_reference));
  return {
    presses, state, link, bank,
    debe: debe.length,
    missing: debe.filter((r) => !got.has(r.entry_reference)).length,
    dup: ids.length - got.size,
    inventados: ids.filter((id) => !reales.has(id)).length,
    fechaMal: state.expenses.filter((e) => String(e.date).slice(0, 10) !== String(e.extId).split("|")[1]).length,
  };
}
function limpio(r, min = 250) {
  assert.ok(r.debe > min, "el escenario tiene que tener tramo que recuperar (" + r.debe + ")");
  assert.equal(r.missing, 0, r.missing + " movimientos perdidos de " + r.debe);
  assert.equal(r.dup, 0, r.dup + " movimientos guardados dos veces");
  assert.equal(r.inventados, 0);
  assert.equal(r.fechaMal, 0, "cada movimiento se guarda con su fecha contable");
  return r.presses + " pulsaciones, " + r.debe + " movimientos";
}

let failures = 0;
async function t(name, fn) {
  try { const extra = await fn(); console.log("  ✓ " + name + (extra ? " · " + extra : "")); }
  catch (e) { failures++; console.error("  ✗ " + name + ": " + e.message); }
}

console.log("bank-sync-acuse");

// ── N2: el cursor solo avanza con acuse ──────────────────────────────────────────────
await t("N2 con cliente de acuse el servidor no mueve last_sync por leer: lo entrega en `ack`", async () => {
  const bank = banco();
  const inicio = haceDias(89);
  const link = enlace(inicio);
  const state = movil();
  const r = await llama(NUEVA, link, bank, CLIENTES.nuevo(state));
  const l = r.data.links[0];
  assert.equal(link.last_sync, inicio, "el cursor espera al acuse");
  assert.equal(l.gapPending, true, "89 días no caben en una pulsación");
  assert.match(l.ack, /^\d{4}-\d{2}-\d{2}T23:59:59\.999Z\|L1$/, "el acuse es el último día leído entero, con el id del enlace");
  assert.ok(r.calls.some((c) => c.to), "el tramo se lee igual");
  // La pulsación siguiente trae el acuse: el cursor salta ahí y el tramo sigue en el día siguiente.
  recibe(state, r.data.links, "nuevo");
  assert.deepEqual(state.obAck, { CaixaBank: l.ack });
  const r2 = await llama(NUEVA, link, bank, CLIENTES.nuevo(state));
  const sellado = l.ack.slice(0, 10);
  assert.ok(Date.parse(link.last_sync) >= Date.parse(l.ack.split("|")[0]), "el acuse mueve el cursor");
  assert.equal(r2.calls.filter((c) => c.to)[0].from, addDays(sellado, 1));
});

await t("N2 sin tramo tampoco se escribe «ahora» hasta el acuse", async () => {
  const bank = banco();
  const inicio = haceDias(3);
  const link = enlace(inicio);
  const state = movil();
  const r = await llama(NUEVA, link, bank, CLIENTES.nuevo(state));
  assert.equal(link.last_sync, inicio);
  assert.equal(r.data.links[0].ack, NOW + "|L1");
  assert.equal(!!r.data.links[0].gapPending, false);
  recibe(state, r.data.links, "nuevo");
  await llama(NUEVA, link, bank, CLIENTES.nuevo(state));
  assert.equal(link.last_sync, NOW);
});

await t("N2 un enlace recién conectado (last_sync nulo) también acepta el acuse", async () => {
  const bank = banco();
  const link = enlace(null);
  const state = movil();
  const r = await llama(NUEVA, link, bank, CLIENTES.nuevo(state));
  assert.equal(link.last_sync, null);
  recibe(state, r.data.links, "nuevo");
  await llama(NUEVA, link, bank, CLIENTES.nuevo(state));
  assert.equal(link.last_sync, NOW);
});

await t("N2 se pierden las respuestas 1 y 2 con hueco de 89 días: cero perdidos y cero repetidos", async () => {
  return limpio(await converge({ gap: 89, pierde: [1, 2] }));
});

await t("N2 se pierde una respuesta sí y otra no durante todo el tramo, con dos cuentas", async () => {
  const r = await converge({ gap: 89, uids: ["cx", "cx2"], pierde: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19], maxPress: 120 });
  return limpio(r);
});

await t("N2 se pierde la respuesta que cierra el tramo: no acaba en «ahora» sin las filas", async () => {
  // Tres días de tramo, justo antes de la ventana, y páginas de 100: cabe en una pulsación sea
  // cual sea el día del mes en que corra el test. La respuesta perdida es la que lo trae TODO.
  const gap = Math.floor((MS - Date.parse(WINDOW)) / DAY) + 3;
  const bank = banco({ page: 100 });
  const inicio = haceDias(gap);
  const link = enlace(inicio);
  const state = movil();
  for (let press = 1; press <= 2; press++) {
    const l = (await llama(NUEVA, link, bank, CLIENTES.nuevo(state))).data.links[0];
    assert.equal(l.gapPending, false, "el tramo se leyó entero en esta pulsación");
    assert.equal(l.ack, NOW + "|L1");
    assert.equal(l.accounts[0].transactions.some((x) => x.date < WINDOW), true);
    assert.equal(link.last_sync, inicio, "la respuesta " + press + " se pierde y el cursor no se mueve");
  }
  return limpio(await converge({ gap, page: 100, pierde: [1, 2] }), 40);
});

await t("N2 un 429 intermitente y respuestas perdidas a la vez", async () => {
  const fail = (c, press) => press % 2 === 1 && c.n === (press * 3) % 11;
  return limpio(await converge({ gap: 60, pierde: [2, 4], fail }));
});

await t("N2 un acuse que no es de este enlace, del futuro, deformado o atrasado no mueve el cursor", async () => {
  const bank = banco();
  const inicio = haceDias(40);
  const futuro = new Date(MS + 60000).toISOString();
  const viejo = haceDias(50);
  for (const ack of [haceDias(10) + "|L2", futuro + "|L1", haceDias(10), "2026-13-45T00:00:00.000Z|L1", haceDias(10).slice(0, 10) + "|L1", viejo + "|L1", 7, null, { at: NOW }]) {
    const link = enlace(inicio);
    const r = await llama(NUEVA, link, bank, { recoverGaps: true, acks: { CaixaBank: ack } });
    assert.equal(link.last_sync, inicio, "acuse aceptado: " + JSON.stringify(ack));
    assert.equal(r.calls.filter((c) => c.to)[0].from, inicio.slice(0, 10), "el tramo no parte del acuse: " + JSON.stringify(ack));
  }
  // El bueno, para saber que lo anterior no pasa por casualidad.
  const link = enlace(inicio);
  await llama(NUEVA, link, bank, { recoverGaps: true, acks: { CaixaBank: haceDias(10) + "|L1" } });
  assert.equal(link.last_sync, haceDias(10));
});

await t("N2 otro móvil ya terminó: un acuse más antiguo no hace retroceder el cursor", async () => {
  const bank = banco();
  const link = enlace(NOW);
  await llama(NUEVA, link, bank, { recoverGaps: true, acks: { CaixaBank: haceDias(30) + "|L1" } });
  assert.equal(link.last_sync, NOW);
});

await t("N2 una lectura a medias no entrega acuse y el cliente conserva el anterior", async () => {
  const bank = banco();
  const link = enlace(haceDias(3));
  const state = movil();
  state.obAck = { CaixaBank: haceDias(3) + "|L1" };
  // Falla la segunda página de la ventana (la ventana más corta del mes ya tiene dos).
  const r = await llama(NUEVA, link, bank, CLIENTES.nuevo(state), (c) => !c.to && c.n === 1);
  assert.equal(r.data.links[0].ack, undefined);
  recibe(state, r.data.links, "nuevo");
  assert.deepEqual(state.obAck, { CaixaBank: haceDias(3) + "|L1" });
});

// ── N5: el banco filtra por fecha valor y la app pinta la contable ───────────────────
for (const skew of [1, 2]) {
  for (const tipo of ["nuevo", "beta116"]) {
    await t("N5 fecha valor " + skew + " día(s) después de la contable · cliente " + tipo + " · hueco 89 d", async () => {
      return limpio(await converge({ gap: 89, skew, filter: "value_date", tipo }));
    });
  }
  await t("N5 fecha valor " + skew + " día(s) después · tramo ya empezado (cursor sellado) y respuestas perdidas", async () => {
    return limpio(await converge({ gap: 60, skew, filter: "value_date", pierde: [1, 4] }));
  });
  await t("N5 fecha valor " + skew + " día(s) después · sin tramo: lo que cruza el borde de la ventana entra", async () => {
    // Último éxito dentro de la ventana: no hay tramo, solo la lectura de siempre. El banco
    // devuelve movimientos con fecha valor dentro y contable uno o dos días antes del borde.
    const gap = Math.max(1, Math.round((MS - Date.parse(WINDOW)) / DAY) - 1);
    const bank = banco({ skew, filter: "value_date" });
    const link = enlace(haceDias(gap));
    const state = movil();
    const r = await llama(NUEVA, link, bank, CLIENTES.nuevo(state));
    assert.equal(r.calls.some((c) => c.to), false, "sin tramo");
    recibe(state, r.data.links, "nuevo");
    const got = new Set(state.expenses.map((e) => e.extId));
    const debe = bank.all.filter((x) => x.value_date >= WINDOW);
    const borde = debe.filter((x) => x.booking_date < WINDOW);
    assert.equal(borde.length, 4 * skew, "el escenario tiene movimientos a caballo del borde");
    assert.equal(debe.filter((x) => !got.has(x.entry_reference)).length, 0);
    assert.equal(state.expenses.length, got.size);
  });
}

await t("N5 el suelo baja, pero al banco no se le pide ni un día más", async () => {
  const bank = banco();
  const link = enlace(haceDias(40));
  const r = await llama(NUEVA, link, bank, CLIENTES.nuevo(movil()));
  const pedidos = r.calls.map((c) => c.from).filter(Boolean).sort();
  assert.equal(pedidos[0], day(-43), "lo más antiguo pedido es la cortesía de 3 días");
  assert.equal(r.data.links[0].syncFrom, day(-46), "y el suelo va 3 días por debajo");
});

// ── Compatibilidad cruzada ────────────────────────────────────────────────────────────
for (const tipo of ["beta116", "nuevo"]) {
  await t("compat: función NUEVA con cliente " + tipo + " · hueco 89 d · dos cuentas", async () => {
    const r = await converge({ gap: 89, tipo, uids: ["cx", "cx2"] });
    if (tipo === "beta116") assert.equal(r.state.obAck, undefined);
    return limpio(r);
  });
}

await t("compat: función NUEVA con cliente que no acusa: el cursor avanza en la misma pulsación, como antes", async () => {
  const bank = banco();
  const inicio = haceDias(60);
  const link = enlace(inicio);
  const r = await llama(NUEVA, link, bank, { recoverGaps: true });
  assert.ok(Date.parse(link.last_sync) > Date.parse(inicio), "sin acuse posible, esperar sería no terminar nunca");
  assert.equal(r.data.links[0].ack, undefined, "no se le entrega lo que no va a devolver");
});

await t("compat: función NUEVA con cliente de producción (sin recoverGaps): ventana de siempre y cursor quieto con hueco", async () => {
  const bank = banco();
  const inicio = haceDias(60);
  const link = enlace(inicio);
  const state = movil();
  for (let press = 1; press <= 2; press++) {
    // Aunque mandara `acks`, sin recoverGaps no hay acuse: no puede guardar el tramo.
    const r = await llama(NUEVA, link, bank, press === 1 ? CLIENTES.prod() : { acks: { CaixaBank: NOW + "|L1" } });
    assert.equal(r.calls.some((c) => c.to), false);
    assert.equal(link.last_sync, inicio);
    assert.equal(r.data.links[0].ack, undefined);
    recibe(state, r.data.links, "prod");
  }
  const got = new Set(state.expenses.map((e) => e.extId));
  assert.equal(state.expenses.length, got.size, "nada repetido");
  // Su margen de 8 días es el del propio cliente (mes de Madrid), no el UTC del servidor: en
  // la primera hora del mes van desfasados y ese cliente, sin suelo, se queda con el suyo.
  const som = vm.runInContext("startOfMonth().getTime()", ctx) - 8 * DAY;
  const debe = bank.all.filter((x) => x.booking_date >= WINDOW && ctx.parseDate(x.booking_date).getTime() >= som);
  assert.ok(debe.length >= 28, "hay ventana que comprobar");
  assert.equal(debe.filter((x) => !got.has(x.entry_reference)).length, 0, "la ventana entra entera");
});

await t("compat: función DESPLEGADA (" + DESPLEGADA + ") con cliente NUEVO · hueco 89 d · dos cuentas", async () => {
  const r = await converge({ src: VIEJA, tipo: "nuevo", gap: 89, uids: ["cx", "cx2"] });
  // La vieja ignora `acks` y no devuelve `ack`: el cliente no guarda nada y nada se atasca.
  assert.deepEqual(r.state.obAck, {});
  return limpio(r);
});

await t("compat: a mitad de tramo cambia la función (vieja → nueva) y el cliente nuevo no pierde ni repite", async () => {
  const bank = banco({ uids: ["cx"] });
  const link = enlace(haceDias(89));
  const state = movil();
  let presses = 0;
  while (presses < 80 && link.last_sync !== NOW) {
    presses++;
    const r = await llama(presses <= 3 ? VIEJA : NUEVA, link, bank, CLIENTES.nuevo(state));
    if (presses !== 4) recibe(state, r.data.links, "nuevo");   // y la primera de la nueva se pierde
  }
  assert.equal(link.last_sync, NOW);
  const ids = state.expenses.map((e) => e.extId), got = new Set(ids);
  assert.equal(bank.all.filter((x) => x.booking_date >= day(-89) && !got.has(x.entry_reference)).length, 0);
  assert.equal(ids.length, got.size);
  return presses + " pulsaciones";
});

await t("compat: el acuse guardado no cruza a otro enlace ni a un banco sin acuse", async () => {
  const links = [{ aspsp: "CaixaBank", ack: NOW + "|L1" }, { aspsp: "Revolut" }, null];
  assert.deepEqual(guardaAcuse({ obAck: { Revolut: "previo|R1" } }, links), { CaixaBank: NOW + "|L1", Revolut: "previo|R1" });
  const prev = { obAck: { CaixaBank: "previo|L1" } };
  guardaAcuse(prev, links);
  assert.deepEqual(prev.obAck, { CaixaBank: "previo|L1" }, "el updater puede ejecutarse dos veces: no muta el estado anterior");
  assert.deepEqual(cuerpoNuevo({ current: {} }), { recoverGaps: true, acks: {} }, "sin acuse guardado manda `acks` vacío: es lo que avisa al servidor");
});

if (failures) process.exitCode = 1;
