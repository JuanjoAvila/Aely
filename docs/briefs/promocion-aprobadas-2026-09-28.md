# Promoción selectiva de las tandas aprobadas · 28/9/2026

El dueño aprobó expresamente todas las tandas pendientes tras probar el pago y la corrección de Inicio. La beta efectiva era 4.26.65.1 (`8c64ced6`, Action 36460093258); producción seguía en 4.26.59 (`b72e3264`). `npm run listo` no pudo leer `app_events` en este worktree porque no está la clave local; la autorización procede del mensaje directo del dueño. La tanda `cuotas-deuda-crash-28sep` ya estaba publicada en 4.26.59 y no vuelve a promocionarse.

| ID de la beta | Versión | Alcance aprobado | Entrega en esta candidata |
|---|---:|---|---|
| `inicio-gastos-ciclo-28sep` | 4.26.61, corregida en .63 y .64 | Texto y cifras coherentes en Inicio/Gastos; nómina registrada antes de lo previsto | Web 4.26.65 |
| `saldo-nomina-adelantada-28sep` | 4.26.62 | Anclaje de saldo ante un único abono bancario confirmado | Web 4.26.65 |
| `presupuesto-ciclo-cobro-28sep` | 4.26.64 | Presupuesto opcional desde el cobro real | Web 4.26.65 |
| `ciclo-balance-ingresos-28sep` | 4.26.65 | Todos los ingresos reales posteriores del ciclo, incluido alquiler | Web 4.26.65 |
| `fin05-widget-reentrada` | 4.26.60 | Reentrada de la app y snapshot del widget | Permanece en beta: precisa el cliente y el nativo probado en APK51 |
| `fin05-pago-cerrada` | 4.26.60 | Gastado/Disponible tras pago real con app cerrada | Permanece en beta: la validación del pago ya existe, la entrega nativa es separada |
| `tr-descripcion-clasificacion` | 4.26.60 | Clasificación de entradas bancarias nuevas | Permanece en beta: agrupa cliente, fuente bancaria y receptor nativo |
| `widget-banco` | 4.26.60 | Selector de banco del widget | Permanece en beta: el widget nativo usa APK51 |
| `widget-app-cerrada` | 4.26.60 | Coherencia con la app cerrada | Permanece en beta: el widget nativo usa APK51 |

La candidata nace de `main` y aplica el delta web aprobado desde `6b298387..8c64ced6`. Conserva `.github/workflows/supabase.yml` de `main`, que solo permite un despliegue manual por función, y conserva `android/`, `supabase/` y `public/apk.json` de producción. La simulación de merge completo se descartó: arrastraba APK51 y una versión anterior del workflow que activaba despliegue automático y migraciones en cada push a `main`. No se ejecuta ningún despliegue Edge, SQL, migración ni publicación de APK.

`monthBudgetStats` usa la ventana de ciclo solo cuando se elige y reconoce la nómina; el widget sigue recibiendo el mes natural con fecha explícita. El helper de lápidas de la beta se porta porque el cálculo del ciclo lo necesita. Las pruebas sintéticas de Inicio/Gastos/Plan pasan 37/37 en Chromium y `month-budget-stats`/`plan-charges` pasan. El bundle minificado mide 1.251.769 B y 341.039 B gzip; los límites se ajustan a 1223/334 KiB con menos de 1 KiB de margen.

## Entrega web comprobada

[PR 58](https://github.com/JuanjoAvila/Aely/pull/58): candidato exacto `66cc087e78249e7cf783a5c9cc3aa4e253a00254`, revisión real Claude **GO** sobre ese SHA tras corregir las notas en es/en/ca, [CI 36471609922](https://github.com/JuanjoAvila/Aely/actions/runs/36471609922) SUCCESS. Merge exclusivo `98628bd6579c6d06cb5ce65aaf9f43cc39bc0f4b`; [Pages 36473059772](https://github.com/JuanjoAvila/Aely/actions/runs/36473059772) SUCCESS. Sobre el merge pasan `test:syntax` y `docs-frescura`; el diff de árboles `main`↔`beta` se inspeccionó y conserva separados Android, Edge y el workflow Supabase. No se inició ningún workflow Supabase por esta fusión.

HTTP del 28/9, 19:45 UTC: `version.json` sirve **4.26.65** y apunta a `bundle.zip`; `sw.js` declara `4.26.65-2026-09-28-98628bd`; `index.html` incluye 4.26.65; primera nota 4.26.65 con `tandas:[]`. Se descargó el ZIP OTA de 873.182 B, SHA-256 `5cfb3b27f6c2892a1c9223a0553c13889a362204ac2382a9a3262b3a5b911fa3`; sus `index.html`, `sw.js`, `release-notes.json` y `apk.json` son idénticos byte a byte a los servidos por Pages. `apk.json` sigue anunciando code 48 / 4.26.32. `npm run salud` confirma web 4.26.65 y APK estable 48.

Después de esa entrega, el dueño aportó capturas privadas con una incoherencia nueva del texto de Inicio al activar «Mi ciclo» y pidió poder ocultar la explicación persistente en Gastos. Se registraron como [INC-2809-01 e INC-2809-02](../BACKLOG.md), sin copiar las capturas ni los importes al repo público. La aprobación anterior no acredita esos síntomas nuevos; cada corrección seguirá beta y prueba móvil propias.

## Continuidad beta comprobada

[PR 59](https://github.com/JuanjoAvila/Aely/pull/59) fusionó el commit único `0617574e46a906a38b0c012852afede512c7f78f` sobre beta como `9ed9f17b53bc66786d6c8dd4873b4aaeed911903`. `docs-frescura` pasó en el SHA commiteado; 31/31 E2E del panel pasaron localmente y la [Action beta 36473486887](https://github.com/JuanjoAvila/Aely/actions/runs/36473486887) terminó SUCCESS con su plan de tests, empaquetado y publicación. La release `beta` sirve **4.26.66.1**, fuente `edb4377179294b86`, SW `4.26.66.1-2026-09-28-9ed9f17` y ZIP de 877.213 B, SHA-256 `2502d9a05378076e0f5836c4aca26998afe90536308c530196b7bb50c4055217`.

Del ZIP se comprobaron la versión del HTML, la primera nota 4.26.66 y sus cinco IDs pendientes exactos: `fin05-widget-reentrada`, `fin05-pago-cerrada`, `tr-descripcion-clasificacion`, `widget-banco` y `widget-app-cerrada`. Las entradas aprobadas 4.26.61, .62, .64 y .65 llevan `tandas:[]`; la nota .63 de una pantalla descartada no se publica. El `apk.json` del ZIP es idéntico al de la release beta y anuncia code 51. **Esa APK no se promovió a producción**; la estable sigue en code 48.

Límites: la prueba del pago no prueba por sí sola todos los caminos de identidad y saldos de FIN-05. No se atribuye a Pages el comportamiento nativo de APK51 ni se repara historial real. La comprobación de cargos CaixaBank ausentes (INC-2709-06) sigue siendo un objetivo independiente.
