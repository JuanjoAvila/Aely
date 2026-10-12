import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import vm from "node:vm";
import {
  ACK_KEY, CLIENTES, DAY, Demand, FLOOR, K1, MS, NOW, STATE_KEY, SYNC as NUEVA, WINDOW, acuseDe, addDays, banco, contexto, ctx, cuenta,
  cuerpoNuevo, day, discos, efectoAcuse, enlace, haceDias, handlerSrc, importa, limpio, llama, main, movil, ponAcuse, read, recibe,
  recogeAcuse, reloj, relojMovil, usa,
} from "./helpers/banco-sintetico.mjs";

// Acuse del cursor (N2) y banco que filtra por fecha valor (N5), de punta a punta: el handler
// REAL de bank-sync contra el importador REAL del cliente. `bank-sync-progreso` mira qué
// entrega el servidor; aquí se mira qué acaba GUARDADO en el móvil, que es donde se perdía:
// una respuesta que no llega, o un movimiento que llega y el cliente tira por su fecha.
// El banco, la base de datos y el reloj viven en `helpers/banco-sintetico.mjs`.

// La función que hay desplegada mientras el cliente nuevo llega a los móviles: no conoce
// `acks` ni devuelve `ack`. Se lee del commit del que salió, no de una copia.
const DESPLEGADA = "9a728812";
const gitShow = (p) => execFileSync("git", ["show", DESPLEGADA + ":" + p], { encoding: "utf8", maxBuffer: 5e6 });
const VIEJA = handlerSrc(gitShow("supabase/functions/bank-sync/index.ts"), gitShow("supabase/functions/bank-sync/demand-window.ts"));


// Pulsa hasta que el servidor dice que no queda tramo y el cursor llega a «ahora». `pierde`
// son las pulsaciones cuya respuesta no llega al móvil: el servidor trabaja igual.
// `sinVolcar` son las que llegan pero la app se cierra antes de guardar nada.
async function converge({ src = NUEVA, tipo = "nuevo", gap = 89, skew = 0, filter = "booking_date", uids = ["cx"], pierde = [], sinVolcar = [], fail = null, maxPress = 80, page = 20 }) {
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
    if (!pierde.includes(presses)) recibe(state, r.data.links, tipo, { volcado: !sinVolcar.includes(presses) });
  }
  assert.equal(retrocede, false, "last_sync retrocedió");
  assert.equal(link.last_sync, NOW, "sin converger tras " + presses + " pulsaciones (last_sync " + link.last_sync + ")");
  return Object.assign({ presses, state, link, bank }, cuenta(state, bank, desde));
}

let failures = 0;
async function t(name, fn) {
  try { const extra = await fn(); console.log("  ✓ " + name + (extra ? " · " + extra : "")); }
  catch (e) { failures++; console.error("  ✗ " + name + ": " + e.message); }
  finally { reloj.ms = MS; }
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
  assert.match(l.ack, /^\d{4}-\d{2}-\d{2}T23:59:59\.999Z\|L1\.0$/, "el acuse es el último día leído entero, con la clave del enlace");
  assert.ok(r.calls.some((c) => c.to), "el tramo se lee igual");
  // La pulsación siguiente trae el acuse: el cursor salta ahí y el tramo sigue en el día siguiente.
  assert.equal(recibe(state, r.data.links, "nuevo"), true);
  assert.deepEqual(acuseDe(state), { CaixaBank: l.ack });
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
  assert.equal(r.data.links[0].ack, NOW + "|" + K1);
  assert.equal(!!r.data.links[0].gapPending, false);
  recibe(state, r.data.links, "nuevo");
  await llama(NUEVA, link, bank, CLIENTES.nuevo(state));
  assert.equal(link.last_sync, NOW);
});

// ── Enlace sin cursor: el punto de partida queda en el SERVIDOR ──────────────────────
// Con `last_sync` nulo no hay tramo que proteger, pero sí un punto de partida que fijar. Si
// solo vive en el acuse del móvil que pulsó, otro dispositivo encuentra el enlace en null y
// lee «la ventana de hoy», no «desde la primera lectura».
const semilla = (ms) => Demand.chunkCursor(addDays(Demand.currentDemandWindowStart(new Date(ms)), -1));

await t("N1 un enlace recién conectado recibe su punto de partida al leer, y el acuse lo lleva a «ahora»", async () => {
  const bank = banco();
  const link = enlace(null);
  const state = movil();
  const r = await llama(NUEVA, link, bank, CLIENTES.nuevo(state));
  assert.equal(link.last_sync, semilla(MS), "la víspera de la ventana, sellada: se sigue desde su primer día");
  assert.equal(r.data.links[0].ack, NOW + "|" + K1, "«ahora» no se escribe: viaja en el acuse");
  assert.equal(r.calls.some((c) => c.to), false, "en la primera lectura no hay tramo");
  // Mientras la ventana no se mueva, ese cursor no abre tramo ninguno.
  const r2 = await llama(NUEVA, link, bank, { recoverGaps: true, acks: {} });
  assert.equal(r2.calls.some((c) => c.to), false);
  assert.equal(r2.data.links[0].gapPending, false);
  recibe(state, r.data.links, "nuevo");
  await llama(NUEVA, link, bank, CLIENTES.nuevo(state));
  assert.equal(link.last_sync, NOW);
  // El cliente que no acusa sigue como siempre: «ahora» en la misma pulsación.
  for (const body of [{ recoverGaps: true }, {}]) {
    const viejo = enlace(null);
    await llama(NUEVA, viejo, bank, body);
    assert.equal(viejo.last_sync, NOW, JSON.stringify(body));
  }
});

