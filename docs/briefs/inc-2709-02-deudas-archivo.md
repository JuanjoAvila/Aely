# INC-2709-02 · liquidación y archivo de deudas · 29/9/2026

## Contrato financiero

`debtBalance` resta la amortización mensual desde `asOf`: su cero es una **estimación**, no prueba de cobro del banco. Antes, una deuda a cero seguía ocupando una tarjeta sin siguiente acción; «Eliminar esta deuda» podía borrar el objeto al que apuntaban cuotas históricas mediante `debtId`. No se tocó la fórmula ni se generó un gasto para fingir la última cuota.

La tarjeta ahora pide confirmar que el saldo real está liquidado. La amortización total escrita por la persona cuenta como confirmación explícita y marca `settledAt` junto al cambio de saldo. El botón Archivar solo se ofrece tras la confirmación y con saldo cero; guarda `archivedAt` y conserva el objeto y su `id` en `state.debts`, para que Gastos pueda seguir mostrando el nombre y el filtro de cuotas. El archivo se abre en Plan → Deudas y permite volver a mostrar la tarjeta. Mostrarla no crea una deuda nueva; si se corrige el saldo a un valor positivo, el editor quita la marca de liquidación. Si una corrección externa deja saldo positivo con `archivedAt` antiguo, la tarjeta se muestra igualmente: no se oculta una obligación activa. Una deuda con gastos vinculados no se puede borrar físicamente desde el editor. Las operaciones de confirmar, archivar y mostrar son idempotentes en el updater de estado; un diálogo de amortización abierto sobre un saldo antiguo no aplica un segundo descuento.

## Pruebas y límites

`e2e/deudas-archivo.spec.mjs` abre el DOM real con deudas y cuotas ficticias. Comprueba cancelación, confirmación, archivo, cuota histórica en Gastos, recarga, vuelta a mostrar, amortización total sin gasto nuevo, bloqueo del borrado con cuota vinculada, saldo corregido en otro dispositivo y controles en inglés y catalán. **6/6** en Chromium local; con `listas-render` y `gastos-deudas`, **19/19** en la primera pasada conjunta antes del caso adicional de saldo externo. `test:syntax`, `i18n-keys`, `docs-frescura`, presupuesto de tamaño y registro de E2E pasaron. `npm test` local solo falla en `memoria-espejo` por diferencias preexistentes con la memoria externa; Deno no está instalado localmente. Las pruebas no acreditan el saldo real bancario, Android, nube ni aceptación móvil. No hay APK, Edge, SQL, migraciones ni pagos reales en esta entrega.

## Estado de entrega

La rama nace de `origin/beta` `50e77f83ce39077d3abb354d3cbd5598a2981955`, no de main. Al entrar, `npm run listo` no pudo leer aprobaciones porque falta `SUPABASE_SERVICE_ROLE_KEY`; PR y CI no se interpretaron como veredicto. Beta servía `4.26.69.1` y producción web `4.26.66`/APK 4.26.32 code 48. Las tandas INC-2709-01, INC-2809-02 y cinco nativas conservan su prueba propia.

Pendiente registrar SHA final, revisión, CI beta, manifiesto/ZIP/HTML/SW servido y petición de aceptación móvil. Esta tanda no tiene autorización de producción antes de ese veredicto.
