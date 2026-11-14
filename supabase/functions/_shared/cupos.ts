// ============================================================
// Cupos globales que una cuenta recién creada no puede agotar (P2-06, auditoría del 14/11).
//
// El registro está abierto. Un cupo global único (`help-assistant-total-day`, 1000 al día) lo
// agotaba cualquiera con 34 cuentas nuevas, y con él se quedaba sin ayuda la familia. Ahora las
// cuentas con menos de una semana comparten un cupo global PROPIO y más pequeño: quien cree
// cuentas en bucle solo agota ese, y las cuentas de siempre conservan el suyo. Para llegar al
// cupo de las veteranas hay que esperar una semana con cada cuenta, que es justo lo caro.
// Puro y sin Deno: lo prueban Deno y Node.
// ============================================================

export const ANTIGUEDAD_VETERANA_MS = 7 * 24 * 3600 * 1000;

/** Sin fecha legible cuenta como nueva: lo prudente es el cupo pequeño, nunca el de la familia. */
export function cuentaVeterana(createdAt: unknown, now = Date.now()): boolean {
  const t = typeof createdAt === "string" ? Date.parse(createdAt) : NaN;
  return Number.isFinite(t) && now - t >= ANTIGUEDAD_VETERANA_MS;
}

export type Cupo = { bucket: string; limit: number; windowSecs: number };
export type Topes = { veterana: number; nueva: number };

/** Cupo compartido por todas las cuentas del mismo grupo de antigüedad. Las veteranas conservan
 *  el nombre de cubo de siempre (`<base>-total-<sufijo>`), así el contador vivo no se reinicia. */
export function cupoGlobal(base: string, sufijo: string, veterana: boolean, topes: Topes, windowSecs: number): Cupo {
  return veterana
    ? { bucket: `${base}-total-${sufijo}`, limit: topes.veterana, windowSecs }
    : { bucket: `${base}-new-${sufijo}`, limit: topes.nueva, windowSecs };
}
