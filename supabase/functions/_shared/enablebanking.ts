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
  if (!res.ok) throw new Error(`EB ${res.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  return data;
}

// Una página vacía NO significa que no haya movimientos: el proveedor puede seguir buscando
// y devolver continuation_key. Mismo contrato para sync diario e histórico (15/9/2026).
// https://enablebanking.com/docs/faq/
export async function fetchBankTransactions(jwt: string, uid: string, dateFrom: string | null,
  api = ebApi, timeoutMs = 15000) {
  if (timeoutMs <= 0) throw new Error("transactions_timeout");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // deno-lint-ignore no-explicit-any
  const transactions: any[] = [];
  const visited = new Set<string>();
  let continuation: string | null = null, longest = false, pages = 0;
  try {
    while (pages < 12 && transactions.length < 2000) {
      const qs = new URLSearchParams();
      if (dateFrom) qs.set("date_from", dateFrom);
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
        return {transactions, truncated:true, transactionError:controller.signal.aborted ? "timeout" : "transactions_unavailable"};
      }
      pages++;
      const rows = page.transactions;
      const room = 2000 - transactions.length;
      transactions.push(...rows.slice(0, room));
      continuation = page.continuation_key || null;
      if (rows.length > room) return {transactions, truncated:true};
      if (!continuation) return {transactions, truncated:false};
      // Un cursor cíclico no autoriza a dar por completo el extracto ni a repetir doce páginas.
      if (visited.has(continuation)) return {transactions, truncated:true};
      visited.add(continuation);
    }
    return {transactions, truncated:true};
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
