#!/usr/bin/env node
/**
 * FIN-07 — EL HISTÓRICO ENTERO, Y QUE UNA DESCARGA A MEDIAS NO BORRE NADA.
 *
 * Su queja del 10/9: «solo baja el histórico de Revolut un poquito y de Trade Republic».
 * No era el importador. `pullExpenses` traía como mucho **2.000 filas con un `.limit()` a secas**, y
 * `syncCloudExpenses` REEMPLAZA los gastos de origen `supabase` por lo que acaba de llegar. Con más
 * de 2.000 gastos en la nube —lo normal tras importar el histórico de un banco— cada sincronización
 * BORRABA de la app los más viejos. Estaba así también en producción (4.18.8), o sea que le pasaba
 * a toda la familia, no solo a él.
 *
 * Se comprueban las dos mitades, las dos contra el código de verdad del módulo:
 *   1. que se pagina por clave hasta el final, con orden estable;
 *   2. que si la descarga se queda corta, la ausencia NO se toma por un borrado.
 *
 * La segunda es la que da miedo. Perder gastos suyos es el fallo caro de esta app y ya pasó una vez;
 * la regla desde la contención 4.18.6 es que nunca se borra por ausencia.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const core = readFileSync(join(root, "src/modules/00-core.js"), "utf8");
const main = readFileSync(join(root, "src/modules/11-app-main.js"), "utf8");

let fallos = 0;
async function t(name, fn) {
  try { await fn(); console.log(`  \u2713 ${name}`); }
  catch (e) { fallos++; console.error(`  \u2717 ${name}\n      ${e.message}`); }
}
console.log("pull-historico-entero");

/* Se saca la función DEL FICHERO, no una copia: así el test no puede quedarse verde
   mientras alguien cambia el original. */
function cargaPaginador() {
  const ini = core.indexOf("async function mcPullExpensesPaged(");
  assert.ok(ini > 0, "no encuentro mcPullExpensesPaged en 00-core.js");
  const fin = core.indexOf("\n}", ini);
  const src = core.slice(ini, fin + 2);
  return new Function(src + "; return mcPullExpensesPaged;")();
}

/* Doble de la tabla: filas ordenadas por fecha desc, id desc, y un `fetchPage` que solo sabe
   responder a un cursor —como PostgREST—. Cuenta las consultas para poder afirmar cuántas hubo. */
function tablaFalsa(total) {
  const filas = [];
  for (let i = 0; i < total; i++) {
    // Varios gastos por día a propósito: es el caso en el que el desempate por id importa.
    const dia = String(1 + (i % 28)).padStart(2, "0");
    filas.push({ id: String(100000 + (total - i)), fecha: "2026-09-" + dia, importe: 1 });
  }
  filas.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : (a.id < b.id ? 1 : -1)));
  const llamadas = [];
  const fetchPage = async (cursor) => {
    llamadas.push(cursor);
    let desde = 0;
    if (cursor) {
      desde = filas.findIndex((f) => f.fecha === cursor.fecha && f.id === cursor.id) + 1;
      assert.ok(desde > 0, "el cursor apunta a una fila que no existe");
    }
    return filas.slice(desde, desde + 1000);
  };
  return { filas, fetchPage, llamadas };
}

