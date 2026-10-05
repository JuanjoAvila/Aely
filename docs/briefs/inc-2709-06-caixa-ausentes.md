# INC-2709-06 · cargos CaixaBank ausentes

## Actualización 5/10/2026 · el reintento diario sale del commit, no del updater

Un verde de esta unidad **no autoriza integrar el PR #131**. Solo corrige el reintento del sync diario con el setter de App diferido. El resto del NO-GO [5989932516](https://github.com/JuanjoAvila/Aely/pull/131#issuecomment-5989932516) sigue abierto. El caso humano sigue abierto. Edge no se despliega.

Qué fallaba en `d5739cce`. Datos inventados: cargo-B local (`uuid-fixture`, Caixa, `2026-10-05T06:01:23.456Z`, 12,50 €, MERCADONA). El primer envío vuelve sin ids porque cargo-A, otra referencia con la misma terna, ya ocupa el sello. `obSettleDaily` llenaba `upload` dentro del updater y `obChaseRounds` miraba `upload.length` en cuanto `set` volvía. El `set` de App solo encola, así que la lista estaba vacía y la ronda paraba. Al comprometer, la fecha local de cargo-B cambiaba y nadie la subía: 1 envío de 2 esperados, y el local con una fecha que la nube no tiene. Con un setter que aplica al momento se veía bien, y por eso los guardianes anteriores no lo cazaban.

Ahora el updater solo calcula: refecha las filas que siguen vivas, sin lápida y con la misma terna (fecha, importe y comercio) que tenían al enviarse, y devuelve siempre un estado nuevo, porque sin commit no hay de dónde leer una fila editada. Lo que se sube lo decide `obDailyCommit`, llamado en el mismo `useLayoutEffect` de App que `mcPersistCommit` y `obHistNoticeCommit`, con el estado comprometido. Si la fila sigue con la terna de antes, el refechado aún no está en ese commit y se espera al siguiente. Si cambió, se sube la fila tal cual está, con su uuid. Si no está o tiene lápida, no se sube. Cada espera se resuelve una sola vez. Un setter que devuelve el estado (herramientas síncronas y los guardianes que ya existían) ya lo ha aplicado, y ese estado cuenta como el comprometido. El histórico no cambia: su `prepare` sigue devolviendo una lista y `obChaseRounds` la manda igual que antes.

Fuera del alcance previsto (`08-motor-bank.js`), una línea en `11-app-main.js`: la llamada a `obDailyCommit(prev, state)` en ese layout effect. Sin ella no hay manera de saber qué estado se ha comprometido. La llamada a `obHistNoticeCommit` no cambia.

`node tests/inc-2709-06-diario-diferido.test.mjs` usa el callback marcado `OB-ACK-DAILY` de App, el `set` de App sacado de `11-app-main.js` y una cola que se aplica al comprometer, como `useState`. Contra el bundle de `d5739cce`: 7 fallos en UTC y 7 en Europe/Madrid, exit 1 (esperado 2 envíos, obtenido 1, y sin consumidor en el layout). Con este cambio, 10/10 en las dos zonas. Casos: el reintento sale tras el commit con la fecha comprometida y el ACK del mismo uuid; una evaluación descartada no envía nada, y lo que sube es lo comprometido; el replay del updater y un layout repetido no suben dos veces; un commit que todavía no lleva el refechado no sube la fecha que choca; borrar durante el ACK o entre el encolado y el commit no revive ni sube; una lápida `obid` con la fila todavía en el estado no sube; editar la categoría viaja en el reintento; editar el comercio no refecha y sube lo editado con el mismo uuid. Ocho mutantes sobre el bundle: mueren siete (subir al evaluar, sin estado nuevo cuando no hay refechado, espera que no se retira, no esperar al refechado, no mirar la lápida en el commit, refechar con el comercio cambiado, App sin llamar al consumidor). Vive uno equivalente: quitar el guardo `prev===state` no sube nada de más, porque la espera ya se retiró.

`inc-2709-06-hist-durante-ack` sigue 15/15 en las dos zonas, y la regresión del PR (`inc-2709-06-ack`, `-identidad`, `-caixa-extid` y el resto de la lista) y `npm run test:syntax` siguen en verde. Sin DOM de React, sin móvil y sin e2e: el commit lo simula la cola del guardián.

