# INC-2909-03 · retirada bancaria · candidata aislada

## Corte79 sobre fuente78 final · 1 de octubre, DOM28 verde

Parent exacto `eaf55e4af38d2277a50baa5e736a93cd09b3a627`; rama `codex/inc-2909-03-graft78-79`.
El delta exclusivo de Retirada aff910b9 aplica sin conflicto en sus ocho rutas; conserva
Panel76/UI77 y las notas/guiones76/77/78. No modifica08,10,14 ni shell fuera del ensamblado
generado de RELEASE_NOTES. 43 Node PASS; sintaxis, frescura, i18n, seguridad y mapa PASS.

A/B minificador oficial, sin tocar el HTML fuente:78 min1.279.861/gzip348.399 B;
79 raw2.034.242/min1.288.380/gzip350.396 B. Delta+8.519/+1.997 B.
Topes1250/341 KiB se exceden8.380/1.212 B; coordinador autoriza mínimos1259/343 KiB.
Mínimo aritmético1259/343 KiB deja836/836 B antes del sello: aún hay que medir el sello.
No se propone recortar contratos ni idiomas. Tres bloqueantes y ninguna dependencia nueva.

Lease28 explícito, servidor propio4265; hash HTML `4eb19e7af5e7e672dc39484b3e214f681a6ef714f04ac0a0acdbe58cf28b235e`.
Primer intento siete casos no ejecutados por spawn EPERM. Repetición autorizada:7/7 PASS
en60s,1worker, cuatro tardíos de Retirada y tres vínculos/deshacer de Recibos es/en/ca.
Lease28 LIBERADO explícitamente, servidor propio4265 detenido. Reporte ignorado
`test-results/retirada-lease28-dom.json`. CI y PR nueva pendientes. No beta79 intermedia, no PR88 vieja/main, APK, Edge ni SQL.

Sello ensayado79.99 sin tocar public:1.288.387/min y350.399/gzip9 B.
Topes mínimos1259/343 KiB autorizados y actualizados; sello79.99 deja829/833 B.
Tabla de alcances derivada contra78:8web cambian,6 iguales (TR/arranque/ayuda y3UI77),
15tandas total incluida Retirada nueva. Todas las superficies native/Edge previas iguales.
Guion de Nómina78 permanece; web cambia por dependencias compartidas realmente distintas,
no se conserva un OK de web diferente. Retirada mantiene web cbf0e897348d740c66a15d3177644d0eb4fdf65b3d952bcea16f3e4ffe9580bf
y codigo 2e1fafd16ad03ee0cb73a34bd7e9b0b4e99f4150fc0085ce6eebfe2390c2f3c7 derivados.
113bloques propios y scanner943/284 PASS; ninguna auditoría ampliada repinada.
Contratos fixed-payment-state, fixed-day-reconcile e hist-pagos-mensuales PASS.

Los apartados inferiores documentan preparación y evidencia histórica, no el corte actual.


## Preparación79 previa · evidencia histórica, superada por el corte de arriba

Coordinador único `01a0f653-42f0-7ed0-80a8-29ed5837b446`; rama propia
`codex/inc-2909-03-graft78-79`. Reserva web4.26.79 posterior a UI77/Nómina78.
Parent final `eaf55e4af38d2277a50baa5e736a93cd09b3a627`, delta financiero
`aff910b95c0e5f5408306235bf1ccf0670eae100`. La nota y guion de Retirada se trasladan a79;
no queda una nota de Retirada en77. VERSION/package/lock/README/ROADMAP/CHANGELOG dicen79
y preparación local: no se declara final, publicado ni aprobado. PR88 no se publica.

La fuente financiera, handlers, guardia de identidad/ACK, reloj de fixtures y selector del
pie permanecen iguales a aff910b9. Guion79 en es/en/ca conserva cinco pasos, sin alias de
aprobación previa ni codigo fijado manualmente. El registro se volverá a derivar y verificar
con el scanner del parent final78, conservando los tres guiones independientes de UI77 y
el nuevo de Nómina78. No se importará el antiguo paquete/notas76 de Nómina por arrastre.

Conflictos comprobados por fuente: Nómina5c2146c3 modifica importObExpenses en08 y sus
guardianes; la base8941 ya contiene esa guardia. Retirada no modifica08. UI4c97b43d usa
14/shell para Cyberpunk/Preguntar/Perfil y metadatos; no modifica los cuatro módulos de
Retirada (00/01/04/11) salvo los textos del panel76 en01 que aún faltan en8941 y deberán
conservarse. Campos y keys nuevos de Retirada son distintos; no se elimina el panel.
Puntos de integración a resolver sobre78: adiciones en E2E_MAP, cierre de beta-sources,
notas/versión/documentación y generados. No se repite ni implementa el trabajo de UI/Nómina.

Estado DOM: 13 verdes previos; cuatro tardíos aún pendientes (ACK es/en/ca y UPDATE denegado),
ya con selector `.v4-exp-sheet .v4-ficha-done`. El coordinador concede lease28 a este chat para los cuatro casos tardíos y contratos afectados. Leer owner antes de cada arranque. Freeze/CI después de verificar este injerto; no publicación intermedia79.

## Preparación anterior77 cancelada · evidencia conservada, no publicar esa numeración

