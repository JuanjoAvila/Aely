# INC-3009-01 · gas en Próximos cargos · 30/9/2026

## Estado y alcance

Candidata separable desde main `12884f48107b82ffc8592c51180f2074a8546139`, versión fuente 4.26.68. Todavía sin publicación beta al escribir esta sección. Producción HTTP 4.26.67 y beta 4.26.70.2 revalidadas; APK48 estable/APK51 beta. `npm run listo` sobre fuente beta no puede leer veredictos porque falta `SUPABASE_SERVICE_ROLE_KEY`; no consta otra aprobación nueva. No se repite Deudas/PR71.

El dueño declara pagado el gas del 25/9 que seguía visible el 30/9. Su captura demuestra la tarjeta vencida, no cómo entró el pago. Se reproduce con **42 € ficticios**, cuenta ficticia y un cargo `BOOK` del 25/9: el Dashboard original seguía enseñándolo con `wait`, porque no consultaba evidencia bancaria. El E2E rojo encontró la tarjeta; después debe desaparecer. No se consultaron ni editaron datos bancarios reales.

## Contrato

- Inicio y la clasificación de fijos de Plan usan `fixedPaymentState`: un único cargo `BOOK`, positivo, del banco/mes, fecha válida hasta hoy, nombre e importe compatibles. Rechaza estados ausentes/PDNG, futuros, otro banco/mes, abonos, importes distintos, posibles duplicados, varios pagos o recibos compatibles y dos cuentas de recibos de la misma entidad. El bruto compartido y el importe de cada ocurrencia del calendario se respetan.
- `paidYm` **con `paidDay` válido** conserva una confirmación persistida sin banco local. Solo el mes o una fecha futura no acreditan pago. La ausencia de feed no borra esa confirmación. No se crea persistencia automática al renderizar.
- Pago acreditado: fuera de Inicio, en Ya pagado de Plan. Sin acreditar: próximo si hoy/futuro, vencido si su fecha pasó, con «Sin pago acreditado». Sin día: —. No se inventa pago por calendario. Editar el recibo usa esa misma lectura antes de guardar confirmación.
- No cambia `isPaidIn`, `monthNetForAccount`, bases de cuenta, gastos ni proyecciones monetarias del calendario. La sección de Plan clasifica evidencia de fijos; deudas, puntuales e ingresos conservan su contrato anterior, fuera de este objetivo. La conciliación advisory histórica sigue existiendo y no constituye por sí sola la evidencia estricta de estas tarjetas.

## Pruebas y límites

`tests/fixed-payment-state.test.mjs` registrado en `steps`: casos adversarios, mensual/schedule, persistencia, edición con PDNG y cero mutación. `e2e/inicio-cargos.spec.mjs` mapeado a Inicio/Plan: pago, vencido sin evidencia, PDNG y recarga en es/en/ca. Se actualizan fixtures de Plan que presentaban pago solo por pasar el día; preservan sus objetivos con confirmación explícita. No hay backend, SQL, migración, APK ni modificación del puente legacy.

El caso real puede carecer de feed BOOK, de nombre/importe compatible o de identidad suficiente. En ese caso el aviso es «Sin pago acreditado», no una acusación de impago ni prueba de ausencia del cargo. Hace falta comprobar el recorrido con el dueño en móvil antes de promocionar. No hay GO de Claude atribuido a esta candidata.

## Integración beta

La tanda separable es `1e2395b9`, [PR76 borrador](https://github.com/JuanjoAvila/Aely/pull/76), sin fusionar a producción. La integración sobre beta `76ab123b` aplica solo su delta de código/tests, sin mezclar la historia divergente de main/beta. Versión fuente beta 4.26.71; las siete tandas anteriores y APK51 permanecen. Comparación JSON: todas las notas previas son idénticas, solo se antepone la del gas. 102 E2E de Inicio/Plan/Gestionar/panel pasaron en esta integración, más el caso nuevo que exige ocho tandas; sintaxis, motor y presupuesto también pasaron. La suite local completa presenta el fallo preexistente de memoria-espejo y Deno no está instalado; CI debe acreditar los restantes. Pendiente de publicación al escribir este corte.
