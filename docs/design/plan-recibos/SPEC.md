# Plan · Recibos v6 — rediseño de la sección (26/10/2026)

Diseño cerrado con el dueño el 26/10/2026 en el lienzo de diseño (variante **B**, unas 80
rondas). **Fuente de verdad de lo que se ve y de cómo se mueve.** Lo que no esté aquí sigue como
hoy. **Cartera queda fuera**: se sigue diseñando aparte y no se toca en estas tandas.

Material de esta carpeta:

| Fichero | Qué es |
|---|---|
| `SPEC.md` | Este documento. Manda sobre el prototipo si se contradicen. |
| `prototipo-plan.dc.html` | Fuente del prototipo interactivo que aprobó el dueño (lienzo de diseño de Claude; `MainB`). Markup + lógica en un fichero: sirve para leer medidas, colores, textos, animaciones y el comportamiento exacto de gestos y fichas. **No es código para copiar**: no usa React ni los componentes de la app y los datos son de mentira. |

> Todas las cifras, bancos, personas y cargos del prototipo son inventados (`RECIBOS`, `CARGOS`,
> `DEBTS`, `GOT`, `PEOPLE`, `BAL`, `FRESH`, `TODAY = 18`). Ninguno es dato real ni sirve de oráculo
> para un test. Si en la app falta un dato, se enseña «—» (AGENTS §1), nunca un valor de ejemplo.

## 0. Mapa con el código de hoy (main 4.26.182)

Para no reinventar: lo que el diseño llama X, en la app es esto. Líneas orientativas, verificar.

| Diseño | Hoy en el código |
|---|---|
| Plan › Recibos | `PlanTab` y `PlanBills` en `14-v4-screens.js` (segmentos `PLAN_SEG_ORDEN`). Tirón: `useTironSeccion` en `02-ui-shared.js` (compartido con Gastos v5). |
| Recibo | `state.fixed[]` (`addFixedItem`, `patchFixedById`, `removeFixedById` en `08-motor-bank.js`); campos `amount`, `bankAmount`, `freq`, `months`, `schedule`, `day`, `account`, `category`, `paidYm/paidDay`, `paymentProofs`. |
| Pendiente / pagado | `planChargesMonth`, `fixedPaymentState`, `paymentEvidenceUI` (confirmado vs «por confirmar»), `isPaidIn` para totales. |
| «¿Cuál es el cargo?» | `linkFixedPayment` (enlazar; `null` desenlaza), `quitarCargoDeRecibo` / `reponerCargoDeRecibo`, `fixedPaymentIdentity`. Tolerancias reales: `recAmtClose`, `recNameMatch`, `fixedPaymentBookSameRef`. **Usar las de la app**, no las del prototipo (±15 %). |
| Gestionar / Todos | `BillsManagePush` + `billsGroupRows`. |
| Añadir / editar | `BillsAddWizard` (pasos what/amount/freq/months/monthyear/when) y `BillsItemSheet`. |
| ¿Te llega? | `totals.bankBal`, `minByBank/minDayByBank` (`11-app-main.js`), `planCoverState`. Frescura: `account.balanceAt`, `state.obBalAt[aspsp]`, `state.lastBankSync`. |
| Nómina / entradas | `flows` con `kind:"income"`. |
| Deudas | `Debts` en `09-tab-debts-goals.js`; la cuota es un gasto con `debtId` (`debtPaymentState`). Un gasto lleva `debtId` **o** `reciboId`, nunca los dos. |
| Tu parte | Ya existe la idea: `amount` = tu parte, `bankAmount` = lo que cobra el banco. Los compartidos (§6) deben construirse **encima de esto**, no con un campo paralelo. |
| Sincronizar banco | Solo a mano: `sincronizarAMano` → `runBankSync` → edge `bank-sync`. Único `pg_cron`: `myinvestor-keepalive`. |
| Moneda | `DISP.sym`, `eurParts` / `eur` / `eur0`. |
| Textos | `LANG.es/en/ca` en `01-i18n.js` (bloques `Object.assign`), modo simple en `LANG_SIMPLE`. |
| e2e | `seedLoggedInDashboard`; specs de Plan: `plan-swipe-segmento`, `plan-gestionar`, `plan-cover`, `listas-render`, `fixed-ispaidin`, `recibos-*`, `fin04-plan-three-way`. |

