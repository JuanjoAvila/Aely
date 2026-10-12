// Ventana del sync a demanda (INC-2709-06).
// Hasta el 15/9 Caixa devolvía solo los 20 movimientos más antiguos; desde entonces el sync
// pide el día 1 del mes menos 8 días y el cliente tira lo anterior. Quien sincroniza poco, o
// cruza un cambio de mes, pierde ese tramo para siempre: el banco no lo vuelve a entregar
// si la siguiente lectura ya no lo pide.
//
// La ventana de siempre no cambia. Lo que queda entre el último éxito y esa ventana es el
// TRAMO ANTIGUO, y se recorre aparte, por trozos de fechas cerrados y de antiguo a nuevo.
// `last_sync` hace de cursor: no hay otra columna y no se añade ninguna.

export const OB_DEMAND_CAP_DAYS = 90;
export const OB_DEMAND_OVERLAP_DAYS = 3;
export const OB_DEMAND_MARGIN_DAYS = 8;
// Hay bancos que filtran `date_from` por fecha VALOR y la app pinta la fecha CONTABLE, que va
// uno o dos días antes: el movimiento llega en la respuesta con una fecha anterior al primer
// día pedido. El suelo que viaja al cliente baja estos días para que no lo tire (N5, 12/10).
export const OB_DEMAND_SKEW_DAYS = 3;
// Tope fijo de llamadas a /transactions por cuenta y pulsación. Lo comparten
// la ventana de siempre y el tramo antiguo: nunca 12 + 12. Es el mismo techo
// que ya tenía el bucle de páginas (2026-10-10).
export const OB_DEMAND_MAX_PAGES = 12;

const DAY_MS = 86400000;

export function utcYmd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function ymdAddDays(ymd: string, days: number): string {
  const p = ymd.split("-").map((x) => Number(x));
  return utcYmd(Date.UTC(p[0], p[1] - 1, p[2] + days));
}

export function ymdSpan(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1;
}

/** Día 1 UTC del mes menos 8 días. Es el `recentFrom` de antes: cubre el margen de Madrid
    y, en el borde de mes, puede pedir un mes de más, nunca uno de menos. */
export function currentDemandWindowStart(now: Date): string {
  return utcYmd(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - OB_DEMAND_MARGIN_DAYS * DAY_MS);
}

/** Cursor de un tramo a medias: el último milisegundo del último día leído ENTERO en todas
    las cuentas. No sale de las filas (el banco pagina en el orden que quiere), sino del
    trozo de fechas que se pidió. Leído de vuelta significa «ese día está completo, sigue
    por el siguiente», que es justo lo que diría un sync real hecho en ese instante. */
export function chunkCursor(ymd: string): string {
  return ymd + "T23:59:59.999Z";
}

/** Suelo que acepta el cliente cuando al banco se le pidió desde `asked`. No se pide nada
    más al banco (no gasta llamadas): solo deja entrar lo que ya viene en la respuesta. */
export function demandFloor(asked: string): string {
  return ymdAddDays(asked, -OB_DEMAND_SKEW_DAYS);
}

/** ACUSE (N2, 12/10). El cursor se escribía antes de que el móvil tuviera las filas: si la
    respuesta se perdía, ese trozo no se volvía a pedir. Ahora la respuesta lleva el cursor
    que le correspondería (`ack`) y el cliente lo devuelve en la pulsación siguiente, cuando
    ya lo tiene guardado junto a las filas. El acuse lleva pegada la clave del enlace
    (`ackLinkKey`): el acuse de otra persona, de otro banco o de una autorización anterior
    adelantaría un cursor cuyas filas este móvil no tiene. */
export function ackToken(cursor: string, linkKey: string): string {
  return cursor + "|" + linkKey;
}

/** Clave del enlace dentro del acuse: su id y la AUTORIZACIÓN vigente.
    Reconectar un banco NO cambia el id (`bank-connect` hace upsert sobre la misma fila), así
    que el id solo no distingue «antes de reconectar» de «después». Lo que sí cambia en cada
    autorización es `state_issued_at`, que escribe `bank-connect` y nadie más toca.
    REGLA: al reconectar, el cursor lo decide `bank-callback` (lo conserva si vuelven las
    mismas cuentas; si no, el enlace arranca como nuevo) y todo acuse emitido antes deja de
    valer. Así un móvil con un acuse viejo no puede llevar el cursor a otro punto: ni
    resucitar el de un enlace que arrancó de cero, ni adelantar el conservado. Lo que ese
    móvil tuviera de más se vuelve a leer una vez y lo deduplica por `ext_id`. */
