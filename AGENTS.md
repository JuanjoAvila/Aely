# Cómo se trabaja en Aely

Guía para cualquier IA que toque este repo (Cursor, Claude Code, Copilot…). **Léela entera antes
de editar nada.** Casi todas las reglas están aquí porque algo se rompió antes por saltárselas.

## 1. Lo primero: qué es esto

PWA de finanzas personales **sin build y sin JSX**. React vía `React.createElement`, todo
inlineado en **un solo fichero**. Se despliega sola a GitHub Pages al pushear a `main`.

**Es la app de finanzas REAL de una persona real y de su pareja**, que la usan a diario en el
móvil para decidir qué hacen con su dinero. No es un ejercicio. Un número mal pintado es peor
que una pantalla fea: si un dato no lo sabes, **no te lo inventes** — enséñalo como «—» y di por
qué falta.

## 2. La regla que más veces se ha roto: la fuente única

- **Edita la lógica en `src/modules/*.js`** y el shell en `src/shell.html`. Ensambla con `npm run build` → genera `public/index.html`.
- **NO edites `public/index.html` a mano** salvo assets estáticos (`vendor/`, `sw.js`, iconos). El CI también ejecuta `build-app` antes del deploy.
- **NO crees un `index.html` en la raíz.** Ya pasó: existía un duplicado que se editaba por error
  y dejaba `public/` atrasado — un fix no llegó al móvil hasta consolidar (v3.3.1).
- `www/` y cualquier `bundle` son **generados**. No los toques a mano.
- El CI minifica con esbuild (`scripts/minify-html.mjs`): **NUNCA `minifyIdentifiers`**. Hay
  globales (`t`, `cloud`, …) que no se pueden renombrar sin romper la app.

## 3. Estilo de código (no negociable, para que el diff no cante)

- `React.createElement(...)`, nunca JSX. Hooks vía `const { useState, useEffect, ... } = React;`
  (ya está declarado arriba del todo).
- `function(){}` y `var/const/let` al estilo del fichero. Mira las 20 líneas de alrededor y
  **imita lo que veas** — densidad de comentarios, nombres, comillas, todo.
- **Comentarios en castellano y explicando el PORQUÉ**, no el qué. El estilo de la casa es dejar
  escrito el motivo y, si viene de un fallo real, la fecha/feedback:
  ```js
  // Sin sugerencia clara el defecto es NO TOCAR (antes era «crear nueva» y el import
  // sembraba posiciones extra de valores ya vendidos — feedback 2026-07-13).
  ```
- **Cero dependencias nuevas. Cero CDNs de terceros.** Todo va auto-hospedado en `public/vendor/`
  y `public/fonts/` porque la app funciona **offline completa**. Si crees que necesitas una
  librería, pregunta antes.

### 3 bis. No dejes restos: se recoge en la MISMA tanda (norma suya, 2026-08-17)

Todo lo que montas para depurar se desmonta antes de cerrar. No «ya lo limpiaré»: si se queda, se
acumula, y dentro de tres meses nadie sabe si ese fichero hace algo o no y no se atreve a tocarlo.

Antes de dar una tanda por terminada, repasa que no dejas:

- **Sondas y andamios**: scripts de un solo uso, ficheros `_algo.mjs` en la raíz, specs de captura,
  volcados (`_uidump*.xml`, `_flicker_frames/`), `console.log` de investigación.
- **Código muerto**: la función que sustituiste, la rama del `if` que ya no entra, el flag que
  quedó siempre a `false`. Si de verdad hace falta guardarlo, se borra igual — está en el historial.
- **Comentarios que ya no dicen nada**: el que describe *el qué* (lo dice el código), el que
  explica una versión anterior, el `// TODO` de hace un año. El estilo de la casa es comentar el
  **porqué**, y un porqué caducado engaña más que la ausencia de comentario.
- **Ramas y worktrees**: la `tanda/<id>` fusionada, el worktree de un agente que ya entregó.
  ⚠ **Esto sí se pregunta antes de borrar** — puede haber trabajo sin subir de otra sesión.
