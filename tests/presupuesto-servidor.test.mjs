#!/usr/bin/env node
/**
 * EL SERVIDOR TIENE QUE CONTAR EL PRESUPUESTO COMO LA APP.
 *
 * Bug real 2026-08-06: le saltó «¡95% del presupuesto! 965 € de 1.000 €» en la notificación y en el
 * widget, y al abrir la app no llegaba al 30%. Los dos números salían de la misma nube: `ingest`
 * sumaba TODAS las filas del mes, mientras que `monthBudgetStats()` descarta los bancos que no son
 * de gasto diario, las categorías neutras (inversión/traspaso) y resta lo reservado del presupuesto.
 * Con sus datos de agosto: 964,58 € contra 234,30 €.
 *
 * Por eso estos tests NO comprueban constantes: cargan LAS DOS implementaciones —la del cliente
 * (`src/modules`) y la del servidor (`supabase/functions/_shared/presupuesto.ts`)— y exigen que
 * den el MISMO número sobre el mismo escenario. Un test de constantes se queda verde cuando alguien
 * cambia una de las dos y se olvida de la otra, que es exactamente cómo nació este bug.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = fs.readFileSync(path.join(root, "supabase/functions/_shared/presupuesto.ts"), "utf8");
const js = transformSync(src, { loader: "ts", format: "esm" }).code;
const { statsDelMes, bancosDeGastoDiario, cuentaParaPresupuesto, bancoDeSource, esPosibleRepetido,
  claveComoLaApp, filasComoLaApp, inicioDeMesMs } =
  await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

const cli = loadPureLogicFromFile();

function t(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
}

console.log("presupuesto-servidor");

/* Mes calendario de la casa (Madrid), no el UTC de la máquina CI — B09-B. */
const nowMs = Date.now();
const desdeMs = inicioDeMesMs(nowMs);
const ym = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Madrid", year: "numeric", month: "2-digit",
}).format(new Date(nowMs));
const d = (day) => ym + "-" + String(day).padStart(2, "0") + "T10:00:00.000Z";

/* Un movimiento se escribe UNA vez y se traduce a los dos formatos: si se escribieran por separado
   el test podría pasar con dos escenarios distintos y no probaría nada. */
/* El servidor redondea a céntimos (sus cifras van directas a una notificación y al widget) y el
   cliente arrastra el float crudo: 140,71 contra 140,70999999999998. El contrato es «iguales al
   céntimo», así que se compara redondeando los dos — no bajando el listón, sino comparando lo que
   de verdad se enseña. */
const c = (n) => +Number(n).toFixed(2);

const mov = (day, importe, cat, source) => ({ day, importe, cat, source });
const paraServidor = (m) => ({ importe: m.importe, cat: m.cat, source: m.source });
const paraCliente = (m) => ({ date: d(m.day), amount: m.importe, category: m.cat, source: m.source });

/** Su escenario real de agosto, en pequeño: TR es el diario, Sabadell son los recibos. */
function escenario(extra = {}) {
  const movs = [
    mov(2, 88.11, "transporte", "macrodroid"),      // TR  → cuenta
    mov(3, 12.6, "cine", "macrodroid"),             // TR  → cuenta
    mov(4, 448.39, "hogar", "ob:sabadell"),         // recibos → NO cuenta
    mov(5, 281.89, "inversion", "macrodroid"),      // neutra  → NO cuenta
    mov(6, 40, "super", "manual"),                  // a mano, sin banco → cuenta
    mov(7, -179.35, "ingreso", "macrodroid"),       // ingreso → cuenta como ingreso
  ];
  const base = {
    budget: 1000,
    accounts: [
      { ent: "trade_republic", role: "diario" },
      { ent: "sabadell", role: "fijos" },
    ],
    settings: { expenseBanks: ["trade_republic"], gTotalMode: "split" },
    reservaLog: [],
  };
  const data = Object.assign({}, base, extra, {
    settings: Object.assign({}, base.settings, extra.settings || {}),
  });
  return { movs, data };
}

t("el servidor da el mismo gasto que la app (modo split)", () => {
  const { movs, data } = escenario();
  const srv = statsDelMes(movs.map(paraServidor), data, desdeMs);
  const app = cli.monthBudgetStats(Object.assign({}, data, { expenses: movs.map(paraCliente) }), nowMs);
  assert.equal(srv.spent, c(app.spent));
  assert.equal(srv.income, c(app.income));
  assert.equal(srv.against, c(app.against));
  assert.equal(srv.budget, c(app.budget));
});

