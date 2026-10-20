# UX13: atrás con teclado abierto

Candidata sobre `a9c9e45d76d0d92c2c529b0652c24496dea75300`, rama
`codex/ux13-pr248-beta139-private-20261017`. Pendiente de revisión e integración de Claude,
CI del SHA final, beta servida y aceptación física. Sin VERSION ni catálogo.

La base cierra Ask en el primer atrás del navegador y del callback App aunque el
editor conserve una señal explícita de teclado. El gesto predictivo además mueve
el fondo antes de ocultarlo. Los controles de foco sin teclado conservan el cierre
normal. La reproducción usa datos sintéticos, navegación previa real y handlers de
producto; no demuestra un IME Android.

`_mcBackCloseNative` arbitra primero el teclado y conserva su funcionamiento anterior
para capas, pestaña y salida. Los modos `peek` y `only` permiten reutilizar la decisión
sin cerrar una capa. Requiere editor habilitado y editable, reducción considerable de
visualViewport y escala normal; foco, barra del navegador, zoom, readonly y
inputmode=none por sí solos no se tratan como teclado.

En popstate se reconoce primero la travesía propia. Si sólo corresponde ocultar el
teclado, se rearman las capas vivas saltadas sobre el destino reconocido, sin resolver
Ask ni perder el borrador. No se copian estados ajenos. El predictivo fija el editor
al comenzar: si Android redimensiona antes de invoke, ese mismo gesto sigue dedicado
al teclado; cancelar no mueve el fondo ni oculta el teclado. El siguiente atrás queda
disponible sin temporizador de bloqueo.

Cobertura dirigida en `e2e/backclose-handover.spec.mjs`, ya registrado en CROSSCUTTING:
Ask con/sin teclado mediante History y callback App; predictivo con ocultación antes
de invoke y cancelación. Se comprueban borrador, padres, callbacks, estado financiero,
salida nativa y un único atrás a la URL previa real. Se mide el contenedor que recibe
la transformación y se espera el cierre diferido de 420 ms para evitar falsos verdes.
`tests/backclose-history.test.mjs` añade límites de señal, rearmado LIFO y go(-2).

Límite: la reducción de visualViewport es una señal web, no una consulta IME nativa.
Un teclado flotante o una WebView que redimensione simultáneamente layout y viewport
puede no producirla; no se cambia Java ni se afirma cobertura física de esos modos.
La aceptación Android debe comprobar gesto/botón, teclado visible, segundo atrás,
cancelación y conservación del borrador. Si falta señal en ese dispositivo, la
extensión IME nativa necesita alcance expreso de Claude antes de implementarse.

Las evidencias privadas separan ROJO, GREEN dirigido, mutaciones, HTML servido exacto,
errores del harness y gates no ejecutados. No equivalen a suite completa ni a entrega
en beta. No hay backend, datos reales, CPU6, Gradle, APK o despliegue en esta tarea.

Adaptación privada a beta139 para la misma PR248. Se conserva la entrega anterior
60c740dde41d446a2cdbf3f04f13344f15855b3b y su evidencia. `DebtEditSheet`,
`debtEditResult` y la apertura de `PlanEditSheet` permanecen idénticos a beta139;
Deudas no vuelve a `useEditable`. La única lógica modificada es el controlador central.

Los cuatro casos nuevos de `deudas-metas-edicion-v4.spec.mjs` reproducen el cierre
indebido en la base exacta para Deudas/Metas por History y callback App. Esperan
el cierre diferido antes de comprobar la conservación de la hoja y del decimal
intermedio `1,`. Tras la corrección exigen ocultar teclado primero, cerrar en el
siguiente atrás y mantener deudas, metas, presupuesto, reservas, ajustes y gastos.
Los cierres sin teclado y los oráculos financieros existentes se mantienen intactos.
Los dos specs requeridos se ejecutan completos con 1 worker y 0 retries sobre un
puerto propio; las dos pruebas de apertura heredadas usan CDP4, sin benchmark CPU6.

Estado: candidata privada preparada para turno de entrega. Sin push de PR, mensaje
en canal ni publicación de result durante el turno público ajeno. La validación
local no acredita CI general, integración, beta servida ni aceptación física.

Gates medidos en esta adaptación: el guardián de tamaño devuelve EXIT 1. Con la
reserva oficial de configuración de 95 B y sello `4.26.139.99999`, el build local
mide 1.342.606 B minificados frente a 1.342.464 B de tope (exceso 142 B) y
373.018 B gzip frente a 373.760 B (margen 742 B), con tres bloqueantes.
La base reconstruida coincide byte a byte con el HTML del ROJO y mide
1.341.685 / 372.651 B: delta +921 / +367 B. Topes intactos.
`docs-frescura` también devuelve EXIT 1: la base ya contiene cambios de Deudas
posteriores al ancla de versión. El sellado y la decisión de tamaño pertenecen
a integración; esta candidata no modifica VERSION, notas, catálogo ni oráculos.

Validación de la adaptación: los dos specs completos suman 86 casos, todos verdes
(25 de backclose y 61 de edición), EXIT 0, 1 worker, 0 retries, puerto propio.
Pasan también los 24 contratos Node de backclose, la edición financiera con 48
colas React reales, sintaxis del bundle, registro de tests y seguridad. Las
evidencias del ROJO, mutaciones y servicio del HTML canónico se guardan aparte;
el checkpoint privado fija SHA, hashes y EXIT reales sin publicar un result.
