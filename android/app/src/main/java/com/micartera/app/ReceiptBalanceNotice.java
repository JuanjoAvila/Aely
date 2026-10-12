package com.micartera.app;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.Locale;
import java.util.Map;

/** La previsión pertenece a la web: Java solo acepta un veredicto vigente y lo presenta. */
final class ReceiptBalanceNotice {
    private ReceiptBalanceNotice() {}

    private static Long cents(Object value) {
        if (!(value instanceof Number)) return null;
        double n = ((Number) value).doubleValue();
        if (Double.isNaN(n) || Double.isInfinite(n) || n < 0 || n > 9007199254740991d || n != Math.rint(n)) return null;
        return ((Number) value).longValue();
    }

    private static String money(BigDecimal amount, String lang) {
        // La web conserva el formato decimal es-ES también al cambiar el idioma del texto.
        NumberFormat nf = NumberFormat.getInstance(new Locale("es", "ES"));
        nf.setMinimumFractionDigits(2);
        nf.setMaximumFractionDigits(2);
        return nf.format(amount) + " €";
    }

    static String[] render(Map<String, Object> notice, String today, String tomorrow,
                           String ym, int day, String name, double amount) {
        if (!(amount > 0) || Double.isInfinite(amount) || notice == null || !(notice.get("v") instanceof Number)
                || ((Number) notice.get("v")).doubleValue() != 1d) return null;
        Object language = notice.get("lang"), state = notice.get("state"), bank = notice.get("bankLabel");
        if (!("es".equals(language) || "en".equals(language) || "ca".equals(language))
                || !("enough".equals(state) || "short".equals(state))
                || !(bank instanceof String) || ((String) bank).trim().isEmpty()) return null;
        // Las fechas de referencia vienen del reloj local del worker; comparar literalmente
        // evita aceptar formatos relajados, días imposibles o una previsión de ayer.
        if (!today.equals(notice.get("calculatedOn")) || !tomorrow.equals(notice.get("dueOn"))
                || !tomorrow.equals(ym + "-" + String.format(Locale.ROOT, "%02d", day))) return null;
        boolean enough = "enough".equals(state);
        if (notice.containsKey(enough ? "shortfallCents" : "remainingCents")) return null;
        Long value = cents(notice.get(enough ? "remainingCents" : "shortfallCents"));
        if (enough ? notice.containsKey("remainingCents") && value == null : value == null || value == 0) return null;
        String lang = (String) language, label = (String) bank;
        String x = value == null ? "" : money(BigDecimal.valueOf(value, 2), lang);
        String bill = money(BigDecimal.valueOf(amount), lang), title, body, suffix;
        if ("en".equals(lang)) {
            title = "Bill due tomorrow";
            body = name + ": " + bill + " will be charged tomorrow. If something's off, there's still time.";
            suffix = enough ? "There should be enough in " + label + " to pay it" + (value == null ? "." : ", with " + x + " left.")
                    : "In " + label + ", you would be " + x + " short of paying it.";
        } else if ("ca".equals(lang)) {
            title = "Demà toca rebut";
            body = name + ": demà es cobren " + bill + ". Si alguna cosa no quadra, encara ets a temps.";
            suffix = enough ? "A " + label + " n'hi hauria prou per pagar-lo" + (value == null ? "." : "; quedarien " + x + ".")
                    : "A " + label + " faltarien " + x + " per pagar-lo.";
        } else {
            title = "Mañana toca recibo";
            body = name + ": mañana se cobran " + bill + ". Si algo no cuadra, aún estás a tiempo.";
            suffix = enough ? "En " + label + " alcanzaría para pagarlo" + (value == null ? "." : "; quedarían " + x + ".")
                    : "En " + label + " faltarían " + x + " para pagarlo.";
        }
        return new String[]{title, body + " " + suffix};
    }
}
