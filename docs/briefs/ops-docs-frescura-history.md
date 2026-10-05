# Frescura de documentación: ancla histórica de VERSION · 5/10/2026

Unidad local `ops-0510-docs-freshness-history-20261005`, sobre la base exacta
`8bb0398f9d16a848b984c989a6515e87937c815c`. Solo tooling, pruebas y esta acta;
sin publicación ni integración en PR134. El incidente comunicado es CI `37338992164`
de PR134: su merge de documentación denunciaba 28 ficheros históricos de `src/`
posteriores al bump `094a`, ya incluidos en la promoción versionada de producción.
Esta unidad reproduce el mecanismo con Git sintético, sin atribuirle una CI nueva.

La revisión independiente rechazó la entrega inicial `930cc478` por rutas privadas
en el acta y por devolver exit0 cuando un VERSION antiguo malformado hacía
indeterminada la auditoría. Esta entrega corrige ambos hallazgos; sigue local y
pendiente de nueva revisión.

## Contrato

El guardián antiguo acepta la base8bb cuando HEAD es el merge que cambia VERSION
de 4.26.86 a 4.26.94. Después de un commit de documentación vuelve al bump lateral
del comienzo de la ronda, y acusa arreglos que el merge ya versionó. Además,
`VERSION !== VERSION del primer padre` aceptaba un downgrade en un merge.

La nueva ancla es un commit alcanzable por la cadena de primeros padres que sube
VERSION numéricamente respecto de su primer padre y supera los números anteriores
de esa cadena. No basta cambiar whitespace, bajar la versión o reutilizar un número
tras una bajada. Se verifica también que el ancla es ancestro de HEAD. La creación
de VERSION en la raíz de una historia completa es solo el límite inicial del repo:
no cubre código añadido después.

En una historia Git completa, VERSION ilegible/no numérica, falta de ancla o
ascendencia verificable y fallo al auditar el rango bloquean el gate con exit1 y
el diagnóstico «auditoría histórica de VERSION indeterminada». No se afirma que
el código esté versionado ni se inventa que haya deuda: no se pudo acreditarlo.
La limitación existente para historia ausente/superficial y la política beta
conservan su tratamiento separado.

Desde el ancla se auditan **todos los commits alcanzables posteriores**, incluidas
ramas que se abrieron antes del ancla y entraron después. `--full-history` conserva
esa deuda y `--diff-merges=first-parent` incluye código introducido por resoluciones.
La comparación de un merge contra su segundo padre antiguo denunciaría producto
ya cubierto por el ancla al fusionar una PR de documentación, por eso se usa su
primer padre. Un diff solo de PR, un diff solo del árbol final o un skip por
documentación ocultaría deuda; ninguno forma parte del contrato.

Las zonas publicables siguen siendo `src/`, `supabase/functions/`,
`android/app/src/`, `public/vendor/` y `public/sw.js`. Se conservan las comprobaciones
de paquete/lock, CHANGELOG, RELEASE_NOTES, README, ROADMAP, APK y mojibake. Se conserva
la política beta y la preferencia por la rama Git real sobre `GITHUB_REF_NAME`.

## Evidencia local

Se leyó el task+claim proporcionado y AGENTS/EMPIEZA-AQUI completos. Se hizo clone
solo local de la copia de revisión, checkout de base8bb y rama propia; no se copió
su índice ni WIP. Los repositorios de fixtures son temporales, usan datos inventados,
Git real y el proceso completo de docs-frescura, y se eliminan al terminar.

Los marcadores `<ruta temporal omitida>` redactan argumentos de ejecuciones
registradas: esos comandos no se ejecutaron literalmente con el marcador. Las
recetas de reproducción posteriores permiten elegir otra carpeta temporal.

| Comando registrado desde la copia aislada | Exit | Resultado |
|---|---:|---|
| `node tests/docs-frescura.test.mjs` antes de editar | 0 | Base8bb original: acepta el merge 4.26.86 → 4.26.94 |
| `node tests/docs-frescura-history.test.mjs --guard <ruta temporal omitida>` | 1 | Rojo contra original, 17/24 expectativas correctas |
| `node tests/docs-frescura-history.test.mjs` antes de la revisión | 0 | 24/24; entrega inicial posteriormente rechazada |
| `node tests/docs-frescura-history.test.mjs --guard ../docs-frescura-930cc.mjs` | 1 | Regresión contra 930cc: 28/29; auditoría indeterminada aceptada |
| `node tests/docs-frescura-history.test.mjs` tras corregir | 0 | 29/29 expectativas correctas |
| `node scripts/run-tests.mjs --plan <ruta temporal omitida>` antes de revisión | 0 | Guardianes registrados y ejecutados; 24 casos |
| `node scripts/run-tests.mjs --plan ../docs-history-focused-plan.json` tras corregir | 0 | Guardianes registrados y ejecutados; 29 casos |
| `node --check tests/docs-frescura.test.mjs && node --check tests/docs-frescura-history.test.mjs && node --check scripts/run-tests.mjs && git diff --check` | 0 | Sintaxis y diff correctos |

