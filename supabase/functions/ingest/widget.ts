import {
  bancosDeGastoDiario, claveComoLaApp, cuentaParaPresupuesto, esCuotaDeDeuda,
  esPosibleRepetido, filasComoLaApp, inicioDeMesMs, statsDelMes, type FilaGasto,
} from "../_shared/presupuesto.ts";

const neutral = (f: FilaGasto) => ["inversion", "traspaso", "deudas"].includes(String(f.cat))
  || esCuotaDeDeuda(f.source) || esPosibleRepetido(f.source);

/** El límite por defecto de la API no acredita un total: contar y paginar sólo el contrato v2. */
// deno-lint-ignore no-explicit-any
export async function readWidgetRows(db: any, userId: string, start: number): Promise<FilaGasto[] | null> {
  const rows: FilaGasto[] = [], ids = new Set<string>();
  let total: number | null = null;
  for (let from = 0; ; from += 1000) {
    const page = await db.from("expenses").select("id,importe,cat,source,fecha,comercio", { count: "exact" })
      .eq("user_id", userId).gte("fecha", new Date(start).toISOString())
      .order("id", { ascending: true }).range(from, from + 999);
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

// deno-lint-ignore no-explicit-any
export function widgetStart(data: any, now: number): number | null {
  const w = data?.widgetPeriod;
  if (w?.v !== 2 || !Number.isSafeInteger(w.start) || w.start <= 0 || w.start > now) return null;
  if (w.kind === "mes") return w.start === inicioDeMesMs(now) ? w.start : null;
  if (w.kind !== "ciclo" || !data?.settings?.budgetCycle || !w.anchor || now - w.start > 45 * 86400000) return null;
  return w.start;
}

/** Contrato nuevo separado de month: una APK51 nunca debe recibir un neto de ciclo como mes. */
// deno-lint-ignore no-explicit-any
export function widgetSnapshot(data: any, rows: FilaGasto[], now: number, payment: {
  id: string; event: string; key: string;
}): Record<string, number | string> | null {
  const candidateStart = widgetStart(data, now);
  if (candidateStart == null) return null;
  const start: number = candidateStart;
  const w = data.widgetPeriod, cycle = w.kind === "ciclo", end = cycle ? tomorrow(now) : Infinity;
  const visible = filasComoLaApp(rows, data.deleted).filter(f => {
    const ms = Date.parse(String(f.fecha)); return ms >= start && ms < end;
  });
  // Una lectura vacía/parcial o una fila retirada no prueba el delta de este pago.
  if (!visible.some(f => String(f.id) === payment.id)) return null;
  if (cycle) {
    const anchor = visible.find(f => claveComoLaApp(f) === w.anchor && Number(f.importe) <= -200 && !neutral(f) && f.cat !== "bizum");
    if (!anchor) return null;
    // Un cobro grande posterior podría ser la nueva ancla aún no leída por la app.
    if (visible.some(f => f !== anchor && Number(f.importe) <= -200 && !neutral(f)
      && f.cat !== "bizum" && Date.parse(String(f.fecha)) > Date.parse(String(anchor.fecha)))) return null;
  }
  const ents = bancosDeGastoDiario(data);
  const scopedData = { ...data, settings: { ...data.settings, gTotalMode: cycle ? "net" : "split" },
    reservaLog: (data.reservaLog || []).filter((x: { date: string }) => Date.parse(x.date) < end) };
  function stats(filas: FilaGasto[]) {
    const eligible = filas.filter(f => !(cycle && claveComoLaApp(f) === w.anchor));
    const result = statsDelMes(eligible, scopedData, start);
    if (cycle) {
      const income = eligible.reduce((sum, f) => sum + (Number(f.importe) < 0 && !neutral(f) ? -Number(f.importe) : 0), 0);
      result.against = +(result.spent - income).toFixed(2);
    }
    return result;
  }
  const after = stats(visible), before = stats(visible.filter(f => String(f.id) !== payment.id));
  const accounts = data.accounts || [], chosen = data.settings?.widgetBank;
  const bank = accounts.find((a: { ent: string }) => a.ent === chosen && !["efectivo", "familia"].includes(a.ent))
    || accounts.find((a: { spendFrom: boolean }) => a.spendFrom);
  const scope = JSON.stringify([2, start, w.kind, cycle ? "neto" : "gasto", w.anchor || "", after.budget, ents.slice().sort(), bank?.ent || ""]);
  // No repetir un scope de la app si reservas/bancos/ancla ya han cambiado en la nube.
  if (w.scope !== scope) return null;
  const amount = visible.find(f => String(f.id) === payment.id);
  const shown = cycle ? after.against : after.spent, oldShown = cycle ? before.against : before.spent;
  return { contract: 2, periodKind: w.kind, scope, periodStart: start, readAt: now,
    eventKey: payment.event, expenseKey: payment.key, spent: shown, budget: after.budget,
    against: after.against, budgetLeft: after.budget > 0 ? +Math.max(0, after.budget - after.against).toFixed(2) : -1,
    shownDelta: +(shown - oldShown).toFixed(2), againstDelta: +(after.against - before.against).toFixed(2),
    counts: amount && !neutral(amount) && ((cycle && Number(amount.importe) < 0) || cuentaParaPresupuesto(amount, ents)) ? 1 : 0,
    cashCounts: 1 };
}
