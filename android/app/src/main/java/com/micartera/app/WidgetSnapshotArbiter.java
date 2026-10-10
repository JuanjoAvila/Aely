package com.micartera.app;

/** Ordena los dos escritores del widget sin depender del reloj del teléfono. */
final class WidgetSnapshotArbiter {
    static final class State {
        long periodStart, issued, appFence, serverReadAt, serverTicket;
        double spent, budget, budgetLeft, baseSafeLiq, baseCash, spendDelta, cashDelta;
        boolean hasBudgetLeft, hasSafeLiq, hasCash;
        String cashEnt = "", cashLabel = "", events = "", journal = "";
        String coveredEvents = "", deletedKeys = "", unknownJournal = "", recoveryJournal = "";
        boolean journalFull, unknownPending, unknownLoss, identityLost;

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

    /** Un servidor antiguo acredita este pago, pero no un total de Inicio v2. */
    static boolean knownPayment(State s, long ticket, String event, String key,
                                double delta, double amount, boolean counts, boolean cashCounts) {
        // Reutilizar la rama de contribución exacta evita introducir otro escritor absoluto.
        // Sellar también este pago evita que un absoluto v2 iniciado antes lo deshaga.
        s.appFence = Math.max(s.appFence, Math.max(ticket, s.issued));
        return ingest(s, ticket, s.periodStart, s.periodStart, 0, event, key,
                0, s.budget, -1, delta, delta, amount, counts, cashCounts);
    }

    /** ¿Este pago falta en la foto de la app? Si ya lo cubre o se borró, no hay nada pendiente. */
    static boolean pendingUnknown(State s, String event, String expenseKey) {
        if (event == null || event.isEmpty() || has(s.coveredEvents, event)
                || has(s.events, event) || has(s.deletedKeys, expenseKey)) return false;
        // No conocemos ningún delta de una respuesta incompatible. Solo conservamos identidad;
        // una foto de la app sin ACK no es prueba de que ya incluya ese pago (revisión 30/9).
        String line = event + "\t" + (expenseKey != null ? expenseKey : "");
        if (!("\n" + s.unknownJournal + "\n").contains("\n" + line + "\n")) {
            int separator = s.unknownJournal.isEmpty() ? 0 : 1;
            if (s.unknownJournal.length() + separator + line.length() > JOURNAL_MAX) {
                // Una reserva pequeña conserva el pago que no cabe en el registro principal;
                // así abrir la app sí puede conciliarlo. Sin sitio en ambos queda pérdida real.
                if (!("\n" + s.recoveryJournal + "\n").contains("\n" + line + "\n")) {
                    int recoverySeparator = s.recoveryJournal.isEmpty() ? 0 : 1;
                    if (s.recoveryJournal.length() + recoverySeparator + line.length() <= RECOVERY_MAX)
                        s.recoveryJournal += (s.recoveryJournal.isEmpty() ? "" : "\n") + line;
                    else s.identityLost = true;
                }
                s.journalFull = true;
                s.unknownLoss = true;
            }
            // El salto final puede reaparecer como indentación al releer preferencias Android.
            else s.unknownJournal += (separator == 0 ? "" : "\n") + line;
        }
        s.unknownPending = true;
        return true;
    }

    private static boolean has(String list, String event) {
        return list != null && event != null && !event.isEmpty() && list.contains("|" + event + "|");
    }

    private static final int JOURNAL_MAX = 262144;
    private static final int RECOVERY_MAX = 4096;
    private static String[] entry(String line) { return line.split("\\t", -1); }

    /** La APK52 conservaba las entradas; journalFull por formato no demuestra pérdida. */
    static boolean legacyLoss(State s) {
        boolean any = false;
        String[] records = {s.journal, s.unknownJournal};
        for (int i = 0; i < records.length; i++) {
            String data = records[i];
            for (String line : data.split("\\n")) {
                if (line.trim().isEmpty() && line.indexOf('\t') < 0) continue;
                String[] p = entry(line);
                if (p.length != (i == 0 ? 7 : 2) || p[0].trim().isEmpty()) return true;
                any = true;
            }
        }
        return !any;
    }

    private static boolean lost(State s) {
        s.journalFull = true;
        s.identityLost = true;
        s.unknownLoss = true;
        s.unknownPending = true;
        return false;
    }

    /** Los deltas de otra selección no se trasladan; su identidad sigue esperando cobertura. */
    static boolean invalidateScope(State s) {
        return invalidateScope(s, "", "", 0);
    }

