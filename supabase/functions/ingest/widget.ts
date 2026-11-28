import {
  bancoDeSource, bancosDeGastoDiario, claveComoLaApp, comercioDeNomina, esAportacionAMeta, esCargoDeRecibo,
  esPosibleRepetido, filasComoLaApp, inicioDeMesMs, statsDelMes, type FilaGasto,
} from "../_shared/presupuesto.ts";

const neutral = (f: FilaGasto) => ["inversion", "traspaso", "deudas"].includes(String(f.cat))
  || esPosibleRepetido(f.source);
// El cargo de un recibo del Plan y el dinero que va a una meta no mueven el presupuesto: igual que
// `cuentaParaPresupuesto` y que Inicio (`expenseCountsBudget`). Sin esto una aportación a meta hacía
// que el widget dijera más que Inicio (revisión 26/10/2026). En Mi ciclo los ingresos del cliente
// solo miran neutras y duplicados (`budgetRowSigned`), así que ahí un ingreso marcado sigue contando.
const marcada = (f: FilaGasto) => esCargoDeRecibo(f.source) || esAportacionAMeta(f.source);
const fueraDelPresupuesto = (f: FilaGasto, cycle: boolean) =>
  neutral(f) || (marcada(f) && (!cycle || Number(f.importe) > 0));

/** El límite por defecto de la API no acredita un total: contar y paginar sólo el contrato v2. */
// deno-lint-ignore no-explicit-any
export async function readWidgetRows(db: any, userId: string, start: number): Promise<FilaGasto[] | null> {
  const rows: FilaGasto[] = [], ids = new Set<string>();
  let total: number | null = null;
  for (let from = 0; ; from += 1000) {
    let page = await db.from("expenses").select("id,importe,cat,source,fecha,comercio,ingest_event_id", { count: "exact" })
      .eq("user_id", userId).gte("fecha", new Date(start).toISOString())
      .order("id", { ascending: true }).range(from, from + 999);
    if (page.error && /ingest_event_id|column/i.test(String(page.error.message || ""))) {
      page = await db.from("expenses").select("id,importe,cat,source,fecha,comercio", { count: "exact" })
        .eq("user_id", userId).gte("fecha", new Date(start).toISOString())
        .order("id", { ascending: true }).range(from, from + 999);
    }
    if (page.error || !Array.isArray(page.data) || !Number.isSafeInteger(page.count) || page.count < 0) return null;
    if (total == null) total = page.count;
    if (page.count !== total || page.data.length !== Math.min(1000, Math.max(0, total! - from))) return null;
    for (const row of page.data) {
      if (!row.id || ids.has(String(row.id))) return null;
      ids.add(String(row.id)); rows.push(row);
    }
    if (rows.length === total) return rows;
  }
}

// El ciclo termina mañana en Madrid, como Inicio; no sumar apuntes de otro día futuro.
function tomorrow(now: number): number {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" });
  const [y, m, d] = fmt.format(now).split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d + 1), target = new Date(utc).toISOString().slice(0, 10);
  let lo = utc - 14 * 3600000, hi = utc + 14 * 3600000;
  while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (fmt.format(mid) < target) lo = mid + 1; else hi = mid; }
  return lo;
}

/* Por qué una respuesta salió sin foto, y qué alcance/ventana se comparó. El «Abre la app» del
   cobro del 27/11 no se pudo atribuir porque ingest no dejaba rastro de ello (diagnóstico 28/11).
   Solo etiquetas y los alcances crudos: `index.ts` los reduce a huella antes de apuntarlos. */
export type WidgetDiag = { motivo?: string; kind?: string; start?: number; end?: number; appScope?: string; edgeScope?: string };

// deno-lint-ignore no-explicit-any
export function widgetStart(data: any, now: number, diag?: WidgetDiag): number | null {
  const w = data?.widgetPeriod, d = diag || {};
  if (w?.v !== 2) { d.motivo = "sin-periodo"; return null; }
  d.kind = typeof w.kind === "string" ? w.kind.slice(0, 10) : undefined;
  if (!Number.isSafeInteger(w.start) || w.start <= 0) { d.motivo = "inicio-invalido"; return null; }
  d.start = w.start;
  if (w.start > now) { d.motivo = "inicio-futuro"; return null; }
  if (w.kind === "mes") { if (w.start === inicioDeMesMs(now)) return w.start; d.motivo = "mes-caducado"; return null; }
  if (w.kind !== "ciclo") { d.motivo = "tipo-desconocido"; return null; }
  if (!data?.settings?.budgetCycle) { d.motivo = "ciclo-apagado"; return null; }
  if (!w.anchor) { d.motivo = "ciclo-sin-ancla"; return null; }
  if (now - w.start > 45 * 86400000) { d.motivo = "ciclo-caducado"; return null; }
  return w.start;
}

