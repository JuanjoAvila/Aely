// ============================================================
// Shared: cliente de Enable Banking (Open Banking PSD2).
// Firma JWT RS256 con la clave privada de la app (secreto del servidor) y
// llama a la API. Portado del spike validado con Sabadell real.
//
// Secretos del proyecto (Dashboard → Edge Functions → Secrets):
//   EB_APP_ID       — Application ID de Enable Banking
//   EB_PRIVATE_KEY  — clave privada (PEM o su base64 en una sola línea)
//   EB_REDIRECT_URL — (opcional) URL del callback; por defecto la función bank-callback
//   APP_URL         — (opcional) URL pública de la app para volver tras el login
// ============================================================

const BASE = "https://api.enablebanking.com";
const enc = new TextEncoder();

function b64urlBytes(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const b64urlStr = (s: string) => b64urlBytes(enc.encode(s));

// Acepta PEM (multi o una línea) o base64 pelado del PKCS#8 → ArrayBuffer DER.
function keyToDer(raw: string): ArrayBuffer {
  const b64 = raw
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

export function ebConfig() {
  const appId = Deno.env.get("EB_APP_ID");
  const pem = Deno.env.get("EB_PRIVATE_KEY");
  if (!appId || !pem) throw new Error("Faltan secretos EB_APP_ID / EB_PRIVATE_KEY");
  return { appId, pem };
}

export async function makeJWT(appId: string, pem: string): Promise<string> {
  const header = { typ: "JWT", alg: "RS256", kid: appId };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: "enablebanking.com", aud: "api.enablebanking.com", iat: now, exp: now + 3600 };
  const data = `${b64urlStr(JSON.stringify(header))}.${b64urlStr(JSON.stringify(payload))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyToDer(pem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(data));
  return `${data}.${b64urlBytes(new Uint8Array(sig))}`;
}

// deno-lint-ignore no-explicit-any
export async function ebApi(jwt: string, path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<any> {
  const res = await fetch(BASE + path, {
    method: init.method || "GET",
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: init.signal,
  });
  const text = await res.text();
  // deno-lint-ignore no-explicit-any
  let data: any;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    // La excepción acaba a veces en app_events. La respuesta del proveedor puede traer datos de
    // sesión o cuenta: solo sale un código corto, nunca el cuerpo ni el texto crudo.
    const errorCode = data && typeof data === "object"
      ? (typeof data.error === "string" ? data.error : data.error?.code)
      : "";
    const topCode = data && typeof data === "object" && typeof data.code === "string" && !/^\d+$/.test(data.code)
      ? data.code
      : "";
    // Enable Banking usa `code` numérico para repetir el HTTP y `error` para el identificador
    // (p. ej. WRONG_TRANSACTIONS_PERIOD). Priorizar `code` rompía el fallback `strategy=longest`.
    const rawCode = errorCode || topCode;
    const code = String(rawCode).replace(/[^a-z0-9_.-]/gi, "").slice(0, 60);
    throw new Error(`EB ${res.status}${code ? " " + code : ""}`);
  }
  return data;
}

/* Qué dice un fallo de `ebApi` sobre el permiso del usuario. Un 401 NO basta: Enable Banking
   lo devuelve también con errores de la aplicación (`AUTHORIZATION_NOT_PROVIDED`,
   `UNAUTHORIZED_ACCESS`), y tratarlos como caducidad obligaba a reautorizar el banco por un
   fallo que no era del consentimiento (queja del 12/10: «tengo que volver a identificarme casi
   cada día»). Su FAQ pide decidir por el código de error y no por el HTTP:
   https://enablebanking.com/docs/faq/#why-does-the-api-return-expired-session-when-the-session-has-valid-until-in-the-future
   Los tres códigos son los que su referencia (`ErrorCode`) describe como sesión terminada:
   caducada, cerrada por la aplicación o revocada por el usuario. En los tres la única salida
   es una autorización nueva. Un 401 sin código, o con cualquier otro, NO decide nada por sí
   solo: quien llama pregunta por la sesión con `ebSessionVerdict`. */
const EB_SESSION_ENDED = ["EXPIRED_SESSION", "CLOSED_SESSION", "REVOKED_SESSION"];

/* El enum `ErrorCode` entero de https://enablebanking.com/docs/api/reference/ (leído el 13/10).
   Es la lista CERRADA de lo que puede salir a `app_events`: `error` es un campo libre de la
   respuesta y «tiene forma de enum» no basta (un nombre en mayúsculas con guiones bajos
   también la tiene). Lo que no esté aquí se apunta como `OTRO`. */
const EB_ERROR_CODES = ["ACCESS_DENIED", "ACCOUNT_DOES_NOT_EXIST", "ALREADY_AUTHORIZED", "ASPSP_ACCOUNT_NOT_ACCESSIBLE",
  "ASPSP_ERROR", "ASPSP_PAYMENT_NOT_ACCESSIBLE", "ASPSP_PSU_ACTION_REQUIRED", "ASPSP_RATE_LIMIT_EXCEEDED", "ASPSP_TIMEOUT",
  "AUTHORIZATION_NOT_PROVIDED", "CLOSED_SESSION", "DATE_FROM_IN_FUTURE", "DATE_TO_WITHOUT_DATE_FROM",
  "EXPIRED_AUTHORIZATION_CODE", "EXPIRED_SESSION", "INVALID_ACCOUNT_ID", "INVALID_HOST", "INVALID_PAYMENT",
  "NO_ACCOUNTS_ADDED", "PAYMENT_LIMIT_EXCEEDED", "PAYMENT_NOT_AUTHORIZED", "PAYMENT_NOT_FINALIZED", "PAYMENT_NOT_FOUND",
  "PAYMENT_SUBMISSION_NOT_DEFERRED", "PAYMENT_SUBMISSION_NOT_SUPPORTED", "PSU_HEADER_INVALID", "PSU_HEADER_NOT_PROVIDED",
  "REDIRECT_URI_NOT_ALLOWED", "REVOKED_SESSION", "SESSION_DOES_NOT_EXIST", "TRANSACTION_DOES_NOT_EXIST",
  "UNAUTHORIZED_ACCESS", "UNAUTHORIZED_IP", "UNTRUSTED_PAYMENT_PARTY", "WEBHOOK_URI_NOT_ALLOWED", "WRONG_ASPSP_PROVIDED",
  "WRONG_AUTHORIZATION_CODE", "WRONG_CONTINUATION_KEY", "WRONG_CREDENTIALS_PROVIDED", "WRONG_DATE_INTERVAL",
  "WRONG_REQUEST_PARAMETERS", "WRONG_SESSION_STATUS", "WRONG_TRANSACTIONS_PERIOD"];

// `code`: "" si el proveedor no mandó ninguno, uno del enum, u `OTRO`. Sin distinguir mayúsculas.
export function ebFailure(err: unknown): { status: number; code: string; sessionEnded: boolean } {
  const m = String((err as Error)?.message || err || "").match(/\bEB\s+(\d{3})(?:\s+([A-Za-z0-9_.-]+))?/);
  const raw = String((m && m[2]) || "").toUpperCase();
  const code = !raw ? "" : (EB_ERROR_CODES.includes(raw) ? raw : "OTRO");
  return { status: m ? Number(m[1]) : 0, code, sessionEnded: EB_SESSION_ENDED.includes(code) };
}

/* Un 401 que no trae código de sesión terminada puede ser igualmente una sesión muerta
   (`SESSION_DOES_NOT_EXIST`, `WRONG_SESSION_STATUS`, un `error` ausente: el campo es opcional)
   o un fallo de la aplicación con la sesión viva. Dejarlo en «error técnico» sin más dejaba
   el banco activo para siempre y sin botón de reconectar (revisión del 13/10). Se le pregunta
   al proveedor, que es lo que su FAQ recomienda: GET /sessions/{id} y se mira `status`.
   - `ended: true`  → hay que autorizar otra vez. Solo `AUTHORIZED` es una sesión que sirve
     para leer; los otros siete estados de `SessionStatus` no lo son.
   - `ended: false` → la sesión vive: el 401 era otra cosa.
   - `ended: null`  → no se pudo saber (sin id guardado, la consulta falló, estado que no
     consta). No se caduca por una pregunta sin respuesta.
   `state` es una clase cerrada para el diagnóstico, nunca texto del proveedor. */
const EB_SESSION_STATUSES = ["AUTHORIZED", "CANCELLED", "CLOSED", "EXPIRED", "INVALID", "PENDING_AUTHORIZATION",
  "RETURNED_FROM_BANK", "REVOKED"];

export async function ebSessionVerdict(jwt: string, sessionId: string | null, api = ebApi, timeoutMs = 8000): Promise<{ ended: boolean | null; state: string }> {
  if (!sessionId) return { ended: null, state: "SIN_ID" };
  if (timeoutMs <= 0) return { ended: null, state: "SIN_RESPUESTA" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const session = await api(jwt, `/sessions/${encodeURIComponent(sessionId)}`, { signal: controller.signal });
    const status = String(session?.status || "").toUpperCase();
    if (!EB_SESSION_STATUSES.includes(status)) return { ended: null, state: status ? "OTRO" : "SIN_ESTADO" };
    return { ended: status !== "AUTHORIZED", state: status };
  } catch (err) {
    const fail = ebFailure(err);
    if (fail.sessionEnded || fail.code === "SESSION_DOES_NOT_EXIST") return { ended: true, state: fail.code };
    return { ended: null, state: fail.status ? "EB_" + fail.status : "SIN_RESPUESTA" };
  } finally {
    clearTimeout(timer);
  }
}

// Una página vacía NO significa que no haya movimientos: el proveedor puede seguir buscando
// y devolver continuation_key. Mismo contrato para sync diario e histórico (15/9/2026).
// https://enablebanking.com/docs/faq/
export async function fetchBankTransactions(jwt: string, uid: string, dateFrom: string | null,
  api = ebApi, timeoutMs = 15000, preferLongest = false, maxPages = 12, dateTo: string | null = null) {
  if (timeoutMs <= 0) throw new Error("transactions_timeout");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // deno-lint-ignore no-explicit-any
  const transactions: any[] = [];
  const visited = new Set<string>();
  /* En el HISTÓRICO, `longest` va desde la primera petición. Caixa puede aceptar el periodo y
     devolver vacío sin `WRONG_TRANSACTIONS_PERIOD`; esperar al error dejaba la pantalla a cero.
     El sync diario no activa `preferLongest`: allí interesa la ventana reciente exacta.
     maxPages y dateTo los usa el sync a demanda para partir ventana y tramo antiguo sin
     pasar del tope de 12 llamadas por cuenta. El histórico no los manda: sigue en 12. */
  const pageCap = maxPages > 0 ? maxPages : 12;
  let continuation: string | null = null, longest = !!dateFrom && !!preferLongest, pages = 0;
  try {
    while (pages < pageCap && transactions.length < 2000) {
      const qs = new URLSearchParams();
      if (dateFrom) qs.set("date_from", dateFrom);
      if (dateTo) qs.set("date_to", dateTo);
      if (longest) qs.set("strategy", "longest");
      if (continuation) qs.set("continuation_key", continuation);
      let page;
      try {
        page = await api(jwt, `/accounts/${encodeURIComponent(uid)}/transactions?${qs}`, {signal:controller.signal});
        if (!page || !Array.isArray(page.transactions)) throw new Error("transactions_invalid");
      } catch (err) {
        // Solo este error permite buscar el periodo disponible. Un fallo de permiso o red
        // no se disfraza de histórico vacío ni dispara otro intento contra el banco.
        if (!longest && pages === 0 && /WRONG_TRANSACTIONS_PERIOD/.test(String(err))) {
          longest = true;
          continue;
        }
        if (!pages) throw err;
        const invalid = /transactions_invalid/.test(String(err));
        const status = String(err).match(/\bEB\s+(400|401|403|404|408|422|429|500|502|503|504)\b/i);
        return {transactions, truncated:true, transactionError:controller.signal.aborted ? "timeout" : "transactions_unavailable",
          readReason:controller.signal.aborted ? "time_limit" : invalid ? "invalid_response" : "provider_error",
          failureCode:controller.signal.aborted ? "timeout" : invalid ? "invalid_response" : status ? "eb_" + status[1] : "unavailable"};
      }
      pages++;
      const rows = page.transactions;
      const room = 2000 - transactions.length;
      transactions.push(...rows.slice(0, room));
      continuation = page.continuation_key || null;
      if (rows.length > room) return {transactions, truncated:true, readReason:"row_limit"};
      if (!continuation) return {transactions, truncated:false};
      // Un cursor cíclico no autoriza a dar por completo el extracto ni a repetir doce páginas.
      if (visited.has(continuation)) return {transactions, truncated:true, transactionError:"continuation_repeated", readReason:"repeated_cursor"};
      visited.add(continuation);
    }
    // El mismo truncated no decía si cortó el banco o si agotamos nuestro propio presupuesto.
    return {transactions, truncated:true, readReason:transactions.length >= 2000 ? "row_limit" : "page_limit"};
  } finally {
    clearTimeout(timer);
  }
}

// Mapea un movimiento de Enable Banking al formato de la app.
// Convención del cliente: amount POSITIVO = gasto, NEGATIVO = ingreso.
// deno-lint-ignore no-explicit-any
export function mapTransaction(t: any) {
  // Math.abs: la spec Berlin Group/PSD2 dice que `transaction_amount.amount` es MAGNITUD sin
  // signo (la dirección va aparte, en `credit_debit_indicator`) — pero no todos los ASPSPs la
  // cumplen a rajatabla. Si alguno manda el importe YA firmado (negativo en un cargo), aplicar el
  // signo del indicador SIN pasar antes por abs() dobla el signo: un gasto real sale negativo y,
  // por la convención del cliente (positivo=gasto, negativo=ingreso), se apunta como ingreso. Es
  // el fallo que vivió el usuario nada más conectar un ASPSP nuevo: «todos los gastos del mes
  // contados como ingresos» (2026-07-31). abs() hace el mapeo depender SOLO del indicador,
  // exactamente igual para los bancos que sí cumplen la spec (su amt ya es positivo).
  const amt = Math.abs(Number(t?.transaction_amount?.amount || 0));
  const isCredit = t?.credit_debit_indicator === "CRDT";
  const remit = Array.isArray(t?.remittance_information)
    ? t.remittance_information.join(" ")
    : (t?.remittance_information || "");
  const counterparty = (isCredit ? t?.debtor?.name : t?.creditor?.name) || "";
  const merchant = counterparty || remit || "Movimiento";
  const mcc = String(t?.merchant_category_code || "").trim();
  const haystack = `${remit} ${t?.creditor?.name || ""} ${t?.debtor?.name || ""} ${t?.bank_transaction_code?.description || ""}`;
  // CONCEPTO (petición 2026-07-24): hasta ahora `remittance_information` solo se usaba de comodín
  // para el título y, si el banco mandaba el nombre del ordenante, se TIRABA. Es justo el mensaje
  // del bizum («cena del sábado», «alquiler julio»), que era lo que obligaba a abrir la app del
  // banco. Se manda aparte para pintarlo bajo el título, sin repetir lo que ya se ve.
  const note = [remit, t?.bank_transaction_code?.description || ""]
    .map((x: string) => String(x || "").replace(/\s+/g, " ").trim())
    .filter((x: string, i: number, all: string[]) => x && all.indexOf(x) === i)   // sin duplicados
    .join(" · ");
  return {
    ext_id: t?.entry_reference || null,            // id único del banco (dedup robusto en Capa 3)
    date: String(t?.booking_date || t?.value_date || "").slice(0, 10),
    amount: isCredit ? -amt : amt,
    merchant: String(merchant).trim().slice(0, 80),
    note: note.slice(0, 160),
    // El código bancario no identifica una tienda («transaction» contiene la marca Action).
    // Se conserva el concepto separado para clasificar sin usar esa descripción genérica.
    concept: String(remit).replace(/\s+/g, " ").trim().slice(0, 160),
    ...(/^\d{4}$/.test(mcc) ? { mcc } : {}),
    // best-effort: compra con tarjeta. Solo texto en español lo detectaba (TARJ/TARJETA); un
    // ASPSP que informa en inglés (Trade Republic, Revolut…) no lo mencionaba nunca y el cargo
    // se perdía en silencio (petición 2026-08-03). Con la cuenta de gasto diario esto ya no
    // decide si el cargo cuenta (ver `importObExpenses`), pero sigue usándose para los bancos
    // EXTRA de settings.expenseBanks, así que merece detectarse bien en cualquier idioma.
    card: /TARJ|TARJETA|COMPRA TARJ|\bCARD\b|\bPOS\b|\bDEBIT CARD\b|\bCARD PAYMENT\b|\bPURCHASE\b/i.test(haystack),
    status: t?.status || "",
  };
}

// SIN "Access-Control-Allow-Origin": lo pone `withCors` (./cors.ts) según la lista blanca de
// orígenes. Dejarlo aquí en "*" era regalar la llamada a cualquier web del mundo (2026-07-25).
export const CORS = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function jsonResp(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
