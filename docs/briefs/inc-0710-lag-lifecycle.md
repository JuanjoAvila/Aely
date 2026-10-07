# INC-2709-09 · auditoría de ciclo de vida de listeners · 7/10/2026

Encargo `inc-0710-lag-lifecycle-claude`, base `5fa2350b4dc567d936091039e62f9dd732a67110`.
**INC-2709-09 sigue abierto y la causa del lag, unknown.** Esto es un fallo real pero acotado;
no se presenta como la causa del síntoma ni como cierre. Sin bump, publicación, APK, Edge, SQL
ni datos reales.

## Matriz de hipótesis (auditoría estática de 00/10/11/12 + doble de transporte)

| Suscripción / timer | Alta | Baja | Veredicto |
|---|---|---|---|
| `visibilitychange`, `online/offline`, `resize`, `mc-*`, `error/unhandledrejection`, `scrollend`, `pagehide`, `touch*` (perfil, hoja, barra) | efectos con `[]`/`[uid]` | cleanup simétrico | falsada: pareados |
| `setInterval` de OTA (30 min, 10-app-components) | efecto | `clearInterval` | falsada |
| `cloud.onAuth` (`onAuthStateChange`) | efecto `[]`, una vez por montaje | sin `unsubscribe` | sin acumulación observable: App no se remonta; deuda menor, no tocada |
| `backButton` y `bankNotif` de Capacitor | efecto | `remove()` vía promesa | falsada con el doble: constantes tras 6 cambios de sesión |
| **`appStateChange` del efecto de `uid` (11-app-main)** | efecto `[uid]` | `sub.remove` sobre una **Promesa** (no existe) | **CONFIRMADA**: un listener más por cambio de sesión |
| Service Worker (`controllerchange`, `updatefound`) | arranque | una vez | falsada (una sola alta por carga) |

## Bug reproducido

`A.addListener()` de Capacitor devuelve una promesa. El cleanup del efecto de `[uid]` leía
`sub.remove` de ella: no liberaba nada. Cada login/logout/cambio de usuario dejaba otro listener
`appStateChange`, y cada uno ejecutaba `onVis()` (`syncCloudExpenses`, ping de notis, calendario)
al volver a primer plano. Se alinea con el patrón ya usado en los otros dos efectos
(`disposed` + `Promise.resolve(...).then(h => h.remove())`).

Repro: `e2e/lifecycle-listeners.spec.mjs` (CROSSCUTTING). Doble de `Capacitor.Plugins.App/MiCartera`
que cuenta listeners vivos y cliente Supabase doble que dispara 6 cambios de usuario.
Antes: `appStateChange` 2 → 8 (rojo). Después: constante, spec verde.

## Límites

Solo APK/WebView nativa (en web no existe `Capacitor`). Crecimiento lineal con cambios de
sesión, no con el uso continuo: **no explica por sí solo un lag tras horas de uso sin
cerrar sesión**. Sin A/B de rendimiento ni WebView real. Próximo escenario específico para la
causa del lag: sesión larga en dispositivo con APK, contando listeners/handlers de
`appStateChange` y duración de `onVis` por vuelta a primer plano.
