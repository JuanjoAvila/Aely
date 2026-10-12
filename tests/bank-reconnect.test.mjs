import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  CLIENTES, DAY, Demand, FLOOR, MS, NOW, Reconnect, SYNC, WINDOW, acuseDe, banco, conecta, cuenta, day, haceDias, handlerSrc, limpio,
  llama, movil, read, recibe, reloj, vuelve,
} from "./helpers/banco-sintetico.mjs";

// Reconectar un banco conserva el cursor (decisión del 11/10/2026). Los tres handlers REALES
// (`bank-connect`, `bank-callback`, `bank-sync`) contra el importador real del cliente: lo que
// se mira es qué acaba guardado en el móvil después de reconectar.
// Antes `bank-callback` ponía `last_sync` a null y lo que el banco apuntó entre la última
// sincronización y la reconexión, si caía antes de la ventana de siempre, no se pedía nunca.

// Lo que entrega Enable Banking en POST /sessions. El `uid` es de la sesión: una autorización
// nueva trae OTRO para la misma cuenta. Lo que no cambia es el IBAN (o el hash).
const cuentaEB = (uid, iban, extra) => Object.assign({ uid, account_id: { iban }, currency: "EUR" }, extra);
const sesion = (id, cuentas) => ({ session_id: id, accounts: cuentas });
const IBAN_A = "ES7620770024003102575766", IBAN_B = "ES9121000418450200051332", IBAN_C = "ES6000491500051234567892";

// Banco conectado por primera vez hace 70 días y leído por última vez hace `gap`.
async function conectado(gap, cuentas = [cuentaEB("cx", IBAN_A)], aspsp = "CaixaBank", tabla = []) {
  reloj.ms = MS - 70 * DAY;
  const state = await conecta(tabla, aspsp);
  assert.equal(await vuelve(tabla, state, sesion("s1", cuentas)), "https://app.invalid/?bank=ok");
  const link = tabla.find((r) => r.aspsp_name === aspsp);
  assert.equal(link.status, "active");
  assert.equal(link.last_sync, null, "la primera vez no hay cursor que conservar");
  assert.equal(link.state, null, "el state se gasta");
  link.last_sync = gap == null ? null : haceDias(gap);
  reloj.ms = MS;
  return { tabla, link };
}
// El permiso caduca y el usuario vuelve a autorizar el MISMO banco, un minuto antes de «ahora».
async function reconecta(tabla, cuentas, aspsp = "CaixaBank", cuando = MS - 60000) {
  reloj.ms = cuando;
  const antes = tabla.find((r) => r.aspsp_name === aspsp);
  const id = antes && antes.id;
  const state = await conecta(tabla, aspsp);
  const link = tabla.find((r) => r.aspsp_name === aspsp);
  if (id) assert.equal(link.id, id, "reconectar no crea otra fila: es el mismo enlace");
  assert.equal(link.status, "pending");
  const url = await vuelve(tabla, state, sesion("s2", cuentas));
  reloj.ms = MS;
  return { link, url };
}
// Pulsa hasta que el cursor llega a «ahora».
async function pulsa(tabla, link, bank, state, tipo, src = SYNC) {
  let presses = 0;
  while (presses < 80 && link.last_sync !== NOW) {
    presses++;
    const before = link.last_sync ? Date.parse(link.last_sync) : 0;
    const r = await llama(src, tabla, bank, CLIENTES[tipo](state));
    assert.ok(!link.last_sync || Date.parse(link.last_sync) >= before, "last_sync retrocedió");
    recibe(state, r.data.links, tipo);
  }
  assert.equal(link.last_sync, NOW, "sin converger tras " + presses + " pulsaciones (last_sync " + link.last_sync + ")");
  return presses;
}

let failures = 0;
async function t(name, fn) {
  try { const extra = await fn(); console.log("  ✓ " + name + (extra ? " · " + extra : "")); }
  catch (e) { failures++; console.error("  ✗ " + name + ": " + e.message); }
  finally { reloj.ms = MS; }
}

console.log("bank-reconnect");

