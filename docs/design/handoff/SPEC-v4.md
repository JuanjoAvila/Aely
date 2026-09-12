# Aely v4.0 — Especificación de rediseño

> Guía de implementación para Cursor/Claude Code sobre el repo `JuanjoAvila/Aely`.
> El mockup de referencia es `Aely v2.dc.html` (este proyecto). Todo lo que diga esta guía está ya resuelto visualmente ahí: **ante cualquier duda, el mockup manda**.

---

## 0. Resumen ejecutivo

La v4 pasa de **9 tabs + drawer** a **5 destinos**, reduce el Resumen de ~12 cards a **5 bloques**, introduce un **botón central «Apuntar»** con teclado propio, y define un **sistema de motion sutil** (200–950 ms, una sola curva). La identidad se mantiene (verde menta + Manrope/Fraunces) pero con jerarquía tipográfica mucho más marcada y menos ruido.

Reglas de oro:
1. Una pantalla = una pregunta del usuario. Inicio responde «¿cómo voy?», Gastos «¿en qué se me va?», Plan «¿qué viene / qué debo / qué ahorro?», Cartera «¿cuánto tengo?».
2. Nada de jerga por defecto: «Patrimonio neto» solo si Modo sencillo está OFF (en sencillo: «Tu dinero en total»).
3. Todo target táctil ≥ 44 px. Texto base 16 px. Números importantes en Fraunces.
4. Motion: sutil, rápido, y **siempre** respetando `prefers-reduced-motion`.

---

## 1. Design tokens

```css
:root{
  --bg:#0A1310; --bg2:#0E1A15; --sur:#12211A; --sur2:#17291F;
  --line:#1E362A; --line-soft:#16291F;
  --mint:#5FD08A; --mint-hi:#8CEFB0; --mint-deep:#2F6B4A; --on-mint:#06120C;
  --blue:#7FB5E8; --tan:#E6C36A; --coral:#E2705F; --cream:#F4EFE2;
  --text:#EAF2EC; --muted:#93AC9E; --muted2:#5E7468;
  --shadow:0 20px 44px -26px rgba(0,0,0,.75);
  --ease:cubic-bezier(.22,.61,.36,1);      /* curva por defecto */
  --spring:cubic-bezier(.3,1.25,.5,1);     /* solo nav indicator, FAB y sheets */
}
/* Tema oscuro neutro */
html[data-theme="dark"]{ --bg:#0A0A0C; --bg2:#131316; --sur:#17171B; --sur2:#1F1F25;
  --line:#2A2A31; --line-soft:#222228; --text:#ECECEF; --muted:#9A9AA4; --muted2:#66666F; }
/* Tema claro (contraste AA revisado) */
html[data-theme="light"]{ --bg:#F2F6F2; --bg2:#FFFFFF; --sur:#FFFFFF; --sur2:#ECF2EC;
  --line:#D9E3DA; --line-soft:#E5ECE5; --mint:#249A5B; --mint-hi:#2FB56E; --mint-deep:#A8DDBE;
  --on-mint:#FFFFFF; --blue:#3E80C8; --tan:#B8890F; --coral:#CE4F37; --cream:#5E5228;
  --text:#141F18; --muted:#53685B; --muted2:#8A988F; --shadow:0 16px 34px -24px rgba(20,40,30,.35); }
```

Fondo del body (da el aire "premium", no quitar):
```css
body{ background:
  radial-gradient(120% 50% at 80% -5%, rgba(95,208,138,.11), transparent 60%),
  radial-gradient(90% 45% at -10% 0%, rgba(127,181,232,.05), transparent 55%),
  var(--bg); }
```

### Tipografía
- **Manrope** (variable 200–800): todo el UI. Base 16 px / line-height 1.5.
- **Fraunces** (variable, opsz auto): cifras protagonistas, titulares de pantalla y saludo.
- Escala: hero 56 px (patrimonio Inicio) · card-hero 38–40 px · titular pantalla 26 px · título card 21 px · cifra fila 16–17 px · cuerpo 14.5–15.5 px · meta 12.5 px · micro 10–12 px (solo uppercase labels).
- Números siempre `font-variant-numeric:tabular-nums`.
- Letra grande (ajuste): `html{font-size:18px}` — todo escala por `rem` implícito. (En el código actual los px son fijos: migrar los font-size de texto corrido a rem al implementar.)

### Superficies
- Card grande: `linear-gradient(180deg,var(--sur),var(--bg2))` + `border:1px solid var(--line-soft)` + `border-radius:20–24px` + `--shadow`.
- Fila suelta / card menor: `var(--sur)` plano, radius 18 px.
- Chips/pills: radius 22 px (pill completa).
- Los radios NUNCA bajan de 12 px salvo barras de progreso (6 px).

