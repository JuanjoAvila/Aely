import { assertEquals } from "jsr:@std/assert";
import { readWidgetRows, widgetSnapshot, widgetStart } from "./widget.ts";
import { bancoDeSource, claveComoLaApp, cuentaParaPresupuesto, esCargoDeRecibo, filasComoLaApp, inicioDeMesMs, ordinalDeSource } from "../_shared/presupuesto.ts";

const now = Date.parse("2026-10-10T12:00:00Z"), start = inicioDeMesMs(now);
const rows = [
  { id: "before", fecha: "2026-10-02T10:00:00Z", importe: 30, cat: "super", source: "macrodroid", comercio: "Compra" },
  { id: "anchor", fecha: "2026-10-05T10:00:00Z", importe: -1000, cat: "ingreso", source: "ob:sabadell", comercio: "Nomina" },
  { id: "payment", fecha: "2026-10-10T10:00:00Z", importe: 5.45, cat: "super", source: "macrodroid", comercio: "Compra actual" },
  { id: "return", fecha: "2026-10-09T10:00:00Z", importe: -20, cat: "ingreso", source: "ob:sabadell", comercio: "Devolucion" },
];
function state(cycle = false) {
  const from = cycle ? Date.parse("2026-10-05T00:00:00+02:00") : start;
  const anchor = cycle ? claveComoLaApp(rows[1]) : "", kind = cycle ? "ciclo" : "mes";
  return { accounts: [{ ent: "trade_republic", role: "diario", spendFrom: true }, { ent: "sabadell", role: "fijos" }],
    settings: { budgetCycle: cycle, gTotalMode: "net" }, budget: 100, deleted: [], reservaLog: [],
    widgetPeriod: { v: 2, kind, start: from, anchor,
      scope: JSON.stringify([2, from, kind, cycle ? "neto" : "gasto", anchor, 100, ["trade_republic"], "trade_republic"]) } };
}
const payment = { id: "payment", event: "tr:synthetic", key: "synthetic-key" };

Deno.test("widgetStart comparte la tabla de vigencia de web y Java en Madrid", () => {
  // La tabla expresa horas locales; se convierten a instantes sin depender de la TZ del runner.
  function madrid(s: string): number {
    if (s === "-") return 0;
    if (s.endsWith("Z")) return Date.parse(s);
    const utc = Date.parse(s + "Z");
    let ms = utc;
    for (let i = 0; i < 2; i++) {
      const offset = new Intl.DateTimeFormat("en", { timeZone: "Europe/Madrid", timeZoneName: "longOffset" })
        .formatToParts(ms).find(p => p.type === "timeZoneName")!.value;
      const [, sign, h, m] = offset.match(/GMT([+-])(\d+):(\d+)/)!;
      ms = utc - (sign === "+" ? 1 : -1) * (+h * 60 + +m) * 60000;
    }
    return ms;
  }
  const table = Deno.readTextFileSync(new URL("../../../tests/fixtures/widget-ciclo.tsv", import.meta.url));
  for (const line of table.trim().split(/\r?\n/).slice(1)) {
    const [id, , , , at, , from, valid] = line.split("\t");
    const start = madrid(from), s = { settings: { budgetCycle: true }, widgetPeriod: { v: 2, kind: "ciclo", start, anchor: "synthetic" } };
    assertEquals(widgetStart(s, madrid(at)), valid === "true" ? start : null, id);
  }
});

Deno.test("pago cerrado en día 45: cifra del ciclo nueva y mes compatible con APK55", () => {
  const start = Date.parse("2026-08-20T00:00:00+02:00"), s = state(true);
  const cycleRows = [
    { ...rows[1], fecha: "2026-08-20T12:00:00+02:00" },
    { ...rows[0], fecha: "2026-09-02T12:00:00+02:00", importe: 140 },
    { ...rows[2], fecha: "2026-10-04T00:00:00+02:00" },
    { ...rows[3], fecha: "2026-10-02T13:00:00+02:00", cat: "bizum", source: "ob:trade_republic" },
  ];
  s.budget = 1000;
  s.widgetPeriod = { v: 2, kind: "ciclo", start, anchor: claveComoLaApp(cycleRows[0]), scope: "" };
  const scope = (kind: string, start: number, anchor: string) => JSON.stringify([2, start, kind, kind === "ciclo" ? "neto" : "gasto", anchor, 1000, ["trade_republic"], "trade_republic"]);
  s.widgetPeriod.scope = scope("ciclo", start, s.widgetPeriod.anchor);
  for (const time of ["00:01:00", "09:30:00", "12:01:00", "23:59:59.999"]) {
    const at = Date.parse("2026-10-04T" + time + "+02:00");
    assertEquals(widgetSnapshot(s, cycleRows, at, payment)?.spent, 125.45, time);
    const from = inicioDeMesMs(at), monthly = { ...s, widgetPeriod: { v: 2, kind: "mes", start: from, anchor: "", scope: scope("mes", from, "") } };
    assertEquals(widgetSnapshot(monthly, cycleRows, at, payment)?.spent, 5.45, "APK55 " + time);
  }
});

