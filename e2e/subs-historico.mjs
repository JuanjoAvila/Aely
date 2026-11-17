/* HISTÓRICO REALISTA PARA LA DETECCIÓN DE SUSCRIPCIONES (ronda 237, P1-3). Lo usan el unitario
   (`tests/suscripciones-deteccion.test.mjs`) y el e2e (`e2e/gastos-suscripciones-deteccion.spec.mjs`):
   los dos miran el MISMO extracto, así el número que se pinta y la regla que lo calcula no pueden
   separarse sin que salte uno de los dos.

   Seis meses de una familia (abril → 26/9/2026, el reloj de las fixtures) con lo que de verdad
   pasa en un extracto: el súper cada sábado, el bar varias veces por semana, gasolina, el cine dos
   veces al mes, la cuota del coche, la luz, la nómina, un traspaso al ahorro… y en medio, las
   suscripciones de verdad. La auditoría de diseño (237) vio salir Mercadona, Repsol, el bar y el
   préstamo del coche como «5 meses seguidos»: el detector sumaba por MES, y quien va al súper cada
   semana gasta parecido cada mes. Datos inventados; ningún comercio ni importe es de la familia. */

// Generador con semilla: el mismo histórico en cada corrida (un aleatorio de verdad haría el test
// verde o rojo según el día).
function prng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HASTA = "2026-09-26";
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
const dia = (s) => new Date(s + "T00:00:00Z");
const masDias = (s, n) => ymd(new Date(dia(s).getTime() + n * 864e5));

