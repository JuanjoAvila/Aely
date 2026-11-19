// ============================================================
// Kraken — clave de SOLO LECTURA (plan de brókers por conexión, fase 3, 19/11/2026).
//
// Lo que hace: firmar las llamadas privadas, comprobar los permisos de la clave ANTES de guardarla
// (GetApiKeyInfo), leer los saldos (BalanceEx) y ponerles precio en euros con el Ticker público.
// Sin coste: Kraken no lo da en el saldo y calcularlo desde las operaciones es otra fase. «—»
// antes que un coste inventado.
//
// Todo lo que sale de aquí es puro o recibe su `fetch`: los tests corren sin red (tests Deno
// con respuestas sintéticas) y la firma se prueba contra el ejemplo de la documentación oficial.
// ============================================================

export const KRAKEN_BASE = "https://api.kraken.com";

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

/** API-Sign = base64(HMAC-SHA512(path + SHA256(nonce + postData), base64decode(secret))). */
export async function krakenSign(path: string, nonce: string, postData: string, secretB64: string): Promise<string> {
  const enc = new TextEncoder();
  const sha = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(nonce + postData)));
  const p = enc.encode(path);
  const msg = new Uint8Array(p.length + sha.length);
  msg.set(p); msg.set(sha, p.length);
  const key = await crypto.subtle.importKey("raw", b64ToBytes(secretB64), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  return bytesToB64(new Uint8Array(await crypto.subtle.sign("HMAC", key, msg)));
}

/* Lo que una clave NO puede tener para que la guardemos. Si se filtra la BD, con una clave de solo
   consulta se lee la cartera; con cualquiera de estas se mueve dinero. Se rechaza aunque además
   tenga «Consultar fondos». */
export const KRAKEN_PELIGROSOS = [
  "withdraw-funds", "modify-trades", "close-trades", "add-funds", "earn-funds",
  "add-withdraw-address", "update-withdraw-address",
];

export type KrakenCode =
  | "kraken_perm" | "kraken_no_funds" | "kraken_ip" | "kraken_otp" | "kraken_key"
  | "kraken_nonce" | "kraken_rate" | "kraken_temp" | "kraken_bad";

/** Veredicto sobre la respuesta de GetApiKeyInfo. Lo que no se puede verificar, no se acepta. */
export function krakenCheckKeyInfo(result: unknown): { ok: true; meta: Record<string, unknown> } | { ok: false; code: KrakenCode; perm?: string } {
  // deno-lint-ignore no-explicit-any
  const r = (result && typeof result === "object") ? result as any : null;
  if (!r || !Array.isArray(r.permissions)) return { ok: false, code: "kraken_bad" };
  const perms: string[] = r.permissions.map((p: unknown) => String(p));
  const malo = perms.find((p) => KRAKEN_PELIGROSOS.includes(p));
  if (malo) return { ok: false, code: "kraken_perm", perm: malo };
  if (!perms.includes("query-funds")) return { ok: false, code: "kraken_no_funds" };
  // La doc trae el esquema en snake_case y el ejemplo en camelCase: se aceptan los dos.
  const ips = r.ip_allowlist ?? r.ipAllowlist;
  if (Array.isArray(ips) && ips.length > 0) return { ok: false, code: "kraken_ip" };
  const until = Number(r.valid_until ?? r.validUntil ?? 0);
  // Solo lo que no es sensible: ni la clave, ni el IBAN interno, ni el nombre que le puso.
  return { ok: true, meta: { perms, expiresAt: until > 0 ? new Date(until * 1000).toISOString() : null } };
}

/** Errores de Kraken (`error: ["EAPI:Invalid nonce", …]`) → código cerrado. Nunca su texto. */
export function krakenErrorCode(errors: unknown): KrakenCode | null {
  if (!Array.isArray(errors) || errors.length === 0) return null;
  const e = errors.map((x) => String(x)).join(" ");
  if (/nonce/i.test(e)) return "kraken_nonce";
  if (/otp/i.test(e)) return "kraken_otp";
  if (/Invalid key|Invalid signature|Permission denied/i.test(e)) return "kraken_key";
  if (/Rate limit|Too many/i.test(e)) return "kraken_rate";
  if (/EService|Unavailable|Busy|Internal/i.test(e)) return "kraken_temp";
  return "kraken_bad";
}

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