// ── Mismas cuentas: el cursor se conserva y el hueco se recupera ─────────────────────
for (const [gap, min] of [[10, 40], [60, 250]]) {
  for (const tipo of ["nuevo", "beta116"]) {
    await t("mismas cuentas · " + gap + " días entre la última sincronización y la reconexión · cliente " + tipo + ": cero perdidos y cero repetidos", async () => {
      const bank = banco();
      const { tabla, link } = await conectado(gap);
      const cursor = link.last_sync;
      // La autorización nueva trae otro uid para la misma cuenta.
      bank.alias("cx-b", "cx");
      const r = await reconecta(tabla, [cuentaEB("cx-b", IBAN_A)]);
      assert.equal(r.url, "https://app.invalid/?bank=ok");
      assert.equal(link.status, "active");
      assert.equal(link.last_sync, cursor, "el cursor de antes de reconectar sigue ahí");
      assert.deepEqual(link.accounts.map((a) => a.uid), ["cx-b"], "y las cuentas son las de la autorización nueva");
      assert.equal(link.session_id, "enc:v1:s2");
      const state = movil();
      const presses = await pulsa(tabla, link, bank, state, tipo);
      return limpio(Object.assign({ presses }, cuenta(state, bank, day(-gap))), min);
    });
  }
}

await t("mismas cuentas · dos cuentas en otro orden y una reconocida solo por su hash · 60 días", async () => {
  const bank = banco({ uids: ["cx", "ah"] });
  // La segunda no trae IBAN: llega en `accounts_data` con su hash (bancos que no lo entregan).
  const { tabla, link } = await conectado(60, [cuentaEB("cx", IBAN_A, { identification_hash: "hash-a" }), { uid: "ah", identification_hash: "hash-ahorro" }]);
  assert.deepEqual(link.accounts.map((a) => [a.uid, a.iban, a.hash]), [["cx", IBAN_A, "hash-a"], ["ah", null, "hash-ahorro"]]);
  const cursor = link.last_sync;
  bank.alias("cx-b", "cx");
  bank.alias("ah-b", "ah");
  await reconecta(tabla, [{ uid: "ah-b", identification_hash: "hash-ahorro" }, cuentaEB("cx-b", " es76 2077 0024 0031 0257 5766 ", { identification_hash: "hash-a" })]);
  assert.equal(link.last_sync, cursor);
  const state = movil();
  const presses = await pulsa(tabla, link, bank, state, "nuevo");
  return limpio(Object.assign({ presses }, cuenta(state, bank, day(-60))), 500);
});

await t("mismas cuentas · la misma cuenta llega dos veces (IBAN en `accounts`, hash en `accounts_data`) y cuenta como una", async () => {
  const { tabla, link } = await conectado(60, [cuentaEB("cx", IBAN_A)]);
  const cursor = link.last_sync;
  reloj.ms = MS - 60000;
  const state = await conecta(tabla, "CaixaBank");
  await vuelve(tabla, state, { session_id: "s2", accounts: [cuentaEB("cx-b", IBAN_A)], accounts_data: [{ uid: "cx-b", identification_hash: "hash-a" }] });
  assert.deepEqual(link.accounts, [{ uid: "cx-b", iban: IBAN_A, name: null, currency: "EUR", hash: "hash-a" }]);
  assert.equal(link.last_sync, cursor);
});

// ── Más de 90 días: el aviso es coherente ────────────────────────────────────────────
for (const tipo of ["nuevo", "beta116"]) {
  await t("mismas cuentas · 120 días sin sincronizar · cliente " + tipo + ": avisa del tope y recupera los 90 que el banco entrega", async () => {
    const bank = banco();
    const { tabla, link } = await conectado(120);
    const cursor = link.last_sync;
    bank.alias("cx-b", "cx");
    await reconecta(tabla, [cuentaEB("cx-b", IBAN_A)]);
    assert.equal(link.last_sync, cursor);
    const state = movil();
    const r = await llama(SYNC, tabla, bank, CLIENTES[tipo](state));
    assert.equal(r.data.links[0].gapBeyondCap, true, "se dice que hay más de 90 días");
    assert.equal(r.data.links[0].gapPending, true);
    assert.equal(r.calls.filter((c) => c.to)[0].from, FLOOR, "y el tramo empieza en el tope, no antes");
    recibe(state, r.data.links, tipo);
    const presses = 1 + await pulsa(tabla, link, bank, state, tipo);
    assert.equal(state.expenses.some((e) => String(e.date).slice(0, 10) < FLOOR), false, "nada anterior al tope");
    return limpio(Object.assign({ presses }, cuenta(state, bank, FLOOR)));
  });
}

