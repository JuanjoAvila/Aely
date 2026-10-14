import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

/* La copia de seguridad diaria sube el estado COMPLETO (no pasa por slimForCloud). Desde el 14/10/2026
   el perfil solo guarda nombre y apodo: la copia tampoco puede llevar los datos tipo banco. Se ejecuta
   el método REAL `backupState` de 00-core con un cliente falso y se mira lo que enviaría. */
const c = loadPureLogicFromFile();
const core = fs.readFileSync(new URL("../src/modules/00-core.js", import.meta.url), "utf8");
const src = core.match(/async backupState\(uid, data\)\{([\s\S]*?)\n    \},/);
const VIEJO = { handle: "@sintetico", fullName: "Persona Sintética", nationality: "XX", address: "Calle Falsa 1",
  phone: "600 000 000", taxResidency: "XX", jobStatus: "x", salaryRange: "x", wealthSource: "x", investorPurpose: "x" };

test("backupState envía el perfil sin datos tipo banco", async () => {
  assert.ok(src, "no se encuentra backupState en 00-core");
  const enviados = [];
  const sb = { from: () => ({
    upsert: async (fila) => { enviados.push(fila); return { error: null }; },
    delete: () => ({ eq: () => ({ lt: async () => ({}) }) }),
  }) };
  const run = new Function("sb", "perfilSinDatosBanco", "return (async function(uid, data){" + src[1] + "\n})");
  const estado = { accounts: [], settings: { theme: "green", profile: VIEJO } };
  await run(sb, c.perfilSinDatosBanco)("u1", estado);
  assert.equal(enviados.length, 1);
  assert.equal(JSON.stringify(enviados[0].data.settings.profile), JSON.stringify({ handle: "@sintetico", fullName: "Persona Sintética" }));
  assert.equal(enviados[0].data.settings.theme, "green");
  assert.deepEqual(estado.settings.profile, VIEJO, "no muta el estado vivo");
});
