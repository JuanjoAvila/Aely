# Gastos v5 · rediseño de la pestaña (20/10/2026)

Diseño cerrado con el dueño el 20/10/2026 sobre la beta 4.26.159, a partir de cómo enseña los
movimientos Revolut y adaptado al lenguaje de Aely (Fraunces + Manrope, verde forestal y menta).
**Fuente de verdad de lo que se ve y de cómo se mueve.** Lo que no esté aquí sigue como hoy.

Material de esta carpeta:

| Fichero | Qué es |
|---|---|
| `SPEC.md` | Este documento. Manda sobre el prototipo si se contradicen. |
| `prototipo-gastos.dc.html` | Fuente del prototipo interactivo que aprobó el dueño (lienzo de diseño de Claude). Markup + lógica en un fichero: sirve para leer medidas, colores, textos y el comportamiento exacto de la cifra, los meses, el gesto y las fichas. **No es código para copiar**: no usa React ni los componentes de la app, y los datos son sintéticos. |
| `hoja-filtros.dc.html` | La hoja de filtros (estática). |

> El prototipo usa movimientos inventados y generados al azar. Ninguna cifra suya es dato real
> ni sirve de oráculo para un test.

---

## 1. Por qué

La Gastos actual es la pantalla más cargada de la app: tarjeta con cinco cifras, barra, desglose
de categorías, tres botones de periodo, buscador, «Actualizar gastos» con su explicación y su hora,
y la tarjeta de suscripciones con dos botones por fila. Los movimientos, que es lo que se viene a
mirar, empiezan tres pantallas más abajo. La v5 hace que **la lista mande** y lleva el resto a
secciones y hojas.

## 2. Estructura

```
┌───────────────────────────────────────────┐
│ Tus gastos            [≡] [▮▮▮] [⟲•4]     │  título (Fraunces 32) + 3 iconos de sección
│ 1.239,40 €                                │  cifra viva (Fraunces 46 → 34 al bajar)
│ gastado en octubre · 139 € por encima     │  línea de estado (14 px)
│ [agosto] [septiembre] [octubre]           │  meses: aparecen al bajar (sticky)
├───────────────────────────────────────────┤
│ [🔍 Buscar              ] [⚙ filtros]     │  solo en Movimientos
│ Hoy                              24,38 €  │
│ ┌ tarjeta gasto ───────────────────────┐  │
│ └──────────────────────────────────────┘  │
│ ┌ ● Recibos · no cuentan   97 €   (2) ┐  │  fila gris agrupada, desplegable
└───────────────────────────────────────────┘
```

### 2.1 Cabecera

- **Título** «Tus gastos» (Fraunces 500, 32 px), como el resto de pestañas.
- **Tres iconos de sección** a la derecha, botones redondos de 44 px: Movimientos (líneas),
  Categorías (barras), Suscripciones (reloj con flecha circular = «se repite»). El activo va
  relleno en `--mint` con el icono en `--on-mint`; los otros en `--surface` con borde `--line`.
  Son `role="tab"` con `aria-label` y `aria-selected`.
- **Globito** amarillo (`--tan`) en el icono de Suscripciones con el número de pendientes; sin
  pendientes no hay globito.
- **Cifra viva** (§3) y **línea de estado** debajo.
- **Fila de meses** (pastillas, el mes visible marcado en `--surface-2`): aparece cuando la lista
  baja más de ~40 px y se queda fija; la cabecera se encoge (cifra 46 → 34 px) y gana sombra.
  En Categorías y con un filtro de categoría activo está siempre visible. Tocar un mes salta a su
  primer día (Movimientos) o cambia el mes mostrado (Categorías / filtro activo).

### 2.2 Secciones y gesto

- Tres secciones: **Movimientos → Categorías → Suscripciones** (y vuelta a Movimientos).
- Se cambia tocando su icono **o con el mismo tirón que Plan**: arriba del todo, arrastrar hacia
  abajo pasa a la siguiente. Reutilizar la mecánica de `14-v4-screens.js` (PlanTab: `TH`,
  `FLICK_V`, `MAX_PULL`, `resist`, `gestureAxis`, `pan-y` siempre, el tirón se reclama solo con
  `preventDefault`, nunca `scrollTop` a mano — INC-0710-01). **Sin texto** de «Suelta para ir
  a…»: Plan no lo tiene.
