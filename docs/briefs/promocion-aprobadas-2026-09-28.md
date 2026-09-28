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

`monthBudgetStats` usa la ventana de ciclo solo cuando se elige y reconoce la nómina; el widget sigue recibiendo el mes natural con fecha explícita. El helper de lápidas de la beta se porta porque el cálculo del ciclo lo necesita. Las pruebas sintéticas de Inicio/Gastos/Plan pasan 37/37 en Chromium y `month-budget-stats`/`plan-charges` pasan. El bundle minificado mide 1.251.769 B y 341.039 B gzip; los límites se ajustan a 1223/334 KiB con menos de 1 KiB de margen. La revisión del SHA final, CI, publicación Pages y comprobación del panel beta se registran al completarse.

Límites: la prueba del pago no prueba por sí sola todos los caminos de identidad y saldos de FIN-05. No se atribuye a Pages el comportamiento nativo de APK51 ni se repara historial real. La comprobación de cargos CaixaBank ausentes (INC-2709-06) sigue siendo un objetivo independiente.
