Widget80 sobre79: `widget-banco.spec.mjs` ya mapeado añade es/en/ca para el pull antiguo en la frontera ACK de retirada: Inicio/widget100, sin gasto180 ni ACK inventado. Date fijo durante esa comparación vuelve a avanzar antes del splash. Quitar readStartedAt hace fallar el DOM real. `revisar-beta` prueba cinco cambios web/nativos y entrega exacta APK52; cuatro casos tardíos de `retirada-bancaria` respaldan Novedades79.13 DOM PASS en pases finales, sin repetir matriz34. Java real/109 etapas de lógica/límites en [acta](briefs/inc-2909-01-widget.md); no sustituye CI ni pago real.

INC-2909-02: `inicio-mes-natural.spec.mjs`, mapeado a Inicio, prueba es/en/ca, ajuste real, recarga, bruto mensual, neto del ciclo, reservas, bancos y límites. `month-budget-stats` ejecuta Pregúntame y reto con las mismas compras; `budget-notis-deps` ejecuta el efecto real: agotamiento, no repetición y reinicio al cobrar. Prueba móvil pendiente; CI y publicación se registran en el [brief](briefs/inc-2909-02-inicio-natural.md).

## INC-3009-02 · nómina pendiente/futura

`ob-ingresos` continúa en steps, reloj fijo y dos subprocesos UTC/Madrid. `--zone-child` permite
comprobar directamente otras zonas; no basta cambiar solo TZ exterior. Guardia BOOK/ausente,
fecha válida no futura Madrid, PDNG→BOOK, UUID, manual genérico, banco+id y saldos sintéticos
400→2200 sin duplicar1800. DOM `nomina-anticipada.spec.mjs` registrado en el mapa del motor:
Inicio/Gastos/Cartera en es/en/ca, transportes simulados y sync App real; lease obligatorio.
En el injerto sobre Panel75 conserva el contrato bruto de Inicio73 y neto de Gastos en mes natural.
Los 84 contratos/18 DOM previos pertenecen a aaa95803; la nueva integración exige resultados
propios. [Evidencia y límites](briefs/inc-3009-nomina-anticipada.md).


