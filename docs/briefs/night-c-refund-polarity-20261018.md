# Compra y devolución con la misma referencia

Base de implementación: beta 141, `ff53b0e7243fe79f9164bbc1bcf2313fb2e28d13`.
Contrato: `6c965ff8649568ededca6ae765c4e3cbd0f8dacf`.

Una compra de 12,34 euros y su devolución con la misma referencia bancaria
se reducían a una sola fila. La investigación reprodujo el fallo en mezcla
aditiva, nube en lote y secuencial, importación en lote y secuencial y el
filtro de filas del servidor, en ambos órdenes. La devolución parcial de
2,34 euros debe conservar dos filas y un neto de 1.000 céntimos.

La identidad por banco y referencia ahora incluye solamente la polaridad
(-1, 0, 1), sin añadir importe completo ni día. Se aplica también al histórico,
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

FIN11 (PR266) y FIN17 (PR267) tienen ramas independientes. Su registro de
confirmados deberá heredar la polaridad al integrarse; Claude coordina esa
composición. Esta candidata no modifica esas ramas ni acredita su integración.

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
- Sintaxis, privacidad, seguridad, registro y mapa de tests, `docs-frescura`,
  presupuesto cliente/servidor, mezcla de nube, ingresos, notas y renombrado:
  EXIT0. Las ejecuciones por bloques no equivalen a una suite general verde.

Los fallos iniciales del arnés se conservan en la evidencia privada: reloj no
declarado en la matriz y modo neto sembrado fuera de `settings` en el DOM.
Solo se repitieron los casos afectados o ampliados. Los fallos iniciales de
los cinco guardianes ajustados también se conservan.

## Límites de entrega

Candidata para revisión en PR borrador contra beta. El control de tamaño
falla en el HTML minificado (1.329 KB frente a 1.328 KB); gzip y recursos
bloqueantes pasan. No se elevan topes ni se cambia VERSION o catálogo.
`beta-sources` termina con EXIT1 tras una sola ejecución: falta vigilar la
dependencia `obPolarity` en Inicio v4.2 y en el guardián transitivo de cargos;
el cierre del descriptor de fichas del catálogo141 pasa de 125 a 127 lectores.
Estas tres comprobaciones quedan para la integración, sin reescribir sus
oráculos ni los descriptores del catálogo. Los ficheros públicos de entrega
y notas solo incorporan las huellas recalculadas por el build.
La validación focal no acredita CI general, integración, artefacto publicado,
despliegue Edge, aceptación móvil ni ProductREADY. No se ejecutan bancos,
SQL, escrituras de nube reales, suite completa, CPU6, Gradle o APK.
