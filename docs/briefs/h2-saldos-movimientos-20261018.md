# H2: fases de saldo y movimientos — candidata PR279

Base diferencial inmutable `ff53b0e7243fe79f9164bbc1bcf2313fb2e28d13`. Ronda5 desde `0ad88ec82b659cd82d4f1dd30e6eea2c7b9caad9`, tarea `h2-pr279-round5-base-identity-phases-codex-20261018`, grant `3d5ca8cac7cb8ca5c260c5f8173aedcf7d5249c3`. La regla de ronda4 que hacía visibles todas las libres fue revocada: producía doble conteo. Su evidencia se conserva como historia, no como aceptación financiera.

## Asignación y fases

La asignación vuelve exactamente a la base: recorre las principales en su orden, busca su IBAN y después la primera cuenta bancaria libre. No reserva todas las identidades antes, no usa UID como prioridad y no introduce reglas de reconexión o ambigüedad. Se conserva literalmente la selección original, `uidCambia`, la fórmula financiera y la construcción de extras sanas. Con todos los saldos válidos se compara el resultado completo contra el bundle REAL de Git: estado, identidades, orden, importes, fechas, `changed`, `synced` y replay. No se ocultan campos para obtener igualdad. Las cuentas sanas tampoco reciben nuevas fechas o banderas que la base no escribía.

H2 actúa después de asignar. Un saldo fallido retiene el valor y la fecha anteriores de ESA principal, marcada `balanceStale`; una extra fallida conserva su registro previo por la misma clave que construye la base, marcada `stale`. No se inventa saldo cero ni fecha cuando falta el registro. Una hermana válida se aplica y un fallo de movimientos no descarta un saldo válido. La cuenta fallida ocupa su posición antes de evaluar el saldo para no desplazar a la hermana. El legado usa su señal anterior de fallo, y un banco legado explícitamente fallido mantiene la retención completa.

Ejemplos causales de ronda4 frente a base: dos manuales/dos cuentas17000→10000 céntimos; dos manuales/una cuenta14000→9000; cambio parcial UID15500→10500; UID que pasa a IBAN15000→10000. La conservación por fases mantiene12500 anteriores más10000 válidos=22500, cero válido, fecha anterior y10000 válidos con movimientos fallidos.

## Imperfecciones de identidad de la base: backlog separado

- Una manual anterior sin vínculo puede tomar la cuenta cuyo IBAN correspondía a una principal posterior. Se conserva el orden de la base; si falla esa cuenta, H2 retiene el saldo de la principal que la base asignaría, no el de la que parecería corresponder por identidad.
- Un UID previo no determina la asignación: reordenar cuentas puede reasignar la principal. Un IBAN que deja de aparecer puede caer en la primera libre.
- Identidades bancarias duplicadas o contradictorias y principales duplicadas conservan el comportamiento imperfecto de la base; H2 no añade deduplicación.
- La salida sana conserva los metadatos de fecha de la base: no añade frescura nueva y puede perder la fecha de una extra reconstruida. La excepción admitida en R6 elimina una `balanceStale` preexistente después de recibir saldo válido. La advertencia independiente por antigüedad superior a 48 horas se conserva.

## Servidor, ACK y compatibilidad conservados

`accountPhases:1` separa saldo y movimientos. Cada cuenta indica `balanceOk`, `balanceError` cerrado y `balanceAt` cuando corresponde; el cliente conserva las fechas anteriores al retener fallos. El servidor anterior y el nuevo se ejecutan con banco/BD/reloj sintéticos. Clientes antiguos mantienen su parada tras fallo de saldo, retención de banco completo y ausencia de ACK; el cliente capaz continúa los movimientos. Saldo válido con extracto fallido se aplica.

El cursor depende de movimientos completos y persistencia local duradera, incluida la cuota de gastos. ACK conserva autorización, identidad, monotonía y `.select("id")` con fila afectada. B4 mantiene códigos cerrados, registro de fallos de saldo, completitud solo de UID válidos y telemetría por fases. No cambia servidor, ACK, auth, SQL, tokens, `CLOUD_WRITES` ni diagnósticos en esta ronda.

