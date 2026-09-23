/**
 * Identidad e incertidumbre del lector de notificaciones.
 *
 * Una compra con la tarjeta de Trade Republic puede avisar por DOS aplicaciones: TR enseña el
 * nombre comercial y Wallet el descriptor del datáfono. Importe y hora parecidos no demuestran que
 * sean el mismo cargo; solo permiten dejar el segundo pendiente de decisión. Lo único que se puede
 * descartar sin perder una compra real es el MISMO evento nativo reintentado.
 */

export type FuenteIngest = "tr" | "wallet";

export type CandidatoIngest = {
  id?: string | null;
  fecha: string;
  importe: number | string;
  ingest_event_id?: string | null;
  created_at?: string | null;
};

const EVENTO_MAX = 160;
const GEMELO_MS = 2 * 60 * 60 * 1000;
const GEMELO_LEGACY_MS = 10 * 60 * 1000;

/** Solo acepta la huella opaca del APK; nunca título, tarjeta ni texto de la notificación. */
export function normalizarEventoId(raw: unknown): string | null {
  const s = String(raw || "").trim();
  if (!s || s.length > EVENTO_MAX || !/^[a-zA-Z0-9_-]+$/.test(s)) return null;
  return s;
}

/** Wallet solo se atribuye a TR cuando la propia notificación nombra esa tarjeta. */
export function origenEvento(fuente: FuenteIngest, texto: string): string {
  if (fuente === "tr") return "tr:trade_republic";
  const s = String(texto || "").toLowerCase();
  if (/trade\s+republic/.test(s) || /e\s+republic\s+visa/.test(s)) return "wallet:trade_republic";
  return "wallet:unknown";
}

/** La clave persistida une origen conocido y huella. Dos reintentos producen la misma clave. */
export function claveEvento(raw: unknown, fuente: FuenteIngest, texto: string): string | null {
  const id = normalizarEventoId(raw);
  return id ? origenEvento(fuente, texto) + ":" + id : null;
}

function origenDeClave(k: unknown): string {
  const s = String(k || "");
  const i = s.lastIndexOf(":");
  return i > 0 ? s.slice(0, i) : "";
}

/**
 * Dos eventos DISTINTOS solo son un posible gemelo si vienen de las dos puertas TR/Wallet, Wallet
 * identifica explícitamente la tarjeta de TR, el importe casa y están cerca. Nunca devuelve
 * «descartar»: la fila entra marcada para que el usuario decida.
 */
export function esPosibleGemeloIngest(actual: CandidatoIngest, anterior: CandidatoIngest): boolean {
  const ka = String(actual?.ingest_event_id || ""), kb = String(anterior?.ingest_event_id || "");
  if (!ka || !kb || ka === kb) return false;
  const oa = origenDeClave(ka), ob = origenDeClave(kb);
  const cruzado = (oa === "tr:trade_republic" && ob === "wallet:trade_republic") ||
    (ob === "tr:trade_republic" && oa === "wallet:trade_republic");
  if (!cruzado) return false;
  if (Math.abs(Number(actual.importe) - Number(anterior.importe)) > 0.02) return false;
  const ta = new Date(actual.fecha).getTime(), tb = new Date(anterior.fecha).getTime();
  return isFinite(ta) && isFinite(tb) && Math.abs(ta - tb) <= GEMELO_MS;
}

/**
 * Una APK anterior no manda identidad nativa. Ahí no se puede demostrar que sean el mismo cargo:
 * dos importes iguales y cercanos solo se conservan como duda, nunca se borran. Esta es la ventana
 * que ya usaba `ingest`; se comparte para que el control posterior al INSERT cierre también la
 * carrera entre dos notificaciones que llegan a la vez.
 */
export function esPosibleGemeloLegacy(actual: CandidatoIngest, anterior: CandidatoIngest): boolean {
  if (actual?.ingest_event_id || anterior?.ingest_event_id) return false;
  if (Math.abs(Number(actual.importe) - Number(anterior.importe)) > 0.02) return false;
  const ta = new Date(actual.fecha).getTime(), tb = new Date(anterior.fecha).getTime();
  return isFinite(ta) && isFinite(tb) && Math.abs(ta - tb) <= GEMELO_LEGACY_MS;
}

function esAnterior(a: CandidatoIngest, b: CandidatoIngest): boolean {
  const ta = new Date(a.created_at || a.fecha).getTime();
  const tb = new Date(b.created_at || b.fecha).getTime();
  if (isFinite(ta) && isFinite(tb) && ta !== tb) return ta < tb;
  return String(a.id || "") < String(b.id || "");
}

/** Solo la fila posterior queda pendiente: dos peticiones concurrentes toman la misma decisión. */
export function tieneGemeloAnterior(actual: CandidatoIngest, filas: CandidatoIngest[]): boolean {
  return (filas || []).some((otra) => {
    if (!otra || String(otra.id || "") === String(actual?.id || "")) return false;
    const gemela = esPosibleGemeloIngest(actual, otra) || esPosibleGemeloLegacy(actual, otra);
    return gemela && esAnterior(otra, actual);
  });
}
