#!/usr/bin/env node
/**
 * LAS NOTIS DE GOOGLE WALLET (2026-08-06).
 *
 * El lector solo escuchaba Trade Republic, así que las compras con Revolut / Google Pay no entraban
 * por ningún lado. El gasto de 76,08 € de Splau que «no entró» era esto: la notificación estaba en
 * su móvil, intacta, del paquete `com.google.android.apps.walletnfcrel` — nadie la escuchaba.
 *
 * Las dos muestras de aquí abajo son REALES: la primera se leyó del móvil con
 * `adb shell dumpsys notification --noredact`, con sus bytes rotos y todo.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const carga = async (rel) => {
  const src = fs.readFileSync(path.join(root, rel), "utf8");
  const js = transformSync(src, { loader: "ts", format: "esm" }).code;
  return import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
};
const { parseWallet, extraerImporteDivisa, parseNumero, aEuros } =
  await carga("supabase/functions/_shared/wallet.ts");
const { clasificar, limpiarTexto } = await carga("supabase/functions/_shared/ingest_logic.ts");

function t(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
}

console.log("wallet-notis");

// Los bytes rotos se construyen, no se pegan: si se pegaran, el fichero de test se vuelve binario
// para git y el diff deja de leerse.
const MOJI = String.fromCharCode(0xc2), CTRL = String.fromCharCode(0x9f);

/* ── Las dos notis de verdad ──────────────────────────────────────────────────────────────── */

t("Splau, 76,08 € — la que se perdió el 6/8", () => {
  const p = parseWallet("10638 CORNELLA" + MOJI + CTRL + " SPLAU SC",
    "76,08 € con Trade Republic Visa Card ••9116", limpiarTexto);
  assert.equal(p.comercio, "10638 CORNELLA SPLAU SC");   // sin la Â huérfana
  assert.equal(p.importe, 76.08);
  assert.equal(p.divisa, "EUR");
});

t("el bar de su padre, 31,00 €", () => {
  const p = parseWallet("1331 BAR", "31,00 €  ·  ...e Republic Visa Card ••7510 · Visa", limpiarTexto);
  assert.equal(p.comercio, "1331 BAR");
  assert.equal(p.importe, 31);
  assert.equal(p.divisa, "EUR");
});

/* ── La trampa del título ─────────────────────────────────────────────────────────────────── */

t("en Wallet el título NO se escanea: «BAR STOP» sigue siendo un gasto", () => {
  // Con TR el título es «Trade Republic» y daba igual. En Wallet el título ES el comercio, así que
  // buscar ruido ahí resucitaría el bug del bar entero por la otra puerta: "stop" está en la lista.
  assert.equal(clasificar("31,00 € con Visa ••7510", "BAR STOP", "wallet"), "gasto");
  assert.equal(clasificar("12,00 € con Visa ••7510", "CODIGO BCN", "wallet"), "gasto");
  assert.equal(clasificar("40,00 € con Visa ••7510", "BAR EL DEPOSITO", "wallet"), "gasto");
});

t("el texto literal de las dos notis reales pasa el clasificador", () => {
  assert.equal(clasificar("76,08 € con Trade Republic Visa Card ••9116",
    "10638 CORNELLA" + MOJI + CTRL + " SPLAU SC", "wallet"), "gasto");
  assert.equal(clasificar("31,00 €  ·  ...e Republic Visa Card ••7510 · Visa", "1331 BAR", "wallet"), "gasto");
});

t("con Trade Republic el ruido se sigue tirando igual que siempre", () => {
  assert.equal(clasificar("Has recibido 2,03 € de intereses", "Trade Republic"), "ignorado");
  assert.equal(clasificar("Confirma el pago de 76,08 €", "Trade Republic"), "ignorado");
  assert.equal(clasificar("Has gastado 12,50 € en Mercadona", "Trade Republic"), "gasto");
});

/* ── Divisas: las cuatro formas de escribir lo mismo ──────────────────────────────────────── */

