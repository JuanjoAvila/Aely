/* LA CATEGORÍA ELEGIDA A MANO SOBREVIVE AL PULL Y AL REINICIO (INC-0210-02, 2026-10-02).
 *
 * Caso real: un comedor cuyo nombre lleva el de una aseguradora. Corregido a Restaurantes, volvía
 * a Recibos cada día: la nube seguía con la categoría vieja y el cargo del día siguiente lo
 * categoriza el servidor por palabra clave. Todo con datos ficticios.
 *
 * Lo que se fija aquí, y por qué cada caso:
 *   · sin confirmación de escritura, la fila corregida no se revierte mientras la nube repita la
 *     categoría vieja, y la subida se reintenta con la identidad de la NUBE;
 *   · con la escritura confirmada, una lectura posterior es la verdad AUNQUE diga la categoría
 *     vieja: es otro móvil que la devolvió ahí. Proteger no es dejar de escuchar;
 *   · un UPDATE de cero filas no es una confirmación;
 *   · el equivalente nuevo nace con lo aprendido solo si es el mismo comercio, banco y forma de
 *     pago, y del movimiento corregido en adelante: ni histórico ni seguros de verdad;
 *   · sin nada que proteger no se crea ni un array (el pull corre en cada vuelta a primer plano). */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const COMEDOR = "Comedor Allianz Plaza";
const REGLA = "comedor allianz plaza|trade_republic|1";   // comercio + banco + con tarjeta
const APRENDIDO = Date.parse("2026-10-01T12:00:00.000Z");
// T1: el gasto corregido, ANTERIOR al aprendizaje. T2: el pago del día siguiente.
const T1 = "2026-09-10T12:00:00.000Z", T2 = "2026-10-02T13:00:00.000Z";
const uuid = (n) => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
// Importe distinto por fila: dos filas idénticas son la misma clave y la mezcla las funde.
const fila = (n, fecha, cat, extra) => Object.assign({ id: uuid(n), fecha, importe: 10 + n, comercio: COMEDOR, cat, source: "macrodroid" }, extra);

function app(rules) {
  const cli = loadPureLogicFromFile();
  vm.runInNewContext("USER_OVERRIDES={'comedor allianz plaza':'bares'};USER_CAT_RULES=" + JSON.stringify(rules || {}), cli);
  return cli;
}
const conRegla = () => app({ [REGLA]: { cat: "bares", at: APRENDIDO } });
// El mismo orden que `syncCloudExpenses`: primero se protege, después se mezcla.
function pull(cli, prev, rows, readStartedAt = Date.now()) {
  const kept = cli.keepCategoryChoices(prev, rows.map(cli.expenseFromRow), readStartedAt);
  const merged = cli.mergeExpensesFromCloud(kept.prev, kept.incoming, readStartedAt);
  return { kept, list: merged.list, changed: merged.changed };
}
const corregida = (cli, n, fecha, extra) => Object.assign(cli.expenseFromRow(fila(n, fecha, "recibos")), { category: "bares", catStale: ["recibos"] }, extra);
const cats = (list) => Array.from(list, (e) => e.category);

test("sin el arreglo el nombre manda: la palabra clave lleva el comedor y el seguro a Recibos", () => {
  const cli = loadPureLogicFromFile();
  assert.equal(cli.autoCategory(COMEDOR), "recibos");
  assert.equal(cli.autoCategory("Allianz Seguros"), "recibos");
});

test("sin confirmar: la fila corregida no vuelve a Recibos y se reintenta con el id de la nube", () => {
  const cli = conRegla();
  // El id local difiere del de la nube: es el caso en que el UPDATE por id no tocaba nada.
  const local = [corregida(cli, 1, T1, { id: "LOCAL-1" })];
  const r = pull(cli, local, [fila(1, T1, "recibos")]);
  assert.deepEqual(cats(r.list), ["bares"]);
  assert.equal(r.list[0], local[0], "sin cambios no se crea una fila nueva");
  assert.equal(r.changed, false);
  assert.deepEqual(Array.from(r.kept.recat, (x) => [x.expense.id, x.cat]), [[uuid(1), "bares"]]);
});

test("cuando la nube se entera se deja de proteger, y un reinicio no cambia nada", () => {
  const cli = conRegla();
  const guardado = JSON.parse(JSON.stringify([corregida(cli, 1, T1)]));
  assert.deepEqual(guardado[0].catStale, ["recibos"], "la procedencia sobrevive al guardado");
  assert.deepEqual(cats(pull(cli, guardado, [fila(1, T1, "recibos")]).list), ["bares"], "tras reiniciar sigue protegida");
  const alDia = pull(cli, guardado, [fila(1, T1, "bares")]);
  assert.deepEqual(cats(alDia.list), ["bares"]);
  assert.equal("catStale" in alDia.list[0], false);
  assert.equal(alDia.kept.recat.length, 0);
});

