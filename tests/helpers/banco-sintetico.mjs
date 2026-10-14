import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { transformSync } from "esbuild";
import { createLogicSandbox, extractPureLogicSource } from "../../scripts/load-pure-logic.mjs";

// Banco, base de datos y móviles sintéticos para probar las Edge Functions de bancos REALES
// (`bank-connect`, `bank-callback`, `bank-sync`) contra el importador REAL del cliente. Lo
// comparten `bank-sync-acuse` y `bank-reconnect`: un doble de BD que cada test escribiera a
// su manera acabaría aceptando en uno lo que el otro rechaza.
// Todo es sintético y relativo al reloj del test, porque el importador usa el reloj de verdad.
const root = new URL("../../", import.meta.url);
export const read = (p) => fs.readFileSync(new URL(p, root), "utf8");
export const ts = (code) => transformSync(code, { loader: "ts", format: "esm" }).code;
const modulo = (p) => import("data:text/javascript;base64," + Buffer.from(ts(read(p))).toString("base64"));
export const E = await modulo("supabase/functions/_shared/enablebanking.ts");
export const Entrada = await modulo("supabase/functions/_shared/entrada.ts");
export const Demand = await modulo("supabase/functions/bank-sync/demand-window.ts");
export const Reconnect = await modulo("supabase/functions/bank-callback/reconnect.ts");

// El handler tal como está escrito: sin sus imports (se inyectan) y con los módulos vecinos
// pegados delante. Lo que se ejecuta es el fichero de la función, no una copia.
// En MODO ESTRICTO, que es como lo ejecuta Deno (un módulo ES siempre lo es). Sin esto, una
// asignación a una variable sin declarar pasaba aquí en silencio y en producción lanzaba: así
// vivió `bank-callback` con un `getDiag = …` que convertía un fallo del GET en `msg=error`
// sin que ningún test viera ni lo uno ni lo otro (revisión del 12/10).
export const handlerSrc = (index, ...vecinos) => '"use strict";\n' + vecinos.map((v) => ts(v).replace(/^export /gm, "")).join("\n")
  + "\n" + transformSync(index.replace(/^import .*?;\r?\n/gm, ""), { loader: "ts" }).code;
export const SYNC = handlerSrc(read("supabase/functions/bank-sync/index.ts"), read("supabase/functions/bank-sync/demand-window.ts"));
export const CALLBACK = handlerSrc(read("supabase/functions/bank-callback/index.ts"), read("supabase/functions/bank-callback/reconnect.ts"));
export const CONNECT = handlerSrc(read("supabase/functions/bank-connect/index.ts"));

export const CAP = 12;
export const DAY = 86400000;
export const MS = Date.now();
export const NOW = new Date(MS).toISOString();
// El reloj de las funciones. Fijo salvo que el test lo mueva: dos autorizaciones del mismo
// banco tienen que caer en instantes distintos, como en la vida real.
export const reloj = { ms: MS };
export class FakeDate extends Date {
  constructor(...args) { super(...(args.length ? args : [reloj.ms])); }
  static now() { return reloj.ms; }
}
export const day = (n) => new Date(MS + n * DAY).toISOString().slice(0, 10);
export const addDays = (ymd, n) => new Date(Date.parse(ymd) + n * DAY).toISOString().slice(0, 10);
export const haceDias = (n) => new Date(MS - n * DAY).toISOString();
const hoy = new Date(MS);
export const WINDOW = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1) - 8 * DAY).toISOString().slice(0, 10);
export const FLOOR = day(-90);