/** Una llamada privada firmada. `nonce` lo da quien llama (la fila de la BD lo lleva creciente). */
export async function krakenPrivate(fetchFn: FetchFn, endpoint: string, key: string, secret: string, nonce: bigint | number | string):
  Promise<{ ok: true; result: unknown } | { ok: false; code: KrakenCode }> {
  const path = "/0/private/" + endpoint;
  const n = String(nonce);
  const body = "nonce=" + n;
  let sign: string;
  try { sign = await krakenSign(path, n, body, secret); } catch (_) { return { ok: false, code: "kraken_key" }; }
  let res: Response;
  try {
    res = await fetchFn(KRAKEN_BASE + path, {
      method: "POST",
      headers: { "API-Key": key, "API-Sign": sign, "Content-Type": "application/x-www-form-urlencoded; charset=utf-8", "User-Agent": "Aely/1" },
      body,
    });
  } catch (_) { return { ok: false, code: "kraken_temp" }; }
  if (res.status >= 500 || res.status === 429) return { ok: false, code: res.status === 429 ? "kraken_rate" : "kraken_temp" };
  // deno-lint-ignore no-explicit-any
  let j: any = null;
  try { j = await res.json(); } catch (_) { return { ok: false, code: "kraken_bad" }; }
  const code = krakenErrorCode(j?.error);
  if (code) return { ok: false, code };
  if (!j || j.result == null) return { ok: false, code: "kraken_bad" };
  return { ok: true, result: j.result };
}

/* NOMBRES DE KRAKEN. Los activos antiguos llevan una letra de clase delante (XXBT, XETH, ZEUR) y
   los saldos de staking/earn un sufijo (.S, .M, .B, .F, .P). Todo es el MISMO activo: se suma al
   base y se dice en la vista previa. XBT es BTC y XDG es DOGE para cualquiera fuera de Kraken. */
const LEGADO = new Set(["XXBT", "XETH", "XLTC", "XXRP", "XXLM", "XXMR", "XZEC", "XETC", "XREP", "XMLN", "XXDG", "XXTZ",
  "ZEUR", "ZUSD", "ZGBP", "ZCAD", "ZJPY", "ZAUD", "ZCHF"]);
const ALIAS: Record<string, string> = { XBT: "BTC", XDG: "DOGE", ETH2: "ETH" };
export const KRAKEN_FIAT = new Set(["EUR", "USD", "GBP", "CAD", "JPY", "AUD", "CHF"]);

/** «XXBT»→«XBT», «DOT.S»→«DOT», «ETH2.S»→«ETH2». Es la clave con la que casan saldo y par. */
export function krakenBase(asset: string): string {
  let a = String(asset || "").toUpperCase();
  const dot = a.indexOf(".");
  if (dot > 0) a = a.slice(0, dot);
  if (LEGADO.has(a)) a = a.slice(1);
  return a;
}
/** Lo que ve el usuario: BTC, no XBT. */
export function krakenSym(base: string): string { return ALIAS[base] || base; }

export type KrakenHolding = { base: string; sym: string; qty: number; staked: boolean };

/** BalanceEx → cantidades por activo, con las variantes de staking sumadas al base. */
export function krakenHoldings(balance: unknown): { crypto: KrakenHolding[]; fiat: { cur: string; amt: number }[] } {
  const by: Record<string, KrakenHolding> = {};
  const fiat: Record<string, number> = {};
  // deno-lint-ignore no-explicit-any
  const b = (balance && typeof balance === "object") ? balance as Record<string, any> : {};
  for (const k of Object.keys(b)) {
    const v = b[k];
    const q = Number(v && typeof v === "object" ? v.balance : v);
    if (!Number.isFinite(q) || q <= 0) continue;
    // «EUR.HOLD» y compañía son dinero, no un activo distinto.
    const base = krakenBase(k);
    if (KRAKEN_FIAT.has(base)) { fiat[base] = (fiat[base] || 0) + q; continue; }
    const sym = krakenSym(base);
    const h = by[sym] || (by[sym] = { base: base === "ETH2" ? "ETH" : base, sym, qty: 0, staked: false });
    h.qty += q;
    if (k.indexOf(".") > 0 || base === "ETH2") h.staked = true;
  }
  return {
    crypto: Object.values(by).map((h) => ({ ...h, qty: +h.qty.toFixed(10) })),
    fiat: Object.keys(fiat).map((c) => ({ cur: c, amt: +fiat[c].toFixed(2) })),
  };
}