**Lo que NO existe todavía** (y por tanto es trabajo nuevo con decisión del dueño antes de tocar
datos): pausa (`pausedFrom/pausedUntil`), prueba gratis, permanencia, personas, reparto entre
personas, compensación con deuda, posponer avisos, el ojo de ocultar importes, lectura programada
del banco.

**Modo simple**: `PlanTab` en modo simple solo enseña Recibos con el semáforo (`coverTone`).
Este rediseño es para el modo normal; el simple sigue como hoy salvo que el dueño diga otra cosa.

---

## 1. Por qué

Plan › Recibos tiene que contestar en un vistazo **tres preguntas**: cuánto me queda por pagar este
mes, si me llega el dinero en cada cuenta y qué tengo que mirar yo. Todo lo demás (lista completa,
añadir, editar, personas) vive un toque más abajo, en **Todos** y en fichas. Nada de textos de
lectura, nada de rojo/amarillo de alarma: la paleta es `--text` / `--muted` / `--mint`.

## 2. Pantalla principal (Plan › Recibos)

```
┌───────────────────────────────────────────┐
│ ┌ Septiembre cerrado               [×] ┐  │  §2.1 resumen del mes cerrado (descartable)
│ └ 2.436 € en recibos · 12 € más que ago ┘  │
│ QUEDA POR PAGAR EN OCTUBRE        Nov ›   │  §2.2 tarjeta resumen
│ 1.234,56 €                                │
│ 9 recibos · 3 esta semana                 │
│ [✓ Te llega]  [Te deben 10 €]             │  píldoras → hojas §4 y §5
├───────────────────────────────────────────┤
│ Para revisar (máx 3)          Ver los N   │  §2.3
│ Por pagar (máx 3)             Ver los N   │  §2.4
│ ▸ Ya pagados · 1.020 €                    │  §2.5 fila plegada
│ [ Todos ]                                 │  §3
└───────────────────────────────────────────┘
```

### 2.1 Resumen del mes cerrado

- Tarjeta en `--surface-2` arriba del todo los primeros días del mes (propuesta: hasta el día 7 o
  hasta que la cierre). Título «Septiembre cerrado», línea «2.436 € en recibos · 12 € más que
  agosto».
- Tocarla la despliega (rejilla `0fr → 1fr`) con como mucho cuatro líneas: el que más subió contra
  el mes anterior, el que cambió de precio, lo que te devolvieron y «Recibos que no llegaron · N».
  Solo líneas con dato real; si no hay ninguna, no se despliega.
- `×` la descarta para ese mes (persistir por mes, no para siempre). Se va con colapso suave.
- No sale en la vista del mes siguiente (§2.2) ni en el arranque sin recibos (§9).

### 2.2 Tarjeta resumen

- Etiqueta «QUEDA POR PAGAR EN OCTUBRE» + cifra grande (Fraunces) = suma de **tu parte**
  (§6) de los pendientes del mes, deudas incluidas.
- **«Nov ›»** a la derecha: cambia la tarjeta y la lista Por pagar al mes siguiente («SE TE VAN EN
  NOVIEMBRE», recibos de ese mes con estimación de temporada marcada «≈»). Ahí el botón es «‹ Oct».
  En la vista del mes siguiente no hay Para revisar ni Ya pagados.
- Línea de conteo: «9 recibos · 3 esta semana».
- **Sin** aviso de «mes cargado» y **sin** hucha de recibos grandes (descartados por el dueño).
- Dos píldoras, mismo tamaño, sin cortar el texto:
  - **Llega**: «✓ Te llega» (menta) o «Falta 65 €» (redondeo hacia arriba, `Math.ceil`, con el
    símbolo de `DISP.sym`). Abre la hoja ¿Te llega? (§4).
  - **Te deben**: «Te deben 10 €» si alguien te debe su parte este mes; si no, no sale. Abre §5.

### 2.3 Para revisar

- Como mucho **3** filas; si hay más, «Ver los N» despliega el resto con colapso suave y el scroll
  se queda **al principio de la sección** (no a mitad).
- Orden por prioridad: 0 prueba gratis que empieza a cobrar hoy/mañana · 1 no ha llegado (pasado el
  día + margen) y «fantasma» (N meses sin cobrarse) · 2 cobró distinto de lo esperado / ha subido
  (umbral 0,50; comparar en céntimos, no en flotante) · 3 fin de permanencia este mes o el que viene.
