# Arquitectura — Aely

## Cola de revisión beta (4.26.92)

El recibo web acredita código y añade el guion estrenado en `pruebas`. La cola elimina una función antigua cuando ese guion está en producción y existe su recibo web; las diferencias en dependencias siguen en la auditoría, sin resucitar automáticamente la petición antigua. Una corrección nueva tiene nota y tanda en una versión posterior a producción. APK y Edge requieren sus recibos propios. Para recibos anteriores, solo se usa el histórico servido cuando su cabecera coincide con producción; sin evidencia se mantiene pendiente. Reabrir y volver a primer plano refrescan esta consulta de artefactos públicos, sin sincronizar bancos.


## Widget80 sobre guardias de nómina y retirada

V2 sigue dashboardBudgetStats de Inicio, declara ventana/ancla/magnitud/reservas/bancos/idioma y solo confirma eventos recibidos del último pull completo. Java conserva desconocidos hasta ACK/lápida; no inventa delta con ingestlegacy ni degrada contrato por timeout. El injerto mantiene readStartedAt/merge de79 y su conciliación de recibos, así como importación de ingresos BOOK no futuros de78. Source821 se mantiene equivalente; los cambios de esas primitivas se revisan con scopes transitorios de funciones/datos de79. APK52 exclusiva beta, no despliegue Edge/SQL. [Acta](briefs/inc-2909-01-widget.md).

## Ingresos bancarios pendientes y futuros (INC-3009-02)

`importObExpenses` admite abonos con estado normalizado BOOK o ausente y fecha bancaria
YYYY-MM-DD válida no posterior a hoy Madrid (`madridYmdParts`). Rechaza antes de seen/keys,
permitiendo que el mismo abono futuro entre al llegar su día. PDNG y estados desconocidos no
crean ingresos; sin estado conserva compatibilidad, sin confirmar por ello el flujo adelantado.
No altera cargos, saldos API ni filas históricas. El calendario de ancla/periodo local del ciclo
queda fuera y puede diferir del día Madrid en UTC. Lista blanca conserva riesgo OTHR documentado;
no añade telemetría financiera. [Acta](briefs/inc-3009-nomina-anticipada.md).


## Presupuesto de Inicio mensual (INC-2909-02)

`dashboardBudgetStats` pide modo bruto al argumento opcional `budgetMode` de `monthBudgetStats`, sin otro recorrido del histórico ni cambiar `gTotalMode`. En mes natural, frase, anillo, margen, Pregúntame, avisos y reto describen las mismas compras y el límite tras reservas. El ciclo reconocido conserva neto, incluso negativo; Gastos e informes mantienen sus propias llamadas y modos. El widget v2 sigue Inicio desde APK52; APK51 conserva su payload legado. No modifica saldos ni escrituras.

INC-0210-03, candidata84: Gastos pasa una ventana explícita opcional a `monthBudgetStats` y `categorySpentByMonth`, calculada por el mismo `presetBoundsMs` de la lista. Los demás lectores conservan su ventana anterior. Las cifras y categorías leen el mismo array diferido que las filas; búsqueda, banco y categoría siguen siendo filtros exploratorios. El rango usa medianoche/final del día locales; mes y tres meses terminan al cierre del mes seleccionado, y Mi ciclo al final de hoy. La nómina ancla y los ingresos del ciclo conservan sus reglas. Fuera del mes/ciclo actual no hay presupuesto histórico ni acumulado registrado: se muestran presupuesto/margen desconocidos con motivo y se omiten barras de límites mensuales de categoría. No modifica preferencias, datos, saldos ni el payload nativo.

## Presupuesto por cobro real (4.26.65)

`settings.budgetCycle` es opt-in y viaja con `app_state`. `budgetPaydayOf` exige un ingreso registrado de al menos 200 € en los últimos 45 días, identificable por nombre, nota/concepto bancario de nómina o por un flujo periódico de ingreso que casa por banco, mes, nombre e importe. Excluye categorías neutras, Bizum legado, fechas futuras, posibles duplicados y descartados; así un traspaso posterior no reinicia el límite. Ese cobro abre la ventana actual de `monthBudgetStats` y `categorySpentByMonth`; al cruzar el día 1 no se reinicia. La propia fila que abre el ciclo se excluye de los ingresos del presupuesto, pues en modo Balance sumarla al margen permitiría gastar por encima del límite elegido. Si falta nómina reconocida, se muestra «Sin nómina detectada» y se usa el mes natural. Gastos abre en «Mi ciclo» mientras el ajuste esté activo; una entrada desde la ficha de banco conserva su filtro específico. Sin ajuste, el filtro informativo «Mi ciclo» conserva `lastPaydayOf` y los informes con fecha explícita siguen siendo mensuales.

Desde 4.26.65, solo el ciclo activo usa balance neto como consumo del límite, aunque el mes natural esté configurado en modo Gastos. Todos los ingresos reales del ciclo reducen ese consumo, incluidos Bizums, alquileres, trabajo extra y devoluciones de cualquier banco; una nómina nueva reconocida abre el siguiente ciclo, por elección explícita del dueño. Solo queda fuera la nómina ancla, categorías neutras, lápidas, posibles duplicados y apuntes futuros. Como los gastos siguen limitados a bancos diarios, los ingresos de otros bancos pueden elevar el margen por encima del límite elegido. Los gastos siguen limitados a los bancos diarios y el desglose por categoría muestra importes brutos. La barra de Gastos usa el neto del mismo período. El filtro de bancos afecta a las filas visibles, no a esa cabecera.

Inicio, Gastos, ayuda local, logros y avisos comparten `monthBudgetStats`. El aviso de umbral se identifica por inicio de período, para que el 1 no duplique el aviso de un ciclo abierto el 26. Inicio no calcula una cuota diaria para el ciclo porque desconoce el día exacto del siguiente cobro; solo el ciclo activo excluye apuntes futuros, mientras el mes natural mantiene `endMs=Infinity` igual que el widget Android y `ingest`. El payload nativo se calcula expresamente para mes natural. No se modifica Edge, Android ni el histórico de movimientos. El cobro visible en «Mi ciclo» debe comprobarse: concepto y flujo son indicios, no una identidad bancaria inequívoca.

## Inicio, Gastos y abonos adelantados (4.26.62)

En la 4.26.62, `monthBudgetStats` conservaba la ventana de mes natural y la misma selección de bancos para Inicio, Gastos y widget. En modo Balance, `shown` es el valor absoluto de ingresos menos gastos; solo la cabecera de Gastos lo presenta como balance. Inicio usa `balance` con signo y `spent` para que un superávit nunca se anuncie como dinero gastado. El anillo sigue midiendo `against` neto, limitado a cero si los ingresos superan las compras, y lo dice en su subtítulo. La actividad del período depende de movimientos, no de que el neto sea positivo.

`flowPaidIn` conserva la regla de calendario y consulta el `bankTx` local ya descargado. Un abono único `BOOK` del banco y mes previstos, con importe compatible y hasta siete días anterior al planificado, retira el ingreso de las listas y proyecciones pendientes; un parecido ambiguo sigue previsto. `lastPaydayOf` ancla Mi ciclo al apunte real de `expenses`, sin convertirlo en identidad de una nómina. No se lanza otra sincronización ni se cambia el histórico bancario o el backend.

