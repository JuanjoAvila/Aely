# Brief Claude personal — destello temporada (Mi Cartera)

> ## ✅✅ CERRADO EL 2026-08-18 — aprobado por él EN LA APK, no solo en Chrome
>
> *«se subió bien y ya no hay lo negro… y va fluidísima toda la app, solo con eso iría 20 de 10 en
> fluidez»* — 4.18.5.
>
> **Causa:** el «refuerzo opaco» del gesto pintaba `.page` con el fondo **plano** `var(--bg)` y eso
> tapaba el `radial-gradient(… at 85% -8% …)` del **`body`**. −16 niveles de luminancia arriba a la
> derecha, −8 a la izquierda; 12 gestos de 12 a 120 fps. La **proporción** entre esos dos números es
> la forma del degradado, y fue lo que lo delató.
>
> **Por qué duró nueve intentos:** el degradado es del **tema base**, no de temporada. Se veía
> también con Temática Ninguna, y todos los intentos anteriores tocaban `.season-glow` — que nunca
> fue el culpable. Por eso «se arreglaba» y volvía.
>
> ### ⬜ LO QUE QUEDA: el «stopper» al scrollear
>
> **Es otro bicho, y él confirma que YA VENÍA DE ANTES.** Lo que se ganó el 18/8 es **separarlo del
> parpadeo**: hasta esa noche se vivían como el mismo fallo, y por eso ninguno se dejaba cazar.
> No hay diagnóstico aún. Empezar por reproducirlo en el entorno de abajo.
>
> ### 🛠 EL ENTORNO EN VIVO — móntalo antes de tocar nada (11 min → segundos por hipótesis)
>
> Lo que hizo posible cerrar esto. Sin él, cada hipótesis costaba: commit → CI 11 min → él actualiza
> → graba vídeo → analizar. Con él: cambias CSS y lo ve al instante.
>
> ```bash
> # 1) servir el bundle (o preview_start con la config "micartera" de .claude/launch.json)
> npx serve public -l 4173
> # 2) que el móvil vea el portátil, y que el portátil vea el Chrome del móvil
> adb reverse tcp:4173 tcp:4173
> adb forward tcp:9222 localabstract:chrome_devtools_remote
> # 3) en el móvil: Chrome → localhost:4173     (CDP queda en http://127.0.0.1:9222/json/list)
> ```
>
> ⚠ **Trampas del entorno, todas pisadas el 18/8:**
> - **El Service Worker sirve la copia vieja.** Una recarga normal NO trae tu cambio y parece que el
>   arreglo no funciona. Desregistrar SW + `caches.delete()` antes de dar nada por bueno.
> - **La app de release no tiene CDP** (`MICARTERA_WEBDEBUG` está apagado a propósito). Por eso se
>   prueba en **Chrome**, no en la WebView. El veredicto final, siempre en la APK.
> - **CDP `Page.screencast` NO capta el parpadeo** (pico −2,8 contra −16 reales): fotografía lo que
>   la página dibuja, no lo que el compositor pinta. Para medir hace falta el **grabador nativo** del
>   móvil a 120 fps + `ffmpeg`. Para iterar hipótesis, basta el ojo de él.
> - **No cites reglas CSS literales en los comentarios**: el guardián de `season-detalle` y los
>   `grep` las encuentran en el comentario y creen que el código sigue ahí. Costó una vuelta en falso.


