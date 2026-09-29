# INC-2809-02 · ayuda plegable de Mi ciclo · 29/9/2026

## Alcance

En Gastos, el texto explicativo de Mi ciclo puede ocultarse con «Ocultar» y recuperarse con «Ayuda». `settings.gastosCycleHelpOff` guarda la elección por perfil. El periodo seleccionado y la fecha del cobro reconocido siguen visibles; si falta nómina, siguen visibles la ausencia y que el presupuesto usa el mes natural. El filtro Mi ciclo sin presupuesto por cobro dispone de una explicación propia. No se cambian cálculos, movimientos, widget, Android, Edge, SQL ni migraciones.

## Fuente y pruebas

- Base beta `a001c202ba629b1db7e430eb86ae88163560d4b5`; cambio `46bd9b24bc15f115be846de24a919934dfed0be3`; [PR #64](https://github.com/JuanjoAvila/Aely/pull/64) fusionada en beta `17aeacc03f595412c044d276c900707cbbd008c8`.
- E2E local con Chromium móvil: `gastos-ayuda-ciclo` 5/5 (es/en/ca, plegado, regreso, recarga, reapertura, falta de nómina y filtro informativo), `presupuesto-fluido` 16/16 y `revisar-beta` 31/31. `test:syntax`, `i18n-keys`, `i18n-bundle`, `docs-frescura`, `month-budget-stats`, `relevant-tests` y presupuesto de tamaño pasaron.
- `npm test` local se detuvo en `memoria-espejo`: ocho espejos preexistentes de memoria externa a esta tanda difieren de este checkout. Deno no está instalado localmente. La [Action beta 36612627888](https://github.com/JuanjoAvila/Aely/actions/runs/36612627888) terminó **SUCCESS** con suite completa: 483 E2E funcionales, 7 de rendimiento, Deno y empaquetado.
- HTML minificado 1.256.096 B y gzip 342.346 B. El guardián crudo se amplió 1 KiB por el resumen del cobro siempre visible y el control reversible; gzip permanece bajo 335 KiB.

## Canal servido

La beta `4.26.68.1` respondió por la URL pública de la release con huella `829684d38c95aa44`. El manifiesto HTTP y el asset de GitHub coinciden en SHA-256 `45e0328f2ad10564b8ca111988877ad04762c9ca172086633c156d45a06d8ee6`; el ZIP coincide en `89daf97957c81fbf34f07ebaa05e323eab6187276e1dd9ec0f47f4545a6bf495`, y `apk.json` en `41895cd73606c25281f51fb5c77f795d8712dc3f664dfc751cb1fe7caca37475`. Dentro del ZIP, HTML `4.26.68.1`, SW `4.26.68.1-2026-09-29-17aeacc` y primera nota `4.26.68` con `inc-2809-02-ayuda-ciclo`; la siguiente nota conserva, en el mismo orden y texto, las cinco tandas nativas de 4.26.67. El `apk.json` del ZIP coincide con el asset independiente y anuncia APK `4.26.55`/code 51.

`npm run salud` comprobó que Pages estable continúa en web `4.26.66` y APK `4.26.32`/code 48, ambos descargables. Esta publicación beta no autoriza ni ejecuta una promoción a producción.

## Aceptación pendiente y relevo

En el móvil beta: Gastos → Mi ciclo → Ocultar; comprobar que cobro/fecha o ausencia de nómina permanecen visibles. Salir y volver, cerrar y reabrir la app, y usar Ayuda. El veredicto debe identificar esta tanda y la versión servida antes de promocionar solo su alcance web. Las cinco tandas nativas conservan su propia validación. El siguiente chat vuelve a comprobar aprobaciones y, si no hay ninguna nueva publicable, toma un objetivo independiente del backlog (prioridad conocida: INC-2709-06, cargos CaixaBank ausentes).