En 4.26.62, `reconcileEarlyIncomeAnchors` conserva en el flujo solo `paidYm/paidDay/paidBank/paidAmount` tras una atribución inequívoca. `bankTx` continúa local; el marcador y las cuentas reancladas viajan juntos en `app_state`. `monthNetForAccount` emplea el día confirmado para ese mes y el planificado para los demás. La base `value` se despeja en la misma transición con la fórmula real de `saldoCuentaMostrada`, de forma que el saldo visible no cambia al actualizar. El reconocimiento se repite sin efecto al cargar, al adoptar la nube y tras una sincronización bancaria; si no hay feed válido se conserva el estado anterior. Cerrar sesión vacía `bankTx`, y un cambio efectivo de usuario lo descarta antes de adoptar su nube; `INITIAL_SESSION` y `TOKEN_REFRESHED` conservan el feed en frío porque pueden adelantarse a `getSession`. Si hay varias cuentas de recibos en la misma entidad, `bankTx` no identifica la cuenta de destino y la confirmación automática se omite: la suma anterior de `paidNet` por entidad sigue pendiente de corregir sin alterar saldos existentes. Un cliente de versión anterior no interpreta el marcador aunque comparta `accounts.value`, por lo que no se debe sincronizar el mismo banco desde clientes de distinta versión durante la prueba. Cambiar importe o banco invalida el marcador y conserva el saldo actual. No se reconstruyen meses pasados ni se atribuyen transacciones ambiguas.

## Persistencia del widget (4.26.55)

El journal conserva eventos no cubiertos por la foto cloud. El parser tolera indentación del XML únicamente en líneas vacías e identificadores; vuelve a evaluar journalFull tras una foto de app, sin descartar entradas dañadas ni deltas desconocidos. La serialización nueva usa separadores entre eventos sin salto final. El tamaño restante sigue limitado; una recuperación necesita APK51, no OTA.

## Lápidas y contabilidad local (4.26.54)

`expenseCountsBudget` excluye filas cubiertas por `deleted` mediante `expenseIsTombstoned`; presupuesto y categorías heredan el criterio del servidor antes de `statsDelMes`. Gastos y últimos movimientos de Inicio las ocultan sin podar arrays ni borrar por ausencia. Copias de seguridad conservan el histórico crudo. No cambia identidad ni decisiones de duplicados. UUID manual y claves antiguas siguen vigentes. WeakMap indexa cada array `deleted`; los escritores lo reemplazan por copia y los memos de presupuesto dependen de él.

`expenseCountsCash` y `insumosSaldoGasto` conservan su comportamiento: no se trasladan las lápidas de presupuesto a los anclajes de saldo. Una base histórica puede haberse despejado incluyendo esa contribución; retirarla sin reanclaje verificable movería efectivo. Este arreglo del Gastado no migra bases ni pretende resolver la contabilidad de una lápida en una cuenta calculada. Tras instalar APK51, el widget recupera sus cifras y Gastado/Disponible se mantienen al reabrir. El saldo mostrado difiere de la captura anterior a abrir la app: su coherencia entre ambas fotos no queda validada. FIN-05 sigue pendiente de repetir pago real.

## Clasificación bancaria opcional (beta 4.26.53.1)

`mapTransaction` mantiene nombre/nota/identidad y transmite `concept` solo desde remittance_information más `mcc` opcional de cuatro dígitos. La descripción del código bancario sigue en note pero nunca se usa para clasificar como comercio. `flattenBankTx` y `histFlattenHistoryLinks` transmiten esos campos a `categoryOfBankTx`, usado solo al crear nuevos gastos. La categoría aprendida/reconocida por nombre gana; después concept solo con tarjeta y nombre genérico Movimiento/Movement/Transaction/vacío, excluyendo transferencia/Bizum/recibo/alquiler/nómina/devolución/refund; después MCC acotado (5411 super, 5462 pan, 5812/5813/5814 bares). Un Otros aprendido gana también; categorías neutras/modelados/ingresos conservan sus rutas. No cambia identidad, nombre persistido, dedup, lápidas, ACK ni histórico existente. Note conserva el concepto visible. Sin datos útiles, Otros. Cliente antiguo ignora ambos campos y cliente nuevo mantiene comportamiento anterior sin ellos; bank-sync compartido desplegado con autorización el 26/9/2026 (Action 36271682736, SHA 7839acb7), sin migraciones. Cliente publicado en beta 4.26.53.1, Action 36271729679/SHA f2f3839e. Sin sincronización real TR verificada; véase el brief TR para evidencia y límites.

