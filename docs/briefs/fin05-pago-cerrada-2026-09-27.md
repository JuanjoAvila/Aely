# FIN-05 · pago con app cerrada · 27/9

**Abierto: causa capturada y corrección cliente publicada en beta4.26.54.1; pendiente repetir pago real.** El síntoma se refiere a «Gastado». La secuencia previa narrada no quedó capturada. Los fixtures de las pruebas son datos ficticios y no describen una cartera real.

## Aislamiento y dispositivo

Checkout widget-pago-27sep, rama codex/widget-pago-27sep, base beta5d5b8d0f0d8ea12b5521009d3fef9b54f6fd85e9. Main verificado f5e6b514a00b767a07e7ef8d58cf158fe75e93b9; sin promoción. Raíz y trabajos A/B/OPS-01 no editados salvo mensajes autorizados de coordinación. Sin cambios/despliegue backend.

El dueño conectó el móvil y autorizó inspección completa conservando notificaciones y sin abrir previamente Aely. Se capturó pantalla/notificaciones y estado nativo/local antes de abrir. APK4.26.49/code50, OTA efectiva4.26.53.1, beta. Dos notificaciones corresponden al mismo pago. Journal nativo: una sola contribución, sin segundo descuento de efectivo. Los importes de la inspección se conservan únicamente en evidencia privada.

Para leer preferencias de release se usó temporalmente una build diagnóstica de la misma base nativa, firma e identificador; respaldo privado antes de abrir. App abierta offline, wifi/datos desactivados. Restaurados APK original no depurable, wifi/datos a su estado previo y forwarding CDP retirado. SHA256 del APK original6b0a9956c907a3ed3f5e36813271452ad6a5cf88113f9da425c70ceacab9a66a igual al asset publicado. La build diagnóstica no se distribuye.

Filas del mes y app_state leídos por ruta SQL read-only de Management API, con autorización del dueño; estas consultas no escriben, migran, fuerzan refresh de sesión ni sincronizan bancos. Capturas con datos/credenciales fuera del repo público; aquí solo explicación y fixtures ficticios.

## Causa comprobada

Mismos ajustes netos/presupuesto y mismas lápidas: el cliente conservaba filas marcadas como borradas que también existen en el resultado remoto crudo. Servidor las excluye antes de calcular; app local las contaba. Las filas de gasto e ingreso explican la variación adicional al pago; la fila neutra no afecta al presupuesto. La comparación capturada atribuye ese desfase a lápidas, sin diferencia de modo ni segundo pago. La secuencia previa narrada no se conserva como captura exacta.

Con app cerrada, el presupuesto absoluto correcto del servidor sustituye el local incorrecto y parece subir más que el pago. No se cambia el árbitro ni se resta una cantidad fija. El contraejemplo anterior net/split solo era sintético, no la causa observada.

## Corrección y pruebas

expenseCountsBudget aplica expenseIsTombstoned existente. Presupuesto/categorías heredan el criterio, manteniendo possibleDup, neutros, UUID manuales y compatibilidad antigua. Índice WeakMap por array deleted; escritores reemplazan por copia, incluido deshacer. Memos de presupuesto incluyen deleted. Gastos e Inicio ocultan filas borradas sin podar el historial; copia de seguridad conserva el dato crudo. Cash/insumos/anclajes permanecen idénticos, porque retirar contribuciones de una base histórica sin reanclaje movería efectivo. Esta tarea no migra bases ni resuelve retrospectivamente cash calculado. Sin borrar arrays, migrar, recategorizar ni modificar decisiones.

Guardián existente widget-coherente: datos ficticios, vivo181, borrados3/-15/-250, candidato ambiguo22, presupuesto1000. **Rojo antes831 frente819; verde después819→813.55** con pago5.45, contra helper servidor real. Comprueba no mutación, insumos de cash idénticos, UUID distintos, lápidas antiguas, null/undefined, nueva lápida por copia y deshacer. E2E existente widget-banco abre Gastos, comprueba DOM y snapshot simulado antes/después de reentrada, conservando filas/lápidas. No equivale a nueva compra real.

Verificación local: npm test ejecuta todos sus guardianes de lógica/sintaxis/i18n/docs/bundle; solo falla memoria-espejo por cuatro archivos externos ya desfasados en la base (diff docs/memoria vs base vacío). No se sincroniza memoria ajena ni se oculta el fallo. Deno no instalado, omitido localmente. E2E global ejecutado separado porque ese fallo impide iniciarlo desde runner: **445 PASS, 1 omitido**, incluidos DOM y puente FIN-05; **7 rendimiento PASS**, separado con1worker. Sin inesperados ni flaky. No se denomina npm test verde. Solo OTA; APK50 capturada ya contiene nativo FIN-05. APK48 no recibe ese nativo por OTA.

