Candidata de beta4.26.124 (13/10/2026): en Plan, bajar despacio desde arriba del todo ya no hace saltar el contenido. El gesto que cambia de sección empujaba el scroll a mano encima del scroll del navegador; se quita ese empujón y el scroll es solo del navegador. Solo web, encima de la beta 4.26.123; la APK sigue en la 55 y ninguna función del servidor cambia. Salen del panel las tres tandas aprobadas en el móvil sobre la 4.26.122.1 (`recibo-cargo-en-gastos`, `tr-iguales-ordinal` y `bancos-acuse-reconexion`); quedan en revisión `plan-scroll-lento`, nueva, e `inicio-patrimonio-flujos`, aún sin veredicto.

Beta4.26.123 (13/10/2026), publicada: la gráfica de Inicio aparece desde el primer día, también con hipoteca o préstamos dados de alta de antes. Una deuda sin fecha explícita ya no recorta la serie: su saldo se reconstruye hacia atrás con su cuadro de cuotas (o se mantiene si no hay cuota); una cuenta manual mantiene su primer cierre hacia atrás; bajo la gráfica queda una sola línea («Gráfica desde…») y el detalle por cuenta, bien y deuda va en la «i». Solo web, encima de la 4.26.122; la APK sigue en la 55. Incidente: la 121 se publicó sin probar con deudas heredadas y el dueño vio «Faltan saldos fiables» en vez de la gráfica.

Integración4.26.122 (13/10/2026), preparada y no publicada por separado (va dentro de la 123): todo cargo del banco sale en Gastos. El adeudo que paga un recibo o un puntual del Plan ya no se descarta al sincronizar: entra en Gastos atenuado y rotulado «Recibo: nombre» (o «¿Recibo: nombre?» si solo se parece), sin contar otra vez en lo gastado ni en los saldos. Desde su ficha, «No es este recibo» lo devuelve a gasto normal, y confirmar el pago con ese mismo cargo lo deshace. El filtro por defecto de Gastos no cambia: sigue enseñando los bancos de gasto diario. Web más `_shared/presupuesto.ts`, que usa la función `ingest`: `ingest` se despliega ANTES que la web, nunca después. Encima de las integraciones 4.26.120 y 4.26.121, que no se promocionan a producción sin esta entrega; la APK sigue en la 55. Cuatro tandas en revisión: `recibo-cargo-en-gastos`, nueva, la de la 121 y las dos de la 120 sin tocar. Despliegue de `ingest`, publicación en beta y aceptación móvil pendientes.

Integración4.26.121 (13/10/2026), preparada y no publicada por separado (va dentro de la 122): Inicio v4.2. El patrimonio (cuentas, inversiones, bienes y deudas) se reconstruye hacia atrás por flujos en vez de con fotos del total, se dibuja en una gráfica que se consulta con el dedo, una frase dice cuánto ha subido o bajado en el periodo elegido y la tarjeta del mes dice cuánto queda y cuánto se puede gastar al día. Donde falta un dato la gráfica se recorta y dice desde cuándo hay datos; la racha se retira. Solo web, encima de la integración 4.26.120; la APK sigue en la 55. Su tanda `inicio-patrimonio-flujos` sigue en el panel de la 122.

Integración4.26.120 (13/10/2026), preparada y no publicada por separado (va dentro de la 122): los apuntes iguales de un banco que no da identificador (mismo día, importe y comercio; Trade Republic por Open Banking) entran todos en vez de fundirse en uno, contestar «es el mismo» empareja el aviso una sola vez e «Importar histórico» reconoce lo ya contestado. Web más `_shared/presupuesto.ts`, que usa la función `ingest`: `ingest` se despliega ANTES que la web, nunca después. La APK sigue en la 55. Dos tandas en revisión: `tr-iguales-ordinal`, nueva, y `bancos-acuse-reconexion`, que vuelve con el guion corregido tras su rechazo en la 119 (el paso 2 prometía «ningún repetido» y las preguntas pendientes de Trade Republic no venían de esa tanda). Despliegue de `ingest` pendiente.

Beta4.26.119 (12/10/2026), publicada y rechazada en el panel por la redacción de un paso: los bancos no pierden movimientos si la respuesta de una sincronización no llega al móvil, y reconectar un banco con las mismas cuentas no deja días sin leer. El cursor del servidor solo avanza cuando el móvil acusa haber guardado lo recibido (acuse local al dispositivo), el suelo de lectura baja tres días para cubrir la fecha valor y `bank-callback` conserva el cursor al reconectar. Web más dos funciones Edge (`bank-sync` y `bank-callback`); la APK sigue en la 55. Su tanda `bancos-acuse-reconexion` pasa a la nota 120 con el guion corregido; `recibos-cargo-unico` (118) fue aprobada el 12/10 y salió del panel.

