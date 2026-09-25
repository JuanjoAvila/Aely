# Aely v4.1 — Spec de implementación: fichas, Gestionar y Cartera

> Mock de referencia: `Aely v4.1 — Rediseño.dc.html` (este proyecto). **Ante cualquier duda, el mock manda.**
> Escrito para aplicarse sobre la arquitectura actual: `React.createElement` directo, sin JSX, sin Babel,
> sin dependencias nuevas, fuente en `src/modules/*.js` + `src/shell.html`, ensamblado con `npm run build`.
> Todo el color, radio, sombra, curva y fuente que aparece aquí **ya existe** en `shell.html`. No hay tokens nuevos.

Ids del mock: `1a`–`1b` (ficha de gasto hoy) · `1c`–`1d` (ficha nueva) · `1e` (Gestionar hoy) ·
`1f`/`1g` (Gestionar A/B) · `1h`/`1i` (ficha de cuenta) · `1j`/`1k` (inversiones) · `1l` (estados).

---

## 0. Qué se conserva y qué cambia

**Se conserva tal cual (no tocar):**
- La anatomía de sheet: `.v4-sheet-back` + `.v4-sheet` + `.v4-sheet-handle` + `useSheetSwipe` + `useBackClose`.
  Se cierra tirando del asa y con el gesto atrás. Es lo que él ya reconoce.
- El guardado al vuelo sin botón «Guardar» de `AccountSheet` (y su ref de saldo para el cierre por swipe:
  el bug de 4.19.67 paso 5 no se reabre).
- Los roles de cuenta con su frase (`.v4-ficha-op` / `.v4-ficha-radio` / `.v4-ficha-ot` / `.v4-ficha-od`) y
  el «Quitar esta cuenta» de borde coral con confirmación en dos pasos.
- `NumPad` de `02-ui-shared.js` (incluida la coma según `loc()`), `McCal`, `Mono`, `useCountUp`, `askConfirm`.
- El premontaje por `mcScheduleIdle` y el `content-visibility:hidden` de los segmentos de `PlanTab`.
  **Nada de esta spec toca gestos ni montajes de `11-app-main.js` / `PlanTab`.**
- El expandir posiciones inline por bróker que ya hace `Investments` con `v4Embed` (`brokerOpen`).

**Cambia:**
- `ApuntarSheet` y `ExpenseDetailSheet` pasan a compartir una única anatomía (§1).
- `BillsManageSheet` deja de montar `<Fijos>`; se sustituye por pantalla/hoja propia (§2).
- `InvToolsSheet` desaparece como cajón; su contenido se reparte (§4).
- Se retira el uso de `.v4-embed-legacy` en los tres sitios donde vive. La clase puede quedarse en
  `shell.html` hasta que no la use nadie, y borrarse en la misma tanda que el último consumidor.

---

## 1. Ficha de gasto — una anatomía, dos modos

`04-tab-gastos.js` (`ExpenseDetailSheet`) y `14-v4-screens.js` (`ApuntarSheet`).
Mock: `1c` (apuntar) y `1d` (modificar).

### 1.1 Orden vertical (idéntico en los dos modos)

