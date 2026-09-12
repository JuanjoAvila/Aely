# Roadmap — Aely

> Estado a 2026-09-12 · **v4.19.84** — al cambiar el rol de una cuenta, el saldo ya no salta.
> Anterior: **v4.19.83** — al quitar un banco, el aviso pendiente también se va.
> Anterior: **v4.19.82** — el aviso de la última cuota se puede quitar.
> Estado a 2026-09-12 · **v4.19.83** — cambiar una cuenta de sitio ya no le mueve el saldo.
> Anterior: **v4.19.82** — el aviso de la última cuota se puede quitar.
> Anterior: **v4.19.79** — sincronizar actualiza sin perder orden ni duplicados pendientes.
> Anterior: **v4.19.78** — el pull volvía a refrescar (ámbar: gemelo/id; corregido aquí).
> Anterior: **v4.19.77** — mantén pulsada una cuenta para ordenarla; Editar solo cuando hace falta.
> Anterior: **v4.19.76** — el saldo del efectivo se guarda al cerrar, y subir la lista ya no tira.
> Anterior: **v4.19.75** — las palabras escondidas dentro de otras ya no deciden la categoría.
> Anterior: **v4.19.74** — un gasto de madrugada ya se puede reordenar.
> Anterior: **v4.19.73** — «Dia» y las farmacias abreviadas ya se reconocen.
> Anterior: **v4.19.72** — el mismo día ya no sale dos veces en Gastos.
> Anterior: **v4.19.71** — el estado de la barra se vuelca aunque el gesto se cancele.
> Anterior: **v4.19.70** — «Sabadell» ya no es un parking.
> Anterior: **v4.19.69** — la barra de abajo, sin repintar la app con el dedo puesto.
> Anterior: **v4.19.68** — la factura del agua ya no es un viaje.
> Anterior: **v4.19.67** — cada cuenta tiene su ficha en Cartera.
> Anterior: **v4.19.66** — al quitar un banco su cuenta sale de Cartera.
> Anterior: **v4.19.65** — Gastos enseña TODAS las cuentas, y la cabecera de Cartera en una línea.
> Anterior: **v4.19.64** — el efectivo estrena billete.
> Anterior: **v4.19.63** — el banco a medio conectar avisa, y al quitarlo se va de Cartera.
> Anterior: **v4.19.62** — la barra de abajo vuelve a esconderse al bajar.
> Anterior: **v4.19.61** — TSMC y Micron con logo, y los brókers también.
> Anterior: **v4.19.60** — los logos de inversiones también por ticker.
> Anterior: **v4.19.57** — re-anclar saldo por banco (padre Revolut).
> Anterior: **v4.19.56** — la R de Revolut entera y TR a su tamaño.
> Anterior: **v4.19.54** — monograma de inversiones (regresión de logos).
> Anterior: **v4.19.45** — logos medidos (lockup Enable Banking; rehuidos).
> Anterior: **v4.19.44** — Aa en Inicio y Conectar cuentas.
> Anterior: **v4.19.43** — ronda de la tarde (bugs + copy + banco fantasma).
> Anterior: v4.19.33
> Anterior: v4.19.15 — cada cuenta arrastra sus propios gastos al cerrar el mes.
> Auditoría: [hallazgos y límites](briefs/AUDITORIA-CODEX-2026-09-09.md). Efectivo sigue bloqueado por el cierre mensual; no promover la ronda completa.
> **Cola operativa y encargos del equipo:** [BACKLOG.md](BACKLOG.md). Las tablas históricas de abajo no sustituyen ese inventario ni el canal vivo.
> En Ajustes → Revisar esta beta se pliegan las tandas desde su cabecera, automáticamente tras aprobar.
> Anterior: **4.19.13** — un límite por categoría en Gastos.
> Anterior: **4.19.12** — el resumen del mes cerrado, en Inicio.
> Anterior: **4.19.11** — puertas y avisos del import histórico; quedan los casos de la auditoría posterior.
> Anterior: **4.19.10** — efectivo como una cuenta mas (tanda 6).
> Anterior: **4.19.9** — import historico: agujero A cerrado, se puede deshacer.
> Anterior: **4.19.8** — import historico: motor y UI seguras (tandas 1 y 2).
> Anterior: **4.19.7** — lo que el dueno ya aprobo no vuelve al panel de beta.
> Anterior: **4.19.6** — el gasto del mes cuadra: el posible repetido tampoco
> cuenta en el servidor, el widget se pone al día al volver y las categorías neutras
> sobreviven al pull (B09-D). OTA; sin APK y sin desplegar Supabase.
> [Evidencia del resume/categorías](briefs/b09d-codex-resume-categorias.md).
> Anterior: **4.19.5** (Novedades guarda 20 versiones). **4.19.4** (arranque suelto). **4.19.3**
> (panel beta). **4.19.2** (ventana mes). **4.19.1**.
> Canal vivo: `npm run salud` (no afirmar beta/prod solo por el working tree). OTA, sin APK.
> Anterior: **4.18.7** (cabecera de Gastos al cambiar bancos de gasto diario).
> Producción: **4.18.7**, promocionada el 2026-09-07 (antes llevaba desde el 18/8 en 4.18.3).
> Este número envejece: confírmalo con `npm run salud` antes de decírselo a nadie.
>
> Anterior: 2026-09-06 · **v4.18.6** — contención de integridad en el árbol (sin DELETE/lápida por
> similitud). Canal vivo: `npm run salud` (no afirmar beta/prod solo por el working tree). OTA, sin
> APK. Anterior: **4.18.5** (destello tabs). Producción conocida vía Pages: comprobar con `salud`.
>
> Anterior: 2026-08-18 · **v4.18.5** — El fondo ya no parpadea al cambiar de pestaña:
> el «refuerzo opaco» del gesto tapaba el degradado del `body` (−16 niveles medidos a 120 fps en su
> OnePlus 13, 12 gestos de 12, y también sin temporada). Y los gestos funcionan al estrenar la app.
> OTA, sin APK. Anterior: **4.18.4** (cada banco descuenta lo suyo, 257 € medidos). Producción sigue
> en **4.18.3** · APK **42**.
>
> Anterior: 2026-08-18 · **v4.18.3** — **EN PRODUCCIÓN**. El saldo OB ya no pinta un negativo inventado
> (Revolut −204 del padre). El widget manda `afford` y `budgetLeft` (APK 41 y 42). APK **42**.
>
> Anterior: 2026-08-17 · **v4.18.2** — ingest del widget a producción. El canal beta no prueba el widget con la app cerrada (un solo Supabase). APK seguía **41 / 4.17.1**.
>
> Anterior: 2026-08-17 · **v4.18.1** — **EN PRODUCCIÓN**. Tandas 3 y 4: Gastos enseña todos los bancos de gasto diario, calendario al apuntar, Recibos, sugerir categoría en cualquier gasto, banco del `+` en pastilla. El widget de 4.17.2 **no entra** (sigue solo en `beta`).
>
> Anterior: 2026-08-17 · **v4.18.0** — **EN `beta`**. Tandas 3 y 4: Gastos enseña todos los bancos
> marcados como gasto diario (no solo el principal), fecha al apuntar/editar con calendario de la
> casa, y categorías nuevas (heladería, joyería, videojuegos). Producción sigue en **4.17.1**.
> El widget de 4.17.2 **no entra** en esta tanda (sigue parado hasta que él compre y re-pruebe).
>
> Anterior: 2026-08-17 · **v4.17.2** — **EN `beta`**. El widget de la 4.16.2 ya no se contradecía
> por dentro, pero seguía sumando de más (907 vs 709): ingest no respetaba lápidas ni juntaba las
> dos notis del mismo cargo (Wallet + TR). Arreglo en el servidor, **sin APK nueva**.
>
> ⚠ El fallo del **bloqueo de pantalla al guardar** que encontró NO era de la tanda: venía de la
> v3.108.0 y saltaba con cualquier edición de importe o nombre. El sheet de detalle tenía dos
> nociones de «abierto» que discrepaban y dejaba el candado de `touchmove` puesto.
>
> Anterior: 2026-08-17 · **v4.17.1** — **EN PRODUCCIÓN**. Tanda `gastos-orden` (qué cuenta / qué no,
> «Movimiento» sin duplicar al sync). APK **41**. El widget no entra.
>
> Anterior: 2026-08-06 · **v4.16.1** — APK limpia **39 / 4.16.1**: sin franja nativa bajo la cámara.
> La 4.16.0 trae presupuesto que cuadra, divisa en la nube (migración 0020) y notis de Google Wallet.
>
> Anterior: 2026-08-05 · **v4.15.0** — **EN PRODUCCIÓN**. Ambientación suave, conversor FX,
> presupuesto alineado en Resumen/Gastos/widget y extracto de todos los bancos. Aprobada en el
> móvil (4.15.0.19, APK 35) con 12 tandas a cero fallos.
>
> Anterior: 2026-08-05 · **v4.14.1** — **EN PRODUCCIÓN**. OTA del pulido de Gastos (importes largos
> ¥/₺ + letra pequeña) que había entrado tras el sello 4.14.0. Multidivisa de la 4.14.0 sigue.
> APK **35 / 4.12.0** (sin nativo; llega por OTA).
>
> Anterior: 2026-08-05 · **v4.14.0** — **EN PRODUCCIÓN**. Multidivisa real (lira + moneda de
> visualización que convierte + Apuntar en divisa aparte + comparar monedas) y Ajustes → Dinero
> limpio. APK **35 / 4.12.0**.
>
> Anterior: 2026-08-05 · **v4.13.0** — **EN PRODUCCIÓN**. Ronda beta cerrada: gestos (ola nativa
> arriba/abajo, barra quieta, rayita) y plan-swipe aprobados 5/8 en `4.13.0.49`. Arranque ya había
> subido como 4.12.3; import de hojas como 4.12.4; bancos/temporada/reservar/docx en la misma
> 4.13.0. APK sigue en **35 / 4.12.0** (sin cambios nativos; llega por OTA).
>
> Anterior: 2026-08-01 · **v4.13.0** — en **beta**: **el arranque YA está en producción como 4.12.3**
> (2026-08-01, primera vez que se sube por feature y no por tanda entera: el nombre ya no cambia
> de forma a media carga —`font-display:swap`, la causa real de «algo raro antes del icono»—, el
> patrimonio vuelve a contar hasta la cifra visible, el logo se va antes que el fondo, y las
> temporadas caen UNA vez y paran). Sigue en `beta`, pendiente de su turno cada una por separado:
> **importar una hoja de gastos** (Excel o CSV, duplicados descartados solos), **gestos** —rebote
> rechazado dos veces, «no es el efecto ola»— y **bancos** —TR por Open Banking rechazado, «da
> error»; el sync del banco de gasto diario, arreglado, pendiente de su prueba.
>
> Anterior: 2026-07-28 · **v4.13.0 (primera versión)** — la ronda completa tal como se commiteó
> (mezclada, sin ramas `tanda/<id>`; por eso el arranque se tuvo que separar A MANO en vez de con
> `cherry-pick`). Producción iba por **4.12.1** (APK 35).
>
> Anterior: 2026-07-27 · **v4.12.1** — **APROBADA y en producción** (promocionada el 28/7). Ajustes solo desde Resumen, sin stopper al abrir Ajustes/perfil, y Gastos baja sin parones. Los dos puntos que quedaban del expediente del tirón los cerró él desde el móvil: «lo del tirón al deslizar arregladísimo» y «lo del perfil también va ultra fluido, sin stoppers».
>
> Anterior: 2026-07-27 · **v4.12.0** — **APROBADA en el móvil y en producción** («funciona» + «todas las pestañas van increíblemente fluidísimas»). Causa del tirón: la `transition` CSS del carrusel juddeaba a 120 Hz al soltar; asentamiento por `requestAnimationFrame` → 0 saltos. APK **35** (icono/splash nativos; OTA no los lleva — si aún no está instalada, ofrecerla). Ver `docs/LAG-DESLIZAR.md`.
>
> Anterior: 2026-07-26 · **v4.11.0** — **APROBADA en el móvil y promocionada a producción** («aprobado, todo funciona a las mil maravillas» — cuarta beta, 4.11.0.10, con la APK 34 puesta). Primera versión que recorre el circuito entero como estaba pensado: se publica en `beta`, la prueba él en su móvil, la rechaza dos veces con el panel de revisión, y sube cuando la aprueba. **el splash existía en el HTML y no lo veía nadie**: estaba dentro de `#root` y `ReactDOM.createRoot()` vacía su contenedor al montar, así que React se lo llevaba por delante (medido: fuera del DOM a los 150 ms); y React/ReactDOM/supabase iban en el `<head>`, bloqueando el parser, así que el navegador no tenía nada que pintar hasta ejecutar ~600 KB — el negro del vídeo. Ahora es hermano de `#root`, los scripts van después, con mínimo de 520 ms en pantalla y dos rAF antes de montar. **Corrección a la 4.10.0:** el patrimonio no venía mal, es una animación que cuenta hasta la cifra final. **Bienes separado de «Tus cuentas»** como bloque ordenable propio. **Perfil: cerrar = abrir al revés** — una sola curva y un solo umbral para los dos sentidos (iban con números distintos y el de abrir pedía casi el triple de arrastre), y candado durante la animación para que un dedo puesto a medias no la corte en seco. E2E 62 → 72. **Tercera vuelta (2026-07-26): el fallo del perfil era OTRO y por fin se ha reproducido** — con el panel scrolleado (`scrollTop=220`, lo normal) el arrastre solo scrollea y no cierra; ninguna prueba lo veía porque todas empezaban con el perfil arriba del todo. Además `e.preventDefault()` **nunca funcionó**: React ata `onTouchMove` en modo pasivo, así que el navegador se quedaba el gesto (los listeners van ya a mano con `{passive:false}`, y `touchcancel` cuenta como final). Ahora la franja de arriba es asa y, tirando desde el medio, el cierre toma el relevo cuando el scroll llega al tope. **⚠ Pendiente APK 34**: el arreglo de las notis duplicadas es Java (`Notif.idFor`, ids estables — el id salía del reloj y cada aviso se apilaba en vez de sustituir). **Lleva mezclada la 4.10.2**: sin ella este bundle no se puede ni descargar. **Segunda vuelta (2026-07-26): la rechazó desde el móvil, 3 ok / 2 fallos, los dos del perfil** — unificar los umbrales dobló el de cerrar (52 → 94 px) y el candado de la animación se activaba también en el rebote y en un toque suelto, dejando la app sorda medio segundo al segundo intento. Curva compartida sí, umbral no (`PROF_TH_OPEN`/`PROF_TH_CLOSE`). Y dos del canal, que estrenaba móvil: el bundle se sellaba con un número distinto del que anunciaba el manifiesto (**la misma beta ofrecida en bucle**, ahora `MC_STAMP_VERSION` + el workflow no publica si no cuadran) y **apagar la beta no devolvía a producción** (`_mcApplyChannelBundle`: cambiar de canal instala en la dirección que sea).
>
> Anterior: 2026-07-25 · **v4.10.2** — publicación MÍNIMA, capítulo 2: **la CSP era solo la mitad**. Los assets de las releases de GitHub **no mandan cabeceras CORS** en ninguno de los dos saltos del redirect (verificado con `curl -H Origin`), así que el `fetch` de la WebView (origen `https://localhost`) los tira igual con la CSP arreglada — mismo síntoma, causa distinta. Ahora el manifiesto lo pide **Android** (`CapacitorHttp`), como el login de MyInvestor. Y `mcFetchManifest` solo cae a estable con un **404**: cualquier otro fallo sale en el toast y en `app_events`, porque disfrazarlo de «no hay nada nuevo» es lo que escondió esto durante semanas. El `bundle.zip` de la beta **nunca se había descargado** (`downloadCount: 0`). Guardián: `tests/updates.test.mjs` ejecuta el trozo real del monolito con `fetch`/`CapacitorHttp` de mentira.
>
> Anterior: 2026-07-25 · **v4.10.1** — publicación MÍNIMA: **el canal beta llevaba roto en silencio**. Los assets de las releases de GitHub redirigen a `release-assets.githubusercontent.com` (antes `objects.githubusercontent.com`) y ese dominio no estaba en `connect-src`, así que el `fetch` moría; la caída a estable de `mcFetchManifest` convertía el fallo en un «✓ estás a la última» con el canal activado y la beta publicada. No podía arreglarse POR beta, porque es lo que impide bajarla. **El resto del trabajo del día (splash que no se veía, bienes separados de cuentas, perfil con una sola curva para abrir y cerrar) está en la rama `beta` = release `beta`, esperando la prueba del dueño.**
>
> Anterior: 2026-07-25 · **v4.10.0** — **el gesto del perfil, ahora con el caso real**: el panel SCROLLEA (su contenido mide ~1.680 px y no cabe en un móvil), y el arrastre medía desde el `touchstart`, así que al llegar arriba saltaba de golpe a la miniatura (medido: 1,000 → 0,122 en un frame) y con el rebote del scroll volvía a pantalla completa — ese ida y vuelta era el parpadeo del vídeo. Además **abrir** se había quedado sin los dos arreglos que sí recibió el cierre (opacidad y radio por frame), porque los dos gestos estaban duplicados; ahora comparten `profileGrab()`. **El CSV de Revolut ya no rechaza el extracto de la cuenta en €** —justo el que hace falta para el coste del oro—: lo confirma, guarda los euros y dice qué falta; los ficheros se pueden soltar de uno en uno. **Splash de entrada** con la marca de la app que espera al primer dato bueno (se acabó ver el patrimonio viejo un segundo). **Cartera ordenable** y **Hogar mudado al perfil**. **Seguridad del servidor**: CORS con lista blanca en las diez funciones, límite de peticiones en `ingest` y `myinvestor-connect`, y el `state` del OAuth caduca a los 30 min y solo vale una vez. **Presupuesto de rendimiento** en `npm test` (987 KB / 278 KB gzip / 3 bloqueantes). E2E 53 → 62.
>
> Anterior: 2026-07-25 · **v4.9.2** — **incidente del APK 32, corregido**: se empaquetó copiando `public/`→`www/` a mano en vez de con `build-www.mjs`, así que salió con `APP_VERSION: "dev"` — y como `_mcNewerVer` hace `parseInt("dev")`→`NaN`, la comparación de versiones daba `false` siempre y **ese móvil no volvía a actualizarse nunca**, sin error visible. Además, reescribir un módulo con `Get-Content|Set-Content` de PowerShell lo leyó como Windows-1252 y corrompió 95 líneas (el «✓» de TR salía como tres símbolos sin sentido). **APK 33 / 4.9.2 la sustituye.** Guardianes: `build-www.mjs` aborta si no sella, `npm run apk:prep` encadena el proceso entero, y `docs-frescura` caza el mojibake.
>
> Anterior: 2026-07-25 · **v4.9.1** — **los brókers los elige el usuario** (chips «¿Qué brókers usas?»; antes se pintaba el login de TR/MyInvestor/Revolut aunque no tuvieras cuenta) y **sus tarjetas se pliegan** con el mismo acordeón que los bancos (`bkBrand()` compartido). **Cierre del perfil sin superponer dos pantallas**: se quitó el fundido de opacidad del arrastre —el panel ocupa la pantalla entera, así que fundirlo dejaba ver perfil y resumen a la vez— y ahora escala hacia el avatar, opaco, como la apertura en reversa. **`docs-frescura` vigila que no quede código publicable sin subir `VERSION`**, que fue el fallo del día: todo desplegado en Pages con la versión intacta y el móvil sin enterarse. **APK 32 / 4.9.0 publicada** (fix de sesión de TR + token de ingest en cabecera). E2E 49 → 53.
>
> Anterior: 2026-07-25 · **v4.9.0** — **Trade Republic en frío CERRADO de verdad** (capítulo 3, verificado por el usuario matando la app): la causa era `snapshotCookies` quedándose con la copia CADUCADA de `tr_refresh` —sale dos veces en la cabecera, con dos paths— y re-guardándola en cada vuelta, así que una vez estropeada no se recuperaba nunca (`put` → `putIfAbsent`); además la WebView se aparca en `about:blank` al pasar a segundo plano para que la SPA de TR no rote la sesión a nuestras espaldas, y los errores llevan pegado el estado del jar para diagnosticar sin cable. **Coste del oro de Revolut automático** cruzando el extracto de metales con el de la cuenta en € por marca de tiempo (verificado: 0,258218 oz / 1.000 € / 3.872,70 €/oz). **«Mis bancos» en acordeón**. **Gesto de cerrar el perfil** sin repintar la pantalla entera por frame. **Seguridad**: token de ingest en cabecera; `app_events` recupera los grants de `service_role` (la telemetría del ingest llevaba dos semanas muerta en silencio). **`scripts/errores.mjs`** para leer los errores del móvil desde la consola. **MyInvestor**: diagnóstico cerrado, el reCAPTCHA rechaza el token por dominio → hace falta WebView nativa. E2E 46 → 49.
>
> Anterior: 2026-07-24 · **v4.8.0** — **rendimiento**: el estado se guarda PARTIDO (los gastos en su propia clave, solo se reescriben cuando cambian) → volver a primer plano pasa de escribir 477 KB (2.000 gastos) / 1.912 KB (8.000) a **1 KB constante**, que es la causa real del «cuanto más la uso, más lenta va»; `totals` con dependencias reales, `parseDate` cacheado, filtrado de Gastos en una pasada y filas en `React.memo`. **Concepto de los movimientos** (mensaje del bizum / descripción del banco, editable y con relleno retroactivo al sincronizar). **Bancos caídos**: noti + deep-link al panel con el banco resaltado. **Entorno de pruebas** del dueño: banco de pruebas aislado + canal beta por release `beta`. **Seguridad**: CSP, token de ingest de 256 bits, comparación en tiempo constante. E2E de 10 → 34.
>
> Anterior: 2026-07-22 · **v4.7.0** — notis sin duplicados (gasto tocho y recibo de la víspera, éste además con importe exacto), roles de cuenta excluyentes y en el subtítulo del banco, brókers con animación + orden configurable, deudas con «Quedan n/tot cuotas» y «acabas en» uniformes, badge de reCAPTCHA oculto con errores diagnosticables. El fix del gasto tocho es Java → **APK 31 publicado**. **v4.6.4:** MyInvestor: intento OTA de resolver el reCAPTCHA en la WebView (pegando el site key). **v4.6.3:** «Gasto diario» multi-banco en el chip de siempre (quitado el duplicado). **v4.6.2:** barra inferior pegada abajo con letra pequeña/enorme, widget re-empuja al volver a la app. (4.6.1:) letra pequeña, Hogar movido a Cartera, animaciones de temporada con profundidad/parallax estilo Revolut. (Base:) **v4.6.0** — temáticas de temporada, accesibilidad (letra grande a nivel body sin descuadres, reducir animaciones, contraste), metas con teclado propio + banco, más monedas + comparativa, varios bancos de gasto diario, selección de Cartera persistida, Ajustes reordenados y encogidos al abrir, widget con «lo que te puedes permitir» (APK 30).