Beta4.26.118 (12/10/2026), publicada y APROBADA en el móvil el 12/10 (5 ok / 0 fallos): cada cargo del banco se atribuye a un único recibo. Un mismo cargo ya no marca pagados dos recibos, un homónimo de otro banco no paga el que no es, un recibo se reconoce pagado también cuando el pago salió de otro banco (nombre completo e importe exacto) y mover el día de un recibo ya cobrado por el banco no lo vuelve a descontar. Solo web, sobre la producción117; la APK sigue en la 55. Su tanda `recibos-cargo-unico` está aprobada y retirada del panel; promoción a producción pendiente.

Promoción completa4.26.117: entrada renovada, recuperación de movimientos bancarios, widget que se actualiza al pagar con la app cerrada tras actualizar la app e Inicio sin el desglose de Gastos superpuesto. La reconciliación conserva los30 commits propios de main y el código aprobado de beta117. Una nota familiar más el historial de producción; las notas intermedias de beta quedan en Git y sus contratos, en los guardianes. Los cortes fechados de abajo son historia, no instrucciones vigentes. [Acta](docs/briefs/prod-completa-117.md).

Selección web4.26.110: la rayita de la barra desaparece al ocultarla; Plan → Metas → Reservar dinero permite editar reglas conservando sus aportaciones; Perfil/Ajustes y Recibos → Gestionar conservan la pantalla al volver. Incluye únicamente las identidades aprobadas107/108/110 de beta; la gráfica109 rechazada conserva la implementación anterior. Historial, idiomas y APK52 conservados. [Alcance y cualificación local](docs/briefs/promocion-107-108-110-local26.md).

Snapshot8/10 previo a la entrega106: candidata selectiva4.26.106 desde main56c7e328 para las aprobadas99/100/101/102/106. Producción comprobada4.26.98, beta4.26.106.1/source8dcc5ed3. Revisión independiente, CI exacta y entrega pendientes. Panel beta solo se retira después de entrega real; lag global abierto. [Acta](docs/briefs/promocion-aprobadas-local26.md).

Promoción selectiva98 preparada7/10: el dueño aprobó ocultar juntos barra y botón en beta4.26.98.1/sourceb7ab. Base main85b8, sólo CSS aprobada, scope y guardianes correspondientes. Producción96 ya servida; candidata98 local pendiente de revisión independiente, CI exacta y entrega. No99/100/APK/Edge/SQL; INC-2709-09 continúa abierto. [Acta](docs/briefs/promocion-fab98-2026-10-07.md).

Promoción selectiva6/10: candidata4.26.96 local para mostrar hasta tres metas activas en Inicio, aprobada directamente por el dueño para la fuente ca6f5e85. Base main537edc1; únicamente el límite visual aprobado, conservando todas las metas en Plan y el resto de main. Revisión independiente, CI y entrega servida pendientes; INC-2709-09 sigue abierto. [Acta](docs/briefs/promocion-inicio96-2026-10-06.md).

Apuntar y Gastos permiten distinguir Multas, Zona azul y Peajes. Solo los pagos nuevos con detalle inequívoco los sugieren; elegir una categoría conserva el importe y la fecha.

Promoción4/10: las once tandas de beta4.26.94.1 tienen aprobación vigente. Producción4.26.94/source8bb0398f servida y cotejada; APK52 estable y las tres funciones Edge entregadas. La limpieza conserva notas y decisiones; solo retira las once entregadas, sin producto nuevo. Prioridad permanente: producción de lo aprobado antes de otra implementación. [Acta](docs/briefs/promocion-aprobadas-2026-10-04.md).
Promoción selectiva5/10: candidata4.26.95 para volver con mucho historial, autorizada directamente por el dueño. Base main8bb0398; solo caché de fechas aprobada en PR133, sin beta completa. Revisión independiente, CI y entrega servida pendientes. INC-2709-09 global sigue abierto. [Acta](docs/briefs/promocion-cache95-2026-10-05.md).

La base80/source955765a9 incluye Retirada y Nómina junto con Widget y las tres correcciones de pantalla.78/79 son snapshots de integración, no versiones publicadas por separado. Snapshot anterior de integración: la promoción actual conserva sus cambios y cuenta con los once OK de beta94.1. [Actas](docs/briefs/ops-0110-validaciones-persistentes.md).

# Aely

La4.26.117 reúne la beta aprobada en una entrega de producción. Android4.26.117/code55 incorpora la parte nativa del widget; la web conserva compatibilidad con la APK52. Bienes y la gráfica ya pertenecen al historial de producción111.

