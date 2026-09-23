# App nativa Android (Capacitor) — reemplazo de MacroDroid

Objetivo: empaquetar la PWA como app Android y añadir un **servicio nativo** que lee la
notificación de gasto de Trade Republic y la manda a la Edge Function `ingest` — lo mismo que
hacía MacroDroid, pero dentro de nuestro proyecto.

La app **arranca del bundle web local** (rápido y offline). Tras el arranque, el bloque OTA
descarga `version.json` + `bundle.zip` desde GitHub Pages y avisa con notificación + botón
«Nueva versión · toca para actualizar». Cambios nativos (lector TR, permisos…) requieren APK
nuevo vía `apk.json` → `installApk`.

> ⚠️ El build del APK se hace en **tu PC** (Android Studio / Gradle). Ver secciones siguientes.
> **Alineación:** `versionName` en `android/app/build.gradle` = `VERSION` del repo; `versionCode` sube +1;
> tras publicar el release, actualiza `public/apk.json` al asset real (nunca a un tag vacío).
>
> ⚠ **Antes de `assembleRelease`:** en `android/local.properties` deja `MICARTERA_WEBDEBUG=0`
> (o borra la clave). Si está en `1`, **Gradle aborta** (salvo `MICARTERA_ALLOW_WEBDEBUG_RELEASE=1`
> para CDP a propósito). Incidente 2026-08-06: se coló en la 36; canónica limpia = APK **39 / 4.16.1**.
> Para publicar: **`npm run release:apk`** (ver [`docs/RELEASE.md`](RELEASE.md)). Comprueba
> `BuildConfig.java` → `WEB_DEBUG = false`. El tema de splash debe llevar
> `postSplashScreenTheme` → `AppTheme.NoActionBar` o tras el arranque puede quedar una franja
> nativa bajo la cámara.
>
> La barra fina de desplazamiento del borde se desactiva sobre la WebView de Capacitor en
> `MainActivity`, después de `super.onCreate()`. Es solo el indicador nativo: el scroll, la inercia
> y el rebote siguen activos. Un cambio aquí requiere APK nueva; una OTA no puede modificarlo.

---

## 1. Prerrequisitos (instalar una vez)