// Banco sintético. `skew` son los días que la fecha valor va por DETRÁS de la contable, y
// `filter` la fecha por la que el banco aplica date_from/date_to. La app pinta la contable.
// Cada fila lleva un importe distinto: el importador también deduplica por día+importe+nombre.
export function banco({ skew = 0, filter = "booking_date", uids = ["cx"], page = 20 } = {}) {
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
      // El banco no entrega el futuro: con el reloj atrasado solo existe lo apuntado hasta ese día.
      const hasta = new Date(reloj.ms).toISOString().slice(0, 10);
      list = (rows[uid] || []).filter((r) => (!f || r[filter] >= f) && (!t || r[filter] <= t) && r.booking_date <= hasta);
    }
    const out = { transactions: list.slice(start, start + page) };
    if (start + page < list.length) {
      const key = "k" + (++seq);
      cursors.set(key, { list, start: start + page });
      out.continuation_key = key;
    }
    return out;
  };
  return {
    rows, reply, filter, all: uids.flatMap((u) => rows[u]),
    // Una autorización nueva trae otro `uid` para la MISMA cuenta: mismas filas, mismas referencias.
    alias(nuevo, viejo) { rows[nuevo] = rows[viejo]; },
  };
}

// `bank_links` con memoria y con VARIAS filas: los filtros se aplican de verdad, así que una
// escritura sin su `eq("id")` toca todo lo que case, como haría el cliente admin (sin RLS).
// `lt` no casa con null, como en Postgres. `failUpdate(patch, filas)` hace que una
// escritura devuelva `{error}` sin tocar nada, que es como falla supabase-js: no lanza.
// `trasLeer(filas)` se ejecuta una vez, justo después de que la función lea sus enlaces: es
// el otro móvil que escribe mientras esta petición sigue trabajando con su foto de la fila.
let filas = 0;   // ids de las filas que nacen por upsert: nunca se repiten, como un uuid
export function baseDatos(rows, { user = "synthetic", failUpdate = null, trasLeer = null } = {}) {
  let leido = false;
  const consulta = (apply) => {
    const filters = [];
    const q = {
      eq(col, v) { filters.push((r) => r[col] === v); return q; },
      in(col, vs) { filters.push((r) => vs.includes(r[col])); return q; },
      lt(col, v) { filters.push((r) => r[col] != null && Date.parse(r[col]) < Date.parse(v)); return q; },
      is(col, v) { filters.push((r) => (r[col] == null ? null : r[col]) === v); return q; },
      select() { return q; },
      maybeSingle() { return q.then((res) => ({ data: (res.data || [])[0] || null, error: null })); },
      then(ok, ko) {
        return Promise.resolve().then(() => apply(rows.filter((r) => filters.every((f) => f(r))))).then(ok, ko);
      },
    };
    return q;
  };
  const links = {
    select: () => consulta((hit) => {
      const data = hit.map((r) => Object.assign({}, r));
      if (trasLeer && !leido) { leido = true; trasLeer(rows); }
      return { data, error: null };
    }),
    update: (patch) => consulta((hit) => {
      if (failUpdate && failUpdate(patch, hit)) return { error: { message: "synthetic" } };
      hit.forEach((r) => Object.assign(r, patch));
      return { error: null };
    }),
    delete: () => consulta((hit) => { const data=hit.map(r=>({id:r.id}));hit.forEach((r) => rows.splice(rows.indexOf(r), 1)); return { data, error: null }; }),
    upsert: async (row, { onConflict }) => {
      const cols = onConflict.split(",");
      const cur = rows.find((r) => cols.every((c) => r[c] === row[c]));
      if (cur) Object.assign(cur, row);
      else rows.push(Object.assign({ id: "N" + (++filas), last_sync: null, accounts: [], account_uid: null, iban: null }, row));
      return { error: null };
    },
    insert: async () => ({}),
  };
  return {
    auth: { getUser: async () => ({ data: { user: { id: user } } }) },
    from: (name) => (name === "bank_links" ? links : { insert: async () => ({}) }),
  };
}

const ENV = { SUPABASE_URL: "https://sb.invalid", APP_URL: "https://app.invalid/", EB_REDIRECT_URL: "https://sb.invalid/functions/v1/bank-callback" };
const deno = (onServe) => ({ serve: onServe, env: { get: (k) => ENV[k] || "synthetic" } });
const jsonResp = (x, status = 200) => new Response(JSON.stringify(x), { status });