- **Un test que nadie ejecuta.** Si escribes `tests/x.test.mjs`, va a `steps` en
  `scripts/run-tests.mjs`. Si escribes `e2e/x.spec.mjs`, va a `E2E_MAP` o `CROSSCUTTING` en
  `scripts/relevant-tests.mjs` (si no, en beta no corre al tocar la pantalla). Si escribes un
  `*.test.ts` de Deno, va a `denoTests` en el runner. Los tres los comprueba el disco y **abortan**
  si falta uno (pasó con `widget-coherente` y `ob-renombrar`: dos guardianes de bugs de dinero
  publicados sin que nadie los corriera; el verde de Actions decía que vigilaban y no vigilaban nada).

La limpieza a fondo de lo ya acumulado es una tarea aparte, apuntada en el inventario. Esta norma
es para que esa tarea no haga falta una segunda vez.

## 4. Textos: SIEMPRE en tres idiomas

Hay tres bloques de idioma: `LANG.es`, `LANG.en`, `LANG.ca`. **Cada clave nueva va en los tres.**
Se usan con `t("clave")` y `tf("clave",{x:…})` para interpolar.

Las notas de versión (`RELEASE_NOTES`) iban **solo en castellano**… hasta el 2026-07-26, que él
pidió lo contrario desde el móvil: «que el histórico de actualizaciones sea en todos los idiomas,
no solo español». Desde entonces **cada entrada nueva nace en los tres**:

```js
{v:"4.12.0", d:"…", t:{es:"…",en:"…",ca:"…"}, items:{es:[…],en:[…],ca:[…]}}
```

Un texto suelto sigue valiendo y se entiende como castellano — así es como está **todo el
histórico anterior**, y se queda así a propósito: son 68 versiones y 279 entradas, 55 KB, que por
tres idiomas serían 165 KB con el presupuesto de descarga en 277 KB de 310 (gzip). Traducir notas
de hace dos meses al catalán no lo va a leer nadie y cuesta el margen entero.

### Y el TONO de `RELEASE_NOTES` no es negociable (feedback 2026-07-26)

**Las lee toda la familia, no quien las escribió.** Genéricas, en cristiano, impersonales:

- **Nada dirigido al dueño**: ni «lo que rechazaste», ni «como pediste», ni «tu móvil».
- **Nada de la cocina**: ni canal de pruebas, ni rondas de beta, ni números internos.
- **Nada técnico**: ni identificadores, ni manifiestos, ni listeners, ni umbrales en px.
- Se cuenta **qué se nota y qué se puede hacer ahora**, como la nota de cualquier app.

| ✗ | ✓ |
|---|---|
| «Cerrar el perfil: corregido lo que rechazaste… el umbral pasó de 52 a 94 px.» | «Cerrar el perfil vuelve a ir a la primera, también si habías bajado dentro.» |
| «El aviso llevaba un identificador sacado del reloj, así que se apilaba.» | «Se acabaron los avisos de actualización repetidos.» |

El porqué técnico va al `CHANGELOG.md`, que es justo donde sí se quiere con todo el detalle.

## 5. Diálogos: NO uses `window.prompt` / `confirm` / `alert`

Pintan el cuadro **nativo** de Android (gris, tipografía ajena, botones «CANCEL/OK» en inglés con
la app en español). Se sustituyeron todos en la v3.100.0 tras quejarse un usuario real.

Usa `askText({...})` y `askConfirm({...})` (busca `AskHost` en el fichero). **Devuelven promesas**,
mientras que el prompt nativo era síncrono → al portar código hay que meter lo de después dentro
del `.then()`, ojo con los `return` tempranos del patrón viejo:

```js
askText({ title:tf("db_amortize_prompt",{name:d.name}), sub:tf("db_amortize_sub",{x:eur(bal)}),
  ph:"0,00 €", ok:"💸 "+t("db_amortize"), chips:[{v:100,label:"100 €"}] })
  .then(function(raw){ if(raw==null) return; /* null = canceló */ });
```

