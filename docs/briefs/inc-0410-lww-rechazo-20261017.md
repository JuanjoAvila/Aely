# INC-0410 · tres bandas de Metas con rechazo por acople financiero

Estado: fuente local preparada sobre `a9916c3cdb21c93f9d3a47653c0608e630ce50ab`, pendiente de admisión de publicación, revisión e integración. Sin PR, result ni entrega beta. No se modifica 09 ni la UI. GO de alcance `5267ceb4005ecb98b37da2f8e4efbb280fb85c33`; rechazo acotado autorizado en `cd02498b79710a92acc1039d52dbd0132f462e55`.

La guarda `updated_at` de `pushState` detectaba una escritura concurrente, pero la recuperación elegía el estado entero por `_savedAt`. El siguiente envío podía confirmar una copia que había perdido otra aportación, una edición en otra meta o un borrado.

`_goalSync` conserva una base por titular y el payload realmente confirmado, sin absorber ediciones posteriores al envío. Cuando reglas y asientos coinciden con esa base, la fusión por meta y campo conserva cambios disjuntos. Una ausencia respecto a la base borra salvo que el otro cliente editara esa meta. Ante dos cambios diferentes en el mismo campo gana la nube y la versión local se conserva como conflicto privado; nunca se suman saldos absolutos. Sin una base conocida no se inventa una fusión.

El primer intento de fusionar solo metas dejó un rojo financiero: las dos proyecciones aumentaban pero solo sobrevivía un asiento de `reservaLog`. Por el segundo GO, cualquier divergencia de `settings.reservaRules` o `reservaLog` respecto de la base en cualquiera de las ramas impide fusionar metas. Se conserva la instantánea completa de nube y el estado local completo queda en un registro privado de conflicto, sin incluir recursivamente los registros anteriores. Las uniones existentes de gastos, lápidas e históricos conservan su contrato. No se fusionan reglas ni asientos.

La base y los conflictos se guardan con el estado local; se excluyen de `slimForCloud` y de `backupState`. La telemetría solo emite el código cerrado `goals_sync_conflict`, sin meta, campo, importe ni copia local. No hay UI para resolver esos registros en esta fase. El contrato de operaciones idempotentes en céntimos queda como decisión futura del dueño, sin implementación servidor.

El efecto de subida depende de la última foto con cambios publicables: un ACK que solo actualiza metadata privada no cancela el debounce de una edición posterior al envío. El test de ese intercalado falla antes de retener esa foto y conserva la edición pendiente después.

El guardián focal `tests/goals-three-way.test.mjs`, registrado en `run-tests`, ejecuta los métodos y callbacks reales extraídos de fuente con un backend sintético. El caso rA/rB exige nube coherente y copia local entera; quitar la protección debe volver a romperlo. Los rojos originales, el primer rojo de acople y los mutantes anteriores se conservan aparte. No acredita PostgreSQL/RLS, móvil, CI, presupuesto de bundle, publicación ni aceptación. Caps, VERSION y catálogo intactos.
