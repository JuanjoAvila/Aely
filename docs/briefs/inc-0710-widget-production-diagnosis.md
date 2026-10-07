# Widget en producción · diagnóstico de fronteras, 7/10/2026

Fuente pública auditada: main `067371705615e9cc58923509e3f60c3d0c9003ff`.
El síntoma técnico es un widget que pide actualizar después de un pago.
**Causa del caso real desconocida**. Este trabajo demuestra mecanismos de la
fuente con datos sintéticos; no lee usuarios, cuentas, tablas, notificaciones
reales ni funciones desplegadas. Sin cambios de producto o despliegues.

## Qué significa ese placeholder

`MiCarteraWidget.build()` oculta cifras cuando se cumple alguno de estos
contratos. El texto por sí solo no identifica qué bandera quedó almacenada.

| Frontera | Condición demostrada en fuente | Recuperación que permite la fuente |
|---|---|---|
| Pago → respuesta ingest | `saveMonth()` rechaza contrato/ventana/scope incompatibles y `pendingUnknown()` conserva identidad del pago | Snapshot de app con ACK del evento/fila o lápida correspondiente |
| App → puente nativo | `widgetContract()` tarda más de 3 s; web llama `widgetWaiting()` y nativo guarda `negotiating` | Negociación válida y `saveApp()` completo aceptado |
| Journal | Serialización no interpretable o límite lleno marca `journalFull` | Una foto de app válida que pueda reconciliar el journal; no borrar a ciegas |
| Calendario | Mes distinto o ciclo mayor de 45 días hace el snapshot stale | Foto aceptada de la ventana actual |

Un `saveApp()` aceptado retira `negotiating`; una foto sin cobertura del pago
no retira `unknownPending`. El nuevo importe visible en la app tampoco prueba
por sí solo esa cobertura. El nativo conserva la incertidumbre deliberadamente
para no presentar como actual una cifra financiera no acreditada.

## Mapa del camino y sus controles

1. `TrExpenseListener` reconoce la notificación, prepara identidad y envía
   POST con ticket de `beginIngest()`. Network/timeout/5xx/429/408 permiten cola
   y reintento. `beginIngest()` sólo incrementa ticket: **offline por sí solo
   no activa el placeholder**. Respuesta vacía, ignorada o sin `month` tampoco
   llama a `saveMonth()`; no confundirlas con incompatibilidad acreditada.
2. `handleResponse()` usa `month.eventKey`, después ACK de fila y finalmente
   evento enviado. Pasa contrato/kind/scope; si faltan lee 0/cadenas vacías.
3. `WidgetPeriod.acceptServer()` exige v2 con la misma ventana si hay snapshot
   v2. `sameScope()` exige igualdad no vacía de selección/regla. Incompatibilidad
   más identidad no cubierta alimenta `unknownJournal` y oculta cifras.
4. Una respuesta compatible usa `WidgetSnapshotArbiter`: fence del push de
   app, readAt del servidor y ticket resuelven cruces. Duplicados no suman otra
   vez. No calcular delta a partir de un absoluto incompatible.
5. En foreground, web negocia contrato y toma cobertura de un pull completo
   de gastos. `wR` queda false antes del pull; sólo el resultado más reciente
   entrega `wC` y pone `wR=true`. Con cloud activo y sin uid/pull completado,
   el push al widget se bloquea. Un error/offline puede conservar el placeholder
   anterior; no significa que no haya pago o que se pueda fabricar una cifra.
6. `widgetCoveredEvents()` v2 cubre filas recibidas anteriores a la ventana
   también, pero no futuras; `deletedKeys` acredita lápidas explícitas. Reabrir
   sin ACK no demuestra sincronización. Otra respuesta compatible tampoco
   elimina automáticamente un pago desconocido distinto.

## Reproducción acotada, sin Android instalado

Dos Java **reales**, `WidgetPeriod` y `WidgetSnapshotArbiter`, compilados con
el módulo JDK ya instalado, ejecutados contra un harness externo de datos
sintéticos: **28 aserciones, exit0**. No es RemoteViews ni SharedPreferences
Android real; las ramas de selección `saveMonth/build` se inspeccionan en fuente.