Para el look, reutiliza lo que ya existe: `.tabsheet`, `.btn btn-primary` / `.btn-ghost`, `.chip`,
`.hint`, `.row`, y las variables CSS (`var(--mint)`, `var(--surface)`, …). **No inventes colores.**

## 6. Publicar una versión

Checklist **obligatoria** (sin descuadres — feedback 2026-07-17):

1. **Bump `VERSION`** (X.Y.Z) y **`package.json`** / **`package-lock.json`** (mismo número).
2. **`RELEASE_NOTES`** al principio del array en `src/modules/10-app-components.js` (**es/en/ca**, en cristiano — ver §4).
3. **`CHANGELOG.md`** técnico, con el porqué.
4. **`docs/ROADMAP.md`**: línea de estado + versión actual.
5. Si tocas nativo Android **o** quieres APK alineado con la web:
   - `android/app/build.gradle` → `versionName` = `VERSION`, `versionCode` += 1
   - **`MICARTERA_WEBDEBUG=0`** en `android/local.properties` (o borra la clave). Con `=1`,
     `assembleRelease` / `apk:prep` / **`npm run release:apk`** abortan (incidente 2026-08-06:
     APK real con socket de depuración y franja bajo la cámara). CDP a propósito:
     `MICARTERA_ALLOW_WEBDEBUG_RELEASE=1` + assemble a mano — **nunca** publicar esa build.
   - **`npm run release:apk`** (preferido): prep → assembleRelease → verifica aapt + firma
     `CN=Mi Cartera` → sube `Aely-$VERSION.apk` al release `v$VERSION` → escribe
     `public/apk.json` al asset **real**. Alternativa manual: `npm run apk:prep` +
     `assembleRelease` + upload + `apk.json` (misma disciplina). **NUNCA copies `public/` a
     `www/` a mano.** Incidente 2026-07-25: bundle con `APP_VERSION: "dev"` → ese móvil no
     vuelve a actualizarse. `build-www.mjs` aborta si el sellado no cuaja.
   - Circuito completo y trampas: [`docs/RELEASE.md`](docs/RELEASE.md).
6. `npm run build` + `npm test` → **push a la rama `beta`**, NO a `main` (ver abajo) → cuando el
   usuario apruebe desde su móvil, Actions → «Promote beta» lo mezcla a `main`.

### El canal `beta` no es opcional

**Todo cambio que el usuario vaya a NOTAR se publica primero en `beta` y lo prueba él.** El canal
existe desde la 4.8.0 justo para eso, con panel de revisión en el móvil incluido (`docs/TESTING.md`).

Se saltó el 2026-07-25 con la 4.10.0: se pusheó directo a `main` y la estrenó él —y su padre y su
pareja— sin que nadie la hubiera abierto en un móvil. Salió con el splash invisible. Su respuesta:
«¿pa qué tengo el canal beta? ¿no habíamos quedado que siempre pruebo antes de subir nada?».
Publicar a `main` sin su OK convierte a la familia del usuario en el banco de pruebas.

Va directo a `main` **solo** lo que no puede afectar a lo que él ve: documentación, tests y tooling.

**Solo se pushea trabajo TERMINADO y verificado.** Nunca a medias. OTA web ≠ APK: si el fix es Java/Kotlin, sin APK nuevo el móvil no lo tiene.

### ⚠ El promote mezcla con `-X theirs`: revisa el diff, no te fíes del verde

`promote-beta.yml` hace `git merge --no-ff -X theirs origin/beta`. Ese `-X theirs` significa
**«en cualquier conflicto gana beta, sin avisar»**. Se puso el 2026-08-05 porque el promote de la
4.13.0 chocó de frente: `main` llevaba cherry-picks parciales de 4.12.3/4.12.4 (se habían subido
features sueltas antes que la ronda entera) y al mezclar la ronda completa salieron **`USO_OK`,
`gastosForceAll` y `hojaOpen` declarados dos veces**. Un `const` repetido en el mismo ámbito es un
**SyntaxError**: el bundle promocionado no arrancaba, y los tests de la rama pasaban igual porque
el destrozo nace EN el merge, no en ninguna de las dos ramas.

Lo que hay que saber al usarlo:

