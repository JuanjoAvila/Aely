package com.micartera.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/**
 * Notificaciones locales de Aely (un solo canal). Las usa tanto el plugin
 * (avisos de la web: presupuesto superado, etc.) como el lector de notis de TR
 * (confirmación "✓ gasto apuntado" aunque la app esté cerrada).
 * En Android 13+ hace falta el permiso POST_NOTIFICATIONS (lo pide la app al abrirse);
 * sin él, el sistema descarta la notificación en silencio — no rompe nada.
 */
class Notif {
    static final String CHANNEL = "micartera";

    /* IDS ESTABLES POR PROPÓSITO. Android reemplaza una notificación solo si repites su id; con un
     * id nuevo cada vez, cada aviso se APILA. Y eso es justo lo que hacían las dos rutas que
     * llegan aquí: `(int)(System.currentTimeMillis() % 100000)`. Resultado, feedback del
     * 2026-07-26: «las notis se duplican». Peor aún con las de actualización, porque hay DOS
     * emisores para lo mismo —el worker de fondo (OtaCheckWorker) y la web cuando la app está
     * abierta— y cada uno ponía la suya. Ahora comparten id: el segundo aviso sustituye al
     * primero en vez de sumarse. */
    static final int ID_UPDATE_OTA = 71001;
    static final int ID_UPDATE_APK = 71002;

    /** Id estable a partir de una etiqueta ("mc-update-4.11.0.8", "exp|12.34|Mercadona"…). */
    static int idFor(String tag) {
        if (tag == null || tag.isEmpty()) return 70000;
        if (tag.startsWith("update|ota") || tag.startsWith("mc-update")) return ID_UPDATE_OTA;
        if (tag.startsWith("update|apk")) return ID_UPDATE_APK;
        // Rango propio (10000-69999) para que nunca choque con los ids fijos de arriba.
        return 10000 + Math.abs(tag.hashCode() % 60000);
    }

    private static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = ctx.getSystemService(NotificationManager.class);
            if (nm != null && nm.getNotificationChannel(CHANNEL) == null) {
                NotificationChannel ch = new NotificationChannel(
                        CHANNEL, "Aely · avisos", NotificationManager.IMPORTANCE_DEFAULT);
                ch.setDescription("Gastos capturados y avisos de presupuesto");
                nm.createNotificationChannel(ch);
            }
        }
    }

    static void show(Context ctx, String title, String body, int id) {
        show(ctx, title, body, id, null);
    }

    /** Igual que show(...), pero la notificación lleva un deep-link: al tocarla, la web salta a la
     *  ficha del gasto (punto 5). gotoTarget viaja como extra "mc_goto" (p.ej. "exp|12.34|Mercadona");
     *  MainActivity lo guarda y MiCartera.consumeGoto() lo entrega a la web. null = abre el inicio. */
    static void show(Context ctx, String title, String body, int id, String gotoTarget) {
        try {
            ensureChannel(ctx);
            Intent open = new Intent(ctx, MainActivity.class);
            open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            if (gotoTarget != null && !gotoTarget.isEmpty()) open.putExtra("mc_goto", gotoTarget);
            // requestCode = id (único por noti) → cada PendingIntent es distinto y sus extras no se pisan.
            PendingIntent pi = PendingIntent.getActivity(ctx, id, open,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            Notification.Builder b = Build.VERSION.SDK_INT >= 26
                    ? new Notification.Builder(ctx, CHANNEL)
                    : new Notification.Builder(ctx);
            b.setContentTitle(title)
                    .setContentText(body)
                    .setStyle(new Notification.BigTextStyle().bigText(body))
                    .setSmallIcon(R.drawable.ic_stat_micartera)
                    .setAutoCancel(true)
                    .setContentIntent(pi);

            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.notify(id, b.build());
        } catch (Exception ignored) {
            // best-effort: una noti que falla nunca debe tumbar el listener ni el plugin
        }
    }
}
