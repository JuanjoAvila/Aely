# PR271: remates de revisión independiente

Base de esta revisión: `ce373d0ab4bc0980dc82fee6f8b2422c09bcbdb7`.
Contrato original: [preferencia BOOK](night-d-book-preference.md).
La candidata sigue sin acreditar integración, despliegue Edge ni aceptación móvil.

Los errores de `fin15-pendiente-contabilizada` estaban en sus mutantes: el índice
de referencias se declaraba después del filtrado que el mutante instrumentaba y
el mutante sin banco cambiaba la forma de la tupla que consume la nueva preferencia.
Ahora el primero comparte el índice entre las dos fases y el segundo sustituye
el banco por una constante. Siguen exigiendo fallo de aserción financiera; una TDZ,
un TypeError, un ancla ausente o una compilación rota no cuentan como muerte.
El arnés de `ob-iguales-ordinal` extrae también `sameOwner` y `preferenceDeleted`,
e inyecta el helper real `expenseDeletedSet`. Sus oráculos de vínculos no cambian.
La suite completa descubrió el mismo efecto en `recibo-domiciliado-sin-acreditar`,
`recibos-bajas-y-union` y `tr-emparejado-automatico`: sus extracciones incluían el
merge antiguo o dejaban fuera la guarda de titular. Se incluyen las declaraciones
reales; las aserciones de recibos, vetos, dinero y separación de titulares no cambian.

`preferBookedExpenses` sale sin construir claves completas cuando no hay pendientes.
Si las hay, primero reúne banco/referencia; solo las BOOK candidatas calculan la
identidad completa. Esta selección barata no decide ninguna fusión: siguen siendo
obligatorios cuenta, día, céntimos, comercio, categoría, marcas y exclusiones FIN10.
Un control de 20.000 filas exige cero claves sin pendientes y dos para una pareja
entre 20.000 BOOK. Conserva referencias de objetos, UUID y céntimos.

Se documentan y prueban las fronteras de datos crudos sin ampliar la normalización:
`expenseFromRow` convierte categorías null/desconocidas a la categoría cliente y
fechas con desfase a UTC; el lector servidor compara categoría cruda y día escrito.
Una PDNG con categoría null/legacy frente a BOOK Otros, o con fecha
`2026-10-07T00:30:00+02:00` frente a BOOK del día UTC anterior, puede por ello quedar
PDNG en servidor si llegó primero y BOOK en cliente. Ambas direcciones conservan
una fila y exactamente 320 céntimos en los controles. Es una diferencia de estado
documentada, no evidencia nueva de contabilización bancaria ni de otro importe.

Las regresiones afectadas se ejecutan en UTC y Europe/Madrid. La medición A/B propia
usa Node, 20.000 filas sintéticas, dos calentamientos y nueve muestras alternadas;
se comparan resultados completos fuera del tramo medido. El primer arnés usaba
un campo de banco que el cliente no lee: sus tiempos quedan invalidados y conservados.
El arnés corregido exige banco real `ent`, clave válida y promoción de la pendiente
antes de medir. Los resultados corregidos van en la entrega; son medidas de este
host compartido, sin CPU6, no tiempos del revisor ni rendimiento móvil.
En el A/B corregido, sin pendientes: merge local 100,82 → 49,13 ms y merge nube
100,13 → 48,27 ms. Con una pareja pendiente entre 20.000 BOOK: 100,25 → 53,34 ms
y 101,67 → 52,85 ms, respectivamente. Se verificó identidad bancaria válida,
promoción de la pendiente y salida completa idéntica antes de medir.

Se ejecutaron los 180 pasos de la suite Node: 173 PASS y siete fallidos, EXIT1.
Los tres arneses adicionales se corrigieron después y se validaron solo los casos
afectados: recibo/vetos y pull TR en UTC/Madrid, los 13 casos de bajas que no habían
llegado a ejecutarse, y pull TR también en Canarias. No se presenta como una nueva
suite completa verde. Permanecen beta-sources (dependencia preferBookedExpenses),
docs-frescura, tamaño y memoria-espejo (filtro de privacidad; no escribió nada).
Los EXIT y fallos completos quedan en el checkpoint. No se repiten DOM ya cerrados. VERSION, catálogo,
caps, FIN03, polaridad Night C y FIN17 quedan fuera. Claude reconcilia integración.
