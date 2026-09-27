// ============================================================
// Límite de peticiones (2026-07-25). Ver el porqué en la migración 0019_rate_limit.sql.
//
// Se apoya en Postgres y no en memoria del isolate a propósito: las Edge Functions arrancan y
// mueren solas y hay varias a la vez, así que un contador en memoria se resetea justo cuando
// más falta hace. La cuenta la hace `check_rate_limit` en una sola sentencia atómica.
//
// REGLA DE LA CASA: si el propio limitador falla (BD caída, migración sin aplicar), se DEJA
// PASAR. Un freno de seguridad que tumba la app cuando se rompe convierte un incidente pequeño
// en uno grande — y aquí lo que hay al otro lado son los gastos de una familia, no una API
// pública. El fallo se apunta en la consola de la función para que se vea.
// ============================================================

// deno-lint-ignore no-explicit-any
type Supa = any;

export interface RateVerdict {
  ok: boolean;      // false = hay que rechazar con 429
  checked: boolean; // false = el limitador no pudo comprobar nada (se deja pasar)
}

export async function rateLimit(
  supa: Supa,
  bucket: string,
  limit: number,
  windowSecs: number,
): Promise<RateVerdict> {
  try {
    const { data, error } = await supa.rpc("check_rate_limit", {
      p_bucket: bucket,
      p_limit: limit,
      p_window_secs: windowSecs,
    });
    if (error) {
      console.error("rate-limit no disponible (se deja pasar):", error.message);
      return { ok: true, checked: false };
    }
    return { ok: data !== false, checked: true };
  } catch (e) {
    console.error("rate-limit excepción (se deja pasar):", String((e as Error)?.message || e));
    return { ok: true, checked: false };
  }
}

/**
 * Identidad del que llama para agrupar los golpes. Se prefiere algo estable y propio (el token,
 * el usuario) y la IP solo como respaldo.
 *
 * La IP NUNCA se guarda en claro: se mete en el nombre del bucket como hash, porque es un dato
 * personal (RGPD) y esta tabla no es sitio para guardarlos. Con el hash se cuenta igual de bien
 * y no se puede leer hacia atrás.
 */
export async function bucketKey(prefix: string, raw: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}:${hex.slice(0, 32)}`;
}

export function callerIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    || req.headers.get("cf-connecting-ip")
    || "sin-ip";
}