Contratos oficiales: [Enable Banking Transaction](https://enablebanking.com/docs/api/reference/#transaction) y [Visa Merchant Data Standards, abril 2026](https://usa.visa.com/dam/VCOM/download/merchants/visa-merchant-data-standards-manual.pdf). No se ha verificado que TR entregue estos campos en una conexión real.

## Descarga de gastos cloud (FIN-07, 4.26.52)

`pullExpenses` recorre la tabla accesible por RLS con `id DESC` y `id < cursor`, en páginas de hasta 1000. Una página corta puede reflejar un límite de PostgREST; solo una página vacía termina. UUID es clave primaria estable; `fecha` puede editarse y no sirve de cursor. Se valida progreso estricto y se acumula en memoria, sin mezclar ni guardar por página. El resultado vuelve en fecha DESC/id DESC para conservar la prioridad previa de la mezcla y los ACK de FIN-05. Un error/payload inválido rechaza todo; `syncCloudExpenses` no actualiza estado ni coveredEvents con páginas parciales.

No hay snapshot común entre peticiones: filas existentes que conservan UUID y visibilidad se recorren una vez; altas en un tramo ya recorrido y ediciones posteriores a la lectura se recuperan en otro pull. Una ausencia nunca se convierte en borrado, lápida ni decisión de duplicado. `mergeExpensesFromCloud` mantiene su identidad FIN-03 y reglas de notas; una sola mezcla final conserva referencias cuando no cambia nada y el guardado partido. Con backend actual no se promete detectar filas que pierden visibilidad mientras se descarga.

`flattenBankTx` ya reúne `accounts[].transactions` sin tope global y guarda el feed diario en `bankTx`. No equivale a un histórico bancario completo: Edge diario pide mes vigente con margen, y el proveedor tiene límites de 2000 filas/12 páginas/tiempo por cuenta. El import histórico separado conserva UID/cuenta y avisos de recorte. El aplanado diario conserva banco, no UID; ampliar esa identidad exige otro objetivo. Una descarga completa de expenses no elimina estos límites externos. Sin cambio ni despliegue de Edge/migraciones. El orden por PK funciona sin nuevo índice compuesto user_id/id; su coste bajo RLS queda pendiente de medición backend autorizada.

## Liquidación y archivo de deudas (4.26.67)

`debtBalance` proyecta el saldo con `value`, `asOf` y la amortización mensual; un 0 calculado no prueba el pago bancario. `settledAt` solo se fija tras confirmación explícita en Plan → Deudas o una amortización total introducida por la persona. `archivedAt` se admite únicamente con saldo cero y liquidación confirmada; oculta la tarjeta de la lista activa, pero conserva la deuda y su `id` en `state.debts`. Gastos y sus filtros siguen resolviendo los movimientos con `debtId` contra esa colección completa. Mostrar de nuevo una deuda archivada no la convierte en pendiente: para corregir un saldo real positivo se edita, y esa edición limpia la marca de liquidación. El borrado físico se bloquea si alguna fila de gasto está vinculada. No se crean pagos ni se reescribe el histórico.

## Ahorro mensual en Metas (4.26.25)

`state.aportaciones` es planificación, no un libro de movimientos. Sus importes alimentan
`totals.ahorroMensual`, que usan las fechas estimadas de las metas y la proyección de
Inversiones. `SavingsPlanCard` devuelve la puerta a Plan → Metas y edita una copia local:
Guardar reemplaza el array una vez; Cancelar no toca el estado. Esta pantalla nunca crea
`expenses`, ingresos, traspasos ni operaciones bancarias. El importe acepta separadores de
miles y decimales del idioma sin rebajar silenciosamente una aportación.

## Plan y recibos v4.1 (4.26.8)

`planChargesMonth` en `08-motor-bank.js` es la fuente única para separar cargos pagados,
pendientes, deudas, traspasos e ingresos del mes. Es un helper puro: Plan (`14-v4-screens.js`) y
Pregúntame (`16-help-assistant.js`) consumen el mismo resultado, de modo que el anillo, la cuenta
con menos margen y la respuesta local no pueden discrepar. Una deuda sin día sigue restando como
pendiente, pero nunca se convierte en una fecha visible inventada. Un saldo ausente conserva el
estado desconocido; no se normaliza a cero.

Inicio y la clasificación de fijos de Plan usan `fixedPaymentState` para separar fecha prevista
y evidencia de pago (INC-3009-01). Un cargo BOOK hasta hoy, del banco y mes, con nombre/importe
compatibles solo acredita pago si hay un único cargo y recibo/cuenta compatible. El importe puede
ser el bruto compartido o el de esa ocurrencia del calendario. `paidYm` + `paidDay` válido conserva
la confirmación en otro dispositivo sin feed. No se escribe estado al renderizar. Sin evidencia,
un fijo vencido sigue pendiente y se muestra «Sin pago acreditado»; sin día muestra —.

Editar el día usa la misma lectura antes de persistir una confirmación. La conciliación advisory
puede aportar cobertura para `wait` únicamente con feed reciente del mismo día local; esa ausencia
no acredita un pago ni prueba impago. No dispara una sincronización bancaria automática. La
proyección monetaria (`isPaidIn`, `monthNetForAccount`) conserva su contrato de calendario para
no reanclar saldos por esta corrección de tarjetas. Deudas, puntuales e ingresos no cambian en
INC-3009-01. El caso real aún exige comprobación móvil; un feed ausente, incompleto o ambiguo
no permite identificar un recibo por suposición.

`BillsManagePush`, también en `14-v4-screens.js`, es la única pantalla de gestión de recibos. Se
abre desde Plan o desde Ajustes → Dinero. En un arranque frío, Ajustes deja la intención en
`window.__mcOpenBillsPending` y Plan la consume cuando su montaje diferido existe; no se fuerza
el montaje, no se duplica el gestor y no se toca `11-app-main.js`. Las hojas de alta y detalle son
diálogos hermanos con nombre accesible, contención y restauración de foco y pila Atrás propia.
`useEdgePageClose` es el compositor compartido con `InvestmentsPush`: dentro de la WebView acepta
el deslizamiento horizontal desde cualquier zona no interactiva; en Android 14+ consume el progreso
predictivo del borde a través de `MiCartera.setEdgeBackEnabled`. Solo hay un callback mientras una
de esas hijas está abierta y se devuelve Atrás a Capacitor si la web no confirma un receptor.
Los pictogramas de los recibos salen de `billGlyph`, un mapa local por nombre/tipo; no cambian el
banco del movimiento ni cargan una librería o servicio externo.

## Pregúntame híbrido (4.26.3)

`16-help-assistant.js` es una ayuda de una pregunta y una respuesta corta. La capa local funciona
sin red y es la única que calcula cifras: reutiliza `monthBudgetStats`, `pendingBillsSummary`,
`saldoCuentaMostrada` y la proyección de la cuenta marcada para recibos. Las acciones pertenecen
a un catálogo cerrado y solo navegan a pantallas existentes; no escriben dinero ni disparan
sincronizaciones. `HelpHost` vive fuera de las pestañas y espera el montaje de Plan mediante
`requestAnimationFrame` acotado, sin cambiar `PlanTab` ni `11-app-main.js`.

La Edge `help-assistant` es un clasificador opcional, no un asesor financiero ni una segunda fuente
de cifras. Recibe exclusivamente `question` y `language`, verifica sesión y límites y pide a OpenAI
ids estructurados de tema/intención/banco. Nunca recibe estado, cuentas, movimientos, saldos o
reglas personales. Cliente y servidor rechazan patrones de IBAN, tarjeta, PIN/CVV, contraseña,
clave y token; cliente y Edge validan además el cruce tema→frase antes de mostrar una acción.

La consulta requiere consentimiento informado y revocable. Usa Responses, Structured Outputs,
`store:false`, salida de 180 tokens y `reasoning:low`; el modelo se elige con
`OPENAI_HELP_MODEL` y por defecto es `gpt-5.6-sol`. Sin `AELY_HELP_AI_ENABLED=true` o
`OPENAI_API_KEY`, devuelve 503 controlado y la ayuda local continúa. 404, 429, 503 y timeout nunca
se presentan como una respuesta de IA. Activación, coste y límites están en
[`briefs/asistente-hibrido-2026-09-16.md`](briefs/asistente-hibrido-2026-09-16.md).

## Lectura bancaria (4.25.4)

`bank-sync` usa `fetchBankTransactions` para sync e histórico: continúa aunque una página esté
vacía si hay cursor; máximo 12 páginas, 2000 filas y presupuesto acotado por cuenta. El deadline global
de 60 segundos permite devolver las cuentas leídas y señalar las que no pudieron consultarse. Conserva resultados
parciales y los declara con `truncated` / `transactionError`. El histórico incluye enlaces
inactivos sin consultarlos. `bankReadWarnings` traduce errores por banco en la previsualización;
el sync manual tampoco anuncia «al día» cuando la lectura está incompleta. El histórico acepta
una lista de bancos, consulta solo esos enlaces y los recorre estrictamente de uno en uno: no abre
dos sesiones PSD2 simultáneas. Tras un 429 el cliente conserva una espera de seis horas y no vuelve
a llamar ni recomienda reconectar.
La UI no manda varios bancos dentro de la misma invocación: los recorre en serie y hace una
petición `bank-sync(dateFrom,[banco])` por cada uno. Así conserva la cola estricta que evita 429,
pero cada banco estrena el deadline de 60 segundos; uno lento no puede dejar al siguiente sin
turno. La Edge deja un diagnóstico cerrado por lectura (`ok`/`empty`/`partial`/`error`, cuentas,
filas, duración y `dateFrom`) sin uid, IBAN, comercio, importe ni payload bancario.
La misma frontera rige el sync diario: `app_events` puede guardar el banco, una clase estable y
recuentos agregados, pero nunca transacciones ni campos del proveedor. El volcado temporal usado
para diagnosticar el signo de Trade Republic se retiró al encontrarlo todavía activo en una
sincronización normal; `tests/security.test.mjs` impide reintroducirlo con otro mensaje.

El cliente conserva todas las filas recibidas, sin cupo global de 150. La ventana temporal y
las reglas de dedup de la importación diaria no cambian. No se añade ninguna sincronización.

Deshacer histórico (4.19.14): calcula sobre el estado actual del updater, conserva el lote con
`cloudPending` antes del DELETE y solo limpia ese lote tras confirmación. La ausencia de sesión
es un error recuperable, nunca un borrado exitoso. Un pull concurrente no puede resucitar los ids
que acaba de confirmar el DELETE; el resto del estado permanece intacto.

## Principios de diseño

### 1. Sin JSX/Babel en el navegador
La app usa `React.createElement` directo. Meter JSX + Babel en el navegador provocaba errores de `import jsx-runtime` y pantalla en blanco. `createElement` directo = robusto y sin sorpresas. **No reintroducir un transpilador en runtime.**

### 2. Un único artefacto desplegable
`public/index.html` lleva React, ReactDOM, CSS y lógica **inlineados**. Es el artefacto que ha demostrado ser fiable.

**Fuente editable (v3.108+):** el código vive en **`src/modules/*.js`** + **`src/shell.html`**. `scripts/build-app.mjs` los ensambla en un solo `public/index.html`. El CI ejecuta `build-app` antes de sellar versión y minificar. **No edites `public/index.html` a mano** salvo emergencia (y `apk.json`).

> ⚠️ **No crear un `index.html` en la raíz.** GitHub Actions solo despliega `public/`.

**Sin CDNs de terceros en el arranque:** supabase-js, Sentry y fuentes van auto-hospedados en `public/vendor/` y `public/fonts/`. Offline completo.

**Minificación en CI:** `scripts/minify-html.mjs` — **nunca** `minifyIdentifiers` (globales `t`, `cloud`, …).

**Rendimiento (v3.108 → 3.113):**
- Lazy mount de pestañas; **cold start solo monta la pestaña activa** (vecinas tras ~1,6 s idle) — evita el tirón al abrir Gastos tras vaciar apps en Android.
- `content-visibility` en `.page`; sync/FX diferidos con `requestIdleCallback`.
- En Gastos: `useDeferredValue` + trabajo pesado (suscripciones, chips banco) solo con pestaña activa.

**Observabilidad:** Sentry opcional vía `CONFIG.SENTRY_DSN` — ver [SENTRY.md](SENTRY.md). Secret en GitHub Actions **ya configurado**; el deploy inyecta el DSN.

**Tests:** unit (Node), Deno (Edge Functions), Playwright E2E — ver [TESTING.md](TESTING.md).

### 3. Service Worker stale-while-revalidate
Caché al instante + revalidación en segundo plano. Cadena de versión sellada en CI.

**Android OTA (v3.107+ / 4.0.9):** chequeo de `version.json` al abrir / volver a primer plano / cada ~30 min **con la app abierta**, y además un **WorkManager** (~15 min, con red) que avisa con noti local **con la app cerrada**. Al tocar la noti se abre la app y aplica el bundle. Sin FCM (no hace falta cuenta Google ni tokens). APK nativo alineado: `versionName`/`versionCode` en `android/app/build.gradle` + `public/apk.json` → release GitHub.

**Reparto del código de updates (v4.1.0):** dos capas, no mezclar.
- **`12-boot.js` = transporte.** Descargas OTA/APK, registro del SW, notis. Publica `window._mc*`
  y avisa con los eventos `mc-sw-update` / `mc-ota-ready` / `mc-apk-update`.
- **`useUpdates()` en `10-app-components.js` = estado de UI.** Un solo hook con los TRES
  canales (SW web esperando · bundle OTA listo/descargando · APK nueva) + acciones
  (`applyUpdate`, `installApk`). App lo consume en una línea (`const upd=useUpdates()`)
  y pinta las pills. Antes eran 3 efectos sueltos en App — el «spaghetti» del feedback
  2026-07-18. Si tocas updates: la lógica nueva va al hook, el transporte al boot.


**Cold start (3.113.3):** Sentry se inyecta tras el primer pintado (no bloquea ~340 KB); Ajustes se monta al abrir el cajón; el swipe pre-monta la pestaña destino durante el gesto. El coste duro restante es parse del monolito + `loadState` — sin code-split no desaparece del todo.

**Splash de entrada (v4.10.0).** `#mc-load` vive en `src/shell.html`, fuera de React (es lo único que
se ve mientras arranca el bundle). Ya no se retira en cuanto React pinta: espera a
**`window.__mcBootReady`**, que pone `mcBootReady()` (`00-core.js`, idempotente) desde cuatro sitios
—sin nube, sin sesión, con el candado o en el alta, y al terminar el primer `syncFromCloud`—.
Motivo: el estado local se pinta al instante y la nube tarda, así que se veía el patrimonio VIEJO y
un segundo después el bueno (vídeo del usuario: 125.899 € → 189.371 €). Topes en el vigilante:
1,8 s de espera y, si React ni siquiera ha pintado a los 8 s, un botón de reintentar — antes el
`clearInterval` de emergencia dejaba el splash puesto para siempre y sin salida.

Desde 4.25.1, si `navigator.onLine===false`, App y Dashboard abren `mcBootReady` inmediatamente:
`loadState` ya terminó de forma síncrona y esperar a la nube solo creaba un frame vacío. Con red se
mantiene el margen para evitar el salto de cifras. Ajustes guarda `_mcAdminProfile` únicamente con
`uid` + `isAdmin:true` para conservar la zona Dev sin red; es una preferencia visual por usuario,
se borra al cerrar sesión y nunca sustituye la RLS que protege los datos administrativos.

**Presupuesto de tamaño (v4.10.0):** `tests/presupuesto-rendimiento.test.mjs` mide el artefacto
minificado y su gzip contra topes escritos a mano. Es la otra mitad del rendimiento: `e2e/rendimiento`
vigila que el trabajo no crezca con el histórico; esto vigila lo que hay que bajar y parsear.

### 4. Migraciones de datos versionadas
`_dataVer` en `localStorage` permite cambiar la forma de los datos sembrados sin borrar los del usuario.

## Flujo de datos

### Consulta de copias (OPS-02, publicada4.26.56)

`AutoBackupsPanel` valida la copia y la mantiene en su estado React propio. El visor compara
UUID/campos e importes guardados con la cartera actual y pagina los registros. No llama al
`set` de App, `mcSaveRaw` ni a escritores cloud; el pull ordinario de App continúa sobre la
cartera activa, sin mezclar la copia. Legado/UUID repetidos de la cartera actual quedan sin
correspondencia segura. Copia corrupta rechazada antes de abrir.
La recuperación compartida permanece desactivada: el antiguo reemplazo conectado, reproducido
en la base `f7b66aef`, modificaba `app_state` y podía resucitar borrados por backfill. El diseño
de una aplicación financiera requiere identidad/revisión/ACK y autorización propios.
[Ensayo histórico, aceptación del visor y límites](briefs/ops02-restauracion-probada.md).

El widget recibe `monthBudgetStats` desde la app al cambiar sus cifras. Al volver a primer plano,
`visibilitychange` o `App.appStateChange` disparan primero la lectura de gastos de Supabase y
solo tras completarla se envía el snapshot local: el estado anterior a la notificación no puede
deshacer su cifra. No se sincroniza Open Banking. En Android, `WidgetSnapshotArbiter` asigna un
ticket a cada ingest: el absoluto mensual más reciente gana por `readAt`, cada evento mueve el
efectivo de TR una sola vez. Cada push lleva los IDs vistos y las lápidas; el nativo reaplica
los eventos todavía ausentes del pull y descarta los cubiertos o borrados. Los eventos aún en
vuelo se aplican por su contribución a gasto y presupuesto; una inversión
planificada baja el efectivo sin volver a reservarse en la liquidez segura. El período
es Europe/Madrid; si cambia sin una lectura nueva, el widget muestra «—» hasta recibir datos.
Al convertir `expenses` con `expenseFromRow`, las categorías especiales `ingreso`, `inversion`
y `traspaso` se conservan aunque no pertenezcan al catálogo ordinario de categorías.

La categoría elegida a mano no la deshace un pull (4.26.86). Antes de mezclar,
`keepCategoryChoices` mira la procedencia local de la fila: `catStale` son las categorías que
la tabla puede devolver todavía y `catAckAt` la hora en que `cloud.setExpenseCat` confirmó que
escribió al menos una fila. Sin confirmación se conserva lo local y se reintenta con el id de la
fila de la nube. Con confirmación, una lectura empezada después es la verdad, diga lo que diga.
Ninguno de los dos campos viaja a la nube.

Las equivalencias futuras son `catRules` (en `app_state`): comercio exacto + banco + con o sin
tarjeta → categoría e instante en que se enseñó; vale para fechas posteriores a ese instante. Solo las aplica el pull, y solo a filas que el
dispositivo ve por primera vez. `catOverrides` sigue siendo lo que usan las palabras clave al
importar. Como `app_state` es último-en-escribir-gana, una regla recién creada puede no haber
llegado a otro dispositivo, o perderse si este sube un estado más viejo: allí la fila entra con la
categoría del servidor hasta que la tabla reciba la corrección. El servidor sigue categorizando
por palabra clave.

```
[Notificación TR en Android]
        │  Lector nativo Aely
        ▼
[POST → Edge Function `ingest`]   (?token= por usuario)
        │  clasifica + categoriza (KW)
        ▼
[Postgres: expenses]  → app al volver a primer plano o al Sincronizar

[Notificación Caixa/Sabadell/…]
        │  bankNotif → runBankSync (sin parsear importe)
        ▼
[importObExpenses]  settings.expenseBanks → Gastos (ent en source ob:…)

[Sugerir categoría]
        │  cloud.suggestCategory(merchant)
        ▼
[Edge `categorize`]  KW → si otros y OPENAI_API_KEY → LLM acotado
```

El lector Android asigna a cada notificación de compra una identidad estable con origen, paquete,
`StatusBarNotification.getKey()` y `postTime`; el fallback usa paquete, id y tag. No incluye título
ni texto porque Wallet puede reformular una compra ya entregada. La Edge `ingest` persiste esa
identidad en `expenses.ingest_event_id` (migración 0025) y solo devuelve confirmación después de
insertar. Un reintento o una carrera `23505` devuelve el gasto ya existente. Si Wallet identifica
la tarjeta de TR y coincide el importe dentro de dos horas, la segunda señal se descarta en silencio;
dos avisos de la misma puerta se conservan porque pueden ser dos compras reales. El orden de
despliegue es migración 0025 → `ingest` → APK: una OTA sin APK no cambia la identidad nativa.

Mientras siga instalada una APK anterior, Wallet y TR pueden llegar sin `ingest_event_id`. Para
cerrar también la carrera entre dos POST simultáneos, `ingest` inserta cada compra como pendiente,
repite la comparación cuando la fila ya existe y solo entonces libera la más antigua. Sin identidad
nativa no se borra por parecido: la posterior se conserva con `#dup`, fuera de las cifras, y al
APK antiguo se responde `skipped` para no duplicar la confirmación. Con identidad actual, la señal
cruzada posterior sí se retira. Si la
comprobación, retirada o liberación falla, el defecto seguro es dejar la fila posterior pendiente y
fuera de las cifras, nunca sumarla a ciegas ni pedir al usuario que resuelva el doble aviso normal.
La decisión «Es el mismo» / «Son distintos» se mantiene para coincidencias de Open Banking, que sí
pueden ser ambiguas. La búsqueda del lector se limita a orígenes de
notificación —no a filas de Open Banking— y un pull que coincida con la breve fase pendiente adopta
después también el origen confirmado por el servidor.

Cotizaciones: Edge `prices` → Finnhub/Yahoo. FX: Frankfurter `EUR→USD,GBP,CHF` → `state.fxRates` (XXX→EUR) + `state.fx` (USD legado). Coste invertido editable ancla `costEur`. Moneda de visualización (`DISP`): EUR/USD/GBP/CHF desde 4.1.0; sin FX descargado se queda en € (nunca inventar tipo).

### Open Banking: sync SOLO a demanda (v4.1.0)

El auto-sync al abrir/volver a primer plano **se retiró**: una consulta PSD2 desatendida en
cada apertura hacía que Caixa/Sabadell marcaran el consentimiento como uso robótico y lo
caducaran «cada dos por tres» (feedback 2026-07-18). Syncs que siguen vivos, todos «con motivo»:

| Disparador | Dónde |
|---|---|
| Botón «↻ Sincronizar bancos» | Cartera, junto a «Tus cuentas» (visible con `hasBankLink`) |
| «Actualizar» de un banco | Ajustes → Mis bancos |
| Recién autorizado (`?bank=ok` / goto `bank\|ok`) | `11-app-main.js` |
| Noti del banco (evento real del usuario) | apagado por defecto; si se activa expresamente, presupuesto persistente de 1 cada 12 h |

El sincronizador general también consulta el puente nativo de Trade Republic cuando existe. Su
`availableCash` y la tarjeta específica de TR pasan por el mismo reanclaje (`applyTrCash`), para
que dos botones equivalentes no dejen saldos distintos. En enlaces Open Banking multicuenta, los
movimientos se leen desde cada `accounts[].transactions`; el bloque superior es solo la copia
retrocompatible de la primera cuenta y no se suma dos veces.

Un fallo pasajero no equivale a un permiso caducado. Open Banking solo pone el enlace en
`expired` ante un `EB 401` firme; 403/404, límites 429, 5xx y timeouts conservan el enlace activo.
Trade Republic guarda aparte `_trAuthExpired`: que el puente arranque todavía sin sesión visible
no enciende el aviso de reconexión. Al sincronizar a mano se intenta primero reutilizar y validar
la sesión guardada, y solo una respuesta explícita `authExpired` pide volver a iniciar sesión.

El presupuesto de notificaciones vive en `localStorage`, no solo en memoria, para proteger también
los APK ya instalados que reciben el cambio por OTA. El cooldown por 429 también persiste ahí para
que repetir un botón no vuelva a gastar peticiones durante la ventana indicada por el proveedor.

**No reintroducir** un sync por apertura/foreground sin repensar esto: el histórico está en el
CHANGELOG 4.1.0 y en el comentario del propio código.

**El `state` del OAuth (v4.10.0).** `bank-connect` genera un `state` (uuid, con sufijo `.app` si la
petición viene de la APK) y lo guarda en `bank_links` junto a `state_issued_at`. `bank-callback`
—que no tiene sesión— localiza al usuario por ese `state`, y es lo ÚNICO que ata la vuelta del banco
con una cuenta. Como viaja en la URL de vuelta (historial del navegador, Referer, logs por el
camino), ahora **caduca a los 30 minutos** y **se gasta**: se pone a `null` ANTES de canjear el
`code`, así que un fallo a mitad tampoco lo deja vivo.

### Seguridad de las Edge Functions (v4.10.0)

| Qué | Dónde | Nota |
|---|---|---|
| CORS con lista blanca | `_shared/cors.ts` → `withCors(handler)` | Envuelve el handler entero: pasan por ahí TODAS las respuestas, incluidas las de los `catch`. El origen sale de `APP_URL` + `https://localhost` (WebView APK) + localhost con puerto. |
| Límite de peticiones | `_shared/ratelimit.ts` + migración `0019` | En Postgres (una sentencia atómica), no en memoria: los isolates van y vienen. **Si falla, deja pasar.** |
| Token de ingest | cabecera `x-ingest-token`, comparación en tiempo constante | Desde 4.9.0; en query string aún se acepta por compatibilidad con APKs viejos. |

`tests/edge-sintaxis.test.mjs` hace cumplir la primera fila: falla si alguna función vuelve a
escribir `Access-Control-Allow-Origin: "*"`.

### Cartera v4: quién edita qué (v4.1.0)

- Cuenta **manual**: nombre + rol + saldo editables (Cartera → Editar).
- Cuenta **re-anclada por el banco** (tiene `bankIban`): solo nombre + rol; el saldo lo trae
  el banco (mostrarlo bloqueado, no dejar mentirse). Esta distinción es además la base de la
  posible capa freemium (ver ROADMAP).
- Cuenta **extra OB** (`obAccounts`): abre la misma ficha, con saldo bloqueado; permite renombrar
  (`obLabels`) y solo se promociona con rol mediante una elección explícita (`promoteObAccount`).
  Su posición se guarda en `settings.accountListOrder`, mezclada visualmente con `accounts` sin
  moverla de modelo ni alterar saldo, rol o presupuesto.
- La ficha guarda un cierre diario real por cuenta en `accountBalanceHistory`, indexado por la
  misma clave estable del orden (`acc:<id>` / `ob:<key>`) y limitado a 31 puntos. El gráfico de
  14 días y la variación desde el día 1 solo aparecen cuando existen esos cierres: no se reconstruye
  saldo histórico a partir de gastos ni se atribuye la previsión agregada si hay dos cuentas del
  mismo banco. El primer cierre espera `mc-boot-ready`, que ya representa dato local definitivo sin
  red o el final del primer pull con red; así un snapshot viejo no se convierte en base mensual.
- El rol (recibos/diario/todo) vive AQUÍ; en v4.0.x quedó inaccesible (solo existía en el
  Wealth v3 no montado) — no volver a dejar el rol sin puerta.
- Inversiones abre como pantalla hija propia desde Cartera y solo actualiza precios cuando se pulsa
  su acción: no hay sincronización al montar. Auto precios y Proyección viven en Ajustes → Dinero;
  Redondeo y Saveback siguen en Cartera porque afectan al flujo diario, no a la valoración.

> **Apps Script / `GAS_URL`: archivado.** No reabrir.

## Aprendizajes clave

- Repo público → jamás secretos ni CSV reales.
- Fuente única: `src/modules/` + `npm run build`.
- Diálogos: `askText` / `askConfirm` (no `prompt` nativo).
- APK `apk.json`: URL = nombre exacto del asset.
- RLS Hogar: no hacer EXISTS sobre `household_members` desde su propia policy → `0014` + `is_household_member` SECURITY DEFINER.
- **Rediseños: auditar puertas de entrada.** La v4 dejó huérfanos el rol de cuenta, Hogar/Compartido, la huella y el logout — todo código vivo sin camino en la UI (se recuperaron en 4.1.0). Al quitar una pantalla, listar qué solo se alcanzaba desde ella.
- **Props que sombrean globales:** `Shared({uid})` tapaba el generador global `uid()` y crear un grupo petaba. Si un prop se llama como un global, renombrar al destructurar (`uid:userId`).
- **Carruseles horizontales dentro del track de tabs:** necesitan `stopPropagation` en touchstart/touchmove (metas de Inicio, chips de Gastos) o el gesto mueve las dos cosas a la vez.
- **PSD2 y syncs desatendidos:** consultar el banco en cada apertura ≈ bot → consentimiento caducado. Sincronizar solo con motivo (acción del usuario o evento real).
- **`navigator.share` en WebView** puede rechazar en silencio: siempre con fallback (descarga) + aviso.

---

## Estado de fases

| Fase | Contenido | Estado |
|------|-----------|--------|
| **0–4** | Control, Supabase, multi-usuario, RGPD, APK/OTA | **HECHO** |
| **5** Nice-to-have | Metas, gráficas, notis, FX multi, categorías IA opcional | **HECHO** en lo razonable |

### Multimoneda (v3.113)

- **Hecho:** tipos vivos USD/GBP/CHF→EUR; patrimonio/inversiones/OB vía `toEurAmt` / `invValueEur` / `invCostEur`; anclar `costEur` al editar coste.
- **No es (ni se persigue):** contabilidad de doble partida con FX histórico por cada compra antigua sin fecha, ni paridad al céntimo con Revolut (spread del bróker).

### Categorías IA (v3.113)

- KW locales + Edge `categorize` + toggle Ajustes. Ver [CATEGORIZE.md](CATEGORIZE.md).
- Sin `OPENAI_API_KEY`: solo KW (comportamiento seguro y barato).

---

## Backlog actual (post v4.1.0)

### Hecho reciente
- Lote feedback 2026-07-18 (v4.1.0): OB a demanda, Cartera editable completa (rol/bienes/inversiones), gráfico multiseleccionable, Hogar/huella/logout recuperados, monedas £/CHF, `useUpdates()`, nav flotante, Ajustes compacto+animado, sugerencias con pantalla propia, informe con fallback.
- v4.0.x: rediseño completo (SPEC-v4), MyInvestor login desde el móvil, OB sin falsos «caducado».

### Pendiente (a demanda)
- **MyInvestor captcha:** el plumbing está en 4.6.0 (`miDeviceLogin` acepta `captchaToken` → cabeceras `X-Recaptcha-Token`/`X-Recaptcha-Action`). Falta la WebView nativa que resuelve el reCAPTCHA de `myinvestor.es` y produce el token (site key + APK). Ver ROADMAP.
- **Logos de banco auto-hospedados** en las filas de cuentas (ver ROADMAP).
- **Freemium / suscripciones** (ver ROADMAP — solo diseño, nada implementado).
- Play Store (Data safety + NotificationListener).
- Feedback de uso real.

### Elección del banco del widget (4.26.50)

`settings.widgetBank` guarda una entidad bancaria del estado principal. `widgetBankOf` resuelve la elección y vuelve a la cuenta `spendFrom` si falta. App envía `cashEnt`, `cashLabel`, `cash` y `safeLiq` de ese banco con el presupuesto global existente. El efecto depende también de `cashEnt`: bancos con cifras iguales deben actualizar el widget. No cambia los roles, filtros de gasto, servidor ni contrato nativo; las cuentas del mismo banco se agregan. Efectivo y Familia se excluyen de la elección explícita y sus opciones. El automático conserva el spendFrom original, incluido Efectivo si era diario.

FIN-06: FX puro devuelve null sin tipo (nunca 1:1). Las sumas vivas omiten conversiones desconocidas con aviso de total incompleto; el original permanece en cuentas OB/inversiones. No se ancla ni registra histórico EUR incompleto. Frankfurter v1 descarga todo el catálogo BCE y conserva tipos guardados para offline; USD de respaldo procede de state.fx, sin valor ficticio para estados nuevos. Movimientos persistidos siguen en EUR y no se migran.

## SEC-03: frontera de diagnósticos

Cliente probado y aprobado en beta 4.26.57.1; entrega exclusiva cliente 4.26.57 mediante PR49, Edge sin despliegue: los errores automáticos se reducen antes del transporte a operación y clase cerrada; app_events ya no añade el correo de sesión. El sobre Sentry se reconstruye por lista permitida (tipo/código/posición/versión/plataforma), sin contextos, breadcrumbs, tracing ni URL de petición. Feedback y notas de beta explícitos redactan patrones sensibles y filtran campos, con límites semánticos. user_id sigue siendo necesario para RLS: no es telemetría anónima. Matriz, pruebas y límites Edge/gateway en [SEC-03](briefs/sec03-privacidad-logs.md).

## Evidencia de pago de recibos · INC-3009-01

Inicio y Plan consultan `fixedPaymentState`. El feed BOOK solo acredita un cargo del mes, no futuro, con nombre/importe/banco compatibles y atribución única. El importe sin identidad no prueba pago. En la sincronización bancaria a demanda, `reconcileFixedPaymentProofs` conserva esa evidencia en `fixed[].paymentProofs[year*12+month]`, dentro de app_state; bankTx continúa siendo local y no viaja a la nube.

Gastos → ficha → «Paga un recibo» permite confirmar explícitamente un cargo con nombre u origen bancario distintos. Requiere un único movimiento positivo, no duplicado/neutro/borrado ni asignado a deuda, del mes del recibo. El previsto no es una factura: una igualdad o tolerancia de importe excluiría agua variable y divisas. El diálogo muestra importe real y previsto y exige afirmar el pago completo; si es parcial se cancela. Ninguna diferencia acredita pago automáticamente ni aprende por parecido. El vínculo se puede deshacer. La prueba conserva identidad, banco, fecha e importe del cargo y firma del modelo; cambios de nombre, cuenta o importe la invalidan, y el cargo no se reutiliza para dos recibos. Sin feed ni expenses locales, la confirmación viaja con el fijo. Una lápida, duplicidad, PDNG o asignación a deuda/ingreso observados impiden usarla; el id detecta ediciones que cambiaron su clave.

`paymentProofs` solo clasifica evidencia en la UI: no escribe `paidYm`, `paidDay`, cuentas, gastos, categoría ni anclajes. Las proyecciones de saldos mantienen su contrato anterior; vincular no aplica otro descuento ni resuelve duplicidades históricas de dinero. No se añaden sincronizaciones automáticas, tablas, funciones Edge ni cambios nativos.

En «Ya pagado», `paidBank` muestra el banco real del cargo confirmado. El banco previsto del recibo continúa en `bank` para su calendario y proyección: acreditar un pago desde otra entidad no cambia automáticamente los recibos futuros.

Si el importe bruto real difiere del previsto, Plan muestra «Cargo» con el bruto acreditado y «Previsto» con la magnitud del calendario, también en el total. `paidAmount` y `plannedBankAmount` solo permiten nombrar esa diferencia; `amount` sigue siendo la previsión propia. Un compartido previsto de42 bruto/21 propio y cargo real44 no permite inferir22 propios. La vinculación conserva21 previsto y muestra44 de cargo por separado, sin recalcular saldo ni gasto.

Al renombrar un cargo bancario con nombre original estable, el editor retira la clave vieja para que no se reimporte. `rekeyFixedPaymentExpense` sigue la nueva clave únicamente si identidad bancaria/id, modelo, elegibilidad y unicidad siguen vigentes; conserva los campos de pago y el saldo. Una lápida del cargo nuevo continúa siendo destructiva. Renombrar una notificación sin nombre original estable cambia identidad: la prueba deja de acreditar y requiere confirmación explícita nueva. Una prueba válida tras renombrar también viaja en app_state sin gastos locales; estado y gastos siguen siendo transportes separados, sin transacción distribuida nueva.

## Panel beta: identidad y entrega (OPS-3009-03, integración75)

`scripts/beta-sources.json` declara fuentes y bloques inequívocos por tanda/superficie; `beta-revisions.mjs` normaliza CRLF y genera SHA-256. Una tanda moderna sin alcance o bloque activo ausente/ambiguo aborta build. No hay fallback global ni recibo de Android/Edge a partir de Git. `beta-delivery.json` acredita web ensamblada y sourceSha real en CI (null local). Los alcances no son un análisis automático de dependencias: deben auditarse al cambiar lectores o helpers.

`betaHuella` combina guion y código; `betaVerdictFor` comparte reglas entre panel y listo. Última decisión rechazada/retirada prevalece, historial conserva decisiones anteriores, desde solo hereda código/guion iguales auditados. Tres revisiones siguen idénticas; cuatro widgets cambian realmente en web por Inicio73, sin cambios Android/Edge ni referencia histórica repinada. Aprobación y entrega exacta son distintas; sin recibo de una superficie requerida se conserva pendiente. El APK51 es legado y no acredita widget52.

## Ampliación auditada de cobertura (panel75)

`beta-source-code.mjs` delimita declaraciones con vm.Script y contempla funciones, const/flechas, datos de nivel superior y sus dependencias transitivas de lógica00/01/08. Ignora comentarios, textos, regex y propiedades; distingue lecturas en ternarios y recoge varias variables de una declaración. Una plantilla interpolada no admitida aborta. Los guardianes mutan cuerpos y valores de cada dependencia; una ancla que desaparece debe abortar build. Se incluyen zona horaria/cachés de mes, REC_GRACE, categorías/reglas, CONFIG, lápidas, divisa y formato numérico. Solo datos de textos/idiomas se excluyen con motivo explícito en benignData; benignCalls conserva sus excepciones de traducción/transporte/telemetría. El recorrido de identificadores es conservador y no es un análisis general de llamadas dinámicas, aliases/métodos o variables de otros módulos; los alcances requieren revisión al editar lectores.

TR y ayuda conservan fuente idéntica tras ampliar cobertura; sus hashes ampliados se calculan desde17aeacc03f595412c044d276c900707cbbd008c8. Arranque se compara desde26972970d216f272b0d555d7d8548bb99afd6ba5. `auditoria.ampliada` identifica ese commit, huella original y digest de las superficies ampliadas. El builder verifica identidad del commit y correspondencia con codigoDesde/revisionesDesde originales, conserva esos datos en referenciaAnterior y compara con el digest histórico ampliado. src conserva intactas las siete referencias originales; un helper nuevo que difiere del commit histórico exige revisión nueva, aunque versión y guion sean iguales. No se pincha el baseline a HEAD. El builder vuelve a leer Git histórico y calcula el digest del descriptor almacenado en auditoria.ampliada.scope: rechaza incluso metadata forjada de forma coherente con un helper de HEAD. Si falta el commit/archivo histórico, aborta; Tests descarga fetch-depth:0. Una ampliación futura conserva el descriptor anterior hasta que se audita otro desde el mismo commit.

## Reconocer una retirada importada (candidata INC-2909-03)

`confirmExpenseWithdrawal` confirma `cat:traspaso` por UUID del usuario, atributos y `source` exactos,
con comparación de la categoría previa y RETURNING de una sola fila. No usa el fallback por terna;
sin ACK no hay cambio local. El sello local `withdrawalConfirmedAt` protege únicamente pulls iniciados
antes del ACK; `syncCloudExpenses` pasa el instante de inicio a la mezcla. No se amplía FIN-04 ni se
remapea identidad. La oferta de sumar una retirada importada a efectivo se retira mientras falte un
registro atómico entre tabla y cuenta: una importación nunca incrementa por esta puerta `accounts.value`.
Los apuntes manuales de efectivo siguen disponibles. [Contrato y límites](briefs/inc-2909-03-retirada-caixa.md).

`withdrawalReceiptLink` lee la prueba durable expense del mes por key/UUID/identidad bancaria,
sin exigir que este móvil tenga feed válido. Esa misma lectura deja visible Deshacer vínculo;
la retirada exige quitarlo primero mediante `linkFixedPayment`. El método cloud exige un lector
del estado actual y revalida antes de escribir. Tras UPDATE devuelve solo el ACK válido, con
una marca efímera `withdrawalUpdated` que no se escribe en la tabla. Rechazar ese ACK porque
llegó un vínculo dejaba la fila remota neutra y paid=false en A tras pull, pero paid=true en B
sin feed. `reconcileConfirmedWithdrawal` vuelve a comprobar UUID/atributos/categoría local y,
solo con ese UPDATE confirmado, deshace la prueba expense coincidente por el helper existente
antes de aplicar la retirada. No borra otros cargos/meses, paidYm/paidDay, cuentas ni importes.
La ficha informa de que el recibo queda pendiente y se compartirá al sincronizar. Un ACK de
lectura, ausente, inválido o denegado no permite deshacer pruebas. Ambas puertas de Paga un
recibo esperan mientras la retirada está pendiente. `linkFixedPayment(null)` elimina la prueba,
no crea una lápida: sincroniza metadatos mediante el CAS existente de app_state. No hay
transacción entre expenses y app_state ni garantía de atomicidad entre clientes; un timeout con
commit remoto sin ACK y la concurrencia posterior siguen requiriendo conciliación separada.

## Revisión de comprobaciones: persistencia81

_betaReviewMarks guarda por huella {marks:{indice:estado},notes:{indice:comentario}}. El lector migra marcas antiguas solo si su propietario/alias auditado coincide; un texto repetido no identifica una tanda. Los veredictos enviados tienen historial separado: eliminar marcas no invalida un OK vigente, y una decisión posterior veta la anterior. Empezar de cero vacía progreso/comentarios scoped sin eliminar una retirada guardada.

`build-app` incorpora `_rnSha`, SHA-256 del catálogo JSON completo, en una variable propia del panel fuera de CONFIG. `ensureReleaseNotes` exige que WebCrypto confirme esa identidad antes de aceptar o guardar las notas; una respuesta exitosa antigua del Service Worker tampoco vale. `_rnBetaRound_` usa la compilación completa (incluido el sufijo) y guarda `{sha,notes}` con una entrada por tanda moderna. Solo recupera ese envelope cuando su identidad coincide con el bundle actual. No rescata `_rnHead_` sin verificación. Sin WebCrypto, catálogo válido ni caché de esa compilación muestra comprobaciones sin confirmar, conservando el historial de decisiones. No acredita entrega ni aprobación. La identidad de las tandas y sus equivalencias se generan desde unidades y SHAs Git auditados; Android/Edge requieren sus recibos propios.

Al aceptar un catálogo verificado se purgan únicamente otras claves `_rnBetaRound_*` antes de escribir la actual, para liberar cuota compartida con los datos financieros. Panel y Novedades muestran un reintento explícito si no hay notas verificadas; vuelven a aplicar el mismo SHA-256 y mantienen desconocido hasta recuperar el catálogo.

Sin versión de producción, betaChecklist conserva todas las tandas modernas hasta la versión actual y añade una sola vez la nota actual con puntos implícitos. Una nota con tandas:[] no aporta puntos; la cabeza moderna ya incluida no se duplica. No altera las huellas ni acredita entrega por número de versión.

INC-0210-01: el estado visual de una cuota y sus eventos futuros consumen debtPaymentState (vínculo explícito del gasto, cargo válido y único, mes de vencimiento cercano). El saldo actual y el principal siguen usando sus anclas/fórmulas anteriores; reconocer un cargo ya incluido por el banco no vuelve a descontarlo. No hay nuevo emparejamiento por nombre ni escritura en el histórico.

## Liberación de reservas de Metas (INC-0310-01)

Borrar una regla confirmada elimina su configuración y añade asientos de reserva inversos con la misma fecha/identidad, `releaseOf` y fecha de liberación, solo para asignaciones comprobables con identidad única y sin liberación previa. Una configuración reaparecida no permite compensar dos veces. Liberaciones parciales o registros ambiguos conservan el pendiente para revisión separada. No borra asientos originales, ahorro aportado ni movimientos bancarios. El total del registro libera únicamente el descuento atribuido a esa regla; cliente y servidor actuales lo leen igual. La identidad de nómina permanece aplicada. Configuración y log viajan juntos por `slimForCloud` y el sync last-write-wins existente; no se promete reconciliación de escrituras simultáneas ni reparación de reglas huérfanas antiguas. [Contrato y pruebas](briefs/inc-0310-01-meta-regla.md).


Movilidad88 conserva el histórico y todos los contratos87; catálogo diario añade multas/zona_azul/peajes solo para altas inequívocas. Los lectores financieros siguen los mismos IDs y gastos diarios; no añade sync automático.

### Resultados de brókers (4.26.89, candidata)

El resumen manual conserva por separado éxito, caducidad y fallo temporal de Trade Republic y MyInvestor. Un éxito parcial se presenta aunque el otro falle; una consulta MyInvestor fallida no se interpreta como ausencia de enlace. TR continúa a demanda y MyInvestor conserva el throttle automático. No cambia la aplicación de posiciones ni se despliega servidor.

## Guardado del estado: solo lo comprometido (4.26.94)

El estado se escribe en disco desde un `useLayoutEffect` de `App` que corre tras cada commit y llama a `mcPersistCommit` (00-core): apunta el estado recién pintado como volcado pendiente, marca el histórico de gastos solo si cambió su referencia y arma, si no lo había, el temporizador de 400 ms. `set()` solo calcula el estado siguiente y sella `_savedAt`; no apunta nada ni arma temporizadores.

Antes el volcado se apuntaba dentro del updater de `set()`. React puede ejecutar un updater sobre un estado que luego abandona —dos escrituras encoladas en el mismo instante, una urgente y otra no— y después reutilizar un resultado ya calculado sin volver a llamarlo; el volcado se quedaba entonces con el estado abandonado. Se vio en el alta de reglas de Metas: en pantalla la regla no existía y en disco sí. Un estado que la app nunca llegó a tener no se guarda.

Como es código común, el bloque de guardado forma parte del alcance de revisión de toda tanda cuyo código llama a `set` de App (18 de 25, decidido contra el código por `beta-sources`): cambiarlo vuelve a pedir su prueba. Una aprobación heredada por equivalencia de código deja de aplicarse cuando el código cambia; su registro histórico no se toca.

Se conserva lo demás: una escritura como mucho cada 400 ms, volcado inmediato en `pagehide` y al pasar a oculto, guardado partido (`micartera_v3` y `micartera_v3_exp`), ninguna escritura al montar ni cuando un updater devuelve el mismo estado, y las salvaguardas del modo pruebas (`mcSkipPersist`, `mcRecargarSinVolcar`). Límite: una escritura pedida y aún no pintada cuando llega `pagehide` no se vuelca; antes tampoco estaba garantizado, salvo cuando React la calculaba por adelantado.

## Canal de agentes en nube (rama de coordinación)

La coordinación externa no usa el estado financiero ni la sincronización de la app. En codex/coordinacion, coordination/tasks conserva encargo, reserva y cierre inmutables; coordination/messages conserva mensajes públicos. scripts/coordination-channel.mjs publica un único fichero desde el SHA remoto con índice temporal, push normal y lectura posterior. No incorpora el checkout del llamante. El contrato de concurrencia, privacidad y separación de dispositivo real está en COORDINACION-AGENTES.md. No fusionar esta infraestructura del canal a producto para transmitir mensajes.
