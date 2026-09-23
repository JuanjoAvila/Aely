# Testing — Aely

Sin candados (feedback 18/9, punto 14): `tests/no-lock-icons.test.mjs` falla si vuelve un 🔒/🔓/🔐
a `src/modules` o `shell.html`. También falla si reaparece el recorte «hasta el primer espacio» del
texto de huella, que sin emoji se comería el verbo. `e2e/sin-candados.spec.mjs` abre Ajustes → Tu
cuenta y Privacidad y comprueba lo pintado. `cartera-ficha-cuenta` y `listas-render` comprueban que
la cuenta conectada y el banner de reconectar siguen protegidos, pero sin el icono.

Ajustes 4.26.11: el nuevo caso de `e2e/swipe-pestanas.spec.mjs` arrastra despacio desde Inicio
y mide por CDP que el primer fotograma del cajón avance menos de 12 px; también comprueba que
termine abriéndose. `revisar-beta.spec.mjs` exige solo el veredicto de Ajustes después de la
aprobación y publicación de temas, sin resucitar los 28 pasos antiguos. No requiere APK nueva.

Apariencia 4.26.10: `e2e/apariencia-temas.spec.mjs` pinta Cyberpunk de verdad y comprueba que el
dinero conserva verde/rojo y que el tema persiste tras recargar. También cubre que «Reducir
animaciones» apaga todo lo que se mueve y las temáticas Otoño y Primavera (tinte, ambientación y
persistencia). Va en CROSSCUTTING porque lo pueden romper `shell.html` o Ajustes, no una sola
pantalla. `revisar-beta.spec.mjs` comprueba que el veredicto ya recibido de la 4.26.9.1 no
reactiva las nueve checklists antiguas: Novedades conserva el histórico, pero el panel ya no pide
los cinco pasos de temas aprobados. El gesto de Ajustes conserva su tanda propia; el retoque de
importes/anillo tendrá otra tanda y pruebas propias.

Plan v4.1 (4.26.8): `tests/plan-charges.test.mjs` protege la fuente única de cargos con euros
pagados/pendientes, varias cuentas, deudas sin día y saldos ausentes o negativos. Está registrado
en `scripts/run-tests.mjs`. `e2e/plan-cover.spec.mjs` abre la pantalla real y cubre el anillo, la
cuenta con menor margen, estados honestos, modo simple, entrada fría desde Ajustes y los diálogos
de recibos. Teclea cadenas completas con `pressSequentially` para impedir que un rerender vuelva a
robar el foco al título. El spec está en `scripts/relevant-tests.mjs`; `plan-gestionar` conserva el
flujo histórico de alta/edición y ambos se ejecutan al tocar Plan.

Lectura bancaria 4.25.4: `tests/bank-sync-paging.test.mjs` ejecuta el handler real con BD y proveedor
simulados (sin consultar bancos): páginas vacías, fallback de periodo, fallo parcial, cursor cíclico,
cuentas inactivas, aislamiento, timeout y topes. Registrado en `run-tests.mjs` y `STEPS_SUPABASE`;
el recorte de un cambio solo de servidor conserva paginado y `tr-open-banking` sin Chromium.
`e2e/bancos-historico-filtro.spec.mjs` comprueba la selección previa, avisos visibles y que un banco
no esconda las filas recibidas de otro. `e2e/sync-resumen.spec.mjs` impide que los resultados mixtos
vuelvan a concatenarse en un toast gigante. Los e2e de barra fuerzan además un repintado React con
el host de scroll activo: la ola debe conservar sus clases después del render, no solo antes.
Desde 4.25.5 recorren también el fondo incremental real de Gastos, comprueban que la caja oculta
no quede por debajo del viewport y reproducen la deriva lateral del pulgar que antes convertía el
segundo tirón en un cambio de pestaña y hacía reaparecer la barra.
`tests/tr-open-banking.test.mjs` protege contra el antiguo corte global de 150 movimientos.

## Tiempos y preparación de Novedades

