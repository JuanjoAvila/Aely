# Inversiones: fecha del dato por origen

Candidato del 13/10/2026: reserva inmutable sobre beta123
(`3625fa7ed5134cfbc5e364adc4f588bfdaf670c0`), ejecución rebasada sobre beta124
(`f5904735b514751ee926d25c22c92195b6ce3653`) tras la señal del coordinador.
No publicado ni aprobado en móvil. No modifica VERSION, notas de versión, catálogo ni topes.

## Comportamiento

En Cartera → Ver todas tus inversiones, cada bróker muestra su última lectura aplicada,
importación CSV o cambio manual. Las cotizaciones tienen una fecha global separada. Se muestran
día, mes, año y hora en Madrid, con los formateadores de fecha existentes y los tres idiomas.
Una fecha ausente, inválida o futura se muestra como «Fecha no disponible»; no se reconstruye
con el guardado de la cartera, las cotizaciones ni el reloj actual.

Las tarjetas de MyInvestor y Trade Republic guardan `lastMiSync` / `lastTrSync` solo al aplicar
la previsualización, usando la hora de la respuesta válida. Cancelar no modifica el sello. App
ya guardaba esos campos al sincronizar: ese transporte permanece intacto. Revolut guarda
`lastRevolutImport` al aplicar el CSV; la etiqueta dice importación porque no acredita cuándo
se generó el extracto. `manualUpdatedAt` permite distinguir el último cambio manual del mismo
bróker, incluida una venta parcial. Es la última acción del origen, no una garantía de que
todas sus posiciones se hayan actualizado juntas. No se añaden sincronizaciones ni keepalive.

## Verificación y límites

- Ensamblado oficial, sintaxis, traducciones, mapa de tests, privacidad, seguridad, parsers Revolut
  y `broker-sync-outcomes`: exit 0 en la verificación local focal, repetida sobre beta124.
- `investment-data-date`: siete casos, también con proceso en UTC, Madrid y Canarias. Incluye
  medianoche y cambios de hora de marzo/octubre. Registrado en `scripts/run-tests.mjs`.
- Comparación A/B de los callbacks `apply` reales frente al SHA base: doce escenarios con
  cantidades, costes ausentes, ceros, divisas, efectivo y altas iguales al retirar solo los sellos.
- Siete mutantes propios eliminados. El primer intento de usar precios como fecha para un
  bróker personalizado sobrevivió; se añadió su caso y se verificó que falla. Evidencia original
  conservada junto a la final.
- DOM preparado en `cartera-inversiones` (tres idiomas, tres orígenes, aplicación/cancelación,
  persistencia y edición manual) y `revolut-csv-import`. Ambos están en el mapa de 05 y 06.
  **No ejecutado localmente**: el runner pesado sigue reservado por otro titular.
- Tamaño sobre beta124 medido con la reserva sintética oficial: **1.384.507 B minificado /
  1.383.424 B de límite**, exceso 1.083 B; **380.197 B gzip / 379.904 B**, exceso 293 B;
  tres recursos bloqueantes. Exit 1 del
  guardián, sin modificarlo. La integración debe resolver ese exceso y volver a validar el SHA
  resultante. No se atribuye un verde completo a los controles focales.
- `docs-frescura` sale con exit 1 por los tres módulos modificados tras el ancla versionada:
  VERSION y notas se mantienen fuera de este encargo. El coordinador confirmó que ambos rojos
  son de integración; el autor no modifica esos guardianes.

La primera CI, sobre `6cd3b4af` y beta123, terminó en FAILURE: [run 38379719665](https://github.com/JuanjoAvila/Aely/actions/runs/38379719665).
Pasaron los siete casos nuevos y las siete suites Deno; solo fallaron `docs-frescura` y
`presupuesto-rendimiento`. E2E y rendimiento no se ejecutaron; el paso independiente de privacidad
quedó omitido. Su log completo se conserva. Esa ejecución no acredita la cabeza rebasada.

El estado de CI remota de la cabeza rebasada se registra en la PR y en el resultado canónico.
Esta documentación describe la preparación; no acredita publicación, DOM ni aceptación móvil.

## Superficies para integración

`01-i18n.js`, `05-dialogs-inv.js`, `06-sync-brokers.js`, sus generados oficiales, los dos specs,
`investment-data-date.test.mjs`, runner/mapa y documentación. `11-app-main.js` no cambia porque
sus sellos ya existían. El contrato119 de cursor/ACK/keepsCursor permanece intacto.
