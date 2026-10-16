# FIN12 · Financiaciones antes de su inicio

Revisión1 de PR242, sobre `bdd46f4aa817eabc5aa3692719de8b6eed5c57f7`;
base original `9370565008aa2c4df9fb0588b2bf4f97e2cdc726` (4.26.136).
La revisión sustituye el criterio inicial basado en `asOf`: la migración lo
asigna a deudas antiguas y el editor lo reancla cuando `amort` es cero.
Por tanto, ese campo no acredita cuándo nació la financiación.

La consulta `9ffbd2fedfc8b6f10dcfe5a7d29196997190c873` recibió aprobación
`f30d80cac3ced25a2a65fb19dea2ff6d7e81bf87` para un campo explícito:

- El alta con plazo en 09 guarda `startMonth = asOf` después de convertir las
  cuotas pagadas. AffordCard en 08 lo guarda al crear la financiación.
- `netWorthDebtPolicy.at` devuelve cero antes de ese mes solamente si hay plazo
  y `startMonth` entero. Desde ese mes mantiene el cuadro existente. No cambia
  `debtBalance`, las cuotas, el pago final ni el saldo actual suministrado por Inicio.
- El editor y `seedFlows` no escriben ni reinterpretan `startMonth`. Si el editor
  reancla `asOf` por amortización cero, conserva el inicio explícito.
- Sin `startMonth` válido se conserva exactamente el saldo/cuadro legado.
  Las financiaciones existentes no se corrigen retroactivamente. Capturar o
  confirmar su fecha de inicio queda en backlog, sin migración automática.

El inicio tiene precisión mensual. `day` sigue siendo el día de cuota y
`asOfDate` una referencia de saldo; ninguno se convierte en día de compra.
La coordinación con PR240 consiste en un diff de una línea en el alta de 09;
su integración serial corresponde a Claude.

## Evidencia de revisión1

- ROJO A/C: dos fallos Node y dos DOM contra la candidata inicial: migración
  y reancla descontaban cero en agosto cuando correspondían 600,03 € de deuda.
- ROJO altas: ambos callbacks reales no emitían `startMonth` (dos fallos).
- Verde focal: 25 tests, incluidos 13 mutantes semánticos (nueve del lector,
  tres de las altas y el suelo B). B conserva 600,03 €; su mutante ejecuta y
  obtiene 700,05 €. Los mutantes de altas ejecutan y cambian importes históricos;
  la carga o ausencia de texto nunca cuenta como muerte financiera.
- Se ejecutan los callbacks reales de las altas, el editor, `seedFlows`,
  `slimForCloud`, `cloud.pushState`, `cloud.pullState` y el merge de estado.
  Nube usa un SDK simulado con serialización JSON, sin backend ni credenciales.
  Se cubren insert/update, nube más nueva, local más nuevo y login nuevo.
  Se mantiene el contrato last-write-wins de deuda completa; no se introduce
  reconciliación por campo frente a clientes antiguos que omitan metadatos.
- DOM real: 3/3, un worker, cero retries. Seis muestras de altas sucesivas y
  regreso al presente; legado migrado y reanclado conservan el pasado.
- Regresión `inicio-v42`: EXIT 0, 31 mutantes. Se restaura el principal legado
  de 875,95 € y se separa el caso con inicio explícito, que sí vale cero antes.
- Build y sintaxis: EXIT 0. Bundle regenerado. Mapa e2e incluye 08 y 09.

Los artefactos originales de PR242 permanecen inmutables; la evidencia sucesora
se guarda separada con comandos, EXIT, hashes y fsync/readback. Un primer comando
del ROJO de altas tenía un patrón mal escapado; se conserva como error de arnés,
se repite correctamente y sólo el segundo acredita el ROJO financiero.

Suite general pendiente del runner-libre de FIN15; se ejecutará con TZ=UTC y
AELY_MEMORY_SOURCE inexistente. Sin CPU6, CI exacta, integración, beta servida ni
aceptación móvil. El gate docs-frescura falla desde la candidata inicial por
cambios de runtime posteriores al ancla de versión: requiere integración, sin
elevar VERSION ni debilitar el gate. No se cambian notas, catálogo, caps o backend.
