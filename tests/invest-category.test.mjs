#!/usr/bin/env node
/**
 * CATEGORÍA "INVERSIÓN" (2026-08-03): round-up/cashback/aporte automático de un bróker (Trade
 * Republic) que ahora llega como movimiento REAL de Open Banking, no como estimación local.
 *
 * Contexto: la cuenta de TR del usuario tenía `roundup`/`saveback`/`monthlyInvest` configurados, y
 * un simulador local (`reconcileTR`) los restaba del efectivo a final de mes SIN pasar por Gastos.
 * Al empezar a importar TAMBIÉN los movimientos reales de esa misma cuenta como gasto/ingreso
 * normal, el mismo dinero se contaba DOS veces. Estos tests fijan las tres garantías que lo cierran:
 *   1) El importe EXACTO configurado en `monthlyInvest` se reconoce solo al importar (dato conocido,
 *      no una suposición sobre lo que manda el banco — que no manda nada, ver `enablebanking.ts`).
 *   2) `applyInvestBuy`/`reverseInvestBuy` compran/deshacen participaciones de forma exacta y
 *      simétrica (mismo `shares`/`cInv` de vuelta, no recalculado — el cambio USD pudo moverse).
 *   3) `reconcileTR` deja de simular round-up/saveback/aporte en cuanto la cuenta ya tiene UN solo
 *      movimiento real (`source:"ob"`) — el dato real gana, no se suma encima.
 */
import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx = loadPureLogicFromFile();

function t(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
}

console.log("invest-category");

/* Reloj único local (B03). La app construye fechas de OB como `ymd + "T12:00:00"` (hora local)
   y las guarda con `.toISOString()`. Mezclar `toISOString().slice(0,10)` (día UTC) con
   `getFullYear/getMonth/getDate` (calendario local) o sufijo `Z` rompe en husos extremos. */
const NOW = new Date();
function ymdLocal(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function dayAt(offset, from) {
  from = from || NOW;
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset);
  return ymdLocal(d);
}
function dayAtStored(offset, from) {
  // Misma convención que importObExpenses al materializar la fila.
  return new Date(dayAt(offset, from) + "T12:00:00").toISOString();
}
function prevMonthKey(from) {
  from = from || NOW;
  const x = new Date(from.getFullYear(), from.getMonth() - 1, 1);
  return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0");
}
const today = dayAt(0);

t("prevMonthKey cruza el año de forma determinista (sin reloj real)", () => {
  assert.equal(prevMonthKey(new Date(2026, 0, 15)), "2025-12");
  assert.equal(prevMonthKey(new Date(2026, 8, 6)), "2026-08");
});

t("importObExpenses etiqueta 'inversion' SOLO el importe exacto de monthlyInvest", () => {
  const s = {
    accounts: [{ id: "acc1", ent: "trade_republic", role: "diario", spendFrom: true, monthlyInvest: 50, rewardInv: "inv1" }],
    expenses: [],
    settings: {},
  };
  const txs = [
    { ent: "trade_republic", id: null, date: today, amount: 50, merchant: "Movimiento", note: "", card: false, status: "BOOK" },
    { ent: "trade_republic", id: null, date: today, amount: 12.34, merchant: "Movimiento", note: "", card: false, status: "BOOK" },
  ];
  const add = ctx.importObExpenses(s, txs);
  assert.equal(add.length, 2);
  const cincuenta = add.find((e) => e.amount === 50);
  const otro = add.find((e) => e.amount === 12.34);
  assert.equal(cincuenta.category, "inversion", "el importe exacto configurado se reconoce solo");
  assert.notEqual(otro.category, "inversion", "un importe distinto no se adivina como inversión");
});

t("importObExpenses no confunde monthlyInvest si la cuenta no lo tiene configurado", () => {
  const s = {
    accounts: [{ id: "acc1", ent: "trade_republic", role: "diario", spendFrom: true }],
    expenses: [],
    settings: {},
  };
  const txs = [{ ent: "trade_republic", id: null, date: today, amount: 50, merchant: "Movimiento", note: "", card: false, status: "BOOK" }];
  const add = ctx.importObExpenses(s, txs);
  assert.notEqual(add[0].category, "inversion");
});

