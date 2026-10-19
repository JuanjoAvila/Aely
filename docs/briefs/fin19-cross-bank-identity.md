# FIN19 · identidad local de gastos entre bancos y cuentas

Candidata sobre beta `dca4c71c640e3ebbc26256f9e79572fdda94e39e` (4.26.150), 19/10/2026. No integrada, publicada ni aceptada en móvil. VERSION, catálogo, caps, servidor y backfill permanecen fuera de esta tanda.

Dos cargos sintéticos de 3,20 EUR, mismo día/comercio y bancos distintos, terminaban en una fila de 320 céntimos tanto en `mergeExpenses` como en `mergeExpensesFromCloud`, en ambos órdenes. El esperado son dos filas, 640 céntimos y todos sus campos originales. El rojo previo a editar la fuente se conserva en el dossier privado.

Los índices locales de mezcla, referencias, versiones pendientes y ordinales ahora separan el banco obtenido por `expenseBankOf` y la cuenta `obAcc`. La misma identidad se usa al proteger/confirmar categorías y contar novedades del pull. `keyOfExpense`, claves persistidas, lápidas y sus lectores no cambian. Tampoco cambian el backfill existente ni escritores, esquema o datos guardados.

Cuenta ausente no es comodín: solo comparte ámbito con una cuenta conocida si el UUID o referencia del mismo banco identifica una única cuenta. Se conserva la unión aviso/extracto sin cuenta mediante el contenido únicamente cuando existe una sola cuenta candidata; una fila bancaria antigua sin referencia puede acompañar ese aviso. Dos cuentas candidatas son ambiguas y quedan separadas. No se inventa banco ni se escribe una cuenta deducida sobre las filas. Ambas identidades ausentes mantienen el comportamiento legacy. Las decisiones manuales siguen su identidad por id.

Pruebas con funciones reales y datos sintéticos: 14 casos focales, ambos órdenes, particiones local/nube, repeticiones, multiconjuntos completos, UUID, referencia, importe, nota, categoría, deuda y noCard; banco/cuenta ausentes y ambiguos, aviso, PDNG/BOOK, ordinales y lápidas. Dos mutantes (omitir banco u omitir cuenta) pierden 320 céntimos y son detectados en ambas funciones. La extracción del bloque real de App comprueba el contador de novedades.

Regresiones seleccionadas: mezcla, bancos, categorías manuales, compras idénticas, FIN10/11/15, paginación completa, pull sin cambios, ordinales y recibos. 236 casos Node reportados pasan en dos lotes finales, CPU estándar y concurrencia 1; el fichero de ordinales además contiene sus aserciones internas. Dos fronteras cliente antes aparcadas en FIN15 ahora exigen 640 céntimos; las demás conservan su oráculo y el servidor conserva el anterior.

Límites: corrección local, sin recuperar movimientos ya perdidos. El lector servidor, el índice único de la tabla y el backfill legado necesitan revisión independiente para convergencia completa entre superficies; esta tanda no la acredita ni los modifica. Sin cloud/broker real, SQL, Edge, APK, navegador, CPU6, suite completa, CI general, despliegue o aceptación móvil. Gates de tamaño/docs/catálogo se registran con su EXIT real; cualquier rojo queda para integración, sin subir caps o VERSION aquí.
