# Reanudar · día de recibo fijo sin doble descuento

Fecha: 2026-09-24

Rama de trabajo: `codex/gasto-fijo-dia-24sep`

Beta objetivo: `4.26.46`

## Alcance único

Corregir que un gasto fijo ya confirmado por el banco vuelva a descontarse al cambiar su día a
otro posterior dentro del mismo mes. No mezclar esta tanda con otras tareas.

## Causa y solución

La conciliación reconocía el movimiento real, pero el motor decidía «pagado» solo comparando el
día planificado con el día actual. Mover Iberdrola 120 € del 20 al 28 hacía reaparecerla como
pendiente aunque el banco ya la hubiera cobrado.

Al editar el día, la identidad devuelta por `reconcileBank` permite guardar `paidYm` en el fijo.
Es una sola marca mensual, no un movimiento nuevo. `isPaidIn` respeta esa confirmación aunque el
día visible cambie. Si después cambia el importe o el banco, se reconcilia otra vez el fijo ya
editado: una corrección que aún coincide conserva el pago; otro cargo pierde la marca. `bankTx` no
se sube a la nube, por eso la marca mínima vive en el fijo sincronizable.

## Evidencia exigida

- `tests/fixed-day-reconcile.test.mjs`: una ocurrencia pagada, cero pendientes, saldo de Sabadell
  estable, saldo de Revolut estable, gastos históricos idénticos y una sola fila fija.
- `e2e/plan-gestionar.spec.mjs`: edición real 20 → 28 desde Plan; una sola fila en «Ya pagado» con
  el día 28 y ninguna copia pendiente.
- Sin movimiento bancario, un recibo del día 28 continúa pendiente.
- El bundle se reconstruye desde `src/`; el presupuesto minificado no se amplía.

## Límite conocido

La corrección prueba el cambio desde la ficha vigente de Plan y la confirmación de Open Banking.
No inventa confirmaciones para recibos sin movimiento bancario y no migra ni recategoriza el
histórico. Es un cambio web/OTA; no requiere APK nueva.

## Regla de cierre del objetivo

Este objetivo **no termina al publicar beta**. Después de comprobar que `4.26.46` está realmente
en el canal beta, queda a la espera del veredicto móvil del dueño:

- Si la rechaza, corregir únicamente esta tanda, volver a verificar y publicar otra beta. Repetir
  hasta que la apruebe.
- Si la aprueba expresamente, promover la ronda completa a producción, revisar el diff resultante
  `main` frente a `beta`, ejecutar `npm run test:syntax`, confirmar Pages/manifest con
  `npm run salud` y solo entonces cerrar el objetivo.
- No promocionar ni publicar producción por inferencia o por un verde de CI.

## Prompt para la siguiente conversación

> Continúa el objetivo activo «gasto fijo: cambio de día sin doble descuento». Lee
> `docs/briefs/REANUDAR-GASTO-FIJO-DIA.md`, verifica primero `origin/beta`, Actions, el manifiesto y
> `npm run salud`. Pregúntame por el veredicto móvil de la beta 4.26.46. Si la he rechazado,
> reproduce exactamente el fallo, corrige esta misma tanda y vuelve a subirla a beta; el objetivo
> sigue abierto. Si la he aprobado expresamente, promueve la ronda completa a producción, revisa
> el merge y la sintaxis, verifica el estado publicado y solo entonces completa el objetivo. No
> avances a otra tarea antes de cerrar esta y no publiques producción sin mi aprobación.
