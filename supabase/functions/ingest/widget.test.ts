import { assertEquals } from "jsr:@std/assert";
import { readWidgetRows, widgetSnapshot, widgetStart } from "./widget.ts";
import { bancoDeSource, claveComoLaApp, cuentaParaPresupuesto, esCargoDeRecibo, filasComoLaApp, inicioDeMesMs, ordinalDeSource, statsDelMes } from "../_shared/presupuesto.ts";

const now = Date.parse("2026-10-10T12:00:00Z"), start = inicioDeMesMs(now);
Deno.test("FIN15 revision1: referencia vacia o ajena a OB no fusiona dias", () => {
  for (const source of ["ob:caixabank#ref","ob:#refstable","manual:caixabank#refstable","wallet#refstable"]) {
    const a = {id:"a",fecha:"2026-10-08T21:59:00Z",importe:3.2,comercio:"Compra sintetica",source};
    const b = {...a,id:"b",fecha:"2026-10-09T10:00:00Z"};
    for (const rows of [[a,b],[b,a]]) assertEquals(filasComoLaApp(rows,[]),rows);
  }
});
Deno.test("FIN15 revision1: PDNG30 BOOK33 month y widget conservan primera fila", () => {
  const p = {id:"pending",fecha:"2026-10-08T21:59:00Z",importe:30,comercio:"Compra sintetica",cat:"otros",source:"ob:caixabank#refstable#pdng"};
  const b = {...p,id:"booked",fecha:"2026-10-09T10:00:00Z",importe:33,source:"ob:caixabank#refstable"};
  const trigger = {...b,id:"trigger",importe:0.01,source:"ob:trade_republic#refother"};
  const data = {budget:1000,accounts:[{ent:"caixabank",role:"diario",spendFrom:true}],settings:{expenseBanks:["caixabank"]},widgetPeriod:{v:2,nominas:[],noNominas:[],kind:"mes",start,anchor:"",scope:JSON.stringify([2,start,"mes","gasto","",1000,["caixabank"],"caixabank",[[],[]]])}};
  for (const rows of [[p,b],[b,p]]) {
    assertEquals(statsDelMes(filasComoLaApp(rows,[]),data,start).spent,rows[0].importe);
    assertEquals(widgetSnapshot(data,[...rows,trigger],now,{id:"trigger",event:"revision1",key:"synthetic"})?.spent,rows[0].importe);
  }
});
Deno.test("FIN15: referencia estable entre dias cuenta una; distintas y lapidas conservan identidad", () => {
  const pending = {id:"pending",fecha:"2026-10-08T21:59:00Z",importe:3.2,comercio:"Compra sintetica",source:"ob:caixabank#refstable#pdng"};
  const booked = {...pending,id:"booked",fecha:"2026-10-09T10:00:00Z",source:"ob:caixabank#refstable"};
  for (const rows of [[pending,booked],[booked,pending]]) assertEquals(filasComoLaApp(rows,[]).length,1);
  const other = {...booked,source:"ob:caixabank#refother"};
  for (const rows of [[pending,other],[other,pending]]) assertEquals(filasComoLaApp(rows,[]).length,2);
  const slot = {...pending,source:pending.source+"#n2"};
  for (const rows of [[slot,booked],[booked,slot]]) assertEquals(filasComoLaApp(rows,["ob-absorbed|caixabank|stable|2"]),[booked]);
});
Deno.test("BOOK absorbido: lápida específica conserva superviviente, otras referencias y UUID remoto", () => {
  const kept = {id:"pending-uuid",fecha:"2026-10-10T12:00:00Z",importe:3.2,comercio:"Cafe sintetico",source:"ob:caixabank#refb1#prevrefp1"};
  const gone = {...kept,id:"cloud-book-uuid",fecha:"2026-10-10T12:00:00.001Z",source:"ob:caixabank#refb1#n2"};
  const key = "ob-absorbed|caixabank|b1|2";
  assertEquals(filasComoLaApp([kept,gone],[key]),[kept]);
  assertEquals(filasComoLaApp([{...gone,id:"another-uuid"}],[key]),[]);
  assertEquals(filasComoLaApp([{...gone,source:"ob:caixabank#refother#n2"}],[key]).length,1);
  assertEquals(filasComoLaApp([{...gone,source:"ob:sabadell#refb1#n2"}],[key]).length,1);
  assertEquals(filasComoLaApp([{...gone,source:"ob:caixabank#n2"}],[key]).length,1);
});
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
    settings: { budgetCycle: cycle }, budget: 100, deleted: [], reservaLog: [],
    widgetPeriod: { v: 2, kind, start: from, anchor, ...(cycle ? {} : { nominas: [], noNominas: [] }),
      // En el mes natural el alcance lleva qué ingresos grandes son nómina y cuáles no (26/10/2026).
      scope: JSON.stringify(([2, from, kind, cycle ? "neto" : "gasto", anchor, 100, ["trade_republic"], "trade_republic"] as unknown[]).concat(cycle ? [] : [[[], []]])) } };
}
const payment = { id: "payment", event: "tr:synthetic", key: "synthetic-key" };

