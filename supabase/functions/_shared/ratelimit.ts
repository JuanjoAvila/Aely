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

// El error de Postgres puede incluir el bucket o datos de una fila; solo viaja SQLSTATE.
function rateLogCode(err: unknown): string {
  const code = String((err as { code?: unknown })?.code || "");
  return ["23505", "42501", "42703", "42P01", "PGRST204"].includes(code) ? code : "unavailable";
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
      console.error("rate-limit no disponible (se deja pasar):", rateLogCode(error));
      return { ok: true, checked: false };
    }
    return { ok: data !== false, checked: true };
  } catch (e) {
    console.error("rate-limit excepción (se deja pasar):", rateLogCode(e));
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

/* DE QUÉ CABECERA SALE LA IP (P3-04, auditoría del 14/11; SEG-09).
   Hasta ahora, el PRIMER valor de `x-forwarded-for`. Si el gateway de Supabase AÑADE a una XFF que
   ya traía el cliente en vez de sustituirla, ese primer valor lo elige quien llama, y rotándolo se
   esquiva el cubo por IP de `ingest` y `bank-callback`. Nadie ha comprobado qué hace el gateway, y
   cambiar a ciegas al ÚLTIMO valor puede ser peor: si el último es un salto interno del propio
   Supabase, todas las peticiones del mundo caerían en un solo cubo y el freno de 60/min tumbaría
   el lector de notificaciones de la familia. Así que queda PREPARADO y APAGADO:
   · `RATE_LIMIT_IP_SOURCE` = `xff-first` (por defecto, lo de siempre), `xff-last` o `cf`
     (`cf-connecting-ip`, la que pone Cloudflare y el cliente no puede fijar si pasa por él).
   · `RATE_LIMIT_IP_DIAG=1` apunta en la consola, una vez por instancia, la FORMA de las cabeceras
     (cuántos saltos, qué cabeceras hay, si el primero es de la red de documentación 203.0.113.0/24
     que se manda a propósito en la prueba y si `cf-connecting-ip` coincide con el primero o el
     último). Nunca una IP. El procedimiento está en docs/SETUP-SUPABASE.md. */
let diagnosticoHecho = false;

// Interruptor opcional: sin permiso de entorno (tests con `--allow-env` acotado) cuenta como ausente,
// para que añadir uno nuevo no tumbe a quien no lo conoce.
function envOpcional(k: string): string | undefined {
  try { return Deno.env.get(k); } catch { return undefined; }
}

function esDePrueba(ip: string): boolean {
  return /^203\.0\.113\.\d{1,3}$/.test(ip);
}

function diagnosticarCabeceras(saltos: string[], cf: string | null, real: string | null): void {
  if (diagnosticoHecho || envOpcional("RATE_LIMIT_IP_DIAG") !== "1") return;
  diagnosticoHecho = true;
  const forma = {
    saltos: saltos.length,
    cf: !!cf, xReal: !!real,
    primeroDePrueba: saltos.length > 0 && esDePrueba(saltos[0]),
    algunoDePrueba: saltos.some(esDePrueba),
    cfIgualPrimero: !!cf && saltos[0] === cf,
    cfIgualUltimo: !!cf && saltos[saltos.length - 1] === cf,
  };
  console.error("rate-limit cabeceras: " + JSON.stringify(forma));
}

export function callerIp(req: Request): string {
  const saltos = (req.headers.get("x-forwarded-for") || "").split(",").map((x) => x.trim()).filter(Boolean);
  const cf = req.headers.get("cf-connecting-ip");
  diagnosticarCabeceras(saltos, cf, req.headers.get("x-real-ip"));
  const fuente = envOpcional("RATE_LIMIT_IP_SOURCE");
  if (fuente === "cf") return cf || saltos[saltos.length - 1] || "sin-ip";
  if (fuente === "xff-last") return saltos[saltos.length - 1] || cf || "sin-ip";
  return saltos[0] || cf || "sin-ip";
}
