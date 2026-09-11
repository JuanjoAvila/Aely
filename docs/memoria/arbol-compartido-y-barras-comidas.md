<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (arbol-compartido-y-barras-comidas.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: arbol-compartido-y-barras-comidas
description: Cursor y yo escribimos en el MISMO checkout; y el shell se come las barras invertidas al escribir ficheros con python/heredoc.
metadata: 
  node_type: memory
  type: reference
  originSessionId: 7de23512-86c3-4aeb-94be-8333e759471e
  modified: 2026-09-11T16:19:08.113Z
---

Dos trampas del entorno que costaron tiempo el 11/9/2026 y que no se ven venir.

## 1. El checkout es COMPARTIDO y los dos escribimos a la vez

`E:\Mi cartera` lo usamos Cursor y yo **a la vez y sin commitear**. Lo que pasó en una tarde:

- `git status` mezclaba su trabajo a medias y el mío. **`public/index.html` es generado**, así que
  mi `npm run build` horneó dentro su cambio sin terminar. Un commit mío habría publicado su
  trabajo a medio hacer con mi nombre.
- **Una edición mía desapareció**: guardé una copia, hice `git checkout -- .` y al restaurarla ya
  era la versión vieja — entre medias él tocó el árbol. Tuve que rehacerla.
- `npm test` petó con `UNKNOWN: open public/index.html`: los dos compilando a la vez.

**Cómo se trabaja entonces:** **reservar los ficheros por el buzón antes de tocarlos** («cojo
`06-sync-brokers.js` líneas X-Y»), y avisar antes de construir. Si la tanda es larga, worktree
propio. El checkout compartido vale para leer, no para que dos escriban.

Y si aun así chocáis: **su commit primero**, luego `git checkout -- .` + `merge --ff-only`, y lo
mío encima con número nuevo. Nunca «arreglar» la colisión publicando.

⚠ Y un efecto secundario feo: **un script de sellado que se aborta a la mitad deja el árbol
mintiendo**. El mío escribía VERSION y la nota ANTES de validar el README, petó en el `assert`, y
durante un rato hubo dos tandas bajo el mismo número. Cursor lo vio y estuvo a punto de
«restaurar» algo que ya estaba bien. **Validar TODO primero, escribir después.**

## 2. El shell se come las barras invertidas

Escribiendo ficheros con `python - <<'PY'` desde la herramienta Bash, **los `\` desaparecen**.
Pasó DOS veces la misma tarde:

- `re: /\bnvidia\b/i` quedó como `/nvidia/i` → las expresiones pasaron a **casar de más, sin un
  solo error**. En un emparejador de marcas eso es ponerle a una empresa la cara de otra.
- `"\n✕ "` quedó como un salto de línea real dentro de un literal → `SyntaxError`.

El segundo se ve enseguida; **el primero es silencioso y es el peligroso**.

**Cómo evitarlo:**
- Para ficheros nuevos o reescrituras grandes: **la herramienta Write**, no el shell.
- Si hay que ir por python: **no escribir barras invertidas**. Comparar por palabras en vez de con
  expresiones regulares (`split(/[^a-z0-9]+/)` y `indexOf`), y usar `console.log("")` en vez de
  `\n` dentro de un literal.
- Y **ejecutar siempre lo escrito**: el guardián de `logos-inversiones.mjs` cazó las dos veces.

Ver [[misma-regla-en-dos-sitios]] y [[feedback-nunca-editar-con-powershell]] (misma familia: la
herramienta que parece que escribe bien y no).
