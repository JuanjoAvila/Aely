# Saldo de cuenta al cerrar por atrás

18/10/2026. Candidata sobre `503d23267091eb5aa0b0e37dd94fac20ea37bd08`, con GO de Claude
`6ab6606c6c153f06eecc1ae6ff60e39753a9f7dc`. Verificación local dirigida; integración, CI,
publicación y aceptación móvil pendientes. No es ProductREADY.

## Causa y cambio

`AccountSheet` ya conserva el importe escrito, la cuenta y el permiso de edición en refs.
Sin embargo, `useBackClose` conserva el callback de apertura: su `onSaldo` usa los totales
que tenía `Patrimonio` entonces. Un gasto recibido con la ficha abierta deja obsoleta la
conversión del saldo mostrado a su base. El cierre por atrás también desmontaba directamente,
sin pasar por la animación que sí usa el arrastre.

Una ref local mantiene `cerrar` vigente; el callback final de `useSheetSwipe` consulta esa ref
al terminar la salida. Atrás registra `swipe.close`. Así se usa el guardado actual incluso
si entra un gasto durante los 300 ms de animación. Se conservan las refs financieras, los
guards de cuenta conectada/borrador vacío y la fórmula de conversión. `useBackClose` global
no cambia. El cierre por fondo conserva su comportamiento previo.

## ROJO y controles de base

Fixture sintética de efectivo, base inicial 50,00 €, borrador 12,34 €, gasto recibido 0,07 €.
La base correcta al guardar es **12,41 €** y el saldo mostrado debe ser **12,34 €**.

| Cierre en fuente base | Base persistida | Mostrado al reabrir | Animación |
| --- | ---: | ---: | --- |
| Atrás nativo simulado | 12,34 € | 12,27 € | No |
| Fondo | 12,41 € | 12,34 € | No, como antes |
| Arrastre CDP real | 12,41 € | 12,34 € | Sí |

La sonda de los siete casos restantes terminó EXIT1 por el ROJO esperado; sin fallos inesperados.
Pasaron los controles de céntimo negativo, arrastre sin gasto, vacío y conectada. El gesto
aterrizó en la hoja; se registraron transformaciones reales hasta `110%` y transición de 300 ms.

## Regresión y validación

`e2e/cartera-saldo-atras.spec.mjs`, registrado en el mapa de `07-tab-patri-fijos.js`:

- Atrás nativo y navegador con gasto antes del cierre.
- Atrás nativo y arrastre CDP con gasto durante la salida, comprobando que la misma hoja sigue
  conectada y que la salida ha empezado antes de insertar el gasto.
- Saldo negativo de un céntimo, borrador vacío, cuenta conectada y movimiento reducido.
- DOM y persistencia natural se comprueban por separado, con céntimos enteros, sin forzar flush.

Ocho casos únicos verdes en dos tramos: 3 y 5, un worker y cero reintentos. El primer tramo
se detuvo en el gesto de arrastre; NumPad había desplazado el contenido. La sonda se corrigió
para mostrar el asa antes del arrastre y se ejecutaron sólo ese caso y los cuatro pendientes.
Producto sin cambios entre ambos tramos. El fallo queda conservado como límite del arnés.

Dos mutantes focales muertos (EXIT1 esperado): callback final que captura `cerrar` en vez de
leer su ref (muestra 12,27 €), y atrás directo a `cerrar` (sin animación). Tras las mutaciones
se restauraron exactamente los bytes de fuente y artefactos previamente verificados.
Build, sintaxis de siete bloques y guardián del mapa de pruebas: EXIT0.

## Límites y evidencia preservada

Antes de la sonda causal hubo dos fallos del arnés: import ESM Windows inválido (EXIT1, cero
casos) y lectura de disco antes del debounce de 400 ms (sonda EXIT2, wrapper EXIT1). Ninguno
se presenta como ROJO financiero. La regla `bc1c5e1d` permitió corregir esos problemas propios
sin cambiar producto ni oráculos. Los fallos, ejecuciones, hashes y censos quedan en el
manifiesto privado del titular.

No se ejecutaron suite completa, CPU6, Gradle, APK, bancos reales, SQL vivo ni despliegues.
Los callbacks nativos son dobles de Capacitor: Chromium/CDP no acredita aceptación Android.
VERSION, catálogo fuente, caps y oráculos ajenos permanecen intactos. El metadato generado
`beta-delivery.json` se conserva en su versión base; el coordinador deberá reconciliarlo al
integrar, sin que esta candidata atribuya aprobación a una huella nueva.
