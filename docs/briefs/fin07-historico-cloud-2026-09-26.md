# FIN-07 · histórico cloud completo

Objetivo único: recuperar todas las filas accesibles de `expenses` sin pérdidas por paginación,
conservar lo local y publicar únicamente en beta tras review Claude y pruebas. Base remota
beta `d237478ef9545e2018b025d42ac8a534503b4356`, producción main
`e9ba4558803e45bb30682368bba3d04428e76d38`. Rama `codex/fin07-historico-cloud`, worktree
administrado exclusivo `fin07-historico-cloud`. Checkout raíz y worktree FIN-06 se conservan.
No hay despliegue backend, migración, modificación retrospectiva de datos ni APK nueva.

## Reproducción y contrato

La foto del backlog de 2000 ya no era vigente: beta tenía keyset fecha DESC/id DESC,
fin por página corta y máximo de 50 páginas de 1000. Prueba roja antes del cambio:
317 de 2501 con límite servidor 317; 50000 de 50001; 2500 de 2501 tras editar una fecha
durante la descarga. El error intermedio ya rechazaba el pull y la mezcla ya no borraba
por ausencia. Se conservan esas dos propiedades.

Ahora consulta por `id DESC` y `id < cursor` hasta una respuesta vacía. UUID es clave primaria,
con representación canónica que devuelve Postgres y orden total estable; el progreso estricto
en cada fila rechaza repeticiones, desorden y cursores ausentes. Se normaliza solo el cursor
a minúsculas, no se modifica el ID ni otro campo de las filas. No se impone techo de páginas,
no se pide count previo ni offset. Payload ausente/no array y error intermedio rechazan el
resultado completo. Al terminar se ordena por fecha DESC/id DESC para mantener la prioridad
de gemelos de la mezcla y el orden de coveredEvents de FIN-05.

Cada petición ve su propio estado servidor. No se promete snapshot entre páginas. Una fila
previa con UUID y visibilidad estables se recorre una vez aunque edite fecha; una alta dentro
del tramo pendiente puede entrar y una alta en tramo ya recorrido espera al siguiente pull.
Una actualización posterior a leer una fila también espera a otro pull. Borrado/RLS concurrente
puede retirar una fila antes de verla: no se puede recuperar sin soporte servidor. Una ausencia
no prueba borrado ni cambia lápidas o identidad. No se amplía FIN-03: claves financieras,
possibleDup, resolución explícita de duplicados, UUID locales distintos a nube y backfill
siguen su contrato previo. No se convierte similitud en duplicado cierto.

## Mezcla, snapshots y rendimiento

Una sola resolución y mezcla final; cero persistencia por página. Un error no llama set/backfill,
no cambia coveredEvents y mantiene `wR=false` para que FIN-05 no confirme una foto incompleta.
La guarda `ps !== wS.current` sigue descartando una lectura vieja cuando ya arrancó otra.
Lo local adicional sobrevive; notas editadas y possibleDupOf siguen sus reglas actuales.
Si nada cambia, App conserva la referencia de expenses y no reescribe su clave separada.

Coste: una petición vacía adicional por pull y acumulación de filas en memoria. Orden final
O(n log n); consulta usa PK id y RLS del dueño. No hay nuevo índice user_id/id; medir coste
real de servidor requiere acceso y objetivo backend autorizado. No se afirma mejora de velocidad
ni latencia real a partir de fixtures. Más de 50000 está probado sin el antiguo techo; memoria
y timeouts de red/dispositivo siguen siendo límites físicos, no se ocultan como éxito parcial.

## Auditoría bancaria acotada

`flattenBankTx` ya concatena todas las cuentas del enlace, usa top-level solo como fallback
antiguo y no recorta globalmente. `runBankSync` guarda ese feed en `state.bankTx`; no es el
histórico completo de expenses. Edge diario pide mes actual más ocho días y el helper
Enable Banking acota por cuenta a 2000 filas, 12 páginas y tiempo. `truncated`/errores permanecen
en el contrato bancario. El import histórico separado conserva procedencia por UID/IBAN en
`histFlattenHistoryLinks`; el diario aplanado conserva banco pero pierde UID. Ampliar esa
identidad o límites del proveedor es otro objetivo y no se cambia backend aquí. `slimForCloud`
excluye bankTx del snapshot app_state. La ausencia en ese feed tampoco autoriza borrados.

## Pruebas y revisión

- `pull-historico-entero` registrado en runner existente, ahora 12 casos ejecutados verdes:
  4501/50001 filas, campos/UUID/conteos, empates, respuesta 317, fechas editadas, altas en ambos
  lados del cursor, reintento, fallo intermedio, payload inválido/progreso, orden/gemelos,
  merge con nota editada/possibleDupOf/local adicional y sync de App (ACK y arbitraje, microsegundos/offsets).
- E2E nuevo `cloud-historico-completo` registrado en CROSSCUTTING: 2/2 verdes en Chromium
  con viewport Pixel 5, 2501 filas ficticias y límite 317. Abre Gastos → Todo, busca la fila
  antigua; guardado inicial local más una única escritura final; vuelta a primer plano sin
  reescritura y fallo/recuperación sin pérdida local. Ninguna cartera ni banco real usados.
- Regresión `sync-pull-refresco`: 3/3 verdes. Suite global y CI finales pendientes.
- Claude real aportó riesgos en `20260926T1620Z-claude-fin07-riesgos`: conservar orden previo,
  rechazo sin ACK, progreso estricto, coste/RLS y arbitraje. Review del SHA final pendiente.

Estado de esta nota: candidato 4.26.52 sin publicar. No confundir pruebas locales con publicación.
FIN-05 y selector del widget conservan checklists/veredictos pendientes de beta. FIN-06 ya está
aprobado en producción 4.26.51; conservar su código. APK beta 4.26.49/code 50, estable
4.26.32/code 48. `salud` compara VERSION y su frase de beta en producción no acredita contenido.

## Guion móvil tras publicación verificada

1. Instalar la OTA exacta anunciada al cierre y mantener canal beta. No hace falta APK nueva
   para FIN-07; FIN-05 mantiene su requisito APK beta 4.26.49/code 50 y pago real pendiente.
2. Gastos → Más → Todo: buscar un movimiento antiguo ya guardado en nube. Debe conservar
   importe, banco y nota; no hace falta importación, compra ni modificar nada.
3. Volver a abrir y repetir: misma fila una vez y posibles repetidos con su aviso previo.
4. Sin conexión, histórico local visible; recuperar conexión y volver a la app para reintentar.

El móvil prueba OTA/presentación/offline. Los casos >2000, concurrencia y error de página se
acreditan con datos sintéticos, sin pedir sembrar miles de movimientos ni borrar datos reales.
Producción espera aprobación posterior del dueño. No abrir el siguiente objetivo.