// ── Cuentas cambiadas: el enlace arranca como nuevo ──────────────────────────────────
const CAMBIOS = [
  ["alta de una cuenta", [cuentaEB("cx", IBAN_A)], [cuentaEB("cx-b", IBAN_A), cuentaEB("nv", IBAN_B)]],
  ["baja de una cuenta", [cuentaEB("cx", IBAN_A), cuentaEB("ah", IBAN_B)], [cuentaEB("cx-b", IBAN_A)]],
  ["otra cuenta en su lugar", [cuentaEB("cx", IBAN_A)], [cuentaEB("cx-b", IBAN_C)]],
  ["mismo IBAN y otra divisa", [cuentaEB("cx", IBAN_A)], [cuentaEB("cx-b", IBAN_A, { currency: "USD" })]],
  ["mismo IBAN y otro hash", [cuentaEB("cx", IBAN_A, { identification_hash: "h1" })], [cuentaEB("cx-b", IBAN_A, { identification_hash: "h2" })]],
  ["una cuenta sin identidad estable antes", [{ uid: "cx" }], [{ uid: "cx" }]],
  ["una cuenta sin identidad estable después", [cuentaEB("cx", IBAN_A)], [{ uid: "cx" }]],
];
for (const [nombre, antes, despues] of CAMBIOS) {
  await t("cuentas cambiadas · " + nombre + ": no se conserva el cursor (como hasta ahora)", async () => {
    const { tabla, link } = await conectado(60, antes);
    const r = await reconecta(tabla, despues);
    assert.equal(r.url, "https://app.invalid/?bank=ok");
    assert.equal(link.last_sync, null);
    assert.equal(link.status, "active");
  });
}

await t("cuentas cambiadas · con el alta, la cuenta nueva no hereda el cursor: las dos arrancan con la ventana de siempre", async () => {
  const bank = banco({ uids: ["cx", "nv"] });
  const { tabla, link } = await conectado(60);
  bank.alias("cx-b", "cx");
  await reconecta(tabla, [cuentaEB("cx-b", IBAN_A), cuentaEB("nv", IBAN_B)]);
  const state = movil();
  const r = await llama(SYNC, tabla, bank, CLIENTES.nuevo(state));
  assert.equal(r.calls.some((c) => c.to), false, "sin tramo: ninguna cuenta pide lo anterior a la ventana");
  assert.deepEqual([...new Set(r.calls.map((c) => c.from))], [WINDOW]);
  assert.equal(r.data.links[0].gapPending, false);
  assert.equal(r.data.links[0].gapBeyondCap, false);
  recibe(state, r.data.links, "nuevo");
  await pulsa(tabla, link, bank, state, "nuevo");
  const c = cuenta(state, bank, WINDOW);
  assert.ok(c.debe >= 60, "hay ventana de las dos cuentas (" + c.debe + ")");
  assert.equal(c.missing + c.dup + c.inventados, 0);
});

// ── Banco distinto o enlace nuevo de verdad: igual que hoy ───────────────────────────
await t("conectar OTRO banco no toca el cursor del que ya había, y el nuevo nace sin cursor", async () => {
  const { tabla, link } = await conectado(60);
  const foto = JSON.stringify(link);
  reloj.ms = MS - 60000;
  const state = await conecta(tabla, "Revolut");
  await vuelve(tabla, state, sesion("s9", [cuentaEB("rv", IBAN_A)]));
  assert.equal(tabla.length, 2);
  const otro = tabla.find((x) => x.aspsp_name === "Revolut");
  assert.notEqual(otro.id, link.id);
  assert.equal(otro.last_sync, null, "aunque sus cuentas se parezcan a las del otro banco");
  assert.equal(JSON.stringify(link), foto, "el primero queda byte a byte como estaba");
});

