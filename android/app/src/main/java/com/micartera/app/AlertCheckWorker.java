package com.micartera.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.Calendar;
import java.util.Locale;

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

            Calendar tomorrow = Calendar.getInstance();
            String today = String.format(Locale.ROOT, "%04d-%02d-%02d",
                    tomorrow.get(Calendar.YEAR), tomorrow.get(Calendar.MONTH) + 1,
                    tomorrow.get(Calendar.DAY_OF_MONTH));
            tomorrow.add(Calendar.DAY_OF_MONTH, 1);
            String tomYm = String.format(Locale.ROOT, "%04d-%02d",
                    tomorrow.get(Calendar.YEAR), tomorrow.get(Calendar.MONTH) + 1);
            // El calendario es del MES en curso: si mañana ya es otro mes, la web lo refresca
            // en la próxima apertura — no inventamos cargos del mes siguiente.
            if (!tomYm.equals(ym)) return;
            int tomDom = tomorrow.get(Calendar.DAY_OF_MONTH);
            String dueOn = String.format(Locale.ROOT, "%s-%02d", tomYm, tomDom);

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
                String[] eve = eveText(c, today, dueOn);
                Notif.show(ctx, eve != null ? eve[0] : "Mañana toca recibo",
                        eve != null ? eve[1] : name + ": mañana se cobran " + eur(amt) + ". Si algo no cuadra, aún estás a tiempo.",
                        NOTIF_BASE + (Math.abs(id.hashCode()) % 900));
            }
        } catch (Exception e) {
            Log.w("MiCartera", "AlertCheck.check: " + e.getMessage());
        }
    }

    // La app decide la cobertura y el idioma: en frío solo vale el texto calculado HOY
    // para este vencimiento. Un calendario anterior conserva el aviso sin afirmar saldo.
    private static String[] eveText(JSONObject charge, String today, String dueOn) {
        try {
            Object raw = charge.opt("eve");
            if (!(raw instanceof JSONObject)) return null;
            JSONObject eve = (JSONObject) raw;
            Object version = eve.opt("v");
            if (!(version instanceof Number)
                    || new BigDecimal(version.toString()).compareTo(BigDecimal.ONE) != 0) return null;
            Object title = eve.opt("title"), body = eve.opt("body");
            if (!singleLine(title) || !singleLine(body)) return null;
            Object coverage = eve.opt("coverage");
            if (!(coverage instanceof String)) return null;
            if (!"enough".equals(coverage) && !"short".equals(coverage) && !"unknown".equals(coverage)) return null;
            Object calculatedOn = eve.opt("calculatedOn"), chargeDueOn = eve.opt("dueOn");
            if (!(calculatedOn instanceof String) || !(chargeDueOn instanceof String)) return null;
            if (!today.equals(calculatedOn) || !dueOn.equals(chargeDueOn)) return null;
            return new String[]{(String) title, (String) body};
        } catch (Exception ignored) {
            // Un campo opcional defectuoso no debe impedir los avisos de los demás cargos.
            return null;
        }
    }

    private static boolean singleLine(Object value) {
        if (!(value instanceof String)) return false;
        String text = (String) value;
        boolean content = false;
        for (int i = 0; i < text.length();) {
            int cp = text.codePointAt(i);
            i += Character.charCount(cp);
            if (cp == '\n' || cp == '\r' || cp == 0x0b || cp == 0x0c
                    || cp == 0x85 || cp == 0x2028 || cp == 0x2029) return false;
            if (!Character.isWhitespace(cp) && !Character.isSpaceChar(cp)) content = true;
        }
        return content;
    }

    private static String eur(double n) {
        NumberFormat nf = NumberFormat.getInstance(new Locale("es", "ES"));
        nf.setMinimumFractionDigits(2);
        nf.setMaximumFractionDigits(2);
        return nf.format(n) + " €";
    }
}