- Cada fila: icono gris, nombre, texto corto («No ha llegado», «Ha subido 1,00 €», «Esperabas
  12,99 €», «Hoy empieza a cobrar», «Fin de permanencia: nov 2026», «Hace 3 meses que no se
  cobra»), importe. Tocar abre la ficha del recibo (§2.6).
- **Deslizar a la izquierda** (> 90 px, vibración al cruzar) = «te lo recuerdo mañana»: se oculta
  hasta mañana, aviso abajo con **Deshacer**.

### 2.4 Por pagar

- Como mucho **3** + «Ver los N». Ordenados por día. Cuando hay recibos esta semana, la sección se
  centra en ellos.
- Fila: fecha (día + mes), nombre, «categoría · banco» + estado compartido («te han pagado 2 de 5»),
  importe de **tu parte** (con «≈» si es variable), y cuándo: «hoy», «mañana», «en 5 días»;
  si el recibo baila de día, «entre el 28 y el 1».
- **Deslizar a la izquierda** = abre la ficha directamente en «¿Cuál es el cargo?» (§2.6.3) para
  marcarlo pagado. Las deudas no se deslizan; tocarlas lleva a Deudas con esa deuda enfocada.

### 2.5 Ya pagados

- Una fila plegada «Ya pagados · total». Desplegada: cada recibo con su día y cómo se pagó
  («cargo de Sabadell», «marcado a mano»). Las deudas compensadas enseñan
  «pagas 197 € + 53 € de Pepephone».
- Los saltados este mes salen **tachados** con «este mes no»; tocarlos los devuelve al mes.

### 2.6 Ficha de un recibo (hoja desde abajo)

Cabecera: nombre, «Se cobra el 14 · Revolut», importe. Debajo, **chips** solo si hay dato:
«Este año 129,90 €» (lo pagado en el año, tu parte), «En invierno ≈ 88 €» (temporada),
«Tu parte 15 €» (compartido).

#### 2.6.1 Estado normal

- Pendiente: botón principal para marcar pagado (abre §2.6.3).
- Pagado: bloque del cargo con logo del banco, descripción del cargo y día. Tres botones en fila,
  tamaño normal (no gigantes): **No es este recibo** (abre §2.6.3 para elegir otro; si estaba marcado a mano,
  dice «Desmarcar») · **Editar** (abre §7 en modo edición) · **Pausar**.
- **Pausar** despliega chips: «Solo este mes», «Hasta dic», «Hasta ene», «Hasta feb», «Hasta abr».
  Guarda `pausedFrom` y `pausedUntil`: pausar un recibo ya pagado **no lo saca del mes actual**.
  En Todos sale «pausado hasta feb». Desde Editar: «Pausado hasta X · Reanudar».

#### 2.6.2 Casos especiales (pareja de botones en vez de los normales)

| Caso | Nota (una línea) | Botones |
|---|---|---|
| Cobró distinto | «Cobró 44,10 € y esperabas ≈ 38,50 €. Si es correcto, lo apuntamos así.» | **Solo este mes** · Desde ahora (cambia el importe del recibo) |
| Ha subido | «antes 12,99 €» | **Actualizar precio** · Ya no lo tengo |
| Prueba gratis | «Mañana empieza a cobrar» | **Me lo quedo** · Ya no lo tengo |
| Fantasma | «Hace 3 meses que no se cobra» | **Sigue activo** · Ya no lo tengo |
| Permanencia | «Fin de permanencia: nov 2026» | **Ya lo he mirado** · Ya no lo tengo |
| No ha llegado | «Tocaba el 15 y aún no ha llegado. Si lo pagaste por otro lado, márcalo como pagado.» | botones normales (marcar pagado → §2.6.3) |

Cuando aplica (prueba, subida, fantasma) y el servicio tiene enlace conocido, sale un enlace
**«Cómo darte de baja en Netflix»** que abre la web oficial. ⚠ Las URL del prototipo (`CANCEL`) son
de ejemplo: **verificar cada una** antes de meterla; si no hay URL verificada, no sale el enlace.

#### 2.6.3 «¿Cuál es el cargo?»

- Candidatos del banco del recibo, no usados ya por otro recibo, desde 7 días antes del día del
  recibo hasta hoy, con importe a ± max(2 €, 15 %) — es la lista para **elegir a mano**, más ancha a
  propósito; el casado automático sigue con las tolerancias de la app. Ordenados por parecido de importe.
- Si no hay candidatos, «Otros cargos de Sabadell» (los 4 más recientes) y **buscador** por nombre o
  importe (acepta «29,99» y «29.99»), que busca en todos los bancos.
