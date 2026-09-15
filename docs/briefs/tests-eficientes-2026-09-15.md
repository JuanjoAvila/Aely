# Tests más rápidos sin reducir cobertura

Petición del dueño: 15/9/2026. Rama `codex/tests-eficientes`, preparada sobre `f30fe208`
para conservar el arreglo de consultas concurrentes del fixture de Claude. Todavía no integrada.

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
salida 0 e informe JSON correcto. Pasada completa optimizada: pendiente.

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