| # | Pieza | Notas |
|---|---|---|
| 1 | Asa `.v4-sheet-handle` | igual que hoy |
| 2 | Fila de cabecera | izquierda: segmented Gasto/Ingreso con las clases `.v4-seg`/`.v4-seg-btn` (NO `.v4-toggle`, que ocupa 48px de alto a todo el ancho). Derecha: fecha en texto 12,5 `--muted-2`, tocable |
| 3 | **Importe** | Fraunces `clamp(40px,13vw,56px)`, `font-variation-settings:"opsz" 40`, `tabular-nums`, `letter-spacing:-2px`. A su derecha, píldora de moneda de 30px alto (`--sur` + `--line-soft`) con el símbolo y un `▾` de 9px. Debajo, subrayado de 2px `--mint` de 96px que aparece con `scaleX` (`v4bar .5s`) cuando el campo tiene foco |
| 4 | Concepto | 17px/700 centrado, editable inline. Placeholder «Toca para escribir el concepto» a 12,5 `--muted-2` |
| 5 | **Fila de meta** (una sola) | Tres píldoras de 40px: banco (con monograma `Mono size=18`), efectivo, fecha. Sustituye a los TRES carruseles de hoy (moneda + meta + banco) |
| 6 | Trazabilidad (solo modo modificar y solo si `exp.source!=="manual"`) | §1.3 |
| 7 | **Categoría** | Rejilla 4×N de tiles de 62px (`--sur`, radius 15, emoji 19 + nombre 10,5 `--muted`). Las 8 más usadas del usuario + link «Las 22 ›» que abre un sub-sheet con todas. Sustituye al carrusel infinito |
| 8 | Ajustes plegados (solo modificar) | Filas de 13px: «Nota», «Es la cuota de una deuda», «Es un ingreso, no un gasto». Cada una con su valor a la derecha y `›`. Abren su propio mini-sheet |
| 9 | Teclado | `NumPad` tal cual, teclas a 56px (P8 del PULIDO-v4 ya aplicado en shell) |
| 10 | Pie | **Apuntar:** CTA `.v4-cta` de 54px con el importe escrito: «Apuntar 23,15 €». **Modificar:** sin CTA — `🗑 Borrar gasto` a la izquierda (12,5/800 `--coral`, sin bloque de fondo) y «Se guarda al momento ✓» a la derecha, separados por `border-top:1px solid var(--line-soft)` |

### 1.2 Las 8 categorías de la rejilla
Orden = frecuencia de uso del propio usuario en los últimos 90 días (`state.expenses`), con desempate por
el orden de `CATEGORIES`. La actual del gasto **siempre** entra en la rejilla aunque no esté en el top 8
(si no, editar un gasto de una categoría rara no muestra su estado). El sub-sheet «Las 22» reutiliza la
rejilla, en bloques de 4 columnas, con la seleccionada en `rgba(108,198,136,.16)` + borde `--mint-deep`.

### 1.3 Tarjeta de trazabilidad (el «¿de dónde salió esto?»)
Solo si `exp.source && exp.source!=="manual"`. Fondo `rgba(127,181,232,.07)`, borde `rgba(127,181,232,.28)`,
radius 18, padding 13/14. Monograma del banco a 34px + dos líneas:
- Título 13,5/800 `--blue`: «Lo trajo una notificación de {banco}».
- Cuerpo 12 `--muted`: fecha y hora de la notificación, el texto crudo entre comillas, y qué está bloqueado.

El importe y el banco de un gasto automático **muestran candado y no se editan** (hoy el importe sí se
puede editar y eso desancla el saldo real del banco sin avisar). Si el usuario insiste (toca el candado),
toast: «El importe lo manda el banco. Si está mal, cámbialo desde la app del banco.»

### 1.4 Multi-moneda (se conserva la lógica, cambia la forma)
La píldora de moneda abre una lista con EUR + las de viaje (`curAlways`) + las que tengan tipo en
`fxTableOf(state)`. Se sigue guardando en € y sin tipo no se guarda (toast `fx_no_rate`). Bajo el importe,
cuando `entryCur!=="EUR"`, línea 12,5 `--muted`: «= 42,60 € con el cambio del 5 de agosto» — hoy el hint
no dice **cuánto** es en euros, que es la única pregunta que importa.

### 1.5 Borrado con deshacer (B1 del PULIDO-v4, sigue abierto)
Sustituye el copy «Esto no se puede deshacer». Al borrar: se guarda el gasto en un ref, se quita de la
lista y sale el toast global «Gasto borrado · **Deshacer**» con 5 s de vida (hoy son 2,2 s). `Deshacer` en
`--mint` con área táctil de 44px. Si el gasto venía de la nube, el deshacer re-sube el mismo id.

---

## 2. Plan › Recibos › Gestionar

`14-v4-screens.js` (`BillsManageSheet`). **Decidido: variante A (pantalla hija, mock `1f`).**
La variante B (`1g`) se deja documentada abajo solo como referencia de piezas — no se implementa.
La causa del problema es literal: hoy el sheet monta `<Fijos>` (de `08-motor-bank.js`, ~1.850) entero,
con seis cartillas, formularios abiertos, simulador y conciliación, todo dentro de `.v4-embed-legacy`.

