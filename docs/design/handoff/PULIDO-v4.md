# Pulido v4 — tareas EXTRA (aditivas, no rediseño)

> **Contexto para quien lo implemente:** la v4 ya está en producción y funciona. Esto NO es un
> rediseño ni una revisión de arquitectura: es una lista cerrada de micro-detalles de acabado
> encontrados revisando `main` contra `docs/design/handoff/SPEC-v4.md` y el mockup
> `Mi Cartera v2.dc.html`. **Revalidado el 2026-09-09 contra `main` (tree `d9bb5490`): las 14
> tareas y los 5 bonus siguen aplicando sin cambios** — en los 122 commits desde la primera
> revisión no se ha tocado ninguno de estos puntos (`03-tab-dash.js` sigue intacto). Las
> referencias de línea de abajo están actualizadas a ese tree.
>
> Mockup de cómo queda todo aplicado: `Mi Cartera v4 Pulido.dc.html` (3 pantallas — usuario
> nuevo, con datos y sheet Apuntar — con etiquetas P1–P14 que se pueden apagar).
>
> **Se está trabajando en otras cosas en paralelo. Reglas duras:**
> - Solo tocar lo que cita cada tarea (archivo + selector/función). Nada de refactors "de paso".
> - **NO** tocar: `08-motor-bank.js`, `06-sync-brokers.js`, `15-import-hoja.js`, `12-boot.js`,
>   supabase/functions, el carrusel de pestañas ni la lógica de gestos de `11-app-main.js`
>   (`.track`, `freezeShell`, perfil pull-down) ni el gesto vertical de `PlanTab`. Todo eso está
>   afinado a base de medidas: si una tarea de aquí parece pedir tocarlo, se salta y se comenta.
> - Cada tarea es independiente y se puede mergear sola. Ideal: 1 commit por tarea con el id (`P1`…).
> - Sin cifras inventadas: nada de datos de ejemplo ni PII en el repo.
> - Si algo choca con trabajo en curso: dejarlo sin hacer y anotarlo, no forzarlo.

Prioridad: **P1–P4 = el primer minuto de un usuario nuevo** (es lo que más resta ahora mismo).
**P5–P14 = microdetalles premium.**

---

## P1 · El sparkline dibuja una línea plana con 0-1 puntos
`src/modules/02-ui-shared.js` → `Sparkline` (línea 454).
Con `data=[]` y `current=0` pinta una recta de lado a lado con puntito final: parece un gráfico
real vacío. Es lo primero que ve un usuario nuevo.
- `if(pts.length<2) return null;`
- En `03-tab-dash.js`, si no hay sparkline, reservar el hueco con una línea de texto discreta
  (`--muted-2`, 12.5px) tipo «Tu histórico empieza hoy» en vez de dejar un salto de layout.
**Hecho cuando:** app recién instalada = hero sin gráfico y sin hueco raro; con ≥2 puntos, igual que hoy.

## P2 · La pill «↑ +0 € este mes» sale con delta 0
`src/modules/03-tab-dash.js` (bloque `v4-hero`).
Enseñar la pill solo si `tt.delta` es distinto de 0 **o** hay histórico. A 0 no informa de nada y
deja el hero con dos elementos muertos (pill + gráfico plano).

## P3 · Si no eliges presupuesto en el onboarding, Inicio pierde su tarjeta estrella
Inicio la esconde con `state.budget>0 &&` y Gastos enseña `de — / quedan —`.
El campo del onboarding ya **sugiere 700 en placeholder**, así que es fácil pasar de largo y
quedarte sin la mitad del valor de la app.
- Onboarding: dejar el valor sugerido **preseleccionado de verdad** (chip 700 marcado y el input
  con valor, no placeholder), o no permitir avanzar sin elegir uno de los chips.
- Red de seguridad en Inicio: si `budget<=0`, en lugar de esconder la tarjeta, enseñar la misma
  tarjeta en estado vacío con CTA «Ponle un presupuesto» que abre el `BudgetSheet` que ya existe.

## P4 · Estados vacíos del spec §27 (Inicio se queda desnudo)
`03-tab-dash.js`: `upcoming.length>0 &&` y `goals.length>0 &&` esconden los bloques sin más.
Un Inicio recién instalado = hero + «Últimos movimientos» vacío. El spec pedía tarjeta fantasma:
emoji 40px + título Fraunces 20 + una frase + CTA.
- Próximos cargos vacío → «Aún no hay recibos» + «Conecta tu banco» (abre Mis bancos).
- Metas vacío → «Ponte tu primera meta» + CTA a Plan›Metas.
- Reutilizar el borde `dashed` de la card fantasma «+ Nueva meta» que ya existe: cero componentes nuevos.

