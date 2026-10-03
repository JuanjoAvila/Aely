# TR: clasificar información disponible sin cambiar identidad

Objetivo pedido el 26/9/2026: los cargos de Trade Republic llegan como «Movimiento» y no se clasifican. No hay ejemplos actuales; toda la verificación usa datos ficticios. Web 4.26.53 publicada como beta 4.26.53.1; solo bank-sync desplegado con autorización explícita posterior, sin migraciones.

## Resultado concreto

`mapTransaction` conserva merchant, ext_id, signo, fecha y note anteriores; transmite concept desde remittance_information normalizada y MCC opcional de cuatro dígitos. Nunca convierte la descripción técnica del código bancario en comercio. El cliente transmite ambos campos en diario/histórico y clasifica solo entradas nuevas: categoría manual/reconocida por nombre; concepto de tarjeta con título genérico, excluyendo transferencia/Bizum/recibo/alquiler/nómina/devolución/refund; MCC exactos 5411/5462/5812/5813/5814. Otros manual también gana. Retiradas, ingresos, aportes, deudas y modelados conservan sus rutas.

Se mantiene el título «Movimiento» si así vino del banco: en TR sin ext_id ese nombre forma parte de claves y lápidas. El concepto útil continúa visible en note. No se renombra ni recategoriza el histórico, no se cambia dedup/ACK, no se sincroniza al abrir y no hay migración ni columnas nuevas de expenses. Sin campos útiles o MCC conocido, Otros. No se garantiza que la conexión real TR entregue esos campos.

## Evidencia ejecutada

- Código revisado y probado: **17fb752293b580e8deae74637d37c2022c0d704f**, base beta **8bf229d429f4316289719ec4b583726a688ab5eb**, rama `codex/tr-descripcion-clasificacion`. El commit que añade este brief solo documenta el resultado.
- Review real de Claude: PASS exacto 17fb7522, condicionado a suite completa verde. Ejecutó independientemente los 11 casos del mapper/pipeline y presupuesto, i18n y mapa. Sus dos hallazgos aplicados: alquiler no activa DIA y Card transaction no activa la tienda Action.
- `npm test` completo sobre 17fb7522: **EXIT 0**, 348 s. Unitarios/guardianes completos verdes; navegador **451 passed, 1 skipped, 0 unexpected, 0 flaky**, incluyendo 7 pruebas de rendimiento separadas con un worker. El E2E de este objetivo sincroniza el fixture del mapper real, abre Gastos y comprueba categorías/nota, alquiler en Otros e histórico renombrado sin duplicar. Deno no instalado: su etapa fue omitida por el runner; el mapper TypeScript sí se transforma y ejecuta en los 11 casos Node.
- Docs, privacidad, mapa, sintaxis y presupuesto pasan. El límite crudo aumenta solo 1 KB para estos campos/clasificador y el sellado; gzip permanece en 332 KB, medido 326 KB. Espejo documental requerido regenerado con el script existente: dos documentos sanitizados, sin modificar memoria local ni checkout principal.
- Tras la suite local, aún no había publicación ni despliegue. La activación autorizada después se documenta abajo. No se ha leído cartera real ni realizado sync bancario.

## Activación autorizada y verificada

El usuario autorizó «dale» después de recibir el alcance: solo bank-sync, sin migraciones, y cliente a beta. No autorizó promoción web a producción ni consulta de datos financieros reales.

- Backend: [Action 36271682736](https://github.com/JuanjoAvila/Aely/actions/runs/36271682736), success, SHA **7839acb769fb9175434a1b652be3917faab02261**, finalizada 2026-09-26 21:04:54 UTC. Input funcion=bank-sync/migraciones=no; log confirma **Desplegando SOLO bank-sync**, despliegue efectivo y migraciones skipped. No ingest ni otras funciones.
- [PR #46](https://github.com/JuanjoAvila/Aely/pull/46) fusionada solo en beta; merge **f2f3839e40564288fdef8dfc550e3a2c6ec80fe4**. Diff del código contra el SHA probado 17fb7522 idéntico; sintaxis posterior al merge correcta.
- Publicación: [Action 36271729679](https://github.com/JuanjoAvila/Aely/actions/runs/36271729679), success, SHA f2f3839e. Suite completa CI de 613,5 s, incluidos tests Deno/enablebanking y los 11 casos Node. E2E: **443 passed, 1 flaky, 1 skipped** más **7 passed** de rendimiento; el único reintento fue el gesto de Inversiones (`cartera-inversiones.spec.mjs:549`), pasó después. El E2E TR pasó a la primera. No fallos definitivos.
- HTTP público: version.json, bundle.zip y apk.json responden 200. **4.26.53.1**, channel=beta, huella **6f4c69686c593eaa**, recalculada independientemente sobre el ZIP con sellos normalizados y coincidente con src del manifiesto. SW **4.26.53.1-2026-09-26-f2f3839**; APP_VERSION exacta. SHA-256 del ZIP **8b34bde5362b3ab93c59a0c7ee04d93a3a8e02592c648a8e9b49fffec5e7e60b**. Contrato concept/MCC presente, notas 4.26.53 y los seis scripts inline compilan con vm.Script.
- Producción web consultada después: **4.26.52**, main **91c5a4f43eaa84ac1a11a00f76c0dfccae998b0e**, sin cambios. APK beta **4.26.49/code 50**, estable **4.26.32/code 48**: este cambio llega por OTA web, sin APK nuevo. No se ha promocionado a main.

## Prueba móvil pendiente y rollback

Actualizar a beta 4.26.53.1. Cuando exista un cargo nuevo, sincronizar TR a demanda y mirar categoría y nota. Repetir debe conservar el histórico renombrado una sola vez. No hace falta realizar una compra para probar. Si el banco no aporta concepto útil ni MCC reconocido, queda Otros; esta corrección no reconstruye un comercio ausente. El histórico ya importado no se recategoriza. No se ha comprobado un payload real de TR ni ejecutado una sincronización bancaria del usuario.

Rollback backend: desplegar solo bank-sync desde **f53e865277f676998d76844fd047357f4adc1569**, sin migraciones ([Action previa 35978144828](https://github.com/JuanjoAvila/Aely/actions/runs/35978144828)). Rollback cliente: volver al cliente beta anterior; no requiere modificar gastos históricos.

Antes de una futura promoción, revisar `supabase.yml`: un push a main que toque supabase/** dispara despliegue general y puede aplicar migraciones si existe contraseña. Esta activación no autoriza ese despliegue general; resolver su alcance antes de promocionar. FIN-05/selector siguen pendientes y no forman parte de este objetivo.
