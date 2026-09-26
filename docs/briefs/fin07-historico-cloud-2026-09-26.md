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
- E2E nuevo `cloud-historico-completo` registrado en CROSSCUTTING: 5/5 verdes en Chromium
  con viewport Pixel 5, 2501 filas ficticias y límite 317. Abre Gastos → Todo, busca la fila
  antigua; guardado inicial local más una única escritura final; vuelta a primer plano sin
  reescritura y fallo/recuperación sin pérdida local. Respuesta inválida avisa en es/en/ca sin mezclar. Ninguna cartera ni banco real usados.
- Regresión `sync-pull-refresco`: 3/3 verdes. Global local: 440 funcionales + 7 rendimiento verdes y 1 omitido; CI final verde: 443 funcionales + 7 rendimiento aprobados y 1 omitido.
- Claude real aportó riesgos en `20260926T1620Z-claude-fin07-riesgos`: conservar orden previo,
  rechazo sin ACK, progreso estricto, coste/RLS y arbitraje. Review PASS del SHA final `94bca134670692a55725d915551194c17315771c`, mensaje `20260926T1710Z-claude-fin07-94bca134`.

Estado de esta nota: FIN-07 publicado solo en beta **4.26.52.1**, código final
`94bca134670692a55725d915551194c17315771c`. Review Claude PASS y CI completo verde;
beta aprobada por el usuario y producción exclusiva 4.26.52 verificada; ver cierre al final.
FIN-05 y selector del widget conservan checklists/veredictos pendientes de beta. FIN-06 ya está
aprobado en producción 4.26.51; conservar su código. APK beta 4.26.49/code 50, estable
4.26.32/code 48. `salud` compara VERSION y su frase de beta en producción no acredita contenido.

## Guion móvil tras publicación verificada

1. Instalar la OTA **4.26.52.1** y mantener canal beta. No hace falta APK nueva
   para FIN-07; FIN-05 mantiene su requisito APK beta 4.26.49/code 50 y pago real pendiente.
2. Gastos → Más → Todo: buscar un movimiento antiguo ya guardado en nube. Debe conservar
   importe, banco y nota; no hace falta importación, compra ni modificar nada.
3. Volver a abrir y repetir: misma fila una vez y posibles repetidos con su aviso previo.
4. Sin conexión, histórico local visible; recuperar conexión y volver a la app para reintentar.

El móvil prueba OTA/presentación/offline. Los casos >2000, concurrencia y error de página se
acreditan con datos sintéticos, sin pedir sembrar miles de movimientos ni borrar datos reales.
El usuario aprobó esta prueba y la producción exclusiva. El siguiente objetivo se abre solo en otra conversación.


## Verificación local y corte antes de publicar

Claude PASS eaf3a88e y revalidación PASS c3e54b9116914e41880907673183a27cb3cecddc por canal real (mensajes 20260926T1650Z-claude-fin07-eaf3a88e y 20260926T1700Z-claude-fin07-c3e54b91). Global local eaf3a88e: 440 funcionales + 7 rendimiento verdes, 1 omitido. Sobre c3e54b91: 20 pruebas de cloud/refresco/persistencia/widget y 7 rendimiento aisladas verdes; 12 unitarios, sintaxis y presupuesto verdes. npm test ejecutó todos los unitarios, solo falló memoria-espejo por dos memorias externas conocidas; Deno omitido por no estar instalado. No se modifican esas memorias.

Action 36255068235 sobre c3e54b91 detenido durante Tests antes de publicar: se descubrió que el nuevo error de respuesta inválida podía verse en inglés al arrancar. Se localiza en es/en/ca y se añaden tres E2E del aviso real; foco cloud/refresco 8/8 verde. Mantener VERSION 4.26.52: no se consumió una beta pública ni se alteraron assets 4.26.51.1. Claude PASS del ajuste final en `94bca134`; CI 36255600639 completado verde y publicación comprobada por HTTP.

## Publicación comprobada

