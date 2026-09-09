<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (feedback-tanda-desde-main.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: feedback-tanda-desde-main
description: ⚠ 9/9 se enfadó de verdad — una tanda aprobada tiene que subir SOLA; nace en tanda/<id> desde main, nunca commiteando al tip de beta.
metadata:
  type: feedback
---

Su pauta, textual: **«implementación por tanda; si la apruebo, sube a producción sin romper el
resto»**. El 9/9 la rompimos y se enfadó como pocas veces: *«COMO MIERDAS ME LA HABÉIS LIADO»*.

**Qué hicimos mal:** commitear al tip de `beta` mezclando tandas. Resultado: sus **3 aprobadas
atadas a 18 sin probar**. Y peor, comprobado ejecutando: «límite por categoría» estaba construida
**encima de una que él había RECHAZADO** — llamaba a `inicioDeMesMs`, que llegó con la tanda de la
ventana de mes.

**El procedimiento, que la maquinaria YA soportaba y habíamos dejado de usar:**
1. `git switch -c tanda/<id> origin/main` — **desde `main`, no desde `beta`**
2. código, `npm run build` y suite **en esa rama**
3. merge a `beta` para que la pruebe — nunca al revés
4. al aprobarla: Actions → Promocionar → casilla `tandas: <id>`

`promote-beta.yml` acepta `tandas:` (fusiona `tanda/<id>`) y `commits:` (cherry-pick de emergencia).

**Si hay que rescatar tandas ya mezcladas:** NO cherry-pick de los SHA de beta. Lo probé y con
`-X theirs` compila **duplicado** (`doImport` declarado dos veces) y el workflow ni siquiera
reconstruye. Se porta **hunk a hunk** sobre una rama desde `main`, con la suite como puerta. Y ojo
con arrastrar helpers de tandas rechazadas: meterían **dos reglas de mes** en producción.

Ver [[feedback-todo-lo-mio-revisado-por-cursor]] y [[promote-merge-theirs]].
