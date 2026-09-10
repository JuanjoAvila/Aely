#!/usr/bin/env node
/**
 * FIN-07 — EL HISTÓRICO ENTERO, Y QUE UNA CONSULTA A MEDIAS NO BORRE NADA.
 *
 * Su queja del 10/9: «solo baja el historico de revolut un poquito y de trade republic».
 * La causa no era el importador: `pullExpenses` traía como mucho **2.000 filas y sin paginar**, y
 * `syncCloudExpenses` REEMPLAZA los gastos de origen `supabase` por lo que llega. Con más de 2.000
 * gastos en la nube —lo normal tras importar el histórico de un banco— cada sincronización le
 * BORRABA de la app los más viejos.
 *
 * Aquí se comprueban las dos mitades, y las dos con un doble de Supabase que cuenta las llamadas:
 *   1. que se pagina hasta el final, con orden estable;
 *   2. que si el pull se queda corto, NO se toma la ausencia por un borrado.
 *
 * El segundo es el que de verdad da miedo. Perder gastos suyos es el fallo caro de esta app y ya
 * pasó una vez; la regla desde la contención 4.18.6 es que nunca se borra por ausencia.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const core = readFileSync(join(root, "src/modules/00-core.js"), "utf8");
const main = readFileSync(join(root, "src/modules/11-app-main.js"), "utf8");

function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}`); throw e; }
}
console.log("pull-historico-entero");

/** Saca `pullExpenses` del módulo y lo hace ejecutable con un doble de `sb`.
 *  Se lee del fichero de verdad —no una copia— para que el test no pueda quedarse verde
 *  mientras alguien cambia el original. */
function pullConDoble(totalFilas, opts = {}) {
  const ini = core.indexOf("    async pullExpenses(){");
  assert.ok(ini > 0, "no encuentro pullExpenses en 00-core.js");
  const fin = core.indexOf("\n    },", ini);
  const cuerpo = core.slice(ini, fin + 7).replace(/^\s*async pullExpenses\(\)\{/, "");
  const codigo = cuerpo.slice(0, cuerpo.lastIndexOf("}"));

  const llamadas = [];
  const sb = {
    from() {
      const q = {
        select() { return q; },
        order(campo, o) { q._orden = (q._orden || []).concat(campo + (o && o.ascending ? " asc" : " desc")); return q; },
        range(a, b) {
          llamadas.push({ desde: a, hasta: b, orden: (q._orden || []).join(", ") });
          const filas = [];
          for (let i = a; i <= b && i < totalFilas; i++) filas.push({ id: "f" + i, fecha: "2026-09-01", importe: 1 });
          return Promise.resolve({ data: filas, error: opts.error || null });
        },
        limit() { return q; },
      };
      return q;
    },
  };
  const fn = new Function("sb", "return (async function(){" + codigo + "})();");
  return fn(sb).then((filas) => ({ filas, llamadas }));
}

await (async () => {
  await t("con 4.500 gastos los trae TODOS, no los 2.000 de antes", async () => {
    const { filas, llamadas } = await pullConDoble(4500);
    assert.equal(filas.length, 4500, "se han quedado gastos suyos fuera");
    assert.ok(llamadas.length >= 5, "debería haber paginado, y solo hizo " + llamadas.length + " consulta(s)");
    assert.equal(filas._mcPullCapped, undefined, "4.500 no es un caso raro: no debe avisar de recorte");
  });

  await t("★ ordena por fecha Y por id: sin desempate, paginar pierde y repite filas", async () => {
    const { llamadas } = await pullConDoble(2500);
    assert.ok(/fecha desc/.test(llamadas[0].orden), "falta el orden por fecha");
    assert.ok(/id desc/.test(llamadas[0].orden),
      "sin un segundo criterio ÚNICO, dos gastos del mismo día pueden salir en distinto orden entre " +
      "páginas: uno se repite y otro se pierde. Y lo que se pierde son gastos suyos.");
  });

  await t("las páginas van seguidas y sin solaparse (ni huecos ni repetidos)", async () => {
    const { llamadas } = await pullConDoble(3300);
    for (let i = 1; i < llamadas.length; i++) {
      assert.equal(llamadas[i].desde, llamadas[i - 1].hasta,
        "hueco o solape entre la página " + (i - 1) + " y la " + i + " (se pide una fila de más a propósito, así que el inicio de una página coincide con el fin de la anterior)");
    }
  });

  await t("justo en el borde de una página no pide una vuelta de más", async () => {
    const { filas, llamadas } = await pullConDoble(1000);
    assert.equal(filas.length, 1000);
    assert.equal(llamadas.length, 1, "con 1.000 exactos basta una consulta");
  });

  await t("sin gastos no revienta y no pide nada raro", async () => {
    const { filas, llamadas } = await pullConDoble(0);
    assert.equal(filas.length, 0);
    assert.equal(llamadas.length, 1);
  });
})();

/* ── La mitad que da miedo: qué hace la mezcla con un pull incompleto ───────── */

t("★ un pull A MEDIAS no puede borrar gastos: se añade, no se reemplaza", () => {
  const i = main.indexOf("const parcial=!!(rows&&rows._mcPullCapped);");
  assert.ok(i > 0,
    "syncCloudExpenses ya no distingue una consulta parcial de un borrado. Sin eso, un pull corto " +
    "—red que se corta, tope, error del servidor— descarta de la app todo lo de origen `supabase` " +
    "que no haya llegado. Es exactamente cómo se le borraron los gastos viejos.");
  const bloque = main.slice(i, i + 400);
  assert.ok(/parcial\s*\?\s*prev\.expenses\.slice\(\)/.test(bloque),
    "con la consulta incompleta hay que CONSERVAR lo que ya había, no filtrarlo");
});

t("el aviso de recorte ya no promete «los 2.000 más recientes»", () => {
  const i18n = readFileSync(join(root, "src/modules/01-i18n.js"), "utf8");
  assert.ok(!/exp_pull_capped:"[^"]*2\.?000/.test(i18n),
    "el texto seguía hablando de un tope de 2.000 que ya no existe");
  assert.ok(/exp_pull_capped:"[^"]*NO se ha borrado/.test(i18n),
    "si se avisa de que no cupo todo, hay que decirle que no ha perdido nada: eso es lo que le " +
    "preocupa a él, no el número");
});

console.log("pull-historico-entero: OK");
