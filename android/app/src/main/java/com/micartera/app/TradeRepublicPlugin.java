package com.micartera.app;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.SharedPreferences;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.appcompat.app.AppCompatActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.util.concurrent.ConcurrentHashMap;

/**
 * Puente nativo con Trade Republic (opt-in "beta"). Contrato que espera la web
 * (public/index.html, componente TRSync → trBridge()):
 *
 *   status()                     -> { connected }
 *   login({phone,pin})           -> { ok, processId?, error? }   (dispara el 2FA)
 *   verify({processId,code})     -> { ok, error? }               (guarda la sesión en cookies)
 *   sync()                       -> { ok, positions:[{isin,name,shares,value,cost}], cash?, error? }
 *   logout()                     -> { ok }
 *
 * CLAVE de diseño: TODO el HTTP/WebSocket contra TR se hace DENTRO de una WebView
 * oculta cargada en https://app.traderepublic.com — así el token de AWS WAF, las
 * cookies de sesión y el CORS los resuelve el propio navegador (la WebView ES un
 * navegador real). El JS inyectado es ASÍNCRONO (fetch/WebSocket), y como
 * evaluateJavascript NO espera Promesas, el resultado vuelve por un puente
 * @JavascriptInterface (AndroidTR.result(id,json)) que resuelve el PluginCall.
 *
 * Es una vía NO oficial (la misma que usa la web de TR): contra sus Términos,
 * puede pedir 2FA cada cierto tiempo y romperse si TR cambia el login.
 */
@CapacitorPlugin(name = "TradeRepublic")
public class TradeRepublicPlugin extends Plugin {

    private static final String TR_APP = "https://app.traderepublic.com/";
    /** Página aparcada: sin SPA de TR viva no hay rotaciones de sesión que nadie vigile (ver handleOnPause). */
    private static final String BLANK = "about:blank";

    /**
     * Helper JS inyectado en TODA petición contra api.traderepublic.com.
     *
     * EL BUG DE LAS 4 VUELTAS ANTERIORES: la WebView vive en app.traderepublic.com y hace
     * fetch a api.traderepublic.com (subdominio distinto). Cuando el token del AWS WAF caduca
     * (arranque en frío), el WAF intercepta la petición y responde SIN cabeceras CORS → el
     * navegador lanza `TypeError: Failed to fetch` (ni siquiera hay status). El intento previo
     * llamaba a AwsWafIntegration.getToken() y luego hacía un fetch NORMAL; pero getToken() deja
     * el token en una COOKIE de dominio app.traderepublic.com, que NO viaja a api.traderepublic.com
     * → mismo fallo idéntico.
     *
     * FIX: usar el wrapper OFICIAL window.AwsWafIntegration.fetch(), que adjunta el token como
     * CABECERA `x-aws-waf-token` (eso sí cruza subdominios) y resuelve el challenge solo. Fallbacks
     * en cascada: (1) AWI.fetch → (2) getToken()+cabecera manual → (3) fetch pelado. `wafInfo()`
     * expone el estado del SDK para que un fallo residual venga diagnosticado, no a ciegas.
     */
    private static final String WFETCH =
        "const wafInfo=()=>{const a=window.AwsWafIntegration;return a?('waf:fetch='+(typeof a.fetch)+'/token='+(typeof a.getToken)):'waf:absent';};" +
        // wafToken(force): con force=true intenta forceRefreshToken() (SDK moderno) — el getToken()
        // normal devuelve el token CACHEADO aunque el WAF ya lo rechace (diagnóstico alpha12: el SDK
        // estaba [waf:fetch=function/token=function] y aun así fallaba en frío → token rancio).
        "const wafToken=async(force)=>{try{const a=window.AwsWafIntegration;if(!a)return null;" +
        "if(force&&typeof a.forceRefreshToken==='function'){try{return await a.forceRefreshToken();}catch(e){}}" +
        "if(typeof a.getToken==='function')return await a.getToken();}catch(e){}return null;};" +
        "const wfetch=async(url,opts)=>{opts=opts||{};const a=window.AwsWafIntegration;" +
        "if(a&&typeof a.fetch==='function'){return await a.fetch(url,opts);}" +               // wrapper oficial: cabecera x-aws-waf-token
        "const tok=await wafToken();" +
        "if(tok){opts.headers=Object.assign({},opts.headers,{'x-aws-waf-token':tok});}" +      // fallback: cabecera manual
        "return await fetch(url,opts);};";                                                     // último recurso

    private WebView web;
    private boolean loaded = false;
    private boolean loading = false;
    private final java.util.List<Runnable> readyQueue = java.util.Collections.synchronizedList(new java.util.ArrayList<>());
    private final ConcurrentHashMap<String, PluginCall> pending = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, String> bodies = new ConcurrentHashMap<>();      // id → JS (para reintentar tras recargar)
    private final java.util.Set<String> verifyIds = java.util.Collections.newSetFromMap(new ConcurrentHashMap<>());
    private final java.util.Set<String> retriedIds = java.util.Collections.newSetFromMap(new ConcurrentHashMap<>());
    private final android.os.Handler main = new android.os.Handler(android.os.Looper.getMainLooper());

