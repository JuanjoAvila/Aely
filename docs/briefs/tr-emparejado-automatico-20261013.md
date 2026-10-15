# Revisión NO-GO de PR228 · candidata sin publicar

Encargo actual: tr-emparejado-revision-nogo-codex-20261013. Base del encargo beta124 f5904735; ejecución rebasada sobre producción/beta126 33d39cb80764aaf22998f69ac8bbaeffeadf4013. La entrega anterior 2ff4c59e fue rechazada y su resultado se conserva como histórico, no como aceptación. La dependencia Recibos queda rebasada en a921008a. No se modifica VERSION, notas de publicación, catálogo ni topes.

## Corrección posterior a la CI general (14/10/2026)

La fuente 31b9b9687cfba57e5e889e894d818b6f8dd79f6f quedó preservada antes del rebase. Tests 38444777336 terminó rojo en el job general 115460205272: auth-disposal, auth-disposal-fit, beta-sources, docs-frescura, presupuesto-rendimiento y recibo-invariante. El job focal 115460205068 pasó 7 DOM y 2 CPU6; ese verde no validaba el fallo financiero.

Reproducción causal: el extracto amplio número 2 de recibo-invariante contaba 1481,40 frente a 2231,90 esperados. El apunte de ING sin id, con comercio real «INMOBILIARIA GARCIA SL», se emparejaba indebidamente con el aviso «Alquiler piso» por 750,50. Faltaba sinComercioReal en gemeloBancoAutomatico. Se recupera esa frontera sin tocar el oráculo: pasan sus 22 casos y los 775 extractos, incluido el contador que antes se interrumpía en 476. La regresión reducida falla primero (75050 frente a 150100 céntimos) y pasa después. La nueva prueba DOM sincroniza el comercio identificado y exige ambas filas visibles, sin #dup.

El rebase126 conserva intactos módulos 02/03, shell, VERSION, catálogo/notas, topes y el test recibo-invariante respecto de sus fuentes aplicables. Sólo los artefactos generados y cabeceras documentales requirieron resolución. La invariante de recibos entra también en el job focal; el nuevo A/B usa base126. CI remota del nuevo SHA pendiente al escribir este commit. No se actualizan expectativas de huellas para esconder los rojos de integración.

CPU6 histórico, fuente31b9 y CI38444777336: con 20.000 filas y 380 pares, categoría 86,5 → 1,9 ms y sync vacío 79,6 → 1,9 ms; con 5.708 pares, 3181,4 → 3,2 ms y 3022,4 → 1,3 ms, frente a la candidata NO-GO2ff4. La candidata conserva referencias; la antigua no con 5.708 pares. El navegador comprobó fuente y número real de pares; son medianas de tres muestras tras calentamiento, no aceptación móvil. La fuente126 corregida se mide otra vez.

## Qué cambia tras el NO-GO

- Un reparto global por banco e importe firmado prioriza el día exacto y después los adyacentes. Los caminos alternos evitan dejar un aviso libre mientras otro apunte cuenta de nuevo; dos o tres días conservan una pregunta. Un aviso solo puede ocupar una fila.
- Se reservan las lápidas antiguas sin vínculo y los acuerdos manuales antes de asignar altas. Un histórico sin marca de duplicado se conserva como una posible respuesta antigua «son distintos»: abrirlo no reduce el gastado. Solo un aviso recién llegado permite reconciliar un apunte previo sin pregunta.
- Las parejas automáticas quedan en las filas locales y viajan con la marca #dup existente. No saturan el registro acotado de decisiones. Se cachean índices por referencia y metadatos de fecha; los cambios de categoría, nota o tarjeta no vuelven a emparejar. Los cambios financieros recalculan los grupos de banco e importe afectados y su ventana de días.
- Una fila que baja sin #dup prevalece sobre el emparejado previo, aunque otra versión haya quitado los campos nuevos del estado. Separar y volver a unir conservan la decisión local; el segundo móvil adopta una unión humana más reciente. Un estado viejo por sí solo no vuelve a descontar una fila que en expenses figura sin #dup.
- Editar fecha, importe o banco separa la pareja; la edición visible de fecha lo anuncia. Importe y banco de los avisos automáticos ya estaban bloqueados en la interfaz. «Volver a unir» permite deshacer una separación compatible. Deshacer al borrar dice expresamente que se han borrado aviso y apunte bancario.