- **Node.js** 18+ (https://nodejs.org).
- **Android Studio** (https://developer.android.com/studio) — incluye el JDK y el Android SDK.
  - Al abrirlo, deja que instale el SDK por defecto y un emulador (o usa tu móvil con *Depuración USB* activada).
- Tu móvil con **Trade Republic** instalado (para probar de verdad).

## 2. Generar el proyecto Android

Desde la raíz del repo, en una terminal:

```bash
npm install
npx cap add android
npx cap sync android
```

Esto crea la carpeta `android/` (el proyecto nativo). Puedes commitearla luego si quieres versionarla.

## 3. Añadir el lector de notificaciones (código nativo)

### 3.1 Crea el servicio Kotlin

Crea el archivo:
`android/app/src/main/java/com/micartera/app/TrExpenseListener.kt`

```kotlin
package com.micartera.app

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class TrExpenseListener : NotificationListenerService() {

    // La misma URL + token que usaba MacroDroid.
    private val INGEST_URL =
        "https://sfyfjagbnhbplrljpbvh.supabase.co/functions/v1/ingest?token=micartera2026clave"

    // Paquete de Trade Republic (verifícalo: Ajustes de Android → Apps → Trade Republic → info).
    private val TR_PACKAGE = "de.traderepublic.app"

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (sbn.packageName != TR_PACKAGE) return

        val extras = sbn.notification.extras
        val title = extras.getCharSequence("android.title")?.toString() ?: ""
        val text = extras.getCharSequence("android.text")?.toString() ?: ""

        // Solo notificaciones de gasto (que mencionen un importe). Ajusta si tu texto difiere.
        if (text.isEmpty()) return
        if (!text.contains("€") && !Regex("""\d+[.,]\d+""").containsMatchIn(text)) return

        Thread {
            try {
                val body = JSONObject()
                    .put("texto", text)
                    .put("titulo", title)
                    .put("fecha", System.currentTimeMillis().toString())
                    .toString()

                val conn = URL(INGEST_URL).openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.connectTimeout = 15000
                conn.readTimeout = 15000
                conn.doOutput = true
                conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                conn.responseCode   // dispara el envío
                conn.disconnect()
            } catch (e: Exception) {
                // En v1 simplemente se ignora; más adelante se puede añadir reintento/cola.
            }
        }.start()
    }
}
```

### 3.2 Registra el servicio en el Manifest

En `android/app/src/main/AndroidManifest.xml`, dentro de `<application> … </application>`, añade:

```xml
<service
    android:name=".TrExpenseListener"
    android:label="Aely · captura de gastos"
    android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"
    android:exported="false">
    <intent-filter>
        <action android:name="android.service.notification.NotificationListenerService" />
    </intent-filter>
</service>
```

(El permiso de INTERNET ya viene por defecto en los proyectos de Capacitor.)

## 4. Compilar e instalar en tu móvil

```bash
npx cap open android
```

Se abre Android Studio. Conecta el móvil (con depuración USB) o arranca un emulador y pulsa **Run ▶**.
La app se instala y abre tu PWA en vivo.

## 5. Conceder el permiso de notificaciones (una vez)

En el móvil: **Ajustes → Aplicaciones → Acceso especial → Acceso a notificaciones** (el nombre varía por marca)
→ activa **Aely**. Sin esto, el servicio no puede leer la notificación de TR.

## 6. Probar

Haz una compra (o espera una notificación de gasto de TR). El servicio la captura y la manda a `ingest`.
Comprueba en Supabase → Table Editor → `expenses` que entró, y en la app pulsa Sincronizar (o reábrela,
que ahora auto-sincroniza).

Si no entra:
- Verifica el **paquete de TR** (`TR_PACKAGE`) — puede no ser `de.traderepublic.app`.
- Revisa que el **texto** de la notificación contiene el importe (ajusta el filtro del paso 3.1).
- Confirma que el permiso de *Acceso a notificaciones* está activado.
- Mira el panel de errores (`npm run errores`): si el gasto llegó al servidor y falló al guardarse,
  ahí sale. **Si no sale nada, es que no llegó** — y entonces solo hay dos culpables posibles.

### Las dos formas de perder un gasto sin dejar rastro (2026-08-06)

Cuestan de diagnosticar porque no dejan ni fila, ni aviso, ni error en el panel. Las dos están
arregladas, pero conviene saberlas porque el síntoma es el mismo: «este gasto no me ha entrado».

1. **El comercio se comía la clasificación.** `ingest` tira las notis de ruido de TR (intereses,
   round-up, 3DS…) buscando palabras clave, y las buscaba en el texto ENTERO. Como el nombre del
   comercio va en ese texto, un **«BAR STOP»** picaba en `stop` y se descartaba como ruido; igual
   «EL LÍMITE» (`limit`), «BAR EL DEPÓSITO» (`deposito`) o «CÓDIGO BCN» (`codigo`). Un gasto
   recurrente en un sitio así **no entra nunca**. Ahora el ruido solo se busca en la frase, no en
   el nombre del comercio (`clasificar()` en `_shared/ingest_logic.ts`).
2. **El envío se perdía y nadie lo reintentaba.** El POST a `ingest` iba dentro de un
   `catch (Exception ignored)`: sin cobertura —dentro de un centro comercial, por ejemplo— el
   gasto moría ahí. Ahora lo que falla por red, timeout, 5xx o 429 se guarda en una cola local
   (`micartera_ingest_cola`, una semana de margen) y se reintenta con la siguiente notificación y
   al reconectar el lector. Un 4xx de verdad (token inválido) no se reintenta: no se arregla solo.

Y un tercero que sí deja error en el panel: el nombre del comercio llega del datáfono y a veces
trae **basura de codificación** (una compra real salió como `10638 CORNELLAÂ▯ SPLAU SC`). Si lo
que cuela es un NUL, **Postgres rechaza el INSERT entero**. `limpiarTexto()` los quita antes de
guardar.

Desde 4.26.6 el lector no deduplica por título o texto: Wallet y Trade Republic pueden describir
la misma compra de forma distinta. La identidad se forma con origen, paquete, clave de Android y
`postTime` (o paquete, id y tag como fallback) y viaja a `ingest`. Este cambio exige **APK nueva**
y debe publicarse solo después de aplicar la migración 0025 y desplegar la Edge `ingest`; de otro
modo el móvil conserva la deduplicación anterior aunque reciba la OTA.

## 7. Distribuir (para que la usen otros)

- En Android Studio: **Build → Generate Signed Bundle / APK** → crea un keystore (guárdalo bien) → genera el APK firmado.
- Lo compartes para instalar (sideload) o lo subes a Google Play. *(Ojo: Play Store es estricto con los
  servicios de acceso a notificaciones; hay que justificar el uso. Para sideload entre familia/amigos no aplica.)*

---

## 8. Sincronización con Trade Republic (botón «Conectar Trade Republic · BETA»)

La pestaña **Inversiones** ya tiene la tarjeta y toda la UI (login → código 2FA → previsualización →
re-anclaje por ISIN). Lo que **falta es la parte nativa**: la web no puede hacer el login de TR porque
está detrás de **AWS WAF**, que exige una cabecera `X-aws-waf-token` que solo se consigue ejecutando la
página de login en **un navegador de verdad**. La WebView del APK **es** un navegador de verdad, así que
aquí sí se puede.

### 8.1 El contrato que la web espera

La tarjeta busca un puente en `window.MiCarteraTR` **o** el plugin de Capacitor
`window.Capacitor.Plugins.TradeRepublic`. Implementa cualquiera de los dos con estos métodos (todos
devuelven `Promise`):

```ts
status()                        // -> { connected: boolean }
login({ phone, pin })           // -> { ok: boolean, processId?: string, error?: string }   (dispara el 2FA)
verify({ processId, code })     // -> { ok: boolean, error?: string }   (guarda la sesión EN EL DISPOSITIVO)
sync()                          // -> { ok: boolean, positions: Position[], cash?: number, error?: string }
logout()                        // -> { ok: boolean }

type Position = { isin: string; name: string; shares: number; value: number; cost?: number };
// value y cost en EUR (TR liquida en €). La web convierte a $ las posiciones marcadas como USD.
```

La web hace el resto: mapea cada `Position` a tu inversión por ISIN (con respaldo por nombre) y re-ancla
participaciones, valor y coste. No necesita nada más.

### 8.2 Lo que hace la parte nativa (flujo real de TR)

1. **Token WAF:** carga `https://app.traderepublic.com` en una WebView oculta (o resuelve el challenge de
   AWS WAF) para obtener `X-aws-waf-token`. Sin esto, `login` devuelve **403**.
2. **login:** `POST https://api.traderepublic.com/api/v1/auth/web/login` con
   `{ phoneNumber, pin }` y el header del WAF → devuelve `{ processId, countdownInSeconds }` y **dispara el
   2FA** (código de 4 dígitos que llega como **push a la app de TR**; SMS es el respaldo).
3. **verify:** `POST .../api/v1/auth/web/login/{processId}/{code}` → en la respuesta vienen las cookies
   `tr_session` / `tr_refresh`. **Guárdalas cifradas en el dispositivo** (EncryptedSharedPreferences /
   Keystore), nunca en la nube.
4. **sync:** abre el WebSocket `wss://api.traderepublic.com/` → `connect 31 {locale,platformId:"webtrading",…}`
   con la cookie de sesión → `sub {id} {"type":"compactPortfolio"}` (y `cash` para el efectivo) → junta la
   foto de posiciones, ciérralo y devuélvelas mapeadas al shape `Position`.
5. **logout:** borra las cookies guardadas.

> ⚠️ Es una vía **NO oficial** (misma que usa la web de TR). Va contra sus Términos, puede pedir el 2FA
> cada cierto tiempo y podría romperse si TR cambia el login. Es opt-in «beta» y avisa de ello en la UI.
> Referencias del flujo: proyectos `pytr` y conectores similares (ojo: han sufrido justo el bloqueo del WAF).

---

## Pendiente para multi-usuario (cuando lo abras a más gente)

Ahora `ingest` mete todos los gastos en **tu** usuario (`INGEST_USER_ID` fijo) y el token va hardcodeado
en el Kotlin. Para que cada persona reciba SUS gastos:
- La app nativa debería mandar el **JWT del usuario logueado** (sesión de Supabase) en la cabecera.
- `ingest` pasaría a `verify_jwt = true` y derivaría el `user_id` del token, en vez de usar `INGEST_USER_ID`.

Lo montamos cuando llegue ese momento; para ti solo (single user) lo de ahora vale.