MAIN4.26.110 incorpora PR196 (bdd75636), sólo pruebas, herramientas y documentación. Tests38005461796 y DeployPages38005461732 terminaron SUCCESS y sus artefactos se comprobaron; ese cierre no publica Inicio112 ni acredita APK nuevo o aceptación móvil. Las aprobadas99/100/101/102/106 ya entregadas conservan su cierre;109 sigue rechazada.

Cartera → Bienes incluye alta con la lista vacía y una ficha de edición con Guardar/Cancelar y borrado confirmado. [Bienes](docs/briefs/bienes-completo-20261010.md) · [Inicio](docs/briefs/inicio-grafica-vuelve-20261010.md).

Inicio resume hasta tres metas activas; Ver plan permite consultar todas con sus importes intactos.

Gasolina/Taxi: Apuntar → todas las categorías permite elegirlas por separado; Gastos comparte esos IDs en filtros y límites. Los apuntes antiguos y el límite de Transporte se conservan. [Acta histórica de preparación](docs/briefs/feature-0210-01-gasolina-taxi.md).



En Ajustes → Revisar la beta, una comprobación aprobada conserva su resultado tras actualizar y reabrir. Cada tanda guarda sus marcas y comentarios por separado; las correcciones nuevas tienen su prueba y las funciones estrenadas salen de la cola aunque cambie una dependencia compartida. La aprobación y la entrega se muestran por separado.

OPS-02: Ajustes → Copia de seguridad → Copias automáticas → Ver copia permite comparar sin sustituir la cartera.
Inicio muestra el gasto bruto en el mes natural; con presupuesto por ciclo y nómina reconocida muestra el gasto neto tras los ingresos recibidos y el margen que queda. Plan deja de prever un ingreso que el banco ya identifica claramente.
En Ajustes → Dinero, «Presupuesto por ciclo de cobro» permite reiniciar el presupuesto con la nómina registrada; Gastos abre en «Mi ciclo». Su explicación se puede plegar y recuperar con Ayuda sin ocultar la fecha del cobro. Con la app Android nueva, el widget sigue la ventana de Inicio; la app anterior conserva el mes natural.
Con poca conexión, Inicio muestra los datos guardados cuando termina el logo, sin otra espera de barras grises.

PWA de finanzas personales: patrimonio neto, gastos variables, costes fijos, inversiones (multi-bróker) y deudas. Móvil-first, instalable, con sincronización automática de gastos vía notificaciones del banco.

En Plan → Deudas, un saldo estimado a cero pide confirmar la liquidación. Después puedes archivar la deuda y volver a mostrarla desde Deudas archivadas; sus cuotas siguen en Gastos.

> Proyecto personal de [Juanjo]. Hecho por ilusión y aprendizaje.

---

## 🏗️ Stack

- **Frontend:** React 18 (inlineado, **sin paso de build en navegador**, usando `React.createElement` directo — NO JSX, NO Babel)
- **Persistencia local:** `localStorage` con sistema de migraciones versionado (`_dataVer`)
- **PWA:** Service Worker *stale-while-revalidate* + manifest; botón «Nueva versión» cuando hay update esperando
- **App Android:** Capacitor + bundle local + OTA (`version.json` / `bundle.zip`) + lector nativo de notificaciones TR
- **Backend de datos:** Supabase (Postgres + Auth + Edge Functions). Login email+contraseña + desbloqueo biométrico
- **Captura automática:** lector nativo en la app Android (sustituye MacroDroid) → POST a Edge Function `ingest` con token por usuario
- **Cotizaciones:** Finnhub (vía Edge Function `prices` para ocultar la key y evitar CORS)
- **Hosting:** GitHub Pages
- **CI/CD:** GitHub Actions (tests + sellado SW + deploy en cada push a `main`)

## 📂 Estructura del repo

