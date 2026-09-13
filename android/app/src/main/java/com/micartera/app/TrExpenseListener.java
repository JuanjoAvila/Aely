package com.micartera.app;

import android.content.Intent;
import android.os.Build;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.NumberFormat;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Lector de notificaciones:
 *   1) Trade Republic → Edge Function `ingest` (apunta el gasto; parsea en servidor).
 *   2) Otros bancos (Caixa, Sabadell…) → NO parsea importe; marca ping + broadcast para
 *      que la WebView dispare `bankSync` por Open Banking (alpha22 / v3.111).
 *
 * La URL con el token NO va en el código (el repo es público): se lee de
 * BuildConfig.INGEST_URL, que app/build.gradle rellena desde local.properties
 * (clave MICARTERA_INGEST_URL) — fichero que git ignora.
 */
public class TrExpenseListener extends NotificationListenerService {

    // Paquete de Trade Republic (verificar en el móvil: Ajustes → Apps → Trade Republic).
    private static final String TR_PACKAGE = "de.traderepublic.app";
    private static final Pattern HAS_AMOUNT = Pattern.compile("\\d+[.,]\\d+");

    /** Broadcast que escucha MiCarteraPlugin para emitir el evento JS `bankNotif`. */
    public static final String ACTION_BANK_NOTIF = "com.micartera.app.BANK_NOTIF";

    // Paquetes de apps bancarias ES (IDs habituales; si falta alguno se añade sin parsear texto).
    private static final Set<String> BANK_PACKAGES = new HashSet<>(Arrays.asList(
            "es.lacaixa.mobile.android.newwapicon",   // CaixaBank
            "com.caixabank.mobile.android",
            "com.caixabank.app",
            "com.bancsabadell.android",               // Sabadell
            "com.bancsabadell.wallet",
            "com.bbva.bbvacontigo",                    // BBVA
            "es.bancosantander.android",              // Santander
            "com.ing.mobile",                         // ING
            "www.ingdirect.nativeframe",
            "com.bankinter.android",
            "com.imaginbank.app",
            "com.openbank",
            "es.unicaja.unicajamovil",
            "com.kutxabank.android",
            "es.evobanco.bancomovil",
            "com.abanca.bm.android",
            "es.ibercaja.ibercaja",
            "com.db.pbc.mibanco"
    ));

    /* GOOGLE WALLET (2026-08-06). El paquete NO está adivinado: se leyó del móvil del usuario con
       `adb shell pm list packages`. Los otros dos son variantes históricas del mismo Wallet, por si
       una actualización o un cambio de país devuelve el ID viejo; si no existen, no molestan.

       Wallet importa porque notifica TODAS las tarjetas —incluida Revolut, que aquí no tiene Open
       Banking— y porque es lo que salta al pagar con Google Pay. El gasto de 76,08 € de Splau del
       6/8 «desapareció» exactamente por no escuchar aquí: la noti estaba en el móvil, intacta. */
    private static final Set<String> WALLET_PACKAGES = new HashSet<>(Arrays.asList(
            "com.google.android.apps.walletnfcrel",   // el de su móvil, verificado
            "com.google.android.apps.wallet",
            "com.google.android.gms"
    ));

