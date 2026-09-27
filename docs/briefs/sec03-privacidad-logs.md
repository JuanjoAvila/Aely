# SEC-03 · privacidad de logs

Estado: correcciones locales preparadas; sin publicación, sin despliegue Edge y sin consultas a datos reales. Claude revisó 312b90579af501fd903ebe8dabaa78a4e0961873 y ejecutó sus guardianes: NO-GO por pérdida de contexto explícito y límite de base Edge. Corrección preparada con regresión; Su regresión queda corregida. La revisión exacta definitiva y el CI se vinculan al SHA/PR que se entregue; no equivalen a publicación. No equivale a certificar toda la app ni el servidor activo.

## Base y aislamiento

Base comprobada al iniciar: main f5e6b514a00b767a07e7ef8d58cf158fe75e93b9, fuente 4.26.52. Rama propia codex/sec03-privacidad en worktree gestionado. Beta 3dfe0a28 / 4.26.56.1 contiene trabajo financiero pendiente que no se incorpora. OPS-02 terminó: Promote 36343752892 y Pages 36344438830 success; manifiesto público 4.26.56 comprobado. Rebase final sobre main 426131959a75e5af8923009646caf20fd5b8e430. Se conserva el test/mapeo OPS-02 al resolver los conflictos y se regeneran artefactos. Fuente candidata 4.26.57, sin publicar beta ni producción. La raíz conserva sus cambios ajenos.

## Matriz por productor, campo y destino

Cada evidencia ejecutada usa IBAN, correo example.invalid, teléfono, credencial, nota e importe inventados. No envía peticiones a Supabase/Sentry/bancos: inserts, proveedor y transporte Sentry son mocks explícitos. El guardián inventaría todos los destinos explícitos en src/modules y supabase/functions; una ruta nueva obliga a revisar esta matriz.

| Productor / fuente | Campos de entrada | Destino | Reproducción y contrato después |
|---|---|---|---|
| core: subirGasto / borrarGastoNube; Gastos: setExpenseDup; App: setExpenseDeuda | clave con fecha/importe/comercio/id, error de BD | cloud.logEvent → app_events | Fuga ejecutada en fallos add/delete. Se conserva operación y SQLSTATE cerrado; identidad financiera y texto de BD no viajan. Las otras dos familias se ensayan en el mismo transporte. |
| Sync brokers: MI login/recaptcha y TR sync | mensaje libre de respuesta/excepción | logEvent → app_events | Marcadores ejecutados por familia de productor. Operaciones myinvestor/tr_sync + clase cerrada; no texto remoto. No se autentica contra proveedores. |
| HistImport: sonda histDupProbe | contadores, booleanos, fechas de rango; objeto libre serializado | logEvent(hist) → app_events | Ensayo con campos extra hostiles; solo esquema de recuentos/booleanos y fechas YYYY-MM-DD. No movimientos. Fechas de rango son contexto operativo deliberado, no fechas de compras. |
| BankConnect, OB sin saldo utilizable, bankSync sin pull | nombre de banco, mensajes, tipos libres de balances, contexto manual/auto | logEvent → app_events | Todas las familias se cierran en transporte. Se conserva ruta y clase; tipos del proveedor y nombre libre no viajan. No se sincronizan bancos reales. |
| ErrorBoundary, toast de error, window.error / unhandledrejection | error.message, stack, componentStack, filename/URL | logEvent → app_events; consola; mcCaptureError | Captura de ErrorBoundary ejecutada, resto por familia de transporte. Consola conserva clase cerrada. Sentry conserva tipo, clase y posiciones seguras en index.html. |
| Canal, OTA, APK, import hoja | mensaje de error libre | logEvent → app_events | Ensayo por las cuatro familias; ruta y clase cerrada. Sin descargas OTA/APK/importaciones reales. |
| logUso, logPerf, ping | etiqueta, duración agregada | logEvent → app_events | Normales y etiquetas hostiles. USO_OK se valida también en logEvent directo; ping fijo, duración acotada. Correo de sesión eliminado. |
| feedback explícito | texto escrito por quien envía | app_events (insert separado) | Rojo/verde en patrones IBAN, correo, teléfono, URL, bearer/token/password, JWT y credenciales etiquetadas. Fecha/hora, importe, SHA y nota enviados expresamente para soporte permanecen. Mantiene texto útil y fallo explícito de envío. No hay garantías semánticas sobre nombres propios o secretos sin patrón. |
| betaReport explícito | summary, notas, fallo/item, veredicto/tanda y campos extra | app_events (insert separado) | Campos extra eliminados antes de serializar; esquema del parte conservado y texto redactado con la misma frontera de feedback. Rechazo y error de insert siguen visibles. |
| mcCaptureError (cola y captura inmediata) | Error y contexto libre | SDK Sentry | Marcadores eliminados antes de entregar al SDK/cola. No ctx/extra crudos. |
| Sentry automático y contexto SDK | message/exception, user, request/header/cookie/url, extra, contexts, tags, breadcrumbs, frames.vars/pre_context | beforeSend → sobre Sentry | Lista permitida reconstruye el sobre; no blacklist. Ensayo ejecutado con @sentry/browser 9.47.1 instalado y con public/vendor/sentry.bundle.min.js 9.47.1, ambos con transporte en memoria. Breadcrumbs y transacciones bloqueados; tracesSampleRate=0, sendDefaultPii=false, autoSessionTracking=false. |
| Carga idioma y notas | excepción de fetch/JSON | console.warn local | Fallos sintéticos ejecutados en las funciones reales; solo clase y idioma cerrado. |
| bank-sync: logObReadFailure / logObHistoryResult | aspsp libre, error, cuentas/filas, rango/duración | app_events, 2 inserts Edge | Error/nombre hostiles ejecutados en loggers reales. Banco por lista cerrada o banco genérico, HTTP/clase y agregados. Sin payload, IBAN, UID de cuenta, comercio, importe ni token. |
| bank-callback: query y catch | OAuth code/state/error_description, error de BD/proveedor, diagnóstico de sesión | console.error + app_events | Handler real ejecutado con query hostil y fallo de BD simulada. Código cerrado y presencia booleana de parámetros; nunca sus valores ni detalle crudo. Redirección sigue con el código previo. |
| ingest: logIngestError | message + code/currency/source/tokenLength | app_events | Logger real ejecutado con code/currency hostiles. Mensaje cerrado, SQLSTATE/operación cerrada, fuente tr/wallet, divisa de tres letras, longitud acotada. No cambia parser ni gasto/importe/sync. |
| ingest: logIngestSkip | motivo de clasificador, fuente cerrada, longitudes | app_events | Caso normal ejecutado. Fuente normalizada por handler a tr/wallet; motivo procede de vocabulario literal del clasificador/handler, no texto/título. No se modifica esta ruta al no reproducirse fuga en entradas normales. |
| _shared/ratelimit | error.message de RPC o excepción; bucket | console.error Edge | Ambos fallos ejecutados. Solo SQLSTATE cerrado o unavailable. Conserva fail-open y checked:false; no cambia permisos ni SQL. |
| Resto Edge y Android/SW | respuestas necesarias al cliente; mensajes nativos | sin app_events/Sentry/console explícitos adicionales en estos productores | Inventario de fuente: bank-aspsps/connect/disconnect, categorize, delete-account, help-assistant, myinvestor connect/sync/disconnect/keepalive y prices. Sus respuestas de error no son registros propios; si llegan a logEvent del cliente pasan su filtro. No se ha inspeccionado logging implícito del gateway/proveedor/Android. |

