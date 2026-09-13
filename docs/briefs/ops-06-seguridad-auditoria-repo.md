# OPS-06 · Seguridad — auditoría del repo (13/9/2026)

Encargo suyo (12/9): *«intentando “hackearla” a ver si hay fallos de seguridad… antes de
publicarla en la Play Store»*. Primera pasada, **de solo lectura y sobre lo que dice el REPO**
(migraciones y código). ⚠ La base de datos viva puede no coincidir: hay migraciones aplicadas a
mano (ver `supabase.yml`, «las dos 0012»). La pasada contra la BD real (`pg_policies`,
`information_schema.role_table_grants`) necesita acceso al SQL Editor y su OK.

---

## 🔴🔴 P0 — La APK pública llevaba el token de ingest del dueño (14/9)

- `android/app/build.gradle` metía `MICARTERA_INGEST_URL` (con `?token=`) en `defaultConfig`,
  o sea **también en release**, y `npm run release:apk` publica esa APK en **Releases de un repo
  público**. Cualquiera con la APK podía extraer la URL y **apuntar gastos en la cuenta del dueño**
  (es el token legacy `INGEST_TOKEN` de la Edge `ingest`).
- `TrExpenseListener` caía a ese `BuildConfig` si el móvil no tenía token propio: un móvil de
  la familia con el lector de notificaciones activo y sin token propio **mandaba sus gastos de TR a
  la cuenta del dueño**. No está comprobado que haya pasado.
- **Arreglado en código** (rama `tanda/sec-ingest-apk`): release sale con `INGEST_URL=""` (solo
  la APK `.debug` la lleva), el fallback solo en `BuildConfig.DEBUG`, y `release:apk` se niega a
  publicar si `INGEST_URL` no está vacía. Compilado aquí: release longitud 0, debug 85.
  Llega con la **APK 46** (no por OTA).
- **Pendiente del dueño, en este orden:** (1) Ajustes → notificaciones de TR, apagar y encender
  (genera su token propio); (2) borrar/rotar el secreto `INGEST_TOKEN` de Supabase: el token de las
  APK 44/45 ya publicadas deja de valer al momento.

## 🔴 P1 — Entrar en un Hogar ajeno adivinando el código

- El código de invitación son **6 caracteres** de un alfabeto de 32 (`mcInviteCode`,
  `13-hogar.js`), generados con **`Math.random`** (no criptográfico). Espacio: 32⁶ ≈ 1.070 millones.
- `join_household_by_code` (`0013_households.sql`) es `SECURITY DEFINER`, lo puede llamar
  **cualquier usuario con sesión** y **no tiene freno**: cada intento fallido es una excepción y
  se puede reintentar sin límite.
- Quien entra como miembro lee `household_snapshots` del hogar: **cuentas y saldos** de cada
  miembro (`buildHouseholdSnapshot`).
- Hoy (familia, 3 usuarios, ningún extraño con cuenta) el riesgo es teórico. **Con registro abierto
  en la Play Store deja de serlo**: con muchos hogares creados, acertar UNO es mucho más fácil que
  acertar uno concreto.

**Arreglo propuesto (una tanda):** (1) freno dentro del RPC con `check_rate_limit`
(p.ej. 10 intentos / 10 min por usuario); (2) códigos de 10 caracteres con
`crypto.getRandomValues`; (3) los códigos actuales siguen valiendo (no romper hogares existentes).

## 🟠 P2 — `app_events` sin tope

- `app_events_insert` deja a cualquier usuario con sesión insertar **sus** eventos sin límite de
  número ni de tamaño (`detail` sin `char_length`). Un cliente en bucle o malicioso puede inflar la
  tabla (espacio del plan Free) y enterrar los errores de verdad.
- **Arreglo:** `check (char_length(detail) <= 8000 and char_length(message) <= 500)` y un freno por
  usuario (vía RPC o trigger). El cliente ya recorta a 300/8000 en la mayoría de sitios.

## 🟠 P2 — Freno solo en 3 de 13 Edge Functions

`ingest`, `myinvestor-connect` y ahora `categorize` (camino del LLM, rama
`tanda/categorize-limitador`). `bank-connect`/`bank-sync` llaman a Enable Banking (cuota PSD2 del
banco) sin freno propio: un bucle podría gastar el consentimiento del usuario («uso robótico»,
ya pasó con Caixa/Sabadell el 18/7).

## 🟠 P2 — Manifiesto Android (14/9)

- **`android:allowBackup="true"`**: la copia de seguridad de Android (Google Drive / cable) se
  lleva los datos de la app, incluida la sesión de Supabase y la cartera entera guardada en la
  WebView, y se pueden restaurar en otro móvil. Para una app de dinero con usuarios de fuera:
  `allowBackup="false"` o reglas `dataExtractionRules` que excluyan la WebView. Va con una APK.
- **`REQUEST_INSTALL_PACKAGES`** + instalar APK desde la app: la **Play Store lo restringe** y
  rechaza apps que se auto-actualizan fuera de Play. Antes de publicar en Play hay que quitar el
  instalador propio (y el OTA de Capgo revisarlo contra su política). No es un fallo hoy (canal
  familiar por GitHub); es un bloqueo para DEC-01.
- **Esquema `micartera://bank`**: cualquier web o app puede abrirlo. Hoy solo dispara un aviso y un
  sync del propio usuario (inofensivo) y el `msg` se pinta como texto, no HTML. Mantenerlo así.

## 🟢 Bien (comprobado en el repo)

- `expenses`, `app_state`, `state_backups`, `ingest_tokens`: RLS `auth.uid() = user_id` en
  lectura Y escritura (`using` + `with check`).
- `bank_links`, `myinvestor_links`: el usuario solo **lee**; escriben las Edge con service role.
- `cron_secrets`, `rate_limits`: RLS activado **sin políticas** = nadie desde el cliente.
  `check_rate_limit` revocado a `anon`/`authenticated`.
- `app_events` solo lo **lee** el admin, y el admin sale de `profiles.is_admin` (0016), no del
  email en la política.
- `households`: solo el creador edita/borra; miembros solo se borran a sí mismos;
  `household_snapshots` solo escribe cada uno la suya y siendo miembro.

## Pendiente de esta auditoría (siguientes pasadas)

1. **BD viva**: exportar `pg_policies` y grants y compararlos con esto (necesita su OK / SQL Editor).
2. **`localStorage`**: qué se guarda en claro en el móvil (estado entero, tokens de sesión) y si
   sobrevive a desinstalar.
3. **Manifiesto Android**: permisos, `exported`, `usesCleartextTraffic`, backup (`allowBackup`).
4. **Qué viaja en `app_events`**: rutas que puedan subir comercios/importes/IBAN (SEC-03).
5. **Edge sin sesión**: `ingest` (token), `bank-callback` (state/code), `bank-aspsps`: entradas
   no validadas (SEC-01).