Deno.test("widget v2 mes bruto y delta exacto; el contrato no copia Balance legacy", () => {
  const w = widgetSnapshot(state(), rows, now, payment)!;
  assertEquals(w.contract, 2); assertEquals(w.periodKind, "mes");
  assertEquals(w.spent, 35.45); assertEquals(w.shownDelta, 5.45); assertEquals(w.budgetLeft, 64.55);
});
Deno.test("widget v2 ciclo: excluye ancla, incluye ingreso de otro banco y conserva signo", () => {
  const s = state(true), w = widgetSnapshot(s, rows, now, payment)!;
  assertEquals(w.periodStart, s.widgetPeriod.start); assertEquals(w.periodKind, "ciclo");
  assertEquals(w.spent, -14.55); assertEquals(w.shownDelta, 5.45); assertEquals(w.scope, s.widgetPeriod.scope);
});
Deno.test("widget v2 no afirma scope cambiado, ancla ausente, futuro ni ciclo caducado", () => {
  const s = state(true);
  assertEquals(widgetSnapshot({ ...s, budget: 90 }, rows, now, payment), null);
  assertEquals(widgetSnapshot(s, rows.filter(r => r.id !== "anchor"), now, payment), null);
  assertEquals(widgetSnapshot(s, rows.map(r => r.id === "anchor" ? { ...r, cat: "bizum" } : r), now, payment), null);
  assertEquals(widgetSnapshot(state(), [], now, payment), null);
  assertEquals(widgetSnapshot(state(), rows.filter(r => r.id !== "payment"), now, payment), null);
  assertEquals(widgetStart(s, now + 46 * 86400000), null);
  assertEquals(widgetStart({ ...s, settings: { budgetCycle: false } }, now), null);
  assertEquals(widgetSnapshot(s, rows.concat([{ ...rows[1], id: "new-anchor", fecha: "2026-10-09T10:00:00Z" }]), now, payment), null);
  assertEquals(widgetSnapshot(s, rows.concat([{ ...rows[1], id: "same-day-anchor", importe: -900, fecha: "2026-10-05T11:00:00Z" }]), now, payment), null);
  assertEquals(widgetSnapshot(s, rows.concat([{ ...rows[3], id: "large-bizum", importe: -300, cat: "bizum" }]), now, payment)?.spent, -314.55);
  const w = widgetSnapshot(s, rows.concat([{ ...rows[2], id: "future", fecha: "2026-10-11T10:00:00Z", importe: 500 }]), now, payment)!;
  assertEquals(w.spent, -14.55);
});

Deno.test("widget v2 exige conteo exacto y todas las páginas con identidades únicas", async () => {
  const data = Array.from({ length: 1005 }, (_, i) => ({ ...rows[2], id: "synthetic-" + i }));
  function db(bad = "") {
    let from = 0, to = 0, pages = 0;
    const api = { select: () => api, eq: () => api, gte: () => api, order: () => api,
      range: (a: number, b: number) => {
        // Sin la guarda de página parcial el lector repetiría páginas vacías sin acabar.
        // El doble aborta esa regresión como fallo del test, sin dejar colgado el runner.
        if (++pages > 3) throw new Error("widget leyó páginas sin progreso ni rechazo");
        from = a; to = b; return api;
      },
      then: (resolve: (x: unknown) => unknown) => Promise.resolve(resolve({
        data: bad === "truncated" ? data.slice(from, from + 1) : bad === "duplicate" && from > 0 ? data.slice(0,5) : data.slice(from, to + 1),
        count: bad === "count" ? null : bad === "changed" && from > 0 ? 1006 : data.length,
        error: bad === "error" ? { message: "synthetic" } : null,
      })) };
    return { from: () => api };
  }
  assertEquals((await readWidgetRows(db(), "synthetic", start))?.length, 1005);
  for (const bad of ["truncated", "duplicate", "count", "changed", "error"])
    assertEquals(await readWidgetRows(db(bad), "synthetic", start), null);
});
Deno.test("widget v2 respeta lápidas, posibles duplicados y reservas; estado legacy no inventa v2", () => {
  const s = state();
  assertEquals(widgetSnapshot({ ...s, widgetPeriod: undefined }, rows, now, payment), null);
  const w = widgetSnapshot({ ...s, deleted: [claveComoLaApp(rows[0])] }, rows.concat([
    { ...rows[2], id: "dup", importe: 90, source: "ob:trade_republic#dup" },
  ]), now, payment)!;
  assertEquals(w.spent, 5.45);
  assertEquals(widgetSnapshot({ ...s, reservaLog: [{ date: "2026-10-07", amount: 10 }] }, rows, now, payment), null);
});

