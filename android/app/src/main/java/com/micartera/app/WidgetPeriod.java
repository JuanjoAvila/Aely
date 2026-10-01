package com.micartera.app;

import java.util.Calendar;
import java.util.TimeZone;

/**
 * QUÉ PERIODO Y QUÉ CIFRA ENSEÑA EL WIDGET (INC-2909-01 E2, 30/9).
 *
 * Hasta la APK 51 el widget solo sabía de mes natural y sus textos eran fijos en castellano. El
 * dueño lo vio el 30/9: «el widget solo enseña Balance, Inicio Mi ciclo». Con el contrato v2 la
 * app manda la misma ventana que Inicio (mes natural o ciclo desde el cobro) y la magnitud que
 * Inicio usa en ella (gasto bruto en el mes, neto en el ciclo), y el widget lo dice en su idioma.
 *
 * Java puro a propósito: lo ejecuta `tests/widget-arbitraje.test.mjs` con javac, sin Android.
 */
final class WidgetPeriod {
    static final int CONTRACT = 2;
    static final String CICLO = "ciclo", MES = "mes";
    /** Mismo tope que `lastPaydayOf`: pasado este plazo la app ya no ancla el ciclo. */
    static final long CICLO_MAX_MS = 45L * 86400000L;

    private WidgetPeriod() {}

    /** La APK nueva nunca interpreta una negociación fallida como permiso para degradar v2. */
    static boolean clientV2(int contract) { return contract >= CONTRACT; }

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

    static boolean cycleValid(long start, long now) {
        return start > 0 && start <= now && now - start <= CICLO_MAX_MS;
    }

    /** La ventana que el widget da por buena AHORA para lo que tiene guardado. */
    static long current(int contract, String kind, long storedStart, long now) {
        return contract >= CONTRACT && CICLO.equals(kind) && cycleValid(storedStart, now)
                ? storedStart : monthStart(now);
    }

    /** ¿Se acepta la foto de la app? Un ciclo solo con contrato v2 y dentro de su plazo. */
    static boolean acceptApp(int contract, String kind, long periodStart, long now) {
        if (contract >= CONTRACT && CICLO.equals(kind)) return cycleValid(periodStart, now);
        return periodStart == monthStart(now);
    }

    /**
     * ¿Se acepta la respuesta de `ingest`? Con el widget en v2 solo vale un servidor v2 de la
     * MISMA ventana: un `ingest` antiguo calcula mes natural con la regla de Gastos, y mezclarlo
     * con la foto de la app es justo el «se arregla y al rato vuelve» de otras veces.
     */
    static boolean acceptServer(int storedContract, String storedKind, long storedStart,
                                int respContract, String respKind, long respStart, long now) {
        if (storedContract < CONTRACT) return respStart == monthStart(now);
        String kind = CICLO.equals(storedKind) ? CICLO : MES;
        return respContract >= CONTRACT && kind.equals(respKind)
                && respStart == current(storedContract, storedKind, storedStart, now);
    }

    /** Sin evidencia del mismo alcance de bancos/presupuesto, un total v2 no se demuestra. */
    static boolean sameScope(String stored, String response) {
        return stored != null && !stored.isEmpty() && stored.equals(response);
    }

    /** Una foto de otra ventana no se enseña como si fuera de hoy. */
    static boolean stale(int contract, String kind, long start, long now) {
        if (start <= 0) return false;
        return start != current(contract, kind, start, now);
    }

    static final int TITULO = 0, QUEDAN = 1, EXCESO = 2, SIN_PRESUPUESTO = 3, PUEDES = 4,
            SIN_DATOS = 5, ABRE_APP = 6, ACTUALIZADO = 7;

    /**
     * Textos completos por idioma: el orden de las palabras cambia entre ellos. `{b}` presupuesto,
     * `{l}` lo que queda, `{x}` exceso. La APK 51 y un contrato antiguo siguen en castellano y mes.
     */
    static String[] labels(int contract, String lang, String kind, String magnitude) {
        boolean v2 = contract >= CONTRACT;
        boolean ciclo = v2 && CICLO.equals(kind);
        boolean neto = v2 && "neto".equals(magnitude);
        String l = v2 ? lang : "es";
        if ("en".equals(l)) {
            String p = ciclo ? "this cycle" : "this month";
            return new String[]{(ciclo ? "AELY · MY CYCLE" : "AELY · THIS MONTH") + (v2 ? (neto ? " · NET SPENDING" : " · SPENT") : ""),
                    "of {b} " + p + " · {l} left", "of {b} " + p + " · {x} over 🚨",
                    (neto ? "net " : "spent ") + p, "✅ You can spend ",
                    "No data for " + p, "Open the app to update", "updated "};
        }
        if ("ca".equals(l)) {
            String p = ciclo ? "aquest cicle" : "aquest mes";
            return new String[]{(ciclo ? "AELY · EL MEU CICLE" : "AELY · AQUEST MES") + (v2 ? (neto ? " · DESPESA NETA" : " · DESPESA") : ""),
                    "de {b} " + p + " · et queden {l}", "de {b} " + p + " · {x} de més 🚨",
                    (neto ? "net " : "gastat ") + p, "✅ Pots gastar ",
                    "Sense dades d'" + p, "Obre l'app per actualitzar", "actualitzat "};
        }
        String p = ciclo ? "este ciclo" : "este mes";
        return new String[]{(ciclo ? "AELY · MI CICLO" : "AELY · ESTE MES") + (v2 ? (neto ? " · GASTO NETO" : " · GASTO") : ""),
                "de {b} " + p + " · te quedan {l}", "de {b} " + p + " · {x} de más 🚨",
                (neto ? "neto " : "gastado ") + p, "✅ Puedes gastar ",
                "Sin datos de " + p, "Abre la app para actualizar", "actualizado "};
    }
}
