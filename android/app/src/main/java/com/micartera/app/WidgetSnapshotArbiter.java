package com.micartera.app;

/** Ordena los dos escritores del widget sin depender del reloj del teléfono. */
final class WidgetSnapshotArbiter {
    static final class State {
        long periodStart, issued, appFence, serverReadAt, serverTicket;
        double spent, budget, budgetLeft, baseSafeLiq, baseCash, spendDelta, cashDelta;
        boolean hasBudgetLeft, hasSafeLiq, hasCash;
        String cashEnt = "", cashLabel = "", events = "", journal = "";
        String coveredEvents = "", deletedKeys = "", unknownJournal = "";
        boolean journalFull, unknownPending, unknownLoss;

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

    /** ¿Este pago falta en la foto de la app? Si ya lo cubre o se borró, no hay nada pendiente. */
    static boolean pendingUnknown(State s, String event, String expenseKey) {
        if (event == null || event.isEmpty() || has(s.coveredEvents, event)
                || has(s.events, event) || has(s.deletedKeys, expenseKey)) return false;
        // No conocemos ningún delta de una respuesta incompatible. Solo conservamos identidad;
        // una foto de la app sin ACK no es prueba de que ya incluya ese pago (revisión 30/9).
        String line = event + "\t" + (expenseKey != null ? expenseKey : "");
        if (!s.unknownJournal.contains(line + "\n")) {
            if (s.unknownJournal.length() + line.length() + 1 > JOURNAL_MAX) {
                // Sin identidad retenida ningún ACK posterior demuestra que cubra este pago.
                s.journalFull = true;
                s.unknownLoss = true;
            }
            else s.unknownJournal += line + "\n";
        }
        s.unknownPending = true;
        return true;
    }

    private static boolean has(String list, String event) {
        return list != null && event != null && !event.isEmpty() && list.contains("|" + event + "|");
    }

    private static final int JOURNAL_MAX = 262144;
    private static String[] entry(String line) { return line.split("\\t", -1); }

    /** Los deltas de otra selección no se trasladan; su identidad sigue esperando cobertura. */
    static boolean invalidateScope(State s) {
        for (String line : s.journal.split("\\n")) {
            if (line.trim().isEmpty()) continue;
            String[] p = entry(line);
            if (p.length != 7) { s.journalFull = true; s.unknownLoss = true; return false; }
            String unknown = p[0].trim() + "\t" + p[6] + "\n";
            if (!s.unknownJournal.contains(unknown)) s.unknownJournal += unknown;
        }
        if (s.unknownJournal.length() > JOURNAL_MAX) { s.journalFull = true; s.unknownLoss = true; return false; }
        s.periodStart = 0;
        return true;
    }

    static boolean app(State s, long periodStart, double spent, double budget, Double budgetLeft,
                    Double safeLiq, Double cash, String cashEnt, String cashLabel,
                    String coveredEvents, String deletedKeys) {
        // El XML de preferencias puede añadir indentación al salto final del journal. Una foto
        // de la app permite releerlo y recuperar ese bloqueo sin perder eventos no confirmados.
        StringBuilder keep = new StringBuilder(), ids = new StringBuilder();
        double shown = 0, against = 0, cashPart = 0, spendPart = 0;
        StringBuilder unknownKeep = new StringBuilder();
        for (String line : s.unknownJournal.split("\\n")) {
            if (line.isEmpty()) continue;
            String[] p = entry(line);
            if (p.length != 2) { s.journalFull = true; return false; }
            if (!has(coveredEvents, p[0]) && !has(deletedKeys, p[1])) unknownKeep.append(line).append('\n');
        }
        if (unknownKeep.length() > JOURNAL_MAX) { s.journalFull = true; return false; }
        boolean unknown = s.unknownLoss || unknownKeep.length() > 0;
        if (s.periodStart == periodStart) {
            for (String line : s.journal.split("\\n")) {
                if (line.trim().isEmpty()) continue;
                String[] p = entry(line);
                if (p.length != 7) { s.journalFull = true; return false; }
                p[0] = p[0].trim();
                if (p[0].isEmpty()) { s.journalFull = true; return false; }
                if (has(coveredEvents, p[0]) || has(deletedKeys, p[6])) continue;
                if (keep.length() > 0) keep.append('\n');
                for (int i = 0; i < p.length; i++) {
                    if (i > 0) keep.append('\t');
                    keep.append(p[i]);
                }
                ids.append('|').append(p[0]).append('|');
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
        if (keep.length() > JOURNAL_MAX) { s.journalFull = true; return false; }
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
        s.unknownJournal = unknownKeep.toString();
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
            s.unknownPending = s.unknownLoss || !s.unknownJournal.isEmpty();
            s.coveredEvents = "";
            s.deletedKeys = "";
            s.serverReadAt = 0;
            s.serverTicket = 0;
        }
        if (s.journalFull) {
            // El bloqueo de otra entrada tampoco autoriza a olvidar un pago nuevo.
            return pendingUnknown(s, event, expenseKey);
        }
        boolean newEvent = event != null && !event.isEmpty() && !has(s.events, event);
        if (newEvent) {
            String line = event + "\t" + shownDelta + "\t" + againstDelta + "\t" + amount
                    + "\t" + (counts ? "1" : "0") + "\t" + (cashCounts ? "1" : "0")
                    + "\t" + (expenseKey != null ? expenseKey : "");
            int separator = s.journal.isEmpty() ? 0 : 1;
            if (s.journal.length() + separator + line.length() > JOURNAL_MAX) {
                s.journalFull = true;
                pendingUnknown(s, event, expenseKey);
                return true;
            }
            s.events += "|" + event + "|";
            // Sin salto final: el serializador Android no debe convertir indentación en datos.
            s.journal += (separator == 0 ? "" : "\n") + line;
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
