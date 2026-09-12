<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (aely-el-nombre-oficial.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: aely-el-nombre-oficial
description: "La app YA NO se llama Mi Cartera — se llama Aely (10/9/2026), con brief de marca cerrado; y la línea roja del applicationId"
metadata: 
  node_type: memory
  type: project
  originSessionId: b6deade9-918e-4072-8b0e-1d259d1e48ca
  modified: 2026-09-10T19:21:47.064Z
---

**La app se llama AELY.** Decisión suya del 10 de septiembre de 2026, con estas palabras:
«renombre de mi app con nombre ya OFICIAL se llama Aely!!!!!». No es una idea a valorar: está
decidido. El nombre viejo, «Mi Cartera», se sustituye en UI, títulos, strings y metadata.

Brief cerrado en el repo: `docs/design/aely/AELY_BRAND_BRIEF.md`. Lo trajo hecho (lo generó con
Grok) y **dice literalmente «no inventes otra identidad: aplica exactamente esto»** — así que aquí
no se proponen alternativas, se aplica.

- Icono **A-Dot Badge**: una A geométrica en menta cuyo travesaño es un **punto** circular, dentro
  de un marco rounded-square. Menta `#6CC688` sobre fondo forestal oscuro.
- Header del onboarding: **lockup** = badge + «Aely» a la derecha, en blanco roto `#E8EEEC`.
- **SIN mascota**, ni icono ni splash. El brief lo dice dos veces.
- Tokens: `bg #0B140F`, `surface #132119`, `accent #6CC688`, `text #FFFFFF`, `textMuted #A7B3AD`,
  `border #1C2A22`, `danger #E85D4C`, `success #2BB673`.
- Serif moderna para saludos editoriales, sans geométrica para UI, botones pill.

## ⚠ La línea roja: el `applicationId` NO se toca

Cambiarlo instala una app **nueva**: su padre y su pareja se quedarían con la vieja y sus datos
dentro, sin migración. El rebrand no vale eso. Se cambia el nombre visible (`android:label`), nunca
el id del paquete.

## Y no todo viaja igual — por eso va en tres tandas

| | Qué | Cómo llega |
|---|---|---|
| **A** | strings, lockup del onboarding, tokens de color | por **beta OTA**, es lo que puede probar ya |
| **B** | icono, splash, `android:label` | necesita **APK nueva** y su OK ([[ota-no-cambia-contrato-nativo]]) |
| **C** | dominio, Pages, metadata de release | más adelante |

Su orden de ataque, literal: «Empieza por strings + header del onboarding + icono/splash».

Backlog: **BRAND-01**, P1. Repartido a Cursor el 10/9 (Tanda A autorizada; B y C esperan su OK).
Faltan los dos PNG de referencia (`aely-icon-adot-badge.png`, `aely-wordmark-lockup.png`) en
`docs/design/aely/`: los pasó por el chat y ahí no se pueden guardar.

⚠ Al cambiar el nombre, acordarse de los textos que lee **la familia**: notas de versión y popup
de Novedades ([[feedback-release-notes-siempre]]). Dejar «Aely» a medias sería peor que no
empezar.