Deno.test("widget v2 distingue presupuesto ausente de todo reservado, como el scope de Inicio", () => {
  const s = state(), scope = JSON.parse(s.widgetPeriod.scope);
  scope[5] = null;
  const noBudget = { ...s, budget: 0, widgetPeriod: { ...s.widgetPeriod, scope: JSON.stringify(scope) } };
  assertEquals(widgetSnapshot(noBudget, rows, now, payment)?.spent, 35.45);
  assertEquals(widgetSnapshot(noBudget, rows, now, payment)?.budgetLeft, -1);
  const c = state(true), reservedScope = JSON.parse(c.widgetPeriod.scope); reservedScope[5] = 0;
  const reserved = { ...c, reservaLog: [{ date: "2026-10-07", amount: 100 }],
    widgetPeriod: { ...c.widgetPeriod, scope: JSON.stringify(reservedScope) } };
  assertEquals(widgetSnapshot(reserved, rows, now, payment)?.budgetLeft, 14.55);
});

Deno.test("apuntes iguales con ordinal: filas separadas, mismo banco limpio también en el histórico", () => {
  // Cinco bizums iguales del día viajan como «#n2…#n5»: el servidor los separa como la app.
  const iguales = [1, 2, 3, 4, 5].map((n) => ({ id: "b" + n, fecha: "2026-10-03T10:00:00.00" + (n - 1) + "Z", importe: -12, cat: "ingreso",
    source: "ob:trade_republic" + (n > 1 ? "#n" + n : ""), comercio: "Movimiento" }));
  assertEquals(filasComoLaApp(iguales, []).length, 5);
  assertEquals(filasComoLaApp(iguales, [claveComoLaApp(iguales[2])]).length, 4);
  // El histórico lleva las mismas marcas: hasta el 12/10/2026 devolvía «trade_republic#n2».
  assertEquals(bancoDeSource("ob-hist:trade_republic#n2"), "trade_republic");
  assertEquals(bancoDeSource("ob-hist:trade_republic#dup#n3"), "trade_republic");
  assertEquals(bancoDeSource("ob:sabadell~recibo.r1#n2"), "sabadell");
  assertEquals(bancoDeSource("ob:sabadell~deuda.d1#dup"), "sabadell");
  assertEquals(ordinalDeSource("ob-hist:sabadell~recibo.r1#dup#n4"), 4);
  assertEquals(ordinalDeSource("manual"), 1);
});

Deno.test("el cargo de un recibo del Plan no cuenta, con el banco ya leído limpio, y sin la marca sí", () => {
  const ents = ["sabadell"], fila = (source: string) => ({ id: "r", fecha: "2026-10-05T10:00:00Z", importe: 50, cat: "recibos", source, comercio: "Comunidad" });
  for (const s of ["ob:sabadell~recibo.com", "ob-hist:sabadell~recibo.com", "ob:sabadell~recibo.com#n2", "ob-hist:sabadell~recibo.com#dup#n3"]) {
    assertEquals(esCargoDeRecibo(s), true, s);
    assertEquals(cuentaParaPresupuesto(fila(s), ents), false, s);
  }
  for (const s of ["ob:sabadell", "ob-hist:sabadell#n2", "manual:sabadell"]) {
    assertEquals(esCargoDeRecibo(s), false, s);
    assertEquals(cuentaParaPresupuesto(fila(s), ents), true, s);
  }
  assertEquals(esCargoDeRecibo("macrodroid"), false);
});