    static boolean invalidateScope(State s, String covered, String deleted, long nextPeriod) {
        // Conciliar ANTES de reservar espacio: la foto puede cubrir justo las entradas que
        // impedían migrar el otro registro. Un fallo mantiene ambos originales, sin truncar.
        StringBuilder unknownKeep = new StringBuilder();
        for (String line : s.unknownJournal.split("\\n")) {
            if (line.trim().isEmpty() && line.indexOf('\t') < 0) continue;
            String[] p = entry(line);
            if ((p.length != 2 && p.length != 3) || p[0].trim().isEmpty()) return lost(s);
            p[0] = p[0].trim();
            long previous = 0;
            if (p.length == 3) {
                try { previous = Long.parseLong(p[2]); }
                catch (NumberFormatException bad) { return lost(s); }
            }
            if (has(covered, p[0]) || has(deleted, p[1]) || (previous > 0 && previous < nextPeriod)) continue;
            if (unknownKeep.length() > 0) unknownKeep.append('\n');
            unknownKeep.append(p[0]).append('\t').append(p[1]);
            if (p.length == 3) unknownKeep.append('\t').append(p[2]);
        }
        if (unknownKeep.length() > JOURNAL_MAX) { s.journalFull = true; return false; }
        for (String line : s.journal.split("\\n")) {
            if (line.trim().isEmpty()) continue;
            String[] p = entry(line);
            if (p.length != 7) return lost(s);
            p[0] = p[0].trim();
            if (p[0].isEmpty()) return lost(s);
            if (has(covered, p[0]) || has(deleted, p[6]) || (s.periodStart > 0 && s.periodStart < nextPeriod)) continue;
            // Sólo los pagos de una ventana conocida pueden retirarse con la foto de una
            // posterior. Los incompatibles sin ventana siguen necesitando ACK o lápida.
            String unknown = p[0] + "\t" + p[6] + "\t" + s.periodStart;
            if (!("\n" + unknownKeep + "\n").contains("\n" + unknown + "\n")) {
                int separator = unknownKeep.length() == 0 ? 0 : 1;
                if (unknownKeep.length() + separator + unknown.length() > JOURNAL_MAX) {
                    s.journalFull = true; return false;
                }
                if (separator != 0) unknownKeep.append('\n');
                unknownKeep.append(unknown);
            }
        }
        s.unknownJournal = unknownKeep.toString();
        s.journal = "";
        s.events = "";
        s.unknownPending = s.unknownLoss || !s.unknownJournal.isEmpty();
        s.periodStart = 0;
        return true;
    }

    static boolean app(State s, long periodStart, double spent, double budget, Double budgetLeft,
                    Double safeLiq, Double cash, String cashEnt, String cashLabel,
                    String coveredEvents, String deletedKeys) {
        // El XML de preferencias puede añadir indentación al salto final del journal. Una foto
        // de la app permite releerlo y recuperar ese bloqueo sin perder eventos no confirmados.
        // La foto de otra ventana retira pagos conocidos anteriores con su saldo actual;
        // los incompatibles sin ventana siguen conservando identidad hasta ACK exacto.
        if (s.periodStart != periodStart && !s.journal.isEmpty()
                && !invalidateScope(s, coveredEvents, deletedKeys, periodStart)) return false;
        StringBuilder keep = new StringBuilder(), ids = new StringBuilder();
        double shown = 0, against = 0, cashPart = 0, spendPart = 0;
        StringBuilder unknownKeep = new StringBuilder();
        for (String line : s.unknownJournal.split("\\n")) {
            // Una línea blanca sin TAB es indentación; con TAB sigue siendo una entrada que
            // necesita identidad. No marcar pérdida irreversible por formato recuperable.
            if (line.trim().isEmpty() && line.indexOf('\t') < 0) continue;
            String[] p = entry(line);
            if (p.length != 2 && p.length != 3) return lost(s);
            p[0] = p[0].trim();
            if (p[0].isEmpty()) return lost(s);
            long previous = 0;
            if (p.length == 3) {
                try { previous = Long.parseLong(p[2]); }
                catch (NumberFormatException bad) { return lost(s); }
            }
            // La foto válida aporta el saldo actual; no necesita una fila antigua que el pull
            // ya no devuelve para retirar cifras de un periodo cerrado (revisión 10/10).
            if (!(previous > 0 && previous < periodStart)
                    && !has(coveredEvents, p[0]) && !has(deletedKeys, p[1])) {
                if (unknownKeep.length() > 0) unknownKeep.append('\n');
                unknownKeep.append(p[0]).append('\t').append(p[1]);
                if (p.length == 3) unknownKeep.append('\t').append(p[2]);
            }
        }
        if (unknownKeep.length() > JOURNAL_MAX) { s.journalFull = true; return false; }
        StringBuilder recoveryKeep = new StringBuilder();
        for (String line : s.recoveryJournal.split("\\n")) {
            if (line.isEmpty()) continue;
            String[] p = entry(line);
            if (p.length != 2 || p[0].isEmpty()) return lost(s);
            if (!has(coveredEvents, p[0]) && !has(deletedKeys, p[1])) {
                if (recoveryKeep.length() > 0) recoveryKeep.append('\n');
                recoveryKeep.append(line);
            }
        }
        if (recoveryKeep.length() > RECOVERY_MAX) return lost(s);
        boolean loss = s.identityLost || recoveryKeep.length() > 0;
        boolean unknown = loss || unknownKeep.length() > 0;
        if (s.periodStart == periodStart) {
            for (String line : s.journal.split("\\n")) {
                if (line.trim().isEmpty()) continue;
                String[] p = entry(line);
                if (p.length != 7) return lost(s);
                p[0] = p[0].trim();
                if (p[0].isEmpty()) return lost(s);
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
        s.recoveryJournal = recoveryKeep.toString();
        s.unknownLoss = loss;
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
            // Un bloqueo de cifras no autoriza a perder identidades al entrar en otro periodo.
            // Si aún se leen, pasan a cobertura pendiente; si no, se conserva la pérdida.
            if (!s.journal.isEmpty() && !invalidateScope(s))
                lost(s); // Este reset sí retirará identidades que no se pudieron migrar.
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
