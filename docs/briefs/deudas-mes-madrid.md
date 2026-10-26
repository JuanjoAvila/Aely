# Deudas: mes de finalización en Madrid

La tarjeta de deuda y el asesor de amortización partían del mes local del dispositivo. En la frontera de octubre/noviembre podían adelantar o atrasar un mes la previsión respecto a Madrid.

Ambos textos toman año y mes de madridYmdParts(Date.now()) antes de sumar las cuotas restantes. La suma conserva el paso de año y el nombre localizado. El cálculo de saldo, cuotas restantes, amortización y fechas almacenadas permanece intacto.

## Regresión

- Los Ángeles: 2026-10-31T23:30:00Z es noviembre en Madrid y octubre local.
- Tokio: 2026-10-31T16:30:00Z es octubre en Madrid y noviembre local.
- Calendarios esperados explícitos para +12 y +7 meses, ambos en 2027, independientes de la implementación.
- 12 contratos Node y 12 casos DOM cubren tarjeta y asesor en es/en/ca. El asesor comprueba fecha nueva, anterior y cinco cuotas ahorradas; el DOM comprueba 12 cuotas restantes, saldo sintético de 1200 euros y persistencia intacta.
- Antes del arreglo fallaron los cuatro casos causales de cada nivel (dos zonas por dos rutas) por el mes local. Después pasan los 24 casos, sintaxis y registro de pruebas.

Guardianes: tests/deudas-mes-madrid.test.mjs registrado en scripts/run-tests.mjs; e2e/deudas-mes-madrid.spec.mjs registrado bajo el módulo 09 en scripts/relevant-tests.mjs. Pruebas sintéticas; revisión, integración y aceptación móvil conservan sus pasos propios.
