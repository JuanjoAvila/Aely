#!/usr/bin/env node
/**
 * UNE `src/data/release-notes.json` ENTRE DOS RAMAS, SIN COMERSE NADA.
 *
 * ⚠ Nace de un fallo mío que se repitió DOS VECES el mismo día (11/9). Al integrar tandas, el
 * fichero de notas choca siempre, y un merge de texto lo deja inválido (es un array JSON). La
 * primera versión de este helper unía por clave `v`… y cuando dos ramas llevaban el MISMO número
 * —que pasa constantemente porque cada una se numera sola— se quedaba con la primera y tiraba la
 * otra EN SILENCIO. Consecuencia real: la nota de una tanda aprobada desapareció de Novedades y,
 * peor, su checklist desapareció del panel de revisión. La tanda subía y él no tenía qué probar.
 *
 * Ahora un choque de número es un ERROR, no una decisión callada. Quien integra decide: renumerar
 * o fundir las dos notas en una. Las dos cosas son válidas; hacerlo sin mirar, no.
 *
 * Uso: node scripts/unir-notas.mjs <ref-de-la-otra-rama>
 */
import { execSync } from "node:child_process";
import fs from "node:fs";

const ref = process.argv[2];
if (!ref) { console.error("uso: node scripts/unir-notas.mjs <ref>"); process.exit(2); }

const lee = (r) => JSON.parse(execSync(`git show ${r}:src/data/release-notes.json`, { encoding: "utf8", maxBuffer: 1e8 }));
const aqui = lee("HEAD");
const alla = lee(ref);

const porV = new Map();
for (const n of aqui) porV.set(n.v, n);

const choques = [];
for (const n of alla) {
  const ya = porV.get(n.v);
  if (!ya) { porV.set(n.v, n); continue; }
  // Mismo número Y mismo contenido: es la misma nota que viene por los dos lados. Sin problema.
  if (JSON.stringify(ya) === JSON.stringify(n)) continue;
  choques.push({ v: n.v, aqui: ya.t && ya.t.es, alla: n.t && n.t.es });
}

if (choques.length) {
  console.error("\n✕ DOS NOTAS DISTINTAS CON EL MISMO NÚMERO. No las uno por mi cuenta:\n");
  for (const c of choques) {
    console.error(`  ${c.v}`);
    console.error(`    aquí : ${c.aqui}`);
    console.error(`    allá : ${c.alla}`);
  }
  console.error("\n  Decide tú: renumerar una, o fundir las dos en una sola versión con todas sus");
  console.error("  tandas dentro. Si esto se resolviera solo, la nota perdedora desaparecería de");
  console.error("  Novedades y su checklist del panel de revisión — y él se quedaría sin saber qué");
  console.error("  probar de esa tanda. Pasó el 11/9, dos veces.\n");
  process.exit(1);
}

const cmp = (a, b) => {
  const A = a.split(".").map(Number), B = b.split(".").map(Number);
  for (let i = 0; i < Math.max(A.length, B.length); i++) { const x = A[i] || 0, y = B[i] || 0; if (x !== y) return y - x; }
  return 0;
};
const todas = [...porV.values()].sort((a, b) => cmp(a.v, b.v));
fs.writeFileSync("src/data/release-notes.json", JSON.stringify(todas, null, 1), "utf8");
console.log(`notas unidas: ${todas.length} · ${todas.slice(0, 4).map((x) => x.v).join(" · ")}`);