function estadoInversion() {
  return {
    accounts: [{ id: "acc1", ent: "trade_republic", rewardInv: "inv1" }],
    investments: [{ id: "inv1", cur: "EUR", shares: 10, value: 1000, cost: 900 }],
    trRewardsTotal: 0,
  };
}

t("applyInvestBuy compra participaciones al precio actual y acumula trRewardsTotal", () => {
  const s = estadoInversion();
  const r = ctx.applyInvestBuy(s, "trade_republic", 50);
  assert.ok(r, "debe encontrar la cuenta y su inversión enlazada");
  const inv = r.state.investments.find((i) => i.id === "inv1");
  assert.equal(inv.shares, 10.5, "50€ al precio de 100€/participación = 0.5 participaciones");
  assert.equal(inv.value, 1050);
  assert.equal(inv.cost, 950);
  assert.equal(r.state.trRewardsTotal, 50);
  assert.equal(r.shares, 0.5);
  assert.equal(r.cInv, 50);
});

t("applyInvestBuy devuelve null si la cuenta no tiene fondo enlazado (sin adivinar destino)", () => {
  const s = { accounts: [{ id: "acc1", ent: "sabadell" }], investments: [], trRewardsTotal: 0 };
  assert.equal(ctx.applyInvestBuy(s, "sabadell", 50), null);
});

t("reverseInvestBuy deshace EXACTAMENTE lo que applyInvestBuy compró (round-trip)", () => {
  const s = estadoInversion();
  const r = ctx.applyInvestBuy(s, "trade_republic", 50);
  const back = ctx.reverseInvestBuy(r.state, r.invId, r.shares, r.cInv, r.amountEur);
  const inv = back.investments.find((i) => i.id === "inv1");
  assert.equal(inv.shares, 10, "vuelve exactamente a las participaciones de partida");
  assert.equal(inv.value, 1000);
  assert.equal(inv.cost, 900);
  assert.equal(back.trRewardsTotal, 0);
});

t("reconcileTR SIGUE simulando round-up/saveback/aporte si la cuenta no tiene datos reales de OB", () => {
  const s = {
    trAnchor: prevMonthKey(),
    accounts: [{ id: "acc1", ent: "trade_republic", role: "diario", spendFrom: true, inject: 0, monthlyInvest: 50, rewardInv: "inv1", value: 500 }],
    investments: [{ id: "inv1", cur: "EUR", shares: 10, value: 1000, cost: 900 }],
    expenses: [], // sin ningún movimiento source:"ob" de esta cuenta
    trRewardsTotal: 0,
  };
  const ns = ctx.reconcileTR(s);
  const inv = ns.investments.find((i) => i.id === "inv1");
  assert.equal(inv.shares, 10.5, "sin dato real, el simulador antiguo sigue comprando el aporte estimado");
  assert.equal(inv.value, 1050);
});

t("reconcileTR DEJA de simular en cuanto la cuenta tiene un movimiento real (source:'ob')", () => {
  const s = {
    trAnchor: prevMonthKey(),
    accounts: [{ id: "acc1", ent: "trade_republic", role: "diario", spendFrom: true, inject: 0, monthlyInvest: 50, rewardInv: "inv1", value: 500 }],
    investments: [{ id: "inv1", cur: "EUR", shares: 10, value: 1000, cost: 900 }],
    expenses: [{ id: "e1", date: today, amount: 10, category: "otros", source: "ob", ent: "trade_republic" }],
    trRewardsTotal: 0,
  };
  const ns = ctx.reconcileTR(s);
  const inv = ns.investments.find((i) => i.id === "inv1");
  assert.equal(inv.shares, 10, "el dato real gana: no se suma otra vez encima el aporte estimado");
  assert.equal(inv.value, 1000);
  assert.equal(ns.trRewardsTotal, 0);
});

/* BUG 2026-08-04: "Movimiento" (el hueco que deja TR sin datos) NO es un comercio de verdad — al
 * marcar UNO como Inversión, `setCat` recategorizaba TODOS los gastos con ese mismo texto genérico
 * (de cualquier fecha/importe) y aprendía el override para siempre. `fixMovInvasion` repara el
 * estado ya dañado: quita el override envenenado y deshace la compra de cada gasto que NO sea el
 * aporte automático real. */
