# INC-2709-04 · crash al abrir Cuotas de deuda

## Evidencia

- El móvil registró `TypeError: (item.months || []).slice is not a function` en `BillsItemSheet` en 4.26.48.1 y 4.26.52.1. La traza publicada aquí omite datos de cuenta y movimientos.
- Reproducción aislada en main 5d1f9ad0: fixture sintético con deuda de 24 cuotas (`months:24`), pago anterior ficticio y ruta Plan → Gestionar → Cuotas de deuda → ficha. Antes del cambio, Playwright observó la pantalla de recuperación con el mismo TypeError; E2E rojo.
- `months` es el plazo **numérico** en una deuda y una **lista** de meses en un recibo. La ficha compartida trataba ambos campos como lista antes de comprobar el tipo.

## Corrección y pruebas

- Rama selectiva desde main `tanda/cuotas-deuda-crash-28sep`, código `9ce964ed0961886d08f28153c6b871a9072371a2`, SHA final del [PR51](https://github.com/JuanjoAvila/Aely/pull/51) `2670d6c1f7c68a3cb8153fd4e5192be24cccb83e` tras estabilizar tres E2E de recibos dependientes de la fecha. La ficha crea el borrador de meses solo para recibos con lista; no transforma ni escribe la deuda.
- El E2E abre y cierra la ficha, lee el importe, conserva las 24 cuotas y encuentra el pago previo una sola vez en Gastos. Pasó tras el cambio; `plan-gestionar` + `gastos-deudas`: 40/40 en Chromium. Sintaxis, frescura documental, idiomas y tandas sin duplicados pasan.
- `npm test` local llega a los guardianes financieros, pero termina con `memoria-espejo` fallido por desfase externo del checkout; Deno no está instalado localmente. Las suites completas de [PR51](https://github.com/JuanjoAvila/Aely/actions/runs/36391332458) y [beta](https://github.com/JuanjoAvila/Aely/actions/runs/36392613985) terminaron SUCCESS. Claude revisó ambos SHAs finales con GO. El E2E de continuidad del panel beta comprueba seis tandas: las cinco financieras y la de Cuotas.

## Publicación y límite

- Beta `4.26.60.1` publicada en [Action36393734712](https://github.com/JuanjoAvila/Aely/actions/runs/36393734712) desde `6b29838723d0aa0ef72bec17f26f52944c9025cb`. Manifiesto HTTP y ZIP: huella `f0f9aa14a8668980`; `APP_VERSION` interna `4.26.60.1`, SW `4.26.60.1-2026-09-28-6b29838`. ZIP: cinco guiones financieros intactos en 4.26.60 y uno del crash en 4.26.59; `apk.json` anuncia la misma APK 4.26.55 (51). Producción HTTP sigue en 4.26.57.
- Pendiente: prueba y aprobación explícita del dueño en el móvil de la ficha de Cuotas; después podrá promoverse solo la tanda 4.26.59. FIN-05, selector y TR siguen pendientes. No se tocaron datos familiares, Android/APK, Edge, SQL ni historial.
