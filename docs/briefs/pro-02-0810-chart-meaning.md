# PRO-02 · qué dice la gráfica de Inicio

Unidad `pro-02-0810-chart-meaning-grok-local`. Base `8dcc5ed39b6e212ba1e34a90b550685794ce0bd5` (beta 4.26.106.1). Implementación en la rama de esta unidad, sin push a `beta` ni a `main` y sin versión nueva. El backlog antiguo llama PRO-02 a la proyección de fin de mes; esta unidad es solo el significado de la gráfica, como pide el encargo.

## Auditoría

`Sparkline` (`src/modules/02-ui-shared.js`) concatena `data` con `current` si no es null. Con menos de dos puntos no pinta. La escala es el mínimo y el máximo de esos números, estirados al alto del dibujo (70 px, 4 px de margen). Si mínimo y máximo coinciden, el rango vale 1 y la raya queda abajo. No hay eje, fechas ni porcentaje.

Inicio (`src/modules/03-tab-dash.js`) le pasa `state.history` y, como último punto, `totals.netWorth`. Ese total es lo que tienes menos lo que debes (líquido + inversiones + bienes − saldo de deudas), calculado al pintar. No se guarda en `history`.

Escritores de `state.history` en esta base:

| Origen | Qué escribe |
|---|---|
| `buildEmpty` y el estado en blanco de `00-core.js` | `[]` |
| `buildInitial` / `DATA.history` | `[42000, 42150, 42300, 42450, 42600, 42750, 42800]`, semilla sintética, sin día |
| Alta (`Onboarding.finish` en `10-app-components.js`) | `[0]`. Es un cero guardado, no un total medido |
| `seedFlows` | si falta la clave, `[]`. No añade puntos |
| `migrate` | no toca la serie |

No hay otro escritor, ni semilla diaria, ni migración que feche esos números. `invHistory` y el histórico de saldo de una cuenta son otras series, con día, y no alimentan esta gráfica. El histórico de onboarding y el de la semilla no acreditan una serie temporal.

Antes de este cambio, sin puntos se leía «Tu histórico empieza hoy» / «Your history starts today» / «El teu històric comença avui». Con puntos, la raya no decía nada. Eso no explica el origen ni el límite.

## Decisión

Se deja la raya como está (mismos números, mismo total, sin puntos nuevos). Debajo, una frase distinta si hay números guardados o si no los hay. No se toca `Sparkline`: la frase visible es el texto accesible; el dibujo sigue siendo el de siempre.

La frase vacía en castellano conserva «Tu histórico empieza hoy» porque `e2e/pulido-vacios.spec.mjs` lo exige y ese fichero está fuera de esta unidad. La frase siguiente dice el límite.

El índice minificado estaba justo en el tope crudo (1.317.888 bytes, 0 de margen; gzip 403 bytes libres). Para no subir el tope, el castellano de `pt_trb_hint` pierde el tramo del recálculo, el interés y el reanclaje. En `src/` nadie llama `t("pt_trb_hint")`. Inglés y catalán de esa clave no cambian. Si algún día se pinta, el castellano queda más corto que los otros dos.

## Texto final

Sin números guardados:

- es: Tu histórico empieza hoy. Solo el total de ahora: sin fechas y sin ganancia.
- en: Only today's total is here: no dates and no gain.
- ca: Només hi ha el total d'ara: sense dates i sense guany.

Con números guardados (la raya acaba en el total de ahora):

- es: La raya acaba en el total de hoy. Lo anterior no tiene fecha y el dibujo solo compara esas cifras: no es una ganancia.
- en: The line ends at today's total. Earlier figures have no date and the drawing only compares them: it is not a gain.
- ca: La ratlla acaba en el total d'avui. Les xifres anteriors no tenen data i el dibuix només les compara: no és un guany.

## Límites

- No es un diario, un mes, una rentabilidad ni una evolución con fechas. Un cero del alta, al lado del total de ahora, parece una subida y no lo es: la frase lo dice.
- La altura solo separa el mínimo del máximo. Una diferencia pequeña puede verse grande.
- El último punto es el total en euros de la cuenta. La cifra grande puede mostrarse en otra moneda; la raya no se convierte.
- No se guardan snapshots nuevos. Los saldos y `history` no se reescriben al abrir Inicio.
- Margen medido tras el cambio, con el sello sintético del presupuesto: crudo 39 bytes, gzip 417 bytes. Topes 1287 KiB y 351 KiB, sin tocarlos.
