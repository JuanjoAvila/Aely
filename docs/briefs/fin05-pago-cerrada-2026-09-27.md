# FIN-05 · pago con app cerrada · 27/9

**Abierto: causa capturada y corrección cliente candidata4.26.54; pendiente repetir pago real.** El dueño aclaró que miró «Gastado», de519 a536 tras una compra de unos5€, no «Puedes gastar». Esas cifras previas no quedaron capturadas. Los antiguos fixtures819/536 no describen su cartera.

## Aislamiento y dispositivo

Checkout widget-pago-27sep, rama codex/widget-pago-27sep, base beta5d5b8d0f0d8ea12b5521009d3fef9b54f6fd85e9. Main verificado f5e6b514a00b767a07e7ef8d58cf158fe75e93b9; sin promoción. Raíz y trabajos A/B/OPS-01 no editados salvo mensajes autorizados de coordinación. Sin cambios/despliegue backend.

El dueño conectó el móvil y autorizó inspección completa conservando notificaciones y sin abrir previamente Aely. Se capturó pantalla/notificaciones y estado nativo/local antes de abrir. APK4.26.49/code50, OTA efectiva4.26.53.1, beta, bancoTR. TR y Wallet muestran el mismo pago5.45. Journal nativo: una sola contribución5.45, sin segundo descuento de efectivo.

Para leer preferencias de release se usó temporalmente una build diagnóstica de la misma base nativa, firma e identificador; respaldo privado antes de abrir. App abierta offline, wifi/datos desactivados. Restaurados APK original no depurable, wifi/datos a su estado previo y forwarding CDP retirado. SHA256 del APK original6b0a9956c907a3ed3f5e36813271452ad6a5cf88113f9da425c70ceacab9a66a igual al asset publicado. La build diagnóstica no se distribuye.

Filas del mes y app_state leídos por ruta SQL read-only de Management API, con autorización del dueño; sin escritura, migración, refresh de sesión ni sync bancario. Capturas con datos/credenciales fuera del repo público; aquí solo explicación y fixtures ficticios.

## Causa comprobada

Mismos ajustes netos/presupuesto y mismas lápidas: el cliente conservaba tres filas marcadas como borradas que también existen en el resultado remoto crudo. Servidor las excluye antes de calcular; app local las contaba. Gasto, ingreso y traspaso neutro: gasto/ingreso explican11.89 adicionales al pago5.45; neutro no afecta presupuesto. La comparación capturada atribuye ese desfase a lápidas, sin diferencia de modo ni segundo pago. La secuencia519→536 narrada no se conserva como captura exacta.

Con app cerrada, el presupuesto absoluto correcto del servidor sustituye el local incorrecto y parece subir más que el pago. No se cambia el árbitro ni se resta una cantidad fija. El contraejemplo anterior net/split solo era sintético, no la causa observada.

## Corrección y pruebas

expenseCountsBudget aplica expenseIsTombstoned existente. Presupuesto/categorías heredan el criterio, manteniendo possibleDup, neutros, UUID manuales y compatibilidad antigua. Índice WeakMap por array deleted; escritores reemplazan por copia, incluido deshacer. Memos de presupuesto incluyen deleted. Gastos e Inicio ocultan filas borradas sin podar el historial; copia de seguridad conserva el dato crudo. Cash/insumos/anclajes permanecen idénticos, porque retirar contribuciones de una base histórica sin reanclaje movería efectivo. Esta tarea no migra bases ni resuelve retrospectivamente cash calculado. Sin borrar arrays, migrar, recategorizar ni modificar decisiones.

Guardián existente widget-coherente: datos ficticios, vivo181, borrados3/-15/-250, candidato ambiguo22, presupuesto1000. **Rojo antes831 frente819; verde después819→813.55** con pago5.45, contra helper servidor real. Comprueba no mutación, insumos de cash idénticos, UUID distintos, lápidas antiguas, null/undefined, nueva lápida por copia y deshacer. E2E existente widget-banco abre Gastos, comprueba DOM y snapshot simulado antes/después de reentrada, conservando filas/lápidas. No equivale a nueva compra real.

Verificación local: npm test ejecuta todos sus guardianes de lógica/sintaxis/i18n/docs/bundle; solo falla memoria-espejo por cuatro archivos externos ya desfasados en la base (diff docs/memoria vs base vacío). No se sincroniza memoria ajena ni se oculta el fallo. Deno no instalado, omitido localmente. E2E global ejecutado separado porque ese fallo impide iniciarlo desde runner: **445 PASS, 1 omitido**, incluidos DOM y puente FIN-05; **7 rendimiento PASS**, separado con1worker. Sin inesperados ni flaky. No se denomina npm test verde. Solo OTA; APK50 capturada ya contiene nativo FIN-05. APK48 no recibe ese nativo por OTA.

Claude REAL analizó base5d5b8d0f sin atribuir causa única desde código; revisión de enfoque1337Z advirtió sobre anclajes cash y se acotó a presupuesto. **PASS al código exacto5b4d1c911fbbf35515a184c3ad3eaf2db80a9a2f**, mensaje20260927T1353Z-claude-fin05-pass-5b4d1c91: reproduce rojo831/819 con rebuild de base y verde con fix, comprueba bundle limpio y ejecuta widget-coherente/arbitraje/sintaxis/i18n/docs en su propio checkout. Revisa consumidores/dependencias, caché/manuales y acepta límite cash conservado. No ejecutó E2E ni pago real; no se le atribuyen. Revisión documental posterior pendiente; no agente interno ni PASS histórico.

Con la copia capturada del estado y la corrección, añadir la única fila nueva visible de la nube produce delta5.45 y la misma cifra que el widget capturado. Verificado sin escrituras ni nuevos pulls. Sondas, build diagnóstica, copia del APK y copias temporales con sesiones retiradas; evidencia nativa privada mínima fuera del repo. APK original sin DEBUGGABLE verificada tras restauración.

## Validación móvil pendiente

Publicar beta solo tras verificación/revisión. Abrir candidata, comprobar versión efectiva y anotar Gastado/saldo del widget; cerrar app. Próxima compra habitual: conservar notificación/hora/cifras antes/después. Gastado debe variar solo por el pago con redondeo entero; reabrir no debe descontar otra vez. FIN-05 abierto hasta ese veredicto. Producción requiere aprobación final explícita.
