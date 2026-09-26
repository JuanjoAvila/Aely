# Elegir el banco del widget — 4.26.50

Petición del dueño el 26/9: el widget «Puedes gastar en» muestra CaixaBank y quiere poder elegir otro banco. Tarea independiente del arbitraje FIN-05.

- Base beta: 610b4c8f; rama aislada codex/widget-banco-26sep en el worktree existente, sin cambios ajenos.
- Ajustes → Banco del widget: selección persistente por entidad (settings.widgetBank), o cuenta diaria automática. Una opción por banco; las cuentas de un banco del estado principal se suman como en el cálculo actual. No es una elección por número de tarjeta ni por cuenta secundaria Open Banking.
- El push usa cash/cashEnt/cashLabel y liquidez mínima del banco elegido. Presupuesto global, roles, expenseBanks, gastos y saldos guardados no se modifican. Banco eliminado → cuenta diaria. Identidad bancaria en las dependencias incluso con saldos iguales.
- No cambia Java ni Edge ni publica otra APK: usa el contrato existente; FIN-05 requiere APK 4.26.49/code 50 y mantiene pendiente su prueba móvil.
- Suite global sobre e8131ecd: 432 aprobadas, 1 omitida y 1 fallo del gesto de Inversiones (cartera-inversiones:549, campo de texto). Ese caso pasó después dos veces aislado, sin modificarlo. Los 3 casos widget-banco de esa suite pasaron. Tras la revisión, 5 E2E dirigidos sobre la corrección final pasaron: saldo igual, persistencia, volver a automática, suma de cuentas, liquidez con recibo pendiente, bancos ausentes y no bancarios.
- Guardianes locales: build, sintaxis, i18n, docs, presupuesto y árbitro Java pasaron. npm test encontró solo memoria-espejo externo tras corregir la numeración de los pasos nuevos. No se espeja memoria ajena para forzar verde. Deno no instalado. El fallo del gesto y sus dos repeticiones verdes se registran arriba; CI debe validar la candidata final.
- Bundle: 1.226.948 bytes minificados, +1.415 sobre FIN-05; límite crudo +2 KB, gzip 325/332 KB sin ampliar descarga.
- Claude revisó e8131ecd: pidió excluir Efectivo. Se excluyen Efectivo y Familia tanto al resolver como al listar; los tests comprueban que tampoco se reactivan desde ajustes antiguos. Texto catalán unificado a giny. Guardianes afectados (sintaxis, i18n, docs, presupuesto, mapa y coherencia/árbitro widget) volvieron a pasar.
- Segunda revisión Claude (mensaje 20260926T1115Z-claude-widget-banco-0802e270): exigió preservar el fallback automático original (Efectivo puede ser diario) y otorgó PASS condicionado a 5+1 E2E y árbitro Java verdes. Se preserva spendFrom sin filtrar, solo se filtra la elección explícita. Las seis pruebas widget-banco finales pasaron (26,7 s), widget-arbitraje y widget-coherente pasaron; condición satisfecha.
- Pendiente: beta/CI y prueba móvil. main no autorizado.