Claude REAL analizó base5d5b8d0f sin atribuir causa única desde código; revisión de enfoque1337Z advirtió sobre anclajes cash y se acotó a presupuesto. **PASS al código exacto5b4d1c911fbbf35515a184c3ad3eaf2db80a9a2f**, mensaje20260927T1353Z-claude-fin05-pass-5b4d1c91: reproduce rojo831/819 con rebuild de base y verde con fix, comprueba bundle limpio y ejecuta widget-coherente/arbitraje/sintaxis/i18n/docs en su propio checkout. Revisa consumidores/dependencias, caché/manuales y acepta límite cash conservado. No ejecutó E2E ni pago real; no se le atribuyen. PASS exactos posteriores6fcc3e0e (docs) y05a8fb4f (selector/docs), mensajes20260927T1359Z-claude-fin05-pass-6fcc3e0e y20260927T1419Z-claude-fin05-pass-05a8fb4f. No agente interno ni PASS histórico.

Con la copia capturada del estado y la corrección, añadir la única fila nueva visible de la nube produce una variación igual al pago y la misma cifra que el widget capturado. Verificado sin escrituras ni nuevos pulls. Sondas, build diagnóstica, copia del APK y copias temporales con sesiones retiradas; evidencia nativa privada mínima fuera del repo. APK original sin DEBUGGABLE verificada tras restauración.

Primer CI beta del SHA6fcc3e0e, Action36324412504: publicación bloqueada, sin assets nuevos. Guardianes de lógica y cuatro ficheros Deno PASS; rendimiento7PASS; funcional442PASS,2flaky que pasan al reintentar,1omitido,1fallo. El fallo es el selector nuevo `.page-live .v4-mov`: page-live incluye vecinos montados, así que contaba la compra una vez en Inicio y otra en Gastos. Se acota por la cabecera de Inicio sin cambiar app/bundle. Verificación local posterior con configuraciónCI y dos repeticiones:14/14PASS. Las dos flaky ajenas no se retocan en este objetivo. CI del selector corregido36325573154 verde: todos los unitarios y7E2E dirigidos PASS. Deno/rendimiento/global quedan respaldados por la ejecución anterior descrita, sin denominarlos una segunda global completa.

## Publicación verificada

Beta **4.26.54.1**, [Action36325573154](https://github.com/JuanjoAvila/Aely/actions/runs/36325573154), SHA exacto **05a8fb4f08fbb6e47ad0759e0a2effbb8d3e3f33**. Huella **7e74ac9db58ec8c4** calculada independientemente sobre los archivos del ZIP coincide con version.json. Paquete864917bytes, SHA256 **86d77f0235ff0c6530f75a9eb3695f605e4f00c0b061388258f34b76fc9f67fd**. APP_VERSION4.26.54.1, SW **4.26.54.1-2026-09-27-05a8fb4**; HTML minificado coincide con candidata normalizando solo sello, DSN y finales de línea. Notas coinciden con fuente es/en/ca; APK anunciado4.26.49/code50 HTTP200. Cotejo2026-09-27T14:23:55Z.

Salud posterior: beta4.26.54.1, Pages4.26.52, APK estable4.26.32/code48; URLs de bundles/APK HTTP200. El checkout no tiene credenciales de datos: Salud omite Edge/app_events y no prueba móvil. Lectura independiente anterior durante publicación confirma ingest ACTIVE49, updated_at1790513001023,434884bytes, SHA256977971c65c83ef81e8c79f3519b821748f52421e32281c23d51be955c63c0cc7, igual al paquete activo previo. No desplegado desde esta tarea.

## Validación móvil pendiente

Comprobación directa del móvil a las16:36: Ajustes muestra web4.26.54.1, app4.26.49(50), canalbeta; la cifra de Inicio coincide con la evidencia capturada. Tras abrir y volver a Inicio Android, el widget muestra — y Abre la app para actualizar. No se presenta como widget preparado ni como validación de pago. El render nativo usa ese aviso cuando journalFull o unknownPending están activos; sin lectura actual de preferencias no se atribuye cuál ni la causa. No se borran preferencias ni journal para forzar una cifra. Pendiente recuperar una cifra válida del widget antes de repetir pago. Próxima comprobación: anotar Gastado/saldo del widget; cerrar app. Próxima compra habitual: conservar notificación/hora/cifras antes/después. Gastado debe variar solo por el pago con redondeo entero; reabrir no debe descontar otra vez. FIN-05 abierto hasta ese veredicto. Producción requiere aprobación final explícita.
