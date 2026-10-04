#!/usr/bin/env node
/**
 * LA CACHÉ DE FECHAS NO PUEDE TIRARSE A SÍ MISMA (INC-2709-09, 4/10/2026).
 *
 * `_pdMs` guarda el parseo de cada cadena de fecha porque filtrar y ordenar el histórico la llama
 * decenas de miles de veces. Su techo era «al pasar de 5.000, vaciar entera». Con un histórico de
 * más de 5.000 fechas distintas eso la deja sin efecto justo cuando hace falta: cada barrido la
 * vacía a mitad y el siguiente vuelve a parsear todo. Medido con 5.200 gastos y la CPU x6: la
 * caché se vaciaba 4-5 veces en cada vuelta a primer plano (80 ms contra 45 con la caché estable).
 *
 * Aquí se ejecutan las funciones REALES del bundle con un `Date` que cuenta los parseos. Lo que se
 * vigila es el contrato, no la implementación:
 *   · un segundo barrido completo solo paga las cadenas que no cupieron, en cualquier orden;
 *   · la memoria no pasa del techo;
 *   · con la caché llena el resultado es el mismo que con ella vacía.
 * Tres mutantes tienen que morir aquí: volver al `clear()`, desalojar la más antigua (un barrido
 * expulsa justo lo que va a leer después) y quitar el techo.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createLogicSandbox, extractPureLogicSource } from "../scripts/load-pure-logic.mjs";

const TECHO = 5000;
const N = 5200;

/* Cada sandbox estrena su propia caché y su propio contador: los casos no se contaminan. */
function cargar() {
  const cuenta = { n: 0 };
  class FechaContada extends Date {
    constructor(...a) {
      // Parseo = construir desde texto, o desde año/mes/día (la rama dd/mm/aaaa). `new Date(ms)`
      // no cuenta: es el objeto nuevo que parseDate devuelve en cada llamada, a propósito.
      if ((a.length === 1 && typeof a[0] === "string") || a.length >= 3) cuenta.n++;
      super(...a);
    }
  }
  const sandbox = createLogicSandbox({ Date: FechaContada });
  const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  vm.runInNewContext(extractPureLogicSource(html), sandbox, { filename: "public/index.html:pure-logic" });
  return { ctx: sandbox, cuenta };
}