- Cambiar de sección vuelve arriba del todo, quita el filtro de categoría y cierra fichas.

## 3. La cifra viva

| Dónde | Cifra | Línea de estado |
|---|---|---|
| Movimientos, arriba del todo, mes en curso | gasto del mes que cuenta | «gastado en octubre · **139 € por encima**» (coral) o «**… por debajo**» (menta) |
| Movimientos, bajando dentro de un mes | lo gastado en ese mes **hasta el día que queda arriba** | «gastado en octubre hasta el 12» |
| Movimientos, primer día de un mes cerrado | total de ese mes | «septiembre · cerrado» + comparación con el mes anterior (ver nota) |
| Movimientos con filtro de categoría | total de esa categoría en ese mes; bajando, hasta el día de arriba | «5 movimientos · **23 € menos que en septiembre**» / «hasta el 12» |
| Categorías | gasto del mes elegido | «octubre por categoría · 139 € por encima» |
| Suscripciones | suma mensual de las pendientes | «al mes · 4 por revisar» + icono ⓘ (§6.3) / «nada por revisar» |

Reglas:

- **Misma fuente que hoy**: `monthBudgetStats` / `expenseCountsBudget` y los mismos bancos de
  gasto diario. La cifra de arriba del mes en curso debe coincidir con la tarjeta del mes de
  Inicio. Recibos, deudas y metas **no cuentan** (ya es así).
- **Nota sobre meses cerrados — respeta la regla vigente** de `04-tab-gastos.js` («No existe una
  foto histórica del límite… enseñarlo como margen del pasado inventaría dinero»): el prototipo
  pinta «septiembre · cerrado · 134 € por debajo», pero **no se compara un mes pasado con el límite
  actual**. En un mes cerrado la línea dice «septiembre · cerrado» y, si hay datos, «X € más/menos
  que agosto».
- **Comparaciones con el mes anterior: hasta el mismo día** cuando el mes es el actual (como hace
  ya «más/menos que el mes pasado» de Inicio). Octubre a día 20 contra septiembre entero da
  siempre «menos».
- La comparación del filtro es **de esa categoría** contra la misma categoría el mes anterior.
- Cambia **sin parpadeo** al bajar: se calcula por día visible (el encabezado de día que queda bajo
  la cabecera), no por frame. Ojo con el coste: precalcular acumulados por día una vez por render
  de datos (`useMemo` sobre las porciones concretas, AGENTS §7 bis), no recorrer el histórico en
  cada evento de scroll.
- Si un dato falta, «—» y se dice por qué (AGENTS §1). Nunca una cifra inventada.

## 4. Movimientos

### 4.1 Buscador y filtros

- Buscador redondo (46 px) + botón de filtros (icono de deslizadores, **no** engranaje). El botón
  lleva globito con el nº de filtros activos.
- Con filtro de categoría activo, bajo el buscador sale una **píldora** del color de la categoría:
  «Bares · septiembre ✕». Tocarla quita el filtro.

### 4.2 Días

- Encabezado de día: «Hoy», «Ayer», luego «sáb 17 oct». A la derecha, el **total del día que
  cuenta** (sin signo; los ingresos restan). Las filas grises no suman.
- **Cada gasto es su propia tarjeta**, con **6 px** entre tarjetas del mismo día (pedido explícito
  del dueño: no fundirlas en una sola tarjeta).

### 4.3 Tarjeta de gasto — **se conserva la estructura actual**

El dueño la quiere tal cual porque, con muchos gastos en un día, ve banco y fecha sin entrar:

- Icono de categoría (44 px) · **nombre** (16/600) · **categoría en su color** (14/500) ·
  «**19/10 · Trade Republic**» (13, `--muted`) · **importe en Fraunces** (19/600) · asa ⋮⋮ (la de
  arrastrar a categoría, `dragExpense`).
- Ingresos: «+13,40 €» en menta. Rechazados («saldo insuficiente»): importe **tachado** y todo
  en gris, no cuentan.
- Se conservan: ficha al tocar, nota/concepto, «Recibo: nombre» de la 4.26.122, «¿Recibo…?»,
  gemelos de TR, lápidas. Esto es un cambio de presentación: **ninguna regla de qué cuenta cambia**.

### 4.4 Filas grises: Recibos, Deudas, Metas