export function enlace(lastSync, uids = ["cx"], extra = {}) {
  return Object.assign({ id: "L1", user_id: "synthetic", aspsp_name: "CaixaBank", status: "active", last_sync: lastSync, accounts: uids.map((uid) => ({ uid })) }, extra);
}

// bank-sync REAL. `links` es una fila o la tabla entera. Devuelve la respuesta y las llamadas
// a /transactions, y comprueba el tope de llamadas por cuenta en cada invocación.
export async function llama(src, links, bank, body, fail, opts) {
  const rows = Array.isArray(links) ? links : [links];
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
  const names = ["Deno", "createClient", "ebApi", "ebConfig", "jsonResp", "makeJWT", "mapTransaction", "withCors", "fetchBankTransactions", "Date", "ebFailure", "ebSessionVerdict", "decryptSessionId"];
  new Function(...names, src)(
    deno((f) => { handler = f; }), () => baseDatos(rows, opts), api, () => ({}),
    jsonResp, async () => "jwt", E.mapTransaction, (f) => f, E.fetchBankTransactions, FakeDate, E.ebFailure, E.ebSessionVerdict, async (x) => x
  );
  const res = await handler(new Request("https://app.invalid", { method: "POST", body: JSON.stringify(body) }));
  assert.equal(res.status, 200);
  const perUid = {};
  calls.forEach((c) => { perUid[c.uid] = (perUid[c.uid] || 0) + 1; });
  assert.ok(Math.max(0, ...Object.values(perUid)) <= CAP, "más de " + CAP + " llamadas en una cuenta");
  return { data: JSON.parse(JSON.stringify(await res.json())), calls };
}

// bank-connect REAL: deja la fila en `pending` con su `state`. Devuelve ese `state`.
export async function conecta(rows, aspsp, opts) {
  let handler;
  const names = ["Deno", "createClient", "ebApi", "ebConfig", "jsonResp", "makeJWT", "withCors", "Date"];
  new Function(...names, CONNECT)(
    deno((f) => { handler = f; }), () => baseDatos(rows, opts), async () => ({ url: "https://bank.invalid/login" }), () => ({}),
    jsonResp, async () => "jwt", (f) => f, FakeDate
  );
  const res = await handler(new Request("https://app.invalid", { method: "POST", body: JSON.stringify({ aspsp_name: aspsp }) }));
  assert.equal(res.status, 200);
  const user = (opts && opts.user) || "synthetic";
  return rows.find((r) => r.user_id === user && r.aspsp_name === aspsp).state;
}

// bank-callback REAL: canjea el code por la sesión que entrega `sesion` (lo que devolvería
// Enable Banking en POST /sessions). Devuelve la URL a la que manda al navegador.
// `get(intento)` es lo que responde GET /sessions/{id}, que el handler solo pide si el POST
// no trajo cuentas: por defecto confirma lo mismo que el POST; si lanza, es el banco o la red
// fallando. Las esperas entre reintentos no se esperan de verdad.
export async function vuelve(rows, state, sesion, get = () => sesion, src = CALLBACK) {
  let handler, gets = 0;
  const api = async (jwt, p, init) => {
    if (p === "/sessions" && init && init.method === "POST") return sesion;
    return get(gets++);
  };
  const names = ["Deno", "createClient", "ebApi", "ebConfig", "makeJWT", "encryptSessionId", "CallbackFallo", "codigoCallback", "codigoNolink", "Date", "console", "setTimeout"];
  new Function(...names, src)(
    deno((f) => { handler = f; }), () => baseDatos(rows), api, () => ({}), async () => "jwt",
    async (id) => (id ? "enc:v1:" + id : null), Entrada.CallbackFallo, Entrada.codigoCallback, Entrada.codigoNolink, FakeDate,
    { error() {} }, (f) => setTimeout(f, 0)
  );
  const res = await handler(new Request("https://sb.invalid/functions/v1/bank-callback?code=synthetic&state=" + encodeURIComponent(state)));
  assert.equal(res.status, 302);
  return res.headers.get("location");
}

