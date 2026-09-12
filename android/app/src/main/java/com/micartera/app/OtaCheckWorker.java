package com.micartera.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Mira version.json / apk.json en GitHub Pages con la app cerrada y avisa con noti local.
 * No descarga el bundle (eso lo hace el JS al abrir / al tocar la noti); solo avisa.
 */
public class OtaCheckWorker extends Worker {
    static final String PREFS = "micartera_ota";
    static final String KEY_CURRENT = "current_ver";
    static final String KEY_BG_NOTIFIED = "bg_notified_ver";
    static final String KEY_BG_APK = "bg_notified_apk";
    static final String KEY_CHANNEL = "channel";
    private static final String BASE = "https://juanjoavila.github.io/Aely/";
    /* EL VIGILANTE DE FONDO TAMBIÉN TIENE CANAL. Miraba SIEMPRE producción, así que en un móvil en
     * beta avisaba de una versión que no le toca —y a la vez la app abierta avisaba de la suya: dos
     * notificaciones para lo mismo, con números distintos («las notis se duplican», 2026-07-26).
     * El canal lo manda la web en `syncOtaState`, que es quien lo sabe (vive en su localStorage). */
    private static final String BASE_BETA = "https://github.com/JuanjoAvila/Aely/releases/download/beta/";
    // Compartidos con las notis que lanza la web (Notif.idFor): el aviso de «hay versión nueva» es
    // UNO, lo emita el worker con la app cerrada o la propia app abierta. Antes eran dos ids
    // distintos y salían las dos a la vez («las notis se duplican», 2026-07-26).
    private static final int NOTIF_OTA = Notif.ID_UPDATE_OTA;
    private static final int NOTIF_APK = Notif.ID_UPDATE_APK;

    public OtaCheckWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try {
            String current = sp.getString(KEY_CURRENT, null);
            if (current == null || current.isEmpty()) current = BuildConfig.VERSION_NAME;
            // Mismo canal que la app: si el móvil está en beta, el aviso sale de la beta o no sale.
            boolean beta = "beta".equals(sp.getString(KEY_CHANNEL, "stable"));
            String base = beta ? BASE_BETA : BASE;

            JSONObject verJson = fetchJson(base + "version.json?ts=" + System.currentTimeMillis());
            if (verJson != null) {
                String remote = verJson.optString("version", "");
                if (!remote.isEmpty() && newer(remote, current)) {
                    String already = sp.getString(KEY_BG_NOTIFIED, "");
                    if (!remote.equals(already)) {
                        Notif.show(ctx, "Aely",
                                "Hay una actualización (v" + remote + ") lista. Toca para instalarla.",
                                NOTIF_OTA, "update|ota");
                        sp.edit().putString(KEY_BG_NOTIFIED, remote).apply();
                    }
                }
            }

            // La APK SÍ se publica por canal desde el 2026-07-26: la release `beta` lleva ya su
            // propio apk.json. Antes solo llevaba el bundle web, así que este aviso salía siempre
            // de producción — y con la APK de pruebas 35 publicada, un móvil en beta seguía
            // comparándose contra la 34 de todos y no se enteraba nunca de que había algo nuevo.
            // Se cae a producción si la beta aún no ha publicado el suyo (mismo criterio que la web).
            JSONObject apkJson = beta ? fetchJson(BASE_BETA + "apk.json?ts=" + System.currentTimeMillis()) : null;
            if (apkJson == null) apkJson = fetchJson(BASE + "apk.json?ts=" + System.currentTimeMillis());
            if (apkJson != null) {
                int remoteCode = apkJson.optInt("versionCode", 0);
                if (remoteCode > BuildConfig.VERSION_CODE) {
                    String vn = apkJson.optString("versionName", "v" + remoteCode);
                    String alreadyApk = sp.getString(KEY_BG_APK, "");
                    if (!vn.equals(alreadyApk)) {
                        Notif.show(ctx, "Aely",
                                "Hay una app nueva (v" + vn + "). Toca el botón de arriba para instalarla.",
                                NOTIF_APK, "update|apk");
                        sp.edit().putString(KEY_BG_APK, vn).apply();
                    }
                }
            }
            return Result.success();
        } catch (Exception e) {
            Log.w("MiCartera", "OtaCheckWorker: " + e.getMessage());
            // Red flaky: reintento de WorkManager; no marcar fallo duro.
            return Result.retry();
        }
    }

    /** Misma regla que window._mcNewerVer en 12-boot.js. */
    static boolean newer(String a, String b) {
        String[] aa = String.valueOf(a).split("\\.");
        String[] bb = String.valueOf(b).split("\\.");
        int n = Math.max(aa.length, bb.length);
        for (int i = 0; i < n; i++) {
            int x = i < aa.length ? parsePart(aa[i]) : 0;
            int y = i < bb.length ? parsePart(bb[i]) : 0;
            if (x != y) return x > y;
        }
        return false;
    }

    private static int parsePart(String s) {
        try {
            String digits = s.replaceAll("[^0-9].*$", "");
            if (digits.isEmpty()) return 0;
            return Integer.parseInt(digits);
        } catch (Exception e) {
            return 0;
        }
    }

    private static JSONObject fetchJson(String urlStr) throws Exception {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(urlStr);
            conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(12000);
            conn.setReadTimeout(12000);
            conn.setRequestProperty("Cache-Control", "no-cache");
            conn.setRequestProperty("Accept", "application/json");
            int code = conn.getResponseCode();
            if (code < 200 || code >= 300) return null;
            InputStream in = conn.getInputStream();
            BufferedReader br = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = br.readLine()) != null) sb.append(line);
            br.close();
            return new JSONObject(sb.toString());
        } finally {
            if (conn != null) conn.disconnect();
        }
    }
}
