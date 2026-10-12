# Promoción completa117 · reconciliación en preparación

## Alcance y autoridad

Encargo `prod-completa-117-codex-20261012`, base beta `c5f62d6603d016150afd9d0e20547b608b323045` y producción `b2dfd2c01d7ec6a9a30b74ae71d473054932c42f` (111). Inventario previo publicado en el canal `codex/coordinacion`, commit `e5be9602e95181337268a448529d5028bebac344`; respuesta `94baf060cd624de68790c970e10fc627c15a1ca0` acepta inventario y autoriza las decisiones descritas aquí. No incorpora Recibos2, Inicio4.2 ni candidatos posteriores a la base.

Versión propuesta aceptada: **4.26.117**. Es la promoción de la beta117 aprobada sobre producción111. El cierre de revisión conserva main como primer padre y la candidata revisada ca401360 como segundo: main, beta117 y ca401360 siguen siendo ancestros, con avance rápido desde la rama revisada: la línea de producción sube111→117 y no se presenta la documentación de reconciliación como un cambio sin versión posterior a la beta. Sin squash ni preferencia automática de lado; árbol reconciliado por contenido.

Estado de la preparación: rama de revisión, sin integración ni publicación. CI completa y revisión independiente pendientes. Un verde de beta no acredita esta cabeza. La versión y el estado final de la PR prevalecerán sobre este corte.

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

La explicación109 ya no existe en `src/modules/03-tab-dash.js`: NetWorthNow (líneas8–22 en beta base) contiene el Sparkline aprobado113. Su nota intermedia se conserva en el historial Git, fuera de Novedades; descriptor y guion completos siguen en `scripts/beta-archives.json`, pin `f4ffb9340adfd0a13b631271e8158d2c630613c0`, código `b90e6223cd45ef64e8689d4c772560c31c7db47939694211a892316030a283f0`. La consolidación canónica conserva una nota117 más las226 notas de main, todas con `tandas:[]`; no escribe registros de veredictos ni borra marcas locales. Los tests históricos siguen probando rechazo/guion/identidad, además del DOM nuevo sobre catálogo real.

Una nota familiar es/en/ca reúne sólo lo nuevo que recibe producción: entrada, movimientos bancarios pendientes, widget al pagar con la app cerrada después de actualizar la app e Inicio sin desglose de Gastos superpuesto. Se aplica el mecanismo canónico documentado en `docs/memoria/promote-4-19-106-como-se-hizo.md`:117 más historial de main con `tandas:[]`. Las227 notas visibles conservan las fechas, títulos e ítems de producción;111 y98 tienen una sola fecha y título.109 y112 no aparecen, ni al desplegar todo el historial. Los guiones intermedios siguen fijados por Git y los descriptores/archivo no cambian. El DOM prueba primero entrega web→nativa con los guiones históricos publicados y después el catálogo real, panel vacío, historial canónico y decisiones intactas. Todo ese escenario es sintético, no entrega real.

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

Los scopes de main están íntegros en beta salvo ampliación del archivo de panel y cambio de ancla de `pullExpenses` a `pullExpenses(readProof)` de widget115. Se fija el registro completo de beta117; no se construyen expectativas copiando el registro bajo prueba. Los controles106 y el registro107/108/110/113 se conservan en fuentes históricas; las cinco identidades nav-indicator, backclose-handover, meta-regla, broker-resultados y fab-contorno se asertan contra el árbol vivo. Sólo metas-editar-regla conserva la identidad selectiva histórica porque beta cambió legítimamente sus dependencias; la promoción comprueba también runtime aprobado117 idéntico y nota única e historial de producción íntegro.

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

## Revisión independiente de ca401360 y corrección

GO CON RESERVAS del12/10, mensaje `prod-completa-117-revision-go-con-reservas-correcciones-20261012`: se corrigen catálogo, texto117, fechas/títulos, documentación de entrega y cinco identidades auth vivas. Runtime, Java, funciones, descriptores y archivo109 siguen idénticos a beta117. Los resultados anteriores corresponden al corte ca401360; se repiten los guardianes afectados antes de entregar la cabeza corregida.

