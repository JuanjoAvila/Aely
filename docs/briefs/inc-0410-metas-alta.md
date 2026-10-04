# INC-0410 · Alta de reglas de Metas

Borrador web 4.26.94 sobre beta 4.26.93.2 (`4e65fa11`), entrega de Claude en `codex/inc-0410-metas-mensual` y cierre de Codex en `codex/0410-metas94-history-e2e`. Sin publicar y sin aceptación móvil. Responde al rechazo vigente de la 4.26.87 (tanda `inc-0310-01-meta-regla`) **sin cerrarlo**. Lo que sigue describe la primera parte (alta de reglas y guardado del estado), preparada como 4.26.91 sobre `be3081ab` y nunca publicada; el contrato mensual decidido después por el dueño tiene su [acta](inc-0410-metas-mensual.md).

## Qué se rechazó

Motivo comunicado, sin datos personales ni importes: al añadir otra regla hay un lag muy fuerte y la regla no queda aplicada como se espera; no aparece la base a descontar, que se compara con el presupuesto mensual.

## Qué se reprodujo, con datos sintéticos

- **Importe mal guardado.** El alta leía el campo con `parseFloat(texto.replace(',','.'))`. Escribir «1.200», «1.200,50» o «1,200.50» guardaba 1,2 y la fila decía «1 € fijos». Con esa regla, el reparto aparta un euro. Rojo en el DOM real en es/en/ca y con el botón real en Node. No se afirma que fuera el caso exacto de quien lo rechazó.
- **Alta inválida muda.** Con 0, vacío o letras no se creaba nada, el formulario seguía abierto y no aparecía ningún mensaje. Un porcentaje de 150 se aceptaba.
- **Sin estado.** Con el ingreso del periodo ya repartido, añadir otra regla no produce aviso ni cambia nada —es el contrato: un ingreso, un reparto— y la pantalla no lo explicaba en ningún idioma. Lo mismo sin ingreso reciente o con el ingreso descartado.
- **Comprobado que ya funcionaba:** con un ingreso posterior sin repartir, la regla nueva entra en el aviso y el reparto la aplica; y el alta sobrevive a una recarga con reglas, registro, metas y gastos intactos.

## Qué NO se reprodujo

El lag. Medido el mismo gesto (botón «Guardar regla») frente a «Cancelar», con CPU ×6 en viewport de Pixel 5, tres pasadas por celda: la fila aparece a 22–25 ms con 60 gastos, 32–34 ms con 3.000 y 58–60 ms con 12.000 (una tarea larga de ~60 ms y uno o dos frames de 33 ms). La escritura es una sola, de unos 2 KB, a ~0,8 s; el histórico de gastos no se reescribe. El instrumento se validó con un bloqueo conocido de 150 ms, que sí detecta; una primera versión no lo detectaba y sus cifras se descartaron.

Límites de esa medida: estado sintético pequeño salvo en gastos, nube simulada por el fixture, sin teclado del sistema, sin WebView real ni 120 Hz, y sin medir la apertura de la tarjeta o la entrada en Plan. No demuestra que el lag no exista en el móvil.

## Qué cambia

- `reservaImporteDe` valida la cadena completa y solo entonces la lee. Sigue el criterio de `amountOf` del plan de ahorro: el separador que no es el decimal del idioma agrupa miles únicamente con grupos de tres cifras. Rechaza signos, letras, exponentes, `1.2.3`, más de dos decimales y el caso ambiguo (un único separador igual al decimal del idioma seguido de tres cifras). `SavingsPlanCard` no se toca.
- El alta inválida muestra un aviso en el propio formulario. El porcentaje de una regla nueva debe ser mayor que 0 y como máximo 100; las reglas ya guardadas no se modifican.
- `reservaEstadoDe` es la única fuente del estado del reparto para el aviso y para el editor: sin reglas, sin ingreso, pendiente, repartido, descartado o sin nada que apartar. El editor lo muestra con la fecha del ingreso detectado cuando lo hay. Los textos hablan de «ingreso», no de nómina, y no prometen umbrales.
- Los importes del reparto con céntimos se muestran con céntimos, en la fila y en el aviso.
- La meta de la regla se comprueba al guardar y de nuevo al escribir el estado: si entretanto se cumplió o se borró, no se guarda y se pide elegir una activa; no se elige otra en su lugar, tampoco cuando era la última: el formulario y su aviso siguen en pantalla aunque no quede ninguna meta activa. El formulario no se cierra en el toque: se cierra cuando la regla aparece en el estado, y si no está y su meta ya no vale se reabre con lo escrito y el aviso. Esto vale también si la regla llegó a pintarse y luego se retiró (React puede hacerlo al aplicar una escritura anterior que tenía en cola), sin plazo: la última alta solo se olvida al enviar otra, cancelar, abrir el formulario de nuevo o borrar esa misma regla. Cancelar no deshace una regla ya creada. Límite: si otro dispositivo borrara más tarde esa regla y su meta, el borrador reaparecería con el aviso.
- Los céntimos se cuentan en entero exacto: un importe que no cabe sin redondeo se rechaza en vez de guardarse aproximado. No hay un tope de producto.
- El estado «sin nada que apartar» no afirma el motivo: una regla antigua a 0, una meta cumplida y una meta borrada dan lo mismo, y desde ahí no se distinguen.
- La tarjeta, su ayuda y el aviso dicen «ingreso» en lugar de «nómina» en los tres idiomas.

