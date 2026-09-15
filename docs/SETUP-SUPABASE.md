# Setup Supabase — Fase 1 (Aely)

## Bank-sync 4.25.0: despliegue pendiente

La corrección del paginado necesita desplegar **solo `bank-sync`**, con autorización del dueño.
El cambio compartido en `enablebanking.ts` se empaqueta con esa función; no hace falta desplegar
las demás. No hay migración ni backfill. Cliente anterior admite los campos nuevos; cliente nuevo
avisa también de fallos del servidor anterior, pero no puede completar su paginado desde el móvil.
Validar el paquete desplegado y hacer una sincronización manual autorizada antes de afirmar que
CaixaBank/Sabadell están resueltos en datos reales. Para rollback, desplegar el `bank-sync` anterior;
las filas ya importadas no se borran. Contrato y pruebas en el brief de esta tanda.

Guía paso a paso para arrancar las tripas en la nube. Lo que tú haces (una vez) va marcado con 👤.
El código (esquema, funciones, CI) ya está en el repo dentro de `supabase/`.

## Arquitectura objetivo

```
[Notificación TR en Android]
        │ MacroDroid
        ▼
[Edge Function: ingest]  ──►  [Postgres: tabla expenses]
                                      ▲
[App PWA] ── @supabase/supabase-js ───┤  (login magic-link, RLS por usuario)
        │                             ▼
        └──► [Edge Function: prices] ──► Finnhub   [Postgres: tabla app_state (JSONB)]
```

- **Auth:** magic link por email (Supabase Auth).
- **Datos:** gastos en `expenses` (relacional) + resto del estado en `app_state` (JSONB, una fila por usuario).
- **RLS activado:** cada usuario solo ve lo suyo. La función `ingest` usa la service role key para escribir tus gastos sin sesión.

---

## Paso 1 — Crear el proyecto 👤

1. Entra en https://supabase.com → **Start your project** (gratis, sin tarjeta).
2. **New project**: nombre `mi-cartera`, región Europa (ej. *West EU / Ireland*), genera una **Database Password** y **guárdala** (la necesitas para CI).
3. Cuando termine de provisionar, ve a **Project Settings → API** y apunta:
   - **Project URL** → ej. `https://xxxxxxxx.supabase.co`
   - **anon public key** (clave pública, va en el cliente)
   - **service_role key** (SECRETA, solo backend)
   - El **Project Ref** es el `xxxxxxxx` de la URL.

## Paso 2 — Crear el esquema 👤

