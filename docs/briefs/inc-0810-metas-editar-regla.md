# INC-0810 · Editar una regla de Metas existente

Candidata separada **4.26.108**, asignada por el coordinador local26, sobre `8dcc5ed39b6e212ba1e34a90b550685794ce0bd5`; rama `codex/metas-editar-regla-local26`. Sin merge, publicación ni aceptación móvil. El coordinador integra historias, sella catálogo y verifica entrega. No incluye la candidata107 de navegación.

## Contrato

Plan → Metas → Reservar dinero → Editar regla abre nombre, tipo, importe y meta actuales. Cancelar conserva el estado. Guardar conserva ID, orden, contrato mensual/por ingreso y campos desconocidos; no borra/recrea ni libera la regla. No crea movimientos ni cambia gastos o saldos bancarios.

`editReservaRule` compara semánticamente la copia del formulario con la única regla del mismo ID en el estado fresco. Incluye campos desconocidos; el orden de claves JSONB no provoca conflicto. Valida meta activa, tipo fijo/porcentaje, importe positivo con céntimos representables y porcentaje ≤100. Una regla borrada/cambiada no se pisa: conserva el borrador y pide cancelar/reabrir. Entre dispositivos continúa el last-write-wins existente, sin reconciliación nueva.

Una mensual ya asentada no vuelve a aportar/descontar ni mueve lo anterior a otra meta: cambia el mes siguiente natural de Madrid. La línea del asiento muestra su destino original si difiere del configurado. Una mensual pendiente solo asienta la regla editada cuando corresponde; repetir no duplica, ni aplica otras reglas pendientes. Un asiento liberado también ocupa su identidad. Una regla por ingreso conserva el reparto anterior y usa los cambios en el siguiente ingreso repartido. Sin cambio ni aplicación pendiente, devuelve el mismo estado.

El cierre exige ver la configuración enviada. Si React pinta un commit provisional y luego rebasa sobre una escritura anterior, la referencia de operación recoge el rechazo y recupera el borrador. Replay tras la propia aportación que completa la meta no duplica ni reabre; una edición posterior legítima tampoco reabre el formulario viejo. Céntimos al reabrir usan el separador decimal del idioma.

## Verificación local

- DOM de cinco specs, un worker, datos sintéticos: **107 PASS / 1 FAIL**, 8,8 min. Edición30/30, alta42/42, borrado12/12, persistencia9/9. Mensual14/15: en inglés un toast de logro sustituyó el esperado aviso del pull fallido. **Repetición exclusiva de ese caso: 1 PASS**, 4,6 s, sin cambiar fixture ni runtime. No equivale a108 limpios. Reportes ignorados `test-results/metas-edit-dom108-final.json` y `metas-edit-monthly-retry.json`.
- El DOM verifica importes de ambas metas, destino del asiento anterior, presupuesto visible en Inicio/Gastos/recarga, cancelación, no-op, legacy, doble toque, estado fresco y siguiente mes de Madrid. Replay obligatorio instrumenta el dispatcher real de App y acredita que se ejecutó, incluyendo meta completada.
- Rojo causal sobre base reconstruida independientemente: falta Editar regla (0 frente a1). Mutante que retira solo la recuperación de rechazo provisional: falla `changed/es`, el formulario/aviso desaparece. Restauración exacta: PASS. `metas-edit-causal.json` conserva hashes/resultados; no son fallos de arranque.
- Guardianes afectados: idiomas, docs, mapa, seguridad, finance-core, reserva-dinero, metas-pull-transport, month-budget-stats, presupuesto-servidor y notas-sin-duplicados PASS. `beta-sources` final PASS: PERSIST21 con inclusión explícita del editor,1781 dependencias y699 datos mutados. No se rebajan mutantes. Build108, sintaxis de7 bloques, frescura108 y presupuesto final PASS.
- Suite Node completa anterior:131 fases,502,4 s, exit1. Fallos: auth-disposal/appstate-listener-cleanup por anclas literales en checkout CRLF; inputs de fuente/test/fixture idénticos a base al normalizar LF. supabase-workflow y docs-frescura-history tuvieron errores de proceso/Windows; memoria-espejo abortó su filtro de memoria externa. beta-sources y presupuesto fallaron entonces y se corrigieron/revalidaron después. **No se acredita la suite completa verde**. Deno ausente, no aprobado por omisión. CI exacta y revisión independientes pendientes.

HTML DOM: `2159b4b7afa422736608cfcad6791f160cc9d8f6d35e079e637bd6dc9be7b79a`. Build108: `7d36892323be49890f7011729ef237f56e3fc9a34dfd53e9776539d329b5ed23`. Sustituir únicamente `_rnSha` por el de las notas anteriores reproduce byte por byte el hash DOM: runtime intacto. Los archivos generados son snapshots de candidata, no entrega final. Chromium/servidor detenidos, puerto4426 sin listener; lease96 liberado expresamente.

## Alcance y tamaño

Los32 ámbitos ajenos permanecen idénticos. `inc-0310-01-meta-regla` conserva todas sus entradas y añade únicamente `reservaRuleSame` y `editReservaRule`. Nuevo ámbito75 entradas con cierre transitivo completo, textos propios es/en/ca y persistencia real. No se repinan referencias históricas ni auditorías.

Huellas web: mensual previa `d80ec637c9980a923e2a8660f2f5d019087682ab8c93100992d592248aa68d51` → `74a3f1fadd6c79f870bc3fbe27008065f6950e1dab0644be8dfa14475f8300aa`; editor `84c832707f16ecbe5099f9dc889bae4ae81bccc7269d1cb49685add3bb16e975`.

A/B minificado oficial, sin renombrar identificadores, gzip9, reserva sintética DSN95 y versión4.26.108.99999 iguales en ambas variantes. CanonicalLF: base8dcc **1.317.888 /359.021 B**; candidata **1.321.489 /360.040 B**, delta **+3.601 /+1.019 B**. Textos ES +373/+127; lógica/metadatos +3.228/+892. Sidecars lazy: en +379/+105, ca +411/+127 B. Windows conserva24 CR fuera de bloques: base1.317.912/359.038, candidata1.321.513/360.056; no se atribuyen saltos de línea a la función.

Asignación consciente del coordinador: crudo1287→1291 KiB y gzip351→352 KiB. Márgenes finales LF495/408 B, Windows471/392 B. Tres bloqueantes intactos, sin nuevas dependencias ni recortes de idiomas/guardas. La integración y el sellado real deben volver a medir el presupuesto. `metas-edit-size.json` y `metas-edit-scope.json` contienen medidas y huellas locales.

Sin APK nuevo, Edge, SQL ni datos familiares. Publicación, CI, revisión y aceptación móvil permanecen gates separados.