await t("N1 el punto de partida no pisa el cursor que otro móvil escribió entretanto, ni se escribe si el banco no respondió", async () => {
  const bank = banco();
  const link = enlace(null);
  await llama(NUEVA, link, bank, { recoverGaps: true, acks: {} }, null, { trasLeer: (rows) => { rows[0].last_sync = haceDias(2); } });
  assert.equal(link.last_sync, haceDias(2));
  const caido = enlace(null);
  const r = await llama(NUEVA, caido, bank, { recoverGaps: true, acks: {} }, () => true);
  assert.equal(r.data.links[0].ok, false, "el extracto no respondió en ninguna cuenta");
  assert.equal(r.data.links[0].ack, undefined);
  assert.equal(caido.last_sync, null);
});

// La secuencia exacta que midió la revisión: 206 de 370 movimientos sin pedir.
await t("N1 primera pulsación hace 60 días en el móvil A, la siguiente hoy en el móvil B (que ya tiene los gastos de A): cero perdidos", async () => {
  const bank = banco();
  const link = enlace(null);
  const A = movil();
  reloj.ms = MS - 60 * DAY;
  const r = await llama(NUEVA, link, bank, CLIENTES.nuevo(A));
  assert.equal(r.data.links[0].accounts[0].transactions.some((x) => x.date > day(-60)), false, "el banco no entrega el futuro");
  recibe(A, r.data.links, "nuevo");
  assert.ok(A.expenses.length > 30 && acuseDe(A).CaixaBank, "A guardó su ventana y su acuse, que no sale de A");
  reloj.ms = MS;
  // B recibió por la nube los gastos de A, pero no su acuse: es local a cada dispositivo.
  const B = movil();
  B.expenses = JSON.parse(JSON.stringify(A.expenses));
  let presses = 0;
  while (presses < 80 && link.last_sync !== NOW) {
    presses++;
    recibe(B, (await llama(NUEVA, link, bank, CLIENTES.nuevo(B))).data.links, "nuevo");
  }
  assert.equal(link.last_sync, NOW, "sin converger tras " + presses + " pulsaciones");
  return limpio(Object.assign({ presses }, cuenta(B, bank, Demand.currentDemandWindowStart(new Date(MS - 60 * DAY)))));
});

// Lo que el acuse protege, también en la PRIMERA lectura. La versión sin acuse escribía «ahora»
// al leer: si esa respuesta se perdía y la ventana se movía antes de volver, lo de la primera
// ventana no se pedía más. 45 días y no 60: el tope del banco son 90 y la ventana de entonces
// puede empezar 39 días antes de aquella pulsación.
for (const quien of ["el mismo móvil", "otro móvil"]) {
  await t("N1 la PRIMERA respuesta se pierde y la siguiente pulsación llega 45 días después desde " + quien + ": cero perdidos", async () => {
    const bank = banco();
    const link = enlace(null);
    const A = movil();
    reloj.ms = MS - 45 * DAY;
    await llama(NUEVA, link, bank, CLIENTES.nuevo(A));   // la respuesta no llega
    reloj.ms = MS;
    const state = quien === "el mismo móvil" ? A : movil();
    let presses = 0;
    while (presses < 80 && link.last_sync !== NOW) {
      presses++;
      recibe(state, (await llama(NUEVA, link, bank, CLIENTES.nuevo(state))).data.links, "nuevo");
    }
    assert.equal(link.last_sync, NOW, "sin converger tras " + presses + " pulsaciones");
    return limpio(Object.assign({ presses }, cuenta(state, bank, Demand.currentDemandWindowStart(new Date(MS - 45 * DAY)))), 200);
  });
}

await t("N2 carrera entre dos móviles: un acuse más viejo que lo que el otro acaba de escribir no hace retroceder el cursor", async () => {
  const bank = banco();
  // Esta petición lee la fila (cursor de hace 40 días, o nulo) y trae un acuse de hace 10. Antes
  // de que lo escriba, el otro móvil deja el cursor en hace 5. La decisión se tomó con la foto
  // vieja: lo único que impide retroceder es el filtro de la propia escritura.
  for (const inicio of [haceDias(40), null]) {
    const link = enlace(inicio);
    const r = await llama(NUEVA, link, bank, { recoverGaps: true, acks: { CaixaBank: haceDias(10) + "|" + K1 } }, null,
      { trasLeer: (rows) => { rows[0].last_sync = haceDias(5); } });
    assert.equal(link.last_sync, haceDias(5), "cursor de partida " + inicio);
    assert.equal(r.data.links[0].ok, true);
  }
});