    // ---- Puente JS → nativo: el JS async llama esto al resolver su Promesa ----------
    private class Bridge {
        @JavascriptInterface
        public void result(String id, String json) {
            // ÚLTIMO RECURSO frío (alpha13): si aun con el token en cabecera el fetch peta a nivel
            // de red y todavía no lo hemos intentado, RECARGAMOS app.traderepublic.com (re-ejecuta
            // el challenge del AWS WAF desde cero, como haría un navegador de verdad) y reinyectamos
            // el MISMO JS una vez. La recarga destruye el contexto JS anterior, por eso se orquesta
            // aquí en nativo y no dentro del propio script.
            try {
                JSObject peek = new JSObject(json);
                String err = peek.getString("error", "");
                if (!peek.optBoolean("ok", false) && err != null && err.contains("Failed to fetch")
                        && pending.containsKey(id) && !retriedIds.contains(id)) {
                    retriedIds.add(id);
                    String body = bodies.get(id);
                    if (body != null) { reloadThen(() -> run(id, body)); return; }
                }
            } catch (Exception ignored) {}
            PluginCall call = pending.remove(id);
            boolean wasVerify = verifyIds.remove(id);
            retriedIds.remove(id); bodies.remove(id);
            if (call == null) return;
            try {
                JSObject res = new JSObject(json);
                // DIAGNÓSTICO SIN CABLE (2026-07-25). El capítulo 1 de esta saga costó 7 intentos a
                // ciegas y se resolvió en 15 min el día que se miró el jar de cookies de verdad; el
                // capítulo 2 se dio por cerrado sin verificar y tampoco valía. Así que cuando algo
                // falla, la respuesta se lleva el estado del jar en `diag` (visible por CDP).
                // SOLO NOMBRES DE COOKIE, jamás valores: son la credencial de su banco.
                // Si aquí sale `tr_refresh` DOS VECES, es la prueba de la hipótesis de la cookie
                // duplicada en dos paths (ver snapshotCookies).
                // Va APARTE, no pegado a `error` (31/10/2026): la web pintaba el texto tal cual y
                // la familia veía «jar[…] snap[…] edad=0min restore=sí(7)» en la tarjeta. A
                // telemetría la web solo manda enums de aquí (ver trLogFailure), nunca el texto.
                if (!res.optBoolean("ok", false)) {
                    String base = res.getString("error", "");
                    if (base == null || base.isEmpty()) res.put("error", "TR falló");
                    JSObject diag = new JSObject();
                    try { JSONObject d = res.optJSONObject("diag"); if (d != null) diag = JSObject.fromJSONObject(d); } catch (Exception ignored) {}
                    jarDiag(diag);
                    res.put("diag", diag);
                }
                if (wasVerify && res.optBoolean("ok", false)) {
                    prefs().edit().putBoolean("connected", true).apply();   // sesión TR establecida
                }
                // NUNCA desconecta por un sync fallido (arrancar la app en frío a menudo
                // devolvía AUTHENTICATION/401 momentáneo y borraba connected → OTP otra vez).
                // Solo logout() pone connected=false. Si la sesión murió de verdad, el botón
                // Sincronizar lo canta y el usuario reconecta a mano (feedback 2026-07-17).
                // Persistir cookies AHORA (tr_session/tr_refresh acaban de sentarse o rotar).
                // Antes se hacía flush() síncrono en verify(), ANTES de que el fetch async
                // terminara → la sesión podía no llegar a disco y el 2FA volvía tras reiniciar.
                // alpha18 (DIAGNÓSTICO REAL de la saga en frío, chrome://inspect 2026-07-13): el
                // /session devolvía 401 —NO un challenge WAF— porque tr_refresh NO viajaba: había
                // DESAPARECIDO del jar tras matar la app. flush() no basta: Android solo persiste a
                // disco las cookies CON caducidad; las de sesión (sin Max-Age, como tr_refresh) se
                // tiran al morir el proceso. snapshotCookies() las guarda en prefs a mano para
                // re-inyectarlas en frío (restoreCookies en ensureWeb). El WAF nunca fue el problema.
                snapshotCookies();
                call.resolve(res);
            } catch (Exception e) {
                resolveErr(call, "respuesta ilegible de TR");
            }
        }

        // El sync llama esto JUSTO tras renovar sesión (antes de la fase WebSocket): TR rota
        // tr_refresh en cada /session y el snapshot del final de la llamada llega tarde si
        // Android mata la app a mitad de sync — el snapshot viejo «resucitaba» un refresh ya
        // consumido → 401 real y 2FA otra vez (feedback 2026-07-17: «caduca cada dos por tres»).
        @JavascriptInterface
        public void snap() { main.post(() -> snapshotCookies()); }
    }

