#!/usr/bin/env node
/**
 * EL HISTÓRICO COMPARA EL DÍA EN HORA LOCAL, COMO TODO LO DEMÁS.
 *
 * Su rechazo del 12/9 de `4.19.27/historico-la-lista`: «salen un montonazo de repetidos…
 * actualmente solo estaba mirando de septiembre dado que ya me los sé, y están TODOS apuntados
 * correctamente, así que los que salen que "no son repetidos" sí que lo son y están mal».
 *
 * Causa: `histCandDupKey` partía el día con `String(dt).slice(0,10)`, o sea el día **UTC** del
 * texto guardado. En España (UTC+2 en verano) una compra hecha entre las 00:00 y las 02:00 se
 * guarda con un ISO del día ANTERIOR. El banco manda su día de verdad, los dos días no coinciden
 * y el candidato sale marcado como NUEVO estando ya apuntado.
 *
 * Es la TERCERA vez que muerde la misma regla: antes fue la cabecera de Gastos (el mismo día
 * salía dos veces) y el orden a mano (arrastrar un gasto de madrugada no hacía nada). La regla
 * buena ya vivía en `00-core` (`dayKey` / `diaDeGasto`) y aquí quedaba una copia sin migrar.
 *
 * ⚠ Se fija el huso a Europe/Madrid a propósito: en una máquina en UTC —como el CI— el fallo NO
 * se reproduce, y un verde así no valdría para nada.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (process.env.MC_TZ_OK !== "1") {
  // Sin el try, un rojo del hijo sale como un volcado de `execFileSync` de 60 líneas y el
  // motivo de verdad queda enterrado. Se reenvía su salida tal cual y su código de salida.
  try {
    process.stdout.write(execFileSync(process.execPath, [fileURLToPath(import.meta.url)], {
      env: { ...process.env, TZ: "Europe/Madrid", MC_TZ_OK: "1" },
      encoding: "utf8",
    }));
    process.exit(0);
  } catch (e) {
    if (e && e.stdout) process.stdout.write(e.stdout);
    if (e && e.stderr) process.stderr.write(e.stderr);
    process.exit(typeof e.status === "number" ? e.status : 1);
  }
}

const assert = (await import("node:assert/strict")).default;
const { loadPureLogicFromFile } = await import("../scripts/load-pure-logic.mjs");
const ctx = loadPureLogicFromFile();

let fallos = 0;
const t = (nombre, fn) => {
  try { fn(); console.log("  ✓ " + nombre); }
  catch (e) { fallos++; console.error("  ✗ " + nombre + "\n      " + (e && e.message)); }
};

console.log("hist-dia-local");

/* 01:00 de la madrugada del 6 en Madrid = 23:00 UTC del día 5. Así es como se guarda. */
const MADRUGADA_ISO = "2026-09-05T23:00:00.000Z";
const cand = (date, amount, merchant) => ({ date, amount, merchant, kind: "out" });

t("su caso: una compra de madrugada YA apuntada no puede salir como nueva", () => {
  const guardado = { date: MADRUGADA_ISO, amount: 12.4, merchant: "MERCADONA" };
  // El banco manda el día de verdad, el 6, que es el que él ve en pantalla.
  const dup = ctx.histCandExisting([cand("2026-09-06", 12.4, "MERCADONA")], [guardado]);
  assert.equal(dup[0], guardado, "el candidato tenía que casar con la fila que ya existe");
});

t("y al revés: lo que llega del banco de madrugada casa con lo que se ve en el día local", () => {
  const guardado = { date: "2026-09-06", amount: 30, merchant: "REPSOL" };
  const dup = ctx.histCandExisting([cand(MADRUGADA_ISO, 30, "REPSOL")], [guardado]);
  assert.equal(dup[0], guardado);
});

t("un día de verdad distinto SIGUE sin casar (no se ha aflojado el criterio)", () => {
  const guardado = { date: "2026-09-04T12:00:00.000Z", amount: 12.4, merchant: "MERCADONA" };
  const dup = ctx.histCandExisting([cand("2026-09-06", 12.4, "MERCADONA")], [guardado]);
  assert.equal(dup[0], undefined, "el 4 y el 6 son días distintos de verdad");
});

t("a mediodía, que nunca falló, sigue casando igual", () => {
  const guardado = { date: "2026-09-06T12:00:00.000Z", amount: 9.9, merchant: "BAR PACO" };
  const dup = ctx.histCandExisting([cand("2026-09-06", 9.9, "BAR PACO")], [guardado]);
  assert.equal(dup[0], guardado);
});

t("1:1 — dos candidatos de madrugada contra UNA fila guardada marcan solo uno", () => {
  const guardado = { date: MADRUGADA_ISO, amount: 5, merchant: "PAN" };
  const dup = ctx.histCandExisting([cand("2026-09-06", 5, "PAN"), cand("2026-09-06", 5, "PAN")], [guardado]);
  assert.equal(dup[0], guardado);
  assert.equal(dup[1], undefined, "el segundo no tiene con quién casar");
});

console.log(fallos ? `hist-dia-local: ${fallos} fallo(s)` : "hist-dia-local: OK");
process.exit(fallos ? 1 : 0);