```
mi-cartera/
├── scripts/beta-source-code.mjs # Guardia de funciones/datos transitivos y delimitación por sintaxis, sin dependencias
├── scripts/beta-sources.json # Alcances explícitos de revisión; beta-revisions.mjs genera digests/recibo
├── scripts/beta-archives.json # Pins nominativos para referencias históricas de sólo lectura
├── tests/pure-logic-notes.test.mjs · beta-source-parse.test.mjs # Carga diferida y cortes exactos sin debilitar auditorías
├── tests/beta-veredictos.test.mjs # Contrato compartido del panel y listo; beta-sources protege el ensamblado
├── tests/listo-actor.test.mjs # CLI real sin red: actor Dev autorizado y fallo cerrado si no se acredita
├── tests/backclose-history.test.mjs # Propiedad del historial y transferencias de overlays (selección110)
├── tests/arranque-nube-commit.test.mjs # Barrera de arranque, sesión y memo con callbacks reales y transporte sintético
├── e2e/backclose-handover.spec.mjs · botnav-indicador.spec.mjs · metas-editar-regla.spec.mjs # Pantallas reales de110/107/108
├── tests/sync-memoria.test.mjs # Exportación sintética: cantidades, aviso Cloud e idempotencia; rechazo sin escrituras/borrados
├── tests/prod117-edge-compat.test.mjs # Fuentes desplegadas ingest50/prices13 y cliente actual, sin red
├── tests/categorize-handler.test.mjs # Handler y helpers actuales, movilidad/SQLSTATE con SDK/DB/LLM simulados; sin red
├── src/                    # 👈 Fuente editable (v3.108+)
│   ├── shell.html          #     HTML shell (React, CSS, vendors)
│   ├── build-order.json    #     Orden de ensamblado de módulos
│   └── modules/            #     17 ficheros JS (core, i18n, motor, app, boot, v4, ayuda…)
├── public/                 # Artefacto desplegable (generado + estáticos)
│   ├── index.html          #     Generado por `npm run build` — no editar a mano
│   ├── manifest.json · sw.js · vendor/ · fonts/
│   └── privacy.html
├── e2e/                    # Playwright: pantallas, persistencia, copias, reglas mensuales y ayuda de Mi ciclo
│   ├── rendimiento-arranque-nube.spec.mjs # A/B CPU×6 sintético de nube pendiente, offline y lenta; ejecución pendiente
│   ├── helpers/arranque-nube-instrument.mjs # Ventana RAF tras retirada real del splash y baseline Git original
│   ├── inicio-v42.spec.mjs # Inicio v4.2 en pantalla real: gráfica, consulta con el dedo, cobertura y tarjeta del mes
│   ├── recibo-cargo-en-gastos.spec.mjs # El cargo de un recibo en Gastos, Inicio, Plan e «Importar histórico»; «No es este recibo» y su vuelta atrás, es/en/ca
│   └── backclose-handover.spec.mjs # Dieciocho casos de historial/overlays; retorno cleanUrls2PASS/base1092RED
├── tests/recibo-invariante.test.mjs # Mismos extractos por el código de antes (dea5d883) y el de ahora: gastado, saldos y cierre iguales al céntimo
├── tests/recibo-domiciliado-sin-acreditar.test.mjs # Etiqueta, vetos entre móviles, recibo borrado, ordinal y escritura de la marca en la nube
├── tests/inicio-v42.test.mjs # Serie de patrimonio por flujos con los callbacks reales de Guardar y del pull, UTC y Madrid
├── tests/backclose-history.test.mjs # Controlador y hook reales con cola de eventos History sintética
├── tests/widget-notificacion-render.test.mjs # Java real sobre preferencias APK52: notificación, registro, relectura y pintado
├── tests/widget-inicio-paridad.test.mjs # 1584 casos contra los lectores reales de Inicio: alcance, céntimos y presupuesto
├── tests/widget-puente-ciclo.test.mjs # JSON real del puente → plugin → widget con el Java de las APK 52, 53 y 54 a la vez
├── tests/                  # Unitarios en Node (lógica, parsers, i18n, seguridad, frescura de doc,
│                           #  sintaxis de las Edge Functions, despliegue manual de Supabase y presupuesto de rendimiento)
├── supabase/               # Postgres, Auth, Edge Functions
│   └── functions/ingest/widget.ts · widget.test.ts # Contrato widget v2 separado del mes legado y guardián Deno
├── scripts/
│   ├── build-app.mjs       # Ensambla src/ → public/index.html
│   ├── run-tests.mjs       # build + unit + Deno + E2E; tiempos por etapa en test-results/
│   └── stamp-version.mjs
├── docs/                   # BACKLOG, ARQUITECTURA, TESTING, SENTRY, ROADMAP…
├── playwright.config.mjs
├── VERSION
└── CHANGELOG.md
```

## 🚀 Desarrollo

El exportador de memoria tacha importes reconocibles, incluidos valores entre backticks y rangos directos con en-dash. Si quedan cifras decimales ASCII o Unicode en un párrafo financiero que no puede sanear con seguridad, rechaza toda la exportación antes de escribir o borrar; conserva cantidades con unidades técnicas explícitas y versiones/SHA rotulados. El contexto de un párrafo incluye sus líneas de continuación y marcado, y se analiza en el cuerpo, sin confundirlo con el nombre del archivo. Una vista exclusiva del detector normaliza espacios Unicode, hardbreaks y delimitadores Markdown, incluido strike GFM dentro de palabras. Por prudencia, la palabra «capital» aislada también activa el contexto financiero, aunque su uso pueda ser ambiguo; no hace falta interpretar enlaces para reconstruir etiquetas compuestas. El Markdown original y las cifras de las URL permanecen en el cuerpo y en su validación. Cada archivo regenerado lleva un aviso visible de memoria histórica y prevalencia del protocolo Cloud vigente. Son filtros conservadores de patrones, sin parsing Markdown ni anonimización universales: posibles rechazos de usos no financieros de «capital» y demás límites requieren revisión manual. Para verificarlo sin leer memoria personal: `node tests/sync-memoria.test.mjs` usa exclusivamente fixtures temporales inventados.

