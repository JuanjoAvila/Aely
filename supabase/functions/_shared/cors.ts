// ============================================================
// CORS con LISTA BLANCA de orígenes (2026-07-25).
//
// Hasta ahora todas las funciones respondían `Access-Control-Allow-Origin: *`. Eso significa
// que CUALQUIER página de internet puede llamarlas desde el navegador de quien la visite. Con
// `verify_jwt = true` hace falta además el token del usuario, así que no es una puerta abierta
// —el navegador no adjunta el JWT solo, va en una cabecera que pone nuestro cliente—, pero el
// `*` regala una capa gratis: si alguna vez se filtra un token (una extensión, un log, un
// copia-pega en un foro), con `*` se explota desde cualquier web y con lista blanca no.
// Y en las funciones SIN JWT (ingest) el `*` es directamente un problema.
//
// Cómo funciona: se ECHA de vuelta el Origin recibido solo si está permitido. Si no lo está,
// no se manda la cabecera y el navegador bloquea la respuesta. Lo que NO cambia: curl, el cron
// de keepalive y el lector nativo de Android no son navegadores y siguen funcionando igual —
// CORS es una protección del navegador, no un cortafuegos.
//
// El origen de producción sale de APP_URL (el mismo secreto que ya usa bank-callback), así que
// mudar la app de dominio no obliga a tocar código.
// ============================================================

const LOCAL = [
  "https://localhost",      // WebView de la APK (capacitor.config.json → androidScheme: "https")
  "capacitor://localhost",  // iOS / esquema capacitor por si algún día
  "ionic://localhost",
];

function appOrigin(): string | null {
  try { return new URL(Deno.env.get("APP_URL") || "https://juanjoavila.github.io/Aely/").origin; }
  catch { return null; }
}

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (LOCAL.indexOf(origin) >= 0) return true;
  if (origin === appOrigin()) return true;
  // Desarrollo y e2e: `serve public -l 4173`, vite, lo que sea, en la máquina de uno.
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

const BASE = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ingest-token",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
  // Sin esto, una caché intermedia podría servirle a un origen la respuesta con el ACAO de otro.
  "Vary": "Origin",
};

export function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  if (!isAllowedOrigin(origin)) return { ...BASE };
  return { ...BASE, "Access-Control-Allow-Origin": origin as string };
}

export function jsonRespCors(req: Request, obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsFor(req), "Content-Type": "application/json" },
  });
}

export function preflight(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  return new Response("ok", { headers: corsFor(req) });
}

/**
 * Envuelve el handler de una función: responde el preflight y REESCRIBE la cabecera de origen
 * de la respuesta.
 *
 * Se hace envolviendo y no tocando cada `jsonResp(...)` a propósito: hay decenas de puntos de
 * retorno repartidos por diez funciones, y una lista blanca que se aplica «en casi todos» los
 * sitios no es una lista blanca. Aquí pasa TODA respuesta por el mismo sitio, incluidas las de
 * los `catch`, que son justo las que se olvidan.
 */
export function withCors(handler: (req: Request) => Response | Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    const pre = preflight(req);
    if (pre) return pre;
    const res = await handler(req);
    const h = new Headers(res.headers);
    h.delete("Access-Control-Allow-Origin");   // fuera el "*" que puedan traer los helpers viejos
    const c = corsFor(req);
    for (const k of Object.keys(c)) h.set(k, c[k]);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  };
}
