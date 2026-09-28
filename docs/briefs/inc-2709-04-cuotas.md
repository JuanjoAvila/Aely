# INC-2709-04 · crash al abrir Cuotas de deuda

## Evidencia

- El móvil registró `TypeError: (item.months || []).slice is not a function` en `BillsItemSheet` en 4.26.48.1 y 4.26.52.1. La traza publicada aquí omite datos de cuenta y movimientos.
- Reproducción aislada en main 5d1f9ad0: fixture sintético con deuda de 24 cuotas (`months:24`), pago anterior ficticio y ruta Plan → Gestionar → Cuotas de deuda → ficha. Antes del cambio, Playwright observó la pantalla de recuperación con el mismo TypeError; E2E rojo.
- `months` es el plazo **numérico** en una deuda y una **lista** de meses en un recibo. La ficha compartida trataba ambos campos como lista antes de comprobar el tipo.

## Corrección y pruebas

- Rama selectiva desde main `tanda/cuotas-deuda-crash-28sep`, commit `9ce964ed0961886d08f28153c6b871a9072371a2`. La ficha crea el borrador de meses solo para recibos con lista; no transforma ni escribe la deuda.
- El E2E abre y cierra la ficha, lee el importe, conserva las 24 cuotas y encuentra el pago previo una sola vez en Gastos. Pasó tras el cambio; `plan-gestionar` + `gastos-deudas`: 40/40 en Chromium. Sintaxis, frescura documental, idiomas y tandas sin duplicados pasan.
- `npm test` local llega a los guardianes financieros, pero termina con `memoria-espejo` fallido por desfase externo del checkout; Deno no está instalado localmente. CI de la candidata tendrá que confirmar la suite que corresponda al SHA publicado.

## Publicación y límite

- Producción verificada antes de la tanda: 4.26.57. Beta efectiva antes de la tanda: 4.26.58.1, con cinco guiones financieros sin aprobación nueva. La candidata beta 4.26.60 conserva esos cinco guiones íntegros en su entrada y añade solo el del crash en 4.26.59; tras promover esta última, los cinco quedan visibles porque 4.26.60 sigue por encima de producción.
- Pendiente: revisión real de Claude del SHA integrado, CI y cotejo del manifiesto/bundle beta, y veredicto en el móvil sobre la ficha. No se tocan datos familiares, Android/APK, Edge, SQL ni historial.
