# INC1810-01 · Guardar en Deudas

Contraste del 26/10/2026 en la base exacta
`78c41edf87e2784ed31f8c9a083656c786d2632f`, sin cambios de producto.
Los cinco casos del guardián nuevo pasan en Chromium con viewport Pixel 5,
idioma español, zona Europe/Madrid y reloj fijo 18/10/2026 a las 12:00 UTC.
Un trabajador, cero reintentos y parada al primer fallo; build y DOM terminan
con código 0. La prueba usa datos sintéticos y el doble de sesión existente.

## Resultado y causa que sí puede afirmarse

No se reproduce el bloqueo total de Guardar en esta fuente. El guardado sin
cambios cierra la hoja; editar nombre, nota y TAE guarda sin alterar el saldo
ni el calendario. Subir la cuota de 200 a 210,01 conserva 1.200 euros pendientes
al céntimo y persiste tras recargar. Cada caso usa el botón y los campos reales
desde Plan → Deudas; no llama directamente al manejador de Guardar.

La bajada a 100 o 90 euros con seis cuotas pendientes sigue siendo inválida:
FIN16 exige una cuota entre 200 y 239,99 euros para ese ejemplo. La hoja se
mantiene abierta, enfoca el mensaje completo dentro de la pantalla y no cambia
los datos. Cancelar y recargar conservan la cartera sintética. Introducir
`1,2,3` muestra error y conserva el borrador; corregir a `200` permite guardar.

La fuente ya separa ambos resultados: `debtEditResult` devuelve el rechazo
financiero y `DebtEditSheet` enfoca y desplaza su aviso en cada intento. Un
resultado válido pasa por `usePlanEditSave`, que espera el estado confirmado
antes de cerrar. La prueba observa ese comportamiento; no atribuye el incidente
humano a una causa que no ha reproducido.

## Guardián y límites

`e2e/inc1810-deuda-guardar.spec.mjs` comprueba el DOM, los datos persistidos,
campos desconocidos, céntimos y recarga. Está registrado para el módulo 09
en `scripts/relevant-tests.mjs`. El cambio contiene pruebas y documentación;
no incluye un arreglo de producto sin evidencia causal.

No se prueba un móvil físico, una sesión bancaria real ni un conflicto de
sincronización. Tampoco se acredita integración, CI global, versión servida
o cierre humano del incidente. Alargar el plazo (INC1910-01) conserva su
alcance separado; este guardián no pulsa esa opción ni cambia FIN16.
