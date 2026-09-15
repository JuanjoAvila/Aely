<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (feedback-todo-lo-mio-revisado-por-cursor.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: feedback-todo-lo-mio-revisado-por-cursor
description: "Desde el 8/9 NADA mío se publica sin que Cursor lo revise — y revisar significa EJECUTAR lo que yo no puedo, no leer el diff."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: cb603bff-19ee-4f94-bbfa-b137c585f4d1
  modified: 2026-09-15T19:30:29.156Z
---

⚠ 2026-09-08, tras publicarle yo solo un bug que le reapareció en la cara: *«todo absolutamente
todo que pase por Cursor, no quiero otro error de estos»*.

Yo llevaba semanas revisando a Cursor y a Codex, y **a mí no me revisaba nadie**. Publiqué la
4.19.6 con un cambio que le resucitó en el panel las cinco tandas que había aprobado esa mañana.

**Why:** dirigir el equipo no me exime de la revisión — me la hace MÁS necesaria, porque soy el
único que además integra y publica. Y el fallo no le llegó como un test rojo: le llegó como
trabajo repetido, que es lo que más le quema ([[feedback-leer-sus-veredictos-primero]]).

**How to apply:**
- Rama + mensaje a Cursor **antes** de tocar `beta`. Publico solo con su OK explícito.
- **Revisión = ejecución.** La primera vez que aplicamos la norma, Cursor leyó mi diff, verificó
  la lógica y dio el OK… y la CI se puso roja igual: dos e2e de Playwright que ninguno de los
  dos ejecutó (yo no lo tengo instalado en este checkout; él sí). Y como la CI de beta falla,
  **la beta NO se publica**: se quedó con el bug en el móvil pensando que ya estaba arreglado.
  Así que en toda review mía que toque comportamiento de la app, Cursor **corre los e2e** y me
  da el número real de pasados/fallados. Si nadie ejecuta, no es una review, es una lectura.
- Le digo quién revisó y qué ejecutó, no solo que «está revisado».
- **Alcance de lo que ejecuta el revisor (decisión suya, 15/9):** el AUTOR pasa la suite completa
  local + `TZ=UTC` tras el commit y la CI la repite sobre el mismo SHA; el REVISOR ejecuta los
  tests AFECTADOS + guardianes (en las dos TZ si tocan fechas), lee el diff y mira la CI. Si algo
  sale rojo o el código cambia tras la review → suite completa otra vez. Sigue siendo ejecutar,
  no leer: lo que se quitó es la segunda pareja completa idéntica del mismo SHA.

Relacionado: [[feedback-no-dar-por-hecho]], [[feedback-consenso-de-las-tres-ias]],
[[feedback-publicar-en-beta-sin-preguntar]] (publicar sin preguntarle sigue en pie: lo que cambia
es que antes pasa por Cursor).