## Datos retenidos deliberadamente y límites

app_events sigue enviando user_id: lo exige la propiedad de la fila/RLS y el soporte por usuario. Es un identificador personal seudónimo, no anonimato. email pasa a null en los tres inserts cliente; filas históricas quedan intactas. Se conservan versión/plataforma, códigos operativos, duración/recuentos agregados y rango del histórico. No se inspeccionan ni borran registros previos.

El usuario decide enviar feedback y notas de beta: esos textos tienen propósito de soporte y no son volcados automáticos. La redacción de patrones NO garantiza detectar un nombre de comercio, persona, una cifra sin unidad o una credencial sin etiqueta. No declarar por eso que toda la aplicación está libre de datos personales. Las cifras, fechas/horas, hashes y notas enviadas deliberadamente permanecen: quitarlas destruye el contexto del fallo y del veredicto. La regresión del hallazgo real de Claude exige conservar ese contexto. Campos nuevos requieren revisar esquema/fixture. La truncación de partes grandes a 2000 caracteres es el límite previo del transporte, no una garantía de JSON completo.

El inventario estático impide destinos explícitos nuevos sin revisión, pero no demuestra cada rama normal/fallo de cada productor. Las familias cliente se ejecutan contra el transporte real; add/delete, ErrorBoundary y cargas idioma/notas sí ejecutan además su productor. Edge callback ejecuta su handler; bank-sync/ingest/ratelimit ejecutan loggers o función real con mocks. No cubre SQL/RLS, logs activos, retención, SDK del servidor, plataforma Supabase, cuerpos de respuestas registrados automáticamente, llamadas bancarias reales, APK ni dispositivo Android.

No se encontraron ni copiaron secretos reales en la investigación. No se hace rotación por iniciativa propia. Si una revisión operativa posterior acredita exposición, registrar solo tipo/proveedor/alcance y proponer revocación/rotación al dueño en una etapa separada.

## Pruebas reproducibles

