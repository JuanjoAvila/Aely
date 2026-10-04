# OPS-0410 · Cola de revisión beta

Prioridad humana del 4 de octubre: mostrar únicamente lo que queda por probar en beta y retirar lo estrenado, sin acumular solicitudes antiguas.

## Evidencia y cambio

Base aislada `be3081abab18aef6c3e17dacaba6bfe7fb3fd3b7`, beta servida4.26.90.5; producción4.26.86, recibo `sourceSha=d366215ad4f49be5630d2380292391f6d191277d`. Artefactos públicos consultados el4/10. Reproducción de lógica:16 tandas/40 puntos. El cambio conserva10 tandas/22 puntos sobre ese catálogo: cuatro novedades y seis entregas APK/Edge pendientes. La nueva candidata92 añade su propia prueba; no incluye la candidata local91 de Metas.

La cola y la auditoría tienen propósitos distintos: un cambio compartido invalida el alcance de código, pero no vuelve a estrenar por sí solo todas las funciones que lo usan. El recibo incorpora `pruebas` con versión y guion por ID. Un guion antiguo entregado, con recibo web, sale de la cola; una corrección nueva conserva su nota y su prueba. Nativo y Edge siguen exigiendo su entrega real. Los recibos anteriores se completan desde las notas servidas solo cuando la cabecera coincide con la versión de producción. Sin evidencia se conserva la incertidumbre. El primer arranque sin entrega comprobada mantiene la entrada desde Ajustes, oculta el contador histórico y ofrece reintento. El último recibo público comprobado conserva la lista offline; repetir el mismo SHA reutiliza su guion sin descargar de nuevo todo el histórico.

Reabrir el panel o volver a primer plano refresca los artefactos de producción. Una entrega puede cambiar la lista incluso si el número de versión no cambia. No se borra ninguna decisión, comentario, marca o historial; no hay sincronización bancaria automática. El estado de cola se calcula antes de añadir la versión al título y viaja con la tanda: si solo falta APK/Edge, el aviso no inventa una web pendiente. La auditoría original conserva sus diferencias de alcance.

## Validación

- Ensamblado y siete bloques de sintaxis: PASS en la primera implementación.
- `beta-veredictos`: PASS; el nuevo caso conserva auditoría, novedades, revisiones de guion y gates APK/Edge, y no inventa entrega sin recibo.
- DOM enfocado: transporte real con red simulada, primer arranque sin evidencia, refresco, recibo legado, caché por SHA y recarga offline; retirada de estrenadas, novedades/APK, rechazo e historial en es/en/ca:4 PASS. Entrada y contador reales de Ajustes sin evidencia:1 PASS final, tras corregir el estado/posición del montaje del fixture.
- Node completo intermedio:354,4s, frente a1487,9s antes de optimizar el mismo candidato (76,2% menos, ejecuciones locales con DOM concurrente). Todos los checks de producto pasan; única salida fallida: `memoria-espejo`, deriva preexistente frente a la memoria local de Claude. No se modifica esa memoria ni se convierte la salida1 en verde. Deno omitido localmente por no cambiar backend; CI pendiente.
- Parser sobre la fuente final:17 módulos/575 funciones con textos, inicios y finales exactamente iguales al lector anterior. Presupuesto oficial sellado92.99999:1.307.848B min/356.153B gzip, tres ficheros bloqueantes; margen824/199B.
- DOM funcional completo:741 PASS,10 fallos,1 skip visual preexistente,0 flaky,23min. Los diez casos esperaban una cola sin entrega pública acreditada: nueve fixtures de identidad/persistencia y uno de caché offline. Se corrigen los transportes simulados; el guardián de primer arranque real sin evidencia no se debilita.
- Cierre final `revisar-beta`, `inicio-offline`, `beta-panel-reopen`:79 PASS,0 fallos/skip/flaky,131,75s. Rendimiento aislado:7 PASS,0 fallos/skip/flaky,40,95s.
- Node de cierre tras estado de entrega y metadatos de nota:299,8s PASS, incluidas guardias completas de alcance, veredictos, catálogo/idiomas, sintaxis, privacidad, docs y presupuesto. No se repiten los checks financieros que no cambiaron.
- Revisión local del diff completada. No se atribuye revisión independiente de Claude. CI exacta, publicación beta y prueba humana pendientes. Estos resultados locales no acreditan APK, Edge, SQL, pagos ni sincronización real.

## Coste observado

La suite Node completa de la candidata91, separada de este cambio, tardó1596,3 segundos:596,29 en `beta-sources`,82,53 en `listo-actor`. Terminó con fallos de espejo de memoria y tanda de Metas duplicada. No se repite esa suite durante cada ajuste del panel: primero casos específicos, después los checks requeridos del candidato final. No se reducen garantías financieras ni se convierte un resultado parcial en CI completa.

Las dos optimizaciones del tooling forman parte de esta tanda y tienen guardianes registrados: notas diferidas y lector de declaraciones con validación VM. No se eliminan pruebas ni se cambia el cálculo financiero.

## Cierre de revisión independiente · candidata93

Claude revisó cc3402be por lectura de código el4/10 a11:35UTC, sin tests nuevos ni DOM propios: sin bloqueo, dos ajustes. Se limita el refresh por visibilidad a beta, se evita reescribir el recibo idéntico y un error de procesamiento libera la consulta para reintentar. Se conserva la tanda92 sin pasos nuevos;93 no incluye Metas. Verificación/publicación final pendientes.

Cierre93 comprobado: Node17checks afectados en345,9s PASS (build previo congelado, Deno y resto financiero sin repetir); DOM3specs80PASS/1fixtureFAIL, corregido el arranque del canal antes del montaje de App: siete casos afectados finalesPASS, sin fallo/skip/flaky. Presupuesto oficial93.99999:1.308.073B min/356.205B gzip, margen599/147B respecto1278/348KiB. El HTML de producto no cambió al corregir el fixture. CI exacta/publicación93 y aceptación humana aún pendientes.