### Variante A — pantalla hija (mock `1f`) ← **esta es la que se implementa**
Push con `‹ volver`, no sheet. Usa `.settings-push` (ya existe, 520px máx, safe areas resueltas).
1. Header: círculo `‹` de 40px + «Tus recibos» Fraunces 26 `"opsz" 24`.
2. Hero `.v4-card .v4-card-hero`: micro «SE TE VAN CADA MES» + cifra Fraunces 40 + frase:
   «De 14 recibos. Los que no son mensuales ya están repartidos a su equivalente al mes.»
   (Es la nota al pie del §20 del SPEC-v4, ahora dicha donde se entiende.)
3. Buscador (`--sur`, radius 14) + botón `+` de 46px con gradiente mint.
4. **Cuatro filas de grupo**, no cartillas desplegables: tile 42px con emoji, nombre, subtítulo de
   conteo, total al mes en Fraunces 17 y `›`. Cada una entra en su lista (otro push).
   - Servicios y suministros · Cuotas de deuda (solo lectura, «se editan en Deudas») · Lo que entra ·
     Cargos de una sola vez.
5. Tarjeta tan `rgba(230,195,106,.08)` al pie: «¿Me lo puedo permitir?».
6. La conciliación con el banco sale de aquí: vive en Ajustes › Mis bancos, que es donde se busca.

**Coste:** se monta una pantalla de ~6 nodos por grupo en vez de `<Fijos>`. Los formularios se montan
solo al entrar en un grupo. Medir con CPU x6 el toque en «Gestionar» antes/después (`AGENTS.md` §7).

### Variante B — sheet, pero solo la lista (mock `1g`) — NO se implementa
> Se conserva escrita porque su **ficha de recibo** (punto 5) sí se usa en la variante A: es la que
> se abre al entrar en un grupo. El resto de este apartado es referencia histórica.
Se queda como sheet (un gesto menos), pero dentro **solo hay lista**:
1. Título Fraunces 22 «Tus recibos fijos» + línea «14 recibos · **1.204 €** al mes. Toca uno para cambiarlo.»
2. Chips de filtro (`.v4-chips` + `.v4-chip`): Todos · 💡 Servicios · 💳 Cuotas · 💰 Ingresos.
3. Lista llana ordenada por día del mes, con `.v4-mov`: columna de día (Fraunces 19 + «cada mes» a 10px),
   nombre 15/700, subtítulo con banco y periodicidad, importe Fraunces 16.
   Las cuotas de deuda llevan 🔒 y su subtítulo dice «Se edita en Deudas».
4. Fila fantasma dashed «+ Añadir un recibo».
5. Cada fila abre la **ficha de recibo** = misma anatomía que `AccountSheet` (§3): nombre, importe,
   periodicidad en `.v4-ficha-op` con su frase, día, cuenta de cargo, y «Quitar este recibo» al pie.
   Sin botón guardar.

> **Elección del 16/9: variante A.** El criterio del «test padre» aplica igual: las palabras «fijo»,
> «flujo» y «conciliación» no aparecen en pantalla.

### 2.1 Añadir un recibo
Sheet por pasos, uno por pantalla, con el teclado propio para el importe:
1. «¿Qué es?» → input + rejilla de emoji.
2. «¿Cuánto?» → `NumPad`.
3. «¿Cada cuánto?» → `.v4-ficha-op` con frase: Cada mes / Cada dos meses / Cada tres / Cada seis /
   Una vez al año / A medida. Si «a medida» → selector de meses (`.month-picker` + `.mchip`, ya existe).
4. «¿Qué día y de qué cuenta?» → selector de día (grid 7×5 de 44px) + lista de cuentas con `Mono`.
Antes de confirmar, frase calculada: «Serán **28,25 €/mes** repartidos (339 € al año, en enero y julio).»

---

## 3. Cartera › ficha de cuenta

`07-tab-patri-fijos.js` (`AccountSheet`). Mock `1i`. **Es un añadido, no un rediseño.**

Se conserva: cabecera con `Mono`, roles con frase, guardado al vuelo, borrado en dos pasos, candado
del saldo en cuentas conectadas con su `lastSync`.