// EL CLIENTE. Un contexto con la lógica real del bundle y un `localStorage` de mentira cuyo
// contenido se cambia por móvil: cada `almacen()` es un dispositivo distinto.
// `disco.lleno(clave)` hace que esa escritura lance, como un `localStorage` sin cuota, y
// `disco.alEscribir(clave)` avisa antes de cada escritura que sí entra.
export function contexto(extra) {
  const disco = { actual: new Map(), lleno: null, alEscribir: null };
  const localStorage = {
    getItem: (k) => (disco.actual.has(k) ? disco.actual.get(k) : null),
    setItem: (k, v) => {
      if (disco.lleno && disco.lleno(k)) throw new Error("QuotaExceededError");
      if (disco.alEscribir) disco.alEscribir(k);
      disco.actual.set(k, String(v));
    },
    removeItem: (k) => { disco.actual.delete(k); },
  };
  (extra || []).forEach(([k, v]) => disco.actual.set(k, v));
  const ctx = createLogicSandbox({ localStorage });
  vm.runInNewContext(extractPureLogicSource(read("public/index.html")), ctx, { filename: "public/index.html:pure-logic" });
  return { ctx, disco, clave: (nombre) => vm.runInContext(nombre, ctx) };
}

export const main = read("src/modules/11-app-main.js");
export const real = contexto();
export const ctx = real.ctx;
export const ACK_KEY = real.clave("OB_ACK_KEY"), STATE_KEY = real.clave("STATE_KEY_REAL");
// Clave del enlace sintético dentro del acuse: su id y una autorización sin fecha de emisión.
export const K1 = "L1.0";

// EL CLIENTE. Las piezas se sacan de `runBankSync` tal como están escritas: el cuerpo de la
// petición, la importación y lo que recoge como acuse. Guardar y leer el acuse son las
// funciones reales de 00-core. Si alguna deja de mandar o de guardar, estos tests lo ven; no
// hay una copia aquí que pueda quedarse atrás.
const mBody = main.match(/cloud\.bankSync\((\{recoverGaps:true[^;]*?\})\), pDb\]/);
const mImport = main.match(/const txs=flattenBankTx\(links(?:, prev\.bankTx)?\);[\s\S]*?const add=importObExpenses\([^;]*\);/);
const mAck = main.match(/const at=Date\.now\(\), ack=\{\};\s*links\.forEach\(function\(l\)\{[^}]*\}\);/);
// El efecto que guarda el acuse cuando el estado con sus filas ya está comprometido.
const mEfecto = main.match(/useEffect\(function\(\)\{\s*(const p=obAckPend\.current;[\s\S]*?)\},\[state\.lastBankSync\]\);/);
assert.ok(mBody && mImport && mAck && mEfecto, "no se encuentran las piezas del cliente en runBankSync");
// Pasado por JSON, que es como viaja: el objeto nace en el contexto de la lógica.
const cuerpo = new Function("obAckLoad", "return " + mBody[1] + ";");
export const cuerpoNuevo = (obAckLoad) => JSON.parse(JSON.stringify(cuerpo(obAckLoad)));
export const importa = new Function("flattenBankTx", "importObExpenses", "prev", "links", mImport[0] + " return add;");
// `Date.now()` es la marca que une el acuse con sus filas. Aquí cada respuesta recibe una
// distinta aunque el test vaya más rápido que el reloj: en un móvil hay una red en medio.
let marca = MS;
export const relojMovil = { now: () => ++marca };
export const recogeAcuse = new Function("links", "Date", mAck[0] + " return {at:at,ack:ack};");
// El efecto REAL, con sus dos pasos en el orden en que están escritos: volcar y acusar.
// Devuelve lo que contestó `obAckSave` (false si el efecto no llegó a llamarlo).
const efecto = new Function("obAckPend", "state", "flushPersist", "obAckSave", mEfecto[1]);
export function efectoAcuse(c, pend, state, flushPersist) {
  let guardado = false;
  efecto({ current: pend }, state, flushPersist, (...args) => (guardado = c.obAckSave(...args)));
  return guardado;
}