| Contraprueba | Resultado |
|---|---|
| Snapshot v2 + respuesta legacy incompatible + pago no cubierto | `unknownPending=true` |
| Reabrir con importe actualizado pero sin ACK | Continúa true |
| ACK correspondiente recibido / lápida correspondiente explícita | False |
| V2 misma ventana y scope | Importe probado, sin incertidumbre nueva |
| Scope/kind/start distintos | Rechazo por contrato |
| Respuestas cruzadas por readAt | El absoluto anterior no regresa la cifra |
| Respuesta en vuelo al push / duplicado | Delta exacto una vez |
| Mes caducado / ciclo válido y ciclo >45 días | Staleness discriminante |

Efecto JS de negociación **literal** y guard de push literal ejecutados en
Node `vm`, **9 controles, exit0**: timeout llama waiting, respuesta tardía
ignorándose, retry v2 válido, rechazo del puente, ausencia de plugin, guard
de sesión/pull y modo local. Promesas/timers/native plugin sintéticos: no
React real, dispositivo ni acceso Supabase. No se atribuye el caso humano a
ninguno de esos escenarios sin su recibo.

Los harness y resultados quedan en el paquete de evidencia reproducible
externo; no se dejan sondas o tests huérfanos en producto. Comandos:

```sh
java -m jdk.compiler/com.sun.tools.javac.Main -d classes \
  android/app/src/main/java/com/micartera/app/WidgetPeriod.java \
  android/app/src/main/java/com/micartera/app/WidgetSnapshotArbiter.java \
  WidgetProductionDiagnosis.java
java -cp classes com.micartera.app.WidgetProductionDiagnosis
node widget-negotiation.mjs /ruta/al/checkout
```

## Procedencia y límite de despliegue

El manifiesto público de esta fuente declara APK52/4.26.80,
source `64b4e5f3543ae440812ecf76a7e3259dfc938d1b`, SHA256
`4abfa5b19d8d46bc10239162c20f8a5aa74020d343607fff421ccf61d9ade4d3`.
Los cinco Java de widget/listener/plugin en main067 son byte iguales a esa
fuente declarada (git diff exit0). El acta pública del4/10 registra asset,
firma, code52 y source. El coordinador recuperó el asset público actual: ZIP
6.512.773B y hash exacto del manifiesto. Lectura local de AndroidManifest
binario confirma com.micartera.app, code52/name4.26.80; fábrica web4.26.80.
DEX contiene las cinco clases, widgetContract/widgetWaiting, unknownJournal,
pendingUnknown, sameScope, negotiating y periodKind. Es evidencia de presencia
de símbolos, **no equivalencia de instrucciones DEX con la fuente Java**.
No se ejecutó ese APK ni se verificó de nuevo su firma aquí. Aun un asset
correcto **no acredita la versión instalada** en el teléfono afectado.

`supabase/functions/ingest/index.ts` de main067 produce `month` mensual sin
contract/kind/scope v2. Ese payload local explica la contraprueba de rechazo,
pero **no demuestra ingest vivo**: el repo y el despliegue pueden divergir.
Recibo público histórico: Action36319915174 del27/9, ingest49 desde1397fe28;
SEC03 y actas advierten diferencias respecto de main. No reemplazar una
función activa por main ni inferir que continúa legacy por ese recibo antiguo.
No se consultó get/list-functions ni tablas. Estado vivo de ingest unknown.

## Próximo paso y gates

Primero acreditar, por canal autorizado, la versión instalada y cuál condición
local produce el placeholder, junto con metadatos técnicos saneados del
contrato/ventana/scope/ACK del pago y orden de lectura. No trasladar tokens,
notificaciones, cuentas ni importes reales al repo. Sin esos recibos, hay
hipótesis discriminantes, no una reparación justificada del caso.

Si se confirma incompatibilidad, proponer un contrato compatible con la
ventana y bancos elegidos, preservando ACK/dedup/lápidas/retornos tardíos:
revisión financiera fuerte, pruebas cliente/servidor con datos sintéticos y
autorización de Edge/APK separada antes de cualquier despliegue. Si se confirma
negociación/pull atascado, investigar esa frontera conservando la guardia de
datos completos. **No** eliminar unknown, degradar v2 a mensual, enseñar ceros,
restar el importe notificado sin reglas acreditadas ni sincronizar bancos
automáticamente para ocultar el síntoma. La validación real debe comprobar
foreground/background, offline/reintento, sesión, moneda, ciclo, selección
de bancos y respuestas fuera de orden. INC-2709-09 no se cierra con esto.
