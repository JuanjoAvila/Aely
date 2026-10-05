<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (revisar-docs-frescura-tras-commit.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: revisar-docs-frescura-tras-commit
description: "Al revisar un SHA de Codex, correr SIEMPRE docs-frescura en el SHA commiteado: el 28/9 cayó 4 veces (commit aparte sin bump) aunque él decía PASS."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 568e2360-a658-48ef-8b7b-0813ad1f1a86
  modified: 2026-09-28T19:19:28.553Z
---

28/9/2026, revisando para Codex: cuatro veces el mismo fallo. Codex añade un commit aparte (notas, un arreglo pequeño) encima del commit del bump y dice «docs-frescura PASS». En el SHA commiteado da EXIT 1: «ficheros cambiados después del último bump». En árbol sucio pasa; tras el commit, cae. La CI de main corre `npm test` entero, así que se le para el promote.

También el mismo día: afirmó «tamaño PASS» y en build limpio daba 100 % del tope; y dos veces el test nuevo «protegía» la regla, pero al quitarla seguía verde.

**Why:** un PASS dicho por el autor no es un PASS medido ([[feedback-no-dar-por-hecho]], [[test-verde-por-razon-equivocada]]).
**How to apply:** en cada review, en worktree propio detached ([[revisar-worktree-de-otro-agente]]): `build-app` → árbol limpio, `docs-frescura` + `presupuesto-rendimiento` en el SHA commiteado, y mutar a mano cada regla de dinero nueva para comprobar que su test cae.