- [Action 36255600639](https://github.com/JuanjoAvila/Aely/actions/runs/36255600639), SHA exacto `94bca134670692a55725d915551194c17315771c`: todos los pasos unitarios verdes (incluidos memoria-espejo, docs-frescura, sintaxis, i18n, presupuesto y mapa), cuatro ficheros Deno ejecutados y verdes; 443 E2E funcionales + 7 de rendimiento aislados, una prueba omitida.
- Release `Beta 4.26.52.1`; `version.json` HTTP anuncia channel beta y huella `8a6a9b83a255cc0e`. ZIP real descargado: 863167 bytes, SHA-256 `b5135c78f806d19e1d73fbdbc7fdb0b16f623e5a899ebf37dd1522b0ae83198f`, coincidente con digest del asset GitHub. Huella recalculada sobre el ZIP coincide con manifest.
- `APP_VERSION` real 4.26.52.1; Service Worker `4.26.52.1-2026-09-26-94bca13`. Paginador, aviso traducido, widgetBankOf y coveredEvents presentes; marcador antiguo de límite ausente. Notas/checklists del ZIP idénticas al JSON fuente y entradas previas conservadas.
- APK anunciada sigue 4.26.49/code 50, URL HTTP 200; digest de apk.json idéntico al anterior `12fa66d06f0b62ec3411cd27696b4f1b8b1dbeae68f239610c1fe55a73fce2d6`. No se necesita APK nueva para FIN-07.
- `npm run salud`: producción HTTP 4.26.51, bundle y APK HTTP 200; beta 4.26.52.1. Main remoto permanece `e9ba4558803e45bb30682368bba3d04428e76d38`; último Action Supabase permanece 36196554737/be59e27c. No hay promoción, cambios de datos reales ni nuevo despliegue backend.
- Límite de evidencia: navegador con fixtures sintéticos, no acceso a cuentas ni bancos reales; veredicto móvil aprobado por el usuario; no se afirma una prueba manual adicional en producción. Sin garantía de snapshot global ni ampliación de límites del proveedor bancario.

## Producción exclusiva verificada · 26/9/2026

El usuario aprobó FIN-07 y ordenó subirlo. Código exclusivo `126b8e8443a790d7ad07839920f4312020e3d701`, Claude PASS `20260926T1740Z-claude-fin07-prod-126b8e84`; docs de revisión `39d97c74`. Promote [36257644323](https://github.com/JuanjoAvila/Aely/actions/runs/36257644323) SUCCESS, tanda fin07-produccion. Merge real `8cd41f093f6f718f39aeb1a41755993d40889aef`: árbol idéntico a 39d97c74, sintaxis comprobada sobre el merge.

Pages [36258292782](https://github.com/JuanjoAvila/Aely/actions/runs/36258292782) SUCCESS: unitarios y privacidad verdes, 435 funcionales + 7 rendimiento, uno omitido. Promote ejecutó 443 + 7 sobre beta antes de fusionar solo la tanda. Deno omitido en ambos workflows por no estar instalado; el CI beta FIN-07 anterior sí ejecutó los cuatro ficheros Deno verdes. No afirmar Deno ejecutado en Pages.

HTTP 200: version.json y APP_VERSION 4.26.52, Service Worker `4.26.52-2026-09-26-8cd41f0`; ZIP 860819 bytes, SHA-256 `ad52c418f455f179f465b31670ccb481a8142d2f6b9769db4d4109483be4a75b`, huella reconstruida `c883cfeb5ac6e38d`. HTML/SW públicos idénticos a los del ZIP; notas del ZIP idénticas a fuente de la tanda exclusiva. Paginador y aviso localizado presentes, antiguo límite ausente; selector y árbitro FIN-05 ausentes de la app de producción. APK estable 4.26.32/code 48, URL HTTP 200.

Beta permanece 4.26.52.1 con FIN-05, selector y APK 4.26.49/code 50 pendientes; no borrar sus checklists ni interpretar la aprobación FIN-07 como aprobación de toda beta. Último Supabase permanece Action 36196554737/be59e27c: sin backend nuevo, migraciones ni reparación de movimientos reales. FIN-06 cliente conserva su aprobación.

FIN-07 cerrado y publicado. Siguiente conversación autorizada: FIN-08, investigación y propuesta revisable de daños históricos; cualquier reparación real requiere otra aprobación. Identidad FIN-03 y restauración OPS-02 siguen siendo dependencias. No se inicia esa investigación en el chat de publicación.
