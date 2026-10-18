# Compra y devolución con la misma referencia

Base de implementación: beta 141, `ff53b0e7243fe79f9164bbc1bcf2313fb2e28d13`.
Contrato: `6c965ff8649568ededca6ae765c4e3cbd0f8dacf`.

Una compra de 12,34 euros y su devolución con la misma referencia bancaria
se reducían a una sola fila. La investigación reprodujo el fallo en mezcla
aditiva, nube en lote y secuencial, importación en lote y secuencial y el
filtro de filas del servidor, en ambos órdenes. La devolución parcial de
2,34 euros debe conservar dos filas y un neto de 1.000 céntimos.

La identidad por banco y referencia distingue cargo y devolución por polaridad,
sin añadir importe completo ni día. Las filas bancarias de importe numérico
cero no generan identidad ni aparecen como movimientos. Los valores nulos,
cadenas y otras fuentes se conservan en local. Se aplica también al histórico,
a las respuestas bancarias parciales, a los alias de pendientes y al
enriquecimiento por referencia. La deduplicación del mismo signo conserva su
contrato. La preferencia PDNG/BOOK de Night D y las colisiones entre bancos
de FIN03 quedan fuera de este cambio.

Las absorciones nuevas usan `ob-absorbed3` con banco, referencia, ordinal,
cuenta, día almacenado y signo. Conservan los cercos de FIN10, incluido el
comodín cuando falta la cuenta. Las marcas `ob-absorbed` y `ob-absorbed2`
se siguen leyendo con su alcance anterior: pueden ocultar ambos signos.
No se reinterpreta ni se restaura ninguna fila borrada históricamente.
Los vínculos nuevos de borrado conservan `bankRefV: 2` y `bankRefSign` al
pasar por `pushGemelos`; los vínculos antiguos sin versión siguen sin signo.

FIN17 (PR267) ya incorpora FIN11 (PR266), según la revisión de Claude
`181d74fd`. Su registro de confirmados deberá conservar la polaridad al
integrarse; Claude coordina esa composición. Esta candidata no modifica
esas ramas ni acredita su integración.

## Verificación focal

- Matriz de 60 casos: seis caminos, dos órdenes y cinco variantes (completa,
  parcial, otro día, otra cuenta y otro ordinal); dos filas y céntimos exactos.
- 27 controles de referencia distinta, mismo signo, otro banco y filas antiguas.
- Respuestas truncadas, histórico existente, borrado por referencia y
  superviviente de absorción en cliente y servidor.
- Compatibilidad de marcas antiguas, cercos de marcas nuevas y metadatos.
- Doce mutantes rechazados por aserciones: índices sin signo, marcas nuevas
  sin signo y pérdida de versión del vínculo de borrado.
- 55 casos FIN10/FIN15: se mantienen importes, cercos y mutantes. Tres
  expectativas de formato FIN10 pasan de v2 a v3 y dos guardianes FIN15
  ajustan sus anclas a la nueva fuente; no se cambian oráculos monetarios.
- Cuatro casos DOM sobre el bundle local generado, verificado por SHA256:
  completa/parcial y ambos órdenes, con dos filas, neto 0/10 euros y recarga.
- Deno `check --no-remote` del módulo de presupuesto: EXIT0. No se ejecuta
  la suite Deno ni se accede al servicio remoto.
- Compras: 32 casos completados, incluidos siete mutantes del grupo de
  identidad; dos anclas de ese grupo se adaptan al índice con signo sin
  cambiar las aserciones. Su fallo anterior queda conservado.
- Sintaxis, privacidad, seguridad, registro y mapa de tests,
  presupuesto cliente/servidor, mezcla de nube, ingresos, notas y renombrado:
  EXIT0. Las ejecuciones por bloques no equivalen a una suite general verde.
- `docs-frescura`: EXIT0 antes del commit; EXIT1 tras registrar el producto,
  porque detecta tres archivos publicables posteriores al ancla de VERSION.
  Este guardián depende del historial Git, no solo de los bytes del checkout.

Los fallos iniciales del arnés se conservan en la evidencia privada: reloj no
declarado en la matriz y modo neto sembrado fuera de `settings` en el DOM.
Solo se repitieron los casos afectados o ampliados. Los fallos iniciales de
los cinco guardianes ajustados también se conservan.

## Límites de entrega

Candidata para revisión en PR borrador contra beta. El control de tamaño
falla en el HTML minificado (1.329 KB frente a 1.328 KB); gzip y recursos
bloqueantes pasan. No se elevan topes ni se cambia VERSION o catálogo.
`docs-frescura` queda bloqueado por el versionado pendiente de integración.
`beta-sources` termina con EXIT1 tras una sola ejecución: falta vigilar la
dependencia `obPolarity` en Inicio v4.2 y en el guardián transitivo de cargos;
el cierre del descriptor de fichas del catálogo141 pasa de 125 a 127 lectores.
Estas tres comprobaciones quedan para la integración, sin reescribir sus
oráculos ni los descriptores del catálogo. Los ficheros públicos de entrega
y notas solo incorporan las huellas recalculadas por el build.
La validación focal no acredita CI general, integración, artefacto publicado,
despliegue Edge, aceptación móvil ni ProductREADY. No se ejecutan bancos,
SQL, escrituras de nube reales, suite completa, CPU6, Gradle o APK.

## Primera ronda de remates de PR272 (histórico sobre 7c582a98)

