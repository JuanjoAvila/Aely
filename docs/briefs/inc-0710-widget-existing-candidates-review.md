# Widget: residuos de PR existentes, 7/10/2026

Revisión de sólo lectura de producto. Base main
`067371705615e9cc58923509e3f60c3d0c9003ff`; APK público52 declara
`64b4e5f3543ae440812ecf76a7e3259dfc938d1b`, misma fuente de la entrega ingest
verificada del4/10. Ninguna de esas correlaciones acredita APK instalada,
servidor activo hoy o causa humana. INC-2909-01/FIN-05 siguen abiertos.
No merge, cierre de PR, APK, Edge, SQL ni cambio financiero en esta revisión.

## Clasificación fresca

Los cuatro heads se leyeron y releyeron por conector oficial, sin variación.
Se recuperaron listas completas de archivos (<100), patches y fuentes
necesarias por SHA. Reviews formales de estas PR: lista vacía, no aprobación.
Los NO-GO técnicos históricos se cotejan con contrapruebas actuales, no se
hereda una aprobación del body ni se reproducen reportes familiares.

| PR / head congelado | Estado remoto | Clasificación / próximo gate |
| --- | --- | --- |
|87 `26c2fd082959f168323b6df221b14af71b36953e`|open/draft,29files|**NO-GO** íntegra. Sí contiene propuesta Edge útil como punto de partida (`53561b09`), pero scope ausente y cálculos/ventana sin evidencia suficiente. No duplicar esa propuesta; reparar su delta aislado sólo tras revisión financiera y permiso Edge.|
|90 `821733fc7d65c895e288dba74d4ed412d01b3285`|open/draft,28files|**Absorbed cliente/nativo** en main/APK fuente52; su metadata provisional76 y artefactos no deben mezclarse de nuevo. Cierre administrativo posible tras inventario del delta completo, sin nuevo merge ni nueva aprobación.|
|105 `9711219766449e4e7c50081b00f7f4da7d7abd1e`|open/draft,19files|**Pending útil**, NO absorbida: reparación de serialización unknownJournal. Contraprueba causal de Java pasa frente baseline que falla recuperación. Siguiente unidad existente: portar sólo delta nativo/guardianes con revisión exacta, compilación, CI y gate APK separado; no afirmar arreglo humano.|
|44 `2050ce327bc931510742c3c582a9faf36155da89`|open/no draft,3files|Diagnóstico FIN-05 histórico + **residuo tooling pendiente**, no reparación de widget. Texto de listo diferencia rama candidata/aprobación/publicabilidad y porte ya entregado; varios mensajes aún no equivalentes en main. No copiar head completo ni usarlo para revertir guard de identidad actual. FIN-05 no se cierra por antigüedad.|

## PR87: Edge v2 existe, pero no está terminado

La fuente propuesta añade ventanaDelWidget/statsDelCiclo y fuerza split en mes;
index entrega contract2 y periodKind pero **ningún scope**. APK52/main exige
sameScope no vacío idéntico. No basta añadir un eco de scope: debe acreditar
bancos, reservas/presupuesto, ancla, ventana y magnitud del cálculo.

Se ejecutó presupuesto.ts exacto dePR87, blob
`35b12edc71d7a2df647348afc352cea1a07da83e`, recuperado oficialmente y
verificado por hash Git tras materializar. Contraprueba sintética Node:

| Caso | Resultado de fuente PR87 |
| --- | --- |
| Nómina ancla + compra120, sin futuro | against120 (control positivo). |
| Añadir compra20 mañana | against140: falta límite superior, cliente excluye futuro. |
| Misma serie sin ancla acreditada | against−1660: se incluye ingreso1800. |
| budgetCycle=false con widgetPeriod ciclo persistido válido | ventana sigue ciclo: snapshot persistido no prueba selección vigente. |