- Tocar un cargo lo marca (anillo menta), espera ~260 ms y enlaza: el recibo pasa a Ya pagados con
  «cargo de X». Opción «Marcado a mano» si se pagó sin cargo del banco.
- En la app real esto es `linkFixedPayment` / `reciboId` (ver mapa); desenlazar es
  `quitarCargoDeRecibo`.

## 3. Todos (pantalla de gestión)

Se abre con el botón «Todos» al final de Recibos. Es el **único** sitio con «+» (el «+» de dentro de
Recibos se quitó: dedos gordos).

- **Cifra arriba**: «SE TE VAN CADA MES» ↔ «SE TE VAN AL AÑO» (toque alterna; también cambia las
  cifras de las filas y de las secciones).
- **Buscador** por nombre o importe + **chips de banco** para filtrar. Búsqueda sin resultados →
  botón «Añadir "x" como recibo» que abre §7 con el nombre puesto.
- Secciones (cada una 4 filas + «Ver los N», sin + suelto salvo donde se dice):
  - **Recibos** · «+ Añadir un recibo». Fila: día/mes, nombre, «categoría · banco · frecuencia ·
    compartido», importe (tu parte). Tocar abre §7 en edición.
  - **Cuotas de deuda**: «Mamá · 197 € + 53 € de Pepephone»; tocar lleva a Deudas.
  - **De una sola vez** · «+ Añadir un cargo de una sola vez».
  - **Personas** · «+ Añadir una persona» (§6).
- **Avisos de solapamiento** (descartables con ×): «Spotify y YouTube Premium incluyen música»,
  «Tres plataformas de series». Solo con datos reales de los recibos del usuario.

## 4. Hoja «¿Te llega?»

- Un bloque por banco con recibos pendientes: logo, nombre, **«saldo de hace 2 h»** (frescura de la
  última lectura; **sin botón de actualizar**), y a la derecha «lo más justo, el 28 · 98,60 €» o
  «te faltan · 64,86 €».
- Filas: Tienes hoy · Recibos que faltan · entradas previstas antes del último recibo (Nómina · día
  28, tocable para editar importe/día en una hoja con teclado).
- El cálculo es un **recorrido día a día** del saldo (cargos y entradas ordenados; a igualdad de día
  primero sale y luego entra) y se queda con el **mínimo**. Si baja de 0, aviso único: «→ Pasa
  65 € a Revolut antes del 22» (día en que se quedaría en negativo).
- **Sin sugerencias de arreglo** («sube el paso», «mueve recibos»): descartadas por el dueño.
- **«¿Y si gasto…?»**: importe con su teclado + chips de banco; recalcula el bloque del banco
  elegido en vivo.
- Si no hay saldo real de un banco, ese bloque enseña «—» y no entra en la píldora.

## 5. Hoja «Te deben»

- Lista por persona: nombre, «YouTube Premium 5 € + Pepephone 10 €», total, y lo recibido
  («Bizum el 6»). Botón **«Ya me lo ha pagado»** por persona. Tocar el nombre abre su ficha (§6).
- Cuando todos han pagado: «Te han pagado todos».
- Lo recibido se casa con ingresos reales (Bizum/transferencia de esa persona) cuando exista ese
  dato; si no, solo a mano.

## 6. Personas y recibos compartidos

Nace del caso real del dueño: YouTube Premium entre 6 (cada uno 5 € por transferencia, la pareja
por Bizum); pack Pepephone 85 € domiciliado a su nombre, la pareja pone 10 € y la familia 53 € que
**se descuentan de la deuda con su madre** (cuota 250 → paga 197 + 53 de Pepephone).

- **Persona**: nombre + cómo paga: `Bizum` · `Transferencia` · `Lo descuento` (de una deuda que
  se elige). Se crea desde Todos › Personas o desde «¿Lo pagas con alguien?» (§7).
- **Ficha de persona**: recibos compartidos con su parte, «SU PARTE SE DESCUENTA DE» con chips de
  deuda (si paga descontando), y **Borrar** con confirmación «¿Seguro? Sale de todos sus recibos».
  Tocar en cualquier otro sitio cancela la confirmación (igual que «Ya no lo tengo»).
- En un recibo, cada persona tiene un importe fijo (no %). Sin importe escrito, el resto se reparte
  a partes iguales entre ellos y tú. **Tu parte = importe − suma de partes.**