## Actualización 5/10/2026 · el lote se cierra desde el commit, y el recibo no sale en ningún volcado

Un verde de esta unidad **no autoriza integrar el PR #131**. Codex dio GO solo al aviso postcommit de `cb570a24` ([5991998777](https://github.com/JuanjoAvila/Aely/pull/131#issuecomment-5991998777)) y NO-GO a cerrar la unidad. El resto del NO-GO [5989932516](https://github.com/JuanjoAvila/Aely/pull/131#issuecomment-5989932516) sigue abierto. El caso humano sigue abierto. Edge no se despliega.

Caducado del apartado de debajo: «`onClose` y `setImporting` siguen al resolverse el ACK» y «el recibo no viaja en `slimForCloud`» como garantía de nube. En `cb570a24`, con un setter que encola el updater, la ficha ya se cerraba (`importing:false`, `close`) con 0 filas confirmadas. Y App pasa `stateRef.current` entero a `cloud.backupState`, así que la copia diaria guardaba el recibo con `added` y `spec.expAdds`.

Ahora:

1. **Cierre.** Hay recibo siempre, también sin altas nuevas, porque sin estado nuevo no hay commit del que cerrar. Lleva una marca del lote; `obHistNoticeCommit` avisa y cierra ese lote una sola vez, desde el estado comprometido. Una evaluación descartada no cierra. Con cero altas el histórico de gastos y `lastHistImport` no cambian de referencia.
2. **Volcados.** `mcSinRecibo` quita el recibo en disco (`mcSaveRaw`), en el push (`slimForCloud`) y en la copia diaria, dentro de `cloud.backupState` para que ningún llamador lo suba. La copia sigue completa: gastos, `bankTx` y `lastHistImport` incluidos. El estado vivo no se toca.
3. **Fallo del batch.** El aviso de fallo sale tras el commit, sin filas, una vez, tanto si el envío lanza como si responde `null`.

`node tests/inc-2709-06-hist-durante-ack.test.mjs`: contra el bundle de `cb570a24`, 5 fallos en UTC y 5 en Europe/Madrid (cierre sin commit, cierre con cero altas, dos de fallo, copia diaria). Con este cambio, 15/15 en las dos zonas. La copia diaria se prueba con el método real de `cloud` y un doble de Supabase en memoria; no hubo acceso al servidor. Nueve mutantes sobre el bundle (aviso de fallo quitado, `null` como alta vacía, `catch` sin fallo, cierre al encolar, sin cierre en el commit, sin recibo con cero altas, cierre reutilizable, copia con recibo, aviso repetido) mueren los nueve. Sigue sin haber DOM de React ni prueba en el móvil.

## Actualización 5/10/2026 · el aviso sale del commit, no del updater

Un verde de esta unidad **no autoriza integrar el PR #131**. El resto del NO-GO [5989932516](https://github.com/JuanjoAvila/Aely/pull/131#issuecomment-5989932516) sigue abierto. El caso humano sigue abierto. Edge no se despliega.

En `db755d2a` el doble UUID del canónico ya no se concatenaba, pero `persistHistImport` mutaba `avisado` y armaba `Promise.resolve().then(obHistAnnounce)` dentro del updater. Evaluar ese updater con estado vacío y descartar el resultado anunciaba `bp_hist_done_g=1` con 0 filas confirmadas; repetirlo sobre el canónico dejaba el aviso. Al revés, la evaluación descartada con el canónico se quedaba el turno y la evaluación que sí añadía 1 no avisaba. La reproducción de Codex (`node --input-type=module`, datos inventados) sale 1 en ese commit, en UTC y en Europe/Madrid.

`obHistCommit` sigue siendo un cálculo puro. El aviso es un recibo en el estado que React compromete, y `useLayoutEffect` lo consume una sola vez junto a `mcPersistCommit`. Una promesa dentro del updater no cuenta. El recibo no se guarda en disco ni viaja en `slimForCloud`. `onClose` y `setImporting` siguen al resolverse el ACK, fuera del updater: si no hay cambio de estado no hay commit nuevo, y cerrar la ficha no puede depender de eso. No hay DOM de React en el guardián: el test llama a `obHistNoticeCommit` y comprueba que el bundle engancha esa llamada en el mismo layout que el volcado.

