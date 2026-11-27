#!/usr/bin/env node
/**
 * COMERCIO QUE ES SOLO UN NÚMERO (27/11/2026).
 *
 * Un pago con tarjeta de Trade Republic en un comercio cuyo nombre del datáfono son 7 cifras no
 * apareció en la app. Llegaron DOS notis: la de TR (título = el número, «Gastaste X € en <número>»,
 * con el verbo nuevo «Gastaste» en vez de «Has gastado») y la de Google Wallet (título = el número,
 * «X € con Trade Republic Visa Card ••NNNN»). Este guardián fija que la lógica del servidor NO las
 * tira por el nombre numérico ni por el verbo nuevo: si un día se rompe, se sabe aquí y no en el
 * móvil. Datos inventados (otro número, otro importe, otros cuatro dígitos).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const carga = async (rel) => {
  const js = transformSync(fs.readFileSync(path.join(root, rel), "utf8"), { loader: "ts", format: "esm" }).code;
  return import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
};
const L = await carga("supabase/functions/_shared/ingest_logic.ts");
const W = await carga("supabase/functions/_shared/wallet.ts");

const NUM = "4402917";
console.log("ingest-comercio-numerico");

{
  const texto = "Gastaste 23,45 € en " + NUM;
  assert.deepEqual(L.clasificarConMotivo(texto, NUM, "tr"), { tipo: "gasto", motivo: null });
  assert.equal(L.extraerImporte(texto), 23.45);
  assert.equal(L.extraerComercio(texto, NUM), NUM);
  assert.equal(L.categorizar(NUM), "otros");
  console.log("  ✓ TR «Gastaste … en <número>» entra como gasto con el número de comercio");
}
{
  const texto = "23,45 € con Trade Republic Visa Card ••3381";
  assert.deepEqual(L.clasificarConMotivo(texto, NUM, "wallet"), { tipo: "gasto", motivo: null });
  assert.deepEqual(W.parseWallet(NUM, texto, L.limpiarTexto), { comercio: NUM, importe: 23.45, divisa: "EUR" });
  console.log("  ✓ Wallet con título numérico entra como gasto");
}