Rama `codex/inc-2909-03-injerto76`, parent exacto `8941adfc46e92f0264a18e465b421d7f2bc848b4`.
VERSION/package/lock/notas/README/ROADMAP alineados77. Injerto por diff3-way exclusivo de
Retirada; no cambia `08-motor-bank`, `14-v4-screens`, `10-app-components` ni la implementación
de los scanners de75. Los conflictos de Arquitectura/Roadmap conservan Nómina y se añade
Retirada, sin arrastrar encabezados74. Fuentes de Ingresos, Plan, native y Edge idénticas al parent.
43 Node PASS tras el injerto. Se conserva el ACK/handler de `a72b6359`, sin nuevo cambio financiero.

Registro actual `scripts/beta-sources.json`: nueva tanda web `inc-2909-03-retirada`, 113 bloques
con cierre del scanner real de funciones/datos; sin alias, aprobación previa, native ni Edge.
943 mutaciones de funciones y284 de datos PASS en beta-sources (antes817/260 en76). También se
cierran dependencias nuevas alcanzadas por scopes existentes; no se reescribe auditoria/ampliada
histórica ni se fija codigo manualmente. El build deriva web/codigo y entrega de esta fuente.
Retirada web=`cbf0e897348d740c66a15d3177644d0eb4fdf65b3d952bcea16f3e4ffe9580bf`,
codigo=`2e1fafd16ad03ee0cb73a34bd7e9b0b4e99f4150fc0085ce6eebfe2390c2f3c7`.
Los datos son evidencia derivada, no inputs ni aprobaciones.

Comparación real contra76: TR, arranque y ayuda mantienen web. Recibos, panel, Inicio, Nómina y
cuatro tandas widget cambian web por las puertas y dependencias compartidas de Retirada; ninguna
mantiene el OK de una web diferente. Todos los hashes native/Edge de las once tandas previas
permanecen iguales. No se borra ningún guion/historial ni se cambia el motor de nómina o widget.
El ensanchamiento necesario incluye withdrawalReceiptLink/eligibilidad/identidad, llamadas del
handler, mcSandbox y _mcSandboxPinned donde se alcanzan; conservar esos huecos hacía fallar
beta-sources. Tabla derivada completa: 8 web anteriores cambian, 3 iguales (TR/arranque/ayuda);
Retirada es nueva. Inicio cambia sin añadir descriptor
porque su alcance ya incluye una dependencia modificada. No se promete conservar una aceptación
cuando ha cambiado el código que compara el panel.

DOM22 sobre77: 13 PASS (todos los casos originales y vínculo/deshacer/B es/en/ca), luego2
TIMEOUT es/en en el selector del pie: ACK, aviso honesto, persistencia y prueba retirada en A
ya pasan, pero Listo es hermano del cuerpo `data-testid=exp`. Se corrige únicamente el selector
al pie real `.v4-exp-sheet .v4-ficha-done`. Se interrumpe la pasada tras esos dos clones para
liberar Chromium; otros2 casos tardíos no se cuentan como verdes. Lease22 liberado explícito,
servidor detenido. Pendiente pasada enfocada de los cuatro tardíos, sin cambiar runtime ni
repetir los13 verdes. Lease20 denegación había pasado, pero falta acreditarla en77.

Tamaño sobre76 medido Windows: raw2.032.827/min1.287.184/gzip351.253 B antes del último cierre
de descriptors; topes1258/344 KiB (+9/+4 frente a76), tres bloqueantes, sin dependencias nuevas.
El guardián size ya pasa. Fresh/sintaxis/idiomas finales y medida Git quedan por registrar con
el SHA de cierre. CI completa, GO exacto de root y HTTP servido76 necesarios antes de publicar.
Sin push, PR nueva, publicación, main, APK, Edge, SQL ni datos reales realizados en esta fase.

## Preparación anterior sobre74 · 43 Node PASS, DOM20 rojo por lectura anticipada

Fuente local `a72b6359`, sobre el injerto74, sin push ni bump. Sustituye el NO-GO de63:
el handler real recibía ACK válido de UPDATE pero rechazaba aplicarlo si había llegado un
vínculo de recibo. La tabla quedaba Traspaso; el pull posterior dejaba paidA=false/paidB=true
sin feed. No basta conservar el pago local al recibir el ACK.

Se mantiene el bloqueo del vínculo existente, llegado durante el diálogo, sesión o SELECT,
incluso sin feed válido, y su puerta Deshacer. Cloud exige lector vivo y revalida antes de
UPDATE. Solo RETURNING válido de una fila con UUID/origen/fecha/importe/comercio exactos y
cat=traspaso vuelve con `withdrawalUpdated:true`, marca efímera no persistida en la tabla.
`reconcileConfirmedWithdrawal` valida de nuevo la fila local única y su categoría/identidad;
si observa el vínculo llegado durante ese envío, usa `linkFixedPayment(null)` para quitar
la prueba expense coincidente del mismo mes antes de aplicar neutralidad confirmada.
Una lectura ya neutra, cero ACK, fila distinta, fallo o retorno vacío no permite revocar pago.
Sandbox conserva su camino local y tampoco deshace pruebas automáticamente.