test("sin confirmar, una categoría que no es ni la vieja ni la suya viene de otro móvil: se adopta", () => {
  const cli = conRegla();
  const r = pull(cli, [corregida(cli, 1, T1)], [fila(1, T1, "super")]);
  assert.deepEqual(cats(r.list), ["super"]);
  assert.equal("catStale" in r.list[0], false);
  assert.equal(r.kept.recat.length, 0, "no se pelea con la decisión del otro móvil");
});

test("dos móviles: confirmada la escritura, el otro puede devolverla a la categoría ORIGINAL", () => {
  const cli = conRegla();
  const ack = 1_000_000;
  const local = [corregida(cli, 1, T1, { catAckAt: ack })];
  // Lectura empezada ANTES de la confirmación: puede ser una foto vieja. Manda lo local, sin reintento.
  const vieja = pull(cli, local, [fila(1, T1, "recibos")], ack - 1);
  assert.deepEqual(cats(vieja.list), ["bares"]);
  assert.equal(vieja.kept.recat.length, 0, "ya está escrita: no se vuelve a subir");
  assert.equal(vieja.list[0], local[0]);
  // Sin hora de lectura no se puede ordenar: se conserva la incertidumbre.
  assert.deepEqual(cats(pull(cli, local, [fila(1, T1, "recibos")], null).list), ["bares"]);
  // Lectura empezada DESPUÉS: el otro móvil la devolvió a Recibos y eso es lo que vale.
  const nueva = pull(cli, local, [fila(1, T1, "recibos")], ack + 1);
  assert.deepEqual(cats(nueva.list), ["recibos"]);
  assert.equal("catStale" in nueva.list[0], false);
  assert.equal("catAckAt" in nueva.list[0], false);
  assert.equal(nueva.kept.recat.length, 0, "no deshace la decisión nueva");
  // Y no queda protegida para siempre: el siguiente pull ya no la toca.
  assert.deepEqual(cats(pull(cli, nueva.list, [fila(1, T1, "recibos")]).list), ["recibos"]);
});

test("ackCategoryWrite solo confirma la fila, la categoría y la decisión que se subieron", () => {
  const cli = conRegla();
  const list = [corregida(cli, 1, T1, { id: "LOCAL-1" }), corregida(cli, 2, T2), cli.expenseFromRow(fila(3, T2, "recibos"))];
  const nube = cli.expenseFromRow(fila(1, T1, "recibos"));
  const out = cli.ackCategoryWrite(list, nube, "bares", 77);
  assert.equal(out[0].catAckAt, 77, "casa por clave aunque el id local sea otro");
  assert.equal(out[1], list[1]);
  assert.equal(out[2], list[2]);
  assert.equal(cli.ackCategoryWrite(list, nube, "super", 77), list, "otra categoría: no es esta decisión");
  assert.equal(cli.ackCategoryWrite(out, nube, "bares", 99)[0].catAckAt, 77, "la primera confirmación manda");
  assert.equal(cli.ackCategoryWrite(list, cli.expenseFromRow(fila(3, T2, "recibos")), "recibos", 77), list, "sin nada pendiente no se toca");
});

test("setExpenseCat cuenta filas: cero filas o un error no son una confirmación", async () => {
  const cli = loadPureLogicFromFile();
  const core = fs.readFileSync(new URL("../src/modules/00-core.js", import.meta.url), "utf8");
  const body = core.match(/async setExpenseCat\(e, cat\)\{([\s\S]*?)\r?\n    \},/)[1];
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const run = new AsyncFunction("sb", "expenseCloudEq", "expenseSourceForCloud", "e", "cat", body);
  const tabla = (rows, fallo) => {
    const escritos = [];
    const sb = {
      auth: { getSession: async () => ({ data: { session: { user: { id: "synthetic-user" } } } }) },
      from: () => ({ update: (upd) => {
        const filtros = {};
        const q = { eq: (k, v) => { filtros[k] = v; return q; },
          select: async () => {
            if (fallo) return { data: null, error: new Error("synthetic 503") };
            const hit = rows.filter((r) => r.id === filtros.id);
            hit.forEach((r) => { Object.assign(r, upd); escritos.push(r.id); });
            return { data: hit.map((r) => ({ id: r.id })), error: null };
          } };
        return q;
      } }),
    };
    return { sb, escritos };
  };
  const call = (t, e) => run(t.sb, cli.expenseCloudEq, cli.expenseSourceForCloud, e, "bares");
  const rows = [{ id: uuid(1), cat: "recibos" }];
  const ok = tabla(rows);
  assert.equal(await call(ok, { id: uuid(1) }), 1);
  assert.equal(rows[0].cat, "bares");
  assert.equal(await call(tabla([{ id: uuid(1), cat: "recibos" }]), { id: uuid(9) }), 0, "otro uuid: cero filas, sin error");
  await assert.rejects(call(tabla(rows, true), { id: uuid(1) }), /synthetic 503/);
  assert.equal(await call(ok, { id: "sin-uuid" }), 0, "sin identidad no hay consulta ni confirmación");
});

