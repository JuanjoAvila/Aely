# Backlog operativo — Aely

## OPS-0410 · prioridad humana: cola beta y coste de tests

Petición directa del4/10: retirar de las pruebas de beta las funciones ya estrenadas y priorizar la entrega frente a acumular candidatas. Candidata aislada4.26.92 sobre `be3081ab`; producción86 sigue intacta. Reproducción sobre catálogo90.5:40→22 puntos, conservando cuatro novedades y seis entregas APK/Edge pendientes.92 añade su propia prueba. Panel, contador, refresco y entrega offline tienen regresiones DOM; dos mejoras del runner eliminan trabajo repetido conservando guardianes. Validación final y publicación beta pendientes en el [acta](briefs/ops-0410-panel-cola.md). No convierte ninguna candidata rechazada en aprobada. Regla mensual aceptada por el dueño: descontar presupuesto mensual y aportar a la meta automáticamente; la candidata91 anterior todavía no implementa ese contrato.


Corte operativo 4/10, 02:35 UTC (prevalece sobre las menciones «candidata» de 89 y 90 de más abajo y de sus actas, que quedan como historia). Entregado en el canal beta: Brókers89 como 4.26.89.1 (merge `0f825c45`, [PR115](https://github.com/JuanjoAvila/Aely/pull/115)) y Gastos90 como 4.26.90.1 (merge `4a2e3c54`, [PR116](https://github.com/JuanjoAvila/Aely/pull/116)). Producción sigue en 4.26.86 (`d366215a`). El canal sirve ahora 4.26.90.2 desde `7f3da23b`, que solo suma [PR117](https://github.com/JuanjoAvila/Aely/pull/117), una guardia de tests de nombres de categoría: nada nuevo que probar en el móvil respecto a 4.26.90.1. Sigue abierto para ambas entregas: prueba y aprobación en el móvil, y promoción a producción. Ninguna de las dos da por arreglados los pagos ausentes, el widget ni los daños históricos, que conservan sus incidencias. El hueco de cobertura que quedó anotado aquí (`cat_inversion`, `cat_traspaso` y `cat_deudas` sin vigilar) lo cierra la ampliación de `tests/i18n-categorias.test.mjs`, que ahora exige también el nombre de ingreso y de las categorías neutras. [Brókers](briefs/inc-0310-broker-resultados.md) · [Gastos](briefs/inc-0310-gastos-sin-limite.md) · [pruebas](TESTING.md).

FEATURE-0210-01 (2/10): petición humana de distinguir carburante/taxi del transporte general; Taxi no existía en el catálogo. Propietario: Codex, rama aislada codex/feature-0210-01-gasolina-taxi, candidata85 sobre3467. Catálogo y clasificación solo de altas nuevas, histórico/límites previos intactos, DOM sintético es/en/ca y guardianes registrados. Sin publicar: revisión/CI/beta y veredicto móvil pendientes; Edge fuente preparada sin deploy. [Acta](briefs/feature-0210-01-gasolina-taxi.md).

INC-0210-01 · candidata83 separable sobre3467bbd4: la cuota contabilizada y vinculada antes del vencimiento deja de figurar pendiente en Plan/Inicio y eventos futuros, sin descontarla otra vez del saldo. Datos sintéticos; revisión/CI/integración/aceptación móvil pendientes. Sin publicación, APK, Edge, SQL o pagos reales. [Acta](briefs/inc-0210-01-plan-cuota.md).

## INC-0210-03 · P1 · categorías y cifras de Gastos por periodo · 2/10/2026

Propietario: Codex, rama aislada codex/inc-0210-03-gastos-periodo desde3467bbd4. Síntoma comunicado: elegir mes/fechas deja las categorías del ciclo actual. Motor y DOM sintéticos cubren mes anterior, rango, meses acumulados y retorno a Mi ciclo. Estado: candidata84 con rojo/verde DOM y guardianes locales acreditados; CI y revisión exactas en el PR/relevo. Sin publicar ni aprobación móvil. [Pruebas y límites](briefs/inc-0210-03-gastos-periodo.md).

## INC-0310-01 · P1 · borrar regla de Meta conserva descuento · 3/10/2026

Síntoma humano vinculado a PRO-01 y al contrato de flujo/FIN-01, sin duplicar esos objetivos: tras aplicar el reparto de una nómina, borrar la regla dejaba el descuento en Gastos. La magnitud afectada es el presupuesto disponible, no el gasto bruto ni otro cobro. Corrección candidata aislada sobre `3467bbd4`: liberar solo el descuento comprobable de la regla confirmada, conservar aportación/historial, otras reglas y nómina única. `c88d9627` rechazado por doble liberación si reaparece la configuración; la corrección exige identidad única y sin liberación previa. Parciales/ambiguos conservan el pendiente. Motor y DOM sintético es/en/ca registrados; pruebas, revisión, PR draft y CI exactos en [el acta](briefs/inc-0310-01-meta-regla.md). Sin publicación ni aceptación móvil. **Pendiente separado:** identificar y proponer reparación verificable de reservas huérfanas de reglas borradas por la versión antigua; esta corrección prospectiva no resuelve esas capturas históricas. PRO-01 y FIN-01 mantienen sus alcances generales.

Candidata Validaciones82 tras NO-GO450: conservar aprobación/progreso y la checklist actual junto a las rondas modernas si producción no responde. Sobre beta80/source955765a9;81 no publicada. APK80/52 intacta; DOM mixto70/70, contratos Node y A/B acreditados; revisión independiente y CI exacta pendientes. No integrar/publicar una solución parcial. [Acta](briefs/ops-0110-validaciones-persistentes.md).

Snapshot previo de preparación80 (no estado de la candidata81): Widget80 sobre79/d45fb8b1; runtime821/ACK/guiones intactos. Prebuild52/name80 y descarga de assetbeta602841368 verificados; manifiesto52 local real. CI/build final/reemplazo APK/entrega80 pendientes; no main/Edge/SQL/install. [Acta](briefs/inc-2909-01-widget.md).

## INC-2909-02 · implementación beta4.26.73.1 verificada · 30 de septiembre de2026

Salir de Mi ciclo conserva el gasto bruto mensual de Inicio y sus lectores del presupuesto. PR82/mergea03a2a06; CI completa SUCCESS, ZIP/huella/HTML/SW/APK cotejados. Candidata separable PR80/3912aa11GOClaude yCIverde, pendiente de prueba y aprobación móvil específica; no se atribuye cierre del caso real ni promoción. [Acta](briefs/inc-2909-02-inicio-natural.md). El coordinador nocturno dirige el backlog autorizado; recibos y panel se mantienen en sus propios chats.

## Rechazo de recibos y solicitudes separadas · 30 de septiembre de 2026

**INC-3009-01 permanece rechazada.** El dueño informa de cargos visibles en Gastos que siguen sin pago acreditado en Recibos, aunque el gas ya desaparece. Claude reprodujo con datos sintéticos nombres bancarios distintos, pérdida de bankTx entre dispositivos y pago desde otra entidad/notificación. La candidata original de PR76 no se promociona. Este chat prepara el vínculo explícito cargo→recibo y evidencia durable que no intervenga en saldos; no acredita identidad por importe solo ni modifica dinero real. Pruebas y publicación se registrarán en el brief de la incidencia; implementación y aceptación móvil son distintas.

| ID / prioridad | Solicitud nueva y estado | Criterio de cierre |
|---|---|---|
| **OPS-3009-03 · P2 · reconciliar panel después de producción** | Panel revisado483e8874 integrado localmente en75 sobre9ecd6a17. Tres OK idénticos se conservan; cuatro tandas de widget cambian en web por Inicio73 y conservan historia sin alias antiguo. Recibos74 conserva rechazo71 y requiere aceptación nueva. | CI/GO del SHA75, DOM es/en/ca y publicación beta pendientes; entrega exacta web/Android/Edge no demostrada por una versión mayor. Bootstrap main PR92/2f045a1e permanece retenido. [Evidencia](briefs/ops-3009-03-panel-beta.md). |
| **FIN-3009-04 · P2 · reservar cuotas obligatorias para deudas** | Evolutivo solicitado, solo documentación. Reservar para deudas como para metas: calcular cuotas obligatorias del mes y descontarlas del dinero disponible para gastar. No se implementa con recibos. | Definir mes natural/ciclo, cuotas parciales o variables y datos faltantes; una cuota pagada no vuelve a descontarse. Todos los lectores de disponible comparten la misma magnitud. Sin importe fiable: — con motivo. Pruebas sintéticas motor/DOM es/en/ca; widget, Android y pago real conservan contratos y aceptación propios. |


## INC-3009-01 · corrección separable preparada · 30 de septiembre de 2026

Reproducido en DOM con un gas ficticio y cargo BOOK: Inicio ignoraba la evidencia bancaria si el fijo arrastraba `wait`. La candidata desde main `12884f48` distingue pago acreditado, próximo y vencido sin acreditación; Plan comparte esa lectura para los fijos. Tests de motor y DOM es/en/ca registrados. [Acta](briefs/inc-3009-01-cargos.md). **Sin publicación beta todavía en este corte**, sin aprobación móvil y sin cierre del caso real. No altera saldos guardados ni movimientos, APK, Edge o SQL. Widget y nómina siguen como objetivos independientes.


## INC-3009-01 · beta 4.26.71.1 publicada · 30 de septiembre de 2026

Reproducido en DOM con gas ficticio y cargo BOOK: Inicio ignoraba la evidencia bancaria si el fijo arrastraba `wait`. Corregido y publicado solo en **beta 4.26.71.1**, merge `79b981ad`, [PR77](https://github.com/JuanjoAvila/Aely/pull/77), [CI 36764259812](https://github.com/JuanjoAvila/Aely/actions/runs/36764259812) SUCCESS con 500 E2E, uno omitido y 7 de rendimiento. Manifiesto, huella `bba29bcbdd912837`, ZIP, HTML y SW cotejados; exactamente ocho tandas, las siete anteriores intactas. [Acta y hashes](briefs/inc-3009-01-cargos.md). **Pendiente de aprobación y comprobación real en móvil**, sin cierre financiero ni GO de Claude. Candidata separable `1e2395b9`, PR76 borrador, CI completa verde; no fusionar a main todavía. Producción permanece 4.26.67/APK48, beta conserva APK51. No altera cuentas guardadas, movimientos, Edge o SQL. El sucesor comprobará aprobaciones primero; sin nueva aprobación, INC-2909-02 (0 % al salir de Mi ciclo) es el siguiente objetivo independiente recomendado. Widget y nómina siguen separados.

## INC-2709-02 · promoción selectiva web 4.26.67 publicada · 30 de septiembre de 2026

El dueño aprobó en chat la tanda `inc-2709-02-deudas-archivo` de beta 4.26.70.1. [PR #71](https://github.com/JuanjoAvila/Aely/pull/71) la promovió exclusivamente a `main` como web 4.26.67 (`df30b76f`). La [Action de Pages 36754554318](https://github.com/JuanjoAvila/Aely/actions/runs/36754554318) terminó SUCCESS; manifiesto, ZIP, HTML y SW de producción concuerdan. [Acta selectiva](briefs/inc-2709-02-prod.md). La APK estable sigue en 4.26.32/code 48; no se desplegó Edge, SQL ni migración. Las otras siete tandas siguen visibles en beta sin atribuirles aprobación.

## Pruebas beta · auditoría de acumulación · 30 de septiembre de 2026

La beta anterior mostraba ocho tandas por encima de producción 4.26.66. La única aprobación nueva confirmada en chat era `inc-2709-02-deudas-archivo`. [PR #72](https://github.com/JuanjoAvila/Aely/pull/72) la retiró del panel y movió cinco guiones nativos de la nota 4.26.67 a 4.26.68 para que no desaparezcan al subir producción selectiva a 4.26.67. [PR #73](https://github.com/JuanjoAvila/Aely/pull/73) actualizó el E2E del panel. La [Action 36753826093](https://github.com/JuanjoAvila/Aely/actions/runs/36753826093) terminó SUCCESS y la release beta sirve 4.26.70.2, huella `03b9908ed0db121d`, ZIP SHA-256 `03f5a0c6a8ae9287b9b43753969251e8c2eb5d2212e9fea373021197048aa689`, HTML y SW cotejados. Quedan siete pruebas: `inc-2709-01-arranque-red`, `inc-2809-02-ayuda-ciclo` y cinco de widget/pagos nativos. Estas últimas siguen en la APK beta 51, mientras producción anuncia APK 48; no se deben borrar ni dar por aprobadas. No hay otra tanda visible que pueda quitarse solo por antigüedad.

## Nuevos reportes · 30 de septiembre de 2026

El dueño adjuntó una captura de Inicio: la tarjeta de Mi ciclo aparece, y «Próximos cargos» aún muestra un recibo de gas fechado el 25/9 al mirar la app el 30/9. Comunica además que la nómina aparece en Sabadell normal antes de haberla cobrado y que el widget solo enseña el modo Balance; esto último amplía **INC-2909-01** más abajo. Son observaciones del móvil, no una confirmación de cómo llegaron los datos; la captura no se incorpora al repo público. No editar movimientos reales ni tomar el pago previsto por cobro efectivo.

| ID / prioridad provisional | Síntoma y comprobación pendiente | Criterio de cierre |
|---|---|---|
| **INC-3009-01 · P1 · gas ya pagado en Próximos cargos** | El 30/9 sigue apareciendo como próximo un cargo de gas con fecha 25/9 que el dueño declara pagado. Distinguir fecha planificada, movimiento bancario confirmado y posible conciliación fallida; comprobar además que un cargo vencido sin prueba de pago no se etiquete como futuro ni se marque pagado por suposición. | Con un pago bancario que corresponde al fijo, «Próximos cargos» deja de ofrecerlo como pendiente; sin pago acreditado, el estado y la fecha se muestran de forma veraz. Reproducir con datos ficticios y DOM real. |
| **INC-3009-02 · P1 · nómina Sabadell anticipada** | El dueño informa de una nómina añadida en Sabadell normal antes de recibirla. Aclarar si es previsión, movimiento pendiente o apunte confirmado y qué magnitud alteró (cuenta, ingresos, Mi ciclo). Guardia revisada5c2146c3: BOOK o estado ausente, fecha válida no futura en Madrid y rechazo antes de deduplicación. Nómina78 candidata sobre UI77 finalca7734fd: cuatro fixtures DOM4/4 y contratos afectados verdes; CI exacta, publicación y prueba móvil pendientes. PR96/número76 antiguos retenidos. [Acta](briefs/inc-3009-nomina-anticipada.md). | Ninguna previsión o movimiento pendiente se suma como nómina cobrada ni cambia el saldo efectivo; solo la entrada bancaria confirmada se cuenta una vez, sin inventar fecha o importe. Reproducción sintética en UI y motor, sin consultar ni corregir datos bancarios reales. |

La siguiente tarea autónoma tratará **un solo** fallo financiero y volverá a cotejar aprobaciones beta antes de escogerlo. Mantener el widget como objetivo nativo separado y la nómina coordinada con el diagnóstico de Claude.

## Dos reportes de producción · 29 de septiembre de 2026

Fuente: relato directo del dueño sobre su widget y la cuenta de su pareja en producción. Son
observaciones, no causas reproducidas; faltan versión web/APK, texto exacto del aviso y un caso
sanitizado. No consultar ni copiar movimientos familiares al repo público. Registrar y ordenar
estos seguimientos sin implementar ni cambiar datos reales en esta tanda.

| ID / prioridad provisional | Síntoma y comprobación pendiente | Criterio de cierre |
|---|---|---|
| **INC-2909-01 · P1 · widget y periodo/modo** | Al activar «Mi ciclo», el widget sigue enseñando las cifras anteriores. El 30/9 el dueño precisó que solo ve el modo Balance, mientras Inicio sí muestra Mi ciclo. El cliente actual envía al widget el mes natural aunque Inicio y Gastos usen el ciclo; comprobar además la elección «Gastos e ingresos» frente a «Balance» y cada vía que actualiza el widget (app abierta, reentrada y app cerrada). Relacionado con FIN-05, pero es una aceptación distinta. | El widget indica qué periodo y magnitud enseña y coincide con la selección activa y las cifras de la app para ese mismo periodo, también al cambiar de modo o de mes. Verificar Android real y la ruta nativa/ingest antes de darlo por cerrado; si el contrato exige APK o servidor nuevos, tratarlos como entregas propias. |
| **INC-2909-02 · P1 · 0 % al salir de Mi ciclo** | En la cuenta de la pareja, Mi ciclo parece correcto; al desactivarlo, el anillo/barra de Inicio cae a **0 %** pese a haber compras del mes. Es un caso nuevo tras INC-2809-01: revisar periodo natural, modo «Gastos e ingresos»/«Balance», presupuesto, filtros/bancos y gasto bruto frente a neto; no deducir la causa del relato. | Con gastos computables del mes, cambiar ciclo sí/no no presenta 0 % por error de estado o por compensación de ingresos. Si se agotó el presupuesto, comunicar el límite/exceso de forma coherente; si falta un dato necesario, mostrarlo como desconocido y explicarlo. Reproducción con dos perfiles sintéticos y DOM real, sin tocar la cuenta familiar. |
| **INC-2909-03 · P1 · retirada CaixaBank sin salida clara** | Una retirada de efectivo importada de CaixaBank apareció como gasto y, al intentar corregirla, la pareja recibió un aviso relativo al banco y no logró cambiar su clasificación. La app prevé que un cajero sea traspaso neutro y ofrece pasar el efectivo a la cuenta Efectivo, pero hay que identificar la fila, el control pulsado y el texto exacto del aviso: no está demostrado que el selector de categoría fuera el que se bloqueó. | Poder reconocer o corregir explícitamente la retirada como movimiento neutro y, si procede, reflejar el efectivo una sola vez, conservando importe, origen bancario e identidad. Distinguir en la UI qué campo fija el banco y cuál puede corregir la persona. Probar importación, edición, sincronización posterior y dos dispositivos; sin recategorizar el histórico en masa. |
| **UX-2909-04 · P1 · datos sin sincronizar y duplicado manual** | La pareja vio un resultado negativo sin saber qué hacer. Había apuntado la nómina manualmente; al sincronizar los bancos al día siguiente apareció el ingreso bancario y también gastos que faltaban antes de la sincronización. Borrar el apunte manual resolvió ese caso, pero la experiencia no explicó la antigüedad de los datos ni la posible duplicidad. La sincronización bancaria es deliberadamente a demanda. | Hacer visible cuándo se actualizó cada banco y cuándo una cifra depende de datos pendientes; dar una acción de sincronizar y una explicación contextual del negativo. Al llegar un ingreso bancario que pueda coincidir con uno manual, ofrecer revisión sin sumar dos veces ni borrar por parecido automáticamente. Validar el recorrido con una persona que no conozca la app, con datos sintéticos y sin introducir sincronización automática. |

Orden provisional: primero la cifra engañosa del 0 % y la retirada que cuenta como gasto;
después coherencia del widget y claridad de sincronización/duplicados. Reordenar por evidencia
de reproducción e impacto real, sin dar por resuelto ningún punto por la corrección de otro.

## INC-2809-01 · promoción selectiva publicada · 29 de septiembre de 2026

El dueño aprobó expresamente la corrección de Inicio/Mi ciclo de la beta 4.26.67.1 (`383c0120`, [Action 36481177084](https://github.com/JuanjoAvila/Aely/actions/runs/36481177084) SUCCESS). La promoción web 4.26.66 se reconstruyó desde main 4.26.65 e incluyó solo `inc-2809-01-inicio-ciclo`; PR #61, CI completa, Claude GO, Pages y el ZIP servido confirman la publicación. [Brief y evidencia](briefs/inc-2809-01-inicio-ciclo.md). Las cinco tandas ligadas a APK51 conservan su entrega propia y el panel de beta. INC-2809-02, la explicación persistente de Mi ciclo, es el siguiente objetivo independiente.

## Promoción selectiva aprobada · 28 de septiembre de 2026

El dueño aprobó expresamente las tandas pendientes tras la prueba de pago y el ajuste de Inicio. La web 4.26.65 se publicó y verificó desde `main` con el alcance selectivo de Inicio/Gastos, nómina adelantada y «Mi ciclo»; conserva APK48 y el workflow manual de Supabase. Las cinco tandas que requieren APK51 o un receptor nativo permanecen en beta hasta una entrega propia. El alcance, las pruebas, las fuentes y los límites están en [el acta de promoción](briefs/promocion-aprobadas-2026-09-28.md). Cuotas de deuda ya se publicó como 4.26.59. El siguiente objetivo independiente es INC-2809-01, comunicado durante esta publicación; INC-2709-06, cargos CaixaBank ausentes, sigue abierto y prioritario.

## Nueva incidencia comunicada · 28 de septiembre de 2026

- **INC-2809-01 · cerrado en web 4.26.66.** Inicio muestra el mismo neto y margen que Gastos y reemplaza el falso «Tu primer mes empieza hoy» por «Mes en curso». Beta 4.26.67.1 fue aprobada expresamente; producción web 4.26.66 está publicada y cotejada. [Evidencia](briefs/inc-2809-01-inicio-ciclo.md). No se altera mes natural, widget ni APK.
- **INC-2809-02 · P2 · aviso explicativo de Mi ciclo.** La tarjeta explicativa debajo del selector de periodo en Gastos ocupa gran parte de la pantalla en cada visita. Permitir ocultarla después de leerla y recuperarla mediante una ayuda visible; conservar la preferencia al volver a entrar sin ocultar la selección activa ni los datos necesarios para entender el periodo. Probar apertura, cierre, reapertura y persistencia con DOM real y en los tres idiomas. Es una tarea de interfaz separada de la corrección financiera INC-2809-01.

Inventario original actualizado el **16 de septiembre de 2026** a petición del dueño: dejar trabajo
concreto para Claude y Cursor durante la tarde/noche. La reconciliación vigente está debajo.
**El backlog completo NO está terminado.** El panel de
beta solo enumera entregas para probar; no enumera todo lo que falta construir o verificar.

Este es el índice operativo. Los briefs conservan el detalle y los espejos de `docs/memoria/`
conservan historia; sus antiguos «todo cerrado» o «ninguna empezada» no son el estado actual.
Actualizar esta tabla al entregar: commit, pruebas, versión publicada y siguiente paso.
Una tarea implementada, una verificada por tests y una aprobada en móvil son estados distintos.

Desde el 28/9, [el flujo continuo](PROMPT-FLUJO-CONTINUO.md) abre automáticamente un chat nuevo
al cerrar cada objetivo. El chat entrante comprueba primero aprobaciones explícitas de beta para
promover solo esas tandas; si no hay ninguna publicable, toma un objetivo pendiente de este índice.


## Cierre del día · 27 de septiembre de 2026

**Este corte prevalece sobre las fotos históricas del 9/9 y 25/9.** Se revisan documentos, PR y
artefactos públicos; no se inspeccionan cuentas familiares, filas de dinero ni logs reales. Una
incidencia comunicada hoy queda abierta aunque la funcionalidad tenga un arreglo antiguo publicado.
No se implementa ninguna de las incidencias nuevas en este cierre: el encargo es registrarlas,
priorizarlas y dejar el relevo. No se declara una sesión activa por tener una rama o PR abierta.

### En curso y pendiente de aprobación real

- **SEC-03 cliente:** aprobado expresamente en móvil tras beta 4.26.57.1/f2354a47. Entrega exclusiva
  de producción en [PR49](https://github.com/JuanjoAvila/Aely/pull/49), SHA 1af182b3, Claude GO exacto;
  [CI final36351403967](https://github.com/JuanjoAvila/Aely/actions/runs/36351403967) SUCCESS.
  Merge exclusivo ece3a2d9 con árbol idéntico al SHA revisado; [manifiesto estable](https://juanjoavila.github.io/Aely/version.json)
  y [Pages36352234935](https://github.com/JuanjoAvila/Aely/actions/runs/36352234935) muestran la entrega activa.
  **Producción4.26.57 verificada por HTTP el27/9,21:47 UTC**, CI main36352234924 y Pages SUCCESS,
  SW4.26.57-2026-09-27-ece3a2d; ZIP/HTML/SW/apk.json idénticos, APK48 intacta.
  No desplegar Edge/SQL/RLS/APK. El servidor sigue pendiente por función.
- **Continuidad beta:** 4.26.58/2a0e2d3a conserva runtime financiero y APK51 idénticos a f2354a47;
  mueve íntegros cinco guiones pendientes para que producción57 no los oculte. Claude GO exacto;
  [publicación36351420037](https://github.com/JuanjoAvila/Aely/actions/runs/36351420037) SUCCESS.
  Beta **4.26.58.1 publicada**, HTTP/ZIP/sello comprobados: huella3d91ae84731dfffa, SW2a0e2d3;
  index normalizado y apk.json idénticos a beta57.1/f235. Cinco tandas financieras, sin pedir SEC-03 de nuevo.
  **FIN-05, selector del banco y TR siguen sin aprobación de pago.** No mezclar beta a main.
- **OPS-01 A / Wallet-divisas:** activación técnica terminada: ingest49 ACTIVE desde1397fe28,
  [despliegue36319915174](https://github.com/JuanjoAvila/Aely/actions/runs/36319915174) SUCCESS, siete módulos
  activos cotejados y pruebas offline del JS descargado. Se conserva FIN-05. **Pago real de FIN-06/Wallet
  pendiente**, no cerrado por el deploy. Evidencia en rama codex/ops01-wallet, brief ops01-wallet-2026-09-27.
- **OPS-01 B:** [PR48](https://github.com/JuanjoAvila/Aely/pull/48) borrador; despliegue específico ya autorizado pero **bloqueado por HTTP403**,
  al token le falta edge_functions_write. categorize16 conservó el paquete, ninguna función cambió;
  falta resolver el permiso y repetir preflight, no una nueva autorización. FIN-04 [PR43](https://github.com/JuanjoAvila/Aely/pull/43) borrador y widget
  [PR44](https://github.com/JuanjoAvila/Aely/pull/44) abierta: existencia de PR no equivale a trabajo activo
  ni a funciones faltantes en la beta actual. Se conserva su contenido; no se fusionan por antigüedad.

### Estado completo de los objetivos existentes

La tabla resume todos los IDs del inventario anterior; OPS-06 tenía dos filas y aquí se consolida.
Los nuevos casos INC-2709 se vinculan a esos objetivos y conservan su propia aceptación para no
perderlos ni duplicar encargos. «Publicado» no certifica todos los criterios del objetivo amplio.

| Objetivo | Estado al cierre / qué queda |
|---|---|
| FIN-01, FIN-02 | Correcciones publicadas según reconciliación25/9; cierre completo por cuenta/importación todavía sin acreditar. Mantener aceptación financiera y prueba real, no rehacer fixes históricos por defecto. |
| FIN-03 | Identidad de extremo a extremo pendiente: UUID/origen/ACK, carreras e índice real. Sin migración ni reparación automática. |
| FIN-04 | Parcial; PR43 borrador. Verificar ACK/filas afectadas, edición/decisiones en dos clientes, sin buscar gemelos por parecido. |
| FIN-05 | Implementado en beta/Android51 con guardianes; **pago con app cerrada y reentrada pendiente**, selector independiente pendiente. |
| FIN-06 | Cliente aprobado/publicado4.26.51; Wallet-divisas de ingest activado y comprobado en revisión49 por OPS-01 A. **Validación por pago real sigue pendiente** según cierre de A; no se da por cerrado el objetivo completo. |
| FIN-07 | Cerrado y publicado4.26.52: paginación cloud. No demuestra que el proveedor haya enviado todos los cargos CaixaBank. |
| FIN-08 | Investigación/contrato de reparación histórica abiertos. El trabajo TR anterior no cerró este objetivo; sin reparar datos reales. |
| OPS-01 | Auditoría y control manual C terminados/integrados; A ingest49 activado y comprobado, validación financiera móvil abierta. B categorize autorizado pero bloqueado403 por permiso del token, PR48 borrador. La igualdad completa repo/servidor sigue requiriendo pruebas por función. |
| OPS-02 | Visor de copias cerrado/aprobado/publicado4.26.56. **Recuperación compartida financiera abierta**, dependiente FIN-03/08 y SQL/RLS/ACK. |
| SEC-01 | Inventario histórico parcial; aceptación por endpoint, cuerpos inválidos, tamaños/auth y evidencia servidor pendientes. Los recuentos9/9 no son un inventario vivo nuevo. |
| SEC-02 | Límites/replay pendientes de auditoría y contratos por coste/usuario, sin descartar pagos legítimos. |
| SEC-03 | **Cliente cerrado/aprobado/publicado4.26.57**, main/ece3a2d9, CI/Pages y HTTP/ZIP/SW verificados; privacidad Edge/gateway y puesta en servicio por función pendientes. **Historia pública:** Claude comunica cifras financieras antiguas en commits6fcc3e0e/05a8fb4f, contenido vivo limpio; no se transcriben ni se reauditan datos aquí. Retirada mediante reescritura de historial requiere decisión expresa, no force-push automático. |
| OPS-03 | Beta con varios probadores y permisos/veredictos independientes pendiente. |
| OPS-04 | Métricas agregadas pendientes de confirmar; instrumentación ya existe. |
| OPS-05 | Higiene de ramas/PR/restos pendiente; no borrar sin autorización. **memoria-espejo falla localmente por desfase preexistente**: notas/espejo aún sin integrar, señalado también por Claude. Resolver en objetivo propio sin incorporar cambios ajenos para ocultar el fallo. Foto PR actual arriba. |
| OPS-06 | Validación intensiva antes de Play Store pendiente: rendimiento sostenido, botones/gestos/carreras/offline, seguridad y dispositivos reales. El lag actual requiere caso propio antes de esa ronda final. |
| BRAND-01 | Identidad publicada parcialmente; aceptación completa web/nativa y nombre final verificable pendiente. No iniciar renombre. |
| UX-01 | **Reabierto por feedback actual:** lag sostenido y gestos; INC-2709-03/09. Medir escenario y degradación en móvil. |
| UX-02 | Diseño/perfil con aceptación amplia pendiente; casillas vacías gigantes INC-2709-10. |
| UX-03 | Síntoma nativo de arranque pendiente; distinguirlo de esqueletos Inicio/red lenta INC-2709-01. |
| UX-04, UX-05 | Cerrados según reconciliación25/9; no reconstruir mensaje/acceso de bancos ni doble filtro sin caso nuevo. |
| UX-06 | Pulido publicado; **regresiones actuales abiertas** INC-2709-01/07/08/10/11/13 y recortes de las fotos. |
| UX-07 | Temas publicados; **Cyberpunk reabierto** por línea que atraviesa el botón +, INC-2709-12. |
| PRO-01 | Meta financiada fuera del gasto corriente pendiente de alcance/aceptación. |
| PRO-02 | Proyección existente; coherencia Inicio/Gastos/ciclo reabierta por INC-2709-05. |
| PRO-03 | Recordatorios existentes; falta acreditar aviso con insuficiencia proyectada, no crear otro sistema. |
| PRO-04 | Exportación informe PDF pendiente; importar PDF no equivale a exportarlo. |
| PRO-05 | Push de nueva versión con app cerrada pendiente; watcher/notificación local no lo demuestra. |
| PRO-06 | MyInvestor y fiabilidad de inversiones sincronizadas pendientes; no confundir con cambios UX de cartera INC-2709-08. |
| PRO-07 | Pensiones/ahorro pendiente de alcance y soporte de proveedor. |
| PRO-08 | Hogar implementado parcialmente; validación/diseño con dos usuarios pendiente. |
| PRO-09 | Ayuda local publicada/aprobada según rondas25/9; Edge remota apagada y pendiente de coste/consentimiento. Distancia del botón Preguntar reabierta INC-2709-14. |
| TEC-01 | Refactor financiero/adaptadores aplazado. |
| TEC-02 | Limpieza i18n aparcada deliberadamente; preservar usos dinámicos. |
| DEC-01 | Marca/monetización/Play Store pendientes de decisión; Play siempre después de correcciones y validación completa. |
| DEC-02 | Ideas opcionales sin compromiso de implementación. |
| REC-GUARDADO-01 y Atrás alta Recibos | Cerrados/publicados4.26.48 y4.26.47. La ola ausente en otras puertas de Plan es una regresión nueva, no invalida automáticamente la aceptación del alta de Recibos. |

### Las 14 incidencias comunicadas hoy

Fuente: relato directo del dueño del27/9 y tres capturas privadas adjuntas. No se copian capturas,
identidades, empleador, importes familiares ni extractos al repo público. Evidencia visual significa
que se ve el síntoma; **no que se haya reproducido su causa ni corregido**. Las prioridades son de
triaje, no un orden de implementación autorizado.

| Nº / ID | Prioridad y relación | Caso abierto y aceptación necesaria |
|---|---|---|
| 1 · INC-2709-01 | P1 · UX-01/03/06 | Con poca conexión la app se ralentiza y reaparecen dos barras grises al inicio de Inicio que tardan en desaparecer. Regresión de arreglo anterior, causa pendiente. Arranque/frente y uso con red lenta/sin red deben mostrar datos locales útiles sin bloqueo ni esqueletos persistentes. Medir tiempo/frames en móvil y CPU×6. |
| 2 · INC-2709-02 | **P1 · beta aprobada, promoción selectiva en preparación** · Deudas/UX-06 | [Confirmación y archivo](briefs/inc-2709-02-prod.md) aprobados por el dueño el 29/9. Publicar solo esta tanda desde main, conservar `debtId` y las cuotas antiguas, verificar Pages y retirar únicamente su guion de «Pruebas». |
| 3 · INC-2709-03 | P1 · UX-01 | En Plan→Gestionar y al entrar en una categoría falta la ola nativa Android. Auditar cada puerta, distinguir alta Recibos ya aprobada; APK/dispositivo real, seguir dedo, cancelación, volver un nivel sin perder campos ni cerrar de más. |
| 4 · INC-2709-04 | **P0 · crash/finanzas** | Abrir categoría «Cuotas de deuda» crashea siempre según el dueño. Reproducción roja de ruta real, stack sanitizado/código/versión y fixture mínimo; E2E DOM de abrir/cerrar/importes/histórico sin crash. No inferir causa desde el relato. |
| 5 · INC-2709-05 | **P0 · FIN/PRO-02/UX-06** | Capturas Inicio/Gastos/ciclo de otro usuario muestran conceptos y cifras incompatibles: Inicio llama gastado a la cifra que Gastos etiqueta balance, porcentaje0 y mensaje de primer mes con actividad visible; nómina prevista aún futura mientras ciclo reconoce cobro bancario. Correlacionar periodo/cuenta/calendario/ciclo, sin asumir que falte la fila de ingreso. Reproducir es/en/ca con datos sintéticos, una base/ventana coherente y nómina real conciliada una sola vez. Además se observan botones de suscripciones recortados; clasificación de compras recurrentes como suscripción es un indicio por comprobar, no fallo financiero demostrado. |
| 6 · INC-2709-06 | **P0 · FIN-03/07/OPS-01** | Cargos CaixaBank de otro usuario ausentes aun tras sincronizar a demanda. **Reabre el historial Caixa con un caso actual**, separado del Sabadell confirmado25/9 y de paginación cloud FIN-07 cerrada. Trazar proveedor→Edge→almacenamiento→pull→filtros privados, identidad y páginas, sin importar/reparar/borrar ni sincronizar automáticamente. Cierre con todos los cargos de referencia una vez en la vista correcta y correspondencia activa Edge probada. |
| 7 · INC-2709-07 | P2 · UX-06 | Bienes parece bloque inicial: no permite añadir/quitar/tocar y el editor resulta insuficiente. Auditar entradas y acciones actuales, navegación y edición real; alta/edición/archivo o borrado según contrato explícito, sin modificar cartera real para probar. E2E de lista/acciones y móvil. |
| 8 · INC-2709-08 | P2 · UX-06/PRO-06 | Cartera sigue mostrando edición manual y explicación larga: edición debe vivir en «Ver todas tus inversiones». Ordenar bloques con pulsación mantenida como cuentas; al pulsar, desplegar inversiones escalonadas y fluidas. Auditar puertas antes de retirar UI, persistir orden y accesibilidad/reducir movimiento; prueba de DOM y A/B de frames en móvil. |
| 9 · INC-2709-09 | P1 · UX-01/OPS-06 | Tras usar un rato reaparece lag muy fuerte. **Regresión actual, no cerrada por benchmarks cortos anteriores.** Guion prolongado real con scroll/cambio de pestañas/hojas, frames>32ms y pendiente de heap/listeners/timers/nodos; CPU×6 y A/B contra base. Acreditar mejora sin aumentar trabajo ni escrituras del histórico. |
| 10 · INC-2709-10 | P2 · UX-02/06 | Casillas vacías gigantes en Ajustes del perfil. Capturar qué campos/ruta/tamaño de letra; estado vacío compacto y útil, sin ocultar opciones ni valores. DOM en idiomas, móvil, teclado y letra grande. |
| 11 · INC-2709-11 | P2 · UX-06 | Anillo de porcentaje de Inicio se recorta como cuadrado, aunque sutil. Captura1 aporta contorno a revisar; fixture0/parcial/completo, escalas/texto grande y temas. Ningún clip rectangular del círculo. |
| 12 · INC-2709-12 | P2 · UX-07 | Línea Cyberpunk atraviesa el botón +. Visible en capturas. Conservar identidad del tema sin cruzar el FAB, en todas las pestañas, safe area y tamaños. |
| 13 · INC-2709-13 | P2 · UX-01/06 | Durante la ocultación de la barra/botón + el círculo se recorta y el corte se nota. Reproducir scroll con inercia Android, capturas intermedias/frame a frame, cancelación y reaparición; contorno completo y animación fluida también con movimiento reducido. Una imagen fija no prueba la animación. |
| 14 · INC-2709-14 | P2 · PRO-09/UX-06 | En Pregúntame el botón Preguntar queda demasiado separado del borde inferior. Verificar Android con/sin teclado, safe area y tamaño de letra; espacio proporcionado y CTA alcanzable, sin tapar contenido ni enviar preguntas reales como test. |

**Primera atención al retomar:** crash de cuotas (4), coherencia dinero/nómina (5) y cargos Caixa (6).
Después bloqueo por red/lag sostenido (1/9) y deuda/gestos (2/3); pulido restante separado. No se
abre una implementación hoy ni se agrupan reparaciones financieras con animaciones. Falta para cada
caso: versión/canal/APK afectados, reproducción propia, fix acotado, guardián apropiado, review,
beta y veredicto móvil. Las capturas no muestran la versión, así que no se asigna un SHA por intuición.

## Reconciliación vigente · 25 de septiembre de 2026

**La foto detallada que empieza en «Base y límites de la revisión» es del 9/9 y conserva su
valor histórico; no es la cola de publicación de hoy.** El dueño confirmó el 25/9 que los
cargos de Sabadell ya entran. No se abre un arreglo de «cargos ausentes» sin un caso nuevo.

### Aprobado en beta y ya publicado

Las rondas aprobadas de apariencia (4.25.7), Ajustes/candados (.8), beneficio de Inversiones
(.9), Ahorro (.10), editor del presupuesto (.11), desbloqueo de hojas (.12), mínimo de Plan
(.13), Asistente (.14), Bizum como forma de pago (.15), avisos sin duplicar (.16), histórico
CaixaBank (.17), actualizar Inversiones (.18), ficha y gesto de Inversiones (.19) e Inicio
honesto (.20) tienen commits de promoción en la primera línea de `main`. El recibo que cambia
de día sin doble descuento quedó aprobado como beta 4.26.46.5 y publicado en 4.26.46.
El alta de Recibos con Atrás nativo quedó aprobada como beta 4.26.47.1 y publicada en 4.26.47
mediante el merge completo `54b21925`.
La confirmación con tipo y nombre al añadir en Recibos quedó aprobada como beta 4.26.48.1 y
publicada en 4.26.48 mediante el merge completo `490d402d`.

Los commits `97289fe1`, `346323ba`, `3bcc5f57`, `398342ca`, `3b11ccb3`, `e23dd1fd`,
`6a894d2e` y `d59c1ab0` retiraron **checklists del panel beta** después de publicar. Su diff
no toca `src/modules/`, `src/shell.html`, `supabase/` ni `android/`: no retiró las funciones.
En el corte anterior, `origin/beta` (`a187686d`) y `origin/main` (`3edde295`) tampoco tenían
diferencias en `src/`, `supabase/`, `android/` ni `public/`. Por eso no queda una entrega de
código de aquellas rondas que haya que rescatar o promocionar otra vez.

Evidencia de publicación: `test.yml` [36162229852](https://github.com/JuanjoAvila/Aely/actions/runs/36162229852)
ejecutó build, unitarios, Deno y E2E con éxito; `deploy.yml`
[36162229834](https://github.com/JuanjoAvila/Aely/actions/runs/36162229834) terminó con éxito.
Pages devuelve `version.json` 4.26.46 y SW `4.26.46-2026-09-25-3edde29`; `npm run salud`
confirmó bundle y APK 4.26.32/48 disponibles. Esta evidencia acredita publicación del
código, no una nueva prueba manual de cada pantalla en producción. `npm run listo` no pudo
leer los veredictos de `app_events` en este entorno: falta `SUPABASE_SERVICE_ROLE_KEY`.

Para 4.26.47, beta [36170019559](https://github.com/JuanjoAvila/Aely/actions/runs/36170019559)
pasó 418 E2E y 7 Deno; la promoción
[36172956860](https://github.com/JuanjoAvila/Aely/actions/runs/36172956860) pasó su suite y fusionó
`60fb486f` a `main` como `54b21925`. El árbol del merge es idéntico al de beta y
`npm run test:syntax` pasó sobre el merge real. El deploy
[36174101720](https://github.com/JuanjoAvila/Aely/actions/runs/36174101720) terminó verde; Pages
sirve `version.json` 4.26.47, bundle HTTP 200 y SW `4.26.47-2026-09-25-54b2192`.
`npm run salud` confirmó además la APK vigente 4.26.32/48. No se declara una prueba manual
adicional en producción: la aprobación móvil fue de la misma lógica en beta.

El Action de promoción acabó rojo únicamente en su espera de Pages: consultó 40 veces durante
diez minutos y agotó el plazo a las 18:42:43 UTC; el deploy, que repite toda la suite, terminó
después con éxito. El arreglo aislado del circuito sigue el run de deploy del SHA promocionado,
distingue un fallo real de una suite lenta y después coteja manifiesto y sello de Pages.

### Estado de las entradas antiguas

**REC-GUARDADO-01 · cerrado y publicado en 4.26.48.** El código en `9ad3121f`
y su ajuste de tamaño `b883ea2b` hacen que el alta de recibo periódico, cargo puntual e ingreso
presente tipo y nombre después de guardar. Los tres E2E nuevos pasaron en es/en/ca y la regresión
local de Recibos pasó 35/35. La primera publicación beta
[36183635059](https://github.com/JuanjoAvila/Aely/actions/runs/36183635059) pasó 421 E2E
funcionales y 7 de rendimiento; sirvió 4.26.48.1 con bundle HTTP 200. El dueño la aprobó;
la promoción [36185465579](https://github.com/JuanjoAvila/Aely/actions/runs/36185465579)
pasó y fusionó la beta en `490d402d`, con el mismo árbol y sintaxis verificada. El deploy
[36186511199](https://github.com/JuanjoAvila/Aely/actions/runs/36186511199) pasó; Pages sirve
`version.json` 4.26.48, bundle HTTP 200 y SW `4.26.48-2026-09-25-490d402`.
`npm run salud` confirmó la APK vigente 4.26.32/48 y beta alineada. La aprobación móvil fue
de la beta; no se declara otra prueba manual sobre producción.

**Objetivo único cerrado: alta de Recibos con Atrás nativo, v4.26.47.** El asistente rearma
la ola en cada paso de recibo periódico, cargo puntual e ingreso; conserva lo escrito y no guarda
al salir. El dueño aprobó expresamente beta 4.26.47.1 y el merge completo fue `54b21925`. No incluye
el diseño del aviso «Guardado» ni cambios de importes, bancos o histórico.

| Estado actual | Entradas | Qué falta para cerrarlas |
|---|---|---|
| **Cerradas; no reconstruir** | UX-04 (mensaje de bancos y acceso superior), UX-05 (un filtro de histórico), UX-07 (temas Otoño, Primavera y Cyberpunk). También están publicados los bloques aprobados enumerados arriba. | Reabrir solo con un fallo actual reproducible. |
| **Código publicado, alcance mayor aún sin acreditar entero** | FIN-01 (cierre por cuenta), FIN-02 (pagos mensuales del histórico), BRAND-01 (identidad web/nativa), UX-01/02/06 (fluidez y rediseño), PRO-02/03 (proyección y avisos), PRO-09 (ayuda local), SEC-01/03 (endpoints y privacidad). | Confrontar el criterio completo de cada fila con prueba móvil, servidor o dispositivo; no confundir una versión publicada con cierre total. La ayuda remota de PRO-09 sigue apagada. |
| **Abiertas o parciales** | FIN-03/04/05/06/07/08; OPS-01/02/03/04/05/06; SEC-02; UX-03; PRO-01/04/05/06/07/08; TEC-01/02; DEC-01/02. | Conservar el alcance y límites de las filas de abajo; elegir una sola tarea concreta cada vez. |

OPS-05 ya no tiene las cinco PR que enumera su foto del 9/9: al consultar GitHub el 25/9
solo permanecían abiertas [#43](https://github.com/JuanjoAvila/Aely/pull/43) (FIN-04) y
[#44](https://github.com/JuanjoAvila/Aely/pull/44) (widget). El WIP anterior de Recibos se
reimplementó desde la base actual en `codex/recibos-ola-25sep`; sus capas interiores ya estaban
publicadas en 4.26.41. La presentación «Guardado» queda fuera de este objetivo.

## Base y límites de la revisión

- Base de código: `4b71f572` · versión fuente **4.19.14**. Beta publicada **4.19.14.1**,
  producción **4.18.7**, APK **42 / 4.18.3**, contrastados con el canal y Actions.
- [Auditoría y reproducciones](briefs/AUDITORIA-CODEX-2026-09-09.md): lógica, cuatro ficheros
  Deno y **164/164 E2E Chromium**; últimos 26 casos del panel/histórico repetidos tras el ajuste.
  [CI de la entrega](https://github.com/JuanjoAvila/Aely/actions/runs/34355741591).
- Este inventario cruza ROADMAP, los dos backlogs antiguos, plan del crucero, relevo del 9/9,
  auditorías/briefs, mensajes del equipo, sugerencias de la app, PR abiertas y Projects 1 y 3.
- **No es una garantía de ausencia de bugs.** No se ha auditado cada ejecución posible ni
  inspeccionado el código desplegado de todas las Edge Functions, índices/RLS reales o todas
  las políticas del servidor. Tampoco se ha ejecutado en esta auditoría una compra real con la
  app cerrada, una reinstalación real, restauración completa ni dos móviles reales simultáneos.
  Los tests con puentes/servidores simulados no cubren esas garantías; abajo tienen encargos.
- Antes de retomar: `git fetch origin`, `npm run salud`, `npm run listo`, `npm run sugerencias`
  y último Actions. Esta foto envejece; una PR abierta o un documento viejo no prueba trabajo ausente.

## Dónde está cada cosa — 10 de septiembre, madrugada

| | |
|---|---|
| Canal beta | **4.19.22.1** · pulido v4 completo (P1–P14 + B2/B3/B4/B5), teclado nuevo, **modo inicial** y el bundle de 330 → 319 KB de gzip |
| Producción | **4.18.7**, y con un parche listo: `claude/prod-aprobadas` @ `0f69c752` sube **4.18.8** con las DOS tandas que él aprobó y que sí son portables |
| Pendiente de él | **21 tandas sin veredicto** en beta. Empezar por «🌱 Modo inicial», que deja probar las de estreno sin tocar su cartera |
| Repo | 71 → **27 ramas**, 23 → **13 worktrees**, las 5 PR abiertas cerradas con su evidencia |

## ⚠ REGLA DE TANDAS — la que rompimos el 9/9 y no se vuelve a romper

Su pauta, con sus palabras: **«implementación por tanda; si la apruebo, sube a producción sin
romper el resto»**. El 9/9 la incumplimos: se commiteó al tip de `beta` mezclando tandas, y sus
**tres aprobadas quedaron atadas a 18 sin probar**. Peor: «límite por categoría» resultó estar
construida **encima de «Mismo mes en todos sitios», que él había RECHAZADO** — llamaba a
`inicioDeMesMs`, que llegó con esa tanda. Comprobado ejecutando, no deducido.

A partir de ahora, sin excepciones:

1. `git fetch && git switch -c tanda/<id> origin/main` — **desde `main`, no desde `beta`**.
2. Código, `npm run build` y suite **en esa rama**.
3. Merge a `beta` para que él la pruebe. **Nunca al revés**, y nunca escribiendo en el tip de `beta`.
4. Al aprobarla: Actions → Promocionar → casilla `tandas: <id>`. Sube esa y solo esa.

Si alguien commitea al tip de `beta` «porque iba rápido», esa tanda **ya no es promocionable sola**.
Eso es exactamente lo que pasó, y el precio fue un porte a mano sobre producción.
La maquinaria (`promote-beta.yml`, entrada `tandas:`) ya existía y hay ramas `tanda/*` de rondas
viejas: la disciplina existía y la dejamos caer.

## Orden de trabajo para la tarde/noche

**Claude dirige e integra; Cursor implementa en su propio worktree.** Un encargo acotado por
rama/PR desde `origin/beta`. Reservar archivos antes de tocar: FIN-01 y FIN-02 pueden acabar
compartiendo UI, tests y notas de versión; serializar integración. Cada entrega de Cursor pasa
por Claude; lo escrito por Claude lo revisa Cursor **ejecutando** las pruebas afectadas.
Codex queda como apoyo de arquitectura. Este documento deja encargos; no acredita sesiones activas.

1. **Cursor: FIN-01**, con reproducción roja, corrección y pruebas de cierre mensual.
   **Claude: contrastar FIN-02** y preparar sus casos de aceptación mientras revisa FIN-01.
2. **Cursor: FIN-02** después de integrar la primera corrección. Claude comprueba que no se
   han eliminado las protecciones al crear Fijos ni se han cambiado movimientos históricos.
3. **Claude: FIN-03/04/07**, adaptar el diseño recuperado a la base actual, por fases y con
   pruebas aisladas. Cursor hace revisión adversarial: mismo importe no demuestra misma identidad.
4. Siguiente trabajo independiente: **OPS-01 + SEC-01/02/03**, inventario de servidor y propuestas
   verificables en pruebas. **OPS-02**, ensayo de restauración con datos sintéticos. Luego UX-01/02
   si hay reproducción; si no, registrar lo que falta medir y pasar a otra tarea.
5. Al cerrar: actualizar este archivo y el brief afectado; entregar SHA, resultado de tests,
   límites, OTA/APK y guion móvil. Una versión visible sigue el circuito de beta de AGENTS.

**No promover toda la ronda:** quedan fallos P1 y veredictos sin resolver. No aplicar migraciones,
recuperaciones masivas, cambios de permisos, servidores compartidos ni producción sin aprobación
explícita. Sí avanzar en diseños, fixtures, correcciones autorizadas y ensayos aislados.
No borrar ramas/worktrees para «limpiar» sin permiso. No reabrir tandas aprobadas para probar otra cosa.

## Dinero e integridad: prioridad antes de nuevas funciones

| ID / prioridad | Estado y evidencia | Entrega y criterio de cierre |
|---|---|---|
| **FIN-01 · P1 · efectivo al cerrar mes** · **ARREGLADO, pendiente de review de Cursor** | Rama `claude/fin-01`, commit `96b0fe4f`, **4.19.15**. `tests/efectivo-cierre.test.mjs`: 6 rojos antes (EXIT 1), 11 verdes después (EXIT 0); e2e 164/164, exit 0. **Era más ancho de lo auditado**: no solo el efectivo — un recibo de CUALQUIER banco que no sea el de gasto diario también se descontaba de la cuenta diaria al cerrar (TR 1000 con un recibo de 40 de Sabadell → 960). Límite dejado a propósito: `roundupOf`/`savebackOf` siguen sobre todos los gastos del mes, aquí y en `11-app-main.js:1483`; separarlos exige mover los dos a la vez. Original: **Encargado a Cursor el 9/9 16:15** (`20260909T161500Z-claude-apertura-y-fin01`). **Contrastado también por Claude leyendo el código**, no solo por la auditoría: `01-i18n.js:2398` suma `spent` sin mirar `e.ent`, y `monthNetForAccount` (`07-tab-patri-fijos.js:492`) recorre fixed/debts/oneoffs/flows y **no toca `s.expenses`**, así que el sobre nunca arrastra sus compras. `reconcileTR` descuenta compras del sobre a TR y repone el saldo del sobre al cambiar de mes. Caso sintético: TR 1000, efectivo 100, compra anterior 20 → 980/100; debe ser 1000/80. | Corregir arrastre por cuenta en `01-i18n.js`. Cubrir con/sin cuenta diaria, varios meses, ingresos/devoluciones, retirada neutra y reanclaje/creación a mitad de mes. Saldos por cuenta y patrimonio, no solo suma global. No ajustar retrospectivamente saldos reales a ciegas. **Bloquea aprobar efectivo.** |
| **FIN-02 · P1 · histórico pierde meses** · **ARREGLADO, pendiente de review de Cursor** | Rama `claude/fin-02`, commit `f0fccc70`, **4.19.16**. `tests/hist-pagos-mensuales.test.mjs`: 5 rojos antes, 8 verdes después; `npm test` entero **EXIT 0 con 164/164 e2e**. ⚠ **Corrección de mi propio brief**: el guardo SÍ protegía algo — la pantalla no usa `histBuildCommit`, `runImport` crea un Fijo por fila marcada. Quitarlo a secas habría creado tres Fijos idénticos cobrándose para siempre. Van dos cambios juntos: fuera el descarte por lote **y** `histFijosFromSelection` agrupa los «Recibo» equivalentes en UN Fijo. Original: **Contrastado por Claude el 9/9 y con aceptación escrita**: [plan FIN-02](briefs/plan-fin02-historico-pagos-mensuales.md). Dato nuevo del contraste: el guardo **ya no protege ningún Fijo**, porque `histBuildCommit` devuelve `fixAdds:[]` y descarta `defDest==="recibo"` (`08-motor-bank.js:926/944`) — hoy solo destruye pagos legítimos. `histClassifyCandidates` aplica `dedupeHistRecibos` sin fecha a cargos cuyo destino ahora es Gasto. Tres pagos mensuales iguales → uno seleccionado y dos `recibo-lote`. | Separar identidad del pago y creación de Fijo. Tres cargos de meses distintos deben importarse como tres gastos. Seleccionar varios Recibo equivalentes no debe crear varios Fijos. Añadir unitario y E2E de la previsualización real, reimportar y deshacer. Conservar avisos de deuda/ahorro y coincidencias ambiguas. **Bloquea dar por terminado el histórico.** |
| **FIN-03 · P1 · identidad de gastos de extremo a extremo** | **Diseño pendiente**, [arquitectura recuperada](briefs/arquitectura-identidad-gastos.md). UNIQUE por usuario/fecha/importe/comercio; claves débiles en import, merge, pull, lápidas e ingest. UUID del histórico no arregla todo el protocolo. | Ensayo aditivo, origen estable por proveedor/cuenta/transacción, UUID canónico y ACK; dos cargos legítimos parecidos sobreviven, reintento del mismo no duplica. Auditar cada lector/escritor actual. SQL real de pruebas, carreras, RLS y cliente antiguo. No quitar el índice ni migrar datos familiares por iniciativa propia. |
| **FIN-04 · P1 · decisiones y ediciones confirmadas** | **Parcial.** `#dup` viaja para nuevas filas; el backfill que revertía decisiones de otro móvil fue retirado en `syncCloudExpenses`. No reintroducirlo. `setExpenseDup` aún no comprueba filas afectadas y puede resolver sin sesión. UUID local divergente permite UPDATE de cero filas sin error. | Cola/ACK con identidad fiable y revisión explícita. Dos clientes, decisión A → pull B, pérdida de conexión, sesión ausente, timeout tras commit y UPDATE sin fila. Auditar también categoría, nota, banco y borrado; un helper de serialización no basta. Acoplar con FIN-03, nunca resolver buscando un gemelo por parecido. |
| **FIN-05 · P1 · widget con app cerrada** | **Parcial.** Resume nativo y categorías neutras corregidos; todavía falta arbitrar respuestas tardías de ingest frente a snapshot nuevo y demostrar `safeLiq`/`afford` coherentes. Pendientes anteriores sin marca remota pueden seguir contando en servidor. | Ensayo de dos escritores con orden de respuestas invertido; comparar presupuesto, disponible y saldo por banco con las mismas filas. Probar además mes/día nuevos, app cerrada y reentrada. Verificar servidor realmente desplegado (OPS-01). Si cambia contrato/Java, APK nueva. No declarar resuelto por un E2E de resume. |
| **FIN-06 · P1 · divisa sin cambio** · **Beta OTA 4.26.51.1 publicada, aprobada por el usuario; publicada exclusivamente en producción 4.26.51; backend pendiente** | Reproducido sobre 9520bdaa y corregido en `codex/fin06-divisas`: originales/ISO visibles, aviso de total incompleto y exclusión de euros desconocidos; catálogo BCE 30 divisas, USD de respaldo guardado y céntimos alineados. Claude PASS f60df6f5; CI Action 36242414362 verde: unitarios + 4 ficheros Deno, 438 E2E y 7 rendimiento (1 omitido). Bundle HTTP 200, huella y sellos cotejados. [Relevo](briefs/fin06-divisas-2026-09-26.md). FIN-05 y selector conservan sus veredictos móviles pendientes. | Veredicto móvil aprobado el 26/9; Promoción exclusiva verificada: main 2ea992b2, Promote 36251080004 y Pages 36251710852 verdes; 430 E2E + 7 rendimiento, HTML/SW/bundle HTTP cotejados. FIN-05 y selector siguen en beta. Backend preparado en `_shared/wallet.ts`, sin desplegar: requiere autorización específica de ingest. Móvil sin compra, producción solo con aprobación. Sin migraciones ni cambios retroactivos de movimientos. |
| **FIN-07 · P1 · histórico cloud completo · cerrado** | Aprobado y publicado exclusivamente en producción 4.26.52/main 8cd41f09. Claude PASS; Promote 36257644323 y Pages 36258292782 verdes, HTTP y bundle cotejados. | [Contrato y evidencia](briefs/fin07-historico-cloud-2026-09-26.md). Sin snapshot global; ausencia no borra. FIN-05 y selector siguen pendientes en beta. Siguiente conversación: FIN-08 investigación/propuesta, sin reparación real. |
| **FIN-08 · P1 · daños históricos previos** | **Investigación pendiente**, no afirmación de pérdida adicional actual. La contención 4.18.6 evita DELETE/lápidas automáticas por similitud, pero no recupera lo que antes se colapsó, borró o recategorizó. | Inventario privado con evidencia por fila, copia restaurable y propuesta revisable. Conservar importes, UUID, bancos y notas; sumas iguales no demuestran mismas filas. Reparación de datos reales requiere aprobación; no migración automática al arrancar. Depende de FIN-03/07 y OPS-02. |

## Operación, seguridad y cobertura pendiente

Estas filas son **trabajo pendiente de auditoría o validación**, no vulnerabilidades demostradas.

| ID / prioridad | Qué existe / qué falta | Encargo y aceptación |
|---|---|---|
| **OPS-01 · P1 · repo frente a servidor vivo** | Supabase compartido; cambios de cajero, categorías, ventana mensual y `#dup` en disco no prueban despliegue. | Claude inventaría funciones/migraciones y versiones activas con acceso de lectura, sin volcar secretos ni datos. Matriz repo/servidor/APK y pruebas de contrato; preparar diff y rollback antes de pedir despliegue. El ATM del cliente no completa el camino de notificaciones del servidor. |
| **OPS-02 · P1 · restauración probada** | **Visor aislado aprobado por el dueño el 27/9 y publicado exclusivamente en producción 4.26.56; merge 42613195, Promote 36343752892, Pages 36344438830 y bundle cotejado.** Beta 4.26.56.1 y Claude GO 978420fc. Sustituye el reemplazo conectado que activaba push de app_state y backfill; ensayo sintético ejecutado. [Contrato y evidencia](briefs/ops02-restauracion-probada.md). | Visor: ambas claves intactas, cero escrituras atribuibles, UUID/campos/sumas, pull/reinicio/B, corrupción, transporte y es/en/ca probados. Recuperación financiera compartida abierta: depende de FIN-03/08, revisión/ACK y ensayo SQL/RLS. No aplicar copias reales como test. |
| **SEC-01 · P1 · validar entradas Edge** · **inventario hecho el 9/9** | **Son 13 funciones**, no 10: `bank-aspsps`, `bank-callback`, `bank-connect`, `bank-disconnect`, `bank-sync`, `categorize`, `delete-account`, `ingest`, `myinvestor-connect/-disconnect/-keepalive/-sync`, `prices`. **Autenticación: mejor de lo que decía el hueco.** `config.toml` pone `verify_jwt = true` en 9. Las tres sin JWT tienen protección propia comprobada: `ingest` (INGEST_TOKEN), `bank-callback` (localiza al usuario por el `state` que emitió `bank-connect`) y `myinvestor-keepalive` (cabecera `x-cron-key` contra `cron_secrets`, que solo lee el service role). `prices` está mejor validada de lo que parecía: filtra los símbolos por regex y corta en 25 — se comprobó por si podía dispararse un fetch por símbolo, y no. | **Lo que SÍ falta, medido:** (1) **`delete-account` no aparece en `config.toml`** — depende del valor por defecto. Su código sí exige sesión (`getUser`, 401 sin ella), así que no es un agujero, pero la función más destructiva no puede depender de un defecto implícito: ponerlo explícito. (2) **Ningún endpoint limita el tamaño del cuerpo** (0 de 13): no hay `content-length` ni tope de bytes en ninguno. (3) Faltan las pruebas de cuerpos inválidos → 4xx controlado y sin efectos, por endpoint. Pendiente también ejecutar los tests Deno: aquí no está instalado y la suite los omite. | Inventariar todas las funciones actuales, autenticación, tipos, límites de tamaño/rango y errores. Pruebas de bodies inválidos → 4xx controlado, sin efectos. Casos por endpoint; no declarar cubierta una API por validar solo el cliente. |
| **SEC-02 · P2 · límites de peticiones / replay** · **medido el 9/9** | Contado función a función: el limitador solo se usa en **2 de 13** — `ingest` y `myinvestor-connect`. Las otras once no lo llaman, incluidas `prices` y `categorize`, que son las que gastan cuota de terceros (Finnhub/Yahoo y el clasificador). | Clasificar endpoints por coste/autenticación; aplicar o justificar límites con pruebas de usuario/IP según contrato, concurrencia y caducidad. Revisar replay sin convertir dedup de notis en descarte de pagos legítimos. Despliegue separado y autorizado. |
| **SEC-03 · privacidad de logs** · **Cliente aprobado; entrega exclusiva 4.26.57, sin Edge** | Beta 4.26.57.1/f2354a47, Claude GO y CI/publicación 36349262562 SUCCESS. Candidata exclusiva PR49 con revisión Claude y CI completos previos. [Matriz](briefs/sec03-privacidad-logs.md). | [Entrega exclusiva PR49](https://github.com/JuanjoAvila/Aely/pull/49) y manifiesto público verificable; servidor pendiente por función. FIN-05/selector/TR no están aprobados: conservados en beta, pago pendiente. |
| **OPS-03 · P2 · beta con varios probadores** | Un canal beta y panel existen; falta demostrar acceso/veredictos independientes de varios usuarios sin hacerlos administradores. **Medido el 9/9: 15 de las 18 tandas tienen sus puntos de `en` y `ca` en CASTELLANO copiado.** Hoy no se nota porque el único probador usa la app en castellano; en cuanto entre un segundo probador, sí. El guardián `novedades-idiomas` NO lo cazaba: miraba `rnItems` (Novedades, que ve la familia), no `tandas[].items` (el panel de beta). **Cobertura preventiva desde el 4/10:** ese mismo test lee ahora la estructura cruda de todas las tandas y exige título y puntos no vacíos en es/en/ca, con el mismo número de puntos; medido ese día, las 55 tandas lo cumplen y ninguna tiene los puntos de `en` o `ca` idénticos a los de `es`. Límite: no compara los textos entre idiomas ni juzga la traducción, así que un castellano copiado en una tanda nueva seguiría sin cazarse; y el panel sigue leyendo las tandas en castellano, que es su contrato actual. | Diseñar alta de probador y matriz de permisos; dos cuentas de pruebas, veredictos separados y cambio de canal fiable. Sin tercer canal Experimental. Flags solo si una necesidad concreta lo exige. |
| **OPS-04 · P2 · métricas agregadas** | Uso/performance instrumentados desde 4.13 (`USO_OK`, `logPerf`); no reimplementar eventos. Vista SQL agregada pendiente de confirmar. | Buscar primero migración/vista existente. Si falta, propuesta por etiqueta/semana y tiempos, sin campos libres ni datos financieros. Usar panel de Supabase para consultas caras/Edge, no construir otro dashboard por defecto. |
| **OPS-05 · P2 · higiene de repositorio y PR** | Matriz medida el 9/9, abajo. **#42 integrada** por fast-forward; **#35 y #36 cerradas** con su OK. **Rescatado a `beta` lo que quedaba vivo en #41, #31, #30 y #26**: dos briefs que no estaban (`b09-d-widget-inicio-desacuerdo`, `incidencias-integridad-2026-09-06`), el delta del brief de #31 con los dos defectos reproducidos que hoy son FIN-04, y el incidente de HEAD separado en `EMPIEZA-AQUI`. Las cinco quedan **listas para cerrar, pendientes de su OK**; las ramas NO se borran sin permiso. Comparar commits/diffs, rescatar solo contenido vigente y documentar equivalencia antes de cerrar PR. Retirar sondas/código muerto con evidencia. Ramas/worktrees requieren permiso para borrar. No refactorizar dinero dentro de esta limpieza. **Hallazgo aparte, arreglado y ya en beta con 4.19.17:** `scripts/run-tests.mjs` llamaba a `npx playwright`, que en esta máquina no existe (faltan los wrappers `.bin`); el runner marcaba `FAILED: playwright-e2e` **sin haber ejecutado un solo e2e**. Parecía un rojo de la suite y era el arranque. | Comparar commits/diffs, rescatar solo contenido vigente y documentar equivalencia antes de cerrar PR. Retirar sondas/código muerto con evidencia. Ramas/worktrees requieren permiso para borrar. No refactorizar dinero dentro de esta limpieza. |
| **OPS-06 · P2 · validación real de la ronda** | 164 E2E pasan; quedan casos fuera de esa suite y veredictos antiguos rechazados. | Revalidar por versión exacta, sin datos destructivos: frío/offline/reentrada, cambio de mes, dos dispositivos, notificaciones nativas y restauración. Cada fallo nuevo necesita prueba que falle antes y pase después, registrada en runner/mapa. |

## Funciones y experiencia que siguen en la cola

| ID | Estado | Próximo paso / cuándo se termina |
|---|---|---|
| **BRAND-01 · P1 · la app se llama AELY** · **NUEVO 10/9, decisión suya** | Nombre OFICIAL: «renombre de mi app con nombre ya OFICIAL se llama Aely». Brief cerrado en [AELY_BRAND_BRIEF.md](design/aely/AELY_BRAND_BRIEF.md), que dice literalmente «no inventes otra identidad: aplica exactamente esto». Icono **A-Dot Badge** (A geométrica menta con el travesaño convertido en punto, dentro de un marco rounded-square), **lockup** badge+wordmark en el header del onboarding, **sin mascota** (lo dice dos veces), tokens dark mint (`accent #6CC688`, `bg #0B140F`, `surface #132119`). Su orden de ataque: «empieza por strings + header del onboarding + icono/splash». ⚠ **Faltan los dos PNG de referencia** en `docs/design/aely/`. | Trocear en tres, porque no todo viaja igual: **A (web, va por beta)** strings + lockup del onboarding + tokens; **B (nativa, pide APK y su OK)** icono, splash y `android:label`; **C** dominio, Pages y metadata de release. ⚠ **NO tocar `applicationId`**: sería una app NUEVA y su padre y su pareja perderían la suya con sus datos dentro. ⚠ Icono y splash **no viajan por OTA**. Repasar también los textos que lee la familia (notas de versión, popup de Novedades) y no dejar «Aely» a medias. |
| **UX-01 · scroll/gestos y Gastos a medio pintar** · **REPRODUCIDO Y MEDIDO EL 10/9** | Su gesto es **entre pestañas**, no la lista, y **solo yendo despacio**. Dos causas medidas en su móvil, [brief](briefs/ux01-tironcillo-medido-2026-09-10.md): (1) el contenido saltaba **44 px** al entrar/salir de `page-scroll-host` — arreglado y verificado en caliente (7 saltos → 0); (2) el carrusel avanzaba **un frame sí y otro no** al arrastrar despacio, porque el `transform` se escribía en cada `touchmove` (~2,7 por frame). ⚠ Los deltas de `rAF` NO valen para medir esto: salían perfectos con el fallo puesto. Destello de tabs y antiguos tirones están arreglados; son síntomas diferentes del stopper residual. | Reproducir el gesto exacto, inercia tras soltar, splash fuera, CPU x6 y frames >32 ms. A/B, sin medir el sondeo de Playwright. Gastos: comprobar nodos/opacidad/paginación y versión/APK. Si no se reproduce, no publicar un «fix» especulativo. |
| **UX-02 · apertura del perfil / diseño** | Pintado residual documentado; trucos CSS ensayados no demostraron mejora. Tanda 17, SPEC-v4 y [handoff de diseño](design/handoff/). | Propuesta de menos contenido inicial/jerarquía y mock revisable, con accesos a todas las funciones preservados. Medición y E2E de las puertas de entrada antes de implementar el rediseño. |
| **UX-03 · splash e icono nativo/JS** | Pendiente de verificar el síntoma restante. La franja bajo cámara y WEBDEBUG ya se corrigieron en 4.16.1; no confundir con dos pantallas de arranque. | Comparar arranque frío real con APK actual y rama `wip/splash-icono-nativo`, sin fusionarla a ciegas. Unificar solo lo que siga fallando; cualquier Java/tema nativo requiere APK. No dar por pendiente la antigua barra de carga sin comprobarla. |
| **UX-04 · sugerencias sin cierre fiable** | Contrastado con `npm run sugerencias` el 9/9: quedan 7 eventos. **El mensaje al actualizar cuentas está atendido**: `bank_upd_one/n` = «✓ {banco} al día · {x}» / «✓ {n} bancos al día» en los tres idiomas (`01-i18n.js:1880/1899/1918`, usado en `11-app-main.js:501`). Es claro y conciso, que era la petición del 26/7. El acceso tocando la cartera superior (de su pareja, 16/7, v3.109): **preguntado y resuelto el 9/9**. Se refería al **avatar de Inicio**, y la petición quedó anticuada — tocarlo ya abre el perfil desde la v4. **Fila cerrada, las dos sugerencias atendidas.** | Registrar el cierre del mensaje salvo feedback nuevo. Para el acceso superior, localizar pantalla/intención antes de proponer cambio; si sigue ambiguo, aclaración puntual al dueño. La mera presencia de feedback viejo en la tabla no significa que siga sin atender. |
| **UX-06 · pulido visual v4** · **P1–P14 HECHAS**, bonus en curso | El brief ya está en el repo (`docs/design/handoff/PULIDO-v4.md`, lo trajo él el 9/9). Rama `claude/pulido-v4`, **un commit por tarea** como pidió, versiones 4.19.18 (P1–P5), 4.19.19 (P6–P13) y 4.19.20 (P9, P10, P14, B3). **Dos tareas no se aplicaron como decía el brief, y por qué:** la mitad de **P3** (onboarding) ya no aplica —es un stepper con 700 preseleccionado, no un placeholder—, y **P14** se decidió por voto del equipo: mi medida en euros decía que no hacía falta (248 px de 324), pero Codex reprodujo el caso que faltaba —la moneda de visualización llega al hero, y con yenes y patrimonio negativo se parte en dos líneas—, así que se aplicó la opción C. **B2 NO se entrega**: la app premonta las pestañas, la cuenta se gasta escondida, y el segundo intento con `IntersectionObserver` tampoco vale porque los paneles desplazados se dan por visibles. Medido tres veces. | Pendiente: **B4** (esqueletos) y **B5** (repaso en tema claro), con Cursor; **B2** con Cursor para segunda opinión; **B1** lo dejó él con motivo (implicaría retrasar el borrado en la nube). Al cerrar: review completa de la rama ejecutando, y publicar. **Verificado en su móvil de verdad** (OnePlus 13, Android 16): P1–P5 en pantalla y P8 dentro de la APK, con y sin «Letra grande». |
| **UX-07 · temas primavera, otoño y cyberpunk** · **NUEVO 16/9** | Su pareja quiere temas de **primavera** y **otoño**; otoño es el oportuno ahora. Él quiere uno **cyberpunk** con identidad propia: no reutilizar el efecto suave/típico de partículas estacionales. | Diseñar primero mocks navegables + spec + textos es/en/ca. Primavera/otoño pueden ampliar el sistema estacional; cyberpunk necesita lenguaje visual y microefecto propio, assets offline, `prefers-reduced-motion` y medición en móvil para no degradar scroll, pestañas ni arranque. Validar los tres antes de implementar/publicar. |
| **UX-05 · doble filtro en Mis bancos** | **Leído el código el 9/9 (Claude): ya no hay dos filtros.** `histOpen` pasa a `BankHistoryImport` la lista ENTERA de bancos conectados (`10-app-components.js:3911`), no un banco elegido antes; dentro solo queda `bankFilter` (`:274`, chips en `:558`), y ese filtro sí acota la importación de verdad (`doImport` recorre `visible`, no `cands`). La puerta duplicada desde Mis bancos también se retiró: se entra por Ajustes → Importaciones. | **CERRADA el 9/9 con evidencia ejecutada**, no solo leída: `e2e/bancos-historico-filtro.spec.mjs` corrió hoy 5/5 en Chromium y comprueba en el DOM real que sin tocar nada salen los movimientos de TODOS los bancos conectados, que filtrar a uno esconde los del resto **y los saca del contador de importar**, y que «Todos los bancos» recupera la vista. Además comprueba que la puerta duplicada desde Mis bancos ya no existe. Una sola selección de banco, verificada en pantalla. |
| **PRO-01 · meta financiada fuera de gasto corriente** | Diseñado, pendiente de prioridad/validación de alcance: [plan](briefs/plan-tanda-5-meta-gasto-mes.md). La foto antigua de metas vacías no prueba su estado de hoy. | Releer plan contra beta; saldo de meta, bancos asociados, agotamiento y retorno al presupuesto normal. Pasar por `expenseCountsBudget` y espejo servidor. El plan excluye cuenta diaria para evitar cambiar contrato nativo; ampliarlo exigiría APK/decisión. No reescribir todo `monthBudgetStats`. |
| **PRO-02 · fin de mes en paz** · **verificado en código el 9/9** | Leído `03-tab-dash.js:83-89`: `pace = gastado/días transcurridos`, `projected = gastado + pace × días que quedan`, `overTrack = projected > presupuesto`, y el titular del estado ya cambia con eso (bien / justo / te pasas). O sea que **la proyección de cierre existe y se pinta**. Lo único que NO consta es que él la haya visto y dicho si le vale. **Ya implementado en parte desde 3.110.** `03-tab-dash` calcula `pace/projected/overTrack`, pinta estado y disponible diario; cash-flow y alarmas por banco también existen. La petición literal de proyección de cierre debe contrastarse con esa UI. | Verificar aceptación de la experiencia existente con datos sintéticos, calendario personalizado y sin ingresos previstos. Solo proponer la diferencia concreta que falte. Explicar supuestos; no presentar previsión como saldo cierto ni duplicar alarmas. |
| **PRO-03 · recordatorio de recibos grandes** · **verificado en código el 9/9; falta UNA cosa concreta** | Leído `11-app-main.js:1826-1846`: avisa **la víspera** de cada fijo no pagado, y **2–3 días antes** si pasa de un mínimo; las **cuotas de deuda** también avisan la víspera; hay dedupe por mes (`_rc1_<id>_<ym>`) y traspaso de sellos con el `AlertCheckWorker` nativo para no avisar dos veces. **La diferencia que falta es exactamente una:** el aviso dice nombre e importe, pero **no dice si el saldo previsto llega**. Eso es lo que él pidió y es lo único que queda por hacer aquí. **Recordatorios ya implementados.** `11-app-main` avisa la víspera y antes para cargos grandes; envía calendario al `AlertCheckWorker` nativo. Falta acreditar el caso pedido de insuficiencia proyectada en el aviso. | Verificar fecha, banco, saldo proyectado, repetición/cancelación y falta de datos. Reutilizar calendario/worker; no construir otro sistema de avisos ni hacerlo depender de FCM. Si el aviso actual satisface el caso, cerrar con evidencia; si no, acotar solo esa mejora. |
| **PRO-04 · informe exportable PDF** · **confirmado que falta** | Comprobado el 9/9: no hay **ni una** referencia a `application/pdf`, `jsPDF` ni a generar un `.pdf` en todo `src/` — el importador de PDF que sí existe es de ENTRADA, no de salida. Lo que hay es imagen: `rp_btn` «📸 Informe del mes (imagen)» y `mr_share` «📸 Crear imagen del informe», con guardado en Descargas (`rp_saved`). Informe mensual + compartir PNG implementados en 4.19.12 y aprobados; no rehacerlos. PDF adicional no consta implementado. | Confirmar necesidad del formato y reutilizar datos/render del informe; pruebas de descarga/compartir, tres idiomas y mes sin datos. PDF de salida es distinto del importador PDF, que ya existe. |
| **PRO-05 · avisos push de nueva versión** | Watcher OTA/notificaciones locales no equivalen por sí solos a push con app cerrada para otros usuarios. Tanda 12. | Auditar canal actual; diseñar FCM o solución compatible con cero dependencias nuevas sin permiso. Permisos, dedup, canal/versiones, baja y pruebas en dispositivo. Credenciales, backend y despliegue requieren aprobación. |
| **PRO-06 · MyInvestor / inversiones sincronizadas** | Integración existente, reCAPTCHA/fiabilidad por confirmar. Fallback nativo aplazado; CSV/Excel disponible. | Ensayo acotado de la vía actual; si falla reCAPTCHA en móvil, propuesta de WebView en dominio propio del proveedor y APK. API no oficial requiere decisión de alcance; no pedir ni registrar credenciales en repo. No rehacer importadores existentes. |
| **PRO-07 · pensiones y cuentas de ahorro** | Pedido, sin alcance final ni soporte de proveedor demostrado. Tanda 13. | Modelo y vista de posiciones, aportaciones y datos desconocidos; confirmar qué ofrece proveedor frente a manual/import. Conexión/permiso bancario nuevo se diseña antes de activar. |
| **PRO-08 · Hogar** | Modelo de compartir y código ya existen ([HOGAR](HOGAR.md), módulo 13). Falta acreditar toda la aceptación con dos usuarios y cerrar diseño si procede. | Matriz cuentas/patrimonio/gastos/fijos, invitación, lectura mutua y descompartir; aislamiento y revocación en entorno de pruebas. Sin escritura cruzada de estado del otro. No presentar como función que hay que construir desde cero. |
| **PRO-09 · Pregúntame** · **IMPLEMENTADO EN 4.26.3, pendiente de beta** | Ayuda local/offline para presupuesto, recibos, saldos y uso de la app; abre destinos reales sin guardar ni sincronizar. La interpretación remota tiene consentimiento revocable, doble filtro de secretos y respuesta cerrada; 14 E2E cubren privacidad, errores y CPU ×6. | Validar la ayuda local en móvil. La Edge sigue apagada: activar `OPENAI_API_KEY` + `AELY_HELP_AI_ENABLED=true` solo tras aprobar coste y transmisión de la pregunta escrita. No convertirla en asesor financiero ni enviar estado bancario. |
| **TEC-01 · módulos financieros y adaptadores** | Refactor aplazado, no arreglo urgente. Hay extracción de lógica pura para tests. | Solo tras integridad: plan incremental por dominio y contrato común de bancos, sin dependencia nueva ni reescritura del monolito de una vez. Paridad de datos y cobertura existente. |
| **TEC-02 · claves i18n presuntamente huérfanas** | [Aparcado deliberadamente](briefs/i18n-orphans-aparcado.md); hay claves dinámicas que el barrido simple no ve. | No borrar masivamente. Si se retoma, demostrar usos dinámicos y mejora real en gzip, tres idiomas y render. |
| **OPS-06 · la ronda de tortura ANTES de la Play Store** · **NUEVO 12/9, encargo suyo** | Textual, al acabar de reportar que la app se ralentiza exprimiendo el scroll: *«cuando acabemos de implementarlo todo, que no parece ser que sea hoy ni mañana, te pediré que la **destroces**: pruebas de rendimiento a full, probando todo tipo de botones, intentando “hackearla” a ver si hay fallos de seguridad; eso va a ser una tarea intensa y guapa antes de publicarla en la Play Store»*. No es DEC-01 (aquello es marca, precio y condiciones): esto es el **encargo técnico concreto** que va justo antes. | Tres frentes, y el orden importa. **1 · Rendimiento:** el gesto que ya rompe (bajar/subir/scrollear en Gastos hasta que se degrada la app entera) más pestañas, listas largas y meses cargados; medir la PENDIENTE (listeners, nodos, heap, timers vivos), no el frame suelto. **2 · Aporrear:** cada botón, doble toque, gesto a medias, sin red, sesión caducada, banco caído, importar dos veces — que nada deje el estado a medias ni escriba dos veces en la nube. **3 · Seguridad, y ahí se mira lo que hoy nadie mira:** qué guarda `localStorage` y si sobrevive a desinstalar, qué viaja en `app_events`, permisos del `AndroidManifest`, el `applicationId` (⚠ **línea roja: no se toca**), la firma, las claves del cliente de Supabase y qué puede hacer un usuario con ellas, las políticas RLS de cada tabla, y las Edge Functions sin autenticar. ⚠ Con usuarios de fuera, un fallo de RLS deja de ser un susto en familia. |
| **DEC-01 · marca / Play Store / monetización** | Decisiones futuras del dueño, **Play siempre al final**. Nombre vigente Aely; no renombrar a Alforja. | Antes de publicar/cobrar: elección de marca y comprobaciones actualizadas, condiciones/privacidad/fiscalidad y modelo comercial. No desplegar pagos ni iniciar publicación por este relevo. |
| **DEC-02 · ideas opcionales** | Logos bancarios autohospedados, más modos sencillo/avanzado y dashboard operativo completo: no comprometidos para esta tarde. | Mantener como opciones; no añadir CDNs, dependencias ni pantallas sin necesidad acordada. |

## Panel de beta: qué queda probar, no qué queda construir

Foto de `npm run listo`, 9/9: **16 tandas: 3 aprobadas, 3 rechazadas y 10 sin veredicto**.
Los rechazos pertenecen a compilaciones anteriores: hay correcciones posteriores, pero nadie
puede convertirlas en aprobación por el dueño. La ronda entera sigue bloqueada.

| Estado | Tandas |
|---|---|
| Aprobadas, conservar cerradas | `4.19.14/revision-plegable`, `4.19.13/presupuesto-categoria`, `4.19.12/informe-mes` |
| **Rechazo anterior CON ARREGLO YA EN SU MÓVIL** (rastreado el 9/9) | `4.19.1/avisos-presupuesto` → `2a42e255` y `4.19.0/tr-reactivo` → `ca1f33f3`, las dos dentro de 4.19.14.1. **Puede volver a probarlas sin publicar nada.** |
| Rechazo anterior, **NO re-ofrecer todavía** | `4.19.2/ventana-mes`: B09-D cerró una causa, pero FIN-05 sigue abierto (respuestas tardías de ingest contra snapshot nuevo). Pedirle que lo pruebe otra vez es hacerle repetir el fallo |
| Sin veredicto; histórico/efectivo primero necesitan FIN-01/02 | `4.19.11/import-puertas`, `4.19.10/efectivo`, `4.19.9/import-deshacer`, `4.19.8/import-historico` |
| Sin veredicto restante | `4.19.7/aprobadas-no-vuelven`, `4.19.6/repetido-widget`, `4.19.6/widget-al-volver`, `4.19.1/id-fila`, `4.19.0/categoria-ia`, `4.19.0/orden-gastos` |

## Trabajo ya hecho y correspondencia con las listas antiguas

El inventario de agosto numeraba **1–23**, además de higiene, saldo cruzado y doce puntos del
crucero. Este cruce impide perder pedidos y también evita implementar dos veces lo terminado.

| Entrada antigua | Destino actual |
|---|---|
| Agosto 1 Ajustes Dinero | Limpieza publicada desde 4.14; no volver a construirla. |
| Agosto 2 doble filtro | UX-05, verificar si ya cerrado. |
| Agosto 3/4 presupuesto y widget | Alineación y resume implementados; FIN-04/05 y OPS-01/06 pendientes. |
| Agosto 5 todos los bancos | Selector `expenseBanks` y lista de bancos diarios implementados; no reabrir la decisión de contar todos los diarios salvo neutros. |
| Agosto 6 histórico | Implementado parcialmente; FIN-02/03/07 y pruebas móviles pendientes. Undo concurrente corregido en 4.19.14. |
| Agosto 7/8/9/10 | PRO-05 push, PRO-07 pensiones, PRO-06 MyInvestor, UX-03 splash. |
| Agosto 11/12/13/14/15 | Tendencia y recordatorios **ya tienen implementación**: PRO-02/03 verifican la diferencia pendiente. Límites categoría e informe mensual **aprobados**; PNG **hecho**, PDF PRO-04. |
| Agosto Hogar | PRO-08, código existente y validación/diseño restante. |
| Agosto 16/17/18/19/20/21 | SEC-01/02/03; OPS-03; eventos hechos + OPS-04; TEC-01; import PDF/DOCX **hecho para formatos soportados**, backups/UI **hechos** + OPS-02. PDF escaneado no tiene OCR: límite, no feature prometida. |
| Agosto 22/23 | DEC-01. |
| Higiene / saldo cruzado adicionales | OPS-05; cierre diario previo corregido, interacción nueva con efectivo FIN-01. |
| Crucero widget / Revolut negativo / saldo OB-TR | Widget FIN-05; negativo inventado y saldo cruzado tienen fixes publicados. Si reaparecen, reproducir con versión/datos de origen; no aplicar otra compensación automática. |
| Crucero banco visible / qué cuenta / Movimiento / nuevas categorías / selector banco / calendario | Implementados. Conservar en pruebas de regresión; no nuevas tandas por esas funciones. |
| Crucero mejor IA / meta / efectivo | Pregúntame implementado en PRO-09; categorías/orden siguen aplicándose solo a nuevos/importados, sin recategorizar pasado. Meta PRO-01 y efectivo FIN-01. |
| Plan crucero 8 destello / 8 bis gestos nuevos / 9 Ajustes / 11 Hogar / 16 higiene / 17 diseño | Destello y arranque de gestos hechos; stopper distinto UX-01. Ajustes hecho; PRO-08, OPS-05, UX-02. |
| Backlog julio: cuotas/deudas, onboarding, idiomas, widgets, amortización, ingresos y edición, inversiones, retos, cargos puntuales, cash-flow | Los Projects 1 y 3 figuran todos Done (18 elementos cada uno; se solapan). No hay issues abiertas al consultar. Es inventario histórico, no verificación financiera renovada de cada feature. Round-up (#19) también Done. |
| Sugerencias app (7 existentes) | Mensaje actualización **corregido** (`bank_upd_one/n`); acceso superior UX-04. Histórico en tres idiomas y lag Deudas: implementados. Icono y retirada de barra de carga tienen fixes documentados; síntoma nativo restante UX-03, marca DEC-01. Ingreso Caixa **corregido** (`ob-ingresos.test.mjs`); diálogo amortización **corregido** (`askText/askConfirm`, 3.100). No reabrir sin evidencia nueva ni borrar el feedback histórico. |
| Viejas ideas salud, ADR, observabilidad, rendimiento y analytics | Herramientas/instrumentación existentes; no reconstruir. Agregado OPS-04; seguridad y restauración siguen pendientes. Tercer canal Experimental descartado. |

## PR abiertas: revisar el contenido, no fusionar por antigüedad

Foto de GitHub el 9/9. No se han cerrado PR ni borrado ramas en este relevo.

| PR | Tratamiento pendiente |
|---|---|
| ~~[#41](https://github.com/JuanjoAvila/Aely/pull/41)~~ · **rescatada, lista para cerrar** | **Medido el 9/9 (`git cherry` + diff por fichero): casi todo incorporado, y su rama va ATRÁS.** Su `EMPIEZA-AQUI.md` **borra** el puntero a este backlog (es anterior). Lo único suyo que no está en beta: la trampa 8 y el incidente «se fusionó en detached HEAD y `beta` no se movió» (8/9). Rescatar esas dos frases sueltas y cerrar. No fusionar la rama. |
| ~~[#35](https://github.com/JuanjoAvila/Aely/pull/35), efectivo; [#36](https://github.com/JuanjoAvila/Aely/pull/36), edit-link~~ · **CERRADAS el 9/9** con el OK del dueño | **Los dos redundantes, comprobado antes de cerrar.** #36: `git cherry origin/beta` no devuelve NADA — cero commits fuera de beta. #35: su único commit `fb52ee94` sale con `-`, o sea que beta ya tiene su parche equivalente. **Cerrables sin rescatar nada**, con el OK del dueño. Ojo: no reabrirlos encima de FIN-01, que toca justo el efectivo. |
| ~~[#31](https://github.com/JuanjoAvila/Aely/pull/31)~~ · **rescatada, lista para cerrar** | Código integrado; **fuera de beta queda solo un delta del brief `b09d-codex-resume-categorias.md`, y merece rescate**: el enlace a la ejecución de CI que sí pasó entera (`fc80bf39`) y la revisión de Codex sobre mi propuesta con los **dos defectos reproducidos** que hoy son FIN-04 (decisión de A deshecha por el pull de B; UPDATE que afecta a cero filas sin error). Es evidencia, no opinión: no dejarla morir en una PR cerrada. |
| ~~[#30](https://github.com/JuanjoAvila/Aely/pull/30)~~ · **rescatada, lista para cerrar** | Medido: `arquitectura-identidad-gastos.md` está en beta pero **DIFIERE** de la versión de la PR — comparar las dos antes de cerrar, no dar por buena la de beta solo por estar. `RELEVO-CLAUDE-CURSOR-2026-09-08.md` y `b09-d-widget-inicio-desacuerdo.md` **no existen en beta**; el primero lo sustituye el relevo del 9/9, el segundo es el desacuerdo técnico del widget y conviene rescatarlo. |
| ~~[#26](https://github.com/JuanjoAvila/Aely/pull/26)~~ · **rescatada, lista para cerrar** | Medido: sus **tres** briefs (`REANUDAR-CODEX.md`, `canal-equipo.md`, `incidencias-integridad-2026-09-06.md`) **no están en beta**, 308 líneas. El protocolo del canal describe roles ya derogados (Codex coordinando); el de incidencias es forense útil. Rescatar el forense, no el protocolo caduco. |
| ~~[#24](https://github.com/JuanjoAvila/Aely/pull/24)~~ · **sin nada que rescatar** | Del 18/8, **tres semanas atrás**; sus cinco ficheros difieren de beta y apunta a `main`. Su contenido ya está cruzado en este backlog. Cerrar sin fusionar salvo que el diff enseñe algo que aquí falte. Su frase «directo main» NO autoriza desplegar backend compartido. |

## Cierre de cada encargo

Registrar **ID, base, SHA/PR, prueba que reproducía el fallo, resultado después, revisión ajena,
CI y versión realmente publicada**, o bloqueo concreto y trabajo que queda. Sin datos personales
en el repo público. Implementado no significa probado en Android ni desplegado en Supabase.
Antes de pedir aprobación móvil: versión exacta, pasos cortos, resultado esperado, límites y
OTA frente a APK. Solo el dueño cambia el veredicto y decide producción.

INC-2909-03: candidata79 injertada sobre Nómina78 final eaf55e4a, sin publicación ni OK móvil; entrega conjunta prevista en beta80.
Reproducción de puertas banco/Efectivo/tipo y categoría Traspaso, ACK por identidad exacta y no
operación de efectivo importado explicada. FIN-04/RLS y suma compartida siguen limitados.
[Contrato, pruebas y coordinación](briefs/inc-2909-03-retirada-caixa.md).


Movilidad88 se integra en worktree propio sobre039d; no incorpora arreglos nuevos de los extras3/10 ni acredita aprobación móvil o producción.

Corte4/10 · OPS-0410 panel: PR121 integrado solo beta, CI37198285128 pendiente; cierre93 de dos hallazgos independientes implementado y comprobado, sin añadir otra tanda. Metas mensual automática encargada a Claude en paralelo, versión>=94; no incluida ni declarada completada en este cambio.