### Radios e iconos
- Iconos de la nav: lucide-style stroke 2.1, 22 px.
- Icono de categoría: emoji 20–21 px dentro de tile 44–46 px con `background:rgba(color,.12)`, radius 14–15 px.
- Monogramas de banco: tile 44 px, `bg #XX22`, `border #XX44`, texto 800.

---

## 2. Navegación (el cambio gordo)

### Barra inferior — 5 slots
| Slot | Label | Icono | Contenido |
|---|---|---|---|
| 1 | Inicio | casa | dashboard nuevo |
| 2 | Gastos | 3 líneas | lista + filtros + presupuesto del mes |
| 3 | **+** (FAB central) | plus | sheet «Apuntar» (gasto/ingreso) |
| 4 | Plan | calendario | segmented: Recibos · Deudas · Metas |
| 5 | Cartera | trend-up | cuentas + inversiones + bienes (+ patrimonio) |

- Barra: `backdrop-filter:blur(16px)`, fondo `color-mix(in srgb, var(--bg2) 88%, transparent)`, borde superior `--line-soft`, safe-area inset respetado.
- Indicador: rayita mint 34×3 px encima del slot activo. Se mueve con `transform:translateX(slot*100%)` + `transition .32s var(--spring)`. En Ajustes → `opacity:0`.
- FAB: 58 px, `margin-top:-26px` (sobresale), gradiente `160deg mint-hi→mint`, sombra `0 14px 28px -8px rgba(95,208,138,.55)` + `inset 0 1px 0 rgba(255,255,255,.35)`. Active: `scale(.92)`.
- Tabs inactivos `--muted2`, activo `--mint`, transición color .2s.

### Dónde vive lo demás (mapa de migración desde v3)
- ~~Resumen~~ → **Inicio** (reducido, ver §3).
- ~~Gastos~~ → **Gastos** (igual concepto, UI nueva).
- ~~Fijos~~ → **Plan › Recibos** (próximos cargos + ya pagado + liquidez proyectada).
- ~~Deudas~~ → **Plan › Deudas**.
- ~~Metas~~ → **Plan › Metas** (y teaser en Inicio).
- ~~Inversiones~~ + ~~Patrimonio~~ → **Cartera** (posiciones por bróker se expanden inline; detalle avanzado puede quedar como pantalla hija).
- ~~Logros~~ → racha integrada en la card de presupuesto de Inicio («🔥 4 meses sin pasarte»). La pantalla completa de niveles/insignias pasa a Ajustes › Logros (secundaria) o se elimina de la nav.
- ~~Compartido~~ → entra en Cartera como sección futura o en Ajustes; NO ocupa tab.
- ~~Drawer de ajustes~~ → **pantalla Ajustes** (push desde avatar en Inicio, con botón ‹ volver).
- Coach «¿Cómo va esto?» → desaparece como pill flotante; su contenido se reparte en frases humanas dentro de cada card (el diseño ya las incluye).

### Modo sencillo
- Deja **Inicio · Gastos · + · Plan(solo Recibos) · Cartera**; renombra «Patrimonio neto»→«Tu dinero en total», «Tus gastos»→«Lo que gastas».
- Oculta: inversiones detalladas (muestra solo total), simuladores, divisas.

---

## 3. Pantalla: Inicio

Orden vertical (mockup = verdad):
1. **Header**: fecha («jueves, 16 de julio», `--muted2` 14 px) + «Hola, Juanjo» (Fraunces 24). Derecha: avatar 48 px circular con iniciales → abre Ajustes.
2. **Hero patrimonio** (centrado, sin card): label uppercase 12.5 px tracking 2px → cifra Fraunces 56 px (céntimos a 28 px `--muted`) → pill «↑ +486 € este mes» (`rgba(mint,.13)`, texto mint) → sparkline 64 px de alto, stroke mint 2.4, con gradiente de relleno y punto final `--mint-hi`.
   - **Count-up**: la cifra anima de 0 → valor en 950 ms, easing cubic-out, via rAF. Con `prefers-reduced-motion`: sin animación, valor directo.
   - Sparkline se dibuja con `stroke-dasharray` + animación de dashoffset 1.1 s.
