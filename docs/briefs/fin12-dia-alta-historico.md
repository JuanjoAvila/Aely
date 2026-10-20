# FIN12: el día de alta de una financiación en Inicio

Candidato aislado sobre beta160 `66c13084257fd576444a01cb529c5e6e815c6ec6`.
Sin cambios en PR288, PR289 o PR290; integración y versión reservadas a Claude.

## Causa y cambio

La base ya guardaba `startMonth` y excluía los meses anteriores. El día concreto
se perdía: una financiación creada el 10 de octubre aparecía en el gráfico desde
el día 1. No se puede recuperar ese día desde `asOf` o `asOfDate`, que también
sirven para migrar y corregir saldos de préstamos anteriores.

Las altas con plazo sin cuotas previas y las compras de AffordCard guardan ahora
`startDay`, día civil de Madrid. La serie histórica valida ese día y excluye la
financiación antes de él. La fecha de inicio puede ser anterior al mes de la
primera cuota: esa cuota sigue amortizando según el calendario existente.

Los registros con cuotas previas conservan su inicio mensual calculado; los
anteriores sin día válido conservan su política mensual o legado. No se inventa
una fecha retroactiva ni se migran filas. Préstamos sin plazo, anclas, cuotas,
amortización, pago final, saldo actual suministrado y campos desconocidos se
conservan. La fecha sobrevive a la edición y a la proyección local del estado.

## Evidencia

ROJO sobre la base exacta: las dos altas reales y la serie histórica muestran
deuda antes del día de creación. Un fixture separado distingue alta y primera
cuota. En Inicio real, crear desde Plan 600,12 EUR el día 10 y tocar el día 9
muestra 4400,01 EUR en vez de los 5000,13 EUR independientes esperados.

Tras el cambio pasan cuatro pruebas de Inicio (creación, gesto sobre fechas,
cuota, recarga y controles heredados), 48 pruebas dirigidas de lógica en Madrid
y 33 de deuda futura en UTC. Los oráculos usan céntimos independientes y cubren
cambio de año, medianoche de Madrid en invierno/verano, día anterior/exacto/
posterior, primera cuota posterior, filas completas e inicio inválido. Cuatro
mutantes nuevos de frontera diaria y escritores quedan detectados por importes,
además de los controles anteriores.

Dos expectativas antiguas para altas nuevas se precisan al día real, en vez del
primer día del mes. Los casos mensuales heredados no se modifican. El primer
control del candidato conserva dos fallos de pruebas: una expectativa mensual
pendiente de actualizar y una comparación de prototipos entre contextos VM;
se corrigieron sin cambiar el producto ni los importes del oráculo.

Los specs y la configuración se inspeccionaron antes del primer navegador:
CPU1 secuencial, un worker, cero reintentos, parada al primer fallo, puerto propio
y logs durables. No CPU6 ni pruebas de rendimiento. Los EXIT de sintaxis,
privacidad, tamaño, mapa, seguridad, docs y catálogo dirigido se entregan en el
informe privado; los gates bloqueados conservan su condición real.

El catálogo160 dirigido pasa y su cierre no añade dependencias sin declarar.
El primer inventario privado omitió la exclusión oficial de un descriptor
congelado y falló al leerlo; se conserva ese fallo de inspección por separado.

Sin cambios de VERSION, notas, catálogo o caps; sin suite completa, CI general,
banco/nube reales, SQL/Edge/API, widget nativo, APK, despliegue o merge.
No acredita entrega servida, aceptación móvil ni ProductREADY.
