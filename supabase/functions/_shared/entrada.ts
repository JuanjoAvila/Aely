// ============================================================
// Entradas de las Edge Functions que se llaman SIN sesión (SEC-01, OPS-06, 14/9/2026).
// `ingest` (token), `bank-callback` (state/code en la URL) y `myinvestor-keepalive` (clave de cron)
// reciben datos de cualquiera que conozca la URL. Aquí vive lo que las tres comparten, puro y sin
// Deno, para poder probarlo desde Node.
// ============================================================

/**
 * Comparación en tiempo CONSTANTE (vivía solo en ingest desde 2026-07-24).
 * `a === b` corta en el primer byte distinto y el tiempo de respuesta filtra cuántos has acertado.
 * Se comparan SIEMPRE los mismos bytes para que ni la longitud se filtre.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  const len = Math.max(ba.length, bb.length);
  let diff = ba.length ^ bb.length;
  for (let i = 0; i < len; i++) diff |= (ba[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

/* TOPES DE INGEST. Una notificación de banco no pasa de unos cientos de caracteres; sin tope, quien
   tenga un token (o uno viejo filtrado) podía mandar megas y guardar un «comercio» de un mega. */
export const INGEST_MAX_BODY = 16 * 1024;
export const INGEST_MAX_TEXTO = 1000;
export const INGEST_MAX_COMERCIO = 120;
export const INGEST_MAX_NOTA = 300;

export function recortar(s: unknown, max: number): string {
  const t = typeof s === "string" ? s : s == null ? "" : String(s);
  return t.length > max ? t.slice(0, max) : t;
}

/* LO QUE VUELVE DEL BANCO A LA APP (bank-callback → back.html → toast).
   Antes viajaba el texto del error tal cual, con la query de la URL dentro: quien fabricara el enlace
   podía hacer que Aely enseñara un mensaje suyo («llama a este número…»). Ahora solo viaja un código
   de esta lista; el detalle se queda en el servidor (app_events). La app traduce el código y, si no
   lo conoce, enseña el genérico — nunca el texto. `nolink:<banco>` sigue como estaba. */
export const CALLBACK_CODIGOS = ["eb_error", "sin_code", "state", "caducado", "sin_cuenta", "error"] as const;
export type CallbackCodigo = typeof CALLBACK_CODIGOS[number];

export class CallbackFallo extends Error {
  code: CallbackCodigo;
  detalle: string;
  constructor(code: CallbackCodigo, detalle = "") {
    super(code);
    this.code = code;
    this.detalle = detalle;
  }
}

/** El código que puede salir en la URL para un error cualquiera: nunca su texto. */
export function codigoCallback(e: unknown): CallbackCodigo {
  return e instanceof CallbackFallo ? e.code : "error";
}

/** `nolink:<banco>` con un nombre de banco limpio (viene de nuestra BD, pero se acota igual). */
export function codigoNolink(banco: unknown): string {
  return "nolink:" + recortar(banco, 60).replace(/[^\p{L}\p{N} .&'()-]/gu, "");
}

/* LA VINCULACIÓN LA CONFIRMA QUIEN LA INICIÓ (P2-01, auditoría del 14/11).
   El `state` ata la vuelta del banco con quien llamó a `bank-connect`, pero NO con el navegador
   que vuelve: el callback no lleva sesión. Un atacante con cuenta en Aely podía llamar a
   `bank-connect`, mandarle a otra persona la URL del banco («reconecta tu banco») y, si esa
   persona autorizaba, su consentimiento de 90 días quedaba en la cuenta del atacante.
   No se puede atar con una cookie: en la APK la vuelta llega por el navegador del sistema, no por
   la WebView que empezó. Así que, en modo confirmación, el callback no da la vinculación por
   buena: guarda la sesión en `pending` con la HUELLA de un token de un solo uso y manda el token a
   quien vuelve. Solo la app con sesión del MISMO usuario que inició (`bank-confirm`, con JWT) la
   activa. El atacante nunca ve el token (vuelve al navegador de la víctima) y la víctima no puede
   activarla porque el enlace no es suyo.
   Fase 1, compatible con lo instalado: solo si el cliente lo pide (`confirm:true` en
   `bank-connect`, que marca el state con `.c`). Fase 2: `BANK_REQUIRE_CONFIRM=1`, siempre. */
export const CONFIRM_PREFIX = "confirm:";
/** Ventana para confirmar, contada desde la emisión del state (bank-connect). */
export const CONFIRM_TTL_MS = 60 * 60 * 1000;

/** El state de bank-connect lleva `.c` antes del `.app` opcional cuando el cliente pidió confirmar. */
export function stateConConfirmacion(state: unknown): boolean {
  return typeof state === "string" && /^[^.:]+\.c(?:\.app)?$/.test(state);
}

/** 32 bytes aleatorios en base64url (43 caracteres): viaja en la URL de vuelta. */
export function nuevoTokenConfirmacion(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function tokenConfirmacionValido(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

/** Lo que se guarda en `state`: solo la huella. Quien lea su fila (RLS) no puede sacar el token. */
export async function huellaConfirmacion(token: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
  let hex = "";
  for (let i = 0; i < d.length; i++) hex += d[i].toString(16).padStart(2, "0");
  return CONFIRM_PREFIX + hex;
}

/** Sin marca de emisión no se confirma: el modo confirmación nace siempre con ella. */
export function confirmacionCaducada(stateIssuedAt: unknown, now = Date.now()): boolean {
  const t = typeof stateIssuedAt === "string" ? Date.parse(stateIssuedAt) : NaN;
  return !Number.isFinite(t) || now - t > CONFIRM_TTL_MS;
}