await t("quitar el banco y conectarlo otra vez es un enlace nuevo: sin cursor, con otro id", async () => {
  const { tabla, link } = await conectado(60);
  const viejo = link.id;
  tabla.splice(tabla.indexOf(link), 1);   // bank-disconnect borra la fila
  const r = await reconecta(tabla, [cuentaEB("cx-b", IBAN_A)]);
  assert.notEqual(r.link.id, viejo);
  assert.equal(r.link.last_sync, null);
});

await t("el mismo banco de OTRA persona no comparte nada: cada uno reconecta su fila", async () => {
  const { tabla, link } = await conectado(60);
  const ajena = { id: "L-ajena", user_id: "otra-persona", aspsp_name: "CaixaBank", status: "active", last_sync: haceDias(5), accounts: [{ uid: "aj", iban: IBAN_A }], state: null };
  tabla.push(ajena);
  const foto = JSON.stringify(ajena);
  const cursor = link.last_sync;
  await reconecta(tabla, [cuentaEB("cx-b", IBAN_A)]);
  assert.equal(link.last_sync, cursor);
  assert.equal(JSON.stringify(ajena), foto);
});

// ── Una reconexión que no sale bien ──────────────────────────────────────────────────
await t("si la autorización vuelve sin cuentas, el enlace queda en error y sin cursor (como hasta ahora)", async () => {
  const { tabla, link } = await conectado(60);
  const r = await reconecta(tabla, []);
  assert.match(r.url, /^https:\/\/app\.invalid\/\?bank=error&msg=nolink/);
  assert.equal(link.status, "error");
  assert.equal(link.last_sync, null);
});

// ── El acuse tras reconectar ─────────────────────────────────────────────────────────
// El móvil sincroniza dos minutos antes de «ahora» y se queda con un acuse sin devolver. Un
// minuto después caduca el permiso y reconecta.
async function conAcusePendiente(cuentasNuevas, uids = ["cx"]) {
  const bank = banco({ uids });
  const { tabla, link } = await conectado(60);
  const cursor = link.last_sync;
  const state = movil();
  reloj.ms = MS - 120000;
  const r = await llama(SYNC, tabla, bank, CLIENTES.nuevo(state));
  recibe(state, r.data.links, "nuevo");
  const pendiente = acuseDe(state).CaixaBank;
  assert.ok(Date.parse(pendiente.split("|")[0]) > Date.parse(cursor), "el móvil tiene filas más allá del cursor del servidor");
  assert.equal(link.last_sync, cursor, "y el servidor aún no lo sabe");
  // Sin reconectar, ese acuse valdría: es de este enlace y de esta autorización.
  assert.equal(Demand.ackCursor(pendiente, Demand.ackLinkKey(link.id, link.state_issued_at), cursor, new Date(MS)), pendiente.split("|")[0]);
  bank.alias("cx-b", "cx");
  await reconecta(tabla, cuentasNuevas);
  return { bank, tabla, link, state, cursor, pendiente };
}

await t("acuse tras reconectar · mismas cuentas: un acuse anterior no mueve el cursor conservado, y no se pierde ni se repite nada", async () => {
  const e = await conAcusePendiente([cuentaEB("cx-b", IBAN_A)]);
  assert.equal(e.link.last_sync, e.cursor, "el servidor conserva SU cursor");
  assert.deepEqual(CLIENTES.nuevo(e.state).acks, { CaixaBank: e.pendiente }, "el móvil devuelve el acuse viejo, como haría");
  const r = await llama(SYNC, e.tabla, e.bank, CLIENTES.nuevo(e.state));
  assert.equal(e.link.last_sync, e.cursor, "ni adelante ni atrás: se queda donde lo dejó el servidor");
  assert.equal(r.calls.filter((c) => c.to)[0].from, e.cursor.slice(0, 10), "y la lectura sigue desde ahí");
  assert.notEqual(r.data.links[0].ack.split("|")[1], e.pendiente.split("|")[1], "los acuses de ahora llevan la autorización nueva");
  recibe(e.state, r.data.links, "nuevo");
  const presses = 2 + await pulsa(e.tabla, e.link, e.bank, e.state, "nuevo");
  return limpio(Object.assign({ presses }, cuenta(e.state, e.bank, day(-60))));
});

