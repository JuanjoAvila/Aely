<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (integrar-el-merge-mudo.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: integrar-el-merge-mudo
description: "⚠ 11/9: silencié el stderr de `git merge` y falló MUDO (la rama no existía). HEAD sin mover, cero conflictos, VERSION igual — todo con pinta de ir bien. Estuve a un paso de sellar e integrar una rama VACÍA y publicarla como si llevara los arreglos."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b6deade9-918e-4072-8b0e-1d259d1e48ca
  modified: 2026-09-11T11:09:19.370Z
---

Integrando tandas puse `git merge ... >/dev/null 2>&1` para que no ensuciara la salida. La rama que
mergeaba **no estaba empujada todavía**, así que el merge falló y no dijo nada. El resultado tenía
toda la pinta de haber ido bien:

- sin conflictos (no hubo merge)
- `VERSION` igual (no entró nada)
- HEAD donde estaba
- y **la suite entera en verde**, claro: el código era el de antes

Lo pillé de casualidad, al ir a comprobar que el contenido estuviera en el árbol. **Habría sellado
una versión, escrito en el CHANGELOG que llevaba los arreglos de Cursor, y publicado una beta
idéntica a la anterior.** Y él habría probado creyendo que probaba algo nuevo.

## Regla, en la rutina de integración

1. **El merge NO se silencia.** Nunca `2>/dev/null` en un `git merge`.
2. Después de cada merge: **¿ha avanzado HEAD?** Si no, es un hallazgo, no un «ya estaba».
3. Y **comprobar el contenido esperado en el árbol**, no solo que los tests pasen. Los tests pasan
   igual de bien sobre el código viejo.
4. Antes de integrar una rama ajena: `git ls-remote origin <rama>` — que exista de verdad, no que
   el compañero haya dicho que la deja.

Es la misma familia que [[feedback-no-dar-por-hecho]] («un grep vacío es un hallazgo») y que
[[integrar-tandas-el-merge-miente]]: **silenciar una salida es exactamente donde se esconden estas
cosas**. Aquel día el merge mentía haciendo cosas raras; este, callándose.
