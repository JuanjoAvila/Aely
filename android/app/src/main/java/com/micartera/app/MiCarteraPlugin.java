package com.micartera.app;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

import androidx.appcompat.app.AppCompatActivity;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Plugin nativo único de Aely. La web lo encuentra en
 * window.Capacitor.Plugins.MiCartera y expone:
 *   - bioAvailable()          -> { available: bool }   (¿hay huella/candado configurado?)
 *   - bioVerify()             -> resuelve si el usuario se autentica (huella o PIN del móvil)
 *   - updateWidget({...})     -> guarda los datos del mes y refresca el widget de pantalla de inicio
 *   - showNotification({...}) -> notificación local (título + cuerpo)   [ojo: "notify" es final en Object]
 *   - ensureNotifPerm()       -> pide el permiso POST_NOTIFICATIONS (Android 13+) si falta
 *   - notifAccess()           -> { granted } ¿el lector de notis TR tiene acceso a notificaciones?
 *                                (se PIERDE al desinstalar/reinstalar — bug Consum 2026-07-06)
 *   - openNotifAccess()       -> abre Ajustes → Acceso a notificaciones para reactivarlo
 *   - consumeGoto()           -> { goto? } deep-link pendiente al tocar la noti de un gasto (punto 5);
 *                                la web salta a Gastos y abre la ficha. Se limpia al leerlo.
 *   - appInfo()               -> { versionName, versionCode } del APK instalado (la web lo
 *                                compara con apk.json de Pages para el botón «Actualizar app»)
 *   - installApk({url, sha256?}) -> descarga el APK nuevo y abre el instalador del sistema
 *                                (actualización SIN cable; instala encima, mantiene datos).
 *                                Solo releases de GitHub del dueño; si llega `sha256` (el de
 *                                apk.json) tiene que coincidir, y el paquete tiene que ser este.
 *                                { ok:false, needsPermission:true } si falta el permiso
 *                                "instalar apps desconocidas" (se abre el ajuste; reintentar).
 *   - syncOtaState({version, markNotifiedVer?}) -> alinea versión web con el worker de fondo
 *                                y evita doble noti (nativo ya avisó ↔ JS al abrir).
 *   - setEdgeBackEnabled({enabled}) -> progreso de Atrás nativo para pantallas hijas
 *   - setNotifPrefs({expenseConfirm, bankSyncOnNotif}) -> prefs del lector de notis
 *   - consumeBankSyncPing()   -> { ping } si una noti de banco pidió sync (app en frío)
 *   - setAlertData({ym, charges, fired}) -> calendario de recibos del mes para las notis
 *                                «la víspera» con la app CERRADA (AlertCheckWorker). Devuelve
 *                                { fired:[ids] } con lo que el nativo ya avisó, para que la web
 *                                selle sus claves y no avise dos veces.
 *   - saveToDownloads({name, mime, data, title, body}) -> guarda el fichero (base64) en Descargas
 *                                y avisa con una noti que lo abre. { ok, uri, name, inDownloads }.
 *                                Desde la APK 65; antes la web no podía guardar nada (FileSaver).
 *   - evento JS `bankNotif`   -> cuando llega noti de Caixa/Sabadell/… (app en caliente)
 */
@CapacitorPlugin(
        name = "MiCartera",
        permissions = {
                @Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS})
        }
)
public class MiCarteraPlugin extends Plugin {

    // Huella (fuerte o débil) o, si no hay, el candado del propio móvil (PIN/patrón).
    private static final int AUTHS =
            BiometricManager.Authenticators.BIOMETRIC_WEAK | BiometricManager.Authenticators.DEVICE_CREDENTIAL;

    private BroadcastReceiver bankNotifReceiver;

