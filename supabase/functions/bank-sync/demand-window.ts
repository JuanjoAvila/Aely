// Ventana del sync a demanda (INC-2709-06).
// Hasta el 15/9 Caixa devolvía solo los 20 movimientos más antiguos; desde entonces el sync
// pide el día 1 del mes menos 8 días y el cliente tira lo anterior. Quien sincroniza poco, o
// cruza un cambio de mes, pierde ese tramo para siempre: el banco no lo vuelve a entregar
// si la siguiente lectura ya no lo pide.
//
// Se pide el más antiguo entre el margen de siempre y (último éxito − 3 días), sin pasar
// de 90 días. Sin último éxito conocido se queda el margen: igual que hoy. `recover` en
// false es un cliente que no ha dicho que va a guardar el tramo; ensanchar igual y luego
// adelantar last_sync quemaría el hueco en un móvil que todavía tira lo anterior al margen.

export const OB_DEMAND_CAP_DAYS = 90;
export const OB_DEMAND_OVERLAP_DAYS = 3;
export const OB_DEMAND_MARGIN_DAYS = 8;

export function utcYmd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function ymdAddDays(ymd: string, days: number): string {
  const p = ymd.split("-").map((x) => Number(x));
  return utcYmd(Date.UTC(p[0], p[1] - 1, p[2] + days));
}

/** Día 1 UTC del mes menos 8 días. Es el `recentFrom` de antes: cubre el margen de Madrid
    y, en el borde de mes, puede pedir un mes de más, nunca uno de menos. */
export function currentDemandWindowStart(now: Date): string {
  return utcYmd(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - OB_DEMAND_MARGIN_DAYS * 86400000);
}

export function parseLastSyncDay(lastSync: unknown): string | null {
  const raw = typeof lastSync === "string" ? lastSync.slice(0, 10) : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

export function demandSyncFrom(now: Date, lastSync: unknown, recover: boolean): { from: string; gapBeyondCap: boolean; gap: boolean } {
  const windowStart = currentDemandWindowStart(now);
  const day = parseLastSyncDay(lastSync);
  if (!day) return { from: windowStart, gapBeyondCap: false, gap: false };
  const overlap = ymdAddDays(day, -OB_DEMAND_OVERLAP_DAYS);
  const oldest = overlap < windowStart ? overlap : windowStart;
  const gap = oldest < windowStart;
  // Cliente viejo: misma petición de siempre. El hueco se conserva en last_sync.
  if (!recover) return { from: windowStart, gapBeyondCap: false, gap };
  const floor = utcYmd(now.getTime() - OB_DEMAND_CAP_DAYS * 86400000);
  if (oldest < floor) return { from: floor, gapBeyondCap: true, gap: true };
  return { from: oldest, gapBeyondCap: false, gap };
}

/** Lectura completa: todas las cuentas respondieron, sin corte de páginas y sin 429.
    Un saldo bueno con el extracto a medias no es un éxito: adelantar last_sync ahí
    dejaría el hueco fuera de la próxima petición. */
export function demandReadComplete(accounts: Array<{ ok?: boolean; truncated?: boolean; transactionError?: string; error?: string } | null> | null): boolean {
  if (!accounts || !accounts.length) return false;
  return accounts.every((a) => {
    if (!a || a.ok !== true) return false;
    if (a.truncated || a.transactionError) return false;
    if (/\b429\b/.test(String(a.error || ""))) return false;
    return true;
  });
}
