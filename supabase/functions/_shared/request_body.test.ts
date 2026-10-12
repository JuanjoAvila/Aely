import { assertEquals } from "jsr:@std/assert@1";
import { readBodyLimited } from "./request_body.ts";

const assert = { equal: assertEquals, deepEqual: assertEquals };

const request = (body?: BodyInit, headers?: HeadersInit) => new Request("https://synthetic.invalid", {
  method: "POST", body, headers,
});

Deno.test("cuerpo: acepta el límite exacto y ausencia de cuerpo", async () => {
  assert.deepEqual(await readBodyLimited(request("1234"), 4), { ok: true, text: "1234" });
  assert.deepEqual(await readBodyLimited(request(), 4), { ok: true, text: "" });
});

Deno.test("cuerpo: corta el tamaño anunciado antes de leer", async () => {
  let reads = 0;
  const stream = new ReadableStream<Uint8Array>({ pull() { reads++; } }, { highWaterMark: 0 });
  assert.equal((await readBodyLimited(request(stream, { "content-length": "5" }), 4)).ok, false);
  assert.equal(reads, 0);
});

Deno.test("cuerpo: bytes UTF-8 y no caracteres; la cabecera no sustituye el conteo", async () => {
  for (const headers of [{}, { "content-length": "1" }, { "content-length": "incorrecta" }] as HeadersInit[]) {
    const res = await readBodyLimited(request("€€", headers), 4);
    assert.deepEqual(res, { ok: false, status: 413, error: "cuerpo demasiado grande" });
  }
});

Deno.test("cuerpo: suma chunks y cancela al superar el máximo", async () => {
  let reads = 0, cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(c) { reads++; c.enqueue(new TextEncoder().encode("123")); },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  assert.equal((await readBodyLimited(request(stream), 4)).ok, false);
  assert.equal(reads, 2);
  assert.equal(cancelled, true);
});

Deno.test("cuerpo: conserva UTF-8 partido entre chunks", async () => {
  const bytes = new TextEncoder().encode("€"), stream = new ReadableStream<Uint8Array>({
    start(c) { c.enqueue(bytes.slice(0, 1)); c.enqueue(bytes.slice(1)); c.close(); },
  });
  assert.deepEqual(await readBodyLimited(request(stream), 3), { ok: true, text: "€" });
});

Deno.test("cuerpo: lectura fallida y UTF-8 inválido devuelven 400 sin contenido", async () => {
  for (const body of [new Uint8Array([0xff]), new Uint8Array([0xe2]), new ReadableStream({
    start(c) { c.error(new Error("contenido privado sintético")); },
  })]) {
    assert.deepEqual(await readBodyLimited(request(body), 4), { ok: false, status: 400, error: "cuerpo inválido" });
  }
});