/** De la lista pública de pares, el par de cada activo contra EUR (o USD si no hay en EUR). */
export function krakenPairsFor(bases: string[], assetPairs: unknown): Record<string, { pair: string; cur: "EUR" | "USD" }> {
  // deno-lint-ignore no-explicit-any
  const all = (assetPairs && typeof assetPairs === "object") ? assetPairs as Record<string, any> : {};
  const out: Record<string, { pair: string; cur: "EUR" | "USD" }> = {};
  for (const quote of ["EUR", "USD"] as const) {
    for (const name of Object.keys(all)) {
      const p = all[name];
      // Los pares «.d» son de margen oscuro: mismo activo, libro aparte. Fuera.
      if (!p || name.endsWith(".d")) continue;
      const base = krakenBase(p.base), q = krakenBase(p.quote);
      if (q !== quote || !bases.includes(base) || out[base]) continue;
      out[base] = { pair: name, cur: quote };
    }
  }
  return out;
}

export type ApiPosition = {
  key: string; isin: null; sym: string; exch: null; name: string; shares: number; cur: string;
  valueHint: number; price: number; cost: null; costEur: null; costWhy: string; kind: "crypto";
  buys: 0; sells: 0;
};

/** Saldos + pares + ticker → posiciones como las de los parsers de fichero. Lo que no tiene
 *  precio NO entra (valdría 0 €, y eso es un número inventado): queda presente y se avisa. */
export function krakenPositions(h: { crypto: KrakenHolding[]; fiat: { cur: string; amt: number }[] },
  pairs: Record<string, { pair: string; cur: "EUR" | "USD" }>, ticker: unknown) {
  // deno-lint-ignore no-explicit-any
  const tk = (ticker && typeof ticker === "object") ? ticker as Record<string, any> : {};
  const positions: ApiPosition[] = [];
  const present: string[] = [];
  const warnings: { k: string; name?: string; n?: number }[] = [];
  for (const c of h.crypto) {
    const pr = pairs[c.base];
    const last = pr && tk[pr.pair] && Array.isArray(tk[pr.pair].c) ? Number(tk[pr.pair].c[0]) : NaN;
    if (!pr || !Number.isFinite(last) || last <= 0) { present.push(c.sym); warnings.push({ k: "noprice", name: c.sym }); continue; }
    if (c.staked) warnings.push({ k: "staked", name: c.sym });
    positions.push({
      key: c.sym, isin: null, sym: c.sym, exch: null, name: c.sym, shares: c.qty, cur: pr.cur,
      valueHint: +(c.qty * last).toFixed(2), price: last, cost: null, costEur: null, costWhy: "api_nocost",
      kind: "crypto", buys: 0, sells: 0,
    });
  }
  return { positions, present, warnings, cash: h.fiat };
}

/** Lectura pública (pares y ticker): sin firma ni nonce. */
export async function krakenPublic(fetchFn: FetchFn, endpoint: string, query = ""): Promise<{ ok: true; result: unknown } | { ok: false; code: KrakenCode }> {
  let res: Response;
  try { res = await fetchFn(KRAKEN_BASE + "/0/public/" + endpoint + (query ? "?" + query : ""), { headers: { "User-Agent": "Aely/1" } }); }
  catch (_) { return { ok: false, code: "kraken_temp" }; }
  if (res.status >= 500 || res.status === 429) return { ok: false, code: "kraken_temp" };
  // deno-lint-ignore no-explicit-any
  let j: any = null;
  try { j = await res.json(); } catch (_) { return { ok: false, code: "kraken_bad" }; }
  const code = krakenErrorCode(j?.error);
  if (code) return { ok: false, code };
  return { ok: true, result: j?.result ?? {} };
}

/** Un sync entero: saldos firmados + precios públicos. `nextNonce` lo avanza la BD. */
export async function krakenSnapshot(fetchFn: FetchFn, key: string, secret: string, nextNonce: () => Promise<bigint | number | string>) {
  const bal = await krakenPrivate(fetchFn, "BalanceEx", key, secret, await nextNonce());
  if (!bal.ok) return bal;
  const h = krakenHoldings(bal.result);
  const bases = [...new Set(h.crypto.map((c) => c.base))];
  let positions: ApiPosition[] = [], present: string[] = [], warnings: { k: string; name?: string; n?: number }[] = [];
  if (bases.length) {
    const ap = await krakenPublic(fetchFn, "AssetPairs");
    if (!ap.ok) return ap;
    const pairs = krakenPairsFor(bases, ap.result);
    const names = [...new Set(Object.values(pairs).map((p) => p.pair))];
    let tick: unknown = {};
    if (names.length) {
      const tr = await krakenPublic(fetchFn, "Ticker", "pair=" + names.map(encodeURIComponent).join(","));
      if (!tr.ok) return tr;
      tick = tr.result;
    }
    const out = krakenPositions(h, pairs, tick);
    positions = out.positions; present = out.present; warnings = out.warnings;
  }
  return { ok: true as const, positions, present, warnings, cash: h.fiat };
}