`npm test` conserva los casos seleccionados por el plan y escribe las duraciones de cada etapa
en `test-results/runner-times.json`. Playwright escribe resultados, reintentos y duraciones por
prueba en `test-results/playwright.json`; un `--reporter` explícito sustituye esa configuración.
Son resultados locales ignorados por Git. Comparar el mismo conjunto de casos, navegador,
trabajadores y zona horaria con la máquina libre; no comparar una pasada aislada con otra
que compite con las suites de otros agentes.

`seedLoggedInDashboard` marca Novedades como vistas en `dev`. Para probar otra situación,
usar `__seenVersion` (versión base, o una anterior si debe salir el aviso). `dismissNews` solo
evita la espera cuando el valor inicial del fixture coincide con `mcVerBase(CONFIG.APP_VERSION)`
del navegador y no hay panel. En los demás casos mantiene la espera y el cierre de siempre.
`fixtures-news.spec.mjs` vigila que no aparezca un popup después de esa salida rápida y que
el aviso tardío siga cerrándose, también con una versión beta con sufijo.

El ajuste de fixtures de `banco-espera-nube` mantiene una cadena Supabase por consulta;
ambas regresiones están registradas en `CROSSCUTTING`.

El runner ejecuta `rendimiento.spec.mjs` y `rendimiento-tabs.spec.mjs` después de los demás
e2e, con un trabajador y sin cambiar umbrales. La CPU frenada no debe competir con pruebas
funcionales: dos completas midieron 108/109 ms en scroll→swipe mientras el caso aislado pasaba.
El plan conserva sus mismos specs; el informe combinado incluye ambas fases. Los informes y
artefactos separados viven en `test-results/playwright-e2e*` y `test-results/playwright-perf*`.
Para medir directamente con Playwright, seleccionar solo esos specs y `--workers=1`.
Un fallo de `playwright-perf` mantiene la suite roja: los umbrales siguen siendo obligatorios.

Auditoría 4.19.14: `e2e/revisar-beta.spec.mjs` comprueba plegado automático al aprobar,
desplegar/cambiar de opinión y conservación entre compilaciones. `e2e/bancos-historico-filtro.spec.mjs`
actualiza el estado durante la confirmación de Deshacer y simula fallo/reintento del DELETE.
Ambos ya están en el mapa de pruebas. `expense-id-cloud` ejecuta el método de borrado con sesión
ausente, comprueba filtros por dueño/uuid y propagación de errores. No usa datos ni servicios reales.
4.19.15–17: `tests/efectivo-cierre.test.mjs` (13 casos) cubre el cierre de mes por cuenta —
efectivo, otros bancos y round-up— y `tests/hist-pagos-mensuales.test.mjs` (8) la clasificación del
histórico. `e2e/hist-pagos-mensuales.spec.mjs` cubre lo que el unitario no ve: que marcar tres meses
del mismo recibo en la pantalla real deje UN fijo. Los tres se ejecutaron en rojo antes del arreglo.
Hallazgos aún abiertos: [auditoría del 9/9](briefs/AUDITORIA-CODEX-2026-09-09.md).
Cola de casos que faltan y aceptación por encargo: [BACKLOG.md](BACKLOG.md), FIN-01 a FIN-08,
OPS-01/02/06 y seguridad. Una suite verde no sustituye esos ensayos de identidad, restauración,
servidor vivo y Android; cada entrega debe indicar cuáles ejecutó y cuáles siguen pendientes.

Regresiones de widget/nube (4.19.6): `e2e/persistencia.spec.mjs` cubre reactivación nativa sin
`visibilitychange` con puente simulado y pull de categorías neutras comprobado en Inicio/Gastos.
Está registrado en `CROSSCUTTING`. `tests/presupuesto-servidor.test.mjs` convierte las filas con
`expenseFromRow` antes de comparar totales: construir directamente `category:cat` no probaba el pull.
Estas pruebas no ejecutan las preferencias Java ni sustituyen la comprobación final en el móvil.

## Para el dueño: los dos interruptores de Ajustes → Dev → Pruebas