- node tests/logs-privacidad.test.mjs --source-ref f5e6b514a00b767a07e7ef8d58cf158fe75e93b9: reproducción contra la fuente base sin modificar el checkout. Primera matriz de 20 casos: 18 fallan y 2 pasan en la base. Con la regresión de contexto de Claude: 21 casos, 19 rojos/2 verdes en base; 21/21 verdes corregidos.
- node tests/logs-privacidad.test.mjs: guardián permanente registrado como logs-privacidad en steps de scripts/run-tests.mjs.
- Guardianes vecinos: security, seguridad-hogar-eventos, bank-sync-paging, edge-sintaxis, relevant-tests, build y check-syntax.
- Suite Node completa y E2E después de terminar OPS-02. Desfase previo memoria-espejo fuera de alcance; no regenerar ni incorporar cambios ajenos para taparlo.

## Entrega y publicación

Cambian diagnósticos y se oculta el correo en Actividad administrativa; el ahorro de breadcrumbs/tracing reduce detalle de soporte. Preparar beta aislada y guion: abrir Inicio/Actividad, confirmar uso/perf/rutas, provocar únicamente fallos sintéticos en un perfil de pruebas, enviar feedback sintético y un rechazo de tanda; comprobar conservación del veredicto y ausencia de patrones. No usar compras, extractos, credenciales ni sincronizaciones reales para esta comprobación.

La publicación cliente, el veredicto móvil y la aprobación de producción son etapas posteriores. Edge queda como propuesta local por función: bank-sync, bank-callback, ingest y los consumidores de ratelimit. **No desplegar ingest de esta rama tal cual**: Claude señala que su fuente activa ingest49 corresponde a 1397fe28/beta e incluye FIN-05/Wallet ausentes en main. SEC-03 no ha verificado esa afirmación contra el servidor activo. Antes de publicar el servidor, revalidar el módulo activo, portar solo el delta de logIngestError sobre esa fuente y ejecutar sus guardianes; no reemplazarla por main ni arrastrar/sacar cambios financieros sin autorización. Este hallazgo es un límite de preparación, no una autorización de despliegue. No usar despliegue global, migraciones, SQL ni APK. Una OTA cliente no aplica los cambios Edge. No afirmar fuente local como código activo. Revisión Claude 5.5 Opus debe referirse al SHA final y repetir guardianes propios; CI y SHA se registrarán al cerrar.

## Revisión independiente inicial

Claude 5.5 Opus: mensaje inmutable 20260927T1931Z-claude-sec03-312b9057, sobre SHA 312b90579af501fd903ebe8dabaa78a4e0961873; build, logs-privacidad, security, seguridad-hogar-eventos, bank-sync-paging, check-syntax, edge-sintaxis e i18n-keys ejecutados en checkout propio con EXIT 0. Su NO-GO reprodujo pérdida de fecha/hora, importe y SHA en texto explícito. Se retira esa redacción indiscriminada, manteniendo credenciales/IBAN/correo/teléfono/URL y JWT. Test de contexto añadido. La revisión definitiva debe referirse al commit final que se entregue, incluyendo el rebase y los metadatos.

## Guion móvil y canal

Candidata 4.26.57, todavía sin beta publicada. No reemplazar la beta con FIN-05/selector/TR pendientes: requiere una preparación/publicación aislada posterior. Abrir Inicio/Perfil/Ajustes y cerrar; en banco de pruebas guardar una nota ficticia con fecha/hora/importe y comprobar contexto local. No sincronizar bancos ni provocar compras. Este guion solo valida UX/Android: el banco de pruebas anula las escrituras cloud, por lo que no demuestra el transporte de logs. Los marcadores al transporte se prueban mediante mocks capturados en Node/Chromium. OTA cliente no aplica Edge; APK48 intacta. Producción requiere OK nuevo específico.

## Evidencia local de la candidata

- Guardián SEC-03: **21/21**, incluido contexto explícito y envelopes completos (segmento/transacción del scope) de ambos SDK. Base f5e6b514: **19 fallos y 2 pases**, EXIT 1.
- Chromium instalado existente, puerto por worktree, fixtures sintéticos: **42/42** en logs-privacidad, revisar-beta y backup-restauracion. ActivityPanel real muestra operación/código/texto útil sin correo ni marcadores automáticos. No se inicia navegador en paralelo con OPS-02.
- build, check-syntax, i18n-keys/bundle, security, seguridad-hogar-eventos, bank-sync-paging, edge-sintaxis y relevant-tests pasan. Ambos guardianes/mapas OPS-02 conservados. Histórico de notas anterior preservado sin reformat; comparación de JSON anterior/candidata excluyendo solo la nueva cabeza idéntica.
- Medido sobre OPS-02: 1.243.669 bytes minificados / 338.534 gzip. Límite crudo 1212→1218 KiB (+6 para frontera necesaria, sin limpieza ajena); gzip 332 KiB y tres ficheros bloqueantes intactos.
- Suite Node completa local se ejecuta en el runner; el espejo de memoria heredado está desfasado y queda fuera de alcance. No se incorpora ni regenera para ocultar ese fallo. CI completo remoto y revisión Claude deben consultarse por SHA exacto en los checks/mensajes de la PR entregada; no se infieren del verde de OPS-02.