await t("N2 ventana que no cabe en los topes, con cliente de acuse: se le entrega «ahora» y el cursor no se queda quieto para siempre", async () => {
  // Páginas de 2 filas: la ventana más corta del mes ya pasa de las 12 llamadas.
  const bank = banco({ page: 2 });
  for (const inicio of [haceDias(60), null]) {
    const link = enlace(inicio);
    const state = movil();
    const r = await llama(NUEVA, link, bank, CLIENTES.nuevo(state));
    const l = r.data.links[0];
    assert.equal(l.accounts[0].truncated, true, "la ventana desborda");
    assert.equal(r.calls.some((c) => c.to), false, "no queda sitio para el tramo, ni hoy ni mañana");
    assert.equal(l.gapPending, false);
    assert.equal(l.ack, NOW + "|" + K1, "sin este acuse el cursor no saldría nunca de donde está");
    assert.notEqual(link.last_sync, NOW, "y sigue sin escribirse hasta que vuelva");
    recibe(state, r.data.links, "nuevo");
    await llama(NUEVA, link, bank, CLIENTES.nuevo(state));
    assert.equal(link.last_sync, NOW, "cursor de partida " + inicio);
  }
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
    assert.equal(l.ack, NOW + "|" + K1);
    assert.equal(l.accounts[0].transactions.some((x) => x.date < WINDOW), true);
    assert.equal(link.last_sync, inicio, "la respuesta " + press + " se pierde y el cursor no se mueve");
  }
  return limpio(await converge({ gap, page: 100, pierde: [1, 2] }), 40);
});

await t("N2 un 429 intermitente y respuestas perdidas a la vez", async () => {
  const fail = (c, press) => press % 2 === 1 && c.n === (press * 3) % 11;
  return limpio(await converge({ gap: 60, pierde: [2, 4], fail }));
});

await t("N2 un acuse que no es de este enlace, del futuro, deformado, imposible o atrasado no mueve el cursor", async () => {
  const bank = banco();
  const inicio = haceDias(40);
  const futuro = new Date(MS + 60000).toISOString();
  const viejo = haceDias(50);
  // H6a: una fecha imposible con la forma exacta. `Date.parse` no la rechaza: la corre (las
  // 24:00 pasan al día siguiente, el 31 de un mes de 30 al día 1). Caen dentro del tramo,
  // posteriores al cursor, así que sin la comprobación de ida y vuelta lo moverían a un
  // instante que nadie emitió. Las de calendario solo entran los días en que caen dentro.
  const y = new Date(MS).getUTCFullYear();
  const imposibles = [day(-10) + "T24:00:00.000Z"].concat([y - 1, y].flatMap((a) => ["-02-30", "-04-31", "-06-31", "-09-31", "-11-31"].map((d) => a + d + "T00:00:00.000Z")))
    .filter((iso) => { const ms = Date.parse(iso); return ms > Date.parse(inicio) && ms < MS; });
  assert.ok(imposibles.length >= 1, "hay al menos una fecha imposible que `Date.parse` acepta dentro del tramo");
  const malos = [haceDias(10) + "|L2.0", haceDias(10) + "|L1", haceDias(10) + "|L1.1", futuro + "|" + K1, haceDias(10), "2026-13-45T00:00:00.000Z|" + K1,
    haceDias(10).slice(0, 10) + "|" + K1, viejo + "|" + K1, 7, null, { at: NOW }].concat(imposibles.map((iso) => iso + "|" + K1));
  for (const ack of malos) {
    const link = enlace(inicio);
    const r = await llama(NUEVA, link, bank, { recoverGaps: true, acks: { CaixaBank: ack } });
    assert.equal(link.last_sync, inicio, "acuse aceptado: " + JSON.stringify(ack));
    assert.equal(r.calls.filter((c) => c.to)[0].from, inicio.slice(0, 10), "el tramo no parte del acuse: " + JSON.stringify(ack));
  }
  // El bueno, para saber que lo anterior no pasa por casualidad.
  const link = enlace(inicio);
  await llama(NUEVA, link, bank, { recoverGaps: true, acks: { CaixaBank: haceDias(10) + "|" + K1 } });
  assert.equal(link.last_sync, haceDias(10));
  return imposibles.length + " fechas imposibles";
});