Son **dos cosas independientes** y se confunden constantemente. Esta tabla es la respuesta corta:

| Interruptor | Qué hace | ¿Lo enciendo? |
|---|---|---|
| **Canal** (`📦 estable` ↔ `🚧 BETA`) | De dónde baja las actualizaciones este móvil. **Estable** = lo mismo que el padre y la pareja (GitHub Pages). **Beta** = la release fija `beta` del repo, que solo se publica cuando alguien empuja a la rama `beta`. | **Solo cuando haya una beta esperándote.** Si no hay ninguna, cae a estable y no pasa nada — pero tampoco ganas nada. |
| **Banco de pruebas** (`🏦` ↔ `🧪 DENTRO`) | Cartera FALSA y aislada (`micartera_sandbox`). Dentro, **la app no escribe NADA en la nube**. Banda naranja permanente. | **Solo el rato que vayas a trastear** algo destructivo (borrar cuentas, importar a lo bruto). Y sales al terminar. |

**⚠ El banco de pruebas también corta la telemetría.** `logEvent` está en `CLOUD_WRITES`, así que dentro del
sandbox **los errores de tu móvil no llegan a `app_events`** y quien te ayude a depurar se queda ciego.
Si estás reportando un fallo, tiene que estar APAGADO.

**⚠ El canal beta puede dejarte atrás.** El OTA compara NÚMEROS de versión. Si la release `beta` anuncia una
versión más alta que la estable pero con código más viejo (pasó el 2026-07-25: `beta` anunciaba `4.8.0.3`
mientras `main` iba por `4.8.0` con arreglos nuevos), activarla te instala lo viejo y te deja encallado hasta
el siguiente bump. **Antes de activar el canal beta, comprueba que la release `beta` sea más nueva que `main`.**

### Cómo se prueba una versión antes que nadie (el flujo completo)

1. El cambio se empuja a la rama **`beta`** (no a `main`). `beta.yml` publica `bundle.zip` + `version.json`
   en la release fija `beta`.
2. En el móvil: **Ajustes → Dev → Pruebas → Canal → Activar beta**. Solo ESE móvil la recibe.
3. Aparece **«🔍 Revisar esta beta»**: la checklist sale sola de las `RELEASE_NOTES` de esa versión. Cada
   punto se marca ✓ o ✗ (con ✗ te pide decir qué pasa). **No se puede aprobar con cosas sin probar ni con
   fallos marcados** — si esa puerta se abre, el botón no significa nada. El progreso se guarda por versión,
   porque probar lleva días.
   Una corrección que continúa en otra versión conserva el mismo `tanda.id`: el panel mantiene solo la más
   nueva. Cuando producción alcanza la beta, la ronda pasa a cero y «Revisar esta beta» desaparece; nunca se
   usa una nota antigua como fallback en ese caso.
4. Cuando esté aprobado, desde el PC: **Actions → «Promote beta» → Run workflow**, escribiendo `SUBIR`.
   Vuelve a pasar la suite y mergea `beta` → `main`, que es lo que ven todos.

**El panel NO despliega a propósito.** La app no puede hacer un merge de git, y meter un token de GitHub con
permiso de escritura en Supabase sería una credencial nueva y jugosa a cambio de ahorrar un clic.

### Si no te llega una actualización

Lo primero que hay que mirar **no es el canal, es el número de versión**: el OTA solo ofrece algo si
`version.json` del servidor trae una versión MAYOR que la del móvil. Un arreglo desplegado sin subir
`VERSION` es invisible para la app (pasó el 2026-07-25). Comprobación de 5 segundos:

```bash
curl -s "https://juanjoavila.github.io/Aely/version.json"
```

Desde la 4.9.1 esto lo vigila `tests/docs-frescura.test.mjs`: si quedan cambios en `src/`,
`supabase/functions/` o `android/app/src/` después del último bump de `VERSION`, `npm test` falla.

### Dos guardas más, de la 4.10.0

