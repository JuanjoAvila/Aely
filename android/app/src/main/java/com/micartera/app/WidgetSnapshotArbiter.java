package com.micartera.app;

/** Ordena los dos escritores del widget sin depender del reloj del teléfono. */
final class WidgetSnapshotArbiter {
    static final class State {
        long periodStart, issued, appFence, serverReadAt, serverTicket;
        double spent, budget, budgetLeft, baseSafeLiq, baseCash, spendDelta, cashDelta;
        boolean hasBudgetLeft, hasSafeLiq, hasCash;
        String cashEnt = "", cashLabel = "", events = "", journal = "";
        String coveredEvents = "", deletedKeys = "";
        boolean journalFull, unknownPending;

        double safeLiq() { return Math.max(0, hasCash
                ? Math.min(baseSafeLiq - spendDelta, baseCash - cashDelta)
                : baseSafeLiq - spendDelta); }
        double cash() { return baseCash - cashDelta; }
        double afford() {
            if (hasBudgetLeft && hasSafeLiq) return Math.min(Math.max(0, budgetLeft), safeLiq());
            return hasBudgetLeft ? Math.max(0, budgetLeft) : safeLiq();
        }
    }

    static long begin(State s) { return ++s.issued; }

    private static boolean has(String list, String event) {
        return list != null && event != null && !event.isEmpty() && list.contains("|" + event + "|");
    }

    private static final int JOURNAL_MAX = 262144;
    private static String[] entry(String line) { return line.split("\\t", -1); }

    static boolean app(State s, long periodStart, double spent, double budget, Double budgetLeft,
                    Double safeLiq, Double cash, String cashEnt, String cashLabel,
                    String coveredEvents, String deletedKeys) {
        if (s.periodStart == periodStart && s.journalFull) return false;
        StringBuilder keep = new StringBuilder(), ids = new StringBuilder();
        double shown = 0, against = 0, cashPart = 0, spendPart = 0;
        boolean unknown = false;
        if (s.periodStart == periodStart) {
            for (String line : s.journal.split("\\n")) {
                if (line.isEmpty()) continue;
                String[] p = entry(line);
                if (p.length != 7) { s.journalFull = true; return false; }
                if (has(coveredEvents, p[0]) || has(deletedKeys, p[6])) continue;
                keep.append(line).append('\n'); ids.append('|').append(p[0]).append('|');
                try {
                    double amount = Double.parseDouble(p[3]);
                    double sd = Double.parseDouble(p[1]), ad = Double.parseDouble(p[2]);
                    if (Double.isNaN(sd) || Double.isNaN(ad)) unknown = true;
                    else { shown += sd; against += ad; }
                    if ("trade_republic".equals(cashEnt)) {
                        if ("1".equals(p[5])) cashPart += amount;
                        if ("1".equals(p[4])) spendPart += amount;
                    }
                } catch (NumberFormatException bad) { s.journalFull = true; return false; }
            }
        }
        s.appFence = s.issued;
        s.periodStart = periodStart;
        s.spent = spent + shown;
        s.budget = budget;
        s.hasBudgetLeft = budgetLeft != null;
        s.budgetLeft = budgetLeft != null ? Math.max(0, budgetLeft - against) : 0;
        s.hasSafeLiq = safeLiq != null;
        if (budgetLeft == null && budget > 0 && against != 0) s.hasSafeLiq = false;
        s.baseSafeLiq = safeLiq != null ? safeLiq : 0;
        s.hasCash = cash != null;
        s.baseCash = cash != null ? cash : 0;
        s.cashEnt = cashEnt != null ? cashEnt : "";
        s.cashLabel = cashLabel != null ? cashLabel : "";
        s.spendDelta = spendPart;
        s.cashDelta = cashPart;
        s.events = ids.toString();
        s.journal = keep.toString();
        s.journalFull = false;
        s.unknownPending = unknown;
        s.coveredEvents = coveredEvents != null ? coveredEvents : "";
        s.deletedKeys = deletedKeys != null ? deletedKeys : "";
        s.serverReadAt = 0;
        s.serverTicket = 0;
        return true;
    }

    static boolean ingest(State s, long ticket, long currentPeriod, long responsePeriod,
                          long readAt, String event, String expenseKey, double spent, double budget,
                          double budgetLeft, double shownDelta, double againstDelta,
                          double amount, boolean counts, boolean cashCounts) {
        if (responsePeriod != currentPeriod || ticket <= 0 || has(s.coveredEvents, event)
                || has(s.deletedKeys, expenseKey)) return false;
        if (s.periodStart != responsePeriod) {
            s.periodStart = responsePeriod;
            s.spent = 0;
            s.hasBudgetLeft = false;
            s.hasSafeLiq = false;
            s.hasCash = false;
            s.spendDelta = 0;
            s.cashDelta = 0;
            s.events = "";
            s.journal = "";
            s.journalFull = false;
            s.unknownPending = false;
            s.coveredEvents = "";
            s.deletedKeys = "";
            s.serverReadAt = 0;
            s.serverTicket = 0;
        }
        if (s.journalFull) return false;
        boolean newEvent = event != null && !event.isEmpty() && !has(s.events, event);
        if (newEvent) {
            String line = event + "\t" + shownDelta + "\t" + againstDelta + "\t" + amount
                    + "\t" + (counts ? "1" : "0") + "\t" + (cashCounts ? "1" : "0")
                    + "\t" + (expenseKey != null ? expenseKey : "") + "\n";
            if (s.journal.length() + line.length() > JOURNAL_MAX) {
                s.journalFull = true;
                return true;
            }
            s.events += "|" + event + "|";
            s.journal += line;
            if ("trade_republic".equals(s.cashEnt) && amount != 0) {
                if (cashCounts) s.cashDelta += amount;
                if (counts) s.spendDelta += amount;
            }
        }
        // El push pudo producirse mientras la notificación estaba en vuelo. Su foto NO incluye
        // este evento: sumar su contribución exacta, sin sustituir por un absoluto anterior.
        if (ticket <= s.appFence) {
            if (newEvent) {
                if (Double.isNaN(shownDelta) || Double.isNaN(againstDelta)) s.unknownPending = true;
                else {
                    s.spent += shownDelta;
                    if (s.hasBudgetLeft) s.budgetLeft = Math.max(0, s.budgetLeft - againstDelta);
                    else if (budget > 0) s.hasSafeLiq = false;
                }
            }
            return newEvent;
        }
        // Dos respuestas pueden cruzarse: solo el cálculo servidor más reciente sustituye el total.
        boolean newer = readAt > 0
                ? readAt > s.serverReadAt || (readAt == s.serverReadAt && ticket > s.serverTicket)
                : s.serverReadAt == 0 && ticket > s.serverTicket;
        if (newer) {
            s.spent = spent;
            if (budget > 0) s.budget = budget;
            if (budgetLeft >= 0) { s.budgetLeft = budgetLeft; s.hasBudgetLeft = true; }
            s.serverReadAt = readAt;
            s.serverTicket = ticket;
        }
        return newer || newEvent;
    }
}
