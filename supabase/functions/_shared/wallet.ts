/**
 * LEER LAS NOTIS DE GOOGLE WALLET — y en la moneda del sitio.
 *
 * Petición suya del 2026-08-06: «no lee todas?? solo las de trade republic pues eso habría que
 * corregirlo para todas las de Google Wallet porque en el crucero pagaré con revolut en otra moneda
 * y me gustaría que me lo leyera... y me lo apuntara bien como debe ser».
 *
 * Por qué hace falta: el lector solo escuchaba `de.traderepublic.app`. Revolut no tiene Open Banking
 * conectado aquí, así que sus compras no entraban por ningún lado. Y no es teórico — el gasto de
 * 76,08 € de Splau del 6/8 que «no entró» era exactamente esto. Se leyó la notificación de su móvil
 * con `adb shell dumpsys notification --noredact` y estaba ahí, intacta, del paquete
 * `com.google.android.apps.walletnfcrel`: nunca se perdió, es que nadie la escuchaba.
 *
 * EL FORMATO ES AL REVÉS QUE EL DE TR. Dos muestras REALES, no inventadas:
 *
 *     título: 10638 CORNELLA<C2 9F> SPLAU SC
 *     texto:  76,08 € con Trade Republic Visa Card ••9116
 *
 *     título: 1331 BAR
 *     texto:  31,00 €  ·  ...e Republic Visa Card ••7510 · Visa
 *
 * El comercio va en el TÍTULO y el importe en el TEXTO. Trade Republic lo mete todo en una frase
 * («Has gastado 12,50 € en Mercadona»).
 *
 * ⚠ LO QUE NO SE SABE, Y POR ESO NO SE ADIVINA: nadie ha visto todavía una noti de Wallet de un
 * pago en OTRA divisa. Puede escribirse `1.520,00 ₺`, `TRY 1520.00`, `₺1,520.00`… Aquí se aceptan
 * las cuatro formas, pero si la divisa no se reconoce con seguridad NO se inventa nada: se devuelve
 * `null` y el que llama decide (y deja rastro en el panel). En una app de dinero, una adivinanza se
 * paga en números mal pintados.
 */

/** Símbolo → código ISO. Solo los que NO admiten duda. */
const SIMBOLOS: Record<string, string> = {
  "€": "EUR", "$": "USD", "£": "GBP", "¥": "JPY", "₺": "TRY", "₹": "INR",
  "zł": "PLN", "R$": "BRL", "C$": "CAD", "A$": "AUD", "CN¥": "CNY", "MX$": "MXN", "CHF": "CHF",
};

/* «kr» se queda FUERA a propósito: es la corona sueca, la noruega Y la danesa. Un símbolo que
   significa tres cosas no es un dato, es una moneda elegida al azar entre tres — y las tres tienen
   cambios distintos. Mejor sin apuntar que apuntado a ojo. */

/** Divisas que la app sabe convertir (mismo juego que `CUR_LIST` en el cliente). */
export const DIVISAS = [
  "EUR", "USD", "GBP", "CHF", "JPY", "CAD", "AUD", "CNY", "MXN",
  "SEK", "NOK", "DKK", "PLN", "BRL", "INR", "TRY",
  "CZK", "HKD", "HUF", "IDR", "ILS", "ISK", "KRW", "MYR", "NZD", "PHP", "RON", "SGD", "THB", "ZAR",
];

/**
 * Un número como lo escribe un móvil, sea cual sea su idioma: `1.520,00` (es) y `1,520.00` (en) son
 * el mismo dinero. Regla: el ÚLTIMO separador manda; si lleva 3 dígitos detrás y es el único de su
 * clase, era de miles (`1.520` = mil quinientos, no uno con cincuenta y dos).
 */
export function parseNumero(s: string): number {
  const raw = String(s || "").replace(/[\s ]/g, "");
  if (!raw) return 0;
  const coma = raw.lastIndexOf(",");
  const punto = raw.lastIndexOf(".");
  const sep = Math.max(coma, punto);
  if (sep < 0) return parseFloat(raw) || 0;
  const detras = raw.length - sep - 1;
  if (detras === 3 && (coma < 0 || punto < 0)) return parseFloat(raw.replace(/[.,]/g, "")) || 0;
  const entero = raw.slice(0, sep).replace(/[.,]/g, "");
  return parseFloat(entero + "." + raw.slice(sep + 1)) || 0;
}

