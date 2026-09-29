# INC-2709-01 · Inicio con red débil · 29/9/2026

## Alcance y reproducción

El relato del dueño es que al abrir con poca conexión reaparecen dos barras grises en Inicio y la app parece lenta. En la fuente 4.26.68, el splash esperaba hasta 1.800 ms al primer pull; al agotarse levantaba la cortina, pero `Dashboard` iniciaba entonces otro límite de 2.000 ms antes de pintar sus tarjetas. `loadState` ya había recuperado el estado local de forma síncrona. El caso no depende de una sincronización bancaria automática, que continúa prohibida.

Fixture sintético de Playwright: una cuenta, un gasto inventado, sesión y evento `INITIAL_SESSION` retrasados seis segundos, CPU ×6 por CDP. El nuevo E2E de DOM falló sobre la base `ee722afd3af15a1be6d3ce105f14c9a31db811e1`: tras desaparecer `#mc-load` observó `[data-tour=boot-skel]`. Una pasada instrumentada midió fin del splash a los 2.550 ms, hero a los 3.325 ms, 775 ms de segunda espera y 9 intervalos de `requestAnimationFrame` mayores de 32 ms hasta el hero. Son cifras de Chromium, no del móvil del dueño.

## Cambio acotado y prueba local

Cuando la cortina agota su espera de nube, señala ese hecho al Dashboard. Este ya no inicia otra espera visual y muestra los datos locales guardados en cuanto sale el logo. Si el pull responde después, su camino normal actualiza el estado. No se cambian el límite del splash, importes, deduplicación, preferencias financieras, escrituras, Edge, SQL ni APK. En la misma medición sintética tras el cambio, splash y hero coincidieron a los 2.560 ms, no aparecieron barras y hubo 7 intervalos >32 ms hasta el hero. Esa diferencia de frames de una pasada es orientativa; la evidencia decisiva es la ausencia del intervalo de barras y el E2E rojo antes/verde después.

La versión candidata es 4.26.69 y añade una sola tanda `inc-2709-01-arranque-red` al panel. `e2e/inicio-offline.spec.mjs` ya estaba mapeado a `03-tab-dash.js` y a las pruebas transversales de `shell.html` en `scripts/relevant-tests.mjs`; el caso nuevo corre con la pantalla real. La fecha, base, SHA final, CI, manifiesto, ZIP, HTML y SW se completan al publicar beta, no se suponen por estar en disco.

## Límite y aceptación móvil

El móvil debe probar cierre y apertura con red débil, abrir sin conexión, volver a conectarse y reabrir: al terminar el logo, Inicio debe enseñar los datos guardados sin barras grises; cuando llegue nube, actualizarse sin bloquear la navegación. Se conserva la diferencia entre dato local y dato remoto tardío: esta tanda no afirma que el saldo local sea la lectura bancaria más reciente. La latencia y los fotogramas de Android necesitan comprobación en dispositivo; el ensayo de Chromium no los certifica. INC-2809-02, las cinco tandas nativas, FIN-05, selector y TR conservan sus veredictos propios. No promover ninguna junto a esta tanda sin autorización exacta.