## P5 · La racha dice «🔥 0 meses sin pasarte»
`03-tab-dash.js`, `v4-budget-foot` con `tf("v4_streak",{n:state.streak||0})`.
Con `n===0` la frase resta. Con 0: esconder la racha o clave nueva `v4_streak_zero`
(«Tu primer mes empieza hoy»). Traducir en los 3 idiomas.

## P6 · El anillo del presupuesto no se dibuja al entrar
`03-tab-dash.js`: el `<circle>` recibe `strokeDashoffset` ya final + `transition:stroke-dashoffset 1s`.
Una transición no anima el primer pintado: el anillo aparece **ya lleno** y se pierde la animación
de 1 s que pide el spec §10 (la misma que sí tiene el count-up del hero, y que él echó de menos
una vez ya con el count-up).
- Montar con `offset = circunferencia` y pasar al valor real en el frame siguiente
  (`requestAnimationFrame`) o con `@keyframes ringdraw` como el mockup.
- Engancharlo al mismo evento `mc-splash-gone` que usa el count-up: si no, se gasta detrás de la cortina.
- `prefers-reduced-motion` → valor final directo.

## P7 · El % dentro del anillo no es Fraunces
`03-tab-dash.js`: va en Manrope 800/18px; en el mockup es **Fraunces 24px/600** con «del mes»
debajo a 10.5px. Es el número más mirado de la app y ahora mismo desentona con el resto de cifras.

## P8 · Teclas del teclado propio a 46px (el spec y el checklist dicen 56)
`src/shell.html` (875) → `.v4-keys button{height:46px}`.
El QA checklist de la v4 se marcó con «teclas 56». Subir a 56 (o 54 si con 56 el sheet no cabe en
un móvil de 667px de alto — comprobar con el teclado abierto y `safe-bottom`).

## P9 · ⌫ sin borrado rápido al mantener pulsado
`14-v4-screens.js` (~línea 599) → `ApuntarSheet.tap`. Estaba en el checklist del spec §30 y quedó
sin hacer.
⚠️ **Ojo, el teclado está duplicado:** el mismo bloque existe en `09-tab-debts-goals.js` (~476 y
~482), con los mismos `keys` y el mismo `tap`. Aplicar P9 y P10 **en los dos** — o mejor, extraer
el teclado a `02-ui-shared.js` como `<NumPad value onChange lang>` y que los dos lo usen (es el
único sitio de esta lista donde vale la pena un pequeño refactor, porque si no, el siguiente
cambio de teclado se vuelve a hacer dos veces). Si se extrae: mismo markup y mismas clases, para
no tocar CSS.
- `pointerdown` → primer borrado, `setTimeout(400)` y luego repetir cada 60-80 ms hasta `pointerup`/
  `pointercancel`/`pointerleave`. Limpiar el timer en `useEffect` de cierre (el sheet se desmonta).
- Un `navigator.vibrate(4)` en el primero, no en cada repetición.

## P10 · La coma decimal está fija en «,» aunque la app esté en inglés
`14-v4-screens.js`: `const keys=["1",…,",","0","⌫"]` y `tap()` compara `ch===","`.
En EN debería ser «.». **Igual que P9, esto está en dos archivos** (ver el aviso de P9).
Sacar el separador de `loc()` /
`(1.1).toLocaleString(loc()).charAt(1)` y usarlo para la **etiqueta** y para el `tap`
(el parseo ya tolera ambos, así que es solo cosmética + coherencia).

## P11 · `focus-visible` solo en la nav
`shell.html`: existe solo en `.botnav-tab` (700) y `.botnav-fab` (708). El spec §11 lo pide en todo lo interactivo.
Añadir una regla común para `.v4-chip, .v4-keys button, .v4-cta, .v4-seg-btn, .v4-link-mini,
.v4-legend-btn, .profile-row, .set-row` con `outline:2px solid var(--mint); outline-offset:2px`.
Un solo bloque CSS, cero JS.