// Cada móvil es un `localStorage` distinto sobre la misma lógica. `usa` lo pone delante.
export const discos = new WeakMap();
export function usa(state) { real.disco.actual = discos.get(state); }
export function movil() {
  const state = {
    accounts: [{ id: "cx", ent: "caixabank", role: "diario", value: 400 }],
    settings: { expenseBanks: ["caixabank"] },
    fixed: [], debts: [], oneoffs: [], flows: [], deleted: [], expenses: [], investments: [], bankTx: [],
  };
  discos.set(state, new Map());
  return state;
}
export function acuseDe(state) { return JSON.parse(discos.get(state).get(ACK_KEY) || "null"); }
export function ponAcuse(state, ack) { discos.get(state).set(ACK_KEY, JSON.stringify(ack)); }
// `nuevo`: manda y guarda acuse. `beta116`: pide el tramo pero no acusa. `prod`: ni lo pide.
export const CLIENTES = {
  nuevo: (state) => { usa(state); return cuerpoNuevo(ctx.obAckLoad); },
  beta116: () => ({ recoverGaps: true }),
  prod: () => ({}),
};
// Lo que hace `runBankSync` con una respuesta. `volcado:false` es la app que se cierra antes
// de escribir el estado en disco: las filas de esa respuesta no sobreviven al reinicio.
// El histórico de gastos solo se reescribe si cambió, como en la app (`p.exp`, AGENTS §7 bis).
// `c` es el contexto de la lógica: por defecto el compartido, con el disco de ese móvil delante.
export function recibe(state, links, tipo, { volcado = true, c = ctx } = {}) {
  if (c === ctx) usa(state);
  // El cliente de producción no pasa la respuesta al importador: no conoce el suelo.
  const add = (tipo === "prod" ? c.importObExpenses(state, c.flattenBankTx(links)) : importa(c.flattenBankTx, c.importObExpenses, state, links)) || [];
  if (tipo !== "nuevo") { state.expenses = add.concat(state.expenses); return; }
  const p = recogeAcuse(links, relojMovil);
  const expenses = add.length ? add.concat(state.expenses) : state.expenses;
  // Sin volcado el estado nuevo solo existió en memoria: el de este móvil se queda como estaba.
  if (!volcado) return efectoAcuse(c, p, Object.assign({}, state, { expenses, lastBankSync: p.at }), () => {});
  state.expenses = expenses;
  state.lastBankSync = p.at;
  return efectoAcuse(c, p, state, () => c.mcSaveRaw(STATE_KEY, state, { expenses: add.length > 0 }));
}

export function cuenta(state, bank, desde) {
  const ids = state.expenses.map((e) => e.extId);
  const got = new Set(ids);
  const debe = bank.all.filter((r) => r[bank.filter] >= desde);
  const reales = new Set(bank.all.map((r) => r.entry_reference));
  return {
    debe: debe.length,
    missing: debe.filter((r) => !got.has(r.entry_reference)).length,
    dup: ids.length - got.size,
    inventados: ids.filter((id) => !reales.has(id)).length,
    fechaMal: state.expenses.filter((e) => String(e.date).slice(0, 10) !== String(e.extId).split("|")[1]).length,
  };
}
export function limpio(r, min = 250) {
  assert.ok(r.debe > min, "el escenario tiene que tener tramo que recuperar (" + r.debe + ")");
  assert.equal(r.missing, 0, r.missing + " movimientos perdidos de " + r.debe);
  assert.equal(r.dup, 0, r.dup + " movimientos guardados dos veces");
  assert.equal(r.inventados, 0);
  assert.equal(r.fechaMal, 0, "cada movimiento se guarda con su fecha contable");
  return r.presses + " pulsaciones, " + r.debe + " movimientos";
}