## Listo para uso diario

Multi-cuenta, ingest TR, OTA/APK, gamificación, onboarding, inversiones, deudas, Open Banking, MyInvestor, RGPD mínimo, tests unit + E2E, código modular, **Hogar Fase 1+2** (+ fix RLS `0014`), informe mensual, fin de mes en paz, presupuesto por categoría, recibos gordos, widget Android, export JSON + informe imagen, **multi-banco en Gastos** + filtro por banco, tutorial/roles claros, **FX multi-divisa (USD/GBP/CHF + costEur)**, **sugerencia de categoría (KW + IA opcional)**, **diccionario ampliado de comercios** (impuestos/multas, **Pádel**), **Sentry en prod**, perfil pull-down, sheets sin velo negro, brókers en tarjetas planas, **APK nueva se ofrece sola** (noti + instalador al abrir), **OB a demanda** (botón en Cartera), **gráfico de Cartera multiseleccionable**, **editor de cuentas v4** (nombre+rol, saldo bloqueado si viene del banco), **bienes editables**, **monedas £/CHF**, **huella + logout en Ajustes**, **Hogar accesible desde el perfil** (4.10.0; antes en Cartera), **bloques de Cartera ordenables**, **«¿Me lo puedo permitir?» a plazos** (cuota + crear deuda), **banco elegible en gastos manuales**, **Sincronizar de Cartera con TR/MI**, **temáticas de temporada** (Mundial/Halloween/Navidad/Verano/Invierno/Pascua con animación ambiental), **accesibilidad** (letra grande a nivel body sin descuadres, reducir animaciones, contraste), **aportar a metas con teclado propio + banco**, **15 monedas + comparativa**, **varios bancos de gasto diario**, **selección de Cartera persistida**, **Ajustes reordenados/encogidos**, **widget con «lo que te puedes permitir»**.

