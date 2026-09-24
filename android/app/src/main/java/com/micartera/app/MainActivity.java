package com.micartera.app;

import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;

import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        /* ACTIVA de verdad la librería de compatibilidad del splash (2026-08-01). Estaba en
           build.gradle desde el principio pero nunca se llamaba — sin esto, el tema
           `Theme.SplashScreen` de styles.xml no coordina su comportamiento con esta Activity y
           en versiones antiguas de Android (< 12, minSdk 23) el splash "de verdad" no siempre se
           encadena bien con el primer pintado. Tiene que ir ANTES de super.onCreate(), que es
           justo cuando la librería necesita enganchar la ventana. */
        SplashScreen.installSplashScreen(this);
        registerPlugin(MiCarteraPlugin.class);       // antes de super.onCreate (así lo pide Capacitor)
        registerPlugin(TradeRepublicPlugin.class);   // puente TR (beta)
        super.onCreate(savedInstanceState);
        /* La barra fina que Android dibuja en el borde pertenece a la WebView, no a los scrollers
           CSS: `scrollbar-width:none` y `::-webkit-scrollbar` ya estaban aplicados a toda la app
           y aun así seguía visible en cada pantalla (feedback real 2026-09-23). Desactivar solo
           el indicador nativo conserva el scroll, la inercia y el rubber-band; no cambia ningún
           `overflow` ni la navegación de la web. Tiene que ir después de `super`, cuando
           Capacitor ya ha creado el Bridge y su WebView. */
        try {
            android.webkit.WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null) {
                webView.setVerticalScrollBarEnabled(false);
                webView.setHorizontalScrollBarEnabled(false);
            }
        } catch (Throwable ignored) {}
        /* Si el splash no encadenó bien al NoActionBar (falta postSplashScreenTheme o OEM raro),
           la ActionBar nativa deja una franja bajo la cámara encima de la WebView (2026-08-06). */
        try {
            if (getSupportActionBar() != null) getSupportActionBar().hide();
        } catch (Throwable ignored) {}
        /* INSPECCIÓN DE LA WEBVIEW EN EL MÓVIL DE VERDAD (2026-07-27). Sin esto no hay forma de
           medir el lag donde ocurre: `dumpsys gfxinfo` da 120 fps aunque la web esté congelada,
           porque una WebView pinta siempre su ÚLTIMO fotograma disponible y Android lo cuenta como
           frame bueno. Con esto, `chrome://inspect` (o CDP por adb) ve el proceso de render real y
           se puede medir el gesto que falla con sus datos y su dedo. Así se encontró el candado
           que no se soltaba (docs/LAG-DESLIZAR.md §0).
           ⚠ APAGADO salvo que se compile con MICARTERA_WEBDEBUG=1 en local.properties: la APK que
           publica el CI NO abre el socket. El de casa sí, y por adb desde un PC autorizado.
           ⚠ DESPUÉS de super.onCreate() a propósito: Capacitor hace
           `WebView.setWebContentsDebuggingEnabled(config.isWebContentsDebuggingEnabled())` al
           montar el puente (Bridge.java:599), o sea que en release lo APAGA. Si esta línea va
           antes, Capacitor la pisa y el socket no aparece nunca. */
        if (BuildConfig.WEB_DEBUG) {
            try { android.webkit.WebView.setWebContentsDebuggingEnabled(true); } catch (Throwable ignored) {}
        }
        // Edge-to-edge: la WebView pinta bajo status bar Y nav bar; el CSS usa --safe-top/--safe-bottom.
        try {
            Window w = getWindow();
            WindowCompat.setDecorFitsSystemWindows(w, false);
            w.setStatusBarColor(Color.TRANSPARENT);
            w.setNavigationBarColor(Color.TRANSPARENT);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                w.setStatusBarContrastEnforced(false);
                w.setNavigationBarContrastEnforced(false);
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                WindowManager.LayoutParams lp = w.getAttributes();
                lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
                w.setAttributes(lp);
            }
            View decor = w.getDecorView();
            decor.setSystemUiVisibility(decor.getSystemUiVisibility()
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
            WindowInsetsControllerCompat ctrl = WindowCompat.getInsetsController(w, decor);
            if (ctrl != null) {
                ctrl.setAppearanceLightStatusBars(false);
                ctrl.setAppearanceLightNavigationBars(false);
            }
        } catch (Exception ignored) {}
        stashGoto(getIntent());                      // punto 5: la app se ABRIÓ tocando una noti de gasto
        // Chequeo OTA/APK en background (app cerrada) — sin esto la noti solo salta al abrir.
        OtaCheckScheduler.ensure(this);
        // Avisos de recibos «la víspera» con la app cerrada (APK 29, 2026-07-18).
        AlertCheckScheduler.ensure(this);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        stashGoto(intent);                           // punto 5: la app YA estaba abierta y tocas la noti
    }

    // Guarda el deep-link en prefs; la web lo consume al volver a primer plano con
    // MiCartera.consumeGoto(). Dos orígenes: extra "mc_goto" de una notificación de gasto
    // (→ salta a la ficha) o el esquema micartera:// de la vuelta del banco (Open Banking):
    // micartera://bank?ok=1 → "bank|ok" · micartera://bank?msg=... → "bank|error|<msg>".
    private void stashGoto(Intent intent) {
        if (intent == null) return;
        String g = intent.getStringExtra("mc_goto");
        if (g == null || g.isEmpty()) {
            android.net.Uri u = intent.getData();
            if (u != null && "micartera".equals(u.getScheme()) && "bank".equals(u.getHost())) {
                String msg = u.getQueryParameter("msg");
                g = (msg != null && !msg.isEmpty()) ? "bank|error|" + msg : "bank|ok";
            }
        }
        if (g == null || g.isEmpty()) return;
        getSharedPreferences("micartera_goto", Context.MODE_PRIVATE)
                .edit().putString("pending", g).apply();
    }
}