// M13: la frontera exacta, en Node. Un acuse IGUAL al cursor no es avance: aceptarlo
// reescribiría la fila en cada pulsación y, con `>` en vez de `>=`, también daría por nuevo
// lo que otro móvil ya dejó escrito en ese mismo instante.
await t("M13 frontera de ackCursor: un milisegundo por detrás avanza; igual o por delante, no", () => {
  const now = new Date(MS);
  const iso = haceDias(10), ms = Date.parse(iso);
  const tok = Demand.ackToken(iso, K1);
  assert.equal(Demand.ackCursor(tok, K1, new Date(ms - 1).toISOString(), now), iso);
  assert.equal(Demand.ackCursor(tok, K1, iso, now), null, "cursor igual al acuse");
  assert.equal(Demand.ackCursor(tok, K1, new Date(ms + 1).toISOString(), now), null);
  // El mismo instante escrito como lo devuelve Postgres.
  assert.equal(Demand.ackCursor(tok, K1, iso.replace("Z", "+00:00"), now), null);
  assert.equal(Demand.ackCursor(tok, K1, null, now), iso, "enlace sin cursor");
  // El futuro también tiene frontera: «ahora» vale, un milisegundo después no.
  assert.equal(Demand.ackCursor(Demand.ackToken(NOW, K1), K1, null, now), NOW);
  assert.equal(Demand.ackCursor(Demand.ackToken(new Date(MS + 1).toISOString(), K1), K1, null, now), null);
  // Ida y vuelta (H6a): solo vale lo que se reescribe idéntico.
  assert.equal(Demand.ackCursor("2025-02-30T00:00:00.000Z|" + K1, K1, null, now), null);
  assert.equal(Demand.ackCursor("2025-03-02T00:00:00.000Z|" + K1, K1, null, now), "2025-03-02T00:00:00.000Z");
  // La clave: el id solo, otra autorización u otro enlace no son este.
  assert.equal(Demand.ackLinkKey("L1", null), K1);
  assert.notEqual(Demand.ackLinkKey("L1", haceDias(1)), Demand.ackLinkKey("L1", haceDias(2)));
  // Al milisegundo, no al día: quien reconecta dos veces la misma tarde tiene dos autorizaciones.
  assert.notEqual(Demand.ackLinkKey("L1", "2026-10-01T10:00:00.123Z"), Demand.ackLinkKey("L1", "2026-10-01T10:00:00.124Z"));
  assert.notEqual(Demand.ackLinkKey("L1", "2026-10-01T00:00:00.000Z"), Demand.ackLinkKey("L1", "2026-10-01T23:59:59.999Z"));
  assert.equal(Demand.ackLinkKey("L1", "2026-10-01T10:00:00.123+00:00"), Demand.ackLinkKey("L1", "2026-10-01T10:00:00.123Z"), "misma emisión, otra escritura");
  for (const otra of ["L1", "L1.1", "L2.0"]) assert.equal(Demand.ackCursor(tok, otra, null, now), null);
});

await t("N2 otro móvil ya terminó: un acuse más antiguo no hace retroceder el cursor", async () => {
  const bank = banco();
  const link = enlace(NOW);
  await llama(NUEVA, link, bank, { recoverGaps: true, acks: { CaixaBank: haceDias(30) + "|" + K1 } });
  assert.equal(link.last_sync, NOW);
});

await t("N2 una lectura a medias no entrega acuse y el cliente conserva el anterior", async () => {
  const bank = banco();
  const link = enlace(haceDias(3));
  const state = movil();
  ponAcuse(state, { CaixaBank: haceDias(3) + "|" + K1 });
  // Falla la segunda página de la ventana (la ventana más corta del mes ya tiene dos).
  const r = await llama(NUEVA, link, bank, CLIENTES.nuevo(state), (c) => !c.to && c.n === 1);
  assert.equal(r.data.links[0].ack, undefined);
  recibe(state, r.data.links, "nuevo");
  assert.deepEqual(acuseDe(state), { CaixaBank: haceDias(3) + "|" + K1 });
});

// ── H4: la escritura del acuse es de UN enlace ───────────────────────────────────────
await t("H4 el acuse de un banco solo escribe en su enlace: ni el otro banco del usuario ni el de otra persona", async () => {
  // Tres filas en la tabla. El cliente admin salta RLS: lo único que las separa es el filtro
  // por `id`. Las dos ajenas tienen el cursor por DETRÁS del acuse, que es justo lo que
  // casaría con el `lt` si el filtro por id faltara.
  const bank = banco({ uids: ["cx", "rv", "ajena"] });
  const inicio = haceDias(40), acusado = haceDias(10);
  const mio = enlace(inicio, ["cx"]);
  const otroBanco = enlace(haceDias(35), ["rv"], { id: "L2", aspsp_name: "Revolut" });
  const ajeno = enlace(haceDias(60), ["ajena"], { id: "L3", user_id: "otra-persona" });
  const sinCursor = enlace(null, ["ajena"], { id: "L4", user_id: "tercera-persona" });
  const tabla = [mio, otroBanco, ajeno, sinCursor];
  const antes = JSON.stringify([ajeno, sinCursor]);
  const r = await llama(NUEVA, tabla, bank, { recoverGaps: true, aspsps: ["CaixaBank"], acks: { CaixaBank: acusado + "|" + K1 } });
  assert.equal(mio.last_sync, acusado, "el acuse mueve su enlace");
  assert.equal(otroBanco.last_sync, haceDias(35), "el otro banco del mismo usuario no se toca");
  assert.equal(JSON.stringify([ajeno, sinCursor]), antes, "los enlaces de otras personas quedan byte a byte como estaban");
  assert.deepEqual(r.data.links.map((l) => l.aspsp), ["CaixaBank"], "y no salen en la respuesta");
  assert.equal(r.calls.some((c) => c.uid !== "cx"), false, "ni se lee su banco");
  // Con un enlace recién conectado el filtro es `is null`: tampoco puede alcanzar a `sinCursor`.
  mio.last_sync = null;
  await llama(NUEVA, tabla, bank, { recoverGaps: true, aspsps: ["CaixaBank"], acks: { CaixaBank: acusado + "|" + K1 } });
  assert.equal(mio.last_sync, acusado);
  assert.equal(JSON.stringify([ajeno, sinCursor]), antes);
  // Y sin filtro de bancos: los dos del usuario se leen, cada acuse va al suyo y nada cruza.
  mio.last_sync = inicio;
  const los2 = await llama(NUEVA, tabla, bank, { recoverGaps: true, acks: { CaixaBank: acusado + "|" + K1, Revolut: haceDias(20) + "|L2.0" } });
  assert.equal(mio.last_sync, acusado);
  assert.equal(otroBanco.last_sync, haceDias(20));
  assert.equal(JSON.stringify([ajeno, sinCursor]), antes);
  assert.deepEqual(los2.data.links.map((l) => l.aspsp).sort(), ["CaixaBank", "Revolut"]);
  // El acuse de un banco con la clave del otro no vale aunque los dos sean suyos.
  mio.last_sync = inicio;
  await llama(NUEVA, tabla, bank, { recoverGaps: true, acks: { CaixaBank: acusado + "|L2.0" } });
  assert.equal(mio.last_sync, inicio);
});