## Actualización 5/10/2026 · unidad acotada sobre `0fa7075a`

Un verde de esta unidad **no autoriza integrar el PR #131**. El resto del NO-GO [5989932516](https://github.com/JuanjoAvila/Aely/pull/131#issuecomment-5989932516) sigue abierto (fecha de ingreso inválida, identidad de un reintegro, el setter diario que pierde un reintento si el updater va diferido, formato de clave y lápida entre app y servidor, zona horaria, compatibilidad de versión y `#dup`, recuperación tras un pull fallido, alcance de la revisión, presupuesto de tamaño). El caso humano sigue abierto. Edge no se despliega: el widget publicado sigue juntando por día.

Qué se midió en `0fa7075aa23cf9c66e7c1050356d2780f32e3a08`. Mientras el histórico espera el ACK, un pull mete el cargo canónico de la misma referencia `cargo-A`. `obPlanRetry` se queda el objeto local. `persistHistImport` deduplicaba solo por uuid y hacía `shown.concat(s.expenses)`. Al soltar el ACK salían dos filas y 25 € por un cargo de 12,50 €, y el deshacer podía llevar una fila que ese batch no insertó. El aviso leía una variable que `set` todavía no había rellenado y anunciaba 0. `node tests/inc-2709-06-hist-durante-ack.test.mjs` contra ese commit: 3 fallos en UTC y 3 en Europe/Madrid (canónico duplicado, A/B con el uuid local de más, contador 0). Borrar durante el ACK, el mismo extId en bancos distintos y dos filas sin extId ya salían bien y siguen saliendo bien.

El commit del histórico reconcilia contra el estado de ahora, en un cálculo puro: primero la lápida; luego el uuid, o banco más extId no vacío. Importe, comercio y día no son identidad. Si la referencia ya está, se conserva esa fila y sus ediciones; el uuid local no se concatena. Contadores, deshacer y `cloudIds` solo llevan lo que este batch insertó de verdad. Si no cambia nada, se devuelve el mismo estado. El aviso sale del resultado del commit, en una microtarea, y no se pinta si no hubo altas. No se toca `obPlanRetry` ni el sync diario.

## Actualización 5/10/2026 · revisión Codex de `d67edc7b`, NO-GO

Codex revisó `d67edc7b5b3eea62eeb21fab3cdc4bcae0f947c3` y no lo dio por bueno. El guardián de la pasada anterior le entregaba a `obReassignSkipped` la nube entera. Los callers de `11-app-main.js` y `10-app-components.js` no hacen eso: el upsert solo devuelve los id insertados (`ack.kept`). Una escritura ignorada no trae la fila que ya ocupaba la terna. Reproducido ejecutando ese callback, con un transporte que ignora la terna y no inventa la fila remota, en UTC y en Europe/Madrid (`node tests/inc-2709-06-ack.test.mjs` contra ese commit: 6 fallos en cada zona). El caso humano sigue abierto: no se ha leído el enlace, la respuesta de Edge ni las filas de ese perfil.

Qué fallaba en `d67edc7b`, y qué hace el cliente ahora:

1. **La misma referencia en dos clientes.** El segundo write no devuelve id. Sin leer qué referencia ya está guardada, el reintento cambia la fecha y la nube queda A+A con dos uuid. `pullExpenses` consulta las filas de verdad. La referencia sale de `#x.` en `source` (el pull no trae columna `extId`). Si ya está esa referencia de ese banco, no se sube otra fila y no se cambia la fecha. El uuid de la nube sigue siendo el de la primera inserción.
2. **Tercer choque Az/BY/C8.** Esos tres id comparten sello en `#0`, `#1` y `#2`. Tres clientes parciales ocupan la fecha preferida y el primer reintento; el tercero recibe cero ids y `drop2` borra C8 en local. Un segundo choque no acredita un duplicado ni autoriza tirar el dinero. Con lo que la lectura marca como ocupado se elige el primer sello libre de esa terna, y se conserva el uuid. Si no hay hueco, la fila se queda en local.
3. **Borrado durante el ACK.** El callback concatenaba el movimiento con otra fecha. La lápida de día dejaba de casar y la fila revivía, también en la nube, aunque existiera `obid|banco|extId`. Antes de reinsertar o subir se mira si el id sigue en el estado y si esa lápida `obid` está puesta.
4. **Edición durante el ACK.** El reintento se armaba con el objeto del cierre y pisaba categoría, nota y comercio. Se parte del objeto que hay ahora: si importe y comercio no cambiaron, solo se mueve la fecha; si cambiaron, se sube el estado actual.

