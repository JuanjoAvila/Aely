## [4.26.24] - 2026-09-23
### El carrusel vuelve a responder en el fondo sin romper la ola nativa

La guarda del borde inferior rechazaba cualquier eje horizontal para proteger el rebote de Android.
Eso evitaba una regresión anterior, pero también obligaba a subir contenido antes de poder cambiar
de pestaña. En el fondo se conserva la prioridad del scroll para gestos verticales y diagonales, y
solo se entrega al carrusel un horizontal deliberado de más de 60 px con deriva vertical mínima.

Las superficies mantienen su `overflow` y el desplazamiento táctil, pero ocultan el indicador con
las propiedades nativas de Firefox, motores antiguos y WebKit. El E2E baja hasta el fondo real,
comprueba tanto el cambio de pestaña como las diagonales de rebote y abre Ajustes para verificar que
la barra lateral no se dibuja. Sin cambios de datos, backend, Android ni APK nueva.

## [4.26.23] - 2026-09-23
### «Pregúntame» prioriza una respuesta breve y una acción directa (feedback 18/9)

La hoja del asistente separa ahora la conversación del compositor fijo: al aparecer el teclado,
`visualViewport` eleva la hoja y mantiene visibles tanto la pregunta como el botón. La respuesta
local empieza en una frase normal, con una acción secundaria compacta; el detalle sigue detrás de
«Paso a paso» y no ocupa la pantalla por defecto. El cierre por botón, fondo, Escape o Atrás pasa
por la misma animación antes de desmontar.

Las preguntas sobre efectivo distinguen intención: añadir o comprobar saldo abre Cartera →
Cuentas; comprar, gastar, retirar o apuntar abre Apuntar en efectivo. La detección cubre castellano,
inglés y catalán y evita confundir «compruebo» con «compro». La ruta se conserva también cuando
OpenAI propone la guía de efectivo: el servicio solo elige una guía local y nunca recibe saldos ni
movimientos.

El permiso remoto se explica como ayuda opcional para dudas difíciles. Cada pregunta nueva reinicia
su intento: primero aparece «Probar con más ayuda» y «Probar otra vez» solo después de un fallo de
esa misma consulta. Unitarios y E2E cubren rutas, privacidad, 404/429/503/timeout, teclado móvil,
cierre animado y los tres idiomas. Sin cambios de datos, backend, Android ni APK nueva.

## [4.26.17] - 2026-09-23
### Importar histórico conserva movimientos iguales de cuentas distintas (feedback 18/9, punto 19a)

La beta 4.26.17.1 se rechazó porque al consultar solo CaixaBank no apareció ninguna fila. La
telemetría cerró la ambigüedad: el enlace activo compartió **una cuenta**, el proveedor entregó
dos movimientos para tres meses y ambos se descartaron correctamente porque sus `ext_id` ya
estaban guardados (`skippedExt=2`, el resto de descartes a cero). 4.26.17.2 explica ahora esos
recuentos en pantalla y avisa de que, si falta otra cuenta, hay que reconectar el banco y
seleccionarla; no resucita duplicados para aparentar que llegó histórico.

El vídeo con audio del 23/9 rechazó también 4.26.17.2: en la app nativa de CaixaBank se veían dos
movimientos del 6 de agosto, mientras Aely terminaba en una pantalla sin filas. La lectura mínima
de nube confirmó que ambos ya estaban guardados con `source=ob:caixabank` y que CaixaBank estaba
configurado como banco diario. El fallo visible era de navegación: Gastos abre en «Este mes»
(septiembre), y el importador retiraba los `ext_id` ya existentes antes del preview sin ofrecer
una ruta para encontrarlos. Cuando todos los movimientos entregados ya existen, aparece ahora
«Verlos en Gastos»: cierra Ajustes, abre el periodo completo y filtra por ese banco. El E2E
reproduce el movimiento de agosto y comprueba que una fila de otro banco no queda visible.

La revisión posterior encontró además que una misma cuenta podía ofrecer el pendiente sin id y el
contabilizado con id como dos candidatos. El aplanado agrupa ahora por banco+día+importe con
signo+comercio y por cuenta, conserva una sola versión por cuenta —prefiriendo BOOK/POST con id— y
solo da otra ranura remota a una cuenta distinta. Los fallbacks `Ingreso`/`Compra` son estables en
cualquier idioma para que dos móviles no creen identidades distintas.

`histFlattenHistoryLinks` incorpora la cuenta (`uid`, con `iban` o índice solo como respaldo) a la
identidad del candidato. Dos cargos con el mismo banco, día, importe y comercio dejan de comerse
entre sí si proceden de cuentas distintas; una repetición de la misma cuenta conserva la misma
identidad. El identificador de cuenta solo se usa en memoria y no se guarda ni se muestra.

La tabla remota aún deduplica por `user_id + fecha + importe + comercio`. Para que admita las dos
filas sin retirar su red de seguridad, la primera conserva exactamente el antiguo mediodía local y
solo una segunda cuenta que chocaría recibe una hora sintética estable dentro del mismo día. Así un
móvil con estado atrasado sigue protegido ante una reimportación normal.

La sincronización diaria (`flattenBankTx`/`importObExpenses`) no cambia en esta tanda: dos cargos
iguales de cuentas distintas todavía pueden chocar allí y quedan apuntados como punto 19b. Tampoco
se despliega `bank-sync` ni se afirma que CaixaBank entregue un periodo concreto. Unitarios y E2E
cubren dos cuentas Caixa, pendiente+contabilizado, los recuentos del cero real y la terna histórica
intacta para una sola cuenta. Sin migración, backend, Android ni APK nueva.

## [4.26.16] - 2026-09-23
### Inversiones entra como pantalla hija y vuelve con gesto de borde (feedback 18/9, punto 18)

`InvestmentsPush` ya no se monta directamente en su posición final: parte fuera del borde derecho
y entra con la transición lateral de las pantallas hijas. El botón, Escape y Atrás recorren la
misma salida antes de desmontar, mantienen el candado compartido y devuelven el foco a «Ver todas».

El rechazo de la beta 4.26.16.1 demostró que limitar el inicio a los primeros 32 px no funciona en
el móvil: Android se queda ese borde antes de que la WebView reciba el dedo. El listener acepta
ahora el gesto desde cualquier punto de la pantalla. El eje vertical se abandona al scroll nativo;
un recorrido corto o `touchcancel` vuelve a su
sitio y solo un cuarto de pantalla —o un gesto rápido inequívoco— cierra. El E2E comprueba entrada,
seguimiento desde el centro, scroll vertical, cancelación, cierre y foco. Se elimina además el diccionario castellano `gb_*` que ya
duplicaba `LANG.es/en/ca`: ahora una clave ausente vuelve a fallar en `i18n-keys` en vez de quedar
tapada. Sin cambios de datos, backend, Android ni APK nueva.

## [4.26.15] - 2026-09-23
### «Actualizar inversiones» sincroniza brókers y precios sin ocultar fallos (feedback 18/9, punto 16)

El botón de la pantalla de Inversiones ejecuta dos fases solo a demanda: primero `runBrokerSync`
para Trade Republic/MyInvestor y después `fetchPrices(true)` para las cotizaciones. No llama a Open
Banking ni reintroduce sincronización automática al abrir. `runBrokerSync` devuelve ahora un
resultado estructurado de ocupación/intentos junto a los avisos recogidos, y la pantalla conserva esos
avisos hasta componer un único resultado con el de precios. Así una sesión caducada
o una respuesta blanda no queda tapada por un «Precios actualizados» posterior.
La ruta específica de Inversiones reconoce también MyInvestor si ya llega con `status="expired"`;
los avisos blandos nuevos de MyInvestor
quedan acotados a este botón y no cambian el contrato del sincronizador global.

Si no hay ticker, la fase de bróker sigue disponible; si tampoco existe una conexión real, se dice
sin fingir una consulta. Tres regresiones E2E cubren el refresco MyInvestor sin ticker, el resultado
parcial con consentimiento caducado y el caso sin bróker conectado. Sin cambios de backend,
Android ni APK nueva; el punto 17 queda fuera de esta tanda.

## [4.26.14] - 2026-09-23
### Beneficio en euros y porcentaje antes de «Ver todas» (feedback 18/9, punto 15)

Las posiciones del resumen desplegable de Cartera enseñan ahora la ganancia o pérdida absoluta
junto a su porcentaje. Ambos valores usan `invValueEur` e `invCostEur`, de modo que respetan
`costEur` y la conversión de divisa en vez de restar importes nativos incompatibles. Si el coste o
el valor actual no se conocen, la rentabilidad continúa oculta; los redondeos próximos a cero
evitan signos engañosos.

`cartera-inversiones.spec.mjs` abre el bróker desde la portada, antes de «Ver todas», comprueba
ganancia y pérdida en € + %, y vigila que una posición sin coste o sin valor no muestre una
rentabilidad inventada. Sin cambios de sincronización, backend, Android ni APK nueva; el punto 16
queda fuera de esta tanda.

## [4.26.13] - 2026-09-23
### Candados fuera de la interfaz, protecciones intactas (feedback 18/9, punto 14)

Se retiran los glifos `🔒`, `🔓` y `🔐` de textos, fichas y Ajustes, incluidos los metadatos
bloqueados de la ficha v4.1. No se toca ninguna decisión `locked`, la biometría, `LockScreen`, los
avisos de acceso restringido ni la imposibilidad de editar el saldo que trae un banco. Al quitar el
emoji de la fila de huella también se elimina su recorte de la primera palabra, que de otro modo se
habría comido «Activar» o «Desactivar».

`tests/no-lock-icons.test.mjs` vigila toda la fuente y el texto de huella. El E2E
`sin-candados.spec.mjs` abre Tu cuenta y Privacidad; `cartera-ficha-cuenta` y `listas-render`
comprueban además que las cuentas conectadas y la reconexión siguen protegidas sin icono. Sin
cambios nativos ni APK nueva. Es una tanda independiente del ajuste de Novedades 4.26.12.

## [4.26.12] - 2026-09-23
### Novedades refleja el bundle que ejecutaba el móvil, no solo el diff de producción

Pages y el OTA estable siguen sirviendo 4.25.7, cuyo diff sobre `d65986e8` solo contiene los temas
y sus notas. El móvil del dueño conservó `_mcChannel=beta` después de publicar producción, porque
el canal se guarda localmente y una promoción no lo desactiva. Por eso ejecutaba 4.26.10.1 con las
funciones acumuladas de 4.26.0–4.26.9, aunque la entrada más reciente de Novedades solo enumeraba
la apariencia. La 4.26.12 reúne en es/en/ca las fichas renovadas, Deshacer, Recibos, Pregúntame,
Plan e Inversiones que el bundle beta sí contiene. No cambia lógica, backend, Android ni APK, y no
atribuye esas funciones a la producción estable.

El Action `35784943994` terminó correctamente y publicó 4.26.11.1 en la release `beta`; esta tanda
de texto parte de ese commit y sigue sin tocar producción.

## [4.26.11] - 2026-09-22
### Ajustes sigue al dedo desde el primer fotograma (feedback 18/9, punto 22)

La guarda del eje horizontal tarda unos 36 px en reclamar el gesto. El carrusel de pestañas ya
restaba `ancla` al pintar, pero el cajón de Ajustes seguía usando el desplazamiento crudo y aparecía
de golpe al cruzar la guarda. Solo cambia lo que se pinta: la decisión de abrir/cerrar al soltar
mantiene el delta original para no endurecer el gesto. La prueba CDP de `swipe-pestanas.spec.mjs`
mide el primer fotograma (<12 px) y confirma que el cajón termina abriéndose; los ocho gestos del
spec pasan sobre `main` más este arreglo y sobre esta beta. Sin cambios nativos ni APK nueva.
Es una tanda distinta de los temas de la 4.26.10 y puede recibir un veredicto independiente.
Al estar ya aprobados y publicados en producción 4.25.7, sus cinco pasos dejan de aparecer en el
panel beta, pero sus notas históricas permanecen en Novedades.

## [4.26.10] - 2026-09-22
### Apariencia: Cyberpunk, Otoño y Primavera (feedback 18/9, punto 20)

Tanda separada a petición del dueño, sobre la beta 4.26.9 y sin el resto de la ronda del 18/9.
El dueño ya probó la beta 4.26.9.1 y entregó su veredicto en 22 puntos. Las nueve checklists
anteriores de la 4.26.0–4.26.9 se vacían (`tandas:[]`) para no obligarle a repetir 28 pasos, varios
solapados y uno ya contrario a la portada actual de Plan. Sus notas para la familia siguen intactas.
Vaciar el panel antiguo **no significa aprobar ni promocionar** esas funciones: cada corrección
volverá con su tanda y sus pasos concretos.

**Cyberpunk** es un tema de color propio (`html[data-theme="cyber"]`), no una temática: define todas
las variables que definen Verde/Oscuro/Claro/Azul, así que ninguna cae al valor por defecto. El
dinero conserva su semántica: `--mint` sigue siendo verde (positivo) y `--coral` rojo-rosa
(negativo), en versión neón. Los acentos nuevos van en `--cyber-*` y solo decoran. Contraste medido
sobre `--surface`: texto 16,8, muted 8,9, mint 13,2 y coral 5,9. El movimiento (parpadeo de los
títulos una vez al montarse, anillo del + y corriente de la barra) usa solo `opacity`/`transform` y
se apaga con «Reducir animaciones» y con `prefers-reduced-motion`. El informe PNG del mes tiene su
paleta. La persistencia no necesita lista blanca: el script del `<head>` y `applyTheme` aceptan
cualquier id.

**Otoño y Primavera** entran en `SEASONS`, `SEASON_AMB` y en `--season-tinte`/`--season-glow-top`, con
la misma intensidad que las demás. Otoño va en ámbar/óxido para no confundirse con Halloween, y
Primavera en lila/brote para no confundirse con Pascua.

Sin cambios nativos: no hace falta APK. `apariencia-temas.spec.mjs` va en CROSSCUTTING, porque es
CSS global de `shell.html` y selección persistida en Ajustes. El salto del gesto y los retoques de
importes/anillo se mantienen en tandas independientes: no se anuncian ni se prueban aquí.

## [4.26.9] - 2026-09-17
### Plan compacto y gestos de las fichas de gasto

La vista normal de Plan recupera el segmented de una línea y la portada compacta de pendiente y
liquidez que ya usaba la familia. El hub nuevo de «Gestionar recibos» se conserva completo, pero
su scroller vuelve a ser físico, sin transform ni contención, para que Android pueda dibujar la
respuesta nativa de borde. El modo sencillo conserva su resumen propio.

`useSheetSwipe` fija al iniciar el gesto qué `.v4-sheet-body` posee el scroll; si el movimiento
empieza desplazando contenido o hacia arriba, ya no se transfiere a la hoja al alcanzar el borde.
`touchcancel` limpia el gesto sin cerrarlo y la salida se ejecuta en el compositor antes de
guardar o repintar Gastos. Las hojas anidadas comparten un contador de candados: cerrar «Todas
las categorías» no libera `overflow` ni `sheet-open` mientras la ficha padre siga abierta.

La ficha de gasto queda premontada y el ranking histórico de categorías se calcula fuera del
toque de apertura. `Apuntar` reutiliza la misma salida para CTA, backdrop y Atrás. Los E2E
existentes cubren scroll interior, cancelación táctil, cierre anidado, bloqueo del fondo y las
precondiciones CSS de la ola; la ola real sigue requiriendo Android. Con 1.000 gastos y CPU ×6,
cinco ciclos dan mediana de 0 ms de tareas largas al abrir; el cierre da 0 ms en las cinco
muestras y 16,8 ms de frame máximo mediano. La primera apertura en frío fue la única atípica
(319 ms estrangulados), por lo que la validación final del tacto sigue siendo en el móvil real.

La conciliación de liquidez acota a cero el pendiente legado negativo antes de compararlo con
Plan: una devolución puntual antigua conserva su suma en el saldo proyectado y ya no se descuenta
una segunda vez. Un E2E fija el caso de 800 € de saldo + 50 € de devolución = 850 €.

## [4.26.8] - 2026-09-17
### Rediseño v4.1 — Plan usa euros reales y recibos accesibles

La portada de Plan calcula el anillo con importes pagados y pendientes, separa ingresos de cargos
y elige como referencia la cuenta con menor margen después de sus propios recibos. Una deuda sin
día sigue contando como pendiente sin inventar una fecha; un mes completamente pagado lo dice de
forma explícita. Si falta el saldo, muestra un estado desconocido en vez de `0 €`, y un saldo
negativo conocido nunca recibe tono favorable.

«Gestionar recibos» conserva una única implementación y se abre tanto desde Plan como desde
Ajustes → Dinero, incluso en arranque frío. Sus fichas y el alta por pasos son diálogos reales con
nombre accesible, foco contenido y restaurado, escritura continua y cierre con Atrás o Escape. El
modo simple mantiene el resumen esencial sin duplicar puertas de entrada. Las pruebas cubren
varias cuentas, importes pagados/pendientes, fechas ausentes, saldos desconocidos o negativos,
navegación fría y teclado. No cambia el montaje ni los gestos de `PlanTab`, ni
`11-app-main.js`.

## [4.26.7] - 2026-09-17
### Rediseño v4.1 — Inversiones cierra las cifras, el alta y la accesibilidad

La rentabilidad global solo se calcula cuando todas las posiciones tienen coste conocido; una
cartera mixta muestra `—` y ofrece completar el dato, en vez de extrapolar una ganancia parcial.
«Añadir posición» abre ahora un formulario real con bróker, nombre, valor, aportado y moneda.
La edición manual conserva los datos existentes y el refresco confirma con la hora exacta sin
borrar la última cartera válida.

Los controles pequeños pasan de 44 px, Saveback es un botón/switch accesible y el detalle se
comporta como diálogo: foco inicial, contención con Tab/Shift+Tab, cierre con Escape y bloqueo del
scroll de fondo. `InvestmentRewards` memoiza el filtrado por referencia y usa `dateMs`, para no
recorrer el histórico en cada render. Doce E2E cubren coste mixto, alta, refresco, teclado y foco;
con CPU ×6 y 5.000 gastos, la mediana de apertura medida es 42,6 ms.

## [4.26.6] - 2026-09-17
### Histórico bancario — cada banco dispone de su propio tiempo de lectura

La cola estricta introducida para evitar 429 seguía usando un único deadline de 60 segundos:
si Sabadell agotaba casi todo paginando, CaixaBank quedaba después sin tiempo aunque su enlace
estuviera activo. El cliente abre ahora una invocación `bank-sync` por banco, siempre de una en
una; no hay sesiones PSD2 simultáneas, pero cada banco estrena su propio reloj. Los resultados se
agregan sin dejar que el fallo de uno tape los demás.

La Edge registra para cada lectura solo estado, número de cuentas, número de filas, duración y
rango solicitado: nunca uid, IBAN, comercio, importe ni payload. Así un cero real se distingue de
timeout/parcial sin pedir datos privados. El preview conserva efectivo, transferencias y compras;
un `ext_id` igual en dos bancos sigue siendo dos identidades. `possibleDup` viaja también desde
`ob-hist`, por lo que una coincidencia dudosa queda fuera del total hasta que la persona decida.

### Notificaciones — identidad estable y confirmación real de Trade Republic/Wallet

Android escuchaba Trade Republic y Wallet, y una reentrega podía cambiar el texto y recibir una
hora nueva. El debounce de una sola firma no impedía que Aely confirmase dos veces la misma compra.
El lector envía ahora una identidad estable basada en origen, paquete, clave de Android y `postTime`,
sin título ni texto financiero mutable. La migración `0025_expenses_ingest_event.sql` hace esa
identidad única en `expenses`; `ingest` solo confirma después de insertar y trata una carrera
`23505` como reintento idempotente.

Una coincidencia TR/Wallet entre fuentes no se borra: se conserva como `possibleDup`, no suma y
espera «es el mismo» o «son distintos». Dos compras legítimas iguales mantienen identidades
distintas. No se migra ni recategoriza el histórico existente. El despliegue seguro es indivisible:
migración 0025, Edge `ingest`, Edge `bank-sync`, OTA y APK nueva; una OTA sola no completa el arreglo.

## [4.26.5] - 2026-09-17
### Rediseño v4.1 — estados vacíos y movimiento reducido coherentes

Gestionar recibos e Inversiones comparten ahora la tarjeta vacía del diseño: icono, título Fraunces,
explicación y una acción real de al menos 44 px. El vacío de Recibos abre directamente el alta y
explica que el banco puede detectar cargos repetidos; el de Inversiones abre el alta de bróker o
posición sin dejar un bloque meramente decorativo.

`useCountUp` respeta tanto la preferencia del sistema como «Reducir animaciones» de Aely. Los
spinners dejan de girar —y se ocultan— en ambos modos, mientras su texto de estado permanece. Las
pruebas de Recibos e Inversiones cubren la acción del vacío, el valor final inmediato y la clase de
accesibilidad interna.

## [4.26.4] - 2026-09-17
### Rediseño v4.1 — Inversiones deja atrás el montaje antiguo

La vista de Inversiones es ahora una pantalla propia: cabecera con cartera, coste y ganancia,
recuento animado y tarjetas por bróker que conservan sus posiciones, efectivo y edición manual.
Los valores sin coste siguen mostrando `—`; no se inventa rentabilidad. La actualización continúa
siendo exclusivamente manual y distingue datos al día, antiguos y errores sin borrar la última
cartera válida.

Se elimina el último montaje `.v4-embed-legacy` de esta sección. Auto precios y Proyección pasan a
Ajustes → Dinero, mientras Redondeo y Saveback siguen accesibles desde Cartera. El alta de posición,
la venta a efectivo y la edición aislada por bróker permanecen operativas. Nueve E2E verifican
render, navegación, estados de actualización, accesibilidad, reducción de movimiento e integridad
de las fichas; con CPU ×6, la mediana medida de apertura queda en 35,1 ms.

## [4.26.3] - 2026-09-16
### Rediseño v4.1 — «Pregúntame» guía sin inventar ni tocar el dinero

Inicio y Ajustes abren una hoja propia de ayuda. Sin conexión reconoce dudas frecuentes sobre
presupuesto restante, recibos pendientes, previsión de fin de mes y saldos por banco; las cifras
se calculan con los mismos motores locales que las pantallas de Aely. Las respuestas conducen a
Apuntar, Gastos, Cartera, Plan, Mis bancos o Histórico, pero nunca guardan, borran ni sincronizan
por sí solas. La navegación a los segmentos de Plan espera su montaje real con `requestAnimationFrame`
acotado, también bajo CPU ×6, sin tocar sus gestos ni `11-app-main.js`.

La interpretación remota es una segunda capa opcional. El consentimiento identifica a OpenAI,
explica que solo sale la pregunta escrita —nunca saldos, movimientos ni cuentas— y puede rechazarse
o revocarse desde Ajustes. Cliente y Edge frenan IBAN, tarjetas, PIN/CVV, contraseñas, claves y
tokens; la Edge verifica JWT, limita cuerpo y frecuencia y solo devuelve ids de un catálogo cerrado.
El cliente deriva la frase, cifra y acción localmente, y descarta combinaciones incoherentes entre
tema y botón. Los fallos 404/429/503/timeout dejan un aviso accesible y conservan la guía offline.

El proveedor usa Responses con Structured Outputs, `store:false`, salida corta y modelo configurable
por `OPENAI_HELP_MODEL` (`gpt-5.6-sol` por defecto). La función permanece desactivada sin
`AELY_HELP_AI_ENABLED=true` y `OPENAI_API_KEY`: esta versión no activa coste ni transmite preguntas.
Unitarios y 14 E2E cubren cálculos, privacidad, consentimiento, revocación, fallos remotos,
accesibilidad, navegación y el caso CPU ×6.

## [4.26.2] - 2026-09-16
### Rediseño v4.1 — «Tus recibos» deja de montar la pantalla antigua

Plan → Recibos → Gestionar abre ahora una pantalla hija propia: cifra mensual, buscador y cuatro
grupos que entran en listas ligeras. Las fichas editan sin botón Guardar y conservan periodicidad,
meses concretos, importes distintos por mes y reglas de primer/último día hábil. Las cuotas siguen
bloqueadas fuera del modo sencillo; en sencillo pueden ajustarse porque la pantalla Deudas no existe.

El alta se divide en pasos con `NumPad`, selector de meses, día y cuenta. Cada paso conserva su
entrada de historial para que Atrás quite solo un nivel. Quitar un recibo ofrece Deshacer durante
cinco segundos con el mismo id. La comparación entre lo apuntado y el banco se ha movido a Ajustes
→ Mis bancos, su ubicación estable, y no se duplica en Gestionar.

La pantalla ya no monta `<Fijos>` dentro de `.v4-embed-legacy`. Con el mismo estado y CPU ×6, cinco
muestras bajan el bloqueo mediano al abrir Gestionar de **303 ms a 63 ms** (−79 %); las cinco
muestras nuevas verifican además que el push nuevo está visible. Un E2E de 15 casos cubre navegación,
idiomas, altas, edición no destructiva, modo sencillo, estados vacíos y deshacer.

## [4.26.1] - 2026-09-16
### Rediseño v4.1 — la ficha de cuenta deja de ser un editor encajado

Cada cuenta abre una ficha propia con el nombre como cabecera, saldo protagonista, acciones y rol
explicado en contexto. Las cuentas manuales corrigen el saldo con el teclado común —también en
negativo— y las conectadas mantienen el importe bloqueado, con sincronizar o reconectar según su
estado. Renombrar y elegir rol siguen guardándose al vuelo; una cuenta OB recién conectada no recibe
un rol inventado.

La previsión de fin de mes solo se muestra cuando corresponde inequívocamente a esa cuenta. El
gráfico empieza con cierres diarios reales guardados por clave de cuenta, sin reconstruir ni fingir
los días anteriores; la variación mensual necesita un punto real del día 1. La ficha enseña los tres
últimos movimientos y «Ver todo» abre Gastos ya filtrado, mediante un evento efímero que no toca los
montajes de `11-app-main.js`. El historial diario conserva 31 puntos como máximo.

El primer cierre espera a `mc-boot-ready`, para no fijar como inicio de mes un saldo local anterior
al pull. «Corregir saldo» empieza con el teclado limpio: precargar un float largo agotaba el límite
de siete dígitos y dejaba la botonera aparentemente bloqueada. La navegación a Gastos conserva el
banco pendiente hasta que la pestaña termina de montar, y con dos cuentas de la misma entidad la
cabecera dice honestamente que los movimientos son del banco, porque el extracto no identifica la
subcuenta.

## [4.26.0] - 2026-09-16
### Rediseño v4.1 — una sola ficha para apuntar y modificar

`ApuntarSheet` y `ExpenseDetailSheet` ya no mantienen dos interfaces que divergían: comparten la
misma anatomía de cabecera, importe, concepto, metadatos, categorías y teclado. La rejilla prioriza
las ocho categorías más usadas en 90 días sin expulsar la categoría actual, y el selector completo
queda en una hoja secundaria. La multidivisa conserva el importe original y enseña la conversión
real a euros con la fecha del tipo.

Los movimientos automáticos muestran su procedencia y bloquean importe y banco tanto en el render
como en `saveEdit`/`setBank`; una llamada accidental desde otra puerta tampoco puede desanclar el
movimiento del saldo bancario. Modificar guarda al vuelo y conserva en Ajustes la nota, la cuota de
deuda y la marca de tarjeta. Los E2E abren las dos fichas reales, comprueban la anatomía compartida,
el candado bancario y los flujos anteriores de efectivo, FX, sugerencias, concepto y deudas.

El borrado deja ahora una ventana real de cinco segundos para deshacer. La retirada local y su
lápida se escriben juntas para que un pull no resucite la fila por detrás; al deshacer se quita solo
esa lápida, se repone el objeto en su posición y, si ya salió el delete remoto, se encadena después
un upsert con el mismo id. Así no hay ni duplicado nuevo ni una carrera delete/add en Supabase.

## [4.25.8] - 2026-09-23
### Ajustes sin salto y protecciones sin candados visuales (aprobados en beta)

Se publican sobre producción únicamente las dos tandas aprobadas. El gesto lateral de Ajustes
descuenta el tramo reservado para decidir el eje antes de calcular el progreso visual, sin cambiar
el umbral de apertura al soltar. También se retiran los candados dibujados sin quitar protecciones:
los saldos bancarios siguen sin poder editarse, la biometría conserva su interruptor y las cuentas
protegidas mantienen sus reglas. No incorpora el rediseño 4.26 ni las tandas de Inversiones.

## [4.25.7] - 2026-09-22
### Cyberpunk, Otoño y Primavera aprobados como tanda independiente

Se porta únicamente la tanda de apariencia probada en beta 4.26.10.1 sobre la base de producción
4.25.6. Cyberpunk añade una paleta propia con acentos neón, conservando verde para importes
positivos y rojo para negativos; Otoño y Primavera amplían las temáticas estacionales. El selector,
los colores, la ambientación y el informe compartido quedan alineados. No se incorpora ningún
cambio de las demás tandas 4.26 ni se modifica el envoltorio Android.

## [4.25.6] - 2026-09-16
### El backlog de beta deja de resucitar después de promocionar

`betaChecklist` aplicaba su fallback sin conexión también cuando producción ya había alcanzado la
versión beta. Eso volvía a cargar la nota más reciente y mantenía visible una lista que ya no era
trabajo pendiente. Ahora una producción alineada devuelve una ronda vacía, Ajustes oculta la
entrada de revisión y el panel no conserva ni contador ni tandas antiguas. Dentro de una ronda,
si una corrección reutiliza el mismo identificador estable, solo aparece su versión más nueva.

Los tests cubren tanto el caso producción=beta como la deduplicación entre versiones, y el e2e
comprueba que un panel ya promocionado no pinte de nuevo ninguna tanda.

## [4.25.5] - 2026-09-16
### El fondo real deja de tener una caja invisible debajo

El vídeo del Oppo separó el caso bueno del malo: con la barra visible el stretch funcionaba, y
solo fallaba cuando se ocultaba. En el host nativo, la regla anterior escondía `.botnav` con un
`bottom` negativo mientras `.viewport` permitía overflow visible. La barra dejaba de verse, pero
su caja quedaba por debajo del viewport y creaba el stopper que Android encontraba antes de poder
dibujar la ola. Ahora permanece anclada en `bottom:0` y se recoge dentro del borde mediante alto y
padding animados, con overflow recortado solo al ocultarse; conserva la transición suave sin
transform, clip-path ni geometría bajo la pantalla.

Había una segunda ruta independiente: un primer tramo diagonal de más de 36 px podía reclamar el
eje horizontal incluso estando en el fondo, llamar a `pinNavVisible` y desmontar el host. El borde
inferior da ahora prioridad absoluta al WebView hasta que el usuario sube contenido. El e2e nuevo
recorre la lista incremental hasta su fondo efectivo (no el primer límite virtual), reproduce esa
deriva lateral y comprueba que la barra siga oculta, el host siga montado y la pestaña no cambie.

## [4.25.4] - 2026-09-16
### El rechazo real deja tres causas medibles, no otro ajuste a ciegas

La telemetría del móvil confirmó `eb_429` simultáneo en CaixaBank y Sabadell. La documentación del
proveedor limita muchas lecturas PSD2 en segundo plano y recomienda continuar seis horas después.
El histórico ya no abre dos bancos a la vez: recibe la selección del cliente, consulta solo esos
enlaces y los procesa en serie. La pantalla arranca con los bancos marcados como gasto diario,
permite ampliar a los demás antes de buscar y conserva un cooldown local de seis horas tras 429.
Las sincronizaciones por notificación quedan apagadas por defecto (una cada 12 h si se activan de
forma expresa), y se elimina el bootstrap bancario sin toque que aún corría una vez al abrir.

Un fallo transitorio ya no pinta una cuenta Open Banking como «caducada»: `staleKind` distingue
saldo sin actualizar de permiso vencido. El resultado de la sincronización manual deja de unir
bancos y brókers en un toast sin límite; abre una hoja con una fila por resultado. La sonda del
histórico sigue disponible en telemetría y DevTools, pero deja de interrumpir la interfaz.

La ola tenía una causa independiente: `enterScrollHost` añadía clases con `classList`, React las
borraba en el siguiente render y `ensureScrollHost` no las restauraba porque sus refs seguían en
`true`. `app-shell` y `viewport` sellan ahora el host en su `className`. Además, el rebote inferior
no revela la barra por cruzar un umbral de distancia; exige dirección contraria y reciente del
dedo. El sellado conserva también `nav-sin-blur` cuando el carrusel cambia de modo a mitad del
gesto. Los e2e fuerzan un repintado con el host activo y distinguen un rebote grande de una subida
real.

## [4.25.3] - 2026-09-16
### Histórico con margen real, reconexiones firmes y rebote sin revelar la barra

El segundo intento seguía repartiendo solo 15 s por banco. En conexiones PSD2 reales ese margen
puede agotarse antes de que CaixaBank entregue la primera página. `bank-sync` usa ahora el plazo
real de la petición, reserva 5 s para responder y procesa como máximo dos bancos a la vez: evita
la ráfaga que provoca 429 sin volver a dejar Caixa detrás de un enlace lento. Dentro de cada banco
el tiempo restante se reparte entre sus cuentas. Los fallos de primera página vuelven al cliente
como códigos seguros (`eb_429`, `timeout`, `eb_503`...), nunca con texto crudo del proveedor, para
que la pantalla distinga límite, espera agotada y fallo temporal.

Las reconexiones dejan de mezclar «no he podido leer ahora» con «el permiso ha caducado». Open
Banking solo pone el enlace en `expired` ante un `EB 401` firme; 403/404, 429, 5xx y timeouts lo
conservan activo. Trade Republic persiste `_trAuthExpired` por separado: un arranque en frío donde
el puente todavía diga `connected:false` ya no pinta ni cuenta una reconexión. Al pulsar sincronizar,
si queda teléfono guardado se valida primero la sesión existente y solo un `authExpired` explícito
pide login. Desconectar a mano limpia teléfono y marcador para no dejar un aviso fantasma.

Las notificaciones bancarias podían disparar una sincronización por cada aviso recibido. El cliente
OTA aplica ahora un presupuesto persistente de una cada 2 h y cuatro al día, compartido por el
arranque en frío y los eventos en caliente. Los botones manuales no tienen límite y no se añade
ningún sync por abrir o volver a primer plano.

En el fondo de cada pestaña se elimina el `setTimeout` de 700 ms que reconciliaba el estado y podía
revelar la barra en mitad del rebote. La dirección se decide con el movimiento real del dedo: el
scroll de retorno que Android genera mientras el dedo sigue empujando hacia abajo no cuenta como
una subida. En el host nativo la barra se oculta cambiando `bottom`, sin transformar el elemento
que comparte el borde con el scroll; así no tapa el overscroll de WebView. La barra solo reaparece
tras una subida real.

Cobertura añadida para presupuestos y códigos de error del histórico, caducidad 401 frente a
fallos pasajeros, arranque frío de TR, validación manual de sesión, presupuesto de notificaciones
y rebote grande en el borde inferior. Cursor revisó el conjunto sin bloqueantes; la comprobación
real de Caixa y de la ola queda necesariamente en el móvil y en el canal beta.

## [4.25.2] - 2026-09-16
### Caixa tiene turno propio y la ola no desmonta su scroll

Segundo rechazo real de la ronda 4.25. La descarga histórica recorría enlaces en serie con un
deadline común de 60 s: un Sabadell lento o limitado con 429 podía consumirlo y dejar las cuentas
posteriores como `timeout` sin haber llamado siquiera a CaixaBank. El histórico procesa ahora los
enlaces en paralelo, con 15 s independientes por banco y reparto entre sus cuentas. Sigue siendo
solo lectura y solo se ejecuta al pedir «Buscar movimientos»; no se añade ninguna sincronización
automática. `strategy=longest` acompaña a `date_from` desde la primera página, porque Caixa puede
aceptar el periodo pero devolver vacío sin lanzar `WRONG_TRANSACTIONS_PERIOD`.

La identidad de Open Banking deja de tratar `ext_id` y fecha+importe+nombre como globales: ambas
incluyen el banco, tanto en el sync diario como en el histórico. Así un identificador de Sabadell
no descarta en silencio un movimiento diferente de Caixa. No se borra ni reclasifica historial.
Si un banco responde correctamente con cero filas, la pantalla lo nombra expresamente en vez de
mezclarlo con «quizá ya estaba todo apuntado».

En el borde inferior, Android suele entregar el scroll como `touchcancel`. Ese camino llamaba a
`endTopClearNow(true)` y `asentarTrack`: revelaba la barra y sacaba la página del host nativo justo
cuando empezaba el stretch. El cancel vertical conserva ahora la barra, no reasienta el carrusel y
aplaza únicamente la reconciliación de estado hasta terminar la física. Un E2E llega al fondo,
envía `touchcancel` y exige simultáneamente barra oculta y `.page-scroll-host` vivo.

Pruebas específicas: histórico con Sabadell pendiente mientras Caixa devuelve una fila; importe
de Caixa visible e importable en DOM; Caixa a cero explícita; identidad cruzada entre bancos;
20/20 E2E de histórico+barra tras aislar correctamente sync diario e histórico en el doble.

## [4.25.1] - 2026-09-16
### Cuentas nuevas completas, borde inferior estable y offline inmediato

Rechazo real de la beta 4.25.0: al conectar CaixaBank, su fila no se podía tocar, editar ni mover
como el resto. No era un fallo de `bank-sync`: las cuentas nuevas viven primero en `obAccounts`
como saldos puros sin rol, mientras la ficha y el long-press solo aceptaban filas de `accounts`.
La única puerta era el editor antiguo «Editar» para renombrar o promocionar la cuenta, un hueco de
UX que la 4.19.77 dejó documentado como diseño y cerró sin cubrirlo en sus E2E.

- `obAccounts` pinta ahora botones con la misma ficha: nombre editable vía `obLabels`, saldo de
  solo lectura y los tres roles sin ninguno preseleccionado. Elegir un rol sigue pasando por
  `promoteObAccount`; abrir o mover la fila nunca la promociona ni inventa qué paga.
- `settings.accountListOrder` guarda únicamente el orden visual combinado. `accounts`,
  `obAccounts`, saldos, roles y `expenseBanks` permanecen intactos al arrastrar. Sin cuentas OB se
  conserva el contrato histórico de `accounts`; si ya existía un orden mixto, ambos se alinean y
  se podan las claves de bancos desconectados.
- La cuenta promocionada conserva `accountOrderKey`, así que no salta al final al elegir su rol.
  Las cuentas del banco no muestran «Quitar»: se desconectan desde Ajustes → Bancos.
- Pruebas: regresión pura roja antes del helper mixto; E2E de una CaixaBank recién conectada para
  abrir/renombrar/promocionar y para moverla sin alterar dinero. Ficha + orden: 12/12 verdes.

El borde inferior deja de ordenar cambios de la navegación: alcanzar `scrollTop=max` conserva la
barra tal como estuviera y un latch separa la oscilación del rubber-band de una subida real de al
menos 160 px. Se retiran `botnav-hidden-fast` y su estado, que solo existían para ocultar la barra
al fondo y eran la causa del primer gesto bloqueado. El host mantiene `touch-action:pan-y` y
`overscroll-behavior-y:auto`; la ola sigue siendo nativa, no una animación duplicada.

Offline, `mcBootReady()` se abre inmediatamente porque `loadState` ya ha leído el estado local de
forma síncrona. Dashboard tampoco espera su antiguo tope de 500 ms. Ajustes guarda por UID el
último `profiles.is_admin=true`: conserva la zona Dev sin red, pero no concede permisos —la RLS
sigue validando cada lectura— y la marca se borra al cerrar sesión.

Gastos vuelve al contrato confirmado el 16/9: `bankSel` arranca con todos los resultados de
`expenseBankEnts`, se actualiza si cambia esa selección automática y «Limpiar» vuelve a ella.
`[]` conserva el significado explícito de «Todos los bancos». El default no enciende el contador;
ampliar a todos sí. Las pruebas de filtro, arranque offline, Dev y rebote cubren los rechazos.

## [4.25.0] - 2026-09-15
### Lectura bancaria paginada y avisos de histórico incompleto

Tanda integrada sobre 4.24.5 y revisada por los tres agentes. Se publicó como beta 4.25.0.1 y se
desplegó solo `bank-sync`, sin migraciones. La prueba móvil rechazó la ronda por un defecto aparte
en la ficha de cuentas nuevas, corregido en 4.25.1. No cambia datos históricos ni requiere APK.

El sync diario ignoraba `continuation_key`: una primera página vacía podía anunciar éxito sin
traer movimientos. `fetchBankTransactions` comparte paginado con histórico, mantiene parámetros,
acota 12 páginas / 2000 filas / 15 segundos por cuenta y 60 segundos globales, y conserva páginas
previas si falla después. Un test ejecuta el importador para asegurar que la ventana del servidor
cubre la del cliente, también en el borde de mes Madrid/UTC.
`WRONG_TRANSACTIONS_PERIOD` permite un único cambio a `strategy=longest`; otros errores no
provocan reintentos. Los cursores cíclicos y los topes se declaran como resultado parcial.

El histórico devuelve también enlaces pendientes/caducados y muestra avisos por banco incluso
cuando no hay candidatos. El cliente admite el servidor anterior comprobando los enlaces
esperados. Se elimina la inferencia «primera fecha posterior al inicio = truncado»: puede no
haber operaciones ese día. Un fallo de consulta no se presenta como ausencia de movimientos;
`app_events` conserva solo su clase cerrada (`eb_401`, `eb_503`, timeout…), nunca el mensaje crudo
del proveedor, la cuenta ni el payload.

`flattenBankTx` deja de cortar globalmente a 150 filas: ese corte expulsaba la actividad de un
banco cuando otro llenaba el cupo. El servidor mantiene límites por cuenta. No se altera el
dedup ni la ventana de importación de `importObExpenses`.

Pruebas: handler real con banco/BD simulados en `bank-sync-paging`; 5 regresiones rojas antes
de corregir. E2E del histórico para error por cuenta, enlace pendiente omitido, resultado parcial
y fallo de transporte. Detalle y límites en `docs/briefs/bancos-historico-caixa-2026-09-15.md`.

## [4.24.5] - 2026-09-16
### La ronda 4.24 a producción, con una sola nota

Beta 4.24.4 aprobada por el dueño en el panel (16/9, 06:50Z): ✅ `4.24.4/ajustes-no-bucle`
y ✅ la re-pregunta `4.24.2/inicio-offline-2`, 2 ok / 0 fallos cada una. Con eso sube a
producción toda la ronda 4.24 (4.24.0 → 4.24.4).

- Nota ÚNICA para la familia: las cinco entradas 4.24.x del JSON se colapsan en una sola
  (4.24.5) con `tandas: []`. Sin la propiedad, el panel las resucita como «/todo».
- El panel de pruebas de la beta (4.24.4) NO se menciona: es del canal beta, no de la familia.
- Cabeza con `[skip ci]`: la ronda toca `supabase/functions/ingest` y `_shared/ingest_logic`,
  y un push a `main` dispararía `supabase.yml` desplegando las TRECE funciones de golpe —
  incluidas `bank-aspsps` (43 días) y `prices` (52) con un mes de `_shared` sin estrenar.
  `deploy.yml` se lanza a mano y las Edge van después, una a una y con su OK.

## [4.24.4] - 2026-09-15
### Ajustes ya no se abre solo tras probar la beta

Rechazo 4.24.2 (15/9): «se abre todo el rato Ajustes… me la liasteis». Causa: «volver al
panel de pruebas» (10/9) reabría Ajustes+Revisar beta si `_betaPanelAbierto` < 2 h, y el
panel al montar reescribía `Date.now()` → renovaba las 2 h en cada muerte de WebView.

- Montar el panel por reapertura automática ya no toca la marca; la renueva un toque real
  (`pointerdown`). Restaurar la altura con `scrollTop` no cuenta: ese `scroll` sintético
  renovaba la marca y borraba `_betaPanelReabierto` (misma puerta del rechazo, otro lado).
  El scroll posterior solo mantiene la marca si ya hubo gesto.
- Como mucho una reapertura automática por marca (`_betaPanelReabierto`).
- Cerrar Ajustes (‹, gesto, atrás, botnav) o el panel, o enviar el último veredicto →
  `betaOlvidarVuelta()`.
- e2e `beta-panel-reopen`: 1ª carga abre, 2ª sin tocar → Inicio; cerrar cajón → Inicio;
  último veredicto → Inicio; restaurar altura no renueva la marca.
- Tandas de 4.24.1 y 4.24.3 vacías (aprobadas); 4.24.2 paso 2 reescrito; tanda nueva con
  su frase literal.

## [4.24.3] - 2026-09-15
### El banco espera a la nube: un móvil con datos viejos ya no repite movimientos

Su «+18,09» del balance (14/9). Medido en la nube: el 13/9 una web con la 4.18.25, abierta por
última vez el 10/9, sincronizó Trade Republic con su estado local VIEJO y volvió a subir tres
«Movimiento» que él ya había renombrado desde el móvil (traspaso a Sabadell 18,09, bizum 6,40,
FTSE 10,34): 24,49 € de más en el gastado. `importObExpenses` deduplica contra lo local, así que
`runBankSync` ahora espera a que el pull de la nube de esta sesión haya terminado bien
(`pullOkRef`); si falló, reintenta una vez y, si sigue sin nube, NO llama al banco (ni gastos ni
saldos) y lo dice al sincronizar a mano. e2e `banco-espera-nube`: nube lenta con la fila ya
renombrada → una sola fila; nube caída → el banco no se consulta. Los dos fallan con el código
viejo. Límite: si otro móvil aún no ha subido su cambio, esto no lo ve (FIN-03).

Las tres filas ya duplicadas se marcaron a mano «posible repetido» en la nube, con su OK.
Retirada la idea de re-marcar repetidos desde el móvil: el comentario B09-D de
`syncCloudExpenses` ya explicaba por qué deshace decisiones de otro dispositivo.
El doble de Supabase de los e2e crea una cadena por consulta (con una compartida, una tabla
pisaba a otra).

## [4.24.2] - 2026-09-15
### Inicio sin internet de verdad: skel corto y panel beta offline

Rechazo 4.24.0.1 (15/9): «tarda un rato» y «la zona de beta no se ve sin conexión».

- Skel: tope corto (~0,5 s) solo si `navigator.onLine===false`; con red se mantiene ~2 s
  (si se acorta, pinta el patrimonio local y luego saltan las cifras al llegar la nube).
- Panel beta: SW con `ignoreSearch`, clones antes de devolver la respuesta, fallback
  encadenado (JSON sin caché no recibe index.html). `ensureReleaseNotes` guarda/lee solo
  la cabeza de la versión en localStorage.
- La tanda de 4.24.0 queda vacía para no sumarse; los pasos repiten el rechazo literal.

## [4.24.1] - 2026-09-15
### La lista de Gastos cuenta lo mismo que el balance; ingest deja rastro de lo que descarta

Su «el balance no me cuadra» (14/9, con capturas): la tarjeta decía Gastos 813,84 / Ingresos
329,12 y sumando la lista le salían 378,86 de ingresos. La app era coherente: `monthBudgetStats`
solo suma ingresos de bancos de gasto diario y nunca un traspaso. El fallo era la fila:
`expenseBucket` devolvía `ingreso` para cualquier importe negativo, así que los 6 ingresos de
Sabadell (49,74 €) y un «+291,25 Traspaso» salían en verde normal. Ahora un ingreso de otro banco
es `otrobanco` («no es del día a día») y un traspaso entrante `neutra` («no es un gasto»). Test de
propiedad `bucket-igual-que-balance` con sus cifras (falla con el código viejo) y e2e en
`gastos-diario-filtro`. El chip «Ingresos» del filtro enseña solo los que cuentan, como «Gastos».

Servidor (se despliega aparte): el «1331 BAR» de su padre (65,60 €, 13/9) no entró y no dejó ni
fila ni error. `ingest` apunta ahora cada descarte en app_events (`kind: ingest_skip`, motivo +
texto recortado) y `clasificarConMotivo` deja de mirar «bizum/recibido/transferencia» en el nombre
del comercio de una compra con tarjeta («BAR EL RECIBIDOR» se tiraba en silencio; test mutado).

## [4.24.0] - 2026-09-14
### Sin internet, Inicio ya no se queda en siluetas

Si la nube no respondía (sin cobertura, pull colgado), Inicio dejaba tres esqueletos
para siempre: el splash sí tenía tope, pero el panel esperaba `mc-boot-ready` sin límite.
Tras unos dos segundos se pinta el estado local; si la nube llega después, se actualiza sola.
Pastilla «sin conexión» como hasta ahora. e2e offline + boot-ready bloqueado + red lenta.

## [4.23.1] - 2026-09-14
### Herramientas de pruebas preparadas el 15/9 (integración pendiente)

`dismissNews` evita esperar 4 s cuando el fixture sembró la misma versión base que está
ejecutando el navegador y no hay panel. Conserva la espera ante versiones nuevas o datos
inciertos. Cuatro guardianes cubren aviso tardío, ausencia de garantía y sufijo beta. A/B
en nueve casos idénticos: 46,094 s → 12,373 s, ambos sin fallos ni omitidos. El runner y el
reporter JSON registran duraciones para localizar el siguiente coste. La validación completa
se hará con el commit de tooling separado encima de bancos 4.25.0, después de integrar 4.24.3.

### La 4.23.0 a producción, con una sola nota

Él aprobó la 4.23.0 (tanda `sec01-callback`) en el chat: *«aprobada la 4.23.0, sube a prod y
despliega las Edge»*. La nota pasa a 4.23.1 con `tandas:[]`. Tras servir Pages, se despliegan de una
en una `bank-callback`, `ingest` y `myinvestor-keepalive` (código de la 4.23.0, sin migraciones).

## [4.23.0] - 2026-09-14
### Avisos claros si falla al conectar un banco (SEC-01: cliente + Edge)

El `bank-callback` podía devolver el error crudo por la URL (`?bank=error&msg=…`). El cliente lo
pintaba tal cual (`t("bank_error")+": "+m`), así que quien fabricara el enlace podía meter un
texto falso «de tu banco» en el toast. Cliente: `bankCallbackErrorKey` /
`bankCallbackErrorToast` solo traducen códigos cortos (`eb_error`, `sin_code`, `state`,
`caducado`, `sin_cuenta`, `error`, `nolink:<banco>`); cualquier otra cosa → genérico, NUNCA el
texto. Legacy `invalid_request` sigue mapeando a `bank_error_invalid` por si un APK viejo aún
habla con Edge antiguo. Dos puertas cerradas en review: `nolink:<inventado>` ya no pinta el
texto (solo etiqueta ENT o 🏦); `public/back.html` no pinta `msg` y solo reenvía códigos /
`nolink:…`. Unit + e2e `bank-callback-msg`.

Servidor (se despliega aparte, tras la web): `bank-callback` solo devuelve códigos (`eb_error`,
`sin_code`, `state`, `caducado`, `sin_cuenta`, `error`, `nolink:<banco>`) y guarda el detalle en
`app_events`; `ingest` rechaza cuerpos de más de 16 KB y recorta texto/comercio/nota;
`myinvestor-keepalive` compara la clave en tiempo constante (`_shared/entrada.ts`). Test
`entrada-edge`. Orden: web 4.23.0 beta → veredicto → prod → Edge una a una con OK.

## [4.22.3] - 2026-09-14
### La ronda 4.22 a producción, con una sola nota — y el alias antes del corte

Él aprobó `hist-cuotas` 5/5 en 4.22.2.1 (APK 46). Las notas 4.22.0–4.22.2 se juntan en la 4.22.3
para la familia, con `tandas:[]` (la 4.22.1 era un ajuste interno de la 4.22.0).
Nit de Cursor en la review de 4.22.2: en `cuotasDeDeudaPorMarcar` el corte por `CAT_NEUTRAS` iba
antes del alias, así que si el banco vuelve a meter Cofidis como `traspaso` había que marcarla otra
vez. Ahora una fila neutra solo se salta el casado automático; el alias (con su lápida y una por mes)
la caza igual. Tres tests nuevos en `cuotas-deudas`. No toca `supabase/`.

## [4.22.2] - 2026-09-14
### «Es la cuota de…» a mano desde la ficha, y se aprende

Su rechazo de `hist-cuotas` en 4.22.1.1: *«Hay una compra de Cofidis que es la cuota de una
deuda, no la puedo cambiar manualmente? Solo funciona automáticamente, es la de 24.99»*.
Medido: «Financiación suelo gym» 25,02 € TR día 6, ya ACABADA (`debtActive=false`); el banco
cobra 24,99 como «Cofidis» (noti), y en agosto como «Movimiento» en traspaso. No casaba por cuatro
lados y no había forma de marcarla. Voto Cursor: sí.

- Ficha del gasto → «Es la cuota de…»: un chip por CADA deuda con id, activa o no.
  `marcarCuotaAMano` pone `deudas` + `debtId` (vale para manuales y traspasos), quita la lápida
  y aprende `state.cuotaAlias[banco|comercio] = debtId` (no para «Movimiento» sin nombre).
- La pasada casa también por alias: mismo banco + comercio + `recAmtClose` + ±15 días, contra
  cualquier deuda con id; una por deuda y mes y respeta `cuotaNo`. Acepta filas a mano solo si ya
  están en «Deudas» (re-deduce la deuda tras reinstalar).
- Sacarla de «Deudas» también olvida el alias. Efecto con `cuotaAlias` en dependencias.
- El importador del histórico aún no usa alias (sus meses ya están importados).
- Tests: `cuotas-deudas` 28 (mutaciones del alias, del aprendizaje y del manual comprobadas),
  `e2e/gastos-deudas` 4.

## [4.22.1] - 2026-09-14
### La ventana de 12 meses de las cuotas, igual en cualquier zona horaria

La CI de beta (UTC) tumbó 4.22.0: `cuotaDesdeMs` leía el mes de `startOfMonth()` —día 1 en hora
de Madrid, que en UTC es el 31 a las 22:00— con `getMonth()` local, y la ventana crecía un mes.
En su móvil (Madrid) no pasaba; en local tampoco, por eso el test verde no lo vio. Se lee el mes a
mediodía de ese día 1. Probado con TZ UTC, Madrid, Los Ángeles y Tokio.

## [4.22.0] - 2026-09-14
### Las cuotas de meses pasados, también en «Deudas» (2ª tanda)

Su decisión del brief: «el histórico en una segunda tanda», con la misma regla. Beta renumerada
tras el promote de 4.21.2.

- `cuotaCasa` / `cuotaCargoCercano` / `cuotasUsadas` salen de `cuotasDeDeudaPorMarcar` para
  que la pasada diaria y el importador del histórico usen LA MISMA regla.
- La pasada mira los últimos `CUOTA_MESES` (12) en vez de «mes −8 días». No hay fecha de inicio de
  la deuda en el Plan: el tope evita casar cargos de antes de que existiera; lo que se cuele se saca
  a mano (lápida `cuotaNo`). Marcar meses pasados no toca el saldo (`insumosSaldoGasto` solo mira
  el mes en curso) — test propio.
- Importador: `histMatchesModeled` ya no descarta DEUDAS (solo Fijos y puntuales);
  `histCuotasDeDeuda` las clasifica `new` + `category:"deudas"` + `debtId`, una por deuda y mes
  contando lo ya marcado y el propio lote. Si él cambia la categoría en la vista previa, entra sin
  marca.
- Simulado con la nube: en su usuario marca además las de junio y julio (Roomba, gym, hipoteca,
  piso); gastado del mes y `spentByBank` iguales. Tests: `cuotas-deudas` 21.

## [4.21.2] - 2026-09-14
### La ronda 4.21 a producción, con una sola nota

Él aprobó `cuotas-deudas` 5/5 en 4.21.0.2 con la APK 46: *«Ya he aprobado la tanda también!
cuando quieras para prod!»*. Las notas 4.21.0 y 4.21.1 se juntan en la 4.21.2 para la familia;
todas con `tandas:[]`. Tras el despliegue web va `ingest` sola (`CAT_NEUTRAS.deudas` +
`esCuotaDeDeuda`), para que el widget no sume las cuotas que llegan por la noti de TR.

## [4.21.1] - 2026-09-14
### APK 46 en la calle, traída a beta

Con su OK: `release:apk` desde `tanda/apk-46` (base 4.20.4) → release `v4.20.4` con
`Aely-4.20.4.apk` (código 46). Sin token de ingest (OPS-06 P0) y sin copia de Android:
`allowBackup="false"` + `dataExtractionRules` que excluyen nube y traspaso de móvil a móvil
(en Android 12+ `allowBackup` solo no apaga el D2D). `main` avanzó en fast-forward con eso y
`apk.json`; aquí se mezcla `main` en `beta`. Bump porque el manifiesto y un comentario
(nit de Cursor en `DEUDA_CAT`) entraron después del de 4.21.0 y `docs-frescura` lo exige.

## [4.21.0] - 2026-09-14
### Las cuotas de las deudas, en Gastos («Deudas» + un filtro por deuda)

Idea suya del 12/9 (*«categorías automáticamente por las deudas… y así se pudieran filtrar»*).
Decidió: categoría «Deudas» con filtro por cada deuda, que NO cuente en el gastado, histórico en
una 2ª tanda. Primera ronda de beta tras el promote de 4.20.4 (numeración reseteada).

**El brief partía de una premisa que sus datos tumbaron.** Suponía que `importObExpenses` tiraba
la cuota por casar con la deuda (`matchesModeled`). Medido en la nube: de sus 4 deudas activas
NINGUNA casa por nombre — el banco llama a la hipoteca «PRESTAMOS ADEUDO CUOTA N.…» y la cobra el
31, el préstamo del piso sale con el nombre de quien lo cobra, y las de Trade Republic llegan por
la NOTI («Amazon», «Openbank Pay») y además por OB como «Movimiento». Ya entraban como gasto normal.

- `marcarCuotasDeDeuda` (08-motor-bank): pasada pura sobre gastos de cualquier vía salvo los a mano,
  desde 8 días antes del mes. Casa por banco + importe al céntimo + día a ±4 (en su mes o el
  contiguo), o por nombre + importe parecido. Una cuota por deuda y mes (la más cercana al día; a
  igualdad, la que no es «Movimiento»). Se ejecuta en el sync (antes de subir) y en un efecto sobre
  `expenses`/`debts`/`cuotaNo`; devuelve null si no hay nada nuevo (sin bucle).
- `DEUDA_CAT` en `CAT_NEUTRAS` (cliente y `_shared/presupuesto.ts`): sale del gastado.
  **`expenseCountsCash` NO cambia**: en la cuenta diaria la cuota ya resta como cargo y
  `applyBankBalances` ancla contando con ella; sacarla haría saltar el saldo (el rol-sin-salto).
- La marca viaja sin migración: OB como `ob:<ent>~deuda.<id>` (con `~`: el servidor desplegado hace
  `split("#")[0]` y con `#` la sumaría); la noti conserva `macrodroid` (un `macrodroid~…` lo leería
  «a mano» y SUMARÍA) y lleva solo `cat:deudas` — el `debtId` se vuelve a deducir.
  ⚠ **Hasta redesplegar `ingest`**, el widget cuenta las cuotas de la noti (el servidor desplegado
  no tiene `deudas` en `CAT_NEUTRAS`). En sus datos, la primera es la del 27/9.
- `importObExpenses` ya no tira la deuda casada por nombre (los Fijos y puntuales sí).
- `refreshExpenseFromCloud` no devuelve a «otros» una cuota marcada; `setExpenseDeuda` (en
  `CLOUD_WRITES`); sacarla a mano de «Deudas» deja lápida en `state.cuotaNo`.
- Gastos: cajón `deuda` («ya cuenta en el Plan»), sección «Deudas» en Filtros con un chip por deuda
  (`debt:<id>` en `sel`); sin deudas no sale. Una deuda borrada deja sus cuotas en «Deudas».
- Tests: `cuotas-deudas` (15, con mutaciones comprobadas) y `e2e/gastos-deudas` (3).

## [4.20.4] - 2026-09-14
### La ronda 4.20 a producción, con una sola nota

Él aprobó las cuatro tandas en 4.20.3.1 (cartel-reconectar 5/5, sync-un-aviso 6/6,
gastos-suelta-filas 6/6, apuntar-sugerencia 5/5): *«te aprobé todas las tandas… pa prod y a
resetear de 0 otra vez beta»*. Las notas 4.20.0–4.20.3 se juntan en la entrada 4.20.4 para la
familia; todas las notas con `tandas:[]`. Incluye las migraciones 0022 (freno Hogar) y 0023
(topes de app_events), que se aplican con este promote. El arreglo del token de ingest en la APK
va con la APK 46 (nativo).

## [4.20.3] - 2026-09-13
### Al apuntar un gasto, la categoría se sugiere sola

Su petición del 12/9: *«que te salga lo de sugerir categoría con IA en cuanto añadas el concepto,
que no tengas que ir a otros… guardar… abrir el gasto…»*. Opción A (él): la IA ofrece un chip;
las palabras clave se aplican solas.

- En Apuntar (+), con ≥3 letras y 400 ms quieto: si las palabras clave saben, se selecciona ese
  chip (con ✨). Si no saben y «Sugerir categoría (IA)» está encendido, a los 900 ms se pide a
  `categorize` (ya con freno) y aparece un chip «✨ …» — un toque lo aplica; nunca sola.
- Lo que tocas a mano manda: seguir escribiendo no te cambia el chip.
- Función pura `sugerenciaApuntar` (Claude) + UI en `ApuntarSheet` (Cursor). Tests unit + e2e.

## [4.20.2] - 2026-09-13
### Seguridad: nadie entra en un Hogar ajeno adivinando el código (OPS-06)

Encargo suyo: *«mirarlo bien Cursor y tú y arreglármelo, estas cosas y más es lo que quiero
evitar»*. Primera auditoría en `docs/briefs/ops-06-seguridad-auditoria-repo.md`.

- **P1 · Hogar.** El código de invitación eran 6 caracteres con `Math.random` y
  `join_household_by_code` no tenía freno: con registro abierto se podía probar códigos hasta
  entrar en un hogar ajeno y ver cuentas y saldos. Ahora: códigos de **10** con
  `crypto.getRandomValues` (`createHousehold` recorta a 12, no a 8), y la migración **0022**
  frena a 10 intentos cada 10 minutos por usuario ANTES de buscar. Los códigos viejos siguen
  valiendo. Aviso nuevo «demasiados intentos» en 3 idiomas.
- **P2 · app_events.** Migración **0023**: tope de tamaño (`not valid`, no revalida lo viejo) y
  freno de 600 eventos / 10 min por usuario que descarta sin error; las Edge (service role) no
  pasan por él.
- ⚠ **Las migraciones NO se aplican con esta beta**: van con el siguiente promote, por el workflow
  con `migraciones=si`, P2 antes que P1, y con el cliente de 10 caracteres ya servido.

Test `seguridad-hogar-eventos`. Plan votado por Cursor.

## [4.20.1] - 2026-09-13
### Gastos ya no se ralentiza de tanto subir y bajar

Su queja del 12/9: *«he bajado y subido varias veces… y de repente se ha comenzado a ralentizar»*.
Medido EN SU ONEPLUS 13 (APK .debug con la web de producción, 2.500 gastos, gestos reales por adb,
frames por rAF):

- La paginación solo crecía: ciclando arriba/abajo, de 374 a 794 filas, y los frames >33 ms por
  ciclo subían de 8 a 32.
- Con 554 filas QUIETAS: 0 frames lentos. El coste está en cada tanda nueva, que cuesta más
  cuanto más hay pintado. Cambiar de pestaña con muchas filas NO era más lento.
- `content-visibility:auto` se probó inyectado: EMPEORA (layouts ×3, 48 frames lentos).

Arreglo: al volver arriba del todo (scrollTop ≤ 150 y quieto 300 ms) la lista vuelve a la primera
tanda. A media lista no se suelta nada. e2e `gastos-suelta-filas` (ROJO sin el arreglo). Voto de
Cursor: sí.

## [4.20.0] - 2026-09-13
### Nueva ronda de beta: la numeración vuelve a empezar

Petición suya: *«resetea la beta, que va por la 108 si me has subido todo lo de antes… pa no seguir
aumentando»*. Producción está en **4.19.106** con todo lo anterior; la ronda de beta pasa a
**4.20.x**. Las 4.19.107 («Actualizar» dice qué ha pasado) y 4.19.108 (el cartel de reconectar)
nunca llegaron a producción: se juntan en **4.20.0**, UNA entrada de Novedades con sus dos tandas.
Su detalle técnico sigue abajo con sus números originales.

## [4.19.108] - 2026-09-13
### El cartel de «reconecta» se va al volver del banco

Su feedback del 12/9: *«cuando te sale reconectar un banco… conectas otra vez y desaparece el
cartel pero tarda 8 h laborables… luego sí funciona y desaparece»*.

`bankIssues` solo se reescribía al terminar `bankSync`, que pide saldos y movimientos de TODOS
los bancos a Enable Banking: decenas de segundos con el cartel diciendo «reconecta» ya
reconectado. Al volver de autorizar (APK `bank|ok` y web `?bank=ok`) se consulta `bank_links`
(una SELECT) y `issuesTrasReconectar` quita al momento el aviso de los bancos que la nube ya
tiene `active` (lo escribe `bank-callback`). Los que sigan a medias se quedan, y el sync de
detrás vuelve a avisar si algo sigue mal. Test `cartel-reconectar` con dos bancos. Voto de
Cursor: sí.

## [4.19.107] - 2026-09-13
### «Actualizar» dice qué ha pasado, en un solo aviso

Su queja del 12/9: *«si actualizo saldo de un banco… por ejemplo Trade Republic, no me dice nada
que se ha actualizado correctamente»*, y el rechazo viejo `tr-reactivo` (8/9): *«sale conectado
pero no te avisa ni nada»*. Tres causas que se sumaban:

1. El botón lanza bancos y brókers a la vez y **cada uno sacaba su toast**: ganaba el último.
2. `showToast` no cancelaba el temporizador anterior: **el del primer aviso borraba el segundo**.
3. Con un banco a medias se callaba el «✓ al día» de los demás, y el sync nativo de TR sin
   respuesta salía en silencio aunque lo pidieras tú.

Arreglo: `sincronizarAMano` junta los avisos de los dos (`opts.collect`) y enseña UNO con
`juntaAvisosSync` (⚠ delante, sin repetir); el temporizador se cancela y los avisos largos duran
4 s; con un banco pendiente se dice también lo que fue bien; TR sin respuesta avisa. El sync
automático sigue callado. Test `sync-manual-un-aviso`. Voto de Cursor: sí.

## [4.19.106] - 2026-09-13
### La ronda 4.19 sube a producción

Petición suya: *«súbelo a prod, que haya una nota de todo lo que sube, no 818138218 notas en
Novedades»*. Producción pasa de 4.18.25 a 4.19.106.

- **Una sola nota en Novedades.** Las 4.19.0–4.19.105 se juntan en la entrada 4.19.106, escrita
  para la familia; el historial de 4.18.x de producción se conserva tal cual. El detalle técnico
  de cada versión sigue aquí, en el CHANGELOG.
- **Lo que solo estaba en producción, portado antes de unir.** De los 53 commits de `main` que
  `beta` no tenía, casi todos eran portes de beta. De los 8 nacidos en main: dup en servidor
  (4.18.19), saldo con más de un banco (4.18.25) y escrituras mudas (4.18.23/24) ya estaban en beta
  por otra vía; se portan el rastro del tipo de saldo (4.18.19), `diag-widget.mjs` y la APK 45 /
  `apk.json` (4.18.22), con `build.gradle` idéntico a main.
- **Unión sin `-X theirs`:** `merge -s ours origin/main` sobre beta ya portada, para que `main`
  avance en fast-forward.

<!-- Entradas de la rama main (producción 4.18.8–4.18.25), conservadas al unir en 4.19.106 -->
## [4.18.25] - 2026-09-11
### El re-anclaje del saldo usaba el gasto de TODOS los bancos

Su padre: el banco decía **26,46 €** y la app le enseñaba **455,50 €**. Confirmado por él.

`applyBankBalances` despejaba la base con `spentM` = el gasto del mes ENTERO, de todos los
bancos, mientras que al pintar se resta solo el de esa cuenta (`spentByBank`). Su padre gasta
con CaixaBank y Trade Republic, así que al re-anclar Revolut se le devolvían ~429 € ajenos.

Era la **sexta copia sin migrar** de `saldoCuentaGasto`. El mismo fallo se arregló en agosto
—cuando un cargo de Revolut se comió 257,17 € de TR— pero **solo en la mitad que pinta**. Y el
comentario de `saldoCuentaGasto` ya avisaba: «vivían copiadas en cinco sitios».

- Ahora llama a `valueDesdeSaldo` (la inversa canónica) con `gastoDelMesPorBanco`.
- `fijos` no cambia: `bal − monthNet` sí es la inversa de `value + paidNet`.
- Test 7 de `saldo-por-banco` con **DOS bancos**: con uno pasa igual de bien estando roto.

Portado desde `1bfb4b28` (beta 4.19.57). Va SOLO esto a producción: es el único fallo de hoy
con víctima en `main` que el dueño no puede reproducir en su móvil.

## [4.18.24] — 2026-09-11
### Las escrituras de gastos a la nube ya dejan rastro

Cazado en vivo (widget 512 → app 497): filas solo en el móvil. Helpers `subirGasto` /
`borrarGastoNube` + cableado en backfill, OB, apuntar, editar, histórico. Sin cifras nuevas.
La 4.18.23 quedó con el bump antes de la ampliación; esta punta cierra docs-frescura.


## [4.18.22] — 2026-09-11
### Aely llega a su padre y a su pareja

Hasta hoy el rebrand vivía **solo en beta**. Para el resto de la familia la app seguía llamándose
«Mi Cartera», con el icono viejo —el que se corta en las notificaciones— y los avisos con el nombre
antiguo. Nada de eso viaja por OTA: es nativo y necesita APK.

- `app_name`, `title_activity_main` y `widget_title` → **Aely**.
- Los 15 PNG del icono adaptativo y el fondo (`ic_launcher_background.xml`), con la escala 0,49 que
  ya no se corta en la máscara redonda. Y el generador `scripts/iconos-aely.mjs`, para poder
  rehacerlos midiendo en vez de a ojo.
- Los cinco literales «Mi Cartera» del lado nativo: el título de las notificaciones, el nombre del
  canal de avisos y los dos del aviso de actualización.

**`versionCode` 42 → 45, y el 45 no es arbitrario.** Producción anuncia la 42, pero SU móvil lleva
la 44 (la APK de beta). Android no ofrece una actualización con código menor o igual al instalado,
así que con 43 o 44 él no vería nunca esta. Con 45 les llega a los tres.

**LO QUE NO SE HA TOCADO, Y ES LA RAZÓN DE QUE ESTO SE PUEDA PUBLICAR:**

`applicationId`, `package_name`, `custom_url_scheme` y la configuración de firma **no aparecen en el
diff**. Comprobado por grep sobre el diff completo contra `main`, no de palabra: 0 coincidencias.

Si cualquiera de esos cambiara, Android trataría esto como una **app distinta**: su padre y su
pareja se quedarían con la vieja instalada y sus datos dentro, y la «nueva» les llegaría vacía. Su
condición al autorizarlo fue literal — «siempre y cuando no reviente nada ni pise nada» — y eso es
exactamente lo que significa aquí.

Él ya les ha avisado del cambio de nombre. Aun así la nota de Novedades lo dice en la primera línea
y deja claro lo único que les importa: **mismos datos, no hay que hacer nada**.

## [4.18.21] — 2026-09-11
### Sella las dos de producción del 11/9

- Une **4.18.19** (el servidor deja de acertar por accidente con los movimientos repetidos) y **4.18.20** (rastro de qué saldo manda el banco, para el Revolut de su padre). Las dos con review ejecutada de Cursor.
- Las notas de las dos se funden aquí: ninguna llegó a publicarse por separado.
- ⚠ **Este promote DESPLIEGA las Edge Functions**, porque 4.18.19 toca `supabase/functions/_shared/presupuesto.ts` y `supabase.yml` se dispara con cualquier cambio bajo `supabase/**`. Avisado y autorizado por él ANTES de subir — a diferencia de esta mañana, que se desplegaron solas sin que ninguno de los dos lo viéramos venir.
## [4.18.20] — 2026-09-11
### Rastro de qué saldo manda el banco (el Revolut de su padre)

Su padre, 11/9: «Revolut no tiene ese dinero y le cambia el valor
constantemente sin tocar la cuenta». NO es el -204,54 EUR de agosto: aquello
era la caida ciega a balances[0] y ya esta arreglado. Aqui la cifra BAILA
entre sincronizaciones.

Y no se podia ni empezar a mirar. El banco manda una LISTA de saldos
(disponible, contable, pendiente...), elegimos uno por orden de preferencia,
y NO se guardaba cual. Si Revolut un dia manda ITAV y otro no, cambiamos de
saldo sin enterarnos y sin dejar rastro: al mirar el estado solo se ve un
numero distinto, sin nada que explique por que.

ESTO NO ARREGLA EL BAILE. No se aun por que pasa, y no voy a fingir que si.
Lo que hace es dejar el rastro para poder diagnosticarlo la proxima vez:
  - `balTipo`  : el saldo que se uso (ITAV, CLBD, ...)
  - `balTipos` : los que ofrecia el banco
  - `balSaldo` : el saldo crudo, sin la formula de dynBal encima

Va en las obAccounts Y en las cuentas PRINCIPALES re-ancladas: la Revolut de
su padre es principal, no obAccount, y era justo la que le bailaba.

Si en la proxima queja el tipo ha cambiado entre sincronizaciones, ahi esta la
causa. Si es el mismo, el problema lo tiene el banco y hay que ir por otro
lado. Hoy no podiamos distinguir esas dos cosas.

Tres tests nuevos en finance-core que vigilan el RASTRO, no solo el numero:
sin ellos cualquiera lo quita sin enterarse.

Ninguna cifra cambia para nadie.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
## [4.18.19] — 2026-09-11
### El servidor deja de acertar por accidente con los movimientos repetidos

Buscando su descuadre del widget (457 + 2,40 → la app decía 460 y el widget 475) salió esto, que no
es lo que buscaba pero es peor de dejar como estaba.

- **La regla del posible repetido estaba en el cliente y NO en el servidor.** `expenseCountsCash()`
  excluye `e.possibleDup`; `cuentaParaPresupuesto()` no tenía nada equivalente. La tanda
  `posible-repetido` que él aprobó portó a producción la mitad de cliente y dejó fuera la del
  servidor. Es el patrón de siempre: **la misma regla escrita en dos sitios y solo se cambió uno.**
- **Y aun así cuadraba, por accidente.** `bancoDeSource("ob:trade_republic#dup")` devolvía
  `"trade_republic#dup"` —el marcador pegado al nombre del banco— que no casa con ninguna cuenta, así
  que el movimiento quedaba fuera del presupuesto por el filtro de bancos y no por la regla. El día
  que alguien limpiara ese parseo (que parece un despiste porque lo es), los repetidos se habrían
  puesto a contar en el widget **en silencio**, y el cliente habría seguido sin contarlos.
- Se arreglan **las dos mitades**: el parseo deja de confundir el marcador con el banco, y la regla
  se escribe de verdad (`esPosibleRepetido`). Ahora coinciden porque lo dicen, no porque se tropiecen.

**El test de espejos tenía un agujero y por eso nada de esto saltó.** `presupuesto-servidor` carga
las dos implementaciones y exige el mismo número, pero:

1. Su escenario **no incluía ningún posible repetido**, o sea que no tocaba la única regla en la que
   los dos lados discrepaban. Un espejo que no incluye el caso que difiere no es un espejo.
2. Al añadir la fila, primero la puse en `ob:revolut#dup` — y **el test seguía verde sin el arreglo**,
   porque Revolut ya queda fuera por el filtro de bancos. Una fila que se descarta por OTRO motivo no
   prueba nada. Tiene que ir en el banco del día a día.
3. `paraCliente` pasaba solo el `source`, así que el cliente **no reconocía el repetido**: el mismo
   movimiento lleva `possibleDup` en el cliente y `#dup` en el `source` de la nube. Ahora el espejo
   le da a cada lado su marca, que es como llega en la vida real.

Verificado quitando la regla: el servidor da 155,71 y el cliente 140,71. Los 15 € que faltaban.

⚠ **Esto NO explica su 475 €.** Con el parseo antiguo los dos lados coincidían, así que el descuadre
del widget que él vio el 10/9 sigue **sin causa conocida**. Lo que se arregla aquí es una trampa que
habría aparecido sola más adelante.

## [4.18.18] — 2026-09-11
### Pulido B2/B4/B5

- Cartera recibe su activación por el mismo bus que Gastos y anima el patrimonio al entrar, sin
  tocar el carrusel que premonta las pestañas vecinas.
- Inicio muestra siluetas después del splash hasta que termina la carga inicial, y respeta reducir
  animaciones. En tema claro, el texto verde pequeño usa un tono legible sobre blanco.
- Guardián: `e2e/pulido-b245.spec.mjs`. OTA; sin Aely, cambios nativos, Edge ni identidad.
## [4.18.17] — 2026-09-11
### Acabado v4

- El anillo de presupuesto parte vacío y se completa tras el splash, para que su transición se
  llegue a ver; con reducir animaciones conserva directamente el valor correcto.
- El porcentaje usa la tipografía de cifras de la app, las teclas de Apuntar alcanzan 56 px y los
  carruseles horizontales muestran un borde que indica que hay más contenido.
- Guardianes: `e2e/acabado-v4.spec.mjs` y `e2e/pulido-apuntar.spec.mjs`. OTA; sin cambios
  nativos, de Supabase ni de identidad de aplicación.
## [4.18.16] — 2026-09-11
### Revisión plegable

- Porte limitado de `revision-plegable`: la cabecera accesible de cada tanda permite encogerla y desplegarla sin tocar sus marcas, notas ni veredicto. Al aprobar, se encoge solo esa tanda; al desplegarla se puede consultar o cambiar de opinión.
- El estado de desplegado solo vive durante la vista. Se conserva el guardado de veredictos que ya tenía producción, sin importar la recuperación entre compilaciones ni rutas de deshacer/cambio en nube de la tanda beta.
- Regresión e2e: aprobar una tanda la encoge, se vuelve a desplegar y mantiene disponible el veredicto.
- Las notas de la versión se añaden a `src/data/release-notes.json`, que es la fuente del histórico fuera del bundle; `RELEASE_NOTES` permanece vacío en el módulo.
- OTA web; sin APK, Supabase, Edge, Aely ni cambios de identidad/cloud.
## [4.18.15] — 2026-09-11
### Panel «Revisar la beta»: ronda entera

- `betaChecklist(version, prodVersion)` reúne las tandas de todas las versiones posteriores a
  producción y hasta la que corre; cada una conserva su versión en el título y un id propio.
- `useProdVersion` comparte la lectura de Pages entre el panel y Ajustes, para que el contador y
  la checklist usen exactamente la misma ronda.

**Por qué:** revisar únicamente la última versión ocultaba tandas que ya estaban en la misma beta.
Sin versión de producción confirmada se conserva el comportamiento prudente de una sola versión.

OTA; sin Android.

## [4.18.14] — 2026-09-11
### Orden manual dentro del día en Gastos

Las filas de un mismo día se pueden reordenar arrastrando su asa. El orden se guarda como lista
de ids por fecha en `settings.expenseOrder`, por lo que sincroniza con la cuenta sin volver a
serializar el histórico `expenses`, que sigue partido en su propia clave.

**Por qué:** muchas operaciones bancarias solo informan el día. Inventar una hora para alterar el
orden sería falsear el movimiento; este ajuste conserva la fecha original y deja que la persona
decida únicamente entre filas del mismo día. El destino se comprueba de nuevo al guardar para no
mezclar días al cruzar un separador. Guardián: `e2e/gastos-orden.spec.mjs`.

OTA; sin cambios nativos ni de Supabase.
## [4.18.13] — 2026-09-11
### Categoría Inteligencia artificial

- Porte manual desde la tanda aprobada `categoria-ia`: añade `ia` a `CATEGORIES`, sus tres
  traducciones y las palabras clave de ChatGPT, Claude, OpenAI, Cursor y servicios similares.
  Solo se autodetectan movimientos nuevos; no hay migración ni recategorización del histórico.
- La lógica compartida de ingest y la lista permitida de `categorize` ya aceptan `ia`, para
  conservar la paridad con el cliente. El despliegue de la Edge Function queda pendiente de
  autorización expresa del propietario; este commit no despliega ninguna Edge Function.
- Guardianes en `categories` e `ingest-classify` comprueban la categoría cliente y compartida.

## [4.18.12] — 2026-09-11
### Las notas de Novedades salen del bundle (NOTAS-BUNDLE, portado de beta)

- La ronda de prod del 11/9 dejó el **gzip del index a 0,2 KB del tope** (343,8 de 344) porque las 92 versiones de Novedades viajaban pegadas dentro del JS. Portar una tanda más era imposible sin esto, y el gzip es lo que de verdad baja al móvil.
- El histórico pasa a `src/data/release-notes.json`; el build lo copia a `public/release-notes.json` y deja el array del index VACÍO. `ensureReleaseNotes()` lo carga al abrir Novedades o el panel de revisión. El bundle del móvil lo lleva igual: `build-www.mjs` copia `public/` entero.
- **Medido: 1212,6 → 1101,1 minificado y 343,8 → 305,8 gzip.** 38 KB menos, un 11 %. Los topes **BAJAN** a 1135 / 318 sobre lo medido hoy: un tope que sube y nunca vuelve a bajar deja de ser un presupuesto y pasa a ser un sello de goma.
- **Rescatados cinco comentarios** que vivían dentro del array y que un JSON no puede guardar: la práctica de que una tanda aprobada se BORRA del array (si se deja marcada, el panel se la sigue pidiendo), que los puntos de una tanda no se reescriben entre compilaciones (el panel hereda los ✓/✗ casando por texto), y que lo ya promocionado solo no se vuelve a contar. Lo cazó `season-detalle`, que vigilaba uno de ellos; los otros cuatro se habrían perdido en silencio.
- `docs-frescura` ya no mira el módulo para comprobar la nota de la versión: con el array vacío a propósito, ese guardián habría pasado SIEMPRE. Ahora mira el JSON.
- `release-notes-max` deja de clavar a mano versiones de beta (`4.19.5`/`4.18.7`), que aquí no existen: la ronda se deriva de los datos, así el guardián dice lo mismo en las dos ramas.
- `rnItems` aplana las tandas: una versión que declara tandas y se olvida de los `items` de primer nivel salía MUDA en Novedades (le pasó a la 4.18.5).

## [4.18.11] — 2026-09-11
### Posibles repetidos de Open Banking se revisan, no se pierden

- Un `Movimiento` sin comercio de Open Banking que coincide en el mismo banco, importe y ventana
  de ±3 días con una notificación o gasto manual entra marcado como posible repetido. Ya no se
  descarta automáticamente: dos cargos reales iguales se conservan para que se puedan distinguir.
- La ficha permite confirmar «Es el mismo» (borra la fila OB y deja lápida para que el sync no la
  reviva) o «Son distintos» (la fila empieza a contar en efectivo y presupuesto).
- La marca viaja como sufijo seguro `#dup` en `source` (`ob:ent#dup`): sobrevive a pulls y, sin
  desplegar Edge, un servidor anterior lo interpreta como banco no diario y lo deja fuera.
  `possibleDupOf` se mantiene local porque solo identifica el gemelo para resolverlo.
- Se añaden regresiones para la notificación real sin `ent`, el aislamiento entre bancos, decisiones
  idempotentes, lápidas y serialización/deserialización de `#dup`.

OTA; sin Android. La paridad explícita del cálculo de presupuesto dentro de la Edge Function queda
pendiente de su propio despliegue: este port no modifica ni despliega servidor.
## [4.18.10] — 2026-09-11
### Multicuenta Open Banking (rescate de aprobada)

Porte a mano desde `beta` de **4.19.0/multicuenta**, sola, desde `main`. Sin cherry-pick.

- `flattenBankTx` lee `accounts[].transactions` (todas las cuentas del enlace), no solo `lk.transactions` (primera cuenta). Shape antiguo sin `accounts` sigue valiendo.
- Test: `flattenBankTx incluye todas las cuentas, no solo la primaria`.
- Sin `inicioDeMesMs`, sin Aely, sin import histórico.
## [4.18.9] — 2026-09-11
### FIN-07 · El histórico entero, y una descarga a medias que ya no borra

- **Producción llevaba un `.limit(2000)` sin paginar** en `pullExpenses`, y `syncCloudExpenses` REEMPLAZA los gastos de origen `supabase` por lo que acaba de llegar. Con más de 2.000 gastos en la nube —lo normal tras importar el histórico de un banco— **cada sincronización borraba de la app los más viejos**. Le pasaba a toda la familia, no solo a él. Su queja del 10/9 («solo baja el histórico un poquito») era esto, y no el importador.
- Ahora se **pagina por clave** (`fecha` desc + `id` desc, páginas de 1.000) hasta el final. Por clave y no por desplazamiento porque un gasto que entre a mitad de la descarga corre la lista y te hace saltarte una fila o repetirla. El `id` en el orden no es decorativo: sin un segundo criterio ÚNICO, dos gastos del MISMO día pueden salir en distinto orden entre páginas y entonces uno se repite y otro se pierde.
- **Una descarga a medias ya no es un borrado.** Si se llega al tope de seguridad (50.000), se conserva lo que ya había y solo se añade lo nuevo, en vez de descartar todo lo que no llegó. Regla desde la contención 4.18.6: nunca se borra por ausencia.
- Aviso en los tres idiomas que dice lo que le importa —que **no ha perdido nada**— y no el número.
- Guardián `pull-historico-entero` (9 casos) sobre el código real del módulo, verificado en rojo quitando la guarda y en verde al volver a ponerla.
- Tanda nacida **desde `main`**: sube sola, sin esperar a la ronda de beta.

**Crédito:** la paginación por keyset es de Cursor (`tanda/fin-07-pull`); el tope de seguridad, la guarda de la mezcla y los guardianes, de esta tanda. Se reconcilian las dos en una.

## [4.18.8] — 2026-09-10
### Las dos tandas que aprobó, subidas solas

- Porte a mano desde `beta` de **informe del mes cerrado** (4.19.12) y **límite por categoría** (4.19.13), las dos aprobadas por él en el móvil. Commits nuevos sobre producción, no cherry-pick: los de `beta` arrastran ~50 commits de contexto y con `-X theirs` el resultado compilaba con `doImport` declarado dos veces.
- `monthBudgetStats` acepta `nowMs`/`hastaMs`, los dos opcionales. **Sin ellos se comporta exactamente igual que hasta ahora**: desde el día 1 en adelante.
- `reservedSince` acepta tope superior: una reserva hecha ya en el mes nuevo no baja el presupuesto del informe del mes cerrado.
- **No se porta `inicioDeMesMs`**, que en `beta` llegó con la ventana de mes — la tanda que él RECHAZÓ. Dentro se usa el `startOfMonth` que producción ya usa: una sola regla de mes, que es el criterio 1 de su propia tanda de categorías.
- **No sube «revisiones plegables»**: mezcla el panel de beta con el deshacer del import histórico, y producción no tiene ese motor.
- Regresión añadida por un fallo que cazó Cursor revisando y que habría llegado a la familia: compartir el informe desde Ajustes u Hogar llamaba a `inicioDeMesMs` y reventaba con `ReferenceError`.
- Topes de tamaño +3 KB con motivo escrito: producción todavía lleva las notas dentro del módulo; el recorte a JSON sube por su cuenta y entonces estos topes bajan.

# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/) y versionado [SemVer](https://semver.org/lang/es/).

## [4.19.105] - 2026-09-13
### Panel de pruebas limpio (sin código)

Petición suya: *«actualízame la zona de pruebas para no tener cosas repetidas… de las que rechacé y
quedan pendientes»*. Cruzado con TODOS sus veredictos de beta: de 40 tandas por encima de prod
quedan 5. Fuera las aprobadas y las sustituidas; cada saga es UNA tanda con su rechazo como paso:
`hojas-scroll` (absorbe `guardar-pie`), `ab-idiomas`, `historico-lista` (nueva: junta 27, 92,
96, 99 y 102), `rol-sin-salto-3` y `historico-importar` (nunca juzgada). Voto de Cursor: sí.

Guardianes `beta-tandas-vacias` y `release-notes-max` actualizados: sus ids «pendientes» ya
estaban aprobados, y la ronda corta sigue probando que el panel llega más allá del MAX del index.

## [4.19.104] - 2026-09-13
### El filtro de Gastos vuelve a scrollear (regresión de Guardar)

La 4.19.100 puso `display:flex; overflow:hidden` en **todas** las `.v4-sheet` para fijar el
CTA de Apuntar. Las hojas sin `.v4-sheet-body` (filtro de Gastos, Más…, fijos, deudas…) se
quedaron sin scroll: «no puedo bajar».

Arreglo: la hoja por defecto vuelve a `overflow:auto` (pad 36). Solo
`.v4-sheet:has(>.v4-sheet-body)` usa la columna + pad 52 del halo. Guardianes: `v4-cta-halo` +
e2e `hojas-scroll`.

## [4.19.103] - 2026-09-13
### Idiomas en/ca fuera del bundle (A/B de gzip)

Condición 0 del brief del 13/9: medir si sacar inglés y catalán del `index.html` liberaba
margen. Medido sobre el minificado de la 102: ~37 KB min / ~11 KB gzip al vaciar los
diccionarios; al sacarlos de verdad del JS (build → `public/i18n/en.json` + `ca.json`) el
presupuesto pasó de 1195/1195 KB min a ~1022 KB y el gzip de ~331 a ~279 KB.

`es` se queda en el bundle (defecto + fallback de `t()`). Si el idioma guardado es en/ca, el
arranque espera el JSON antes de montar React (sin frame en español). El SW precachea los dos
JSON. Al cambiar idioma en Ajustes también se carga antes de pintar. Primera carga offline en
en/ca cae a español sin romper.

Guardianes: `i18n-keys` sigue leyendo la fuente; nuevo `i18n-bundle` comprueba que el producto
no arrastra `Object.assign(LANG.en|ca)` y que los JSON tienen las mismas claves.

## [4.19.102] - 2026-09-13
### El Saveback de Trade Republic ya no sale como ingreso en el histórico

Su captura del 12/9: el histórico ofrecía «Movimiento · 2026-09-01 · +10,34 € ingreso», y en la
app de TR es el Saveback del 2/9, 10,34 € que SALEN hacia el FTSE.

Parecía un signo volteado con un día de menos. **No lo era.** El payload crudo de TR en
`app_events` trae los dos apuntes: `10.34 CRDT 2026-09-01` (TR abona el Saveback al efectivo) y
`10.34 DBIT 2026-09-02` (lo retira para comprar). `mapTransaction` iba bien; el histórico ofrecía
la mitad que entra. Es el par que el sync diario reconoce desde el 4/8 (`findCashbackTwin`) y que
`histClassifyCandidates` no miraba.

Arreglo: la regla del par pasa a `esGemeloCashback` (un solo sitio) y la usan el sync y el
histórico (`histParesCashback`). En el histórico, la entrada sin nombre con su salida gemela
(mismo banco, mismo céntimo, 0–10 días después) sale `dup / cashback-par` y no se ofrece; la
salida, si es nueva, sale como Inversión. 1:1. Sin gate `rewardInv` (voto de Cursor).

Test `hist-cashback-par` (7 casos, dos bancos, con nombre, fuera de ventana, 1:1 y el sync),
3 en ROJO sin el arreglo.

## [4.19.101] - 2026-09-13
### El saldo al cambiar de rol: el redondeo de TR (su tercer rechazo)

Rechazo en 4.19.99.1 de `rol-sin-salto-2`: *«ya no son 300 pavos… 6724 pasamos a 6681, ha
mejorado pero sigue reduciéndose»*. No era un rechazo anterior al arreglo: probó la buena.

Los 43 € eran el **redondeo de Trade Republic**. `totals` lo calcula con
`roundupOf(gastos del mes, diaria.roundup)`, y `applyAccountRole` re-anclaba con
`totals.roundupThisMonth` de la diaria VIEJA — 0 si TR venía de Recibos. Y el gasto del mes del
re-anclaje no pasaba por `expenseCountsCash` (contaba posibles repetidos que lo pintado no cuenta).

Tercera variable del mismo fallo en tres días (`paidNet` 4.19.84, `spentOwn` 4.19.97, redondeo
ahora), las tres por lo mismo: copias a mano de lo que calcula `totals`. Arreglo de fondo: los
insumos del saldo de gasto salen de **una sola función**, `insumosSaldoGasto(state)` (01-i18n).
`totals` la usa con el estado actual; `applyAccountRole` con el estado CON EL ROL NUEVO. Fuera
`pnTras`, `spentTras`, `ruOfA`, `injOfA`.

⚠ El test tenía `roundupThisMonth: 0` sembrado a mano — la misma trampa que el `spentByBank: {}`
de la 97. Ahora el test llama a `insumosSaldoGasto` y no hay doble. Casos nuevos con redondeo 2×,
céntimos y un posible repetido, verificados EN ROJO sobre la 99 (6324,92 contra 6323,54).

Voto de Cursor: verde a causa, diseño y rama (desde `origin/beta`).

## [4.19.100] - 2026-09-13
### Guardar: el CTA fuera del scroll (3er rechazo)

Rechazo en 4.19.99.1 de `guardar-cta`: *«sigue cortado… en todo tipo de letras»* y
*«sigue viéndose lo que va muy rápido pero se nota»* al borrar.

La 4.19.93 subió el `padding-bottom` de `.v4-sheet` a 36 px (halo geométrico ≈ 34 px) y
apagó el halo con `html.ask-open`. **No bastó**, y medido el 13/9:

1. **Corte.** Con el teclado de Apuntar, `scrollHeight` 762 > `clientHeight` 748 (`max-height:
   88dvh`). El padding-bottom se iba **debajo del pliegue** del `overflow:auto` de la hoja:
   visibles ~38 px bajo el botón, y el blur del `box-shadow` (offset+blur ≈ 42 px) se cortaba
   en seco. Por eso lo veía en toda letra, no solo en normal.
2. **Destello.** `ask-open` se marcaba en `useEffect` → un frame con el ask encima y el halo
   mint todavía encendido.

Arreglo: `.v4-sheet` en columna (`overflow:hidden`), cuerpo scrolleable (`.v4-sheet-body`),
CTA/danger como hijos directos con pad 52 px; `useLayoutEffect` para `ask-open`. Apuntar y
ficha de gasto.

Tests: `tests/v4-cta-halo.test.mjs`. Tanda nueva `guardar-pie` (no se reusa `guardar-cta`).

## [4.19.99] - 2026-09-12
### Un banco se comía a otro en el histórico, y lo cantó la sonda

Su relato de las 19:28: *«la primera vez que le he dado me han salido cosas del banco Sabadell…
y nada de Trade Republic. Le doy otra vez y sale lo de Trade Republic y Revolut y todo genial,
**PEROOOOO desapareció el Sabadell, me marca 0**… y de la Caixa igual, tengo 2 cosas de agosto y
sale 0»*.

**No hizo falta adivinar: la telemetría de la sonda (4.19.92) ya estaba en su móvil.** Dos búsquedas
con dos minutos de diferencia:

    19:23   bankReported    92   ·  llegan  40  ·  skippedUniq     0
    19:25   bankReported  1230   ·  llegan 106  ·  skippedUniq  1104

**1.104 filas de 1.230 tiradas en silencio.** Ahí estaban su Sabadell y su CaixaBank.

La clave anti-duplicados del aplanado era `ext_id|signo|fecha|importe|comercio` y **no llevaba el
banco**. Como Trade Republic no manda ni `ext_id` ni comercio, un cargo suyo y uno de Sabadell del
mismo día e importe eran «el mismo» y el segundo se descartaba. Cuál sobrevivía dependía del orden
en que llegaran los bancos — por eso cambiaba de una búsqueda a otra.

**Es la TERCERA clave de identidad sin banco que aparece hoy**, después de `histCandExisting` (un
«Movimiento» de Revolut se comía el de TR) y del susto ya conocido del sync diario. Tres sitios
distintos, el mismo olvido.

Tests: `tests/hist-uniq-por-banco.test.mjs`, 4 casos, verificado en rojo (2 de 4 caen). Uno de
ellos comprueba lo contrario a propósito: **dentro del mismo banco la repetida se sigue tirando**,
que es para lo que existe la clave.

⚠ **Esto NO arregla el signo de Trade Republic.** Su FTSE de 10,34 € del 2 de septiembre —un
Saveback, o sea dinero que SALE hacia la inversión— sigue llegando como **ingreso de +10,34 € y
con fecha 1**. Eso es la saga del signo de TR por Open Banking, sigue abierta, y va aparte.

## [4.19.98] - 2026-09-12
### Swipe: React se comía scroll-host-swipe a mitad de gesto

La 4.19.94 añadía `.scroll-host-swipe` por `classList` en `leaveScrollHost`. En el mismo
gesto `setHostTab(-1)` re-renderiza App y el `className` de React del track era solo
`"track"` (+ park si hostTab>=0) — se perdía la clase y el padding volvía a 6 px. Por eso
el e2e (DOM a mano, sin setState) pasaba y él veía el mismo corte.

Arreglo: `hostTab<0` → `scroll-host-swipe` en el `className` de React; refuerzo en
`html.scroll-host-swipe` sin depender solo de `:has`.

## [4.19.97] - 2026-09-12
### El saldo al cambiar de rol: arreglé una mitad y me dejé la otra

**Su segundo rechazo del mismo bug**, con la secuencia exacta escrita por él:

> *«le doy a trade republic le cambio de Todo a solo recibos… compruebo que está a 0 lo de gastos
> dado que no cuenta y perfecto se pone bien. Luego vuelvo a trade republic elijo gastos diarios y
> **PAM, 300 pavos menos**… sigue igual fallando»*.

Tenía razón. La 4.19.84 curó `paidNet` —los recibos ya cobrados del mes— y **se dejó la otra
variable que también baila con el rol**: `spentOwn`.

`gastoDelMesPorBanco(gastos, dailyEnt)` reparte el gasto del mes por banco y **manda los gastos SIN
banco asignado a la cuenta de gasto diario** (`00-core`). Así que en cuanto una cuenta pasa a ser
la diaria **hereda de golpe todos los huérfanos del mes**, y `saldoCuentaGasto` los RESTA. Al
re-anclar `value` con el `spentOwn` de antes —el de cuando esa cuenta no era la diaria, sin esos
gastos— el saldo pintado se iba exactamente esa cantidad. Sus 300 €.

Reproducido con su secuencia antes de tocar nada, y medido paso a paso:

    inicio (Todo)      rol ambos    value 6700   spent 300   pn -300   → PINTA 6100,00
    → Recibos          rol fijos    value 6400   spent   0   pn -300   → PINTA 6100,00
    → Gasto diario     rol diario   value 6400   spent 300   pn    0   → PINTA 6100,00

### Y por qué el primer arreglo pareció completo: mi propio test era más simple que la app

`tests/rol-cuenta-sin-salto.test.mjs` construía sus totales con **`spentByBank: {}`**, un mapa
vacío. Con eso, el reparto de gastos por banco nunca cambiaba al cambiar el rol… que es justo la
mitad del fallo. **El test daba verde sobre un arreglo a medias porque el doble no se parecía a la
realidad en lo único que importaba aquí.** Ahora calcula `spentByBank` con `gastoDelMesPorBanco`,
igual que `totals`, y los gastos se siembran **sin banco** a propósito: con `ent` puesto no se
reparten y el fallo no aparece.

Dos casos nuevos: **su secuencia entera** (Todo → Recibos → Gasto diario) y que los huérfanos del
mes se los quede **la diaria nueva y no la vieja** cuando el cambio lo hace otra cuenta. Verificado
en rojo quitando el arreglo: `actual: 5800, expected: 6100` — sus 300 € otra vez.

## [4.19.96] - 2026-09-12
### La fecha del banco baila, y sin comercio no hay más pistas

Nos mandó **tres capturas a la vez** —lo que tiene en Gastos, lo que dice la app de Trade Republic
y lo que le ofrece el histórico— y con eso se acabó el adivinar:

    Consum 6,49 €            Gastos y TR: 11 sept   ·  histórico: 2026-09-12   (+1)  ❌ «nuevo»
    La Tagliatella 21,37 €   Gastos y TR: 10 sept   ·  histórico: 2026-09-11   (+1)  ❌ «nuevo»
    MAPFRE 2,40 €            Gastos y TR: 10 sept   ·  histórico: 2026-09-11   (+1)  ❌ «nuevo»
    Bizum a Ionan 6,40 €     Gastos y TR: 10 sept   ·  histórico: 2026-09-10   (0)   ✅ detectado

El histórico devuelve la fecha **contable** (la tarjeta se apunta al día siguiente) y el sync
diario la de la operación. Y como **TR por Open Banking no manda comercio** —todo llega como
«Movimiento»—, la fecha era prácticamente lo único que quedaba para reconocer un cargo. De ahí sus
**92 «nuevos»** estando todos apuntados. **El único que detectaba era el Bizum**, que es el único
que llega con la fecha exacta.

⚠ Y esto **no** es lo mismo que el día local de la 4.19.92: aquello era el gasto de madrugada
guardado con el ISO del día anterior. Dos causas distintas, las dos reales, las dos hacían falta.

**La regla buena ya existía en esta casa.** El sync diario lleva desde el 7/9 dando ±3 días para
los «Movimiento» sin nombre (`gemeloOtraVia`), y el histórico comparaba al día exacto: otra vez la
misma pregunta contestada de dos maneras. Ahora `DUP_DIAS_MS` y `sinComercioReal` viven una sola
vez y las usan los dos caminos.

**Y NO se marca como «repetido», sino como «puede que ya lo tengas», DESMARCADO.** La diferencia
no es de matiz: ensanchar a ±3 días puede tapar un gasto de verdad del mismo importe en días
seguidos, y eso sería peor que el fallo que arregla. Él mismo puso el freno en el paso 6 de la
tanda que aprobó: *«lo que NO puede pasar es que te marque como repetido algo que no tienes»*.
Decide él, con un clic. Voto de Cursor: opción (a).

### Y de paso, un falso positivo que llevaba ahí desde siempre

Lo destapó el test, no una lectura: `histCandExisting` indexaba por día|importe|comercio **sin el
banco**. Con un comercio de verdad da igual —el nombre distingue—, pero con «Movimiento» el
nombre no distingue nada: **un «Movimiento» de Revolut del mismo día e importe se comía el de
Trade Republic** y la fila salía como «ya lo tienes apuntado» estando sin apuntar. Es el mismo
susto que ya se arregló en el sync diario (*«sin filtrar banco, un Revolut de 23 € se comía un
TR»*) y que aquí faltaba. El filtro por banco solo aprieta **donde no hay nombre**: marcar de
menos deja una fila duplicada, que se ve y se borra; marcar de más esconde un gasto, que no se ve.

Tests: `tests/hist-fecha-que-baila.test.mjs`, 6 casos, con **sus cuatro movimientos reales** y
**tres frenos deliberados** (comercio de verdad, fuera de ventana, otro banco). Los frenos son la
mitad que importa: sin ellos esto sería una máquina de esconder gastos.

## [4.19.95] - 2026-09-12
### El banco recién conectado sale sin salir y volver a entrar

Suyo, desde la app (17:09): *«si conectas un banco como acabo de hacer con la Caixa, desde la zona
de bancos, no te aparece hasta que no tires para atrás y vuelvas a entrar en la zona de bancos»*.

`BankPanel` cargaba sus links en `useEffect(loadLinks, [uid])`, o sea **una vez al montar**. Al
volver de autorizar el banco la pantalla ya estaba montada, así que seguía enseñando la lista de
antes hasta que la cerrabas y la abrías. Ahora `runBankSync` avisa al terminar
(`mc-bank-links-changed`) y el panel vuelve a leer.

**El aviso se manda SIEMPRE**, haya ido bien el sync o mal: el caso que a él le fallaba es justo
el de después de conectar, que es cuando la fila acaba de nacer, y ahí un sync a medias es tan
probable como uno limpio.

Tests: `e2e/bancos-lista-fresca.spec.mjs`, **verificado en rojo** quitando el listener
(`Expected: 2, Received: 1`). El doble de `cloud.bankLinks` responde **por llamada** —la primera
lo de antes, la segunda con el banco nuevo—, que es la secuencia real; con un doble fijo el test
pasaría igual sin el arreglo.

⚠ El `removeEventListener` se queda **sin test, y queda escrito por qué**: para probarlo hay que
CERRAR el panel, y en este repo no hay ninguna puerta e2e que lo cierre — ningún spec de bancos lo
hace y `Escape` no es el gesto (se cierra por `useBackClose`). Un test que «cierra» sin cerrar de
verdad sería un verde que miente, que es peor que no tenerlo.

## [4.19.94] - 2026-09-12
### Al deslizar tabs ya no se corta la cabecera (ola intacta)

Con la ola nativa la pestaña activa es `.page-scroll-host` (`padding-top: safe-top+10`,
`position:fixed`). Al deslizar entre pestañas `leaveScrollHost` quitaba esa clase y el
padding caía a 6 px **con el mismo scrollTop** → cabecera fuera y lista cortada a media
tarjeta en las dos páginas a la vez (capturas 12/9; la ola en reposo ya estaba bien).

Arreglo: clase `.scroll-host-swipe` en el track desde el leave hasta el enter — mismo
padding que el host, `.app` sin padding-top duplicado — sin volver a `position:fixed`
(el carrusel necesita `translate3d`). Guardián e2e a mitad de leave + test que demuestra
el salto si falta la clase.

## [4.19.93] - 2026-09-12
### Guardar: halo completo, y apagado bajo askConfirm

Diagnóstico de Claude (aritmética, no sospecha):

1. `.v4-cta` tiene `box-shadow` que llega ~34 px bajo el botón; `.v4-sheet` solo dejaba
   18 px + safe-bottom con `overflow:auto` → halo cortado («sale cortado lo de guardar»,
   solo con letra normal porque con grande la hoja scrollea). `padding-bottom` → 36 px.
2. Al borrar, `askback` (z 230) y la ficha (z 80) comparten el borde inferior: el halo mint
   se lee a través del velo. `html.ask-open .v4-cta{box-shadow:none}` + `AskHost` marca
   `ask-open` en el documento. Sin tocar z-index.

Guardián: `tests/v4-cta-halo.test.mjs`.

## [4.19.92] - 2026-09-12
### El histórico reconoce lo de madrugada, y dos notas de versión que se pisaban

**1 · Su rechazo de «Importar histórico · 1», con causa medida.** Textual: *«salen un montonazo de
repetidos… actualmente solo estaba mirando de septiembre dado que ya me los sé, y están TODOS
apuntados correctamente, así que los que salen que “no son repetidos” sí que lo son y están mal»*.

`histCandDupKey` partía el día con `String(dt).slice(0,10)`, o sea el día **UTC** del texto
guardado. En España una compra hecha entre las 00:00 y las 02:00 se guarda con un ISO del día
ANTERIOR: el histórico comparaba el día 4 contra el día 5 que manda el banco y lo daba por NUEVO
estando ya apuntado.

**Es la TERCERA vez que muerde la misma regla.** Ya se arregló en las cabeceras de Gastos (el
mismo día salía dos veces seguidas, en una captura suya del 11/9) y en el orden a mano (arrastrar
un gasto de madrugada no hacía nada, porque la clave de orden era la del día anterior). La regla
buena vive en `00-core` desde entonces —`dayKey` / `diaDeGasto`—, y su propio comentario avisa de
que son «DOS sitios que tienen que decir lo mismo». Eran tres.

`tests/hist-dia-local.test.mjs`, 5 casos, **con el huso fijado a Europe/Madrid a propósito**: en
una máquina en UTC —como el CI— el fallo no se reproduce, y un verde así no valdría para nada.
Verificado en rojo: caen 3 de 5, y los dos que comprueban que NO se ha aflojado el criterio (dos
días distintos de verdad siguen sin casar) pasan en los dos lados, que es lo que tienen que hacer.

**2 · La sonda del histórico ahora viaja.** Hasta hoy solo existía en un aviso de pantalla y en
`window.__histDupProbe`, así que diagnosticar dependía de que a él le diera tiempo a leer el toast
y copiarlo. Ahora queda en telemetría (`node scripts/errores.mjs --kind=hist`). Van contadores y
las dos fechas del rango —que hacen falta para distinguir «el banco no lo mandó» de «el banco lo
truncó»—; ni un comercio, ni un importe, ni un banco.

**3 · Y dos notas de versión que se pisaban.** Trabajando Cursor y yo a la vez, los dos sellamos
una **4.19.89**: el fichero acabó con DOS entradas con ese número. En Novedades la familia habría
visto «v4.19.89» dos veces, y en el panel `filter(n => n.v === base)[0]` se queda con la primera,
así que la otra existía sin verse. Lo mismo con la tanda `ola-nativa`, que estaba en la 4.19.87 y
en la 4.19.91 (la .87 no llegó a publicarse, CI rojo): en su panel son dos tandas idénticas
pidiéndole el mismo trabajo, que es justo lo que nos hizo podar el panel («que no sean
repetitivas… que realmente pueda probarlas»).

Nace `tests/notas-sin-duplicados.test.mjs`: ninguna versión repetida en todo el histórico, ninguna
tanda repetida **dentro de la ventana viva** (las 20 que enseña Novedades) y ninguna tanda sin
pasos. La ventana acota a propósito: más atrás hay ids repetidos de rondas ya cerradas y reescribir
el histórico no arregla nada. Verificado en rojo contra el fichero de antes: `4.19.89 (posiciones
2 y 3)`.

## [4.19.91] - 2026-09-12
### `ultimoScrollH` ya no traga gestos reales (ola + barra)

Claude midió bien: `rebote-barra-inferior` en CI no era flaky. Con el host a pantalla el
`scrollHeight` se recalcula tarde y `onPageScroll` hacía `return` entero al ver el cambio
de alto — también cuando el `dy` era un gesto de verdad. Eso encaja con su «stopper» / «bajas
y no pasa nada, luego sí».

Arreglo: si el alto cambió pero `|dy| >= 6`, se sigue el flujo normal (hide/reveal). Solo se
ignora el nudge de layout. Quitado el scroll chico del e2e que tapaba el bug.

`dismissNews` de la 90 se mantiene (Novedades montaba tarde).

## [4.19.90] - 2026-09-12
### dismissNews espera al popup; botnav e2e hace poll

La 4.19.89 falló otra vez: Novedades montaba tarde y `dismissNews` (un `count()` a pelo)
lo dejaba abierto — interceptaba clics del panel de revisión. Ahora espera al botón y a que
`.wn-panel` se desmonte.

`rebote-barra-inferior`: el hide normal a veces llegaba un frame tarde en CI; `expect.poll`
en vez de un timeout fijo.

## [4.19.89] - 2026-09-12
### e2e revisar-beta: tandas:[] con prod, no sin ella

La 4.19.88 falló en CI: el e2e «todas las tandas aprobadas» llamaba
`betaChecklist("0.0.9")` **sin** prod. Tras el fix del panel (tip fontanería salta a la
más nueva con puntos), esa llamada devolvía tandas de otra versión y el expect(0) petaba.

El contrato «esta versión no pide revisión» se comprueba con prod
(`betaChecklist("0.0.9", "0.0.8")`). El salto del tip sin prod lo sigue cubriendo
`beta-tandas-vacias`.

## [4.19.88] - 2026-09-12
### season-detalle exige la geometría de la ola (no la del UX-01 que la mató)

La 4.19.87 falló en CI: `tests/season-detalle.test.mjs` seguía exigiendo
`top:safe-top+4` + `padding:6px` (UX-01) — justo lo que rompía la ola. El e2e
`ux01-layout-shift` ya vigila el **efecto** (leave/enter <2 px); el guardián CSS
pasa a exigir caja a pantalla (`inset:0` / `height:100%` + padding safe-top+10)
y deja escrito el porqué del cambio.

La 4.19.85 había fallado por `beta-tandas-vacias` (sin `tandas`); eso ya lo
tapó la 4.19.86. Él se quedó en 4.19.85.1 (docs) porque 85/87 no publicaron.

## [4.19.87] - 2026-09-12
### Ola nativa: caja a pantalla otra vez, sin el salto de 44 px

Bisección prod/beta (Claude + él): el rebote nativo iba en prod y fallaba en beta.
Causa: `37694684` (UX-01) cambió `.page.page-scroll-host` de `inset:0; height:100%` +
padding `safe-top+10` a `top:safe-top+4; height:auto` + padding `6px`. El scroller dejó
de ser caja a pantalla completa y Android dejó de pintar la ola.

Arreglo: se restaura la geometría de prod/Ajustes (`inset:0` + `height:100%`) con el
`safe-top` en el **padding** del host, no en `top`. El Y del contenido en reposo sigue
siendo `safe-top+10` (= `.app` + `.page`). `e2e/ux01-layout-shift` exige caja a
pantalla y leave/enter `<2 px` (2/2 en Chromium).

**Promote sigue bloqueado** hasta que él pruebe la ola en el móvil.

También en esta tanda (review de 4.19.86): el tip con 	andas:[] **sin** prodVersion ya no vacía el panel — se prefería .v===base aunque fuera fontanería. Test nuevo en eta-tandas-vacias.

## [4.19.86] - 2026-09-12
### Dos guardianes para que un renombre no vuelva a dejar a nadie sin actualizaciones

Hoy se renombró el repo a **Aely** y eso dejó incomunicados los móviles de su padre y su pareja.
El arreglo (el repo puente) lo hizo Cursor y ya está vivo; esto es lo que impide la repetición,
porque **ningún test de este repo podía cazarlo**.

**1 · `tests/ota-bases-espejo.test.mjs` — el JS y el Java no pueden divergir en silencio.**
La base del OTA vive en DOS sitios: `_mcOtaBASE` / `_mcBetaBASE` en `12-boot.js` y `BASE` /
`BASE_BETA` en `OtaCheckWorker.java`. Cambiar una y olvidar la otra es exactamente lo que pasó:
el código llevaba `/Aely/` desde 4.19.81 y **la APK instalada seguía con `/Mi-Cartera/`**, que ese
día empezó a dar 404. Y eso **no se arregla publicando**, porque lo que está roto es el canal por
el que llegaría el arreglo: se arregla instalando una APK, teléfono por teléfono.
Verificado en rojo simulando el olvido de hoy:

    ✗ la base de producción es la MISMA en el JS y en el Java
      12-boot.js dice https://juanjoavila.github.io/Aely/ y OtaCheckWorker.java dice
      https://juanjoavila.github.io/Mi-Cartera/. Cambiar una sola deja a quien ya tiene la APK
      hablando con un sitio muerto, y eso no se arregla por OTA.

El guardián comprueba además que las dos acaben en `/` y que el código nuevo no vuelva a apuntar
al nombre viejo: el puente es para los clientes YA instalados, no una base sobre la que construir.

**2 · `npm run salud` ahora comprueba que las URLs RESPONDAN, no solo que existan.** Antes solo
se miraba el número de versión, y por eso un `version.json` que anunciaba un `bundle.zip` en una
dirección muerta pasó desapercibido. Se añaden:

- el `url` del `version.json` de producción (sin eso, apagar el canal beta no descarga nada);
- el `url` del `apk.json` de producción (sin eso, nadie puede instalar la APK);
- **las cuatro puertas del puente** `/Mi-Cartera`: `version.json`, `bundle.zip`, `apk.json` y la
  release `beta` bajo el nombre viejo.

Esa última hace falta por una trampa que costó descubrir y que queda escrita en `docs/RELEASE.md`:
**tener un repo con el nombre viejo MATA el redirect automático de GitHub para ese nombre.** Al
crear el puente se arregló Pages y se rompieron las Releases — la URL de descarga de la APK de
producción y el `BASE_BETA` del worker nativo pasaron a 404. Mientras el puente exista, manda él
sobre ese nombre y tiene que servir TODO lo que servía antes.

En `docs/RELEASE.md` queda también **cómo se apaga el puente**, que es la única salida: promocionar,
APK nueva desde `main`, los dos `apk.json` apuntando a ella, que los tres móviles la instalen —los
de la familia se enteran POR el puente, que es el vehículo que entrega su propio reemplazo—,
comprobar que no queda ningún `versionCode ≤ 45` vivo, y **entonces** borrarlo.

**3 · Y la 4.19.85 se había quedado sin tanda.** Sin la propiedad `tandas`, una versión resucita
entera en su panel como «4.19.85/todo»: `beta-tandas-vacias` estaba **en rojo** en el tip de beta.
Se le escribe la tanda `volver-a-estable` con siete pasos numerados —que es justo lo que él tiene
que probar— avisando de que volver a estable le baja a la 4.18.25 y de que el mismo interruptor le
trae de vuelta.

**4 · Y al escribir eso salió un agujero de verdad en el panel.** Con `tandas:[]` en la versión
más nueva —que es lo correcto para una versión de fontanería como esta— el panel **se quedaba
vacío** mientras no supiera qué sirve producción: sin `prodVersion`, la ronda es UNA sola versión
y se cogía `RELEASE_NOTES[0]` a pelo. O sea que en el arranque, o sin red, le habría parecido que
no tenía nada pendiente de probar con media ronda sin juzgar detrás. Ahora se coge la más nueva
que SÍ tenga algo que probar. Lo cazó `revisar-beta` al ponerse en rojo, no una revisión a ojo.

## [4.19.85] - 2026-09-12
### El OTA ignora `v.url` del manifiesto y baja desde su base

Tras el renombre a Aely, `version.json` de producción seguía anunciando
`.../Mi-Cartera/bundle.zip` (404 en Pages: el rename no redirige esa ruta). Quien tenía la
base nueva no podía volver a estable: `_mcApplyChannelBundle` usaba `v.url` a ciegas.

Ahora la descarga usa siempre `mcUpdBase()+"bundle.zip"`. El manifiesto solo aporta la versión.
Puente legacy recreado en el repo `Mi-Cartera` (Pages) para los clientes con la base vieja cocida.

---

## [4.19.84] - 2026-09-12
### Cambiar el rol de una cuenta le movía el saldo 300 € — y era la pantalla, no el dinero

Reportado por él desde la app, y él mismo puso el aviso de que era gordo: *«Un error importante!!
Al probar de quitar una cuenta de gasto diario y ponerla como recibos por ejemplo… ya no cuenta
como gasto diario, lo puse en Trade Republic y funciona perfecto… **pero en la zona de cuentas se
me descontó el gasto… cuando realmente no tocaba… pasó de 6700 y algo a 6400 de golpe**… se
arregla sincronizando otra vez pero no debería pasar esto»*.

**Reproducido con sus cifras antes de tocar nada**, sobre `load-pure-logic` y un estado de mentira
(TR de gasto diario con un fijo de 300 € domiciliado ahí y el día ya pasado):

    pn(TR) con rol «gasto diario»  :        0     ← accFixed=false: ni entra en el mapa
    saldo PINTADO antes            :  6700,00
    pn(TR) con rol «recibos»       :  -300,00
    value re-anclado               :  6700       ← despejado con el pn VIEJO
    saldo PINTADO después          :  6400,00
    SALTO                          :  -300,00

**La causa.** `paidNetByBank` solo se rellena para cuentas `accFixed` (`11-app-main.js`, donde se
calcula `totals`). Una cuenta de **gasto diario** tiene por tanto `pn = 0`; en cuanto pasa a
**recibos**, su `pn` vale los fijos ya cobrados del mes. `applyAccountRole` re-anclaba `value` con
el `pn` del rol que la cuenta **dejaba**, y acto seguido se pintaba con el del rol que
**estrenaba**. La intención del código era la correcta —su comentario dice literalmente «al
cambiar el rol se RE-ANCLA `value` para que el saldo mostrado no cambie»—; lo que fallaba era con
qué número se despejaba.

Y por eso sincronizar lo curaba: `applyBankBalances` vuelve a anclar contra el saldo REAL del
banco, ya con el rol nuevo puesto.

**Alcance medido, no supuesto.** Rompían solo `diario → recibos` y `diario → todo`, que son las
dos transiciones donde `pn` salta de 0 a distinto de 0. `recibos ↔ todo` no se movían (las dos son
`accFixed`) y `recibos → diario` tampoco (el rol nuevo no mira `paidNet`). Es exactamente el
camino que él probó.

Ahora se despeja con el `paidNet` **de después**, calculado con la misma suma que hace `totals`
para que las dos digan lo mismo. ⚠ Esa suma cuenta doble si un banco tiene dos cuentas fijas: es
un defecto de fondo, no es lo que le pasó a él, y **se replica a propósito** en vez de arreglarlo
aquí — divergir sería otra vez la misma regla en dos sitios diciendo cosas distintas. Anotado al
backlog con el voto de Cursor.

### Y el botón que prometía lo que no hacía

Del mismo día: *«si actualizo saldo de un banco en la zona de bancos, de manera individual, por
ejemplo Trade Republic, no me dice nada que se ha actualizado correctamente»*. Al mirarlo salieron
**tres cosas distintas**, y solo una es de aquí:

1. El botón vive dentro de la ficha de UN banco y decía «Actualizar saldo», pero por dentro llama
   a `onBankSync()`, que sincroniza **todos**. Ahora dice **«Actualizar todos»**, que es la verdad.
   Sincronizar de uno en uno pediría cambiar `runBankSync` entero y no es lo que pidió.
2. **El «✓ al día» que él echaba en falta no se arregla aquí**: se calla a propósito mientras
   quede un banco con la conexión a medias (`bankIssuesOf` mete cualquier fila `pending`), y su
   CaixaBank se quedó así. O sea que es **el mismo bug** que le hizo rechazar
   `4.19.66/banco-pendiente-y-quitar`. Va en esa tanda, que lleva Cursor.
3. Trade Republic, además, **nunca pasa por `applyBankBalances`** (`saldoLoMandaPuenteNativo` sale
   antes: TR no está en Open Banking), así que nunca entra en `synced`. Confirmar TR por su nombre
   pide tocar el camino del puente nativo: tanda aparte, decidida con Cursor.

Tests: `tests/rol-cuenta-sin-salto.test.mjs`, 6 casos, registrado en el lanzador y **verificado en
rojo** quitando el arreglo (`actual: 6400, expected: 6700`, sus cifras). Se siembran **DOS bancos**
a propósito: TR con el recibo domiciliado y Sabadell sin ninguno. Con un solo banco, una
implementación que le restara a todo el mundo pasaría igual de bien.

## [4.19.83] - 2026-09-12
### Quitar un banco limpia también su aviso `pending` en Cartera

El rechazo de la 4.19.66: *«lo quité en la zona de bancos y desapareció guay, PEROOOO al ir a
cuentas la notificación de que está pendiente de conectar ahí seguía»*. Misma raíz que el toast
«✓ al día» silenciado (12/9): `issues.length > 0` mientras quede una fila `pending` en
`state.bankIssues`, y esa lista **solo se reescribía al sincronizar**.

`cloud.bankDisconnect` ya borraba la fila en la nube; faltaba limpiar `state.bankIssues` en el
mismo `set` del panel (`dropBankIssue` en `08-motor-bank.js`). Sin sync de por medio.

Test: `tests/quitar-banco-y-pendiente` (guardián + réplica) y `e2e/bancos-quitar-pending`.

---

## [4.19.82] - 2026-09-12
### El aviso de la última cuota se puede quitar, y el paso que él no podía pasar sale del panel

Tres cosas de la vuelta de la tarde, todas nacidas de lo que él reportó **desde la propia app**
(`errores.mjs --kind=feedback`, que desde hoy se mira en cada vuelta igual que `--kind=beta`).

**1 · «Cansa mucho verlo cada día».** Textual suyo: *«Lo de la "última cuota" del inicio está
chulo que te aparezca el aviso pero cansa mucho verlo cada día… estaría bien poder quitarlo»*.
La tarjeta se queda —le gusta— y estrena un **«Descartar»**, el mismo de la tarjeta del mes
cerrado. Tres decisiones detrás:

- **Se reutiliza `mr_later`**, la cadena que ya existía. Ni una clave nueva de i18n: el gzip
  está a 330 de 332 KB y cada texto nuevo cuesta. Además, dos botones que hacen lo mismo en la
  misma pantalla deben leerse igual.
- **Se descarta POR DEUDA** (`settings.partyDismissed`), no de golpe. Cada deuda llega a su
  última cuota UNA vez, así que descartarla es «ya lo he visto», no «no me lo cuentes nunca más».
  Si mañana termina otra, esa sí avisa.
- **Vive en `settings`**, no en `localStorage`: si no, el otro móvil se lo volvería a enseñar
  cada día, que es exactamente lo que pidió que dejara de pasar.

⚠ `debtLeft`/`debtActive` viven en `07-tab-patri-fijos.js`, reservado por Cursor en esta ronda:
no se ha tocado. El helper nuevo se queda en el dash.

**2 · Fuera el paso 5 de `categorias-que-empiezan`.** Lo rechazó **tres veces** con la misma nota
(*«lo clasifica en compras»*), y la palabra clave NO falla — medido aquí:

    autoCategory("Mangopay")       → otros     ✅
    autoCategory("Mango")          → compras   ✅ (no se rompió)

El paso le pide pulsar «✨ Sugerir categoría». Cuando las palabras clave dicen `otros`, ese botón
**le pregunta al modelo**, y el modelo lee «Mango» y contesta Compras. O sea: arreglamos el
substring y el fallo volvió por la otra puerta. Como el arreglo de esa puerta es del servidor y
**el servidor no se despliega hasta el promote**, hoy no puede pasar ese paso ni con todo bien
puesto: es el filtro 6 del panel. Vuelve cuando `categorize` esté desplegada.

**3 · La regla de pasarelas, escrita y sin desplegar.** En el prompt de `categorize`: una pasarela
de cobro (mangopay, stripe, paypal, redsys…) **no dice qué se compró, solo quién cobró**, así que
responde `otros`. Es la familia entera, no un parche de un comercio. ⚠ Sube a beta pero **no se
despliega**: `categorize` importa `_shared`, que ya lleva el split agua/luz/gas, y el cliente de
producción (4.18.25) no conoce esos ids.

Tests: `e2e/ultima-cuota-descartar.spec.mjs`, dos casos, **verificados en rojo** quitando el
cambio de `03-tab-dash.js` y reconstruyendo (2 failed), y en verde con él (2 passed). Se siembran
**DOS deudas** a propósito: con una sola, una implementación que escondiera la tarjeta entera
pasaría igual de bien.

## [4.19.81] - 2026-09-12
### El repo en GitHub pasa a llamarse Aely (URLs de OTA y Pages)

El dueño renombró el repositorio `JuanjoAvila/Mi-Cartera` → `JuanjoAvila/Aely`. GitHub
redirige las URLs de Releases, pero **GitHub Pages en la ruta vieja ya devolvía 404**:
`juanjoavila.github.io/Mi-Cartera/` → hay que apuntar a `.../Aely/`.

Se actualizan bases OTA (`12-boot.js`, `OtaCheckWorker`), `salud`, workflows de deploy/promote,
`apk.json` (host del asset; el fichero publicado sigue siendo `Mi-Cartera-4.19.40.apk` hasta la
próxima APK), `capacitor.appName`, textos y docs. **No** se toca `applicationId`
`com.micartera.app`, ni las claves `micartera_v3*` del almacenamiento, ni la firma
`CN=Mi Cartera` del keystore.

## [4.19.80] - 2026-09-12
### Agua, luz y gas: tres categorías donde había una, porque el recibo del agua llevaba un rayo

Suyo, viendo la 4.19.79 funcionando: *«ahora sí sale lo de Aigües de Barcelona luz gas y agua,
creo que eso se debería separar… porque sale un símbolo de rayito en Aigües de Barcelona que no
encaja para nada. Agua por un lado con su símbolo, luz por otro y gas por otro»*.

Tenía razón y era barato, pero **se midió antes de tocar**, que es lo que decidió el alcance:

- **2 filas** en `energia` en TODA la familia (`AIGUES DE BARCELONA` 81,29 € y `GC RE OCTOPUS
  ENERGY` 89,98 €). No hay histórico que repartir.
- **`categoryBudgets` vacío en los tres usuarios.** Ese era el riesgo gordo — un límite €/mes
  puesto a `energia` habría que haberlo dividido a mano — y no existe.

`energia` desaparece como id. Nacen `agua` 💧, `luz` 💡 y `gas` 🔥, cada una con su color.

**El orden de las listas es parte del arreglo**, no un detalle: `agua` va PRIMERA. Las
comercializadoras de luz venden también gas, y si `luz` fuese antes, un «AIGUES DE BARCELONA» con
la palabra «energia» en el concepto caería en luz. Con `agua` delante, lo específico gana.

**Las ambiguas van a `luz`, y es una decisión, no un descuido.** Naturgy, Endesa, Iberdrola y
TotalEnergies venden luz Y gas, y por el nombre del comercio no hay forma de saber cuál es. Van a
la factura más común y el override que él ponga a mano se lo aprende para siempre. Leer la `nota`
del banco —que SÍ lo dice: su recibo literal es «AGUA AIGUES DE BARCELONA SUBMINISTRAMENT D»— es
otra tanda: cambia la firma de `autoCategory` y hay que moverla en los dos lados del espejo a la
vez. Votado con Cursor (opción A ahora, la nota después).

### Lo que se aprendió haciéndolo

**El remapeo de lo viejo NO va en `migrate`, y casi lo puse ahí.** Al cargar, el estado pasa por
`(saved._dataVer>=6) ? saved : migrate(saved)`: **`migrate` no corre para los estados actuales**.
Va en `seedFlows`, que corre siempre. El test apuntaba a `migrate` y salía verde en rojo — o sea,
fallaba por la razón equivocada. Queda escrito dentro del test para que nadie lo «ordene».

Y `CAT` / `CATEGORIES` son `const`, así que **no viajan al sandbox de los tests**: un
`assert.ok(!ctx.CAT.energia)` no comprueba nada, revienta con `Cannot read properties of
undefined`. Esa comprobación se hace sobre el fichero, como ya hacía el test de la IA.

Los 12 casos de conducta y los 5 del remapeo se verificaron **en rojo** quitando el cambio entero.

### ⚠ Un fallo que salió al probar y que NO es de esta versión

`NATURGY IBERIA` → **Viajes**, por «iberia» la aerolínea, que va antes en el orden de categorías.
Comprobado contra el build ANTERIOR al split: **ya pasaba**. No es regresión y no hay ninguna fila
suya afectada, así que no se toca a ojo — queda anotado para decidirlo con dato.

## [4.19.79] - 2026-09-12
### Ámbar de la 4.19.78: no borrar possibleDupOf ni realinear id en el pull

Claude ejecutó `refreshExpenseFromCloud` contra el bundle: `expenseFromRow` declara
`possibleDup` siempre (aunque sea `undefined`) y **no** declara `possibleDupOf`. El
`put(possibleDupOf, undefined)` borraba el gemelo en cada sync. Y cambiar `id` al de la nube
huérfana `settings.expenseOrder` (aprobado esta mañana en 4.19.74).

Fix: solo escribir `possibleDupOf` si viene con valor; no tocar `id` (remap = tanda propia).
Guardián unitario + el de `pull-historico-entero` ahora exige `mergeExpensesFromCloud`.
Tope minificado 1195 KB (CI midió 1189).

## [4.19.78] - 2026-09-12
### El pull vuelve a refrescar filas que ya teníamos (ya no filtra por source=supabase)

Hallazgo Claude + captura suya: one-shot dejó Aigües en nube como `energia` y el móvil seguía
en `viajes` con «Ya estás al día». Causa: `syncCloudExpenses` hacía
`keep = filter(source!=="supabase")`, pero `expenseFromRow` convierte `"supabase"`→`"manual"`
y nunca emite `"supabase"` — keep se quedaba con TODO lo local y solo añadía claves nuevas.

`mergeExpensesFromCloud` / `refreshExpenseFromCloud`: actualizan cat/importe/nota/… por clave;
no pisan `cat` de manuales ni `note` editada; **nunca borran por ausencia** (4.18.6).

e2e `sync-pull-refresco` + unitario `merge-expenses-cloud`.

## [4.19.77] - 2026-09-12
### Long-press ordena cuentas (se elevan) y Editar solo con obAccounts

Él: *«el mantener pulsado los bancos no los mueve»* y *«que se eleve con un efecto chulo… smooth»*.
No era un bug: faltaba el gesto. Mismo patrón que las pestañas (HOLD 380 ms → vibra → arrastrar).
`moveAccountInList` reordena el array `accounts`. CSS propio en `.v4-card-list` (eleva; no el
dim de Gastos).

«Editar» solo si hay `obAccounts` (o el editor ya abierto). La ficha usa `pickRole` (no solo
`applyAccountRole`) para que un EXTRA de `expenseBanks` también salga al tocar Recibos.

e2e: `cartera-orden-cuentas` + tests que iban por edit-link pasan por la ficha.

## [4.19.76] — 2026-09-12
### El saldo del Efectivo se guarda al cerrar la ficha, y subir ya no repinta App

Rechazo `4.19.67/ficha-cuenta` paso 5: *«si solo pones un número… y lo quitas… no se guarda;
solo si le das a la flechita del teclado»*. `AccountSheet` solo volcaba en `onBlur`. Al cerrar
con el foco en el importe (backdrop / atrás / swipe) en su WebView el blur a menudo no llega.
`cerrar()` = `guardaSaldo()` + `onClose()`, con refs del saldo porque `useBackClose` /
`useSheetSwipe` capturan el `onClose` del primer render (`[open]` only).

Rechazo `4.19.69/botnav-sin-repintar`: al subir tras bajar, lag; al fondo la barra a medias con
la ola. `applyNavHide` ya aplazaba `setState` con dedo puesto; **`revealNav` no**. Misma
regla (`navFlush`). Y si `dy<0` pero `y > max-80`, no se revela (rubber-band del fondo).

e2e: `cartera-ficha-cuenta` (caso nuevo) + `botnav-esconder` 7/7.

## [4.19.75] - 2026-09-12
### Su rechazo de las 08:57 no era del código, y buscando por qué salieron cuatro trampas más

Rechazó `barcelona-no-es-un-viaje` con *«Aigües de Barcelona precisamente sale como si fuera
viaje»*. **El arreglo funcionaba**: pasado por el `autoCategory` real (no por una copia),
`AIGUES DE BARCELONA` → `energia`, con acentos, con `RECIBO` delante y con `, S.A.` detrás.

Lo que veía era una fila **sellada** de antes: la categoría se escribe cuando el movimiento entra y
luego no se toca, a propósito, para no mover totales de meses cerrados. **El paso 2 de la tanda le
pedía justamente mirar lo que ya estaba** — o sea, un paso que no podía pasar ni con el arreglo
puesto. El fallo era de la tanda, no suyo ni del código.

Cuántas filas hay de verdad, medido y no estimado: comparando el `public/index.html` de `183dabef^`
(sin `KW_PALABRA`) contra el de hoy, fila a fila sobre sus datos reales, y contando solo aquellas
cuya `cat` guardada es **exactamente** lo que daba la regla vieja → **4 de 670**. Se corrigen esas
cuatro con un script de una vez (`scripts/recat-una-vez.mjs`), fuera del bundle, con ensayo previo.

### Y de ahí, lo que de verdad importa: cuatro trampas más, todas medidas

Barriendo sus **237 comercios distintos** contra las listas del propio `00-core.js`, 17 términos de
≥4 letras casan dentro de otra palabra. **Doce aciertan igual** (`hamburgues` en HAMBURGUESERIA,
`pizza` en TELEPIZZA, `sancion` en SANCIONS, `burger` en KIWIBURGER) y no se tocan. Los otros:

| comercio real suyo | término | caía en | ahora |
|---|---|---|---|
| `Transporte publico` | `sport` ⊂ tran**SPORT**e | ocio | **transporte** |
| `BRESSOLGRAMENET S.A.` | `ramen` ⊂ bressolg**RAMEN**et | bares | otros |
| `APOLLON GALLERY` | `pollo` ⊂ a**POLLO**n | bares | otros |
| `Mangopay (vinted)` | `mango` ⊂ **MANGO**pay | compras | otros |

Nace **`KW_INICIO`**, hermana de `KW_PALABRA` pero no la misma, y la diferencia es lo que la hace
funcionar: `KW_PALABRA` son **prefijos** de una palabra más larga (BARCELOna) y necesitan límite por
los dos lados; `KW_INICIO` son **sufijos o infijos** (aPOLLOn) y les basta con límite por delante.
Pedirles los dos lados dejaría de reconocer los plurales: «POLLOS ASADOS» ya no sería un bar.

Tres cosas que salieron de hacerlo, y las tres son de método:

1. **`mango` parecía de esta familia y no lo era.** MANGOpay *empieza* por mango, así que exigirle
   límite por delante no cambia nada: es un prefijo, o sea `KW_PALABRA`. **Lo cazó el test**, con
   la lista ya escrita y yo convencido de lo contrario.
2. **En la lista de Transporte no existía la palabra «transporte».** Al quitar `sport`, «Transporte
   público» pasó de «Ocio» a «Otros» — mejor, pero seguía sin categoría. Se añade `transport`.
3. **Probada y descartada** la regla general «límite por delante para todo término de ≥4 letras»:
   rompe KIWIBURGER y TELEPIZZA, que hoy aciertan de rebote. Medido antes de descartarla.

El test se comprobó **en rojo** revirtiendo el cambio entero —no a medias— y verificando los cinco
casos de conducta uno a uno contra el build revertido. Los siete guardianes de no-regresión pasan en
ambos lados, que es su trabajo. `categorias-dual` sigue verde: app y servidor dicen lo mismo.

⚠ **El servidor sigue con las reglas viejas.** `ingest` se desplegó el 11/9 a las 11:16 y los
arreglos del categorizador son de las 23:08 en adelante. La vía de Open Banking clasifica en el
cliente (le llega por OTA), pero **la de notificaciones va por servidor**. Desplegar toca
producción: requiere su OK.

### Panel de beta: cinco tandas fuera

Petición suya de esta mañana: *«que no sean repetitivas y que no me bloqueen, que realmente pueda
probarlas»*. Se van las dos **aprobadas** que seguían ahí (`dia-partido-en-dos` de hoy y
`cabecera-bancos`, del 6/9) y las tres **rechazadas**: `barcelona` vuelve como los pasos 1-3 de esta
tanda, y `botnav-sin-repintar` y `ficha-cuenta` volverán dentro de la tanda que las arregle —
dejarlas es garantizar que vuelva a rechazar lo mismo. De 24 a 20.

## [4.19.74] - 2026-09-12
### La otra mitad del día partido: arrastrar un gasto de madrugada no hacía nada

Cursor lo señaló al revisar la 4.19.72 y lo marcó como «otra tanda». Lo es, y aquí está.

Al arreglar las cabeceras, el agrupado pasó a hora local pero **el orden a mano se quedó en UTC**:
`sortExpensesForDisplay` y `moveExpenseWithinDay` partían el día con `String(e.date).slice(0,10)`,
el prefijo ISO del texto guardado. Consecuencia para él:

- Un gasto de madrugada se VE bajo su día local, pero su clave de orden es la del día anterior.
- `moveExpenseWithinDay` compara el día del que arrastras con el del destino, no coinciden, y
  **devuelve el estado sin tocar**. O sea: coges el gasto por el asa, lo sueltas donde quieras, y
  **no pasa absolutamente nada**. Sin aviso, sin error, sin nada.

`dayKey` se muda a `00-core.js` y nace `diaDeGasto(e)`. **Las dos pantallas preguntan a la misma
función**, que es lo que evita que vuelvan a divergir — es literalmente el patrón que ya costó caro
([[misma-regla-en-dos-sitios]]). Vive en core y no en i18n porque no es traducción: es la regla de
qué día es cada cosa.

⚠ **Lo que cuesta, dicho antes y no después:** el orden a mano se guarda en
`settings.expenseOrder` indexado por esa clave. Los días que él ya hubiera ordenado a mano **y**
tuvieran algo de madrugada pierden ese orden y vuelven a salir por hora. Es una vez, y a cambio se
puede reordenar — que hasta ahora no se podía.

## [4.19.73] - 2026-09-12
### El mismo patrón, pero al revés: la palabra con espacio detrás falla al final del nombre

Después de arreglar las marcas que se pasaban de largo (`barcelo`, `saba`…), la pregunta obvia es
la contraria: **qué se está quedando sin reconocer**. Se contó, no se supuso: de sus 642 movimientos
de los últimos 90 días, **122 comercios distintos caen en «Otros»**. Los dos únicos que son un
fallo de verdad y no un nombre de persona o un «Movimiento» de Trade Republic:

| comercio suyo | caía en | por qué |
|---|---|---|
| `Dia` (2×) | Otros | la clave era **`"dia "`**, con espacio detrás |
| `FCIA COLLADO PALLARES` | Otros | «FCIA» es como el banco abrevia farmacia |

El espacio detrás se puso para que «dia» no se comiera «diarias» ni «mediodía» — y para eso
funciona. Pero **falla justo cuando el comercio ACABA en la palabra**, que es como llega el súper
Dia. Es el mismo fallo que ya tuvo `bar` el 6/8: `"bar "` dejaba fuera «1331 BAR» y «SNACK BAR», y
se arregló quitándole el espacio para que entrara por el camino de límite de palabra.

- `"dia "` → `"dia"`: al bajar de 4 letras entra por `hit()` con límite de palabra, así que
  reconoce `Dia` y `DIA` **sin** comerse `Compras diarias` ni `mediodia`. Los tres, en el guardián.
- `"fcia"` a salud, junto a «farmacia».

El resto de esos 122 son nombres de personas (bizums y transferencias), los «Movimiento» que manda
Trade Republic sin comercio, y traspasos internos tipo «To Cuenta Remunerada» o «Exchanged to EUR».
**Los traspasos NO se tocan**: `traspaso` es una categoría neutra y adivinarla por comercio movería
totales suyos ya cerrados — es el blindaje que existe desde `fixMovInvasion`. Si algún día se hace,
va con su OK y con su propia tanda.

## [4.19.72] - 2026-09-12
### El mismo día salía dos veces de cabecera, y lo vi en una captura suya

Él no lo reportó: estaba en una captura que mandó por otra cosa. En Gastos salía **«DOMINGO, 6
SEPT»** y justo debajo, otra vez, **«DOMINGO, 6 SEPT»**.

`dayKey` agrupaba en **UTC** (`toISOString().slice(0,10)`) mientras la etiqueta de la cabecera sale
de `toLocaleDateString`, o sea la hora del móvil. En España cualquier gasto entre las 00:00 y las
02:00 cae en el día UTC anterior, así que se abre un grupo con la clave del 5 etiquetado «6 sept» y
otro con la clave del 6 etiquetado igual.

Medido en `Europe/Madrid` antes de tocar nada:

| hora local | clave | etiqueta |
|---|---|---|
| 06/09 01:00 | `2026-09-05` | domingo, 6 sept ← **parte el día** |
| 06/09 12:00 | `2026-09-06` | domingo, 6 sept |
| 07/09 00:30 | `2026-09-06` | lunes, 7 sept ← **se cuela en el día anterior** |

Y no era solo cosmético: **«Hoy» y «Ayer» salen de comparar esa misma clave**, así que entre
medianoche y las dos de la mañana lo de hoy se etiquetaba como ayer.

Es el mismo fallo que ya se arregló para el mes (`inicioDeMesMs`, B09-B, 7/9): la app vive en la
hora del móvil, no en UTC.

**Y el test se escribió mal la primera vez.** Puse una copia local de `dayKey` «por si no está
expuesta en el sandbox», y al volver a meter el fallo a mano **los cuatro casos de conducta
siguieron en verde**: estaban probando mi copia, no la app. Solo cantó el guardián de fuente. Ahora
lee la línea real del módulo y la evalúa: con el fallo puesto se ponen en rojo **16 aserciones**.
Es la misma lección de esta misma noche con el filtro de bancos — un test que no puede fallar no
vale, y hay que comprobarlo rompiéndolo.

El fichero se relanza solo con `TZ=Europe/Madrid`: en una máquina en UTC este bug es **invisible** y
el test se quedaría verde mintiendo.

## [4.19.71] - 2026-09-11
### El aplazamiento de la 4.19.69 tenía un agujero, y era peor que no aplazar nada

En la 4.19.69 aplacé el `setState` de la barra hasta soltar el dedo, para no repintar App a mitad
de gesto. Lo volcaba **solo en `onEnd`**. Cursor lo cazó leyendo el código, con el dato que lo
cierra y que está escrito en este mismo repo:

> **en su móvil 174 de 185 gestos acaban en `touchcancel`**, no en `touchend`.

O sea que en su mano el volcado **casi nunca habría corrido**. Y lo que quedaba no era «no se
aplica»: era el DOM con `.botnav-hidden` puesta, las refs en `true` y React creyendo que la barra
está a la vista — así que **el siguiente re-render le quitaba la clase y la barra reaparecía sola**.
Peor que no haber aplazado nada.

- El bloque sale a `flushNavHide()` y se llama desde **los tres** caminos por los que se suelta el
  dedo: `onEnd`, `onCancel` (antes de su early-return del perfil) y `cancelSwipe`.

**Y por qué los e2e no lo veían, que es lo que importa:** un gesto sintético de Playwright siempre
termina limpio. Los cinco casos de `botnav-esconder` pasaban con el agujero puesto. Se añaden dos:
uno que manda `touchCancel` a propósito, y un **guardián de fuente** que exige que `flushNavHide()`
se llame desde las tres funciones. Esto último no es pereza: es que el caso de verdad **no se puede
montar** con un gesto sintético, y un test que no puede fallar no vale.

De paso, algo que medí y no esperaba: al cancelar un gesto la app **revela la barra a propósito**
(`endTopClearNow(true)`). Queda escrito en el test para que nadie lo «arregle» creyendo que es
este bug.

## [4.19.70] - 2026-09-11
### Tres ciudades más que se comían la categoría, y una es su banco

Al mandar la 4.19.68 a review le pedí a Cursor que buscara **más casos de la misma forma** —una
marca de 4+ letras que además es el principio de un topónimo— pero con la condición de traerlos
**medidos**, no sonados. Trajo tres, y la primera duele:

| clave | casa dentro de | lo que decía |
|---|---|---|
| `saba` (parking) | **SABADELL** | `Transferencia a banco Sabadell` → **Parking** |
| `zara` (compras) | **ZARAGOZA** | `Tienda Zaragoza` → Compras |
| `hospital` (salud) | **HOSPITALET** | `Hospitalet de Llobregat` → Salud |

La de `saba` es la peor de esta casa: SABA es una cadena de aparcamientos **y** Sabadell es el
banco de su familia. Cualquier movimiento con «Sabadell» en el nombre que no pillara antes otra
regla acababa en Parking.

Las tres a `KW_PALABRA`, con su espejo en `ingest_logic.ts`. El guardián comprueba **las dos
mitades de cada una**, que es lo que evita que el arreglo rompa lo que la palabra defendía: un
aparcamiento SABA de verdad sigue siendo Parking, Zara sigue siendo Compras y un hospital, Salud.

Las que sonaban pero **nadie pudo medir** (`cima`, `action`, `melia`, `sorea`, `tous`) se quedan
fuera a propósito: meter palabras a esa lista sin un comercio real detrás es adivinar, y cada
entrada estrecha lo que la clave detecta.

⚠ **Una pasada de la suite salió en rojo sin que capturara la salida**, y las dos siguientes en
verde. Lo dejé escrito aquí en vez de tacharlo de flaky, y esa misma noche, unas horas después,
**apareció otra vez y esta vez con el log**:

    net::ERR_NO_BUFFER_SPACE at http://127.0.0.1:4184/

No era `rendimiento-tabs` ni ningún test: es **Windows quedándose sin sockets** después de decenas
de pasadas de la suite seguidas. Cada pasada levanta un servidor y abre cientos de conexiones. La
siguiente pasada, sin tocar nada, salió en verde con 233 tests.

**La lección que queda es la que ya estaba escrita, y funcionó:** capturar la salida SIEMPRE. Sin
ella habría acabado culpando al guardián de rendimiento, que no tenía nada que ver — y «arreglando»
un margen que estaba bien.

## [4.19.69] - 2026-09-11
### El arreglo de la barra apretaba justo el guardián de SU rechazo

Él aprobó la 4.19.62 esa misma noche («6 ok / 0 fallos»), pero al pasar la suite entera en
paralelo saltó `rendimiento-tabs`: *«scroll→swipe bloqueó el hilo 85 ms»* contra un tope de 80. En
aislado pasaba 3 de 3 — o sea, margen justo, no fallo limpio.

**Y el margen era mío.** Ese guardián existe por su rechazo 4.12.0.17: *«si te mueves en
Deudas/Metas y deslizas acto seguido, se laguea»*. La protección de entonces era que
`onPageScroll` se iba de vacío con **cualquier** dedo puesto. Al acotarla al gesto de pestaña —lo
que hacía falta para que la barra se escondiera bajando despacio— volvieron a pasar `setNavHidden`
a mitad de gesto, y cada uno **repinta App entera**.

Lo que esconde la barra es la clase CSS, no el `setState`: el `setState` solo pone a React de
acuerdo con el DOM. Así que con el dedo puesto se aplica la clase y **el estado se aplaza hasta que
levanta el dedo** (`onEnd`). Visualmente idéntico, y el hilo principal se queda libre durante el
gesto, que es de lo que iba su rechazo.

Comprobado: `botnav-esconder` 5/5, `rebote-barra-inferior` 2/2, `rendimiento-tabs` 3/3, y **la
suite entera en verde dos veces seguidas** — que es lo que hacía falta, porque el fallo solo salía
con la máquina cargada.

## [4.19.68] - 2026-09-11
### «barcelo» se comía Barcelona entera, y él vive ahí

Salió mirando sus gastos reales de septiembre con `scripts/diag-mes.mjs`, no de una revisión de
código. Tres filas suyas, medidas:

| comercio | categoría que le ponía | la que toca |
|---|---|---|
| `AIGUES DE BARCELONA` | Viajes | Luz, gas y agua |
| `SQ *PASTABAR BARCELONA S.` | Viajes | — |
| `Taxi Barcelona` | Viajes | Transporte |

La palabra clave **`barcelo`** está en `viajes` por la cadena de hoteles Barceló, y el emparejador
va por substring en cuanto una palabra tiene 4 letras o más: **casaba dentro de BARCELONA**. Como
él vive en Barcelona, le afectaba a cualquier comercio que llevara la ciudad en el nombre y que no
hubiera pillado antes una regla anterior. `Mercadona Barcelona` se salvaba solo porque `super` va
antes que `viajes` en el orden.

El mecanismo de límite de palabra ya existía —es el que impide que «bar» case dentro de
«Barcelona» desde el bug de Kinepolis del 17/7— pero **solo se aplicaba a términos de menos de 4
letras**. Ahora hay una lista explícita, `KW_PALABRA`, para las marcas que además son el principio
de una palabra corriente. De momento tiene una sola entrada, y añadir la siguiente es una línea.

- Espejo exacto en `supabase/functions/_shared/ingest_logic.ts`: el servidor clasifica las altas
  que entran por notificación y el cliente las demás. `categorias-dual` exige que digan lo mismo.
- **Lo ya apuntado NO se recategoriza**, a propósito: `migrate` re-categoriza lo que está en
  «otros» en cada carga, y tocar categorías viejas movería totales de meses que él ya dio por
  cerrados. El arreglo es para lo que entre a partir de ahora.
- `SQ *PASTABAR BARCELONA` pasa a **«otros»**, no a «bares»: «bar» pide límite de palabra y
  `PASTABAR` no lo tiene. No era un bar por mérito propio — caía en viajes de rebote. «Otros» al
  menos no miente, y meter «pastabar» en la lista sería hacerle un traje a un comercio.

El guardián comprueba **las dos mitades**: que la ciudad deja de robar y que la CADENA de hoteles
sigue casando. Un arreglo que rompa lo segundo no es un arreglo.

## [4.19.67] - 2026-09-11
### Cada cuenta tiene su ficha, en vez de abrirse las cinco a la vez

Suyo: *«hazme un diseño más bonito para editar los bancos en la zona de cartera, porque es muy
cutrón que se despliegue abajo para editar y es bastante feo. Piensa algo chulo»*. Y tras ver la
maqueta: *«me gusta que se pudiera apretar en un banco y se despliegue una ficha como si apuntara
un gasto, es limpio y está chulo»*.

Pulsar «Editar» abría en canal las CINCO cuentas, cada una con casilla de nombre, casilla de
saldo, tres chips de rol y papelera, más dos pistas al final. Ahora se toca la cuenta y sube su
ficha — **la misma hoja de abajo que usa a diario para apuntar un gasto** (`useSheetSwipe`), así
que se cierra tirando y no hay nada nuevo que aprender. Sin botón de «Guardar»: se guarda al vuelo.

Lo que decidió él, punto por punto:

- **Nada de cartilla única.** La primera maqueta metía las cuentas en un solo bloque: *«no me gusta
  que esté todo en una misma cartilla verde, separado como está me gusta ya»*. Cada cuenta sigue
  siendo su tarjeta — y además es lo que hará posible el long-press para ordenarlas.
- **Fuera la flecha**: *«pero sin la flecha esa que sale al lado del dinero que tienes»*. Si toda
  la tarjeta responde al toque, el chevron solo mete ruido justo donde va a leer el importe.
- **El saldo dice quién manda.** En una cuenta conectada lo pone el banco: sale con candado y no se
  teclea, porque editarlo ahí sería mentirse. En una suya, casilla.
- **El rol deja de ser un acertijo.** Eran tres chips sueltos con la explicación en letra pequeña
  al final de la tarjeta. Ahora cada opción lleva SU frase debajo.

⚠ **«Editar» sigue en la lista y no es un resto**: es la única puerta a las cuentas EXTRA de Open
Banking, que aún no son cuentas con rol y se promocionan desde ahí. La ficha cubre las cuentas de
verdad; aquello, lo que todavía no lo es.

**La fórmula inversa del saldo NO se ha duplicado.** Vivía dentro de `accEd.toStored`; se ha
sacado a `valorDesdeTecleado` y la usan las dos pantallas. Escribirla dos veces es exactamente el
fallo que el 11/9 le pintó a su padre 455,50 € donde el banco decía 26,46 — la misma regla vivía en
seis sitios y solo se migraron cinco ([[misma-regla-en-dos-sitios]]).

**Y tres e2e que contaban de más.** Las filas de cuenta pasaron de `div` a `button`, y tres tests
que contaban `button.v4-mov` **de toda la página** empezaron a medirlas: inversiones pedía 3 y veía
4, el buscador de Gastos pedía 1 y veía 2, y el de deslizar entre pestañas pedía 2 y veía 3. Los
tres acotados a su contenedor. Es [[e2e-getbytext-pestanas-premontadas]] por tercera vez, y en el
de deslizar duele el doble: el premontaje de las vecinas es justo lo que ese fichero prueba.

## [4.19.66] - 2026-09-11
### Me equivoqué al elegir por él: la cuenta del banco quitado SÍ se va

En la 4.19.63 arreglé que la cuenta de un banco quitado se quedase en Cartera con la chapita «del
banco»… dejándola igualmente ahí, solo que sin la chapita. Lo razoné como prudencia: no borrar
nada automáticamente. Se lo enseñé y la respuesta fue **«si quito un banco, se va fuera, y ya con
las decisiones lógicamente que me dejaste»**.

Tiene razón, y la prudencia estaba mal colocada: **lo que no se puede perder son sus MOVIMIENTOS**,
no una cuenta cuyo banco él acaba de desconectar. Los movimientos siguen enteros en `expenses` con
su banco, así que reconectar lo deja como estaba, y qué hacen con el presupuesto es justo lo que se
le pregunta al quitarlo (contar / dejar de contar).

- La cuenta sale de `state.accounts`; sus cuentas extra de Open Banking ya salían.
- El aviso lo dice: «su cuenta sale de Cartera. Sus movimientos se quedan todos en Gastos».
- El guardián cambia de lado y pasa a exigir lo contrario que ayer, con su frase escrita para que
  el siguiente no lo «arregle» de vuelta. Y sigue exigiendo que los movimientos no se toquen.

### Y tres tandas que aparqué sin motivo, de vuelta al panel

Las quité del panel de beta porque `npm run servidor` decía «13 de 13 funciones con el repo por
delante» y las tres (efectivo, widget/posible repetido, apuntes manuales) dependen de `ingest`.

Al desplegar `ingest` de verdad, Supabase contestó **«No change found in Function: ingest»**: ya
estaba al día. Ese script compara **fechas de commit**, no contenido — y `_shared/` lo tocan
commits que no cambian lo que `ingest` compila. Así que las tres se podían probar desde el
principio y se las quité para nada.

Lección, y va a memoria: **una fecha no es una comprobación**.

## [4.19.65] - 2026-09-11
### Lo que se VE y lo que CUENTA son dos decisiones distintas

Suyo, 11/9, y tenía toda la razón: *«lo de gasto diario es para que cuente cuando gaste desde ese
banco a mi límite que ponga, pero ya te dije que TODAS las cuentas deben salir en el apartado de
gastos aunque no esté marcado gasto diario. Es importante»*.

El filtro de Gastos arrancaba marcado con `expenseBankEnts(state)` — o sea, **exactamente los
bancos que suman al presupuesto**. Así que los movimientos de sus cuentas de recibos (Sabadell,
CaixaBank) no aparecían en la lista, como si no existieran, y solo se veían si él caía en tocar su
chip. Un movimiento que no cuenta **sigue siendo un movimiento suyo**.

- El filtro arranca VACÍO = todos. Los chips ya listaban todas las cuentas; lo que estaba mal era
  la selección de partida.
- Lo que cuenta no se toca: el total del mes, lo que queda y las barras por categoría siguen
  saliendo de `expenseBanks`. Comprobado en el propio test, que ahora mide **las dos cosas a la
  vez**: las cuatro filas salen y el total sigue siendo 20 €, no 100 €.
- Y la app ya sabía explicarlo: esas filas salen apagadas con «no es del día a día» al lado, que es
  un motivo distinto del «no es un gasto» de una inversión.

La segunda vuelta de lo mismo, por cierto: el 17/8 ya se amplió de «solo el banco principal» a
«todos los de gasto diario». Faltaba el último paso.

### Y «Tus cuentas» vuelve a caber en una línea

*«Me falta lo de sincronizar y añadir cuenta, quizás con iconos distintivos pequeños, y así "tus
cuentas" cabe entero y no en dos líneas»*. Eran dos píldoras de texto («Conectar cuentas» y
«↻ Sincronizar bancos») y entre las tres cosas el título se partía.

- Dos botones de icono de 31 px: flechas en círculo para sincronizar (giran mientras trabaja, y se
  quedan quietas con «reducir movimiento» puesto) y un banco con `+` para conectar.
- Llevan `title` y `aria-label`, así que no se pierde el nombre de la acción.
- Cabecera medida: **31 px de alto y el título entero en una línea**.

## [4.19.64] - 2026-09-11
### El efectivo estrena billete

Suyo, 11/9: *«el efectivo, ponerle un logo de un billete o yo que sé algo que se te ocurra, porque
lo del euro con la cartilla marrón bastante cutre, algo como lo que hiciste para el oro que molo
muchísimo»*.

El efectivo no es un banco, así que **no hay PNG oficial que recortar** y aquí sí toca dibujar —
igual que el lingote del oro y por el mismo motivo: no hay logotipo de marca que copiar, es
iconografía. Se respeta el criterio que allí funcionó: geometría plana, dos degradados y nada de
detalle fino, que a 38 px es lo único que se lee. Un billete verde con su moneda dorada delante,
que a ese tamaño se distingue de un vistazo de cualquier logo de banco.

- `public/logos/efectivo.svg`, fuera del bundle (el gzip sigue al límite) y en el precache del SW.
- `Mono` aprende a pintar iconos DIBUJADOS además de los PNG recortados (`ENTS_DIBUJADAS`). Van a
  **0,66** del cuadro, como los de Inversiones: un PNG recortado ya trae su propio aire y un SVG
  dibujado no, así que a tamaño completo se veía gigante. Ese 0,66 está medido, no puesto a ojo
  ([[logos-bancos-recortar-no-dibujar]]).
- Comprobado renderizado a 38, 44 y 120 px antes de enseñárselo, que es la otra lección de aquella
  saga: cuatro rondas de logos rechazadas por no mirarlos primero.

## [4.19.63] - 2026-09-11
### Los tres sustos de CaixaBank

Los contó él de una tirada, y salen todos del mismo sitio: un enlace a medio autorizar es
**invisible** para todo el circuito, y quitar un banco solo limpiaba la mitad del estado.

**1. «al sincronizar no sale ni un aviso ni nada, he tenido que venir aquí para ver qué pasaba».**
Y tenía razón hasta en el detalle. `bank-sync` consulta los enlaces con
`.in("status", ["active","expired","error"])`: un banco que se quedó en **`pending`** ni siquiera
entra en esa consulta, así que no sale en la respuesta, no llega a `bankIssuesOf`, y no hay nada
que avisar. Su CaixaBank llevaba así desde el 10/9 sin que ninguna pantalla lo dijera.

- Arreglado **en el cliente**, a propósito: `bankIssuesOf` acepta ahora también las filas crudas de
  `bank_links` (que el cliente ya sabe leer con RLS) y saca de ahí los `pending`. Así le llega por
  OTA sin esperar a desplegar el servidor, que va por detrás.
- Y arreglado **también en el servidor** para cuando toque desplegar: `pending` entra en la
  consulta y viaja en la respuesta.
- Aviso propio, que ni es «permiso caducado» —nunca llegó a haberlo— ni «enlazado sin cuentas»:
  `bk_issue_pending` en los tres idiomas, con su recuadro en Cartera y su botón para terminarlo.

**2. «decidí quitar la caixa… estado pendiente y no se quitó».** Un enlace `pending` tampoco salía
de la lista al desconectar, por lo mismo de arriba: el sync no lo veía.

**3. Y el que más le chocó: «se me ocurre ir a cartera para ver si ya no estaba el banco quitado y
adivina, estaba».** Quitar un banco purgaba `obAccounts` y nada más. Una cuenta **promocionada**
—la que se creó para poder darle un rol, `promoteObAccount`— vive en `state.accounts` con su
`bankIban`, así que se quedaba en Cartera → Tus cuentas con la chapita «del banco» y el saldo
congelado del último sync.

- Ahora se le quita el `bankIban`, que es lo que la marcaba como sincronizada. **La cuenta NO se
  borra**: por borrados automáticos ya perdió movimientos una vez ([[tr-duplicados-saga]]). Se
  queda como una cuenta suya, con su saldo, y él decide si la borra.
- Y se le dice en el aviso, que si no es magia negra: «su cuenta se queda en Cartera con el último
  saldo, ya no la actualiza el banco».

Guardián nuevo `tests/quitar-banco-y-pendiente.test.mjs`, con **dos bancos** sembrados (con uno
solo, el filtro pasa igual de bien estando roto) y un caso que exige que los movimientos y la
cuenta sobrevivan. Incluye un guardián de fuente para que el test no acabe probando mi réplica de
la pantalla en vez de la pantalla.

## [4.19.62] - 2026-09-11
### La barra de abajo se escondía con manotazo, nunca con el dedo puesto

Suyo, 11/9: *«el esconderse la barra de abajo ya no lo hace apenas nunca»*. Y lo peor: la suite
estaba VERDE, con un test dedicado a la barra desde agosto.

**Medido antes de tocar nada** (sonda Playwright + CDP táctil, Inicio, `max = 460`):

| | |
|---|---|
| Arrastre con el dedo, 369 px | la barra NO se mueve |
| `scrollTop = 200` por JS | escondida **al instante** |
| `scrollend` durante el gesto | **0** |
| `touchmove` con `preventDefault` | **0 de 19** |
| Deltas entre eventos `scroll` | `[8,8,8,…]` (pasan el filtro de 6 px) |

O sea: la máquina de esconder estaba bien; lo que no llegaba era el aviso del dedo.

**Causa.** `onPageScroll` abría con `if(dragging.current) return;`. Se puso para el rechazo
4.12.0.17 («si te mueves en Deudas/Metas y deslizas acto seguido, se laguea»), pero `dragging` se
pone en el `touchstart` de **cualquier** gesto, no solo el de cambiar de pestaña. Con el dedo
puesto se tiraban TODOS los eventos de scroll, así que la barra solo podía esconderse con el
momentum de después de soltar: **con manotazo sí, con scroll lento nunca.** Es otra vez la lección
de medir el gesto LENTO y no solo el rápido.

- El corte se acota a `gestureMode.current === "tab"`, que es lo que aquel rechazo pedía.
- Y de paso, lo que pidió encima: *«la barra ocúltala antes, en cuanto baje, sin quitarme la
  animación suave»*. Se puede tener todo: la suavidad la pone la transición CSS de `.botnav`, no
  el retraso. El escondido a media pantalla pasa a ser **inmediato** (antes: armar y esperar
  550 ms) y basta con haber bajado 24 px (antes 56). La espera **se queda** para el caso de abajo
  del todo, que es donde la ola nativa y la barra se peleaban por el mismo trozo de pantalla.
- El `pinNavVisible` del primer scroll tras cambiar de pestaña baja de 1000 a 320 ms: se comía el
  primer gesto entero.

**Por qué ningún test lo vio, que es lo que más importa.** `e2e/rebote-barra-inferior.spec.mjs`
mueve el scroll con `live.scrollTop = st` — justo el camino que nunca se rompió. Un test que
simula el scroll por JS aquí no vale: se queda verde con el fallo puesto. El nuevo
`e2e/botnav-esconder.spec.mjs` baja con `Input.dispatchTouchEvent` y **despacio**, que es como se
rompía. Comprobado poniendo el fallo a mano: **3 de sus 4 casos se ponen rojos**.

## [4.19.61] - 2026-09-11
### TSMC y Micron con logo, y los brókers recuperan el suyo

Dos cosas que venían del mismo sitio: yo apagando iconos de más y dando por imposible lo que no
había buscado bien.

**1. «No hay logo oficial» era mentira.** En la 4.19.60 escribí que TSM, MU, el oro y los fondos
se quedaban con sus letras porque no existía trazo oficial. Me lo cazó enseñando su Revolut, donde
salen los dos. No estaban en simple-icons, que no es lo mismo que no existir: estaban en
`@iconify-json/logos` (CC0), a la primera búsqueda.

- Segunda fuente en `scripts/logos-inversiones.mjs` para **tsmc** y **micron**.
- **Categorías dibujadas** (aquí sí es legítimo: no hay marca que copiar): `oro` (lingote),
  `etf-mundo` (globo), `fondo-indice` (barras que suben). Petición suya.
- **El fallback pasa a ser las iniciales DEL ACTIVO**, no la insignia del bróker. Antes TSM, MU,
  el oro y los dos fondos salían todos como «Rv», «TR» o «MI»: cinco filas distintas con el mismo
  icono. Un ticker de una sola palabra se enseña entero (`TSM`, `MU`), no su primera letra.

**2. Los brókers volvían a salir con letras.** Suyo, literal: *«no puede ser que salgan bien los
logos de las cuentas bancarias, que salgan los de las empresas en inversiones, pero no los bancos
donde están las inversiones»*. Culpa mía y de un arreglo mal calibrado: al meter los logos de
banco se colaron en las filas de EMPRESAS, y al apagarlos puse `logo:false` en los **cinco**
sitios — incluidos los tres que agrupan POR BRÓKER, que sí son bancos.

- Fuera `logo:false` de la tarjeta del bróker y del desglose por bróker
  (`06-sync-brokers.js`) y de Inversiones por bróker en Cartera (`07-tab-patri-fijos.js`).
- **Sin tocar** las dos filas que son por empresa, que ya van por `LogoInv`.

**La regla, por fin escrita y atada:** *si la fila es un BANCO, el logo del banco; si es una
EMPRESA, `LogoInv`*. Nuevo guardián `tests/logo-banco-o-empresa.test.mjs`, que comprueba los cinco
sitios y se pone rojo en las dos direcciones (probado rompiéndolo a mano). Se rompió dos veces el
mismo día y ningún test lo vio: es un [[misma-regla-en-dos-sitios]] de manual.

### Y el panel de «Revisar esta beta», de 56 tandas a 13

Petición suya esa misma noche: *«actualizarme la lista de cosas que verdaderamente puedo probar,
no me sirve cosas que ya te he dicho por aquí, ni cosas que sabes 100 % que no podré probar… y
actualizarme las descripciones paso por paso como si fuera tontico»*. Tenía 56 tandas acumuladas
desde el 4.19.0: nadie se lee eso en un móvil.

Criterios, todos comprobables y no «a ojo»:

- **Fuera lo que ya tiene veredicto suyo**, leído de sus propios eventos
  (`node scripts/errores.mjs --kind=beta`): 12 tandas, aprobadas el 8/9 y el 10/9 o rechazadas.
- **Fuera lo que no se ve**: el rastro interno del 512/497 (`catch-mudo`) y la sonda de duplicados
  decían literalmente «no deberías notar nada distinto». Eso es instrumentación mía, no algo que
  él pueda dictaminar.
- **Fuera lo meta**: dos tandas pedían probar el propio panel desde dentro del panel.
- **Fuera lo que depende de servidor sin desplegar.** `npm run servidor` dice que las 13 Edge
  Functions van por detrás del repo. Las tandas de efectivo, del widget y de que los apuntes a
  mano no se fusionen tienen su mitad ahí: pedirle que las pruebe es pedirle que encuentre un
  fallo mío. Quedan aparcadas hasta desplegar, no borradas.
- **Una saga, una tanda**: las seis rondas de logos y las tres del tirón al cambiar de pestaña se
  quedan en la del estado de hoy.
- **Un rechazo no vuelve tal cual.** Sus dos rechazos del 8/9 (`tr-reactivo`,
  `avisos-presupuesto`) se le devuelven como un paso más dentro de la tanda que de verdad los
  arregla, con su frase citada. Re-probar la compilación que ya rechazó no vale para nada.

Y los pasos, numerados y con la ruta entera («Cartera → Tus cuentas → Editar»), diciendo qué mirar
y qué significa que esté mal. El guardián `beta-tandas-vacias` exige ahora las tres cosas: que
nada juzgado vuelva, que lo no probado siga, y que **cada punto empiece por un número**.

Se han retocado tres guardianes que llevaban congelada la foto del 8/9 y daban por «pendientes»
tandas que él aprobó el 10/9 — `beta-tandas-vacias`, `release-notes-max` y el e2e
`revisar-beta`. Los tres acusaban de regresión a una limpieza correcta; ahora comprueban la forma
(que la ronda abarque varias versiones) en vez de una lista de versiones que caduca sola.

## [4.19.60] - 2026-09-11
### Revolut nombra por TICKER, no por el nombre de la empresa

Mandó una captura de sus inversiones reales: de sus siete posiciones de Revolut, solo AMD y Meta
llevaban logo. El resto llegan como **`NVDA`, `GOOG`, `AVGO`, `TSM`, `MU`** — el ticker, no el
nombre. Trade Republic sí manda «Meta Platforms», y de ahí la confusión al probarlo con nombres
completos inventados en vez de con los suyos.

- `TICKERS_INVERSION` en `00-core.js`: `nvda`, `goog`, `googl`, `avgo`, `amd`, `meta`.
- El ticker **solo vale si el nombre ENTERO es ese ticker** (un solo token). Buscarlo dentro de
  un nombre largo haría que «NVDA 2x Leveraged» o «Cartera GOOG y otros» se llevaran un logo que
  no les toca; están los tres en el guardián.
- TSM, MU, el oro y los fondos siguen sin logo: no hay trazo oficial en simple-icons.

Lección: **probar con SUS nombres, no con los que uno se imagina.** El guardián ya tenía
«NVIDIA» y «Broadcom» y pasaba en verde mientras su pantalla enseñaba cinco monogramas.

## [4.19.59] - 2026-09-11
### Los logos de las empresas en Inversiones

Pidió ver NVIDIA, Alphabet, Broadcom, TSMC, AMD, Micron, Meta y el FTSE con su logo, como los ve
en Revolut y Trade Republic. Eligió la **opción C** (los que se puedan, guardados en la app; el
resto con su monograma) y autorizó usar los logotipos oficiales.

- `scripts/logos-inversiones.mjs` genera `public/logos/inv/*.svg` desde **simple-icons** (MIT,
  trazo oficial). **Nada se descarga en caliente**: ni se rompe la norma de cero CDNs, ni se le
  cuenta a un tercero qué empresas tiene en cartera. 4,5 KB, fuera del bundle.
- **La regla de «qué marca es» vive SOLO en `00-core.js`** (`marcaDeInversion`). El script la
  carga con `load-pure-logic.mjs`. Si viviera en los dos sitios sería la séptima copia de la
  misma regla — y eso mordió tres veces el 11/9.
- Se compara por PALABRAS, no con expresiones regulares: un `` perdido al copiar el fichero
  entre sitios convierte «AMD» en algo que casa dentro de cualquier palabra. Pasó dos veces hoy.
- Un FONDO con el nombre de una empresa NO es la empresa: «iShares Metaverse UCITS» y «AMD Ryzen
  Fondo» no llevan logo. Ante la duda, sin logo: **el monograma correcto es mejor que el
  logotipo equivocado**.
- `LogoInv` en los dos sitios donde la fila ES una empresa; el resto sigue con `Mono`.
- Guardián `logos-inversiones --check` en la suite, con los nombres reales del bróker y los
  tramposos.

### El service worker ya no se cae por un fichero que falte

Ámbar de Cursor al revisar la 4.19.52: `caches.addAll(SHELL)` es todo-o-nada, así que **un solo
404 reventaba la instalación entera del SW** y dejaba la app sin caché offline, en silencio.
Ahora se precachea uno a uno y el fallo de un fichero no tira el conjunto.

## [4.19.58] - 2026-09-11
### Panel de beta: fuera tandas mentira

Él entró a Revisar la beta y le pedía probar el «Aa» de Inicio (quitado en 4.19.52) y media
docena de intentos de logos que nunca llegaron al móvil.

- `tandas: []` en 4.19.44–49 y .53 (Aa mentira + intentos supersedidos).
- Una sola tanda de logos vivos: **4.19.56** (`revolut-palo`). 4.19.52 se queda solo con
  `aa-fuera-inicio` (dónde está el tamaño de letra ahora).
- 4.19.55 (`expbanks-en-cartera`) y 4.19.57 intactas — no tocar.
- Checklist tip↔prod ~53 tandas; la mentira del Aa ya no sale.

## [4.19.57] - 2026-09-11
### El saldo del banco ya no se infla con gastos de otros bancos

Su padre: Revolut en el banco **26,46 €**, en la app **455,50 €**. Confirmó que esos 26 €
eran reales. Al sincronizar, `applyBankBalances` despejaba la base sumando el gasto del mes
de **todos** los bancos; con rol diario/ambos, Caixa/TR se le devolvían a Revolut.

- Re-anclaje diario/ambos vía `valueDesdeSaldo` + `gastoDelMesPorBanco` (misma regla que al pintar).
- La rama `fijos` sigue `bal − monthNet` (= inversa de `value + paidNet`).
- Test espejo con DOS bancos en `saldo-por-banco` (con uno solo el bug no se ve).
- No se toca el rol de su padre.

## [4.19.56] - 2026-09-11
### La R de Revolut son DOS piezas, y yo me quedaba con una

Su aviso: *«arreglaste el circulito de la r pero cortaste el palo»*. En la 4.19.53 puse una
máscara de «una sola pieza conectada» para que no se colara la «e» de al lado. Pero la R de
Revolut son **dos piezas sueltas** —el palo vertical y la panza con la pata— así que quedarme
con una le amputaba la otra.

- `piezasDentro`: se queda con TODA pieza cuya caja quepa ENTERA en el recorte. La «e» se sale
  por la derecha → fuera; el palo y la panza caben → dentro. Además no hay que saber cuántas
  piezas tiene cada logo.
- Trade Republic: `ocupa` 0,46 → 0,38.

## [4.19.55] - 2026-09-11
### Bancos solo para bancos: gasto diario fuera de Conectar cuentas

Su petición: en conectar cuentas salía «también apuntar gastos de tarjeta…» con mucho texto
y chips; eso tenía que vivir solo en Cartera (roles Recibos / Gasto diario / Todo).

- Quitado el bloque `data-expbanks` de `BankPanel` (`10-app-components.js`).
- No se añade casilla nueva: `pickRole` en Cartera ya escribe `settings.expenseBanks`.
- Textos que mandaban a «Ajustes → Bancos» (`h_roles`, `rl_hint`, `coach_*`, `bp_hist_nodaily`)
  reescritos en es/en/ca.
- E2e `presupuesto-bancos` pasa a marcar el EXTRA desde Cartera → editar cuenta.

## [4.19.54] - 2026-09-11
### Las inversiones recuperan su monograma (regresión mía de la 4.19.52)

Su aviso: *«te cargaste los iconos de las inversiones de las empresas, pon los de antes»*.
Al enseñar el logo real del banco en `Mono` se coló también en Inversiones, donde cada fila es
una EMPRESA (Apple, Nvidia…) y no un banco: todas las posiciones de un mismo bróker salían con
el mismo icono de banco.

- `Mono` acepta `logo:false` → monograma de colores de siempre.
- Puesto en los 5 sitios de inversiones: `06-sync-brokers` (lista, tarjeta de bróker, desglose
  por bróker y rendimiento por posición) y `07-tab-patri-fijos` (Inversiones por bróker).
- El early-return va DESPUÉS del `useState`: un hook no puede quedarse detrás de un return.

## [4.19.53] - 2026-09-11
### Revolut entera y Trade Republic a su tamaño

Su veredicto de la 4.19.52: *«revolut sale con la R la redonda de esa letra cortada un poquitin
en mitad de la curva»* y *«las dos olas esas SON GIGANTESCAS, la original son pequeñitas»*.

- **Revolut**: la R llega hasta x=948, no 851. La medía por las filas de ARRIBA y su punto más
  a la derecha está al **99 % de la altura**, así que cualquier medida que mire solo arriba la
  corta — 97 px fuera. Ahora se mide con **relleno por inundación**: la R es una sola pieza.
- Y máscara de esa pieza: recortar por caja rectangular colaba un trozo de la «e» de al lado,
  que se veía como una mota pegada al borde al ampliar.
- **Trade Republic**: `ocupa` propio de 0,46 (el resto sigue a 0,66). En el logotipo real las
  cintas son pequeñas al lado del nombre.

## [4.19.52] - 2026-09-11
### Los logos de banco, recortados del original en vez de dibujados

Cuarto intento, y el primero que no es un dibujo. Los tres anteriores (iniciales, formas a ojo,
trazos medidos de una captura del launcher) los rechazo: «que puta mierda es esa, no son los
logos» y «parecen logos de aliexpress». Tenia razon: con `<text>` de la fuente del sistema y
curvas a mano sale una imitacion, no un logotipo.

- `scripts/logos-bancos.mjs` recorta el ISOTIPO del PNG oficial de `docs/design/bancos/`
  (bajados del directorio de Enable Banking, campo `logo` de `bank-aspsps` — la misma fuente por
  la que la app conecta con sus bancos, y que ya se enseña en el selector). Caja del contenido
  calculada, no a ojo; reduccion por media de area para que el trazo no se deshaga.
- Salen a `public/logos/*.png`, **17,1 KB en total y FUERA del bundle**: el gzip del index esta
  al 99 % del tope y un fichero aparte no cuenta. Viajan igual en el APK (`build-www` copia
  `public/` entero) y en el bundle OTA (`zip -qr`), y van al shell del service worker.
- `Mono` usa `<img>` y cae al monograma de siempre si el PNG no carga.
- Fuera `bankMark`: 23 `createElement` de SVG dibujado a mano.
- Guardian nuevo en la suite: `logos-bancos --check` falla si alguien los edita a mano.

### Fuera el boton «Aa» de Inicio

Peticion suya: *«quitame lo de la letra al lado del perfil... que pa eso esta en las settings,
no se porque me lo añadiste ahi»*. El control sigue en Ajustes (`10-app-components.js`), que es
donde estaba; se va el atajo de Inicio y su barra desplegable.

## [4.19.51] — 2026-09-11
### Paso 0: un apunte manual no se fusiona

Él confirmó 8 Bizums en TR vs 5 en la app; los que metía a mano se los comía
`día|importe|comercio`. `keyOfExpense` / `claveComoLaApp` añaden el `id` si el source
es manual; lápidas legacy sin id siguen casando. Tests de oro: 8 Bizums + 1 APOLLON.


## [4.19.50] - 2026-09-11
### Ninguna escritura de gastos se queda muda

Portado a mano desde `tanda/catch-addExpense-log` (4.18.24, ya en `main`). Mergear la rama
entera arrastraba media rama vieja de `main` y dejaba 7 tests en conflicto, asi que se han
llevado los hunks uno a uno.

- `subirGasto(e, donde)` y `borrarGastoNube(e, donde)` en `00-core.js`: envuelven
  `cloud.addExpense` / `cloud.deleteExpense` y mandan a `app_events` la clave del gasto y el
  error cuando fallan. Antes cada sitio hacia `.catch(function(){})` y la fila se quedaba solo
  en el movil.
- Cableados los 8 sitios: borrar, resolver repetido, editar, apuntar (Gastos y v4), backfill de
  sincronizacion, importadas de Open Banking y `setExpenseDup`.
- El blindaje del banco de pruebas los cubre: envuelve `cloud[name]` por propiedad y el helper la
  resuelve al llamar, asi que en modo pruebas no sale nada del movil.

Por que importa: el 11/9 se midio widget 512 EUR sin abrir la app y 497 EUR en pantalla. La
diferencia eran 14,90 EUR de un gasto que el movil tiene y la tabla `expenses` no. Sin este
rastro no hay forma de saber cual ni por que.

## [4.19.49] — 2026-09-11
### TR corto/gordo y Revolut de una pieza

Feedback Claude sobre preview: TR leía como ≈ de tres lóbulos (paths largos finos); ahora dos Q cortas stroke 3.5. Revolut con hueco asta/hombro leía «IR»; path único pegado.

Se quitan `preview-launcher.html` y `launcher-real/` del árbol (recortes de su pantalla).


## [4.19.48] — 2026-09-11
### MyInvestor centrado a 40 px

Feedback Claude: el grupo my+barra iba a la izquierda y la barra (1,55 u) no leía el degradado. Centrado como grupo y barra ~2,5 u.


## [4.19.47] — 2026-09-11
### Logos cara a cara con su captura

Él puso el launcher al lado de lo que había pintado: Revolut y Trade Republic iban invertidos (fondo negro). En el móvil son fondo blanco; TR son DOS ondas negras, no tres. Sabadell/MyInvestor/Caixa reajustados a proporciones del recorte.


## [4.19.46] — 2026-09-11
### Logos = los del icono del móvil

La 4.19.45 midió el lockup de Enable Banking y no se parecía a lo que él ve en el launcher. Ahora copian los iconos de su captura: Sabadell bola+B+S, Revolut R en negro, TR ondas (media recta), MyInvestor my+barra (sin círculo), Caixa Miró en blanco.


## [4.19.45] — 2026-09-11
### Logos de banco medidos del original

Isotipos SVG sacados de `docs/design/bancos/` (Enable Banking), no de memoria. Sabadell bola+B, Revolut simple-icons, TR ondas, MyInvestor círculo+my, Caixa estrella Miró. Gzip sin apretar el tope.


## [4.19.44] — 2026-09-11
### Letra a mano y conectar cuentas (lista 11/9, ítems 2 y 3) — sin logos

Claude revisó a ojo los SVG de `logos-letra`: dibujaban **iniciales**, no marcas. Él pidió logos reales; marcas registradas quedan a su voto (1/2/3). Esta rama integra solo lo ya VERDE:

- **Aa en Inicio** junto al avatar (ítem 3): misma escala que Ajustes, sin tocar `shell.html`.
- **Conectar cuentas** en Cartera → Tus cuentas (ítem 2): `mc-open-banks`.

Los `bankMarkPaths` / Mono SVG quedan fuera hasta que decida.


## [4.19.43] — 2026-09-11
### La ronda de la tarde: lo que se veía roto al estrenar y los textos que sobraban

Une `bugs-11sep` (mío), `copy-ruido-11sep` y `bp-count-vacio` (de Cursor), las tres con review ejecutada.

- **Las notas de las tres se funden en ESTA a propósito.** Ninguna llegó a publicarse —beta iba por la 4.19.40—, así que dejar tres entradas en Novedades sería contarle a la familia tres versiones que no existieron. Las tres **tandas** se conservan enteras: son lo que él tiene que probar.
- **Y aquí un fallo mío que se repitió DOS VECES el mismo día.** Mi helper de unir notas deduplicaba por número de versión y, cuando dos ramas llevaban el mismo —que pasa constantemente porque cada una se numera sola—, **se quedaba con la primera y tiraba la otra en silencio**. Esta vez se comió la nota de `copy-ruido-11sep`: la tanda habría subido y su checklist no habría aparecido en el panel de revisión, así que él no habría tenido qué probar de esa mitad. Lo cazó comparar la nota integrada contra la de la rama, no ningún test.
- Ahora es `scripts/unir-notas.mjs` y **un choque de número es un ERROR**, no una decisión callada: quien integra decide si renumera o funde las dos en una. Las dos cosas son válidas; hacerlo sin mirar, no.
- El bump de esta versión **no es cosmético**: `docs-frescura` cazó que la integración cambiaba cinco ficheros por encima del último bump, y sin subirlo el móvil no se habría enterado. Lo vio Cursor en su review antes que yo — porque yo pasé la suite **antes** de commitear la retirada del overscroll y no después. La comprobación se hace en la PUNTA, no a mitad.


## [4.19.42] — 2026-09-11
### Bancos en pruebas, sin fantasmas (lista 11/9, ítem 4)

En el banco de pruebas vacío, Ajustes → Bancos decía «1 conectado» con Mis bancos vacío. `bankLinks` de la nube ya se corta en modo inicial; lo que sumaba era **`trConn` del plugin nativo** (sesión real del móvil + `mc_tr_phone`), fuera de la cartera de pruebas. En sandbox ese +1 (y el «TR caído») ya no cuentan; en producción se sigue contando TR como siempre (feedback 2026-07-10). Título de sección: «Bancos» a secas, sin «(Open Banking)» en el rótulo.


## [4.19.41] — 2026-09-11
### Textos del banco y del primer día (lista 11/9, ítems 5–7)

Feedback suyo al probar el modo vacío:

- **Mis bancos:** se quita el pie que decía que Trade Republic no está en Open Banking (desde el 1/8 sí puede conectar por OB; el aviso mentía).
- **Importar histórico:** `bp_hist_nodaily` ya no dice que TR no vale; indica que también sirve si está conectado.
- **Inicio con presupuesto y cero gastos:** dejaba «Vas muy bien» por defecto (`ratio===0`). Ahora usa `st_start_h` («Aquí empieza el mes») hasta que haya gasto real. Es el primer minuto de alguien que acaba de instalar.

Ítem 4 («1 conectado» con cero bancos) queda para cuando quede libre `10-app-components.js` (Claude en bugs de scroll).

### El cuadro azul de Cuentas, el onboarding y el rebote en bloque

Cuatro de la lista que soltó probando el modo vacío. Las otras ocho van repartidas con Cursor.

- **El recuadro azul vacío encima del nombre del banco** (foto suya). `.v4-ob-badge` estaba declarado **DOS VECES** en `shell.html`: la insignia del lockup de Aely —que metí yo el 10/9— y la chip «del banco», que ya existía. En esta casa `v4-ob-` significa dos cosas distintas: **onboarding** en una y **open banking** en la otra. Como la del lockup pone `width:64px;height:64px` y la chip no toca esas propiedades, la chipita se convertía en un cuadro de 64×64 tapando «Sabadell». Renombrada a `.v4-ob-lockup-badge`. **Mi rebranding rompió su pantalla de Cuentas y no lo vi.**
- **«Saltar» pegado al título** en el onboarding, y peor en la segunda pantalla. Iba en `position:absolute;top:0;right:0`, o sea que no ocupaba sitio, y el título —centrado y a 36 px— se le metía debajo en cuanto envolvía a dos líneas. En 360 px de ancho eso es siempre. Ahora es una fila propia (`.v4-ob-top`) y el título empieza donde ella acaba.
- **El título del onboarding, de 36 a 27 px.** Suyo: «con letra EXTRA EXTRA EXTRA GRANDE o qué».
- **La letra de la app arranca en «pequeña», pero SOLO en instalaciones nuevas.** Se pone en el `finish()` del onboarding y no como valor por defecto global: cambiarlo globalmente le reescribiría el tamaño a su padre y a su pareja, que ya tienen la app y no han pedido nada.
- **El rebote «se baja todo en bloque y luego sube»: NO ARREGLADO, y no por falta de ganas.** La mitad del diagnóstico está medida y es cierta: con la cartera vacía la página no scrollea nada (Plan da `scrollHeight` 748 y `clientHeight` 748 en su móvil). Pero el síntoma **no lo he conseguido reproducir**: ni el shell se mueve un píxel durante el arrastre (215 fotogramas, 0,0 px) ni dos capturas —una con el dedo puesto en el sobrescroll y otra en reposo— salen distintas: mismo sha1. Llegué a poner `overscroll-behavior-y: contain` y **lo he retirado**: cambiar el scroll de toda la familia por una hipótesis que no he visto fallar es exactamente lo que aquí sale caro. Hace falta verlo pasar (un vídeo suyo, o decirme en qué pantalla exacta).

**Y una que NO es un fallo, aunque lo parezca:** que en la cartera vacía no se oculte la barra ni salga la ola es **la misma raíz**, no un bug aparte. Sin nada que scrollear no hay eventos de scroll. Con datos vuelve solo.

⚠ **El rebote está razonado y probado en escritorio, pero NO verificado en su móvil**: el efecto de estiramiento es del compositor de Android y Chrome de escritorio no lo reproduce. Se quedó sin cable a mitad. Hay que confirmarlo en el aparato antes de darlo por cerrado.

## [4.19.40] — 2026-09-11
### La ronda del 11/9: el banco de pruebas, el logo y el tirón

Une las tres tandas de la mañana, las tres con review ejecutada de Cursor en verde:

- **4.19.37 — el modo inicial ya no se deja rellenar por la nube.** Segundo rechazo suyo del mismo sitio. El sandbox sigue LEYENDO de la nube a propósito, y eso choca con «ver la app como recién instalada»: siembras vacío, recarga, llega su estado real y gana el last-write-wins. Ahora el modo inicial lleva bandera propia y corta también las lecturas que meten datos.
- **4.19.38 — un solo logo de Aely, y un icono que no se corta.** Había dos dibujos distintos (el splash llevaba uno viejo hecho a ojo) y el icono adaptativo se salía de la máscara redonda de las notificaciones. La escala final sale de MEDIR los píxeles del PNG, no de la fórmula: el resplandor sobresale y la cuenta no lo veía.
- **4.19.39 — el tironcillo del cambio de pestaña.** Medido en su móvil con toques reales: el carrusel se quedaba quieto ~30 px y luego pintaba los 36 de golpe. Yendo lento eso son 721 ms de silencio; yendo rápido, 173. Con el ancla: 36,1 → 0,7 px.

**Las notas de la 4.19.37, .38 y .39 se funden aquí a propósito.** Ninguna de las tres llegó a publicarse —beta iba por la 4.19.36—, así que dejar tres entradas en Novedades sería contarle a la familia tres versiones que nunca existieron. Las tres TANDAS sí se conservan enteras: son lo que él tiene que probar, y el panel de revisión las lee de aquí.

⚠ **Lo nativo no viaja por OTA.** El icono adaptativo y los literales de las notificaciones necesitan APK nueva. Por beta van el modo inicial, la pantalla de carga y el tirón.


## [4.19.39] — 2026-09-11
### El tironcillo del cambio de pestaña, medido en su móvil y arreglado

- **Lo llevaba viendo desde el 10/9 y yo lo di por arreglado tres veces.** Esta vez está MEDIDO en su OnePlus 13, con toques **reales** (`adb shell input swipe` inyecta MotionEvents por el sistema; los sintéticos del navegador no reproducen el muestreo del digitalizador). Herramienta nueva: `tools/movil/tiron-lento.mjs`.
- **Lo que salió, y por qué mis medidas antiguas decían que todo iba bien.** Yo medía los deltas de FOTOGRAMA con `rAF` y salían 120 Hz clavados — y siguen saliendo: **0 fotogramas tarde**. El número que había que mirar no era cuándo llega el fotograma, sino **cuánto se ha movido en él**:

  | | lento (1600 ms) | rápido (350 ms) |
  |---|---|---|
  | el dedo se mueve sin respuesta | **721 ms** | 173 ms |
  | y recorre | 28,1 px | 29,9 px |
  | entonces la pantalla salta | **36,1 px** | 37,1 px |

  El hueco muerto es el MISMO; lo que cambia es cuánto dura. Tres cuartos de segundo con el dedo moviéndose y la pantalla quieta, y entonces un brinco. Sus palabras encajan clavadas: *«si desplazas fluido no se nota apenas, es ir lento y ahí se nota el tirón»*.
- **De dónde salen esos ~30 px.** No son los 12 de `GEST_LEAD`: hay una guarda que NO suelta el eje horizontal hasta `|ddx|>36` mientras la página pueda scrollear, para que el carrusel no le robe el scroll vertical. **Esa guarda se queda** — quitarla devuelve el bug de la deriva lateral, que costó caro. Lo que no tiene por qué pasar es que, al soltarse, pinte los 36 px acumulados **de golpe**.
- **El ancla**: al reclamar el eje se apunta cuánto se había recorrido, y lo que se PINTA arranca desde ahí. Medido otra vez en el mismo móvil: **36,1 → 0,7 px** (lento) y **37,1 → 1,5** (rápido).
- ⚠ El ancla es **solo para lo que se ve**. `dx.current` sigue crudo porque de él dependen el umbral de cambio de pestaña, el flick y el premontado de la vecina; restarle 36 también a eso pediría 108 px para cambiar de pestaña y el gesto se volvería pesado.
- Guardián en `swipe-pestanas`: cruza el umbral a pasitos de 3 px y exige que el primer movimiento pintado sea menor de 12 px. Verificado **en rojo quitando el ancla**.

**Lo que NO arregla esto, y hay que decirlo:** el hueco muerto de ~30 px (730 ms yendo lento) sigue ahí, porque es la guarda del scroll. Se ha quitado el brinco, no la espera. Bajar ese umbral es una decisión aparte y arriesgada: toca directamente el bug de «la deriva lateral roba el scroll».
## [4.19.38] — 2026-09-11
### Un solo logo de Aely, y un icono que no se corta

- **Había DOS logos distintos.** Él lo vio en su móvil: *«al cargar… se ve este icono es raro, se ve alargado y no es el mismo»*. Tenía razón: la pantalla de carga de `shell.html` se había quedado con un dibujo viejo hecho a ojo —su «A» iba de 18 a 46 (28 de ancho) contra los 7,7→55,9 (48) del bueno, y encima era un trazo abierto sin relleno— mientras `I.logo` llevaba el medido sobre `logo Aely.png`. De ahí lo de «alargado».
- **El icono de Android salía cortado por los bordes** en las notificaciones: *«el icono cuando sale algo sale cortado los bordes»*. No era otro dibujo, era geometría. La máscara de las notificaciones es un CÍRCULO, y lo que manda no es el lado del badge sino su radio. Estaba al 0,63 del lienzo → 41,5 dp de radio contra los 33 garantizados.
- **Y la cuenta no bastaba.** Bajándolo a 0,50 la geometría decía 32,9, pero midiendo los píxeles del PNG salían **134,4 de 132**: seguía cortándose, porque el dibujo lleva un resplandor que sobresale del trazo y que la fórmula no ve. Con 0,49 el radio real es **131,6**. El número sale de medir, no de calcular.
- Guardián `aely-logo-unico` (4 casos): ata las TRES copias del badge —splash, `I.logo` e `iconos-aely`— y rehace la cuenta del recorte con la fracción **medida**. Verificado en rojo devolviendo el logo viejo al splash.
- Cinco literales «Aely» que se saltaron el rebranding en el lado nativo (título de las notificaciones, nombre del canal y el aviso de actualización) pasan a **Aely**. Es lo que sale en la notificación de su captura.

⚠ **El icono y los textos nativos NO viajan por beta**: son de la APK. Esta versión arregla por OTA la pantalla de carga; lo demás necesita instalar una APK nueva.
## [4.19.37] — 2026-09-11
### El modo inicial ya no se deja rellenar por la nube

- **Segundo rechazo suyo del mismo sitio**, y esta vez con la causa medida. El banco de pruebas SIGUE LEYENDO de la nube a propósito —está escrito en el código: «probar con datos de verdad es justo la gracia»— y eso es correcto para el banco de pruebas normal. Pero es **incompatible con el modo inicial**: siembras la cartera vacía, la app recarga, `syncFromCloud` trae su estado real y, como la cartera recién sembrada no tiene `_savedAt`, la nube gana el last-write-wins y la vuelve a llenar entera. Medido sin el arreglo: `budget 900, 1 cuenta, onboarded true`. Eso es «entra sin más al banco de pruebas» y «no resetea nada».
- El modo inicial pasa a tener **bandera propia** (`_mcSandboxVacio`) y, mientras está puesta, se cortan también las **lecturas que meten datos** (`pullState`, `pullExpenses`, `bankSync`, `bankLinks`, `myinvestorSync`, backups, Hogar…). El banco de pruebas NORMAL no se toca: sigue leyendo de la nube como hasta ahora.
- Salir del banco de pruebas o volver a copiar la cartera real **apagan la bandera**. Sin eso, la nube se quedaría cortada para siempre sin motivo.

**Por qué se me escapó el 10/9, que es lo que más importa:** lo di por arreglado probándolo en un navegador **sin sesión de nube**. Con el doble de Supabase devolviendo vacío, el fallo no existe. Su móvil sí tiene sesión. Otra vez lo mismo: si él lo ve y mi medida sale limpia, **la medida está mal hecha**.

**Y el guardián casi nace muerto.** El primero que escribí pasaba con el arreglo QUITADO: la nube de mentira tenía `_savedAt` de «ahora», la app sella el suyo al arrancar antes de que llegue la respuesta, ganaba lo local y la cartera se quedaba vacía por accidente. Ahora la nube va 10 minutos por delante —que es el caso real— y el test está verificado **en rojo sin el arreglo y en verde con él**.

- `e2e/fixtures.mjs`: el doble de Supabase devolvía SIEMPRE `null` en `maybeSingle`, así que `pullState` no traía nada y **ningún test de esta casa podía ver qué pasa cuando la nube tiene cartera**. Ese agujero es el que escondió todo esto. Ahora se puede sembrar nube con `__cloudRows.app_state`.

## [4.19.36] — 2026-09-11
### FIN-07 · El histórico entero, y una descarga a medias que ya no borra

- `pullExpenses` traía como mucho **2.000 gastos sin paginar**, y `syncCloudExpenses` REEMPLAZA los de origen `supabase` por lo que acaba de llegar. Con más de 2.000 en la nube —lo normal tras importar el histórico de un banco— **cada sincronización borraba de la app los más viejos**. Su queja del 10/9 («solo baja el histórico un poquito») era esto, y no el importador.
- Ahora se **pagina por clave** (`fecha` desc + `id` desc, páginas de 1.000). Por clave y no por desplazamiento porque un gasto que entre a mitad de la descarga corre la lista y te hace saltarte una fila o repetirla. El `id` en el orden no es decorativo: sin un segundo criterio ÚNICO, dos gastos del MISMO día pueden salir en distinto orden entre páginas.
- **Una descarga a medias ya no es un borrado**: se conserva lo que había y solo se añade lo nuevo.
- El aviso ya no promete «los 2.000 más recientes» ni acaba en «avísame» —le pedía a él que vigilara si le faltaban gastos—: dice lo único que importa, que **no ha perdido nada**.
- Guardián `pull-historico-entero` (9 casos), verificado en rojo quitando la guarda.
- ⚠ Este mismo fallo estaba **también en producción** (4.18.8, y allí sin `id` en el orden): va aparte en `tanda/fin07-historico` / `integra/prod-11sep`.

**Crédito:** la paginación por keyset es de Cursor (`tanda/fin-07-pull`); el tope de seguridad, la guarda de la mezcla y los guardianes, de esta tanda.

# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/) y versionado [SemVer](https://semver.org/lang/es/).

## [4.19.35] — 2026-09-10
### El copy y el logo de Aely, del brief de verdad

Él trajo un brief ampliado con **voz, posicionamiento y el copy exacto** del onboarding, y la instrucción de aplicarlo al pie de la letra.

- **Posicionamiento**: esto no es «una app de control de gastos», es el **mapa completo del dinero**. El onboarding lo dice ahora con sus palabras: «La gracia no es tener 40 pantallas: es saber dónde estás cuando vas a gastar o decidir».
- Tres tarjetas nuevas — *Todo tu dinero*, *Se apunta solo*, *Para decidir* — con el texto del brief. En **inglés y catalán se traduce la VOZ, no las palabras**: el brief prohíbe expresamente el copy de agencia, y el castellano copiado en `en`/`ca` ya es un agujero conocido (OPS-03).
- **El logo, rehecho contra el original.** Mis dos primeros intentos los dibujé mirando una captura y él los despachó con «esto es un mierdón» y «no se parece nada» — tenía razón las dos veces. Encontré `logo Aely.png` en su carpeta de imágenes y las coordenadas están ahora **medidas sobre él**: la A es HUECA (contorno de Λ, no una cuña maciza), ocupa el 79 % del ancho del badge, las patas son el 22 % de la A, y el badge llega al borde del lienzo — «el logo debe acabar en las rayas exteriores verdes».
- ⚠ El `stroke` de la A va fino a propósito: con 2,4 el propio trazo cerraba el hueco cerca del vértice y salía un triángulo con una muesca, no una A.
- El original queda guardado en `docs/design/aely/aely-icon-adot-badge.png` como fuente de verdad.

## [4.19.34] — 2026-09-10
### Sonda del histórico (solo medida)

Para cerrar el diagnóstico de «detecta movimiento y no lo marca duplicado» hace falta contar en SU móvil, no solo en el banco de pruebas.

- Tras **Buscar movimientos** en Importar histórico: toast con `banco → llegan → nuevos → coinciden día+€` (comercio ignorado; coincidencia de diagnóstico, no identidad) y `window.__histDupProbe` con el detalle (tope Edge 2000, truncado explícito, pull capped…).
- Flatten compartido UI↔sonda (`histFlattenHistoryLinks`): conserva `card` / entKey / merchant fallback; la sonda **no** reclasifica un conjunto distinto (bloqueador Codex: tarjeta+fijo).
- **No cambia** clasificación, identidad ni borrados. `count` de bank-sync = `all.length`, no total del banco. `minDate>dateFrom` se reporta como heurística UI (`uiMinAfterFrom`), no como truncado del servidor.
- Temporal: se quita cuando la medida esté tomada.

## [4.19.33] — 2026-09-10
### Bizum como categoría, y el vacío vuelve a enseñar el onboarding

Sus palabras del 10/9 noche: «añademe bizum como categoria tambien que recibo muchos y mando muchos» y «lo de resetear la app de 0 para que salga onboarding […] tampoco furula».

- **Categoría `bizum`**: en el selector, el desglose y el límite por categoría. Auto-detecta comercios con «Bizum…». Los **recibidos** siguen entrando como ingreso por el signo (como siempre); esta categoría es para los que **mandas**.
- Alineado en cliente, `ingest_logic` y `categorize` (ALLOWED + hints).
- **Modo vacío / «recién instalada»**: siembra `onboarded:false` (antes `true` a propósito para mirar la tarjeta vacía de presupuesto, y por eso no salía el onboarding aunque el copy lo prometía).
- Incluye el nit del rAF del tironcillo (`axis!=="x"`) que Claude publicó en `tanda/tiron-raf` pero **no** llegó a la beta 4.19.31.1. Él sigue notando el tirón: no cantamos victoria; hace falta otra pasada con su gesto lento en la beta.

## [4.19.32] — 2026-09-10
### La app se llama Aely

Nombre oficial decidido por él. Brief en `docs/design/aely/AELY_BRAND_BRIEF.md`: «no inventes otra identidad».

- **Tanda A (web / OTA):** strings «Aely» → **Aely** (es/en/ca + manifest/title/privacy/back), header del onboarding con **lockup** (badge A-Dot + wordmark), tokens CSS del brief (`#0B140F` / `#6CC688` / …). Sin mascota.
- Icono A-Dot: A geométrica cuyo travesaño es un **punto**, en marco rounded-square (SVG inline en splash + `I.logo`).
- **No toca** `applicationId`, icono/splash nativos ni `android:label` (Tanda B, necesita APK y su OK). Deep-link `micartera://` y claves de storage se quedan: cambiarlos rompería instalaciones.
- El widget nativo y el nombre bajo el icono de Android siguen diciendo lo viejo hasta la Tanda B.

## [4.19.31] — 2026-09-10
### El tironcillo al pasar de pestaña: la mitad que faltaba

Con el arreglo de los 44 px puesto, él lo probó y dijo lo que faltaba: «sigue igual, una pequeñiiiiiiiiiiisiima mejora, pero sigo notando el tironcillo [...] **si desplazas fluido no se nota apenas, es ir LENTO y ahí se nota** el tirón, no va super smooth».

- Esa frase resuelve el caso, y deja claro que yo medía mal: todos mis arrastres eran de 200 ms, **rápidos**. El caso lento no lo probé nunca.
- Arrastrando despacio, el avance del carrusel frame a frame era: `-0,24  -0,25  -0,25  0  -0,25  0  -0,24  0  -0,25  0 …` — **un frame sí y otro no**.
- Causa: pantalla a 120 Hz, táctil mandando **~2,7 `touchmove` por frame** (696 para 253 frames, muchos con la misma marca de tiempo: el WebView los entrega en ráfaga). Escribir `transform` dentro de cada `touchmove` no pinta más veces, pero **desalinea cuándo se escribe respecto a cuándo se pinta**: frames con dos escrituras y frames sin ninguna. Rápido no se ve; a 0,25 px por frame, sí.
- Arreglo: `touchmove` solo apunta a dónde va el dedo; el `transform` lo escribe un `requestAnimationFrame`, una vez por frame pintado. Menos trabajo que antes, además.
- ⚠ El rAF se para en las **tres** salidas del gesto (fin, cambio de modo y `touchcancel`); si no, se pelea con `animarA` por el mismo `transform` y el soltar daría un tirón peor.

## [4.19.30] — 2026-09-10
### Al cambiar de pestaña ya no hay tironcillo

Su pista del 10/9: «es solo al scrollear recuerda de una tab a otra». Medido en su OnePlus: **0 frames >16,7 ms** y **0 longtasks** — los deltas de `rAF` no sirven. El instrumento válido es `layout-shift`: el contenido (`.v4-screen`) saltaba **44 px** (barra de estado) en la mitad de los cambios de pestaña.

- Causa: al poner/quitar `.page-scroll-host` cambiaban a la vez `position` (fixed↔relative) y `padding-top` (safe-top+10 ↔ 6). En reposo 44+6=50 cuadra; si las mitades no caen en el mismo frame, el contenido se pinta a 94 o a 6 y luego salta.
- Arreglo: el host ancla con `top: calc(var(--safe-top) + 4px)` (mismo hueco que `.app`) y el **mismo** `padding: 6px 18px …` que `.page`. La clase solo cambia `position`/anclaje, no el padding del contenido.
- La temática no agranda el salto (A/B idéntico); lo hace más visible contra un fondo quieto.
- Guardián en `season-detalle` + `e2e/ux01-layout-shift.spec.mjs` (geometría + layout-shift vertical).
- Brief: `docs/briefs/ux01-tironcillo-medido-2026-09-10.md`. **No publicar a la familia sin re-medir layout-shift en su móvil.**
- Bump **4.19.30** a propósito: deja hueco a las dos tandas selladas como 4.19.28 (`quitar-banco` / `hist-dup`) por si Claude las numera 28 y 29 al integrar.
- Cabo abierto: la APK `.debug` midió web 4.19.19; falta confirmar con bundle beta (+ count-up de Cartera B2 al aterrizar).

## [4.19.29] — 2026-09-10
### El histórico reconoce lo que ya renombraste

Parte (c) de su queja del 10/9: «detecta movimiento y no lo detecta duplicado» — en Trade Republic (sin `ext_id`) y en cualquier gasto renombrado.

- **Causa medida** (Cursor): `histCandExisting` indexaba lo guardado por `merchant`, pero el sync diario clavea con `obName||merchant`. Tras renombrar un «Movimiento» de TR, el histórico volvía a ver el nombre del banco y lo marcaba **nuevo**.
- Misma regla que `importObExpenses`: al comparar contra lo ya guardado se usa `obName` si existe. **No toca** la identidad UNIQUE de la nube (FIN-03), ni borra, ni migra.
- Tests nuevos en `hist-import-dup.test.mjs` (renombrado TR → dup; sin `obName` sigue el merchant).
- Queda aparte el tope de `pullExpenses` (2000): si el histórico local no tiene la fila, el falso nuevo puede seguir por otra puerta (FIN-07).

## [4.19.28] — 2026-09-10
### Quitar un banco pregunta, y Trade Republic dice por cuál de sus dos puertas falla

Dos cosas suyas del 10/9, y la primera venía de un rechazo suyo que era correcto.

**Quitar un banco (su decisión: «opción c»).** Su rechazo decía «quité TRADE republic y se mantienen todos los gastos, todos los filtros y todo igual no ha cambiado nada». Era verdad: quitar un banco purgaba `obAccounts` —los saldos— y **nada más**; su `ent` seguía en `settings.expenseBanks`, así que sus compras seguían contando para el presupuesto. No es que no pasara nada: pasaba la mitad, y la mitad que pasaba no se veía.

- Ahora **pregunta**, con `askChoice` (diálogo de varias opciones, pieza nueva): «que sigan contando» o «que dejen de contar». Cada opción lleva escrita su consecuencia, incluida la incómoda: dejar de contar **también cambia los meses ya pasados**, porque la cifra se recalcula siempre.
- **Nunca se ofrece borrar sus movimientos.** Un banco que quitas no es un historial que quieras perder.
- ⚠ **Límite que encontró el propio e2e**, no yo: si el banco es el de tu **día a día**, «que dejen de contar» no se puede cumplir — `expenseBankEnts` reañade siempre el `ent` de la cuenta diaria, porque esa cuenta es tu cartera. En ese caso la app ofrece solo lo que sí es verdad y te dice dónde se cambia el banco del día a día, en vez de prometer algo que no hará.

**Trade Republic tiene dos puertas** («estaría bien identificar cuándo falla por la api externa de trade republic y cuándo falla por open banking»). Los dos avisos decían «Trade Republic» y los dos decían «Reconectar Trade Republic», así que tocar el que no era no hacía nada.

- **(banco)** → Open Banking. Trae tus **compras con tarjeta**. Se arregla con el permiso del banco, y el aviso ahora dice que tus posiciones y tu efectivo no están afectados.
- **(inversiones)** → la API propia de TR. Trae tus **posiciones y tu efectivo**. Se arregla con PIN + SMS dentro de la app.
- Y **«Sincronizar bancos» de Ajustes ahora sincroniza también TR**, como ya hacía el de Cartera: era el botón que él usa para arreglar TR y ni siquiera lo tocaba. Si TR estaba caído y ese botón lo revive, **avisa** — y solo entonces, para no convertir cada sync en un toast.

7 e2e nuevos en `quitar-banco.spec.mjs`.

## [4.19.27] — 2026-09-10
### El visor del histórico deja de ponerse negro

Sus palabras del 10/9: «cuando bajo mas o menos por la mitad esta todo negro, sigo bajando negro mas negro hasta llegar al final que te dice ver 35 mas, le doy y no pasa nada xd, es sublime lo de importar hyper roto».

- **Una sola causa para las dos cosas**, que es lo que había que encontrar: `.hist-fila{opacity:0}` y solo `.dentro` las enseña. La animación de entrada paraba `revelado` en 24 y **nunca marcaba el resto**, así que de la fila 25 en adelante se veía el fondo. Y «Ver 35 más» sí subía `renderCap`, pero `setRevelado` iba topeado a `Math.min(24, …)`, así que **las filas nuevas nacían invisibles**: por eso parecía que el botón no hacía nada.
- Pasado el tope, `dentro = revelado >= animTope || vi < revelado`. «Ver más» solo sube `renderCap`.
- `e2e/hist-visor.spec.mjs`: lote de 95, la fila 30 opaca, y «Ver 35 más» → 95 visibles.
- Lo encontró y lo arregló **Cursor**. No toca identidad de gastos ni FIN-03.
- Queda abierto el tercer fallo del histórico que él reportó el mismo día: «detecta movimiento y no lo detecta duplicado». Es otra tanda y ata con FIN-07 y FIN-03.

## [4.19.26] — 2026-09-10
### El desglose por categorías se puede ocultar

Petición de su pareja, traída por él el 10/9: «está chulo pero mi pareja lo vio y me dijo que es *too much*, que le gustaría que se pudiera ocultar y habilitarlo si tú quieres».

- El desglose lista **todas** las categorías con gasto del mes, así que con vida normal son ocho o diez filas fijas encima de la lista de gastos. A él le sirve —ponerles límite fue idea suya— y a ella le tapa justo lo que viene a mirar. No es un fallo de la función: es que no todo el mundo quiere lo mismo abierto siempre.
- La **cabecera pasa a ser el interruptor**, con el mismo idioma que las tandas del panel de beta (▾/▸ + verbo), que ya conoce. Plegado deja **una línea** que dice cuántas categorías esconde: sigue estando, y no se ha perdido nada.
- El estado vive en `settings.gastosCatsOff`, o sea **por cuenta**: él puede tenerlo abierto y ella cerrado, sin pelearse.
- **Por defecto ABIERTO** a propósito: a quien ya lo tiene no se le esconde algo sin avisar. Se pliega quien quiera plegarlo.
- Plegar no toca ni un límite ni una cifra — hay un test que lo comprueba.
- 5 e2e nuevos en `gastos-categorias-presupuesto.spec.mjs` (8/8), más un caso de capturas bajo `MC_TIROS`.

## [4.19.25] — 2026-09-10
### Mantener pulsado ya no deja nada «marcado»

Rechazo suyo del 10/9 sobre `4.19.20/pulido-cierre`: «al mantener pulsado en un gasto, se subraya y la app se vuelve loca, no se puede quitar el que está "marcado"».

- Lo que se le quedaba marcado es la **selección de texto nativa de Android**. Una fila de gasto es un `<button>` que además lleva arrastrar-para-ordenar y deslizar: con las asas de selección puestas, los tres gestos se pelean por el mismo dedo y no hay forma de soltarlo.
- Regla en `button,.v4-mov,.v4-charge`: `user-select:none` + `-webkit-touch-callout:none`. Va sobre el botón y no fila por fila, así cubre también recibos, tarjetas y lo que venga. Los `input` y las notas **no** son botones y conservan su selección — hay un test que se pone rojo si alguien sube la regla a `body` o a `*`.
- ⚠ **Límite dicho a la cara**: la selección por pulsación larga la hace la capa nativa y Chromium de escritorio **no la dispara**. Comprobado: con el fallo puesto, un touch de 900 ms por CDP deja `getSelection()` vacío igual. Así que este arreglo está hecho **por causa, no por reproducción**, y lo que se vigila en los e2e es la condición que lo permite (`user-select` de la fila). El veredicto de verdad es el suyo en el móvil.
- `e2e/pulsacion-larga.spec.mjs`, 3 casos.

## [4.19.24] — 2026-09-10
### Modo inicial: el rechazo del 10/9, arreglado en su causa

Sus palabras al rechazar `4.19.21/modo-inicial`: «No funciona, entra sin más al banco de pruebas» y «Tampoco pasa nada, solamente sigue en el banco de pruebas como estaba, no resetea nada». Tenía razón las dos veces, y era el mismo fallo.

- **Causa**: el estado está PARTIDO (lo ligero en `micartera_sandbox`, los gastos en `micartera_sandbox_exp`). `mcSeedSandboxVacio` escribía la clave principal **a pelo** con `store.set`, pero la app no lee de ahí: lee por `mcLoadRaw`, que pisa `expenses` con la mitad partida. Como él ya había entrado antes al banco de pruebas, esa mitad tenía sus gastos y volvían todos. Vaciaba cuentas y presupuesto, dejaba los gastos.
- **Segundo fallo del mismo origen**: `mcEnterSandbox` sembraba con `store.get(STATE_KEY_REAL)`, que devuelve la mitad ligera — entrar al banco de pruebas te dejaba una cartera **sin un solo gasto**. Probar con eso no vale para nada, que es justo lo que motivó el modo inicial.
- **Tercero**: `mcResetSandbox` borraba solo la mitad ligera y dejaba `micartera_sandbox_exp` huérfana, así que la siguiente entrada mezclaba los gastos de la sesión anterior con la copia nueva.
- Las tres pasan ahora por `mcLoadRaw`/`mcSaveRaw`, nunca por `store` a pelo.
- **Y el volcado pendiente, que habría devuelto el fallo por otra puerta** — lo encontró Cursor revisando la tanda: el guardado del estado va con 400 ms de retraso y `pagehide` lo fuerza justo antes de recargar, así que «Vaciar la cartera de pruebas» sembraba vacío y a continuación el volcado escribía encima el estado de React de hace un momento, con todo dentro, en la clave de pruebas. Los tres botones del banco de pruebas pasan ahora por `mcRecargarSinVolcar`, que descarta ese volcado: lo que se acaba de escribir a mano es la verdad. Con su test.

**Por qué el guardián no lo cazó**, que es la parte que importa: `modo-inicial.spec.mjs` leía `localStorage.getItem("micartera_sandbox")` — justo la mitad que sí se vaciaba. Verde en CI y roto en su móvil. Corregido para leer por donde lee la app, más cuatro casos nuevos: vaciar con la clave partida ya creada, la cartera real intacta con sus gastos, entrar copiando los gastos, y tirar las dos mitades. 5/5.

## [4.19.23] — 2026-09-10
### Panel de pruebas: de uno en uno

- Un punto marcado ✓ o «no lo puedo probar» se **encoge a una línea** y el siguiente sin probar se trae solo a la vista (scrollIntoView centrado). Al marcar el último, el destino es el botón de veredicto.
- Un ✗ **no** se encoge: debajo lleva el «¿qué pasa exactamente?». Esconderlo sería tragarse lo único que hace útil un rechazo.
- Un punto encogido se reabre de un toque para repasarlo, con «▴ Volver a encogerlo» para cerrarlo otra vez. `itemOpen` (lo que abre a mano) manda sobre la regla automática.
- **Las tandas RECHAZADAS se encogen igual que las aprobadas**, petición suya del 10/9. Antes solo se plegaban las aprobadas y la rechazada se quedaba estorbando en medio de la lista.
- **Y volver al mismo sitio después de probar**, que es la otra mitad de la queja y la que no se ve leyendo el panel: para probar un punto TIENE que salir de la app, y Android le mata la WebView mientras paga o mira el widget. Sin esto, cada vuelta aterriza en Inicio y hay que rehacer Ajustes → Revisar la beta → bajar; con cinco puntos por tanda, cinco veces. La marca lleva la hora y caduca a las 2 h, y cerrar a propósito («‹ Ajustes» o el gesto atrás) la borra: esa es toda la diferencia entre «he salido a probar» y «he terminado». Idea de Codex en el voto del panel.
- 7 e2e nuevos en `revisar-beta.spec.mjs` (28/28 Chromium; 190/190 la suite entera). El test de la regla de aprobación se adaptó: rectificar un ✓ ahora pide reabrir el punto primero.

## [4.19.22] — 2026-09-09
### B2/B4/B5 del pulido

- **B2 SÍ**: count-up en el hero de Cartera vía bus `mcOnCarteraActive` (mismo patrón que Gastos; no toca el carrusel). Premontaje e IntersectionObserver se descartaron. `useCountUp` compartido. e2e en pulido-vacios con muestreo rAF.
- **B4**: tres `.v4-skel` tras splash y antes de `mc-boot-ready`. Sin brillo con reduced-motion.
- **B5**: tema claro — textos mint pequeños usan `--mint-ink`; party/goal-pct/empty con tokens.

## [4.19.21] — 2026-09-09
### Modo inicial: ver la app como recién instalada sin tocar la cartera real

- Petición suya, y con razón: el banco de pruebas **copia** la cartera real, así que no había forma de mirar las pantallas de estreno del pulido v4 (hero sin gráfico, tarjetas vacías, racha a cero). Sus palabras: «si no, te marcaré el 50% de las pruebas que no puedo reproducirlo».
- `mcSeedSandboxVacio()` siembra la cartera de PRUEBAS vacía. Nunca toca la real: escribe en `STATE_KEY_TEST` y punto.
- `onboarded:true` a propósito: con el onboarding delante te obliga a poner presupuesto y entonces la tarjeta vacía de presupuesto (P3) no se puede ver nunca. `budget:0` es justo el caso a probar.
- Dos puertas en Ajustes: «Probar con la app vacía» desde fuera y «Vaciar la cartera de pruebas» desde dentro. Bloque solo visible para el dueño (`is_admin`), como el resto del banco de pruebas.
- `e2e/modo-inicial.spec.mjs` cubre lo único que da miedo: que sembrar la vacía **no roce** `micartera_v3`. La fila de Ajustes no se cubre porque ese bloque no se pinta para un usuario que no sea admin, y el de los e2e no lo es.

## [4.19.20] — 2026-09-09
### Cierre del pulido: P9/P10/P14 + guardianes del histórico

- **P9** mantener pulsado el borrar del NumPad limpia en ráfaga.
- **P10** el separador decimal del teclado sale de `toLocaleString` del idioma activo, no de una coma fija.
- **P14 (opción C)**: el hero usa `clamp` + `overflow:hidden` + `text-overflow:ellipsis` cuando la cifra no cabe (yen, negativos, números muy largos). En euros grandes no se nota; el caso que sí se rompía era el de moneda de visualización.
- Guardianes tras NOTAS-BUNDLE: `novedades-vinnetas` lee `src/data/release-notes.json` (el módulo deja `RELEASE_NOTES=[]`); `season-detalle` comprueba `4.13.0.tandas:[]` en el JSON en vez del comentario `QUITADA` que vivía dentro del literal.
- Espejo `docs/memoria/` al día (`npm run memoria`).

- **B3** las filas que abren un panel (`.v4-charge`, `.v4-mov`) responden al toque con el mismo gesto que ya hacen los botones; con `prefers-reduced-motion` solo cambia el fondo.
- **B2** en esta entrada se anotó como no entregable vía observer/premontaje; se cierra en **4.19.22** con el bus de pestaña activa.
## [4.19.19] — 2026-09-09
### Pulido v4, P6–P13

- **P6** el anillo se dibuja: recibía el `strokeDashoffset` final y una `transition`, y una transición no anima el primer pintado. Se monta vacío y pasa al valor real en el frame siguiente, enganchado a `mc-splash-gone` para no gastarse detrás de la cortina. `prefers-reduced-motion` → valor directo.
- **P7** el % del anillo pasa a Fraunces 24/600.
- **P8** teclas a 56. Medido antes: a 360×667 el fondo del teclado ya caía en 855 px con las teclas a 46, así que el desbordamiento no lo trae este cambio.
- **P11** `focus-visible` en chips, teclas, CTAs, segmentos y filas de ajustes, no solo en la nav.
- **P12** degradado por la derecha y `scrollbar-width:none` en los carruseles.
- **P13** `opsz` de la Fraunces y `text-wrap:pretty` en las frases humanas.
- **P14** quedó pendiente en esta entrada (en euros no se reproducía el recorte); se cerró en **4.19.20** con la opción C del equipo.
- **NOTAS-BUNDLE**: el histórico de `RELEASE_NOTES` sale de `10-app-components.js` a `src/data/release-notes.json` (108 versiones). El build copia a `public/release-notes.json` y el index ya no arrastra el literal. `ensureReleaseNotes()` lo carga al montar (Novedades + panel de beta). `RELEASE_NOTES_MAX` vuelve a ser solo «cuántas enseña Novedades de entrada»: bajarlo no puede vaciarle la checklist. Medido: gzip **318 KB** / 330 (antes 330 clavado). `revisar-beta` 21/21 y la ronda tip→prod conserva las tandas (incluidas ventana-mes, tr-reactivo, id-fila…).

## [4.19.18] — 2026-09-09
### Pulido v4, P1–P5: el primer minuto de alguien recién llegado

- **P1** `Sparkline` devuelve `null` con menos de dos puntos: con `data=[]` pintaba una recta de lado a lado con su punto final, un gráfico que dice cero. Inicio reserva el hueco con una línea discreta.
- **P2** la pastilla del hero solo sale si el delta no es cero o ya hay histórico.
- **P3** sin presupuesto, Inicio enseña la tarjeta en vacío con CTA al `BudgetSheet` en vez de esconderla. **La otra mitad de P3 no aplica**: el onboarding de `beta` ya no usa placeholder, es un stepper con 700 preseleccionado y `finish()` fuerza un mínimo de 100.
- **P4** estados vacíos de próximos cargos y metas (spec §27), reutilizando una sola clase `.v4-empty` con el borde punteado que ya existía.
- **P5** con racha 0, «Tu primer mes empieza hoy» en vez de «0 meses sin pasarte».
- `e2e/pulido-vacios.spec.mjs`, 7 casos: cubren la app recién instalada, que era justo el estado que ningún test miraba, y que todo vuelve a la normalidad en cuanto hay datos.

## [4.19.17] — 2026-09-09
### El diálogo cuenta los Fijos agrupados, y un e2e cubre el cableado

- `doImport` anunciaba «¿Crear N recibos fijos?» con N = filas marcadas. Tras FIN-02 varias filas equivalentes crean UNO, así que la pregunta mentía. Ahora cuenta el resultado de `histFijosFromSelection`.
- `e2e/hist-pagos-mensuales.spec.mjs`: los tres meses del mismo recibo salen los tres y sin aviso de repetido; marcarlos como «Recibo» deja UN fijo en el estado guardado. Ejecutado en rojo contra el código anterior (los dos casos fallan) y en verde después.
- `destChip` gana `data-dest`/`data-cand`: las filas se pintan con estilos en línea y un e2e solo podía apuntar por posición. Mismo patrón que `data-ent` en Mis bancos.
- Fuera la pista de interfaz de `recibo-lote`, que ya no puede dispararse.

## [4.19.16] — 2026-09-09
### El histórico deja de descartar pagos de meses distintos

- `histClassifyCandidates` pasaba TODOS los candidatos por `dedupeHistRecibos`, que compara comercio + importe + banco **sin fecha**. Tres recibos iguales de junio, julio y agosto quedaban como uno: dos meses de pagos reales se pintaban desmarcados como repetidos al importar el histórico.
- El descarte por lote sale de la clasificación. El extracto del banco manda: si lista tres cargos, hubo tres cargos.
- La protección que ese guardo decía dar **no existía de verdad**: la pantalla (`runImport`) crea un Fijo por fila marcada, sin agrupar, y las filas descartadas se podían marcar a mano. Ahora `histFijosFromSelection` agrupa por la misma clave y varios «Recibo» equivalentes crean UN solo Fijo — que importa, porque un Fijo se cobra todos los meses para siempre en `monthNetForAccount`.
- Intactos: duplicado contra lo ya guardado (1:1, con día), coincidencia con Fijos/deudas/puntuales ya modelados, aviso de signo por banco y deshacer la importación.
- Regresión nueva `tests/hist-pagos-mensuales.test.mjs` (8 casos): 5 rojos antes del arreglo, 8 verdes después. `hist-import-dup` sigue en verde.

## [4.19.15] — 2026-09-09
### Cada cuenta arrastra sus propios gastos al cerrar el mes

- `reconcileTR` sumaba TODOS los gastos del mes cerrado y se los restaba a la cuenta de gasto diario, sin mirar `e.ent`. Una compra pagada del sobre de efectivo —o un recibo de otro banco— bajaba Trade Republic; el sobre no arrastraba nada porque `monthNetForAccount` no mira `s.expenses`. El patrimonio total cuadraba y por eso el fallo no se veía: los dos saldos por separado mentían.
- El reparto pasa a ser el mismo que usa el saldo que se pinta durante el mes (`gastoDelMesPorBanco`), para que el cierre no contradiga a la pantalla y el saldo del sobre no rebote el día 1.
- El sobre de efectivo arrastra sus propias compras al cerrar; los demás bancos siguen sin restar gastos, como hasta ahora.
- Regresión nueva `tests/efectivo-cierre.test.mjs` (11 casos) ejecutada en rojo antes del arreglo y en verde después.
- El round-up y el saveback del cierre se estiman ya sobre los mismos gastos que en vivo (`expenseCountsCash`). Antes se calculaban sobre el mes ENTERO mientras `11-app-main.js:1483` los filtraba: una compra con tarjeta de un banco que no es de gasto diario inflaba el round-up y el saldo de Trade Republic pegaba un salto el día 1. Divergencia vieja, encontrada por Cursor al revisar esta entrega.

## [4.19.14] — 2026-09-09
### Revisión plegable y auditoría de la ronda

- Cabeceras accesibles para plegar cada tanda sin cambiar marcas, notas ni veredictos. Aprobar la pliega automáticamente; se puede desplegar y cambiar de opinión.
- Recuperación de aprobaciones entre compilaciones por id de tanda, siempre que todos los textos sigan marcados. Al responder Pages se recupera también el progreso de las tandas antiguas: el estado inicial solo conocía la última versión.
- `BankHistoryImport` deshacía sobre el `state` capturado antes de la confirmación. Reproducido en navegador: presupuesto actualizado de 100 a 777 volvía a 100, perdiendo también un gasto ajeno. Ahora calcula sobre el estado del updater.
- El reintento del borrado se guarda antes de pedirlo a la nube, sobrevive al cierre y solo se limpia tras éxito. Un pull durante el borrado no resucita filas confirmadas como borradas; la respuesta tampoco pisa una importación posterior.
- `deleteExpensesByIds` rechaza si falta cliente o sesión: resolver sin borrar provocaba un falso éxito. Regresión ejecutada en rojo y verde.
- Auditoría y pendientes en `docs/briefs/AUDITORIA-CODEX-2026-09-09.md`. OTA, sin APK ni despliegue de Supabase. Producción sigue pendiente de aprobación.

## [4.19.13] — 2026-09-09
### Un límite por categoría (idea 5.2, la que su pareja usaría seguro)

- Desglose del mes por categoría en Gastos, de más a menos. **No existía nada parecido en la app**:
  esa era la mitad del trabajo.
- Límite opcional por categoría con su barra. `state.categoryBudgets` llevaba desde julio
  inicializado en dos sitios, con el comentario «límites €/mes por categoría (§5)», **y no lo leía
  nadie**: un objeto vacío que viajaba a la nube en cada guardado sin hacer nada. Esta tanda le da
  uso; no hubo que migrar nada.
- `categorySpentByMonth` usa la MISMA ventana y la MISMA regla que la cabecera
  (`inicioDeMesMs` + `hastaMs` + `expenseCountsBudget`), no un segundo `forEach` con criterio
  propio. Medido con fixture: cabecera 140,71 y suma del desglose 140,71. Si no cuadrara, el
  desglose mentiría y sería peor que no tenerlo.
- Las neutras (inversión, traspaso) y los bancos que no cuentan para el presupuesto quedan fuera
  del desglose, igual que de la cifra de arriba. Verificado.
- Una categoría con límite y sin gasto este mes se ve a 0; si desapareciera parecería que se ha
  borrado el límite.

**Decisiones que acotan la tanda, a propósito:** el límite es INFORMATIVO —no resta del
presupuesto general, no bloquea, no cambia «lo que puedes gastar»— y **no hay avisos**. Los avisos
del presupuesto los manda el `ingest`, así que meter ahí los límites por categoría obligaría a
desplegar la Edge Function del Supabase compartido, que es de producción también, y a duplicar la
regla en dos sitios otra vez. Primero que lo vea y decida si los quiere.

**El desglose rompía el arrastrar-para-ordenar, y lo cazó el e2e.** La cabecera más alta dejaba
la lista fuera del alcance del gesto (`elementFromPoint` apuntaba al sitio equivocado), así que
`gastos-orden` —una tanda que él todavía no ha probado— se habría publicado rota. Filas más
compactas y la espera del test acotada: 163/163.

Al compactarlas se quitó el «Sin límite · tocar para poner» de cada fila, y con él la única pista
de que la fila se puede tocar. La pista vuelve UNA vez en la cabecera de la sección («Por
categoría · toca una para ponerle un límite») en vez de una por fila: se conserva la altura
ganada y no se pierde el gesto. La cadena que quedaba sin usar se ha retirado.

OTA; sin Android; sin migraciones.

## [4.19.12] — 2026-09-09
### El resumen del mes cerrado, en Inicio (idea 5.3.3, la favorita de su pareja)

- Tarjeta en Inicio los primeros días del mes con el resumen del mes **anterior**: gastado contra
  presupuesto, categoría que más se llevó y ahorro real. Botón para compartir la imagen de ESE mes.
- Se descarta y no vuelve; la decisión va en `settings`, así que tampoco vuelve en otro móvil.
  Al cerrar el mes siguiente aparece otra vez, con el mes nuevo.
- **El export ya existía** (`shareMonthReport`): solo hubo que decirle de qué mes va. La idea
  5.3.6 estaba hecha desde hace tiempo.

**El aviso del día 1 YA EXISTÍA y estaba mal.** Se hizo el 2026-07-15 para su pareja, y pintaba
`totals.thisMonthSpent`: el gasto del mes que **acababa de empezar**, o sea casi siempre 0 €. Por
eso él lo volvió a pedir. Sustituido por la tarjeta del mes cerrado.

**La trampa que había que cerrar antes de codear** (encontrada leyendo el código, no probando):
`monthBudgetStats(state, nowMs)` solo tenía tope INFERIOR —`if(dateMs(e.date) < startMs) return;`—
así que no calculaba «ese mes» sino «desde el día 1 de ese mes en adelante». Un informe de agosto
hecho con eso habría sumado agosto **más septiembre y todo lo posterior**: una cifra inventada y,
peor, parecida a la buena. Medido con el fixture: 100 con tope, **600 sin él**.

Cierre: tope superior OPCIONAL (`hastaMs`), por defecto infinito, para que Inicio, la cabecera de
Gastos y el envío al widget den exactamente lo mismo que antes. `reservedSince` acota igual.
`presupuesto-servidor` sigue verde: cliente y servidor cuentan lo mismo.

OTA; sin Android; sin migraciones.

## [4.19.11] — 2026-09-09
### Import histórico, tanda 4: puertas y avisos

Cierra el plan `plan-import-historico-seguro.md`. Con esto los cuatro agujeros (A, B, C, N) y la
tabla de «importantes» quedan cerrados.

- **Puertas (K):** «Importar histórico» sale de Ajustes → Mis bancos y vive en Ajustes →
  Importaciones, junto al resto. El e2e `bancos-historico-filtro` se **migró** a la ruta nueva —no
  se borró— y hay un test de que Mis bancos ya no lo ofrece.
- **O:** `pullExpenses` tiene un tope de 2000 filas que hasta ahora truncaba **en silencio**. Esta
  feature lo hace alcanzable de verdad, así que al llenarse se marca y se avisa. Callarse es lo
  que convierte un límite en un bug de datos.
- **L:** el botón de deshacer ya no depende solo de que `lastHistImport` exista: exige que queden
  filas locales del lote. Tras un pull, un botón que no puede deshacer nada no sale.
- **D:** fuera el nombre fantasma `expenseCountsForDaily`; se usan `expenseCountsCash` /
  `expenseCountsBudget`. **M:** el texto de confirmación de un fijo sin inicio ni fin dice que
  resta todos los meses, también hacia atrás, con test de las tres fuentes de idioma.

**Choque entre dos arreglos, cazado en revisión:** la regla de L dejaba invisible el botón justo
en el estado que crea el reintento de 4.19.9 —cuando el borrado en la nube falla, lo local ya se
quitó—, así que el aviso «vuelve a deshacer» aparecía sin botón. Simulado y confirmado: `false`
donde tenía que ser `true`. Los dos arreglos eran correctos por separado; faltaba distinguir
«no queda nada que hacer» de «queda trabajo pendiente en la nube». Ahora el fallo marca el lote
como `cloudPending` y `histCanUndo` lo respeta. Dos tests, uno por caso.

OTA; sin Android; sin migraciones.

**Y las categorías, que también estaban escritas dos veces sin test cruzado.** `autoCategory()`
(cliente) y `categorizar()` (`ingest_logic.ts`) llevan ~700 palabras clave cada una: si una compra
entra por notificación la clasifica el servidor, y si la apunta a mano o la reclasifica la app, el
cliente. Misma familia que el bug de los 965 €.

- `tests/categorias-dual.test.mjs` **no** usa una lista fija de comercios (envejece y no cubre lo
  que se añada mañana): SACA las palabras clave del propio fichero del servidor —688 hoy— y exige
  la misma respuesta a los dos lados. Añadir una clave a un solo sitio pone el test en rojo solo.
- Comparado `categoryOfNewMerchant` y no `autoCategory`, porque el servidor solo clasifica altas
  nuevas y el cliente detecta ahí el cajero, que a propósito NO detecta en `autoCategory`.
- **Encontró una divergencia real a la primera:** «DOUGLAS» a secas estaba solo en la lista del
  servidor (`regalos`); el cliente lo dejaba en `otros`. El mismo comercio caía en dos cajones
  según por dónde entrara. Añadido al cliente; «Douglas Perfumerías» sigue en `compras` en ambos.
- Se blinda además que `autoCategory` siga SIN detectar el cajero: si eso se rompe, la migración
  le convertiría las retiradas viejas en traspaso y le bajaría meses ya cerrados.

## [4.19.10] — 2026-09-08
### Efectivo: una cuenta más, no un módulo nuevo (tanda 6)

Diseño cerrado con él el 18/8, desbloqueado ahora: dependía del bug 1c del saldo cruzado, que ya
está cerrado (`saldoCuentaGasto` / `valueDesdeSaldo` en los cinco sitios, `saldo-por-banco` verde).

- `ENT.efectivo` es una cuenta normal: **nunca** Open Banking, **nunca** cuenta de gasto diario.
- El sobre **descuenta sus propios gastos**, porque no hay banco que lo re-ancle por IBAN.
- **Alcance acotado a propósito (decisión de integración):** la resta se aplica solo a
  `ent === "efectivo"`, NO a «toda cuenta sin `bankIban`» como proponía el plan. Una cuenta manual
  suya sin Open Banking tampoco tiene IBAN, y hoy la ajusta a mano: restarle además los gastos le
  duplicaría el ajuste y le movería saldos que le cuadran. El caso general queda como decisión
  pendiente suya, escrita en el brief. Y Trade Republic no pasa por OB a propósito, así que sin
  acotar habría descontado sus gastos DOS veces: hay test.
- «Saqué del cajero» reusa `traspaso`, que ya es neutra: mueve dinero de sitio y no cuenta como
  gasto del mes. Aviso si el sobre se queda en negativo.

**Lo que se bloqueó en revisión y hubo que rehacer:**

- **Le recategorizaba el histórico.** La detección de cajero entró en `autoCategory`, y hay una
  migración que corre EN CADA CARGA y recategoriza todo lo que esté en «otros» y no sea manual.
  Comprobado ejecutando: `autoCategory('RETIRADA CAJERO 4B')` daba `traspaso`, que es NEUTRA, así
  que sus retiradas viejas habrían dejado de contar como gasto y le habrían bajado los totales de
  meses ya cerrados, sin avisar. Es exactamente lo que él decidió que NO en la categoría de IA.
  Ahora la detección vive en `categoryOfNewMerchant`, solo para altas nuevas; `autoCategory`
  devuelve `otros` para un cajero, con test.
- **La regla estaba escrita dos veces y solo se probaba una** (cliente y `ingest_logic.ts`).
  `tests/atm-dual.test.mjs` carga LAS DOS y les exige la misma respuesta sobre una lista común.

**LÍMITE — esto NO viaja entero por OTA.** La detección de cajero del servidor está en la Edge
Function del Supabase **compartido por beta y producción**. Sin desplegarla, el móvil detecta el
cajero y el servidor no: una retirada que entre por notificación puede seguir contando como gasto.
Desplegar afecta a producción y **necesita su autorización**. El guion de la tanda se lo dice.

OTA (parcial, ver límite); sin Android; sin migraciones SQL.

**Y una sugerencia suya del 26/7, por fin atendida:** «que el histórico de actualizaciones sea en
todos los idiomas, no solo español». La 4.18.5 no tenía `items`, así que Novedades caía a los
puntos de su tanda —un array plano en castellano— y un familiar en inglés o catalán veía el texto
español. Era la única versión del bundle así. Guardián `tests/novedades-idiomas.test.mjs`, en rojo
antes: nombraba `4.18.5 (en)` y `4.18.5 (ca)`.

**Y una divergencia cliente/servidor que encontró un test nuevo a la primera:** los dos espejos
que solo estaban cubiertos DE REBOTE (`accRole`/`rolDeCuenta` y `reservedSince`/`reservadoDesde`)
ahora se comparan de frente. Al hacerlo saltó que una fecha corrupta en `reservaLog` se contaba
en el cliente y no en el servidor: `dateMs()` devuelve `Date.now()` cuando no entiende el texto,
así que la reserva rota se colaba como si fuera de HOY y la app enseñaba MENOS presupuesto que el
widget. Ahora `reservedSince` exige una fecha válida, igual que el servidor. Ante una reserva que
no sabemos de cuándo es, no se inventa que es de este mes.

## [4.19.9] — 2026-09-08
### Import histórico, tanda 3: el agujero A cerrado

El grave del plan, el que podía borrarle un gasto bueno para siempre: `cloud.addExpense` sube con
`onConflict` por TERNA e `ignoreDuplicates`, y `cloud.deleteExpense` borra por esa MISMA terna. Si
la importación chocaba con un gasto que ya tenía, el upsert no creaba fila y un «Deshacer» por
terna le borraba el ORIGINAL.

- **Camino nuevo y paralelo**, sin tocar `addExpense`, `deleteExpense` ni `expenses_dedup_idx`:
  `cloud.addExpensesBatch` sube el lote con `.select('id')`. Con `ON CONFLICT DO NOTHING …
  RETURNING id`, Postgres **solo devuelve las filas realmente insertadas**: las que chocaron no
  vuelven, sus ids no existen y el undo no puede tocarlas ni queriendo.
- `cloud.deleteExpensesByIds` borra **solo por uuid**, con `.eq('user_id')` y `isExpenseUuid` de
  colador. Nunca por terna, nunca lápidas en `state.deleted` (agujero B).
- Sin ACK del servidor no se persiste en local y **se avisa** en vez de dejarlo a medias.
- **Endurecido en revisión (Claude):** `histApplyBatchAck` devolvía los ids CRUDOS del servidor,
  que viajaban a `lastHistImport` → undo → `deleteExpensesByIds`. Si PostgREST llegara a devolver
  alguna vez el id de una fila preexistente, el undo se la habría llevado: el agujero A otra vez
  por una puerta más estrecha. Hoy no es explotable, pero la seguridad no puede depender de que
  el servidor se comporte como suponemos. Ahora `cloudIds` sale de lo que NOSOTROS enviamos y el
  servidor confirmó (`kept.map(e => e.id)`), así que un id ajeno no puede llegar al borrado.
  Guardián: «A: ACK — id ajeno del servidor no va a cloudIds ni a undo», comprobado en rojo antes.
- Botón de deshacer en la pantalla del import, con confirmación e idempotente.
- **Y el borrado en la nube se ESPERA** (segunda pasada de revisión, Cursor): iba a fuego y
  olvido con un `.catch` vacío y el ✓ de «deshecho» salía igual. Como el undo no escribe
  lápidas —a propósito—, lo único que impide que esas filas vuelvan es que la nube las haya
  borrado de verdad: si el DELETE fallaba, el siguiente pull se las devolvía y él veía
  reaparecer lo que acababa de deshacer, con un ✓ en pantalla. Ahora el toast de hecho solo
  sale si la nube confirma, y si no, se le dice que vuelva a deshacer con cobertura.
  Decirle «si vuelve, avísame» habría sido pasarle a él un defecto nuestro.
- Y si la nube falla, se le DEVUELVE el botón de deshacer (tercera pasada, Cursor): el aviso le
  decía «vuelve a deshacer» con el botón ya desaparecido, porque `lastHistImport` se ponía a null
  antes de la promesa. Un mensaje que pide algo imposible es peor que no avisar. El segundo toque
  reintenta solo el borrado en la nube; lo local ya estaba quitado y no se vuelve a tocar.

OTA; sin Android. Sin migraciones: no se ha tocado el esquema.

## [4.19.8] — 2026-09-08
### Import histórico: tandas 1 (motor) y 2 (UI segura)

Las dos primeras tandas de [`plan-import-historico-seguro.md`](docs/briefs/plan-import-historico-seguro.md).
Es lo que más le importa del inventario, y hasta hoy el import **no era seguro**: cuatro agujeros
auditados. Estas dos cierran motor y UI; **el agujero A sigue abierto** (ver límite abajo).

**Motor (Cursor, tanda 1):**
- `histCandExisting` dedupea **1:1**, como `usadoDup` del sync diario (agujero H): dos candidatos
  contra UN guardado marcan uno, no los dos. El mapa 1:N mentía en el preview.
- `reconcileObDupes` deja de mirar `ob-hist` (agujero N): corría en cada vuelta a primer plano y
  deshacía el preview por detrás, porque `sinNombre` casa «Ingreso», que es como el histórico
  etiqueta los ingresos en castellano.
- `histClassifyCandidates` clasifica como el sync diario (agujero C): traspaso propio →
  `traspaso`, aporte ≈ `monthlyInvest` → `inversion`. **Solo la categoría**, nunca
  `applyInvestBuy`, que duplicaría la cartera.
- `histUndoBatch` no escribe NUNCA en `state.deleted` (agujero B): una lápida
  `fecha|importe|comercio` dejaría fuera para siempre gastos reales con esa clave. Undo = quitar
  del array local + borrar por **id**.
- 8 casos en `tests/hist-import-dup.test.mjs`, verificados en rojo antes.

**UI (Cursor, tanda 2):**
- **Híbrido C: «Recibo» deja de ser el destino por defecto.** Era lo que creaba tres fijos
  idénticos —cobrados cada mes, para siempre— al aceptar un lote de 3 meses. Ahora Gasto o
  Ingreso, y si él marca alguno como Recibo se le **pregunta** antes de crear ningún fijo.
- Los duplicados salen tachados con el motivo (ya guardado / ya modelado / repetido en el lote).
- Banners de truncado del banco y de signo sospechoso (>70% ingresos en un banco, ≥3 movimientos).
- Tope de render de 60 filas con «Ver más»: un lote de 3 meses tiraba la WebView.
- Un banco fuera del catálogo ya no se descarta en silencio (agujero E) — su queja de «gastos que
  no entran». Se le enseña el nombre que manda el banco, nunca la clave interna.

**LÍMITE, y va sin adornos:** el **agujero A** —«Deshacer» borrando por terna podía cargarse un
gasto preexistente— NO está cerrado. El helper solo borra por ids confirmados, pero la garantía
real es el batch con `.select('id')`, que es la tanda 3. Hoy no hay botón de deshacer, así que
no es alcanzable; no publicar uno hasta que la 3 esté dentro.

OTA; sin Android.

## [4.19.7] — 2026-09-08
### Lo que él ya aprobó no puede volver al panel

Bug suyo, el mismo día: «todo lo que probé y marqué como aprobado me salta otra vez». Por la
mañana aprobó cinco tandas y por la tarde le volvieron a salir sin aprobar. **Lo metí yo en la
4.19.6**, al retirar del panel las tandas aprobadas.

- Causa: al aprobar una tanda se QUITA del array `tandas` de su versión. Al quitar la última
  quité también la propiedad entera, y `betaTandas()` trata «sin `tandas`» como «versión antigua
  que nunca las declaró» → devolvía UNA tanda con todo dentro. La versión resucitaba como
  `4.19.5/todo`, un id que ya no casaba con el veredicto que él había dado.
- Arreglo: `tandas:[]` (vacío) y «sin `tandas`» dejan de ser lo mismo. Ausente → tanda `todo`,
  para que las ~70 versiones del histórico sigan funcionando. Vacío → cero tandas.
  `4.19.5`, `4.19.4` y `4.19.3` recuperan la propiedad, vacía.
- Guardián `tests/beta-tandas-vacias.test.mjs`, registrado en el runner: no comprueba constantes,
  le pregunta al panel qué pintaría sobre la ronda real. Verificado en rojo antes del arreglo,
  nombrando las tres que volvían (`4.19.5/todo`, `4.19.4/todo`, `4.19.3/todo`).

OTA; sin Android.

## [4.19.6] — 2026-09-08
### El gasto del mes cuadra: posible repetido, widget al volver y categorías neutras (B09-D)

#### El posible repetido tampoco cuenta en el servidor

- **La decisión viaja.** `possibleDup` solo existía en el móvil: la app lo dejaba fuera del total
  del mes y el `ingest` —que solo lee `fecha/importe/comercio/cat/source`— lo sumaba. Con 30 + 10
  y un posible repetido de 30, la app decía **40** y el servidor **70**: de ahí que el widget
  enseñara más gasto que Inicio.
- La marca se codifica DENTRO de `source` (`ob:trade_republic#dup`), igual que el banco. **Sin
  migración** en el Supabase compartido y viaja por OTA.
- **Sufijo y no prefijo nuevo, a propósito** (objeción de Codex, correcta): un `ob-dup:` es una
  cara desconocida para el servidor viejo, que lo leería como «sin banco» → «a mano» → lo SUMARÍA.
  Con el sufijo, el servidor viejo lee el banco `trade_republic#dup`, no lo encuentra en la lista
  de gasto diario y lo EXCLUYE. El fallo degrada al lado seguro y el arreglo no depende de
  desplegar la función.
- Escritura y lectura, no solo escritura: `expenseSourceForCloud` la emite, `expenseFromRow` la
  recupera (sobrevive a pull, reinicio y segundo móvil) y `cloud.setExpenseDup` la quita al pulsar
  «son distintos» —tocar solo el estado local no arregla nada.
- **LÍMITE, y es importante:** los posibles repetidos que YA estaban en la nube antes de esta
  versión siguen contando en el servidor hasta que él los resuelva. Escribí un repaso que los
  re-marcaba desde el móvil y lo RETIRÉ tras la revisión de Codex, que reprodujo dos defectos
  reales: (1) si un móvil ya resolvió «son distintos», otro móvil con la marca aún puesta en local
  no puede distinguir «fila vieja» de «decisión tomada» y DESHACÍA la decisión; (2) la fila remota
  puede tener otro uuid que la local (por `ignoreDuplicates`), con lo que el UPDATE afecta a cero
  filas sin dar error y lo daríamos por persistido. Hacerlo bien exige identidad fiable y ACK: es
  el bloqueo de identidad de gastos, no un parche de esta ronda.
- No viaja `possibleDupOf`: tras reinstalar, «es el mismo» sigue borrando la fila OB pero ya no
  traspasa el `extId` al gemelo.
- Guardianes en `tests/presupuesto-servidor.test.mjs`: los cuatro casos cargan LAS DOS
  implementaciones. Comprobado en rojo antes del arreglo (servidor 70 contra app 40).
- Panel de beta: fuera las cinco tandas que aprobó el 8/9 (`notas-20`, `arranque-suelto`,
  `panel-ronda`, `multicuenta`, `posible-repetido`).


#### Widget al reactivar Android y categorías neutras al descargar gastos

- El efecto de envío al widget escucha también `App.appStateChange` además de
  `visibilitychange`. Reproducción: ingest sobrescribe el snapshot; al volver solo por evento
  nativo y no cambiar las cifras locales, antes no se reenviaba nada. Se libera el listener
  incluso si su registro devuelve una promesa que resuelve después del cleanup.
- `resolveCategory` conserva `inversion` y `traspaso`, como ya hacía con `ingreso`. Están fuera
  de `CAT`: `expenseFromRow` las reinterpretaba por comercio y podían convertirse en `otros`,
  inflando el gasto al descargar la nube. No se recategoriza el histórico ni se escriben filas remotas.
- Regresiones en `persistencia.spec.mjs` (ya CROSSCUTTING): puente nativo simulado sin evento
  DOM de visibilidad y pull de filas neutras que abre Inicio/Gastos. Ambas fallaban antes del fix.
  `presupuesto-servidor` comprueba además el roundtrip real por `expenseFromRow`.
- **Límite:** no resuelve que la decisión `possibleDup` no llegue a ingest ni arbitra respuestas
  tardías del servidor; esos caminos siguen en B09-D. Tampoco repara categorías históricas ya
  sobrescritas.

Todo OTA; sin Android y sin desplegar Supabase.

## [4.19.5] — 2026-09-07
### Novedades: solo las 20 últimas en el bundle

- **`RELEASE_NOTES_MAX=20`** + truncado en `build-app.mjs` (`scripts/release-notes-max.mjs`):
  la fuente puede seguir creciendo; el OTA solo lleva las N más nuevas. El slice en runtime
  no bastaba (el literal seguía en el HTML). CHANGELOG.md guarda el histórico entero.
- Guardianes: `tests/release-notes-max.test.mjs` (N clavado en 20; ronda tip vs 4.18.7 no
  pierde tandas por el recorte).
- **Presupuesto bundle BAJADO** tras medir: minificado 1180 KB / gzip 330 KB (antes 1240 / 350).
  Medido tras el corte: ~1145 / ~319 KB.

OTA; sin Android.

## [4.19.4] — 2026-09-07
### Premontado de pestañas: no ahogar el idle con la ventana de mes

- **Causa (CI 34155106775 en 4.19.2):** `inicioDeMesMs` recreaba `Intl.DateTimeFormat` y hacía
  búsqueda binaria en cada llamada; `totals` (y otros filtros) invocaban `startOfMonth()`
  **dentro** del `.filter` por cada gasto. Con ~1200 movimientos y CPU×6 el hilo no liberaba
  idle → solo 2 pestañas montadas tras 6 s (`e2e/rendimiento-tabs`).
- **Fix:** cache de formatters + `ym→ms` en cliente e ingest; `startOfMonth()` una vez antes
  del bucle en `11-app-main`, `02-ui-shared`, `13-hogar`, `08-motor-bank`, `06-sync-brokers`.
  Semántica de B09-B intacta (`month-window` sigue verde).

OTA; sin Android. Edge Function sin redespliegue (misma ventana, solo cache).

## [4.19.3] — 2026-09-07
### Panel «Revisar la beta»: ronda entera + pasos

- **`betaChecklist(version, prodVersion)`:** con prod conocida junta las tandas de todas las
  versiones `> prod` y `≤` la que corre (orden nueva→vieja, título `vX.Y.Z · …`). Sin prod,
  comportamiento de siempre (una sola versión).
- **`useProdVersion`:** Pages cruda; panel y fila de Ajustes comparten el mismo pack.
- Tandas de 4.19.0–4.19.2 reescritas como pasos (dónde / qué / qué pasa); B09-A2 entra como
  tanda de 4.19.1. Novedades de familia intactas.
- Guardián e2e: ronda vs una versión; concatenación plana = tandas.

OTA; sin Android.

## [4.19.2] — 2026-09-07
### Ventana del mes alineada (app = widget)

- **`inicioDeMesMs`** compartida (Europe/Madrid) en cliente (`01-i18n.js`) e ingest
  (`presupuesto.ts`). Antes el cliente usaba hora local del dispositivo y ingest `Date.UTC`:
  una compra el día 1 a las 00:30 en España caía en meses distintos.
- `monthBudgetStats` y la query de mes de ingest usan esa ventana.
- Guardián dual: `tests/month-window.test.mjs` (bordes 00:30 y 23:30, reloj fijo).

OTA; Edge Function `ingest` redesplegada con el canal. Sin Android.

## [4.19.1] — 2026-09-07
### Identidad de fila en gastos (escrituras por uuid)

- **Altas nuevas:** `mcExpenseId()` (crypto.randomUUID + getRandomValues v4 + fallback) en
  OB, manual, Apuntar, ob-hist e import hoja. `uid()` global intacto (metas/deudas/cuentas).
- **`addExpense`:** manda `id` cuando es uuid → local = nube desde el nacimiento.
- **Cinco escrituras** (`setExpenseBank/NoCard/Note/Cat`, `deleteExpense`): `.eq('id', …)` si
  uuid; si no, fallback eterno por fecha|importe|comercio (ids cortos del móvil).
  Si faltan fecha o importe en la rama attrs, **abort** (cero queries): evita un DELETE
  solo por `user_id` que vaciaría la tabla.
- **Upsert** `ignoreDuplicates` + conflicto por atributos: comentario; el pull sigue adoptando
  `r.id`. Sin tocar el índice unique (ticket aparte / Codex).
- Guardián: `tests/expense-id-cloud.test.mjs`.

OTA; sin Android.

## [4.19.0] — 2026-09-07
### Sincronización coherente de TR, movimientos completos, categoría IA y orden manual

- **Saldo de Trade Republic:** el sincronizador general ya aplica `availableCash` con el mismo
  `applyTrCash` que la tarjeta específica. Antes actualizaba posiciones pero descartaba el efectivo.
- **Movimientos multicuenta:** `flattenBankTx` consume todas las listas
  `accounts[].transactions` y usa el bloque superior solo para el contrato antiguo.
- **Posible repetido (no descarte):** `importObExpenses` ya no tira un OB sin nombre por
  coincidir importe ±3 días con otra vía. Si casa 1:1 con la misma entidad (`expenseBankOf`),
  entra marcado (`possibleDup`) y no cuenta en cash/presupuesto hasta que se resuelva
  («es el mismo» borra la OB + lápida; «son distintos» quita la marca). Cross-banco no marca.
  Dedup exacto por `ext_id` / `kOf` intacto. Guardianes: `ob-renombrar`, `invest-category`.
- **Estado de TR reactivo:** verificar, sincronizar, caducar o desconectar emite `mc-tr-status`,
  por lo que Ajustes y Cartera cambian sin reiniciar la app.
- **Categoría IA:** ChatGPT, Claude, Cursor y equivalentes se clasifican como `ia` en cliente,
  ingest y sugerencias, con textos es/en/ca. Solo aplica a movimientos nuevos: el histórico espera
  a que `setExpenseCat` escriba por ID estable y no por atributos.
- **Orden de Gastos:** asa táctil y `settings.expenseOrder` por día. No inventa horas ni modifica
  `date`; el E2E cubre gesto, DOM, persistencia, recarga y fechas intactas.
- **Presupuesto bundle:** tope minificado 1240 KB / gzip 350 KB (notas + UI de orden).

Guardianes: `tr-open-banking`, `categories`, `ingest-classify`, `ob-renombrar`,
`e2e/brokers-selector.spec.mjs` y `e2e/gastos-orden.spec.mjs`. OTA; sin Android.

## [4.18.7] — 2026-09-06
### Cabecera de Gastos: deps de bancos/rol (B09-A)

`monthSummary` en `04-tab-gastos.js` memorizaba `monthBudgetStats(state)` sin depender de
`state.accounts` ni `state.settings`, aunque la cifra lee `expenseBankEnts` (rol diario +
`expenseBanks`). Cambiar bancos de gasto diario dejaba el total del mes alto hasta que un sync
mutaba `expenses`.

**Por qué:** el listado filtrado ya invalidaba bien; la cabecera no. Familia: «gastado de más y
se corrige al sincronizar». Auditoría: `diarioEnts` / `bankOpts` / `filtered` ya traían
accounts+settings; solo faltaba `monthSummary` (ahora `state.settings` entero, no solo
`gTotalMode`).

Guardián: `e2e/gastos-cabecera-bancos.spec.mjs` (quita Revolut de gasto diario sin sync →
`aria-valuenow` 100→30). OTA; sin Android. B09-B/C (UTC, widget) fuera.

## [4.18.6] — 2026-09-06
### Contención: sin DELETE/lápidas automáticas por similitud (1d-CONTENCION-A)

`reconcileObDupes` ya no marca para borrar ni entierra (lápida `día|importe|comercio`) los
apuntes OB sin nombre que casan importe ±3 días con otra vía. `fixMovInvasion` deja de hacer la
misma limpieza histórica. El caller de `syncCloudExpenses` ya no llama `cloud.deleteExpense` por
esos candidatos; solo persiste recategorizaciones (salida de cashback → `inversion`).

**Por qué:** esa heurística confundía operaciones distintas (incluso entre bancos) y podía borrar
evidencia en la nube. No cierra el contrato de identidad ni recupera filas ya ausentes; gemelos
reales Wallet/TR pueden verse/contarse temporalmente. `importObExpenses` / `mergeExpenses` /
índice / migraciones quedan para tickets siguientes. Nota: `setExpenseCat` aún empareja por
atributos — migrar a ID de fila antes de tocar el índice.

Ajustes pre-merge: comentario único en reconcileObDupes; RELEASE_NOTES con items es/en/ca; docs sin afirmar canal sin salud.

Guardianes: tests en `invest-category` (cruce bancos, cashback conservado, cero `borrar`) y
`presupuesto-servidor` (app = servidor en fixture cross-source). OTA; sin Android.

## [4.18.5] — 2026-08-18
### El fondo dejó de parpadear al cambiar de pestaña (y los gestos de quien estrena la app)

**El parpadeo.** Al arrancar el gesto de pestañas, una regla pintaba `.page` con el fondo **plano**
`var(--bg)` («refuerzo opaco», para que no se fusionaran las tabs). Ese plano tapaba el
`radial-gradient(130% 55% at 85% -8%, …)` del `body`, que es lo que ilumina la esquina superior
derecha — y el fondo se oscurecía de golpe.

Medido en su OnePlus 13 a 120 fps con el grabador nativo, **12 gestos de 12**: −16 niveles de
luminancia arriba-derecha, −8 a la izquierda, durante 1–3 frames (8–25 ms), y con el movimiento en
pantalla a **0,00** en el frame anterior (o sea, antes de que nada se moviera). La proporción entre
esos dos números es la forma del degradado, y fue lo que lo delató.

Explica por qué la saga duró nueve intentos: el degradado es del **tema base**, no de temporada, así
que se veía **también con Temática Ninguna** — y cada arreglo tocaba `.season-glow`, que nunca fue el
culpable. La antifusión que la regla decía proteger la dan `visibility:hidden` en reposo y que las
páginas son hermanas `flex` (no superpuestas) durante el arrastre. Guardián invertido en
`season-detalle` para que no vuelva.

**Descartado por el camino, con medida:** promover la capa del track en `touchstart`
(`will-change:transform`) no cambió nada (−16 antes, −16 después) **y rompió el scroll**, porque
`will-change:transform` crea el mismo containing block que `transform` y el `position:fixed` del
host pasó a referirse al track. Ya estaba avisado en el propio fichero desde el 5/8.

**Los gestos de quien estrena la app.** `App` sale por `return` antes del `.viewport` si arranca en
el candado o el onboarding, así que el efecto que ata los listeners encontraba `null` y, con `[]`,
no lo reintentaba nunca: la app quedaba **sin un solo listener de gestos** hasta cerrarla y reabrirla.
Medido con CDP (`.viewport` con 0 listeners). Mordía a su padre y a su pareja su primer día.

## [4.18.4] — 2026-08-18
### Cada banco descuenta lo suyo (saldo cruzado)

`dynBal` restaba `thisMonthSpent` entero (todos los bancos de gasto diario) al saldo de la
cuenta diaria. Al marcar Revolut + TR, un cargo de Revolut bajaba Trade Republic y no se
descontaba de Revolut: **257,17 €** medidos en su nube el 18/8. El patrimonio pintado salía
bajo; el widget «Puedes gastar» (`safeLiq`) también.

Arreglo estrecho: la diaria resta solo lo suyo (`gastoDelMesPorBanco` + `saldoCuentaGasto`).
Las cuentas ancladas por IBAN no se tocan — el banco ya descontó. A mano sin banco sigue
saliendo de la diaria. La fórmula y su inversa (`valueDesdeSaldo`) viven en `00-core.js`;
los cinco sitios (dynBal, applyAccountRole, Cartera editar, sync TR) llaman ahí. Si se
cambia solo dynBal, teclear el saldo guarda un número torcido.

`thisMonthSpent` no se toca (Hogar / fallback de presupuesto). OTA, sin APK.
Tests: `tests/saldo-por-banco.test.mjs`.

## [4.18.3] — 2026-08-18
### Saldo OB inventado + widget APK 41/42

El Revolut del padre salió a **−204,54 €** (captura 18/8, «del banco») y al sincronizar pasó a
22,06 €. `pickBankBalance` prefería un ITAV/XPCD negativo y, si no reconocía el tipo, caía a
`balances[0]`. Ahora: tipo desconocido → `null` (se queda el saldo de antes); si el elegido es
<0 y hay otro ≥0, se usa el ≥0. Tests en `finance-core`.

El widget con la app cerrada **no podía** cuadrar «Puedes gastar» en la APK 41: el Java de
producción solo lee `afford`, y el OTA de `beta` ya mandaba `budgetLeft`/`safeLiq` y el plugin
41 borra `afford` → la línea desaparece. El cliente vuelve a mandar **las dos** (41 y 42).
La APK **42** lleva el Java que recalcula con la noti (`saveMonth` + `budgetLeft`).
`apk:prep` ya no llama `npx cap` (npm resolvía el paquete vacío `cap@0.2.1`).
`apksigner.bat` hereda `JAVA_HOME` del script (si no, verify moría con «JAVA_HOME is not set»).

## [4.18.2] — 2026-08-17
### El widget cuenta como la app (ingest, sin APK)

El canal beta no sirve para probar el widget con la app cerrada: hay un solo proyecto Supabase
y `TrExpenseListener` pide el mes a `ingest`, no al bundle OTA. Esta es la 4.17.2 que se quedó
en `beta` (`e282ec59`): `filasComoLaApp` (lápidas + una fila por `día|importe|comercio`) y no
insertar un segundo aviso el mismo día / mismo comercio / mismo euro (Wallet + TR).

También se alinea `apk.json` / `versionCode` de `beta` con producción (**41 / 4.17.1**). Un
promote vacío `-X theirs` habría pintado APK **40 / 4.16.2** encima de la 41 que ya tiene la
familia (`d7fac794` nunca volvió a `beta`). `promote-beta.yml` aborta si el `versionCode` de
beta es menor que el de main.

## [4.18.1] — 2026-08-17
### Recibos + IA en cualquier gasto + banco del `+` como los filtros

Tanda 4: lo que es un recibo de verdad (teléfono, internet, seguro no médico, alquiler, comunidad, alarma) caía en **Otros**. Categoría `recibos` + KW en cliente e `ingest_logic.ts`. Luz/gas siguen en `energia`; impuestos en `tasas`; Movistar Plus en `ocio` (el teléfono Movistar, no).

La Edge `categorize` no tenía en `ALLOWED` heladería, gaming, joyería ni recibos: la IA **no podía** devolverlas. Lista alineada con `CATEGORIES` (el test `categories` aborta si falta una) y el prompt lleva pistas de qué es cada id. El botón «Sugerir categoría» sale en **cualquier** movimiento, no solo Otros.

Al apuntar (`+`), los bancos eran una fila de chips que tapaba el teclado. Misma idea que el cuadradito de filtros en Gastos: una pastilla con el banco actual; al tocarla se despliegan.

## [4.18.0] — 2026-08-17
### Tanda 3 — filtro de gasto diario + fecha al apuntar/editar

El filtro de Gastos arrancaba con **un** banco: `accDaily` (el rol «gasto diario» principal).
`settings.expenseBanks` ya alimentaba el presupuesto (`expenseCountsBudget`), así que Revolut
podía contar en el techo y **no salir en la lista**. Pedido suyo: todos los marcados como gasto
diario se ven y cuentan (salvo neutras: inversión/traspaso); Sabadell y compañía siguen a mano
en «Todos los bancos», listos para el import histórico de 3 meses.

El `input type="date"` del rango a medida (y la fecha fija a hoy en Apuntar) abrían el picker
nativo de Android. Calendario propio (`McCal` en `02-ui-shared.js`): grid del mes, sin nativo.

### Tanda 4 — heladería, joyería, videojuegos

Categorías nuevas + KW (cliente e `ingest_logic.ts`). Steam/Instant Gaming salen de ocio;
heladería sale de bares; joyería (Tous, Pandora) sale de regalos/compras.

## [4.17.2] — 2026-08-17
### El widget sumaba el mismo pago dos veces (tanda `widget-coherente`, segunda vuelta)

Rechazo de la 4.16.2: el widget ya no se contradecía por dentro (907 · quedan 93 · puedes gastar 93)
pero seguía diciendo **907 €** contra **709 €** en la app.

La fórmula era la misma. Lo que difería era lo que cada lado **veía**. `ingest` sumaba la tabla
`expenses` a pelo. La app, al bajarla, tira las lápidas de `state.deleted` y junta por
`día|importe|comercio` (sin hora).

Caso medido con el extracto de Trade Republic delante: el 13/8 hay **un** APOLLON GALLERY de 230 €
y **otro** de 115 €. En la nube había **dos** filas de 230 € (11:31 `regalos` y 13:08 `bares`), las
dos `macrodroid`. Wallet avisó a una hora y TR a otra (97 min, fuera de la ventana anti-dup de 10).
No eran dos compras. Un diagnóstico intermedio tomó las horas distintas por «dos cargos reales» y
proponía meter la hora en la clave de fusión: eso habría hecho **mentir también a la app**.

Arreglo, todo en el servidor (sin APK):

1. `filasComoLaApp` en `presupuesto.ts`: respeta lápidas y deja una fila por clave, igual que
   `syncCloudExpenses`. `ingest` pasa eso a `statsDelMes` (y ahora selecciona `fecha`/`comercio`).
2. Al insertar, además de la ventana de 10 min, se ignora un segundo aviso **el mismo día + mismo
   comercio + mismo euro**, para no criar más gemelos Wallet/TR.

Tests en `presupuesto-servidor`: las dos notis de 230 cuentan una vez; una lápida también la
respeta el servidor. Para probarlo en el móvil hace falta redesplegar `ingest` desde `beta`.

## [4.17.1] — 2026-08-17
### Los dos fallos de su rechazo de la 4.17.0.1 (7 ok / 2 fallos)

**1. «Al modificarlo y guardarlo se bloquea la pantalla, no deja hacer nada, solo si tiras para
atrás ahí puedes seguir».** ⚠ **No era de la tanda: viene de la v3.108.0** (`git log -S` sobre
`setEditExp(null)`) y saltaba con cualquier blur del importe o del nombre. Se destapó ahora porque
renombrar el «Movimiento» es lo primero que le da un motivo para editar.

`ExpenseDetailSheet` tenía **dos nociones de «abierto» que podían discrepar**: se pintaba con
`!exp || !editExp`, pero sus candados (`useBackClose`, y sobre todo `useSheetSwipe`, que pone
`overflow:hidden` y hace `preventDefault` de **todo** `touchmove` fuera del sheet) iban con `!!exp`
a secas. `saveEdit` acababa con `setEditExp(null)` → el sheet dejaba de pintarse, `sheetRef` pasaba
a `null` —así que ningún toque contaba ya como «dentro del sheet»— y el bloqueo se quedaba puesto
sobre una pantalla vacía. Atrás lo liberaba porque ahí sí se cierra de verdad.

Dos arreglos: `saveEdit` deja `editExp` **sincronizado con lo guardado** en vez de vaciarlo (que
además es lo que el comentario de `closeSave` prometía: «al perder el foco se guarda, no se
cierra»), y el sheet usa **una sola condición** para pintarse y para sus candados, de modo que
ninguna otra vía pueda repetirlo.

**2. «De otros bancos no hace nada y tampoco se ve para qué está, dado que ya puedes elegir los
bancos abajo».** Las dos cosas ciertas. No hacía nada porque el filtro de bancos arranca
preseleccionado en la cuenta de gasto diario y «de otros bancos» significa justo «que NO es esa»:
el cruce salía siempre vacío. Y es el único de los cuatro que ya se podía pedir con los chips de
banco. **Chip retirado**; el cajón `otrobanco` sigue vivo porque es el que hace que la fila diga
«no es del día a día», que es la parte que sí servía.

Test e2e nuevo `★ guardar un cambio NO deja la pantalla muerta`: comprueba que tras guardar el
sheet sigue en pie con lo escrito dentro, y que al cerrarlo la app responde (sin `sheet-open`, sin
`overflow:hidden`, y se puede cambiar de pestaña). Verificado que **cae** con el código anterior.

## [4.17.0] — 2026-08-17
### Orden en Gastos (tanda `gastos-orden`)

Tres de las doce cosas que apuntó en el crucero. Sale sin APK nueva: todo es web + una migración.
La tanda `widget-coherente` de la 4.16.2 sigue en el panel sin aprobar, con sus puntos escritos
igual para que hereden los ✓ que ya tenía.

1. **La lista metía en el mismo saco cosas que no se parecen.** Sus palabras: «hay bastante caos
   entre gastos que cuentan, ingresos y movimientos que no cuentan sean inversiones o movimientos
   sin más». Y era literal: un `no afecta` genérico marcaba igual una inversión (dinero suyo
   cambiando de sitio) que un recibo de Sabadell (gasto real que no sale del banco del día a día).
   Ahora hay **cuatro cajones** (`expenseBucket`, 01-i18n.js) y cada fila dice el suyo: «no es un
   gasto» / «no es del día a día». Un **ingreso ya no se pinta apagado** — entra dinero, no es un
   gasto descartado.
2. **Filtro «Qué contar»** al principio del sheet de filtros: cuentan / ingresos / inversión y
   traspasos / de otros bancos. Misma función que pinta la fila, para que no se separen nunca.
   Entra en el contador de filtros y en «Limpiar».
3. **Renombrar el «Movimiento» de Trade Republic sin duplicar el gasto.** Renombrar ya se podía;
   lo que no se podía era hacerlo sin consecuencias, y esto era un bug de verdad. El dedup de
   `importObExpenses` tiene tres capas y renombrar **las rompía las tres**: TR no manda `ext_id`
   (todo null), la clave `día|importe|comercio` deja de casar al cambiar el comercio, y la red de
   «sin nombre ±3 días» solo mira gastos de otra fuente. Resultado medido: el siguiente sync metía
   el gasto otra vez.
   Arreglo: la fila recuerda cómo la llamaba el banco (`obName`, **migración 0021** `ob_name`) y el
   dedup usa ese nombre. Las filas que ya tenía en el móvil se sellan la primera vez que las toca.
   Se lee de vuelta en `expenseFromRow` a propósito: no leerla es exactamente lo que le pasó al
   rastro de la divisa, y aquí perderla significa duplicar el gasto.

Tests: `ob-renombrar` (6 casos, incluido que dos cargos iguales de verdad siguen entrando los dos y
que el gemelo de MacroDroid sigue tapado) y e2e `gastos-cajones` (4 casos sobre el DOM real).
Comprobado que el duplicado ocurre con el código anterior y no con este.

## [4.16.2] — 2026-08-17
### El widget se contradecía a sí mismo (tanda `widget-coherente`)

Reportado al volver del crucero, con captura: el widget decía «891 € de 1.000 · te quedan 109» y
justo debajo «✅ Puedes gastar 324 €». Al abrir la app se ponía bien y **al rato volvía a mentir**.

No era un cálculo malo: eran **dos escritores de las prefs del widget que no escribían lo mismo**.
`MiCarteraPlugin.updateWidget` (app abierta) empujaba las cinco cifras a la vez;
`MiCarteraWidget.saveMonth` (lector de notis, **app cerrada**) escribía solo `spent` y `budget` y
dejaba `afford` y `cash` del push anterior. `build()` los pintaba juntos como si fueran del mismo
momento — de ahí las dos líneas incompatibles, y el «se arregla al abrir y al rato vuelve».

Arreglo, en tres piezas:

1. **`build()` calcula «puedes gastar», ya no lo recibe hecho.** Los dos escritores mantienen las
   mismas PRIMITIVAS (`budgetLeft`, `safeLiq`) y la fórmula (`min` de las dos) vive en un solo
   sitio. Da igual quién escribió el último: el número siempre es coherente.
2. **`ingest` manda `budgetLeft` y `counts`** en `month`. `budgetLeft` sale de la misma
   `statsDelMes` que ya alinea servidor y app, así que la noti trae la cifra exacta.
   Sentinela `-1` = «este ingest no lo manda», para que una APK nueva contra una función sin
   desplegar no pinte «Puedes gastar 0 €».
3. **`saveMonth` mantiene `safeLiq` y `cash`** restando el importe del gasto. Un cargo de la
   cuenta diaria hunde el saldo de hoy y el del resto del mes en la misma cantidad, así que restar
   es exacto **sin resimular el mes en el servidor**. Deliberado: `safeLiq` sale de recorrer fijos,
   deudas, puntuales y traspasos día a día, y reimplementar eso en Deno sería la tercera copia de
   la misma regla — de esa duplicación salieron los dos últimos bugs de presupuesto.

Test nuevo `widget-coherente`: carga las dos implementaciones de presupuesto y exige el mismo
`budgetLeft`, y **lee el Java de verdad** para exigir que todo lo que `build()` pinta lo mantengan
los dos caminos. Verificado que el guardián se pone rojo con el código anterior.

APK **40 / 4.16.2** (cambia código nativo).

**Pendiente, no cerrado en esta tanda:** el salto 891 vs 686 (Δ 205 €) entre la cifra de la noti y
la de la app. Cliente y servidor comparten fórmula, así que la diferencia viene de datos de
entrada distintos (sospecha: `ingest` calcula sobre el `app_state` de la nube, que puede ir por
detrás del móvil). Se cierra simulando contra su nube real, no leyendo código.

## [4.16.1] — 2026-08-06
### Arranque sin franja bajo la cámara (APK)

La build 36 de la 4.16.0 se compiló con `MICARTERA_WEBDEBUG=1` en `local.properties` (socket de
depuración de la WebView en una release real) y el tema de splash **no tenía
`postSplashScreenTheme`**, así que tras el arranque podía quedar chrome nativo (ActionBar / franja)
bajo la cámara encima de la WebView. Fix: WEB_DEBUG off en release, `postSplashScreenTheme` →
`AppTheme.NoActionBar`, y `getSupportActionBar().hide()` por si un OEM no encadena el tema.
APK **39 / 4.16.1**; la release `v4.16.0` se deja atrás (asset sustituido en su momento; esta es
la canónica limpia).

### Antídoto de publicación (mismo día, tooling)

Tras el calvario del promote: guardián Gradle/`apk:prep` que **aborta** si `WEBDEBUG=1`,
`npm run release:apk` (prep→firma→`gh release`→`apk.json` real), `docs/RELEASE.md` y test
`webdebug-guard` para que no se vuelva a colar.

## [4.16.0] — 2026-08-06
### Aviso de presupuesto que cuadra + divisa que sobrevive + notis de Google Wallet (beta)

**Tandas:** `presupuesto-aviso`, `divisa-original`, `notis-wallet`.

1. **El aviso de presupuesto contaba lo que la app no cuenta** (`ingest/index.ts:187`).
   Le saltó «¡95% del presupuesto! 965 € de 1.000 €» en la noti y en el widget, y al abrir la
   app no llegaba al 30%. Las dos cifras salían de la MISMA nube: `ingest` sumaba TODAS las
   filas del mes mientras `monthBudgetStats()` descarta tres cosas. Medido contra sus datos
   reales de agosto (32 filas): **964,58 € → 96%** contra **234,30 € → 23%**.
   Se colaban Sabadell (448,39 €, banco de recibos) y la categoría Inversión (281,89 €); además
   el presupuesto iba en bruto, sin restar lo reservado, y el widget enseñaba el gasto bruto en
   vez de la cifra que pinta la cabecera de Gastos. La regla vive ahora en
   `_shared/presupuesto.ts` y el test carga LAS DOS implementaciones y exige el mismo número
   (un test de constantes se queda verde cuando alguien cambia una y se olvida de la otra —
   que es exactamente cómo nació este bug).

2. **Notis de Google Wallet** (`_shared/wallet.ts`, `TrExpenseListener.java`).
   El lector solo escuchaba `de.traderepublic.app`, así que Revolut y Google Pay no entraban por
   ningún lado. El gasto de 76,08 € de Splau del 6/8 era esto: la noti se leyó del móvil con
   `dumpsys notification --noredact` y estaba intacta, de `com.google.android.apps.walletnfcrel`.
   Ni `limpiarTexto()` ni la cola de reintentos la habrían salvado — el lector ni la vio.
   - Filtro por CANAL (`tapandpay`), no por texto: los pases de embarque y las fidelización
     ni se miran.
   - `clasificar()` recibe la fuente: con Wallet el título NO se escanea (ahí el título es el
     nombre del comercio, y escanearlo resucitaría el bug del bar por la otra puerta).
   - Divisa: cuatro formatos aceptados; **sin tipo de cambio NO se guarda** y queda aviso en el
     panel. «kr» se rechaza por ambigua (sueca/noruega/danesa).
   - Dedup TR+Wallet con margen de 2 céntimos (el euro convertido puede bailar uno).

3. **La divisa original sobrevive a la nube** (migración `0020`).
   `origAmount`/`origCur` vivían solo en memoria: apuntabas 1.520 ₺, se guardaban 41,80 € y en
   el primer pull el rastro desaparecía. Columnas `importe_orig` + `divisa`, con CHECK que impide
   media pareja, red de seguridad si la migración va por detrás del bundle, y borrado del rastro
   si se edita el importe en euros a mano.

4. **Mojibake del datáfono con los bytes de verdad**: el título era `CORNELLA` + `C2 9F`, o sea
   UTF-8 leído como Latin-1 — un carácter partido en dos. Quitando solo el control invisible
   quedaba la otra mitad (una A con acento circunflejo) suelta en mitad del nombre y para siempre
   en el histórico; ahora se va la pareja entera, sustituida por un espacio para no pegar palabras.
   (Y de paso: `U+009F` no es un NUL, así que Postgres lo habría aceptado; esa fila no se perdió
   por la codificación.)

## [4.15.0] — 2026-08-05
### Ambientación suave + conversor FX + presupuesto alineado + extracto total (beta)

**Tandas:** `season-fx-soft`, `fx-converter`, `presupuesto-resumen`, `otros-bancos-vista`,
`gastos-filtros-ia`, `fix-novedades-nag`, `fix-season-glow`, `gastos-filtros-ubicacion`,
`fix-season-portal`, `fix-season-glow-steady`, `fix-season-glow-soft`, `fix-season-tabs`.

1. **Ambientación** (`.season-amb` + destello superior):
   **Incidentes 2026-08-05 (mismo día):**
   - Host transparente → Inicio+Gastos. Fix: host SIEMPRE opaco.
   - Lluvia saltaba de fase al swipe → UNA capa GLOBAL fixed + `useMemo`.
   - Destello ARRIBA: `html::before` fixed fallaba en su WebView Oppo (CDP 2026-08-05:
     computed=fixed z-36 y aun así se iba con el scroll). Fix: nodo real `.season-glow`.
   - Fuga de lista en la barra ~1 s al scrollear: `botnav-hidden` usaba opacity→0 a mitad
     de la transición. Fix: hide SOLO con translateY; lluvia recortada encima de la barra.
   - Cofia opaca encima (.13/.15): sin parpadeo pero «ralla» horizontal que tapaba texto al
     scroll. Fix `.16`: portal z-1 detrás de `#root` z-2; lavado ancho por temática en
     `.season-glow` (Verano atardecer melocotón/ámbar; Halloween óxido; Invierno azul plateado;
     Pascua rosa/verde; Navidad/Mundial con acentos propios); host/app transparentes con
     temática; alfas ~.03–.13; el contenido pasa por encima.
   - Build `.16`: host transparente reabrió Inicio+Gastos fusionados (mismo incidente del
     5/8 mañana). Fix `.17`: host OPACO con el lavado pintado encima de `var(--bg)` (no agujero);
     `.page` opaca en el gesto; portal sigue detrás para chrome.
   - Build `.18`: el lavado del host (`.17`) se iba con el scroll (gradiente en `background-image`
     del contenedor scrolleable). `background-attachment:fixed` lo arreglaba en desktop pero en
     WebView Oppo tapaba el contenido al scrollear. Fix: host solo `var(--bg)` + lavado en
     `::before` sticky (z-0) con hijos en z-1; portal `.season-glow` sin attachment:fixed.
   - Build `.22` (glow22): portal dentro de `#root` z-0, host/app/page transparentes en reposo.
     `visibility:hidden` en hermanas aparcadas rompía e2e (`listas-render`: «Internet» duplicado
     en Inicio›Próximos vs Plan›Recibos). Fix `.18`: se quitó `visibility:hidden` y solo quedó
     `overflow:hidden` + fondo opaco en `.track.dragging` → **regresión**: tabs fusionadas otra
     vez en reposo. Fix `.19`: restaurar `.track.scroll-host-park .page:not(.page-scroll-host)
     {visibility:hidden}` (8016d7df) y mantener e2e acotado a `.page-scroll-host`.
2. **Conversor** en Ajustes → Dinero: importe + origen → destino (chips + swap). Sustituye
   la lista fija «1 € → …». Reutiliza `toEurAmt`/`fromEurAmt`.
3. **Presupuesto:** avisos 50/80/95/100 %, reto gamif e informe imagen usan `monthBudgetStats`
   (misma cifra que Resumen/Gastos; sin neutras; resta reservas). Test:
   `tests/month-budget-stats.test.mjs`.
4. **Extracto de todos los bancos:** `importObExpenses` apunta TODO lo sincronizado. Solo
   `expenseBankEnts` resta del presupuesto/saldo (`expenseCountsCash`/`expenseCountsBudget`);
   el resto se ve con marca «no afecta». Fijos modelados no se duplican en ningún banco.
5. **Filtros + categorías:** sheet con buscador (adiós chips kilométricos); categorías
   `viajes`/`mascotas`/`educacion`/`energia`; KW ampliado (cliente + `ingest_logic` + ALLOWED
   de la Edge Function categorize).
6. **Fix 2026-08-05 — popup de Novedades en bucle en beta:** «me sale en beta todo el rato
   para actualizar, no sé porqué». La puerta que decide si toca enseñar ✨ Novedades
   (`_seenVersion` en `11-app-main.js`) comparaba contra el sello EXACTO de `CONFIG.APP_VERSION`,
   que en beta lleva sufijo de compilación (`beta.yml`: `VERSION.N`, sube en CADA push — hoy
   4.15.0.1…4.15.0.4/5). El popup ya casaba por versión BASE al decidir qué entrada resaltar
   (`mcVerBase`, fix 2026-07-26) pero la puerta que decide si DISPARA el popup se quedó con la
   comparación vieja: cada compilación nueva de la MISMA beta reabría el mismo popup con las
   MISMAS notas, sin nada que contar. Ahora `_seenVersion` se sella y compara por `mcVerBase`
   (también en el sello silencioso de `Onboarding.finish`). En estable la base y el sello son
   el mismo string — cero cambio para el resto de la familia. El resto del ruido de
   actualizaciones (pill OTA, notificación nativa, `OtaCheckWorker`) SÍ correspondía a
   compilaciones realmente nuevas publicadas hoy (4 tandas + esta), así que no se toca: es
   exactamente lo esperado cuando se publica varias veces el mismo día.
7. **Fix 2026-08-05 — destello + lluvia sin cortes** (`fix-season-glow`): ver punto 1
   (segunda pasada del mismo día, feedback con 2 fotos).
8. **Reubicación 2026-08-05 — botón «Filtros» de Gastos** (`gastos-filtros-ubicacion`):
   `GastosFilterSheet` (punto 5) llegó con su botón en una fila propia, entre el buscador y
   «Sincronizar» — ni pegado a uno ni al otro. Se movió a la misma fila que el buscador
   (`04-tab-gastos.js`, `Expenses`): los dos acotan la lista de abajo (texto y categoría/banco),
   así que forman un único bloque de "cómo filtras"; «Sincronizar» es una acción de red aparte y
   se queda donde estaba. El resumen de categorías/bancos activos + «Borrar filtros» sigue
   pintándose debajo, ahora sin el botón que antes lo acompañaba (ya vive junto al buscador).
   Sin cambios de comportamiento en `GastosFilterSheet` ni claves i18n nuevas — solo maquetación.
9. **Fix 2026-08-05 — tercera pasada, medida con capturas reales por CDP en su Oppo** (mismo
   `fix-season-glow`): el feedback tras el punto 7 seguía diciendo lo mismo («el destello real
   solo se ve un momento al deslizar de pestaña, luego desaparece») y sumaba una regresión nueva
   («al hacer scroll veo la lista detrás de la barra un segundo»). Esta vez no se tocó a ciegas:
   se instaló un APK de depuración (`MICARTERA_WEBDEBUG=1`), se conectó por `adb forward` +
   WebSocket nativo (`tools/movil/*.mjs`) y se disparó un swipe real vía
   `Input.dispatchTouchEvent` con capturas (`Page.captureScreenshot`) decodificadas a mano
   (`tools/movil/png-pixel.mjs`, sin dependencias) para leer el RGB exacto de la esquina y de la
   barra en cada instante — no solo `getComputedStyle`, que ya decía "fixed"/"opacity:1" y aun
   así no explicaba lo que él veía.
   - **Fuga de la barra, causa real:** `.app-shell.nav-sin-blur .botnav` (blur apagado durante
     el swipe por rendimiento, ver AGENTS §7 bis) solo quitaba `backdrop-filter` y dejaba el
     fondo por defecto — `color-mix(...88%,transparent)`, un 12 % transparente pensado para ir
     SIEMPRE acompañado del blur que lo disimula. Sin blur, ese 12 % se ve limpio: medido con
     touch real, la barra estuvo en ese estado desde el `touchstart` hasta 1,4 s después (hasta
     que `scroll-host-on` vuelve a poner fondo sólido), justo el «~1 segundo» que describía. Fix:
     `background:var(--bg-2)` también en `nav-sin-blur`, igual que en `scroll-host-on` — la barra
     se ve IGUAL con o sin blur, que era la intención original.
   - **Destello, causa real:** NO era un bug de posicionamiento — `.season-glow` medía `top:0`
     fijo en cualquier punto del scroll, con o sin swipe. Era de INTENSIDAD: con `opacity` .32-.6
     y los gradientes al .14-.2, el resultado en pantalla real eran ~10-15 puntos de RGB sobre
     255 en la esquina (fondo oscuro), por debajo de lo que un ojo nota en reposo — solo se
     percibía el CAMBIO durante el swipe (el `translateX`/respiro del `seasonglow`), no la mancha
     en sí. Subido a `opacity` .55-.85 y gradientes .3-.42 (todas las temáticas): mismo diseño,
     visible también quieto. `tests/season-detalle.test.mjs` ahora exige un mínimo de intensidad
     y la barra sólida en `nav-sin-blur`, para que esto no se pueda volver a bajar sin que salte.
10. **Fix 2026-08-05 — cuarta pasada, build .9 rechazada por el usuario** (`fix-season-portal`):
    Tras publicar f589f89c (intensidad + `nav-sin-blur{background:var(--bg-2)}`), feedback:
    «sigue pasando ambos problemas». Reproducido otra vez con ADB+CDP en su Oppo (4.15.0.9):
    - **Destello al scroll:** `glowTop=0` y `position:fixed` en computed style, pero el RGB de
      la esquina superior derecha saltaba +31 al bajar 600 px (19,28,20 → 26,41,31). Causa:
      `.season-glow` vivía dentro de `#root{position:relative}` — en su WebView el compositor de
      scroll trata fixed anclado a #root como si scrolleara. Fix: `ReactDOM.createPortal` a
      `document.body` en `.season-portal` (fixed centrado max-width 520px); hijos absolute.
      `seasonglow` solo anima opacity (sin `translateX`).
    - **Fuga en barra al swipe:** durante `nav-sin-blur`, getComputedStyle seguía devolviendo
      `color(srgb … / 0.88)` pese al override — la regla contextual no ganaba en su WebView.
      Fix: `.botnav` default pasa a `background:var(--bg-2)` opaco siempre (sin color-mix 88%).
      Tests actualizados en `tests/season-detalle.test.mjs`.
11. **Fix 2026-08-05 — quinta pasada, destello que se intensificaba al scrollear**
    (`fix-season-glow-steady`, build .12 rechazada): tras .11 el destello YA estaba fijo (portal
    a `body`) y se veía en reposo, pero al bajar la lista «se ponía más intenso». Medido en su Oppo
    (ADB, 4.15.0.11): capa translúcida a 38vh ENCIMA del contenido → composite ~+30 RGB al
    scrollear. Build .12 probó cinta opaca + gradiente horneado en el host: franja oliva junto a la
    cámara ([65,60,33] vs [20,38,30]) y destello que desaparecía al taparlo. Rechazada.
12. **Fix 2026-08-05 — sexta pasada, la COFIA** (`fix-season-glow-steady`): lo que arregla esta
    vez es que por fin se midió **el gesto correcto**. Él aclaró que el destello falla «scrolleando
    entre tabs, no en la misma tab scrolleando hacia abajo», y ese gesto cambia el DOM: al arrastrar
    el carrusel se QUITA `page-scroll-host` de la página activa. Todo lo que .12 había colgado del
    fondo de esa clase se apagaba justo durante el gesto.
    - **Método:** con el dedo CONGELADO a mitad de gesto (`Input.dispatchTouchEvent` sin `touchEnd`)
      se apaga y enciende solo el gradiente y se restan las dos capturas. Esa resta es la aportación
      exacta del destello en ese composite. Sin aislarlo, el Δ del píxel mide el contenido que se
      desliza: medido, el mismo Δ de 228 salía con destello y **sin destello ninguno**, que es lo
      que hizo perseguir un fantasma en .9/.11/.12.
    - **Medido en la .12:** aporte del destello con el dedo puesto = **[0,0,0]** de y48 hacia abajo
      (desaparecido) y **|91|** sobre la franja de la cámara (el tono oliva).
    - **Descartado con datos:** el WIP que había en el árbol (portal a z-34 detrás del host +
      `background-clip:content-box`) daba píxeles **idénticos a no tener destello**: el glow
      arrancaba en `safe-top+10`, justo donde empieza la caja opaca del host. Y ponerlo *detrás*
      del contenido tampoco vale — las cartillas lo tapan al pasar y «desaparece y vuelve a
      aparecer», que él rechazó expresamente.
    - **Fix:** el destello se pinta OPACO y POR ENCIMA de todo, en una cofia
      (`--season-cofia: calc(var(--safe-top) + 36px)`) por la que el contenido no pasa nunca —
      el host y `.app` reservan ese alto solo con temática puesta. Como no depende de lo que haya
      debajo, es matemáticamente invariante: **62/62/62** de aporte en reposo, en pleno gesto entre
      pestañas y scrolleando, y **0** sobre la franja de la cámara en los tres.
    - **Los dos detalles que pidió:** base `var(--bg)` (mismo tono que la app → sin corte visible
      con la barra de estado) y gradiente centrado en `calc(var(--safe-top) + 12px)` en vez de
      `at 80% -20%`, para que valga 0 sobre los iconos. Se apaga con `mask-image` en los últimos
      20 px: al scrollear el contenido se disuelve por debajo en vez de cortarse en seco.
      Las partículas arrancan bajo la cofia (`top:var(--season-cofia)`): una hoja cruzando por
      delante de los iconos del sistema es el mismo problema de esa franja.
    - Alfas a .14/.09 (antes .3-.42): calibradas para que el pico mida lo mismo que en la .11,
      que es la que él dio por buena en reposo. Sin `@keyframes seasonglow` — un destello que
      respira es justo lo que pidió que no hiciera.
    - Con reduce-motion la cofia SE QUEDA (es un degradado quieto, y si se fuera dejaría el hueco
      reservado vacío); lo que se va son las partículas. `tests/season-detalle.test.mjs` reescrito
      para vigilar los invariantes reales, no la implementación de turno.
13. **Fix 2026-08-05 — séptima pasada: el verde y el salto** (`fix-season-glow-steady`): con la
    .13 en el móvil, grabó la pantalla y salieron DOS fallos que el destello tapaba y que no eran
    del destello. Los dos son de lo mismo: al arrastrar el carrusel se quita `page-scroll-host`, y
    esa clase era **el único fondo opaco y la única referencia de posición** de toda la app.
    - **«Ese verde clarito cuando scrolleas»:** `.app` era transparente, así que al irse el host
      asomaba el degradado decorativo del `body` — menta al 18 % centrado justo arriba a la
      derecha (`radial-gradient(130% 55% at 85% -8%, rgba(95,208,138,.18)…)`). Medido:
      `[12,23,18]` → `[18,36,27]` en toda la franja derecha, solo durante el gesto. En reposo no
      se ve nunca porque lo tapa el host, así que **no era una decisión de diseño, era una fuga**.
      Fix: `.app{background:var(--bg)}`. El degradado del `body` sigue donde sí se ve y para lo
      que se hizo (login y onboarding, que salen antes que `.app`).
    - **«La pantalla se baja unos pixeles y luego vuelve»:** medido **5,5 px**. En reposo la
      posición la manda el `padding-top` del host; al arrastrar la manda `.app` **más los 6 px que
      `.page` pone por su cuenta** y el host no. Fix: `.app` lleva 6 px menos que el host
      (`safe-top + 4px`, y `cofia - 6px` con temática) para que la suma cuadre. Medido después:
      **0,0 px**. El desfase venía de antes (eran 4 px sin temática); la cofia solo lo hizo más
      visible.
    - Con `.app` ya opaca y colocada igual que el host, los dos fondos se turnan sin que se note:
      por eso el gradiente pasa a ir en los DOS (misma regla, para que no se puedan desincronizar)
      y el destello puede seguir por debajo de la cofia sin ser un velo encima del contenido.
      Geometría nueva: elipse que vale 0 exactamente en `--safe-top` (centro a `+ry`), así no hay
      escalón en el borde de la barra de estado y no hace falta recortar nada. Destello más
      generoso —el de la .13 se quedaba en 76 px y él lo llamó «chiquito»— llegando ahora a ~150 px.
    - **Comprobación nueva y mucho más dura** (`tools/movil/_tmp-glow13-fondo.mjs`): se esconde el
      CONTENIDO de las páginas y se compara SOLO el fondo. Reposo vs gesto vs scroll, 33 puntos por
      toda la pantalla: **diferencia máxima 0**.
14. **Fix 2026-08-05 — octava pasada: el parpadeo del desvanecido, y verano en serio**
    (`fix-season-glow-steady`): él cazó lo que quedaba — «es casi imperceptible pero hace un
    parpadeo al scrollear» — y pidió más destello, «como un día caluroso de verano».
    - **El parpadeo era la `mask`.** El desvanecido de 20 px del borde de abajo de la cofia sonaba
      bien (el contenido se disuelve en vez de cortarse) pero vuelve TRANSLÚCIDOS esos 20 px, y es
      justo donde el destello es más fuerte: el contenido pasando por debajo cambiaba el composite.
      O sea, el velo de la .11 otra vez, en una franja estrecha. Fuera la `mask`: la cofia es opaca
      de arriba abajo y el contenido se corta en su borde, que es lo que hace cualquier lista.
    - **Método nuevo** (`tools/movil/_tmp-glow13-parpadeo.mjs`): grabar la pantalla por CDP
      (`Page.startScreencast`) durante un fling REAL con inercia y comparar la zona del destello
      fotograma a fotograma. Con la `mask`: desvío 0 a y=30 y **184** a y=70. Sin ella y con el
      destello entero dentro de la cofia: **0 en toda la cofia, 119 fotogramas**.
    - **El destello, entero DENTRO de la cofia.** Cada elipse vale 0 en `--safe-top` y se apaga
      antes del borde de abajo (radio vertical === desplazamiento). Así no queda ni una cola que
      las tarjetas puedan tapar al scrollear. Cofia a `safe-top + 76px`.
    - **Forma:** tres capas — foco cálido arriba a la derecha con caída lenta, baño ancho muy tenue
      (es lo que da el «aire caliente») y el segundo color de la temática a la izquierda. Con una
      sola elipse ancha parecía una franja horizontal, no un resplandor. Verano al 100 % (pico
      medido `[142,116,69]` contra `[52,48,27]` de la pasada anterior); el resto de temáticas, la
      misma forma a media potencia hasta que él decida cada una.
    - Guarda nueva en los tests: se parsea cada elipse y se exige radio vertical === desplazamiento.
      Es LA regla que mantiene limpia la franja de la cámara, y a ojo no se ve en un diff.

Sin APK nuevo (35 / 4.12.0).

## [4.14.1] — 2026-08-05
### Gastos: resumen sin desborde (OTA del pulido post-4.14.0)

**Por qué:** el arreglo del resumen de Gastos (filas etiqueta|importe, sin `space-between` a
todo el ancho, `clamp` en importes largos) entró en `main` **después** del bump a 4.14.0. Sin
subir el número, `docs-frescura` falla y el OTA no avisa a quien ya tenía 4.14.0 sin ese CSS.

**Qué cambia:** sello 4.14.1 + nota de versión; tandas `multidivisa` / `gastos-fx-overflow`
quitadas del panel (ya en prod). Sin APK nuevo (35 / 4.12.0).

## [4.14.0] — 2026-08-05
### Multidivisa real (TRY) + Ajustes → Dinero limpio

**Por qué:** el crucero del 7/8 paga en liras; `settings.currency` existía pero, si faltaba el
tipo en `fxRates`, `DISP` se quedaba en € **en silencio** («la moneda no hace nada»). TRY no
estaba en `CUR_LIST` ni en el fetch a frankfurter. «Comparar monedas» listaba todas las filas
con «—» cuando no había FX. Y Ajustes → Dinero duplicaba presupuesto (ya en Resumen) y bancos
de gasto diario (ya en Cartera).

**Qué cambia:**
1. **TRY** en `CUR_LIST` / `CUR_SYM` / i18n es·en·ca; el fetch FX se construye desde `CUR_LIST`
   (añadir una divisa ya no deja el selector y el BCE desfasados).
2. Elegir moneda **exige tipo**: si falta, pide FX y solo entonces aplica; si no llega, toast
   (nada de quedarse en € callado). Se guarda `fxDate`.
3. **Comparar monedas:** solo filas con tipo; al abrir refresca; vacío → mensaje + reintentar.
4. **Apuntar:** moneda del apunte **independiente** de la de visualización (chips ₺/€/$…;
   recuerda `settings.apuntarCur`). Guarda siempre en € vía `toEurAmt` (`origAmount`/`origCur`
   informativos). Sin tipo no guarda. Así en el crucero apuntas liras y sigues viendo la app en €.
5. **Ajustes → Dinero:** fuera presupuesto mensual y bancos de gasto diario; quedan moneda,
   comparar y «Total de gastos».

**Fix rechazo 4.14.0.1 (móvil):** el dólar iba y la lira no. Causa: `api.frankfurter.app` hace
301 → `api.frankfurter.dev` y la CSP no tenía `.dev` (mismo patrón que el redirect de GitHub
assets). El dólar «funcionaba» por `state.fx` legacy. Ahora el fetch va directo a `.dev` y la
CSP lo deja pasar; al aplicar moneda se usan los rates devueltos (no solo el state).

**Fix desborde Gastos (post-aprobación, letra Pequeña + ¥):** la línea «Gastos X · ingresos Y»
era una sola frase con `nowrap` en el presupuesto → se partía a mitad y solapaba. Ahora
filas etiqueta|importe (juntas, sin `space-between` a todo el ancho — eso abría un hueco
ridículo), columna izq con `min-width:0`, importe con `clamp`, presupuesto que puede partir
palabra. Inicio ya usaba `clamp` en el patrimonio. Tanda `gastos-fx-overflow`.

Rama: `tanda/multidivisa` (+ `tanda/gastos-fx-overflow`). Promote: ya en prod (4.14.0/4.14.1).

## [4.13.0] — 2026-08-05
### Barra quieta de verdad al tope y al swipear tabs

Causa del parpadeo: `botnav-ola-clear` se armaba en el tirón al tope (también con
deriva al cambiar de pestaña) y en el scroll al llegar arriba → opacity 0↔1 en bucle.
Ya no se arma: al tope solo reveal + pin breve; al swipe de tabs, pin 1,4 s forzado
visible. La ola sigue; la barra no pelea.

### 2026-08-05 (noche 4)
### Rayita, cifra de presupuesto y barra a mil

1. **Rayita Gastos↔Plan:** si el arco se interrumpe a mitad, snap al destino sin relanzar
   `rodea` — ya no atraviesa el + en diagonal.
2. **Resumen/widget = Gastos:** `monthBudgetStats` (excluye inversión/traspaso, resta reservas,
   respeta `gTotalMode`). `thisMonthSpent` sigue para el efectivo TR.
3. **Barra al tope a mil:** `botnav-ola-clear` solo si la barra estaba escondida; pin breve si
   hide/reveal se pelean en <200 ms.

### 2026-08-05 (noche 3)
### Ola nativa + barra usable

1. **Host fixed** + `hostTab` en React + safe-top + rise sin matrix.
2. **Flick abajo:** hide del botnav diferido a `scrollend`.
3. **Ola arriba:** candado anti-arco también en el tope.
5. **Host perdido random:** `enterScrollHost` fallaba si había dedo al acabar el settle →
   estado «sin parches». Ahora solo bloquea en tab-drag activo + `ensureScrollHost` al tocar.

### 2026-08-05 (noche 2)
### Ola nativa de verdad: la pestaña activa = como Ajustes (`position:fixed`)

Tras labs en su Oppo: quitar `contain`/`preventDefault` no bastaba; aparcar el track sin
`transform` tampoco. Lo que SÍ igualó Ajustes: la pestaña activa en `position:fixed` a
pantalla (`.page-scroll-host`), track en reposo con `left` (sin transform). Arriba/abajo al
tirar → ola nativa sin stopper.

El flick hasta el final seguía sin ola: el `setNavHidden` del botnav re-renderizaba App y
React pisaba el `className` de `.page`/`.track` (solo tenía `"page"` / `"track"`), así que
se perdía el `page-scroll-host` a mitad del momentum. Ahora esas clases viven en el
`className` de React (`hostTab`) y el setState del botnav (abajo y al bajar) va diferido
420 ms con clase DOM primero.

Al deslizar tabs se sale del host y vuelve el `translate3d`; al asentar, otra vez host.

### 2026-08-05 (noche)
### Ola de vuelta + tabs a mitad/abajo sin matar el scroll

En .39 (Oppo): sin ola en ninguna tab; tabs a mitad/abajo bloqueados del todo; al quitar
`contain:paint` + `overscroll-behavior` en caliente la ola volvía, pero el stopper y el bloqueo
de tabs seguían. Tres piezas:

1. **CSS:** `.page` sin `contain:paint` (recortaba el estirón nativo) y sin
   `overscroll-behavior-y` forzado — igual que Ajustes. Se deja `contain:layout style` y
   `touch-action:pan-y`.
2. **Eje a mitad/abajo:** el candado anterior fijaba `axis=y` ante un `x` flojo → ese gesto ya
   no podía acabar en cambio de tab. Ahora, si el horizontal no está claro (`|dy|≥16` o
   `|dx|≤36`), **no se fija eje**: scrollea el navegador; si el dedo sigue y se vuelve casi solo
   horizontal, el siguiente move sí reclama tabs.
3. **`freezeShell`:** abajo del todo nunca pone `overflow:hidden` (mataba la ola aunque el
   siguiente tirón fuera vertical).

### Stopper medido en su Oppo: preventDefault del swipe a mitad de lista

Con el móvil enchufado: `pan-y` ya estaba, y aun así STUCK (scrollTop fijo mientras el dedo
se movía, p.ej. st=53). Causa: a mitad de lista el arco del pulgar seguía reclamando eje `x`
(umbral 28 px insuficiente) → `preventDefault` + `freezeShell` mataban el scroll. A mitad solo
se acepta swipe de tabs si el gesto es casi solo horizontal (ver candado revisado arriba).

### Plan: el `touch-action:none` arriba bloqueaba BAJAR, no solo el cambio de sección

Feedback: «el objetivo era bloquear que no se moviera de recibos a deudas desde abajo, no bloquear
la página entera». `mc-touch-own` en Plan al estar arriba dejaba `touch-action:none` en reposo →
ni scroll. Ahora Plan en reposo es pan-y; `mc-touch-own` solo durante el gesto que nace arriba
(tirón abajo = segmento; dedo arriba = scroll a mano).

### 2026-08-04 (noche, 2)
### Ola: mapa exacto — Gastos/Cartera ambos bordes; Resumen/Plan solo abajo

Aclaración suya al probar: no era «ola en todas partes igual». Gastos y Cartera → ola arriba y
abajo. Resumen y Plan → ola SOLO abajo (arriba = perfil / cambio de segmento). El primer parche
ponía `mc-touch-own` también abajo de Plan (para el segmento inverso) y eso mataba la ola ahí.
Quitado el segmento inverso por abajo: el círculo Recibos→Deudas→Metas solo va tirando hacia abajo
arriba del todo; abajo de Plan es pan-y puro.

### 2026-08-04 (noche)
### Plan-swipe y ola: el muro era el arco del pulgar, y a mitad de lista el viewport robaba el gesto

Dos tandas que seguían en beta tras el OK del tutorial (8/0 en 4.13.0.36):

1. **`plan-swipe`**: «si deslizas hacia abajo no debería cambiar, solo de arriba a abajo». El
   segmento ya miraba el extremo al fijar el eje, pero (a) no exigía haber *nacido* arriba/abajo
   —podías llegar scrolleando y colarte— y (b) a mitad de lista `mode=ignore` **no** hacía
   `stopPropagation`, así que el `.viewport` veía el mismo arco de pulgar, bloqueaba el eje en
   horizontal a los ~12 px y cambiaba de pestaña / mataba el scroll. Ahora: extremo al start + al
   move; vertical a mitad = `mode=scroll` con stopPropagation; y a mitad de lista el swipe de
   pestañas exige ~28 px de ventaja horizontal clara antes de reclamar.

2. **`gestos` (muro → ola)**: candidato medido el 4/8 puesto por fin — `touch-action:pan-y` en
   `.page`. Excepción `.mc-touch-own` (`none`) solo en Inicio arriba (perfil/Ajustes, sin ola) y
   Plan en extremos (gesto de segmento necesita `preventDefault`). Resto: ola nativa a la primera,
   como Ajustes.

3. **Panel beta**: quitadas del array `tandas` las ya aprobadas (`tutorial-gestos`, `bancos`,
   `temporada`, `reservar`, `import-docx-pdf`). Quedan solo `gestos` y `plan-swipe`.

### 2026-08-04
### Tutorial: el descuadre era el `zoom` de la letra, no (solo) el portal

Tercera tanda con foto (4/8): tras el portal a `body` **seguía igual** en su Oppo. Medido por
CDP en el WebView real: con **letra pequeña** (`html.smalltext body{zoom:0.92}`) el
`getBoundingClientRect` del tab viene en px de pantalla, pero `left`/`top` de un `position:fixed`
dentro del body se interpretan en el espacio **pre-zoom** → el foco se pintaba al 92 % (Gastos
~57 px arriba de la barra; mismo ratio en +, Plan, Cartera, botnav). Playwright en Pixel 5 no
usa smalltext, por eso el e2e salía verde.

1. **`pintar` divide por `getComputedStyle(body).zoom`** (1 / 0.92 / 1.12 / 1.26). Tip igual.
2. **tipOnly con velo oscuro a pantalla entera** (mismo tono del tutorial). Antes `opacity:0`
   quitaba el oscurecido y parecía que el tour había acabado en Ajustes / tirón al perfil.
3. **Cifra:** Range del texto + pad 18 (no a ojo del número grande).
4. **Pulso suave** del anillo mientras lees el paso (`tourpulse`; se apaga con reduce-motion /
   mientras va pegado).
5. E2E nuevo con `textSize:"small"` para no volver a cegar el zoom.

(Portal a `body`, mensajes sin «verde»/«borde», barra forzada visible: siguen de la tanda
anterior; no bastaban solos en su móvil.)

### 2026-08-01 (segunda vuelta)
### El rebote de las pestañas era el navegador todo el tiempo, y una tanda subida se queda del todo fuera de beta

Tercer intento del rebote, y esta vez con la descripción exacta: «cuando bajas hasta abajo del
todo y tiras más, se ve como un efecto OLA de todas las cosas que hay en pantalla — eso es lo que
quiero, lo mismo que Ajustes y el perfil».

**Y AJUSTES/EL PERFIL NUNCA TUVIERON UN REBOTE NUESTRO.** Se comprobó el CSS: `.settings-push` y
`.settings-slide` jamás tocaron `overscroll-behavior` — corren con el valor por defecto del
navegador, que en su Android SÍ hace rubber-band de verdad. `.page` (las cuatro pestañas) era la
ÚNICA zona con `overscroll-behavior-y:none`, puesta el 28/7 a propósito para dejar sitio a un
rebote JS hecho a mano — sobre la premisa de que «la WebView no hace rubber-band, hace un
fogonazo». Esa premisa era la raíz de tres rondas de rechazo: no importaba cuánto se afinara la
curva, seguía siendo UN EFECTO DISTINTO por diseño.

Quitado entero: `reb`, `REB_MAX`, `REB_DIV`, `soltarRebote`, la rama completa en `onMove` — y el
`overscroll-behavior-y:none` de `.page`. Las cuatro pestañas pasan a comportarse EXACTAMENTE como
Ajustes y el perfil, porque ahora es literalmente el mismo mecanismo del navegador, no una copia.

**UNA TANDA APROBADA Y SUBIDA SE QUITA DE `tandas`, NO SE MARCA COMO HECHA.** Regla suya, textual:
«si sube algo en prod, se quita de beta para probar porque ya está listo... conforme apruebe la
tanda sube y desaparece». `arranque` (aprobada 5/5, ya en producción como 4.12.3) y `canal`
(aprobada 3/3, su arreglo vive en `beta.yml` y ya está activo) seguían apareciendo en el panel como
si quedara algo pendiente — eso fue lo que hizo dudar si de verdad estaba hecho. Las dos se han
QUITADO del array, no comentado ni marcado: lo que hicieron queda en el CHANGELOG y en
`docs/ROADMAP.md`, que es donde se consulta el histórico.

**APK DE PRUEBAS INSTALABLE EN PARALELO.** Pidió una vía para probar cambios nativos (el splash de
Android 12+, el widget) sin esperar a una release pública ni arriesgar la app real. `assembleDebug`
con `applicationIdSuffix ".debug"` la instala como `com.micartera.app.debug` — una app aparte en el
móvil, con su propio nombre («Aely (debug)») y sus propios datos, conviviendo con la de
producción sin tocarla.

### 2026-08-01
### Repaso de la ronda 4.13.0: el panel de tandas contaba mal, y la promoción por tandas prometía algo que no podía hacer

Revisión del trabajo hecho desde el móvil los días 28/7 → 1/8 (nueve commits). El grueso está bien
y con la suite en verde; esto es lo que no lo estaba.

#### El panel de revisión numeraba los puntos contra la lista equivocada

`betaChecklist` devolvía como checklist los `items` de la versión —**lo que lee la familia en
Novedades**— mientras el panel pintaba los puntos de las **tandas**, que son otra redacción y otro
número de líneas. En la 4.13.0: **21 puntos repartidos en cuatro tandas contra 14 en Novedades**.
Como todo el panel va por un índice global (`marks`, el progreso, el guardado y sobre todo la lista
de ✓ heredados entre compilaciones, que casa por el **texto** del punto), los dos números
desalineados hacían tres cosas a la vez, todas en silencio:

- el progreso decía **`x/14`** cuando había 21 cosas que probar — podía llegar a 14/14 con una
  tanda entera sin tocar;
- un ✓ puesto en «Un CSV también entra» se guardaba bajo el texto de una nota de bancos, así que la
  promesa de «lo que ya diste por bueno no se vuelve a preguntar» dejaba de valer en cuanto se
  reescribiera cualquiera de las dos notas;
- los puntos del 14 al 20 —la tanda **`bancos` casi entera, la de los bugs de dinero real**— se
  guardaban bajo `undefined` y **no se heredaban nunca**.

Arreglado en `betaChecklist`: cuando hay tandas, la checklist **es la concatenación de sus puntos**.
Sin tandas, `betaTandas` ya devuelve una sola con `rnItems` dentro, así que aplanar da exactamente
la misma lista y las 69 versiones del histórico no se enteran.

**Por qué no lo vio el guardián.** El test se llama «se reparten TODOS los puntos» y solo
comprobaba `suma > 0`. Ahora compara la suma **contra la longitud de la checklist** y además que
cada índice global caiga sobre el texto que su tanda enseña — que es lo que el título decía.

#### Promocionar por tandas pedía ramas que nadie había creado

El workflow mergea `origin/tanda/<id>`, pero **declarar tandas en las notas no crea ninguna rama**,
y las cuatro de la 4.13.0 se commitearon mezcladas encima de `beta` (`import` + `gestos` +
`arranque` viajan en un mismo commit). O sea que `-f tandas=import` habría parado en seco después
de que él aprobara. **Esta ronda solo puede subir entera.** Se arregla lo que se puede arreglar:

- el panel ya no le dice que ponga nombres de tanda en el workflow — dice lo único cierto siempre,
  que el veredicto queda registrado con su nombre;
- el error del workflow ahora lista **qué ramas `tanda/*` existen de verdad** y dice qué hacer;
- la regla, en `docs/TESTING.md` y `EMPIEZA-AQUI.md`: **`git switch -c tanda/<id> main` antes del
  primer commit**, o esa ronda no se puede trocear.

#### Dos cosas más del workflow de promoción

- **Inyección de shell**: `'${{ inputs.tandas }}'` metía el texto de la casilla dentro de una
  comilla simple, así que un apóstrofo (o un `$(…)`) escrito ahí se convertía en shell ejecutable
  en un job con permiso de escritura. Ahora entra por `env:`.
- **El mensaje de «nada que promocionar» llegaba mutilado** desde el 24/7: dentro de comillas
  dobles los acentos graves son sustitución de comandos, así que «\`beta\`» intentaba **ejecutar**
  `beta`. Comillas simples.

#### Y el espejo de la memoria, que iba a perderse

`docs/memoria/` se genera **en un solo sentido** (memoria del PC → repo), pero el Claude del móvil
no puede tocar la memoria del PC: escribe directo en el espejo. Tres bloques de esta ronda —las
tandas, el «52» del canal de pruebas y lo hecho de la review externa— solo existían ahí, y el
siguiente `npm run memoria` desde el portátil los habría borrado. Recuperados a mano antes de
sincronizar; la trampa queda escrita en la memoria para no repetirla.

---

### Base de la ronda (28 jul 2026)
### Importar una hoja de gastos, rebote en las pestañas y la rayita rodeando el +

Tanda de su lista del 2026-07-28, con la app ya pulida («ahora que está tan pulida quería nuevas
cosas»). Los dos puntos que traía como pendientes —el tirón al deslizar y el stopper del perfil—
los cerró él mismo desde el móvil: «arregladísimo» los dos.

#### Importar una hoja de gastos (Excel o CSV) — la petición nueva

> «Poder importar ya excels formados con gastos, recibos y demás, porque mi madre tiene un Excel y
> amigos míos igual y me preguntaron si habría alguna opción para importarlo de una manera que lo
> pillara guay.»

Lo que llega **no son extractos de banco**: son hojas hechas a mano, cada una con sus columnas, en
su orden, con sus nombres y en el idioma que sea. No hay formato que reconocer — hay que **adivinar
y dejar corregir**, que es todo el diseño de la pantalla: se propone qué es cada columna, se
previsualiza con datos de verdad y no se toca nada hasta que dice que sí (AGENTS §9).

El mapeo va en dos pasadas: primero por el **nombre de la cabecera** (con las pistas en es/en/ca,
normalizadas sin tildes) y lo que quede sin casar, por **lo que contienen las columnas** — así una
hoja sin cabeceras también se resuelve. Detectar si hay cabecera importa: sin eso, una hoja que
empieza directamente por datos perdía su primera línea de gastos sin decir nada.

**El .xlsx se abre SIN LIBRERÍA.** Un .xlsx es un ZIP con XML dentro, así que se lee el directorio
central a mano y se descomprime con `DecompressionStream("deflate-raw")`, que es una API del
navegador y no un paquete. Son ~120 líneas contra los ~400 KB de SheetJS, en un bundle que ya va al
96 % del presupuesto — y la regla de cero dependencias sigue en pie. Solo se descomprime la hoja y
las cadenas, no el ZIP entero.

Dos trampas del formato, anotadas porque no se ven leyendo el código:
- **Las fechas son números.** Serial de Excel con origen 1899-12-30, no 1900-01-01: Excel arrastra
  desde Lotus el bug de creerse que 1900 fue bisiesto. Si eso se descuadra, **todas** las fechas de
  un import salen corridas dos días y no lo nota nadie hasta ver el histórico raro.
- **La cabecera local del ZIP no es la del directorio central.** El campo `extra` suele diferir, así
  que saltar hasta los datos con las longitudes del central da basura.

Y en un CSV, el separador se detecta: un Excel español exporta con `;` y uno inglés con `,`.
Acertar solo con uno es medio importador.

#### El criterio de duplicado, que es lo que él pidió ver

> «Que si pillara alguna cosa duplicada que dijera de forma guapa con alguna animación o algo el
> descarte y lo que se queda.»

Dos apuntes son el mismo si coinciden **día, importe al céntimo y comercio normalizado** (sin
tildes, sin mayúsculas, sin dobles espacios). Ni más fino ni más grueso, y las dos alternativas se
descartaron con casos concretos, no de memoria:
- **sin el comercio**, dos cafés de 1,20 € del mismo día se comerían el uno al otro;
- **con la hora**, no casaría nada: una hoja de casa no lleva hora y el banco sí.

Se mira contra el histórico **y contra el propio fichero**, porque una hoja de casa repite filas:
se copian y se pegan meses enteros.

El reparto entra **contando**, una tarjeta detrás de otra (90 ms la primera, 52 ms las siguientes,
cortado a 14): lo que entra llega desde la derecha en verde, lo repetido se queda apagado y tachado.
Pasadas 14 la animación ya no informa, solo hace esperar.

#### Rebote al llegar al final, en las cuatro pestañas

> «La animación esa chula de las settings de perfil y settings normales que si bajas abajo del todo
> hace como efecto rebote, eso lo hacen la mayoría de apps y me flipa muchísimo, ¿lo podrías aplicar
> para cada pestaña?»

No sale gratis del navegador: la WebView de Android **no hace rubber-band**, hace un fogonazo de
borde. Así que el estirón se dibuja a mano —`transform` mientras el dedo insiste, con resistencia
asintótica a 88 px— y se suelta con la misma curva que usa el asentamiento del carrusel.
`overscroll-behavior-y` pasa de `contain` a `none` para que el destello de Chromium no se pise con
el nuestro.

Sus dos avisos, respetados literalmente:
- **De lado** no aplica: el eje ya está decidido antes de llegar ahí, así que abrir Ajustes no se
  toca.
- **Arriba del todo** el rebote se apaga **en Resumen**, que es donde el tirón hacia abajo abre el
  perfil. En el resto de pestañas arriba no compite con nada y sí lo tiene.

Las medidas del scroll (`scrollHeight`/`clientHeight`) se leen **una vez en el `touchstart`**, no en
cada `touchmove`: leerlas en el bucle son ~35 reflows por arrastre, que es exactamente el
layout-thrashing que costó los rechazos .17 → .23 de la 4.12.0.

#### La rayita rodea el + en vez de atravesarlo

> «La rayita que rula al ir de tab en tab que cuando llegue al + en vez de atravesarlo que lo rodee
> con la animación suave.»

Yendo de Gastos a Plan el indicador pasa por el hueco del FAB, y como es `position:absolute` pinta
**por encima** del botón: se le veía cruzar la cara del +. Ahora salta por arriba.

La geometría, para no tener que volver a medirla: en coordenadas de `.botnav-row` el FAB va de
y=−28 a y=+30 (58 px de alto con `margin-top:-26px`), y el indicador vive en `top:-9`. Subirlo 26 px
lo deja en −35, siete por encima del borde del botón. El estrechón de `scaleX` es lo que lo hace
parecer un salto y no una traslación. El transform del salto va en el `span` porque el `translateX`
horizontal lo escribe React en el contenedor y dos transforms en el mismo nodo se pisan.

**Sin estado de React**, y esto no es un detalle: un `setState` por cambio de pestaña son dos
repintados de la app entera **por gesto** — justo el tipo de trabajo atado al momento en que el
usuario toca que costó siete vueltas sacar del carrusel. La clase se pone y se quita sobre el nodo.

#### Iconos de la barra, temporadas que se cortan, y el arranque

- **Iconos**: una animación por pestaña al activarse (Inicio salta, Gastos peina sus rayas, Plan
  marca la casilla, Cartera sube como su flecha). **Solo al entrar, nunca en bucle**: infinita ahí
  es repintado permanente en la barra.
- **Temporadas**: las piezas caían `infinite`; ahora dan **dos vueltas y paran** (`forwards`). No se
  pierde nada porque cada cambio de pestaña lanza una racha nueva — deslizar es lo que las trae de
  vuelta, que era lo otro que pidió. El reinicio va alternando entre dos keyframes idénticos
  (`seasonfall`/`seasonfallb`): cambiar `animation-name` es la única forma fiable de reiniciar una
  animación CSS sin tocar los 18 nodos uno a uno.
- **El halo del +** pasa de animar `box-shadow` —que obliga a repintar la barra cada frame, para
  siempre— a un anillo en `::after` que solo mueve `opacity` y `transform`, o sea compositor puro.
  Mismo guiño, cero repintado. Él quería justo eso: «deja más decoración como el botón + que me
  encanta, pero que sea sutil».
- **El splash** ya no cambia de forma a media carga: el nombre esperaba a que `font-display:swap`
  hiciera el cambio de Georgia a Fraunces a la vista. Ahora espera a la fuente (tope de 500 ms) y
  el icono entra solo. Y la cortina se va creciendo un pelín, no solo desvaneciéndose.
- **El contador del patrimonio** arrancaba al montar React, o sea **detrás del splash**: cuando él
  veía la pantalla la cuenta ya había terminado. Su feedback: «eso molaba mucho y se perdió». No se
  había perdido — se gastaba a puerta cerrada. Ahora espera al evento `mc-splash-gone`. Y ya no
  vuelve a cero en cada cambio: la primera vez cuenta desde 0 (la entrada), después encadena desde
  donde estuviera.

#### Canal beta: el sufijo y el veredicto

- **El número.** Salía de `GITHUB_RUN_NUMBER`, un contador **global** del workflow que no se
  reinicia jamás: la 4.12.1 se anunciaba como «4.12.1.52» siendo su primera compilación. Su queja:
  «resetea ese 52 que no tiene sentido». Ahora cuenta compilaciones **de esa versión**, leyendo el
  título de la propia release (`Beta 4.13.0.3` → +1; versión base nueva → empieza en 1). Sin estado
  que mantener y se recompone solo.
  ⚠ El sufijo **no se puede quitar**, y queda escrito para no volver a intentarlo: `_mcNewerVer`
  compara número a número, así que una beta que se llamara igual que la estable no se vería como
  nueva y el móvil no la descargaría nunca.
- **El veredicto.** «Cuando suba algo a prod, la beta no haya nada para aprobar porque lógicamente
  ya lo hice para que subiera prod» — y es verdad: promocionar **es** aprobar. El panel ahora
  pregunta a Pages qué versión sirve producción (`_mcProdVersion`) y, si ya va por ahí o más allá,
  se calla: sin botones de veredicto y con la fila de Ajustes diciendo «✅ ya en producción» en vez
  de un «3/8» que se leía como trabajo pendiente. Si la red falla, sigue preguntando: en la duda,
  el lado seguro.

#### De la review externa: métricas, salud, amenazas y ADR

- **Métricas de uso** (`cloud.logUso`) con **vocabulario cerrado** en `USO_OK`. Se hace ahora por el
  motivo que ya estaba escrito en el ROADMAP: el histórico de uso no se recupera hacia atrás. Lo que
  viaja es una etiqueta de una lista fija y nada más — ni importes, ni comercios, ni texto libre.
  Con etiqueta libre, el primer `logUso("gasto en "+comercio)` escrito con buena intención se lleva
  el nombre de una tienda a la nube. Añadir una métrica es añadir una línea a la lista, donde se ve
  en el diff.
- **Observabilidad** (`cloud.logPerf`): solo lo que Supabase **no** puede ver porque pasa en el
  móvil (cuánto tarda un import, una sincronización). Redondeado a medio segundo: la diferencia
  entre 3,1 s y 3,4 s no cambia ninguna decisión y menos precisión es menos huella.
- **`npm run salud`**: alineación de versiones, qué sirve Pages de verdad, si la beta va por delante
  o por detrás, commits sin promocionar, migraciones y recuento de errores a 24 h / 7 días. Script y
  no pantalla, por lo decidido en la review: con tres usuarios una pantalla es un producto más que
  mantener.
- **[`docs/AMENAZAS.md`](docs/AMENAZAS.md)**: 13 amenazas cruzadas con lo que ya hay, y tres huecos
  marcados que pasan a ser tareas con nombre — validar la entrada de las diez Edge Functions (la
  única en rojo), auditar qué acaba en `app_events`/Sentry, y extender el rate limit.
- **[`docs/adr/`](docs/adr/)**: cinco decisiones que costaron dinero, escritas a posteriori
  (Supabase, el monolito, cero CDNs, el OTA propio, Capacitor). Cada una dice qué se descartó y qué
  haría cambiar de opinión. La del OTA lleva pegada la lección de las dos causas con el mismo
  síntoma.

#### Varias betas a la vez, aprobables por separado

> «Que se pudieran implementar varias betas a la vez y que me des la opción de aprobarlas por
> separado pero que estén juntas. Así ya trabajo 100 % como mi trabajo.»

Una versión puede declarar **tandas** en sus notas: cada una con su `id`, su título y sus puntos a
probar. En el panel, cada tanda tiene **su contador y su botón** — un fallo en una no bloquea a las
demás, que es el problema real (una rama con un fallo arrastraba a todas las que ya estaban listas).
Cada veredicto viaja con su `id`, así que el parte dice QUÉ subir y no solo «aprobada».

Detalle de implementación que importa para no romper lo que ya tiene probado: los puntos siguen
numerados **globalmente**, porque el guardado y la herencia de ✓ entre compilaciones van por ese
índice y por el TEXTO del punto. Cambiar el esquema de claves habría tirado a la basura todo lo
aprobado en betas anteriores. Las tandas solo agrupan índices.

**Sin tandas declaradas, todo se comporta como antes** (una checklist, un veredicto con id `todo`):
las 69 versiones del histórico siguen funcionando y declarar tandas es opcional.

Y el workflow de promoción acepta ahora `tandas: import,gestos` para mergear **solo esas** ramas
`tanda/<id>` a `main`. Vacío = la beta entera, como siempre. Si pides una tanda cuya rama no
existe, para: subir «lo que haya» es el fallo silencioso que ya costó dos promociones a medias.
Flujo completo en [docs/TESTING.md](docs/TESTING.md).

#### Guardianes

- `tests/import-hoja.test.mjs` — el criterio de duplicado con sus casos límite, el mapeo con y sin
  cabeceras, las fechas de aquí (3/4 es abril, no marzo) y el serial de Excel.
- `e2e/import-hoja.spec.mjs` — construye un **.xlsx de verdad** en la propia página (bytes reales,
  ZIP con método 0) y lo mete por el mismo input que usaría ella. La mitad que solo existe en un
  navegador —descomprimir y `DOMParser`— no la puede cubrir un unitario, y es justo la que decide si
  el Excel se abre o no.

## [4.12.4] — 2026-08-03
### Importar una hoja de gastos (Excel/CSV), separado del resto de la 4.13.0 en curso

Misma receta que la 4.12.2 (arranque): la tanda `import` de la 4.13.0 —aprobada por él en el móvil,
6/6 ok, sin fallos— se saca a mano de entre los commits mezclados de `beta` y se aplica sola sobre
`main`. Trae Ajustes → «Importar una hoja de gastos» (Excel/CSV, mapeo + previsualización +
deduplicado). El lector .xlsx es propio (`DecompressionStream`), sin librería.

## [4.12.3] — 2026-08-01
### Mantenimiento: el guardián de versión atrapó su propio efecto secundario

`docs-frescura` — el guardián que evita publicar código sin subir `VERSION` — se disparó con SU
PROPIO ruido: al arreglar los dos fallos de `README.md`/`docs/ROADMAP.md` de la 4.12.2 (más abajo),
el rebuild local re-selló `public/sw.js` con el hash del commit nuevo, y ESE segundo toque contaba
como «código publicable después del bump» aunque no llevara nada nuevo. Sube VERSION una vez más
para que el guardián quede contento sin tocar el historial ya subido a `main` — más seguro que
reescribirlo.

De paso, el fixture de los e2e que arrastraba `beta` desde el 1/8 (el informe mensual automático
del día 1 tapando la pantalla en `rendimiento-tabs`/`swipe-pestanas`) llega también a `main`: sin
él, CUALQUIER futura promoción a producción se cae en pruebas cada día 1 de mes, no solo esta.

Nada de esto lo nota nadie usando la app.

## [4.12.2] — 2026-08-01
### El arranque, separado del resto de la 4.13.0 en curso

Petición suya del 1/8, exacta: «que se pudieran subir a prod por features, no solo tandas
enteras». La 4.13.0 (import de hojas, gestos, arranque, bancos) se commiteó mezclada en `beta` y
no se puede trocear ya — pero `arranque` estaba APROBADA por él (5/5 ok) y no tenía por qué
esperar a que `gestos` (rechazada: el rebote no es «el efecto ola») y `bancos` (rechazada: TR no
conecta, el banco de gasto diario no sincroniza) estuvieran listas. Construido a mano sobre
`main`, sacando SOLO los cambios de arranque de entre los ~950 líneas mezcladas de toda la
ronda — sin cherry-pick de commits (también mezclados entre sí), aplicando cada cambio
directamente y verificando que compila y pasa los tests antes de tocar producción.

**EL «ALGO RARO ANTES DE APARECER EL ICONO» QUE LLEVABA DÍAS REPORTANDO.** No era Android: era
`font-display:swap`. El navegador pintaba «Aely» en Georgia al instante y la CAMBIABA a
Fraunces en cuanto la fuente cargaba — ese cambio de forma, a la vista, era lo PRIMERO que veía
al abrir la app. Ya estaba arreglado en `beta` desde el 28/7 (el nombre espera a su tipografía,
tope de 500 ms si la red va lenta) pero nunca había llegado a producción por estar atrapado en la
ronda mezclada.

**EL CONTADOR DEL PATRIMONIO, QUE SE GASTABA A PUERTA CERRADA.** Arrancaba al montar React, o sea
DETRÁS del splash: para cuando él veía la pantalla, la cuenta ya había terminado. Ahora espera al
evento `mc-splash-gone` — la animación se ve desde el primer frame visible.

**Y EL LOGO YA NO SE QUEDA FLOTANDO SOBRE LA APP PINTADA.** Cazado en su vídeo del 1/8: todo se
desvanecía a la vez, y el logo (verde brillante) tardaba más en desaparecer que la cortina (color
plano), así que se veían las dos pantallas superpuestas un instante. Ahora el logo se va primero.

**TEMPORADAS: una caída, no un bucle.** Tres intentos hasta dar con lo que pedía: una sola vuelta
de 4-7 s (antes, dos vueltas de hasta 40 s) y sin volver a caer al cambiar de pestaña. A cambio,
la temática se queda puesta en sitios fijos — borde de las tarjetas, resplandor del icono activo,
subrayado del título — sin tocar `--mint`/`--coral`, que pintan dinero.

Verificado con la suite e2e completa contra este árbol exacto (91/93 — los 2 que no pasan son
fallos preexistentes de `main`, confirmados idénticos con y sin este cambio, sin relación con
arranque). `gestos` y `bancos` se quedan en `beta`, arreglándose, hasta que él las apruebe.

## [4.12.1] — 2026-07-27
### Ajustes solo desde Resumen, sin stoppers al abrir perfil/ajustes, y Gastos baja sin parones

#### Ajustes: fuera el borde en el resto de pestañas, y fuera el candado de 450 ms
El borde izquierdo (`EDGE_OPEN=52`) abría Ajustes desde Gastos/Plan/Cartera y pillaba gestos normales. Y el candado de 450 ms tras cambiar de pestaña («encadenando») —pensado para que una deslizada de más al llegar a Resumen no abriera Ajustes— era justo el stopper al ir Gastos → Resumen → Ajustes rápido: el primer desliz no contaba. Ahora `openSettings = ddx>0 && tab===0` sin espera ni borde. E2E: borde en Gastos no abre; en Resumen abre al momento.

#### Perfil: abrir → cerrar → abrir otra vez sin stopper
El cierre ponía `profMarkBusy` 500 ms y el tercer gesto (reabrir) se tragaba mientras el candado vivía. Cerrar en caliente ya se dejaba; abrir con el panel ya cerrado también (`!profBusy || !profileOpen`). Guardián en `e2e/perfil-simetria.spec.mjs`.

#### Gastos: la lista ya no se para al bajar rapidísimo
El centinela pedía la siguiente tanda con 600 px / +24 filas y aún se notaba el tope. Ahora 2.000 px de antelación y +60 por tanda (la primera sigue en 12).

## [4.12.0] — 2026-07-26
### Las pestañas dejan de congelar la app, y el banco ya trae los ingresos

#### Séptima vuelta: el tirón era el ASENTAMIENTO CSS a 120 Hz (no el arrastre, no React)
Él lo describía perfecto y se midió mal otra vez: «**se pierde la fluidez de golpe**». Con la métrica correcta —huecos entre frames **presentados** por el compositor, no deltas de `requestAnimationFrame` ni `% DROPPED`— la secuencia de un deslice en su móvil (120 Hz) es:

```
… 8 8 8 8 …   ← arrastre con el dedo, impecable
25 8 25 8 25 8 … (×13)   ← al soltar, 0,42 s exactos
… 8 8 8 8 …   ← al acabar, impecable otra vez
```

Eso es el batido 60/120: la `transition: transform .42s` del `.track` pelea con la pantalla. WAAPI igual (13 saltos). Acortar a 0,18 s deja 6 (proporcional). **Asentar escribiendo `transform` desde `requestAnimationFrame`: 0 saltos, cuatro veces seguidas** (`tools/movil/ab-waapi.mjs`). Mismo easing `cubic-bezier(.32,.72,0,1)`, misma duración. `.track{transition:none}` permanente; si vuelve la CSS, vuelve el judder.

Lección de las varas (para no repetir el camino): rAF vive en el hilo principal y el desliz va en el compositor → rAF puede ir a 8,3 ms con la pantalla a trompicones; `% DROPPED` da 33 % hasta en reposo (el compositor pide 183/s y la pantalla presenta 122). Lo que cuenta es el **hueco entre presentaciones**.

De paso: `applySeason("")` dejaba `data-season=""` y `html[data-season]` encendía `fabpulse` (anima `box-shadow` → repintado permanente). No era ESTE tirón (A/B intercalado: 14 saltos con o sin él), pero estaba mal; ahora se quita el atributo.

⚠ La sexta vuelta (bus de `active`) **se queda**: era un re-render medido de verdad. **No era** lo que él seguía notando. Guardián del asentamiento: `tests/track-asentar-raf.test.mjs`.

#### Sexta vuelta: Deudas→Gastos no era el gesto, era RE-PINTAR Gastos al llegar
Él lo había dicho con la pista perfecta y se midió mal: **hacia Cartera va fluidísimo; hacia Gastos, no.** Un lag que depende del sentido no puede ser el carrusel (es idéntico): tiene que ser el destino. En su móvil, con la beta .42 cargada y un contador inyectado sobre `Expenses`:

| gesto | re-renders de Gastos |
|---|---|
| Plan/Deudas → **Gastos** | **+1** (y `active` pasa a `true`) |
| Plan/Deudas → **Cartera** | **0** |

La prop `active` de Expenses viajaba en el `useMemo` de Gastos (`gastosActiva`). Cada entrada a Gastos **reconstruía el árbol entero** encima de la animación del carrusel. El expediente ya lo había anotado («dejar `active` fijo quita la asimetría, pero no vale») y se descartó mal: **sí vale** enterarse sin re-render. `mcSetGastosActive` / `mcOnGastosActive` (bus en `00-core.js`): heavyOk y el reset de chips siguen avisados; el árbol de Gastos no se toca. Guardián: `tests/gastos-active-bus.test.mjs`.

⚠ **Veredicto suyo tras la .43: «sigue falla».** El re-render era real y el bus lo quita, pero **no era la causa del tirón que él siente**. La séptima vuelta es la que apunta a eso.

#### Quinta vuelta: el banco de pruebas no reproducía su fallo, y ese era el problema de verdad
«Sigue exactamente igual, no hay manera.» Y con razón: hasta aquí yo medía **tareas largas** en un contenedor, y su síntoma —tirones al deslizar— no aparecía en esa métrica. Al reproducir sus dos casos, la diferencia era 190 contra 174 ms: ruido. **Estaba optimizando contra un espejo que no enseñaba el fallo**, y de ahí que dos tandas seguidas no le llegaran.

Lo primero fue arreglar el medidor, no el código. Dos cambios:
- **Medir FRAMES, no tareas largas.** Lo que se nota es un frame que tarda 100 ms, y eso puede pasar sin que ninguna tarea larga salte.
- **Reproducir su caso de verdad.** La app **ignora los eventos de scroll mientras hay un dedo puesto** (`if(dragging.current) return` en `onPageScroll`), así que con toques sintéticos la barra inferior no se escondía nunca — en un móvil real la esconde la inercia al soltar. Simulado eso, el fallo apareció a la primera.

Con el medidor arreglado, su repro salió al instante… y desmintió lo que parecía:

| caso | peor frame |
|---|---|
| Gastos arriba + barra escondida (su caso lento) | **100-117 ms** |
| Gastos arriba + barra **ya visible** | 83 ms |
| Gastos bajado (su caso fluido) | 83 ms |
| Gastos arriba, **todo** el bloque de arriba oculto | 100 ms |

**La variable no era «Gastos arriba del todo»**: era si la **barra inferior estaba escondida y tenía que reaparecer** durante el desliz. Ocultar entero el contenido de arriba de Gastos no cambiaba nada (100 ms), así que tampoco era lo que se pintaba. Y explica su «a veces sí y a veces no»: dependía de si había scrolleado antes.

**La causa:** `goTab` llamaba a `revealNav()` y a los `prepMount*` como `setState` **urgentes**, mientras el cambio de pestaña iba en `startTransition`. React los atiende en carriles distintos → **App se renderizaba DOS VECES** al soltar el dedo, encima de la animación del carrusel. Y reaparecer la barra es justo lo que dispara el render urgente. Todo en la misma transición: una sola pasada. **Peor frame del caso lento: 100 → 83 ms**, ya igualado con los casos que él da por fluidos.

⚠ **Y una corrección a la cuarta vuelta:** el desenfoque de la barra NO era la causa de su repro — en el caso lento la barra estaba *escondida*, o sea sin nada que desenfocar. Aquella medida (181 → 145 ms de tareas largas, con el tope teórico en 141) es real y el cambio se queda porque es una mejora medida en cualquier desliz, pero **no era lo que él notaba**. Queda dicho para que nadie lo lea como el arreglo de esto.

#### Cuarta vuelta: la barra de abajo desenfoca, y eso se paga EN CADA FRAME
Su repro, que es el que resolvió esto y que ninguna medida mía habría encontrado sola:

> «Cuando en Gastos está **arriba del todo** —esto es importante— y luego entras en Deudas, te mueves, y vuelves a Gastos: hay lag y se ralentiza todo. En cambio si en Gastos **bajas** sin ver la parte de arriba, vuelves a Deudas, te mueves, y deslizas otra vez a Gastos: no hay nada de lag, va ultra fluido.»

Lo que cambia entre los dos casos no es Gastos: **es que al bajar en una lista la barra inferior se esconde**. Y una barra escondida no tiene nada que desenfocar. `.botnav` lleva `backdrop-filter: blur(16px)`, que el navegador recalcula **cada vez que cambia lo que hay detrás** — y deslizando entre pestañas, detrás se mueve la app entera. En la traza se ve sin ambigüedad: **la barra se repinta 47 veces en un solo gesto**.

Acotado con el tope teórico, que es lo que convierte una sospecha en un dato:

| | bloqueo por gesto |
|---|---|
| barra visible, con desenfoque (como estaba) | 181 ms |
| barra visible, **sin** desenfoque | **145 ms** |
| barra **fuera del pintado** (tope teórico) | 141 ms |

O sea: el coste de la barra durante un desliz **es casi todo su desenfoque**, y quitarlo se lleva prácticamente el máximo posible. Y explica el «a veces sí y a veces no» que traía loco a cualquiera: dependía de si la barra estaba visible en ese momento.

**El diseño no se toca** (petición suya explícita). El desenfoque se apaga solo mientras hay movimiento y vuelve al parar — exactamente lo que ya se hacía con el velo del perfil desde la 4.9.0, que tampoco desenfoca durante el arrastre. A 0,42 s de transición nadie ve la diferencia; el tirón sí se veía. A/B intercalado contra la beta publicada, con su repro exacto: **180 → 157 ms**, y con la dispersión mucho más apretada (143-210 contra 126-301).

Detalle de fontanería: la vuelta del desenfoque va por temporizador y no por `transitionend`, porque si el desliz no llega al umbral el carrusel no transiciona y el evento no llegaría nunca — el candado del perfil ya tropezó con eso en la 4.11.0.

Guardián: `e2e/swipe-pestanas.spec.mjs` comprueba que la clase está puesta CON EL DEDO PUESTO y que se quita sola después (si se quedara, el diseño cambiaría de verdad).

#### Tercera vuelta: el lag dependía de la DIRECCIÓN, y eso destapó un memo roto desde siempre
Su prueba, y el dato que lo resolvió: «se ha arreglado lo de las deudas en dirección hacia Cartera, va fluidísimo; ahora falta hacia Gastos». **Un lag que depende del sentido no puede ser el gesto** —es idéntico en los dos—: tiene que ser el destino. Medido saliendo de Deudas: hacia Gastos 165 ms, hacia Cartera 127. Y el perfilador puso nombre al culpable: **`MovRow`, las filas de movimientos, era la función más cara de la app durante ese desliz (2,5-3,4 %)**.

**La causa, y llevaba ahí desde siempre:** `parseDate` cachea los milisegundos pero devuelve `new Date(ms)` — **un objeto nuevo en cada llamada**. Esa fecha viajaba como prop a `MovRow`, así que la comparación superficial de `React.memo` fallaba SIEMPRE por esa prop, aunque el gasto fuera idéntico: **cualquier re-render de Gastos repintaba las doce filas**. El `openDetail` sí se cuidó en su día con un `useCallback` (el comentario está justo al lado); la fecha se coló por debajo y dejó el memo de adorno.

Ahora a la fila le llega el **número** (`ms`) y el `Date` se construye dentro, que es la única línea que lo usa. **Comprobado en el perfilador, que es lo que no engaña: `MovRow` pasa de 2,5 % a no aparecer.** Y no afecta solo a este gesto — afecta a CADA re-render de Gastos: escribir en el buscador, cambiar un filtro, que entre un gasto del banco.

⚠ **Sobre los milisegundos, con honestidad:** la asimetría 165/127 que motivó todo esto se midió tres veces y en una cuarta pasada no se reprodujo (164 contra 159): en esta máquina el ruido se come diferencias de ese tamaño. Por eso la prueba que vale aquí es la del perfilador —el trabajo desaparece, no «sale un número más bajo»— y por eso el guardián que se deja es estructural.

**Dos intentos que NO se quedan, con su número:** dejar `active` fijo en Gastos (quita la asimetría pero haría que Gastos hiciera su trabajo caro en el arranque) y retrasar el aviso de «ya eres la pestaña activa» 460 ms hasta que pare el carrusel (**empeoró**: 239 contra 165, porque paga dos re-renders en vez de uno).

#### Deudas, segunda vuelta: no era «salir de Deudas», era PLAN entero (2026-07-27)
Su veredicto por la mañana: la APK aprobada, el perfil «ha mejorado una barbaridad» pero aún no del todo, y **Deudas igual** — «vas a deudas, te mueves dentro de deudas y luego deslizas a otra tab, es horrible el lag… y ahora se nota más porque va la app ultra fluida».

Lo primero fue partir su frase en tres medidas, porque «Deudas va lento» puede ser cualquiera de tres cosas (CPU x12, 1.200 gastos, 6 deudas, 6 metas):

| | antes de esta tanda |
|---|---|
| entrar en Deudas | 183 ms |
| moverse DENTRO de Deudas | **0 ms** (esto ya estaba arreglado) |
| deslizar fuera | 259 ms |

Y luego, la pregunta que lo cambió todo: **¿es Plan o es deslizar?** Midiendo el mismo gesto saliendo de cada pestaña:

| gesto | bloqueo |
|---|---|
| Gastos → Inicio | **58 ms** |
| Plan → Gastos | 156 ms |
| Cartera → **Plan** | **187 ms** |

O sea: no es salir de Deudas, es que **cualquier gesto que involucre Plan cuesta el triple**. Plan lleva sus tres segmentos (Recibos, Deudas, Metas) montados a la vez, y estaban ocultos con `visibility:hidden`, que **sigue participando en estilo, capas y pintado**. La 4.12.0 ya lo sabía y lo compensaba poniendo `content-visibility:hidden` **solo mientras el dedo arrastra**, para que el recálculo cayera después del `touchend`. Ese era el error: el peaje no desaparecía, se aplazaba tres milisegundos — justo al soltar, que es donde él lo notaba.

Re-medidos hoy los tres candidatos, porque el terreno ha cambiado (premontaje + páginas fuera del render de `App`):

| cómo se esconden los segmentos | entrar en Plan | abrir Deudas | salir de Plan |
|---|---|---|---|
| `visibility:hidden` (lo que había) | 162 ms | 198 ms | 185 ms |
| **`content-visibility:hidden` siempre** | **90 ms** | **148 ms** | 182 ms |
| `display:none` | 74 ms | 253 ms | 176 ms |

Gana `content-visibility:hidden` puesto **siempre**: casi tan barato como `display:none` al entrar y mucho mejor al abrir un segmento (148 contra 253), porque conserva el estado ya renderizado en vez de tirarlo. Verificado después del cambio: **entrar en Plan 162 → 89 ms**. Sobra, y se retira, la regla especial de `.track.dragging` en `shell.html`.

#### Y `tab` deja de ser dependencia de las páginas
El `useMemo` de anoche dejaba `tab` dentro, así que **cambiar de pestaña seguía reconstruyendo las cuatro páginas**. Ahora las páginas se memoizan sin `tab` y lo único que se rehace al deslizar son los cuatro `div` contenedores (que sí necesitan `tab` para la clase `page-live`); React ve el mismo elemento hijo por referencia y se salta el subárbol. Gastos va en su propio memo porque es la única que necesita saber si es la pestaña activa. **Entrar en Deudas: 183 → 108 ms.**

El precio, y queda escrito al lado de cada uno: `goTab` y `cancelSwipe` leían `tab` desde dentro de esas páginas y ahora leen `tabRef`. Con el valor viejo, `goTab` se habría tragado un salto («Ver más → Gastos» sin hacer nada) y `cancelSwipe` habría devuelto el carrusel a la pestaña equivocada.

#### Lo que se probó y NO era, con su número
Que no lo repita nadie, incluido yo:
- `content-visibility` de los segmentos solo al arrastrar → quitarlo: 257 vs 236 ms. Nada.
- `content-visibility:auto` de `.page` → quitarlo: 252 vs 236. Nada.
- `will-change` del `.track` → quitarlo: 212 vs 236. Ruido.
- Que cambiar de pestaña no re-renderice Gastos (`active` fijo): 275 vs 236. Nada.
- **En el perfil**, `content-visibility:auto` en sus tarjetas: parecía ganar con 5 pasadas (171 vs 215) y con **9 intercaladas salió PEOR** (229 vs 166). Descartado — y sirve de recordatorio de por qué en esta máquina no vale medir a la primera.

**El perfil se queda como está.** Tras lo de anoche (339 → 175 ms) el JS propio de la app no llega al 1 % al abrirlo: lo que queda es trabajo del navegador para hacer visible una pantalla de ~1.680 px, y hoy no he encontrado ninguna palanca que lo baje de verdad. Él lo describe como «a puntito, le queda nada»; lo honesto es decir que para el siguiente tramo hace falta rediseñar qué se enseña al abrir, no otra propiedad CSS.

Guardián nuevo en `e2e/rendimiento-tabs.spec.mjs`: el segmento oculto de Plan tiene que tener `content-visibility: hidden` computado. Estructural, que es lo que aguanta en CI.

#### Abrir el perfil: la causa NO era la animación, y esto se midió antes de tocar nada
Él, tras probar la .28: «lo del perfil está arreglado para salir, ahora es inmediato, pero para entrar sigue pasando lo mismo». La sesión anterior dejó anotada una hipótesis razonable —se escala un panel de ~1.680 px desde 0,12 hasta 1 y el navegador lo re-rasteriza mientras crece, 482 `RasterTask` y 278 `Paint`— y la conclusión de que había que **rediseñar cómo crece el panel**. Era falsa, y bastó un experimento para tumbarla:

| Escenario (CPU x12, mediana de 5) | Bloqueo |
|---|---|
| base | 266 ms |
| sin el velo en el DOM | 223 ms |
| el panel sin sombra | 211 ms |
| solo el contenido oculto (crece la caja vacía) | 317 ms |
| **TODAS las transiciones apagadas** | 221 ms |
| **el panel ENTERO fuera del DOM** | 195 ms |
| la app en reposo, sin tocar nada | **0 ms** |

Quitar el panel de la pantalla **no quitaba el coste**: seguían siendo ~195 ms. Y un perfil de CPU lo remató — el JS propio de la app no llegaba al 1 %, y solo se pedían **dos** `requestAnimationFrame` en toda la apertura, o sea que no había ningún bucle por frame. Lo que se pagaba era **el re-render de `App`**.

**La causa real:** las cuatro páginas del carrusel se construían dentro del `return` de `App` (`tabIds.map(...)` llamando a `pageFor`). Cualquier estado de `App` —`profileOpen`, el velo, el toast, la barra inferior que se esconde al hacer scroll— volvía a renderizar **Inicio + Gastos + Plan + Cartera enteras**. Es el mismo error de siempre en este repo (trabajo caro atado a un momento que no le corresponde), una planta más arriba. Ahora las páginas salen de un `useMemo` cuyas dependencias son lo que las páginas leen de verdad; fuera quedan a propósito los estados de las capas de encima, que es justo el ahorro.

A/B **intercalado** contra la beta anterior (dos servidores y pasadas alternas A,B,A,B — sin eso, en un contenedor la mediana miente), CPU x12 y 1.200 gastos:

| | antes | después |
|---|---|---|
| abrir el perfil | 339 ms | **175 ms** |
| esconder la barra al hacer scroll | 123 ms | **0 ms** |

El segundo no lo pidió nadie y es el que más se va a notar: esconder la barra inferior es un `setNavHidden` y nada más, y costaba más de 100 ms **cada vez que scrolleabas** una lista.

Dos remates, los dos medidos:
- **El perfil se premonta en un hueco libre**, detrás de las cuatro pestañas, con la misma maquinaria (`mcScheduleIdle`). Montarlo dentro del toque era pagar la pantalla más larga de la app (~1.680 px) con el dedo puesto.
- **El radio del panel deja de interpolarse.** `border-radius` no es una propiedad de compositor: animarla obliga a redibujar el panel entero en cada frame de los 0,48 s. Con `0s` y el retardo de la animación el cambio ocurre al terminar el movimiento: de ~200 tareas de rasterizado por apertura a ~60, y a la vista exactamente lo mismo. La lección ya estaba escrita para el ARRASTRE desde la 4.9.0; a la apertura por toque no se le había aplicado.

**Hipótesis descartadas, con su número, para que nadie las repita:** el velo (223 vs 266), la sombra del panel (211 vs 266), la animación del avatar (258 vs 266), ocultar el contenido del panel (317 vs 266) y apagar todas las transiciones (221 vs 266). Ninguna sale del ruido. Se suman a las dos que ya descartó la sesión anterior (desacoplar el candado de scroll de `gesture-freeze`, y `contain:paint` en el panel).

Guardián: `e2e/rendimiento-tabs.spec.mjs`. Vigila con umbral el caso del scroll (medido aquí mismo: 62-83 ms con el código anterior, 0 ms con este) y **estructuralmente** que el perfil esté premontado en reposo. El tiempo de abrir el perfil NO se vigila con umbral a propósito: la misma medida baila entre 171 y 231 ms en el CI con el mismo código, y un guardián así acaba en intermitente.

#### La APK no pasaba de la 34 a la 35: la beta nunca publicó su `apk.json`
«`apk.json` anuncia la 35, estoy en la 34, y al intentarlo no pasa nada.» No era el instalador. `beta.yml` subía a la release `beta` **solo** `bundle.zip` y `version.json`, así que en un móvil con el canal de pruebas activado `mcFetchManifest("apk.json")` daba **404**, caía a producción —que anuncia la 34, comprobado— y comparaba 34 contra 34: `return false`, sin una palabra. Verificado contra la red: `releases/download/beta/apk.json` → 404, `version.json` → 200.

- **La beta publica ya su propio `apk.json`**, y el workflow **no publica** si el APK que anuncia no existe (una descarga que da 404 se ve en el móvil igual de muda que este fallo).
- **Ningún camino de la APK se calla.** `_mcCheckApkUpdate` tenía cuatro `return false` mudos; ahora deja siempre escrito el porqué en una línea con los datos que hacían falta —qué canal se ha leído, qué número ofrece y cuál llevas puesto— y Ajustes lo pega al «estás a la última», que era la frase que tapaba el fallo. Lo mismo en el pill de instalar y en la notificación: tocar y que no ocurra nada ni se diga nada es indistinguible de una app rota.
- El vigilante de fondo (`OtaCheckWorker`, Java) también mira ya el canal que toca para la APK. ⚠ Eso es nativo: entra con la **APK 36**, no con la 35.

Guardián: `tests/updates.test.mjs` ejecuta el trozo REAL del monolito con `CapacitorHttp` de mentira y reproduce el fallo exacto (canal beta + sin `apk.json` + 34 contra 34), comprueba que con el manifiesto puesto sí se ofrece la 35, que ningún camino se queda mudo, y que `beta.yml` sigue subiendo el asset.

#### El veredicto de la beta dice ahora qué APK llevaba puesta
Costó una sesión entera: «en Deudas sigue igual» con los arreglos ya publicados, sin forma de saber si los tenía instalados —esa noche salieron seis betas seguidas— ni si el fallo era nativo o web. El parte viaja ya con el `versionCode`, y el panel lo enseña en la cabecera junto a la versión web.

**Sobre «Gastos se queda a medio pintar»: no se ha reproducido.** Se montó el camino de su vídeo (arrancar, esperar, deslizar a Gastos con el dedo, CPU x12, 1.200 gastos) y se midieron las filas y su opacidad a los 120 ms, 500 ms y 2 s de soltar: 12 filas, opacidad 1, ninguna a medias, ninguna desvaída. Queda **abierto y sin tocar** — a ciegas no se arregla. Lo que sí se ha hecho es quitar la parte que impedía diagnosticarlo: el veredicto dirá en qué compilación y con qué APK lo ve.

Tanda salida entera del buzón de sugerencias de la app. Cuatro de ellas escritas por él la noche del 26, y **dos de su pareja que llevaban DIEZ DÍAS sin que las leyera nadie** — el script `errores.mjs` las traía mezcladas con los pings y sin icono propio, así que nadie miraba. Primer arreglo de la tanda: `npm run sugerencias`.

#### «En deudas y metas se relentiza de manera muy bestia» + «al deslizar va a tirones las primeras veces»
Eran el mismo problema, y **en un portátil no se ve NADA**: cero tareas largas. Hubo que estrangular la CPU x6 por CDP (`Emulation.setCPUThrottlingRate`) para reproducir lo que él ve en el móvil. Medido así, antes de tocar:
- 1ª deslizada: tareas largas de 218+149+69+65 ms · 2ª: 97 ms · 3ª y 4ª: limpias. Exactamente «las primeras veces va a tirones, luego se suaviza».
- Entrar por primera vez en Deudas y Metas: **171 ms de hilo bloqueado**; en Gastos, 77 ms.

Dos causas independientes:
- **Un `scrollLeft` en el peor momento.** El efecto que devuelve los chips de Gastos al inicio corría justo después de montar la pestaña, con el layout entero sucio: escribir `scrollLeft` fuerza un recálculo **síncrono**. El perfilador le atribuye **276 ms** a esas dos líneas. Ahora va a un hueco libre (`mcScheduleIdle`) y solo escribe si hay algo que resetear.
- **Las pestañas se montaban dentro del gesto.** `prepMountTab` corría en el `touchstart`/`onMove`, o sea pagando el montaje mientras el dedo arrastra. El coste no se puede evitar, pero sí elegir cuándo se paga: ahora se montan de una en una en huecos libres, antes de que nadie toque nada. Se conservan los 3,2 s del primer hueco (bajarlos reabre el hitch de los 900 ms con WhatsNew) y el `prepMountTab` del toque, como red.

A/B contra el código anterior, mismo escenario: **171 → 0 ms** en Deudas y Metas y **77 → 0 ms** en Gastos. Guardián: `e2e/rendimiento-tabs.spec.mjs`.

**Trampa que casi cuesta un arreglo falso:** la primera medición señalaba a `getBoundingClientRect` con 350 ms de tiempo propio. Era **Playwright**, que sondea el DOM desde su script inyectado mientras `locator.click()` y `waitFor()` esperan. Al medir con un click crudo y una espera a ciegas, desapareció.

**Y de propina, un peaje que no compraba nada:** el gesto seguía encendiendo y apagando el indicador de puntitos del swipe (`showDots` + `dotsTimer`, con `revealDots()` al declararse el eje horizontal y `hideDotsSoon()` 1,1 s después). Ese indicador **se lo llevó por delante el rediseño v4** — `.app.v4 .dots{display:none !important}` y ningún render crea ya el elemento (comprobado buscando `showDots` y `className:"dots"` en todo `src/`: cero apariciones fuera de la propia maquinaria). O sea **dos re-renders completos de `App` por cada pasada de dedo entre pestañas, para no pintar absolutamente nada**. Retirado; el CSS se queda por si el indicador vuelve. Guardián nuevo: `e2e/swipe-pestanas.spec.mjs`, que cubre lo que `rendimiento-tabs` no miraba — que deslizar **funcione** (las cuatro pestañas ida y vuelta, sin descarrilar en la última, con contenido de verdad al llegar). Hacía falta ahora que el montaje vive FUERA del gesto: un montaje que llegue tarde daría pestaña en blanco sin que ninguna tarea larga se entere.

Las tres trampas de medir gestos táctiles (el splash tapando la pantalla, las zonas con `stopSwipe` que invalidan la muestra, y el perfilador distorsionando más de lo que mide) quedan escritas en `AGENTS.md` §7 bis.

#### Y quedaba un tirón más, que NO era del gesto
Con la limpieza puesta, el A/B seguía dando **65 ms de tareas largas en la primera deslizada** (antes 74; tres vueltas sin solape, 71/74/78 → 62/65/68). O sea: el arreglo grande se había llevado los 500 ms, pero quedaba un pellizco. Dos experimentos para saber de quién era:

- **Llegar a Gastos por CLICK, sin gesto ninguno: 66 ms.** Y después, el primer arrastre: **0 ms**.
- **Un arrastre corto que no llega al umbral** (toca toda la maquinaria del gesto, pero no cambia de pestaña): **0 ms**. Y el arrastre completo justo después: 67 ms.

Conclusión: **el gesto no costaba nada**; el coste era *entrar en Gastos la primera vez*, se llegara como se llegara. `Tracing` (no `Profiler`, que a 6× de freno distorsiona más de lo que mide) lo puso en un sitio concreto: de esos 67 ms, **59,7 eran un `Layout` completo** —1.196 objetos, `partialLayout:false`—, y contando etiquetas antes y después del cambio salían **~50 nodos nuevos de golpe**: la tarjeta de suscripciones detectadas.

El culpable, `heavyOk` en `04-tab-gastos.js`: la detección de suscripciones esperaba a que la pestaña estuviera **activa**. Es exactamente el mismo error que tenía el montaje de las pestañas —trabajo caro atado al momento en que el usuario toca— y se arregla igual: **no se puede evitar el coste, pero sí elegir cuándo se paga**. Ahora se adelanta a un hueco libre aunque la pestaña no esté activa, con tope generoso (4 s frente a los 40 ms de cuando sí lo está) para que no se cuele a la fuerza en mitad del arranque, que es el rato más ocupado.

Medido después, con solo 600 ms de reposo antes de tocar nada — o sea el caso que él describe, «las primeras veces»:

| | 1ª deslizada | 2ª | 3ª |
|---|---|---|---|
| beta anterior (`f1ce06d`) | 74 ms | 0 | 0 |
| + limpieza de los puntitos | 65 ms | 0 | 0 |
| + `heavyOk` adelantado | **0 ms** | 0 | 0 |

Y el precio, que lo tiene: en los 8 primeros segundos el total de tareas largas sube de **762 a 800 ms** (mediana de 3 vueltas) porque ese trabajo ahora se hace igualmente, solo que en reposo. Lo que NO se mueve es lo único que se nota: **la tarea más larga del arranque sigue en ~205 ms** (203 → 206, dentro del ruido) y la app tarda lo mismo en estar lista (1.517 → 1.564 ms, con las vueltas sueltas solapando: 1.459-1.544 antes, 1.457-1.602 después). Guardián: `rendimiento-tabs.spec.mjs` comprueba **estando en Inicio** que las filas de suscripción —que solo viven en Gastos— ya están pintadas. Es estructural a propósito, no de tiempos: un guardián de milisegundos en CI acaba en flaky. Verificado que falla con el código anterior.

#### Capítulo 3 y último: el lag no estaba donde llevábamos cuatro versiones mirando
Rechazos .17, .19 y .23, siempre con la misma frase suya: «al entrar en Deudas, **moverte**, y luego deslizar». Esa palabra era la pista y no la habíamos usado: **entrar** ya costaba 0 ms; el problema aparecía solo si habías scrolleado dentro. Escenario reproducido y medido con la CPU estrangulada (rate 12, para parecerse al CI, que es más lento que un portátil): **170 ms de tareas largas → 0**. Cuatro causas, ninguna de ellas «el gesto»:

1. **`pointer-events` es una propiedad HEREDADA, y la tocábamos en la raíz.** `freezeShell` añadía `gesture-freeze` al shell, cuya única regla es `pointer-events:none`. Cambiar una propiedad heredada en la raíz **invalida el estilo del árbol entero**: un solo `UpdateLayoutTree` de 28,6 ms, el trozo más gordo de la tarea que rompía el frame. Tiene sentido en el perfil y el cajón, que se superponen; deslizando entre pestañas no protege de nada, porque un arrastre de más de 10 px ya no genera click. **Fuera para `kind==="tab"`. Solo esto: de 79 a 0-50 ms.**
2. **`translateX(%)` en vez de píxeles.** Un porcentaje dentro de un `transform` se resuelve **contra el ancho del propio elemento**, así que hay que consultar el layout para saber a cuántos píxeles equivale. Escrito una vez da igual; escrito en cada `touchmove`, se paga por frame y saca la animación del compositor. Con `translate3d(px,0,0)`: **146 → 76 ms**.
3. **`offsetWidth` leído en cada `touchmove`.** Layout-thrashing de manual. Y explica por qué solo se notaba «si te movías dentro»: sin scroll el layout está limpio y la lectura sale gratis, pero al congelar el scroll se pone `overflow:hidden`, eso lo ensucia, y **entonces** cada lectura fuerza un reflow completo. Hacían falta las dos cosas a la vez, y por separado ninguna cantaba. Ahora se mide una vez al empezar el gesto.
4. **`prepMountTab` en cada `touchmove`** — ~35 llamadas por arrastre para no cambiar nada (React se ahorra el re-render, pero no la llamada). Una marca por gesto basta.

Y el congelado del scroll, que era el arreglo del .17, solo se pone si de verdad hay momentum (hubo scroll en los últimos 200 ms). Si scrolleaste, paraste y luego deslizas —el caso normal— no hay nada contra lo que pelear.

#### El «stopper» no era un freno: te abría Ajustes
«Hay un stopper o algo que no permite deslizar de manera seguida y rápida.» Reproducido midiendo: tres arrastres encadenados daban `gastos → inicio → ninguna pestaña activa`. Y que no haya ninguna activa significa una cosa: **se abrió el cajón**. En Inicio, un desliz a la derecha abre Ajustes desde toda la pantalla (atajo puesto el 17/7, deliberado). Está bien como gesto buscado, pero encadenando deslizadas hacia atrás llegas a Inicio y **la siguiente te planta Ajustes en la cara**. Ahora el atajo de pantalla completa no cuenta si acabas de cambiar de pestaña (<450 ms); desde el borde izquierdo sigue funcionando siempre. Guardián nuevo en `swipe-pestanas.spec.mjs`, verificado que falla sin el arreglo.

#### La versión del APK: era el `versionName`, o sea la misma que la web
Tercera vez que lo pedía. Se mostraba `info.versionName` = `"4.12.0"`, **idéntico a la versión web**, así que la fila no decía nada nuevo. Lo que distingue una APK de otra es el `versionCode`. Ahora sale `4.12.0 (35)`.

#### Capítulo 2 de «en deudas y metas se relentiza de manera muy bestia»
Él aprobó el deslizar («va de 10, espectacular, súper fluido») y **siguió marcando esto como fallo**. Tenía razón: quedaba un montaje al tocar, un piso más abajo. Los tres segmentos de Plan se pintaban con `seg==="deudas" && <Debts/>`, así que estrenar Deudas montaba el componente entero **dentro del toque**. Medido con la CPU x6: **203 ms de hilo bloqueado** recién abierta la app, 119 ms con ella reposada. Ahora se montan en huecos libres y luego solo se enseñan y esconden. **203 → 0 ms**.

Se esconden con `height:0 + overflow:hidden + visibility:hidden` **a propósito, no con `display:none`**: `display:none` se salta el layout, así que el coste no desaparecería, solo se mudaría al momento de enseñarlo — que es exactamente la trampa que ya costó una vuelta con `content-visibility`.

⚠ **Y lo que de verdad hay que aprender de esto: el guardián no lo veía.** `rendimiento-tabs.spec.mjs` medía *entrar en la pestaña Plan*, que aterriza en **Recibos**, y nunca tocaba el segmento de Deudas. Pasaba en verde mientras él seguía viendo el tirón, dos versiones seguidas. **Medir lo que toca el usuario, no lo que es cómodo de medir.** El guardián comprueba ahora que los tres segmentos estén montados por adelantado.

#### Los dos fallos de la lista de Gastos, que eran el mismo trozo de código
- **«Cuando bajas hacia abajo RAPIDÍSIMO deslizando se para cada cierto tiempo.»** El centinela del scroll infinito se vigilaba con `rootMargin:120px` —o sea que la tanda siguiente no se pedía hasta tenerlo casi encima— y llegaban de 12 en 12. En un desliz rápido te comes el final antes de que dé tiempo a pintar. Ahora se pide con **600 px de antelación y de 24 en 24**; la primera tanda sigue siendo de 12, que es lo que vigila el presupuesto de rendimiento.
- **«Cuando le doy otra vez a "Este mes" no carga nada aun esperando un rato.»** Fallo de verdad, y llevaba escondido desde siempre. El observador se creaba en un efecto atado a `filtered.length`, pero **el centinela solo existe mientras `visible < filtered.length`**: al llegar al final de la lista se desmonta, y el observador se quedaba mirando un nodo huérfano. Volver a pulsar el filtro que ya estaba puesto resetea `visible` a 12 **con la misma lista**, así que el centinela renacía sin que `filtered.length` cambiara → nadie lo vigilaba → «Cargando más…» clavado para siempre. Ahora se ata al nodo con una *callback ref*, que se dispara exactamente cuando el centinela nace o muere.

#### El panel de revisión ya no te hace repetir lo que diste por bueno
Petición suya: «si algo funciona CREO que no debería reventar con otra compilación». El reseteo por compilación arreglaba una cosa y rompía otra — las cruces sí tienen que volver a preguntarse, pero los ✓ también se borraban, y volver a probar siete puntos que ya iban bien es lo que hacía que no se acordara de nada («los pillo en momentos diferentes»). Ahora los ✓ y los «no lo puedo probar» se guardan aparte, **casando por el TEXTO del punto y no por su posición**: si reescribimos una nota vuelve a preguntarse (ha cambiado lo que se prueba), si es idéntica viene ya marcada, y reordenar las notas no cruza los cables. Los ✗ no se heredan nunca. El panel dice cuántos vienen heredados, para que no parezca que se ha inventado unos ✓.

#### «No me ha leído un ingreso de la caixa, he tenido notificación y todo» (16 jul, sin leer hasta hoy)
Cierto, y era de diseño: `importObExpenses` filtraba por `tx.card && tx.amount>0` — **solo compras con tarjeta**. El saldo del banco sí se aplicaba (el patrimonio salía bien), pero el ingreso no aparecía como movimiento, así que desde fuera la app parecía no haberse enterado. Ahora entran también los importes negativos (convención del servidor: `CRDT → -amt`) con categoría `ingreso`. Los cargos que **no** son de tarjeta siguen fuera a propósito: son los Fijos, y contarlos aquí sería contarlos dos veces. `tests/ob-ingresos.test.mjs` fija el convenio de signos por escrito.

#### «El mensaje al actualizar cuentas hay que cambiarlo a uno más claro y conciso»
Era `showToast("🏦 "+label+": "+eur(bal))`: un importe suelto, sin verbo, **del primer banco de la lista aunque hubieras sincronizado tres** — parecía que solo había funcionado uno. Y llegaba junto a un segundo toast con las compras importadas, dos avisos por una sola pulsación. Ahora, cuando lo pides tú, sale **uno**: `✓ CaixaBank al día · 1.234,56 € · 3 movimientos nuevos` (o `✓ 3 bancos al día` con varios). En la sync que dispara la notificación del banco se mantiene el aviso de movimientos nuevos, que ahí sí es la única señal.

#### Notas de versión en tres idiomas
Petición suya. `t` e `items` aceptan ahora `{es,en,ca}` además de texto suelto. **El histórico anterior se queda en castellano a propósito**: 68 versiones y 279 entradas son 55 KB, que por tres idiomas serían 165 KB con el presupuesto en 277 KB de 310 (gzip). Además, las notas de la 4.11.0 se reescribieron: eran el contraejemplo de la regla de tono de `AGENTS.md` §4 (le hablaban a él, contaban la cocina).

#### Identidad: el icono era el de Capacitor
El icono del escritorio y el splash nativo seguían siendo **la X azul por defecto de la herramienta**, mientras la pantalla de carga web llevaba la cartera menta desde la 4.10.0: tres identidades en dos segundos, justo en la primera impresión. `scripts/iconos.mjs` rasteriza el SVG de la marca a los 26 ficheros (mipmaps, adaptativo y splash por densidad) con el Chromium que ya trae Playwright — sin dependencias nuevas. El fondo adaptativo pasa de `#FFFFFF` a `#0C1712`. **Necesita APK nueva: un icono nativo no viaja por OTA.**

#### Y la barra de carga del splash, fuera
«El resto de apps no lo tienen; el tiempo ese que se queda el logo está bien.» El botón de reintentar se queda: es la única salida si algo se atasca de verdad.

#### Capítulo 3 del lag: scrollear Deudas/Metas y deslizar acto seguido
El premount dejó el montaje a 0 ms, pero él seguía viendo tirones si **se movía dentro** del segmento y deslizaba enseguida (rechazo 4.12.0.17). Causas: el momentum del scroll vertical peleaba con el `translateX` del track (el perfil ya congelaba el scroll; el swipe de pestañas no) y `onPageScroll` seguía llamando a `setNavHidden` durante el gesto → re-render de App entera. Ahora, al fijar el eje horizontal, `freezeShell(...,"tab")` congela el scroll de la página activa, y `onPageScroll` ignora eventos mientras `dragging.current`. Guardián: `rendimiento-tabs` con el caso scroll→swipe a CPU ×6.

#### Bancos caídos: noti → banner de Cartera, una sola autorización
Tras sincronizar con un banco caducado, la app abría sola Mis bancos (y a veces OAuth). Con dos bancos caídos se lanzaban dos autorizaciones: Enable Banking devolvía `error=invalid_request` en la segunda aunque el banco dijera «Operación realizada correctamente» (el `state` es de un solo uso). Ahora la noti / `handleGoto("banks|…")` solo deja Cartera con el banner; el CTA del banner es el único toque que llama a `bankConnectOnce` (candado compartido con Mis bancos). Mis bancos pinta coral si `state.bankIssues` marca el banco aunque `bank_links.status` siga `active`. Mensaje propio para `invalid_request`.

#### Trade Republic desconectado deja de quedarse mudo
TR no pasa por `bankIssuesOf` (no es Open Banking). Al caducar de verdad: toast + notificación estable (`gotoTarget: tr|reconnect` → Cartera) + evento `mc-tr-status` para refrescar el banner; el CTA abre Mis bancos con la tarjeta TR, nunca OAuth. El resumen de Ajustes cuenta TR desconectado.

#### Candado del perfil afinado (el «stopper» de 560 ms)
Se mantiene (corta un `.dragging` a mitad de cierre), pero: candado síncrono al cerrar de verdad, cierre permitido durante la apertura, `transitionend` limpia el timeout y solo vale la generación actual, fallback 500 ms. Guardián nuevo: abrir y cerrar al momento.

#### Ajustes enseña OTA y APK
`nat.appInfo()` al montar → pie y fila de actualizaciones: `web vX · app Y`. Sin APK nueva: el puente ya estaba en la 35.

## [4.11.0] — 2026-07-25
### El splash no se veía (y el motivo era de libro), bienes fuera de las cuentas

#### El splash: existía en el HTML y no lo veía nadie
Feedback del usuario, con vídeo: «¿has aplicado el splash? porque no furula». Tenía razón, y `grep` no lo habría cazado nunca — el elemento estaba en el artefacto desplegado. Dos causas, las dos comprobadas midiendo el DOM en el navegador (no leyendo el código):
- **Estaba DENTRO de `#root`, y `ReactDOM.createRoot()` vacía su contenedor en el primer render.** React se lo llevaba por delante al montar. Y el vigilante esperaba a `#root` con **más de un hijo** para retirarlo — condición que por eso mismo no se cumplía jamás. Medido: `#mc-load` ausente del DOM ya a los 150 ms. Ahora es **hermano** de `#root` y el vigilante mira `>0`.
- **React, ReactDOM y supabase-js iban en el `<head>`.** Un `<script>` inline bloquea el parser: el navegador no llegaba al `<body>` —y por tanto no tenía nada que pintar— hasta haber ejecutado ~600 KB de JS. Eso es el negro que se ve en el vídeo entre el splash nativo de Android y la app. Movidos justo DESPUÉS del splash, conservando el orden entre ellos.
- Además: **mínimo 520 ms en pantalla** (con la nube resuelta, `__mcBootReady` llegaba antes de que React pintara y el splash se iba en un frame — un parpadeo se lee como un fallo) y **dos `requestAnimationFrame` antes de montar** en `12-boot.js`, para que el hilo suelte y se pinte lo que ya está en el DOM.
- `e2e/splash.spec.mjs` (3): que sea hermano de `#root`, que los scripts pesados vayan después, y que **siga en pantalla después de que React monte** — que es lo único que significa «se ve».

#### Corrección a la 4.10.0
La nota de la 4.10.0 decía que el splash tapaba «el patrimonio viejo un segundo antes que el bueno». **Era falso**: el número no venía mal, es una **animación que cuenta hasta la cifra final** (se ve clarísimo a 8 fps: 11.195 → 73.427 → 87.164 → … → 189.394 en menos de un segundo). El splash sigue teniendo sentido —tapa el arranque— pero por el motivo correcto.

#### Bienes fuera de «Tus cuentas»
Al hacer Cartera ordenable, el piso y el coche quedaron dentro del bloque de las cuentas del banco («¿por qué has metido bienes junto con mis cuentas? sepáralo»). `Wealth` acepta ahora `parte` (`"cuentas"` / `"bienes"`) y Cartera los pinta como dos bloques ordenables independientes. Sin `parte` sigue pintando los dos, que es como lo usa el resto de la app.

#### Perfil: cerrar es abrir al revés, con los mismos números
Petición literal: «es hacer exactamente lo mismo que cuando se abre pero al cerrarse… que si alguien le da por mantener el dedo mientras se va con la animación, que no se vuelva loco».
- **Las dos direcciones iban a ojo y por separado**: abrir dividía por 0,55 y elevaba a 0,85, cerrar por 0,48 y a 0,88; y el umbral de abrir pedía `0,16·alto` mientras el de cerrar se conformaba con `0,062·alto` — casi el triple de diferencia. El mismo dedo daba dos sensaciones distintas. Ahora hay UNA definición (`profResist`/`profPasa`, `PROF_DIV`/`PROF_POW`/`PROF_TH`) que usan los dos sentidos. De paso, abrir baja de 0,16 a 0,11 (~136 px → ~95 px en su móvil): en el vídeo se ve el panel asomar y cerrarse solo una y otra vez porque el tirón no llegaba.
- **Candado durante la animación** (`profBusy`). La transición dura 0,48 s; un gesto nuevo en ese rato ponía `.dragging`, que es `transition:none`, cortando la animación en vuelo → el panel saltaba de donde iba a donde dijera el dedo, con el velo y el avatar a medio camino. Eso es «volverse loco». Se libera con `transitionend` y, de respaldo, a los 560 ms (si la pestaña pierde el foco el evento no llega y el gesto se quedaría muerto para siempre). Se marca también en los dos `End`, no solo en el efecto: cuando el tirón no llega al umbral el estado no cambia, así que el efecto no corre y **el rebote de vuelta se quedaba sin proteger** — justo el caso de «lo intento, no llega, y lo vuelvo a intentar».
- `e2e/perfil-simetria.spec.mjs` (2): que abrir y cerrar compartan curva (paso a paso, `abrir + cerrar = 1 + s0` en todo el recorrido) y que un gesto lanzado durante la animación se ignore sin dejar estilos inline.

#### Segunda vuelta: rechazada por el usuario en su móvil, y con razón (2026-07-26)
Primera beta que llega de verdad a un móvil (la anterior no se podía ni descargar). Veredicto en `app_events`: **3 ok / 2 fallos**, los dos del perfil — «al mantener el dedo y deslizar, a la mínima vuelve a la posición inicial con la pantalla del perfil abierta». Eran dos causas distintas con el mismo síntoma:

- **El umbral de cerrar se dobló.** Unificar abrir y cerrar «con los mismos números» sonaba bien, pero se unificó por arriba: cerrar pasó de `dist > 0.062·h` (~52 px) a `0.11·h` (~94 px). El tirón de siempre dejó de llegar y el panel rebotaba a abierto. La **curva** sí se comparte (era lo que él pedía: «lo mismo que al abrir pero al revés»); el **umbral** no puede, porque los dos gestos no compiten contra lo mismo: abrir pelea con el scroll de Inicio y con el cambio de pestaña, cerrar solo con el scroll del propio panel, que ya se resuelve antes. `PROF_TH_OPEN` / `PROF_TH_CLOSE`, con el porqué escrito al lado para que no se vuelvan a igualar.
- **El candado se comía el segundo intento.** `profMarkBusy()` se llamaba al final de CUALQUIER gesto: también en el rebote de «he tirado y no ha llegado» y en un toque suelto. Sin transición no hay `transitionend`, así que el candado agotaba sus 560 ms y el siguiente intento —que es lo que uno hace inmediatamente— no llegaba ni a empezar. Ahora solo lo pone el efecto de `profileOpen`, o sea cuando el panel se va de verdad: cortar un rebote es inofensivo, cortar el cierre es lo que se veía «loco».
- **Guardas nuevas** en `e2e/perfil-simetria.spec.mjs`: cerrar DESPACIO y CORTO (70 px en 350 ms, por debajo del umbral de velocidad para que solo decida el recorrido) y «tiro, no llega y vuelvo a tirar». Las dos pruebas que había arrastraban 240-320 px de golpe: ni un pulgar hace eso ni ese tirón deja de colar por velocidad, y por eso no vieron nada. Además se quitó una **intermitencia real** del test de simetría (leía la escala sin esperar al `requestAnimationFrame` que la pinta, así que a veces medía el frame anterior — ya tumbó un `npm test` entero).

#### Tercera vuelta: el fallo del perfil era otro, y esta vez se ha REPRODUCIDO (2026-07-26)
Las dos causas de arriba eran reales pero no eran LA causa: el usuario volvió a rechazarlo. En vez de seguir leyendo código se montó un banco de pruebas con dedos realistas (lento, con temblor de ±2 px, con pausas) y **con el panel scrolleado**, que es lo que ninguna prueba había hecho nunca — todas empezaban con el perfil arriba del todo, justo la situación en la que el gesto siempre funcionó.

- **Reproducido a la primera:** con `scrollTop=220` (lo normal, el contenido mide ~1.680 px y uno MIRA el perfil antes de cerrarlo), un arrastre de 132 px hacia abajo **no cierra nada**: solo scrollea, y al soltar el perfil sigue abierto. Con la regla vieja —«mientras quede scroll, el dedo es del scroll»— para cerrar había que recoger los 220 px de scroll **y además** arrastrar otros 53 en el mismo gesto: 273 px de un tirón en una pantalla de 851.
- **`e.preventDefault()` nunca hizo nada.** React ata `onTouchMove` al contenedor raíz **en modo pasivo**, y en un listener pasivo `preventDefault` es papel mojado: el navegador se quedaba el gesto para scrollear y el cierre competía contra él y perdía. Lo único que dejaba era un aviso en consola («Unable to preventDefault inside passive event listener invocation») que no rompía ningún test — se vio al instrumentar. Los listeners del panel se registran ahora a mano con `{passive:false}`, y de paso `touchcancel` cuenta como final (si el sistema se lleva el dedo, el panel ya no se queda encogido a medias y con `.dragging` puesto).
- **De quién es el dedo se decide AL POSARLO, no en cada frame.** La franja de arriba (72 px) es asa y cierra esté como esté el scroll — apuntar a `.profile-pull-h` no valía porque la cabecera se va con el scroll, comprobado. Fuera de esa franja manda dónde estaba el scroll al empezar, y si llega al tope durante el mismo gesto el cierre toma el relevo re-anclando **una vez** (verificado: 220 px de scroll se recogen y el panel empieza a encoger sin soltar).
- **Tres e2e nuevos con el panel scrolleado** (relevo, asa, y que un gesto corto en el medio SCROLLEE y no cierre). E2E 69 → 72.

#### Novedades enseñaba una versión que no era
`WhatsNew` comparaba `r.v === CONFIG.APP_VERSION`, y en beta la versión que corre lleva sufijo (4.11.0.8) mientras las notas van por versión base (4.11.0): no casaba nunca, así que **ninguna entrada salía marcada como «tu versión»** y la cabecera ponía 4.11.0 estando en la .8. Se casa por base (`mcVerBase`, extraído de `betaChecklist`, que ya lo hacía bien) y se enseña el número real.

#### «Las notis se duplican» — el id salía del reloj
`Notif.show(...)` recibía `(int)(System.currentTimeMillis() % 100000)` desde las DOS rutas que la usan. Android reemplaza una notificación solo si repites su id, así que con uno nuevo cada vez **cada aviso se apila en vez de sustituir al anterior**. Y en los avisos de actualización hay dos emisores para lo mismo (el `OtaCheckWorker` con la app cerrada y la web con la app abierta), cada uno con su id. Ahora `Notif.idFor(tag)` da ids estables por propósito, el worker y la web comparten los del update, y la confirmación de un gasto se identifica por el gasto.

Y había un segundo emisor descontrolado: **`OtaCheckWorker` miraba SIEMPRE producción**, sin saber del canal. En un móvil en beta eso son dos avisos con números distintos para lo mismo. El canal viaja ahora en `syncOtaState` (lo sabe la web, vive en su `localStorage`) y el worker lee el manifiesto que toca. La parte del aviso de APK sigue saliendo de producción a propósito: la release `beta` solo lleva el bundle web.

Y la mitad que sí viaja por OTA: `_mcSyncOtaNative` copiaba la marca de «ya avisé» del nativo **tal cual**, así que una marca vieja del worker pisaba la buena y el aviso volvía a salir. Una marca solo puede ir hacia adelante.

**APK 34 / 4.11.0** compilada y firmada (`v4.11.0-beta34`, prerelease; verificado `CN=Mi Cartera` y el bundle sellado como 4.11.0, no `dev`). `public/apk.json` de esta rama apunta a ella; en producción sigue la 33/4.9.2 hasta que se promocione.

#### Y dos del canal beta, que estrenaba móvil
- **La beta se sellaba con un número distinto del que anunciaba.** `beta.yml` publica el manifiesto como `VERSION.RUN_NUMBER` (4.11.0.7) pero el bundle se sellaba con la `VERSION` pelada (4.11.0), así que `_mcNewerVer` daba `true` para siempre: **la misma beta ofrecida en bucle** («todo el maldito rato sale para actualizar») y Ajustes marcando un número que no era el que llevabas. El sello sale ahora del mismo sitio que el manifiesto (`MC_STAMP_VERSION`), y el workflow **no publica** si los dos no coinciden. Guarda en `tests/updates.test.mjs`.
- **Apagar el canal beta no volvía atrás.** El OTA solo va hacia adelante, así que el móvil se quedaba con el bundle de pruebas hasta que producción lo adelantara. `_mcApplyChannelBundle()`: cambiar de canal instala lo que toca en el canal nuevo **en la dirección que sea**, que es lo que uno espera al apagar el interruptor.

#### Proceso: el circuito completo, por fin
**Aprobada en el móvil el 2026-07-26** («aprobado, todo funciona a las mil maravillas») y promocionada con el workflow «Promocionar beta a producción». Cuatro betas hicieron falta —4.11.0.7, .8, .9 y .10—, con **dos rechazos formales** desde el panel de revisión, y esos rechazos son lo que encontró el fallo de verdad del perfil: sin ellos habría subido a producción un gesto que no cerraba. Es la primera versión que recorre el circuito entero como estaba pensado desde la 4.8.0.

**Esta versión iba al canal `beta`, no a `main`.** La 4.10.0 se publicó directa a producción saltándose el canal de pruebas que existe justo para esto, y lo estrenó el usuario en su móvil. Ver AGENTS §6.

Lleva mezclada la **4.10.2** (abajo): sin ella, este bundle no se puede ni descargar.

## [4.10.2] — 2026-07-25
### El canal beta, capítulo 2: la CSP era solo la mitad — los assets de GitHub no llevan CORS

La 4.10.1 arregló la CSP y **el canal siguió sin funcionar**: el móvil, ya con la 4.10.1 puesta y la beta 4.11.0.6 publicada, seguía contestando «✓ estás a la última · web v4.10.1». Captura del usuario, 21:26.

- **Causa real:** `github.com/.../releases/download/beta/version.json` responde un 302 a `release-assets.githubusercontent.com` y **ninguno de los dos saltos manda `Access-Control-Allow-Origin`** (verificado con `curl -H "Origin: https://localhost"`: el primero solo trae `Location`, el segundo un 200 pelado). El origen de la WebView es `https://localhost`, así que el navegador tira la respuesta y `fetch` peta con un `TypeError` vacío — **el mismo síntoma exacto que daba la CSP**, por eso el arreglo anterior pareció completo. Los assets de una Release no son CORS-friendly y no hay forma de hacer que lo sean: Pages sí lo es, y por eso el canal estable nunca falló.
- **Arreglo:** en el móvil el manifiesto lo pide **Android** (`CapacitorHttp`), que no sabe ni de CORS ni de CSP — la misma vía que ya usa el login de MyInvestor desde la 4.0.12. En web se queda el `fetch` de siempre: el canal beta solo existe dentro del APK. El `bundle.zip` no estaba afectado (lo baja el plugin nativo), pero **nunca se había descargado ni una vez** (`downloadCount: 0` en la release) porque el manifiesto jamás llegaba.
- **Se acabó el silencio.** `mcFetchManifest` cae a estable **solo con un 404** («aún no hay beta publicada»). Cualquier otro fallo se propaga: sale en el toast de «Buscar actualización» y queda en `app_events`. Un canal que no responde no es un canal sin novedades — tragárselo es lo que convirtió dos fallos distintos en el mismo «estás a la última» durante semanas.
- **Guarda:** `tests/updates.test.mjs` ejecuta el trozo REAL del monolito (lo extrae de `public/index.html` y lo corre en un `vm` con `fetch`/`CapacitorHttp` de mentira) y comprueba los cuatro casos: fallo de red → rechaza, 5xx → rechaza, 404 → cae a estable, y en nativo la petición sale por Android y **no** por el `fetch` de la WebView. El test que había copiaba `newerVer` a mano y no ejecutaba una sola línea de lo que se despliega.

## [4.10.1] — 2026-07-25
### El canal beta llevaba roto en silencio: faltaba en la CSP el dominio al que redirige GitHub

Publicación MÍNIMA a producción, y solo por necesidad: **este arreglo no puede llegar por el canal beta, porque es justo lo que impide bajar la beta.** El resto del trabajo del día (splash, bienes, perfil) se queda en `beta` esperando la prueba del usuario, como toca.

- `github.com/.../releases/download/beta/version.json` responde un **302 a otro dominio**, y la CSP se aplica también al destino del redirect. GitHub movió ese destino de `objects.githubusercontent.com` a **`release-assets.githubusercontent.com`**; en `connect-src` solo estaba el viejo, así que `fetch` moría antes de leer nada.
- **Por qué nadie lo vio:** `mcFetchManifest` cae a estable cuando el manifiesto de beta falla — una red de seguridad pensada para «la beta todavía no existe». Con el dominio bloqueado, esa red convertía el fallo en un silencio perfecto: el móvil leía el `version.json` de PRODUCCIÓN y respondía «✓ estás a la última · web v4.10.0» con el canal beta activado y la beta publicada. Lo cazó el usuario, con captura.
- **Guarda:** `tests/security.test.mjs` comprueba ahora que `connect-src` deje pasar lo que la app SÍ descarga (la nube, los tipos de cambio, GitHub y su dominio de redirect), no solo que no tenga comodines. Una CSP demasiado estrecha no da error visible: el `fetch` rechaza y el `catch` de turno se lo traga.
- **`docs-frescura`:** en la rama `beta` deja de exigir un bump de `VERSION` por cada arreglo — `beta.yml` publica `VERSION.RUN_NUMBER`, así que cada push ya sale con número nuevo. Exigir un bump por arreglo durante una ronda de pruebas es justo lo que empuja a saltarse el canal. (Detecta la rama con `git branch --show-current`: como existe también una RELEASE llamada `beta`, `rev-parse --abbrev-ref` devuelve «heads/beta».)

## [4.10.0] — 2026-07-25
### El gesto del perfil (esta vez con el caso real), el CSV que se rechazaba a sí mismo, splash, Cartera ordenable y seguridad del servidor

#### Perfil: el parpadeo era el scroll, y abrir nunca recibió los arreglos del cierre
- **El caso que faltaba: el panel SCROLLEA.** Su contenido mide ~1.680 px y en un móvil de verdad (393×851) no cabe. `profileMove` medía `ddy` desde el `touchstart`, así que si el usuario había bajado dentro del perfil y luego tiraba para cerrar, en cuanto `scrollTop` llegaba a 0 el panel **saltaba de golpe a la miniatura** — medido con CDP: `1,000 → 0,122` en un frame. Y como el scroll rebota y devuelve `scrollTop>0`, la rama de guarda limpiaba los estilos y volvía a pantalla completa. Ida y vuelta varias veces por segundo: **eso es el parpadeo entre perfil y resumen del vídeo del usuario**, y por eso el gesto no cerraba nunca. Ahora, mientras quede scroll el gesto se **re-ancla al dedo** en cada frame, así que el cierre arranca desde el tamaño real (medido: `1,000 → 0,817 → 0,738 → 0,518`).
- **Los dos e2e de perfil no lo veían** porque usan un viewport de 1.800 px de alto justo para que el contenido quepa sin scroll. Añadidos dos a tamaño de móvil real.
- **Abrir seguía roto.** La 4.9.1 quitó el fundido de opacidad AL CERRAR y dejó escrito que «abrir nunca lo tuvo». Lo tenía: `onMove` hacía `opacity: min(1, resist*3)` y `borderRadius` por frame, o sea las dos cosas que se arreglaron para el cierre en la 4.9.0 y la 4.9.1. Por eso al abrir seguía viéndose el perfil mezclado con el resumen y a tirones. **Causa de fondo: los dos gestos estaban escritos por duplicado**, así que un arreglo en uno no llegaba al otro. Ahora comparten `profileGrab()`/`profileRelease()`.
- `.v4-avatar.pulling` llevaba desde la 4.9.0 sin hacer nada: interpolaba con `--prof-p`, variable que se retiró al dejar de pintar por frame, así que la regla calculaba `scale(1)`/`opacity(1)`. Ahora es una transición de CSS y el avatar se aparta mientras la tarjeta sale de él.

#### El importador de Revolut rechazaba el fichero que él mismo necesita
- Desde la 4.9.0 el coste del oro se calcula cruzando el extracto de **Materias primas** (onzas) con el de la **cuenta en €** (euros). El usuario subió el segundo y recibió «No he podido leer el CSV (¿formato raro?)» — **habiéndolo leído perfectamente**: reproducido con sus ficheros reales, `revoMetalCostsFromFiat` sacaba `{XAU, XAG}` y los 1.000 € de sus seis conversiones. `analyzeAll` solo daba un fichero por «entendido» si sacaba POSICIONES, y ese no trae ninguna.
- Ahora ese caso tiene su propio estado (`err="fiat"`, caja neutra y no de alarma): confirma que se ha leído, **guarda los costes en `fiatRef`** y dice qué fichero falta. Como los costes se acumulan entre análisis, los extractos se pueden soltar **de uno en uno y en cualquier orden**.
- Cuando el coste sale solo se **dice de dónde sale** (`bi_metal_auto`): un número que el usuario no ha tecleado y no puede explicar no vale de nada. Y los pasos de exportación mencionan por fin el **tercer** fichero (la cuenta normal en €), que es lo que nadie podía adivinar.
- `e2e/revolut-csv-import.spec.mjs` (4). Va con e2e y no con un unitario porque los tres parsers funcionaban: lo que fallaba era lo que se PINTA a partir de ellos (AGENTS §7).

#### Splash de entrada
- Era un emoji y «Cargando…» en la tipografía del sistema — la única pantalla que no parecía la app — y se retiraba **en cuanto React pintaba**, así que se veía el patrimonio local y un segundo después el de la nube (en el vídeo: 125.899 € → 189.371 €). Un salto en LA cifra de la app es lo que más la hace parecer poco de fiar.
- Ahora lleva la marca, Fraunces y los colores del tema (que ya se aplica antes del primer pintado), y **espera a `window.__mcBootReady`**: lo pone `mcBootReady()` al terminar el primer pull de la nube, o enseguida si no hay nada que esperar (sin nube, sin sesión, con el candado o en el alta). Tope de 1,8 s para que una red mala no deje la app detrás de la cortina.
- De paso: si a los 8 s React ni siquiera ha pintado, aparece un «reintentar». Antes el vigilante se paraba y el splash se quedaba puesto **para siempre**, sin decir nada ni dejar salida.

#### Cartera ordenable · Hogar al perfil
- «Poder ordenar las cosas de la tab de cartera»: `OrderableSections` (que ya usaban Fijos/Patrimonio/Deudas/Inversiones/Metas desde la 3.94) envuelve ahora «Tus cuentas» e «Inversiones». Orden en `settings.secOrder.cartera`, o sea que sincroniza. Mecanismo nuevo: ninguno.
- «Hogar y gastos compartidos» sale del final de Cartera —donde no mira nadie— y entra **arriba del perfil**, en una sección «Tu gente» (elección del usuario entre cuatro opciones). El `InvToolsSheet` se queda FUERA de los bloques ordenables: es un portal, y dentro se desmontaría al reordenar.
- `e2e/cartera-orden-hogar.spec.mjs` (3), incluida la puerta de entrada: no basta con que el botón esté, tiene que ABRIR la pantalla (AGENTS §7, la lección de los huérfanos del rediseño v4).

#### Seguridad del servidor
- **CORS con lista blanca** (`supabase/functions/_shared/cors.ts`). Las diez funciones respondían `Access-Control-Allow-Origin: *`, o sea que cualquier web del mundo podía llamarlas desde el navegador de quien la visitara. Con `verify_jwt` hace falta además el token del usuario, pero el `*` regala una capa gratis. Se aplica envolviendo el handler (`withCors`) y no tocando cada `jsonResp`: hay decenas de puntos de retorno y una lista blanca que se aplica «en casi todos» los sitios no es una lista blanca — así pasan por el mismo sitio hasta las respuestas de los `catch`. El origen de producción sale de `APP_URL`; también valen `https://localhost` (WebView de la APK) y localhost con puerto (dev/e2e).
- **Límite de peticiones** (`0019_rate_limit.sql` + `_shared/ratelimit.ts`), contado en Postgres con una sentencia atómica porque los isolates van y vienen. `ingest` (60/min **por IP**, no por token: contar por token no frena a quien va probando tokens, que es el ataque) y `myinvestor-connect` (10 cada 10 min por usuario). Este segundo protege al usuario de nosotros: por ahí van su usuario y su contraseña reales, y un bucle de reintentos puede dejarle **la cuenta bloqueada en su banco**. Si el limitador falla, **deja pasar**: un freno que tumba la app al romperse convierte un incidente pequeño en uno grande.
- **El `state` del OAuth caduca (30 min) y se gasta.** Es lo único que ata la vuelta del banco con un usuario y viaja en la URL, así que acaba en el historial y en logs por el camino; antes valía para siempre y se podía reutilizar. Se consume ANTES de canjear el `code`, para que un fallo a mitad tampoco lo deje vivo. Los enlaces anteriores a la migración no tienen marca de emisión y se dan por buenos, para no romper una reconexión en curso.

#### Presupuesto de rendimiento
- `tests/presupuesto-rendimiento.test.mjs`: mide `index.html` **minificado** (lo que se sirve) y **gzip** (lo que baja el móvil), más los ficheros bloqueantes antes del primer pintado. Topes con ~12 % de aire sobre lo medido hoy: **985 KB / 277 KB / 3**. El tamaño es lo que crece de uno en uno sin que nadie lo mire, hasta que un día la app tarda cinco segundos en abrir y no hay un commit al que señalar.
- `tests/edge-sintaxis.test.mjs`: pasa las Edge Functions por el parser de esbuild (Deno no está instalado y `deno check` se omite en silencio) y falla si alguna vuelve a poner el origen en `*`. Nace de esta misma tanda: envolver diez handlers son diez paréntesis que cerrar a mano, y ese fallo aparecería en otro workflow, después de creer que ya estaba publicado.

#### Tests
- Nuevos e2e: `revolut-csv-import` (4), `cartera-orden-hogar` (3) y dos más en `profile-anim` a tamaño de móvil real. **E2E de 53 a 62.** Nuevos unitarios: `edge-sintaxis`, `presupuesto-rendimiento`.
- **Sin APK nueva**: no se toca nativo, así que la 4.10.0 va entera por OTA y el APK 33 se queda como está.

## [4.9.2] — 2026-07-25
### Incidente: el APK 32 salió con texto corrompido y SIN sellar la versión

Dos fallos de proceso míos, los dos detectados por el usuario en su móvil, y los dos con guardián.

#### `APP_VERSION: "dev"` — el APK que no podía actualizarse nunca
- El APK 32 se empaquetó copiando `public/` → `www/` **a mano con `Copy-Item`** en vez de con `scripts/build-www.mjs`, que es quien SELLA `APP_VERSION` desde el fichero `VERSION`. El bundle salió con el placeholder `"dev"`.
- No es cosmético: `_mcNewerVer` hace `parseInt("dev")` → `NaN`, y `4 !== NaN` entra en el `if` devolviendo `4 > NaN` = **`false`**. La comparación de versiones falla SIEMPRE → **ese móvil no vuelve a recibir una actualización jamás**, sin un solo error visible; solo un discreto «vdev» en Ajustes. Por eso el usuario no recibió nada de la 4.9.0 ni de la 4.9.1 y creía que el fix del perfil no funcionaba: nunca le llegó.
- `build-www.mjs` **aborta** ahora si el sellado no cuaja, `npm run apk:prep` encadena build → sellado → `cap sync` para que nadie lo haga a mano, y AGENTS §6.5 lo deja escrito.

#### Mojibake: el «✓» pintado como tres símbolos sin sentido
- `(Get-Content -Raw) | Set-Content -Encoding utf8` en PowerShell 5.1 **lee el fichero como Windows-1252** y lo reescribe como UTF-8: cada acento y cada símbolo se dobla. Así se corrompieron 95 líneas de `06-sync-brokers.js` y la descripción de `package.json`, y de ahí los caracteres raros que el usuario vio en la tarjeta de Trade Republic (y 171 apariciones en los assets del APK 32).
- Fichero restaurado desde git y los cambios rehechos con herramientas UTF-8. `docs-frescura` comprueba ahora que no haya mojibake en los módulos ni en la doc — es invisible en un diff y el resto de tests pasan tan contentos.

#### APK 33 / 4.9.2
- Reempaquetada con `apk:prep` (sellada y sin corrupción), publicada y `apk.json` actualizado. **Sustituye a la 32, que no debe usarse.**

## [4.9.1] — 2026-07-25
### Los brókers se eligen y se pliegan; el cierre del perfil deja de mezclar dos pantallas

#### Brókers: se acabó el login de un banco que no tienes
- Las tres tarjetas (TR / MyInvestor / CSV de Revolut) se pintaban **siempre**. Feedback del usuario: «que te salgan directamente para loguear sin tenerlo es muy muy raro — ni mi pareja ni mi padre tienen MyInvestor y les sale».
- Chips «¿Qué brókers usas?» (`bp_which`, es/en/ca). La elección vive en `settings.brokersOn`, así que viaja con la cuenta.
- **Por defecto se deduce de la cartera**: los `ent` que ya tienen posiciones aparecen solos, de modo que quien venía usando un bróker no pierde nada sin tocar un ajuste; y quien no tiene ninguno (el padre, la pareja) ve solo los chips.
- **Acordeón también en brókers** («el colapsable de los brókers tampoco está»): el de la 4.9.0 solo llegó a los bancos de Open Banking. Ahora las tres tarjetas comparten `bkBrand()` en `02-ui-shared.js` — eran el mismo bloque copiado tres veces y mantener el plegado por triplicado era pedirlo. Sin `onToggle` la cabecera se comporta como antes, para no imponer plegado a otros usos.

#### El cierre del perfil ya no superpone dos pantallas
- Diagnóstico a partir del **vídeo del usuario** (fotogramas extraídos con ffmpeg): durante el arrastre el panel bajaba su opacidad hasta 0,2 (`1-resist*0.8`) y, como ocupa la pantalla entera, se veían **el perfil y el resumen a la vez, los dos legibles**. Eso era la «animación loquísima»: no solo el tirón de la 4.9.0, también la mezcla.
- Abrir nunca lo tuvo porque la apertura **no interpola opacidad**: el panel va opaco y solo escala desde el avatar, con el velo oscureciendo el fondo. Cerrar hace ahora lo mismo en reversa. Un fundido de una capa a pantalla completa sobre contenido siempre da papilla.

#### Que no vuelva a pasar lo de hoy
- `docs-frescura` comprueba ahora que **no queden cambios en `src/`, `supabase/functions/`, `android/app/src/` o los estáticos servidos después del último bump de `VERSION`**. El fallo real: se arreglaron TR, el oro, el gesto y los bancos, todo desplegado en Pages, con `VERSION` intacta — y como el OTA compara NÚMEROS, el móvil veía «4.8.0 = 4.8.0 → nada nuevo». El usuario se pasó la mañana esperando una actualización que no podía llegar. Doc y tests no cuentan: cambiar un comentario no obliga a publicar. Sin historia de git (checkout superficial) se salta en vez de fallar.

#### Tests
- `e2e/brokers-selector.spec.mjs` (4): sin brókers en cartera no sale ninguna tarjeta; un bróker ya usado aparece solo; marcar/desmarcar chip trae y quita su tarjeta; las tarjetas nacen plegadas y el acordeón cierra la anterior. **E2E de 49 a 53.**

## [4.9.0] — 2026-07-25
### Trade Republic en frío (capítulo 3, esta vez verificado), coste real del oro y la pestaña de bancos habitable

#### Trade Republic: la sesión ya no se pierde al cerrar la app
- **El capítulo 2 (`d404d8e`, v4.0.11) NUNCA funcionó y se dio por cerrado sin probarlo.** Comprobado el 25/07: el plugin no se había tocado desde entonces y el APK 31 que usa el usuario ya lo llevaba. El síntoma seguía intacto: «se desloguea siempre, da igual que pase un segundo».
- **Causa raíz: la cookie envenenada.** `snapshotCookies()` deduplicaba por nombre con `keep.put(name,p)`, quedándose con la ÚLTIMA aparición. Pero `tr_refresh` sale DOS VECES en la cabecera: la que restauramos nosotros con `Path=/` y la que TR sirve path-scoped a `/api/v1/auth`. RFC 6265 §5.4 las ordena de path más específico a menos → la primera es la recién rotada (buena) y la última la nuestra (ya consumida). Guardábamos la muerta, **y la volvíamos a guardar en cada snapshot**: una vez estropeada no se recuperaba jamás. Eso explica el «siempre». `put` → `putIfAbsent`.
- **Segunda causa tapada:** la WebView oculta se quedaba cargada en `app.traderepublic.com` toda la vida del proceso y la SPA de TR renueva sesión sola cada ~290 s, incluso en segundo plano y después de nuestro último snapshot. `handleOnPause` ahora aparca la página en `about:blank` tras snapshotear (salvo con llamada en vuelo); `onPageFinished` ignora `about:` para no dar por «cargada» una página sin contexto TR.
- **Diagnóstico sin cable:** al fallar, el error se lleva pegado `jarDiag()` — nombres de cookie del jar (NUNCA valores), nombres del snapshot, su edad y qué hizo el restore. Como la capa web ya manda `r.error` a `app_events`, la observación llega sola desde el móvil. Un `tr_refresh` repetido en `jar[...]` es la prueba directa de la causa 1.
- **VERIFICADO EN FRÍO** por el usuario: APK compilada e instalada por `adb`, desconectar → 2FA → matar la app → sincronizar. Entra sin pedir nada.

#### El coste del oro de Revolut se calcula solo
- Revolut parte cada conversión en dos apuntes, en dos extractos distintos: las ONZAS en Materias primas (`Conversión a XAU`, divisa XAU) y los EUROS en la cuenta principal (`Conversión a XAU`, divisa EUR). Comparten la marca de tiempo exacta, que es la única clave fiable — el 30/01/2026 hubo dos conversiones el mismo día (oro 09:19, plata 11:10), así que casar por fecha suelta mezclaría metales.
- `revoMetalCostsFromFiat()` saca `{metal → {marca de tiempo → €}}` del extracto de la cuenta. `revoMetalCost()` aplica **coste medio**: cada compra suma euros y onzas, cada venta se lleva su parte proporcional (misma convención que ya se usa con TR). `revoParseCommodities` devuelve `mov[{ts,qty}]` para poder hacerlo.
- Los costes se recogen en una PRIMERA PASADA sobre todos los ficheros: da igual el orden en que se suelten.
- Si a una sola compra le falta su pata en €, devuelve `null` en vez de un coste a medias: mejor «—» que un «sube/baja» que miente (AGENTS §1).
- Verificado contra los dos extractos reales del usuario y por dos vías independientes: **0,258218 oz, 1.000,00 €, 3.872,70 €/oz**.

#### «Mis bancos» en acordeón
- Cada banco pintaba SIEMPRE sus tres botones (Actualizar/Reconectar/Quitar): con tres bancos, nueve botones tapando lo único que se mira el 99% de las veces. Ahora se abren al tocar el banco, de uno en uno.
- El **estado** (píldora de color) sigue siempre visible aunque esté plegado: esconder que un banco está caído sería cambiar ruido por ceguera. El banco que llega por deep-link se abre solo — resaltarlo y esconderle el botón de reconectar a la vez habría sido peor que el problema.
- Teclado y lectores: `role=button`, `aria-expanded`, Enter/Espacio. Plegar cancela un «¿quitar?» a medias.

#### Rendimiento del gesto de cerrar el perfil
- `profileMove` escribía `borderRadius` en CADA `touchmove`, y border-radius **obliga a repintar el panel entero**: hasta 120 repintados de pantalla completa por segundo. El drawer de Ajustes va fino porque escribe solo `transform`. La lección estaba escrita tres líneas más arriba (para el velo) pero al radio no se le aplicó. Radio fijo + `transform`/`opacity` dentro de un `requestAnimationFrame`.

#### Seguridad y observabilidad
- **El token de ingest viaja en cabecera** (`x-ingest-token`), no en el query string: las URLs acaban en logs de proxy, trazas y Referer, y ese token es la única credencial que protege la función que apunta gastos. La Edge Function ya aceptaba la cabecera, así que no hay que coordinar despliegues y un APK viejo sigue funcionando.
- **`0018_app_events_service_role.sql`:** la tabla nunca dio privilegios a `service_role`. Consecuencia silenciosa: `logIngestError()` en `ingest` escribe con ese rol, así que **desde el 2026-07-11 no guardó ni una fila** — y como va en un `catch` vacío a propósito, nadie se enteró. La telemetría puesta para que los fallos del ingest dejaran de ser invisibles llevaba dos semanas siendo invisible ella misma.
- **`scripts/errores.mjs`:** leer `app_events` desde la consola con filtros (`--kind`, `--since`, `--grep`). Solo lectura; la clave se lee de `.env.local` (gitignored), nunca del repo. Antes cada vuelta de diagnóstico era una captura de pantalla pegada a mano.
- **MyInvestor, diagnóstico cerrado:** con el lector nuevo salieron los dos intentos (4.6.4 el 22/07 y 4.8.0 el 25/07) con el mismo error, `MI: recaptcha (token rechazado por MI — ¿dominio?)`. Confirma el riesgo anotado en la 4.6.4: reCAPTCHA v3 ata el token al dominio registrado. **La vía OTA está muerta**; queda la WebView nativa cargando la web de MI, como el puente de TR.

#### Bugs corregidos
- **La noti web de «hay versión nueva» nunca funcionó fuera del APK.** En una página con Service Worker, Chrome prohíbe `new Notification(...)` («Illegal constructor»). Y escapaba de su `try/catch` porque petaba dentro del `.then` de `requestPermission` → promesa sin capturar en la telemetría. Ahora va por `registration.showNotification()`, con el constructor como último recurso.

#### Documentación que deja de quedarse rancia
- El README anunciaba **v4.1.0 con la app en la 4.8.0** (siete versiones), y decía que Hogar estaba en Ajustes cuando se movió a Cartera en la 4.6.1. La regla de AGENTS §6 ya lo obligaba: una regla que solo vive en un `.md` se salta sin que salte nada.
- **`tests/docs-frescura.test.mjs`** (en `npm test`): falla si `VERSION` no cuadra con `package.json`, `package-lock.json`, la primera entrada del `CHANGELOG`, la primera de `RELEASE_NOTES`, el «Estado actual» del README y la cabecera + tabla del ROADMAP; y si `apk.json` no cuadra con `build.gradle`. **AGENTS §6 bis** con tabla de «si tocas X, actualiza Y» para lo que un test no puede comprobar.

#### Tests
- Nuevos: `docs-frescura`, `revo-metales-coste` (6 casos: venta parcial, venta total, pata en € ausente, dos metales el mismo día).
- **E2E de 46 a 49** con `bancos-acordeon.spec.mjs`. `e2e/fixtures.mjs` acepta `__cloudRows` para sembrar filas por tabla — antes el cliente mock devolvía `[]` para todo y no había forma de probar una pantalla que vive de la nube.

## [4.8.0] — 2026-07-24
### Revisión completa: rendimiento, concepto de los movimientos, bancos caídos, entorno de pruebas y seguridad

#### Rendimiento — la causa REAL del «cuanto más tiempo la uso, más se ralentiza»
- **Guardado partido del estado** (`mcLoadRaw`/`mcSaveRaw`, `00-core.js`). El debounce de 400 ms de la 4.5 atacaba la FRECUENCIA de las escrituras, pero el problema era el TAMAÑO: cada `set()` serializaba y escribía el estado entero —histórico incluido— y ese blob crece cada día con lo que entra del banco y del lector de notificaciones. Medido en este entorno (portátil; una WebView de móvil es fácilmente 10-20× más lenta):

  | gastos | tamaño | `JSON.stringify` | `localStorage.setItem` |
  |--------|--------|------------------|------------------------|
  | 500    | 64 KB  | 0,1 ms | 0,5 ms |
  | 2.000  | 254 KB | 1,6 ms | 1,1 ms |
  | 5.000  | 637 KB | 2,2 ms | 2,9 ms |
  | 20.000 | 2,5 MB | 8,1 ms | 11,4 ms |

  Ahora `expenses` vive en su propia clave (`micartera_v3_exp`) y solo se reescribe cuando cambia la REFERENCIA del array. Medido A/B contra `main`, 6 vueltas a primer plano: **2.000 gastos → de 477 KB a 1 KB; 8.000 gastos → de 1.912 KB a 1 KB**. Lo importante no es el factor, es que el coste **deja de crecer con el histórico**, que es justo lo que producía la degradación con el tiempo.
- **`syncCloudExpenses` ya no fabrica un array nuevo cuando no hay nada nuevo.** Construía siempre `keep.concat(add)`, así que CADA vuelta a primer plano cambiaba la referencia de `expenses` → re-render completo + reescritura del histórico. Ahora, si el resultado es idéntico, conserva el mismo array.
- **`totals` dependía de `[state]`** y `set()` sella `_savedAt` en cada llamada → el memo no acertaba NUNCA y el cálculo gordo (recorre gastos, fijos, deudas y flujos, y simula el mes día a día) se rehacía al abrir una ficha, al teclear en el buscador o al salir un toast. Ahora depende de las 14 porciones que realmente lee.
- **`parseDate` con caché de marcas de tiempo** + nuevo `dateMs()` sin asignación para comparadores. Era la función más llamada de la app (un `sort` de 2.000 movimientos son ~22.000 llamadas por render). Medido: 3,2× en el parseo de fechas.
- **Filtrado de Gastos en UNA pasada** (antes cuatro `.filter()` encadenados, cada uno creando un array del tamaño del histórico), con `Set` para categorías/bancos y los límites del período precalculados en ms (`presetBoundsMs`) en vez de construir tres o cuatro `Date` por gasto dentro de `inPreset`.
- **Filas del histórico en `React.memo`** (`MovRow`) con `onOpen` estable (`useCallback`) y un prop `l10n` para que un cambio de idioma/moneda sí las invalide.
- **`state.deleted` con tope** (`pushDeleted`, 500): crecía sin fin y viajaba entero a Supabase en cada guardado, porque `slimForCloud` no lo quita.

#### Concepto de los movimientos (petición del padre del creador)
- El dato ya llegaba y se tiraba: Enable Banking manda `remittance_information` en cada transacción y el lector de notificaciones manda el texto completo de la noti (donde va el mensaje del bizum). Ahora `mapTransaction` devuelve `note`, e `ingest` extrae el concepto con `extraerConcepto()` (etiqueta «concepto:/motivo:», entrecomillado, o lo que sigue a «por» al final — con «por Bizum» excluido a propósito por ser el cómo y no el qué).
- Migración `0017_expenses_nota.sql`: columnas `nota` + `nota_edit` (blinda lo que escribe el usuario para que un re-sync del banco no se lo pise) e índice GIN para buscar por concepto.
- `cleanNote()` descarta ruido: referencias internas del banco («REF 000123456789», «MANDATO …») y conceptos que repiten el título («BIZUM DE MARIA» bajo «Bizum de María»). Si no hay nada que decir, hueco — regla de la casa: no inventar.
- `enrichNotesFromBankTx()` rellena el concepto de los movimientos YA apuntados al sincronizar (solo huecos, nunca lo editado a mano) y devuelve el MISMO array si no hay nada que cambiar, para no provocar un render de más. El buscador de Gastos también busca por concepto.

#### Bancos sin conectar: avisar Y llevar a arreglarlo
- `bankIssuesOf()` amplía lo que se considera «hay que reconectar»: antes solo `expired`; ahora también los enlaces sin cuentas utilizables (`noacct`). Los fallos PASAJEROS (rate-limit PSD2, 5xx) siguen fuera a propósito, que ya costó un «se cae cada dos por tres» (4.7).
- Al sincronizar a mano con algún banco caído: notificación de verdad (queda en la bandeja) con deep-link `banks|<aspsp>`, y la app abre sola el panel de bancos con ese banco **resaltado y centrado en pantalla** (`focusAspsp`, clase `.bk-focus`). Sin ningún banco enlazado, en vez del callejón sin salida «No tienes ningún banco conectado», abre el panel para conectarlo.
- El banner de Cartera distingue los dos casos: «necesita tu permiso otra vez» vs «está conectado a medias» (hablar de permiso caducado cuando no hay ningún permiso que renovar despistaba).

#### Entorno de pruebas propio (petición 2026-07-24)
- **Banco de pruebas:** el estado vive en `micartera_sandbox` y `cloud` queda blindado — las 20 operaciones de escritura pasan por un envoltorio que las anula (`CLOUD_WRITES`). Las lecturas siguen vivas, que es la gracia de probar con datos de verdad. Banda naranja permanente y, al tocarla, salida.
- **Bug encontrado por su propio e2e:** salir del modo pruebas hacía `mcExitSandbox()` y luego `location.reload()`, y entre medias el volcado pendiente de `pagehide` preguntaba la clave — ya sin bandera — y escribía **el estado de pruebas encima de la cartera real**. Arreglado fijando el modo al arrancar (`mcSandbox()` pinneado); `mcSandboxFlag()` queda para la UI de Ajustes.
- **Canal beta:** `mcChannel()`/`mcSetChannel()` + `mcFetchManifest()` con caída a estable si el canal beta está vacío. La beta se publica como assets de una release fija `beta` (workflow `beta.yml`), NO por Pages — Pages sirve una sola versión y es la que usan el padre y la pareja. Ambas cosas solo se ven con `profiles.is_admin`.

#### Revisar la beta desde el móvil («code review», pero probando la app)
- `BetaReviewPanel` (Ajustes → Dev → Pruebas, solo en canal beta). **La checklist sale de
  `RELEASE_NOTES` de la versión en curso** — cero duplicación: cada release trae su lista sola, y
  `betaChecklist()` casa la beta (`4.8.0.1`) con las notas de su versión base (`4.8.0`) por prefijo.
- Cada punto se marca ✓/✗; al marcar ✗ aparece un campo para decir qué pasa. **No se puede aprobar
  con cosas sin probar ni con fallos marcados** — si esa puerta se abre, el botón no significa nada.
  El progreso se guarda por versión en localStorage: probar lleva días.
- Veredicto → `app_events` con `kind:'beta'` (tabla existente, RLS solo-admin; sin migración nueva) y
  filtro «🧪 Betas» en Actividad. `betaReport` va en `CLOUD_WRITES`: dentro del banco de pruebas no
  se manda nada.
- **El panel no despliega a propósito.** La app no puede hacer un merge de git, y meter un token de
  GitHub con permiso de escritura en Supabase sería una credencial nueva y jugosa a cambio de
  ahorrar un clic. En su lugar, `promote-beta.yml` (workflow_dispatch, exige escribir `SUBIR`)
  vuelve a pasar la suite y mergea `beta` → `main`.
- `?canal=beta` / `?canal=estable` en la URL: sin esto el canal beta era **inalcanzable la primera
  vez** — el interruptor vive en la versión que quieres probar. Sin riesgo de enlace malicioso: la
  URL de la beta está fija en el código y apunta a la release de este mismo repo.

#### Red de seguridad al desplegar (`withNotaFallback`)
- `deploy.yml` (la web) y `supabase.yml` (la BD) corren **en paralelo** en el mismo push, y el paso
  de migraciones lleva `continue-on-error: true` — a este repo ya le pasó que una migración se
  quedó sin aplicar y el job salió verde igual (la `0015` del Hogar). Sin red, el cliente nuevo
  mandaría `nota`/`nota_edit` a una tabla que aún no las tiene, PostgREST devolvería «column does
  not exist» y **el upsert de gastos fallaría entero: los gastos dejarían de subir a la nube**, en
  silencio, porque los llamantes hacen `.catch(){}`.
- Ahora `addExpense` reintenta sin esos campos si la columna no está: se pierde el concepto (una
  comodidad), nunca el gasto (el dato). La bandera vive solo en memoria, así que en cuanto la
  migración se aplique se cura sola sin tocar nada.

#### Seguridad
- **CSP** en `shell.html` con inventario documentado de cada destino permitido (`object-src 'none'`, `base-uri 'none'`, `form-action 'self'`, `connect-src` como lista cerrada) + `referrer` a `strict-origin-when-cross-origin`. Cubierta por `e2e/csp.spec.mjs`, que falla si la política bloquea algo que la app necesita — un CSP mal puesto rompe en SILENCIO.
- **Token de ingest con entropía de verdad** (`mcRandomToken`, 256 bits de `crypto.getRandomValues`). El camino de respaldo era `Date.now()+Math.random()`: predecible, y ese token es lo único que protege la función que apunta gastos en tu cuenta. Sin generador seguro ya no se activa la captura — mejor eso que una clave adivinable.
- **Comparación en tiempo constante** del token legacy en `ingest` y fuera el prefijo del token de la telemetría de errores.
- `tests/security.test.mjs` fija estos invariantes, incluido que **toda escritura nueva de `cloud` esté en `CLOUD_WRITES`** — si se olvida, el modo pruebas escribiría en producción.

#### Bugs corregidos
- **Conflicto de sincronización que no se resolvía nunca:** en el push a la nube, el id del `setTimeout` se llamaba `t` y TAPABA la función global de i18n. Dentro del callback, `t("st_sync_conflict")` lanzaba «t is not a function», el `.catch` se lo tragaba y ni salía el aviso ni se re-sincronizaba (`11-app-main.js`).
- **Textos que salían en clave:** `tb_removed`, `tb_nodel`, `tb_add`, `tb_add_hint` y `tb_trash` estaban en inglés y catalán pero NO en castellano —el idioma de la casa—, así que el toast pintaba literalmente «tb_removed». Faltaban también `fj_fixed` y `g_bank_ob` en los tres idiomas.
- `</script>` huérfano en `shell.html` y `check-syntax.mjs` mareado por un comentario HTML que mencionaba la etiqueta de script (ahora los comentarios se quitan antes de escanear).

#### Tests
- `npm test` incorpora **i18n-keys** (obliga a AGENTS.md §4: toda clave usada existe en los tres idiomas y con los mismos placeholders) y **security**.
- Nuevos unitarios: `expense-note` (concepto, poda de lápidas, `bankIssuesOf`), casos de `extraerConcepto` en el suite Deno.
- **E2E de 10 a 34**, con `playwright.config.mjs` en viewport de móvil (Pixel 5) y `PLAYWRIGHT_CHROMIUM_PATH` para entornos con Chromium preinstalado. Cubre los huecos que AGENTS.md §8 tenía apuntados (Deudas, Metas, Recibos, «Tus cuentas») más concepto, banner de bancos, modo pruebas, CSP, persistencia/migración y rendimiento con histórico grande.

## [4.7.1] — 2026-07-23
### Quitar la UI de ordenar brókers (petición del usuario 2026-07-23)
- Fuera la sección «Orden de los brókers» (flechas ↑↓) de la hoja **Herramientas de inversión** (`14-v4-screens.js`), y fuera las claves `v4_broker_order`/`v4_broker_order_h` en es/en/ca. El orden de los brókers en Cartera → Inversiones pasa a ser fijo: Revolut → Trade Republic → MyInvestor (solo los que tienen posiciones).
- **Fix de regresión introducida al quitarlo:** el reemplazo de `secOrderOf(...)` se dejó como `groups=groupsBase.map(g=>g[0])`, convirtiendo las ternas `[id,nombre,subtítulo]` en strings sueltos. Aguas abajo se leen `g[0]`/`g[1]`, así que `g[0]` pasaba a ser la primera LETRA (`"revolut"[0]==="r"`), `state.investments.filter(i=>i.ent==="r")` no casaba nada y **los tres bloques de brókers desaparecían** de Cartera → Inversiones, del desglose «Coste vs valor» y de la pestaña «Por bróker». Corregido a `groups=groupsBase` (`06-sync-brokers.js`).
- **Fix de versionado:** el bump se hizo solo en `package.json`; el fichero `VERSION` —del que leen `scripts/stamp-version.mjs` (sella `CONFIG.APP_VERSION` y el SW) y el paso OTA de `deploy.yml` (`version.json`)— seguía en `4.7.0`, así que el popup de Novedades no disparaba y el bundle OTA salía con la versión que el móvil ya tenía. `VERSION` → `4.7.1`.
- **Fix de notas:** la entrada de `RELEASE_NOTES` se había añadido como `3.96.0` (versión ya existente del 12 jul → clave duplicada) y colocada en mitad del histórico, donde no la ve nadie. Reescrita como `4.7.1` y movida al principio. Además, la nota de 4.7.0 ya no anuncia las flechas de ordenar brókers, que acaban de retirarse.

## [4.7.0] — 2026-07-22
### Notis sin duplicados + roles de cuenta excluyentes + deudas uniformes (fotos del usuario 2026-07-21)
- **Noti duplicada del «gasto tocho» (Java → APK 31):** `TrExpenseListener.handleResponse` miraba la alerta DESPUÉS de pintar la confirmación → «💥 Gasto tocho apuntado» + «✓ Gasto apuntado» con el mismo importe. Ahora la alerta se lee antes y, si es `big`, SUSTITUYE a la confirmación (y hereda el deep-link `mc_goto` que no tenía). `versionCode` 31 / `versionName` 4.7.0 preparados; **APK pendiente de compilar y publicar** (apk.json sin tocar hasta que el release exista de verdad).
- **Recibo avisado dos veces (89,54 € exacto + «90 €» redondeado):** el efecto web de la víspera corría en paralelo al intercambio de sellos `setAlertData` (asíncrono) y ganaba la carrera — el worker nativo ya había avisado la víspera con el importe exacto y al abrir la app salía la segunda, redondeada por `eur0`. Ahora el efecto SELLA PRIMERO con el nativo (`nat.setAlertData(...).then(run)`) y avisa después; todos los importes de avisos de recibos pasan a `eur()` exacto. El push del calendario conserva su efecto propio (llega al worker también con la app bloqueada o a medio onboarding).
- **reCAPTCHA:** el badge flotante de Google (`.grecaptcha-badge`) se oculta por CSS global — se quedaba FIJO abajo en toda la app tras intentar el captcha de MI; la atribución exigida por sus términos va en el flujo, junto al campo del site key (`mi_rc_badge_note`). Errores diferenciados: `mi_rc_fail_gen` (Google no emite token fuera de su dominio) vs `mi_rc_rejected` (hubo token y MI lo rechazó) — antes ambos caían en el genérico y era imposible diagnosticar.
- **Cartera / roles de cuenta:** el subtítulo del banco muestra el rol EFECTIVO («🛒 Gasto diario», «🏦 Recibos», o ambos), como pidió el usuario («como el original de Trade Republic»); fuera el badge 🛒 pegado al nombre. Chips de edición EXCLUYENTES (o Recibos, o Gasto diario, o Todo) sobre el mismo modelo de siempre (principal `spendFrom` + `settings.expenseBanks`); nuevo `settings.dailyOnlyBanks` (solo visual) apaga el «recibos» de un banco extra marcado solo-diario — sin recibos domiciliados no mueve ningún número.
- **Brókers en Cartera:** el despliegue de posiciones lleva el `rise` estándar (`.v4-inv-drop`, respeta `prefers-reduced-motion`); el orden de los bloques se configura en Herramientas de inversión con ↑↓ (`settings.secOrder.cartera_brokers`, mismo `secOrderOf` de las secciones).
- **Deudas:** `leftInfo(d)` unifica la línea de cuotas: con plazo usa `debtLeft`; sin plazo (hipoteca/préstamo) estima `ceil(bal/amort)` y total `ceil(original/amort)` → «Quedan n/tot cuotas · x/mes» sale en TODAS las tarjetas. `endsLabel` usa siempre `v4_debts_ends` («acabas en {d}»); se retira la clave `v4_debts_ends_est` («a este ritmo acabas ~»).
- Web OTA + Java (la parte nativa no llega al móvil hasta el APK 31).

## [4.6.4] — 2026-07-20
### MyInvestor: intento OTA de resolver el reCAPTCHA en la WebView
- `miSolveCaptcha(action)` + `miLoadRecaptcha(key)` + `miRecaptchaKey()` (06-sync-brokers): cargan bajo demanda `https://www.google.com/recaptcha/enterprise.js?render=<siteKey>` y ejecutan la acción para obtener un token. **Excepción consciente a cero-CDN**: solo al conectar MI (nunca en arranque; la app sigue offline-complete para el resto).
- `doConnect` refactor a `attempt(captchaToken, retried)`: ante `recaptcha`, si hay site key guardado, resuelve el token y reintenta UNA vez con `X-Recaptcha-Token` (plumbing de `miDeviceLogin`, ya existía). Telemetría distingue «sin site key» / «token rechazado por MI (¿dominio?)».
- UI: campo avanzado en la tarjeta MI para pegar el site key (`localStorage._miRcKey`), visible al saltar el captcha o si ya hay uno; instrucciones para sacarlo con devtools.
- **Límite honesto:** reCAPTCHA v3 suele atar el token al dominio registrado (myinvestor.es). Si MI valida el origen, el token de nuestra WebView será rechazado → haría falta WebView nativa (APK). Esto es el intento barato y verificable antes de tocar nativo.
- OTA only.

## [4.6.3] — 2026-07-20
### «Gasto diario» multi-banco en el chip de siempre (no un chip nuevo)
- Se retira el chip `dailyChip` («En gasto diario») que dupli­caba el concepto (feedback: «ya existía un gasto diario y me añades otro»).
- El chip de rol **«Gasto diario»** pasa a ser multi: `dailyOnFor(a)= accDaily(a) || expenseBanks.includes(a.ent)`; `toggleDaily(a)` mantiene UNA principal (`spendFrom`, primera marcada, vía `applyAccountRole`) y añade/quita las demás en `settings.expenseBanks` sin tocar su saldo (evita el doble conteo del gasto). Badge `🛒` en la lista solo para los bancos EXTRA (no la principal). Verificado: marcar Revolut deja `["trade_republic","revolut"]`, TR sigue `diario/spendFrom`, Revolut `fijos` (saldo intacto), sin chip duplicado.
- OTA only.

## [4.6.2] — 2026-07-20
### Arreglos sobre fotos del usuario
- **Barra inferior descuadrada con letra pequeña:** el `zoom` en `body` escala también `100dvh`, así que `.botnav` (`bottom:0`) flotaba por encima del borde con `smalltext` (o se salía con `hugetext`). Fix: `html.smalltext .app{height:calc(100dvh/.92)}` (y `/1.12`, `/1.26`) → tras el zoom el alto vuelve a ser la pantalla y las tabs quedan pegadas abajo en todos los tamaños. Verificado (gap 0 px).
- **«Gasto diario» multi-banco donde toca:** se retira la sección separada del fondo del editor y se pone un chip **«En gasto diario» por cuenta** (con el monograma del banco) junto a los chips de rol, en Cartera → editar cuentas. Multi-selección → `settings.expenseBanks`; el rol único `spendFrom` sigue mandando en saldo/redondeo. Badge `🛒` en la lista para las cuentas marcadas cuando hay más de una. Verificado (persiste `["trade_republic","revolut"]`, 2 badges).
- **Widget re-empuja al volver a primer plano:** además de al cambiar el estado, `updateWidget` se reenvía en `visibilitychange→visible` (MIUI/HyperOS no siempre coge el dato nuevo con la app cerrada). El código del widget (afford) ya iba en el APK 30; esto solo mejora que le lleguen los datos.
- OTA only.

## [4.6.1] — 2026-07-18
### Ajustes del lote 4.6.0 (feedback en caliente)
- **Accesibilidad:** nuevo nivel de letra `small` (`html.smalltext body{zoom:.92}`) además de normal/big/huge. `applyTextSize` togglea la clase.
- **Hogar fuera de Ajustes:** `SharedPanel` se saca del grupo de Ajustes y se abre a nivel de App por evento `mc-open-shared`, disparado desde una fila nueva en `CarteraTab` («🏠 Hogar y gastos compartidos»). Botón «volver» genérico (ya no dice «Ajustes»).
- **Bancos de gasto diario en Cartera:** el multiselector de `settings.expenseBanks` (mismo que Ajustes → Dinero) se refleja/edita también en el editor de cuentas de Cartera (`Wealth` v4Embed). Aclara que el rol único `spendFrom` sigue siendo uno; `expenseBanks` decide qué compras cuentan.
- **Animaciones de temporada «tipo Revolut»:** capa ambiental reescrita a 18 piezas en **3 capas de profundidad** (parallax: tamaño/opacidad/blur/velocidad por capa), caída **orgánica** con `--sway`/`--spin` por pieza (deriva lateral + giro + pulso de escala), halo de color superior que respira (`html[data-season]::before`, `@keyframes seasonglow`) y pulso en `.botnav-fab` (`fabpulse`). Todo bajo `prefers-reduced-motion`/`reduceMotion`.
  - Bug corregido en el camino: la generación de partículas hacía `return out.push(...)` dentro del bucle (salía en la 1ª iteración con un número) → 0 partículas; ahora `out.push(...)` + `return out`.
- **Pendiente honesto:** widget «afford» y captcha MyInvestor siguen siendo nativos (widget = APK 30 bien instalado; captcha = WebView nativa con site key, no resoluble por OTA — el site key de MyInvestor no es accesible y meter el script de Google reCAPTCHA rompería la regla de cero-CDN).
- OTA only (lo de esta versión).

## [4.6.0] — 2026-07-18
### Temáticas de temporada, accesibilidad, metas con teclado propio, más monedas y varios bancos de gasto
**Metas — aportar con teclado propio + banco (§2 feedback)**
- Nuevo `ContributeGoalSheet` (14→09-tab-debts-goals): hoja `v4-sheet` con teclado `.v4-keys` y chips de banco, igual que el sheet «Apuntar». Sustituye al `askText` (que abría el teclado del sistema y rompía la estética).
- `addToGoal(g, amt, bank)` guarda `g.fromBank` (memoria del último banco; se pre-selecciona la próxima vez). No mueve saldos de cuentas (la hucha de metas es un bote aparte).

**Temáticas de temporada (§3)**
- `settings.season` (`mundial|halloween|navidad|verano|invierno|pascua|none`) → `data-season` en `<html>`. `SEASONS`/`SEASON_FX`/`applySeason` en 01-i18n.
- Capa ambiental `.season-fx` (emojis cayendo, `@keyframes seasonfall`) renderizada en App solo si hay temática y no está «Reducir animaciones». Guiño de color por temática en `.botnav-fab` (sin tocar `--mint`/`--coral`, que pintan importes).
- Selector en Ajustes → Apariencia.

**Accesibilidad (§7)**
- Niveles de letra `settings.textSize` (`normal|big|huge`) con `applyTextSize` + `textSizeOf` (compat con el viejo `bigText`). **El zoom pasa a `body`, no a `#root`**: los sheets/diálogos van portaleados a `document.body` (fuera de `#root`) y con el zoom en `#root` se quedaban a tamaño normal → descuadre. `html.hugetext body{zoom:1.26}`.
- `settings.reduceMotion` (`html.reduce-motion *{animation/transition ~0}`), `settings.hiContrast` (sube `--muted`/`--muted-2` por tema). `applyA11y(s)` centraliza y se llama en `loadState` + efectos de App.
- Nueva sección Ajustes → Accesibilidad.

**Más monedas + comparativa (§4)**
- `CUR_SYM`/`CUR_LIST` en 00-core (15 divisas). `refreshFx` pide todas al BCE (frankfurter). Selector ampliado + acordeón «Comparar monedas» (`1 € = …`).

**Varios bancos de gasto diario (§11)**
- Selector en Ajustes → Dinero que lista TODAS las cuentas (no solo OB) y escribe `settings.expenseBanks` (la lógica `expenseBankEnts`/`importObExpenses` ya lo respetaba). Caso: TR + Revolut en un viaje, mismo presupuesto.

**Cartera (§5, §6)**
- Selección de patrimonio (líquido/inversiones/bienes) persistida en `settings.carteraParts`. Animación `rise` en la zona de inversiones.

**Ajustes (§10)**
- Todas las secciones arrancan encogidas en cada apertura (`isOpen` ya no lee/escribe `localStorage`; solo memoria de sesión). Reorden: Apariencia → Accesibilidad → Para empezar → Dinero → Conexiones → App → Avanzado.

**Estética / transiciones (§8, §9)**
- Ocultado de `.botnav` más lento y con fade (`.55s`), colapsables `.42s` + fade. Wrapper `.v4-embed-legacy` armoniza «Gestionar recibos» y «Herramientas de inversión» (Fijos/Investments) con la estética v4 (tarjetas planas, inputs/enlaces al estilo nuevo).

**Widget Android — «lo que te puedes permitir» (§1, NATIVO)**
- Web empuja `afford` = mín(presupuesto restante, liquidez segura de la cuenta de gasto) en `updateWidget`. `MiCarteraPlugin` lo persiste; `MiCarteraWidget` pinta «✅ Puedes gastar X €» (mint/coral). Nuevo `TextView w_afford`.
- **Requiere APK nuevo** (versionName 4.6.0 / versionCode 30). El resto es OTA.
- **Publicado:** GitHub Release `v4.6.0` + asset `Mi-Cartera-4.6.0.apk` + `public/apk.json` → versionCode 30.

**MyInvestor captcha (§12, parcial)**
- `miDeviceLogin` acepta `captchaToken` → cabeceras `X-Recaptcha-Token` + `X-Recaptcha-Action: SECURITY_CHECK` (contrato del cliente `finanze`). Plumbing listo; resolverlo del todo necesita una WebView nativa con el site key (cambio de APK) — pendiente documentado.

## [4.5.1] — 2026-07-18
### Gestos: primera apertura con contenido + scroll de Resumen bloqueado en perfil
- Premonta `SettingsPanel`/`ProfilePanel` en idle (~1,4 s) y también al fijar el eje del gesto: la 1ª vez el panel ya no va negro vacío (4.4.1 difería el montaje al soltar).
- Al gesto de perfil: clase `profile-gesturing` + `overflow:hidden`/`touch-action:none` en `.page` (y lock de `scrollTop`) para que Resumen no pelee con el pull-down → lag.
- OTA only.

## [4.5.0] — 2026-07-18
### Histórico OB: ingresos + destino Gasto / Recibo / Ingreso
- `BankHistoryImport`: también lista créditos (ingresos); por fila chips Gasto | Recibo | Ingreso.
- Defaults: tarjeta→Gasto, no-tarjeta→Recibo, crédito→Ingreso (todos pre-marcados; recibo ya existente en `fixed` se desmarca).
- Recibo → `state.fixed` mensual con `day` del movimiento (como conciliación «Añadir a Fijos»).
- Ingreso → `expenses` con importe negativo + `category:"ingreso"` + `noCard`.
- Bancos del histórico: todos los enlaces OB activos (no solo `expenseBanks`), para poder sacar recibos del banco de fijos.
- Sync ya existente: `importObExpenses` mete TODAS las compras tarjeta del mes de `expenseBanks` en Gastos (no era «últimos 5» a medias — ya estaba).
- OTA only.

## [4.4.3] — 2026-07-18
### Gestos: Resumen visible otra vez (sin el negro cutre)
- Quita `visibility:hidden` de `.gesture-freeze` (feedback: fluido pero «cutre»). Se mantiene lo que sí cura el lag: no interpolar filter/`--set-p`/opacidad del shell por frame; solo mueve el panel.
- Velo del perfil más suave (`rgba(…,.28)`) para que se lea Inicio detrás durante el gesto.
- OTA only.

## [4.4.2] — 2026-07-18
### Gestos Ajustes/perfil: congelar Resumen + sin sección vacía
- Durante el drag de Ajustes/perfil: clase `gesture-freeze` oculta `.viewport`+`.botnav` (una vez). Solo se anima el panel sobre el fondo; cero re-pintado de gráfico/anillo (4.4.1 no bastó — feedback).
- Sin `--set-p`/translate en el shell; sin interpolar opacidad del dim por frame; velo fijo al empezar el gesto.
- Anti-rebote Inicio: `preventDefault` del overscroll antes de fijar eje; sin rubber-band del track a la derecha en tab 0.
- Inicio: «Próximos cargos» solo si `upcoming.length>0` (si no hay, la sección no se pinta).
- OTA only.

## [4.4.1] — 2026-07-18
### Gestos Ajustes/perfil: sin filter ni blur en el drag (feedback vídeo)
- Ajustes: quitado `filter:brightness` en `.app-shell.settings-dim` — en cada frame del gesto lento re-rasterizaba Resumen entero en WebView (~3 fps). Solo queda el `translate3d` barato.
- Perfil: `backdrop-filter` solo con `.blurred` al soltar (abierto); durante el drag, velo verdoso plano.
- No montar `SettingsPanel`/`ProfilePanel` en `touchstart`/lock del eje — el contenido entra al abrir (`drawerOpen`/`profileOpen`). Shell vacío durante el arrastre.
- OTA only (sin cambio nativo).

## [4.4.0] — 2026-07-18
### Reconexión a un toque y avisos con la app cerrada (feedback 2026-07-18, 4ª ronda — «lo del padre»)

**UX de reconexión (el padre vio el saldo mal, «Sincronizar» no hizo nada y acabó en la app de TR).**
- `runBankSync` guarda `state.bankIssues` (bancos con `expired` en el último sync; se recalcula entero en cada sync → reconectar lo limpia solo).
- `CarteraTab`: banner rojo por banco caducado — «{banco} necesita tu permiso otra vez» + botón «🔓 Reconectar {banco}» que llama a `cloud.bankConnect(aspsp)` directo (vuelve con `?bank=ok` y se re-sincroniza solo). Banner equivalente para TR muerto (solo si hubo login antes: `mc_tr_phone`): botón que dispara `mc-open-banks` → App abre Ajustes con `goBanks` → `SettingsPanel` aterriza directo en Mis bancos (el form de TR ya precarga el teléfono). Los textos aclaran que se reconecta EN la app, no en la del banco.

**Notis con la app CERRADA (APK 29 — publicado).**
- Nativo nuevo: `AlertCheckWorker` + `AlertCheckScheduler` (WorkManager cada 6 h, patrón OtaCheck). La web empuja el calendario de cargos del mes (fijos + cuotas) vía `MiCartera.setAlertData({ym,charges,fired})`; el worker avisa la víspera con dedupe por cargo y mes en prefs, y el plugin devuelve `fired` para que la web selle su localStorage (nunca dos avisos por el mismo cargo entre web y nativo).
- `MainActivity`: `AlertCheckScheduler.ensure()` junto al de OTA. `build.gradle`: versionCode **29**, versionName **4.4.0**.
- Umbrales de presupuesto en frío: la Edge `ingest` ahora emite también `p50`/`p95` (antes over/p80/big) y `TrExpenseListener` los pinta — los gastos capturados por noti de TR avisan al 50/80/95/100% con la app cerrada. p50/p95 funcionan al desplegar la Edge (sin APK); las vísperas en frío sí requieren APK 29.
- **Publicado:** GitHub Release `v4.4.0` + asset `Mi-Cartera-4.4.0.apk` + `public/apk.json` → versionCode 29.

## [4.3.0] — 2026-07-18
### Avisos proactivos, deudas con fecha estimada y celebración de últimas cuotas (feedback 2026-07-18, 3ª ronda)

**Notificaciones (todas app-side: se evalúan al abrir/sincronizar; sin cambios nativos).**
- Presupuesto: efecto en App que al cruzar 50/80/95/100% del presupuesto del mes lanza toast + `nat.showNotification`. Una vez por umbral y mes (`localStorage _bn{th}_{ym}`); si al abrir ya vas por el 97% solo suena el umbral más alto y los inferiores se sellan en silencio. Claves `bn_50/80/95/100` (es/en/ca).
- Recibos: TODOS los fijos y cuotas de deuda avisan LA VÍSPERA (`rc_title_tmrw`/`rc_body_tmrw`); los gordos (≥80 € o 12% de fijos) mantienen además el aviso a 2-3 días. Una noti por cargo y mes.

**Deudas.**
- Sin plazo (hipoteca/préstamo): `endsLabel` estima el fin con `ceil(debtBalance/debtAmort)` → «a este ritmo acabas ~{mes año}» (`v4_debts_ends_est`). Antes esas tarjetas no enseñaban fecha ninguna («se quedó ahí muerto»).
- Inicio: tarjeta 🎉 cuando a una deuda activa le queda la última cuota (`debtLeft<=1`): nombre + importe + «después, X €/mes libres» (`v4_debt_party_*`).

**Gastos.**
- `PeriodMoreSheet`: el sheet «Más…» de períodos era el único portal sin `useSheetSwipe`/`useBackClose` — ahora se cierra tirando abajo y con el gesto atrás. E2E nuevo que lo cubre con gesto táctil real.

**Informe del mes.**
- Al caer al download (share fallido/no disponible): toast que dice que está en Descargas + notificación nativa con el nombre del fichero (`rp_saved_notif`). Abrirlo directo desde la noti necesitaría plugin nativo (pendiente si se pide).

**Ajustes.**
- `grp()` despliega con el patrón `.collapsible` (grid-template-rows animado, contenido siempre montado) en vez de montar/desmontar en seco («muy seco y robótico»).

**MyInvestor.**
- Confirmado con foto: el captcha salta TAMBIÉN desde el móvil («Captcha required»). `x-myinvestor-app` sube a `version=3.150.0` en cliente y `_shared/myinvestor.ts` (primera palanca documentada: el anti-bot puntúa peor a clientes viejos). El error crudo de la API se sustituye por `mi_recaptcha` reescrito (esperar horas, no insistir, WiFi de casa). Si persiste, lo siguiente es resolver el captcha real (WebView nativa) — fuera del alcance OTA.

## [4.2.0] — 2026-07-18
### Financiación simulada, banco por apunte y lote de arreglos (feedback 2026-07-18, 2ª ronda)

**«¿Me lo puedo permitir?» a plazos (nueva funcionalidad).**
- `AffordSim` (08-motor-bank): toggle Al contado / A plazos. A plazos = meses + entrada → cuota al 0% (`(importe−entrada)/meses`), simulación del mes con solo la ENTRADA (la 1ª cuota llega el mes siguiente), impacto en fijos (`fijosMensual → +cuota`) y veredicto de si la cuota cabe cada mes (margen libre = nómina de `flows` − fijos − presupuesto; sin nómina apuntada, lo dice en vez de inventar). Botón «Crear la deuda» monta la deuda con el mismo shape que `Debts.addDebt` (value=financiado, `amort`, `months`, `day`, `downPayment`, `asOf:ymNow()`) → entra sola en el motor de líquido y en Plan → Deudas. Claves `af_mode_*`/`af_fin_*` en es/en/ca.

**Banco en gastos manuales.**
- `ApuntarSheet` (14-v4-screens): chips de banco (cuentas del usuario + «Sin banco»); por defecto la cuenta de gasto diario, como hacía Gastos. `ExpenseDetailSheet`: mismos chips SOLO para apuntes manuales (los de OB/TR traen su banco real).
- Persistencia sin migración SQL: `source` embebe el banco como `manual:<ent>` (mismo truco que `ob:`) — `expenseSourceForCloud`/`expenseFromRow`/`expenseBankOf` lo codifican/decodifican y nuevo `cloud.setExpenseBank` lo actualiza en la tabla.

**Hogar — crear hogar roto (error real en Actividad: «new row violates row-level security policy for table households»).**
- Migración `0015_household_policies_rebuild.sql`: recrea TODAS las políticas de las 3 tablas (a la BD le faltaba la de INSERT de `households`; la 0014 solo rehízo los SELECT) y el SELECT de `households` añade `or created_by = auth.uid()` (un hogar recién creado aún no tiene membresía y el RETURNING devolvía 0 filas). Idempotente.
- Cliente (`cloud.createHousehold`): genera el uuid en el cliente e inserta SIN `.select()` (return=minimal) → deja de depender del RETURNING filtrado por RLS. `HogarSection.doCreate` traduce el error RLS a un toast accionable (`hh_rls_fix`, 3 idiomas) que apunta a la migración.

**Cartera → Sincronizar TODO.**
- `runBrokerSync(opts)` acepta `{manual:true}`: entra Trade Republic (bridge nativo, solo si `status().connected`; 401 real → toast «reconecta», softFail/waf → silencio) y MyInvestor sin throttle. Aplica posiciones con `applyBrokerPositions` (solo mapeadas, nunca crea). El botón de Cartera lanza `Promise.all([runBankSync({manual}), runBrokerSync({manual})])`. El auto-sync al abrir sigue siendo solo MI con throttle de 30 min.

**UI/UX.**
- Ajustes: la entrada ya no escala+desenfoca el shell (se sentía «raro e incómodo» y el blur full-screen daba tirones): ahora parallax sutil (translate 24px) + brightness, y fuera las animaciones escalonadas de `.set-card` en cada apertura.
- «Ver más/Ver plan» desde Inicio: `goTabTop()` resetea el `scrollTop` de la página destino (conservaba el scroll y aterrizabas a mitad de Metas/Gastos).
- `.v4-cycle-box`: margen inferior 14px (chocaba con los chips de categorías).
- `input.editv` sin el prefijo `.row`: en Cartera (filas `v4-mov`) el input de editar Bienes salía sin estilo y a todo lo ancho, partiendo los nombres (foto del feedback).
- Textos de bancos (Ajustes → Mis bancos) a dieta en es/en/ca: `bp_intro`, `bp_pick_sub`, `bp_expbanks_hint`, `bp_foot`, `tr_hint` (absorbe `tr_tos`), `mi_hint`; fuera de la UI `bp_apk_hint`, `tr_tos` y `mi_nostore` (redundantes).

**Rendimiento (lags esporádicos).**
- Persistencia debounced: `set()` ya no serializa TODO el estado a localStorage en cada llamada (cientos de KB en el hilo principal = micro-tirones); escribe como mucho 1×/400 ms con el último valor y SIEMPRE vuelca en `pagehide`/`visibilitychange:hidden` (+ flush al desmontar). `doExport` pasa a leer el estado React (localStorage puede ir 400 ms por detrás).
- El blur de pantalla completa de Ajustes (caro en WebView) desaparece con el rediseño de la animación.

**Tests.**
- Nuevo e2e `apuntar-sheet.spec.mjs`: chips de banco visibles y cierre del «+» tirando hacia abajo con gesto táctil real (CDP), también arrancando desde el teclado numérico. (Ojo del propio test: medir el teclado a mitad de la animación `sheetup` da coordenadas fuera del viewport.)

## [4.1.0] — 2026-07-18
### Cartera editable de verdad, Open Banking solo a demanda y Ajustes al día (lote feedback 2026-07-18)

**Open Banking — sync SOLO a demanda (los consentimientos caducaban por «uso robótico»).**
- `11-app-main.js`: retirados el auto-sync al abrir/volver a primer plano y sus throttles (`BANK_SYNC_THROTTLE`/`BANK_FG_MIN`). Un sync PSD2 desatendido en cada apertura hacía que Caixa/Sabadell tumbaran el consentimiento una y otra vez. Quedan los syncs «con motivo»: tras autorizar (`?bank=ok`), bootstrap de conciliación (1ª vez sin `bankTx`), noti del banco (ajuste `st_banksync_notif`) y manual.
- `CarteraTab`: botón discreto «↻ Sincronizar bancos» (`v4-link-mini`) junto a «Tus cuentas», visible con `hasBankLink`; llama a `runBankSync({manual:true})`.

**Cartera.**
- Hero con leyenda TOCABLE (`.v4-legend-btn`): liquidez/inversiones/bienes multiseleccionables; el stackbar y la cifra se recalculan (selección parcial = suma de lo marcado, sin deudas; todo marcado = patrimonio neto como siempre). Nunca se pueden desmarcar los tres.
- Editor de cuentas v4 COMPLETO: nombre + rol (recibos/diario/todo) + borrar — el rol se quedó inaccesible con la nav v4 (solo existía en el Wealth v3 no montado). Cuentas re-ancladas por el banco (`bankIban`): saldo solo-lectura (editable solo el nombre/rol) + hint `v4_acc_locked`. Cuentas extra OB: renombrar + promocionar con rol (como en v3).
- Bienes: vuelve el editar (valor + nombre) con el mismo patrón `edit-link` — desapareció en el rediseño.
- Inversiones: fuera el hint anticuado `v4_inv_embed_h`; «✎ Editar a mano» pequeño al pie (despliega todos los brókers con inputs; reutiliza el editor de siempre).
- Badge OB (`.v4-ob-badge`) movida a la línea de meta con wrap: pegada al nombre se cortaba y descuadraba con nombres largos o «· caducado».

**Inicio / Plan.**
- Carrusel de metas con `stopPropagation` en touch: scrollearlo horizontal ya no cambia de pestaña (aparecía al crear la primera meta).
- «Ver plan ›» fuerza el segmento de Plan (`planGoto {id,ts}` → `PlanTab.gotoSeg`): cargos → Recibos, metas → Metas. Antes quedaba el último subtab usado (Deudas).

**Nav inferior.**
- `.botnav` pasa de flex-child a `position:absolute` dentro de `.app-shell` (ahora `relative`): al esconderse ya no deja un bloque vacío — el contenido corre por debajo de la barra translúcida. Curva/duración unificadas con el track (.42s) y sin fade.

**Ajustes.**
- Filas `.set-row` compactas (48px de alto mínimo, sigue ≥44px táctil) y botones inline más pequeños; entrada `rise` escalonada por secciones y en los acordeones (`set-exp`), con `prefers-reduced-motion` respetado.
- Moneda de visualización: EUR/USD/GBP/CHF (acordeón). `DISP` en App usa `fxTableOf`; sin FX aún descargado se queda en € (nunca inventar tipo).
- «Tu cuenta»: vuelven huella (toggle `bio`) y cerrar sesión — desde el rediseño solo vivían en el AuthPanel, inalcanzable estando logueado.
- Conexiones → «Hogar y gastos compartidos» (`SharedPanel`): Hogar Fase 1+2 y grupos compartidos eran INALCANZABLES desde la nav v4. Fix de paso: `Shared` sombreaba el generador `uid()` con el id de usuario (crear grupo/gasto habría petado con «uid is not a function»).
- Sugerencias con pantalla propia (`FeedbackPanel`, fila «Enviar sugerencia»); el popup de Novedades queda solo como historial.
- Avanzado: fuera «Personalizar widgets del Resumen» (+ evento `mc-dash-edit` y clave `st_widgets`) — apuntaba al Dashboard v3.
- «Informe del mes»: `shareMonthReport` acepta `showToast` y si `navigator.share` falla (WebView) descarga el PNG y avisa (`rp_saved`); cancelar el share no descarga.

**Actualizaciones (des-spaghettización).**
- Nuevo hook `useUpdates()` (10-app-components): agrupa los 3 canales (SW web / OTA Capgo / APK) con el mapa documentado; App pasa de 3 efectos sueltos + `doApkInstall` a `const upd=useUpdates()`. 12-boot queda como transporte puro (comentario de cabecera con el reparto). Comportamiento idéntico.

**MyInvestor (diagnóstico captcha).**
- Telemetría de VÍA de login: si el captcha salta por la Edge se apunta si había nativo disponible; si el login nativo peta y se cae a Edge, se apunta el motivo. Con esto Actividad dirá por fin por qué un móvil con APK ≥28 sigue viendo captcha.

**i18n:** nuevas `v4_sync_banks(_done)`, `v4_acc_locked`, `v4_sel_partial`, `v4_edit_goods`, `cur_gbp`, `cur_chf`, `st_feedback`, `st_shared`, `rp_saved` (es/en/ca); retiradas `st_widgets`, `v4_inv_embed_h`.

Sin cambios nativos Android: todo llega por OTA (web + APK 28 con bundle ≥4.0.12).

## [4.0.15] — 2026-07-17
### Open Banking estable, oro con % (coste manual), nav auto-oculta y Ajustes/privacidad in-app

**Open Banking — se caía «cada dos por tres» (falso positivo de caducidad).**
- `bank-sync/index.ts`: la clasificación de error marcaba `expired` con CUALQUIER `40[134]`. Un 403 de PSD2 es casi siempre rate-limit/anti-abuso momentáneo y un 404 un hipo del banco — NO que el consentimiento muriera. Ahora solo cuenta como caducado un **401** o un mensaje EXPLÍCITO (`expired|revoked|consent|unauthor|invalid_(token|session|grant)|session_not_found`). Mismo criterio que el 403 anti-bot de MI y el 401 momentáneo de TR. Validado con banco de casos (401/403/404/429/5xx/mensajes).
- Cliente (`11-app-main.js`): un fallo NO caducado ya no lanza «reconéctate». Nuevo `bank_syncsoft` (es/en/ca) — aviso suave y SOLO en sync manual; en auto-sync se calla y reintenta solo.

**Revolut materias primas — «no veo si sube o baja».**
- El precio ya se actualizaba en vivo (XAU→GC=F); faltaba el COSTE, que Revolut no trae en el extracto de metales. `BrokerImport`: campo OPCIONAL «Coste en €» por metal en la previsualización (`costOf()` parsea con `revoAmt`, exige `>0`). Con coste, la fila pinta el % sube/baja; sin él, sigue como antes (sin % falso). `bi_metal_hint` reescrito + `bi_metal_cost_ph` (es/en/ca).

**Nav inferior que se esconde (estilo Revolut).**
- `.page onScroll` → `onPageScroll`: bajando esconde `.botnav` (`translateY(130%)`+fade, curva de la casa), subiendo o al cambiar de tab la muestra. `navHiddenRef`/`scrollTab` evitan re-render por píxel y el falso salto al cambiar de pestaña con distinto scrollTop. Respeta `prefers-reduced-motion` (snap sin animación).

**Ajustes / privacidad.**
- Privacidad DENTRO de la app (`PrivacyPanel`, portal + `useBackClose` + safe-area): antes `window.open("privacy.html","_blank")` dejaba el título bajo el notch («muy arriba») y costaba volver. Contenido en i18n `pv_*` (es/en/ca). `privacy.html` también con `env(safe-area-inset-*)`.
- Limpieza: fuera `lbl`/`btnGhost`/`link` (estilos muertos en `SettingsPanel`) y comentario de acordeón obsoleto.
- OTA only (web + Edge Function `bank-sync`; sin cambio nativo — APK 28 ya instalado sirve).

## [4.0.14] — 2026-07-17
### Editar gasto: scroll de categorías no cambia de tab
- El sheet de detalle vive en portal a `body` pero cuelga del árbol React de Gastos: los touch burbujeaban al `viewport` y el swipe de tabs se comía el scroll horizontal de chips (el `+` no, porque Apuntar cuelga de App).
- `useSheetSwipe`: `stopPropagation` en touch; `onStart`/`onMove` ignoran si `html.sheet-open`.
- OTA only.

## [4.0.13] — 2026-07-17
### Perfil: cerrar tirando abajo + sheets con fondo en todas las tabs
- 👤 Cerrar perfil: swipe **arriba→abajo** encoge al avatar (reversa de la entrada Fable). Antes cerraba tirando arriba.
- 🧾 `html.sheet-open` ya no pone `overflow:hidden` en `.track`/`.viewport`: con tabs ≠ Inicio el `translateX` + clip dejaba solo el `body` oscuro detrás del + / editar gasto (Resumen se veía bien porque translateX=0).
- 🧪 E2E perfil: gesto de cierre hacia abajo.
- OTA only (sin cambio nativo).

## [4.0.12] — 2026-07-17
### MyInvestor: login desde el móvil (adiós reCAPTCHA)
- 🔌 El login de MI sale ahora del DISPOSITIVO vía `CapacitorHttp.request` (registrado incondicionalmente en el core de Capacitor, `Bridge.java:638` → funciona con el APK 27 actual, sin build nuevo): el reCAPTCHA condicional (SECURITY_001) lo dispara la IP de datacenter de Supabase, no la residencial del usuario. `miDeviceLogin()` replica las cabeceras de `_shared/myinvestor.ts`; el OTP va por la MISMA vía (mismo x-device-id e IP). Fallback automático a la vía Edge (web, o CapacitorHttp KO).
- ☁️ `myinvestor-connect` acepta `storeTokens`: VALIDA el access token contra `self-basic` antes de guardar (nunca a ciegas — un token corrupto rompería sync/keepalive en silencio) y upsertea cifrado como siempre. La contraseña sigue sin guardarse; en nativo ya ni siquiera pasa por la nube.
- 🧪 E2E táctil del perfil (CDP `Input.dispatchTouchEvent` + `hasTouch`): pull-down abre siguiendo el dedo (panel en `.dragging` a mitad de gesto), tirar arriba cierra.
- 📱 gradle `versionName` 4.0.12 (versionCode 28 sigue SIN publicar; cuando se compile llevará también el fix TR nativo de 4.0.11).

## [4.0.11] — 2026-07-17
### Perfil Revolut de verdad + sesión TR estable
- 👤 **Perfil escala desde el avatar** (vídeo de referencia en `docs/design/handoff/capturas/revolut-profile-pull/`, local y gitignoreado — es pantalla real del usuario): el panel entero nace como miniatura en el avatar (`transform-origin` medido en JS, vars `--pp-ox/oy/s0`) y crece hasta pantalla completa; el fondo se desenfoca con `backdrop-filter` en `.profile-dim-layer`. Nunca scale/filter en el shell (huecos negros en WebView). Pull-down en Inicio abre siguiendo el dedo; tirar arriba cierra encogiendo al avatar.
- 🏦 **TR nativo (APK 28):** `restoreCookies` ya no pisa un jar caliente — TR rota `tr_refresh` en cada `/session` y re-inyectar el snapshot viejo «resucitaba» un refresh consumido → 401 real y 2FA. Snapshots extra: `AndroidTR.snap()` tras cada refresh OK, `onPageFinished`+3 s (la SPA de TR rota cookies al arrancar) y `handleOnPause` (última rotación antes de que Android mate el proceso).
- 🏦 **TR JS:** 401 real → formulario directo con el teléfono recordado (`mc_tr_phone`, solo el teléfono, nunca el PIN) + aviso `tr_expired_re` (es/en/ca). Fuera el «pulsa Desconectar»: ese botón además borra el snapshot bueno.

## [4.0.10] — 2026-07-17
### APK update automático (familia)
- `_mcCheckApkUpdate`: al detectar `apk.json` más nuevo, abre `installApk` sola (~900 ms) + toast.
- Deep-link `update|apk`: se comprueba **antes** que el genérico `update|` (bug: la noti de APK aplicaba OTA).
- `apk.json` sigue en versionCode **27** / 4.0.9 (nativo sin cambios); la web 4.0.10 llega por OTA.

## [4.0.9] — 2026-07-17
### Tono verde + alineación APK/docs
- Tema verde: fondos un pelín más claros/vivos + glow mint más fuerte en `body`.
- Sheets: velo `rgba(8,28,20,.28)` (verdoso, no negro ni transparente seco).
- Perfil: `background:var(--bg)` de nuevo; dim layer verdoso.
- **APK versionCode 27 / 4.0.9** + `apk.json` + release GitHub (TR nativo: no borra `connected` en sync fallido).
- Docs: `ROADMAP.md`, `AGENTS.md` §6 checklist, regla Cursor `release-alignment`, `package-lock` version.

## [4.0.8] — 2026-07-17
### Feedback post-4.0.7 (tutorial / negro / bancos / TR)
- 🎓 Tour: espera 520 ms tras `goTab` (track 420 ms); `pickVisible` solo en viewport; spot circular en avatar.
- 🧾 Sheets: backdrop transparente y **sin** scale/filter en `.app-shell` (el scale dejaba el `body` negro a los lados).
- 👤 Perfil: `.profile-dim-layer` aparte; sin scale del shell; cierre ✕; spring 0.5s.
- 🏦 TR/MI/CSV con borde de marca + `bk-ver` con `APP_VERSION`; hint APK.
- 🔌 `runBrokerSync` ya no llama a TR al boot (evita logout con APK viejo).

## [4.0.7] — 2026-07-17
### Feedback post-4.0.6
- ✨ WhatsNew: delay 420 ms + `wn-in` (sin doble animación ni zarpazo).
- 👤 Perfil: cierra tirando **arriba** (misma dirección que entró); resistencia; tap avatar monta cerrado un frame para animar entrada; sin `filter` en shell (WebView Android pintaba negro).
- 🧾 Sheets: velo `rgba` suave + scale sin filter; dismiss ~200 ms; unlock `sheet-open` al empezar a salir.
- 🎾 Categoría `padel` + KW (antes que ocio); «restaurante…» sigue en bares. Blur de input ya no cierra la ficha al tocar chips.
- 🏦 `BrokerImport` en `bk-card` plano. TR JS: no `setConnected(false)` en authExpired. **APK versionCode 26 / 4.0.7** (nativo no borra `connected` en sync fallido).

## [4.0.6] — 2026-07-17
### Feedback post-4.0.5
- 👤 Perfil: header compacto; askText `compact`; animación spring + stagger; dismiss tirando abajo (scrollTop=0).
- 🧾 Gastos `v4-mov`: 3 líneas (nombre / categoría / fecha · banco).
- 🏦 TR/MI en `bk-card` plano; sección «Brókers»; reactivado `runBrokerSync` suave al boot.
- 🔌 MI: lee `device_id` (migración 0012); revive sync si status expired falso; TR no desconecta en softFail/waf.

## [4.0.5] — 2026-07-17
### Feedback post-4.0.4
- 🧾 Sheets: backdrop transparente (sin velo negro); `useSheetSwipe` ya no resetea `transform` antes del unmount (quita el hitch al dismiss).
- 👤 Perfil pull-down tipo Revolut desde Inicio (`profile-pull` + gesto vertical al top / avatar); campos en `settings.profile`; tap avatar abre perfil (Ajustes sigue por swipe).
- 🏦 `BankPanel` alineado al look v4 (`v4-mov` / chips).
- 🔌 Brokers: sin `runBrokerSync` silencioso al boot; `_miDeviceId` persistente; keepalive/sync MI no marcan `expired` en 403; TR nativo solo limpia `connected` si `authExpired` sin softFail/waf. **APK versionCode 25.**

## [4.0.4] — 2026-07-17
### Feedback post-4.0.3
- 🎓 Tour v4: pasos Inicio → Gastos → FAB + → Plan → Cartera → avatar Ajustes → swipe tabs; `goTab` + `data-tour`.
- 👆 Chips Gastos: siempre `cancelSwipe` en horizontal (sin amago de tabs).
- 🧾 `useSheetSwipe`: dismiss vertical también desde chips; cierre/retorno con ease 0,42 s; ExpenseDetailSheet rediseñada.
- 📅 Plan Pendiente/Ya pagado: slice(0,3) + Ver más/menos.
- 💼 Cartera: quitados P&L verde junto a inversiones y card `v4-roundup`.

## [4.0.3] — 2026-07-17
### Feedback post-4.0.2
- 🔔 Android: `OtaCheckWorker` (WorkManager, ~15 min) consulta `version.json`/`apk.json` con la app cerrada y dispara noti local; `syncOtaState` evita doble aviso al abrir. **Requiere APK nuevo** (versionCode 24).
- 👈 Inicio: swipe derecha abre Ajustes en toda la pantalla (no solo ~72 % / borde).
- ⚙️ SettingsPanel: secciones Apariencia → Dinero → Conexiones → Fácil → App → Avanzado; Actividad admin al final; quitado bloque Sentry de prueba.
- 💶 Gastos: `.cents` mismo tamaño/color que el entero del balance.
- 🧾 Sheets: tipografía/teclado/CTA más compactos; `useSheetSwipe` ya cierra desde toda la ficha (scrollTop>0 respeta scroll).
- 📅 Plan «Ya pagado»: lista completa + flows (nómina/transferencias) pagados; sin agrupar ni Ver más.
- 💼 InvToolsSheet `toolsMode`: sin total-bar USD, auto-precios, edit manual, brokers duplicados ni soldCash.
- 👆 Chips Gastos: gate inteligente (al inicio deja tab) + `cancelSwipe`; reset `scrollLeft` al entrar/salir.

## [4.0.2] — 2026-07-17
### Feedback post-4.0.1
- 👈 Ajustes: shell siempre montado para que el swipe de borde mueva el panel; zona de borde 52 px.
- 💶 Gastos balance: `eurParts` en blanco sin signo.
- 🧾 Sheet: bloqueo touch del fondo + chips meta centrados; gestos horizontales no cierran el sheet.
- 🍿 Categoría `cine` + keywords salud/Claude/Play/Kinepolis (recategoriza «Otros» al cargar).
- 💼 Inversiones en `v4-mov` como cuentas + hoja «Herramientas de inversión».
- 👆 Track entre tabs: 0,42 s `cubic-bezier(.32,.72,0,1)`.
- 📱 Edge-to-edge status + nav transparentes (APK).

## [4.0.1] — 2026-07-17
### Pulido post-4.0.0 (feedback real)
- 👈 Ajustes tipo Revolut: swipe desde borde izquierdo para abrir, swipe a la izquierda para cerrar; blur/scale del shell (panel hermano, no hijo).
- 🏠 Inicio «Próximos cargos» alineado con Plan (`occursIn` / `isPaidIn`).
- 💶 Gastos: `gTotalMode` vuelve a pintar neto/split; caja «Mi ciclo» sin nómina más clara; meta cat·fecha·banco con separadores.
- 🧾 Sheets (detalle, Apuntar, Gestionar, presupuesto): `useSheetSwipe` + bloqueo de scroll del fondo; fecha humana en detalle.
- 📅 Plan Recibos: Gestionar → sheet con Fijos; Ya pagado colapsado a 3 + Ver más.
- 💼 Cartera embed: sin botones de precios/editar ni auto-precios; hint de brókers.
- 📱 Edge-to-edge nativo (status bar transparente + `--bg`); `theme-color` alineado. Requiere rebuild APK.

## [4.0.0] — 2026-07-17
### Rediseño v4 (SPEC-v4)
- 🧭 Nav inferior fija: Inicio · Gastos · FAB Apuntar · Plan · Cartera.
- 🏠 Inicio nuevo (hero Fraunces, presupuesto humano, próximos cargos, metas, recientes).
- 💶 Sheet de presupuesto desde la card de Inicio (stepper 50 €).
- ➕ Sheet Apuntar con teclado propio; Gastos sin form de alta duplicado.
- 🧾 Sheet detalle al tocar un movimiento (categoría, card flag, borrar con confirmación).
- 📅 Plan = Recibos (hero + pendiente/pagado agrupado) + Deudas/Metas con cards v4.
- 💼 Cartera = patrimonio + cuentas planas + round-up + inversiones sin hero duplicado.
- 👋 Onboarding 3 pasos (claim · demo · presupuesto stepper).
- ⚙️ Ajustes: perfil, swatches tema 30 px, Apariencia / Para empezar fácil / Conexiones / Avanzado.
- 🎨 Tokens, tipografía y motion alineados a `docs/design/handoff/SPEC-v4.md`.
- 📌 Lo marcado como v4.1 en el SPEC (arrastre de sheet, dividir gasto, búsqueda icon-only) queda fuera a propósito.

## [3.113.3] — 2026-07-16
### Cold start más honesto + swipe sin vacío
- ⚡ Sentry (~340 KB) ya no bloquea el parse del arranque: se inyecta tras el primer pintado si hay DSN.
- ⚙️ `SettingsPanel` solo se monta la 1ª vez que abres el cajón (antes iba en el cold start oculto).
- 👆 Al deslizar pestañas se monta el destino durante el gesto (menos flash al soltar).
- ⏱️ Vecinas + popup Novedades más tarde (~3,2 s / 2,2 s); swipe CSS 0,22 s.
- 💾 `loadState` no reescribe toda la cartera en localStorage en cada apertura.
- 🎬 Splash «Cargando…» hace fade corto tras el primer pintado (menos sensación de tirón).

## [3.113.2] — 2026-07-16
### Fix flash Resumen↔Gastos + updates más rápidos
- 🏦 Chips de banco ya no parpadean al salir/entrar de Gastos (`heavyOk` sticky + bankOpts siempre).
- 📄 Pestañas visitadas se quedan `page-live` (evita que `content-visibility` las «apague» off-screen).
- ⚡ Cold start: ya no pre-monta Gastos/Fijos en idle; solo al toque.
- ⬇️ OTA: pill mientras descarga; chequeo a ~150 ms; al restaurar pending sí notifica si aún no se avisó de esa versión.
- 🛡️ Bloque «Sentry / error de prueba» en Ajustes solo para admin (`is_admin`), como Actividad.

## [3.113.1] — 2026-07-16
### Categorías ampliadas sin inflar el filtro
- 🏛️ **Nueva categoría:** `tasas` / **Impuestos y multas** para `Gencat`, `AEAT`, `DGT`, ayuntamientos, IBI, IVTM, sanciones y similares.
- 🧠 **Más keywords reales** en transporte, ocio, compras y hogar sin añadir más chips al filtro (la idea es mejorar el diccionario, no llenar la UI).
- ✅ **Tests:** `categories.test.mjs` cubre casos reales (`Gencat`, `AEAT`, `Booking`, `Papelería`, `Zooplus`) y se añade a `npm test`.

## [3.113.0] — 2026-07-16
### Cold-start, FX multi, categorías IA, Sentry prod
- ⚡ **Cold start:** solo monta la pestaña activa al abrir; vecinas + pre-mount Gastos/Fijos tras idle ~1,6 s. Gastos: `useDeferredValue` + suscripciones/chips banco diferidos hasta pestaña activa (lag Android tras vaciar apps).
- 💱 **FX multi:** Frankfurter EUR→USD/GBP/CHF → `fxRates` + helpers `toEurAmt`/`invCostEur`/`invValueEur`; editar coste ancla `costEur`.
- ✨ **Categorías:** Edge `categorize` (KW + OpenAI opcional); toggle Ajustes; botón en gastos «Otros». KW servidor alineado con cliente.
- 🛡️ **Sentry:** `beforeSend` limpia request/extra sensible; UI «error de prueba» si hay DSN; docs actualizadas (secret GitHub ya existe).
- 📚 ROADMAP/ARQUITECTURA/HOGAR/CATEGORIZE.md al día.

## [3.112.0] — 2026-07-16
### Tutorial roles + filtro por banco en Gastos
- 🎓 Tour `tour_2`/`tour_3` y coach Gastos/Fijos/Patri (es/en/ca): variable vs fijo, nómina/Bizum como Ingreso, multi-banco.
- 🏦 Filtro chips por banco en Gastos (`expenseBankOf`); OB/hist guardan `ent`; `source` en nube `ob:ent` / `macrodroid`→TR (sin columna SQL).
- 💡 TabCoach `_v2` en gastos/fijos/patri para remostrar trucos una vez.
- 📚 Migración `0014_household_rls_no_recursion.sql` documentada en HOGAR.md (RLS recursion).

## [3.111.0] — 2026-07-16
### Multi-banco gasto OB + sync vivo + APK noti→sync
- 🛒 **UX roles:** coach Gastos/Fijos/Patrimonio + `rl_hint`/`h_roles` aclaran fijo vs variable (es/en/ca).
- 🏦 **`settings.expenseBanks`:** `importObExpenses` + `BankHistoryImport` filtran por lista de ents; chips en BankPanel. `spendFrom` único intacto.
- 🔄 **Sync:** `BANK_SYNC_THROTTLE` 90 min; al foreground (≥30 min) idle `runBankSync`; Capacitor `appStateChange`.
- ✅ Conciliación: CTA «Confirmar y apuntar» + hint de fijos desde OB.
- 📱 **APK alpha22** (`versionCode 22`): listener Caixa/Sabadell/… → debounce `bankNotif` → `bankSync` (sin parsear importe); toggle Ajustes; `apk.json` con asset `Mi-Cartera-alpha22.apk`.
- 📚 `docs/ARQUITECTURA.md`: fases 0–4 HECHO, GAS_URL archivado, FX aproximado documentado, backlog multi-banco.

## [3.110.0] — 2026-07-16
### Tutorial, fin de mes, Hogar Fase 2, presupuestos
- 🛟 **Tour:** scroll al `?` de la pestaña visible + tip siempre en viewport (ya no se queda pillado).
- 😌 **Fin de mes en paz** + **presupuesto por categoría** (widgets Resumen).
- 🏠 **Hogar Fase 2:** snapshot con gastos por cat + fijos (sin migración SQL).
- 🔔 Recordatorio recibos gordos (Android).
- 📦 Solo OTA web — **sin APK nuevo** (alpha21 sigue válido; evita líos de instalación).

## [3.109.0] — 2026-07-15
### Hogar compartido + informe mensual + fluidez
- 🏠 **Hogar Fase 1:** crear/unirse por código, publicar snapshot, patrimonio fusionado (Supabase `0013_households.sql`).
- 📊 **Informe automático día 1** + imagen WhatsApp (Ajustes → Personalización).
- ⚡ **Pestañas más fluidas:** pre-mount, `startTransition`, animación 280 ms.
- 📦 **APK alpha21** (`versionCode 21`): bundle web 3.109.0 embebido.

## [3.108.0] — 2026-07-15
### Premium: modular + rendimiento + E2E + Sentry
- 🧩 **Código modular:** `src/modules/` (13 ficheros) + `scripts/build-app.mjs` — el artefacto desplegable sigue siendo un solo `public/index.html`.
- ⚡ **Rendimiento:** lazy mount de pestañas, `content-visibility`, sync/FX diferidos con `requestIdleCallback`, `TabCoach` memoizado.
- 🛡️ **Sentry** opcional (`CONFIG.SENTRY_DSN`, vendor auto-hospedado).
- ✅ **Playwright E2E** (smoke + confirmación borrar cuenta) + test Deno `delete-account`.
- 📚 **Docs:** `TESTING.md`, `SENTRY.md`, `AGENTS.md` actualizado.

## [3.107.0] — 2026-07-15
### Actualizaciones con aviso automático + cierre del backlog
- 🔔 **Notificación al móvil** cuando hay bundle OTA o APK nuevo listo (toca la noti → aplica la actualización).
- ✨ **Botón «Nueva versión»** restaurado al arrancar si el bundle ya estaba descargado (bug: `_otaPending` hacía `return` sin mostrar el pill).
- 🔄 **Chequeo periódico:** arranque (~600 ms), al volver a primer plano y cada 30 min con la app abierta.
- 📱 **Plugin Android:** `showNotification` acepta `gotoTarget` para deep-link a actualizar.
- 📦 **APK alpha20** (`versionCode 20`): release con deep-link en notificaciones de update + bundle 3.107.0 de fábrica.
- 📚 **Docs:** README/ARQUITECTURA/SETUP-ANDROID actualizados; guía rotación token `docs/SETUP-INGEST-TOKEN.md`.
- ✅ **Tests:** `updates.test.mjs` (`newerVer`).
- 🏁 **Issues cerradas:** #8 (APK Capacitor), #9 (rotación ingest), #15 (gamificación).

## [3.106.0] — 2026-07-15
### Documentación multi-usuario + financiación + precios manuales
- 👥 **Ingest multi-usuario:** aclarado en código (`ingest_tokens` por persona; legacy `INGEST_TOKEN` intacto). Issue #5 cerrada.
- 🚗 **Financiación (#11):** tests `financing.test.mjs` (`debtBalloonIn`, plazo, balloon).
- 📋 **Precios manuales (#10):** tarjeta en Inversiones para fondos MI / posiciones TR sin ticker.

## [3.105.0] — 2026-07-15
### Dashboard inversiones (#6)
- 📈 **Evolución enriquecida:** gráfico valor + coste aportado (línea discontinua), cambio % del periodo en el subtítulo.
- 🔄 **Snapshot diario:** `recordInvSnapshot` actualiza al refrescar precios o editar posiciones (no solo al abrir).
- ✅ **Tests:** `inv-dashboard.test.mjs` (`recordInvSnapshot`, `invPeriodChange`).

## [3.104.0] — 2026-07-15
### Onboarding completo (#3)
- 👋 **Wizard 4 pasos:** bienvenida, presupuesto, cuentas y deuda/inversión opcionales; `buildEmpty()` sin datos demo.
- 📋 **Tarjeta «Primeros pasos»** en el Resumen (`setupHint`) con acceso a Ajustes hasta cerrarla.
- ☁️ **Login en nube:** si ya hay cartera sincronizada, se salta onboarding y la tarjeta de primeros pasos.
- ✅ **Tests:** `onboarding.test.mjs` (`buildEmpty`, flags `onboarded`/`setupHint`).

## [3.103.0] — 2026-07-15
### Motor de deudas (#2) + tests reconcile/bank
- 📉 **`debtChargeDay` / `isDebtPaidThisMonth`:** cuotas entran en el motor de líquido aunque no tengan día (default día 1); nueva deuda con día 1 por defecto.
- 🔐 **Re-cifrado legacy:** `ensureMiLinkEncrypted` en `myinvestor-sync` migra tokens plaintext tras activar `TOKEN_ENCRYPTION_KEY`.
- ✅ **Tests:** `motor-debt.test.mjs`, `reconcile-bank.test.mjs` (matching, conciliación, `applyBankBalances`).

## [3.102.0] — 2026-07-15
### Seguridad, RGPD y sync multi-dispositivo
- 🔐 **Tokens cifrados:** `supabase/functions/_shared/crypto.ts` (AES-256-GCM) cifra access/refresh de MyInvestor y `session_id` de Open Banking; clave en secreto `TOKEN_ENCRYPTION_KEY` (retrocompat con plaintext).
- 👤 **Perfiles:** migración `0012_profiles_and_privacy.sql`; admin vía `profiles.is_admin` (RLS `app_events` sin depender del email en el cliente).
- 🗑️ **Borrado cuenta:** Edge Function `delete-account` + Ajustes → Tu cuenta; requiere contraseña.
- 📄 **Privacidad:** `public/privacy.html` (RGPD mínimo).
- 📱 **Sync optimista:** `pushState` con `updated_at` evita pisar cambios de otro dispositivo; aviso `st_sync_conflict`.
- ✅ **Tests:** golden CSV Revolut (`tests/revo-golden.test.mjs`) + `crypto.test.ts` en CI Deno.

## [3.101.0] — 2026-07-15
### Calidad, privacidad y tests (segunda revisión del proyecto)
- 🛡️ **`DATA` sintética:** eliminados del repo público patrimonio, hipoteca, nómina y cartera reales; `scripts/guard-privacy.mjs` bloquea regresiones en CI.
- ✅ **Suite de tests:** `npm test` (sintaxis `vm.Script`, round-up/saveback, parsers Revolut, clasificación ingest, deudas) + workflow `.github/workflows/test.yml`; `deploy.yml` exige tests verdes antes de publicar.
- 🏷️ **Categorías unificadas:** `ingest` alineado con `KW` del cliente (pan, parking, pelu, keywords ampliadas).
- 📦 **Versiones sincronizadas:** `VERSION`, `package.json` → 3.101.0.

## [Unreleased]
### En progreso — Fase 4: app nativa Android (Capacitor)
- 🏗️ **Reemplazo de MacroDroid:** base de Capacitor en el repo (`package.json`, `capacitor.config.json`) y guía [docs/SETUP-ANDROID.md](docs/SETUP-ANDROID.md) con un `NotificationListenerService` (Kotlin) que lee la notificación de Trade Republic y la manda a `ingest`. El APK carga la PWA en vivo desde GitHub Pages. Build/pruebas en local con Android Studio.
- ⏭️ **Multi-usuario (futuro):** la app nativa enviará el JWT del usuario e `ingest` pasará a `verify_jwt` para derivar el `user_id` (hoy es single-user con `INGEST_USER_ID` fijo).

### En progreso — Fase 1: Supabase
- ⏭️ **Pendiente de configurar (manual):** aplicar el SQL del esquema, secretos de GitHub para el deploy del CI, y **URLs de Auth** (Site URL + Redirect) con la URL de GitHub Pages para que funcione el magic link. Ver [docs/SETUP-SUPABASE.md](docs/SETUP-SUPABASE.md).
- ⏭️ **Pendiente (futuro):** repuntar MacroDroid a la función `ingest` y jubilar el Apps Script; pantalla de login más cuidada (ahora usa prompt nativo).

### Por hacer (próximos pasos)
- 🐛 **Precios USD (causa raíz):** Finnhub devuelve `prices:{}` vacío. La app y el Apps Script ya lo reportan claro; falta **redeployar el Apps Script** (Nueva versión) y revisar `FINNHUB_KEY` con el campo `errors`/`keyLen` que ahora trae la respuesta.
- 🎨 **Barra de distribución de activos:** el amarillo choca al abrir; usar paleta del sistema.
- 🎨 **Tabs:** se cortan por la derecha; scroll horizontal con auto-scroll a la pestaña activa.
- 🔁 Migración de Netlify a GitHub Pages (este commit inicial).
- ⚙️ Pantalla de Settings: toggle moneda, presupuesto, objetivo de ahorro, export/import JSON, reset, manejo de errores visible.
- 🔐 Endurecer `GAS_URL` con token compartido.

## [3.100.0] — 2026-07-15
### Revolut: las materias primas ya entran, y diálogos propios en toda la app
- 🥇 **Import de materias primas (oro/plata) de Revolut.** El backlog decía «Revolut a medias: solo pilla las acciones»; con los CSV reales del usuario se confirma que **no era un fallo de parseo**: el oro vive en un extracto APARTE (Invest → Documentos → **Materias primas** → Extracto de cuenta) con un formato que no se parece en nada al de Stocks — es un extracto de cuenta corriente (`Tipo,Producto,…,Importe,Comisión,Divisa,State,Saldo`, cabecera en el idioma de la cuenta) cuyo importe ya va en ONZAS. Nuevo `revoParseCommodities()`: cantidad = columna `Saldo` de la última fila, con la suma `Importe−Comisión` como comprobación (con los datos reales las dos vías dan 0,258218 XAU). Los metales vendidos del todo (XAG a 0) se descartan solos.
- 📎 **Varios extractos a la vez.** `BrokerImport` acepta `multiple` y fusiona acciones + materias primas en una sola previsualización: la cartera de Revolut vive repartida en dos ficheros y pedir dos pasadas era pedir que se olvide una.
- 🧭 **Se detectan los extractos de Pérdidas y Ganancias** (`revoIsPnl`) y se explica cuál es el bueno, en vez del genérico «no he podido leer el CSV». Hacía falta: de los 4 CSV del usuario, dos son de P&G y uno de ellos se llama `trading-account-statement-…` por fuera.
- 💰 **Coste de los metales: no se inventa.** Ese extracto no trae el coste en € (la pata en EUR va en el extracto de la cuenta corriente), así que se re-ancla solo la CANTIDAD y se respeta el coste que hubiera (`if(po.cost!=null)`, como ya hacía el import de MyInvestor). Con la cantidad + el ticker basta: el precio en vivo hace el resto.
- 📈 **`prices`: XAG/XPT/XPD** añadidos al mapa de Yahoo (`SI=F`/`PL=F`/`PA=F`), junto al XAU→`GC=F` que ya estaba.
- 🔗 **`revoMetalSuggest()`:** el oro se llevaba a mano y SIN ticker, así que `brokerSuggest` no lo casaba (por ticker no hay nada, y las palabras de «Oro (XAU)» tienen 3 letras cuando el matcher exige 4+) y se quedaba en «no tocar» justo en el caso que veníamos a arreglar. Detectado al probarlo en el navegador, no leyendo el código.
- 💬 **Diálogos propios (`askText`/`askConfirm`)** en lugar de `window.prompt/confirm`, que pintaban el cuadro NATIVO de Android — gris, tipografía ajena y botones «CANCEL/OK» en inglés con la app en español. Petición de fuera del círculo técnico («mejor que sea igual a la estética de la app»). Misma hoja inferior que el resto (`.tabsheet`), z-index 230 (por encima de los paneles, que llegan a 215), título/subtítulo separados, atajos y foco automático. Portados los 8 sitios: amortizar, asesor de amortización, aportar a meta, vender parte, borrar posición, borrar grupo, restaurar copia y quitar el candado. Devuelven promesas; si el host no está montado (pantalla del candado) caen al diálogo nativo y la acción nunca se pierde.

## [3.96.0] — 2026-07-12
### Inversiones: conectar MyInvestor e importar Revolut, y las dos vistas de Gastos con nombres claros
- 📈 **Conectar MyInvestor (beta):** en Ajustes → Gestionar mis bancos, «Conectar MyInvestor». Metes tu usuario y contraseña de MyInvestor (puede pedir un código por SMS) y trae tus **fondos indexados** con sus participaciones, valor y coste, para re-anclar tus posiciones con previsualización. La contraseña **no se guarda** en ningún sitio: solo se guarda la sesión (como al entrar en su web). Va por la API propia de MyInvestor (funciona en web y app). De vez en cuando MyInvestor pide un reCAPTCHA de seguridad; si pasa, avisa y se reintenta más tarde.
- 💹 **Importar Revolut por CSV (beta):** junto a Trade Republic, tarjeta «Importar de Revolut (CSV)» con un **paso a paso** para exportar el extracto desde la app de Revolut (Invest → More → Documents → Stocks → Account statement → Excel). Subes el fichero (o lo pegas) y re-ancla tus acciones/ETF con previsualización. Todo se procesa en tu móvil; el fichero no se sube a ningún sitio.
- 🧮 **Las dos vistas del total de Gastos, con nombres claros y el mismo diseño:** «Desglosado» pasa a llamarse **«Gastos e ingresos»** y «Lo que te queda» pasa a **«Balance»**. Las dos comparten ahora el mismo diseño (número protagonista arriba + una línea de desglose con 💸 Gastos · 💰 Ingresos · Balance) y ninguna enseña ya el «−» (el color rojo/verde lo dice).

## [3.95.1] — 2026-07-12
### fix: el modo «Lo que te queda» seguía enseñando el «−» al sobregastar
- 🐛 Se me había quedado uno: la vista «Lo que te queda» de Gastos (Ajustes → Personalización → Total de Gastos) mostraba «−1.400,00 €» en rojo al sobregastar. Mismo criterio que el resto de la 3.95.0: el color rojo/verde ya dice si ahorras o te pasas, así que el «−» sobra (el «+» de ahorro se queda).

## [3.95.0] — 2026-07-12
### Novedades a la vista, sugerencias sin salir de la app, gastos sin «−» y el botón de actualizar de vuelta
- ✨ **Popup de Novedades al actualizar:** cada vez que estrenas una versión nueva, la app te cuenta qué trae con un popup (una sola vez por versión, textos en cristiano y sin jerga). Los usuarios nuevos no lo ven en su primer arranque (se sella tras el onboarding); lo verán a partir de la siguiente actualización.
- 📜 **Histórico de Novedades en Ajustes → «✨ Novedades y sugerencias»:** relee las novedades de cualquier versión pasada cuando quieras, con acordeón por versión.
- 💬 **Caja de sugerencias por versión:** dentro del popup/histórico puedes apuntar errores, ideas o cosas raras. Quedan guardadas en «Tus apuntes» (sincroniza entre tus dispositivos) y le llegan a Juanjo junto con tu versión y plataforma (nuevo filtro «💬 Sugerencias» en el panel Actividad del admin). Pensado para que la pareja/amigos no tengan que acordarse de contarlo por otro lado.
- 🎨 **Gastos sin el signo «−»:** las cantidades de gasto ya no llevan el «−» delante (quedaba feo); los ingresos conservan su «+» y el balance su ±. Aplica a las filas de Gastos y a las dos vistas del total.
- ✨ **Vuelve el botón de arriba «✨ Nueva versión · toca para actualizar» (app Android):** había desaparecido al pasar el OTA a modo silencioso. Ahora, cuando la actualización web está descargada y lista, sale el botón para estrenarla al momento; si no lo tocas, entra sola en el siguiente arranque igual que hasta ahora.

## [3.94.0] — 2026-07-11
### Ahorro editable, dos vistas del total de Gastos, secciones a tu gusto y Actividad con pantalla propia
- ✨ **Aportaciones de ahorro editables:** la tarjeta «¿A dónde va tu ahorro?» del Resumen venía con importes sembrados que no se podían tocar (y un usuario nuevo no podía añadir los suyos). Ahora tiene «Editar»: cambia importe, nombre y banco de cada aportación, borra con 🗑 o añade nuevas con «＋ Añadir aportación». Solo ajusta la cifra de «Ahorro/mes» (no mueve dinero).
- ✨ **Dos vistas del total en Gastos** (Ajustes › Personalización › «Total de Gastos»): **Desglosado** (el actual: total de gastos arriba; ingresos y balance debajo) o **Lo que te queda** (el modelo antiguo que gustaba: un solo número = ingresos − gastos del filtro, verde/rojo). Con explicación de cada modo al elegirlo.
- ✨ **Reordenar secciones dentro de Fijos, Patrimonio, Deudas, Inversiones y Metas:** botón discreto «⇅ Ordenar secciones» al pie de cada pestaña → flechas ▲▼ por tarjeta (como los widgets del Resumen). En Deudas y Metas reordena las propias deudas/metas.
- ✨ **Actividad (admin) con pantalla propia:** el acordeón de Ajustes crecía sin límite con cada error. Ahora abre una pantalla aparte (como Gestionar mis bancos) con filtro «🐞 Solo errores», hasta 200 eventos y gesto atrás para volver.
- 🐛 **Banco conectado que no aporta nada (caso CaixaBank):** si un banco sincroniza «bien» pero no trae ninguna cuenta con saldo utilizable, antes decía «solo aporta su saldo al Patrimonio» (falso) y no había salida. Ahora: aviso accionable en Gestionar mis bancos («prueba Actualizar saldo / Reconectar»), telemetría a Actividad con el detalle por cuenta para diagnosticarlo, y sus cuentas anteriores se conservan marcadas «caducado» en vez de esfumarse del patrimonio.

## [3.93.0] — 2026-07-11
### Editar el saldo de una deuda con plazo ya no resetea el contador de cuotas
- 🐛 **«Editar saldos pendientes» alargaba la deuda:** re-anclaba la proyección al mes actual sin ajustar el plazo, así que una deuda de 4 cuotas con 3 pagadas volvía a enseñar «Quedan 4/4» tras corregir el saldo (y la proyección la alargaba otros 4 meses). Ahora, en deudas con plazo, el saldo tecleado se convierte en el pendiente real **sin tocar el ancla** (mismo patrón que Amortizar) y las cuotas restantes se recalculan con la misma amortización: editar a 100 € una deuda de 400 €/4 cuotas deja «Quedan 1/4», como debe. Las deudas sin plazo siguen re-anclando como siempre.

## [3.92.0] — 2026-07-11
### Más feedback de la pareja: deudas mudas al fallar, amortizar y deudas ya empezadas
- 🐛 **Añadir deuda fallaba en silencio:** si faltaba el importe (o no había ni cuota ni plazo), «Añadir deuda» no hacía nada y no avisaba. Ahora sale un toast claro con lo que falta («⚠ Falta el importe total de la deuda», «⚠ Pon la cuota/mes o el plazo en meses») y un «✓ Deuda añadida» al guardar bien.
- ✨ **Botón «💸 Amortizar» en cada deuda:** para pagos anticipados. Pregunta cuánto amortizas (recordando el pendiente), baja el saldo justo eso y **acorta el plazo** manteniendo la cuota (recalcula las cuotas que quedan; con pago final lo respeta). Si liquidas todo: «🎉 ¡Deuda liquidada!» y la financiación queda marcada pagada.
- ✨ **«Cuotas ya pagadas» al crear una deuda:** para deudas ya empezadas (su caso: 4 cuotas y ya van 3). El campo nuevo retrasa el ancla esos meses, así el pendiente, el % amortizado y el «Quedan n/tot» salen bien desde el primer día en vez de empezar la deuda desde cero.

## [3.91.0] — 2026-07-11
### Feedback de la pareja usando la app de verdad: total con ingresos ilegible, cuentas OB sin rol, ciclo de cobro
- 🐛 **«Total filtrado» con ingresos era un galimatías:** el total sumaba `gastos − ingresos` y lo enseñaba en crudo, con el signo AL REVÉS que las filas (una nómina de +757 con ~1.560 de gastos salía como «+802 €» — parecía que habías ganado dinero cuando habías gastado de más; y al revés, un mes ahorrador salía en negativo). Ahora la barra enseña **los gastos con «−»** (como las filas) y, si el filtro incluye ingresos, una línea con **«💰 +ingresos · Balance ±X»** (verde si ahorras, rojo si no) y el contador separa «N gastos · M ingresos».
- 🐛 **Cuentas de Open Banking sin rol → los fijos solo podían ir a Trade Republic:** las cuentas conectadas por banco (Revolut, CaixaBank…) vivían en `obAccounts` como saldo puro, sin rol, y ni Patrimonio→Editar ni «Gestionar mis bancos» dejaban dárselo; al crear un gasto fijo, el desplegable de banco solo enseñaba TR. Ahora se pueden **«promocionar»**: chips Recibos / Gasto diario / Todo en **ambos sitios** — crean la cuenta con rol anclada al saldo real del banco (misma fórmula de re-anclaje del sync), la sacan de la lista OB (sin doble conteo) y el sync del banco la sigue re-anclando por IBAN (`applyBankBalances` ahora re-ancla **varias** cuentas manuales del mismo banco, no solo la primera). De regalo: el alta de fijos/puntuales ya no guarda «sabadell» por defecto si ese usuario no tiene Sabadell (guardaba un banco distinto del que enseñaba el desplegable), y Guardar en Patrimonio ya no machaca a 0 una cuenta añadida en pleno modo edición.
- ✨ **Filtro «Mi ciclo» en Gastos (de cobro a cobro):** su nómina no cae en día fijo (23, 24…), así que el mes natural le descuadraba el ahorro. El chip nuevo filtra **desde el último cobro real apuntado** (el ingreso más reciente ≥200 € de los últimos 45 días; los bizums pequeños no cuentan) hasta hoy, y enseña qué cobro ancla el ciclo («Del 23/06 (cobro de +757 €) a hoy»). Con el desglose nuevo del total, el «Balance» de ese filtro es exactamente «lo que llevo ahorrado desde que cobré». Sin cobros apuntados, avisa y usa el mes.
- ✨ **Categoría nueva 🥖 Panadería:** con keywords propias (panadería, pastelería, fleca, forn, obrador, Granier, Santagloria…) que antes caían en Bares. El pan del súper sigue siendo Supermercado, como debe ser.

## [3.90.0] — 2026-07-11
### Tanda de arreglos tras la revisión del proyecto (sesión Claude Code escritorio) + APK alpha15
- 🐛 **`permission denied for table ingest_tokens` (foto del usuario):** la migración 0008 creó la tabla con RLS pero **sin GRANTs** (mismo patrón que app_events en la 0007). Nueva **migración 0009**: grants a `authenticated` (gestión del propio token) y a `service_role` (resolución token→usuario en `ingest` + telemetría). Sin esto, el toggle «Apuntar aquí mis gastos de TR» petaba siempre.
- 🐛 **CaixaBank desaparecido del Patrimonio:** un banco cuyo enlace caduca dejaba de venir en `bank-sync` (solo se consultaban los `active`) y la app reconstruía `obAccounts` sin él → sus cuentas se **esfumaban en silencio**. Ahora `bank-sync` devuelve también los enlaces caducados/rotos (`ok:false`, sin llamar a Enable Banking), la app **conserva sus saldos marcados «caducado»** (badge naranja en Patrimonio), y Ajustes canta «⚠ N caducado(s) — reconéctalo» en el resumen de bancos.
- 🧹 **Cuenta OB re-etiquetada «personalizado solo mío»:** limpieza puntual al cargar — esa etiqueta heredada se borra y la cuenta vuelve a su nombre por defecto + badge «del banco», como el resto.
- ✨ **Ingresos de verdad en Gastos:** el alta manual ahora tiene **campo de fecha** (vacío = hoy; una transferencia de hace días se apunta en su día real, a las 12:00 para esquivar zonas horarias), el filtro de categorías incluye el chip **💰 Ingreso**, y un ingreso manual ya no alimenta el round-up (`noCard`, igual que al editar).
- ✨ **Suscripciones → Gastos fijos:** cada suscripción detectada (≥3 meses) ofrece «→ pasar a Gastos fijos»: crea el fijo con el banco de recibos y el día real del último cargo (y muestra «✓ ya en Fijos» si ya existe). Keywords nuevas en ambos categorizadores: IA/digital (Anthropic/Claude, OpenAI, iCloud, Google One, YouTube Premium…) → Ocio; peluquerías/estética genéricas (barber, estilistas, nails…) → Salud.
- ✨ **Rol del banco donde se gestiona el banco:** en «Gestionar mis bancos», cada banco conectado enseña «¿Para qué usas este banco?» con los chips Recibos / Gasto diario / Todo (misma lógica de re-anclaje que Patrimonio, ahora compartida en `applyAccountRole`) y una explicación arriba. Ya no hay que saberse el camino Patrimonio → Editar.
- ✨ **«Buscar actualización» aplica la web YA:** si hay versión web nueva, baja el bundle OTA y hace **hot-swap al momento** (`CapacitorUpdater.set` recarga la WebView) en vez de decir «cierra y abre la app». Guard «solo hacia adelante» intacto.
- 🐞 **Telemetría que ve lo que tú ves:** todo toast de error (✕/⚠) viaja a `app_events` (antes solo crashes → los errores «domados» de la pareja eran invisibles), los fallos del sync de TR también se registran, e `ingest` **apunta sus propios fallos server-side** (token inválido, error al guardar). El botón «Recargar» del panel Actividad ahora confirma cuántos eventos trajo.
- 🐛 **Crash total con estado sin `aportaciones`/`history`:** el motor y el Sparkline leían esos campos sin default → pantalla «Algo se ha torcido» en cuanto faltaban. Ahora se rellenan al cargar (posible causa de los errores fantasma de la pareja).
- 🔧 **TR en frío (alpha15):** backoff del refresh recortado a ~9,5 s (la recarga con challenge nuevo es mejor apuesta que esperar más), **timeout nativo 60→90 s** (el peor camino en frío rondaba 77 s y moría en falso «timeout»), con **401 real** se sale al momento (sin quemar 15 s de WebSocket), y un bloqueo del WAF **ya no desconecta la sesión** (`wafBlocked` en vez de `authExpired`: antes te obligaba a repetir el 2FA sin necesidad).
- 📦 **APK alpha15** (`versionCode 15`): incluye el lector multiusuario (`setIngestUrl`) de la 3.88.0 — sin este APK el toggle multiusuario no puede hablar con el lector nativo — y los cambios de TR en frío. `apk.json` → alpha15 (esta vez con release publicada de verdad).

## [3.89.1] — 2026-07-11
### fix: «descarga falló» al buscar actualización
- 🐛 **apk.json apuntaba a un release inexistente:** la 3.88.0 subió `apk.json` a `versionCode 15` / `v4.0.0-alpha15`, pero ese APK **no se ha compilado ni publicado** todavía. Como la app instala el APK cuando `apk.json.versionCode > instalado` (`index.html`), intentaba descargar `…/releases/download/v4.0.0-alpha15/Mi-Cartera.apk` → **404 «descarga falló»**. Se revierte `apk.json` al último APK **realmente publicado** (`versionCode 14` / `alpha14`). Las features web (import histórico, toggle multiusuario) siguen llegando por el bundle OTA, que es independiente del APK. Cuando se compile y publique el alpha15, se vuelve a subir `apk.json` a 15.

## [3.89.0] — 2026-07-11
### Importar histórico de gastos (Open Banking)
- ✨ **Traer meses pasados a Gastos:** en **Ajustes → Bancos → «Importar histórico de gastos»**, la app trae los movimientos de los últimos 1-3 meses de tu **cuenta de gasto diario** conectada al banco y te deja **elegir cuáles apuntar** (lista con casillas; las compras con tarjeta vienen pre-marcadas, los cargos que parecen recibos desmarcados). Idempotente: descarta lo ya importado (`ext_id`) y lo que ya existe (fecha·importe·comercio). Server-side (`bank-sync` con `dateFrom`) es **lectura pura**: pagina con `continuation_key` y **no toca saldos ni el estado de los enlaces**. Textos ES/EN/CA.
- ⚠️ **Límites (PSD2):** el banco solo deja ver **~90 días** de histórico en accesos desatendidos, por eso el selector llega a 3 meses. **No aplica a Trade Republic** (no está en Open Banking): para TR se usa el apuntado por notificaciones. Requiere desplegar la función `bank-sync`.

## [3.88.0] — 2026-07-11
### Apuntado de Trade Republic MULTIUSUARIO (0008)
- ✨ **Cada persona apunta sus gastos de TR en SU cuenta:** hasta ahora el lector de notificaciones (`ingest`) escribía siempre para el único usuario del secreto `INGEST_USER_ID` (el creador). Por eso, cuando a una pareja/amigo le llegaba la noti de un gasto de Trade Republic, **no se apuntaba** en su cuenta (o iba a la del creador). Ahora, en **Ajustes → notificaciones**, un toggle **«Apuntar aquí mis gastos de Trade Republic»** genera un **token propio** por usuario (tabla nueva `ingest_tokens` con RLS, migración `0008`), lo guarda y pasa la URL de `ingest` al lector nativo (plugin `setIngestUrl` → `SharedPreferences`). El lector lee esa URL (y cae a `BuildConfig.INGEST_URL` si no la hay), así que **el token del creador sigue funcionando igual** — cero disrupción. `ingest` resuelve `token → user_id` (fallback al secreto legado). Textos ES/EN/CA. **Requiere APK nuevo** (cambia el lector nativo) y desplegar la función + migración.
- ⚠️ **Nota:** solo apunta gastos **desde que se activa** (tiempo real, sin histórico). El histórico pasado de TR no existe por esta vía (las notificaciones no tienen pasado).

## [3.87.0] — 2026-07-11
### Quitar a mano una cuenta del Patrimonio
- ✨ **Cuentas manuales borrables:** las cuentas añadidas a mano en el onboarding viven en `state.accounts`, no en las de Open Banking (`obAccounts`). Al desconectar/desloguear un banco, la purga automática (`bankDisconnect`) solo limpia las de Open Banking, así que una cuenta manual (p. ej. la de una pareja que se deslogueó de Revolut) seguía sumando al Patrimonio **sin forma de quitarla**. Ahora, en **Patrimonio → Cuentas → Editar**, cada cuenta manual tiene un botón 🗑 con **confirmación inline** para quitarla del patrimonio, y un aviso que recuerda que las cuentas conectadas al banco se desconectan desde **Ajustes → Bancos**. Textos en ES/EN/CA.

## [3.86.1] — 2026-07-10
### El paso del tutorial sobre el «?» ya no señala a lo que no toca
- 🐛 **Tutorial (paso 6, «Si ves un `?`…»):** cuando no había ningún botón `?` visible en el Resumen (p. ej. con las tarjetas de Meta/Reparto/Ahorro/Culpable/Tendencia ocultas), el paso caía a un *fallback* que resaltaba la tarjeta de Patrimonio Neto en su lugar — el texto hablaba de un interrogante que no estaba ahí. Ahora, si no encuentra ningún `?` real, el tutorial salta ese paso en vez de señalar algo que no corresponde.

## [3.86.0] — 2026-07-10
### TR en frío (vuelta 4, con red de seguridad), volver del banco sin ver código fuente y quitar bancos que se quitan de verdad
- 🔐 **TR en frío, diagnóstico nuevo (APK alpha14):** la causa real no era «token rancio» a secas sino **timing** — la web propia de TR hace estas mismas llamadas en frío y le funcionan; la diferencia es que el challenge del AWS WAF tarda unos segundos en generar un token válido y nosotros disparábamos a los 600 ms, demasiado pronto. Ahora el refresh **reintenta con esperas crecientes** (0→1,2→2,5→4→6→8 s, ~22 s) forzando token nuevo entre intentos hasta que entra (en caliente entra al primer intento sin esperar); se **caduca la cookie `aws-waf-token` rancia** al abrir en frío (sin tocar la sesión) para forzar un challenge nuevo; y el timeout sube a 60 s. **(nativo → APK alpha14, llega por el botón de actualizar)**
- 🔐 **TR en frío, tercera capa (APK alpha13):** el diagnóstico de alpha12 confirmó que el SDK del WAF está presente y aun así falla → el token cacheado que devuelve `getToken()` está rancio. Ahora: (1) se pide token FORZADO (`forceRefreshToken`) al reintentar, y (2) si aun así el fetch revienta, se **recarga la página de TR en la WebView oculta** (challenge del WAF desde cero, como haría un navegador de verdad) y se reintenta una vez — orquestado en nativo porque la recarga destruye el contexto JS. De regalo: timeout de 45 s para que el botón no se quede girando para siempre. **(nativo → APK alpha13)**
- 🏦 **Volver del banco ya no te enseña código fuente:** Supabase ahora machaca el `Content-Type` de sus funciones (anti-phishing: `text/plain` + sandbox) y la página «Banco conectado» salía en crudo, sin botón para volver a la app. El callback ahora redirige a una página puente en nuestro dominio (`back.html`) que sí es HTML de verdad y salta a la app sola.
- 🏦 **Quitar un banco lo quita de verdad:** sus cuentas sincronizadas desaparecen del patrimonio al momento (antes se quedaban sumando hasta el siguiente sync) y el contador de «Gestionar mis bancos» se actualiza al instante. Además Trade Republic ya cuenta como conexión en ese número.
- 🏷 **Etiqueta «extra» jubilada:** las cuentas que llegan del banco por Open Banking ahora llevan la etiqueta genérica «del banco» (la palabra «extra» era jerga interna y confundía).

## [3.85.1] — 2026-07-10
### Cobro doble arreglado, Actividad desbloqueada y TR que aguanta el frío (APK alpha11)
- 💳 **Los pagos con confirmación ya no entran DOS veces:** un pago 3DS (p. ej. una multa) genera dos notificaciones de TR («confirma el pago» + «has pagado») y ambas se apuntaban como gasto. Ahora la de autorización se ignora y, además, un mismo importe en menos de 10 minutos se trata como el mismo movimiento. *(Servidor: al desplegarse vale para todos, sin actualizar la app. El 50 € duplicado que ya está apuntado bórralo en Gastos: toca el gasto → borrar.)*
- 👁 **El panel «Actividad» ya funciona:** la tabla de telemetría existía pero al rol de usuario le faltaban los permisos base («permission denied») — migración 0007 con los grants. Los pings y errores empiezan a registrarse a partir de ahora.
- 🔐 **Sincronizar TR ya no caduca al abrir la app en frío:** el diagnóstico nuevo cantó la causa real («refresh: Failed to fetch») — el token del AWS WAF caduca y su challenge revienta la llamada. Ahora, si eso pasa, se pide token fresco al SDK del WAF de la propia página de TR y se reintenta (también en el login). **(nativo → APK alpha11, llega por el botón de actualizar)**
- 🔐 **TR en frío, arreglo de verdad (APK alpha12):** el intento de alpha11 no bastaba. La WebView vive en `app.traderepublic.com` y llama a `api.traderepublic.com` (subdominio distinto): `getToken()` dejaba el token del WAF en una cookie de `app.*` que **nunca viajaba** a `api.*`, así que el «Failed to fetch» seguía igual. Ahora todas las llamadas usan el wrapper oficial `AwsWafIntegration.fetch`, que manda el token como **cabecera `x-aws-waf-token`** (esa sí cruza subdominios). Y si aun así fallara, el error trae el estado del SDK entre corchetes para no depurar a ciegas. **(nativo → APK alpha12, llega por el botón de actualizar)**

## [3.85.0] — 2026-07-10
### Personalización total, telemetría del admin y alpha10 (estreno del botón de actualizar)
- 🖐️ **Vuelve arrastrar pestañas:** mantén pulsada una pestaña para moverla o arrastrarla a la papelera para quitarla (se pidió de vuelta — se quitó en 3.83). El editor de Ajustes sigue existiendo: son dos caminos al mismo sitio.
- 🧩 **Ocultar bloques en cualquier pestaña:** nuevo interruptor en Ajustes › Personalización — cada tarjeta de Gastos/Fijos/Inversiones/Patrimonio/Deudas muestra «Ocultar»; las ocultas se recuperan reactivando el modo. Se sincroniza entre dispositivos.
- 🧹 **Fuera personalizaciones del creador:** eliminado el mantener-pulsado sobre el patrimonio que lo leía en voz alta (se disparaba sin querer) y el botón «✎ Personalizar» del Resumen (ya vive en Ajustes).
- 👁 **Telemetría solo-admin:** los errores de la app (crashes, promesas rotas) y un ping diario de uso viajan a una tabla que SOLO puede leer el dueño (RLS por email). Panel «Actividad» en Ajustes + aviso al abrir si hay errores nuevos de otros usuarios. Sin datos financieros. *(Requiere migración 0006_app_events.sql.)*
- 🔎 **«Buscar actualización» en Ajustes (app Android):** consulta al momento si hay APK o web nueva, sin esperar al arranque; muestra las versiones instaladas.
- 📦 **APK alpha10:** lleva el fix del 2FA de Trade Republic en cada sincronización (el APK que circuló de alpha9 podía ser anterior al fix). Es la primera actualización que llega por el botón «Actualizar app».

## [3.84.0] — 2026-07-10
### Feedback de la pareja: actualizar sin cable, el banco vuelve a la app y notis domadas (APK alpha9)
- ⬇️ **Actualizar la app sin cable:** cuando hay APK nuevo, aparece el botón «App … lista · toca para instalar»: la app lo descarga sola (GitHub Releases) y abre el instalador de Android — se instala encima manteniendo datos, sesión y permisos. Se acabó el `adb install` y pasarse el archivo. La primera vez Android pide permitir «instalar apps desconocidas» para Aely (una sola vez). Los cambios solo-web siguen llegando solos por OTA como hasta ahora.
- 🏦 **Conectar el banco ya no te abandona en el navegador (bloqueante 3):** al autorizar en Revolut/Sabadell/etc., la página de vuelta salta directa a la app (deep-link `micartera://`), que confirma la conexión y sincroniza al momento. Antes te quedabas en el navegador viendo la versión web.
- 🔕 **Notis de gasto sin duplicados (punto 7):** Android re-entrega la misma notificación de TR cuando esta se actualiza y salía otra confirmación; ahora se ignoran las repeticiones (mismo texto en <3 min).
- ⚙️ **«Avisar de cada gasto apuntado» es opcional (punto 9):** nuevo interruptor en Ajustes — si TR ya te avisa del cargo, puedes apagar la confirmación de Aely; los avisos de presupuesto (80 %, superado, gasto tocho) siguen llegando siempre.
- 🎯 **La noti abre el gasto CORRECTO (punto 8):** al tocarla, la app sincroniza primero y espera a que el gasto baje de la nube antes de abrir su ficha (antes podía abrir el último gasto a ciegas si la sincronización no había terminado).
- 🧭 **Onboarding y bancos, cada cosa en su sitio (puntos 4 y 5):** «Mis bancos» vacío ahora explica que las cuentas apuntadas a mano viven en Patrimonio y que conectar el banco (Open Banking) es opcional; y en la bienvenida hay botón «Crear cuenta nueva» directo (antes tocaba pasar por «Iniciar sesión» y buscar el enlace pequeño).
- 👻 **Fuera brókers fantasma (punto 6):** Inversiones y Patrimonio solo muestran los brókers donde tienes posiciones; a los usuarios nuevos ya no les aparece MyInvestor/Revolut/TR sin haberlos tocado.
- 🤝 **TR utilizable sin cartera previa:** al sincronizar Trade Republic, las posiciones que no casan con nada se pueden **crear** como posiciones nuevas (opción «➕ Crear como posición nueva», por defecto si empiezas de cero) y el efectivo crea la cuenta TR si no existe. Antes un usuario nuevo se quedaba clavado en «Aplicar a 0 posiciones».
- 🔁 **Adiós al 2FA en cada sincronización de TR (esperemos):** el refresco de sesión llamaba primero a un endpoint que NO renueva y se daba por satisfecho; ahora renueva como pytr (`GET /auth/web/session` con la cookie `tr_refresh`) y las cookies se persisten cuando de verdad existen (tras el verify, no antes). Si aún caduca, el error ahora dice POR QUÉ falló el refresh. **(nativo, APK alpha9)**
- 💅 **Ajustes rediseñados (Claude Design):** tarjetas con filas agrupadas — Idioma y Tema con su valor y desplegable, Letra grande y Modo sencillo con interruptor, sección «Personalización» (widgets del Resumen + editar pestañas), presupuesto, moneda, bancos, notificaciones y copia de seguridad, cada cosa en su tarjeta. «Personalizar widgets del Resumen» ahora vive en Ajustes y te lleva directo al modo edición.

## [3.83.0] — 2026-07-07
### Pestaña «Logros», editar pestañas explícito y noti → ficha del gasto (APK nuevo)
- 🏅 **Nueva pestaña «Logros»:** la gamificación (nivel, retos del mes, medallas) sale de «Metas» y tiene su propia pantalla. «Metas» queda limpia (solo tus metas de ahorro); el Resumen resume racha+nivel en el titular y el detalle vive en Logros. Se oculta en modo sencillo.
- ✎ **Editar pestañas explícito (adiós al gesto oculto):** se elimina el reordenar arrastrando a una papelera manteniendo pulsado (se disparaba sin querer). Ahora en Ajustes › «✎ Editar pestañas»: reordena con ▲▼, oculta con ✕ (Resumen es fija) y vuelve a añadir las ocultas. La barra vuelve a ser solo scroll + tap; el «+» sigue para añadir.
- 🔔 **La notificación de un gasto abre su ficha (punto 5):** al tocar «✓ Gasto apuntado …», la app salta a la pestaña Gastos y abre directamente la ficha editable de ese gasto (empareja por importe + comercio, el más reciente). Requiere cambios nativos → **APK nuevo** (Notif deep-link + `MiCartera.consumeGoto()`).

## [3.82.0] — 2026-07-07
### Rediseño Claude Design (toques silenciosos) + quitar banco
- 🎬 **El patrimonio se cuenta solo:** al sincronizar, la cifra del hero anima suavemente del valor anterior al nuevo (ease-out 1,1 s; respeta «reducir movimiento»). Nada de saltos bruscos.
- 🔊 **Mantén pulsada la cifra para oírla/verla en palabras:** overlay «ciento ochenta y nueve mil…» + lectura por voz (es-ES). Accesibilidad y un guiño para público mayor.
- 🌡️ **Tinte ambiental del hero:** el fondo pasa muy sutilmente de verde → ámbar → coral según cómo va el mes (gasto/presupuesto). Un termómetro de reojo, calculado en JS (sin depender de `color-mix` del WebView).
- 📝 **«Resumen del mes» en formato carta:** una tarjeta en Fraunces, tono personal, generada de tus datos («Julio, hasta ahora… — Aely»). Un widget más del Resumen, reordenable/ocultable.
- 🌱🍂 **Racha + nivel, una sola narrativa:** en el Resumen se fusionan en un titular de estado con 2 acentos (mint/coral + ámbar de aviso): «Vas muy bien / Ojo, apurando / Te has pasado un poco», con la racha y el nivel debajo. El detalle de medallas/retos sigue en Metas.
- 🎊 **Confeti al mínimo:** reservado a metas cumplidas y más suave (26 piezas, paleta calmada). Subir de nivel ya no lanza confeti — solo un aviso tranquilo. Así destacan los momentos silenciosos (carta, conteo, tinte).
- 🍃 **Menos jerga en modo sencillo:** la tarjeta «Round-up & Saveback (TR)» pasa a «Redondeo y regalo por pagar» con explicación en lenguaje llano (ES/EN/CA).
- 🗑️ **Quitar banco:** en «Mis bancos», cada banco tiene botón **Quitar** con confirmación (revoca el consentimiento en Enable Banking + borra el enlace). Reversible: reconectas cuando quieras. Nueva Edge Function `bank-disconnect`.

## [3.81.0] — 2026-07-06
### Tanda de feedback: gastos editables, conciliación sensata y onboarding nuevo
- ✏️ **Los gastos variables ya se pueden EDITAR** (lápiz ✎): comercio, importe y gasto↔ingreso. Para corregir lo que la ingesta parsea mal — la financiación de Cofidis que notifica el total (99,99) cuando TR solo cobra la cuota (25,02), o un bizum antiguo que entró como gasto. La corrección se sincroniza bien con la nube (se retira la fila vieja y se inserta la corregida).
- 📦 **La categoría «Otros» ya tiene icono visible** (antes era un puntito que parecía vacío) y nuevas keywords de auto-categoría: `cofidis` → Compras y `vending`/`expendedor` → Bares (el agua del pádel 😄), en la app y en el clasificador del servidor.
- 🏦 **Conciliación del banco sin absurdos:** ya no empareja un cargo modelado con un movimiento de importe disparatado solo porque el nombre suene (YouTube Premium 4,33 vs 25,99 genérico). Y los cargos de primeros de mes que el banco adelanta al último día hábil (hipoteca del día 1 cobrada el 30) o que pagaste antes de tiempo se buscan también en la cola del mes anterior → salen confirmados, no «aún no aparece». Todos los avisos llevan «Ocultar aviso» (por mes).
- 🔗 **La conexión de Trade Republic vive en «Gestionar mis bancos»** — TR también es un banco, aunque su integración sea otra.
- 💶 **La sincro de TR actualiza también tu EFECTIVO:** al aplicar, además de las posiciones, la cuenta TR se re-ancla al efectivo real que reporta TR (misma fórmula que la edición manual).
- 🏷️ **Patrimonio honesto:** el subtítulo de cada cuenta es SU nombre (editable en modo edición — se acabó el «Conjunta con pareja» en la cuenta personal) y bajo Trade Republic ya no sale el gasto del mes (eso vive en Gastos). Fuera también la tarjeta de desglose del efectivo TR.
- 👋 **Onboarding renovado:** wizard de 3 pasos (qué hace la app hoy — gastos solos, bancos, metas —, presupuesto con atajos, cuentas), con progreso y el aviso de «¿reinstalaste? inicia sesión» bien visible.

## [3.80.0] — 2026-07-06
### OTA: la app arranca al instante + gasto automático blindado (APK 4.0.0-alpha7)
- ⚡ **Adiós al tirón de arranque en frío (OTA con capacitor-updater, self-hosted y gratis).** La app Android ya NO carga la web en vivo desde GitHub Pages en cada apertura: arranca de un **bundle local** (instantáneo, funciona sin red) y baja la versión nueva en segundo plano (`version.json` + `bundle.zip`, publicados por el CI en la misma GitHub Pages). El cambio entra solo en el siguiente arranque — se mantiene el «se actualiza sola», sin recargas a media sesión. ⚠️ Al pasar a la alpha7 la app cambia de origen (`https://localhost`): pedirá iniciar sesión UNA vez y recupera todo de la nube (camino blindado en v3.78).
- 🔁 **Refresco automático de la sesión de Trade Republic:** antes de cada sincro, el puente nativo renueva la sesión con la cookie `tr_refresh` (sin 2FA, el mismo endpoint que usa la web de TR); solo si el refresh falla de verdad se vuelve al login. Menos «tu sesión caducó».
- 🔔 **El apunte automático de gastos ya no muere en silencio** (raíz del «pagué en el Consum y no salió»): al reinstalar la app, Android revoca el acceso a notificaciones del lector de TR. Ahora la app lo detecta al arrancar (aviso) y en Ajustes sale un botón «Activar acceso a notificaciones» que abre la pantalla exacta; el aviso se quita solo al concederlo.
- 🧹 **Fuera el importador CSV** (todo automatizado; nadie lo usaba). La conexión de Trade Republic se muda de Inversiones a **Ajustes**, junto a los bancos.

## [3.79.3] — 2026-07-06
### ¡Trade Republic sincroniza de verdad! (APK 4.0.0-alpha6)
- 🎉 **Sync de Trade Republic COMPLETO y funcionando de punta a punta.** Login → 2FA → posiciones + valor en vivo + efectivo → re-anclaje automático por ISIN/nombre. Verificado en el móvil real: trae el FTSE All-World (6,819272 particip., 1.133 €) y Meta (0,0539 particip., 27,91 €) + efectivo (6.795 €), y re-ancla las 2 posiciones con un toque. **Sin exportar nada a mano.**
- 🔧 **Protocolo WebSocket de TR descifrado en vivo:** `connect 31` → `connected`; posiciones = topic `compactPortfolioByType` (categorías → posiciones con isin/participaciones/coste medio); efectivo = `availableCash`; precio en vivo = `ticker` con sufijo de mercado `.LSX` (Lang & Schwarz, EUR). **Los IDs de suscripción deben ser numéricos** (con letras TR los ignora en silencio — era el bug que traía «0 posiciones»).
- 🔑 **Sesión más robusta:** «conectado» ahora es un flag persistente (antes se adivinaba por el nombre de la cookie). Si la sesión de TR caduca (son cortas), el sync lo detecta (`AUTHENTICATION_ERROR`), te avisa claro («tu sesión caducó, vuelve a conectar») y la tarjeta vuelve al login sola, en vez de traer 0 posiciones en silencio.

## [3.79.1] — 2026-07-05
### Fixes de la app nativa tras probarla (APK 4.0.0-alpha4)
- 🐛 **Doble «Ya tengo cuenta» en la bienvenida:** salía el botón dos veces (el destacado del aviso de arriba + uno al pie). Quitado el del pie.
- 🐛 **El gesto «atrás» te sacaba de la app:** en el APK, deslizar desde el borde para volver atrás cerraba la app entera en vez de cerrar el menú/panel abierto (en el navegador ya iba bien). Ahora el botón/gesto atrás de Android cierra primero el panel de arriba (Ajustes, bancos, pickers…), luego vuelve al Resumen, y solo sale de la app si ya estás en el Resumen sin nada abierto. Añadido `@capacitor/app` para capturarlo de forma nativa.
- ⚡ **Menos tirones al volver a la app:** al alternar de app y volver, ya no se relanza la sincronización de red si acabas de sincronizar (margen de 30 s) — quita un re-render pesado innecesario. (El tirón grande al abrir en frío es porque Android mata la app en segundo plano y recarga todo desde internet; se resolverá del todo con la actualización OTA, pendiente.)

## [3.79.0] — 2026-07-05
### Bug del Bizum arreglado + huella nativa + widget + notificaciones de verdad + puente TR (APK 4.0.0-alpha3)
- 🔗 **Puente nativo Trade Republic (beta):** plugin Android `TradeRepublic` (`status/login/verify/sync/logout`) que atraviesa el AWS WAF ejecutando el login **dentro de una WebView oculta** cargada en `app.traderepublic.com` (que es un navegador real → resuelve el token del WAF, las cookies y el CORS solos). El JS async devuelve por un puente `@JavascriptInterface`. Verificado en el móvil: la WebView carga el login de TR y la API responde de verdad (HTTP real, no el 403 del WAF que mata a pytr). Falta la prueba con credenciales reales + 2FA (solo la puede hacer el usuario). Credenciales y cookies NUNCA salen del móvil.
- 🐛 **Un Bizum recibido ya no cuenta como gasto:** la función `ingest` ahora CLASIFICA la notificación de TR antes de apuntar nada. Bizum **recibido** → entra como **ingreso** (resta del gasto del mes); Bizum **enviado** → gasto marcado «🔄 sin tarjeta» (no infla el round-up); intereses, dividendos, órdenes, planes de inversión, round-up/saveback y transferencias propias → **se ignoran** (ya están modelados en la app). El arreglo vive en el servidor: mejora sin reinstalar el APK.
- 🔄 **El flag «💳 tarjeta / 🔄 bizum» ahora es permanente:** nueva columna `no_card` en la tabla de gastos (migración 0005). Antes, al re-sincronizar, el flag puesto a mano en un gasto de la nube se perdía; ahora sobrevive a reinstalaciones y sincroniza entre dispositivos.
- 👆 **Huella en la app Android (por fin):** plugin nativo propio `MiCartera` con `BiometricPrompt` — huella o, si no hay, el PIN/patrón del móvil. La web lo usa automáticamente si existe; en navegador sigue la vía WebAuthn de siempre.
- 📱 **Widget de pantalla de inicio:** gasto del mes vs presupuesto (con barra y «te quedan X»), saldo de la cuenta de gasto diario y hora de actualización. Lo alimentan la app al usarla **y el lector de notis de TR con la app cerrada** (la respuesta de `ingest` trae el total del mes).
- 🔔 **Notificaciones de verdad (sin abrir la app):** al capturar un gasto de TR llega una notificación «✓ Gasto apuntado: X € en Y» — y si con ese gasto superas el presupuesto (o cruzas el 80%, o es un gasto tocho) llega también la alerta 🚨, calculada en el servidor. Los avisos al apuntar un gasto a mano también salen como notificación nativa. (Permiso de notificaciones: la app lo pide al abrirse, Android 13+.)

## [3.78.0] — 2026-07-05
### Primer arranque a prueba de sustos (reinstalar / móvil nuevo / app Android)
- 🛟 **Iniciar sesión no recuperaba tus datos (y podía machacarlos):** al reinstalar o estrenar móvil, si terminabas el onboarding con la cartera vacía y *luego* iniciabas sesión, la lógica «protege lo offline» creía que tu cartera vacía era «más nueva» que la nube → se quedaba vacía y podía **sobrescribir la nube**. Ahora, al **iniciar sesión** (no un reconecta del mismo usuario), la **nube manda siempre** y recupera todo al instante; los gastos se siguen fusionando (nunca se pierden). Ningún dato se perdió con el bug anterior: hay copia local, en la nube y **backups diarios**.
- 🐛 **El botón «Ya tengo cuenta» no hacía nada:** el panel de login se abría *por detrás* de la pantalla de bienvenida (z-index 60 bajo el 90 del onboarding), invisible. Subido a 120 → ahora aparece por delante y es clicable.
- ✨ **Bienvenida orientada a «ya tengo cuenta»:** aviso destacado arriba del onboarding — «¿Reinstalaste o cambiaste de móvil? Inicia sesión y recuperas todo al instante» — con botón de login a mano (antes estaba enterrado al final).
- 🐛 **Tutorial y login se pisaban:** el tour de bienvenida arrancaba encima del panel de inicio de sesión (y del cajón de Ajustes). Ahora espera a que no haya login/cajón abiertos.

## [3.77.0] — 2026-07-05
### Botón de sincronización con Trade Republic (beta) + arreglo de Ajustes
- 🔗 **Conectar Trade Republic (Inversiones → «Conectar Trade Republic · BETA»):** un botón que trae tus posiciones al momento (participaciones, valor y coste EN VIVO) y las re-ancla por ISIN, reutilizando el mapeo del importador CSV. Solo LEE: nunca opera ni mueve dinero. Las posiciones en $ se convierten con el cambio del BCE. La UI completa (login teléfono+PIN → código 2FA → previsualización con mapeo → aplicar → desconectar) queda cableada y verificada.
- 🏗️ **La conexión real es NATIVA de Android:** el login de TR está detrás de AWS WAF y exige un token que solo se consigue desde un navegador de verdad (una Edge Function «pelada» recibe 403). Por eso la conexión la implementa la capa nativa del APK (que ES un navegador real y resuelve el WAF gratis). En la web pura la tarjeta muestra un aviso «disponible en la app Android» y el importador CSV sigue como alternativa. El contrato del puente nativo (`window.MiCarteraTR` / plugin Capacitor `TradeRepublic`: `login`/`verify`/`sync`/`status`/`logout`) queda documentado en el código listo para rellenar al montar el APK. Credenciales y sesión viven solo en el móvil, nunca en la nube.
- 🐛 **Texto invisible en Ajustes (temas oscuro/verde/azul):** los botones «Ver el tutorial» e «Informe del mes» ponían fondo pero no color de texto, así que heredaban el negro del estilo base y no se leían salvo en tema Claro. Ahora usan `var(--text)` como el resto.

## [3.76.0] — 2026-07-04
### Arreglos gordos de UX (tabs, ayudas, informe) + interés TR + avisos
- 🐛 **Tabs que "a veces" no se podían mover ni quitar:** si la app arrancaba en la pantalla de bloqueo (PIN/huella) o en el onboarding, los listeners de arrastre de pestañas no se instalaban nunca en esa sesión. Ahora se enganchan al desbloquear. (Por eso fallaba en la demo y en casa: dependía de si la app abría bloqueada.)
- 🐛 **Ayudas «?» que salían en Resumen:** el track de páginas lleva un `transform` permanente y capturaba el `position:fixed` del overlay — la tarjeta de ayuda se pintaba sobre otra pestaña. Ahora va en un portal a `<body>`: sale centrada, estés en la pestaña que estés.
- 🎨 **Informe del mes a prueba de móviles:** los colores ya no se leen de las variables CSS (que el "modo oscuro automático" de algunos Android reescribe, dejando textos negros ilegibles) sino de una paleta fija por tema. El tutorial y las tarjetas de ayuda declaran su color explícito por la misma razón.
- ❓ **Ayudas «?» en (casi) todas las tarjetas:** de 5 a 23 — Resumen (distribución, culpable, tendencia, ahorro, meta), Gastos (suscripciones), Inversiones (rentabilidad, por tipo, evolución), Patrimonio (cuentas+ROLES, desglose TR, inversiones, bienes) y Fijos (recibos, cuotas, nómina/transfers, puntuales). ES/EN/CA.
- 🎓 **Tour más completo:** 3 pasos nuevos — mover/quitar/añadir pestañas, la pestaña Patrimonio, y qué son los «?».
- 💶 **Interés del efectivo TR (Inversiones → Round-up):** campo «% anual»; al cerrar cada mes la app abona el interés sola. Era la fuga principal del descuadre lento con TR (TR paga intereses el día 1 y la app no los contaba). El desglose TR ahora explica los descuadres pequeños legítimos (intereses + TR invierte round-ups los días 2/9/16/23).
- 🔔 **Avisos al apuntar un gasto** (in-app; las push de verdad llegarán con el APK): pasarse del presupuesto, cruzar el 80 %, o un gasto tocho (≥15 % del presupuesto).

## [3.75.0] — 2026-07-04
### Roles de cuenta + gasto por Open Banking + informe del mes en imagen
- 🎭 **Roles de cuenta (Patrimonio → Editar):** cada cuenta puede ser **🏦 Recibos** (los fijos/cuotas salen de ahí, como siempre), **🛒 Gasto diario** (de ahí sale lo que apuntas en Gastos — lo que antes era "la TR" fija) o **🔁 Todo** (una sola cuenta para ambas cosas, como usa mucha gente). Solo puede haber una de gasto diario; al cambiar el rol **el saldo mostrado se conserva** (re-anclaje automático, nada "salta"). Motor completo: saldo dinámico, cierre de mes y conciliación entienden los tres roles.
- 🏦 **Compras con tarjeta → Gastos, solas:** si tu cuenta de gasto diario es un banco conectado por Open Banking, sus compras con tarjeta **entran automáticamente como gastos** (idempotente por ext_id, solo tarjeta — recibos y bizums fuera, sin doble conteo: primero entran los gastos y luego se re-ancla con el saldo real). Para el creador es inerte (su gasto va por TR, que no está en OB); es la pieza que hace la app usable por gente con ING/CaixaBank para el día a día.
- 💶 La **inyección de nómina de TR (1500 €)** deja de ser un número global hardcodeado: ahora es un campo por cuenta (`inject`, sembrado para la cuenta del creador) — otro paso para compartir la app.
- 📸 **Informe del mes (Ajustes):** genera una imagen bonita (1080×1350, colores de tu tema) con el gasto del mes vs presupuesto, top categorías y patrimonio, y abre el compartir del móvil (o descarga el PNG). Todo en el dispositivo.
- 🐛 Arreglado de paso: editar a mano el saldo TR no revertía el aporte periódico (anclaba 50 € desviado).

## [3.74.0] — 2026-07-03
### Botón «Nueva versión» + plan de ahorro TR (los 50 €/mes al FTSE cuadran solos)
- ✨ **Aviso de actualización con botón:** cuando hay una versión nueva esperando, aparece un pill verde arriba «✨ Nueva versión · toca para actualizar»; al tocarlo se activa y recarga al momento (tú decides cuándo). Si no lo tocas, entra sola en el siguiente arranque, como siempre. Blindado para que la PRIMERA instalación del SW no recargue sola (guard `_mcUserInitiated`; el viejo bug de v3.20 no vuelve).
- 💶 **Aporte periódico a inversión (plan de ahorro TR):** nuevo campo «Aporte periódico» en la tarjeta Round-up & Saveback (Inversiones). Los 50 €/mes que van del efectivo de TR al FTSE ahora **se descuentan solos del efectivo** (en vivo, con su línea en el Desglose del efectivo TR) y al cerrar el mes **compran participaciones** en la inversión destino (mismo mecanismo probado del round-up: valores absolutos, sin doble conteo, patrimonio total intacto). Sembrado con tus 50 € → FTSE All-World.
- ✅ Verificado: cierre de mes 6000 +1500 nómina −50 aporte = 7450 en TR y el FTSE sube exactamente +50 € en coste y participaciones.

## [3.73.0] — 2026-07-03
### UX para no-técnicos (padres): tour guiado + modo Sencillo de verdad + ayudas «?»
- 🎓 **Tour de bienvenida (coach-marks):** la primera vez tras el onboarding, la app señala con un foco los sitios clave (tu dinero, Gastos, Fijos, Ajustes, la nube) con una frase llana por paso. Saltable, y relanzable cuando quieras desde **Ajustes → 🎓 Ver el tutorial**. Los usuarios existentes no lo ven de golpe (solo bajo demanda).
- 🧓 **Modo Sencillo de verdad:** además de dejar 3 pestañas, ahora también simplifica el Resumen (fuera widgets avanzados: distribución, tendencias, rachas…) y **habla sin jerga**: «Patrimonio neto» → «Tu dinero en total», «Fijos» → «Recibos», «Activos» → «Lo que tienes» (ES/EN/CA).
- 🔍 **Letra grande:** nuevo botón en Ajustes que escala toda la app un 12 % (accesibilidad).
- ❓ **Ayuda contextual:** botón «?» en las tarjetas complejas (round-up, importador, proyección, simulador, conciliación) que explica en cristiano qué hace cada una.
- 🧹 **Des-personalización:** el override «mapfre→bares» del creador ya no va hardcodeado para todo el mundo (ahora es una semilla solo de su cartera); el mes de la cabecera respeta el idioma elegido (antes siempre en español).

## [3.72.0] — 2026-07-03
### Importador CSV del bróker — sync de inversiones sin dar credenciales a nadie
- 📥 **Nueva tarjeta «Importar del bróker (CSV)» en Inversiones:** exporta tus movimientos desde la app del bróker (Trade Republic exporta CSV), súbelo o pega el texto, y la app **re-ancla tus posiciones a la verdad del extracto** (participaciones + coste absolutos, con coste medio y ventas parciales bien calculadas). Previsualización SIEMPRE antes de aplicar, con mapeo por posición (sugerido por ISIN guardado o por nombre) y opción «no tocar». Tras aplicar se refrescan los precios para recalcular el valor de mercado.
- 🔒 **Todo se procesa en el móvil**: el CSV no se sube a ningún servidor. Cero credenciales, cero dependencias de terceros.
- 🧠 **Parser tolerante:** detecta separador (`;`/`,`/tab), fila de cabeceras y columnas por nombre en ES/EN/DE (fecha/date/datum, cantidad/shares/anzahl…) o por la pinta de los valores (ISIN por regex, fechas). Entiende compras, ventas, planes de inversión, **saveback/round-up** (son compras), e informa de **intereses y dividendos** detectados (p. ej. el interés de TR que descuadraba el efectivo).
- 🔁 **Sin doble conteo con el round-up modelado:** el import fija valores ABSOLUTOS (re-ancla), no suma deltas; el motor sigue proyectando desde el ancla nuevo.
- 📝 Contexto: investigado el sync automático de inversiones (mandato "no se puede no existe"). SnapTrade no cubre TR/Revolut/MyInvestor (verificado contra su API pública), Plaid Investments es US/CA, y las vías reales (Flanks —lo que usa Getquin—, wealthAPI) son B2B con contrato → encajan en Fase 3 junto a Enable Banking producción. El CSV es lo que usan los trackers serios sin pedir login del bróker.

## [3.71.0] — 2026-07-03
### Tabs dinámicas + arranque instantáneo + adiós CDNs de terceros
- ➕ **Tabs dinámicas (idea del compi del curro):** botón **«+»** al final de la barra para añadir pestañas ocultas (sale una hoja con las disponibles; al tocar una se añade al final y salta a ella), y **papelera al arrastrar**: mantén pulsada una pestaña y suéltala sobre la papelera para quitarla (el Resumen no se puede quitar). Se persiste en `settings.tabHidden` y sincroniza entre dispositivos. El modo Sencillo de Ajustes ahora es un preset de esto mismo (retrocompatible: quien tenía modo sencillo sigue viendo lo mismo).
- 🖐️ **El drag de pestañas ahora levanta la que tocas** (antes levantaba siempre la activa, aunque mantuvieras pulsada otra).
- 🐛 **Fix swipe:** con pestañas ocultas (p. ej. modo Sencillo), deslizar más allá de la última saltaba de golpe al Resumen (usaba el total de pestañas en vez de las visibles). Ahora hace la resistencia de borde normal.
- ⚡ **Arranque instantáneo (Service Worker stale-while-revalidate):** la app abre AL MOMENTO desde caché (incluso con red lenta o sin conexión) y la versión nueva se descarga por detrás y entra en el siguiente arranque — mismo modelo de actualización de siempre, pero sin esperar a la red al abrir.
- 📦 **Cero CDNs de terceros:** supabase-js auto-hospedado y **con versión fijada** (`vendor/supabase.min.js` v2.110.0; antes jsdelivr con `@2` flotante, que podía romper la app sola el día menos pensado) y fuentes Manrope/Fraunces auto-hospedadas (`fonts/`, variables, latin+latin-ext; antes CSS bloqueante de Google Fonts). Todo cacheado por el SW ⇒ la app entera va offline y carga menos.
- 🗜️ **Minificación en CI:** nuevo `scripts/minify-html.mjs` (esbuild; solo espacios+sintaxis, sin renombrar símbolos) en el workflow de deploy. El `index.html` del repo sigue siendo la fuente legible; el artefacto desplegado pesa ~14% menos (~26% menos el código propio).
- 🎨 **Temas redondeados:** el tema elegido se aplica **antes del primer pintado** (adiós fogonazo oscuro del splash en tema claro), la barra de estado del móvil (`theme-color`) se tiñe del color del tema, la pantalla de bloqueo y el splash respetan el tema, y el degradado de la barra de tabs y los puntitos de página ya no llevan colores oscuros fijos.

## [3.70.1] — 2026-07-01
### Cuentas extra de Open Banking: nombres bonitos + editables
- ✏️ Las cuentas extra sincronizadas (compartidas, 2ª cuenta de un banco) traían nombres feos del banco (los titulares de una conjunta, un tipo técnico o nada). Ahora se muestran con un **nombre "bonito" automático** (`niceObName`: conjunta/ahorro/corriente, o el final del IBAN si no hay nombre) y se pueden **renombrar a mano** en Patrimonio → Editar (se guarda en `state.obLabels` y sincroniza). Sigue el mismo formato que las cuentas manuales.

## [3.70.0] — 2026-07-01
### UX y motor — feedback tras probar Open Banking multibanco
- 🔙 **Gesto/botón "atrás" ya no saca de la app:** el cajón de Ajustes, la sección "Mis bancos" y su buscador de bancos ahora meten una entrada de historial al abrirse (History API), así el gesto de retroceso del móvil los **cierra** en vez de salir de la PWA. Se cierran en orden (primero el de encima) y el cierre por botón/swipe también consume su entrada. Nuevo hook `useBackClose` con pila global.
- 🔁 **Ingresos y transferencias: mensual o puntual.** Nuevo toggle "🔁 Cada mes / 📅 Una vez" al añadir un flujo; los puntuales (`f.once={y,m}`) solo cuentan ese mes/año concreto, muestran un badge "📅 mes año" y desaparecen de la lista al pasar. Así un ingreso o traspaso de una sola vez no se repite cada mes.
- 🔎 **Desglose del efectivo de TR (Patrimonio):** tarjeta plegable que enseña de dónde sale el saldo mostrado (`base + nómina − gasto del mes − round-up = saldo`) y lista los gastos del mes con su etiqueta 💳 tarjeta / 🔄 bizum y el round-up que aporta cada uno. Diagnóstico para cuadrar descuadres (p.ej. detectar un bizum mal marcado 💳 que infla el round-up). Solo lectura, no cambia el comportamiento.
- 🏦 **"Banco sin cuentas" claro:** cuando un banco autoriza pero vuelve sin cuentas dadas de alta (modo restringido), "Mis bancos" ahora lo muestra con estado propio **"sin cuentas"** + explicación persistente del paso que falta (enlazar la cuenta en el panel de Enable Banking) y botón "Volver a intentar", en vez de pintarlo como "caducado".
- 🏦🏦 **Open Banking MULTI-CUENTA (genérico, cualquier banco):** hasta ahora solo se traía **una** cuenta por banco. Ahora se sincronizan **todas** las cuentas de cada banco enlazado. La cuenta "primaria" (la que ya tienes creada) se re-ancla como siempre; las demás (p.ej. la **compartida de Revolut**, o todas las de un banco recién conectado sin cuenta manual) aparecen como **cuentas aparte** en Patrimonio (`state.obAccounts`) — saldo real que suma al patrimonio **sin tocar el motor de cash-flow** (cero doble conteo). Nueva migración `0004_bank_accounts.sql` (columna `accounts` JSONB, aditiva) + `bank-callback` guarda todas las cuentas autorizadas + `bank-sync` las recorre (cada una en su try/catch; el fallo de una no tumba las demás) manteniendo los campos top-level de la primaria para retrocompatibilidad. "Mis bancos" muestra el nº de cuentas. ⚠️ Requiere aplicar la migración 0004 y whitelistear cada cuenta en el panel de Enable Banking. **Nota:** las carteras de valores/acciones (Revolut, TR, fondos) NO vienen por Open Banking (PSD2 solo cubre cuentas de pago) → siguen manuales.

## [3.69.3] — 2026-06-30
### Causa raíz del "0 cuentas" (Revolut, MyInvestor, CaixaBank…) — no era un bug
- ✅ **Confirmado por la FAQ de Enable Banking:** en **modo restringido (restricted production)** la API compara las cuentas autorizadas contra las que tienes **enlazadas (whitelisted)** en el panel de control y **descarta el resto** → una sesión autorizada que vuelve con 0 cuentas significa que esa cuenta **no está dada de alta** en la app. Hoy solo está enlazada la de Sabadell; por eso Revolut (y MyInvestor/CaixaBank) volvían "sin cuenta". **El arreglo es enlazar cada cuenta en el panel de Enable Banking**, no es código.
- 💬 **Mensaje accionable en vez de texto críptico:** cuando la sesión está autorizada pero vuelve con 0 cuentas, `bank-callback` ahora devuelve un código corto (`nolink:<banco>`) y la app muestra "{Banco}: esta cuenta aún no está dada de alta en Enable Banking (modo restringido). Enlázala en el panel y vuelve a conectar." (ES/EN/CA). El diagnóstico crudo se reserva solo para el caso raro en el que ni siquiera hubo sesión.

## [3.69.2] — 2026-06-30
### Diagnostics — Revolut devuelve la sesión con 0 cuentas
- 🔍 Confirmado con el diagnóstico real: Revolut crea la sesión (hay `session_id` y `access`) pero `accounts` viene **vacío** y sin `accounts_data`. `bank-callback` ahora **reintenta `GET /sessions/{id}` con espera** (×3, por si las cuentas se rellenan con retardo) y, si sigue sin cuenta, el error incluye un diagnóstico completo: conteos de POST y GET, `status` de la sesión y el `access` concedido. Sirve para cerrar el caso Revolut en el próximo intento.

## [3.69.1] — 2026-06-30
### Fixed — Conexión de bancos que devolvían 0 cuentas
- 🐛 **MyInvestor/Revolut/Caixa daban "sin cuenta utilizable (recibidas: 0)":** Enable Banking entrega las cuentas en formas distintas según el banco; solo leíamos `session.accounts` como objetos. Ahora `bank-callback` lee también `accounts_data` y los UID sueltos, y si el `POST /sessions` viene vacío hace fallback a `GET /sessions/{id}`. Si aún así no hay cuenta, el error incluye un diagnóstico real (claves y conteos de la respuesta) en vez de un mensaje opaco. (Sabadell ya conectaba bien.)

## [3.69.0] — 2026-06-30
### Fixed — Proyección y Open Banking (la app se "volvía loca")
- 🐛 **Doble conteo de la nómina / "= a fin de mes" disparado:** la heurística pagado/pendiente usaba `<` estricto, así que lo que ocurre **hoy** (nómina, IRPF, fijos del día) se contaba como pendiente y se sumaba **encima** del saldo real del banco. Cambiado a `<=` en `isPaidIn`, `isPaidThisMonth`, `flowPaid`, `monthNetForAccount` y `debtPaidCount`. (Reproducido: `2673 + 3333 − 146 = 5860` → ahora `2673`.)
- 🐛 **Sync de Sabadell tumbaba a todos los bancos:** `bank-sync` sincronizaba en un bucle donde un único fallo lanzaba 500 y obligaba a resincronizar todo. Ahora cada banco va en su propio try/catch; el fallo de uno no afecta a los demás y un 401/403/404 marca **solo** ese enlace como `expired` (reconectar). La app aplica los saldos de los que sí funcionaron y avisa del banco concreto.
- 🐛 **Bancos nuevos salían "caducado" al conectar:** `bank-callback` cogía a ciegas `accounts[0]`; si no traía `uid` guardaba `status:error`. Ahora busca la primera cuenta con `uid` (soporta string/objeto) y, si no hay cuenta utilizable, devuelve un error honesto en vez de un falso `ok`.
- 🐛 **"Aún no aparece en el banco" (IBI) falso positivo:** la conciliación solo marca un cargo como "no aparece" si el feed del banco **cubre realmente ese día**; con sync vieja o parcial ya no inventa el aviso.

## [3.39.0] — 2026-06-23
### Added — Idiomas COMPLETO (ES/EN/CA) · [#14](https://github.com/JuanjoAvila/Aely/issues/14)
- Traducidas las pestañas restantes: **Inversiones** (incluida la proyección y el rendimiento por posición), **Patrimonio**, **Deudas** y el **login/cuenta** (pantalla de bloqueo y panel de sesión). Con esto **toda la app está disponible en español, inglés y catalán**.

## [3.38.0] — 2026-06-23
### Added — Idiomas (fase 3): Fijos (motor) · [#14](https://github.com/JuanjoAvila/Aely/issues/14)
- Traducida al completo (ES/EN/CA) la pestaña **Fijos**: próximos cargos, cash-flow, alarmas, servicios, cuotas de deuda, ingresos/transferencias y cargos puntuales, con todos sus formularios. Frecuencias y meses traducidos.

## [3.37.0] — 2026-06-22
### Added — Idiomas (fase 2): Resumen y Gastos · [#14](https://github.com/JuanjoAvila/Aely/issues/14)
- Traducidas al completo (ES/EN/CA) las pestañas **Resumen** y **Gastos**, incluidos meses, categorías, fechas (locale) y «Hoy/Ayer». Helper `tf()` para textos con variables.

## [3.36.0] — 2026-06-22
### Added — Idiomas (fase 1) · [#14](https://github.com/JuanjoAvila/Aely/issues/14)
- **Selector de idioma en Ajustes: Español / English / Català.** Sistema de traducción (`t()`) con diccionario y **fallback a español** (lo que aún no está traducido se ve en español, nada se rompe).
- Traducido en esta fase: **navegación (pestañas), Ajustes y la bienvenida/onboarding**. El contenido de cada pestaña se irá traduciendo en las siguientes fases.

## [3.35.0] — 2026-06-22
### Fixed
- **Arrastre del Resumen:** al mantener pulsada una tarjeta ya no se selecciona el texto (se bugeaba el movimiento). Las tarjetas no son seleccionables.
- **Texto del ahorro:** «¿De dónde sale el ahorro?» → «¿A dónde va tu ahorro?» (es hacia dónde va, a inversión).

## [3.34.1] — 2026-06-21
### Added
- **Más restaurantes autodetectados:** KFC, Five Guys, Goiko, TGB, Taco Bell, Domino's, Subway, Starbucks, Foster's, 100 Montaditos, La Sureña, Dunkin', Popeyes, Nando's, Udon, La Tagliatella, Ginos y muchos más caen ahora en «Bares y restaurantes» (🍽️) en vez de «Otros». Los que entren por sincronización se recategorizan solos.

## [3.34.0] — 2026-06-21
### Added — Feedback de amigos: ingresos, borrar, presupuesto rápido, color deuda
- **Gastos variables: borrar y añadir ingresos** ([#13](https://github.com/JuanjoAvila/Aely/issues/13)): en «Apuntar» puedes elegir **Gasto o Ingreso** (p.ej. cuando alguien te devuelve dinero); el ingreso resta del gasto del mes y se muestra en verde. Cada gasto/ingreso tiene una **✕ para borrarlo** (con tombstone para que no reaparezca al sincronizar).
- **Editar el presupuesto desde el Resumen** ([#12](https://github.com/JuanjoAvila/Aely/issues/12)): un **lápiz** junto a «Presupuesto» abre una cajita para cambiarlo al vuelo, sin ir a Ajustes.
- **Color de la deuda = su barra** ([#16](https://github.com/JuanjoAvila/Aely/issues/16)): la bolita de cada deuda y su barra de progreso usan ahora el mismo color (con variedad por deuda).

## [3.33.0] — 2026-06-21
### Changed — Arrastre del Resumen más fluido + auto-scroll
- **Las demás tarjetas se apartan con animación** al hacer hueco mientras arrastras (transición suave), en vez de una línea fija. Mucho menos "robótico".
- **Auto-scroll:** al arrastrar una tarjeta hacia el borde superior o inferior, la pantalla se desplaza sola para poder soltarla más arriba/abajo de lo que se ve.

## [3.32.0] — 2026-06-21
### Added — Arrastrar tarjetas del Resumen (mantener pulsado) · [#7](https://github.com/JuanjoAvila/Aely/issues/7)
- **Reordenar arrastrando:** mantén pulsada una tarjeta del Resumen y arrástrala para moverla, con línea que marca dónde caerá (más "pro" y dinámico). Un toque rápido no la mueve, así que abrir/cerrar tarjetas y el scroll siguen igual. El botón «Personalizar» se mantiene para ocultar/mostrar (y reordenar con flechas como alternativa).

## [3.31.0] — 2026-06-21
### Added — Resumen personalizable · [#7](https://github.com/JuanjoAvila/Aely/issues/7)
- **Reordenar y mostrar/ocultar las tarjetas del Resumen.** Botón «✎ Personalizar»: cada tarjeta puede subir/bajar y ocultarse o mostrarse. El orden y lo oculto se guardan y se sincronizan. El «Patrimonio neto» se puede reordenar pero no ocultar (queda fijo).
- _Nota: el reordenado es con flechas ↑/↓ (robusto en móvil); el arrastre con el dedo se puede añadir más adelante._

## [3.30.0] — 2026-06-21
### Added — Dashboard de inversiones más rico · [#6](https://github.com/JuanjoAvila/Aely/issues/6)
- **Rendimiento por posición:** nueva tarjeta en Inversiones con la ganancia (€ y %) de cada activo, ordenado de mejor a peor, con barra de color (verde/rojo) y resaltado del mejor y el peor. Respeta el toggle €/$ de la pestaña.
- **Evolución del valor invertido:** se guarda un punto por día del total invertido y se dibuja una mini-gráfica de evolución (se va construyendo a partir de ahora).

## [3.29.0] — 2026-06-21
### Added — Onboarding / arranque limpio · [#3](https://github.com/JuanjoAvila/Aely/issues/3)
- **Los usuarios nuevos arrancan con la cartera VACÍA** (ya no heredan los datos de ejemplo). Pantalla de bienvenida para meter el presupuesto y las cuentas (banco + saldo); inversiones, deudas y gastos fijos se añaden luego en sus pestañas.
- **Volver en otro móvil:** botón «Ya tengo cuenta · Iniciar sesión» en la bienvenida para recuperar tus datos de la nube sin tener que rellenar nada.
- **Sin afectar a los usuarios actuales:** el estado existente se marca como `onboarded` y se conserva igual; las semillas de la cartera de ejemplo quedan atadas solo a esa cartera (un usuario nuevo no recibe la nómina/transferencias de ejemplo).

## [3.28.1] — 2026-06-21
### Fixed
- **Tema claro salía oscuro en algunos móviles:** el «modo oscuro automático» de Chrome Android oscurecía a la fuerza el tema claro. Se declara `color-scheme` (meta + por tema) para que el navegador respete el tema elegido y no lo invierta.

## [3.28.0] — 2026-06-21
### Added — Temas de color · [#4](https://github.com/JuanjoAvila/Aely/issues/4)
- **4 temas seleccionables en Ajustes:** Verde (el de siempre), **Oscuro** (negro neutro), **Claro/blanco** y **Azul**. Se cambian al vuelo (variables CSS por `data-theme`), se guardan en ajustes y se sincronizan entre dispositivos. Se aplican antes del primer pintado, sin parpadeo.
- El panel de Ajustes y el cajón lateral ahora usan variables de color, así que también se adaptan al tema elegido.

## [3.27.0] — 2026-06-21
### Added — Inversiones: moneda €/$ por pestaña + contribuciones por bróker
- **Toggle €/$ en la pestaña Inversiones:** cambia la moneda solo de esa pestaña (todo se calcula en € y se muestra en € o $ con el cambio del BCE). Así puedes ver, p.ej., el bloque de Revolut en dólares y compararlo con su app, sin cambiar la moneda de toda la app. El toggle global de Ajustes sigue ahí como opción.
- **Contribuciones vs ganancias por bróker:** la tarjeta ahora desglosa Revolut / Trade Republic / MyInvestor por separado (invertido, valor y ganancia de cada uno), además del total. Resuelve la confusión de ver todo mezclado y en una sola moneda.
- Aclarado que «Invertido» es la **base de coste** (no las «contribuciones netas» del bróker, que difieren tras ventas parciales) y que la ganancia mostrada es la **plusvalía latente** (valor − coste).
### Changed
- **Sin toast al iniciar:** la sincronización con la nube al abrir la app ya no muestra el aviso «✓ Sincronizado» (solo avisa si falla). Era molesto en cada arranque.

## [3.26.0] — 2026-06-21
### Fixed — Cash-flow: aviso del bajón ANTES de cobrar
- **El orden importa:** «Próximos cargos» ahora simula el saldo **día a día** durante el resto del mes. Si los fijos se cobran antes de que entre la nómina (último día), avisa del **punto más bajo** aunque a fin de mes cuadres. Ej.: Sabadell 225 € con 359 € de fijos pendientes y nómina el día 30 → muestra «⚠ punto más bajo (día 29): −134 €» y la 🚨 alarma «se queda en −134 € sobre el día 29 (antes de que entre la nómina)».
- La alarma usa ese mínimo (cubre tanto el bajón intra-mes como no llegar a fin de mes). Cargos sin día se asumen al principio (peor caso) y los ingresos sin día al final, para avisar de forma conservadora.

## [3.25.0] — 2026-06-20
### Added — Deuda dinámica · [#2](https://github.com/JuanjoAvila/Aely/issues/2)
- **El saldo de cada deuda baja solo cada mes** según lo que amortizas, sin tocarlo a mano. Se calcula proyectando desde un ancla (`asOf`): saldo de hoy = saldo anclado − amortización/mes × meses transcurridos. No muta el dato guardado (no descuadra la sync entre dispositivos); cuando metes el saldo real del banco, se vuelve a anclar solo.
- **Cuota ≠ amortización:** se puede separar lo que **pagas en efectivo** (cuota, lo que usa el cash-flow del Sabadell) de lo que **amortiza el principal** (cuánto baja el saldo). Resuelve el préstamo de mamá: pagas 197 € pero la deuda baja 250 €/mes. Se edita en Fijos → Cuotas de deuda (campo «amortiza/mes»).
- El **patrimonio neto** usa el saldo proyectado, así que sube solo conforme amortizas.

Con esto queda **completo el motor dinámico**: calendario de fijos, día de cobro (pagado/pendiente), cobros a medida, cash-flow de nómina/transferencias, cargos puntuales y deuda dinámica.

## [3.24.0] — 2026-06-20
### Added — Cargos puntuales · [#17](https://github.com/JuanjoAvila/Aely/issues/17)
- **Cargos de una sola vez:** nueva tarjeta «Cargos puntuales» (pestaña Fijos) para apuntar un cobro único en un mes/año concreto — imprevistos o amortizaciones. Con importe, mes, año, día y banco.
- Entra en «Próximos cargos» el mes que toca (se tacha al pasar su día, cuenta para disponible y alarma) y **desaparece de la lista cuando pasa el mes** (solo cuenta una vez).
### Changed
- `.claude/` (tooling local de preview/ajustes) añadido a `.gitignore`: deja de aparecer como cambios en cada release.

## [3.23.0] — 2026-06-20
### Added — Cobros a medida + nómina/transferencias a día laborable
- **Importes y días distintos por cobro:** un gasto no mensual puede tener un **calendario a medida** (toggle «Importes/días distintos por cobro» al editar). Resuelve los pagos que NO son mitades exactas: seguro del coche 172,05 + 166,94, o Hacienda 146,14 (30 jun) + 97,42 (5 nov). Cada cobro con su importe y su día.
- **Nómina y transferencias a día laborable:** los movimientos recurrentes pueden fijarse a **último día laborable** (la nómina) o **primer día laborable** (las transferencias automáticas a TR/MyInvestor) en vez de un número de día fijo. Se recalcula solo cada mes. Las transferencias manuales puntuales siguen con día fijo.
### Changed
- **Cancelar al añadir:** los formularios de «añadir gasto fijo» y «añadir ingreso/transferencia» tienen botón **Cancelar** para cerrar la sección sin guardar.

## [3.22.0] — 2026-06-20
### Added — Cash-flow automático: nómina y transferencias · [#18](https://github.com/JuanjoAvila/Aely/issues/18)
- **El Sabadell se calcula solo:** nuevo bloque «Ingresos y transferencias» (pestaña Fijos) para definir movimientos recurrentes: la **nómina** que entra y las **transferencias automáticas** que salen (1550 € a Trade Republic, 500 € a MyInvestor). Cada uno con importe, **día** y banco(s).
- **Disponible proyectado a fin de mes:** «Próximos cargos» muestra ahora el cash-flow completo del Sabadell: *hoy + nómina por entrar − transferencias pendientes − fijos pendientes = a fin de mes*. Los movimientos cuyo día ya pasó no se recuentan (ya están en el saldo).
- **Alarma mejorada:** salta si un banco se queda **en negativo a fin de mes** una vez contadas nómina, transferencias y fijos pendientes (antes solo miraba los cargos contra el saldo de hoy).
- Sembrado con tus datos reales: 3333 − 1550 − 500 = 1283 € para fijos. Ajusta los días en «Editar» a cuándo te pasan cada cosa.

## [3.21.0] — 2026-06-20
### Added — Cuotas de deuda editables en Fijos
- **Día y banco por cuota de deuda:** la tarjeta «Cuotas de deuda» (pestaña Fijos) ahora tiene «Editar» como los gastos fijos: se puede fijar el **día de cobro**, el **banco** del que se descuenta y la **cuota mensual**. Así las cuotas se **tachan al pagarse** en «Próximos cargos» y la alarma/disponible las cuentan bien. El saldo pendiente de la deuda se sigue editando en la pestaña Deudas.

## [3.20.0] — 2026-06-20
### Added — Motor dinámico: día de cobro (pagado vs pendiente) · [#1](https://github.com/JuanjoAvila/Aely/issues/1)
- **Día de cobro por gasto:** cada gasto fijo puede llevar el **día del mes** (1-31) en que se cobra (en «Añadir» y «Editar»). Los cargos cuyo día **ya pasó** este mes se marcan como **✓ pagado** (tachados) y **no restan** del disponible; los que faltan son **pendientes**.
- **«Próximos cargos» más realista:** el cuadro «te quedarían» y la **🚨 alarma** miran solo lo **pendiente** (el saldo del banco ya refleja lo pagado). Lista separada de «Pendiente» y «Ya pagado este mes», con una etiqueta «día N» en cada cargo.
### Fixed
- **La app ya no se recarga sola al abrir:** el service worker dejaba de forzar la actualización a media sesión (`skipWaiting` + recarga en `controllerchange`). Ahora la versión nueva se descarga en segundo plano y se aplica sola en el siguiente arranque, sin parpadeo.

## [3.19.0] — 2026-06-20
### Fixed — Motor dinámico (ajustes tras pruebas)
- **Importe anual repartido:** un gasto anual marcado en varios meses ahora reparte el total entre esos meses (p.ej. IBI 664 €/año en 4 meses = 166 €/cobro), en vez de cobrar el total en cada uno.
- **Líquido tras fijos por banco:** la tarjeta «Próximos cargos» ya no usa el líquido total; muestra el saldo del **Sabadell** (banco donde se cobran los fijos) menos los cargos del mes = lo que quedaría de verdad.
- **Bug de alta en modo edición:** al añadir un gasto estando en «Editar», la cajita de importe y los meses salían vacíos. Ahora los controles de edición leen el valor real si no hay borrador.
### Added — Motor dinámico (v2) · [#1](https://github.com/JuanjoAvila/Aely/issues/1)
- **Banco por gasto:** cada gasto fijo puede asignarse al banco del que se cobra (por defecto Sabadell), en alta y edición.
- **Alarma de saldo:** si los gastos fijos de un mes superan el saldo del banco al que se cargan, aparece un aviso 🚨 (genérico para cualquier usuario).
- **Aviso de mes cargado:** si en los próximos 4 meses hay uno con fijos muy por encima de la media, se avisa («se viene cargado 👀»).

## [3.18.0] — 2026-06-20
### Added — Motor dinámico (gastos fijos) · [#1](https://github.com/JuanjoAvila/Aely/issues/1)
- **Calendario de gastos fijos:** cada gasto no mensual (agua, IBI, seguros…) puede llevar el/los **mes(es) en que se cobra** mediante un selector de 12 meses (en «Añadir» y al «Editar»). Si no se asigna, se deriva de la frecuencia (bimestral, trimestral…); los anuales quedan «⚠ sin mes» hasta marcarlos.
- **Líquido tras fijos (Sabadell dinámico):** nueva tarjeta **«Próximos cargos»** en la pestaña Fijos que suma lo que se cobra **este mes** (fijos + cuotas de deuda) y muestra el **líquido estimado que quedaría** tras esos cargos, más un avance del mes siguiente. «Es tener una integración sin tenerla».
- **Resumen:** la tarjeta «Gastos fijos» ahora muestra, además de la media mensual, el **cargo real de este mes**.

## [3.17.0] — 2026-06-19
### Added
- **Conversor de moneda €/$:** toggle en Ajustes que muestra toda la app en euros o dólares (convierte con el cambio del BCE en vivo). Útil para ver las acciones de Revolut en su moneda.
- **Contribuciones vs ganancias** en Inversiones: tarjeta con lo aportado, el valor actual, la ganancia y una barra aportado/ganancia.

## [3.16.0] — 2026-06-19
### Added
- **Auto-precios del ETF y el oro:** la Edge Function `prices` ahora también cotiza el ETF FTSE All-World (VWCE.DE) y el oro (XAU) vía Yahoo Finance server-side, junto a las acciones US de Finnhub. El oro y el ETF pasan a tener ticker+participaciones (corrección única) y se actualizan con el botón "Precios USD". El fondo de MyInvestor (por ISIN) sigue manual, con sus números reales corregidos.
### Nota de despliegue
- Requiere redeploy de la función (se dispara solo al hacer push por el cambio en `supabase/**`).

## [3.15.0] — 2026-06-19
### Added
- **Distribución por tipo de activo** en Inversiones: barra apilada con % de Acciones / ETF / Fondo indexado / Materias primas (reutiliza el StackedBar del dashboard).

## [3.14.1] — 2026-06-19
### Fixed
- **Posiciones corregidas tras ventas parciales** (Micron, TSMC, AMD) con los datos reales de Revolut (participaciones, valor y coste) mediante una corrección única idempotente; adiós a las pérdidas falsas.
- **Deslizador de la proyección** ya no cambia de pestaña al arrastrarlo (stopPropagation, como los filtros de categorías).

## [3.14.0] — 2026-06-19
### Added
- **Proyección estilo Trade Republic:** deslizador para la contribución mensual (se mantienen los campos de % interés y años), gráfico con banda de rango (±2%), ejes con etiquetas (años / miles €) y marcadores al final.
- **Venta parcial de posiciones ("Vendí parte"):** en modo edición, cada posición tiene un botón que pregunta el % vendido y reduce **valor, coste y participaciones** proporcionalmente (adiós a las pérdidas falsas). Registra el **líquido vendido (realizado)** acumulado, visible en Inversiones.

## [3.13.0] — 2026-06-19
### Added
- **Calculadora de proyección** en Inversiones: aporte mensual + interés anual + años → valor futuro a interés compuesto sobre lo ya invertido, con gráfico (valor vs aportado) y ganancia estimada.
### Fixed
- **"Ya estás al día"** vuelve a salir cuando no hay gastos nuevos (el contador comparaba solo contra los de origen "supabase" y contaba los manuales ya sincronizados como nuevos).

## [3.12.1] — 2026-06-19
### Fixed
- **Cerrar Ajustes con gesto** mucho más sensible (umbral ~20% + detección de flick).
- **Gastos manuales en la BD:** `addExpense` usa upsert idempotente y, al sincronizar, se hace **backfill** de los gastos manuales que aún no estuvieran en la tabla `expenses` (p. ej. los apuntados antes de tener esta función).
- Nota del cambio €/$ en Inversiones marcada como "BCE en vivo" para dejar claro que es dinámico (no es un cambio de moneda visible; el efecto está en el valor en € de las acciones USD).

## [3.12.0] — 2026-06-19
### Added
- **Cambio €/$ dinámico:** la conversión de las inversiones en USD usa el tipo de referencia del BCE en vivo (frankfurter.app, gratis y sin key), refrescado al abrir la app y al pulsar "Precios USD". Cuadra mucho más con Revolut (salvo su spread). Primer paso del bloque de Inversiones.

## [3.11.0] — 2026-06-19
### Added
- **Cerrar Ajustes con gesto:** arrastrar de derecha a izquierda sobre el cajón lo cierra (además del tap fuera y el botón ×).
- **Gastos manuales se guardan en la BD:** al apuntar un gasto, además de la nube de estado se inserta en la tabla `expenses` de Supabase.
- **Filtro de categorías multiselección:** se pueden marcar/desmarcar varias categorías a la vez; "Todas" si no hay ninguna seleccionada.
### Removed
- Botón "Borrar datos locales" de Ajustes (innecesario; el estado vive en la nube).
### Notas
- La lista de gastos ya estaba paginada (muestra 12 y carga más al hacer scroll), así que no se ralentiza al crecer.

## [3.10.1] — 2026-06-18
### Changed
- **Gesto de Ajustes corregido:** Ajustes es ahora una "página oculta a la izquierda" del Resumen. En la 1ª pestaña, arrastrar de **izquierda a derecha** abre el cajón desde la izquierda (siguiendo el dedo, con snap); de derecha a izquierda sigue yendo a Gastos. Integrado en el swipe de pestañas (sin franja aparte). El engranaje se mantiene como alternativa.

## [3.10.0] — 2026-06-18
### Changed
- **Ajustes con gesto (1er intento):** cajón lateral con gesto desde el borde derecho (corregido en 3.10.1: el sentido natural es desde la izquierda).

## [3.9.0] — 2026-06-18
### Changed
- **Ajustes como cajón lateral** (estilo Revolut): entra deslizando desde la derecha.
- Quitado el **objetivo de ahorro** (redundante con "ahorro al mes" del resumen).
- Quitado el **botón de refrescar** de la barra superior (ya está el Sincronizar grande en Gastos).
### Added
- **Auto-sincronización** de gastos al abrir la app o volver a primer plano (visibilitychange).
### Fixed
- El toast de confirmación (p. ej. "Presupuesto guardado") ahora se ve por encima de los paneles (z-index).

## [3.8.0] — 2026-06-18
### Changed
- **Apps Script jubilado:** eliminado el fallback al Google Sheet/Apps Script en `onSync` y `fetchPrices` (ahora todo va por Supabase con sesión), quitadas las constantes `GAS_URL`/`PRICES_PARAM`/`FIELDS`, borrada la carpeta `apps-script/` y actualizada la documentación.
- **Tabs:** degradado en el borde derecho para indicar que se puede hacer scroll (en vez de cortar el último icono en seco).
### Fixed
- **"Tirar para refrescar" desactivado:** `overscroll-behavior` en el contenedor de scroll evita que el gesto recargue la app (que disparaba la huella varias veces seguidas).

## [3.7.0] — 2026-06-18
### Added
- **Pantalla de Ajustes** (icono de engranaje en la barra): presupuesto mensual y objetivo de ahorro editables, **export/import de datos en JSON** (copia de seguridad manual, clave por no haber backups en el plan Free), botón de **borrar datos locales**, y **versión visible** de la app.
- **Versión sellada automáticamente** en la app (`CONFIG.APP_VERSION`) por el CI en cada deploy.

## [3.6.0] — 2026-06-18
### Changed
- **Distribución de activos:** la barra usa la paleta del sistema (variables CSS) en vez de colores hardcodeados; el oro que chocaba se sustituye por el tono crema.
- **Tabs:** la pestaña activa muestra su texto y las demás solo el icono, así caben las 6 sin cortarse por la derecha en el móvil.

## [3.5.3] — 2026-06-18
### Changed
- **La tabla `expenses` es la fuente de verdad de los gastos de la nube:** al sincronizar se reemplazan los gastos de origen "supabase" con lo que hay en la tabla (así se reflejan cambios de categoría, importe y borrados). Los gastos manuales/sheet locales nunca se tocan, así que sigue sin haber riesgo de pérdida. Resuelve que las categorías no se actualizaran por el dedup aditivo.

## [3.5.2] — 2026-06-18
### Fixed
- **Categorías/logos de los gastos de Supabase:** el path de la nube usaba la categoría en crudo de la tabla; ahora pasa por `resolveCategory` (autodetección por comercio) igual que el del Sheet, así Playtomic→ocio, etc. vuelven a salir bien.

## [3.5.0] — 2026-06-18
### Added
- **Login con email + contraseña:** panel de cuenta propio (entrar / crear cuenta), sin depender del email/magic link ni de su límite de envíos. La sesión persiste en el dispositivo.
- **Desbloqueo biométrico (huella / Face ID) tipo app de banco:** candado local por dispositivo vía WebAuthn. Tras iniciar sesión, se activa desde el panel de cuenta; al abrir la app pide la huella. Sin APK, funciona en el PWA instalado (HTTPS). Es un candado local (no verificado en servidor), suficiente para uso personal; se subirá a passkey completo si la app sale al mercado.
### Changed
- El botón de nube abre ahora el panel de cuenta (antes usaba prompts nativos).

## [3.4.1] — 2026-06-18
### Fixed
- **Sync borraba gastos (crítico):** al sincronizar con la tabla `expenses` aún vacía, la mezcla eliminaba los gastos locales de origen "sheet". Ahora `mergeExpenses` es **aditivo** (nunca borra) y adoptar el estado de la nube **une** los gastos en vez de reemplazarlos. Los datos del Google Sheet se recuperan sincronizando con la sesión cerrada.

## [3.4.0] — 2026-06-18
### Added
- **Sincronización en la nube (Fase 1 Supabase) — frontend cableado:**
  - Carga de `@supabase/supabase-js` y cliente con la anon key (RLS protege los datos).
  - **Login por magic link** (botón de nube en la barra superior): al iniciar sesión se adopta el estado de la nube o se sube el local la primera vez.
  - **Multi-dispositivo:** el estado completo se sincroniza vía `app_state` (push debounced al cambiar, pull al entrar).
  - El botón **Sincronizar** lee los gastos de la tabla `expenses` de Supabase cuando hay sesión (con dedup); sin sesión sigue usando el Google Sheet.
  - **Precios USD** usan la Edge Function `prices` cuando hay sesión (key de Finnhub oculta server-side); sin sesión, fallback al Apps Script.
- **Offline-first:** si no hay red/sesión, la app funciona igual con `localStorage` (sin cambios de comportamiento).

## [3.3.1] — 2026-06-18
### Fixed
- **Despliegue desincronizado (crítico):** había dos `index.html` duplicados (raíz y `public/`) y solo se desplegaba `public/`, que estaba atrasado. El fix del doble descuento de TR (3.3.0) nunca había llegado al móvil. Eliminado el duplicado de la raíz; **`public/index.html` es ahora la única fuente** (coherente con ARQUITECTURA.md #2).
- **Mensajes del botón "Precios USD":** ya no dice "Sin cambios" cuando en realidad falla. Si Finnhub no devuelve cotizaciones muestra "✕ Finnhub no devolvió cotizaciones"; si el servidor da error, muestra el mensaje real. El conteo de precios actualizados se calcula desde el estado y ya no queda en 0.
### Added
- **Diagnóstico de precios en Apps Script:** `doGetPrices` ahora añade `errors` (status + cuerpo de Finnhub, sin exponer la key) y `keyLen` para localizar por qué `prices` viene vacío.

## [3.3.0] — 2026-06-18
### Fixed
- **Líquido de Trade Republic:** eliminado el doble descuento. El saldo base ya no se resta dos veces con el gasto del mes.
### Added
- **Inyección mensual automática:** +1.500 €/mes al efectivo de TR el último día laborable del mes (1.000 caprichos + 500 colchón). Los 50 € del FTSE van aparte (manual).
- **Campo "saldo real":** en Patrimonio → Cuentas, editas el saldo real de TR y la app ajusta la base por dentro (cero cálculos).
- **Arrastre entre meses:** al cambiar de mes se consolida el saldo (suma nómina, resta gasto) sin saltos.
- Migración de datos a `_dataVer` 6 (ancla de mes `trAnchor`).

## [3.2.0] — 2026-06-18
### Added
- Estructura de repositorio con buenas prácticas (este scaffolding).
- Versionado real con Git + GitHub.
- CI/CD con GitHub Actions hacia GitHub Pages.
- Sellado automático de la versión del Service Worker en cada deploy.
- API key de Finnhub movida a Script Properties (fuera del repo).

## [3.1.0] — 2026-06-17 (histórico, en Netlify)
### Added
- Cotizaciones USD automáticas vía Finnhub (Apps Script, server-side).
- Sincronización de gastos con deduplicación.
- Swipe entre las 6 pestañas con detección de eje.
- Dashboard: patrimonio neto, sparkline, anillo de presupuesto, racha.