43/43 Node PASS con método cloud y handlers reales extraídos, no solo helpers. Llegada durante
envío o devolución: una escritura, done honesto, pull y slimForCloud A/B sin feed paid=false;
banco real420→420 con CLBD+BOOK, presupuesto80→0, cash manual30 intacto. Conserva importes
propio40/bruto80, otras pruebas/meses, paidYm/paidDay, referencias de cuentas/feed y UUID.
Fallo/0ACK/UUID o identidad distintos conserva prueba y categoría local; renombrar y Deshacer
manual siguen protegidos. Ambas puertas del vínculo esperan durante Retirada. El aviso es/en/ca
explica recibo pendiente y que el cambio se compartirá al sincronizar, sin prometer que ya llegó.

`linkFixedPayment(null)` elimina la prueba; NO crea una lápida. Se sincroniza mediante el CAS
existente de app_state, sin escritura nueva, importe, ledger, SQL, Edge ni APK. No acredita
atomicidad entre tablas/clientes, timeout con commit remoto sin ACK ni carreras posteriores.

Lease17 liberado explícitamente, servidor detenido: 10 PASS / 3 TIMEOUT (es/en/ca) en línea145
por selector `exp-cat-traspaso` ausente del listado frecuente de la ficha. Se corrige abriendo
Todas las categorías y eligiendo el Traspaso real, sin añadir atributos para acomodar el test.
Las aserciones de bloqueo, categoría, cero escrituras y prueba permanecen. Lease20 canónico
concedido a este chat: 17 DOM propios, un trabajador, 13 corregidos + 3 ACK tardío es/en/ca
y 1 UPDATE denegado con vínculo tardío. La prueba baja el vínculo por conflicto CAS y pull
reales de app_state; no inyecta un setter ni sustituye el handler. Resultado20: 11 PASS/6 FAIL,
sin retries/skip, ~96s. Los seis llegan a neutralidad y el caso tardío al aviso honesto en DOM;
fallan al leer inmediatamente localStorage, todavía con Otros antes del guardado diferido.
Se añade la misma espera poll del caso ACK anterior, sin quitar aserciones; caso tardío espera
también desaparición persistida de la prueba. Lease20 liberado explícito y servidor detenido.
La pasada corregida y pago B después de ACK siguen pendientes; no se atribuye verde por inferencia.

Fixed-payment-state, seguridad, idiomas, mapa, sintaxis y presupuesto PASS. Medición Windows
previa al último ajuste explícito sandbox: min1.283.524 / gzip349.910 B. Topes1254/342 KiB
(+1/+1 necesarios respecto a63), tres bloqueantes. Remedir injerto76 y sello final77.
Base76 autorizada `8941adfc46e92f0264a18e465b421d7f2bc848b4`; injerto después del DOM20.
Los26 bloques preparados abajo no activan scope/huella ni aprobación; cierre transitivo real
de75, guion, versión77, GO y CI exactos siguen pendientes. El coordinador serializa publicación.

## RED histórico de integración con Recibos74 · 1 de octubre

**NO-GO para integrar77 con el runtime actual `1922a09e`** hasta corregir y volver a revisar
este caso. No se ha cambiado runtime ni añadido un scanner. La comprobación nueva ejecuta
motor real y `confirmExpenseWithdrawal` real con doble de SELECT/UPDATE/RETURNING por UUID;
no usa Chromium, SQL, datos reales ni una supuesta propiedad `fixedId` en el gasto.

Puerta real: `ExpenseDetailSheet` pinta la acción con `canRecognizeWithdrawal(exp)` y
`recognizeWithdrawal` usa el mismo helper. Solo excluye duplicado, ingreso, deuda e inversión;
no consulta `fixed[].paymentProofs`. Por tanto una salida OB ya ligada a un recibo sigue
ofreciendo Retirada. La categoría original es Otros y el cargo tiene UUID válido.

Reproducción compartida sintética: modelo de agua con `amount:40`, `bankAmount:80`, cuenta
CaixaBank y día25; cargo OB de80 y BOOK del25/9, comercio `DISPOSICION OFICINA PRUEBA`, UUID
`550e8400-e29b-41d4-a716-446655440000`. El nombre del modelo no casa con el del banco:
`fixedPaymentState` antes de confirmar es false. `linkFixedPayment` confirma ese cargo exacto
y crea `paymentProofs[2026*12+9]` con `kind:"expense"`, `expenseId`, `identity`, `key`,
`expenseKey`, `expenseLegacyKey`, `date`, `bank`, `amount` y `model` reales. A y B sin feed
quedan paid=true. No se inventa una atribución por importe ni por un campo ajeno al modelo.

Después del ACK real, `applyRecognizedWithdrawal` cambia solo expenses y conserva fixed.
A: `fixedExpenseEligible` rechaza la categoría neutra, `fixedPaymentProof` devuelve null y
`fixedPaymentState(...).paid` pasa a false. B recibe `slimForCloud(after)` (solo metadatos de
cartera/fijos, sin `expenses` ni `bankTx`): la misma prueba durable sigue presente y
`fixedPaymentState(...).paid` sigue true. Resultado observado **paidA=false / paidB=true**,
con una sola escritura remota cat=traspaso y cuentas sin cambiar. El requisito financiero
de coherencia entre dispositivos queda rojo aunque26 tests previos y banco420→420 pasen.

