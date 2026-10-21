H2 candidata, ronda 2: saldo y movimientos independientes por cuenta, valor/fecha de identidades devueltas fallidas retenidos por UID/IBAN; cuentas extra omitidas retiradas y asignación única libre tras reservar vínculos exactos. Capacidad explícita y fallback conservador para móviles antiguos. Cursor y ACK siguen movimientos y persistencia local, con la excepción de desbordamiento existente. [Contrato y límites](briefs/h2-saldos-movimientos-20261018.md).

# Arquitectura — Aely

FIN04 fase 2, candidata A: `pushAppState` exige un pull válido del mismo titular;
sin revisión solo se crea con INSERT. Error o datos inválidos no acreditan ausencia.
ACK exacto y sesión se comprueban antes de avanzar la base. La fusión por grupos de
recibos/deudas queda pendiente. [Contrato y límites](briefs/fin04-primera-lectura.md).

FIN04 fase 1 candidata R2: renombrado parcial con ACK y cola durable; nota local pendiente
hasta confirmación exacta. Carga/mezcla de UUID prefiere la copia viva, conserva metadatos
editados y mantiene separados importes o referencias conflictivos.
R3 evita serializar la identidad en cada fila y aparta un renombrado tras tres fallos con
contador durable y aviso único; libera la cola y exige reintento explícito o una intención nueva.
Sin cambios de esquema, servidor ni LWW de recibos/deudas.
[Contrato y límites](briefs/fin04-fase1-renombrar-nota.md).

FIN-11 candidata privada desde FIN-10/FIN-15 coexistentes: `obAbsorbedPending`
protege por titular fuera de la poda de lápidas. Una partición local con readback
precede a la retirada; refresco cloud/online reintenta hasta cuatro objetivos y
solo retira la intención tras confirmación remota y ACK durable. BankSync no borra.
La limpieza corre en segundo plano después del pull completo: su espera o fallo no
retiene `nubeLista`; un pull fallido sigue impidiendo consultar el banco.
Los lectores filtran pendientes antes de consumir la referencia FIN-15 entre días;
comodín de cuenta simétrico FIN-10 intacto. Un alias sin cuenta no autoriza DELETE.
[Contrato, evidencia y límites](briefs/fin11-absorciones-pendientes-20261017.md).
## INC-0410 · port privado para beta 141

La sincronización de Metas conserva por titular una base de metas/reglas/asientos. Fusiona metas a tres vías por campos, con saved/target/done/doneAt indivisibles y nube más registro local ante conflicto, sin sumar saldos absolutos. Las reservas locales se conservan si sus metas afectadas no tienen conflicto de campo; la divergencia distinta de ambos lados o ese acople rechaza la foto financiera completa y guarda el local saneado. Conflictos cap3 en clave privada por modo/titular, fuera de pushes/backups; ACK sin re-sello/bucle y notificación durable única. El caso A120/Z50 llega a17000c tras replay mensual; en el inverso de subida se mantiene15000c y los17000c requieren reaplicación manual20. Port de lógica revisada, preservando beta v4. [Contrato y límites](briefs/inc-0410-lww-rechazo-20261017.md).

FIN-15 (beta 4.26.138): el lector servidor `filasComoLaApp` usa banco + referencia `#ref`
para reconocer el mismo apunte en días distintos, como las mezclas del cliente. Aplica
primero las lápidas y conserva el dedup por contenido para filas antiguas sin referencia.
No modifica el importador ni deduce equivalencias entre referencias distintas por importe/comercio.
Month y widget v2 usan el mismo lector; Claude despliega `ingest` antes del cliente.
UX15 (beta 4.26.138): Gastos → «Actualizar gastos» conserva `onSync` →
`syncCloudExpenses` → `cloud.pullExpenses`, con lectura opcional de parejas
y reconciliación/backfill existentes. Recupera gastos de todos los orígenes
ya guardados en nube, incluidas notificaciones; no solicita `bank-sync`.
El alcance se explica junto al botón en es/en/ca. [Contrato y límites](briefs/ux15-sincronizar-gastos-20261016.md).

## Candidata: compras iguales con referencias distintas

El importador y las mezclas conservan referencias distintas mediante las ranuras ordinales
existentes. La referencia viaja en `source` como `#ref`, y el borrado conserva su identidad
en el vínculo «sin aviso» ya existente, junto a la lápida de ranura. Sin esquema nuevo.
[Contrato y límites](briefs/compras-identicas-ids-distintos-20261014.md).

Sucesor Compras4 (15/10, PR235): el commit del estado conserva una lápida específica al absorber
el BOOK que ya había entrado durante una lectura truncada. `obPendingAbsorbedState` exige la
adopción del pendiente anterior y la desaparición de la fila BOOK de la misma referencia,
banco, día e importe/nombre. `obAbsorptionKey` identifica banco, referencia y ranura, sin UUID;
así otro móvil con UUID distinto la respeta y otra referencia que reutiliza la ranura queda viva.
La clave viaja en `deleted` por el transporte de estado existente. `expenseIsTombstoned` y
`filasComoLaApp` la leen en cliente, month y widget. No cambia la decisión de cuándo adoptar.
El lector de ingest debe desplegarse antes del cliente; fuentes y pruebas aún no son despliegue.

## MyInvestor: intención manual y contador por versión · candidato (14/10/2026)

`cloud.myinvestorSync(userInitiated)` transmite únicamente el booleano explícito. La hoja
distingue su apertura automática del botón; App transmite `opts.manual===true` sin modificar
el orden, los efectos o el reanclaje financiero. Una reconexión genera versiones nuevas de
conexión y contador; una lectura buena sólo cambia la del contador. La escritura condicionada
y su fila devuelta impiden que una petición antigua reinicie o caduque la sesión nueva.
La cuenta vive en los buckets versionados de `rate_limits`; los anteriores no participan en
el contador actual. Migración y Edge aún sin desplegar: ver el orden en SETUP-SUPABASE.

## Emparejado candidato PR228

La asignación de avisos y bancos vive en reconcileGemelosAutomaticos y se invoca desde importObExpenses, el updater, el arranque y el pull. Las marcas se devuelven antes de subir los apuntes. Los pares automáticos se derivan de filas; gemelos conserva decisiones y reservas históricas. La caché no se persiste: índices por referencia y grupos banco/importe, con fechas de Madrid cacheadas. Un cambio no financiero conserva las parejas. Una retirada de #dup recibida de otra versión se respeta como decisión humana. [Contrato actual, migración y límites](briefs/tr-emparejado-automatico-20261013.md).

## InicioAhora y archivo109 · versión4.26.112 del canal beta

Se retiran Ring, MiniPie y TabCoach sin consumidores, su CSS asociado y doce iconos sin uso. V4Ring y Tour siguen activos (SparklineInv y .spark se retiraron el 14/10/2026 con la ficha antigua de Inversiones); el flujo financiero, idiomas, notas e histórico se conservan. El presupuesto del paquete integrado y131 comprobaciones DOM propias pasan; el guardián conserva identidades111/106 y archivo109.

Dashboard pasa `tt.netWorth` y el `shownNet` existente a `NetWorthNow`. La animación, idioma/divisa, total financiero e histórico persistido conservan su comportamiento; una entrada no numérica/finita se presenta como «—» y se explica. Sparkline se retira y los snapshots no se tratan como observaciones fechadas. El cuerpo de seedFlows es exactamente el de111, preservando Nómina. Recientes106 se reancla a la misma expresión sin cambiar su identidad ni recibo.

`beta-archives.json` fija exclusivamente109 con descriptor/guion originales, f4ff/B90/d05. El motor coteja pin, fuente Git y digest antes de leer HEAD; no recalcula109 contra NetWorthNow. El catálogo conserva el guion y añade `referenciaHistorica.estado="ausente"`; el recibo omite109 de web/pruebas y separa referenciasHistoricas. Panel y listo bloquean nuevas decisiones/promoción, conservan rechazo y detalle por su huella exacta, sin alias ni aprobación heredada. Los dos consumidores del motor cambian identidad por sus nuevos lectores; ops-0410 retirado no vuelve al catálogo.

Al enviar el último veredicto activo, `gestoReal.current=false` impide que el scroll posterior renueve la marca de reapertura. Restaurar scroll no cuenta como gesto; pointerdown sí la renueva. La integración sobre c9181f14 conserva Bienes111, Nómina111 e identidad106. Presupuesto oficial del paquete integrado PASS:1.321.606 bytes minificados/360.945 gzip/3 cargas frente a topes1.326.080/361.472/3 intactos. El A/B conserva el fallo previo y mide1.328.880/362.544→1.321.606/360.945: ahorro7.274/1.599 bytes y527 de margen gzip. Validación del candidato integrado: guardián completo57 casos/1.792 mutaciones de funciones/713 de datos PASS;131 DOM de Inicio/panel/reapertura/Tour/vacíos PASS. La continuación funcional aporta728 PASS y1 captura opcional omitida, además de92 casos previos y12 del FAB;963 PASS y1 omisión en total, con12 casos del indicador abiertos por salida inesperada del documento en Chromium local. Rendimiento13 PASS serial, sin reintentos.130 de131 etapas Node pasan; el espejo local de memoria aborta por privacidad y Deno no está instalado. No se atribuye suite local completa verde. CI de la fuente exacta y cotejo de artefactos se acreditan antes de la entrega; aceptación móvil, producción y APK nuevo requieren sus gates propios.