## P12 · Los carruseles de chips no tienen el degradado de borde que sí tiene la tabbar
`shell.html`: `.tabbar-wrap::after` (196) ya hace ese fade a `--bg-2` y queda muy bien. `.v4-chips`,
`.v4-period-more` y `.v4-goals` cortan en seco, así que no se ve que hay más a la derecha.
- Reutilizar el mismo patrón (o `mask-image:linear-gradient(to right,#000 88%,transparent)`).
- `.v4-chips` (859) y `.v4-goals` (808) además les falta `scrollbar-width:none` (lo tienen
  `.chips`, `.cat-select`, `.tabbar` y `.v4-period-more`): en Firefox/desktop asoma barra.
- `.v4-goals` ya tiene `scroll-snap-type`, así que solo le falta el fade + el scrollbar.

## P13 · Tipografía: Fraunces sin `opsz` y frases sin `text-wrap:pretty`
La fuente se carga como variable **opsz 9-144** y no se usa: los números grandes salen con el
tamaño óptico por defecto (trazos finos, menos "impresos").
- `.v4-hero-amt`, `.v4-title`, `.v4-inicio-hi` y los importes hero de las cards:
  `font-variation-settings:"opsz" 40` (hero) / `"opsz" 24` (titulares). Un solo sitio, gran efecto.
- `text-wrap:pretty` en las frases humanas (`.v4-budget-txt .ph`, `.v4-goal` pie, `.v4-ob-sub`,
  subtítulos de `.v4-card`): quita las palabras huérfanas al final de línea. Es gratis y se nota.

## P14 · El hero de Inicio no encoge y el de Gastos sí
`shell.html`: `.v4-hero-amt` (786) sigue a `font-size:56px` fijo, mientras
`.v4-gastos-summary-amount` (732) usa `clamp(22px,8.2vw,40px)` y además se protege con
`white-space:nowrap;overflow:hidden;max-width:100%` — el hero no tiene ni eso. En un móvil de 360px con 6 cifras (`192.148,45 €`) el hero se aprieta
contra los bordes, y con «Letra grande» (root 18px) peor.
- `font-size:clamp(38px,13.5vw,56px)` y revisar a 360px con importe largo + letra grande.

---

## Bonus (mismo criterio, pero decide tú si entra)

- **B1 · Borrar sin red.** El spec §28 pedía toast con «Deshacer» y el copy actual sigue siendo
  «Esto no se puede deshacer.» (`01-i18n.js:68`, `v4_exp_del_sub`). Un `Deshacer` de 5 s en el toast (guardando el gasto borrado en un
  ref) es el detalle que hace que la app se sienta segura. Toca `04-tab-gastos.js` + el toast global:
  si eso está en obras, sáltalo.
- **B2 · Count-up también en el hero de Cartera.** Inicio cuenta y Cartera no, y son la misma cifra.
  Extraer el `useEffect` del count-up de `03-tab-dash.js` a un hook `useCountUp(target)` en
  `02-ui-shared.js` y usarlo en los dos. (Ojo: mantener el arranque en `mc-splash-gone` y el
  "no volver a 0" que ya está resuelto ahí — copiar, no reescribir.)
- **B3 · Filas tappables sin feedback.** `.v4-charge` / `.v4-mov` abren sheet pero no tienen
  `:active`. `transform:scale(.995)` + `background:var(--sur2)` a .12s: es el detalle que
  diferencia "web" de "app".
- **B4 · Skeletons de primera carga** (spec §27): 3 siluetas `--sur2` radius 20 con shimmer
  opacity .6→1, en vez de saltar del splash a ceros. Solo si `mc-splash-gone` ya llegó y la nube
  aún no.
- **B5 · Un vistazo al tema claro.** Todo esto se ha revisado en verde/oscuro. Antes de cerrar,
  pasar Inicio/Gastos/Plan/Cartera en claro buscando mint sobre blanco en texto ≤14px.

---

### Cómo verificarlo (para no romper lo que hay)
1. `prefers-reduced-motion:reduce` → P6 y P1 sin animación, valores finales directos.
2. 360×667 y 430×932, con y sin «Letra grande» (root 18px) → P14, P8, P13.
3. App recién instalada (sin cuentas, sin presupuesto, sin gastos) → P1–P5 y P4.
4. Los guardianes de rendimiento que ya existen deben seguir en verde: nada de esto debe tocar
   montajes ni gestos (si un cambio mueve `Paint`/`Layerize` en un desliz, está mal hecho).
