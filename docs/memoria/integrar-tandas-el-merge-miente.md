<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (integrar-tandas-el-merge-miente.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: integrar-tandas-el-merge-miente
description: "⚠ Integrar tandas nacidas de `main` en momentos distintos: el 11/9 un merge se comió una llave de cierre, dejó DOS `var RELEASE_NOTES=` (gana el segundo) y dos notas de tandas aprobadas se quedaban fuera de Novedades. Comprobaciones obligatorias tras cada merge."
metadata: 
  node_type: memory
  type: project
  originSessionId: b6deade9-918e-4072-8b0e-1d259d1e48ca
  modified: 2026-09-11T00:59:42.070Z
---

Al montar la ronda de prod del 11/9 (6 tandas desde `main`), el merge rompió **tres** cosas y
ninguna avisó sola. Esto va además de [[promote-merge-theirs]] y [[promote-cada-cristo]].

**1. Se comió una llave de cierre.** `moveExpenseWithinDay` quedó sin `}` y el bundle no compilaba.
Lo cazó `check-syntax` («FAIL script #6: Unexpected end of input»), pero el mensaje no dice el
fichero: `for f in src/modules/*.js; do node --check "$f" || echo "✕ $f"; done`.

**2. Dejó DOS `var RELEASE_NOTES=` en el módulo**, porque las ramas de Cursor nacieron antes del
recorte a JSON. **En JS gana el segundo**: el histórico pegado (1.114 líneas) no lo leía nadie y solo
pesaba. Lo mismo con `rnItems` declarado dos veces. Un objeto literal con la clave repetida hace
igual: el tope `minificado` quedó duplicado y el de arriba dejó de aplicarse en silencio.

**3. La peor: dos notas de versión de tandas APROBADAS se quedaron fuera de Novedades.** Vivían en
el array muerto, no en `src/data/release-notes.json`. Habrían subido a producción sin que la familia
viera una línea de qué cambió. Ver [[feedback-release-notes-siempre]].

## Después de CADA merge de una tanda, antes de commitear

```sh
git diff --name-only --diff-filter=U          # resolver TODOS, no solo los que cita el mensaje
grep -rn "^<<<<<<<\|^>>>>>>>" --include=*.js --include=*.json --include=*.md .
grep -c "^var RELEASE_NOTES=" src/modules/10-app-components.js    # tiene que ser 1
for f in src/modules/*.js; do node --check "$f" || echo "✕ $f"; done
node -e "const a=require('./src/data/release-notes.json');console.log(a.slice(0,3).map(x=>x.v))"
```

El 11/9 commiteé marcas de conflicto dentro de `package.json` por resolver solo los ficheros que
citaba el mensaje del merge. **`git status` manda, no el mensaje.** Tuve que resetear y rehacerlo.

**Numeración:** hemos chocado tres veces (4.19.28, 4.19.34, 4.18.9/12). La regla ahora es
**numera el integrador al final**; las ramas llevan número provisional y nadie se pelea por él.

**Las notas de versión van a `src/data/release-notes.json`, NUNCA al módulo** (desde 4.18.12 en
prod). El array del index está vacío a propósito. Ver [[release-notes-recorte-falla-mudo]].
