# INC-0410 · Tres metas en Inicio

Candidata96 desde beta dd59064e1edb6bd0e14a0d9682a9b61f47dc212e. El backlog y el acta mensual dejan pendiente el máximo de tres metas en Inicio. Se cambia únicamente el límite visual de cuatro a tres, después del filtro de terminadas. No se ordena ni modifica el array guardado, reglas, aportaciones, presupuesto o saldos; Plan mantiene todas las metas y el enlace existente.

DOM real registrado en listas-render: es/en/ca y cero/una/tres/cinco activas; una terminada al principio detecta filtro después del límite, y navegar por el enlace comprueba la lista completa y el estado intacto. El mapa incluye la suite para Inicio además de Plan.

Reconciliación 6/10: la CI completa de PR140 sobre fb3d5b19 terminó roja en PERSIST91 porque su lista explícita de alcances ajenos al guardado no incluía la tanda nueva de solo lectura. Se añade a esa lista; permanecen la comprobación de llamadas reales a `set`, los 18 alcances que escriben y las mutaciones que invalidan sus revisiones. No se modifica el registro de alcances ni el runtime para silenciar la prueba. Los tres guardianes de importación histórica pasaron en esa CI; sus fallos locales con Node24 no describen el resultado remoto con Node20.

Revisión independiente de fuente y corrección PERSIST91: GO, con clasificación y mutaciones comprobadas sin editar el registro. Pendientes: ejecución DOM de los doce casos, CI verde del nuevo SHA y publicación exacta. El job rojo anterior paró antes de los E2E. Chromium local bloqueado por socket de proceso; no se acredita pantalla con sintaxis. Notas y guion móvil nuevos en tres idiomas, alcance acotado a la selección de metas de Inicio. Las notas anteriores se conservan; la tanda95 solo se retira por entrega normal acreditada.

INC-2709-09 permanece abierto para degradación por uso prolongado; este cambio no es una corrección de rendimiento. Inputs privados blocked; sin nueva aprobación inferida. Sin main, APK, Android, Edge, SQL ni operaciones reales.