await (async () => {
  const paginar = cargaPaginador();

  await t("con 4.500 gastos los trae TODOS, no los 2.000 de antes", async () => {
    const { fetchPage, llamadas } = tablaFalsa(4500);
    const r = await paginar(fetchPage, 1000, 50);
    assert.equal(r.rows.length, 4500, "se han quedado gastos suyos fuera");
    assert.equal(r.capped, false, "4.500 no es un caso raro: no debe avisar de recorte");
    assert.ok(llamadas.length >= 5, "debería haber paginado, y solo hizo " + llamadas.length);
  });

  await t("\u2605 ni repite ni se salta ninguno: cada gasto aparece una sola vez", async () => {
    const { fetchPage } = tablaFalsa(3300);
    const r = await paginar(fetchPage, 1000, 50);
    const ids = new Set(r.rows.map((x) => x.id));
    assert.equal(ids.size, 3300,
      "hay filas repetidas o perdidas al cambiar de página. Y lo que se pierde son gastos suyos.");
  });

  await t("\u2605 el orden desempata por id: sin eso, paginar pierde y repite", () => {
    const i = core.indexOf("async pullExpenses(){");
    const bloque = core.slice(i, i + 1200);
    assert.ok(/order\('fecha',\{ascending:false\}\)/.test(bloque), "falta el orden por fecha");
    assert.ok(/order\('id',\{ascending:false\}\)/.test(bloque),
      "sin un segundo criterio ÚNICO, dos gastos del MISMO día pueden salir en distinto orden " +
      "entre páginas: uno se repite y otro se pierde");
  });

  await t("se pide «lo que va después», no un desplazamiento", () => {
    const i = core.indexOf("async pullExpenses(){");
    const bloque = core.slice(i, i + 1200);
    assert.ok(/fecha\.lt\./.test(bloque) && /fecha\.eq\./.test(bloque),
      "debe paginar por clave; con .range()/offset, un gasto que entre a mitad de la descarga " +
      "corre la lista y te hace saltarte una fila");
    assert.ok(!/\.range\(/.test(bloque), "no debe quedar paginación por desplazamiento");
  });

  await t("una página corta corta la descarga: no gasta consultas de más", async () => {
    const { fetchPage, llamadas } = tablaFalsa(1500);
    const r = await paginar(fetchPage, 1000, 50);
    assert.equal(r.rows.length, 1500);
    assert.equal(llamadas.length, 2, "con 1.500 bastan dos consultas");
  });

  await t("sin gastos no revienta y solo pregunta una vez", async () => {
    const { fetchPage, llamadas } = tablaFalsa(0);
    const r = await paginar(fetchPage, 1000, 50);
    assert.equal(r.rows.length, 0);
    assert.equal(r.capped, false);
    assert.equal(llamadas.length, 1);
  });

  await t("si se llega al tope de seguridad, lo dice (no calla y recorta)", async () => {
    const { fetchPage } = tablaFalsa(5000);
    const r = await paginar(fetchPage, 1000, 3);
    assert.equal(r.rows.length, 3000);
    assert.equal(r.capped, true, "un recorte silencioso es justo lo que le borraba los gastos");
  });
})();

/* ── La mitad que da miedo: qué hace la mezcla con una descarga incompleta ───── */

await t("\u2605 una descarga A MEDIAS no puede borrar gastos: se añade, no se reemplaza", () => {
  /* Antes se exigía `parcial ? prev.expenses.slice() : filter(supabase)`. Ese filtro murió
     (expenseFromRow ya no emite "supabase") y el pull dejó de refrescar. Ahora la mezcla es
     `mergeExpensesFromCloud`, que NUNCA borra por ausencia — parcial o no. */
  assert.ok(main.indexOf("mergeExpensesFromCloud(prev.expenses, incoming)") > 0,
    "syncCloudExpenses tiene que mezclar con mergeExpensesFromCloud (refresco sin borrar)");
  assert.ok(core.indexOf("function mergeExpensesFromCloud") > 0,
    "mergeExpensesFromCloud tiene que vivir en 00-core, no una copia en el sync");
  assert.ok(!/prev\.expenses\.filter\(function\(e\)\{\s*return e\.source!=="supabase"/.test(main),
    "el filtro source!==supabase está muerto y volvía a mentir: no puede volver");
});

await t("y avisa en cristiano de que no ha perdido nada", () => {
  const i18n = readFileSync(join(root, "src/modules/01-i18n.js"), "utf8");
  assert.ok(/exp_pull_capped:"[^"]*NO se ha borrado/.test(i18n),
    "si se avisa de que no cupo todo, hay que decirle que no ha perdido nada: eso es lo que le " +
    "preocupa, no el número");
  assert.equal((i18n.match(/exp_pull_capped:/g) || []).length, 3, "falta el aviso en algún idioma");
});

if (fallos) { console.error(`pull-historico-entero: ${fallos} FALLO(S)`); process.exit(1); }
console.log("pull-historico-entero: OK");