- **Todo lo que suma «lo que pagas» usa tu parte**: tarjeta resumen, filas, Todos, año. «¿Te
  llega?» usa el **importe entero** (el banco cobra entero).
- Partes «Lo descuento»: no salen en Te deben; restan de la cuota de la deuda de ese mes y se
  enseñan como «pagas 197 € + 53 € de Pepephone».
- ⚠ No confundir con `accountSharePct` (reparto de cuentas, solo patrimonio). Esto es otra cosa y
  no lo toca.

## 7. Añadir / editar un recibo (hoja por pasos)

Pasos con animación horizontal (entra por la derecha, sale por la izquierda; atrás al revés) y
barra de progreso arriba. **Se cierra por donde entró**: deslizar a la derecha = paso anterior; en
el primer paso, cerrar; deslizar hacia abajo cierra desde cualquier sitio.

1. **Nombre**: teclado de texto, iconos sugeridos (Luz, Agua, Gas, Internet, Móvil, Alquiler,
   Seguro, Gimnasio, Netflix, Spotify, Hacienda, Comunidad) que ponen nombre + categoría. Bloque
   **«Visto en tu banco»** con cargos repetidos que aún no son recibo (un toque rellena nombre,
   importe, día y banco). Aviso de **duplicado** si ya existe uno con ese nombre → «Editar ese».
2. **Importe**: teclado numérico propio; el primer dígito **sustituye** el valor (no hay que
   borrar). Separador de miles al escribir. «Cambia cada mes» = variable (≈).
3. **Cuándo**: frecuencia (Cada mes · Cada 2 meses · Cada 3 meses · Una vez al año) + día;
   **«Solo una vez»** (mes + día) → va a De una sola vez; **«En varios pagos»** → tarjetas de pago
   (día, mes, importe) con «+ Añadir pago», «× Quitar este pago», − / + del día que **acelera al
   mantener pulsado**, y el último pago calcula el resto. Hacienda propone 60 % 30 jun + resto 5 nov;
   el resto 50 % / 50 %. En la app real es `schedule`.
4. **Cuenta**: chips de banco.
5. **Resumen**: todo editable tocando su línea (vuelve a ese paso y luego al resumen). Guardar.

**Más opciones** (plegado en el resumen): **¿Lo pagas con alguien?** (rejilla de avatares de
5 columnas — no carrusel —, «+ Otra», filas de reparto con × e importe, tocar el nombre abre su
ficha, «Tu parte» calculada) · **Prueba gratis** (hasta cuándo) · **Permanencia** (hasta cuándo).

**Modo edición** (desde Todos o la ficha): mismo resumen; al cambiar importe/día pregunta **«Solo
octubre / Desde ahora»**; «Pausado hasta X · Reanudar» si está pausado; **«Ya no lo tengo»** →
«¿Seguro? Borrar» (tocar fuera cancela) y, si hay enlace de baja verificado, «Antes, date de baja en
X».

## 8. El ojo (ocultar importes)

**Hoy no existe en la app**: es nuevo. Un botón de ojo (global, no solo de Plan; recordar la
elección en `settings`) que convierte **toda** cifra de dinero en «•••• €»: tarjeta, píldoras,
filas, hojas, resumen del mes cerrado, «¿Y si gasto…?». Los conteos (nº de recibos) sí se ven.
Hacerlo en los formateadores (`eur`, `eur0`, `eurParts`) para que no se escape ninguna cifra.
Dónde va el botón (cabecera de Plan o global): **preguntar al dueño**.

## 9. Primer uso (sin recibos)

Pantalla vacía con un único botón **«Empezar»** que abre la importación: lista de cargos repetidos
detectados en los bancos, todos marcados, «Quitar todos / Marcar todos», cada uno con su toggle, y
«Añadir N». Sin bancos conectados, va directo a §7.

## 10. Gestos y sensación (lo que el lienzo no puede enseñar del todo)

- **Hojas**: se cierran deslizando hacia abajo **desde cualquier punto** (no solo el asa), con
  resistencia; si estaban haciendo scroll, primero termina el scroll. Sobre hojas apiladas, cierra
  la de arriba.
- **Filas deslizables**: el gesto se decide en los primeros 8 px (horizontal si |dx| > 1,2·|dy|);
  si es vertical, es scroll normal. Umbral 90 px con vibración corta al cruzarlo; el fondo
  aparece progresivo.