// ── H6b: un acuse cuya escritura falla no se da por aplicado ─────────────────────────
await t("H6b si la escritura del acuse devuelve error, el tramo sigue desde el cursor que hay en la BD", async () => {
  const bank = banco();
  const inicio = haceDias(40), acusado = haceDias(10);
  const link = enlace(inicio);
  // supabase-js no lanza: entrega `{error}`. Falla solo la escritura del cursor acusado.
  const failUpdate = (patch) => patch.last_sync === acusado;
  const r = await llama(NUEVA, link, bank, { recoverGaps: true, acks: { CaixaBank: acusado + "|" + K1 } }, null, { failUpdate });
  assert.equal(link.last_sync, inicio, "la BD no cambió");
  assert.equal(r.calls.filter((c) => c.to)[0].from, inicio.slice(0, 10), "y la lectura no parte de un cursor que no se escribió");
  assert.equal(r.data.links[0].ok, true, "el fallo no tumba la sincronización");
  // La pulsación siguiente repite el acuse y esta vez entra.
  await llama(NUEVA, link, bank, { recoverGaps: true, acks: { CaixaBank: acusado + "|" + K1 } });
  assert.equal(link.last_sync, acusado);
});

await t("H6b con la escritura del acuse fallando a ratos no se pierde ni se repite nada", async () => {
  const bank = banco();
  const link = enlace(haceDias(89));
  const state = movil();
  let presses = 0, escrituras = 0;
  const failUpdate = (patch) => "last_sync" in patch && (++escrituras) % 2 === 1;
  while (presses < 80 && link.last_sync !== NOW) {
    presses++;
    const r = await llama(NUEVA, link, bank, CLIENTES.nuevo(state), null, { failUpdate });
    recibe(state, r.data.links, "nuevo");
  }
  assert.equal(link.last_sync, NOW);
  return limpio(Object.assign({ presses }, cuenta(state, bank, day(-89))));
});

// ── El acuse va DETRÁS de sus filas ──────────────────────────────────────────────────
await t("el acuse no se guarda si el estado con sus filas no llegó a disco", async () => {
  const bank = banco();
  const link = enlace(haceDias(89));
  const state = movil();
  const r = await llama(NUEVA, link, bank, CLIENTES.nuevo(state));
  assert.ok(r.data.links[0].ack);
  assert.equal(recibe(state, r.data.links, "nuevo", { volcado: false }), false);
  assert.equal(acuseDe(state), null, "sin filas en disco no hay acuse");
  assert.deepEqual(CLIENTES.nuevo(state), { recoverGaps: true, acks: {} });
  // Un volcado ANTERIOR (otra marca) tampoco acredita esta respuesta.
  recibe(state, r.data.links, "nuevo");
  const previo = acuseDe(state);
  const r2 = await llama(NUEVA, link, bank, CLIENTES.nuevo(state));
  assert.equal(recibe(state, r2.data.links, "nuevo", { volcado: false }), false);
  assert.deepEqual(acuseDe(state), previo, "se conserva el acuse de lo que sí está guardado");
});

await t("la app se cierra antes de guardar en varias pulsaciones del tramo: cero perdidos y cero repetidos", async () => {
  return limpio(await converge({ gap: 89, sinVolcar: [1, 3, 4, 7], pierde: [5] }));
});

await t("runBankSync fija la marca fuera del updater, vuelca el estado y solo entonces guarda el acuse", () => {
  assert.match(main, /obAckPend\.current=\{at:at,ack:ack\};\s*set\(function\(prev\)\{/, "el acuse queda pendiente antes del set");
  assert.match(main, /lastBankSync:at,/, "la marca del estado es la del acuse pendiente");
  assert.doesNotMatch(main, /lastBankSync:Date\.now\(\)/);
  assert.match(main, /if\(!p \|\| state\.lastBankSync!==p\.at\) return;\s*obAckPend\.current=null;\s*flushPersist\(\);\s*obAckSave\(p\.at, p\.ack, state\.expenses\);\s*\},\[state\.lastBankSync\]\);/);
  assert.doesNotMatch(main, /obAck\s*:/, "el acuse no vuelve al estado");
});

