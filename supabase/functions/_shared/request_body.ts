// El límite se aplica mientras llegan bytes: req.json()/text() ya habría reservado todo
// el cuerpo. Content-Length es solo un rechazo anticipado, nunca la única protección.
export async function readBodyLimited(req: Request, max: number): Promise<
  { ok: true; text: string } | { ok: false; status: number; error: string }
> {
  const tooLarge = () => ({ ok: false as const, status: 413, error: "cuerpo demasiado grande" });
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
        // La respuesta no puede quedar esperando a un emisor que no acepte cancelar.
        void reader.cancel().catch(() => {});
        return tooLarge();
      }
      text += decoder.decode(value, { stream: true });
    }
    return { ok: true, text: text + decoder.decode() };
  } catch (_) {
    void reader.cancel().catch(() => {});
    return { ok: false, status: 400, error: "cuerpo inválido" };
  } finally { reader.releaseLock(); }
}

// Envolventes preventivas aprobadas, no máximos observados en el banco. Se conservan
// los acuses de doce bancos y las credenciales/OTP legítimas sin recortar sus campos.
export const BODY_LIMITS = {
  "bank-aspsps": 16 * 1024, "bank-connect": 16 * 1024,
  "bank-disconnect": 16 * 1024, "bank-sync": 32 * 1024,
  "bank-callback": 1024, "categorize": 8 * 1024, "delete-account": 64 * 1024,
} as const;
export type InputName = keyof typeof BODY_LIMITS;
type ObjectBody = Record<string, unknown>;
const object = (b: unknown): b is ObjectBody => b !== null && typeof b === "object" && !Array.isArray(b);
const text = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const optional = (b: ObjectBody, k: string, rule: (v: unknown) => boolean) => !(k in b) || rule(b[k]);
const country = (v: unknown) => typeof v === "string" && /^[a-z]{2}$/i.test(v);
const date = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v))
  && new Date(v).toISOString().slice(0, 10) === v;

export function validInput(name: InputName, b: unknown): b is ObjectBody {
  if (!object(b)) return false;
  switch (name) {
    case "bank-aspsps": return optional(b, "country", country);
    case "bank-connect": return optional(b, "aspsp_name", (v) => typeof v === "string")
      && optional(b, "country", country) && optional(b, "platform", (v) => v === "app" || v === "web");
    case "bank-disconnect": return text(b.aspsp_name);
    case "bank-sync": return optional(b, "dateFrom", (v) => typeof v === "string" && date(v.slice(0, 10))
        && (v.length === 10 || /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v))))
      && optional(b, "recoverGaps", (v) => typeof v === "boolean")
      && optional(b, "aspsps", (v) => Array.isArray(v) && v.every((s) => s === null || typeof s === "string"));
    case "categorize": return text(b.merchant);
    case "delete-account": return text(b.password);
    default: return Object.keys(b).length === 0;
  }
}

export async function readInput(req: Request, name: InputName): Promise<
  { ok: true; body: ObjectBody } | { ok: false; status: number; error: string }
> {
  const read = await readBodyLimited(req, BODY_LIMITS[name]);
  if (!read.ok) return read;
  let body: unknown;
  try { body = read.text === "" ? {} : JSON.parse(read.text); }
  catch (_) { return { ok: false, status: 400, error: "cuerpo inválido" }; }
  if (!validInput(name, body)) return { ok: false, status: 400, error: "cuerpo inválido" };
  return { ok: true, body };
}
