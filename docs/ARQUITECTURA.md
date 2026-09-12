# Arquitectura — Aely

Deshacer histórico (4.19.14): calcula sobre el estado actual del updater, conserva el lote con
`cloudPending` antes del DELETE y solo limpia ese lote tras confirmación. La ausencia de sesión
es un error recuperable, nunca un borrado exitoso. Un pull concurrente no puede resucitar los ids
que acaba de confirmar el DELETE; el resto del estado permanece intacto.

## Principios de diseño

### 1. Sin JSX/Babel en el navegador
La app usa `React.createElement` directo. Meter JSX + Babel en el navegador provocaba errores de `import jsx-runtime` y pantalla en blanco. `createElement` directo = robusto y sin sorpresas. **No reintroducir un transpilador en runtime.**

### 2. Un único artefacto desplegable
`public/index.html` lleva React, ReactDOM, CSS y lógica **inlineados**. Es el artefacto que ha demostrado ser fiable.

**Fuente editable (v3.108+):** el código vive en **`src/modules/*.js`** + **`src/shell.html`**. `scripts/build-app.mjs` los ensambla en un solo `public/index.html`. El CI ejecuta `build-app` antes de sellar versión y minificar. **No edites `public/index.html` a mano** salvo emergencia (y `apk.json`).

> ⚠️ **No crear un `index.html` en la raíz.** GitHub Actions solo despliega `public/`.

**Sin CDNs de terceros en el arranque:** supabase-js, Sentry y fuentes van auto-hospedados en `public/vendor/` y `public/fonts/`. Offline completo.

**Minificación en CI:** `scripts/minify-html.mjs` — **nunca** `minifyIdentifiers` (globales `t`, `cloud`, …).

**Rendimiento (v3.108 → 3.113):**
- Lazy mount de pestañas; **cold start solo monta la pestaña activa** (vecinas tras ~1,6 s idle) — evita el tirón al abrir Gastos tras vaciar apps en Android.
- `content-visibility` en `.page`; sync/FX diferidos con `requestIdleCallback`.
- En Gastos: `useDeferredValue` + trabajo pesado (suscripciones, chips banco) solo con pestaña activa.

**Observabilidad:** Sentry opcional vía `CONFIG.SENTRY_DSN` — ver [SENTRY.md](SENTRY.md). Secret en GitHub Actions **ya configurado**; el deploy inyecta el DSN.

**Tests:** unit (Node), Deno (Edge Functions), Playwright E2E — ver [TESTING.md](TESTING.md).

### 3. Service Worker stale-while-revalidate
Caché al instante + revalidación en segundo plano. Cadena de versión sellada en CI.

**Android OTA (v3.107+ / 4.0.9):** chequeo de `version.json` al abrir / volver a primer plano / cada ~30 min **con la app abierta**, y además un **WorkManager** (~15 min, con red) que avisa con noti local **con la app cerrada**. Al tocar la noti se abre la app y aplica el bundle. Sin FCM (no hace falta cuenta Google ni tokens). APK nativo alineado: `versionName`/`versionCode` en `android/app/build.gradle` + `public/apk.json` → release GitHub.

**Reparto del código de updates (v4.1.0):** dos capas, no mezclar.
- **`12-boot.js` = transporte.** Descargas OTA/APK, registro del SW, notis. Publica `window._mc*`
  y avisa con los eventos `mc-sw-update` / `mc-ota-ready` / `mc-apk-update`.
- **`useUpdates()` en `10-app-components.js` = estado de UI.** Un solo hook con los TRES
  canales (SW web esperando · bundle OTA listo/descargando · APK nueva) + acciones
  (`applyUpdate`, `installApk`). App lo consume en una línea (`const upd=useUpdates()`)
  y pinta las pills. Antes eran 3 efectos sueltos en App — el «spaghetti» del feedback
  2026-07-18. Si tocas updates: la lógica nueva va al hook, el transporte al boot.


**Cold start (3.113.3):** Sentry se inyecta tras el primer pintado (no bloquea ~340 KB); Ajustes se monta al abrir el cajón; el swipe pre-monta la pestaña destino durante el gesto. El coste duro restante es parse del monolito + `loadState` — sin code-split no desaparece del todo.

**Splash de entrada (v4.10.0).** `#mc-load` vive en `src/shell.html`, fuera de React (es lo único que
se ve mientras arranca el bundle). Ya no se retira en cuanto React pinta: espera a
**`window.__mcBootReady`**, que pone `mcBootReady()` (`00-core.js`, idempotente) desde cuatro sitios
—sin nube, sin sesión, con el candado o en el alta, y al terminar el primer `syncFromCloud`—.
Motivo: el estado local se pinta al instante y la nube tarda, así que se veía el patrimonio VIEJO y
un segundo después el bueno (vídeo del usuario: 125.899 € → 189.371 €). Topes en el vigilante:
1,8 s de espera y, si React ni siquiera ha pintado a los 8 s, un botón de reintentar — antes el
`clearInterval` de emergencia dejaba el splash puesto para siempre y sin salida.

