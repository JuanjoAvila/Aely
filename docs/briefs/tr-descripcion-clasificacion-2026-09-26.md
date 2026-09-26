# TR: clasificar información disponible sin cambiar identidad

Objetivo pedido el 26/9/2026: los cargos de Trade Republic llegan como «Movimiento» y no se clasifican. No hay ejemplos actuales; toda la verificación usa datos ficticios. Candidato web 4.26.53, sin publicar ni desplegar.

## Resultado concreto

`mapTransaction` conserva merchant, ext_id, signo, fecha y note anteriores; transmite concept desde remittance_information normalizada y MCC opcional de cuatro dígitos. Nunca convierte la descripción técnica del código bancario en comercio. El cliente transmite ambos campos en diario/histórico y clasifica solo entradas nuevas: categoría manual/reconocida por nombre; concepto de tarjeta con título genérico, excluyendo transferencia/Bizum/recibo/alquiler/nómina/devolución/refund; MCC exactos 5411/5462/5812/5813/5814. Otros manual también gana. Retiradas, ingresos, aportes, deudas y modelados conservan sus rutas.

Se mantiene el título «Movimiento» si así vino del banco: en TR sin ext_id ese nombre forma parte de claves y lápidas. El concepto útil continúa visible en note. No se renombra ni recategoriza el histórico, no se cambia dedup/ACK, no se sincroniza al abrir y no hay migración ni columnas nuevas de expenses. Sin campos útiles o MCC conocido, Otros. No se garantiza que la conexión real TR entregue esos campos.

## Evidencia ejecutada

- Código revisado y probado: **17fb752293b580e8deae74637d37c2022c0d704f**, base beta **8bf229d429f4316289719ec4b583726a688ab5eb**, rama `codex/tr-descripcion-clasificacion`. El commit que añade este brief solo documenta el resultado.
- Review real de Claude: PASS exacto 17fb7522, condicionado a suite completa verde. Ejecutó independientemente los 11 casos del mapper/pipeline y presupuesto, i18n y mapa. Sus dos hallazgos aplicados: alquiler no activa DIA y Card transaction no activa la tienda Action.
- `npm test` completo sobre 17fb7522: **EXIT 0**, 348 s. Unitarios/guardianes completos verdes; navegador **451 passed, 1 skipped, 0 unexpected, 0 flaky**, incluyendo 7 pruebas de rendimiento separadas con un worker. El E2E de este objetivo sincroniza el fixture del mapper real, abre Gastos y comprueba categorías/nota, alquiler en Otros e histórico renombrado sin duplicar. Deno no instalado: su etapa fue omitida por el runner; el mapper TypeScript sí se transforma y ejecuta en los 11 casos Node.
- Docs, privacidad, mapa, sintaxis y presupuesto pasan. El límite crudo aumenta solo 1 KB para estos campos/clasificador y el sellado; gzip permanece en 332 KB, medido 326 KB. Espejo documental requerido regenerado con el script existente: dos documentos sanitizados, sin modificar memoria local ni checkout principal.
- Referencias remotas reconsultadas tras la suite: beta sigue 8bf229d4; main sigue 91c5a4f4. No publicación web, APK, migración, lectura de cartera real ni sync bancario durante este objetivo.

## Activación pendiente y rollback

1. Autorizar explícitamente **solo bank-sync, migraciones=no**: el servicio se comparte con producción. Su último despliegue comprobado es [Action 35978144828](https://github.com/JuanjoAvila/Aely/actions/runs/35978144828), SHA **f53e865277f676998d76844fd047357f4adc1569**; los posteriores consultados desplegaron ingest o bank-callback. El diff del handler y sus imports locales enablebanking/cors desde esa revisión solo añade los dos campos de este objetivo. No desplegar todas las funciones ni ingest.
2. Publicar el cliente en beta y verificar Action, manifiesto/bundle y sello; aún no está publicado. Un cliente antiguo ignora los campos nuevos; un cliente nuevo con backend anterior mantiene la clasificación previa. No hay promoción a producción autorizada.
3. Cuando exista un cargo nuevo, sincronizar TR a demanda y mirar categoría y nota. Repetir debe conservar el histórico renombrado una sola vez. No hace falta realizar una compra para probar. Si no llega información útil, confirmar qué campos faltan en una revisión privada autorizada: este candidato no puede reconstruir el comercio.

Rollback backend: desplegar solo bank-sync desde f53e8652, sin migraciones. Rollback cliente: volver al cliente beta anterior; no requiere modificar gastos históricos.