- **`tests/edge-sintaxis.test.mjs`** — las Edge Functions se despliegan solas al pushear, en un
  workflow DISTINTO al de Pages: un paréntesis de más no lo ve nadie hasta que el usuario ya cree
  que está publicado. Y `deno check` se omite en silencio si Deno no está instalado. Esto las pasa
  por el parser de esbuild (que ya es dependencia del repo) y además falla si alguna vuelve a poner
  `Access-Control-Allow-Origin: "*"` en vez de usar `withCors` (`_shared/cors.ts`).
- **`tests/presupuesto-rendimiento.test.mjs`** — presupuesto de TAMAÑO: `index.html` minificado y
  gzip (lo que baja el móvil de verdad) y cuántos ficheros bloquean el primer pintado. Los topes
  están escritos en el propio fichero con lo medido el día que se pusieron; subirlos vale, pero se
  hace a propósito y explicando por qué. El tamaño crece de uno en uno y nadie lo mira hasta que la
  app tarda cinco segundos en abrir y no hay un commit al que señalar.
- **`e2e/gastos-orden.spec.mjs`** — arrastra un movimiento con gesto táctil, comprueba el DOM y el
  orden guardado tras recargar, y garantiza que las fechas originales no cambian.

## Flujo local (CMD o PowerShell)

Abre **CMD** o **PowerShell**, ve a la carpeta del proyecto y ejecuta:

```powershell
cd "E:\Aely"
```

### Si `npm ci` falla con “package-lock.json”

Eso pasa si la carpeta **no tiene el lockfile** (copia vieja, zip, o sin `git pull`).

**Solución:**

```powershell
git pull origin main
npm install
```

`npm install` genera/actualiza `package-lock.json`. Luego ya puedes usar `npm ci` en adelante.

### Instalación completa (una vez)

```powershell
git pull origin main
npm install
npx playwright install chromium
```

### Ejecutar tests

```powershell
npm test          # build + unit + E2E (suite entera; lo que corre main y el promote)
npm run test:relevant  # como la rama beta: solo lo que toca el último commit
npm run test:e2e  # solo Playwright (más rápido)
npm run build     # solo ensamblar src → public/index.html
# Sueltos, cuando solo tocas una zona:
node tests/edge-sintaxis.test.mjs             # Edge Functions: sintaxis + nadie pone CORS "*"
node tests/presupuesto-rendimiento.test.mjs   # cuánto pesa lo que se envía al móvil
```

## Capas

| Capa | Qué cubre | Dónde |
|------|-----------|--------|
| **build-app** | Ensambla `src/modules/` → `public/index.html` | `scripts/build-app.mjs` |
| **check-syntax** | Sintaxis VM de cada `<script>` inline | `scripts/check-syntax.mjs` |
| **Unit (Node)** | Motor financiero, parsers Revolut, onboarding… | `tests/*.test.mjs` |
| **Deno** | ingest, crypto, delete-account | `supabase/functions/**/*.test.ts` |
| **Playwright** | Smoke UI + flujo borrar cuenta | `e2e/*.spec.mjs` |

## Fuente editable

Tras v3.108.0 la lógica vive en **`src/modules/*.js`**. No edites `public/index.html` a mano — se regenera con `npm run build`.

## CI

- `.github/workflows/test.yml` — push/PR a **main**: suite **entera**
- `.github/workflows/promote-beta.yml` — al subir a producción: suite **entera**
- `.github/workflows/beta.yml` — push a **beta**: recorte por carpetas (`scripts/relevant-tests.mjs`).
  Docs → sin Chromium. Ingest → Deno, sin e2e. Gastos → sus specs + transversales (persistencia,
  swipe, frames). Núcleo (motor, i18n, shell, runner) o un workflow → todo.
  **Si añades un e2e o un módulo de `src/`**, una línea en `E2E_MAP` / `CROSSCUTTING` / `CORE`
  en el mismo commit: el test `relevant-tests` recorre el disco y aborta si falta. Un unitario
  nuevo va a `steps` en `run-tests.mjs` (igual: aborta). Un `*.test.ts` de Deno, a `denoTests`.

## Playwright en modo visual (opcional)

