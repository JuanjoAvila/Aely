# UX-01 — el «tironcillo» al pasar de pestaña, medido en su móvil

**10 de septiembre de 2026.** Con su OnePlus 13 enchufado, su gesto y su temática. Hasta hoy el
backlog decía «sin reproducción actual»; ya no.

## Qué dijo él, y por qué importa la literalidad

> «recuerda de arreglar el tironcillo que aun hay al scrollear»
> «**es solo al scrollear recuerda de una tab a otra**»
> «**se nota mas con tematicas el tironcillo**»
> «igualmente yo lo veia y reproducia...»

La segunda frase es la que salva la investigación: **no es la lista, es el paso de una pestaña a
otra**. Es exactamente la trampa de `[[feedback-scrollear-puede-ser-entre-pestanas]]`, por la que
ya se publicaron tres builds «arregladas» midiendo el gesto que no fallaba.

## Lo que NO es (medido, no supuesto)

Con la APK `.debug` (mismo nativo que la suya: **42 / 4.18.3**), su dedo, temática Navidad y una
cartera de 2.500 gastos —más gorda que la suya—:

| | frames | mediana | peor | >17 ms | >32 ms |
|---|---|---|---|---|---|
| Todo (20 gestos, dedo real) | 6.046 | 8,3 ms | 16,7 ms | **0** | **0** |
| Solo con el dedo + inercia | 3.571 | 8,3 ms | 16,7 ms | **0** | **0** |

**Ni un solo frame perdido.** 120 Hz clavados. Y `longtask`: **0**. Así que:

- **no es rendimiento de pintado** ni el hilo principal bloqueado;
- **medir con deltas de `rAF` no distingue su caso bueno del malo**, así que seguir midiendo así
  habría llevado otra vez a un arreglo inventado.

Y el A/B de la temática, con 8 gestos por lado:

| temática | retraso de entrada p95 | saltos de maquetación |
|---|---|---|
| ninguna | 15,2 ms | 16 (suma 3,807) |
| Navidad (10 adornos) | 14,5 ms | 16 (suma 3,806) |

**La temática NO empeora nada.** Su percepción sigue siendo correcta, pero por otro motivo: ver
más abajo.

## Lo que SÍ es

`PerformanceObserver` de `layout-shift` durante 10 cambios de pestaña, con los nodos culpables:

```
   2.377  ×10  div.page.page-live      y:44→44   alto:748→748   (movimiento horizontal)
   2.145  × 5  div.v4-screen           y:94→50   alto:698→742   (salto de 44 px)
```

**El contenido salta 44 píxeles en la mitad de los cambios de pestaña.** Y 44 px es exactamente el
hueco de la barra de estado.

La causa está en `src/shell.html`, y el propio comentario del fichero la anuncia:

- `.page` normal → `padding: 6px 18px …`, `position: relative`. Cuelga dentro de `.app`, que ya
  lleva `padding-top: calc(var(--safe-top) + 4px)`.
- `.page.page-scroll-host` → `position: fixed` + `padding-top: calc(var(--safe-top) + 10px)`,
  porque al ser `fixed` se sale de `.app` y tiene que ponerse el hueco él mismo.
- Y esa clase **se quita y se pone en CADA cambio de pestaña** («esta clase se QUITA al deslizar
  entre pestañas», comentario del build .12).

O sea que en cada gesto se cambian a la vez `position` (fixed ↔ relative) y `padding-top`
(50 px ↔ 6 px). En reposo la cuenta cuadra —44 + 6 = 50— pero **no siempre caen en el mismo
frame**: cuando no coinciden, el contenido se dibuja a 94 o a 6 durante uno o dos frames y luego
salta a 50. Muestreado frame a frame:

```
   -9 ms   0:y50/pt50/fix/HOST | 1:y50/pt6/rel | …
  728 ms   0:y50/pt6/rel      | 1:y50/pt6/rel | …
 1334 ms   0:y50/pt6/rel      | 1:y50/pt50/fix/HOST | …
```

## Por qué se nota más con temáticas, y por qué él tenía razón

La temática **no hace el salto más grande** (medido arriba: idéntico). Lo hace **más visible**: con
un fondo decorado y quieto detrás de las cartillas, un salto de 44 px del contenido tiene una
referencia fija con la que compararse. Sin temática, el fondo es plano y el ojo no tiene contra qué
medirlo. Las dos cosas son verdad a la vez: su observación y el A/B.

## Qué hay que arreglar (y qué NO tocar)

El objetivo es que **entrar y salir de `page-scroll-host` no cambie ni un píxel de geometría**, de
modo que dé igual en qué frame caiga cada mitad del cambio. La vía más limpia es que el hueco de la
barra de estado lo ponga **siempre el mismo elemento**, y que la clase solo cambie `position`.

⚠ Ese CSS tiene mucha historia y cada línea tiene su incidente detrás. Antes de tocar, leer los
comentarios de `src/shell.html` alrededor de `.page-scroll-host`:

- **nada de gradiente** en esa clase (build .12): se apagaba el destello en pleno gesto;
- **fondo opaco siempre** (incidente 2026-08-05): transparente → Inicio y Gastos a la vez;
- el `safe-top` está ahí por un feedback suyo del 5/8: sin él, «Tus gastos» se metía debajo de la
  barra de estado;
- `.track.scroll-host-park .page:not(.page-scroll-host){visibility:hidden}` depende de la misma
  clase.

**No publicar sin volver a medir con este mismo método**: `layout-shift` con nodos, en su móvil.
Los deltas de `rAF` no sirven para este fallo — ya está demostrado arriba.

## Cómo repetir la medida

1. APK `.debug` instalada (mismo nativo, datos aparte: **no toca su cartera**).
2. `adb forward tcp:9223 localabstract:webview_devtools_remote_<pid>`.
3. `PerformanceObserver` de `layout-shift` con `sources`, y gestos REALES
   (`adb shell input swipe`, o su dedo para el caso con inercia).
4. ⚠ `dumpsys gfxinfo` miente en WebView y grabar una traza de Chromium provoca el tirón que
   buscas ([[depurar-webview-en-su-movil]]).

## Pendiente

- La app `.debug` corre la web **4.19.19**, no la beta **4.19.27** que tiene él. El nativo sí es el
  mismo. Falta repetir la medida con el bundle de beta: entre medias entró el count-up de Cartera
  (B2, 4.19.22), que se dispara **justo al llegar** a esa pestaña y es sospechoso de sumar lo suyo.