export function historicoSuscripciones() {
  const r = prng(237);
  const ex = [];
  let n = 0;
  const add = (fecha, amount, merchant, category, ent, extra = {}) => {
    if (fecha > HASTA) return;
    ex.push({ id: "h" + (n++), date: fecha + "T" + pad(9 + (n % 10)) + ":00:00Z", amount: Math.round(amount * 100) / 100,
      category, merchant, source: "ob", ent, ...extra });
  };
  const meses = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];

  /* ── LO QUE SÍ ES UNA SUSCRIPCIÓN ── */
  // Netflix sube de precio en agosto (12,99 → 13,99): sigue siendo la misma y vale lo último.
  meses.forEach((m, i) => add(m + "-14", i < 4 ? 12.99 : 13.99, "Netflix", "ocio", "revolut"));
  // Spotify: el día 3, con el banco que a veces lo apunta uno o dos días tarde.
  meses.forEach((m, i) => add(m + "-0" + (3 + (i % 3)), 10.99, "Spotify", "ocio", "revolut"));
  meses.forEach((m) => add(m + "-01", 29.99, "Basic-Fit", "salud", "caixabank"));
  // Apple cobra DOS cosas con el mismo nombre (iCloud y Music): dos suscripciones, no una suma.
  meses.forEach((m) => add(m + "-20", 2.99, "APPLE.COM/BILL", "ocio", "revolut"));
  meses.forEach((m) => add(m + "-25", 9.99, "APPLE.COM/BILL", "ocio", "revolut"));
  // Amazon: Prime el día 10 y, entre medias, compras de todo tipo con el mismo nombre.
  meses.forEach((m) => add(m + "-10", 4.99, "Amazon", "compras", "caixabank"));
  meses.forEach((m) => [4, 17, 23].forEach((d) => { if (r() < 0.7) add(m + "-" + pad(d), 8 + Math.round(r() * 7200) / 100, "Amazon", "compras", "caixabank"); }));
  // Semanal: el periódico digital, cada lunes desde julio.
  for (let f = "2026-07-06"; f <= HASTA; f = masDias(f, 7)) add(f, 1.99, "Kiosko Digital", "ocio", "revolut");
  // Anual: el antivirus, cada septiembre desde 2024.
  ["2024-09-02", "2025-09-03", "2026-09-01"].forEach((f) => add(f, 39.99, "Antivirus Sintético", "otros", "sabadell"));
  // Un cobro fijo que NO es todavía un recibo del Plan, pero se llama igual que uno: lo esconde la vista.
  meses.forEach((m) => add(m + "-12", 30, "Digi", "recibos", "sabadell"));

  /* ── LO QUE NO LO ES ── */
  // El súper cada sábado, con importes muy distintos.
  for (let f = "2026-04-04"; f <= HASTA; f = masDias(f, 7)) add(f, 35 + Math.round(r() * 7500) / 100, "Mercadona", "super", "caixabank");
  // Gasolina: llenar el depósito cada dos o tres semanas… y una vez al mes 50 € justos (regular y
  // estable, pero es gasolina: no se paga «por suscripción»).
  for (let f = "2026-04-06"; f <= HASTA; f = masDias(f, 15 + Math.floor(r() * 7))) add(f, 55 + Math.round(r() * 1500) / 100, "Repsol", "gasolina", "sabadell");
  meses.forEach((m) => add(m + "-02", 50, "Repsol", "gasolina", "sabadell"));
  // El bar: tres o cuatro veces por semana.
  for (let f = "2026-04-01"; f <= HASTA; f = masDias(f, 1 + Math.floor(r() * 3))) add(f, 2.5 + Math.round(r() * 2200) / 100, "Bar Manolo", "bares", "revolut");
  // Panadería casi a diario, siempre parecido.
  for (let f = "2026-04-01"; f <= HASTA; f = masDias(f, 2)) add(f, 1.8 + Math.round(r() * 120) / 100, "Panadería Sol", "pan", "revolut");
  // El cine dos veces al mes y siempre 18 €: importe fijo, pero sin periodo.
  ["04-01", "04-12", "05-03", "05-24", "06-14", "06-28", "07-19", "08-02", "08-23", "09-06", "09-20"].forEach((d) => add("2026-" + d, 18, "Cines Yelmo", "cine", "revolut"));
  // La farmacia cada mes, con lo que toque.
  meses.forEach((m) => add(m + "-1" + Math.floor(r() * 9), 6 + Math.round(r() * 3000) / 100, "Farmacia Centro", "salud", "caixabank"));
  // Metro: viajes sueltos.
  for (let f = "2026-04-02"; f <= HASTA; f = masDias(f, 3 + Math.floor(r() * 4))) add(f, 2.4 + Math.round(r() * 900) / 100, "Metro Barcelona", "transporte", "caixabank");
  // La cuota del coche: es una DEUDA del Plan, no una suscripción.
  meses.forEach((m) => add(m + "-05", 197, "Préstamo coche", "deudas", "sabadell", { debtId: "coche" }));
  // La luz ya es un recibo (y además varía cada mes).
  meses.forEach((m) => add(m + "-08", 48 + Math.round(r() * 2400) / 100, "Iberdrola", "luz", "sabadell", { reciboId: "luz" }));
  // El teléfono, enlazado a su recibo: mismo importe cada mes, pero ya está en Recibos.
  meses.forEach((m) => add(m + "-15", 25, "Pepephone", "recibos", "sabadell", { reciboId: "pepe" }));
  // Traspaso al ahorro cada día 1: es tu dinero cambiando de cuenta.
  meses.forEach((m) => add(m + "-01", 200, "Traspaso a ahorro", "traspaso", "sabadell"));
  // La nómina: un ingreso.
  meses.forEach((m) => add(m + "-28", -2150, "Nómina Empresa Sintética", "ingreso", "sabadell"));

  return {
    budget: 1200,
    settings: { autoPrices: false, theme: "green", lang: "es", expenseBanks: ["sabadell", "revolut", "caixabank"] },
    accounts: [
      { id: "sb", ent: "sabadell", name: "Sabadell", value: 2400, role: "fijos" },
      { id: "rv", ent: "revolut", name: "Revolut", value: 640, role: "diario", spendFrom: true },
      { id: "cx", ent: "caixabank", name: "CaixaBank", value: 1180, role: "diario", spendFrom: true },
    ],
    debts: [{ id: "coche", name: "Préstamo coche", value: 8200, original: 12000, monthly: 197, asOf: 2026 * 12 + 8, day: 5, account: "sabadell", ent: "sabadell" }],
    fixed: [
      { id: "luz", name: "Luz", amount: 60, freq: "mes", day: 8, account: "sabadell" },
      { id: "pepe", name: "Pepephone", amount: 25, freq: "mes", day: 15, account: "sabadell" },
      { id: "digi", name: "Digi", amount: 30, freq: "mes", day: 12, account: "sabadell" },
    ],
    expenses: ex,
  };
}

/* Lo que el detector TIENE que ver (nombre · periodo · importe por cobro) y lo que NO. Apple sale
   dos veces: son dos cobros distintos con el mismo nombre. Digi sí lo ve el detector, pero la
   bandeja lo esconde porque ya hay un recibo que se llama así. */
export const SUBS_SI = [
  ["Basic-Fit", "mes", 29.99], ["Netflix", "mes", 13.99], ["Spotify", "mes", 10.99], ["APPLE.COM/BILL", "mes", 9.99],
  ["Amazon", "mes", 4.99], ["APPLE.COM/BILL", "mes", 2.99], ["Antivirus Sintético", "anio", 39.99],
  ["Kiosko Digital", "semana", 1.99], ["Digi", "mes", 30],
];
export const SUBS_NO = ["Mercadona", "Repsol", "Bar Manolo", "Panadería Sol", "Cines Yelmo", "Farmacia Centro",
  "Metro Barcelona", "Préstamo coche", "Iberdrola", "Pepephone", "Traspaso a ahorro", "Nómina Empresa Sintética"];
