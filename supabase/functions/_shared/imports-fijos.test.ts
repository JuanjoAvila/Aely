import assert from "node:assert/strict";

/* IMPORTS REMOTOS CON VERSIÓN EXACTA (P2-03, auditoría del 14/11).
   Las funciones llevan la service role, la clave privada de Enable Banking y la de cifrado.
   Con `supabase-js@2` cada `functions deploy` resolvía la última 2.x que sirviera esm.sh en ese
   momento: una 2.x rota o un paquete comprometido entraba en producción sin que cambiara ni una
   línea del repo. Aquí falla cualquier import remoto (https:, npm:, jsr:) del código que se
   despliega que no lleve una versión x.y.z exacta. Los tests y fixtures no se despliegan y
   quedan fuera, igual que el import map sintético de ingest, que solo sustituye la URL. */
const RAIZ = new URL("../", import.meta.url);
const REMOTO = /(?:from\s*|import\s*\(\s*)["']((?:https?:|npm:|jsr:)[^"']+)["']/g;
const EXACTA = /@\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?(?:\/|$|\?)/;

function* ficheros(dir: URL, rel = ""): Generator<[string, URL]> {
  for (const e of Deno.readDirSync(dir)) {
    const url = new URL(e.name + (e.isDirectory ? "/" : ""), dir);
    if (e.isDirectory) yield* ficheros(url, rel + e.name + "/");
    else if (/\.(ts|js|mjs)$/.test(e.name) && !/(?:\.test|_test|\.fixture)\.ts$|_fixture\.ts$/.test(e.name)) yield [rel + e.name, url];
  }
}

export function importsSinFijar(src: string): string[] {
  const malos: string[] = [];
  for (const m of src.matchAll(REMOTO)) if (!EXACTA.test(m[1])) malos.push(m[1]);
  return malos;
}

Deno.test("el oráculo distingue versión exacta de rango", () => {
  assert.deepEqual(importsSinFijar('import { createClient } from "https://esm.sh/@supabase/supabase-js@2";'),
    ["https://esm.sh/@supabase/supabase-js@2"]);
  assert.deepEqual(importsSinFijar('import x from "npm:@supabase/supabase-js@^2.110.0";'), ["npm:@supabase/supabase-js@^2.110.0"]);
  assert.deepEqual(importsSinFijar('import x from "jsr:@std/assert";'), ["jsr:@std/assert"]);
  assert.deepEqual(importsSinFijar('const m = await import("https://esm.sh/lib@1.2");'), ["https://esm.sh/lib@1.2"]);
  assert.deepEqual(importsSinFijar('import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";'), []);
  assert.deepEqual(importsSinFijar('import x from "https://deno.land/std@0.224.0/assert/mod.ts";'), []);
  assert.deepEqual(importsSinFijar('import { a } from "../_shared/cors.ts";'), []);
});

Deno.test("todo import remoto del código desplegable lleva versión exacta", () => {
  const vistos: string[] = [];
  const malos: string[] = [];
  for (const [rel, url] of ficheros(RAIZ)) {
    vistos.push(rel);
    for (const ref of importsSinFijar(Deno.readTextFileSync(url))) malos.push(rel + " → " + ref);
  }
  // Si el recorrido no viera las funciones, el test pasaría en verde sin vigilar nada.
  assert.ok(vistos.includes("bank-callback/index.ts") && vistos.includes("_shared/crypto.ts"), "no se recorrió supabase/functions");
  assert.deepEqual(malos, [], "imports remotos sin versión exacta:\n" + malos.join("\n"));
});

Deno.test("todas las funciones usan la MISMA versión de supabase-js", () => {
  const versiones = new Set<string>();
  for (const [, url] of ficheros(RAIZ)) {
    for (const m of Deno.readTextFileSync(url).matchAll(/supabase-js@([^"'/?]+)/g)) versiones.add(m[1]);
  }
  assert.equal(versiones.size, 1, "versiones distintas de supabase-js: " + [...versiones].join(", "));
});