- **`-X theirs` se traga en silencio todo lo que solo exista en `main`.** No es teórico: ese mismo
  día se perdió la entrada de 4.12.4 del `CHANGELOG.md` y hubo que rescatarla a mano en un commit
  aparte (`1340e53`).
- Los que más lo van a sufrir son **`CHANGELOG.md` y `RELEASE_NOTES`**, porque se escriben siempre
  arriba del todo: conflictan en cada promote y pierden la parte de `main` sin decir nada.
- Después de promocionar, **abre el diff `main` vs `beta` y `npm run test:syntax`** antes de dar por
  buena la subida. Que Actions esté en verde no basta: un duplicado de merge no lo ve ningún test
  de rama.
- La cura de fondo es **no cherry-pickear de `beta` a `main`**: promociona rondas enteras. Cada
  feature suelta que se adelanta deja una mina para el promote siguiente.

## 6 bis. La documentación es parte del cambio, no un extra

**Un cambio no está terminado hasta que la doc que lo describe dice la verdad.** Esta regla ya
estaba implícita en §6 y aun así el README se quedó anunciando **v4.1.0 con la app en la 4.8.0**:
siete versiones de desfase en lo primero que se ve al abrir el repo (lo pilló el usuario, no
nosotros, 2026-07-25). Una regla que solo vive en un `.md` se salta sin que salte nada.

**Por eso los números los vigila un test:** `tests/docs-frescura.test.mjs` (dentro de `npm test`)
falla si `VERSION` no cuadra con `package.json`, `package-lock.json`, la primera entrada de
`CHANGELOG.md`, la primera de `RELEASE_NOTES`, la línea «Estado actual» del `README.md` y la
cabecera + tabla de alineación de `docs/ROADMAP.md`; y si `public/apk.json` no cuadra con
`android/app/build.gradle`. **Si añades otro sitio donde se escriba la versión, añádelo al test**
— si no, es el próximo que se va a quedar rancio.

Lo que el test **no** puede comprobar, y por tanto va en la checklist de quien edita:

| Si tocas… | Actualiza en el MISMO commit |
|-----------|------------------------------|
| Una pantalla o dónde se llega a ella | `README.md` (notas rápidas) y `docs/ROADMAP.md` (dónde vive cada cosa) |
| Estructura de carpetas, scripts o tests | el árbol del `README.md` y `docs/TESTING.md` |
| Un e2e o un módulo de `src/` nuevo | `E2E_MAP` / `CROSSCUTTING` / `CORE` en `scripts/relevant-tests.mjs` (el test aborta si falta) |
| Arquitectura, flujo de datos, sincronizaciones | `docs/ARQUITECTURA.md` |
| Backend, migraciones, secretos o Edge Functions | `docs/SETUP-SUPABASE.md` (y `docs/SETUP-INGEST-TOKEN.md` si es el token) |
| Nativo Android | `docs/SETUP-ANDROID.md` |
| Hogar / gastos compartidos | `docs/HOGAR.md` |
| Algo que el usuario nota | `RELEASE_NOTES` (en cristiano) **y** `CHANGELOG.md` (técnico, con el porqué) |

Y una regla de higiene: **si un documento afirma algo, tiene que ser verificable hoy.** Antes de
copiar una frase de un doc a otro, comprueba que sigue siendo cierta — un doc que miente es peor
que un doc que falta, porque el que viene detrás se lo cree.

## 6 ter. Lo que sabes va al REPO, no solo a tu memoria

Regla suya del 26/7/2026, y con motivo: ese día una sesión del móvil se gastó **medio presupuesto
de tokens** trabajando sobre una rama equivocada. Lo que hacía falta para no hacerlo estaba
escrito… en la memoria local del Claude del PC. Desde el móvil, desde Cursor o desde cualquier
otra IA, eso **no existe**.

> **Él no siempre trabaja desde el PC.** Da igual quién ni desde dónde: si una sesión necesita
> saber algo para no meter la pata, ese algo tiene que estar EN EL REPO.

