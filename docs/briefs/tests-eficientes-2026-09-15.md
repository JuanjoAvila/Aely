# Tests más rápidos sin reducir cobertura

Petición del dueño: 15/9/2026. Rama `codex/tests-eficientes`, preparada sobre `f30fe208`
para conservar el arreglo de consultas concurrentes del fixture de Claude. Integrada en commits
separados sobre fd31aa20 junto a bancos, categorías y ayuda; pendiente pareja completa final.

## Medición y cambios

- `dismissNews` espera hasta 4000 ms incluso cuando el fixture sembró la versión como vista.
  Hay 90 puntos de llamada directos en la base analizada. Solo el helper del panel de beta tiene
  20 llamadas: 80 s nominales de espera máxima repetida. Son conteos de código, no tiempos A/B.
- Salida por condición: valor inicialmente sembrado, versión base real del navegador, valor
  actual de almacenamiento y ausencia de panel. No confundir el sello que escribe la app al
  disparar el aviso con el valor que sembró el test. Si hay duda, se conserva la espera de 4 s.
- Guardianes: versión `dev`, beta con sufijo, popup tardío y ausencia de garantía del fixture.
  Se adelantan los timers de la app para comprobar que no aparece un aviso después del helper.
- El runner registra duración total y por etapa; el reporter JSON de Playwright registra cada
  intento. No se cambian casos, idiomas, timeouts de producción ni selección de pruebas.

## A/B ejecutado

Mismo bundle `f30fe208`, mismos tres specs (`ajustes-importaciones`, `bancos-historico-filtro`,
`gastos-cabecera-bancos`), Chromium/Edge, Europe/Madrid y un trabajador. Sin otro navegador.
Solo se alternó el fixture original y el optimizado, restaurando este último al acabar.

| Resultado | Antes | Después |
|---|---:|---:|
| Casos correctos | 9 | 9 |
| Fallos / omitidos / reintentos inestables | 0 / 0 / 0 | 0 / 0 / 0 |
| Duración del reporter | 46,094 s | 12,373 s |

Ahorro observado: 33,721 s, **73,2 %** en este grupo. No extrapolar ese porcentaje a toda la
suite: no todos los tests llaman a este helper. Guardianes nuevos: **4/4, EXIT 0, 7,1 s**,
incluyendo el montaje tardío y el sufijo de beta. Runner de tiempos: tres etapas reales,
salida 0 e informe JSON correcto.

Integración final `1336fcb8`: `npm test` **EXIT 0 en Europe/Madrid y UTC**, 225,263 s y
225,276 s respectivamente. En cada pasada: Node + Deno verdes, **298 E2E correctos, una captura
ya omitida, cero fallos y cero flaky**. El JSON combinado contiene los 299 casos: 292 funcionales
(uno omitido) y siete de rendimiento. No comparar estos tiempos completos con el A/B de nueve
casos ni con la primera suite en Edge, que tenía otro navegador y menos casos.

La primera completa integrada detectó una carrera en `bancos-lista-fresca`: el doble cambiaba
de respuesta por número de consultas, contando también la de Ajustes. Comparación aislada
con el mismo bundle: fixture antiguo PASS, optimizado FAIL (Caixa aparecía antes de conectar).
El doble ahora cambia al simular la conexión, conservando la comprobación DOM antes/después
del evento. No se recupera la espera accidental ni se reduce la cobertura.

Mutación ejecutada: retirar temporalmente el listener `mc-bank-links-changed` de BankPanel
hace fallar el test con una fila en lugar de dos (EXIT 1); fuente y bundle restaurados después.
La suite integrada también detectó competencia de CPU: scroll→swipe dio 108/109 ms en dos
completas de cuatro trabajadores y pasó aislado. El runner separa los dos specs `rendimiento*`
al final, con un trabajador; funcionales en paralelo, mismos casos y umbrales. Conserva informes
por fase y uno combinado, sin que la limpieza de una ejecución borre las trazas de la otra.

Acuerdo de integración con Claude: commit de tooling separado encima de bancos 4.25.0, tras
4.24.2 y 4.24.3. Una pareja completa Madrid/UTC valida el árbol final; no se repite antes otra
batería completa de tooling por separado. Si algo falla, comparar ese spec con/sin el commit
de tooling en un checkout temporal antes de atribuirlo al cambio bancario.

## CI: propuesta posterior, sin cambios de workflows

`test.yml` y el job `test` de `deploy.yml` repiten la suite en un push a main. Eliminar una
ejecución requiere mantener el bloqueo del despliegue por el resultado del mismo commit y
preservar Deno, actualmente instalado en `test.yml` pero ausente en el job de `deploy.yml`.
También hay que revisar los checks requeridos y el promote manual vigente. Coordinar después
de las publicaciones 4.24.x pendientes; no cambiar este circuito en medio de una promoción.