Los cargos del banco que pagan un recibo, una cuota o una aportación a meta **siguen saliendo en
Gastos** (decisión de la 4.26.122: todo cargo del banco aparece), pero **agrupados por día** en una
fila:

- Borde discontinuo (`1px dashed`, ~`#24392E`), fondo transparente, texto `--muted`.
- Punto de color por tipo (Recibos gris, Deudas coral, Metas azul) · «Recibos · no cuentan» ·
  importe · contador redondo. **Sin flecha** (el dueño no la quiere).
- **Al tocar se despliega de forma fluida** (~280 ms, `grid-template-rows 0fr→1fr` + opacidad;
  sin saltos de la lista; con «reducir movimiento», sin animación). Dentro, cada cargo en gris
  («Endesa · Luz · Sabadell · 62,00 €», «Préstamo coche · Cuota 7 de 48») y al final
  «**Abrir en Plan · Recibos ›**» (o Deudas / Metas), que lleva a su segmento de Plan.
- Con filtro de categoría activo, las filas grises no se enseñan.

## 5. Categorías

- Barra del presupuesto del mes elegido (menta hasta el límite, coral el exceso) con «de 1.100 €».
  Solo para mes en curso / Mi ciclo (misma regla de §3: sin límite en meses pasados).
- Lista de categorías con gasto del mes, ordenada de mayor a menor, cada una con su barra relativa.
- **Tocar una categoría → Movimientos filtrado** por esa categoría y ese mes (píldora §4.1, cifra
  viva §3). Cambiar de mes con el filtro activo mantiene la categoría.
- ⚠ **Puerta de entrada que no se puede perder** (AGENTS §7, «audita sus puertas de entrada»):
  hoy se toca una categoría para **ponerle límite**. En la v5 el toque filtra, así que el límite
  necesita su sitio: proponer al dueño (pulsación larga en la categoría, o «Poner límite» en la
  cabecera del filtro) **antes** de quitar la vía actual.

## 6. Suscripciones

Bandeja de cobros que se repiten (mismo comercio, importe parecido, ≥ 3 meses) y **no están en
Recibos**. Lo normal es que esté vacía.

### 6.1 Con pendientes

- Tarjetas como las de gasto: inicial/icono, nombre, «6 meses seguidos · Revolut», importe en
  Fraunces + «al mes». Sin texto explicativo encima (va en la ⓘ, §6.3).

### 6.2 Vacía

- Círculo menta con ✓, «**Todo en orden**» (Fraunces 26) y una línea: «Si un comercio te cobra
  algo parecido tres meses seguidos y no está en Recibos, aparecerá aquí para que decidas qué
  hacer.» (El botón «Prototipo: volver a ver el ejemplo» **no** va a la app.)

### 6.3 Ficha de información (ⓘ junto a la línea de estado)

Hoja inferior con el patrón de la casa (`v4-sheet`: cierra con botón, toque fuera, gesto y atrás;
foco al título), igual que la «i» de la gráfica de Inicio. Título «Suscripciones detectadas» y tres
apartados: **Qué aparece aquí** · **Cómo se detectan** · **Qué puedes hacer** («…Lo ideal es que
esta lista esté vacía»). Botón «Entendido».

### 6.4 Ficha de una suscripción (al tocarla)

Hoja inferior con: icono, nombre, «Se cobra el día 14 · Revolut», importe al mes; **ÚLTIMOS
COBROS** (fecha e importe de los 3 últimos); «Unos 156 € al año. Si es un gasto fijo, pásalo a
Recibos: dejará de contar en tu presupuesto del día a día y lo verás en Plan.» Acciones:

1. **Pasar a Recibos** (primario). Conserva lo que ya existe: **importe editable antes de pasarlo**
   (petición previa, ver `SubRow` en `04-tab-gastos.js`) y el día detectado.
2. **Ya la he dado de baja** (secundario): sale de la bandeja; si vuelve a cobrar, vuelve a
   aparecer y avisa.
3. **No es una suscripción** (texto): se queda como gasto normal y no vuelve a preguntar (es el
   descarte que ya existe, petición 2026-08-03).

Cada acción cierra la hoja, quita la fila y enseña un aviso corto abajo («Netflix pasa a
Recibos»). Mantener el trabajo diferido actual: detectar suscripciones solo la primera vez que
Gastos está activo.

## 7. Hoja de filtros

