# Confirmar el plazo recalculado al editar una deuda

Al cambiar solo el saldo pendiente o el día de cobro, el editor puede recalcular el
plazo total sin que se haya editado su campo. Guardar pide ahora confirmación si
el resultado válido cambia ese plazo de forma implícita. El diálogo muestra los
meses totales y las cuotas pendientes, ambos antes y después, en es/en/ca.

Son magnitudes distintas: con datos sintéticos, cambiar el día del 25 al 1 el
18 de octubre puede pasar de 10 a 11 meses totales y conservar 6 cuotas pendientes.
Cambiar un saldo de 1.200,00 a 1.300,25 puede pasar de 10 a 11 meses y de 6 a 7
cuotas pendientes. Son proyecciones del calendario, no pagos bancarios confirmados.

Cancelar vuelve al mismo borrador y no escribe. Confirmar vuelve a calcular sobre
el estado vigente: si la deuda cambió, se borró o tiene identidad duplicada, se
rechaza la escritura. Si cambió el borrador o pasó el día de cobro y la proyección
ya no coincide con la aceptada, se pide revisar y guardar de nuevo. El guardado
existente también rechaza cambios concurrentes todavía encolados en React.

La fórmula financiera y el campo `form.months` permanecen intactos. No se pregunta
si el plazo no cambia, si se editó expresamente, si era desconocido o si hay un
error de validación. Se conserva el cierre animado mediante `closer`.

Los contratos nuevos están en `tests/deudas-plazo-aviso.test.mjs`, registrado en
el runner, y `e2e/deudas-plazo-aviso.spec.mjs`, registrado para Deudas. Cubren las
dos magnitudes del aviso, aumentos y reducciones, cancelación, estado fresco,
datos borrados/duplicados y el cambio de fecha durante la confirmación. Los E2E
usan reloj que avanza: fijar `Date.now` antes del arranque impide que venza el
mínimo temporal del splash y no permite probar el editor.

La evidencia dirigida no sustituye los gates generales, la revisión e integración,
los artefactos de beta servidos ni la aceptación en un móvil real. VERSION,
catálogo beta y topes quedan para integración; esta tanda no los modifica.

La revisión de PR269 exige que los dos casos R1/M5 existentes de cambio de día y
saldo residual confirmen el diálogo y comprueben el plazo y las cuotas que anuncia.
El texto usa singular cuando el plazo resultante es un mes, en los tres idiomas.
`tests/deudas-plazo-submit.test.mjs` pulsa el callback real del botón Guardar del
componente con hooks sintéticos: exige diálogo antes de escribir, texto traducido,
cancelación sin escritura y coincidencia entre el plazo confirmado y el guardado.
Sus mutantes propios desconectan el botón del diálogo o fuerzan el plural; no son
los mutantes del revisor. La fórmula y el cierre animado permanecen intactos.
