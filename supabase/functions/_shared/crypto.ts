// ============================================================
// Cifrado simétrico de secretos en reposo (tokens bancarios / MyInvestor).
// AES-256-GCM con clave en TOKEN_ENCRYPTION_KEY (32 bytes, base64).
// Formato almacenado: enc:v1:<base64(iv(12) + ciphertext+tag)>
// Retrocompat: valores sin prefijo se tratan como plaintext (migración gradual).
// ============================================================

const PREFIX = "enc:v1:";

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

async function loadKey(): Promise<CryptoKey | null> {
  const keyB64 = Deno.env.get("TOKEN_ENCRYPTION_KEY");
  if (!keyB64) return null;
  const raw = b64ToBytes(keyB64);
  if (raw.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY debe ser 32 bytes en base64");
  const keyBytes = new Uint8Array(raw);
  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/* SIN CLAVE NO SE CIFRA, Y ESO TIENE QUE VERSE (P2-04, auditoría del 14/11).
   Hasta ahora, si faltaba TOKEN_ENCRYPTION_KEY, los tokens de MyInvestor y los `session_id` de
   Enable Banking se guardaban en claro sin que nada lo dijera. No se cierra a ciegas: no consta
   que el secreto exista en producción, y un `throw` aquí dejaría a la familia sin poder conectar
   bancos de un día para otro. Queda así:
   · Por defecto sigue guardando en claro, pero deja en el log de la función una línea
     `ENC_MISSING` (una vez por arranque de la instancia y sin ningún dato del secreto) para que
     se vea en Supabase → Edge Functions → Logs.
   · Con TOKEN_ENCRYPTION_REQUIRED=1 no guarda nada en claro: lanza, y el guardado falla como
     cualquier otro error de la función. Activarlo SOLO después de comprobar que la clave existe
     (pasos en docs/SETUP-SUPABASE.md). Leer valores viejos sin prefijo sigue valiendo en los dos
     modos: es lo que permite recifrarlos. */
let avisadoEnClaro = false;

export function cifradoObligatorio(): boolean {
  return Deno.env.get("TOKEN_ENCRYPTION_REQUIRED") === "1";
}

function sinClave(): void {
  if (cifradoObligatorio()) {
    throw new Error("ENC_MISSING: falta TOKEN_ENCRYPTION_KEY y TOKEN_ENCRYPTION_REQUIRED=1");
  }
  if (avisadoEnClaro) return;
  avisadoEnClaro = true;
  console.error("ENC_MISSING: falta TOKEN_ENCRYPTION_KEY; un secreto se guarda SIN cifrar");
}

export async function encryptSecret(plaintext: string | null | undefined): Promise<string | null> {
  if (plaintext == null || plaintext === "") return plaintext ?? null;
  if (plaintext.startsWith(PREFIX)) return plaintext;
  const key = await loadKey();
  if (!key) { sinClave(); return plaintext; }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const combined = new Uint8Array(iv.length + enc.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(enc), iv.length);
  return PREFIX + bytesToB64(combined);
}

export async function decryptSecret(stored: string | null | undefined): Promise<string | null> {
  if (stored == null || stored === "") return stored ?? null;
  if (!stored.startsWith(PREFIX)) return stored;
  const key = await loadKey();
  if (!key) throw new Error("TOKEN_ENCRYPTION_KEY requerida para descifrar secretos");
  const combined = b64ToBytes(stored.slice(PREFIX.length));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(dec);
}

/* ¿Se puede cifrar AHORA? Los brókers (0031) no guardan nada sin cifrar, con o sin
   TOKEN_ENCRYPTION_REQUIRED: preguntan esto antes de mandar la credencial a ningún sitio. Una
   clave mal formada cuenta como ausente (y no deja su valor en ningún mensaje). */
export async function claveCifradoLista(): Promise<boolean> {
  try { return (await loadKey()) !== null; } catch (_) { return false; }
}
