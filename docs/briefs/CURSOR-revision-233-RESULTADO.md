# Revisión independiente 4.26.233 · resultado (15/11/2026)

Rama `cursor/revision-233`, sobre `20ac544ca` (main de esta ronda; primer padre `5ceb117c0`, segundo `6148c0e04`). Solo lectura de producto: no hay commit de código, no se ha desplegado Edge ni se ha tocado producción.

**Sin P0.** Los tests de `bank-confirm` y `bank-callback` que se pidieron pasan. Un enlace que no es de quien confirma no se activa, y sin `confirm` el enlace sigue quedando activo como hasta ahora. El cliente (`src/modules/00-core.js`, `bankConnect`) no manda `confirm`.

## 1. Dinero — OK

`accountBalanceRows` (`src/modules/02-ui-shared.js:1077`) y la serie de `netWorthSeries` no cambian la cifra de un caso normal respecto a la 232.

Comparación de los dos bundles (`public/index.html` de esta rama y `git show 5ceb117c0:public/index.html`), dos bancos sintéticos, mismas filas de gastos:

- Dos cuentas con clave distinta: mismas filas de cierre y la misma serie, al céntimo.
- Cuenta sin identificador, cuenta de banco sin clave, divisa sin cambio, saldo nulo o no numérico: el cierre que se deja de guardar es el que la propia función documenta (no hay clave, la clave se repite, o el saldo no se sabe). Con la divisa sin cambio y con el saldo desconocido la serie de hoy sigue siendo un hueco en las dos versiones, porque el saldo vivo tampoco se puede pasar a euros.
- Dos cuentas de banco con la misma clave: no se guarda cierre de ninguna; la serie, que hoy usa el saldo vivo, sale igual que si se hubiera guardado el último.
- Deuda cambiada en el sitio (saldo y cuota) y un gasto nuevo: la serie de la 233 coincide con la de la 232 y con un sandbox en frío.
- Cambio de zona con las mismas filas y la caché de resultado vaciada (`Europe/Madrid`, `America/New_York`, `UTC`, `Asia/Tokyo`): la 233 coincide con la 232 en cada zona, y Nueva York no repite la serie de Madrid, así que la guardia de `src/modules/02-ui-shared.js:1350` sí se ejecuta.
- Mismo historial, función de la 232 contra función de la 233: 0 puntos distintos. Al revés, historial nuevo contra historial nuevo: 0 puntos distintos.

El único día que se mueve es un caso de la regla nueva, no de la caché: dos cuentas manuales con el mismo id. La función no diverge. Al no guardar el cierre compartido, la víspera del «hoy» sintético cambia y el punto de hoy no. El motivo está en el comentario de `accountBalanceRows`: no se apunta el saldo de una a nombre de las dos. No es una cifra distinta sin motivo.

`tests/patrimonio-serie-oraculo.test.mjs`: 286 series, cachés llenas y en frío, cuatro mutantes de caché muertos.

## 2. Edge, antes de desplegar — OK, con un doc que miente

Los cubos de la familia no son los de una cuenta nueva. Lo cubren los tests de `prices`, `help-assistant`, `categorize` y `sec02-edge-limits-replay`: una cuenta de más de siete días sigue en `*-total-*`; una nueva, o sin fecha legible, va a `*-new-*` y puede agotar ese cubo sin tocar el de las veteranas. Abrir la app no llama a `prices` (el botón de cotizaciones sí; el tipo de cambio del día va por otro camino).

`crypto.test.ts`: sin clave se guarda en claro, se avisa una vez y el aviso no lleva el secreto; con `TOKEN_ENCRYPTION_REQUIRED=1` no se guarda en claro.

`bank-confirm.test.mjs` (manejadores reales, tabla sintética, sin red): sin pedir confirmación, web y APK siguen igual; con confirmación el callback deja el enlace pendiente y el token solo vuelve en la redirección; un enlace ajeno no pasa a activo; `BANK_REQUIRE_CONFIRM=1` lo exige aunque el cliente no lo pida; caduca a la hora y una reconexión intermedia no se pisa.

La migración `0027` revoca `join_household_by_code(text)` e `is_household_member(uuid)`, que son las firmas de `0013`/`0022` y `0014`/`0015`. `tests/grants-migraciones.test.mjs` pasa. `imports-fijos` fija la misma versión de la librería en las funciones desplegables.

### P2 · `docs/TESTING.md:643`

Sigue diciendo que el freno de `prices` no está activo salvo `PRICES_RATE_LIMIT=1`. El código que se va a desplegar hace lo contrario: `supabase/functions/prices/index.ts:34` lo enciende salvo que la variable sea `"0"`. `docs/SETUP-SUPABASE.md:145` y `:513` ya lo dicen bien. Quien despliegue y se fíe de `TESTING.md` creerá que el cupo está apagado.

Propuesta, sin tocar el fichero en esta revisión: sustituir esa frase por la de `SETUP-SUPABASE.md` (encendido por defecto; `PRICES_RATE_LIMIT=0` lo apaga).

### P3 · `supabase/functions/bank-connect/index.ts:42`

El comentario remite a `_shared/bank_confirm.ts`. Ese fichero no está. La función es `supabase/functions/bank-confirm/index.ts`.

## 3. Merge de producción — OK

- `CHANGELOG.md` desde el encabezado `## [4.26.232]` es byte a byte el de `5ceb117c0`. Lo nuevo está insertado encima.
- `src/data/release-notes.json`: 240 notas; la primera es `4.26.233`; las 239 siguientes van en el mismo orden que las 239 de la 232.
- `git diff --name-status 5ceb117c0 20ac544ca`: cero ficheros borrados.
- `public/apk.json` no cambia en ese diff: `versionCode` 64, `versionName` `4.26.206`, URL `releases/download/v4.26.206/Aely-4.26.206.apk`.
- `npm run test:syntax`: EXIT 0. Siete bloques, sin `const` duplicado.

