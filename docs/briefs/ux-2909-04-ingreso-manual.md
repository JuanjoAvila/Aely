# UX-2909-04 · revisión de ingresos manuales coincidentes

Estado: candidata local para PR borrador, bloqueada por tamaño minificado. No integrada,
publicada ni aceptada en móvil. Base exacta `a9916c3cdb21c93f9d3a47653c0608e630ce50ab`.
GO causal de Claude `5267ceb4005ecb98b37da2f8e4efbb280fb85c33`: solo la propuesta A.
La antigüedad de datos y los textos de sincronización (B) esperan UX-15/PR244.

## Causa y comportamiento

`importObExpenses` solo buscaba otro origen cuando el comercio bancario era genérico.
Un manual «Nomina manual» y un BOOK «NOMINA EMPRESA SINTETICA», del mismo banco,
importe y día, se contaban como dos ingresos sin ofrecer revisión. El ROJO causal sobre
la base exacta dio EXIT1: ingreso contado de 360000 céntimos frente a 180000 del control
que cambiaba únicamente el nombre bancario a «Movimiento». Repetir la referencia no
duplicaba otra vez. Son cifras sintéticas; no reproduce ni explica el negativo familiar original.

La candidata conserva ambos apuntes y marca la fila bancaria `possibleDup`. Solo enlaza
un ingreso BOOK de categoría ingreso con un ingreso manual del mismo banco y céntimo,
dentro de la ventana existente de tres días, cuando ambos tienen una única pareja.
Varias opciones manuales o varias referencias bancarias competidoras dejan la fila pendiente
sin `possibleDupOf`. Los bancos ya presentes y el genérico legado sin estado también
impiden atribuir unilateralmente el manual a otro ingreso nuevo. Los manuales reclamados
o borrados no se reutilizan. No se repara retrospectivamente el histórico.

La revisión usa la ficha existente: «Es el mismo» o «Son distintos». No borra por parecido,
no oculta como gemelo automático y no cambia los gastos/avisos de nombre real. La marca
`#dup` existente conserva la exclusión de saldo y presupuesto, también en su viaje a la nube.
Una coincidencia exacta de nombre y timestamp reserva un milisegundo libre para conservar
la fila bancaria frente a la restricción única de la tabla; no cambia el día ni el ordinal.
No hay cambios de SDK, SQL, Edge ni formato de `source`.

## Evidencia ejecutada

| Comprobación focal | Resultado |
|---|---|
| Build y sintaxis del artefacto ensamblado | EXIT0 |
| `manual-income-review` | 15 casos en UTC y 15 en Europe/Madrid, EXIT0 |
| Mutantes off, ambiguous, book, window, bank, cents, counted, automatic | 8/8 muertos, cada comando EXIT1 por aserciones |
| `ob-ingresos`, `tr-open-banking`, `month-budget-stats` | EXIT0 |
| `relevant-tests`, `security`, `git diff --check` | EXIT0 |
| DOM dirigido: mismo, distintos, ambiguo | 3 PASS, un worker, cero reintentos, puerto48544 |
| `presupuesto-rendimiento` | EXIT1: minificado por encima del tope |

El test nuevo está en `scripts/run-tests.mjs`; el DOM se añade al spec de nóminas ya registrado.
El DOM usa cliente cloud simulado y la acción real de sincronizar bancos; no consulta proveedores.
Se conserva el primer fallo del guion aprobado: no cerraba el resumen de sincronización antes
de pulsar Gastos (timeout, un fallo y dos no ejecutados). Tras corregir esa interacción se ejecutó
la nueva versión del guion, sin retries de Playwright. La investigación anterior conserva además
un timeout de splash por reloj fijo del arnés; ese intento no acredita el recorrido de pantalla.

## Bloqueo de integración

Medición con esbuild0.25.5, opciones oficiales, reserva de configuración sintética y sello
`4.26.137.99999`; gzip nivel9. El A/B de base reconstruye el artefacto original y coteja su SHA256
`5d67b5b11eeac0862208941637e76217003bb8223dfb814d338f24db91e04a58`.

| | Base | Candidata | Tope conservado |
|---|---:|---:|---:|
| Minificado, bytes | 1328813 | 1330945 | 1329152 |
| Gzip, bytes | 369003 | 369438 | 369664 |
| Cargas bloqueantes | 3 | 3 | 3 |

Delta: +2132 bytes minificados y +435 gzip. Exceso minificado: **1793 bytes**.
Los topes y oráculos permanecen intactos. No se atribuye verde general, de integración ni CI.
VERSION, catálogo y notas de versión se conservan para la integración del coordinador.
Los artefactos generados de la prueba se preservan fuera de la PR; CI debe ensamblar desde fuente.
Sin suite completa, CPU6, Gradle, despliegue, SQL vivo, bancos reales ni aceptación móvil.
La hoja y el módulo de Deudas/Metas permanecen intactos.