test("el equivalente del día siguiente nace con lo aprendido y sobrevive a los pulls siguientes", () => {
  const cli = conRegla();
  const local = [corregida(cli, 1, T1)];
  const r = pull(cli, local, [fila(1, T1, "recibos"), fila(2, T2, "recibos")]);
  assert.deepEqual(cats(r.list), ["bares", "bares"]);
  assert.deepEqual(Array.from(r.list[1].catStale), ["recibos"]);
  assert.deepEqual(Array.from(r.kept.recat, (x) => [x.expense.id, x.cat]), [[uuid(1), "bares"], [uuid(2), "bares"]]);
  // La subida aún no ha llegado, y hay un reinicio por medio: el siguiente pull no la deshace.
  const otra = pull(cli, JSON.parse(JSON.stringify(r.list)), [fila(1, T1, "recibos"), fila(2, T2, "recibos")]);
  assert.deepEqual(cats(otra.list), ["bares", "bares"]);
  // Y cuando llega, queda limpio.
  const fin = pull(cli, otra.list, [fila(1, T1, "bares"), fila(2, T2, "bares")]);
  assert.deepEqual(Array.from(fin.list, (e) => [e.category, "catStale" in e]), [["bares", false], ["bares", false]]);
});

test("equivalencia precisa: mismo nombre en otro banco o sin tarjeta NO es el mismo sitio", () => {
  const cli = conRegla();
  const rows = [
    fila(10, T2, "recibos", { source: "ob:sabadell" }),                // recibo domiciliado, mismo nombre, otro banco
    fila(11, T2, "recibos", { no_card: true }),                        // mismo banco, sin tarjeta
    fila(12, T2, "recibos", { comercio: "Allianz Seguros" }),          // seguro de verdad, otro nombre
    fila(13, "2026-09-20T12:00:00.000Z", "recibos"),                   // entre el gasto corregido (10/9) y el aprendizaje (1/10)
    fila(19, "2026-10-01T11:59:59.000Z", "recibos"),                   // el mismo día, un segundo antes de aprenderlo
    fila(20, "2026-10-01T00:00:00.000Z", "recibos"),                   // fecha sin hora del día del aprendizaje: no prueba el orden
    fila(21, "2026-10-01T12:00:00.000Z", "recibos"),                   // el instante exacto tampoco es «después»
    fila(14, T2, "regalos", { source: "manual" }),                     // apuntado a mano en otro móvil
    fila(15, T2, "deudas"),
    fila(16, T2, "traspaso"),
    fila(17, T2, "inversion"),
    fila(18, T2, "ingreso", { importe: -26 }),
  ];
  const r = pull(cli, [], rows);
  assert.deepEqual(cats(r.list), ["recibos", "recibos", "recibos", "recibos", "recibos", "recibos", "recibos", "regalos", "deudas", "traspaso", "inversion", "ingreso"]);
  assert.equal(r.kept.recat.length, 0);
  assert.ok(Array.from(r.list).every((e) => !("catStale" in e)));
  assert.equal(r.kept.incoming.length, rows.length);
  // Positivos: fecha sin hora del día siguiente y hora fiable posterior del mismo día.
  const si = pull(cli, [], [fila(22, "2026-10-02T00:00:00.000Z", "recibos"), fila(23, "2026-10-01T12:00:01.000Z", "recibos")]);
  assert.deepEqual(cats(si.list), ["bares", "bares"]);
});

test("una regla sin fecha fiable o una fila con fecha ilegible no autorizan nada", () => {
  for (const at of [null, undefined, NaN, "ayer"]) {
    const cli = app({ [REGLA]: { cat: "bares", at } });
    assert.deepEqual(cats(pull(cli, [], [fila(24, T2, "recibos")]).list), ["recibos"], "at=" + String(at));
  }
  const cli = conRegla();
  const rara = Object.assign(cli.expenseFromRow(fila(25, T2, "recibos")), { date: "fecha ilegible" });
  const kept = cli.keepCategoryChoices([], [rara], Date.now());
  assert.equal(kept.incoming[0], rara);
  assert.equal(kept.recat.length, 0);
});

