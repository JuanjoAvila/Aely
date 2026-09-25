package com.micartera.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.view.View;
import android.widget.RemoteViews;

import java.text.NumberFormat;
import java.util.Calendar;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Widget de pantalla de inicio: gasto del mes vs presupuesto + saldo de la cuenta
 * de gasto diario. Los datos NO se calculan aquí: los empuja la web vía el plugin
 * (updateWidget) cada vez que cambian, y el lector de notis de TR actualiza el
 * gasto del mes con la respuesta de `ingest` aunque la app esté cerrada.
 * Tocar el widget abre la app.
 */
public class MiCarteraWidget extends AppWidgetProvider {

    static final String PREFS = "micartera_widget";
    private static final int MINT = Color.parseColor("#5FD08A");
    private static final int CORAL = Color.parseColor("#F28B82");
    private static final int MUTED = Color.parseColor("#9FB3A8");

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) mgr.updateAppWidget(id, build(ctx));
    }

    /** Re-pinta todas las instancias del widget (si el usuario lo tiene puesto). */
    static void refreshAll(Context ctx) {
        try {
            AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
            int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, MiCarteraWidget.class));
            if (ids != null && ids.length > 0) mgr.updateAppWidget(ids, build(ctx));
        } catch (Exception ignored) {}
    }

    /**
     * Lo llama el lector de notis (TR / Google Wallet) con lo que devuelve `ingest`, con la app
     * CERRADA.
     *
     * EL WIDGET SE CONTRADECÍA A SÍ MISMO (bug 2026-08-17, visto en el crucero): enseñaba
     * «891 € de 1.000 · te quedan 109» y justo debajo «✅ Puedes gastar 324 €». Dos cifras que no
     * pueden salir del mismo cálculo. La causa era que aquí SOLO se escribían `spent` y `budget`,
     * mientras `build()` seguía leyendo `afford` y `cash` del último push de la app. Al abrir la
     * app todo cuadraba (un push escribe las cinco cosas a la vez) y a la primera noti volvía a
     * mentir — exactamente el «se arregla y al rato vuelve» que él describía.
     *
     * El servidor aporta el gasto y el presupuesto del mes; el árbitro conserva los eventos que
     * aún no cubre la última lectura de la app. Una inversión puede bajar el efectivo de TR sin
     * consumir presupuesto, por eso las dos contribuciones se guardan separadas (FIN-05).
     */
    static long monthStart(long when) {
        Calendar c = Calendar.getInstance(TimeZone.getTimeZone("Europe/Madrid"));
        c.setTimeInMillis(when);
        c.set(Calendar.DAY_OF_MONTH, 1);
        c.set(Calendar.HOUR_OF_DAY, 0);
        c.set(Calendar.MINUTE, 0);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        return c.getTimeInMillis();
    }

    private static WidgetSnapshotArbiter.State read(SharedPreferences p) {
        WidgetSnapshotArbiter.State s = new WidgetSnapshotArbiter.State();
        s.periodStart = p.getLong("periodStart", 0);
        s.issued = p.getLong("issued", 0);
        s.appFence = p.getLong("appFence", 0);
        s.serverReadAt = p.getLong("serverReadAt", 0);
        s.serverTicket = p.getLong("serverTicket", 0);
        s.spent = p.getFloat("spent", 0);
        s.budget = p.getFloat("budget", 0);
        s.hasBudgetLeft = p.contains("budgetLeft");
        s.budgetLeft = p.getFloat("budgetLeft", 0);
        s.hasSafeLiq = p.contains("safeLiq");
        s.baseSafeLiq = p.getFloat("baseSafeLiq", p.getFloat("safeLiq", 0));
        s.hasCash = p.contains("cash");
        s.baseCash = p.getFloat("baseCash", p.getFloat("cash", 0));
        s.spendDelta = p.getFloat("spendDelta", 0);
        // La APK anterior ya guardaba `cash` neto de su delta: heredarlo aquí lo restaría dos veces.
        s.cashDelta = p.getFloat("cashDelta", 0);
        s.cashEnt = p.getString("cashEnt", "");
        s.cashLabel = p.getString("cashLabel", "");
        s.events = p.getString("events", "");
        s.journal = p.getString("journal", "");
        s.journalFull = p.getBoolean("journalFull", false);
        s.unknownPending = p.getBoolean("unknownPending", false);
        s.coveredEvents = p.getString("coveredEvents", "");
        s.deletedKeys = p.getString("deletedKeys", "");
        return s;
    }

    private static void write(SharedPreferences.Editor ed, WidgetSnapshotArbiter.State s) {
        ed.putLong("periodStart", s.periodStart).putLong("issued", s.issued)
          .putLong("appFence", s.appFence).putLong("serverReadAt", s.serverReadAt)
          .putLong("serverTicket", s.serverTicket);
        ed.putFloat("spent", (float) s.spent).putFloat("budget", (float) s.budget);
        if (s.hasBudgetLeft) ed.putFloat("budgetLeft", (float) s.budgetLeft); else ed.remove("budgetLeft");
        if (s.hasSafeLiq) ed.putFloat("safeLiq", (float) s.safeLiq()); else ed.remove("safeLiq");
        if (s.hasCash) ed.putFloat("cash", (float) s.cash()); else ed.remove("cash");
        ed.putFloat("baseSafeLiq", (float) s.baseSafeLiq).putFloat("baseCash", (float) s.baseCash)
          .putFloat("spendDelta", (float) s.spendDelta).putFloat("cashDelta", (float) s.cashDelta)
          .remove("delta").putString("cashEnt", s.cashEnt)
          .putString("cashLabel", s.cashLabel).putString("events", s.events)
          .putString("journal", s.journal).putBoolean("journalFull", s.journalFull)
          .putBoolean("unknownPending", s.unknownPending)
          .putString("coveredEvents", s.coveredEvents).putString("deletedKeys", s.deletedKeys);
        ed.remove("afford");
        ed.putLong("updated", System.currentTimeMillis());
    }

    static synchronized long beginIngest(Context ctx) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        WidgetSnapshotArbiter.State s = read(p);
        long ticket = WidgetSnapshotArbiter.begin(s);
        p.edit().putLong("issued", s.issued).commit();
        return ticket;
    }

    static synchronized void saveApp(Context ctx, long periodStart, double spent, double budget,
                                      Double budgetLeft, Double safeLiq, Double cash,
                                      String cashEnt, String cashLabel,
                                      String coveredEvents, String deletedKeys) {
        // El callback de reentrada puede ejecutar el push viejo antes de que React recalcule
        // el mes nuevo. No sellarlo con la hora de hoy como si sus cifras fueran de hoy.
        if (periodStart != monthStart(System.currentTimeMillis())) return;
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        WidgetSnapshotArbiter.State s = read(p);
        if (!WidgetSnapshotArbiter.app(s, periodStart, spent, budget, budgetLeft, safeLiq, cash,
                cashEnt, cashLabel, coveredEvents, deletedKeys)) {
            if (s.journalFull) {
                p.edit().putBoolean("journalFull", true).commit();
                refreshAll(ctx);
            }
            return;
        }
        SharedPreferences.Editor ed = p.edit();
        write(ed, s);
        ed.commit();
        refreshAll(ctx);
    }

    static synchronized void saveMonth(Context ctx, long ticket, long periodStart, long readAt,
                          String event, String expenseKey, double spent, double budget, double budgetLeft,
                          double shownDelta, double againstDelta, double importe,
                          boolean counts, boolean cashCounts) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        WidgetSnapshotArbiter.State s = read(p);
        if (!WidgetSnapshotArbiter.ingest(s, ticket, monthStart(System.currentTimeMillis()),
                periodStart, readAt, event, expenseKey, spent, budget, budgetLeft, shownDelta, againstDelta,
                importe, counts, cashCounts)) return;
        SharedPreferences.Editor ed = p.edit();
        write(ed, s);
        ed.commit();
        refreshAll(ctx);
    }

    private static String eur0(double n) {
        NumberFormat nf = NumberFormat.getInstance(new Locale("es", "ES"));
        nf.setMaximumFractionDigits(0);
        return nf.format(Math.round(n)) + " €";
    }

    private static RemoteViews build(Context ctx) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        double spent = p.getFloat("spent", 0f);
        double budget = p.getFloat("budget", 0f);
        boolean hasCash = p.contains("cash");
        double cash = p.getFloat("cash", 0f);
        String cashLabel = p.getString("cashLabel", "");
        long updated = p.getLong("updated", 0L);

        /* «PUEDES GASTAR» SE CALCULA AQUÍ, NO SE RECIBE HECHO (2026-08-17).
           Antes la app empujaba un `afford` ya cocinado y la noti no sabía rehacerlo, así que se
           quedaba clavado del push anterior mientras `spent` sí avanzaba → el widget se
           contradecía. Ahora los dos escritores mantienen las mismas dos PRIMITIVAS y la fórmula
           («lo menor entre lo que te deja el presupuesto y la liquidez que no te deja en rojo»)
           vive solo aquí. Da igual quién escribió el último: el número siempre es coherente.
           Es la misma cuenta que hace la app en 11-app-main.js (`widgetAfford`). */
        boolean hasBudgetLeft = p.contains("budgetLeft");
        boolean hasSafeLiq = p.contains("safeLiq");
        double budgetLeft = Math.max(0, p.getFloat("budgetLeft", 0f));
        double safeLiq = Math.max(0, p.getFloat("safeLiq", 0f));
        boolean hasAfford = hasBudgetLeft || hasSafeLiq;
        double afford = hasBudgetLeft && hasSafeLiq ? Math.min(budgetLeft, safeLiq)
                      : (hasBudgetLeft ? budgetLeft : safeLiq);

        /* EL MES CAMBIA Y EL WIDGET NO SE ENTERA (2026-08-01, feedback de su pareja: sale -2 €
           el día 1 y no se resetea hasta que gasta más de lo que le sobró el mes anterior).
           `updatePeriodMillis=0` (a propósito, por batería) significa que ESTE `build()` solo se
           ejecuta cuando algo empuja datos nuevos — abrir la app o una notificación de TR
           procesada. Si ninguna de las dos pasa justo al empezar el mes, `spent`/`afford` se
           quedan con el ÚLTIMO número del mes ANTERIOR (aquí, -2 €: más ingresado que gastado en
           los últimos días de julio) mostrado como si fuera de este mes — no está mal calculado,
           está MAL FECHADO.
           No hay forma de recalcular AQUÍ el gasto real del mes nuevo (los datos viven en el
           almacenamiento de la WebView, no accesible desde este provider sin abrir la app) — pero
           SÍ se sabe que un número de un mes distinto no puede seguir enseñándose como si fuera de
           HOY. Se compara el período del snapshot con el mes de AHORA; si no coinciden, se pinta
           «—» sin disponible ni saldo en vez de inventar un cero. En cuanto la app empuje el
           dato real del mes nuevo, esto se sustituye solo. */
        boolean sinDato = p.getBoolean("journalFull", false) || p.getBoolean("unknownPending", false);
        boolean mesDistinto = p.getLong("periodStart", 0) > 0
                ? p.getLong("periodStart", 0) != monthStart(System.currentTimeMillis()) : false;
        if (!mesDistinto && p.getLong("periodStart", 0) == 0 && updated > 0) {
            Calendar cUpd = Calendar.getInstance(); cUpd.setTimeInMillis(updated);
            Calendar cNow = Calendar.getInstance();
            mesDistinto = cUpd.get(Calendar.MONTH) != cNow.get(Calendar.MONTH)
                    || cUpd.get(Calendar.YEAR) != cNow.get(Calendar.YEAR);
        }
        if (mesDistinto || sinDato) { hasAfford = false; hasCash = false; }

        RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.widget_micartera);
        rv.setTextViewText(R.id.w_amount, mesDistinto || sinDato ? "—" : eur0(spent));
        rv.setTextColor(R.id.w_amount, (budget > 0 && spent > budget) ? CORAL : MINT);

        // «Lo que te puedes permitir» (gasto seguro): lo que puedes gastar sin pasarte ni quedarte
        // en rojo. Es la cifra que el usuario quería ver, no solo lo ya gastado (feedback 2026-07-18).
        if (hasAfford) {
            rv.setViewVisibility(R.id.w_afford, View.VISIBLE);
            rv.setTextViewText(R.id.w_afford, "✅ Puedes gastar " + eur0(afford));
            rv.setTextColor(R.id.w_afford, afford > 0 ? MINT : CORAL);
        } else {
            rv.setViewVisibility(R.id.w_afford, View.GONE);
        }

        if (mesDistinto || sinDato) {
            rv.setTextViewText(R.id.w_sub, mesDistinto ? "Sin datos de este mes" : "Abre la app para actualizar");
            rv.setViewVisibility(R.id.w_bar, View.GONE);
        } else if (budget > 0) {
            double left = budget - spent;
            rv.setTextViewText(R.id.w_sub, left >= 0
                    ? "de " + eur0(budget) + " este mes · te quedan " + eur0(left)
                    : "de " + eur0(budget) + " este mes · " + eur0(-left) + " de más 🚨");
            rv.setProgressBar(R.id.w_bar, 100, (int) Math.min(100, Math.round(spent / budget * 100)), false);
            rv.setViewVisibility(R.id.w_bar, View.VISIBLE);
        } else {
            rv.setTextViewText(R.id.w_sub, "gastado este mes");
            rv.setViewVisibility(R.id.w_bar, View.GONE);
        }

        String foot = "";
        if (hasCash) foot = "💳 " + (cashLabel.isEmpty() ? "Cuenta" : cashLabel) + ": " + eur0(cash);
        if (!mesDistinto && !sinDato && updated > 0) {
            Calendar c = Calendar.getInstance();
            c.setTimeInMillis(updated);
            String hm = String.format(Locale.ROOT, "%02d:%02d", c.get(Calendar.HOUR_OF_DAY), c.get(Calendar.MINUTE));
            foot = foot.isEmpty() ? ("actualizado " + hm) : (foot + " · " + hm);
        }
        rv.setTextViewText(R.id.w_foot, foot);
        rv.setTextColor(R.id.w_foot, MUTED);
        rv.setViewVisibility(R.id.w_foot, foot.isEmpty() ? View.GONE : View.VISIBLE);

        Intent open = new Intent(ctx, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        rv.setOnClickPendingIntent(R.id.w_root, pi);
        return rv;
    }
}