## Versión actual (alineación)

| Qué | Valor |
|-----|--------|
| Web / OTA (`VERSION`) | **4.19.84** (repo; canal = `npm run salud`) |
| APK (`versionName` / `versionCode`) | Repo: **4.18.3 / 42**. Live hasta instalarla: **4.17.1 / 41**. |
| Anterior | **4.16.1 / 39** (sin franja bajo la cámara), **4.16.0 / 36–38** (Wallet). Antes: **4.12.0 / 35**. |
| `public/apk.json` | **42** / 4.18.3 |

## Pendiente / limitaciones conocidas

| Tema | Notas |
|------|--------|
| **MyInvestor reCAPTCHA** | **4.6.4:** intento OTA — la app carga el reCAPTCHA de Google bajo demanda con el **site key de MyInvestor** (que el usuario pega en la tarjeta MI; su web va tras Incapsula y no se puede extraer desde el CI), ejecuta la acción, y reintenta el login con `X-Recaptcha-Token`. **Riesgo:** reCAPTCHA v3 suele atar el token al dominio registrado (`myinvestor.es`); si MI valida el origen, rechazará el token de nuestra WebView → entonces el único camino es una **WebView nativa** que cargue la web de MI (APK). El intento OTA se prueba en 1 min: si el token cuela, resuelto sin tocar nativo. Palancas previas: `x-myinvestor-app`=3.150.0, mensaje humano, `captchaToken` en cabeceras (plumbing listo). |
| **Open Banking: sync solo a demanda** | Desde 4.1.0 NO hay auto-sync al abrir/volver (caducaba consentimientos de Caixa/Sabadell por «uso robótico»). Syncs vivos: botón «↻ Sincronizar bancos» en Cartera, «Actualizar» en Mis bancos, tras autorizar (`?bank=ok`), bootstrap 1ª vez, y noti del banco (ajuste). Si aun así caducan, el problema es otro (límite 90 días PSD2 = normal). |
| **Widget «Puedes gastar»** | 4.18.2: ingest cuenta como la app (`filasComoLaApp`). Prueba: pago con la app cerrada. Si el widget no se re-pinta en MIUI, quitar y re-añadir. |
| **Limpieza del repo (tanda 16)** | Basura, docs rancio, código muerto. **No visual, no es rendimiento, no es Clean Code de libro.** El monolito es a propósito (`docs/adr/0002-monolito.md`). Alcance en `docs/briefs/plan-vuelta-crucero.md` §16. |
| **Play Store** | **Lo último.** Data safety + NotificationListener. No adelantar: si se implementa, se tienta de publicar antes de que esté pulida a su criterio. Cualquier tanda nueva va **antes**. |
| **Pulido de diseño (tanda 17)** | Mock Claude Design: `docs/design/handoff/` (SPEC-v4 + mockup HTML). **No tocar a ciegas.** Hogar, Apuntar, Gastos, el look. Tanda propia, no mezclar con dinero. |
| **OPENAI_API_KEY** | Opcional en Supabase Secrets → Edge `categorize`. Ver [CATEGORIZE.md](CATEGORIZE.md) |
| **IA en gastos antiguos** | 4.19.1 ya escribe categoría (y banco/nota/borrado) por uuid cuando el gasto lo tiene; ids cortos del móvil siguen por atributos. Recategorizar histórico a IA sigue siendo manual y seguro fila a fila. |
| **Salto a TR/Open Banking al sincronizar automáticamente** | Reportado el 2026-09-07, pero no reproducido ni respaldado por el flujo inspeccionado. No se cambia la navegación a ciegas; recoger pantalla y punto de entrada exacto si vuelve a ocurrir. |

