# INC1710: contrato de escritores del fallback de recarga

El job `tests` de beta172 (run `40198407993`) falló en
`e2e/inc1710-reload-fallback-delay.spec.mjs`: el caso de recarga cancelada esperaba
33 escritores y recibía 34. La reproducción sobre
`d30dc4016726fa1818449039debf4bd8148e3021` falla en esa misma aserción;
los 34 resultados recibidos tienen `blocked: true`.

La causa es el recuento fijo del test: el commit
`be82acb491f44ed9ca99447a1352f6cae6468b9a` añadió `setExpenseMeta` y lo incluyó
correctamente en `CLOUD_WRITES`. Las bases beta171
(`ede7c3c4e879c3e712d0dece53099422331b4155`) y beta170
(`c670f7ddd5f5fd6351f506741e20f296654659eb`) conservan 33 escritores y pasan
los dos casos originales de recarga cancelada. El fallo de cardinalidad se
produce antes de comprobar el fallback: no acredita una fuga de escritura ni
atribuye una regresión a `metaPend`, `cloudEffectState` o Gastos.

Se actualiza el contrato explícito a 34 y se exige la presencia de
`setExpenseMeta`, además de `renameExpense`. Se sigue invocando cada método de
`CLOUD_WRITES` y exigiendo que todos devuelvan el bloqueo. No se cambia el registro,
el producto, la guarda de transición, `windowGuard` ni el marcador de semilla.
Tampoco se cambia el reloj: a 1799 ms no debe haber aviso ni marca, a 1800 ms debe
haber exactamente una, y la recarga posterior debe completar el cambio de modo.

Validación sintética local, en serie, CPU sin freno, un worker, cero reintentos y
`maxFailures=1`, con censo, admisión y puerto exclusivo por corrida:

| Fuente | Selección | Resultado del proceso de pruebas |
| --- | --- | --- |
| beta172 original | `--grep=canceled` | EXIT1: 1 fallo por 33 frente a 34; el segundo caso no se ejecutó por stop-first-failure |
| beta171 original | `--grep=canceled` | EXIT0: 2/2 |
| beta170 original | `--grep=canceled` | EXIT0: 2/2 |
| beta172 con este ajuste | spec completo | EXIT0: 3/3 |

El HTML ensamblado y el servido coinciden por SHA256 en cada corrida. Las fuentes
de producto permanecen iguales antes y después; cada corrida cierra su servidor
y devuelve el recurso. Las pruebas conservan sus registros originales, sin
limpiarlos para obtener el verde. La fixture intercepta la red externa y simula el
cliente; esto no acredita CI, integración, beta servida ni aceptación móvil.
