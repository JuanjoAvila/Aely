# Trade Republic: emparejado automático reversible

Candidata del 13/10/2026, sin publicación. Encargo tr-emparejado-automatico-codex-20261013, base histórica beta123 3625fa7e; ejecución rebasada sobre beta124 f5904735. Conserva la dependencia autorizada Recibos 24bfb4e5 (cuatro commits), rebasada en 07383d4a. Sus topes no se incorporan: siguen los de beta124.

## Regla y conservación

N apuntes sin id bancario y M avisos no manuales del mismo banco, día de Madrid e importe con signo emparejan min(N,M). Se conservan ambas filas internas para poder separar; el apunte se oculta solo en Gastos y queda excluido del gastado por la marca de duplicado que ya entiende el servidor. Los manuales conservan su pregunta. No se extiende la cuenta a bancos distintos, fechas distintas, recibos o cuotas. La decisión de separar se guarda con hora y banco en gemelos; las copias antiguas no la pisan, y un empate favorece separar.

La migración ocurre en loadState, en el updater de App y al sincronizar. Un aviso tardío puede emparejar el banco ya guardado. Borrar el aviso visible y Deshacer operan también el banco oculto; de lo contrario el borrado resucitaría como apunte nuevo. La separación se reconstruye tras el viaje por app_state y expenses. No se crean tablas ni funciones de servidor.

## Evidencia sintética

El generador ejecuta el importador del bundle beta123 3625fa7e durante 90 días: 450 filas almacenadas antes y después; visibles 450 → 270; preguntas 180 → 0. Total 282015 céntimos (2820,15 euros), variación de gastado cero en julio, agosto, septiembre y octubre. Una segunda vía calcula el total con presupuesto.ts real y las filas serializadas para servidor. Esto es un estado generado, no la cartera del dueño.

21 pruebas Node, incluidas 49 combinaciones N/M y una matriz que ejecuta los 20 casos en UTC, Madrid y Canarias. Ocho mutaciones sobre cuenta, manual, banco, fecha, importe, separación, hora y metadatos deben fallar. Pendiente/contabilizado, respuestas repetidas, dos bizums iguales, aviso tardío, cambios de hora de marzo/octubre, cuenta anterior y copia atrasada están cubiertos. El e2e abre Gastos/ficha/separar/recargar y el caso manual; aún no ejecutado al escribir esta acta.

## Límites para la revisión

- No acredita dos móviles reales, banco real ni recepción de escrituras por Supabase. setExpenseDup heredado no devuelve acuse de fila; la reparación tras pull es un intento que puede necesitar un pull posterior.
- La identidad heredada todavía puede fundir dos avisos con exactamente la misma fecha, importe y comercio en la nube. El ordinal protege los dos apuntes bancarios reales; esta candidata no cambia la identidad general de avisos.
- Solo se automatizan coincidencias exactas del grupo definido. Las preguntas históricas fuera de ese grupo no se resuelven por parecido.
- El registro sigue limitado a 500 vínculos; la separación con hora se prioriza sobre altas automáticas, sin prometer retención ilimitada.
- Chromium/Playwright y la suite completa local no se han ejecutado por la exclusión operativa vigente. CI final remota y aceptación móvil se registran aparte.
- VERSION, notas, catálogo, Retiro124 y topes quedan intactos. Las huellas afectadas y los rojos de catálogo/tamaño son de integración; no equivalen a una entrega publicable.

## Verificación local final y preparación de integración

Build, 21 casos propios (más los 20 de cada zona), ocho mutantes, 38 casos de ordinal, 13 de Recibos, 17 de pull, sintaxis, idiomas fuente/ensamblados, seguridad, mapa de tests y privacidad: EXIT 0. El guardián de catálogo ejecutado antes de conservar el límite del bloque de categorías terminó EXIT 1; la CI del SHA final será la evidencia terminal posterior a ese ajuste. docs-frescura: EXIT 1 por VERSION intacta. Presupuesto: EXIT 1 por ambos tamaños, con tres ficheros bloqueantes dentro del tope. Medida final oficial con sello 4.26.124.99999 y reserva de 95 bytes: 1395762 bytes crudos / 383332 gzip, frente a 1383424 / 379904 permitidos.

La comparación final contra beta124 detecta 31 huellas web modificadas, ninguna edge ni nativa. El lector directo conserva una ancla histórica ambigua de Inicio que también falla en beta124; no se ha cambiado su descriptor. Integración debe ampliar las dependencias de los consumidores del updater/pull y de Gastos: gemeloGrupo, gemeloBancoAutomatico, gemeloAvisoAutomatico, reconcileGemelosAutomaticos, gemeloAutomaticoDe, separarGemeloAutomatico, gemelosCambiosNube; pushGemelos/fusionarGemelos y el método cloud.setExpenseDup. La dependencia Recibos añade a su vez lapidasAlEditar, lapidasUnion, recibosBorradosUnion y GASTO_ORIGENES. Catálogo124/Retiro124 deben valorar las huellas nuevas sin heredar veredictos; no se retiran pruebas para obtener verde. lastPaydayOf y budgetPeriodOf están cotejadas y son idénticas a beta124.
