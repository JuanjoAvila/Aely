# B09-D: correcciones acotadas de reactivación y categorías — 8/9/2026

Complemento al diagnóstico/relevo de la PR #30. Base `c37be5ee`, trabajo aislado en
`codex/widget-resume-categorias`; Claude integra y unifica versión con sus otras ramas.
**4.19.6 es la versión preparada de esta rama, no una afirmación de publicación.**

## Lo que se ha demostrado

- Consulta privada, solo lectura: el cálculo sobre las filas conservadas en nube, excluyendo
  altas posteriores al momento aproximado de la captura, reproduce al redondear la cifra del widget.
  Main y beta dan el mismo resultado en ese conjunto: la ventana del mes no explica esta captura.
  No se escribieron datos remotos ni se guardaron extractos/capturas en el repositorio.
- El dueño confirma en este chat que abrir la app y volver al launcher NO iguala las cifras.
  Otro veredicto de la tarde, referido por Cursor, describe que sí se igualan al entrar: conservar
  ambas observaciones como ejecuciones distintas; no desechar una para encajar el diagnóstico.
- Edge real, viewport Pixel 5 y puente Android simulado: app/widget=40; el escritor servidor
  simulado cambia widget a 70; volver solo por `App.appStateChange` lo dejaba en 70. Emitir
  `visibilitychange` lo devolvía a 40. La regresión reproduce exactamente ese camino perdido.
- Al recuperar filas, `resolveCategory` convertía inversión/traspaso en categorías ordinarias
  porque las especiales están fuera de `CAT`. E2E con filas de nube: Inicio enseñaba 320 en vez
  de 20; después del fix enseña 20 y Gastos marca ambas filas neutras como no computables.

## Entrega

Se preservan las categorías especiales y se añade la reactivación nativa al efecto del widget,
incluyendo limpieza de listeners que se registran mediante promesa. No se introduce sincronización
OB ni se altera el cálculo del presupuesto. Se añaden dos E2E a `persistencia` (ya CROSSCUTTING)
y un roundtrip por `expenseFromRow` al test de paridad con servidor.

Antes del fix: dos E2E y la nueva regresión de paridad fallan. Después: pasan. Build, sintaxis,
categorías, widget-coherente, mapa de pruebas, docs-frescura y privacidad correctos.
`npm test` local: único fallo reportado `memoria-espejo`, por espejo ajeno desfasado; Deno no
instalado y omitido. Por ello no se declara suite completa local verde ni se regenera memoria.
La suite completa en GitHub **sí pasó**, con Deno, E2E y privacidad, para `fc80bf39`:
[ejecución 34250021090](https://github.com/JuanjoAvila/Mi-Cartera/actions/runs/34250021090).

## Límites y revisión de Claude

- Esto no resuelve que las decisiones `possibleDup` no lleguen al servidor, ni la identidad
  débil, ni respuestas tardías de ingest que sobrescriban un snapshot más nuevo.
- No se ha recuperado el array local del móvil: el total exacto de Inicio y toda la diferencia
  entre capturas siguen sin reconstruirse. No afirmar que la cifra de la app sea la correcta.
- No reescribir categorías históricas ya dañadas; recuperar datos requiere evidencia individual.
- El prefijo propuesto por Claude `ob-dup:` NO es compatible automáticamente con lectores/ingest
  antiguos: banco desconocido cae como manual y cuenta. Cambiar `source` evita una columna nueva,
  pero NO evita despliegue del servidor compartido, permisos de producción ni pruebas de compatibilidad.
  El upsert que ignora duplicados tampoco actualiza una fila existente. Validar ambos puntos antes
  de presentar esa otra corrección como resuelta por OTA.

### Revisión posterior de la propuesta de Claude (`17169775`)

El sufijo alternativo `ob:trade_republic#dup` sí evita el problema concreto del prefijo:
el lector antiguo interpreta un banco fuera de la selección y lo excluye del presupuesto.
Eso no valida el protocolo de escritura. Ejecutando el bloque real de backfill de ese commit
con datos sintéticos se reprodujeron dos defectos, comunicados a Claude para corregir antes de integrar:

1. A confirma «son distintos» y la nube queda sin marca; B conserva `possibleDup=true`.
   El pull de B vuelve a enviar `setExpenseDup(e,true)` y deshace la decisión de A. Falta
   distinguir una fila antigua sin migrar de una decisión explícita resuelta. Probar dos clientes.
2. La clave débil encuentra la fila remota con UUID A, pero el local conserva UUID B tras
   `ignoreDuplicates`. El UPDATE recibe B y puede afectar cero filas sin error. Exigir confirmación
   de la fila afectada e identidad fiable; no sustituirlo por una búsqueda ambigua a ciegas.

El ida y vuelta del serializador no cubre estos casos. Si se aplaza el protocolo, separar el
backfill inseguro de esta entrega. **Las respuestas tardías de ingest siguen pendientes también
después de PR #31**; la reactivación nativa no arbitra los dos escritores del widget.

## Prueba móvil cuando se integre y publique

OTA, sin APK ni despliegue Supabase para estos dos cambios. Anunciar la versión publicada exacta
antes de pedir prueba. Abrir Inicio, volver al launcher y comprobar que el widget recibe su gasto
actual; anotar la hora. La siguiente notificación puede volver a revelar el defecto de ingest
pendiente: no prometer igualdad permanente con esta entrega. Para categorías usar datos de prueba
aislados/fixtures; no reinstalar ni borrar movimientos reales para validar el roundtrip.
