# FIN-04 · revisión del NO-GO de PR218

## Mantenimiento de PR218 sobre beta123

Rebase solicitado en la señal canónica `09b516fc449106737fd88c5fc79b1f310461d815`, sobre `3625fa7ed5134cfbc5e364adc4f588bfdaf670c0`. La entrega beta122 `ad0abaff31c9e54e42cf2c0bd5154e931b73a2b4` y su resultado `e08e022b647687b8a30ec36decb84787d3eafbe7` siguen cerrados e inmutables. Este mantenimiento no reabre su claim ni atribuye su CI o DOM a la nueva cabeza. La fuente anterior, el resultado y los logs completos se archivaron antes del rebase.

Sólo hubo conflictos en los cinco archivos generados, resueltos mediante el ensamblador oficial. `00-core`, `04-tab-gastos`, `11-app-main` y los tres contratos FIN-04 son idénticos a ad0abaff. Inicio (`02-ui-shared`, `03-tab-dash`), su cobertura, la nota123, VERSION, catálogo y topes son idénticos a la base123. No se añade funcionalidad ni se modifica producto ajeno.

Doce comandos ligeros pasan sobre el nuevo bundle: sintaxis; contratos44, revisión42, mutantes37, ACK18; pull17, ordinal38, recibos61 e invariantes22; Inicio con sus 24 mutantes, i18n y seguridad. No hay navegador local ni DOM nuevo. La CI completa corresponde al SHA final de mantenimiento y se registra en la PR y en un mensaje canónico, sin repetir claim ni result.

Medida con minificador oficial, DSN95 y sello123.99999: **1.411.285 B crudos / 387.416 B gzip**, frente a los topes heredados de **1.384.448 / 380.928 B**; exceso **26.837 / 6.488 B**, tres ficheros bloqueantes. Se conservan 24 huellas afectadas sólo en web y los tres huecos reales del catálogo. Claude gestiona catálogo, VERSION y ajuste mínimo del presupuesto al integrar. Revisión independiente, CI completa, publicación y aceptación móvil no se heredan de la entrega122.

## Entrega beta122 conservada como historia

Candidata aislada sobre beta122 `e6e211a5d94e50b03597d5c91230c974d3e72232` (rebase solicitado por Claude en el mensaje canónico `8a836f737f2cf46b8a4546c13a84827f50203a15`; base original del encargo: beta118 `7e706174255f1868d15099e11a503dd23d9aa774`), sin integrar ni publicar. El resultado de la primera candidata queda como historia, no como aceptación de esta revisión. Fuente, pruebas Node, DOM, CI y móvil requieren evidencia propia. El coordinador integra VERSION, notas y catálogo sólo después de revisión independiente; esta rama no los modifica.

## Qué se comprueba

La base de comparación se guarda al hacer el gesto sin red. La cola se drena en orden al aceptar sesión, online, foreground y tras pull; una pasada por disparador, sin bucle de reintentos. El plazo de Deshacer se guarda en disco. Ausencia acreditada cierra DELETE o una fila retirada con lápida; Descartar consulta el remoto y retira la cadena de intenciones de esa fila. Importe normalizado a céntimos antes de encolar, ningún propietario nulo, purga de claves privadas al cerrar sesión o borrar cuenta.

La realineación exige UNA fila con propietario, instante, céntimos, comercio y origen exactos. Remapea UUID, orden manual, `possibleDupOf` y referencias de pruebas de recibos sin atribuir un pago nuevo. La muestra sintética de siete filas tiene dos resolubles (id corto/UUID divergente) y cinco rechazadas por dueño, instante, céntimos, comercio u origen distinto; otra prueba veta dos candidatas exactas. No es una estimación de la cartera real.

Los 37 mutantes incluyen los siete supervivientes de la revisión y dos guardas contra la repersistencia de secretos tras logout en otra pestaña. La cifra anterior «2 pasan / 16 fallan en la base» se retira expresamente: el contrato llamaba una función inexistente en esa base. No se usa esa cifra para acreditar mejora.

## Compatibilidad de source preparada para integración

La orden canónica ea747c75 exige conservar el tramo final #n<k> y la marca alternativa ~recibo.<id>. El lector/escritor FIN-04 admite ordinales canónicos de 2 a 999999 en OB e histórico; conserva el texto exacto, rechaza ceros iniciales, orden inválido, marcas dobles y ordinales en fuentes manuales. Cambiar la deuda reemplaza la marca de recibo por decisión expresa; cambiar banco, categoría o duplicidad conserva los demás tramos. Un cambio remoto de recibo provoca conflicto de categoría/deuda. Un ACK con otro ordinal no confirma la escritura. No se convierte a notificación una fila con ordinal o marca financiera: perdería su identidad.

Los siete casos añadidos incluyen 36 combinaciones de ida y vuelta, 19 negativos, escrituras por UUID sin tocar el otro ordinal y realineación por source completo. Cinco mutantes nuevos vigilan conservación, límites y validación del escritor. Sobre beta122 se añaden ocho contratos del viaje completo con los conversores reales y nueve mutantes causales: deuda en ob-hist, acuse con ordinal, sustitución de recibo por deuda, lápidas de cargos iguales y unión del aviso mientras hay banco pendiente. Siete de los ocho fallaban antes del arreglo (35 PASS / 7 FAIL); después pasan los 42 contratos de revisión y caen los 37 mutantes. La fecha del cargo ya contiene el desplazamiento del ordinal: el transporte no lo aplica por segunda vez. Se conservan el importador, los vetos de recibos y la prioridad del aviso heredados de beta122; la unión espera si pisaría una decisión pendiente. Una cola anterior con base sin recibo puede pedir resolver conflicto explícitamente; nunca se inventa esa base.

