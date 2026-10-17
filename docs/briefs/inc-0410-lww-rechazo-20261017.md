# Port privado INC-0410 para beta 141

Tarea `inc0410-beta141-port-codex-20261017`, grant `2d7767bafa474b80048ebff1865d9041ff577b9c`. Nuevo checkout/rama desde beta exacta `a9c9e45d76d0d92c2c529b0652c24496dea75300`; se porta únicamente la lógica revisada de `c42b7b74c9a300d7103c9e1fcb8b69a17a41cce2`. PR253/rama/result47b4401e permanecen congelados. No hay solapamiento de hunks de runtime con los cambios de beta; Deudas/Metas v4, 08/09, VERSION, catálogo y caps se conservan. El fallo contextual de aplicación se limita a cabeceras de Arquitectura/Testing y se documenta sin cambiar lógica.

La fuente nueva requiere cuatro tests propios de metas, transporte mensual, reserva-dinero y E2E dirigidos de Metas/persistencia. Las pruebas de la fuente anterior no sustituyen estas comprobaciones. Puerto/checkouts/evidencias propios; un worker y cero retries; sin CPU6/suite/Gradle ni SQL, bancos o backend reales. El límite inverso de subida sigue siendo manual-only:15000c tras conflicto y17000c solo al reaplicar20 mediante App.set. Tamaño oficial, CI, integración, servido y aceptación móvil mantienen sus gates; no ProductREADY.

## Verificación privada del port sobre beta exacta

Los cuatro tests de metas pasan: tres vías12, remates R1 diez, R2 seis y R3 seis;34 casos en total, EXIT0. Transporte mensual y reserva-dinero: EXIT0. Build y sintaxis de siete bloques: EXIT0. El mutante de la guarda R3 da EXIT1, con tres fallos causales y un control correcto; reaparece12000 frente a17000c en ambos órdenes de edición. Las pruebas se ejecutaron en el checkout nuevo, con fuente beta v4 y sin cambiar los oráculos portados.

E2E dirigidos:165/165 PASS, un worker, cero retries, skips o flaky. Incluyen57 casos de Deudas/Metas v4 y los specs existentes de alta, borrado, edición, mensual y persistencia. Playwright del runtime configurado de esta sesión, Edge instalado y servidor local propio en puerto exclusivo; sin instalación, módulos de otros checkouts ni npx. El alias privado de runtime sólo resuelve la API pública de tests; no altera specs ni aserciones. Hash del HTML servido igual antes/después y al archivo generado. No sustituye aceptación móvil.

El build regeneró también digests en public/release-notes.json y public/beta-delivery.json; ambos se restauran a la beta exacta por quedar fuera de alcance. El HTML y código probados se conservan. Los E2E no acreditan la coherencia del catálogo restaurado: beta-sources/recibos, tamaño oficial, CI e integración mantienen gate independiente para Claude. No se recalculan caps ni se finge ese verde. No hubo fetch de fuente/canal, activación de presupuesto, push o result durante esta fase privada.

## Contrato revisado de la fuente original (histórico conservado)

# INC-0410 · R3: asiento de reserva y conflicto de su meta

Sucesora privada de PR253 sobre `ecd536bbd660e1e4d13fad3b097bdd1181910a73`, task `inc0410-pr253-review3-reserve-conflict-codex-20261017` (`622b72062ec83b567e4777c09754b3e98cc319eb`), NO-GO Claude `f9b0d2ae68140425586dd657c1232fa46cbaf4ed`. Mismo titular y PR; result R2 `ebbf174c6d0c96e434a075cda82b0752787922e9` y todas las fuentes/evidencias anteriores inmutables. Los demás casos R2 están cerrados por el revisor. Esta fuente trata exclusivamente R3-1 y sigue pendiente de revisión, tamaño e integración; no es ProductREADY.

## Contrato

Con base conocida, la fusión sigue siendo a tres vías. Solo se conservan las reservas locales si las metas tocadas por reglas/asientos locales nuevos o modificados no tienen un conflicto de campos con nube. Se comparan reglas y asientos por su identidad y contenido frente a la base; una regla base sin cambios no convierte otra meta en afectada. Si hay conflicto en una meta afectada, se usa el rechazo existente: foto financiera completa de nube, `keepLocalReserves:false` y copia privada saneada de todo el estado local. No se suman saldos absolutos ni se fusionan reglas/log.

Caso causal: Z asienta 50 sobre 100 sin subir; A aporta 20 y sube 120 sin ese asiento. Antes quedaba 120 con el asiento de Z marcado, que impedía recuperar los 50. Tras rechazar se adopta 120 sin el asiento, se conserva el local 150 en el registro y el motor mensual real reaplica 50 al terminar ese pull válido: 170,00 EUR, exactamente 17000 céntimos y un único asiento. Repetir el motor no aporta de nuevo. También se prueba el orden inverso de edición de A/Z, manteniendo A como primer envío.

El orden inverso de **entrega** tiene una semántica distinta bajo el contrato previo: Z sube primero 150 con el asiento y A intenta subir su 120 manual. Gana la nube 150 y el aporte manual queda recuperable en `goals_field_conflict`; el motor no duplica el asiento. El test llega a 17000 céntimos tras una edición explícita de 20 mediante el `set` real. Esta fase no implementa ni acredita una recuperación automática de aportes manuales en ese orden; sumarlos automáticamente sería ampliar el contrato de conflictos. Se declara esta distinción para revisión, sin presentar la recuperación manual como replay automático de los 50.

Se mantienen R2: reservas cambiadas solo en un lado o iguales permiten fusión de metas disjuntas; divergencia distinta de ambos lados rechaza; grupo saved/target/done/doneAt indivisible; cap3 en partición privada, saneado de gastos/feed/históricos/perfil, resetSandbox, caché ordinaria, ACK sin re-sello ni bucle, notificación durable única y SIGNED_OUT.

## Evidencia y límites

`tests/goals-review3-reserve-conflict.test.mjs` está registrado en run-tests. Sobre ecd536bb, antes de modificar producto, el rojo da tres fallos y dos controles correctos: en ambos órdenes de edición se observa 12000 frente a 17000 céntimos; la nueva regla con conflicto de nombre tampoco rechazaba. La primera captura roja verificaba el asiento indebidamente retenido; la segunda adelanta la aserción monetaria para mostrar la pérdida exacta, conservando ambas. El verde final añade un control de regla base intacta: seis casos correctos. El mutante que retira solo la guarda nueva vuelve a perder los 50 en ambos casos y deja de rechazar la nueva regla: tres aserciones causales fallan.

Las regresiones focales se justifican por el cambio en goalSyncPull: R2, tres vías, R1 (incluidos M9/M12, privacidad/partición/logout) y transporte del pull mensual. El build genera public/index.html y la sintaxis comprueba sus bloques. No se repiten suite general, pruebas ajenas ni motores sin cambios.

No se modifica 08, 09/editor, VERSION, catálogo, caps, servidor u oráculos ajenos. La guarda vive en 00-core; 11-app-main ya aplica el rechazo completo y no requiere cambios. Tamaño oficial minificado/gzip pendiente por falta de esbuild autorizado; HTML/gzip crudos no lo sustituyen y no se hacen nuevas mediciones. CI general, revisión/integración de Claude, artefacto servido y aceptación navegador/móvil pendientes. Sin fullsuite, CPU6, Gradle, SQL, bancos o deploy. Fuente privada congelada hasta nuevo turno de entrega; sin lecturas/publicaciones de canal en esta fase.
