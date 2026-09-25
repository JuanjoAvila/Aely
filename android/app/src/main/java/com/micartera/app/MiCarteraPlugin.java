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
 *   - installApk({url})       -> descarga el APK nuevo y abre el instalador del sistema
 *                                (actualización SIN cable; instala encima, mantiene datos).
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
    public void updateWidget(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences.Editor ed = ctx.getSharedPreferences(MiCarteraWidget.PREFS, Context.MODE_PRIVATE).edit();
        Double spent = call.getDouble("spent");
        Double budget = call.getDouble("budget");
        Double cash = call.getDouble("cash");
        // Las DOS piezas de «lo que te puedes permitir», por separado: lo que deja el presupuesto
        // y la liquidez segura de la cuenta de gasto. Antes se mandaba ya combinado (`afford`) y
        // el lector de notis no sabía rehacerlo con la app cerrada → el widget se contradecía
        // (2026-08-17). Ahora las combina `MiCarteraWidget.build()`, que es el único sitio donde
        // vive la fórmula. `safeLiq` sale de simular el mes día a día: eso solo lo sabe la app.
        Double budgetLeft = call.getDouble("budgetLeft");
        Double safeLiq = call.getDouble("safeLiq");
        ed.putFloat("spent", spent != null ? spent.floatValue() : 0f);
        ed.putFloat("budget", budget != null ? budget.floatValue() : 0f);
        if (cash != null) ed.putFloat("cash", cash.floatValue()); else ed.remove("cash");
        if (budgetLeft != null) ed.putFloat("budgetLeft", budgetLeft.floatValue()); else ed.remove("budgetLeft");
        if (safeLiq != null) ed.putFloat("safeLiq", safeLiq.floatValue()); else ed.remove("safeLiq");
        ed.remove("afford");   // resto de la versión anterior: ya no se lee, que no quede basura
        String label = call.getString("cashLabel");
        ed.putString("cashLabel", label != null ? label : "");
        ed.putLong("updated", System.currentTimeMillis());
        ed.apply();
        MiCarteraWidget.refreshAll(ctx);
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
        new Thread(() -> {
            try {
                File dir = new File(ctx.getCacheDir(), "updates");
                //noinspection ResultOfMethodCallIgnored
                dir.mkdirs();
                File apk = new File(dir, "mi-cartera-update.apk");
                HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setConnectTimeout(20000);
                conn.setReadTimeout(120000);
                conn.setInstanceFollowRedirects(true);   // GitHub Releases redirige al CDN
                try (InputStream in = conn.getInputStream(); FileOutputStream out = new FileOutputStream(apk)) {
                    byte[] buf = new byte[65536];
                    int n;
                    while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
                }
                conn.disconnect();
                Uri uri = androidx.core.content.FileProvider.getUriForFile(
                        ctx, ctx.getPackageName() + ".fileprovider", apk);
                Intent install = new Intent(Intent.ACTION_VIEW);
                install.setDataAndType(uri, "application/vnd.android.package-archive");
                install.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                ctx.startActivity(install);
                JSObject r = new JSObject();
                r.put("ok", true);
                call.resolve(r);
            } catch (Exception e) {
                call.reject("descarga falló: " + e.getMessage());
            }
        }).start();
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
        getContext().getSharedPreferences("micartera_ingest", Context.MODE_PRIVATE)
                .edit().putString("url", url != null ? url : "").apply();
        call.resolve();
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
