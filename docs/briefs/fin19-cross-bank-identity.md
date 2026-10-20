# FIN19 R3 · importación, presupuesto por banco y widget

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