1. Edita **`src/modules/*.js`** o **`src/shell.html`**
2. Ensambla y prueba:

```bash
npm ci
npx playwright install chromium   # una vez
npm run build                     # src → public/index.html
npm test                          # build + unit + Deno + E2E
npm run test:e2e                  # solo Playwright
```

**Sentry en prod:** secret `SENTRY_DSN` en GitHub Actions (inyectado al deploy) — [docs/SENTRY.md](docs/SENTRY.md).  
**Categorías IA (opcional):** Edge `categorize` + `OPENAI_API_KEY` en Supabase — [docs/CATEGORIZE.md](docs/CATEGORIZE.md). Sin key, la app ya usa un diccionario amplio de keywords (incluye impuestos/multas).
**Pregúntame:** guía local y offline para presupuesto, recibos, cuentas y uso de la app. La interpretación con OpenAI es opcional, requiere consentimiento y permanece apagada hasta configurar el backend — [brief y límites](docs/briefs/asistente-hibrido-2026-09-16.md).

```bash
# (opcional, local) sellar versión del SW manualmente
node scripts/stamp-version.mjs
```

## 📦 Despliegue

Push a `main` → GitHub Actions sella la versión del SW y publica `public/` en GitHub Pages. Sin pasos manuales, sin tocar Netlify.

## 🔐 Secretos

- La **API key de Finnhub NO está en el repo**. Vive como secreto del proyecto Supabase (Edge Functions → Secrets), junto con `INGEST_TOKEN`, `INGEST_USER_ID` y **`TOKEN_ENCRYPTION_KEY`** (32 bytes en base64 — cifra tokens MyInvestor/Open Banking en reposo).
- En `public/index.html` solo va la **anon key** de Supabase, que es pública por diseño (los datos están protegidos con Row Level Security). La función `ingest` se protege con token por usuario (`ingest_tokens`) o el legacy `INGEST_TOKEN`.
- Setup completo del backend en [docs/SETUP-SUPABASE.md](docs/SETUP-SUPABASE.md).
- Rotación del token legacy: [docs/SETUP-INGEST-TOKEN.md](docs/SETUP-INGEST-TOKEN.md).
- App Android: [docs/SETUP-ANDROID.md](docs/SETUP-ANDROID.md).
- Política de privacidad: [public/privacy.html](public/privacy.html).

## 🗺️ Roadmap

Estado actual: **v4.26.124** — candidata de beta: en Plan, bajar despacio desde arriba del todo ya no hace saltar el contenido (el scroll es solo del navegador; el cambio de sección tirando hacia abajo sigue igual). Solo web, encima de la beta 4.26.123; la APK sigue en la 4.26.117/code55. Tandas `plan-scroll-lento` (nueva) e `inicio-patrimonio-flujos` en revisión; `recibo-cargo-en-gastos`, `tr-iguales-ordinal` y `bancos-acuse-reconexion`, aprobadas sobre la 4.26.122.1, salen del panel.

Corte anterior (13/10): **v4.26.123**, beta publicada — la gráfica de Inicio aparece desde el primer día, también con hipoteca o préstamos dados de alta de antes (una deuda sin fecha explícita se reconstruye hacia atrás con su cuadro de cuotas, una cuenta manual mantiene su primer cierre), con una sola línea bajo la gráfica y el detalle en la «i». Solo web, encima de la 4.26.122; la APK sigue en la 4.26.117/code55. Tandas `inicio-patrimonio-flujos` (vuelta a presentar), `recibo-cargo-en-gastos`, `tr-iguales-ordinal` y `bancos-acuse-reconexion` en revisión.

Corte anterior (13/10): **v4.26.122**, integración preparada y no publicada por separado — el cargo del banco que paga un recibo o un puntual del Plan sale en Gastos, atenuado y con el nombre del recibo, sin contar dos veces; «No es este recibo» desde su ficha lo devuelve a gasto normal y se puede deshacer. Web más `_shared/presupuesto.ts` (`ingest`, que hay que desplegar antes que la web), encima de las integraciones 4.26.120 y 4.26.121; la APK sigue en la 4.26.117/code55. Tandas `recibo-cargo-en-gastos`, `inicio-patrimonio-flujos`, `tr-iguales-ordinal` y `bancos-acuse-reconexion` en revisión. La 120 y la 121 no se promocionan a producción sin esta entrega. Despliegue de `ingest`, publicación en beta y aceptación móvil pendientes.