## Lo que apuntó él el 2026-07-26 — HECHO en la 4.12.0

| Tema | Cómo quedó |
|------|------------|
| **`RELEASE_NOTES` en cristiano** | ✅ Hecho. Regla y tabla de ejemplos en `AGENTS.md` §4; las de la 4.11.0, que eran el contraejemplo, están reescritas; y de paso las notas van ya en **es/en/ca**. |
| **Tirón al deslizar / Deudas** | ✅ Hecho en tres capas: premount + `heavyOk` adelantado + **scroll→swipe** (`freezeShell` en tab + `onPageScroll` ignora durante el gesto). Guardián con el caso real a CPU ×6. |
| **Banco caído: ni redirige ni se ve rojo** | ✅ Noti → solo Cartera con banner; Mis bancos usa `bankIssues` para pintar coral; `bankConnectOnce` evita doble OAuth / `invalid_request`. |
| **Trade Republic mudo al desconectarse** | ✅ Banner + noti + resumen en Ajustes; CTA abre Mis bancos con TR, no OAuth. |
| **Stopper del perfil (560 ms)** | ✅ Candado afinado: síncrono al cerrar, cierre permitido tras abrir, generación en `transitionend`. |
| **Versión APK invisible en Ajustes** | ✅ Pie y fila de actualizaciones: `web vX · app Y` (puente ya en APK 35). |
| **Herencia de veredictos en el panel de beta** | ✅ Se conservan marcas compatibles entre compilaciones; aprobar pliega la tanda y se puede cambiar de opinión. Los rechazos anteriores requieren revalidación: consultar `npm run listo`. |