La primera sonda usó «ficticio» en ambos nombres y el matcher acreditó BOOK automáticamente:
se descartó ese montaje antes de ejecutar Retirada. La reproducción válida comprueba primero
que el modelo no se acredita hasta `linkFixedPayment`; no se modificó el motor para forzarla.

Propuesta mínima recomendada, pendiente de decisión de coordinación: impedir Retirada mientras
el cargo sustente una prueba de recibo, usando sus campos reales `paymentProofs`/`expenseId`/
`identity`/`key` y la puerta actual. Explicar que se debe deshacer primero el vínculo desde
la ficha: `linkFixedPayment(..., fixedId=null, ...)` ya elimina esa prueba de los metadatos
compartidos sin tocar dinero. Revalidar la puerta en la aplicación tardía del ACK y bloquear
la confirmación de recibo de esa fila mientras su retirada esté pendiente; no basta esconder
un botón. Así se evita neutralizar un pago todavía compartido y no se introduce otra
escritura no atómica entre expenses y app_state. Sigue pendiente revisar la concurrencia real
entre móviles; una protección solo local no acredita una transacción distribuida.

Alternativa si se decide permitir sustituir el pago por Retirada en una sola acción: tras ACK,
revocar explícitamente la prueba coincidente en `fixed[].paymentProofs` y sincronizar ese cambio
para B sin feed. Puede reutilizar el contrato de deshacer de74; debe cubrir prueba expense y
la vía BOOK que corresponda, sin barrer otros meses/cargos ni tocar paidYm/paidDay o bases.
También exige explicar que se retira la confirmación del recibo. No se implementa ninguna
alternativa bajo el freeze actual.

Reparación77 requerirá guardián Node con A/B sin feed, DOM de las dos puertas y rechazo del
diálogo tardío, es/en/ca si añade aviso, scope transitivo sobre la base75 final, GO y CI nuevos
por SHA. El registro preparado abajo incorpora ahora sus dos puertas adicionales; falta la guardia transitiva de75 final y no se activa todavía.

## Preparación local de integración · 1 de octubre

Rama `codex/inc-2909-03-injerto74`, commit local de implementación
`1922a09ef9df46fefface7ffe9a4e3bb79382e3a`, base Recibos74
`9ecd6a172e1c451016e6b4e102fa7b8e8bdc5359`. Injerto local del runtime `259a0393` y QA
`11a7e3df`; no se modifica ni publica la rama original/PR88. Fuente sigue en 4.26.74:
77 es provisional y la base definitiva debe incluir primero Panel75 y Nómina76.
No se crea aún guion/tanda ni se traslada una versión antigua a las notas. El guion nuevo
deberá declarar su scope tras Panel75. No publicación, Chromium, APK, Edge, SQL ni datos reales.

Conflictos resueltos por función: `ExpenseDetailSheet` conserva `setReceipt` además de la
acción de retirada; el mapa de Gastos conserva `inicio-cargos` y añade retirada. Se mantienen
las entradas documentales de Inicio y Recibos. `08-motor-bank`, `14-v4-screens`, VERSION,
package/lock y las195 notas/guiones históricos permanecen idénticos a la base. Los generados
se reconstruyen con `npm run build`, sin copiar el HTML de la candidata73.

Medición con el algoritmo real de `minify-html.mjs` y gzip9, antes del sellado beta:
base74 raw1.991.264 / min1.274.964 / gzip346.730 B;
injerto raw2.024.697 / min1.280.026 / gzip347.919 B.
Delta min+5.062 / gzip+1.189 B. Tope local min1251 KiB (+5 sobre1246), gzip340 KiB intacto
y tres bloqueantes. Margen gzip241 B: remedir tras Panel75/Nómina76, notas y sellado; este
resultado no acredita el tamaño del árbol definitivo.
El objeto Git del commit local normaliza finales de línea: raw1.997.417 / min1.279.959 /
gzip347.899 B; delta frente al mismo objeto base +6.153/+4.995/+1.169 B. La medida anterior
es la del checkout Windows que usa el guardián local, más conservadora. Ambas ejecutan el
mismo algoritmo de minificación; ninguna incluye aún el sello/versionado definitivo.

Node completo antes de commit:12,7 s, único fallo `memoria-espejo` ajeno. Deno y Chromium
omitidos explícitamente por el encargo. Retirada26/26 y motor de recibos pasan juntos; saldo
real420→420, presupuesto80→0 y efectivo0 se conservan en los tres roles y tras pull B.
El nuevo spec usa el reloj de escenario compartido también en B; los casos de timeout fijan
ese mismo instante antes de avanzar el reloj. No cambia temporizadores de producción.
Este ajuste de fecha de test requiere repetir DOM en el árbol definitivo; el11/11 anterior
corresponde a la candidata aislada. Tras commit se revalida el guardián de VERSION: no se
oculta su rojo esperado porque el bump está aplazado. GO/CI exactos de integración pendientes.