**Presupuesto de tamaño (v4.10.0):** `tests/presupuesto-rendimiento.test.mjs` mide el artefacto
minificado y su gzip contra topes escritos a mano. Es la otra mitad del rendimiento: `e2e/rendimiento`
vigila que el trabajo no crezca con el histórico; esto vigila lo que hay que bajar y parsear.

### 4. Migraciones de datos versionadas
`_dataVer` en `localStorage` permite cambiar la forma de los datos sembrados sin borrar los del usuario.

## Flujo de datos

El widget recibe `monthBudgetStats` desde la app al cambiar sus cifras y al volver a primer plano,
tanto por `visibilitychange` como por `App.appStateChange` de Capacitor. Son señales distintas en
Android; escuchar solo la primera podía dejar el último total escrito por ingest aunque la app
ya mostrase otro. La reactivación solo reenvía el snapshot local, no sincroniza Open Banking.
Al convertir `expenses` con `expenseFromRow`, las categorías especiales `ingreso`, `inversion`
y `traspaso` se conservan aunque no pertenezcan al catálogo ordinario de categorías.

```
[Notificación TR en Android]
        │  Lector nativo Aely
        ▼
[POST → Edge Function `ingest`]   (?token= por usuario)
        │  clasifica + categoriza (KW)
        ▼
[Postgres: expenses]  → app al Sincronizar

[Notificación Caixa/Sabadell/…]
        │  bankNotif → runBankSync (sin parsear importe)
        ▼
[importObExpenses]  settings.expenseBanks → Gastos (ent en source ob:…)

[Sugerir categoría]
        │  cloud.suggestCategory(merchant)
        ▼
[Edge `categorize`]  KW → si otros y OPENAI_API_KEY → LLM acotado
```

Cotizaciones: Edge `prices` → Finnhub/Yahoo. FX: Frankfurter `EUR→USD,GBP,CHF` → `state.fxRates` (XXX→EUR) + `state.fx` (USD legado). Coste invertido editable ancla `costEur`. Moneda de visualización (`DISP`): EUR/USD/GBP/CHF desde 4.1.0; sin FX descargado se queda en € (nunca inventar tipo).

### Open Banking: sync SOLO a demanda (v4.1.0)

El auto-sync al abrir/volver a primer plano **se retiró**: una consulta PSD2 desatendida en
cada apertura hacía que Caixa/Sabadell marcaran el consentimiento como uso robótico y lo
caducaran «cada dos por tres» (feedback 2026-07-18). Syncs que siguen vivos, todos «con motivo»:

| Disparador | Dónde |
|---|---|
| Botón «↻ Sincronizar bancos» | Cartera, junto a «Tus cuentas» (visible con `hasBankLink`) |
| «Actualizar» de un banco | Ajustes → Mis bancos |
| Recién autorizado (`?bank=ok` / goto `bank\|ok`) | `11-app-main.js` |
| Bootstrap de conciliación (1ª vez sin `bankTx`) | `11-app-main.js` (solo una vez en la vida del enlace) |
| Noti del banco (evento real del usuario) | ajuste `st_banksync_notif`, se puede apagar |

El sincronizador general también consulta el puente nativo de Trade Republic cuando existe. Su
`availableCash` y la tarjeta específica de TR pasan por el mismo reanclaje (`applyTrCash`), para
que dos botones equivalentes no dejen saldos distintos. En enlaces Open Banking multicuenta, los
movimientos se leen desde cada `accounts[].transactions`; el bloque superior es solo la copia
retrocompatible de la primera cuenta y no se suma dos veces.

**No reintroducir** un sync por apertura/foreground sin repensar esto: el histórico está en el
CHANGELOG 4.1.0 y en el comentario del propio código.

**El `state` del OAuth (v4.10.0).** `bank-connect` genera un `state` (uuid, con sufijo `.app` si la
petición viene de la APK) y lo guarda en `bank_links` junto a `state_issued_at`. `bank-callback`
—que no tiene sesión— localiza al usuario por ese `state`, y es lo ÚNICO que ata la vuelta del banco
con una cuenta. Como viaja en la URL de vuelta (historial del navegador, Referer, logs por el
camino), ahora **caduca a los 30 minutos** y **se gasta**: se pone a `null` ANTES de canjear el
`code`, así que un fallo a mitad tampoco lo deja vivo.

### Seguridad de las Edge Functions (v4.10.0)

| Qué | Dónde | Nota |
|---|---|---|
| CORS con lista blanca | `_shared/cors.ts` → `withCors(handler)` | Envuelve el handler entero: pasan por ahí TODAS las respuestas, incluidas las de los `catch`. El origen sale de `APP_URL` + `https://localhost` (WebView APK) + localhost con puerto. |
| Límite de peticiones | `_shared/ratelimit.ts` + migración `0019` | En Postgres (una sentencia atómica), no en memoria: los isolates van y vienen. **Si falla, deja pasar.** |
| Token de ingest | cabecera `x-ingest-token`, comparación en tiempo constante | Desde 4.9.0; en query string aún se acepta por compatibilidad con APKs viejos. |