```powershell
npx playwright test --ui
```

Abre una ventana donde ves el navegador y cada paso del test.

---

## Entorno de pruebas del dueño (v4.8.0)

Dos cosas distintas, ambas en **Ajustes → Dev → 🧪 Pruebas** y visibles solo con
`profiles.is_admin = true` (o sea: solo tú).

### 1. Canal beta — QUÉ versión recibe este móvil

GitHub Pages sirve **una sola** versión: la de `main`, que es la que usan tu padre y tu pareja.
Por eso la beta no va por Pages, sino como assets de una **release fija con la etiqueta `beta`**.

```
rama `beta`  ──push──►  .github/workflows/beta.yml
                          ├─ relevant-tests (docs/ingest se saltan Chromium; núcleo = todo)
                          ├─ build + stamp + minify
                          └─ sube bundle.zip + version.json a la release `beta`
                                     │
                    solo los móviles con canal beta ◄┘
```

- La versión de beta lleva sufijo con el número de ejecución (`4.8.0.17`), así se distingue de un
  vistazo en el pie de Ajustes y `_mcNewerVer` la ve como más nueva que la estable del mismo número.
- Si el canal beta está vacío o la release no existe, la app **cae a estable** sola
  (`mcFetchManifest`): nunca se queda un móvil sin poder actualizarse.
- Volver a estable: el mismo interruptor. Limpia lo que hubiera pendiente del otro canal.

**Promocionar una beta a producción:** mergea la rama `beta` a `main` como siempre.

### 2. Banco de pruebas — CON QUÉ datos trabajas

Copia tu cartera a `micartera_sandbox` y, mientras estás dentro:

- todo lo que escribas se queda en esa clave; tu `micartera_v3` no se toca;
- **ninguna** operación de escritura llega a la nube — las 20 que hay (`CLOUD_WRITES` en
  `00-core.js`) pasan por un envoltorio que las anula, así que ni tu padre ni tu pareja ven nada;
- las lecturas (sincronizar el banco, precios) siguen funcionando: probar con datos reales es la gracia;
- una **banda naranja** permanente lo recuerda, y tocarla te saca.

> ⚠️ **Si añades un método a `cloud` que escriba algo, mételo en `CLOUD_WRITES`.** Si se olvida, el
> modo pruebas escribiría en producción. `tests/security.test.mjs` lo detecta y falla el build.

Cubierto por `e2e/modo-pruebas.spec.mjs`. Ese test ya pagó su precio: encontró que salir del modo
pruebas escribía el estado de prueba **encima de la cartera real** (el volcado de `pagehide` corría
entre quitar la bandera y recargar). Por eso el modo se fija al arrancar y no se relee.

### 3. Aprobar la beta desde el móvil («code review», pero probando)

**Ajustes → Dev → 🧪 Pruebas → 🔍 Revisar esta beta** (solo en canal beta).

La checklist **sale de `RELEASE_NOTES` de la versión que corre**, así que no hay nada que mantener
aparte: cada release trae su lista sola. Cada punto se marca *✓ Va bien* o *✗ Falla*; al marcar que
falla aparece un campo para decir qué pasa. El progreso se guarda por versión en localStorage —
probar lleva días y cerrar la app no puede borrarlo.

**Regla que impone el panel:** no se puede aprobar con cosas sin probar ni con nada marcado como que
falla. Si esa puerta se abriera, el botón dejaría de significar nada. Cubierto por
`e2e/revisar-beta.spec.mjs`.

El veredicto se guarda en `app_events` con `kind:'beta'` (tabla que ya existía, RLS solo-admin) y se
lee en **Actividad → filtro 🧪 Betas**. Dentro del banco de pruebas NO se manda nada: `betaReport`
está en `CLOUD_WRITES` (aprobar con datos falsos no aprueba nada).

#### Subirla a producción

El panel **no despliega**: la app no puede hacer un merge de git, y meter un token de GitHub con
permiso de escritura en Supabase sería una credencial nueva y jugosa a cambio de ahorrar un clic.
Dos caminos, los dos de una línea:

1. Decírselo a Claude («sube la beta»).
2. GitHub → Actions → **Promocionar beta a producción** → Run workflow → escribir `SUBIR`.
   Vuelve a pasar la suite entera, mergea `beta` → `main` y el deploy de Pages sale solo.

#### ⚠ El canal beta SOLO funciona en la app Android

Esto hay que tenerlo clarísimo porque ya causó una confusión (2026-07-24):

| | De dónde saca la versión | ¿El canal hace algo? |
|---|---|---|
| **App Android (APK)** | OTA de Capgo → `version.json` del canal | **Sí** |
| **Navegador / PWA** | Service Worker → GitHub Pages = `main` = **producción** | **No** |

`_mcCheckOtaUpdates` se sale en la primera línea si no existe `Capacitor.Plugins.CapacitorUpdater`,
o sea siempre en la web. En el navegador **no hay forma de servir la beta**: Pages publica un único
sitio, el de `main`. Y servirla desde otro dominio tampoco valdría — sería otro origen, o sea otro
localStorage: entrarías a una cartera vacía y sin sesión.

Así que en la web siempre verás la versión de producción. La app avisa de ello (en Ajustes y en el
toast de `?canal=beta`) en vez de callarse.

#### El arranque: cómo llega la PRIMERA beta a la APK

Pescadilla que se muerde la cola: el interruptor de canal vive en la versión que quieres probar, así
que una APK antigua nunca mirará la release `beta`. Hay que romperlo **una vez**, y solo hay dos
formas:

1. **Instalar a mano un APK de beta** (sideload). Desde ahí, cada beta siguiente entra sola por OTA.
   Requiere firmar el APK → o lo compilas en el PC (`npx cap sync android` + `assembleRelease`), o se
   añade la firma al workflow (ver abajo).
2. **Subir esa versión a producción** y aceptar que el canal beta empieza a servir de la siguiente
   en adelante.

`?canal=beta` / `?canal=estable` en la URL sirven para cambiar de canal **una vez la app ya tiene el
interruptor** — no para saltarse el arranque.

##### Si algún día se quiere compilar el APK de beta en CI

Hoy la firma vive solo en el PC (`local.properties` → keystore en `~/.micartera`, **nunca en el
repo**). Para que `beta.yml` publique un APK firmado harían falta como secrets del repo el keystore
en base64, su contraseña, el alias y la del alias. **Es una decisión con coste:** esa clave es la
identidad de la app; quien la tenga puede firmar una actualización que los móviles aceptarían como
tuya. Mientras no compense, el APK se compila en el PC.

## Checklist de re-prueba — beta 4.12.0 (tras rechazos .17/.18)

Además de la checklist automática del panel (sale de `RELEASE_NOTES`), conviene mirar a mano:

1. **Plan → Deudas (o Metas) → scrollear un poco → deslizar a otra pestaña al momento.** No debe
   ir a tirones. (Si solo entras y deslizas sin scrollear, eso ya iba bien.)
2. **Banco caído:** sincronizar a mano con un banco sin permiso → toast + noti; al tocar la noti,
   Cartera con el banner rojo a la vista (Mis bancos **no** se abre solo). Un toque en el banner
   sí abre la autorización. En Mis bancos ese banco sale en coral, no en verde.
3. **Trade Republic desconectado:** banner en Cartera; el botón abre Mis bancos con TR, no un
   login de Open Banking. Ajustes → Bancos menciona TR desconectado.
4. **Perfil:** abrir (avatar) y cerrar tirando **sin esperar** medio segundo. Tiene que cerrar.
5. **Ajustes → pie / Actualizaciones:** se ven `web v4.12.0` y `app 4.12.0` (o la APK que lleves).
   Si solo sale la web, la APK es anterior a la 35.
6. **Panel de revisión:** los ✓ de una compilación anterior con el mismo texto de nota llegan
   heredados; los ✗ no.

## Varias betas a la vez (tandas) — desde 4.13.0

