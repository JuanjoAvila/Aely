La base80/source955765a9 incluye Retirada y Nómina junto con Widget y las tres correcciones de pantalla.78/79 son snapshots de integración, no versiones publicadas por separado. Esta candidata81 conserva sus cambios; prueba móvil pendiente. [Actas](docs/briefs/ops-0110-validaciones-persistentes.md).

# Aely



En Ajustes → Revisar la beta, una comprobación aprobada conserva su resultado tras actualizar y reabrir. Cada tanda guarda sus marcas y comentarios por separado; un cambio real de código o guion requiere nueva revisión. La aprobación y la entrega se muestran por separado.

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
├── tests/beta-veredictos.test.mjs # Contrato compartido del panel y listo; beta-sources protege el ensamblado
├── tests/listo-actor.test.mjs # CLI real sin red: actor Dev autorizado y fallo cerrado si no se acredita
├── src/                    # 👈 Fuente editable (v3.108+)
│   ├── shell.html          #     HTML shell (React, CSS, vendors)
│   ├── build-order.json    #     Orden de ensamblado de módulos
│   └── modules/            #     17 ficheros JS (core, i18n, motor, app, boot, v4, ayuda…)
├── public/                 # Artefacto desplegable (generado + estáticos)
│   ├── index.html          #     Generado por `npm run build` — no editar a mano
│   ├── manifest.json · sw.js · vendor/ · fonts/
│   └── privacy.html
├── e2e/                    # Playwright (89 specs: pantallas, persistencia, copias y ayuda de Mi ciclo)
├── tests/                  # Unitarios en Node (lógica, parsers, i18n, seguridad, frescura de doc,
│                           #  sintaxis de las Edge Functions, despliegue manual de Supabase y presupuesto de rendimiento)
├── supabase/               # Postgres, Auth, Edge Functions
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

Estado actual: **v4.26.86** candidata: la categoría elegida a mano no se deshace al sincronizar ([acta](docs/briefs/inc-0210-02-categoria-elegida.md)); sobre Validaciones82, sin publicar.

Estado anterior de Validaciones: **v4.26.82** candidata de persistencia de comprobaciones sobre beta80/source955765a9. APK80/code52 conservada. Revisión independiente, CI exacta, publicación y prueba móvil pendientes. [Acta](docs/briefs/ops-0110-validaciones-persistentes.md).

Estado anterior de Retirada: **v4.26.79**, candidata de Retirada sobre Nómina78 eaf55e4a para la entrega conjunta beta80; pendiente de CI exacta y publicación ([acta](docs/briefs/inc-2909-03-retirada-caixa.md)). Anterior **v4.26.78**, candidata de Nómina sobre UI77 finalca7734fd; pendiente de CI exacta y publicación ([acta](docs/briefs/inc-3009-nomina-anticipada.md)). Anterior **v4.26.77**, candidata con tres tandas de pantalla (Cyberpunk, Preguntar, Perfil) sobre el panel76; sin publicar ni probar en móvil ([acta](docs/briefs/ui-77-integracion.md)). Del panel76, corrección local: revisión y entrega separadas por tanda; una entrega exacta la retira aunque producción tenga un número menor. Beta publicada **4.26.75.1**/ca7b97d4, producción **4.26.67**; APK48 estable/APK51 beta. CI exacta, publicación76 y prueba móvil pendientes. [Auditoría y evidencia](docs/briefs/ops-0110-panel-entrega.md).

Inicio73 quedó publicado y cotejado el30/9 a20:55UTC con CI completa SUCCESS; su prueba móvil sigue pendiente. [Acta conservada](docs/briefs/inc-2909-02-inicio-natural.md).

Corte anterior verificado (27/9): **v4.26.56** OPS-02 aprobado y publicado exclusivamente en producción; merge `426131959a75e5af8923009646caf20fd5b8e430`, idéntico a la candidata revisada `e91debd8`. Promote [36343752892](https://github.com/JuanjoAvila/Aely/actions/runs/36343752892), Pages [36344438830](https://github.com/JuanjoAvila/Aely/actions/runs/36344438830); HTTP/ZIP/HTML/SW cotejados el 27/9 a las 19:41 UTC. Beta 4.26.56.1 conservaba FIN-05, selector y TR pendientes; APK estable 4.26.32/code 48 intacta. [Evidencia](docs/briefs/ops02-restauracion-probada.md).

Trabajo pendiente, prioridades y criterios de cierre para el equipo: [docs/BACKLOG.md](docs/BACKLOG.md).
Incluye el cruce con las listas antiguas para no repetir tareas ya hechas ni dar por cerrada toda la ronda.

En Ajustes → Revisar esta beta, toca la cabecera de una tanda para encogerla o desplegarla. Las aprobadas se encogen automáticamente y conservan su veredicto al actualizar si el guion sigue igual.

> Esta línea la vigila `tests/docs-frescura.test.mjs`: si no coincide con `VERSION`, `npm test` falla. Se puso porque el README se quedó siete versiones atrás (v4.1.0 con la app en la 4.8.0) sin que saltara nada.

Notas rápidas del rediseño v4 (para no perderse):
- **Rol de cuenta** (Recibos / Gasto diario / Todo): Cartera → Editar.
- **Hogar y gastos compartidos:** toca tu avatar en Inicio → Perfil → **«Tu gente»** (movido ahí en 4.10.0; antes al final de Cartera, donde no lo veía nadie) — [docs/HOGAR.md](docs/HOGAR.md).
- **Ordenar los bloques de Cartera:** Cartera → «⇅ Ordenar secciones» al pie (4.10.0).
- **Open Banking se sincroniza a demanda** (botón en Cartera), no al abrir la app.
- **Orden manual de movimientos:** en Gastos, arrastra el asa de una fila para colocarla dentro del mismo día; la fecha real no cambia.
- **Ficha de gasto v4.1 (en desarrollo):** Apuntar y Modificar comparten importe, concepto, banco/efectivo/fecha, categorías y teclado; los movimientos del banco mantienen bloqueados importe y cuenta.
- **Confirmar un cargo (integración beta):** Gastos → ficha → Paga un recibo muestra pendientes del mes, también si la factura o divisa varió. El diálogo enseña cargo real e importe/banco previstos: confirma solo el pago completo o cancela si es parcial. Puedes deshacer. Ya pagado muestra el banco real y separa Cargo y Previsto si difieren; la parte propia de un compartido conserva su previsión. No cambian clasificación ni saldo del cargo.
- **Tus recibos v4.1:** Plan → Recibos → Gestionar —o Ajustes → Dinero— abre una pantalla propia con buscador, grupos, iconos por tipo, fichas y alta por pasos; el gesto Atrás acompaña también cada paso del alta, la ficha confirma antes de cerrar y las altas muestran tipo y nombre al guardar. La comparación con el banco vive en Ajustes → Mis bancos.
- **Updates:** transporte en `12-boot.js`, estado de UI en `useUpdates()` (`10-app-components.js`).
- **Canal beta y banco de pruebas** (solo `is_admin`): Ajustes → Dev → Pruebas; cada tanda distingue revisión y entrega, incluso plegada — [docs/TESTING.md](docs/TESTING.md).

El guardián tests/logs-privacidad.test.mjs verifica las fronteras de diagnóstico con marcadores sintéticos. Cobertura y límites, incluyendo servidor sin desplegar, en [SEC-03](docs/briefs/sec03-privacidad-logs.md).