## Historial de overlays · candidata110 sobre109

El controlador de02 mantiene propietarios vivos, slots de History y un consumo pendiente
identificado. Altas/bajas se reconcilian al final del lote de efectos; sólo una entrada propia
retirada en ese lote puede transferirse por replaceState. Los padres cubiertos se retiran sin
consumir al hijo y se compactan al alcanzarlos. Se preserva el estado de la ruta anterior y no
se hace back si la entrada actual es ajena. El botón Capacitor delega en el controlador porque
no produjo una navegación web. El hook conserva la closure de apertura; sólo Wizard/Ask
solicitan rearme por identidad de paso/diálogo, leyendo sus refs existentes. Sin cambios de
sincronización, guardado ni importes. Node/build y18 DOM comprobados en ventana101; los ocho
flujos principales reproducen rojo en la base histórica. El artefacto
aislado pasa los caps1291/352 asignados por root. La unión oficial sobre109 se midió
con gzipSync({level:9}): delta final3.413 B crudos/1.134 B gzip; topes1295/353/3 autorizados.
VERSION/package son110, con nota y unidad propias es/en/ca;30 guardianes/18 DOM del port pasan,
sin publicación110 ni aceptación móvil. Las tres unidades109 y las cinco retiradas siguen
intactas. [Acta](briefs/inc-0810-backclose-handover.md).

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

## Apuntes iguales sin id y aviso reclamado una vez (rama `claude/tr-iguales-ordinal`, 12/10/2026)

Un apunte de banco SIN id (Trade Republic por Open Banking: sin `entry_reference` ni comercio) tenía por identidad banco+día+importe con signo+nombre del banco, así que k apuntes iguales del mismo día se fundían en uno (5 bizums de 12 € → 1 fila, −48 €). Ahora el segundo igual y siguientes llevan `obOrd` (2, 3…); el primero no lleva nada y conserva EXACTAMENTE su clave, lápidas y filas de versiones anteriores incluidas. El ordinal se deriva de cuántos iguales trae el banco (ranuras 1..k, asignadas por contenido, no por posición): si tengo j y el banco trae k entran k−j; si trae menos no se borra nada. La regla vive en `obOrdinalOf`/`obOrdinalSufijo` (00-core) y la leen `keyOfExpense` (mezcla con la nube, lápidas, FIN-03), `importObExpenses` (clave del importador: `kOf`/`scopedKOf`), `expenseSourceForCloud`/`expenseFromRow` (viaje) y `claveComoLaApp`/`ordinalDeSource` en `_shared/presupuesto.ts` (widget). Los apuntes CON id no cambian; `reconcileObDupes` (solo cashback) no lo necesita. El histórico (`histCandExisting`, clave por contenido 1:1) tampoco, pero sí mira las lápidas y los vínculos: un candidato cuya clave de ranura 1 tiene lápida en `deleted` o figura como `banco` en `gemelos` es «ya lo tienes apuntado» (`histCandLapidas`), no nuevo. Sin eso, lo contestado «es el mismo» volvía premarcado y entraba con lápida: invisible en la lista, pero restando del saldo de la cuenta diaria (`expenseCountsCash` no excluye lápidas a propósito: la base anclada puede incluirlas) y resubido en cada pull (el backfill de `syncCloudExpenses` ahora salta las filas con lápida).

Viaje: en `source` como último tramo `#n2` (`ob:trade_republic#dup#n2`), que un móvil o servidor anterior ignora (`split("#")[0]` sigue dando el banco y `[1]` la marca `dup`), y en `fecha` como mediodía + (ordinal−1) ms, porque el índice único de `expenses` es usuario+fecha+importe+comercio y sin ello la segunda fila igual chocaría y nunca subiría. Determinista: dos móviles que suban el mismo ordinal escriben la misma fila. Un móvil anterior funde las k filas al bajar (ve una, como hoy) y su importador no añade ninguna.

**Formato completo de `source` para un apunte de banco** (lo que leen `expenseFromRow`, `expenseBankOf`, `partirEntDeuda` y `bancoDeSource`/`ordinalDeSource` del servidor): `ob:<ent>[~deuda.<id> | ~recibo.<id>][#dup][#n<k>]`, y lo mismo con `ob-hist:`. Los tramos `~` van pegados al banco (una app anterior lee un banco raro y deja la fila fuera: el lado seguro); los tramos `#` van detrás y una app anterior los ignora. `~recibo.<id>` lo escribe la entrega del recibo que entra en Gastos; esta rama ya lo lee aunque no lo escriba. Cualquier lector o escritor nuevo de `source` (FIN-04 incluido) tiene que aceptar exactamente esa expresión: `/^ob(-hist)?:[^~#]+(~(deuda|recibo)\.[A-Za-z0-9_-]+)*(#dup)?(#n\d{1,6})?$/`.

**Versiones mezcladas en la misma cuenta** (beta en un móvil, producción en otro): el móvil anterior baja las k filas y las funde en una (ve la de siempre); si edita o resuelve esa fila la vuelve a subir SIN `#n` y sin el milisegundo, así que su escritura choca con la ranura 1 (misma fecha, importe y comercio) y no toca las demás. No hay pérdida muda: las filas 2..k siguen en la tabla y el móvil nuevo las sigue viendo; lo único que converge contestando es la marca `#dup` de la ranura 1, que el viejo puede quitar o poner. Un servidor sin `ordinalDeSource` funde las k en el widget hasta que se despliegue `ingest` (orden de despliegue en `SETUP-SUPABASE.md`).

**Dos entradas del banco para un solo cargo** (revisión de la entrega 1): un banco puede entregar el mismo cargo como «pendiente» y como contabilizado en la misma respuesta, idénticos en todo lo demás. La señal es el `status`: en un grupo de iguales cada pendiente se da por cubierta por una contabilizada y solo las pendientes que sobran son cargos aparte (`importObExpenses`, `firme`). Sin señal —todas con el mismo estado, como una repetición al paginar— no hay nada que distinga «repetida» de «dos bizums iguales» y mandan los k del banco: es la función de esta entrega. El histórico sigue fundiendo los k iguales de una cuenta en un candidato (`skippedUniq`) y por eso nunca mete más de uno por grupo.

Un aviso (noti/Wallet) empareja UNA sola vez: `state.gemelos` ({avisoId, aviso, banco}, tope 500, viaja en `app_state` como `deleted`; entre móviles se UNE gane quien gane el estado —`fusionarGemelos` en `syncFromCloud`—, porque un vínculo es un hecho que vio un móvil y el otro no puede desmentir por no tenerlo; en esta rama `deleted` se une por hora mediante `lapidasUnion`, por la dependencia Recibos) se da de alta al marcar «posible repetido» (`gemelosDeImportacion` tras `importObExpenses` y tras el histórico), se conserva al resolver «es el mismo» y se suelta con «son distintos»; `gemeloOtraVia` e `histCandCercanos` saltan los avisos reclamados (`avisosEmparejados`). Borrar a mano un apunte OB o resolver sin gemelo localizable deja `{aviso:"", banco}`; una lápida de ranura 1 sin vínculo es, por tanto, un «es el mismo» de una versión anterior y el importador da por reclamado el primer aviso que casa. El emparejado automático por cuenta de filas decide sobre este mismo vínculo: añade `auto`, `ent`, `at` y `separado`. Agrupa por banco, fecha civil de Madrid e importe en céntimos con signo; cada fila sin id bancario consume como máximo un aviso no manual. Mantiene las dos filas internas, pero el banco lleva `possibleDup` (viaja como `#dup`) y `autoGemelo` local para ocultarlo en Gastos. El arranque y el updater central reconstruyen la marca desde los vínculos; separar levanta ambas marcas, conserva el vínculo y su hora, y gana a una copia antigua. Las uniones solo usan decisiones del mismo titular. `gemelosCambiosNube` compara las filas recibidas con la decisión local para reparar la marca mediante la API existente: es un intento sin acuse de fila, no una confirmación remota. El detalle y el límite de avisos idénticos se conservan en el acta de la candidata. Servidor: `presupuesto.ts` cambiado en la rama, SIN desplegar; un servidor sin él sigue fundiendo las k filas iguales en el widget. Límite que queda: dos AVISOS idénticos (mismo día, importe y comercio) siguen fundiéndose en la nube y al bajar (clave sin id).

## Lápidas y contabilidad local (4.26.54)

