# FIN-05: conciliación de identidades — diagnóstico histórico rescatado

> Fuente PR44 `2050ce327bc931510742c3c582a9faf36155da89`, blob `935a087f8357cd97cf4ae5b3bc484e202655cb64`. Diagnóstico del10/9/2026 sobre bbf742bd. Rescate saneado del8/10: sin consultas, filas, cifras, ajustes, capturas ni identificadores familiares. No se ha reproducido otra vez ni es un arreglo publicado.

## Reproducción sintética que conviene conservar

El diagnóstico ejecutó el cuerpo real de saveEdit de04-tab-gastos.js, con setter en memoria y nube desactivada; no una reimplementación del editor.

1. Sembró un movimiento ficticio con UUID estable y comercioA.
2. Lo renombró A→B→A.
3. La lista local conservó una fila, mientras deleted contenía una clave que coincidía con esa fila actual.
4. Serializó la fila y ejecutó filasComoLaApp: el conjunto servidor quedó vacío.

Ese experimento demostraba cómo fabricar una contradicción de identidades entre fila activa y lápida en aquel código. **No demostraba que el usuario hubiera seguido esos pasos.** La coincidencia de una suma tampoco sustituye la conciliación de filas y decisiones.

## Qué sigue siendo útil y qué ha sido superado

Separar conjunto de filas, regla de presupuesto y arbitraje de respuestas del widget. Un total absoluto del servidor no se corrige sumando otra vez el precio de una compra: rompería reintentos, ingresos y cruces de periodo. Una carrera DELETE/UPSERT es una hipótesis distinta del estado contradictorio por renombrado y requiere evidencia temporal propia.

El acta posterior [pago cerrado27/9](fin05-pago-cerrada-2026-09-27.md) ya documenta el uso de expenseIsTombstoned en expenseCountsBudget y los lectores/DOM afectados. En las refs congeladas actuales existen esos helpers y el editor incorpora rekeyFixedPaymentExpense. Por ello **no se recupera como vigente la afirmación del10/9 de que cliente y servidor siempre aplican criterios distintos**, ni su receta antigua de tratamiento de lápidas. No se ha ejecutado A→B→A contra este árbol actual; su resultado permanece sin comprobar en esta auditoría.

Conservar como matriz futura, si se cambia ese editor o la conciliación: volver al nombre o importe previo; dos filas legítimas parecidas con bancos/UUID distintos; dos clientes; offline; timeout tras commit; cero filas afectadas; reintento y notificación posterior. Comparar identidades y decisiones, además de presupuesto. Los casos sin identidad comprobable deben seguir pendientes, sin vincular por parecido ni reparar filas automáticamente.

PR43 trata cambios parciales de source por UUID; no prueba por sí misma el contrato entero del editor. El journal/arbitraje nativo tiene sus pruebas y gates APK/Edge/móvil separados. Este rescate no declara FIN-05 cerrada ni atribuye una causa actual a un dispositivo.

## Descartes deliberados

Se excluyen las consultas reales del mes, modo leído de app_state, conteos/referencias de filas de la copia familiar y afirmaciones del servidor desplegado en septiembre. Tampoco se copian versiones servidas del10/9, responsables, repartos o permisos operativos vencidos. Permanecen únicamente el repro sintético, su causalidad limitada y la matriz de identidad/concurrencia, enlazados a las actas posteriores.
