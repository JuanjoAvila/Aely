# Preferencia de representación contabilizada · Night D

Base exacta: `ff53b0e7243fe79f9164bbc1bcf2313fb2e28d13` (fuente 4.26.141).
GO de alcance: `e35652b8590598fa4f4d93515c0e13e6deb57c86`.
Estado: candidata para revisión; sin entrega Edge, publicación ni aceptación móvil.

Una pareja de filas OB idénticas podía conservar `#pdng` sólo por llegar primero.
Además, un pull pendiente posterior podía degradar la representación ya contabilizada.
La corrección sólo prefiere el estado sin `#pdng` cuando coinciden banco y referencia
no vacíos, día almacenado, ordinal, cuenta, céntimos, comercio, categoría y marcas
del origen. Cuenta ausente sólo coincide con ausente; no es un comodín de preferencia.
Los comodines de exclusión FIN10 permanecen intactos.

El cliente copia únicamente el estado contabilizado sobre la representación pendiente,
sin cambiar UUID, fecha, importe, orden ni decisiones locales. Los refrescos y las
protecciones de categoría/nota siguen en su ruta existente. Ambos llamadores suministran
las lápidas vigentes; la lectura de estado sólo incluye las locales del mismo titular.
No se añaden escrituras, borrados, nuevos emparejamientos ni se cambia `keepId`.

En el servidor, primero se aplican todas las exclusiones FIN10 y después se elige el
BOOK compatible. Los empates entre dos BOOK conservan el primero. No se ordena el
histórico ni se amplía el deduplicador general por banco/referencia.

Fuera de alcance: PDNG30/BOOK33, distinta cuenta/día/ordinal/referencia o marcas,
reutilización ambigua de referencias y FIN03 (colisión de contenido entre bancos).
FIN03 sigue reduciendo 640 a 320 céntimos en el cliente en su fixture conocido; el
servidor conserva 640. Los controles comparan esas fronteras contra la base, no las
presentan como correcciones. La fila sin `#pdng` representa el estado almacenado;
no acredita por sí sola una nueva consulta al proveedor bancario.

Verificación dirigida:

- Cinco causas RED previas cubiertas en ambos órdenes y ambas direcciones local/pull.
- Prueba nueva sobre 141 antes del cambio: EXIT1, tres grupos rojos y dos controles.
- Contratos nuevos, exclusiones FIN10, conservación del superviviente e idempotencia.
- Seis mutantes: identidad ausente y referencia sola en cada lado, sólo cliente y
  sólo servidor. Se exige fallo semántico; error de ancla o compilación no cuenta.
- Dos casos DOM nuevos, un worker, cero retries, puerto propio y hash del HTML servido:
  una compra de 3,20 €, estado contabilizado persistido y mismo UUID tras recargar.

Se conservan los fallos de arnés: categoría inexistente normalizada a Otros y ancla
de mutación afectada por CRLF. Sólo se repitieron los grupos afectados tras corregir
fixtures/anclas; no se alteraron los oráculos financieros anteriores.

Los gates generales y su resultado exacto se registran en la entrega. No se ejecutan
suite completa, CPU6, Gradle/APK, SQL vivo ni bancos. Un verde focal no acredita
integración, Edge desplegado, artefacto servido ni ProductREADY.