El fixture auth `9881214ebe93864e2d7570f62094ec785be81163` NO es ancestro de esta rama (merge-base exit1). Está retenido por las ramas remotas `codex/auth-disposal-fit-relay21`, `codex/auth-disposal-relay21`, `codex/plan-animation-diag-relay21` y `codex/plan-animation-wip103-relay21`. No borrar esas referencias: la CI necesita ese objeto histórico.

## Contrato del manifiesto APK55

La nueva publicación usa versionCode55, versionName4.26.117 y el asset real Aely-4.26.117.apk del release v4.26.117. release-apk.mjs sólo escribe versión, URL y notas: después hay que añadir revisiones, sha256 y sourceSha. sha256 corresponde a los bytes del APK firmado subido (no al Java); sourceSha es la cabeza corregida congelada antes de compilar, no el commit posterior de apk.json.

Las revisiones nativas se recalculan con betaRevision(id,read,["native"],scope): las seis unidades del manifiesto52 más widget-ciclo-puente. El hash de esta última es 8a6f5aefbe66677ca3685ba430208766d5adc791e2fb50d1013a3d54d8397e50, confirmado contra el árbol vivo. Code55 sin ese campo no acredita su entrega. La rechazada115 no necesita una nueva entrada y su rechazo no cambia. Las revisiones no acreditan aprobación ni despliegue Edge. Los siete valores y el comando reproducible se entregan al coordinador por el canal canónico con la cabeza corregida.

Validación de la corrección: build, sintaxis, auth-disposal/fit (cinco identidades vivas), beta-sources integración, beta-tandas-vacias, beta-veredictos, listo-actor, release-notes-max, notas-sin-duplicados, novedades-idiomas con sus11 mutantes, novedades-vinnetas, pure-logic-notes, i18n-keys, logs-privacidad, reserva-dinero, season-detalle, relevant-tests, presupuesto-rendimiento y guard-privacy pasan. Los cinco fixtures que asumían tandas vivas conservan sus oráculos sobre catálogos fijos; no se elimina ni salta ninguna comprobación. El DOM ampliado queda registrado para CI; no se ejecuta Chromium local. El cierre es una fusión de producción111 con ca401360 y el árbol corregido, para conservar el SHA revisado sin forzar la rama y versionar la entrega conjunta111→117; no se cambia el guardián VERSION.

## Corte de CI de PR215 · 12/10

Claude publicó el APK estable55 desde `4eb0641036c1b6b1b4c51fe657fcdd9933da18f2`; `c1fed1ca34dc0ec487481c9bdb472e228931ffc5` añadió únicamente el manifiesto real. Asset633636646,6530659bytes, SHA256 `bc24468bc8eef7a973c3072a88760bf68dc3c1dbd9e1b7eb4b63f59e50979003`, siete revisiones nativas verificadas. Firma/aapt/sin depuración reportados por Claude; este chat verificó metadata y digest del asset. La discrepancia temporal con APK52 descrita arriba quedó resuelta; docs-frescura y sintaxis pasan sobre c1fed1ca.

Tests run38245537730, job114798339108, sobre c1fed1ca terminó failure en55m37s. Node y los siete ficheros Deno pasaron; E2E funcionales1002passed/6failed/1skipped y rendimiento13passed, sin flaky. El omitido es la captura visual preexistente de gastos-categorias-presupuesto. Privacidad del workflow quedó sin ejecutar. El espejo CI no tiene entrada local y sync-memoria pasa sus fixtures.

Los seis fallos son dos escenarios es/en/ca del propio banco de pruebas. Cola publicada comparaba el catálogo promovido con234notas de beta; ahora fija el catálogo publicado c5, conserva el oráculo literal independiente y lo inyecta sobre la UI viva. Promoción117 llegaba a227entradas, pero allTextContents del botón concatenaba versión y fecha; ahora lee el span de versión manteniendo el orden exacto, ausencias109/112 y decisiones. Sin cambios de runtime, Java, Edge, manifiesto, tiempos, reintentos ni aserciones eliminadas. La repetición y su resultado final constarán en la PR y el result canónico.
