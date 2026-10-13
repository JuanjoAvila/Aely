# Vigencia de Mi ciclo en web y widget

Regla canónica concretada por Claude el 13/10/2026: el calendario financiero es
**Europe/Madrid** en web, Android e ingest, sea cual sea la zona del dispositivo.
El día del cobro es el día 0. Su ciclo permanece vigente durante todo el día 45;
al empezar el día 46 deja de ser válido. Se cuentan fechas, no bloques de 24 horas:
un cambio de hora no adelanta ni retrasa el último día. Un cobro a las 00:30 o a
las 23:30 de Madrid abre el mismo día a las 00:00 de Madrid. Un cobro fechado mañana no lo abre.

Se conserva el límite existente de 45 días: la web antes medía desde la hora del
cobro y Android desde su medianoche, por lo que discrepaban durante parte del día
45. No hay evidencia para eliminar el límite ni ampliarlo a 60 días.

`lastPaydayOf` elige el cobro admisible más reciente dentro de esa ventana.
`budgetPaydayOf` conserva además sus filtros de nómina, banco, duplicados y lápidas.
Una nómina nueva abre otro ciclo; cambiar de mes no reinicia uno vigente. Sin ancla
vigente, la web calcula el mes natural. El nativo no puede recalcularlo: conserva
el aviso y oculta la cifra de un ciclo vencido hasta recibir una foto válida del
periodo nuevo, con el mismo alcance e identidades. El mes natural conserva su
contrato actual, independiente de esta regla de ciclo.

Java resta primero la fecha y después fija la medianoche, con zona Madrid explícita.
Web e ingest buscan la frontera del día en Madrid: ningún reloj del dispositivo
puede arrastrar la hora 01:00 de una medianoche inexistente en Santiago o Cairo.

Ingest aplica la misma vigencia por **calendario de Madrid**, zona que ya utiliza
para sus ventanas mensuales y el fin del día. No conserva el tope de 45 × 24 horas:
ese tope rechazaba todo el día 45 y, al cruzar octubre, la última hora del día 44.
No necesita ampliar arbitrariamente el plazo. El servidor sigue exigiendo ancla,
filas completas e identidad del alcance; Android revalida también el calendario de Madrid.

La tabla sintética `tests/fixtures/widget-ciclo.tsv` alimenta Node y JVM en
`tests/widget-ciclo.test.mjs` (dispositivo en UTC, Madrid, Canarias, Santiago y Cairo),
y Deno en `supabase/functions/ingest/widget.test.ts` (la tabla completa). Sus horas
sin zona expresan Madrid; la columna zone conserva el origen de cada regresión. Incluye
milisegundos, el inicio exacto que produce una fecha de extracto normalizada,
cobro de hoy antes de su hora registrada y límites a ambos lados del cambio de hora.
Node carga Gastos desde el módulo fuente y compara ventana y cifras con b1d3c8e8
en 864 casos de Madrid, incluidos marzo y octubre. Deno sólo necesita permiso de lectura de
esa tabla, registrado en el runner; no consulta una base de datos real.

La corrección de `WidgetPeriod.java` **requiere APK nueva, prevista como 56**; no
llega por OTA. Para una APK anterior (o versión desconocida), la web comprueba su
guarda antigua antes de enviar un ciclo. Cuando no lo aceptaría, recalcula el **mes
natural completo**: gasto bruto, presupuesto restante, etiqueta, inicio y alcance,
sin ancla del ciclo. Guarda ese mismo `widgetPeriod` para que ingest calcule los
pagos posteriores sobre la misma ventana. Inicio sigue mostrando el ciclo elegido;
el widget antiguo dice «Este mes». No se cambia la cifra de periodo sólo de nombre.
Sin volver a abrir la app no puede reemplazarse una foto antigua ya caducada.
Se mantiene el decimal de compatibilidad para APK 53 y el entero desde APK 54.
El plugin conserva `longValue()`: redondear `.5` rompe el alcance exacto.

Orden propuesto para integración, sujeto a sus controles de beta y publicación:

1. Publicar la web compatible; al abrir, APK 55 recibe una ventana que admite.
2. Desplegar ingest con esta regla y verificar la respuesta con la app cerrada.
   No basta desplegar sólo `widget.ts`: integra las dependencias de la función y
   conserva el contrato mensual legacy. Un ingest anterior puede seguir sin
   acreditar el ciclo, aunque web y Java ya estén corregidos.
3. Instalar la APK 56 y abrir la app para negociar su versión y guardar el ciclo
   y alcance nuevos. Verificar el día 45 y un pago con la app cerrada en el móvil.

Esta PR prepara fuentes y pruebas; no despliega ingest, no fabrica ni instala APK
y no acredita DOM, rendimiento ni launcher real. La integración escribe la nota
de versión. El e2e exige texto exacto del anillo: 86% restante en el día 45 del
fixture y 100% en el día 46; buscar «0%» dentro de «100%» no prueba ese resultado.