t("fixMovInvasion borra el override envenenado 'movimiento'→inversion", () => {
  const s = {
    catOverrides: { movimiento: "inversion" }, accounts: [], investments: [],
    expenses: [{ id: "e1", merchant: "Consum", amount: 5, category: "super" }],
  };
  const ns = ctx.fixMovInvasion(s);
  assert.equal(ns.catOverrides.movimiento, undefined);
});

/* El fallo del PRIMER intento (2026-08-04): los gastos no viven en `app_state`, llegan de la tabla
 * `expenses` en un segundo viaje. La limpieza corrió contra una lista vacía, se marcó como hecha y
 * no arregló ni un gasto — el usuario volvió a ver exactamente el mismo destrozo. */
t("fixMovInvasion NO se da por hecha si los gastos aún no han llegado de la nube", () => {
  const s = { catOverrides: { movimiento: "inversion" }, expenses: [], accounts: [], investments: [] };
  const ns = ctx.fixMovInvasion(s);
  assert.strictEqual(ns, s, "sin gastos delante no toca nada…");
  assert.ok(!ns._fixMovInvasion2, "…y sobre todo NO se marca como hecha: se reintenta cuando lleguen");
});

t("fixMovInvasion deshace los 'Movimiento' arrastrados a Inversión por error, deja el aporte real", () => {
  const s = {
    accounts: [{ id: "acc1", ent: "trade_republic", monthlyInvest: 50, rewardInv: "inv1" }],
    investments: [{ id: "inv1", cur: "EUR", shares: 20, value: 2000, cost: 1800 }],
    trRewardsTotal: 100,
    expenses: [
      // el aporte automático real (50€, coincide con monthlyInvest) → se queda
      { id: "eA", merchant: "Movimiento", amount: 50, ent: "trade_republic", category: "inversion",
        investInvId: "inv1", investShares: 0.5, investCInv: 50, investAmountEur: 50 },
      // arrastrado por el bug (8.38€, NO coincide con monthlyInvest) → se deshace
      { id: "eB", merchant: "Movimiento", amount: 8.38, ent: "trade_republic", category: "inversion",
        investInvId: "inv1", investShares: 0.0838, investCInv: 8.38, investAmountEur: 8.38 },
    ],
  };
  const ns = ctx.fixMovInvasion(s);
  const eA = ns.expenses.find((e) => e.id === "eA"), eB = ns.expenses.find((e) => e.id === "eB");
  assert.equal(eA.category, "inversion", "el aporte automático real no se toca");
  assert.ok(eA.investInvId, "conserva su compra real");
  assert.notEqual(eB.category, "inversion", "el arrastrado por el bug vuelve a su categoría normal");
  assert.equal(eB.investInvId, undefined, "y pierde el rastro de una compra que nunca debió pasar");
  const inv = ns.investments.find((i) => i.id === "inv1");
  assert.equal(inv.shares, 19.9162, "el fondo ya incluía las dos compras (20) y solo se deshace la del arrastre (-0.0838)");
});

t("fixMovInvasion es idempotente (no repite la limpieza en la siguiente carga)", () => {
  const s = {
    catOverrides: {}, accounts: [], investments: [],
    expenses: [{ id: "e1", merchant: "Consum", amount: 5, category: "super" }],
  };
  const once = ctx.fixMovInvasion(s);
  assert.ok(once._fixMovInvasion2, "con gastos delante sí se marca como hecha");
  const twice = ctx.fixMovInvasion(once);
  assert.strictEqual(twice, once, "con el flag puesto, la segunda vuelta no toca nada");
});

/* EL MISMO GASTO POR DOS CAMINOS (2026-08-04, medido en sus datos reales): sus compras de TR ya
 * entran por las notificaciones del móvil con el comercio de verdad; Open Banking las repite 1-2
 * días después y sin ningún dato. 9 de sus 22 movimientos de TR eran gemelos exactos. */
function estadoConMacroDroid(extra) {
  return {
    accounts: [{ id: "acc1", ent: "trade_republic", role: "diario", spendFrom: true, monthlyInvest: 50, rewardInv: "inv1" }],
    investments: [{ id: "inv1", cur: "EUR", shares: 10, value: 1000, cost: 900 }],
    settings: {},
    expenses: [
      { id: "m1", date: dayAtStored(-5), amount: 88.11, merchant: "Repsol", category: "transporte", source: "macrodroid" },
      { id: "m2", date: dayAtStored(-5), amount: -34.7, merchant: "Bizum recibido", category: "ingreso", source: "macrodroid" },
    ].concat(extra || []),
  };
}

