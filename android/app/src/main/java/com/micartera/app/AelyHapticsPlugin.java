package com.micartera.app;

import android.content.Context;
import android.os.Build;
import android.os.VibrationAttributes;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;
import android.view.HapticFeedbackConstants;
import android.view.View;
import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONException;

/** La web propone el momento; el ajuste táctil del sistema sigue mandando en ambos métodos. */
@CapacitorPlugin(name = "AelyHaptics")
public class AelyHapticsPlugin extends Plugin {
    /* UX16 ronda 4: fuerza y duración las elige él en el ajustador de la web (beta). Sin ellas,
       los valores de la APK 58, así una web vieja sobre esta APK no cambia nada. */
    @PluginMethod
    public void edge(PluginCall call) {
        int amplitude = HapticPlan.clamp(intArg(call, "amplitude", HapticPlan.EDGE_AMPLITUDE), 1, 255);
        int duration = HapticPlan.clamp(intArg(call, "durationMs", HapticPlan.EDGE_MS), 1, HapticPlan.MAX_EDGE_MS);
        play(call, true, HapticPlan.single(duration, amplitude));
    }

    // El ajustador pregunta si es la APK .debug: ahí se enseña aunque el canal no sea beta.
    @PluginMethod
    public void info(PluginCall call) {
        JSObject result = new JSObject();
        result.put("debug", BuildConfig.DEBUG);result.put("api", Build.VERSION.SDK_INT);
        call.resolve(result);
    }

    @PluginMethod
    public void fill(PluginCall call) {
        // La onda llega hecha desde la web (sigue al trazo del anillo); si falta o no cuadra, la rampa de siempre.
        HapticPlan.Wave custom = customWave(call);
        Double requested = call.getDouble("durationMs", 0.0);
        int duration = requested == null || Double.isNaN(requested) || Double.isInfinite(requested) || requested <= 0 ? 0 : (int) Math.min(1200, requested);
        play(call, false, custom != null ? custom : HapticPlan.waveform(duration));
    }

    private static int intArg(PluginCall call, String key, int fallback) {
        Double value = call.getDouble(key, null);
        return value == null || Double.isNaN(value) || Double.isInfinite(value) ? fallback : (int) Math.round(Math.max(-1e6, Math.min(1e6, value)));
    }

    private static HapticPlan.Wave customWave(PluginCall call) {
        JSArray timings = call.getArray("timings", null), amplitudes = call.getArray("amplitudes", null);
        if (timings == null || amplitudes == null || timings.length() != amplitudes.length() || timings.length() > HapticPlan.MAX_STEPS) return null;
        long[] t = new long[timings.length()];
        int[] a = new int[amplitudes.length()];
        try {
            for (int i = 0; i < t.length; i++) { t[i] = timings.getLong(i); a[i] = amplitudes.getInt(i); }
        } catch (JSONException bad) { return null; }
        return HapticPlan.custom(t, a);
    }

    @SuppressWarnings("deprecation")
    private boolean allowed(View view) {
        return view != null && view.isHapticFeedbackEnabled() && view.isShown() && view.hasWindowFocus()
            && Settings.System.getInt(getContext().getContentResolver(), Settings.System.HAPTIC_FEEDBACK_ENABLED, 0) != 0;
    }

    private String softFallback(View view) {
        // Si el motor no puede dar este toque muy suave, Android permite callar; sin toque fuerte.
        return Build.VERSION.SDK_INT >= 34 && allowed(view)
            && view.performHapticFeedback(HapticFeedbackConstants.SEGMENT_FREQUENT_TICK) ? "SOFT_TICK" : "NONE";
    }

    /* UX16 ronda 6: el dumpsys de su OnePlus 13 enseña que con usage TOUCH el sistema tira
       nuestra onda y toca su efecto de serie de 45 ms (OplusPrebakedSegment, dos fuerzas), y que
       las de HARDWARE_FEEDBACK sí suenan con su forma. El usage lo elige el ajustador de beta
       mientras se comprueba cuál respeta la onda; sin él, TOUCH como hasta ahora. */
    private static int usageConstant(HapticPlan.Usage usage) {
        switch (usage) {
            case HARDWARE: return VibrationAttributes.USAGE_HARDWARE_FEEDBACK;
            case MEDIA: return VibrationAttributes.USAGE_MEDIA;
            case UNKNOWN: return VibrationAttributes.USAGE_UNKNOWN;
            default: return VibrationAttributes.USAGE_TOUCH;
        }
    }

    @SuppressWarnings("deprecation")
    private static void vibrate(Vibrator vibrator, VibrationEffect effect, HapticPlan.Usage usage) {
        // VibrationAttributes existe desde API 33; antes, la onda va sin atributos.
        if (Build.VERSION.SDK_INT >= 33) vibrator.vibrate(effect, new VibrationAttributes.Builder().setUsage(usageConstant(usage)).build());
        else vibrator.vibrate(effect);
    }

    private void play(PluginCall call, boolean edge, HapticPlan.Wave raw) {
        HapticPlan.Usage usage = HapticPlan.usage(call.getString("usage", null));
        getActivity().runOnUiThread(() -> {
            JSObject result = new JSObject();
            String path = "NONE";
            View view = null;
            boolean amplitude = false;
            long onMs = 0;
            try {
                view = getBridge().getWebView();
                if (raw != null && allowed(view)) {
                    Vibrator vibrator = (Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
                    boolean present = vibrator != null && vibrator.hasVibrator();
                    if (present) amplitude = vibrator.hasAmplitudeControl();
                    HapticPlan.Path selected = HapticPlan.select(Build.VERSION.SDK_INT, true, present);
                    HapticPlan.Wave wave = selected == HapticPlan.Path.WAVEFORM ? HapticPlan.shape(raw, amplitude) : null;
                    if (wave != null) {
                        // Sin control de amplitud Android trata cualquier valor distinto de 0 como «encendido»:
                        // el troceo en ranuras es entonces lo único que hace de fuerza, y basta.
                        VibrationEffect effect = VibrationEffect.createWaveform(wave.timings, wave.amplitudes, -1);
                        vibrate(vibrator, effect, usage);
                        path = selected.name();
                        onMs = HapticPlan.onTime(wave);
                    } else if (edge) path = softFallback(view);
                }
            } catch (RuntimeException ignored) {
                try { path = edge ? softFallback(view) : "NONE"; } catch (RuntimeException unavailable) { path = "NONE"; }
            }
            // Respuesta por llamada sin logs ni identificadores: el ajustador la enseña para saber
            // qué hizo el motor de verdad (ruta, si acepta amplitud y cuánto rato estuvo encendido).
            result.put("path", path);result.put("api", Build.VERSION.SDK_INT);
            result.put("amplitudeControl", amplitude);result.put("onMs", onMs);
            result.put("continuous", !edge && path.equals("WAVEFORM"));
            // La web pregunta esto para avisar de que la APK instalada aún no entiende el ajustador.
            result.put("tunable", true);result.put("shaped", true);result.put("usage", usage.name());
            call.resolve(result);
        });
    }
}