## Evidencia local actual

Siete regresiones nuevas fallaron en la fuente previa: tres importes incorrectos, migración de «son distintos», más de 500 parejas, aviso no elegible y retirada de #dup desde otra versión. Después del arreglo: 15/15 casos de revisión, 22/22 del contrato original adaptado al desfase permitido, 21/21 en UTC/Madrid/Canarias y 8/8 mutantes causales. Los mutantes solo se consideran muertos si provocan AssertionError; se ejecuta antes el mismo verificador sin mutar.

La migración ampliada ejecuta beta125 durante 90 días con 12 semillas, avisos de medianoche, respuestas antiguas sin vínculo y respuestas «son distintos». Los importes de cada mes son idénticos en beta/candidata al abrir, tras sync y tras segundo sync; cero preguntas pendientes en los tres puntos. Cada celda siguiente es beta = candidata, en euros sintéticos:

| Semilla | Julio | Agosto | Septiembre | Octubre |
|---|---:|---:|---:|---:|
| 0 | 345.78 | 671.74 | 662.26 | 274.84 |
| 1 | 345.68 | 672.06 | 652.26 | 284.18 |
| 2 | 346.32 | 681.84 | 641.05 | 285.64 |
| 3 | 356.48 | 661.70 | 651.72 | 284.88 |
| 4 | 346.12 | 672.28 | 661.25 | 274.69 |
| 5 | 346.02 | 672.23 | 651.18 | 284.84 |
| 6 | 356.89 | 681.71 | 641.01 | 275.34 |
| 7 | 356.83 | 671.76 | 651.38 | 274.54 |
| 8 | 346.40 | 671.22 | 661.60 | 275.22 |
| 9 | 345.93 | 671.54 | 651.46 | 285.44 |
| 10 | 346.20 | 681.46 | 641.96 | 285.42 |
| 11 | 366.17 | 662.15 | 651.66 | 275.00 |

El diagnóstico Node con 20.000 filas y 5.708 parejas no recalcula fechas al cambiar categoría y conserva referencias al repetir. No se confunde con CPU6. Los e2e de sincronización y pull reales, subida de #dup, separar/unir y borrado/Deshacer pasaron remotamente sobre31b9; la repetición sobre126 corregida y el nuevo caso de comercio real quedan pendientes al escribir este commit. El job opcional tr-pair-review del workflow Tests ejecuta Node, DOM y rendimiento por separado y falla si falla cualquiera, conservando artefactos incluso si otro bloque falla. La suite Tests general conserva sus guardianes de integración.

## Límites vigentes

No se ha ejecutado navegador, CPU6, suite completa, Gradle o APK local. No se han escrito datos reales ni desplegado backend. No acredita banco real, dos dispositivos físicos ni aceptación humana. El transporte heredado setExpenseDup sigue siendo best-effort, sin acuse de fila: un fallo de escritura no se declara entrega remota. La colisión heredada de dos avisos idénticos por fecha/importe/comercio sigue fuera del alcance. CI exacta y revisión independiente siguen pendientes.

## Histórico de la candidata rechazada (conservado, no describe el arreglo actual)


Candidata del 13/10/2026, sin publicación. Encargo tr-emparejado-automatico-codex-20261013, base histórica beta123 3625fa7e; ejecución rebasada sobre beta124 f5904735. Conserva la dependencia autorizada Recibos 24bfb4e5 (cuatro commits), rebasada en 07383d4a. Sus topes no se incorporan: siguen los de beta124.

## Regla y conservación

N apuntes sin id bancario y M avisos no manuales del mismo banco, día de Madrid e importe con signo emparejan min(N,M). Se conservan ambas filas internas para poder separar; el apunte se oculta solo en Gastos y queda excluido del gastado por la marca de duplicado que ya entiende el servidor. Los manuales conservan su pregunta. No se extiende la cuenta a bancos distintos, fechas distintas, recibos o cuotas. La decisión de separar se guarda con hora y banco en gemelos; las copias antiguas no la pisan, y un empate favorece separar.

La migración ocurre en loadState, en el updater de App y al sincronizar. Un aviso tardío puede emparejar el banco ya guardado. Borrar el aviso visible y Deshacer operan también el banco oculto; de lo contrario el borrado resucitaría como apunte nuevo. La separación se reconstruye tras el viaje por app_state y expenses. No se crean tablas ni funciones de servidor.

