import { assertEquals, assert } from "jsr:@std/assert@1";
import { BODY_LIMITS, readInput, type InputName } from "./request_body.ts";
import { INPUT_FIXTURES, INVALID_INPUTS, EXPECTED_BODY_LIMITS } from "./request_fixtures.ts";

export function registerInputTests(name: InputName) {
  const post = (raw: string, headers?: HeadersInit) => new Request("https://synthetic.invalid", { method: "POST", body: raw, headers });
  Deno.test(name + ": cuerpos del emisor conservados sin coerción", async () => {
    for (const body of INPUT_FIXTURES[name]) {
      assertEquals(await readInput(post(JSON.stringify(body)), name), { ok: true, body });
    }
  });
  Deno.test(name + ": JSON roto, primitivos y forma inválida dan 400", async () => {
    for (const body of [null, [], true, 42, "contenido privado sintético", ...INVALID_INPUTS[name]]) {
      const r = await readInput(post(JSON.stringify(body)), name);
      assertEquals(r, { ok: false, status: 400, error: "cuerpo inválido" });
    }
    assertEquals((await readInput(post("{\"privado\":"), name)).ok, name === "prices");
  });
  Deno.test(name + ": sobre el límite da 413 incluso sin cabecera o con cabecera falsa", async () => {
    for (const headers of [{}, { "content-length": "1" }] as HeadersInit[]) {
      const r = await readInput(post(" ".repeat(BODY_LIMITS[name] + 1), headers), name);
      assertEquals(r, { ok: false, status: 413, error: "cuerpo demasiado grande" });
    }
  });
  Deno.test(name + ": envolvente documentada y medida reproducible", () => {
    assertEquals(BODY_LIMITS[name], EXPECTED_BODY_LIMITS[name]);
    const bytes = Math.max(...INPUT_FIXTURES[name].map((b) => new TextEncoder().encode(JSON.stringify(b)).length));
    // Los límites previos de prices/help/ingest conservan su propio contrato; los nuevos dejan 10x.
    assert(bytes < BODY_LIMITS[name]);
    if (!["prices", "help-assistant", "ingest"].includes(name)) assert(bytes * 10 <= BODY_LIMITS[name]);
  });
}
