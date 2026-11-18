import assert from "node:assert/strict";
import { callerIp } from "./ratelimit.ts";

// SEG-09: de qué cabecera sale la IP del cubo, y el diagnóstico que nunca escribe una IP.
// Solo direcciones de documentación (RFC 5737). El entorno es una tabla: sin permisos de env.
function con<T>(tabla: Record<string, string>, fn: () => T): T {
  const original = Deno.env.get;
  Deno.env.get = (k: string) => tabla[k];
  try { return fn(); } finally { Deno.env.get = original; }
}
const req = (h: Record<string, string>) => new Request("https://edge.invalid/", { headers: h });
const XFF = { "x-forwarded-for": "203.0.113.7, 198.51.100.20", "cf-connecting-ip": "198.51.100.20" };

Deno.test("por defecto, lo de siempre: el primer salto de x-forwarded-for", () => {
  assert.equal(con({}, () => callerIp(req(XFF))), "203.0.113.7");
  assert.equal(con({}, () => callerIp(req({ "cf-connecting-ip": "198.51.100.9" }))), "198.51.100.9");
  assert.equal(con({}, () => callerIp(req({}))), "sin-ip");
});

Deno.test("xff-last y cf eligen el salto que pone la infraestructura", () => {
  assert.equal(con({ RATE_LIMIT_IP_SOURCE: "xff-last" }, () => callerIp(req(XFF))), "198.51.100.20");
  assert.equal(con({ RATE_LIMIT_IP_SOURCE: "cf" }, () => callerIp(req(XFF))), "198.51.100.20");
  assert.equal(con({ RATE_LIMIT_IP_SOURCE: "cf" }, () => callerIp(req({ "x-forwarded-for": "203.0.113.7, 198.51.100.3" }))), "198.51.100.3");
  // Un valor desconocido no cambia nada: el interruptor solo se enciende a propósito.
  assert.equal(con({ RATE_LIMIT_IP_SOURCE: "loquesea" }, () => callerIp(req(XFF))), "203.0.113.7");
});

Deno.test("diagnóstico: solo con RATE_LIMIT_IP_DIAG=1, una vez, forma sin ninguna IP", () => {
  const original = console.error;
  const lineas: string[] = [];
  console.error = (...a: unknown[]) => { lineas.push(a.join(" ")); };
  try {
    con({}, () => callerIp(req(XFF)));
    assert.equal(lineas.length, 0, "apagado por defecto");
    con({ RATE_LIMIT_IP_DIAG: "1" }, () => { callerIp(req(XFF)); callerIp(req(XFF)); });
  } finally { console.error = original; }
  assert.equal(lineas.length, 1, "una vez por instancia");
  assert.ok(!/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(lineas[0]), "ninguna IP en el registro: " + lineas[0]);
  const forma = JSON.parse(lineas[0].replace(/^[^{]*/, ""));
  assert.deepEqual(forma, { saltos: 2, cf: true, xReal: false, primeroDePrueba: true, algunoDePrueba: true, cfIgualPrimero: false, cfIgualUltimo: true });
});
