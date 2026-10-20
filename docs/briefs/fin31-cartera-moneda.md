# FIN31: moneda, totales parciales y proyección en Cartera

R2 es hijo directo de R1 `84617cc289e40bd5760794c5b0c3d43d68696024`,
en la misma PR290. La referencia funcional EUR es beta160
`66c13084257fd576444a01cb529c5e6e815c6ec6`. No se persigue otra beta.

## Comportamiento

- FIN06 conserva los totales parciales conocidos y el aviso de total incompleto
  en Cartera, su leyenda y Tus inversiones. Una fila de bróker con algún valor
  sin conversión muestra `—` y «Sin conversión», incluso si ese mismo bróker
  contiene otra posición convertible. Se conservan originales, cuentas conocidas
  y ceros reales. La selección de la leyenda cambia el subtotal mostrado.
- Tus inversiones inicia en la moneda global y permite EUR, USD y GBP con opción
  seleccionada. La selección local no cambia Ajustes. Sin cambio de destino,
  muestra `—` y el aviso existente, sin etiquetar euros como libras.
- Proyección conserva el comportamiento EUR anterior a R1: principal
  `totals.invested`, incluidos redondeos, saveback e inversión mensual; aporte
  simulado de 500 cuando no hay aportaciones guardadas; mensualidad sin decimales.
  Aporte, eje, principal, valor futuro, contribución y ganancia se convierten a
  la moneda local. Las series y el deslizador siguen calculándose en EUR.
  Mover el simulador no guarda aportaciones ni modifica las posiciones o FX.

No cambian importes originales, costes, identidades, importación, sincronización
ni widget nativo. La integración con FIN22/PR289 corresponde a Claude.

## Evidencia dirigida

Tres ROJOS causales en R1: total `—` en lugar de 1950,40 EUR; aporte inicial
0,00 GBP en lugar de 400 GBP (500 EUR); valor futuro 84140 EUR en lugar de
84681 EUR al incluir recompensas e inversión mensual en el principal.
Dos fallos previos del analizador del archivo de pruebas se conservan como
errores del arnés, separados de los ROJOS financieros.

Dos casos EUR se contrastan con el HTML real de beta160 y con el candidato:
principal independiente 161990 céntimos = posiciones 148590 + redondeos 525 +
saveback 375 + inversión mensual 12500. Comprueban valor futuro, contribución,
ganancia, principal, mensualidad y eje con aporte guardado de 150 y por defecto
de 500. Otros controles mantienen USD→EUR=0,8 y GBP→EUR=1,25; GBP seleccionado,
independencia local/global, cero real, bróker mixto, cambio de destino ausente,
selección de leyenda, recarga y filas/tipos completos antes y después.

Las 39 pruebas autorizadas pasan: `divisas-sin-cambio.spec.mjs` sin modificar,
`fin31-cartera-moneda.spec.mjs` y `cartera-inversiones.spec.mjs` sin modificar:
CPU1 secuencial, un worker, cero reintentos y parada al primer fallo, fixtures
sintéticos y puerto propio. CPU x6 queda excluido expresamente de esta corrida.
El primer intento combinado se interrumpió al descubrir ese caso dentro de la
suite existente; sin informe completo no se puede excluir su ejecución en ese
intento y no se cuenta como evidencia. Los EXIT reales y hashes están en el informe privado.

## Integración pendiente

Las dependencias nuevas `00-core.js:CUR_SYM`, `00-core.js:eur` y
`00-core.js:fromEurAmt` afectan a **limpieza-ajustes-perfil** y
**cartera-ordenar-brokers**. El catálogo queda reservado a Claude; esta revisión
no actualiza catálogo, VERSION, notas, CHANGELOG, README, ROADMAP, BACKLOG o caps.
Se registran docs-frescura y catálogo160 dirigido como gates reales.

No se ejecutan mutaciones generales del catálogo, suite completa, CI
general, banco/nube reales, SQL/Edge/API, APK, despliegue o merge. Esta evidencia
local no confirma entrega servida ni aceptación móvil. No ProductREADY.