t("un gasto que ya entró por el móvil NO se repite cuando el banco lo trae un día después sin nombre", () => {
  const s = estadoConMacroDroid();
  const txs = [{ ent: "trade_republic", id: null, date: dayAt(-4), amount: 88.11, merchant: "Movimiento", note: "", card: false, status: "BOOK" }];
  assert.equal(ctx.importObExpenses(s, txs), null, "mismo importe, un día después, sin nombre → es el mismo gasto");
});

t("lo mismo con los ingresos (el bizum que el banco repite sin decir de quién)", () => {
  const s = estadoConMacroDroid();
  const txs = [{ ent: "trade_republic", id: null, date: dayAt(-5), amount: -34.7, merchant: "Movimiento", note: "", card: false, status: "BOOK" }];
  assert.equal(ctx.importObExpenses(s, txs), null);
});

t("pero lo que SOLO ve el banco (round-up, cashback, aporte) sí entra", () => {
  const s = estadoConMacroDroid();
  const txs = [
    { ent: "trade_republic", id: null, date: dayAt(-4), amount: 50, merchant: "Movimiento", note: "", card: false, status: "BOOK" },
    { ent: "trade_republic", id: null, date: dayAt(-4), amount: 22.62, merchant: "Movimiento", note: "", card: false, status: "BOOK" },
  ];
  const add = ctx.importObExpenses(s, txs);
  assert.equal(add.length, 2, "ningún gemelo por otra vía → entran los dos");
  assert.equal(add.find((e) => e.amount === 50).category, "inversion", "y el aporte sigue reconociéndose");
});

t("el emparejamiento es 1 a 1: dos cargos iguales de verdad con uno solo apuntado dejan pasar el otro", () => {
  const s = estadoConMacroDroid();
  const txs = [
    { ent: "trade_republic", id: null, date: dayAt(-4), amount: 88.11, merchant: "Movimiento", note: "", card: false, status: "BOOK" },
    { ent: "trade_republic", id: null, date: dayAt(-4), amount: 88.11, merchant: "Movimiento", note: "", card: false, status: "BOOK" },
  ];
  const add = ctx.importObExpenses(s, txs);
  assert.equal(add.length, 1, "solo uno tenía gemelo; el segundo es un cargo real distinto");
});

t("si el banco SÍ dice el comercio no se aplica esta red (ahí manda el dedup de siempre)", () => {
  const s = estadoConMacroDroid();
  const txs = [{ ent: "trade_republic", id: null, date: dayAt(-4), amount: 88.11, merchant: "Repsol", note: "", card: false, status: "BOOK" }];
  const add = ctx.importObExpenses(s, txs);
  assert.equal(add.length, 1, "con nombre no hay ambigüedad: se respeta el criterio clásico día+importe+comercio");
});

t("fixMovInvasion retira los duplicados que YA estaban guardados, y deja el del comercio de verdad", () => {
  const s = {
    accounts: [{ id: "acc1", ent: "trade_republic", monthlyInvest: 50, rewardInv: "inv1" }],
    investments: [{ id: "inv1", cur: "EUR", shares: 10, value: 1000, cost: 900 }],
    catOverrides: {}, deleted: [],
    expenses: [
      { id: "m1", date: dayAtStored(-5), amount: 88.11, merchant: "Repsol", category: "transporte", source: "macrodroid" },
      { id: "o1", date: dayAtStored(-4), amount: 88.11, merchant: "Movimiento", category: "otros", source: "ob", ent: "trade_republic" },
      { id: "o2", date: dayAtStored(-4), amount: 50, merchant: "Movimiento", category: "inversion", source: "ob", ent: "trade_republic" },
      { id: "o3", date: dayAtStored(-4), amount: 22.62, merchant: "Movimiento", category: "otros", source: "ob", ent: "trade_republic" },
    ],
  };
  const ns = ctx.fixMovInvasion(s);
  const ids = ns.expenses.map((e) => e.id);
  assert.ok(ids.includes("m1"), "el que trae el comercio de verdad SIEMPRE se queda");
  assert.ok(!ids.includes("o1"), "el duplicado sin nombre se retira");
  assert.ok(ids.includes("o2"), "el aporte automático real no se toca");
  assert.ok(ids.includes("o3"), "lo que solo ve el banco (round-up) se queda");
  assert.ok(ns.deleted.length >= 1, "queda marcado como borrado para que el pull de la nube no lo resucite");
});