test("una fila que ya estaba en el móvil no se recategoriza por lo aprendido después", () => {
  const cli = conRegla();
  const local = [cli.expenseFromRow(fila(30, T2, "recibos"))];
  const r = pull(cli, local, [fila(30, T2, "recibos")]);
  assert.equal(r.list[0], local[0]);
  assert.equal(r.kept.recat.length, 0);
});

test("sin nada que proteger devuelve las mismas referencias", () => {
  const cli = app();
  const prev = [cli.expenseFromRow(fila(40, T2, "recibos"))];
  const incoming = [cli.expenseFromRow(fila(41, T2, "recibos"))];
  const kept = cli.keepCategoryChoices(prev, incoming, Date.now());
  assert.equal(kept.prev, prev);
  assert.equal(kept.incoming, incoming);
  assert.equal(kept.recat.length, 0);
  // Con una regla pero nada que aplicar, tampoco.
  const k2 = conRegla().keepCategoryChoices(prev, incoming.map((e) => Object.assign({}, e, { merchant: "Otro sitio" })), Date.now());
  assert.equal(k2.prev, prev);
  assert.equal(k2.recat.length, 0);
});

test("catStaleAfter acumula lo que la nube puede devolver y olvida la categoría a la que se vuelve", () => {
  const cli = app();
  assert.deepEqual(Array.from(cli.catStaleAfter({ category: "recibos", source: "ob" }, "bares")), ["recibos"]);
  assert.deepEqual(Array.from(cli.catStaleAfter({ category: "bares", source: "ob", catStale: ["recibos"] }, "super")), ["recibos", "bares"]);
  assert.deepEqual(Array.from(cli.catStaleAfter({ category: "bares", source: "ob", catStale: ["recibos"] }, "recibos")), ["bares"]);
  assert.equal(cli.catStaleAfter({ category: "otros", source: "manual" }, "bares"), undefined, "un apunte manual ya no lo pisa el pull");
  assert.deepEqual(Array.from(cli.catStaleAfter({ category: "bares", source: "ob", catStale: ["recibos"] }, "bares")), ["recibos"], "elegir la misma no cambia nada");
});

test("lo aprendido antes de las reglas se deduce de lo ya corregido, una vez y desde hoy", () => {
  const cli = loadPureLogicFromFile();
  const antes = Date.now();
  const ayer = new Date(antes - 864e5).toISOString(), manana = new Date(antes + 864e5).toISOString();
  const base = { catOverrides: { "comedor allianz plaza": "bares", "sin prueba": "super" } };
  // Sin gastos cargados no se decide nada ni se marca como hecho: llegan en un segundo viaje.
  const vacio = cli.seedCatRules(Object.assign({ expenses: [] }, base));
  assert.equal(vacio._catRulesSeed, undefined);
  const expenses = [
    Object.assign(cli.expenseFromRow(fila(50, ayer, "bares")), {}),                         // la prueba: ya corregida
    cli.expenseFromRow(fila(51, ayer, "recibos", { source: "ob:sabadell" })),               // mismo nombre, otro banco, sin corregir
    cli.expenseFromRow(fila(52, ayer, "bares", { source: "manual" })),                      // manual: no enseña nada al pull
  ];
  const s = cli.seedCatRules(Object.assign({ expenses }, base));
  assert.deepEqual(Object.keys(s.catRules), [REGLA], "solo el contexto que él corrigió; sin prueba no hay regla");
  assert.equal(s.catRules[REGLA].cat, "bares");
  assert.ok(s.catRules[REGLA].at >= antes, "nunca una fecha antigua inventada");
  assert.equal(cli.seedCatRules(s), s, "segunda carga: ni un objeto nuevo");
  // Con esa regla, el cargo de mañana queda protegido; uno que baja ahora con fecha de ayer, no.
  vm.runInNewContext("USER_CAT_RULES=" + JSON.stringify(s.catRules), cli);
  // Prueba usada: fecha de la fila estrictamente posterior al instante del sellado.
  const justoAntes = new Date(s.catRules[REGLA].at - 1).toISOString(), hoySinHora = new Date(antes).toISOString().slice(0, 10) + "T00:00:00.000Z";
  const r = pull(cli, expenses, [fila(53, manana, "recibos"), fila(54, ayer, "recibos"), fila(55, justoAntes, "recibos"), fila(56, hoySinHora, "recibos")]);
  assert.deepEqual(cats(r.list).slice(-4), ["bares", "recibos", "recibos", "recibos"]);
  assert.deepEqual(Array.from(r.kept.recat, (x) => x.expense.id), [uuid(53)]);
  // seedFlows es quien las activa al cargar.
  const cargado = cli.seedFlows(Object.assign({ expenses }, base));
  assert.equal(cargado._catRulesSeed, true);
  assert.deepEqual(Object.keys(cargado.catRules), [REGLA]);
});