await t("acuse tras reconectar · cuentas cambiadas: un acuse anterior no resucita el cursor del enlace que arrancó de cero", async () => {
  const e = await conAcusePendiente([cuentaEB("cx-b", IBAN_A), cuentaEB("nv", IBAN_B)], ["cx", "nv"]);
  assert.equal(e.link.last_sync, null);
  const r = await llama(SYNC, e.tabla, e.bank, CLIENTES.nuevo(e.state));
  assert.equal(e.link.last_sync, null, "el acuse de antes no vale: la cuenta nueva no tiene esas filas");
  assert.equal(r.calls.some((c) => c.to), false, "enlace nuevo: solo la ventana");
  recibe(e.state, r.data.links, "nuevo");
  await pulsa(e.tabla, e.link, e.bank, e.state, "nuevo");
  const c = cuenta(e.state, e.bank, WINDOW);
  assert.equal(c.missing + c.dup + c.inventados, 0);
});

await t("acuse tras reconectar · la clave del enlace cambia con cada autorización y solo con ella", async () => {
  const { tabla, link } = await conectado(60);
  const k1 = Demand.ackLinkKey(link.id, link.state_issued_at);
  await llama(SYNC, tabla, banco(), { recoverGaps: true, acks: {} });
  assert.equal(Demand.ackLinkKey(link.id, link.state_issued_at), k1, "sincronizar no la cambia");
  await reconecta(tabla, [cuentaEB("cx", IBAN_A)]);
  const k2 = Demand.ackLinkKey(link.id, link.state_issued_at);
  assert.notEqual(k2, k1);
  assert.equal(k2.split(".")[0], String(link.id), "sigue siendo el mismo enlace");
});

// ── Compatibilidad ───────────────────────────────────────────────────────────────────
await t("compat: reconexión con 60 días de hueco y cliente de producción (sin recoverGaps): ventana de siempre, nada roto, y el hueco queda para quien sí lo guarda", async () => {
  const bank = banco();
  const { tabla, link } = await conectado(60);
  const cursor = link.last_sync;
  bank.alias("cx-b", "cx");
  await reconecta(tabla, [cuentaEB("cx-b", IBAN_A)]);
  const viejo = movil();
  for (let press = 1; press <= 2; press++) {
    const r = await llama(SYNC, tabla, bank, CLIENTES.prod());
    assert.equal(r.data.links[0].ok, true);
    assert.equal(r.calls.some((c) => c.to), false, "no se le lee un tramo que no va a guardar");
    assert.equal(r.data.links[0].gapBeyondCap, false);
    assert.equal(link.last_sync, cursor, "y el cursor conservado no se quema");
    recibe(viejo, r.data.links, "prod");
  }
  assert.equal(viejo.expenses.length, new Set(viejo.expenses.map((x) => x.extId)).size, "nada repetido");
  assert.ok(viejo.expenses.length >= 28, "la ventana le llega");
  // Cuando ese mismo usuario actualiza la app, el hueco sigue ahí para recuperarlo.
  const nuevo = movil();
  const presses = await pulsa(tabla, link, bank, nuevo, "nuevo");
  return limpio(Object.assign({ presses }, cuenta(nuevo, bank, day(-60))));
});

await t("compat: bank-callback nuevo con el bank-sync que hay desplegado · cliente beta 116 · 60 días", async () => {
  const DESPLEGADA = "9a728812";
  const gitShow = (p) => execFileSync("git", ["show", DESPLEGADA + ":" + p], { encoding: "utf8", maxBuffer: 5e6 });
  const VIEJA = handlerSrc(gitShow("supabase/functions/bank-sync/index.ts"), gitShow("supabase/functions/bank-sync/demand-window.ts"));
  const bank = banco();
  const { tabla, link } = await conectado(60);
  bank.alias("cx-b", "cx");
  await reconecta(tabla, [cuentaEB("cx-b", IBAN_A)]);
  const state = movil();
  const presses = await pulsa(tabla, link, bank, state, "beta116", VIEJA);
  return limpio(Object.assign({ presses }, cuenta(state, bank, day(-60))));
});