Se añade / cambia:
1. **Cabecera** pasa a: nombre de la cuenta a 17/800 como título y «{banco} · la llevas a mano» debajo;
   a la derecha, link «Renombrar». Hoy el título es el banco y el nombre está en un input al final,
   que es al revés de cómo lo piensa el usuario.
2. **Tarjeta de saldo** (`linear-gradient(180deg,var(--sur),var(--bg-2))`, radius 20): micro «SALDO DE HOY»
   + cifra Fraunces 38 + píldora mint «↑ +312 € este mes» + «a fin de mes: 4.381 €»
   (de `totals.projectedByBank`, que ya existe) + barra de 14 días (14 `<i>` con `v4bar`)
   + pie «hace 14 días / hoy».
   Con menos de 2 puntos de histórico: se oculta la barra y se pone la línea «Su histórico empieza hoy»
   (mismo criterio que P1 del PULIDO-v4; no dejar hueco).
3. **Dos acciones** de 46px `--sur2`: «✏️ Corregir saldo» (abre `NumPad`, sustituye al `.af-in` suelto) y
   «🔗 Conectar banco» — o «↻ Sincronizar ahora» / «⚠ Reconectar» según `state.bankIssues`.
   Así el arreglo está en la ficha del banco que falla, no solo en el banner de Cartera.
4. **Últimos movimientos de esta cuenta** (3 filas `.v4-mov` de 34px + «Ver todo ›» que abre Gastos
   con el filtro de banco puesto). Es la pregunta que hoy obliga a salir de la ficha.
5. Fuera los `.af-in`: inputs con el lenguaje del sheet (radius 14, `--sur`, foco `--mint`).

---

## 4. Cartera › inversiones

`06-sync-brokers.js` (`Investments`) y `14-v4-screens.js` (`InvToolsSheet`). Mock `1k`.
⚠ `PULIDO-v4.md` marca `06-sync-brokers.js` como «no tocar» para tareas de pulido. **Esto no es pulido**:
es la tanda de diseño, y el punto 4 del mock exige entrar ahí. Aun así, el criterio es **solo render**:
no se toca `sellPct`, `save`, `fetchPrices`, `invValueEur`, `invCostEur` ni el cálculo de tipos.

### 4.1 Pantalla hija «Tus inversiones»
Sustituye a `InvToolsSheet`. El bloque de Cartera sigue igual (lista `.v4-mov` por bróker, expandible),
y el link del pie pasa de «Herramientas ›» a «Ver todas tus inversiones ›».

1. Header `‹` + «Tus inversiones» Fraunces 26.
2. **Hero con la pregunta contestada**: micro «VALEN AHORA» + total Fraunces 40 (con `useCountUp`) +
   **barra apilada** de 14px con dos segmentos: `--cream` = lo que pusiste (`costTotal`), `--mint` = lo
   que han ganado (`total - costTotal`). Leyenda con dots: «Pusiste 10.102 €» / «Han ganado **1.862 €**».
   Pie: «Un **+18,4%** sobre lo que pusiste. Precios de hoy 09:15.»
   Si `costTotal===0` (nadie ha metido el coste): barra de un solo color y frase «Dime lo que pusiste y
   te digo cuánto has ganado» con CTA a editar a mano. Nunca un `+0,00%`.
3. Sección «Dónde lo tienes» + link «↻ Actualizar» (icono girando mientras `pricing`, luego toast
   «✓ Precios actualizados · 9:15»).
4. **Una tarjeta por bróker**, `.v4-mov` con borde `--mint` cuando está abierta:
   `Mono 44` + nombre + subtítulo + valor Fraunces 16 + delta 11,5/800 (`--mint`/`--coral`).
   Abierta: filas de posición (nombre 13,5 + participaciones 11,5 `--muted-2` + valor Fraunces 14,5 +
   delta 11), separadas por `--line-soft`, y **dos botones al pie de la tarjeta**:
   «✏️ Editar a mano» y «+ Posición». El modo edición deja de ser global: se edita el bróker que tocas.
5. Las posiciones sin ticker (oro, fondos) llevan «a mano · {fecha}» en `--muted-2` en vez de un delta
   falso. Es lo que hoy no se distingue.
6. Fila fantasma dashed «+ Añadir bróker o posición».

