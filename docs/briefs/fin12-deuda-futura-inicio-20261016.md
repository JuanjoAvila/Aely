# FIN12 · Financiaciones antes de su inicio

Base: `9370565008aa2c4df9fb0588b2bf4f97e2cdc726` (4.26.136). Candidata nueva para revisión, sin publicación.

`netWorthDebtPolicy.at` limitaba a cero las cuotas anteriores al ancla de una
financiación, pero devolvía su principal inicial. Inicio descontaba así deuda en
meses anteriores a su existencia. La consulta de causa se publicó antes del
arreglo (`6a0d766375ecde3ea6610609758cc3d6a58b68d6`); Claude aprobó la guarda
en `coordinador-16-10-fin12-causa-aprobada`.

Solo las deudas con `months != null` y `asOf` numérico valen cero antes del mes
inicial. Desde ese mes conservan el cuadro, el día de cuota y el pago final.
`asOf` tiene precisión mensual: no se inventa un día de compra. `day` es el día
de cuota y `asOfDate` una referencia de saldo, no una fecha de nacimiento.
Hipotecas sin plazo y deudas sin ancla conservan su reconstrucción anterior.
El saldo actual suministrado por Inicio sigue siendo el autoritativo: esta
corrección de la serie no modifica `debtBalance`, el total global ni el editor.

## Evidencia sintética

- ROJO Node en la base: cinco fallos y dos controles correctos. Roomba,
  gimnasio y suelo descontaban 600,03 €, 360,09 € y 1.200,07 € antes del inicio.
  El primer punto mostraba 2.839,94 € en lugar de 5.000,13 €.
- Verde: ocho casos y nueve mutaciones semánticas. Límites antes/en/después,
  primera cuota, altas sucesivas, céntimos, archivo, pago final, no mutación del
  estado y medianoche de Madrid en invierno/verano. Conservación del presente,
  hipotecas y legado sin fecha de inicio conocida.
- DOM real: un spec, un worker, cero retries; seis muestras al tocar la gráfica
  y vuelta al presente al soltar. El primer intento falló por exigir separador
  de miles para cuatro cifras; se corrigió el test. Ese fallo no se cuenta como
  ROJO financiero ni se oculta.
- Regresiones `inicio-v42` (31 mutantes), `inicio-transito-intereses`
  (13 mutantes), `inicio-grafica-reservas` (4 mutantes), mapa de tests y sintaxis.
  En `inicio-v42` se sustituye el antiguo oráculo que exigía principal antes del
  inicio por cero, y se añade el principal íntegro desde el mes inicial. Su
  mutante conserva el nuevo contrato; no se elimina la cobertura de hipotecas.

Los tests nuevos están registrados en `scripts/run-tests.mjs` y en el mapa de
Inicio de `scripts/relevant-tests.mjs`; `02-ui-shared.js` ya es núcleo y activa
la selección completa. Artefactos locales conservan comandos, EXIT, hashes y
lectura posterior a escritura con fsync.

Suite general local pendiente de disponibilidad: se detectó otra ejecución
activa y se publicó `fin12-consulta-suite-20261016-4414ca32559d`. Sin medidas de
rendimiento/CPU6, CI exacta, integración, beta servida ni aceptación móvil.
`docs-frescura` pasó antes del commit y falla sobre la candidata (EXIT 1):
detecta `02-ui-shared.js` cambiado después del ancla versionada. VERSION y notas
están fuera del encargo; el gate se conserva y queda pendiente de integración.
El primer comando de sintaxis usó un nombre inexistente (EXIT 1); el comando
real, `node scripts/check-syntax.mjs`, pasó (EXIT 0).
No se cambian VERSION, notas, catálogo, caps, backend ni superficies ajenas.