Corte anterior (13/10): **v4.26.121**, integración preparada y no publicada por separado — Inicio v4.2, con el patrimonio reconstruido por flujos, gráfica consultable con el dedo, variación del periodo elegido y la tarjeta del mes con lo que queda y el importe al día. Solo web. Su tanda sigue en el panel de la 122.

Corte anterior (13/10): **v4.26.120**, integración preparada y no publicada por separado — los apuntes iguales de un banco sin identificador entran todos (ordinal), un aviso empareja una sola vez y el histórico reconoce lo ya contestado. Web más `_shared/presupuesto.ts` (`ingest`, que hay que desplegar antes que la web). Sus dos tandas siguen en el panel de la 122.

Corte anterior (12/10): **v4.26.119**, beta publicada y rechazada en el panel por la redacción del paso 2 de su tanda — el cursor de bancos solo avanza con acuse del móvil, el suelo de lectura cubre la fecha valor y reconectar con las mismas cuentas conserva el cursor. Web más `bank-sync` y `bank-callback`; su tanda vuelve en la 120.

Corte anterior (12/10): **v4.26.118**, beta publicada y aprobada en el móvil (12/10), solo web — cada cargo del banco se atribuye a un único recibo (sin dobles pagados, sin homónimos de otro banco, con el pago reconocido aunque salga de otro banco y sin volver a descontar un recibo ya cobrado al cambiarle el día).

Corte anterior (12/10): **v4.26.117**, producción — entrada renovada, recuperación bancaria, widget que se actualiza al pagar con la app cerrada tras actualizar la app instalada e Inicio sin solape de Gastos. Android4.26.117/code55; web compatible con la APK52.

Antes (11/10): **v4.26.116**, bancos sin huecos y widget arreglado (APK 54).

Antes (11/10): **v4.26.115**, el widget se actualiza al pagar con la app cerrada (APK 53); rechazada en el móvil. Antes (11/10): **v4.26.114**, Inicio sin el desglose de Gastos solapado con temática activa. Antes (10/10): **v4.26.113**, Bienes con alta, edición y borrado e Inicio con la gráfica recuperada sin «Ahora».

Corte anterior (4/10, 12:30 UTC, panel de revisión): **v4.26.93** publicada en beta. Primera entrega4.26.93.1 (fuente1d5dd782), CI37200314653SUCCESS y HTTP/ZIP/HTML/SW/catálogo/huella cotejados el4/10 a12:30UTC:11 tandas/24 puntos, frente a40 antes del cambio. Producción4.26.86 (d366215a), APK beta4.26.80/code52 y estable4.26.32/code48 conservadas. Prueba y aprobación móvil pendientes. [Acta](docs/briefs/ops-0410-panel-cola.md).

