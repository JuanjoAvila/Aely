#!/usr/bin/env node
/**
 * NI DOS VERSIONES CON EL MISMO NÚMERO, NI LA MISMA TANDA DOS VECES EN LA RONDA VIVA.
 *
 * 2026-09-12: trabajando Cursor y yo a la vez, los dos sellamos una **4.19.89**. El fichero acabó
 * con DOS entradas con ese número: en Novedades la familia habría visto «v4.19.89» dos veces, y
 * en el panel `RELEASE_NOTES.filter(n => n.v === base)[0]` se queda con la PRIMERA, así que la
 * otra entrada existía sin verse. Ningún test lo cazaba.
 *
 * Y lo mismo con las tandas: `ola-nativa` estaba en la 4.19.87 y en la 4.19.91 (la .87 no llegó a
 * publicarse por un CI rojo). En su panel eso son dos tandas idénticas pidiéndole lo mismo, que es
 * justo lo que nos hizo quitar antes: «que no sean repetitivas… que realmente pueda probarlas».
 *
 * ⚠ Solo se mira la VENTANA VIVA (las 20 que enseña Novedades). Más atrás hay ids repetidos a
 * propósito de rondas ya cerradas (`widget-coherente` en 4.17.1 y 4.17.2, por ejemplo) y
 * reescribir el histórico no arregla nada.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const notas = JSON.parse(fs.readFileSync(path.join(root, "src/data/release-notes.json"), "utf8"));

function t(name, fn) {
  try { fn(); console.log("  ✓ " + name); }
  catch (e) { console.error("  ✗ " + name); throw e; }
}

console.log("notas-sin-duplicados");

t("ninguna versión aparece dos veces en todo el histórico", () => {
  const vistos = new Map();
  const repes = [];
  notas.forEach((n, i) => {
    if (!n || !n.v) return;
    if (vistos.has(n.v)) repes.push(`${n.v} (posiciones ${vistos.get(n.v)} y ${i})`);
    else vistos.set(n.v, i);
  });
  assert.deepEqual(repes, [],
    "dos entradas con el mismo número: Novedades la enseña dos veces y el panel solo ve la primera");
});

/* La ventana que enseña Novedades de entrada, y de donde sale la ronda del panel. */
const VENTANA = 20;

t("dentro de la ventana viva, ninguna tanda se repite pidiéndole lo mismo dos veces", () => {
  const vistos = new Map();
  const repes = [];
  notas.slice(0, VENTANA).forEach((n) => {
    ((n && n.tandas) || []).forEach((g) => {
      if (!g || !g.id) return;
      if (vistos.has(g.id)) repes.push(`${g.id} en ${vistos.get(g.id)} y en ${n.v}`);
      else vistos.set(g.id, n.v);
    });
  });
  assert.deepEqual(repes, [],
    "la misma tanda en dos versiones de la ronda = dos veces el mismo trabajo para él");
});

t("y toda tanda de la ventana viva tiene pasos que hacer", () => {
  const vacias = [];
  notas.slice(0, VENTANA).forEach((n) => {
    ((n && n.tandas) || []).forEach((g) => {
      const pasos = (g && g.items && g.items.es) || [];
      if (!pasos.length) vacias.push(`${n.v}/${g && g.id}`);
    });
  });
  assert.deepEqual(vacias, [], "una tanda sin pasos sale en el panel sin decirle qué hacer");
});

console.log("notas-sin-duplicados: OK");
