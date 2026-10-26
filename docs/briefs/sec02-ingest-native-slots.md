# SEC02 F2: identidad nativa y ranuras de ingest

Candidato de fuente sobre 74ea9c63880b23a975f2a5852d82970f3cbffefd. Sin publicación ni despliegue acreditados.

## Contrato

Dos huellas nativas distintas, misma puerta/instante/importe/comercio, conservan dos filas y1990c. La misma huella recupera siempre el ACK de su propia fila y995c; no se confirma usando una fila de otro evento. El propietario sale exclusivamente del token validado.

Se conservan las migraciones0001/0025 y el índice global de cuatro columnas. También se conservan los dos onConflict de cloud.addExpense/addExpensesBatch. No hay SQL nuevo ni cambio de contrato PostgREST. El evento reserva su ranura existente; una gemela recibe desplazamiento en milisegundos y source ob:trade_republic#n2, como las gemelas OB. La reserva queda ligada a user_id+ingest_event_id, no a una nueva huella de dinero.

Los ordinales no bastan para todas las carreras: dos horas originales diferentes pueden reservar el mismo ordinal. Por eso los lectores conservan además ingestEventId/ingest_event_id en su clave. expenseFromRow, mezcla cliente, lectura mensual y widget mantienen ambas compras. El roundtrip conserva #dup y #n; las lápidas antiguas mantienen su alcance anterior y las nuevas distinguen eventos.

## Concurrencia e incertidumbre

El índice viejo arbitra las colisiones de fecha; tras un INSERT vacío se comprueba el evento propio y después la identidad nativa de la fila que ocupa la ranura. Solo entonces se prueba otra ranura, con un máximo de8 intentos. Un23505 sin ACK propio, consulta fallida, inserción vacía sin fila comprobable o choque con fila manual/legacy devuelve503 reintentable; no inventa otro pago ni entrega un ACK ajeno. Una fila nativa pendiente sigue fuera del total y puede reanudar su confirmación con el mismo evento. El APK existente reencola los5xx.

Los desplazamientos conservan tanto el día UTC usado en las claves históricas como el día Europe/Madrid. Si sumar milisegundos cruza alguno, se busca hacia atrás; si tampoco existe ranura segura, se devuelve503. Esto conserva mes/año contable, incluido DST. Importe y comercio no se alteran.

El emparejado TR/Wallet conserva su contrato. La retirada de un alias devuelve el ACK de la superviviente. Las notificaciones sin identidad conservan el camino legacy; no se les atribuye certeza nativa.

## Compatibilidad y entrega

Actualizar primero los lectores web y después ingest es la secuencia propuesta al integrador. Los clientes anteriores siguen pudiendo escribir con sus cuatro columnas: no hay índice parcial ni riesgo42P10 introducido. Reconocen #n como antes; aún conservan su dedup de lectura antiguo hasta recibir la actualización. Las lecturas que reciben error por ausencia de ingest_event_id conservan el fallback de columnas legacy. No se han probado clientes físicos ni PostgREST/PostgreSQL reales.

Hallazgo separado de fuente: TrExpenseListener descarta el mismo título+texto durante180s ANTES de calcular stableEventId; puede impedir que una notificación distinta llegue al endpoint. No se modifica Android/APK en este candidato y esto sigue abierto. Tampoco se cambia callback, paginación, interfaz de Gastos, shell, versiones, dependencias o catálogo.

## Evidencia dirigida

RED real Deno2.9.0 sobre handler base:995c en vez de1990c. RED independiente de lectura base: dos filas se reducían a995c. Un RED adicional encontró la carrera de ordinales con milisegundos originales distintos. Los fallos anteriores se conservan. GREEN dirigido:14 casos Deno del handler real con SDK/almacenamiento sintéticos y pruebas Node de lectores/roundtrip/UUID/reconcile. El arnés del handler usa strict:false por tipos ya existentes en la base y tipado del SDK doble; no es prueba de chequeo estricto del handler ni de PostgreSQL. La lectura pura también se ejecuta con el strict por defecto. Cada ejecución es serial,1worker,0retry y sin permisos de red. La regresión Node anterior se ajusta a fallar en la primera aserción; los casos de incertidumbre exigen503 en lugar de éxito skipped.

Registro de CI: native-identity.test.ts está en denoEnLista y en el descubrimiento automático; ambos runners reciben su config/import-map local y permisos únicamente para las cuatro variables que el test sobrescribe con valores sintéticos, sin allow-net. ingest-native-slots.test.mjs está en steps. CI, despliegue, entrega servida y aceptación móvil quedan pendientes.

## Referencias de diseño consultadas

- [Upsert de Supabase](https://supabase.com/docs/reference/javascript/upsert): onConflict determina las columnas del conflicto.
- [INSERT de PostgreSQL](https://www.postgresql.org/docs/current/sql-insert.html): inferencia de índices y filas realmente devueltas por RETURNING.
- [PostgREST On Conflict](https://docs.postgrest.org/en/stable/references/api/tables_views.html#on-conflict): contrato de columnas UNIQUE.

El changelog oficial de Supabase se revisó antes del diseño. La incompatibilidad del índice parcial fue una deducción del contrato documentado; nunca se presentó como prueba SQL ejecutada.