## Lo siguiente

Primero FIN-01 (efectivo al cerrar mes) y FIN-02 (pagos mensuales del histórico), después
identidad cloud, widget y validaciones pendientes. Reparto, pruebas y dependencias en
[BACKLOG.md](BACKLOG.md). `npm run salud` y `npm run listo` dan la versión y los veredictos
actuales. No promover la ronda entera con esos bloqueos abiertos.

### Pendiente de respuesta suya

| Qué | Por qué hace falta preguntarlo |
|-----|-------------------------------|
| **Lo raro del arranque** | Pidió quitar «algo raro que aparece antes del icono». Se ha arreglado lo que **sí** se puede arreglar por OTA y estaba mal: el nombre del splash cambiaba de forma a media carga (fallback de Georgia → Fraunces). Si lo que él ve es ANTES de eso —con la app cerrada del todo— entonces es el **splash NATIVO**, que no viaja por OTA: `styles.xml` usa `Theme.SplashScreen` con solo `android:background`, sin `windowSplashScreenBackground` ni `windowSplashScreenAnimatedIcon`, así que Android 12+ mete su propia pantalla antes. Arreglarlo es nativo → **APK nueva**. No se ha tocado sin confirmarlo. |

### Abierto, con lo medido

| Tema | Qué se sabe |
|------|-------------|
| **«Gastos se queda a medio pintar / desvaído»** | **No reproducido.** Se montó su camino del vídeo (arrancar, esperar, deslizar a Gastos con el dedo, CPU x12, 1.200 gastos) y se midieron filas y opacidad a los 120 ms, 500 ms y 2 s de soltar: 12 filas, opacidad 1, ninguna a medias ni desvaída. No se toca a ciegas. Sospechas sin descartar: el `content-visibility:auto` de `.page` cuando entra una pestaña que aún no es `page-live`, y la paginación de la lista (12 filas + centinela) leída como «lista a medias». Lo que desbloquea el diagnóstico ya está puesto: el veredicto dice la compilación y la APK. |
| **Abrir el perfil: los ~175 ms que quedan** | Suyo, 27/7: «ha mejorado una barbaridad, le queda nada para ir a la velocidad que quiero». Ya no es JS (el perfil de CPU deja la app por debajo del 1 %): es pintado del navegador al hacer visible una pantalla de ~1.680 px. **No hay palanca CSS**: velo, sombra, animación del avatar, radio y `content-visibility:auto` en sus tarjetas están medidos y descartados uno por uno (números en el `CHANGELOG`; el último parecía ganar con 5 pasadas y salió peor con 9 intercaladas). El siguiente tramo pide **rediseñar qué se enseña al abrir** — enseñar menos panel, no pintarlo más rápido. |

