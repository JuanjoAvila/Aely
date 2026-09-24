/**
 * Identidad y emparejado del lector de notificaciones.
 *
 * Una compra con la tarjeta de Trade Republic puede avisar por DOS aplicaciones: TR enseña el
 * nombre comercial y Wallet el descriptor del datáfono. Cuando ambas puertas nombran la misma
 * tarjeta, el importe casa y los avisos están cerca, son dos descripciones del mismo pago: solo se
 * conserva la primera. Dos avisos por la MISMA puerta siguen siendo dos compras distintas.
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
 * Dos eventos DISTINTOS son el mismo pago solo si vienen de las dos puertas TR/Wallet, Wallet
 * identifica explícitamente la tarjeta de TR, el importe casa y están cerca. La propia puerta
 * forma parte de la identidad para no juntar dos compras reales iguales notificadas por TR.
 */
export function esGemeloIngest(actual: CandidatoIngest, anterior: CandidatoIngest): boolean {
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
 * Una APK anterior no manda identidad nativa. Conserva la barrera histórica de diez minutos: es
 * menos precisa, pero impide que dos avisos simultáneos vuelvan a inflar las cifras mientras ese
 * APK siga instalado. Se comparte para cerrar también la carrera posterior al INSERT.
 */
export function esGemeloLegacy(actual: CandidatoIngest, anterior: CandidatoIngest): boolean {
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

/** Solo la fila posterior se descarta: dos peticiones concurrentes toman la misma decisión. */
export function tieneGemeloAnterior(actual: CandidatoIngest, filas: CandidatoIngest[]): boolean {
  return (filas || []).some((otra) => {
    if (!otra || String(otra.id || "") === String(actual?.id || "")) return false;
    const gemela = esGemeloIngest(actual, otra) || esGemeloLegacy(actual, otra);
    return gemela && esAnterior(otra, actual);
  });
}