Corte anterior (4/10, 02:35 UTC): v4.26.90 servida en el canal beta como 4.26.90.2. Gastos oculta el límite de otros periodos y aprovecha todo el ancho; incluye Brókers89, entregada antes como 4.26.89.1. Cada cosa con su prueba, sin mezclarlas: **fuente** `beta` en `7f3da23b`, merge de [PR117](https://github.com/JuanjoAvila/Aely/pull/117), que solo añade una guardia de tests: lo que se usa no cambia respecto a 4.26.90.1; **canal beta servido** 4.26.90.2 desde ese mismo `7f3da23b`, publicación [37168006229](https://github.com/JuanjoAvila/Aely/actions/runs/37168006229) sin reintentos y manifiesto, ZIP, HTML, SW, notas y recibos cotejados con la fuente (Gastos se entregó primero como 4.26.90.1 desde el merge `4a2e3c54` de [PR116](https://github.com/JuanjoAvila/Aely/pull/116), publicación [37158585994](https://github.com/JuanjoAvila/Aely/actions/runs/37158585994)); **producción** sigue en 4.26.86 (`d366215a`), sin promoción; **APK** beta 4.26.80/code52 y estable 4.26.32/code48, sin binario nuevo ni prueba en dispositivo; **aceptación en el móvil** de 89 y 90: ninguna todavía; **Edge/SQL**: sin entregas nuevas. Una CI verde no es una aprobación. [Gastos](docs/briefs/inc-0310-gastos-sin-limite.md) · [Brókers](docs/briefs/inc-0310-broker-resultados.md).

Corte anterior (3/10, superado por la entrega de arriba): v4.26.90 era candidata local, con Brókers89 pendiente de CI/publicación y beta88.1 y producción86 como últimas entregas acreditadas.

Estado anterior de Categoría: **v4.26.86** candidata: la categoría elegida a mano no se deshace al sincronizar ([acta](docs/briefs/inc-0210-02-categoria-elegida.md)); integrada sobre la beta 85 (`cdfb2f2c`), sin publicar.

Estado anterior de la integración 85: **v4.26.85**, conjunta de cuota contabilizada, Gastos por periodo y Gasolina/Taxi, sobre3467bbd4. Sin publicar; revisión de integración y CI exactas pendientes, aceptación móvil pendiente. APK80/code52 conservada. [Plan](docs/briefs/inc-0210-01-plan-cuota.md) · [Gastos](docs/briefs/inc-0210-03-gastos-periodo.md).

Estado anterior de Validaciones: **v4.26.82** candidata de persistencia de comprobaciones sobre beta80/source955765a9. APK80/code52 conservada. Revisión independiente, CI exacta, publicación y prueba móvil pendientes. [Acta](docs/briefs/ops-0110-validaciones-persistentes.md).

Estado anterior de Retirada: **v4.26.79**, candidata de Retirada sobre Nómina78 eaf55e4a para la entrega conjunta beta80; pendiente de CI exacta y publicación ([acta](docs/briefs/inc-2909-03-retirada-caixa.md)). Anterior **v4.26.78**, candidata de Nómina sobre UI77 finalca7734fd; pendiente de CI exacta y publicación ([acta](docs/briefs/inc-3009-nomina-anticipada.md)). Anterior **v4.26.77**, candidata con tres tandas de pantalla (Cyberpunk, Preguntar, Perfil) sobre el panel76; sin publicar ni probar en móvil ([acta](docs/briefs/ui-77-integracion.md)). Del panel76, corrección local: revisión y entrega separadas por tanda; una entrega exacta la retira aunque producción tenga un número menor. Beta publicada **4.26.75.1**/ca7b97d4, producción **4.26.67**; APK48 estable/APK51 beta. CI exacta, publicación76 y prueba móvil pendientes. [Auditoría y evidencia](docs/briefs/ops-0110-panel-entrega.md).

Inicio73 quedó publicado y cotejado el30/9 a20:55UTC con CI completa SUCCESS; su prueba móvil sigue pendiente. [Acta conservada](docs/briefs/inc-2909-02-inicio-natural.md).

Corte anterior verificado (27/9): **v4.26.56** OPS-02 aprobado y publicado exclusivamente en producción; merge `426131959a75e5af8923009646caf20fd5b8e430`, idéntico a la candidata revisada `e91debd8`. Promote [36343752892](https://github.com/JuanjoAvila/Aely/actions/runs/36343752892), Pages [36344438830](https://github.com/JuanjoAvila/Aely/actions/runs/36344438830); HTTP/ZIP/HTML/SW cotejados el 27/9 a las 19:41 UTC. Beta 4.26.56.1 conservaba FIN-05, selector y TR pendientes; APK estable 4.26.32/code 48 intacta. [Evidencia](docs/briefs/ops02-restauracion-probada.md).

Trabajo pendiente, prioridades y criterios de cierre para el equipo: [docs/BACKLOG.md](docs/BACKLOG.md).
Incluye el cruce con las listas antiguas para no repetir tareas ya hechas ni dar por cerrada toda la ronda.

En Ajustes → Revisar esta beta, toca la cabecera de una tanda para encogerla o desplegarla. Las aprobadas se encogen automáticamente y conservan su veredicto al actualizar si el guion sigue igual.

> Esta línea la vigila `tests/docs-frescura.test.mjs`: si no coincide con `VERSION`, `npm test` falla. Se puso porque el README se quedó siete versiones atrás (v4.1.0 con la app en la 4.8.0) sin que saltara nada.

Notas rápidas del rediseño v4 (para no perderse):

- **Inicio (v4.2, candidata 4.26.123):** arriba, el patrimonio de hoy (el mismo total de Cartera) con su gráfica hacia atrás; mantener o arrastrar el dedo sobre ella enseña la fecha y la cifra de ese día, los botones 1M/6M/1A/Todo cambian el periodo. Bajo los periodos, una sola línea dice desde qué día se dibuja; la «i» junto a «Patrimonio neto» lleva el detalle por cuenta, bien y deuda (desde cuándo hay datos y qué valores se mantienen o se estiman con su cuadro de cuotas); si el total es desconocido sale «—». Debajo, la tarjeta «Este mes» / «Este ciclo» con lo que queda y el importe al día; tocarla abre el presupuesto. La racha ya no está. La explicación rechazada109 sigue retirada; su registro histórico se conserva.
- **Cargo de un recibo en Gastos (candidata 4.26.122):** el adeudo del banco que paga un recibo o un puntual del Plan sale en Gastos atenuado, con «Recibo: nombre» o «¿Recibo: nombre?», y no suma a lo gastado. Si el banco de los recibos no es de gasto diario, se ve con el filtro (🎛️) → «Todos los bancos». En la ficha del movimiento, «No es este recibo» lo devuelve a gasto normal; «Paga un recibo» → el mismo recibo → «Confirmar pago completo» lo deshace. También sale marcado en los últimos movimientos de Inicio y en «Importar histórico».
- **Rol de cuenta** (Recibos / Gasto diario / Todo): Cartera → Editar.
- **Hogar y gastos compartidos:** toca tu avatar en Inicio → Perfil → **«Tu gente»** (movido ahí en 4.10.0; antes al final de Cartera, donde no lo veía nadie) — [docs/HOGAR.md](docs/HOGAR.md).
- **Bienes:** Cartera → Bienes → Añadir bien, incluso con la lista vacía. Tocar una fila abre su ficha; Guardar confirma el borrador y Borrar bien pide confirmación.
- **Ordenar los bloques de Cartera:** Cartera → «⇅ Ordenar secciones» al pie (4.10.0).
- **Open Banking se sincroniza a demanda** (botón en Cartera), no al abrir la app.
- **Orden manual de movimientos:** en Gastos, arrastra el asa de una fila para colocarla dentro del mismo día; la fecha real no cambia.
- **Ficha de gasto v4.1 (en desarrollo):** Apuntar y Modificar comparten importe, concepto, banco/efectivo/fecha, categorías y teclado; los movimientos del banco mantienen bloqueados importe y cuenta.
- **Confirmar un cargo (integración beta):** Gastos → ficha → Paga un recibo muestra pendientes del mes, también si la factura o divisa varió. El diálogo enseña cargo real e importe/banco previstos: confirma solo el pago completo o cancela si es parcial. Puedes deshacer. Ya pagado muestra el banco real y separa Cargo y Previsto si difieren; la parte propia de un compartido conserva su previsión. No cambian clasificación ni saldo del cargo.
- **Tus recibos v4.1:** Plan → Recibos → Gestionar —o Ajustes → Dinero— abre una pantalla propia con buscador, grupos, iconos por tipo, fichas y alta por pasos; el gesto Atrás acompaña también cada paso del alta, la ficha confirma antes de cerrar y las altas muestran tipo y nombre al guardar. La comparación con el banco vive en Ajustes → Mis bancos.
- **Updates:** transporte en `12-boot.js`, estado de UI en `useUpdates()` (`10-app-components.js`).
- **Editar regla de Metas (candidata local, sin publicar):** Plan → Metas → Reservar dinero → Editar regla conserva la identidad y las aportaciones anteriores. Una mensual ya asentada usa los cambios el mes siguiente; las anteriores siguen por ingreso. [Contrato y pruebas](docs/briefs/inc-0810-metas-editar-regla.md).
- **Canal beta y banco de pruebas** (solo `is_admin`): Ajustes → Dev → Pruebas; cada tanda distingue revisión y entrega, incluso plegada — [docs/TESTING.md](docs/TESTING.md).

El guardián tests/logs-privacidad.test.mjs verifica las fronteras de diagnóstico con marcadores sintéticos. Cobertura y límites, incluyendo servidor sin desplegar, en [SEC-03](docs/briefs/sec03-privacidad-logs.md).

Plan → Metas: borrar una regla de nómina pide confirmación y libera su reserva del presupuesto, conservando las aportaciones e historial. Unidad INC-0310-01 ya entregada; pruebas DOM en `e2e/metas-borrar-regla.spec.mjs`, mapeadas a Metas, Gastos, Inicio y motor. [Contrato y estado](docs/briefs/inc-0310-01-meta-regla.md).

Gastos → Mes pasado, Rango, Últimos3meses yTodo muestran su resumen sin columna de presupuesto ajeno. Este mes y Mi ciclo conservan límite, restante y progreso; candidata local pendiente de DOM/revisión/CI.

Diagnóstico de rendimiento Dashboard: guardianes de frecuencia de recientes, A/B virtual y control positivo separados, con fuente y límites en `docs/briefs/inc-0710-dashboard-react-profile.md`. La medición no declara resuelto el lag acumulativo.

Verificación específica de la promoción106: `node scripts/verify-selective106.mjs --candidate=SHA` ([acta y retirada diferida](docs/briefs/promocion-aprobadas-local26.md)).