Ver `hoja-filtros.dc.html`. **Periodo** como selector de una sola opción (Meses · Mi ciclo · Rango ·
Todo; «Mi ciclo» sale de la fila de meses y vive aquí, con su explicación de qué cobro ancla el
ciclo), **Qué contar** (Día a día · Ingresos · Inversión y traspasos), **Bancos** (multi, con ✓),
**Categorías** (las 4–5 más usadas + «Las 33 ›»). «Restablecer» arriba a la derecha; abajo, un único
botón «Ver N movimientos».

## 8. Lo que desaparece de la pantalla y adónde va

| Hoy | En la v5 |
|---|---|
| Tarjeta resumen (gastado, ingresos, balance, de X, quedan, barra) | Cifra viva + línea (§3); barra en Categorías |
| Desglose de categorías plegable | Sección Categorías |
| Botones Este mes / Mi ciclo / Más… | Fila de meses (§2.1) + Periodo en Filtros |
| «Actualizar gastos» + explicación + última sincronización | **Decidir con el dueño** (enlaza con UX-15). Propuesta: al final de la hoja de filtros, «Actualizar gastos · leído a las 18:20». Que no se pierda la vía. |
| Tarjeta de suscripciones con botones por fila | Sección Suscripciones + ficha (§6) |
| Ocultar/mostrar desglose (`settings`, petición de su pareja 10/9) | Ya no hace falta: el desglose no está encima de la lista. Retirar el ajuste solo si no queda otro uso. |

## 9. Sensación (lo que el lienzo no puede enseñar)

- **Vibración** al cambiar de sección (icono o tirón): la **misma** que el cambio de segmento de
  Plan, **un solo toque, nunca doble** (rondas de vibración de Plan; el vigía de bordes no debe sonar
  además, `e.mcSegPull`). Vibración suave al abrir/cerrar una fila gris. Respetar el «sin vibración»
  del sistema.
- **Nada seleccionable**: sin subrayado ni menú de copiar al mantener pulsado, sin destello azul al
  tocar (`user-select:none`, `-webkit-touch-callout:none`, `-webkit-tap-highlight-color:transparent`).
  Solo el buscador acepta texto.
- Animaciones con `--ease`; todas anuladas con `html.reduce-motion` / `prefers-reduced-motion`.
- Rendimiento: medir en el móvil, con CPU estrangulada (AGENTS §7 bis). La cabecera que se encoge
  y la cifra viva no pueden provocar tirones al bajar con inercia.

## 10. Textos

Todo en **es / en / ca** (AGENTS §4). Claves nuevas como mínimo: nombres de sección, «no cuentan»,
«Abrir en Plan · {x}», «gastado en {mes} hasta el {d}», «{n} por revisar», «Todo en orden» y su
explicación, la ficha ⓘ, la ficha de suscripción y sus tres acciones, los avisos.

## 11. Pruebas

Cada parte que pinta lista derivada del estado necesita su e2e (AGENTS §7 y §8) y su línea en
`E2E_MAP` de `scripts/relevant-tests.mjs`. Como mínimo:

- Cifra viva: arriba = tarjeta del mes de Inicio; tras hacer scroll a un día, el acumulado hasta ese
  día; mes cerrado sin margen contra el límite actual.
- Filas grises: un cargo de recibo, uno de deuda y uno de meta salen agrupados, no suman al total del
  día, se despliegan y «Abrir en Plan» lleva al segmento correcto.
- Categorías → filtro: tocar una categoría filtra por categoría y mes; la píldora lo quita.
- Suscripciones: con pendientes (globito, tarjetas), las tres acciones, y vacía («Todo en orden»).
- Tirón de sección: arriba del todo cambia de sección; a mitad de lista es scroll normal.
- Que la lista siga mostrando todos los movimientos que hoy muestra (no perder filas al reagrupar).

## 12. Orden propuesto (tandas de beta)

1. **Estructura + Movimientos**: cabecera, cifra viva, meses sticky, tarjetas con 6 px, filas
   grises desplegables. Quitar la tarjeta resumen y los botones de periodo.
2. **Secciones + gesto**: iconos, tirón de Plan, vibración.
3. **Categorías → filtro** (con la decisión del límite por categoría resuelta).
4. **Suscripciones** como bandeja + fichas.
5. **Hoja de filtros** y destino de «Actualizar gastos».

Cada tanda por el canal `beta` con su guion en el panel; nada directo a `main` (AGENTS §6).