t("un gasto viejo del mismo importe (fuera de la ventana de 3 días) no tapa uno nuevo", () => {
  const s = estadoConMacroDroid();
  // Macro hace 20 días; banco hoy (>3 días) → no es gemelo. La fecha del banco sigue dentro
  // de la ventana de import (día 1 − 8 días), porque es "hoy".
  s.expenses = [
    { id: "m1", date: dayAtStored(-20), amount: 88.11, merchant: "Repsol", category: "transporte", source: "macrodroid" },
    { id: "m2", date: dayAtStored(-20), amount: -34.7, merchant: "Bizum recibido", category: "ingreso", source: "macrodroid" },
  ];
  const txs = [{ ent: "trade_republic", id: null, date: dayAt(0), amount: 88.11, merchant: "Movimiento", note: "", card: false, status: "BOOK" }];
  const add = ctx.importObExpenses(s, txs);
  assert.equal(add.length, 1, "más de 3 días después es otro cargo, no el mismo");
});

/* BUG 2026-08-04 (segunda vuelta, dos quejas suyas con la app de TR delante):
 *   a) «un gasto de una cabina de zona azul de 9,50 € me lo detecta como Inversión» — el override
 *      envenenado "movimiento"→inversion sobrevivió a la limpieza (que corre UNA vez, bajo flag) y
 *      `migrate` re-categoriza en cada carga todo gasto en "otros" que no sea manual.
 *   b) «el cashback me lo detecta duplicado en Inversiones y luego como ingreso» — TR abona el
 *      saveback al efectivo y días después lo retira para comprar el fondo: dos apuntes, un solo
 *      movimiento de dinero. */
/* El blindaje de dentro de `autoCategory` (no devolver nunca una categoría neutra por mucho que un
 * override apunte ahí) no se puede ejercitar desde aquí: `USER_OVERRIDES` es `let` y las
 * declaraciones `const`/`let` del monolito no salen al sandbox `vm` —solo las `function`—, así que
 * inyectarlo desde fuera probaría una propiedad que el código no lee. Lo que sí se comprueba de
 * verdad es la otra mitad, la que borra el override en origen (`seedFlows`, aquí debajo), que es
 * además la que arregla el estado ya envenenado del usuario. */
t("autoCategory no cae en una categoría neutra por sus propias keywords", () => {
  ["Movimiento", "Ingreso", "Transferencia", "Inversion", "Traspaso"].forEach((m) => {
    const c = ctx.autoCategory(m);
    assert.ok(c !== "inversion" && c !== "traspaso", `"${m}" no debe autodetectarse como categoría neutra (dio "${c}")`);
  });
});

t("seedFlows borra cualquier override que apunte a 'inversion' (sin flag, en cada carga)", () => {
  const s = { catOverrides: { movimiento: "inversion", playtomic: "padel" } };
  const ns = ctx.seedFlows(s);
  assert.equal(ns.catOverrides.movimiento, undefined, "el envenenado se va");
  assert.equal(ns.catOverrides.playtomic, "padel", "los buenos se quedan");
});

t("findCashbackTwin empareja la entrada del cashback con su salida al fondo", () => {
  const exps = [
    { id: "in", date: "2026-08-01T12:00:00Z", amount: -8.38, merchant: "Movimiento", ent: "trade_republic", category: "ingreso" },
    { id: "out", date: "2026-08-03T12:00:00Z", amount: 8.38, merchant: "Movimiento", ent: "trade_republic", category: "otros" },
  ];
  const i = ctx.findCashbackTwin(exps, exps[1]);
  assert.equal(exps[i].id, "in", "encuentra la entrada gemela de dos días antes");
});

