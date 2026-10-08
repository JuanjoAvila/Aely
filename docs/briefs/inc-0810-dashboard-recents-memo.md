# Recientes de Inicio · candidata106 · 8/10/2026

Fuente aislada sobre beta102 `6b81279676d66337d7b34b7badc6d1ff2c66bc24`.
Implementación local, sin entrega ni aprobación. INC-2709-09 permanece abierto.

Dashboard mantiene exactamente el filtro de lápidas, sort estable con String/localeCompare
y slice de tres objetos. El hook real depende de expenses/deleted; estado de presupuesto,
settings o fecha civil no requiere recalcular ese orden. No muta arrays ni toca importes,
dinero, banco, SDK, APK, Edge o SQL. El nombre local `last` permite conservar const y recuperar
seis bytes respecto a recent sin alterar el callback ni otras unidades de producto.

La medición previa de ocho cálculos frente a uno y siete hits era cache virtual; no acredita
esta candidata ni el lag humano. El nuevo A/B conserva React/useMemo real en la variante memo
y quita únicamente ese hook en la respuesta HTML local del baseline. El contador de entrada
Dashboard está fuera del callback y el de cálculo dentro: son intentos de render y callbacks,
no commits React. No contiene cache virtual. El oracle y las comprobaciones DOM se ejecutan
fuera de las ventanas medidas. Reporta source/scenario/instrumented hashes, SHA, versión,
navegador, CPU×6, fases, frames, longtasks, gastos escritos y errores íntegros en logs y adjuntos.

Cuatro casos: baseline/memo con3000/5200 movimientos sintéticos y100 lápidas. Aperturas/back
de presupuesto, cambios ajenos, reloj, edición/restauración, alta manual/restauración,
lápida legacy/restauración y pull sintético que usa la closure real de App. Red externa
bloqueada; wrapper bankSync/bankSyncHistory exige cero llamadas. Control artificial180ms
mantiene RAF>100ms, longtask>=100ms y recuperación >5frames/contraste3×mediana.
Finalmente registra guard bancario aunque falle un control. Sin cuentas ni mensajes reales.

Node instrumento/mapa/privacidad/sintaxis/docs verdes antes de commit; Chromium local
ausente, por lo que DOM y CI exacta aún están pendientes. La campaña se ejecuta serialmente
en el runner y está registrada bajo Dashboard. El alcance nuevo vigila derivación, render y ocho helpers/nueve datos alcanzables; no escribe
estado. PERSIST91 conserva su conjunto de escrituras. El alcance de Inicio96 cambia su
terminador de recent a last y su código cambia: no se conserva una aprobación mediante repin.

Presupuesto con esbuild bloqueado0.25.5 y reserva sintética DSN95/version4.26.106.99999:
1317883 B crudos sobre1317888 (5B de margen), gzip359013 sobre359424 (411B).
Cap y minificador intactos. Es un gate preliminar, no el artefacto servido: CI/publicador
deben medir su configuración exacta y conservar el tope. No publicar si lo rebasa.

La nueva tanda usa código propio; todos los alcances afectados deben cotejarse antes de
integrar. Ninguna aprobación anterior se repina ni se hereda por número/versiones.
Revisión independiente, control positivo del diagnóstico anterior, React A/B y CI completos,
presupuesto real e integración beta siguen pendientes. No promoción a main.

El guardián histórico de auth conserva la igualdad de todas sus revisiones anteriores salvo
Inicio96, cuya desigualdad se exige expresamente por el nuevo límite y código. Sus controles
causales de timer/suscripción/continuaciones no cambian. No se usa una excepción para heredar OK.

PERSIST91 añade el ID de la nueva unidad a su inventario de alcances de solo lectura.
Sus veinte dependientes de escritura y sus mutantes causales permanecen intactos.

El guardián fit102 verifica el histórico completo como cola del catálogo nuevo; permite
únicamente la nota106 y su nuevo alcance, más el terminador de Inicio renombrado. Retornos,
receiver, excepciones, trazas y sus siete funciones/nueve datos conservan los criterios.
