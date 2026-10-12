// Se cuentan bytes mientras llegan: req.text() seguido de length ya reservó el cuerpo entero
// y además cuenta UTF-16, no el tamaño de transporte (SEC-01, 12/10/2026).
export type BodyRead = { ok: true; text: string } | { ok: false; status: number; error: string };

export async function readBodyLimited(req: Request, max: number): Promise<BodyRead> {
  const tooLarge = (): BodyRead => ({ ok: false, status: 413, error: "cuerpo demasiado grande" });
  if (Number(req.headers.get("content-length") || 0) > max) return tooLarge();
  if (!req.body) return { ok: true, text: "" };
  const reader = req.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0, text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > max) {
        // La respuesta 413 no depende de que el emisor coopere al cancelar su stream.
        void reader.cancel().catch(() => {});
        return tooLarge();
      }
      text += decoder.decode(value, { stream: true });
    }
    return { ok: true, text: text + decoder.decode() };
  } catch (_) {
    void reader.cancel().catch(() => {});
    return { ok: false, status: 400, error: "cuerpo inválido" };
  } finally {
    reader.releaseLock();
  }
}

// Envolventes preventivas, NO máximos observados en producción. Los emisores no acotan
// credenciales/nombres; los fixtures de contrato dejan al menos 10x de margen (SEC-01).
export const BANK_BODY_BYTES = 16 * 1024;
// El acuse de doce bancos también viaja aquí: su fixture necesita margen de diez veces.
export const BANK_SYNC_BODY_BYTES = 32 * 1024;
export const CREDENTIAL_BODY_BYTES = 64 * 1024;
// Una invocación sin argumentos manda cero bytes o {}; 1024 deja margen al transporte.
export const EMPTY_BODY_BYTES = 1024;
// 120 caracteres escapados ocupan hasta 720 bytes más la clave; margen >10x.
export const CATEGORY_BODY_BYTES = 8 * 1024;
// Son los límites YA existentes: no se ensancha el contrato de prices ni ayuda.
export const PRICES_BODY_BYTES = 4096;
export const HELP_BODY_BYTES = 4096;
// Ingest admitía 16384 unidades UTF-16 SIN Content-Length: hasta 49152 bytes UTF-8.
// Conservamos ambos límites históricos; un máximo de 16384 bytes recortaría ese contrato.
export const INGEST_BODY_BYTES = 3 * 16384;
export const BODY_LIMITS = {
  "bank-aspsps": BANK_BODY_BYTES, "bank-connect": BANK_BODY_BYTES,
  "bank-disconnect": BANK_BODY_BYTES, "bank-sync": BANK_SYNC_BODY_BYTES,
  "bank-callback": EMPTY_BODY_BYTES, "categorize": CATEGORY_BODY_BYTES,
  "delete-account": CREDENTIAL_BODY_BYTES, "ingest": INGEST_BODY_BYTES,
  "myinvestor-connect": CREDENTIAL_BODY_BYTES, "myinvestor-sync": EMPTY_BODY_BYTES,
  "myinvestor-disconnect": EMPTY_BODY_BYTES, "myinvestor-keepalive": EMPTY_BODY_BYTES,
  "prices": PRICES_BODY_BYTES, "help-assistant": HELP_BODY_BYTES,
} as const;
export type InputName = keyof typeof BODY_LIMITS;
type ObjectBody = Record<string, unknown>;
export type InputRead = { ok: true; body: ObjectBody } | { ok: false; status: number; error: string; unrecognized?: boolean };
const object = (b: unknown): b is ObjectBody => b !== null && typeof b === "object" && !Array.isArray(b);
const text = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const optional = (b: ObjectBody, k: string, rule: (v: unknown) => boolean) => !(k in b) || rule(b[k]);
const country = (v: unknown) => typeof v === "string" && /^[a-z]{2}$/i.test(v);
const date = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)
  && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;

export function validInput(name: InputName, b: unknown): b is ObjectBody {
  if (!object(b)) return false;
  switch (name) {
    case "bank-aspsps": return optional(b, "country", country);
    case "bank-connect": return optional(b, "aspsp_name", (v) => typeof v === "string") && optional(b, "country", country)
      && optional(b, "platform", (v) => v === "app" || v === "web");
    case "bank-disconnect": return text(b.aspsp_name);
    case "bank-sync": return optional(b, "dateFrom", (v) => typeof v === "string" && date(v.slice(0, 10))
        && (v.length === 10 || /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v))))
      && optional(b, "recoverGaps", (v) => typeof v === "boolean")
      && optional(b, "aspsps", (v) => Array.isArray(v) && v.every((s) => s === null || typeof s === "string"));
    case "categorize": return text(b.merchant);
    case "delete-account": return text(b.password);
    case "help-assistant": return text(b.question) && b.question.length <= 600;
    case "prices": return optional(b, "symbols", (v) => Array.isArray(v)
      && v.every((s) => s === null || typeof s === "string" || typeof s === "number"));
    case "myinvestor-connect": {
      if (!optional(b, "storeTokens", (v) => typeof v === "boolean") || !text(b.deviceId)) return false;
      if (b.storeTokens === true) return text(b.accessToken)
        && optional(b, "refreshToken", (v) => v === null || typeof v === "string")
        && optional(b, "refreshExpiresIn", (v) => v === null || typeof v === "number" && Number.isFinite(v) && v >= 0
          && Number.isFinite(new Date(Date.now() + v * 1000).getTime()));
      if (!text(b.customerId) || !text(b.password)) return false;
      const otp = ["otpId", "signatureRequestId", "code"];
      // El proveedor devuelve también números/null; el handler conserva su conversión y
      // el login sin OTP cuando falta algún componente. No se admiten objetos ni arrays.
      return otp.every((k) => optional(b, k, (v) => v == null || typeof v === "string" || typeof v === "number" && Number.isFinite(v)));
    }
    case "ingest": {
      // La APK descarta 4xx sin reintento. Los cinco cuerpos de compatibilidad ejecutados
      // contra beta prueban que esos campos los normaliza el handler y registra el descarte.
      // Se mantiene el objeto JSON/formulario reconocido, su tope y toda la autenticación.
      return object(b);
    }
    // Estas rutas no consumen parámetros. Un objeto vacío o cuerpo ausente sigue siendo válido.
    default: return Object.keys(b).length === 0;
  }
}

export async function readInput(req: Request, name: InputName): Promise<InputRead> {
  const read = await readBodyLimited(req, BODY_LIMITS[name]);
  if (!read.ok) return read;
  const raw = read.text;
  if (name === "ingest" && (raw.length > 16384 || Number(req.headers.get("content-length") || 0) > 16384))
    return { ok: false, status: 413, error: "cuerpo demasiado grande" };
  let body: unknown;
  try {
    body = raw === "" ? {} : JSON.parse(raw);
  } catch (_) {
    // Prices ya usaba sus símbolos por defecto ante JSON roto; el tope se comprobó antes.
    if (name === "prices") return { ok: true, body: {} };
    // MacroDroid antiguo manda formularios. No tratar JSON roto como un formulario vacío.
    if (name !== "ingest" || !raw.includes("=") || /^\s*[\[{]/.test(raw))
      return { ok: false, status: 400, error: "cuerpo inválido", ...(name === "ingest" ? { unrecognized: true } : {}) };
    body = Object.fromEntries(new URLSearchParams(raw));
  }
  if (!validInput(name, body)) return { ok: false, status: 400, error: "cuerpo inválido" };
  return { ok: true, body };
}
