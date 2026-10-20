# UX14 · bordes de pestañas · remate de la PR284, 19/10/2026

Base de este remate: `e2a00f24f6b0e18b3020efab456b28eec0766d94`, R1 de la misma PR284.
El [acta de R1](ux14-swipes-encadenados.md) conserva su comparación contra beta146.
La fuente y los archivos privados sellados de R1 siguen intactos. Este remate aún requiere
revisión, integración sobre beta vigente, CI general y aceptación móvil.

La revisión de Claude (`1ab889a5f24efabae297dd9716ed3dd1305a7065`) señaló dos ramas
que aún calculaban la banda desde `-tab*ancho`: la última pestaña al seguir a la izquierda
y la primera cuando se invierte un arrastre horizontal ya reclamado. Ahora ambas conservan
`arrastreDesde`; la última mantiene el factor de goma 0,28 y la primera conserva su tope.
Umbrales de eje y destino, EDGE52, Ajustes, scroll vertical y cancelación conservan sus reglas.

## RED y A/B

Dos casos nuevos en el spec ya registrado `rendimiento-tabs`: llegar a cada extremo con
un swipe rápido y empezar otro antes de acabar el asiento. En la primera pestaña, empezar
a la derecha abriría Ajustes: se empieza a la izquierda y se invierte el dedo en el MISMO
arrastre. Así se ejercita la rama del carrusel y se exige que no abra Ajustes.

La monotonía por sí sola no basta: un salto de 69 px en el mismo sentido del dedo también
rompe la continuidad. Se exige que la banda conserve el origen visible, con margen de 8 px,
y se comprueban tanto el destino final como el aterrizaje del toque. Los snapshots de gastos,
cuentas, inversiones, deudas, metas, recibos, presupuesto, flujos y bienes permanecen exactos.

Mismo Chromium 149, viewport393×851, CPU6 real por CDP, fixtures sintéticas, SW bloqueado,
HTML servido cotejado por SHA256, splash fuera y entrada fuera de scrollers/data-noswipe/EDGE52.
Sonda de longtasks antes de navegar y rAF inline, sin layout por frame ni Profiler/Tracing.
La llegada al extremo se comprueba con el asiento a más de 10 px de terminar. La ventana
incluye dedo y asentamiento. Dos rAF a dedo quieto delimitan los puntos de comparación.

Orden real por cada borde: A1, B1, A2, B2. A es R1; B tiene las dos ramas corregidas.
La carga ajena conocida sigue expresamente permitida por `4ff63f89` y el nuevo alcance;
el censo fresco registró `beta-sources`, un navegador Edge y tests Playwright dirigidos con
un worker. No se reclama exclusividad ni se modifica ningún proceso ajeno.

| borde | pasada | error de continuidad px | rAF deltas | >32 ms | máximo ms |
|---|---|---:|---:|---:|---:|
| primera | A1 | 68,97 | 71 | 0 | 16,8 |
| primera | B1 | 0 | 68 | 1 | 33,3 |
| primera | A2 | 67,51 | 70 | 0 | 16,8 |
| primera | B2 | 0 | 70 | 0 | 16,8 |
| última | A1 | 49,28 | 71 | 0 | 16,8 |
| última | B1 | <0,001 | 71 | 0 | 16,8 |
| última | A2 | 28,06 | 72 | 1 | 33,4 |
| última | B2 | <0,001 | 69 | 2 | 33,4 |

Cuatro RED causales en R1 y cuatro GREEN en candidata. Las ocho muestras tienen aterrizaje
válido, destino correcto, sin Ajustes, snapshots financieros exactos y ninguna tarea larga.
Se conservan todas las muestras; ninguna se elimina ni repite como outlier. La señal es la
continuidad de posición: los frames >32 ms no prueban una mejora general de rendimiento.

## Clasificación de aterrizajes en la suite requerida

La primera ejecución completa se detuvo tras tres PASS por un falso «no aterrizó» en el caso
rápido de R1. Crudo conservado: tercer gesto termina a4075,9; marca previa al siguiente
touchStart4101,2; Cartera aparece a4101,7 sin arrastre; el siguiente eje horizontal no aparece
hasta4151,7. El clasificador cortaba 0,5 ms demasiado pronto y omitía una llegada real.

Se exige ahora que la tab llegue ANTES del primer frame de arrastre horizontal siguiente;
no cuenta una llegada durante él. Se guarda el límite usado en el JSON. No cambian pausas,
velocidad ni umbrales de producto o continuidad. El fallo inicial y los cuatro casos que no
llegaron a ejecutarse se conservan aparte de la ejecución con la sonda corregida.

Los grupos requeridos terminan con EXIT 0: `rendimiento-tabs` 8/8, `swipe-pestanas` 8/8 y
los tres `botnav-*` 32/32 (48 casos finales, un worker, cero retry/skip/flaky). El primer
intento de rendimiento conserva por separado 3 PASS, 1 fallo de clasificación y 4 casos
sin ejecutar. No se reemplaza ese fallo anterior por el verde posterior. El spec ya estaba registrado
en CROSSCUTTING y en la fase de rendimiento, por lo que no requiere un mapa nuevo.

Sin nueva VERSION, catálogo, topes, backend ni APK. La ola de Plan sigue en cola para otro
despacho. No se ejecuta una suite completa del repositorio; estos grupos son los dirigidos
pedidos para el remate. Chromium de escritorio no acredita Android/WebView, 120 Hz,
overscroll nativo, entrega servida ni aceptación móvil.

Sintaxis y presupuesto de tamaño: EXIT 0, sin ampliar topes. **`docs-frescura`: EXIT 1**:
detecta `src/modules/11-app-main.js` cambiado después del ancla versionada `e67fed9`.
Ese cambio ya existe en el commit base R1 `e2a00f24`; el verde documental anterior de R1
se ejecutó antes de su commit y no acreditaba el SHA publicado. Se conservan ambos resultados
fechados. No se cambia VERSION, el nombre de la rama ni el guardián para obtener un verde;
queda bloqueado para la reconciliación de versión/notas por la integración de Claude.