// Lo anterior casa texto. Esto ejecuta el efecto tal como está escrito, contra el guardado
// real: si los dos pasos se cruzan, `obAckSave` mira el disco antes del volcado y no acusa.
await t("el efecto del acuse vuelca primero y acusa después: al escribirse el acuse sus filas ya están en la clave de gastos", async () => {
  const m = contexto();
  const EXP = STATE_KEY + m.clave("EXP_SUFFIX");
  const bank = banco();
  const link = enlace(haceDias(89));
  const prev = movil();
  m.ctx.mcSaveRaw(STATE_KEY, prev);   // lo que había en disco antes de sincronizar
  const r = await llama(NUEVA, link, bank, cuerpoNuevo(m.ctx.obAckLoad));
  const add = importa(m.ctx.flattenBankTx, m.ctx.importObExpenses, prev, r.data.links);
  assert.ok(add.length > 20);
  const p = recogeAcuse(r.data.links, relojMovil);
  const next = Object.assign({}, prev, { expenses: add.concat(prev.expenses), lastBankSync: p.at });
  const orden = [];
  let filasAlAcusar = -1;
  m.disco.alEscribir = (k) => {
    orden.push(k);
    if (k === ACK_KEY) filasAlAcusar = JSON.parse(m.disco.actual.get(EXP)).length;
  };
  const flush = () => m.ctx.mcSaveRaw(STATE_KEY, next, { expenses: true });
  // Un estado que no lleva la marca de esta respuesta no vuelca ni acusa: el acuse sigue pendiente.
  assert.equal(efectoAcuse(m.ctx, p, prev, flush), false);
  assert.deepEqual(orden, []);
  assert.equal(efectoAcuse(m.ctx, p, next, flush), true, "con el volcado delante, el acuse entra");
  assert.deepEqual(orden, [EXP, STATE_KEY, ACK_KEY], "gastos, estado y, lo último, el acuse");
  assert.equal(filasAlAcusar, add.length, "las filas ya estaban en disco cuando se escribió el acuse");
  assert.deepEqual(JSON.parse(m.disco.actual.get(ACK_KEY)), p.ack);
});

// ── Sin cuota: el estado ligero entra y el histórico de gastos no ────────────────────
await t("si el histórico de gastos no entra en disco no hay acuse, aunque el estado con la marca sí entre", async () => {
  const m = contexto();
  const EXP = STATE_KEY + m.clave("EXP_SUFFIX");
  const bank = banco();
  const inicio = haceDias(89);
  const link = enlace(inicio);
  const state = movil();
  m.ctx.mcSaveRaw(STATE_KEY, state);
  const pulsa = async () => recibe(state, (await llama(NUEVA, link, bank, cuerpoNuevo(m.ctx.obAckLoad))).data.links, "nuevo", { c: m.ctx });
  m.disco.lleno = (k) => k === EXP;
  assert.equal(await pulsa(), false, "las filas no están en disco: sin acuse");
  assert.ok(state.expenses.length > 20, "en memoria sí están");
  assert.equal(JSON.parse(m.disco.actual.get(STATE_KEY)).lastBankSync, state.lastBankSync, "el estado ligero entró, con su marca");
  assert.equal(JSON.parse(m.disco.actual.get(EXP)).length, 0, "el histórico en disco sigue siendo el de antes");
  assert.equal(m.disco.actual.has(ACK_KEY), false);
  // El servidor repite el trozo; ya no hay nada nuevo que importar y el histórico no se
  // reescribe. Un acuse aquí daría por guardadas las filas de la pulsación anterior.
  const antes = state.expenses.length;
  assert.equal(await pulsa(), false, "la marca nueva entra, pero el disco sigue sin las filas");
  assert.equal(state.expenses.length, antes);
  assert.equal(link.last_sync, inicio, "y el cursor del servidor no se ha movido");
  // Vuelve a haber sitio y el histórico se reescribe: ahora sí.
  m.disco.lleno = null;
  m.ctx.mcSaveRaw(STATE_KEY, state);
  assert.equal(await pulsa(), true);
  assert.ok(m.disco.actual.has(ACK_KEY));
});

await t("un móvil al que nunca le falló el guardado no relee el histórico para acusar", async () => {
  const m = contexto();
  const EXP = STATE_KEY + m.clave("EXP_SUFFIX");
  const state = movil();
  state.expenses = [{ id: "x", extId: "x" }];
  state.lastBankSync = 7;
  m.ctx.mcSaveRaw(STATE_KEY, state);
  let lecturas = 0;
  const leer = m.ctx.localStorage.getItem;
  m.ctx.localStorage.getItem = (k) => { if (k === EXP) lecturas++; return leer(k); };
  assert.equal(m.ctx.obAckSave(7, { CaixaBank: NOW + "|" + K1 }, state.expenses), true);
  assert.equal(lecturas, 0, "la clave grande no se toca en el camino normal");
});

await t("sin cuota a ratos y la app muerta tras cada sincronización: lo que queda en DISCO no pierde ni repite nada", async () => {
  const m = contexto();
  const EXP = STATE_KEY + m.clave("EXP_SUFFIX");
  const bank = banco();
  const link = enlace(haceDias(89));
  m.ctx.mcSaveRaw(STATE_KEY, movil());
  let presses = 0;
  while (presses < 80 && link.last_sync !== NOW) {
    presses++;
    // Cada pulsación arranca de lo que hay en disco: lo que no se guardó, no existe.
    const state = m.ctx.mcLoadRaw(STATE_KEY);
    m.disco.lleno = [1, 3, 4, 7].includes(presses) ? (k) => k === EXP : null;
    recibe(state, (await llama(NUEVA, link, bank, cuerpoNuevo(m.ctx.obAckLoad))).data.links, "nuevo", { c: m.ctx });
  }
  m.disco.lleno = null;
  assert.equal(link.last_sync, NOW, "sin converger tras " + presses + " pulsaciones");
  return limpio(Object.assign({ presses }, cuenta(m.ctx.mcLoadRaw(STATE_KEY), bank, day(-89))));
});

