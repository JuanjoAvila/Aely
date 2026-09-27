# SEC-03 · privacidad de logs

Estado: correcciones locales preparadas; sin publicación, sin despliegue Edge y sin consultas a datos reales. Revisión Claude y CI pendientes. No equivale a certificar toda la app ni el servidor activo.

## Base y aislamiento

Base comprobada al iniciar: main f5e6b514a00b767a07e7ef8d58cf158fe75e93b9, fuente 4.26.52. Rama propia codex/sec03-privacidad en worktree gestionado. Beta 3dfe0a28 / 4.26.56.1 contiene trabajo financiero pendiente que no se incorpora. OPS-02 está publicando su visor exclusivo; SEC-03 no toca beta ni metadatos mientras esa publicación siga abierta. La raíz conserva sus cambios ajenos.

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
| feedback explícito | texto escrito por quien envía | app_events (insert separado) | Rojo/verde en patrones IBAN, correo, teléfono, URL, bearer/token/password, JWT/hex, importe con unidad y nota/concepto etiquetados. Mantiene texto útil y fallo explícito de envío. No hay garantías semánticas sobre nombres propios o secretos sin patrón. |
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

El usuario decide enviar feedback y notas de beta: esos textos tienen propósito de soporte y no son volcados automáticos. La redacción de patrones NO garantiza detectar un nombre de comercio, persona, una cifra sin unidad o una credencial sin etiqueta. No declarar por eso que toda la aplicación está libre de datos personales. Campos nuevos requieren revisar esquema/fixture. La truncación de partes grandes a 2000 caracteres es el límite previo del transporte, no una garantía de JSON completo.

El inventario estático impide destinos explícitos nuevos sin revisión, pero no demuestra cada rama normal/fallo de cada productor. Las familias cliente se ejecutan contra el transporte real; add/delete, ErrorBoundary y cargas idioma/notas sí ejecutan además su productor. Edge callback ejecuta su handler; bank-sync/ingest/ratelimit ejecutan loggers o función real con mocks. No cubre SQL/RLS, logs activos, retención, SDK del servidor, plataforma Supabase, cuerpos de respuestas registrados automáticamente, llamadas bancarias reales, APK ni dispositivo Android.

No se encontraron ni copiaron secretos reales en la investigación. No se hace rotación por iniciativa propia. Si una revisión operativa posterior acredita exposición, registrar solo tipo/proveedor/alcance y proponer revocación/rotación al dueño en una etapa separada.

## Pruebas reproducibles

- node tests/logs-privacidad.test.mjs --source-ref f5e6b514a00b767a07e7ef8d58cf158fe75e93b9: reproducción contra la fuente base sin modificar el checkout. Resultados rojo/verde se registrarán al cierre.
- node tests/logs-privacidad.test.mjs: guardián permanente registrado como logs-privacidad en steps de scripts/run-tests.mjs.
- Guardianes vecinos: security, seguridad-hogar-eventos, bank-sync-paging, edge-sintaxis, relevant-tests, build y check-syntax.
- Suite Node completa sin navegadores mientras OPS-02 los usa. Desfase previo memoria-espejo fuera de alcance; no regenerar ni incorporar cambios ajenos para taparlo.

## Entrega y publicación

Cambian diagnósticos y se oculta el correo en Actividad administrativa; el ahorro de breadcrumbs/tracing reduce detalle de soporte. Preparar beta aislada y guion: abrir Inicio/Actividad, confirmar uso/perf/rutas, provocar únicamente fallos sintéticos en un perfil de pruebas, enviar feedback sintético y un rechazo de tanda; comprobar conservación del veredicto y ausencia de patrones. No usar compras, extractos, credenciales ni sincronizaciones reales para esta comprobación.

La publicación cliente, el veredicto móvil y la aprobación de producción son etapas posteriores. Edge queda como propuesta local por función: bank-sync, bank-callback, ingest y los consumidores de ratelimit. No usar despliegue global, migraciones, SQL ni APK. Una OTA cliente no aplica los cambios Edge. No afirmar fuente local como código activo. Revisión Claude 5.5 Opus debe referirse al SHA final y repetir guardianes propios; CI y SHA se registrarán al cerrar.