## Review externa (ChatGPT, 2026-07-25) — qué falta de verdad

El usuario pidió una review del repo a ChatGPT y trajo el veredicto (arquitectura 9, organización
8,5, seguridad 8,5, rendimiento 8, CI/CD 9,5, tests 9). **La mitad de lo que propone ya está hecho**
y darlo por pendiente sería trabajar dos veces, así que la tabla separa las dos cosas. Lo que ya
existe se deja anotado con su prueba: si mañana alguien vuelve a proponerlo, aquí está la respuesta.

| Propuesta | Estado real | Qué falta (tarea) |
|-----------|-------------|-------------------|
| Beta cerrada con 10-20 amigos | **A medias.** Hay canal beta + panel de revisión (`docs/TESTING.md`), pero es de **un solo móvil**: el suyo. | Que la beta la puedan recibir otros: APK firmado repartible, alta de probador sin ser `is_admin`, y que los veredictos de varios convivan en el panel. |
| Feedback dentro de la app | **Ya está.** Ajustes → App → «Enviar sugerencia» (4.1.0) + `betaReport` del panel de beta. | — |
| Crash reporting | **Ya está.** Sentry en producción ([SENTRY.md](SENTRY.md)) + `app_events` propio, con `window.onerror` y `unhandledrejection` enganchados. | — |
| Analytics de uso | **HECHO (4.13.0).** `cloud.logUso(etiqueta)` con **vocabulario cerrado** (`USO_OK` en 00-core): pestañas y acciones, agregado y sin un solo dato personal. Instrumentadas las cuatro pestañas y el importador. | Una vista SQL que agregue `kind='use'` por etiqueta y semana. El dato ya se está guardando, que era lo que no se recuperaba hacia atrás. |
| Rate limiting | **A medias.** Migración `0019` + `_shared/ratelimit.ts`, aplicado en `ingest` y `myinvestor-connect` (4.10.0). Documentado como hueco #7 en [AMENAZAS.md](AMENAZAS.md). | Extenderlo al resto de funciones (`prices`, `categorize`, `bank-*`) o dejar por escrito por qué no hace falta. |
| Validar TODO lo que entra | **Sin auditoría sistemática completada.** Hueco #8 de [AMENAZAS.md](AMENAZAS.md). | SEC-01: inventariar todas las Edge Functions actuales; tipos, tamaños y rangos, con pruebas de errores 4xx sin efectos. El antiguo recuento de diez ya no sirve. |
| Logs sin información sensible | **A medias.** `guard-privacy` vigila el cliente; las métricas nuevas nacen cerradas (`USO_OK`). Hueco #9 de [AMENAZAS.md](AMENAZAS.md). | Auditar qué acaba en `app_events` y en Sentry (mensajes de error con importes, correos o IBAN) y limpiarlo en origen. |
| Virtualización de listas | **Ya está.** La lista pagina — `e2e/rendimiento.spec.mjs`: 3.000 movimientos no son 3.000 nodos. | — |
| Memoización / no repetir trabajo | **Ya está** (4.8.0): estado partido, `totals` con dependencias reales, `parseDate` cacheado, filas en `React.memo`, presupuesto de rendimiento en `npm test`. | — |
| Lógica financiera independiente de React | **A medias.** La lógica pura se extrae y se testea sin React (`scripts/load-pure-logic.mjs`, 15 suites), pero convive en el mismo fichero que la UI. | Separar de verdad los servicios (cartera, movimientos, dividendos, precios) a módulos sin un solo `React.createElement`, y que la UI solo los llame. Sin prisa: es refactor, no arreglo. |
| Módulos por dominio, no por número | **No.** `src/modules/` va numerado por orden de ensamblado (`00-core`, `06-sync-brokers`, `10-app-components`…). | Reagrupar por dominio cuando duela — hoy 15 ficheros se siguen; el riesgo real es `10`/`11`, que son los que crecen sin parar. |
| Importadores PDF/CSV | **CSV, XLSX, DOCX y PDF de texto soportado ya existen.** Pruebas `import-docx-pdf` unitarias y E2E. Los PDF escaneados no tienen OCR. | No reconstruir el lector. La integridad del histórico sigue en FIN-02/03/07 de [BACKLOG.md](BACKLOG.md). |
| Sistema de backups | **Copia diaria y UI de restauración ya existen.** `backupState`, `listBackups`, `getBackup` y copias automáticas en Ajustes. | Ensayo completo de restauración aislada, incluyendo gastos cloud, reinicio y segundo cliente: OPS-02 de [BACKLOG.md](BACKLOG.md). |
| Sincronización bancaria con adapters | **A medias.** Cada banco/bróker tiene su módulo, pero sin interfaz común. | Interfaz única (conectar / sincronizar / desconectar / estado) para que añadir un banco no toque la UI. Enlaza con Enable Banking. |
| Play Store, cobrar, gestor fiscal | Ya estaba en el plan (ver «Solo si lo pides» y la nota de freemium). | Antes de cobrar un euro: **hablar con un gestor**. La consulta es barata comparada con regularizar tarde. |
| Más tests de lógica financiera | Lógica y Deno aprobados, 164 E2E Chromium en la auditoría 4.19.14. Recuento vivo en runner/mapa. | Seguir sumando al tocar dinero; los casos pendientes concretos están en [BACKLOG.md](BACKLOG.md). |

