#!/usr/bin/env node
/**
 * LA APP Y EL SERVIDOR TIENEN QUE PONER LA MISMA CATEGORÍA.
 *
 * `autoCategory()` (cliente) y `categorizar()` (`ingest_logic.ts`) son la MISMA regla escrita dos
 * veces, con ~700 palabras clave cada una. Si una compra entra por notificación la clasifica el
 * servidor; si la apunta él a mano, o la reclasifica la app, la clasifica el cliente. Cuando las
 * dos listas derivan, el mismo comercio acaba en dos cajones según por dónde entró — y él lo ve
 * como «la app se inventa las categorías».
 *
 * Es exactamente la familia del bug de los 965 €: dos implementaciones de una regla y un test que
 * solo mira una. Ya nos mordió el 2026-09-08 con el cajero.
 *
 * NO comprueba una lista fija de comercios, que envejece y no cubre lo que se añada mañana:
 * SACA todas las palabras clave del propio fichero del servidor y exige la misma respuesta a los
 * dos lados. Así, añadir una clave a un solo sitio pone el test en rojo solo.
 *
 * El espejo correcto es `categoryOfNewMerchant`, no `autoCategory`: el servidor solo clasifica
 * ALTAS NUEVAS, y el cliente detecta ahí cosas (la retirada de cajero) que a propósito NO detecta
 * en `autoCategory`, para no recategorizarle el histórico. Ver 4.19.10.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = fs.readFileSync(path.join(root, "supabase/functions/_shared/ingest_logic.ts"), "utf8");
const js = transformSync(src, { loader: "ts", format: "esm" }).code;
const { categorizar } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const cli = loadPureLogicFromFile();

let failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.error(`  ✗ ${name}\n      ${e.message}`); }
}

console.log("categorias-dual");

/** Todas las cadenas de palabra clave que cita el fichero del servidor. */
const CLAVES = [...new Set((src.match(/"[a-z0-9 áéíóúñ\-]{3,}"/g) || []).map((s) => s.slice(1, -1)))];

t("se han encontrado las palabras clave del servidor", () => {
  assert.ok(CLAVES.length > 200, `solo ${CLAVES.length} claves: ¿ha cambiado el formato del fichero?`);
});

t("★ ninguna palabra clave se clasifica distinto en la app y en el servidor", () => {
  const dif = [];
  for (const m of CLAVES) {
    const app = cli.categoryOfNewMerchant(m);
    const srv = categorizar(m);
    if (app !== srv) dif.push(`«${m}» → app=${app} · servidor=${srv}`);
  }
  assert.deepEqual(dif, [],
    "la regla está escrita dos veces y han derivado; añade la clave al lado que falta");
});

t("y tampoco los comercios de verdad que ya nos han dado guerra", () => {
  /* Casos reales del histórico del proyecto, por si el barrido de claves no los pilla:
     «Barcelona» no puede caer en bares por el substring «bar» (bug Kinepolis 2026-07-17), y
     «Douglas» a secas estaba solo en la lista del servidor (encontrado 2026-09-08). */
  const casos = ["Barcelona", "Bar Manolo", "Kinepolis", "DOUGLAS", "Douglas Perfumerias",
    "Mercadona", "ChatGPT", "RETIRADA CAJERO 4B", "Movimiento", ""];
  const dif = [];
  for (const m of casos) {
    const app = cli.categoryOfNewMerchant(m);
    const srv = categorizar(m);
    if (app !== srv) dif.push(`«${m}» → app=${app} · servidor=${srv}`);
  }
  assert.deepEqual(dif, []);
});

t("el histórico NO se toca: autoCategory sigue sin detectar el cajero", () => {
  /* Blindaje de 4.19.10: si esto se rompe, la migración que recategoriza lo que está en «otros»
     le convertiría sus retiradas viejas en traspaso —neutra— y le bajaría meses ya cerrados. */
  assert.equal(cli.autoCategory("RETIRADA CAJERO 4B"), "otros");
  assert.equal(cli.categoryOfNewMerchant("RETIRADA CAJERO 4B"), "traspaso");
});

console.log(failed ? `\n${failed} fallo(s)` : "\ncategorias-dual: OK");
process.exit(failed ? 1 : 0);