- Guarda en tu memoria lo que quieras, pero **replícalo siempre**: `npm run memoria` espeja la
  memoria del agente en `docs/memoria/`. Hazlo en la misma tanda en que escribes la memoria, no
  «luego».
- **El repo es PÚBLICO.** Por eso el espejo no es un copiar y pegar: tacha IBAN, correos,
  teléfonos y rutas de Windows, y **aborta sin escribir nada** si algo sensible sobrevive al
  filtro. Si añades un tipo de dato nuevo, añade también su filtro en `scripts/sync-memoria.mjs`.
- El punto de entrada para cualquier agente nuevo es **[`EMPIEZA-AQUI.md`](EMPIEZA-AQUI.md)** (raíz).
  Si aprendes algo que le habría ahorrado tiempo a la siguiente sesión, va ahí.
- Y lo de siempre: el **porqué** de cada cambio al `CHANGELOG`, el **estado** a `docs/ROADMAP.md`,
  las **reglas** aquí. `npm test` vigila que no se queden atrás.

## 7. Verificar de verdad (no «debería funcionar»)

- **Tests automáticos:** `npm test` (sintaxis del monolito con `vm.Script` + lógica financiera, parsers Revolut e ingest). Corre **entero** en CI de `main` y al promocionar. En la rama `beta`, `relevant-tests` recorta por carpetas (docs sin Chromium, ingest sin e2e, Gastos solo sus specs + transversales). Si se toca el núcleo o un workflow, corre todo igual. El mapa vive en `scripts/relevant-tests.mjs`: **un e2e nuevo sin línea ahí no corre al tocar la pantalla**, y el test `relevant-tests` aborta si el spec está huérfano. **No caza un spec mal colgado** (gastos-cajones bajo Hogar → `beta` verde sin abrir Gastos). Un verde en `beta` no pesa lo mismo que en `main`. Módulo nuevo de `src/` igual: o `CORE` o `E2E_MAP`, si no, suite entera + el test falla.
- Sintaxis del monolito: extrae los `<script>` y pásalos por `new vm.Script(...)`. Un `node --check`
  del HTML no vale.
- Pruébalo **en el navegador** con datos reales antes de cantar victoria. En la v3.100.0, el parser
  de metales estaba perfecto y aun así el oro no se auto-emparejaba: eso **no se ve leyendo el
  código**, solo abriéndolo.
- **El Service Worker es stale-while-revalidate**: si recargas y ves código viejo, no estás loco.
  Desregístralo y borra cachés antes de dar nada por bueno.
- Si parseas un fichero (CSV de bróker…), monta un banco de pruebas en Node contra el fichero
  REAL y comprueba el resultado por **dos vías independientes** (así se validó el oro: saldo
  acumulado vs. suma de importes − comisiones, ambas 0,258218 XAU).
- **Si quitas o rediseñas una pantalla, audita sus puertas de entrada.** El rediseño v4 dejó
  huérfanos (código vivo sin camino en la UI) el rol de cuenta, Hogar/Compartido, la huella y
  el cerrar sesión — el usuario tardó un día en notarlo y hubo que recuperarlos (4.1.0).
  Lista qué solo se alcanzaba desde lo que tocas antes de darlo por terminado.
- **`npm test` (unitarios + sintaxis) NO prueba qué se pinta.** Bug real (4.7.1, 2026-07-23): al
  quitar la UI de ordenar brókers, `groups=groupsBase.map(g=>g[0])` convertía las ternas
  `[id,nombre,subtítulo]` en strings sueltos; aguas abajo se leía `g[0]`/`g[1]` como si siguieran
  siendo la terna, así que `g[0]` pasaba a ser la PRIMERA LETRA del id. El filtro por `i.ent` dejó
  de casar nada y **los tres bloques de Cartera → Inversiones desaparecieron**. `npm test` seguía
  en verde (sintaxis y lógica pura estaban bien) y nadie lo vio hasta que el usuario preguntó por
  qué no cambiaba la versión. **Regla:** cualquier cambio que toque qué se PINTA de una lista/
  render derivado del estado (no solo lógica) necesita un e2e que abra la pantalla de verdad y
  compruebe el DOM — no basta con leer el diff y decir «tiene buena pinta». Antes de dar un cambio
  de UI por terminado, pregúntate: *¿qué e2e fallaría si este cambio rompe lo que se ve?* Si la
  respuesta es «ninguno», añade uno (ver `e2e/cartera-inversiones.spec.mjs` como plantilla:
  siembra estado con `seedLoggedInDashboard(page, overrides)` de `e2e/fixtures.mjs`, navega a la
  pantalla real y asere contra selectores del DOM, no contra el código fuente).
