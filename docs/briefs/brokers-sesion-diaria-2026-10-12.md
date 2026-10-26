# Sesiones de brókers entre días · diagnóstico del 12/10/2026

Base de ejecución examinada: beta119, `788432f4682c199edd785f6973d9353330c0064a`.
El encargo y su reserva conservan beta118/`7e706174` como base histórica inmutable.
El rebase está autorizado por la señal canónica `4a9e38ddab36cea4c2655aef956ce27c5cf7a61d`.
Este cambio contiene diagnóstico y propuestas; no corrige todavía la reconexión diaria.
No hay modificación de runtime, servidor, APK, versiones ni catálogo, ni consultas bancarias
reales. Las referencias de línea siguientes pertenecen exclusivamente a esa base.

## Qué está demostrado

Mirar las inversiones no exige renovar su sesión: `Investments` lee `state.investments`,
sin condicionar las tarjetas al estado de conexión (`06-sync-brokers.js:755`). El estado local
se guarda con `mcSaveRaw` (`00-core.js:734`); `slimForCloud` conserva inversiones y sellos
de bróker (`00-core.js:2624`). Una sesión caducada impide obtener una foto nueva, pero no
borra por sí misma la foto anterior. Esto se ha comprobado con las funciones reales de
aplicación/persistencia en Node; no se ha ejecutado navegador ni observado el móvil afectado.

La fecha visible sí está incompleta. En la pantalla completa, `06-sync-brokers.js:983`
presenta solo la hora de `lastPriceSync`. Ese sello corresponde a cotizaciones, no al último
éxito de cada bróker. Tras abrir al día siguiente puede seguir diciendo la misma hora, sin
el día; sin cotizaciones puede decir «sin actualizar» aunque haya posiciones guardadas.
El aviso de antigüedad espera más de 48 horas (`:865`). Una edición manual lleva
`manualUpdatedAt` y sí tiene fecha (`:969`). No se debe convertir el sello de cotizaciones
en fecha de todos los valores ni inventar una fecha para posiciones antiguas.

## Sesión, almacenamiento y renovación por origen

| Origen | Qué caduca y cuándo | Dónde se conserva | Renovación en esta fuente | Qué puede explicar el día siguiente |
|---|---|---|---|---|
| Trade Republic, inversiones y efectivo del puente | `tr_session` se documentó en el nativo como unos 290 segundos. `tr_refresh` rota al usar `/session`; su validez máxima del lado de TR no consta aquí. El WAF es otra cookie, distinta de la sesión. | Jar de la WebView y snapshot `tr_*` en preferencias privadas `tr_bridge`. Teléfono recordado en `mc_tr_phone`; PIN no se persiste. | `sync()` a demanda restaura solo con jar frío y llama a `/auth/web/session`; snapshot tras refresco, al terminar el puente y al pausar. No hay keepalive de servidor. | APK sin snapshot válido, rotación posterior al último snapshot o rechazo real del refresco son hipótesis. La fuente ya incluye arreglos de frío; no prueba qué APK está instalada ni un nuevo fallo de TR. |
| MyInvestor, inversiones por API propia | Acceso y refresco son tokens distintos. La duración del acceso no se fija en el cliente; `refreshExpiresIn` recibido determina `refresh_expires_at`, o queda desconocida si falta. No hay duración diaria demostrada. | `myinvestor_links`, mediante `miTokensToRow`/`miTokensFromRow` de `token_store.ts`. Device ID estable; el cliente recuerda usuario/device ID, nunca contraseña. | `myinvestor-sync` refresca tras 401 de acceso. Migración0011 programa keepalive cada 10 min solo para enlaces `active`. MyInvestor también se consulta al detectar uid, con throttle de 30 min; la tarjeta intenta recuperar un enlace `expired`. | Un refresco temporalmente bloqueado puede convertir acceso401 en falsa caducidad. Desde `expired` el keepalive y el sincronizador general ya no intentan renovar. El funcionamiento actual del cron no se ha leído en vivo. |
| Revolut, efectivo/movimientos por Open Banking | Consentimiento/sesión EB, token bancario de acceso y JWT de aplicación EB son tres cosas. Aely solicita 89 días; no es garantía de duración efectiva. Revolut documenta acceso de 60 min y refresco de 180 días en UE; EB gestiona ese refresco al leer datos. | `bank_links.session_id` cifrado y cuentas/estado/`valid_until`; estado Aely con últimos saldos y `obBalAt`. Tokens propios de Revolut los gestiona EB. | Solo petición expresa, autorización recién completada o notificación habilitada expresamente. JWT EB nuevo por invocación, con `exp=now+3600`; no pide identificación humana para renovar ese JWT. | Caducidad anticipada real, revocación, sesión sustituida, requisitos del banco o problema del integrador son posibles. Nuestro clasificador también convierte cualquier EB401 en caducidad. No hay evidencia de cuál ocurrió al dueño. |
| Revolut, inversiones | No existe sesión automática de posiciones en esta fuente. | Posiciones importadas o manuales en `state.investments`. | CSV/previsualización y, para símbolos disponibles, cotizaciones. Open Banking no actualiza estas posiciones. | Volver a identificarse en Open Banking afecta al efectivo/movimientos, no demuestra pérdida de posiciones de inversión. |
| Otros brókers/posiciones manuales | No hay sesión de bróker implementada por el mero hecho de mostrar una entidad. Cotizaciones y sesión Aely son independientes. | `state.investments`; altas/ediciones manuales con `manualUpdatedAt`. | Importación local, edición manual y servicio de precios para tickers. | Las posiciones permanecen; precio antiguo, símbolo sin cobertura o falta de FX no se arreglan reconectando un banco. |