Petición suya del 2026-07-29: **«que se pudieran implementar varias betas a la vez y que me des la
opción de aprobarlas por separado pero que estén juntas»**. O sea, como se trabaja en una empresa:
varias cosas en vuelo, todas probándose en la misma instalación, y cada una sube cuando está lista
sin esperar a la que va con retraso.

> ⚠ **LA GRANULARIDAD POR DEFECTO ES UNA FUNCIONALIDAD = UNA TANDA** (aclarado 2026-08-01: «por
> features, por cada cosa que haya, a no ser que sea un pack por dependencias — eso sí sería una
> tanda de varias cosas»). No es «cuatro cosas grandes, cada una su tanda»: es **cada punto que se
> pueda subir SOLO, sube solo**. Varias cosas comparten tanda ÚNICAMENTE cuando de verdad dependen
> entre sí (p. ej. una migración de datos + la pantalla que la necesita: subir una sin la otra
> rompe algo). En la duda, más tandas pequeñas, no menos.

Y para lo que ni siquiera esto cubre —una ronda que se commiteó mezclada, sin tandas, y hay un
arreglo urgente ahí dentro— está el **parche por commits sueltos**, más abajo.

### Cómo se declara una tanda

En la entrada de `RELEASE_NOTES` de la versión, junto a `items` (que es lo que ve la familia en
Novedades y **no cambia**), se añade `tandas`, que **solo la ve él** en el panel de revisión:

```js
{v:"4.13.0", d:"28 jul 2026", t:{es:"…",en:"…",ca:"…"},
 tandas:[
   {id:"import", t:"📗 Importar hojas de gastos", items:["…qué probar…","…"]},
   {id:"gestos", t:"🎯 Rebote y barra de abajo",  items:["…","…"]},
 ],
 items:{es:[…],en:[…],ca:[…]}}
```

Reglas:
- **El `id` es el que viaja al parte y al workflow.** Corto, sin espacios, estable.
- Los `items` de una tanda son **qué probar**, no qué se ha hecho: se leen desde el móvil con la
  app delante. El `CHANGELOG` es para el porqué.
- **Las tandas son opcionales.** Sin ellas, el panel se comporta exactamente como antes (una sola
  checklist, un solo veredicto con id `todo`). Las 69 versiones del histórico siguen funcionando.
- ⚠ **`items` y `tandas` son dos listas distintas y no tienen por qué parecerse**: `items` es lo
  que lee la familia en Novedades, y los puntos de las tandas son lo que él prueba. El panel
  aplana las tandas y esa lista aplanada ES la checklist (`betaChecklist`). **No toques ese
  aplanado**: el progreso, los ✓ heredados entre compilaciones y el guardado van todos por el
  índice global que sale de ahí. Si alguien vuelve a usar `items` como checklist, el panel enseña
  un punto y guarda su ✓ bajo el texto de otro, sin avisar (pasó en la 4.13.0: 21 puntos en tandas
  contra 14 en Novedades). Lo vigila `e2e/revisar-beta.spec.mjs`.

### Cómo se aprueba

Cada tanda tiene en el panel **su propio contador y su propio botón**. Un fallo marcado en una NO
bloquea a las demás — que es todo el motivo de que existan. Cada veredicto se manda por separado y
lleva su `id`, así que `node scripts/errores.mjs --kind=beta` enseña una línea por tanda.

### Una tanda aprobada Y SUBIDA se QUITA de `tandas`, no se marca como hecha

Regla suya, textual (2026-08-01): **«si sube algo en prod, se quita de beta para probar porque ya
está listo — es como una especie de backlog: conforme apruebe la tanda sube y desaparece; si algo
falla se queda hasta que esté todo aprobado por mí»**.

