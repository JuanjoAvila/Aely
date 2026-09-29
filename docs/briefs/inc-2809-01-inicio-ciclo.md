# INC-2809-01 · Inicio y presupuesto por ciclo · 28/9/2026

## Hallazgo reproducido

Base `origin/beta` `9ed9f17b53bc66786d6c8dd4873b4aaeed911903` (4.26.66). En el ciclo, `monthBudgetStats` calcula `against = spent − income` y `remaining = budget − against`. Gastos usa esas dos cifras en su barra y disponible; el anillo de Inicio usa `against`, pero la frase «Has gastado» mostraba `spent`. Con datos **sintéticos** de 1.450 € de gasto, 470 € de ingreso posterior y 1.000 € de presupuesto, Inicio podía enseñar 98 % junto a «Has gastado 1.450 € de tus 1.000 €», mientras Gastos enseñaba 980 € netos y 20 € disponibles.

El pie «Tu primer mes empieza hoy» procedía de `budgetStreak.current === 0`, que solo dice que no hay una racha de meses cerrados. No demuestra que hoy sea el primer día ni que no haya actividad. Los movimientos visibles del mismo mes lo desmentían.

## Corrección candidata 4.26.67

Inicio muestra «Gasto neto desde el cobro» con céntimos y el disponible o exceso calculado del mismo `against` que el anillo y Gastos. El mes natural conserva su frase de gasto bruto y su proyección diaria. El pie con racha cero dice «Mes en curso»; el ciclo muestra «Mi ciclo» en el mismo lugar. `monthBudgetStats`, los movimientos, el widget y la APK no cambian. Si no se reconoce una nómina reciente, el ajuste sigue usando el mes natural como antes.

El E2E en `e2e/presupuesto-fluido.spec.mjs` abre Inicio y Gastos con presupuesto por ciclo encendido y apagado en es/en/ca. Comprueba DOM, porcentaje, neto, disponible, gasto bruto mensual, actividad anterior al cobro, ingreso posterior de otro banco, ingreso superior al gasto y exceso del límite. **16/16** pasaron en Chromium móvil local. `test:syntax`, `i18n-keys`, `docs-frescura`, `month-budget-stats` y `presupuesto-rendimiento` pasaron. Bundle medido: 1.254.894 B minificados y 342.031 B gzip; se amplió el tope gzip 1 KiB (15 B de exceso sobre el anterior). `npm test` local solo falla por `memoria-espejo`: ocho espejos de la memoria local de Claude ya difieren de este checkout; son archivos ajenos a INC-2809-01. Deno no está instalado localmente. CI de beta debe comprobar la suite en su entorno.

## Beta publicada y aprobación

PR [#60](https://github.com/JuanjoAvila/Aely/pull/60) quedó fusionada en beta como `e561cc2d`. La primera CI completa de `a95ab8c1` ([36479551932](https://github.com/JuanjoAvila/Aely/actions/runs/36479551932)) falló por dos aserciones que exigían el texto antiguo «Tu primer mes empieza hoy». Se actualizaron en `383c0120`: 14/14 pruebas E2E afectadas pasaron localmente. La [Action beta 36481177084](https://github.com/JuanjoAvila/Aely/actions/runs/36481177084) terminó SUCCESS y publicó 4.26.67.1; ejecutó el plan relevante, **no** la suite completa. El dueño dijo expresamente «está todo aprobado» en el chat de INC-2809-01 el 29/9 y autorizó la promoción a producción. Esa aprobación incluye esta tanda por ID y contenido; no sustituye los criterios nativos independientes de las otras cinco.

## Candidata exclusiva para producción

Base `main` `9734cfca64424f144b662082c7c4cf27a5d72383` (web 4.26.65). Versión web 4.26.66. Se portan las líneas de Inicio, los textos es/en/ca y los E2E de `a95ab8c1`, más las dos expectativas corregidas por `383c0120`. La nota 4.26.66 lleva `tandas:[]`; `android/`, `supabase/`, `.github/workflows/supabase.yml` y `public/apk.json` quedan idénticos a main. Las cinco tandas de APK51 permanecen en beta hasta entrega propia. En el árbol selectivo el test de presupuesto sigue bajo los topes actuales sin ampliar el límite gzip.

## Publicación comprobada · 29/9

PR [#61](https://github.com/JuanjoAvila/Aely/pull/61) integró el candidato web selectivo `38dd59dcb92b64d4b6998756716c7486b6e35a11`. Claude 5.5 Opus emitió **GO** real sobre ese SHA por el canal del equipo (`20260929T1725Z-claude-inc2809-prod-go`), tras 30/30 E2E propios en UTC, build y lectura del diff; su `npm test` local solo falló por `memoria-espejo` preexistente. La [CI completa 36601623318](https://github.com/JuanjoAvila/Aely/actions/runs/36601623318) terminó SUCCESS: 467 E2E funcionales, 7 de rendimiento, Deno y privacidad. Merge `085a6f663c84c944c19f05d488958e7a2b83cf50`, árbol `cb7469b7a3499b8c3a95cb6724c2b68628bb5920` idéntico al SHA revisado. `android/`, `supabase/`, `.github/workflows/supabase.yml` y `public/apk.json` son idénticos a main anterior.

[CI main 36603620897](https://github.com/JuanjoAvila/Aely/actions/runs/36603620897) y [Pages 36603620774](https://github.com/JuanjoAvila/Aely/actions/runs/36603620774) SUCCESS. HTTP sirvió `version.json` **4.26.66**, ZIP SHA-256 `4aa4982fe90a42a69556408558faf3ceeec3661fbec5fe916b96bd674b4c6f14`, HTML 4.26.66 y SW `4.26.66-2026-09-29-085a6f6`. `index.html`, `sw.js`, `release-notes.json` y `apk.json` del ZIP coincidieron byte a byte con Pages; primera nota 4.26.66 lleva `tandas:[]`. APK estable sigue en 4.26.32/code 48. `npm run salud` confirmó producción 4.26.66 y APK HTTP 200.

PR [#62](https://github.com/JuanjoAvila/Aely/pull/62) fusionó la continuidad beta `a001c202ba629b1db7e430eb86ae88163560d4b5`: solo `inc-2809-01-inicio-ciclo` sale del panel. Los cinco guiones de APK51 se trasladan intactos a la nota 4.26.67, posterior a la versión de producción, para que el panel siga mostrándolos. `e2e/revisar-beta.spec.mjs` pasó 31/31 en Chromium. [Action beta 36606082260](https://github.com/JuanjoAvila/Aely/actions/runs/36606082260) SUCCESS; HTTP sirvió **4.26.67.2**, huella `e7df0acfa530ec46`, ZIP SHA-256 `c0592f5af1929c9640d27aec1997dfe2676ff029c80884360062f9ae1b0cef6e` y SW `4.26.67.2-2026-09-29-a001c20`. El ZIP lleva los cinco guiones originales sin cambios y ninguno de INC-2809-01; su `apk.json` coincide con el asset beta separado y anuncia APK 4.26.55/code 51. La nota familiar de INC-2809-01 continúa en Novedades.

Claude señaló un riesgo menor sin bloqueo: si los ingresos del ciclo superan al gasto, «Gasto neto» muestra una cifra negativa coherente con Gastos pero poco natural de leer. No se altera el cálculo en esta tanda.
