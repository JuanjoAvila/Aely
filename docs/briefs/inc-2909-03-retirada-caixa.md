# INC-2909-03 · retirada bancaria · candidata aislada

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
