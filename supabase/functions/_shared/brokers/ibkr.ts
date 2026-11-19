// ============================================================
// Interactive Brokers — Flex Web Service (plan de brókers por conexión, fase 2, 19/11/2026).
//
// Dos pasos, los de la documentación oficial: SendRequest (token + Query ID) devuelve un código de
// referencia y GetStatement con ese código devuelve el XML de la Flex Query. `v=3` siempre (sin
// él usa la 2) y User-Agent obligatorio. El token solo descarga informes: es de solo lectura por
// diseño, no hay permisos que comprobar.
//
// El XML NO se interpreta aquí: viaja tal cual al móvil y lo lee `ibkrParseFlexXml`, el mismo
// parser que ya cuadra cuentas múltiples, cortas, derivados y peniques con el fichero. Dos parsers
// del mismo formato acabarían diciendo cosas distintas.
// ============================================================

export const IBKR_BASE = "https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService";
// Un informe de una cuenta normal son decenas de KB; el tope evita que una respuesta rara se coma
// la memoria de la función o el móvil.
export const IBKR_MAX_XML = 2 * 1024 * 1024;

export type IbkrCode =
  | "flex_1012" | "flex_1015" | "flex_1013" | "flex_1014" | "flex_1018" | "flex_1019"
  | "flex_1025" | "flex_temp" | "flex_no_positions" | "flex_bad";

/* Códigos de error de Flex (doc «Error codes») → los nuestros. Los temporales se reintentan una
   vez; el resto se le cuenta al usuario con nombre. */
const TEMPORALES = new Set(["1001", "1004", "1009", "1021"]);
export function ibkrCode(errorCode: string | null): IbkrCode {
  const c = String(errorCode || "");
  if (c === "1012") return "flex_1012";
  if (c === "1015") return "flex_1015";
  if (c === "1013") return "flex_1013";
  if (c === "1014") return "flex_1014";
  if (c === "1018") return "flex_1018";
  if (c === "1019") return "flex_1019";
  if (c === "1025") return "flex_1025";
  if (TEMPORALES.has(c)) return "flex_temp";
  return "flex_bad";
}
/** El token ya no sirve: hay que generar otro en IBKR. */
export function ibkrTokenMuerto(code: string): boolean { return code === "flex_1012" || code === "flex_1015"; }

function tag(xml: string, name: string): string | null {
  const m = new RegExp("<" + name + ">([^<]*)</" + name + ">").exec(xml);
  return m ? m[1].trim() : null;
}

/** Respuesta de SendRequest/GetStatement que NO es el informe (éxito con código o fallo). */
export function ibkrStatus(xml: string): { status: string | null; ref: string | null; url: string | null; error: string | null } {
  return { status: tag(xml, "Status"), ref: tag(xml, "ReferenceCode"), url: tag(xml, "Url"), error: tag(xml, "ErrorCode") };
}

/* La URL de GetStatement la dice IBKR en la respuesta. Se usa solo si es suya y por HTTPS: si no,
   el token viajaría a donde dijera una respuesta manipulada. */
export function ibkrStatementUrl(url: string | null): string {
  try {
    if (url) {
      const u = new URL(url);
      if (u.protocol === "https:" && (u.hostname === "interactivebrokers.com" || u.hostname.endsWith(".interactivebrokers.com"))) return u.origin + u.pathname;
    }
  } catch (_) { /* la de siempre */ }
  return IBKR_BASE + "/GetStatement";
}

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;
type Sleep = (ms: number) => Promise<void>;
const HEADERS = { "User-Agent": "Aely/1 (Flex Web Service)" };

async function getText(fetchFn: FetchFn, url: string): Promise<{ ok: true; text: string } | { ok: false; code: IbkrCode }> {
  let res: Response;
  try { res = await fetchFn(url, { headers: HEADERS }); } catch (_) { return { ok: false, code: "flex_temp" }; }
  if (res.status >= 500 || res.status === 429) return { ok: false, code: "flex_temp" };
  let text = "";
  try { text = await res.text(); } catch (_) { return { ok: false, code: "flex_temp" }; }
  if (text.length > IBKR_MAX_XML) return { ok: false, code: "flex_bad" };
  return { ok: true, text };
}

/* Pide el informe y espera a que esté. 1019 = «generándose»: se reintenta con 2, 3, 5, 5, 5… s
   hasta ~30 s en total. Como mucho ~8 peticiones, lejos del límite de 10/min por token. */
export async function ibkrFetchStatement(fetchFn: FetchFn, token: string, queryId: string, sleep: Sleep, budgetMs = 30_000):
  Promise<{ ok: true; xml: string } | { ok: false; code: IbkrCode }> {
  const q = (t: string, x: string) => "?t=" + encodeURIComponent(t) + "&q=" + encodeURIComponent(x) + "&v=3";
  let send = await getText(fetchFn, IBKR_BASE + "/SendRequest" + q(token, queryId));
  if (!send.ok) return send;
  let st = ibkrStatus(send.text);
  if (st.status !== "Success" && ibkrCode(st.error) === "flex_temp") {
    await sleep(2000);
    send = await getText(fetchFn, IBKR_BASE + "/SendRequest" + q(token, queryId));
    if (!send.ok) return send;
    st = ibkrStatus(send.text);
  }
  if (st.status !== "Success" || !st.ref) return { ok: false, code: st.error ? ibkrCode(st.error) : "flex_bad" };
  const url = ibkrStatementUrl(st.url);
  const waits = [2000, 3000, 5000, 5000, 5000, 5000, 5000];
  let spent = 0;
  for (let i = 0; ; i++) {
    const got = await getText(fetchFn, url + q(token, st.ref));
    if (!got.ok) return got;
    if (got.text.indexOf("<FlexQueryResponse") >= 0) return { ok: true, xml: got.text };
    const g = ibkrStatus(got.text);
    const code = g.error ? ibkrCode(g.error) : "flex_bad";
    if (code !== "flex_1019" && code !== "flex_temp") return { ok: false, code };
    const w = waits[Math.min(i, waits.length - 1)];
    if (spent + w > budgetMs) return { ok: false, code: "flex_1019" };
    spent += w;
    await sleep(w);
  }
}

/* Lo mínimo para saber que la query sirve, sin interpretarla: que sea una Activity Flex y que
   lleve la sección Open Positions. Vacía vale (alguien sin posiciones también conecta); que no
   exista la sección no: así nunca sabríamos qué ya no tienes. */
export function ibkrCheckXml(xml: string): { ok: true; accounts: number; toDate: string | null } | { ok: false; code: IbkrCode } {
  if (xml.indexOf("<FlexQueryResponse") < 0) return { ok: false, code: "flex_bad" };
  if (!/<OpenPositions[\s/>]/.test(xml)) return { ok: false, code: "flex_no_positions" };
  const accts = new Set<string>();
  for (const m of xml.matchAll(/<FlexStatement\b[^>]*\baccountId="([^"]*)"/g)) accts.add(m[1]);
  const td = /<FlexStatement\b[^>]*\btoDate="([^"]*)"/.exec(xml);
  return { ok: true, accounts: accts.size, toDate: td ? td[1] : null };
}