INC-2709-01 (beta 4.26.69.1): `e2e/inicio-offline.spec.mjs` retrasa sesión y evento de autenticación seis segundos con CPU ×6 y estado local sintético. Antes de corregir, el caso nuevo fallaba al detectar barras grises tras el splash; ahora exige el hero visible sin ese intervalo y que la nube tardía actualice la cifra. Los casos previos cubren offline conocido, evento `mc-boot-ready` ausente y nube lenta. [Action 36617933780](https://github.com/JuanjoAvila/Aely/actions/runs/36617933780) pasó la suite completa; la prueba en Android con red débil sigue pendiente y es necesaria para aceptar la tanda.

OPS-02 (beta 4.26.56.1): `tests/backup-snapshot.test.mjs` contiene 23 guardianes del
validador/comparador, registrado en run-tests. `e2e/backup-restauracion.spec.mjs` contiene once
casos DOM del visor aislado, ambas claves intactas, cero escrituras financieras atribuibles,
UUID/campos/sumas, pull/reinicio/B, corrupción, transporte y tres idiomas. El doble mutable
`e2e/ops02-backup-cloud.mjs` ejecuta App/cloud reales con red externa bloqueada; no demuestra
SQL/RLS. La caracterización anterior vive en SHA `bc2fa093`. Registrado para módulo 10;
00/11 exigen suite completa. [Contrato, resultados y límites](briefs/ops02-restauracion-probada.md).

Widget banco (4.26.50): `e2e/widget-banco.spec.mjs` abre Ajustes y cambia el banco con saldo idéntico, verifica el payload nativo y persistencia tras recarga, suma de cuentas sin opciones repetidas y retirada del banco elegido. Registrado para el módulo 10; el módulo 11 obliga a suite completa.

# Testing — Aely

Integración UI (candidata 4.26.77): `cyber-fab.spec.mjs` está en CROSSCUTTING y compara píxeles del botón con la corriente visible/oculta en cuatro pestañas y tres anchos; para que la igualdad exacta de PNG mida la corriente y no el tramado del degradado, pinta el botón con un color opaco del tema y aquieta su aro, sin tocar forma, geometría ni z-index; oculta la barra por clase, sin acreditar inercia real. `help-preguntar-borde.spec.mjs` está mapeado al módulo16 y mide el hueco en es/en/ca, letra normal/enorme, zona segura y visualViewport simulado; no envía preguntas ni acredita teclado Android. `perfil-filas-vacias.spec.mjs` está mapeado al módulo14 y compara alturas por contenido, alineación y apertura de diálogo en es/en/ca y tres tamaños. El guardián beta-sources muta reglas y lectores reales; los tres guiones viven ya en la nota 4.26.77 como tandas separadas. [Acta](briefs/ui-77-integracion.md).

Reloj de fixtures: `cuotas-deudas`, `invest-category`, `saldo-por-banco` y `rol-cuenta-sin-salto` fijan Date al15/9/2026 mediodía con `node:test`, tanto para la app como para sus filas. CI36783613129 falló al cruzar octubre en Madrid mientras UTC seguía en septiembre; el mismo fallo se reprodujo con el motor de main12884f48. Las aserciones financieras se mantienen: cuatro suites pasan en UTC, Europe/Madrid, America/New_York y Asia/Tokyo. Los casos de frontera horaria pertenecen a `month-window`; no se cambia la zona global de CI ni el calendario de producción.

CI36784280322 superó Node y Deno,24 DOM propios de recibos y7 de rendimiento, pero30 casos antiguos fallaron al quedar sus fechas fuera del mes visible. Doce suites de listas optan por `FIXTURE_NOW` y `installFixtureClock`: Node siembra26/9/2026 mediodía UTC y la página aplica solo un offset a Date que avanza con el tiempo real. Conserva temporizadores, RAF, performance y timestamps nativos; no hay zona global ni cambio del reloj de las suites ajenas. Los casos con reloj Playwright llevan anotación own-clock y omiten el helper; septiembre→octubre en persistencia declara Europe/Madrid solo en su contexto. Se mantienen todas las aserciones de dinero. Dos rojos originales UTC reproducidos (cajones sin filas y anillo vacío) antes de comprobar103 casos afectados. Resultado final en el brief.

La integración3e131175 falló CI36790554645 en bank-merchant-category (537 DOM verdes,1 fallo,1 skip previo y7/7 rendimiento). Esta prueba de beta usa ahora el mismo FIXTURE_NOW en su mapper y el helper Date en la página; se conservan sus nueve líneas de aserción y los cinco movimientos. La verificación DOM se ejecutará en el navegador remoto de la CI nueva; no se modifica la categorización bancaria.

INC-3009-01: `fixed-payment-state` está registrado en el runner y prueba pago BOOK, calendario, estados pendientes/ausentes, fechas futuras, varios candidatos, bancos, bruto compartido, importes por ocurrencia, confirmación persistida y ausencia de mutaciones. `inicio-cargos.spec.mjs`, mapeado a Inicio, Plan y Gastos, reproduce con datos ficticios el gas confirmado que seguía visible, distingue vencido sin acreditación, PDNG y recarga en es/en/ca. La corrección añade agua variable32,40/35,10 frente a32 y divisa18,15 frente a18: el diálogo muestra cargo real y previsto, la confirmación humana de pago completo no modifica el modelo ni vuelve a descontar. 24 DOM finales pasan, incluido renombrado real, segundo dispositivo sin feed y compartido42 bruto/21 propio con cargo44. Las fixtures de pago de Plan declaran confirmación explícita; un día pasado no acredita un pago. Las proyecciones de saldo conservan su contrato anterior. [Límites](briefs/inc-3009-01-cargos.md).

INC-2709-02 (beta 4.26.70.1): `e2e/deudas-archivo.spec.mjs` está registrado para `09-tab-debts-goals.js` en `E2E_MAP`. Con deudas y cuotas sintéticas abre Plan → Deudas, exige que un saldo proyectado cero pida confirmación, comprueba cancelación, liquidación, archivo, recarga, cuota antigua visible en Gastos y vuelta a mostrar. También cubre la amortización total sin crear gasto, borrado bloqueado con cuota vinculada, saldo positivo corregido desde otro dispositivo e inglés/catalán; 6/6 locales y [suite beta 36624037785](https://github.com/JuanjoAvila/Aely/actions/runs/36624037785) SUCCESS con 488 E2E funcionales y 7 de rendimiento. `i18n-keys` comprueba las nuevas claves en es/en/ca. El archivo conserva `debtId`; no se interpreta una proyección como pago real ni se prueba con movimientos familiares.

INC-2809-02 (4.26.68): `e2e/gastos-ayuda-ciclo.spec.mjs`, registrado con `04-tab-gastos.js` en
`E2E_MAP`, abre Gastos en es/en/ca y comprueba que la ayuda de Mi ciclo se pliega, conserva visible
el cobro, persiste tras salir y recargar y vuelve a abrirse. También cubre el aviso sin nómina y
el filtro Mi ciclo sin presupuesto por cobro. Usa solo datos ficticios; falta la prueba móvil.

Presupuesto por cobro real (candidata 4.26.64): `tests/month-budget-stats.test.mjs` fija el reloj antes y después del día 26; exige que 600 € anteriores pasen de 400 € restantes a presupuesto íntegro tras el cobro, que el día 1 siguiente no reinicie el ciclo, que la propia nómina no infle el modo Balance y que los informes explícitos sigan por mes natural. Protege además los NO-GO de Claude a `a9bc9f30` y `79333169`: traspaso, inversión o Bizum posterior no mueven el ancla; un flujo modelado no convierte cualquier transferencia en nómina; un traspaso llamado «Nómina» sigue neutro; una nómina presente solo en el concepto bancario se reconoce; un apunte futuro conserva la misma cifra mensual en Inicio y widget. Las dos mutaciones de Claude sobre emparejado de flujo y exclusión neutra desplazan el ancla al 27 y rompen las aserciones de día 26. `e2e/presupuesto-fluido.spec.mjs` abre Inicio, Gastos, Mi ciclo y Ajustes con datos ficticios, comprueba el cobro que ancla la vista pese a movimientos posteriores, el ajuste reversible y el filtro inicial de ambos modos. El widget sigue mensual con el ajuste activo; la prueba real debe verificar que el ingreso elegido para el ciclo es la nómina correcta.

En 4.26.65, la regresión de `tests/month-budget-stats.test.mjs` fija cena 100 €, Bizum 80 € en otro banco, nómina ancla, traspaso, posible duplicado, apunte futuro y gasto en banco no diario: Mi ciclo debe consumir 20 € y dejar 980 € de un límite de 1.000 €; alquiler, trabajo extra y devolución de fijos sí aumentan el balance, y un Bizum mayor que la compra puede ampliar el margen por decisión del dueño. El mes natural mantiene el modo Gastos. `e2e/presupuesto-fluido.spec.mjs` comprueba en pantalla la cabecera, el desglose, el margen y la barra, tanto con 100/80 como con alquiler cobrado. La comprobación móvil debe confirmar una devolución real y que el cobro reconocido es la nómina correcta.

INC-2709-05: el dueño rechazó primero el texto con signo negativo y frase larga, y después el texto «Balance en contra». La 4.26.64 restauró en Inicio la frase «Has gastado» anterior a 1e2b9692, con el gasto bruto real y mantiene «del mes» en el anillo. e2e/presupuesto-fluido.spec.mjs prueba la frase restaurada en es/en/ca, el déficit sin «Balance en contra» y los importes de Gastos. La beta 4.26.64.1 fue verificada y el dueño aprobó su aspecto. El abono adelantado de Plan conserva su guardián separado en tests/plan-charges.test.mjs.

TR clasificación (candidato 4.26.53): `tests/bank-merchant-category.test.mjs` ejecuta mapper TS real, diario e histórico con datos ficticios; cubre MCC conocidos/desconocidos, concepto separado de código bancario (Card transaction no es Action), transferencias/recibos excluidos, decisiones personales Otros, ingresos/aportes/cajero, identidad, lápidas y no recategorización. Registrado en run-tests. `e2e/bank-merchant-category.spec.mjs` usa respuesta del mapper real, dispara sincronización explícita, abre Gastos y comprueba categorías/notas, histórico renombrado y repetición. Registrado en CROSSCUTTING. No demuestra que TR real entregue MCC/concepto; falta comprobarlo tras despliegue autorizado.

REC-GUARDADO-01 (4.26.48): `e2e/plan-gestionar.spec.mjs`, ya registrado para el módulo 14 en
`scripts/relevant-tests.mjs`, recorre el alta real de recibo, cargo puntual e ingreso en
es/en/ca. Exige una confirmación visible con tipo y nombre tras cerrar la hoja y una sola fila
guardada. La primera compilación beta 4.26.48.1 pasó en
[Actions](https://github.com/JuanjoAvila/Aely/actions/runs/36183635059); el dueño la aprobó y
la promoción [36185465579](https://github.com/JuanjoAvila/Aely/actions/runs/36185465579)
publicó 4.26.48. El cambio es web/OTA y usa la APK 48.

La beta 4.26.32 comparte `useEdgePageClose` entre Inversiones y Plan → Gestionar. Los casos de
`cartera-inversiones` y `plan-gestionar` simulan progreso/cancelación/invocación nativos, un segundo
intento después del rebote y el arrastre desde el centro; también protegen el scroll vertical y
movimiento reducido. `plan-gestionar` comprueba iconos por tipo sin logos bancarios, que `Listo`
persiste antes de cerrar y que un doble toque solo crea un recibo. El callback Java se compila con
API 34 y la prueba real del borde requiere APK 48 en Android compatible.

La beta 4.26.26 aísla el punto 8. `e2e/presupuesto-fluido.spec.mjs` abre el editor desde la tarjeta
real de Inicio, exige una entrada de al menos 400 ms, limita la cifra a 42 px, comprueba que Guardar
conserva la hoja durante la salida y que el presupuesto persiste. Un segundo caso activa movimiento
reducido y exige cierre inmediato. El spec está mapeado a Inicio y Gastos en
`scripts/relevant-tests.mjs`.

Sin candados (feedback 18/9, punto 14): `tests/no-lock-icons.test.mjs` falla si vuelve un 🔒/🔓/🔐
a `src/modules` o `shell.html`. También falla si reaparece el recorte «hasta el primer espacio» del
texto de huella, que sin emoji se comería el verbo. `e2e/sin-candados.spec.mjs` abre Ajustes → Tu
cuenta y Privacidad y comprueba lo pintado. `cartera-ficha-cuenta` y `listas-render` comprueban que
la cuenta conectada y el banner de reconectar siguen protegidos, pero sin el icono.

Ajustes 4.26.11: el nuevo caso de `e2e/swipe-pestanas.spec.mjs` arrastra despacio desde Inicio
y mide por CDP que el primer fotograma del cajón avance menos de 12 px; también comprueba que
termine abriéndose. `revisar-beta.spec.mjs` exige solo el veredicto de Ajustes después de la
aprobación y publicación de temas, sin resucitar los 28 pasos antiguos. No requiere APK nueva.

Apariencia 4.26.10: `e2e/apariencia-temas.spec.mjs` pinta Cyberpunk de verdad y comprueba que el
dinero conserva verde/rojo y que el tema persiste tras recargar. También cubre que «Reducir
animaciones» apaga todo lo que se mueve y las temáticas Otoño y Primavera (tinte, ambientación y
persistencia). Va en CROSSCUTTING porque lo pueden romper `shell.html` o Ajustes, no una sola
pantalla. `revisar-beta.spec.mjs` comprueba que el veredicto ya recibido de la 4.26.9.1 no
reactiva las nueve checklists antiguas: Novedades conserva el histórico, pero el panel ya no pide
los cinco pasos de temas aprobados. El gesto de Ajustes conserva su tanda propia; el retoque de
importes/anillo tendrá otra tanda y pruebas propias.

Plan v4.1 (4.26.8): `tests/plan-charges.test.mjs` protege la fuente única de cargos con euros
pagados/pendientes, varias cuentas, deudas sin día y saldos ausentes o negativos. Está registrado
en `scripts/run-tests.mjs`. `e2e/plan-cover.spec.mjs` abre la pantalla real y cubre el anillo, la
cuenta con menor margen, estados honestos, modo simple, entrada fría desde Ajustes y los diálogos
de recibos. Teclea cadenas completas con `pressSequentially` para impedir que un rerender vuelva a
robar el foco al título. El spec está en `scripts/relevant-tests.mjs`; `plan-gestionar` conserva el
flujo histórico de alta/edición y ambos se ejecutan al tocar Plan.

Lectura bancaria 4.25.4: `tests/bank-sync-paging.test.mjs` ejecuta el handler real con BD y proveedor
simulados (sin consultar bancos): páginas vacías, fallback de periodo, fallo parcial, cursor cíclico,
cuentas inactivas, aislamiento, timeout y topes. Registrado en `run-tests.mjs` y `STEPS_SUPABASE`;
el recorte de un cambio solo de servidor conserva paginado y `tr-open-banking` sin Chromium.
`e2e/bancos-historico-filtro.spec.mjs` comprueba la selección previa, avisos visibles y que un banco
no esconda las filas recibidas de otro. `e2e/sync-resumen.spec.mjs` impide que los resultados mixtos
vuelvan a concatenarse en un toast gigante. Los e2e de barra fuerzan además un repintado React con
el host de scroll activo: la ola debe conservar sus clases después del render, no solo antes.
Desde 4.25.5 recorren también el fondo incremental real de Gastos, comprueban que la caja oculta
no quede por debajo del viewport y reproducen la deriva lateral del pulgar que antes convertía el
segundo tirón en un cambio de pestaña y hacía reaparecer la barra. Desde 4.26.24 distinguen esa
diagonal de un gesto horizontal deliberado: el primero conserva la ola y el segundo cambia de
pestaña sin obligar a subir antes. También verifican que Gastos y Ajustes conserven `overflow`
desplazable sin dibujar la barra lateral.
`tests/tr-open-banking.test.mjs` protege contra el antiguo corte global de 150 movimientos.

## Tiempos y preparación de Novedades

`npm test` conserva los casos seleccionados por el plan y escribe las duraciones de cada etapa
en `test-results/runner-times.json`. Playwright escribe resultados, reintentos y duraciones por
prueba en `test-results/playwright.json`; un `--reporter` explícito sustituye esa configuración.
Son resultados locales ignorados por Git. Comparar el mismo conjunto de casos, navegador,
trabajadores y zona horaria con la máquina libre; no comparar una pasada aislada con otra
que compite con las suites de otros agentes.

`seedLoggedInDashboard` marca Novedades como vistas en `dev`. Para probar otra situación,
usar `__seenVersion` (versión base, o una anterior si debe salir el aviso). `dismissNews` solo
evita la espera cuando el valor inicial del fixture coincide con `mcVerBase(CONFIG.APP_VERSION)`
del navegador y no hay panel. En los demás casos mantiene la espera y el cierre de siempre.
`fixtures-news.spec.mjs` vigila que no aparezca un popup después de esa salida rápida y que
el aviso tardío siga cerrándose, también con una versión beta con sufijo.

El ajuste de fixtures de `banco-espera-nube` mantiene una cadena Supabase por consulta;
ambas regresiones están registradas en `CROSSCUTTING`.

El runner ejecuta `rendimiento.spec.mjs` y `rendimiento-tabs.spec.mjs` después de los demás
e2e, con un trabajador y sin cambiar umbrales. La CPU frenada no debe competir con pruebas
funcionales: dos completas midieron 108/109 ms en scroll→swipe mientras el caso aislado pasaba.
El plan conserva sus mismos specs; el informe combinado incluye ambas fases. Los informes y
artefactos separados viven en `test-results/playwright-e2e*` y `test-results/playwright-perf*`.
Para medir directamente con Playwright, seleccionar solo esos specs y `--workers=1`.
Un fallo de `playwright-perf` mantiene la suite roja: los umbrales siguen siendo obligatorios.

Auditoría 4.19.14: `e2e/revisar-beta.spec.mjs` comprueba plegado automático al aprobar,
desplegar/cambiar de opinión y conservación entre compilaciones. `e2e/bancos-historico-filtro.spec.mjs`
actualiza el estado durante la confirmación de Deshacer y simula fallo/reintento del DELETE.
Ambos ya están en el mapa de pruebas. `expense-id-cloud` ejecuta el método de borrado con sesión
ausente, comprueba filtros por dueño/uuid y propagación de errores. No usa datos ni servicios reales.
4.19.15–17: `tests/efectivo-cierre.test.mjs` (13 casos) cubre el cierre de mes por cuenta —
efectivo, otros bancos y round-up— y `tests/hist-pagos-mensuales.test.mjs` (8) la clasificación del
histórico. `e2e/hist-pagos-mensuales.spec.mjs` cubre lo que el unitario no ve: que marcar tres meses
del mismo recibo en la pantalla real deje UN fijo. Los tres se ejecutaron en rojo antes del arreglo.
Hallazgos aún abiertos: [auditoría del 9/9](briefs/AUDITORIA-CODEX-2026-09-09.md).
Cola de casos que faltan y aceptación por encargo: [BACKLOG.md](BACKLOG.md), FIN-01 a FIN-08,
OPS-01/02/06 y seguridad. Una suite verde no sustituye esos ensayos de identidad, restauración,
servidor vivo y Android; cada entrega debe indicar cuáles ejecutó y cuáles siguen pendientes.

Regresiones de widget/nube (4.19.6): `e2e/persistencia.spec.mjs` cubre reactivación nativa sin
`visibilitychange` con puente simulado y pull de categorías neutras comprobado en Inicio/Gastos.
Está registrado en `CROSSCUTTING`. `tests/presupuesto-servidor.test.mjs` convierte las filas con
`expenseFromRow` antes de comparar totales: construir directamente `category:cat` no probaba el pull.
Estas pruebas no ejecutan las preferencias Java ni sustituyen la comprobación final en el móvil.
FIN-05 añade `tests/widget-arbitraje.test.mjs`, que compila y ejecuta el árbitro Java real con
dos respuestas invertidas, reentrada, cambio de mes, banco distinto y `possibleDup`; cruza las
mismas filas sintéticas entre app y servidor. `e2e/persistencia.spec.mjs` retrasa el pull para
comprobar que la reentrada no sobrescribe el widget antes de recibir el gasto nuevo. La
prueba también push con un evento pendiente, cobertura posterior sin doble suma y borrado con
lápida. La compilación Android verifica el cableado nativo, pero queda por probar la APK firmada y la Edge
real con un móvil.

## Para el dueño: los dos interruptores de Ajustes → Dev → Pruebas

Son **dos cosas independientes** y se confunden constantemente. Esta tabla es la respuesta corta:

| Interruptor | Qué hace | ¿Lo enciendo? |
|---|---|---|
| **Canal** (`📦 estable` ↔ `🚧 BETA`) | De dónde baja las actualizaciones este móvil. **Estable** = lo mismo que el padre y la pareja (GitHub Pages). **Beta** = la release fija `beta` del repo, que solo se publica cuando alguien empuja a la rama `beta`. | **Solo cuando haya una beta esperándote.** Si no hay ninguna, cae a estable y no pasa nada — pero tampoco ganas nada. |
| **Banco de pruebas** (`🏦` ↔ `🧪 DENTRO`) | Cartera FALSA y aislada (`micartera_sandbox`). Dentro, **la app no escribe NADA en la nube**. Banda naranja permanente. | **Solo el rato que vayas a trastear** algo destructivo (borrar cuentas, importar a lo bruto). Y sales al terminar. |

**⚠ El banco de pruebas también corta la telemetría.** `logEvent` está en `CLOUD_WRITES`, así que dentro del
sandbox **los errores de tu móvil no llegan a `app_events`** y quien te ayude a depurar se queda ciego.
Si estás reportando un fallo, tiene que estar APAGADO.

**⚠ El canal beta puede dejarte atrás.** El OTA compara NÚMEROS de versión. Si la release `beta` anuncia una
versión más alta que la estable pero con código más viejo (pasó el 2026-07-25: `beta` anunciaba `4.8.0.3`
mientras `main` iba por `4.8.0` con arreglos nuevos), activarla te instala lo viejo y te deja encallado hasta
el siguiente bump. **Antes de activar el canal beta, comprueba que la release `beta` sea más nueva que `main`.**

### Cómo se prueba una versión antes que nadie (el flujo completo)

1. El cambio se empuja a la rama **`beta`** (no a `main`). `beta.yml` publica `bundle.zip` + `version.json`
   en la release fija `beta`.
2. En el móvil: **Ajustes → Dev → Pruebas → Canal → Activar beta**. Solo ESE móvil la recibe.
3. Aparece **«🔍 Revisar esta beta»**: la checklist sale sola de las `RELEASE_NOTES` de esa versión. Cada
   punto se marca ✓ o ✗ (con ✗ te pide decir qué pasa). **No se puede aprobar con cosas sin probar ni con
   fallos marcados** — si esa puerta se abre, el botón no significa nada. El progreso se guarda por versión,
   porque probar lleva días.
   Una corrección que continúa en otra versión conserva el mismo `tanda.id`: el panel mantiene solo la más
   nueva antes de comprobar su entrega. Desde76 las tandas modernas desaparecen solo al acreditar todas sus
   superficies exactas (web, Android y servidor que correspondan), aunque el número de producción sea menor.
   Sin recibo permanecen con «Entrega sin confirmar»; APK estable antigua indica publicación Android pendiente.
   La aprobación idéntica se conserva y no se pide otra vez; un cambio de código exige pruebas nuevas. Las
   tandas antiguas sin identidad de código conservan la regla por versión. No se usa una nota antigua como fallback.
4. Cuando esté aprobado, desde el PC: **Actions → «Promote beta» → Run workflow**, escribiendo `SUBIR`.
   Vuelve a pasar la suite y mergea `beta` → `main`, que es lo que ven todos.

**El panel NO despliega a propósito.** La app no puede hacer un merge de git, y meter un token de GitHub con
permiso de escritura en Supabase sería una credencial nueva y jugosa a cambio de ahorrar un clic.

### Si no te llega una actualización

Lo primero que hay que mirar **no es el canal, es el número de versión**: el OTA solo ofrece algo si
`version.json` del servidor trae una versión MAYOR que la del móvil. Un arreglo desplegado sin subir
`VERSION` es invisible para la app (pasó el 2026-07-25). Comprobación de 5 segundos:

```bash
curl -s "https://juanjoavila.github.io/Aely/version.json"
```

Desde la 4.9.1 esto lo vigila `tests/docs-frescura.test.mjs`: si quedan cambios en `src/`,
`supabase/functions/` o `android/app/src/` después del último bump de `VERSION`, `npm test` falla.

### Dos guardas más, de la 4.10.0

- **`tests/edge-sintaxis.test.mjs`** — las Edge Functions se despliegan solas al pushear, en un
  workflow DISTINTO al de Pages: un paréntesis de más no lo ve nadie hasta que el usuario ya cree
  que está publicado. Y `deno check` se omite en silencio si Deno no está instalado. Esto las pasa
  por el parser de esbuild (que ya es dependencia del repo) y además falla si alguna vuelve a poner
  `Access-Control-Allow-Origin: "*"` en vez de usar `withCors` (`_shared/cors.ts`).
- **`tests/presupuesto-rendimiento.test.mjs`** — presupuesto de TAMAÑO: `index.html` minificado y
  gzip (lo que baja el móvil de verdad) y cuántos ficheros bloquean el primer pintado. Los topes
  están escritos en el propio fichero con lo medido el día que se pusieron; subirlos vale, pero se
  hace a propósito y explicando por qué. El tamaño crece de uno en uno y nadie lo mira hasta que la
  app tarda cinco segundos en abrir y no hay un commit al que señalar.
- **`e2e/gastos-orden.spec.mjs`** — arrastra un movimiento con gesto táctil, comprueba el DOM y el
  orden guardado tras recargar, y garantiza que las fechas originales no cambian.
- **`e2e/plan-ahorro.spec.mjs`** — abre Plan → Metas, comprueba que el ahorro mensual se guarda
  y persiste sin crear movimientos, que Cancelar no escribe y que una cifra larga cabe a 320 px.

## Flujo local (CMD o PowerShell)

Abre **CMD** o **PowerShell**, ve a la carpeta del proyecto y ejecuta:

```powershell
cd "E:\Aely"
```

### Si `npm ci` falla con “package-lock.json”

Eso pasa si la carpeta **no tiene el lockfile** (copia vieja, zip, o sin `git pull`).

**Solución:**

```powershell
git pull origin main
npm install
```

`npm install` genera/actualiza `package-lock.json`. Luego ya puedes usar `npm ci` en adelante.

### Instalación completa (una vez)

```powershell
git pull origin main
npm install
npx playwright install chromium
```

### Ejecutar tests

```powershell
npm test          # build + unit + E2E (suite entera; lo que corre main y el promote)
npm run test:relevant  # como la rama beta: solo lo que toca el último commit
npm run test:e2e  # solo Playwright (más rápido)
npm run build     # solo ensamblar src → public/index.html
# Sueltos, cuando solo tocas una zona:
node tests/edge-sintaxis.test.mjs             # Edge Functions: sintaxis + nadie pone CORS "*"
node tests/presupuesto-rendimiento.test.mjs   # cuánto pesa lo que se envía al móvil
```

## Capas

| Capa | Qué cubre | Dónde |
|------|-----------|--------|
| **build-app** | Ensambla `src/modules/` → `public/index.html` | `scripts/build-app.mjs` |
| **check-syntax** | Sintaxis VM de cada `<script>` inline | `scripts/check-syntax.mjs` |
| **Unit (Node)** | Motor financiero, parsers Revolut, onboarding… | `tests/*.test.mjs` |
| **Deno** | ingest, crypto, delete-account | `supabase/functions/**/*.test.ts` |
| **Playwright** | Smoke UI + flujo borrar cuenta | `e2e/*.spec.mjs` |

## Fuente editable

Tras v3.108.0 la lógica vive en **`src/modules/*.js`**. No edites `public/index.html` a mano — se regenera con `npm run build`.

## CI

- `.github/workflows/test.yml` — push/PR a **main**: suite **entera**
- `.github/workflows/promote-beta.yml` — al subir a producción: suite **entera**
- `tests/wait-promote-deploy.test.mjs` — reproduce un deploy cuya suite supera diez minutos,
  un fallo real y la comprobación del sello de Pages; se ejecuta desde `scripts/run-tests.mjs`.
- `.github/workflows/beta.yml` — push a **beta**: recorte por carpetas (`scripts/relevant-tests.mjs`).
  Docs → sin Chromium. Ingest → Deno, sin e2e. Gastos → sus specs + transversales (persistencia,
  swipe, frames). Núcleo (motor, i18n, shell, runner) o un workflow → todo.
  **Si añades un e2e o un módulo de `src/`**, una línea en `E2E_MAP` / `CROSSCUTTING` / `CORE`
  en el mismo commit: el test `relevant-tests` recorre el disco y aborta si falta. Un unitario
  nuevo va a `steps` en `run-tests.mjs` (igual: aborta). Un `*.test.ts` de Deno, a `denoTests`.

## Playwright en modo visual (opcional)

```powershell
npx playwright test --ui
```

Abre una ventana donde ves el navegador y cada paso del test.

---

## Entorno de pruebas del dueño (v4.8.0)

Dos cosas distintas, ambas en **Ajustes → Dev → 🧪 Pruebas** y visibles solo con
`profiles.is_admin = true` (o sea: solo tú).

### 1. Canal beta — QUÉ versión recibe este móvil

GitHub Pages sirve **una sola** versión: la de `main`, que es la que usan tu padre y tu pareja.
Por eso la beta no va por Pages, sino como assets de una **release fija con la etiqueta `beta`**.

```
rama `beta`  ──push──►  .github/workflows/beta.yml
                          ├─ relevant-tests (docs/ingest se saltan Chromium; núcleo = todo)
                          ├─ build + stamp + minify
                          └─ sube bundle.zip + version.json a la release `beta`
                                     │
                    solo los móviles con canal beta ◄┘
```

- La versión de beta lleva sufijo con el número de ejecución (`4.8.0.17`), así se distingue de un
  vistazo en el pie de Ajustes y `_mcNewerVer` la ve como más nueva que la estable del mismo número.
- Si el canal beta está vacío o la release no existe, la app **cae a estable** sola
  (`mcFetchManifest`): nunca se queda un móvil sin poder actualizarse.
- Volver a estable: el mismo interruptor. Limpia lo que hubiera pendiente del otro canal.

**Promocionar una beta a producción:** mergea la rama `beta` a `main` como siempre.

### 2. Banco de pruebas — CON QUÉ datos trabajas

Copia tu cartera a `micartera_sandbox` y, mientras estás dentro:

- todo lo que escribas se queda en esa clave; tu `micartera_v3` no se toca;
- **ninguna** operación de escritura llega a la nube — las 20 que hay (`CLOUD_WRITES` en
  `00-core.js`) pasan por un envoltorio que las anula, así que ni tu padre ni tu pareja ven nada;
- las lecturas (sincronizar el banco, precios) siguen funcionando: probar con datos reales es la gracia;
- una **banda naranja** permanente lo recuerda, y tocarla te saca.

> ⚠️ **Si añades un método a `cloud` que escriba algo, mételo en `CLOUD_WRITES`.** Si se olvida, el
> modo pruebas escribiría en producción. `tests/security.test.mjs` lo detecta y falla el build.

Cubierto por `e2e/modo-pruebas.spec.mjs`. Ese test ya pagó su precio: encontró que salir del modo
pruebas escribía el estado de prueba **encima de la cartera real** (el volcado de `pagehide` corría
entre quitar la bandera y recargar). Por eso el modo se fija al arrancar y no se relee.

### 3. Aprobar la beta desde el móvil («code review», pero probando)

**Ajustes → Dev → 🧪 Pruebas → 🔍 Revisar esta beta** (solo en canal beta).

La checklist **sale de `RELEASE_NOTES` de la versión que corre**, así que no hay nada que mantener
aparte: cada release trae su lista sola. Cada punto se marca *✓ Va bien* o *✗ Falla*; al marcar que
falla aparece un campo para decir qué pasa. El progreso se guarda por versión en localStorage —
probar lleva días y cerrar la app no puede borrarlo.

**Regla que impone el panel:** no se puede aprobar con cosas sin probar ni con nada marcado como que
falla. Si esa puerta se abriera, el botón dejaría de significar nada. Cubierto por
`e2e/revisar-beta.spec.mjs`.

El veredicto se guarda en `app_events` con `kind:'beta'` (tabla que ya existía, RLS solo-admin) y se
lee en **Actividad → filtro 🧪 Betas**. Dentro del banco de pruebas NO se manda nada: `betaReport`
está en `CLOUD_WRITES` (aprobar con datos falsos no aprueba nada).

#### Subirla a producción

El panel **no despliega**: la app no puede hacer un merge de git, y meter un token de GitHub con
permiso de escritura en Supabase sería una credencial nueva y jugosa a cambio de ahorrar un clic.
Dos caminos, los dos de una línea:

1. Decírselo a Claude («sube la beta»).
2. GitHub → Actions → **Promocionar beta a producción** → Run workflow → escribir `SUBIR`.
   Vuelve a pasar la suite entera, mergea `beta` → `main` y el deploy de Pages sale solo.

#### ⚠ El canal beta SOLO funciona en la app Android

Esto hay que tenerlo clarísimo porque ya causó una confusión (2026-07-24):

| | De dónde saca la versión | ¿El canal hace algo? |
|---|---|---|
| **App Android (APK)** | OTA de Capgo → `version.json` del canal | **Sí** |
| **Navegador / PWA** | Service Worker → GitHub Pages = `main` = **producción** | **No** |

`_mcCheckOtaUpdates` se sale en la primera línea si no existe `Capacitor.Plugins.CapacitorUpdater`,
o sea siempre en la web. En el navegador **no hay forma de servir la beta**: Pages publica un único
sitio, el de `main`. Y servirla desde otro dominio tampoco valdría — sería otro origen, o sea otro
localStorage: entrarías a una cartera vacía y sin sesión.

Así que en la web siempre verás la versión de producción. La app avisa de ello (en Ajustes y en el
toast de `?canal=beta`) en vez de callarse.

#### El arranque: cómo llega la PRIMERA beta a la APK

Pescadilla que se muerde la cola: el interruptor de canal vive en la versión que quieres probar, así
que una APK antigua nunca mirará la release `beta`. Hay que romperlo **una vez**, y solo hay dos
formas:

1. **Instalar a mano un APK de beta** (sideload). Desde ahí, cada beta siguiente entra sola por OTA.
   Requiere firmar el APK → o lo compilas en el PC (`npx cap sync android` + `assembleRelease`), o se
   añade la firma al workflow (ver abajo).
2. **Subir esa versión a producción** y aceptar que el canal beta empieza a servir de la siguiente
   en adelante.

`?canal=beta` / `?canal=estable` en la URL sirven para cambiar de canal **una vez la app ya tiene el
interruptor** — no para saltarse el arranque.

##### Si algún día se quiere compilar el APK de beta en CI

Hoy la firma vive solo en el PC (`local.properties` → keystore en `~/.micartera`, **nunca en el
repo**). Para que `beta.yml` publique un APK firmado harían falta como secrets del repo el keystore
en base64, su contraseña, el alias y la del alias. **Es una decisión con coste:** esa clave es la
identidad de la app; quien la tenga puede firmar una actualización que los móviles aceptarían como
tuya. Mientras no compense, el APK se compila en el PC.

## Checklist de re-prueba — beta 4.12.0 (tras rechazos .17/.18)

Además de la checklist automática del panel (sale de `RELEASE_NOTES`), conviene mirar a mano:

1. **Plan → Deudas (o Metas) → scrollear un poco → deslizar a otra pestaña al momento.** No debe
   ir a tirones. (Si solo entras y deslizas sin scrollear, eso ya iba bien.)
2. **Banco caído:** sincronizar a mano con un banco sin permiso → toast + noti; al tocar la noti,
   Cartera con el banner rojo a la vista (Mis bancos **no** se abre solo). Un toque en el banner
   sí abre la autorización. En Mis bancos ese banco sale en coral, no en verde.
3. **Trade Republic desconectado:** banner en Cartera; el botón abre Mis bancos con TR, no un
   login de Open Banking. Ajustes → Bancos menciona TR desconectado.
4. **Perfil:** abrir (avatar) y cerrar tirando **sin esperar** medio segundo. Tiene que cerrar.
5. **Ajustes → pie / Actualizaciones:** se ven `web v4.12.0` y `app 4.12.0` (o la APK que lleves).
   Si solo sale la web, la APK es anterior a la 35.
6. **Panel de revisión:** los ✓ de una compilación anterior con el mismo texto de nota llegan
   heredados; los ✗ no.

## Varias betas a la vez (tandas) — desde 4.13.0

Petición suya del 2026-07-29: **«que se pudieran implementar varias betas a la vez y que me des la
opción de aprobarlas por separado pero que estén juntas»**. O sea, como se trabaja en una empresa:
varias cosas en vuelo, todas probándose en la misma instalación, y cada una sube cuando está lista
sin esperar a la que va con retraso.

> ⚠ **LA GRANULARIDAD POR DEFECTO ES UNA FUNCIONALIDAD = UNA TANDA** (aclarado 2026-08-01: «por
> features, por cada cosa que haya, a no ser que sea un pack por dependencias — eso sí sería una
> tanda de varias cosas»). No es «cuatro cosas grandes, cada una su tanda»: es **cada punto que se
> pueda subir SOLO, sube solo**. Varias cosas comparten tanda ÚNICAMENTE cuando de verdad dependen
> entre sí (p. ej. una migración de datos + la pantalla que la necesita: subir una sin la otra
> rompe algo). En la duda, más tandas pequeñas, no menos.

Y para lo que ni siquiera esto cubre —una ronda que se commiteó mezclada, sin tandas, y hay un
arreglo urgente ahí dentro— está el **parche por commits sueltos**, más abajo.

### Cómo se declara una tanda

En la entrada de `RELEASE_NOTES` de la versión, junto a `items` (que es lo que ve la familia en
Novedades y **no cambia**), se añade `tandas`, que **solo la ve él** en el panel de revisión:

```js
{v:"4.13.0", d:"28 jul 2026", t:{es:"…",en:"…",ca:"…"},
 tandas:[
   {id:"import", t:"📗 Importar hojas de gastos", items:["…qué probar…","…"]},
   {id:"gestos", t:"🎯 Rebote y barra de abajo",  items:["…","…"]},
 ],
 items:{es:[…],en:[…],ca:[…]}}
```

Reglas:
- **El `id` es el que viaja al parte y al workflow.** Corto, sin espacios, estable.
- Los `items` de una tanda son **qué probar**, no qué se ha hecho: se leen desde el móvil con la
  app delante. El `CHANGELOG` es para el porqué.
- **Las tandas son opcionales.** Sin ellas, el panel se comporta exactamente como antes (una sola
  checklist, un solo veredicto con id `todo`). Las 69 versiones del histórico siguen funcionando.
- ⚠ **`items` y `tandas` son dos listas distintas y no tienen por qué parecerse**: `items` es lo
  que lee la familia en Novedades, y los puntos de las tandas son lo que él prueba. El panel
  aplana las tandas y esa lista aplanada ES la checklist (`betaChecklist`). **No toques ese
  aplanado**: el progreso, los ✓ heredados entre compilaciones y el guardado van todos por el
  índice global que sale de ahí. Si alguien vuelve a usar `items` como checklist, el panel enseña
  un punto y guarda su ✓ bajo el texto de otro, sin avisar (pasó en la 4.13.0: 21 puntos en tandas
  contra 14 en Novedades). Lo vigila `e2e/revisar-beta.spec.mjs`.

### Cómo se aprueba

Cada tanda tiene en el panel **su propio contador y su propio botón**. Un fallo marcado en una NO
bloquea a las demás — que es todo el motivo de que existan. Cada veredicto se manda por separado y
lleva su `id`, así que `node scripts/errores.mjs --kind=beta` enseña una línea por tanda.

### Una tanda aprobada Y SUBIDA se QUITA de `tandas`, no se marca como hecha

Regla suya, textual (2026-08-01): **«si sube algo en prod, se quita de beta para probar porque ya
está listo — es como una especie de backlog: conforme apruebe la tanda sube y desaparece; si algo
falla se queda hasta que esté todo aprobado por mí»**.

Cuando una tanda se aprueba Y se promociona (a `main`, o su arreglo ya vive activo aunque no haya
«producción» que tocar, como `canal`), su bloque entero **se borra** del array `tandas` de esa
entrada de `RELEASE_NOTES` — no se deja ahí con un comentario de «ya hecha», porque eso es
exactamente lo que le hizo dudar si de verdad estaba hecho o no («no se reflejaba en las pruebas
de la beta»). El bloque `{id:...}` desaparece del código; lo que hizo esa tanda queda documentado
en el CHANGELOG y en `docs/ROADMAP.md`, que es donde se consulta el HISTÓRICO — `tandas` es solo
la cola de lo que **queda** por revisar, nunca un registro de lo ya cerrado.

### Cómo se sube solo lo aprobado

> ⚠⚠ **LA RAMA SE DECIDE ANTES DE ESCRIBIR NADA, NO AL FINAL.** Declarar `tandas` en las notas
> **no crea ninguna rama**: solo parte la checklist del móvil en secciones. Si las tandas se
> commitean mezcladas encima de `beta` —que es lo que pasó en la 4.13.0, con `import` + `gestos` +
> `arranque` en un mismo commit—, **ya no se pueden trocear**: cortarlas a posteriori con
> `cherry-pick` sobre los mismos ficheros es justo la promoción a medias que este mecanismo existe
> para evitar. Esa ronda solo puede subir ENTERA (`tandas` vacío).
>
> Así que si la ronda va a tener tandas de verdad: **`git switch -c tanda/<id> main` para cada una
> antes del primer commit**, y `beta` se mantiene como la mezcla (`git merge` de todas).

Para que una tanda pueda subir sola, tiene que vivir en **su propia rama `tanda/<id>`**, y `beta`
ser la mezcla de todas. Entonces:

```
Actions → «Promocionar beta a producción»
  confirmar: SUBIR
  tandas:    import,gestos      ← solo estas dos se mergean a main
```

Con `tandas` **vacío** se sube `beta` entera, que es lo de siempre y sigue siendo lo normal cuando
solo hay una cosa en vuelo.

⚠ Si pides una tanda cuya rama no existe, el workflow **para** y no sube nada. Subir «lo que haya»
cuando falta una rama es el fallo silencioso que ya costó dos promociones a medias.

## Un parche urgente, cuando ni siquiera hay tandas — desde 4.13.0

Petición suya del 2026-08-01: **«se han implementado montonazo de cosas y hay cosas urgentes para
subir a prod por bugs gordos para mi pareja y mi padre y no se puede subir esos parches»**. Las
tandas resuelven esto SI la ronda nació troceada desde el primer commit — pero si no (la 4.13.0 se
commiteó mezclada), no hay rama que mergear y toca esperar a que TODO esté listo, que es
exactamente lo que no puede pasar con un bug gordo delante de la familia.

La vía de emergencia: **`commits`**, cherry-pick de los commits exactos que hacen falta, sin tocar
el resto de `beta`.

```
Actions → «Promocionar beta a producción»
  confirmar: SUBIR
  commits:   a1b2c3d,e4f5061      ← del más VIEJO al más nuevo (el orden importa)
  version:   4.12.2                ← opcional; vacío = sube el PATCH de lo que hay en prod
```

`npm run salud` ya te da la lista de commits pendientes en el orden correcto para pegar, cuando
los hay.

Reglas:
- **No se puede usar a la vez que `tandas`.** Son dos formas de trocear la misma cosa; mezclarlas
  no tiene un significado claro y el workflow para si intentas las dos.
- El número de versión **tiene que ser mayor** que el que ya hay en `main` — si pides uno igual o
  menor, para: bajarle la versión a la gente es peor que no subir nada.
- Si un commit **no aplica limpio** (conflicto), el workflow para y te dice el comando exacto para
  resolverlo a mano en tu portátil. No intenta adivinar cómo fusionar.
- Esto **no sube `VERSION` de `beta`**, sube un PATCH nuevo sobre lo que ya hay en producción — la
  ronda grande sigue en `beta` esperando su turno, intacta.

> En un worktree no hace falta instalar otra copia de Playwright: `scripts/run-tests.mjs`
> reutiliza el CLI de `node_modules` del checkout compartido. Evita `npx playwright`, porque una
> versión distinta a la que carga la configuración hace fallar todos los specs antes de correr.

FIN-06: `tests/fx-multi.test.mjs` cruza cliente/Wallet, catálogo y desconocidos. `e2e/divisas-sin-cambio.spec.mjs` está en CROSSCUTTING y abre Cartera/Inversiones/Apuntar en es/en/ca con fixtures sintéticos; comprueba sumas parciales, originales, costes, roles, historial y offline.


## FIN-07 · histórico cloud completo

`pull-historico-entero` (runner unitario) ejecuta el paginador y `cloud.pullExpenses` reales con tabla sintética: 4501/50001 filas, respuesta corta, empates, ediciones de fecha, altas concurrentes, errores, reintentos, progreso y campos. Ejecuta también el sync de App para comprobar ausencia de mezcla/backfill/ACK tras error y descarte de lectura vieja. `cloud-historico-completo.spec.mjs` (CROSSCUTTING) abre Gastos y busca la fila antigua entre 2501; comprueba guardado partido, vuelta a primer plano sin reescritura y recuperación de fallo. No usa cartera real ni acredita un snapshot servidor o la latencia de RLS real.

## Guardián SEC-03

node tests/logs-privacidad.test.mjs ejecuta productores cliente, callback/loggers Edge y ambos SDK Sentry con marcadores sintéticos y transportes en memoria. Está registrado en steps del runner. --source-ref SHA repite los mismos contratos contra una fuente Git previa sin mutar el checkout. Incluye inventario de destinos explícitos; no certifica gateway, RLS ni servidor activo. Matriz y límites en [SEC-03](briefs/sec03-privacidad-logs.md).

La regresión e2e/logs-privacidad.spec.mjs está en el mapa de 10-app-components: abre Actividad real, captura inserts simulados y comprueba códigos/texto útil sin correo ni marcadores automáticos.

INC-3009-01 tras rechazo: inicio-cargos abre el vínculo explícito en Gastos y comprueba cancelación, confirmación, banco real del pago, reentrada y deshacer en es/en/ca. fixed-payment-state ejecuta R1/R2/R3, unicidad y dinero inalterado. Ambos están en runner/mapa; no acreditan pagos reales.

## Panel beta: identidad y entrega (OPS-3009-03, integración75)

`npm run listo` acredita primero exactamente un `profiles.user_id` con `is_admin=true`, el mismo rol que abre Dev. Pide el total exacto de perfiles: una respuesta recortada, sin total, ambigua, inválida o inaccesible deja el resultado indeterminado y termina con código 2. En `--json` devuelve `veredictos:"indeterminado"` y ninguna tanda evaluada; no significa que estén aprobadas o que no queden pruebas. No se selecciona por correo ni se conserva un UID en el repo.

Los eventos se filtran por ese actor en Supabase antes del límite y de nuevo en el CLI; una aprobación o rechazo ajeno no cambia la decisión ni su historial. Un `null` explícito del actor autorizado retira la aprobación previa; una decisión ausente o de valor inválido no se interpreta como retirada. `tests/listo-actor.test.mjs`, registrado en `run-tests`, ejecuta el CLI con transporte simulado sin red: rechazo propio + OK ajeno, OK propio + rechazo ajeno, retirada propia (incluido `null`), autor ausente y configuración no acreditada. `--source-ref SHA` repite esos contratos contra el script histórico de Git. Esta protección de tooling no cambia la persistencia del panel móvil ni certifica los roles del servidor real.

`scripts/beta-sources.json` declara fuentes y bloques inequívocos por tanda/superficie; `beta-revisions.mjs` normaliza CRLF y genera SHA-256. Una tanda moderna sin alcance o bloque activo ausente/ambiguo aborta build. No hay fallback global ni recibo de Android/Edge a partir de Git. `beta-delivery.json` acredita web ensamblada y sourceSha real en CI (null local). Los alcances no son un análisis automático de dependencias: deben auditarse al cambiar lectores o helpers.

`betaHuella` combina guion y código; `betaVerdictFor` comparte reglas entre panel y listo. Última decisión rechazada/retirada prevalece, historial conserva decisiones anteriores, desde solo hereda código/guion iguales auditados. En75 tres revisiones seguían idénticas; cuatro widgets cambiaban realmente en web por Inicio73, sin cambios Android/Edge ni referencia histórica repinada. En78 la guardia de nómina cambia también el importador de TR: ayuda/arranque mantienen su OK y TR/cuatro widgets requieren nueva revisión. Aprobación y entrega exacta son distintas; sin recibo de una superficie requerida se conserva pendiente. El APK51 es legado y no acredita widget52.

`tests/beta-veredictos.test.mjs` y `tests/beta-sources.test.mjs` están en run-tests; los scripts nuevos en CORE. El CLI se ejecuta con partes sintéticos y recibos ausentes. Mutantes legacy-id/drop-code/discard-rejection/local-override/ignore-receipts deben fallar. Los digests de Inicio, identidad/vínculo de Recibos y presentación en Plan cambian con una mutación relevante. `e2e/revisar-beta.spec.mjs` abre DOM real en es/en/ca: en78 hereda dos OK, exige puntos nuevos en TR y cuatro widgets y conserva el historial almacenado; prueba rechazo/retirada y fallo remoto. CI36806617191 detectó cuatro expectativas antiguas de TR, corregidas sin cambiar la app. Chromium local solo con lease canónico del coordinador.

## Ampliación auditada de cobertura (panel75)

`beta-source-code.mjs` delimita declaraciones con vm.Script y contempla funciones, const/flechas, datos de nivel superior y sus dependencias transitivas de lógica00/01/08. Ignora comentarios, textos, regex y propiedades; distingue lecturas en ternarios y recoge varias variables de una declaración. Una plantilla interpolada no admitida aborta. Los guardianes mutan cuerpos y valores de cada dependencia; una ancla que desaparece debe abortar build. Se incluyen zona horaria/cachés de mes, REC_GRACE, categorías/reglas, CONFIG, lápidas, divisa y formato numérico. Solo datos de textos/idiomas se excluyen con motivo explícito en benignData; benignCalls conserva sus excepciones de traducción/transporte/telemetría. El recorrido de identificadores es conservador y no es un análisis general de llamadas dinámicas, aliases/métodos o variables de otros módulos; los alcances requieren revisión al editar lectores.

TR y ayuda conservan fuente idéntica tras ampliar cobertura; sus hashes ampliados se calculan desde17aeacc03f595412c044d276c900707cbbd008c8. Arranque se compara desde26972970d216f272b0d555d7d8548bb99afd6ba5. `auditoria.ampliada` identifica ese commit, huella original y digest de las superficies ampliadas. El builder verifica identidad del commit y correspondencia con codigoDesde/revisionesDesde originales, conserva esos datos en referenciaAnterior y compara con el digest histórico ampliado. src conserva intactas las siete referencias originales; un helper nuevo que difiere del commit histórico exige revisión nueva, aunque versión y guion sean iguales. No se pincha el baseline a HEAD. El builder vuelve a leer Git histórico y calcula el digest del descriptor almacenado en auditoria.ampliada.scope: rechaza incluso metadata forjada de forma coherente con un helper de HEAD. Si falta el commit/archivo histórico, aborta; Tests descarga fetch-depth:0. Una ampliación futura conserva el descriptor anterior hasta que se audita otro desde el mismo commit.

`beta-sources` añade guardianes de fuente histórica inválida, pin HEAD/SHA ajeno, digest incoherente, helper TR mutado frente a su referencia y léxico con definiciones ficticias en comentarios. La guardia se ejecuta en run-tests y el helper está en CORE. Las menciones migrate()/buildEmpty() de01:3436-3437 son comentarios dentro del alcance de Inicio y no se tratan como llamadas.

La fixture «un fallo en una tanda no bloquea las otras» retrasa 250ms su doble de producción y espera toHaveCount(2): el primer render aún muestra la ronda real antes del efecto asíncrono (CI36804139697 recibía11 al leer count inmediatamente). Se conserva la aserción de dos tandas, sin modificar la app ni aceptar la ronda extra.

### Panel76: entrega selectiva y motivos

`beta-tandas-vacias` protege entrega exacta con versión de producción menor, deduplicación antes de retirar y límites404/APK/Edge. `revisar-beta` reproduce los siete IDs reales, conserva aprobaciones sintéticas idénticas y verifica explicación visible es/en/ca aun plegada; tras respuesta asíncrona de producción67 con recibos exactos quedan solo Panel, Recibos e Inicio no acreditados. El fixture fija el idioma en estado: cambiar solo `CURLANG` se perdía al repintar App. Historial no acredita entrega; los recibos del test enumeran solo los siete IDs.

DOM final local55/55 PASS31,8s,0skip/0flaky. A/B75:1.278.280 /347.946 B frente a76.1 sellada1.279.388 /348.256 B (minificado/gzip9). Los topes mínimos1250/341 KiB dejan612/928 B; no se añaden dependencias ni se recorta validación. Últimos veredictos remotos y entrega Edge requieren acceso independiente: la simulación no los acredita. [Acta](briefs/ops-0110-panel-entrega.md).

INC-2909-03, candidata: `tests/retirada-bancaria.test.mjs` ejecuta ACK/CAS/identidad, recarga,
doble importación y pulls anteriores/posteriores; `e2e/retirada-bancaria.spec.mjs` abre la ficha real
en es/en/ca, cancela/confirma, prueba errores y comprueba otro almacenamiento tras sync a demanda.
Registrados en runner/mapa de Gastos. Las respuestas cloud son sintéticas; no prueban RLS real ni
suma de efectivo compartida. [Estado de candidata](briefs/inc-2909-03-retirada-caixa.md).

## Persistencia entre entregas (candidata81)

La identidad web por unidades evita reabrir una tanda por una declaración vecina, otro método cloud o descriptores duplicados/reanclados. Cloud mantiene initializer con efectos y helpers privados alcanzados; los métodos seleccionados, cierre transitivo, literales, ASI y CSS siguen vigilados. El Listener TR excluye solo el ACK mensual de widget y Widget mantiene los cinco Java completos. Los negativos ajenos y positivos de initializer/helper/método/nativo viven en beta-sources, registrado en run-tests.

La compatibilidad recalcula el alcance actual sobre fuentes Git fijas75→80 y exige igualdad de todas las superficies y del guion. Nunca hereda por id ni acepta aliases manuales.79/78 son candidatos, no entregas servidas; Nómina79/80 equivalentes,78 distinto por cambios de fusión/timestamp. Los veredictos más recientes, incluido null/revoked/rejected, prevalecen sin depender de marcas auxiliares. Recibos equivalentes requieren esta misma prueba, y el mínimo de APK sigue obligatorio.

revisar-beta añade nueve DOM es/en/ca: A aprobada, compilación B ajena, reload/arranque frío, textos repetidos, marcas borradas, petición de notas abortada, rechazo/retirada posterior, cambio financiero real y reset con comentarios. Los hashes proceden de dos fuentes modificadas, no de códigos sintéticos igualados a mano. El Service Worker se bloquea solo en estos fixtures para no reemplazar la compilación B simulada con el HTML original. El mismo spec permanece en CROSSCUTTING; Chromium local requiere lease canónico.

Cierre conservador81: alias, destructuring, callback u opcional de this/nombre del objeto abortan antes de generar recibos; this._evSent/_evN continúan admitidos. Getter/spread no delimitables también abortan. Las declaraciones de función privadas sin uso, incluido return de objeto y parámetros destructurados, no reabren; las usadas y sus métodos transitivos sí. El ACK excluido enTR debe continuar cubierto por Widget completo. El guion Panel76 vive ahora una vez en81 con historial76; notas-sin-duplicados conserva su guarda y el contador histórico13 usa el snapshot fijo955.

El catálogo del fixture lleva el SHA-256 real de cada compilación aislada. Los casos sin red prueban también respuesta HTTP correcta con catálogo viejo tras REC_GRACE3→4 y sufijo2.1→2.2: cero tandas, mensaje sin confirmar, ningún envelope nuevo guardado e historial intacto. release-notes-max comprueba que el sello del HTML coincide con el JSON generado. Evaluación dinámica (eval/Function/constructor), también desde helpers privados o el initializer, aborta la delimitación conservadora.

Sin WebCrypto no se acepta descarga ni se rescata una caché previamente verificada; el guardián del loader comprueba ambos caminos.

El último cierre añade cuota simulada para dos cachés antiguas: purga previa, una sola nueva y claves de dinero/veredictos intactas. Los casos es/en/ca sin red prueban reintento visible de Novedades y Panel sin recargar, recepción del catálogo válido y una sola caché.

Corrección de fixtures tras CI36885083225 (fuente9a6): inicio-offline descarga un catálogo sintético con SHA-256 real, exige el envelope escrito por la app y verifica su rescate sin red. Una cabeza `_rnHead_` sin verificar y otra compilación de la misma base deben quedar sin confirmar. seedImplicitChecklist conserva el catálogo real mixto; aislarlo ocultaba la regresión detectada en450. Los contratos y DOM exigen la checklist actual junto a las dieciséis tandas modernas con y sin producción; tandas:[] no crea una revisión. Las tandas modernas mantienen sus casos de huella/índice y rechazo/retirada posterior. La entrega en es/en/ca acredita únicamente las siete tandas antiguas y exige que sigan visibles las nueve posteriores, con IDs exactos y Panel82 único; no se reduce un contador para ocultar una tanda.

INC-0210-01: debt-payment-state ejecuta cargo vinculado previo al vencimiento, dos préstamos, identidad ambigua, feed PDNG/BOOK, lápidas y frontera de mes sin mutar el saldo. plan-cuota-contabilizada abre Gastos/Inicio/Plan en es/en/ca, comprueba el pendiente y total, recarga, otra deuda y cargos ambiguos. Ambos están en runner/mapa; las fixtures usan datos sintéticos y no acreditan aprobación financiera en el móvil.


INC-0210-03: gastos-periodo está en steps; gastos-periodo-categorias.spec.mjs en el mapa de Gastos. Motor usa ventanas explícitas y conserva llamadas sin ventana; DOM es/en/ca abre mes pasado, rango con calendario real, mes, ciclo y tres meses/todo. Datos sintéticos, sin afirmar aceptación móvil.

Candidata84: cinco DOM de Gastos y siete del panel real pasan; la checklist mixta conserva17 IDs modernos,18 con la cabeza implícita sintética, sin ocultar el catálogo. Entrega exacta conserva10 posteriores tras acreditar las7 antiguas. El fixture de entrega espera a que termine la consulta inicial y aborta Pages externo: un recibo sintético no debe competir con una respuesta real.
