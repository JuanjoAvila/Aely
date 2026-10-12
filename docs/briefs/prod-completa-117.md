# Promoción completa117 · reconciliación en preparación

## Alcance y autoridad

Encargo `prod-completa-117-codex-20261012`, base beta `c5f62d6603d016150afd9d0e20547b608b323045` y producción `b2dfd2c01d7ec6a9a30b74ae71d473054932c42f` (111). Inventario previo publicado en el canal `codex/coordinacion`, commit `e5be9602e95181337268a448529d5028bebac344`; respuesta `94baf060cd624de68790c970e10fc627c15a1ca0` acepta inventario y autoriza las decisiones descritas aquí. No incorpora Recibos2, Inicio4.2 ni candidatos posteriores a la base.

Versión propuesta aceptada: **4.26.117**. Es la promoción de la beta117 aprobada sobre producción111. La fusión conserva main como primer padre, beta117 como segundo y ambos como ancestros: la línea de producción sube111→117 y no se presenta la documentación de reconciliación como un cambio sin versión posterior a la beta. Sin squash ni preferencia automática de lado; árbol reconciliado por contenido.

Estado: trabajo local, sin integración ni publicación. CI completa y revisión independiente pendientes. Un verde de beta no acredita esta cabeza. La versión y el estado final de la PR prevalecerán sobre este corte.

## Inventario de producto y decisiones

Veredictos originales leídos con `errores --kind=beta`, contrastados con el único actor administrador sin publicar su identidad:

| Unidad | Evento UTC | Tratamiento |
|---|---|---|
| splash-animado117 | approved12/10 08:19:53, APK54 | Runtime aprobado conservado |
| widget-ciclo-puente116 | approved12/10 08:32:23, APK54 | Identidad corregida116, no hereda la decisión115 |
| bancos-sin-hueco116 | approved11/10 23:24:16, APK54 | Producto/descriptor conservados; tarjeta ya retirada117 |
| inicio-solape-gastos114 | approved11/10 06:39:11, APK52 | CSS aprobado conservado |
| Bienes completo / gráfica113 | approved10/10 12:38:19/22, APK52 | Producto ya idéntico a main111 |
| widget-pago-app-cerrada115 | rejected11/10 18:19:06, APK53 | Rechazo y descriptor históricos conservados; no nueva entrega115 |
| gráfica-significado109 | rejected09/10 04:54:24, APK52 | Sólo se retira tarjeta, no se borra producto ni se declara aprobada |

La explicación109 ya no existe en `src/modules/03-tab-dash.js`: NetWorthNow (líneas8–22 en beta base) contiene el Sparkline aprobado113. Su nota familiar permanece; descriptor y guion completos siguen en `scripts/beta-archives.json`, pin `f4ffb9340adfd0a13b631271e8158d2c630613c0`, código `b90e6223cd45ef64e8689d4c772560c31c7db47939694211a892316030a283f0`. La retirada sólo vacía su `tandas`; no escribe registros de veredictos ni borra marcas locales. Los tests históricos siguen probando rechazo/guion/identidad, además del DOM nuevo sobre catálogo real.

Una nota familiar es/en/ca reúne112–117. Las notas con igual número en main y beta conservan los ítems de ambos canales;98 conserva ambas fechas (6 y7 de octubre) y111 conserva además ambos títulos y las dos fechas (9 y10 de octubre); no se borran las promociones selectivas. Se conserva el guion de splash/widget/solape hasta que los recibos acrediten entrega: web por sí sola no entrega el widget nativo. El DOM comprueba tres pendientes antes de entrega, una nativa tras entregar web y cero tras acreditar también APK, con decisiones intactas. Todo ese escenario es sintético, no entrega real.

## Los 30 commits de main preservados

| Commits | Contenido conservado o reconciliado |
|---|---|
| bedb5892 · e9336aee | Caché95 ya presente; historia y acta |
| e96e2aa5 · 0d64c1ab | Rendimiento sostenido y fixtures iguales; documentación inflight añadida |
| 6f035b09 · bc497736 | Auditor histórico VERSION y33 casos, incluidos refresh con main segundo padre y negativos de deuda/revert/resolución |
| 277793c2 | Tres specs de Apuntar idénticos |
| 537edc1c | Exportador atómico, guardián y memorias públicas |
| 85b8b540 | Tres metas en Inicio y prueba existentes |
| 06737170 | FAB98 y acta; conserva estabilización de fondo añadida por beta |
| 70c5d403 | Acta de reconciliación y backlog histórico |
| 53d194e3 | Acta de perfil anterior; no resucitar instrumentos eliminados en ambos árboles |
| a4d01281 | Hist-visor combina clases y opacidad en un único plazo de8s |
| 7741251a | Todos los badges, espía y aserciones de rescate cloud; añade esperas boot/toast de beta |
| 56c7e328 | Diagnóstico acotado Plan, documentación y acta |
| b1ad23f3 | Cinco unidades106, verificador y actas/identity/patch |
| 23532d17 · a8f258de | Spec lifecycle-inflight, CROSSCUTTING y documentación |
| a94f961d · 798226ce | CLI candidata no autoridad, con tests, más archivo109 de beta |
| 9d3b33ce · d4f708d8 · bdd75636 | categorize-handler, registro en runner/selección y acta |
| 43abdde7 · 7c64c96b · 8e6d1234 |107/108/110, stamp idempotente, registros/controles históricos explícitos |
| e101c9e4 · fc6693f8 · ca883db5 · b2dfd2c0 | Bienes/gráfica113 y Recientes reanclado; nota selectiva111 preservada |