Referencias TR: `TradeRepublicPlugin.java:138,227,254,298,363,412,464,481,533,545`;
cliente `06-sync-brokers.js:363,367,403,420` y `11-app-main.js:920,934`.
Referencias MI: `06-sync-brokers.js:94,121,133,153,254`; `myinvestor-connect/index.ts:60,117`;
`myinvestor-sync/index.ts:45,73,77,99`; `myinvestor-keepalive/index.ts:27,43,52`;
`migrations/0011_myinvestor_keepalive.sql:46`.
Referencias OB: `_shared/enablebanking.ts:42,59`; `bank-connect/index.ts:33,60`;
`bank-callback/index.ts:70,162`; `bank-sync/index.ts:292,349`;
`00-core.js:1378`; `11-app-main.js:706,1065`; `10-app-components.js:959,978`.
Todos los JS citados viven en `src/modules`, el Java en
`android/app/src/main/java/com/micartera/app` y las Edge en `supabase/functions`.

## Límites del proveedor y errores propios

**MI, error propio reproducido:** tras acceso401, `refresh()` devuelve `false` tanto por
400/401 como por 403/429/500/503 o respuesta200 sin token. El código conserva el 401 anterior
y escribe `status:"expired"` + `authExpired:true`. El keepalive, en cambio, conserva enlaces
ante esos fallos temporales. Un error de red lanzado sale con500 y no escribe expired: no se
debe atribuirle el mismo comportamiento. La recuperación automática de la tarjeta puede
deshacer después un falso expired, pero obliga a entrar en ella y repite consultas.