export function ackLinkKey(linkId: unknown, issuedAt: unknown): string {
  const ms = typeof issuedAt === "string" ? Date.parse(issuedAt) : NaN;
  return String(linkId) + "." + (Number.isFinite(ms) ? ms.toString(36) : "0");
}

/** Decide si un acuse mueve el cursor: tiene que ser de ESTE enlace y de ESTA autorización
    (`linkKey`), con la forma exacta que emite el servidor, no estar en el futuro y quedar
    por delante del cursor actual (nunca retrocede). Devuelve el cursor nuevo o null. */
export function ackCursor(raw: unknown, linkKey: string, lastSync: unknown, now: Date): string | null {
  const m = typeof raw === "string" ? raw.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\|(.+)$/) : null;
  if (!m || m[2] !== linkKey) return null;
  const ms = Date.parse(m[1]);
  // Ida y vuelta: `Date.parse` normaliza un «30 de febrero» al 2 de marzo en vez de
  // rechazarlo, y esa fecha no la emitió nadie. Solo vale lo que se reescribe idéntico.
  if (!Number.isFinite(ms) || new Date(ms).toISOString() !== m[1] || ms > now.getTime()) return null;
  const cur = typeof lastSync === "string" ? Date.parse(lastSync) : NaN;
  return Number.isFinite(cur) && cur >= ms ? null : m[1];
}

export type DemandPlan = {
  windowStart: string;
  /** El último éxito cae antes de la ventana: hay tramo que el margen de siempre no cubre. */
  gap: boolean;
  /** Primer y último día del tramo. Solo valen con `gap`. */
  from: string;
  to: string;
  /** Días anteriores a `from` que se releen por cortesía, o null. */
  overlapFrom: string | null;
  gapBeyondCap: boolean;
};

export function demandPlan(now: Date, lastSync: unknown, recover: boolean): DemandPlan {
  const windowStart = currentDemandWindowStart(now);
  const to = ymdAddDays(windowStart, -1);
  const ms = typeof lastSync === "string" && /^\d{4}-\d{2}-\d{2}/.test(lastSync) ? Date.parse(lastSync) : NaN;
  // Sin último éxito conocido se queda el margen: igual que siempre.
  if (!Number.isFinite(ms)) return { windowStart, gap: false, from: windowStart, to, overlapFrom: null, gapBeyondCap: false };
  const day = utcYmd(ms);
  const sealed = ((ms % DAY_MS) + DAY_MS) % DAY_MS === DAY_MS - 1;
  // Un sync real a media tarde no vio lo que el banco apuntó ese día más tarde: su día se
  // relee. Un día sellado por `chunkCursor` ya está entero.
  const resume = sealed ? ymdAddDays(day, 1) : day;
  const floor = utcYmd(now.getTime() - OB_DEMAND_CAP_DAYS * DAY_MS);
  const beyond = resume < floor;
  const from = beyond ? floor : resume;
  // Solape de 3 días solo detrás de un sync real, por si el banco contabilizó tarde. Detrás
  // de un trozo sellado sobra: hace más de una semana que esos días se cerraron.
  const back = ymdAddDays(from, -OB_DEMAND_OVERLAP_DAYS);
  const overlapFrom = sealed || beyond ? null : (back < floor ? floor : back);
  return {
    windowStart, gap: resume < windowStart, from, to,
    overlapFrom: overlapFrom && overlapFrom < from ? overlapFrom : null,
    // `recover` en false es un cliente que no ha dicho que va a guardar el tramo: no se le
    // anuncia un tope que no va a pedir.
    gapBeyondCap: recover && resume < windowStart && beyond,
  };
}

/** Días del siguiente trozo. Crece al doble mientras la densidad vista (páginas por día)
    diga que cabe en las llamadas libres; si no, se reduce a la mitad hasta un día. La
    reducción se decide ANTES de pedir: un trozo que no cabe gasta todas las llamadas que
    quedaban y no hay dónde apuntar un tamaño para la siguiente pulsación. */
export function nextChunkDays(prev: number, pages: number, days: number, free: number): number {
  let size = Math.max(1, prev) * 2;
  while (size > 1 && Math.ceil(size * pages / Math.max(1, days)) > free) size = Math.floor(size / 2);
  return size;
}

/** Lectura entera: todas las cuentas respondieron, sin corte de páginas y sin error a
    media paginación. Un saldo bueno con el extracto a medias no es un extracto leído. */
export function demandReadComplete(accounts: Array<{ ok?: boolean; truncated?: boolean; transactionError?: string } | null> | null): boolean {
  if (!accounts || !accounts.length) return false;
  return accounts.every((a) => !!a && a.ok === true && !a.truncated && !a.transactionError);
}