### 4.2 Dónde va lo que había en Herramientas
| Hoy en el sheet | Dónde va |
|---|---|
| `↻ Precios` | link «↻ Actualizar» del header (§4.1.3) |
| `Editar a mano` global | por bróker, dentro de su tarjeta |
| Toggle «actualizar al abrir» | Ajustes › Dinero |
| Toggle «editar también el coste» | desaparece: el coste es un campo más al editar a mano |
| Conversor € / $ | píldora de moneda junto al total del hero, igual que la del importe en §1 |
| Nota del tipo del BCE | línea 11,5 `--muted-2` bajo el hero, sin tarjeta propia |
| Desglose por tipo de activo | tarjeta al final de la pantalla hija, con `.v4-stackbar` |
| Proyección a 10 años | Ajustes › Dinero (es una calculadora, no una vista de estado) |
| Redondeo / Saveback | se queda donde está, en Cartera (§6.5 del SPEC-v4) |

---

## 5. Estados (mock `1l`)

- **Vacío**: tarjeta dashed `--line`, emoji 34, título Fraunces 19, una frase, CTA de 44px.
  Recibos: 🧾 «Aún no hay recibos» / «Conecta tu banco y los detecto solos.»
  Inversiones: 📈 «Aún no has apuntado nada» / «Añade tu primer bróker o una posición a mano.»
- **Carga**: máximo 3 siluetas `--sur2` radius 20 con `shimmer` (opacity .55→1, 1,2 s alternate) y, si hay
  import en marcha, barra indeterminada de 4px (única animación infinita permitida).
- **Error**: tarjeta `rgba(232,93,76,.08)` + borde `rgba(232,93,76,.4)`, frase humana con el dato viejo que
  se está enseñando, y «Reintentar» de 42px. Nunca un código pelado.
- **Dato viejo**: si el último sync pasa de 48 h, chip tan junto a la cifra: «datos del martes».
- **Deshacer**: §1.5.
- **`prefers-reduced-motion`**: sin `sheetup`, barras a su valor final, subrayado del importe sin `scaleX`,
  count-up directo, y la barra indeterminada se sustituye por el texto «Importando…».

---

## 5 bis. Plan: portada y modo sencillo (tanda 2)

`14-v4-screens.js` (`PlanTab`, `PlanBills`). Mocks `2a` (hoy) · `2b` (portada) · `2c` (modo sencillo).
Resuelve B1 y B2 de `handoff/AUDITORIA-v4.1.md`.

⚠ **Restricción dura:** no se toca el gesto vertical de `PlanTab`, ni `segMounted`, ni el premontaje por
`mcScheduleIdle`, ni el `content-visibility:hidden` de las capas. Todo lo de aquí es contenido **dentro**
de la capa `recibos` y etiquetas del `.v4-seg`. Si un cambio obliga a tocar el efecto del gesto, se para.

### 5bis.1 Portada (`2b`)
El segmented deja de ser lo primero. Orden nuevo de `PlanTab` → capa `recibos`:

1. Titular «Tu plan» (igual).
2. **Tarjeta de estado**, copiada en estructura de la tarjeta de presupuesto de Inicio (`03-tab-dash.js`):
   anillo SVG de 96px (r=54, stroke 11, `stroke-linecap:round`, dasharray 339,3) con «76% / ya pagado»
   dentro en Fraunces 22 — el porcentaje es `paidTotal / (paidTotal+pendingTotal)`, que `PlanBills` ya
   calcula. A la derecha, estado en Fraunces 21 + frase humana con las dos cifras que importan:
   «Te quedan **614 €** por pagar este mes. Aun pagándolo todo, terminas con **4.381 €** en Sabadell.»
   (la segunda mitad es la `liquidity` que hoy va en gris bajo el número).
   Estados, reutilizando la lógica `pace` existente: 🟢 «Vas bien» · 🟡 «Ojo, viene un mes cargado»
   («Te quedan X y a fin de mes bajarías a Y el día Z») · 🔴 «Cuidado» («El día Z te quedarías en negativo»).
   Pie con divider: el cargo más grande que queda + «Ver ›».
3. **Segmented con su número** (`.v4-seg-btn` en columna, dos líneas): Recibos / «5 por pagar» ·
   Deudas / «12.548 €» · Metas / «2 en marcha». Alto mínimo 46px. En modo sencillo no se pinta.