    @Override
    public void load() {
        // El NotificationListenerService vive fuera de la Activity: manda un broadcast y aquí
        // lo convertimos en evento Capacitor para que la web llame a runBankSync.
        bankNotifReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent == null || !TrExpenseListener.ACTION_BANK_NOTIF.equals(intent.getAction())) return;
                notifyListeners("bankNotif", new JSObject());
            }
        };
        IntentFilter f = new IntentFilter(TrExpenseListener.ACTION_BANK_NOTIF);
        if (Build.VERSION.SDK_INT >= 33) {
            getContext().registerReceiver(bankNotifReceiver, f, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(bankNotifReceiver, f);
        }
    }

    @Override
    protected void handleOnDestroy() {
        AppCompatActivity act = getActivity();
        if (act instanceof MainActivity) ((MainActivity) act).setEdgeBackEnabled(false);
        if (bankNotifReceiver != null) {
            try { getContext().unregisterReceiver(bankNotifReceiver); } catch (Exception ignored) {}
            bankNotifReceiver = null;
        }
        super.handleOnDestroy();
    }

    @PluginMethod
    public void setEdgeBackEnabled(PluginCall call) {
        final AppCompatActivity act = getActivity();
        if (!(act instanceof MainActivity)) { call.reject("sin actividad"); return; }
        final Boolean requested = call.getBoolean("enabled", false);
        act.runOnUiThread(() -> {
            ((MainActivity) act).setEdgeBackEnabled(requested != null && requested);
            JSObject r = new JSObject();
            r.put("supported", Build.VERSION.SDK_INT >= 34);
            call.resolve(r);
        });
    }

    @PluginMethod
    public void bioAvailable(PluginCall call) {
        int can = BiometricManager.from(getContext()).canAuthenticate(AUTHS);
        JSObject r = new JSObject();
        r.put("available", can == BiometricManager.BIOMETRIC_SUCCESS);
        call.resolve(r);
    }

    @PluginMethod
    public void bioVerify(PluginCall call) {
        final AppCompatActivity act = getActivity();
        if (act == null) { call.reject("sin actividad"); return; }
        act.runOnUiThread(() -> {
            try {
                BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                        .setTitle("Aely")
                        .setSubtitle("Desbloquea para entrar")
                        .setAllowedAuthenticators(AUTHS)
                        .build();
                BiometricPrompt prompt = new BiometricPrompt(act,
                        ContextCompat.getMainExecutor(act),
                        new BiometricPrompt.AuthenticationCallback() {
                            @Override
                            public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                                JSObject r = new JSObject();
                                r.put("ok", true);
                                call.resolve(r);
                            }

                            @Override
                            public void onAuthenticationError(int code, CharSequence err) {
                                call.reject(err != null ? err.toString() : "cancelado");
                            }
                            // onAuthenticationFailed (huella no reconocida) NO termina el prompt:
                            // el usuario puede reintentar; solo error/success cierran la Promise.
                        });
                prompt.authenticate(info);
            } catch (Exception e) {
                call.reject(String.valueOf(e.getMessage()));
            }
        });
    }

    @PluginMethod
    public void beginWidgetRead(PluginCall call) {
        MiCarteraWidget.beginAppRead(getContext(), (generation, cut) -> {
            JSObject r = new JSObject();
            r.put("readGeneration", generation);
            r.put("nativeCut", cut);
            call.resolve(r);
        });
    }

    /* UN NÚMERO DEL PUENTE NO LLEGA CON UN TIPO FIJO (rechazo de la beta 115 + APK 53, feedback
       2026-10-11). El mensaje es texto JSON y org.json decide el tipo por el tamaño: un entero
       que cabe en int es Integer, uno mayor es Long y con decimales es Double. Los getters de
       Capacitor no cubren los tres: `getDouble` no admite Long y `getInt` solo Integer. El
       inicio del ciclo, en milisegundos, llegaba como Long → null → se guardaba el día 1 del
       mes. Con la APK 52 no se notaba; la 53 compara esa ventana con la del alcance y descartaba
       la foto en mudo: el widget se quedó en «Abre la app para actualizar».
       Todo número que venga de la web se lee por aquí, sea cual sea su tipo. */
    static Number bridgeNumber(PluginCall call, String name) {
        Object value = call.getData() != null ? call.getData().opt(name) : null;
        return value instanceof Number ? (Number) value : null;
    }

    static Double bridgeDouble(PluginCall call, String name) {
        Number value = bridgeNumber(call, name);
        return value != null ? value.doubleValue() : null;
    }

    @PluginMethod
    public void updateWidget(PluginCall call) {
        Context ctx = getContext();
        Double spent = bridgeDouble(call, "spent");
        Double budget = bridgeDouble(call, "budget");
        Double cash = bridgeDouble(call, "cash");
        // Las DOS piezas de «lo que te puedes permitir», por separado: lo que deja el presupuesto
        // y la liquidez segura de la cuenta de gasto. Antes se mandaba ya combinado (`afford`) y
        // el lector de notis no sabía rehacerlo con la app cerrada → el widget se contradecía
        // (2026-08-17). Ahora las combina `MiCarteraWidget.build()`, que es el único sitio donde
        // vive la fórmula. `safeLiq` sale de simular el mes día a día: eso solo lo sabe la app.
        Double budgetLeft = bridgeDouble(call, "budgetLeft");
        Double safeLiq = bridgeDouble(call, "safeLiq");
        String label = call.getString("cashLabel");
        // `longValue()` trunca: la web manda a la APK 53 el inicio con medio milisegundo para
        // que le llegue como Double, y aquí vale lo mismo que el entero exacto.
        Number period = bridgeNumber(call, "periodStart");
        Number contract = bridgeNumber(call, "contract");
        // Antes que la foto: `saveApp` es quien repinta. Sin `currency` (web anterior) vuelve a «€».
        MiCarteraWidget.saveCurrency(ctx, call.getString("currency"), call.getString("currencySym"),
                bridgeDouble(call, "currencyRate"));
        MiCarteraWidget.saveApp(ctx, period != null ? period.longValue() : MiCarteraWidget.monthStart(System.currentTimeMillis()),
                spent != null ? spent : 0, budget != null ? budget : 0,
                budgetLeft, safeLiq, cash, call.getString("cashEnt"), label,
                call.getString("coveredEvents"), call.getString("deletedKeys"),
                contract != null ? contract.intValue() : 0, call.getString("periodKind"),
                call.getString("magnitude"), call.getString("lang"), call.getString("scope"),
                call.getString("readGeneration"), call.getString("nativeCut"));
        call.resolve();
    }

    /* La web solo manda el ciclo a un widget que sabe pintarlo: la APK 51 no tiene este método,
       la llamada falla y la web sigue con el mes natural (INC-2909-01 E2). */
    @PluginMethod
    public void widgetContract(PluginCall call) {
        JSObject r = new JSObject();
        r.put("v", WidgetPeriod.CONTRACT);
        /* DIN-16 (desde la APK 65): sin subir `v` —la web ya decide el ciclo con `v>=2`— se declaran
           aparte las dos cosas nuevas. Solo si vienen aquí puede la web mandar `magnitude:"uso"` en
           el mes, o `currency`/`currencySym`/`currencyRate` (euro → moneda de la app). Una APK
           anterior no las anuncia y la web sigue con `gasto` y euros, como hasta ahora. */
        com.getcapacitor.JSArray caps = new com.getcapacitor.JSArray();
        caps.put(WidgetPeriod.USO);
        caps.put("moneda");
        r.put("caps", caps);
        call.resolve(r);
    }

    @PluginMethod
    public void widgetWaiting(PluginCall call) {
        MiCarteraWidget.waiting(getContext());
        call.resolve();
    }

    @PluginMethod
    public void showNotification(PluginCall call) {
        String title = call.getString("title");
        String body = call.getString("body");
        String gotoTarget = call.getString("gotoTarget");
        if (body == null || body.isEmpty()) { call.reject("body vacío"); return; }
        // El id sale de la ETIQUETA, no del reloj: con un id nuevo cada vez, cada aviso se apilaba
        // en vez de sustituir al anterior («las notis se duplican», 2026-07-26). La web manda `tag`
        // (p.ej. "mc-update-4.11.0.8"); si no lo manda —bundle viejo—, se cae al deep-link, que
        // para los avisos de actualización ya distingue ota de apk.
        String tag = call.getString("tag");
        if (tag == null || tag.isEmpty()) tag = gotoTarget != null ? gotoTarget : String.valueOf(body);
        Notif.show(getContext(), title != null ? title : "Aely", body,
                Notif.idFor(tag), gotoTarget);
        call.resolve();
    }

    @PluginMethod
    public void ensureNotifPerm(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED) {
            call.resolve();
            return;
        }
        requestPermissionForAlias("notifications", call, "notifPermDone");
    }

    @PermissionCallback
    private void notifPermDone(PluginCall call) {
        call.resolve();   // conceda o no, la app sigue (sin permiso simplemente no hay notis)
    }

    @PluginMethod
    public void notifAccess(PluginCall call) {
        boolean granted = androidx.core.app.NotificationManagerCompat
                .getEnabledListenerPackages(getContext())
                .contains(getContext().getPackageName());
        JSObject r = new JSObject();
        r.put("granted", granted);
        call.resolve(r);
    }

    @PluginMethod
    public void consumeGoto(PluginCall call) {
        // Punto 5: entrega (y limpia) el deep-link que dejó MainActivity al tocar la noti de un gasto.
        SharedPreferences sp = getContext().getSharedPreferences("micartera_goto", Context.MODE_PRIVATE);
        String g = sp.getString("pending", null);
        if (g != null) sp.edit().remove("pending").apply();
        JSObject r = new JSObject();
        if (g != null) r.put("goto", g);
        call.resolve(r);
    }

    @PluginMethod
    public void appInfo(PluginCall call) {
        try {
            PackageInfo pi = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            long code = Build.VERSION.SDK_INT >= 28 ? pi.getLongVersionCode() : pi.versionCode;
            JSObject r = new JSObject();
            r.put("versionName", pi.versionName);
            r.put("versionCode", (int) code);
            /* SEG-01: con clave pública en la APK, el actualizador solo da por buena una OTA cuyo
               checksum venga FIRMADO (y `sessionKey` no vacío); sin clave, ese mismo checksum
               firmado no casaría con el SHA-256 y la OTA fallaría. La web necesita saber cuál de
               las dos APK tiene delante: `otaKeyId` es el identificador que calcula el propio
               updater (primeros 20 caracteres de la clave), vacío si la APK no lleva clave. */
            String key = "";
            try {
                key = getBridge().getConfig().getPluginConfiguration("CapacitorUpdater").getString("publicKey", "");
            } catch (Exception ignored) {}
            String body = key == null ? "" : key.replace("-----BEGIN RSA PUBLIC KEY-----", "")
                    .replace("-----END RSA PUBLIC KEY-----", "").replaceAll("\\s+", "");
            r.put("otaKeyId", body.length() >= 20 ? body.substring(0, 20) : "");
            call.resolve(r);
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    @PluginMethod
    public void installApk(PluginCall call) {
        final String url = call.getString("url", "");
        if (url == null || url.isEmpty()) { call.reject("falta url"); return; }
        final Context ctx = getContext();
        // Android 8+: sin el permiso "instalar apps desconocidas" el instalador ni se abre.
        // Lo llevamos a su ajuste (es un toggle por app, se concede UNA vez) y la web reintenta.
        if (Build.VERSION.SDK_INT >= 26 && !ctx.getPackageManager().canRequestPackageInstalls()) {
            try {
                Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + ctx.getPackageName()));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(i);
            } catch (Exception ignored) {}
            JSObject r = new JSObject();
            r.put("ok", false);
            r.put("needsPermission", true);
            call.resolve(r);
            return;
        }
        // SEG-03: la web es la que dice qué bajar, y la web puede venir de una OTA. Sin estas
        // comprobaciones, quien colara JS en la WebView podía hacer instalar cualquier APK (otra
        // app con otro nombre de paquete no choca con la firma de Aely: Android la instala aparte).
        final String sha256 = call.getString("sha256", "");
        if (!apkUrlPermitida(url, true)) { call.reject("actualización rechazada: origen no permitido"); return; }
        if (sha256 != null && !sha256.isEmpty() && !sha256.matches("(?i)[0-9a-f]{64}")) {
            call.reject("actualización rechazada: huella no válida"); return;
        }
        // Una instalación a la vez y un fichero propio por llamada (revisión R1, 19/11/2026): con un
        // nombre fijo, una segunda llamada reescribía el APK YA verificado mientras el instalador lo
        // leía, y el sistema acababa ofreciendo instalar lo que bajó la segunda sin verificar.
        if (!INSTALANDO.compareAndSet(false, true)) {
            call.reject("actualización rechazada: ya hay una en curso"); return;
        }
        new Thread(() -> {
            File dir = new File(ctx.getCacheDir(), "updates");
            //noinspection ResultOfMethodCallIgnored
            dir.mkdirs();
            limpiarApksViejos(dir);
            File apk = new File(dir, "aely-" + java.util.UUID.randomUUID() + ".apk");
            try {
                String bajada = descargarApk(url, apk);
                if (sha256 != null && !sha256.isEmpty() && !sha256.equalsIgnoreCase(bajada)) {
                    throw new SecurityException("la huella no coincide con la publicada");
                }
                verificarApk(ctx, apk);
                Uri uri = androidx.core.content.FileProvider.getUriForFile(
                        ctx, ctx.getPackageName() + ".fileprovider", apk);
                Intent install = new Intent(Intent.ACTION_VIEW);
                install.setDataAndType(uri, "application/vnd.android.package-archive");
                install.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                ctx.startActivity(install);
                JSObject r = new JSObject();
                r.put("ok", true);
                call.resolve(r);
            } catch (SecurityException e) {
                //noinspection ResultOfMethodCallIgnored
                apk.delete();   // un APK que no pasa la verificación no se queda a mano en la caché
                call.reject("actualización rechazada: " + e.getMessage());
            } catch (Exception e) {
                //noinspection ResultOfMethodCallIgnored
                apk.delete();
                call.reject("descarga falló: " + e.getMessage());
            } finally {
                INSTALANDO.set(false);
            }
        }).start();
    }

    private static final java.util.concurrent.atomic.AtomicBoolean INSTALANDO =
            new java.util.concurrent.atomic.AtomicBoolean(false);

    /* Cada llamada deja su APK (el instalador lo lee DESPUÉS de resolver, así que no se puede
       borrar al acabar). Se recogen los de otras veces con margen de sobra para que el instalador
       haya terminado con ellos; incluye el `mi-cartera-update.apk` de las APK anteriores. */
    private static void limpiarApksViejos(File dir) {
        File[] fs = dir.listFiles();
        if (fs == null) return;
        long corte = System.currentTimeMillis() - 30L * 60 * 1000;
        for (File f : fs) {
            //noinspection ResultOfMethodCallIgnored
            if (f.isFile() && f.lastModified() < corte) f.delete();
        }
    }

    /* Dónde puede vivir un APK de Aely: los releases de GitHub del dueño (`apk.json` siempre
       apunta ahí) y el CDN al que GitHub redirige la descarga. Se fija el dueño y no el nombre
       del repo: renombrar el repo ya rompió una vez las actualizaciones (Pages no redirige) y
       GitHub sí redirige los releases de un repo renombrado del mismo dueño. */
    private static final String APK_OWNER_PATH = "/JuanjoAvila/";
    private static final long APK_MAX_BYTES = 200L * 1024 * 1024;

    static boolean apkUrlPermitida(String raw, boolean inicial) {
        try {
            URL u = new URL(raw);
            if (!"https".equals(u.getProtocol()) || u.getUserInfo() != null) return false;
            if (u.getPort() != -1 && u.getPort() != 443) return false;
            String h = u.getHost() == null ? "" : u.getHost().toLowerCase(java.util.Locale.ROOT);
            if (h.equals("github.com")) {
                // Ruta EXACTA y sin escapes (revisión R1, 19/11/2026): java.net.URL no resuelve
                // los .. pero GitHub sí, así que /JuanjoAvila/../otro/x/releases/download/… bajaba
                // el release de OTRO dueño con el filtro de prefijo de antes (comprobado con curl).
                String p = u.getPath() == null ? "" : u.getPath();
                if (p.indexOf('%') >= 0 || p.indexOf('\\') >= 0) return false;
                String[] s = p.split("/", -1);
                if (s.length != 7 || !s[0].isEmpty() || !APK_OWNER_PATH.equals("/" + s[1] + "/")
                        || !"releases".equals(s[3]) || !"download".equals(s[4])) return false;
                for (int i = 1; i < s.length; i++) {
                    if (s[i].isEmpty() || s[i].equals(".") || s[i].equals("..")) return false;
                }
                return s[2].matches("[A-Za-z0-9._-]+");
            }
            // El primer salto siempre es github.com; el CDN solo vale como destino de su redirección.
            return !inicial && h.endsWith(".githubusercontent.com");
        } catch (Exception e) {
            return false;
        }
    }

    /** Baja siguiendo las redirecciones A MANO (cada salto se comprueba) y devuelve su SHA-256. */
    private static String descargarApk(String url, File dest) throws Exception {
        String actual = url;
        for (int salto = 0; salto < 6; salto++) {
            if (!apkUrlPermitida(actual, salto == 0)) throw new SecurityException("origen no permitido");
            HttpURLConnection conn = (HttpURLConnection) new URL(actual).openConnection();
            conn.setConnectTimeout(20000);
            conn.setReadTimeout(120000);
            conn.setInstanceFollowRedirects(false);
            try {
                int code = conn.getResponseCode();
                if (code >= 300 && code < 400) {
                    String loc = conn.getHeaderField("Location");
                    if (loc == null || loc.isEmpty()) throw new java.io.IOException("redirección sin destino");
                    actual = new URL(new URL(actual), loc).toString();
                    continue;
                }
                if (code != 200) throw new java.io.IOException("HTTP " + code);
                java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
                long total = 0;
                try (InputStream in = conn.getInputStream(); FileOutputStream out = new FileOutputStream(dest)) {
                    byte[] buf = new byte[65536];
                    int n;
                    while ((n = in.read(buf)) != -1) {
                        total += n;
                        if (total > APK_MAX_BYTES) throw new SecurityException("demasiado grande");
                        md.update(buf, 0, n);
                        out.write(buf, 0, n);
                    }
                }
                StringBuilder hex = new StringBuilder();
                for (byte b : md.digest()) hex.append(String.format(java.util.Locale.ROOT, "%02x", b & 0xff));
                return hex.toString();
            } finally {
                conn.disconnect();
            }
        }
        throw new java.io.IOException("demasiadas redirecciones");
    }

    /* El APK tiene que ser ESTA app: mismo nombre de paquete y, si Android deja leer la firma del
       fichero, al menos un certificado en común con la instalada (tolera una rotación de llave).
       Si la firma del fichero no se puede leer (algunos Android 9-12 devuelven `signingInfo` nulo
       para un archivo suelto) se sigue: el instalador del sistema ya rechaza un mismo paquete con
       otra llave. Lo que no se deja pasar nunca es otro paquete, que el sistema sí instalaría. */
    @SuppressWarnings("deprecation")
    private static void verificarApk(Context ctx, File apk) throws Exception {
        android.content.pm.PackageManager pm = ctx.getPackageManager();
        PackageInfo nueva = pm.getPackageArchiveInfo(apk.getPath(), 0);
        if (nueva == null || !ctx.getPackageName().equals(nueva.packageName)) {
            throw new SecurityException("no es una actualización de Aely");
        }
        java.util.Set<String> deFichero = firmas(pm.getPackageArchiveInfo(apk.getPath(), flagsFirma()));
        if (deFichero.isEmpty() && Build.VERSION.SDK_INT >= 28) {
            deFichero = firmas(pm.getPackageArchiveInfo(apk.getPath(), android.content.pm.PackageManager.GET_SIGNATURES));
        }
        if (deFichero.isEmpty()) return;
        java.util.Set<String> instalada = firmas(pm.getPackageInfo(ctx.getPackageName(), flagsFirma()));
        if (instalada.isEmpty()) return;
        deFichero.retainAll(instalada);
        if (deFichero.isEmpty()) throw new SecurityException("firmada con otra llave");
    }

    @SuppressWarnings("deprecation")
    private static int flagsFirma() {
        return Build.VERSION.SDK_INT >= 28
                ? android.content.pm.PackageManager.GET_SIGNING_CERTIFICATES
                : android.content.pm.PackageManager.GET_SIGNATURES;
    }

    @SuppressWarnings("deprecation")
    private static java.util.Set<String> firmas(PackageInfo pi) {
        java.util.Set<String> out = new java.util.HashSet<>();
        if (pi == null) return out;
        android.content.pm.Signature[] sigs = null;
        if (Build.VERSION.SDK_INT >= 28 && pi.signingInfo != null) {
            sigs = pi.signingInfo.hasMultipleSigners()
                    ? pi.signingInfo.getApkContentsSigners()
                    : pi.signingInfo.getSigningCertificateHistory();
        }
        if (sigs == null || sigs.length == 0) sigs = pi.signatures;
        if (sigs == null) return out;
        for (android.content.pm.Signature s : sigs) {
            try {
                byte[] d = java.security.MessageDigest.getInstance("SHA-256").digest(s.toByteArray());
                StringBuilder hex = new StringBuilder();
                for (byte b : d) hex.append(String.format(java.util.Locale.ROOT, "%02x", b & 0xff));
                out.add(hex.toString());
            } catch (Exception ignored) {}
        }
        return out;
    }

    @PluginMethod
    public void syncOtaState(PluginCall call) {
        // Alinea la versión web (tras OTA) con el worker en background y evita doble aviso.
        SharedPreferences sp = getContext().getSharedPreferences(OtaCheckWorker.PREFS, Context.MODE_PRIVATE);
        SharedPreferences.Editor ed = sp.edit();
        String ver = call.getString("version");
        if (ver != null && !ver.isEmpty()) ed.putString(OtaCheckWorker.KEY_CURRENT, ver);
        // El canal (estable/beta) lo sabe la web; sin él, el worker miraba siempre producción y en
        // un móvil en beta avisaba de una versión que no le tocaba, además de la de la propia app.
        String chan = call.getString("channel");
        if (chan != null && !chan.isEmpty()) ed.putString(OtaCheckWorker.KEY_CHANNEL, chan);
        String mark = call.getString("markNotifiedVer");
        if (mark != null && !mark.isEmpty()) ed.putString(OtaCheckWorker.KEY_BG_NOTIFIED, mark);
        String markApk = call.getString("markNotifiedApk");
        if (markApk != null && !markApk.isEmpty()) ed.putString(OtaCheckWorker.KEY_BG_APK, markApk);
        ed.apply();
        JSObject r = new JSObject();
        String bg = sp.getString(OtaCheckWorker.KEY_BG_NOTIFIED, null);
        String bgApk = sp.getString(OtaCheckWorker.KEY_BG_APK, null);
        if (bg != null) r.put("bgNotifiedVer", bg);
        if (bgApk != null) r.put("bgNotifiedApk", bgApk);
        call.resolve(r);
    }

    @PluginMethod
    public void setNotifPrefs(PluginCall call) {
        Boolean confirm = call.getBoolean("expenseConfirm", true);
        getContext().getSharedPreferences("micartera_notifprefs", Context.MODE_PRIVATE)
                .edit().putBoolean("expenseConfirm", confirm == null || confirm).apply();
        // Toggle «Al detectar aviso del banco, sincronizar» (alpha22). Defecto ON.
        if (call.getData() != null && call.getData().has("bankSyncOnNotif")) {
            Boolean on = call.getBoolean("bankSyncOnNotif", true);
            getContext().getSharedPreferences("micartera_banksync", Context.MODE_PRIVATE)
                    .edit().putBoolean("onNotif", on == null || on).apply();
        }
        call.resolve();
    }

    /** Si el listener de notis dejó un ping con la app en frío, la web lo consume al primer plano. */
    @PluginMethod
    public void consumeBankSyncPing(PluginCall call) {
        SharedPreferences sp = getContext().getSharedPreferences("micartera_banksync", Context.MODE_PRIVATE);
        boolean pending = sp.getBoolean("pending", false);
        if (pending) sp.edit().putBoolean("pending", false).apply();
        JSObject r = new JSObject();
        r.put("ping", pending);
        call.resolve(r);
    }

    // Calendario de recibos del mes → notis «la víspera» con la app cerrada (AlertCheckWorker).
    // La web lo empuja al abrir/cambiar datos; aquí se guarda, se re-arma el worker y se hace
    // una pasada inmediata (por si YA es la víspera de algo). Intercambio de sellos anti-doble:
    // entra `fired` (lo que la web ya avisó) y sale `fired` (lo que avisó el nativo).
    @PluginMethod
    public void setAlertData(PluginCall call) {
        try {
            String ym = call.getString("ym", "");
            SharedPreferences sp = getContext().getSharedPreferences(AlertCheckWorker.PREFS, Context.MODE_PRIVATE);
            SharedPreferences.Editor ed = sp.edit();
            org.json.JSONObject cal = new org.json.JSONObject();
            cal.put("ym", ym);
            org.json.JSONArray charges = call.getArray("charges") != null
                    ? new org.json.JSONArray(call.getArray("charges").toString())
                    : new org.json.JSONArray();
            cal.put("charges", charges);
            ed.putString(AlertCheckWorker.KEY_CAL, cal.toString());
            // sellos de la web → prefs nativas (no re-avisar lo que la web ya avisó)
            com.getcapacitor.JSArray fired = call.getArray("fired");
            if (fired != null) {
                for (int i = 0; i < fired.length(); i++) {
                    String id = String.valueOf(fired.get(i));
                    if (!id.isEmpty()) ed.putBoolean("rc_" + id + "_" + ym, true);
                }
            }
            ed.apply();
            AlertCheckScheduler.ensure(getContext());
            AlertCheckWorker.check(getContext());
            // sellos nativos → web (para que selle su localStorage)
            com.getcapacitor.JSArray out = new com.getcapacitor.JSArray();
            for (int i = 0; i < charges.length(); i++) {
                org.json.JSONObject c = charges.optJSONObject(i);
                if (c == null) continue;
                String id = c.optString("id", "");
                if (!id.isEmpty() && sp.getBoolean("rc_" + id + "_" + ym, false)) out.put(id);
            }
            JSObject r = new JSObject();
            r.put("fired", out);
            call.resolve(r);
        } catch (Exception e) {
            call.resolve(new JSObject());   // best-effort: un calendario que falla no rompe nada
        }
    }

    // Multiusuario del lector de gastos TR (migración 0008): la web guarda aquí la URL de
    // `ingest` con el token del usuario logueado. TrExpenseListener la lee de estas prefs (el
    // fallback a BuildConfig.INGEST_URL solo existe en la APK de depuración, 14/9). Así cada
    // persona apunta sus gastos de Trade Republic en SU propia cuenta. url vacía = desactivar.
    @PluginMethod
    public void setIngestUrl(PluginCall call) {
        String url = call.getString("url", "");
        if (url == null) url = "";
        // SEG-03: el lector manda a esta URL el texto de cada pago que ve. Si la web pudiera
        // apuntarla a cualquier sitio, un JS colado se llevaría las compras de la familia. Una
        // URL rara se rechaza y se queda la que había (la buena la reenvía la web al arrancar).
        if (!url.isEmpty() && !ingestUrlPermitida(url)) { call.reject("url de ingest no permitida"); return; }
        getContext().getSharedPreferences("micartera_ingest", Context.MODE_PRIVATE)
                .edit().putString("url", url).apply();
        call.resolve();
    }

    /* El proyecto de Supabase es el mismo que lleva la web (`CONFIG.SUPABASE_URL`, público). Fijo
       aquí: mudar de proyecto exige APK nueva, igual que ya lo exige el resto del puente. */
    static final String INGEST_HOST = "sfyfjagbnhbplrljpbvh.supabase.co";

    static boolean ingestUrlPermitida(String raw) {
        try {
            URL u = new URL(raw);
            return "https".equals(u.getProtocol()) && u.getUserInfo() == null
                    && (u.getPort() == -1 || u.getPort() == 443)
                    && INGEST_HOST.equalsIgnoreCase(u.getHost())
                    && "/functions/v1/ingest".equals(u.getPath());
        } catch (Exception e) {
            return false;
        }
    }

    /* Informe del mes (19/11/2026): la web manda el PNG en base64 y aquí se guarda en Descargas
     * (FileSaver) y se avisa con una notificación que, al tocarla, abre el fichero. `body` puede
     * llevar `{f}`, que se cambia por el nombre REAL (MediaStore renombra si ya existe). */
    @PluginMethod
    public void saveToDownloads(PluginCall call) {
        final String name = FileSaver.safeName(call.getString("name"), "aely.bin");
        final String mime = call.getString("mime", "application/octet-stream");
        final String data = FileSaver.stripDataUrl(call.getString("data"));
        final String title = call.getString("title", "Aely");
        final String body = call.getString("body", "{f}");
        if (data.isEmpty()) { call.reject("sin datos"); return; }
        final Context ctx = getContext();
        new Thread(() -> {
            try {
                byte[] bytes = android.util.Base64.decode(data, android.util.Base64.DEFAULT);
                if (bytes.length == 0) { call.reject("sin datos"); return; }
                FileSaver.Saved saved = FileSaver.save(ctx, name, mime, bytes);
                Notif.showFile(ctx, title, body.replace("{f}", saved.name),
                        Notif.idFor("file|" + saved.name), saved.uri, mime);
                JSObject r = new JSObject();
                r.put("ok", true);
                r.put("uri", saved.uri.toString());
                r.put("name", saved.name);
                r.put("inDownloads", saved.inDownloads);
                call.resolve(r);
            } catch (Exception e) {
                call.reject("guardar falló: " + e.getMessage());
            }
        }).start();
    }

    @PluginMethod
    public void openNotifAccess(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }
}