/** Contrato nuevo separado de month: una APK51 nunca debe recibir un neto de ciclo como mes. */
// deno-lint-ignore no-explicit-any
export function widgetSnapshot(data: any, rows: FilaGasto[], now: number, payment: {
  id: string; event: string; key: string;
}, owner?: string, diag?: WidgetDiag): Record<string, number | string> | null {
  const d = diag || {};
  const candidateStart = widgetStart(data, now, d);
  if (candidateStart == null) return null;
  const start: number = candidateStart;
  // El mes de Madrid incluye sus días futuros, pero ni movimientos ni reservas del siguiente.
  const w = data.widgetPeriod, cycle = w.kind === "ciclo", end = cycle ? tomorrow(now) : inicioDeMesMs(start + 35 * 864e5);
  d.end = end;
  // La app dice qué filas son un traspaso entre cuentas propias: aquí valen como neutras, sin tocarlas.
  const traspasos = new Set<string>(Array.isArray(data.widgetPeriod?.traspasos) ? data.widgetPeriod.traspasos.filter((k: unknown) => typeof k === "string") : []);
  // Y en Mi ciclo, qué ingresos grandes no devuelven margen (espejo de `grandes` en `monthBudgetStats`).
  const grandes = new Set<string>(cycle && Array.isArray(w.grandes) ? w.grandes.filter((k: unknown) => typeof k === "string") : []);
  const visible = filasComoLaApp(rows, data.deleted, data.obAbsorbedPending, owner, data.obAbsorbedConfirmed).filter(f => {
    const ms = Date.parse(String(f.fecha)); return ms >= start && ms < end;
  }).map(f => traspasos.has(claveComoLaApp(f)) ? { ...f, cat: "traspaso" } : f);
  // Una lectura vacía/parcial o una fila retirada no prueba el delta de este pago.
  if (!visible.some(f => String(f.id) === payment.id)) { d.motivo = "pago-no-visible"; return null; }
  if (cycle) {
    const anchor = visible.find(f => claveComoLaApp(f) === w.anchor && Number(f.importe) <= -200 && !neutral(f) && f.cat !== "bizum");
    if (!anchor) { d.motivo = "ancla-no-visible"; return null; }
    // Un cobro grande posterior podría ser la nueva ancla aún no leída por la app.
    if (visible.some(f => f !== anchor && Number(f.importe) <= -200 && !neutral(f)
      && f.cat !== "bizum" && Date.parse(String(f.fecha)) > Date.parse(String(anchor.fecha)))) { d.motivo = "ancla-posterior"; return null; }
  }
  const ents = bancosDeGastoDiario(data);
  const daily = (f: FilaGasto) => { const bank = bancoDeSource(f.source); return !bank || ents.includes(bank); };
  /* Mes natural: gasto menos ingresos SIN la nómina (decisión del dueño, 26/10/2026; espejo del
     modo "mes" de `budgetStatsFromAmounts`). Un ingreso grande (≥200 €, no Bizum, de un banco que
     cuenta) se decide con la lista que dejó la app, que conoce Plan y el concepto; si la app aún
     no lo vio, solo se acepta como nómina lo que lo dice en el comercio. Cualquier otro no se
     adivina: sin foto, y el widget se queda con la cifra de la app hasta que ella decida. */
  /* Dos webs conviven mientras se despliega: la que escribe las listas (regla nueva) y la anterior,
     cuyo alcance lleva el ancla vacía donde la nueva lleva las listas, y cuyo Inicio compara el
     gasto bruto. Cada una recibe SU cifra: así ingest se puede desplegar antes o después de la web sin dejar sin foto el widget de nadie
     (revisión 26/10/2026). Un alcance que no casa con ninguna de las dos sigue sin foto. */
  const conListas = !cycle && Array.isArray(w.nominas) && Array.isArray(w.noNominas);
  const nominas = new Set<string>(conListas ? w.nominas.filter((k: unknown) => typeof k === "string") : []);
  const noNominas = new Set<string>(conListas ? w.noNominas.filter((k: unknown) => typeof k === "string") : []);
  const esNomina = new Map<FilaGasto, boolean>();
  if (conListas) {
    for (const f of visible) {
      if (!(Number(f.importe) <= -200) || fueraDelPresupuesto(f, cycle) || f.cat === "bizum" || !daily(f)) continue;
      const k = claveComoLaApp(f);
      if (nominas.has(k)) esNomina.set(f, true);
      else if (noNominas.has(k)) esNomina.set(f, false);
      else if (comercioDeNomina(f.comercio)) esNomina.set(f, true);
      else { d.motivo = "nomina-sin-decidir"; return null; }
    }
  }
  const rawBudget = typeof data.budget === "number" && Number.isFinite(data.budget) ? data.budget : 0;
  const budgetKnown = rawBudget > 0;
  const scopedData = { ...data, budget: rawBudget, settings: { ...data.settings, gTotalMode: cycle ? "net" : "split" },
    reservaLog: (data.reservaLog || []).filter((x: { date: string }) => Date.parse(x.date) < end) };
  function stats(filas: FilaGasto[]) {
    const eligible = filas.filter(f => !(cycle && claveComoLaApp(f) === w.anchor));
    // El contrato antiguo filtra también la marca de cuota. Inicio manda por categoría:
    // una categoría explícita ajena a Deudas sigue contando, igual que expenseCountsBudget.
    // La matriz diferencial 10/10 protege esta diferencia sin alterar month legacy.
    const result = statsDelMes([], scopedData, start);
    let spent = 0, income = 0, nomina = 0;
    for (const f of eligible) {
      if (fueraDelPresupuesto(f, cycle)) continue;
      const amount = Number(f.importe);
      if (amount < 0 && (cycle || daily(f))) { income -= amount; if (esNomina.get(f) || grandes.has(claveComoLaApp(f))) nomina -= amount; }
      else if (amount > 0 && daily(f)) spent += amount;
    }
    result.spent = +spent.toFixed(2); result.income = +income.toFixed(2);
    // Con tope también en el ciclo (feedback 2026-11-28, espejo de `budgetStatsFromAmounts`): sin él,
    // la llegada de una nómina traspasada dejaba lo usado en negativo y el widget decía «Pots gastar»
    // más que el límite entero. En el mes, sin la nómina; una web anterior compara el bruto.
    result.against = cycle ? Math.max(0, +(spent - (income - nomina)).toFixed(2))
      : conListas ? Math.max(0, +(spent - (income - nomina)).toFixed(2)) : result.spent;
    result.shown = cycle ? +Math.abs(income - spent).toFixed(2) : result.spent;
    return result;
  }
  const after = stats(visible), before = stats(visible.filter(f => String(f.id) !== payment.id));
  const accounts = data.accounts || [], chosen = data.settings?.widgetBank;
  const bank = accounts.find((a: { ent: string }) => a.ent === chosen && !["efectivo", "familia"].includes(a.ent))
    || accounts.find((a: { spendFrom: boolean }) => a.spendFrom);
  // Las listas entran en el alcance como en `widgetScopeOf`, solo si la web las escribió, y en el
  // hueco del ancla (vacío en el mes): el nativo exige 8 elementos y un noveno lo descartaba (26/10/2026).
  const parts: unknown[] = [2, start, w.kind, cycle ? "neto" : "gasto",
    conListas ? [[...nominas].sort(), [...noNominas].sort(), ...(traspasos.size ? [[...traspasos].sort()] : [])]
      : cycle && grandes.size ? [w.anchor || "", [...traspasos].sort(), [...grandes].sort()]
      : cycle && traspasos.size ? [w.anchor || "", [...traspasos].sort()] : (w.anchor || ""),
    budgetKnown ? after.budget : null, ents.slice().sort(), bank?.ent || ""];
  const scope = JSON.stringify(parts);
  // No repetir un scope de la app si reservas/bancos/ancla ya han cambiado en la nube.
  d.appScope = typeof w.scope === "string" ? w.scope : ""; d.edgeScope = scope;
  if (w.scope !== scope) { d.motivo = "alcance-distinto"; return null; }
  d.motivo = "ok";
  const amount = visible.find(f => String(f.id) === payment.id);
  // El nativo pinta «quedan / de más» como límite − `spent`: va lo que se compara con el límite.
  const shown = after.against, oldShown = before.against;
  return { contract: 2, periodKind: w.kind, scope, periodStart: start, readAt: now,
    eventKey: payment.event, expenseKey: payment.key, spent: shown, budget: after.budget,
    against: after.against, budgetLeft: budgetKnown ? +Math.max(0, after.budget - after.against).toFixed(2) : -1,
    shownDelta: +(shown - oldShown).toFixed(2), againstDelta: +(after.against - before.against).toFixed(2),
    counts: amount && !fueraDelPresupuesto(amount, cycle) && ((cycle && Number(amount.importe) < 0) || daily(amount)) ? 1 : 0,
    // El Saveback no sale del efectivo: lo pone TR y va directo al fondo (igual que `ingest`).
    cashCounts: amount && amount.cat === "inversion" && amount.comercio === "Saveback" ? 0 : 1 };
}

/* Fija el motivo por defecto ANTES de la foto: un `return null` futuro sin motivo no debe
   salir como «lectura-incompleta» (que es solo el fallo de readWidgetRows). */
export function snapshotConMotivo<T>(diag: WidgetDiag, foto: () => T | null): T | null {
  diag.motivo = "sin-motivo";
  return foto();
}

/* El log del widget NUNCA retrasa la respuesta al móvil: con EdgeRuntime.waitUntil sigue en
   segundo plano; sin él, se espera como mucho `ms` y se suelta (el fallo/timeout se traga). */
export function sinBloquear(tarea: Promise<unknown>, ms = 1500,
    rt: { waitUntil?: (p: Promise<unknown>) => void } | undefined = (globalThis as any).EdgeRuntime): Promise<void> {
  const segura = tarea.catch(() => {});
  if (rt && typeof rt.waitUntil === "function") {
    try { rt.waitUntil(segura); return Promise.resolve(); } catch (_) { /* cae al plazo */ }
  }
  let t: ReturnType<typeof setTimeout>;
  const plazo = new Promise<void>(r => { t = setTimeout(r, ms); });
  return Promise.race([segura, plazo]).then(() => clearTimeout(t));
}