4. «Pendiente» → **«Lo que aún saldrá»**. «Ya pagado · X» → **una sola fila** plegada («Ya has pagado 9
   recibos · 774,89 €») que despliega la lista. Hoy son hasta 3 filas + «Ver más», que ocupan media
   pantalla contando cosas que ya pasaron.

### 5bis.2 Modo sencillo (`2c`) — deja de esconder, empieza a traducir
Hoy `simple` solo filtra `segs` y renombra dos cadenas. Pasa a cambiar tres cosas:

| Eje | Normal | Sencillo |
|---|---|---|
| Titular | «Tu plan» | «Lo que te queda por pagar» |
| Cifra | 40px en tarjeta | 56px centrada, **sin céntimos** (`eur0`) |
| Estado | tarjeta con anillo | tarjeta 🟢/🟡/🔴 con frase, sin anillo ni porcentaje |
| Subtítulo de fila | «Fijo · Sabadell» | «sale de Sabadell» / «la cuota del coche» / «lo que apartas para invertir» |
| Filas | `.v4-charge` 12px | `.v4-mov` de 60px, nombre 16px, importe Fraunces 17 |
| Segmented | 3 opciones | no se pinta |
| «Gestionar» | link en el header | no se pinta (vive en Ajustes) |

Regla de oro del modo sencillo, y criterio de revisión: **en pantalla no aparece ninguna palabra que no
usaría tu padre**. Fuera «fijo», «flujo», «traspaso», «pendiente», «gestionar», «conciliación».
Cada importe va acompañado de qué es y cuándo sale.

### 5bis.3 Coste
La portada añade un SVG de anillo y una tarjeta a una capa que ya se monta. No añade montajes ni cambia
el árbol de `capa()`. Medir igual que el resto: CPU x6, medianas de 5, entrar en Plan y deslizar.

## 6. Orden de implementación sugerido

1. §1 ficha de gasto unificada — es la que él usa 20 veces al día y la que más duele.
2. §1.5 deshacer al borrar (cierra B1, es media hora).
3. §3 ficha de cuenta (aditivo, sin riesgo).
4. §2 variante **A** de Gestionar (decidida el 16/9) — **medir antes y después** con CPU x6.
5. §4 inversiones (la más larga; solo render, con el aviso de `06-sync-brokers.js` en mente).
6. Barrido de §5 estados + retirar `.v4-embed-legacy` de `shell.html` cuando no la use nadie.
7. §5bis portada de Plan y modo sencillo — se puede hacer en paralelo con 1-3, no comparte ficheros con §1.

## 7. Criterios de cierre

- [ ] Ninguna pantalla monta un componente v3 dentro de un sheet v4 (`grep v4-embed-legacy` = 0 usos).
- [ ] Gestionar es una pantalla hija (variante A), no un sheet, y no contiene formularios abiertos.
- [ ] Apuntar y Modificar un gasto se ven como la misma ficha: mismo orden, mismo teclado, misma rejilla.
- [ ] Un gasto que entró del banco dice de dónde vino y por qué no se puede cambiar el importe.
- [ ] Tocar «Gestionar» no bloquea el hilo más que entrar en Plan (medido con CPU x6, 5 medianas).
- [ ] Todo borrado tiene Deshacer de 5 s; todo guardado produce toast.
- [ ] En Gestionar e Inversiones no aparecen las palabras «fijo», «flujo», «conciliación», «PL», «coste».
- [ ] `prefers-reduced-motion` mata todas las animaciones nuevas.
- [ ] Targets ≥44px, texto ≥12,5px, contraste AA en verde/oscuro/claro.
- [ ] Los tres idiomas (`handoff/i18n-v4.1.json`) con todas las claves nuevas.
- [ ] Plan contesta «¿voy bien?» antes de enseñar una lista, y los segmentos dicen qué hay dentro.
- [ ] En modo sencillo, Plan no contiene ninguna de: fijo, flujo, traspaso, pendiente, gestionar, conciliación.
- [ ] Entrar en Plan y deslizar entre segmentos no empeora respecto a hoy (CPU x6, medianas de 5).