## Evidencia sintética

El generador ejecuta el importador del bundle beta123 3625fa7e durante 90 días: 450 filas almacenadas antes y después; visibles 450 → 270; preguntas 180 → 0. Total 282015 céntimos (2820,15 euros), variación de gastado cero en julio, agosto, septiembre y octubre. Una segunda vía calcula el total con presupuesto.ts real y las filas serializadas para servidor. Esto es un estado generado, no la cartera del dueño.

22 pruebas Node, incluidas 49 combinaciones N/M y una matriz que ejecuta los 21 casos en UTC, Madrid y Canarias. Nueve mutaciones sobre cuenta, manual, banco, fecha, importe, separación, hora y metadatos deben fallar. Pendiente/contabilizado, respuestas repetidas, dos bizums iguales, aviso tardío, cambios de hora de marzo/octubre, cuenta anterior y copia atrasada están cubiertos. El e2e abre Gastos/ficha/separar/recargar y el caso manual; aún no ejecutado al escribir esta acta.

## Límites para la revisión

- No acredita dos móviles reales, banco real ni recepción de escrituras por Supabase. setExpenseDup heredado no devuelve acuse de fila; la reparación tras pull es un intento que puede necesitar un pull posterior.
- La identidad heredada todavía puede fundir dos avisos con exactamente la misma fecha, importe y comercio en la nube. El ordinal protege los dos apuntes bancarios reales; esta candidata no cambia la identidad general de avisos.
- Solo se automatizan coincidencias exactas del grupo definido. Las preguntas históricas fuera de ese grupo no se resuelven por parecido.
- El registro sigue limitado a 500 vínculos; la separación con hora se prioriza sobre altas automáticas, sin prometer retención ilimitada.
- Chromium/Playwright y la suite completa local no se han ejecutado por la exclusión operativa vigente. CI final remota y aceptación móvil se registran aparte.
- VERSION, notas, catálogo, Retiro124 y topes quedan intactos. Las huellas afectadas y los rojos de catálogo/tamaño son de integración; no equivalen a una entrega publicable.

## Verificación local final y preparación de integración

Build, 22 casos propios (más los 21 de cada zona), nueve mutantes, 38 casos de ordinal, 13 de Recibos, 17 de pull, sintaxis, idiomas fuente/ensamblados, seguridad, mapa de tests y privacidad: EXIT 0. El guardián de catálogo ejecutado antes de conservar el límite del bloque de categorías terminó EXIT 1; la CI del SHA final será la evidencia terminal posterior a ese ajuste. docs-frescura: EXIT 1 por VERSION intacta. Presupuesto: EXIT 1 por ambos tamaños, con tres ficheros bloqueantes dentro del tope. Medida final oficial con sello 4.26.124.99999 y reserva de 95 bytes: 1395811 bytes crudos / 383356 gzip, frente a 1383424 / 379904 permitidos.

La comparación final contra beta124 detecta 31 huellas web modificadas, ninguna edge ni nativa. El lector directo conserva una ancla histórica ambigua de Inicio que también falla en beta124; no se ha cambiado su descriptor. Integración debe ampliar las dependencias de los consumidores del updater/pull y de Gastos: gemeloGrupo, gemeloBancoAutomatico, gemeloAvisoAutomatico, reconcileGemelosAutomaticos, gemeloAutomaticoDe, separarGemeloAutomatico, gemelosCambiosNube; pushGemelos/fusionarGemelos y el método cloud.setExpenseDup. La dependencia Recibos añade a su vez lapidasAlEditar, lapidasUnion, recibosBorradosUnion y GASTO_ORIGENES. Catálogo124/Retiro124 deben valorar las huellas nuevas sin heredar veredictos; no se retiran pruebas para obtener verde. lastPaydayOf y budgetPeriodOf están cotejadas y son idénticas a beta124.

Una reserva concurrente del mismo banco para otro aviso podía ganar a una separación humana por el orden de ids: reproducción inicial EXIT 1. La prioridad se resuelve primero por hora y separación, antes del orden estable; la regresión pasa en ambos órdenes y en los tres husos, y quitar esa prioridad muere como noveno mutante. La CI inicial 38406077444 sobre f3ed68fc se canceló al descubrirlo; no acredita esta corrección.