Cuando una tanda se aprueba Y se promociona (a `main`, o su arreglo ya vive activo aunque no haya
«producción» que tocar, como `canal`), su bloque entero **se borra** del array `tandas` de esa
entrada de `RELEASE_NOTES` — no se deja ahí con un comentario de «ya hecha», porque eso es
exactamente lo que le hizo dudar si de verdad estaba hecho o no («no se reflejaba en las pruebas
de la beta»). El bloque `{id:...}` desaparece del código; lo que hizo esa tanda queda documentado
en el CHANGELOG y en `docs/ROADMAP.md`, que es donde se consulta el HISTÓRICO — `tandas` es solo
la cola de lo que **queda** por revisar, nunca un registro de lo ya cerrado.

### Cómo se sube solo lo aprobado

> ⚠⚠ **LA RAMA SE DECIDE ANTES DE ESCRIBIR NADA, NO AL FINAL.** Declarar `tandas` en las notas
> **no crea ninguna rama**: solo parte la checklist del móvil en secciones. Si las tandas se
> commitean mezcladas encima de `beta` —que es lo que pasó en la 4.13.0, con `import` + `gestos` +
> `arranque` en un mismo commit—, **ya no se pueden trocear**: cortarlas a posteriori con
> `cherry-pick` sobre los mismos ficheros es justo la promoción a medias que este mecanismo existe
> para evitar. Esa ronda solo puede subir ENTERA (`tandas` vacío).
>
> Así que si la ronda va a tener tandas de verdad: **`git switch -c tanda/<id> main` para cada una
> antes del primer commit**, y `beta` se mantiene como la mezcla (`git merge` de todas).

Para que una tanda pueda subir sola, tiene que vivir en **su propia rama `tanda/<id>`**, y `beta`
ser la mezcla de todas. Entonces:

```
Actions → «Promocionar beta a producción»
  confirmar: SUBIR
  tandas:    import,gestos      ← solo estas dos se mergean a main
```

Con `tandas` **vacío** se sube `beta` entera, que es lo de siempre y sigue siendo lo normal cuando
solo hay una cosa en vuelo.

⚠ Si pides una tanda cuya rama no existe, el workflow **para** y no sube nada. Subir «lo que haya»
cuando falta una rama es el fallo silencioso que ya costó dos promociones a medias.

## Un parche urgente, cuando ni siquiera hay tandas — desde 4.13.0

Petición suya del 2026-08-01: **«se han implementado montonazo de cosas y hay cosas urgentes para
subir a prod por bugs gordos para mi pareja y mi padre y no se puede subir esos parches»**. Las
tandas resuelven esto SI la ronda nació troceada desde el primer commit — pero si no (la 4.13.0 se
commiteó mezclada), no hay rama que mergear y toca esperar a que TODO esté listo, que es
exactamente lo que no puede pasar con un bug gordo delante de la familia.

La vía de emergencia: **`commits`**, cherry-pick de los commits exactos que hacen falta, sin tocar
el resto de `beta`.

```
Actions → «Promocionar beta a producción»
  confirmar: SUBIR
  commits:   a1b2c3d,e4f5061      ← del más VIEJO al más nuevo (el orden importa)
  version:   4.12.2                ← opcional; vacío = sube el PATCH de lo que hay en prod
```

`npm run salud` ya te da la lista de commits pendientes en el orden correcto para pegar, cuando
los hay.

Reglas:
- **No se puede usar a la vez que `tandas`.** Son dos formas de trocear la misma cosa; mezclarlas
  no tiene un significado claro y el workflow para si intentas las dos.
- El número de versión **tiene que ser mayor** que el que ya hay en `main` — si pides uno igual o
  menor, para: bajarle la versión a la gente es peor que no subir nada.
- Si un commit **no aplica limpio** (conflicto), el workflow para y te dice el comando exacto para
  resolverlo a mano en tu portátil. No intenta adivinar cómo fusionar.
- Esto **no sube `VERSION` de `beta`**, sube un PATCH nuevo sobre lo que ya hay en producción — la
  ronda grande sigue en `beta` esperando su turno, intacta.

> En un worktree no hace falta instalar otra copia de Playwright: `scripts/run-tests.mjs`
> reutiliza el CLI de `node_modules` del checkout compartido. Evita `npx playwright`, porque una
> versión distinta a la que carga la configuración hace fallar todos los specs antes de correr.