> ## ✅ MEDIDO Y CARACTERIZADO — 2026-08-18, en su móvil real
>
> ### ⚠ ANTES DE NADA: NUNCA FUE UN OPPO
>
> Su móvil es un **OnePlus 13 (CPH2653)**, **Android 16**, OxygenOS **V16.1.0**, WebView
> **Chromium 150.0.7871.181**. Siempre lo fue. Todo este brief (y ~35 sitios del repo, incluidos
> comentarios en `src/shell.html`, `11-app-main.js` y `02-ui-shared.js`) dice «Oppo» / «ColorOS»,
> y es **falso**. Se dio por hecho —probablemente por el `OplusTransitionAnimationManager`, que es
> común a OPPO/OnePlus/realme— y **nadie lo comprobó nunca**, cuando comprobarlo era
> `adb shell getprop ro.product.brand`. Hipótesis descartadas «con evidencia» se razonaron contra
> el sistema equivocado. Corregir las menciones al tocar cada fichero.
>
> ### La firma del parpadeo, medida
>
> Vídeo del grabador nativo a **120 fps**, 3.047 frames, 25 s, con él haciendo muchos cambios de
> pestaña. Método: cada región se reduce a un píxel promedio por frame (`ffmpeg crop+scale=1:1`),
> y se buscan frames que se salgan de la mediana local (detector de picos aislados).
>
> **12 eventos en 25 s. Uno por cada arranque de gesto de pestañas. 12 de 12.**
>
> | | Valor |
> |---|---|
> | Signo | **Siempre oscurece**, nunca ilumina (12/12) |
> | Duración | **8–25 ms** = 1–3 frames a 120 Hz |
> | Esquina del destello (sup-der) | **−16,0 a −17,2** niveles de luminancia |
> | Fondo (sup-izq) | **−8,2 a −8,9** |
> | Movimiento en pantalla justo antes | **0,00** — la pantalla está QUIETA |
>
> Dos cosas que esto demuestra:
>
> 1. **Oscurece el doble donde vive el destello que donde no.** No es la pantalla bajando de
>    brillo: es **algo que aportaba luz y desaparece un frame**, y ese algo tiene la forma del glow.
> 2. **Ocurre ANTES de que nada se mueva.** No es el desliz ni el compositor arrastrando: es el
>    instante en que se decide que el gesto es «tab» → `leaveScrollHost()`
>    ([11-app-main.js:2034](../../src/modules/11-app-main.js#L2034), llamado desde
>    [:2268](../../src/modules/11-app-main.js#L2268)), donde en un solo bloque síncrono se quita
>    `page-scroll-host` (destruye una capa `position:fixed`), se saca el track de
>    `scroll-host-park` (`will-change:auto` → `transform`, crea capa) y las hermanas dejan de
>    estar `visibility:hidden` con `content-visibility:auto` sin pintar.
>
> ### Descartado con evidencia en esta sesión (no volver a proponer)
>
> 10. **El tono del notch / barra de estado** — `36,36,25` **constante** en 110 capturas, incluidas
>     las de transición. **No se reproduce.** La queja de la .12 está resuelta.
> 11. **Que el cambio de modo apague el glow de forma sostenida** — con el **gesto congelado** (dedo
>     puesto, 67 frames estables) el fondo es **idéntico** al reposo, Δ = 0. El efecto es
>     **puramente transitorio**: 1–3 frames y vuelve solo. Cualquier arreglo que ataque el estado
>     estable está atacando algo que no está roto.
> 12. **`screencap` para cazar esto** — saca ~2 fotogramas/s contra un efecto de 8 ms. Imposible por
>     construcción. Hace falta vídeo a 120 fps. (Y `adb shell screenrecord` está **bloqueado** en su
>     Android 16: «Permission denied» en `/sdcard` y en `/data/local/tmp`, y a stdout se cuelga →
>     usar el **grabador nativo** del móvil y sacar el fichero de `/sdcard/Movies`.)
>
> ⚠ **Trampa en la que YO caí y que hay que evitar** (es la lección de
> [`season-destello-saga`](../memoria/season-destello-saga.md), otra vez): medir una región fija
> mientras el contenido se desplaza por debajo **mide el contenido, no el efecto**. Una primera
> tanda dio «±13 niveles» que resultaron ser la cabecera de Gastos entrando en el recuadro. Solo
> valen: (a) el **gesto congelado**, o (b) regiones que son **fondo puro en las dos pestañas**.
>
> ### Arreglo candidato — SIN PROBAR
>
> Pagar el peaje **un paso antes**: promover la capa y despertar a las hermanas en el `touchstart`,
> no en el `touchmove` que decide el eje. Si la capa ya existe cuando llega el cambio de modo, no
> hay frame perdido. Es la misma jugada ya medida y documentada para los segmentos de Plan en
> [`shell.html:511`](../../src/shell.html#L511): *«el coste existe; lo único que se puede elegir es
> CUÁNDO se paga»*.
>
> **Criterio de verde, ya medible:** repetir el vídeo a 120 fps y que los 12 picos de −16 bajen de
> −4. Antes/después con el mismo método, o no vale.


> ## ⚠ LEE ESTO ANTES DE PEGARLO (añadido 2026-08-17)
>
> **Este brief se escribió el 2026-08-05 contra `beta` en 4.15.0.12. La mitad de su «estado» ya
> es falso.** Lo que sigue valiendo es el **forense**; lo que hay que ignorar es el **punto de
> partida**.
>
> | Lo que dice el brief | Lo que hay de verdad hoy |
> |---|---|
> | «Tip remoto (roto): `3f9d6572` → 4.15.0.12» | Producción y `beta` van por **4.18.3**. Ese commit es de hace 13 días. |
> | «Hay cambios **sin commit** de un intento .13 — NO descartar a ciegas» | **No existen.** El árbol está limpio. No busques ese WIP. |
> | «Cómo empezar: `git diff src/shell.html src/modules/11-app-main.js`» | Devolverá vacío. |
> | «Done criteria 7: CI stamp **4.15.0.13+**» | Sería un bump hacia atrás. Parte de `VERSION` real. |
> | El .12 dejó al usuario furioso, sin arreglar | **Se arregló y él lo aprobó.** El 6/8 a las 00:14, en 4.15.0.19, cinco tandas de season con **0 fallos**: `fix-season-portal` («Destello y barra — arreglo definitivo», 3 ok), `fix-season-glow-steady` («Destello que no cambia nunca», 9 ok), `fix-season-glow`, `fix-season-glow-soft`, `fix-season-tabs` («Pestañas sin mezclarse», 4 ok). Compruébalo tú: `node scripts/errores.mjs --kind=beta`. |
>
> **Entonces, ¿qué es la tanda 8?** Una queja **posterior y distinta**, de la vuelta del crucero
> (commits `2babedb2` y `aeec4ad9`, 6/8 por la noche, en
> [`brief-crucero-verificar-pages.md`](brief-crucero-verificar-pages.md)):
>
> 1. **Parpadeo al cambiar de pestaña** en 4.15+ — se nota MÁS con temporada, **pero también sin**.
>    **CONFIRMADO 18/8 por él:** también pasa con Temática **Ninguna**. No toques season a ciegas:
>    es compositor / WebView.
> 2. **Capa negra al tirar de Cartera más a la derecha** (overscroll) — sospecha del clamp del
>    gesto al volver.
>
> Misma familia (host transparente / compositing del WebView), **no el mismo bug** que el flash
> del .12. No empieces reproduciendo el .12: ya no pasa.
>
> **Lo que de este brief sigue siendo oro y hay que leer entero:** la línea temporal de intentos,
> los **9 descartados con evidencia** (sobre todo el 5: host transparente → Inicio+Gastos
> solapados), las causas reales demostradas, y las trampas de ADB/CDP (el `>` de PowerShell
> corrompe el PNG; `adb shell input swipe` no dispara el gesto de tabs). Eso no ha caducado.
>
> Y ojo con la lección de [`season-destello-saga`](../memoria/season-destello-saga.md): el Δ del
> píxel a secas mide el CONTENIDO, no el efecto. Hay que congelar el gesto con el dedo puesto y
> restar dos capturas.

**Modelo:** Claude **Opus** a potencia **alta / Ultra** (Code max si lo tienes).  
No uses Sonnet para esto: ya hubo varios “fixes” que pasaron tests/CSS y fallaron en el Oppo. Necesita razonar compositing WebView + no inventar otra cinta.  
**No uses fable.**

**Repo:** `E:/Mi cartera`  
**Rama:** `beta`  
**Tip remoto (roto en el móvil):** `3f9d6572` → stamp **4.15.0.12**  
**Referencia buena parcial:** `7c40d2fa` → **4.15.0.11** (barra OK + destello siempre visible; flash al scroll)  
**Anterior insuficiente:** `f589f89c` → **4.15.0.9** (solo subió opacidad + `nav-sin-blur` sólido; usuario dijo «sigue pasando ambos»)

Lee `AGENTS.md` entero. Edita `src/modules/*` + `src/shell.html`, luego `npm run build`. No edites `public/index.html` a mano como fuente. Push solo a **`beta`**. Textos en es/en/ca cristiano. Diálogos propios, no `alert`.

---

## Qué quiere el usuario (hoy)

1. **Barra inferior:** ya OK en .11 — lista NO se ve a través. **No regresionar.** `.botnav` fondo sólido `var(--bg-2)`, no `color-mix(88%, transparent)`.
2. **Destello:** suave, esquina arriba-derecha, **siempre** (en reposo está bien).  
   - NO más intenso que .11 en reposo.  
   - NO intensificar al scrollear.  
   - NO desaparecer al scrollear (.12 hizo esto y le cabreó).
3. **Notch / iconos junto a la cámara frontal:** mismo tono que el resto de la app (`var(--bg)`).  
   La cinta opaca de .12 dejó una franja oliva distinta → **inaceptable**.

Cita usuario sobre .12: «no solo le has agregado mas destello… cuando scrolleas no hay destello y me has jodido la parte de arriba de donde estan los iconos al lado de la camara… no se ve del mismo tono».

---

## WIP local (ya en el working tree — NO descartar a ciegas)

Hay cambios **sin commit** de un intento .13 a medias. Revísalos y completa/corrige con evidencia; no ignores el diff:

- `src/shell.html` — portal `z-index:34` (detrás del host 35); glow otra vez 38vh translúcido con `seasonglow`; host con `background-clip:content-box` (padding deja ver el portal); **quitado** horneado `html[data-season] .page-scroll-host{background:glow,bg}`.
- `src/modules/11-app-main.js` — comentarios actualizados; portal sigue a `document.body`.
- `tests/season-detalle.test.mjs`, `CHANGELOG.md`, `src/modules/10-app-components.js`, `public/index.html` (build).

**Hipótesis del WIP:** glow detrás del host + `background-clip:content-box` para que el padding muestre el destello fijo sin mezclar overlay encima del contenido que scrollea, y sin cinta en la status bar.

**Riesgos a verificar en dispositivo ANTES de cantar victoria:**
- ¿El padding del host deja ver glow o solo `body`/`--bg`?
- ¿La zona de la cámara sigue siendo solo `--bg`? (muestrear píxeles junto a iconos vs chrome abajo)
- ¿Al scrollear Δ RGB esquina ≈ 0–3? (antes .11 ~+30; .12 glow tapado por cards)
- ¿`background-clip:content-box` no abre agujeros raros / solapamiento de tabs? (hubo incidente: host transparente → Inicio+Gastos a la vez; el área de contenido del host DEBE seguir opaca `var(--bg)`)

Si el WIP no aguanta píxeles en el Oppo, cámbialo; no te cases con él.

También hay basura untracked en `tools/movil/_*.png` / scripts tmp — ignorar o no commitear.

Regla nueva (dejar): `.cursor/rules/claude-personal.mdc` (flujo Cursor↔Claude personal).

---

## Línea temporal de intentos (no repetir)

| Stamp / commit | Qué hizo | Resultado real en Oppo |
|---|---|---|
| `.9` `f589f89c` | `nav-sin-blur` + `background:var(--bg-2)`; subió alfas glow `.3–.42` | Usuario: **siguen ambos** problemas |
| `.11` `7c40d2fa` | Portal a `body` fuera de `#root`; `.botnav` siempre opaco; glow 38vh z-36 encima | **Barra OK.** Glow siempre visible (bien). Al scroll **flash** (~+23–33 RGB): contenido mint bajo overlay translúcido |
| `.12` `3f9d6572` | Cinta opaca `height:calc(safe-top+8)`; gradient horneado en host; sin animación opacity | **Notch otro tono.** Más glow pasivo. Al scroll glow **desaparece** (cards tapan fondo del host). Usuario furioso |

### Descartado con evidencia (no volver a probar como “fix”)

1. **Confiar en `getComputedStyle` `position:fixed` / `top:0`** — en .9 medía fixed y el píxel igual saltaba (glow dentro de `#root{position:relative}`).
2. **Solo subir opacidad / gradientes** — no arregla scroll-link ni flash.
3. **Congelar `seasonglow` / ocultar partículas** — el salto RGB al scroll **seguía**; animación y `.season-amb` NO eran la causa del flash.
4. **`html::before` como glow** — mismo mentiroso fixed-pero-scroll-linked.
5. **Host / page background transparente** para “ver” atmósfera — **Inicio+Gastos solapados**. Host content area SIEMPRE opaca `var(--bg)`.
6. **Cinta opaca corta en safe-area** (.12) — rompe tono notch; glow muere al scroll.
7. **Hornear `--season-glow-top` en `.page-scroll-host` background** (.12) — mismo: se tapa al scrollear; tiñe chrome.
8. **PowerShell `>` redirect de `adb exec-out screencap`** — PNG corrupto. Usar:  
   `cmd /c "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe exec-out screencap -p > tools\movil\_x.png"`
9. **`adb shell input swipe`** a veces no dispara el gesto de tabs de la app — usar CDP `Input.dispatchTouchEvent` / scripts en `tools/movil/cdp-swipe.mjs`, `verify-season-fix.mjs`, `png-pixel.mjs`.

### Causas reales ya demostradas

- **Lista tras barra al swipe:** `.nav-sin-blur` quitaba blur y dejaba el 12% transparente del botnav por defecto. Fix: sólido siempre (conservar).
- **Glow “aparece/desaparece” con scroll cuando vivía en `#root`:** compositor WebView Oppo liga fixed al scroll host.
- **Flash .11:** overlay translúcido **encima** del contenido; al pasar gráfico/cards el composite se aclara.
- **Glow se apaga .12:** ambiente en **fondo** del host → cards opacas lo cubren.

---

## Archivos clave

- `src/shell.html` — `.season-portal`, `.season-glow`, `--season-glow-top`, `.page-scroll-host`, `.botnav`, `nav-sin-blur`
- `src/modules/11-app-main.js` — `ReactDOM.createPortal(..., document.body)` + `season-portal`
- `tests/season-detalle.test.mjs` — guardas portal / botnav opaco / no cinta mala
- Package móvil: `com.micartera.app` (Oppo)

---

## Done criteria (obligatorio con capturas)

1. Píxel junto a iconos de status ≈ píxel chrome app (`var(--bg)`), Δ pequeño.
2. Top-right glow rest vs scroll mid: Δ RGB **≤ ~3** (no flash, no apagado).
3. Glow visible en reposo (temática Verano), sin ser más agresivo que .11.
4. Swipe tabs: botnav sólido (no se ve lista).
5. No solape Inicio+Gastos.
6. `npm run build` + `npm test` (o al menos season + syntax).
7. Commit + push `origin/beta` → CI stamp **4.15.0.13+**.
8. Usuario verifica: Mis bancos → sello nuevo; notch OK; scroll estable; barra OK.

---

## Cómo empezar

```text
cd "E:/Mi cartera"
git status
git diff src/shell.html src/modules/11-app-main.js
```

Revisa el WIP .13; mide en el Oppo; si falla, itera. No publiques otro “fix” sin píxeles ADB.
