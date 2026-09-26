# Setup Supabase — Fase 1 (Aely)

## bank-sync desplegado para beta 4.26.53.1: concepto y MCC opcionales

El cambio en `_shared/enablebanking.ts` añade concept separado de la descripción bancaria y MCC opcional normalizado; mantiene signo, identidad, merchant, note y contrato anterior. Lo consume bank-sync en diario e histórico. No exige migraciones, secretos, nuevas llamadas al proveedor ni cambios en ingest. Desplegado con autorización explícita el 26/9/2026: únicamente bank-sync, migraciones=no, [Action 36271682736](https://github.com/JuanjoAvila/Aely/actions/runs/36271682736), SHA 7839acb769fb9175434a1b652be3917faab02261. La etapa de migraciones fue omitida; el log confirma solo bank-sync. Servicio compartido con producción, cliente publicado solo en beta. El despliegue previo comprobado fue Action 35978144828, SHA f53e865277f676998d76844fd047357f4adc1569. Comparados bank-sync, enablebanking y cors (sus imports locales) contra ese SHA, solo cambia la adición de estos campos. Rollback por ese SHA. No usar despliegue general. Cliente antiguo ignora los campos; cliente nuevo conserva la clasificación previa sin ellos. No se promete que TR real entregue datos útiles.

## Bank-sync 4.25.0: desplegado y comprobado

La corrección del paginado de `bank-sync` quedó comprobada el 24/9/2026 con datos reales de
CaixaBank: los movimientos de agosto, incluidos unos 100 €, ya estaban en Gastos. Por eso repetir
«Importar histórico» no ofrecía filas nuevas; no era una pérdida de datos. No hay backfill ni se
borran filas existentes. Para rollback, desplegar el `bank-sync` anterior.

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

### Migración 0025 — identidad idempotente de notificaciones (4.26.6)

`0025_expenses_ingest_event.sql` añade `expenses.ingest_event_id` y un índice único parcial por
usuario. No hace backfill ni toca movimientos anteriores. El lector Android nuevo manda la
identidad estable del evento y `ingest` la confirma solo cuando la fila existe; una reentrega o
una carrera concurrente recupera la fila anterior en vez de crear o anunciar otro gasto.

Despliegue obligatorio, en este orden: **migración 0025 → Edge `ingest` → APK nueva**. La Edge
tolera clientes antiguos sin `ingest_event_id`, pero una OTA sola no puede corregir la identidad
que genera el lector instalado. Para el histórico de CaixaBank se despliega además `bank-sync` y
después el cliente web que invoca un banco por petición. No afirmar que está resuelto con datos
reales hasta probar CaixaBank seleccionada en solitario.

### Telemetría financiera de las Edge

Los eventos de soporte de `bank-sync` son deliberadamente cerrados: banco, estado, número de
cuentas/filas, duración y código de error conocido. No se guardan payloads de Enable Banking,
movimientos, importes, comercios, fechas, referencias ni titulares. Esta garantía vive también en
`tests/security.test.mjs`. `bank-callback` tampoco serializa `session.access` —puede contener IBAN—
ni la query OAuth —lleva `code` y `state`—: solo conserva su forma y recuentos. El cliente común de
Enable Banking convierte una respuesta fallida en estado HTTP + código corto y nunca incluye el
cuerpo del proveedor. `ingest` registra el motivo, la fuente y las longitudes de una notificación
descartada, o códigos cerrados de error; nunca su texto, comercio o importe.

Para aplicar toda la frontera hay que desplegar **`bank-aspsps`**, **`bank-connect`**,
**`bank-disconnect`**, **`bank-callback`** y **`bank-sync`** —todas empaquetan el cliente compartido—,
más **`ingest`**. Modificar los ficheros en una rama o publicar una OTA no cambia las Edge que están
sirviendo a los móviles.

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
| `OPENAI_API_KEY` | key de OpenAI; necesaria para categorías IA y para la ayuda avanzada |
| `AELY_HELP_AI_ENABLED` | `true` solo después de aprobar privacidad, coste y despliegue de `help-assistant` |
| `OPENAI_HELP_MODEL` | opcional; modelo de Pregúntame (por defecto `gpt-5.6-sol`) |

> `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya las inyecta Supabase en las funciones; no las pongas a mano.

`help-assistant` permanece cerrado si falta la key o el flag exacto `true`. Desplegar el código no
activa por sí solo ninguna llamada de pago. La app conserva la guía local/offline y muestra un aviso
controlado si la función no está disponible. Antes de activar el flag, revisar el consentimiento,
los topes y la estimación de coste en
[`briefs/asistente-hibrido-2026-09-16.md`](briefs/asistente-hibrido-2026-09-16.md).

## Paso 5 — Activar el deploy automático desde GitHub 👤

En el repo: **Settings → Secrets and variables → Actions**:

- **Secrets** → New repository secret:
  - `SUPABASE_ACCESS_TOKEN` → genera uno en https://supabase.com/dashboard/account/tokens
  - `SUPABASE_DB_PASSWORD` *(opcional)* → la Database Password del Paso 1 (para migraciones automáticas)
- **Variables** → New repository variable:
  - `SUPABASE_PROJECT_REF` → el Project Ref del Paso 1

A partir de aquí, cualquier cambio en `supabase/**` despliega las funciones solo (workflow `Deploy Supabase`).
Mientras no estén configurados, el workflow se salta el deploy sin fallar.

El proyecto Supabase es compartido: `beta` no tiene una Edge separada. Por eso una corrección de
`ingest` puede prepararse y revisarse en beta, pero solo se activa al promocionarla a `main` o al
lanzar expresamente `supabase.yml`. No se debe presentar una prueba móvil de servidor como activa
antes de ese despliegue.

FIN-05 amplía la respuesta mensual de `ingest` con `periodStart` (inicio del mes en
Europe/Madrid), `readAt` (instante anterior al SELECT), `eventKey` (identidad persistida),
`shownDelta`/`againstDelta` (contribución de esa fila), `expenseKey` (clave de lápida),
`counts` (presupuesto) y `cashCounts`
(efectivo de TR). Si el SELECT falla, `month` es `null`: una compra confirmada no autoriza
fabricar un total cero. El 26/9 se desplegó expresamente solo `ingest` desde `beta` en
`be59e27c` ([Action 36196554737](https://github.com/JuanjoAvila/Aely/actions/runs/36196554737));
no se ejecutaron migraciones nuevas. Aún falta verificar por separado la revisión activa que
responde y probar el circuito completo con la APK nueva en el móvil.

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

FIN-06 (4.26.51): `_shared/wallet.ts` preparado con 30 ISO y paridad de céntimos/legacy USD con cliente. Sin cambio sigue devolviendo null; ingest no guarda euros inventados. El cambio del servidor está probado en repo pero NO desplegado al backend compartido: cualquier deploy de ingest requiere autorización específica. No hay migración de esquema ni de movimientos.