Sucesor `night-c-pr272-independent-review-remates-codex-20261018`, sobre
`07b080d915b142e3216c97aa3807d38951603bf9`, autorizado por `ce0bdf91`.
Cliente y servidor construyen una sola clave de absorción por fila y derivan
de ella las versiones antiguas y sus comodines. El filtro descarta ceros
antes de reservar una identidad; la fusión elimina también ceros locales y
señala `changed` para que el llamador guarde esa limpieza. No se escribe
ninguna lápida para una preautorización a cero.

Medición propia Node 24.16, sintética, 20.000 filas y 500 lápidas v2/v3,
cinco calentamientos y once muestras por lector. Se contrastan todos los
identificadores supervivientes: 19.500 filas, neto exacto cero céntimos.

| Lector | Mediana antes | Mediana después | Cambio |
| --- | ---: | ---: | ---: |
| `expenseIsTombstoned` | 102,929 ms | 72,563 ms | -29,5 % |
| `filasComoLaApp` | 126,217 ms | 70,714 ms | -44,0 % |

Son medidas locales propias, no las cifras del revisor ni una aceptación
CPU6/móvil. El script y las once muestras quedan en la evidencia privada
`night-c-remates-perf.mjs` y `night-c-remates-perf-{before,after}.json`.

- ROJO causal: EXIT1, 25 fallos de cero y 12 controles antiguos verdes.
- Verde de polaridad: EXIT0, 154 casos, incluidos los 12 mutantes existentes,
  25 casos nuevos de cero y 12 controles explícitos v1/v2 con ambos signos.
  Dos expectativas anteriores de clave con signo cero se sustituyen por el
  contrato autorizado de ausencia de identidad; los céntimos no cambian.
- FIN10/FIN15: 53 casos verdes inicialmente y dos fallos por anclas antiguas.
  Se adaptan tres sustituciones de mutantes a la nueva selección del índice,
  manteniendo sus aserciones monetarias; los dos casos afectados pasan con
  EXIT0. Los fallos iniciales se conservan. Total distinto: 55 casos verdes.
- Compras: 32 casos, EXIT0. Fusión de nube y paridad de presupuesto: EXIT0
  (cuatro casos de nube y el archivo de presupuesto con sus controles).
- Build, sintaxis y Deno `check --no-remote`: EXIT0 sobre este remate.

Tamaño, beta-sources y docs/VERSION siguen pendientes de reconciliación por
Claude; sus resultados anteriores se conservan y no se repiten aquí. No se
ejecutan DOM nuevo, CI general, CPU6, suite completa, Gradle/APK, SQL, bancos
ni despliegue. Ingest y cliente deben desplegarse coordinadamente por Claude
con el OK del dueño. Entrega bloqueada para integración; no ProductREADY.

## Segunda ronda: ciclo del cero y conservación de filas locales

Sucesor `night-c-pr272-zero-cycle-remates-codex-20261018`, base
`7c582a98025a3f97ec99f4f6c786a7de97289c09`, grant `080ffba9`.
La primera corrección quitaba la fila cero al bajar nube, pero la importación
bancaria volvía a crearla en cada sincronización. Ahora `prepara` retorna
`null` si `tx.amount === 0`, antes de crear la fila. Las guardas locales
solo descartan `ob`/`ob-hist` con importe estrictamente numérico cero.
No convierten `null` o `"0"` en una orden de borrar, ni retiran ceros manuales
o de avisos. Este remate modifica únicamente el cliente y su bundle; no
cambia el lector servidor ni el contrato de despliegue coordinado.

El test ejecuta los bloques reales del updater bancario, aviso, subida y
mezcla del pull, con transporte sintético. ROJO causal: tres vueltas con
subidas `[1,1,1]`, avisos `[1,1,1]` y tres reescrituras de una fila invisible.
VERDE: `[0,0,0]` para ambos efectos y ninguna reescritura del histórico.

- ROJO inicial: EXIT1, 18 fallos de comportamiento y 21 controles verdes.
- Nuevos y cero numérico afectado: 55 casos, EXIT0.
- Cuatro mutantes nuevos muertos por aserción: retirar descarte de importación,
  quitar cerco de fuente, volver a coerción numérica y borrar cero manual en
  el merge de nube. Control real de otras fuentes: EXIT0. Su primera expectativa
  exigía cero subidas también para un manual `null`; se corrigió porque el
  backfill previo de esa fila sigue activo. Se exige que toda subida sea de
  un identificador local previo, nunca de la preautorización. Fallo conservado.
- Signos, importación y mezcla, marcas v1/v2/v3, comodines y cinco mutantes
  anteriores afectados: 48 casos, EXIT0. Nube: cuatro casos, EXIT0.
- Total distinto de esta ronda: 112 casos verdes por bloques, incluyendo
  44 nuevos. No se afirma una ejecución de la suite completa.
- Ocho expectativas antiguas de descarte de la cadena `"0"` se sustituyen
  por controles de conservación según el nuevo grant. Sin cambios a céntimos.
- Build y sintaxis: EXIT0. No se repiten A/B, FIN10/FIN15 completo, Compras
  completo, DOM, beta-sources ni otros controles ajenos al remate.

Gates de integración, VERSION, catálogo y topes siguen a cargo de Claude.
FIN17 permanece en cola serial; no se modifica su rama. Sin CPU6, suite
general, CI completo, SQL, bancos, Edge, Gradle/APK, merge o despliegue.
Resultado bloqueado para integración y reserva liberada; no ProductREADY.
