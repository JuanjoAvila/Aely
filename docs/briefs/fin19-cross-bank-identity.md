# FIN19 R4 · borrado renombrado y contador del pull

Candidata sobre R3 `16515fd171e5121424722a69ee60bd959f8f4d59`, misma PR288, 20/10/2026. El lector compartido usa `comercio`, igual que el escritor de la lápida de cuenta. Después de renombrar BAR SL a Mi bar, borrar A y fallar el DELETE simulado, la cadena real de renombrado, borrado, persistencia, importación, pull completo y widget conserva la otra compra: base158 320, R3 640, R4 320 céntimos. `ob_name` conserva BAR SL para el importador. Hay controles de ordinal, otra cuenta del mismo banco, otro banco, coincidencia del nombre final, fila manual, lápida legacy producida por el escritor, reintento y deshacer, con filas completas y presupuesto por banco.

El contador compara los campos de identidad de las dos listas. Si coinciden punto por punto, no hay entradas nuevas y evita construir las claves. Un cambio de UUID, fecha, importe, comercio, origen, banco, cuenta, ordinal o referencia obliga al cálculo normal. El merge sigue ejecutándose y refresca categoría y nota. No se conserva una caché entre estados. Los controles de R3 por banco (320/320), PR286 y las 3.000 filas/4.501.500 céntimos siguen pasando.

A/B CPU1, mismo proceso, 3.500 filas, cuatro calentamientos y 21 muestras intercaladas. Se mide el contador real y el callback completo `syncCloudExpenses`, con transporte simulado y oráculos independientes de dinero y filas fuera del tramo medido:

| Mediana ms | Base158 | R3 | R4 | R4/base |
|---|---:|---:|---:|---:|
| Contador, entradas nuevas | 6,6731 | 17,3363 | 0,5115 | 0,0767 |
| Pull completo, entradas nuevas | 135,2711 | 146,7100 | 132,8644 | 0,9822 |
| Contador, caché caliente | 5,0849 | 10,3967 | 0,1772 | 0,0348 |
| Pull completo, caché caliente | 88,8298 | 100,8892 | 88,3719 | 0,9948 |

Las cuatro comparaciones cumplen el objetivo local de no superar base158 en más del 10 %. La actividad externa del host no está controlada; los tiempos absolutos varían entre lotes. No es aceptación móvil/CPU6. La medición histórica de R3 abajo era un compuesto de contador/categorías/merge, no el callback completo; no se usa como prueba de este objetivo.

Se preservan los fallos intermedios del arnés: expectativa no contractual de `noteEdited`, undo de una lápida legacy fabricada, extracción antigua del contador y representación del retorno `null` del importador (significa sin cambios). Corregidos los fixtures y puntos de extracción, se mantienen los oráculos monetarios. El lote dirigido adicional inicial pasó 45/46; su único fallo fue la extracción, y el lote afectado pasa 16/16. Ese primer lote adicional omitió `--test-concurrency=1` y usó el valor predeterminado de Node; se declara la desviación y no se utiliza como evidencia de rendimiento. Las ejecuciones siguientes y todo el A/B usan concurrencia 1.

Límite financiero distinto conservado: si otra fila comparte también el nombre original BAR SL, el ACK de renombrado anterior a R4 crea una lápida legacy amplia. En la primera reproducción sobre R3, el total era 320 pero sobrevivía la fila equivocada. Ese caso se conserva como fallo conocido; R4 no modifica el escritor de renombrado ni acredita resolverlo. El caso causal 640→320 usa otra compra distinta; los controles de colisión cubren el nombre final Mi bar.

La entrega privada contiene todos los comandos/EXIT, matrices, muestras y hashes. Solo dos ficheros de producto cambian en R4. VERSION, notas, catálogo y topes siguen reservados a integración; tamaño y catálogo no se repiten. Sin nube/banco reales, SQL/Edge, suite completa, CI general verificada, navegador/CPU6, APK, despliegue, merge ni aceptación móvil. No ProductREADY.

## Historial R3 · importación, presupuesto por banco y widget

Candidata para la misma PR288, descendiente normal de R2 `5b0cf1eb83c5ce3c79a776223b0b11bd2ab68151`, 20/10/2026. Comparación con beta158 `a5bbecf6793931f4cfc8a3087951ad1ef66580f8`. La revisión independiente rechazó R2 por resurrección al importar sin referencia, asignación incorrecta del banco de avisos incompletos, lápidas ignoradas por el widget y coste del índice. No acredita integración, despliegue ni aceptación móvil.