3. **Card presupuesto** (la estrella): anillo SVG 104 px (r=48, stroke 10, `stroke-linecap:round`, dasharray 301.6; se anima el dashoffset ~1 s) con «51% / del mes» dentro. A la derecha: estado en Fraunces 21 px color mint («Vas muy bien») + frase humana: «Has gastado **359 €** de tus **700 €**. Puedes gastar **23 €/día** hasta fin de mes.» Debajo, divider + fila: racha 🔥 a la izquierda, link «Ver gastos ›» a la derecha.
   - Estados del anillo/título: <80% presupuesto consumido al ritmo correcto = mint «Vas muy bien»; 80–100% = tan «Ojo, ajusta un poco»; >100% = coral «Te has pasado, respira». (Los umbrales exactos: reutilizar la lógica `pace` existente del motor.)
4. **Próximos cargos** (section header + card lista, máx 3): fecha en columna izquierda (día Fraunces 19 + mes uppercase 10), nombre + subtítulo, importe Fraunces (ingresos en mint con +). Link «Ver plan ›» → Plan›Recibos.
5. **Tus metas** (carrusel horizontal, `scroll-snap-type:x mandatory`, cards 78% de ancho): emoji 28 + nombre + «x € de y €» + % Fraunces mint + barra 10 px animada (scaleX desde 0, .8s) + ETA humana («A tu ritmo, la cumples en octubre 🟢»).
6. **Últimos movimientos** (card lista, máx 3 + link «Todos ›»).

Entrada de la pantalla: cada bloque `animation:rise .32s var(--ease) both` con delays escalonados 0/.05/.1/.15/.2/.25 s. `rise` = `translateY(14px)+fade`.

## 4. Pantalla: Gastos

1. Titular «Tus gastos» (Fraunces 26).
2. **Card resumen del mes**: «GASTADO EN JULIO» + cifra Fraunces 40 + derecha «de 700 € / quedan 341 €» (mint) + **barra de ritmo** 10 px con marcas «1 jul / hoy · día 16 / 31 jul».
3. Filtros de periodo: 3 botones grandes («Este mes» activo mint sólido / «Mi ciclo» / «Más…» abre sheet con mes pasado, 3 meses, todo, rango).
4. Chips de categoría scrolleables (Todas activa, resto `--sur`).
5. **Lista agrupada por día**: separador uppercase 12 px («HOY», «AYER», «LUNES 14»)…; cada fila una mini-card radius 18 (tile emoji 46 px + nombre 15.5 + meta 12.5 + importe Fraunces 17). Ingresos: importe mint con +.
6. Tap en fila (a implementar): sheet de detalle/edición con las acciones actuales (cambiar categoría, borrar…).
- La búsqueda pasa a un icono 🔍 junto al titular (no siempre visible) — opcional v4.1.
- «Suscripciones detectadas» vive como card colapsada bajo los filtros SOLO cuando haya novedades (badge), no permanente.

## 5. Pantalla: Plan (segmented)

Segmented control 3 opciones dentro de card `--sur` radius 16, thumb mint sólido (texto `--on-mint`), transición .2s.

**Recibos** (default): card hero «Queda por pagar en julio» 614,05 € + frase liquidez: «A fin de mes te quedarán **4.381 €** en Sabadell» (punto mint). Lista Pendiente (fecha-columna como Inicio, ingresos en mint) → header «Ya pagado · 782,08 €» → filas al 55% opacity con ✓ mint. Los 5 recibos pequeños ya pagados se agrupan en una sola fila («Luz, internet y subs · 5 recibos»).
**Deudas**: card hero «Debes en total» 12.548 € + «442 €/mes en cuotas · bajando cada mes 📉». Por deuda: card con emoji, cuota/día/cuotas restantes, pendiente Fraunces 18, barra coral→#F0937F (pagado %), pie «Pagado X (n%) / acabas en abril 2028», botón «💸 Amortizar ahora» (`--sur2`). Cierra card consejo (fondo `rgba(tan,.08)`, borde `rgba(tan,.3)`): simulación de amortización con CTA «Simular →».
**Metas**: card hero «Ahorrado en metas» 5.850 € mint + por meta: card con barra mint animada, ETA humana y botón primario «+ Aportar» (gradiente mint, sombra mint). Al final, card fantasma «+ Nueva meta de ahorro» (borde dashed).

## 6. Pantalla: Cartera

1. Titular «Tu cartera».
2. **Card hero**: «PATRIMONIO NETO» + 30.215,02 € Fraunces 40 + **barra apilada** 14 px (mint=cuentas, blue=invertido, cream=bienes, gap 3 px, cada segmento anima scaleX escalonado) + leyenda con dots + pie «Deudas **−12.548 €** ya descontadas» (coral).
3. **Tus cuentas** (card lista): monograma banco + nombre + rol («nómina y recibos») + saldo. Cuenta del banco lleva badge azul «del banco».
4. **Tus inversiones**: header con ganancia total a la derecha (mint, 800). Card lista por bróker (subtítulo descriptivo, valor + delta mint). Tap → expandir posiciones inline (v4: reutilizar lógica actual de posiciones).
5. Card destacada round-up: «El redondeo de tus compras invirtió **39,20 €** este mes sin que hicieras nada.» (fondo `rgba(mint,.07)`, borde `rgba(mint,.25)`).
6. **Tus bienes**: fila suelta (🚙 Coche · Seat León 2021 · 14.500 €).