Deno.test("widget v2 mes natural y delta exacto; el contrato no copia Balance legacy", () => {
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

/* Mes natural: gasto menos ingresos SIN la nómina (decisión del dueño, 26/10/2026). Su mes con
   importes sintéticos: 1.922,19 de gasto, 485,72 recibidos, límite 1.500 → 63,53 por debajo. */
Deno.test("mes natural: los ingresos devuelven margen salvo la nómina; ingreso dudoso sin foto", () => {
  const oct = [
    { id: "g1", fecha: "2026-10-03T10:00:00Z", importe: 1200, cat: "super", source: "macrodroid", comercio: "Compra" },
    { id: "g2", fecha: "2026-10-08T10:00:00Z", importe: 722.19, cat: "ocio", source: "macrodroid", comercio: "Ocio" },
    { id: "i1", fecha: "2026-10-06T10:00:00Z", importe: -400, cat: "bizum", source: "macrodroid", comercio: "Bizum cena" },
    { id: "i2", fecha: "2026-10-07T10:00:00Z", importe: -85.72, cat: "ingreso", source: "macrodroid", comercio: "Devolucion" },
    { id: "payment", fecha: "2026-10-10T10:00:00Z", importe: 2, cat: "super", source: "macrodroid", comercio: "Cafe" },
  ];
  const lists = (nominas: string[], noNominas: string[]) => {
    const scope = JSON.stringify([2, start, "mes", "gasto", "", 1500, ["trade_republic"], "trade_republic", [nominas.slice().sort(), noNominas.slice().sort()]]);
    return { ...state(), budget: 1500, widgetPeriod: { v: 2, kind: "mes", start, anchor: "", scope, nominas, noNominas } };
  };
  const w = widgetSnapshot(lists([], []), oct, now, payment)!;
  assertEquals(w.spent, 1438.47); assertEquals(w.against, 1438.47); assertEquals(w.budgetLeft, 61.53); assertEquals(w.shownDelta, 2);
  // La nómina que la app ya apartó (por concepto o por Plan) no mueve nada aunque el comercio no lo diga.
  const nomina = { id: "nom", fecha: "2026-10-09T08:00:00Z", importe: -3333, cat: "ingreso", source: "macrodroid", comercio: "Empresa SL" };
  assertEquals(widgetSnapshot(lists([claveComoLaApp(nomina)], []), [...oct, nomina], now, payment)?.budgetLeft, 61.53);
  // Si la app dijo que NO es nómina, devuelve margen; y el margen no pasa del límite.
  assertEquals(widgetSnapshot(lists([], [claveComoLaApp(nomina)]), [...oct, nomina], now, payment)?.budgetLeft, 1500);
  assertEquals(widgetSnapshot(lists([], [claveComoLaApp(nomina)]), [...oct, nomina], now, payment)?.against, 0);
  // Llega con la app cerrada: con «nómina» en el comercio se aparta; sin él, no se adivina.
  const llega = { ...nomina, comercio: "NÓMINA EMPRESA SL" };
  assertEquals(widgetSnapshot(lists([], []), [...oct, llega], now, payment)?.budgetLeft, 61.53);
  assertEquals(widgetSnapshot(lists([], []), [...oct, nomina], now, payment), null);
  // Un ingreso grande de un banco que no es de gasto diario no cuenta ni bloquea.
  assertEquals(widgetSnapshot(lists([], []), [...oct, { ...nomina, source: "ob:sabadell" }], now, payment)?.budgetLeft, 61.53);
  // Devolución de una compra con la misma referencia: dos filas por el signo, resta una vez.
  const compra = { id: "c", fecha: "2026-10-04T10:00:00Z", importe: 250, cat: "ropa", source: "ob:trade_republic#refR1", comercio: "Tienda" };
  const devol = { ...compra, id: "d", fecha: "2026-10-05T10:00:00Z", importe: -250 };
  assertEquals(widgetSnapshot(lists([], [claveComoLaApp(devol)]), [...oct, compra, devol], now, payment)?.against, 1438.47);
  // Listas escritas pero alcance de 8 (o al revés): no casa con ninguna web, sin foto.
  const mezcla = lists([], []); mezcla.widgetPeriod.scope = JSON.stringify(JSON.parse(mezcla.widgetPeriod.scope).slice(0, 8));
  assertEquals(widgetSnapshot(mezcla, oct, now, payment), null);
});

/* Los DOS alcances (R1 de la revisión, 26/10/2026): mientras convivan la web anterior y la nueva,
   cada una recibe la cifra que pinta su Inicio, y desplegar ingest antes o después no deja a nadie
   sin foto. La web anterior escribe 8 elementos y sin listas, y compara el gasto bruto. */
Deno.test("mes natural: la web anterior (alcance de 8, sin listas) recibe su bruto; la nueva, el neto sin nómina", () => {
  const oct = [
    { id: "g1", fecha: "2026-10-03T10:00:00Z", importe: 1200, cat: "super", source: "macrodroid", comercio: "Compra" },
    { id: "g2", fecha: "2026-10-08T10:00:00Z", importe: 722.19, cat: "ocio", source: "macrodroid", comercio: "Ocio" },
    { id: "i2", fecha: "2026-10-07T10:00:00Z", importe: -485.72, cat: "ingreso", source: "macrodroid", comercio: "Devolucion" },
    { id: "nom", fecha: "2026-10-09T08:00:00Z", importe: -3333, cat: "ingreso", source: "macrodroid", comercio: "Empresa SL" },
    { id: "payment", fecha: "2026-10-10T10:00:00Z", importe: 2, cat: "super", source: "macrodroid", comercio: "Cafe" },
  ];
  const base = [2, start, "mes", "gasto", "", 1500, ["trade_republic"], "trade_republic"];
  const vieja = { ...state(), budget: 1500, widgetPeriod: { v: 2, kind: "mes", start, anchor: "", scope: JSON.stringify(base) } };
  const w = widgetSnapshot(vieja, oct, now, payment)!;
  // Bruto, como el Inicio de esa web: ni la devolución ni la nómina restan, y la nómina sin
  // palabra no bloquea (esa web no decide nóminas).
  assertEquals(w.spent, 1924.19); assertEquals(w.against, 1924.19); assertEquals(w.budgetLeft, 0); assertEquals(w.shownDelta, 2);
  const nueva = { ...state(), budget: 1500, widgetPeriod: { v: 2, kind: "mes", start, anchor: "", nominas: [claveComoLaApp(oct[3])], noNominas: [claveComoLaApp(oct[2])],
    scope: JSON.stringify([...base, [[claveComoLaApp(oct[3])], [claveComoLaApp(oct[2])]]]) } };
  const n = widgetSnapshot(nueva, oct, now, payment)!;
  assertEquals(n.spent, 1438.47); assertEquals(n.budgetLeft, 61.53);
});

/* Recibos del Plan y aportaciones a meta (R6): fuera del presupuesto también en ingest, como
   `cuentaParaPresupuesto`. En el mes, gasto e ingreso; en Mi ciclo solo el gasto, porque ahí el
   cliente cuenta los ingresos de cualquier fila que no sea neutra. */
Deno.test("recibo del Plan y aportación a meta no mueven el widget, ni como gasto ni como ingreso en el mes", () => {
  const extra = [
    { id: "meta", fecha: "2026-10-06T10:00:00Z", importe: 250, cat: "super", source: "ob:trade_republic~meta.g1", comercio: "A la meta" },
    { id: "meta-in", fecha: "2026-10-06T11:00:00Z", importe: -30, cat: "ingreso", source: "ob:trade_republic~meta.g1", comercio: "Vuelta de meta" },
    { id: "recibo", fecha: "2026-10-06T12:00:00Z", importe: 60, cat: "recibos", source: "ob:trade_republic~recibo.r1", comercio: "Luz" },
  ];
  const w = widgetSnapshot(state(), [...rows, ...extra], now, payment)!;
  assertEquals(w.spent, 35.45); assertEquals(w.budgetLeft, 64.55);
  // Un pago que es aportación a meta no cuenta.
  const aMeta = { ...rows[2], source: "ob:trade_republic~meta.g1" };
  assertEquals(widgetSnapshot(state(), [rows[0], rows[1], aMeta, rows[3]], now, payment)?.counts, 0);
  // En el ciclo el gasto marcado sigue fuera; el ingreso marcado cuenta, como en el cliente.
  const c = widgetSnapshot(state(true), [...rows, ...extra], now, payment)!;
  assertEquals(c.spent, -14.55 - 30);
});