t("findCashbackTwin NO toca un ingreso con nombre real (un bizum de un amigo del mismo importe)", () => {
  const exps = [
    { id: "biz", date: "2026-08-01T12:00:00Z", amount: -8.38, merchant: "Bizum recibido", ent: "trade_republic", category: "ingreso" },
    { id: "out", date: "2026-08-03T12:00:00Z", amount: 8.38, merchant: "Movimiento", ent: "trade_republic", category: "otros" },
  ];
  assert.equal(ctx.findCashbackTwin(exps, exps[1]), -1, "con comercio de verdad es dinero real, no el par del cashback");
});

t("findCashbackTwin exige que la entrada vaya ANTES que la salida y dentro de 10 días", () => {
  const despues = [
    { id: "in", date: "2026-08-20T12:00:00Z", amount: -8.38, merchant: "Movimiento", ent: "trade_republic", category: "ingreso" },
    { id: "out", date: "2026-08-03T12:00:00Z", amount: 8.38, merchant: "Movimiento", ent: "trade_republic", category: "otros" },
  ];
  assert.equal(ctx.findCashbackTwin(despues, despues[1]), -1, "un ingreso posterior no es la entrada de esta salida");
  const lejos = [
    { id: "in", date: "2026-07-01T12:00:00Z", amount: -8.38, merchant: "Movimiento", ent: "trade_republic", category: "ingreso" },
    { id: "out", date: "2026-08-03T12:00:00Z", amount: 8.38, merchant: "Movimiento", ent: "trade_republic", category: "otros" },
  ];
  assert.equal(ctx.findCashbackTwin(lejos, lejos[1]), -1, "un mes antes ya no es el mismo movimiento");
});

/* VENTANA DE FIN DE MES (2026-08-04). Su nómina llega a Sabadell y él se traspasa a Trade Republic
 * lo del mes: +1.620 € el 31 de julio, con el bizum del piso de 70 € y varios gastos ese mismo día.
 * Con el corte en el día 1 a secas, TODO eso se tiraba antes de llegar a la app — y sin ese ingreso
 * apuntado, «Mi ciclo» (`lastPaydayOf`) no tiene a qué anclarse y se queda en el mes natural. */
t("importObExpenses recoge el traspaso y los gastos del ÚLTIMO DÍA del mes anterior", () => {
  const hoy = new Date();
  const finMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0).toISOString().slice(0, 10);
  const s = {
    accounts: [{ id: "acc1", ent: "trade_republic", role: "diario", spendFrom: true }],
    expenses: [], settings: {},
  };
  const txs = [
    { ent: "trade_republic", id: null, date: finMesAnterior, amount: -1620, merchant: "Movimiento", note: "", card: false, status: "BOOK" },
    { ent: "trade_republic", id: null, date: finMesAnterior, amount: 70, merchant: "Movimiento", note: "", card: false, status: "BOOK" },
  ];
  const add = ctx.importObExpenses(s, txs) || [];
  assert.equal(add.length, 2, "el traspaso y el bizum del último día del mes ya no se pierden");
  assert.ok(add.some((e) => e.amount === -1620), "el ingreso que ancla el ciclo entra");
});

/* TRASPASO PROPIO (2026-08-04, decisión suya): el dinero que se manda de Sabadell a TR para el mes
 * se apunta —«Mi ciclo» se ancla a él— pero NO es dinero nuevo, así que no suma a los ingresos: el
 * día que se conecte también el banco de ORIGEN, contaría dos veces. */
function estadoConTraspasoModelado() {
  return {
    accounts: [{ id: "acc1", ent: "trade_republic", role: "diario", spendFrom: true }],
    flows: [{ id: "f1", kind: "transfer", name: "A Trade Republic", amount: 1550, from: "sabadell", to: "trade_republic" }],
    expenses: [], settings: {},
  };
}

t("un ingreso grande sin nombre en la cuenta con traspaso modelado se marca 'traspaso'", () => {
  const s = estadoConTraspasoModelado();
  const txs = [{ ent: "trade_republic", id: null, date: today, amount: -1620, merchant: "Movimiento", note: "", card: false, status: "BOOK" }];
  const add = ctx.importObExpenses(s, txs);
  assert.equal(add[0].category, "traspaso", "aunque el importe no cuadre con el modelado: lo que traspasa varía cada mes");
});