### Segunda tanda de la misma review (2026-07-26)

El usuario trajo una segunda ronda, centrada en **operación** más que en producto. Dos de las
propuestas son la tabla de arriba dicha con otras palabras, y dos las descartamos a propósito —
queda escrito para no volver a discutirlas.

| Propuesta | Veredicto | Qué falta (tarea) |
|-----------|-----------|-------------------|
| **Métricas funcionales** (usuarios activos, syncs OK/KO, imports, tiempo medio de sync, bancos más usados, errores por banco, funciones más usadas) | **Repetido** — es la fila «Analytics de uso». Lo nuevo es la lista de qué medir. **Más barato de lo que parece**: `Core.logEvent(kind,message,detail)` (`00-core.js`) ya existe con RLS solo-admin, tope de 20/sesión y dedupe. | Un `kind` nuevo (`use`) + una vista SQL agregada. **Agregado y anónimo**: son datos financieros, `guard-privacy` vigila el cliente. Instrumentar **ahora** aunque haya 3 usuarios: el histórico de uso no se recupera hacia atrás. |
| **Health check** (versiones, migraciones pendientes, última release, errores 24h/7d, último backup) | **HECHO (4.13.0).** `npm run salud` — script, no pantalla, por lo que ya estaba escrito aquí. | Nada. Da alineación de versiones + APK viva, qué sirve Pages **de verdad**, si la beta va por delante o por detrás, commits sin promocionar, migraciones y errores a 24 h / 7 días. |
| **ADR** (`docs/adr/`, una página por decisión) | **HECHO (4.13.0).** [`docs/adr/`](adr/) con las cinco: Supabase, monolito, cero CDNs, OTA propio y Capacitor. | Nada. Cada una dice qué se descartó y qué haría cambiar de opinión; la del OTA lleva pegada la lección de las dos causas con el mismo síntoma. |
| **Threat model** (XSS, inyección, token robado, noti falsa, replay, función pública, acceso indebido) con ✅ mitigado / ⚠ pendiente | **HECHO (4.13.0).** [`docs/AMENAZAS.md`](AMENAZAS.md): 13 amenazas cruzadas con lo que ya hay. | Lo que sale de ahí, por orden: **validar la entrada de las diez Edge Functions** (la única en rojo), **auditar `app_events`/Sentry**, y **extender el rate limit**. |
| **Observabilidad** (duración de Edge Functions, consultas SQL más caras, tiempo de carga) | **A medias, y la mayor parte NO se construye.** Las duraciones de Edge Functions y el SQL caro ya los da el panel de Supabase (Logs + Query Performance); rehacerlo es trabajo tirado. | **HECHO (4.13.0):** `cloud.logPerf` mide justo eso —lo que pasa en el móvil— redondeado a medio segundo. Las duraciones de Edge Functions y el SQL caro se siguen mirando en el panel de Supabase, que ya los da. |
| **Feature flags** por usuario | **No ahora.** Ya hay dos ejes de gating: el canal beta y `profiles.is_admin`. Meter flags en el monolito = ramas de código muertas conviviendo en los ficheros que ya crecen sin parar (`10`/`11`). | Se recupera **el día que la beta tenga varios móviles** (fila «Beta cerrada» de arriba). Entonces sí es una maravilla; antes, no. |
| **Tercer canal «Experimental»** (Experimental/Beta/Stable) | **No.** Repite la fila «Beta cerrada» y multiplica por tres la matriz de release (OTA + manifiesto + APK), que es exactamente la que reventó dos veces seguidas en 4.10.1 y 4.10.2. | Lo que falta no es un canal más: son **más móviles en el que ya existe**. |
| **«Operations Dashboard» como tarea única** | **Dividido a propósito.** Son tres cosas distintas (salud + métricas + observabilidad) con costes muy diferentes. | Con 3 usuarios, el 90 % del valor está en el script de salud + la vista SQL de métricas. La pantalla, si algún día compensa. |

