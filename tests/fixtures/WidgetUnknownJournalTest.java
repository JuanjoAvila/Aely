package com.micartera.app;

/** Datos sintéticos; se compila contra el árbitro REAL, sin Android ni preferencias reales. */
public class WidgetUnknownJournalTest {
    static int assertions;
    static void ok(boolean value, String message) {
        if (!value) throw new AssertionError(message);
        assertions++;
    }
    static void eq(double actual, double expected) {
        ok(Math.abs(actual - expected) < 0.001, "importe " + actual + " != " + expected);
    }
    static WidgetSnapshotArbiter.State base() {
        WidgetSnapshotArbiter.State s = new WidgetSnapshotArbiter.State();
        ok(WidgetSnapshotArbiter.app(s, 100, 40, 100, 60.0, 150.0, 200.0,
                "trade_republic", "Sintética", "", ""), "base");
        return s;
    }
    static boolean app(WidgetSnapshotArbiter.State s, String ack, String deleted) {
        return WidgetSnapshotArbiter.app(s, 100, 40, 100, 60.0, 150.0, 200.0,
                "trade_republic", "Sintética", ack, deleted);
    }
    static void financial(WidgetSnapshotArbiter.State s) {
        eq(s.spent, 40); eq(s.budgetLeft, 60); eq(s.cash(), 200); eq(s.safeLiq(), 150);
    }
    static WidgetSnapshotArbiter.State pending(String journal) {
        WidgetSnapshotArbiter.State s = base(); s.unknownJournal = journal; s.unknownPending = true;
        return s;
    }
    static WidgetSnapshotArbiter.State restart(WidgetSnapshotArbiter.State old) {
        WidgetSnapshotArbiter.State s = base(); s.unknownJournal = old.unknownJournal;
        s.unknownPending = old.unknownPending; s.journalFull = old.journalFull;
        return s;
    }
    public static void main(String[] args) {
        boolean baseline = args.length > 0 && args[0].equals("baseline");
        WidgetSnapshotArbiter.State reproducer = pending("ev\tkey\n    ");
        boolean accepted = app(reproducer, "|ev|", "");
        if (baseline) {
            ok(!accepted && reproducer.journalFull && reproducer.unknownPending,
                    "old-red: formato indentado bloquea incluso con ACK exacto");
            System.out.println("OLD_RED_CONFIRMED assertions=" + assertions); return;
        }
        ok(accepted && !reproducer.unknownPending && !reproducer.journalFull,
                "ACK exacto recupera sólo formato indentado"); financial(reproducer);
        String[] formats = {"ev\tkey", "ev\tkey\n", "ev\tkey\n    ",
                "\n \n ev \tkey\n  ", "ev\tkey\r\n   ", " ev \tkey", "ev\t"};
        for (String format : formats) {
            WidgetSnapshotArbiter.State s = pending(format);
            ok(app(s, "|ev|", "") && !s.unknownPending && !s.journalFull, "ACK formato"); financial(s);
            s = pending(format);
            ok(app(s, "", "") && s.unknownPending && !s.journalFull, "sin ACK sigue desconocido");
            financial(s);
            s = restart(s);
            ok(app(s, "|other|", "") && s.unknownPending, "reinicio/ACK ajeno no resuelven");
            ok(app(s, "|ev|", "") && !s.unknownPending, "ACK después de reinicio"); financial(s);
        }
        WidgetSnapshotArbiter.State spaces = pending(" ev \t key ");
        ok(app(spaces, "", "|key|") && spaces.unknownPending, "espacios de clave son identidad");
        ok(spaces.unknownJournal.equals("ev\t key "), "normaliza evento, conserva clave exacta");
        ok(app(spaces, "", "| key |") && !spaces.unknownPending, "lápida exacta con espacios");
        WidgetSnapshotArbiter.State crlf = pending("ev\tkey\r\n  ");
        ok(app(crlf, "", "|key|") && crlf.unknownPending, "CR en clave no se adivina como cobertura");
        ok(app(crlf, "|ev|", "") && !crlf.unknownPending, "ACK recupera CRLF");
        for (String bad : new String[]{"ev", "\t", " \t ", "ev\tkey\textra", "ev\tkey\npartial"}) {
            WidgetSnapshotArbiter.State s = pending(bad); String original = s.unknownJournal;
            ok(!app(s, "|ev|", "|key|") && s.journalFull && s.unknownPending, "corrupción fail closed");
            ok(s.unknownJournal.equals(original), "no pierde journal parcialmente corrupto"); financial(s);
        }
        WidgetSnapshotArbiter.State partial = pending("ev\tkey\nother\tother-key");
        ok(app(partial, "|ev|", "") && partial.unknownPending, "ACK parcial no vacía toda cola");
        ok(partial.unknownJournal.equals("other\tother-key"), "conserva evento no cubierto");
        ok(app(partial, "", "|other-key|") && !partial.unknownPending, "lápida exacta del restante");
        WidgetSnapshotArbiter.State duplicate = base();
        ok(WidgetSnapshotArbiter.pendingUnknown(duplicate, "ev", "key"), "alta desconocida");
        String canonical = duplicate.unknownJournal;
        ok(WidgetSnapshotArbiter.pendingUnknown(duplicate, "ev", "key"), "reentrega desconocida");
        ok(duplicate.unknownJournal.equals(canonical) && !canonical.endsWith("\n"), "dedup alta sin newline final");
        duplicate.unknownJournal = "ev\tkey\nev\tkey\n  ";
        ok(app(duplicate, "", "") && duplicate.unknownPending, "duplicado legacy sin ACK se conserva");
        ok(app(duplicate, "|ev|", "") && !duplicate.unknownPending, "ACK cubre duplicados sin sumar importes");
        financial(duplicate);
        WidgetSnapshotArbiter.State scope = base();
        scope.journal = "ev\t5.0\t5.0\t5.0\t1\t1\tkey";
        ok(WidgetSnapshotArbiter.invalidateScope(scope), "selección distinta invalida contribución");
        ok(scope.unknownJournal.equals("ev\tkey"), "traslada sólo identidad sin newline final");
        ok(WidgetSnapshotArbiter.invalidateScope(scope) && scope.unknownJournal.equals("ev\tkey"), "dedup scope");
        ok(app(scope, "", "") && scope.unknownPending, "foto nueva no confirma pago anterior"); financial(scope);
        ok(app(scope, "", "|key|") && !scope.unknownPending, "lápida explícita sí cubre");
        System.out.println("CANDIDATE_PASS assertions=" + assertions + "; Java real; datos sintéticos; no APK/Android");
    }
}