Offline, `null` o una excepción no acreditan guardado y no borran el local del sync diario (`null` sigue siendo el corte del modo pruebas, no un rechazo del índice). En el histórico, un fallo sigue sin dejar filas; offline las deja todas y sin ids de nube. Lo que se absorbe o se retiene en local no entra en `lastHistImport.cloudIds`: deshacer no debe borrar un uuid que no se insertó.

**28 y 15,50.** `claveComoLaApp` alarga la clave de un Open Banking que ya no es el mediodía local, la misma regla que `keyOfExpense`. macrodroid sigue en el día: dos notis APOLLON del mismo cargo cuentan una. Con dos MERCADONA de 12,50 € y un café de 3 €, la app y el widget del repo cuentan 28. `#dup` y la cuota `~deuda` siguen fuera. Este PR no despliega Edge: el widget ya publicado sigue juntando por día hasta ese despliegue. Un cargo en el mediodía de Madrid (`T10:00:00.000Z` en verano) es mediodía en el móvil y no lo es en un proceso UTC; los sellos de este par no son mediodía en ninguna de las dos zonas, así que los dos cuentan en las dos zonas cuando el Edge lleve esta clave.

Caducado del apartado de `720e5aab`, más abajo: «si el segundo sello tampoco entra, se quita» y «no se toca `presupuesto.ts`» / «la app cuenta 28 y el widget 15,50». Sigue en pie: el índice desplegado no se cambia, `#dup` gana a `#x.`, `~deuda` se conserva, y FIN-04.1 no se mezcla.

No hay SQL, migración, despliegue de Edge, reparación del histórico, sincronización automática ni subida de `VERSION`.

## Actualización 4/10/2026 · revisión Codex de `720e5aab`, NO-GO

Codex revisó `720e5aabc4622f8dbd56f8e03807c0d710c39dbf` y no lo dio por bueno. Los cuatro fallos se reprodujeron con datos inventados, en UTC y en Europe/Madrid, contra ese bundle (`node tests/inc-2709-06-identidad.test.mjs`, salida en el informe de la rama). El caso humano sigue abierto: no se ha leído el enlace, la respuesta de Edge ni las filas de ese perfil.

Qué fallaba en `720e5aab`, y qué hace el cliente ahora:

1. **Histórico incremental.** A ya estaba; el flatten se quedaba B, pero `histCandExisting` lo marcaba duplicado de A por día|importe|comercio y el commit creaba cero filas. Un candidato con referencia solo casa la misma referencia del mismo banco, o una fila vieja sin referencia cuyo sello es exactamente el suyo. Sin sello, una fila vieja se reclama una sola vez. B entra.
2. **Dos clientes, cada uno con una referencia.** Los dos se quedaban el mediodía local. El `onConflict` desplegado (`user_id,fecha,importe,comercio`, `ignoreDuplicates`) ignoraba la segunda escritura y el segundo móvil la conservaba como guardada. Al releer, la nube acababa en A+A y B no estaba. Un id nuevo ya no ocupa el mediodía: su sello es `histDate(día, "ob-ext|banco|id")`, el mismo en el sync y en el histórico, ordenado por id y no por quién llegó antes. Si el índice ignora la escritura, no se deja en local; se prueba un sello libre una vez y, si tampoco entra, se quita.
3. **El hash choca.** Con `0`, `Az` y `BY`, `histDate(Az)` y `histDate(BY)` son el mismo instante. El diario se quedaba dos de tres y el histórico emitía dos fechas iguales; el índice tiraba una. La colisión se resuelve contra las fechas ya ocupadas de esa terna (`#n`), no se supone que el hash sea único.
4. **Ida y vuelta.** Un extId de 150 caracteres se recortaba a 120 en `source` y el siguiente sync creaba otra fila. `ob-hist` no devolvía la referencia: perder la del mediodía hacía casar A y reinsertar B. Ya no se recorta. El servidor desplegado no parte `#` en `ob-hist:` (`bancoDeSource` se queda el texto entero y el widget dejaría de contar el cargo). Por eso una fila de histórico con referencia se escribe `ob:banco#x.` —ese sí se parte— y al volver el pull es `source:"ob"` con el extId entero. `#dup` sigue en `ob-hist:banco#dup` y gana a `#x.`. `~deuda` se conserva junto a `#x.`.