const base = Date.parse("2026-01-01T00:00:00.000Z");
const claves = Array.from({ length: N }, (_, i) => new Date(base - i * 18_000_000).toISOString());
/* Barajado determinista: la prueba no puede depender de la suerte. */
function barajar(xs, semilla) {
  const out = xs.slice(); let s = semilla;
  for (let i = out.length - 1; i > 0; i--) { s = (s * 1103515245 + 12345) & 0x7fffffff; const j = s % (i + 1); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

let fallos = 0;
const t = (nombre, fn) => {
  try { fn(); console.log("  ✓ " + nombre); }
  catch (e) { fallos++; console.error("  ✗ " + nombre + "\n      " + (e && e.message)); }
};

t("★ tres barridos seguidos de 5.200 fechas: solo el primero las parsea todas", () => {
  const { ctx, cuenta } = cargar();
  const pasada = () => { const antes = cuenta.n; for (const k of claves) ctx.dateMs(k); return cuenta.n - antes; };
  assert.equal(pasada(), N, "el primer barrido parsea cada cadena una vez");
  for (const n of [2, 3]) {
    const p = pasada();
    assert.ok(p <= N - TECHO, `barrido ${n}: ${p} parseos; solo pueden repetirse las ${N - TECHO} que no cupieron`);
  }
  assert.ok(ctx._pdCache.size <= TECHO, `la caché guarda ${ctx._pdCache.size} entradas y el techo es ${TECHO}`);
});

t("★ el orden del barrido no la rompe: al revés y barajado siguen acertando", () => {
  const { ctx, cuenta } = cargar();
  for (const k of claves) ctx.dateMs(k);
  for (const [nombre, orden] of [["al revés", claves.slice().reverse()], ["barajado A", barajar(claves, 7)], ["barajado B", barajar(claves, 2026)], ["en orden", claves]]) {
    const antes = cuenta.n;
    for (const k of orden) ctx.dateMs(k);
    const p = cuenta.n - antes;
    assert.ok(p <= N - TECHO, `${nombre}: ${p} parseos de ${N}`);
    assert.ok(ctx._pdCache.size <= TECHO, `${nombre}: la caché creció a ${ctx._pdCache.size}`);
  }
});

t("★ la memoria tiene techo aunque no paren de llegar fechas nuevas", () => {
  const { ctx } = cargar();
  for (let i = 0; i < 4 * TECHO; i++) ctx.dateMs(new Date(base + i * 60_000).toISOString());
  assert.ok(ctx._pdCache.size <= TECHO, `la caché guarda ${ctx._pdCache.size} entradas`);
  assert.ok(ctx._pdCache.size > 0, "una caché que no guarda nada tampoco vale");
});

t("con la caché llena el resultado es el mismo que con ella vacía", () => {
  const { ctx } = cargar();
  for (const k of claves) ctx.dateMs(k);
  for (const k of [claves[0], claves[TECHO - 1], claves[TECHO], claves[N - 1]]) {
    assert.equal(ctx.dateMs(k), Date.parse(k), "dateMs de " + k);
    assert.equal(ctx.parseDate(k).getTime(), Date.parse(k), "parseDate de " + k);
  }
  // Formatos que la app recibe de verdad, pedidos cuando ya no cabe ninguno más.
  assert.equal(ctx.dateMs("12/09/2026"), new Date(2026, 8, 12).getTime());
  assert.equal(ctx.dateMs("1-2-26"), new Date(2026, 1, 1).getTime());
  assert.equal(ctx.dateMs("2026-09-12T10:00:00+02:00"), Date.parse("2026-09-12T08:00:00Z"));
  assert.equal(ctx.dateMs("2026-09-12"), Date.parse("2026-09-12"));
});

t("un acierto no vuelve a parsear, tampoco si vale 0 o no es una fecha", () => {
  const { ctx, cuenta } = cargar();
  for (const [cadena, esperado] of [["1970-01-01T00:00:00.000Z", 0], ["2026-09-12T10:00:00.000Z", Date.parse("2026-09-12T10:00:00.000Z")]]) {
    const antes = cuenta.n;
    for (let i = 0; i < 5; i++) assert.equal(ctx.dateMs(cadena), esperado);
    assert.equal(cuenta.n - antes, 1, cadena + ": cinco lecturas, un solo parseo");
  }
  // Lo que no es fecha se recuerda como tal; quien lo pide recibe «ahora», no un NaN ni un error.
  const antes = cuenta.n;
  for (let i = 0; i < 5; i++) {
    const ms = ctx.dateMs("esto no es una fecha");
    assert.ok(Math.abs(ms - Date.now()) < 5000, "dateMs de basura cae a ahora");
    assert.ok(!isNaN(ctx.parseDate("esto no es una fecha").getTime()), "parseDate de basura es una fecha válida");
  }
  assert.equal(cuenta.n - antes, 1, "la cadena inválida también se parsea una sola vez");
});

t("parseDate devuelve un objeto NUEVO cada vez: mutar uno no toca la caché", () => {
  const { ctx } = cargar();
  const k = "2026-09-12T10:00:00.000Z";
  const a = ctx.parseDate(k), b = ctx.parseDate(k);
  assert.notEqual(a, b, "dos llamadas, dos objetos");
  a.setFullYear(1999);
  assert.equal(ctx.parseDate(k).getTime(), Date.parse(k), "la fecha guardada no cambia");
  assert.equal(b.getTime(), Date.parse(k));
});

if (fallos) { console.error(`\n❌ ${fallos} fallo(s) en la caché de fechas.`); process.exit(1); }
console.log("\n✅ La caché de fechas aguanta un histórico mayor que su techo.");