    /* El canal de las notis de PAGO de Wallet, leído del móvil con `dumpsys notification`:
       `tapandpay.transactions.low`. Filtrar por canal es mucho más fino que filtrar por texto —
       los pases de embarque, las tarjetas de fidelización y los avisos de «tarjeta añadida» van por
       canales distintos y ni se miran. Si algún día Google lo renombra, Wallet dejará de entrar y
       ESTA es la línea que hay que mirar (no habrá falsos positivos, solo silencio). */
    private static final String WALLET_CHANNEL = "tapandpay";

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        String pkg = sbn.getPackageName();
        if (TR_PACKAGE.equals(pkg)) {
            handleNotiGasto(sbn, "tr");
            return;
        }
        if (WALLET_PACKAGES.contains(pkg)) {
            if (esPagoDeWallet(sbn)) handleNotiGasto(sbn, "wallet");
            return;
        }
        if (BANK_PACKAGES.contains(pkg)) {
            handleBankWake(pkg);
        }
    }

    /**
     * ¿Esta noti de Wallet es una compra? Se decide por el CANAL, no por el texto.
     *
     * `com.google.android.gms` está en la lista de paquetes y publica notificaciones de mil cosas;
     * sin este filtro entraría cualquiera que llevara un número con decimales. Con el canal, solo
     * pasan las de pago. Si el móvil es tan viejo que no hay canales (anterior a Android 8), se
     * prefiere no apuntar nada antes que apuntar basura.
     */
    private boolean esPagoDeWallet(StatusBarNotification sbn) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false;
        String canal = sbn.getNotification().getChannelId();
        return canal != null && canal.contains(WALLET_CHANNEL);
    }

    /**
     * Noti de banco tradicional: solo despierta sync OB. Sin leer importe/comercio
     * (las notis suelen ser genéricas y se rompen; PSD2 trae el movimiento real).
     */
    private void handleBankWake(String pkg) {
        android.content.SharedPreferences prefs =
                getSharedPreferences("micartera_banksync", MODE_PRIVATE);
        // Defecto ON; Ajustes → «Al detectar aviso del banco…» lo apaga vía setNotifPrefs.
        if (!prefs.getBoolean("onNotif", true)) return;

        long now = System.currentTimeMillis();
        // Debounce nativo 2 min (límite PSD2 desatendido ~4/día + no martillar al abrir la app).
        if (now - prefs.getLong("lastPing", 0) < 120000) return;
        prefs.edit()
                .putLong("lastPing", now)
                .putBoolean("pending", true)
                .putString("lastPkg", pkg != null ? pkg : "")
                .apply();

        Intent i = new Intent(ACTION_BANK_NOTIF);
        i.setPackage(getPackageName());
        sendBroadcast(i);
    }

    /**
     * Una noti que representa un gasto → `ingest`. `fuente` dice de dónde viene, porque el formato
     * cambia: Trade Republic lo mete todo en la frase («Has gastado 12,50 € en Mercadona») y Wallet
     * pone el comercio en el TÍTULO y el importe en el texto. El servidor necesita saberlo para no
     * escanear el título de Wallet buscando ruido (ahí el título es el nombre del bar).
     */
    private void handleNotiGasto(StatusBarNotification sbn, String fuente) {
        // MULTIUSUARIO (migración 0008): la URL de `ingest` con el token del usuario la guarda la
        // web en estas prefs (Ajustes → "Apuntar aquí mis gastos de TR"). Sin ella no hay a dónde
        // mandar → no hacemos nada (evita apuntar en la cuenta de otro).
        // ⚠ El fallback a BuildConfig.INGEST_URL SOLO en la APK de depuración (14/9, OPS-06): en
        // release llevaba el token del dueño y un móvil sin token propio le mandaba sus gastos a él.
        String ingestUrl = getSharedPreferences("micartera_ingest", MODE_PRIVATE).getString("url", "");
        if ((ingestUrl == null || ingestUrl.isEmpty()) && BuildConfig.DEBUG) ingestUrl = BuildConfig.INGEST_URL;
        if (ingestUrl == null || ingestUrl.isEmpty()) return;
        final String INGEST_URL = ingestUrl;

        CharSequence titleCs = sbn.getNotification().extras.getCharSequence("android.title");
        CharSequence textCs = sbn.getNotification().extras.getCharSequence("android.text");
        final String title = titleCs != null ? titleCs.toString() : "";
        final String text = textCs != null ? textCs.toString() : "";

        // Solo notificaciones con pinta de movimiento (mencionan un importe).
        if (text.isEmpty()) return;
        if (!text.contains("€") && !HAS_AMOUNT.matcher(text).find()) return;

        // DEDUPE (bug pareja 2026-07-10): Android re-entrega la MISMA notificación cuando TR la
        // actualiza (y al reconectar el listener) → cada re-entrega disparaba otro POST y otra
        // noti de confirmación ("a veces 2"). El servidor ya dedupea el GASTO (expenses_dedup_idx),
        // pero la confirmación local salía igual. Mismo texto en <3 min ⇒ ya procesada, fuera.
        android.content.SharedPreferences dd =
                getSharedPreferences("micartera_ingest_dedupe", MODE_PRIVATE);
        int sig = (title + "|" + text).hashCode();
        long now = System.currentTimeMillis();
        if (dd.getInt("sig", 0) == sig && now - dd.getLong("ts", 0) < 180000) return;
        dd.edit().putInt("sig", sig).putLong("ts", now).apply();

        new Thread(() -> {
            String body;
            try {
                /* La FECHA se sella AQUÍ, con el reloj del momento de la compra, y viaja en el
                   cuerpo. Por eso un reintento tardío sigue apuntando el gasto en su día y su hora
                   —no en la de la reconexión— y el dedup del servidor (mismo importe a <10 min) lo
                   reconoce como el mismo movimiento si el primer envío llegó a colarse. */
                body = new JSONObject()
                        .put("texto", text)
                        .put("titulo", title)
                        .put("fuente", fuente)
                        .put("fecha", String.valueOf(System.currentTimeMillis()))
                        .toString();
            } catch (Exception e) {
                return;   // JSONObject.put solo lanza con claves nulas; aquí no puede pasar.
            }
            if (postIngest(INGEST_URL, body) == REINTENTAR) encolar(INGEST_URL, body);
            vaciarCola();
        }).start();
    }

    // ---- Envío + COLA DE REINTENTOS -------------------------------------------------------
    // Hasta ahora un fallo de red se tragaba con `catch (Exception ignored)` y ahí moría el gasto:
    // sin fila, sin aviso y sin error en el panel, porque el error pasaba en el móvil y nunca
    // llegaba a contarse. Es la explicación de un gasto suelto que no entra y que no se puede
    // diagnosticar después (el de Splau, 2026-08-06): dentro de un centro comercial la cobertura
    // va y viene justo cuando llega la noti del pago. Ahora lo que no sale se guarda y se
    // reintenta en la siguiente noti y al reconectar el lector.

    private static final int OK = 0;
    private static final int REINTENTAR = 1;   // red caída, timeout, 5xx, 429 → vuelve a intentarse
    private static final int DESCARTAR = 2;    // 4xx de verdad (token inválido…): reintentar no arregla nada

    /** Prefs de la cola. Una sola clave con un JSONArray: son pocos elementos y raros. */
    private static final String COLA_PREFS = "micartera_ingest_cola";
    private static final int COLA_MAX = 30;
    private static final long COLA_TTL = 7L * 24 * 60 * 60 * 1000;   // una semana

    private int postIngest(String ingestUrl, String body) {
        HttpURLConnection conn = null;
        try {
            // EL TOKEN VIAJA EN CABECERA, NO EN LA URL (seguridad, 2026-07-25). Un `?token=…`
            // acaba en sitios donde no debería: logs de acceso del proxy, historial de
            // peticiones, trazas de error, cabeceras Referer. Es la única credencial que
            // protege la función que apunta gastos en tu cuenta, así que fuera del query
            // string. La Edge Function ya aceptaba `x-ingest-token` desde el principio, de
            // modo que un APK viejo con el token en la URL SIGUE FUNCIONANDO: se puede
            // desplegar sin coordinar versiones.
            String[] parts = splitIngest(ingestUrl);
            conn = (HttpURLConnection) new URL(parts[0]).openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            if (!parts[1].isEmpty()) conn.setRequestProperty("x-ingest-token", parts[1]);
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(15000);
            conn.setDoOutput(true);
            conn.getOutputStream().write(body.getBytes(StandardCharsets.UTF_8));
            int code = conn.getResponseCode();
            String resp = readAll(code >= 400 ? conn.getErrorStream() : conn.getInputStream());
            if (code >= 200 && code < 300) {
                if (!resp.isEmpty()) handleResponse(resp);
                return OK;
            }
            // 429 es el freno por IP de la Edge Function y 408 un timeout: ambos pasan solos.
            if (code >= 500 || code == 429 || code == 408) return REINTENTAR;
            return DESCARTAR;
        } catch (Exception e) {
            return REINTENTAR;   // sin red, DNS caído, timeout… todo esto se cura esperando
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    /** Guarda un envío fallido para más tarde. Con la URL: el token puede cambiar entre medias. */
    private void encolar(String ingestUrl, String body) {
        try {
            android.content.SharedPreferences p = getSharedPreferences(COLA_PREFS, MODE_PRIVATE);
            org.json.JSONArray cola = leerCola(p);
            cola.put(new JSONObject().put("u", ingestUrl).put("b", body).put("ts", System.currentTimeMillis()));
            // Si se desborda se tiran los MÁS VIEJOS: un gasto de hace días ya se habrá apuntado
            // a mano, el de hace un minuto no.
            while (cola.length() > COLA_MAX) cola.remove(0);
            p.edit().putString("items", cola.toString()).apply();
        } catch (Exception ignored) {}
    }

    /**
     * Reintenta lo que quedó pendiente. Se llama tras cada noti de TR y al conectar el lector
     * (que es cuando el móvil suele recuperar la red o volver de una reinstalación).
     * Lo que sigue fallando se queda en la cola; lo caducado se tira.
     */
    private void vaciarCola() {
        android.content.SharedPreferences p = getSharedPreferences(COLA_PREFS, MODE_PRIVATE);
        org.json.JSONArray cola = leerCola(p);
        if (cola.length() == 0) return;

        org.json.JSONArray quedan = new org.json.JSONArray();
        long now = System.currentTimeMillis();
        for (int i = 0; i < cola.length(); i++) {
            JSONObject it = cola.optJSONObject(i);
            if (it == null) continue;
            String body = it.optString("b", "");
            String url = it.optString("u", "");
            if (body.isEmpty() || url.isEmpty()) continue;
            // Caducado: una semana después el gasto ya no lo arregla nadie desde aquí, y seguir
            // reintentando en cada noti es martillear al servidor para nada.
            if (now - it.optLong("ts", now) > COLA_TTL) continue;
            if (postIngest(url, body) == REINTENTAR) quedan.put(it);
        }
        if (quedan.length() == 0) p.edit().remove("items").apply();
        else p.edit().putString("items", quedan.toString()).apply();
    }

    private static org.json.JSONArray leerCola(android.content.SharedPreferences p) {
        try {
            return new org.json.JSONArray(p.getString("items", "[]"));
        } catch (Exception e) {
            return new org.json.JSONArray();
        }
    }

    /**
     * Android desconecta y reconecta este servicio por su cuenta (actualizaciones, memoria, boot).
     * Reconectar es la mejor pista de que hay red otra vez, así que es el momento de vaciar cola.
     */
    @Override
    public void onListenerConnected() {
        super.onListenerConnected();
        new Thread(this::vaciarCola).start();
    }

    /**
     * Parte la URL de ingest en {URL sin el token, token}. El token se guardó dentro del query
     * string (`…/ingest?token=abc`) desde el primer día; aquí se saca para mandarlo en cabecera.
     * Conserva cualquier OTRO parámetro que hubiera, y si no hay token devuelve la URL intacta
     * (así un ajuste antiguo o una URL escrita a mano siguen valiendo).
     */
    static String[] splitIngest(String raw) {
        if (raw == null) return new String[]{"", ""};
        int q = raw.indexOf('?');
        if (q < 0) return new String[]{raw, ""};
        String token = "";
        StringBuilder rest = new StringBuilder();
        for (String kv : raw.substring(q + 1).split("&")) {
            if (kv.isEmpty()) continue;
            if (kv.startsWith("token=")) { token = kv.substring(6); continue; }
            rest.append(rest.length() == 0 ? "?" : "&").append(kv);
        }
        // El servidor lee el query con searchParams, que DECODIFICA. Al pasarlo a cabecera hay que
        // decodificar aquí para mandar el mismo valor. Los tokens por usuario son hex (mcRandomToken)
        // y decodifican a sí mismos; esto solo importa para un token legacy con caracteres raros.
        try { token = java.net.URLDecoder.decode(token, "UTF-8"); } catch (Exception ignored) {}
        return new String[]{raw.substring(0, q) + rest, token};
    }

    private static String readAll(InputStream is) {
        if (is == null) return "";
        try (InputStream in = is; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buf = new byte[4096];
            int n;
            while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return "";
        }
    }

    private static String eur(double n) {
        NumberFormat nf = NumberFormat.getInstance(new Locale("es", "ES"));
        nf.setMinimumFractionDigits(2);
        nf.setMaximumFractionDigits(2);
        return nf.format(n) + " €";
    }

    private static String eur0(double n) {
        NumberFormat nf = NumberFormat.getInstance(new Locale("es", "ES"));
        nf.setMaximumFractionDigits(0);
        return nf.format(Math.round(n)) + " €";
    }

    /** Confirmación + alerta de presupuesto + widget, con lo que devuelve `ingest`. */
    private void handleResponse(String resp) {
        try {
            JSONObject r = new JSONObject(resp);
            if (!r.optBoolean("ok", false)) return;
            String tipo = r.optString("tipo", "");
            if (r.optBoolean("skipped", false) || tipo.equals("ignorado")) return;   // ruido: ni noti ni widget

            double importe = r.optDouble("importe", 0);
            String comercio = r.optString("comercio", "");
            /* Id derivado del GASTO, no del reloj: si el mismo cargo se procesa dos veces (Android
               reentrega `onNotificationPosted` cuando el banco actualiza su propia noti), la
               confirmación sustituye a la anterior en vez de apilarse («las notis se duplican»,
               2026-07-26). Sigue siendo una noti por gasto distinto. */
            int id = Notif.idFor("exp|" + importe + "|" + comercio);

            // La alerta se mira ANTES de la confirmación: si es «gasto tocho», esa noti ya dice
            // importe y comercio → la "✓ Gasto apuntado" salía ADEMÁS, duplicada (feedback 2026-07-21).
            JSONObject alert = r.optJSONObject("alert");
            String alertKind = alert != null ? alert.optString("kind", "") : "";
            boolean big = alertKind.equals("big");

            // Ajuste "confirmar gastos" (punto 9): TR ya avisa del cargo, así que la confirmación
            // "✓ Gasto apuntado" es opcional (MiCartera.setNotifPrefs). Los avisos de presupuesto
            // de abajo salen SIEMPRE — esos no los da el banco.
            boolean confirm = getSharedPreferences("micartera_notifprefs", MODE_PRIVATE)
                    .getBoolean("expenseConfirm", true);
            // Punto 5: deep-link a la ficha del gasto — al tocar la noti, la web abre este gasto en Gastos.
            String gotoTok = "exp|" + importe + "|" + comercio;
            if (confirm && !big) {
                if (tipo.equals("ingreso")) {
                    Notif.show(this, "💰 Dinero recibido", "+" + eur(-importe) + " · " + comercio, id, gotoTok);
                } else if (tipo.equals("gasto_nocard")) {
                    Notif.show(this, "🔄 Bizum enviado apuntado", eur(importe) + " · " + comercio, id, gotoTok);
                } else {
                    Notif.show(this, "✓ Gasto apuntado", eur(importe) + " en " + comercio, id, gotoTok);
                }
            }

            if (alert != null) {
                double spent = alert.optDouble("monthSpent", 0);
                double budget = alert.optDouble("budget", 0);
                if (alertKind.equals("over")) {
                    Notif.show(this, "🚨 Presupuesto superado", "Llevas " + eur0(spent) + " de " + eur0(budget) + " este mes", id + 1);
                } else if (alertKind.equals("p95")) {
                    // p95/p50 añadidos 2026-07-18 (los calcula `ingest`; con APK viejo se ignoran sin romper)
                    Notif.show(this, "🔶 ¡95% del presupuesto!", eur0(spent) + " de " + eur0(budget) + " este mes", id + 1);
                } else if (alertKind.equals("p80")) {
                    long p = budget > 0 ? Math.round(spent / budget * 100) : 0;
                    Notif.show(this, "⚠️ Ya llevas el " + p + "% del presupuesto", eur0(spent) + " de " + eur0(budget) + " este mes", id + 1);
                } else if (alertKind.equals("p50")) {
                    Notif.show(this, "🟢 Mitad del presupuesto", eur0(spent) + " de " + eur0(budget) + " este mes", id + 1);
                } else if (big) {
                    // Sustituye a la confirmación (arriba se salta): una sola noti, con su deep-link.
                    Notif.show(this, "💥 Gasto tocho apuntado", eur(importe) + " en " + comercio, id + 1, gotoTok);
                }
            }

            JSONObject month = r.optJSONObject("month");
            if (month != null) {
                // `counts` lo decide el servidor con la misma regla que la app (un recibo o una
                // inversión no mueven el presupuesto ni salen de la cuenta de gasto diario). Si
                // `ingest` es viejo y no lo manda, se asume que sí cuenta solo cuando es un gasto:
                // un ingreso nunca debe bajar el saldo del widget.
                boolean counts = month.has("counts")
                        ? month.optInt("counts", 0) == 1
                        : tipo.startsWith("gasto");
                MiCarteraWidget.saveMonth(this,
                        month.optDouble("spent", 0),
                        month.optDouble("budget", 0),
                        month.optDouble("budgetLeft", -1),   // −1 = ingest viejo, no lo manda
                        importe,
                        counts);
            }
        } catch (Exception ignored) {}
    }
}