`expenseCountsBudget` excluye filas cubiertas por `deleted` mediante `expenseIsTombstoned`; presupuesto y categorías heredan el criterio del servidor antes de `statsDelMes`. Gastos y últimos movimientos de Inicio las ocultan sin podar arrays ni borrar por ausencia. Copias de seguridad conservan el histórico crudo. No cambia identidad ni decisiones de duplicados. UUID manual y claves antiguas siguen vigentes. WeakMap indexa cada array `deleted`; los escritores lo reemplazan por copia y los memos de presupuesto dependen de él.

`expenseCountsCash` y `insumosSaldoGasto` conservan su comportamiento: no se trasladan las lápidas de presupuesto a los anclajes de saldo. Una base histórica puede haberse despejado incluyendo esa contribución; retirarla sin reanclaje verificable movería efectivo. Este arreglo del Gastado no migra bases ni pretende resolver la contabilidad de una lápida en una cuenta calculada. Tras instalar APK51, el widget recupera sus cifras y Gastado/Disponible se mantienen al reabrir. El saldo mostrado difiere de la captura anterior a abrir la app: su coherencia entre ambas fotos no queda validada. FIN-05 sigue pendiente de repetir pago real.

## Clasificación bancaria opcional (beta 4.26.53.1)

`mapTransaction` mantiene nombre/nota/identidad y transmite `concept` solo desde remittance_information más `mcc` opcional de cuatro dígitos. La descripción del código bancario sigue en note pero nunca se usa para clasificar como comercio. `flattenBankTx` y `histFlattenHistoryLinks` transmiten esos campos a `categoryOfBankTx`, usado solo al crear nuevos gastos. La categoría aprendida/reconocida por nombre gana; después concept solo con tarjeta y nombre genérico Movimiento/Movement/Transaction/vacío, excluyendo transferencia/Bizum/recibo/alquiler/nómina/devolución/refund; después MCC acotado (5411 super, 5462 pan, 5812/5813/5814 bares). Un Otros aprendido gana también; categorías neutras/modelados/ingresos conservan sus rutas. No cambia identidad, nombre persistido, dedup, lápidas, ACK ni histórico existente. Note conserva el concepto visible. Sin datos útiles, Otros. Cliente antiguo ignora ambos campos y cliente nuevo mantiene comportamiento anterior sin ellos; bank-sync compartido desplegado con autorización el 26/9/2026 (Action 36271682736, SHA 7839acb7), sin migraciones. Cliente publicado en beta 4.26.53.1, Action 36271729679/SHA f2f3839e. Sin sincronización real TR verificada; véase el brief TR para evidencia y límites.