t("…pero un cobro CON nombre sigue siendo ingreso de verdad", () => {
  const s = estadoConTraspasoModelado();
  const txs = [{ ent: "trade_republic", id: null, date: today, amount: -1620, merchant: "ACME NOMINA SL", note: "", card: false, status: "BOOK" }];
  assert.equal(ctx.importObExpenses(s, txs)[0].category, "ingreso");
});

t("…y sin traspaso modelado hacia esa cuenta, tampoco se inventa nada", () => {
  const s = estadoConTraspasoModelado();
  s.flows = [];
  const txs = [{ ent: "trade_republic", id: null, date: today, amount: -1620, merchant: "Movimiento", note: "", card: false, status: "BOOK" }];
  assert.equal(ctx.importObExpenses(s, txs)[0].category, "ingreso");
});

t("…y un bizum pequeño sin nombre no se confunde con el traspaso del mes", () => {
  const s = estadoConTraspasoModelado();
  const txs = [{ ent: "trade_republic", id: null, date: today, amount: -30, merchant: "Movimiento", note: "", card: false, status: "BOOK" }];
  assert.equal(ctx.importObExpenses(s, txs)[0].category, "ingreso", "por debajo del umbral de «Mi ciclo» no es un traspaso");
});

t("«Mi ciclo» SIGUE anclándose al traspaso (mira el importe, no la categoría)", () => {
  const hace2 = new Date(Date.now() - 2 * 86400000).toISOString();
  const exps = [{ id: "t1", date: hace2, amount: -1620, merchant: "Movimiento", category: "traspaso" }];
  const p = ctx.lastPaydayOf(exps);
  assert.ok(p, "el traspaso sirve de ancla del ciclo");
  assert.equal(p.inc.id, "t1");
});

/* Que «traspaso» e «inversión» no sumen a gasto/ingreso lo decide `CAT_NEUTRAS` dentro de
 * `monthSummary` (04-tab-gastos.js). Ni la constante ni el useMemo del componente salen al sandbox,
 * así que eso se verifica en el e2e de la app real; aquí se fija el contrato de la etiqueta, que es
 * lo que alimenta ese cálculo. */
t("las categorías neutras quedan etiquetadas como tales en el apunte", () => {
  const s = estadoConTraspasoModelado();
  const txs = [{ ent: "trade_republic", id: null, date: today, amount: -1620, merchant: "Movimiento", note: "", card: false, status: "BOOK" }];
  assert.equal(ctx.importObExpenses(s, txs)[0].category, "traspaso");
});

t("…pero la ventana no arrastra meses enteros de histórico en cada sync", () => {
  const s = {
    accounts: [{ id: "acc1", ent: "trade_republic", role: "diario", spendFrom: true }],
    expenses: [], settings: {},
  };
  const viejo = new Date(Date.now() - 40 * 86400000).toISOString().slice(0, 10);
  const txs = [{ ent: "trade_republic", id: null, date: viejo, amount: 33, merchant: "Movimiento", note: "", card: false, status: "BOOK" }];
  assert.equal(ctx.importObExpenses(s, txs), null, "40 días atrás sigue fuera de la ventana");
});

/* LA PASADA DEFINITIVA (2026-08-04, tercera vuelta). Las dos limpiezas anteriores fallaron por lo
 * mismo: iban con flag (se marcaban hechas y ya no volvían a entrar) y solo tocaban el array local
 * (la fila seguía viva en la tabla de la nube y volvía al reconectar el banco). Esta corre siempre,
 * es idempotente, y devuelve lo que hay que borrar/recategorizar EN LA NUBE. */
