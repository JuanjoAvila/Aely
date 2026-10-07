# Widget: contrato de fuentes entregadas y propuesta coherente

7/10/2026. Diagnóstico sin producto, datos reales, red financiera o despliegue.
Fuente main `067371705615e9cc58923509e3f60c3d0c9003ff`; fuente de entrega
declarada `64b4e5f3543ae440812ecf76a7e3259dfc938d1b`. Se corrige la correlación
histórica, sin convertirla en causa del caso humano.

## Recibo y alcance

[Deploy37227204066](https://github.com/JuanjoAvila/Aely/actions/runs/37227204066)
del4/10 terminó SUCCESS19:10UTC. Logs deljob111509228985: checkout64b4e5f,
FN=ingest, Bundling Function, Deploying Function y confirmación19:10:10UTC.
Lectura por conector oficial, sin ejecutar función. category/bank-sync tienen
entregas separadas; no acreditan cambiar ingest. Recibo27/9 queda como historia.

Blobs64b4: ingest/index.ts `52d1eb019725e011ce711903b82e6ce93b8a2805`,
_shared/ingest_logic.ts `0d86b5a47a4cb1566de76cdf95ee61d44e1c1f76`, iguales
a main067. APK público52/4.26.80 coincide con hash/manifiesto y Java de esa
fuente; símbolos DEX no demuestran equivalencia de instrucciones.
**Ingest vivo hoy, APK instalada y causa humana: unknown**. Los100 runs
recientes revisados no auditan todas las entregas posibles, incluidas externas
a Actions. Un recibo histórico no equivale a readback del servidor hoy.

## Incompatibilidad de esas fuentes

| Frontera | Fuente efectiva | Discriminante |
| --- | --- | --- |
| Ingest→month | statsDelMes desde inicioDeMesMs(fecha); spent/shown, deltas, eventKey/expenseKey, presupuesto/readAt; sin contract/periodKind/scope. | ACK no convierte cantidades mensuales en v2. |
| Nativo→saveMonth | Listener usa eventKey, después ACK de fila y luego evento original; faltan campos→contract0/kind vacío/scope vacío. | WidgetPeriod v2 exige ventana y scope no vacío exactos. |
| Pago incompatible | pendingUnknown conserva identidad sin inferir delta del absoluto incompatible. | Espera foto con cobertura o lápida correspondiente. |
| Pull→foto | Sólo pull completo más reciente entrega wC/wR; coveredEvents v2 contiene event_id e id, admite historia recibida y excluye futuro. | Reabrir o cambiar importe visible no acredita ese ACK. |
| Scope | versión/inicio/kind/magnitud/ancla/presupuesto/bancos diarios ordenados/banco widget. | Cambiar regla invalida alcance aunque inicio coincida. |

Se acredita incompatibilidad entre **fuentes entregadas4/10**, no ese par
ejecutándose en el teléfono hoy. Tampoco explica automáticamente persistencia
tras pull completo: correlacionar identidad pendiente con ACK/lápida y orden
real de fotos. La fuente ya tiene fallback ACK; otro flag «sincronizado» no
sustituye la cobertura.

## Matriz sintética ejecutada

`node docs/fixtures/inc-0710-widget-contract-correlation.mjs "$PWD"`
(Node con strip TypeScript). Verifica fuentes intactas frente main067, carga
módulos cliente originales en VM, presupuesto.ts original y el objeto month
literal de index.ts. Sin Edge handler completo, Supabase, Android o React.
Manifest JSON adyacente conserva hashes y resultados reproducibles.

12casos: net/split × bancos TR/Sabadell/ambos × presupuesto0/1000. Legacy
cliente/servidor coincide en spent y budgetLeft al céntimo, sentinela-1 sin
presupuesto e identidad del evento; campos v2 ausentes en todos. Caso ciclo:
nómina3oct abre ventana, against cliente120 frente legacy shown420 y ventana
mensual distinta. Cifras únicamente sintéticas; no payload v2 válido. Controles
de scope: ancla/banco widget/bancos diarios/presupuesto. Cobertura: evento+fila,
fila histórica v2, futuro excluido, fallback fila, token crudo no acreditado.

La revisión anterior compiló WidgetPeriod/WidgetSnapshotArbiter originales:
28aserciones de unknown, ACK, lápida, ventana/scope, cruces, readAt, dedup y
caducidad. No heredar de ellas green Android/servidor vivo. La matriz nueva
no implementa servidor v2: **no hay GO de compatibilidad v2 ni despliegue**.

## Unidad reparable propuesta

Contrato dual de ingest: mantener legado para su consumidor; respuesta v2
sólo si el servidor acredita ventana/ancla/reglas/selección del snapshot
calculado. No añadir contract2, copiar scope o aplicar month a Mi ciclo.

1. Validar widgetPeriod y estado persistido: inicio no futuro/edad45d, kind,
   ancla real de ingreso y bancos/presupuesto/reservas/banco widget. Reconstruir
   scope con reglas equivalentes al cliente; un widgetPeriod atrasado no
   permite etiquetar ledger nuevo con alcance antiguo. No confiar en texto
   del cliente como prueba de suma.
2. Calcular ledger completo, dedup/lápidas y ventana correcta; excluir ancla
   y conservar neto/gasto. Contrastar reservas, moneda, neutrales, ingresos,
   bancos y fechas Madrid/límites mes-ciclo con cliente exacto. Si falta
   cobertura/equivalencia, mantener incertidumbre; no fabricar cifras v2.
3. Emitir absoluto y contribución del MISMO evento/fila, antes/después de
   excluirla, readAt de inicio y scope exacto. No derivar cash/safeLiq de gasto
   presupuestario. Journal/fence/ACK/tombstones siguen siendo necesarios.
4. Matriz futura cliente/servidor/nativo: legacy51, v2 mes/ciclo, reservas,
   bancos/idioma, alcance cambiado en vuelo, duplicados, pagos anteriores y
   futuros, foto cruzada, offline/reintento, error parcial, ACK ausente/tardío,
   borrado/caducidad. NO-GO: etiquetar month como ciclo, scope eco, degradar v2,
   borrar unknown/journal o sincronizar bancos automáticamente.

Antes de atribuir reparación al caso, acreditar por canal privado autorizado
versión instalada/condición local/ACK, sin publicar identidades/importes.
El contrato puede desarrollarse con fixtures, pero no anunciar que arregla el
teléfono sin esa correlación. Revisión financiera independiente y CI exacta
preceden gates Edge/APK propios. Sin autorización de despliegue por este
documento. Widget y rendimiento global conservan incidencias abiertas.
