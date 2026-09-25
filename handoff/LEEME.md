# Entrega — rediseño Aely v4.1

Cuatro ficheros. Ninguno toca código de producción: son el encargo, no el parche.

| Fichero | Qué es |
|---|---|
| `SPEC-v4.1-fichas.md` | **El encargo.** Qué se conserva, qué cambia, en qué fichero y línea. Orden de implementación en §6 y criterios de cierre en §7. |
| `mock-v4.1.html` | **La fuente de verdad visual.** Se abre en cualquier navegador, sin servidor y sin internet. Los ids (`1a`…`2c`) son los que cita la spec. |
| `i18n-v4.1.json` | Claves nuevas en es/en/ca, listas para pegar en `src/modules/01-i18n.js`. |
| `AUDITORIA-v4.1.md` | Contexto y los 10 hallazgos que **no** entran en esta tanda (B3–B10). Leer antes de proponer extras. |

## Cómo empezar

1. Abre `mock-v4.1.html` y mira los pares HOY / NUEVA antes de tocar nada.
2. Lee `SPEC-v4.1-fichas.md` entero (son 300 líneas) y sigue el §6 por orden.
3. Un commit por sección de la spec.

## Restricciones acordadas con el diseño

- **No se toca** el gesto vertical de `PlanTab`, ni `segMounted`, ni el premontaje por `mcScheduleIdle`,
  ni el `content-visibility:hidden` de las capas. Está afinado a base de medir; no se optimiza «de paso».
- **No se toca** nada de `11-app-main.js` (gestos ni montajes).
- Gestionar recibos: **variante A** (pantalla hija, mock `1f`). La B está escrita en la spec solo como
  referencia porque su ficha de recibo se reutiliza en A. No implementar la B.
- §4 (inversiones) entra en `06-sync-brokers.js`, que `PULIDO-v4.md` marca como «no tocar» para pulido.
  Está autorizado para esta tanda, pero **solo render**: no se toca `sellPct`, `save`, `fetchPrices`,
  `invValueEur`, `invCostEur` ni el cálculo de tipos de cambio.
- Sin JSX, sin Babel, sin dependencias nuevas: `React.createElement` directo, como el resto del repo.
- Ningún token, color, radio, sombra ni fuente nueva. Todo lo que aparece en el mock ya existe en
  `src/shell.html`.

## Antes de la primera línea

El trabajo vivo del repo está en `beta`, no en `main`. El mock se leyó de `main`; confirmado por el
autor que lo de `beta` no cambia diseño, pero conviene mirar las zonas tocadas antes de editarlas.

## Medición obligatoria (§2 y §5bis)

Entrar en Plan y tocar «Gestionar», con CPU x6, 5 medianas, antes y después. El objetivo de esta tanda
es que Gestionar deje de ser el punto lento de la app; si el cambio no mejora la medida, algo se hizo mal.