## Bloqueante antes de publicar en Play Store: el NOMBRE

Decidido el 2026-07-26. **«Aely» se queda como descripción, no como marca.** Los hechos:

- Ya hay una app **«Aely»** de finanzas personales en Google Play (`com.support_tech.micartera`),
  misma categoría: gastos, informes, export a Excel. No es ilegal llamarse igual —el nombre es
  genérico y nadie puede apropiárselo— pero en Play seríamos invisibles entre los homónimos.
- El Gobierno tiene **«Cartera Digital Beta»** (identidad digital y verificación de edad). Nombre
  distinto, pero la palabra «cartera» arrastra esa asociación en España.
- Un nombre descriptivo **no se puede registrar** como marca: no habría nada que defender.

Cambiarlo ahora cuesta un rato; con la app instalada en 300 móviles, cuesta muchísimo más. La
lista de candidatos se comprueba en Play, App Store, dominio y OEPM/EUIPO antes de proponerla, y
la elección es suya. El registro real lo confirma un agente de la propiedad industrial, no nosotros.

## Solo si lo pides

| Tema | Notas |
|------|--------|
| **Play Store** | **Lo último**, cuando él diga que está hiper pulida. No adelantar. |
| **Pulido visual gordo** | SPEC-v4 / handoff en `docs/design/` |
| **Logos de banco reales** | Idea 2026-07-18: sustituir el monograma (Sb/Cx…) por el logo del banco. Regla de la casa: cero CDNs → habría que auto-hospedar los ~8 logos habituales en `public/vendor/banks/` (los de Enable Banking vienen de fuera y solo se usan en el picker). |
| **Freemium / suscripciones** | Idea 2026-07-18 (medio en broma, medio en serio): gratis = cuentas manuales (importe editable a mano); plan de pago = sync bancaria automática. El nombre editable en ambos. La 4.1.0 ya deja la semántica lista (manual = saldo editable; conectada = solo nombre/rol). Para monetizar de verdad faltan pasarela de pago + entitlements en Supabase — se diseña cuando lo pidas, no se mete de tapadillo. |

## Widget Android (ya existe)

En el móvil: **mantener pulsado en el escritorio → Widgets → Aely**.  
Muestra gasto del mes vs presupuesto + saldo de la cuenta diaria.

## Export / informe

| Qué | Dónde | Estado |
|-----|--------|--------|
| Backup JSON | Ajustes → Copia de seguridad → Exportar | ✅ |
| Informe del mes (imagen WhatsApp) | Inicio → tarjeta del mes cerrado (4.19.12); compartir imagen, con descarga PNG si no hay share | ✅ |
| Hogar y gastos compartidos | **Perfil → «Tu gente»** (toca tu avatar en Inicio). Movido aquí en 4.10.0 porque al final de Cartera no lo veía nadie; antes en Cartera (4.6.1) y antes aún en Ajustes → Conexiones | ✅ |
| Sugerencias / errores del usuario | Ajustes → App → «Enviar sugerencia» (desde 4.1.0; antes dentro de Novedades) | ✅ |

## Mantenimiento habitual

1. Bugs en uso (feedback real)  
2. Features pedidas  
3. **Cada release:** alinear `VERSION` + `package.json` + `CHANGELOG` + `RELEASE_NOTES` + APK (`build.gradle` + `apk.json` + release GitHub) + `docs/ROADMAP.md`  
4. Play Store: **siempre lo último**. Si se añade algo, va antes. Sideload/APK GitHub no esperan.

Ver [CHANGELOG.md](../CHANGELOG.md) · [ARQUITECTURA.md](ARQUITECTURA.md) · [AMENAZAS.md](AMENAZAS.md) · [ADR](adr/) · [TESTING.md](TESTING.md) · [SENTRY.md](SENTRY.md) · [HOGAR.md](HOGAR.md) · [CATEGORIZE.md](CATEGORIZE.md) · [AGENTS.md](../AGENTS.md)