t("y también en modo neto, que es como lo tiene él", () => {
  const { movs, data } = escenario({ settings: { gTotalMode: "net" } });
  const srv = statsDelMes(movs.map(paraServidor), data, desdeMs);
  const app = cli.monthBudgetStats(Object.assign({}, data, { expenses: movs.map(paraCliente) }), nowMs);
  assert.equal(srv.against, c(app.against));
  assert.equal(srv.shown, c(app.shown));
  // 88,11 + 12,60 + 40 = 140,71 de gasto; 179,35 de ingreso → neto negativo
  assert.equal(srv.against, +(140.71 - 179.35).toFixed(2));
});

t("los recibos y las inversiones NO cuentan (el bug de los 965 €)", () => {
  const { movs, data } = escenario();
  const srv = statsDelMes(movs.map(paraServidor), data, desdeMs);
  const sumaTonta = movs.reduce((a, m) => a + m.importe, 0);   // lo que hacía ingest antes
  assert.equal(srv.spent, 140.71);
  assert.notEqual(+sumaTonta.toFixed(2), srv.against);
  // lo que se colaba: los recibos de Sabadell y la inversión
  assert.equal(+(sumaTonta - (srv.spent - srv.income)).toFixed(2), 448.39 + 281.89);
});

t("lo reservado para metas se resta del presupuesto", () => {
  const { movs, data } = escenario({
    reservaLog: [{ date: d(3), amount: 150 }, { date: "2020-01-01T00:00:00.000Z", amount: 999 }],
  });
  const srv = statsDelMes(movs.map(paraServidor), data, desdeMs);
  const app = cli.monthBudgetStats(Object.assign({}, data, { expenses: movs.map(paraCliente) }), nowMs);
  assert.equal(srv.reserved, 150);            // lo de 2020 es de otro mes: no cuenta
  assert.equal(srv.budget, 850);
  assert.equal(srv.budget, app.budget);
});

t("la cuenta de gasto diario entra aunque no esté en expenseBanks", () => {
  const data = {
    budget: 500,
    accounts: [{ ent: "revolut", role: "diario" }],
    settings: { expenseBanks: [] },
  };
  assert.deepEqual(bancosDeGastoDiario(data), ["revolut"]);
  assert.equal(cuentaParaPresupuesto({ importe: 10, cat: "super", source: "ob:revolut" }, ["revolut"]), true);
});

t("sin presupuesto puesto no se inventa ninguno", () => {
  const { movs } = escenario();
  const srv = statsDelMes(movs.map(paraServidor), { budget: 0 }, desdeMs);
  assert.equal(srv.budget, 0);
});

t("★ dos notis del mismo cargo el mismo día cuentan UNA vez — no son dos compras", () => {
  /* Caso real 13/8: Wallet 11:31 y TR 13:08, ambos 230 € APOLLON GALLERY. El extracto del banco
     tiene UN 230 y UN 115. Meter la hora en la clave haría que la app también mintiera. */
  const data = {
    budget: 1000,
    accounts: [{ ent: "trade_republic", role: "diario" }],
    settings: { expenseBanks: ["trade_republic"], gTotalMode: "net" },
  };
  const gemelas = [
    { fecha: ym + "-13T11:31:14.000Z", importe: 230, cat: "regalos", source: "macrodroid", comercio: "APOLLON GALLERY" },
    { fecha: ym + "-13T13:08:12.000Z", importe: 230, cat: "bares", source: "macrodroid", comercio: "APOLLON GALLERY" },
    { fecha: ym + "-13T12:34:17.000Z", importe: 115, cat: "regalos", source: "macrodroid", comercio: "APOLLON GALLERY" },
  ];
  assert.equal(claveComoLaApp(gemelas[0]), claveComoLaApp(gemelas[1]), "misma clave: el banco es uno");
  const visibles = filasComoLaApp(gemelas, []);
  assert.equal(visibles.length, 2, "los dos 230 se juntan; el 115 se queda");
  const srv = statsDelMes(visibles, data, desdeMs);
  assert.equal(srv.spent, 345);
  const crudo = statsDelMes(gemelas, data, desdeMs);
  assert.equal(crudo.spent, 575, "sin juntar, el widget mentía sumando 230 de más");
});