La evidencia DOM 20/20 y la CI `38306138436` roja pertenecen sólo a `0e0480ba` sobre beta119. No acreditan este rebase: DOM y CI necesitan ejecución sobre la cabeza final. No se ejecuta navegador local mientras esté retenida la reserva FIN01. Los conversores bancarios heredados siguen siendo permisivos con fuentes malformadas; FIN-04 exige el formato canónico en sus cambios de source. No se amplía esta tarea a corregir importación, servidor ni clientes antiguos.

## Bloqueos de integración del corte beta122

La medida con el minificador oficial, DSN sintético de 95 B y sello `4.26.122.99999` es **1.409.763 B crudos / 386.977 B gzip**: excede los topes heredados de 1.382.400 / 379.904 B en 27.363 / 7.073 B; siguen siendo tres ficheros bloqueantes. Los topes no se modifican. Hay **24 huellas web** distintas respecto a beta122, ninguna nativa ni Edge; se preserva la retirada de `recibos-cargo-unico`. El catálogo mantiene huecos reales: mutar `mcExpenseCents` o `_mcExpenseEpoch` no mueve la huella de `inc-3009-01-cargos`, y su descriptor no lista el método `editExpense`. Requieren revisión del integrador, no un repinado automático en esta rama. Las pruebas focales no convierten esos rojos ni una CI pendiente en entrega.

CI `38350541666` de `07a85cc3`: FAILURE / EXIT1 en 683,8 s. Fallan `beta-sources` (Catálogo122 y los tres huecos descritos), `docs-frescura` (código publicable sin VERSION nueva) y `presupuesto-rendimiento`. Contratos44, revisión42 y mutantes37 pasan, igual que los siete ficheros Deno. E2E no se ejecuta tras esos rojos; la etapa separada de privacidad queda omitida. Los logs completos se conservan antes de sustituir esta cabeza.

### Atribución y simplificaciones propias

A/B con el mismo cuerpo del minificador oficial, terminaciones de línea del build local, DSN95, sello122.99999 y gzip9: beta122 mide 1.382.186 / 379.492 B y deja sólo 214 / 412 B de margen. FIN-04 en `07a85cc3` añade 27.632 / 7.497 B. Tres simplificaciones propias —recorrer valores de la cola, reunir filas sin `apply` y registrar ACK sin un array intermedio— conservan 44 contratos, 42 casos, 37 mutantes y los escenarios heredados de pull/ordinal/recibos. Tras regenerar el artefacto completo ahorran **55 B crudos / 12 B gzip**; el delta frente a beta122 queda en 27.577 / 7.485 B. No resuelve el presupuesto. Se descarta otra variante que ahorra crudo pero aumenta gzip.

El transporte y cola propios ocupan 14.724 B minificados y los helpers de conciliación 4.910 B; son medidas diagnósticas de bloques, no tamaños sumables de descarga ni candidatos ejecutables al retirarlos. Quitar estas piezas quitaría almacenamiento durable, orden de gestos, identidad exacta, acuse, privacidad o conciliación. No se atribuye a beta122 el exceso añadido por FIN-04 ni se recorta producto ajeno para compensarlo. Las tres brechas del catálogo siguen abiertas.

## Convivencia y límites

Un cliente antiguo puede conservar dos filas al recibir ediciones cruzadas de una identidad: su mezcla no conoce este contrato. El drenado no arregla su algoritmo ni deduplica por parecido. Hay también una ventana entre la lápida de la clave antigua en `app_state` y el UPDATE de `expenses`; otro móvil puede ocultar el gasto durante esa ventana. El drenado automático la reduce al siguiente disparador con red, sin garantizar atomicidad entre recursos. No hay recibo remoto de operación, revisión global ni protección ABA. Una colisión de índice único sigue requiriendo decidir y tiene salida mediante Descartar.

## Prueba del dueño, cuando se publique en beta

Usar un movimiento de prueba identificable y anotar sus valores iniciales; no hace falta borrar datos de la cartera.

1. Activar modo avión, cambiar nota, categoría y tarjeta. Debe cambiar la ficha inmediatamente y aparecer el aviso de pendientes. Cerrar y abrir la app: conserva los cambios y el aviso.
2. Recuperar conexión sin pulsar Reintentar. La cola se vacía; al abrir en el segundo móvil aparecen los tres cambios. Repetir dejando la app en segundo plano durante el corte y volviendo después.
3. Con el primer móvil sin red, editar una nota. En el segundo, cambiar esa misma nota a otro valor. Reconectar el primero: muestra conflicto y no pisa el segundo. Descartar recupera lo del segundo; repetir y elegir Mantener mi cambio sólo tras revisar el aviso.
4. Apuntar un importe de prueba con tres decimales: debe quedar a dos y no retener un pendiente por comparar distinta precisión. Provocar una edición que coincida con otro apunte: el conflicto se puede descartar y queda una sola identidad por movimiento, sin borrar el otro.
5. Borrar un movimiento de prueba y cerrar antes de cinco segundos. Reabrir con red: respeta el plazo restante y luego el borrado deja de estar pendiente. En otro intento, usar Deshacer antes del envío: vuelve sin alta adicional.
6. Comprobar en es/en/ca el singular de un cambio pendiente y la salida Descartar. Verificar una notificación TR marcada repetida: Son distintos conserva su origen de aviso del móvil.
7. Con una operación pendiente, cerrar sesión y volver a entrar: no reaparece su nota privada en la cola. Borrar cuenta sólo se verifica con una cuenta sintética destinada a ello, nunca como paso sobre la cuenta familiar.

Los dobles Node y navegador no acreditan una escucha del móvil, RLS desplegada ni publicación. Los EXIT y SHA finales se consignan en el resultado canónico del encargo.