- **Desplegar** cualquier cosa (Ver los N, Más opciones, Pausar, Ya pagados) hace scroll suave para
  que lo desplegado se vea; «Ver los N» deja arriba el **principio de la sección**.
- **Confirmaciones de borrar**: tocar en cualquier otro sitio las cancela.
- Reutilizar la mecánica de gesto de Plan (`14-v4-screens.js`: `TH`, `FLICK_V`, `MAX_PULL`,
  `resist`, `gestureAxis`, `pan-y`, sin `scrollTop` a mano — INC-0710-01).
- Vibración: un solo toque, respetando el «sin vibración» del sistema. Nada seleccionable salvo
  campos de texto. Animaciones con `--ease`, anuladas con reduce-motion.
- Rendimiento medido en el móvil con CPU estrangulada (AGENTS §7 bis).

## 11. Backend (ideas aprobadas, tandas propias)

1. **Lectura del banco el día del recibo**: el día que toca un recibo (y el siguiente si baila),
   una lectura programada de ese banco para casarlo solo. Dentro del límite PSD2 (~4 lecturas
   desatendidas al día por cuenta): agrupar recibos del mismo día y banco en una lectura.
   Encaja con el `pg_cron` que ya existe para el keepalive.
2. **Aviso el día antes** (notificación): «Mañana se cobra X en Revolut» solo si ese banco **no
   llega** (§4) o si es la prueba gratis que empieza a cobrar. No uno por recibo.
3. **Frescura del saldo** por banco: guardar la hora de la última lectura buena para el
   «saldo de hace 2 h».

## 12. Descartado (no hacer)

Hucha / meta de recibos grandes · aviso «Noviembre viene cargado» · sugerencias «Sube el paso a
Revolut» y «Mueve X a Sabadell» · recordatorio por WhatsApp · renombrar recibos con el nombre
original del banco · historial de importes por recibo · botón «Actualizar» en ¿Te llega? · reparto
por porcentaje en compartidos · el «+» dentro de Recibos.

## 13. Textos

Todo en **es / en / ca** (AGENTS §4). Los textos de este documento y del prototipo son la versión
es; cortos, sin explicaciones de lectura.

## 14. Pruebas

Cada lista derivada del estado lleva su e2e y su línea en `E2E_MAP` de
`scripts/relevant-tests.mjs` (AGENTS §7–8). Mínimo:

- Tarjeta: suma de tu parte de pendientes (con compartido y deuda compensada) y vista «Nov ›».
- Para revisar: cada tipo aparece en su caso, orden por prioridad, máx 3 + Ver los N, posponer
  con deshacer.
- Por pagar: máx 3, deslizar abre el selector de cargo, enlazar un cargo lo pasa a Ya pagados.
- Ficha: casos especiales y sus botones; Pausar con un recibo ya pagado no lo saca del mes.
- ¿Te llega?: recorrido día a día con una entrada a mitad de mes; banco sin saldo → «—».
- Te deben: por persona, «Ya me lo ha pagado», y que «Lo descuento» no salga aquí.
- Añadir: los 5 pasos, «Solo una vez», «En varios pagos», duplicado, compartido con 2 personas.
- Editar: «Solo octubre» vs «Desde ahora»; borrar con confirmación cancelada al tocar fuera.
- El ojo: ninguna cifra visible con importes ocultos en todas las hojas.

## 15. Orden propuesto (tandas de beta)

1. **Pantalla principal**: tarjeta resumen + píldoras, Para revisar (máx 3), Por pagar (máx 3),
   Ya pagados plegado, Todos. Ficha del recibo con estado normal y «¿Cuál es el cargo?».
2. **Casos especiales** de la ficha + posponer + Pausar (`pausedFrom/pausedUntil`) + enlaces de
   baja verificados.
3. **¿Te llega?** (recorrido, frescura, ¿Y si gasto…?, nómina editable).
4. **Añadir/editar por pasos** (incluye Solo una vez, En varios pagos, Visto en tu banco, alcance
   Solo este mes / Desde ahora).
5. **Personas y compartidos** + Te deben + compensación con deuda.
6. **Resumen del mes cerrado** + vista «Nov ›» + primer uso.
7. **Backend**: lectura el día del recibo, aviso del día antes.

Cada tanda por el canal `beta` con su guion en el panel; nada directo a `main` (AGENTS §6).
Las fases 5 y 7 tocan modelo de datos/servidor: **preguntar al dueño antes de migrar nada**.
