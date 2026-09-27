# FIN-05 · pago con app cerrada · investigación del 27/9

**Abierto: pago real fallido; causa del dispositivo todavía sin atribuir.** El dueño comunica una caída excesiva de «Puedes gastar» después de un pago real con la app cerrada. Esto supera el relevo del 26/9 que decía que aún no había nada que pagar. Los PASS históricos no validan este escenario. No se ha aplicado un parche, publicado OTA/APK, desplegado servidor ni promocionado producción desde esta tarea.

## Base y aislamiento

Checkout aislado `widget-pago-27sep`, rama `codex/widget-pago-27sep`, base beta `5d5b8d0f0d8ea12b5521009d3fef9b54f6fd85e9`. Remoto comprobado el 27/9: main `f5e6b514a00b767a07e7ef8d58cf158fe75e93b9`, beta conserva esa base. La raíz y los checkouts de FIN-05 anterior, auditoría OPS-01 y A/B no se han editado. Reserva comunicada por el canal de archivos. A conserva su cierre Wallet; B, categorize. La activación de B consta reservada: no iniciar otra activación.

Lecturas previas: AGENTS, EMPIEZA-AQUI, REANUDAR-CODEX de la raíz (relevo antiguo), FIN-05/selector y auditoría OPS-01 preservada en `8f6830e67d1e24c6940457d00397c2114110f23d`. La evidencia actual prevalece sobre sus versiones antiguas. No se han consultado filas financieras, sincronizado bancos ni llamado a IA remota.

## Versiones comprobadas y dato pendiente

`npm run salud`, desde el checkout sin credenciales de datos, confirma Pages 4.26.52 y APK estable 4.26.32/code48; beta OTA 4.26.53.1 y APK 4.26.49/code50. Las URL anunciadas responden HTTP200. Salud omite Edge y app_events por ausencia de credenciales en ese checkout: su cierre «Todo en orden» no valida dispositivo ni servidor. El nativo FIN-05 vive en APK50; OTA no lo entrega a APK48. No hay móvil conectado por adb. APK instalada, OTA/canal efectivo y banco elegido siguen desconocidos.

GET independiente de metadatos y cuerpo de ingest, 2026-09-27T12:47:00.033Z: ACTIVE, versión49, verify_jwt=false, updated_at=1790513001023, 434884bytes, SHA256 `977971c65c83ef81e8c79f3519b821748f52421e32281c23d51be955c63c0cc7`; metadatos estables antes/después de la descarga. Ya no es ingest48 de OPS-01. En una segunda descarga se verifica el mismo hash, se recuperan los siete sourcesContent del ESZIP2.3 comprobando sus checksums y se cotejan los siete hashes con el candidato Wallet de A (`1397fe280b827daffb9969177a0907495ea65c32`). No se activa ni se integra A en esta rama. El presupuesto activo sigue conservando el contrato FIN-05.

Solicitados al dueño: versión/canal, banco del widget o automático, hora, texto de notificación y existencia de otros movimientos/actualizaciones entre ambas cifras. Son imprescindibles para atribuir el camino del pago; no hace falta extracto ni saldos privados.

## Reproducción sintética, sin atribución al usuario

Fixtures ficticios; ninguna fila real. Se ejecutan la app real en Edge/Playwright con puente nativo simulado, el árbitro Java real y el helper de presupuesto de las fuentes activas descargadas. Misma fecha 27/9 y ventana Madrid, mismas filas y ajustes netos. Presupuesto1000, compra previa458.55, ingreso277.55, base de cuenta2181 y recibo pendiente1181 del día28; banco TR, sin otras partidas ni movimientos. La compra nueva es5.45. Estas cifras se eligen para ejercitar ambos límites; no describen la cartera real ni prueban su definición de safeLiq.

| Snapshot de la app real | Antes | Después |
|---|---:|---:|
| Gasto mostrado |181|186.45|
| Presupuesto restante |819|813.55|
| Liquidez mínima del banco |819|813.55|
| Saldo del banco |2000|1994.55|
| Puedes gastar |819|813.55|

El helper activo del servidor y el Java dan los mismos resultados. Reentrada con ACK que cubre el pago conserva813.55 y1994.55: no hay segundo descuento en ese fixture. El widget redondea con `Math.round`:813.55 se representa como814€, igual que en su formato actual.

**Contraejemplo, NO causa confirmada del móvil:** mantener las filas y cambiar solo gTotalMode del servidor de net a split produce presupuesto restante536. El Java acepta ese absoluto cuando ticket>appFence, mientras safeLiq sigue813.55. La diferencia adicional277.55 procede exactamente del ingreso del fixture que split no compensa. Esto demuestra que un absoluto servidor de otro modelo puede sustituir una foto local; no demuestra que el dueño tenga ese ingreso, ese ajuste o esa APK. El mismo número final puede proceder de varias causas. No cambiar textos ni restar el pago al número como parche cosmético.

## Verificación y continuación

- `widget-arbitraje`, `widget-coherente`, `presupuesto-servidor`: PASS sobre la base, sin cambios de código.
- Fixture adicional offline con siete fuentes activas verificadas + Java: PASS en coherencia y reproducción del contraejemplo; no es un guardián que falle antes del fix, porque todavía no hay causa atribuida ni fix.
- App real en navegador, viewport Pixel5 y puente simulado: snapshots de la tabla verificados; red ajena al servidor local bloqueada. No es ejecución de APK ni notificación real.
- No se ha ejecutado una suite global ni publicado una candidata. No se reclama cierre móvil, divisas FIN-06, selector ni TR.

Claude REAL revisó la base exacta y respondió `20260927T1256Z-claude-fin05-pago-analisis`: **ANÁLISIS, sin causa única demostrable desde código**. Corrobora el absoluto servidor mezclado con safeLiq local; identifica marcas de posible repetido solo locales, categorías locales diferentes y app_state atrasado como caminos a distinguir, sin atribuir ninguno al móvil ni haber ejecutado el fixture. Propone contrastar las primitivas de presupuesto de ambos escritores y, si fuera necesario, solo recuentos de divergencias; cualquier acceso a datos financieros deberá respetar la autorización del dueño. También señala que con banco distinto de TR los deltas actuales no bajan safeLiq: no se corrige ese objetivo independiente en esta investigación. El informe documental del SHA `f0d61646aff5fe8f7997799040f04132d8a2d9ca` se remitió además a revisión. No se reutiliza un PASS histórico ni se sustituye por subagente interno.

Toda eventual corrección deberá llevar guardián rojo antes/verde después y revisión del SHA exacto final; si afecta Java, APK beta firmada con WEBDEBUG desactivado. Un paquete servidor deberá conservar el cierre activo49 y serializarse con A/B, con rollback de una sola función y aprobación final explícita antes de activar. No ejecutar SQL. La dirección sugerida de aplicar deltas sobre la foto debe comprobar su validez ante cambios legítimos de modelo/filas, día/mes, importaciones y otras entradas; no presentarla como arreglo ya validado.

Siguiente paso dentro de este mismo objetivo: recibir datos mínimos del dispositivo, contrastar su camino exacto, reproducir la causa y corregirla. Conservar posibles duplicados y sus decisiones; no migrar ni recategorizar historia para forzar coherencia. FIN-05 continúa abierto hasta repetir el escenario real de pago con la candidata instalada.