## 7. Sheet «Apuntar» (FAB)

- Overlay `rgba(0,0,0,.55)` fade .25s; sheet radius 26 top, `sheetup .34s var(--spring)` (translateY 48→0 + fade), handle 40×4.
- Toggle Gasto/Ingreso (2 botones, activo mint sólido).
- Cifra Fraunces 46 px centrada (placeholder «0 €» en `--muted2`), input de concepto opcional debajo.
- Chips de categoría scrolleables (activa: fondo `rgba(mint,.16)`, borde `--mint-deep`, texto mint).
- **Teclado propio** grid 3×4 (1-9, coma, 0, ⌫): teclas 56 px `--sur`, active `scale(.96)`+`--sur2`. Máx 7 chars, una coma.
- CTA «Guardar gasto/ingreso» 58 px gradiente mint. Si importe vacío → toast «Pon un importe 🙂».
- Al guardar: cierra sheet, navega a Gastos, la fila nueva aparece arriba, **toast** «✓ Gasto apuntado» (bottom 96 px, `toastin .3s`, auto-dismiss 2.2 s).
- (Implementación real: vibración háptica ligera si `navigator.vibrate`.)

## 8. Onboarding (3 pasos)

1. Logo tile 76 px gradiente mint + «Tu dinero, por fin claro.» (Fraunces 40) + subtítulo sin jerga.
2. «Los gastos se apuntan solos.» + 2 filas demo que entran escalonadas (.12/.22s).
3. «¿Cuánto quieres gastar al mes?» + stepper −/+ (botones 56 px, pasos de 50 €, mín 100) con cifra Fraunces 52. CTA final: «Empezar con 700 €/mes».
- Dots de progreso: activo se estira a 22 px mint (transición .3s). «Saltar» arriba a la derecha siempre visible.
- Tras esto, el flujo real continúa con conexión de banco (pantallas existentes de GoCardless/Enable Banking) — mantener, pero con esta estética.

## 9. Ajustes (pantalla, no drawer)

- Header con ‹ volver + «Ajustes» Fraunces 26.
- Card perfil (avatar gradiente + nombre + email + «sincronizado ✓»).
- Secciones con label uppercase: **Apariencia** (Tema con 4 swatches circulares 30 px, el activo con borde mint-hi grueso; Letra grande switch), **Para empezar fácil** (Modo sencillo switch con subtítulo explicativo; Ver el tutorial), **Conexiones** (Mis bancos con estado ✓; Avisos; Copia de seguridad).
- Switch: 50×30, thumb 22 blanco, ON = track mint.
- Filas min-height 56 px, separadas por `--line-soft`.

## 10. Sistema de motion (resumen)

| Qué | Anim | Duración/curva |
|---|---|---|
| Entrada de bloques | rise (fade + translateY 14px) | .32s --ease, delays +.05s |
| Cambio de tab | contenido nuevo hace rise; SIN slide horizontal | .32s |
| Indicador nav | translateX | .32s --spring |
| Barras de progreso | scaleX 0→1 origin left | .7–.8s --ease |
| Anillo presupuesto | stroke-dashoffset | 1s --ease |
| Sparkline | dashoffset draw | 1.1s --ease |
| Count-up hero | rAF cubic-out | 950ms |
| Sheet | translateY+fade | .34s --spring |
| Toast | translateY+fade | .3s, 2.2s vida |
| Press states | scale .92–.98 | .15s |
| `prefers-reduced-motion` | TODO desactivado (duración .001s) | — |

## 11. Accesibilidad (no negociable)