// ── H2: el banco de pruebas no acusa ─────────────────────────────────────────────────
await t("H2 en modo pruebas ni se envía ni se guarda acuse, y el cursor real no se mueve", async () => {
  const pruebas = contexto([["_mcSandbox", "1"]]);
  assert.equal(pruebas.ctx.mcSandbox(), true);
  const bank = banco();
  const inicio = haceDias(89);
  const link = enlace(inicio);
  // El móvil ya tenía un acuse REAL guardado de antes de entrar en pruebas.
  const realAck = { CaixaBank: haceDias(80) + "|" + K1 };
  pruebas.disco.actual.set(ACK_KEY, JSON.stringify(realAck));
  const state = movil();
  for (let press = 1; press <= 4; press++) {
    const body = cuerpoNuevo(pruebas.ctx.obAckLoad);
    assert.deepEqual(body, { recoverGaps: true, acks: {} }, "en pruebas `acks` va vacío: el servidor espera y no avanza");
    const r = await llama(NUEVA, link, bank, body);
    assert.ok(r.data.links[0].ack, "el servidor ofrece acuse");
    // Las filas entran SOLO en la cartera de pruebas, y se guardan en su clave.
    const add = importa(pruebas.ctx.flattenBankTx, pruebas.ctx.importObExpenses, state, r.data.links) || [];
    const p = recogeAcuse(r.data.links, relojMovil);
    state.expenses = add.concat(state.expenses);
    state.lastBankSync = p.at;
    pruebas.ctx.mcSaveRaw(pruebas.clave("mcStateKey()"), state);
    // Aunque la cartera REAL en disco llevara por casualidad esa misma marca.
    pruebas.disco.actual.set(STATE_KEY, JSON.stringify({ lastBankSync: p.at }));
    assert.equal(pruebas.ctx.obAckSave(p.at, p.ack), false);
    assert.equal(pruebas.disco.actual.get(ACK_KEY), JSON.stringify(realAck), "el acuse real queda como estaba");
    assert.equal(link.last_sync, inicio, "pulsación " + press + ": el cursor real no se mueve desde pruebas");
  }
  assert.equal(pruebas.clave("mcStateKey()"), pruebas.clave("STATE_KEY_TEST"));
  // Quitar un banco en pruebas tampoco borra el acuse real (allí `bankDisconnect` no sale).
  pruebas.ctx.obAckDrop("CaixaBank");
  assert.equal(pruebas.disco.actual.get(ACK_KEY), JSON.stringify(realAck));
  // Al salir, la cartera real sincroniza y no le falta nada de lo que se leyó en pruebas.
  const cartera = movil();
  let presses = 0;
  while (presses < 80 && link.last_sync !== NOW) {
    presses++;
    recibe(cartera, (await llama(NUEVA, link, bank, CLIENTES.nuevo(cartera))).data.links, "nuevo");
  }
  return limpio(Object.assign({ presses }, cuenta(cartera, bank, day(-89))));
});

// ── H3: el acuse es de ESTE dispositivo ──────────────────────────────────────────────
// Lo que sube a la nube y lo que se adopta de ella, tal como lo escribe la app.
const mAdopta = main.match(/Object\.assign\(\{\},prev,cloudState,\{expenses:merged\.list\}\)/);
assert.ok(mAdopta, "no se encuentra la adopción del estado de la nube en syncFromCloud");
const adopta = new Function("prev", "cloudState", "merged", "return " + mAdopta[0] + ";");

await t("H3 dos móviles alternan y cada uno adopta el estado del otro sin sus filas: cero perdidos en los dos", async () => {
  const bank = banco();
  const link = enlace(haceDias(89));
  const A = movil(), B = movil();
  const moviles = { A, B };
  let nube = null, presses = 0;
  // Peor caso a propósito: el estado viaja, pero las filas del otro NO llegan (la tabla de
  // gastos se sube aparte y en diferido). Si un móvil acusara lo que importó el otro, el
  // cursor pasaría por encima de filas que él no tiene y aquí faltarían.
  const turno = async (quien) => {
    let state = moviles[quien];
    if (nube) {
      const nuevo = adopta(state, JSON.parse(nube), { list: state.expenses });
      discos.set(nuevo, discos.get(state));
      state = moviles[quien] = nuevo;
    }
    presses++;
    const r = await llama(NUEVA, link, bank, CLIENTES.nuevo(state));
    recibe(state, r.data.links, "nuevo");
    const sube = JSON.stringify(ctx.slimForCloud(state));
    assert.equal(/\|L1\.0/.test(sube), false, "ningún acuse sube a la nube");
    nube = sube;
    // En cada momento, cada móvil tiene TODO lo que hay hasta el cursor del servidor.
    for (const k of ["A", "B"]) {
      const got = new Set(moviles[k].expenses.map((e) => e.extId));
      // Solo responde quien haya acusado algo: el cursor no pasó por encima de nadie más.
      if (!acuseDe(moviles[k])) continue;
      const suyo = Date.parse(String(acuseDe(moviles[k]).CaixaBank).split("|")[0]);
      const hasta = new Date(Math.min(suyo, Date.parse(link.last_sync))).toISOString().slice(0, 10);
      const falta = bank.all.filter((x) => x.booking_date >= day(-89) && x.booking_date <= hasta && !got.has(x.entry_reference)).length;
      assert.equal(falta, 0, "al móvil " + k + " le faltan " + falta + " movimientos por debajo de lo que él mismo acusó (pulsación " + presses + ")");
    }
  };
  while (presses < 160 && !(link.last_sync === NOW && acuseDe(moviles.A) && acuseDe(moviles.B)
    && acuseDe(moviles.A).CaixaBank === NOW + "|" + K1 && acuseDe(moviles.B).CaixaBank === NOW + "|" + K1)) {
    await turno(presses % 2 ? "B" : "A");
  }
  assert.equal(link.last_sync, NOW, "sin converger tras " + presses + " pulsaciones");
  const a = cuenta(moviles.A, bank, day(-89)), b = cuenta(moviles.B, bank, day(-89));
  limpio(Object.assign({ presses }, a));
  limpio(Object.assign({ presses }, b));
  return presses + " pulsaciones entre los dos, " + a.debe + " movimientos en cada uno";
});