- **Open Banking se sincroniza SOLO a demanda** (4.1.0): no reintroduzcas syncs al abrir o al
  volver a primer plano — los bancos lo leen como bot y caducan el consentimiento. El detalle
  de qué syncs siguen vivos está en docs/ARQUITECTURA.md.
- **Updates:** transporte en `12-boot.js`, estado de UI en `useUpdates()` (10-app-components).
  Lógica nueva de updates → al hook, no a efectos sueltos en App.

## 7 bis. Rendimiento: lo que cuesta caro es el TAMAÑO, no la frecuencia

Lección de la 4.8.0, tras el enésimo «cuanto más tiempo uso la app, más lenta va».

- **El estado se guarda PARTIDO.** `expenses` vive en su propia clave (`micartera_v3_exp`) y solo
  se reescribe cuando cambia la REFERENCIA del array. Antes, cada `set()` serializaba el estado
  entero, y ese blob crece cada día con lo que entra del banco y del lector de notis: con 2.000
  gastos son 254 KB por escritura, con 20.000 son 2,5 MB — en la WebView de un móvil, centenares de
  ms de hilo principal bloqueado, cada vez peor con los meses. **No metas los gastos de vuelta en
  la clave principal** ni escribas el estado entero «por si acaso»: usa `mcSaveRaw`/`mcLoadRaw`.
- **Un updater que no toca los gastos NO debe devolver un array de gastos nuevo.** Si construyes
  `expenses` con `.map`/`.concat` y el resultado es idéntico, devuelve el array de antes (mira
  `syncCloudExpenses` y `enrichNotesFromBankTx`). Un array nuevo = re-render de todo + reescritura
  del histórico. Y `syncCloudExpenses` corre en CADA vuelta a primer plano.
- **`set()` sella `_savedAt`, así que el objeto de estado es nuevo SIEMPRE.** Cualquier
  `useMemo(..., [state])` no acierta jamás. Depende de las porciones concretas que leas — y si el
  cálculo usa funciones auxiliares, incluye también lo que lean ellas (ver el comentario de deps
  en el `totals` de `11-app-main.js`).
- **Fechas:** `parseDate` cachea los MILISEGUNDOS, pero **devuelve un `Date` NUEVO en cada
  llamada**. Para comparar y ordenar usa `dateMs()`, que no crea objetos, y nunca construyas
  `Date` dentro de un filtro que recorre el histórico.
  **Y nunca pases un `Date` como prop a un componente con `React.memo`**: la comparación
  superficial falla siempre por esa prop y el memo queda de adorno. Pasa el número y construye el
  `Date` dentro, en la línea que lo formatea. Así estuvo `MovRow` desde siempre —las doce filas de
  Gastos se repintaban en CADA re-render— y no lo cazó nadie hasta perfilar un gesto concreto
  (2026-07-27): se cuidó que el callback fuera estable con `useCallback` y la fecha se coló por
  debajo. La regla vale para cualquier objeto nuevo por render (arrays y objetos literales igual).
- **En un portátil los problemas de rendimiento del móvil NO SE VEN.** Medir el lag que él ve
  daba **cero tareas largas** hasta estrangular la CPU por CDP: `page.context().newCDPSession(page)`
  → `Emulation.setCPUThrottlingRate({rate:6})`. Con eso, «entrar en Deudas y Metas» pasó de
  parecer instantáneo a enseñar 171 ms de hilo bloqueado, que es justo lo que él describía.
  Las tareas largas se recogen con un `PerformanceObserver({entryTypes:["longtask"]})` sembrado
  en `addInitScript`.
