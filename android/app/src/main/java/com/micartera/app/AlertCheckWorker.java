package com.micartera.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.NumberFormat;
import java.util.Calendar;
import java.util.Locale;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

/**
 * Avisos de recibos LA VÍSPERA con la app CERRADA (petición 2026-07-18: «como los updates»).
 * La web empuja el calendario del mes (fijos + cuotas de deuda) vía MiCartera.setAlertData;
 * este worker mira si MAÑANA toca algún cargo y lanza la noti local. Dedupe por cargo y mes
 * en prefs (rc_<id>_<ym>) — la web sella los suyos por el mismo canal para no avisar dos veces.
 * (Los avisos de presupuesto en frío NO van aquí: los calcula la Edge `ingest` al capturar el
 * gasto de TR y los pinta TrExpenseListener — así saltan al momento, no en la siguiente pasada.)
 */
public class AlertCheckWorker extends Worker {
    static final String PREFS = "micartera_alerts";
    static final String KEY_CAL = "cal";
    private static final int NOTIF_BASE = 72000;

    public AlertCheckWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        try {
            check(getApplicationContext());
            return Result.success();
        } catch (Exception e) {
            Log.w("MiCartera", "AlertCheckWorker: " + e.getMessage());
            return Result.success();   // el calendario es local; no hay nada que reintentar
        }
    }

    /** Compartido con el plugin (que lo invoca tras cada push de calendario, por si ya es la víspera). */
    static void check(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String raw = sp.getString(KEY_CAL, "");
        if (raw == null || raw.isEmpty()) return;
        try {
            JSONObject cal = new JSONObject(raw);
            String ym = cal.optString("ym", "");
            JSONArray charges = cal.optJSONArray("charges");
            if (ym.isEmpty() || charges == null) return;

            Calendar today = Calendar.getInstance();
            String todayDate = String.format(Locale.ROOT, "%04d-%02d-%02d", today.get(Calendar.YEAR),
                    today.get(Calendar.MONTH) + 1, today.get(Calendar.DAY_OF_MONTH));
            Calendar tomorrow = (Calendar) today.clone();
            tomorrow.add(Calendar.DAY_OF_MONTH, 1);
            String tomYm = String.format(Locale.ROOT, "%04d-%02d",
                    tomorrow.get(Calendar.YEAR), tomorrow.get(Calendar.MONTH) + 1);
            // El calendario es del MES en curso: si mañana ya es otro mes, la web lo refresca
            // en la próxima apertura — no inventamos cargos del mes siguiente.
            if (!tomYm.equals(ym)) return;
            int tomDom = tomorrow.get(Calendar.DAY_OF_MONTH);

            for (int i = 0; i < charges.length(); i++) {
                JSONObject c = charges.optJSONObject(i);
                if (c == null) continue;
                if (c.optInt("day", -1) != tomDom) continue;
                String id = c.optString("id", "");
                if (id.isEmpty()) continue;
                String key = "rc_" + id + "_" + ym;
                if (sp.getBoolean(key, false)) continue;
                sp.edit().putBoolean(key, true).apply();
                String name = c.optString("name", "Recibo");
                double amt = c.optDouble("amount", 0);
                String title = "Mañana toca recibo";
                String body = name + ": mañana se cobran " + eur(amt) + ". Si algo no cuadra, aún estás a tiempo.";
                JSONObject optional = c.optJSONObject("balanceNotice");
                if (optional != null) {
                    Map<String, Object> notice = new HashMap<>();
                    for (Iterator<String> keys = optional.keys(); keys.hasNext();) {
                        String field = keys.next();
                        notice.put(field, optional.opt(field));
                    }
                    String[] rendered = ReceiptBalanceNotice.render(notice, todayDate,
                            tomYm + "-" + String.format(Locale.ROOT, "%02d", tomDom), ym, tomDom, name, amt);
                    if (rendered != null) { title = rendered[0]; body = rendered[1]; }
                }
                Notif.show(ctx, title, body, NOTIF_BASE + (Math.abs(id.hashCode()) % 900));
            }
        } catch (Exception e) {
            Log.w("MiCartera", "AlertCheck.check: " + e.getMessage());
        }
    }

    private static String eur(double n) {
        NumberFormat nf = NumberFormat.getInstance(new Locale("es", "ES"));
        nf.setMinimumFractionDigits(2);
        nf.setMaximumFractionDigits(2);
        return nf.format(n) + " €";
    }
}