- Targets ≥44 px (teclas 56, filas 56, chips 44 de alto).
- Contraste AA: revisado en los 3 temas (por eso el tema claro redefine mint a #249A5B).
- `aria-label` en botones sin texto (avatar, FAB, ⌫).
- Todo texto crítico en frases humanas, no solo cifras (el «puedes gastar 23 €/día» es el patrón).
- Letra grande = rem scaling global.
- Focus visible: `outline:2px solid var(--mint); outline-offset:2px` en navegación por teclado.

## 12. Plan de implementación sugerido (orden)

1. Tokens + tipografía + fondo (§1) — tocar `shell.html` CSS.
2. Nav nueva 5 slots + rutas internas (§2) — `10-app-components.js`/`11-app-main.js`.
3. Inicio (§3) — nuevo `03-tab-dash`.
4. Sheet Apuntar + toast (§7).
5. Gastos (§4), Plan (§5), Cartera (§6).
6. Ajustes como pantalla (§9) + Modo sencillo remap.
7. Onboarding (§8).
8. Barrido de motion + reduced-motion + focus (§10–11).
9. Migrar Logros/Compartido a su nuevo hogar y borrar tabs muertos.

**Criterio de aceptación global: ponlo al lado de `Aely v2.dc.html` y no se distingue.**

---

# PARTE 2 — Pantallas secundarias, sheets y estados (TODO lo demás)

> Nada de esto tiene mockup propio: se construye **con las mismas piezas** de la Parte 1 (tokens §1, anatomías §13). Si una pieza no está definida aquí, se copia de la pantalla más parecida del mockup.

## 13. Anatomías reutilizables

### 13.1 Sheet inferior (patrón único para TODO diálogo)
Reemplaza a los `dialog-backdrop`/`sheet` actuales:
- Overlay `rgba(0,0,0,.55)`, fade .25s. Tap fuera = cerrar (salvo flujos de pago/borrado a medio hacer).
- Panel: `--bg2`, borde `--line` (sin borde inferior), radius 26 top, `sheetup .34s --spring`, handle 40×4 `--line` centrado, padding 18-20 px + safe-area.
- Título del sheet: Fraunces 22, opcional subtítulo 13.5 `--muted`.
- CTA primaria SIEMPRE abajo, 58 px, gradiente mint. Secundaria encima o a la izquierda, `--sur2` borde `--line`.
- Máx alto 88dvh, contenido scrolleable interno.
- Cierre con arrastre del handle (v4.1, opcional).

### 13.2 Inputs
- Campo texto/número: `--sur`, borde `--line-soft`, radius 14, padding 13-15, 16 px, focus: borde `--mint` + `outline:none`.
- Importes: SIEMPRE teclado propio del sheet Apuntar (§7) o `inputmode="decimal"`; coma decimal española.
- Stepper −/+ (presupuestos, días): botones circulares 56 px como onboarding §8.
- Selector de día del mes: grid 7×5 de celdas 44 px, seleccionada mint sólido.
- Selector de emoji (metas/bienes): grid de 8×N emojis 44 px, seleccionado con anillo mint.

### 13.3 Confirmación destructiva
Nunca `confirm()` nativo. Mini-sheet: icono 🗑️, «¿Borrar “Mercadona · 23,15 €”?», texto «Esto no se puede deshacer.» 13.5 `--muted`, botón coral sólido «Borrar» + ghost «Cancelar». Borrado con **undo**: toast «Gasto borrado · Deshacer» 5 s (§28).

### 13.4 Fila de formulario (sheets de edición)
Label 12.5 uppercase `--muted2` + control debajo, gap 8, bloques separados 16 px.

## 14. Detalle / edición de gasto (tap en fila de Gastos)
Sheet con:
1. Cabecera: tile emoji 54 px + nombre editable (tap = input inline) + importe Fraunces 34 (tap = teclado §7).
2. Fila meta: fecha (chip que abre selector), banco origen (chip informativo: «Trade Republic», no editable si vino del banco), etiqueta «entró solo» o «a mano».
3. **Categoría**: chips scrolleables (mismo estilo sheet Apuntar), la actual seleccionada. Al cambiar: toast «Movido a 🎬 Ocio».
4. Si el motor lo detectó como suscripción: card `rgba(tan,.08)`: «Parece una suscripción de 12,99 €/mes» + botones «Es suscripción» / «No lo es».
5. Acciones: «Dividir gasto» (v4.1) · «Borrar» (→ §13.3).
- Cambios se guardan al momento (sin botón Guardar); el sheet se cierra con el handle/fuera.

## 15. Presupuesto: editar total y por categoría
Desde Inicio (card presupuesto → tap en «700 €») o Ajustes:
- Sheet «Tu presupuesto del mes»: stepper grande (pasos 50 €) con cifra Fraunces 52, texto bajo: «Solo el día a día: súper, bares, caprichos. Los recibos van aparte.»
- Debajo, sección «Límites por categoría (opcional)»: fila por categoría con emoji + nombre + importe (tap = teclado) o «Sin límite» `--muted2`. Barra fina mostrando el gasto actual contra el límite mientras editas.
- Validación suave: si la suma de límites > presupuesto total → aviso tan: «Tus límites suman 810 €, más que tu presupuesto de 700 €.» (no bloquea).

## 16. «¿A dónde va tu ahorro?» (reparto)
Card en Cartera (v4 la mueve ahí, bajo inversiones): «Cada mes: 550 € a inversión». Sheet de edición:
- Fila por destino (Trade Republic, MyInvestor…): monograma + nombre + importe mensual editable.
- Pie: total Fraunces + «se descuenta de tu cuenta Sabadell el día 1».
- Añadir destino: fila fantasma «+ Añadir destino» dashed.

## 17. Metas: crear / editar / aportar
**Crear** (card fantasma «+ Nueva meta»): sheet en 3 campos: nombre (input) + emoji (selector §13.2) + objetivo € (teclado) + opcional «¿Para cuándo?» (chips: 6 meses / 1 año / 2 años / fecha…). Al crear, muestra la frase de ritmo calculada: «Ahorrando 550 €/mes la tienes en octubre 2026 🟢» ANTES de confirmar.
**Aportar** (botón «+ Aportar»): sheet con teclado §7 + chips rápidos «50 € · 100 € · 200 €» + selector de origen (cuenta). Al guardar: la barra de la meta anima al nuevo %, confeti NO (sobrio), toast «✓ 100 € a Vacaciones Japón».
**Editar**: mismas piezas; borrar meta → §13.3 (el dinero «vuelve» al colchón, explicarlo en el subtítulo).
**Meta cumplida**: la card pasa a estado dorado suave (`rgba(tan,.10)` + borde `rgba(tan,.35)`), emoji 🏁, botón «Archivar». Racha/insignia se anota en Logros.

## 18. Deudas: añadir / editar / amortizar
**Añadir deuda**: sheet: nombre + emoji + total pendiente € + cuota €/mes + día de cargo (selector §13.2) + nº cuotas restantes (opcional) + «¿amortiza más de la cuota?» (importe opcional). Preview en vivo de la frase: «Acabarías en abril 2028».
**Editar saldos**: los saldos bajan solos cada mes (motor actual); sheet «Editar saldos» = fila por deuda con importe editable + nota: «Cuando te llegue el saldo real del banco, ponlo aquí y se vuelve a anclar.»
**Amortizar ahora**: sheet con teclado + chips «100 · 250 · 500 €» + **simulación en vivo** mientras tecleas (card `rgba(tan,.08)`): «Con 500 € te quitas 2 cuotas y ahorras ≈38 € en intereses. Acabarías en febrero 2028 (2 meses antes).» CTA «Amortizar 500 €». Tras guardar: barra anima, toast «✓ Amortizados 500 €».
**Simulador «¿Cuándo amortizar?»** (card consejo → «Simular →»): sheet con 2 inputs (importe disponible, deuda destino como chips) + resultado comparado: «Amortizando ahora: −38 € intereses · Invirtiéndolo al 7%: +35 €/año esperados» + veredicto en frase humana. Sin gráficas complejas.

## 19. «¿Me lo puedo permitir?» (simulador)
En v4 vive como card colapsada al final de Plan›Recibos (no en Fijos, que desaparece):
- 2 inputs: importe + día del cargo.
- Resultado en vivo: semáforo + frase: 🟢 «Sí: aun pagándolo, a fin de mes te quedan 3.881 €» / 🟡 «Justo: bajarías a 480 € el día 28» / 🔴 «Mejor no: te quedarías en negativo el día 26». Usa la proyección de liquidez existente.

## 20. Recibos (fijos): gestión completa
Plan›Recibos, botón «Gestionar» junto al header Pendiente → pantalla hija (push, con ‹):
- Secciones: **Servicios y suministros** / **Cuotas de deuda** (solo lectura, se editan en Deudas) / **Ingresos y transferencias** / **Cargos puntuales**.
- Fila: nombre + periodicidad legible («semestral · ≈339 €/año · ene y jul») + importe (mensualizado con nota «/mes prorrateado» si aplica) + chip día.
- **Añadir fijo**: sheet: nombre + importe + periodicidad (chips: mensual · bimestral · trimestral · semestral · anual · a medida) + día/mes según periodicidad + cuenta de cargo. Si es «a medida»: selector de meses (chips ene…dic multi).
- **Cargo puntual**: nombre + importe + fecha única. Aparece en Pendiente con chip «una vez».
- **Ingresos**: nómina (importe + «último día laborable» como opción del selector de día) y transferencias automáticas (origen→destino).
- Nota al pie (copiar literal): «Los gastos no mensuales se reparten a su equivalente mensual para que veas el peso real de cada uno.»

## 21. Cartera: gestión
**Añadir cuenta**: sheet: nombre + monograma auto (2 letras editable) + color (4 swatches) + saldo + rol («¿Para qué la usas?» input corto) + toggle «se actualiza sola» si viene de banco conectado.
**Añadir bien**: nombre + emoji + valor estimado + nota. Frase bajo el input: «Ponle el valor por el que lo venderías hoy, a ojo está bien.»
**Editar saldos a mano**: igual que deudas §18 (fila por cuenta).
**Posiciones de inversión** (tap en bróker): la card expande inline (collapsible, chevron rota 180º, .3s) mostrando filas de posición: nombre + participaciones 12.5 `--muted2` + valor Fraunces + delta bajo el valor («+920 € · +16,7%» mint / coral). Botonera al pie de la card: «↻ Precios USD» ghost + «Editar a mano» ghost.
**Precios USD / divisas**: al pulsar ↻: spinner en el botón (icono rota), luego toast «✓ Precios actualizados · 9:15». Card informativa colapsada al final: «Las posiciones en otras divisas se convierten a € con el tipo del BCE (0,918). Lo que no tiene ticker (fondos, oro) se edita a mano.» Toggle «actualizar al abrir la app». Conversor €/$ del total: chips € | $ junto al total invertido (persistir elección).
**Round-up & Saveback**: card mint suave (§6.5). Tap → sheet con el desglose del mes (lista: fecha + compra + redondeo) + total Fraunces + toggle «redondeo ×2».

## 22. Bancos: conexión y sincronización
Pantalla hija desde Ajustes›Mis bancos o CTA en Gastos:
- Lista de conexiones: logo/monograma + nombre + estado: ✓ mint «conectado · sincronizado hace 2 h» / tan «caduca en 5 días — renovar» / coral «conexión caducada — reconectar».
- «+ Conectar banco»: buscador + grid de bancos (los del agregador actual GoCardless/Enable Banking). El flujo OAuth externo se mantiene; al volver: pantalla de éxito con las mismas piezas (tile ✓ mint 76 px + «CaixaBank conectado» Fraunces 28 + «Importando 90 días de movimientos…» + barra indeterminada).
- **Barra indeterminada**: 4 px, gradiente mint que se desplaza (keyframe translateX −100→100%, 1.2s infinite). Única animación infinita permitida en la app.
- Estado de sincronización en Gastos: línea 12.5 `--muted2` bajo los filtros «Última sincronización: hoy 19:42 · ↻» (tap = sincronizar; icono rota mientras).
- Errores: card coral suave con frase humana + botón «Reintentar». Nunca códigos de error pelados.

## 23. Suscripciones detectadas
Card colapsada en Gastos (solo con novedades, badge numérico mint):
- Fila: emoji/logo + nombre + «12,99 €/mes · ~156 €/año» + botones ✓/✕ (44 px) para confirmar/descartar.
- Confirmada → se crea el gasto fijo automáticamente (aparece en Plan›Recibos) + toast «✓ Netflix añadido a tus recibos».
- Vista completa (pantalla hija): lista de todas + total anual Fraunces 34 + las descartadas al final en 55% opacity («descartada · deshacer»).

## 24. Logros (pantalla hija desde Ajustes o racha en Inicio)
- Header ‹ + «Tus logros» Fraunces 26.
- Card nivel: icono grande + «Nv 4 · Experto» + barra violeta→azul (`#C9A6F0→#7FB5E8`) + «2.150 € para nivel 5». Niveles = ahorro acumulado (motor actual).
- Card retos del mes (máx 2): barra + frase de progreso.
- Card insignias: grid 4×N, conseguidas a color con 🏅, bloqueadas 🔒 al 40% opacity. Tap = mini-sheet con descripción y fecha.
- Al desbloquear algo en cualquier pantalla: toast especial con fondo `rgba(201,166,240,.14)` borde violeta «🏅 Insignia: 5.000 € ahorrados».

## 25. Compartido (grupos) — v4.1
Sale de la nav. Pantalla hija desde Cartera («Grupos compartidos» al final) o Ajustes:
- Vacío: ilustración-emoji 👥, «Aún no hay grupos», subtítulo, CTA «Nuevo grupo».
- Grupo: nombre + miembros (avatares iniciales) + balance por persona («Ana te debe 23,50 €» mint / «Debes 12 € a Leo» coral) + lista de gastos del grupo + botón «Saldar cuentas» (genera resumen de transferencias mínimas).
- Añadir gasto al grupo: sheet Apuntar §7 + selector «pagó…» + split igual/por partes.

## 26. Ajustes: pantallas hijas
Todas con header ‹ + título Fraunces 26, filas §9:
- **Idioma**: 3 filas radio (Español/English/Català), check mint.
- **Tema**: 4 previews grandes (mini-mock 9:16 de Inicio en cada tema, radius 16, borde activo mint 2 px) — no solo swatches.
- **Notificaciones**: grupos con switches: «Aviso si te acercas al límite (80%)», «Recibo grande mañana», «Resumen semanal (domingo 19h)», «Detecto una suscripción nueva». Cada una con subtítulo ejemplo del mensaje real.
- **Novedades**: changelog: versión Fraunces 20 + fecha + bullets. La v4.0 estrena entrada: «Rediseño completo: más claro, más rápido, más tuyo.»
- **Copia de seguridad**: estado («Última copia: hoy 03:00 ✓») + «Descargar copia (.json)» + «Restaurar» (→ picker + confirmación §13.3 con texto «Esto reemplaza TODOS tus datos actuales»).
- **Tu cuenta**: email + dispositivos vinculados + «Cerrar sesión» ghost + «Borrar cuenta y datos» texto coral 13.5 al fondo (doble confirmación).
- **Personalización** (v3 la tenía): en v4 se reduce a: reordenar bloques de Inicio (drag handles ≡, lista simple) + ocultar bloques (switch por bloque). Sin editor de widgets complejo.
- **Presupuesto mensual**: abre §15.

## 27. Estados vacíos, carga y error (todas las pantallas)
- **Vacío** (sin datos aún): emoji grande 40 px + título Fraunces 20 + 1 frase + CTA. Ej. Gastos: 🧾 «Aún no hay gastos» / «Conecta tu banco o apunta el primero con el botón +». NUNCA una pantalla en blanco.
- **Carga inicial** (sync primera vez): skeletons con las siluetas de las cards (bloques `--sur2` radius 20, shimmer sutil opacity .6→1 1.2s alternate). Máx 3 siluetas.
- **Error de red**: banner fino top 44 px coral suave «Sin conexión — enseñando lo último guardado» que se retira solo al volver.
- **Dato viejo**: si la última sync >48 h, chip tan junto al saldo: «datos del martes».

## 28. Toasts, deshacer y confirmaciones (sistema)
- Toast único global (cola FIFO, máx 1 visible): bottom 96 px (sobre la nav), `--sur2` + borde `--line`, radius 16, 14 px 700. Vida 2.2 s (5 s si lleva acción).
- Con acción: «Gasto borrado · **Deshacer**» (Deshacer en mint, área táctil 44 px).
- Éxitos siempre con ✓, nunca con emojis de fiesta. Errores con frase humana, sin ❌ rojo agresivo.
- Háptica (app real): light impact al guardar, medium al borrar/deshacer.

## 29. Tono de voz (copys)
- Tuteo, frases cortas, cero jerga financiera sin explicar. Los términos técnicos van con traducción: «Patrimonio neto (todo lo tuyo menos lo que debes)».
- Los números siempre acompañados de qué significan: nunca «51%» suelto, sino «51% del mes».
- Positivo sin ñoñería: «Vas muy bien» sí; «¡¡Enhorabuena crack!!» no. Un solo emoji por frase máx.
- Verbos en botones: «Apuntar», «Aportar», «Amortizar», «Conectar». Nunca «OK», «Aceptar», «Submit».
- Estados de ritmo (reusar en presupuesto, metas, deudas): 🟢 «Vas bien» / 🟡 «Ojo, ajusta un poco» / 🔴 frase concreta con qué hacer.

## 30. QA checklist final (antes de dar por buena la v4)
- [ ] Los 3 temas pasan contraste AA en texto ≥14 px (revisar mint sobre claro).
- [ ] `prefers-reduced-motion` mata TODAS las animaciones (incluida barra indeterminada §22 y count-up).
- [ ] Letra grande: nada se corta ni solapa a 18 px root en 360 px de ancho.
- [ ] Modo sencillo: sin jerga, Plan solo Recibos, Cartera sin detalle de posiciones.
- [ ] Teclado propio: coma única, máx 7 chars, ⌫ mantiene pulsado = borra rápido.
- [ ] Toda acción de guardado produce toast; todo borrado tiene Deshacer.
- [ ] Navegación con teclado físico: focus visible en todos los interactivos.
- [ ] Safe areas iOS/Android (nav inferior y sheets).
- [ ] Sin scrollbars visibles en ningún carrusel/chips (todas las plataformas).
- [ ] 60 fps en el cambio de tab en un móvil de gama media (sin layout thrashing: solo transform/opacity).
