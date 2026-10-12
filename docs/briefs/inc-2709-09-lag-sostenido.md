# INC-2709-09 — «tras usar un rato reaparece un lag muy fuerte»

Estado a 2026-10-05: **un defecto acotado arreglado (4.26.95, candidata en rama); el caso del
dueño NO está cerrado.** Lo que él describe —lag que aparece con el rato de uso— no se ha
reproducido en síntesis. Lo que sí se midió es un escalón por tamaño del histórico.

## Qué se midió y cómo

Fuente `main` 8bb0398f, Chromium headless con perfil Pixel 5, CPU frenada x6 (y x12 de contraste),
estado sintético: 3.000 gastos, 6 deudas, 6 metas, 10 recibos, 8 inversiones, nube simulada vacía.

Un ciclo = scroll táctil en Inicio, deslizar a Gastos, scroll, abrir y cerrar Apuntar, deslizar a
Plan, sus tres segmentos, scroll, deslizar a Cartera, scroll y tres deslizamientos de vuelta. El
guion «variado» añade ida y vuelta de primer plano y abrir/cerrar la ficha de un gasto.

- Frames: deltas de `requestAnimationFrame` **solo dentro de la ventana de cada gesto**.
- Entre ciclos, fuera del cronómetro: heap tras GC, nodos y listeners (`Memory.getDOMCounters`),
  temporizadores vivos y bytes escritos en `localStorage`.
- Cada deslizamiento comprueba que la pestaña activa cambió; un ciclo con un gesto perdido se tira.
- Se espera a que se vaya el splash y al premontaje; los clics de apoyo son crudos.

| Escenario | Ciclos válidos | Frames >32 ms (primeros → últimos) | Tareas largas (ms) | Heap (MB) | Nodos / listeners |
|---|---|---|---|---|---|
| Base x6 | 60 | 11 → 8 | 92 → 81 | 8,64 → 9,52 | 1739 / 509 fijos |
| Variado x6 | 40 | 12 → 12 | 138 → 140 | 8,98 → 9,90 | fijos |
| Variado x12 | 15 | 22 → 18 | 1446 → 1407 | 8,80 → 9,22 | fijos |
| Deslizar lento x6 | 15 | 10 → 9 | 116 → 89 | 8,56 → 8,82 | fijos |
| 6.500 gastos x6 | 15 | 11 → 13 | 345 → 320 | 10,79 → 11,22 | fijos |
| **Control: fuga inyectada** | 20 | **10 → 61** | **118 → 903** | — | **+800 / +24 por ciclo** |

Ninguna métrica crece con el tiempo salvo en el control, que es lo que acredita que el
instrumento distingue el caso malo.

## Lo que sí apareció

Volver a primer plano costaba más cuanto mayor era el histórico, con un escalón al pasar de 5.000
fechas distintas. Tarea larga mediana a x6: 3.000 gastos, 0 ms · 4.800, 123 · 5.200, 153 · 6.500, 178.

Atribución con `console.timeStamp` + Tracing, y perfil de CPU en ejecuciones aparte:

| 5.200 gastos, por vuelta a primer plano | `FunctionCall` | Vaciados de la caché | `_pdMs` (tiempo propio) |
|---|---|---|---|
| 5.200 cadenas de fecha distintas | 80,3 ms | 4-5 | 33,4 ms |
| Fecha de solo día (1.084 cadenas) | 45,4 ms | 0 | no aparece |
| 3.000 gastos, cadenas distintas | 39,9 ms | 0 | — |

`_pdMs` hacía `clear()` al pasar de 5.000 entradas: cada barrido del histórico la vaciaba a mitad
y el siguiente volvía a parsear todo. El arreglo (dejar de admitir al llenarse) y su guardián están
en el `CHANGELOG` de la 4.26.95 y en `tests/fechas-cache.test.mjs`.

## A/B del arreglo

A = base de beta `819e9312`. B = candidata 4.26.95 (mismos módulos que la entrega). Seis
ejecuciones intercaladas, 8 vueltas a primer plano cada una (48 ventanas), CPU x6, un Chromium por
ejecución, traza sin perfilador y sin otra carga en la máquina.

| Ejecución | Fechas distintas | `FunctionCall` por vuelta | Vueltas con tarea larga | Vaciados | Caché al acabar |
|---|---|---|---|---|---|
| A · 5.200 gastos | 5.200 | 81,1 ms | 8 de 8 | 33 | 2.244 |
| B · 5.200 gastos | 5.200 | 51,7 ms | 3 de 8 | 0 | 5.000 |
| A · 5.200 gastos | 5.200 | 81,3 ms | 8 de 8 | 33 | 2.841 |
| B · 5.200 gastos | 5.200 | 49,1 ms | 2 de 8 | 0 | 5.000 |
| B · 5.200 gastos, solo día | 1.084 | 41,1 ms | 0 de 8 | 0 | 1.084 |
| B · 3.000 gastos | 3.000 | 41,2 ms | 0 de 8 | 0 | 3.000 |

Un 38 % menos de trabajo por vuelta en el caso que fallaba, y la caché deja de vaciarse. Lo que
esta tabla no permite afirmar:

- Que los dos controles no empeoren: no tienen una A equivalente. La referencia más cercana
  (45,4 y 39,9 ms) se midió sobre otra fuente, `main` 8bb0398f.
- Qué fue la vuelta de 128 ms de tarea larga de la primera B: sin vaciado, no se repitió, sin atribuir.
- Que B llegue al caso bueno: se queda en ~50 ms porque las 200 fechas que no caben se parsean siempre.

## Límites, y por qué no se cierra

- Chromium de escritorio frenado no es la WebView de su móvil: sin presión de memoria ni 120 Hz.
- Nube vacía: sin pull real de gastos, sync bancario, avisos entrantes ni widget.
- Estado sintético: reglas, categorías y cuentas reales pueden activar ramas que estos datos no tocan.
- No se ha contado cuántas fechas distintas tiene un histórico real; el arreglo solo se nota por
  encima de 5.000.
- El A/B es sintético y del peor caso (una fecha distinta por gasto); no dice nada del móvil.

Lo que distinguiría su caso: los mismos contadores leídos en su móvil tras un rato de uso real.
