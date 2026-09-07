# Mi Cartera 💸

PWA de finanzas personales: patrimonio neto, gastos variables, costes fijos, inversiones (multi-bróker) y deudas. Móvil-first, instalable, con sincronización automática de gastos vía notificaciones del banco.

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
├── src/                    # 👈 Fuente editable (v3.108+)
│   ├── shell.html          #     HTML shell (React, CSS, vendors)
│   ├── build-order.json    #     Orden de ensamblado de módulos
│   └── modules/            #     15 ficheros JS (core, i18n, motor, app, boot, v4…)
├── public/                 # Artefacto desplegable (generado + estáticos)
│   ├── index.html          #     Generado por `npm run build` — no editar a mano
│   ├── manifest.json · sw.js · vendor/ · fonts/
│   └── privacy.html
├── e2e/                    # Playwright (62 specs: arranque, listas, bancos, brókers, perfil, CSV, CSP, rendimiento, beta…)
├── tests/                  # Unitarios en Node (lógica, parsers, i18n, seguridad, frescura de doc,
│                           #  sintaxis de las Edge Functions y presupuesto de rendimiento)
├── supabase/               # Postgres, Auth, Edge Functions
├── scripts/
│   ├── build-app.mjs       # Ensambla src/ → public/index.html
│   ├── run-tests.mjs       # build + unit + Deno + E2E
│   └── stamp-version.mjs
├── docs/                   # ARQUITECTURA, TESTING, SENTRY, ROADMAP…
├── playwright.config.mjs
├── VERSION
└── CHANGELOG.md
```

## 🚀 Desarrollo

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

Estado actual: **v4.18.7** en el repo — disponibilidad del canal con `npm run salud`. Detalle en [docs/ROADMAP.md](docs/ROADMAP.md), [CHANGELOG.md](CHANGELOG.md) y [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

> Esta línea la vigila `tests/docs-frescura.test.mjs`: si no coincide con `VERSION`, `npm test` falla. Se puso porque el README se quedó siete versiones atrás (v4.1.0 con la app en la 4.8.0) sin que saltara nada.

Notas rápidas del rediseño v4 (para no perderse):
- **Rol de cuenta** (Recibos / Gasto diario / Todo): Cartera → Editar.
- **Hogar y gastos compartidos:** toca tu avatar en Inicio → Perfil → **«Tu gente»** (movido ahí en 4.10.0; antes al final de Cartera, donde no lo veía nadie) — [docs/HOGAR.md](docs/HOGAR.md).
- **Ordenar los bloques de Cartera:** Cartera → «⇅ Ordenar secciones» al pie (4.10.0).
- **Open Banking se sincroniza a demanda** (botón en Cartera), no al abrir la app.
- **Updates:** transporte en `12-boot.js`, estado de UI en `useUpdates()` (`10-app-components.js`).
- **Canal beta y banco de pruebas** (solo `is_admin`): Ajustes → Dev → Pruebas — [docs/TESTING.md](docs/TESTING.md).