El rojo inicial se obtuvo **antes** de editar el guardián, con 16/22 casos correctos;
el rojo contra original añade dos regresiones sin cambiar sus expectativas anteriores. El
fixture docs-after-versioned-promote sale1 con el original y denuncia
`src/modules/app.js` después del bump de ronda; con el cambio sale0. El original
falla también docs-synthetic-merge-after-promote, equal-version-is-not-increase,
downgrade-merge-is-not-increase, minor-downgrade-is-not-increase,
reused-version-after-downgrade-is-not-new y shallow-history-is-explicit.

| Fixture sobre historia completa | Guard nuevo |
|---|---|
| Docs tras promote versionado / synthetic merge docs desde base antigua | PASS |
| Src posterior sin bump / docs sobre deuda publicable en base | FAIL |
| Src con incremento legítimo / 1.0.9 → 1.0.10 / bump y código atómicos | PASS |
| Incremento comparado numéricamente con ceros iniciales / tooling y docs | PASS |
| Ancestro VERSION malformado en historia completa | BLOQUEO indeterminado, exit1 |
| Merge del mismo número con src nuevo / deuda lateral anterior al ancla | FAIL |
| Código añadido en la resolución del merge / código después de la raíz inicial | FAIL |
| VERSION igual, downgrade, bajada menor o número reutilizado | FAIL |
| Cada zona publicable / cambio publicable luego revertido, también lateral | FAIL |
| Rama real beta con env main | Política beta conservada |
| Rama real main con env beta y deuda publicable | FAIL |
| Historia ausente o superficial | Limitación explícita; sin afirmación de frescura histórica |
| Desalineación de paquete, APK y mojibake | FAIL |

También se ejecutó la misma suite contra siete mutantes del guardián corregido, sin editar
las expectativas ni el producto. Para cada fila el comando fue
`node tests/docs-frescura-history.test.mjs --guard <ruta temporal omitida>`.
La ruta omitida corresponde a un archivo temporal con el mutante de cada fila.

| NOMBRE / mutación exacta | Exit | Expectativas correctas / fallo discriminante |
|---|---:|---|
| `not-equal`: sustituir `greater` por `(left, right) => left !== right` | 1 | 28/29; bajada menor |
| `reused-number`: quitar el filtro de números de ancestros | 1 | 28/29; reutilización tras downgrade |
| `head-delta-only`: rango del log `HEAD^1..HEAD` | 1 | 18/29; deuda de base, zonas y revert |
| `final-tree-only`: sustituir auditoría por `git diff --name-only anchor HEAD -- zonas` | 1 | 27/29; código revertido directo/lateral |
| `omit-merge-resolutions`: sustituir `--diff-merges=first-parent` por `--no-merges` | 1 | 28/29; código en resolución |
| `ignore-shallow`: limitar el skip de `rev-parse --is-shallow-repository` a resultado null | 1 | 28/29; historia superficial |
| `indeterminate-pass`: sustituir `bad` por `console.log` en el diagnóstico indeterminado | 1 | 28/29; ancestro malformado |

Para repetir el rojo desde cualquier checkout, guardar el original con
`git show 8bb0398f9d16a848b984c989a6515e87937c815c:tests/docs-frescura.test.mjs`
y pasar ese archivo a `--guard`. Para el rojo de la revisión, guardar
`git show 930cc4783891f79ea15703137b3b40c19c2a9d8d:tests/docs-frescura.test.mjs`
y pasarlo igualmente a `--guard`: la suite corregida debe salir1. Son recetas de
reproducción; no se afirma que sustituyan literalmente los comandos registrados.
El plan focal contiene `build:false`, `deno:false`,
`playwright:false`, `e2e:"none"` y `steps:["docs-frescura","docs-frescura-history"]`.
No se ejecutó npm test entero, instalación, build de producto, Chromium ni móvil.

## Límites y entrega

La copia local heredó `shallow=true`, frontera
`dd59064e1edb6bd0e14a0d9682a9b61f47dc212e`, con 1319 commits alcanzables desde base8bb.
El guard nuevo muestra esa limitación y no emite el check de frescura histórica;
su exit0 en esta copia **no acredita** la historia completa de base8bb. Los 29
fixtures sí tienen historia completa salvo los dos casos que prueban la limitación.
No se descargó historia ni se alteró la frontera para forzar un veredicto.

Falta revisión independiente del commit/tree local y CI exacta en checkout completo.
PR134 conserva su NO-GO hasta sus propios gates; este verde local no autoriza merge,
producción, beta, APK, Edge ni SQL. No hay excepciones por SHA o nombre de promote,
workflow modificado, allow-failure, VERSION modificada ni cambios en sus 20 archivos.
La entrega se limita a docs-frescura, el guardián de historia nuevo, su registro en
run-tests y esta acta. Commit/tree exactos se facilitan junto a la entrega local.