Node completo final sobre `1922a09e`:106 etapas,104 PASS y dos rojos explícitos en12,5 s:
`docs-frescura` falla solo por cuatro módulos cambiados después del último bump (aplazado
por coordinación), y `memoria-espejo` sigue desfasado antes del injerto. El presupuesto pasa
1251/340 KiB, idiomas/seguridad/mapa/sintaxis pasan. No se declara suite verde ni beta publicable.
Log local ignorado `test-results/retirada-injerto74-node-final.log`; no queda plan de un solo uso.

## Candidata original y evidencia conservada

Base `a03a2a06` (Inicio beta 4.26.73). Fuente sin bump final: el coordinador serializa Recibos74,
panel75, nómina y widget antes de esta entrega. No publicada, no aprobada en móvil.

Fuente de implementación `259a0393c088586a083d69c90f19294a565f5072`,
[PR88 en borrador](https://github.com/JuanjoAvila/Aely/pull/88), rama `codex/inc-2909-03-retirada`.
Revisión de Claude solicitada sobre ese SHA; GO todavía no recibido. La PR contra beta no dispara
el workflow Tests de main ni publica beta. Después de commit, `docs-frescura` falla únicamente
«no hay código publicable sin subir VERSION»: el bump sigue aplazado expresamente hasta integración.
No presentar ese rojo como suite verde ni publicar esta fuente73 sobre la beta actual.

## Qué se reprodujo

Con una salida ficticia de CaixaBank de 80 €, categoría Otros y UUID estable, la ficha bloquea
banco, Efectivo y gasto/ingreso con el mismo texto: «El importe lo manda el banco. Si está mal,
cámbialo desde la app del banco». El selector de categoría sí permite Traspaso. DOM sobre la base:
esa reproducción pasa y el guardián de la acción explícita falla porque no existe. Esto identifica
las puertas actuales y su aviso, no cuál pulsó la pareja ni el estado de su movimiento real.

Ejecutando `setExpenseCat` real en Node, tanto una sesión ausente como UPDATE de cero filas resuelven
sin error. El llamante actual cambia la categoría optimistamente y oculta errores. El importador ya
reconoce palabras de cajero en altas nuevas; nombres sin esas palabras y filas históricas pueden
seguir en Otros. No se modifica el clasificador ni se recategoriza historia en masa.

## Cambio acotado

La ficha ofrece «Es una retirada de efectivo» a salidas importadas OB/OB-hist, sin deuda, inversión
o posible duplicado pendientes. La persona confirma ese movimiento concreto. Elegir Traspaso desde
las categorías de esas mismas salidas pasa por la misma confirmación. Se excluye del presupuesto
tras ACK; importe, fecha, comercio, origen, UUID y cuentas se conservan. No se aprende un override
del comercio ni se modifican filas hermanas. Las otras recategorizaciones siguen su contrato previo.

`confirmExpenseWithdrawal` lee exclusivamente el UUID del usuario, comprueba atributos y origen,
y cambia solo `cat`. UPDATE compara todos los campos leídos y exige RETURNING de exactamente una
fila con la misma identidad y categoría Traspaso. Si ya estaba neutra se reconoce sin otra escritura.
UUID divergente, ausencia de sesión, error, conflicto o cero filas dejan el cliente sin confirmar:
no busca gemelos por parecido ni adopta UUID nuevos. A los diez segundos comunica que el cambio
no está confirmado; un commit tardío puede aparecer al sincronizar y no implica suma de efectivo.

Una lectura de gastos iniciada antes del ACK no devuelve la categoría antigua sobre esta corrección
local. El sello `withdrawalConfirmedAt` es local; las lecturas posteriores sí aceptan la categoría
del servidor, incluida una decisión nueva de otro móvil. No es una cola offline ni una revisión
general de FIN-04.

La oferta de sumar efectivo al importar se retira: su antigua llamada a `applyEntradaEfectivo` no
tenía una marca compartida ni un ACK atómico entre `expenses` y `app_state`. La ficha y el control
Efectivo explican la no operación. La retirada importada no suma ni resta saldos; las entradas y
retiradas manuales de Cartera mantienen sus puertas. Se eliminan solo las doce claves es/en/ca de
la oferta retirada. No se despliegan Edge, SQL, migraciones, APK ni datos familiares.

## Pruebas y límites

`tests/retirada-bancaria.test.mjs`: 26 casos con método cloud real, incluidos ACK, UPDATE cero,
sesión, UUID divergente, CAS de categoría y campos bancarios, reintento tras commit, dos clientes,
recarga, doble importación y pull anterior/posterior. Registrado en el runner.
QA adicional de saldo mostrado (1/10): tres casos, roles `fijos`/`diario`/`ambos`, parten de
base bancaria 500 € y saldo CLBD 420 € con una retirada BOOK de 80 € ya existente. Ejecutan
`applyBankBalances`, `insumosSaldoGasto` y `saldoCuentaMostrada`, la fórmula real de Cartera,
antes y después del ACK: presupuesto 80→0 y banco 420→420, nunca 500 €. Una segunda lectura
del mismo saldo, importación duplicada y pull independiente de B conservan ese resultado,
UUID, importe, origen y transacción BOOK. Efectivo permanece en cero y no nace otra cuenta OB:
sin registro explícito de efectivo no se inventan los 80 € en patrimonio.
Los campos reales comprobados son `bankIban`, `balSaldo`, `balTipo`, `bankTx` y `obAccounts`;
`bankTxSnapshot` y `_balanceAsOf` no existen en esta fuente ni en Recibos `74d85bc3`, confirmado
por coordinación. No se usan propiedades ignoradas como prueba. Esta ampliación cambia solo
test/documentación, no el runtime `259a0393`. Retirada26, rol-cuenta-sin-salto10 y saldo-por-banco9
pasan en Node; el nuevo guardián de saldo no se ha ejecutado aún en DOM integrado.
`e2e/retirada-bancaria.spec.mjs` se registra bajo Gastos: confirmación/cancelación, DOM es/en/ca,
presupuesto 80→0, origen conservado, recarga, dispositivo B con almacenamiento independiente y
sincronización a demanda, más errores y timeout. Supabase es un doble; no acredita permisos reales.

RLS/UPDATE/RETURNING reales no se han auditado. Si el servidor no permite confirmar la escritura,
la interfaz conserva la categoría y explica que no está confirmada. Un importado con UUID local
divergente puede seguir necesitando la futura resolución de identidad FIN-04; sincronizar por sí
solo no remapea ese UUID. No se declara resuelto el caso familiar ni la contabilidad de efectivo
entre dispositivos. Sigue pendiente la prueba real y el OK específico antes de main.

Ejecución final enfocada: **11/11 DOM PASS, 52,6 s** (retirada10 + efectivo manual1), en un solo
worker. B usa otro contexto con almacenamiento independiente y pulsa Sincronizar. El primer doble
no respetaba `lt(id,cursor)` y devolvía la misma página: FIN-07 abortaba correctamente. Se corrigió
el fixture y se repitió la suite; no se retocó producción para conseguir ese verde.
Runner Node completo final (13,2 s): único fallo ajeno `memoria-espejo`; la pasada anterior detectó
además el presupuesto rebasado antes del ajuste medido. Presupuesto ya revalidado con topes locales
ajustados; Deno local no instalado y omitido.
Antes de publicar hace falta bump final, notas/guion en JSON, suite completa sobre el árbol integrado,
CI, GO por SHA y comprobación de artefactos. La primera pasada de frescura antes de commit no prueba
el bump de esta candidata; está aplazado expresamente por coordinación.

## Textos preparados para la integración

Notas de versión es: «Las retiradas del banco pueden marcarse como traspasos sin contar como gasto.
La ficha distingue los datos del banco de la categoría y avisa si no puede confirmar el cambio.»
en: «Bank withdrawals can be marked as transfers without counting as spending. The detail view
distinguishes bank data from the category and warns when a change cannot be confirmed.»
ca: «Les retirades del banc es poden marcar com a traspassos sense comptar com a despesa. La fitxa
distingeix les dades del banc de la categoria i avisa si no pot confirmar el canvi.»

Guion beta: abrir una salida importada, comprobar banco/importe bloqueados y categoría corregible;
cancelar «Es una retirada» y comprobar que no cambia; confirmar y comprobar Traspaso, gasto excluido
y cuentas intactas; recargar/sincronizar y comprobar una sola fila; con otro móvil comprobar la
categoría confirmada. Efectivo debe explicar que no suma dinero en este recorrido. Fallo de red o
identidad no puede anunciar guardado. No editar movimientos reales para fabricar la prueba.

## Coordinación y tamaño

No integrar cambios de Recibos ni pisar su contrato. Esta candidata toca el comienzo de `setCat`,
las propiedades de `ExpenseDetailSheet`, metadatos y pie de ficha de Gastos; Recibos74 toca la
conciliación de fijos/cuotas y puede producir conflictos cercanos. Resolver por función, no con
`-X theirs`. Versión, notas, presupuestos, CI y publicación finales corresponden al árbol integrado,
no a la base 4.26.73. La suite completa requiere otra ventana Chromium, coordinada.

Medición del delta aislado con el mismo minificador y gzip9: base1.263.265/343.945 B;
candidata1.268.327/345.157 B, delta+5.062/+1.212 B. Topes locales1.240/338 KiB (+5/2),
sin aumentar los tres bloqueantes. Recibos/panel tienen su propio crecimiento: este límite no
afirma que el árbol integrado quepa. No recortar guardas ni idiomas para ocultar ese coste.

## Scope y guion preparados tras Panel75 · sin activar

Inspeccionado Panel75 exacto `6b9c90c9997380c0e32d56eaedac04629cfa83bc` (PR94). El número77 y la
base76 siguen pendientes. Este bloque se incorporará a `scripts/beta-sources.json` solo
al integrar sobre76; no se añade ese registro ni una nota activa a la rama74.
Tanda nueva `inc-2909-03-retirada`, solo `web`, sin alias de aprobación anterior ni
recibos de Android/Edge. No se ensanchan los scopes existentes de Inicio, Recibos o panel.

El scope cubre UUID/origen, lectura+CAS+RETURNING, protección de escritura en modo pruebas,
aplicación local, pull anterior/posterior, neutralidad presupuesto/caja, saldo mostrado,
acción/categoría/metadatos/pie de ficha y mensajes es/en/ca. Incluye las fórmulas de dinero
que justifican420→420 y80→0, sin tomar archivos completos ni la implementación de Recibos.
La zona de importación incluye el hueco donde se retiró la oferta de sumar efectivo: si
reaparece ahí, cambia la revisión. No se declara cierre automático del grafo de dependencias.

Validación enfocada con `betaRevision` REAL extraído de Panel75 (sin integrar ese código):
24 bloques inequívocos en la propuesta inicial (antes de la reparación de recibos); mutaciones independientes de ACK, UUID, neutro y render cambian
el digest; cambios ajenos en mcBetaLog y setReceipt no lo cambian; CRLF lo conserva.
Hash web provisional original del injerto74 (anterior a este bloqueo) `b688698638d06b1d02892d7ede23abbdd7cf63558e4a7757d66c04ad858a1e89`; NO fijarlo manualmente en las notas.
El build de76/77 debe volver a derivar codigo/web y recibo de entrega de la fuente final.

Registro preparado:

```json
{
  "inc-2909-03-retirada": {
    "web": [
      {
        "file": "src/modules/00-core.js",
        "from": "    async confirmExpenseWithdrawal(",
        "to": "    async setExpenseDeuda("
      },
      {
        "file": "src/modules/00-core.js",
        "from": "\"confirmExpenseWithdrawal\"",
        "to": "\"setExpenseDeuda\""
      },
      {
        "file": "src/modules/00-core.js",
        "from": "function isExpenseUuid(",
        "to": "function mcExpenseId("
      },
      {
        "file": "src/modules/00-core.js",
        "from": "function expenseSourceForCloud(",
        "to": "/* ---------- Token aleatorio"
      },
      {
        "file": "src/modules/00-core.js",
        "from": "function withdrawalReceiptLink(",
        "to": "/* EFECTIVO REAL DE TRADE REPUBLIC"
      },
      {
        "file": "src/modules/00-core.js",
        "from": "function refreshExpenseFromCloud(",
        "to": "function validCloudState("
      },
      {
        "file": "src/modules/00-core.js",
        "from": "const CAT_NEUTRAS =",
        "to": "const catOf ="
      },
      {
        "file": "src/modules/00-core.js",
        "from": "function gastoDelMesPorBanco(",
        "to": "/* ============================================================\n   ¿QUÉ MARCA"
      },
      {
        "file": "src/modules/00-core.js",
        "from": "function saldoCuentaGasto(",
        "to": "function ensureEfectivoAccount("
      },
      {
        "file": "src/modules/01-i18n.js",
        "from": "function expenseCountsCash(",
        "to": "/* EN QUÉ CAJÓN"
      },
      {
        "file": "src/modules/01-i18n.js",
        "from": "function insumosSaldoGasto(",
        "to": "function applyAccountRole("
      },
      {
        "file": "src/modules/01-i18n.js",
        "from": "    f_trace_missing:\"— texto original no disponible\",",
        "to": "    f_fx_eq:"
      },
      {
        "file": "src/modules/01-i18n.js",
        "from": "    f_trace_missing:\"— original text unavailable\",",
        "to": "    f_fx_eq:"
      },
      {
        "file": "src/modules/01-i18n.js",
        "from": "    f_trace_missing:\"— text original no disponible\",",
        "to": "    f_fx_eq:"
      },
      {
        "file": "src/modules/08-motor-bank.js",
        "from": "function applyBankBalances(",
        "to": "function bankPendingEvents("
      },
      {
        "file": "src/modules/08-motor-bank.js",
        "from": "function monthBudgetStats(",
        "to": "function dashboardBudgetStats("
      },
      {
        "file": "src/modules/04-tab-gastos.js",
        "from": "  const withdrawalPending=useRef({});",
        "to": "    const mkey=catKey(ex.merchant);"
      },
      {
        "file": "src/modules/04-tab-gastos.js",
        "from": "      setCat:setCat, setCuota:setCuota,",
        "to": "      showToast:showToast, aiBusy:"
      },
      {
        "file": "src/modules/04-tab-gastos.js",
        "from": "function ExpenseDetailSheet(",
        "to": "  /* UNA SOLA CONDICIÓN"
      },
      {
        "file": "src/modules/04-tab-gastos.js",
        "from": "    {id:\"cash\",testId:\"exp-efectivo\"",
        "to": "    {id:\"date\",testId:\"exp-date\""
      },
      {
        "file": "src/modules/04-tab-gastos.js",
        "from": "    canRecognizeWithdrawal(exp) &&",
        "to": "  const debtOptions="
      },
      {
        "file": "src/modules/04-tab-gastos.js",
        "from": "  const footer=React.createElement(\"div\",{className:\"v4-ficha-foot\"},",
        "to": "  const main=ReactDOM.createPortal("
      },
      {
        "file": "src/modules/11-app-main.js",
        "from": "  const syncCloudExpenses=function(){",
        "to": "  const syncFromCloud=function("
      },
      {
        "file": "src/modules/11-app-main.js",
        "from": "      if(obAdded.length && !opts.manual)",
        "to": "      // Resultado por banco"
      },
      {
        "file": "src/modules/04-tab-gastos.js",
        "from": "  const setReceipt=function(",
        "to": "  // Marca/desmarca un gasto"
      },
      {
        "file": "src/modules/04-tab-gastos.js",
        "from": "  const receiptLinked=",
        "to": "  const receiptOptions="
      }
    ]
  }
}
```

Guion de prueba es/en/ca (sin tecnicismos; no atribuye éxito sin ACK):

```json
{
  "v": "4.26.77",
  "d": "2026-10-01",
  "t": {
    "es": "Corregir una retirada del banco",
    "en": "Correct a bank withdrawal",
    "ca": "Corregir una retirada del banc"
  },
  "items": {
    "es": [
      "Las retiradas del banco pueden marcarse como traspasos sin contar como gasto. La ficha avisa si no puede confirmar el cambio.",
      "No se añade efectivo desde una retirada bancaria; los apuntes manuales siguen disponibles en Cartera.",
      "Para marcar como retirada un cargo que paga un recibo, primero hay que deshacer ese vínculo desde la ficha."
    ],
    "en": [
      "Bank withdrawals can be marked as transfers without counting as spending. The detail view warns when the change cannot be confirmed.",
      "A bank withdrawal does not add cash; manual cash entries remain available in Portfolio.",
      "Before marking a charge that pays a bill as a withdrawal, its link must be undone from the detail view."
    ],
    "ca": [
      "Les retirades del banc es poden marcar com a traspassos sense comptar com a despesa. La fitxa avisa si no pot confirmar el canvi.",
      "Una retirada bancària no afegeix efectiu; els apunts manuals continuen disponibles a Cartera.",
      "Per marcar com a retirada un càrrec que paga un rebut, primer cal desfer aquest vincle des de la fitxa."
    ]
  },
  "tandas": [
    {
      "id": "inc-2909-03-retirada",
      "t": {
        "es": "Retiradas y presupuesto",
        "en": "Withdrawals and budget",
        "ca": "Retirades i pressupost"
      },
      "items": {
        "es": [
          "1. En Gastos, abre la retirada del banco que necesitas corregir. El importe y la cuenta siguen fijados por el banco; la categoría se puede corregir. Toca Es una retirada de efectivo y cancela: nada debe cambiar.",
          "2. Confirma la retirada: debe quedar en Traspaso y salir del gasto presupuestado. Conserva una sola fila con el mismo importe y banco. No aumenta el saldo del banco ni Efectivo; tocar Efectivo explica el límite.",
          "3. Reabre y sincroniza los movimientos. La retirada confirmada debe seguir una sola vez y sin sumar efectivo, también en otro móvil al sincronizar.",
          "4. Si no puede confirmar el cambio, la ficha debe avisar y no anunciar Guardado. Tras sincronizar, revisa la categoría antes de reintentar.",
          "5. Si el movimiento está vinculado a un recibo, Retirada debe estar bloqueada y explicar el motivo. Deshaz primero el vínculo en Paga un recibo: el recibo deja de estar confirmado también en otro móvil al sincronizar; después se habilita Retirada."
        ],
        "en": [
          "1. In Expenses, open the bank withdrawal you need to correct. The bank still sets its amount and account; the category can be corrected. Tap This is a cash withdrawal and cancel: nothing should change.",
          "2. Confirm the withdrawal: it should be marked as Transfer and excluded from budget spending. Keep one row with the same amount and bank. Bank balance and Cash must not increase; tapping Cash explains the limit.",
          "3. Reopen and sync transactions. The confirmed withdrawal should remain once without adding cash, including on another phone after syncing.",
          "4. If the change cannot be confirmed, the detail view should warn you and must not say Saved. After syncing, check the category before trying again.",
          "5. If the transaction is linked to a bill, Withdrawal must be blocked and explain why. First undo its link in Pays a bill: the bill becomes unconfirmed on another phone after syncing; Withdrawal is then enabled."
        ],
        "ca": [
          "1. A Despeses, obre la retirada del banc que necessites corregir. El banc continua fixant l'import i el compte; la categoria es pot corregir. Toca És una retirada d'efectiu i cancel·la: no ha de canviar res.",
          "2. Confirma la retirada: ha de quedar a Traspàs i sortir de la despesa pressupostada. Conserva una sola fila amb el mateix import i banc. No augmenta el saldo del banc ni Efectiu; tocar Efectiu explica el límit.",
          "3. Reobre i sincronitza els moviments. La retirada confirmada ha de continuar una sola vegada i sense sumar efectiu, també en un altre mòbil en sincronitzar.",
          "4. Si no pot confirmar el canvi, la fitxa ha d'avisar i no anunciar Desat. Després de sincronitzar, revisa la categoria abans de tornar-ho a provar.",
          "5. Si el moviment està vinculat a un rebut, Retirada ha d’estar bloquejada i explicar el motiu. Desfés primer el vincle a Paga un rebut: el rebut deixa d’estar confirmat també en un altre mòbil en sincronitzar; després s’habilita Retirada."
        ]
      }
    }
  ]
}
```

Antes de activar: injertar solo el delta sobre76, conservar notas/tandas/historial de75/76,
derivar las nuevas revisiones con build y comprobar que no se inventan alias/aceptaciones.
Repetir DOM es/en/ca (incluido B y reloj de escenario), Node completo, tamaño sellado y GO/CI
por SHA final. El77 es provisional: ajustar fecha/versión solo al decidir el coordinador.