export type ImporteDivisa = { importe: number; divisa: string };

/**
 * Importe + divisa del texto de una noti de Wallet. `null` si no hay un importe con una moneda que
 * se reconozca sin dudar — que es justo cuando NO hay que inventarse nada.
 */
export function extraerImporteDivisa(texto: string): ImporteDivisa | null {
  const s = String(texto || "").trim();
  if (!s) return null;
  const num = "\\d[\\d.,\\u00a0 ]*\\d|\\d";
  // Los símbolos largos van antes que los cortos: si «R$» se probara después de «$», «R$ 10» se
  // leería como dólares.
  const simbolos = Object.keys(SIMBOLOS).sort((a, b) => b.length - a.length)
    .map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const intentos: Array<[RegExp, 1 | 2]> = [
    [new RegExp("(" + num + ")\\s*(" + simbolos + ")"), 1],          // 1.520,00 ₺
    [new RegExp("(" + simbolos + ")\\s*(" + num + ")"), 2],          // ₺1,520.00
    [new RegExp("(" + num + ")\\s*\\b([A-Z]{3})\\b"), 1],            // 1520,00 TRY
    [new RegExp("\\b([A-Z]{3})\\b\\s*(" + num + ")"), 2],            // TRY 1520.00
  ];
  for (const [re, cualEsElNumero] of intentos) {
    const m = s.match(re);
    if (!m) continue;
    const bruto = cualEsElNumero === 1 ? m[1] : m[2];
    const moneda = cualEsElNumero === 1 ? m[2] : m[1];
    const divisa = SIMBOLOS[moneda] || (DIVISAS.indexOf(moneda) >= 0 ? moneda : null);
    if (!divisa) continue;
    const importe = parseNumero(bruto);
    if (importe > 0) return { importe, divisa };
  }
  return null;
}

export type PagoWallet = { comercio: string; importe: number; divisa: string };

/**
 * Una noti de Wallet → el pago que representa, o `null` si no lo parece.
 *
 * El filtro fino de «esto es una compra» está en el lector nativo, que solo manda el canal
 * `tapandpay.transactions` (los pases de embarque y las tarjetas de fidelización van por otros).
 * Aquí queda el segundo cerrojo, por si algún día cambia el canal: sin comercio en el título o sin
 * importe reconocible, no hay gasto.
 */
export function parseWallet(titulo: string, texto: string, limpiar: (s: string) => string): PagoWallet | null {
  const comercio = limpiar(titulo || "").trim();
  if (!comercio) return null;
  const imp = extraerImporteDivisa(texto || "");
  if (!imp) return null;
  return { comercio, importe: imp.importe, divisa: imp.divisa };
}

/**
 * A euros con los MISMOS tipos que ve la app (`app_state.data.fxRates`, XXX→EUR).
 *
 * `null` = no hay tipo para esa divisa, y entonces NO se convierte. Ojo con la tentación de
 * devolver el importe tal cual «porque es mejor que nada»: eso es aplicar un cambio 1:1 inventado,
 * y 1.520 ₺ entrarían como 1.520 €. Es exactamente el fallo que no cazaría ningún test y que se
 * descubre semanas después mirando un histórico que ya no se puede reconstruir. La regla de la casa
 * es «sin tipo NO se guarda».
 */
// deno-lint-ignore no-explicit-any
export function aEuros(importe: number, divisa: string, data: any): number | null {
  const cur = String(divisa || "EUR").trim().toUpperCase();
  if (cur === "EUR") return importe != null && Number.isFinite(Number(importe)) ? +Number(importe).toFixed(2) : null;
  const rate = Number(data?.fxRates?.[cur]);
  const r = Number.isFinite(rate) && rate > 0 ? rate : (cur === "USD" ? Number(data?.fx) : NaN);
  if (!Number.isFinite(r) || !(r > 0) || importe == null || !Number.isFinite(Number(importe) * r)) return null;
  return +(Number(importe) * r).toFixed(2);
}
