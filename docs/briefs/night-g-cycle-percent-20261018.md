# INC-290902: porcentaje positivo pequeño

Base `ff53b0e7243fe79f9164bbc1bcf2313fb2e28d13` (4.26.141). Contrato de presentación aprobado por Claude en `d259eba8dbe237f7d708582915d0a2b056855072`.

Al desactivar Mi ciclo, un caso sintético pasa de 99,99 € disponibles en el ciclo a 0,01 € en el mes. El importe conserva el céntimo; `Math.round` del porcentaje pinta 0%. No se demostró pérdida de dinero ni la causa del incidente original del móvil.

Solo cambia la etiqueta de Inicio: con resto redondeado a céntimos mayor que cero y porcentaje redondeado cero, muestra `<1 %` en español/catalán (espacio inseparable) y `<1%` en inglés. El arco, los importes, las funciones financieras y el servidor permanecen intactos. Cero y exceso conservan 0%.

## Evidencia y límites

La investigación de base produjo ocho controles Node correctos, siete controles DOM correctos y un ROJO semántico que fallaba exclusivamente en la etiqueta. Tres intentos fallidos de arnés se conservaron por separado; no son fallos de producto.

El spec `e2e/inicio-ciclo-porcentaje.spec.mjs` conserva los siete controles y verifica la etiqueta aprobada en los tres idiomas: diez casos sobre la fuente modificada. Los controles incluyen 1/49/50/51 céntimos, cero/exceso, recarga, navegación y cierre civil de mes en Madrid. Las comprobaciones monetarias no se debilitan. La evidencia de base y la de la candidata se mantienen separadas.

Resultado de la candidata: ocho casos PASS en la primera ejecución, seguida de dos PASS (en/ca) tras corregir una expectativa del arnés que suponía punto decimal en inglés. `eur` usa `es-ES` en esta fuente; se conserva `0,01 €` en todos los idiomas, con comprobación independiente de un céntimo. La primera ejecución terminó EXIT1 por esa expectativa; la segunda, EXIT0. Ningún caso completado se repitió. Un worker, cero reintentos y cero flaky. Build, sintaxis, claves i18n, mapa e inventario de tests: EXIT0. Tamaño: EXIT0, 1327/1328 KiB minificados, 369/370 KiB gzip, 3/3 recursos bloqueantes (valores mostrados redondeados). `beta-sources` no ejecutado en esta tarea; no se heredan resultados de otras ramas. La frescura de versión se comprueba después del commit y su resultado se adjunta a la entrega.

Candidata pendiente de revisión e integración. No se ejecutan la suite general, CPU6, Android físico, bancos, SQL, Edge, despliegue ni merge. El nuevo cobro que reinicia el ciclo se comprobó solo en Node durante la investigación. No se atribuye esa ejecución a la fuente modificada. VERSION, catálogo y caps quedan para el circuito de integración de Claude; no hay aceptación de beta servida ni ProductREADY. Notas de versión para integrar: es «El porcentaje distingue cuando aún queda un pequeño importe disponible.»; en «The percentage now distinguishes a small amount still available.»; ca «El percentatge distingeix quan encara queda un petit import disponible.»