t("1.520 liras, se escriba como se escriba", () => {
  ["1.520,00 ₺", "₺1,520.00", "1520,00 TRY", "TRY 1520.00"].forEach((txt) => {
    const r = extraerImporteDivisa(txt + " con Revolut Visa ••1234");
    assert.ok(r, "no reconoció: " + txt);
    assert.equal(r.divisa, "TRY", txt);
    assert.equal(r.importe, 1520, txt);
  });
});

t("números: 1.520,00 y 1,520.00 son el mismo dinero", () => {
  assert.equal(parseNumero("1.520,00"), 1520);
  assert.equal(parseNumero("1,520.00"), 1520);
  assert.equal(parseNumero("76,08"), 76.08);
  assert.equal(parseNumero("76.08"), 76.08);
  assert.equal(parseNumero("1.520"), 1520);      // separador de miles, no 1,52
  assert.equal(parseNumero("0,42"), 0.42);
});

t("una moneda ambigua NO se adivina", () => {
  // «kr» es sueca, noruega y danesa a la vez, con tres cambios distintos.
  assert.equal(extraerImporteDivisa("150,00 kr con Visa ••1234"), null);
});

t("sin importe reconocible no hay gasto", () => {
  assert.equal(parseWallet("SUPERMERCADO", "Tarjeta añadida a Google Wallet", limpiarTexto), null);
  assert.equal(parseWallet("", "76,08 € con Visa", limpiarTexto), null);
});

/* ── La conversión, que es donde se paga caro equivocarse ─────────────────────────────────── */

t("a euros con los tipos que ve la app", () => {
  const data = { fxRates: { TRY: 0.018261 } };
  assert.equal(aEuros(1520, "TRY", data), 27.76);
  assert.equal(aEuros(76.08, "EUR", data), 76.08);
});

t("SIN TIPO NO SE CONVIERTE — ni se inventa un 1:1", () => {
  // Si esto devolviera 1520, entrarían 1.520 € por 1.520 ₺ y nadie se enteraría hasta mirar el
  // histórico semanas después. Devuelve null y el que llama deja rastro en el panel.
  assert.equal(aEuros(1520, "TRY", { fxRates: {} }), null);
  assert.equal(aEuros(1520, "TRY", {}), null);
  assert.equal(aEuros(1520, "XYZ", { fxRates: { TRY: 0.018261 } }), null);
});


// FIN-06: el cambio se decide con tasas válidas; ausencia nunca significa EUR 1:1.
t("FIN-06 tasas, ISO, valores inválidos y redondeo", () => {
  assert.equal(aEuros(10, "EUR", {}), 10);
  assert.equal(aEuros(10, " usd ", { fx: .9 }), 9);
  assert.equal(aEuros(10, "USD", { fx: .9, fxRates: { USD: .8 } }), 8);
  for (const rate of [null, NaN, Infinity, 0, -1]) {
    assert.equal(aEuros(10, "USD", { fx: .9, fxRates: { USD: rate } }), 9);
    assert.equal(aEuros(10, "HKD", { fx: .9, fxRates: { HKD: rate } }), null);
  }
  assert.equal(aEuros(10, " hKd ", { fxRates: { HKD: .12 } }), 1.2);
  assert.equal(aEuros(10, "HKD", { fx: .9 }), null);
  assert.equal(aEuros(10, "USD", {}), null);
  assert.equal(aEuros(12.3456, "EUR", {}), 12.35);
  assert.equal(aEuros(12.3456, "HKD", { fxRates: { HKD: .12 } }), 1.48);
  for (const amount of [null, undefined, NaN, Infinity, -Infinity])
    for (const currency of ["EUR", "USD", "HKD"])
      assert.equal(aEuros(amount, currency, { fx: .9, fxRates: { HKD: .12 } }), null);
  assert.equal(aEuros(Number.MAX_VALUE, "HKD", { fxRates: { HKD: 10 } }), null);
  for (const iso of ["CZK", "HKD", "HUF", "IDR", "ILS", "ISK", "KRW", "MYR", "NZD", "PHP", "RON", "SGD", "THB", "ZAR"]) {
    const parsed = extraerImporteDivisa("10,00 " + iso);
    assert.equal(parsed.divisa, iso); assert.equal(parsed.importe, 10);
  }
});

console.log("  ok");
