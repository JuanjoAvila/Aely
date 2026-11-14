import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { decryptSecret, encryptSecret } from "./crypto.ts";

Deno.test("crypto: round-trip con clave de prueba", async () => {
  const key = crypto.getRandomValues(new Uint8Array(32));
  let s = "";
  for (let i = 0; i < key.length; i++) s += String.fromCharCode(key[i]);
  Deno.env.set("TOKEN_ENCRYPTION_KEY", btoa(s));

  const plain = "refresh-token-demo-12345";
  const enc = await encryptSecret(plain);
  assertEquals(typeof enc, "string");
  assertEquals(enc!.startsWith("enc:v1:"), true);
  const dec = await decryptSecret(enc);
  assertEquals(dec, plain);
});

Deno.test("crypto: plaintext legacy sin prefijo", async () => {
  Deno.env.delete("TOKEN_ENCRYPTION_KEY");
  const legacy = "access-plaintext-legacy";
  assertEquals(await decryptSecret(legacy), legacy);
});

// P2-04: sin clave, por defecto se guarda en claro como antes, pero queda UNA línea ENC_MISSING
// en el log y sin el secreto; con TOKEN_ENCRYPTION_REQUIRED=1 no se guarda nada en claro.
Deno.test("crypto: sin clave avisa una vez, sin el secreto, y sigue guardando", async () => {
  Deno.env.delete("TOKEN_ENCRYPTION_KEY");
  Deno.env.delete("TOKEN_ENCRYPTION_REQUIRED");
  const logs: string[] = [];
  const original = console.error;
  console.error = (...a: unknown[]) => { logs.push(a.map(String).join(" ")); };
  try {
    assertEquals(await encryptSecret("secreto-sintetico-1"), "secreto-sintetico-1");
    assertEquals(await encryptSecret("secreto-sintetico-2"), "secreto-sintetico-2");
  } finally { console.error = original; }
  assertEquals(logs.length, 1);
  assertEquals(logs[0].startsWith("ENC_MISSING"), true);
  assertEquals(logs.some((l) => l.includes("secreto-sintetico")), false);
});

Deno.test("crypto: modo estricto sin clave no guarda en claro", async () => {
  Deno.env.delete("TOKEN_ENCRYPTION_KEY");
  Deno.env.set("TOKEN_ENCRYPTION_REQUIRED", "1");
  try {
    let error: unknown = null;
    try { await encryptSecret("secreto-sintetico"); } catch (e) { error = e; }
    assertEquals(String((error as Error)?.message || "").startsWith("ENC_MISSING"), true);
    assertEquals(String((error as Error)?.message || "").includes("secreto-sintetico"), false);
    // Leer lo viejo en claro sigue valiendo: es lo que deja recifrarlo.
    assertEquals(await decryptSecret("legacy-plano"), "legacy-plano");
    // Vacío y ya cifrado no necesitan clave.
    assertEquals(await encryptSecret(""), "");
    assertEquals(await encryptSecret("enc:v1:AAAA"), "enc:v1:AAAA");
  } finally { Deno.env.delete("TOKEN_ENCRYPTION_REQUIRED"); }
});

Deno.test("crypto: modo estricto con clave cifra normal", async () => {
  Deno.env.set("TOKEN_ENCRYPTION_KEY", btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))));
  Deno.env.set("TOKEN_ENCRYPTION_REQUIRED", "1");
  try {
    const enc = await encryptSecret("secreto-sintetico");
    assertEquals(enc!.startsWith("enc:v1:"), true);
    assertEquals(await decryptSecret(enc), "secreto-sintetico");
  } finally { Deno.env.delete("TOKEN_ENCRYPTION_REQUIRED"); Deno.env.delete("TOKEN_ENCRYPTION_KEY"); }
});