Se mantienen llamadas en serie:60 s globales,15 s por cuenta, hasta5 s de saldo y el resto para movimientos. La excepción de desbordamiento12 páginas/2000 filas y el límite90 días siguen vigentes. No se acredita recuperación universal ni cierre del incidente real.

## Validación y entrega

RED antes de producto:50 escenarios fallan contra ronda4, incluidos los cuatro descuadres numéricos. La matriz conserva los44 escenarios anteriores (contrapartes all-OK de los fallidos y comprobaciones de saldo junto a B4), más6 de revisión. Cuatro corresponden a ejemplos numéricos explícitos; los otros dos concretan límites de asignación anterior a una vinculada y duplicados. GREEN50/50,56 comparaciones completas con replay; fases29/29, incluidos27 escenarios previos adaptados al contrato R5 y2 controles de retención de la cuenta asignada. Las expectativas de identidad/frescura incompatibles con la base se sustituyen expresamente; las financieras de fases, ACK y B4 se conservan.

Los manifiestos anteriores, descarga51/51,775 extractos/60 Recibos, mutantes y DOM previos son procedencia, no nuevas ejecuciones. Solo se repiten focales cuando cambia su fuente. No DOM/suite general/CPU6/Gradle/APK/banco real. Los gates de tamaño, documentación y catálogo se registran con sus EXIT reales, sin subir topes, VERSION ni repinar catálogo. CI, revisión independiente final, integración, servido y móvil se acreditan por separado. Rebase completado a `7090802099ac0c7956c0d3597a9936a82c52a95f`: conflictos de documentación, registro y JSON generado resueltos conservando ambos cambios; módulo08 ajeno a H2 cotejado exactamente contra beta y servidor idéntico a la candidata previa. El bundle integrado vuelve a pasar50/50 y29/29; ocho mutantes dirigidos muertos. La base del diferencial permaneceff53.

## Ronda 6: recuperación de saldo y web dirigida

Desde `6b1a0f543c2a95a5a485e57af0ba51bf740c37df`, grant `1c152dd5e8f6fa67a65605ce00c04208bbbaf1ff`. Tras un saldo válido se elimina `balanceStale` solo cuando la principal ya tenía ese campo, también si el importe no cambió o procedía de una extra fallida promovida. Se copia la cuenta antes de quitarlo, sin mutar la entrada. No se escribe `balanceAt` ni se modifica asignación, orden, fórmula o servidor. Los casos sanos originales siguen siendo iguales al bundle real ff53, con presencia de campos incluida.

RED causal: cuatro controles de recuperación fallan antes del cambio y el navegador reproduce la bandera persistente después de aplicar 10000 céntimos. GREEN: 33 controles de fases (29 anteriores y cuatro nuevos), 50 escenarios/56 comparaciones de identidad, cinco mutantes detectados. Incluye recuperación con importe igual a 12500 o distinto de 10000, segunda recuperación a 11000, replay, fecha previa e inmutabilidad.

La web dirigida usa puerto propio 46391, un worker y cero reintentos. Los cinco casos antiguos que esperaban fecha nueva ahora comprueban su ausencia y la fecha previa de la fallida. Siete casos pasaron en la ejecución del fichero; el octavo, promoción real desde la ficha seguida de dos sincronizaciones, pasó en ejecución dirigida después de corregir su selector. La primera tentativa del rojo web había omitido cerrar el informe de sincronización: su timeout se conserva separado del rojo causal. No se presenta ninguna de esas ejecuciones con EXIT1 como suite verde completa. La fecha previa reciente aísla `balanceStale` del aviso independiente por antigüedad; no se cambia ese aviso.

Sintaxis y privacidad EXIT0. Tamaño 1369/1368 KB y catálogo congelado siguen en EXIT1; documentación se comprueba después del commit y su resultado se adjunta a la entrega. Las validaciones de R5 arriba son procedencia cuando no se han repetido en R6. Sin suite general, CPU6, Gradle/APK, SQL, banco real, despliegue ni merge.

**Borrador pendiente de revisión final; no ProductREADY. Edge solo con OK del dueño tras su beta.** Sin despliegue ni merge.