Los scopes de main están íntegros en beta salvo ampliación del archivo de panel y cambio de ancla de `pullExpenses` a `pullExpenses(readProof)` de widget115. Se fija el registro completo de beta117; no se construyen expectativas copiando el registro bajo prueba. Los controles106 y107/108/110/113 se ejecutan en sus fuentes históricas respectivas; la promoción comprueba también runtime aprobado117 idéntico y conservación de notas de ambas ramas.

## Android y servidor

- Fuente preparada **4.26.117 / code55** por instrucción expresa del coordinador, superior a beta54. `public/apk.json` conserva el asset estable52 real: `v4.26.80/Aely-4.26.80.apk`,6512773bytes, SHA256 `4abfa5b19d8d46bc10239162c20f8a5aa74020d343607fff421ccf61d9ade4d3`. No se anuncia el asset beta como estable. Guardián apk.json=Gradle intacto; discrepancia temporal esperada hasta publicación de APK55.
- `widget-puente-ciclo` ejecutado: diagnóstico Long/getDouble, JSON puente→plugin→widget y secuencias en Java52/53/54 con servidor legacy/v2, exit0. El código Java del fixture52 es idéntico en sus cinco archivos al sourceSha del asset estable. La APK52 conserva su payload/limitaciones; OTA no le añade capacidad nativa54.
- `bank-sync` v33 ACTIVE, lectura12/10: cuatro archivos iguales a beta117 normalizando LF; no se sincroniza un banco para comprobarlo.
- `ingest` v50 ACTIVE: índice SHA256 `744c67c8008da2075b857c129be605b9d8553dd1142911f22803a2f05281c2c8` en Git `8bda23a5d80e40a65111c58fd92d52e1b8215e73`, helpers cotejados individualmente con beta117. No está desplegado el campo opcional widget; sigue month. El test ejecuta ese handler con BD/SDK sintéticos: ACK, dedup, lectura fallida y lectura por el cliente actual.
- `prices` v13 ACTIVE: índice SHA256 `518eb75a246363d33d7333f36174c9c1efd374bffd906f3b9122bf69094480b1` y CORS `108cbae910f3347e3f1020fe0fddedcec7b9a4b15e31613d9f962323bc19bce1`, iguales a Git `45800cdbc9c16df51342f4331bff8a042e4171a1`. El test conecta `cloud.prices` real a ese handler, proveedores sintéticos, CORS APK, precio ausente y error. SEC02 fuente viaja sin despliegue ni anuncio; no se activan cuotas.
- `tests/prod117-edge-compat.test.mjs`: ambos contratos desplegados PASS, exit0. No son llamadas reales al servicio ni pruebas con dinero. Está registrado en runner y selección servidor.

## Pruebas y pasos posteriores

Beta117 original: run38222778497 SUCCESS en c5f62d66; jobs beta114722823269 y tests114722823351 success. Es evidencia de la base, no CI de esta reconciliación.

Locales: build y sintaxis, contratos auth106+seleccionesmain, catálogo de integración, tanda vacía/archivo109, CLI, categorize17grupos, mapas, frescura histórica33/33, compatibilidad Edge y widget pasaron. La pasada de los demás guardianes Node terminó: producto verde, beta-sources completo repitió en verde (2118 mutaciones de lógica y830 de datos) tras convertir seis interpolaciones CLI a concatenación equivalente, sin cambiar sus mensajes ni relajar el parser. Después pasaron de nuevo integración del catálogo (incluidas fechas/títulos), notas sin duplicados, registro de pruebas y sintaxis. El espejo de memoria local aborta por una cifra residual en su entrada externa, sin escrituras; limitación separada aceptada por el coordinador en0e377982, pendiente de CI limpia. No se modifica memoria ni se debilita el filtro. Resultados exactos finales en la PR y result canónico. DOM nuevo está registrado pero todavía no ejecutado aquí; sin runner pesado local tomado.

Cuando el resto de Node esté verde y la rama empujada, el coordinador compilará y firmará desde esa cabeza exacta, publicará el asset estable55 real y añadirá a la rama el commit de apk.json. Entonces CI completa contra main sobre SHA definitivo, revisión independiente y sólo después el coordinador fusiona. Verificar Pages exacto, actualizar el puente antiguo y renumerar beta preservando decisiones. Este chat no compila/publica APK, no fusiona, no despliega funciones ni publica main/beta.
