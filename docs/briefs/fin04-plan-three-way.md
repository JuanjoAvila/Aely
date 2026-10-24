# FIN04 B: unión de recibos y deudas

Candidata apilada sobre A `e42650596e361bf5cc61bac8d3ed4c7f0ca9f13d` (PR293).
Depende de su lectura inicial válida, CAS por titular/revisión y acuse del payload enviado.
No representa integración ni publicación de A o B.

## Contrato

`mergePlanThreeWay` compara la base confirmada con la copia local y la remota.
En recibos une nombre y categoría por separado; importe, importe bancario, cuenta,
frecuencia, meses, calendario, día y pruebas de pago forman un grupo indivisible.
En deudas separa nombre y nota del resto de campos financieros. Nunca suma valores
absolutos. Una identidad de titular/tipo distinta conserva la fila remota íntegra.
Identidades repetidas o inválidas cierran la puerta de escritura de esa lectura.

Cuando ambas copias cambian el mismo grupo, queda el valor remoto y un borrador
local recuperable por entidad/id. Una fila ausente no acredita su borrado. Los
recibos siguen pasando por `recibosBorradosUnion`; una deuda editada no desaparece
porque otra copia no la incluya. Los campos derivados `paidYm`, `paidDay` y `wait`
se recalculan con el motor existente y no crean conflictos ni pruebas de pago.

`planSyncPull/Ack` mantiene la base por titular y revisión. El ACK usa lo enviado,
conserva las ediciones hechas durante la petición y no reinicia su debounce. Las
referencias de las listas y filas sin cambios se conservan.

## Privacidad y revisión

Los conflictos viven en `mcStateKey()+"_plan_conflicts"`, sin tope ni truncado.
La clave principal conserva la base, pero no duplica los conflictos. El cambio de
titular y la salida de sesión aíslan el registro; pruebas usa su propia partición.
`slimForCloud`, la copia diaria, la exportación de emergencia y Hogar no publican
este registro privado.

El punto de cada fila lleva a «Valor actual / Tu cambio». «Revisar mi cambio» abre
el editor existente con un borrador; guardar pasa por sus validadores y comprueba
que la fila y el conflicto no hayan cambiado. Descartar solo quita el borrador.
La revisión no copia pruebas ni reproduce pagos, liquidaciones o amortizaciones.
Los campos que el editor no permite cambiar conservan su comportamiento actual;
por ejemplo, un calendario de importes a medida mantiene el bloqueo existente.
Los textos están en español, inglés y catalán.

## Evidencia y límites

El rojo causal sobre A usa dos contextos con SDK y React reales: B cambia el día
28→29 y A cambia el nombre. Tras un rechazo CAS se pierde el día29. El mismo
recorrido pasa con B, incluyendo recarga de ambos contextos, sin adelantar
`_savedAt`. Oráculos: recibo4237c, principal120023c y cuota10011c.

`tests/fin04-plan-three-way.test.mjs` cubre grupos, céntimos/signos, campos
desconocidos y ausentes, lápidas, deuda ausente, veinte conflictos, particiones,
ACK tardío, identidad, exportación y Hogar. Mutantes focales: sumar dinero,
partir el grupo financiero y tomar la base del estado actual en el ACK.
`e2e/fin04-plan-three-way.spec.mjs` usa dos clientes y transporte sintético
compartido, ediciones DOM, CAS real del SDK, revisión validada es/en/ca, recibos,
descarte y una edición durante el envío. Está registrado para sus módulos.
La regresión de primera lectura crea su segundo móvil antiguo sin `_planSync`:
heredar una base confirmada y cambiar el nombre representa una edición local
válida, no una copia sin sincronizar. Sus ocho oráculos de lectura y dinero se
mantienen; la edición con base conocida tiene cobertura propia en B.

Los resultados, hashes del HTML servido, censos y EXIT reales se entregan en el
paquete privado de B. La versión, el catálogo, las notas y los límites de tamaño
quedan reservados a integración. Sin suite completa, CPU6, nube viva, DDL, cambios
de arquitectura de intenciones, APK, aceptación móvil, despliegue ni merge.