function estadoConDupes() {
  return {
    accounts: [{ id: "a1", ent: "trade_republic", role: "diario", spendFrom: true, rewardInv: "inv1", monthlyInvest: 50 }],
    investments: [{ id: "inv1", cur: "EUR", shares: 10, value: 1000, cost: 900 }],
    expenses: [
      // duplicado: el bueno (con nombre, del móvil) y el del banco un día después sin nombre
      { id: "bueno", date: "2026-08-02T12:00:00Z", amount: 9.5, merchant: "Serveis Ambientals", category: "tasas", source: "macrodroid", ent: "trade_republic" },
      { id: "dupe", date: "2026-08-03T12:00:00Z", amount: 9.5, merchant: "Movimiento", category: "otros", source: "ob", ent: "trade_republic" },
      // par del cashback: entra el 1 y sale el 3
      { id: "cbIn", date: "2026-08-01T12:00:00Z", amount: -8.38, merchant: "Movimiento", category: "ingreso", source: "ob", ent: "trade_republic" },
      { id: "cbOut", date: "2026-08-03T12:00:00Z", amount: 8.38, merchant: "Movimiento", category: "otros", source: "ob", ent: "trade_republic" },
      // el aporte automático real: ni se borra ni se toca
      { id: "aporte", date: "2026-08-03T12:00:00Z", amount: 50, merchant: "Movimiento", category: "inversion", source: "ob", ent: "trade_republic" },
    ],
  };
}

t("reconcileObDupes borra el duplicado sin nombre y deja el que trae el comercio de verdad", () => {
  const r = ctx.reconcileObDupes(estadoConDupes());
  assert.ok(r.borrar.some((e) => e.id === "dupe"), "el del banco sin nombre se va");
  assert.ok(!r.borrar.some((e) => e.id === "bueno"), "el que tiene el nombre real se queda SIEMPRE");
  assert.ok(r.state.expenses.some((e) => e.id === "bueno"));
  assert.ok(!r.state.expenses.some((e) => e.id === "dupe"));
});

/* «Del cashback solo debe haber 1, solo pagan 1 vez al mes» (corrección suya). El banco lo apunta
 * dos veces —entra el día 1 y sale hacia el fondo el día 3, el primer día laborable— pero es un
 * solo movimiento: se deja UNA línea, la salida marcada Inversión, y la entrada se borra. */
t("reconcileObDupes deja UNA sola línea del cashback: la salida, marcada Inversión", () => {
  const r = ctx.reconcileObDupes(estadoConDupes());
  const cbOut = r.state.expenses.find((e) => e.id === "cbOut");
  assert.ok(cbOut, "la salida hacia el fondo se queda");
  assert.equal(cbOut.category, "inversion");
  assert.ok(!r.state.expenses.some((e) => e.id === "cbIn"), "su entrada se va: es el mismo movimiento, no dos");
  assert.ok(r.borrar.some((e) => e.id === "cbIn"), "y se borra también en la nube");
});

t("reconcileObDupes NO toca el aporte automático real ni lo confunde con un duplicado", () => {
  const r = ctx.reconcileObDupes(estadoConDupes());
  const ap = r.state.expenses.find((e) => e.id === "aporte");
  assert.ok(ap, "sigue ahí");
  assert.equal(ap.category, "inversion");
});

t("reconcileObDupes devuelve lo que hay que aplicar EN LA NUBE (no solo en el móvil)", () => {
  const r = ctx.reconcileObDupes(estadoConDupes());
  assert.ok(r.borrar.length > 0, "las filas a borrar de la tabla");
  assert.ok(r.recat.length > 0, "y las recategorizaciones a persistir");
  r.recat.forEach((x) => assert.ok(x.expense && x.cat, "cada una con su gasto y su categoría"));
});

t("reconcileObDupes es IDEMPOTENTE: la segunda pasada no toca nada (corre en cada sync, sin flag)", () => {
  const r1 = ctx.reconcileObDupes(estadoConDupes());
  const r2 = ctx.reconcileObDupes(r1.state);
  assert.equal(r2.borrar.length, 0);
  assert.equal(r2.recat.length, 0);
  assert.strictEqual(r2.state, r1.state, "mismo objeto: cero renders de más");
});

t("reconcileObDupes deja en paz un gasto de banco que NO repite nada (aunque no tenga nombre)", () => {
  const s = estadoConDupes();
  s.expenses = [{ id: "solo", date: "2026-08-03T12:00:00Z", amount: 22.62, merchant: "Movimiento", category: "otros", source: "ob", ent: "trade_republic" }];
  const r = ctx.reconcileObDupes(s);
  assert.equal(r.borrar.length, 0, "sin gemelo por otra vía no es un duplicado");
  assert.equal(r.state.expenses[0].category, "otros", "y sin par de cashback tampoco se marca solo");
});

console.log("\ninvest-category: OK");