await t("H3 el acuse de un móvil no llega a otro por la nube: el segundo empieza sin nada que acusar", async () => {
  const bank = banco();
  const link = enlace(haceDias(89));
  const A = movil();
  const r = await llama(NUEVA, link, bank, CLIENTES.nuevo(A));
  recibe(A, r.data.links, "nuevo");
  assert.ok(acuseDe(A).CaixaBank);
  // B adopta el estado de A recién subido. No tiene ni una fila del banco.
  let B = movil();
  const disco = discos.get(B);
  B = adopta(B, JSON.parse(JSON.stringify(ctx.slimForCloud(A))), { list: B.expenses });
  discos.set(B, disco);
  assert.equal(B.lastBankSync, A.lastBankSync, "el estado sí viaja, marca incluida");
  assert.deepEqual(CLIENTES.nuevo(B), { recoverGaps: true, acks: {} });
  const inicio = link.last_sync;
  const rb = await llama(NUEVA, link, bank, CLIENTES.nuevo(B));
  assert.equal(link.last_sync, inicio, "el cursor no se mueve por un móvil que no tiene las filas");
  assert.equal(rb.calls.filter((c) => c.to)[0].from, inicio.slice(0, 10), "y B recibe el tramo desde el principio");
  // Tampoco al revés: adoptar el estado de B no le quita a A su acuse.
  const antes = JSON.stringify(acuseDe(A));
  const A2 = adopta(A, JSON.parse(JSON.stringify(ctx.slimForCloud(B))), { list: A.expenses });
  discos.set(A2, discos.get(A));
  assert.equal(JSON.stringify(acuseDe(A2)), antes);
});

// ── H6c: quitar un banco limpia su acuse ─────────────────────────────────────────────
await t("H6c al quitar un banco se borra su acuse y solo el suyo", () => {
  const state = movil();
  usa(state);
  ponAcuse(state, { CaixaBank: NOW + "|" + K1, Revolut: NOW + "|L2.0" });
  ctx.obAckDrop("CaixaBank");
  assert.deepEqual(acuseDe(state), { Revolut: NOW + "|L2.0" });
  ctx.obAckDrop("Banco que no está");
  assert.deepEqual(acuseDe(state), { Revolut: NOW + "|L2.0" });
  const panel = read("src/modules/10-app-components.js");
  assert.match(panel, /cloud\.bankDisconnect\(name\)\.then\(function\(\)\{\s*setConfirming\(""\);\s*obAckDrop\(name\);/, "BankPanel lo llama cuando el servidor confirma que lo quitó");
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
    if (tipo === "beta116") assert.equal(discos.get(r.state).has(ACK_KEY), false);
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
    const r = await llama(NUEVA, link, bank, press === 1 ? CLIENTES.prod() : { acks: { CaixaBank: NOW + "|" + K1 } });
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
  assert.deepEqual(acuseDe(r.state), {});
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
  const links = [{ aspsp: "CaixaBank", ack: NOW + "|" + K1 }, { aspsp: "Revolut" }, null];
  assert.deepEqual(recogeAcuse(links, { now: () => 7 }), { at: 7, ack: { CaixaBank: NOW + "|" + K1 } }, "solo recoge los bancos que traen acuse");
  // El banco que hoy no trae `ack` conserva el que tenía guardado.
  const state = movil();
  ponAcuse(state, { Revolut: "previo|R1" });
  recibe(state, links, "nuevo");
  assert.deepEqual(acuseDe(state), { CaixaBank: NOW + "|" + K1, Revolut: "previo|R1" });
  const vacio = movil();
  assert.deepEqual(CLIENTES.nuevo(vacio), { recoverGaps: true, acks: {} }, "sin acuse guardado manda `acks` vacío: es lo que avisa al servidor");
  // Lo guardado con otra forma no se envía tal cual.
  ponAcuse(vacio, ["no", "es", "un", "mapa"]);
  assert.deepEqual(CLIENTES.nuevo(vacio), { recoverGaps: true, acks: {} });
});

if (failures) process.exitCode = 1;