t("★ las lápidas de la app también las respeta el servidor (gastos que él ya borró)", () => {
  const data = {
    budget: 1000,
    accounts: [{ ent: "trade_republic", role: "diario" }],
    settings: { expenseBanks: ["trade_republic"], gTotalMode: "split" },
  };
  const filas = [
    { fecha: d(2), importe: 88.11, cat: "transporte", source: "macrodroid", comercio: "Movimiento" },
    { fecha: d(3), importe: 12.6, cat: "cine", source: "macrodroid", comercio: "Cafe" },
  ];
  const k = claveComoLaApp(filas[0]);
  const visibles = filasComoLaApp(filas, [k]);
  const srv = statsDelMes(visibles, data, desdeMs);
  const app = cli.monthBudgetStats(Object.assign({}, data, {
    expenses: visibles.map((f) => ({ date: f.fecha, amount: f.importe, category: f.cat, source: f.source })),
    deleted: [k],
  }), nowMs);
  assert.equal(srv.spent, 12.6);
  assert.equal(srv.spent, c(app.spent));
});

t("★ cross-source misma entidad: app y servidor cuentan el mismo gasto (contención)", () => {
  /* Tras 1d-CONTENCION-A se conservan las dos filas (macrodroid con nombre + OB «Movimiento»).
     Comercios distintos → claves distintas → ambas entran al presupuesto; app y widget deben
     coincidir. No declara resueltos los gemelos Wallet/TR de misma clave. */
  const data = {
    budget: 1000,
    accounts: [{ ent: "trade_republic", role: "diario" }],
    settings: { expenseBanks: ["trade_republic"], gTotalMode: "split" },
    reservaLog: [],
  };
  const filas = [
    { fecha: d(2), importe: 9.5, cat: "tasas", source: "macrodroid", comercio: "Serveis Ambientals" },
    { fecha: d(3), importe: 9.5, cat: "otros", source: "ob:trade_republic", comercio: "Movimiento" },
  ];
  const visibles = filasComoLaApp(filas, []);
  assert.equal(visibles.length, 2, "claves distintas: se conservan las dos");
  const srv = statsDelMes(visibles, data, desdeMs);
  const app = cli.monthBudgetStats(Object.assign({}, data, {
    expenses: visibles.map((f) => ({
      date: f.fecha, amount: f.importe, category: f.cat, source: f.source, merchant: f.comercio,
    })),
  }), nowMs);
  assert.equal(srv.spent, 19);
  assert.equal(srv.spent, c(app.spent));
});

t("el banco sale del source igual que en el cliente", () => {
  assert.equal(bancoDeSource("macrodroid"), "trade_republic");
  assert.equal(bancoDeSource("ob:caixabank"), "caixabank");
  assert.equal(bancoDeSource("ob-hist:sabadell"), "sabadell");
  assert.equal(bancoDeSource("manual:revolut"), "revolut");
  assert.equal(bancoDeSource("manual"), null);              // a mano sin banco → cuenta siempre
  movsIgualQueElCliente();
});

/** El mapeo source→banco existe dos veces; que no se separen. */
function movsIgualQueElCliente() {
  ["macrodroid", "tr", "ob:caixabank", "ob:caixabank#dup", "ob-hist:sabadell", "manual:revolut", "manual", ""].forEach((s) => {
    assert.equal(bancoDeSource(s), cli.expenseBankOf({ source: s }), "source: " + s);
  });
}

/* ---------------------------------------------------------------------------
   B09-D (2026-09-08): EL POSIBLE REPETIDO TAMBIÉN TIENE QUE RESTAR EN EL SERVIDOR.

   Su queja, con capturas: el widget decía más gasto del mes que Inicio. Causa: `possibleDup`
   solo existía en el móvil. La app lo dejaba fuera del total y el servidor —que solo lee
   fecha/importe/comercio/cat/source— lo sumaba. Con una compra de 30, otra de 10 y un posible
   repetido de 30: la app decía 40 y el ingest 70.

   Estos tests NO comprueban una constante: hacen el viaje entero (app → fila de la nube →
   vuelta) y exigen que las dos implementaciones den el mismo número. Una marca que se escribe
   pero no se lee no arregla nada.
   --------------------------------------------------------------------------- */
console.log("presupuesto-servidor · posible repetido (B09-D)");

/** Los tres movimientos del caso, tal y como los tiene la app. */
const b09d = () => ({
  data: {
    budget: 1000,
    accounts: [{ ent: "trade_republic", role: "diario" }],
    settings: { expenseBanks: ["trade_republic"], gTotalMode: "split" },
    reservaLog: [],
  },
  gastos: [
    { date: d(3), amount: 30, category: "super", source: "ob", ent: "trade_republic", merchant: "Mercadona" },
    { date: d(4), amount: 10, category: "cine", source: "ob", ent: "trade_republic", merchant: "Filmin" },
    // el sospechoso: mismo importe que el primero, comercio distinto para que el dedup por
    // atributos no lo esconda y el defecto se vea de verdad
    { date: d(5), amount: 30, category: "super", source: "ob", ent: "trade_republic", merchant: "Movimiento",
      possibleDup: true, possibleDupOf: "x1" },
  ],
});