`tests/edge-sintaxis.test.mjs` hace cumplir la primera fila: falla si alguna función vuelve a
escribir `Access-Control-Allow-Origin: "*"`.

### Cartera v4: quién edita qué (v4.1.0)

- Cuenta **manual**: nombre + rol + saldo editables (Cartera → Editar).
- Cuenta **re-anclada por el banco** (tiene `bankIban`): solo nombre + rol; el saldo lo trae
  el banco (mostrarlo bloqueado, no dejar mentirse). Esta distinción es además la base de la
  posible capa freemium (ver ROADMAP).
- Cuenta **extra OB** (`obAccounts`): renombrar (`obLabels`) o promocionar con rol
  (`promoteObAccount`), igual que en v3.
- El rol (recibos/diario/todo) vive AQUÍ; en v4.0.x quedó inaccesible (solo existía en el
  Wealth v3 no montado) — no volver a dejar el rol sin puerta.

> **Apps Script / `GAS_URL`: archivado.** No reabrir.

## Aprendizajes clave

- Repo público → jamás secretos ni CSV reales.
- Fuente única: `src/modules/` + `npm run build`.
- Diálogos: `askText` / `askConfirm` (no `prompt` nativo).
- APK `apk.json`: URL = nombre exacto del asset.
- RLS Hogar: no hacer EXISTS sobre `household_members` desde su propia policy → `0014` + `is_household_member` SECURITY DEFINER.
- **Rediseños: auditar puertas de entrada.** La v4 dejó huérfanos el rol de cuenta, Hogar/Compartido, la huella y el logout — todo código vivo sin camino en la UI (se recuperaron en 4.1.0). Al quitar una pantalla, listar qué solo se alcanzaba desde ella.
- **Props que sombrean globales:** `Shared({uid})` tapaba el generador global `uid()` y crear un grupo petaba. Si un prop se llama como un global, renombrar al destructurar (`uid:userId`).
- **Carruseles horizontales dentro del track de tabs:** necesitan `stopPropagation` en touchstart/touchmove (metas de Inicio, chips de Gastos) o el gesto mueve las dos cosas a la vez.
- **PSD2 y syncs desatendidos:** consultar el banco en cada apertura ≈ bot → consentimiento caducado. Sincronizar solo con motivo (acción del usuario o evento real).
- **`navigator.share` en WebView** puede rechazar en silencio: siempre con fallback (descarga) + aviso.

---

## Estado de fases

| Fase | Contenido | Estado |
|------|-----------|--------|
| **0–4** | Control, Supabase, multi-usuario, RGPD, APK/OTA | **HECHO** |
| **5** Nice-to-have | Metas, gráficas, notis, FX multi, categorías IA opcional | **HECHO** en lo razonable |

### Multimoneda (v3.113)

- **Hecho:** tipos vivos USD/GBP/CHF→EUR; patrimonio/inversiones/OB vía `toEurAmt` / `invValueEur` / `invCostEur`; anclar `costEur` al editar coste.
- **No es (ni se persigue):** contabilidad de doble partida con FX histórico por cada compra antigua sin fecha, ni paridad al céntimo con Revolut (spread del bróker).

### Categorías IA (v3.113)

- KW locales + Edge `categorize` + toggle Ajustes. Ver [CATEGORIZE.md](CATEGORIZE.md).
- Sin `OPENAI_API_KEY`: solo KW (comportamiento seguro y barato).

---

## Backlog actual (post v4.1.0)

### Hecho reciente
- Lote feedback 2026-07-18 (v4.1.0): OB a demanda, Cartera editable completa (rol/bienes/inversiones), gráfico multiseleccionable, Hogar/huella/logout recuperados, monedas £/CHF, `useUpdates()`, nav flotante, Ajustes compacto+animado, sugerencias con pantalla propia, informe con fallback.
- v4.0.x: rediseño completo (SPEC-v4), MyInvestor login desde el móvil, OB sin falsos «caducado».

### Pendiente (a demanda)
- **MyInvestor captcha:** el plumbing está en 4.6.0 (`miDeviceLogin` acepta `captchaToken` → cabeceras `X-Recaptcha-Token`/`X-Recaptcha-Action`). Falta la WebView nativa que resuelve el reCAPTCHA de `myinvestor.es` y produce el token (site key + APK). Ver ROADMAP.
- **Logos de banco auto-hospedados** en las filas de cuentas (ver ROADMAP).
- **Freemium / suscripciones** (ver ROADMAP — solo diseño, nada implementado).
- Play Store (Data safety + NotificationListener).
- Feedback de uso real.