Son cifras ficticias, no datos del usuario. El payload candidato no pasa
contrato nativo moderno; además reetiqueta respuesta para consumidor legacy
sin demostrar preservación de su magnitud anterior. El delta Edge contiene
trabajo reutilizable, **no GO de despliegue**. La reparación coherente necesita
contrato dual, límites temporales, selección/ancla real y equivalencia exacta
cliente/servidor/nativo. No fusionar29files por recuperar esa pieza.

## PR90: absorción exacta parcial comprobada

Los cinco Java del widget/plugin/listener/period/arbiter tienen blobs idénticos
en head90 y main067; también tests/widget-arbitraje y widget-coherente.
WidgetPeriod `2c003f52fdc6c7f9805b2f9dfc461c200e766514`, arbiter
`8e4d634f238464720a87cec5a9a1d141362d0902`; tests respectivamente
`b2cbb3994fb77a076f8ac19b1f9ee1080e7e5c5f` y
`83724703d366b102fcc606710206f53eef82f7be`.
El e2e de banco evolucionó después: no confundir diferencia de archivo con
pérdida de producto ni restaurar versión provisional. Cliente actual contiene
widgetScopeOf, coveredEvents con historia v2, negociación y guard de pull
completo, incluidos los mecanismos descritos en el delta90. Absorción de
esa superficie no acredita backend v2 ni aceptación Android real.

## PR105: siguiente unidad existente, no otro fix paralelo

Arbiter105 blob `9ddb3941760e23375c147d267d3677953a6c8c03` es distinto del
actual8e4d; tests/widget-offline introducido en105 no existe en main, y los
tests de arbitraje/coherencia tienen deltas específicos. No está en la fuente
de APK52 examinada. El cambio evita salto final al escribir unknownJournal,
deduplica líneas delimitadas, tolera indentación residual sin tabulador y
normaliza identidad de línea; conserva fail-closed ante campos corruptos y
unknown sin ACK/lápida.

Fixture recuperable `docs/fixtures/WidgetCandidateReview.java`, compilado
contra Java original main y fuente105 exacta (hash Git comprobado). Baseline:
1aserción PASS confirma rechazo de journal con newline+indentación aun con ACK.
Candidata:5aserciones PASS confirman recuperación de ese formato, unknown
sin ACK, lápida explícita, corrupción real bloqueada y dedup sin newline final.
No Android SharedPreferences/serializador vivo, RemoteViews o dispositivo.
El modelo representa un formato posible, no prueba que lo produzca el móvil.

Comandos, con fuente candidata materializada y clases en carpeta temporal:
`java -m jdk.compiler/com.sun.tools.javac.Main -d classes WidgetSnapshotArbiter.java docs/fixtures/WidgetCandidateReview.java`
y `java -cp classes com.micartera.app.WidgetCandidateReview`; para baseline
usar fuente main y argumento `baseline`. No sustituir fuentes dentro del repo
para ejecutar la comparación.

Antes de implementar/entregar: revisar TODO delta financiero/journal105,
guardianes originales y registro, estado/head/CI actuales y versión final;
aislar cambios mínimos frente main sin los bumps/artefactos88 históricos.
APK nuevo exige gate específico. No eliminar unknown, resetear journal o
degradar v2 para hacer desaparecer placeholder. No resolver incompatibilidad
Edge por esta corrección de serialización: son fronteras distintas.

## PR44 y cierre del inventario

PR44 no cambia producto: BACKLOG, acta técnica y mensajes de listo. Su head
es antiguo: sustituir todo scripts/listo desde él retiraría guardias añadidas
después y volvería a URLs antiguas. Considerar sólo delta de mensajes contra
actual, manteniendo identidad autorizada, gates exactos y separación de
aprobación/publicabilidad. Diagnóstico de edición/lápidas requiere prueba
actual antes de darlo por absorbido o resuelto; no se ejecutó lector vivo.

Resultado: no crear reparación nueva que duplique105 o la propuesta Edge87.
Revisión financiera independiente debe elegir entre una unidad aislada105
y completar propuesta Edge87; ninguna se publica desde esta auditoría.
Se conservan todas las reservas externas y WIP. No se copiaron datos o
motivos privados, no se ejecutaron suites globales ni redes financieras.