Contratos oficiales: [Enable Banking Transaction](https://enablebanking.com/docs/api/reference/#transaction) y [Visa Merchant Data Standards, abril 2026](https://usa.visa.com/dam/VCOM/download/merchants/visa-merchant-data-standards-manual.pdf). No se ha verificado que TR entregue estos campos en una conexión real.

## Descarga de gastos cloud (FIN-07, 4.26.52)

`pullExpenses` recorre la tabla accesible por RLS con `id DESC` y `id < cursor`, en páginas de hasta 1000. Una página corta puede reflejar un límite de PostgREST; solo una página vacía termina. UUID es clave primaria estable; `fecha` puede editarse y no sirve de cursor. Se valida progreso estricto y se acumula en memoria, sin mezclar ni guardar por página. El resultado vuelve en fecha DESC/id DESC para conservar la prioridad previa de la mezcla y los ACK de FIN-05. Un error/payload inválido rechaza todo; `syncCloudExpenses` no actualiza estado ni coveredEvents con páginas parciales.

La lectura entera se repite en cada vuelta a primer plano, así que lo que no cambia no se rehace (19/10/2026). `expensesFromRows` reutiliza el gasto de la lectura anterior cuando las 13 columnas que lee `expenseFromRow` (`EXPENSE_ROW_COLS`) son idénticas, la categoría resuelta en vivo coincide (lo aprendido a mano puede cambiarla sin tocar la fila) y nadie ha tocado el objeto desde entonces; si no, reconstruye. `autoCategory` recuerda el barrido de palabras clave por texto normalizado (`_AC_KW`, tope 5.000), pero `USER_OVERRIDES` se consulta antes, en vivo. Si la mezcla deja todo igual salvo `lastSync`, el updater devuelve el estado anterior: no hay render ni escritura. La hora de la lectura viaja aparte por `mcSetLecturaNube`: la escuchan el efecto del widget (un contador en App, para que reciba igual la prueba de lectura de FIN-05) y la línea «Última sincronización» de Gastos (`SyncHora`, que muestra la más reciente de `lastSync` y la lectura).

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

**Candidato de descarga incompleta (13/10, sin desplegar).** `readReason` separa fallo del
proveedor, respuesta inválida o continuación repetida de los topes propios de páginas, filas y
tiempo. Los avisos es/en/ca distinguen ambos grupos y el tramo antiguo pendiente (`gapPending`),
que por sí solo no significa que se haya cortado la lectura actual. El fallback
`bank_read_partial` sigue atendiendo respuestas de servidores anteriores sin motivo.
El diagnóstico diario e histórico añade `reasons` y `failureCodes` de vocabulario cerrado,
también ante un error con cero páginas; no registra cuentas ni texto del proveedor.

`flattenBankTx(links, prev.bankTx)` conserva el extracto anterior de un banco incompleto y de
bancos omitidos en esa respuesta. Solo añade al banco incompleto filas nuevas BOOK con id único,
importe finito y fecha válida no futura; no reemplaza ids conocidos ni toma decisiones con
filas sin identidad de una cuenta cortada. Si solo falla el SIGUIENTE trozo antiguo y todas
las cuentas entregadas están completas, las filas sin id del prefijo ya sellado sí se guardan:
conservan la multiplicidad máxima por grupo y estado, sin sumar lectura y caché.119 puede
acusar ese prefijo; descartarlo por el fallo posterior quemaría filas. Los bancos completos
conservan su comportamiento anterior. El mismo
extracto conservado alimenta las pruebas de pago y el guardado final de App. El importador
mantiene sus lápidas, ordinales y vínculos de gemelos. Un fallo del proveedor/tiempo o una clave
repetida no ofrece cursor ni acuse del tramo sin recibir; los trozos antiguos ya sellados sí
pueden entregar su cursor. Se conserva la excepción previa de desbordamiento de la ventana por
páginas/filas descrita abajo; no se cambia el protocolo119.

Revisión de reservas13/10, sólo fuente: el desborde de ventana con acuse119 admite el prefijo
sin id por multiplicidad máxima, incluso con page_limit/row_limit en cuentas. Otros cortes siguen
exigiendo identidad segura; el sellado no admite fechas futuras. previous omitido se trata como [].
Un expired explícito retira sólo el snapshot crudo, conservando el libro de Gastos. Timeout y límite
de ventana tienen avisos distintos; el pendiente antiguo con cuentas completas conserva el
actualizado del saldo. [Revisión y gates](briefs/bancos-descarga-incompleta-20261013.md).

Detalle, evidencia sintética y límites: [brief del candidato](briefs/bancos-descarga-incompleta-20261013.md).

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

**Tramo antiguo del sync a demanda (INC-2709-06).** El sync pide el día 1 del mes menos 8 días y
el cliente tiraba lo anterior: quien pasaba semanas sin sincronizar perdía ese tramo. Ahora, si
el cliente manda `recoverGaps:true` y el último éxito (`bank_links.last_sync`) cae antes de esa
ventana, `bank-sync` lee además lo que falta, con estas reglas (`bank-sync/demand-window.ts`):

- La lectura de siempre (saldos y ventana) va primero, para todos los bancos, y nada del tramo
  puede cambiarla: el tramo va después, en su propio `try`, y su fallo solo deja el cursor quieto.
- El tramo se pide por trozos de fechas cerrados (`date_from` y `date_to`), de antiguo a nuevo. Un
  trozo solo cuenta si todas las cuentas del enlace lo paginaron entero; el primero es un solo día.
- `last_sync` hace de cursor, sin columna nueva: un trozo sellado deja el último milisegundo de
  su último día, y el final del tramo deja «ahora». No sale de la fecha de las filas, así que el
  orden en que pagine el banco da igual, y solo sube (`lt`).
- Doce llamadas a `/transactions` por cuenta y pulsación, compartidas entre ventana y tramo. Un
  hueco largo se rellena en varias pulsaciones; la respuesta lo dice con `gapPending`.
- Si la ventana no cabe en esas doce llamadas (o en las 2000 filas del lector) no hay tramo posible y `last_sync` sube a «ahora»,
  como antes de existir el tramo. Con un error a media lectura o una cuenta caída no se mueve.
- El banco no entrega más de 90 días: un hueco mayor se pide desde ese tope y se señala con
  `gapBeyondCap`.
- **Reconectar conserva el cursor (11/10).** Reconectar el mismo banco es la misma fila de
  `bank_links` con otra autorización (`bank-connect` hace upsert). Si vuelven exactamente las
  mismas cuentas (`bank-callback/reconnect.ts`: por IBAN y divisa, o por `identification_hash`;
  el `uid` no vale, cambia en cada sesión) `bank-callback` no toca `last_sync` y la lectura
  siguiente recupera el hueco como cualquier otro. Si cambian las cuentas, no hay identidad
  estable o es la primera vez, `last_sync` queda a null y el enlace arranca con la ventana de
  siempre: el cursor es del enlace y una cuenta nueva no puede heredarlo. Un hash o una divisa
  que falta en UN lado no desmiente (los enlaces anteriores a guardar el hash solo tienen IBAN);
  solo un dato conocido en los dos y distinto. Y «sin cuentas» solo borra cuentas y cursor si el
  banco lo confirma: si el GET de la sesión falla, `bank-callback` sale con `msg=error` sin
  tocar la fila.
- Un cliente que no manda `recoverGaps` recibe solo la ventana; con hueco, su `last_sync` no sube
  para no quemar el tramo que un cliente nuevo sí puede guardar.
- **Acuse (12/10).** El cursor se escribía al leer del banco, antes de que el móvil tuviera las
  filas: una respuesta perdida dejaba ese trozo sin pedir nunca más. El cliente que acusa manda
  `acks` (un objeto por nombre de banco, vacío la primera vez) y con él `bank-sync` no escribe
  `last_sync` por lo que acaba de leer: lo entrega en `ack` (`cursor|clave del enlace`) y el
  cliente lo devuelve en la pulsación siguiente, que es cuando se escribe (`ackCursor`: de ese
  enlace y esa autorización, con la forma exacta que emite el servidor, no futuro, nunca hacia
  atrás; la escritura va filtrada por `id` y solo se da por hecha si no devolvió error).
  `last_sync` va así una pulsación por detrás. Sin `acks` (clientes anteriores) el cursor se sigue
  escribiendo en la misma llamada. El cliente nuevo contra una función sin acuse no recibe `ack`
  y no guarda nada.
  - **Un enlace sin cursor recibe su punto de partida en el servidor.** Con `last_sync` nulo y
    cliente de acuse, la primera lectura que responde escribe la víspera de la ventana, sellada
    (`chunkCursor`), con filtro `is null`. No dice que nadie tenga filas, solo desde qué día se
    sigue: si el punto de partida viviera solo en el acuse del móvil que pulsó, otro dispositivo
    encontraría el enlace en null y leería «la ventana de hoy». «Ahora» sigue viajando en `ack`.
  - **El acuse es local al dispositivo.** Vive en su clave de `localStorage`
    (`micartera_v3_oback`, `obAckLoad`/`obAckSave`/`obAckDrop` en 00-core), fuera del estado:
    el estado sube a la nube y otro móvil lo adopta entero, y un móvil no puede acusar filas
    que recibió otro. Se escribe detrás de sus filas: `runBankSync` deja el acuse pendiente,
    el efecto de `lastBankSync` vuelca el estado y `obAckSave` comprueba en disco que entró.
    La marca vive en la clave ligera y las filas en la de gastos: si alguna escritura de gastos
    falló en esta sesión (sin cuota), `obAckSave` compara además el histórico en disco con el
    del estado y sin él no acusa; si nunca falló no lo toca.
  - **El banco de pruebas no acusa.** Allí `obAckLoad` devuelve vacío y `obAckSave` no escribe:
    `acks` viaja vacío, el servidor espera y el cursor real no se mueve (lo vigila `security`).
  - **Reconectar invalida los acuses anteriores.** La clave del enlace (`ackLinkKey`) es su id
    y su `state_issued_at`, que `bank-connect` renueva en cada autorización. Tras reconectar,
    el cursor lo decide solo `bank-callback` (conservado o null) y un acuse emitido antes no
    lo mueve: lo que ese móvil tuviera de más se lee otra vez y se deduplica por `ext_id`.
  - Quitar un banco borra su acuse (`obAckDrop`).
- **Banco que filtra por fecha valor.** La app pinta la fecha contable, que puede ir uno o dos
  días antes de la que el banco usa para `date_from`. `syncFrom` va 3 días por debajo del primer
  día pedido (`demandFloor`) para que el cliente no tire esas filas; al banco no se le pide más.

Cada enlace de la respuesta lleva `syncFrom` (día más antiguo que puede traer; el cliente solo
acepta lo anterior a su margen desde ahí, por banco, con el día del suelo incluido) y `balanceAt` (hora de lectura del saldo, que
es lo que pinta «Saldo actualizado»: `last_sync` puede ir por detrás). En `importObExpenses` lo
anterior al margen se apunta con su fecha real pero no compra participaciones, y casa contra todo
lo modelado, toque o no este mes.

**El cargo de un recibo entra en Gastos, sin contar (12/10/2026).** El cargo del banco que
casa con un recibo o un puntual del Plan ya no se descarta: entra con `reciboId`, en el sync
diario (`importObExpenses`) y en «Importar histórico». **Invariante:** lleva la marca exactamente
lo que antes se tiraba (mismo predicado: banco, `recAmtClose` y `recNameMatch`), y esa fila no
mueve ninguna cifra, así que el gastado, el presupuesto, el saldo pintado, el previsto y el
cierre de mes son los de antes. `tests/recibo-invariante` lo comprueba contra el código de la
4.26.119; afinar el predicado es mover cifras. La marca se pone al importar y se guarda; no hay
pasada que la recalcule. **Esa es la única cifra que cambia, y a propósito:** la 4.26.119
volvía a juzgar el cargo en cada sync, de modo que el seguro anual o el puntual cobrado a fin de
mes se tiraba en su mes y entraba como una compra al sincronizar el mes siguiente, y lo mismo el
cargo de un recibo al que después se le subía el importe. Ahora sigue marcado: el gastado es
menor que antes en exactamente esas compras (26 de 1.500 extractos medidos, nunca mayor) y el
saldo no cambia. `cargoDeRecibo(e, s)` es la puerta única: devuelve el recibo vivo o
null (si la fila es además cuota gana la deuda; un recibo borrado o un veto anulan la marca), y
la usan `expenseCountsCash`, el cajón, el anclaje de `applyBankBalances`, el cierre de
`reconcileTR` (también su `obFed`: un cargo de recibo no cuenta como «el banco ya trae sus
movimientos», o el cierre dejaría de restar el redondeo), el redondeo de Cartera
(`recompensasDelMes`), la retirada de efectivo (no se puede reconocer como tal), la foto del
hogar e Inicio. Lo
dudoso se distingue solo en la etiqueta (`cargoDeReciboFirme`): «Recibo: X» si es el cargo con
el que `fixedPaymentState` da por pagado el recibo y lleva su nombre por palabras completas;
«¿Recibo: X?» si solo se parece. La marca viaja en `source` como `ob:<ent>~recibo.<id>` u
`ob-hist:<ent>~recibo.<id>`: una app anterior o el servidor del widget leen un banco
inexistente y la excluyen sin conocerla, igual que con `~deuda.`. El orden de los sufijos es
`ob:<ent>[~deuda.<id> | ~recibo.<id>][#dup][#n<k>]`. Toda escritura de la marca sobre una fila
que ya está en la nube pasa por `cloud.setExpenseRecibo`, que la pone si la fila local la lleva
y la quita si no: busca por fecha, importe y comercio (el id local puede no ser el de la nube, y
un UPDATE por id que no casa no toca nada ni da error), lee antes de escribir y solo toca filas
`ob:<ent>` u `ob-hist:<ent>`, conservando prefijo, `#dup` y `#n<k>`; una cuota, un aviso del
móvil o un gasto a mano que coincidan no se tocan, y a un posible repetido no se le pone marca.
La usan el alta cuando la fila ya existía, «No es este recibo», su vuelta atrás y el borrado de
un recibo. Al bajar gastos de la nube, el aviso del móvil gana al cargo de recibo de su mismo
día, importe y comercio llegue en el orden que llegue (`mergeExpensesFromCloud`), que es lo que
pasa cuando el aviso estaba antes. «No es este recibo»
(`quitarCargoDeRecibo`) quita la marca, guarda el veto en `state.reciboNo` (recibo + identidad
del cargo, y recibo + id de fila + identidad, para que otro móvil con otro id local pueda
levantarlo) con su hora en `state.reciboNoAt`, y retira la prueba de pago. Al bajar
el estado de la nube, `reciboNoUnion` resuelve clave a clave: gana lo último que se dijo, sea
vetar o levantar; sin hora, o con la misma, se suman; quien cambia una clave apunta siempre una
hora posterior a la que ya constaba, aunque su reloj vaya atrasado. «Confirmar pago de X» con un cargo
cualquiera NO lo marca: el gastado se queda como estaba, igual que en la 4.26.119 y como dice
su diálogo. La excepción es confirmar con el mismo cargo del que se dijo «no es este recibo»
(`reponerCargoDeRecibo`): eso lo deshace, levanta el veto y devuelve la marca, y el diálogo lo
avisa con el texto de la marca, solo si la marca puede volver (`admiteMarcaDe`: fila del banco
y del banco del recibo). Vale también para un puntual, que la ficha ofrece únicamente cuando se
vetó para ese cargo. Borrar un recibo o un puntual pasa por `quitarDelPlan` → `sinCargoDelPlan`:
solo sus filas del periodo en curso (el del gastado: mes natural o «Mi ciclo», `budgetPeriodOf`)
pierden la marca, en el móvil y en la nube, porque el servidor del widget deja fuera todo
`~recibo.` sin saber si el recibo existe. Las de periodos ya cerrados la conservan y sus cifras
no se mueven: `state.reciboBorrado[id]` (`{d: desde cuándo, n: nombre}`) viaja en el estado y
`cargoDeRecibo` sigue dando por cargo de aquel recibo lo anterior a `d`, con su nombre, y por
gasto normal lo posterior, también en el móvil que aún tiene esas filas marcadas. Las tres
re-anclan la base (`conSaldoMostrado`) para que el saldo pintado no se mueva fuera de un sync.

**Con los apuntes iguales del mismo día (ordinal).** El veto de «No es este recibo» lleva el
ordinal de la fila (`reciboNoIdentidad`): suelta solo el cargo tocado, en la app y en la nube
(la fila con ordinal viaja con su fecha un milisegundo después, así que la escritura por
fecha, importe y comercio da con ella). Cuando el aviso del móvil gana al cargo marcado, la
fila que queda es la misma de antes —su id y el orden a mano, la categoría, la nota y el «no
tarjeta» que se le pusieron— con el origen del aviso, y App reescribe sin marca la fila del
banco en la nube (`sinMarca`): con una marcada y otra no, el servidor contaba una u otra según
el orden de lectura. **Límite conocido:** dos cargos iguales el mismo día que casan con
un recibo entran LOS DOS marcados y ninguno cuenta, igual que antes se tiraban los dos; si uno
era una compra aparte, hay que decirlo con «No es este recibo». Ese «No es este recibo» tiene
vuelta atrás desde la ficha también en un recibo FIJO (13/10/2026): la ficha ofrece el recibo
vetado para ese cargo aunque el vínculo a mano no sea posible (`fixedExpenseEligible` exige un
cargo único en su mes) y `reponerCargoDeRecibo` levanta el veto y devuelve la marca si la fila
la admite; el recibo sigue pendiente, como antes del veto, porque el motor no elige entre dos
iguales.

**Entre móviles (13/10/2026).** El estado viaja entero por «último que escribe» (`_savedAt`), y
un móvil con días sin abrirse queda sellado como «más nuevo» por su primer guardado al
arrancar. Lo que no puede perderse así se une en `syncFromCloud`, gane el estado que gane:
los vínculos aviso↔apunte (`fusionarGemelos`), los vetos (`reciboNoUnion`), las lápidas
(`lapidasUnion`) y los recibos borrados (`recibosBorradosUnion`); las dos últimas solo con lo
local del mismo titular. Vetos, lápidas y recibos borrados comparten regla (`unionPorHora`):
clave a clave gana lo último que se dijo, y lo que no lleva hora en ningún lado se suma.

*Lápidas.* Ponerla y levantarla («Deshacer» un borrado, o editar un gasto hasta una clave que
constaba retirada) apuntan su hora en `state.deletedAt`, siempre posterior a la que constara; se
guardan las 200 decisiones más recientes. Sin eso la lápida que A ya levantó volvería desde B
y «Deshacer» sería irreversible. Una lápida SIN hora la puso una versión anterior de la app:
frente a un «Deshacer» de aquí gana solo si el estado que la trae se guardó después (es un
borrado posterior); si se guardó antes, gana el «Deshacer». Tope de 500: las que llevan hora no
se caen y de las demás se cae primero lo que solo traía la nube. **Límites:** (1) un «Deshacer»
hecho en un móvil con versión anterior no apunta hora: si ese móvil había bajado la lápida con
su hora, la unión se la devuelve; (2) con el reloj de un móvil adelantado, su «Deshacer» puede
ganar a un borrado real posterior hecho en otro que no lo había bajado; (3) pasadas 200
decisiones más recientes la hora se pierde y esa clave vuelve a sumarse.

*Recibos borrados.* Todo borrado de un recibo o un puntual deja `reciboBorrado[id]` (`d`, `n`
y, si soltó cargos del periodo, `x` con sus filas) y su hora en `reciboBorradoAt`, tuviera o no
cargos marcados. Un recibo que consta borrado sale de `fixed`/`oneoffs` aunque el estado ganador
lo traiga: sin eso el móvil atrasado seguía con el recibo y su cargo marcado (gastado 40)
mientras el otro y el widget contaban el cargo (102,40). Borrar un recibo SÍ tiene «Deshacer»
(Plan, `undoLastBill`, lo devuelve con el mismo id por `addFixedItem`/`addOneoffItem` →
`conReciboEnPlan`): levanta el borrado con una hora posterior y devuelve la marca, aquí y en la
nube, a las filas de `x`. `reciboBorrado` no tiene tope: de cada entrada depende que los cargos
de meses cerrados sigan sin contar. **Límite:** el resto del Plan sigue siendo «último que
escribe»; si tras un «Deshacer» gana el estado de otro móvil que aún no tiene el recibo, el
recibo no está en ese estado (ya no consta como borrado, pero tampoco vuelve solo).

*Gastos.* Al bajar la tabla, si la nube trae varias filas con la misma clave (el aviso y el
cargo del banco), refresca la local la de su mismo id, que es donde se escribió lo que se
cambió en ella (categoría, «no tarjeta»); sin ninguna, la primera (espera al final del pull,
sin otra pasada por la tabla). Un apunte con id del banco y otro idéntico sin id (mismo banco,
día, importe y nombre) son EL MISMO cargo: entra una fila, la del id, que ocupa la ranura 1
del grupo de iguales; dos con id y uno sin id, una; uno con id y dos sin id, dos. Antes
entraban dos filas con la misma clave, o una, según el orden, y el pull las fundía. Editar un
gasto retira la clave vieja y levanta la nueva si constaba (10 → 12 → 10 escondía el gasto), y
en la nube encadena el borrado de la fila vieja y el alta de la corregida (`subeEdicionesDeGasto`;
misma id: en paralelo el alta chocaba con la clave primaria, `23505`). Si el borrado falla, el
alta no se lanza y la edición espera en una cola en memoria hasta la siguiente edición o el
evento `online`; **límite:** si la app se cierra antes, la fila vieja queda en la nube y el
repaso dará `23505` con origen `backfill`. Los eventos de error de `addExpense`/`deleteExpense`
llevan la puerta de origen (`GASTO_ORIGENES`).

**Condición de publicación (medida en la revisión del 13/10).** Un dispositivo con la 4.26.120
—el ordinal SIN esta entrega— lee `ob:<ent>~recibo.<id>` con el banco limpio y CUENTA el cargo
(102,40 frente a 40), y al reescribir esa fila le borra la marca. Lo mismo el `ingest` de la
120. Por tanto: la 4.26.120 no se promociona a producción sin esta entrega, y el `ingest` de
esta rama se despliega antes que su web (ver `docs/SETUP-SUPABASE.md`). La entrega está
integrada en la candidata 4.26.122, encima de la 4.26.121 (Inicio v4.2), que lleva dentro la 120:
la condición vale igual para la 121. En esa unión `tests/recibo-invariante` sigue comparando
contra `dea5d883` (la 4.26.119 más el ordinal, sin Inicio) y da las mismas cifras.

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

**Lo que se carga detrás del splash (11/10/2026).** Con la cortina puesta, App monta las otras tres
pestañas en UNA sola tanda, en un efecto justo después del primer commit (`11-app-main.js`, junto
al reparto en huecos libres). No hay señal nueva entre la app y el vigilante: los dos corren en el
mismo hilo, así que mientras dura ese render la cortina no puede levantarse, y al levantarse
(`mc-splash-gone`) las cuatro pestañas ya están montadas — lo comprueba `e2e/splash.spec.mjs`.
Antes dependía de los huecos libres: medido con la CPU ×6, en la mitad de los arranques se entraba
con 3 de 4 montadas y la que faltaba caía a la vista. Si la cortina ya no está
(candado, alta), ese efecto no hace nada y sigue mandando el reparto en huecos libres.
La animación del splash (tarjeta, dibujo y un halo que respira) es CSS puro y solo anima
`transform` y `opacity`: es lo único que el compositor mueve con el hilo principal ocupado. Las
entradas van con `animation-fill-mode:backwards`; con `both`, la animación terminada seguía
mandando sobre el estilo en línea con que el vigilante desvanece la marca al salir. Dentro de la
APK el script del `<head>` marca `html[data-mc-nativo]` y el primer frame web arranca con el
color del splash nativo (`colorPrimary`), fundiéndose al del tema.

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

El widget recibe la cifra de `dashboardBudgetStats` desde la app al cambiar sus cifras. Al volver a primer plano,
`visibilitychange` o `App.appStateChange` disparan primero la lectura de gastos de Supabase y
solo tras completarla se envía el snapshot local: el estado anterior a la notificación no puede
deshacer su cifra. No se sincroniza Open Banking. En Android, `WidgetSnapshotArbiter` asigna un
ticket a cada ingest: el absoluto mensual más reciente gana por `readAt`, cada evento mueve el
efectivo de TR una sola vez. Cada push lleva los IDs vistos y las lápidas; el nativo reaplica
los eventos todavía ausentes del pull y descarta los cubiertos o borrados. Los eventos aún en
vuelo se aplican por su contribución a gasto y presupuesto; una inversión
planificada baja el efectivo sin volver a reservarse en la liquidez segura. El período
es Europe/Madrid; si cambia sin una lectura nueva, el widget muestra «—» hasta recibir datos.
Antes del pull, `beginWidgetRead` espera a que terminen los intentos POST nativos previos y entrega una generación de lectura y su corte de tickets. Terminar un intento no acredita un pago: la cola de retry se conserva y su siguiente intento recibe un ticket posterior. `syncCloudExpenses` conserva la marca sólo después de recibir todas las páginas y mezclar sus filas; un error o una lectura superada no la envía. La foto con marca nueva sustituye el registro heredado, incluidos los flags de identidad perdida. Los pagos posteriores al corte se reaplican con las mismas reglas e identidades: los cubiertos por la foto no se suman otra vez y los ausentes conservan su contribución pendiente. La marca se consume una vez; reenviar la foto no retira una incertidumbre nueva.

Los campos `readGeneration` y `nativeCut` son aditivos. Una APK anterior los ignora. Una APK nueva con web anterior mantiene la conciliación por ACK y el aviso de identidad perdida hasta recibir la web que acredita la lectura; con ambas partes actualizadas, abrir y completar la lectura recupera el widget sin borrar datos. Una lectura fallida conserva la duda.

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
`expired` ante un código de sesión terminada de Enable Banking (`EXPIRED_SESSION`,
`CLOSED_SESSION`, `REVOKED_SESSION`; ver `ebFailure`), venga con el HTTP que venga. Un 401 con
otro código, o sin ninguno, no decide solo: si ninguna cuenta del banco respondió, `bank-sync`
pregunta una vez por enlace con `GET /sessions/{id}` (`ebSessionVerdict`). Solo `AUTHORIZED`
es una sesión viva; cualquier otro estado de `SessionStatus`, o un `SESSION_DOES_NOT_EXIST`,
caduca el enlace. Si la sesión vive, o la consulta no responde claro (sin id guardado, 5xx,
red), el enlace se conserva y queda un `app_events` con el código (lista cerrada del enum
`ErrorCode`, u `OTRO`) y lo que dijo la consulta.
403/404, límites 429, 5xx y timeouts también lo conservan. MyInvestor sigue la misma idea
(`miReadWithRefresh`): solo el refresco rechazado con 400/401 deja `expired`, y solo si la fila
sigue teniendo el refresco que se usó (sync y keepalive comparten token: el que llega segundo
recibe el rechazo del viejo). Un 403/429/5xx, una respuesta sin token, la red caída o no poder
guardar los tokens rotados responden `softFail` y no tocan el enlace. El caso «refresco
aceptado y el acceso sigue en 401» responde `softFail` dos veces y a la tercera en seis horas
caduca; el contador es el limitador de la migración 0019 (`rate_limits`), que cuenta veces
dentro de la ventana, no veces seguidas, y si no responde no caduca.

Límites conocidos de esta regla, sin arreglar (13/10):

- El **histórico** (`bank-sync` con `dateFrom`) no pregunta por la sesión ni toca el enlace:
  devuelve `eb_401` ante cualquier 401 y el cliente lo traduce siempre a «falta completar la
  conexión» (`bankReadWarnings`), también cuando el fallo es de la aplicación.
- En `myinvestor-sync`, el detalle de una cuenta que responde algo distinto de 200 y de 401
  (403, 404, 5xx) se **salta**: la respuesta es `ok:true` con las posiciones de las demás, o
  vacía. Solo el 401 del detalle corta con `softFail` (`detail_401`). No se cambia el resto sin
  saber qué devuelve MyInvestor para una cuenta de valores cerrada.
- El aviso suave de «Actualizar» lo redacta el cliente (`bank_syncsoft`: «no hace falta
  reconectar») y es el mismo para todo `softFail` de MyInvestor, también las dos primeras
  veces del caso anterior. El texto distinto del servidor solo se ve en la tarjeta de
  MyInvestor.
**Desconexión y carrera con callback, candidato13/10 sin desplegar.** `bank-disconnect`
descifra con `decryptSessionId` antes de codificar el id en el DELETE. Antes enviaba el valor
cifrado y callaba el fallo, aunque borrase la fila. Ahora el fallo deja `app_events` con paso
y código cerrado; nunca id, ciphertext, JWT o mensaje del proveedor. La fila local se borra
igualmente, incluso si falla el registro. Los ids legacy siguen funcionando.

La escritura final de estado de `bank-sync` compara dentro del UPDATE los `session_id` y
`state_issued_at` que leyó: una sesión o generación distintas no reciben el resultado antiguo.
Se usa el valor guardado, no el descifrado; las columnas null legacy se comparan con `IS NULL`.
No hay SELECT adicional entre comparación y escritura. Un callback completado mientras el
sync espera gana tanto al resultado caducado como al correcto que antes adelantaba `last_sync`.
El payload y los demás bloques de cursor/acuse, `bank-callback` y `keepsCursor` se conservan.
[Alcance, dependencia de Claude y evidencia](briefs/bancos-revoca-callback-20261013.md).

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
- **Parte mía** (14/10/2026): cualquier cuenta (manual, re-anclada o extra OB) puede contar solo
  en parte en el patrimonio (una conjunta al 50 %). Vive en `settings.accountShare`, con clave
  `iban:<IBAN>` si lo hay (sobrevive a reconectar y a promocionar) o la de orden de la fila; sin
  entrada = 100 %. La aplican el total de Cartera (`liquid` en `totals`) y `netWorthSeries`
  (saldo de hoy, cierres manuales y flujos de esa cuenta). Gastos, presupuesto, recibos, widget
  y `bankBal` usan el saldo entero. Los movimientos OB guardan su cuenta en `obAcc` (IBAN o uid,
  de `bank-sync` → `flattenBankTx` → `importObExpenses`; `tagObAccountsFromBankTx` la recupera en
  lo ya apuntado que el banco vuelve a mandar). ⚠ `obAcc` **solo vive en el móvil que sincroniza**:
  la tabla `expenses` no tiene columna para ella y no sube a la nube, así que otro móvil, una
  reinstalación o un apunte que solo llega por la nube (el histórico del servidor incluido) no la
  tienen y cuentan como «sin cuenta». Una principal re-anclada sin IBAN guarda el uid del banco en
  `bankUid` para reconocer los suyos. Un traspaso entre dos cuentas con partes distintas cuenta solo
  la diferencia, el día de la salida. Un
  movimiento sin cuenta en un banco cuyas cuentas tienen partes distintas cuenta entero y la «i»
  de Inicio lo dice, salvo que él decida en la ficha de qué cuenta son: `settings.accountShareLegacy[ent]`
  = `{key, no, day}` (sin reescribir gastos; vale para lo que entró sin cuenta hasta ese día; se deshace).
- La ficha guarda un cierre diario real por cuenta en `accountBalanceHistory`, indexado por la
  misma clave estable del orden (`acc:<id>` / `ob:<key>`) y limitado a400 puntos mediante
  `recordAccountBalances`, compartido con Inicio. El día civil es el de Madrid. El gráfico de
  14 días y la variación desde el día 1 solo aparecen cuando existen esos cierres: no se reconstruye
  saldo histórico a partir de gastos ni se atribuye la previsión agregada si hay dos cuentas del
  mismo banco. El primer cierre espera `mc-boot-ready`, que ya representa dato local definitivo sin
  red o el final del primer pull con red; así un snapshot viejo no se convierte en base mensual.
  Inicio no vuelve a calcular la serie por ese cierre de HOY (20/10/2026): `netWorthHistoryKey`
  deja fuera el punto de hoy de una cuenta que ya tiene cierres anteriores (la serie lo saca de los
  saldos vivos) y solo lo cuenta si es el primero. De los ajustes, la serie y el presupuesto de Inicio
  dependen solo de los campos que leen (`NET_WORTH_SETTINGS`, `BUDGET_SETTINGS`), así que tocar
  Ajustes ya no recorre el histórico. Lo vigila `tests/inicio-deps-ajustes`.
- El rol (recibos/diario/todo) vive AQUÍ; en v4.0.x quedó inaccesible (solo existía en el
  Wealth v3 no montado) — no volver a dejar el rol sin puerta.
- Inversiones abre como pantalla hija propia desde Cartera y solo actualiza precios cuando se pulsa
  su acción: no hay sincronización al montar. La Proyección vive en esa misma pantalla (ficha plegada al pie de «Ver todas tus inversiones»);
  el interruptor «Actualizar precios al abrir» se retiró (no hacía nada). Redondeo y Saveback siguen en Cartera porque afectan al flujo diario, no a la valoración.

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

### Compatibilidad y recuperación del widget

El listener prefiere la respuesta `widget` v2 de ingest y conserva compatibilidad con
`month` legacy. Con fecha/identidad/céntimos fiables aplica únicamente la contribución del pago
a la foto guardada de Inicio, usando sus bancos y magnitud; nunca sustituye un neto de ciclo por
un total mensual. Una barrera de ticket protege el pago incremental frente a absolutos previos.
El servidor mantiene month intacto para APK antiguas y calcula widget desde el periodo,
ancla y scope de app_state; si no los acredita, devuelve null. Sin sync bancaria nueva ni SQL.
El cálculo opcional del widget tiene su propio bloque de errores: si falla, los avisos de presupuesto y la respuesta mensual siguen disponibles.

### Elección del banco del widget (4.26.50)

`settings.widgetBank` guarda una entidad bancaria del estado principal. `widgetBankOf` resuelve la elección y vuelve a la cuenta `spendFrom` si falta. App envía `cashEnt`, `cashLabel`, `cash` y `safeLiq` de ese banco con el presupuesto global existente. El efecto depende también de `cashEnt`: bancos con cifras iguales deben actualizar el widget. No cambia los roles, filtros de gasto, servidor ni contrato nativo; las cuentas del mismo banco se agregan. Efectivo y Familia se excluyen de la elección explícita y sus opciones. El automático conserva el spendFrom original, incluido Efectivo si era diario.

FIN-06: FX puro devuelve null sin tipo (nunca 1:1). Las sumas vivas omiten conversiones desconocidas con aviso de total incompleto; el original permanece en cuentas OB/inversiones. No se ancla ni registra histórico EUR incompleto. Frankfurter v1 descarga todo el catálogo BCE y conserva tipos guardados para offline; USD de respaldo procede de state.fx, sin valor ficticio para estados nuevos. Movimientos persistidos siguen en EUR y no se migran.

## SEC-03: frontera de diagnósticos

Cliente probado y aprobado en beta 4.26.57.1; entrega exclusiva cliente 4.26.57 mediante PR49, Edge sin despliegue: los errores automáticos se reducen antes del transporte a operación y clase cerrada; app_events ya no añade el correo de sesión. El sobre Sentry se reconstruye por lista permitida (tipo/código/posición/versión/plataforma), sin contextos, breadcrumbs, tracing ni URL de petición. Feedback y notas de beta explícitos redactan patrones sensibles y filtran campos, con límites semánticos. user_id sigue siendo necesario para RLS: no es telemetría anónima. Matriz, pruebas y límites Edge/gateway en [SEC-03](briefs/sec03-privacidad-logs.md).

SES-01, primera entrega web: los fallos finales de la tarjeta TR (login, verificación y sync) y
del sync manual general pasan por `trLogFailure` y el `cloud.logEvent` existente. Se conserva
`kind:error`, `message:tr_sync`; `detail` se reconstruye con `schema:1` y tres enums cerrados:

| Campo | Valores admitidos |
|---|---|
| `code` | `auth_expired`, `soft_fail`, `sync_invalid`, `sync_rejected`, `status_rejected`, `status_inactive`, `client_error`, `login_failed`, `verify_failed`, `unknown` |
| `origin` | `tr_card_sync`, `broker_manual_sync`, `tr_card_login`, `tr_card_verify`, `status_check`, `unknown` |
| `snapshotAge` | `unknown`, `no_snapshot`, `invalid_clock`, `lt_5m`, `m5_lt_60m`, `h1_lt_24h`, `ge_24h` |

Todos los productores de esta entrega emiten `snapshotAge:unknown`: la APK existente no entrega
edad estructurada. Los tramos reservan menos de5min, de5min a menos de1h, de1h a menos de24h y
24h o más; no se calcula edad desde `lastTrSync`, el texto del error ni timestamps del cliente.
JSON inválido, campos extra y valores fuera de lista no pasan al registro. El prefijo antiguo
`TR sync:` conserva la ruta sin analizar su texto para inferir una causa.

`auth_expired` solo describe el flag del puente sin `softFail`/`wafBlocked`; no prueba HTTP401,
ni distingue refresh de WebSocket. `soft_fail` describe esos flags temporales; los rechazos de
promesa o excepciones síncronas del puente sync se registran como `sync_rejected`, sin texto crudo.
Las excepciones del procesamiento local (`brokerSuggest` o `applyBrokerPositions`) son
`client_error`: el segundo argumento de `.then` recoge solo el rechazo del puente, y el catch
posterior separa nuestro procesamiento. Un fallo de TR conserva el resultado parcial de
MyInvestor y el orden previo de los avisos.

Revisión1: al arrancar, `trLogStartupStatus` observa `authExpired:true` o `connected:false` con
teléfono guardado. Emite `status_inactive` con `origin:status_check` y edad `unknown`, sin enviar
el teléfono ni cambiar la conexión. La tarjeta y el sync automático general usan la misma
etiqueta: el dedupe existente de `logEvent` permite un solo INSERT por sesión aunque se remonte
la tarjeta o cambie el motivo. Un status ausente/inválido, conectado o desconectado sin teléfono
no emite este evento salvo `authExpired:true` explícito. No se deduce HTTP401 ni caducidad remota
del flag local; no se añade sync bancario, notificación ni reintento. TR sigue solo a demanda.
El bundle se genera con `npm run build`; el guardián de privacidad coteja sus helpers y
sanitizador con la fuente para detectar un `public/index.html` atrasado.

No hay escritor remoto nuevo, SQL ni Edge: se conservan el dedupe y tope20 por sesión, el bloqueo
de `logEvent` en modo pruebas y la entrega best-effort. No se envían cookies, edad exacta,
URL, error libre, teléfono, PIN/OTP, posiciones ni importes. El detalle no añade PII; la fila
sigue incluyendo `user_id` por RLS. Las pruebas Node ejercitan los handlers de la tarjeta y el
transporte `cloud.logEvent` con un INSERT sintético capturado, además del flujo general. No
sustituyen DOM, móvil ni validación de cookies. La instrumentación nativa y su APK quedan para
otra tanda; esta entrega no mide la vigencia remota del snapshot ni cambia sesión o reintentos.

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

La candidata de edición 8/10 usa `editReservaRule` en el mismo ID y conserva `mensual` y campos desconocidos. Compara semánticamente la copia que abrió el formulario con la única regla de ese ID al escribir: cambio o borrado rechazan, incluso si solo cambió un campo desconocido; el orden de claves JSONB no es una edición. Valida meta activa, tipo e importe con céntimos representables; un no-op sin mensual pendiente devuelve el mismo estado. Solo asienta la regla mensual editada si falta su identidad de este mes; los asientos previos y sus metas permanecen intactos. El resultado del updater se observa sin persistirlo y el cierre exige la configuración objetivo en el estado: un rechazo al rebasar una escritura provisional recupera el borrador, una edición posterior legítima no lo reabre. La referencia de operación impide atribuirle el resultado de otra edición. No añade sincronizaciones ni cambia el last-write-wins entre dispositivos. [Contrato y pruebas](briefs/inc-0810-metas-editar-regla.md).

Borrar una regla confirmada elimina su configuración y añade asientos de reserva inversos con la misma fecha/identidad, `releaseOf` y fecha de liberación, solo para asignaciones comprobables con identidad única y sin liberación previa. Una configuración reaparecida no permite compensar dos veces. Liberaciones parciales o registros ambiguos conservan el pendiente para revisión separada. No borra asientos originales, ahorro aportado ni movimientos bancarios. El total del registro libera únicamente el descuento atribuido a esa regla; cliente y servidor actuales lo leen igual. La identidad de nómina permanece aplicada. Configuración y log viajan juntos por `slimForCloud` y el sync last-write-wins existente; no se promete reconciliación de escrituras simultáneas ni reparación de reglas huérfanas antiguas. [Contrato y pruebas](briefs/inc-0310-01-meta-regla.md).


Movilidad88 conserva el histórico y todos los contratos87; catálogo diario añade multas/zona_azul/peajes solo para altas inequívocas. Los lectores financieros siguen los mismos IDs y gastos diarios; no añade sync automático.

### Resultados de brókers (4.26.89, candidata)

El resumen manual conserva por separado éxito, caducidad y fallo temporal de Trade Republic y MyInvestor. Un éxito parcial se presenta aunque el otro falle; una consulta MyInvestor fallida no se interpreta como ausencia de enlace. TR continúa a demanda y MyInvestor conserva el throttle automático. No cambia la aplicación de posiciones ni se despliega servidor.

## Guardado del estado: solo lo comprometido (4.26.94)

El estado se escribe en disco desde un `useLayoutEffect` de `App` que corre tras cada commit y llama a `mcPersistCommit` (00-core): apunta el estado recién pintado como volcado pendiente, marca el histórico de gastos solo si cambió su referencia y arma, si no lo había, el temporizador de 400 ms. `set()` solo calcula el estado siguiente y sella `_savedAt`; no apunta nada ni arma temporizadores.

Antes el volcado se apuntaba dentro del updater de `set()`. React puede ejecutar un updater sobre un estado que luego abandona —dos escrituras encoladas en el mismo instante, una urgente y otra no— y después reutilizar un resultado ya calculado sin volver a llamarlo; el volcado se quedaba entonces con el estado abandonado. Se vio en el alta de reglas de Metas: en pantalla la regla no existía y en disco sí. Un estado que la app nunca llegó a tener no se guarda.

Como es código común, el bloque de guardado forma parte del alcance de revisión de toda tanda cuyo código llama a `set` de App (18 de 25, decidido contra el código por `beta-sources`): cambiarlo vuelve a pedir su prueba. Una aprobación heredada por equivalencia de código deja de aplicarse cuando el código cambia; su registro histórico no se toca.

Se conserva lo demás: una escritura como mucho cada 400 ms, volcado inmediato en `pagehide` y al pasar a oculto, guardado partido (`micartera_v3`, `micartera_v3_exp` y `micartera_v3_balhist`), ninguna escritura al montar ni cuando un updater devuelve el mismo estado, y las salvaguardas del modo pruebas (`mcSkipPersist`, `mcRecargarSinVolcar`). Límite: una escritura pedida y aún no pintada cuando llega `pagehide` no se vuelca; antes tampoco estaba garantizado, salvo cuando React la calculaba por adelantado.

El historial por cuenta se guarda separado porque sus400 cierres no deben reescribirse al cambiar otro dato. `mcSaveRaw` conserva la referencia y el contenido de la última foto; una referencia nueva con el mismo contenido no escribe `_balhist` otra vez. La partición lleva `{schema:1,revision,history}`. Mientras falla esa escritura, la clave principal conserva la foto y `_balHistoryRevision`; si falla limpiar la principal después de guardar la partición, `mcLoadRaw` elige la revisión durable más reciente. No se borra la única copia cuando una escritura falla. El mismo contrato usa `micartera_sandbox_balhist` en modo pruebas y su reset no toca la partición real. Esta arquitectura llega con Inicio v4.2 (PR204) y está integrada en la candidata 4.26.121; publicación en beta y aceptación móvil pendientes.

### Ciclo de sesión y desmontaje (candidata102)

El efecto inicial conserva el disposer devuelto por `cloud.onAuth`. Al desmontar, desactiva sus continuaciones, cancela el timer de arranque y libera la suscripción. Una Promise o un idle tardío no inicia otra lectura ni actualiza estado. No cancela trabajos ya iniciados ni modifica el orden de decisiones de identidad.

### Recientes de Dashboard · candidata106

La derivación de tres recientes conserva el filtro de lápidas y el orden estable por fecha. `useMemo` depende de `state.expenses` y `state.deleted`; abrir presupuesto o modificar settings no vuelve a recorrer el histórico. Los setters deben seguir conservando referencias cuando no cambian y generar referencias nuevas al editar/eliminar/sincronizar. No depende de todo state ni de fecha civil: la lista ordena fechas originales sin ventana temporal. No cambia dinero ni sincronización.


## Ciclo de vida y recientes · candidata selectiva106

cloud.onAuth devuelve la retirada de su suscripción. App cancela timer y callbacks de sesión al desmontar; los handles tardíos de appStateChange/bankNotif se liberan aunque lleguen después del cleanup. Conserva las opciones de login/cambio de titular. Dashboard memoiza sólo sus tres recientes por las referencias expenses/deleted: editar, altas y lápidas invalidan; abrir presupuesto no repite filtro/sort. No añade sincronización bancaria automática.

## Candidata107/108/110 · 9/10/2026

`useBackClose(open,onClose,identity)` transfiere la entrada propia de historial entre overlays dentro del mismo lote de efectos. Tokens y propietario distinguen pops propios/ajenos; el callback Capacitor usa el mismo controlador y BillsAddWizard registra la identidad del paso. AskHost re-registra el diálogo actual. Corresponde a la revisión110 aprobada; la cualificación de esta selección todavía está pendiente.

`editReservaRule` compara la copia de apertura con el estado fresco, conserva id/contrato/campos desconocidos y no reescribe un asiento mensual ya aplicado. `applyReservaMensual` admite limitar el asiento pendiente a la regla editada. La línea mensual conserva la meta original del asiento si la regla cambia de destino. Corresponde a108; no se introducen sincronizaciones bancarias nuevas. [Alcance y gates](briefs/promocion-107-108-110-local26.md).

Revisión de Inicio PR204 sobre119: historial local400/nube14 unido por fecha sólo para el propietario vigente; callback tardío sin sesión conserva el estado previo. El alta de Bienes se acredita sólo en Guardar; un bien legado sin escalones mantiene su valor actual hacia atrás con cobertura explícita. Con escalones reales se limita al tramo conocido, salvo el bien legado que se revalora: `recordAssetValues` anota la víspera el valor que tenía (`legacy`) y la serie lo mantiene hacia atrás (ajuste del 13/10, integrado en la 4.26.121 junto a la unión de `gemelos` de la 120, que ocupa el mismo punto del pull). Traspasos sólo se neutralizan entre dos cuentas de flujo; deudas sin plazo sitúan la amortización histórica en el día conocido de cuota, conservando el saldo actual. La caché depende de referencias financieras y día de Madrid. Contrato y gates: [ronda anterior](briefs/inicio-revision-nogo-20261012.md) y [segunda revisión](briefs/inicio-ronda3-bienes-20261012.md).

Revisión de reservas PR226 (13/10, sin desplegar): todas las escrituras por enlace comparan
la sesión/emisión leídas, incluidos cursores119 legacy y el expired sin cuentas. La revocación
tiene tope8s; un DELETE local condicionado conserva la nueva generación y devuelve409 si cambió.
Sin snapshot no se borra una conexión que aparezca tarde. Libro y balances no se editan.

## Emparejado automático: candidata TR NO-GO 2

El refresco aislado de Gastos lee las decisiones de `gemelos` antes de los gastos cuando
hay parejas automáticas locales. Sólo une esas decisiones; no adopta otra parte de la
cartera. Una fila sin `#dup` no acredita separación: manda la decisión explícita más
reciente, incluso si su escritura de marca sigue pendiente. La lápida de un apunte
oculto borrado a mano conserva el rastro «sin aviso» para no reclamar el aviso del
siguiente cargo igual. Editar la fecha dentro de la ventana de un día mantiene el par.
Contrato, pruebas y límites de entrega: [TR NO-GO 2](briefs/tr-emparejado-nogo2-20261014.md).


## Candidata OPS-08: escritura de tokens MyInvestor

Keepalive y sync usan `_shared/myinvestor-refresh-save.ts`: CAS por usuario/conexión/refresh almacenado, más acceso cuando no rota el refresh. Hasta dos intentos del mismo patch cifrado, con readback propio/competidor/indeterminado; ningún reintento del banco. Sync recifra legacy bajo esa guarda antes de releer el snapshot. Cero filas no es éxito. La serialización del consumo externo queda fuera (propuesta OPS-09). Sin despliegue acreditado por esta candidata. [Contrato](briefs/ops08-refresh-cas.md).


## FIN17: confirmadas tras ACK, candidata F1–F5

El registro confirmado se une fuera de LWW; el umbral1000 nunca bloquea sincronización por capacidad. El pack v1 conserva testigos completos tras hashes con colisión, se persiste por propietario solo si cambia y no se duplica en el estado ligero. Push completo omitido solo con payload semántico y CAS iguales; los lectores servidor deben admitir el pack antes de publicar el cliente. Aviso local consumible y limpieza de particiones en SIGNED_OUT. [Contrato y límites](briefs/fin17-confirmed-absorptions-20261018.md).

## FIN-19: gastos iguales de bancos distintos (4.26.160)

La identidad de un gasto bancario lleva banco y cuenta cuando se conocen, de modo que dos compras iguales (día, importe y comercio) en Sabadell y CaixaBank cuentan las dos en el cliente (`00-core.js`), el widget y el servidor (`_shared/presupuesto.ts`). Las lápidas de borrado llevan ámbito (banco/cuenta y `obName`); el renombrado desde la ficha usa las claves sin ámbito de FIN04 y las levanta al volver al nombre original. El contador del pull valida cada campo de identidad antes de reutilizar claves y no depende del orden de las filas. Las filas antiguas sin cuenta conservan el comportamiento anterior. Límite conocido (FIN-29): la lápida de un renombrado es la misma que la de un borrado sin ámbito, así que renombrar una de dos filas iguales de cuentas distintas oculta la otra (vuelve al total de antes de FIN-19). Detalle de rondas en `docs/briefs/fin19-cross-bank-identity.md`.


## FIN04 B: conflictos de recibos y deudas

FIN04 B incorpora `mergePlanThreeWay` y `planSyncPull/Ack` para recibos/deudas sobre la puerta inicial de PR293. Grupos financieros indivisibles, lápidas existentes, base del payload enviado y conflictos privados sin truncar. La revisión reutiliza los editores y no reproduce pagos. [Contrato y límites](briefs/fin04-plan-three-way.md).