**OB, clasificación demasiado amplia:** `ebApi` conserva código corto en su excepción,
pero `bank-sync` mira solo `/\bEB\s+401\b/`. El catch real clasifica igual
`EXPIRED_SESSION` y dos fixtures401 con códigos ajenos a caducidad
(`AUTHORIZATION_NOT_PROVIDED`, `UNAUTHORIZED_ACCESS`). La
[FAQ de Enable Banking](https://enablebanking.com/docs/faq/#why-does-the-api-return-expired-session-when-the-session-has-valid-until-in-the-future)
recomienda decidir por error y advierte que401 tiene otras causas. Esos fixtures prueban
la rama del código; no afirman que esos errores se hayan recibido en la cuenta real.

**OB, vigencia insuficientemente modelada:** `bank-aspsps` descarta
`maximum_consent_validity`; `bank-connect` solicita89 días para todos y `bank-callback`
no guarda la vigencia efectiva de la sesión devuelta. Esto limita el diagnóstico del permiso
mostrado. No se ha demostrado que el banco haya recortado esa fecha ni que esté causando la
reidentificación diaria. Extender directamente a180 días sin conocer el máximo sería adivinar.

**Qué cambia en beta119:** la reconexión ya conserva `last_sync` si `keepsCursor`
reconoce las mismas cuentas por IBAN/hash; nuevas cuentas no heredan ese cursor.
Si el GET de sesión falla sin confirmar cuentas, no sustituye las anteriores por una lista
vacía. `bank-connect` renueva `state_issued_at`, que invalida acuses del enlace anterior.
`bank-sync` recibe `acks` y guarda el cursor de la respuesta acusada; con cursor nulo fija
la víspera de la ventana como punto de partida. Son garantías de entrega del extracto,
no renovación del token bancario ni prueba de que sobreviva la autorización. No cambian
la solicitud89 días, la ausencia de vigencia efectiva guardada ni el catch292 de EB401.
Se conservan estas garantías en la base: esta PR no modifica sus funciones ni sus oráculos.

La [FAQ de EB](https://enablebanking.com/docs/faq/#how-long-is-session-validity)
explica que el límite depende del ASPSP y que EB renueva sus tokens internos durante las
lecturas. La [nota oficial de Revolut](https://developer.revolut.com/blog/2025-03-19-open-banking-refresh-tokens)
separa60 minutos de acceso y180 días de refresco UE desde agosto2025. Por tanto, una duración
corta del acceso no basta para explicar un nuevo login humano diario. No añadir un keepalive
Revolut ni sincronización al abrir/foreground: conservar Open Banking a demanda.

Historial de TR: `docs/memoria/tr-frio-saga.md:28-49` registra cookies perdidas en frío,
refresh duplicada y prueba humana del capítulo3 en julio; `:55-61` conserva capítulos anteriores.
Son antecedentes, no observación actual. MyInvestor: `docs/memoria/mi-cartera-roadmap.md:277-318`
registra login móvil/Edge, captcha, migración0011 y keepalive; la supervivencia durante días
quedó pendiente de prueba humana. `mi-cartera-escalado.md:159-193` separa PSD2 de API de
inversiones y conserva planes previos; no usar sus endpoints antiguos como fuente actual.

## Mejoras propuestas, por ahorro de reconexiones y riesgo

| Orden | Mejora | Riesgo y entrega requerida | Estado de este encargo |
|---|---|---|---|
| 1 | MI: distinguir acceso caducado, refresco rechazado y fallo temporal; no escribir expired ante bloqueo/5xx/respuesta incompleta. Conservar último valor y permitir reintento manual. | Medio: handler servidor, tests Deno y despliegue propio. No APK. | Bug reproducido; propuesta para el titular de servidor. Backend reservado por SEC01, sin edición. |
| 2 | OB: caducar por `EXPIRED_SESSION`/códigos contractuales de cierre, conservando fallos de autorización de aplicación como error técnico. | Medio: handler servidor y contrato EB; no APK. Evitar ocultar caducidades reales. | Reproducción focal del clasificador; no corrección ni atribución a Revolut real. |
| 3 | Inversiones: fecha completa del último dato por origen; diferenciar cotización, lectura de bróker y edición/importación. Si no consta fecha, «Fecha no disponible»; nunca «hoy» inventado. | Bajo en transporte, medio en semántica/compatibilidad: fuente web, tres idiomas, e2e del DOM y mapa. No APK/servidor. | Propuesta separada. `lastTrSync`/`lastMiSync` existen en sync general, pero aplicar la previsualización de cada tarjeta no los sella. Además la UI está reservada en otro encargo. No implementar una hora global engañosa. |
| 4 | Comprobar cron MI: existencia/frecuencia/última ejecución y contadores saneados; estudiar concurrencia sync/keepalive y guardado por versión si el proveedor rota refresh. | Medio: diagnóstico autorizado de servidor; serialización si procede. No APK. Sin afirmar carrera hasta observarla. | Migración y función presentes; ejecución real desconocida. No se consultó ni activó cron. |
| 5 | OB: conservar máximo del banco y vigencia confirmada para mostrar un permiso fiable; no cambiar consentimientos existentes por arrastre. | Medio: backend/contrato y posible migración; decisión sobre ampliar el plazo solicitado. No APK. | Propuesta, no ampliar a180 por suposición. |
| 6 | TR: observar un sync manual en frío con APK exacta y error/códigos saneados; intervenir solo si demuestra fallo de snapshot o rotación. | Diagnóstico de móvil; si requiere cambio Java, APK nueva. | La fuente ya incluye snapshot/deduplicación/pausa. No parchear otra vez sin evidencia. |

No se incluye un arreglo web aislado: falta una fecha homogénea en las rutas de importación,
la UI está reservada y un cambio visible requiere el slot/DOM que ahora pertenece a Inicio.
El diagnóstico evita declarar arreglado el síntoma mediante un texto nuevo que no lo acredita.

## Evidencia sintética y límites

Se ejecutaron los handlers MI reales, quitando imports externos y transformando TS con el
esbuild ya instalado para VM Node; transporte, cifrado y BD sustituidos por dobles sintéticos.
También `ebApi` y el catch real por cuenta; este último no es el handler bancario completo.
Repetición sobre beta119:15 casos,8 cumplen el criterio y7 conservan el fallo de producto
(5MI +2OB). El arnés sale0
porque confirma el comportamiento observado; **no significa aceptación verde**.
Ninguna credencial real, petición externa, escritura de BD ni captura familiar.
Dos intentos iniciales del extracto OB fallaron por el propio andamio TS antes de corregirlo;
se conserva ese límite y no se cuentan como fallos del producto. Andamio temporal retirado
al cerrar; se conservan JSON/logs privados saneados.

Guardianes Node existentes: `broker-sync-outcomes`15 casos, `tr-open-banking`15 y
`bank-connect-once`3 pasan. Build, sintaxis, privacidad, docs-frescura y presupuesto
pasan en la comprobación histórica de118, con límites1303KiB/356KiB/3 bloqueantes.
Su medida oficial118.99999 y reserva95B fue1.333.562B/364.346B gzip9,
márgenes710/198B. No se heredan esos verdes ni esas cifras a119: se repiten los guardianes
focales y el presupuesto con la base nueva y sus topes publicados1304KiB/357KiB/3.
Repetición119: build, sintaxis, privacidad, docs-frescura, presupuesto y33 casos focales
Node exit0. Medida oficial119.99999/reserva95B:1.334.526B/364.664B gzip9/3;
topes1.335.296/365.568B, márgenes770/904B. Sin modificar caps.
Sin delta de runtime frente a119; no se amplían topes propios para ocultar exceso.
No se ha corrido localmente la suite completa, Deno, Chromium, rendimiento ni Gradle.
La CI solicitada para el SHA de la PR conserva su gate aparte; verde no prueba login real.
La CI118 `38284839611`/fuente`8b61931a` se conserva como histórica: seguía en curso al
rebasar y GitHub no entregaba todavía su log (intento exit1). No es validación de la nueva
fuente ni motivo para dejar la reserva esperando aquella ejecución. El SHA final119 recibe
su propia CI de Tests; el resultado y log exactos se guardan aparte del diagnóstico.

## Comprobación humana posterior, sin datos en el repo

1. Al día siguiente, abrir Cartera → Inversiones sin tocar Actualizar. Comprobar si siguen
   presentes las posiciones; observar si el texto da solo hora o indica «sin actualizar».
2. Tocar Actualizar una sola vez. Distinguir qué origen pide conectar: TR, MyInvestor o
   Revolut en Mis bancos. Conservar solo hora, versión APK y código/mensaje saneado.
3. TR: distinguir arranque frío de volver a primer plano. Un error temporal no debería
   borrar las posiciones ni exigir PIN automáticamente. No desconectar para probar mirar.
4. MI: si pide reconectar tras fallo temporal, comprobar el estado/código con el titular
   autorizado del servidor antes de volver a introducir contraseña. No enviar tokens.
5. Revolut: comprobar si pide autorización del banco o login de Aely; son sesiones distintas.
   No repetir Reconectar varias veces ni activar sincronización automática para ocultarlo.

No se solicita ejecutar esos pasos durante este diagnóstico ni aportar credenciales.
