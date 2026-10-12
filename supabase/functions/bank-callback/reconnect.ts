// Reconectar un banco conserva el cursor (decisión del 11/10/2026).
// `bank-connect` hace upsert sobre la misma fila de `bank_links`, así que reconectar no crea
// un enlace nuevo: es la misma fila con otra autorización. Hasta ahora `bank-callback` ponía
// `last_sync` a null y la lectura siguiente trataba el enlace como recién estrenado: lo que
// el banco apuntó entre la última sincronización y la reconexión, si caía antes de la
// ventana de siempre, no se pedía nunca.
//
// El cursor es del ENLACE, no de cada cuenta (no hay columna por cuenta). Por eso solo se
// conserva cuando vuelven EXACTAMENTE las mismas cuentas: con una de más heredaría un cursor
// que no es suyo y su histórico anterior quedaría sin leer; con una de menos no se pierde
// nada, pero no hay forma de saber aquí cuál es cuál sin identidad fiable, así que se trata
// igual. En cualquier otro caso el enlace arranca como nuevo, que es lo que pasaba siempre.
// Puro y sin Deno, para probarlo también desde Node.

export type LinkedAccount = {
  uid: string;
  iban: string | null;
  name: string | null;
  currency: string | null;
  /** `identification_hash` de Enable Banking: identifica la cuenta entre autorizaciones. */
  hash: string | null;
};

/* El `uid` NO sirve para comparar: Enable Banking lo emite por sesión y una autorización
   nueva trae otros para las mismas cuentas. Lo estable es el IBAN y, en los bancos que no lo
   dan, el hash de identificación. Un enlace guardado antes de existir `hash` solo tiene IBAN. */
type StableId = { iban: string; hash: string; currency: string };
function stableId(a: unknown): StableId | null {
  if (!a || typeof a !== "object") return null;
  const o = a as { iban?: unknown; hash?: unknown; currency?: unknown };
  const id = {
    iban: typeof o.iban === "string" ? o.iban.replace(/\s+/g, "").toUpperCase() : "",
    hash: typeof o.hash === "string" ? o.hash.trim() : "",
    currency: typeof o.currency === "string" ? o.currency.trim().toUpperCase() : "",
  };
  return id.iban || id.hash ? id : null;
}

/* El hash manda cuando lo traen los dos lados. Si no, el IBAN; y como hay bancos con varias
   cuentas de divisa bajo un mismo IBAN, una divisa conocida y distinta es otra cuenta. */
function sameAccount(p: StableId, n: StableId): boolean {
  if (p.hash && n.hash) return p.hash === n.hash;
  if (!p.iban || p.iban !== n.iban) return false;
  return !p.currency || !n.currency || p.currency === n.currency;
}

/** Cuentas que tenía el enlace antes de esta autorización. Los enlaces anteriores a la
    columna `accounts` solo guardan la primera, en `account_uid` e `iban`. */
export function previousAccounts(link: { accounts?: unknown; account_uid?: unknown; iban?: unknown } | null): unknown[] {
  if (!link) return [];
  if (Array.isArray(link.accounts) && link.accounts.length) return link.accounts;
  return link.account_uid ? [{ uid: link.account_uid, iban: link.iban ?? null }] : [];
}

/** Mismo conjunto de cuentas, una a una. Una cuenta sin identidad estable en cualquiera de
    los dos lados no se puede dar por la misma: ante la duda, no. */
export function sameAccounts(prev: unknown[], next: unknown[]): boolean {
  if (!prev.length || prev.length !== next.length) return false;
  const free: StableId[] = [];
  for (const p of prev) {
    const id = stableId(p);
    if (!id) return false;
    free.push(id);
  }
  for (const n of next) {
    const id = stableId(n);
    const i = id ? free.findIndex((p) => sameAccount(p, id)) : -1;
    if (i < 0) return false;
    free.splice(i, 1);
  }
  return true;
}

/** ¿Esta autorización continúa el enlace que había? Solo si ya se había leído alguna vez
    (hay cursor que conservar) y vuelven las mismas cuentas. */
export function keepsCursor(link: { last_sync?: unknown; accounts?: unknown; account_uid?: unknown; iban?: unknown } | null, next: unknown[]): boolean {
  return !!link && typeof link.last_sync === "string" && !!link.last_sync && sameAccounts(previousAccounts(link), next);
}