El importador reconoce `expenseDeletionKey`, incluido el ordinal, en `cubierta`, `lapidaVieja` y los vínculos. Las ranuras de cuentas conocidas distintas se mantienen separadas; sin cuenta se conserva el contrato previo. Borrar un movimiento TR de 12 EUR con cuenta y sin `ext_id` deja cero después de ejecutar el callback real de sincronización, aplanado, importación y subida simulada. Se cubren repetición, persistencia partida, pull, deshacer, otra cuenta, lápida antigua y vínculo sin lápida.

Un aviso con banco y sin cuenta elige primero una candidata de su banco. TR + Sabadell A + TR T y Wallet Sabadell + Sabadell A + Caixa C conservan 320 céntimos por banco mediante el cálculo real de `expenseBanks`; el total global de 640 no bastaba para detectar el error. Se mantienen UUID y decisiones manuales, sin persistir cuentas inventadas. Sin banco se mantiene el fallback anterior.

El lector puro compartido `filasComoLaApp` reconoce las lápidas nuevas de cuenta, sin ocultar otra cuenta conocida. Cuando falla el DELETE simulado, la tabla conserva ambas filas pero el widget solo cuenta la superviviente: 320 céntimos. Deshacer expuso además una deduplicación servidor que perdía la segunda cuenta sin referencia; el lector ahora conserva identidades conocidas distintas y resuelve las incompletas con prioridad de banco, como el cliente. Se preservan las reglas de lápidas antiguas, filas manuales, cero, signo, referencias, PDNG/BOOK y absorciones. Solo cambia código compartido; no hay esquema, backfill, consultas ni despliegue.

| Caso, céntimos | Base158 | R2 | R3 |
|---|---:|---:|---:|
| TR borrado sin referencia, widget tras sync | 0 | 1200 | 0 |
| TR / Sabadell con aviso TR incompleto | 320 / 0 | 640 / 0 | 320 / 320 |
| DELETE fallido de A con C: widget | 0 | 640 | 320 |

La base también tiene un fallo previo al mezclar ranuras iguales de dos cuentas del mismo banco. Se conservan sus filas completas y el fallo causal; no se atribuye a R2. Los cuatro controles de R1 siguen protegidos: Wallet sin banco 320, aviso con dos cuentas 640, legacy 320 y borrar uno deja 320.

El ámbito se calcula de forma perezosa, memoriza banco/cuenta y claves dentro de una sola foto y se comparte entre contador, categorías y merge del pull. Los cambios de arrays, UUID o preferencia BOOK invalidan el contexto. No hay caché global entre estados. La salida temprana de categorías no crea índice. Se conservan las guardas UUID de PR286 y un oráculo de 3.000 filas, 4.501.500 céntimos y filas completas.

Medición CPU1 secuencial, 3.500 filas sin cambios, cuatro calentamientos y 21 muestras por caso, variantes intercaladas:

| Mediana ms | Base158 | R2 | R3 | R3/base |
|---|---:|---:|---:|---:|
| Merge, entradas nuevas | 31,50 | 86,78 | 41,25 | 1,31 |
| Categorías, entradas nuevas | 0,0623 | 19,39 | 0,0584 | 0,94 |
| Contador + categorías + merge, entradas nuevas | 33,47 | 137,49 | 44,81 | 1,34 |
| Merge, mismas entradas | 30,89 | 86,42 | 37,53 | 1,21 |
| Categorías, mismas entradas | 0,0235 | 18,53 | 0,0243 | 1,03 |
| Contador + categorías + merge, mismas entradas | 35,02 | 124,13 | 40,73 | 1,16 |

Persisten 16–34 % de coste adicional frente a base en merge/pull. Son medidas de Node en el host, sin aislar actividad externa, no una aceptación móvil ni un umbral universal. Se conservan muestras, hashes de fuentes/artefactos y oráculos fuera del tramo medido.

Los mutantes reintroducen resurrección por lápida o vínculo, emparejado del ordinal equivocado, presupuesto del banco incorrecto, widget que cuenta el borrado, pérdida de otra cuenta al deshacer e índice prematuro. Los dos mutantes históricos FIN11/15 se adaptan a la referencia con ámbito actual; mantienen el oráculo de 0 frente a 320 céntimos. No se cuentan errores de arnés como muertes financieras.

La entrega privada registra comandos y EXIT efectivos, incluidos fallos intermedios. Tamaño y catálogo quedan a cargo de integración y no se repiten aquí. Sin cambios en VERSION, notas, catálogo ni topes. Sin suite completa, CI general verificada, navegador/CPU6, banco/nube reales, SQL/Edge, APK, merge o aceptación móvil. No ProductREADY.