// ── La regla, sola ───────────────────────────────────────────────────────────────────
await t("sameAccounts / keepsCursor: mismas cuentas una a una, y ante la duda no", () => {
  const { sameAccounts, keepsCursor, previousAccounts } = Reconnect;
  const a = { uid: "1", iban: IBAN_A }, b = { uid: "2", iban: IBAN_B };
  assert.equal(sameAccounts([a, b], [{ uid: "9", iban: IBAN_B }, { uid: "8", iban: IBAN_A }]), true);
  assert.equal(sameAccounts([a], [{ uid: "1", iban: IBAN_B }]), false, "el uid no identifica: es de la sesión");
  assert.equal(sameAccounts([], []), false);
  assert.equal(sameAccounts([a], [a, b]), false);
  assert.equal(sameAccounts([a, b], [a]), false);
  assert.equal(sameAccounts([a, a], [a, b]), false, "una a una: dos iguales no tapan una distinta");
  assert.equal(sameAccounts([{ uid: "1", iban: IBAN_A, currency: "EUR" }, { uid: "2", iban: IBAN_A, currency: "USD" }],
    [{ uid: "3", iban: IBAN_A, currency: "USD" }, { uid: "4", iban: IBAN_A, currency: "EUR" }]), true);
  assert.equal(sameAccounts([{ uid: "1", iban: IBAN_A, currency: "EUR" }, { uid: "2", iban: IBAN_A, currency: "USD" }],
    [{ uid: "3", iban: IBAN_A, currency: "GBP" }, { uid: "4", iban: IBAN_A, currency: "EUR" }]), false);
  assert.equal(sameAccounts([{ uid: "1", iban: IBAN_A, hash: "x" }], [{ uid: "2", hash: "x" }]), true, "el hash basta");
  assert.equal(sameAccounts([{ uid: "1", iban: IBAN_A, hash: "x" }], [{ uid: "2", iban: IBAN_A, hash: "y" }]), false, "y manda sobre el IBAN");
  assert.equal(sameAccounts([{ uid: "1", iban: IBAN_A }], [{ uid: "2", hash: "x" }]), false, "sin nada en común");
  for (const raro of [null, "cx", 7, {}, { uid: "1" }, { uid: "1", iban: "  " }]) {
    assert.equal(sameAccounts([raro], [raro]), false, JSON.stringify(raro));
  }
  // Enlaces anteriores a la columna `accounts`: solo guardan la primera cuenta.
  assert.deepEqual(previousAccounts({ accounts: [], account_uid: "u", iban: IBAN_A }), [{ uid: "u", iban: IBAN_A }]);
  assert.deepEqual(previousAccounts({ accounts: [], account_uid: null }), []);
  assert.equal(keepsCursor({ last_sync: haceDias(3), accounts: [], account_uid: "u", iban: IBAN_A }, [a]), true);
  assert.equal(keepsCursor({ last_sync: null, accounts: [a] }, [a]), false, "sin cursor no hay nada que conservar");
  assert.equal(keepsCursor({ last_sync: "", accounts: [a] }, [a]), false);
  assert.equal(keepsCursor(null, [a]), false);
});

await t("bank-callback no escribe last_sync cuando conserva y lo pone a null cuando no", () => {
  const src = read("supabase/functions/bank-callback/index.ts");
  assert.match(src, /const keep = !!uid && keepsCursor\(link, accts\);/);
  assert.match(src, /\.\.\.\(keep \? \{\} : \{ last_sync: null \}\),/);
  assert.equal((src.match(/last_sync:/g) || []).length, 1, "una sola escritura de last_sync, y condicionada");
});

if (failures) process.exitCode = 1;