- **Y ojo con medir a Playwright en vez de a la app.** El primer perfil de CPU señalaba a
  `getBoundingClientRect` con 350 ms de tiempo propio, y no era nuestro: `locator.click()` y
  `waitFor()` sondean el DOM desde el script inyectado de Playwright mientras esperan. Para
  perfilar, click CRUDO desde la página (`page.evaluate(() => el.click())`) y espera a ciegas
  (`waitForTimeout`); las esperas que sondean van DESPUÉS de parar el perfilador.
- **Y con gestos táctiles, tres trampas más** (aprendidas quemando una sesión entera midiendo
  cosas que no eran el gesto):
  1. **Espera a que se vaya el splash.** `#mc-load` tapa la pantalla ~0,5 s y es hermano de
     `#root`, así que `.botnav` puede estar ya en el DOM con el splash todavía encima. Un
     arrastre lanzado antes ni siquiera entra en `.viewport` — el `touchstart` cae sobre el
     splash y parece un gesto «perdido» que no lo es:
     `await page.waitForFunction(() => !document.getElementById("mc-load"))`.
  2. **Comprueba que el gesto ATERRIZA; si no, tira la muestra.** Hay zonas que se tragan el
     swipe a propósito (`stopSwipe`: chips de Gastos, scrollers, el gráfico de Inicio). Un
     arrastre ahí no mueve el track: su medida es ruido, no un dato. Se comprueba mirando si
     `.botnav-tab.active` cambió de `data-tour`. En viewport de Pixel 5, `y=200` sirve en Inicio
     y en Gastos; `y=320..440` NO sirve en Gastos. Y el gesto hacia atrás tiene que empezar
     fuera de la franja de borde (`EDGE_OPEN`=52 px) o lo que se abre es **Ajustes**.
  3. **No midas tiempos con el perfilador puesto.** A 6× de freno, `Profiler` a intervalo corto
     distorsiona más de lo que mide: dejaba en ~150 ms pasadas que sin él iban a 17 ms. Para
     atribuir trabajo, `Tracing` (`devtools.timeline`) y acota el gesto con `console.timeStamp`,
     que un `Layout` gordo TRAS el `touchend` no le quita ni un frame al dedo.
- **Si el banco de pruebas no reproduce el fallo, el problema es el banco, no el código** (2026-07-27).
  Dos tandas seguidas de arreglos «medidos» no le llegaron al usuario porque la métrica era la
  equivocada: se medían TAREAS LARGAS y su síntoma eran TIRONES, que son frames de 100 ms sin
  tarea larga ninguna. Mide deltas de `requestAnimationFrame` y cuenta los frames >32 ms.
  Y ojo con reproducir el escenario DE VERDAD: la app ignora los eventos de scroll mientras hay un
  dedo puesto (`onPageScroll`), así que con toques sintéticos la barra inferior no se esconde nunca
  y el caso que el usuario describe no llega a existir. En un móvil la esconde la inercia al soltar.
  **Antes de optimizar nada, comprueba que tu medida distingue el caso bueno del malo que él cuenta.**
- **Antes de decir que algo va más rápido, MÍDELO A/B** contra `main` (`git archive HEAD` a un
  temporal, `build-app`, `serve` en otro puerto y dos pasadas del mismo guion en Playwright). En la
  4.8.0 el primer intento daba 1,1-1,5× y parecía poco; medir los BYTES escritos por vuelta a
  primer plano fue lo que enseñó dónde estaba el problema de verdad.

## 8. Cobertura e2e: pendiente ampliar (no solo brókers)

Hoy `e2e/` cubre: arranque/onboarding, el sheet de «Apuntar», borrar cuenta, la animación de
perfil y (desde 4.7.1) los bloques de brókers en Cartera. El resto de listas derivadas del estado
— Deudas y Metas (`09-tab-debts-goals.js`), Fijos (`07-tab-patri-fijos.js`), Hogar/Compartido
(`13-hogar.js`), «Tus cuentas» en Cartera — pueden sufrir el mismo tipo de bug que los brókers
(un `.map` que cambia de forma y deja de casar downstream) sin que ningún test se entere, porque
son render puro y `npm test` no abre pantallas.