    // ---- WebView oculta (perezosa, en el hilo de UI) --------------------------------
    // Los que esperan la página van a readyQueue (varios a la vez, y sobrevive recargas);
    // onPageFinished la drena. Antes el onReady se capturaba al crear el WebViewClient →
    // solo el PRIMER llamador se enteraba de la carga.
    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface", "AddJavascriptInterface"})
    private void ensureWeb(Runnable onReady) {
        AppCompatActivity act = getActivity();
        if (act == null) return;
        act.runOnUiThread(() -> {
            if (web == null) {
                // (alpha17 encendía aquí setWebContentsDebuggingEnabled para depurar la saga en frío
                // con chrome://inspect. RETIRADO en alpha19: la saga se cerró y dejarlo abriría la
                // WebView —con la sesión de TR dentro— a cualquiera con un cable y adb.)
                web = new WebView(act);
                web.getSettings().setJavaScriptEnabled(true);
                web.getSettings().setDomStorageEnabled(true);
                web.addJavascriptInterface(new Bridge(), "AndroidTR");
                CookieManager.getInstance().setAcceptCookie(true);
                CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);
                // ARRANQUE EN FRÍO (alpha16, hipótesis (a) de la saga TR): el challenge del AWS WAF
                // usa requestAnimationFrame/layout para generar el token. Un WebView creado pero
                // NUNCA añadido a la jerarquía de vistas está desacoplado de la ventana → su rAF y
                // sus pasadas de layout se estrangulan o no corren, así que el challenge nunca acaba
                // («Failed to fetch» eterno). Lo ATAMOS a la vista a 1×1 px con alpha 0 (imperceptible
                // pero "visible" para el pipeline de render, que es lo que el challenge necesita).
                // View.INVISIBLE/GONE NO sirven: rAF también se estrangula para vistas no visibles.
                try {
                    web.setAlpha(0f);
                    web.setLayerType(View.LAYER_TYPE_HARDWARE, null);
                    act.addContentView(web, new ViewGroup.LayoutParams(1, 1));
                    web.setOnTouchListener((v, e) -> true);   // 1px no molesta, pero por si acaso no capta toques útiles
                } catch (Throwable ignore) { /* si falla el attach, seguimos con el WebView desacoplado (comportamiento previo) */ }
                // ARRANQUE EN FRÍO (alpha14): la cookie aws-waf-token sobrevive al matar la app y el
                // SDK la reutiliza RANCIA (el WAF ya la rechaza) → challenge que nunca se rehace →
                // "Failed to fetch" eterno. La purgamos SOLO a ella (no tr_session/tr_refresh) para
                // forzar un challenge nuevo en esta primera carga.
                clearWafToken();
                web.setWebViewClient(new WebViewClient() {
                    @Override public void onPageFinished(WebView v, String url) {
                        // La página APARCADA (about:blank) no es TR: no hay contexto donde inyectar
                        // nada ni sesión que snapshotear. Marcarla como "cargada" haría que la
                        // siguiente llamada ejecutara su fetch contra about:blank y fallara.
                        if (url != null && url.startsWith("about:")) { loaded = false; loading = false; return; }
                        loaded = true; loading = false;
                        drainReady();
                        // La SPA de TR puede rotar tr_session/tr_refresh nada más arrancar (llama a
                        // /session por su cuenta). Si la app muere antes del snapshot del final de la
                        // siguiente llamada, esa rotación se perdía → 401 en el próximo frío. Guardamos
                        // a los 3 s (deja terminar sus fetches de arranque).
                        main.postDelayed(() -> snapshotCookies(), 3000);
                    }
                    @Override public void onReceivedError(WebView v, WebResourceRequest req, WebResourceError err) {
                        if (req != null && req.isForMainFrame()) { loaded = true; loading = false; drainReady(); }
                    }
                });
            }
            if (loaded) { if (onReady != null) onReady.run(); }
            else {
                if (onReady != null) readyQueue.add(onReady);
                if (!loading) { loading = true; restoreCookies(); web.loadUrl(TR_APP); }
            }
        });
    }

    // ---- Persistencia de la sesión de TR a través de matar la app (alpha18) ----------
    // getCookie(url) devuelve TODAS las cookies que viajarían a esa URL, incluidas las httpOnly
    // (a diferencia de document.cookie en JS) y las path-scoped a /api/v1/auth. Guardamos solo
    // las tr_* (sesión), NUNCA aws-waf-token (se refresca solo) ni analytics.
    private static final String SESSION_URL = "https://api.traderepublic.com/api/v1/auth/web/session";

    private void snapshotCookies() {
        CookieManager cm = CookieManager.getInstance();
        String raw = cm.getCookie(SESSION_URL);
        if (raw == null) raw = cm.getCookie("https://api.traderepublic.com/");
        java.util.LinkedHashMap<String, String> keep = new java.util.LinkedHashMap<>();
        if (raw != null) {
            for (String part : raw.split(";")) {
                String p = part.trim(); int eq = p.indexOf('=');
                if (eq <= 0) continue;
                String name = p.substring(0, eq);
                // ¡putIfAbsent, NO put! (capítulo 3 de la saga, 2026-07-25). El mismo nombre puede
                // aparecer DOS VECES en la cabecera: la que restauramos nosotros con `Path=/` y la
                // que TR sirve luego path-scoped a /api/v1/auth. Son cookies distintas para el jar.
                // RFC 6265 §5.4 las ordena de path MÁS específico a menos, así que la PRIMERA es la
                // de TR (la recién rotada, la buena) y la última la nuestra (ya consumida). Con
                // `put` ganaba la última → guardábamos el refresh muerto, y lo volvíamos a guardar
                // en cada snapshot: la sesión quedaba envenenada PARA SIEMPRE. Encaja exactamente
                // con el «se desloguea siempre, da igual que pase un segundo» del usuario.
                if (name.startsWith("tr_")) keep.putIfAbsent(name, p);   // tr_session / tr_refresh / tr_device
            }
        }
        // Solo guardamos si hay sesión DE VERDAD: así un frío fallido no machaca un snapshot bueno.
        if (keep.containsKey("tr_refresh") || keep.containsKey("tr_session")) {
            StringBuilder sb = new StringBuilder();
            for (String v : keep.values()) { if (sb.length() > 0) sb.append("; "); sb.append(v); }
            prefs().edit()
                .putString("cookieSnap", sb.toString())
                .putString("cookieSnapNames", android.text.TextUtils.join(",", keep.keySet()))   // diagnóstico adb
                .putLong("cookieSnapAt", System.currentTimeMillis())
                .apply();
        }
        cm.flush();
    }

    /** Qué hizo el último restore (enum: not_yet | no_snapshot | hot_jar | yes). Solo diagnóstico. */
    private volatile String lastRestore = "not_yet";
    private volatile int lastRestoreN = 0;

    /**
     * Foto del estado de la sesión para el `diag` de un error. **Solo nombres, nunca valores.**
     * Un nombre repetido en `jar` significa la MISMA cookie en dos paths distintos, que es
     * justo lo que envenenaba el snapshot (ver snapshotCookies).
     */
    private void jarDiag(JSObject out) {
        StringBuilder sb = new StringBuilder();
        try {
            String raw = CookieManager.getInstance().getCookie(SESSION_URL);
            boolean first = true;
            if (raw != null) {
                for (String part : raw.split(";")) {
                    String p = part.trim(); int eq = p.indexOf('=');
                    if (eq <= 0) continue;
                    String name = p.substring(0, eq);
                    if (!name.startsWith("tr_")) continue;
                    if (!first) sb.append(",");
                    sb.append(name); first = false;
                }
            }
        } catch (Exception ignored) { sb.append("?"); }
        out.put("jar", sb.toString());
        out.put("snap", prefs().getString("cookieSnapNames", ""));
        long at = prefs().getLong("cookieSnapAt", 0);
        if (at > 0) out.put("snapAgeMin", (System.currentTimeMillis() - at) / 60000);
        out.put("restore", lastRestore);
        out.put("restoreN", lastRestoreN);
    }

    private void restoreCookies() {
        String snap = prefs().getString("cookieSnap", null);
        if (snap == null || snap.isEmpty()) { lastRestore = "no_snapshot"; return; }
        CookieManager cm = CookieManager.getInstance();
        // Jar CALIENTE (ya hay tr_refresh vivo) → NO pisar: TR ROTA tr_refresh en cada /session y
        // el snapshot puede ir por detrás de la rotación; re-inyectarlo «resucita» un refresh ya
        // consumido → 401 real y 2FA sin motivo (feedback 2026-07-17: «caduca cada dos por tres»).
        // El restore es SOLO para el arranque en frío, cuando Android tiró las cookies de sesión.
        String cur = cm.getCookie(SESSION_URL);
        if (cur != null && cur.contains("tr_refresh=")) { lastRestore = "hot_jar"; return; }
        cm.setAcceptCookie(true);
        int n = 0;
        for (String part : snap.split(";")) {
            String p = part.trim(); if (p.isEmpty()) continue;
            n++;
            // host-only en api.traderepublic.com, Path=/ (llega a /api/v1/auth/*), Secure + SameSite=None
            // (la web va cross-site app→api). Se pierde el flag httpOnly: irrelevante para que viaje.
            cm.setCookie("https://api.traderepublic.com", p + "; Path=/; Secure; SameSite=None");
        }
        cm.flush();
        lastRestore = "yes"; lastRestoreN = n;
    }

    /** Recarga app.traderepublic.com y ejecuta `then` cuando termine (challenge WAF fresco). */
    private void reloadThen(Runnable then) {
        AppCompatActivity act = getActivity();
        if (act == null || web == null) { if (then != null) then.run(); return; }
        act.runOnUiThread(() -> {
            loaded = false; loading = true;
            clearWafToken();     // recarga = challenge WAF de cero: fuera el token viejo antes
            restoreCookies();    // y re-inyecta la sesión guardada por si la recarga es en frío
            if (then != null) readyQueue.add(then);
            web.loadUrl(TR_APP);
        });
    }

    /** Caduca SOLO la cookie aws-waf-token en los dominios de TR (no toca la sesión). */
    private void clearWafToken() {
        CookieManager cm = CookieManager.getInstance();
        String expire = "aws-waf-token=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/;";
        cm.setCookie("https://app.traderepublic.com", expire);
        cm.setCookie("https://api.traderepublic.com", expire);
        cm.setCookie("https://traderepublic.com", expire);
        cm.flush();
    }

    private void drainReady() {
        java.util.List<Runnable> jobs;
        synchronized (readyQueue) { jobs = new java.util.ArrayList<>(readyQueue); readyQueue.clear(); }
        // pequeño respiro tras cargar: deja al SDK del WAF de la página inicializarse
        for (Runnable r : jobs) main.postDelayed(r, 600);
    }

    // Al irse la app al fondo (el último aviso antes de que Android pueda matar el proceso)
    // guardamos la ÚLTIMA rotación de tr_refresh: los snapshots por-llamada no cubren una
    // muerte a mitad de sync, y un snapshot por detrás de la rotación = 401 en el próximo frío.
    //
    // Y ADEMÁS APARCAMOS LA PÁGINA (capítulo 3 de la saga, 2026-07-25). La WebView oculta se
    // quedaba cargada en app.traderepublic.com toda la vida del proceso, y la SPA de TR renueva
    // su sesión SOLA cada ~290 s. Secuencia mortal: snapshot al pausar (valor A) → la app sigue en
    // segundo plano → la SPA rota a B → Android mata el proceso → en frío restauramos A, ya
    // consumido → 401 real y 2FA otra vez. Nadie vigilaba esa rotación porque ocurría después de
    // nuestro último aviso. Dejando la página en blanco no queda SPA que pueda rotar nada: el
    // snapshot que acabamos de tomar es, por construcción, el último estado válido.
    // Coste: la siguiente sincronización recarga la página (2-3 s), lo mismo que ya hacía en frío.
    @Override
    protected void handleOnPause() {
        try {
            if (web != null) {
                snapshotCookies();
                // Con una llamada en vuelo NO se aparca: le quitaríamos la página de debajo a un
                // sync que el usuario dejó corriendo al cambiar de app.
                if (pending.isEmpty()) { loaded = false; loading = false; web.loadUrl(BLANK); }
            }
        } catch (Exception ignored) {}
        super.handleOnPause();
    }

    /** Inyecta un cuerpo JS async cuyo `return` (string JSON) vuelve por AndroidTR.result(id,...). */
    private void run(String id, String asyncBody) {
        AppCompatActivity act = getActivity();
        if (act == null || web == null) return;
        bodies.put(id, asyncBody);
        String wrapped =
            "(async()=>{let r;try{r=await (async()=>{" + asyncBody + "})();}" +
            "catch(e){r=JSON.stringify({ok:false,error:String(e&&e.message||e)});}" +
            "if(typeof r!=='string')r=JSON.stringify(r);" +
            "try{AndroidTR.result(" + JSONObject.quote(id) + ",r);}catch(e){}})();";
        act.runOnUiThread(() -> web.evaluateJavascript(wrapped, null));
    }

    private String track(PluginCall call) {
        String id = String.valueOf(System.nanoTime());
        pending.put(id, call);
        call.setKeepAlive(true);   // la respuesta llega asíncrona por el puente
        // Red de seguridad: si una recarga se come el contexto JS y nada responde, resolvemos
        // con error en vez de dejar el botón girando para siempre. 90 s: el peor camino en frío
        // (backoff ~9,5 s + WS 15 s + recarga + segunda pasada completa) ronda los 55 s — con el
        // timeout de 60 s de alpha14 el segundo intento moría a medias y el usuario veía un
        // "timeout" falso tras un minuto de espera (feedback 2026-07-11).
        main.postDelayed(() -> {
            PluginCall stale = pending.remove(id);
            bodies.remove(id); retriedIds.remove(id); verifyIds.remove(id);
            if (stale != null) resolveErr(stale, "TR no respondió (timeout) · reintenta");
        }, 90000);
        return id;
    }

    // ---- Métodos del contrato -------------------------------------------------------

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences("tr_bridge", Context.MODE_PRIVATE);
    }

    @PluginMethod
    public void status(PluginCall call) {
        // "conectado" = verify tuvo éxito alguna vez (flag persistente). Más fiable que
        // adivinar el nombre de la cookie de sesión (que cambia entre versiones de TR).
        JSObject r = new JSObject();
        r.put("connected", prefs().getBoolean("connected", false));
        call.resolve(r);
    }

    // LOGIN v2 (31/10/2026). TR está retirando `/api/v1/auth/web/login` cuenta a cuenta (pytr lo
    // documenta desde mayo: 426/405 según la cuenta; aquí llegó como 400 sin pasar al código). Su
    // web ya usa `/api/v2/auth/web/login`, que exige cabeceras propias (sin ellas, 400
    // MISSING_REQUIRED_HEADER) y NO manda código: se aprueba con un aviso en la app de TR, o con el
    // código de la app autenticadora si la cuenta la tiene. v1 se sigue probando PRIMERO porque a
    // otras cuentas de la familia aún les vale y su flujo de código ya está probado en sus móviles.
    // Versión y plataforma cambian con cada despliegue de la web de TR: la capa web las puede mandar
    // (login({appVersion,platform})) para corregirlas por OTA sin APK nueva.
    private static final String TR_V2_APP_VERSION = "2.2631.13";
    private static final String TR_V2_PLATFORM = "web-pro";
    private static final String V2_LOGIN = "https://api.traderepublic.com/api/v2/auth/web/login";

    /**
     * Helper JS: cabeceras del login v2 y lectura del proceso. `X-TR-Device-Info` describe ESTE
     * navegador (lo mismo que mandaría la web de TR abierta en el Chrome del móvil). El id estable
     * se genera una vez con crypto.getRandomValues y vive en el localStorage de app.traderepublic.com:
     * si cambiara en cada login, TR vería un dispositivo nuevo cada vez.
     */
    private static final String V2JS =
        "const ecode=(j)=>(j&&j.errors&&j.errors[0]&&j.errors[0].errorCode)||'';" +
        "const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));" +
        "const trHdr=(av,pf)=>{let id=null;try{id=localStorage.getItem('aely_tr_sdid');}catch(e){}" +
        "if(!id||id.length!==128){const b=new Uint8Array(64);crypto.getRandomValues(b);id=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');try{localStorage.setItem('aely_tr_sdid',id);}catch(e){}}" +
        "const ua=navigator.userAgent||'';const tz=(()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'Etc/UTC';}catch(e){return 'Etc/UTC';}})();" +
        "const info={stableDeviceId:id,browser:'Chrome',browserVersion:((ua.match(/Chrome\\/([\\d.]+)/)||[])[1]||''),os:'Android',osVersion:((ua.match(/Android ([\\d.]+)/)||[])[1]||'')," +
        "timezone:tz,timezoneOffset:new Date().getTimezoneOffset(),screen:screen.width+'x'+screen.height+'x'+screen.colorDepth," +
        "preferredLanguages:(navigator.languages&&navigator.languages.length?Array.from(navigator.languages):[navigator.language||'es']).slice(0,3),numberOfCores:navigator.hardwareConcurrency||1};" +
        "return {'Content-Type':'application/json','X-TR-Device-Info':btoa(JSON.stringify(info)),'X-TR-App-Version':av,'X-TR-Platform':pf,'Accept-Language':(navigator.language||'es')};};" +
        "const v2json=async(r)=>{const t=await r.text();let j={};try{j=JSON.parse(t)}catch(e){}return {status:r.status,j:j};};" +
        "const proc=async(pid,H)=>v2json(await wfetch('" + V2_LOGIN + "/processes/'+encodeURIComponent(pid),{method:'GET',credentials:'include',headers:H}));";

    private static String v2Param(PluginCall call, String key, String def, String re) {
        String v = call.getString(key, "");
        return (v != null && v.matches(re)) ? v : def;
    }

    /**
     * Antes de un login NUEVO caducamos tr_session/tr_refresh del jar. Las inyecta restoreCookies
     * SIN caducidad, así que tras un 401 real seguían viajando muertas al login — cosa que un
     * navegador con la sesión caducada ya no manda. tr_device y las preferencias se quedan: son
     * las que hacen que TR reconozca el dispositivo. El snapshot de prefs no se toca.
     */
    private void dropDeadSession() {
        CookieManager cm = CookieManager.getInstance();
        String[] names = {"tr_session", "tr_refresh"};
        String[] paths = {"/", "/api/v1/auth", "/api/v1/auth/web", "/api/v2/auth", "/api/v2/auth/web"};
        for (String n : names) for (String p : paths) {
            String exp = n + "=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=" + p + "; Secure; SameSite=None";
            cm.setCookie("https://api.traderepublic.com", exp);
            cm.setCookie("https://api.traderepublic.com", exp + "; Domain=.traderepublic.com");
        }
        cm.flush();
    }

    @PluginMethod
    public void login(final PluginCall call) {
        final String phone = call.getString("phone", "");
        final String pin = call.getString("pin", "");
        if (phone.isEmpty() || pin.isEmpty()) { resolveErr(call, "faltan teléfono o PIN"); return; }
        final String av = v2Param(call, "appVersion", TR_V2_APP_VERSION, "[0-9][0-9.]{0,23}");
        final String pf = v2Param(call, "platform", TR_V2_PLATFORM, "[a-z][a-z-]{0,23}");
        final String id = track(call);
        final String body = "JSON.stringify({phoneNumber:" + jsStr(phone) + ",pin:" + jsStr(pin) + "})";
        // El login también pasa por el AWS WAF: en frío (token caducado) el primer POST puede
        // fallar sin CORS ("Failed to fetch") o con 403/405 → wfetch adjunta el token del WAF como
        // cabecera y reintentamos UNA vez tras forzar token fresco.
        ensureWeb(() -> { dropDeadSession(); run(id, WFETCH + V2JS +
            "const call=async()=>v2json(await wfetch('https://api.traderepublic.com/api/v1/auth/web/login',{" +
            "method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:" + body + "}));" +
            "let res;" +
            "try{res=await call();}catch(e){await wafToken(true);try{res=await call();}catch(e2){return JSON.stringify({ok:false,error:String(e2&&e2.message||e2)+' ['+wafInfo()+']',diag:{api:'v1'}});}}" +
            "if(res.status===403||res.status===405){await wafToken(true);res=await call();}" +
            "if(res.status===200||res.status===201)return JSON.stringify({ok:true,api:'v1',flow:'code',processId:res.j.processId||res.j.processID||null,countdown:res.j.countdownInSeconds||null});" +
            "const v1=res.status,v1c=ecode(res.j);" +
            // 400/404/405/410/426 = v1 retirado o rechazado por forma → v2. 401/403/429 no: PIN mal,
            // WAF o demasiados intentos, y v2 daría lo mismo gastando otro intento del usuario.
            "if([400,404,405,410,426].indexOf(v1)<0)return JSON.stringify({ok:false,status:v1,error:(res.j.errors&&res.j.errors[0]&&res.j.errors[0].errorMessage)||('login HTTP '+v1),diag:{api:'v1',http:v1,trCode:v1c}});" +
            "const H=trHdr(" + jsStr(av) + "," + jsStr(pf) + ");" +
            "const call2=async()=>v2json(await wfetch('" + V2_LOGIN + "',{method:'POST',credentials:'include',headers:H,body:" + body + "}));" +
            "let r2;try{r2=await call2();}catch(e){await wafToken(true);try{r2=await call2();}catch(e2){return JSON.stringify({ok:false,error:String(e2&&e2.message||e2),diag:{api:'v2',v1http:v1,v1Code:v1c}});}}" +
            "const pid=r2.j.processId||r2.j.processID||null;" +
            "if((r2.status===200||r2.status===201)&&pid){let ra='';try{const p=await proc(pid,H);ra=(p.j&&p.j.requiredAction)||'';}catch(e){}" +
            "return JSON.stringify({ok:true,api:'v2',flow:ra==='AUTHENTICATOR_VERIFICATION'?'authenticator':'push',processId:pid,countdown:r2.j.countdownInSeconds||120});}" +
            "return JSON.stringify({ok:false,status:r2.status,error:'login v2 HTTP '+r2.status,diag:{api:'v2',http:r2.status,trCode:ecode(r2.j),v1http:v1,v1Code:v1c}});"
        ); });
    }

    @PluginMethod
    public void verify(final PluginCall call) {
        final String processId = call.getString("processId", "");
        final String code = call.getString("code", "");
        final boolean v2 = "v2".equals(call.getString("api", "v1"));
        final String flow = call.getString("flow", "code");
        // Con v2 por aviso no hay código: verify espera la aprobación en la app de TR.
        if (processId.isEmpty() || (code.isEmpty() && !(v2 && "push".equals(flow)))) { resolveErr(call, "faltan processId o código"); return; }
        final String av = v2Param(call, "appVersion", TR_V2_APP_VERSION, "[0-9][0-9.]{0,23}");
        final String pf = v2Param(call, "platform", TR_V2_PLATFORM, "[a-z][a-z-]{0,23}");
        final String id = track(call);
        verifyIds.add(id);   // al resolver ok=true, el Bridge marca "connected" (lo lee status())
        if (v2) {
            // Sondeo cada 2 s hasta 75 s: por debajo del timeout de track (90 s). Si aún no ha
            // aprobado, vuelve `pending` y la tarjeta deja volver a esperar sin repetir el login.
            ensureWeb(() -> run(id, WFETCH + V2JS +
                "const H=trHdr(" + jsStr(av) + "," + jsStr(pf) + ");const pid=" + jsStr(processId) + ";" +
                ("authenticator".equals(flow)
                    ? "const a=await v2json(await wfetch('" + V2_LOGIN + "/processes/'+encodeURIComponent(pid)+'/authenticator-verification',{method:'POST',credentials:'include',headers:H,body:JSON.stringify({code:" + jsStr(code) + "})}));" +
                      "if(a.status>=400)return JSON.stringify({ok:false,status:a.status,error:'código HTTP '+a.status,diag:{api:'v2',http:a.status,trCode:ecode(a.j)}});"
                    : "") +
                "const end=Date.now()+75000;" +
                "while(Date.now()<end){const p=await proc(pid,H);" +
                "if(p.status>=400)return JSON.stringify({ok:false,status:p.status,error:'proceso HTTP '+p.status,diag:{api:'v2',http:p.status,trCode:ecode(p.j)}});" +
                "const st=(p.j&&p.j.status)||'';if(st==='CONFIRMED'||st==='COMPLETED')return JSON.stringify({ok:true});" +
                "if(st&&st!=='PENDING')return JSON.stringify({ok:false,error:'proceso '+st,diag:{api:'v2',trCode:String(st)}});" +
                "await sleep(2000);}" +
                "return JSON.stringify({ok:false,pending:true,error:'sin aprobación todavía',diag:{api:'v2',trCode:'PENDING'}});"
            ));
            return;
        }
        ensureWeb(() -> run(id, WFETCH +
            "const doVerify=async()=>await wfetch('https://api.traderepublic.com/api/v1/auth/web/login/'+" + jsStr(processId) + "+'/'+" + jsStr(code) + ",{" +
            "method:'POST',credentials:'include',headers:{'Content-Type':'application/json'}});" +
            "let r;try{r=await doVerify();}catch(e){await wafToken(true);try{r=await doVerify();}catch(e2){return JSON.stringify({ok:false,error:String(e2&&e2.message||e2)+' ['+wafInfo()+']'});}}" +
            "const t=await r.text();let j={};try{j=JSON.parse(t)}catch(e){}" +
            "if(r.status===200||r.status===201)return JSON.stringify({ok:true});" +
            "return JSON.stringify({ok:false,status:r.status,error:(j.errors&&j.errors[0]&&j.errors[0].errorMessage)||('código HTTP '+r.status),diag:{api:'v1',http:r.status,trCode:(j.errors&&j.errors[0]&&j.errors[0].errorCode)||''}});"
        ));
        // (el flush de cookies se hace en Bridge.result, CUANDO el verify async ha terminado)
    }

    @PluginMethod
    public void sync(final PluginCall call) {
        final String id = track(call);
        ensureWeb(() -> run(id, WFETCH +
            // REFRESCO DE SESIÓN: tr_session dura ~290 s y se renueva SIN 2FA con
            // GET /api/v1/auth/web/session (cookie tr_refresh) — igual que pytr antes de cada petición.
            // TERCERA VUELTA (el «refresh: Failed to fetch» crónico): la causa real era CROSS-ORIGIN +
            // AWS WAF. app.traderepublic.com → api.traderepublic.com con token WAF caducado devuelve
            // un challenge SIN CORS → TypeError "Failed to fetch". getToken() solo dejaba una cookie de
            // dominio app.* que NO viaja a api.* → nunca arreglaba nada. Ahora wfetch() usa el wrapper
            // oficial AwsWafIntegration.fetch (cabecera x-aws-waf-token, que SÍ cruza subdominios).
            // Devuelve "" si ok, o el motivo (con estado del SDK) si falla — ya no a ciegas.
            // ARRANQUE EN FRÍO (alpha14→15): el challenge del AWS WAF tarda unos segundos en producir
            // un token VÁLIDO tras cargar la página. Disparar una sola vez (a los 600 ms) llega
            // demasiado pronto → "Failed to fetch". Reintentamos con espera creciente (~9,5 s)
            // forzando token nuevo entre intentos; si aun así no entra, la mejor apuesta NO es seguir
            // esperando (alpha14 gastaba ~22 s aquí y el total se comía el timeout) sino la RECARGA
            // de la página (Bridge.result → reloadThen): challenge de cero y segunda pasada completa.
            // En caliente el token ya vale → entra al primer intento sin esperar.
            // 401 = sesión de VERDAD caducada (2FA) → no insistir.
            "const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));" +
            "const refreshOnce=async()=>{const r=await wfetch('https://api.traderepublic.com/api/v1/auth/web/session',{method:'GET',credentials:'include',headers:{}});return r.status;};" +
            "const refresh=async()=>{const delays=[0,1500,3000,5000];let last='';" +
            "for(let i=0;i<delays.length;i++){if(delays[i])await sleep(delays[i]);if(i>0)await wafToken(true);" +
            "try{const s=await refreshOnce();if(s===200||s===201){try{AndroidTR.snap()}catch(e){}return '';}if(s===401){return 'HTTP 401';}last='HTTP '+s;}" +
            "catch(e){last=String(e&&e.message||e)+' ['+wafInfo()+']';}}" +
            "return last;};" +
            // Protocolo real de TR (mapeado en vivo 2026-07): connect 31 → "connected";
            //   sub {id} {type:compactPortfolioByType} → {categories:[{positions:[{isin,netSize,averageBuyIn,name}]}]}
            //   sub {id} {type:availableCash}          → [{currencyId,amount}]
            //   sub {id} {type:ticker,id:"ISIN.LSX"}   → {last:{price},bid,ask}  (precio EUR en vivo)
            // value = precio × participaciones; cost = averageBuyIn × participaciones. Todo EUR.
            // IMPORTANTE: los IDs de suscripción DEBEN ser numéricos (TR ignora en silencio los de letra).
            // Posiciones=1, efectivo=2, tickers=100+i.
            "const trySync=()=>new Promise((resolve)=>{" +
            "const ws=new WebSocket('wss://api.traderepublic.com/');" +
            "let positions=null,cash=null,posDone=false;const price={};" +
            "let done=false;const fin=(o)=>{if(done)return;done=true;try{ws.close()}catch(e){};resolve(o);};" +
            "const hardTo=setTimeout(()=>finishOk(),15000);let graceTo=null;" +
            "const finishOk=()=>{clearTimeout(hardTo);if(graceTo)clearTimeout(graceTo);" +
              "const pos=(positions||[]).map(p=>{const sh=Number(p.netSize||0);const pr=price[p.isin];" +
              "return {isin:p.isin,shares:sh,name:p.name||''," +
              "cost:(p.averageBuyIn!=null?Number(p.averageBuyIn)*sh:undefined)," +
              "value:(pr!=null?pr*sh:undefined)};});" +
              "fin({ok:true,positions:pos,cash:cash});};" +
            "const maybeGrace=()=>{if(posDone&&cash!=null&&!graceTo)graceTo=setTimeout(finishOk,3500);};" +
            "ws.onopen=()=>ws.send('connect 31 '+JSON.stringify({locale:'es',platformId:'webtrading',platformVersion:'chrome - 138.0',clientId:'app.traderepublic.com',clientVersion:'1.0.0'}));" +
            "ws.onerror=()=>fin({ok:false,error:'error de conexión con TR'});" +
            "ws.onclose=(e)=>{if(!done)fin({ok:false,error:'TR cerró la conexión ('+e.code+') · vuelve a conectar'});};" +
            "ws.onmessage=(m)=>{const d=String(m.data);" +
            "if(d==='connected'){ws.send('sub 1 '+JSON.stringify({type:'compactPortfolioByType'}));ws.send('sub 2 '+JSON.stringify({type:'availableCash'}));return;}" +
            "const sp=d.indexOf(' ');if(sp<0)return;const fid=d.slice(0,sp);const rest=d.slice(sp+1);" +
            "const sp2=rest.indexOf(' ');const code=sp2<0?rest:rest.slice(0,sp2);const body=sp2<0?'':rest.slice(sp2+1);" +
            "let j=null;try{j=JSON.parse(body)}catch(e){}" +
            "if(code==='E'){const ec=j&&j.errors&&j.errors[0]&&j.errors[0].errorCode;" +
              "if(String(ec).indexOf('AUTHENTICATION')>=0){return fin({ok:false,authExpired:true});}return;}" +
            "if(fid==='1'&&j&&j.categories&&positions==null){positions=[];j.categories.forEach(c=>(c.positions||[]).forEach(p=>positions.push(p)));posDone=true;" +
              "positions.forEach((p,i)=>{try{ws.send('sub '+(100+i)+' '+JSON.stringify({type:'ticker',id:p.isin+'.LSX'}));}catch(e){}});" +
              "if(positions.length===0)finishOk();else maybeGrace();}" +
            "if(fid==='2'&&j&&cash==null){let c=0;if(Array.isArray(j)){j.forEach(x=>{if(x&&x.amount!=null)c+=Number(x.amount);});}else if(j.amount!=null){c=Number(j.amount);}cash=c;maybeGrace();}" +
            "if(Number(fid)>=100&&code==='A'&&j){const idx=Number(fid)-100;const p=positions&&positions[idx];" +
              "if(p&&price[p.isin]==null){const pr=(j.last&&j.last.price)||(j.bid&&j.bid.price)||(j.ask&&j.ask.price);if(pr!=null){price[p.isin]=Number(pr);try{ws.send('unsub '+fid);}catch(e){}}}" +
              "if(positions&&Object.keys(price).length>=positions.length&&cash!=null)finishOk();}" +
            "};});" +
            // Orquestación: refresca (backoff ~9,5 s) → sincroniza → si aún caduca, UN disparo
            // forzado más (no otro backoff, para no reventar el timeout) y reintenta 1 vez.
            // · 401 REAL en el refresh → sesión caducada de verdad: fuera ya, sin gastar 15 s de WS.
            // · authExpired con el refresh BLOQUEADO por el WAF (no-401) ≠ sesión caducada: se marca
            //   wafBlocked (la sesión sigue viva, NO desconectar) — antes esto ponía connected=false
            //   y pedía re-hacer el 2FA sin necesidad (feedback 2026-07-11). El texto conserva el
            //   motivo (p.ej. "Failed to fetch") para que Bridge.result dispare la recarga+reintento.
            "const refreshForced=async()=>{await wafToken(true);try{const s=await refreshOnce();if(s===200||s===201){try{AndroidTR.snap()}catch(e){}return '';}return 'HTTP '+s;}catch(e){return String(e&&e.message||e);}};" +
            "const rerr=await refresh();" +
            "if(rerr==='HTTP 401')return JSON.stringify({ok:false,authExpired:true,error:'Tu sesión de TR caducó. Vuelve a conectar: PIN y código nuevo (el teléfono queda puesto).'});" +
            "let r=await trySync();" +
            "if(!r.ok&&r.authExpired&&rerr){if(!(await refreshForced()))r=await trySync();}" +
            "if(!r.ok&&r.authExpired){" +
            "if(rerr){delete r.authExpired;r.wafBlocked=true;r.error='TR aún no deja pasar (control anti-bot · '+rerr+'). Espera unos segundos y vuelve a sincronizar.';}" +
            "else{r.error='Tu sesión de TR caducó (refresh: ok). Vuelve a conectar: PIN y código nuevo.';}}" +
            "return r;"
        ));
    }

    @PluginMethod
    public void logout(PluginCall call) {
        prefs().edit().putBoolean("connected", false)
            .remove("cookieSnap").remove("cookieSnapNames").remove("cookieSnapAt").apply();  // fuera la sesión guardada
        CookieManager cm = CookieManager.getInstance();
        cm.removeAllCookies(null);
        cm.flush();
        loaded = false;
        AppCompatActivity act = getActivity();
        if (act != null && web != null) act.runOnUiThread(() -> web.clearCache(true));
        JSObject r = new JSObject();
        r.put("ok", true);
        call.resolve(r);
    }

    // ---- utilidades -----------------------------------------------------------------
    private static void resolveErr(PluginCall call, String msg) {
        JSObject r = new JSObject();
        r.put("ok", false);
        r.put("error", msg);
        call.resolve(r);
    }

    private static String jsStr(String s) {
        return JSONObject.quote(s == null ? "" : s);
    }
}