t("app y servidor dicen 40, no 40 y 70", () => {
  const { data, gastos } = b09d();
  // el viaje real: lo que la app sube → lo que la tabla guarda → lo que el servidor lee
  const filas = gastos.map((e) => ({
    fecha: e.date, importe: e.amount, cat: e.category, comercio: e.merchant,
    source: cli.expenseSourceForCloud(e),
  }));
  const app = cli.monthBudgetStats(Object.assign({}, data, { expenses: gastos }), nowMs);
  const srv = statsDelMes(filas, data, desdeMs);
  assert.equal(c(app.spent), 40, "la app ya lo excluía");
  assert.equal(srv.spent, 40, "el servidor tiene que excluirlo igual (antes: 70)");
  assert.equal(srv.spent, c(app.spent));
});

t("la marca sobrevive al viaje por la nube (subir y volver a bajar)", () => {
  const { data, gastos } = b09d();
  const vueltos = gastos.map((e) => cli.expenseFromRow({
    id: "row-" + e.merchant, fecha: e.date, importe: e.amount, cat: e.category,
    comercio: e.merchant, source: cli.expenseSourceForCloud(e),
  }));
  assert.equal(vueltos[2].possibleDup, true, "vuelve marcado tras un pull o una reinstalación");
  assert.equal(vueltos[0].possibleDup, undefined);
  assert.equal(vueltos[2].ent, "trade_republic", "y sin perder el banco: el filtro sigue funcionando");
  assert.equal(vueltos[2].source, "ob");
  // y con lo que vuelve de la nube la app sigue diciendo 40
  const app = cli.monthBudgetStats(Object.assign({}, data, { expenses: vueltos }), nowMs);
  assert.equal(c(app.spent), 40);
});

t("«son distintos» quita la marca en los dos lados", () => {
  const { data, gastos } = b09d();
  const resuelto = Object.assign({}, gastos[2]); delete resuelto.possibleDup; delete resuelto.possibleDupOf;
  const src = cli.expenseSourceForCloud(resuelto);
  assert.equal(src, "ob:trade_republic", "la fila de la nube vuelve a ser normal");
  assert.equal(esPosibleRepetido(src), false);
  const filas = [gastos[0], gastos[1], resuelto].map((e) => ({
    fecha: e.date, importe: e.amount, cat: e.category, comercio: e.merchant,
    source: cli.expenseSourceForCloud(e),
  }));
  const app = cli.monthBudgetStats(Object.assign({}, data, { expenses: [gastos[0], gastos[1], resuelto] }), nowMs);
  assert.equal(statsDelMes(filas, data, desdeMs).spent, 70, "ya cuenta: son dos cargos de verdad");
  assert.equal(statsDelMes(filas, data, desdeMs).spent, c(app.spent));
});

t("un servidor SIN desplegar tampoco lo suma (por eso es sufijo y no prefijo)", () => {
  // El `bancoDeSource` que hay hoy en el Supabase compartido, copiado tal cual: no conoce la marca.
  const viejo = (s) => {
    s = String(s || "");
    if (s === "macrodroid" || s === "tr") return "trade_republic";
    if (s.indexOf("ob:") === 0) return s.slice(3) || null;
    if (s.indexOf("ob-hist:") === 0) return s.slice(8) || null;
    if (s.indexOf("manual:") === 0) return s.slice(7) || null;
    return null;
  };
  const marcado = "ob:trade_republic#dup";
  assert.equal(viejo(marcado), "trade_republic#dup", "lee un banco raro, NO null");
  // y un banco que no está en su lista se queda fuera del presupuesto: el lado seguro
  assert.equal(["trade_republic"].indexOf(viejo(marcado)) >= 0, false);
  // con un prefijo nuevo («ob-dup:…») habría leído null → «a mano» → lo habría SUMADO
  assert.equal(viejo("ob-dup:trade_republic"), null);
  // el servidor nuevo sí lo entiende del todo
  assert.equal(bancoDeSource(marcado), "trade_republic");
  assert.equal(esPosibleRepetido(marcado), true);
  assert.equal(cuentaParaPresupuesto({ importe: 30, cat: "super", source: marcado }, ["trade_republic"]), false);
});

console.log("  ok");
