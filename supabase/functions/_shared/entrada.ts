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