**Si tocas o rediseñas cualquiera de esas listas, añade un e2e** siguiendo el patrón de
`e2e/cartera-inversiones.spec.mjs`: siembra estado con `seedLoggedInDashboard(page, overrides)`
(acepta overrides desde 4.7.1 — no dupliques el objeto de estado entero), navega a la pantalla
real y asere `toHaveCount`/`toContainText` contra el DOM, no contra el código. **Y en el mismo
commit**, una línea en `E2E_MAP` (o `CROSSCUTTING` si no es de una pantalla) — si no, en beta no
corre al tocar ese módulo. No hace falta migrar todo de golpe: añade cobertura de la zona que
toques, así el hueco se va cerrando solo.

**Estado en 4.8.0: el hueco de §8 está cerrado** (Deudas, Metas, Recibos y «Tus cuentas» tienen
e2e en `listas-render.spec.mjs`). El suite pasó de 10 a 34 pruebas. Mapa de lo que hay:

| Fichero | Qué protege |
|---------|-------------|
| `smoke` · `apuntar-sheet` · `profile-anim` · `delete-account` | arranque, hoja de Apuntar, perfil, borrar cuenta |
| `cartera-inversiones` | bloques de brókers (regresión de 4.7.1) |
| `listas-render` | Deudas, Metas, Recibos y cuentas + banner de bancos caídos |
| `gastos-concepto` | concepto del movimiento en lista, ficha y buscador |
| `gastos-cajones` · `gastos-diario-filtro` | qué cuenta / no cuenta, y que el filtro arranque con TODOS los bancos de gasto diario |
| `persistencia` | guardado partido, migración del formato viejo y que volver a primer plano no reescriba el histórico |
| `modo-pruebas` | que el banco de pruebas NO toque la cartera real |
| `csp` | que la política de seguridad no bloquee nada de la app (rompe en silencio) |
| `rendimiento` | que el trabajo no se dispare con un histórico grande |

Notas de fontanería para escribir e2e aquí:
- **Solo hay CUATRO pestañas** (`tabOrderOf`): `inicio`, `gastos`, `plan`, `cartera`. Deudas, Metas
  y Recibos están DENTRO de Plan, en `.v4-seg-btn` — no hay `data-tour="metas"`.
- Apuntar va por `.botnav-fab` y **teclado propio** (`.v4-keys button`), no por un `<input>`.
- `page.addInitScript` se re-ejecuta en CADA carga, también tras un `location.reload()`. Si el test
  siembra algo que la app va a cambiar, mete un guardo (`_e2eSeeded`) o nunca verás el cambio.
- Para comprobar si algo se reescribió, **envuelve `localStorage.setItem` y cuenta**. Marcar un
  array con una propiedad no vale: `JSON.stringify` de un Array tira todo lo que no sea índice.
- El binario de Chromium se puede fijar con `PLAYWRIGHT_CHROMIUM_PATH` (entornos con uno ya
  instalado y una versión de Playwright que espera otra build).

`npm test` también corre ahora **`i18n-keys`** (hace cumplir §4: toda clave usada existe en los
tres idiomas y con los mismos `{placeholders}`) y **`security`** (invariantes que no se ven en un
diff: que toda escritura nueva de `cloud` esté en `CLOUD_WRITES` —si no, el modo pruebas escribiría
en producción—, que ninguna credencial salga de `Math.random()` y que la CSP conserve lo que
importa).

## 9. Privacidad y dinero

- Repo **público** (lo exige Pages gratis) → **jamás** un secreto, una clave ni datos personales
  en el cliente ni en el repo. Los CSV de extractos del usuario **no se commitean nunca**.
- Los CSV se procesan **en el móvil**, no se suben a ningún sitio. Que siga así.
- Los importadores **nunca pisan a ciegas**: previsualización + el usuario mapea + solo se toca lo
  mapeado. Si un dato no viene en el extracto (p. ej. el coste del oro), se respeta el que hubiera
  (`if(po.cost!=null) patch.cost=po.cost;`) y se explica en la UI.