El índice desplegado **no impide** guardar las dos filas: caben con fechas distintas. No se inventa otra clave de servidor ni se toca `presupuesto.ts`. Lo que el índice no resuelve, y queda como límite, es el widget: `claveComoLaApp` junta por día. Con dos MERCADONA de 12,50 € y un café de 3 €, la app cuenta 28 y el widget 15,50; la diferencia es el segundo 12,50. `#dup` y la cuota `~deuda` siguen fuera de los dos. Eso no es una corrección financiera completa del par.

Sigue caducado, del apartado de debajo: «la sal la ocupa el id menor» y «`ob-hist` no lleva `#x.`». El mediodía solo se reclama si ya hay una fila vieja ahí sin referencia. Una lápida de día sin filas vivas sigue bloqueando el alta. Si convive con el hermano y no hay `obid`, la referencia borrada puede volver con su sello; el borrado nuevo escribe `obid` y no vuelve.

No hay SQL, migración, Edge, reparación del histórico, sincronización automática ni subida de `VERSION`. FIN-04.1 (PR #129, cerrado) no se mezcla: `cloudSourceParts` rechaza `#x.` y aquí no se usa.

## Actualización 4/10/2026 · arreglo de cliente, caso humano abierto

**El caso del perfil no está cerrado.** No se ha leído el enlace, la respuesta de Edge ni las filas de ese titular. Lo que sí se reprodujo, en la base `3048399c` (el producto de `src/modules` coincide con `main` `8bb0398f`), es un defecto de identidad con datos inventados:

- Dos cargos Caixa, `entry_reference` `cargo-A` y `cargo-B`, mismo día, 12,50 € y comercio. `flattenBankTx` entregaba 2 y tiraba el `uid`. `importObExpenses` añadía 1.
- La misma pareja, una sola cuenta, ambos contabilizados: `histFlattenHistoryLinks` dejaba 1 candidato y `skippedUniq=1`.

Eso explica cargos que el banco manda y Gastos no llega a tener. No demuestra que los cargos ausentes de ese perfil tengan esta forma. El cierre sigue pidiendo el cotejo de solo lectura del 29/9 (versión, filtro, enlace, páginas, filas y lápidas).

El PR 128 (`788fa1f`, rama `cursor/inc-2709-06-caixa-ausentes-da8c`, cerrado, base `main`, conflictos con `beta`) se trató como hipótesis. Comprobado en este entorno:

| Qué decía | Qué salió al ejecutarlo |
|---|---|
| El colapso diario y el del histórico son reales | Confirmado, en la base y en su test con `TZ=UTC` |
| Salar la fecha con `histDate` para caber en `expenses_dedup_idx` | Aceptable: la sal queda el mismo día civil y no hace falta migración. Su clave miraba el texto UTC `12:00:00`. Con `TZ=Europe/Madrid` el mediodía local es `T10:00:00.000Z` y el test fallaba (`0 !== 1`) |
| El pull conserva el par | Descartado. `expenseFromRow` no devolvía `extId`. Al rehacer el sync, el del mediodía se volvía a salar y el par se duplicaba (UTC y Madrid) |
| La lápida de día tapa también al hermano | Descartado. Ampliaron `expenseIsTombstoned` a cualquier origen: borrar el cargo canónico escondía al otro |
| Paginación, ventana, BOOK/PDNG y el filtro de Gastos | No estaban en su test. Revisados aquí y no cambiados, salvo el pendiente sin id frente al contabilizado con id de la misma cuenta, que sigue siendo un solo cargo |

Qué se reutiliza de ese commit, citado en el código: conservar el `uid` opaco de la cuenta (sin fabricarlo desde el IBAN) y las ranuras del histórico por referencia. La sal es `histDate(día, "ob-ext|banco|id")`. **Caducado en la revisión de `720e5aab` (apartado de arriba):** ya no la ocupa el id menor, y una fila de histórico con referencia no se queda en `ob-hist` sin `#x.` — se escribe `ob:banco#x.` porque el servidor desplegado no parte `#` en `ob-hist:`. `#dup` sigue ganando a `#x.`.

Límites, a propósito:

- El widget sigue juntando el par. Medido con el guardián: dos cargos de 12,50 € y un café de 3 € dan 28 en la app y 15,50 en el widget. `claveComoLaApp` mira el día y no se despliega en este incidente. No es el total arreglado del par.
- No se toca el índice `expenses_dedup_idx` ni FIN-03. Una lápida de día antigua, sin filas vivas de esa terna, sigue bloqueando el alta: borrar el único cargo no lo resucita. Si esa lápida convive con el hermano y no hay `obid`, no se sabe qué referencia era la del mediodía y esa referencia puede volver salada; el borrado nuevo escribe `obid` y no vuelve.
- Borrar uno de los dos escribe también `obid|banco|extId`. Renombrar no lo hace: la fila sigue viva.
- Si el saldo del banco falla, el sync diario sigue sin pedir movimientos. Es otro fallo, no este.
- La ventana de 8 días del cliente y la del Edge se revisaron y no se acortó ninguna.
- Un pendiente que ya tiene su propia referencia y un contabilizado con otra, mismo día e importe, siguen siendo dos filas. El pendiente sin referencia y el contabilizado con referencia, misma cuenta, son uno.
- No hay sincronización automática, ni reparación del histórico, ni subida de versión. La versión de la ronda se acuerda al integrar.

## Estado y límite (29/9/2026)

**Abierto en esa fecha.** Los cargos ausentes de otro perfil después de sincronizar a demanda no se habían atribuido entonces a una causa concreta. El párrafo de arriba sustituye esa conclusión; la traza de debajo se conserva. No se han leído ni modificado extractos, cuentas, enlaces o filas familiares; tampoco se ha llamado a Enable Banking, desplegado Edge, aplicado SQL o importado histórico. La comprobación del 24/9 de cargos Caixa de otro caso no cierra este incidente.

La beta efectiva al iniciar esta investigación era `b0be08c07cb2e1adab711184f056b1903dcb2ad0`; `main` era `e6e3edff8220de822c45b7851f25d3e26873a539`. GitHub mostraba PR #64/#65 integradas y Actions beta 36612627888/36614618899 en SUCCESS. El manifiesto público de beta servía `4.26.68.1`, huella `829684d38c95aa44`; el ZIP descargado dio SHA-256 `89daf97957c81fbf34f07ebaa05e323eab6187276e1dd9ec0f47f4545a6bf495` y contenía HTML `4.26.68.1` y SW `4.26.68.1-2026-09-29-17aeacc`. Beta anunciaba APK `4.26.55`/code 51, asset HTTP 200. Pages seguía en web `4.26.66`, ZIP `439161b6a2793810bddf4c2f863d0db4d3df5a24aad8d5caed4b46535dcd0f29` con HTML/SW de esa versión, y APK `4.26.32`/code 48, asset HTTP 200. `npm run listo` no pudo leer veredictos por falta de `SUPABASE_SERVICE_ROLE_KEY` local: ninguna aprobación nueva se infiere de CI o de estas comprobaciones.

## Traza del camino y contraejemplos sintéticos (29/9, base de entonces)

Los contadores de los puntos 2 y 3 son los de esa base, antes del arreglo de arriba.

1. **Proveedor → Edge.** `bank-sync` recorre los enlaces activos y las cuentas de cada enlace; `fetchBankTransactions` pagina hasta 12 páginas/2000 filas, incluso tras página vacía con cursor. Un fallo posterior señala lectura parcial. En el sync diario, la lectura del saldo precede a movimientos dentro del mismo `try`: si falla `/balances`, no se pide `/transactions`. El histórico usa el camino de solo lectura y avisa de cuenta fallida, vacío y truncado. El último workflow Supabase público es 36319915174 del 27/9 (ingest); el último despliegue documentado de `bank-sync` es 36271682736 del 26/9 sobre `7839acb7`. Un workflow exitoso no prueba por sí solo el código activo de esa función: falta consulta de solo lectura al servidor para comparar la fuente desplegada y sus imports.
2. **Edge → cliente diario.** `flattenBankTx` conserva las filas de `accounts[].transactions`, pero descarta el `uid` de la cuenta. `importObExpenses` deduplica por banco+referencia o banco+día+importe+comercio. Fixture de dos cuentas Caixa, dos referencias externas distintas y mismo día/importe/comercio: **2 filas recibidas, 2 aplanadas, 1 añadida** (`cargo-A`); la otra no se conserva. No demuestra que los cargos reportados tengan esa forma.
3. **Previsualización histórica.** `histFlattenHistoryLinks` distingue cuentas entre sí, pero dentro de una misma cuenta agrupa por banco+día+importe+comercio antes de respetar referencias diferentes. Fixture de una cuenta Caixa con `cargo-A` y `cargo-B`, ambos contabilizados y con esos tres atributos iguales: **2 recibidos, 1 candidato, `skippedUniq=1`**. El contador no identifica por sí solo si eran reenvíos o cargos distintos.
4. **Alta, nube y pull.** Incluso si se relajara solo el filtro cliente, `expenses_dedup_idx` y los `upsert` de `addExpense`/`addExpensesBatch` chocan por usuario+fecha+importe+comercio; `keyOfExpense` y `mergeExpensesFromCloud` también agrupan filas no manuales por día+importe+comercio. Un parche aislado en la UI no garantizaría dos cargos distintos persistidos. FIN-03 exige identidad de origen por cuenta, ACK y contrato de migración ensayado; no se inventa `uid` a partir de IBAN/nombre ni se cambia el índice compartido dentro de este incidente.
5. **Vista privada.** El filtro de Gastos, banco y periodo, las lápidas y `budgetSkip` pueden explicar una fila que sí existe pero no aparece en la vista consultada. Hay que comparar la misma referencia en proveedor, respuesta Edge, lista local, tabla del titular y filtros de su móvil. La ausencia en una etapa no autoriza borrar, reimportar o afirmar pérdida de la etapa anterior.

## Pruebas y próximo dato decisivo

`tr-open-banking`, `hist-uniq-por-banco`, `expense-bank`, `hist-import-dup` y `merge-expenses-cloud` pasaron en esta fuente. Los dos contraejemplos anteriores se ejecutaron contra `loadPureLogicFromFile` con importes, nombres, fechas y referencias inventados; no se guardó ningún fixture con datos personales. `bank-sync-paging` no arrancó localmente porque este worktree carece de `esbuild`; su Action beta anterior pasó, pero eso no verifica el caso real actual.

Para cerrar INC-2709-06 hace falta, con autorización y acceso de solo lectura al perfil afectado, cotejar unos cargos de referencia sin publicar sus datos: versión/canal del móvil, banco/cuenta, periodo y filtro de Gastos; estado y cuentas del enlace; recuentos/errores por cuenta y páginas en Edge activo; presencia de cada cargo en `expenses` del titular y en el pull; identidad frente a otras filas y lápidas. Una sincronización manual la realiza el titular, sin reintentos automáticos. Si la respuesta Edge no contiene el cargo, distinguir proveedor vacío, límite, cuenta no incluida y fallo parcial antes de proponer un cambio. Si lo contiene, localizar la primera etapa que lo descarta. Cualquier despliegue de `bank-sync`, cambio SQL o reparación familiar requiere alcance y revisión propios. La aceptación final sigue siendo todos los cargos de referencia visibles una sola vez en la vista correcta y la fuente Edge activa cotejada.

El trabajo independiente siguiente puede abordar INC-2709-01 (arranque con red débil y dos barras grises), previa nueva comprobación de aprobaciones y prioridad.
