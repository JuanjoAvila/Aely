# Inicio: correcciones de la segunda revisión independiente

Continuación de PR204 sobre `f274ef04`, misma rama y titular. Encargo
`inicio-v42-ronda3-bienes-codex-20261012`, base119
`788432f4682c199edd785f6973d9353330c0064a`. El resultado anterior sigue cerrado.
Esta fuente no está integrada ni publicada en beta.

## Contrato corregido

1. `born` sólo lo registra Guardar en el formulario de Bienes. Montar la app,
   reinstalarla o recibir una lista nueva de nube no acredita una compra ni
   crea un primer escalón. Se toca exclusivamente el callback de Guardar de
   `AssetSheet` en07 para conectar esa intención explícita con el registrador02.
2. Un bien legado sin escalones conserva hacia atrás su valor actual, que ya
   formaba parte del patrimonio mostrado. Inicio declara la fecha del valor
   propio y esa aproximación en es/en/ca. Desde el primer escalón real sin alta
   se recorta al tramo conocido; un alta explícita sigue valiendo cero antes
   de su fecha. Cambios de valor y borrados conservan los escalones propios.
3. Sólo dos cuentas reconstruidas por flujos neutralizan las patas propias.
   Si la hucha va por cierres manuales, la salida del banco compensa su escalón.
4. Dos movimientos de la misma cuenta no se emparejan; un traspaso al bróker
   sin pista no acredita inversión entre fotos. Los dos mutantes reales tienen
   oráculos monetarios/temporales y mueren; se conservan los siete anteriores.
5. En deudas sin plazo, la amortización histórica espera al día conocido de
   cuota. Sin día se conserva la convención mensual y se declara en Inicio.
   Se conserva la fórmula de saldo actual de Deudas: doce cuotas500/amort400
   con plazo terminan en−1200; el mismo ejemplo sin plazo termina en−1600,
   conforme a su saldo actual vigente. No se cambia esa fórmula por arrastre.
6. El callback real del pull devuelve el estado previo si al aplicarse no hay
   sesión o pertenece a otro titular. Una ventana nube14 no sustituye local400.

El aviso de cobertura sólo añade la explicación correspondiente en el renderer03;
las claves nuevas nacen en los tres idiomas. No cambian Gastos, widget, saldo
actual de deudas, categorías ni la vista de presupuesto aceptada.

## Evidencia y límites

Los casos de `tests/inicio-v42.test.mjs` reproducen los fallos anteriores y
ejecutan los callbacks reales de Guardar y del pull, con datos sintéticos.
UTC/Madrid y los nueve mutantes pasan. Sintaxis, i18n, mapa, auth-disposal y
los diez casos de Metas/transporte pasan en Node. La evidencia de pantalla
nueva se registra al ejecutarse; no se hereda la pasada31 de16d921c5.

Medición oficial con DSN sintético95B, sello119.99999 y gzip9:
1.361.243B minificados/372.777B gzip. El guardián de tamaño termina EXIT1:
347/41B sobre1329/364KiB;3 ficheros bloqueantes se conservan. Mínimo
medido1330/365KiB comunicado al coordinador, sin alterar los topes del autor.
El tratamiento de este límite corresponde a integración.

Se conservan las13 reservas anteriores, migración119,29 identidades web,
ambas pasadas A/B y los rojos de CI. VERSION, notas, catálogo y tratamiento
del tope corresponden a la integración. No se lanza CI nueva ni funcional
completa ni FPS/A/B: Claude repetirá rendimiento en un slot limpio.
La focal de Inicio requiere censo fresco, toma/devolución OWN y resolución
expresa del incidente de ocupación posterior a FIN01. Ausencia de procesos
no acredita ese retorno. Integración, publicación y prueba móvil pendientes.
