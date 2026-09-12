<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (mi-cartera-roadmap.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: mi-cartera-roadmap
description: "Estado actual y backlog de Mi Cartera. ⚠ 2026-08-17 (vuelta del crucero): lo que la FAMILIA tiene NO es lo que dice el repo — Pages sirve 4.15.0 y apk.json live apunta a 4.12.0/código 35 desde el outage de Actions del 6/8. Beta = 4.16.2 / APK 40 (widget coherente), pendiente de su veredicto. Histórico largo debajo, sesión a sesión. ⚠ Las Edge Functions solo se despliegan al pushear a main: un fix en beta está INERTE."
metadata:
  node_type: memory
  type: project
  originSessionId: e1dc0ffc-f316-4885-bf7c-1e694f8b4d24
  modified: 2026-08-17T15:14:57.676Z
---

**★ 2026-08-17 — VUELTA DEL CRUCERO. Lo primero: lo que la familia tiene ≠ lo que dice el repo.**

Medido con `curl` al empezar, no supuesto:

| | Repo | **Live (Pages)** |
|---|---|---|
| `version.json` | 4.16.2 | **4.15.0** |
| `apk.json` | 40 / 4.16.2 | **35 / 4.12.0** |

Los 3 runs de `deploy.yml` del 6/8 murieron con `The job was not acquired by Runner of type hosted`
— **outage de Actions, no un build roto**: relanzar basta, no hay nada que arreglar en el workflow.
⚠ Consecuencia que cambia diagnósticos: **el móvil del padre corre el NATIVO de 4.12.0**, sin lector
de Google Wallet y con el widget/`TrExpenseListener` viejos. Cualquier bug suyo medido contra eso es
un fantasma. Se relanza Pages al promocionar la 4.16.2.

**Tanda `widget-coherente` (4.16.2 / APK 40) en `beta`, pendiente de su veredicto.** Su bug del
crucero: el widget decía «891 € de 1.000 · te quedan 109» y debajo «Puedes gastar 324 €»; al abrir
la app se arreglaba y al rato volvía. **No era un cálculo malo: eran DOS ESCRITORES de las prefs del
widget que no escribían lo mismo** — `updateWidget` (app abierta) ponía las cinco cifras a la vez y
`saveMonth` (lector de notis, app CERRADA) solo `spent`+`budget`, dejando `afford`/`cash` del push
anterior. Arreglo: `build()` calcula `min(budgetLeft, safeLiq)` desde primitivas que mantienen LOS
DOS caminos; `ingest` manda `budgetLeft`+`counts`; `saveMonth` baja `safeLiq`/`cash` restando el
importe. **Deliberado NO portar `safeLiq` al servidor** (sale de simular el mes con fijos/deudas/
traspasos): sería la tercera copia de la misma regla — ver [[misma-regla-en-dos-sitios]].

⚠ **Sin cerrar: el salto 891 vs 686 (Δ 205 €).** Cliente y servidor comparten fórmula (verificado),
así que viene de **datos de entrada distintos**. Sospecha: `ingest` calcula sobre el `app_state` de
la NUBE, que puede ir por detrás del móvil. Se cierra simulando contra su nube real, no leyendo
código. El Revolut −204,54 € del padre va aparte (tanda 1b): `pickBankBalance`
(`08-motor-bank.js`) recorre `ITAV→XPCD→CLBD→OTHR→PRCD` y **cae a `balances[0]` a ciegas** si no
casa ninguno, sin mirar tipo ni fecha.

**Trampas de tooling que costaron media hora (ya arregladas en `scripts/release-apk.mjs`):** Git
Bash deja `NoDefaultCurrentDirectoryInExePath=1` en el entorno, y **lo heredan también los procesos
lanzados desde PowerShell** — con esa variable `cmd.exe` NO busca ejecutables en el cwd, así que
`gradlew.bat` a secas peta con «no se reconoce como un comando interno o externo» aunque el fichero
esté ahí. Y `apksigner.bat`, al ir por `cmd` sí o sí, perdía las comillas y partía «E:\Mi cartera»
por el espacio, dando por NO firmada una APK con `CN=Mi Cartera` perfectamente válida. Los dos:
ruta absoluta + comillas a mano.

**El plan de la vuelta vive en el repo**, no aquí: [`docs/briefs/plan-vuelta-crucero.md`] — 10
tandas ordenadas (lo escribió Cursor, revisado y corregido por Claude Code el 17/8) con el reparto
Claude Code (dinero/nativo/nube de punta a punta) vs Cursor (anchura mecánica: categorías × 3
idiomas, i18n, reutilizar UI).

**★ SESIÓN 2026-08-03 TARDE — segunda vuelta tras probarlo TODO, hallazgos gordos.**
Reabrió con los veredictos de su prueba real (`node scripts/errores.mjs --kind=beta`): aprobó
`reservar` y `temporada` (4/4 cada una), rechazó `bancos` (signo de TR SIGUE mal + import
histórico "va como el culo", duplicados al revés), `plan-swipe` ("al ir hacia abajo se vuelve
loco y cambia también de tabs") y `tutorial-gestos` ("quería el tutorial DINÁMICO del principio
de la app, no una tarjeta fija — y ese tutorial viejo está bugueado, sale descuadrado").

1. **★★★ CAUSA RAÍZ DEL SIGNO DE TR, POR FIN: nunca se había desplegado.** Las Edge Functions de
   Supabase se despliegan SOLO al pushear a `main` (`.github/workflows/supabase.yml`, sin canal
   beta propio) — el fix de `Math.abs()` en `mapTransaction` (diagnosticado bien el 31/7, con test
   unitario desde entonces) llevaba TRES DÍAS viviendo solo en la rama `beta`, nunca desplegado:
   cada "arreglo" se probó contra el código viejo sin abs(), así que nada podía cambiar. Desplegado
   hoy directo a `main` (commit d6a6f90, `supabase/functions/_shared/enablebanking.ts` +
   `bank-sync/index.ts`, verificado con `gh run watch`) — trae también detección de "compra con
   tarjeta" en cualquier idioma y diagnóstico ampliado (payload crudo de TR a `app_events`) por si
   abs() no basta del todo. **LECCIÓN para cualquier fix de `supabase/functions/`: no basta con
   que esté en beta, hay que promocionarlo a `main` aparte — no hay entorno de pruebas para Edge
   Functions.** Pendiente: que sincronice TR una vez más para confirmar con certeza.
2. **Excel de su madre analizado — no es un bug de detección, es otra FORMA de datos.**
   `Contabilidad de casa.xlsx` (16 años, 33 hojas: una "Año YYYY" por año 2010-2026 + hojas
   "Colegio_El Corte Inglés YYYY" sueltas) reveló DOS cosas:
   - **Bug real, arreglado**: `hojaLeer` (15-import-hoja.js) cogía en silencio la hoja con MÁS
     filas — con 33 hojas eso NUNCA es "la que quieres" (aquí habría cogido "Año 2025", no "Año
     2026" que es la actual). Ahora, con más de una hoja con datos, se pregunta por nombre real
     (nuevo `xlsxNombresHojas`, cruza `workbook.xml`+`rels`) en vez de adivinar — con una sola
     hoja sigue sin preguntar nada, cero fricción de más.
   - **Fuera de alcance, y así se le dijo**: la hoja "Año 2026" en sí NO es una lista de
     transacciones — es una MATRIZ pivote (filas = códigos de categoría sin nombre legible tipo
     "14"/"301", columnas = meses, celda = total del mes). Ningún detector de columnas puede
     adivinar eso: hace falta una tabla plana (fecha+concepto+importe por fila), que es un formato
     de datos distinto, no un problema de heurística. Si en algún momento quiere convertir ESE
     fichero en concreto, hace falta que diga qué significa cada código de categoría (no está en
     el fichero) — tarea aparte, muy a medida, no una mejora general del importador.
3. **`plan-swipe` arreglado**: el gesto vertical de Plan y el swipe horizontal de `.viewport`
   (11-app-main.js) escuchaban el MISMO touchmove por separado, cada uno decidiendo el eje a su
   aire con el mismo umbral 1.25× — un tirón con deriva lateral (normal con el pulgar) podía
   convencer a los dos a la vez. Fix: `e.stopPropagation()` en `14-v4-screens.js` en cuanto el
   gesto de Plan se declara vertical (mismo idioma que `stopSwipe` de los chips de Gastos). Test
   nuevo que reproduce el caso real (dx=40 de deriva) en `e2e/plan-swipe-segmento.spec.mjs`.
4. **`tutorial-gestos` en rehecho**: lo que quería de verdad era el tour dinámico existente
   (`Tour` en `02-ui-shared.js`, ya reabrible desde Ajustes con el botón 🎓) con pasos de gestos
   añadidos, no una tarjeta nueva — y ese tour viejo estaba realmente desalineado (selectores CSS
   obsoletos tras varios rediseños). Agente en curso arreglando ambas cosas a la vez.
5. **Import histórico bancario "duplicados al revés"**: sin confirmar aún si era 100% el signo de
   TR (ahora arreglado) o si `histCandDupKey`/`histCandExisting` (08-motor-bank.js) tiene además
   un bug propio — revisado el código y parece correcto (deriva el signo de `x.kind`, no del
   amount crudo), así que la hipótesis fuerte es que era el signo. Pendiente confirmar con su
   próxima prueba.
6. Le mandé un `.docx` de prueba (tabla Fecha/Concepto/Importe, 10 filas realistas) para que
   pueda probar el importador de Word sin tener que buscarse un documento él mismo.

**★ SESIÓN DEL 2026-08-03 — «dale caña a todo», resumen para continuar en frío.**
El usuario llegó con 7 bugs + 6 features nuevas de golpe, pidiendo explícitamente NO ir uno a uno
sino repartir en tandas paralelas (autorizó subagentes sonnet/haiku para lo mecánico). Hecho esta
sesión, en orden:
1. **Promocionada `import` a producción como 4.12.4** (commit 492c1dc en `main`, misma receta
   quirúrgica que la 4.12.2 con `arranque`: sin ramas `tanda/<id>`, se separó a mano de entre los
   commits mezclados de `beta` con ayuda de un subagente Explore que mapeó fichero a fichero qué
   línea era de import y cuál de gestos/bancos). `docs-frescura` obligó también a: package-lock.json
   (`npm install --package-lock-only`), README/ROADMAP «Estado actual», y `npm run memoria` (el
   guardián `memoria-espejo` en `npm test` pincha si el espejo de `docs/memoria/` no está al día —
   nuevo desde esta sesión, ver `scripts/run-tests.mjs`). Tanda `import` QUITADA del array
   `tandas` de RELEASE_NOTES en beta + sus 3 bullets quitados de los `items` de la 4.13.0 (misma
   regla que arranque, para no contarle la novedad dos veces a la familia).
2. **Arreglado en `beta` (commit 334ec65), pendiente de su prueba real**: el banco de GASTO DIARIO
   ahora mete CUALQUIER cargo en Gastos (no solo compras con tarjeta — el regex de detección de
   tarjeta era solo español, con TR/bancos que avisan en inglés se perdía en silencio), salvo que
   case con un Fijo/deuda/puntual ya modelado ese mes (evita doble conteo); los INGRESOS entran de
   CUALQUIER banco enlazado (no solo el de gasto), para que «Mi ciclo» encuentre la nómina de la
   pareja aunque caiga en un banco distinto al de TR; el filtro de banco en Gastos arranca ya
   marcado en el banco de gasto diario en vez de «Todos»; suscripciones detectadas ahora se pueden
   DESCARTAR (botón, `state.subsDismissed`) y el importe es editable antes de pasar a Fijos (pedido
   suyo: recibos variables como luz/gas). **EL SIGNO DE TR SIGUE SIN CERRARSE CON CERTEZA**: el
   fix de `Math.abs()` en `mapTransaction` (intento anterior, rechazado) no basta si TR manda el
   `credit_debit_indicator` YA mal para ciertos movimientos — en vez de adivinar otra vez (misma
   trampa que costó 7 alphas en [[tr-frio-saga]]), se amplió el diagnóstico en `bank-sync/index.ts`
   (`logObAmbiguous`) para loguear el payload CRUDO de TODO movimiento de TR a `app_events` — hace
   falta que él sincronice TR por Open Banking UNA vez más para leer el dato real con
   `node scripts/errores.mjs --grep="epublic"` y cerrarlo sin volver a fallar en falso.
3. **Repartido en 6 agentes paralelos (worktrees), 4 ya fusionados en beta y subidos (commit
   76ee1a3)**: swipe vertical en Plan (Recibos→Deudas→Metas→Recibos, en `14-v4-screens.js` — NO en
   `09-tab-debts-goals.js` como se pensaba al principio), tutorial de gestos en Ajustes
   (`GestureCoach`, mismo mecanismo que `TabCoach`), temporadas sin lluvia (quitado `.season-fx`
   entero, sustituido por un detalle `::after` incrustado en `.v4-title` por temática, mismo
   mecanismo que los iconos de tab), y rediseño de importar histórico bancario (arregló el bug real
   de que el filtro de banco no filtraba — `BankPanel` pasaba TODOS los enlaces sin filtrar — más
   filtros ingreso/gasto/mes y dedup con comparación tipo Excel). Yo mismo hice la 5ª: **"Reservar
   dinero"** (`reservaPlanFor`/`applyReserva`/`reservedSince` en `08-motor-bank.js` + UI en Metas,
   09-tab-debts-goals.js) — reglas fijo/% que al detectar nómina reparten a metas, con confirmación
   siempre manual, y lo reservado se resta del presupuesto de Gastos (antes las metas eran un bote
   aparte que no tocaba el presupuesto). Subido el presupuesto de bundle 310→340 KB gzip (justo,
   con motivo escrito) tras meter 4 tandas en un día.
   **PENDIENTES de fusionar** (agentes aún corriendo en worktrees separados, se resumieron una vez
   tras agotar la sesión de uso): rayita atraviesa el + a velocidad alta + rebote raro (gestos,
   `agent-a6e6780e7367ee4b2`), importar PDF/Word de gastos (`agent-aed3966cb555a1cac`).
   **LECCIÓN de esta ronda**: correr `npm test` con varios agentes en paralelo en la misma máquina
   da MUCHOS falsos negativos en el e2e de Playwright (ERR_CONNECTION_REFUSED / timeouts por
   contención de CPU/puerto 4173) — antes de dar por rota una tanda nueva, reintentar en aislamiento
   (`npx playwright test --workers=1 <spec>`) mientras otros agentes sigan corriendo.

**★ SESIÓN DEL 2026-08-01 (larga, varios turnos) — resumen para arrancar en frío.**

**PRODUCCIÓN = 4.12.3.** Primera vez que se sube una tanda SOLA, no la ronda entera —petición
suya: «que se pudieran subir a prod por features, no solo tandas enteras». `arranque` (5/5
aprobada) se separó A MANO de los ~950 líneas mezcladas de toda la 4.13.0 (import/gestos/arranque/
bancos se commitearon juntos, sin ramas `tanda/<id>`, así que no hubo cherry-pick limpio posible:
hubo que reconstruir cada cambio sobre `main` directamente). Lleva: el nombre ya no cambia de
Georgia a Fraunces a la vista (causa real de «algo raro antes del icono», llevaba días
reportándolo), el patrimonio cuenta visible al abrir (`mc-splash-gone`), el logo se va ANTES que
el fondo (ya no flotan las dos pantallas a la vez), temporadas de una sola caída corta. Costó DOS
saltos de versión de más (4.12.1→4.12.2→4.12.3) por un fallo propio: al arreglar docs tras la
4.12.2 un rebuild local re-selló `sw.js`, y el guardián `docs-frescura` (que compara
`git log <últimoBumpDeVERSION>..HEAD` contra una lista de "zonas publicables") lo cazó como
«código sin bump». Aprendido: **NO rebuildear/re-stampear artefactos en un commit que no lo
necesita** — si solo cambian .md, no toques `public/`.

**BETA = 4.13.0, con `arranque` y `canal` YA QUITADOS del array `tandas`** (ver
[[feedback-tandas-desaparecen-al-subir]] — regla suya: aprobada+subida se BORRA, no se marca
hecha). Quedan `import` (nunca revisada, sin veredicto — no tiene Excel para probarla, se le
mandó un CSV de ejemplo en `Documents/Mi-Cartera-fuera-del-repo/prueba-import/`), `gestos`
(rebote arreglado de raíz, ver abajo — pendiente su prueba) y `bancos` (dos arreglos nuevos,
pendiente re-test: sync automático al cambiar banco de gasto diario vía evento
`mc-bank-role-changed`, y el error mudo de conectar TR por Open Banking ahora se registra en
`app_events` aunque la causa de fondo —si Enable Banking lo rechaza de verdad— sigue sin
diagnosticar sin que él lo intente de nuevo).

**EL REBOTE ERA EL NAVEGADOR TODO EL TIEMPO — tres rondas de rechazo por una premisa falsa.**
Descripción final suya, exacta: «cuando bajas hasta abajo del todo y tiras más, se ve como un
efecto OLA de todas las cosas que hay en pantalla — eso es lo que quiero, lo mismo que Ajustes y
el perfil». Y Ajustes/el perfil (`.settings-push`/`.settings-slide`) NUNCA tuvieron un rebote
nuestro: nunca tocan `overscroll-behavior`, corren con el rubber-band NATIVO de Chromium/Android.
`.page` (las 4 pestañas) era la ÚNICA zona con `overscroll-behavior-y:none`, puesta el 28/7 sobre
la premisa —nunca comprobada— de que «la WebView no hace rubber-band, hace un fogonazo». Falsa: se
quitó el `none` y el rebote JS entero (`reb`, `REB_MAX`, `soltarRebote`, en `11-app-main.js`), y
ahora las pestañas usan LITERALMENTE el mismo mecanismo que Ajustes. Si algún día alguien propone
«mejorar la curva del rebote de las pestañas» otra vez: NO — no hay curva propia, es el navegador.

**⚠ EL SPLASH SIGUE SIN CERRAR — visto en vivo por primera vez con la APK debug, y son DOS
RENDERS DE VERDAD, no una sensación.** Se añadió la API de splash de Android 12+
(`windowSplashScreenBackground`/`AnimatedIcon` en styles.xml + `SplashScreen.installSplashScreen()`
en MainActivity) para que el sistema no dibujara su propio splash genérico antes del nuestro — y
efectivamente ya no sale genérico, pero sale EL ICONO SUELTO (sin la tarjeta redondeada+brillo que
tiene el splash JS) y LUEGO el splash JS con tarjeta+texto. Dos apariciones visualmente distintas
del logo, una detrás de otra. Pendiente: unificar el icono nativo (`ic_launcher_foreground` u otro
drawable) para que tenga la MISMA pinta que `.mcl-mark` (tarjeta redondeada `var(--sur)` + borde +
icono mint), o simplificar el JS para que coincida con el nativo — decidirlo viéndolo con él en
directo, no a ciegas. Dos cosas más que vio en la captura y que probablemente NO son la app: un
anillo fino arriba-centro (hipótesis: MIUI/HyperOS resalta el recorte de la cámara frontal sobre
fondos muy oscuros y uniformes) y un icono arriba-izquierda (hipótesis: indicador de grabación de
pantalla, porque él estaba capturando). Pedirle que compruebe si también salen en la app REAL
(no solo la .debug) para confirmar que es del sistema.

**APK DE PRUEBAS `.debug` — nueva capacidad, ver [[mi-cartera-android-build]].** Se puede compilar
y hasta instalar por USB (adb) desde este portátil, sin pasar por una release pública. Se instala
EN PARALELO a la app real (`applicationIdSuffix ".debug"`), así que no hay riesgo de tocar sus
datos de verdad. Úsalo la próxima vez que haga falta probar algo nativo (splash, widget, permisos)
antes de comprometerse a una APK pública.

**EL WIDGET Y EL -2€ QUE NO SE RESETEABA (pareja, día 1 de mes)**: arreglado con dos cambios
nativos —`MiCarteraWidget.build()` compara el mes de `updated` contra el mes de AHORA y si no
coincide pinta como si no hubiera datos en vez de mentir con la cifra vieja; `updatePeriodMillis`
0→6h como red de seguridad—. Va en el mismo build que el splash: **pendiente de que él lo pruebe**
con la APK debug o con una release nueva.

**⚠ HABÍA UN IBAN REAL SUYO PUBLICADO EN EL REPO (público).** `revolut-settings-swipe.mp4`
—vídeo con su nombre completo, IBAN a pantalla completa, foto, @usuario— llevaba desde el 17/7 en
el histórico. Se sacó de HEAD y se reescribió el historial completo con `git filter-branch` +
push forzado a TODAS las ramas/tags (con bundle de seguridad guardado antes en
`Documents/Mi-Cartera-fuera-del-repo/backup-antes-de-reescribir/`). ⚠ **QUEDA UN CABO SUELTO**:
GitHub guarda refs ocultas de los PR #21/#22 mergeados que todavía apuntan a los commits viejos, y
no se pueden borrar ni desde la web ni por API — hace falta un ticket a GitHub Support (texto ya
redactado en esa sesión). Comprobar si ya lo resolvió.

**★ v4.12.1 EN PRODUCCIÓN 2026-07-28 (merge d0d62b6, Pages verde, `version.json` = 4.12.1 verificado con curl; sin APK nueva — es OTA sobre la 35).** Lleva los 4 arreglos de CURSOR: Ajustes solo desde Resumen (el borde lo abría en cualquier pestaña), sin el candado de 450 ms al llegar a Resumen, el perfil ya no se queda sordo al tercer gesto, y la lista de Gastos no se para al bajar rápido (centinela a 2.000 px y tandas de 60). **Y EL TIRÓN DEL GESTO ESTÁ RESUELTO: lo cerró Cursor** con `d0f3b1f` («asentar el carrusel con rAF — el tirón era la transition CSS a 120 Hz») + `3d83a87` (Deudas→Gastos no re-pinta Expenses al aterrizar), ya en producción desde la 4.12.0. ⚠ Él dudaba entre la .47 y la .48: **la .48 es 3bf1428 y es la ÚNICA que toca la paginación de Gastos** (600→2.000 px de antelación, tandas 24→60), o sea la que ARREGLA su síntoma; la .47 es el código sin eso, que es justo el estado del que se quejó esa mañana. Si alguna vez nota un tope al cargar la tanda, el número a bajar es `PAGE_SIZE*5` en `04-tab-gastos.js`.

**★ DOS TRAMPAS DE PUBLICAR, ARREGLADAS EL 2026-07-28 (las dos hacían fallar la subida a producción).** (1) **`git checkout beta` en `promote-beta.yml` cogía el TAG `beta`** —el de la release rodante de pruebas— **y no la rama**: la suite que justifica publicar a la familia llevaba semanas corriendo contra un árbol viejo. Ahora `git checkout -B beta origin/beta`. (2) El paso que arranca Pages moría con **403 «Resource not accessible by integration»**: faltaba `actions: write` en los permisos, y la promoción dejaba `main` mergeado con producción sirviendo lo viejo (el fallo silencioso que ese paso existe para evitar). (3) Aparte: **la prueba `debts` se caía los días 28-31 de cada mes** (creaba una financiación con `day:28` esperando 4 cuotas pendientes) → cuatro días al mes NO se podía publicar sin que nada estuviera roto. Arreglada con el día calculado.

**★ v4.13.0 EN `beta` 2026-07-28 (madrugada) — TANDA DE COSAS NUEVAS, él durmiendo.** Cerró los dos pendientes gordos desde el móvil: «lo del tirón al deslizar ARREGLADÍSIMO, esa es la versión 4.12 que Cursor arregló» y «lo del perfil también va ULTRA FLUIDO, arregladísimo sin stoppers, eso de la 4.12.1». **El expediente del tirón se cierra de verdad** — `LAG-DESLIZAR.md` se queda por lo que enseña sobre CÓMO medir, no porque quede nada. Lo nuevo: **importar hojas de gastos** (.xlsx SIN librería — un xlsx es un ZIP con XML, se lee el directorio central a mano y se descomprime con `DecompressionStream("deflate-raw")`; ~120 líneas contra 400 KB de SheetJS, con el bundle al 96 % de presupuesto), **duplicados** por día+importe al céntimo+comercio normalizado (sin el comercio, dos cafés de 1,20 € del mismo día se comen entre sí; con la hora no casa nada) y contra el propio fichero además del histórico; **rebote** al final de las 4 pestañas dibujado a mano (la WebView no hace rubber-band, hace fogonazo) con sus dos vetos respetados —de lado nada, y arriba apagado en Resumen porque ahí abre el perfil—; **la rayita salta por encima del +** (el FAB va de y=−28 a +30, el indicador en top:−9, subirlo 26 px lo libra por 7); iconos de tab animados solo AL ENTRAR; temporadas que dan dos vueltas y paran, con racha nueva en cada cambio de pestaña; halo del + de `box-shadow` (repinta la barra cada frame) a anillo `::after` con opacity+transform. **Arranque**: el nombre del splash esperaba a Fraunces (el `font-display:swap` cambiaba la forma a la vista = «lo raro antes del icono»), y el contador del patrimonio arrancaba DETRÁS de la cortina — ahora espera a `mc-splash-gone`. ⚠ **PREGUNTA ABIERTA para él**: si lo raro que ve es ANTES de eso, es el splash NATIVO (`styles.xml` usa `Theme.SplashScreen` solo con `android:background`, sin `windowSplashScreenBackground`/`AnimatedIcon`) → APK nueva, no OTA. NO TOCADO sin confirmar.

**★ CANAL BETA: el 52 arreglado (2026-07-28).** El sufijo salía de `GITHUB_RUN_NUMBER`, contador GLOBAL que no se reinicia: la 4.12.1 se anunciaba «4.12.1.52» en su PRIMERA compilación. Ahora cuenta compilaciones de esa versión leyendo el título de la propia release (`Beta X.Y.Z.N` → +1; base nueva → 1). ⚠ **El sufijo NO se puede quitar** y queda escrito para no reintentarlo: `_mcNewerVer` compara número a número, así que una beta llamada igual que la estable NO se ve como nueva y el móvil no la baja jamás. Y **el panel de revisión se calla cuando lo que corre ya está en producción** (`_mcProdVersion` pregunta a Pages): promocionar ES aprobar, pedirle que apruebe otra vez lo que él subió es ruido que parece trabajo pendiente.

**★ DE LA REVIEW EXTERNA, HECHO (4.13.0):** métricas de uso `cloud.logUso` con **vocabulario CERRADO** (`USO_OK` en 00-core — con etiqueta libre, el primer `logUso("gasto en "+comercio)` se lleva el nombre de una tienda a la nube), observabilidad `logPerf` solo de lo que Supabase no ve (pasa en el móvil), **`npm run salud`** (alineación de versiones + APK viva + qué sirve Pages DE VERDAD + beta por delante/detrás + commits sin promocionar + errores 24h/7d), **`docs/AMENAZAS.md`** (13 amenazas; el único ROJO es validar la entrada de las 10 Edge Functions) y **`docs/adr/`** (5 decisiones retro). Quedan abiertas las tres que salen de AMENAZAS: validar entrada, auditar logs, extender rate limit.

**★ EL GESTO SIGUE FALLANDO TRAS LA .38 — «sigue exactamente igual que cuando comenzamos» (2026-07-27 noche).** ⚠ **Lo primero que hay que leer es `docs/LAG-DESLIZAR.md`, que ahora empieza por el estado real.** Su repro: **Gastos ARRIBA DEL TODO + moverse RÁPIDO por Deudas + volver a Gastos**. Esa noche se arreglaron DOS fallos reales, medidos antes/después en su móvil por CDP, y **ninguno era la causa de lo que él siente**: (1) un candado que dejaba la app BLOQUEADA si el navegador cancelaba el gesto (scroll muerto: 473→473→473, revivía con el gesto siguiente), y (2) el navegador quedándose **174 de 185 gestos** por el listener pasivo de React —el MISMO agujero que se arregló en el perfil el 18/7 y que a las pestañas no se les aplicó nunca— que hacía que **6 de cada 18 arrastres volvieran a la pestaña de la que salían**. Tras el arreglo: **0 cancelados de 99 toques, 0 arrastres que vuelven**… y él lo sigue notando igual. **DESCARTADO CON NÚMEROS (no repetir): 0 tareas largas de JS, 9-12 frames perdidos en 60 s, y el veredicto de frames de Chromium en el desliz de vuelta 0,75 % (caso malo) vs 0,99 % (caso fluido) = NO HAY DIFERENCIA.** Siguiente sospecha, la que encaja y nunca se ha medido: **lo que pasa al ATERRIZAR en Gastos arriba del todo** (la cabecera entra con `rise .32s` y `v4bar .8s` mientras el carrusel todavía se desliza = dos movimientos a la vez; con Gastos bajado esa cabecera no se ve, que es justo su caso «ultra fluido»). Herramientas de medida ya en el repo: **`tools/movil/`** (+ las cuatro trampas: `gfxinfo` miente en WebView, la traza provoca el tirón, los huecos del screencast no son parones, `input swipe` no reproduce su caso). Su móvil lleva una APK de casa con la inspección abierta; la del CI no. Ver [[depurar-webview-en-su-movil]].

**★ CANAL BETA: DOS causas, no una (2026-07-25).** La 4.10.1 arregló la CSP (dominio nuevo del redirect) y **el canal siguió roto**: los assets de las Releases de GitHub **no mandan CORS** en ninguno de los dos saltos (`curl -H "Origin: https://localhost"` → ni ACAO en github.com ni en release-assets), así que el `fetch` de la WebView los tira igual — MISMO síntoma que la CSP. Fix en **v4.10.2** (commit ece8ff6, main): el manifiesto lo pide Android (`CapacitorHttp`, como el login de MyInvestor) y `mcFetchManifest` cae a estable **solo con 404**; cualquier otro fallo va al toast y a `app_events`. Guardián: `tests/updates.test.mjs` ejecuta el trozo REAL del monolito en un `vm`. Dato: el `bundle.zip` de la beta tenía `downloadCount: 0` — nunca se había bajado. ⚠ Igual que la 4.10.1, esto NO puede viajar por beta: va a `main` porque es el mecanismo que arregla. `beta` lleva el merge (25a27e6).

**★ v4.12.0 EN `beta` 2026-07-26 noche — LISTA PARA RE-PROBAR (Cursor cerró los bloqueos tras .17/.18).** Tanda del buzón + capa post-rechazo: lag scroll→swipe (`freezeShell` tab + `onPageScroll` silenciado), bancos (noti→solo Cartera, `bankConnectOnce`, Mis bancos rojo con `bankIssues`, `invalid_request` en cristiano), TR con aviso propio, stopper del perfil afinado, Ajustes con web+APK. **APK 35** ya publicada. Producción sigue en 4.11.0. Veredicto pendiente en el panel.

**★ EL TIRÓN AL DESLIZAR TENÍA TRES CAUSAS, NO DOS (2026-07-26 tarde, beta 4.12.0.19).** Tras las dos primeras (scrollLeft síncrono + `prepMountTab` dentro del gesto) el A/B seguía dando 74 ms en la PRIMERA deslizada. La tercera: **`heavyOk` en `04-tab-gastos.js` esperaba a que la pestaña estuviera ACTIVA** para detectar suscripciones → ~50 nodos de golpe al llegar → un `Layout` completo de 59,7 ms (1.196 objetos), trazado con `Tracing`. **Las tres son el MISMO patrón: trabajo caro atado al momento en que el usuario toca.** Si vuelve a aparecer un tirón, buscar ahí antes que en el gesto. A/B en la 1ª deslizada, 600 ms de reposo, CPU x6: **74 → 65 (quitando el indicador de puntitos muerto) → 0 ms**. ⚠ **Método que lo resolvió: dos experimentos, no una corazonada** — llegar por CLICK costaba lo mismo (66 ms) y un arrastre que NO cambia de pestaña costaba 0, así que el gesto quedó descartado en dos medidas. Precio asumido: el arranque pasa de 762 a 800 ms de tareas largas en 8 s, pero la tarea MÁS LARGA no se mueve (~205 ms), que es lo único que se nota. Guardián estructural (no de tiempos, para no ser flaky) en `rendimiento-tabs.spec.mjs`: estando en Inicio, las filas de suscripción ya tienen que estar pintadas.

**★ v4.11.0 APROBADA Y PROMOCIONADA a producción 2026-07-26** («aprobado, todo funciona a las mil maravillas»). **Primera versión que recorre el circuito entero como estaba pensado**: publicar en `beta` → la prueba en su móvil → la rechaza (dos veces, con el panel de revisión) → sube al aprobarla, con el workflow «Promocionar beta a producción» (`gh workflow run promote-beta.yml -f confirmar=SUBIR`). Hicieron falta CUATRO betas (.7 a .10) + **APK 34** (release `v4.11.0`; la que probó fue la prerelease `v4.11.0-beta34`). Los dos rechazos son lo que encontró el fallo de verdad del perfil — sin el canal habría subido un gesto que no cerraba. El veredicto se lee con `node scripts/errores.mjs --kind=beta`, que ahorra el ping-pong de capturas.

**★ LECCIÓN GORDA DEL GESTO DEL PERFIL (2026-07-26, tercera vuelta).** Tres rondas arreglando cosas reales que NO eran la causa, porque todas las pruebas empezaban con el panel ARRIBA DEL TODO. Con `scrollTop=220` (lo normal: el contenido mide ~1.680 px y él lo mira antes de cerrar) el arrastre solo scrollea y no cierra: reproducido a la primera montando un banco con dedos realistas (lento, con temblor ±2 px, con pausas). Y debajo, la causa de fondo: **`e.preventDefault()` NUNCA funcionó en este gesto** — React ata `onTouchMove` al contenedor raíz en modo PASIVO, así que el navegador se quedaba el gesto para scrollear; solo dejaba un aviso de consola que ningún test miraba. Ahora los listeners del panel van a mano con `{passive:false}` + `touchcancel` como final. **Regla para la próxima vez: si un gesto «funciona en el test y falla en su móvil», sospechar del listener pasivo y del estado de scroll ANTES de tocar umbrales.** APK 34/4.11.0 compilada y firmada (`v4.11.0-beta34`, prerelease) con el arreglo nativo de las notis duplicadas (`Notif.idFor` + el worker de fondo respeta el canal; el id salía del reloj y cada aviso se apilaba).

**★ 4.11.0 RECHAZADA por él desde el móvil (2026-07-26, primera beta que llega de verdad).** Veredicto leído con `node scripts/errores.mjs --kind=beta`: 3 ok / 2 fallos, los dos del perfil. **Lección: unificar los umbrales de dos gestos opuestos fue el error** — cerrar pasó de pedir 52 px a 94 px (0,062·h → 0,11·h) y él lo cazó a la primera; la CURVA sí se comparte, el UMBRAL no (abrir compite con el scroll de Inicio y el cambio de pestaña; cerrar solo con el scroll del panel). Segundo fallo: el candado anti-corte se activaba en CUALQUIER final de gesto (rebote, toque suelto) y sin `transitionend` agotaba 560 ms → el segundo intento no arrancaba. Arreglado en e9f35b5 (rama beta) + dos e2e que arrastran DESPACIO y CORTO (las que había tiraban 240-320 px de golpe y no veían nada) + quitada una intermitencia real del test de simetría (leía la escala sin esperar al rAF). Además, dos del canal: el bundle se sellaba con `VERSION` mientras el manifiesto anunciaba `VERSION.RUN_NUMBER` → **la misma beta ofrecida en bucle** (ahora `MC_STAMP_VERSION`, y el workflow no publica si no cuadran), y **apagar la beta no volvía a producción** (`_mcApplyChannelBundle`). PENDIENTE: que él pruebe la 4.11.0.8.

**★ v4.10.0 DESPLEGADA 2026-07-25 (commits 572e456 + 6393fd7; Pages, Tests y Deploy Supabase VERDES; `version.json`=4.10.0 con curl; CORS y migración 0019 comprobados EN VIVO contra el proyecto real). Sin APK nueva: nada nativo — el móvil la recibe por OTA sobre el APK 33.**
- 👤 **El parpadeo del perfil era el SCROLL, no la animación.** El panel mide ~1.680 px y en un móvil de verdad (393×851) no cabe. `profileMove` medía `ddy` desde el `touchstart`, así que si habías bajado dentro del perfil, al llegar `scrollTop` a 0 el panel SALTABA a la miniatura (medido con CDP: 1,000 → 0,122 en un frame) y con el rebote del scroll volvía a pantalla completa. Fix: **re-anclar el gesto al dedo** mientras quede scroll. Los dos e2e viejos no lo veían porque usan viewport de 1.800 px justo para que quepa sin scroll. **Y ABRIR seguía roto**: la 4.9.1 dio por hecho que la apertura no interpolaba opacidad y sí lo hacía (`opacity: resist*3` + `borderRadius` por frame) — causa de fondo: los DOS gestos estaban duplicados, así que un arreglo en uno no llegaba al otro. Ahora comparten `profileGrab()`/`profileRelease()`.
- 🥇 **El import de Revolut rechazaba el extracto de la cuenta en €** —el que la 4.9.0 necesita para el coste del oro— con «no he podido leer el CSV», habiéndolo leído bien. `analyzeAll` solo daba un fichero por entendido si sacaba POSICIONES. Ahora: estado `err="fiat"` (caja neutra), costes acumulados en `fiatRef` (los extractos se sueltan de uno en uno y en cualquier orden), hint `bi_metal_auto` cuando el coste sale solo, y los pasos ya mencionan el TERCER fichero. Reproducido y verificado con sus CSV reales (`C:/Users/<usuario>/Documents/Revolut/`, NO se commitean).
- 🚪 **Splash de entrada** con marca/Fraunces/tema, que espera a `window.__mcBootReady` (`mcBootReady()` en 00-core, idempotente) — antes se veía el patrimonio local y un segundo después el de la nube. Topes: 1,8 s y botón de reintentar a los 8 s si React ni pinta.
- ⇅🏠 **Cartera ordenable** (reusa `OrderableSections`, `settings.secOrder.cartera`) y **Hogar mudado al perfil** («Tu gente», arriba) — lo eligió él entre 4 opciones.
- 🔒 **Seguridad servidor**: CORS con lista blanca (`_shared/cors.ts` + `withCors`, origen desde `APP_URL` + `https://localhost`), rate limit en Postgres (migración **0019**, `check_rate_limit`) para `ingest` (60/min por IP) y `myinvestor-connect` (10/10 min por usuario — protege de que el BANCO le bloquee la cuenta), y el `state` del OAuth caduca a 30 min y se gasta. **Verificado en vivo**: origen ajeno → sin ACAO; `check_rate_limit` devuelve true,true,false con límite 2.
- 📏 Guardas nuevas en `npm test`: `presupuesto-rendimiento` (987 KB min / 278 KB gzip / 3 bloqueantes) y `edge-sintaxis` (esbuild parsea las Edge Functions —Deno no está instalado— y falla si vuelve el CORS `*`). E2E 53 → 62.
- **PENDIENTE de la lista que él pidió: MyInvestor NATIVO** (WebView que cargue myinvestor.es y genere el token de reCAPTCHA en su dominio, como el puente de TR). Es trabajo Java + APK nueva + su login real: no cabía en esta tanda.

**★ v4.7.0 DESPLEGADA 2026-07-22 (merge 761db92 + apk.json 0bcfe09; Pages verde en ambos pushes, curl verificado: apk.json→31/4.7.0, version.json→4.7.0). El trabajo lo dejó el Claude móvil en la rama `claude/notifications-recaptcha-ui-bugs-2axcji` con una chuleta `docs/PENDIENTE-4.7.0.md` (ya borrada) — esta sesión de escritorio solo mezcló+publicó siguiendo la receta:**
- Merge a main → OTA sola. Build local (`node scripts/build-www.mjs` + `npx cap sync android` + `cd android && JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" ./gradlew assembleRelease --offline`) → APK 31 firmado (CN=Mi Cartera verificado con apksigner) → `gh release create v4.7.0` con el APK como asset → `apk.json` apuntado al asset real → commit+push.
- Contenido 4.7.0: notis sin duplicados (gasto tocho + víspera de recibo con importe exacto), roles de cuenta excluyentes (un chip verde por banco: Recibos/Diario/Todo), brókers con animación+orden configurable, deudas «Quedan n/tot» uniformes, badge reCAPTCHA solo donde toca. APK 31 = solo `TrExpenseListener.java` (alerta del gasto tocho ANTES de confirmar, con deep-link).
- **MyInvestor reCAPTCHA: SIGUE SIN EL FIX DEFINITIVO.** Esta tanda solo mejora el DIAGNÓSTICO del error (dice si Google negó el token o si MI lo rechazó por origen). Ambos casos apuntan a lo mismo: hace falta **WebView nativa** que cargue myinvestor.es de verdad y genere el token allí (trabajo de APK, no arrancado). Ver receta de build en [[mi-cartera-android-build]] (sigue vigente: JAVA_HOME al JBR de Android Studio, keystore en `C:/Users/<usuario>/.micartera/`, `./gradlew assembleRelease --offline`).
- Patrón de trabajo confirmado: el Claude móvil deja código+chuleta en una rama `claude/*`, el desktop mezcla/compila/publica. Revisar SIEMPRE `git fetch` + `git log origin/main..origin/claude/*` al empezar sesión por si hay rama pendiente de publicar.

**★ v4.0.15 DESPLEGADA 2026-07-17 (commit d095f6a; Pages version.json 4.0.15 ✓ con curl, Deploy Supabase verde con el paso «Desplegar Edge Functions» en success ✓, Tests+5 E2E verdes). Tanda de la sesión «dale caña»:**
- 🏦 **Open Banking «se cae cada dos por tres» = FALSO POSITIVO de caducidad.** `bank-sync/index.ts` marcaba `expired` con cualquier `40[134]`; un 403 PSD2 es rate-limit momentáneo y un 404 un hipo → NO caducidad. Ahora solo caduca con **401** o mensaje explícito (`expired|revoked|consent|unauthor|invalid_(token|session|grant)|session_not_found`). Cliente: fallo no-caducado → `bank_syncsoft` (aviso suave, solo sync manual), ya no «reconéctate». Mismo patrón que el 403 anti-bot MI / 401 momentáneo TR. Es cambio de **Edge Function** → al pushear, VERIFICAR el run Deploy Supabase (paso Edge Functions).
- 🥇 **Revolut materias primas: campo COSTE € manual** en la previsualización del import (`BrokerImport.costOf()`, parsea con `revoAmt`, exige >0). El precio ya iba en vivo (XAU→GC=F); faltaba el coste que Revolut no da en ese extracto → sin él no había % sube/baja. Con coste, la fila pinta el %. `bi_metal_cost_ph`+hint reescrito (es/en/ca).
- ⬇️ **Nav inferior auto-oculta (Revolut):** `.page onScroll`→`onPageScroll` en 11-app-main; bajar esconde `.botnav` (`translateY(130%)`+fade), subir/cambiar tab muestra. Refs `navHiddenRef`/`scrollTab` (sin re-render por píxel, sin falso salto al cambiar tab). Respeta reduced-motion. Verificado en navegador (dispatch scroll + clase).
- 🔒 **Privacidad DENTRO de la app** (`PrivacyPanel`, portal+useBackClose+safe-area): antes `window.open("privacy.html","_blank")` = título bajo el notch («muy arriba») y costaba volver. Contenido i18n `pv_*` (es/en/ca). privacy.html también con env(safe-area-*). Limpieza: fuera `lbl/btnGhost/link` muertos en SettingsPanel.
- 📱 **TR + MyInvestor: APK 28 COMPILADO E INSTALADO por adb** (versionCode 28 confirmado en el móvil OPPO CPH2653). Trae el fix TR nativo de 4.0.11 (cookies frío) + hornea bundle 4.0.14 (login MI nativo `CapacitorHttp`). PENDIENTE: el usuario tiene que probar el login REAL de TR y MI (no puedo meter credenciales bancarias). El móvil se desconectó a media sesión.
- ✅ **PUSHEADA y desplegada** (él dijo «commit + push ahora»): Pages 4.0.15 OTA + Edge bank-sync en prod. Sin APK nuevo (cambios OTA). apk.json intacto. PENDIENTE de su feedback real: que OB deje de caerse, que el % del oro le cuadre, y el login TR/MI en el móvil.

**★ ERA v4 (2026-07-15→17): CURSOR hizo 3.101→4.0.10** (el usuario trabaja ahora mucho con Cursor; el rediseño lo diseñó «Claude design en modo fable»). Lo gordo: v3.101–3.113 (tests, tokens cifrados+RGPD, deudas dinámicas, onboarding wizard, dashboard inversiones, Hogar F2, informe mensual, src/ MODULAR — **la fuente ya NO es public/index.html: es `src/modules/*.js` + `src/shell.html`, `npm run build` ensambla**, AGENTS.md §2), y v4.0.0–4.0.10 (rediseño completo Inicio/Gastos/Plan/Cartera, gestos Revolut, sheets, OtaCheckWorker con noti de APK, APK auto-instalable, versionCode 27).

**★ v4.0.11 COMMITEADA 2026-07-17 (commit d404d8e, SIN push — lo decide él). Mi tanda tras ver su vídeo de Revolut:**
- 👤 **Perfil Revolut DE VERDAD**: el panel entero escala desde el avatar real (`profSetOrigin()` mide rect → vars `--pp-ox/oy/s0`; transform-origin en el centro del avatar; s0=avatar/panel≈0.128) + `backdrop-filter:blur(18px)` en `.profile-dim-layer`. JAMÁS scale/filter en `.app-shell` (huecos negros WebView — Cursor tropezó 3 veces con eso en 4.0.7/4.0.8). Pull-down en Inicio abre siguiendo el dedo; cerrar tirando ARRIBA encoge al avatar (pull-down-cierra ya se probó y al usuario le pareció raro). E2E `e2e/profile-anim.spec.mjs` lo verifica (origin ±2px, scale(1), cierre).
- 🏦 **TR «caduca cada dos por tres» — causa**: TR ROTA tr_refresh en cada /session; el snapshot (solo al final de cada llamada bridge) se quedaba atrás y `restoreCookies()` lo re-inyectaba SOBRE el jar caliente «resucitando» un refresh consumido → 401 real. Fix (necesita **APK 28, gradle ya bumpeado, SIN compilar/publicar**): restore solo con jar frío, `AndroidTR.snap()` tras cada refresh OK, snapshot en onPageFinished+3s y handleOnPause. UX: 401 real → formulario directo con teléfono recordado (`mc_tr_phone`), sin «pulsa Desconectar».
- 🔐 Capturas del vídeo Revolut (`docs/design/handoff/capturas/*`) tienen IBAN/nombre del usuario → **gitignoreadas** (repo público).
- 📵 MyInvestor captcha (SECURITY_001): lo disparaba la IP datacenter de Supabase Edge. **CONSTRUIDO Y DESPLEGADO en v4.0.12 (commit 0357b0b, Pages 4.0.12 + Edge verificados)**: login desde el móvil vía `Capacitor.Plugins.CapacitorHttp.request` (registrado incondicional en el core, Bridge.java:638 → funciona con APK 27, sin build), `miDeviceLogin()` en 06-sync-brokers + modo `storeTokens` en myinvestor-connect (valida contra self-basic antes de guardar). Fallback automático a la Edge. PENDIENTE: que el usuario pruebe el login real.

**★ v4.0.12 DESPLEGADA 2026-07-17 (0357b0b; Pages version.json 4.0.12 ✓, Edge Functions ✓ — OJO: el run «Deploy Supabase» enseña una anotación «exit code 1» del paso de migraciones con continue-on-error, es NORMAL; el paso crítico es «Desplegar Edge Functions»).** Además: E2E táctil del perfil (CDP touch, viewport 1800 porque el contenido del perfil mide ~1680px y con scroll el gesto de cerrar cede al scroll — comportamiento correcto) que cazó un bug real (panel congelado a scale(0.93) cuando el scroll toma el gesto a mitad de tirón; arreglado limpiando inline styles en el guard). PENDIENTE del usuario: sensaciones de la animación en el móvil, login MI sin captcha, y compilar/publicar APK 28 (fix TR). El FCM push real sigue en backlog (necesita proyecto Firebase suyo; la noti local del OtaCheckWorker ya cubre el aviso de versión).

**★ v3.100.0 DESPLEGADA (2026-07-15, commit aedd03d, Pages Y Supabase verdes, version.json 3.100.0 verificado con curl).** Cierra los puntos 1 y 2 del §6 de [[mi-cartera-backlog]].
- **🥇 Revolut ya trae el oro.** No era un fallo de parseo: el oro vive en un extracto APARTE (Invest → Documentos → **Materias primas** → Extracto de cuenta), con formato de CUENTA CORRIENTE (`Tipo,…,Importe,Comisión,Divisa,State,Saldo`, cabecera en el idioma de la cuenta) y el importe ya en ONZAS → `revoParse` (que exige Ticker/Type/Quantity) lo rechazaba. Nuevo `revoParseCommodities()`: cantidad = columna **Saldo** de la última fila, con la suma `Importe−Comisión` de comprobación (los CSV reales dan 0,258218 XAU por las dos vías). **El coste NO viene en ese extracto** (la pata en EUR está en otro fichero) → se re-ancla solo la CANTIDAD y se respeta el coste que hubiera. `BrokerImport` acepta `multiple` y fusiona los dos extractos. `revoIsPnl()` avisa si suben el de Pérdidas y Ganancias (¡uno se llama `trading-account-statement-…` por fuera!). `prices`: XAG/XPT/XPD → SI=F/PL=F/PA=F.
  - ⚠ `revoMetalSuggest()` existe porque `brokerSuggest` NO casa el oro: se llevaba a mano y SIN ticker, y las palabras de «Oro (XAU)» tienen 3 letras (el matcher exige 4+). Casa por código en el nombre o ticker exacto — buscar «GOLD» como subcadena casaba «Goldman Sachs» y le machacaba las acciones.
- **💬 Diálogos propios (`askText`/`askConfirm`, componente `AskHost`)** en vez de `window.prompt/confirm`. Portados los 8 sitios. Devuelven PROMESAS (el prompt nativo era síncrono): al portar algo nuevo, mover lo de después dentro del `.then()`. Sin host montado caen al nativo. z-index 230 (los paneles llegan a 215).

**★ v3.99.0 (2026-07-15, commit 3eda058) + APK alpha19 instalada por adb. LA SESIÓN EN QUE SE CERRÓ LA SAGA TR.**
- **🏆 SAGA «TR falla en frío» CERRADA tras 18 alphas — la causa NUNCA fue el WAF.** Diagnóstico en vivo con chrome://inspect/CDP sobre la WebView oculta (alpha17 + espía Node): el aws-waf-token viajaba perfecto y `/api/v1/auth/web/session` devolvía **401 JSON limpio**, no un challenge; faltaban **tr_session/tr_refresh** (Android solo persiste cookies CON caducidad; las de sesión se tiran al morir el proceso, y `CookieManager.flush()` NO las salva). El «Failed to fetch» de siempre era ese 401 sin CORS visto desde JS. FIX (alpha18): `snapshotCookies()`/`restoreCookies()` en TradeRepublicPlugin. **VERIFICADO por el usuario en frío («FUNCIONOOO»).** alpha19 = alpha18 sin `setWebContentsDebuggingEnabled`. Detalle completo y montaje del espía en [[tr-frio-saga]].
- **Auto-refresh de brókers al abrir** (`runBrokerSync` + `applyBrokerPositions` en App, throttle 30 min, refs `brokerSyncing`): TR (puente nativo, solo si `status().connected`) y MyInvestor (edge, solo si status active). SILENCIOSO y conservador: re-ancla SOLO lo ya mapeado vía `brokerSuggest`, nunca crea ni borra, sin toasts ni de éxito ni de fallo. Sella `lastTrSync`/`lastMiSync`.
- **Menos ruido** (feedback: «me salta CONSTANTEMENTE»): fuera el toast admin «🐞 N errores nuevos» (saltaba en cada apertura, solo al admin, no accionable — los errores siguen en Ajustes → Actividad) y el toast del saldo bancario en sync AUTOMÁTICO (ahora solo con `opts.manual`).
- **BankPanel a dieta** (feedback: «se ha cargado muchísimo esa zona»): fuera chips de rol, chips de promoción de cuentas OB y el hint de roles. Quedan actualizar saldo / reconectar / quitar. COMPROBADO antes de cortar: roles y promoción SIGUEN en Patrimonio → Editar (líneas ~5094 y ~5128), no se pierde funcionalidad.
- Nota TR: que la sesión se caiga tras varios días SIN entrar es NORMAL (tr_refresh caduca en el servidor de TR) — no es bug, no investigar.

**v3.98.0 DESPLEGADA (2026-07-13, commit 95123da, CI Pages verde).** Revolut cuadrado tras el desastre de la 3.96/3.97:
- `fixRevoDupes`: migración idempotente que borra los duplicados a 0 €/−100% que sembró el importador viejo (ent revolut, nombre==ticker, valor ~0).
- El apply del import re-ancla también el **VALOR** (re-escalado con el último precio/acción conocido) — antes solo tocaba shares+coste y el % salía disparatado (Broadcom −39% cuando Revolut decía −6%) — y dispara `fetchPrices(true)` en silencio al acabar.
- Edge `prices`: acepta `{symbols}` del cliente (antes clavada a 6 tickers fijos), fallback Finnhub→Yahoo, oro como XAU además de GOLD.
- `brokerSuggest`: con ticker repetido manda la posición VIVA (value>0). Botón **🗑 Borrar** por posición en «Editar a mano» (antes no había forma de borrar un cadáver).
- **⚠ TRAMPA REAL (2026-07-15): el «Deploy Supabase» de esta tanda FALLÓ** por el rate-limit transitorio de `supabase/setup-cli` y NADIE lo relanzó → la función `prices` nueva estuvo 2 días SIN desplegar (el cliente mandaba `{symbols}` y respondía la vieja de 6 tickers). Relanzado con `gh run rerun 29275357061 --failed` → verde, `prices` live (401 sin JWT). **LECCIÓN: tras cada push que toque `supabase/`, VERIFICAR el run de Deploy Supabase, no solo el de Pages.**

**v3.97.0 DESPLEGADA (2026-07-13, commit c42b017 — CI Pages verde, CI Supabase verde al 2º intento (el 1º cayó por rate-limit transitorio de setup-cli, basta `gh run rerun --failed`), version.json 3.97.0 verificado con curl, migración 0011 pg_cron+pg_net APLICADA, edge myinvestor-keepalive live y rechazando sin clave con 401 «clave incorrecta» = lee bien el secreto de la BD).** Feedback del usuario 2026-07-13 que motivó la tanda: (✘) TR frío sigue fallando con alpha16 → hipótesis (a) descartada, ver [[tr-frio-saga]]; (~) MyInvestor FUNCIONÓ conectado («me alegro mucho») pero la sesión caduca entre usos; (✘) el import Revolut CSV fue un caos (números mal + posiciones extra); (✔) #9 rotar INGEST_TOKEN → DESCARTADO por el usuario, no volver a proponerlo («me da bastante igual, el repo es público»). Lo hecho:
- **Revolut CSV arreglado** (causas raíz encontradas): revoAmt solo entendía formato US → «88,94 €» se leía 8894 (¡×100!); brokerSuggest no miraba `ticker` (NVDA no casaba con «NVIDIA») y el default de lo no-casado era «crear nueva» → los «extras»; ventas sin Quantity no restaban → posiciones vendidas resucitaban. Fixes: revoNum locale-aware (US/EU/ambos, U+2212), qty=importe/precio si falta, filtro polvo >0.0001, match por ticker exacto, default «no tocar» (salvo cartera vacía), desglose «N compras · M ventas · splits» por posición + aviso de no-mapeadas. Unit tests en Node OK (CSV sintético con split/venta sin qty/liquidada).
- **#11 asesor «¿Cuándo amortizar?»** (AmortAdvisor en Deudas, i18n da_*): campo interés TAE opcional por deuda (d.apr, se edita en la tarjeta), simulador (cuotas que quita + fecha fin, intereses ahorrados ≈ amt·r/12·leftNew + amt/2·r/12·cut, coste de esperar bal·r/12), comparativa vs efectivo remunerado (max interestApr de cuentas), ranking mayor interés, botón amortizar directo (reusa doAmort extraído de amortize). Verificado en navegador: 6000€/250/24m + 7% + 500€ → «te quitas 2 cuotas (mayo vs julio 2028), ≈67,08€ menos intereses, esperar cuesta 35€/mes». OJO: numOrNull NO es global (vive en el componente TR) — el asesor parsea inline; issue #11 se puede CERRAR.
- **Ajustes reorganizado**: helper grp() en SettingsPanel — grupos colapsables (estado en localStorage _setg_*, «general» abierto por defecto) + buscador (filtra por título+keywords, abre lo filtrado, «sin resultados») + valores en cabecera (presupuesto, resumen bancos, versión). Verificado (búsqueda «copia» → solo Copia de seguridad desplegado).
- **Mini-tutoriales por pestaña** (TabCoach + i18n coach_*): primera visita → tarjeta desplegada con 2-4 trucos REALES de la pestaña (el lápiz ✎ de gastos incluido); «¡Entendido!» la pliega a botoncito «💡 ¿Cómo va esto?»; estado _coach_<tab> en localStorage. + **Categoría 💇 Peluquería** (id "pelu", keywords sacadas de salud, ANTES en KW).
- **Keep-alive MyInvestor**: migración 0011 (pg_cron cada 10 min + pg_net → edge myinvestor-keepalive verify_jwt=false, secreto anti-ajenos generado en BD en public.cron_secrets con RLS sin políticas — NADA de secretos en el repo público) refresca los tokens de todos los enlaces activos rotándolos; si el refresh muere de verdad → status expired. Cliente: usuario recordado en localStorage _miCid (nunca la contraseña), aviso mi_expired claro, reconectar = contraseña+OTP. **PENDIENTE verificar con el usuario: que la sesión MI aguante días tras reconectar una vez con 3.97.0.**

**v3.96.0 DESPLEGADA (2026-07-12, commit 30dacd5, CI Pages+Supabase AMBOS verdes, version.json 3.96.0 + migración 0010 aplicada + edge fns myinvestor-* live 401 verificados con curl).** Tanda de 7 puntos del usuario. Web-only (SIN cambio nativo → APK sigue en alpha16):
- (1) **Gastos: dos vistas renombradas + mismo diseño.** «Desglosado»→**«Gastos e ingresos»**, «Lo que te queda»→**«Balance»** (i18n st_gview_split/net + g_totalfilt/g_totalnet + nuevos g_lbl_spent/g_lbl_income). Ambas comparten diseño: número protagonista + línea «💸 Gastos · 💰 Ingresos · Balance». Quitado el «−» residual del balance en la vista split (ya sin «−» en ninguna). Verificado en navegador (split/net/sobregasto coral sin «−»).
- (4) **MyInvestor por API — CONSTRUIDO Y DESPLEGADO (dormido, beta).** GIRO clave (subagente): la API NO está muerta; `app.myinvestor.es` sí (Incapsula), pero la API VIVA es **`api.myinvestor.es`** e Incapsula NO bloquea el tráfico de API (curl da 400/401 JSON, no challenge). Endpoints/cabeceras/shapes copiados LITERALES del cliente en producción **`finanze/finanze`** (commit jul-2026). Construido: migración `0010_myinvestor_links` (grant a nivel de columna: cliente NO ve tokens), edge fns `myinvestor-connect` (login usuario+contraseña, OTP SMS 202, reCAPTCHA 403 SECURITY_001 avisado-no-resuelto)/`myinvestor-sync` (posiciones + auto-refresh 401)/`myinvestor-disconnect`, `_shared/myinvestor.ts`, cloud.myinvestor* + componente `MyInvestorSync` en «Mis bancos» (funciona web Y app, no nativo). Contraseña NUNCA se guarda (solo tokens). Verificado front (gate sin-sesión, 0 errores) + fn desplegada (401 sin JWT). **PENDIENTE: el usuario prueba login real con sus credenciales+OTP; vigilar reCAPTCHA (condicional; si peta siempre, hace falta WebView en myinvestor.es que capture el token, patrón finanze).**
- (5) **Revolut por CSV — CONSTRUIDO (beta).** El importador CSV viejo (v3.72) se había BORRADO (solo quedaban i18n bi_* huérfanas). Reconstruido `BrokerImport` (parser revoParse/revoAmt/revoQty/revoAggregate) para el extracto real de Revolut (`Date,Ticker,Type,Quantity,Price per share,Total Amount,Currency,FX Rate`), tolerante a coma decimal de cuenta ES (`"0,76672417"`), negativos contables `($0.01)`, símbolo de divisa; agrega por ticker con coste medio; split/traspaso ajustan shares a coste 0; paso a paso de export. En «Mis bancos» junto a TR. VERIFICADO end-to-end en navegador con filas reales (3 posiciones, coma ES ok, dividendos, mapeo, 0 errores).
- (2) **Novedades:** entrada 3.95.1 (que faltaba) + 3.96.0. Ver [[feedback-release-notes-siempre]].
- (3) TR frío: SIN cambio nativo esta tanda (alpha16 sigue pendiente de su test en frío, ver [[tr-frio-saga]]). (6) Hogar: SIN código aún, ver [[mi-cartera-backlog]] (decisión de variante pendiente de él). (7) Issues: auditadas (abajo).

**ISSUES GitHub auditadas (2026-07-12, subagente): 19 totales, 12 cerradas, 7 abiertas. De las 7 abiertas, YA HECHAS (cerrar): #5 (multiusuario ingest, migr 0008), #8 (APK Capacitor), #10 (precios manuales), #15 (retos/logros), #19 (round-up TR, además falta del board del Project v2). SIGUEN PENDIENTES DE VERDAD: ~~#9 rotar INGEST_TOKEN~~ (DESCARTADO por el usuario 2026-07-13, no volver a proponerlo), ~~#11~~ (COMPLETADO en 3.97.0 con el asesor de amortización — cerrar la issue).**

**v3.90.0 + APK alpha15 DESPLEGADOS (2026-07-11 tarde, commit ceab00b, CI Pages+Supabase verdes, release v4.0.0-alpha15 con Mi-Cartera.apk 200 OK, apk.json live versionCode 15, version.json 3.90.0 — todo verificado con curl).** Sesión de rescate tras la tanda del Claude móvil (sesiones claude.ai/code): NO destrozó nada — construyó sobre alpha14 (commits 3.87→3.89.1: quitar cuenta manual, ingest multiusuario 0008, importar histórico OB) pero dejó 3 cabos sueltos que esta sesión ató: migración 0008 SIN GRANTS (permission denied del toggle), función ingest/bank-sync ya desplegadas por CI pero APK alpha15 sin compilar (apk.json apuntó a release inexistente y lo revirtió), y 3 ramas claude/* vacías (borradas).

**Qué arregló la 3.90.0 (todo verificado en navegador local con estado sembrado + Java compilado):**
- Migración 0009: grants ingest_tokens (authenticated CRUD + service_role select) + grants service_role para app_events. El toggle «Apuntar aquí mis gastos de TR» ya no peta.
- CaixaBank esfumado del Patrimonio: bank-sync ahora devuelve enlaces expired/error (ok:false, sin llamar a EB); applyBankBalances conserva sus obAccounts marcadas stale → badge naranja «del banco · caducado»; resumen de Ajustes canta «⚠ N caducado(s)». EL USUARIO DEBE RECONECTAR CaixaBank en Gestionar mis bancos (sus cuentas viejas ya se habían purgado del estado, no reaparecen hasta reconectar).
- obLabel heredado «personalizado solo mío» (Revolut conjunta): limpieza puntual al cargar (regex en obLabels y accounts[].name).
- Gastos: alta manual CON FECHA (vacía=hoy, T12:00 local), chip de filtro 💰 Ingreso, ingreso manual noCard.
- Suscripciones detectadas → botón «pasar a Gastos fijos» (banco rol fijos + día del último cargo, ✓ si ya existe). Keywords: IA/digital (anthropic, claude, openai, icloud, google one…)→ocio; peluquería/estética genérica (barber, estilis, hair, nails…)→salud, en cliente Y edge ingest.
- Rol del banco (recibos/diario/todo) editable en Gestionar mis bancos con explicación (lógica extraída a applyAccountRole global, Wealth la reusa).
- «Buscar actualización» hace hot-swap del bundle web AL MOMENTO (CapacitorUpdater.download+set, guard solo-adelante). Antes decía «cierra y abre».
- Telemetría por fin útil: showToast loguea todo toast ✕/⚠ a app_events; fail() del TRSync también; ingest loguea fallos server-side (token inválido→user del creador, error de insert); botón Recargar del panel da feedback (N eventos · M errores). Los errores de la pareja eran invisibles porque solo se subían crashes.
- Crash total si el estado no traía aportaciones/history (totals.reduce / Sparkline.concat) → defaults al cargar. Posible causa de errores fantasma de la pareja.
- TR frío v5 (alpha15): backoff refresh 4 intentos ~9,5s (antes ~22s), timeout nativo 90s (el peor camino ~77s moría en falso timeout a 60s), 401 real sale al momento sin quemar 15s de WS, y bloqueo WAF → wafBlocked SIN tocar connected (antes authExpired ponía connected=false y forzaba re-2FA sin necesidad). El mensaje conserva «Failed to fetch» para que Bridge.result siga disparando la recarga+reintento (alpha13).

**v3.91.0 (2026-07-11 noche, commit 7929fd5) — DESPLEGADA (push + CI Pages verde + version.json/APP_VERSION 3.91.0 verificados con curl).** Feedback de la pareja usándola en serio. Todo verificado con jsdom (estado sembrado, clicks reales) + unit tests de las funciones puras:
- «Total filtrado» sumaba gastos−ingresos y lo pintaba en crudo (nómina +757 con 1.560 de gastos salía «+802 €»: parecía ganancia siendo sobregasto; el mes ahorrador salía en negativo). Ahora: gastos con «−» (como las filas) + línea «💰 +ingresos · Balance ±X» (verde/rojo) + contador «N gastos · M ingresos».
- Cuentas OB (Revolut/CaixaBank de la pareja) NO tenían rol → al crear un fijo solo salía Trade Republic. Ahora se «promocionan» con chips Recibos/Diario/Todo en Patrimonio→Editar Y en Gestionar bancos (`promoteObAccount`: crea cuenta con rol anclada al saldo real, la saca de obAccounts, el sync la re-ancla por IBAN; `applyBankBalances` ahora re-ancla VARIAS cuentas manuales del mismo banco). Extras: alta de fijos/puntuales ya no guarda «sabadell» si el usuario no lo tiene (guardaba banco distinto del mostrado); `useEditable.save` ya no machaca a 0 items sin borrador (cuenta promocionada en pleno modo edición).
- Filtro «Mi ciclo» en Gastos: del último cobro real (ingreso ≥200 € en 45 días, `lastPaydayOf`) a hoy, con hint «Del 23/06 (cobro de +757 €) a hoy». La nómina de la pareja no tiene día fijo; el Balance de ese filtro = ahorro real del ciclo.
- Categoría 🥖 Panadería (id "pan", ANTES que bares en KW porque panaderia/pasteleria estaban en bares y el for..in respeta orden).

**v3.92.0 (2026-07-11 noche, commit 7eccb67) — DESPLEGADA (CI verde, version.json 3.92.0 con curl).** Más bugs de Deudas de la pareja, verificado en navegador local (estado sembrado, clicks reales, caso 4 cuotas/3 pagadas):
- Añadir deuda incompleta fallaba EN SILENCIO → toasts db_err_amount/db_err_quota/db_err_paid + «✓ Deuda añadida».
- Botón «💸 Amortizar» por deuda (prompt, patrón de Metas): baja `value` justo lo amortizado SIN tocar asOf (evita el +1 del re-anclaje) y acorta `months` (misma cuota, menos meses); clamp al pendiente; al llegar a 0 borra balloon, pone months=paidCount → «✓ Financiación pagada».
- Campo «Cuotas ya pagadas» al crear: retrasa asOf esos meses (compensando el +1 de debtPaidCount si el día ya pasó este mes) → pendiente, % amortizado y «Quedan n/tot» correctos desde el alta.
- QUIRK del re-anclaje ARREGLADO en **v3.93.0 (7ad5d97, CI verde, version.json 3.93.0)**: «Editar saldos pendientes» en deudas CON plazo ya no re-ancla asOf (eso reseteaba «Quedan n/tot» al plazo completo); el `extra` de useEditable ahora recibe `(item,typed)` y ajusta `value` (pendiente = tecleado, ancla intacta, como amortize()) recalculando months=paid+ceil((typed−balloon)/amort). Sin plazo sigue re-anclando asOf. Verificado en navegador: 400€/4c/3pag editada a 100→«Quedan 1/4», a 250→«3/6», a 0→«pagada»; sin plazo re-ancla como antes.

**v3.95.0 + APK alpha16 DESPLEGADOS (2026-07-12, commit 5c27931, CI Pages verde, version.json 3.95.0 + apk.json 16 + release APK 200 verificados con curl).** Tanda de 7 puntos del usuario (nueva sesión):
- (1) **Gastos sin el «−»** delante (feo para él y su pareja): filas de Gastos + las DOS vistas del total (Desglosado y «Lo que te queda»); ingresos conservan «+», balance su ±. Verificado en navegador.
- (2/3) **Popup de Novedades + histórico + sugerencias:** array `RELEASE_NOTES` (contenido solo ES, textos en cristiano; añadir entrada AL PRINCIPIO al publicar versión) + componente `WhatsNew` (portal a body, acordeón por versión, marca «tu versión ✓»). Popup automático al estrenar versión (effect con `newsTimer`/`newsDone` refs — OJO: NO sellar upfront ni devolver cleanup que mate el timer, un re-render lo cancelaba y al re-entrar ya sellado no volvía a disparar; se sella al DISPARAR). Usuarios nuevos sellados en `Onboarding.finish` (`_seenVersion`), lo ven a partir de la siguiente. Histórico en Ajustes → «✨ Novedades y sugerencias» (tarjeta para TODOS, también web). Caja de sugerencias → `state.verNotes` (sincroniza, en slimForCloud se conserva) + `cloud.feedback(text)` → app_events kind='feedback' (sin migración: RLS ya permite cualquier kind; falla visible → toast offline si sin nube). Panel Actividad: nuevo filtro «💬 Sugerencias». TODO verificado end-to-end en navegador (envío, «Tus apuntes», histórico desde Ajustes). **OJO al probar en local: el SW sirve caché vieja (stale-while-revalidate) → desregistrar SW + limpiar caches o los cambios no se ven.**
- (5) **Botón de actualizar de vuelta (app nativa):** el OTA se había vuelto silencioso (up.next para el próximo arranque, sin botón). Ahora tras dejar el bundle listo dispara `mc-ota-ready` + `window.__mcApplyOta`=up.set(id) → el pill de arriba «✨ Nueva versión · toca para actualizar» reaparece y lo estrena al momento; si no lo toca, entra solo en el siguiente arranque igual. Estado `otaReady` en App; render `(updateReady||otaReady)`.
- (2-TR) **APK alpha16: TR frío hipótesis (a)** — WebView oculta ahora ATADA a la vista (ver [[tr-frio-saga]]). PENDIENTE test del usuario en frío.
- (6) **Investigación inversiones Revolut/MyInvestor HECHA** (subagente) — ver [[mi-cartera-escalado]] sección nueva. Resumen: Revolut NO tiene API no oficial de posiciones viable (todo es banca; trade.revolut.com es de pago + antibot duro) → plan B export Excel/PDF nativo. MyInvestor SÍ tiene API no oficial documentada (repo xivira/miai-api, muerto 2022 pero con endpoints/modelo completos, login-psd2 + OTP estilo TR) → candidata a spike con captura de tráfico fresca; plan B export Excel vía portal Inversis (cbmyinvestor). Ambos: alimentar el importador CSV existente. PENDIENTE decisión del usuario (qué vía) + que exporte ficheros reales para fijar columnas.
- (7) Estrategia de adopción/venta: dada en la respuesta (posicionamiento, no features).

**v3.94.0 (2026-07-12, commit 1ab83df) — pusheada, verificada con jsdom (app real, 51 checks de clicks+estado):** aportaciones de ahorro EDITABLES en el Resumen (importe/nombre/banco, borrar, añadir — antes sembradas a piñón), Ajustes › «Total de Gastos» con dos vistas (Desglosado vs «Lo que te queda» = ingresos−gastos), «⇅ Ordenar secciones» en Fijos/Patrimonio/Deudas/Inversiones/Metas (settings.secOrder; Deudas/Metas reordenan sus datos), panel Actividad a pantalla propia (filtro solo-errores, 200 eventos), y caso CaixaBank «activo pero sin cuentas utilizables»: aviso accionable en Gestionar bancos + telemetría por cuenta a app_events + applyBankBalances conserva stale las cuentas de un banco ok-sin-datos. VERIFICAR CI/version.json y en móvil.

**FEEDBACK del usuario 2026-07-12 (capturas móvil):** (✔) multiusuario de gastos FUNCIONA — la compra de la pareja solo le salió a ella; (✘) TR en frío sigue fallando con alpha15 (ver [[tr-frio-saga]]); (?) CaixaBank conectado y activo pero SIN chips de rol y sin aportar nada — la telemetría nueva de 3.94.0 dirá qué devuelve EB (mirar Actividad tras su próximo sync); (✔) los errores ya llegan al panel Actividad (2 vistos).

**PENDIENTE GRANDE (por prioridad de feedback):**
1. Sync MyInvestor/Revolut estilo TR (WebView oculta, ingeniería inversa por bróker) — EB restringido no trae Revolut.
2. Detección de recurrentes más lista: sugerir «pásalo a fijos» proactivamente (hoy es botón en la tarjeta de suscripciones, requiere ≥3 meses de cargos).
3. ~~Arrastrados: Cofidis/bizum, gasto Consum, importar último mes~~ — HECHO y confirmado por el usuario 2026-07-12.
4. Issues #1-#10 del Project v2 (https://github.com/users/JuanjoAvila/projects/1) — varios ya cubiertos (multiusuario #5 ✔, widgets #7 ✔, APK #8 ✔); revisar y cerrar los hechos.

OJO builds: receta en [[mi-cartera-android-build]]; gh release SIN sufijo #nombre (copiar el APK ya llamado Mi-Cartera.apk); preview local con `serve` pierde la query y el SW puede servir caché vieja (desregistrar SW al probar cambios); estados de prueba necesitan aportaciones/history… ya no (defaults añadidos). El Claude móvil de claude.ai/code trabaja contra GitHub: SIEMPRE `git fetch` al empezar sesión de escritorio.
