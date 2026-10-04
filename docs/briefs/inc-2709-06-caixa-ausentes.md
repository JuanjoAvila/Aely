# INC-2709-06 · cargos CaixaBank ausentes

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

Qué se reutiliza de ese commit, citado en el código: conservar el `uid` opaco de la cuenta (sin fabricarlo desde el IBAN) y las ranuras del histórico por referencia. La sal del segundo cargo es `histDate(día, "ob-ext|banco|id")`, la misma en el sync diario y en el histórico, y la ocupa el id menor que aún no esté guardado. El id viaja en el `source` diario como `#x.` porque el servidor ya parte `ob:` por `#`. `ob-hist` no lleva ese sufijo: allí el banco se leería mal. `#dup` gana a `#x.`.

Límites, a propósito:

- El widget sigue juntando el par. `claveComoLaApp` mira el día y no se despliega Edge en este incidente.
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
