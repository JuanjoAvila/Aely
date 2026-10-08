# Panel beta: identidad, entrega y reclamación histórica

> Rescate documental del 8/10/2026. Fuentes: PR83 `e7fec4b446936ffa4361867b8d8ebdb75656d72b` y PR86 `d5c43596f2d6ca08905062311f24ca23bbda9b2a`. Este relato corresponde al 30/9–1/10; no anuncia el estado servido ni los veredictos actuales. No se copiaron consultas, partes privados ni capturas.

## Qué conserva la propuesta75 y por qué fue insuficiente

La propuesta75 vinculaba la revisión a una huella del id, título, pasos y rev, para no perder un veredicto sólo por mover una tanda de versión. Conservaba el último rechazo o retirada aplicable y separaba aprobación de entrega: web por delante no demostraba que una APK pendiente estuviera instalada.

Ese contrato inicial tenía límites: FNV de ocho hex y rev dependían de reflejar manualmente los cambios de código; la entrega nativa se vinculaba principalmente al número APK. No restaurar ese diseño. En main56c7e328/beta8dcc5ed3, betaHuella incorpora codigo tras la parte textual; betaVerdictFor y betaEstadoEntrega usan identidades y compatibilidades de revisión, recibos web/Edge y código nativo específico. La historia explica la evolución; no sustituye el contrato vigente ni autoriza nuevos aliases.

La acta nocturna registra beta75 técnicamente publicada con source `ca7b97d438e01f60091a3818fdca734740ec8a9e` y [publisher36807213148](https://github.com/JuanjoAvila/Aely/actions/runs/36807213148). También registra que **el usuario rechazó75 como solución a su reclamación**. Conservar ambos hechos: CI/publicación y satisfacción humana son evidencias distintas.

## Los siete títulos recuperados

La reclamación reabierta del 1/10 ya contenía estos nombres. La tabla conserva la comprobación de aquel corte, no un diagnóstico actual de esos siete elementos:

| Título reportado | Límite demostrado en el corte histórico |
|---|---|
| Arranque con poca conexión | El HTML estable67 carecía del comportamiento de splash que sí estaba en beta75. |
| Ayuda de Mi ciclo | El HTML estable carecía del control para plegar su explicación. |
| Widget después de reabrir | La promoción web del28/9 había retenido su entrega nativa. |
| Gasto del widget tras una compra | La aprobación de un pago no publicaba el binario pendiente. |
| Clasificación de gastos bancarios | Requería distinguir cliente, fuente bancaria y receptor nativo. |
| Banco del widget | El selector nativo retenido no viajaba por la versión web. |
| Widget con la app cerrada | Además de entrega nativa, requería las pruebas servidor/pago correspondientes. |

Producción67 no ofrecía el recibo nuevo de entrega (404). Atribuir toda la reclamación a ese404 antes de identificar las filas fue una explicación prematura: había diferencias funcionales web y entrega nativa retenida. La ausencia del recibo no probaba que las siete filas sobraran.

## Evidencia recuperada del relevo, sin reactivar su operación

La fuente de relevo identifica el candidato posterior del panel `351053b9f0d83d5f40152c5f684803fb735f9eb1`, con 55 DOM reportados y GO condicionado a CI y cotejo de publicación. Su objetivo separaba revisión pendiente, aprobación y publicación; una entrega de versión menor podía ser válida si su recibo acreditaba la revisión exacta. No convertía la reclamación en resuelta desde el móvil.

Las reservas76/77, propietarios, buzones, vigías, heartbeat de15 minutos, plazos vencidos y concesiones Chromium eran operación del1/10. Se descartan como instrucciones actuales. No se restauran los tres briefs de86 en bruto: su contenido útil está consolidado aquí, con los seis blobs fuente en la matriz de rescate.

La auditoría y promoción actuales siguen en sus tareas vigentes. Para cualquier revisión nueva: último veredicto aplicable, identidad exacta y evidencia de entrega de cada superficie; sin dato, conservar pendiente. Este rescate no lee app_events, no inventa aceptación, no borra tandas y no cierra gates APK/Edge/móvil.