Opción rápida (recomendada la primera vez): **SQL Editor → New query**, pega el contenido de
[`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) y dale a **Run**.

(Más adelante, si configuras `SUPABASE_DB_PASSWORD` en CI, las migraciones se aplican solas con `supabase db push`.)

### Migración 0019 — límite de peticiones y caducidad del `state` (4.10.0)

`0019_rate_limit.sql` añade la tabla `rate_limits` (sin políticas RLS a propósito: NADIE llega desde
el cliente, solo la service_role a través de `check_rate_limit`) y la columna
`bank_links.state_issued_at`.

Qué frena y por qué:

| Función | Límite | Motivo |
|---|---|---|
| `ingest` | 60/min **por IP** | No pide sesión; su única credencial es un token. Sin freno se prueban tokens a la velocidad de la red. Por IP y no por token: contar por token no frena a quien va probando tokens distintos, que es justo el ataque. |
| `myinvestor-connect` | 10 cada 10 min **por usuario** | Por ahí van el usuario y la CONTRASEÑA reales del banco. Un bucle de reintentos puede dejar al usuario **bloqueado en su propio banco**. |

**Si la migración no está aplicada, no se rompe nada**: `rateLimit()` deja pasar y lo apunta en la
consola de la función. Un freno de seguridad que tumba la app cuando se rompe convierte un incidente
pequeño en uno grande.

`state_issued_at` la escribe `bank-connect` y la lee `bank-callback`: la autorización del banco
caduca a los 30 minutos y el `state` se **gasta** al usarlo. Los enlaces creados antes de esta
migración no tienen marca y se dan por buenos, para no romper una reconexión a medias.

### CORS: lista blanca, no `*` (4.10.0)

Las Edge Functions ya no responden `Access-Control-Allow-Origin: *`. El origen permitido lo pone
`withCors` (`supabase/functions/_shared/cors.ts`) y sale de **`APP_URL`** más `https://localhost`
(la WebView de la APK) y localhost con puerto (desarrollo y e2e). **Si mudas la app de dominio,
cambia `APP_URL`** o el navegador bloqueará las respuestas. `tests/edge-sintaxis.test.mjs` falla si
alguien vuelve a poner el `*`.

## Paso 3 — Crear tu usuario y obtener tu UUID 👤

1. **Authentication → Providers → Email**: deja activado *Email*. Para magic link, activa *Enable email confirmations* (o magic link).
2. **Authentication → Users → Add user** (o entra una vez desde la app con tu email).
3. Copia el **User UID** (uuid) de tu usuario → lo necesitas como `INGEST_USER_ID`.

## Paso 3b — Configurar las URLs de Auth (CRÍTICO para el magic link) 👤

En **Authentication → URL Configuration**:
- **Site URL:** la URL de tu app en GitHub Pages (cópiala de Settings → Pages del repo; normalmente `https://juanjoavila.github.io/Aely/`).
- **Redirect URLs:** añade la misma URL y, por comodidad, un comodín: `https://juanjoavila.github.io/Aely/**`.

> Sin esto, el enlace del email redirige a `localhost` y el login falla. Si pruebas también en local, añade `http://localhost` a las Redirect URLs.

## Paso 4 — Configurar los secretos de las funciones 👤

En **Project Settings → Edge Functions → Secrets** (o con la CLI), añade:

| Secreto | Valor |
|---|---|
| `FINNHUB_KEY` | tu key de finnhub.io |
| `INGEST_TOKEN` | un token largo aleatorio que invente (lo usará MacroDroid) |
| `INGEST_USER_ID` | el UUID de tu usuario del Paso 3 |

> `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya las inyecta Supabase en las funciones; no las pongas a mano.

## Paso 5 — Activar el deploy automático desde GitHub 👤

En el repo: **Settings → Secrets and variables → Actions**:

- **Secrets** → New repository secret:
  - `SUPABASE_ACCESS_TOKEN` → genera uno en https://supabase.com/dashboard/account/tokens
  - `SUPABASE_DB_PASSWORD` *(opcional)* → la Database Password del Paso 1 (para migraciones automáticas)
- **Variables** → New repository variable:
  - `SUPABASE_PROJECT_REF` → el Project Ref del Paso 1

A partir de aquí, cualquier cambio en `supabase/**` despliega las funciones solo (workflow `Deploy Supabase`).
Mientras no estén configurados, el workflow se salta el deploy sin fallar.

## Paso 6 — Repuntar MacroDroid (cuando esté probado) 👤

Cambia la URL del POST de MacroDroid del Apps Script a:

```
https://<PROJECT_REF>.supabase.co/functions/v1/ingest?token=<INGEST_TOKEN>
```

Mantén el Apps Script activo hasta confirmar que entran gastos por Supabase; luego se jubila.

---

## Estado del frontend

✅ **Ya cableado** en `public/index.html` (v3.4.0): cliente Supabase, login magic-link (botón de nube arriba), sincronización de `app_state`, lectura de `expenses` y precios vía la función `prices`. Offline-first: sin sesión, todo sigue con `localStorage`.

### Cómo probarlo (cuando termines los pasos 1–5)
1. Abre la app en el móvil (o GitHub Pages), pulsa el **icono de nube** arriba a la derecha.
2. Mete tu email → te llega el enlace → al abrirlo, vuelves a la app ya con sesión.
3. La primera vez sube tu estado actual a la nube. En otro dispositivo, inicia sesión y verás lo mismo.
4. El botón **Sincronizar** trae los gastos de la tabla `expenses`; **Precios USD** usa la función `prices`.

### Pendiente (futuro)
- Repuntar MacroDroid a la función `ingest` (Paso 6) y jubilar el Apps Script.
- Pantalla de login más cuidada (ahora usa el prompt nativo del navegador) e importación de los gastos históricos del Google Sheet.
