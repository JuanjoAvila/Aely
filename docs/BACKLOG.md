# Backlog operativo — Mi Cartera

Actualizado el **9 de septiembre de 2026** a petición del dueño: dejar trabajo concreto para
Claude y Cursor durante la tarde/noche. **El backlog completo NO está terminado.** El panel de
beta solo enumera entregas para probar; no enumera todo lo que falta construir o verificar.

Este es el índice operativo. Los briefs conservan el detalle y los espejos de `docs/memoria/`
conservan historia; sus antiguos «todo cerrado» o «ninguna empezada» no son el estado actual.
Actualizar esta tabla al entregar: commit, pruebas, versión publicada y siguiente paso.
Una tarea implementada, una verificada por tests y una aprobada en móvil son estados distintos.

## Base y límites de la revisión

- Base de código: `4b71f572` · versión fuente **4.19.14**. Beta publicada **4.19.14.1**,
  producción **4.18.7**, APK **42 / 4.18.3**, contrastados con el canal y Actions.
- [Auditoría y reproducciones](briefs/AUDITORIA-CODEX-2026-09-09.md): lógica, cuatro ficheros
  Deno y **164/164 E2E Chromium**; últimos 26 casos del panel/histórico repetidos tras el ajuste.
  [CI de la entrega](https://github.com/JuanjoAvila/Mi-Cartera/actions/runs/34355741591).
- Este inventario cruza ROADMAP, los dos backlogs antiguos, plan del crucero, relevo del 9/9,
  auditorías/briefs, mensajes del equipo, sugerencias de la app, PR abiertas y Projects 1 y 3.
- **No es una garantía de ausencia de bugs.** No se ha auditado cada ejecución posible ni
  inspeccionado el código desplegado de todas las Edge Functions, índices/RLS reales o todas
  las políticas del servidor. Tampoco se ha ejecutado en esta auditoría una compra real con la
  app cerrada, una reinstalación real, restauración completa ni dos móviles reales simultáneos.
  Los tests con puentes/servidores simulados no cubren esas garantías; abajo tienen encargos.
- Antes de retomar: `git fetch origin`, `npm run salud`, `npm run listo`, `npm run sugerencias`
  y último Actions. Esta foto envejece; una PR abierta o un documento viejo no prueba trabajo ausente.

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
| **FIN-06 · P1 · divisa sin cambio** | **Fallo documentado**, [brief](briefs/divisa-desconocida-uno-a-uno.md): cliente usa importe crudo como euros donde servidor devuelve desconocido. La UI para dato ausente aún necesita concretarse. | Preparar propuesta visible conservando importe/moneda originales y señal de total incompleto; nunca inventar 1:1 ni sumar desconocido como cero sin explicarlo. Auditar consumidores, USD de respaldo y redondeo. Misma tabla de EUR/USD/TRY/desconocida en cliente/servidor, también sin red. No introducir peticiones de red en cálculo puro ni reescribir el pasado. |
| **FIN-07 · P1 · histórico cloud completo** | **Pendiente.** `pullExpenses` limita a 2000; la UI ahora avisa. El aviso no descarga el resto. También revisar recorte/snapshot de `flattenBankTx` y procedencia por cuenta. | Paginación estable, sin huecos/repetidos entre páginas, >2000 filas y altas concurrentes; distinguir consulta parcial de borrado. No usar ausencia del pull para eliminar ni para identificar gastos. Coordinar con FIN-03 y rendimiento del guardado partido. |
| **FIN-08 · P1 · daños históricos previos** | **Investigación pendiente**, no afirmación de pérdida adicional actual. La contención 4.18.6 evita DELETE/lápidas automáticas por similitud, pero no recupera lo que antes se colapsó, borró o recategorizó. | Inventario privado con evidencia por fila, copia restaurable y propuesta revisable. Conservar importes, UUID, bancos y notas; sumas iguales no demuestran mismas filas. Reparación de datos reales requiere aprobación; no migración automática al arrancar. Depende de FIN-03/07 y OPS-02. |

## Operación, seguridad y cobertura pendiente

Estas filas son **trabajo pendiente de auditoría o validación**, no vulnerabilidades demostradas.

| ID / prioridad | Qué existe / qué falta | Encargo y aceptación |
|---|---|---|
| **OPS-01 · P1 · repo frente a servidor vivo** | Supabase compartido; cambios de cajero, categorías, ventana mensual y `#dup` en disco no prueban despliegue. | Claude inventaría funciones/migraciones y versiones activas con acceso de lectura, sin volcar secretos ni datos. Matriz repo/servidor/APK y pruebas de contrato; preparar diff y rollback antes de pedir despliegue. El ATM del cliente no completa el camino de notificaciones del servidor. |
| **OPS-02 · P1 · restauración probada** | Ya existen copia diaria, `listBackups`/`getBackup` y UI de restaurar (`00-core`, `10-app-components`, `11-app-main`). «Construir backups» sería repetir trabajo. No consta en esta revisión ensayo completo de restauración. | Restaurar en perfil/datos de pruebas: estado partido, gastos cloud, decisiones de duplicado, borrados y cambios posteriores. Comprobar antes/después por UUID/campo/suma, reinicio y segundo cliente. Probar cancelación, copia corrupta y falta de red. No restaurar la cartera real como test. |
| **SEC-01 · P1 · validar entradas Edge** | Hueco #8 de [AMENAZAS](AMENAZAS.md); el antiguo número de «10 funciones» está desfasado. | Inventariar todas las funciones actuales, autenticación, tipos, límites de tamaño/rango y errores. Pruebas de bodies inválidos → 4xx controlado, sin efectos. Casos por endpoint; no declarar cubierta una API por validar solo el cliente. |
| **SEC-02 · P2 · límites de peticiones / replay** | Hay `_shared/ratelimit.ts` e integración parcial (ingest/MyInvestor). Falta revisión sistemática de prices, categorize, bank-* y demás. | Clasificar endpoints por coste/autenticación; aplicar o justificar límites con pruebas de usuario/IP según contrato, concurrencia y caducidad. Revisar replay sin convertir dedup de notis en descarte de pagos legítimos. Despliegue separado y autorizado. |
| **SEC-03 · P1 · privacidad de logs** | Guardián de cliente y `USO_OK` ya existen. No prueban todas las rutas de app_events, Sentry y Edge. | Revisar construcción de errores, bodies y logs; redactar antes de enviar, nunca publicar volcados bancarios. Fixtures con marcadores sintéticos sensibles y verificación de que no salen. Si se detecta secreto expuesto, plan de rotación sin copiar su valor al informe. |
| **OPS-03 · P2 · beta con varios probadores** | Un canal beta y panel existen; falta demostrar acceso/veredictos independientes de varios usuarios sin hacerlos administradores. **Medido el 9/9: 15 de las 18 tandas tienen sus puntos de `en` y `ca` en CASTELLANO copiado.** Hoy no se nota porque el único probador usa la app en castellano; en cuanto entre un segundo probador, sí. El guardián `novedades-idiomas` NO lo caza: mira `rnItems` (Novedades, que ve la familia), no `tandas[].items` (el panel de beta). | Diseñar alta de probador y matriz de permisos; dos cuentas de pruebas, veredictos separados y cambio de canal fiable. Sin tercer canal Experimental. Flags solo si una necesidad concreta lo exige. |
| **OPS-04 · P2 · métricas agregadas** | Uso/performance instrumentados desde 4.13 (`USO_OK`, `logPerf`); no reimplementar eventos. Vista SQL agregada pendiente de confirmar. | Buscar primero migración/vista existente. Si falta, propuesta por etiqueta/semana y tiempos, sin campos libres ni datos financieros. Usar panel de Supabase para consultas caras/Edge, no construir otro dashboard por defecto. |
| **OPS-05 · P2 · higiene de repositorio y PR** | Matriz medida el 9/9, abajo. **#35 y #36 cerradas** con su OK. Quedan 5. **Hallazgo aparte, ya arreglado en `claude/fin-02`:** `scripts/run-tests.mjs` llamaba a `npx playwright`, que en esta máquina no existe (faltan los wrappers `.bin`); el runner marcaba `FAILED: playwright-e2e` **sin haber ejecutado un solo e2e**. Parecía un rojo de la suite y era el arranque. | Comparar commits/diffs, rescatar solo contenido vigente y documentar equivalencia antes de cerrar PR. Retirar sondas/código muerto con evidencia. Ramas/worktrees requieren permiso para borrar. No refactorizar dinero dentro de esta limpieza. |
| **OPS-06 · P2 · validación real de la ronda** | 164 E2E pasan; quedan casos fuera de esa suite y veredictos antiguos rechazados. | Revalidar por versión exacta, sin datos destructivos: frío/offline/reentrada, cambio de mes, dos dispositivos, notificaciones nativas y restauración. Cada fallo nuevo necesita prueba que falle antes y pase después, registrada en runner/mapa. |

## Funciones y experiencia que siguen en la cola

| ID | Estado | Próximo paso / cuándo se termina |
|---|---|---|
| **UX-01 · scroll/gestos y Gastos a medio pintar** | **Sin reproducción actual.** Destello de tabs y antiguos tirones están arreglados; son síntomas diferentes del stopper residual. | Reproducir el gesto exacto, inercia tras soltar, splash fuera, CPU x6 y frames >32 ms. A/B, sin medir el sondeo de Playwright. Gastos: comprobar nodos/opacidad/paginación y versión/APK. Si no se reproduce, no publicar un «fix» especulativo. |
| **UX-02 · apertura del perfil / diseño** | Pintado residual documentado; trucos CSS ensayados no demostraron mejora. Tanda 17, SPEC-v4 y [handoff de diseño](design/handoff/). | Propuesta de menos contenido inicial/jerarquía y mock revisable, con accesos a todas las funciones preservados. Medición y E2E de las puertas de entrada antes de implementar el rediseño. |
| **UX-03 · splash e icono nativo/JS** | Pendiente de verificar el síntoma restante. La franja bajo cámara y WEBDEBUG ya se corrigieron en 4.16.1; no confundir con dos pantallas de arranque. | Comparar arranque frío real con APK actual y rama `wip/splash-icono-nativo`, sin fusionarla a ciegas. Unificar solo lo que siga fallando; cualquier Java/tema nativo requiere APK. No dar por pendiente la antigua barra de carga sin comprobarla. |
| **UX-04 · sugerencias sin cierre fiable** | Contrastado con `npm run sugerencias` el 9/9: quedan 7 eventos. **El mensaje al actualizar cuentas está atendido**: `bank_upd_one/n` = «✓ {banco} al día · {x}» / «✓ {n} bancos al día» en los tres idiomas (`01-i18n.js:1880/1899/1918`, usado en `11-app-main.js:501`). Es claro y conciso, que era la petición del 26/7. El acceso tocando la cartera superior (de su pareja, 16/7, v3.109): **preguntado y resuelto el 9/9**. Se refería al **avatar de Inicio**, y la petición quedó anticuada — tocarlo ya abre el perfil desde la v4. **Fila cerrada, las dos sugerencias atendidas.** | Registrar el cierre del mensaje salvo feedback nuevo. Para el acceso superior, localizar pantalla/intención antes de proponer cambio; si sigue ambiguo, aclaración puntual al dueño. La mera presencia de feedback viejo en la tabla no significa que siga sin atender. |
| **UX-05 · doble filtro en Mis bancos** | **Leído el código el 9/9 (Claude): ya no hay dos filtros.** `histOpen` pasa a `BankHistoryImport` la lista ENTERA de bancos conectados (`10-app-components.js:3911`), no un banco elegido antes; dentro solo queda `bankFilter` (`:274`, chips en `:558`), y ese filtro sí acota la importación de verdad (`doImport` recorre `visible`, no `cands`). La puerta duplicada desde Mis bancos también se retiró: se entra por Ajustes → Importaciones. | **Solo falta que Cursor lo confirme en pantalla**, no leyendo el diff: abrir la pantalla y comprobar que hay UNA sola selección de banco. Con esa evidencia se cierra. Leer código no es verlo funcionando. |
| **PRO-01 · meta financiada fuera de gasto corriente** | Diseñado, pendiente de prioridad/validación de alcance: [plan](briefs/plan-tanda-5-meta-gasto-mes.md). La foto antigua de metas vacías no prueba su estado de hoy. | Releer plan contra beta; saldo de meta, bancos asociados, agotamiento y retorno al presupuesto normal. Pasar por `expenseCountsBudget` y espejo servidor. El plan excluye cuenta diaria para evitar cambiar contrato nativo; ampliarlo exigiría APK/decisión. No reescribir todo `monthBudgetStats`. |
| **PRO-02 · fin de mes en paz** | **Ya implementado en parte desde 3.110.** `03-tab-dash` calcula `pace/projected/overTrack`, pinta estado y disponible diario; cash-flow y alarmas por banco también existen. La petición literal de proyección de cierre debe contrastarse con esa UI. | Verificar aceptación de la experiencia existente con datos sintéticos, calendario personalizado y sin ingresos previstos. Solo proponer la diferencia concreta que falte. Explicar supuestos; no presentar previsión como saldo cierto ni duplicar alarmas. |
| **PRO-03 · recordatorio de recibos grandes** | **Recordatorios ya implementados.** `11-app-main` avisa la víspera y antes para cargos grandes; envía calendario al `AlertCheckWorker` nativo. Falta acreditar el caso pedido de insuficiencia proyectada en el aviso. | Verificar fecha, banco, saldo proyectado, repetición/cancelación y falta de datos. Reutilizar calendario/worker; no construir otro sistema de avisos ni hacerlo depender de FCM. Si el aviso actual satisface el caso, cerrar con evidencia; si no, acotar solo esa mejora. |
| **PRO-04 · informe exportable PDF** | Informe mensual + compartir PNG implementados en 4.19.12 y aprobados; no rehacerlos. PDF adicional no consta implementado. | Confirmar necesidad del formato y reutilizar datos/render del informe; pruebas de descarga/compartir, tres idiomas y mes sin datos. PDF de salida es distinto del importador PDF, que ya existe. |
| **PRO-05 · avisos push de nueva versión** | Watcher OTA/notificaciones locales no equivalen por sí solos a push con app cerrada para otros usuarios. Tanda 12. | Auditar canal actual; diseñar FCM o solución compatible con cero dependencias nuevas sin permiso. Permisos, dedup, canal/versiones, baja y pruebas en dispositivo. Credenciales, backend y despliegue requieren aprobación. |
| **PRO-06 · MyInvestor / inversiones sincronizadas** | Integración existente, reCAPTCHA/fiabilidad por confirmar. Fallback nativo aplazado; CSV/Excel disponible. | Ensayo acotado de la vía actual; si falla reCAPTCHA en móvil, propuesta de WebView en dominio propio del proveedor y APK. API no oficial requiere decisión de alcance; no pedir ni registrar credenciales en repo. No rehacer importadores existentes. |
| **PRO-07 · pensiones y cuentas de ahorro** | Pedido, sin alcance final ni soporte de proveedor demostrado. Tanda 13. | Modelo y vista de posiciones, aportaciones y datos desconocidos; confirmar qué ofrece proveedor frente a manual/import. Conexión/permiso bancario nuevo se diseña antes de activar. |
| **PRO-08 · Hogar** | Modelo de compartir y código ya existen ([HOGAR](HOGAR.md), módulo 13). Falta acreditar toda la aceptación con dos usuarios y cerrar diseño si procede. | Matriz cuentas/patrimonio/gastos/fijos, invitación, lectura mutua y descompartir; aislamiento y revocación en entorno de pruebas. Sin escritura cruzada de estado del otro. No presentar como función que hay que construir desde cero. |
| **TEC-01 · módulos financieros y adaptadores** | Refactor aplazado, no arreglo urgente. Hay extracción de lógica pura para tests. | Solo tras integridad: plan incremental por dominio y contrato común de bancos, sin dependencia nueva ni reescritura del monolito de una vez. Paridad de datos y cobertura existente. |
| **TEC-02 · claves i18n presuntamente huérfanas** | [Aparcado deliberadamente](briefs/i18n-orphans-aparcado.md); hay claves dinámicas que el barrido simple no ve. | No borrar masivamente. Si se retoma, demostrar usos dinámicos y mejora real en gzip, tres idiomas y render. |
| **DEC-01 · marca / Play Store / monetización** | Decisiones futuras del dueño, **Play siempre al final**. Nombre vigente Mi Cartera; no renombrar a Alforja. | Antes de publicar/cobrar: elección de marca y comprobaciones actualizadas, condiciones/privacidad/fiscalidad y modelo comercial. No desplegar pagos ni iniciar publicación por este relevo. |
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
| Crucero mejor IA / meta / efectivo | IA y orden implementados pendientes móvil; reglas nuevas solo nuevos/importados, no recategorizar pasado. PRO-01 y FIN-01. |
| Plan crucero 8 destello / 8 bis gestos nuevos / 9 Ajustes / 11 Hogar / 16 higiene / 17 diseño | Destello y arranque de gestos hechos; stopper distinto UX-01. Ajustes hecho; PRO-08, OPS-05, UX-02. |
| Backlog julio: cuotas/deudas, onboarding, idiomas, widgets, amortización, ingresos y edición, inversiones, retos, cargos puntuales, cash-flow | Los Projects 1 y 3 figuran todos Done (18 elementos cada uno; se solapan). No hay issues abiertas al consultar. Es inventario histórico, no verificación financiera renovada de cada feature. Round-up (#19) también Done. |
| Sugerencias app (7 existentes) | Mensaje actualización **corregido** (`bank_upd_one/n`); acceso superior UX-04. Histórico en tres idiomas y lag Deudas: implementados. Icono y retirada de barra de carga tienen fixes documentados; síntoma nativo restante UX-03, marca DEC-01. Ingreso Caixa **corregido** (`ob-ingresos.test.mjs`); diálogo amortización **corregido** (`askText/askConfirm`, 3.100). No reabrir sin evidencia nueva ni borrar el feedback histórico. |
| Viejas ideas salud, ADR, observabilidad, rendimiento y analytics | Herramientas/instrumentación existentes; no reconstruir. Agregado OPS-04; seguridad y restauración siguen pendientes. Tercer canal Experimental descartado. |

## PR abiertas: revisar el contenido, no fusionar por antigüedad

Foto de GitHub el 9/9. No se han cerrado PR ni borrado ramas en este relevo.

| PR | Tratamiento pendiente |
|---|---|
| [#41](https://github.com/JuanjoAvila/Mi-Cartera/pull/41), higiene checkout → beta | **Medido el 9/9 (`git cherry` + diff por fichero): casi todo incorporado, y su rama va ATRÁS.** Su `EMPIEZA-AQUI.md` **borra** el puntero a este backlog (es anterior). Lo único suyo que no está en beta: la trampa 8 y el incidente «se fusionó en detached HEAD y `beta` no se movió» (8/9). Rescatar esas dos frases sueltas y cerrar. No fusionar la rama. |
| ~~[#35](https://github.com/JuanjoAvila/Mi-Cartera/pull/35), efectivo; [#36](https://github.com/JuanjoAvila/Mi-Cartera/pull/36), edit-link~~ · **CERRADAS el 9/9** con el OK del dueño | **Los dos redundantes, comprobado antes de cerrar.** #36: `git cherry origin/beta` no devuelve NADA — cero commits fuera de beta. #35: su único commit `fb52ee94` sale con `-`, o sea que beta ya tiene su parche equivalente. **Cerrables sin rescatar nada**, con el OK del dueño. Ojo: no reabrirlos encima de FIN-01, que toca justo el efectivo. |
| [#31](https://github.com/JuanjoAvila/Mi-Cartera/pull/31), resume/categorías → beta | Código integrado; **fuera de beta queda solo un delta del brief `b09d-codex-resume-categorias.md`, y merece rescate**: el enlace a la ejecución de CI que sí pasó entera (`fc80bf39`) y la revisión de Codex sobre mi propuesta con los **dos defectos reproducidos** que hoy son FIN-04 (decisión de A deshecha por el pull de B; UPDATE que afecta a cero filas sin error). Es evidencia, no opinión: no dejarla morir en una PR cerrada. |
| [#30](https://github.com/JuanjoAvila/Mi-Cartera/pull/30), arquitectura → beta | Medido: `arquitectura-identidad-gastos.md` está en beta pero **DIFIERE** de la versión de la PR — comparar las dos antes de cerrar, no dar por buena la de beta solo por estar. `RELEVO-CLAUDE-CURSOR-2026-09-08.md` y `b09-d-widget-inicio-desacuerdo.md` **no existen en beta**; el primero lo sustituye el relevo del 9/9, el segundo es el desacuerdo técnico del widget y conviene rescatarlo. |
| [#26](https://github.com/JuanjoAvila/Mi-Cartera/pull/26), canal/incidencias → beta | Medido: sus **tres** briefs (`REANUDAR-CODEX.md`, `canal-equipo.md`, `incidencias-integridad-2026-09-06.md`) **no están en beta**, 308 líneas. El protocolo del canal describe roles ya derogados (Codex coordinando); el de incidencias es forense útil. Rescatar el forense, no el protocolo caduco. |
| [#24](https://github.com/JuanjoAvila/Mi-Cartera/pull/24), huecos conocidos → main | Del 18/8, **tres semanas atrás**; sus cinco ficheros difieren de beta y apunta a `main`. Su contenido ya está cruzado en este backlog. Cerrar sin fusionar salvo que el diff enseñe algo que aquí falte. Su frase «directo main» NO autoriza desplegar backend compartido. |

## Cierre de cada encargo

Registrar **ID, base, SHA/PR, prueba que reproducía el fallo, resultado después, revisión ajena,
CI y versión realmente publicada**, o bloqueo concreto y trabajo que queda. Sin datos personales
en el repo público. Implementado no significa probado en Android ni desplegado en Supabase.
Antes de pedir aprobación móvil: versión exacta, pasos cortos, resultado esperado, límites y
OTA frente a APK. Solo el dueño cambia el veredicto y decide producción.