El lector de las reglas nuevas es estricto y es distinto, a propósito, del lector del plan de ahorro (`amountOf`), que limpia lo que sobra. Comparten cómo agrupan miles; una prueba fija esa coincidencia y las diferencias: «1,200», «abc10», «-10» y «1.2.3» son importes para el plan de ahorro y no lo son para una regla nueva.

No cambia qué ingreso se detecta, ni cuánto se reparte, ni el registro, ni la liberación al borrar una regla.

## Guardado del estado (hallazgo de la prueba)

La prueba de la carrera acababa bien en pantalla y mal en disco: la regla rechazada quedaba escrita en `micartera_v3`. No era del alta: `set()` apuntaba el volcado dentro del updater, y si React abandonaba un estado calculado el disco se quedaba con él. Ahora el volcado sale del estado comprometido. Es un cambio en el guardado de toda la app; conserva el debounce, el volcado al ocultar o cerrar, el guardado partido y el modo pruebas. Por eso cambia la identidad web de las 18 tandas cuyo código escribe estado, y no la de las 7 que no lo escriben (botón central, Pregúntame, el panel de revisión, clasificación de Trade Republic, arranque con poca conexión y cuotas del plan). Consecuencia para quien prueba: ayuda de Mi ciclo conservaba su visto bueno porque su código era idéntico al aprobado; ya no lo es, así que vuelve a aparecer como pendiente. Arranque con poca conexión no escribe estado y lo conserva. La aprobación anterior sigue en el historial, sin certificar esta revisión.

## Decisiones pendientes del dueño (no implementadas)

1. Aplicar una regla nueva a un ingreso ya repartido.
2. Volver a ofrecer un ingreso al que se dijo «Ahora no».
3. Calcular la regla sobre el presupuesto mensual en lugar de sobre el ingreso detectado: es un cambio de contrato financiero.

## Observación separada (no tocada)

El aviso de reparto usa `lastPaydayOf` sin el filtro de `budgetPaydayOf`: cualquier ingreso de 200 € o más de los últimos 45 días cuenta para el reparto, sea o no una nómina. Esta candidata ya no lo LLAMA nómina —los textos dicen «ingreso»—, pero el criterio sigue igual y sin decidir. Un Bizum sintético de 250 € posterior a la nómina abre el aviso sobre 250 €; y tras repartir la nómina, otro ingreso grande abriría un segundo reparto en el mismo periodo. Siempre con confirmación. Queda como posible incidencia aparte.

## Verificación

- `tests/reserva-dinero.test.mjs` (registrado): matriz del lector con esperados literales, botón real, altas inválidas, céntimos y estados. Falla sobre la fuente anterior.
- `e2e/metas-alta-regla.spec.mjs` (mapa de Metas y motor): es/en/ca, datos sintéticos. Incluye la última meta eliminada o cumplida con el formulario abierto, con y sin regla previa, y la regla que llega a pintarse y luego se retira. Para esto último se sujeta de forma artificial el canal por el que React programa el trabajo no urgente: hace determinista un orden que en un móvil depende de la carga, y no lo sustituye.
- Alcance: la tanda conserva su id y suma las funciones y textos nuevos; de los 24 alcances registrados solo cambia la identidad de ese.
- Resultados exactos de DOM, suite, revisión y CI se acreditan por SHA en el PR, no en este documento.