Nota: el changelog de la 233 habla de 275 series del oráculo. El test corrido hoy imprime 286. No falta el bloque de la 232; el recuento del párrafo nuevo se quedó corto.

## 4. Textos — OK, con dos avisos que aún enseñan el fallo crudo

`tests/i18n-keys.test.mjs`: 1708 claves usadas en castellano, inglés y catalán sin huecos, mismos `{placeholders}`, ninguna clave definida sin uso. EXIT 0.

`public/i18n/en.json` y `ca.json`: 2118 claves cada uno, las mismas que `LANG.en` / `LANG.ca` de `src/modules/01-i18n.js`, y el mismo texto (los cuatro arrays que una comparación por referencia marca distintos son iguales al serializarlos).

`errTxt` (`src/modules/00-core.js:158`): «Failed to fetch» sale como la frase de sin conexión, no el texto inglés; el estado no-2xx de una función sale como la frase genérica; un `Error` cuyo mensaje ya es la frase de `exp_pull_invalid` se conserva; «Invalid login credentials» y «contraseña incorrecta» salen traducidos. `tests/logs-privacidad.test.mjs` EXIT 0.

### P3 · mensaje crudo todavía en pantalla

Dos sitios que la ronda no pasó por `errTxt`. No se ha cambiado el producto.

1. `src/modules/10-app-components.js:1693`. Al fallar el envío del parte de la beta, el aviso concatena `e.message`. Reproducción: el `catch` de `cloud.betaReport` en ese panel. Propuesta: `showToast(errTxt(e))`, como el resto de avisos de la misma tanda.
2. `src/modules/10-app-components.js:3378`. La pantalla de recuperación sigue pintando `err.message`. El color fijo `#5a6b62` sobre `#0B1410` da 3,31:1 (el título y el párrafo traducidos de esa pantalla, 16,13:1 y 8,46:1). La ronda sí tocó esta pantalla para quitar el `alert` nativo y dejó esta línea. Reproducción: cualquier render que lance. Propuesta: quitar la línea, o dejar solo `mcLogCode` en consola, que es lo que ya hace `componentDidCatch` en la línea 3357.

## 5. Lo que se pinta — OK

Playwright, 18 pruebas, EXIT 0:

- Apuntar a 360×740, a 412×915 y con barra de gestos: las doce teclas y el botón se tocan sin deslizar la hoja.
- `--muted-2` y el menta, ≥4,5:1, en Verde, Oscuro y Claro.
- Apuntar y la ficha de un gasto se ensayan la primera vez sin dejar rastro; el velo se queda los toques.
- Plan sencillo, «libres de» en es/en/ca, tipo de cambio a 4 decimales, diálogo de la app en el candado.
- Cuentas sin clave: en reposo no se reescribe el estado y las pestañas cambian. Dos cuentas con la misma clave no se pisan el cierre.

El e2e de contraste no abre Azul, Cyber ni alto contraste, ni mide `--surface-2`. Medidos los tokens de `src/shell.html` (Verde, Oscuro, Claro, Azul, Cyber, y los cinco con `html.hi-contrast`): `--muted-2` sobre `--bg`, `--surface` y `--surface-2`, y `--on-mint` sobre `--mint`, quedan todos en 4,5:1 o más. No hace falta otro e2e para cazar un fallo que no está.

## Comandos y EXIT

| Comando | EXIT |
|---|---|
| `npm run test:syntax` | 0 |
| `node tests/patrimonio-serie-oraculo.test.mjs` | 0 |
| `node --test tests/saldos-cierres-por-clave.test.mjs` | 0 (7/7) |
| `node tests/i18n-keys.test.mjs` | 0 |
| `node tests/bank-confirm.test.mjs` | 0 (6/6) |
| `node tests/grants-migraciones.test.mjs` | 0 |
| `node tests/help-assistant.test.mjs` | 0 |
| `node tests/categorize-handler.test.mjs` | 0 |
| `node tests/logs-privacidad.test.mjs` | 0 |
| `node tests/sec02-edge-limits-replay.test.mjs` | 0 (6/6) |
| `deno test --allow-env supabase/functions/_shared/crypto.test.ts` | 0 (5/5) |
| `deno test supabase/functions/prices/prices.test.ts` | 0 (24/24) |
| `deno test --allow-read=supabase/functions supabase/functions/_shared/imports-fijos.test.ts` | 0 (3/3) |
| `deno test --node-modules-dir=none --allow-read=supabase/functions --fail-fast=1 supabase/functions/bank-callback/generation-fence.test.ts` | 0 (20/20) |
| `deno test supabase/functions/delete-account/delete-account.test.ts` | 0 (3/3) |
| Sonda de serie 232 contra 233 (dos bancos, zona, deuda en el sitio) | 0 |
| `npx playwright test` de `apuntar-teclado-visible`, `apuntar-ficha-apertura-ligera`, `textos-claros`, `saldos-sin-bucle` | 0 (18/18) |

Comparación de changelog, notas, `apk.json` y claves i18n: los programas de comprobación salieron 0. Una primera sonda salió 1 porque comparaba la caché de resultado aún caliente de la 233 con la de la 232 vaciada, y porque buscaba `LANG` como global del sandbox: no es un fallo del producto. La sonda corregida y el `errTxt` aparte salieron 0.
