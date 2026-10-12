# Vigencia de Mi ciclo en web y widget

Regla canónica acordada el 12/10/2026. El día del cobro es el día 0. Su ciclo
permanece vigente durante todo el día 45 del calendario **local del dispositivo**;
al empezar el día 46 deja de ser válido. Se cuentan fechas, no bloques de 24 horas:
un cambio de hora no adelanta ni retrasa el último día. Un cobro a las 00:30 o a
las 23:30 abre el mismo día local a las 00:00. Un cobro fechado mañana no lo abre.

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

La tabla sintética `tests/fixtures/widget-ciclo.tsv` alimenta el test web y el JVM
en `tests/widget-ciclo.test.mjs`; se ejecutan las mismas filas en UTC y Madrid,
incluidos ambos cambios de hora. El test carga el módulo fuente de Gastos para no
validar por accidente un `public/index.html` anterior al cambio.

La corrección de `WidgetPeriod.java` **requiere APK nueva**; no llega por OTA.
La APK 54 anterior sigue leyendo el mismo contrato, conserva su guarda antigua y
puede mostrar el aviso durante el día 45; una OTA no acredita su corrección nativa.
Se mantiene el decimal de compatibilidad para APK 53 y el entero para APK 54.
El plugin conserva `longValue()`: redondear el decimal `.5` rompe el alcance exacto.
