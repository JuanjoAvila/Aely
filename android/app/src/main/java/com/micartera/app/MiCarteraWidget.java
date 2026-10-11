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
    static long monthStart(long when) { return WidgetPeriod.monthStart(when); }

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
        s.unknownJournal = p.getString("unknownJournal", "");
        s.recoveryJournal = p.getString("recoveryJournal", "");
        // APK52 podía omitir el evento que desbordaba sin guardar su identidad ni la causa.
        // La misma preferencia también nace de indentación: legibilidad y ACK retenidos no
        // prueban ausencia de pérdida. Sin marca moderna conservar incertidumbre (10/10).
        s.unknownLoss = p.getBoolean("unknownLoss", s.journalFull);
        s.identityLost = p.getBoolean("identityLost", s.unknownLoss && s.recoveryJournal.isEmpty());
        s.unknownPending = p.getBoolean("unknownPending", false) || s.unknownLoss;
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
          .putBoolean("unknownPending", s.unknownPending).putBoolean("unknownLoss", s.unknownLoss)
          .putBoolean("identityLost", s.identityLost).putString("recoveryJournal", s.recoveryJournal)
          .putString("unknownJournal", s.unknownJournal)
          .putString("coveredEvents", s.coveredEvents).putString("deletedKeys", s.deletedKeys);
        ed.remove("afford");
        ed.putLong("updated", System.currentTimeMillis());
    }

    // Una foto fallida no se guarda a medias; la incertidumbre detectada sí debe sobrevivir.
    private static void writeBlocked(SharedPreferences.Editor ed, WidgetSnapshotArbiter.State s) {
        ed.putBoolean("journalFull", s.journalFull)
          .putBoolean("unknownLoss", s.unknownLoss)
          .putBoolean("identityLost", s.identityLost)
          .putBoolean("unknownPending", s.unknownPending || s.unknownLoss);
    }

    static synchronized long beginIngest(Context ctx) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        WidgetSnapshotArbiter.State s = read(p);
        long ticket = WidgetSnapshotArbiter.begin(s);
        p.edit().putLong("issued", s.issued).commit();
        gate(p).active.add(ticket);
        return ticket;
    }

    interface ReadReady { void accept(String generation, String cut); }
    private interface PendingPayment {
        void apply(WidgetSnapshotArbiter.State s, int contract, String kind, String scope);
    }
    private static final class AppRead {
        final String generation = java.util.UUID.randomUUID().toString();
        final long cut;
        final java.util.ArrayList<PendingPayment> later = new java.util.ArrayList<>();
        AppRead(long cut) { this.cut = cut; }
    }
    private static final class ReadGate {
        final java.util.HashSet<Long> active = new java.util.HashSet<>();
        final java.util.ArrayList<Runnable> waiting = new java.util.ArrayList<>();
        AppRead read;
    }
    private static final java.util.IdentityHashMap<SharedPreferences, ReadGate> reads = new java.util.IdentityHashMap<>();
    private static ReadGate gate(SharedPreferences p) {
        ReadGate g = reads.get(p);
        if (g == null) { g = new ReadGate(); reads.put(p, g); }
        return g;
    }

    // La lectura empieza después de terminar los envíos previos: un ticket emitido aún no
    // prueba que su movimiento esté guardado en la nube. No se deduce ese corte del reloj.
    static synchronized void beginAppRead(Context ctx, ReadReady ready) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        ReadGate g = gate(p);
        if (!g.active.isEmpty()) { g.waiting.add(() -> beginAppRead(ctx, ready)); return; }
        g.read = new AppRead(p.getLong("issued", 0));
        ready.accept(g.read.generation, Long.toString(g.read.cut));
    }

    static synchronized void finishIngest(Context ctx, long ticket) {
        ReadGate g = gate(ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE));
        g.active.remove(ticket);
        if (g.active.isEmpty()) {
            java.util.ArrayList<Runnable> waiting = new java.util.ArrayList<>(g.waiting);
            g.waiting.clear();
            for (Runnable ready : waiting) ready.run();
        }
    }

    // Durante una lectura pueden llegar pagos que su foto no incluya. Se reaplican con los
    // lectores habituales y sus ACK tras sustituir el legado, también si éste estaba lleno.
    private static void duringRead(SharedPreferences p, long ticket, PendingPayment payment) {
        AppRead r = gate(p).read;
        if (r != null && ticket > r.cut) r.later.add(payment);
    }

    static synchronized void saveApp(Context ctx, long periodStart, double spent, double budget,
                                      Double budgetLeft, Double safeLiq, Double cash,
                                      String cashEnt, String cashLabel, String coveredEvents, String deletedKeys,
                                      int contract, String kind, String magnitude, String lang, String scope,
                                      String readGeneration, String nativeCut) {
        if (!WidgetPeriod.clientV2(contract)) { waiting(ctx); return; }
        // El callback de reentrada puede ejecutar el push viejo antes de que React recalcule
        // el mes nuevo. No sellarlo con la hora de hoy como si sus cifras fueran de hoy.
        if (!WidgetPeriod.acceptApp(contract, kind, periodStart, System.currentTimeMillis())) return;
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        WidgetSnapshotArbiter.State s = read(p);
        AppRead r = gate(p).read;
        boolean fresh = r != null && r.generation.equals(readGeneration) && Long.toString(r.cut).equals(nativeCut);
        if (fresh) {
            if (!Double.isFinite(spent) || !Double.isFinite(budget)
                    || (budgetLeft != null && !Double.isFinite(budgetLeft))
                    || (safeLiq != null && !Double.isFinite(safeLiq))
                    || (cash != null && !Double.isFinite(cash))) return;
            try {
                org.json.JSONArray a = new org.json.JSONArray(scope);
                if (a.length() != 8 || a.optInt(0, 0) != 2 || a.optLong(1, 0) != periodStart
                        || !kind.equals(a.optString(2, ""))
                        || !(WidgetPeriod.CICLO.equals(kind) ? "neto" : "gasto").equals(magnitude)) return;
            } catch (Exception invalid) { return; }
            // Sólo esta lectura completa nueva sustituye lo que ya no puede reconstruirse.
            // Un reenvío o una web anterior siguen conciliando IDs sin borrar incertidumbre.
            long issued = s.issued;
            s = new WidgetSnapshotArbiter.State();
            s.issued = issued;
        }
        // Cambiar de mes a ciclo (o al revés) es otra ventana: el journal de la anterior no vale.
        if (!fresh && (!sameWindow(p, contract, kind) || (contract >= WidgetPeriod.CONTRACT
                && !WidgetPeriod.sameScope(p.getString("scope", ""), scope)))
                && !WidgetSnapshotArbiter.invalidateScope(s, coveredEvents, deletedKeys, periodStart)) {
            SharedPreferences.Editor blocked = p.edit();
            writeBlocked(blocked, s);
            blocked.commit();
            refreshAll(ctx);
            return;
        }
        if (!WidgetSnapshotArbiter.app(s, periodStart, spent, budget, budgetLeft, safeLiq, cash,
                cashEnt, cashLabel, coveredEvents, deletedKeys)) {
            if (s.journalFull) {
                SharedPreferences.Editor blocked = p.edit();
                writeBlocked(blocked, s);
                blocked.commit();
                refreshAll(ctx);
            }
            return;
        }
        if (fresh) {
            // Reconstruir también los posteriores ANTES del commit evita guardar una cifra
            // intermedia o perder sus deltas si el proceso muere entre dos escrituras.
            for (PendingPayment payment : r.later) payment.apply(s, contract, kind, scope);
        }
        SharedPreferences.Editor ed = p.edit();
        write(ed, s);
        ed.putBoolean("negotiating", false);
        ed.putInt("contract", contract >= WidgetPeriod.CONTRACT ? contract : 0)
          .putString("periodKind", WidgetPeriod.CICLO.equals(kind) ? WidgetPeriod.CICLO : WidgetPeriod.MES)
          .putString("magnitude", magnitude != null ? magnitude : "")
          .putString("lang", lang != null ? lang : "")
          .putString("scope", scope != null ? scope : "");
        ed.commit();
        if (fresh) {
            gate(p).read = null;
        }
        refreshAll(ctx);
    }

    static synchronized void waiting(Context ctx) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean("negotiating", true).commit();
        refreshAll(ctx);
    }

    private static boolean sameWindow(SharedPreferences p, int contract, String kind) {
        String k = WidgetPeriod.CICLO.equals(kind) && contract >= WidgetPeriod.CONTRACT ? WidgetPeriod.CICLO : WidgetPeriod.MES;
        String stored = p.getInt("contract", 0) >= WidgetPeriod.CONTRACT ? p.getString("periodKind", WidgetPeriod.MES) : WidgetPeriod.MES;
        return k.equals(stored);
    }

    static synchronized boolean saveLegacyPayment(Context ctx, long ticket, long eventAt,
                          String event, String key, double amount, String category, boolean cashCounts) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        duringRead(p, ticket, (s, contract, kind, scope) ->
                applyLegacyPayment(s, contract, kind, scope, ticket, eventAt, event, key, amount, category, cashCounts));
        WidgetSnapshotArbiter.State s = read(p);
        int accepted = applyLegacyPayment(s, p.getInt("contract", 0), p.getString("periodKind", WidgetPeriod.MES),
                p.getString("scope", ""), ticket, eventAt, event, key, amount, category, cashCounts);
        if (accepted == 2) {
            SharedPreferences.Editor ed = p.edit(); write(ed, s); ed.commit(); refreshAll(ctx);
        }
        return accepted > 0;
    }

    private static int applyLegacyPayment(WidgetSnapshotArbiter.State s, int contract, String kind, String savedScope,
                          long ticket, long eventAt, String event, String key, double amount, String category, boolean cashCounts) {
        long start = s.periodStart, now = System.currentTimeMillis();
        if (contract < WidgetPeriod.CONTRACT || event == null || event.isEmpty()
                || !WidgetPeriod.acceptApp(contract, kind, start, now)
                || eventAt < start || eventAt > now || !Double.isFinite(amount)
                || Math.abs(amount - Math.round(amount * 100) / 100.0) > .000001
                || category == null || category.isEmpty()) return 0;
        // Un ingreso grande podría abrir otro ciclo: sin el cobro/ancla actuales no se
        // puede afirmar que siga en esta ventana. Bizums y neutras no abren nómina en la app.
        boolean cycle = WidgetPeriod.CICLO.equals(kind);
        boolean neutral = "inversion".equals(category) || "traspaso".equals(category) || "deudas".equals(category);
        if (cycle && amount <= -200 && !neutral && !"bizum".equals(category)) return 0;
        if (!cycle && WidgetPeriod.monthStart(eventAt) != start) return 0;
        try {
            org.json.JSONArray scope = new org.json.JSONArray(savedScope);
            if (scope.length() != 8 || scope.optInt(0, 0) != 2 || scope.optLong(1, 0) != start
                    || !kind.equals(scope.optString(2, ""))) return 0;
            org.json.JSONArray banks = scope.optJSONArray(6);
            if (banks == null) return 0;
            boolean daily = false;
            for (int i = 0; i < banks.length(); i++)
                if ("trade_republic".equals(banks.optString(i, ""))) daily = true;
            boolean counts = !neutral && (daily || (cycle && amount < 0));
            double cents = Math.round(amount * 100) / 100.0;
            double delta = counts && (cycle || cents > 0) ? cents : 0;
            return WidgetSnapshotArbiter.knownPayment(s, ticket, event, key, delta, cents, counts, cashCounts) ? 2 : 1;
        } catch (Exception invalid) { return 0; }
    }

    static synchronized void saveMonth(Context ctx, long ticket, long periodStart, long readAt,
                          String event, String expenseKey, double spent, double budget, double budgetLeft,
                          double shownDelta, double againstDelta, double importe,
                          boolean counts, boolean cashCounts, int respContract, String respKind, String respScope) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        duringRead(p, ticket, (s, contract, kind, scope) -> applyMonth(s, contract, kind, scope, ticket, periodStart, readAt, event, expenseKey,
                spent, budget, budgetLeft, shownDelta, againstDelta, importe, counts, cashCounts,
                respContract, respKind, respScope));
        WidgetSnapshotArbiter.State s = read(p);
        if (!applyMonth(s, p.getInt("contract", 0), p.getString("periodKind", WidgetPeriod.MES), p.getString("scope", ""),
                ticket, periodStart, readAt, event, expenseKey, spent, budget, budgetLeft, shownDelta, againstDelta,
                importe, counts, cashCounts, respContract, respKind, respScope)) return;
        SharedPreferences.Editor ed = p.edit(); write(ed, s); ed.commit(); refreshAll(ctx);
    }

    private static boolean applyMonth(WidgetSnapshotArbiter.State s, int contract, String kind, String savedScope,
                          long ticket, long periodStart, long readAt, String event, String expenseKey,
                          double spent, double budget, double budgetLeft, double shownDelta, double againstDelta, double importe,
                          boolean counts, boolean cashCounts, int respContract, String respKind, String respScope) {
        long now = System.currentTimeMillis();
        if (!WidgetPeriod.acceptServer(contract, kind, s.periodStart, respContract, respKind, periodStart, now)
                || (contract >= WidgetPeriod.CONTRACT && !WidgetPeriod.sameScope(savedScope, respScope))) {
            // Un servidor de otra ventana o de la regla vieja no puede pisar la foto de la app.
            // Pero hubo un pago que la foto no incluye: se dice «abre la app», no se finge al día.
            return contract >= WidgetPeriod.CONTRACT && WidgetSnapshotArbiter.pendingUnknown(s, event, expenseKey);
        }
        return WidgetSnapshotArbiter.ingest(s, ticket, WidgetPeriod.current(contract, kind, s.periodStart, now),
                periodStart, readAt, event, expenseKey, spent, budget, budgetLeft, shownDelta, againstDelta,
                importe, counts, cashCounts);
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
        boolean sinDato = p.getBoolean("journalFull", false) || p.getBoolean("unknownPending", false)
                || p.getBoolean("negotiating", false);
        // Con Mi ciclo la ventana no acaba el día 1: caduca cuando el cobro queda fuera de plazo.
        int contract = p.getInt("contract", 0);
        String kind = p.getString("periodKind", WidgetPeriod.MES);
        String[] t = WidgetPeriod.labels(contract, p.getString("lang", ""), kind, p.getString("magnitude", ""));
        boolean mesDistinto = WidgetPeriod.stale(contract, kind, p.getLong("periodStart", 0), System.currentTimeMillis());
        if (!mesDistinto && p.getLong("periodStart", 0) == 0 && updated > 0) {
            Calendar cUpd = Calendar.getInstance(); cUpd.setTimeInMillis(updated);
            Calendar cNow = Calendar.getInstance();
            mesDistinto = cUpd.get(Calendar.MONTH) != cNow.get(Calendar.MONTH)
                    || cUpd.get(Calendar.YEAR) != cNow.get(Calendar.YEAR);
        }
        if (mesDistinto || sinDato) { hasAfford = false; hasCash = false; }

        RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.widget_micartera);
        rv.setTextViewText(R.id.w_title, t[WidgetPeriod.TITULO]);
        rv.setTextViewText(R.id.w_amount, mesDistinto || sinDato ? "—" : eur0(spent));
        rv.setTextColor(R.id.w_amount, (budget > 0 && spent > budget) ? CORAL : MINT);

        // «Lo que te puedes permitir» (gasto seguro): lo que puedes gastar sin pasarte ni quedarte
        // en rojo. Es la cifra que el usuario quería ver, no solo lo ya gastado (feedback 2026-07-18).
        if (hasAfford) {
            rv.setViewVisibility(R.id.w_afford, View.VISIBLE);
            rv.setTextViewText(R.id.w_afford, t[WidgetPeriod.PUEDES] + eur0(afford));
            rv.setTextColor(R.id.w_afford, afford > 0 ? MINT : CORAL);
        } else {
            rv.setViewVisibility(R.id.w_afford, View.GONE);
        }

        if (mesDistinto || sinDato) {
            rv.setTextViewText(R.id.w_sub, mesDistinto ? t[WidgetPeriod.SIN_DATOS] : t[WidgetPeriod.ABRE_APP]);
            rv.setViewVisibility(R.id.w_bar, View.GONE);
        } else if (budget > 0) {
            double left = budget - spent;
            rv.setTextViewText(R.id.w_sub, (left >= 0 ? t[WidgetPeriod.QUEDAN] : t[WidgetPeriod.EXCESO])
                    .replace("{b}", eur0(budget)).replace("{l}", eur0(left)).replace("{x}", eur0(-left)));
            // En el ciclo el neto puede ser negativo (cobraste más de lo que gastaste): barra a 0.
            rv.setProgressBar(R.id.w_bar, 100, (int) Math.max(0, Math.min(100, Math.round(spent / budget * 100))), false);
            rv.setViewVisibility(R.id.w_bar, View.VISIBLE);
        } else {
            rv.setTextViewText(R.id.w_sub, t[WidgetPeriod.SIN_PRESUPUESTO]);
            rv.setViewVisibility(R.id.w_bar, View.GONE);
        }

        String foot = "";
        if (hasCash) foot = "💳 " + (cashLabel.isEmpty() ? "Cuenta" : cashLabel) + ": " + eur0(cash);
        if (!mesDistinto && !sinDato && updated > 0) {
            Calendar c = Calendar.getInstance();
            c.setTimeInMillis(updated);
            String hm = String.format(Locale.ROOT, "%02d:%02d", c.get(Calendar.HOUR_OF_DAY), c.get(Calendar.MINUTE));
            foot = foot.isEmpty() ? (t[WidgetPeriod.ACTUALIZADO] + hm) : (foot + " · " + hm);
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
