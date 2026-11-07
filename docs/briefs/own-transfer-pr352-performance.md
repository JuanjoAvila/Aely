# Traspaso propio: coste de las fichas de entrada y salida

Corrección candidata sobre `2e4cfb5a0c6465afe9318a04c497863b4774d28e`.
La revisión de PR352 detectó que ambas fichas calculaban sus firmas antes del
`useMemo`, recorriendo el histórico incluso al cambiar otra parte del estado.
La búsqueda aplicaba las comprobaciones bancarias completas antes de descartar
importes, bancos y fechas incompatibles. El mapa de lápidas ya tenía caché;
el coste observado no demuestra que se reconstruyera por cada fila.

Cada consulta crea un índice por céntimo exacto, banco y día civil de Madrid,
con un contador de UUID sobre todas las filas. Solo convierte fechas del importe
buscado y comparte el mapa de lápidas y las fechas dentro de la consulta.
La búsqueda inversa conserva las salidas ya corregidas o rechazadas y las entradas
competidoras: no permite elegir una pareja por el orden de los arrays.
El índice no se conserva entre escrituras; los validadores siguen leyendo el estado
fresco y mantienen el contrato A, CAS, ACK y los rechazos por ambigüedad.

La ficha memoriza el cálculo por las colecciones que leen sus auxiliares, el owner,
la fila y el día local completo. Mantiene además la identidad del plan por contenido:
copiar una colección sin cambiar su significado no repite prelecturas remotas.
El día local corresponde al vínculo visual de recibos; el emparejado sigue usando
Madrid y su margen de dos días civiles.

Los guardianes existentes de `own-transfer-confirm` incorporan la medida de 2.000
y 20.000 filas en ambos sentidos, tiempos y contadores de comprobaciones caras,
sin modificar el estado. El e2e usa el componente React real y comprueba cambios
ajenos, cada dependencia, cambio de día con las mismas referencias y una lápida.
El mismo código de prueba puede ejecutarse sobre la base para acreditar la causa.
Resultados de ejecución y revisión se aportan en la entrega; este documento no
acredita una beta servida ni aceptación física en móvil.

Medición sintética del 1 de noviembre de 2026: base y candidata se intercalaron
A-B-B-A para cada caso, con tres muestras por bloque y seis por variante.
Los tiempos son medianas; la razón compara base/candidata, sin un umbral absoluto.

| Filas | Consulta | Base (ms) | Candidata (ms) | Razón |
| ---: | --- | ---: | ---: | ---: |
| 2.000 | Salida | 14,002 | 1,159 | 12,08× |
| 2.000 | Entrada | 33,799 | 7,887 | 4,29× |
| 20.000 | Salida | 135,934 | 9,106 | 14,93× |
| 20.000 | Entrada | 331,874 | 75,495 | 4,40× |

Una consulta adicional, fuera del cronómetro, contó lecturas de filas del histórico
y de los arrays derivados. Con 20.000 filas, la salida pasó de 150.006 a 60.004
lecturas y la entrada de 400.022 a 140.009. Son accesos contados, no un número
literal de recorridos completos. La consulta sigue siendo O(N); las comprobaciones
bancarias caras bajaron de 40.001 a 3 en salida y de 80.005 a 6 en entrada.
La candidata no convirtió fechas de importes ajenos en ninguno de los cuatro casos.
Los dos bloques de cada variante dieron los mismos contadores.

Los ocho bloques de la base fallaron por la aserción exacta de trabajo excesivo;
los ocho de la candidata pasaron los oráculos de pareja, estado y trabajo. También
pasaron sintaxis, 269 casos restantes de traspasos propios, lógica financiera,
presupuesto mensual, seguridad y las 1.457 claves de traducción. La medida se hizo
sin ralentización de CPU, con otros trabajos activos en el equipo; no impone
afinidad a un solo núcleo ni acredita latencia en un móvil físico.

En React, las dos pruebas nuevas fallaron causalmente sobre la base: ante cambios
ajenos se ejecutaban los planificadores, aunque no correspondía. Ambas pasaron en
la candidata. La cobertura de los 97 casos de traspasos se completó en dos corridas:
71 casos no afectados y los 26 de invalidación con el helper corregido. La primera
corrida se detuvo con 72 aprobados, un fallo y 24 sin ejecutar: el helper leía
`localStorage` tras dos fotogramas, antes del guardado diferido de 400 ms. Ahora
espera la proyección persistida exacta de la mutación pedida, conservando todas las
aserciones financieras finales. Se repitió el caso de owner porque usa ese helper;
los otros 71 aprobados no se repitieron. Los 26 terminaron sin omisiones ni retries.

`modo-pruebas` exige aquí **36** writers únicos, incluye expresamente
`setIncomeOwnTransfer` y conserva el resultado nulo de todos ellos durante el
bloqueo. Al integrar con la beta que añade `confirmTrMonthlyInvestment`, Claude
debe conservar ambos writers y ajustar las dos comprobaciones a **37**.
No se integra ni se cambia de base como parte de esta corrección.
Los 12 casos de `modo-pruebas` pasaron con cero omisiones, errores y retries.
Dos intentos previos de reanudación no ejecutaron casos: uno fue rechazado por
un valor de admisión incorrecto y otro no seleccionó tests por un anclaje del filtro.
Ambos se conservaron como fallos del arnés; el filtro corregido enumeró exactamente
los 26 casos antes de autorizar su ejecución.
